// ==============================================================================
// DETERMINISTIC FINOPS & UNIT ECONOMICS CALCULATOR (AG-011 CFO DIGITAL)
// Sprint 2 - BKL-006 & BKL-007 (Sem LLM - Matemática Financeira Auditável)
// ==============================================================================

import { CFODeliverableSchema } from '@ei-aios/shared';
export * from './finops-ledger-engine.js';

export type CFOMetricStatus = 'verified' | 'estimated' | 'incomplete' | 'not_available';

export interface CFOMetricItem {
  name: string;
  value: number | null;
  unit: string;
  formula: string;
  source_refs: string[];
  status: CFOMetricStatus;
}

export interface ClientFinancialContractInput {
  clientId: string;
  companyName: string;
  isActive: boolean;
  /** Mensalidade SaaS recorrente contratada (BRL/mês) */
  mrrBrl: number;
  /** Sinaliza se o MRR estava nulo/ausente no banco de dados (CFO-009) */
  isMrrMissing?: boolean;
  /** Taxa de implantação one-off (NÃO compõe MRR recorrente - CFO-001) */
  setupFeeBrl?: number;
  /** Percentual de Success Fee contratual (ex: 20%) */
  successFeePercent?: number;
  /** Economia mensal verificada por protocolo M&V (AG-010) */
  verifiedMonthlySavingsBrl?: number;
  /** Economia potencial apenas estimada (NÃO elegível para cobrança de Success Fee - CFO-007) */
  unverifiedEstimatedSavingsBrl?: number;
  /** Custos diretos de suporte/operação/M&V do cliente no mês (BRL) */
  directMonthlySupportCostBrl?: number;
  /** Quantidade de Unidades Consumidoras (UCs) ativas do cliente */
  consumerUnitsCount?: number;
}

export interface AgentRunRecordInput {
  id: string;
  agent_id: string;
  task_id?: string | null;
  client_id?: string | null;
  consumer_unit_id?: string | null;
  execution_id?: string | null;
  is_internal?: boolean;
  model_name: string;
  input_tokens?: number | null;
  output_tokens?: number | null;
  cost_estimate?: number | null;
  execution_time_ms?: number | null;
  status: string;
  created_at?: string;
  metadata?: Record<string, any>;
}

export interface MrrArrResult {
  mrr_brl: number;
  arr_brl: number;
  arpa_brl: number;
  revenue_per_uc_brl: number;
  excluded_non_recurring_setup_brl: number;
  excluded_variable_success_fee_brl: number;
  active_clients_count: number;
  active_ucs_count: number;
  top_client_revenue_share_percent: number;
  metrics: CFOMetricItem[];
}

export interface CacCalculationResult {
  cac_brl: number | null;
  total_acquisition_spend_brl: number;
  new_clients_acquired: number;
  attribution_window_days: number;
  status: CFOMetricStatus;
  metric: CFOMetricItem;
}

export interface LtvPaybackResult {
  ltv_brl: number | null;
  payback_months: number | null;
  monthly_contribution_margin_brl: number;
  status: CFOMetricStatus;
  limitations: string[];
  metrics: CFOMetricItem[];
}

export interface ClientGrossMarginResult {
  client_id: string;
  company_name: string;
  recurring_mrr_brl: number;
  verified_success_fee_brl: number;
  blocked_unverified_success_fee_brl: number;
  eligible_total_revenue_brl: number;
  direct_support_cost_brl: number;
  ai_cost_usd: number;
  ai_cost_brl: number;
  total_direct_cost_brl: number;
  gross_margin_brl: number;
  gross_margin_percent: number;
  is_negative_margin: boolean;
  metric: CFOMetricItem;
}

export interface AgentRunsReconciliationResult {
  total_runs_count: number;
  total_input_tokens: number;
  total_output_tokens: number;
  total_cost_usd: number;
  total_cost_brl: number;
  client_attributed_runs_count: number;
  client_attributed_cost_usd: number;
  internal_platform_runs_count: number;
  internal_platform_cost_usd: number;
  runs_without_cost_count: number;
  unlinked_runs_count: number;
  cost_by_agent_usd: Record<string, number>;
  metrics: CFOMetricItem[];
}

