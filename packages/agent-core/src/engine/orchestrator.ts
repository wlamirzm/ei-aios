// ==============================================================================
// ORCHESTRATOR: AG-001 CEO / MASTER PLANNER & SYNTHESIZER (BKL-001 & BKL-005)
// ==============================================================================

import {
  AgentId,
  OrchestratorPlan,
  OrchestratorPlanSchema,
  PriorityLevel,
  ActionRiskLevel,
  WorkflowCode
} from '@ei-aios/shared';
import { geminiService } from '../config/gemini.js';
import { supabase } from '../config/supabase.js';
import { getAgentDefinition } from '../agents/registry.js';
import { agentRouter } from './agent-router.js';
import { createAndSaveArtifact } from '../tools/artifact-writer.js';

export interface ObjectiveDecompositionInput {
  objective: string;
  priority?: PriorityLevel;
  clientId?: string;
  workflowCode?: WorkflowCode;
  createdBy?: string;
}

export class Orchestrator {
  /**
   * Decompõe um objetivo macro enviado pelo fundador em subtarefas atômicas no Supabase,
   * validando disponibilidade e permissões de cada agente via AgentRouter.
   */
  async decomposeObjective(input: ObjectiveDecompositionInput): Promise<{ parentTaskId: string; plan: OrchestratorPlan }> {
    const ag001Def = await getAgentDefinition(AgentId.AG_001);
    const catalogSummary = agentRouter.getActiveCatalogPromptSummary();

    const prompt = `OBJETIVO MACRO DO FUNDADOR:
"${input.objective}"
Workflow sugerido: ${input.workflowCode || 'Não especificado (detectar automaticamente)'}
Cliente ID: ${input.clientId || 'Nenhum'}

Sua missão como AG-001 (AI Orchestrator):
1. Analise o objetivo e decomponha em 2 a 4 subtarefas atômicas, com dependências claras entre elas.
2. Atribua cada tarefa EXCLUSIVAMENTE a um destes IDs de agente ativos no AgentRegistry:
   ${catalogSummary}
3. Para tarefas com envio externo, impacto financeiro ou proposta comercial, defina requires_approval = true e risk_level = "LEVEL_2_APPROVAL_REQUIRED".
4. Retorne EXCLUSIVAMENTE um JSON válido com estas chaves exatas:
{
  "macro_objective": "string",
  "reasoning_summary": "string",
  "estimated_complexity": "low" | "medium" | "high",
  "requires_human_gate": true,
  "decomposed_tasks": [
    {
      "task_code": "SUBTASK-001",
      "assigned_agent_id": "AG-002",
      "objective": "string (mínimo 10 caracteres)",
      "task_type": "string",
      "priority": "P0" | "P1" | "P2" | "P3",
      "risk_level": "LEVEL_0_AUTO" | "LEVEL_1_SUPERVISED" | "LEVEL_2_APPROVAL_REQUIRED",
      "dependencies_task_codes": [],
      "input_payload": {},
      "requires_approval": false,
      "approval_reason": "string opcional"
    }
  ]
}`;

    const result = await geminiService.generateStructuredContent<OrchestratorPlan>({
      taskId: 'planning-' + Date.now(),
      agentId: AgentId.AG_001,
      model: ag001Def.model,
      systemInstruction: ag001Def.systemPrompt,
      prompt,
      temperature: 0.2
    });

    const parsedPlan = OrchestratorPlanSchema.safeParse(result.data);
    const plan: OrchestratorPlan = parsedPlan.success
      ? parsedPlan.data
      : OrchestratorPlanSchema.parse(geminiService.getFallbackDecompositionPlan(input.objective));

    // 1. Cria a Tarefa-Mãe (Macro Objective)
    const taskCodeRoot = `MACRO-${Date.now().toString().slice(-6)}`;
    const { data: parentTask, error: parentError } = await supabase
      .from('tasks')
      .insert({
        task_code: taskCodeRoot,
        workflow_code: input.workflowCode || plan.workflow_code || null,
        client_id: input.clientId || null,
        created_by: input.createdBy || 'FOUNDER',
        assigned_agent_id: AgentId.AG_001,
        objective: input.objective,
        task_type: 'macro_objective',
        priority: input.priority || PriorityLevel.P1,
        status: 'running',
        risk_level: plan.requires_human_gate ? ActionRiskLevel.LEVEL_2_APPROVAL_REQUIRED : ActionRiskLevel.LEVEL_0_AUTO,
        input_payload: { raw_objective: input.objective, plan_summary: plan.reasoning_summary },
        result_payload: plan
      })
      .select('id')
      .single();

    if (parentError || !parentTask) {
      console.error('[Orchestrator] Error creating parent task:', parentError);
      throw new Error('Falha ao persistir tarefa macro no Supabase');
    }

    const parentTaskId = parentTask.id;

    // 2. Cria as Subtarefas no banco validando via AgentRouter e mapeando as dependências
    const taskCodeToIdMap: Record<string, string> = {};

    for (let i = 0; i < plan.decomposed_tasks.length; i++) {
      const subtask = plan.decomposed_tasks[i]!;
      const subtaskCode = `${taskCodeRoot}-${(i + 1).toString().padStart(2, '0')}`;

      // Validação determinística via AgentRouter (BKL-005)
      const routeCheck = await agentRouter.validateAndRouteAgent({
        requestedAgentId: subtask.assigned_agent_id,
        taskType: subtask.task_type,
        objective: subtask.objective
      });

      const dependencyIds: string[] = [];
      for (const depCode of subtask.dependencies_task_codes) {
        if (taskCodeToIdMap[depCode]) {
          dependencyIds.push(taskCodeToIdMap[depCode]);
        }
      }

      const effectiveRequiresApproval = Boolean(subtask.requires_approval || routeCheck.requiresHumanApproval);
      const effectiveRiskLevel = effectiveRequiresApproval
        ? ActionRiskLevel.LEVEL_2_APPROVAL_REQUIRED
        : subtask.risk_level;

      const { data: createdSubtask, error: subError } = await supabase
        .from('tasks')
        .insert({
          task_code: subtaskCode,
          workflow_code: input.workflowCode || plan.workflow_code || null,
          parent_task_id: parentTaskId,
          client_id: input.clientId || null,
          created_by: AgentId.AG_001,
          assigned_agent_id: routeCheck.effectiveAgentId,
          objective: subtask.objective,
          task_type: subtask.task_type,
          priority: subtask.priority,
          status: 'pending',
          risk_level: effectiveRiskLevel,
          dependencies: dependencyIds,
          input_payload: {
            ...(subtask.input_payload || {}),
            router_validation: routeCheck.reason
          },
          requires_approval: effectiveRequiresApproval,
          approval_reason:
            subtask.approval_reason ||
            (effectiveRequiresApproval ? routeCheck.reason : null)
        })
        .select('id')
        .single();

      if (!subError && createdSubtask) {
        taskCodeToIdMap[subtask.task_code] = createdSubtask.id;
      }
    }

    // BKL-016: Registro auditável em decision_logs (Seção 5.2 do Documento de Validação)
    try {
      await supabase.from('decision_logs').insert({
        parent_task_id: parentTaskId,
        agent_id: AgentId.AG_001,
        decision_type: 'decomposition_plan',
        decision_summary: `Decomposição do objetivo macro "${input.objective}" em ${plan.decomposed_tasks.length} subtarefas atômicas.`,
        rationales: [plan.reasoning_summary],
        alternatives_considered: [
          'Execução sequencial monolítica',
          'Delegação direta sem subtarefas decompostas'
        ],
        risk_assessment: {
          estimated_complexity: plan.estimated_complexity,
          requires_human_gate: plan.requires_human_gate
        },
        metadata: {
          workflow_code: input.workflowCode || plan.workflow_code || null,
          client_id: input.clientId || null
        }
      });
    } catch {
      // Ignora erro caso tabela ainda não exista
    }

    return {
      parentTaskId,
      plan
    };
  }

