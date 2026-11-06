// ==============================================================================
// DETERMINISTIC ENERGY CALCULATOR (Sem LLM / Pure Math)
// Regulatory compliance: Resolução Normativa ANEEL nº 1.000/2021
// ==============================================================================

import {
  DeterministicAuditResult,
  DemandAudit,
  LoadFactorAudit,
  ReactivePowerAudit,
  ModalityComparisonAudit,
  TariffModality
} from '@ei-aios/shared';

export interface TariffParameters {
  demandRateVerdeBrlPerKw: number;
  consumptionPeakVerdeBrlPerKwh: number;
  consumptionOffpeakVerdeBrlPerKwh: number;
  demandRateAzulPeakBrlPerKw: number;
  demandRateAzulOffpeakBrlPerKw: number;
  consumptionPeakAzulBrlPerKwh: number;
  consumptionOffpeakAzulBrlPerKwh: number;
  regulatoryTolerancePercent?: number; // Default: 5% (1.05)
  hoursPerMonth?: number;              // Default: 730h
  minimumContractedDemandKw?: number;  // Default: 30kW (Grupo A4)
}

export interface BillCalculationInput {
  consumerUnitCode: string;
  billingPeriod: string;
  currentModality: TariffModality;
  contractedDemandKw: number;
  measuredDemandPeakKw: number;
  measuredDemandOffpeakKw: number;
  consumptionPeakKwh: number;
  consumptionOffpeakKwh: number;
  billedReactiveExcessBrl?: number;
  billedReactiveExcessKwh?: number;
  tariffParameters?: Partial<TariffParameters>;
}

// Valores de referência regulatória padrão (CPFL / Enel Grupo A4)
export const DEFAULT_TARIFF_PARAMETERS: TariffParameters = {
  demandRateVerdeBrlPerKw: 24.50,
  consumptionPeakVerdeBrlPerKwh: 2.15,
  consumptionOffpeakVerdeBrlPerKwh: 0.48,
  demandRateAzulPeakBrlPerKw: 46.80,
  demandRateAzulOffpeakBrlPerKw: 18.20,
  consumptionPeakAzulBrlPerKwh: 0.68,
  consumptionOffpeakAzulBrlPerKwh: 0.45,
  regulatoryTolerancePercent: 5.0,
  hoursPerMonth: 730,
  minimumContractedDemandKw: 30
};

/**
 * 1. Calcula ultrapassagem de demanda e ociosidade contratual (REN 1.000/2021 ANEEL).
 */
export function calculateDemandAudit(
  contractedKw: number,
  measuredDemandPeakKw: number,
  measuredDemandOffpeakKw: number,
  demandRateBrlPerKw: number,
  tolerancePercent: number = 5.0,
  minDemandKw: number = 30
): DemandAudit {
  const maxMeasuredKw = Math.max(measuredDemandPeakKw, measuredDemandOffpeakKw);
  const toleranceMultiplier = 1 + (tolerancePercent / 100);
  const regulatoryToleranceKw = Math.round(contractedKw * toleranceMultiplier * 100) / 100;

  let hasOverage = false;
  let overageKw = 0;
  let overagePenaltyBrl = 0;

  // Se demanda medida exceder a tolerância regulatória de 5%
  if (maxMeasuredKw > regulatoryToleranceKw) {
    hasOverage = true;
    overageKw = Math.round((maxMeasuredKw - contractedKw) * 100) / 100;
    // Multa ANEEL = Demanda Ultrapassada * 2 * Tarifa da Demanda
    overagePenaltyBrl = Math.round(overageKw * 2 * demandRateBrlPerKw * 100) / 100;
  }

  let hasIdleDemand = false;
  let idleDemandKw = 0;
  let monthlyIdleWasteBrl = 0;

  // Se demanda medida for inferior à contratada (sobrecontratação)
  if (maxMeasuredKw < contractedKw) {
    hasIdleDemand = true;
    idleDemandKw = Math.round((contractedKw - maxMeasuredKw) * 100) / 100;
    // Piso de contratação técnica (mínimo 30kW para grupo A)
    const effectiveTarget = Math.max(maxMeasuredKw, minDemandKw);
    const reducibleDemand = Math.max(0, contractedKw - effectiveTarget);
    monthlyIdleWasteBrl = Math.round(reducibleDemand * demandRateBrlPerKw * 100) / 100;
  }

  const annualIdleWasteBrl = Math.round(monthlyIdleWasteBrl * 12 * 100) / 100;

  // Recomendação de demanda contratada ideal com margem de segurança de 5%
  const recommendedContractedDemandKw = Math.max(
    minDemandKw,
    Math.round(maxMeasuredKw * 1.05 * 10) / 10
  );

  return {
    contracted_kw: contractedKw,
    measured_kw: maxMeasuredKw,
    regulatory_tolerance_kw: regulatoryToleranceKw,
    has_overage: hasOverage,
    overage_kw: overageKw,
    overage_penalty_brl: overagePenaltyBrl,
    has_idle_demand: hasIdleDemand,
    idle_demand_kw: idleDemandKw,
    monthly_idle_waste_brl: monthlyIdleWasteBrl,
    annual_idle_waste_brl: annualIdleWasteBrl,
    recommended_contracted_demand_kw: recommendedContractedDemandKw
  };
}

