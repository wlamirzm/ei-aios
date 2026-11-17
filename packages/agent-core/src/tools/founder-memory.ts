import crypto from 'crypto';
import { supabase } from '../config/supabase.js';
import type {
  ActionType,
  FounderPersona,
  FounderActionLogEntry,
  PredictiveSuggestion,
  ScoreBreakdown,
  SuggestionPriority,
  SuggestionCategory
} from '@ei-aios/shared';

// ==============================================================================
// DEFAULT HARD-CODED FOUNDER PERSONA & HEURISTICS
// ==============================================================================
export const DEFAULT_FOUNDER_PERSONA: FounderPersona = {
  id: '00000000-0000-0000-0000-000000000001',
  name: 'Fundador Solo Energy Intelligence',
  slug: 'default-founder',
  description: 'Persona executiva com foco em análise rigorosa de ROI tarifário, abordagem consultiva B2B e governança estrita.',
  is_active: true,
  risk_tolerance: 'balanced',
  preferred_tone: 'analytical_executive',
  decision_weights: {
    vector_similarity_weight: 0.45,
    business_rules_weight: 0.35,
    temporal_freshness_weight: 0.20,
    auto_approval_threshold: 0.90,
    review_warning_threshold: 0.65
  },
  business_heuristics: {
    min_success_fee_percent: 20.0,
    max_monthly_churn_risk_usd: 500.0,
    target_distributors: ['CPFL Paulista', 'Enel SP', 'Elektro', 'Cemig', 'Light', 'Equatorial'],
    prohibited_claim_keywords: [
      'garantia incondicional',
      'sem risco',
      'economia garantida 100%',
      'resultado infalivel',
      'retorno sem investimento'
    ],
    max_daily_telegram_pushes: 5,
    quiet_hours_start: '21:00',
    quiet_hours_end: '07:30'
  },
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString()
};

// ==============================================================================
// DIFF & SIMILARITY HELPERS
// ==============================================================================
async function withTimeout<T>(promise: PromiseLike<T>, timeoutMs = 1500, fallback: T): Promise<T> {
  let timer: NodeJS.Timeout;
  const timeoutPromise = new Promise<T>((resolve) => {
    timer = setTimeout(() => resolve(fallback), timeoutMs);
  });
  return Promise.race([Promise.resolve(promise), timeoutPromise]).finally(() => clearTimeout(timer));
}

export function computeTextDiff(original: string, modified: string) {
  const origTrim = (original || '').trim();
  const modTrim = (modified || '').trim();

  const charCountDelta = modTrim.length - origTrim.length;
  const origTokens = origTrim.split(/\s+/).filter(Boolean);
  const modTokens = modTrim.split(/\s+/).filter(Boolean);
  const tokenCountDelta = modTokens.length - origTokens.length;

  // Simple token overlap similarity (Jaccard-like) with punctuation stripped
  const origSet = new Set(origTokens.map(t => t.toLowerCase().replace(/[.,!?;:]/g, '')));
  const modSet = new Set(modTokens.map(t => t.toLowerCase().replace(/[.,!?;:]/g, '')));
  const intersection = new Set([...origSet].filter(x => modSet.has(x)));
  const union = new Set([...origSet, ...modSet]);
  const similarityRatio = union.size > 0 ? Number((intersection.size / union.size).toFixed(4)) : 1.0;

  const changesDetected: string[] = [];
  if (charCountDelta !== 0) changesDetected.push(`Tamanho alterado em ${charCountDelta} caracteres`);
  if (tokenCountDelta !== 0) changesDetected.push(`Tokens alterados em ${tokenCountDelta} palavras`);
  if (similarityRatio < 0.8) changesDetected.push('Reescrita estrutural significativa');

  return {
    charCountDelta,
    tokenCountDelta,
    similarityRatio,
    changesDetected
  };
}

export function generateFingerprint(input: string): string {
  return crypto.createHash('sha256').update((input || '').trim()).digest('hex');
}

// ==============================================================================
// CORE FOUNDER MEMORY CLASS
// ==============================================================================
export class FounderMemoryService {
  private cachedPersona: FounderPersona | null = null;
  private personaCacheTimestamp = 0;
  private readonly CACHE_TTL_MS = 60_000; // 1 minuto de cache em memória

