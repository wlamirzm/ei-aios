'use client';

import React, { useState } from 'react';
import {
  ShieldCheck,
  ShieldAlert,
  CheckCircle,
  XCircle,
  FileText,
  AlertTriangle,
  ArrowRight
} from 'lucide-react';
import { decideApproval } from '@/lib/api-client';

export default function ApprovalsPage() {
  const [comments, setComments] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [activeDecision, setActiveDecision] = useState<string | null>(null);

  const handleDecision = async (id: string, decision: 'approved' | 'rejected') => {
    setIsProcessing(true);
    try {
      await decideApproval(id, decision, comments);
      setActiveDecision(`Decisão registrada: ${decision.toUpperCase()} com sucesso!`);
    } catch (err: any) {
      setActiveDecision(`Erro: ${err?.message || 'Falha ao comunicar com o servidor'}`);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* HEADER */}
      <div>
        <h1 className="text-2xl font-bold text-white flex items-center gap-2">
          <ShieldCheck className="w-6 h-6 text-amber-400" />
          Central de Aprovações Human-in-the-Loop (Nível 2)
        </h1>
        <p className="text-slate-400 text-sm mt-1">
          Nenhuma ação externa, proposta comercial, compromisso financeiro ou deploy é executado sem sua validação soberana.
        </p>
      </div>

      {activeDecision && (
        <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 rounded-lg text-xs font-mono">
          {activeDecision}
        </div>
      )}

      {/* CARD DE DECISÃO EM DESTAQUE (SPLIT-SCREEN) */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-xl">
        {/* Top Header do Card */}
        <div className="bg-slate-850 px-6 py-4 border-b border-slate-800 flex items-center justify-between">
          <div>
            <div className="flex items-center gap-3">
              <span className="font-mono text-xs bg-amber-500/20 text-amber-400 border border-amber-500/30 px-2 py-0.5 rounded font-bold">
                TASK-0042
              </span>
              <h2 className="text-sm font-bold text-white">
                Proposta Comercial de Sucesso & Minuta de LOI — Metalúrgica Alvorada
              </h2>
            </div>
            <p className="text-xs text-slate-400 mt-1">
              Solicitado por: <span className="text-slate-200 font-semibold">AG-007 (Sales Agent)</span> • Risco: <span className="text-rose-400 font-semibold">LEVEL_2_APPROVAL_REQUIRED</span>
            </p>
          </div>
          <span className="text-xs bg-rose-500/10 text-rose-400 border border-rose-500/30 px-3 py-1 rounded-full font-semibold">
            Pendente
          </span>
        </div>

        {/* VISUALIZADOR SPLIT-SCREEN LADO A LADO */}
        <div className="grid grid-cols-1 lg:grid-cols-2 divide-y lg:divide-y-0 lg:divide-x divide-slate-800 p-6 gap-6">
          {/* LADO ESQUERDO: ENTREGÁVEL DO AGENTE ESPECIALISTA */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-xs font-bold text-slate-300 uppercase tracking-wider">
              <FileText className="w-4 h-4 text-emerald-400" />
              <span>Entregável Proposto pelo AG-007:</span>
            </div>
            
            <div className="bg-slate-950 p-4 rounded-lg border border-slate-800 text-xs text-slate-300 space-y-3 font-mono leading-relaxed max-h-96 overflow-y-auto">
              <p className="text-emerald-400 font-bold text-sm">PROPOSTA COMERCIAL: CONSULTORIA ENERGÉTICA CONTINUADA</p>
              <p><strong>Cliente:</strong> Indústrias Metalúrgicas Alvorada S.A.</p>
              <p><strong>Escopo Técnico:</strong> Otimização da Demanda Contratada de 250 kW para 220 kW e mitigação de multas de reativo excedente via instalação de banco de capacitores.</p>
              <div className="p-2.5 bg-slate-900 rounded border border-slate-800">
                <p className="text-white font-semibold">Modelo Financeiro Proposto:</p>
                <p>• Mensalidade SaaS: R$ 1.800,00 / mês</p>
                <p>• Success Fee: 20,00% sobre a economia líquida comprovada (M&V)</p>
                <p>• Economia Anual Estimada: R$ 38.450,00</p>
              </div>
              <p className="text-slate-400">Status da Minuta de Carta de Intenção (LOI): Gerada com cláusula de confidencialidade e pronta para assinatura do Diretor Industrial.</p>
            </div>
          </div>

          {/* LADO DIREITO: AUDITORIA DO AG-008 (QA GATE) */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-xs font-bold text-slate-300 uppercase tracking-wider">
              <ShieldCheck className="w-4 h-4 text-amber-400" />
              <span>Parecer do Auditor de Qualidade & Risco (AG-008):</span>
            </div>

            <div className="bg-slate-950 p-4 rounded-lg border border-slate-800 text-xs text-slate-300 space-y-3 max-h-96 overflow-y-auto">
              <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                <span className="font-semibold text-slate-200">Score de Confiança:</span>
                <span className="font-mono text-emerald-400 font-bold">96%</span>
              </div>

              <div className="space-y-2">
                <div className="flex items-center gap-2 text-emerald-400">
                  <CheckCircle className="w-3.5 h-3.5" />
                  <span>Rastreabilidade matemática: 100% ancorada no energy-calculator.ts</span>
                </div>
                <div className="flex items-center gap-2 text-emerald-400">
                  <CheckCircle className="w-3.5 h-3.5" />
                  <span>Sem falsas garantias: Termo "economia estimada" empregado corretamente</span>
                </div>
                <div className="flex items-center gap-2 text-emerald-400">
                  <CheckCircle className="w-3.5 h-3.5" />
                  <span>Conformidade ANEEL REN 1.000/2021 e LGPD verificadas</span>
                </div>
              </div>

              <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded text-amber-300 text-[11px] leading-relaxed">
                <strong>Parecer Final do QA:</strong> O entregável atende plenamente aos critérios de rigor técnico e segurança jurídica. Apenas a aprovação soberana do fundador é necessária para envio ao cliente.
              </div>
            </div>
          </div>
        </div>

        {/* BARRA DE AÇÃO INFERIOR COM INPUT DE FEEDBACK */}
        <div className="bg-slate-850 px-6 py-4 border-t border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-4">
          <input
            type="text"
            value={comments}
            onChange={(e) => setComments(e.target.value)}
            placeholder="Observações opcionais ou instruções de ajuste caso rejeite..."
            className="flex-1 bg-slate-950 border border-slate-700 rounded-lg px-4 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 w-full"
          />

          <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
            <button
              onClick={() => handleDecision('mock-approval-01', 'rejected')}
              disabled={isProcessing}
              className="bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 text-rose-400 font-semibold px-4 py-2 rounded-lg text-xs flex items-center gap-1.5 transition"
            >
              <XCircle className="w-4 h-4" />
              <span>Rejeitar (Ajuste)</span>
            </button>

            <button
              onClick={() => handleDecision('mock-approval-01', 'approved')}
              disabled={isProcessing}
              className="bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-bold px-5 py-2 rounded-lg text-xs flex items-center gap-1.5 transition shadow-md"
            >
              <CheckCircle className="w-4 h-4" />
              <span>Aprovar e Prosseguir</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