export interface PricingScenarioResult {
  scenario_name: 'Conservador' | 'Base' | 'Otimista';
  active_clients: number;
  mrr_per_client_brl: number;
  setup_fee_brl: number;
  avg_verified_monthly_savings_brl: number;
  success_fee_percent: number;
  monthly_recurring_revenue_brl: number;
  monthly_success_fee_revenue_brl: number;
  monthly_total_revenue_brl: number;
  estimated_gross_margin_percent: number;
}

const round2 = (n: number): number => Math.round(n * 100) / 100;
const round4 = (n: number): number => Math.round(n * 10000) / 10000;

/**
 * CFO-001: Calcula MRR, ARR, ARPA e Receita por UC, excluindo estritamente
 * taxas de implantação (setup_fee) e receitas variáveis (success_fee) do MRR recorrente.
 */
export function calculateMrrAndArr(contracts: ClientFinancialContractInput[]): MrrArrResult {
  const activeContracts = contracts.filter((c) => c.isActive);
  const activeCount = activeContracts.length;

  let mrrBrl = 0;
  let excludedSetupBrl = 0;
  let excludedSuccessFeeBrl = 0;
  let totalUcs = 0;
  let maxClientMrr = 0;

  for (const c of activeContracts) {
    const clientMrr = Math.max(0, Number(c.mrrBrl || 0));
    mrrBrl += clientMrr;
    if (clientMrr > maxClientMrr) maxClientMrr = clientMrr;

    excludedSetupBrl += Math.max(0, Number(c.setupFeeBrl || 0));
    const verifiedSavings = Math.max(0, Number(c.verifiedMonthlySavingsBrl || 0));
    const sfPct = Math.max(0, Number(c.successFeePercent || 0));
    excludedSuccessFeeBrl += verifiedSavings * (sfPct / 100);
    totalUcs += Math.max(1, Number(c.consumerUnitsCount || 1));
  }

  mrrBrl = round2(mrrBrl);
  const arrBrl = round2(mrrBrl * 12);
  const arpaBrl = activeCount > 0 ? round2(mrrBrl / activeCount) : 0;
  const revPerUcBrl = totalUcs > 0 ? round2(mrrBrl / totalUcs) : 0;
  const topSharePct = mrrBrl > 0 ? round2((maxClientMrr / mrrBrl) * 100) : 0;

  // CFO-009: Se não houver clientes ativos ou houver dados de MRR ausentes/não preenchidos, status é 'incomplete'
  const hasMissingMrr = activeContracts.some((c) => c.isMrrMissing || c.mrrBrl === null || c.mrrBrl === undefined);
  const status: CFOMetricStatus = activeCount > 0 && !hasMissingMrr ? 'verified' : 'incomplete';

  return {
    mrr_brl: mrrBrl,
    arr_brl: arrBrl,
    arpa_brl: arpaBrl,
    revenue_per_uc_brl: revPerUcBrl,
    excluded_non_recurring_setup_brl: round2(excludedSetupBrl),
    excluded_variable_success_fee_brl: round2(excludedSuccessFeeBrl),
    active_clients_count: activeCount,
    active_ucs_count: totalUcs,
    top_client_revenue_share_percent: topSharePct,
    metrics: [
      {
        name: 'mrr',
        value: mrrBrl,
        unit: 'BRL',
        formula: 'SUM(clients.mrr_brl WHERE is_active = true) [Exclui setup_fee e success_fee]',
        source_refs: ['table:clients'],
        status
      },
      {
        name: 'arr',
        value: arrBrl,
        unit: 'BRL',
        formula: 'MRR * 12',
        source_refs: ['table:clients'],
        status
      },
      {
        name: 'arpa',
        value: arpaBrl,
        unit: 'BRL',
        formula: 'MRR / active_clients_count',
        source_refs: ['table:clients'],
        status
      }
    ]
  };
}

