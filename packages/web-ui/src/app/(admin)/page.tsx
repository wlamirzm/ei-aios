'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  Zap,
  ShieldAlert,
  TrendingDown,
  Coins,
  Send,
  Play,
  CheckCircle2,
  Clock,
  RefreshCw,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import {
  createObjective,
  fetchTasks,
  fetchApprovals,
  fetchFinOpsMetrics,
  triggerWorkerCycle
} from '@/lib/api-client';

export default function CommandCenterPage() {
  const [objective, setObjective] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [isError, setIsError] = useState(false);
  const [lastPlan, setLastPlan] = useState<any | null>(null);

  const [tasks, setTasks] = useState<any[]>([]);
  const [approvalsCount, setApprovalsCount] = useState(0);
  const [finops, setFinops] = useState<any>(null);
  const [expandedTaskId, setExpandedTaskId] = useState<string | null>(null);

  const loadLiveState = useCallback(async () => {
    try {
      const [tasksRes, approvalsRes, finopsRes] = await Promise.all([
        fetchTasks().catch(() => ({ tasks: [] })),
        fetchApprovals().catch(() => ({ approvals: [] })),
        fetchFinOpsMetrics().catch(() => null)
      ]);
      if (tasksRes?.tasks) setTasks(tasksRes.tasks);
      if (approvalsRes?.approvals) {
        const pending = approvalsRes.approvals.filter((a: any) => a.approval_status === 'pending');
        setApprovalsCount(pending.length);
      }
      if (finopsRes) setFinops(finopsRes);
    } catch {
      // Silencioso no polling
    }
  }, []);

  useEffect(() => {
    loadLiveState();
    const timer = setInterval(loadLiveState, 5000);
    return () => clearInterval(timer);
  }, [loadLiveState]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!objective.trim()) return;

    setIsSubmitting(true);
    setFeedback(null);
    setIsError(false);
    try {
      const res = await createObjective(objective, 'P1');
      setFeedback(`Objetivo registrado e decomposto com sucesso pelo AG-001! Tarefa-mãe: ${res.parentTaskId}`);
      setLastPlan(res.plan || null);
      setObjective('');
      await loadLiveState();
    } catch (err: any) {
      setIsError(true);
      setFeedback(`Erro ao registrar objetivo: ${err?.message || 'Falha na conexão com o Agent Core'}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleQuickWorkflow = async (code: string, desc: string) => {
    setIsSubmitting(true);
    setFeedback(null);
    setIsError(false);
    try {
      const res = await createObjective(`Disparar ${code}: ${desc}`, 'P1', undefined, code);
      setFeedback(`Workflow ${code} acionado com sucesso! Tarefa-mãe: ${res.parentTaskId}`);
      setLastPlan(res.plan || null);
      await loadLiveState();
    } catch (err: any) {
      setIsError(true);
      setFeedback(`Erro ao acionar workflow: ${err?.message || 'Falha de comunicação'}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleForceWorker = async () => {
    try {
      await triggerWorkerCycle();
      await loadLiveState();
    } catch {
      // ignore
    }
  };

  const activeTasksCount = tasks.filter(t => t.status === 'running' || t.status === 'pending' || t.status === 'review').length;
  const completedTasksCount = tasks.filter(t => t.status === 'completed').length;

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* HEADER DA PÁGINA */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Zap className="w-6 h-6 text-emerald-400" />
            Command Center do Fundador
          </h1>
          <p className="text-slate-400 text-sm mt-1">
            Orquestração autônoma e supervisão em tempo real da equipe de 11 agentes especializados (AG-001 a AG-011).
          </p>
        </div>

        <button
          onClick={handleForceWorker}
          className="bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-700 px-3 py-2 rounded-lg text-xs font-semibold flex items-center gap-2 transition"
        >
          <RefreshCw className="w-3.5 h-3.5 text-emerald-400" />
          <span>Atualizar / Forçar Ciclo Worker</span>
        </button>
      </div>

      {/* 4 KPIS NO TOPO (CONECTADOS AO BANCO REAL) */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex items-center justify-between">
          <div>
            <span className="text-xs text-slate-400 uppercase tracking-wider font-semibold">Total de Tarefas</span>
            <div className="text-2xl font-bold text-white mt-1">{tasks.length}</div>
            <span className="text-[11px] text-cyan-400 flex items-center gap-1 mt-1 font-mono">
              <Clock className="w-3 h-3" /> {activeTasksCount} ativas / {completedTasksCount} concluídas
            </span>
          </div>
          <div className="w-10 h-10 rounded-lg bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
            <Zap className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex items-center justify-between">
          <div>
            <span className="text-xs text-slate-400 uppercase tracking-wider font-semibold">Aprovações (Nível 2)</span>
            <div className="text-2xl font-bold text-rose-400 mt-1">{approvalsCount}</div>
            <span className="text-[11px] text-rose-400 flex items-center gap-1 mt-1 font-mono">
              <ShieldAlert className="w-3 h-3" /> Aguardando decisão HITL
            </span>
          </div>
          <div className="w-10 h-10 rounded-lg bg-rose-500/10 border border-rose-500/30 flex items-center justify-center text-rose-400">
            <ShieldAlert className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex items-center justify-between">
          <div>
            <span className="text-xs text-slate-400 uppercase tracking-wider font-semibold">Taxa de Conclusão</span>
            <div className="text-2xl font-bold text-emerald-400 mt-1">
              {finops ? `${finops.completion_rate_percent.toFixed(0)}%` : '0%'}
            </div>
            <span className="text-[11px] text-emerald-400/80 flex items-center gap-1 mt-1 font-mono">
              <TrendingDown className="w-3 h-3" /> Auditadas pelo AG-008
            </span>
          </div>
          <div className="w-10 h-10 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
            <TrendingDown className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex items-center justify-between">
          <div>
            <span className="text-xs text-slate-400 uppercase tracking-wider font-semibold">Custo IA (Acumulado)</span>
            <div className="text-2xl font-bold text-slate-200 mt-1 font-mono">
              ${finops ? Number(finops.total_token_spend_usd_month || 0).toFixed(4) : '0.0000'}
            </div>
            <span className="text-[11px] text-slate-400 flex items-center gap-1 mt-1 font-mono">
              <Coins className="w-3 h-3 text-emerald-400" /> {finops?.total_runs_count || 0} chamadas registradas
            </span>
          </div>
          <div className="w-10 h-10 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
            <Coins className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* COMMAND BAR CENTRAL */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-lg">
        <label className="block text-sm font-semibold text-slate-200 mb-2">
          Instrução Estratégica para o AI Orchestrator (AG-001):
        </label>
        <form onSubmit={handleSubmit} className="flex gap-3">
          <input
            type="text"
            value={objective}
            onChange={(e) => setObjective(e.target.value)}
            placeholder="Ex: Quero fazer uma pesquisa de mercado sobre PMEs no Grupo A4 e estruturar proposta comercial..."
            className="flex-1 bg-slate-950 border border-slate-700 rounded-lg px-4 py-3 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 transition"
          />
          <button
            type="submit"
            disabled={isSubmitting || !objective.trim()}
            className="bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 text-slate-950 font-bold px-6 py-3 rounded-lg flex items-center gap-2 transition text-sm shadow-md"
          >
            <Send className="w-4 h-4" />
            <span>{isSubmitting ? 'Processando...' : 'Executar'}</span>
          </button>
        </form>

        {feedback && (
          <div
            className={`mt-3 p-3 rounded-lg text-xs font-mono border ${
              isError
                ? 'bg-rose-950/40 border-rose-500/40 text-rose-300'
                : 'bg-slate-800 border-emerald-500/40 text-emerald-400'
            }`}
          >
            {feedback}
          </div>
        )}

        {/* PLANO DE DECOMPOSIÇÃO DO AG-001 */}
        {lastPlan && (
          <div className="mt-4 p-4 bg-slate-950 border border-slate-800 rounded-lg space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-emerald-400 uppercase tracking-wider">
                Plano de Decomposição Executiva (AG-001):
              </span>
              <span className="text-[11px] font-mono text-slate-400">
                Complexidade: {lastPlan.estimated_complexity}
              </span>
            </div>
            <p className="text-xs text-slate-300 leading-relaxed">{lastPlan.reasoning_summary}</p>
            <div className="space-y-2 pt-2 border-t border-slate-800/80">
              {lastPlan.decomposed_tasks?.map((st: any, idx: number) => (
                <div
                  key={idx}
                  className="flex items-center justify-between bg-slate-900/90 px-3 py-2 rounded border border-slate-800 text-xs"
                >
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-bold text-cyan-400">{st.assigned_agent_id}</span>
                    <span className="text-slate-200">{st.objective}</span>
                  </div>
                  <span
                    className={`font-mono text-[10px] px-2 py-0.5 rounded ${
                      st.requires_approval
                        ? 'bg-rose-500/10 text-rose-400 border border-rose-500/30'
                        : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                    }`}
                  >
                    {st.requires_approval ? 'Requer Aprovação Nível 2' : 'Execução Autônoma'}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* WORKFLOWS RÁPIDOS */}
        <div className="mt-4 pt-4 border-t border-slate-800/80">
          <span className="text-xs text-slate-400 font-semibold block mb-2 uppercase tracking-wide">
            Acionamento Rápido de Workflows Pré-Configurados:
          </span>
          <div className="flex flex-wrap gap-2">
            {[
              { code: 'WF-001', name: 'Planejamento Estratégico & Pesquisa de Mercado' },
              { code: 'WF-003', name: 'Diagnóstico Energético Completo (Core)' },
              { code: 'WF-004', name: 'Campanha de Geração de Demanda ICP' },
              { code: 'WF-007', name: 'Dossiê de Contestação ANEEL (REN 1.000)' },
              { code: 'WF-008', name: 'Fechamento Mensal de M&V e Success Fee' }
            ].map((wf) => (
              <button
                key={wf.code}
                onClick={() => handleQuickWorkflow(wf.code, wf.name)}
                disabled={isSubmitting}
                className="bg-slate-800/80 hover:bg-slate-800 text-slate-300 hover:text-white px-3 py-1.5 rounded-lg border border-slate-700 text-xs flex items-center gap-1.5 transition"
              >
                <Play className="w-3 h-3 text-emerald-400" />
                <span className="font-mono font-bold text-emerald-400">{wf.code}</span>
                <span className="text-slate-400">| {wf.name}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* LIVE AGENT STREAM (FEED EM TEMPO REAL CONECTADO AO BANCO) */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
        <div className="flex items-center justify-between mb-4 border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse"></span>
            <h2 className="text-sm font-bold text-white uppercase tracking-wider">
              Live Agent Execution Stream (Tarefas em Tempo Real)
            </h2>
          </div>
          <span className="text-xs text-slate-400 font-mono">
            Atualização automática a cada 5s • Clique em uma tarefa para ver o resultado
          </span>
        </div>

        {tasks.length === 0 ? (
          <div className="text-center py-8 text-slate-500 text-sm">
            Nenhuma tarefa ativa no momento. Digite um objetivo estratégico acima e clique em <strong>Executar</strong> para iniciar!
          </div>
        ) : (
          <div className="space-y-3">
            {tasks.map((item) => {
              const isExpanded = expandedTaskId === item.id;
              return (
                <div
                  key={item.id}
                  className="bg-slate-950/60 rounded-lg border border-slate-800/80 overflow-hidden transition"
                >
                  <div
                    onClick={() => setExpandedTaskId(isExpanded ? null : item.id)}
                    className="flex items-start justify-between p-3 cursor-pointer hover:bg-slate-900/50"
                  >
                    <div className="flex items-start gap-3">
                      <div className="mt-0.5">
                        {item.status === 'completed' ? (
                          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                        ) : item.status === 'waiting_input' ? (
                          <ShieldAlert className="w-4 h-4 text-rose-400" />
                        ) : (
                          <Clock className="w-4 h-4 text-amber-400 animate-spin" />
                        )}
                      </div>
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-xs font-mono font-bold text-cyan-400">{item.task_code}</span>
                          <span className="text-xs font-bold text-slate-200">{item.assigned_agent_id}</span>
                          <span
                            className={`text-[10px] px-2 py-0.5 rounded font-mono font-semibold uppercase ${
                              item.status === 'completed'
                                ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                                : item.status === 'waiting_input'
                                ? 'bg-rose-500/10 text-rose-400 border border-rose-500/30'
                                : 'bg-amber-500/10 text-amber-400 border border-amber-500/30'
                            }`}
                          >
                            {item.status}
                          </span>
                          <span className="text-[10px] bg-slate-800 text-slate-400 px-1.5 py-0.5 rounded font-mono">
                            {item.risk_level}
                          </span>
                        </div>
                        <p className="text-xs text-slate-300 mt-1">{item.objective}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 ml-4">
                      <span className="text-[11px] text-slate-400 font-mono whitespace-nowrap">
                        {new Date(item.created_at).toLocaleTimeString('pt-BR')}
                      </span>
                      {isExpanded ? (
                        <ChevronUp className="w-4 h-4 text-slate-400" />
                      ) : (
                        <ChevronDown className="w-4 h-4 text-slate-400" />
                      )}
                    </div>
                  </div>

                  {isExpanded && (
                    <div className="p-4 border-t border-slate-800 bg-slate-950 space-y-3 text-xs">
                      {item.result_payload && Object.keys(item.result_payload).length > 0 && (
                        <div>
                          <span className="font-bold text-emerald-400 block mb-1 uppercase">
                            Entregável / Resultado Gerado pelo Agente ({item.assigned_agent_id}):
                          </span>
                          <pre className="bg-slate-900 p-3 rounded border border-slate-800 text-slate-200 font-mono text-[11px] overflow-x-auto whitespace-pre-wrap">
                            {JSON.stringify(item.result_payload, null, 2)}
                          </pre>
                        </div>
                      )}
                      {item.qa_review_payload && Object.keys(item.qa_review_payload).length > 0 && (
                        <div>
                          <span className="font-bold text-amber-400 block mb-1 uppercase">
                            Parecer de Auditoria QA Gate (AG-008):
                          </span>
                          <pre className="bg-slate-900 p-3 rounded border border-slate-800 text-slate-300 font-mono text-[11px] overflow-x-auto whitespace-pre-wrap">
                            {JSON.stringify(item.qa_review_payload, null, 2)}
                          </pre>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
