'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Brain,
  Zap,
  Sun,
  FolderSync,
  PenTool,
  Calendar,
  Check,
  Edit3,
  X,
  ShieldCheck,
  Sliders,
  Sparkles,
  AlertTriangle,
  Clock
} from 'lucide-react';
import {
  fetchSecondBrainSuggestions,
  acceptSecondBrainSuggestion,
  editSecondBrainSuggestion,
  rejectSecondBrainSuggestion,
  fetchActiveFounderPersona,
  updateFounderPersonaWeights,
  fetchSecondBrainSchedulerStatus,
  triggerSecondBrainBriefing,
  scanSecondBrainOpportunities,
  startSecondBrainBootstrap,
  createSecondBrainSocialDraft,
  generateCalendarDossier
} from '@/lib/api-client';

interface ScoreBreakdown {
  vectorSimilarity: number;
  businessRulesMatch: number;
  temporalAcceptanceRate: number;
  guardrailsViolated: string[];
  appliedWeights: { wv: number; wr: number; wt: number };
  similarEpisodesCount: number;
}

interface SuggestionItem {
  id: string;
  category: string;
  priority: 'P0' | 'P1' | 'P2' | 'P3';
  title: string;
  context_summary: string;
  action_type: string;
  target_agent_id: string;
  action_payload: Record<string, any>;
  approval_probability: number;
  confidence_score: number;
  score_breakdown: ScoreBreakdown;
  status: string;
  created_at: string;
}