/**
 * 2. Calcula Fator de Carga (FC = Consumo / (Demanda_Max * Horas_Mês)).
 */
export function calculateLoadFactor(
  totalConsumptionKwh: number,
  maxMeasuredDemandKw: number,
  hoursPerMonth: number = 730
): LoadFactorAudit {
  if (maxMeasuredDemandKw <= 0 || totalConsumptionKwh <= 0) {
    return {
      total_consumption_kwh: totalConsumptionKwh,
      max_measured_demand_kw: maxMeasuredDemandKw,
      monthly_hours: hoursPerMonth,
      load_factor: 0,
      rating: 'critico',
      diagnosis: 'Consumo ou demanda zerada; impossível mensurar fator de carga.'
    };
  }

  const rawFc = totalConsumptionKwh / (maxMeasuredDemandKw * hoursPerMonth);
  const loadFactor = Math.round(Math.min(1, Math.max(0, rawFc)) * 1000) / 1000;

  let rating: 'critico' | 'baixo' | 'adequado' | 'excelente';
  let diagnosis: string;

  if (loadFactor < 0.30) {
    rating = 'critico';
    diagnosis = 'Fator de carga muito baixo (<0.30). Operação com picos pontuais severos e capacidade ociosa na maior parte do tempo.';
  } else if (loadFactor < 0.50) {
    rating = 'baixo';
    diagnosis = 'Fator de carga baixo (0.30 - 0.50). Potencial de modulação de carga para transferir processos para fora de ponta.';
  } else if (loadFactor < 0.70) {
    rating = 'adequado';
    diagnosis = 'Fator de carga adequado (0.50 - 0.70). Utilização consistente da demanda contratada.';
  } else {
    rating = 'excelente';
    diagnosis = 'Fator de carga excelente (>0.70). Alta eficiência e aproveitamento contínuo da infraestrutura instalada.';
  }

  return {
    total_consumption_kwh: totalConsumptionKwh,
    max_measured_demand_kw: maxMeasuredDemandKw,
    monthly_hours: hoursPerMonth,
    load_factor: loadFactor,
    rating,
    diagnosis
  };
}

/**
 * 3. Análise de Energia Reativa Excedente e Payback de Banco de Capacitores.
 */
