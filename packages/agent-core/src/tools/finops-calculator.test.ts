// ==============================================================================
// UNIT TESTS: AG-011 CFO DIGITAL & FINOPS CALCULATOR (CFO-001 a CFO-010)
// Sprint 2 - BKL-006 & BKL-007
// ==============================================================================

import test from 'node:test';
import assert from 'node:assert/strict';
import {
  calculateMrrAndArr,
  calculateCac,
  calculateLtvAndPayback,
  calculateClientGrossMargin,
  reconcileAgentRunsFinOps,
  simulatePricingScenarios,
  runFullCfoSnapshot
} from './finops-calculator.js';
import { DEFAULT_AGENT_REGISTRY } from '../agents/registry.js';
import { AgentId, CFODeliverableSchema } from '@ei-aios/shared';

test('CFO-001: MRR and ARR calculation excludes setup fee and variable success fee', () => {
  const result = calculateMrrAndArr([
    {
      clientId: 'c1',
      companyName: 'Supermercados BomPreço',
      isActive: true,
      mrrBrl: 1500,
      setupFeeBrl: 3000,
      successFeePercent: 20,
      verifiedMonthlySavingsBrl: 5000,
      consumerUnitsCount: 3
    },
    {
      clientId: 'c2',
      companyName: 'Metalúrgica Vale Sul',
      isActive: true,
      mrrBrl: 2500,
      setupFeeBrl: 4500,
      successFeePercent: 20,
      verifiedMonthlySavingsBrl: 8000,
      consumerUnitsCount: 2
    },
    {
      clientId: 'c3-churned',
      companyName: 'Cliente Inativo',
      isActive: false,
      mrrBrl: 1900
    }
  ]);

  // MRR deve somar apenas 1500 + 2500 = 4000 (excluindo inativo, setupFee e successFee)
  assert.equal(result.mrr_brl, 4000);
  assert.equal(result.arr_brl, 48000);
  assert.equal(result.arpa_brl, 2000);
  assert.equal(result.revenue_per_uc_brl, 800); // 4000 / 5 UCs
  assert.equal(result.excluded_non_recurring_setup_brl, 7500);
  assert.equal(result.excluded_variable_success_fee_brl, 2600);
  assert.equal(result.metrics[0]?.status, 'verified');
});

test('CFO-002: CAC calculation with explicit attribution window and attributable costs', () => {
  const cac = calculateCac({
    marketingAndSalesSpendBrl: 12000,
    newClientsAcquired: 4,
    attributionWindowDays: 90
  });

  assert.equal(cac.cac_brl, 3000);
  assert.equal(cac.attribution_window_days, 90);
  assert.equal(cac.status, 'verified');
  assert.ok(cac.metric.formula.includes('Janela: 90 dias'));
});

test('CFO-003: LTV declares explicit assumptions and small-sample limitations', () => {
  const res = calculateLtvAndPayback({
    arpaBrl: 2000,
    grossMarginRatio: 0.8, // R$ 1.600 de contribuição mensal
    monthlyChurnRate: 0.04, // 4% a.m. -> 25 meses
    cacBrl: 3200,
    sampleSize: 3 // Amostra < 10 clientes
  });

  assert.equal(res.monthly_contribution_margin_brl, 1600);
  assert.equal(res.ltv_brl, 40000); // 1600 / 0.04
  assert.equal(res.status, 'estimated'); // Amostra pequena exige status 'estimated'
  assert.ok(res.limitations.some((l) => l.includes('Amostra reduzida')));
});

test('CFO-004: Payback identifies contribution margin base accurately', () => {
  const res = calculateLtvAndPayback({
    arpaBrl: 2000,
    grossMarginRatio: 0.8, // R$ 1.600/mês
    monthlyChurnRate: 0.025,
    cacBrl: 4800,
    sampleSize: 12
  });

  // Payback = 4800 / 1600 = 3 meses
  assert.equal(res.payback_months, 3);
  assert.equal(res.status, 'verified');
});

test('CFO-005: Gross margin per client accounts for direct support and AI token costs', () => {
  const margin = calculateClientGrossMargin(
    {
      clientId: 'c1',
      companyName: 'Frigorífico Sul',
      isActive: true,
      mrrBrl: 1500,
      successFeePercent: 20,
      verifiedMonthlySavingsBrl: 2500, // Success fee verificado = R$ 500
      directMonthlySupportCostBrl: 200
    },
    [
      {
        id: 'r1',
        agent_id: 'AG-003',
        client_id: 'c1',
        model_name: 'gemini-3.8-flash',
        cost_estimate: 10.0, // US$ 10.00 * 5.80 = R$ 58.00
        status: 'success'
      }
    ],
    5.8
  );

  // Receita elegível = 1500 + 500 = 2000
  // Custos diretos = 200 + 58 = 258
  // Margem Bruta = 2000 - 258 = 1742 (87.1%)
  assert.equal(margin.eligible_total_revenue_brl, 2000);
  assert.equal(margin.ai_cost_brl, 58);
  assert.equal(margin.total_direct_cost_brl, 258);
  assert.equal(margin.gross_margin_brl, 1742);
  assert.equal(margin.gross_margin_percent, 87.1);
  assert.equal(margin.is_negative_margin, false);
});

