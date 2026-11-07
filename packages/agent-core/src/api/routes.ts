// ==============================================================================
// API ROUTES: CORE REST CONTRACT (EI-AIOS)
// ==============================================================================

import { Router, Request, Response, NextFunction } from 'express';
import multer from 'multer';
import {
  CreateObjectiveRequestSchema,
  DecideApprovalRequestSchema,
  WorkflowCode,
  TaskStatus,
  ApprovalStatus
} from '@ei-aios/shared';
import { supabase } from '../config/supabase.js';
import { geminiService } from '../config/gemini.js';
import { orchestrator } from '../engine/orchestrator.js';
import { autonomousWorker } from '../engine/worker.js';
import { workflowRunner } from '../engine/workflow-runner.js';
import { parseEnergyBill } from '../tools/bill-parser.js';
import { runEnergyAudit } from '../tools/energy-calculator.js';

export const apiRouter = Router();

// Configuração do Multer para upload de contas de energia em memória
const upload = multer({
  limits: { fileSize: 20 * 1024 * 1024 } // Máximo 20MB
});

// ------------------------------------------------------------------------------
// 0. HEALTH CHECK & STATUS DO WORKER
// ------------------------------------------------------------------------------
apiRouter.get('/health', (_req: Request, res: Response) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    worker: autonomousWorker.getStatus()
  });
});

apiRouter.get('/api/v1/worker/status', (_req: Request, res: Response) => {
  res.json(autonomousWorker.getStatus());
});

// ------------------------------------------------------------------------------
// 1. POST /api/v1/objectives (Decomposição com AG-001)
// ------------------------------------------------------------------------------
apiRouter.post('/api/v1/objectives', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const validated = CreateObjectiveRequestSchema.parse(req.body);

    const result = await orchestrator.decomposeObjective({
      objective: validated.objective,
      priority: validated.priority,
      clientId: validated.client_id,
      workflowCode: validated.workflow_code,
      createdBy: 'FOUNDER'
    });

    // Aciona ciclo imediato do worker em background para iniciar execução das subtarefas
    autonomousWorker.triggerCycle().catch(() => {});

    res.status(201).json({
      success: true,
      parentTaskId: result.parentTaskId,
      plan: result.plan
    });
  } catch (error) {
    next(error);
  }
});

