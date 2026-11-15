'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  ShieldCheck,
  CheckCircle,
  XCircle,
  RefreshCw,
  Award,
  CheckCircle2,
  AlertCircle,
  ChevronDown,
  ChevronUp,
  History,
  Filter,
  Clock,
  MessageSquare,
  Sparkles
} from 'lucide-react';
import { decideApproval, fetchApprovals } from '@/lib/api-client';
import { ExecutiveDeliverableView } from '@/components/ExecutiveDeliverableView';

export default function ApprovalsPage() {
  const [approvals, setApprovals] = useState<any[]>([]);
  const [commentsMap, setCommentsMap] = useState<Record<string, string>>({});
  const [isProcessing, setIsProcessing] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [activeDecision, setActiveDecision] = useState<string | null>(null);

  // Controle de expansão de aprovações históricas (minimizadas por padrão)
  const [expandedHistoryIds, setExpandedHistoryIds] = useState<Record<string, boolean>>({});

  // Limite de histórico na tela para otimização de performance
  const [historyLimit, setHistoryLimit] = useState<number>(15);
  const [historyFilter, setHistoryFilter] = useState<'all' | 'approved' | 'rejected'>('all');

  const loadApprovals = useCallback(async () => {
    try {
      setIsRefreshing(true);
      // Busca até 60 registros do backend para manter a carga leve
      const res = await fetchApprovals(60);
      if (res?.approvals) {
        setApprovals(res.approvals);
      }
    } catch {
      // ignore
    } finally {
      setIsRefreshing(false);
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
      setActiveDecision(`Decisão soberana registrada (${decision === 'approved' ? 'APROVADO' : 'AJUSTES SOLICITADOS'}) com sucesso!`);
      await loadApprovals();
    } catch (err: any) {
      setActiveDecision(`Erro: ${err?.message || 'Falha ao comunicar com o servidor'}`);
    } finally {
      setIsProcessing(false);
    }
  };

  const toggleHistoryItem = (id: string) => {
    setExpandedHistoryIds((prev) => ({
      ...prev,
      [id]: !prev[id]
    }));
  };

  // Separação entre aprovações pendentes (esperando aprovação) e analisadas (histórico)
  const pendingApprovals = useMemo(
    () => approvals.filter((app) => app.approval_status === 'pending'),
    [approvals]
  );

  const reviewedApprovals = useMemo(
    () => approvals.filter((app) => app.approval_status !== 'pending'),
    [approvals]
  );

  // Histórico filtrado por status (todos, aprovados ou ajustes)
  const filteredReviewed = useMemo(() => {
    if (historyFilter === 'approved') {
      return reviewedApprovals.filter((a) => a.approval_status === 'approved');
    }
    if (historyFilter === 'rejected') {
      return reviewedApprovals.filter((a) => a.approval_status === 'rejected');
    }
    return reviewedApprovals;
  }, [reviewedApprovals, historyFilter]);

  // Aplicação do limite de histórico visível para alta performance
  const visibleReviewed = useMemo(
    () => filteredReviewed.slice(0, historyLimit),
    [filteredReviewed, historyLimit]
  );

  const formatDateTime = (dateStr?: string) => {
    if (!dateStr) return 'Data não informada';
    try {
      const d = new Date(dateStr);
      return d.toLocaleString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch {
      return dateStr;
    }
  };

  return (
    <div className="space-y-8 max-w-7xl mx-auto pb-16">
      {/* HEADER */}
      <div className="flex items-center justify-between flex-wrap gap-4 bg-slate-900/60 p-5 rounded-2xl border border-slate-800">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2.5">
            <ShieldCheck className="w-6 h-6 text-amber-400 shrink-0" />
            <span>Central de Aprovações Human-in-the-Loop (Nível 2)</span>
          </h1>
          <p className="text-slate-400 text-xs sm:text-sm mt-1">
            Nenhuma ação externa, proposta comercial, compromisso financeiro ou deploy é executado sem sua validação soberana.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="hidden sm:flex items-center gap-2">
            <span className="text-xs bg-rose-500/15 text-rose-400 border border-rose-500/30 px-3 py-1.5 rounded-lg font-bold font-mono">
              Pendentes: {pendingApprovals.length}
            </span>
            <span className="text-xs bg-slate-800 text-slate-300 border border-slate-700 px-3 py-1.5 rounded-lg font-mono">
              Histórico: {reviewedApprovals.length}
            </span>
          </div>

          <button
            onClick={loadApprovals}
            disabled={isRefreshing}
            className="bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-300 px-3.5 py-2 rounded-xl text-xs flex items-center gap-2 transition cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-amber-400 ${isRefreshing ? 'animate-spin' : ''}`} />
            <span>Atualizar</span>
          </button>
        </div>
      </div>

      {activeDecision && (
        <div className="p-3.5 bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 rounded-xl text-xs font-mono flex items-center gap-2 shadow-lg">
          <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
          <span>{activeDecision}</span>
        </div>
      )}

      {/* ========================================================================= */}
      {/* SEÇÃO 1: ESPERANDO APROVAÇÃO (MAXIMIZADAS)                                */}
      {/* ========================================================================= */}
      <section className="space-y-4">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2">
            <div className="w-2.5 h-2.5 rounded-full bg-rose-500 animate-pulse" />
            <h2 className="text-lg font-bold text-white tracking-wide">
              Aguardando Aprovação Soberana ({pendingApprovals.length})
            </h2>
          </div>
          {pendingApprovals.length > 0 && (
            <span className="text-xs text-rose-400 font-semibold bg-rose-500/10 px-2.5 py-1 rounded-md border border-rose-500/20">
              Ação Requerida do Fundador
            </span>
          )}
        </div>

        {pendingApprovals.length === 0 ? (
          <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-8 text-center text-slate-400 text-xs sm:text-sm">
            <CheckCircle className="w-8 h-8 text-emerald-500/60 mx-auto mb-2" />
            <p className="font-semibold text-slate-300">Fila limpa! Nenhuma aprovação Nível 2 pendente no momento.</p>
            <p className="text-xs text-slate-500 mt-1">
              Quando uma entrega de alto impacto for submetida ao crivo do <strong>AG-008</strong>, ela aparecerá aqui maximizada em formato executivo.
            </p>
          </div>
        ) : (
          <div className="space-y-8">
            {pendingApprovals.map((app) => {
              const task = app.task || {};
              const qa = task.qa_review_payload || {};

              return (
                <div
                  key={app.id}
                  className="bg-slate-900 border border-amber-500/30 rounded-2xl overflow-hidden shadow-2xl transition hover:border-amber-500/50 ring-1 ring-amber-500/10"
                >
                  {/* Top Header do Card Maximizado */}
                  <div className="bg-gradient-to-r from-slate-900 via-slate-900 to-amber-950/40 px-6 py-4 border-b border-slate-800 flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2.5 flex-wrap">
                        <span className="font-mono text-xs bg-amber-500/20 text-amber-300 border border-amber-500/30 px-2.5 py-0.5 rounded-md font-bold">
                          {task.task_code || 'TASK'}
                        </span>
                        <span className="font-mono text-xs bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 px-2.5 py-0.5 rounded-md font-bold">
                          Agente: {app.requested_by}
                        </span>
                        <h3 className="text-sm font-bold text-white">
                          {task.objective || app.comments || 'Aprovação Executiva de Nível 2'}
                        </h3>
                      </div>
                      <p className="text-xs text-slate-400 mt-1.5 flex items-center gap-1.5 flex-wrap">
                        <AlertCircle className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                        <span>Gatilho de Governança Nível 2:</span>
                        <span className="text-amber-300 font-semibold">
                          {app.comments || task.approval_reason || 'Validação Soberana do Fundador Obrigatória'}
                        </span>
                      </p>
                    </div>

                    <span className="text-xs px-3.5 py-1 rounded-full font-bold uppercase tracking-wider bg-rose-500/20 text-rose-300 border border-rose-500/40 shadow-sm animate-pulse">
                      Aguardando Decisão
                    </span>
                  </div>

                  {/* VISUALIZADOR EXECUTIVO CORPORATIVO (MAXIMIZADO) */}
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
                        className="bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 text-rose-400 font-semibold px-4 py-2.5 rounded-xl text-xs flex items-center gap-1.5 transition cursor-pointer"
                      >
                        <XCircle className="w-4 h-4" />
                        <span>Solicitar Ajustes</span>
                      </button>

                      <button
                        onClick={() => handleDecision(app.id, 'approved')}
                        disabled={isProcessing}
                        className="bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-bold px-5 py-2.5 rounded-xl text-xs flex items-center gap-1.5 transition shadow-lg cursor-pointer"
                      >
                        <CheckCircle className="w-4 h-4" />
                        <span>Aprovar Entrega (Nível 2)</span>
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* ========================================================================= */}
      {/* SEÇÃO 2: HISTÓRICO DE APROVAÇÕES ANALISADAS (MINIMIZADAS COM LIMITE)      */}
      {/* ========================================================================= */}
      <section className="space-y-4 pt-6 border-t border-slate-800">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <History className="w-5 h-5 text-indigo-400" />
              <h2 className="text-lg font-bold text-white tracking-wide">
                Histórico de Aprovações Analisadas
              </h2>
            </div>
            <p className="text-xs text-slate-400 mt-1">
              Aprovações e validações anteriores minimizadas com o desfecho da decisão soberana.
            </p>
          </div>

          {/* CONTROLES DE PERFORMANCE & FILTROS */}
          <div className="flex flex-wrap items-center gap-3">
            {/* Filtro de Status */}
            <div className="flex items-center bg-slate-900 border border-slate-800 rounded-xl p-1 text-xs">
              <button
                onClick={() => setHistoryFilter('all')}
                className={`px-3 py-1 rounded-lg transition cursor-pointer ${
                  historyFilter === 'all'
                    ? 'bg-slate-800 text-white font-semibold'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Todos ({reviewedApprovals.length})
              </button>
              <button
                onClick={() => setHistoryFilter('approved')}
                className={`px-3 py-1 rounded-lg transition cursor-pointer ${
                  historyFilter === 'approved'
                    ? 'bg-emerald-500/20 text-emerald-300 font-semibold'
                    : 'text-slate-400 hover:text-emerald-300'
                }`}
              >
                Aprovados
              </button>
              <button
                onClick={() => setHistoryFilter('rejected')}
                className={`px-3 py-1 rounded-lg transition cursor-pointer ${
                  historyFilter === 'rejected'
                    ? 'bg-rose-500/20 text-rose-300 font-semibold'
                    : 'text-slate-400 hover:text-rose-300'
                }`}
              >
                Ajustes
              </button>
            </div>

            {/* Seletor de Limite de Histórico */}
            <div className="flex items-center gap-1.5 bg-slate-900 border border-slate-800 rounded-xl px-2.5 py-1 text-xs text-slate-400">
              <Filter className="w-3.5 h-3.5 text-slate-500" />
              <span>Limite:</span>
              {[10, 15, 30, 50].map((lim) => (
                <button
                  key={lim}
                  onClick={() => setHistoryLimit(lim)}
                  className={`px-2 py-0.5 rounded transition cursor-pointer ${
                    historyLimit === lim
                      ? 'bg-indigo-600 text-white font-bold'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {lim}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* LISTAGEM MINIMIZADA */}
        {visibleReviewed.length === 0 ? (
          <div className="bg-slate-900/40 border border-slate-800 rounded-xl p-8 text-center text-slate-400 text-xs">
            Nenhum registro histórico encontrado para o filtro selecionado.
          </div>
        ) : (
          <div className="space-y-3">
            {visibleReviewed.map((app) => {
              const task = app.task || {};
              const isApproved = app.approval_status === 'approved';
              const isExpanded = !!expandedHistoryIds[app.id];
              const title = task.result_payload?.deliverable_title || task.objective || app.comments || 'Aprovação de Nível 2';
              const decisionDate = app.decided_at || app.created_at;

              return (
                <div
                  key={app.id}
                  className={`bg-slate-900/90 border rounded-xl overflow-hidden transition shadow-sm ${
                    isExpanded ? 'border-slate-700 bg-slate-900' : 'border-slate-800/80 hover:border-slate-700'
                  }`}
                >
                  {/* BARRA MINIMIZADA (Sempre visível com Título e Desfecho) */}
                  <div
                    onClick={() => toggleHistoryItem(app.id)}
                    className="px-5 py-3.5 flex flex-wrap items-center justify-between gap-3 cursor-pointer select-none hover:bg-slate-800/40 transition"
                  >
                    <div className="flex items-center gap-3 flex-1 min-w-[280px]">
                      {/* Ícone de Desfecho */}
                      {isApproved ? (
                        <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
                      ) : (
                        <XCircle className="w-5 h-5 text-rose-400 shrink-0" />
                      )}

                      {/* Tags de Identificação */}
                      <span className="font-mono text-[11px] bg-slate-800 text-slate-300 border border-slate-700 px-2 py-0.5 rounded shrink-0">
                        {task.task_code || 'TASK'}
                      </span>
                      <span className="font-mono text-[11px] bg-indigo-500/15 text-indigo-300 border border-indigo-500/30 px-2 py-0.5 rounded shrink-0">
                        {app.requested_by}
                      </span>

                      {/* Título do Entregável */}
                      <div className="flex-1 min-w-0">
                        <h4 className="text-xs sm:text-sm font-semibold text-slate-200 truncate">
                          {title}
                        </h4>
                        {app.comments && (
                          <p className="text-[11px] text-slate-400 truncate flex items-center gap-1.5 mt-0.5">
                            <MessageSquare className="w-3 h-3 text-slate-500 shrink-0" />
                            <span>Parecer: <strong className="text-slate-300 font-normal">"{app.comments}"</strong></span>
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Desfecho e Data */}
                    <div className="flex items-center gap-3 shrink-0">
                      <div className="text-right hidden md:block">
                        <span className="text-[11px] text-slate-400 flex items-center gap-1">
                          <Clock className="w-3 h-3 text-slate-500" />
                          {formatDateTime(decisionDate)}
                        </span>
                      </div>

                      {/* Badge do Desfecho */}
                      <span
                        className={`text-xs px-3 py-1 rounded-lg font-bold uppercase tracking-wider flex items-center gap-1.5 ${
                          isApproved
                            ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                            : 'bg-rose-500/15 text-rose-400 border border-rose-500/30'
                        }`}
                      >
                        {isApproved ? '✓ Aprovado Nível 2' : '✕ Ajustes Solicitados'}
                      </span>

                      {/* Botão Expandir / Recolher */}
                      <button
                        type="button"
                        className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition"
                        title={isExpanded ? 'Recolher detalhes' : 'Expandir detalhes completos'}
                      >
                        {isExpanded ? (
                          <ChevronUp className="w-4 h-4 text-indigo-400" />
                        ) : (
                          <ChevronDown className="w-4 h-4 text-slate-400" />
                        )}
                      </button>
                    </div>
                  </div>

                  {/* CONTEÚDO EXPANDIDO (RENDERIZA APENAS SE EXPANDIDO PARA NÃO PESAR O DOM) */}
                  {isExpanded && (
                    <div className="p-6 border-t border-slate-800 bg-slate-950/60 space-y-4">
                      <div className="flex items-center justify-between text-xs text-slate-400 pb-2 border-b border-slate-800">
                        <div className="flex items-center gap-3">
                          <span>Criado em: <strong className="text-slate-300">{formatDateTime(app.created_at)}</strong></span>
                          <span>•</span>
                          <span>Decidido em: <strong className="text-slate-300">{formatDateTime(app.decided_at)}</strong></span>
                        </div>
                        <button
                          onClick={() => toggleHistoryItem(app.id)}
                          className="text-xs text-indigo-400 hover:text-indigo-300 font-medium cursor-pointer"
                        >
                          Recolher visualização
                        </button>
                      </div>

                      <ExecutiveDeliverableView
                        title={task.result_payload?.deliverable_title || task.objective}
                        subtitle={`Entregável arquivado • Decisão Nível 2 registrada`}
                        agentId={app.requested_by || task.assigned_agent_id || 'AG-001'}
                        artifactType={task.task_type || 'strategic_plan'}
                        taskCode={task.task_code}
                        createdAt={app.created_at || task.created_at}
                        structuredData={task.result_payload || {}}
                        qaReview={task.qa_review_payload || {}}
                        compact
                      />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* FOOTER DO HISTÓRICO COM CARREGAR MAIS */}
        {filteredReviewed.length > historyLimit && (
          <div className="pt-2 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-400 bg-slate-900/50 p-4 rounded-xl border border-slate-800">
            <span>
              Exibindo os <strong>{visibleReviewed.length}</strong> registros mais recentes de um total de <strong>{filteredReviewed.length}</strong> decisões analisadas.
            </span>
            <button
              onClick={() => setHistoryLimit((prev) => prev + 15)}
              className="bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 border border-indigo-500/30 px-4 py-2 rounded-xl font-semibold transition cursor-pointer flex items-center gap-2"
            >
              <span>Carregar mais histórico (+15)</span>
              <ChevronDown className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </section>
    </div>
  );
}