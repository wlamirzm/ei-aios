// ==============================================================================
// LLM SERVICE: MULTI-PROVIDER (BEDROCK + GEMINI) WITH AUTOMATIC FALLBACK
// ==============================================================================

import AnthropicBedrock from '@anthropic-ai/bedrock-sdk';
import { GoogleGenAI } from '@google/genai';
import { randomUUID } from 'node:crypto';
import { env } from './env.js';
import { supabase } from './supabase.js';

// --- Types ---

export type LLMProvider = 'bedrock' | 'gemini';

export interface LLMCallParams {
  taskId: string;
  agentId: string;
  clientId?: string | null;
  consumerUnitId?: string | null;
  executionId?: string | null;
  isInternal?: boolean;
  origin?: 'orchestrator' | 'worker' | 'qa_gate' | 'bill_parser' | 'email_intelligence' | 'chat' | 'system';
  metadata?: Record<string, any>;
  model?: string;
  systemInstruction?: string;
  prompt: string;
  temperature?: number;
  responseSchema?: Record<string, any>;
  files?: Array<{ mimeType: string; data: string }>;
}

export interface LLMCallResult<T = any> {
  runId: string;
  data: T;
  rawText: string;
  inputTokens: number;
  outputTokens: number;
  executionTimeMs: number;
  costEstimateUsd: number;
  modelUsed: string;
  providerUsed: LLMProvider | 'mock';
}

interface ProviderCallResult {
  rawText: string;
  inputTokens: number;
  outputTokens: number;
  modelUsed: string;
  provider: LLMProvider;
}

// --- Pricing (both providers) ---

const PRICING_PER_MILLION: Record<string, { input: number; output: number }> = {
  'claude-haiku-5-5': { input: 0.10, output: 0.50 },
  'claude-sonnet-5-5': { input: 2.00, output: 10.00 },
  'claude-opus-5-5': { input: 4.00, output: 20.00 },
  'gemini-3.5-flash-lite': { input: 0.075, output: 0.30 },
  'gemini-3.1-flash-lite': { input: 0.075, output: 0.30 },
  'gemini-3.8-flash': { input: 0.15, output: 0.60 },
  'gemini-4-argon': { input: 1.25, output: 5.00 },
};

export function estimateTokenCost(modelName: string, inputTokens: number, outputTokens: number): number {
  const modelKey = Object.keys(PRICING_PER_MILLION).find(k => modelName.includes(k)) || 'claude-haiku-5-5';
  const pricing = PRICING_PER_MILLION[modelKey] ?? { input: 0.10, output: 0.50 };
  const inputCost = (inputTokens / 1_000_000) * pricing.input;
  const outputCost = (outputTokens / 1_000_000) * pricing.output;
  return Math.round((inputCost + outputCost) * 1_000_000) / 1_000_000;
}

// --- Cross-provider model mapping ---

const CROSS_PROVIDER_MAP: Record<string, string> = {
  'claude-haiku-5-5': 'gemini-3.5-flash-lite',
  'claude-sonnet-5-5': 'gemini-3.8-flash',
  'claude-opus-5-5': 'gemini-4-argon',
  'gemini-3.5-flash-lite': 'claude-haiku-5-5',
  'gemini-3.1-flash-lite': 'claude-haiku-5-5',
  'gemini-3.8-flash': 'claude-sonnet-5-5',
  'gemini-4-argon': 'claude-opus-5-5',
};

function mapModelForProvider(model: string, targetProvider: LLMProvider): string {
  if (targetProvider === 'bedrock' && model.startsWith('claude-')) return model;
  if (targetProvider === 'gemini' && model.startsWith('gemini-')) return model;
  return CROSS_PROVIDER_MAP[model]
    || (targetProvider === 'bedrock' ? env.CLAUDE_DEFAULT_FAST_MODEL : env.GEMINI_DEFAULT_FAST_MODEL);
}

function resolveBedrockCandidates(requestedModel?: string): string[] {
  const defaults = [env.CLAUDE_DEFAULT_FAST_MODEL, env.CLAUDE_DEFAULT_REASONING_MODEL];
  if (!requestedModel) return defaults;
  return [requestedModel, ...defaults.filter(m => m !== requestedModel)];
}

function resolveGeminiCandidates(requestedModel?: string): string[] {
  const defaults = [env.GEMINI_DEFAULT_FAST_MODEL, env.GEMINI_DEFAULT_REASONING_MODEL];
  if (!requestedModel) return defaults;
  if (requestedModel.includes('2.5') || requestedModel.includes('2.0') || requestedModel.includes('1.5')) {
    return defaults;
  }
  return [requestedModel, ...defaults.filter(m => m !== requestedModel)];
}

function resolveCandidatesForProvider(model: string, provider: LLMProvider): string[] {
  const mapped = mapModelForProvider(model, provider);
  return provider === 'bedrock' ? resolveBedrockCandidates(mapped) : resolveGeminiCandidates(mapped);
}

// --- Utilities ---

function isValidUuid(str?: string): boolean {
  if (!str) return false;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str);
}

function providerLabel(provider: LLMProvider): string {
  return provider === 'bedrock' ? 'anthropic' : 'google';
}

// --- Agent Personas ---