  /**
   * Consolida os resultados das subtarefas e gera o relatório executivo final + artefato (Idempotente).
   */
  async synthesizeCompletedObjective(parentTaskId: string): Promise<Record<string, any>> {
    const { data: parentTask } = await supabase
      .from('tasks')
      .select('*')
      .eq('id', parentTaskId)
      .maybeSingle();

    if (!parentTask) {
      return {};
    }

    // Idempotência: se já foi sintetizado e concluído, retorna o resultado existente
    if (parentTask.status === 'completed' && parentTask.result_payload?.executive_summary_markdown) {
      return parentTask.result_payload;
    }

    const { data: subtasks } = await supabase
      .from('tasks')
      .select('task_code, assigned_agent_id, objective, status, result_payload, qa_review_payload')
      .eq('parent_task_id', parentTaskId);

    const ag001Def = await getAgentDefinition(AgentId.AG_001);

    const prompt = `CONSOLIDAÇÃO EXECUTIVA DE OBJETIVO MACRO (AG-001):
Objetivo Original do Fundador: "${parentTask.objective}" (${parentTask.task_code})
Todas as subtarefas foram concluídas e auditadas:
${JSON.stringify(subtasks, null, 2)}

Elabore a Síntese Executiva Consolidada do AG-001 retornando um objeto JSON válido contendo:
- "deliverable_title": título executivo consolidado
- "executive_summary_markdown": documento corporativo completo em Markdown com seções "## 1. Visão Geral & Resultados Consolidados", "## 2. Entregas por Agente Especialista" (em tabela Markdown), "## 3. Riscos & Mitigações" e "## 4. Próximos Passos Executivos"
- "recommended_actions": lista de próximos passos prioritários
- "assumptions": premissas consolidadas
- "limitations": ressalvas técnicas e regulatórias`;

    const synthesis = await geminiService.generateStructuredContent({
      taskId: parentTaskId,
      agentId: AgentId.AG_001,
      model: ag001Def.model,
      systemInstruction: ag001Def.systemPrompt,
      prompt,
      temperature: 0.2
    });

    const synthesisData = {
      ...(synthesis.data || {}),
      deliverable_title:
        synthesis.data?.deliverable_title ||
        `Síntese Executiva Consolidada — ${parentTask.objective.slice(0, 70)}`,
      synthesized_by: AgentId.AG_001,
      subtasks_count: subtasks?.length || 0,
      synthesized_at: new Date().toISOString()
    };

    await supabase
      .from('tasks')
      .update({
        status: 'completed',
        completed_at: new Date().toISOString(),
        result_payload: synthesisData
      })
      .eq('id', parentTaskId);

    const mdBody =
      synthesisData.executive_summary_markdown ||
      `# ${synthesisData.deliverable_title}\n\n## 1. Sumário Executivo\nTodas as ${subtasks?.length || 0} subtarefas do objetivo **${parentTask.task_code}** foram concluídas e consolidadas pelo AG-001.`;

    await createAndSaveArtifact({
      taskId: parentTaskId,
      clientId: parentTask.client_id || null,
      artifactType: 'strategic_plan',
      title: `${synthesisData.deliverable_title} (${parentTask.task_code})`,
      summary: `Consolidação executiva final do AG-001 unificando ${subtasks?.length || 0} entregas especialistas.`,
      contentMarkdown: mdBody,
      structuredData: synthesisData,
      metadata: {
        created_by_agent: AgentId.AG_001,
        task_code: parentTask.task_code,
        is_macro_synthesis: true
      }
    }).catch(() => {});

    // BKL-016: Registro auditável em decision_logs da consolidação final
    try {
      await supabase.from('decision_logs').insert({
        parent_task_id: parentTaskId,
        agent_id: AgentId.AG_001,
        decision_type: 'synthesis_consolidation',
        decision_summary: `Consolidação executiva final do objetivo macro "${parentTask.objective}" concluída com êxito pelo AG-001.`,
        rationales: [
          `Todas as ${subtasks?.length || 0} subtarefas foram executadas e auditadas com sucesso.`,
          synthesisData.deliverable_title
        ],
        alternatives_considered: [],
        risk_assessment: {
          subtasks_count: subtasks?.length || 0,
          status: 'completed'
        },
        metadata: {
          task_code: parentTask.task_code,
          completed_at: new Date().toISOString()
        }
      });
    } catch {
      // Ignora erro caso tabela ainda não exista
    }

    return synthesisData;
  }
}

export const orchestrator = new Orchestrator();
