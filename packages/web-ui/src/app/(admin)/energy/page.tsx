'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  Activity,
  UploadCloud,
  Zap,
  TrendingDown,
  Scale,
  ShieldAlert,
  Link2,
  Copy,
  Check,
  Loader2,
  AlertTriangle
} from 'lucide-react';
import { uploadEnergyBill, fetchConsumerUnits, generateReport } from '@/lib/api-client';

interface ConsumerUnit {
  id: string;
  uc_code: string;
  unit_name: string;
  distributor: string;
  tariff_group: string;
  tariff_modality: string;
  contracted_demand_peak_kw: number;
  contracted_demand_offpeak_kw: number;
  client?: {
    id: string;
    company_name: string;
    cnpj: string;
    segment: string;
  };
}

interface AuditResult {
  demand_analysis: {
    contracted_kw: number;
    measured_kw: number;
    regulatory_tolerance_kw: number;
    has_overage: boolean;
    overage_kw: number;
    overage_penalty_brl: number;
    has_idle_demand: boolean;
    idle_demand_kw: number;
    monthly_idle_waste_brl: number;
    annual_idle_waste_brl: number;
    recommended_contracted_demand_kw: number;
  };
  load_factor_analysis: {
    total_consumption_kwh: number;
    max_measured_demand_kw: number;
    monthly_hours: number;
    load_factor: number;
    rating: string;
    diagnosis: string;
  };
  reactive_analysis: {
    excess_reactive_kwh: number;
    monthly_fine_brl: number;
    annual_penalty_brl: number;
    annual_avoidable_cost_brl: number;
    requires_capacitor_bank: boolean;
    payback_estimate_months: number;
  };
  modality_comparison: {
    current_modality: string;
    verde_annual_cost_brl: number;
    azul_annual_cost_brl: number;
    recommended_modality: string;
    monthly_savings_brl: number;
    annual_savings_brl: number;
    recommendation_rationale: string;
  };
  total_monthly_potential_savings_brl: number;
  total_annual_potential_savings_brl: number;
  audit_timestamp: string;
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

export default function EnergyAuditPage() {
  const [units, setUnits] = useState<ConsumerUnit[]>([]);
  const [selectedUcId, setSelectedUcId] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [auditResult, setAuditResult] = useState<AuditResult | null>(null);
  const [billId, setBillId] = useState<string | null>(null);
  const [uploadFeedback, setUploadFeedback] = useState<string | null>(null);
  const [reportLink, setReportLink] = useState<string | null>(null);
  const [isGeneratingReport, setIsGeneratingReport] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    fetchConsumerUnits()
      .then((data: ConsumerUnit[]) => {
        setUnits(data);
        if (data.length > 0) setSelectedUcId(data[0].id);
      })
      .catch(() => setUploadFeedback('Erro ao carregar unidades consumidoras'));
  }, []);

  const selectedUc = units.find(u => u.id === selectedUcId);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setSelectedFile(e.target.files[0]);
      setAuditResult(null);
      setBillId(null);
      setReportLink(null);
    }
  };

  const handleUpload = async () => {
    if (!selectedFile || !selectedUcId) return;

    setIsUploading(true);
    setUploadFeedback('Fazendo upload e processando OCR multimodal no Gemini...');
    setAuditResult(null);
    setBillId(null);
    setReportLink(null);

    try {
      const res = await uploadEnergyBill(selectedUcId, selectedFile);
      setAuditResult(res.auditResult);
      setBillId(res.extractedData?._bill_id || null);

      if (!res.auditResult) {
        setUploadFeedback('Upload concluído, mas o diagnóstico não retornou dados.');
      } else {
        setUploadFeedback('Diagnóstico processado com sucesso!');
      }
    } catch (err: any) {
      setUploadFeedback(`Erro: ${err?.message || 'Falha no upload'}`);
    } finally {
      setIsUploading(false);
    }
  };

  const handleGenerateReport = useCallback(async () => {
    if (!billId) return;
    setIsGeneratingReport(true);
    try {
      const res = await generateReport(billId);
      const baseUrl = typeof window !== 'undefined'
        ? `${window.location.origin}/report/${res.token}`
        : '';
      setReportLink(baseUrl);
    } catch (err: any) {
      setUploadFeedback(`Erro ao gerar relatório: ${err?.message}`);
    } finally {
      setIsGeneratingReport(false);
    }
  }, [billId]);

  const handleCopyLink = () => {
    if (reportLink) {
      navigator.clipboard.writeText(reportLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const demandPercent = auditResult
    ? Math.min(100, Math.round((auditResult.demand_analysis.measured_kw / (auditResult.demand_analysis.contracted_kw * 1.15)) * 100))
    : 0;
  const toleranceKw = auditResult ? auditResult.demand_analysis.regulatory_tolerance_kw : 0;

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* HEADER */}
      <div>
        <h1 className="text-2xl font-bold text-white flex items-center gap-2">
          <Activity className="w-6 h-6 text-emerald-400" />
          Auditoria de Faturas & Inteligência Energética
        </h1>
        <p className="text-slate-400 text-sm mt-1">
          Motor determinístico sem LLM (Grupo A/B) conforme a Resolução Normativa ANEEL nº 1.000/2021.
        </p>
      </div>

      {/* SELEÇÃO DE CLIENTE / UC E DROPZONE */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Seletor de Unidade */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
          <h2 className="text-sm font-bold text-slate-200 uppercase tracking-wide">
            1. Selecionar Unidade Consumidora:
          </h2>
          <div>
            <label className="text-xs text-slate-400 block mb-1">Cliente & Instalação:</label>
            <select
              value={selectedUcId}
              onChange={(e) => {
                setSelectedUcId(e.target.value);
                setAuditResult(null);
                setBillId(null);
                setReportLink(null);
              }}
              className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
            >
              {units.length === 0 && (
                <option value="">Carregando unidades...</option>
              )}
              {units.map((uc) => (
                <option key={uc.id} value={uc.id}>
                  {uc.client?.company_name || 'Cliente'} - {uc.unit_name || uc.uc_code} (UC: {uc.uc_code} | {uc.distributor} {uc.tariff_group} {uc.tariff_modality?.replace('HOROSSAZONAL_', '')})
                </option>
              ))}
            </select>
          </div>

          {selectedUc && (
            <div className="p-3 bg-slate-950 rounded-lg border border-slate-800 text-xs text-slate-400 space-y-1 font-mono">
              <div>Distribuidora: <span className="text-white">{selectedUc.distributor}</span></div>
              <div>Subgrupo: <span className="text-emerald-400 font-bold">{selectedUc.tariff_group}</span></div>
              <div>Modalidade: <span className="text-white">{MODALITY_LABELS[selectedUc.tariff_modality] || selectedUc.tariff_modality}</span></div>
              <div>Demanda Contratada: <span className="text-white">{selectedUc.contracted_demand_peak_kw} kW</span></div>
              {selectedUc.client?.cnpj && (
                <div>CNPJ: <span className="text-white">{selectedUc.client.cnpj}</span></div>
              )}
            </div>
          )}
        </div>

        {/* Dropzone de Fatura */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 md:col-span-2 flex flex-col justify-between">
          <div>
            <h2 className="text-sm font-bold text-slate-200 uppercase tracking-wide mb-2">
              2. Upload da Fatura de Energia (PDF ou Imagem):
            </h2>
            <div className="border-2 border-dashed border-slate-700 hover:border-emerald-500/60 rounded-xl p-6 text-center cursor-pointer transition bg-slate-950/40">
              <UploadCloud className="w-10 h-10 text-emerald-400 mx-auto mb-2" />
              <input
                type="file"
                accept=".pdf,image/*"
                onChange={handleFileChange}
                className="hidden"
                id="bill-upload-input"
              />
              <label htmlFor="bill-upload-input" className="cursor-pointer">
                <span className="text-xs text-emerald-400 font-semibold block hover:underline">
                  {selectedFile ? selectedFile.name : 'Clique para selecionar ou arraste o arquivo PDF aqui'}
                </span>
                <span className="text-[11px] text-slate-500 block mt-1">
                  Extração automática de grandezas elétricas e tributos via Gemini OCR
                </span>
              </label>
            </div>
          </div>

          <div className="flex items-center justify-between mt-4">
            <span className="text-xs text-slate-400 font-mono">{uploadFeedback}</span>
            <button
              onClick={handleUpload}
              disabled={isUploading || !selectedFile || !selectedUcId}
              className="bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 text-slate-950 font-bold px-5 py-2 rounded-lg text-xs flex items-center gap-2 transition"
            >
              {isUploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
              <span>{isUploading ? 'Processando...' : 'Iniciar Diagnóstico Automático (WF-003)'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* RESULTADOS DO DIAGNÓSTICO DETERMINÍSTICO */}
      {auditResult && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
              <Scale className="w-4 h-4 text-emerald-400" />
              Laudo de Auditoria Tarifária (Referência: {auditResult.audit_timestamp?.slice(0, 10) || 'N/A'})
            </h2>
            <div className="flex gap-2">
              {billId && !reportLink && (
                <button
                  onClick={handleGenerateReport}
                  disabled={isGeneratingReport}
                  className="bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 text-slate-950 text-xs px-4 py-1.5 rounded-lg font-bold flex items-center gap-1.5 transition"
                >
                  {isGeneratingReport ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Link2 className="w-3.5 h-3.5" />}
                  <span>{isGeneratingReport ? 'Gerando...' : 'Gerar Relatório para Cliente'}</span>
                </button>
              )}
              {reportLink && (
                <div className="flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/30 rounded-lg px-3 py-1.5">
                  <Link2 className="w-3.5 h-3.5 text-emerald-400" />
                  <a href={reportLink} target="_blank" rel="noopener noreferrer" className="text-xs text-emerald-400 hover:underline font-mono truncate max-w-[300px]">
                    {reportLink}
                  </a>
                  <button onClick={handleCopyLink} className="text-emerald-400 hover:text-emerald-300 transition">
                    {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* 4 CARDS DETERMINÍSTICOS */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {/* Card 1: Demanda */}
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-3">
              <span className="text-xs text-slate-400 font-semibold block uppercase">Demanda Contratada vs Medida</span>
              <div className="flex items-baseline justify-between">
                <span className="text-xl font-bold text-white">{auditResult.demand_analysis.measured_kw} kW</span>
                <span className="text-xs text-slate-400">Contratada: {auditResult.demand_analysis.contracted_kw} kW</span>
              </div>
              <div className="space-y-1">
                <div className="h-2 w-full bg-slate-950 rounded-full overflow-hidden flex">
                  <div
                    className={`h-full ${auditResult.demand_analysis.has_overage ? 'bg-emerald-500' : 'bg-emerald-500'}`}
                    style={{ width: `${Math.min(demandPercent, 87)}%` }}
                  />
                  {auditResult.demand_analysis.has_overage && (
                    <div className="bg-rose-500 h-full" style={{ width: `${Math.max(demandPercent - 87, 5)}%` }} />
                  )}
                </div>
                <div className="flex justify-between text-[10px] text-slate-500">
                  <span>0 kW</span>
                  <span className="text-amber-400 font-semibold">Tol. 5% ({toleranceKw} kW)</span>
                  <span className={auditResult.demand_analysis.has_overage ? 'text-rose-400 font-semibold' : 'text-emerald-400'}>
                    {auditResult.demand_analysis.measured_kw} kW {auditResult.demand_analysis.has_overage ? '(Ultrapassado)' : '(OK)'}
                  </span>
                </div>
              </div>
              {auditResult.demand_analysis.has_overage && (
                <p className="text-[11px] text-rose-400 font-semibold pt-1">
                  Multa de Ultrapassagem: R$ {formatBrl(auditResult.demand_analysis.overage_penalty_brl)}
                </p>
              )}
              {auditResult.demand_analysis.has_idle_demand && (
                <p className="text-[11px] text-amber-400 pt-1">
                  Ociosidade: {auditResult.demand_analysis.idle_demand_kw} kW (R$ {formatBrl(auditResult.demand_analysis.annual_idle_waste_brl)}/ano)
                </p>
              )}
            </div>

            {/* Card 2: Energia Reativa */}
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-3">
              <span className="text-xs text-slate-400 font-semibold block uppercase">Energia Reativa (UFER/DMCR)</span>
              <div className="text-xl font-bold text-amber-400">
                R$ {formatBrl(auditResult.reactive_analysis.monthly_fine_brl)} / mês
              </div>
              <p className="text-[11px] text-slate-400">
                Custo anual evitável de <strong className="text-white">R$ {formatBrl(auditResult.reactive_analysis.annual_avoidable_cost_brl)}</strong>.
              </p>
              {auditResult.reactive_analysis.requires_capacitor_bank && (
                <div className="p-2 bg-slate-950 rounded border border-slate-800 text-[11px] text-emerald-400">
                  Payback estimado do banco de capacitores: <strong>{auditResult.reactive_analysis.payback_estimate_months} meses</strong>.
                </div>
              )}
              {!auditResult.reactive_analysis.requires_capacitor_bank && auditResult.reactive_analysis.monthly_fine_brl === 0 && (
                <div className="p-2 bg-slate-950 rounded border border-slate-800 text-[11px] text-emerald-400">
                  Fator de potência dentro dos limites regulatórios.
                </div>
              )}
            </div>

            {/* Card 3: Comparativo Verde vs Azul */}
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-3">
              <span className="text-xs text-slate-400 font-semibold block uppercase">Enquadramento Horossazonal</span>
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 rounded text-xs font-bold font-mono">
                  {auditResult.modality_comparison.recommended_modality} RECOMENDADA
                </span>
              </div>
              <p className="text-[11px] text-slate-400 leading-relaxed">
                {auditResult.modality_comparison.recommendation_rationale}
              </p>
              {auditResult.modality_comparison.annual_savings_brl > 0 && (
                <p className="text-[11px] text-emerald-400">
                  Economia potencial: R$ {formatBrl(auditResult.modality_comparison.annual_savings_brl)}/ano
                </p>
              )}
            </div>

            {/* Card 4: Economia Consolidada */}
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-3">
              <span className="text-xs text-slate-400 font-semibold block uppercase">Potencial de Economia Total</span>
              <div className="text-2xl font-bold text-emerald-400">
                R$ {formatBrl(auditResult.total_annual_potential_savings_brl)} / ano
              </div>
              <div className="text-xs text-slate-300 font-mono">
                R$ {formatBrl(auditResult.total_monthly_potential_savings_brl)} / mês
              </div>
              <span className="inline-block text-[10px] text-emerald-400/80 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded">
                Base para Success Fee de 20%
              </span>
            </div>
          </div>

          {/* Fator de Carga */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-400 font-semibold uppercase">Fator de Carga</span>
              <span className={`text-xs font-bold px-2 py-0.5 rounded ${
                auditResult.load_factor_analysis.rating === 'excelente' ? 'bg-emerald-500/20 text-emerald-400' :
                auditResult.load_factor_analysis.rating === 'adequado' ? 'bg-sky-500/20 text-sky-400' :
                auditResult.load_factor_analysis.rating === 'baixo' ? 'bg-amber-500/20 text-amber-400' :
                'bg-rose-500/20 text-rose-400'
              }`}>
                {(auditResult.load_factor_analysis.load_factor * 100).toFixed(1)}% — {auditResult.load_factor_analysis.rating.toUpperCase()}
              </span>
            </div>
            <p className="text-[11px] text-slate-400 mt-2">{auditResult.load_factor_analysis.diagnosis}</p>
          </div>
        </div>
      )}

      {/* Estado vazio */}
      {!auditResult && !isUploading && (
        <div className="bg-slate-900/50 border border-slate-800 border-dashed rounded-xl p-12 text-center">
          <AlertTriangle className="w-10 h-10 text-slate-600 mx-auto mb-3" />
          <p className="text-sm text-slate-500">
            Selecione uma unidade consumidora e faça upload de uma fatura para iniciar o diagnóstico.
          </p>
        </div>
      )}
    </div>
  );
}