/**
 * CFO-002 & CFO-009: Calcula o CAC (Custo de Aquisição de Cliente) com janela de atribuição explícita.
 * Caso não existam novos clientes ou custos informados, não inventa valores (retorna status 'incomplete').
 */
export function calculateCac(input: {
  marketingAndSalesSpendBrl?: number | null;
  newClientsAcquired?: number | null;
  attributionWindowDays?: number;
}): CacCalculationResult {
  const windowDays = input.attributionWindowDays || 90;
  const spend = input.marketingAndSalesSpendBrl;
  const newClients = input.newClientsAcquired;

  if (spend === undefined || spend === null || newClients === undefined || newClients === null || newClients <= 0) {
    return {
      cac_brl: null,
      total_acquisition_spend_brl: Number(spend || 0),
      new_clients_acquired: Number(newClients || 0),
      attribution_window_days: windowDays,
      status: 'incomplete',
      metric: {
        name: 'cac',
        value: null,
        unit: 'BRL',
        formula: `acquisition_spend_brl / new_clients_acquired (Janela: ${windowDays} dias)`,
        source_refs: ['table:clients', 'input:acquisition_spend'],
        status: 'incomplete'
      }
    };
  }

  const cac = round2(spend / newClients);
  return {
    cac_brl: cac,
    total_acquisition_spend_brl: round2(spend),
    new_clients_acquired: newClients,
    attribution_window_days: windowDays,
    status: 'verified',
    metric: {
      name: 'cac',
      value: cac,
      unit: 'BRL',
      formula: `acquisition_spend_brl (${round2(spend)}) / new_clients_acquired (${newClients}) [Janela: ${windowDays} dias]`,
      source_refs: ['table:clients', 'input:acquisition_spend'],
      status: 'verified'
    }
  };
}

/**
 * CFO-003 & CFO-004: Calcula LTV e Payback do CAC a partir da margem de contribuição mensal.
 * Declara explicitamente limitações estatísticas quando a amostra for pequena (< 10 clientes).
 */
export function calculateLtvAndPayback(input: {
  arpaBrl: number;
  grossMarginRatio: number; // ex.: 0.80 para 80%
  monthlyChurnRate: number; // ex.: 0.03 para 3% a.m.
  cacBrl: number | null;
  sampleSize: number;
}): LtvPaybackResult {
  const limitations: string[] = [];
  const marginRatio = Math.max(0, Math.min(1, input.grossMarginRatio));
  const monthlyContributionBrl = round2(input.arpaBrl * marginRatio);

  if (input.sampleSize < 10) {
    limitations.push(
      `Amostra reduzida (${input.sampleSize} cliente(s)): LTV e Payback classificados como 'estimated' até atingir maturidade histórica mínima (>= 10 contas).`
    );
  }

  // Evita divisão por zero em churn 0%: aplica piso prudencial de 2% a.m. (vida útil teto de 50 meses)
  const effectiveChurn = input.monthlyChurnRate > 0 ? input.monthlyChurnRate : 0.02;
  if (input.monthlyChurnRate <= 0) {
    limitations.push('Churn histórico igual a zero: adotado piso prudencial de 2,0% a.m. (50 meses de retenção teto) para evitar LTV infinito.');
  }

  const ltvBrl = monthlyContributionBrl > 0 ? round2(monthlyContributionBrl / effectiveChurn) : null;
  const paybackMonths =
    input.cacBrl !== null && input.cacBrl > 0 && monthlyContributionBrl > 0
      ? round2(input.cacBrl / monthlyContributionBrl)
      : null;

  const status: CFOMetricStatus =
    ltvBrl === null ? 'incomplete' : input.sampleSize >= 10 && input.monthlyChurnRate > 0 ? 'verified' : 'estimated';

  return {
    ltv_brl: ltvBrl,
    payback_months: paybackMonths,
    monthly_contribution_margin_brl: monthlyContributionBrl,
    status,
    limitations,
    metrics: [
      {
        name: 'ltv',
        value: ltvBrl,
        unit: 'BRL',
        formula: '(ARPA * gross_margin_ratio) / effective_monthly_churn_rate',
        source_refs: ['table:clients'],
        status
      },
      {
        name: 'cac_payback_months',
        value: paybackMonths,
        unit: 'months',
        formula: 'CAC / (ARPA * gross_margin_ratio)',
        source_refs: ['table:clients'],
        status: paybackMonths === null ? 'incomplete' : status
      }
    ]
  };
}

