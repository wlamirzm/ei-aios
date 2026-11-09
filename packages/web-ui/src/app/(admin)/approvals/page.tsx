'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  ShieldCheck,
  CheckCircle,
  XCircle,
  RefreshCw,
  Award,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';
import { decideApproval, fetchApprovals } from '@/lib/api-client';
import { ExecutiveDeliverableView } from '@/components/ExecutiveDeliverableView';

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
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* HEADER */}
      <div className="flex items-center justify-between flex-wrap gap-3">
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
          className="bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 px-3.5 py-2 rounded-lg text-xs flex items-center gap-2 transition"
        >
          <RefreshCw className="w-3.5 h-3.5 text-amber-400" />
          <span>Atualizar Fila ({approvals.length})</span>
        </button>
      </div>

      {activeDecision && (
        <div className="p-3.5 bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 rounded-xl text-xs font-mono flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{activeDecision}</span>
        </div>
      )}

      {approvals.length === 0 ? (
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-12 text-center text-slate-400 text-sm">
          Nenhuma aprovação Nível 2 pendente no momento. Quando uma tarefa de alto impacto passar pelo crivo do <strong>AG-008</strong>, ela aparecerá aqui em formato executivo.
        </div>
      ) : (
        <div className="space-y-8">
          {approvals.map((app) => {
            const task = app.task || {};
            const qa = task.qa_review_payload || {};
            const isPending = app.approval_status === 'pending';

            return (
              <div
                key={app.id}
                className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-2xl"
              >
                {/* Top Header do Card */}
                <div className="bg-gradient-to-r from-slate-900 via-slate-900 to-amber-950/30 px-6 py-4 border-b border-slate-800 flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-3 flex-wrap">
                      <span className="font-mono text-xs bg-amber-500/20 text-amber-400 border border-amber-500/30 px-2.5 py-0.5 rounded-md font-bold">
                        {task.task_code || 'TASK'}
                      </span>
                      <span className="font-mono text-xs bg-indigo-500/15 text-indigo-300 border border-indigo-500/30 px-2.5 py-0.5 rounded-md font-bold">
                        Agente: {app.requested_by}
                      </span>
                      <h2 className="text-sm font-bold text-white">
                        {task.objective || app.comments || 'Aprovação Executiva de Nível 2'}
                      </h2>
                    </div>
                    <p className="text-xs text-slate-400 mt-1.5 flex items-center gap-1.5">
                      <AlertCircle className="w-3.5 h-3.5 text-amber-400" />
                      <span>Gatilho de Governança Nível 2:</span>
                      <span className="text-amber-300 font-semibold">
                        {app.comments || task.approval_reason || 'Validação Soberana do Fundador Obrigatória'}
                      </span>
                    </p>
                  </div>
                  <span
                    className={`text-xs px-3.5 py-1 rounded-full font-bold uppercase tracking-wider ${
                      isPending
                        ? 'bg-rose-500/15 text-rose-400 border border-rose-500/30'
                        : 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                    }`}
                  >
                    {isPending ? 'Aguardando Decisão' : app.approval_status}
                  </span>
                </div>

                {/* VISUALIZADOR EXECUTIVO CORPORATIVO */}
                <div className="p-6">
                  <ExecutiveDeliverableView
                    title={task.result_payload?.deliverable_title || task.objective}
                    subtitle={`Submetido por ${app.requested_by} para Aprovação Nível 2`}
                    agentId={app.requested_by || task.assigned_agent_id || 'AG-001'}
                    artifactType={task.task_type || 'strategic_plan'}
                    taskCode={task.task_code}
                    createdAt={app.created_at || task.created_at}
                    structuredData={task.result_payload || {}}
                    qaReview={qa}
                    compact
                  />
                </div>

                {/* BARRA DE AÇÃO INFERIOR */}
                {isPending && (
                  <div className="bg-slate-950/90 px-6 py-4 border-t border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-4">
                    <div className="flex items-center gap-2 flex-1 w-full">
                      <Award className="w-4 h-4 text-amber-400 shrink-0 hidden sm:block" />
                      <input
                        type="text"
                        value={commentsMap[app.id] || ''}
                        onChange={(e) => setCommentsMap({ ...commentsMap, [app.id]: e.target.value })}
                        placeholder="Observações executivas opcionais ou diretrizes de ajuste caso solicite retrabalho..."
                        className="flex-1 bg-slate-900 border border-slate-700 rounded-xl px-4 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 w-full"
                      />
                    </div>

                    <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
                      <button
                        onClick={() => handleDecision(app.id, 'rejected')}
                        disabled={isProcessing}
                        className="bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 text-rose-400 font-semibold px-4 py-2.5 rounded-xl text-xs flex items-center gap-1.5 transition"
                      >
                        <XCircle className="w-4 h-4" />
                        <span>Solicitar Ajustes</span>
                      </button>

                      <button
                        onClick={() => handleDecision(app.id, 'approved')}
                        disabled={isProcessing}
                        className="bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-bold px-5 py-2.5 rounded-xl text-xs flex items-center gap-1.5 transition shadow-lg"
                      >
                        <CheckCircle className="w-4 h-4" />
                        <span>Aprovar Entrega (Nível 2)</span>
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
