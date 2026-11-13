// ==============================================================================
// TELEGRAM CONCIERGE & HITL GATEWAY SERVICE (AG-016)
// ==============================================================================

import { env } from '../config/env.js';
import { supabase } from '../config/supabase.js';
import { TaskStatus } from '@ei-aios/shared';
import { orchestrator } from '../engine/orchestrator.js';

export interface TelegramMessagePayload {
  chatId: string | number;
  text: string;
  parseMode?: 'Markdown' | 'HTML';
  inlineKeyboard?: Array<Array<{ text: string; callbackData: string }>>;
}

export interface TelegramUpdate {
  update_id: number;
  message?: {
    message_id: number;
    from: { id: number; first_name: string; username?: string };
    chat: { id: number; type: string };
    date: number;
    text?: string;
    caption?: string;
  };
  callback_query?: {
    id: string;
    from: { id: number; first_name: string; username?: string };
    message?: { message_id: number; chat: { id: number } };
    data?: string;
  };
}

export class TelegramConciergeService {
  private botToken: string | null = null;
  private adminChatId: string | null = null;

  constructor() {
    this.botToken = env.TELEGRAM_BOT_TOKEN || process.env.TELEGRAM_BOT_TOKEN || null;
    this.adminChatId = env.TELEGRAM_ADMIN_CHAT_ID || process.env.TELEGRAM_ADMIN_CHAT_ID || null;
  }

  isConfigured(): boolean {
    return Boolean(this.botToken && this.adminChatId);
  }

  /**
   * Envia uma mensagem formatada com botões inline diretamente para o Telegram do fundador
   */
  async sendMessage(payload: TelegramMessagePayload): Promise<boolean> {
    if (!this.botToken) {
      console.warn('[TelegramConcierge] Bot token not configured. Skipping message.');
      return false;
    }

    const targetChatId = payload.chatId || this.adminChatId;
    if (!targetChatId) {
      console.warn('[TelegramConcierge] No target chatId provided.');
      return false;
    }

    try {
      const url = `https://api.telegram.org/bot${this.botToken}/sendMessage`;
      const body: Record<string, any> = {
        chat_id: targetChatId,
        text: payload.text,
        parse_mode: payload.parseMode || 'Markdown'
      };

      if (payload.inlineKeyboard && payload.inlineKeyboard.length > 0) {
        body.reply_markup = {
          inline_keyboard: payload.inlineKeyboard.map(row =>
            row.map(btn => ({ text: btn.text, callback_data: btn.callbackData }))
          )
        };
      }

      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });

