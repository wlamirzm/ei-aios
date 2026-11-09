// ==============================================================================
// SHARED ZOD SCHEMAS: ENERGY INTELLIGENCE AIOS (EI-AIOS)
// ==============================================================================

import { z } from 'zod';
import {
  TaskStatus,
  PriorityLevel,
  ActionRiskLevel,
  AgentId,
  WorkflowCode,
  TariffGroup,
  TariffModality,
  TariffFlag,
  ArtifactType,
  ApprovalStatus,
  ApprovalType,
  ClientStage
} from './enums.js';

// ------------------------------------------------------------------------------
// 1. BASE ENUMS AS ZOD SCHEMAS
// ------------------------------------------------------------------------------
export const TaskStatusSchema = z.nativeEnum(TaskStatus);
export const PriorityLevelSchema = z.nativeEnum(PriorityLevel);
export const ActionRiskLevelSchema = z.nativeEnum(ActionRiskLevel);
export const AgentIdSchema = z.nativeEnum(AgentId);
export const WorkflowCodeSchema = z.nativeEnum(WorkflowCode);
export const TariffGroupSchema = z.nativeEnum(TariffGroup);
export const TariffModalitySchema = z.nativeEnum(TariffModality);
export const TariffFlagSchema = z.nativeEnum(TariffFlag);
export const ArtifactTypeSchema = z.nativeEnum(ArtifactType);
export const ApprovalStatusSchema = z.nativeEnum(ApprovalStatus);
export const ApprovalTypeSchema = z.nativeEnum(ApprovalType);
export const ClientStageSchema = z.nativeEnum(ClientStage);

// ------------------------------------------------------------------------------
// 2. TASK ENVELOPE SCHEMA (Core Execution Contract)
// ------------------------------------------------------------------------------
export const TaskEnvelopeSchema = z.object({
  id: z.string().uuid().optional(),
  task_code: z.string().min(3),
  workflow_code: WorkflowCodeSchema.optional().nullable(),
  parent_task_id: z.string().uuid().optional().nullable(),
  client_id: z.string().uuid().optional().nullable(),
  created_by: z.string().min(1),
  assigned_agent_id: AgentIdSchema,
  objective: z.string().min(5),
  task_type: z.string().min(2),
  priority: PriorityLevelSchema.default(PriorityLevel.P1),
  status: TaskStatusSchema.default(TaskStatus.PENDING),
  risk_level: ActionRiskLevelSchema.default(ActionRiskLevel.LEVEL_0_AUTO),
  dependencies: z.array(z.string().uuid()).default([]),
  retry_count: z.number().int().nonnegative().default(0),
  max_retries: z.number().int().positive().default(2),
  input_payload: z.record(z.any()).default({}),
  expected_output: z.object({
    format: z.string().default('json'),
    schema_version: z.string().default('1.0')
  }).passthrough().default({ format: 'json', schema_version: '1.0' }),
  result_payload: z.record(z.any()).optional().nullable(),
  qa_review_payload: z.record(z.any()).optional().nullable(),
  requires_approval: z.boolean().default(false),
  approval_reason: z.string().optional().nullable(),
  created_at: z.string().datetime().optional(),
  started_at: z.string().datetime().optional().nullable(),
  completed_at: z.string().datetime().optional().nullable()
});

// ------------------------------------------------------------------------------
// 3. AG-001 ORCHESTRATOR DECOMPOSITION PLAN SCHEMA
// ------------------------------------------------------------------------------
export const DecomposedSubtaskSchema = z.object({
  task_code: z.string(),
  assigned_agent_id: AgentIdSchema,
  objective: z.string(),
  task_type: z.string(),
  priority: PriorityLevelSchema,
  risk_level: ActionRiskLevelSchema,
  dependencies_task_codes: z.array(z.string()).default([]),
  input_payload: z.record(z.any()).default({}),
  requires_approval: z.boolean().default(false),
  approval_reason: z.string().optional()
});

export const OrchestratorPlanSchema = z.object({
  macro_objective: z.string(),
  workflow_code: WorkflowCodeSchema.optional(),
  reasoning_summary: z.string(),
  decomposed_tasks: z.array(DecomposedSubtaskSchema).min(1),
  estimated_complexity: z.enum(['low', 'medium', 'high', 'critical']),
  requires_human_gate: z.boolean().default(false)
});