  /**
   * Obtém a persona ativa do fundador com fallback seguro
   */
  async getActivePersona(): Promise<FounderPersona> {
    const now = Date.now();
    if (this.cachedPersona && now - this.personaCacheTimestamp < this.CACHE_TTL_MS) {
      return this.cachedPersona;
    }

    try {
      const res = await withTimeout(
        supabase
          .from('founder_personas')
          .select('*')
          .eq('is_active', true)
          .order('updated_at', { ascending: false })
          .limit(1)
          .maybeSingle(),
        1000,
        { data: null, error: null } as any
      );
      const data = res?.data;
      const error = res?.error;

      if (error || !data) {
        this.cachedPersona = DEFAULT_FOUNDER_PERSONA;
      } else {
        this.cachedPersona = {
          ...DEFAULT_FOUNDER_PERSONA,
          ...data,
          decision_weights: {
            ...DEFAULT_FOUNDER_PERSONA.decision_weights,
            ...(data.decision_weights || {})
          },
          business_heuristics: {
            ...DEFAULT_FOUNDER_PERSONA.business_heuristics,
            ...(data.business_heuristics || {})
          }
        };
      }
    } catch {
      this.cachedPersona = DEFAULT_FOUNDER_PERSONA;
    }

    this.personaCacheTimestamp = now;
    return this.cachedPersona || DEFAULT_FOUNDER_PERSONA;
  }

  /**
   * Atualiza pesos de decisão da persona ativa
   */
  async updatePersonaWeights(personaId: string, weights: Partial<FounderPersona['decision_weights']>): Promise<FounderPersona> {
    const current = await this.getActivePersona();
    const updatedWeights = {
      ...current.decision_weights,
      ...weights
    };

    // Normaliza pesos se a soma dos 3 componentes principais for != 1
    const sum = (updatedWeights.vector_similarity_weight || 0) +
                (updatedWeights.business_rules_weight || 0) +
                (updatedWeights.temporal_freshness_weight || 0);

    if (sum > 0 && Math.abs(sum - 1.0) > 0.001) {
      updatedWeights.vector_similarity_weight = Number((updatedWeights.vector_similarity_weight / sum).toFixed(4));
      updatedWeights.business_rules_weight = Number((updatedWeights.business_rules_weight / sum).toFixed(4));
      updatedWeights.temporal_freshness_weight = Number((updatedWeights.temporal_freshness_weight / sum).toFixed(4));
    }

    const { data, error } = await supabase
      .from('founder_personas')
      .update({
        decision_weights: updatedWeights,
        updated_at: new Date().toISOString()
      })
      .eq('id', personaId)
      .select()
      .maybeSingle();

    if (error) {
      throw new Error(`Falha ao atualizar pesos da persona: ${error.message}`);
    }

    this.cachedPersona = null;
    return data || { ...current, decision_weights: updatedWeights };
  }

  /**
   * Busca episódios passados similares no log de ações do fundador (RAG Episódico)
   */
  async searchSimilarActionLogs(options: {
    query: string;
    agentId?: string;
    limit?: number;
  }): Promise<Array<{
    id: string;
    agent_id: string;
    action_type: ActionType;
    task_type: string;
    original_proposal: string;
    final_executed_content?: string;
    reasoning_feedback?: string;
    similarity: number;
    created_at: string;
  }>> {
    const limit = options.limit || 10;
    const queryTokens = (options.query || '').toLowerCase().split(/\s+/).filter(t => t.length > 2);

    try {
      // Tenta consulta no Supabase
      let query = supabase
        .from('founder_action_logs')
        .select('id, agent_id, action_type, task_type, original_proposal, final_executed_content, reasoning_feedback, created_at')
        .order('created_at', { ascending: false })
        .limit(50);

      if (options.agentId) {
        query = query.eq('agent_id', options.agentId);
      }

      const res = await withTimeout(
        query,
        1000,
        { data: null, error: null } as any
      );
      const data = res?.data;
      const error = res?.error;
      if (error || !data || data.length === 0) {
        return [];
      }

      // Heurística de similaridade textual de contingência quando embeddings diretos não são passados
      const ranked = (data as any[]).map((item: any) => {
        const text = `${item.original_proposal} ${item.task_type} ${item.reasoning_feedback || ''}`.toLowerCase();
        let matches = 0;
        for (const token of queryTokens) {
          if (text.includes(token)) matches++;
        }
        const similarity = queryTokens.length > 0
          ? Math.min(1.0, Number((0.4 + (matches / queryTokens.length) * 0.6).toFixed(4)))
          : 0.5;

        return {
          id: item.id,
          agent_id: item.agent_id,
          action_type: item.action_type as ActionType,
          task_type: item.task_type,
          original_proposal: item.original_proposal,
          final_executed_content: item.final_executed_content || undefined,
          reasoning_feedback: item.reasoning_feedback || undefined,
          similarity,
          created_at: item.created_at
        };
      });

      return ranked
        .sort((a: any, b: any) => b.similarity - a.similarity)
        .slice(0, limit);
    } catch {
      return [];
    }
  }

