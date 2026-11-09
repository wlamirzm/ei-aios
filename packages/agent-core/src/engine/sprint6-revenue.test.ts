// ==============================================================================
// SPRINT 6 TEST SUITE: S6-03 REAL REVENUE PIPELINE & CONTRACT BILLING SYNC
// Scenarios REV-01 through REV-18
// ==============================================================================

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  RevenuePipelineEngine,
  MVValidationReportInput
} from '../tools/revenue-pipeline-engine.js';
import { ClientCostSummary } from '../tools/finops-ledger-engine.js';
import { ClientContractModel } from '@ei-aios/shared';

describe('Sprint 6 — S6-03 Real Revenue Pipeline & Contract Billing Sync (REV-01 a REV-18)', () => {

  // ----------------------------------------------------------------------------
  // REV-01: Contrato vigente
  // ----------------------------------------------------------------------------
  it('REV-01: Contrato vigente é identificado corretamente dentro de sua janela de validade', () => {
    const engine = new RevenuePipelineEngine();
    const contract: ClientContractModel = {
      id: 'ctr-01',
      client_id: 'client-01',
      contract_number: 'CTR-2026-001',
      start_date: '2026-01-01',
      end_date: '2026-12-31',
      monthly_recurring_value_brl: 5000.00,
      has_success_fee: true,
      success_fee_percent: 20,
      success_fee_clause: 'Cláusula 7.1: 20% sobre economia comprovada',
      adjustment_index: 'IPCA',
      adjustment_periodicity_months: 12,
      status: 'active',
      created_at: '2026-01-01T00:00:00.000Z'
    };
    engine.registerContract(contract);

    assert.equal(engine.isContractActive(contract, '2026-06'), true);
    assert.equal(engine.isContractActive(contract, '2026-11'), true);
    assert.equal(engine.isContractActive(contract, '2025-12'), false, 'Não deve estar ativo antes do início');
  });

  // ----------------------------------------------------------------------------
  // REV-02: Contrato expirado
  // ----------------------------------------------------------------------------
  it('REV-02: Contrato expirado após a data de término não é considerado ativo', () => {
    const engine = new RevenuePipelineEngine();
    const expiredContract: ClientContractModel = {
      id: 'ctr-expired',
      client_id: 'client-02',
      contract_number: 'CTR-2025-EXP',
      start_date: '2025-01-01',
      end_date: '2025-12-31',
      monthly_recurring_value_brl: 3000.00,
      has_success_fee: false,
      success_fee_percent: null,
      success_fee_clause: null,
      adjustment_index: 'FIXED',
      adjustment_periodicity_months: 12,
      status: 'active',
      created_at: '2025-01-01T00:00:00.000Z'
    };
    engine.registerContract(expiredContract);

    assert.equal(engine.isContractActive(expiredContract, '2026-01'), false);
    assert.equal(engine.isContractActive(expiredContract, '2026-11'), false);
  });

  // ----------------------------------------------------------------------------
  // REV-03: Contrato sem valor definido
  // ----------------------------------------------------------------------------
  it('REV-03: Contrato sem valor definido retorna nulo sem inventar valores demonstrativos', () => {
    const engine = new RevenuePipelineEngine();
    const contractNoValue: ClientContractModel = {
      id: 'ctr-no-val',
      client_id: 'client-03',
      contract_number: 'CTR-NO-VALUE',
      start_date: '2026-01-01',
      end_date: null,
      monthly_recurring_value_brl: null, // Sem valor definido
      has_success_fee: false,
      success_fee_percent: null,
      success_fee_clause: null,
      adjustment_index: 'IPCA',
      adjustment_periodicity_months: 12,
      status: 'active',
      created_at: '2026-01-01T00:00:00.000Z'
    };
    engine.registerContract(contractNoValue);

    const emptyAiCost: ClientCostSummary = {
      clientId: 'client-03',
      totalRuns: 0,
      totalTokensIn: 0,
      totalTokensOut: 0,
      costUsd: 0,
      costBrl: 0
    };

    const report = engine.generateClientMarginReport('client-03', '2026-11', emptyAiCost);
    assert.equal(report.contracted_mrr_brl, null, 'MRR contratado deve ser nulo');
    assert.equal(report.reliability, 'incomplete');
  });

  // ----------------------------------------------------------------------------
  // REV-04: Competências mensais
  // ----------------------------------------------------------------------------
  it('REV-04: Faturamento é estritamente segregado por competência mensal (YYYY-MM)', () => {
    const engine = new RevenuePipelineEngine();
    const contract: ClientContractModel = {
      id: 'ctr-comp',
      client_id: 'client-comp',
      contract_number: 'CTR-COMP-01',
      start_date: '2026-01-01',
      end_date: null,
      monthly_recurring_value_brl: 4000.00,
      has_success_fee: false,
      success_fee_percent: null,
      success_fee_clause: null,
      adjustment_index: 'IPCA',
      adjustment_periodicity_months: 12,
      status: 'active',
      created_at: '2026-01-01T00:00:00.000Z'
    };
    engine.registerContract(contract);

    const invNov = engine.generateMonthlyInvoice(contract.id, '2026-11');
    const invDez = engine.generateMonthlyInvoice(contract.id, '2026-12');

    assert.equal(invNov.competence, '2026-11');
    assert.equal(invDez.competence, '2026-12');
    assert.notEqual(invNov.id, invDez.id);
  });

  // ----------------------------------------------------------------------------
  // REV-05: Reajustes contratuais
  // ----------------------------------------------------------------------------
  it('REV-05: Reajuste contratual recalcula MRR e preserva histórico auditável', () => {
    const engine = new RevenuePipelineEngine();
    const contract: ClientContractModel = {
      id: 'ctr-reaj',
      client_id: 'client-reaj',
      contract_number: 'CTR-REAJ-01',
      start_date: '2025-11-01',
      end_date: null,
      monthly_recurring_value_brl: 10000.00,
      has_success_fee: false,
      success_fee_percent: null,
      success_fee_clause: null,
      adjustment_index: 'IPCA',
      adjustment_periodicity_months: 12,
      status: 'active',
      created_at: '2025-11-01T00:00:00.000Z'
    };
    engine.registerContract(contract);

    // Aplica reajuste de 4.8% pelo IPCA
    const updated = engine.applyContractAdjustment(contract.id, 4.8, '2026-11-01', 'Reajuste anual IPCA 4.8%');

    assert.equal(updated.monthly_recurring_value_brl, 10480.00);
    assert.equal(updated.last_adjustment_date, '2026-11-01');
    assert.ok(updated.metadata?.adjustments);
    assert.equal(updated.metadata.adjustments.length, 1);
    assert.equal(updated.metadata.adjustments[0].previous_value_brl, 10000.00);
    assert.equal(updated.metadata.adjustments[0].new_value_brl, 10480.00);
  });

  // ----------------------------------------------------------------------------
  // REV-06: Receita faturada sem recebimento
  // ----------------------------------------------------------------------------
  it('REV-06: Receita faturada sem recebimento reflete no faturamento mas mantém recebimento zero', () => {
    const engine = new RevenuePipelineEngine();
    const contract: ClientContractModel = {
      id: 'ctr-fat-sem-rec',
      client_id: 'client-fat',
      contract_number: 'CTR-FAT-01',
      start_date: '2026-01-01',
      end_date: null,
      monthly_recurring_value_brl: 8000.00,
      has_success_fee: false,
      success_fee_percent: null,
      success_fee_clause: null,
      adjustment_index: 'IPCA',
      adjustment_periodicity_months: 12,
      status: 'active',
      created_at: '2026-01-01T00:00:00.000Z'
    };
    engine.registerContract(contract);
    engine.generateMonthlyInvoice(contract.id, '2026-11');

    const emptyAi: ClientCostSummary = {
      clientId: 'client-fat',
      totalRuns: 0,
      totalTokensIn: 0,
      totalTokensOut: 0,
      costUsd: 0,
      costBrl: 0
    };

    const report = engine.generateClientMarginReport('client-fat', '2026-11', emptyAi);
    assert.equal(report.total_invoiced_brl, 8000.00);
    assert.equal(report.total_received_brl, 0.00, 'Recebimento deve ser zero sem comprovante');
    assert.equal(report.margin_on_invoiced_brl, 8000.00);
    assert.equal(report.margin_on_received_brl, 0.00);
  });

  // ----------------------------------------------------------------------------
  // REV-07: Recebimento parcial
  // ----------------------------------------------------------------------------
  it('REV-07: Recebimento parcial atualiza status da fatura para partially_paid e calcula saldo', () => {
    const engine = new RevenuePipelineEngine();
    const contract: ClientContractModel = {
      id: 'ctr-parcial',
      client_id: 'client-parcial',
      contract_number: 'CTR-PARCIAL-01',
      start_date: '2026-01-01',
      end_date: null,
      monthly_recurring_value_brl: 5000.00,
      has_success_fee: false,
      success_fee_percent: null,
      success_fee_clause: null,
      adjustment_index: 'IPCA',
      adjustment_periodicity_months: 12,
      status: 'active',
      created_at: '2026-01-01T00:00:00.000Z'
    };
    engine.registerContract(contract);
    const invoice = engine.generateMonthlyInvoice(contract.id, '2026-11');

    // Pagamento parcial de R$ 2.000 de um total de R$ 5.000
    const { updatedInvoice, receiptRecord } = engine.registerReceipt(invoice.id, {
      amount: 2000.00,
      date: '2026-11-15',
      transactionReference: 'PIX-12345-PARCIAL'
    });

    assert.equal(updatedInvoice.status, 'partially_paid');
    assert.equal(receiptRecord.is_partial, true);
    assert.equal(receiptRecord.balance_remaining_brl, 3000.00);

    const report = engine.generateClientMarginReport('client-parcial', '2026-11', {
      clientId: 'client-parcial',
      totalRuns: 0,
      totalTokensIn: 0,
      totalTokensOut: 0,
      costUsd: 0,
      costBrl: 0
    });
    assert.equal(report.total_invoiced_brl, 5000.00);
    assert.equal(report.total_received_brl, 2000.00);
  });

  // ----------------------------------------------------------------------------
  // REV-08: Recebimento integral
  // ----------------------------------------------------------------------------
  it('REV-08: Recebimento integral quita a fatura com status paid e saldo remanescente zero', () => {
    const engine = new RevenuePipelineEngine();
    const contract: ClientContractModel = {
      id: 'ctr-total',
      client_id: 'client-total',
      contract_number: 'CTR-TOTAL-01',
      start_date: '2026-01-01',
      end_date: null,
      monthly_recurring_value_brl: 6000.00,
      has_success_fee: false,
      success_fee_percent: null,
      success_fee_clause: null,
      adjustment_index: 'IPCA',
      adjustment_periodicity_months: 12,
      status: 'active',
      created_at: '2026-01-01T00:00:00.000Z'
    };
    engine.registerContract(contract);
    const invoice = engine.generateMonthlyInvoice(contract.id, '2026-11');

    const { updatedInvoice, receiptRecord } = engine.registerReceipt(invoice.id, {
      amount: 6000.00,
      date: '2026-11-10',
      transactionReference: 'TED-99999-TOTAL'
    });

    assert.equal(updatedInvoice.status, 'paid');
    assert.equal(receiptRecord.is_partial, false);
    assert.equal(receiptRecord.balance_remaining_brl, 0.00);
  });

  // ----------------------------------------------------------------------------
  // REV-09: Success Fee com economia validada
  // ----------------------------------------------------------------------------
  it('REV-09: Success Fee com validação do AG-004 apura valor elegível exato conforme cláusula', () => {
    const engine = new RevenuePipelineEngine();
    const contract: ClientContractModel = {
      id: 'ctr-sf-ok',
      client_id: 'client-sf',
      contract_number: 'CTR-SF-01',
      start_date: '2026-01-01',
      end_date: null,
      monthly_recurring_value_brl: 2000.00,
      has_success_fee: true,
      success_fee_percent: 20, // 20% sobre economia
      success_fee_clause: 'Cláusula 5.2: 20% da economia líquida comprovada',
      adjustment_index: 'IPCA',
      adjustment_periodicity_months: 12,
      status: 'active',
      created_at: '2026-01-01T00:00:00.000Z'
    };
    engine.registerContract(contract);

    const mvReport: MVValidationReportInput = {
      id: 'mv-rep-01',
      competence: '2026-11',
      clientId: 'client-sf',
      verifiedSavingsBrl: 15000.00, // Economia comprovada de R$ 15.000
      isVerifiedByAG004: true
    };

    const sfEvent = engine.registerSuccessFeeEvent(contract, mvReport);
    assert.equal(sfEvent.status, 'pending_approval');
    // 20% de R$ 15.000 = R$ 3.000
    assert.equal(sfEvent.eligible_amount_brl, 3000.00);
    assert.equal(sfEvent.verified_savings_brl, 15000.00);
  });

  // ----------------------------------------------------------------------------
  // REV-10: Success Fee sem validação do AG-004
  // ----------------------------------------------------------------------------
  it('REV-10: Success Fee baseado em estimativas sem validação do AG-004 é bloqueado como not_eligible', () => {
    const engine = new RevenuePipelineEngine();
    const contract: ClientContractModel = {
      id: 'ctr-sf-block',
      client_id: 'client-sf2',
      contract_number: 'CTR-SF-02',
      start_date: '2026-01-01',
      end_date: null,
      monthly_recurring_value_brl: 2000.00,
      has_success_fee: true,
      success_fee_percent: 20,
      success_fee_clause: 'Cláusula 5.2',
      adjustment_index: 'IPCA',
      adjustment_periodicity_months: 12,
      status: 'active',
      created_at: '2026-01-01T00:00:00.000Z'
    };
    engine.registerContract(contract);

    const unverifiedReport: MVValidationReportInput = {
      id: 'mv-unverified',
      competence: '2026-11',
      clientId: 'client-sf2',
      verifiedSavingsBrl: 50000.00,
      isVerifiedByAG004: false // Apenas estimativa não homologada
    };

    const blocked = engine.registerSuccessFeeEvent(contract, unverifiedReport);
    assert.equal(blocked.status, 'not_eligible');
    assert.equal(blocked.eligible_amount_brl, 0);
  });

  // ----------------------------------------------------------------------------
  // REV-11: Success Fee sem cláusula contratual
  // ----------------------------------------------------------------------------
  it('REV-11: Success Fee para contrato sem previsão contratual é bloqueado como not_eligible', () => {
    const engine = new RevenuePipelineEngine();
    const contractNoClause: ClientContractModel = {
      id: 'ctr-no-sf',
      client_id: 'client-no-sf',
      contract_number: 'CTR-NO-SF',
      start_date: '2026-01-01',
      end_date: null,
      monthly_recurring_value_brl: 4000.00,
      has_success_fee: false, // Sem success fee
      success_fee_percent: null,
      success_fee_clause: null,
      adjustment_index: 'IPCA',
      adjustment_periodicity_months: 12,
      status: 'active',
      created_at: '2026-01-01T00:00:00.000Z'
    };
    engine.registerContract(contractNoClause);

    const mvReport: MVValidationReportInput = {
      id: 'mv-ok',
      competence: '2026-11',
      clientId: 'client-no-sf',
      verifiedSavingsBrl: 10000.00,
      isVerifiedByAG004: true
    };

    const blocked = engine.registerSuccessFeeEvent(contractNoClause, mvReport);
    assert.equal(blocked.status, 'not_eligible');
    assert.equal(blocked.eligible_amount_brl, 0);
  });

  // ----------------------------------------------------------------------------
  // REV-12: Aprovação humana obrigatória (HITL Nível 2)
  // ----------------------------------------------------------------------------
  it('REV-12: Tentativa de faturar Success Fee sem aprovação humana expressa é bloqueada', () => {
    const engine = new RevenuePipelineEngine();
    const contract: ClientContractModel = {
      id: 'ctr-hitl',
      client_id: 'client-hitl',
      contract_number: 'CTR-HITL-01',
      start_date: '2026-01-01',
      end_date: null,
      monthly_recurring_value_brl: 1500.00,
      has_success_fee: true,
      success_fee_percent: 15,
      success_fee_clause: 'Cláusula 4.1',
      adjustment_index: 'IPCA',
      adjustment_periodicity_months: 12,
      status: 'active',
      created_at: '2026-01-01T00:00:00.000Z'
    };
    engine.registerContract(contract);

    const mvReport: MVValidationReportInput = {
      id: 'mv-hitl',
      competence: '2026-11',
      clientId: 'client-hitl',
      verifiedSavingsBrl: 20000.00,
      isVerifiedByAG004: true
    };
    const sfEvent = engine.registerSuccessFeeEvent(contract, mvReport);

    // Tentar faturar antes de aprovar deve lançar erro
    assert.throws(
      () => engine.generateMonthlyInvoice(contract.id, '2026-11', sfEvent.id),
      /requer aprovação humana prévia/
    );

    // Aprovação humana explícita pelo Founder / Operador
    engine.approveSuccessFee(sfEvent.id, 'founder@energyintelligence.com.br');

    // Agora o faturamento é permitido com sucesso
    const invoice = engine.generateMonthlyInvoice(contract.id, '2026-11', sfEvent.id);
    assert.equal(invoice.recurring_amount_brl, 1500.00);
    assert.equal(invoice.success_fee_amount_brl, 3000.00); // 15% de 20.000
    assert.equal(invoice.total_amount_brl, 4500.00);
  });

  // ----------------------------------------------------------------------------
  // REV-13: Prevenção de duplicidade de faturamento
  // ----------------------------------------------------------------------------
  it('REV-13: Emissão de segunda fatura para o mesmo contrato e mês é estritamente bloqueada', () => {
    const engine = new RevenuePipelineEngine();
    const contract: ClientContractModel = {
      id: 'ctr-dup',
      client_id: 'client-dup',
      contract_number: 'CTR-DUP-01',
      start_date: '2026-01-01',
      end_date: null,
      monthly_recurring_value_brl: 2500.00,
      has_success_fee: false,
      success_fee_percent: null,
      success_fee_clause: null,
      adjustment_index: 'IPCA',
      adjustment_periodicity_months: 12,
      status: 'active',
      created_at: '2026-01-01T00:00:00.000Z'
    };
    engine.registerContract(contract);

    // Primeira emissão: OK
    engine.generateMonthlyInvoice(contract.id, '2026-11');

    // Segunda emissão para mesma competência: DEVE FALHAR
    assert.throws(
      () => engine.generateMonthlyInvoice(contract.id, '2026-11'),
      /Fatura já existente para o contrato .* Faturamento duplicado bloqueado/
    );
  });

  // ----------------------------------------------------------------------------
  // REV-14: Segregação entre clientes
  // ----------------------------------------------------------------------------
  it('REV-14: Faturamento e recebimento de múltiplos clientes são estritamente isolados', () => {
    const engine = new RevenuePipelineEngine();
    const ctrA: ClientContractModel = {
      id: 'ctr-a',
      client_id: 'client-A',
      contract_number: 'CTR-A',
      start_date: '2026-01-01',
      end_date: null,
      monthly_recurring_value_brl: 5000.00,
      has_success_fee: false,
      success_fee_percent: null,
      success_fee_clause: null,
      adjustment_index: 'IPCA',
      adjustment_periodicity_months: 12,
      status: 'active',
      created_at: '2026-01-01T00:00:00.000Z'
    };
    const ctrB: ClientContractModel = {
      id: 'ctr-b',
      client_id: 'client-B',
      contract_number: 'CTR-B',
      start_date: '2026-01-01',
      end_date: null,
      monthly_recurring_value_brl: 12000.00,
      has_success_fee: false,
      success_fee_percent: null,
      success_fee_clause: null,
      adjustment_index: 'IPCA',
      adjustment_periodicity_months: 12,
      status: 'active',
      created_at: '2026-01-01T00:00:00.000Z'
    };
    engine.registerContract(ctrA);
    engine.registerContract(ctrB);

    engine.generateMonthlyInvoice(ctrA.id, '2026-11');
    engine.generateMonthlyInvoice(ctrB.id, '2026-11');

    const repA = engine.generateClientMarginReport('client-A', '2026-11', {
      clientId: 'client-A',
      totalRuns: 0,
      totalTokensIn: 0,
      totalTokensOut: 0,
      costUsd: 0,
      costBrl: 0
    });
    const repB = engine.generateClientMarginReport('client-B', '2026-11', {
      clientId: 'client-B',
      totalRuns: 0,
      totalTokensIn: 0,
      totalTokensOut: 0,
      costUsd: 0,
      costBrl: 0
    });

    assert.equal(repA.total_invoiced_brl, 5000.00);
    assert.equal(repB.total_invoiced_brl, 12000.00);
    assert.notEqual(repA.total_invoiced_brl, repB.total_invoiced_brl);
  });

  // ----------------------------------------------------------------------------
  // REV-15: Conciliação com custos da S6-02 (Ledger)
  // ----------------------------------------------------------------------------
  it('REV-15: Margem bruta real deduz com exatidão os custos de IA registrados no FinOps Ledger', () => {
    const engine = new RevenuePipelineEngine();
    const contract: ClientContractModel = {
      id: 'ctr-margin',
      client_id: 'client-margin',
      contract_number: 'CTR-MARGIN-01',
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
    engine.registerContract(contract);
    const invoice = engine.generateMonthlyInvoice(contract.id, '2026-11');
    engine.registerReceipt(invoice.id, {
      amount: 10000.00,
      date: '2026-11-10',
      transactionReference: 'TED-MARGIN-100'
    });

    // Custos de IA vindos do FinOps Ledger (S6-02): US$ 10.00 -> R$ 58.00
    const aiCost: ClientCostSummary = {
      clientId: 'client-margin',
      totalRuns: 5,
      totalTokensIn: 50_000,
      totalTokensOut: 10_000,
      costUsd: 10.00,
      costBrl: 58.00
    };

    const directSupport = 500.00; // R$ 500 de suporte
    const report = engine.generateClientMarginReport('client-margin', '2026-11', aiCost, directSupport);

    // Custos totais = R$ 500 + R$ 58 = R$ 558.00
    assert.equal(report.total_direct_costs_brl, 558.00);
    // Margem = R$ 10.000 - R$ 558 = R$ 9.442.00
    assert.equal(report.margin_on_invoiced_brl, 9442.00);
    assert.equal(report.margin_on_received_brl, 9442.00);
    assert.equal(report.margin_on_invoiced_percent, 94.42);
    assert.equal(report.reliability, 'measured');
  });

  // ----------------------------------------------------------------------------
  // REV-16: Registros históricos demonstrativos
  // ----------------------------------------------------------------------------
  it('REV-16: Elimina o MRR estático demonstrativo de R$ 1.490 e exige dados reais auditáveis', () => {
    const engine = new RevenuePipelineEngine();
    // Cliente sem contrato registrado na base
    const report = engine.generateClientMarginReport('client-legacy-pilot', '2026-11', {
      clientId: 'client-legacy-pilot',
      totalRuns: 0,
      totalTokensIn: 0,
      totalTokensOut: 0,
      costUsd: 0,
      costBrl: 0
    });

    assert.equal(report.contracted_mrr_brl, null, 'MRR não pode assumir 1490 como fallback');
    assert.equal(report.total_invoiced_brl, 0);
    assert.equal(report.reliability, 'incomplete');
  });

  // ----------------------------------------------------------------------------
  // REV-17: Reprocessamento idempotente
  // ----------------------------------------------------------------------------
  it('REV-17: Reprocessamento do relatório de margem é idempotente e determinístico', () => {
    const engine = new RevenuePipelineEngine();
    const contract: ClientContractModel = {
      id: 'ctr-idem',
      client_id: 'client-idem',
      contract_number: 'CTR-IDEM',
      start_date: '2026-01-01',
      end_date: null,
      monthly_recurring_value_brl: 3500.00,
      has_success_fee: false,
      success_fee_percent: null,
      success_fee_clause: null,
      adjustment_index: 'IPCA',
      adjustment_periodicity_months: 12,
      status: 'active',
      created_at: '2026-01-01T00:00:00.000Z'
    };
    engine.registerContract(contract);
    engine.generateMonthlyInvoice(contract.id, '2026-11');

    const aiCost: ClientCostSummary = {
      clientId: 'client-idem',
      totalRuns: 1,
      totalTokensIn: 500,
      totalTokensOut: 100,
      costUsd: 0.001,
      costBrl: 0.01
    };

    const run1 = engine.generateClientMarginReport('client-idem', '2026-11', aiCost);
    const run2 = engine.generateClientMarginReport('client-idem', '2026-11', aiCost);

    assert.deepEqual(run1, run2, 'Múltiplas execuções devem produzir demonstrativo financeiro idêntico');
  });

  // ----------------------------------------------------------------------------
  // REV-18: Auditoria de alterações contratuais
  // ----------------------------------------------------------------------------
  it('REV-18: Histórico de reajustes retém todos os eventos cronológicos de auditoria', () => {
    const engine = new RevenuePipelineEngine();
    const contract: ClientContractModel = {
      id: 'ctr-audit',
      client_id: 'client-audit',
      contract_number: 'CTR-AUDIT-01',
      start_date: '2024-01-01',
      end_date: null,
      monthly_recurring_value_brl: 5000.00,
      has_success_fee: false,
      success_fee_percent: null,
      success_fee_clause: null,
      adjustment_index: 'IPCA',
      adjustment_periodicity_months: 12,
      status: 'active',
      created_at: '2024-01-01T00:00:00.000Z'
    };
    engine.registerContract(contract);

    // Primeiro reajuste em 2025: +5% (R$ 5.250)
    engine.applyContractAdjustment(contract.id, 5.0, '2025-01-01', 'Reajuste anual 2025');
    // Segundo reajuste em 2026: +4% (R$ 5.460)
    const finalContract = engine.applyContractAdjustment(contract.id, 4.0, '2026-01-01', 'Reajuste anual 2026');

    assert.equal(finalContract.monthly_recurring_value_brl, 5460.00);
    const adjustments = finalContract.metadata?.adjustments;
    assert.equal(adjustments.length, 2);
    assert.equal(adjustments[0].new_value_brl, 5250.00);
    assert.equal(adjustments[1].new_value_brl, 5460.00);
  });

});

