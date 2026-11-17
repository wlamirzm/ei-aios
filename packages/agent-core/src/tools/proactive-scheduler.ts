// ==============================================================================
// PROACTIVE SCHEDULER, MORNING BRIEFING & ANTI-SPAM ENGINE (FASE 2)
// ==============================================================================

import { supabase } from '../config/supabase.js';
import { founderMemory } from './founder-memory.js';
import { telegramConcierge } from './telegram-concierge.js';
import type { PredictiveSuggestion, SuggestionPriority } from '@ei-aios/shared';

async function withFastTimeout<T>(promise: PromiseLike<T>, timeoutMs = 1200, fallback: T): Promise<T> {
  let timer: NodeJS.Timeout;
  const timeoutPromise = new Promise<T>((resolve) => {
    timer = setTimeout(() => resolve(fallback), timeoutMs);
  });
  return Promise.race([Promise.resolve(promise), timeoutPromise]).finally(() => clearTimeout(timer));
}

function parseMinutesFromHHMM(hhmm: string): number {
  const [hStr, mStr] = hhmm.split(':');
  const h = Number(hStr) || 0;
  const m = Number(mStr) || 0;
  return h * 60 + m;
}

/**
 * Obtém hora e minuto atuais no fuso horário de Brasília (America/Sao_Paulo)
 * garantindo comportamento determinístico entre ambiente local e CI Ubuntu UTC.
 */
function getBrtMinutesOfDay(date: Date): number {
  try {
    const formatted = new Intl.DateTimeFormat('en-GB', {
      timeZone: 'America/Sao_Paulo',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    }).format(date);
    const [hStr, mStr] = formatted.split(':');
    const h = Number(hStr) % 24;
    const m = Number(mStr);
    return h * 60 + m;
  } catch {
    // Fallback UTC-3 manual
    const utcMinutes = date.getUTCHours() * 60 + date.getUTCMinutes();
    return (utcMinutes - 180 + 1440) % 1440;
  }
}

/**
 * Verifica se o horário atual está dentro da janela de silêncio (Quiet Hours).
 */
export function isWithinQuietHours(now: Date, quietStart = '21:00', quietEnd = '07:30'): boolean {
  const currentMinutes = getBrtMinutesOfDay(now);
  const startMinutes = parseMinutesFromHHMM(quietStart);
  const endMinutes = parseMinutesFromHHMM(quietEnd);

  if (startMinutes <= endMinutes) {
    return currentMinutes >= startMinutes && currentMinutes < endMinutes;
  }
  // Janela cruza a meia-noite (ex: 21:00 -> 07:30)
  return currentMinutes >= startMinutes || currentMinutes < endMinutes;
}

/**
 * Trava Anti-Spam para notificações push proativas no Telegram.
 * Emergências P0 ignoram quiet hours e limite diário; P1-P3 respeitam ambos.
 */
export function canDispatchTelegramPush(options: {
  priority: SuggestionPriority | string;
  dailyPushCount: number;
  maxDailyPushes?: number;
  isQuietHours: boolean;
}): boolean {
  if (options.priority === 'P0') {
    return true;
  }
  if (options.isQuietHours) {
    return false;
  }
  const limit = options.maxDailyPushes ?? 5;
  return options.dailyPushCount < limit;
}

export class ProactiveSchedulerService {
  private intervalHandle: NodeJS.Timeout | null = null;
  private isRunning = false;
  private lastBriefingDate: string | null = null;
  private lastScanAt: string | null = null;
  private dailyPushCount = 0;
  private dailyPushDayKey: string = new Date().toISOString().slice(0, 10);

  private resetDailyCounterIfNeeded(now: Date): void {
    const dayKey = now.toISOString().slice(0, 10);
    if (dayKey !== this.dailyPushDayKey) {
      this.dailyPushDayKey = dayKey;
      this.dailyPushCount = 0;
    }
  }

  /**
   * Retorna o estado atual do daemon proativo
   */
  async getStatus() {
    const now = new Date();
    const persona = await founderMemory.getActivePersona();
    const quietStart = persona.business_heuristics.quiet_hours_start || '21:00';
    const quietEnd = persona.business_heuristics.quiet_hours_end || '07:30';

    return {
      running: this.isRunning,
      lastBriefingDate: this.lastBriefingDate,
      lastScanAt: this.lastScanAt,
      dailyPushCount: this.dailyPushCount,
      maxDailyPushes: persona.business_heuristics.max_daily_telegram_pushes ?? 5,
      quietHoursActive: isWithinQuietHours(now, quietStart, quietEnd),
      quietWindow: `${quietStart} - ${quietEnd}`
    };
  }