// ------------------------------------------------------------------------------
// 2. POST /api/v1/energy/upload-bill (Upload, OCR, Cálculo e Início do WF-003)
// ------------------------------------------------------------------------------
apiRouter.post(
  '/api/v1/energy/upload-bill',
  upload.single('file'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const consumerUnitId = req.body.consumer_unit_id;
      const file = req.file;

      if (!consumerUnitId) {
        res.status(400).json({ error: 'consumer_unit_id é obrigatório' });
        return;
      }

      // 1. Busca dados da Unidade Consumidora no Supabase
      const { data: uc, error: ucError } = await supabase
        .from('consumer_units')
        .select('*, client:clients(*)')
        .eq('id', consumerUnitId)
        .single();

      if (ucError || !uc) {
        res.status(404).json({ error: 'Unidade Consumidora não encontrada' });
        return;
      }

      // 2. Extração Multimodal via Gemini / OCR
      const taskIdForOcr = `ocr-${Date.now()}`;
      const extractedData = await parseEnergyBill({
        taskId: taskIdForOcr,
        fileBuffer: file?.buffer,
        mimeType: file?.mimetype || 'application/pdf',
        consumerUnitHint: uc.uc_code
      });

      // 3. Execução da Calculadora Determinística (Sem LLM)
      const auditResult = runEnergyAudit({
        consumerUnitCode: extractedData.consumer_unit_code || uc.uc_code,
        billingPeriod: extractedData.billing_period,
        currentModality: extractedData.tariff_modality || uc.tariff_modality,
        contractedDemandKw: Number(extractedData.contracted_demand_peak_kw || uc.contracted_demand_peak_kw),
        measuredDemandPeakKw: Number(extractedData.measured_demand_peak_kw),
        measuredDemandOffpeakKw: Number(extractedData.measured_demand_offpeak_kw),
        consumptionPeakKwh: Number(extractedData.consumption_peak_kwh),
        consumptionOffpeakKwh: Number(extractedData.consumption_offpeak_kwh),
        billedReactiveExcessBrl: Number(extractedData.reactive_energy_fine_brl),
        billedReactiveExcessKwh: Number(extractedData.reactive_energy_excess_kwh)
      });

      // 4. Salva ou atualiza registro em energy_bills
      const { data: billRecord, error: billError } = await supabase
        .from('energy_bills')
        .upsert(
          {
            consumer_unit_id: consumerUnitId,
            billing_period: extractedData.billing_period,
            due_date: extractedData.due_date || null,
            total_amount_brl: extractedData.total_amount_brl,
            consumption_peak_kwh: extractedData.consumption_peak_kwh,
            consumption_offpeak_kwh: extractedData.consumption_offpeak_kwh,
            measured_demand_peak_kw: extractedData.measured_demand_peak_kw,
            measured_demand_offpeak_kw: extractedData.measured_demand_offpeak_kw,
            contracted_demand_peak_kw: extractedData.contracted_demand_peak_kw,
            contracted_demand_offpeak_kw: extractedData.contracted_demand_offpeak_kw,
            billed_demand_peak_kw: extractedData.billed_demand_peak_kw,
            billed_demand_offpeak_kw: extractedData.billed_demand_offpeak_kw,
            exceeded_demand_kw: auditResult.demand_analysis.overage_kw,
            exceeded_demand_fine_brl: auditResult.demand_analysis.overage_penalty_brl,
            reactive_energy_excess_kwh: extractedData.reactive_energy_excess_kwh,
            reactive_energy_fine_brl: extractedData.reactive_energy_fine_brl,
            tariff_flag: extractedData.tariff_flag,
            taxes_breakdown: extractedData.taxes_breakdown,
            raw_extracted_json: extractedData,
            deterministic_audit_json: auditResult,
            potential_savings_brl: auditResult.total_monthly_potential_savings_brl,
            validation_status: 'audited'
          },
          { onConflict: 'consumer_unit_id,billing_period' }
        )
        .select('id')
        .single();

      if (billError) {
        console.warn('[UploadBill] Error upserting bill to database:', billError);
      }

      // 5. Inicia o Workflow WF-003 no Background
      const workflowResult = await workflowRunner.triggerWorkflow({
        workflowCode: WorkflowCode.WF_003,
        clientId: uc.client_id,
        consumerUnitId: uc.id,
        customObjective: `Diagnóstico Energético da UC ${uc.uc_code} (${extractedData.billing_period})`,
        payload: {
          ...extractedData,
          bill_id: billRecord?.id,
          client_name: uc.client?.company_name || 'Cliente',
          contracted_demand_kw: uc.contracted_demand_peak_kw
        }
      });

      res.status(200).json({
        success: true,
        extractedData,
        auditResult,
        workflow: workflowResult
      });
    } catch (error) {
      next(error);
    }
  }
);

// ------------------------------------------------------------------------------
// 3. POST /api/v1/approvals/:id/decide (Decisão Humana Nível 2)
// ------------------------------------------------------------------------------
apiRouter.post('/api/v1/approvals/:id/decide', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const approvalId = req.params.id;
    const { decision, comments } = DecideApprovalRequestSchema.parse(req.body);

    const { data: approval, error: findError } = await supabase
      .from('approvals')
      .select('*, task:tasks(*)')
      .eq('id', approvalId)
      .single();

    if (findError || !approval) {
      res.status(404).json({ error: 'Registro de aprovação não encontrado' });
      return;
    }

    const now = new Date().toISOString();
    const taskId = approval.task_id;

    if (decision === 'approved') {
      // Atualiza aprovação
      await supabase
        .from('approvals')
        .update({
          approval_status: ApprovalStatus.APPROVED,
          comments: comments || 'Aprovado pelo fundador',
          decided_at: now
        })
        .eq('id', approvalId);

      // Marca a tarefa como 'completed', destravando dependentes no próximo poll
      await supabase
        .from('tasks')
        .update({
          status: TaskStatus.COMPLETED,
          completed_at: now
        })
        .eq('id', taskId);

      // Dispara ciclo do worker para processar tarefas destravadas imediatamente
      autonomousWorker.triggerCycle().catch(() => {});

      res.json({ success: true, status: 'approved', taskId });
    } else {
      // Rejeição: Volta para 'pending' com o feedback do fundador para refatoração
      await supabase
        .from('approvals')
        .update({
          approval_status: ApprovalStatus.REJECTED,
          comments: comments || 'Rejeitado pelo fundador para ajustes',
          decided_at: now
        })
        .eq('id', approvalId);

      await supabase
        .from('tasks')
        .update({
          status: TaskStatus.PENDING,
          retry_count: (approval.task?.retry_count || 0) + 1,
          input_payload: {
            ...(approval.task?.input_payload || {}),
            founder_rejection_feedback: comments
          }
        })
        .eq('id', taskId);

      res.json({ success: true, status: 'rejected_and_queued_for_rework', taskId });
    }
  } catch (error) {
    next(error);
  }
});

