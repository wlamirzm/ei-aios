// ==============================================================================
// FINOPS COST & USAGE LEDGER ENGINE (AG-011 CFO DIGITAL)
// Sprint 6 S6-02: Deterministic, Append-Only & Idempotent AI Cost Ledger
// ==============================================================================

import { randomUUID } from 'node:crypto';
import {
  CostCategory,
  CostReliabilityTier,
  FinopsLedgerEntry,
  FinopsReconciliationSummary,
  ModelPricingItem,
  ModelPricingMatrix
} from '@ei-aios/shared';
import { AgentRunRecordInput } from './finops-calculator.js';

// ==============================================================================
// 1. MATRIZ OFICIAL VERSIONADA DE PREÇOS (USD por 1.000.000 de tokens)
// ==============================================================================

export const DEFAULT_MODEL_PRICING_MATRIX_V2026_11: ModelPricingMatrix = {
  versionId: 'v2026.11',
  name: 'Tabela Oficial Gemini & Argon v2026.11',
  effectiveDate: '2026-11-01T00:00:00.000Z',
  notes: 'Tabela de preços de produção para modelos Gemini 3.x, 2.x e Argon 4.',
  models: {
    'gemini-3.5-flash-lite': { inputUsdPerMillion: 0.075, outputUsdPerMillion: 0.30, currency: 'USD' },
    'gemini-3.1-flash-lite': { inputUsdPerMillion: 0.075, outputUsdPerMillion: 0.30, currency: 'USD' },
    'gemini-3.8-flash':      { inputUsdPerMillion: 0.150, outputUsdPerMillion: 0.60, currency: 'USD' },
    'gemini-4-argon':        { inputUsdPerMillion: 1.250, outputUsdPerMillion: 5.00, currency: 'USD' },
    'gemini-2.5-flash':      { inputUsdPerMillion: 0.150, outputUsdPerMillion: 0.60, currency: 'USD' },
    'gemini-2.5-pro':        { inputUsdPerMillion: 1.250, outputUsdPerMillion: 5.00, currency: 'USD' },
    'gemini-2.0-flash':      { inputUsdPerMillion: 0.100, outputUsdPerMillion: 0.40, currency: 'USD' },
    'gemini-1.5-pro':        { inputUsdPerMillion: 1.250, outputUsdPerMillion: 5.00, currency: 'USD' }
  }
};

/**
 * Localiza a precificação correspondente ao modelo solicitado dentro da matriz.
 * Realiza match exato ou busca pelo prefixo canônico do modelo.
 */
export function resolveModelPricing(
  modelName: string,
  matrix: ModelPricingMatrix = DEFAULT_MODEL_PRICING_MATRIX_V2026_11
): ModelPricingItem | null {
  if (!modelName || typeof modelName !== 'string') return null;

  // 1. Busca correspondência exata
  if (matrix.models[modelName]) {
    return matrix.models[modelName];
  }

  // 2. Busca por substring normalizada
  const normalized = modelName.toLowerCase();
  for (const [key, item] of Object.entries(matrix.models)) {
    if (normalized.includes(key.toLowerCase()) || key.toLowerCase().includes(normalized)) {
      return item;
    }
  }

  return null;
}

// ==============================================================================
// 2. OPÇÕES DE CONCILIAÇÃO E INTERFACES AUXILIARES
// ==============================================================================

export interface ReconcileOptions {
  pricingMatrix?: ModelPricingMatrix;
  usdToBrlRate?: number;
  batchId?: string;
  allowReprocess?: boolean;
  reconciledAt?: string;
}

export interface ClientCostSummary {
  clientId: string;
  totalRuns: number;
  totalTokensIn: number;
  totalTokensOut: number;
  costUsd: number;
  costBrl: number;
}

export interface AgentCostSummary {
  agentId: string;
  totalRuns: number;
  totalTokensIn: number;
  totalTokensOut: number;
  costUsd: number;
  costBrl: number;
}

// Helpers numéricos de alta precisão
const round6 = (n: number): number => Math.round(n * 1_000_000) / 1_000_000;
const round4 = (n: number): number => Math.round(n * 10_000) / 10_000;
const round2 = (n: number): number => Math.round(n * 100) / 100;

// ==============================================================================
// 3. MOTOR CENTRAL DO LEDGER (FinopsLedgerEngine)
// ==============================================================================