export default function SecondBrainCockpitPage() {
  const [suggestions, setSuggestions] = useState<SuggestionItem[]>([]);
  const [persona, setPersona] = useState<any>(null);
  const [schedulerStatus, setSchedulerStatus] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [toastMsg, setToastMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  // Modal de Ajuste (Educar IA)
  const [editingItem, setEditingItem] = useState<SuggestionItem | null>(null);
  const [editContent, setEditContent] = useState('');
  const [editFeedback, setEditFeedback] = useState('');

  // Painéis Rápidos: Post LinkedIn & Dossiê Pré-Reunião
  const [showSocialModal, setShowSocialModal] = useState(false);
  const [socialTopic, setSocialTopic] = useState('');
  const [socialAngle, setSocialAngle] = useState('');

  const [showDossierModal, setShowDossierModal] = useState(false);
  const [dossierTitle, setDossierTitle] = useState('');
  const [dossierCompany, setDossierCompany] = useState('');
  const [dossierResult, setDossierResult] = useState<string | null>(null);

  // Calibração de Pesos
  const [wv, setWv] = useState(0.45);
  const [wr, setWr] = useState(0.35);
  const [wt, setWt] = useState(0.20);

  const showNotice = (type: 'ok' | 'err', text: string) => {
    setToastMsg({ type, text });
    setTimeout(() => setToastMsg(null), 6000);
  };

  const loadData = useCallback(async () => {
    try {
      const [sugRes, persRes, schedRes] = await Promise.all([
        fetchSecondBrainSuggestions('pending').catch(() => ({ suggestions: [] })),
        fetchActiveFounderPersona().catch(() => ({ persona: null })),
        fetchSecondBrainSchedulerStatus().catch(() => ({ status: null }))
      ]);
      setSuggestions(sugRes.suggestions || []);
      if (persRes.persona) {
        setPersona(persRes.persona);
        setWv(Number(persRes.persona.decision_weights?.vector_similarity_weight ?? 0.45));
        setWr(Number(persRes.persona.decision_weights?.business_rules_weight ?? 0.35));
        setWt(Number(persRes.persona.decision_weights?.temporal_freshness_weight ?? 0.20));
      }
      setSchedulerStatus(schedRes.status || null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleAccept = async (item: SuggestionItem) => {
    setBusyAction(item.id);
    try {
      const res = await acceptSecondBrainSuggestion(item.id);
      setSuggestions(prev => prev.filter(s => s.id !== item.id));
      const codeMsg = res.executionTask?.taskCode
        ? ` Tarefa ${res.executionTask.taskCode} enfileirada no Autonomous Worker.`
        : '';
      showNotice('ok', `Sugestão "${item.title}" aprovada e incorporada ao RAG.${codeMsg}`);
    } catch (err: any) {
      showNotice('err', err.message || 'Falha ao aprovar');
    } finally {
      setBusyAction(null);
    }
  };

  const handleOpenEdit = (item: SuggestionItem) => {
    setEditingItem(item);
    setEditContent(
      item.action_payload?.draftText || JSON.stringify(item.action_payload, null, 2)
    );
    setEditFeedback('');
  };

  const handleSubmitEdit = async () => {
    if (!editingItem) return;
    setBusyAction(editingItem.id);
    try {
      const res = await editSecondBrainSuggestion(editingItem.id, editContent, editFeedback);
      setSuggestions(prev => prev.filter(s => s.id !== editingItem.id));
      setEditingItem(null);
      const codeMsg = res.executionTask?.taskCode
        ? ` Execução ${res.executionTask.taskCode} enfileirada.`
        : '';
      showNotice('ok', `Ajuste salvo no RAG!${codeMsg}`);
    } catch (err: any) {
      showNotice('err', err.message || 'Falha ao salvar ajuste');
    } finally {
      setBusyAction(null);
    }
  };

  const handleReject = async (item: SuggestionItem) => {
    setBusyAction(item.id);
    try {
      await rejectSecondBrainSuggestion(item.id, 'Descartado pelo fundador no Cockpit Web');
      setSuggestions(prev => prev.filter(s => s.id !== item.id));
      showNotice('ok', `Sugestão "${item.title}" descartada e registrada no histórico RAG.`);
    } catch (err: any) {
      showNotice('err', err.message || 'Falha ao descartar');
    } finally {
      setBusyAction(null);
    }
  };

  const handleScan = async () => {
    setBusyAction('scan');
    try {
      const res = await scanSecondBrainOpportunities();
      await loadData();
      showNotice(
        'ok',
        `Varredura concluída: ${res.suggestionsCreated?.length || 0} oportunidade(s) gerada(s).`
      );
    } catch (err: any) {
      showNotice('err', err.message);
    } finally {
      setBusyAction(null);
    }
  };

  const handleBriefing = async () => {
    setBusyAction('briefing');
    try {
      const res = await triggerSecondBrainBriefing();
      showNotice(
        'ok',
        res.sentToTelegram
          ? 'Briefing Matinal enviado com sucesso para o seu Telegram!'
          : 'Briefing Matinal gerado (configure o Bot Telegram para push automático).'
      );
    } catch (err: any) {
      showNotice('err', err.message);
    } finally {
      setBusyAction(null);
    }
  };

  const handleBootstrap = async () => {
    setBusyAction('bootstrap');
    try {
      const res = await startSecondBrainBootstrap();
      showNotice(
        'ok',
        `Bootstrap RAG concluído: ${res.processedSources || 0} fontes processadas, ${res.chunksCreated || 0} novos chunks vetoriais.`
      );
    } catch (err: any) {
      showNotice('err', err.message);
    } finally {
      setBusyAction(null);
    }
  };

  const handleSaveWeights = async () => {
    if (!persona?.id) return;
    setBusyAction('weights');
    try {
      const res = await updateFounderPersonaWeights(persona.id, {
        vector_similarity_weight: wv,
        business_rules_weight: wr,
        temporal_freshness_weight: wt
      });
      if (res.persona) {
        setPersona(res.persona);
        setWv(res.persona.decision_weights.vector_similarity_weight);
        setWr(res.persona.decision_weights.business_rules_weight);
        setWt(res.persona.decision_weights.temporal_freshness_weight);
      }
      showNotice('ok', 'Pesos da Persona do Fundador recalibrados com sucesso!');
    } catch (err: any) {
      showNotice('err', err.message);
    } finally {
      setBusyAction(null);
    }
  };

  const handleGenerateSocial = async () => {
    if (!socialTopic.trim()) return;
    setBusyAction('social');
    try {
      await createSecondBrainSocialDraft({ topic: socialTopic, angle: socialAngle || undefined });
      setShowSocialModal(false);
      setSocialTopic('');
      setSocialAngle('');
      await loadData();
      showNotice('ok', 'Rascunho de post LinkedIn gerado e adicionado à fila de aprovação HITL!');
    } catch (err: any) {
      showNotice('err', err.message);
    } finally {
      setBusyAction(null);
    }
  };

  const handleGenerateDossier = async () => {
    if (!dossierTitle.trim()) return;
    setBusyAction('dossier');
    try {
      const res = await generateCalendarDossier({
        title: dossierTitle,
        companyName: dossierCompany || undefined
      });
      setDossierResult(res.dossierMarkdown || '');
    } catch (err: any) {
      showNotice('err', err.message);
    } finally {
      setBusyAction(null);
    }
  };

  const getProbBadgeClass = (prob: number) => {
    const pct = prob * 100;
    if (pct >= 85) return 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40';
    if (pct >= 65) return 'bg-amber-500/20 text-amber-300 border-amber-500/40';
    return 'bg-rose-500/20 text-rose-300 border-rose-500/40';
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* CABEÇALHO & TOOLBAR */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 border-b border-slate-800 pb-5">
        <div>
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-purple-500/15 border border-purple-500/30 text-purple-400">
              <Brain className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white tracking-tight">
                Segundo Cérebro Executivo (RAG)
              </h1>
              <p className="text-sm text-slate-400">
                Memória episódica do fundador, sugestões preditivas e governança Zero-Risk HITL
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            onClick={handleScan}
            disabled={busyAction !== null}
            className="px-3.5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs font-semibold flex items-center gap-1.5 transition-colors"
          >
            <Zap className="w-4 h-4" />
            {busyAction === 'scan' ? 'Varrendo...' : 'Varredura Proativa'}
          </button>

          <button
            onClick={handleBriefing}
            disabled={busyAction !== null}
            className="px-3.5 py-2 rounded-lg bg-amber-600/20 hover:bg-amber-600/30 border border-amber-500/40 text-amber-300 text-xs font-semibold flex items-center gap-1.5 transition-colors"
          >
            <Sun className="w-4 h-4" />
            {busyAction === 'briefing' ? 'Enviando...' : 'Briefing Matinal (Telegram)'}
          </button>

          <button
            onClick={handleBootstrap}
            disabled={busyAction !== null}
            className="px-3.5 py-2 rounded-lg bg-sky-600/20 hover:bg-sky-600/30 border border-sky-500/40 text-sky-300 text-xs font-semibold flex items-center gap-1.5 transition-colors"
          >
            <FolderSync className="w-4 h-4" />
            {busyAction === 'bootstrap' ? 'Indexando...' : 'Bootstrap RAG (Drive & E-mails)'}
          </button>

          <button
            onClick={() => setShowSocialModal(true)}
            className="px-3.5 py-2 rounded-lg bg-indigo-600/20 hover:bg-indigo-600/30 border border-indigo-500/40 text-indigo-300 text-xs font-semibold flex items-center gap-1.5 transition-colors"
          >
            <PenTool className="w-4 h-4" />
            Gerar Post LinkedIn
          </button>

          <button
            onClick={() => {
              setDossierResult(null);
              setShowDossierModal(true);
            }}
            className="px-3.5 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 text-xs font-semibold flex items-center gap-1.5 transition-colors"
          >
            <Calendar className="w-4 h-4" />
            Dossiê Pré-Reunião
          </button>
        </div>
      </div>

      {/* TOAST DE NOTIFICAÇÃO */}
      {toastMsg && (
        <div
          className={`p-3.5 rounded-xl border text-sm font-medium flex items-center justify-between ${
            toastMsg.type === 'ok'
              ? 'bg-emerald-950/60 border-emerald-500/40 text-emerald-300'
              : 'bg-rose-950/60 border-rose-500/40 text-rose-300'
          }`}
        >
          <span>{toastMsg.text}</span>
          <button onClick={() => setToastMsg(null)} className="text-slate-400 hover:text-white">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* PAINEL DE PERSONA, GUARDRAILS E STATUS DO SCHEDULER */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm font-semibold text-white">
              <Sliders className="w-4 h-4 text-purple-400" />
              <span>Calibração Matemática de Aprovação (P_approval)</span>
            </div>
            <span className="text-xs px-2.5 py-1 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 flex items-center gap-1 font-medium">
              <ShieldCheck className="w-3.5 h-3.5" /> Zero-Risk HITL Ativo
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
            <div className="bg-slate-950 border border-slate-800 rounded-xl p-3 space-y-1.5">
              <div className="flex justify-between text-slate-400">
                <span>Similaridade Vetorial (RAG)</span>
                <span className="text-white font-mono font-bold">{Math.round(wv * 100)}%</span>
              </div>
              <input
                type="range"
                min="0"
                max="1"
                step="0.05"
                value={wv}
                onChange={e => setWv(Number(e.target.value))}
                className="w-full accent-purple-500"
              />
            </div>

            <div className="bg-slate-950 border border-slate-800 rounded-xl p-3 space-y-1.5">
              <div className="flex justify-between text-slate-400">
                <span>Regras de Negócio & Fee</span>
                <span className="text-white font-mono font-bold">{Math.round(wr * 100)}%</span>
              </div>
              <input
                type="range"
                min="0"
                max="1"
                step="0.05"
                value={wr}
                onChange={e => setWr(Number(e.target.value))}
                className="w-full accent-emerald-500"
              />
            </div>

            <div className="bg-slate-950 border border-slate-800 rounded-xl p-3 space-y-1.5">
              <div className="flex justify-between text-slate-400">
                <span>Recência Temporal</span>
                <span className="text-white font-mono font-bold">{Math.round(wt * 100)}%</span>
              </div>
              <input
                type="range"
                min="0"
                max="1"
                step="0.05"
                value={wt}
                onChange={e => setWt(Number(e.target.value))}
                className="w-full accent-sky-500"
              />
            </div>
          </div>

          <div className="flex items-center justify-between pt-1">
            <p className="text-xs text-slate-400">
              Persona: <strong className="text-slate-200">{persona?.name || 'Fundador Solo Energy Intelligence'}</strong>
            </p>
            <button
              onClick={handleSaveWeights}
              disabled={busyAction !== null || !persona?.id}
              className="px-3 py-1.5 rounded-lg bg-purple-600/25 hover:bg-purple-600/40 border border-purple-500/40 text-purple-200 text-xs font-semibold transition-colors"
            >
              Salvar & Normalizar Pesos
            </button>
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 flex flex-col justify-between space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold text-white flex items-center gap-2">
              <Clock className="w-4 h-4 text-sky-400" /> Scheduler Proativo
            </span>
            <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
              {schedulerStatus?.running ? 'ONLINE (15m)' : 'MONITORADO'}
            </span>
          </div>
          <div className="space-y-1.5 text-xs text-slate-400">
            <div className="flex justify-between">
              <span>Pushes Telegram Hoje:</span>
              <span className="text-slate-200 font-mono">
                {schedulerStatus?.dailyPushCount ?? 0} / {schedulerStatus?.maxDailyPushes ?? 5}
              </span>
            </div>
            <div className="flex justify-between">
              <span>Janela de Silêncio (BRT):</span>
              <span className="text-slate-200 font-mono">
                {schedulerStatus?.quietWindow || '21:00 - 07:30'}
              </span>
            </div>
            <div className="flex justify-between">
              <span>Quiet Hours Ativo Agora:</span>
              <span className={schedulerStatus?.quietHoursActive ? 'text-amber-400 font-semibold' : 'text-emerald-400 font-semibold'}>
                {schedulerStatus?.quietHoursActive ? 'Sim (Retendo P1-P3)' : 'Não (Operação Normal)'}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* FILA DE SUGESTÕES PREDITIVAS */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-white flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-amber-400" />
            Fila de Sugestões Preditivas ({suggestions.length})
          </h2>
        </div>

        {loading ? (
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-8 text-center text-slate-400 text-sm">
            Carregando memória episódica e sugestões preditivas...
          </div>
        ) : suggestions.length === 0 ? (
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-10 text-center space-y-3">
            <p className="text-slate-300 font-medium">
              Nenhuma sugestão pendente na fila no momento.
            </p>
            <p className="text-xs text-slate-500">
              Clique em &ldquo;Varredura Proativa&rdquo; acima para analisar e-mails, CRM e gerar oportunidades com probabilidade calculada via RAG.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {suggestions.map(item => {
              const probPct = Math.round(Number(item.approval_probability || 0) * 100);
              const draftText =
                item.action_payload?.draftText || JSON.stringify(item.action_payload, null, 2);

              return (
                <div
                  key={item.id}
                  className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4 hover:border-slate-700 transition-colors"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div className="flex items-center gap-2.5 flex-wrap">
                      <span className="text-[11px] font-mono font-bold px-2 py-0.5 rounded bg-slate-800 text-sky-400 border border-slate-700">
                        {item.target_agent_id}
                      </span>
                      <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-slate-800 text-slate-300">
                        {item.category}
                      </span>
                      <h3 className="text-base font-bold text-white">{item.title}</h3>
                    </div>

                    <div
                      className={`text-xs font-bold px-3 py-1 rounded-full border shrink-0 ${getProbBadgeClass(
                        Number(item.approval_probability)
                      )}`}
                    >
                      Probabilidade de Aprovação: {probPct}%
                    </div>
                  </div>

                  <div className="bg-slate-950/70 border-l-4 border-sky-500 px-4 py-3 rounded-r-lg text-xs text-slate-300 space-y-1">
                    <div className="font-semibold text-sky-400">🔍 Racional & Decomposição RAG:</div>
                    <p>{item.context_summary}</p>
                    {item.score_breakdown && (
                      <div className="text-[11px] text-slate-400 pt-1 flex flex-wrap gap-4 font-mono">
                        <span>Vetorial: {Math.round((item.score_breakdown.vectorSimilarity || 0) * 100)}%</span>
                        <span>Regras: {Math.round((item.score_breakdown.businessRulesMatch || 0) * 100)}%</span>
                        <span>Histórico: {Math.round((item.score_breakdown.temporalAcceptanceRate || 0) * 100)}%</span>
                        <span>Episódios Similares: {item.score_breakdown.similarEpisodesCount || 0}</span>
                      </div>
                    )}
                    {item.score_breakdown?.guardrailsViolated?.length > 0 && (
                      <div className="text-rose-400 flex items-center gap-1 pt-1 font-semibold">
                        <AlertTriangle className="w-3.5 h-3.5" />
                        Guardrail violado: {item.score_breakdown.guardrailsViolated.join(', ')}
                      </div>
                    )}
                  </div>

                  <div className="bg-slate-950 border border-slate-800 rounded-xl p-3.5 text-xs text-slate-200 whitespace-pre-wrap font-sans">
                    {draftText}
                  </div>

                  <div className="flex flex-wrap items-center justify-end gap-2.5 pt-1">
                    <button
                      onClick={() => handleReject(item)}
                      disabled={busyAction === item.id}
                      className="px-3.5 py-2 rounded-lg border border-rose-500/30 bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 text-xs font-semibold flex items-center gap-1.5 transition-colors"
                    >
                      <X className="w-3.5 h-3.5" /> Descartar
                    </button>

                    <button
                      onClick={() => handleOpenEdit(item)}
                      disabled={busyAction === item.id}
                      className="px-3.5 py-2 rounded-lg border border-sky-500/30 bg-sky-500/10 hover:bg-sky-500/20 text-sky-300 text-xs font-semibold flex items-center gap-1.5 transition-colors"
                    >
                      <Edit3 className="w-3.5 h-3.5" /> Ajustar (Educar IA)
                    </button>

                    <button
                      onClick={() => handleAccept(item)}
                      disabled={busyAction === item.id}
                      className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center gap-1.5 transition-colors shadow-lg shadow-emerald-950/40"
                    >
                      <Check className="w-3.5 h-3.5" /> Aprovar & Executar
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* MODAL DE AJUSTE */}
      {editingItem && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-2xl p-6 space-y-4 shadow-2xl">
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <Edit3 className="w-5 h-5 text-sky-400" />
              Ajustar Sugestão (Treinar Base RAG)
            </h2>
            <p className="text-xs text-slate-400">
              O diff entre o texto original e a sua edição será vetorizado para recalibrar as próximas sugestões.
            </p>
            <textarea
              rows={7}
              value={editContent}
              onChange={e => setEditContent(e.target.value)}
              className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3 text-sm text-slate-200 focus:outline-none focus:border-sky-500"
            />
            <input
              type="text"
              placeholder="Motivo do ajuste (opcional — ex: 'Prefiro foco direto no corte da ponta')"
              value={editFeedback}
              onChange={e => setEditFeedback(e.target.value)}
              className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-sky-500"
            />
            <div className="flex justify-end gap-3 pt-2">
              <button
                onClick={() => setEditingItem(null)}
                className="px-4 py-2 rounded-lg border border-slate-700 text-slate-300 text-xs hover:bg-slate-800"
              >
                Cancelar
              </button>
              <button
                onClick={handleSubmitEdit}
                disabled={busyAction !== null}
                className="px-5 py-2 rounded-lg bg-sky-600 hover:bg-sky-500 text-white text-xs font-semibold"
              >
                Salvar Ajuste & Aprovar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL DE POST LINKEDIN */}
      {showSocialModal && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-lg p-6 space-y-4">
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <PenTool className="w-5 h-5 text-indigo-400" />
              Gerar Rascunho para LinkedIn (AG-006)
            </h2>
            <input
              type="text"
              placeholder="Tema central (ex: Como evitar multas por ultrapassagem de demanda)"
              value={socialTopic}
              onChange={e => setSocialTopic(e.target.value)}
              className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2.5 text-sm text-slate-200"
            />
            <input
              type="text"
              placeholder="Ângulo / Enfoque (opcional)"
              value={socialAngle}
              onChange={e => setSocialAngle(e.target.value)}
              className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2.5 text-sm text-slate-200"
            />
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setShowSocialModal(false)}
                className="px-4 py-2 rounded-lg border border-slate-700 text-slate-300 text-xs"
              >
                Cancelar
              </button>
              <button
                onClick={handleGenerateSocial}
                disabled={busyAction === 'social' || !socialTopic.trim()}
                className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold"
              >
                {busyAction === 'social' ? 'Gerando...' : 'Gerar & Enfileirar HITL'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL DE DOSSIÊ PRÉ-REUNIÃO */}
      {showDossierModal && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-2xl p-6 space-y-4 max-h-[85vh] overflow-y-auto">
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <Calendar className="w-5 h-5 text-emerald-400" />
              Gerar Dossiê Executivo Pré-Reunião
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <input
                type="text"
                placeholder="Título da reunião"
                value={dossierTitle}
                onChange={e => setDossierTitle(e.target.value)}
                className="bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-sm text-slate-200"
              />
              <input
                type="text"
                placeholder="Empresa / Conta (opcional)"
                value={dossierCompany}
                onChange={e => setDossierCompany(e.target.value)}
                className="bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-sm text-slate-200"
              />
            </div>

            {dossierResult && (
              <pre className="bg-slate-950 border border-slate-800 rounded-xl p-4 text-xs text-slate-200 whitespace-pre-wrap font-mono">
                {dossierResult}
              </pre>
            )}

            <div className="flex justify-end gap-2">
              <button
                onClick={() => setShowDossierModal(false)}
                className="px-4 py-2 rounded-lg border border-slate-700 text-slate-300 text-xs"
              >
                Fechar
              </button>
              <button
                onClick={handleGenerateDossier}
                disabled={busyAction === 'dossier' || !dossierTitle.trim()}
                className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold"
              >
                {busyAction === 'dossier' ? 'Compilando...' : 'Gerar Dossiê'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
