// ==============================================================================
// HISTORICAL BOOTSTRAP, CALENDAR DOSSIER & LINKEDIN DRAFT ENGINE (FASE 3)
// ==============================================================================

import { supabase } from '../config/supabase.js';
import { founderMemory, generateFingerprint } from './founder-memory.js';
import { searchDriveFiles } from './google-drive.js';

async function withFastTimeout<T>(promise: PromiseLike<T>, timeoutMs = 1200, fallback: T): Promise<T> {
  let timer: NodeJS.Timeout;
  const timeoutPromise = new Promise<T>((resolve) => {
    timer = setTimeout(() => resolve(fallback), timeoutMs);
  });
  return Promise.race([Promise.resolve(promise), timeoutPromise]).finally(() => clearTimeout(timer));
}

/**
 * Sanitização determinística de PII e credenciais antes da vetorização no RAG.
 * Preserva integralmente grandezas elétricas (kW, kWh, UC, REN ANEEL) e valores tarifários (R$).
 */
export function sanitizeSensitiveContent(text: string): string {
  if (!text) return '';

  let clean = text;
  // Mascara CPFs (ex: 123.456.789-00)
  clean = clean.replace(/\b\d{3}\.\d{3}\.\d{3}-\d{2}\b/g, '[CPF_REDACTED]');
  // Mascara senhas, segredos, chaves e tokens explícitos
  clean = clean.replace(/\b(senha|password|secret|api_key|token)\s*[:=]\s*\S+/gi, '$1: [SECRET_REDACTED]');
  return clean;
}

/**
 * Divide documentos em chunks com overlap configurável e checksum SHA-256 para idempotência.
 */
export function chunkDocumentText(
  text: string,
  maxLength = 2000,
  overlap = 200
): Array<{ index: number; content: string; checksum: string }> {
  const normalized = (text || '').trim();
  if (!normalized) return [];

  if (normalized.length <= maxLength) {
    return [{ index: 0, content: normalized, checksum: generateFingerprint(normalized) }];
  }

  const chunks: Array<{ index: number; content: string; checksum: string }> = [];
  const step = Math.max(1, maxLength - Math.min(overlap, maxLength - 1));
  let offset = 0;
  let index = 0;

  while (offset < normalized.length) {
    const slice = normalized.slice(offset, offset + maxLength).trim();
    if (slice.length > 0) {
      chunks.push({
        index,
        content: slice,
        checksum: generateFingerprint(slice)
      });
      index++;
    }
    if (offset + maxLength >= normalized.length) break;
    offset += step;
  }

  return chunks;
}

/**
 * Executa carga inicial de conhecimento histórico (Bootstrap Opção A)
 * a partir do Google Drive e E-mails corporativos, respeitando idempotência SHA-256.
 */