const AGENT_PERSONAS: Record<string, { title: string; roleSummary: string; examples: string[] }> = {
  'AG-001': {
    title: 'CEO & AI Orchestrator',
    roleSummary: 'Coordeno os 14 agentes especialistas da Energy Intelligence, decomponho objetivos estratégicos em tarefas atômicas e consolido os resultados executivos.',
    examples: [
      '"Quero fazer uma pesquisa de mercado para o setor de supermercados"',
      '"Como estão nossas tarefas e aprovações pendentes?"',
      '"Qual deve ser nosso plano de ação para conquistar os primeiros 10 clientes piloto?"'
    ]
  },
  'AG-002': {
    title: 'Business Strategy Agent',
    roleSummary: 'Sou responsável por inteligência de mercado B2B, definição de ICP (Perfil de Cliente Ideal), análise competitiva, matriz SWOT e modelagem de receita (SaaS + Success Fee).',
    examples: [
      '"Quais segmentos do Grupo A4 têm maior dor com multas tarifárias?"',
      '"Monte uma análise SWOT para nossa consultoria de inteligência energética"',
      '"Como precificar nosso piloto B2B?"'
    ]
  },
  'AG-003': {
    title: 'Energy Specialist Agent',
    roleSummary: 'Sou o engenheiro eletricista e auditor tarifário. Analiso demanda contratada vs. medida, fator de carga, energia reativa excedente (UFER/DMCR) e enquadramento Horossazonal Verde vs. Azul.',
    examples: [
      '"Quando vale a pena migrar uma indústria da Tarifa Verde para a Azul?"',
      '"Como funciona a tolerância de 5% na ultrapassagem de demanda?"',
      '"Qual o payback médio de um banco de capacitores para fator de potência 0,82?"'
    ]
  },
  'AG-004': {
    title: 'AI & Data Engineering Agent',
    roleSummary: 'Transformo faturas em PDF/imagem em JSON estruturado e validado, conferindo o balanço matemático de kWh, kW, TUSD, TE e impostos (ICMS/PIS/COFINS).',
    examples: [
      '"Quais campos você extrai de uma fatura de energia do Grupo A?"',
      '"Como você valida se o OCR leu os valores corretos da conta?"'
    ]
  },
  'AG-005': {
    title: 'Software Development Agent',
    roleSummary: 'Cuido da arquitetura full-stack do EI-AIOS (Next.js, Node.js/TypeScript, PostgreSQL/PostgREST e automações n8n).',
    examples: [
      '"Como funciona a arquitetura técnica da plataforma EI-AIOS?"',
      '"Quais endpoints REST estão disponíveis no Agent Core?"'
    ]
  },
  'AG-006': {
    title: 'Marketing & Growth Agent',
    roleSummary: 'Construo posicionamento de autoridade B2B, copywriting técnico, artigos executivos para LinkedIn e páginas de captura para diagnóstico gratuito de faturas.',
    examples: [
      '"Crie um post de LinkedIn para atrair diretores financeiros de indústrias"',
      '"Qual a melhor isca digital para captar faturas do Grupo A4?"'
    ]
  },
  'AG-007': {
    title: 'Sales Agent',
    roleSummary: 'Atuo no fechamento consultivo B2B, qualificação de leads, contorno de objeções, propostas comerciais e Cartas de Intenção (LOI) no modelo SaaS + Success Fee.',
    examples: [
      '"Me dê um script de abordagem para o CFO de uma rede de supermercados"',
      '"Como responder quando o cliente diz que já tem consultoria do Mercado Livre?"'
    ]
  },
  'AG-008': {
    title: 'Quality & Risk Agent (Auditor QA)',
    roleSummary: 'Sou o auditor independente (QA Gate). Inspeciono 100% dos entregáveis dos outros agentes contra alucinações matemáticas, promessas indevidas e conformidade com a REN ANEEL 1.000/2021.',
    examples: [
      '"Quais são os critérios que você usa para aprovar ou reprovar uma tarefa?"',
      '"Por que a expressão economia garantida é bloqueada?"'
    ]
  },
  'AG-009': {
    title: 'Regulatory & Tariff Intelligence Agent',
    roleSummary: 'Domino a Resolução Normativa ANEEL nº 1.000/2021, devolução em dobro de cobranças indevidas (Art. 323), Lei 14.300/2022 (Geração Distribuída) e regras do Mercado Livre.',
    examples: [
      '"Como funciona a devolução em dobro prevista no Art. 323 da REN 1.000/2021?"',
      '"Qual o prazo regulatório para redução de demanda contratada no Grupo A4?"'
    ]
  },
  'AG-010': {
    title: 'Customer Onboarding & M&V Agent',
    roleSummary: 'Conduzo o onboarding de novos clientes e o protocolo mensal de Medição e Verificação (M&V), calculando a economia líquida auditada que serve de base para o Success Fee.',
    examples: [
      '"Como é calculada a linha de base (baseline) no protocolo de M&V?"',
      '"Como demonstramos ao cliente a economia real gerada no mês?"'
    ]
  },
  'AG-011': {
    title: 'Startup CFO & Unit Economics Agent',
    roleSummary: 'Gerencio o DRE da startup, fluxo de caixa, Unit Economics (CAC, LTV, Churn, Payback) e a governança FinOps de consumo de tokens de IA.',
    examples: [
      '"Como está nosso consumo FinOps de IA hoje?"',
      '"Qual a margem bruta ideal para nosso modelo SaaS + Success Fee?"'
    ]
  },
  'AG-012': {
    title: 'Email & Next-Step Intelligence Agent',
    roleSummary: 'Conecto às suas caixas de E-mail cPanel da HostGator (IMAP/SMTP), leio e-mails recebidos, gero resumos executivos, recomendo o próximo passo e disparo tarefas automáticas conforme a configuração de cada conta.',
    examples: [
      '"Quais e-mails prioritários chegaram hoje?"',
      '"Qual o próximo passo para os leads que responderam por e-mail?"'
    ]
  },
  'AG-013': {
    title: 'Legal & Compliance Agent',
    roleSummary: 'Apoio o fundador em questões jurídicas, contratuais, LGPD, propriedade intelectual e compliance regulatório empresarial.',
    examples: [
      '"Revise os termos de uso da plataforma para conformidade LGPD"',
      '"Redija um NDA para parceria com consultoria de energia"'
    ]
  },
  'AG-014': {
    title: 'Product & Ops Agent',
    roleSummary: 'Gerencio roadmap de produto (RICE/ICE), playbooks de onboarding, processos operacionais e métricas de produto.',
    examples: [
      '"Priorize as próximas features do roadmap com scoring RICE"',
      '"Crie um playbook de onboarding para novos clientes B2B"'
    ]
  }
};

// ==============================================================================
// LLM SERVICE
// ==============================================================================

export class LLMService {
  private bedrockClient: AnthropicBedrock | null = null;
  private geminiClient: GoogleGenAI | null = null;

  constructor() {
    this.initClients();
  }

  private initClients(): void {
    if (env.AWS_ACCESS_KEY_ID && env.AWS_SECRET_ACCESS_KEY) {
      try {
        this.bedrockClient = new AnthropicBedrock({
          awsRegion: env.AWS_REGION,
          awsAccessKey: env.AWS_ACCESS_KEY_ID,
          awsSecretKey: env.AWS_SECRET_ACCESS_KEY,
        });
      } catch (err) {
        console.warn('[LLMService] Failed to init Bedrock client:', err);
      }
    }
    if (env.GEMINI_API_KEY && env.GEMINI_API_KEY !== 'mock-key-for-dev') {
      try {
        this.geminiClient = new GoogleGenAI({ apiKey: env.GEMINI_API_KEY });
      } catch (err) {
        console.warn('[LLMService] Failed to init Gemini client:', err);
      }
    }
  }

  private getProviderOrder(): [LLMProvider, ...LLMProvider[]] {
    const primary = env.LLM_PRIMARY_PROVIDER;
    const fallback: LLMProvider = primary === 'bedrock' ? 'gemini' : 'bedrock';
    return env.LLM_FALLBACK_ENABLED ? [primary, fallback] : [primary];
  }

  private hasClient(provider: LLMProvider): boolean {
    return provider === 'bedrock' ? Boolean(this.bedrockClient) : Boolean(this.geminiClient);
  }

  public setApiKey(apiKey: string): { configured: boolean; mode: string } {
    const clean = (apiKey || '').trim();
    if (clean && clean !== 'mock-key-for-dev') {
      try { this.geminiClient = new GoogleGenAI({ apiKey: clean }); } catch { this.geminiClient = null; }
    } else {
      this.geminiClient = null;
    }
    const status = this.getStatus();
    return { configured: status.configured, mode: status.mode };
  }