export class FinopsLedgerEngine {
  private ledgerStore: Map<string, FinopsLedgerEntry> = new Map();

  constructor(initialEntries?: FinopsLedgerEntry[]) {
    if (initialEntries && Array.isArray(initialEntries)) {
      for (const entry of initialEntries) {
        this.ledgerStore.set(entry.run_id, { ...entry });
      }
    }
  }

  /**
   * Limpa o repositório em memória (útil para testes isolados).
   */
  public clear(): void {
    this.ledgerStore.clear();
  }

  /**
   * Retorna todas as entradas atuais do ledger em memória.
   */
  public getAllEntries(): FinopsLedgerEntry[] {
    return Array.from(this.ledgerStore.values());
  }

  /**
   * Retorna uma entrada do ledger a partir do run_id.
   */
  public getEntryByRunId(runId: string): FinopsLedgerEntry | undefined {
    return this.ledgerStore.get(runId);
  }

  /**
   * RF-02 & RF-07: Calcula deterministamente o custo de uma execução.
   * Não inventa números se os tokens ou modelo não existirem.
   */
  public calculateRunCost(
    run: AgentRunRecordInput,
    matrix: ModelPricingMatrix = DEFAULT_MODEL_PRICING_MATRIX_V2026_11,
    usdToBrlRate = 5.8
  ): {
    costUsd: number | null;
    costBrl: number | null;
    tier: CostReliabilityTier;
    notes?: string;
  } {
    // 1. Verificação de tokens presentes
    const hasTokens =
      run.input_tokens !== null &&
      run.input_tokens !== undefined &&
      run.output_tokens !== null &&
      run.output_tokens !== undefined;

    if (!hasTokens) {
      return {
        costUsd: null,
        costBrl: null,
        tier: 'incomplete',
        notes: 'Tokens de entrada ou saída não registrados na execução.'
      };
    }

    const inTokens = Number(run.input_tokens);
    const outTokens = Number(run.output_tokens);

    if (isNaN(inTokens) || isNaN(outTokens) || inTokens < 0 || outTokens < 0) {
      return {
        costUsd: null,
        costBrl: null,
        tier: 'incomplete',
        notes: 'Contagem de tokens inválida ou negativa.'
      };
    }

    // 2. Verificação de preço de modelo
    const pricing = resolveModelPricing(run.model_name, matrix);
    if (!pricing) {
      return {
        costUsd: null,
        costBrl: null,
        tier: 'incomplete',
        notes: `Modelo '${run.model_name}' não possui precificação cadastrada na matriz ${matrix.versionId}.`
      };
    }

    // 3. Cálculo matemático exato
    const inCostUsd = (inTokens / 1_000_000) * pricing.inputUsdPerMillion;
    const outCostUsd = (outTokens / 1_000_000) * pricing.outputUsdPerMillion;
    const totalUsd = round6(inCostUsd + outCostUsd);
    const totalBrl = round4(totalUsd * usdToBrlRate);

    return {
      costUsd: totalUsd,
      costBrl: totalBrl,
      tier: 'estimated'
    };
  }

  /**
   * RF-03: Segregação rigorosa de categorias de custo.
   */
  public classifyCategory(run: AgentRunRecordInput): CostCategory {
    if (run.client_id) {
      return 'client_attributable';
    }
    if (run.is_internal) {
      return 'platform_internal';
    }
    // Sem client_id e sem is_internal
    if (run.is_internal === undefined || run.is_internal === null) {
      return 'unattributed_legacy';
    }
    return 'unattributed_orphan';
  }