  /**
   * Calcula a probabilidade de aprovação preditiva P_approval (Fórmula Canônica)
   */
  async calculateApprovalProbability(proposal: {
    title: string;
    proposalText: string;
    category: SuggestionCategory | string;
    agentId: string;
    targetEntity?: string;
    metadata?: Record<string, any>;
  }): Promise<{
    approvalProbability: number;
    confidenceScore: number;
    scoreBreakdown: ScoreBreakdown;
  }> {
    const persona = await this.getActivePersona();
    const weights = persona.decision_weights;
    const heuristics = persona.business_heuristics;

    const contentToCheck = `${proposal.title} ${proposal.proposalText}`.toLowerCase();

    // 1. HARD GUARDRAILS CHECK (G_guardrails in {0.0, 1.0})
    const guardrailsViolated: string[] = [];
    const prohibitedWords = heuristics.prohibited_claim_keywords || [];
    for (const badWord of prohibitedWords) {
      if (contentToCheck.includes(badWord.toLowerCase())) {
        guardrailsViolated.push(`Contém termo promocional proibido: "${badWord}"`);
      }
    }

    const guardrailFactor = guardrailsViolated.length > 0 ? 0.0 : 1.0;

    // 2. VECTOR / HISTORICAL SIMILARITY (S_vector in [0.0, 1.0])
    const similarEpisodes = await this.searchSimilarActionLogs({
      query: proposal.proposalText,
      agentId: proposal.agentId,
      limit: 10
    });

    let vectorScore = 0.75; // Baseline neutro quando não há episódios
    if (similarEpisodes.length > 0) {
      let weightedSum = 0;
      let totalWeight = 0;
      const nowMs = Date.now();
      const lambda = Math.LN2 / 45; // Meia-vida de 45 dias

      for (const ep of similarEpisodes) {
        const ageDays = Math.max(0, (nowMs - new Date(ep.created_at).getTime()) / (1000 * 60 * 60 * 24));
        const decay = Math.exp(-lambda * ageDays);
        const weight = ep.similarity * decay;

        let outcomeScore = 0.5;
        if (ep.action_type === 'APPROVE') outcomeScore = 1.0;
        else if (ep.action_type === 'EDIT_AND_APPROVE') outcomeScore = 0.75;
        else if (ep.action_type === 'REJECT' || ep.action_type === 'DISCARD') outcomeScore = 0.1;

        weightedSum += outcomeScore * weight;
        totalWeight += weight;
      }

      if (totalWeight > 0) {
        vectorScore = Number((weightedSum / totalWeight).toFixed(4));
      }
    }

    // 3. BUSINESS RULES CONFORMANCE (C_rules in [0.0, 1.0])
    let businessScore = 1.0;
    // Se envolver proposta financeira, valida fee de sucesso
    if (proposal.metadata?.successFeePercent !== undefined) {
      const minFee = heuristics.min_success_fee_percent || 20.0;
      if (proposal.metadata.successFeePercent < minFee) {
        businessScore -= 0.35;
      }
    }

    // Se envolver distribuidora, bonifica concessionárias prioritárias
    if (proposal.metadata?.distributor) {
      const targetDistributors = (heuristics.target_distributors || []).map((d: string) => d.toLowerCase());
      if (targetDistributors.includes(String(proposal.metadata.distributor).toLowerCase())) {
        businessScore = Math.min(1.0, businessScore + 0.1);
      } else {
        businessScore -= 0.15;
      }
    }
    businessScore = Math.max(0.2, Math.min(1.0, businessScore));

    // 4. TEMPORAL AGENT ACCEPTANCE RATE (T_time in [0.0, 1.0])
    let temporalRate = 0.82; // Padrão calibrado
    try {
      const agentRes = await withTimeout(
        supabase
          .from('founder_action_logs')
          .select('action_type')
          .eq('agent_id', proposal.agentId)
          .limit(30),
        1000,
        { data: null, error: null } as any
      );
      const agentActions = agentRes?.data;

      if (agentActions && agentActions.length > 0) {
        const approvedCount = (agentActions as any[]).filter((a: any) => a.action_type === 'APPROVE' || a.action_type === 'EDIT_AND_APPROVE').length;
        // Laplace smoothing: (aprovados + 1) / (total + 2)
        temporalRate = Number(((approvedCount + 1) / (agentActions.length + 2)).toFixed(4));
      }
    } catch {
      // Fallback
    }

    // 5. COMPOSIÇÃO DOS PESOS DA PERSONA
    const wv = weights.vector_similarity_weight;
    const wr = weights.business_rules_weight;
    const wt = weights.temporal_freshness_weight;

    const baseProb = (wv * vectorScore) + (wr * businessScore) + (wt * temporalRate);
    const finalProb = Number(Math.max(0.0, Math.min(1.0, baseProb * guardrailFactor)).toFixed(4));

    // Confiança é maior conforme o volume de evidências históricas
    const confidenceScore = similarEpisodes.length >= 5 ? 0.92 : (similarEpisodes.length > 0 ? 0.80 : 0.65);

    const scoreBreakdown: ScoreBreakdown = {
      vectorSimilarity: vectorScore,
      businessRulesMatch: businessScore,
      temporalAcceptanceRate: temporalRate,
      guardrailsViolated,
      appliedWeights: { wv, wr, wt },
      similarEpisodesCount: similarEpisodes.length
    };

    return {
      approvalProbability: finalProb,
      confidenceScore,
      scoreBreakdown
    };
  }