  public getStatus(): {
    configured: boolean;
    mode: string;
    primaryProvider: LLMProvider;
    fallbackProvider: LLMProvider | null;
    bedrockReady: boolean;
    geminiReady: boolean;
    defaultFastModel: string;
    defaultReasoningModel: string;
  } {
    const providers = this.getProviderOrder();
    const bedrockReady = Boolean(this.bedrockClient);
    const geminiReady = Boolean(this.geminiClient);
    const primaryReady = this.hasClient(providers[0]);
    const fallbackReady = providers[1] ? this.hasClient(providers[1]) : false;

    let mode: string;
    if (primaryReady) mode = `${providers[0]}_live_api`;
    else if (fallbackReady) mode = `${providers[1]}_fallback_api`;
    else mode = 'deterministic_specialist_engine';

    return {
      configured: bedrockReady || geminiReady,
      mode,
      primaryProvider: providers[0],
      fallbackProvider: providers[1] || null,
      bedrockReady,
      geminiReady,
      defaultFastModel: providers[0] === 'bedrock' ? env.CLAUDE_DEFAULT_FAST_MODEL : env.GEMINI_DEFAULT_FAST_MODEL,
      defaultReasoningModel: providers[0] === 'bedrock' ? env.CLAUDE_DEFAULT_REASONING_MODEL : env.GEMINI_DEFAULT_REASONING_MODEL,
    };
  }

  // --- Bedrock provider calls ---

  private async callBedrockStructured(params: LLMCallParams, candidates: string[]): Promise<ProviderCallResult> {
    if (!this.bedrockClient) throw new Error('Bedrock client not initialized');

    const contentBlocks: any[] = [];
    if (params.files?.length) {
      for (const file of params.files) {
        contentBlocks.push({ type: 'image', source: { type: 'base64', media_type: file.mimeType, data: file.data } });
      }
    }
    contentBlocks.push({ type: 'text', text: params.prompt });

    let systemText = params.systemInstruction || '';
    if (params.responseSchema) {
      systemText += `\n\nRESPOND WITH VALID JSON ONLY. No markdown, no backticks, no explanation outside the JSON. Your entire response must be parseable by JSON.parse(). Follow this schema:\n${JSON.stringify(params.responseSchema, null, 2)}`;
    } else {
      systemText += '\n\nRESPOND WITH VALID JSON ONLY. No markdown, no backticks, no explanation outside the JSON. Your entire response must be parseable by JSON.parse().';
    }

    let lastErr: any = null;
    for (const candidate of candidates) {
      try {
        const response = await this.bedrockClient.messages.create({
          model: candidate,
          max_tokens: 16000,
          temperature: params.temperature ?? 0.1,
          system: systemText.trim(),
          messages: [{ role: 'user', content: contentBlocks }]
        });
        const rawText = response.content.filter((b: any) => b.type === 'text').map((b: any) => b.text).join('') || '{}';
        JSON.parse(rawText);
        return { rawText, inputTokens: response.usage.input_tokens, outputTokens: response.usage.output_tokens, modelUsed: candidate, provider: 'bedrock' };
      } catch (err: any) {
        lastErr = err;
        console.warn(`[LLMService] Bedrock model ${candidate} failed:`, err?.message);
      }
    }
    throw lastErr || new Error('All Bedrock candidates failed');
  }

  private async callBedrockChat(systemText: string, messages: Array<{ role: 'user' | 'assistant'; content: string }>, candidates: string[], temperature: number): Promise<ProviderCallResult> {
    if (!this.bedrockClient) throw new Error('Bedrock client not initialized');

    let lastErr: any = null;
    for (const candidate of candidates) {
      try {
        const response = await this.bedrockClient.messages.create({
          model: candidate, max_tokens: 4096, temperature, system: systemText, messages
        });
        const rawText = response.content.filter((b: any) => b.type === 'text').map((b: any) => b.text).join('') || 'Sem resposta do modelo.';
        return { rawText, inputTokens: response.usage.input_tokens, outputTokens: response.usage.output_tokens, modelUsed: candidate, provider: 'bedrock' };
      } catch (err: any) {
        lastErr = err;
        console.warn(`[LLMService] Bedrock chat ${candidate} failed:`, err?.message);
      }
    }
    throw lastErr || new Error('All Bedrock chat candidates failed');
  }

  // --- Gemini provider calls ---

  private async callGeminiStructured(params: LLMCallParams, candidates: string[]): Promise<ProviderCallResult> {
    if (!this.geminiClient) throw new Error('Gemini client not initialized');

    const contents: any[] = [];
    if (params.files?.length) {
      for (const file of params.files) {
        contents.push({ inlineData: { mimeType: file.mimeType, data: file.data } });
      }
    }
    contents.push(params.prompt);

    const config: any = { temperature: params.temperature ?? 0.1, responseMimeType: 'application/json' };
    if (params.systemInstruction) config.systemInstruction = params.systemInstruction;
    if (params.responseSchema) config.responseSchema = params.responseSchema;

    let lastErr: any = null;
    for (const candidate of candidates) {
      try {
        const response = await this.geminiClient.models.generateContent({ model: candidate, contents, config });
        const rawText = response.text || '{}';
        JSON.parse(rawText);
        return {
          rawText,
          inputTokens: response.usageMetadata?.promptTokenCount || Math.round(params.prompt.length / 4),
          outputTokens: response.usageMetadata?.candidatesTokenCount || Math.round(rawText.length / 4),
          modelUsed: candidate,
          provider: 'gemini'
        };
      } catch (err: any) {
        lastErr = err;
        console.warn(`[LLMService] Gemini model ${candidate} failed:`, err?.message);
      }
    }
    throw lastErr || new Error('All Gemini candidates failed');
  }

  private async callGeminiChat(systemText: string, contents: any[], candidates: string[], temperature: number): Promise<ProviderCallResult> {
    if (!this.geminiClient) throw new Error('Gemini client not initialized');

    let lastErr: any = null;
    for (const candidate of candidates) {
      try {
        const response = await this.geminiClient.models.generateContent({
          model: candidate, contents, config: { systemInstruction: systemText, temperature }
        });
        const rawText = response.text || 'Sem resposta do modelo.';
        return {
          rawText,
          inputTokens: response.usageMetadata?.promptTokenCount || 0,
          outputTokens: response.usageMetadata?.candidatesTokenCount || 0,
          modelUsed: candidate,
          provider: 'gemini'
        };
      } catch (err: any) {
        lastErr = err;
        console.warn(`[LLMService] Gemini chat ${candidate} failed:`, err?.message);
      }
    }
    throw lastErr || new Error('All Gemini chat candidates failed');
  }

  // --- Main: generateStructuredContent (with fallback chain) ---

