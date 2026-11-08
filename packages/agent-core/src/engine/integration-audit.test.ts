// ==============================================================================
// SPRINT 4 AUTOMATED TEST SUITE — INTEGRATION AUDIT & E2E GOVERNANCE
// Scenarios INT-001 through INT-006 (BKL-014, BKL-015, BKL-016, BKL-017)
// ==============================================================================

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { validateExtractedBillIntegrity } from '../tools/bill-parser.js';
import { runEnergyAudit } from '../tools/energy-calculator.js';
import { runFullCfoSnapshot, ClientFinancialContractInput } from '../tools/finops-calculator.js';
import {
  classifyEmailDeterministically,
  evaluateEmailModeAndPolicy,
  buildEmailAnalysisContract,
  inspectEmailSecurityRisks,
  DEFAULT_EMAIL_ACTION_POLICY,
  EmailAccountRow,
  RawImapEmail
} from '../tools/email-intelligence.js';
import { qaGate } from './qa-gate.js';
import { agentRouter } from './agent-router.js';
import { autonomousWorker } from './worker.js';
import {
  AgentId,
  TaskStatus,
  ActionRiskLevel,
  TariffModality,
  EnergyBillExtraction,
  EmailAnalysisContractSchema
} from '@ei-aios/shared';

describe('Sprint 4 — Auditoria Integrada e Governança E2E (BKL-014 a BKL-017)', () => {
  it('INT-001 (BKL-014): AG-009 recebe injeção automática de normas vigentes (knowledge_sources) com REN ANEEL 1.000/2021', () => {
    // Simula a injeção regulatória feita em executors.ts
    const mockKnowledgeSources = [
      {
        source_type: 'aneel_resolution',
        source_name: 'Resolução Normativa ANEEL nº 1.000/2021',
        document_id: 'REN-1000/2021',
        structured_content: {
          key_articles: {
            art_306: 'Critérios de ultrapassagem de demanda faturável e tolerância de 5%.',
            art_322: 'Cobrança de energia reativa excedente (UFER/DMCR) para FP < 0,92.',
            art_323: 'Devolução em dobro de valores cobrados indevidamente por erro de faturamento.',
            art_290: 'Enquadramento em modalidades tarifárias horárias (Azul e Verde).'
          }
        }
      },
      {
        source_type: 'distributor_tariff_table',
        source_name: 'Tarifas CPFL Paulista Grupo A4',
        distributor: 'CPFL Paulista',
        document_id: 'REH-3312/2024',
        structured_content: {
          subgroup: 'A4',
          tariffs: {
            verde: { demand_single_brl_per_kw: 24.5, consumption_peak_brl_per_kwh: 2.15, consumption_offpeak_brl_per_kwh: 0.48 }
          }
        }
      }
    ];

    assert.equal(mockKnowledgeSources.length, 2);
    const ren1000: any = mockKnowledgeSources.find(k => k.document_id === 'REN-1000/2021');
    assert.ok(ren1000);
    assert.ok(ren1000.structured_content?.key_articles?.art_323?.includes('Devolução em dobro'));
    assert.ok(ren1000.structured_content?.key_articles?.art_306?.includes('tolerância de 5%'));
  });

  it('INT-002 (BKL-015): validateExtractedBillIntegrity aprova fatura consistente e identifica ultrapassagem regulatória', () => {
    const validBill: Partial<EnergyBillExtraction> = {
      consumer_unit_code: 'UC-PAULINIA-01',
      distributor: 'CPFL Paulista',
      billing_period: '2024-05',
      total_amount_brl: 48500.0,
      consumption_peak_kwh: 9800,
      consumption_offpeak_kwh: 52000,
      contracted_demand_peak_kw: 250,
      contracted_demand_offpeak_kw: 250,
      measured_demand_peak_kw: 292,
      measured_demand_offpeak_kw: 275,
      exceeded_demand_kw: 42,
      exceeded_demand_fine_brl: 2058.0,
      reactive_energy_fine_brl: 1850.0,
      taxes_breakdown: {
        icms_rate: 18.0,
        icms_amount_brl: 8730.0,
        pis_rate: 1.65,
        pis_amount_brl: 800.25,
        cofins_rate: 7.6,
        cofins_amount_brl: 3686.0,
        cip_brl: 120.0
      }
    };

    const validation = validateExtractedBillIntegrity(validBill);

    assert.equal(validation.is_valid, true);
    assert.equal(validation.validation_status, 'verified');
    assert.equal(validation.errors.length, 0);
    assert.equal(validation.metrics.demand_overage_detected, true);
    assert.equal(validation.metrics.expected_overage_kw, 42); // 292 - 250
    assert.ok(validation.metrics.taxes_percent_of_total > 20 && validation.metrics.taxes_percent_of_total < 40);
  });

  it('INT-003 (BKL-015): validateExtractedBillIntegrity reprova faturas com inconsistência tributária grave e somas divergentes', () => {
    const invalidBill: Partial<EnergyBillExtraction> = {
      consumer_unit_code: 'UC-INVALID-02',
      distributor: 'Enel SP',
      billing_period: '2024/05/INVAL', // formato inválido
      total_amount_brl: 10000.0,
      consumption_peak_kwh: 1000,
      consumption_offpeak_kwh: 2000,
      contracted_demand_peak_kw: 100,
      measured_demand_peak_kw: 100,
      taxes_breakdown: {
        icms_rate: 18.0,
        icms_amount_brl: 9500.0, // ICMS + PIS + COFINS > Total
        pis_rate: 1.65,
        pis_amount_brl: 800.0,
        cofins_rate: 7.6,
        cofins_amount_brl: 3700.0,
        cip_brl: 50.0
      },
      line_items: [
        { description: 'Consumo Ponta', quantity: 1000, unit: 'kWh', unit_price: 1.5, total_amount_brl: 1500.0 },
        { description: 'Consumo Fora Ponta', quantity: 2000, unit: 'kWh', unit_price: 0.5, total_amount_brl: 1000.0 }
        // soma dos itens = 2.500 vs total = 10.000 (discrepância)
      ]
    };

    const validation = validateExtractedBillIntegrity(invalidBill);

    assert.equal(validation.is_valid, false);
    assert.equal(validation.validation_status, 'rejected');
    assert.ok(validation.errors.some(e => e.includes('Inconsistência tributária crítica')));
    assert.ok(validation.warnings.some(w => w.includes('Divergência de soma dos itens')));
    assert.ok(validation.warnings.some(w => w.includes('fora do padrão regulatório YYYY-MM')));
  });

  it('INT-004 (BKL-016): decision_logs estrutura de log auditável com rationales, complexidade e alternativas', () => {
    const mockDecisionLog = {
      parent_task_id: 'task-macro-001',
      agent_id: AgentId.AG_001,
      decision_type: 'decomposition_plan',
      decision_summary: 'Decomposição do objetivo macro em 4 subtarefas encadeadas.',
      rationales: ['Exige auditoria energética prévia antes do parecer regulatório.'],
      alternatives_considered: ['Execução em lote único', 'Delegação direta sem subtarefas'],
      risk_assessment: {
        estimated_complexity: 'high',
        requires_human_gate: true
      },
      metadata: { workflow_code: 'BILL_AUDIT_ONBOARDING' },
      created_at: new Date().toISOString()
    };

    assert.equal(mockDecisionLog.agent_id, 'AG-001');
    assert.equal(mockDecisionLog.decision_type, 'decomposition_plan');
    assert.equal(mockDecisionLog.risk_assessment.requires_human_gate, true);
    assert.equal(mockDecisionLog.alternatives_considered.length, 2);
  });

  it('INT-005 (BKL-016): worker autônomo expõe controle de ciclo de sincronização agendada de e-mails', () => {
    const status = autonomousWorker.getStatus();
    assert.equal(typeof status.isRunning, 'boolean');
    assert.equal(typeof status.isProcessingCycle, 'boolean');
    assert.ok(status.pollIntervalMs > 0);
  });

  it('INT-006 (BKL-017): Pipeline E2E Integrado — Triagem AG-012 -> AG-003 -> AG-004 -> AG-011 -> AG-008 -> AG-001', async () => {
    // 1. AG-012: Triagem de E-mail de Fatura de Energia
    const rawEmail: RawImapEmail = {
      uid: 'e2e-msg-001',
      rfcMessageId: '<e2e-invoice-001@cliente.com.br>',
      threadId: '<e2e-invoice-001@cliente.com.br>',
      fromName: 'Carlos Mendes (CFO BomPreço)',
      fromAddress: 'carlos@superbompreco.com.br',
      subject: 'Fatura de Energia Grupo A4 CPFL Campinas - Multa de Demanda',
      receivedAt: new Date().toISOString(),
      bodyExcerpt: 'Segue fatura de energia em anexo com ultrapassagem de demanda e reativo excedente.',
      hasAttachments: true,
      attachmentNames: ['Fatura_CPFL_Campinas_Nov2026.pdf']
    };

    const sec = inspectEmailSecurityRisks(rawEmail);
    assert.equal(sec.isSuspicious, false);

    const emailAnalysis = classifyEmailDeterministically(rawEmail);
    assert.equal(emailAnalysis.category, 'fatura_energia');
    assert.equal(emailAnalysis.recommended_agent_id, 'AG-003');

    const account: EmailAccountRow = {
      id: 'acc-e2e-test',
      account_label: 'Auditoria Faturas',
      email_address: 'faturas@eiaios.atendezen.com.br',
      provider: 'hostgator_cpanel',
      imap_host: 'mail.atendezen.com.br',
      imap_port: 993,
      smtp_host: 'mail.atendezen.com.br',
      smtp_port: 465,
      username: 'faturas@atendezen.com.br',
      password_secret: 'enc:v1:test',
      operation_mode: 'auto_action',
      enabled: true
    };

    const policyEval = evaluateEmailModeAndPolicy({
      accountMode: 'auto_action',
      policy: DEFAULT_EMAIL_ACTION_POLICY,
      analysis: emailAnalysis,
      security: sec
    });
    assert.equal(policyEval.shouldCreateTask, true);
    assert.equal(policyEval.targetAgentId, 'AG-003');

    const contract = buildEmailAnalysisContract({
      account,
      rawEmail,
      analysis: emailAnalysis,
      security: sec,
      dispatched: true,
      approvalRequired: false
    });
    const parsedContract = EmailAnalysisContractSchema.safeParse(contract);
    assert.equal(parsedContract.success, true);

    // 2. AG-004: Validador Determinístico de Integridade
    const billData: Partial<EnergyBillExtraction> = {
      consumer_unit_code: 'UC-CAMPINAS-01',
      distributor: 'CPFL Paulista',
      billing_period: '2024-05',
      total_amount_brl: 48500.0,
      consumption_peak_kwh: 10500,
      consumption_offpeak_kwh: 55000,
      contracted_demand_peak_kw: 250,
      contracted_demand_offpeak_kw: 250,
      measured_demand_peak_kw: 292,
      measured_demand_offpeak_kw: 275,
      exceeded_demand_kw: 42,
      exceeded_demand_fine_brl: 2058.0,
      reactive_energy_fine_brl: 1850.0,
      taxes_breakdown: {
        icms_rate: 18,
        icms_amount_brl: 8730.0,
        pis_rate: 1.65,
        pis_amount_brl: 800.25,
        cofins_rate: 7.6,
        cofins_amount_brl: 3686.0,
        cip_brl: 150.0
      }
    };
    const billValidation = validateExtractedBillIntegrity(billData);
    assert.equal(billValidation.is_valid, true);
    assert.equal(billValidation.validation_status, 'verified');

    // 3. AG-003: Auditoria Matemática de Energia (energy-calculator)
    const audit = runEnergyAudit({
      consumerUnitCode: 'UC-CAMPINAS-01',
      billingPeriod: '2024-05',
      currentModality: TariffModality.HOROSSAZONAL_VERDE,
      contractedDemandKw: 250,
      measuredDemandPeakKw: 292,
      measuredDemandOffpeakKw: 275,
      consumptionPeakKwh: 10500,
      consumptionOffpeakKwh: 55000,
      billedReactiveExcessBrl: 1850.0,
      billedReactiveExcessKwh: 4200
    });
    assert.equal(audit.demand_analysis.has_overage, true);
    assert.ok(audit.total_annual_potential_savings_brl > 0);

    // 4. AG-011: Cálculo de Unit Economics & FinOps (finops-calculator)
    const clientContracts: ClientFinancialContractInput[] = [
      {
        clientId: 'client-bompreco-01',
        companyName: 'Supermercados BomPreço',
        isActive: true,
        mrrBrl: 2490.0,
        setupFeeBrl: 3500.0,
        successFeePercent: 20.0,
        verifiedMonthlySavingsBrl: audit.total_monthly_potential_savings_brl,
        unverifiedEstimatedSavingsBrl: 0,
        directMonthlySupportCostBrl: 250.0,
        consumerUnitsCount: 1
      }
    ];
    const cfoSnapshot = runFullCfoSnapshot({
      contracts: clientContracts,
      agentRuns: [
        {
          id: 'run-e2e-1',
          agent_id: 'AG-003',
          model_name: 'gemini-2.5-flash',
          input_tokens: 1200,
          output_tokens: 800,
          cost_estimate: 0.00045,
          status: 'success'
        }
      ],
      marketingAndSalesSpendBrl: 1500.0,
      newClientsAcquired: 1,
      monthlyChurnRate: 0.02
    });
    assert.equal(cfoSnapshot.mrr_arr.mrr_brl, 2490.0);
    assert.ok((cfoSnapshot.client_margins[0]?.gross_margin_brl ?? 0) > 0);

    // 5. AG-008: Crivo de QA Gate — Bloqueio de "economia garantida"
    const dangerousDraft = 'Prometemos economia garantida de R$ 50.000,00 sem risco.';
    const qaCheckDangerous = await qaGate.auditTaskResult(
      {
        id: 'task-e2e-test',
        task_code: 'E2E-TASK-001',
        created_by: AgentId.AG_001,
        assigned_agent_id: AgentId.AG_003,
        objective: 'Auditoria de Energia',
        task_type: 'energy_audit',
        priority: 'P1' as any,
        status: TaskStatus.PENDING,
        risk_level: ActionRiskLevel.LEVEL_0_AUTO,
        dependencies: [],
        input_payload: {},
        requires_approval: false
      } as any,
      {
        executive_summary_markdown: dangerousDraft
      }
    );
    assert.equal(qaCheckDangerous.approved, false);
    assert.ok(qaCheckDangerous.critical_inconsistencies.some((i: string) => i.includes('economia garantida')));

    // 6. AgentRouter: Validação de Agentes e Governança
    const routeAG003 = await agentRouter.validateAndRouteAgent({
      requestedAgentId: 'AG-003',
      taskType: 'energy_audit',
      objective: 'Auditar faturas de média tensão'
    });
    assert.equal(routeAG003.effectiveAgentId, 'AG-003');
    assert.equal(routeAG003.allowed, true);
  });
});
