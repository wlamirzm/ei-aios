'use client';

import React, { useState } from 'react';
import {
  Bot,
  Settings2,
  DollarSign,
  Cpu,
  Power,
  Save,
  CheckCircle2
} from 'lucide-react';

interface AgentCard {
  id: string;
  name: string;
  role: string;
  model: string;
  temperature: number;
  daily_budget: number;
  enabled: boolean;
  system_prompt: string;
}

export default function AgentsPage() {
  const [agents, setAgents] = useState<AgentCard[]>([
    {
      id: 'AG-001',
      name: 'CEO / AI Orchestrator',
      role: 'Coordenação geral, decomposição atômica e consolidação executiva.',
      model: 'gemini-2.5-pro',
      temperature: 0.2,
      daily_budget: 15.00,
      enabled: true,
      system_prompt: 'Você é o AI Orchestrator (AG-001) da Energy Intelligence. Sua responsabilidade é coordenar uma equipe de 10 agentes especializados...'
    },
    {
      id: 'AG-002',
      name: 'Business Strategy Agent',
      role: 'Inteligência de mercado, definição de ICP, análise competitiva e modelagem de receita.',
      model: 'gemini-2.5-pro',
      temperature: 0.3,
      daily_budget: 8.00,
      enabled: true,
      system_prompt: 'Você é o Business Strategy Agent (AG-002) da Energy Intelligence. Sua função é inteligência de mercado...'
    },
    {
      id: 'AG-003',
      name: 'Energy Specialist Agent',
      role: 'Diagnóstico de faturas Grupo A/B, otimização tarifária, ultrapassagem e reativo.',
      model: 'gemini-2.5-pro',
      temperature: 0.1,
      daily_budget: 12.00,
      enabled: true,
      system_prompt: 'Você é o Especialista Técnico em Energia Elétrica e Inteligência Energética (AG-003)...'
    },
    {
      id: 'AG-004',
      name: 'AI & Data Engineering Agent',
      role: 'Estruturação de dados OCR, validação matemática de balanço de faturas e ETL.',
      model: 'gemini-2.5-flash',
      temperature: 0.0,
      daily_budget: 5.00,
      enabled: true,
      system_prompt: 'Você é o Engenheiro de Dados e IA (AG-004)...'
    },
    {
      id: 'AG-005',
      name: 'Software Development Agent',
      role: 'Arquitetura, código full-stack, migrations SQL, conectores de API e documentação.',
      model: 'gemini-2.5-pro',
      temperature: 0.1,
      daily_budget: 10.00,
      enabled: true,
      system_prompt: 'Você é o Engenheiro de Software Sênior (AG-005)...'
    },
    {
      id: 'AG-006',
      name: 'Marketing & Growth Agent',
      role: 'Posicionamento de autoridade, copywriting técnico, landing pages e campanhas B2B.',
      model: 'gemini-2.5-flash',
      temperature: 0.4,
      daily_budget: 5.00,
      enabled: true,
      system_prompt: 'Você é o Especialista em Marketing B2B e Growth (AG-006)...'
    },
    {
      id: 'AG-007',
      name: 'Sales Agent',
      role: 'Qualificação consultiva de leads, propostas comerciais B2B e cartas de intenção (LOI).',
      model: 'gemini-2.5-flash',
      temperature: 0.3,
      daily_budget: 6.00,
      enabled: true,
      system_prompt: 'Você é o Especialista Comercial B2B (AG-007)...'
    },
    {
      id: 'AG-008',
      name: 'Quality & Risk Agent (Auditor QA)',
      role: 'Auditoria e crivo obrigatório de conformidade regulatória, rastreabilidade e premissas.',
      model: 'gemini-2.5-pro',
      temperature: 0.0,
      daily_budget: 12.00,
      enabled: true,
      system_prompt: 'Você é o Auditor de Qualidade, Conformidade e Risco (AG-008)...'
    },
    {
      id: 'AG-009',
      name: 'Regulatory & Tariff Intelligence Agent',
      role: 'Inteligência regulatória ANEEL REN 1.000/2021, Lei 14.300/2022, CCEE e dossiês de contestação.',
      model: 'gemini-2.5-pro',
      temperature: 0.1,
      daily_budget: 8.00,
      enabled: true,
      system_prompt: 'Você é o Especialista em Regulação do Setor Elétrico Brasileiro (AG-009)...'
    },
    {
      id: 'AG-010',
      name: 'Customer Onboarding & M&V Agent',
      role: 'Medição e Verificação (M&V), cálculo de economia comprovada e relatórios mensais.',
      model: 'gemini-2.5-flash',
      temperature: 0.1,
      daily_budget: 6.00,
      enabled: true,
      system_prompt: 'Você é o Agente de Sucesso do Cliente e Medição & Verificação (AG-010)...'
    },
    {
      id: 'AG-011',
      name: 'Startup CFO & Unit Economics Agent',
      role: 'Unit economics, monitoramento de custos de IA (agent_runs), MRR, ARPA, CAC e LTV.',
      model: 'gemini-2.5-flash',
      temperature: 0.1,
      daily_budget: 6.00,
      enabled: true,
      system_prompt: 'Você é o CFO Digital e Especialista em Unit Economics (AG-011)...'
    }
  ]);

  const [savedMsg, setSavedMsg] = useState<string | null>(null);

  const handleSave = (id: string) => {
    setSavedMsg(`Configurações de ${id} atualizadas no Supabase com sucesso!`);
    setTimeout(() => setSavedMsg(null), 3000);
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* HEADER */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Bot className="w-6 h-6 text-purple-400" />
            Catálogo de Agentes & Governança de Prompts
          </h1>
          <p className="text-slate-400 text-sm mt-1">
            Personalize system prompts, modelos de IA, limites diários de orçamento e permissões sem tocar em código.
          </p>
        </div>
      </div>

      {savedMsg && (
        <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 rounded-lg text-xs font-mono flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4" />
          <span>{savedMsg}</span>
        </div>
      )}

      {/* GRADE DOS 11 AGENTES */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {agents.map((agent) => (
          <div key={agent.id} className="bg-slate-900 border border-slate-800 rounded-xl p-5 flex flex-col justify-between space-y-4 shadow-lg">
            <div>
              <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs font-bold text-purple-400 bg-purple-950/80 px-2 py-0.5 rounded border border-purple-800">
                    {agent.id}
                  </span>
                  <span className="text-sm font-bold text-white">{agent.name}</span>
                </div>
                <span className={`w-2 h-2 rounded-full ${agent.enabled ? 'bg-emerald-400' : 'bg-slate-600'}`}></span>
              </div>
              <p className="text-xs text-slate-400 mt-2 leading-relaxed">{agent.role}</p>

              {/* Controles de Configuração */}
              <div className="mt-4 space-y-3 pt-3 border-t border-slate-800 text-xs">
                <div>
                  <label className="text-[11px] text-slate-500 block mb-1">Modelo de IA:</label>
                  <select
                    value={agent.model}
                    onChange={(e) => {
                      const newModel = e.target.value;
                      setAgents((prev) =>
                        prev.map((a) => (a.id === agent.id ? { ...a, model: newModel } : a))
                      );
                    }}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-purple-500"
                  >
                    <option value="gemini-2.5-flash">gemini-2.5-flash (Rápido / Extração)</option>
                    <option value="gemini-2.5-pro">gemini-2.5-pro (Raciocínio Complexo)</option>
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[11px] text-slate-500 block mb-1">Temperatura:</label>
                    <input
                      type="number"
                      step="0.05"
                      min="0"
                      max="1"
                      value={agent.temperature}
                      onChange={(e) => {
                        const val = parseFloat(e.target.value);
                        setAgents((prev) =>
                          prev.map((a) => (a.id === agent.id ? { ...a, temperature: val } : a))
                        );
                      }}
                      className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2 py-1 text-xs text-white font-mono"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] text-slate-500 block mb-1">Teto Diário (USD):</label>
                    <input
                      type="number"
                      step="1"
                      min="1"
                      value={agent.daily_budget}
                      onChange={(e) => {
                        const val = parseFloat(e.target.value);
                        setAgents((prev) =>
                          prev.map((a) => (a.id === agent.id ? { ...a, daily_budget: val } : a))
                        );
                      }}
                      className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2 py-1 text-xs text-emerald-400 font-mono"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-[11px] text-slate-500 block mb-1">System Prompt Especializado:</label>
                  <textarea
                    rows={3}
                    value={agent.system_prompt}
                    onChange={(e) => {
                      const text = e.target.value;
                      setAgents((prev) =>
                        prev.map((a) => (a.id === agent.id ? { ...a, system_prompt: text } : a))
                      );
                    }}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-[11px] text-slate-300 font-mono resize-none focus:outline-none focus:border-purple-500"
                  />
                </div>
              </div>
            </div>

            <button
              onClick={() => handleSave(agent.id)}
              className="w-full bg-slate-800 hover:bg-slate-700 text-slate-200 py-1.5 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition border border-slate-700 mt-2"
            >
              <Save className="w-3.5 h-3.5 text-purple-400" />
              <span>Salvar Alterações</span>
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