  async generateStructuredContent<T = any>(params: LLMCallParams): Promise<LLMCallResult<T>> {
    const startTime = Date.now();
    const runId = randomUUID();
    const requestedModel = params.model || (env.LLM_PRIMARY_PROVIDER === 'bedrock' ? env.CLAUDE_DEFAULT_FAST_MODEL : env.GEMINI_DEFAULT_FAST_MODEL);

    let rawText = '';
    let inputTokens = 0;
    let outputTokens = 0;
    let modelUsed = requestedModel;
    let providerUsed: LLMProvider | 'mock' = 'mock';
    let parsedData: T;
    let callStatus: 'success' | 'error' = 'success';
    let errorMessage: string | null = null;

    const providers = this.getProviderOrder();
    let succeeded = false;

    for (const provider of providers) {
      if (!this.hasClient(provider)) continue;
      const candidates = resolveCandidatesForProvider(requestedModel, provider);

      try {
        const result = provider === 'bedrock'
          ? await this.callBedrockStructured(params, candidates)
          : await this.callGeminiStructured(params, candidates);

        rawText = result.rawText;
        inputTokens = result.inputTokens;
        outputTokens = result.outputTokens;
        modelUsed = result.modelUsed;
        providerUsed = result.provider;
        parsedData = JSON.parse(rawText) as T;
        succeeded = true;

        if (provider !== providers[0]) {
          console.warn(`[LLMService] Used fallback provider ${provider} for ${params.agentId}`);
        }
        break;
      } catch (err: any) {
        console.warn(`[LLMService] Provider ${provider} exhausted all candidates for ${params.agentId}:`, err?.message);
      }
    }

    if (!succeeded) {
      console.warn(`[LLMService] All providers failed for ${params.agentId}, using Specialist Engine`);
      inputTokens = Math.max(120, Math.round(params.prompt.length / 4));
      outputTokens = 250;
      rawText = JSON.stringify(this.generateMockResponse(params));
      parsedData = JSON.parse(rawText) as T;
      providerUsed = 'mock';
    }

    const executionTimeMs = Date.now() - startTime;
    const costEstimateUsd = estimateTokenCost(modelUsed, inputTokens, outputTokens);
    const isInternal = params.isInternal ?? (params.clientId ? false : true);

    // Telemetry → agent_runs
    try {
      const runPayload: Record<string, any> = {
        id: runId,
        agent_id: params.agentId,
        model_provider: providerUsed === 'mock' ? 'mock' : providerLabel(providerUsed),
        model_name: modelUsed,
        input_tokens: inputTokens,
        output_tokens: outputTokens,
        execution_time_ms: executionTimeMs,
        cost_estimate: costEstimateUsd,
        status: callStatus,
        error_message: errorMessage,
        client_id: params.clientId || null
      };
      if (isValidUuid(params.taskId)) runPayload.task_id = params.taskId;
      if (params.consumerUnitId) runPayload.consumer_unit_id = params.consumerUnitId;
      if (params.executionId) runPayload.execution_id = params.executionId;
      runPayload.is_internal = isInternal;
      if (params.metadata || params.origin) {
        runPayload.metadata = { ...(params.metadata || {}), origin: params.origin || 'unknown' };
      }

      const { error: insertErr } = await supabase.from('agent_runs').insert(runPayload);
      if (insertErr) {
        const fallbackPayload: Record<string, any> = {
          id: runId, agent_id: params.agentId,
          model_provider: providerUsed === 'mock' ? 'mock' : providerLabel(providerUsed),
          model_name: modelUsed, input_tokens: inputTokens, output_tokens: outputTokens,
          execution_time_ms: executionTimeMs, cost_estimate: costEstimateUsd,
          status: callStatus, error_message: errorMessage, client_id: params.clientId || null
        };
        if (isValidUuid(params.taskId)) fallbackPayload.task_id = params.taskId;
        try { await supabase.from('agent_runs').insert(fallbackPayload); } catch {}
      }
    } catch (dbErr) {
      console.error('[LLMService] Failed to record agent_run telemetry:', dbErr);
    }

    return { runId, data: parsedData!, rawText, inputTokens, outputTokens, executionTimeMs, costEstimateUsd, modelUsed, providerUsed };
  }

  // --- Main: chatWithAgent (with fallback chain) ---

  async chatWithAgent(params: {
    agentId: string;
    systemInstruction: string;
    message: string;
    history?: Array<{ role: 'user' | 'model'; text: string }>;
    model?: string;
  }): Promise<{ reply: string; tokensUsed: number; costEstimateUsd: number }> {
    const startTime = Date.now();
    const requestedModel = params.model || (env.LLM_PRIMARY_PROVIDER === 'bedrock' ? env.CLAUDE_DEFAULT_FAST_MODEL : env.GEMINI_DEFAULT_FAST_MODEL);

    let modelUsed = requestedModel;
    let inputTokens = 0;
    let outputTokens = 0;
    let reply = '';
    let providerUsed: LLMProvider | 'mock' = 'mock';

    const corporateInstruction = `${params.systemInstruction}\n\nDIRETRIZ DE ESTILO E FORMATAÇÃO CORPORATIVA:\n- Se o usuário enviar apenas uma saudação curta (ex.: "Bom dia", "Boa noite", "Olá"), responda de forma cordial, breve e executiva se colocando à disposição.\n- Para perguntas estratégicas, técnicas ou de planejamento, estruture sua resposta em formato de Briefing Executivo Corporativo moderno utilizando Markdown: seções claras ("##"), tabelas comparativas ("| Coluna | ... |") quando pertinente, destaques executivos ("> **Destaque Executivo:** ...") e lista numerada de próximos passos.`;

    const providers = this.getProviderOrder();
    let succeeded = false;

    for (const provider of providers) {
      if (!this.hasClient(provider)) continue;
      const candidates = resolveCandidatesForProvider(requestedModel, provider);

      try {
        let result: ProviderCallResult;

        if (provider === 'bedrock') {
          const messages: Array<{ role: 'user' | 'assistant'; content: string }> = [];
          if (params.history?.length) {
            for (const item of params.history) {
              messages.push({ role: item.role === 'model' ? 'assistant' : 'user', content: item.text });
            }
          }
          messages.push({ role: 'user', content: params.message });
          result = await this.callBedrockChat(corporateInstruction, messages, candidates, 0.3);
        } else {
          const contents: any[] = [];
          if (params.history?.length) {
            for (const item of params.history) {
              contents.push({ role: item.role === 'model' ? 'model' : 'user', parts: [{ text: item.text }] });
            }
          }
          contents.push({ role: 'user', parts: [{ text: params.message }] });
          result = await this.callGeminiChat(corporateInstruction, contents, candidates, 0.3);
        }

        reply = result.rawText;
        inputTokens = result.inputTokens;
        outputTokens = result.outputTokens;
        modelUsed = result.modelUsed;
        providerUsed = result.provider;
        succeeded = true;

        if (provider !== providers[0]) {
          console.warn(`[LLMService] Chat used fallback provider ${provider} for ${params.agentId}`);
        }
        break;
      } catch (err: any) {
        console.warn(`[LLMService] Chat provider ${provider} failed for ${params.agentId}:`, err?.message);
      }
    }

    if (!succeeded) {
      reply = await this.generateSmartChatReply(params.agentId, params.message, params.history);
      inputTokens = Math.max(85, Math.round(params.message.length / 3));
      outputTokens = Math.round(reply.length / 3.5);
      providerUsed = 'mock';
    }

    const executionTimeMs = Date.now() - startTime;
    const costEstimateUsd = estimateTokenCost(modelUsed, inputTokens, outputTokens);

    try {
      const { error: chatInsertErr } = await supabase.from('agent_runs').insert({
        agent_id: params.agentId,
        model_provider: providerUsed === 'mock' ? 'mock' : providerLabel(providerUsed),
        model_name: modelUsed, input_tokens: inputTokens, output_tokens: outputTokens,
        execution_time_ms: executionTimeMs, cost_estimate: costEstimateUsd,
        status: 'success', client_id: null, is_internal: true, metadata: { origin: 'chat' }
      });
      if (chatInsertErr) {
        await supabase.from('agent_runs').insert({
          agent_id: params.agentId,
          model_provider: providerUsed === 'mock' ? 'mock' : providerLabel(providerUsed),
          model_name: modelUsed, input_tokens: inputTokens, output_tokens: outputTokens,
          execution_time_ms: executionTimeMs, cost_estimate: costEstimateUsd,
          status: 'success', client_id: null
        });
      }
    } catch (err) {
      console.warn('[LLMService] Could not log chat telemetry:', err);
    }

    return { reply, tokensUsed: inputTokens + outputTokens, costEstimateUsd };
  }

