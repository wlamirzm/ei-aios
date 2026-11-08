// ==============================================================================
// REAL CONCURRENCY VALIDATION: MULTI-PROCESS ISOLATED TEST HARNESS
// Executa dois processos independentes do sistema operacional (Node.js child_process)
// interagindo contra um endpoint com lock atômico sem tocar no banco de produção.
// ==============================================================================

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { fork } from 'node:child_process';

describe('Sprint 5 — Concorrência Real com Dois Processos Independentes (Multi-Process)', () => {

  it('EXEC-MULTI-PROC: Dois workers concorrentes em processos separados disputam a mesma tarefa', async () => {
    // 1. Cria um servidor HTTP local isolado simulando o comportamento atômico do PostgreSQL/Supabase
    let taskState = {
      id: 'TASK-REAL-CONCURRENT-001',
      task_code: 'MACRO-RACE-01',
      status: 'pending',
      started_at: null as string | null,
      input_payload: {} as Record<string, any>,
      result_payload: null as any
    };

    let claimAttempts = 0;
    const claimLogs: Array<{ worker: string; lease: string; result: string; timestamp: number }> = [];

    const server = http.createServer((req, res) => {
      let body = '';
      req.on('data', chunk => { body += chunk; });
      req.on('end', () => {
        const url = new URL(req.url || '', `http://${req.headers.host}`);
        const parsed = body ? JSON.parse(body) : {};

        // Rota de Claim Atômico: PATCH /tasks/claim
        // Semântica PostgreSQL: UPDATE tasks SET status = 'running', lease_token = :lease WHERE id = :id AND status = 'pending'
        if (req.method === 'POST' && url.pathname === '/tasks/claim') {
          claimAttempts++;
          const workerName = parsed.workerName || 'Worker-Unknown';
          const leaseToken = parsed.leaseToken || 'lease-default';

          // Atomic check-and-set
          if (taskState.status === 'pending') {
            taskState.status = 'running';
            taskState.started_at = new Date().toISOString();
            taskState.input_payload = { ...taskState.input_payload, lease_token: leaseToken };
            claimLogs.push({ worker: workerName, lease: leaseToken, result: 'CLAIMED', timestamp: Date.now() });

            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: true, claimedCount: 1, task: taskState }));
            return;
          } else {
            claimLogs.push({ worker: workerName, lease: leaseToken, result: 'REJECTED_ALREADY_RUNNING', timestamp: Date.now() });
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: false, claimedCount: 0, reason: 'already_running' }));
            return;
          }
        }

        // Rota de Watchdog Recovery: POST /tasks/watchdog-recover
        if (req.method === 'POST' && url.pathname === '/tasks/watchdog-recover') {
          if (taskState.status === 'running') {
            taskState.status = 'pending';
            taskState.started_at = null;
            // Watchdog revoga o lease_token anterior
            taskState.input_payload = { ...taskState.input_payload, lease_token: null, recovery_reason: 'timeout_expired' };
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: true, recoveredCount: 1, task: taskState }));
            return;
          }
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: false, recoveredCount: 0 }));
          return;
        }

        // Rota de Conclusão / Escrita com Lock Otimista: POST /tasks/complete
        if (req.method === 'POST' && url.pathname === '/tasks/complete') {
          const workerLease = parsed.leaseToken;
          const currentLease = taskState.input_payload?.lease_token;

          if (taskState.status !== 'running') {
            res.writeHead(409, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: false, error: 'zombie_status_invalid', currentStatus: taskState.status }));
            return;
          }
          if (currentLease && currentLease !== workerLease) {
            res.writeHead(409, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: false, error: 'zombie_lease_mismatch', currentLease, workerLease }));
            return;
          }

          taskState.status = 'completed';
          taskState.result_payload = parsed.resultPayload;
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: true, task: taskState }));
          return;
        }

        // Consulta de status: GET /tasks/status
        if (req.method === 'GET' && url.pathname === '/tasks/status') {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify(taskState));
          return;
        }

        res.writeHead(404);
        res.end();
      });
    });

    // Inicia o servidor em porta efêmera
    await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
    const port = (server.address() as any).port;
    const serverUrl = `http://127.0.0.1:${port}`;

    try {
      // 2. Cria script temporário para o worker em processo filho independente
      // O script tenta dar claim na tarefa e reporta o resultado via IPC / stdout
      const workerScript = `
        const workerName = process.env.WORKER_NAME || 'Worker-Unknown';
        const serverUrl = process.env.SERVER_URL;
        const leaseToken = 'lease_' + workerName + '_' + Date.now();

        async function run() {
          try {
            const res = await fetch(serverUrl + '/tasks/claim', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ workerName, leaseToken })
            });
            const data = await res.json();
            console.log(JSON.stringify({ worker: workerName, lease: leaseToken, data }));
          } catch (err) {
            console.error(err);
            process.exit(1);
          }
        }
        run();
      `;

      // 3. Executa DOIS processos Node.js independentes simultaneamente via child_process.fork
      const runWorkerProcess = (name: string): Promise<{ worker: string; lease: string; data: any }> => {
        return new Promise((resolve, reject) => {
          const child = fork('-e', [workerScript], {
            env: {
              ...process.env,
              WORKER_NAME: name,
              SERVER_URL: serverUrl
            },
            stdio: ['pipe', 'pipe', 'pipe', 'ipc']
          });

          let output = '';
          child.stdout?.on('data', chunk => { output += chunk.toString(); });
          child.stderr?.on('data', chunk => { console.error(`[${name} ERR]`, chunk.toString()); });

          child.on('close', code => {
            if (code !== 0) {
              reject(new Error(`Worker process ${name} exited with code ${code}`));
            } else {
              try {
                const parsed = JSON.parse(output.trim());
                resolve(parsed);
              } catch (e) {
                reject(new Error(`Failed to parse worker output: ${output}`));
              }
            }
          });
        });
      };

      // Dispara simultaneamente os dois processos no sistema operacional
      const [resWorker1, resWorker2] = await Promise.all([
        runWorkerProcess('WorkerProcess-A'),
        runWorkerProcess('WorkerProcess-B')
      ]);

      // 4. VERIFICAÇÃO 1: Apenas um worker conseguiu o claim
      const w1Claimed = resWorker1.data.claimedCount === 1;
      const w2Claimed = resWorker2.data.claimedCount === 1;

      assert.equal((w1Claimed ? 1 : 0) + (w2Claimed ? 1 : 0), 1, 'Exatamente um processo OS deve vencer a disputa.');
      assert.equal(claimAttempts, 2, 'Ambos os processos devem ter tentado o claim.');
      assert.equal(claimLogs.length, 2, 'Ambos os claims devem ter sido registrados no log atômico.');

      const winner = w1Claimed ? resWorker1 : resWorker2;
      const loser = w1Claimed ? resWorker2 : resWorker1;

      assert.equal(winner.data.success, true);
      assert.equal(loser.data.success, false);
      assert.equal(loser.data.reason, 'already_running');
      assert.equal(taskState.status, 'running');
      assert.equal(taskState.input_payload.lease_token, winner.lease);

      // 5. VERIFICAÇÃO 2: Watchdog recupera a tarefa por timeout e invalida o lease anterior
      const recoverRes = await fetch(`${serverUrl}/tasks/watchdog-recover`, { method: 'POST' });
      const recoverData = await recoverRes.json() as any;
      assert.equal(recoverData.success, true);
      assert.equal(taskState.status, 'pending');
      assert.equal(taskState.input_payload.lease_token, null, 'O watchdog deve anular o lease anterior.');

      // 6. VERIFICAÇÃO 3: O worker perdedor (ou um novo worker) agora consegue assumir a tarefa
      const newClaimRes = await fetch(`${serverUrl}/tasks/claim`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ workerName: loser.worker, leaseToken: 'new_lease_after_recovery_999' })
      });
      const newClaimData = await newClaimRes.json() as any;
      assert.equal(newClaimData.success, true);
      assert.equal(taskState.input_payload.lease_token, 'new_lease_after_recovery_999');

      // 7. VERIFICAÇÃO 4: O worker antigo (zumbi) tenta completar a tarefa usando seu lease expirado
      const zombieCompleteRes = await fetch(`${serverUrl}/tasks/complete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          leaseToken: winner.lease, // Lease antigo do worker atrasado!
          resultPayload: { data: 'dados defasados do worker zumbi' }
        })
      });
      assert.equal(zombieCompleteRes.status, 409, 'A escrita tardia do worker zumbi deve ser rejeitada com HTTP 409.');
      const zombieData = await zombieCompleteRes.json() as any;
      assert.equal(zombieData.error, 'zombie_lease_mismatch');

      // 8. VERIFICAÇÃO 5: O worker legítimo completa com sucesso
      const legitCompleteRes = await fetch(`${serverUrl}/tasks/complete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          leaseToken: 'new_lease_after_recovery_999',
          resultPayload: { data: 'dados auditados e válidos' }
        })
      });
      assert.equal(legitCompleteRes.status, 200);
      assert.equal(taskState.status, 'completed');
      assert.deepEqual(taskState.result_payload, { data: 'dados auditados e válidos' });

    } finally {
      await new Promise<void>(resolve => server.close(() => resolve()));
    }
  });

});
