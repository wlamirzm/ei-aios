'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import {
  Sun,
  RefreshCw,
  Send,
  Brain,
  Mail,
  ListTodo,
  Sparkles,
  Check,
  Clock,
  ArrowRight,
  X
} from 'lucide-react';
import {
  fetchSecondBrainBriefingPreview,
  fetchSecondBrainSuggestions,
  fetchSecondBrainSchedulerStatus,
  triggerSecondBrainBriefing,
  acceptSecondBrainSuggestion
} from '@/lib/api-client';

export default function BriefingPage() {
  const [briefing, setBriefing] = useState<any>(null);
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [schedulerStatus, setSchedulerStatus] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [toast, setToast] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  const notify = (type: 'ok' | 'err', text: string) => {
    setToast({ type, text });
    setTimeout(() => setToast(null), 6000);
  };

  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      const [bRes, sRes, stRes] = await Promise.all([
        fetchSecondBrainBriefingPreview().catch(() => null),
        fetchSecondBrainSuggestions('pending').catch(() => ({ suggestions: [] })),
        fetchSecondBrainSchedulerStatus().catch(() => ({ status: null }))
      ]);
      setBriefing(bRes);
      setSuggestions(sRes?.suggestions || []);
      setSchedulerStatus(stRes?.status || null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  const handleDispatchTelegram = async () => {
    setBusy('telegram');
    try {
      const res = await triggerSecondBrainBriefing();
      notify(
        'ok',
        res.sentToTelegram
          ? 'Briefing Executivo enviado ao vivo para o seu Telegram!'
          : 'Briefing gerado (configure o Bot Telegram em Agentes -> AG-016 para envio push).'
      );
    } catch (err: any) {
      notify('err', err.message || 'Falha ao enviar briefing ao Telegram');
    } finally {
      setBusy(null);
    }
  };

  const handleQuickApprove = async (sug: any) => {
    setBusy(sug.id);
    try {
      const res = await acceptSecondBrainSuggestion(sug.id);
      setSuggestions(prev => prev.filter(item => item.id !== sug.id));
      const code = res.executionTask?.taskCode ? ` (${res.executionTask.taskCode})` : '';
      notify('ok', `Sugestão "${sug.title}" aprovada e enfileirada no Autonomous Worker${code}!`);
    } catch (err: any) {
      notify('err', err.message || 'Falha ao aprovar sugestão');
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* CABEÇALHO */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-5">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-400">
            <Sun className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white tracking-tight">
              Briefing Executivo Diário
            </h1>
            <p className="text-sm text-slate-400">
              Pulso operacional consolidado pelo Segundo Cérebro e agendado para 08:00 BRT
            </p>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            onClick={loadAll}
            disabled={loading || busy !== null}
            className="px-3.5 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 text-xs font-semibold flex items-center gap-1.5 transition-colors"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Atualizar Pulso
          </button>

          <button
            onClick={handleDispatchTelegram}
            disabled={busy !== null}
            className="px-4 py-2 rounded-lg bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold flex items-center gap-1.5 transition-colors"
          >
            <Send className="w-4 h-4" />
            {busy === 'telegram' ? 'Enviando...' : 'Disparar no Telegram Agora'}
          </button>

          <Link
            href="/second-brain"
            className="px-3.5 py-2 rounded-lg bg-purple-600/20 hover:bg-purple-600/30 border border-purple-500/40 text-purple-300 text-xs font-semibold flex items-center gap-1.5 transition-colors"
          >
            <Brain className="w-4 h-4" />
            Cockpit RAG
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      </div>

      {toast && (
        <div
          className={`p-3.5 rounded-xl border text-sm font-medium flex items-center justify-between ${
            toast.type === 'ok'
              ? 'bg-emerald-950/60 border-emerald-500/40 text-emerald-300'
              : 'bg-rose-950/60 border-rose-500/40 text-rose-300'
          }`}
        >
          <span>{toast.text}</span>
          <button onClick={() => setToast(null)} className="text-slate-400 hover:text-white">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* KPI CARDS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-1">
          <div className="text-xs text-slate-400 flex items-center gap-1.5">
            <ListTodo className="w-4 h-4 text-cyan-400" /> Tarefas Ativas
          </div>
          <div className="text-2xl font-bold text-white font-mono">
            {briefing?.pendingTasksCount ?? 0}
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-1">
          <div className="text-xs text-slate-400 flex items-center gap-1.5">
            <Mail className="w-4 h-4 text-sky-400" /> E-mails Não Lidos (AG-012)
          </div>
          <div className="text-2xl font-bold text-white font-mono">
            {briefing?.unreadEmailsCount ?? 0}
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-1">
          <div className="text-xs text-slate-400 flex items-center gap-1.5">
            <Sparkles className="w-4 h-4 text-purple-400" /> Sugestões RAG Pendentes
          </div>
          <div className="text-2xl font-bold text-white font-mono">
            {suggestions.length}
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-1">
          <div className="text-xs text-slate-400 flex items-center gap-1.5">
            <Clock className="w-4 h-4 text-emerald-400" /> Daemon Proativo
          </div>
          <div className="text-sm font-bold text-emerald-400 pt-1">
            {schedulerStatus?.running ? 'ONLINE (Ciclo 15m)' : 'MONITORADO'}
          </div>
          <div className="text-[11px] text-slate-400">
            Quiet Hours: {schedulerStatus?.quietWindow || '21:00 - 07:30'}
          </div>
        </div>
      </div>

      {/* PREVIEW DO BRIEFING + SUGESTÕES RÁPIDAS */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-3">
          <h2 className="text-base font-semibold text-white flex items-center gap-2">
            <Sun className="w-4 h-4 text-amber-400" />
            Síntese Executiva do Dia
          </h2>
          {loading ? (
            <div className="text-sm text-slate-400 py-8 text-center">Compilando pulso operacional...</div>
          ) : (
            <pre className="bg-slate-950 border border-slate-800 rounded-xl p-4 text-xs text-slate-200 whitespace-pre-wrap font-sans leading-relaxed">
              {briefing?.briefingText || 'Nenhum briefing gerado ainda.'}
            </pre>
          )}
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold text-white flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-purple-400" />
              Aprovação Rápida de Sugestões ({suggestions.length})
            </h2>
            <Link href="/second-brain" className="text-xs text-sky-400 hover:underline">
              Ver detalhes e pesos
            </Link>
          </div>

          {suggestions.length === 0 ? (
            <div className="bg-slate-950 border border-slate-800 rounded-xl p-6 text-center text-xs text-slate-400">
              Sem sugestões pendentes no momento. Abra o Cockpit RAG e execute uma varredura proativa.
            </div>
          ) : (
            <div className="space-y-3">
              {suggestions.slice(0, 5).map(s => {
                const probPct = Math.round(Number(s.approval_probability || 0) * 100);
                return (
                  <div
                    key={s.id}
                    className="bg-slate-950 border border-slate-800 rounded-xl p-3.5 space-y-2"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-bold text-white">{s.title}</span>
                      <span className="text-[11px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 shrink-0">
                        {probPct}% Aprovação
                      </span>
                    </div>
                    <p className="text-xs text-slate-400 line-clamp-2">{s.context_summary}</p>
                    <div className="flex items-center justify-between pt-1">
                      <span className="text-[11px] font-mono text-sky-400">{s.target_agent_id}</span>
                      <button
                        onClick={() => handleQuickApprove(s)}
                        disabled={busy === s.id}
                        className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold flex items-center gap-1 transition-colors"
                      >
                        <Check className="w-3.5 h-3.5" />
                        {busy === s.id ? 'Enfileirando...' : 'Aprovar & Executar Agora'}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
