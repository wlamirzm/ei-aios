// ==============================================================================
// AUTONOMOUS BACKGROUND WORKER: CONTINUOUS POLLING & EXECUTION LOOP
// ==============================================================================

import { TaskModel, TaskStatus } from '@ei-aios/shared';
import { env } from '../config/env.js';
import { supabase } from '../config/supabase.js';
import { policyEngine } from './policy-engine.js';
import { qaGate } from './qa-gate.js';
import { executeAgentTask } from '../agents/executors.js';
import { orchestrator } from './orchestrator.js';

export class AutonomousWorker {
  private isRunning: boolean = false;
  private isProcessingCycle: boolean = false;
  private intervalHandle: NodeJS.Timeout | null = null;

  start(): void {
    if (this.isRunning) return;
    this.isRunning = true;
    console.log(`[AutonomousWorker] Started continuous loop (interval: ${env.WORKER_POLL_INTERVAL_MS}ms)`);

    this.intervalHandle = setInterval(() => {
      this.pollAndExecute().catch(err => {
        console.error('[AutonomousWorker] Unhandled error during poll cycle:', err);
      });
    }, env.WORKER_POLL_INTERVAL_MS);

    // Executa imediatamente o primeiro ciclo
    this.pollAndExecute().catch(() => { });
  }

  stop(): void {
    if (this.intervalHandle) {
      clearInterval(this.intervalHandle);
      this.intervalHandle = null;
    }
    this.isRunning = false;
    console.log('[AutonomousWorker] Stopped.');
  }

  getStatus(): { isRunning: boolean; isProcessingCycle: boolean; pollIntervalMs: number } {
    return {
      isRunning: this.isRunning,
      isProcessingCycle: this.isProcessingCycle,
      pollIntervalMs: env.WORKER_POLL_INTERVAL_MS
    };
  }

  /**
   * Força a execução de um ciclo imediato (disparado pelo endpoint REST).
   */
  async triggerCycle(): Promise<{ processedCount: number }> {
    return await this.pollAndExecute();
  }

  /**
   * Ciclo principal: busca tarefas elegíveis, executa, roda QA Gate e decide destino.
   */
  private async pollAndExecute(): Promise<{ processedCount: number }> {
    if (this.isProcessingCycle) {
      return { processedCount: 0 };
    }

    this.isProcessingCycle = true;
    let processedCount = 0;

    try {
      // 1. Busca tarefas com status = 'pending'
      const { data: pendingTasks, error } = await supabase
        .from('tasks')
        .select('*')
        .eq('status', TaskStatus.PENDING)
        .order('priority', { ascending: true })
        .order('created_at', { ascending: true })
        .limit(5);

      if (error || !pendingTasks || pendingTasks.length === 0) {
        return { processedCount: 0 };
      }

      for (const rawTask of pendingTasks) {
        const task = rawTask as TaskModel;

        // 2. Verifica se todas as dependências estão 'completed'
        const canExecute = await this.areDependenciesSatisfied(task.dependencies);
        if (!canExecute) {
          continue;
        }

        // 3. Checa Policy Engine (Teto de gastos diário)
        const policyCheck = await policyEngine.evaluatePreExecution(task.assigned_agent_id, task.risk_level);
        if (!policyCheck.allowed) {
          console.warn(`[AutonomousWorker] Task ${task.task_code} blocked by policy: ${policyCheck.rejectionReason}`);
          continue;
        }

        // 4. Marca status = 'running'
        await supabase
          .from('tasks')
          .update({
            status: TaskStatus.RUNNING,
            started_at: new Date().toISOString()
          })
          .eq('id', task.id);

        processedCount++;
        await this.processSingleTask(task);
      }
    } catch (cycleErr) {
      console.error('[AutonomousWorker] Error in pollAndExecute:', cycleErr);
    } finally {
      this.isProcessingCycle = false;
    }

    return { processedCount };
  }

