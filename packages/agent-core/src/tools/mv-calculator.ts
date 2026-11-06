// ==============================================================================
// DETERMINISTIC M&V CALCULATOR (Measurement & Verification / IPMVP Compliant)
// Pure TypeScript - No LLM
// ==============================================================================

import { MVCalculation } from '@ei-aios/shared';

export interface MVCalculationInput {
  consumerUnitCode: string;
  billingPeriod: string;
  
  // Condição Antiga (Baseline pré-consultoria):
  // Demanda que era contratada antes, modalidade antiga, multas recorrentes
  baselineContractedDemandKw: number;
  baselineHistoricalAvgMonthlyReactiveFineBrl?: number;
  baselineHistoricalAvgMonthlyOverageFineBrl?: number;
  
  // Fatura Atual (Pós-implementação das ações):
  actualBilledTotalAmountBrl: number;
  actualContractedDemandKw: number;
  actualMeasuredDemandPeakKw: number;
  actualMeasuredDemandOffpeakKw: number;
  actualConsumptionPeakKwh: number;
  actualConsumptionOffpeakKwh: number;
  actualReactiveFineBrl?: number;
  actualOverageFineBrl?: number;
  
  // Tarifas vigentes para simulação justa do baseline:
  currentDemandRateBrlPerKw: number;
  currentConsumptionPeakRateBrlPerKwh: number;
  currentConsumptionOffpeakRateBrlPerKwh: number;
  
  // Contrato Comercial:
  successFeePercent: number; // Ex: 20.00 (%)
}

/**
 * Calcula a Medição e Verificação (M&V) determinística.
 * Compara o que o cliente gastaria hoje SE ainda estivesse com a configuração antiga
 * versus o valor que efetivamente foi faturado pela concessionária.
 */
export function calculateMeasurementAndVerification(input: MVCalculationInput): MVCalculation {
  const maxActualMeasuredKw = Math.max(
    input.actualMeasuredDemandPeakKw,
    input.actualMeasuredDemandOffpeakKw
  );

  // 1. Simulação do Cenário Baseline na Tarifa Atual:
  // Custo de demanda que ele pagaria com o contrato antigo
  const simulatedBaselineDemandCost = input.baselineContractedDemandKw * input.currentDemandRateBrlPerKw;
  
  // Se com o contrato antigo ele teria ultrapassagem para a carga atual
  let simulatedBaselineOveragePenalty = 0;
  if (maxActualMeasuredKw > input.baselineContractedDemandKw * 1.05) {
    const simulatedOverageKw = maxActualMeasuredKw - input.baselineContractedDemandKw;
    simulatedBaselineOveragePenalty = simulatedOverageKw * 2 * input.currentDemandRateBrlPerKw;
  } else if (input.baselineHistoricalAvgMonthlyOverageFineBrl) {
    simulatedBaselineOveragePenalty = input.baselineHistoricalAvgMonthlyOverageFineBrl;
  }

  // Custo de consumo de energia
  const simulatedConsumptionCost =
    (input.actualConsumptionPeakKwh * input.currentConsumptionPeakRateBrlPerKwh) +
    (input.actualConsumptionOffpeakKwh * input.currentConsumptionOffpeakRateBrlPerKwh);

  // Multa de reativo que ele tomava no baseline histórico (se não corrigido)
  const simulatedBaselineReactiveFine = input.baselineHistoricalAvgMonthlyReactiveFineBrl || 0;

  // Custo Total que o cliente pagaria no cenário baseline com as tarifas de hoje
  const baselineCostSimulatedBrl = Math.round(
    (simulatedBaselineDemandCost +
     simulatedBaselineOveragePenalty +
     simulatedConsumptionCost +
     simulatedBaselineReactiveFine) * 100
  ) / 100;

  // 2. Custo Efetivo Faturado Atual
  const actualBilledCostBrl = Math.round(input.actualBilledTotalAmountBrl * 100) / 100;

  // 3. Custo Evitado Real (Economia Gerada no Mês)
  // Custo Evitado = Custo Simulado Baseline - Custo Real Faturado Atual
  const avoidedCostRaw = baselineCostSimulatedBrl - actualBilledCostBrl;
  const avoidedCostBrl = Math.round(avoidedCostRaw * 100) / 100;

  // 4. Success Fee Devido (apenas sobre economia líquida positiva)
  const isVerifiedPositiveSaving = avoidedCostBrl > 0;
  const successFeeRate = Math.min(100, Math.max(0, input.successFeePercent));
  const successFeeDueBrl = isVerifiedPositiveSaving
    ? Math.round((avoidedCostBrl * (successFeeRate / 100)) * 100) / 100
    : 0;

  // 5. Economia Líquida Retida pelo Cliente
  const netClientSavingsBrl = Math.round((avoidedCostBrl - successFeeDueBrl) * 100) / 100;

  const calculationFormula = `Custo Evitado (R$ ${avoidedCostBrl.toLocaleString('pt-BR')}) = Baseline Simulado Tarifa Atual (R$ ${baselineCostSimulatedBrl.toLocaleString('pt-BR')}) - Custo Real Faturado (R$ ${actualBilledCostBrl.toLocaleString('pt-BR')}) | Success Fee (${successFeeRate}%): R$ ${successFeeDueBrl.toLocaleString('pt-BR')}`;

  return {
    consumer_unit_code: input.consumerUnitCode,
    billing_period: input.billingPeriod,
    baseline_cost_simulated_brl: baselineCostSimulatedBrl,
    actual_billed_cost_brl: actualBilledCostBrl,
    avoided_cost_brl: avoidedCostBrl,
    success_fee_percent: successFeeRate,
    success_fee_due_brl: successFeeDueBrl,
    net_client_savings_brl: netClientSavingsBrl,
    calculation_formula: calculationFormula,
    is_verified_positive_saving: isVerifiedPositiveSaving
  };
}