// ------------------------------------------------------------------------------
// 4. ENERGY BILL EXTRACTION SCHEMA (Multimodal OCR / Parser Output)
// ------------------------------------------------------------------------------
export const BillTaxesBreakdownSchema = z.object({
  icms_rate: z.number().nonnegative().default(0),
  icms_amount_brl: z.number().nonnegative().default(0),
  pis_rate: z.number().nonnegative().default(0),
  pis_amount_brl: z.number().nonnegative().default(0),
  cofins_rate: z.number().nonnegative().default(0),
  cofins_amount_brl: z.number().nonnegative().default(0),
  cip_brl: z.number().nonnegative().default(0) // Contribuição Iluminação Pública
});

export const BillLineItemSchema = z.object({
  description: z.string(),
  quantity: z.number().default(0),
  unit: z.string().default(''),
  unit_price: z.number().default(0),
  total_amount_brl: z.number().default(0)
});

export const EnergyBillExtractionSchema = z.object({
  consumer_unit_code: z.string(),
  distributor: z.string(),
  tariff_group: TariffGroupSchema.default(TariffGroup.A4),
  tariff_modality: TariffModalitySchema.default(TariffModality.HOROSSAZONAL_VERDE),
  billing_period: z.string().regex(/^\d{4}-\d{2}$/, 'Formato YYYY-MM obrigatório'),
  due_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
  total_amount_brl: z.number().positive(),
  consumption_peak_kwh: z.number().nonnegative().default(0),
  consumption_offpeak_kwh: z.number().nonnegative().default(0),
  measured_demand_peak_kw: z.number().nonnegative().default(0),
  measured_demand_offpeak_kw: z.number().nonnegative().default(0),
  contracted_demand_peak_kw: z.number().nonnegative().default(0),
  contracted_demand_offpeak_kw: z.number().nonnegative().default(0),
  billed_demand_peak_kw: z.number().nonnegative().default(0),
  billed_demand_offpeak_kw: z.number().nonnegative().default(0),
  exceeded_demand_kw: z.number().nonnegative().default(0),
  exceeded_demand_fine_brl: z.number().nonnegative().default(0),
  reactive_energy_excess_kwh: z.number().nonnegative().default(0),
  reactive_energy_fine_brl: z.number().nonnegative().default(0),
  tariff_flag: TariffFlagSchema.default(TariffFlag.VERDE),
  taxes_breakdown: BillTaxesBreakdownSchema.default({
    icms_rate: 0,
    icms_amount_brl: 0,
    pis_rate: 0,
    pis_amount_brl: 0,
    cofins_rate: 0,
    cofins_amount_brl: 0,
    cip_brl: 0
  }),
  line_items: z.array(BillLineItemSchema).default([]),
  confidence_score: z.number().min(0).max(1).default(0.95),
  extraction_notes: z.string().optional()
});

// ------------------------------------------------------------------------------
// 5. DETERMINISTIC AUDIT RESULT SCHEMA (Calculators Output)
// ------------------------------------------------------------------------------
export const DemandAuditSchema = z.object({
  contracted_kw: z.number().nonnegative(),
  measured_kw: z.number().nonnegative(),
  regulatory_tolerance_kw: z.number().nonnegative(), // 1.05 * contracted
  has_overage: z.boolean(),
  overage_kw: z.number().nonnegative(),
  overage_penalty_brl: z.number().nonnegative(),
  has_idle_demand: z.boolean(),
  idle_demand_kw: z.number().nonnegative(),
  monthly_idle_waste_brl: z.number().nonnegative(),
  annual_idle_waste_brl: z.number().nonnegative(),
  recommended_contracted_demand_kw: z.number().nonnegative()
});

export const LoadFactorAuditSchema = z.object({
  total_consumption_kwh: z.number().nonnegative(),
  max_measured_demand_kw: z.number().nonnegative(),
  monthly_hours: z.number().default(730),
  load_factor: z.number().min(0).max(1),
  rating: z.enum(['critico', 'baixo', 'adequado', 'excelente']),
  diagnosis: z.string()
});

export const ReactivePowerAuditSchema = z.object({
  excess_reactive_kwh: z.number().nonnegative(),
  monthly_fine_brl: z.number().nonnegative(),
  annual_penalty_brl: z.number().nonnegative(),
  annual_avoidable_cost_brl: z.number().nonnegative(),
  requires_capacitor_bank: z.boolean(),
  payback_estimate_months: z.number().nonnegative()
});

export const ModalityComparisonAuditSchema = z.object({
  current_modality: TariffModalitySchema,
  verde_annual_cost_brl: z.number().nonnegative(),
  azul_annual_cost_brl: z.number().nonnegative(),
  recommended_modality: TariffModalitySchema,
  monthly_savings_brl: z.number().nonnegative(),
  annual_savings_brl: z.number().nonnegative(),
  recommendation_rationale: z.string()
});

