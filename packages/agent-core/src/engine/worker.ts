// ==============================================================================
// AUTONOMOUS BACKGROUND WORKER: CONTINUOUS POLLING, PARALLEL DAG & RECOVERY
// Sprint 1 - BKL-001 & BKL-005
// ==============================================================================

import { TaskModel, TaskStatus } from '@ei-aios/shared';
import { env } from '../config/env.js';
import { supabase } from '../config/supabase.js';
import { policyEngine } from './policy-engine.js';
import { qaGate } from './qa-gate.js';
import { executeAgentTask } from '../agents/executors.js';
import { orchestrator } from './orchestrator.js';
import {
  fetchImapEmailsFromHostgator,
  processAndSaveEmailMessage,
  EmailAccountRow
} from '../tools/email-intelligence.js';

export class AutonomousWorker {
  private isRunning: boolean = false;
  private isProcessingCycle: boolean = false;
  private intervalHandle: NodeJS.Timeout | null = null;
  private lastEmailSyncTimestamp: number = 0;

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
   * Ciclo principal: recupera tarefas expiradas, reconcilia objetivos macro,
   * busca tarefas elegíveis e executa subtarefas independentes em paralelo.
   */
  private async pollAndExecute(): Promise<{ processedCount: number }> {
    if (this.isProcessingCycle) {
      return { processedCount: 0 };
    }

    this.isProcessingCycle = true;
    let processedCount = 0;

    try {
      // 0. Recuperação de tarefas presas por timeout e reconciliação de tarefas-mãe
      await this.recoverStuckTasks().catch(() => {});
      await this.reconcileCompletedParentObjectives().catch(() => {});
      await this.checkAndTriggerScheduledEmailSync().catch(() => {});

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

      const readyTasks: { task: TaskModel; leaseToken: string }[] = [];

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

        // 4. S5-03: Claim atômico no banco com geração de lease_token exclusivo
        const leaseToken = `lease_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
        const { data: claimedTasks, error: claimErr } = await supabase
          .from('tasks')
          .update({
            status: TaskStatus.RUNNING,
            started_at: new Date().toISOString(),
            input_payload: {
              ...(task.input_payload || {}),
              lease_token: leaseToken
            }
          })
          .eq('id', task.id)
          .eq('status', TaskStatus.PENDING)
          .select('*');

        if (claimErr || !claimedTasks || claimedTasks.length === 0) {
          console.log(`[AutonomousWorker] Task ${task.task_code} already claimed by another worker instance.`);
          continue;
        }

        const claimedTask = claimedTasks[0] as TaskModel;
        readyTasks.push({ task: claimedTask, leaseToken });
      }

      if (readyTasks.length > 0) {
        processedCount = readyTasks.length;
        // Execução paralela controlada de todas as subtarefas com proteção de lease
        await Promise.allSettled(readyTasks.map(item => this.processSingleTask(item.task, item.leaseToken)));
      }
    } catch (cycleErr) {
      console.error('[AutonomousWorker] Error in pollAndExecute:', cycleErr);
    } finally {
      this.isProcessingCycle = false;
    }

    return { processedCount };
  }

  /**
   * Recupera subtarefas e tarefas standalone que ficaram presas em 'running' além do TASK_TIMEOUT_MS (S5-02).
   */
  public async recoverStuckTasks(timeoutMs: number = env.TASK_TIMEOUT_MS): Promise<number> {
    const cutoffTime = Date.now() - timeoutMs;

    // S5-02: Universal Watchdog
    // Busca tarefas em 'running' que NÃO sejam objetivos macro (exclui task_type = 'macro_objective')
    // Remove o filtro restritivo de parent_task_id para recuperar também tarefas standalone
    const { data: stuckTasks, error } = await supabase
      .from('tasks')
      .select('*')
      .eq('status', TaskStatus.RUNNING)
      .neq('task_type', 'macro_objective')
      .limit(20);

    if (error || !stuckTasks || stuckTasks.length === 0) {
      return 0;
    }

    let recovered = 0;
    for (const raw of stuckTasks) {
      const task = raw as TaskModel;

      // S5-02: Trata started_at nulo utilizando created_at como fallback (COALESCE)
      const effectiveStart = new Date(task.started_at || task.created_at).getTime();
      if (effectiveStart > cutoffTime) {
        continue;
      }

      if (task.retry_count < task.max_retries) {
        console.warn(`[AutonomousWorker] Watchdog recovering task ${task.task_code} (attempt ${task.retry_count + 1}/${task.max_retries})`);
        const { error: updateErr } = await supabase
          .from('tasks')
          .update({
            status: TaskStatus.PENDING,
            retry_count: task.retry_count + 1,
            input_payload: {
              ...(task.input_payload || {}),
              lease_token: null, // S5-03: Invalida lease do worker antigo/zumbi
              recovery_reason: `Recuperada por watchdog após timeout (${Math.round(timeoutMs / 1000)}s em execução).`
            }
          })
          .eq('id', task.id)
          .eq('status', TaskStatus.RUNNING);

        if (!updateErr) recovered++;
      } else {
        console.error(`[AutonomousWorker] Watchdog marking task ${task.task_code} as FAILED (retries exhausted)`);
        const { error: updateErr } = await supabase
          .from('tasks')
          .update({
            status: TaskStatus.FAILED,
            result_payload: {
              error: `Tarefa excedeu o tempo limite (${Math.round(timeoutMs / 1000)}s) e o máximo de tentativas (${task.max_retries}).`
            }
          })
          .eq('id', task.id)
          .eq('status', TaskStatus.RUNNING);

        if (!updateErr) recovered++;
      }
    }

    // S5-02 / S5-01: Recupera tarefas-mãe travadas em 'synthesizing' além do timeout
    const { data: stuckSynthesizing } = await supabase
      .from('tasks')
      .select('id, task_code, created_at, started_at')
      .eq('status', TaskStatus.SYNTHESIZING)
      .limit(5);

    for (const parent of (stuckSynthesizing || [])) {
      const effectiveStart = new Date(parent.started_at || parent.created_at).getTime();
      if (effectiveStart <= cutoffTime) {
        console.warn(`[AutonomousWorker] Watchdog resetting stalled synthesis on ${parent.task_code} to running`);
        await supabase
          .from('tasks')
          .update({ status: TaskStatus.RUNNING })
          .eq('id', parent.id)
          .eq('status', TaskStatus.SYNTHESIZING);
        recovered++;
      }
    }

    return recovered;
  }

  /**
   * Verifica objetivos macro em 'running' cujas subtarefas filhas já foram 100% concluídas (BKL-001 / S5-01).
   */
  public async reconcileCompletedParentObjectives(): Promise<number> {
    const { data: runningParents, error } = await supabase
      .from('tasks')
      .select('id, task_code')
      .eq('status', TaskStatus.RUNNING)
      .is('parent_task_id', null);

    if (error || !runningParents || runningParents.length === 0) {
      return 0;
    }

    let synthesizedCount = 0;
    for (const parent of runningParents) {
      const didSynthesize = await this.checkAndSynthesizeParent(parent.id);
      if (didSynthesize) {
        synthesizedCount++;
      }
    }

    return synthesizedCount;
  }

  /**
   * Processa uma única tarefa de ponta a ponta com proteção de lease contra workers atrasados/zumbis (S5-03).
   */
  public async processSingleTask(task: TaskModel, leaseToken?: string): Promise<void> {
    console.log(`[AutonomousWorker] Processing task ${task.task_code} (${task.assigned_agent_id})`);

    try {
      // 1. Executa o Agente (com ferramentas determinísticas se aplicável)
      const execution = await executeAgentTask(task);

      // S5-03: Checagem de worker zumbi / expiração de lease antes de salvar resultados
      if (leaseToken) {
        const { data: currentTask } = await supabase
          .from('tasks')
          .select('status, input_payload')
          .eq('id', task.id)
          .single();

        const currentLease = currentTask?.input_payload?.lease_token;
        if (currentTask?.status !== TaskStatus.RUNNING) {
          console.warn(`[AutonomousWorker] Zombie execution aborted for task ${task.task_code}: current status is '${currentTask?.status}'. Discarding late result.`);
          return;
        }
        if (currentLease && currentLease !== leaseToken) {
          console.warn(`[AutonomousWorker] Zombie execution aborted for task ${task.task_code}: lease mismatch (current: ${currentLease}, worker: ${leaseToken}). Discarding late result.`);
          return;
        }
      }

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

        // S5-03: Verificação de worker zumbi antes de transicionar para WAITING_INPUT
        if (leaseToken) {
          const { data: cur } = await supabase.from('tasks').select('status, input_payload').eq('id', task.id).single();
          if (cur?.status !== TaskStatus.RUNNING && cur?.status !== TaskStatus.REVIEW) {
            console.warn(`[AutonomousWorker] Late approval request ignored for ${task.task_code} (status is ${cur?.status})`);
            return;
          }
        }

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
        // S5-03: Conclusão atômica com validação de lease contra conclusões tardias/zumbis
        if (leaseToken) {
          const { data: cur } = await supabase.from('tasks').select('status, input_payload').eq('id', task.id).single();
          if (cur?.status !== TaskStatus.RUNNING && cur?.status !== TaskStatus.REVIEW) {
            console.warn(`[AutonomousWorker] Late completion ignored for ${task.task_code} (status changed to ${cur?.status})`);
            return;
          }
          if (cur?.input_payload?.lease_token && cur.input_payload.lease_token !== leaseToken) {
            console.warn(`[AutonomousWorker] Late completion ignored for ${task.task_code}: lease mismatch (worker: ${leaseToken}, current: ${cur?.input_payload?.lease_token})`);
            return;
          }
        }

        // Nível 0 ou 1: Conclui automaticamente e destrava dependentes!
        console.log(`[AutonomousWorker] Task ${task.task_code} completed successfully.`);
        const { data: completedRows } = await supabase
          .from('tasks')
          .update({
            status: TaskStatus.COMPLETED,
            completed_at: new Date().toISOString(),
            qa_review_payload: qaResult
          })
          .eq('id', task.id)
          .select('id');

        if (!completedRows || completedRows.length === 0) {
          console.warn(`[AutonomousWorker] Failed to mark task ${task.task_code} as completed (already transitioned or reassigned).`);
          return;
        }

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
  public async areDependenciesSatisfied(dependencies: string[]): Promise<boolean> {
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
   * Checa se todas as subtarefas de um objetivo macro terminaram para acionar o AG-001 (S5-01 / BKL-001).
   * Implementa lock atômico ('synthesizing') para impedir execuções duplicadas e trata subtarefas com falha.
   */
  public async checkAndSynthesizeParent(parentTaskId: string): Promise<boolean> {
    if (!parentTaskId) return false;

    const { data: siblings } = await supabase
      .from('tasks')
      .select('id, status')
      .eq('parent_task_id', parentTaskId);

    if (!siblings || siblings.length === 0) return false;

    // Todas as subtarefas terminaram se cada uma estiver em estado terminal (COMPLETED ou FAILED)
    const allTerminal = siblings.every(s => s.status === TaskStatus.COMPLETED || s.status === TaskStatus.FAILED);
    if (!allTerminal) {
      return false;
    }

    // S5-01: Lock atômico da tarefa-mãe (transiciona de 'running' para 'synthesizing')
    const { data: locked, error: lockErr } = await supabase
      .from('tasks')
      .update({
        status: TaskStatus.SYNTHESIZING,
        started_at: new Date().toISOString()
      })
      .eq('id', parentTaskId)
      .eq('status', TaskStatus.RUNNING)
      .select('id, task_code');

    if (lockErr || !locked || locked.length === 0) {
      // Outro worker concorrente ou rotina de reconciliação já realizou o lock da síntese
      return false;
    }

    console.log(`[AutonomousWorker] Atomic synthesis lock acquired for parent ${parentTaskId} (${locked[0]?.task_code}). Synthesizing with AG-001...`);
    await orchestrator.synthesizeCompletedObjective(parentTaskId);
    return true;
  }

  /**
   * BKL-016: Dispara sincronização periódica de e-mails IMAP configurável (EMAIL_AUTO_SYNC_MINUTES).
   */
  public async checkAndTriggerScheduledEmailSync(): Promise<number> {
    const syncIntervalMinutes = env.EMAIL_AUTO_SYNC_MINUTES || 0;
    if (syncIntervalMinutes <= 0) return 0;

    const intervalMs = syncIntervalMinutes * 60 * 1000;
    const now = Date.now();
    if (this.lastEmailSyncTimestamp > 0 && now - this.lastEmailSyncTimestamp < intervalMs) {
      return 0;
    }

    this.lastEmailSyncTimestamp = now;
    return await this.syncAllActiveEmailAccounts();
  }

  public async syncAllActiveEmailAccounts(): Promise<number> {
    try {
      const { data: accounts, error } = await supabase
        .from('email_accounts')
        .select('*')
        .eq('enabled', true);

      if (error || !accounts || accounts.length === 0) return 0;

      let totalSynced = 0;
      for (const rawAcc of accounts) {
        const account = rawAcc as EmailAccountRow;
        try {
          const rawEmails = await fetchImapEmailsFromHostgator(account);
          for (const raw of rawEmails) {
            await processAndSaveEmailMessage(account, raw);
            totalSynced++;
          }
          await supabase
            .from('email_accounts')
            .update({
              last_synced_at: new Date().toISOString(),
              last_sync_status: `Sincronização agendada OK (${rawEmails.length} e-mails lidos)`
            })
            .eq('id', account.id);
        } catch (err: any) {
          await supabase
            .from('email_accounts')
            .update({
              last_synced_at: new Date().toISOString(),
              last_sync_status: `Alerta IMAP: ${err.message || 'Falha de conexão'}`
            })
            .eq('id', account.id);
        }
      }
      return totalSynced;
    } catch {
      return 0;
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