export function calculateReactiveAudit(
  monthlyReactiveFineBrl: number = 0,
  excessReactiveKwh: number = 0
): ReactivePowerAudit {
  const annualPenaltyBrl = Math.round(monthlyReactiveFineBrl * 12 * 100) / 100;
  const requiresCapacitorBank = monthlyReactiveFineBrl > 50.00;

  // Custo estimado de um banco de capacitores automático proporcional à multa
  // Regra empírica do setor: o investimento costuma se pagar entre 4 e 10 meses
  let paybackMonths = 0;
  if (monthlyReactiveFineBrl > 0) {
    const estimatedBankCost = Math.max(1500, monthlyReactiveFineBrl * 6.5);
    paybackMonths = Math.round((estimatedBankCost / monthlyReactiveFineBrl) * 10) / 10;
  }

  return {
    excess_reactive_kwh: excessReactiveKwh,
    monthly_fine_brl: monthlyReactiveFineBrl,
    annual_penalty_brl: annualPenaltyBrl,
    annual_avoidable_cost_brl: annualPenaltyBrl,
    requires_capacitor_bank: requiresCapacitorBank,
    payback_estimate_months: paybackMonths
  };
}

/**
 * 4. Comparativo de Enquadramento Horossazonal: Tarifa Verde vs. Tarifa Azul.
 */
export function calculateModalityComparison(
  currentModality: TariffModality,
  contractedDemandKw: number,
  measuredDemandPeakKw: number,
  measuredDemandOffpeakKw: number,
  consumptionPeakKwh: number,
  consumptionOffpeakKwh: number,
  params: TariffParameters
): ModalityComparisonAudit {
  const demandToUse = Math.max(contractedDemandKw, Math.max(measuredDemandPeakKw, measuredDemandOffpeakKw));

  // Custo Mensal na Modalidade Verde (Demanda única + Consumo Ponta + Consumo Fora Ponta)
  const verdeDemandCostMonthly = demandToUse * params.demandRateVerdeBrlPerKw;
  const verdeConsPeakCostMonthly = consumptionPeakKwh * params.consumptionPeakVerdeBrlPerKwh;
  const verdeConsOffpeakCostMonthly = consumptionOffpeakKwh * params.consumptionOffpeakVerdeBrlPerKwh;
  const verdeTotalMonthly = verdeDemandCostMonthly + verdeConsPeakCostMonthly + verdeConsOffpeakCostMonthly;
  const verdeAnnualCost = Math.round(verdeTotalMonthly * 12 * 100) / 100;

  // Custo Mensal na Modalidade Azul (Demanda Ponta + Demanda Fora Ponta + Consumos com tarifa de energia Azul)
  const azulDemandPeakCostMonthly = demandToUse * params.demandRateAzulPeakBrlPerKw;
  const azulDemandOffpeakCostMonthly = demandToUse * params.demandRateAzulOffpeakBrlPerKw;
  const azulConsPeakCostMonthly = consumptionPeakKwh * params.consumptionPeakAzulBrlPerKwh;
  const azulConsOffpeakCostMonthly = consumptionOffpeakKwh * params.consumptionOffpeakAzulBrlPerKwh;
  const azulTotalMonthly = azulDemandPeakCostMonthly + azulDemandOffpeakCostMonthly + azulConsPeakCostMonthly + azulConsOffpeakCostMonthly;
  const azulAnnualCost = Math.round(azulTotalMonthly * 12 * 100) / 100;

  let recommendedModality: TariffModality;
  let annualSavingsBrl: number;
  let monthlySavingsBrl: number;
  let rationale: string;

  if (verdeAnnualCost < azulAnnualCost) {
    recommendedModality = TariffModality.HOROSSAZONAL_VERDE;
    annualSavingsBrl = Math.round((azulAnnualCost - verdeAnnualCost) * 100) / 100;
    monthlySavingsBrl = Math.round((annualSavingsBrl / 12) * 100) / 100;
    rationale = `A Modalidade Horossazonal Verde projeta menor custo anual (R$ ${verdeAnnualCost.toLocaleString('pt-BR')}) versus Azul (R$ ${azulAnnualCost.toLocaleString('pt-BR')}) devido ao perfil de consumo com moderada concentração na ponta e tarifa de demanda única.`;
  } else {
    recommendedModality = TariffModality.HOROSSAZONAL_AZUL;
    annualSavingsBrl = Math.round((verdeAnnualCost - azulAnnualCost) * 100) / 100;
    monthlySavingsBrl = Math.round((annualSavingsBrl / 12) * 100) / 100;
    rationale = `A Modalidade Horossazonal Azul projeta menor custo anual (R$ ${azulAnnualCost.toLocaleString('pt-BR')}) versus Verde (R$ ${verdeAnnualCost.toLocaleString('pt-BR')}) em função do volume expressivo de consumo no horário de ponta onde o kWh da tarifa Azul é significativamente mais baixo.`;
  }

  // Se a modalidade recomendada for a atual, a economia adicional em migração de modalidade é 0
  const effectiveMonthlySavings = recommendedModality === currentModality ? 0 : monthlySavingsBrl;
  const effectiveAnnualSavings = recommendedModality === currentModality ? 0 : annualSavingsBrl;

  return {
    current_modality: currentModality,
    verde_annual_cost_brl: verdeAnnualCost,
    azul_annual_cost_brl: azulAnnualCost,
    recommended_modality: recommendedModality,
    monthly_savings_brl: effectiveMonthlySavings,
    annual_savings_brl: effectiveAnnualSavings,
    recommendation_rationale: rationale
  };
}

