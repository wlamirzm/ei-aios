'use client';

import React, { useState } from 'react';
import {
  Zap,
  ShieldAlert,
  TrendingDown,
  Coins,
  Send,
  Play,
  CheckCircle2,
  Clock,
  ArrowRight
} from 'lucide-react';
import { createObjective } from '@/lib/api-client';

export default function CommandCenterPage() {
  const [objective, setObjective] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!objective.trim()) return;

    setIsSubmitting(true);
    setFeedback(null);
    try {
      const res = await createObjective(objective, 'P1');
      setFeedback(`Objetivo registrado com sucesso! Tarefa-mãe: ${res.parentTaskId}`);
      setObjective('');
    } catch (err: any) {
      setFeedback(`Erro ao registrar objetivo: ${err?.message || 'Falha na conexão com o Agent Core'}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleQuickWorkflow = async (code: string, desc: string) => {
    setIsSubmitting(true);
    setFeedback(null);
    try {
      const res = await createObjective(`Disparar ${code}: ${desc}`, 'P1', undefined, code);
      setFeedback(`Workflow ${code} acionado com sucesso! Tarefa: ${res.parentTaskId}`);
    } catch (err: any) {
      setFeedback(`Erro ao acionar workflow: ${err?.message || 'Falha de comunicação'}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* HEADER DA PÁGINA */}
      <div>
        <h1 className="text-2xl font-bold text-white flex items-center gap-2">
          <Zap className="w-6 h-6 text-emerald-400" />
          Command Center do Fundador
        </h1>
        <p className="text-slate-400 text-sm mt-1">
          Orquestração autônoma e supervisão da equipe de 10 agentes especializados (AG-001 a AG-011).
        </p>
      </div>

      {/* 4 KPIS NO TOPO */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex items-center justify-between">
          <div>
            <span className="text-xs text-slate-400 uppercase tracking-wider font-semibold">Tarefas Ativas</span>
            <div className="text-2xl font-bold text-white mt-1">12</div>
            <span className="text-[11px] text-cyan-400 flex items-center gap-1 mt-1 font-mono">
              <Clock className="w-3 h-3" /> 8 em running / 4 pending
            </span>
          </div>
          <div className="w-10 h-10 rounded-lg bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
            <Zap className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex items-center justify-between">
          <div>
            <span className="text-xs text-slate-400 uppercase tracking-wider font-semibold">Aprovações (Nível 2)</span>
            <div className="text-2xl font-bold text-rose-400 mt-1">2</div>
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
            <span className="text-xs text-slate-400 uppercase tracking-wider font-semibold">Economia Identificada</span>
            <div className="text-2xl font-bold text-emerald-400 mt-1">R$ 142.800</div>
            <span className="text-[11px] text-emerald-400/80 flex items-center gap-1 mt-1 font-mono">
              <TrendingDown className="w-3 h-3" /> Projeção anual apurada
            </span>
          </div>
          <div className="w-10 h-10 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
            <TrendingDown className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex items-center justify-between">
          <div>
            <span className="text-xs text-slate-400 uppercase tracking-wider font-semibold">Custo IA (Hoje / Mês)</span>
            <div className="text-2xl font-bold text-slate-200 mt-1 font-mono">$0.42</div>
            <span className="text-[11px] text-slate-400 flex items-center gap-1 mt-1 font-mono">
              <Coins className="w-3 h-3 text-emerald-400" /> Teto mensal: $15.00
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
            placeholder="Ex: Analisar potencial de migração de enquadramento da Metalúrgica Alvorada e preparar proposta comercial..."
            className="flex-1 bg-slate-950 border border-slate-700 rounded-lg px-4 py-3 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 transition"
          />
          <button
            type="submit"
            disabled={isSubmitting || !objective.trim()}
            className="bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 text-slate-950 font-bold px-6 py-3 rounded-lg flex items-center gap-2 transition text-sm shadow-md"
          >
            <Send className="w-4 h-4" />
            <span>Executar</span>
          </button>
        </form>

        {feedback && (
          <div className="mt-3 p-3 bg-slate-800 border border-slate-700 rounded-lg text-xs font-mono text-emerald-400">
            {feedback}
          </div>
        )}

        {/* WORKFLOWS RÁPIDOS */}
        <div className="mt-4 pt-4 border-t border-slate-800/80">
          <span className="text-xs text-slate-400 font-semibold block mb-2 uppercase tracking-wide">
            Acionamento Rápido de Workflows Pré-Configurados:
          </span>
          <div className="flex flex-wrap gap-2">
            {[
              { code: 'WF-001', name: 'Planejamento Estratégico (AG-001 -> AG-008)' },
              { code: 'WF-003', name: 'Diagnóstico Energético Completo (Core)' },
              { code: 'WF-004', name: 'Campanha de Geração de Demanda ICP' },
              { code: 'WF-007', name: 'Dossiê de Contestação ANEEL (REN 1.000)' },
              { code: 'WF-008', name: 'Fechamento Mensal de M&V e Success Fee' }
            ].map((wf) => (
              <button
                key={wf.code}
                onClick={() => handleQuickWorkflow(wf.code, wf.name)}
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

      {/* LIVE AGENT STREAM (FEED EM TEMPO REAL) */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
        <div className="flex items-center justify-between mb-4 border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse"></span>
            <h2 className="text-sm font-bold text-white uppercase tracking-wider">Live Agent Execution Stream</h2>
          </div>
          <span className="text-xs text-slate-400 font-mono">Conectado ao Supabase Realtime</span>
        </div>

        <div className="space-y-3">
          {[
            {
              agent: 'AG-001 (AI Orchestrator)',
              action: 'Decomposição atômica do objetivo concluída com 3 tarefas encadeadas.',
              time: 'Há 2 minutos',
              status: 'completed',
              badge: 'gemini-2.5-pro'
            },
            {
              agent: 'AG-003 (Energy Specialist)',
              action: 'Executou cálculo determinístico de ultrapassagem: R$ 1.715,00 em multas identificadas.',
              time: 'Há 1 minuto',
              status: 'completed',
              badge: 'energy-calculator.ts'
            },
            {
              agent: 'AG-008 (Quality & Risk Auditor)',
              action: 'Auditoria de conformidade ANEEL aprovada. Rastreabilidade matemática 100% comprovada.',
              time: 'Há 30 segundos',
              status: 'completed',
              badge: 'QA Approved'
            },
            {
              agent: 'AG-007 (Sales Agent)',
              action: 'Minuta de Proposta Comercial gerada. Aguardando aprovação Nível 2 do fundador.',
              time: 'Agora',
              status: 'waiting',
              badge: 'HITL Required'
            }
          ].map((item, idx) => (
            <div key={idx} className="flex items-start justify-between bg-slate-950/60 p-3 rounded-lg border border-slate-800/80">
              <div className="flex items-start gap-3">
                <div className="mt-0.5">
                  {item.status === 'completed' ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  ) : (
                    <Clock className="w-4 h-4 text-amber-400 animate-spin" />
                  )}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-slate-200">{item.agent}</span>
                    <span className="text-[10px] bg-slate-800 text-slate-400 px-1.5 py-0.5 rounded font-mono">{item.badge}</span>
                  </div>
                  <p className="text-xs text-slate-300 mt-1">{item.action}</p>
                </div>
              </div>
              <span className="text-[11px] text-slate-400 font-mono whitespace-nowrap ml-4">{item.time}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

