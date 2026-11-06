// ==============================================================================
// UNIT TESTS: DETERMINISTIC ENERGY CALCULATOR (Sem LLM)
// ANEEL REN 1.000/2021 Formulas Verification
// ==============================================================================

import test from 'node:test';
import assert from 'node:assert/strict';
import {
  calculateDemandAudit,
  calculateLoadFactor,
  calculateReactiveAudit,
  calculateModalityComparison,
  runEnergyAudit,
  DEFAULT_TARIFF_PARAMETERS
} from './energy-calculator.js';
import { TariffModality } from '@ei-aios/shared';

test('1. Demand Audit - Within 5% Tolerance (No Overage)', () => {
  // Contratada: 100 kW. Tolerância: 105 kW. Medida: 104 kW -> Sem multa
  const result = calculateDemandAudit(100, 104, 100, 24.50, 5.0, 30);
  assert.equal(result.has_overage, false);
  assert.equal(result.overage_kw, 0);
  assert.equal(result.overage_penalty_brl, 0);
  assert.equal(result.has_idle_demand, false);
});

test('2. Demand Audit - Exceeding 5% Tolerance (Overage Penalty applied)', () => {
  // Contratada: 100 kW. Tolerância: 105 kW. Medida: 115 kW -> Ultrapassagem = 115 - 100 = 15 kW
  // Multa = 15 kW * 2 * R$ 24.50 = R$ 735.00
  const result = calculateDemandAudit(100, 115, 100, 24.50, 5.0, 30);
  assert.equal(result.has_overage, true);
  assert.equal(result.overage_kw, 15);
  assert.equal(result.overage_penalty_brl, 735.00);
});

test('3. Demand Audit - Idle Contracted Demand (Sobrecontratação)', () => {
  // Contratada: 150 kW. Medida: 100 kW -> Ociosidade = 50 kW
  // Desperdício Mensal = 50 kW * R$ 24.50 = R$ 1225.00
  // Desperdício Anual = R$ 1225.00 * 12 = R$ 14700.00
  const result = calculateDemandAudit(150, 100, 95, 24.50, 5.0, 30);
  assert.equal(result.has_idle_demand, true);
  assert.equal(result.idle_demand_kw, 50);
  assert.equal(result.monthly_idle_waste_brl, 1225.00);
  assert.equal(result.annual_idle_waste_brl, 14700.00);
  // Recomendação com 5% de margem: 100 * 1.05 = 105 kW
  assert.equal(result.recommended_contracted_demand_kw, 105);
});

test('4. Load Factor (FC) Calculation and Rating', () => {
  // 730 horas/mês. Consumo: 73.000 kWh. Demanda Max: 200 kW
  // FC = 73000 / (200 * 730) = 0.50 -> Adequado
  const result = calculateLoadFactor(73000, 200, 730);
  assert.equal(result.load_factor, 0.5);
  assert.equal(result.rating, 'adequado');

  // FC Baixo (< 0.3)
  const resultLow = calculateLoadFactor(20000, 200, 730);
  assert.ok(resultLow.load_factor < 0.3);
  assert.equal(resultLow.rating, 'critico');
});

test('5. Reactive Power Audit and Capacitor Payback', () => {
  // Multa mensal: R$ 1.200,00
  // Custo Anual Evitável: R$ 1.200 * 12 = R$ 14.400,00
  const result = calculateReactiveAudit(1200.00, 3500);
  assert.equal(result.annual_penalty_brl, 14400.00);
  assert.equal(result.requires_capacitor_bank, true);
  assert.ok(result.payback_estimate_months > 0 && result.payback_estimate_months <= 12);
});

test('6. Modality Comparison - Verde vs Azul', () => {
  // Teste com perfil típico Verde: pouco consumo na ponta
  const comparison = calculateModalityComparison(
    TariffModality.HOROSSAZONAL_VERDE,
    100,
    95,
    90,
    2000,  // Ponta
    30000, // Fora Ponta
    DEFAULT_TARIFF_PARAMETERS
  );

  assert.ok(comparison.verde_annual_cost_brl > 0);
  assert.ok(comparison.azul_annual_cost_brl > 0);
  assert.equal(comparison.recommended_modality, TariffModality.HOROSSAZONAL_VERDE);
});

test('7. runEnergyAudit - Master Consolidated Audit', () => {
  const audit = runEnergyAudit({
    consumerUnitCode: 'UC-TEST-001',
    billingPeriod: '2024-05',
    currentModality: TariffModality.HOROSSAZONAL_VERDE,
    contractedDemandKw: 250,
    measuredDemandPeakKw: 280,
    measuredDemandOffpeakKw: 260,
    consumptionPeakKwh: 8000,
    consumptionOffpeakKwh: 45000,
    billedReactiveExcessBrl: 850.00,
    billedReactiveExcessKwh: 2100
  });

  assert.equal(audit.consumer_unit_code, 'UC-TEST-001');
  assert.ok(audit.demand_analysis.has_overage);
  assert.ok(audit.total_monthly_potential_savings_brl > 0);
  assert.ok(audit.total_annual_potential_savings_brl > 0);
});