export async function runHistoricalBootstrap(options?: {
  includeDrive?: boolean;
  includeEmails?: boolean;
}): Promise<{
  processedSources: number;
  chunksCreated: number;
  skippedDuplicates: number;
  status: 'completed';
}> {
  const includeDrive = options?.includeDrive !== false;
  const includeEmails = options?.includeEmails !== false;

  const rawDocuments: Array<{
    sourceType: 'google_drive' | 'email';
    sourceId: string;
    title: string;
    content: string;
    metadata: Record<string, any>;
  }> = [];

  if (includeDrive) {
    try {
      const driveRes = await withFastTimeout(searchDriveFiles({ limit: 15 }), 2500, { files: [] });
      for (const file of driveRes.files || []) {
        rawDocuments.push({
          sourceType: 'google_drive',
          sourceId: file.id,
          title: file.name,
          content: `Documento Google Drive: ${file.name}\nTipo: ${file.mimeType}\nLink: ${file.webViewLink || 'N/A'}\nModificado em: ${file.createdTime || 'N/A'}`,
          metadata: {
            title: file.name,
            mimeType: file.mimeType,
            webViewLink: file.webViewLink
          }
        });
      }
    } catch {
      // prossegue se Drive indisponível
    }
  }

  if (includeEmails) {
    try {
      const emailRes = await withFastTimeout(
        supabase
          .from('email_messages')
          .select('id, subject, sender_email, snippet, received_at')
          .order('received_at', { ascending: false })
          .limit(20),
        1200,
        { data: null, error: null } as any
      );
      for (const msg of (emailRes?.data || []) as any[]) {
        rawDocuments.push({
          sourceType: 'email',
          sourceId: String(msg.id),
          title: msg.subject || 'Sem assunto',
          content: `Assunto: ${msg.subject || 'Sem assunto'}\nRemetente: ${msg.sender_email || 'desconhecido'}\nResumo: ${msg.snippet || ''}`,
          metadata: {
            subject: msg.subject,
            sender: msg.sender_email,
            receivedAt: msg.received_at
          }
        });
      }
    } catch {
      // prossegue se tabela indisponível
    }
  }

  let chunksCreated = 0;
  let skippedDuplicates = 0;

  for (const doc of rawDocuments) {
    const sanitized = sanitizeSensitiveContent(doc.content);
    const chunks = chunkDocumentText(sanitized, 2000, 200);

    for (const chunk of chunks) {
      try {
        const existingRes = await withFastTimeout(
          supabase
            .from('knowledge_chunks')
            .select('id')
            .eq('content_checksum', chunk.checksum)
            .limit(1)
            .maybeSingle(),
          800,
          { data: null, error: null } as any
        );

        if (existingRes?.data?.id) {
          skippedDuplicates++;
          continue;
        }

        const insertRes = await withFastTimeout(
          supabase
            .from('knowledge_chunks')
            .insert({
              source_type: doc.sourceType,
              source_id: doc.sourceId,
              chunk_index: chunk.index,
              content: chunk.content,
              content_checksum: chunk.checksum,
              metadata: doc.metadata
            }),
          800,
          { error: new Error('offline') } as any
        );

        if (!insertRes?.error) {
          chunksCreated++;
        }
      } catch {
        // segue contagem em ambiente offline
      }
    }
  }

  return {
    processedSources: rawDocuments.length,
    chunksCreated,
    skippedDuplicates,
    status: 'completed'
  };
}

/**
 * Gera um Dossiê Executivo Pré-Reunião integrando agenda, heurísticas da persona e memória RAG.
 */
export async function generatePreMeetingDossier(payload: {
  title: string;
  participantEmail?: string;
  companyName?: string;
  startTime?: string;
}): Promise<{
  dossierMarkdown: string;
  precedentsFound: number;
  generatedAt: string;
}> {
  const persona = await founderMemory.getActivePersona();
  const queryTarget = payload.companyName || payload.title;
  const precedents = await founderMemory.searchSimilarActionLogs({
    query: queryTarget,
    limit: 5
  });

  const minFee = persona.business_heuristics.min_success_fee_percent ?? 20.0;
  const distributors = (persona.business_heuristics.target_distributors || []).join(', ');

  const precedentsSection = precedents.length > 0
    ? precedents
        .map(p => `- **[${p.action_type}]** (${p.agent_id}): ${p.original_proposal.slice(0, 120)}...`)
        .join('\n')
    : '- _Nenhum precedente específico encontrado no histórico para esta conta; aplicar diretriz consultiva padrão._';

  const dossierMarkdown =
    `# 📅 DOSSIÊ PRÉ-REUNIÃO — ENERGY INTELLIGENCE\n\n` +
    `**Reunião:** ${payload.title}\n` +
    `**Empresa / Conta:** ${payload.companyName || 'Não especificada'}\n` +
    `**Participante:** ${payload.participantEmail || 'A confirmar'}\n` +
    `**Horário:** ${payload.startTime || 'Agenda do Dia'}\n\n` +
    `## 🧠 Diretrizes da Persona do Fundador\n` +
    `- **Tom Recomendado:** \`${persona.preferred_tone}\`\n` +
    `- **Piso de Success Fee:** ${minFee}%\n` +
    `- **Distribuidoras Prioritárias:** ${distributors}\n\n` +
    `## 🔍 Precedentes Recuperados via RAG (${precedents.length})\n` +
    `${precedentsSection}\n\n` +
    `## 🎯 Talking Points Sugeridos\n` +
    `1. Validar enquadramento tarifário atual (Verde vs. Azul) e histórico de ultrapassagem de demanda nos últimos 12 ciclos.\n` +
    `2. Demonstrar o retorno sobre o investimento baseado na redução direta na fatura conforme REN ANEEL 1.000/2021.\n` +
    `3. Propor início imediato da auditoria diagnóstica das últimas 3 faturas em PDF com modelo de remuneração atrelado ao êxito (>= ${minFee}%).`;

  return {
    dossierMarkdown,
    precedentsFound: precedents.length,
    generatedAt: new Date().toISOString()
  };
}