/**
 * CFO-005 & CFO-007: Calcula a Margem Bruta por Cliente considerando:
 * - Receita elegível = MRR recorrente + Success Fee APENAS sobre economia verificada (M&V).
 * - Economia não verificada é bloqueada da base de cálculo do Success Fee.
 * - Custos diretos = Suporte/operação mensal + Custo de IA (agent_runs) convertido para BRL.
 */
export function calculateClientGrossMargin(
  contract: ClientFinancialContractInput,
  clientRuns: AgentRunRecordInput[],
  usdToBrlRate = 5.8
): ClientGrossMarginResult {
  const recurringMrr = round2(Math.max(0, Number(contract.mrrBrl || 0)));
  const sfPct = Math.max(0, Math.min(100, Number(contract.successFeePercent || 0)));

  // CFO-007: Apenas economia verificada gera Success Fee elegível
  const verifiedSavings = Math.max(0, Number(contract.verifiedMonthlySavingsBrl || 0));
  const unverifiedSavings = Math.max(0, Number(contract.unverifiedEstimatedSavingsBrl || 0));

  const verifiedSuccessFeeBrl = round2(verifiedSavings * (sfPct / 100));
  const blockedUnverifiedSuccessFeeBrl = round2(unverifiedSavings * (sfPct / 100));

  const eligibleRevenueBrl = round2(recurringMrr + verifiedSuccessFeeBrl);

  const directSupportBrl = round2(Math.max(0, Number(contract.directMonthlySupportCostBrl || 0)));
  const aiCostUsd = round4(
    clientRuns.reduce((acc, r) => acc + Math.max(0, Number(r.cost_estimate || 0)), 0)
  );
  const aiCostBrl = round2(aiCostUsd * usdToBrlRate);

  const totalDirectCostBrl = round2(directSupportBrl + aiCostBrl);
  const grossMarginBrl = round2(eligibleRevenueBrl - totalDirectCostBrl);
  const grossMarginPercent =
    eligibleRevenueBrl > 0 ? round2((grossMarginBrl / eligibleRevenueBrl) * 100) : grossMarginBrl < 0 ? -100 : 0;

  return {
    client_id: contract.clientId,
    company_name: contract.companyName,
    recurring_mrr_brl: recurringMrr,
    verified_success_fee_brl: verifiedSuccessFeeBrl,
    blocked_unverified_success_fee_brl: blockedUnverifiedSuccessFeeBrl,
    eligible_total_revenue_brl: eligibleRevenueBrl,
    direct_support_cost_brl: directSupportBrl,
    ai_cost_usd: aiCostUsd,
    ai_cost_brl: aiCostBrl,
    total_direct_cost_brl: totalDirectCostBrl,
    gross_margin_brl: grossMarginBrl,
    gross_margin_percent: grossMarginPercent,
    is_negative_margin: grossMarginBrl < 0,
    metric: {
      name: `client_gross_margin:${contract.companyName}`,
      value: grossMarginBrl,
      unit: 'BRL',
      formula: '(mrr_brl + verified_success_fee_brl) - (direct_support_cost_brl + ai_cost_brl)',
      source_refs: ['table:clients', 'table:agent_runs', 'tool:mv-calculator'],
      status: 'verified'
    }
  };
}

/**
 * CFO-006: Concilia custos de IA e tokens na tabela `agent_runs`, identificando
 * execuções sem custo registrado ou desvinculadas de `task_id`.
 */
