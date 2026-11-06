// ==============================================================================
// WORKFLOW RUNNER: CATALOG OF THE 8 AUTOMATED WORKFLOWS (WF-001 TO WF-008)
// ==============================================================================

import { WorkflowCode, PriorityLevel, ActionRiskLevel, AgentId } from '@ei-aios/shared';
import { supabase } from '../config/supabase.js';

export interface StartWorkflowOptions {
  workflowCode: WorkflowCode;
  clientId?: string;
  consumerUnitId?: string;
  customObjective?: string;
  payload?: Record<string, any>;
}

export class WorkflowRunner {
  /**
   * Inicia um dos 8 workflows predefinidos criando as tarefas sequenciais com dependências.
   */
  async triggerWorkflow(options: StartWorkflowOptions): Promise<{ parentTaskId: string; taskCount: number }> {
    const parentCode = `${options.workflowCode}-${Date.now().toString().slice(-6)}`;
    
    // Cria tarefa-mãe do workflow
    const { data: parentTask, error: parentError } = await supabase
      .from('tasks')
      .insert({
        task_code: parentCode,
        workflow_code: options.workflowCode,
        client_id: options.clientId || null,
        created_by: 'WORKFLOW_RUNNER',
        assigned_agent_id: AgentId.AG_001,
        objective: options.customObjective || `Execução automatizada do fluxo ${options.workflowCode}`,
        task_type: 'workflow_pipeline',
        priority: PriorityLevel.P1,
        status: 'running',
        risk_level: ActionRiskLevel.LEVEL_0_AUTO,
        input_payload: options.payload || {}
      })
      .select('id')
      .single();

    if (parentError || !parentTask) {
      throw new Error(`Falha ao iniciar workflow ${options.workflowCode}: ${parentError?.message}`);
    }

    const parentTaskId = parentTask.id;
    let taskCount = 0;

    switch (options.workflowCode) {
      case WorkflowCode.WF_003: {
        // WF-003: Diagnóstico Energético Automatizado (Core Product)
        // 1. Extração OCR (AG-004) -> 2. Diagnóstico & energy-calculator (AG-003) -> 3. Auditoria QA (AG-008) -> Aprovação Nível 2
        const t1 = await this.createSubtask({
          parentTaskId,
          taskCode: `${parentCode}-01`,
          assignedAgent: AgentId.AG_004,
          objective: 'Validar dados extraídos da fatura e checar consistência de grandezas elétricas.',
          taskType: 'bill_data_validation',
          riskLevel: ActionRiskLevel.LEVEL_0_AUTO,
          inputPayload: options.payload || {},
          dependencies: []
        });

        await this.createSubtask({
          parentTaskId,
          taskCode: `${parentCode}-02`,
          assignedAgent: AgentId.AG_003,
          objective: 'Processar cálculo determinístico tarifário e elaborar laudo técnico de eficiência energética.',
          taskType: 'energy_diagnosis',
          riskLevel: ActionRiskLevel.LEVEL_2_APPROVAL_REQUIRED,
          requiresApproval: true,
          approvalReason: 'Laudo de diagnóstico técnico de energia para cliente',
          inputPayload: options.payload || {},
          dependencies: [t1]
        });
        taskCount = 2;
        break;
      }

      case WorkflowCode.WF_008: {
        // WF-008: Fechamento Mensal de Economia Verificada (M&V e Cobrança)
        const t1 = await this.createSubtask({
          parentTaskId,
          taskCode: `${parentCode}-01`,
          assignedAgent: AgentId.AG_010,
          objective: 'Executar medição e verificação (M&V determinístico) comparando fatura atual com baseline.',
          taskType: 'mv_calculation',
          riskLevel: ActionRiskLevel.LEVEL_0_AUTO,
          inputPayload: options.payload || {},
          dependencies: []
        });

        await this.createSubtask({
          parentTaskId,
          taskCode: `${parentCode}-02`,
          assignedAgent: AgentId.AG_011,
          objective: 'Calcular apuração de Success Fee e mensalidade SaaS devidos pelo cliente.',
          taskType: 'success_fee_billing',
          riskLevel: ActionRiskLevel.LEVEL_2_APPROVAL_REQUIRED,
          requiresApproval: true,
          approvalReason: 'Faturamento de honorários de sucesso (Success Fee)',
          inputPayload: options.payload || {},
          dependencies: [t1]
        });
        taskCount = 2;
        break;
      }

      case WorkflowCode.WF_007: {
        // WF-007: Dossiê de Contestação e Restituição Tarifária (REN 1.000/2021)
        await this.createSubtask({
          parentTaskId,
          taskCode: `${parentCode}-01`,
          assignedAgent: AgentId.AG_009,
          objective: 'Fundamentar cobrança indevida com base nos artigos da REN 1.000/2021 ANEEL e calcular restituição em dobro.',
          taskType: 'aneel_contest_dossier',
          riskLevel: ActionRiskLevel.LEVEL_2_APPROVAL_REQUIRED,
          requiresApproval: true,
          approvalReason: 'Envio de petição administrativa formal para distribuidora',
          inputPayload: options.payload || {},
          dependencies: []
        });
        taskCount = 1;
        break;
      }

      default: {
        // Workflows genéricos ou estratégicos delegados ao AG-001
        await this.createSubtask({
          parentTaskId,
          taskCode: `${parentCode}-01`,
          assignedAgent: AgentId.AG_002,
          objective: `Análise estratégica para o fluxo ${options.workflowCode}.`,
          taskType: 'strategy_analysis',
          riskLevel: ActionRiskLevel.LEVEL_0_AUTO,
          inputPayload: options.payload || {},
          dependencies: []
        });
        taskCount = 1;
        break;
      }
    }

    return {
      parentTaskId,
      taskCount
    };
  }

  private async createSubtask(params: {
    parentTaskId: string;
    taskCode: string;
    assignedAgent: AgentId;
    objective: string;
    taskType: string;
    riskLevel: ActionRiskLevel;
    requiresApproval?: boolean;
    approvalReason?: string;
    inputPayload: Record<string, any>;
    dependencies: string[];
  }): Promise<string> {
    const { data, error } = await supabase
      .from('tasks')
      .insert({
        task_code: params.taskCode,
        parent_task_id: params.parentTaskId,
        created_by: 'WORKFLOW_RUNNER',
        assigned_agent_id: params.assignedAgent,
        objective: params.objective,
        task_type: params.taskType,
        priority: PriorityLevel.P1,
        status: 'pending',
        risk_level: params.riskLevel,
        requires_approval: params.requiresApproval || false,
        approval_reason: params.approvalReason || null,
        input_payload: params.inputPayload,
        dependencies: params.dependencies
      })
      .select('id')
      .single();

    if (error || !data) {
      throw new Error(`Erro ao criar subtarefa ${params.taskCode}: ${error?.message}`);
    }

    return data.id;
  }
}

export const workflowRunner = new WorkflowRunner();

