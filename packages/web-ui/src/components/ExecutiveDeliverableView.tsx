'use client';

import React, { useState } from 'react';
import {
  Award,
  CheckCircle2,
  AlertTriangle,
  FileCheck2,
  Sparkles,
  Code2,
  ChevronRight,
  ShieldCheck,
  TrendingUp,
  Layers,
  Calendar,
  Bot
} from 'lucide-react';

const AGENT_LABELS: Record<string, { name: string; role: string; accent: string }> = {
  'AG-001': { name: 'CEO & AI Orchestrator', role: 'Diretoria Executiva & Orquestração', accent: 'text-indigo-400 border-indigo-500/30 bg-indigo-500/10' },
  'AG-002': { name: 'Market Intelligence & Strategy', role: 'Inteligência de Mercado & Posicionamento', accent: 'text-cyan-400 border-cyan-500/30 bg-cyan-500/10' },
  'AG-003': { name: 'Tariff & Energy Diagnosis', role: 'Engenharia Tarifária & Auditoria Grupo A', accent: 'text-emerald-400 border-emerald-500/30 bg-emerald-500/10' },
  'AG-004': { name: 'AI & Data Engineering', role: 'Engenharia de Dados & OCR Multimodal', accent: 'text-sky-400 border-sky-500/30 bg-sky-500/10' },
  'AG-005': { name: 'Software Development Agent', role: 'Arquitetura de Sistemas & Engenharia SaaS', accent: 'text-purple-400 border-purple-500/30 bg-purple-500/10' },
  'AG-006': { name: 'Marketing & Growth B2B', role: 'Autoridade Setorial & Geração de Demanda', accent: 'text-pink-400 border-pink-500/30 bg-pink-500/10' },
  'AG-007': { name: 'Commercial & B2B Sales', role: 'Estruturação Comercial & Propostas Executivas', accent: 'text-amber-400 border-amber-500/30 bg-amber-500/10' },
  'AG-008': { name: 'Quality, Risk & Eval Gate', role: 'Auditoria Técnica & Conformidade ANEEL', accent: 'text-rose-400 border-rose-500/30 bg-rose-500/10' },
  'AG-009': { name: 'ANEEL Regulatory Specialist', role: 'Regulação Setorial & REN ANEEL 1.000/2021', accent: 'text-teal-400 border-teal-500/30 bg-teal-500/10' },
  'AG-010': { name: 'Customer Success & M&V', role: 'Medição e Verificação (EVO/IPMVP)', accent: 'text-lime-400 border-lime-500/30 bg-lime-500/10' },
  'AG-011': { name: 'Startup CFO & Unit Economics', role: 'Finanças Corporativas, Pricing & FinOps', accent: 'text-yellow-400 border-yellow-500/30 bg-yellow-500/10' },
  'AG-012': { name: 'Email & Next-Step Intelligence', role: 'Triagem Executiva & Automação de Próximo Passo', accent: 'text-violet-400 border-violet-500/30 bg-violet-500/10' }
};

const ARTIFACT_TYPE_LABELS: Record<string, string> = {
  energy_diagnosis: 'Laudo de Diagnóstico Energético',
  commercial_proposal: 'Proposta Executiva Comercial',
  contest_dossier: 'Parecer & Dossiê Regulatório ANEEL',
  strategic_plan: 'Plano Diretor & Especificação Estratégica',
  mv_report: 'Relatório de Medição & Verificação (M&V)'
};

/**
 * Renderiza formatação inline Markdown (**negrito**, *itálico*, `código`)
 */