export function reconcileAgentRunsFinOps(
  runs: AgentRunRecordInput[],
  usdToBrlRate = 5.8
): AgentRunsReconciliationResult {
  let totalIn = 0;
  let totalOut = 0;
  let totalUsd = 0;
  let clientAttributedCount = 0;
  let clientAttributedUsd = 0;
  let internalPlatformCount = 0;
  let internalPlatformUsd = 0;
  let runsWithoutCost = 0;
  let unlinkedRuns = 0;
  const costByAgent: Record<string, number> = {};

  for (const r of runs) {
    const inTok = Math.max(0, Number(r.input_tokens || 0));
    const outTok = Math.max(0, Number(r.output_tokens || 0));
    const cost = Math.max(0, Number(r.cost_estimate || 0));

    totalIn += inTok;
    totalOut += outTok;
    totalUsd += cost;

    if (r.client_id) {
      clientAttributedCount++;
      clientAttributedUsd += cost;
    } else if (r.is_internal) {
      internalPlatformCount++;
      internalPlatformUsd += cost;
    }

    if (r.cost_estimate === null || r.cost_estimate === undefined || Number(r.cost_estimate) <= 0) {
      runsWithoutCost++;
    }
    if (!r.task_id) {
      unlinkedRuns++;
    }

    const ag = r.agent_id || 'UNKNOWN';
    costByAgent[ag] = round4((costByAgent[ag] || 0) + cost);
  }

  totalUsd = round4(totalUsd);
  const totalBrl = round2(totalUsd * usdToBrlRate);
  clientAttributedUsd = round4(clientAttributedUsd);
  internalPlatformUsd = round4(internalPlatformUsd);

  return {
    total_runs_count: runs.length,
    total_input_tokens: totalIn,
    total_output_tokens: totalOut,
    total_cost_usd: totalUsd,
    total_cost_brl: totalBrl,
    client_attributed_runs_count: clientAttributedCount,
    client_attributed_cost_usd: clientAttributedUsd,
    internal_platform_runs_count: internalPlatformCount,
    internal_platform_cost_usd: internalPlatformUsd,
    runs_without_cost_count: runsWithoutCost,
    unlinked_runs_count: unlinkedRuns,
    cost_by_agent_usd: costByAgent,
    metrics: [
      {
        name: 'ai_total_cost_usd',
        value: totalUsd,
        unit: 'USD',
        formula: 'SUM(agent_runs.cost_estimate)',
        source_refs: ['table:agent_runs'],
        status: 'verified'
      },
      {
        name: 'ai_total_cost_brl',
        value: totalBrl,
        unit: 'BRL',
        formula: `SUM(agent_runs.cost_estimate) * usd_brl_rate (${usdToBrlRate})`,
        source_refs: ['table:agent_runs'],
        status: 'estimated'
      }
    ]
  };
}

/**
 * CFO-008: Simula os 3 cenários obrigatórios de precificação e monetização (Conservador, Base e Otimista).
 */
export function simulatePricingScenarios(input?: {
  baseMrrPerClientBrl?: number;
  baseSetupFeeBrl?: number;
  baseVerifiedSavingsPerClientBrl?: number;
  successFeePercent?: number;
  directCostPerClientBrl?: number;
}): PricingScenarioResult[] {
  const mrr = input?.baseMrrPerClientBrl ?? 1490;
  const setup = input?.baseSetupFeeBrl ?? 2500;
  const avgSavings = input?.baseVerifiedSavingsPerClientBrl ?? 4200;
  const sfPct = input?.successFeePercent ?? 20;
  const directCost = input?.directCostPerClientBrl ?? 210;

  const configs: Array<{
    name: 'Conservador' | 'Base' | 'Otimista';
    clients: number;
    savingsFactor: number;
  }> = [
    { name: 'Conservador', clients: 5, savingsFactor: 0.7 },
    { name: 'Base', clients: 15, savingsFactor: 1.0 },
    { name: 'Otimista', clients: 40, savingsFactor: 1.25 }
  ];

  return configs.map((cfg) => {
    const scenarioSavings = round2(avgSavings * cfg.savingsFactor);
    const totalMrr = round2(cfg.clients * mrr);
    const totalSf = round2(cfg.clients * scenarioSavings * (sfPct / 100));
    const totalRev = round2(totalMrr + totalSf);
    const totalCost = round2(cfg.clients * directCost);
    const marginPct = totalRev > 0 ? round2(((totalRev - totalCost) / totalRev) * 100) : 0;

    return {
      scenario_name: cfg.name,
      active_clients: cfg.clients,
      mrr_per_client_brl: mrr,
      setup_fee_brl: setup,
      avg_verified_monthly_savings_brl: scenarioSavings,
      success_fee_percent: sfPct,
      monthly_recurring_revenue_brl: totalMrr,
      monthly_success_fee_revenue_brl: totalSf,
      monthly_total_revenue_brl: totalRev,
      estimated_gross_margin_percent: marginPct
    };
  });
}

