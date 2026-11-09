'use client';

import React, { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { fetchPublicReport } from '@/lib/api-client';

interface ReportData {
  report_id: string;
  created_at: string;
  expires_at: string;
  bill: {
    id: string;
    billing_period: string;
    due_date: string;
    total_amount_brl: number;
    consumption_peak_kwh: number;
    consumption_offpeak_kwh: number;
    measured_demand_peak_kw: number;
    measured_demand_offpeak_kw: number;
    potential_savings_brl: number;
    deterministic_audit_json: any;
    taxes_breakdown: any;
  };
  consumer_unit: {
    uc_code: string;
    unit_name: string;
    distributor: string;
    tariff_group: string;
    tariff_modality: string;
    contracted_demand_peak_kw: number;
    contracted_demand_offpeak_kw: number;
  } | null;
  client: {
    company_name: string;
    cnpj: string;
    segment: string;
  } | null;
}

const MODALITY_LABELS: Record<string, string> = {
  HOROSSAZONAL_VERDE: 'Horossazonal Verde',
  HOROSSAZONAL_AZUL: 'Horossazonal Azul',
  CONVENCIONAL: 'Convencional',
  BRANCA: 'Branca'
};

function formatBrl(value: number): string {
  return value.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatPeriod(period: string): string {
  const [year, month] = period.split('-');
  const months = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
  return `${months[parseInt(month, 10) - 1]} ${year}`;
}

export default function PublicReportPage() {
  const params = useParams();
  const token = params.token as string;
  const [report, setReport] = useState<ReportData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!token) return;
    fetchPublicReport(token)
      .then(setReport)
      .catch((err: Error) => {
        if (err.message === 'REPORT_EXPIRED') {
          setError('Este relatório expirou e não está mais disponível.');
        } else {
          setError('Relatório não encontrado.');
        }
      })
      .finally(() => setLoading(false));
  }, [token]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-slate-500">Carregando relatório...</p>
        </div>
      </div>
    );
  }

  if (error || !report) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center max-w-md">
          <div className="w-16 h-16 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-4">
            <span className="text-3xl text-red-500 font-bold">!</span>
          </div>
          <h1 className="text-xl font-bold text-slate-900 mb-2">Relatório Indisponível</h1>
          <p className="text-slate-500">{error || 'Não foi possível carregar este relatório.'}</p>
        </div>
      </div>
    );
  }

  const audit = report.bill.deterministic_audit_json;
  const uc = report.consumer_unit;
  const client = report.client;

  return (
    <div className="max-w-4xl mx-auto px-6 py-8 print:px-0 print:py-4">
      {/* Print button */}
      <div className="print:hidden mb-6 flex justify-end">
        <button
          onClick={() => window.print()}
          className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold px-6 py-2.5 rounded-lg text-sm transition flex items-center gap-2"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          Baixar PDF
        </button>
      </div>

      {/* Header */}
      <header className="border-b-2 border-emerald-600 pb-6 mb-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Diagnóstico Energético</h1>
            <p className="text-sm text-slate-500 mt-1">Auditoria Tarifária Determinística — ANEEL REN 1.000/2021</p>
          </div>
          <div className="text-right">
            <span className="text-lg font-bold text-emerald-600 tracking-wide">EI-AIOS</span>
            <p className="text-xs text-slate-400">Energy Intelligence</p>
          </div>
        </div>
      </header>

      {/* Client & UC info */}
      <section className="grid grid-cols-2 gap-6 mb-8">
        <div className="bg-slate-50 rounded-lg p-4 border border-slate-200">
          <h2 className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-3">Empresa</h2>
          <p className="text-base font-semibold text-slate-900">{client?.company_name || 'N/A'}</p>
          {client?.cnpj && <p className="text-sm text-slate-500 mt-1">CNPJ: {client.cnpj}</p>}
          {client?.segment && <p className="text-sm text-slate-500">Segmento: {client.segment}</p>}
        </div>
        <div className="bg-slate-50 rounded-lg p-4 border border-slate-200">
          <h2 className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-3">Unidade Consumidora</h2>
          {uc ? (
            <>
              <p className="text-base font-semibold text-slate-900">{uc.unit_name || uc.uc_code}</p>
              <p className="text-sm text-slate-500 mt-1">UC: {uc.uc_code} | {uc.distributor}</p>
              <p className="text-sm text-slate-500">{uc.tariff_group} — {MODALITY_LABELS[uc.tariff_modality] || uc.tariff_modality}</p>
              <p className="text-sm text-slate-500">Demanda Contratada: {uc.contracted_demand_peak_kw} kW</p>
            </>
          ) : (
            <p className="text-sm text-slate-500">Dados da UC indisponíveis</p>
          )}
        </div>
      </section>

      {/* Billing period & total */}
      <section className="flex items-center justify-between bg-slate-900 text-white rounded-lg p-5 mb-8 print:bg-slate-800">
        <div>
          <span className="text-xs text-slate-400 uppercase">Período de Referência</span>
          <p className="text-xl font-bold">{formatPeriod(report.bill.billing_period)}</p>
        </div>
        <div className="text-right">
          <span className="text-xs text-slate-400 uppercase">Valor Total da Fatura</span>
          <p className="text-xl font-bold">R$ {formatBrl(report.bill.total_amount_brl)}</p>
        </div>
        <div className="text-right">
          <span className="text-xs text-slate-400 uppercase">Consumo Total</span>
          <p className="text-xl font-bold">{formatBrl(report.bill.consumption_peak_kwh + report.bill.consumption_offpeak_kwh)} kWh</p>
        </div>
      </section>

      {audit && (
        <>
          {/* Section 1: Demand Analysis */}
          <section className="mb-8">
            <h2 className="text-lg font-bold text-slate-900 border-b border-slate-200 pb-2 mb-4">
              1. Análise de Demanda
            </h2>
            <div className="grid grid-cols-3 gap-4 mb-4">
              <div className="bg-slate-50 rounded-lg p-4 border border-slate-200 text-center">
                <span className="text-xs text-slate-500 block">Contratada</span>
                <span className="text-2xl font-bold text-slate-900">{audit.demand_analysis.contracted_kw}</span>
                <span className="text-sm text-slate-500"> kW</span>
              </div>
              <div className="bg-slate-50 rounded-lg p-4 border border-slate-200 text-center">
                <span className="text-xs text-slate-500 block">Medida</span>
                <span className={`text-2xl font-bold ${audit.demand_analysis.has_overage ? 'text-red-600' : 'text-emerald-600'}`}>
                  {audit.demand_analysis.measured_kw}
                </span>
                <span className="text-sm text-slate-500"> kW</span>
              </div>
              <div className="bg-slate-50 rounded-lg p-4 border border-slate-200 text-center">
                <span className="text-xs text-slate-500 block">Tolerância (5%)</span>
                <span className="text-2xl font-bold text-slate-900">{audit.demand_analysis.regulatory_tolerance_kw}</span>
                <span className="text-sm text-slate-500"> kW</span>
              </div>
            </div>

            {audit.demand_analysis.has_overage && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
                <p className="text-sm font-semibold text-red-700">
                  Ultrapassagem de Demanda: {audit.demand_analysis.overage_kw} kW acima do contratado
                </p>
                <p className="text-sm text-red-600 mt-1">
                  Multa estimada: <strong>R$ {formatBrl(audit.demand_analysis.overage_penalty_brl)}</strong>
                </p>
              </div>
            )}

            {audit.demand_analysis.has_idle_demand && (
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-4">
                <p className="text-sm font-semibold text-amber-700">
                  Demanda Ociosa: {audit.demand_analysis.idle_demand_kw} kW contratados sem utilização
                </p>
                <p className="text-sm text-amber-600 mt-1">
                  Desperdício anual: <strong>R$ {formatBrl(audit.demand_analysis.annual_idle_waste_brl)}</strong>
                </p>
                <p className="text-sm text-amber-600">
                  Recomendação: reduzir demanda contratada para <strong>{audit.demand_analysis.recommended_contracted_demand_kw} kW</strong>
                </p>
              </div>
            )}

            {!audit.demand_analysis.has_overage && !audit.demand_analysis.has_idle_demand && (
              <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4">
                <p className="text-sm text-emerald-700">Demanda dentro dos parâmetros ideais. Nenhuma ação necessária.</p>
              </div>
            )}
          </section>

          {/* Section 2: Reactive Power */}
          <section className="mb-8">
            <h2 className="text-lg font-bold text-slate-900 border-b border-slate-200 pb-2 mb-4">
              2. Energia Reativa (UFER/DMCR)
            </h2>
            {audit.reactive_analysis.monthly_fine_brl > 0 ? (
              <>
                <div className="grid grid-cols-2 gap-4 mb-4">
                  <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 text-center">
                    <span className="text-xs text-amber-600 block">Multa Mensal</span>
                    <span className="text-2xl font-bold text-amber-700">R$ {formatBrl(audit.reactive_analysis.monthly_fine_brl)}</span>
                  </div>
                  <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-center">
                    <span className="text-xs text-red-600 block">Custo Anual Evitável</span>
                    <span className="text-2xl font-bold text-red-700">R$ {formatBrl(audit.reactive_analysis.annual_avoidable_cost_brl)}</span>
                  </div>
                </div>
                {audit.reactive_analysis.requires_capacitor_bank && (
                  <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4">
                    <p className="text-sm text-emerald-700">
                      <strong>Recomendação:</strong> Instalação de banco de capacitores com payback estimado de{' '}
                      <strong>{audit.reactive_analysis.payback_estimate_months} meses</strong>.
                    </p>
                  </div>
                )}
              </>
            ) : (
              <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4">
                <p className="text-sm text-emerald-700">Fator de potência dentro dos limites regulatórios. Sem multas por reativo.</p>
              </div>
            )}
          </section>

          {/* Section 3: Modality Comparison */}
          <section className="mb-8">
            <h2 className="text-lg font-bold text-slate-900 border-b border-slate-200 pb-2 mb-4">
              3. Enquadramento Tarifário
            </h2>
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div className={`rounded-lg p-4 text-center border ${audit.modality_comparison.recommended_modality === 'VERDE' ? 'bg-emerald-50 border-emerald-300' : 'bg-slate-50 border-slate-200'}`}>
                <span className="text-xs text-slate-500 block">Tarifa Verde (Anual)</span>
                <span className="text-2xl font-bold text-slate-900">R$ {formatBrl(audit.modality_comparison.verde_annual_cost_brl)}</span>
                {audit.modality_comparison.recommended_modality === 'VERDE' && (
                  <span className="block text-xs font-bold text-emerald-600 mt-1">RECOMENDADA</span>
                )}
              </div>
              <div className={`rounded-lg p-4 text-center border ${audit.modality_comparison.recommended_modality === 'AZUL' ? 'bg-blue-50 border-blue-300' : 'bg-slate-50 border-slate-200'}`}>
                <span className="text-xs text-slate-500 block">Tarifa Azul (Anual)</span>
                <span className="text-2xl font-bold text-slate-900">R$ {formatBrl(audit.modality_comparison.azul_annual_cost_brl)}</span>
                {audit.modality_comparison.recommended_modality === 'AZUL' && (
                  <span className="block text-xs font-bold text-blue-600 mt-1">RECOMENDADA</span>
                )}
              </div>
            </div>
            <p className="text-sm text-slate-600">{audit.modality_comparison.recommendation_rationale}</p>
            {audit.modality_comparison.annual_savings_brl > 0 && (
              <p className="text-sm font-semibold text-emerald-600 mt-2">
                Economia potencial com a troca: R$ {formatBrl(audit.modality_comparison.annual_savings_brl)}/ano
              </p>
            )}
          </section>

          {/* Section 4: Load Factor */}
          <section className="mb-8">
            <h2 className="text-lg font-bold text-slate-900 border-b border-slate-200 pb-2 mb-4">
              4. Fator de Carga
            </h2>
            <div className="flex items-center gap-4 mb-3">
              <div className={`text-3xl font-bold ${
                audit.load_factor_analysis.rating === 'excelente' ? 'text-emerald-600' :
                audit.load_factor_analysis.rating === 'adequado' ? 'text-blue-600' :
                audit.load_factor_analysis.rating === 'baixo' ? 'text-amber-600' :
                'text-red-600'
              }`}>
                {(audit.load_factor_analysis.load_factor * 100).toFixed(1)}%
              </div>
              <span className={`text-sm font-bold px-3 py-1 rounded ${
                audit.load_factor_analysis.rating === 'excelente' ? 'bg-emerald-100 text-emerald-700' :
                audit.load_factor_analysis.rating === 'adequado' ? 'bg-blue-100 text-blue-700' :
                audit.load_factor_analysis.rating === 'baixo' ? 'bg-amber-100 text-amber-700' :
                'bg-red-100 text-red-700'
              }`}>
                {audit.load_factor_analysis.rating.toUpperCase()}
              </span>
            </div>
            <p className="text-sm text-slate-600">{audit.load_factor_analysis.diagnosis}</p>
          </section>

          {/* Section 5: Total Savings */}
          <section className="bg-emerald-600 text-white rounded-lg p-6 mb-8 print:bg-emerald-700">
            <h2 className="text-sm font-bold uppercase tracking-wide opacity-80 mb-2">Potencial de Economia Identificado</h2>
            <div className="flex items-baseline gap-3">
              <span className="text-4xl font-bold">R$ {formatBrl(audit.total_annual_potential_savings_brl)}</span>
              <span className="text-lg opacity-80">/ ano</span>
            </div>
            <p className="text-sm opacity-80 mt-1">
              Equivalente a R$ {formatBrl(audit.total_monthly_potential_savings_brl)} por mês
            </p>
          </section>
        </>
      )}

      {/* Footer */}
      <footer className="border-t border-slate-200 pt-6 mt-8 text-xs text-slate-400 space-y-2">
        <p>
          Este relatório foi gerado automaticamente pelo motor determinístico do EI-AIOS em{' '}
          {new Date(report.created_at).toLocaleDateString('pt-BR')}. Os cálculos seguem a metodologia da
          Resolução Normativa ANEEL nº 1.000/2021 e não constituem parecer jurídico.
        </p>
        <p>
          Os valores apresentados são estimativas baseadas nos dados extraídos da fatura e parâmetros tarifários
          de referência. Valores reais podem variar conforme condições contratuais específicas.
        </p>
        <p className="text-slate-300">
          Válido até {new Date(report.expires_at).toLocaleDateString('pt-BR')} | EI-AIOS Energy Intelligence
        </p>
      </footer>

      {/* Print styles */}
      <style jsx global>{`
        @media print {
          body { background: white !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          .print\\:hidden { display: none !important; }
          .print\\:bg-white { background: white !important; }
          .print\\:bg-slate-800 { background: #1e293b !important; }
          .print\\:bg-emerald-700 { background: #047857 !important; }
          @page { margin: 1.5cm; size: A4; }
        }
      `}</style>
    </div>
  );
}