export const DeterministicAuditResultSchema = z.object({
  consumer_unit_code: z.string(),
  billing_period: z.string(),
  demand_analysis: DemandAuditSchema,
  load_factor_analysis: LoadFactorAuditSchema,
  reactive_analysis: ReactivePowerAuditSchema,
  modality_comparison: ModalityComparisonAuditSchema,
  total_monthly_potential_savings_brl: z.number().nonnegative(),
  total_annual_potential_savings_brl: z.number().nonnegative(),
  audit_timestamp: z.string()
});

// ------------------------------------------------------------------------------
// 6. M&V (MEASUREMENT & VERIFICATION) SCHEMA (mv-calculator.ts)
// ------------------------------------------------------------------------------
export const MVCalculationSchema = z.object({
  consumer_unit_code: z.string(),
  billing_period: z.string(),
  baseline_cost_simulated_brl: z.number().nonnegative(),
  actual_billed_cost_brl: z.number().nonnegative(),
  avoided_cost_brl: z.number(), // Pode ser 0 ou positivo
  success_fee_percent: z.number().min(0).max(100),
  success_fee_due_brl: z.number().nonnegative(),
  net_client_savings_brl: z.number(),
  calculation_formula: z.string(),
  is_verified_positive_saving: z.boolean()
});

// ------------------------------------------------------------------------------
// 7. AG-008 QUALITY & RISK AUDIT SCHEMA (QA Gate)
// ------------------------------------------------------------------------------
export const QAReviewSchema = z.object({
  approved: z.boolean(),
  confidence_score: z.number().min(0).max(1),
  critical_inconsistencies: z.array(z.string()).default([]),
  traceability_check: z.object({
    has_deterministic_math_backing: z.boolean(),
    calculation_memory_present: z.boolean()
  }),
  safety_compliance: z.object({
    no_false_guarantees: z.boolean(),
    assumptions_declared: z.boolean(),
    limitations_explicit: z.boolean(),
    aneel_ren_1000_compliant: z.boolean(),
    lgpd_compliant: z.boolean()
  }),
  risk_level_evaluated: ActionRiskLevelSchema,
  requires_human_approval: z.boolean(),
  audit_verdict: z.string(),
  correction_instructions: z.string().optional().nullable()
});

// ------------------------------------------------------------------------------
// 8. SPECIALIZED AGENT OUTPUT SCHEMAS
// ------------------------------------------------------------------------------
export const EnergyDiagnosisResultSchema = z.object({
  executive_summary: z.string(),
  factual_findings: z.array(z.string()),
  hypotheses: z.array(z.string()),
  savings_potential: z.object({
    monthly_brl: z.number().nonnegative(),
    annual_brl: z.number().nonnegative(),
    primary_driver: z.string()
  }),
  technical_recommendations: z.array(z.object({
    category: z.enum(['demand_recontracting', 'tariff_migration', 'power_factor_correction', 'solar_dg', 'acl_free_market']),
    action: z.string(),
    estimated_monthly_saving_brl: z.number().nonnegative(),
    payback_months: z.number().nonnegative(),
    priority: PriorityLevelSchema
  })),
  assumptions: z.array(z.string()),
  limitations: z.array(z.string()),
  requires_specialist_review: z.boolean().default(true),
  generated_artifact_type: ArtifactTypeSchema.default(ArtifactType.ENERGY_DIAGNOSIS)
});

export const BusinessStrategyResultSchema = z.object({
  market_intelligence_summary: z.string(),
  target_icp: z.string(),
  business_model_recommendations: z.array(z.string()),
  market_risks: z.array(z.string()),
  validation_metrics: z.array(z.string())
});

export const SalesProposalResultSchema = z.object({
  prospect_name: z.string(),
  proposed_model: z.string(),
  pilot_scope: z.string(),
  financial_terms: z.object({
    monthly_retainer_brl: z.number().nonnegative(),
    success_fee_percent: z.number().nonnegative()
  }),
  next_steps: z.array(z.string()),
  loi_draft_markdown: z.string().optional()
});

export const FinOpsMetricsSchema = z.object({
  completion_rate_percent: z.number(),
  qa_rework_rate_percent: z.number(),
  avg_cost_per_task_usd: z.number(),
  avg_execution_time_ms: z.number(),
  approval_rate_percent: z.number(),
  total_token_spend_usd_today: z.number(),
  total_token_spend_usd_month: z.number(),
  cost_per_artifact_usd: z.number()
});