  /**
   * RF-04 & RF-06: Gera uma entrada única, padronizada e imutável para o ledger.
   */
  public createLedgerEntry(
    run: AgentRunRecordInput,
    options?: ReconcileOptions
  ): FinopsLedgerEntry {
    const matrix = options?.pricingMatrix || DEFAULT_MODEL_PRICING_MATRIX_V2026_11;
    const rate = options?.usdToBrlRate || 5.8;
    const nowIso = options?.reconciledAt || new Date().toISOString();

    const category = this.classifyCategory(run);
    const calc = this.calculateRunCost(run, matrix, rate);

    // Ajusta a confiabilidade final
    let reliabilityTier: CostReliabilityTier = calc.tier;
    if (calc.tier !== 'incomplete') {
      if (category === 'unattributed_legacy' || category === 'unattributed_orphan') {
        reliabilityTier = 'unattributed';
      } else {
        reliabilityTier = 'estimated';
      }
    }

    // RF-06: Detecção de divergências entre o custo salvo no run e o recalculado
    let divergenceNotes: string | null = null;
    if (calc.notes) {
      divergenceNotes = calc.notes;
    } else if (
      run.cost_estimate !== null &&
      run.cost_estimate !== undefined &&
      calc.costUsd !== null
    ) {
      const origCost = Number(run.cost_estimate);
      const diff = Math.abs(origCost - calc.costUsd);
      if (diff > 0.0001) {
        divergenceNotes = `Divergência detectada: cost_estimate original era US$ ${origCost.toFixed(6)}, recalculado pela matriz ${matrix.versionId} é US$ ${calc.costUsd.toFixed(6)} (diferença: US$ ${diff.toFixed(6)}).`;
      }
    }

    return {
      id: randomUUID(),
      run_id: run.id,
      task_id: run.task_id || null,
      agent_id: run.agent_id,
      client_id: run.client_id || null,
      consumer_unit_id: run.consumer_unit_id || null,
      execution_id: run.execution_id || null,
      model_name: run.model_name,
      input_tokens: run.input_tokens !== undefined ? run.input_tokens : null,
      output_tokens: run.output_tokens !== undefined ? run.output_tokens : null,
      pricing_version: matrix.versionId,
      cost_usd: calc.costUsd,
      cost_brl: calc.costBrl,
      exchange_rate: rate,
      reliability_tier: reliabilityTier,
      category,
      origin: (run.metadata?.origin as string) || (run.is_internal ? 'platform_internal' : 'client_pipeline'),
      run_created_at: run.created_at || null,
      reconciled_at: nowIso,
      is_reprocessed: false,
      divergence_notes: divergenceNotes,
      metadata: {
        ...(run.metadata || {}),
        batch_id: options?.batchId || 'default_batch'
      }
    };
  }

  /**
   * RF-01 & RF-05: Rotina de conciliação determinística e idempotente de execuções.
   */
  public reconcileRuns(
    runs: AgentRunRecordInput[],
    options?: ReconcileOptions
  ): FinopsReconciliationSummary {
    const matrix = options?.pricingMatrix || DEFAULT_MODEL_PRICING_MATRIX_V2026_11;
    const rate = options?.usdToBrlRate || 5.8;
    const nowIso = options?.reconciledAt || new Date().toISOString();
    const batchId = options?.batchId || `batch_${randomUUID()}`;
    const allowReprocess = options?.allowReprocess ?? false;

    let newCount = 0;
    let reprocessedCount = 0;
    let skippedCount = 0;

    for (const run of runs) {
      if (!run.id) continue;

      const existing = this.ledgerStore.get(run.id);

      if (existing) {
        if (allowReprocess) {
          // RF-05 & RF-06: Reprocessamento auditado sem duplicar registros
          const updatedEntry = this.createLedgerEntry(run, {
            ...options,
            batchId,
            reconciledAt: nowIso
          });
          updatedEntry.id = existing.id; // Preserva o ID original do lançamento
          updatedEntry.is_reprocessed = true;
          this.ledgerStore.set(run.id, updatedEntry);
          reprocessedCount++;
        } else {
          // RF-05: Idempotência estrita — ignora runs já conciliados sem duplicar
          skippedCount++;
        }
      } else {
        const newEntry = this.createLedgerEntry(run, {
          ...options,
          batchId,
          reconciledAt: nowIso
        });
        this.ledgerStore.set(run.id, newEntry);
        newCount++;
      }
    }

    // Calcula sumário consolidado a partir do estado atualizado
    return this.generateSummary(batchId, matrix.versionId, rate, nowIso, {
      totalProcessed: runs.length,
      newEntriesCount: newCount,
      reprocessedEntriesCount: reprocessedCount,
      skippedDuplicateCount: skippedCount
    });
  }

