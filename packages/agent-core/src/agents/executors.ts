// ==============================================================================
// AGENT EXECUTORS: SPECIALIZED INVOCATIONS PER AGENT
// ==============================================================================

import { AgentId, TaskModel } from '@ei-aios/shared';
import { geminiService } from '../config/gemini.js';
import { getAgentDefinition } from './registry.js';
import { runEnergyAudit } from '../tools/energy-calculator.js';
import { calculateMeasurementAndVerification } from '../tools/mv-calculator.js';
import { formatEnergyDiagnosisMarkdown, createAndSaveArtifact } from '../tools/artifact-writer.js';

export interface AgentExecutionResult {
  outputPayload: Record<string, any>;
  rawResponse?: string;
  deterministicData?: Record<string, any>;
  costUsd: number;
}

export async function executeAgentTask(task: TaskModel): Promise<AgentExecutionResult> {
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
  }

  // 2. Constrói o Prompt contextualizado para a Gemini API
  const promptContext = {
    objective: task.objective,
    task_code: task.task_code,
    task_type: task.task_type,
    priority: task.priority,
    risk_level: task.risk_level,
    input_payload: input,
    deterministic_context: deterministicContext
  };

  const finalPrompt = `TAREFA OPERACIONAL EI-AIOS:
${JSON.stringify(promptContext, null, 2)}

Por favor, execute o objetivo com rigor técnico absoluto. Retorne exclusivamente JSON válido.`;

  // 3. Invocação ao Gemini
  const response = await geminiService.generateStructuredContent({
    taskId: task.id,
    agentId: task.assigned_agent_id,
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
      structuredData: deterministicContext.deterministic_audit
    });
  }

  return {
    outputPayload,
    rawResponse: response.rawText,
    deterministicData: deterministicContext,
    costUsd: response.costEstimateUsd
  };
}

