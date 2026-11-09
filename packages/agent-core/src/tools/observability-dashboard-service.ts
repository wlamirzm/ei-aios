// ==============================================================================
// OBSERVABILITY LEDGER DASHBOARD SERVICE (AG-011 CFO DIGITAL)
// Sprint 6 S6-05: Executive Overview, AI Cost & Usage, Real Revenue & Unit Economics
// ==============================================================================

import { FinopsLedgerEngine } from './finops-ledger-engine.js';
import { RevenuePipelineEngine } from './revenue-pipeline-engine.js';
import { UnitEconomicsEngine } from './unit-economics-engine.js';
import { CostReliabilityTier } from '@ei-aios/shared';

const round2 = (n: number): number => Math.round(n * 100) / 100;
const round4 = (n: number): number => Math.round(n * 10000) / 10000;

export interface DashboardExecutiveOverview {
  period: string; // YYYY-MM
  tenant_id: string;
  revenue: {
    contracted_mrr_brl: number | null;
    invoiced_mrr_brl: number;
    invoiced_success_fee_brl: number;
    total_invoiced_brl: number;
    received_mrr_brl: number;
    received_success_fee_brl: number;
    total_received_brl: number;
    outstanding_invoiced_brl: number;
    reliability: CostReliabilityTier;
  };
  costs: {
    ai_spend_usd: number;
    ai_spend_brl: number;
    operational_cogs_brl: number;
    acquisition_sm_brl: number;
    total_operating_costs_brl: number;
    reliability: CostReliabilityTier;
  };
  profitability: {
    margin_on_invoiced_brl: number;
    margin_on_invoiced_percent: number;
    margin_on_received_brl: number;
    margin_on_received_percent: number;
    status: CostReliabilityTier;
  };
  unit_economics: {
    cac_30d_brl: number | null;
    cac_60d_brl: number | null;
    cac_90d_brl: number | null;
    ltv_brl: number | null;
    payback_months: number | null;
    status: CostReliabilityTier;
  };
  governance: {
    incomplete_runs_count: number;
    unattributed_costs_usd: number;
    pending_expense_validations_count: number;
    pending_success_fee_approvals_count: number;
    alerts: string[];
  };
}

export interface CostAndUsageView {
  summary: {
    total_usd: number;
    total_brl: number;
    total_runs: number;
    total_tokens_in: number;
    total_tokens_out: number;
    avg_cost_per_run_usd: number;
  };
  breakdown_by_client: Record<string, { count: number; cost_usd: number; cost_brl: number }>;
  breakdown_by_agent: Record<string, { count: number; cost_usd: number; cost_brl: number }>;
  breakdown_by_model: Record<string, { count: number; cost_usd: number; tokens_combined: number }>;
  breakdown_by_category: {
    client_attributable: { count: number; cost_usd: number };
    platform_internal: { count: number; cost_usd: number };
    unattributed_legacy: { count: number; cost_usd: number };
  };
  entries: any[];
}

export class ObservabilityDashboardService {
  private ledgerEngine: FinopsLedgerEngine;
  private revenueEngine: RevenuePipelineEngine;
  private unitEconomicsEngine: UnitEconomicsEngine;

  constructor(dependencies?: {
    ledgerEngine?: FinopsLedgerEngine;
    revenueEngine?: RevenuePipelineEngine;
    unitEconomicsEngine?: UnitEconomicsEngine;
  }) {
    this.ledgerEngine = dependencies?.ledgerEngine || new FinopsLedgerEngine();
    this.revenueEngine = dependencies?.revenueEngine || new RevenuePipelineEngine();
    this.unitEconomicsEngine = dependencies?.unitEconomicsEngine || new UnitEconomicsEngine();
  }

  public getLedgerEngine(): FinopsLedgerEngine {
    return this.ledgerEngine;
  }

  public getRevenueEngine(): RevenuePipelineEngine {
    return this.revenueEngine;
  }

  public getUnitEconomicsEngine(): UnitEconomicsEngine {
    return this.unitEconomicsEngine;
  }

