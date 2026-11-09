// ==============================================================================
// SPRINT 6 TEST SUITE: S6-02 AGENT RUNS COST RECONCILIATION & LEDGER ENGINE
// Scenarios LEDGER-01 through LEDGER-12
// ==============================================================================

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  FinopsLedgerEngine,
  DEFAULT_MODEL_PRICING_MATRIX_V2026_11
} from '../tools/finops-ledger-engine.js';
import { AgentRunRecordInput } from '../tools/finops-calculator.js';
import { ModelPricingMatrix } from '@ei-aios/shared';

describe('Sprint 6 — S6-02 Agent Runs Cost Reconciliation & Ledger Engine (LEDGER-01 a LEDGER-12)', () => {

  // ----------------------------------------------------------------------------
  // LEDGER-01: Conciliação de execução vinculada a cliente
  // ----------------------------------------------------------------------------
  it('LEDGER-01: Conciliação de execução vinculada a cliente calcula custos exatos e atribui categoria correta', () => {
    const engine = new FinopsLedgerEngine();
    const clientId = 'c1000000-0000-0000-0000-000000000001';
    const run: AgentRunRecordInput = {
      id: 'run-client-01',
      agent_id: 'AG-003',
      task_id: 'task-01',
      client_id: clientId,
      consumer_unit_id: 'uc-01',
      execution_id: 'lease-token-123',
      model_name: 'gemini-3.5-flash-lite',
      input_tokens: 10_000,
      output_tokens: 2_000,
      cost_estimate: 0.00135,
      status: 'success',
      created_at: '2026-11-08T10:00:00.000Z'
    };

    const summary = engine.reconcileRuns([run], { usdToBrlRate: 5.80 });
    const entry = engine.getEntryByRunId('run-client-01');

    assert.ok(entry, 'Entrada deve existir no ledger');
    assert.equal(entry.category, 'client_attributable');
    assert.equal(entry.client_id, clientId);
    assert.equal(entry.consumer_unit_id, 'uc-01');
    assert.equal(entry.execution_id, 'lease-token-123');
    assert.equal(entry.reliability_tier, 'estimated');

    // Cálculo exato: (10.000 / 1.000.000) * 0.075 + (2.000 / 1.000.000) * 0.30
    // = 0.00075 + 0.00060 = 0.00135 USD
    assert.equal(entry.cost_usd, 0.00135);
    // BRL: 0.00135 * 5.80 = 0.00783 BRL
    assert.equal(entry.cost_brl, 0.0078);
    assert.equal(summary.by_category.client_attributable.count, 1);
    assert.equal(summary.by_category.client_attributable.cost_usd, 0.0014);
  });

  // ----------------------------------------------------------------------------
  // LEDGER-02: Conciliação de execução interna da plataforma
  // ----------------------------------------------------------------------------
  it('LEDGER-02: Conciliação de execução interna da plataforma segrega custo sem afetar clientes', () => {
    const engine = new FinopsLedgerEngine();
    const run: AgentRunRecordInput = {
      id: 'run-internal-01',
      agent_id: 'AG-012',
      task_id: null,
      client_id: null,
      is_internal: true,
      model_name: 'gemini-3.8-flash',
      input_tokens: 20_000,
      output_tokens: 5_000,
      status: 'success'
    };

    const summary = engine.reconcileRuns([run], { usdToBrlRate: 5.80 });
    const entry = engine.getEntryByRunId('run-internal-01');

    assert.ok(entry);
    assert.equal(entry.category, 'platform_internal');
    assert.equal(entry.client_id, null);
    assert.equal(entry.reliability_tier, 'estimated');

    // gemini-3.8-flash: input 0.15 / 1M, output 0.60 / 1M
    // (20.000 / 1M)*0.15 + (5.000 / 1M)*0.60 = 0.003 + 0.003 = 0.006 USD
    assert.equal(entry.cost_usd, 0.006);
    assert.equal(summary.by_category.platform_internal.count, 1);
    assert.equal(summary.by_category.client_attributable.count, 0);
    assert.equal(Object.keys(summary.by_client).length, 0, 'Nenhum cliente deve receber o custo interno');
  });

  // ----------------------------------------------------------------------------
  // LEDGER-03: Separação de custos entre dois clientes
  // ----------------------------------------------------------------------------
  it('LEDGER-03: Separação rigorosa de custos entre múltiplos clientes sem contaminação cruzada', () => {
    const engine = new FinopsLedgerEngine();
    const clientA = 'client-A-uuid';
    const clientB = 'client-B-uuid';

    const runs: AgentRunRecordInput[] = [
      {
        id: 'run-a1',
        agent_id: 'AG-003',
        client_id: clientA,
        model_name: 'gemini-3.5-flash-lite',
        input_tokens: 100_000, // $0.0075
        output_tokens: 10_000,  // $0.0030 -> total $0.0105
        status: 'success'
      },
      {
        id: 'run-a2',
        agent_id: 'AG-008',
        client_id: clientA,
        model_name: 'gemini-3.8-flash',
        input_tokens: 50_000,  // $0.0075
        output_tokens: 5_000,   // $0.0030 -> total $0.0105
        status: 'success'
      },
      {
        id: 'run-b1',
        agent_id: 'AG-004',
        client_id: clientB,
        model_name: 'gemini-4-argon',
        input_tokens: 10_000,  // $0.0125
        output_tokens: 2_000,   // $0.0100 -> total $0.0225
        status: 'success'
      }
    ];

    engine.reconcileRuns(runs);

    const costA = engine.getClientCostSummary(clientA);
    const costB = engine.getClientCostSummary(clientB);

    assert.equal(costA.totalRuns, 2);
    assert.equal(costA.costUsd, 0.021); // 0.0105 + 0.0105
    assert.equal(costA.totalTokensIn, 150_000);
    assert.equal(costA.totalTokensOut, 15_000);

    assert.equal(costB.totalRuns, 1);
    assert.equal(costB.costUsd, 0.0225);
    assert.equal(costB.totalTokensIn, 10_000);
    assert.equal(costB.totalTokensOut, 2_000);

    // Soma isolada não interfere no outro cliente
    assert.notEqual(costA.costUsd, costB.costUsd);
  });

  // ----------------------------------------------------------------------------
  // LEDGER-04: Registro histórico sem client_id
  // ----------------------------------------------------------------------------
  it('LEDGER-04: Registros legados sem client_id são classificados como unattributed_legacy sem atribuição espúria', () => {
    const engine = new FinopsLedgerEngine();
    const legacyRun: AgentRunRecordInput = {
      id: 'legacy-run-99',
      agent_id: 'AG-001',
      task_id: null,
      client_id: null,
      // is_internal indefinido (legado)
      model_name: 'gemini-3.5-flash-lite',
      input_tokens: 5_000,
      output_tokens: 1_000,
      status: 'success'
    };

    const summary = engine.reconcileRuns([legacyRun]);
    const entry = engine.getEntryByRunId('legacy-run-99');

    assert.ok(entry);
    assert.equal(entry.category, 'unattributed_legacy');
    assert.equal(entry.reliability_tier, 'unattributed');
    assert.equal(summary.by_category.unattributed_legacy.count, 1);
    assert.equal(summary.by_category.client_attributable.count, 0);
  });

  // ----------------------------------------------------------------------------
  // LEDGER-05: Modelo sem preço cadastrado
  // ----------------------------------------------------------------------------
  it('LEDGER-05: Modelo sem preço cadastrado não inventa valor e é marcado como incomplete', () => {
    const engine = new FinopsLedgerEngine();
    const unknownRun: AgentRunRecordInput = {
      id: 'run-unknown-model',
      agent_id: 'AG-003',
      client_id: 'client-123',
      model_name: 'custom-unregistered-model-v99',
      input_tokens: 10_000,
      output_tokens: 5_000,
      status: 'success'
    };

    const summary = engine.reconcileRuns([unknownRun]);
    const entry = engine.getEntryByRunId('run-unknown-model');

    assert.ok(entry);
    assert.equal(entry.reliability_tier, 'incomplete');
    assert.equal(entry.cost_usd, null, 'Custo USD deve ser nulo para modelos sem preço oficial');
    assert.equal(entry.cost_brl, null);
    assert.ok(entry.divergence_notes?.includes('não possui precificação'));
    assert.equal(summary.by_reliability_tier.incomplete, 1);
  });

  // ----------------------------------------------------------------------------
  // LEDGER-06: Execução sem tokens registrados
  // ----------------------------------------------------------------------------
  it('LEDGER-06: Execução sem tokens registrados é identificada como incomplete e não é tratada como gratuita', () => {
    const engine = new FinopsLedgerEngine();
    const zeroTokenRun: AgentRunRecordInput = {
      id: 'run-missing-tokens',
      agent_id: 'AG-002',
      client_id: 'client-123',
      model_name: 'gemini-3.5-flash-lite',
      input_tokens: null, // Ausente
      output_tokens: undefined, // Ausente
      status: 'failed'
    };

    engine.reconcileRuns([zeroTokenRun]);
    const entry = engine.getEntryByRunId('run-missing-tokens');

    assert.ok(entry);
    assert.equal(entry.reliability_tier, 'incomplete');
    assert.equal(entry.cost_usd, null);
    assert.ok(entry.divergence_notes?.includes('Tokens de entrada ou saída não registrados'));
  });

  // ----------------------------------------------------------------------------
  // LEDGER-07: Reprocessamento sem duplicidade (Idempotência)
  // ----------------------------------------------------------------------------
  it('LEDGER-07: Reexecução da conciliação é estritamente idempotente e não duplica entradas', () => {
    const engine = new FinopsLedgerEngine();
    const runs: AgentRunRecordInput[] = Array.from({ length: 15 }, (_, i) => ({
      id: `idemp-run-${i}`,
      agent_id: 'AG-003',
      client_id: 'client-xyz',
      model_name: 'gemini-3.5-flash-lite',
      input_tokens: 1_000,
      output_tokens: 500,
      status: 'success'
    }));

    // Primeira execução
    const firstPass = engine.reconcileRuns(runs);
    assert.equal(firstPass.new_entries_count, 15);
    assert.equal(firstPass.skipped_duplicate_count, 0);
    assert.equal(engine.getAllEntries().length, 15);

    // Segunda execução com os mesmos dados
    const secondPass = engine.reconcileRuns(runs);
    assert.equal(secondPass.new_entries_count, 0, 'Nenhum novo registro deve ser inserido');
    assert.equal(secondPass.skipped_duplicate_count, 15, 'Todos os registros devem ser ignorados por duplicidade');
    assert.equal(engine.getAllEntries().length, 15, 'Total de registros deve permanecer 15');

    // Terceira execução com permissão de reprocessamento auditado
    const thirdPass = engine.reconcileRuns(runs, { allowReprocess: true });
    assert.equal(thirdPass.reprocessed_entries_count, 15);
    const all = engine.getAllEntries();
    assert.equal(all.length, 15, 'Total permanece 15 sem duplicação de linhas');
    assert.ok(all[0]);
    assert.equal(all[0].is_reprocessed, true);
  });

  // ----------------------------------------------------------------------------
  // LEDGER-08: Alteração de tabela de preços sem modificar conciliações históricas
  // ----------------------------------------------------------------------------
  it('LEDGER-08: Alteração da tabela de preços não altera conciliações históricas já registradas', () => {
    const engine = new FinopsLedgerEngine();
    const runOld: AgentRunRecordInput = {
      id: 'run-historical',
      agent_id: 'AG-003',
      client_id: 'client-abc',
      model_name: 'gemini-3.5-flash-lite',
      input_tokens: 1_000_000,
      output_tokens: 1_000_000,
      status: 'success'
    };

    // Concilia com tabela v2026.11 (input 0.075, output 0.30 -> total 0.375 USD)
    engine.reconcileRuns([runOld], { pricingMatrix: DEFAULT_MODEL_PRICING_MATRIX_V2026_11 });
    const oldEntry = engine.getEntryByRunId('run-historical')!;
    assert.equal(oldEntry.cost_usd, 0.375);
    assert.equal(oldEntry.pricing_version, 'v2026.11');

    // Nova tabela de preços hipotética futura com aumento de 100%
    const futureMatrix: ModelPricingMatrix = {
      versionId: 'v2027.01',
      name: 'Tabela Futura v2027.01',
      effectiveDate: '2027-01-01T00:00:00.000Z',
      models: {
        'gemini-3.5-flash-lite': { inputUsdPerMillion: 0.15, outputUsdPerMillion: 0.60, currency: 'USD' }
      }
    };

    const runNew: AgentRunRecordInput = {
      id: 'run-new-period',
      agent_id: 'AG-003',
      client_id: 'client-abc',
      model_name: 'gemini-3.5-flash-lite',
      input_tokens: 1_000_000,
      output_tokens: 1_000_000,
      status: 'success'
    };

    // Concilia novo run com a tabela nova
    engine.reconcileRuns([runNew], { pricingMatrix: futureMatrix });
    const newEntry = engine.getEntryByRunId('run-new-period')!;

    // O novo run custa 0.75 USD na nova matriz
    assert.equal(newEntry.cost_usd, 0.75);
    assert.equal(newEntry.pricing_version, 'v2027.01');

    // O run histórico NÃO teve seu valor ou versão alterados
    const oldEntryRechecked = engine.getEntryByRunId('run-historical')!;
    assert.equal(oldEntryRechecked.cost_usd, 0.375, 'Lançamento histórico deve ser imutável');
    assert.equal(oldEntryRechecked.pricing_version, 'v2026.11');
  });

  // ----------------------------------------------------------------------------
  // LEDGER-09: Execução concorrente da rotina de conciliação
  // ----------------------------------------------------------------------------
  it('LEDGER-09: Execuções concorrentes simultâneas mantêm integridade e evitam registros duplicados', async () => {
    const engine = new FinopsLedgerEngine();
    const concurrentRuns: AgentRunRecordInput[] = Array.from({ length: 20 }, (_, i) => ({
      id: `concurrent-run-${i}`,
      agent_id: 'AG-003',
      client_id: 'client-conc',
      model_name: 'gemini-3.8-flash',
      input_tokens: 5_000,
      output_tokens: 1_000,
      status: 'success'
    }));

    // Dispara 3 workers simultâneos tentando reconciliar os mesmos dados
    await Promise.all([
      Promise.resolve().then(() => engine.reconcileRuns(concurrentRuns)),
      Promise.resolve().then(() => engine.reconcileRuns(concurrentRuns)),
      Promise.resolve().then(() => engine.reconcileRuns(concurrentRuns))
    ]);

    // O total no ledger deve ser exatamente 20, sem duplicações
    assert.equal(engine.getAllEntries().length, 20, 'Não deve haver entradas duplicadas após chamadas concorrentes');
  });

  // ----------------------------------------------------------------------------
  // LEDGER-10: Isolamento multi-tenant
  // ----------------------------------------------------------------------------
  it('LEDGER-10: getClientCostSummary garante isolamento e zero vazamento entre contas de clientes', () => {
    const engine = new FinopsLedgerEngine();
    const tenant1 = 'tenant-1111';
    const tenant2 = 'tenant-2222';

    engine.reconcileRuns([
      {
        id: 'run-t1',
        agent_id: 'AG-003',
        client_id: tenant1,
        model_name: 'gemini-3.5-flash-lite',
        input_tokens: 10_000,
        output_tokens: 2_000,
        status: 'success'
      },
      {
        id: 'run-t2',
        agent_id: 'AG-004',
        client_id: tenant2,
        model_name: 'gemini-3.5-flash-lite',
        input_tokens: 50_000,
        output_tokens: 10_000,
        status: 'success'
      }
    ]);

    const sum1 = engine.getClientCostSummary(tenant1);
    const sum2 = engine.getClientCostSummary(tenant2);
    const sumNonExistent = engine.getClientCostSummary('non-existent-tenant');

    assert.equal(sum1.totalRuns, 1);
    assert.equal(sum1.totalTokensIn, 10_000);
    assert.equal(sum2.totalRuns, 1);
    assert.equal(sum2.totalTokensIn, 50_000);
    assert.equal(sumNonExistent.totalRuns, 0);
    assert.equal(sumNonExistent.costUsd, 0);
  });

  // ----------------------------------------------------------------------------
  // LEDGER-11: Consistência entre agent_runs e ledger
  // ----------------------------------------------------------------------------
  it('LEDGER-11: Consistência de tokens bate 1:1 e divergências de estimativa são registradas para auditoria', () => {
    const engine = new FinopsLedgerEngine();
    // Execução onde a estimativa gravada no passado divergiu da tabela recalculada
    const runDivergent: AgentRunRecordInput = {
      id: 'run-divergent-01',
      agent_id: 'AG-003',
      client_id: 'client-audit',
      model_name: 'gemini-3.5-flash-lite',
      input_tokens: 1_000_000, // $0.075
      output_tokens: 1_000_000, // $0.30 -> Recalculado: $0.375
      cost_estimate: 0.10000, // Original gravado divergente (US$ 0.10)
      status: 'success'
    };

    engine.reconcileRuns([runDivergent]);
    const entry = engine.getEntryByRunId('run-divergent-01')!;

    assert.ok(entry);
    assert.equal(entry.cost_usd, 0.375);
    assert.ok(entry.divergence_notes, 'Deve registrar nota de divergência para auditoria');
    assert.match(entry.divergence_notes, /Divergência detectada/);
    assert.match(entry.divergence_notes, /cost_estimate original era US\$ 0.100000/);
  });

  // ----------------------------------------------------------------------------
  // LEDGER-12: Tratamento de falhas e recuperação
  // ----------------------------------------------------------------------------
  it('LEDGER-12: Lote com itens malformados ou corrompidos é processado com resiliência sem quebrar o lote', () => {
    const engine = new FinopsLedgerEngine();
    const mixedBatch: any[] = [
      // Válido
      {
        id: 'valid-01',
        agent_id: 'AG-003',
        client_id: 'client-ok',
        model_name: 'gemini-3.5-flash-lite',
        input_tokens: 10_000,
        output_tokens: 2_000,
        status: 'success'
      },
      // Sem ID (deve ser ignorado sem exception)
      {
        agent_id: 'AG-001',
        model_name: 'gemini-3.5-flash-lite'
      },
      // Tokens negativos/corrompidos
      {
        id: 'corrupted-02',
        agent_id: 'AG-003',
        client_id: 'client-ok',
        model_name: 'gemini-3.5-flash-lite',
        input_tokens: -500,
        output_tokens: 'corrupted_string',
        status: 'error'
      }
    ];

    const summary = engine.reconcileRuns(mixedBatch);
    assert.equal(summary.new_entries_count, 2, 'Deve ter processado as 2 entradas com ID');
    
    const corruptedEntry = engine.getEntryByRunId('corrupted-02')!;
    assert.equal(corruptedEntry.reliability_tier, 'incomplete');
    assert.equal(corruptedEntry.cost_usd, null);

    const validEntry = engine.getEntryByRunId('valid-01')!;
    assert.equal(validEntry.reliability_tier, 'estimated');
    assert.ok(validEntry.cost_usd! > 0);
  });

});