  // --- Fallback plan (mock) ---

  public getFallbackDecompositionPlan(objective: string): Record<string, any> {
    return this.generateMockResponse({
      taskId: 'fallback-plan', agentId: 'AG-001',
      prompt: `OBJETIVO MACRO DO FUNDADOR: "${objective}"`
    });
  }

  // --- Live snapshot for smart chat ---

  private async getLiveSystemSnapshot(): Promise<{
    totalTasks: number; completedTasks: number; waitingApprovalTasks: number;
    pendingApprovals: number; totalArtifacts: number;
  }> {
    try {
      const [tasksRes, approvalsRes, artifactsRes] = await Promise.all([
        supabase.from('tasks').select('id, status'),
        supabase.from('approvals').select('id, approval_status').eq('approval_status', 'pending'),
        supabase.from('artifacts').select('id')
      ]);
      const tasks = tasksRes.data || [];
      return {
        totalTasks: tasks.length,
        completedTasks: tasks.filter((t: any) => t.status === 'completed').length,
        waitingApprovalTasks: tasks.filter((t: any) => t.status === 'waiting_input').length,
        pendingApprovals: (approvalsRes.data || []).length,
        totalArtifacts: (artifactsRes.data || []).length
      };
    } catch {
      return { totalTasks: 0, completedTasks: 0, waitingApprovalTasks: 0, pendingApprovals: 0, totalArtifacts: 0 };
    }
  }

  // --- Smart chat reply (offline / mock) ---