test('CFO-006: AI costs reconciliation with agent_runs detects unlinked and zero-cost runs', () => {
  const rec = reconcileAgentRunsFinOps(
    [
      {
        id: 'run-1',
        agent_id: 'AG-001',
        task_id: 'task-1',
        model_name: 'gemini-3.8-flash',
        input_tokens: 1000,
        output_tokens: 500,
        cost_estimate: 0.0045,
        status: 'success'
      },
      {
        id: 'run-2',
        agent_id: 'AG-012',
        task_id: null, // sem task_id vinculado
        model_name: 'gemini-3.5-flash-lite',
        input_tokens: 400,
        output_tokens: 200,
        cost_estimate: 0, // sem custo apurado
        status: 'success'
      }
    ],
    5.8
  );

  assert.equal(rec.total_runs_count, 2);
  assert.equal(rec.total_input_tokens, 1400);
  assert.equal(rec.total_output_tokens, 700);
  assert.equal(rec.total_cost_usd, 0.0045);
  assert.equal(rec.runs_without_cost_count, 1);
  assert.equal(rec.unlinked_runs_count, 1);
});

test('CFO-007: Success fee only recognizes verified M&V savings and blocks unverified estimates', () => {
  const margin = calculateClientGrossMargin(
    {
      clientId: 'c2',
      companyName: 'Rede Atacadista Norte',
      isActive: true,
      mrrBrl: 1490,
      successFeePercent: 20,
      verifiedMonthlySavingsBrl: 0, // Ainda sem M&V homologado
      unverifiedEstimatedSavingsBrl: 10000 // R$ 10.000 apenas estimado no diagnóstico
    },
    [],
    5.8
  );

  assert.equal(margin.verified_success_fee_brl, 0);
  assert.equal(margin.blocked_unverified_success_fee_brl, 2000);
  assert.equal(margin.eligible_total_revenue_brl, 1490);
});

test('CFO-008: Pricing scenarios simulate Conservador, Base, and Otimista models', () => {
  const scenarios = simulatePricingScenarios({
    baseMrrPerClientBrl: 1490,
    baseSetupFeeBrl: 2500,
    baseVerifiedSavingsPerClientBrl: 4000,
    successFeePercent: 20
  });

  assert.equal(scenarios.length, 3);
  assert.deepEqual(
    scenarios.map((s) => s.scenario_name),
    ['Conservador', 'Base', 'Otimista']
  );
  assert.ok(scenarios[2]!.monthly_total_revenue_brl > scenarios[1]!.monthly_total_revenue_brl);
  assert.ok(scenarios[1]!.monthly_total_revenue_brl > scenarios[0]!.monthly_total_revenue_brl);
});

test('CFO-009: Incomplete data returns status incomplete/null without inventing financial values', () => {
  const cacMissing = calculateCac({
    marketingAndSalesSpendBrl: null,
    newClientsAcquired: 0
  });

  assert.equal(cacMissing.cac_brl, null);
  assert.equal(cacMissing.status, 'incomplete');
  assert.equal(cacMissing.metric.value, null);
});

test('CFO-010: AG-011 permissions & full snapshot schema compliance (No unauthorized financial mutations)', () => {
  const ag011 = DEFAULT_AGENT_REGISTRY[AgentId.AG_011];

  // AG-011 não pode assumir compromissos financeiros externos nem publicar externamente sem gate humano
  assert.equal(ag011.permissions.financial_commitment, false);
  assert.equal(ag011.permissions.external_publish, false);
  assert.ok(ag011.tools.includes('finops-calculator'));

  const snapshot = runFullCfoSnapshot({
    contracts: [
      {
        clientId: 'client-pilot-01',
        companyName: 'Supermercados BomPreço Ltda',
        isActive: true,
        mrrBrl: 1490,
        setupFeeBrl: 2500,
        successFeePercent: 20,
        verifiedMonthlySavingsBrl: 3800,
        unverifiedEstimatedSavingsBrl: 1200,
        directMonthlySupportCostBrl: 180,
        consumerUnitsCount: 2
      }
    ],
    agentRuns: [
      {
        id: 'run-101',
        agent_id: 'AG-003',
        task_id: 'task-101',
        client_id: 'client-pilot-01',
        model_name: 'gemini-3.8-flash',
        input_tokens: 1500,
        output_tokens: 600,
        cost_estimate: 0.0062,
        status: 'success'
      }
    ]
  });

  const parsed = CFODeliverableSchema.safeParse(snapshot.cfo_deliverable);
  assert.equal(parsed.success, true);
  assert.equal(snapshot.cfo_deliverable.approval_required, false);
});