  /**
   * Cria uma nova sugestão preditiva na fila de Next-Best-Action
   */
  async createSuggestion(payload: {
    category: SuggestionCategory;
    priority?: SuggestionPriority;
    title: string;
    contextSummary: string;
    actionType: string;
    targetAgentId: string;
    targetEntityType?: string;
    targetEntityId?: string;
    actionPayload: Record<string, any>;
    expiresInHours?: number;
  }): Promise<PredictiveSuggestion> {
    const persona = await this.getActivePersona();
    const dedupString = `${payload.targetAgentId}:${payload.category}:${payload.title}:${JSON.stringify(payload.actionPayload)}`;
    const dedupFingerprint = generateFingerprint(dedupString);

    // Evita duplicação ativa
    const { data: existing } = await supabase
      .from('predictive_suggestions')
      .select('*')
      .eq('dedup_fingerprint', dedupFingerprint)
      .eq('status', 'pending')
      .maybeSingle();

    if (existing) {
      return existing as PredictiveSuggestion;
    }

    const { approvalProbability, confidenceScore, scoreBreakdown } = await this.calculateApprovalProbability({
      title: payload.title,
      proposalText: payload.contextSummary + ' ' + JSON.stringify(payload.actionPayload),
      category: payload.category,
      agentId: payload.targetAgentId,
      metadata: payload.actionPayload
    });

    const expiresAt = new Date(Date.now() + (payload.expiresInHours || 48) * 3600 * 1000).toISOString();

    const insertPayload = {
      persona_id: persona.id,
      category: payload.category,
      priority: payload.priority || (approvalProbability >= 0.85 ? 'P1' : 'P2'),
      title: payload.title,
      context_summary: payload.contextSummary,
      action_type: payload.actionType,
      target_agent_id: payload.targetAgentId,
      target_entity_type: payload.targetEntityType || null,
      target_entity_id: payload.targetEntityId || null,
      action_payload: payload.actionPayload,
      confidence_score: confidenceScore,
      approval_probability: approvalProbability,
      score_breakdown: scoreBreakdown,
      dedup_fingerprint: dedupFingerprint,
      status: 'pending',
      expires_at: expiresAt
    };

    const { data, error } = await supabase
      .from('predictive_suggestions')
      .insert(insertPayload)
      .select()
      .single();

    if (error) {
      throw new Error(`Erro ao criar sugestão preditiva: ${error.message}`);
    }

    return data as PredictiveSuggestion;
  }