  /**
   * MÓDULO A: Executive Financial Overview Consolidado
   */
  public getExecutiveOverview(options?: {
    competence?: string;
    tenantId?: string;
    referenceDate?: string;
    usdToBrlRate?: number;
  }): DashboardExecutiveOverview {
    const competence = options?.competence || new Date().toISOString().slice(0, 7);
    const tenantId = options?.tenantId || 'default_tenant';

    let referenceDate = options?.referenceDate;
    if (!referenceDate && options?.competence) {
      const [yearStr, monthStr] = options.competence.split('-');
      if (yearStr && monthStr) {
        const y = parseInt(yearStr, 10);
        const m = parseInt(monthStr, 10);
        const lastDay = new Date(Date.UTC(y, m, 0)).getUTCDate();
        referenceDate = `${options.competence}-${String(lastDay).padStart(2, '0')}`;
      }
    }

    const alerts: string[] = [];

    // 1. Receita (S6-03)
    const ledgerEntries = this.ledgerEngine.getAllEntries();
    const clientSummaryMap: Record<string, any> = {};
    for (const e of ledgerEntries) {
      if (e.client_id) {
        if (!clientSummaryMap[e.client_id]) {
          clientSummaryMap[e.client_id] = this.ledgerEngine.getClientCostSummary(e.client_id);
        }
      }
    }

    // Calcula margem agregada de todos os clientes com contrato ativo
    let contractedMrrSum = 0;
    let invoicedMrrSum = 0;
    let invoicedSfSum = 0;
    let receivedMrrSum = 0;
    let receivedSfSum = 0;
    let hasMissingContractValue = false;
    let activeContractsCount = 0;

    // Usamos o motor de receita
    const dummyAiCost = { clientId: '', totalRuns: 0, totalTokensIn: 0, totalTokensOut: 0, costUsd: 0, costBrl: 0 };
    
    // Obtém lista de clientes conhecidos
    const uniqueClientIds = Object.keys(clientSummaryMap);

    for (const cId of uniqueClientIds) {
      const rep = this.revenueEngine.generateClientMarginReport(
        cId,
        competence,
        clientSummaryMap[cId] || dummyAiCost,
        0
      );
      if (rep.contracted_mrr_brl !== null) {
        contractedMrrSum += rep.contracted_mrr_brl;
        activeContractsCount++;
      } else {
        hasMissingContractValue = true;
      }
      invoicedMrrSum += rep.invoiced_mrr_brl;
      invoicedSfSum += rep.invoiced_success_fee_brl;
      receivedMrrSum += rep.received_mrr_brl;
      receivedSfSum += rep.received_success_fee_brl;
    }

    const totalInvoiced = round2(invoicedMrrSum + invoicedSfSum);
    const totalReceived = round2(receivedMrrSum + receivedSfSum);
    const outstandingInvoiced = round2(Math.max(0, totalInvoiced - totalReceived));

    let revenueReliability: CostReliabilityTier = 'measured';
    if (activeContractsCount === 0 && uniqueClientIds.length > 0) {
      revenueReliability = 'incomplete';
      alerts.push('Nenhum contrato ativo formalizado para os clientes da base.');
    } else if (hasMissingContractValue) {
      revenueReliability = 'estimated';
      alerts.push('Existem clientes com contratos ativos sem valor de MRR preenchido.');
    }

    // 2. Custos de IA (S6-02)
    let totalAiUsd = 0;
    let totalAiBrl = 0;
    let unattributedAiUsd = 0;
    let incompleteRunsCount = 0;

    for (const e of ledgerEntries) {
      const usd = e.cost_usd || 0;
      const brl = e.cost_brl || 0;
      totalAiUsd += usd;
      totalAiBrl += brl;

      if (e.category === 'unattributed_legacy' || e.category === 'unattributed_orphan') {
        unattributedAiUsd += usd;
      }
      if (e.reliability_tier === 'incomplete') {
        incompleteRunsCount++;
      }
    }
    totalAiUsd = round4(totalAiUsd);
    totalAiBrl = round2(totalAiBrl);
    unattributedAiUsd = round4(unattributedAiUsd);

    if (unattributedAiUsd > 0) {
      alerts.push(`Existem US$ ${unattributedAiUsd.toFixed(4)} em custos de IA não atribuídos a clientes.`);
    }
    if (incompleteRunsCount > 0) {
      alerts.push(`${incompleteRunsCount} execuções de IA possuem dados incompletos (tokens ou modelo não precificado).`);
    }

    // 3. Despesas Operacionais e de Aquisição (S6-04)
    const cac30 = this.unitEconomicsEngine.calculateRealCac({ windowDays: 30, tenantId, referenceDate });
    const cac60 = this.unitEconomicsEngine.calculateRealCac({ windowDays: 60, tenantId, referenceDate });
    const cac90 = this.unitEconomicsEngine.calculateRealCac({ windowDays: 90, tenantId, referenceDate });

    const totalSmSpend = cac90.total_eligible_spend_brl;
    const totalOperatingCosts = round2(totalAiBrl);

    // 4. Rentabilidade
    const marginOnInvoiced = round2(totalInvoiced - totalOperatingCosts);
    const marginOnInvoicedPct = totalInvoiced > 0 ? round2((marginOnInvoiced / totalInvoiced) * 100) : 0;
    const marginOnReceived = round2(totalReceived - totalOperatingCosts);
    const marginOnReceivedPct = totalReceived > 0 ? round2((marginOnReceived / totalReceived) * 100) : 0;

    // 5. LTV & Payback
    const avgMonthlyMargin = activeContractsCount > 0 ? round2(marginOnInvoiced / activeContractsCount) : null;
    const ltvRes = this.unitEconomicsEngine.calculateRealLtv({
      monthlyContributionMarginBrl: avgMonthlyMargin,
      historicalMonthsCount: 6,
      benchmarkLifespanMonths: 24
    });
    const paybackRes = this.unitEconomicsEngine.calculateRealPayback({
      cacBrl: cac30.cac_brl || cac60.cac_brl,
      monthlyContributionMarginBrl: avgMonthlyMargin
    });

    return {
      period: competence,
      tenant_id: tenantId,
      revenue: {
        contracted_mrr_brl: hasMissingContractValue && contractedMrrSum === 0 ? null : round2(contractedMrrSum),
        invoiced_mrr_brl: round2(invoicedMrrSum),
        invoiced_success_fee_brl: round2(invoicedSfSum),
        total_invoiced_brl: totalInvoiced,
        received_mrr_brl: round2(receivedMrrSum),
        received_success_fee_brl: round2(receivedSfSum),
        total_received_brl: totalReceived,
        outstanding_invoiced_brl: outstandingInvoiced,
        reliability: revenueReliability
      },
      costs: {
        ai_spend_usd: totalAiUsd,
        ai_spend_brl: totalAiBrl,
        operational_cogs_brl: 0,
        acquisition_sm_brl: totalSmSpend,
        total_operating_costs_brl: totalOperatingCosts,
        reliability: incompleteRunsCount > 0 ? 'estimated' : 'measured'
      },
      profitability: {
        margin_on_invoiced_brl: marginOnInvoiced,
        margin_on_invoiced_percent: marginOnInvoicedPct,
        margin_on_received_brl: marginOnReceived,
        margin_on_received_percent: marginOnReceivedPct,
        status: revenueReliability
      },
      unit_economics: {
        cac_30d_brl: cac30.cac_brl,
        cac_60d_brl: cac60.cac_brl,
        cac_90d_brl: cac90.cac_brl,
        ltv_brl: ltvRes.ltv_brl,
        payback_months: paybackRes.payback_months,
        status: cac30.status === 'measured' ? 'measured' : 'incomplete'
      },
      governance: {
        incomplete_runs_count: incompleteRunsCount,
        unattributed_costs_usd: unattributedAiUsd,
        pending_expense_validations_count: 0,
        pending_success_fee_approvals_count: 0,
        alerts
      }
    };
  }

