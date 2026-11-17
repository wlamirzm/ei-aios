// ==============================================================================
// TELEGRAM CONCIERGE & HITL GATEWAY SERVICE (AG-016)
// ==============================================================================

import { env } from '../config/env.js';
import { supabase } from '../config/supabase.js';
import { TaskStatus } from '@ei-aios/shared';
import { orchestrator } from '../engine/orchestrator.js';
import { encryptSecret, decryptSecret } from '../config/crypto-vault.js';
import { llmService } from '../config/llm.js';

export interface TelegramConfigStatus {
  configured: boolean;
  botUsername?: string;
  adminChatId?: string;
  status: string;
  lastWebhookStatus?: string;
  lastTestedAt?: string;
  source: 'database' | 'env' | 'none';
}

export interface TelegramMessagePayload {
  chatId?: string | number;
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

  /**
   * Resolve credenciais priorizando a tabela `telegram_configs` no banco,
   * com fallback para variáveis de ambiente.
   */
  async resolveCredentials(): Promise<{ botToken: string | null; adminChatId: string | null }> {
    try {
      const dbPromise = Promise.resolve(
        supabase
          .from('telegram_configs')
          .select('*')
          .order('updated_at', { ascending: false })
          .limit(1)
          .maybeSingle()
      );
      const timeoutPromise = new Promise<{ data: null }>((resolve) =>
        setTimeout(() => resolve({ data: null }), 1000)
      );
      const { data } = await Promise.race([dbPromise, timeoutPromise]);

      if (data?.bot_token_secret && data?.admin_chat_id) {
        try {
          this.botToken = decryptSecret(data.bot_token_secret);
        } catch {
          this.botToken = data.bot_token_secret;
        }
        this.adminChatId = data.admin_chat_id;
        return { botToken: this.botToken, adminChatId: this.adminChatId };
      }
    } catch {
      // ignore
    }

    const envToken = env.TELEGRAM_BOT_TOKEN || process.env.TELEGRAM_BOT_TOKEN || null;
    const envChatId = env.TELEGRAM_ADMIN_CHAT_ID || process.env.TELEGRAM_ADMIN_CHAT_ID || null;
    if (envToken) this.botToken = envToken;
    if (envChatId) this.adminChatId = envChatId;
    return { botToken: this.botToken, adminChatId: this.adminChatId };
  }

  isConfigured(): boolean {
    return Boolean(this.botToken && this.adminChatId);
  }