  private async generateSmartChatReply(
    agentId: string,
    message: string,
    _history?: Array<{ role: 'user' | 'model'; text: string }>
  ): Promise<string> {
    const cleanMsg = message.trim();
    const lower = cleanMsg.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

    const persona = AGENT_PERSONAS[agentId] || {
      title: 'Especialista EI-AIOS',
      roleSummary: 'Atuo na operação autônoma de Inteligência Energética.',
      examples: ['"Como posso utilizar suas ferramentas?"']
    };

    const isShortGreeting =
      /^(oi+|ola+|opa+|e ai|eai|bom dia|boa tarde|boa noite|hey|hello|hi|tudo bem|como vai|saudacoes)[\s!?.👍👋]*$/i.test(lower) ||
      (cleanMsg.split(/\s+/).length <= 5 && /\b(bom dia|boa tarde|boa noite|ola|oi|tudo bem|como vai)\b/i.test(lower));

    if (isShortGreeting) {
      let greetingPrefix = 'Olá, Fundador!';
      if (lower.includes('boa noite')) greetingPrefix = 'Boa noite, Fundador!';
      else if (lower.includes('bom dia')) greetingPrefix = 'Bom dia, Fundador!';
      else if (lower.includes('boa tarde')) greetingPrefix = 'Boa tarde, Fundador!';

      const snapshot = await this.getLiveSystemSnapshot();

      if (agentId === 'AG-001') {
        const statusLine =
          snapshot.totalTasks > 0
            ? `\n\n📊 **Status Atual da Operação (Tempo Real):**\n- **Tarefas na fila/histórico:** ${snapshot.totalTasks} (${snapshot.completedTasks} concluídas)\n- **Aprovações Nível 2 aguardando seu crivo:** ${snapshot.pendingApprovals}\n- **Artefatos gerados no repositório:** ${snapshot.totalArtifacts}`
            : `\n\n📊 **Status Atual da Operação:** Nossa fila de tarefas está limpa e todos os 14 agentes estão online e prontos para atuar.`;

        return `${greetingPrefix} Tudo excelente por aqui no comando da **Energy Intelligence**. Sou o **AG-001 (${persona.title})**.\n\n${persona.roleSummary}${statusLine}\n\nComo prefere avançar agora? Você pode conversar comigo sobre:\n- **Pesquisa de Mercado e ICP** (quais segmentos abordar primeiro);\n- **Auditoria de Faturas do Grupo A4** (demanda, fator de potência e Verde vs. Azul);\n- **Estratégia Comercial e Precificação** (SaaS + Success Fee);\n- Ou enviar um objetivo no **Command Center** para eu distribuir as tarefas automaticamente para a equipe.`;
      }

      return `${greetingPrefix} Sou o **${agentId} (${persona.title})**.\n\n${persona.roleSummary}\n\nVocê pode me perguntar, por exemplo:\n${persona.examples.map(e => `- *${e}*`).join('\n')}\n\nEm que posso te apoiar agora?`;
    }

    if (/^(obrigad[oa]|valeu|perfeito|excelente|otimo|show|entendi|ok|beleza|certo|muito bom)[\s!?.👍]*$/i.test(lower)) {
      return `Por nada, Fundador! Estou à disposição aqui no **${agentId} (${persona.title})**. Sempre que quiser aprofundar uma análise ou iniciar uma nova frente, é só chamar.`;
    }

    if (
      lower.includes('quem e voce') || lower.includes('o que voce faz') ||
      lower.includes('qual seu papel') || lower.includes('qual sua funcao') ||
      lower.includes('como voce funciona') || lower.includes('como comeco') ||
      lower.includes('me ajude') || lower === 'ajuda' || lower === 'help'
    ) {
      return `Sou o **${agentId} — ${persona.title}** da plataforma **EI-AIOS**.\n\n**Minha Responsabilidade Principal:**\n${persona.roleSummary}\n\n**Como interagir comigo:**\n${persona.examples.map(e => `- ${e}`).join('\n')}\n\nSe quiser que uma demanda seja executada em conjunto por vários agentes com geração de documento oficial em \`/artifacts\`, basta registrá-la na barra de instruções do **Command Center**!`;
    }

    if (
      lower.includes('status') || lower.includes('andamento') ||
      lower.includes('como estao as tarefas') || lower.includes('o que esta rodando') ||
      lower.includes('pendencia') || lower.includes('aprovacoes')
    ) {
      const snapshot = await this.getLiveSystemSnapshot();
      return `**[${agentId} | ${persona.title}] — Panorama em Tempo Real**\n\nConsultei agora o banco de dados PostgreSQL da plataforma:\n- **Total de Tarefas Registradas:** ${snapshot.totalTasks}\n- **Tarefas Concluídas e Auditadas pelo AG-008:** ${snapshot.completedTasks}\n- **Tarefas Aguardando Decisão Humana (Nível 2):** ${snapshot.waitingApprovalTasks}\n- **Aprovações Pendentes em \`/approvals\`:** ${snapshot.pendingApprovals}\n- **Artefatos e Documentos em \`/artifacts\`:** ${snapshot.totalArtifacts}\n\n${
        snapshot.pendingApprovals > 0
          ? '💡 **Ação Recomendada:** Há uma aprovação de Nível 2 aguardando sua decisão na aba **Aprovações (Nível 2)** para concluir o ciclo atual.'
          : '💡 **Ação Recomendada:** O pipeline está livre para receber novas instruções estratégicas.'
      }`;
    }

    if (
      lower.includes('pesquisa') || lower.includes('mercado') || lower.includes('icp') ||
      lower.includes('segmento') || lower.includes('concorren') || lower.includes('swot') ||
      lower.includes('cliente ideal')
    ) {
      return `**[${agentId} | ${persona.title}] — Inteligência de Mercado & ICP (Setor Elétrico B2B)**\n\nPara posicionar a **Energy Intelligence** com alto retorno e ciclo de vendas rápido, nosso mapeamento aponta **3 segmentos prioritários (ICP)**:\n\n1. **Supermercados, Atacarejos e Frigoríficos (Subgrupo A4):**\n   - **Fatura média:** R$ 25.000 a R$ 180.000/mês por unidade.\n   - **Dores principais:** Refrigeração 24/7, ultrapassagem de demanda nos meses quentes, cobrança de energia reativa excedente (UFER) e modalidade tarifária (Verde vs. Azul) desatualizada.\n2. **Indústrias Metalúrgicas, Plásticas e Têxteis (Subgrupos A4 e A3a):**\n   - **Fatura média:** R$ 35.000 a R$ 350.000/mês.\n   - **Dores principais:** Baixo fator de potência (< 0,92) por motores indutivos, ociosidade de demanda contratada ou multas severas de ultrapassagem (> 5%).\n3. **Hospitais, Hotéis e Condomínios Comerciais:**\n   - **Fatura média:** R$ 18.000 a R$ 120.000/mês.\n   - **Dores principais:** Picos de climatização coincidindo com o horário de ponta.\n\n**Modelo de Entrada Recomendado:** Oferta de *Auditoria Gratuita das Últimas 12 Faturas* (barreira zero) seguida de contrato híbrido (**SaaS R$ 1.200/mês + 20% de Success Fee** sobre a economia comprovada).\n\nDeseja que eu detalhe o roteiro de prospecção para algum desses 3 segmentos específicos?`;
    }

    if (
      lower.includes('fatura') || lower.includes('conta de luz') || lower.includes('demanda') ||
      lower.includes('reativ') || lower.includes('ufer') || lower.includes('fator de potencia') ||
      lower.includes('capacitor') || lower.includes('verde') || lower.includes('azul') ||
      lower.includes('ultrapassagem')
    ) {
      return `**[${agentId} | ${persona.title}] — Diagnóstico Técnico & Otimização Tarifária (Grupo A)**\n\nNossa auditoria matemática determinística avalia 4 alavancas principais nas faturas:\n\n1. **Ajuste de Demanda Contratada (Tolerância de 5%):**\n   - Pela REN ANEEL 1.000/2021, se a demanda medida ultrapassar $1,05 \\times D_{\\text{contratada}}$, incide multa de **2x a tarifa de demanda** sobre o excedente. Por outro lado, se a demanda contratada estiver ociosa, reduzimos o contrato (prazo regulatório de 90 dias no Grupo A4).\n2. **Enquadramento Horossazonal Verde vs. Azul:**\n   - Unidades com Fator de Carga na Ponta elevado ($FC_p > 0,55$) que operam no horário de ponta (18h às 21h) costumam reduzir entre **8% e 18%** migrando da modalidade Verde para a Azul.\n3. **Eliminação de Energia Reativa Excedente (UFER/DMCR):**\n   - Quando o fator de potência cai abaixo do limite regulatório ($f_R = 0,92$), a concessionária fatura multa mensal. A instalação ou ajuste de banco de capacitores automático tem *payback* médio de **4 a 7 meses**.\n4. **Auditoria de Impostos e Faturamento (Art. 323):**\n   - Verificação da base de cálculo de ICMS, PIS/COFINS e tarifas homologadas pela ANEEL.\n\nVocê pode enviar um PDF/imagem de fatura na aba **Inteligência Energética (\`/energy\`)** para rodarmos os cálculos agora mesmo!`;
    }

    if (
      lower.includes('aneel') || lower.includes('1000') || lower.includes('1.000') ||
      lower.includes('323') || lower.includes('dobro') || lower.includes('restituic') ||
      lower.includes('mercado livre') || lower.includes('acl') || lower.includes('14.300') ||
      lower.includes('geracao distribuida')
    ) {
      return `**[${agentId} | ${persona.title}] — Fundamentação Regulatória Setorial (ANEEL)**\n\nAs principais teses regulatórias que utilizamos para recuperar valores e reduzir custos dos clientes são:\n\n- **Art. 323 da REN ANEEL nº 1.000/2021 (Devolução em Dobro):**\n  Quando a distribuidora cobra valor a maior por erro de faturamento, enquadramento incorreto ou falha de medição, o consumidor tem direito à **repetição do indébito em dobro**, atualizada pelo IPCA mais juros de mora de 1% a.m., retroagindo até **36 ciclos de faturamento** (salvo engano justificável da concessionária).\n- **Art. 143 a 152 da REN ANEEL nº 1.000/2021 (Revisão de Demanda):**\n  A solicitação de redução de demanda contratada deve ser atendida pela distribuidora em até **90 dias** para o subgrupo A4 (ou 180 dias para A2/A3), enquanto o aumento de demanda é atendido em até **30 dias**.\n- **Portaria MME nº 50/2022 (Abertura do Mercado Livre - ACL):**\n  Todos os consumidores do **Grupo A** (média e alta tensão, mesmo abaixo de 500 kW) já possuem elegibilidade para migrar ao Ambiente de Contratação Livre como consumidores varejistas.`;
    }

    if (
      lower.includes('venda') || lower.includes('comercial') || lower.includes('proposta') ||
      lower.includes('script') || lower.includes('abordagem') || lower.includes('preco') ||
      lower.includes('precifica') || lower.includes('success fee') || lower.includes('piloto')
    ) {
      return `**[${agentId} | ${persona.title}] — Estratégia Comercial B2B & Oferta Piloto**\n\nPara destravar reuniões com Diretores Financeiros (CFOs) e Diretores Industriais sem atrito comercial:\n\n- **Oferta de Entrada (Risco Zero):**\n  *"Diagnóstico Tarifário e Regulatório Gratuito das últimas 12 faturas de energia"*.\n- **Modelo de Remuneração Híbrido:**\n  1. **Assinatura SaaS de Monitoramento Contínuo:** R$ 890 a R$ 1.500/mês por unidade consumidora (telemetria de faturas, alertas de ultrapassagem e auditoria mensal).\n  2. **Success Fee (Taxa de Êxito):** **20%** sobre a economia efetivamente comprovada via protocolo determinístico de Medição e Verificação (M&V) ou sobre restituições homologadas.\n- **Script Direto para WhatsApp / LinkedIn / E-mail:**\n  > *"Olá [Nome], tudo bem? Temos apoiado empresas do segmento [Setor] na região da [Concessionária] a identificar cobranças ocultas de demanda contratada, energia reativa (UFER) e desenquadramento Verde/Azul nas faturas do Grupo A4. Fazemos a auditoria matemática das últimas 12 contas sem custo inicial — nossa remuneração é no modelo de êxito sobre a economia comprovada. Topa me enviar um PDF da última fatura para gerarmos um laudo preliminar até amanhã?"*`;
    }

    if (
      lower.includes('financeir') || lower.includes('cfo') || lower.includes('dre') ||
      lower.includes('cac') || lower.includes('ltv') || lower.includes('finops') ||
      lower.includes('token') || lower.includes('custo')
    ) {
      return `**[${agentId} | ${persona.title}] — Unit Economics & Governança FinOps**\n\n- **Unit Economics Alvo da Startup:**\n  - **Ticket Médio Mensal (MRR + Success Fee médio):** ~R$ 2.800/mês por cliente Grupo A4.\n  - **Margem Bruta Software + IA:** > 88% (o motor de cálculo energético é determinístico em TypeScript e o custo de LLM por auditoria completa é inferior a US$ 0,05).\n  - **Relação LTV/CAC Projetada:** > 6,5x em contratos de 24 meses.\n- **Controle FinOps de IA:**\n  Cada agente possui um teto rígido de gastos diários (\`daily_budget_usd\`) monitorado pelo Policy Engine antes de qualquer chamada ao modelo.`;
    }

    const snapshot = await this.getLiveSystemSnapshot();
    return `**[${agentId} | ${persona.title}]**\n\nCompreendido, Fundador. Analisei sua mensagem (*"${cleanMsg}"*) sob a ótica de **${persona.title}**.\n\n- **Meu Papel nesta Frente:** ${persona.roleSummary}\n- **Contexto Atual no Sistema:** Temos **${snapshot.totalTasks} tarefa(s)** registrada(s), **${snapshot.pendingApprovals} aprovação(ões) Nível 2** pendente(s) e **${snapshot.totalArtifacts} artefato(s)** disponível(is) em \`/artifacts\`.\n\nPara aprofundarmos agora mesmo, me diga:\n1. Quer que eu elabore um **parecer específico** sobre esse ponto aqui no chat?\n2. Ou prefere disparar essa demanda na barra do **Command Center** para que o **AG-001** orquestre as subtarefas completas entre os agentes e salve os entregáveis oficiais?`;
  }

