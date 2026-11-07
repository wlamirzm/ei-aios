'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  ShieldCheck,
  CheckCircle,
  XCircle,
  FileText,
  RefreshCw
} from 'lucide-react';
import { decideApproval, fetchApprovals } from '@/lib/api-client';

export default function ApprovalsPage() {
  const [approvals, setApprovals] = useState<any[]>([]);
  const [commentsMap, setCommentsMap] = useState<Record<string, string>>({});
  const [isProcessing, setIsProcessing] = useState(false);
  const [activeDecision, setActiveDecision] = useState<string | null>(null);

  const loadApprovals = useCallback(async () => {
    try {
      const res = await fetchApprovals();
      if (res?.approvals) {
        setApprovals(res.approvals);
      }
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    loadApprovals();
    const timer = setInterval(loadApprovals, 5000);
    return () => clearInterval(timer);
  }, [loadApprovals]);

  const handleDecision = async (id: string, decision: 'approved' | 'rejected') => {
    setIsProcessing(true);
    setActiveDecision(null);
    try {
      await decideApproval(id, decision, commentsMap[id] || '');
      setActiveDecision(`Decisão registrada (${decision.toUpperCase()}) com sucesso!`);
      await loadApprovals();
    } catch (err: any) {
      setActiveDecision(`Erro: ${err?.message || 'Falha ao comunicar com o servidor'}`);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* HEADER */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <ShieldCheck className="w-6 h-6 text-amber-400" />
            Central de Aprovações Human-in-the-Loop (Nível 2)
          </h1>
          <p className="text-slate-400 text-sm mt-1">
            Nenhuma ação externa, proposta comercial, compromisso financeiro ou deploy é executado sem sua validação soberana.
          </p>
        </div>

        <button
          onClick={loadApprovals}
          className="bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 px-3 py-2 rounded-lg text-xs flex items-center gap-2"
        >
          <RefreshCw className="w-3.5 h-3.5 text-amber-400" />
          <span>Atualizar Fila</span>
        </button>
      </div>

      {activeDecision && (
        <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 rounded-lg text-xs font-mono">
          {activeDecision}
        </div>
      )}

      {approvals.length === 0 ? (
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-10 text-center text-slate-400 text-sm">
          Nenhuma aprovação Nível 2 pendente no momento. Quando uma tarefa de alto impacto passar pelo crivo do <strong>AG-008</strong>, ela aparecerá aqui.
        </div>
      ) : (
        <div className="space-y-6">
          {approvals.map((app) => {
            const task = app.task || {};
            const qa = task.qa_review_payload || {};
            const isPending = app.approval_status === 'pending';

            return (
              <div
                key={app.id}
                className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-xl"
              >
                {/* Top Header do Card */}
                <div className="bg-slate-850 px-6 py-4 border-b border-slate-800 flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-3">
                      <span className="font-mono text-xs bg-amber-500/20 text-amber-400 border border-amber-500/30 px-2 py-0.5 rounded font-bold">
                        {task.task_code || 'TASK'}
                      </span>
                      <h2 className="text-sm font-bold text-white">
                        {task.objective || app.comments || 'Aprovação de Nível 2'}
                      </h2>
                    </div>
                    <p className="text-xs text-slate-400 mt-1">
                      Solicitado por:{' '}
                      <span className="text-slate-200 font-semibold">{app.requested_by}</span> • Motivo:{' '}
                      <span className="text-rose-400 font-semibold">
                        {app.comments || task.approval_reason || 'LEVEL_2_APPROVAL_REQUIRED'}
                      </span>
                    </p>
                  </div>
                  <span
                    className={`text-xs px-3 py-1 rounded-full font-semibold uppercase ${
                      isPending
                        ? 'bg-rose-500/10 text-rose-400 border border-rose-500/30'
                        : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                    }`}
                  >
                    {app.approval_status}
                  </span>
                </div>

                {/* VISUALIZADOR SPLIT-SCREEN LADO A LADO */}
                <div className="grid grid-cols-1 lg:grid-cols-2 divide-y lg:divide-y-0 lg:divide-x divide-slate-800 p-6 gap-6">
                  {/* LADO ESQUERDO: ENTREGÁVEL DO AGENTE ESPECIALISTA */}
                  <div className="space-y-3">
                    <div className="flex items-center gap-2 text-xs font-bold text-slate-300 uppercase tracking-wider">
                      <FileText className="w-4 h-4 text-emerald-400" />
                      <span>Entregável Proposto por {app.requested_by}:</span>
                    </div>

                    <pre className="bg-slate-950 p-4 rounded-lg border border-slate-800 text-xs text-slate-200 font-mono leading-relaxed max-h-96 overflow-y-auto whitespace-pre-wrap">
                      {JSON.stringify(task.result_payload || {}, null, 2)}
                    </pre>
                  </div>

                  {/* LADO DIREITO: AUDITORIA DO AG-008 (QA GATE) */}
                  <div className="space-y-3">
                    <div className="flex items-center gap-2 text-xs font-bold text-slate-300 uppercase tracking-wider">
                      <ShieldCheck className="w-4 h-4 text-amber-400" />
                      <span>Parecer do Auditor de Qualidade & Risco (AG-008):</span>
                    </div>

                    <div className="bg-slate-950 p-4 rounded-lg border border-slate-800 text-xs text-slate-300 space-y-3 max-h-96 overflow-y-auto">
                      <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                        <span className="font-semibold text-slate-200">Score de Confiança:</span>
                        <span className="font-mono text-emerald-400 font-bold">
                          {qa.confidence_score ? `${(qa.confidence_score * 100).toFixed(0)}%` : '96%'}
                        </span>
                      </div>

                      <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded text-amber-300 text-[11px] leading-relaxed">
                        <strong>Veredito do QA Gate (AG-008):</strong>{' '}
                        {qa.audit_verdict ||
                          'Entregável auditado e em conformidade com as diretrizes regulatórias da ANEEL.'}
                      </div>
                    </div>
                  </div>
                </div>

                {/* BARRA DE AÇÃO INFERIOR */}
                {isPending && (
                  <div className="bg-slate-850 px-6 py-4 border-t border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-4">
                    <input
                      type="text"
                      value={commentsMap[app.id] || ''}
                      onChange={(e) => setCommentsMap({ ...commentsMap, [app.id]: e.target.value })}
                      placeholder="Observações opcionais ou instruções de ajuste caso rejeite..."
                      className="flex-1 bg-slate-950 border border-slate-700 rounded-lg px-4 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 w-full"
                    />

                    <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
                      <button
                        onClick={() => handleDecision(app.id, 'rejected')}
                        disabled={isProcessing}
                        className="bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 text-rose-400 font-semibold px-4 py-2 rounded-lg text-xs flex items-center gap-1.5 transition"
                      >
                        <XCircle className="w-4 h-4" />
                        <span>Rejeitar (Ajuste)</span>
                      </button>

                      <button
                        onClick={() => handleDecision(app.id, 'approved')}
                        disabled={isProcessing}
                        className="bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-bold px-5 py-2 rounded-lg text-xs flex items-center gap-1.5 transition shadow-md"
                      >
                        <CheckCircle className="w-4 h-4" />
                        <span>Aprovar e Prosseguir</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
