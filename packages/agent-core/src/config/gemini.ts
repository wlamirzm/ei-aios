// ==============================================================================
// GEMINI WRAPPER WITH AUTOMATIC TELEMETRY & FINOPS TRACKING
// ==============================================================================

import { GoogleGenAI } from '@google/genai';
import { env } from './env.js';
import { supabase } from './supabase.js';

export interface GeminiCallParams {
  taskId: string;
  agentId: string;
  model?: string;
  systemInstruction?: string;
  prompt: string;
  temperature?: number;
  responseSchema?: Record<string, any>;
  files?: Array<{ mimeType: string; data: string }>; // base64
}

export interface GeminiCallResult<T = any> {
  data: T;
  rawText: string;
  inputTokens: number;
  outputTokens: number;
  executionTimeMs: number;
  costEstimateUsd: number;
  modelUsed: string;
}

// Preços por 1 milhão de tokens (USD)
const PRICING_PER_MILLION = {
  'gemini-2.5-flash': { input: 0.15, output: 0.60 },
  'gemini-2.0-flash': { input: 0.10, output: 0.40 },
  'gemini-2.5-pro': { input: 1.25, output: 5.00 },
  'gemini-1.5-pro': { input: 1.25, output: 5.00 }
};

export function estimateTokenCost(modelName: string, inputTokens: number, outputTokens: number): number {
  const modelKey = Object.keys(PRICING_PER_MILLION).find(k => modelName.includes(k)) || 'gemini-2.5-flash';
  const pricing = PRICING_PER_MILLION[modelKey as keyof typeof PRICING_PER_MILLION] || PRICING_PER_MILLION['gemini-2.5-flash'];
  
  const inputCost = (inputTokens / 1_000_000) * pricing.input;
  const outputCost = (outputTokens / 1_000_000) * pricing.output;
  return Math.round((inputCost + outputCost) * 1_000_000) / 1_000_000;
}

export class GeminiService {
  private client: GoogleGenAI | null = null;

  constructor() {
    if (env.GEMINI_API_KEY && env.GEMINI_API_KEY !== 'mock-key-for-dev') {
      try {
        this.client = new GoogleGenAI({ apiKey: env.GEMINI_API_KEY });
      } catch (err) {
        console.warn('[GeminiService] Failed to initialize GoogleGenAI client:', err);
      }
    }
  }

  /**
   * Executa chamada estruturada ao Gemini com telemetria e gravação automática em agent_runs.
   */
  async generateStructuredContent<T = any>(params: GeminiCallParams): Promise<GeminiCallResult<T>> {
    const startTime = Date.now();
    const model = params.model || env.GEMINI_DEFAULT_FAST_MODEL;
    let inputTokens = 0;
    let outputTokens = 0;
    let rawText = '';
    let parsedData: T;
    let callStatus: 'success' | 'error' = 'success';
    let errorMessage: string | null = null;

    try {
      if (!this.client || env.GEMINI_API_KEY === 'mock-key-for-dev') {
        // Fallback / Dev Mock mode
        console.warn(`[GeminiService] Running in DEV/MOCK mode for ${params.agentId} on model ${model}`);
        inputTokens = Math.max(120, Math.round(params.prompt.length / 4));
        outputTokens = 250;
        
        // Simulação de resposta JSON baseada no agente
        rawText = JSON.stringify(this.generateMockResponse(params));
        parsedData = JSON.parse(rawText) as T;
      } else {
        const contents: any[] = [];

        if (params.files && params.files.length > 0) {
          for (const file of params.files) {
            contents.push({
              inlineData: {
                mimeType: file.mimeType,
                data: file.data
              }
            });
          }
        }

        contents.push(params.prompt);

        const config: any = {
          temperature: params.temperature ?? 0.1,
          responseMimeType: 'application/json'
        };

        if (params.systemInstruction) {
          config.systemInstruction = params.systemInstruction;
        }

        if (params.responseSchema) {
          config.responseSchema = params.responseSchema;
        }

        const response = await this.client.models.generateContent({
          model,
          contents,
          config
        });

        rawText = response.text || '{}';
        parsedData = JSON.parse(rawText) as T;

        if (response.usageMetadata) {
          inputTokens = response.usageMetadata.promptTokenCount || 0;
          outputTokens = response.usageMetadata.candidatesTokenCount || 0;
        } else {
          inputTokens = Math.round(params.prompt.length / 4);
          outputTokens = Math.round(rawText.length / 4);
        }
      }
    } catch (err: any) {
      callStatus = 'error';
      errorMessage = err?.message || 'Erro desconhecido na execução Gemini';
      console.error(`[GeminiService] Error calling model ${model}:`, err);
      throw err;
    } finally {
      const executionTimeMs = Date.now() - startTime;
      const costEstimateUsd = estimateTokenCost(model, inputTokens, outputTokens);

      // Gravação na tabela agent_runs
      try {
        await supabase.from('agent_runs').insert({
          task_id: params.taskId,
          agent_id: params.agentId,
          model_provider: 'google',
          model_name: model,
          input_tokens: inputTokens,
          output_tokens: outputTokens,
          execution_time_ms: executionTimeMs,
          cost_estimate: costEstimateUsd,
          status: callStatus,
          error_message: errorMessage
        });
      } catch (dbErr) {
        console.error('[GeminiService] Failed to record agent_run telemetry to Supabase:', dbErr);
      }
    }

    const executionTimeMs = Date.now() - startTime;
    const costEstimateUsd = estimateTokenCost(model, inputTokens, outputTokens);

    return {
      data: parsedData!,
      rawText,
      inputTokens,
      outputTokens,
      executionTimeMs,
      costEstimateUsd,
      modelUsed: model
    };
  }

