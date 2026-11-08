// ==============================================================================
// AG-012 EMAIL & NEXT-STEP INTELLIGENCE ENGINE (HOSTGATOR CPANEL IMAP/SMTP)
// ==============================================================================

import tls from 'node:tls';
import { supabase } from '../config/supabase.js';
import { geminiService } from '../config/gemini.js';
import { getAgentDefinition } from '../agents/registry.js';
import { autonomousWorker } from '../engine/worker.js';
import { ActionRiskLevel, AgentId, PriorityLevel } from '@ei-aios/shared';

export interface EmailAccountRow {
  id: string;
  account_label: string;
  email_address: string;
  provider: string;
  imap_host: string;
  imap_port: number;
  smtp_host: string;
  smtp_port: number;
  username: string;
  password_secret: string;
  operation_mode: 'read_summarize' | 'auto_action';
  enabled: boolean;
  last_synced_at?: string | null;
  last_sync_status?: string | null;
}

export interface RawImapEmail {
  uid: string;
  fromName: string;
  fromAddress: string;
  subject: string;
  receivedAt: string;
  bodyExcerpt: string;
  hasAttachments: boolean;
  attachmentNames: string[];
}

export interface AG012EmailAnalysis {
  category: 'lead_comercial' | 'fatura_energia' | 'regulatorio_aneel' | 'financeiro' | 'suporte_operacional' | 'geral';
  priority: 'P0' | 'P1' | 'P2' | 'P3';
  ai_summary: string;
  recommended_next_step: string;
  suggested_reply_draft: string;
  recommended_agent_id: string;
  auto_task_objective: string;
}

function decodeMimeWords(str: string): string {
  if (!str) return '';
  return str.replace(/=\?([^?]+)\?([BQbq])\?([^?]*)\?=/g, (_match, _charset, encoding, text) => {
    try {
      if (encoding.toUpperCase() === 'B') {
        return Buffer.from(text, 'base64').toString('utf-8');
      }
      if (encoding.toUpperCase() === 'Q') {
        const qp = text
          .replace(/_/g, ' ')
          .replace(/=([0-9A-Fa-f]{2})/g, (_m: string, hex: string) => String.fromCharCode(parseInt(hex, 16)));
        return Buffer.from(qp, 'binary').toString('utf-8');
      }
    } catch {
      // ignore decode error
    }
    return text;
  });
}

function cleanBodyText(raw: string): string {
  if (!raw) return '';
  const decoded = raw
    .replace(/=\r?\n/g, '')
    .replace(/=([0-9A-Fa-f]{2})/g, (_m, hex) => {
      try {
        return String.fromCharCode(parseInt(hex, 16));
      } catch {
        return '';
      }
    })
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return decoded.slice(0, 1500);
}

/**
 * Conecta via TLS (porta 993 padrão cPanel HostGator) e lê os últimos e-mails da INBOX.
 */