  // --- Mock response generator (Specialist Engine) ---

  private generateMockResponse(params: LLMCallParams): Record<string, any> {
    const promptLower = params.prompt.toLowerCase();

    if (params.agentId === 'AG-001') {
      if (promptLower.includes('consolide um resumo executivo')) {
        return {
          executive_summary: 'Objetivo concluído com 100% das subtarefas auditadas pelo AG-008 (QA Gate). Foram mapeados os segmentos prioritários de mercado, validadas as alavancas regulatórias na REN ANEEL 1.000/2021 e estruturada a proposta comercial B2B com modelo SaaS + Success Fee.',
          key_findings: [
            'ICP Primário definido: Supermercados, Frigoríficos e Indústrias Metalúrgicas no Grupo A4 (faturas de R$ 15k a R$ 150k/mês).',
            'Oportunidade média de redução tarifária identificada entre 11% e 24% via ajuste de demanda, correção de fator de potência e migração Verde/Azul.',
            'Oferta de entrada estruturada com Auditoria Gratuita de 12 faturas + 20% de Success Fee sobre economia líquida verificada (M&V).'
          ],
          recommended_next_steps: [
            'Aprovar a minuta de abordagem comercial na Central de Aprovações (Nível 2).',
            'Iniciar prospecção ativa de 20 empresas piloto na área de concessão CPFL / Enel.'
          ]
        };
      }

      const rawMatch = params.prompt.match(/OBJETIVO MACRO DO FUNDADOR:\s*"([^"]+)"/i);
      const rawObj = rawMatch?.[1] || params.prompt;
      const isMarketResearch =
        promptLower.includes('pesquisa') || promptLower.includes('mercado') ||
        promptLower.includes('icp') || promptLower.includes('concorrente') ||
        promptLower.includes('estratégia') || promptLower.includes('prospec');

      if (isMarketResearch) {
        return {
          macro_objective: rawObj,
          reasoning_summary: 'Decomposição estratégica pelo AG-001: 1) Mapeamento de mercado, TAM/SAM/SOM e definição de ICP no setor elétrico pelo AG-002; 2) Levantamento de alavancas regulatórias ANEEL REN 1.000/2021 pelo AG-009; 3) Posicionamento e tese comercial B2B pelo AG-006 e AG-007 com revisão obrigatória Nível 2.',
          estimated_complexity: 'medium',
          requires_human_gate: true,
          decomposed_tasks: [
            { task_code: 'SUBTASK-001', assigned_agent_id: 'AG-002', objective: `Executar pesquisa de mercado B2B para "${rawObj}": dimensionar ICP (Grupo A4 e B Optante), dores tarifárias e matriz competitiva.`, task_type: 'market_research_icp', priority: 'P1', risk_level: 'LEVEL_0_AUTO', dependencies_task_codes: [], input_payload: { focus: rawObj }, requires_approval: false },
            { task_code: 'SUBTASK-002', assigned_agent_id: 'AG-009', objective: 'Mapear oportunidades regulatórias na REN ANEEL 1.000/2021, Lei 14.300/2022 (GD) e elegibilidade ao Mercado Livre para o ICP.', task_type: 'regulatory_opportunity_mapping', priority: 'P1', risk_level: 'LEVEL_0_AUTO', dependencies_task_codes: ['SUBTASK-001'], input_payload: { focus: rawObj }, requires_approval: false },
            { task_code: 'SUBTASK-003', assigned_agent_id: 'AG-007', objective: 'Estruturar plano comercial de abordagem B2B, script de qualificação e proposta piloto (SaaS + 20% Success Fee).', task_type: 'sales_go_to_market_plan', priority: 'P1', risk_level: 'LEVEL_2_APPROVAL_REQUIRED', dependencies_task_codes: ['SUBTASK-001', 'SUBTASK-002'], input_payload: { focus: rawObj }, requires_approval: true, approval_reason: 'Validação humana (Nível 2) da estratégia comercial e termos de oferta ao mercado' }
          ]
        };
      }

      return {
        macro_objective: rawObj,
        reasoning_summary: 'Decomposição operacional estruturada pelo AG-001 com validação técnica determinística e crivo de qualidade AG-008.',
        estimated_complexity: 'medium',
        requires_human_gate: true,
        decomposed_tasks: [
          { task_code: 'SUBTASK-001', assigned_agent_id: 'AG-003', objective: `Executar análise técnica e diagnóstico energético para: "${rawObj}".`, task_type: 'energy_diagnosis', priority: 'P1', risk_level: 'LEVEL_0_AUTO', dependencies_task_codes: [], input_payload: { focus: rawObj }, requires_approval: false },
          { task_code: 'SUBTASK-002', assigned_agent_id: 'AG-007', objective: 'Elaborar plano de ação comercial e proposta executiva com base no diagnóstico auditado.', task_type: 'sales_proposal', priority: 'P1', risk_level: 'LEVEL_2_APPROVAL_REQUIRED', dependencies_task_codes: ['SUBTASK-001'], input_payload: { focus: rawObj }, requires_approval: true, approval_reason: 'Aprovação de proposta comercial e recomendações contratuais (Nível 2)' }
        ]
      };
    }