/**
 * Função Mestre: Executa a auditoria determinística completa consolidando todos os 4 pilares.
 */
export function runEnergyAudit(input: BillCalculationInput): DeterministicAuditResult {
  const params: TariffParameters = {
    ...DEFAULT_TARIFF_PARAMETERS,
    ...(input.tariffParameters || {})
  };

  const totalConsumptionKwh = input.consumptionPeakKwh + input.consumptionOffpeakKwh;
  const maxMeasuredDemandKw = Math.max(input.measuredDemandPeakKw, input.measuredDemandOffpeakKw);
  const activeDemandRate = input.currentModality === TariffModality.HOROSSAZONAL_AZUL
    ? params.demandRateAzulOffpeakBrlPerKw
    : params.demandRateVerdeBrlPerKw;

  // 1. Demanda e Ultrapassagem
  const demandAnalysis = calculateDemandAudit(
    input.contractedDemandKw,
    input.measuredDemandPeakKw,
    input.measuredDemandOffpeakKw,
    activeDemandRate,
    params.regulatoryTolerancePercent,
    params.minimumContractedDemandKw
  );

  // 2. Fator de Carga
  const loadFactorAnalysis = calculateLoadFactor(
    totalConsumptionKwh,
    maxMeasuredDemandKw,
    params.hoursPerMonth
  );

  // 3. Reativo Excedente
  const reactiveAnalysis = calculateReactiveAudit(
    input.billedReactiveExcessBrl || 0,
    input.billedReactiveExcessKwh || 0
  );

  // 4. Comparativo de Enquadramento Horossazonal
  const modalityComparison = calculateModalityComparison(
    input.currentModality,
    input.contractedDemandKw,
    input.measuredDemandPeakKw,
    input.measuredDemandOffpeakKw,
    input.consumptionPeakKwh,
    input.consumptionOffpeakKwh,
    params
  );

  // Potencial Total de Economia Consolidada
  const totalMonthlyPotential = Math.round(
    (demandAnalysis.overage_penalty_brl +
      demandAnalysis.monthly_idle_waste_brl +
      reactiveAnalysis.monthly_fine_brl +
      modalityComparison.monthly_savings_brl) * 100
  ) / 100;

  const totalAnnualPotential = Math.round(
    (demandAnalysis.overage_penalty_brl * 12 +
      demandAnalysis.annual_idle_waste_brl +
      reactiveAnalysis.annual_penalty_brl +
      modalityComparison.annual_savings_brl) * 100
  ) / 100;

  return {
    consumer_unit_code: input.consumerUnitCode,
    billing_period: input.billingPeriod,
    demand_analysis: demandAnalysis,
    load_factor_analysis: loadFactorAnalysis,
    reactive_analysis: reactiveAnalysis,
    modality_comparison: modalityComparison,
    total_monthly_potential_savings_brl: totalMonthlyPotential,
    total_annual_potential_savings_brl: totalAnnualPotential,
    audit_timestamp: new Date().toISOString()
  };
}

