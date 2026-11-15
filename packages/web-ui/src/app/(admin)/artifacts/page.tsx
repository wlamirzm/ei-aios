'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  FileText,
  Download,
  Copy,
  Check,
  Search,
  RefreshCw,
  Inbox,
  ChevronDown,
  ChevronRight,
  FolderTree,
  List,
  Sparkles,
  ArrowRight,
  ShieldCheck,
  Bot,
  Layers,
  FileSpreadsheet,
  FileCheck2,
  CheckCircle2
} from 'lucide-react';
import { fetchArtifacts, fetchTasks } from '@/lib/api-client';
import { ExecutiveDeliverableView } from '@/components/ExecutiveDeliverableView';

interface TaskItem {
  id: string;
  task_code: string;
  parent_task_id: string | null;
  assigned_agent_id: string;
  objective: string;
  status: string;
  risk_level?: number;
  result_payload?: any;
  qa_review_payload?: any;
  created_at?: string;
  completed_at?: string;
}

interface ArtifactItem {
  id: string;
  title: string;
  artifact_type: string;
  summary?: string;
  content_markdown?: string;
  structured_data?: any;
  version?: string;
  created_at?: string;
  metadata?: {
    task_code?: string;
    created_by_agent?: string;
    is_macro_synthesis?: boolean;
    [key: string]: any;
  };
}

interface HierarchyNode {
  macroTask: TaskItem;
  macroArtifact: ArtifactItem | null;
  subItems: Array<{
    task: TaskItem;
    artifact: ArtifactItem | null;
  }>;
}