  /**
   * Consolida e envia o Briefing Matinal Executivo para o Telegram Concierge (AG-016)
   */
  async generateMorningBriefing(options?: { sendTelegram?: boolean }): Promise<{
    briefingText: string;
    pendingTasksCount: number;
    unreadEmailsCount: number;
    suggestionsCount: number;
    sentToTelegram: boolean;
  }> {
    const shouldSend = options?.sendTelegram !== false;

    const tasksRes = await withFastTimeout(
      supabase
        .from('tasks')
        .select('id, status, requires_approval')
        .in('status', ['pending', 'running']),
      1200,
      { data: null, error: null } as any
    );

    const emailsRes = await withFastTimeout(
      supabase
        .from('email_messages')
        .select('id, subject, sender_email, priority')
        .eq('status', 'unread')
        .limit(5),
      1200,
      { data: null, error: null } as any
    );

    let suggestions: PredictiveSuggestion[] = [];
    try {
      suggestions = await withFastTimeout(
        founderMemory.listSuggestions({ status: 'pending', limit: 5 }),
        1200,
        []
      );
    } catch {
      suggestions = [];
    }

    const pendingTasks = (tasksRes?.data || []) as any[];
    const hitlCount = pendingTasks.filter(t => t.requires_approval).length;
    const unreadEmails = (emailsRes?.data || []) as any[];

    const suggestionsLines = suggestions.length > 0
      ? suggestions
          .map(
            (s, idx) =>
              `${idx + 1}. *[${Math.round(Number(s.approval_probability) * 100)}% Aprovação]* ${s.title} (${s.target_agent_id})`
          )
          .join('\n')
      : '• _Nenhuma sugestão pendente na fila. Execute uma varredura proativa para gerar novas oportunidades._';

    const emailLines = unreadEmails.length > 0
      ? unreadEmails
          .slice(0, 3)
          .map(e => `• ${e.subject || '(Sem assunto)'} — _${e.sender_email || 'remetente desconhecido'}_`)
          .join('\n')
      : '• _Caixa de entrada triada e limpa pelo AG-012._';

    const todayLabel = new Date().toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' });

    const briefingText =
      `☀️ *BRIEFING MATINAL — SEGUNDO CÉREBRO EI-AIOS* (${todayLabel})\n\n` +
      `📊 *Pulso Operacional:*\n` +
      `• Tarefas Ativas: ${pendingTasks.length} (${hitlCount} aguardando HITL)\n` +
      `• E-mails Não Lidos: ${unreadEmails.length}\n` +
      `• Sugestões Preditivas Pendentes: ${suggestions.length}\n\n` +
      `📬 *Destaques de E-mail (AG-012):*\n${emailLines}\n\n` +
      `🧠 *Top Sugestões Calculadas via RAG:*\n${suggestionsLines}\n\n` +
      `_Acesse /second-brain no Cockpit Web ou use /sugestoes aqui para aprovar com 1 toque._`;

    let sentToTelegram = false;
    if (shouldSend && telegramConcierge.isConfigured()) {
      sentToTelegram = await telegramConcierge.sendMessage({ text: briefingText });
    }

    this.lastBriefingDate = new Date().toISOString().slice(0, 10);

    return {
      briefingText,
      pendingTasksCount: pendingTasks.length,
      unreadEmailsCount: unreadEmails.length,
      suggestionsCount: suggestions.length,
      sentToTelegram
    };
  }

