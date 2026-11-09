'use client';

import React, { useEffect, useState } from 'react';
import {
  BarChart3,
  TrendingUp,
  AlertTriangle,
  CheckCircle2,
  DollarSign,
  Layers,
  ShieldCheck,
  Cpu,
  Clock,
  Filter
} from 'lucide-react';
import {
  fetchFinOpsMetrics,
  fetchDashboardOverview,
  fetchCostUsageData
} from '@/lib/api-client';

export default function FinOpsPage() {
  const [competence, setCompetence] = useState('2026-11');
  const [loading, setLoading] = useState(true);
  const [overview, setOverview] = useState<any>(null);
  const [costUsage, setCostUsage] = useState<any>(null);
  const [metrics, setMetrics] = useState<any>({
    completion_rate_percent: 94.2,
    qa_rework_rate_percent: 5.8,
    avg_cost_per_task_usd: 0.00342,
    avg_execution_time_ms: 2450,
    approval_rate_percent: 98.0,
    total_token_spend_usd_today: 0.42,
    total_token_spend_usd_month: 4.85,
    cost_per_artifact_usd: 0.048,
    total_tasks_count: 86,
    total_runs_count: 112,
    cfo_unit_economics: null,
    recent_runs: []
  });

  useEffect(() => {
    setLoading(true);
    Promise.allSettled([
      fetchDashboardOverview(competence),
      fetchCostUsageData({ limit: 50 }),
      fetchFinOpsMetrics()
    ]).then(([resOverview, resUsage, resMetrics]) => {
      if (resOverview.status === 'fulfilled') {
        setOverview(resOverview.value?.data ?? resOverview.value);
      }
      if (resUsage.status === 'fulfilled') {
        setCostUsage(resUsage.value?.data ?? resUsage.value);
      }
      if (resMetrics.status === 'fulfilled') {
        setMetrics((prev: any) => ({ ...prev, ...resMetrics.value }));
      }
      setLoading(false);
    });
  }, [competence]);

  const cfo = metrics.cfo_unit_economics;
  const mrrArr = cfo?.mrr_arr;
  const scenarios = cfo?.cfo_deliverable?.scenarios || [];
  const clientMargins = cfo?.client_margins || [];

  // Dados reais consolidados da S6-05
  const rev = overview?.revenue;
  const costs = overview?.costs;
  const prof = overview?.profitability;
  const ue = overview?.unit_economics;
  const gov = overview?.governance;

  const renderBadge = (status?: string) => {
    switch (status) {
      case 'measured':
        return (
          <span className="text-[10px] uppercase font-bold tracking-wider bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 px-2 py-0.5 rounded">
            Auditado (Medido)
          </span>
        );
      case 'estimated':
        return (
          <span className="text-[10px] uppercase font-bold tracking-wider bg-amber-500/20 text-amber-300 border border-amber-500/40 px-2 py-0.5 rounded">
            Estimado
          </span>
        );
      case 'incomplete':
      default:
        return (
          <span className="text-[10px] uppercase font-bold tracking-wider bg-rose-500/20 text-rose-300 border border-rose-500/40 px-2 py-0.5 rounded">
            Incompleto / Pendente
          </span>
        );
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* HEADER & FILTROS */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-4">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <BarChart3 className="w-6 h-6 text-emerald-400" />
            Observability Ledger Dashboard (AG-011 CFO Digital)
          </h1>
          <p className="text-slate-400 text-sm mt-1">
            Governança financeira determinística, conciliação de custos de IA, pipeline de receita real e unit economics auditável.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-400 font-mono flex items-center gap-1">
            <Filter className="w-3.5 h-3.5" /> Competência:
          </span>
          <select
            value={competence}
            onChange={(e) => setCompetence(e.target.value)}
            className="bg-slate-900 border border-slate-700 text-white text-xs rounded px-3 py-1.5 font-mono focus:outline-none focus:border-emerald-500"
          >
            <option value="2026-11">2026-11</option>
            <option value="2026-10">2026-10</option>
            <option value="2026-09">2026-09</option>
          </select>
        </div>
      </div>

      {/* ALERTAS DE GOVERNANÇA FINANCEIRA */}
      {gov?.alerts && gov.alerts.length > 0 && (
        <div className="bg-amber-950/40 border border-amber-500/40 rounded-xl p-4 space-y-2">
          <div className="flex items-center gap-2 text-xs font-bold text-amber-300 uppercase tracking-wider">
            <AlertTriangle className="w-4 h-4 text-amber-400" />
            <span>Alertas de Integridade e Conciliação Financeira (AG-011)</span>
          </div>
          <ul className="list-disc list-inside text-xs text-amber-200/90 space-y-1 font-mono">
            {gov.alerts.map((al: string, idx: number) => (
              <li key={idx}>{al}</li>
            ))}
          </ul>
        </div>
      )}

      {/* BLOCO 1: VISÃO EXECUTIVA REAL (RECEITAS, CUSTOS & MARGEM) */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-5 space-y-4">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2">
            <DollarSign className="w-5 h-5 text-emerald-400" />
            <h2 className="text-sm font-bold text-white uppercase tracking-wider">
              1. Visão Executiva Consolidada (Sem Valores Fictícios)
            </h2>
          </div>
          {renderBadge(rev?.reliability || 'incomplete')}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {/* Receita Faturada */}
          <div className="bg-slate-950 border border-slate-800 rounded-lg p-4">
            <div className="flex items-center justify-between">
              <span className="text-[11px] text-slate-400 uppercase font-semibold">Total Faturado</span>
              <span className="text-[10px] text-emerald-400 font-mono">Mês Atual</span>
            </div>
            <div className="text-2xl font-bold text-emerald-400 font-mono mt-1">
              {rev?.total_invoiced_brl !== undefined
                ? `R$ ${rev.total_invoiced_brl.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`
                : '—'}
            </div>
            <p className="text-[11px] text-slate-500 mt-1 font-mono">
              MRR: R$ {(rev?.invoiced_mrr_brl ?? 0).toLocaleString('pt-BR')} • SF: R$ {(rev?.invoiced_success_fee_brl ?? 0).toLocaleString('pt-BR')}
            </p>
          </div>

          {/* Receita Recebida */}
          <div className="bg-slate-950 border border-slate-800 rounded-lg p-4">
            <div className="flex items-center justify-between">
              <span className="text-[11px] text-slate-400 uppercase font-semibold">Total Recebido</span>
              <span className="text-[10px] text-cyan-400 font-mono">Liquidado</span>
            </div>
            <div className="text-2xl font-bold text-cyan-400 font-mono mt-1">
              {rev?.total_received_brl !== undefined
                ? `R$ ${rev.total_received_brl.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`
                : '—'}
            </div>
            <p className="text-[11px] text-slate-500 mt-1 font-mono">
              Pendente: R$ {(rev?.outstanding_invoiced_brl ?? 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
            </p>
          </div>

          {/* Custos Operacionais + IA */}
          <div className="bg-slate-950 border border-slate-800 rounded-lg p-4">
            <div className="flex items-center justify-between">
              <span className="text-[11px] text-slate-400 uppercase font-semibold">Custos Operacionais</span>
              <span className="text-[10px] text-rose-400 font-mono">IA + COGS</span>
            </div>
            <div className="text-2xl font-bold text-rose-400 font-mono mt-1">
              {costs?.total_operating_costs_brl !== undefined
                ? `R$ ${costs.total_operating_costs_brl.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`
                : '—'}
            </div>
            <p className="text-[11px] text-slate-500 mt-1 font-mono">
              IA Spend: US$ {(costs?.ai_spend_usd ?? 0).toFixed(4)} (R$ {(costs?.ai_spend_brl ?? 0).toFixed(2)})
            </p>
          </div>

          {/* Margem Real sobre Faturado */}
          <div className="bg-slate-950 border border-slate-800 rounded-lg p-4">
            <div className="flex items-center justify-between">
              <span className="text-[11px] text-slate-400 uppercase font-semibold">Margem s/ Faturado</span>
              {renderBadge(prof?.status || 'incomplete')}
            </div>
            <div className="text-2xl font-bold text-emerald-300 font-mono mt-1">
              {prof?.margin_on_invoiced_brl !== undefined
                ? `R$ ${prof.margin_on_invoiced_brl.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`
                : '—'}
            </div>
            <p className="text-[11px] text-slate-500 mt-1 font-mono">
              Margem: {prof?.margin_on_invoiced_percent ?? 0}% (s/ Recebido: {prof?.margin_on_received_percent ?? 0}%)
            </p>
          </div>
        </div>
      </div>

      {/* BLOCO 2: UNIT ECONOMICS AUDITÁVEL (CAC, LTV, PAYBACK) */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-cyan-400" />
            <h2 className="text-sm font-bold text-white uppercase tracking-wider">
              2. Unit Economics Auditável (S6-04 Motor Rastreável)
            </h2>
          </div>
          {renderBadge(ue?.status || 'incomplete')}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-slate-950 border border-slate-800 rounded-lg p-4">
            <span className="text-[11px] text-slate-400 uppercase font-semibold">CAC Real (30 Dias)</span>
            <div className="text-2xl font-bold text-cyan-400 font-mono mt-1">
              {ue?.cac_30d_brl !== null && ue?.cac_30d_brl !== undefined
                ? `R$ ${ue.cac_30d_brl.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`
                : '— (Sem Aquisições)'}
            </div>
            <p className="text-[11px] text-slate-500 mt-1 font-mono">
              60d: {ue?.cac_60d_brl ? `R$ ${ue.cac_60d_brl.toLocaleString('pt-BR')}` : '—'} • 90d: {ue?.cac_90d_brl ? `R$ ${ue.cac_90d_brl.toLocaleString('pt-BR')}` : '—'}
            </p>
          </div>

          <div className="bg-slate-950 border border-slate-800 rounded-lg p-4">
            <span className="text-[11px] text-slate-400 uppercase font-semibold">LTV Baseado em Margem</span>
            <div className="text-2xl font-bold text-purple-400 font-mono mt-1">
              {ue?.ltv_brl !== null && ue?.ltv_brl !== undefined
                ? `R$ ${ue.ltv_brl.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`
                : '— (Dados Incompletos)'}
            </div>
            <p className="text-[11px] text-slate-500 mt-1 font-mono">
              Fórmula: Margem Média × Lifespan (Sem estimativa arbitrária)
            </p>
          </div>

          <div className="bg-slate-950 border border-slate-800 rounded-lg p-4">
            <span className="text-[11px] text-slate-400 uppercase font-semibold">Payback Real</span>
            <div className="text-2xl font-bold text-amber-400 font-mono mt-1">
              {ue?.payback_months !== null && ue?.payback_months !== undefined
                ? `${ue.payback_months} meses`
                : '— (Não calculável)'}
            </div>
            <p className="text-[11px] text-slate-500 mt-1 font-mono">
              Tempo de recuperação do investimento de aquisição
            </p>
          </div>

          <div className="bg-slate-950 border border-slate-800 rounded-lg p-4">
            <span className="text-[11px] text-slate-400 uppercase font-semibold">Despesas de Aquisição (S&M)</span>
            <div className="text-2xl font-bold text-white font-mono mt-1">
              R$ {(costs?.acquisition_sm_brl ?? 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
            </div>
            <p className="text-[11px] text-slate-500 mt-1 font-mono">
              Despesas validadas com evidência contábil
            </p>
          </div>
        </div>
      </div>

      {/* BLOCO 3: DETALHAMENTO DE CUSTOS DE IA & BREAKDOWN (S6-02 LEDGER ENGINE) */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2">
            <Cpu className="w-5 h-5 text-indigo-400" />
            <h2 className="text-sm font-bold text-white uppercase tracking-wider">
              3. Detalhamento de Custos de IA por Agente e Modelo
            </h2>
          </div>
          <span className="text-xs text-slate-400 font-mono">
            {costUsage?.summary?.total_runs ?? 0} execuções conciliadas
          </span>
        </div>

        {/* Breakdown em 3 Colunas */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Por Agente */}
          <div className="bg-slate-950 border border-slate-800 rounded-lg p-3 space-y-2">
            <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider border-b border-slate-800 pb-1">
              Consumo por Agente
            </h3>
            <div className="space-y-1.5 font-mono text-xs">
              {costUsage?.breakdown_by_agent && Object.keys(costUsage.breakdown_by_agent).length > 0 ? (
                Object.entries(costUsage.breakdown_by_agent).map(([ag, val]: any) => (
                  <div key={ag} className="flex justify-between items-center py-0.5">
                    <span className="text-white font-semibold">{ag} ({val.count}x)</span>
                    <span className="text-emerald-400">US$ {val.cost_usd.toFixed(4)}</span>
                  </div>
                ))
              ) : (
                <p className="text-slate-500 text-[11px]">Nenhuma execução registrada.</p>
              )}
            </div>
          </div>

          {/* Por Modelo */}
          <div className="bg-slate-950 border border-slate-800 rounded-lg p-3 space-y-2">
            <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider border-b border-slate-800 pb-1">
              Consumo por Modelo
            </h3>
            <div className="space-y-1.5 font-mono text-xs">
              {costUsage?.breakdown_by_model && Object.keys(costUsage.breakdown_by_model).length > 0 ? (
                Object.entries(costUsage.breakdown_by_model).map(([mod, val]: any) => (
                  <div key={mod} className="flex justify-between items-center py-0.5">
                    <span className="text-white">{mod}</span>
                    <span className="text-cyan-400">US$ {val.cost_usd.toFixed(4)}</span>
                  </div>
                ))
              ) : (
                <p className="text-slate-500 text-[11px]">Nenhum modelo registrado.</p>
              )}
            </div>
          </div>

          {/* Por Categoria */}
          <div className="bg-slate-950 border border-slate-800 rounded-lg p-3 space-y-2">
            <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider border-b border-slate-800 pb-1">
              Segregação de Custos
            </h3>
            <div className="space-y-1.5 font-mono text-xs">
              <div className="flex justify-between items-center py-0.5">
                <span className="text-slate-300">Cliente (Atribuível):</span>
                <span className="text-emerald-400">
                  US$ {costUsage?.breakdown_by_category?.client_attributable?.cost_usd?.toFixed(4) ?? '0.0000'}
                </span>
              </div>
              <div className="flex justify-between items-center py-0.5">
                <span className="text-slate-300">Interno Plataforma:</span>
                <span className="text-indigo-400">
                  US$ {costUsage?.breakdown_by_category?.platform_internal?.cost_usd?.toFixed(4) ?? '0.0000'}
                </span>
              </div>
              <div className="flex justify-between items-center py-0.5">
                <span className="text-slate-300">Não Atribuído (Legado):</span>
                <span className="text-amber-400">
                  US$ {costUsage?.breakdown_by_category?.unattributed_legacy?.cost_usd?.toFixed(4) ?? '0.0000'}
                </span>
              </div>
              <div className="flex justify-between items-center py-0.5">
                <span className="text-rose-400">Órfão (Sem Atribuição):</span>
                <span className="text-rose-400 font-bold">
                  US$ {costUsage?.breakdown_by_category?.unattributed_orphan?.cost_usd?.toFixed(4) ?? '0.0000'}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* BLOCO 4: AUDITORIA RECENTE DE EXECUÇÕES REAL NO LEDGER */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <h2 className="text-sm font-bold text-white uppercase tracking-wider">
            4. Registro Contábil de Execuções (Ledger FinOps)
          </h2>
          <span className="text-xs text-slate-400 font-mono">
            {costUsage?.entries?.length ?? 0} registros exibidos
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-300">
            <thead className="bg-slate-950 text-slate-400 uppercase font-mono text-[10px]">
              <tr>
                <th className="p-3">Run ID</th>
                <th className="p-3">Agente</th>
                <th className="p-3">Modelo</th>
                <th className="p-3">Cliente / UC</th>
                <th className="p-3">Tokens (In / Out)</th>
                <th className="p-3">Custo (USD)</th>
                <th className="p-3">Categoria</th>
                <th className="p-3">Confiabilidade</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800 font-mono">
              {costUsage?.entries && costUsage.entries.length > 0 ? (
                costUsage.entries.map((row: any) => (
                  <tr key={row.id} className="hover:bg-slate-950/60">
                    <td className="p-3 text-slate-400">{row.run_id?.slice(0, 8)}...</td>
                    <td className="p-3 font-bold text-white">{row.agent_id}</td>
                    <td className="p-3 text-slate-400">{row.model_name}</td>
                    <td className="p-3 text-cyan-300">{row.client_id || '— (Interno)'}</td>
                    <td className="p-3 text-slate-300">
                      {(row.input_tokens || 0).toLocaleString()} / {(row.output_tokens || 0).toLocaleString()}
                    </td>
                    <td className="p-3 text-emerald-400 font-bold">${Number(row.cost_usd || 0).toFixed(4)}</td>
                    <td className="p-3">
                      <span className="bg-slate-800 text-slate-300 px-2 py-0.5 rounded text-[10px]">
                        {row.category}
                      </span>
                    </td>
                    <td className="p-3">
                      {renderBadge(row.reliability_tier)}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={8} className="p-4 text-center text-slate-500 font-mono">
                    Nenhum registro de ledger encontrado.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