      const resJson = (await res.json()) as any;
      return Boolean(resJson?.ok);
    } catch (err) {
      console.error('[TelegramConcierge] Error sending telegram message:', err);
      return false;
    }
  }

  /**
   * Notifica instantaneamente o fundador no Telegram sobre uma tarefa Nível 2 que requer aprovação
   */
  async notifyPendingApproval(task: {
    id: string;
    task_code: string;
    assigned_agent_id: string;
    objective: string;
    risk_level?: string;
  }): Promise<boolean> {
    const text = `🚨 *APROVAÇÃO NÍVEL 2 REQUERIDA (HITL)*\n\n` +
      `⚡ *Agente:* \`${task.assigned_agent_id}\`\n` +
      `📋 *Tarefa:* \`${task.task_code}\`\n\n` +
      `🎯 *Objetivo:*\n${task.objective}\n\n` +
      `_Selecione uma das opções abaixo para autorizar ou rejeitar a execução:_`;

    const inlineKeyboard = [
      [
        { text: '✅ Aprovar Execução', callbackData: `approve:${task.id}` },
        { text: '❌ Rejeitar Tarefa', callbackData: `reject:${task.id}` }
      ],
      [
        { text: '🌐 Abrir no Cockpit Web', callbackData: `view:${task.id}` }
      ]
    ];

    return await this.sendMessage({
      chatId: this.adminChatId || '',
      text,
      parseMode: 'Markdown',
      inlineKeyboard
    });
  }

  /**
   * Processa uma decisão de aprovação ou rejeição vinda do clique do botão no Telegram
   */
  async handleCallbackQuery(callbackQuery: TelegramUpdate['callback_query']): Promise<string> {
    if (!callbackQuery || !callbackQuery.data) return 'Sem dados';

    const [action, taskId] = callbackQuery.data.split(':');
    const senderId = String(callbackQuery.from.id);

    // Validação estrita de autorização: Apenas o chat ID do fundador é autorizado
    if (this.adminChatId && senderId !== this.adminChatId) {
      return '⛔ Não autorizado.';
    }

    if (action === 'approve') {
      const { data, error } = await supabase
        .from('tasks')
        .update({
          status: TaskStatus.PENDING,
          requires_approval: false,
          updated_at: new Date().toISOString()
        })
        .eq('id', taskId)
        .select()
        .single();

      if (error || !data) {
        return '❌ Erro ao aprovar tarefa.';
      }

      await this.sendMessage({
        chatId: senderId,
        text: `✅ *Tarefa Aprovada com Sucesso!*\n\nA tarefa \`${data.task_code}\` foi liberada e já está na fila de execução do Autonomous Worker.`
      });

      return 'Aprovada com sucesso';
    }

    if (action === 'reject') {
      const { data, error } = await supabase
        .from('tasks')
        .update({
          status: TaskStatus.REJECTED,
          updated_at: new Date().toISOString()
        })
        .eq('id', taskId)
        .select()
        .single();

      if (error || !data) {
        return '❌ Erro ao rejeitar tarefa.';
      }

      await this.sendMessage({
        chatId: senderId,
        text: `🚫 *Tarefa Rejeitada.*\nA tarefa \`${data.task_code}\` foi marcada como rejeitada pelo fundador.`
      });

      return 'Rejeitada com sucesso';
    }

    return 'Comando processado';
  }

  /**
   * Processa comandos de texto enviados pelo fundador no Telegram (ex.: /status, /kpis, ou instruções estratégicas)
   */
  async handleIncomingTextMessage(senderId: string, text: string): Promise<string> {
    if (this.adminChatId && senderId !== this.adminChatId) {
      return '⛔ Acesso restrito ao fundador sovereign do EI-AIOS.';
    }

    const trimmed = text.trim();

    // 1. Comando /status
    if (trimmed === '/status' || trimmed === '/health') {
      const { data: pendingTasks } = await supabase
        .from('tasks')
        .select('id, status, requires_approval')
        .in('status', ['pending', 'running']);

      const countPending = pendingTasks?.filter(t => !t.requires_approval).length || 0;
      const countHitl = pendingTasks?.filter(t => t.requires_approval).length || 0;

      return `📊 *STATUS DO SISTEMA EI-AIOS*\n\n` +
        `• *Autonomous Worker:* 🟢 Online (5s poll)\n` +
        `• *Tarefas em Fila:* ${countPending}\n` +
        `• *Aprovações Pendentes (HITL):* ${countHitl}\n` +
        `• *Ambiente:* Produção Cloud (Hostinger VPS)\n\n` +
        `_Envie uma instrução estratégica para decomposição direta pelo AG-001._`;
    }

    // 2. Comando /kpis
    if (trimmed === '/kpis' || trimmed === '/finops') {
      const { data: clients } = await supabase.from('clients').select('mrr_brl');
      const totalMrr = (clients || []).reduce((acc, c) => acc + (Number(c.mrr_brl) || 0), 0);

      const { data: runs } = await supabase.from('agent_runs').select('cost_estimate');
      const totalAiCost = (runs || []).reduce((acc, r) => acc + (Number(r.cost_estimate) || 0), 0);

      return `💰 *FINOPS & METRICAS EXECUTIVAS (AG-011)*\n\n` +
        `• *MRR Recorrente:* R$ ${totalMrr.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}\n` +
        `• *Gasto IA Acumulado:* $${totalAiCost.toFixed(4)} USD\n` +
        `• *Clientes Ativos:* ${clients?.length || 0}\n\n` +
        `_Governança e auditoria conforme ANEEL REN 1.000/2021._`;
    }

    // 3. Instrução Estratégica -> Envia direto para o AI Orchestrator (AG-001)
    try {
      await this.sendMessage({
        chatId: senderId,
        text: `⚡ *Instrução Recebida!*\n\n"${trimmed}"\n\n_O AG-001 está decompondo este objetivo em subtarefas atômicas..._`
      });

      const { parentTaskId, plan } = await orchestrator.decomposeObjective({
        objective: trimmed
      });

      return `🎯 *Planejamento Concluído pelo AG-001!*\n\n` +
        `• *ID da Tarefa Macro:* \`${parentTaskId.slice(0, 8)}\`\n` +
        `• *Subtarefas Criadas:* ${plan.decomposed_tasks.length}\n` +
        `• *Complexidade:* ${plan.estimated_complexity.toUpperCase()}\n` +
        `• *Status:* Em execução pelo Autonomous Worker.`;
    } catch (err: any) {
      return `⚠️ Erro ao registrar objetivo estratégico: ${err.message || String(err)}`;
    }
  }
}

export const telegramConcierge = new TelegramConciergeService();


