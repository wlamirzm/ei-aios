// ==============================================================================
// SPRINT 6 — S6-06: E2E FINANCIAL RECONCILIATION TESTING & AUDIT SUITE
// Validação Ponta a Ponta: Cliente -> UC -> Fatura -> IA Costs -> Contratos ->
// Faturamento -> Recebimento -> Margem -> CAC -> LTV -> Payback -> Dashboard
// ==============================================================================

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  FinopsLedgerEngine,
  RevenuePipelineEngine,
  UnitEconomicsEngine,
  ObservabilityDashboardService,
  AgentRunRecordInput,
  MVValidationReportInput
} from '../tools/finops-calculator.js';
import {
  ClientContractModel,
  AcquisitionExpenseModel,
  CustomerAcquisitionEvent
} from '@ei-aios/shared';

describe('Sprint 6 — S6-06 E2E Financial Reconciliation & Audit Suite (E2E-01 a E2E-06)', () => {

  // ----------------------------------------------------------------------------
  // E2E-01: Ciclo Financeiro Completo (Happy Path)
  // ----------------------------------------------------------------------------
  it('E2E-01: Ciclo Financeiro Completo (Cliente -> UC -> IA Run -> Contrato -> Fatura -> Recebimento -> Margem -> CAC/LTV -> Dashboard)', () => {
    const tenantId = 'tenant-e2e-energia-sa';
    const clientId = 'client-e2e-alpha-industrias';
    const ucId = 'uc-e2e-alpha-001';
    const competence = '2026-11';

    // 1. Instanciação dos Motores Especialistas
    const ledgerEngine = new FinopsLedgerEngine();
    const revenueEngine = new RevenuePipelineEngine();
    const unitEconEngine = new UnitEconomicsEngine();
    const dashboardService = new ObservabilityDashboardService({
      ledgerEngine,
      revenueEngine,
      unitEconomicsEngine: unitEconEngine
    });

    // 2. Simulação de Execuções de IA (AG-003 Auditoria e AG-004 M&V sobre Fatura de Energia)
    const run1: AgentRunRecordInput = {
      id: 'run-e2e-001',
      agent_id: 'AG-003',
      task_id: 'task-e2e-audit-01',
      client_id: clientId,
      consumer_unit_id: ucId,
      execution_id: 'exec-e2e-01',
      model_name: 'gemini-3.8-flash',
      input_tokens: 100_000, // 100k in = $0.0150
      output_tokens: 50_000, // 50k out = $0.0300 -> Total US$ 0.0450
      execution_time_ms: 1850,
      status: 'success',
      created_at: '2026-11-05T10:00:00.000Z'
    };

    const run2: AgentRunRecordInput = {
      id: 'run-e2e-002',
      agent_id: 'AG-004',
      task_id: 'task-e2e-mv-01',
      client_id: clientId,
      consumer_unit_id: ucId,
      execution_id: 'exec-e2e-02',
      model_name: 'gemini-3.5-flash-lite',
      input_tokens: 80_000, // 80k in = $0.0060 (80k / 1M * 0.075)
      output_tokens: 40_000, // 40k out = $0.0120 (40k / 1M * 0.300) -> Total US$ 0.0180
      execution_time_ms: 1200,
      status: 'success',
      created_at: '2026-11-05T10:05:00.000Z'
    };

    ledgerEngine.reconcileRuns([run1, run2], { usdToBrlRate: 5.80 });

    const entry1 = ledgerEngine.getEntryByRunId('run-e2e-001');
    const entry2 = ledgerEngine.getEntryByRunId('run-e2e-002');

    assert.ok(entry1);
    assert.ok(entry2);
    assert.equal(entry1.category, 'client_attributable');
    assert.equal(entry2.category, 'client_attributable');
    assert.equal(entry1.cost_usd, 0.0450);
    assert.equal(entry2.cost_usd, 0.0180);

    const clientAiCost = ledgerEngine.getClientCostSummary(clientId);
    assert.equal(clientAiCost.costUsd, 0.0630);
    assert.equal(clientAiCost.totalRuns, 2);

    // 3. Contrato Formalizado
    const contract: ClientContractModel = {
      id: 'contract-e2e-01',
      client_id: clientId,
      contract_number: 'CTR-E2E-2026-001',
      start_date: '2026-01-01',
      end_date: '2026-12-31',
      monthly_recurring_value_brl: 4000.00,
      has_success_fee: true,
      success_fee_percent: 20.0,
      success_fee_clause: 'Cláusula 7.1: 20% sobre economia real apurada pelo AG-004',
      adjustment_index: 'IPCA',
      adjustment_periodicity_months: 12,
      status: 'active',
      created_at: '2026-01-01T00:00:00.000Z'
    };
    revenueEngine.registerContract(contract);

    // 4. Apuração de Economia M&V (AG-004) e Cobrança de Success Fee com HITL
    const mvReport: MVValidationReportInput = {
      id: 'mv-rep-e2e-001',
      competence,
      clientId,
      verifiedSavingsBrl: 10000.00,
      isVerifiedByAG004: true
    };
    const sfEvent = revenueEngine.registerSuccessFeeEvent(contract, mvReport);
    assert.equal(sfEvent.status, 'pending_approval');
    assert.equal(sfEvent.eligible_amount_brl, 2000.00); // 20% de R$ 10.000

    // Aprovação Humana Formal (HITL)
    revenueEngine.approveSuccessFee(sfEvent.id, 'founder@atendezen.com.br');

    // 5. Emissão de Faturas (Fatura com MRR R$ 4.000,00 + Success Fee R$ 2.000,00 = R$ 6.000,00)
    const invoice = revenueEngine.generateMonthlyInvoice(contract.id, competence, sfEvent.id);
    assert.equal(invoice.total_amount_brl, 6000.00);
    assert.equal(invoice.recurring_amount_brl, 4000.00);
    assert.equal(invoice.success_fee_amount_brl, 2000.00);

    // 6. Liquidação de Pagamento Parcial (Recebeu R$ 5.000,00 de R$ 6.000,00 faturados)
    const { receiptRecord } = revenueEngine.registerReceipt(invoice.id, {
      amount: 5000.00,
      date: '2026-11-12',
      transactionReference: 'PIX-E2E-PARTIAL-5000'
    });
    assert.equal(receiptRecord.is_partial, true);
    assert.equal(receiptRecord.balance_remaining_brl, 1000.00);

    // 7. Relatório de Margem de Contribuição por Cliente
    const marginRep = revenueEngine.generateClientMarginReport(
      clientId,
      competence,
      clientAiCost,
      100.00 // Custo direto de suporte/operação em BRL
    );

    assert.equal(marginRep.contracted_mrr_brl, 4000.00);
    assert.equal(marginRep.invoiced_mrr_brl, 4000.00);
    assert.equal(marginRep.invoiced_success_fee_brl, 2000.00);
    assert.equal(marginRep.total_invoiced_brl, 6000.00);
    // Rateio proporcional do pagamento parcial de R$ 5.000 (4/6 MRR e 2/6 Success Fee)
    assert.equal(marginRep.received_mrr_brl, 3333.33);
    assert.equal(marginRep.received_success_fee_brl, 1666.67);
    assert.equal(marginRep.total_received_brl, 5000.00);

    // Custo Total Direto = R$ 100,00 suporte + R$ 0,37 de IA (US$ 0.063 * 5.80 = 0.3654 ~ 0.37)
    assert.equal(marginRep.ai_cost_brl, 0.37);
    assert.equal(marginRep.total_direct_costs_brl, 100.37);
    assert.equal(marginRep.margin_on_invoiced_brl, 5899.63); // 6000 - 100.37
    assert.equal(marginRep.margin_on_received_brl, 4899.63); // 5000 - 100.37

    // 8. Ingestão de Despesas de Aquisição e Cadastro de Cliente em Unit Economics
    const acqExp: AcquisitionExpenseModel = {
      id: 'acq-e2e-google-ads',
      tenant_id: tenantId,
      category: 'MARKETING',
      description: 'Campanha Google Ads B2B Energia',
      amount_brl: 8000.00,
      currency: 'BRL',
      competence,
      payment_date: '2026-11-03',
      registered_by: 'cfo@atendezen.com.br',
      validation_status: 'validated',
      is_shared: false,
      created_at: '2026-11-03T00:00:00.000Z'
    };
    unitEconEngine.registerAcquisitionExpense(acqExp);

    const acqEvent: CustomerAcquisitionEvent = {
      id: 'acq-ev-e2e-01',
      client_id: clientId,
      tenant_id: tenantId,
      acquisition_date: '2026-11-05',
      created_at: '2026-11-05T00:00:00.000Z'
    };
    unitEconEngine.recordCustomerAcquisition(acqEvent);

    // 9. Conciliação com o Observability Dashboard
    const overview = dashboardService.getExecutiveOverview({
      competence,
      tenantId,
      referenceDate: '2026-11-30'
    });

    // Validações Contábeis no Dashboard
    assert.equal(overview.revenue.total_invoiced_brl, 6000.00);
    assert.equal(overview.revenue.total_received_brl, 5000.00);
    assert.equal(overview.revenue.outstanding_invoiced_brl, 1000.00);
    assert.equal(overview.costs.ai_spend_usd, 0.0630);
    assert.equal(overview.costs.ai_spend_brl, 0.37);
    assert.equal(overview.costs.acquisition_sm_brl, 8000.00);
    assert.equal(overview.profitability.margin_on_invoiced_brl, -2000.37);
    assert.equal(overview.profitability.margin_on_received_brl, -3000.37);

    // Unit Economics no Dashboard
    assert.equal(overview.unit_economics.cac_30d_brl, 8000.00);
    assert.equal(overview.unit_economics.cac_90d_brl, 8000.00);
    assert.equal(overview.unit_economics.ltv_brl, null);
    assert.equal(overview.unit_economics.payback_months, null);
    assert.equal(overview.revenue.reliability, 'measured');
  });

  // ----------------------------------------------------------------------------
  // E2E-02: Idempotência & Prevenção de Duplicidade em Retries
  // ----------------------------------------------------------------------------
  it('E2E-02: Idempotência de Lançamentos Contábeis e Prevenção de Duplicidade em Retries', () => {
    const ledgerEngine = new FinopsLedgerEngine();
    const revenueEngine = new RevenuePipelineEngine();

    // 1. Reconciliação repetida do mesmo agent_run
    const runInput: AgentRunRecordInput = {
      id: 'run-retry-test-01',
      agent_id: 'AG-003',
      task_id: 'task-retry-01',
      client_id: 'client-retry',
      model_name: 'gemini-3.8-flash',
      input_tokens: 50_000,
      output_tokens: 20_000,
      execution_time_ms: 1500,
      status: 'success',
      created_at: '2026-11-08T12:00:00.000Z'
    };

    ledgerEngine.reconcileRuns([runInput]);
    const countAfterFirst = ledgerEngine.getAllEntries().length;
    const clientCostAfterFirst = ledgerEngine.getClientCostSummary('client-retry').costUsd;

    // Retry com os mesmos dados
    ledgerEngine.reconcileRuns([runInput]);
    const countAfterSecond = ledgerEngine.getAllEntries().length;
    const clientCostAfterSecond = ledgerEngine.getClientCostSummary('client-retry').costUsd;

    assert.equal(countAfterSecond, countAfterFirst, 'A quantidade de lançamentos não deve aumentar após retry do mesmo run_id');
    assert.equal(clientCostAfterSecond, clientCostAfterFirst, 'O custo total do cliente não deve ser duplicado');

    // 2. Faturamento com contrato idêntico (Prevenção de faturamento duplicado)
    const contract: ClientContractModel = {
      id: 'ctr-retry-01',
      client_id: 'client-retry',
      contract_number: 'CTR-RETRY-01',
      start_date: '2026-01-01',
      end_date: null,
      monthly_recurring_value_brl: 3000.00,
      has_success_fee: false,
      success_fee_percent: null,
      success_fee_clause: null,
      adjustment_index: 'IPCA',
      adjustment_periodicity_months: 12,
      status: 'active',
      created_at: '2026-01-01T00:00:00.000Z'
    };
    revenueEngine.registerContract(contract);

    const inv1 = revenueEngine.generateMonthlyInvoice(contract.id, '2026-11');
    assert.equal(inv1.total_amount_brl, 3000.00);

    // Tentativa de faturar novamente a mesma competência deve ser bloqueada
    assert.throws(
      () => revenueEngine.generateMonthlyInvoice(contract.id, '2026-11'),
      /Fatura já existente/,
      'O sistema deve bloquear emissão de fatura duplicada para a mesma competência'
    );

    // Registra recebimento
    revenueEngine.registerReceipt(inv1.id, {
      amount: 3000.00,
      date: '2026-11-10',
      transactionReference: 'PIX-RETRY-999'
    });

    const marginRep = revenueEngine.generateClientMarginReport('client-retry', '2026-11', {
      clientId: 'client-retry',
      totalRuns: 1,
      totalTokensIn: 50_000,
      totalTokensOut: 20_000,
      costUsd: 0.0195,
      costBrl: 0.11
    });

    assert.equal(marginRep.invoiced_mrr_brl, 3000.00, 'Receita faturada não deve ser duplicada por retry');
    assert.equal(marginRep.received_mrr_brl, 3000.00, 'Receita recebida não deve ser duplicada por retry');
  });

  // ----------------------------------------------------------------------------
  // E2E-03: Segregação e Isolamento Multi-Tenant Rigoroso
  // ----------------------------------------------------------------------------
  it('E2E-03: Segregação e Isolamento Multi-Tenant Rigoroso (Sem Vazamento Cross-Tenant)', () => {
    const revenueEngine = new RevenuePipelineEngine();
    const unitEconEngine = new UnitEconomicsEngine();
    const dashboardService = new ObservabilityDashboardService({
      revenueEngine,
      unitEconomicsEngine: unitEconEngine
    });

    // Cadastro de dados em Tenant Alpha
    revenueEngine.registerContract({
      id: 'contract-alpha',
      client_id: 'client-alpha',
      contract_number: 'CTR-ALPHA-01',
      start_date: '2026-01-01',
      end_date: null,
      monthly_recurring_value_brl: 15000.00,
      has_success_fee: false,
      success_fee_percent: null,
      success_fee_clause: null,
      adjustment_index: 'IPCA',
      adjustment_periodicity_months: 12,
      status: 'active',
      created_at: '2026-01-01T00:00:00.000Z'
    });
    unitEconEngine.registerAcquisitionExpense({
      id: 'acq-alpha-01',
      tenant_id: 'tenant-alpha',
      category: 'MARKETING',
      description: 'Anúncios Tenant Alpha',
      amount_brl: 25000.00,
      currency: 'BRL',
      competence: '2026-11',
      payment_date: '2026-11-05',
      registered_by: 'admin@alpha.com',
      validation_status: 'validated',
      is_shared: false,
      created_at: '2026-11-05T00:00:00.000Z'
    });
    unitEconEngine.recordCustomerAcquisition({
      id: 'ev-alpha-01',
      client_id: 'client-alpha',
      tenant_id: 'tenant-alpha',
      acquisition_date: '2026-11-08',
      created_at: '2026-11-08T00:00:00.000Z'
    });

    // Consulta do Overview para Tenant Beta (que não possui nada cadastrado)
    const overviewBeta = dashboardService.getExecutiveOverview({
      tenantId: 'tenant-beta',
      competence: '2026-11',
      referenceDate: '2026-11-30'
    });

    assert.equal(overviewBeta.costs.acquisition_sm_brl, 0, 'Despesa de marketing de Tenant Alpha não pode vazar para Tenant Beta');
    assert.equal(overviewBeta.unit_economics.cac_30d_brl, null, 'CAC de Tenant Beta deve ser null');

    // Consulta do Overview para Tenant Alpha
    const overviewAlpha = dashboardService.getExecutiveOverview({
      tenantId: 'tenant-alpha',
      competence: '2026-11',
      referenceDate: '2026-11-30'
    });

    assert.equal(overviewAlpha.costs.acquisition_sm_brl, 25000.00);
    assert.equal(overviewAlpha.unit_economics.cac_30d_brl, 25000.00);
  });

  // ----------------------------------------------------------------------------
  // E2E-04: Trava Soberana de Success Fee sem Comprovação e HITL
  // ----------------------------------------------------------------------------
  it('E2E-04: Trava Soberana de Success Fee sem Comprovação de Economia e HITL', () => {
    const revenueEngine = new RevenuePipelineEngine();

    // Contrato
    const contract: ClientContractModel = {
      id: 'contract-sf-block',
      client_id: 'client-sf-test',
      contract_number: 'CTR-SF-BLOCK',
      start_date: '2026-01-01',
      end_date: null,
      monthly_recurring_value_brl: 2000.00,
      has_success_fee: true,
      success_fee_percent: 20.0,
      success_fee_clause: 'Cláusula 5.2',
      adjustment_index: 'IPCA',
      adjustment_periodicity_months: 12,
      status: 'active',
      created_at: '2026-01-01T00:00:00.000Z'
    };
    revenueEngine.registerContract(contract);

    // 1. Tentativa de Success Fee com Economia Não Verificada pelo AG-004
    const unverifiedReport: MVValidationReportInput = {
      id: 'mv-unverified-01',
      competence: '2026-11',
      clientId: 'client-sf-test',
      verifiedSavingsBrl: 50000.00,
      isVerifiedByAG004: false // Apenas estimativa
    };
    const blockedEvent = revenueEngine.registerSuccessFeeEvent(contract, unverifiedReport);
    assert.equal(blockedEvent.status, 'not_eligible');
    assert.equal(blockedEvent.eligible_amount_brl, 0);

    // 2. Registro com Economia Real, mas SEM Aprovação Humana (HITL pendente)
    const validReport: MVValidationReportInput = {
      id: 'mv-valid-01',
      competence: '2026-11',
      clientId: 'client-sf-test',
      verifiedSavingsBrl: 10000.00,
      isVerifiedByAG004: true
    };
    const pendingEvent = revenueEngine.registerSuccessFeeEvent(contract, validReport);
    assert.equal(pendingEvent.status, 'pending_approval');
    assert.equal(pendingEvent.eligible_amount_brl, 2000.00);

    // Tentativa de faturar antes da aprovação humana expressa deve lançar erro
    assert.throws(
      () => revenueEngine.generateMonthlyInvoice(contract.id, '2026-11', pendingEvent.id),
      /requer aprovação humana prévia/,
      'O sistema deve bloquear faturamento de Success Fee sem aprovação humana expressa'
    );
  });

  // ----------------------------------------------------------------------------
  // E2E-05: Auditoria de Incompletude, Custos Órfãos e Rejeição de Defaults
  // ----------------------------------------------------------------------------
  it('E2E-05: Auditoria de Incompletude, Custos Órfãos e Rejeição de Defaults Fictícios (1490)', () => {
    const ledgerEngine = new FinopsLedgerEngine();
    const dashboardService = new ObservabilityDashboardService({ ledgerEngine });

    // 1. Execução sem client_id (custo órfão/legado)
    const orphanRun: AgentRunRecordInput = {
      id: 'run-orphan-01',
      agent_id: 'AG-001',
      task_id: null,
      client_id: null, // Sem cliente
      model_name: 'gemini-3.8-flash',
      input_tokens: 20_000,
      output_tokens: 10_000,
      execution_time_ms: 1100,
      status: 'success',
      created_at: '2026-11-08T10:00:00.000Z'
    };

    // 2. Execução com modelo não precificado / tokens incompletos
    const incompleteRun: AgentRunRecordInput = {
      id: 'run-incomplete-01',
      agent_id: 'AG-012',
      task_id: 'task-incomp-01',
      client_id: 'client-incomp',
      model_name: 'unknown-experimental-model',
      input_tokens: 0,
      output_tokens: 0,
      execution_time_ms: 900,
      status: 'success',
      created_at: '2026-11-08T10:05:00.000Z'
    };

    ledgerEngine.reconcileRuns([orphanRun, incompleteRun]);

    const overview = dashboardService.getExecutiveOverview({ competence: '2026-11' });

    // Validações
    assert.equal(overview.revenue.contracted_mrr_brl, null, 'Quando não há contratos válidos, MRR deve ser null');
    assert.equal(overview.revenue.invoiced_mrr_brl, 0);
    assert.equal(overview.revenue.total_invoiced_brl, 0);
    assert.notEqual(overview.revenue.contracted_mrr_brl, 1490, 'Nunca deve utilizar o fallback de R$ 1.490');

    // Governança e Alertas
    assert.equal(overview.governance.alerts.length >= 2, true);
    assert.equal(
      overview.governance.alerts.some(a => a.includes('custos de IA não atribuídos')),
      true,
      'Deve alertar sobre custos não atribuídos'
    );
    assert.equal(
      overview.governance.alerts.some(a => a.includes('dados incompletos')),
      true,
      'Deve alertar sobre execuções incompletas'
    );
  });

  // ----------------------------------------------------------------------------
  // E2E-06: Resiliência a Falhas e Reconciliação Exata de Saldos Devedores
  // ----------------------------------------------------------------------------
  it('E2E-06: Resiliência a Falhas e Reconciliação Exata de Saldos Devedores em Pagamentos Parciais', () => {
    const revenueEngine = new RevenuePipelineEngine();

    const clientId = 'client-resilience-test';
    const competence = '2026-11';

    const contract: ClientContractModel = {
      id: 'contract-resil',
      client_id: clientId,
      contract_number: 'CTR-RESIL-01',
      start_date: '2026-01-01',
      end_date: null,
      monthly_recurring_value_brl: 10000.00,
      has_success_fee: false,
      success_fee_percent: null,
      success_fee_clause: null,
      adjustment_index: 'IPCA',
      adjustment_periodicity_months: 12,
      status: 'active',
      created_at: '2026-01-01T00:00:00.000Z'
    };
    revenueEngine.registerContract(contract);

    // Emite fatura de R$ 10.000,00
    const inv = revenueEngine.generateMonthlyInvoice(contract.id, competence);
    assert.equal(inv.total_amount_brl, 10000.00);

    // 1º Pagamento Parcial: R$ 3.500,00
    const res1 = revenueEngine.registerReceipt(inv.id, {
      amount: 3500.00,
      date: '2026-11-10',
      transactionReference: 'TRANSAC-01'
    });
    assert.equal(res1.receiptRecord.balance_remaining_brl, 6500.00);

    let report = revenueEngine.generateClientMarginReport(clientId, competence, {
      clientId,
      totalRuns: 0,
      totalTokensIn: 0,
      totalTokensOut: 0,
      costUsd: 0,
      costBrl: 0
    });
    assert.equal(report.total_invoiced_brl, 10000.00);
    assert.equal(report.total_received_brl, 3500.00);

    // 2º Pagamento Parcial: R$ 4.000,00
    const res2 = revenueEngine.registerReceipt(inv.id, {
      amount: 4000.00,
      date: '2026-11-15',
      transactionReference: 'TRANSAC-02'
    });
    assert.equal(res2.receiptRecord.balance_remaining_brl, 2500.00);

    report = revenueEngine.generateClientMarginReport(clientId, competence, {
      clientId,
      totalRuns: 0,
      totalTokensIn: 0,
      totalTokensOut: 0,
      costUsd: 0,
      costBrl: 0
    });
    assert.equal(report.total_invoiced_brl, 10000.00);
    assert.equal(report.total_received_brl, 7500.00);

    // 3º Pagamento Final Quitação: R$ 2.500,00
    const res3 = revenueEngine.registerReceipt(inv.id, {
      amount: 2500.00,
      date: '2026-11-20',
      transactionReference: 'TRANSAC-03'
    });
    assert.equal(res3.receiptRecord.balance_remaining_brl, 0.00);
    assert.equal(res3.updatedInvoice.status, 'paid');

    report = revenueEngine.generateClientMarginReport(clientId, competence, {
      clientId,
      totalRuns: 0,
      totalTokensIn: 0,
      totalTokensOut: 0,
      costUsd: 0,
      costBrl: 0
    });
    assert.equal(report.total_invoiced_brl, 10000.00);
    assert.equal(report.total_received_brl, 10000.00, 'Fatura liquidada integralmente');
  });

});
