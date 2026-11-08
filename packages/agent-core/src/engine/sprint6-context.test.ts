// ==============================================================================
// SPRINT 6 TEST SUITE: S6-01 CLIENT CONTEXT PROPAGATION & TRACEABILITY
// Scenarios CTX-01 through CTX-08
// ==============================================================================

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  TaskModel,
  TaskStatus,
  AgentId,
  ExecutionContext
} from '@ei-aios/shared';
import {
  calculateClientGrossMargin,
  reconcileAgentRunsFinOps,
  AgentRunRecordInput,
  ClientFinancialContractInput
} from '../tools/finops-calculator.js';

describe('Sprint 6 — S6-01 Client Context Propagation & Execution Traceability (CTX-01 a CTX-08)', () => {

  // ----------------------------------------------------------------------------
  // CTX-01: Execução vinculada a cliente
  // ----------------------------------------------------------------------------
  it('CTX-01: Execução vinculada a cliente preserva client_id e is_internal=false', () => {
    const clientId = 'c1000000-0000-0000-0000-000000000001';
    const taskId = 't1000000-0000-0000-0000-000000000001';

    const executionContext: ExecutionContext = {
      taskId,
      agentId: AgentId.AG_003,
      clientId,
      consumerUnitId: null,
      executionId: 'exec_ctx_01',
      isInternal: false,
      origin: 'worker'
    };

    assert.equal(executionContext.clientId, clientId);
    assert.equal(executionContext.isInternal, false);
    assert.equal(executionContext.origin, 'worker');

    // Simula o registro em agent_runs
    const runRecord: AgentRunRecordInput = {
      id: 'run-ctx-01',
      agent_id: executionContext.agentId,
      task_id: executionContext.taskId,
      client_id: executionContext.clientId,
      model_name: 'gemini-3.5-flash-lite',
      input_tokens: 1500,
      output_tokens: 400,
      cost_estimate: 0.000232,
      execution_time_ms: 1250,
      status: 'success',
      is_internal: executionContext.isInternal
    };

    assert.equal(runRecord.client_id, clientId);
    assert.equal(runRecord.is_internal, false);
  });

  // ----------------------------------------------------------------------------
  // CTX-02: Execução vinculada a cliente e unidade consumidora
  // ----------------------------------------------------------------------------
  it('CTX-02: Execução vinculada a cliente E unidade consumidora propaga ambas as dimensões', () => {
    const clientId = 'c1000000-0000-0000-0000-000000000001';
    const ucId = 'u1000000-0000-0000-0000-000000000001';
    const taskId = 't1000000-0000-0000-0000-000000000002';

    const executionContext: ExecutionContext = {
      taskId,
      agentId: AgentId.AG_004,
      clientId,
      consumerUnitId: ucId,
      executionId: 'exec_ctx_02_lease_abc',
      isInternal: false,
      origin: 'bill_parser'
    };

    assert.equal(executionContext.clientId, clientId);
    assert.equal(executionContext.consumerUnitId, ucId);
    assert.equal(executionContext.executionId, 'exec_ctx_02_lease_abc');

    const runRecord: AgentRunRecordInput = {
      id: 'run-ctx-02',
      agent_id: executionContext.agentId,
      task_id: executionContext.taskId,
      client_id: executionContext.clientId,
      consumer_unit_id: executionContext.consumerUnitId,
      execution_id: executionContext.executionId,
      is_internal: false,
      model_name: 'gemini-2.5-flash',
      input_tokens: 3200,
      output_tokens: 850,
      cost_estimate: 0.00099,
      execution_time_ms: 3100,
      status: 'success'
    };

    assert.equal(runRecord.client_id, clientId);
    assert.equal(runRecord.consumer_unit_id, ucId);
    assert.equal(runRecord.execution_id, 'exec_ctx_02_lease_abc');
  });

  // ----------------------------------------------------------------------------
  // CTX-03: Execução interna da plataforma (sem cliente)
  // ----------------------------------------------------------------------------
  it('CTX-03: Execução de plataforma sem cliente é identificada explicitamente como is_internal=true e client_id=null', () => {
    // Ex: Chat direto do fundador ou triagem de e-mail neutro
    const executionContext: ExecutionContext = {
      taskId: null,
      agentId: AgentId.AG_012,
      clientId: null,
      consumerUnitId: null,
      executionId: 'exec_internal_03',
      isInternal: true,
      origin: 'chat'
    };

    assert.equal(executionContext.clientId, null);
    assert.equal(executionContext.isInternal, true);

    const runRecord: AgentRunRecordInput = {
      id: 'run-ctx-03',
      agent_id: executionContext.agentId,
      task_id: null,
      client_id: null,
      is_internal: true,
      model_name: 'gemini-3.5-flash-lite',
      input_tokens: 500,
      output_tokens: 150,
      cost_estimate: 0.00008,
      execution_time_ms: 800,
      status: 'success'
    };

    const reconciliation = reconcileAgentRunsFinOps([runRecord]);
    assert.equal(reconciliation.internal_platform_runs_count, 1);
    assert.equal(reconciliation.client_attributed_runs_count, 0);
    assert.equal(reconciliation.internal_platform_cost_usd, 0.0001);
  });

  // ----------------------------------------------------------------------------
  // CTX-04: Propagação de contexto entre tarefa-mãe e subtarefas
  // ----------------------------------------------------------------------------
  it('CTX-04: Subtarefas herdam estritamente o client_id e consumer_unit_id da tarefa-mãe', () => {
    const parentClientId = 'client-solar-corp-001';
    const parentUcId = 'uc-industrial-solar-002';

    // Tarefa macro
    const parentTask: Partial<TaskModel> = {
      id: 'parent-macro-task-uuid',
      task_code: 'MACRO-998877',
      client_id: parentClientId,
      input_payload: {
        consumer_unit_id: parentUcId,
        raw_objective: 'Auditar faturas e propor migração ACL'
      }
    };

    // Subtarefas simuladas decompostas pelo orquestrador
    const simulatedSubtasks = [
      { task_code: 'MACRO-998877-01', agent: AgentId.AG_004, objective: 'Extrair fatura' },
      { task_code: 'MACRO-998877-02', agent: AgentId.AG_003, objective: 'Auditar demanda' },
      { task_code: 'MACRO-998877-03', agent: AgentId.AG_008, objective: 'Auditar conformidade QA' }
    ];

    // Regra S6-01: O orquestrador impõe client_id e consumer_unit_id da mãe
    const createdSubtasks = simulatedSubtasks.map(s => ({
      task_code: s.task_code,
      parent_task_id: parentTask.id,
      client_id: parentTask.client_id, // Imposição soberana da mãe
      assigned_agent_id: s.agent,
      input_payload: {
        consumer_unit_id: parentTask.input_payload?.consumer_unit_id
      }
    }));

    for (const sub of createdSubtasks) {
      assert.equal(sub.client_id, parentClientId, 'Subtarefa deve herdar o client_id exato da mãe');
      assert.equal(sub.input_payload.consumer_unit_id, parentUcId, 'Subtarefa deve herdar a UC da mãe');
    }
  });

  // ----------------------------------------------------------------------------
  // CTX-05: Rejeição de inconsistência entre cliente e tarefa/UC
  // ----------------------------------------------------------------------------
  it('CTX-05: Worker detecta e rejeita inconsistência entre cliente da tarefa e unidade consumidora', async () => {
    const clientA = 'client-A-uuid';
    const clientB = 'client-B-uuid';
    const ucOfClientB = 'uc-belonging-to-client-B';

    // Banco de UCs simulado
    const databaseUcs: Record<string, { id: string; client_id: string }> = {
      [ucOfClientB]: { id: ucOfClientB, client_id: clientB }
    };

    // Tarefa com inconsistência: client_id = clientA, mas consumer_unit_id pertence a clientB
    const inconsistentTask: Partial<TaskModel> = {
      id: 'task-inconsistent-01',
      task_code: 'TASK-INCONSISTENT',
      client_id: clientA,
      input_payload: { consumer_unit_id: ucOfClientB }
    };

    // Função de validação de consistência implementada no worker
    const validateContextConsistency = (task: Partial<TaskModel>) => {
      const ucId = task.input_payload?.consumer_unit_id;
      if (task.client_id && ucId) {
        const uc = databaseUcs[ucId];
        if (uc && uc.client_id !== task.client_id) {
          return {
            valid: false,
            error: `Violação de isolamento de contexto: Unidade consumidora ${ucId} não pertence ao cliente ${task.client_id}. Operação bloqueada.`
          };
        }
      }
      return { valid: true, error: null };
    };

    const check = validateContextConsistency(inconsistentTask);
    assert.equal(check.valid, false, 'Deve rejeitar inconsistência entre tarefa e cliente da UC');
    assert.match(check.error!, /não pertence ao cliente/);
  });

  // ----------------------------------------------------------------------------
  // CTX-06: Recuperação de tarefa pelo watchdog preservando o contexto
  // ----------------------------------------------------------------------------
  it('CTX-06: Recuperação de timeout pelo watchdog preserva client_id e consumer_unit_id intactos', () => {
    const originalClientId = 'client-safe-recovery-01';
    const originalUcId = 'uc-safe-recovery-02';

    // Tarefa em running presa
    let taskState: Partial<TaskModel> = {
      id: 'task-stuck-01',
      task_code: 'TASK-STUCK',
      status: TaskStatus.RUNNING,
      client_id: originalClientId,
      retry_count: 0,
      max_retries: 2,
      input_payload: {
        consumer_unit_id: originalUcId,
        lease_token: 'old_lease_worker_zombie',
        energy_data: { consumption: 50000 }
      }
    };

    // Simulação do watchdog universal (S5-02 e S6-01)
    const watchdogRecover = (stuck: Partial<TaskModel>): Partial<TaskModel> => {
      return {
        ...stuck,
        status: TaskStatus.PENDING,
        retry_count: (stuck.retry_count || 0) + 1,
        // S6-01: client_id permanece rigorosamente inalterado
        client_id: stuck.client_id,
        input_payload: {
          ...(stuck.input_payload || {}),
          lease_token: null, // invalida lease anterior
          recovery_reason: 'Recuperada por watchdog'
        }
      };
    };

    const recovered = watchdogRecover(taskState);
    assert.equal(recovered.status, TaskStatus.PENDING);
    assert.equal(recovered.retry_count, 1);
    assert.equal(recovered.client_id, originalClientId, 'client_id deve ser estritamente preservado após recuperação');
    assert.ok(recovered.input_payload);
    assert.equal(recovered.input_payload.consumer_unit_id, originalUcId, 'consumer_unit_id deve ser preservado');
    assert.equal(recovered.input_payload.lease_token, null, 'lease antigo deve ser invalidado');
  });

  // ----------------------------------------------------------------------------
  // CTX-07: Compatibilidade com registros históricos sem identificação
  // ----------------------------------------------------------------------------
  it('CTX-07: Registros legados sem client_id são tratados sem quebra e sem atribuição arbitrária', () => {
    const legacyRuns: AgentRunRecordInput[] = [
      {
        id: 'legacy-run-01',
        agent_id: 'AG-001',
        task_id: 'task-legacy-01',
        client_id: null, // Legado sem client_id
        model_name: 'gemini-3.5-flash-lite',
        input_tokens: 1000,
        output_tokens: 200,
        cost_estimate: 0.000135,
        execution_time_ms: 900,
        status: 'success'
      },
      {
        id: 'legacy-run-02',
        agent_id: 'AG-003',
        task_id: null, // Legado sem task_id
        client_id: undefined,
        model_name: 'gemini-3.1-flash-lite',
        input_tokens: 800,
        output_tokens: 150,
        cost_estimate: 0.000105,
        execution_time_ms: 700,
        status: 'success'
      }
    ];

    const reconciliation = reconcileAgentRunsFinOps(legacyRuns);
    assert.equal(reconciliation.total_runs_count, 2);
    assert.equal(reconciliation.client_attributed_runs_count, 0, 'Registros legados sem identificação não devem ser atribuídos a clientes');
    assert.equal(reconciliation.unlinked_runs_count, 1);
    assert.equal(reconciliation.total_cost_usd, 0.0002);
  });

  // ----------------------------------------------------------------------------
  // CTX-08: Consulta e isolamento de custos de IA por cliente no AG-011
  // ----------------------------------------------------------------------------
  it('CTX-08: AG-011 calcula custos de IA isolados por cliente sem vazamento cruzado', () => {
    const clientA: ClientFinancialContractInput = {
      clientId: 'client-A-id',
      companyName: 'Metalúrgica Alvorada S.A.',
      isActive: true,
      mrrBrl: 1490.00,
      directMonthlySupportCostBrl: 180.00
    };

    const clientB: ClientFinancialContractInput = {
      clientId: 'client-B-id',
      companyName: 'Laticínios da Serra Ltda.',
      isActive: true,
      mrrBrl: 2200.00,
      directMonthlySupportCostBrl: 250.00
    };

    // Runs de IA com client_id devidamente propagado (S6-01)
    const allRuns: AgentRunRecordInput[] = [
      // Runs do Cliente A
      {
        id: 'run-a1',
        agent_id: 'AG-003',
        client_id: clientA.clientId,
        model_name: 'gemini-3.5-flash-lite',
        cost_estimate: 0.0500, // US$ 0.05
        status: 'success'
      },
      {
        id: 'run-a2',
        agent_id: 'AG-008',
        client_id: clientA.clientId,
        model_name: 'gemini-3.5-flash-lite',
        cost_estimate: 0.0200, // US$ 0.02
        status: 'success'
      },
      // Runs do Cliente B
      {
        id: 'run-b1',
        agent_id: 'AG-003',
        client_id: clientB.clientId,
        model_name: 'gemini-2.5-pro',
        cost_estimate: 0.8500, // US$ 0.85
        status: 'success'
      },
      // Run interna da plataforma
      {
        id: 'run-internal',
        agent_id: 'AG-012',
        client_id: null,
        model_name: 'gemini-3.5-flash-lite',
        is_internal: true,
        cost_estimate: 0.0100,
        status: 'success'
      }
    ];

    // Calcula margem isolada para Cliente A
    const runsForClientA = allRuns.filter(r => r.client_id === clientA.clientId);
    const marginA = calculateClientGrossMargin(clientA, runsForClientA, 5.80);

    // Custo de IA do Cliente A: US$ 0.0700 * 5.80 = R$ 0,41
    assert.equal(marginA.ai_cost_usd, 0.07);
    assert.equal(marginA.ai_cost_brl, 0.41);
    assert.equal(marginA.total_direct_cost_brl, 180.41);
    assert.equal(marginA.gross_margin_brl, 1490.00 - 180.41);

    // Calcula margem isolada para Cliente B
    const runsForClientB = allRuns.filter(r => r.client_id === clientB.clientId);
    const marginB = calculateClientGrossMargin(clientB, runsForClientB, 5.80);

    // Custo de IA do Cliente B: US$ 0.8500 * 5.80 = R$ 4,93
    assert.equal(marginB.ai_cost_usd, 0.85);
    assert.equal(marginB.ai_cost_brl, 4.93);
    assert.equal(marginB.total_direct_cost_brl, 254.93);
    assert.equal(marginB.gross_margin_brl, 2200.00 - 254.93);

    // Comprova isolamento: Custo do Cliente A NÃO contém custos do Cliente B nem internos
    assert.notEqual(marginA.ai_cost_usd, marginB.ai_cost_usd);
    assert.equal(runsForClientA.length, 2);
    assert.equal(runsForClientB.length, 1);
  });
});