export default function ArtifactsPage() {
  const [copied, setCopied] = useState(false);
  const [copiedMaster, setCopiedMaster] = useState(false);
  const [viewMode, setViewMode] = useState<'hierarchy' | 'flat'>('hierarchy');
  const [artifacts, setArtifacts] = useState<ArtifactItem[]>([]);
  const [tasks, setTasks] = useState<TaskItem[]>([]);
  const [selectedArtifact, setSelectedArtifact] = useState<ArtifactItem | null>(null);
  const [selectedMacroNode, setSelectedMacroNode] = useState<HierarchyNode | null>(null);
  const [isViewingMasterReport, setIsViewingMasterReport] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedNodes, setExpandedNodes] = useState<Record<string, boolean>>({});

  const loadData = useCallback(async () => {
    try {
      const [artRes, taskRes] = await Promise.all([
        fetchArtifacts().catch(() => ({ artifacts: [] })),
        fetchTasks().catch(() => ({ tasks: [] }))
      ]);

      const artList: ArtifactItem[] = artRes?.artifacts || [];
      const taskList: TaskItem[] = taskRes?.tasks || [];

      setArtifacts(artList);
      setTasks(taskList);

      if (artList.length > 0 && !selectedArtifact && !isViewingMasterReport) {
        setSelectedArtifact(artList[0]);
      }
    } catch {
      // ignore
    }
  }, [selectedArtifact, isViewingMasterReport]);

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 5000);
    return () => clearInterval(interval);
  }, [loadData]);

  // Monta a estrutura em árvore hierárquica (Macro Task -> Subtasks & Artefatos)
  const hierarchyNodes: HierarchyNode[] = useMemo(() => {
    const parentTasks = tasks.filter((t) => !t.parent_task_id);

    return parentTasks.map((macro) => {
      // Localiza o artefato de síntese do AG-001 vinculado ao código macro
      const macroArtifact =
        artifacts.find(
          (a) =>
            a.metadata?.task_code === macro.task_code &&
            (a.metadata?.is_macro_synthesis || a.metadata?.created_by_agent === 'AG-001')
        ) ||
        artifacts.find((a) => a.metadata?.task_code === macro.task_code) ||
        null;

      // Subtarefas atribuídas aos agentes executores
      const subtasks = tasks.filter((s) => s.parent_task_id === macro.id);

      const subItems = subtasks.map((st) => {
        const subArt =
          artifacts.find((a) => a.metadata?.task_code === st.task_code) || null;
        return {
          task: st,
          artifact: subArt
        };
      });

      return {
        macroTask: macro,
        macroArtifact,
        subItems
      };
    });
  }, [tasks, artifacts]);

  // Se nada foi selecionado ainda, seleciona o primeiro nó macro
  useEffect(() => {
    if (hierarchyNodes.length > 0 && !selectedMacroNode) {
      setSelectedMacroNode(hierarchyNodes[0]);
      setExpandedNodes((prev) => ({
        ...prev,
        [hierarchyNodes[0].macroTask.task_code]: true
      }));
    }
  }, [hierarchyNodes, selectedMacroNode]);

  const toggleExpand = (taskCode: string) => {
    setExpandedNodes((prev) => ({
      ...prev,
      [taskCode]: !prev[taskCode]
    }));
  };

  const handleCopy = () => {
    if (!selectedArtifact) return;
    const text =
      selectedArtifact.content_markdown ||
      JSON.stringify(selectedArtifact.structured_data, null, 2);
    navigator.clipboard.writeText(text || '');
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Compila o Relatório Master Consolidado com todas as análises dos agentes autônomos
  const masterReport = useMemo(() => {
    if (!selectedMacroNode) return null;

    const { macroTask, macroArtifact, subItems } = selectedMacroNode;
    const macroCode = macroTask.task_code;
    const dateFormatted = new Date().toLocaleDateString('pt-BR');

    let md = `# RELATÓRIO MASTER ESTRATÉGICO & DOSSIÊ DECISÓRIO CONSOLIDADO\n`;
    md += `**EI-AIOS Autonomous Energy Operating System** | Resolução ANEEL REN 1.000/2021\n`;
    md += `**Código do Objetivo:** \`${macroCode}\` | **Data:** ${dateFormatted} | **Status:** Homologado QA Gate\n\n`;

    md += `---\n\n`;
    md += `## 🎯 1. Instrução Estratégica do Fundador para o AI Orchestrator (AG-001)\n\n`;
    md += `> **Diretriz Executiva:**\n`;
    md += `> *"${macroTask.objective}"*\n\n`;
    md += `- **Orquestrador Soberano:** AG-001 (CEO / AI Orchestrator)\n`;
    md += `- **Status do Objetivo:** ${macroTask.status.toUpperCase()}\n`;
    md += `- **Data de Criação:** ${macroTask.created_at ? new Date(macroTask.created_at).toLocaleString('pt-BR') : 'Recente'}\n\n`;

    if (macroArtifact?.content_markdown) {
      md += `### Síntese Executiva Global do AG-001\n\n`;
      md += `${macroArtifact.content_markdown}\n\n`;
    }

    md += `---\n\n`;
    md += `## 🤖 2. Decomposição Atômica & Análises Especializadas dos Agentes Autônomos\n\n`;
    md += `Abaixo constam as entregas técnicas, modelagens e laudos produzidos por cada agente especialista para embasar a decisão executiva:\n\n`;

    subItems.forEach((item, index) => {
      const { task, artifact } = item;
      const agentId = task.assigned_agent_id;
      const stepNum = index + 1;

      md += `### 2.${stepNum}. [${agentId}] ${task.objective} (Subtarefa: \`${task.task_code}\`)\n\n`;
      md += `- **Agente Responsável:** \`${agentId}\`\n`;
      md += `- **Status de Execução:** ${task.status.toUpperCase()} (Nível de Risco: ${task.risk_level ?? 1})\n`;

      if (task.qa_review_payload) {
        md += `- **Parecer QA (AG-008):** ${task.qa_review_payload.approved ? '✅ Aprovado' : '⚠️ Ressalvas'} (Score: ${task.qa_review_payload.score ?? 100}/100)\n`;
      }
      md += `\n`;

      if (artifact?.content_markdown) {
        // Sanitiza apresentações Marp ou fragmentos HTML brutos para o formato puro de relatório master executivo
        const cleanArtContent = artifact.content_markdown
          .replace(/^---\s*[\r\n]+marp:\s*true[\s\S]*?[\r\n]+---\s*[\r\n]+/gm, '')
          .replace(/<!--[\s\S]*?-->/g, '')
          .replace(/<span[^>]*>([\s\S]*?)<\/span>/gi, '**$1**')
          .replace(/<div[^>]*kpi-number[^>]*>([\s\S]*?)<\/div>/gi, '\n> ### 💎 $1\n')
          .replace(/<div[^>]*>([\s\S]*?)<\/div>/gi, '\n$1\n')
          .replace(/<[^>]+>/g, '')
          .trim();

        md += `#### Entregável / Laudo Técnico Gerado:\n\n`;
        md += `${cleanArtContent}\n\n`;
      } else if (task.result_payload) {
        md += `#### Dados Estruturados & Conclusão Técnica:\n\n`;
        if (task.result_payload.executive_summary_markdown) {
          md += `${task.result_payload.executive_summary_markdown}\n\n`;
        } else if (task.result_payload.summary) {
          md += `${task.result_payload.summary}\n\n`;
        } else {
          md += `\`\`\`json\n${JSON.stringify(task.result_payload, null, 2)}\n\`\`\`\n\n`;
        }
      }

      md += `---\n\n`;
    });

    md += `## 🏁 3. Matriz de Decisão Executiva para o Fundador\n\n`;
    md += `1. **Homologação:** Todas as análises acima foram validadas pelo motor determinístico do EI-AIOS e auditadas pelo **AG-008 (Quality & Risk Gate)**.\n`;
    md += `2. **Ação Recomendada:** Utilizar as conclusões consolidadas na Seção 1 (AG-001) e o detalhamento técnico da Seção 2 para validar o ICP ou acionar propostas comerciais.\n`;
    md += `3. **Governança:** Documento gerado sob rastreabilidade estrita da blockchain de auditoria e logs de execução dos agentes.\n\n`;

    return md;
  }, [selectedMacroNode]);

  const handleDownloadMasterReport = () => {
    if (!masterReport || !selectedMacroNode) return;
    const blob = new Blob([masterReport], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `RELATORIO_MASTER_${selectedMacroNode.macroTask.task_code}_CONSOLIDADO.md`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleCopyMasterReport = () => {
    if (!masterReport) return;
    navigator.clipboard.writeText(masterReport);
    setCopiedMaster(true);
    setTimeout(() => setCopiedMaster(false), 2000);
  };

  const filteredArtifacts = artifacts.filter((doc) => {
    const q = searchQuery.toLowerCase();
    const author = doc.metadata?.created_by_agent || 'EI-AIOS';
    return (
      (doc.title || '').toLowerCase().includes(q) ||
      (doc.artifact_type || '').toLowerCase().includes(q) ||
      author.toLowerCase().includes(q) ||
      (doc.metadata?.task_code || '').toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12 print:max-w-none print:p-0 print:m-0 print:space-y-0">
      {/* HEADER PRINCIPAL */}
      <div className="flex items-center justify-between flex-wrap gap-4 print:hidden">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <FileText className="w-6 h-6 text-indigo-400" />
            Repositório de Artefatos & Entregáveis Corporativos
          </h1>
          <p className="text-slate-400 text-sm mt-1">
            Galeria hierárquica de instruções estratégicas, deliberações de agentes e relatórios master consolidados.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* Alternador de Modo de Visualização */}
          <div className="bg-slate-900 border border-slate-800 p-0.5 rounded-lg flex items-center">
            <button
              onClick={() => {
                setViewMode('hierarchy');
                setIsViewingMasterReport(false);
              }}
              className={`px-3 py-1.5 rounded-md text-xs font-semibold flex items-center gap-1.5 transition ${
                viewMode === 'hierarchy'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <FolderTree className="w-3.5 h-3.5" />
              <span>Visão Hierárquica</span>
            </button>
            <button
              onClick={() => {
                setViewMode('flat');
                setIsViewingMasterReport(false);
              }}
              className={`px-3 py-1.5 rounded-md text-xs font-semibold flex items-center gap-1.5 transition ${
                viewMode === 'flat'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <List className="w-3.5 h-3.5" />
              <span>Lista Linear</span>
            </button>
          </div>

          {/* Botões de Ação para o Relatório Master ou Artefato Selecionado */}
          {selectedMacroNode && (
            <button
              onClick={() => {
                setIsViewingMasterReport(true);
                setSelectedArtifact(null);
              }}
              className={`border text-xs font-bold px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition ${
                isViewingMasterReport
                  ? 'bg-indigo-500/20 border-indigo-400 text-indigo-300'
                  : 'bg-slate-900 border-indigo-500/40 hover:border-indigo-400 text-indigo-300 hover:text-white'
              }`}
            >
              <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
              <span>Ver Relatório Master ({selectedMacroNode.macroTask.task_code})</span>
            </button>
          )}

          {isViewingMasterReport ? (
            <>
              <button
                onClick={handleCopyMasterReport}
                className="bg-slate-900 border border-slate-800 hover:border-slate-700 text-slate-200 px-3 py-1.5 rounded-lg text-xs flex items-center gap-1.5 transition"
              >
                {copiedMaster ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedMaster ? 'Copiado!' : 'Copiar Master'}</span>
              </button>
              <button
                onClick={() => window.print()}
                className="bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-bold px-3.5 py-1.5 rounded-lg text-xs flex items-center gap-1.5 transition shadow-md"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Exportar PDF Master</span>
              </button>
              <button
                onClick={handleDownloadMasterReport}
                className="bg-slate-900 border border-slate-800 hover:border-slate-700 text-slate-200 px-3 py-1.5 rounded-lg text-xs flex items-center gap-1.5 transition"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Baixar .md</span>
              </button>
            </>
          ) : (
            selectedArtifact && (
              <>
                <button
                  onClick={handleCopy}
                  className="bg-slate-900 border border-slate-800 hover:border-slate-700 text-slate-200 px-3 py-1.5 rounded-lg text-xs flex items-center gap-1.5 transition"
                >
                  {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copied ? 'Copiado!' : 'Copiar Documento'}</span>
                </button>
                <button
                  onClick={() => window.print()}
                  className="bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-bold px-3.5 py-1.5 rounded-lg text-xs flex items-center gap-1.5 transition shadow-md"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Exportar PDF</span>
                </button>
              </>
            )
          )}

          <button
            onClick={loadData}
            className="bg-slate-900 border border-slate-800 hover:border-slate-700 text-slate-300 px-3 py-1.5 rounded-lg text-xs flex items-center gap-1.5 transition"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Atualizar</span>
          </button>
        </div>
      </div>

      {artifacts.length === 0 ? (
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-12 text-center space-y-3">
          <Inbox className="w-10 h-10 text-slate-600 mx-auto" />
          <h3 className="text-base font-bold text-slate-200">Nenhum Artefato Gerado Ainda</h3>
          <p className="text-xs text-slate-400 max-w-md mx-auto">
            Envie uma instrução estratégica no Command Center (ex.: planejamento da plataforma, pesquisa de mercado ou auditoria energética) para que os agentes gerem entregáveis corporativos automaticamente.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* PAINEL LATERAL DE NAVEGAÇÃO */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-3 h-fit print:hidden">
            <div className="flex items-center gap-2 pb-2 border-b border-slate-800">
              <Search className="w-4 h-4 text-slate-500" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Buscar objetivo, agente ou laudo..."
                className="w-full bg-transparent text-xs text-white placeholder-slate-500 focus:outline-none"
              />
            </div>

            {/* MODO HIERÁRQUICO */}
            {viewMode === 'hierarchy' ? (
              <div className="space-y-3 max-h-[720px] overflow-y-auto pr-1">
                {hierarchyNodes.map((node) => {
                  const macro = node.macroTask;
                  const isExpanded = !!expandedNodes[macro.task_code];
                  const isSelectedMacro =
                    selectedMacroNode?.macroTask.task_code === macro.task_code;

                  return (
                    <div
                      key={macro.id}
                      className={`rounded-xl border transition overflow-hidden ${
                        isSelectedMacro
                          ? 'border-indigo-500/60 bg-slate-950/90 shadow-lg'
                          : 'border-slate-800 bg-slate-950/50 hover:border-slate-700'
                      }`}
                    >
                      {/* CARD DO OBJETIVO ESTRATÉGICO (AG-001) */}
                      <div className="p-3.5 space-y-2">
                        <div className="flex items-center justify-between">
                          <button
                            onClick={() => toggleExpand(macro.task_code)}
                            className="flex items-center gap-1.5 text-xs font-mono font-bold text-indigo-400 hover:text-indigo-300"
                          >
                            {isExpanded ? (
                              <ChevronDown className="w-4 h-4 text-indigo-400" />
                            ) : (
                              <ChevronRight className="w-4 h-4 text-slate-400" />
                            )}
                            <span>{macro.task_code}</span>
                          </button>

                          <div className="flex items-center gap-1.5">
                            <span className="text-[10px] bg-indigo-950/80 border border-indigo-500/30 text-indigo-300 px-2 py-0.5 rounded font-mono font-semibold">
                              AG-001 Orchestrator
                            </span>
                          </div>
                        </div>

                        {/* Objetivo da Instrução Estratégica */}
                        <div
                          onClick={() => {
                            setSelectedMacroNode(node);
                            if (node.macroArtifact) {
                              setSelectedArtifact(node.macroArtifact);
                              setIsViewingMasterReport(false);
                            } else {
                              setIsViewingMasterReport(true);
                            }
                          }}
                          className="cursor-pointer group"
                        >
                          <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                            Instrução Estratégica do Fundador:
                          </div>
                          <p className="text-xs font-medium text-slate-100 group-hover:text-indigo-300 line-clamp-2 mt-0.5">
                            {macro.objective}
                          </p>
                        </div>

                        {/* Botão para Acessar Síntese do AG-001 ou Relatório Master */}
                        <div className="pt-2 border-t border-slate-900 flex items-center justify-between gap-2">
                          {node.macroArtifact ? (
                            <button
                              onClick={() => {
                                setSelectedMacroNode(node);
                                setSelectedArtifact(node.macroArtifact);
                                setIsViewingMasterReport(false);
                              }}
                              className={`text-[11px] font-semibold flex items-center gap-1 px-2.5 py-1 rounded-md transition ${
                                selectedArtifact?.id === node.macroArtifact.id && !isViewingMasterReport
                                  ? 'bg-indigo-600 text-white'
                                  : 'text-indigo-300 bg-indigo-950/40 hover:bg-indigo-900/50'
                              }`}
                            >
                              <FileCheck2 className="w-3.5 h-3.5" />
                              <span>Síntese AG-001</span>
                            </button>
                          ) : (
                            <span className="text-[10px] text-slate-500 italic">
                              Síntese em processamento...
                            </span>
                          )}

                          <button
                            onClick={() => {
                              setSelectedMacroNode(node);
                              setIsViewingMasterReport(true);
                              setSelectedArtifact(null);
                            }}
                            className={`text-[11px] font-bold flex items-center gap-1 px-2.5 py-1 rounded-md transition ${
                              isViewingMasterReport && isSelectedMacro
                                ? 'bg-emerald-600 text-white'
                                : 'text-emerald-400 bg-emerald-950/40 hover:bg-emerald-900/50'
                            }`}
                          >
                            <Sparkles className="w-3.5 h-3.5" />
                            <span>Master Report</span>
                          </button>
                        </div>
                      </div>

                      {/* SUBITENS / AGENTES EXECUTORES HIERÁRQUICOS */}
                      {isExpanded && node.subItems.length > 0 && (
                        <div className="bg-slate-900/60 border-t border-slate-800 p-2.5 space-y-1.5 pl-4 border-l-2 border-l-indigo-500/80">
                          <div className="text-[10px] font-mono text-slate-400 flex items-center gap-1 pb-1">
                            <Layers className="w-3 h-3 text-indigo-400" />
                            <span>Respostas dos Agentes Especialistas ({node.subItems.length}):</span>
                          </div>

                          {node.subItems.map((sub) => {
                            const isSubArtSelected =
                              sub.artifact && selectedArtifact?.id === sub.artifact.id && !isViewingMasterReport;

                            return (
                              <div
                                key={sub.task.id}
                                onClick={() => {
                                  setSelectedMacroNode(node);
                                  if (sub.artifact) {
                                    setSelectedArtifact(sub.artifact);
                                    setIsViewingMasterReport(false);
                                  } else {
                                    // Se não gerou artefato individual mas tem resultado, exibe no Master Report
                                    setIsViewingMasterReport(true);
                                  }
                                }}
                                className={`p-2.5 rounded-lg border cursor-pointer transition space-y-1 ${
                                  isSubArtSelected
                                    ? 'bg-indigo-950/60 border-indigo-500 text-white shadow-sm'
                                    : 'bg-slate-950/70 border-slate-800/80 hover:border-slate-700 text-slate-300'
                                }`}
                              >
                                <div className="flex items-center justify-between">
                                  <span className="text-[10px] font-mono font-bold text-emerald-400">
                                    {sub.task.assigned_agent_id}
                                  </span>
                                  <span className="text-[10px] font-mono text-slate-500">
                                    {sub.task.task_code}
                                  </span>
                                </div>
                                <p className="text-[11px] font-medium line-clamp-2">
                                  {sub.artifact?.title || sub.task.objective}
                                </p>
                                <div className="flex items-center justify-between text-[10px] text-slate-500 pt-0.5">
                                  <span>{sub.artifact ? '📄 Artefato Pronto' : '⚡ Executado'}</span>
                                  {sub.task.status === 'completed' && (
                                    <span className="text-emerald-400 flex items-center gap-0.5">
                                      <CheckCircle2 className="w-3 h-3" /> Aprovado QA
                                    </span>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              /* MODO LISTA LINEAR */
              <div className="space-y-2 max-h-[720px] overflow-y-auto pr-1">
                {filteredArtifacts.map((doc) => {
                  const isSelected = selectedArtifact?.id === doc.id && !isViewingMasterReport;
                  const author = doc.metadata?.created_by_agent || 'AG-001';
                  return (
                    <div
                      key={doc.id}
                      onClick={() => {
                        setSelectedArtifact(doc);
                        setIsViewingMasterReport(false);
                      }}
                      className={`p-3.5 rounded-xl border cursor-pointer transition space-y-1.5 ${
                        isSelected
                          ? 'bg-indigo-950/30 border-indigo-500/50 shadow-md'
                          : 'bg-slate-950 border-slate-800 hover:border-slate-700'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-mono font-bold text-indigo-400 bg-indigo-950/60 border border-indigo-500/20 px-2 py-0.5 rounded uppercase">
                          {doc.artifact_type}
                        </span>
                        <span className="text-[10px] text-slate-500">
                          {doc.created_at ? new Date(doc.created_at).toLocaleDateString('pt-BR') : 'Hoje'}
                        </span>
                      </div>
                      <h3 className="text-xs font-bold text-slate-100 line-clamp-2 leading-snug">
                        {doc.title}
                      </h3>
                      <div className="flex items-center justify-between pt-1">
                        <span className="text-[10px] text-emerald-400 font-mono font-semibold">
                          Agente: {author}
                        </span>
                        {doc.metadata?.task_code && (
                          <span className="text-[10px] text-slate-500 font-mono">
                            {doc.metadata.task_code}
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* ÁREA PRINCIPAL: VISUALIZADOR CORPORATIVO OU MASTER REPORT */}
          <div className="lg:col-span-2 print:col-span-3 print:w-full print:block">
            {isViewingMasterReport && selectedMacroNode ? (
              /* RELATÓRIO MASTER CONSOLIDADO */
              <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-2xl print:bg-white print:border-none print:shadow-none">
                {/* CABEÇALHO DO MASTER REPORT */}
                <div className="bg-gradient-to-r from-indigo-950/80 via-slate-900 to-slate-900 border-b border-indigo-500/20 p-6 space-y-4 print:bg-white print:border-b-2 print:border-slate-900">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <span className="bg-indigo-500/20 border border-indigo-500/40 text-indigo-300 font-mono text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wider flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
                      Relatório Master Executivo • Consolidado Multiagente
                    </span>
                    <span className="text-xs font-mono text-slate-400">
                      Código Macro: <strong className="text-white">{selectedMacroNode.macroTask.task_code}</strong>
                    </span>
                  </div>

                  <div className="space-y-2">
                    <h2 className="text-xl font-bold text-white tracking-tight">
                      Dossiê Decisório & Análise de Mercado Consolidada
                    </h2>
                    <div className="bg-slate-950/80 border border-slate-800/80 rounded-lg p-3 space-y-1">
                      <div className="text-[11px] font-mono text-indigo-400 font-bold uppercase tracking-wider">
                        Instrução Estratégica para o AI Orchestrator (AG-001):
                      </div>
                      <p className="text-sm font-semibold text-slate-200 italic">
                        "{selectedMacroNode.macroTask.objective}"
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center justify-between flex-wrap gap-3 text-xs text-slate-400 pt-1">
                    <div className="flex items-center gap-4">
                      <span>Orquestrador: <strong className="text-indigo-300">AG-001 (CEO)</strong></span>
                      <span>Agentes Participantes: <strong className="text-emerald-400">{selectedMacroNode.subItems.length} especialistas</strong></span>
                    </div>
                    <div className="flex items-center gap-2 print:hidden">
                      <button
                        onClick={handleCopyMasterReport}
                        className="bg-slate-800 hover:bg-slate-700 text-slate-200 px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition"
                      >
                        {copiedMaster ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                        <span>{copiedMaster ? 'Copiado!' : 'Copiar Master (.md)'}</span>
                      </button>
                      <button
                        onClick={() => window.print()}
                        className="bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-bold px-3.5 py-1.5 rounded-lg text-xs flex items-center gap-1.5 transition shadow-md"
                      >
                        <Download className="w-3.5 h-3.5" />
                        <span>Exportar PDF Master</span>
                      </button>
                      <button
                        onClick={handleDownloadMasterReport}
                        className="bg-slate-800 hover:bg-slate-700 text-slate-200 px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition"
                      >
                        <Download className="w-3.5 h-3.5" />
                        <span>Baixar .md</span>
                      </button>
                    </div>
                  </div>
                </div>

                {/* CORPO DO MASTER REPORT COM O MARKDOWN CORPORATIVO COMPLETO */}
                <div className="p-6">
                  {masterReport && (
                    <ExecutiveDeliverableView
                      title={`Relatório Master Consolidado — ${selectedMacroNode.macroTask.task_code}`}
                      subtitle={`Consolidação de análises de mercado, viabilidade regulatória ANEEL e modelagem financeira`}
                      agentId="AG-001"
                      artifactType="strategic_plan"
                      taskCode={selectedMacroNode.macroTask.task_code}
                      createdAt={selectedMacroNode.macroTask.created_at}
                      version="Master 1.0"
                      markdownContent={masterReport}
                    />
                  )}
                </div>
              </div>
            ) : selectedArtifact ? (
              /* VISUALIZADOR DE ARTEFATO INDIVIDUAL */
              <ExecutiveDeliverableView
                title={selectedArtifact.title}
                subtitle={selectedArtifact.summary}
                agentId={selectedArtifact.metadata?.created_by_agent || 'AG-001'}
                artifactType={selectedArtifact.artifact_type}
                taskCode={selectedArtifact.metadata?.task_code}
                createdAt={selectedArtifact.created_at}
                version={selectedArtifact.version || '1.0'}
                markdownContent={selectedArtifact.content_markdown}
                structuredData={selectedArtifact.structured_data}
              />
            ) : (
              <div className="bg-slate-900 border border-slate-800 rounded-xl p-12 text-center text-slate-400">
                Selecione uma instrução estratégica ou entregável na barra lateral para visualizar.
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