// ------------------------------------------------------------------------------
// 4. POST /api/v1/worker/trigger (Forçar Ciclo Imediato do Worker)
// ------------------------------------------------------------------------------
apiRouter.post('/api/v1/worker/trigger', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await autonomousWorker.triggerCycle();
    res.json({
      success: true,
      timestamp: new Date().toISOString(),
      ...result
    });
  } catch (error) {
    next(error);
  }
});

// ------------------------------------------------------------------------------
// 5. GET /api/v1/metrics/finops (Os 7 Indicadores Operacionais e FinOps)
// ------------------------------------------------------------------------------
apiRouter.get('/api/v1/metrics/finops', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    // 1. Total de tarefas e taxa de conclusão
    const { data: allTasks } = await supabase.from('tasks').select('id, status, retry_count');
    const totalTasks = allTasks?.length || 0;
    const completedTasks = allTasks?.filter(t => t.status === 'completed').length || 0;
    const completionRate = totalTasks > 0 ? (completedTasks / totalTasks) * 100 : 0;

    // 2. Taxa de retrabalho do QA (tarefas que tiveram retry_count > 0)
    const retriedTasks = allTasks?.filter(t => t.retry_count > 0).length || 0;
    const qaReworkRate = totalTasks > 0 ? (retriedTasks / totalTasks) * 100 : 0;

    // 3. Métricas de FinOps e Gastos de Tokens a partir de agent_runs
    const today = new Date().toISOString().split('T')[0];
    const { data: allRuns } = await supabase.from('agent_runs').select('*');
    
    const runsList = allRuns || [];
    const totalRunsCount = runsList.length;
    const totalSpendUsd = runsList.reduce((sum, r) => sum + Number(r.cost_estimate || 0), 0);
    const avgCostPerTask = totalRunsCount > 0 ? totalSpendUsd / totalRunsCount : 0;
    const avgExecutionTimeMs = totalRunsCount > 0
      ? runsList.reduce((sum, r) => sum + Number(r.execution_time_ms || 0), 0) / totalRunsCount
      : 0;

    const todaySpendUsd = runsList
      .filter(r => r.created_at?.startsWith(today))
      .reduce((sum, r) => sum + Number(r.cost_estimate || 0), 0);

    // 4. Taxa de aprovação humana
    const { data: approvals } = await supabase.from('approvals').select('approval_status');
    const totalApprovals = approvals?.length || 0;
    const approvedCount = approvals?.filter(a => a.approval_status === 'approved').length || 0;
    const approvalRate = totalApprovals > 0 ? (approvedCount / totalApprovals) * 100 : 100;

    // 5. Contagem de entregáveis (artefatos)
    const { count: artifactCount } = await supabase
      .from('artifacts')
      .select('*', { count: 'exact', head: true });

    const totalArtifacts = artifactCount || 1;
    const costPerArtifact = totalSpendUsd / totalArtifacts;

    res.json({
      completion_rate_percent: Math.round(completionRate * 10) / 10,
      qa_rework_rate_percent: Math.round(qaReworkRate * 10) / 10,
      avg_cost_per_task_usd: Math.round(avgCostPerTask * 1000000) / 1000000,
      avg_execution_time_ms: Math.round(avgExecutionTimeMs),
      approval_rate_percent: Math.round(approvalRate * 10) / 10,
      total_token_spend_usd_today: Math.round(todaySpendUsd * 10000) / 10000,
      total_token_spend_usd_month: Math.round(totalSpendUsd * 10000) / 10000,
      cost_per_artifact_usd: Math.round(costPerArtifact * 10000) / 10000,
      total_tasks_count: totalTasks,
      total_runs_count: totalRunsCount
    });
  } catch (error) {
    next(error);
  }
});

// ------------------------------------------------------------------------------
// 6. GET /api/v1/agents (Listar Catálogo dos 11 Agentes)
// ------------------------------------------------------------------------------
apiRouter.get('/api/v1/agents', async (_req: Request, res: Response) => {
  try {
    const result = await supabase
      .from('agents')
      .select('*')
      .order('id', { ascending: true });

    if (result.error && (result.error.message || Object.keys(result.error).length > 0 || (result.status && result.status >= 400))) {
      res.status(result.status || 500).json({
        success: false,
        error: result.error,
        status: result.status,
        statusText: result.statusText
      });
      return;
    }

    res.json({
      success: true,
      agents: result.data || [],
      count: result.data?.length || 0
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error?.message || String(error),
      stack: error?.stack
    });
  }
});