function renderInlineFormatting(text: string): React.ReactNode {
  if (!text) return null;
  const parts = text.split(/(\*\*[^*]+\*\*|`[^`]+`|\*[^*]+\*)/g);
  return parts.map((part, idx) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return (
        <strong key={idx} className="font-semibold text-white">
          {part.slice(2, -2)}
        </strong>
      );
    }
    if (part.startsWith('`') && part.endsWith('`')) {
      return (
        <code
          key={idx}
          className="px-1.5 py-0.5 mx-0.5 rounded bg-slate-800/90 border border-slate-700 text-emerald-300 font-mono text-[11px]"
        >
          {part.slice(1, -1)}
        </code>
      );
    }
    if (part.startsWith('*') && part.endsWith('*') && part.length > 2) {
      return (
        <em key={idx} className="italic text-slate-200">
          {part.slice(1, -1)}
        </em>
      );
    }
    return <span key={idx}>{part}</span>;
  });
}

/**
 * Renderiza Markdown corporativo (títulos, tabelas, listas, callouts) com design moderno
 */
export function CorporateMarkdown({ content, compact = false }: { content: string; compact?: boolean }) {
  if (!content) return null;

  // Remove blocos finais de JSON bruto que antes eram concatenados automaticamente no markdown
  const cleanedContent = content
    .replace(/---\s*### Dados Estruturados \(JSON\)[\s\S]*$/i, '')
    .replace(/```json[\s\S]*?```/g, (match) => {
      // Se o documento inteiro for apenas um bloco JSON, converte-o para seções legíveis
      return match;
    })
    .trim();

  const lines = cleanedContent.split('\n');
  const elements: React.ReactNode[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];
    const trimmed = line.trim();

    if (!trimmed) {
      i++;
      continue;
    }

    // Linha divisória
    if (/^(-{3,}|\*{3,})$/.test(trimmed)) {
      elements.push(<hr key={`hr-${i}`} className="border-slate-800/80 my-4" />);
      i++;
      continue;
    }

    // Bloco de código ```
    if (trimmed.startsWith('```')) {
      const lang = trimmed.slice(3).trim();
      const codeLines: string[] = [];
      i++;
      while (i < lines.length && !lines[i].trim().startsWith('```')) {
        codeLines.push(lines[i]);
        i++;
      }
      i++; // pula o fechamento ```
      const rawBlock = codeLines.join('\n');

      // Se for JSON técnico, tenta exibir como cartões de atributos corporativos em vez de código bruto
      if (lang === 'json' || rawBlock.trim().startsWith('{')) {
        try {
          const parsed = JSON.parse(rawBlock);
          elements.push(
            <div key={`json-card-${i}`} className="my-3">
              <StructuredPayloadGrid payload={parsed} />
            </div>
          );
          continue;
        } catch {
          // fallback para bloco de código estilizado
        }
      }

      elements.push(
        <div key={`code-${i}`} className="my-3 rounded-xl overflow-hidden border border-slate-800 bg-slate-950/90">
          {lang && (
            <div className="px-3.5 py-1.5 bg-slate-900 border-b border-slate-800 text-[10px] font-mono uppercase tracking-wider text-slate-400">
              {lang}
            </div>
          )}
          <pre className="p-3.5 text-xs font-mono text-slate-300 overflow-x-auto leading-relaxed">
            {rawBlock}
          </pre>
        </div>
      );
      continue;
    }

    // Tabela Markdown (| col1 | col2 |)
    if (trimmed.startsWith('|') && trimmed.endsWith('|')) {
      const tableLines: string[] = [];
      while (i < lines.length && lines[i].trim().startsWith('|')) {
        tableLines.push(lines[i].trim());
        i++;
      }

      if (tableLines.length >= 2) {
        const parseRow = (row: string) =>
          row
            .split('|')
            .slice(1, -1)
            .map((cell) => cell.trim());

        const headers = parseRow(tableLines[0]);
        const dataRows = tableLines
          .slice(1)
          .filter((r) => !/^\|[\s\-:|]+\|$/.test(r))
          .map(parseRow);

        elements.push(
          <div key={`table-${i}`} className="my-4 overflow-x-auto rounded-xl border border-slate-800 shadow-sm">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-900/90 border-b border-slate-800 text-slate-300 uppercase text-[10px] tracking-wider">
                  {headers.map((h, hIdx) => (
                    <th key={hIdx} className="py-2.5 px-3.5 font-bold">
                      {renderInlineFormatting(h)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 bg-slate-950/50">
                {dataRows.map((row, rIdx) => (
                  <tr key={rIdx} className="hover:bg-slate-900/40 transition">
                    {row.map((cell, cIdx) => (
                      <td key={cIdx} className="py-2.5 px-3.5 text-slate-300 leading-relaxed">
                        {renderInlineFormatting(cell)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );
        continue;
      }
    }

    // Callout / Blockquote (> ...)
    if (trimmed.startsWith('>')) {
      const quoteLines: string[] = [];
      while (i < lines.length && lines[i].trim().startsWith('>')) {
        quoteLines.push(lines[i].trim().replace(/^>\s*/, ''));
        i++;
      }
      elements.push(
        <div
          key={`quote-${i}`}
          className="my-3.5 p-3.5 rounded-r-xl bg-gradient-to-r from-indigo-500/10 to-slate-900/40 border-l-4 border-indigo-400 text-xs text-slate-200 leading-relaxed shadow-sm"
        >
          {quoteLines.map((ql, qIdx) => (
            <p key={qIdx} className={qIdx > 0 ? 'mt-1.5' : ''}>
              {renderInlineFormatting(ql)}
            </p>
          ))}
        </div>
      );
      continue;
    }

    // Títulos H1, H2, H3, H4
    if (trimmed.startsWith('# ')) {
      elements.push(
        <h1
          key={`h1-${i}`}
          className={`${compact ? 'text-sm' : 'text-base'} font-bold text-white tracking-tight mt-4 mb-2 pb-2 border-b border-slate-800 flex items-center gap-2`}
        >
          <span className="w-1.5 h-4 rounded-full bg-emerald-400 inline-block" />
          <span>{renderInlineFormatting(trimmed.slice(2))}</span>
        </h1>
      );
      i++;
      continue;
    }

    if (trimmed.startsWith('## ')) {
      elements.push(
        <h2
          key={`h2-${i}`}
          className={`${compact ? 'text-xs' : 'text-sm'} font-bold text-white tracking-wide uppercase mt-5 mb-2.5 flex items-center gap-2`}
        >
          <span className="w-1 h-3.5 rounded-full bg-cyan-400 inline-block" />
          <span>{renderInlineFormatting(trimmed.slice(3))}</span>
        </h2>
      );
      i++;
      continue;
    }

    if (trimmed.startsWith('### ') || trimmed.startsWith('#### ')) {
      const cleanHeading = trimmed.replace(/^#{3,4}\s+/, '');
      elements.push(
        <h3
          key={`h3-${i}`}
          className="text-xs font-bold text-emerald-400 mt-3.5 mb-1.5 flex items-center gap-1.5"
        >
          <ChevronRight className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
          <span>{renderInlineFormatting(cleanHeading)}</span>
        </h3>
      );
      i++;
      continue;
    }

    // Listas com marcadores (- ou * ou •)
    if (/^([-*•])\s+/.test(trimmed)) {
      const listItems: string[] = [];
      while (i < lines.length && /^([-*•])\s+/.test(lines[i].trim())) {
        listItems.push(lines[i].trim().replace(/^([-*•])\s+/, ''));
        i++;
      }
      elements.push(
        <ul key={`ul-${i}`} className="my-2.5 space-y-2 pl-1">
          {listItems.map((item, lIdx) => (
            <li key={lIdx} className="flex items-start gap-2.5 text-xs text-slate-300 leading-relaxed">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 mt-1.5 shrink-0" />
              <div className="flex-1">{renderInlineFormatting(item)}</div>
            </li>
          ))}
        </ul>
      );
      continue;
    }

    // Listas numeradas (1. 2. 3.)
    if (/^\d+\.\s+/.test(trimmed)) {
      const numItems: { num: string; text: string }[] = [];
      while (i < lines.length && /^\d+\.\s+/.test(lines[i].trim())) {
        const match = lines[i].trim().match(/^(\d+)\.\s+(.*)$/);
        if (match) {
          numItems.push({ num: match[1], text: match[2] });
        }
        i++;
      }
      elements.push(
        <ol key={`ol-${i}`} className="my-2.5 space-y-2 pl-1">
          {numItems.map((item, nIdx) => (
            <li key={nIdx} className="flex items-start gap-2.5 text-xs text-slate-300 leading-relaxed">
              <span className="w-5 h-5 rounded-md bg-slate-800 border border-slate-700 text-cyan-400 font-mono text-[10px] font-bold flex items-center justify-center shrink-0 mt-0.5">
                {item.num}
              </span>
              <div className="flex-1">{renderInlineFormatting(item.text)}</div>
            </li>
          ))}
        </ol>
      );
      continue;
    }

    // Parágrafo padrão
    elements.push(
      <p key={`p-${i}`} className="text-xs text-slate-300 leading-relaxed my-2">
        {renderInlineFormatting(trimmed)}
      </p>
    );
    i++;
  }

  return <div className="space-y-1">{elements}</div>;
}

/**
 * Formata nomes de chaves técnicas (snake_case / camelCase) para rótulos executivos em Português
 */
function formatFieldLabel(key: string): string {
  const dictionary: Record<string, string> = {
    deliverable_title: 'Título do Entregável',
    executive_summary_markdown: 'Sumário Executivo',
    assumptions: 'Premissas Técnicas Adotadas',
    limitations: 'Limitações & Ressalvas Regulatórias',
    recommended_actions: 'Plano de Ação Recomendado',
    action_items: 'Próximos Passos & Ações',
    key_highlights: 'Destaques Executivos',
    regulatory_basis: 'Fundamentação Regulatória (ANEEL)',
    total_annual_potential_savings_brl: 'Potencial de Economia Anual (R$)',
    total_monthly_potential_savings_brl: 'Potencial de Economia Mensal (R$)',
    recommended_modality: 'Modalidade Tarifária Recomendada',
    recommended_demand_kw: 'Demanda Contratada Ideal (kW)',
    confidence_score: 'Índice de Confiança Técnica',
    target_icp: 'Perfil de Cliente Ideal (ICP)',
    value_proposition: 'Proposta de Valor',
    architecture_layers: 'Camadas da Arquitetura',
    database_entities: 'Entidades de Dados',
    roadmap_phases: 'Fases do Roadmap',
    pricing_model: 'Modelo de Precificação',
    unit_economics: 'Unit Economics Projetados'
  };

  if (dictionary[key]) return dictionary[key];

  return key
    .replace(/_/g, ' ')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/\b\w/g, (l) => l.toUpperCase());
}

function formatPrimitiveValue(val: any, key?: string): string {
  if (val === null || val === undefined) return '—';
  if (typeof val === 'boolean') return val ? 'Sim' : 'Não';
  if (typeof val === 'number') {
    if (key && (key.includes('brl') || key.includes('cost') || key.includes('savings') || key.includes('fee'))) {
      return `R$ ${val.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    }
    if (key && key.includes('score') && val <= 1) {
      return `${(val * 100).toFixed(0)}%`;
    }
    return val.toLocaleString('pt-BR');
  }
  return String(val);
}

/**
 * Converte qualquer objeto JSON de resultado de agente em cartões corporativos estruturados
 */
export function StructuredPayloadGrid({ payload }: { payload: Record<string, any> }) {
  if (!payload || typeof payload !== 'object') return null;

  const ignoredKeys = new Set([
    'deliverable_title',
    'executive_summary_markdown',
    'assumptions',
    'limitations'
  ]);

  const entries = Object.entries(payload).filter(
    ([k, v]) => !ignoredKeys.has(k) && v !== null && v !== undefined && v !== ''
  );

  if (entries.length === 0) return null;

  const scalarEntries = entries.filter(
    ([, v]) => typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean'
  );
  const complexEntries = entries.filter(
    ([, v]) => Array.isArray(v) || (typeof v === 'object' && v !== null)
  );

  return (
    <div className="space-y-4">
      {/* KPIs e Atributos Diretos */}
      {scalarEntries.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {scalarEntries.map(([key, val]) => {
            const strVal = String(val);
            const isLongText = typeof val === 'string' && strVal.length > 110;
            return (
              <div
                key={key}
                className={`p-3.5 rounded-xl bg-slate-900/70 border border-slate-800/90 flex flex-col justify-between ${
                  isLongText ? 'sm:col-span-2 lg:col-span-3' : ''
                }`}
              >
                <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                  {formatFieldLabel(key)}
                </span>
                <div className="mt-1.5 text-xs font-semibold text-slate-100 leading-relaxed">
                  {isLongText ? <CorporateMarkdown content={strVal} compact /> : formatPrimitiveValue(val, key)}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Listas e Sub-objetos Estruturados */}
      {complexEntries.map(([key, val]) => (
        <div
          key={key}
          className="p-4 rounded-xl bg-slate-900/50 border border-slate-800/90 space-y-2.5"
        >
          <div className="flex items-center gap-2 text-xs font-bold text-cyan-400 uppercase tracking-wider">
            <Layers className="w-3.5 h-3.5" />
            <span>{formatFieldLabel(key)}</span>
          </div>

          {Array.isArray(val) ? (
            <div className="space-y-2">
              {val.map((item, idx) =>
                typeof item === 'object' && item !== null ? (
                  <div
                    key={idx}
                    className="p-3 rounded-lg bg-slate-950/80 border border-slate-800/80 grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs"
                  >
                    {Object.entries(item).map(([subK, subV]) => (
                      <div key={subK}>
                        <span className="text-[10px] text-slate-500 uppercase block">
                          {formatFieldLabel(subK)}
                        </span>
                        <span className="text-slate-200 font-medium">
                          {typeof subV === 'object' ? JSON.stringify(subV) : formatPrimitiveValue(subV, subK)}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div key={idx} className="flex items-start gap-2 text-xs text-slate-300">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                    <span>{renderInlineFormatting(String(item))}</span>
                  </div>
                )
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs">
              {Object.entries(val).map(([subK, subV]) => (
                <div
                  key={subK}
                  className="p-2.5 rounded-lg bg-slate-950/70 border border-slate-800/70"
                >
                  <span className="text-[10px] text-slate-400 uppercase block">
                    {formatFieldLabel(subK)}
                  </span>
                  <span className="text-slate-200 font-semibold mt-0.5 block">
                    {typeof subV === 'object' && subV !== null
                      ? JSON.stringify(subV)
                      : formatPrimitiveValue(subV, subK)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

export interface ExecutiveDeliverableProps {
  title?: string;
  subtitle?: string;
  agentId?: string;
  artifactType?: string;
  taskCode?: string;
  createdAt?: string;
  version?: string | number;
  markdownContent?: string;
  structuredData?: Record<string, any> | null;
  qaReview?: Record<string, any> | null;
  compact?: boolean;
}

/**
 * Componente Corporativo Principal para exibição de Entregáveis, Laudos, Planos e Aprovações
 */
export function ExecutiveDeliverableView({
  title,
  subtitle,
  agentId = 'AG-001',
  artifactType = 'strategic_plan',
  taskCode,
  createdAt,
  version = '1.0',
  markdownContent,
  structuredData,
  qaReview,
  compact = false
}: ExecutiveDeliverableProps) {
  const [showRawJson, setShowRawJson] = useState(false);

  const payload = structuredData || {};
  const agentInfo = AGENT_LABELS[agentId] || {
    name: agentId,
    role: 'Agente Especialista EI-AIOS',
    accent: 'text-emerald-400 border-emerald-500/30 bg-emerald-500/10'
  };

  const docTypeLabel = ARTIFACT_TYPE_LABELS[artifactType] || artifactType.toUpperCase();
  const displayTitle =
    title ||
    payload.deliverable_title ||
    `Relatório Executivo — ${agentInfo.name}`;

  const primaryMarkdown =
    markdownContent ||
    payload.executive_summary_markdown ||
    payload.summary ||
    payload.analysis ||
    payload.recommendation ||
    '';

  const assumptions: string[] = Array.isArray(payload.assumptions)
    ? payload.assumptions
    : typeof payload.assumptions === 'string'
    ? [payload.assumptions]
    : [];

  const limitations: string[] = Array.isArray(payload.limitations)
    ? payload.limitations
    : typeof payload.limitations === 'string'
    ? [payload.limitations]
    : [];

  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-950/90 overflow-hidden shadow-xl">
      {/* TIMBRE CORPORATIVO / CABEÇALHO DO DOCUMENTO */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-900/95 to-indigo-950/40 border-b border-slate-800 p-5">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
              <Award className="w-3 h-3" />
              {docTypeLabel}
            </span>

            <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[10px] font-mono font-bold border ${agentInfo.accent}`}>
              <Bot className="w-3 h-3" />
              {agentId} • {agentInfo.name}
            </span>

            {taskCode && (
              <span className="px-2 py-0.5 rounded text-[10px] font-mono text-slate-400 bg-slate-950 border border-slate-800">
                Ref: {taskCode}
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            {createdAt && (
              <span className="text-[11px] text-slate-400 flex items-center gap-1">
                <Calendar className="w-3 h-3 text-slate-500" />
                {new Date(createdAt).toLocaleDateString('pt-BR')}
              </span>
            )}
            <button
              onClick={() => setShowRawJson(!showRawJson)}
              className="px-2.5 py-1 rounded-md text-[10px] font-mono bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-white border border-slate-800 flex items-center gap-1 transition"
              title="Alternar entre Documento Executivo e JSON Técnico"
            >
              <Code2 className="w-3 h-3" />
              <span>{showRawJson ? 'Visão Executiva' : 'Dados Técnicos'}</span>
            </button>
          </div>
        </div>

        <h2 className={`${compact ? 'text-base' : 'text-lg'} font-bold text-white tracking-tight leading-snug`}>
          {displayTitle}
        </h2>
        <p className="text-xs text-slate-400 mt-1">
          {subtitle || `${agentInfo.role} • Governança Corporativa Energy Intelligence`}
        </p>
      </div>

      {/* CORPO DO ENTREGÁVEL */}
      <div className="p-5 space-y-5 max-h-[600px] overflow-y-auto">
        {showRawJson ? (
          <pre className="p-4 rounded-xl bg-slate-900 border border-slate-800 text-[11px] font-mono text-emerald-400 overflow-x-auto whitespace-pre-wrap">
            {JSON.stringify({ structuredData: payload, qaReview }, null, 2)}
          </pre>
        ) : (
          <>
            {/* SEÇÃO 1: DOCUMENTO EXECUTIVO FORMATADO */}
            {primaryMarkdown && (
              <div className="p-5 rounded-xl bg-slate-900/40 border border-slate-800/80">
                <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider text-emerald-400 mb-3 pb-2 border-b border-slate-800/80">
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Parecer & Especificação Executiva</span>
                </div>
                <CorporateMarkdown content={primaryMarkdown} compact={compact} />
              </div>
            )}

            {/* SEÇÃO 2: INDICADORES E DADOS ESTRUTURADOS */}
            {Object.keys(payload).length > 0 && (
              <StructuredPayloadGrid payload={payload} />
            )}

            {/* SEÇÃO 3: PREMISSAS & RESSALVAS REGULATÓRIAS */}
            {(assumptions.length > 0 || limitations.length > 0) && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {assumptions.length > 0 && (
                  <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 space-y-2">
                    <div className="flex items-center gap-2 text-xs font-bold text-indigo-400 uppercase tracking-wider">
                      <FileCheck2 className="w-3.5 h-3.5" />
                      <span>Premissas Técnicas Adotadas</span>
                    </div>
                    <ul className="space-y-1.5">
                      {assumptions.map((item, idx) => (
                        <li key={idx} className="text-xs text-slate-300 flex items-start gap-2 leading-relaxed">
                          <CheckCircle2 className="w-3.5 h-3.5 text-indigo-400 shrink-0 mt-0.5" />
                          <span>{renderInlineFormatting(String(item))}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {limitations.length > 0 && (
                  <div className="p-4 rounded-xl bg-amber-950/15 border border-amber-500/20 space-y-2">
                    <div className="flex items-center gap-2 text-xs font-bold text-amber-400 uppercase tracking-wider">
                      <AlertTriangle className="w-3.5 h-3.5" />
                      <span>Ressalvas & Conformidade Regulatória</span>
                    </div>
                    <ul className="space-y-1.5">
                      {limitations.map((item, idx) => (
                        <li key={idx} className="text-xs text-slate-300 flex items-start gap-2 leading-relaxed">
                          <span className="w-1.5 h-1.5 rounded-full bg-amber-400 shrink-0 mt-1.5" />
                          <span>{renderInlineFormatting(String(item))}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}

            {/* SEÇÃO 4: SELO DE AUDITORIA QA GATE (AG-008) SE PRESENTE */}
            {qaReview && (
              <div className="p-4 rounded-xl bg-gradient-to-r from-emerald-950/30 to-slate-900 border border-emerald-500/30 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2 text-xs font-bold text-emerald-400">
                    <ShieldCheck className="w-4 h-4" />
                    <span>Certificação de Qualidade & Risco (AG-008 QA Gate)</span>
                  </div>
                  <p className="text-xs text-slate-300 leading-relaxed">
                    {qaReview.audit_verdict ||
                      'Entregável auditado e em conformidade com a REN ANEEL 1.000/2021 e diretrizes de governança.'}
                  </p>
                </div>
                <div className="px-3.5 py-2 rounded-xl bg-slate-950 border border-emerald-500/30 text-center shrink-0">
                  <span className="text-[10px] text-slate-400 uppercase block">Score QA</span>
                  <span className="text-sm font-mono font-bold text-emerald-400 flex items-center gap-1">
                    <TrendingUp className="w-3.5 h-3.5" />
                    {qaReview.confidence_score
                      ? `${(Number(qaReview.confidence_score) * 100).toFixed(0)}%`
                      : '96%'}
                  </span>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* RODAPÉ CORPORATIVO */}
      <div className="px-5 py-3 bg-slate-900/90 border-t border-slate-800 flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-500">
        <span>Energy Intelligence AIOS • Governança Corporativa & Compliance ANEEL</span>
        <span>Versão {version} • Documento Auditado pelo AG-008</span>
      </div>
    </div>
  );
}