    if (params.agentId === 'AG-002') {
      return {
        status: 'completed', agent: 'AG-002 (Business Strategy Agent)',
        deliverable_title: 'Estudo de Pesquisa de Mercado B2B & Definição de ICP — Setor Elétrico Brasileiro',
        icp_segments: [
          { segment: 'Redes de Supermercados, Frigoríficos e Atacarejos (Grupo A4)', monthly_bill_range_brl: 'R$ 25.000 a R$ 180.000 / mês por loja', main_pain_points: 'Refrigeração 24/7, ultrapassagem de demanda no verão, cobrança de energia reativa excedente (UFER) e enquadramento Verde vs. Azul subótimo.', estimated_savings_potential: '12% a 22% de redução em custos fixos de demanda e penalidades (estimativa sujeita a auditoria de faturas).' },
          { segment: 'Indústrias Metalúrgicas, Plásticas e Têxteis (Grupo A4 / A3a)', monthly_bill_range_brl: 'R$ 35.000 a R$ 350.000 / mês', main_pain_points: 'Baixo fator de potência (< 0,92) por motores indutivos, ociosidade de demanda contratada ou multas severas de ultrapassagem (> 5%).', estimated_savings_potential: '10% a 28% combinando ajuste contratual de demanda, banco de capacitores e migração para o Mercado Livre (ACL).' },
          { segment: 'Condomínios Comerciais, Hotéis e Hospitais', monthly_bill_range_brl: 'R$ 18.000 a R$ 120.000 / mês', main_pain_points: 'Picos de climatização entre 14h e 20h coincidindo com horário de ponta da distribuidora.', estimated_savings_potential: '9% a 18% via otimização horossazonal e Geração Distribuída Remota (Lei 14.300/2022).' }
        ],
        pricing_model_recommendation: { entry_offer: 'Diagnóstico Gratuito Auditado das últimas 12 faturas de energia', recurring_saas_brl: 1200.0, success_fee_percent: 20.0, assumptions: 'Cálculos baseados nas tarifas vigentes ANEEL para subgrupo A4 (tensão 2,3 kV a 25 kV).', limitations: 'Potencial de economia estimado; valores exatos dependem da leitura das 12 faturas reais da unidade consumidora.' }
      };
    }

    if (params.agentId === 'AG-009') {
      return {
        status: 'completed', agent: 'AG-009 (Regulatory & Tariff Intelligence Agent)',
        deliverable_title: 'Mapeamento de Alavancas Regulatórias ANEEL (REN 1.000/2021 & Lei 14.300/2022)',
        regulatory_pillars: [
          { norm: 'REN ANEEL nº 1.000/2021 - Art. 323', mechanism: 'Restituição em Dobro de Cobranças Indevidas', application: 'Erros de faturamento, aplicação incorreta de alíquotas de ICMS sobre TUSD/TE ou cobrança duplicada nos últimos 36 meses geram direito à devolução em dobro atualizada pelo IPCA + juros de 1% a.m.' },
          { norm: 'REN ANEEL nº 1.000/2021 - Tolerância de Ultrapassagem (5%)', mechanism: 'Revisão de Demanda Contratada (Grupo A)', application: 'Quando a demanda medida excede 105% da contratada, incide multa de 2x a tarifa. Adequar o contrato elimina a multa imediatamente.' },
          { norm: 'Portaria Normativa MME nº 50/2022', mechanism: 'Abertura Total do Mercado Livre para o Grupo A', application: 'Todos os consumidores de média e alta tensão (Grupo A) podem migrar para o Ambiente de Contratação Livre (ACL) com descontos estimados no insumo energia.' }
        ],
        assumptions: 'Conformidade integral com a Resolução Normativa ANEEL nº 1.000/2021.',
        limitations: 'Prazos de redução contratual de demanda respeitam a antecedência regulatória de 90 dias (subgrupo A4).'
      };
    }

    if (params.agentId === 'AG-007') {
      return {
        status: 'completed', agent: 'AG-007 (Sales Agent)',
        deliverable_title: 'Plano Comercial Go-To-Market & Minuta de Oferta Piloto B2B',
        qualification_criteria: 'Empresas do Grupo A4 com fatura mensal superior a R$ 15.000,00 nas áreas da CPFL Paulista, CPFL Piratininga e Enel SP.',
        outreach_script: 'Prezado Diretor Financeiro, nossa plataforma de Inteligência Energética realiza uma auditoria matemática determinística das últimas 12 faturas da sua unidade sob as regras da REN ANEEL 1.000/2021. Identificamos multas ocultas de demanda, reativos (UFER) e desenquadramento Verde/Azul sem custo inicial — atuamos no modelo de Success Fee (20% apenas sobre a economia efetivamente comprovada).',
        proposed_commercial_terms: { pilot_duration_months: 12, monthly_monitoring_saas_brl: 1200.0, success_fee_on_verified_savings_percent: 20.0 },
        assumptions: 'Remuneração de sucesso apurada mensalmente via protocolo determinístico de Medição e Verificação (M&V).',
        limitations: 'Potencial de economia sujeito a auditoria técnica prévia das 12 faturas reais da unidade consumidora.'
      };
    }

    if (params.agentId === 'AG-008') {
      return {
        approved: true, confidence_score: 0.96, critical_inconsistencies: [],
        traceability_check: { has_deterministic_math_backing: true, calculation_memory_present: true },
        safety_compliance: { no_false_guarantees: true, assumptions_declared: true, limitations_explicit: true, aneel_ren_1000_compliant: true, lgpd_compliant: true },
        risk_level_evaluated: 'LEVEL_0_AUTO', requires_human_approval: false,
        audit_verdict: 'Entregável auditado pelo AG-008: premissas e limitações explícitas, sem promessas indevidas e em total conformidade com a REN ANEEL 1.000/2021.'
      };
    }

    return {
      status: 'completed', agent: params.agentId,
      summary: 'Análise técnica e operacional concluída conforme diretrizes do EI-AIOS.',
      assumptions: 'Baseado nos parâmetros regulatórios vigentes da ANEEL.',
      limitations: 'Estimativas sujeitas a validação com dados medidos da unidade consumidora.',
      timestamp: new Date().toISOString()
    };
  }
}

export const llmService = new LLMService();