  /**
   * RF-06: Gera o sumário consolidado de conciliação.
   */
  public generateSummary(
    batchId: string,
    pricingVersion: string,
    exchangeRate: number,
    reconciledAt: string,
    counts: {
      totalProcessed: number;
      newEntriesCount: number;
      reprocessedEntriesCount: number;
      skippedDuplicateCount: number;
    }
  ): FinopsReconciliationSummary {
    const all = Array.from(this.ledgerStore.values());

    const byCat = {
      client_attributable: { count: 0, cost_usd: 0, cost_brl: 0 },
      platform_internal:   { count: 0, cost_usd: 0, cost_brl: 0 },
      unattributed_legacy: { count: 0, cost_usd: 0, cost_brl: 0 },
      unattributed_orphan: { count: 0, cost_usd: 0, cost_brl: 0 }
    };

    const byTier = {
      measured: 0,
      estimated: 0,
      reconciled: 0,
      incomplete: 0,
      unattributed: 0
    };

    const byClient: Record<string, { count: number; cost_usd: number; cost_brl: number }> = {};
    const byAgent: Record<string, { count: number; cost_usd: number; cost_brl: number }> = {};

    let totalTokensIn = 0;
    let totalTokensOut = 0;
    let totalUsd = 0;
    let totalBrl = 0;

    for (const e of all) {
      const usd = e.cost_usd || 0;
      const brl = e.cost_brl || 0;
      const tokIn = e.input_tokens || 0;
      const tokOut = e.output_tokens || 0;

      totalUsd += usd;
      totalBrl += brl;
      totalTokensIn += tokIn;
      totalTokensOut += tokOut;

      // Categoria
      const catBucket = byCat[e.category];
      if (catBucket) {
        catBucket.count++;
        catBucket.cost_usd = round4(catBucket.cost_usd + usd);
        catBucket.cost_brl = round2(catBucket.cost_brl + brl);
      }

      // Tier de confiabilidade
      if (byTier[e.reliability_tier] !== undefined) {
        byTier[e.reliability_tier]++;
      }

      // Por cliente
      if (e.client_id) {
        let clientBucket = byClient[e.client_id];
        if (!clientBucket) {
          clientBucket = { count: 0, cost_usd: 0, cost_brl: 0 };
          byClient[e.client_id] = clientBucket;
        }
        clientBucket.count++;
        clientBucket.cost_usd = round4(clientBucket.cost_usd + usd);
        clientBucket.cost_brl = round2(clientBucket.cost_brl + brl);
      }

      // Por agente
      const ag = e.agent_id || 'UNKNOWN';
      let agentBucket = byAgent[ag];
      if (!agentBucket) {
        agentBucket = { count: 0, cost_usd: 0, cost_brl: 0 };
        byAgent[ag] = agentBucket;
      }
      agentBucket.count++;
      agentBucket.cost_usd = round4(agentBucket.cost_usd + usd);
      agentBucket.cost_brl = round2(agentBucket.cost_brl + brl);
    }

    return {
      batch_id: batchId,
      reconciled_at: reconciledAt,
      pricing_version: pricingVersion,
      exchange_rate: exchangeRate,
      total_processed: counts.totalProcessed,
      new_entries_count: counts.newEntriesCount,
      reprocessed_entries_count: counts.reprocessedEntriesCount,
      skipped_duplicate_count: counts.skippedDuplicateCount,
      by_category: byCat,
      by_reliability_tier: byTier,
      by_client: byClient,
      by_agent: byAgent,
      total_tokens: {
        input: totalTokensIn,
        output: totalTokensOut,
        combined: totalTokensIn + totalTokensOut
      },
      total_cost_usd: round4(totalUsd),
      total_cost_brl: round2(totalBrl)
    };
  }

  /**
   * RF-03: Extrai exclusivamente os custos de um cliente para alimentar o AG-011.
   * Garante isolamento absoluto de tenant sem contaminação por outros clientes ou plataforma.
   */
  public getClientCostSummary(clientId: string): ClientCostSummary {
    const entries = Array.from(this.ledgerStore.values()).filter(
      (e) => e.client_id === clientId && e.category === 'client_attributable'
    );

    let inTok = 0;
    let outTok = 0;
    let usd = 0;
    let brl = 0;

    for (const e of entries) {
      inTok += e.input_tokens || 0;
      outTok += e.output_tokens || 0;
      usd += e.cost_usd || 0;
      brl += e.cost_brl || 0;
    }

    return {
      clientId,
      totalRuns: entries.length,
      totalTokensIn: inTok,
      totalTokensOut: outTok,
      costUsd: round4(usd),
      costBrl: round2(brl)
    };
  }
}