  /**
   * Processa uma única tarefa de ponta a ponta.
   */
  private async processSingleTask(task: TaskModel): Promise<void> {
    console.log(`[AutonomousWorker] Processing task ${task.task_code} (${task.assigned_agent_id})`);

    try {
      // 1. Executa o Agente (com ferramentas determinísticas se aplicável)
      const execution = await executeAgentTask(task);

      // 2. Coloca em 'review' e aciona o AG-008 (QA Gate)
      await supabase
        .from('tasks')
        .update({
          status: TaskStatus.REVIEW,
          result_payload: execution.outputPayload
        })
        .eq('id', task.id);

      const qaResult = await qaGate.auditTaskResult(task, execution.outputPayload);

      // 3. Avalia resultado da Auditoria QA
      if (!qaResult.approved) {
        if (task.retry_count < task.max_retries) {
          console.warn(`[AutonomousWorker] Task ${task.task_code} rejected by QA Gate. Retrying (${task.retry_count + 1}/${task.max_retries})`);
          await supabase
            .from('tasks')
            .update({
              status: TaskStatus.PENDING,
              retry_count: task.retry_count + 1,
              qa_review_payload: qaResult,
              input_payload: {
                ...task.input_payload,
                qa_feedback: qaResult.correction_instructions || qaResult.critical_inconsistencies
              }
            })
            .eq('id', task.id);
          return;
        } else {
          // Excedeu tentativas de autocorreção
          await supabase
            .from('tasks')
            .update({
              status: TaskStatus.FAILED,
              qa_review_payload: qaResult
            })
            .eq('id', task.id);
          return;
        }
      }

      // 4. Se QA APROVOU: Checa governança de aprovação humana (Nível 2)
      const postPolicy = policyEngine.evaluatePostExecution(
        task.risk_level,
        qaResult.requires_human_approval,
        task.assigned_agent_id
      );

      if (task.requires_approval || postPolicy.requiresApproval) {
        console.log(`[AutonomousWorker] Task ${task.task_code} requires Level 2 Founder approval.`);

        await supabase
          .from('tasks')
          .update({
            status: TaskStatus.WAITING_INPUT,
            qa_review_payload: qaResult,
            requires_approval: true,
            approval_reason: postPolicy.approvalReason || task.approval_reason
          })
          .eq('id', task.id);

        // Cria entrada na tabela approvals
        await supabase
          .from('approvals')
          .insert({
            task_id: task.id,
            requested_by: task.assigned_agent_id,
            approval_type: task.task_type || 'contract_recommendation',
            approval_status: 'pending',
            comments: postPolicy.approvalReason
          });

        // Dispara notificação externa via n8n webhook se configurado
        this.notifyN8nApproval(task, postPolicy.approvalReason);
      } else {
        // Nível 0 ou 1: Conclui automaticamente e destrava dependentes!
        console.log(`[AutonomousWorker] Task ${task.task_code} completed successfully.`);
        await supabase
          .from('tasks')
          .update({
            status: TaskStatus.COMPLETED,
            completed_at: new Date().toISOString(),
            qa_review_payload: qaResult
          })
          .eq('id', task.id);

        // Se a tarefa possui tarefa-mãe, verifica se todas as irmãs terminaram para sintetizar
        if (task.parent_task_id) {
          await this.checkAndSynthesizeParent(task.parent_task_id);
        }
      }
    } catch (taskErr: any) {
      console.error(`[AutonomousWorker] Failure executing task ${task.task_code}:`, taskErr);
      await supabase
        .from('tasks')
        .update({
          status: TaskStatus.FAILED,
          result_payload: { error: taskErr?.message || 'Erro interno na execução do agente' }
        })
        .eq('id', task.id);
    }
  }

  /**
   * Verifica se todas as tarefas de dependência estão com status = 'completed'.
   */
  private async areDependenciesSatisfied(dependencies: string[]): Promise<boolean> {
    if (!dependencies || dependencies.length === 0) {
      return true;
    }

    const { data: depTasks, error } = await supabase
      .from('tasks')
      .select('id, status')
      .in('id', dependencies);

    if (error || !depTasks || depTasks.length !== dependencies.length) {
      return false;
    }

    return depTasks.every(t => t.status === TaskStatus.COMPLETED);
  }

  /**
   * Checa se todas as subtarefas de um objetivo macro terminaram para acionar o AG-001.
   */
  private async checkAndSynthesizeParent(parentTaskId: string): Promise<void> {
    const { data: siblings } = await supabase
      .from('tasks')
      .select('id, status')
      .eq('parent_task_id', parentTaskId);

    if (!siblings || siblings.length === 0) return;

    const allDone = siblings.every(s => s.status === TaskStatus.COMPLETED);
    if (allDone) {
      console.log(`[AutonomousWorker] All subtasks completed for parent ${parentTaskId}. Synthesizing with AG-001...`);
      await orchestrator.synthesizeCompletedObjective(parentTaskId);
    }
  }

  /**
   * Notifica o webhook do n8n quando uma aprovação humana de Nível 2 for necessária.
   */
  private notifyN8nApproval(task: TaskModel, reason?: string): void {
    if (!env.N8N_WEBHOOK_URL) return;

    fetch(env.N8N_WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        event: 'approval_required',
        task_id: task.id,
        task_code: task.task_code,
        assigned_agent_id: task.assigned_agent_id,
        objective: task.objective,
        approval_reason: reason,
        created_at: new Date().toISOString()
      })
    }).catch(err => {
      console.warn('[AutonomousWorker] n8n webhook notification skipped or unreachable:', err?.message);
    });
  }
}

export const autonomousWorker = new AutonomousWorker();