  /**
   * Registra uma ação tomada pelo fundador (Aprovação, Edição ou Rejeição)
   * retroalimentando o aprendizado contínuo do RAG.
   */
  async recordActionAndLearn(options: {
    suggestionId?: string;
    agentId: string;
    actionType: ActionType;
    taskType: string;
    targetEntityType?: string;
    targetEntityId?: string;
    originalProposal: string;
    finalExecutedContent?: string;
    reasoningFeedback?: string;
    rejectionCategory?: string;
    executionChannel?: string;
    appliedHeuristics?: Record<string, any>;
  }): Promise<FounderActionLogEntry> {
    const persona = await this.getActivePersona();

    let diffSummary = null;
    if (options.finalExecutedContent && options.originalProposal) {
      diffSummary = computeTextDiff(options.originalProposal, options.finalExecutedContent);
    }

    const logEntry = {
      persona_id: persona.id,
      agent_id: options.agentId,
      action_type: options.actionType,
      task_type: options.taskType,
      target_entity_type: options.targetEntityType || null,
      target_entity_id: options.targetEntityId || null,
      original_proposal: options.originalProposal,
      final_executed_content: options.finalExecutedContent || null,
      diff_summary: diffSummary,
      reasoning_feedback: options.reasoningFeedback || null,
      rejection_category: options.rejectionCategory || null,
      confidence_score: options.actionType === 'APPROVE' ? 0.95 : (options.actionType === 'EDIT_AND_APPROVE' ? 0.85 : 0.3),
      execution_channel: options.executionChannel || 'web_cockpit',
      applied_heuristics: options.appliedHeuristics || {}
    };

    const { data: createdLog, error: logError } = await supabase
      .from('founder_action_logs')
      .insert(logEntry)
      .select()
      .single();

    if (logError) {
      throw new Error(`Falha ao registrar ação na memória do fundador: ${logError.message}`);
    }

    // Se associado a uma sugestão existente, atualiza seu status
    if (options.suggestionId) {
      let newStatus = 'accepted';
      if (options.actionType === 'REJECT' || options.actionType === 'DISCARD') {
        newStatus = 'rejected';
      } else if (options.actionType === 'EDIT_AND_APPROVE') {
        newStatus = 'edited';
      }

      await supabase
        .from('predictive_suggestions')
        .update({
          status: newStatus,
          feedback_payload: {
            reasoningFeedback: options.reasoningFeedback || null,
            rejectionCategory: options.rejectionCategory || null,
            diffSummary,
            executedAt: new Date().toISOString()
          },
          updated_at: new Date().toISOString()
        })
        .eq('id', options.suggestionId);
    }

    return createdLog as FounderActionLogEntry;
  }

  /**
   * Lista sugestões preditivas pendentes ou filtradas por status
   */
  async listSuggestions(filter?: {
    status?: string;
    priority?: string;
    limit?: number;
  }): Promise<PredictiveSuggestion[]> {
    let query = supabase
      .from('predictive_suggestions')
      .select('*');

    if (filter?.status) {
      query = query.eq('status', filter.status);
    } else {
      query = query.eq('status', 'pending');
    }

    if (filter?.priority) {
      query = query.eq('priority', filter.priority);
    }

    query = query
      .order('priority', { ascending: true })
      .order('approval_probability', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(filter?.limit || 20);

    const { data, error } = await query;
    if (error) {
      throw new Error(`Falha ao listar sugestões do segundo cérebro: ${error.message}`);
    }

    return (data || []) as PredictiveSuggestion[];
  }
}

export const founderMemory = new FounderMemoryService();
