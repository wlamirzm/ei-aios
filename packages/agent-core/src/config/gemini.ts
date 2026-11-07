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
        reply = this.generateSmartChatReply(params.agentId, params.message);
        inputTokens = Math.max(85, Math.round(params.message.length / 3));
        outputTokens = Math.round(reply.length / 3.5);
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

  private generateSmartChatReply(agentId: string, message: string): string {
    const lower = message.toLowerCase();

    if (agentId === 'AG-001') {
      if (lower.includes('pesquisa') || lower.includes('mercado') || lower.includes('icp')) {
        return `**[AG-001 | CEO & AI Orchestrator]**\n\nExcelente iniciativa estratégica. Para conduzirmos uma **Pesquisa de Mercado B2B no Setor Elétrico**, estruturei o plano de ação coordenado entre nossos especialistas:\n\n1. **AG-002 (Business Strategy):** Mapeamento do ICP prioritário (Redes de Supermercados, Frigoríficos, Metalúrgicas e Condomínios Comerciais no Grupo A4 com faturas entre R$ 15 mil e R$ 150 mil/mês), onde mais de 68% possuem cobranças evitáveis de ultrapassagem de demanda ou energia reativa excedente (UFER).\n2. **AG-009 (Regulatório ANEEL):** Levantamento das alavancas legais na **REN ANEEL nº 1.000/2021** (Art. 323 — devolução em dobro de faturamento incorreto nos últimos 36 a 60 meses) e enquadramento Horossazonal Verde vs. Azul.\n3. **AG-006 & AG-007 (Growth & Sales):** Criação da oferta de entrada *"Auditoria Gratuita das Últimas 12 Faturas"* com remuneração híbrida (**SaaS R$ 890/mês + 20% de Success Fee** sobre a economia comprovada).\n\nVocê pode disparar esse fluxo completo direto na barra do **Command Center** para que eu crie e distribua as tarefas automaticamente no quadro Kanban!`;
      }
      return `**[AG-001 | CEO & AI Orchestrator]**\n\nRecebi sua diretriz: *"${message}"*.\n\nComo Orquestrador Central, posso decompor essa meta em tarefas atômicas para nossa equipe:\n- **AG-002 (Estratégia)** para modelagem de mercado e ICP;\n- **AG-003 & AG-004 (Engenharia & Dados)** para auditoria matemática de faturas;\n- **AG-009 (Regulatório)** para fundamentação na REN ANEEL 1.000/2021;\n- **AG-007 (Vendas)** para estruturação de proposta comercial;\n- **AG-008 (QA Gate)** para auditar todas as entregas antes da sua aprovação Nível 2.\n\nQual segmento ou unidade consumidora devemos priorizar agora?`;
    }

    if (agentId === 'AG-002') {
      return `**[AG-002 | Business Strategy Agent]**\n\nAnálise estratégica para *"${message}"*:\n\n- **Segmentos com Maior Dor Imediata (ICP Primário):**\n  1. **Supermercados e Atacarejos (Grupo A4):** Alto consumo em refrigeração 24h, fator de carga elevado (> 0,65) e frequente desenquadramento entre tarifa Verde e Azul.\n  2. **Indústrias Metalúrgicas e Plásticas:** Picos de partida de motores gerando multa de ultrapassagem de demanda (> 5% da contratada) e baixo fator de potência (< 0,92).\n  3. **Redes de Farmácias e Clínicas (Grupo B Optante / GD):** Oportunidade de compensação de créditos de Geração Distribuída (Lei 14.300/2022).\n- **Modelo de Receita Recomendado:** Diagnóstico inicial sem custo (barreira zero) + Assinatura SaaS de monitoramento contínuo + 20% de *Success Fee* sobre reduções e restituições homologadas.`;
    }

    if (agentId === 'AG-003') {
      return `**[AG-003 | Energy Specialist Agent]**\n\nParecer técnico de engenharia sobre *"${message}"*:\n\n1. **Demanda Contratada vs. Medida (Grupo A):** Pela REN ANEEL 1.000/2021, a tolerância de ultrapassagem para o subgrupo A4 é de **5%**. Acima de $1,05 \\times D_{\\text{contratada}}$, aplica-se a tarifa de ultrapassagem equivalente a $2 \\times T_{\\text{demanda}}$ sobre a parcela excedente.\n2. **Energia Reativa Excedente (UFER/DMCR):** O fator de potência de referência regulatório é $f_R = 0,92$ (indutivo na maioria das horas e capacitivo na madrugada). Quando $\\cos\\varphi < 0,92$, o banco de capacitores costuma ter *payback* inferior a 5 meses.\n3. **Horossazonal Verde vs. Azul:** Unidades com Fator de Carga no horário de ponta elevado ($FC_p > 0,55$) geralmente economizam de 8% a 18% migrando da modalidade Verde para a Azul.`;
    }

    if (agentId === 'AG-007') {
      return `**[AG-007 | Sales Agent]**\n\nEstrutura comercial para *"${message}"*:\n\n- **Script de Abordagem Executiva (Diretor Financeiro / Industrial):**\n  *"Olá [Nome], identificamos que empresas do setor [Segmento] na área da concessionária local têm pago entre 9% e 22% a mais na fatura do Grupo A4 por desalinhamento de demanda contratada e reativos. Realizamos uma auditoria matemática determinística das últimas 12 faturas sem custo inicial — nossa remuneração ocorre no modelo Success Fee sobre a economia efetivamente comprovada. Podemos analisar a última fatura da sua unidade esta semana?"*`;
    }

    if (agentId === 'AG-009') {
      return `**[AG-009 | Regulatory & Tariff Intelligence Agent]**\n\nFundamentação regulatória sobre *"${message}"*:\n\n- **Base Legal ANEEL (REN nº 1.000/2021):**\n  - **Art. 323 (Faturamento Incorreto a Maior):** A distribuidora deve devolver em **dobro** os valores cobrados indevidamente nos últimos 36 ciclos de faturamento, acrescidos de atualização pelo IPCA e juros de mora de 1% ao mês, salvo engano justificável.\n  - **Art. 143 a 152 (Revisão de Demanda Contratada):** Reduções de demanda contratada são atendidas em até 90 dias (Grupo A4), e acréscimos em até 30 dias (desde que haja disponibilidade de rede).`;
    }

    return `**[${agentId}]**\n\nAnálise concluída para sua solicitação: *"${message}"*.\n\n- **Diagnóstico Técnico & Operacional:** Premissas verificadas conforme o catálogo normativo da ANEEL (REN 1.000/2021) e diretrizes de governança do EI-AIOS.\n- **Próximo Passo Recomendado:** Você pode registrar essa instrução como um Objetivo Macro no Command Center para acionarmos a esteira completa com validação do **AG-008 (QA Gate)**.`;
  }

  private generateMockResponse(params: GeminiCallParams): Record<string, any> {
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
        promptLower.includes('pesquisa') ||
        promptLower.includes('mercado') ||
        promptLower.includes('icp') ||
        promptLower.includes('concorrente') ||
        promptLower.includes('estratégia') ||
        promptLower.includes('prospec');

      if (isMarketResearch) {
        return {
          macro_objective: rawObj,
          reasoning_summary:
            'Decomposição estratégica pelo AG-001: 1) Mapeamento de mercado, TAM/SAM/SOM e definição de ICP no setor elétrico pelo AG-002; 2) Levantamento de alavancas regulatórias ANEEL REN 1.000/2021 pelo AG-009; 3) Posicionamento e tese comercial B2B pelo AG-006 e AG-007 com revisão obrigatória Nível 2.',
          estimated_complexity: 'medium',
          requires_human_gate: true,
          decomposed_tasks: [
            {
              task_code: 'SUBTASK-001',
              assigned_agent_id: 'AG-002',
              objective: `Executar pesquisa de mercado B2B para "${rawObj}": dimensionar ICP (Grupo A4 e B Optante), dores tarifárias e matriz competitiva.`,
              task_type: 'market_research_icp',
              priority: 'P1',
              risk_level: 'LEVEL_0_AUTO',
              dependencies_task_codes: [],
              input_payload: { focus: rawObj },
              requires_approval: false
            },
            {
              task_code: 'SUBTASK-002',
              assigned_agent_id: 'AG-009',
              objective: 'Mapear oportunidades regulatórias na REN ANEEL 1.000/2021, Lei 14.300/2022 (GD) e elegibilidade ao Mercado Livre para o ICP.',
              task_type: 'regulatory_opportunity_mapping',
              priority: 'P1',
              risk_level: 'LEVEL_0_AUTO',
              dependencies_task_codes: ['SUBTASK-001'],
              input_payload: { focus: rawObj },
              requires_approval: false
            },
            {
              task_code: 'SUBTASK-003',
              assigned_agent_id: 'AG-007',
              objective: 'Estruturar plano comercial de abordagem B2B, script de qualificação e proposta piloto (SaaS + 20% Success Fee).',
              task_type: 'sales_go_to_market_plan',
              priority: 'P1',
              risk_level: 'LEVEL_2_APPROVAL_REQUIRED',
              dependencies_task_codes: ['SUBTASK-001', 'SUBTASK-002'],
              input_payload: { focus: rawObj },
              requires_approval: true,
              approval_reason: 'Validação humana (Nível 2) da estratégia comercial e termos de oferta ao mercado'
            }
          ]
        };
      }

      return {
        macro_objective: rawObj,
        reasoning_summary: 'Decomposição operacional estruturada pelo AG-001 com validação técnica determinística e crivo de qualidade AG-008.',
        estimated_complexity: 'medium',
        requires_human_gate: true,
        decomposed_tasks: [
          {
            task_code: 'SUBTASK-001',
            assigned_agent_id: 'AG-003',
            objective: `Executar análise técnica e diagnóstico energético para: "${rawObj}".`,
            task_type: 'energy_diagnosis',
            priority: 'P1',
            risk_level: 'LEVEL_0_AUTO',
            dependencies_task_codes: [],
            input_payload: { focus: rawObj },
            requires_approval: false
          },
          {
            task_code: 'SUBTASK-002',
            assigned_agent_id: 'AG-007',
            objective: 'Elaborar plano de ação comercial e proposta executiva com base no diagnóstico auditado.',
            task_type: 'sales_proposal',
            priority: 'P1',
            risk_level: 'LEVEL_2_APPROVAL_REQUIRED',
            dependencies_task_codes: ['SUBTASK-001'],
            input_payload: { focus: rawObj },
            requires_approval: true,
            approval_reason: 'Aprovação de proposta comercial e recomendações contratuais (Nível 2)'
          }
        ]
      };
    }

    if (params.agentId === 'AG-002') {
      return {
        status: 'completed',
        agent: 'AG-002 (Business Strategy Agent)',
        deliverable_title: 'Estudo de Pesquisa de Mercado B2B & Definição de ICP — Setor Elétrico Brasileiro',
        icp_segments: [
          {
            segment: 'Redes de Supermercados, Frigoríficos e Atacarejos (Grupo A4)',
            monthly_bill_range_brl: 'R$ 25.000 a R$ 180.000 / mês por loja',
            main_pain_points: 'Refrigeração 24/7, ultrapassagem de demanda no verão, cobrança de energia reativa excedente (UFER) e enquadramento Verde vs. Azul subótimo.',
            estimated_savings_potential: '12% a 22% de redução em custos fixos de demanda e penalidades (estimativa sujeita a auditoria de faturas).'
          },
          {
            segment: 'Indústrias Metalúrgicas, Plásticas e Têxteis (Grupo A4 / A3a)',
            monthly_bill_range_brl: 'R$ 35.000 a R$ 350.000 / mês',
            main_pain_points: 'Baixo fator de potência (< 0,92) por motores indutivos, ociosidade de demanda contratada ou multas severas de ultrapassagem (> 5%).',
            estimated_savings_potential: '10% a 28% combinando ajuste contratual de demanda, banco de capacitores e migração para o Mercado Livre (ACL).'
          },
          {
            segment: 'Condomínios Comerciais, Hotéis e Hospitais',
            monthly_bill_range_brl: 'R$ 18.000 a R$ 120.000 / mês',
            main_pain_points: 'Picos de climatização entre 14h e 20h coincidindo com horário de ponta da distribuidora.',
            estimated_savings_potential: '9% a 18% via otimização horossazonal e Geração Distribuída Remota (Lei 14.300/2022).'
          }
        ],
        pricing_model_recommendation: {
          entry_offer: 'Diagnóstico Gratuito Auditado das últimas 12 faturas de energia',
          recurring_saas_brl: 1200.0,
          success_fee_percent: 20.0,
          assumptions: 'Cálculos baseados nas tarifas vigentes ANEEL para subgrupo A4 (tensão 2,3 kV a 25 kV).',
          limitations: 'Potencial de economia estimado; valores exatos dependem da leitura das 12 faturas reais da unidade consumidora.'
        }
      };
    }

    if (params.agentId === 'AG-009') {
      return {
        status: 'completed',
        agent: 'AG-009 (Regulatory & Tariff Intelligence Agent)',
        deliverable_title: 'Mapeamento de Alavancas Regulatórias ANEEL (REN 1.000/2021 & Lei 14.300/2022)',
        regulatory_pillars: [
          {
            norm: 'REN ANEEL nº 1.000/2021 - Art. 323',
            mechanism: 'Restituição em Dobro de Cobranças Indevidas',
            application: 'Erros de faturamento, aplicação incorreta de alíquotas de ICMS sobre TUSD/TE ou cobrança duplicada nos últimos 36 meses geram direito à devolução em dobro atualizada pelo IPCA + juros de 1% a.m.'
          },
          {
            norm: 'REN ANEEL nº 1.000/2021 - Tolerância de Ultrapassagem (5%)',
            mechanism: 'Revisão de Demanda Contratada (Grupo A)',
            application: 'Quando a demanda medida excede 105% da contratada, incide multa de 2x a tarifa. Adequar o contrato elimina a multa imediatamente.'
          },
          {
            norm: 'Portaria Normativa MME nº 50/2022',
            mechanism: 'Abertura Total do Mercado Livre para o Grupo A',
            application: 'Todos os consumidores de média e alta tensão (Grupo A) podem migrar para o Ambiente de Contratação Livre (ACL) com descontos estimados no insumo energia.'
          }
        ],
        assumptions: 'Conformidade integral com a Resolução Normativa ANEEL nº 1.000/2021.',
        limitations: 'Prazos de redução contratual de demanda respeitam a antecedência regulatória de 90 dias (subgrupo A4).'
      };
    }

    if (params.agentId === 'AG-007') {
      return {
        status: 'completed',
        agent: 'AG-007 (Sales Agent)',
        deliverable_title: 'Plano Comercial Go-To-Market & Minuta de Oferta Piloto B2B',
        qualification_criteria: 'Empresas do Grupo A4 com fatura mensal superior a R$ 15.000,00 nas áreas da CPFL Paulista, CPFL Piratininga e Enel SP.',
        outreach_script:
          'Prezado Diretor Financeiro, nossa plataforma de Inteligência Energética realiza uma auditoria matemática determinística das últimas 12 faturas da sua unidade sob as regras da REN ANEEL 1.000/2021. Identificamos multas ocultas de demanda, reativos (UFER) e desenquadramento Verde/Azul sem custo inicial — atuamos no modelo de Success Fee (20% apenas sobre a economia efetivamente comprovada).',
        proposed_commercial_terms: {
          pilot_duration_months: 12,
          monthly_monitoring_saas_brl: 1200.0,
          success_fee_on_verified_savings_percent: 20.0
        },
        assumptions: 'Remuneração de sucesso apurada mensalmente via protocolo determinístico de Medição e Verificação (M&V).',
        limitations: 'Não há promessa de economia garantida antes da auditoria das faturas reais da unidade consumidora.'
      };
    }

    if (params.agentId === 'AG-008') {
      return {
        approved: true,
        confidence_score: 0.96,
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
        audit_verdict: 'Entregável auditado pelo AG-008: premissas e limitações explícitas, sem promessas de economia garantida e em total conformidade com a REN ANEEL 1.000/2021.'
      };
    }

    return {
      status: 'completed',
      agent: params.agentId,
      summary: 'Análise técnica e operacional concluída conforme diretrizes do EI-AIOS.',
      assumptions: 'Baseado nos parâmetros regulatórios vigentes da ANEEL.',
      limitations: 'Estimativas sujeitas a validação com dados medidos da unidade consumidora.',
      timestamp: new Date().toISOString()
    };
  }
}

export const geminiService = new GeminiService();

