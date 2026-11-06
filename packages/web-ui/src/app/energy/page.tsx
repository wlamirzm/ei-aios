'use client';

import React, { useState } from 'react';
import {
  Activity,
  UploadCloud,
  FileText,
  AlertTriangle,
  Zap,
  TrendingDown,
  Scale,
  ArrowRight,
  ShieldAlert
} from 'lucide-react';
import { uploadEnergyBill } from '@/lib/api-client';

export default function EnergyAuditPage() {
  const [selectedUc, setSelectedUc] = useState('b2c3d4e5-f6a7-8b9c-0d1e-2f3a4b5c6d7e');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [auditResult, setAuditResult] = useState<any>(null);
  const [uploadFeedback, setUploadFeedback] = useState<string | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setSelectedFile(e.target.files[0]);
    }
  };

  const handleUpload = async () => {
    if (!selectedFile) return;

    setIsUploading(true);
    setUploadFeedback('Fazendo upload e processando OCR multimodal no Gemini...');
    try {
      const res = await uploadEnergyBill(selectedUc, selectedFile);
      setAuditResult(res.auditResult);
      setUploadFeedback('Diagnóstico processado com sucesso pelo energy-calculator.ts!');
    } catch (err: any) {
      setUploadFeedback(`Erro: ${err?.message || 'Falha no upload'}`);
    } finally {
      setIsUploading(false);
    }
  };

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
              value={selectedUc}
              onChange={(e) => setSelectedUc(e.target.value)}
              className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
            >
              <option value="b2c3d4e5-f6a7-8b9c-0d1e-2f3a4b5c6d7e">
                Metalúrgica Alvorada - Planta Paulínia (UC: 9876543210 | CPFL A4 Verde)
              </option>
            </select>
          </div>

          <div className="p-3 bg-slate-950 rounded-lg border border-slate-800 text-xs text-slate-400 space-y-1 font-mono">
            <div>Distribuidora: <span className="text-white">CPFL Paulista</span></div>
            <div>Subgrupo: <span className="text-emerald-400 font-bold">A4 (2,3 kV a 25 kV)</span></div>
            <div>Modalidade: <span className="text-white">Horossazonal Verde</span></div>
            <div>Demanda Contratada: <span className="text-white">250 kW</span></div>
          </div>
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
              disabled={isUploading || !selectedFile}
              className="bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 text-slate-950 font-bold px-5 py-2 rounded-lg text-xs flex items-center gap-2 transition"
            >
              <Zap className="w-4 h-4" />
              <span>{isUploading ? 'Processando...' : 'Iniciar Diagnóstico Automático (WF-003)'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* RESULTADOS DO DIAGNÓSTICO DETERMINÍSTICO */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
            <Scale className="w-4 h-4 text-emerald-400" />
            Laudo de Auditoria Tarifária (Referência: 2024-05)
          </h2>
          <div className="flex gap-2">
            <button className="bg-slate-800 hover:bg-slate-700 text-xs px-3 py-1.5 rounded-lg border border-slate-700 text-slate-300 flex items-center gap-1.5 transition">
              <ShieldAlert className="w-3.5 h-3.5 text-amber-400" />
              <span>Gerar Dossiê ANEEL (WF-007)</span>
            </button>
            <button className="bg-slate-800 hover:bg-slate-700 text-xs px-3 py-1.5 rounded-lg border border-slate-700 text-slate-300 flex items-center gap-1.5 transition">
              <Activity className="w-3.5 h-3.5 text-emerald-400" />
              <span>Relatório de M&V (WF-008)</span>
            </button>
          </div>
        </div>

        {/* 4 CARDS DETERMINÍSTICOS */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {/* Card 1: Demanda e Limite 105% */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-3">
            <span className="text-xs text-slate-400 font-semibold block uppercase">Demanda Contratada vs Medida</span>
            <div className="flex items-baseline justify-between">
              <span className="text-xl font-bold text-white">285 kW</span>
              <span className="text-xs text-slate-400">Contratada: 250 kW</span>
            </div>
            {/* Barra de Limite */}
            <div className="space-y-1">
              <div className="h-2 w-full bg-slate-950 rounded-full overflow-hidden flex">
                <div className="bg-emerald-500 h-full w-[87%]"></div>
                <div className="bg-rose-500 h-full w-[13%]"></div>
              </div>
              <div className="flex justify-between text-[10px] text-slate-500">
                <span>0 kW</span>
                <span className="text-amber-400 font-semibold">Tol. 5% (262.5 kW)</span>
                <span className="text-rose-400 font-semibold">285 kW (Ultrapassado)</span>
              </div>
            </div>
            <p className="text-[11px] text-rose-400 font-semibold pt-1">
              ⚠️ Multa de Ultrapassagem: R$ 1.715,00
            </p>
          </div>

          {/* Card 2: Energia Reativa Excedente */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-3">
            <span className="text-xs text-slate-400 font-semibold block uppercase">Energia Reativa (UFER/DMCR)</span>
            <div className="text-xl font-bold text-amber-400">R$ 1.240,00 / mês</div>
            <p className="text-[11px] text-slate-400">
              Custo anual evitável de <strong className="text-white">R$ 14.880,00</strong>.
            </p>
            <div className="p-2 bg-slate-950 rounded border border-slate-800 text-[11px] text-emerald-400">
              Payback estimado do banco de capacitores: <strong>6.5 meses</strong>.
            </div>
          </div>

          {/* Card 3: Comparativo Verde vs Azul */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-3">
            <span className="text-xs text-slate-400 font-semibold block uppercase">Enquadramento Horossazonal</span>
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 rounded text-xs font-bold font-mono">
                VERDE RECOMENDADA
              </span>
            </div>
            <p className="text-[11px] text-slate-400 leading-relaxed">
              Modalidade Verde projeta menor custo anual (R$ 748.200) versus Azul (R$ 794.100) para este perfil de carga.
            </p>
          </div>

          {/* Card 4: Economia Consolidada */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-3">
            <span className="text-xs text-slate-400 font-semibold block uppercase">Potencial de Economia Total</span>
            <div className="text-2xl font-bold text-emerald-400">R$ 38.450 / ano</div>
            <div className="text-xs text-slate-300 font-mono">
              R$ 3.204,16 / mês líquido
            </div>
            <span className="inline-block text-[10px] text-emerald-400/80 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded">
              Base para Success Fee de 20%
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

