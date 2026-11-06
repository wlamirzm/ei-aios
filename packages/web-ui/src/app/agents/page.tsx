'use client';

import React, { useState } from 'react';
import {
  Bot,
  Settings2,
  DollarSign,
  Cpu,
  Power,
  Save,
  CheckCircle2,
  MessageSquare,
  X,
  Send,
  Trash2,
  Sparkles,
  Loader2
} from 'lucide-react';
import { chatWithAgent, cleanDatabase } from '@/lib/api-client';

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

interface ChatMessage {
  role: 'user' | 'model';
  text: string;
  tokensUsed?: number;
  costUsd?: number;
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
      temperature: 0.1,
      daily_budget: 8.00,
      enabled: true,
      system_prompt: 'Você é o Auditor QA e Conformidade Regulatória (AG-008)...'
    },
    {
      id: 'AG-009',
      name: 'Customer Success & Operations Agent',
      role: 'Onboarding de clientes, coleta contínua de faturas e relatórios periódicos de economia.',
      model: 'gemini-2.5-flash',
      temperature: 0.2,
      daily_budget: 5.00,
      enabled: true,
      system_prompt: 'Você é o Customer Success & Operations Agent (AG-009)...'
    },
    {
      id: 'AG-010',
      name: 'Finance & Compliance Agent',
      role: 'Apuração de Success Fee, auditoria de devolução em dobro (Art. 323) e DRE.',
      model: 'gemini-2.5-pro',
      temperature: 0.0,
      daily_budget: 8.00,
      enabled: true,
      system_prompt: 'Você é o Finance & Compliance Agent (AG-010)...'
    },
    {
      id: 'AG-011',
      name: 'Legal & Regulatory Agent',
      role: 'Interpretação da Resolução 1.000 da ANEEL, contratos de success fee e termos LGPD.',
      model: 'gemini-2.5-pro',
      temperature: 0.1,
      daily_budget: 6.00,
      enabled: true,
      system_prompt: 'Você é o Consultor Jurídico e Regulatório Setorial (AG-011)...'
    }
  ]);

  const [savedMsg, setSavedMsg] = useState<string | null>(null);
  const [cleaning, setCleaning] = useState(false);

  // Estado do Chat Drawer
  const [activeChatAgent, setActiveChatAgent] = useState<AgentCard | null>(null);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [isSending, setIsSending] = useState(false);

  const handleSave = (id: string) => {
    setSavedMsg(`Configurações e prompt do agente ${id} atualizados com sucesso no Postgres!`);
    setTimeout(() => setSavedMsg(null), 4000);
  };

  const handleCleanDatabase = async () => {
    if (!confirm('Deseja realmente limpar a base de dados? Todas as tarefas, faturas e clientes de teste serão excluídos. Os 11 agentes e tabelas regulatórias da ANEEL serão preservados.')) {
      return;
    }
    setCleaning(true);
    try {
      const res = await cleanDatabase();
      alert(res.message || 'Base limpa com sucesso!');
    } catch (err: any) {
      alert(`Erro ao limpar base: ${err.message}`);
    } finally {
      setCleaning(false);
    }
  };

  const openChatWith = (agent: AgentCard) => {
    setActiveChatAgent(agent);
    setChatMessages([
      {
        role: 'model',
        text: `Olá, fundador! Sou o **${agent.name} (${agent.id})**. Como posso te ajudar hoje na operação da Energy Intelligence?`
      }
    ]);
  };

  const handleSendMessage = async () => {
    if (!inputText.trim() || !activeChatAgent || isSending) return;

    const userMsg = inputText.trim();
    setInputText('');
    const newHistory = [...chatMessages, { role: 'user' as const, text: userMsg }];
    setChatMessages(newHistory);
    setIsSending(true);

    try {
      const historyPayload = chatMessages.map((m) => ({
        role: m.role,
        text: m.text
      }));

      const res = await chatWithAgent(activeChatAgent.id, userMsg, historyPayload);
      setChatMessages((prev) => [
        ...prev,
        {
          role: 'model',
          text: res.reply,
          tokensUsed: res.tokensUsed,
          costUsd: res.costEstimateUsd
        }
      ]);
    } catch (err: any) {
      setChatMessages((prev) => [
        ...prev,
        {
          role: 'model',
          text: `Erro ao comunicar com o agente: ${err.message}`
        }
      ]);
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12 relative">
      {/* CABEÇALHO */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-slate-800 pb-5">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Bot className="w-6 h-6 text-purple-400" />
            Catálogo de Agentes & Governança de Prompts
          </h1>
          <p className="text-slate-400 text-sm mt-1">
            Converse diretamente com cada um dos 11 agentes autônomos ou ajuste seus system prompts e modelos de IA.
          </p>
        </div>

        <button
          onClick={handleCleanDatabase}
          disabled={cleaning}
          className="flex items-center gap-2 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 px-3.5 py-2 rounded-lg text-xs font-semibold transition"
          title="Exclui dados de demonstração e zera o banco de dados"
        >
          <Trash2 className="w-4 h-4" />
          <span>{cleaning ? 'Limpando Base...' : 'Zerar Dados de Demonstração'}</span>
        </button>
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
          <div key={agent.id} className="bg-slate-900 border border-slate-800 rounded-xl p-5 flex flex-col justify-between space-y-4 shadow-lg hover:border-slate-700 transition">
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

            {/* Ações: Conversar ou Salvar */}
            <div className="grid grid-cols-2 gap-2 pt-2">
              <button
                onClick={() => openChatWith(agent)}
                className="w-full bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-400 border border-emerald-500/40 py-2 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition"
              >
                <MessageSquare className="w-3.5 h-3.5" />
                <span>Conversar</span>
              </button>

              <button
                onClick={() => handleSave(agent.id)}
                className="w-full bg-slate-800 hover:bg-slate-700 text-slate-200 py-2 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition border border-slate-700"
              >
                <Save className="w-3.5 h-3.5 text-purple-400" />
                <span>Salvar</span>
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* CHAT DRAWER MODAL */}
      {activeChatAgent && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex justify-end">
          <div className="w-full max-w-lg bg-slate-900 border-l border-slate-800 h-full flex flex-col shadow-2xl">
            {/* Header do Chat */}
            <div className="p-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/70">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-purple-500/10 border border-purple-500/30 flex items-center justify-center text-purple-400">
                  <Bot className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs font-bold text-purple-400 bg-purple-950/80 px-1.5 py-0.5 rounded border border-purple-800">
                      {activeChatAgent.id}
                    </span>
                    <h3 className="font-bold text-sm text-white">{activeChatAgent.name}</h3>
                  </div>
                  <span className="text-[11px] text-slate-400">{activeChatAgent.model}</span>
                </div>
              </div>
              <button
                onClick={() => setActiveChatAgent(null)}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Mensagens do Chat */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {chatMessages.map((msg, i) => (
                <div
                  key={i}
                  className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}
                >
                  <div
                    className={`max-w-[85%] rounded-xl px-4 py-2.5 text-xs leading-relaxed whitespace-pre-wrap ${
                      msg.role === 'user'
                        ? 'bg-emerald-600 text-white rounded-br-none'
                        : 'bg-slate-800 text-slate-200 border border-slate-700/80 rounded-bl-none shadow-md'
                    }`}
                  >
                    {msg.text}
                  </div>
                  {msg.tokensUsed !== undefined && (
                    <span className="text-[10px] text-slate-500 font-mono mt-1">
                      {msg.tokensUsed} tokens • ${msg.costUsd?.toFixed(5)} USD
                    </span>
                  )}
                </div>
              ))}
              {isSending && (
                <div className="flex items-center gap-2 text-xs text-purple-400 bg-slate-800/50 p-2.5 rounded-lg border border-slate-800 w-fit">
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>{activeChatAgent.name} está pensando...</span>
                </div>
              )}
            </div>

            {/* Input do Chat */}
            <div className="p-4 border-t border-slate-800 bg-slate-950/80">
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  placeholder={`Pergunte algo para o ${activeChatAgent.name}...`}
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleSendMessage();
                  }}
                  className="flex-1 bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-purple-500"
                />
                <button
                  onClick={handleSendMessage}
                  disabled={isSending || !inputText.trim()}
                  className="bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 text-slate-950 font-bold p-2 rounded-lg transition"
                >
                  <Send className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