  /**
   * Varre sinais passivos (e-mails, CRM e mercado), gera sugestões preditivas
   * e despacha notificações de alta probabilidade no Telegram respeitando o Anti-Spam.
   */
  async scanAndGenerateSuggestions(): Promise<{
    scannedAt: string;
    suggestionsCreated: PredictiveSuggestion[];
    pushedToTelegram: number;
    blockedByAntiSpam: number;
  }> {
    const now = new Date();
    this.resetDailyCounterIfNeeded(now);
    const persona = await founderMemory.getActivePersona();
    const isQuiet = isWithinQuietHours(
      now,
      persona.business_heuristics.quiet_hours_start || '21:00',
      persona.business_heuristics.quiet_hours_end || '07:30'
    );
    const maxPushes = persona.business_heuristics.max_daily_telegram_pushes ?? 5;

    let existingPending: PredictiveSuggestion[] = [];
    try {
      existingPending = await withFastTimeout(
        founderMemory.listSuggestions({ status: 'pending', limit: 10 }),
        1200,
        []
      );
    } catch {
      existingPending = [];
    }

    const created: PredictiveSuggestion[] = [];

    // Verifica e-mails não lidos prioritários
    const emailsRes = await withFastTimeout(
      supabase
        .from('email_messages')
        .select('id, subject, sender_email, snippet')
        .eq('status', 'unread')
        .limit(2),
      1200,
      { data: null, error: null } as any
    );

    const unreadEmails = (emailsRes?.data || []) as any[];
    for (const email of unreadEmails) {
      try {
        const s = await founderMemory.createSuggestion({
          category: 'email_response',
          priority: 'P1',
          title: `Resposta Sugerida: ${email.subject || 'Contato Corporativo'}`,
          contextSummary: `E-mail recebido de ${email.sender_email || 'cliente'}: ${(email.snippet || '').slice(0, 160)}`,
          actionType: 'SEND_EMAIL_REPLY',
          targetAgentId: 'AG-012',
          targetEntityType: 'email_message',
          targetEntityId: String(email.id),
          actionPayload: {
            recipient: email.sender_email,
            subject: `Re: ${email.subject || 'Energy Intelligence'}`,
            draftText: `Prezado(a),\n\nRecebemos sua mensagem referente a "${email.subject || 'sua solicitação'}". Nossa equipe técnica da Energy Intelligence já iniciou a auditoria dos dados tarifários e retornará com a simulação de ROI até o fim do dia.\n\nAtenciosamente,\nWlamir Molinari`,
            requiresExplicitApproval: true
          }
        });
        created.push(s);
      } catch {
        // segue caso banco offline
      }
    }

    // Se a fila ainda estiver vazia (ex: primeiro uso), gera 2 oportunidades acionáveis de sementes
    if (existingPending.length === 0 && created.length === 0) {
      const seeds = [
        {
          category: 'crm_followup' as const,
          priority: 'P1' as const,
          title: 'Follow-up Estratégico Grupo A4 (Cemig)',
          contextSummary:
            'Lead industrial em tarifa Horo-Sazonal Verde sem retorno há 4 dias. Histórico mostra alta taxa de resposta com foco em redução de demanda na ponta.',
          actionType: 'SEND_PROSPECT_FOLLOWUP',
          targetAgentId: 'AG-007',
          actionPayload: {
            distributor: 'Cemig',
            successFeePercent: 25.0,
            draftText:
              'Olá, identifiquei uma janela tarifária imediata para redução da demanda contratada na Cemig com potencial de corte de 22% no custo de ponta. Podemos revisar em 10 min na quinta?',
            requiresExplicitApproval: true
          }
        },
        {
          category: 'tariff_optimization' as const,
          priority: 'P2' as const,
          title: 'Revisão Mensal de Ultrapassagem de Demanda (CPFL Paulista)',
          contextSummary:
            'Consolidar comparativo de consumo ponta/fora de ponta do portfólio CPFL Paulista para identificar unidades aptas à migração ACL.',
          actionType: 'RUN_TARIFF_AUDIT',
          targetAgentId: 'AG-004',
          actionPayload: {
            distributor: 'CPFL Paulista',
            scope: 'Portfolio Mensal Grupo A4',
            draftText:
              'Executar auditoria preventiva nas faturas CPFL Paulista da competência vigente conforme REN ANEEL 1.000/2021.',
            requiresExplicitApproval: true
          }
        }
      ];

      for (const seed of seeds) {
        try {
          const s = await founderMemory.createSuggestion(seed);
          created.push(s);
        } catch {
          // ignore offline
        }
      }
    }

    let pushedToTelegram = 0;
    let blockedByAntiSpam = 0;

    for (const suggestion of created) {
      if (Number(suggestion.approval_probability) >= 0.85) {
        const allowed = canDispatchTelegramPush({
          priority: suggestion.priority,
          dailyPushCount: this.dailyPushCount,
          maxDailyPushes: maxPushes,
          isQuietHours: isQuiet
        });

        if (allowed) {
          const sent = await telegramConcierge.sendSuggestionCard(suggestion);
          if (sent) {
            this.dailyPushCount++;
            pushedToTelegram++;
          }
        } else {
          blockedByAntiSpam++;
        }
      }
    }

    this.lastScanAt = now.toISOString();

    return {
      scannedAt: this.lastScanAt,
      suggestionsCreated: created,
      pushedToTelegram,
      blockedByAntiSpam
    };
  }

  /**
   * Inicia o ciclo automático em background (polling leve a cada 15 min)
   */
  start(): void {
    if (this.isRunning) return;
    this.isRunning = true;

    const tick = async () => {
      try {
        const now = new Date();
        const minutes = getBrtMinutesOfDay(now);
        const dayKey = now.toISOString().slice(0, 10);

        // Dispara briefing matinal automaticamente entre 08:00 e 08:20 BRT uma vez por dia
        if (minutes >= 480 && minutes <= 500 && this.lastBriefingDate !== dayKey) {
          await this.generateMorningBriefing({ sendTelegram: true });
        }

        await this.scanAndGenerateSuggestions();
      } catch (err) {
        console.error('[ProactiveScheduler] Erro no ciclo automático:', err);
      }
    };

    // 15 minutos entre ciclos proativos; unref() permite encerramento limpo do Node
    this.intervalHandle = setInterval(tick, 15 * 60 * 1000);
    if (typeof this.intervalHandle.unref === 'function') {
      this.intervalHandle.unref();
    }
    console.log('🧠 [ProactiveScheduler] Daemon do Segundo Cérebro iniciado (ciclo 15m).');
  }

  stop(): void {
    if (this.intervalHandle) {
      clearInterval(this.intervalHandle);
      this.intervalHandle = null;
    }
    this.isRunning = false;
  }
}

export const proactiveScheduler = new ProactiveSchedulerService();