  /**
   * Conversação direta e interativa com qualquer um dos 11 agentes.
   */
  async chatWithAgent(params: {
    agentId: string;
    systemInstruction: string;
    message: string;
    history?: Array<{ role: 'user' | 'model'; text: string }>;
    model?: string;
  }): Promise<{ reply: string; tokensUsed: number; costEstimateUsd: number }> {
    const startTime = Date.now();
    const model = params.model || env.GEMINI_DEFAULT_FAST_MODEL;
    let inputTokens = 0;
    let outputTokens = 0;
    let reply = '';

    try {
      if (!this.client || env.GEMINI_API_KEY === 'mock-key-for-dev') {
        reply = `[${params.agentId}] Olá! Sou o ${params.agentId}. Recebi sua mensagem: "${params.message}". O sistema está 100% pronto e operacional para analisar o mercado de energia, faturas e auditoria ANEEL!`;
        inputTokens = Math.max(50, Math.round(params.message.length / 4));
        outputTokens = Math.round(reply.length / 4);
      } else {
        const contents: any[] = [];
        if (params.history && params.history.length > 0) {
          for (const item of params.history) {
            contents.push({
              role: item.role === 'model' ? 'model' : 'user',
              parts: [{ text: item.text }]
            });
          }
        }
        contents.push({
          role: 'user',
          parts: [{ text: params.message }]
        });

        const response = await this.client.models.generateContent({
          model,
          contents,
          config: {
            systemInstruction: params.systemInstruction,
            temperature: 0.3
          }
        });

        reply = response.text || 'Sem resposta do modelo.';
        if (response.usageMetadata) {
          inputTokens = response.usageMetadata.promptTokenCount || 0;
          outputTokens = response.usageMetadata.candidatesTokenCount || 0;
        } else {
          inputTokens = Math.round(params.message.length / 4);
          outputTokens = Math.round(reply.length / 4);
        }
      }
    } catch (err: any) {
      console.error(`[GeminiService.chatWithAgent] Error:`, err);
      reply = `Desculpe, ocorreu um erro ao processar sua mensagem: ${err?.message || err}`;
    }

    const executionTimeMs = Date.now() - startTime;
    const costEstimateUsd = estimateTokenCost(model, inputTokens, outputTokens);

    try {
      await supabase.from('agent_runs').insert({
        agent_id: params.agentId,
        model_provider: 'google',
        model_name: model,
        input_tokens: inputTokens,
        output_tokens: outputTokens,
        execution_time_ms: executionTimeMs,
        cost_estimate: costEstimateUsd,
        status: 'success'
      });
    } catch (err) {
      console.warn('[GeminiService] Could not log chat telemetry:', err);
    }

    return {
      reply,
      tokensUsed: inputTokens + outputTokens,
      costEstimateUsd
    };
  }

  private generateMockResponse(params: GeminiCallParams): Record<string, any> {
    if (params.agentId === 'AG-001') {
      return {
        macro_objective: params.prompt,
        reasoning_summary: 'Decomposição inicial automática estruturada pelo AG-001 em modo desenvolvimento.',
        estimated_complexity: 'medium',
        requires_human_gate: true,
        decomposed_tasks: [
          {
            task_code: 'SUBTASK-001',
            assigned_agent_id: 'AG-003',
            objective: 'Executar diagnóstico energético e cálculo determinístico.',
            task_type: 'energy_diagnosis',
            priority: 'P1',
            risk_level: 'LEVEL_0_AUTO',
            dependencies_task_codes: [],
            input_payload: {},
            requires_approval: false
          },
          {
            task_code: 'SUBTASK-002',
            assigned_agent_id: 'AG-007',
            objective: 'Elaborar proposta comercial com base no diagnóstico auditado.',
            task_type: 'sales_proposal',
            priority: 'P1',
            risk_level: 'LEVEL_2_APPROVAL_REQUIRED',
            dependencies_task_codes: ['SUBTASK-001'],
            input_payload: {},
            requires_approval: true,
            approval_reason: 'Envio de proposta financeira ao cliente'
          }
        ]
      };
    }

    if (params.agentId === 'AG-008') {
      return {
        approved: true,
        confidence_score: 0.95,
        critical_inconsistencies: [],
        traceability_check: {
          has_deterministic_math_backing: true,
          calculation_memory_present: true
        },
        safety_compliance: {
          no_false_guarantees: true,
          assumptions_declared: true,
          limitations_explicit: true,
          aneel_ren_1000_compliant: true,
          lgpd_compliant: true
        },
        risk_level_evaluated: 'LEVEL_0_AUTO',
        requires_human_approval: false,
        audit_verdict: 'Entregável em plena conformidade com as diretrizes regulatórias e matemáticas da ANEEL.'
      };
    }

    return {
      status: 'mock_completed',
      agent: params.agentId,
      message: 'Execução mock de desenvolvimento gerada com sucesso.',
      timestamp: new Date().toISOString()
    };
  }
}

export const geminiService = new GeminiService();

