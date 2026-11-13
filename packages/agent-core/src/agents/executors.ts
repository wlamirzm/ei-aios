// ==============================================================================
// AGENT EXECUTORS: SPECIALIZED INVOCATIONS PER AGENT
// ==============================================================================

import { AgentId, TaskModel, ExecutionContext } from '@ei-aios/shared';
import { llmService } from '../config/llm.js';
import { supabase } from '../config/supabase.js';
import { getAgentDefinition } from './registry.js';
import { runEnergyAudit } from '../tools/energy-calculator.js';
import { calculateMeasurementAndVerification } from '../tools/mv-calculator.js';
import { runFullCfoSnapshot, ClientFinancialContractInput } from '../tools/finops-calculator.js';
import { validateExtractedBillIntegrity } from '../tools/bill-parser.js';
import { formatEnergyDiagnosisMarkdown, createAndSaveArtifact } from '../tools/artifact-writer.js';
import { runMarketIntelligenceAudit, runProspectIntelligenceDossier } from '../tools/web-intelligence.js';
import { SlideEngine } from '../tools/slide-engine.js';

export interface AgentExecutionResult {
  outputPayload: Record<string, any>;
  rawResponse?: string;
  deterministicData?: Record<string, any>;
  costUsd: number;
}

export async function executeAgentTask(task: TaskModel, context?: ExecutionContext): Promise<AgentExecutionResult> {
  const agentDef = await getAgentDefinition(task.assigned_agent_id);
  const input = task.input_payload || {};

  let deterministicContext: Record<string, any> | undefined = undefined;

  // 1. Execução de Ferramentas Determinísticas Pré-LLM
  if (task.assigned_agent_id === AgentId.AG_003 && input.contracted_demand_kw) {
    // AG-003: Executa energy-calculator.ts primeiro
    const auditResult = runEnergyAudit({
      consumerUnitCode: input.consumer_unit_code || 'UC-DEFAULT',
      billingPeriod: input.billing_period || '2024-05',
      currentModality: input.tariff_modality || 'HOROSSAZONAL_VERDE',
      contractedDemandKw: Number(input.contracted_demand_kw),
      measuredDemandPeakKw: Number(input.measured_demand_peak_kw || 0),
      measuredDemandOffpeakKw: Number(input.measured_demand_offpeak_kw || 0),
      consumptionPeakKwh: Number(input.consumption_peak_kwh || 0),
      consumptionOffpeakKwh: Number(input.consumption_offpeak_kwh || 0),
      billedReactiveExcessBrl: Number(input.reactive_energy_fine_brl || 0),
      billedReactiveExcessKwh: Number(input.reactive_energy_excess_kwh || 0)
    });
    deterministicContext = { deterministic_audit: auditResult };
  } else if (task.assigned_agent_id === AgentId.AG_010 && input.baseline_contracted_demand_kw) {
    // AG-010: Executa mv-calculator.ts primeiro
    const mvResult = calculateMeasurementAndVerification({
      consumerUnitCode: input.consumer_unit_code || 'UC-DEFAULT',
      billingPeriod: input.billing_period || '2024-05',
      baselineContractedDemandKw: Number(input.baseline_contracted_demand_kw),
      baselineHistoricalAvgMonthlyReactiveFineBrl: Number(input.baseline_historical_avg_reactive_fine_brl || 0),
      baselineHistoricalAvgMonthlyOverageFineBrl: Number(input.baseline_historical_avg_overage_fine_brl || 0),
      actualBilledTotalAmountBrl: Number(input.actual_billed_total_amount_brl || 0),
      actualContractedDemandKw: Number(input.actual_contracted_demand_kw || 0),
      actualMeasuredDemandPeakKw: Number(input.actual_measured_demand_peak_kw || 0),
      actualMeasuredDemandOffpeakKw: Number(input.actual_measured_demand_offpeak_kw || 0),
      actualConsumptionPeakKwh: Number(input.actual_consumption_peak_kwh || 0),
      actualConsumptionOffpeakKwh: Number(input.actual_consumption_offpeak_kwh || 0),
      currentDemandRateBrlPerKw: Number(input.current_demand_rate_brl_per_kw || 24.50),
      currentConsumptionPeakRateBrlPerKwh: Number(input.current_consumption_peak_rate_brl_per_kwh || 2.15),
      currentConsumptionOffpeakRateBrlPerKwh: Number(input.current_consumption_offpeak_rate_brl_per_kwh || 0.48),
      successFeePercent: Number(input.success_fee_percent || 20.00)
    });
    deterministicContext = { deterministic_mv: mvResult };
  } else if (task.assigned_agent_id === AgentId.AG_011) {
    // AG-011 (BKL-006 & BKL-007): Executa finops-calculator.ts com dados reais do PostgreSQL
    const [{ data: clientsRows }, { data: ucsRows }, { data: billsRows }, { data: runsRows }] = await Promise.all([
      supabase.from('clients').select('*'),
      supabase.from('consumer_units').select('id, client_id'),
      supabase.from('energy_bills').select('consumer_unit_id, potential_savings_brl, validation_status'),
      supabase.from('agent_runs').select('*')
    ]);

    const contracts: ClientFinancialContractInput[] = (clientsRows || []).map((c: any) => {
      const clientUcs = (ucsRows || []).filter((u: any) => u.client_id === c.id);
      const clientUcIds = new Set(clientUcs.map((u: any) => u.id));
      const clientBills = (billsRows || []).filter((b: any) => clientUcIds.has(b.consumer_unit_id));

      const verifiedSavings = clientBills
        .filter((b: any) => b.validation_status === 'verified_mv')
        .reduce((acc: number, b: any) => acc + Number(b.potential_savings_brl || 0), 0);

      const unverifiedSavings = clientBills
        .filter((b: any) => b.validation_status !== 'verified_mv')
        .reduce((acc: number, b: any) => acc + Number(b.potential_savings_brl || 0), 0);

      // S5-04: Eliminação de fallbacks fictícios (CFO-009). Diferenciação de zero vs ausente
      const isMissingMrr = c.mrr_brl === null || c.mrr_brl === undefined || isNaN(Number(c.mrr_brl));

      return {
        clientId: c.id,
        companyName: c.company_name || 'Cliente',
        isActive: c.stage !== 'churned',
        mrrBrl: isMissingMrr ? 0 : Number(c.mrr_brl),
        isMrrMissing: isMissingMrr,
        setupFeeBrl: c.setup_fee_brl != null && !isNaN(Number(c.setup_fee_brl)) ? Number(c.setup_fee_brl) : 0,
        successFeePercent: c.success_fee_percent != null && !isNaN(Number(c.success_fee_percent)) ? Number(c.success_fee_percent) : 0,
        verifiedMonthlySavingsBrl: input.verified_monthly_savings_brl != null ? Number(input.verified_monthly_savings_brl) : verifiedSavings,
        unverifiedEstimatedSavingsBrl: input.unverified_estimated_savings_brl != null ? Number(input.unverified_estimated_savings_brl) : unverifiedSavings,
        directMonthlySupportCostBrl: c.direct_monthly_cost_brl != null && !isNaN(Number(c.direct_monthly_cost_brl)) ? Number(c.direct_monthly_cost_brl) : 0,
        consumerUnitsCount: Math.max(1, clientUcs.length)
      };
    });

    const cfoSnapshot = runFullCfoSnapshot({
      contracts,
      agentRuns: (runsRows || []) as any[],
      marketingAndSalesSpendBrl: input.marketing_spend_brl ?? null,
      newClientsAcquired: input.new_clients_acquired ?? null,
      monthlyChurnRate: Number(input.monthly_churn_rate ?? 0)
    });

    deterministicContext = {
      cfo_deliverable: cfoSnapshot.cfo_deliverable,
      deterministic_cfo_snapshot: cfoSnapshot
    };
  } else if (task.assigned_agent_id === AgentId.AG_004) {
    // AG-004 (BKL-015): Validador determinístico de integridade de fatura (data_validator)
    const billToValidate = input.extracted_bill || input;
    const validation = validateExtractedBillIntegrity(billToValidate);
    deterministicContext = {
      deterministic_bill_validation: validation
    };
  } else if (task.assigned_agent_id === AgentId.AG_009) {
    // AG-009 (BKL-014): Injeção automática da base regulatória (knowledge_sources)
    const { data: knowledgeRows } = await supabase
      .from('knowledge_sources')
      .select('source_type, source_name, distributor, document_id, structured_content, metadata')
      .order('created_at', { ascending: false });

    const distHint = String(input.distributor || '').toLowerCase();
    const relevantSources = (knowledgeRows || []).filter((k: any) => {
      if (!k.distributor) return true; // normas federais / ANEEL gerais
      return distHint ? String(k.distributor).toLowerCase().includes(distHint) : true;
    });

    deterministicContext = {
      regulatory_knowledge: relevantSources.length > 0 ? relevantSources : knowledgeRows || []
    };
  } else if (task.assigned_agent_id === AgentId.AG_002) {
    // AG-002: Inteligência de Mercado, Análise de Concorrentes e Validação de ICP
    const query = input.market_query || input.query || task.objective || 'Mercado Livre de Energia Grupo A4';
    const sector = input.sector || input.target_sector || undefined;
    const competitors = input.competitors || input.target_competitors || undefined;
    const marketAudit = await runMarketIntelligenceAudit({
      query,
      sector,
      competitors
    });
    deterministicContext = {
      deterministic_market_intelligence: marketAudit
    };
  } else if (task.assigned_agent_id === AgentId.AG_007) {
    // AG-007: Prospecção B2B, Enriquecimento de Domínio e Qualificação de ICP
    const companyName = input.company_name || input.prospect_name || input.lead_name || 'Prospect Alvo';
    const domain = input.domain || input.prospect_domain || undefined;
    const rawText = input.raw_text || input.prospect_notes || undefined;
    const sector = input.sector || input.prospect_sector || undefined;
    const distributor = input.distributor || undefined;
    const estimatedUnitsCount = input.estimated_units_count || input.units_count || undefined;
    const targetSubgroup = input.target_subgroup || undefined;

    const prospectDossier = await runProspectIntelligenceDossier({
      companyName,
      domain,
      rawText,
      sector,
      distributor,
      estimatedUnitsCount,
      targetSubgroup
    });
    deterministicContext = {
      deterministic_prospect_intelligence: prospectDossier
    };
  } else if (task.assigned_agent_id === AgentId.AG_015) {
    // AG-015: Apresentações Executivas & Pitch Decks (SlideEngine)
    const clientName = input.client_name || input.company_name || 'Cliente B2B';
    const isInvestorDeck = input.deck_type === 'investor' || String(task.objective || '').toLowerCase().includes('investidor') || String(task.objective || '').toLowerCase().includes('captação');

    if (isInvestorDeck) {
      const [{ data: clientsRows }, { data: billsRows }] = await Promise.all([
        supabase.from('clients').select('mrr_brl'),
        supabase.from('energy_bills').select('potential_savings_brl')
      ]);
      const mrrTotal = (clientsRows || []).reduce((acc, c) => acc + (Number(c.mrr_brl) || 0), 0);
      const savingsTotal = (billsRows || []).reduce((acc, b) => acc + (Number(b.potential_savings_brl) || 0), 0);

      const investorDeck = SlideEngine.buildInvestorPitchDeck({
        mrrBrl: mrrTotal || 15000,
        clientsCount: clientsRows?.length || 5,
        totalSavingsFoundBrl: savingsTotal || 320000,
        askBrl: input.ask_brl || 'R$ 1.500.000'
      });
      const marpMarkdown = SlideEngine.generateMarpMarkdown(investorDeck);
      deterministicContext = {
        deterministic_slide_deck: investorDeck,
        marp_markdown: marpMarkdown
      };
    } else {
      const salesDeck = SlideEngine.buildSalesPitchDeck({
        clientName,
        annualSavingsBrl: Number(input.annual_savings_brl || input.total_annual_potential_savings_brl || 120000),
        monthlySavingsBrl: Number(input.monthly_savings_brl || input.total_monthly_potential_savings_brl || 10000),
        recommendedModality: input.recommended_modality || 'HOROSSAZONAL_VERDE',
        overageBrl: Number(input.overage_penalty_brl || input.overage_brl || 0),
        powerFineBrl: Number(input.reactive_fine_brl || input.power_fine_brl || 0),
        successFeePercent: Number(input.success_fee_percent || 20)
      });
      const marpMarkdown = SlideEngine.generateMarpMarkdown(salesDeck);
      deterministicContext = {
        deterministic_slide_deck: salesDeck,
        marp_markdown: marpMarkdown
      };
    }
  }

  // 2. Constrói o Prompt contextualizado para a LLM API
  // Sanitiza o input_payload removendo tokens e metadados internos de orquestração (lease_token)
  const sanitizedInput = { ...(task.input_payload || {}) };
  delete sanitizedInput.lease_token;

  const promptContext = {
    objective: task.objective,
    task_code: task.task_code,
    task_type: task.task_type,
    priority: task.priority,
    risk_level: task.risk_level,
    input_payload: sanitizedInput,
    deterministic_context: deterministicContext
  };

  const finalPrompt = `TAREFA OPERACIONAL EI-AIOS:
${JSON.stringify(promptContext, null, 2)}

Por favor, execute o objetivo com rigor técnico absoluto e formatação executiva corporativa de alto padrão.
Retorne exclusivamente um objeto JSON válido contendo obrigatoriamente:
- "deliverable_title": título executivo formal e corporativo do entregável
- "executive_summary_markdown": documento corporativo completo em Markdown estruturado com seções claras (ex.: "## 1. Sumário Executivo", "## 2. Análise Técnica & Estratégica", "## 3. Quadro de Indicadores / Arquitetura" com tabela Markdown "| Dimensão | Especificação | Impacto |", "## 4. Plano de Ação & Próximos Passos", e callouts "> **Destaque Executivo:** ..."). NUNCA utilize a expressão proibida "economia garantida".
- "recommended_actions": lista de ações práticas recomendadas
- "assumptions": lista de premissas técnicas adotadas
- "limitations": lista de limitações e ressalvas regulatórias
- além dos campos estruturados específicos da sua especialidade.`;

  // 3. Invocação LLM com propagação integral de contexto operacional e financeiro (S6-01)
  const effectiveClientId = task.client_id || context?.clientId || null;
  const effectiveConsumerUnitId =
    task.consumer_unit_id || task.input_payload?.consumer_unit_id || context?.consumerUnitId || null;
  const effectiveExecutionId = context?.executionId || task.input_payload?.lease_token || null;
  const isInternal = !effectiveClientId;

  const response = await llmService.generateStructuredContent({
    taskId: task.id,
    agentId: task.assigned_agent_id,
    clientId: effectiveClientId,
    consumerUnitId: effectiveConsumerUnitId,
    executionId: effectiveExecutionId,
    isInternal,
    origin: context?.origin || 'worker',
    model: agentDef.model,
    systemInstruction: agentDef.systemPrompt,
    prompt: finalPrompt,
    temperature: agentDef.temperature
  });

  const outputPayload = {
    ...response.data,
    ...(deterministicContext || {})
  };

  // 4. Se for AG-003 e houver auditoria determinística, gera artefato formatado
  if (task.assigned_agent_id === AgentId.AG_003 && deterministicContext?.deterministic_audit) {
    const reportMarkdown = formatEnergyDiagnosisMarkdown(
      deterministicContext.deterministic_audit,
      input.client_name || 'Cliente'
    );
    await createAndSaveArtifact({
      taskId: task.id,
      clientId: task.client_id,
      artifactType: 'energy_diagnosis',
      title: `Diagnóstico Energético - ${input.consumer_unit_code || task.task_code}`,
      summary: `Diagnóstico automatizado com potencial de economia de R$ ${deterministicContext.deterministic_audit.total_annual_potential_savings_brl.toLocaleString('pt-BR')}/ano.`,
      contentMarkdown: reportMarkdown,
      structuredData: deterministicContext.deterministic_audit,
      metadata: {
        created_by_agent: task.assigned_agent_id,
        task_code: task.task_code
      }
    });
  } else {
    const mappedType =
      task.assigned_agent_id === AgentId.AG_015
        ? 'pitch_deck'
        : task.assigned_agent_id === AgentId.AG_007
        ? 'commercial_proposal'
        : task.assigned_agent_id === AgentId.AG_009
        ? 'contest_dossier'
        : task.assigned_agent_id === AgentId.AG_003
        ? 'energy_diagnosis'
        : 'strategic_plan';

    const title = outputPayload.deliverable_title || `${task.assigned_agent_id} — ${task.objective.slice(0, 80)}`;
    const mdBody = deterministicContext?.marp_markdown
      ? deterministicContext.marp_markdown
      : outputPayload.executive_summary_markdown
      ? outputPayload.executive_summary_markdown
      : `# ${title}\n\n> **Agente Responsável:** ${task.assigned_agent_id} • **Objetivo:** ${task.objective}\n\n## Sumário Executivo\nEntregável técnico concluído e estruturado conforme padrões corporativos da Energy Intelligence.`;

    await createAndSaveArtifact({
      taskId: task.id,
      clientId: task.client_id,
      artifactType: mappedType,
      title: `${title} (${task.task_code})`,
      summary: `Entregável gerado por ${task.assigned_agent_id} para o objetivo: ${task.objective}`,
      contentMarkdown: mdBody,
      structuredData: outputPayload,
      metadata: {
        created_by_agent: task.assigned_agent_id,
        task_code: task.task_code
      }
    }).catch(() => {});
  }

  return {
    outputPayload,
    rawResponse: response.rawText,
    deterministicData: deterministicContext,
    costUsd: response.costEstimateUsd
  };
}

