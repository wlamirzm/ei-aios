// ==============================================================================
// ORCHESTRATOR: AG-001 CEO / MASTER PLANNER & SYNTHESIZER
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

export interface ObjectiveDecompositionInput {
  objective: string;
  priority?: PriorityLevel;
  clientId?: string;
  workflowCode?: WorkflowCode;
  createdBy?: string;
}

export class Orchestrator {
  /**
   * Decompõe um objetivo macro enviado pelo fundador em subtarefas atômicas no Supabase.
   */
  async decomposeObjective(input: ObjectiveDecompositionInput): Promise<{ parentTaskId: string; plan: OrchestratorPlan }> {
    const ag001Def = await getAgentDefinition(AgentId.AG_001);

    const prompt = `OBJETIVO MACRO DO FUNDADOR:
"${input.objective}"
Workflow sugerido: ${input.workflowCode || 'Não especificado (detectar automaticamente)'}
Cliente ID: ${input.clientId || 'Nenhum'}

Sua missão como AG-001 (AI Orchestrator):
1. Analise o objetivo e decomponha em 2 a 4 subtarefas atômicas, com dependências claras entre elas.
2. Atribua cada tarefa EXCLUSIVAMENTE a um destes IDs de agente:
   - "AG-002": Estratégia de Mercado, ICP e Concorrentes
   - "AG-003": Engenharia Energética e Diagnóstico de Faturas
   - "AG-004": Engenharia de Dados e OCR
   - "AG-005": Desenvolvimento de Software e Migrations
   - "AG-006": Marketing, Conteúdo e Copy B2B
   - "AG-007": Vendas, Propostas Comerciais e LOI
   - "AG-008": Auditoria de Qualidade e Conformidade
   - "AG-009": Regulação ANEEL e Dossiês de Contestação
   - "AG-010": Medição & Verificação (M&V) e Retenção
   - "AG-011": CFO Digital e Precificação
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

    // 2. Cria as Subtarefas no banco mapeando as dependências
    const taskCodeToIdMap: Record<string, string> = {};

    for (let i = 0; i < plan.decomposed_tasks.length; i++) {
      const subtask = plan.decomposed_tasks[i]!;
      const subtaskCode = `${taskCodeRoot}-${(i + 1).toString().padStart(2, '0')}`;

      // Mapeia dependências por código anterior
      const dependencyIds: string[] = [];
      for (const depCode of subtask.dependencies_task_codes) {
        if (taskCodeToIdMap[depCode]) {
          dependencyIds.push(taskCodeToIdMap[depCode]);
        }
      }

      const { data: createdSubtask, error: subError } = await supabase
        .from('tasks')
        .insert({
          task_code: subtaskCode,
          workflow_code: input.workflowCode || plan.workflow_code || null,
          parent_task_id: parentTaskId,
          client_id: input.clientId || null,
          created_by: AgentId.AG_001,
          assigned_agent_id: subtask.assigned_agent_id,
          objective: subtask.objective,
          task_type: subtask.task_type,
          priority: subtask.priority,
          status: 'pending',
          risk_level: subtask.risk_level,
          dependencies: dependencyIds,
          input_payload: subtask.input_payload || {},
          requires_approval: subtask.requires_approval,
          approval_reason: subtask.approval_reason || null
        })
        .select('id')
        .single();

      if (!subError && createdSubtask) {
        taskCodeToIdMap[subtask.task_code] = createdSubtask.id;
      }
    }

    return {
      parentTaskId,
      plan
    };
  }

  /**
   * Consolida os resultados das subtarefas e gera o relatório executivo final.
   */
  async synthesizeCompletedObjective(parentTaskId: string): Promise<Record<string, any>> {
    const { data: subtasks } = await supabase
      .from('tasks')
      .select('*')
      .eq('parent_task_id', parentTaskId);

    const ag001Def = await getAgentDefinition(AgentId.AG_001);

    const prompt = `CONSOLIDAÇÃO EXECUTIVA DE OBJETIVO (AG-001):
Todas as subtarefas do objetivo macro foram concluídas.
Subtarefas executadas:
${JSON.stringify(subtasks, null, 2)}

Consolide um resumo executivo com:
1. Resumo dos principais resultados e números apurados.
2. Riscos identificados e medidas mitigatórias.
3. Próximos passos recomendados ao fundador.`;

    const synthesis = await geminiService.generateStructuredContent({
      taskId: parentTaskId,
      agentId: AgentId.AG_001,
      model: ag001Def.model,
      systemInstruction: ag001Def.systemPrompt,
      prompt,
      temperature: 0.2
    });

    await supabase
      .from('tasks')
      .update({
        status: 'completed',
        completed_at: new Date().toISOString(),
        result_payload: synthesis.data
      })
      .eq('id', parentTaskId);

    return synthesis.data;
  }
}

export const orchestrator = new Orchestrator();

