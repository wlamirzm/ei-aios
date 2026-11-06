'use client';

import React, { useState } from 'react';
import {
  FileText,
  Download,
  Copy,
  ExternalLink,
  Check,
  Search,
  Filter
} from 'lucide-react';

export default function ArtifactsPage() {
  const [copied, setCopied] = useState(false);
  const [selectedArtifact, setSelectedArtifact] = useState({
    title: 'Relatório Executivo de Auditoria Energética - Paulínia (2024-05)',
    type: 'energy_diagnosis',
    date: '06/11/2026',
    author: 'AG-003 (Energy Specialist)',
    content: `# RELATÓRIO EXECUTIVO DE AUDITORIA E INTELIGÊNCIA ENERGÉTICA
**Cliente:** Indústrias Metalúrgicas Alvorada S.A. | **Unidade:** Paulínia (UC: 9876543210)
**Data:** 06/11/2026 | **Motor de Cálculo:** EI-AIOS Deterministic v1.0 (Sem LLM)

---

## 1. RESUMO EXECUTIVO DO DIAGNÓSTICO
* **Economia Mensal Identificada:** R$ 3.204,16
* **Economia Anual Projetada:** R$ 38.450,00
* **Classificação de Fator de Carga:** ADEQUADO (58.4%)

---

## 2. ANÁLISE DE DEMANDA CONTRATADA E REGULAÇÃO ANEEL
* **Demanda Contratada Atual:** 250 kW
* **Demanda Máxima Registrada:** 285 kW
* **Tolerância Regulatória (5%):** 262.5 kW
* **Status:** ⚠️ Ultrapassagem identificada (35 kW acima do contratado)
* **Multa de Ultrapassagem Apurada:** R$ 1.715,00
* **Recomendação:** Recontratar demanda para 220 kW para eliminar multas e ociosidade nos meses de baixa.

---

## 3. ENERGIA REATIVA EXCEDENTE & BANCO DE CAPACITORES
* **Multa Mensal Apurada:** R$ 1.240,00
* **Custo Evitável Anual:** R$ 14.880,00
* **Recomendação:** Instalação de banco de capacitores automático de 45 kVAr.
* **Payback Estimado:** 6.5 meses.`
  });

  const handleCopy = () => {
    navigator.clipboard.writeText(selectedArtifact.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* HEADER */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <FileText className="w-6 h-6 text-indigo-400" />
            Repositório de Artefatos & Entregáveis
          </h1>
          <p className="text-slate-400 text-sm mt-1">
            Galeria central de laudos, propostas comerciais, cartas de intenção e petições geradas pelos agentes.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* LISTA LATERAL DE DOCUMENTOS */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-3">
          <div className="flex items-center gap-2 pb-2 border-b border-slate-800">
            <Search className="w-4 h-4 text-slate-500" />
            <input
              type="text"
              placeholder="Buscar artefato por título ou cliente..."
              className="w-full bg-transparent text-xs text-white placeholder-slate-500 focus:outline-none"
            />
          </div>

          <div className="space-y-2">
            {[
              {
                title: 'Relatório Executivo de Auditoria Energética - Paulínia (2024-05)',
                type: 'energy_diagnosis',
                date: '06/11/2026',
                author: 'AG-003'
              },
              {
                title: 'Dossiê de Contestação ANEEL REN 1.000/2021 - Cobrança Indevida',
                type: 'contest_dossier',
                date: '05/11/2026',
                author: 'AG-009'
              },
              {
                title: 'Carta de Intenção (LOI) & Proposta Comercial Piloto SaaS',
                type: 'commercial_proposal',
                date: '04/11/2026',
                author: 'AG-007'
              },
              {
                title: 'Relatório Mensal de M&V e Apuração de Success Fee (2024-04)',
                type: 'mv_report',
                date: '01/11/2026',
                author: 'AG-010'
              }
            ].map((doc, idx) => (
              <div
                key={idx}
                className="p-3 bg-slate-950 rounded-lg border border-slate-800 hover:border-slate-700 cursor-pointer transition space-y-1"
              >
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-mono text-indigo-400 bg-indigo-950/60 px-1.5 py-0.5 rounded">
                    {doc.type}
                  </span>
                  <span className="text-[10px] text-slate-500">{doc.date}</span>
                </div>
                <h3 className="text-xs font-semibold text-slate-200 line-clamp-1">{doc.title}</h3>
                <span className="text-[10px] text-slate-400 block font-mono">Autor: {doc.author}</span>
              </div>
            ))}
          </div>
        </div>

        {/* VISUALIZADOR DE MARKDOWN INTEGRADO */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 lg:col-span-2 flex flex-col justify-between shadow-xl">
          <div className="space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div>
                <span className="text-[10px] font-mono uppercase bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 px-2 py-0.5 rounded font-bold">
                  {selectedArtifact.type}
                </span>
                <h2 className="text-base font-bold text-white mt-1">{selectedArtifact.title}</h2>
              </div>

              <div className="flex gap-2">
                <button
                  onClick={handleCopy}
                  className="bg-slate-800 hover:bg-slate-700 text-slate-200 px-3 py-1.5 rounded-lg text-xs flex items-center gap-1.5 transition"
                >
                  {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copied ? 'Copiado!' : 'Copiar'}</span>
                </button>
                <button
                  onClick={() => window.print()}
                  className="bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-bold px-3 py-1.5 rounded-lg text-xs flex items-center gap-1.5 transition"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Exportar PDF</span>
                </button>
              </div>
            </div>

            {/* Renderização do Markdown */}
            <div className="bg-slate-950 p-5 rounded-lg border border-slate-800 text-xs text-slate-300 font-mono leading-relaxed max-h-[500px] overflow-y-auto whitespace-pre-wrap">
              {selectedArtifact.content}
            </div>
          </div>

          <div className="pt-4 border-t border-slate-800 text-[11px] text-slate-500 flex justify-between">
            <span>Auditado e assinado digitalmente pelo AG-008</span>
            <span>Versão 1.0 • Supabase Storage Persisted</span>
          </div>
        </div>
      </div>
    </div>
  );
}