  /**
   * MÓDULO B: Visualização Analítica de Custos e Uso de IA (Ledger S6-02)
   */
  public getCostAndUsageDetails(filters?: {
    clientId?: string;
    agentId?: string;
    modelName?: string;
    reliabilityTier?: CostReliabilityTier;
    limit?: number;
    offset?: number;
  }): CostAndUsageView {
    const all = this.ledgerEngine.getAllEntries();

    let filtered = all;
    if (filters?.clientId) {
      filtered = filtered.filter((e) => e.client_id === filters.clientId);
    }
    if (filters?.agentId) {
      filtered = filtered.filter((e) => e.agent_id === filters.agentId);
    }
    if (filters?.modelName) {
      filtered = filtered.filter((e) => e.model_name.toLowerCase().includes(filters.modelName!.toLowerCase()));
    }
    if (filters?.reliabilityTier) {
      filtered = filtered.filter((e) => e.reliability_tier === filters.reliabilityTier);
    }

    const byClient: Record<string, { count: number; cost_usd: number; cost_brl: number }> = {};
    const byAgent: Record<string, { count: number; cost_usd: number; cost_brl: number }> = {};
    const byModel: Record<string, { count: number; cost_usd: number; tokens_combined: number }> = {};
    const byCategory = {
      client_attributable: { count: 0, cost_usd: 0 },
      platform_internal: { count: 0, cost_usd: 0 },
      unattributed_legacy: { count: 0, cost_usd: 0 }
    };

    let totalUsd = 0;
    let totalBrl = 0;
    let totalIn = 0;
    let totalOut = 0;

    for (const e of filtered) {
      const usd = e.cost_usd || 0;
      const brl = e.cost_brl || 0;
      const inTok = e.input_tokens || 0;
      const outTok = e.output_tokens || 0;

      totalUsd += usd;
      totalBrl += brl;
      totalIn += inTok;
      totalOut += outTok;

      // Por cliente
      if (e.client_id) {
        let clientBucket = byClient[e.client_id];
        if (!clientBucket) {
          clientBucket = { count: 0, cost_usd: 0, cost_brl: 0 };
          byClient[e.client_id] = clientBucket;
        }
        clientBucket.count++;
        clientBucket.cost_usd = round4(clientBucket.cost_usd + usd);
        clientBucket.cost_brl = round2(clientBucket.cost_brl + brl);
      }

      // Por agente
      const ag = e.agent_id || 'UNKNOWN';
      let agentBucket = byAgent[ag];
      if (!agentBucket) {
        agentBucket = { count: 0, cost_usd: 0, cost_brl: 0 };
        byAgent[ag] = agentBucket;
      }
      agentBucket.count++;
      agentBucket.cost_usd = round4(agentBucket.cost_usd + usd);
      agentBucket.cost_brl = round2(agentBucket.cost_brl + brl);

      // Por modelo
      const mod = e.model_name || 'UNKNOWN';
      let modelBucket = byModel[mod];
      if (!modelBucket) {
        modelBucket = { count: 0, cost_usd: 0, tokens_combined: 0 };
        byModel[mod] = modelBucket;
      }
      modelBucket.count++;
      modelBucket.cost_usd = round4(modelBucket.cost_usd + usd);
      modelBucket.tokens_combined += (inTok + outTok);

      // Por categoria
      if (e.category === 'client_attributable') {
        byCategory.client_attributable.count++;
        byCategory.client_attributable.cost_usd = round4(byCategory.client_attributable.cost_usd + usd);
      } else if (e.category === 'platform_internal') {
        byCategory.platform_internal.count++;
        byCategory.platform_internal.cost_usd = round4(byCategory.platform_internal.cost_usd + usd);
      } else {
        byCategory.unattributed_legacy.count++;
        byCategory.unattributed_legacy.cost_usd = round4(byCategory.unattributed_legacy.cost_usd + usd);
      }
    }

    const limit = filters?.limit || 50;
    const offset = filters?.offset || 0;
    const paginated = filtered.slice(offset, offset + limit);

    return {
      summary: {
        total_usd: round4(totalUsd),
        total_brl: round2(totalBrl),
        total_runs: filtered.length,
        total_tokens_in: totalIn,
        total_tokens_out: totalOut,
        avg_cost_per_run_usd: filtered.length > 0 ? round6(totalUsd / filtered.length) : 0
      },
      breakdown_by_client: byClient,
      breakdown_by_agent: byAgent,
      breakdown_by_model: byModel,
      breakdown_by_category: byCategory,
      entries: paginated
    };
  }
}

function round6(n: number): number {
  return Math.round(n * 1000000) / 1000000;
}
