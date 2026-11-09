'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  FileText,
  Download,
  Copy,
  Check,
  Search,
  RefreshCw,
  Inbox
} from 'lucide-react';
import { fetchArtifacts } from '@/lib/api-client';
import { ExecutiveDeliverableView } from '@/components/ExecutiveDeliverableView';

export default function ArtifactsPage() {
  const [copied, setCopied] = useState(false);
  const [artifacts, setArtifacts] = useState<any[]>([]);
  const [selectedArtifact, setSelectedArtifact] = useState<any | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  const loadArtifacts = useCallback(async () => {
    try {
      const res = await fetchArtifacts();
      const list = res?.artifacts || [];
      setArtifacts(list);
      if (list.length > 0 && !selectedArtifact) {
        setSelectedArtifact(list[0]);
      }
    } catch {
      // ignore
    }
  }, [selectedArtifact]);

  useEffect(() => {
    loadArtifacts();
    const interval = setInterval(loadArtifacts, 5000);
    return () => clearInterval(interval);
  }, [loadArtifacts]);

  const handleCopy = () => {
    if (!selectedArtifact) return;
    const text = selectedArtifact.content_markdown || JSON.stringify(selectedArtifact.structured_data, null, 2);
    navigator.clipboard.writeText(text || '');
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const filteredArtifacts = artifacts.filter((doc) => {
    const q = searchQuery.toLowerCase();
    const author = doc.metadata?.created_by_agent || 'EI-AIOS';
    return (
      (doc.title || '').toLowerCase().includes(q) ||
      (doc.artifact_type || '').toLowerCase().includes(q) ||
      author.toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* HEADER */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <FileText className="w-6 h-6 text-indigo-400" />
            Repositório de Artefatos & Entregáveis Corporativos
          </h1>
          <p className="text-slate-400 text-sm mt-1">
            Galeria executiva de estudos de mercado, arquiteturas, laudos energéticos, propostas e dossiês gerados pelos agentes.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {selectedArtifact && (
            <>
              <button
                onClick={handleCopy}
                className="bg-slate-900 border border-slate-800 hover:border-slate-700 text-slate-200 px-3 py-1.5 rounded-lg text-xs flex items-center gap-1.5 transition"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copied ? 'Copiado!' : 'Copiar Documento'}</span>
              </button>
              <button
                onClick={() => window.print()}
                className="bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-bold px-3.5 py-1.5 rounded-lg text-xs flex items-center gap-1.5 transition shadow-md"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Exportar PDF</span>
              </button>
            </>
          )}
          <button
            onClick={loadArtifacts}
            className="bg-slate-900 border border-slate-800 hover:border-slate-700 text-slate-300 px-3 py-1.5 rounded-lg text-xs flex items-center gap-1.5 transition"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Atualizar ({artifacts.length})</span>
          </button>
        </div>
      </div>

      {artifacts.length === 0 ? (
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-12 text-center space-y-3">
          <Inbox className="w-10 h-10 text-slate-600 mx-auto" />
          <h3 className="text-base font-bold text-slate-200">Nenhum Artefato Gerado Ainda</h3>
          <p className="text-xs text-slate-400 max-w-md mx-auto">
            Envie uma instrução estratégica no Command Center (ex.: planejamento da plataforma, pesquisa de mercado ou auditoria energética) para que os agentes gerem entregáveis corporativos automaticamente.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* LISTA LATERAL DE DOCUMENTOS */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-3 h-fit">
            <div className="flex items-center gap-2 pb-2 border-b border-slate-800">
              <Search className="w-4 h-4 text-slate-500" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Buscar por título, tipo ou agente..."
                className="w-full bg-transparent text-xs text-white placeholder-slate-500 focus:outline-none"
              />
            </div>

            <div className="space-y-2 max-h-[650px] overflow-y-auto pr-1">
              {filteredArtifacts.map((doc) => {
                const isSelected = selectedArtifact?.id === doc.id;
                const author = doc.metadata?.created_by_agent || 'AG-001';
                return (
                  <div
                    key={doc.id}
                    onClick={() => setSelectedArtifact(doc)}
                    className={`p-3.5 rounded-xl border cursor-pointer transition space-y-1.5 ${
                      isSelected
                        ? 'bg-indigo-950/30 border-indigo-500/50 shadow-md'
                        : 'bg-slate-950 border-slate-800 hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-mono font-bold text-indigo-400 bg-indigo-950/60 border border-indigo-500/20 px-2 py-0.5 rounded uppercase">
                        {doc.artifact_type}
                      </span>
                      <span className="text-[10px] text-slate-500">
                        {doc.created_at ? new Date(doc.created_at).toLocaleDateString('pt-BR') : 'Hoje'}
                      </span>
                    </div>
                    <h3 className="text-xs font-bold text-slate-100 line-clamp-2 leading-snug">{doc.title}</h3>
                    <div className="flex items-center justify-between pt-1">
                      <span className="text-[10px] text-emerald-400 font-mono font-semibold">
                        Agente: {author}
                      </span>
                      {doc.metadata?.task_code && (
                        <span className="text-[10px] text-slate-500 font-mono">
                          {doc.metadata.task_code}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* VISUALIZADOR CORPORATIVO DE ENTREGÁVEL */}
          {selectedArtifact && (
            <div className="lg:col-span-2">
              <ExecutiveDeliverableView
                title={selectedArtifact.title}
                subtitle={selectedArtifact.summary}
                agentId={selectedArtifact.metadata?.created_by_agent || 'AG-001'}
                artifactType={selectedArtifact.artifact_type}
                taskCode={selectedArtifact.metadata?.task_code}
                createdAt={selectedArtifact.created_at}
                version={selectedArtifact.version || '1.0'}
                markdownContent={selectedArtifact.content_markdown}
                structuredData={selectedArtifact.structured_data}
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