// ------------------------------------------------------------------------------
// 7. POST /api/v1/agents/:id/chat (Conversação Interativa Direta com o Agente)
// ------------------------------------------------------------------------------
apiRouter.post('/api/v1/agents/:id/chat', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const agentId = String(req.params.id);
    const { message, history } = req.body;

    if (!message || typeof message !== 'string') {
      res.status(400).json({ error: 'Campo message é obrigatório.' });
      return;
    }

    const agentQuery = await supabase
      .from('agents')
      .select('*')
      .eq('id', agentId)
      .maybeSingle();

    const agent = agentQuery.data;

    if (!agent) {
      res.status(404).json({ error: `Agente ${agentId} não encontrado.`, details: agentQuery });
      return;
    }

    const model = agent.configuration?.model || (agentId === 'AG-001' || agentId === 'AG-003' ? 'gemini-2.5-pro' : 'gemini-2.5-flash');

    const result = await geminiService.chatWithAgent({
      agentId,
      systemInstruction: agent.system_prompt,
      message,
      history,
      model
    });

    res.json({
      success: true,
      agentId,
      agentName: agent.name,
      reply: result.reply,
      tokensUsed: result.tokensUsed,
      costEstimateUsd: result.costEstimateUsd
    });
  } catch (error) {
    next(error);
  }
});

// ------------------------------------------------------------------------------
// 8. POST /api/v1/system/clean-database (Limpeza total para ambiente Zero KM)
// ------------------------------------------------------------------------------
apiRouter.post('/api/v1/system/clean-database', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    // Apaga dados transacionais e clientes piloto mantendo a estrutura dos 11 agentes e conhecimentos regulatórios
    await supabase.from('approvals').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    await supabase.from('artifacts').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    await supabase.from('tasks').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    await supabase.from('energy_bills').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    await supabase.from('consumer_units').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    await supabase.from('clients').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    await supabase.from('agent_runs').delete().neq('id', '00000000-0000-0000-0000-000000000000');

    res.json({
      success: true,
      message: 'Base limpa com sucesso. Todos os registros de clientes, UCs e tarefas foram zerados. Catálogo dos 11 agentes e normas ANEEL intactos.',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    next(error);
  }
});

// ------------------------------------------------------------------------------
// 9. GET /api/v1/system/debug (Diagnóstico de Conectividade com PostgREST e BD)
// ------------------------------------------------------------------------------
apiRouter.get('/api/v1/system/debug', async (_req: Request, res: Response) => {
  try {
    const rawRoot = await fetch('http://postgrest:3000/').then(r => r.json()).catch(e => ({ error: String(e) })) as any;
    const rawAgents = await fetch('http://postgrest:3000/agents').then(r => r.text()).catch(e => ({ error: String(e) }));
    const directSupabase = await supabase.from('agents').select('*');
    res.json({
      postgrestUrl: 'http://postgrest:3000',
      postgrestSchemaDefinitions: Object.keys(rawRoot?.definitions || {}),
      rawAgentsResponse: rawAgents,
      supabaseResult: {
        dataCount: directSupabase.data?.length ?? null,
        error: directSupabase.error,
        status: directSupabase.status,
        statusText: directSupabase.statusText
      }
    });
  } catch (err: any) {
    res.status(500).json({ error: String(err), stack: err?.stack });
  }
});

// ------------------------------------------------------------------------------
// 10. GET /api/v1/tasks (Listagem de Tarefas para o Cockpit e Kanban)
// ------------------------------------------------------------------------------
apiRouter.get('/api/v1/tasks', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const { data, error } = await supabase
      .from('tasks')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(50);

    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }

    res.json({
      success: true,
      tasks: data || [],
      count: data?.length || 0
    });
  } catch (err) {
    next(err);
  }
});

// ------------------------------------------------------------------------------
// 11. GET /api/v1/approvals (Listagem de Aprovações Nível 2 Pendentes e Histórico)
// ------------------------------------------------------------------------------
apiRouter.get('/api/v1/approvals', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const { data, error } = await supabase
      .from('approvals')
      .select('*, task:tasks(*)')
      .order('created_at', { ascending: false })
      .limit(30);

    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }

    res.json({
      success: true,
      approvals: data || [],
      count: data?.length || 0
    });
  } catch (err) {
    next(err);
  }
});

// ------------------------------------------------------------------------------
// 12. GET /api/v1/artifacts (Listagem de Artefatos e Relatórios Gerados)
// ------------------------------------------------------------------------------
apiRouter.get('/api/v1/artifacts', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const { data, error } = await supabase
      .from('artifacts')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(30);

    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }

    res.json({
      success: true,
      artifacts: data || [],
      count: data?.length || 0
    });
  } catch (err) {
    next(err);
  }
});

