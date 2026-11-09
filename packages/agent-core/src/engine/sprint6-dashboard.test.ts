// ==============================================================================
// SPRINT 6 TEST SUITE: S6-05 OBSERVABILITY LEDGER DASHBOARD
// Scenarios DASH-01 through DASH-06
// ==============================================================================

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { ObservabilityDashboardService } from '../tools/observability-dashboard-service.js';
import { FinopsLedgerEngine } from '../tools/finops-ledger-engine.js';
import { RevenuePipelineEngine } from '../tools/revenue-pipeline-engine.js';
import { UnitEconomicsEngine } from '../tools/unit-economics-engine.js';
import { ClientContractModel } from '@ei-aios/shared';

describe('Sprint 6 — S6-05 Observability Ledger Dashboard (DASH-01 a DASH-06)', () => {

  // ----------------------------------------------------------------------------
  // DASH-01: Executive Overview consolida receitas e margem sem MRR fictício
  // ----------------------------------------------------------------------------
  it('DASH-01: Executive Overview consolida receitas faturadas e recebidas e elimina fallback de 1490', () => {
    const ledger = new FinopsLedgerEngine();
    const revenue = new RevenuePipelineEngine();
    const unitEcon = new UnitEconomicsEngine();
    const service = new ObservabilityDashboardService({
      ledgerEngine: ledger,
      revenueEngine: revenue,
      unitEconomicsEngine: unitEcon
    });

    const clientId = 'client-solar-corp';
    const contract: ClientContractModel = {
      id: 'ctr-dash-01',
      client_id: clientId,
      contract_number: 'CTR-DASH-2026',
      start_date: '2026-01-01',
      end_date: null,
      monthly_recurring_value_brl: 8500.00,
      has_success_fee: false,
      success_fee_percent: null,
      success_fee_clause: null,
      adjustment_index: 'IPCA',
      adjustment_periodicity_months: 12,
      status: 'active',
      created_at: '2026-01-01T00:00:00.000Z'
    };
    revenue.registerContract(contract);

    // Emite fatura de R$ 8.500 na competência 2026-11 e liquida R$ 5.000 (parcial)
    const inv = revenue.generateMonthlyInvoice(contract.id, '2026-11');
    revenue.registerReceipt(inv.id, {
      amount: 5000.00,
      date: '2026-11-15',
      transactionReference: 'TED-DASH-5000'
    });

    // Registra 1 execução de IA de US$ 0.0105 (~R$ 0,06)
    ledger.reconcileRuns([
      {
        id: 'run-dash-1',
        agent_id: 'AG-003',
        client_id: clientId,
        model_name: 'gemini-3.5-flash-lite',
        input_tokens: 100_000,
        output_tokens: 10_000,
        status: 'success'
      }
    ]);

    const overview = service.getExecutiveOverview({ competence: '2026-11' });

    assert.equal(overview.revenue.contracted_mrr_brl, 8500.00, 'MRR contratado deve ser o valor real do contrato');
    assert.equal(overview.revenue.total_invoiced_brl, 8500.00);
    assert.equal(overview.revenue.total_received_brl, 5000.00);
    assert.equal(overview.revenue.outstanding_invoiced_brl, 3500.00);
    assert.equal(overview.revenue.reliability, 'measured');
    assert.ok(overview.profitability.margin_on_invoiced_brl > 8400.00);
  });

  // ----------------------------------------------------------------------------
  // DASH-02: Alertas de governança identificam custos não atribuídos e incompletos
  // ----------------------------------------------------------------------------
  it('DASH-02: Governança detecta execuções incompletas e custos internos/não atribuídos', () => {
    const ledger = new FinopsLedgerEngine();
    const service = new ObservabilityDashboardService({ ledgerEngine: ledger });

    // Injeta run sem tokens (incomplete) e run interno (platform_internal)
    ledger.reconcileRuns([
      {
        id: 'run-incomplete',
        agent_id: 'AG-001',
        model_name: 'gemini-3.5-flash-lite',
        input_tokens: null,
        output_tokens: null,
        status: 'failed'
      },
      {
        id: 'run-unattrib-legacy',
        agent_id: 'AG-012',
        client_id: null,
        model_name: 'gemini-3.8-flash',
        input_tokens: 50_000,
        output_tokens: 10_000,
        status: 'success'
      }
    ]);

    const overview = service.getExecutiveOverview();
    assert.equal(overview.governance.incomplete_runs_count, 1);
    assert.ok(overview.governance.unattributed_costs_usd > 0);
    assert.ok(overview.governance.alerts.length >= 2);
    assert.ok(overview.governance.alerts.some(a => a.includes('não atribuídos a clientes')));
    assert.ok(overview.governance.alerts.some(a => a.includes('dados incompletos')));
  });

  // ----------------------------------------------------------------------------
  // DASH-03: Detalhamento de Custos de IA por agente, modelo e cliente
  // ----------------------------------------------------------------------------
  it('DASH-03: getCostAndUsageDetails calcula breakdown por agente, modelo e cliente', () => {
    const ledger = new FinopsLedgerEngine();
    const service = new ObservabilityDashboardService({ ledgerEngine: ledger });

    const clientA = 'client-alpha';
    const clientB = 'client-beta';

    ledger.reconcileRuns([
      {
        id: 'r1',
        agent_id: 'AG-003',
        client_id: clientA,
        model_name: 'gemini-3.5-flash-lite',
        input_tokens: 10_000,
        output_tokens: 2_000,
        status: 'success'
      },
      {
        id: 'r2',
        agent_id: 'AG-004',
        client_id: clientB,
        model_name: 'gemini-4-argon',
        input_tokens: 10_000,
        output_tokens: 2_000,
        status: 'success'
      }
    ]);

    const details = service.getCostAndUsageDetails();
    assert.equal(details.summary.total_runs, 2);
    assert.ok(details.breakdown_by_client[clientA]);
    assert.ok(details.breakdown_by_client[clientB]);
    assert.ok(details.breakdown_by_agent['AG-003']);
    assert.ok(details.breakdown_by_agent['AG-004']);
    assert.ok(details.breakdown_by_model['gemini-3.5-flash-lite']);
    assert.ok(details.breakdown_by_model['gemini-4-argon']);
  });

  // ----------------------------------------------------------------------------
  // DASH-04: Filtros de pesquisa por agente e modelo no Ledger analítico
  // ----------------------------------------------------------------------------
  it('DASH-04: Filtros de pesquisa por agente e modelo restringem os registros retornados', () => {
    const ledger = new FinopsLedgerEngine();
    const service = new ObservabilityDashboardService({ ledgerEngine: ledger });

    ledger.reconcileRuns([
      { id: 'f1', agent_id: 'AG-003', model_name: 'gemini-3.8-flash', input_tokens: 1000, output_tokens: 500, status: 'success' },
      { id: 'f2', agent_id: 'AG-009', model_name: 'gemini-3.5-flash-lite', input_tokens: 1000, output_tokens: 500, status: 'success' },
      { id: 'f3', agent_id: 'AG-003', model_name: 'gemini-3.5-flash-lite', input_tokens: 1000, output_tokens: 500, status: 'success' }
    ]);

    const onlyAg003 = service.getCostAndUsageDetails({ agentId: 'AG-003' });
    assert.equal(onlyAg003.summary.total_runs, 2);

    const onlyFlashLite = service.getCostAndUsageDetails({ modelName: 'flash-lite' });
    assert.equal(onlyFlashLite.summary.total_runs, 2);

    const combinedFilter = service.getCostAndUsageDetails({ agentId: 'AG-003', modelName: 'flash-lite' });
    assert.equal(combinedFilter.summary.total_runs, 1);
    assert.equal(combinedFilter.entries[0].id.length > 0, true);
  });

  // ----------------------------------------------------------------------------
  // DASH-05: Status de confiabilidade explícitos exibidos por indicador
  // ----------------------------------------------------------------------------
  it('DASH-05: Status de confiabilidade diferencia claramente measured de estimated e incomplete', () => {
    const service = new ObservabilityDashboardService();
    // Base vazia sem contratos
    const emptyOverview = service.getExecutiveOverview();
    assert.equal(emptyOverview.revenue.reliability, 'measured');
    assert.equal(emptyOverview.unit_economics.status, 'incomplete');
  });

  // ----------------------------------------------------------------------------
  // DASH-06: Isolamento multi-tenant no Executive Overview
  // ----------------------------------------------------------------------------
  it('DASH-06: Despesas de CAC e clientes de Tenant A não contaminam Overview de Tenant B', () => {
    const unitEcon = new UnitEconomicsEngine();
    const service = new ObservabilityDashboardService({ unitEconomicsEngine: unitEcon });

    unitEcon.registerAcquisitionExpense({
      id: 'acq-tenant-X',
      tenant_id: 'Tenant-X',
      category: 'MARKETING',
      description: 'Campanha de Marketing Tenant X',
      amount_brl: 20000.00,
      currency: 'BRL',
      competence: '2026-11',
      payment_date: '2026-11-10',
      registered_by: 'admin_x',
      validation_status: 'validated',
      is_shared: false,
      created_at: '2026-11-10T00:00:00.000Z'
    });
    unitEcon.recordCustomerAcquisition({
      id: 'ev-tenant-X',
      client_id: 'client-X-1',
      tenant_id: 'Tenant-X',
      acquisition_date: '2026-11-12',
      created_at: '2026-11-12T00:00:00.000Z'
    });

    // Consulta para Tenant Y (que não teve gastos nem clientes)
    const overviewY = service.getExecutiveOverview({ tenantId: 'Tenant-Y', competence: '2026-11' });
    assert.equal(overviewY.costs.acquisition_sm_brl, 0);
    assert.equal(overviewY.unit_economics.cac_30d_brl, null);

    // Consulta para Tenant X
    const overviewX = service.getExecutiveOverview({ tenantId: 'Tenant-X', competence: '2026-11' });
    assert.equal(overviewX.costs.acquisition_sm_brl, 20000.00);
    assert.equal(overviewX.unit_economics.cac_30d_brl, 20000.00);
  });

});
