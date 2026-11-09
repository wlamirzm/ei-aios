// ==============================================================================
// SPRINT 6 TEST SUITE: S6-04 CAC, LTV & PAYBACK DATA FOUNDATION
// Scenarios UE-CAC-01 through UE-SEC-01
// ==============================================================================

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { UnitEconomicsEngine } from '../tools/unit-economics-engine.js';
import {
  AcquisitionExpenseModel,
  OperationalExpenseModel
} from '@ei-aios/shared';

describe('Sprint 6 — S6-04 CAC, LTV & Payback Data Foundation (Unit Economics Engine)', () => {

  // ============================================================================
  // MÓDULO C: TESTES DE CAC REAL
  // ============================================================================

  it('UE-CAC-01: CAC com despesas validadas e clientes adquiridos calcula valor exato', () => {
    const engine = new UnitEconomicsEngine();
    const tenant = 'tenant-solar-01';

    // Despesas de marketing e vendas na janela (Total: R$ 15.000)
    const exp1: AcquisitionExpenseModel = {
      id: 'acq-exp-1',
      tenant_id: tenant,
      category: 'MARKETING',
      description: 'Campanha Google Ads Energia Solar B2B',
      amount_brl: 10000.00,
      currency: 'BRL',
      competence: '2026-11',
      payment_date: '2026-11-10',
      document_reference: 'NF-ADS-9988',
      registered_by: 'growth_lead@energyintelligence.com.br',
      validation_status: 'validated',
      is_shared: false,
      created_at: '2026-11-10T00:00:00.000Z'
    };
    const exp2: AcquisitionExpenseModel = {
      id: 'acq-exp-2',
      tenant_id: tenant,
      category: 'SALES_COMMISSIONS',
      description: 'Comissão SDR fechamento contratos',
      amount_brl: 5000.00,
      currency: 'BRL',
      competence: '2026-11',
      payment_date: '2026-11-15',
      document_reference: 'RECIBO-SDR-12',
      registered_by: 'founder@energyintelligence.com.br',
      validation_status: 'validated',
      is_shared: false,
      created_at: '2026-11-15T00:00:00.000Z'
    };

    engine.registerAcquisitionExpense(exp1);
    engine.registerAcquisitionExpense(exp2);

    // 3 clientes adquiridos em novembro
    engine.recordCustomerAcquisition({
      id: 'ev-1',
      client_id: 'client-ind-1',
      tenant_id: tenant,
      acquisition_date: '2026-11-12',
      channel: 'Inbound Google Ads',
      initial_mrr_brl: 4000.00,
      created_at: '2026-11-12T00:00:00.000Z'
    });
    engine.recordCustomerAcquisition({
      id: 'ev-2',
      client_id: 'client-ind-2',
      tenant_id: tenant,
      acquisition_date: '2026-11-18',
      channel: 'Inbound Google Ads',
      initial_mrr_brl: 6000.00,
      created_at: '2026-11-18T00:00:00.000Z'
    });
    engine.recordCustomerAcquisition({
      id: 'ev-3',
      client_id: 'client-ind-3',
      tenant_id: tenant,
      acquisition_date: '2026-11-20',
      channel: 'Outbound SDR',
      initial_mrr_brl: 5000.00,
      created_at: '2026-11-20T00:00:00.000Z'
    });

    const result = engine.calculateRealCac({
      windowDays: 30,
      referenceDate: '2026-11-30',
      tenantId: tenant
    });

    assert.equal(result.total_eligible_spend_brl, 15000.00);
    assert.equal(result.new_clients_acquired_count, 3);
    // R$ 15.000 / 3 clientes = R$ 5.000,00 por cliente
    assert.equal(result.cac_brl, 5000.00);
    assert.equal(result.status, 'measured');
    assert.equal(result.included_client_ids.length, 3);
  });

  it('UE-CAC-02: CAC em janelas configuráveis de 30, 60 e 90 dias segrega eventos cronológicos', () => {
    const engine = new UnitEconomicsEngine();
    const tenant = 'tenant-multi-window';

    // Despesa há 20 dias (Janela 30, 60, 90)
    engine.registerAcquisitionExpense({
      id: 'exp-recent',
      tenant_id: tenant,
      category: 'MARKETING',
      description: 'Campanha Recente',
      amount_brl: 6000.00,
      currency: 'BRL',
      competence: '2026-11',
      payment_date: '2026-11-10',
      registered_by: 'user',
      validation_status: 'validated',
      is_shared: false,
      created_at: '2026-11-10T00:00:00.000Z'
    });
    engine.recordCustomerAcquisition({
      id: 'ev-recent',
      client_id: 'client-recent',
      tenant_id: tenant,
      acquisition_date: '2026-11-12',
      created_at: '2026-11-12T00:00:00.000Z'
    });

    // Despesa há 50 dias (Fora da janela de 30 dias, mas dentro de 60 e 90)
    engine.registerAcquisitionExpense({
      id: 'exp-older',
      tenant_id: tenant,
      category: 'EVENTS',
      description: 'Feira Solar Expo 2026',
      amount_brl: 14000.00,
      currency: 'BRL',
      competence: '2026-10',
      payment_date: '2026-10-10',
      registered_by: 'user',
      validation_status: 'validated',
      is_shared: false,
      created_at: '2026-10-10T00:00:00.000Z'
    });
    engine.recordCustomerAcquisition({
      id: 'ev-older',
      client_id: 'client-older',
      tenant_id: tenant,
      acquisition_date: '2026-10-15',
      created_at: '2026-10-15T00:00:00.000Z'
    });

    // Janela 30 dias: pega apenas despesa e cliente de novembro (R$ 6.000 / 1 = R$ 6.000)
    const res30 = engine.calculateRealCac({ windowDays: 30, referenceDate: '2026-11-30', tenantId: tenant });
    assert.equal(res30.total_eligible_spend_brl, 6000.00);
    assert.equal(res30.new_clients_acquired_count, 1);
    assert.equal(res30.cac_brl, 6000.00);

    // Janela 60 dias: pega ambas (R$ 20.000 / 2 = R$ 10.000)
    const res60 = engine.calculateRealCac({ windowDays: 60, referenceDate: '2026-11-30', tenantId: tenant });
    assert.equal(res60.total_eligible_spend_brl, 20000.00);
    assert.equal(res60.new_clients_acquired_count, 2);
    assert.equal(res60.cac_brl, 10000.00);
  });

  it('UE-CAC-03: Ausência de clientes adquiridos evita divisão por zero e retorna incomplete', () => {
    const engine = new UnitEconomicsEngine();
    engine.registerAcquisitionExpense({
      id: 'exp-no-clients',
      tenant_id: 'tenant-zero',
      category: 'MARKETING',
      description: 'Ads sem conversão',
      amount_brl: 8000.00,
      currency: 'BRL',
      competence: '2026-11',
      payment_date: '2026-11-15',
      registered_by: 'user',
      validation_status: 'validated',
      is_shared: false,
      created_at: '2026-11-15T00:00:00.000Z'
    });

    const res = engine.calculateRealCac({ windowDays: 30, referenceDate: '2026-11-30', tenantId: 'tenant-zero' });
    assert.equal(res.new_clients_acquired_count, 0);
    assert.equal(res.cac_brl, null, 'CAC deve ser nulo para evitar divisão por zero');
    assert.equal(res.status, 'incomplete');
    assert.ok(res.limitation_notes[0]);
    assert.match(res.limitation_notes[0], /divisão por zero prevenida/);
  });

  it('UE-CAC-04: Ausência de despesas elegíveis de aquisição retorna incomplete', () => {
    const engine = new UnitEconomicsEngine();
    engine.recordCustomerAcquisition({
      id: 'ev-organic',
      client_id: 'client-organic',
      tenant_id: 'tenant-organic',
      acquisition_date: '2026-11-10',
      created_at: '2026-11-10T00:00:00.000Z'
    });

    const res = engine.calculateRealCac({ windowDays: 30, referenceDate: '2026-11-30', tenantId: 'tenant-organic' });
    assert.equal(res.total_eligible_spend_brl, 0);
    assert.equal(res.cac_brl, null);
    assert.equal(res.status, 'incomplete');
  });

  it('UE-CAC-05: Despesas pendentes de validação não entram no CAC measured', () => {
    const engine = new UnitEconomicsEngine();
    const tenant = 'tenant-pending';

    engine.registerAcquisitionExpense({
      id: 'exp-pending',
      tenant_id: tenant,
      category: 'MARKETING',
      description: 'Campanha sem nota fiscal anexada',
      amount_brl: 5000.00,
      currency: 'BRL',
      competence: '2026-11',
      payment_date: '2026-11-10',
      registered_by: 'user',
      validation_status: 'pending', // NÃO validada
      is_shared: false,
      created_at: '2026-11-10T00:00:00.000Z'
    });
    engine.recordCustomerAcquisition({
      id: 'ev-p',
      client_id: 'client-p',
      tenant_id: tenant,
      acquisition_date: '2026-11-12',
      created_at: '2026-11-12T00:00:00.000Z'
    });

    const res = engine.calculateRealCac({ windowDays: 30, referenceDate: '2026-11-30', tenantId: tenant });
    assert.equal(res.total_eligible_spend_brl, 0);
    assert.equal(res.cac_brl, null);
    assert.equal(res.status, 'incomplete');
    assert.ok(res.limitation_notes[0]);
    assert.match(res.limitation_notes[0], /status 'pending'/);
  });

  it('UE-CAC-06: Despesas compartilhadas sem regra de rateio são ignoradas para evitar atribuição indevida', () => {
    const engine = new UnitEconomicsEngine();
    const tenant = 'tenant-shared';

    engine.registerAcquisitionExpense({
      id: 'exp-shared',
      tenant_id: tenant,
      category: 'OTHER_ACQUISITION',
      description: 'Software CRM compartilhado sem rateio definido',
      amount_brl: 3000.00,
      currency: 'BRL',
      competence: '2026-11',
      payment_date: '2026-11-05',
      registered_by: 'user',
      validation_status: 'validated',
      is_shared: true, // Compartilhada
      created_at: '2026-11-05T00:00:00.000Z'
    });
    engine.recordCustomerAcquisition({
      id: 'ev-s',
      client_id: 'client-s',
      tenant_id: tenant,
      acquisition_date: '2026-11-10',
      created_at: '2026-11-10T00:00:00.000Z'
    });

    const res = engine.calculateRealCac({ windowDays: 30, referenceDate: '2026-11-30', tenantId: tenant, allowSharedExpenses: false });
    assert.equal(res.total_eligible_spend_brl, 0);
    assert.ok(res.limitation_notes[0]);
    assert.match(res.limitation_notes[0], /Despesa compartilhada .* ignorada por falta de regra de rateio/);
  });

  it('UE-CAC-07: Clientes duplicados contam como 1 cliente único na janela', () => {
    const engine = new UnitEconomicsEngine();
    const tenant = 'tenant-dedup';

    engine.registerAcquisitionExpense({
      id: 'exp-dedup',
      tenant_id: tenant,
      category: 'SALES',
      description: 'Reunião comercial',
      amount_brl: 4000.00,
      currency: 'BRL',
      competence: '2026-11',
      payment_date: '2026-11-10',
      registered_by: 'user',
      validation_status: 'validated',
      is_shared: false,
      created_at: '2026-11-10T00:00:00.000Z'
    });

    // Tentar gravar o mesmo cliente duas vezes no engine
    engine.recordCustomerAcquisition({
      id: 'ev-unique',
      client_id: 'client-same-id',
      tenant_id: tenant,
      acquisition_date: '2026-11-10',
      created_at: '2026-11-10T00:00:00.000Z'
    });

    assert.throws(
      () => engine.recordCustomerAcquisition({
        id: 'ev-dup',
        client_id: 'client-same-id', // ID já existente
        tenant_id: tenant,
        acquisition_date: '2026-11-12',
        created_at: '2026-11-12T00:00:00.000Z'
      }),
      /já possui evento de aquisição/
    );

    const res = engine.calculateRealCac({ windowDays: 30, referenceDate: '2026-11-30', tenantId: tenant });
    assert.equal(res.new_clients_acquired_count, 1);
    assert.equal(res.cac_brl, 4000.00);
  });

  it('UE-CAC-08: Despesas fora da janela são estritamente excluídas', () => {
    const engine = new UnitEconomicsEngine();
    const tenant = 'tenant-outside';

    engine.registerAcquisitionExpense({
      id: 'exp-past',
      tenant_id: tenant,
      category: 'MARKETING',
      description: 'Campanha de agosto (fora dos 30 dias de novembro)',
      amount_brl: 25000.00,
      currency: 'BRL',
      competence: '2026-08',
      payment_date: '2026-08-15',
      registered_by: 'user',
      validation_status: 'validated',
      is_shared: false,
      created_at: '2026-08-15T00:00:00.000Z'
    });
    engine.recordCustomerAcquisition({
      id: 'ev-nov',
      client_id: 'client-nov',
      tenant_id: tenant,
      acquisition_date: '2026-11-10',
      created_at: '2026-11-10T00:00:00.000Z'
    });

    const res = engine.calculateRealCac({ windowDays: 30, referenceDate: '2026-11-30', tenantId: tenant });
    assert.equal(res.total_eligible_spend_brl, 0);
    assert.equal(res.cac_brl, null);
  });

  it('UE-CAC-09: Despesas de outro tenant são excluídas (isolamento multi-tenant)', () => {
    const engine = new UnitEconomicsEngine();

    engine.registerAcquisitionExpense({
      id: 'exp-tenant-B',
      tenant_id: 'tenant-B',
      category: 'MARKETING',
      description: 'Despesa do Tenant B',
      amount_brl: 50000.00,
      currency: 'BRL',
      competence: '2026-11',
      payment_date: '2026-11-10',
      registered_by: 'user_b',
      validation_status: 'validated',
      is_shared: false,
      created_at: '2026-11-10T00:00:00.000Z'
    });
    engine.recordCustomerAcquisition({
      id: 'ev-tenant-A',
      client_id: 'client-A-user',
      tenant_id: 'tenant-A',
      acquisition_date: '2026-11-10',
      created_at: '2026-11-10T00:00:00.000Z'
    });

    const resA = engine.calculateRealCac({ windowDays: 30, referenceDate: '2026-11-30', tenantId: 'tenant-A' });
    assert.equal(resA.total_eligible_spend_brl, 0, 'Tenant A não pode ver despesas do Tenant B');
    assert.equal(resA.cac_brl, null);
  });

  it('UE-CAC-10: Alteração de lançamento com preservação do histórico de auditoria', () => {
    const engine = new UnitEconomicsEngine();
    const exp: AcquisitionExpenseModel = {
      id: 'exp-audit-trail',
      tenant_id: 'tenant-01',
      category: 'ADVERTISING',
      description: 'Outdoor Rodovia Solar',
      amount_brl: 8000.00,
      currency: 'BRL',
      competence: '2026-11',
      payment_date: '2026-11-01',
      registered_by: 'analyst@energy.com',
      validation_status: 'pending',
      is_shared: false,
      created_at: '2026-11-01T00:00:00.000Z'
    };
    engine.registerAcquisitionExpense(exp);

    // Ajuste de valor de R$ 8.000 para R$ 8.500 após nota complementar
    const updated = engine.updateAcquisitionExpenseAmount(
      exp.id,
      8500.00,
      'manager@energy.com',
      'Ajuste conforme NF complementar de veiculação'
    );

    assert.equal(updated.amount_brl, 8500.00);
    assert.ok(updated.history && updated.history.length === 1);
    const hist0 = updated.history[0];
    assert.ok(hist0);
    assert.equal(hist0.previous_amount_brl, 8000.00);
    assert.equal(hist0.new_amount_brl, 8500.00);
    assert.equal(hist0.changed_by, 'manager@energy.com');
  });

  // ============================================================================
  // MÓDULO B: TESTES DE CUSTOS OPERACIONAIS (COGS)
  // ============================================================================

  it('UE-OP-01: Registro e consulta de despesa de onboarding vinculada a cliente', () => {
    const engine = new UnitEconomicsEngine();
    const opExp: OperationalExpenseModel = {
      id: 'cogs-onboarding-01',
      tenant_id: 'tenant-01',
      client_id: 'client-ind-1',
      category: 'ONBOARDING',
      description: 'Instalação física de medidor IoT e integração com distribuidora',
      amount_brl: 1200.00,
      currency: 'BRL',
      competence: '2026-11',
      payment_date: '2026-11-05',
      document_reference: 'OS-TECH-100',
      registered_by: 'field_tech@energy.com',
      validation_status: 'validated',
      is_shared: false,
      created_at: '2026-11-05T00:00:00.000Z'
    };

    engine.registerOperationalExpense(opExp);
    const clientExpenses = engine.getOperationalExpensesByClient('client-ind-1');

    assert.equal(clientExpenses.length, 1);
    assert.ok(clientExpenses[0]);
    assert.equal(clientExpenses[0].category, 'ONBOARDING');
    assert.equal(clientExpenses[0].amount_brl, 1200.00);
  });

  it('UE-OP-02: Registro e consulta de suporte mensal por cliente e competência', () => {
    const engine = new UnitEconomicsEngine();
    engine.registerOperationalExpense({
      id: 'cogs-support-nov',
      tenant_id: 'tenant-01',
      client_id: 'client-ind-1',
      category: 'CUSTOMER_SUPPORT',
      description: 'Suporte técnico regulatório ANEEL',
      amount_brl: 400.00,
      currency: 'BRL',
      competence: '2026-11',
      payment_date: '2026-11-28',
      registered_by: 'cs@energy.com',
      validation_status: 'validated',
      is_shared: false,
      created_at: '2026-11-28T00:00:00.000Z'
    });

    const expNov = engine.getOperationalExpensesByClient('client-ind-1', '2026-11');
    const expDez = engine.getOperationalExpensesByClient('client-ind-1', '2026-12');

    assert.equal(expNov.length, 1);
    assert.ok(expNov[0]);
    assert.equal(expNov[0].amount_brl, 400.00);
    assert.equal(expDez.length, 0);
  });

  // ============================================================================
  // MÓDULO D: TESTES DE LTV REAL
  // ============================================================================

  it('UE-LTV-01: LTV com margem real e taxa de churn observada calcula valor sustentável', () => {
    const engine = new UnitEconomicsEngine();

    // Margem real de R$ 4.000/mês, churn mensal observado de 2% (0.02) -> vida útil média 50 meses
    const ltvRes = engine.calculateRealLtv({
      clientId: 'client-ind-1',
      monthlyContributionMarginBrl: 4000.00,
      historicalMonthsCount: 12, // 12 meses de histórico
      observedChurnRateMonthly: 0.02
    });

    assert.equal(ltvRes.estimated_lifespan_months, 50); // 1 / 0.02 = 50 meses
    // LTV = R$ 4.000 * 50 = R$ 200.000,00
    assert.equal(ltvRes.ltv_brl, 200000.00);
    assert.equal(ltvRes.status, 'measured');
  });

  it('UE-LTV-02: LTV com histórico insuficiente (< 3 meses) retorna incomplete', () => {
    const engine = new UnitEconomicsEngine();

    const ltvRes = engine.calculateRealLtv({
      clientId: 'client-new',
      monthlyContributionMarginBrl: 5000.00,
      historicalMonthsCount: 2, // Apenas 2 meses
      observedChurnRateMonthly: 0.02
    });

    assert.equal(ltvRes.ltv_brl, null);
    assert.equal(ltvRes.status, 'incomplete');
    assert.ok(ltvRes.limitation_notes[0]);
    assert.match(ltvRes.limitation_notes[0], /Base histórica insuficiente \(2 meses registrados; mínimo exigido: 3 meses\)/);
  });

  it('UE-LTV-03: LTV com margem negativa ou nula retorna incomplete sem inventar LTV positivo', () => {
    const engine = new UnitEconomicsEngine();

    const ltvRes = engine.calculateRealLtv({
      clientId: 'client-loss',
      monthlyContributionMarginBrl: -200.00, // Margem negativa
      historicalMonthsCount: 6,
      observedChurnRateMonthly: 0.05
    });

    assert.equal(ltvRes.ltv_brl, null);
    assert.equal(ltvRes.status, 'incomplete');
    assert.ok(ltvRes.limitation_notes[0]);
    assert.match(ltvRes.limitation_notes[0], /Margem de contribuição mensal nula, negativa ou ausente/);
  });

  // ============================================================================
  // MÓDULO E: TESTES DE PAYBACK REAL
  // ============================================================================

  it('UE-PAY-01: Payback com CAC e margem de contribuição válidos apura tempo exato de recuperação', () => {
    const engine = new UnitEconomicsEngine();

    // CAC de R$ 6.000 com margem de contribuição mensal de R$ 2.000
    const payRes = engine.calculateRealPayback({
      cacBrl: 6000.00,
      monthlyContributionMarginBrl: 2000.00,
      clientId: 'client-ind-1'
    });

    // Payback = 6000 / 2000 = 3 meses
    assert.equal(payRes.payback_months, 3);
    assert.equal(payRes.status, 'measured');
  });

  it('UE-PAY-02: Payback com margem nula ou negativa retorna incomplete com rationale auditável', () => {
    const engine = new UnitEconomicsEngine();

    const payRes = engine.calculateRealPayback({
      cacBrl: 5000.00,
      monthlyContributionMarginBrl: 0.00, // Margem zero
      clientId: 'client-ind-zero'
    });

    assert.equal(payRes.payback_months, null);
    assert.equal(payRes.status, 'incomplete');
    assert.ok(payRes.limitation_notes[0]);
    assert.match(payRes.limitation_notes[0], /Payback infinito/);
  });

  // ============================================================================
  // SEGURANÇA E ISOLAMENTO MULTI-TENANT
  // ============================================================================

  it('UE-SEC-01: Isolamento multi-tenant impede que despesas e clientes de Tenant A contaminem Tenant B', () => {
    const engine = new UnitEconomicsEngine();

    // Tenant A
    engine.registerAcquisitionExpense({
      id: 'exp-A',
      tenant_id: 'Tenant-A',
      category: 'SALES',
      description: 'Consultor Comercial A',
      amount_brl: 10000.00,
      currency: 'BRL',
      competence: '2026-11',
      payment_date: '2026-11-10',
      registered_by: 'admin_a',
      validation_status: 'validated',
      is_shared: false,
      created_at: '2026-11-10T00:00:00.000Z'
    });
    engine.recordCustomerAcquisition({
      id: 'ev-A',
      client_id: 'client-A-1',
      tenant_id: 'Tenant-A',
      acquisition_date: '2026-11-15',
      created_at: '2026-11-15T00:00:00.000Z'
    });

    // Tenant B
    engine.registerAcquisitionExpense({
      id: 'exp-B',
      tenant_id: 'Tenant-B',
      category: 'SALES',
      description: 'Consultor Comercial B',
      amount_brl: 30000.00,
      currency: 'BRL',
      competence: '2026-11',
      payment_date: '2026-11-10',
      registered_by: 'admin_b',
      validation_status: 'validated',
      is_shared: false,
      created_at: '2026-11-10T00:00:00.000Z'
    });
    engine.recordCustomerAcquisition({
      id: 'ev-B',
      client_id: 'client-B-1',
      tenant_id: 'Tenant-B',
      acquisition_date: '2026-11-15',
      created_at: '2026-11-15T00:00:00.000Z'
    });

    const cacA = engine.calculateRealCac({ windowDays: 30, referenceDate: '2026-11-30', tenantId: 'Tenant-A' });
    const cacB = engine.calculateRealCac({ windowDays: 30, referenceDate: '2026-11-30', tenantId: 'Tenant-B' });

    assert.equal(cacA.cac_brl, 10000.00);
    assert.equal(cacB.cac_brl, 30000.00);
    assert.notEqual(cacA.cac_brl, cacB.cac_brl);
  });

});