/**
 * Executa a consolidação financeira completa do AG-011 (CFO Digital) e valida o resultado
 * contra o contrato oficial `CFODeliverableSchema` (Seção 6.8).
 */
export function runFullCfoSnapshot(input: {
  contracts: ClientFinancialContractInput[];
  agentRuns: AgentRunRecordInput[];
  marketingAndSalesSpendBrl?: number | null;
  newClientsAcquired?: number | null;
  monthlyChurnRate?: number;
  usdToBrlRate?: number;
  periodStart?: string;
  periodEnd?: string;
}) {
  const usdToBrl = input.usdToBrlRate ?? 5.8;
  const nowIso = new Date().toISOString().split('T')[0]!;
  const periodStart = input.periodStart || `${nowIso.slice(0, 7)}-01`;
  const periodEnd = input.periodEnd || nowIso;

  const mrrArr = calculateMrrAndArr(input.contracts);
  const aiReconciliation = reconcileAgentRunsFinOps(input.agentRuns, usdToBrl);

  const clientMargins = input.contracts
    .filter((c) => c.isActive)
    .map((c) => {
      const runsForClient = input.agentRuns.filter((r) => r.client_id && r.client_id === c.clientId);
      return calculateClientGrossMargin(c, runsForClient, usdToBrl);
    });

  // Se houver apenas 1 cliente ativo e execuções globais sem client_id vinculado, calcula a margem consolidada da operação
  const totalEligibleRev = round2(
    clientMargins.reduce((acc, cm) => acc + cm.eligible_total_revenue_brl, 0)
  );
  const totalDirectCosts = round2(
    clientMargins.reduce((acc, cm) => acc + cm.direct_support_cost_brl, 0) + aiReconciliation.total_cost_brl
  );
  const globalGrossMarginBrl = round2(totalEligibleRev - totalDirectCosts);
  const globalGrossMarginRatio = totalEligibleRev > 0 ? Math.max(0, globalGrossMarginBrl / totalEligibleRev) : 0.8;

  const cacRes = calculateCac({
    marketingAndSalesSpendBrl: input.marketingAndSalesSpendBrl,
    newClientsAcquired: input.newClientsAcquired,
    attributionWindowDays: 90
  });

  const ltvRes = calculateLtvAndPayback({
    arpaBrl: mrrArr.arpa_brl,
    grossMarginRatio: globalGrossMarginRatio,
    monthlyChurnRate: input.monthlyChurnRate ?? 0,
    cacBrl: cacRes.cac_brl,
    sampleSize: mrrArr.active_clients_count
  });

  const scenarios = simulatePricingScenarios({
    baseMrrPerClientBrl: mrrArr.arpa_brl > 0 ? mrrArr.arpa_brl : 0
  });

  const alerts: string[] = [];
  const risks: string[] = [];

  if (mrrArr.top_client_revenue_share_percent >= 50 && mrrArr.active_clients_count > 0) {
    alerts.push(
      `Alta concentração de receita: o maior cliente representa ${mrrArr.top_client_revenue_share_percent}% do MRR atual.`
    );
    risks.push('Risco de concentração de carteira (Single-Tenant Dependency Risk).');
  }

  for (const cm of clientMargins) {
    if (cm.is_negative_margin) {
      alerts.push(
        `Rentabilidade negativa detectada no cliente ${cm.company_name}: Margem Bruta de R$ ${cm.gross_margin_brl.toFixed(2)} (${cm.gross_margin_percent}%).`
      );
    }
    if (cm.blocked_unverified_success_fee_brl > 0) {
      alerts.push(
        `Success Fee de R$ ${cm.blocked_unverified_success_fee_brl.toFixed(2)} (${cm.company_name}) bloqueado do reconhecimento: aguarda laudo de M&V verificado pelo AG-010.`
      );
    }
  }

  if (aiReconciliation.runs_without_cost_count > 0) {
    alerts.push(
      `${aiReconciliation.runs_without_cost_count} execução(ões) em agent_runs estão com cost_estimate zerado ou ausente.`
    );
  }

  const allMetrics: CFOMetricItem[] = [
    ...mrrArr.metrics,
    {
      name: 'gross_margin',
      value: globalGrossMarginBrl,
      unit: 'BRL',
      formula: 'receita elegível (MRR + Success Fee verificado) - custos diretos (Operação + IA)',
      source_refs: ['table:clients', 'table:agent_runs'],
      status: mrrArr.active_clients_count > 0 ? 'verified' : 'incomplete'
    },
    cacRes.metric,
    ...ltvRes.metrics,
    ...aiReconciliation.metrics,
    ...clientMargins.map((cm) => cm.metric)
  ];

  const deliverablePayload = {
    summary: `Consolidação Financeira AG-011: MRR de R$ ${mrrArr.mrr_brl.toLocaleString('pt-BR')} (ARR R$ ${mrrArr.arr_brl.toLocaleString('pt-BR')}) em ${mrrArr.active_clients_count} conta(s) ativa(s), Margem Bruta Global de R$ ${globalGrossMarginBrl.toLocaleString('pt-BR')} e gasto acumulado de IA conciliado em US$ ${aiReconciliation.total_cost_usd.toFixed(4)} (R$ ${aiReconciliation.total_cost_brl.toFixed(2)}).`,
    period: {
      start: periodStart,
      end: periodEnd,
      timezone: 'America/Sao_Paulo'
    },
    metrics: allMetrics,
    scenarios,
    risks:
      risks.length > 0
        ? risks
        : ['Variação cambial USD/BRL sobre custos de inferência LLM.', 'Atraso na homologação de M&V posterga faturamento de Success Fee.'],
    alerts,
    assumptions: [
      `Taxa de câmbio gerencial adotada para conversão de custos de IA: R$ ${usdToBrl.toFixed(2)} / USD.`,
      'Taxas de implantação (setup_fee) e Success Fee variável foram estritamente excluídas do cálculo do MRR recorrente (Seção 6.4).',
      'Success Fee somente é reconhecido quando respaldado por economia energética verificada (M&V).'
    ],
    limitations: [
      ...ltvRes.limitations,
      ...(cacRes.status === 'incomplete'
        ? ['CAC e Payback marcados como incomplete por ausência de registro contábil de despesas de marketing/aquisição no período.']
        : [])
    ],
    recommendations: [
      'Manter cobrança híbrida (SaaS Mensal R$ 1.490 + Success Fee de 20% sobre economia verificada em M&V).',
      'Vincular client_id em 100% das tarefas operacionais para apuração exata de margem de contribuição por cliente.',
      'Estabelecer gatilho de revisão caso o custo de IA ultrapasse 5% da receita recorrente mensal de cada conta.'
    ],
    approval_required: false
  };

  const validated = CFODeliverableSchema.parse(deliverablePayload);

  return {
    cfo_deliverable: validated,
    mrr_arr: mrrArr,
    cac: cacRes,
    ltv_payback: ltvRes,
    client_margins: clientMargins,
    ai_reconciliation: aiReconciliation
  };
}