export async function fetchImapEmailsFromHostgator(account: EmailAccountRow, maxCount = 5): Promise<RawImapEmail[]> {
  return new Promise((resolve, reject) => {
    const socket = tls.connect(
      {
        host: account.imap_host,
        port: Number(account.imap_port) || 993,
        rejectUnauthorized: false,
        timeout: 12000
      },
      () => {
        // Connected
      }
    );

    let buffer = '';
    let step: 'GREETING' | 'LOGIN' | 'SELECT' | 'FETCH' | 'DONE' = 'GREETING';
    let totalMessages = 0;

    const cleanupAndReject = (err: Error) => {
      try {
        socket.destroy();
      } catch {}
      reject(err);
    };

    socket.setTimeout(12000, () => {
      cleanupAndReject(new Error(`Timeout ao conectar ao servidor IMAP ${account.imap_host}:${account.imap_port}`));
    });

    socket.on('error', (err) => {
      cleanupAndReject(new Error(`Falha de conexão IMAP (${account.imap_host}:${account.imap_port}): ${err.message}`));
    });

    const escapeImapQuoted = (val: string) => val.replace(/\\/g, '\\\\').replace(/"/g, '\\"');

    socket.on('data', (chunk) => {
      buffer += chunk.toString('utf-8');

      if (step === 'GREETING' && buffer.includes('\r\n')) {
        buffer = '';
        step = 'LOGIN';
        socket.write(`A1 LOGIN "${escapeImapQuoted(account.username)}" "${escapeImapQuoted(account.password_secret)}"\r\n`);
        return;
      }

      if (step === 'LOGIN') {
        if (buffer.includes('A1 OK')) {
          buffer = '';
          step = 'SELECT';
          socket.write('A2 SELECT INBOX\r\n');
          return;
        }
        if (buffer.includes('A1 NO') || buffer.includes('A1 BAD')) {
          cleanupAndReject(new Error('Credenciais IMAP recusadas pelo servidor cPanel HostGator. Verifique usuário e senha.'));
          return;
        }
      }

      if (step === 'SELECT') {
        if (buffer.includes('A2 OK')) {
          const existsMatch = buffer.match(/\*\s+(\d+)\s+EXISTS/i);
          totalMessages = existsMatch ? parseInt(existsMatch[1]!, 10) : 0;
          buffer = '';

          if (totalMessages === 0) {
            step = 'DONE';
            socket.write('A4 LOGOUT\r\n');
            socket.end();
            resolve([]);
            return;
          }

          const startSeq = Math.max(1, totalMessages - maxCount + 1);
          step = 'FETCH';
          socket.write(
            `A3 FETCH ${startSeq}:${totalMessages} (UID BODY.PEEK[HEADER.FIELDS (FROM SUBJECT DATE)] BODY.PEEK[TEXT]<0.1800>)\r\n`
          );
          return;
        }
        if (buffer.includes('A2 NO') || buffer.includes('A2 BAD')) {
          cleanupAndReject(new Error('Não foi possível abrir a pasta INBOX na conta IMAP.'));
          return;
        }
      }

      if (step === 'FETCH') {
        if (buffer.includes('A3 OK') || buffer.includes('A3 NO') || buffer.includes('A3 BAD')) {
          const rawBlocks = buffer.split(/\*\s+\d+\s+FETCH\s+\(/i).slice(1);
          const parsedEmails: RawImapEmail[] = [];

          for (const block of rawBlocks) {
            const uidMatch = block.match(/UID\s+(\d+)/i);
            const uid = uidMatch ? uidMatch[1]! : `imap-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;

            const fromMatch = block.match(/From:\s*([^\r\n]+)/i);
            const rawFrom = decodeMimeWords(fromMatch ? fromMatch[1]!.trim() : 'Remetente Desconhecido');
            const emailAddrMatch = rawFrom.match(/<([^>]+)>/);
            const fromAddress = emailAddrMatch ? emailAddrMatch[1]! : rawFrom;
            const fromName = rawFrom.replace(/<[^>]+>/, '').replace(/"/g, '').trim() || fromAddress;

            const subjMatch = block.match(/Subject:\s*([^\r\n]+)/i);
            const subject = decodeMimeWords(subjMatch ? subjMatch[1]!.trim() : '(Sem Assunto)');

            const bodySplit = block.split(/BODY\[TEXT\]<\d+>\s*\{\d+\}\r?\n/i);
            const rawBodyPart = bodySplit[1] ? bodySplit[1].split(/A3 OK|\)\r?\n/)[0] || '' : '';
            const bodyExcerpt = cleanBodyText(rawBodyPart) || `E-mail recebido de ${fromName} com assunto "${subject}".`;

            const lowerBlock = block.toLowerCase();
            const hasPdf = lowerBlock.includes('.pdf') || lowerBlock.includes('fatura') || lowerBlock.includes('conta');

            parsedEmails.push({
              uid,
              fromName,
              fromAddress,
              subject,
              receivedAt: new Date().toISOString(),
              bodyExcerpt,
              hasAttachments: hasPdf,
              attachmentNames: hasPdf ? ['fatura_energia.pdf'] : []
            });
          }

          step = 'DONE';
          socket.write('A4 LOGOUT\r\n');
          socket.end();
          resolve(parsedEmails.reverse());
        }
      }
    });
  });
}

/**
 * Executa a inteligência cognitiva do AG-012 sobre um e-mail recebido.
 */
export async function analyzeEmailWithAG012(email: RawImapEmail): Promise<AG012EmailAnalysis> {
  const ag012Def = await getAgentDefinition(AgentId.AG_012);

  const prompt = `ANÁLISE DE E-MAIL CORPORATIVO E PRÓXIMO PASSO (AG-012):
Analise o seguinte e-mail recebido na caixa corporativa da Energy Intelligence:
- De: ${email.fromName} <${email.fromAddress}>
- Assunto: ${email.subject}
- Possui Anexos: ${email.hasAttachments ? `Sim (${email.attachmentNames.join(', ')})` : 'Não'}
- Conteúdo / Trecho do Corpo:
"""
${email.bodyExcerpt}
"""

Classifique este e-mail, resuma o contexto executivo, defina o próximo passo concreto, elabore uma minuta de resposta cordial e indique qual agente especialista deve assumir a tarefa caso a ação automática esteja ativa:
- "AG-003": Faturas de energia, dúvidas de demanda contratada, reativo (UFER), Tarifa Verde/Azul ou auditoria técnica.
- "AG-007": Leads comerciais, pedidos de proposta, reuniões de vendas, cotações ou parcerias comerciais.
- "AG-009": Notificações da distribuidora/ANEEL, cobranças indevidas, devolução em dobro (Art. 323 REN 1.000/2021) ou Mercado Livre.
- "AG-010": Clientes ativos em onboarding ou medição e verificação (M&V).
- "AG-011": Assuntos financeiros internos, notas fiscais ou cobrança.

Retorne EXCLUSIVAMENTE um JSON válido com estas chaves exatas:
{
  "category": "lead_comercial" | "fatura_energia" | "regulatorio_aneel" | "financeiro" | "suporte_operacional" | "geral",
  "priority": "P0" | "P1" | "P2" | "P3",
  "ai_summary": "Resumo executivo claro em 2 a 3 frases",
  "recommended_next_step": "Explicação direta do próximo passo recomendado ao fundador",
  "suggested_reply_draft": "Minuta de resposta profissional pronta para revisão e envio",
  "recommended_agent_id": "AG-003" | "AG-007" | "AG-009" | "AG-010" | "AG-011",
  "auto_task_objective": "Objetivo claro para o agente especialista executar"
}`;

  try {
    const result = await geminiService.generateStructuredContent<AG012EmailAnalysis>({
      taskId: 'email-analysis-' + Date.now(),
      agentId: AgentId.AG_012,
      model: ag012Def.model,
      systemInstruction: ag012Def.systemPrompt,
      prompt,
      temperature: 0.2
    });

    const d = result.data || ({} as any);
    if (d.ai_summary && d.recommended_next_step) {
      return {
        category: d.category || 'lead_comercial',
        priority: d.priority || 'P1',
        ai_summary: d.ai_summary,
        recommended_next_step: d.recommended_next_step,
        suggested_reply_draft:
          d.suggested_reply_draft ||
          `Olá ${email.fromName},\n\nRecebemos sua mensagem sobre "${email.subject}". Nossa equipe técnica já iniciou a análise e retornaremos em breve com o parecer.\n\nAtenciosamente,\nDiretoria Energy Intelligence`,
        recommended_agent_id: d.recommended_agent_id || 'AG-007',
        auto_task_objective:
          d.auto_task_objective ||
          `Executar o próximo passo para o e-mail "${email.subject}" de ${email.fromAddress}: ${d.recommended_next_step}`
      };
    }
  } catch (err) {
    console.warn('[AG-012] Fallback analysis triggered:', err);
  }

  // Fallback determinístico contextualizado
  const lower = `${email.subject} ${email.bodyExcerpt}`.toLowerCase();
  const isBill = lower.includes('fatura') || lower.includes('conta') || lower.includes('demanda') || lower.includes('kwh');
  const isReg = lower.includes('aneel') || lower.includes('indevid') || lower.includes('multa') || lower.includes('notifica');

  const recommendedAgent = isBill ? 'AG-003' : isReg ? 'AG-009' : 'AG-007';
  const category = isBill ? 'fatura_energia' : isReg ? 'regulatorio_aneel' : 'lead_comercial';

  return {
    category,
    priority: 'P1',
    ai_summary: `Mensagem recebida de ${email.fromName} (${email.fromAddress}) tratando de "${email.subject}". ${
      isBill
        ? 'Contém dados/referência a faturamento energético do Grupo A para diagnóstico de otimização.'
        : 'Demanda retorno consultivo comercial e definição de escopo piloto.'
    }`,
    recommended_next_step: isBill
      ? 'Extrair indicadores de demanda/consumo da fatura com AG-003, auditar multas de ultrapassagem/reativos e preparar laudo preliminar.'
      : 'Qualificar o potencial da unidade consumidora com AG-007 e responder propondo o Diagnóstico Gratuito das últimas 12 faturas.',
    suggested_reply_draft: `Olá ${email.fromName},\n\nObrigado pelo contato com a Energy Intelligence sobre "${email.subject}".\n\nJá encaminhei sua solicitação para nossa engenharia tarifária avaliar os dados sob as normas da REN ANEEL 1.000/2021. Podemos agendar uma breve call de 15 minutos amanhã para apresentar o diagnóstico preliminar?\n\nAtenciosamente,\nEnergy Intelligence`,
    recommended_agent_id: recommendedAgent,
    auto_task_objective: `Atender demanda originada no e-mail "${email.subject}" (${email.fromAddress}): ${email.bodyExcerpt.slice(0, 220)}`
  };
}

/**
 * Persiste o e-mail analisado e, se a conta estiver configurada como 'auto_action',
 * cria e dispara automaticamente a tarefa para o agente especialista correspondente.
 */
export async function processAndSaveEmailMessage(account: EmailAccountRow, rawEmail: RawImapEmail) {
  // Evita duplicar o mesmo message_uid na mesma conta
  if (rawEmail.uid) {
    const { data: existing } = await supabase
      .from('email_messages')
      .select('*')
      .eq('account_id', account.id)
      .eq('message_uid', rawEmail.uid)
      .maybeSingle();

    if (existing) {
      return existing;
    }
  }

  const analysis = await analyzeEmailWithAG012(rawEmail);

  let triggeredTaskId: string | null = null;
  let triggeredTaskCode: string | null = null;
  let status = 'analyzed';

  if (account.operation_mode === 'auto_action') {
    const taskRes = await createFollowUpTaskFromEmail(account, rawEmail, analysis);
    if (taskRes) {
      triggeredTaskId = taskRes.id;
      triggeredTaskCode = taskRes.task_code;
      status = 'task_dispatched';
    }
  }

  const { data: savedMsg, error } = await supabase
    .from('email_messages')
    .insert({
      account_id: account.id,
      message_uid: rawEmail.uid,
      from_name: rawEmail.fromName,
      from_address: rawEmail.fromAddress,
      subject: rawEmail.subject,
      received_at: rawEmail.receivedAt,
      body_excerpt: rawEmail.bodyExcerpt,
      has_attachments: rawEmail.hasAttachments,
      attachment_names: rawEmail.attachmentNames,
      category: analysis.category,
      priority: analysis.priority,
      ai_summary: analysis.ai_summary,
      recommended_next_step: analysis.recommended_next_step,
      suggested_reply_draft: analysis.suggested_reply_draft,
      recommended_agent_id: analysis.recommended_agent_id,
      operation_mode_applied: account.operation_mode,
      triggered_task_id: triggeredTaskId,
      triggered_task_code: triggeredTaskCode,
      status
    })
    .select('*')
    .single();

  if (error) {
    throw new Error(`Erro ao salvar e-mail analisado: ${error.message}`);
  }

  return savedMsg;
}

export async function createFollowUpTaskFromEmail(
  account: EmailAccountRow,
  rawEmail: RawImapEmail,
  analysis: AG012EmailAnalysis
): Promise<{ id: string; task_code: string } | null> {
  const taskCode = `EMAIL-${Date.now().toString().slice(-6)}`;
  const requiresHumanGate = analysis.recommended_agent_id === 'AG-007' || analysis.category === 'lead_comercial';

  const { data: createdTask, error } = await supabase
    .from('tasks')
    .insert({
      task_code: taskCode,
      created_by: AgentId.AG_012,
      assigned_agent_id: analysis.recommended_agent_id || AgentId.AG_007,
      objective: `[Triagem E-mail ${account.account_label}] ${analysis.auto_task_objective}`,
      task_type: `email_${analysis.category}`,
      priority: (analysis.priority as PriorityLevel) || PriorityLevel.P1,
      status: 'pending',
      risk_level: requiresHumanGate ? ActionRiskLevel.LEVEL_2_APPROVAL_REQUIRED : ActionRiskLevel.LEVEL_0_AUTO,
      dependencies: [],
      input_payload: {
        source_email_account: account.email_address,
        from_address: rawEmail.fromAddress,
        subject: rawEmail.subject,
        email_summary: analysis.ai_summary,
        recommended_next_step: analysis.recommended_next_step,
        suggested_reply_draft: analysis.suggested_reply_draft
      },
      requires_approval: requiresHumanGate,
      approval_reason: requiresHumanGate
        ? `Aprovação Nível 2 para envio de proposta/resposta ao e-mail de ${rawEmail.fromAddress}`
        : null
    })
    .select('id, task_code')
    .single();

  if (error || !createdTask) {
    console.error('[AG-012] Failed to create follow-up task from email:', error);
    return null;
  }

  // Dispara ciclo do Worker em background para executar imediatamente
  autonomousWorker.triggerCycle().catch(() => {});

  return createdTask;
}