/**
 * Gera rascunho de post B2B para LinkedIn (AG-006) e registra como sugestão sob guarda HITL estrita.
 */
export async function generateLinkedInDraft(payload: {
  topic: string;
  targetAudience?: string;
  angle?: string;
}): Promise<{
  topic: string;
  draftText: string;
  requiresExplicitApproval: true;
  approvalProbability: number;
  suggestionId?: string;
}> {
  const persona = await founderMemory.getActivePersona();
  const audience = payload.targetAudience || 'Diretores Industriais e CFOs (Grupo A4)';
  const angle = payload.angle || 'Eficiência Tarifária e Previsibilidade no Mercado Livre de Energia';

  const draftText =
    `⚡ ${payload.topic}\n\n` +
    `Muitas indústrias brasileiras ainda tratam a fatura de energia elétrica como um custo fixo inevitável — quando, na prática, erros de enquadramento tarifário e multas por ultrapassagem de demanda drenam margem operacional todos os meses.\n\n` +
    `Sob a ótica de ${angle}:\n` +
    `1️⃣ A revisão técnica de demanda contratada frente à curva real de carga costuma destravar economias imediatas já no próximo ciclo de faturamento.\n` +
    `2️⃣ A conformidade com a REN ANEEL 1.000/2021 protege o consumidor contra cobranças indevidas e otimiza a transição para o Ambiente de Contratação Livre (ACL).\n\n` +
    `Para ${audience}, transparência nos números e engenharia de dados vêm antes de qualquer decisão.\n\n` +
    `Como a sua operação está monitorando a eficiência da demanda de ponta neste trimestre?\n\n` +
    `#EficienciaEnergetica #MercadoLivreDeEnergia #GestaoIndustrial #EnergyIntelligence`;

  // Calcula probabilidade e registra na fila se banco estiver disponível
  const probRes = await founderMemory.calculateApprovalProbability({
    title: `Post LinkedIn: ${payload.topic}`,
    proposalText: draftText,
    category: 'social_post',
    agentId: 'AG-006',
    metadata: { tone: persona.preferred_tone }
  });

  let suggestionId: string | undefined;
  try {
    const created = await withFastTimeout(
      founderMemory.createSuggestion({
        category: 'social_post',
        priority: 'P2',
        title: `Publicação LinkedIn: ${payload.topic}`,
        contextSummary: `Rascunho gerado para ${audience} com ângulo "${angle}" alinhado ao tom ${persona.preferred_tone}.`,
        actionType: 'PUBLISH_LINKEDIN_POST',
        targetAgentId: 'AG-006',
        actionPayload: {
          topic: payload.topic,
          targetAudience: audience,
          angle,
          draftText,
          requiresExplicitApproval: true
        }
      }),
      1200,
      null as any
    );
    if (created?.id) {
      suggestionId = created.id;
    }
  } catch {
    // offline fallback
  }

  return {
    topic: payload.topic,
    draftText,
    requiresExplicitApproval: true,
    approvalProbability: probRes.approvalProbability,
    suggestionId
  };
}