  /**
   * Salva configurações do bot, registra webhook e dispara teste de handshake
   */
  async saveConfig(params: {
    botToken: string;
    adminChatId: string;
    webhookUrl?: string;
  }): Promise<{ success: boolean; botUsername: string }> {
    const token = params.botToken.trim();
    const chatId = params.adminChatId.trim();

    // 1. Testa token no Telegram API (getMe)
    const getMeRes = await fetch(`https://api.telegram.org/bot${token}/getMe`);
    const getMeJson = (await getMeRes.json()) as any;
    if (!getMeJson.ok || !getMeJson.result?.username) {
      throw new Error('Token do Telegram inválido ou não reconhecido pelo Telegram API.');
    }
    const botUsername = getMeJson.result.username;

    // 2. Configura Webhook automaticamente
    const defaultWebhook = 'https://api.eiaios.atendezen.com.br/api/v1/telegram/webhook';
    const targetWebhook = params.webhookUrl || defaultWebhook;
    let webhookStatus = 'ok';
    try {
      const setHookRes = await fetch(
        `https://api.telegram.org/bot${token}/setWebhook?url=${encodeURIComponent(targetWebhook)}`
      );
      const setHookJson = (await setHookRes.json()) as any;
      webhookStatus = setHookJson.description || (setHookJson.ok ? 'Webhook configurado' : 'Falha');
    } catch (err: any) {
      webhookStatus = `Erro: ${err.message}`;
    }

    // 3. Criptografa e salva no Supabase
    const encryptedToken = encryptSecret(token);
    await supabase.from('telegram_configs').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    const { error: dbErr } = await supabase.from('telegram_configs').insert({
      bot_token_secret: encryptedToken,
      admin_chat_id: chatId,
      bot_username: botUsername,
      status: 'connected',
      last_webhook_status: webhookStatus,
      last_tested_at: new Date().toISOString()
    });

    if (dbErr) {
      throw new Error(`Erro ao salvar no banco de dados: ${dbErr.message}`);
    }

    this.botToken = token;
    this.adminChatId = chatId;

    // 4. Dispara mensagem de teste no chat do fundador
    try {
      await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId,
          text: `⚡ *[EI-AIOS] Conexão com AG-016 Concluída!*\n\nOlá, Fundador! O AG-016 (Telegram Mobile Concierge) está oficialmente vinculado ao seu perfil.\n\n• *Bot:* @${botUsername}\n• *Webhook:* ${targetWebhook}\n\nA partir de agora você receberá aprovações Nível 2 e alertas críticos por aqui, e pode digitar instruções diretas para o AG-001 planejar!`,
          parse_mode: 'Markdown'
        })
      });
    } catch {
      // ignore
    }

    return { success: true, botUsername };
  }

  /**
   * Consulta o status da conexão com o Telegram
   */
  async getStatus(): Promise<TelegramConfigStatus> {
    const creds = await this.resolveCredentials();
    if (!creds.botToken || !creds.adminChatId) {
      return {
        configured: false,
        status: 'unconfigured',
        source: 'none'
      };
    }

    try {
      const res = await fetch(`https://api.telegram.org/bot${creds.botToken}/getMe`);
      const json = (await res.json()) as any;
      if (json.ok) {
        return {
          configured: true,
          botUsername: json.result?.username,
          adminChatId: creds.adminChatId ? `***${creds.adminChatId.slice(-4)}` : undefined,
          status: 'connected',
          source: 'database'
        };
      }
    } catch {
      // ignore
    }

    return {
      configured: true,
      adminChatId: creds.adminChatId ? `***${creds.adminChatId.slice(-4)}` : undefined,
      status: 'error_verifying',
      source: 'database'
    };
  }

  /**
   * Envia uma mensagem formatada com botões inline diretamente para o Telegram do fundador
   */
  async sendMessage(payload: TelegramMessagePayload): Promise<boolean> {
    await this.resolveCredentials();

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
   * Envia cartão de sugestão preditiva do Segundo Cérebro com probabilidade e botões HITL
   */
  async sendSuggestionCard(suggestion: {
    id: string;
    title: string;
    category: string;
    target_agent_id: string;
    context_summary: string;
    approval_probability: number;
    action_payload?: Record<string, any>;
  }): Promise<boolean> {
    if (!this.adminChatId || !this.botToken) {
      await this.resolveCredentials();
    }
    const probPct = Math.round(Number(suggestion.approval_probability || 0) * 100);
    const draftPreview = suggestion.action_payload?.draftText
      ? `\n\n📝 *Rascunho Proposto:*\n_${String(suggestion.action_payload.draftText).slice(0, 350)}_`
      : '';

    const text =
      `🧠 *SUGESTÃO DO SEGUNDO CÉREBRO* • *Probabilidade: ${probPct}%*\n\n` +
      `⚡ *Agente:* \`${suggestion.target_agent_id}\` | *Categoria:* \`${suggestion.category}\`\n` +
      `📌 *${suggestion.title}*\n\n` +
      `🔍 *Contexto RAG:* ${suggestion.context_summary}${draftPreview}\n\n` +
      `_Aprovar para executar e ensinar à base RAG ou descartar:_`;

    const inlineKeyboard = [
      [
        { text: '✅ Aprovar', callbackData: `sb_approve:${suggestion.id}` },
        { text: '❌ Descartar', callbackData: `sb_reject:${suggestion.id}` }
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

    if (!this.adminChatId || !this.botToken) {
      await this.resolveCredentials();
    }

    const [action, targetId] = callbackQuery.data.split(':');
    const senderId = String(callbackQuery.from.id);

    // Validação estrita de autorização: Apenas o chat ID do fundador é autorizado (Fail-Closed)
    if (!this.adminChatId || senderId !== this.adminChatId) {
      return '⛔ Não autorizado.';
    }

    if (action === 'sb_approve' || action === 'sb_reject') {
      const { founderMemory } = await import('./founder-memory.js');
      const { data: suggestion } = await supabase
        .from('predictive_suggestions')
        .select('*')
        .eq('id', targetId)
        .maybeSingle();

      if (!suggestion) {
        return '❌ Sugestão não encontrada.';
      }

      const isApprove = action === 'sb_approve';
      await founderMemory.recordActionAndLearn({
        suggestionId: targetId,
        agentId: suggestion.target_agent_id,
        actionType: isApprove ? 'APPROVE' : 'REJECT',
        taskType: suggestion.action_type,
        targetEntityType: suggestion.target_entity_type,
        targetEntityId: suggestion.target_entity_id,
        originalProposal: JSON.stringify(suggestion.action_payload),
        finalExecutedContent: isApprove ? JSON.stringify(suggestion.action_payload) : undefined,
        reasoningFeedback: isApprove ? 'Aprovado via Telegram Concierge (1-toque)' : 'Descartado via Telegram Concierge',
        executionChannel: 'telegram_concierge',
        appliedHeuristics: suggestion.score_breakdown
      });

      const confirmMsg = isApprove
        ? `✅ *Sugestão Aprovada!*\n\n\`${suggestion.title}\` foi autorizada e gravada na memória RAG para calibrar sugestões futuras.`
        : `🚫 *Sugestão Descartada.*\n\n\`${suggestion.title}\` foi descartada e registrada na memória RAG para ajuste de preferências.`;

      await this.sendMessage({ chatId: senderId, text: confirmMsg });
      return isApprove ? 'Sugestão aprovada' : 'Sugestão descartada';
    }

    if (action === 'approve') {
      const { data, error } = await supabase
        .from('tasks')
        .update({
          status: TaskStatus.PENDING,
          requires_approval: false,
          updated_at: new Date().toISOString()
        })
        .eq('id', targetId)
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
        .eq('id', targetId)
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
   * Processa comandos de texto e mensagens enviadas pelo fundador no Telegram
   */
  async handleIncomingTextMessage(senderId: string, text: string): Promise<string> {
    await this.resolveCredentials();

    // Validação estrita de autorização: Apenas o chat ID do fundador é autorizado (Fail-Closed)
    if (!this.adminChatId || senderId !== this.adminChatId) {
      const msg = '⛔ *Acesso Restrito*\nEste bot é o gateway executivo exclusivo do fundador da Energy Intelligence.';
      await this.sendMessage({ chatId: senderId, text: msg });
      return msg;
    }

    const trimmed = text.trim();
    const lower = trimmed.toLowerCase();

    // 1. Comando /start, /help, /ajuda
    if (lower === '/start' || lower === '/help' || lower === '/ajuda' || lower === 'ajuda') {
      const welcome = `👋 *Olá, Fundador! Sou o AG-016 (Telegram Mobile Concierge).*\n\n` +
        `Estou conectado à infraestrutura do EI-AIOS e ao AI Orchestrator (AG-001).\n\n` +
        `🛠️ *Comandos Rápidos:*\n` +
        `• \`/briefing\` — Gera e envia imediatamente o Briefing Executivo do Segundo Cérebro.\n` +
        `• \`/sugestoes\` — Lista e despacha sugestões pendentes com probabilidade de aprovação.\n` +
        `• \`/status\` — Fila de tarefas, saúde do worker e aprovações pendentes.\n` +
        `• \`/kpis\` — FinOps, MRR recorrente e consumo acumulado de IA.\n` +
        `• \`/tarefas\` — Lista as últimas tarefas em execução.\n` +
        `• \`/ajuda\` — Exibe esta mensagem de ajuda.\n\n` +
        `💬 *Como interagir comigo:*\n` +
        `• *Conversa direta:* Pode falar comigo normalmente (ex: "Boa noite", "Como está o sistema?", "O que você faz?").\n` +
        `• *Criar tarefas no AG-001:* Para disparar uma nova macro-tarefa, envie comandos de ação como *Criar tarefa: ...*, *Objetivo: ...* ou instruções como *"Analise as faturas da Cemig do cliente X"*.\n\n` +
        `🚨 *Aprovações HITL:* Quando qualquer agente precisar da sua validação (Nível 2), enviarei os botões [Aprovar] e [Rejeitar] diretamente aqui!`;

      await this.sendMessage({ chatId: senderId, text: welcome });
      return welcome;
    }

    // 2. Comando /status ou /health
    if (lower === '/status' || lower === '/health') {
      const { data: pendingTasks } = await supabase
        .from('tasks')
        .select('id, status, requires_approval')
        .in('status', ['pending', 'running']);

      const countPending = pendingTasks?.filter(t => !t.requires_approval).length || 0;
      const countHitl = pendingTasks?.filter(t => t.requires_approval).length || 0;

      const reply = `📊 *STATUS DO SISTEMA EI-AIOS*\n\n` +
        `• *Autonomous Worker:* 🟢 Online (5s poll)\n` +
        `• *Tarefas em Fila:* ${countPending}\n` +
        `• *Aprovações Pendentes (HITL):* ${countHitl}\n` +
        `• *Ambiente:* Produção Cloud (Hostinger VPS)\n\n` +
        `_Envie uma instrução operacional para o AG-001 ou digite /tarefas para ver a fila._`;

      await this.sendMessage({ chatId: senderId, text: reply });
      return reply;
    }

    // 3. Comando /kpis ou /finops
    if (lower === '/kpis' || lower === '/finops') {
      const { data: clients } = await supabase.from('clients').select('mrr_brl');
      const totalMrr = (clients || []).reduce((acc, c) => acc + (Number(c.mrr_brl) || 0), 0);

      const { data: runs } = await supabase.from('agent_runs').select('cost_estimate');
      const totalAiCost = (runs || []).reduce((acc, r) => acc + (Number(r.cost_estimate) || 0), 0);

      const reply = `💰 *FINOPS & METRICAS EXECUTIVAS (AG-011)*\n\n` +
        `• *MRR Recorrente:* R$ ${totalMrr.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}\n` +
        `• *Gasto IA Acumulado:* $${totalAiCost.toFixed(4)} USD\n` +
        `• *Clientes Ativos:* ${clients?.length || 0}\n\n` +
        `_Governança e auditoria conforme ANEEL REN 1.000/2021._`;

      await this.sendMessage({ chatId: senderId, text: reply });
      return reply;
    }

    // 4. Comando /tarefas ou /tasks
    if (lower === '/tarefas' || lower === '/tasks') {
      const { data: recentTasks } = await supabase
        .from('tasks')
        .select('task_code, objective, assigned_agent_id, status')
        .in('status', ['pending', 'running'])
        .order('created_at', { ascending: false })
        .limit(5);

      if (!recentTasks || recentTasks.length === 0) {
        const reply = `📋 *TAREFAS NO PIPELINE*\n\nNenhuma tarefa pendente ou em execução no momento. O enxame está pronto para novas ordens!`;
        await this.sendMessage({ chatId: senderId, text: reply });
        return reply;
      }

      const list = recentTasks
        .map(t => `• \`${t.task_code}\` (${t.assigned_agent_id}): ${t.objective.slice(0, 80)}... [${t.status.toUpperCase()}]`)
        .join('\n');

      const reply = `📋 *TAREFAS EM ANDAMENTO (${recentTasks.length}):*\n\n${list}`;
      await this.sendMessage({ chatId: senderId, text: reply });
      return reply;
    }

    // 4.1 Comando /briefing — Dispara Briefing Executivo do Segundo Cérebro
    if (lower === '/briefing') {
      const { proactiveScheduler } = await import('./proactive-scheduler.js');
      const result = await proactiveScheduler.generateMorningBriefing({ sendTelegram: false });
      await this.sendMessage({ chatId: senderId, text: result.briefingText });
      return result.briefingText;
    }

    // 4.2 Comando /sugestoes ou /cerebro — Lista sugestões preditivas com botões inline HITL
    if (lower === '/sugestoes' || lower === '/cerebro' || lower === '/sugestões') {
      const { founderMemory } = await import('./founder-memory.js');
      let suggestions: any[] = [];
      try {
        suggestions = await founderMemory.listSuggestions({ status: 'pending', limit: 3 });
      } catch {
        suggestions = [];
      }

      if (suggestions.length === 0) {
        const reply = `🧠 *SEGUNDO CÉREBRO (RAG)*\n\nNenhuma sugestão pendente no momento. Você pode acionar uma varredura proativa no Cockpit Web (\`/second-brain\`).`;
        await this.sendMessage({ chatId: senderId, text: reply });
        return reply;
      }

      for (const s of suggestions) {
        await this.sendSuggestionCard(s);
      }
      return `🧠 Enviadas ${suggestions.length} sugestão(ões) preditiva(s) com botões de validação.`;
    }

    // 5. Identificação de Intenção: Criação de Tarefa/Objetivo vs Conversação Concierge
    const isExplicitTask =
      lower.startsWith('criar tarefa') ||
      lower.startsWith('tarefa:') ||
      lower.startsWith('objetivo:') ||
      lower.startsWith('/executar') ||
      lower.startsWith('/objetivo') ||
      lower.startsWith('executar:');

    const isActionOriented =
      !isExplicitTask &&
      (lower.startsWith('analise') ||
        lower.startsWith('pesquise') ||
        lower.startsWith('calcule') ||
        lower.startsWith('audite') ||
        lower.startsWith('crie um') ||
        lower.startsWith('gere um') ||
        lower.startsWith('elabore')) &&
      trimmed.split(/\s+/).length >= 4;

    if (isExplicitTask || isActionOriented) {
      const cleanObjective = trimmed
        .replace(/^(criar tarefa:?|tarefa:?|objetivo:?|\/executar|\/objetivo|executar:?)/i, '')
        .trim();

      await this.sendMessage({
        chatId: senderId,
        text: `⚡ *Instrução Operacional Recebida!*\n\n"${cleanObjective}"\n\n_O AG-001 está decompondo este objetivo em subtarefas atômicas..._`
      });

      try {
        const { parentTaskId, plan } = await orchestrator.decomposeObjective({
          objective: cleanObjective
        });

        const reply = `🎯 *Planejamento Concluído pelo AG-001!*\n\n` +
          `• *ID da Tarefa Macro:* \`${parentTaskId.slice(0, 8)}\`\n` +
          `• *Subtarefas Criadas:* ${plan.decomposed_tasks.length}\n` +
          `• *Complexidade:* ${plan.estimated_complexity.toUpperCase()}\n` +
          `• *Status:* Em execução pelo Autonomous Worker.`;

        await this.sendMessage({ chatId: senderId, text: reply });
        return reply;
      } catch (err: any) {
        const reply = `⚠️ Erro ao registrar objetivo estratégico no AG-001: ${err.message || String(err)}`;
        await this.sendMessage({ chatId: senderId, text: reply });
        return reply;
      }
    }

    // 6. Conversação Natural Executiva (AG-016 Concierge)
    try {
      const conciergePrompt =
        `Você é o AG-016 (Telegram Mobile Concierge & HITL Gateway) da Energy Intelligence.\n` +
        `Você está conversando diretamente com o fundador soberano da empresa via Telegram.\n` +
        `Mantenha um tom executivo, prestativo, inteligente e cordial em português do Brasil.\n` +
        `Se o usuário der saudações (ex: "Boa noite", "Bom dia", "Olá"), responda amigavelmente informando que você e os 18 agentes estão atentos e operando normalmente.\n` +
        `Lembre o fundador que ele pode enviar instruções de trabalho (ex: "analise a fatura do cliente X") ou consultar /status e /kpis a qualquer momento.`;

      const aiReply = await llmService.chatWithAgent({
        agentId: 'AG-016',
        systemInstruction: conciergePrompt,
        message: trimmed,
        model: 'gemini-2.5-flash'
      });

      const reply = aiReply.reply;
      await this.sendMessage({ chatId: senderId, text: reply });
      return reply;
    } catch {
      const fallback = `👋 Olá, Fundador! Sou o AG-016. Todos os sistemas estão monitorados. Digite /ajuda para ver os comandos ou me envie uma instrução operacional.`;
      await this.sendMessage({ chatId: senderId, text: fallback });
      return fallback;
    }
  }
}

export const telegramConcierge = new TelegramConciergeService();