// ------------------------------------------------------------------------------
// 8-B. AG-011 CFO DIGITAL & UNIT ECONOMICS DELIVERABLE SCHEMA (Seção 6.8 - BKL-007)
// ------------------------------------------------------------------------------
export const CFOMetricStatusSchema = z.enum(['verified', 'estimated', 'incomplete', 'not_available']);

export const CFOMetricItemSchema = z.object({
  name: z.string(),
  value: z.number().nullable(),
  unit: z.string(),
  formula: z.string(),
  source_refs: z.array(z.string()).default([]),
  status: CFOMetricStatusSchema
});

export const CFOPricingScenarioSchema = z.object({
  scenario_name: z.enum(['Conservador', 'Base', 'Otimista']),
  active_clients: z.number().int().nonnegative(),
  mrr_per_client_brl: z.number().nonnegative(),
  setup_fee_brl: z.number().nonnegative(),
  avg_verified_monthly_savings_brl: z.number().nonnegative(),
  success_fee_percent: z.number().min(0).max(100),
  monthly_recurring_revenue_brl: z.number().nonnegative(),
  monthly_success_fee_revenue_brl: z.number().nonnegative(),
  monthly_total_revenue_brl: z.number().nonnegative(),
  estimated_gross_margin_percent: z.number()
});

export const CFODeliverableSchema = z.object({
  summary: z.string(),
  period: z.object({
    start: z.string(),
    end: z.string(),
    timezone: z.string().default('America/Sao_Paulo')
  }),
  metrics: z.array(CFOMetricItemSchema),
  scenarios: z.array(CFOPricingScenarioSchema).default([]),
  risks: z.array(z.string()).default([]),
  alerts: z.array(z.string()).default([]),
  assumptions: z.array(z.string()).default([]),
  limitations: z.array(z.string()).default([]),
  recommendations: z.array(z.string()).default([]),
  approval_required: z.boolean().default(false)
});

// ------------------------------------------------------------------------------
// 8-C. AG-012 EMAIL ANALYSIS CONTRACT SCHEMA (Seção 7.10 - BKL-011)
// ------------------------------------------------------------------------------
export const EmailOperationModeSchema = z.enum([
  'monitor_only',
  'read_summarize',
  'assisted_action',
  'auto_action'
]);

export const EmailAnalysisContractSchema = z.object({
  schema_version: z.literal('1.0').default('1.0'),
  message_type: z.literal('email.analysis').default('email.analysis'),
  email_account_id: z.string(),
  message_id: z.string(),
  thread_id: z.string(),
  received_at: z.string(),
  classification: z.object({
    priority: z.enum(['P0', 'P1', 'P2', 'P3']),
    category: z.string(),
    confidence: z.number().min(0).max(1)
  }),
  summary: z.string(),
  entities: z.object({
    sender: z.string(),
    organization: z.string().nullable().default(null),
    customer_id: z.string().nullable().default(null),
    consumer_unit_id: z.string().nullable().default(null)
  }),
  requests: z.array(z.string()).default([]),
  deadlines: z.array(z.string()).default([]),
  commitments: z.array(z.string()).default([]),
  risks: z.array(z.string()).default([]),
  recommended_next_step: z.object({
    action: z.string(),
    owner_agent: z.string(),
    reason: z.string(),
    due_at: z.string().nullable().default(null)
  }),
  draft_reply: z.object({
    required: z.boolean(),
    subject: z.string(),
    body: z.string(),
    send_authorized: z.literal(false).default(false)
  }),
  automation: z.object({
    account_mode: EmailOperationModeSchema,
    eligible_for_agent_dispatch: z.boolean(),
    dispatched: z.boolean(),
    approval_required: z.boolean()
  }),
  attachments: z.array(
    z.object({
      filename: z.string(),
      extension: z.string(),
      allowed: z.boolean(),
      reason: z.string().optional()
    })
  ).default([]),
  evidence: z.array(z.string()).default([]),
  limitations: z.array(z.string()).default([])
});

// ------------------------------------------------------------------------------
// 9. API REQUEST / RESPONSE SCHEMAS
// ------------------------------------------------------------------------------
export const CreateObjectiveRequestSchema = z.object({
  objective: z.string().min(5),
  priority: PriorityLevelSchema.default(PriorityLevel.P1),
  client_id: z.string().uuid().optional(),
  consumer_unit_id: z.string().uuid().optional(),
  workflow_code: WorkflowCodeSchema.optional()
});

export const DecideApprovalRequestSchema = z.object({
  decision: z.enum(['approved', 'rejected']),
  comments: z.string().optional()
});

export const TriggerWorkerRequestSchema = z.object({
  force_cycle: z.boolean().default(true)
});

