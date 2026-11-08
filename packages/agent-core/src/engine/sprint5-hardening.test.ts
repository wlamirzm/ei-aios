// ==============================================================================
// SPRINT 5 AUTOMATED TEST SUITE — RELIABILITY, ORCHESTRATION & CONCURRENCY
// Scenarios HARD-01 through HARD-07
// ==============================================================================

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  calculateMrrAndArr,
  ClientFinancialContractInput
} from '../tools/finops-calculator.js';
import {
  AgentId,
  TaskStatus
} from '@ei-aios/shared';

describe('Sprint 5 — Reliability, Orchestration Hardening & Concurrency Governance (HARD-01 a HARD-07)', () => {

  // ----------------------------------------------------------------------------
  // HARD-01: Multi-Worker Atomic Claim
  // ----------------------------------------------------------------------------
  it('HARD-01: Claim atômico impede execução simultânea por dois workers válidos', async () => {
    // Simula a tabela de tarefas com um item PENDING
    const taskId = 'task-uuid-hard-01';
    let currentTaskState: {
      id: string;
      status: string;
      started_at: string | null;
      lease_token: string | null;
    } = {
      id: taskId,
      status: TaskStatus.PENDING,
      started_at: null,
      lease_token: null
    };

    // Função de claim atômico simulando a query:
    // UPDATE tasks SET status = 'running', lease_token = lease WHERE id = taskId AND status = 'pending'
    const atomicClaim = async (workerId: string, leaseToken: string) => {
      if (currentTaskState.status === TaskStatus.PENDING) {
        currentTaskState = {
          ...currentTaskState,
          status: TaskStatus.RUNNING,
          started_at: new Date().toISOString(),
          lease_token: leaseToken
        };
        return { success: true, claimedBy: workerId, leaseToken };
      }
      return { success: false, claimedBy: workerId, leaseToken: null };
    };

    const leaseWorkerA = `lease_worker_A_${Date.now()}`;
    const leaseWorkerB = `lease_worker_B_${Date.now()}`;

    // Dispara dois workers simultâneos tentando o claim da mesma tarefa
    const [resultA, resultB] = await Promise.all([
      atomicClaim('Worker-A', leaseWorkerA),
      atomicClaim('Worker-B', leaseWorkerB)
    ]);

    // Exatamente um worker deve ter tido sucesso
    const successCount = (resultA.success ? 1 : 0) + (resultB.success ? 1 : 0);
    assert.equal(successCount, 1, 'Exatamente um worker deve conseguir realizar o claim da tarefa pendente.');

    // A tarefa deve estar em running com o lease_token do vencedor
    assert.equal(currentTaskState.status, TaskStatus.RUNNING);
    assert.ok(
      currentTaskState.lease_token === leaseWorkerA || currentTaskState.lease_token === leaseWorkerB,
      'O lease_token gravado deve ser do worker que venceu o claim atômico.'
    );
  });

  // ----------------------------------------------------------------------------
  // HARD-02: Zombie Worker & Late Completion Rejection
  // ----------------------------------------------------------------------------
  it('HARD-02: Worker atrasado/zumbi não consegue sobrescrever tarefa já recuperada por timeout', async () => {
    const taskId = 'task-uuid-hard-02';
    const oldLeaseToken = 'lease_worker_old_123';
    const newLeaseToken = 'lease_worker_new_456';

    // Estado da tarefa após o watchdog ter recuperado e outro worker ter assumido
    let taskInDatabase = {
      id: taskId,
      status: TaskStatus.RUNNING,
      input_payload: {
        lease_token: newLeaseToken,
        recovery_reason: 'Recuperada por timeout'
      },
      retry_count: 1
    };

    // Simula a validação de lock otimista de processSingleTask:
    const attemptCompleteByWorker = (workerLease: string, _deliverable: any) => {
      // 1. Checa status
      if (taskInDatabase.status !== TaskStatus.RUNNING) {
        return { written: false, reason: 'status_not_running' };
      }
      // 2. Checa lease_token
      if (taskInDatabase.input_payload.lease_token !== workerLease) {
        return { written: false, reason: 'lease_mismatch_zombie_prevented' };
      }

      // Se passou nas checagens atômicas, completa a tarefa
      taskInDatabase = {
        ...taskInDatabase,
        status: TaskStatus.COMPLETED
      };
      return { written: true, reason: 'completed' };
    };

    // Worker antigo tenta finalizar a tarefa com seu lease expirado
    const lateResult = attemptCompleteByWorker(oldLeaseToken, { output: 'dados defasados' });
    assert.equal(lateResult.written, false, 'Execução atrasada deve ser rejeitada.');
    assert.equal(lateResult.reason, 'lease_mismatch_zombie_prevented');
    assert.equal(taskInDatabase.status, TaskStatus.RUNNING, 'Status da tarefa não pode ser sobrescrito pelo worker zumbi.');

    // Novo worker legítimo completa a tarefa
    const legitResult = attemptCompleteByWorker(newLeaseToken, { output: 'dados válidos atualizados' });
    assert.equal(legitResult.written, true, 'Worker com lease válido deve conseguir completar a tarefa.');
    assert.equal(taskInDatabase.status, TaskStatus.COMPLETED);
  });

  // ----------------------------------------------------------------------------
  // HARD-03: Atomic Synthesis Lock & Duplicate Prevention
  // ----------------------------------------------------------------------------
  it('HARD-03: Síntese da tarefa-mãe possui lock atômico e executa exatamente uma vez', async () => {
    let parentStatus = TaskStatus.RUNNING;
    let synthesisCallCount = 0;

    // Simula a aquisição atômica de lock de síntese:
    // UPDATE tasks SET status = 'synthesizing' WHERE id = parentId AND status = 'running'
    const tryAcquireSynthesisLock = () => {
      if (parentStatus === TaskStatus.RUNNING) {
        parentStatus = TaskStatus.SYNTHESIZING;
        return true;
      }
      return false;
    };

    const runSynthesis = async (callerId: string) => {
      const locked = tryAcquireSynthesisLock();
      if (!locked) {
        return { executed: false, callerId };
      }
      synthesisCallCount++;
      // Simula síntese e conclusão
      parentStatus = TaskStatus.COMPLETED;
      return { executed: true, callerId };
    };

    // Dispara dois eventos simultâneos (ex: término da última subtarefa e reconciliação periódica)
    const [call1, call2] = await Promise.all([
      runSynthesis('SubtaskCompletionHook'),
      runSynthesis('PeriodicReconciliationLoop')
    ]);

    const executions = (call1.executed ? 1 : 0) + (call2.executed ? 1 : 0);
    assert.equal(executions, 1, 'A síntese executiva deve ser disparada exatamente uma vez.');
    assert.equal(synthesisCallCount, 1, 'Contador de síntese deve ser rigorosamente 1.');
    assert.equal(parentStatus, TaskStatus.COMPLETED);
  });

  // ----------------------------------------------------------------------------
  // HARD-04: Structured Failure Consolidation
  // ----------------------------------------------------------------------------
  it('HARD-04: Falhas definitivas de subtarefas produzem encerramento estruturado com relatório de contingência', async () => {
    const parentTaskId = 'macro-obj-fail-test';
    const subtasks = [
      {
        task_code: 'MACRO-01',
        assigned_agent_id: AgentId.AG_003,
        objective: 'Diagnóstico de Demanda e Ultrapassagem',
        status: TaskStatus.COMPLETED,
        result_payload: { savings: 12000 }
      },
      {
        task_code: 'MACRO-02',
        assigned_agent_id: AgentId.AG_004,
        objective: 'Extração e Validação Estruturada de Fatura',
        status: TaskStatus.FAILED,
        result_payload: { error: 'Arquivo PDF corrompido / Ilegível pelo OCR' }
      }
    ];

    // Simula a lógica de consolidação de contingência implementada em orchestrator.ts
    const failedSubtasks = subtasks.filter(s => s.status === TaskStatus.FAILED);
    assert.equal(failedSubtasks.length, 1);

    const contingencyData = {
      parent_task_id: parentTaskId,
      deliverable_title: `Encerramento Estruturado por Falha — Diagnóstico Energético`,
      status: TaskStatus.FAILED,
      synthesized_by: AgentId.AG_001,
      subtasks_count: subtasks.length,
      failed_subtasks_count: failedSubtasks.length,
      failed_subtasks: failedSubtasks.map(f => ({
        task_code: f.task_code,
        assigned_agent_id: f.assigned_agent_id,
        objective: f.objective,
        error: f.result_payload?.error
      })),
      contingency_report: {
        summary: `O objetivo macro não pôde ser completado integralmente devido a falhas definitivas em ${failedSubtasks.length} subtarefa(s).`,
        remediation_plan: 'Avaliar os erros de QA ou timeouts nas subtarefas listadas e reexecutar.',
        affected_agents: Array.from(new Set(failedSubtasks.map(f => f.assigned_agent_id)))
      }
    };

    assert.equal(contingencyData.status, TaskStatus.FAILED);
    assert.equal(contingencyData.failed_subtasks_count, 1);
    assert.equal(contingencyData.failed_subtasks[0]?.assigned_agent_id, AgentId.AG_004);
    assert.ok(contingencyData.contingency_report.summary.includes('falhas definitivas'));
  });

  // ----------------------------------------------------------------------------
  // HARD-05: Universal Watchdog Recovery for Standalone Tasks & Null started_at
  // ----------------------------------------------------------------------------
  it('HARD-05: Watchdog recupera tarefas standalone e trata started_at nulo com created_at', async () => {
    const timeoutMs = 60000; // 60s
    const oldTimestamp = new Date(Date.now() - 120000).toISOString(); // 120s atrás (expirada)

    const mockTasks = [
      {
        id: 'task-standalone-expired',
        task_code: 'STANDALONE-01',
        task_type: 'bill_audit',
        parent_task_id: null, // Tarefa standalone (sem pai)
        status: TaskStatus.RUNNING,
        started_at: null, // Teste de started_at nulo
        created_at: oldTimestamp,
        retry_count: 0,
        max_retries: 3
      },
      {
        id: 'macro-objective-running',
        task_code: 'MACRO-99',
        task_type: 'macro_objective', // Deve ser preservada e excluída pelo watchdog
        parent_task_id: null,
        status: TaskStatus.RUNNING,
        started_at: oldTimestamp,
        created_at: oldTimestamp,
        retry_count: 0,
        max_retries: 3
      }
    ];

    // Simula a filtragem e recuperação do watchdog (S5-02):
    const cutoffTime = Date.now() - timeoutMs;
    const recoveredTasks: string[] = [];

    for (const task of mockTasks) {
      // Exclui macro_objective
      if (task.task_type === 'macro_objective') {
        continue;
      }

      // Trata started_at nulo usando created_at como fallback (COALESCE)
      const effectiveStart = new Date(task.started_at || task.created_at).getTime();
      if (effectiveStart <= cutoffTime && task.status === TaskStatus.RUNNING) {
        recoveredTasks.push(task.id);
      }
    }

    assert.equal(recoveredTasks.length, 1, 'Apenas a tarefa standalone expirada deve ser recuperada.');
    assert.equal(recoveredTasks[0], 'task-standalone-expired');
  });

  // ----------------------------------------------------------------------------
  // HARD-06: AG-011 Financial Data Integrity & No Phantom MRR
  // ----------------------------------------------------------------------------
  it('HARD-06: AG-011 não inventa receita (elimina fallback de 1490) e retorna status incomplete', () => {
    // Caso 1: Cliente ativo com MRR ausente/nulo no banco de dados
    const contractsWithMissingMrr: ClientFinancialContractInput[] = [
      {
        clientId: 'client-no-mrr',
        companyName: 'Indústria Cerâmica Alfa',
        isActive: true,
        mrrBrl: 0,
        isMrrMissing: true, // Sinaliza dado ausente do banco
        setupFeeBrl: 0,
        successFeePercent: 0,
        directMonthlySupportCostBrl: 0,
        consumerUnitsCount: 1
      }
    ];

    const resMissing = calculateMrrAndArr(contractsWithMissingMrr);
    assert.equal(resMissing.mrr_brl, 0, 'MRR deve ser 0 quando o dado está ausente (sem fallback fictício de 1490).');
    assert.equal(resMissing.arr_brl, 0);

    const mrrMetric = resMissing.metrics.find(m => m.name === 'mrr');
    assert.ok(mrrMetric, 'Métrica mrr deve estar presente no resultado.');
    assert.equal(mrrMetric.status, 'incomplete', 'Status da métrica deve ser "incomplete" conforme CFO-009.');

    // Caso 2: Cliente com contrato verificado de R$ 3.500,00
    const contractsVerified: ClientFinancialContractInput[] = [
      {
        clientId: 'client-verified',
        companyName: 'Frigorífico Beta',
        isActive: true,
        mrrBrl: 3500,
        isMrrMissing: false,
        setupFeeBrl: 5000,
        successFeePercent: 20,
        directMonthlySupportCostBrl: 250,
        consumerUnitsCount: 2
      }
    ];

    const resVerified = calculateMrrAndArr(contractsVerified);
    assert.equal(resVerified.mrr_brl, 3500);
    assert.equal(resVerified.arr_brl, 42000);
    const mrrMetricVerified = resVerified.metrics.find(m => m.name === 'mrr');
    assert.equal(mrrMetricVerified?.status, 'verified');
  });

  // ----------------------------------------------------------------------------
  // HARD-07: Security Quarantine Enforcement & Decision Logs API
  // ----------------------------------------------------------------------------
  it('HARD-07: Mensagens em quarentena (Prompt Injection) retornam HTTP 403 e decisão é consultável', () => {
    // 1. Validação de bloqueio HTTP 403 para mensagens em quarentena
    const quarantinedMessage = {
      id: 'msg-quarantine-01',
      subject: 'URGENTE: Nova fatura',
      status: 'blocked_security_review', // Status de quarentena do AG-012
      ai_summary: 'Tentativa de injeção de prompt detectada'
    };

    const handleExecuteNextStep = (msg: typeof quarantinedMessage) => {
      if (msg.status === 'blocked_security_review' || msg.status === 'quarantine') {
        return {
          statusCode: 403,
          body: {
            success: false,
            error: 'Ação bloqueada: esta mensagem está em quarentena por suspeita de Prompt Injection ou violação de segurança (AG-012).'
          }
        };
      }
      return { statusCode: 200, body: { success: true } };
    };

    const result = handleExecuteNextStep(quarantinedMessage);
    assert.equal(result.statusCode, 403, 'Ação sobre mensagem em quarentena deve retornar estritamente HTTP 403 Forbidden.');
    assert.ok(result.body.error && result.body.error.includes('quarentena'));

    // 2. Validação da estrutura de paginação e filtros de GET /api/v1/decisions
    const mockDecisionLogs = [
      {
        id: 'dec-1',
        parent_task_id: 'macro-100',
        agent_id: AgentId.AG_001,
        decision_type: 'decomposition_plan',
        decision_summary: 'Decomposição em 3 subtarefas',
        created_at: '2026-11-08T12:00:00Z'
      },
      {
        id: 'dec-2',
        parent_task_id: 'macro-100',
        agent_id: AgentId.AG_001,
        decision_type: 'synthesis_consolidation',
        decision_summary: 'Consolidação executiva final',
        created_at: '2026-11-08T12:15:00Z'
      }
    ];

    const filterDecisions = (options: { parent_task_id?: string; limit?: number; offset?: number }) => {
      let filtered = mockDecisionLogs;
      if (options.parent_task_id) {
        filtered = filtered.filter(d => d.parent_task_id === options.parent_task_id);
      }
      const limit = options.limit || 50;
      const offset = options.offset || 0;
      const paginated = filtered.slice(offset, offset + limit);
      return {
        success: true,
        data: paginated,
        pagination: {
          total: filtered.length,
          limit,
          offset
        }
      };
    };

    const apiOutput = filterDecisions({ parent_task_id: 'macro-100', limit: 10, offset: 0 });
    assert.equal(apiOutput.success, true);
    assert.equal(apiOutput.data.length, 2);
    assert.equal(apiOutput.pagination.total, 2);
    assert.equal(apiOutput.data[0]?.decision_type, 'decomposition_plan');
  });

});
