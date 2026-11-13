// ==============================================================================
// SHARED TYPES: ENERGY INTELLIGENCE AIOS (EI-AIOS)
// ==============================================================================

import { z } from 'zod';
import {
  TaskEnvelopeSchema,
  OrchestratorPlanSchema,
  DecomposedSubtaskSchema,
  EnergyBillExtractionSchema,
  BillTaxesBreakdownSchema,
  BillLineItemSchema,
  DemandAuditSchema,
  LoadFactorAuditSchema,
  ReactivePowerAuditSchema,
  ModalityComparisonAuditSchema,
  DeterministicAuditResultSchema,
  MVCalculationSchema,
  QAReviewSchema,
  EnergyDiagnosisResultSchema,
  BusinessStrategyResultSchema,
  SalesProposalResultSchema,
  FinOpsMetricsSchema,
  CreateObjectiveRequestSchema,
  DecideApprovalRequestSchema,
  TriggerWorkerRequestSchema,
  WebSearchResultSchema,
  ScrapedPageDataSchema,
  DecisionMakerSchema,
  TargetSubgroupSchema,
  QualificationGradeSchema,
  ProspectProfileSchema,
  CompetitorProfileSchema,
  MarketIntelligenceDossierSchema
} from './schemas.js';

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

// Inferred Types from Zod
export type TaskEnvelope = z.infer<typeof TaskEnvelopeSchema>;
export type OrchestratorPlan = z.infer<typeof OrchestratorPlanSchema>;
export type DecomposedSubtask = z.infer<typeof DecomposedSubtaskSchema>;
export type EnergyBillExtraction = z.infer<typeof EnergyBillExtractionSchema>;
export type BillTaxesBreakdown = z.infer<typeof BillTaxesBreakdownSchema>;
export type BillLineItem = z.infer<typeof BillLineItemSchema>;
export type DemandAudit = z.infer<typeof DemandAuditSchema>;
export type LoadFactorAudit = z.infer<typeof LoadFactorAuditSchema>;
export type ReactivePowerAudit = z.infer<typeof ReactivePowerAuditSchema>;
export type ModalityComparisonAudit = z.infer<typeof ModalityComparisonAuditSchema>;
export type DeterministicAuditResult = z.infer<typeof DeterministicAuditResultSchema>;
export type MVCalculation = z.infer<typeof MVCalculationSchema>;
export type QAReview = z.infer<typeof QAReviewSchema>;
export type EnergyDiagnosisResult = z.infer<typeof EnergyDiagnosisResultSchema>;
export type BusinessStrategyResult = z.infer<typeof BusinessStrategyResultSchema>;
export type SalesProposalResult = z.infer<typeof SalesProposalResultSchema>;
export type FinOpsMetrics = z.infer<typeof FinOpsMetricsSchema>;
export type CreateObjectiveRequest = z.infer<typeof CreateObjectiveRequestSchema>;
export type DecideApprovalRequest = z.infer<typeof DecideApprovalRequestSchema>;
export type TriggerWorkerRequest = z.infer<typeof TriggerWorkerRequestSchema>;
export type WebSearchResult = z.infer<typeof WebSearchResultSchema>;
export type ScrapedPageData = z.infer<typeof ScrapedPageDataSchema>;
export type DecisionMaker = z.infer<typeof DecisionMakerSchema>;
export type TargetSubgroup = z.infer<typeof TargetSubgroupSchema>;
export type QualificationGrade = z.infer<typeof QualificationGradeSchema>;
export type ProspectProfile = z.infer<typeof ProspectProfileSchema>;
export type CompetitorProfile = z.infer<typeof CompetitorProfileSchema>;
export type MarketIntelligenceDossier = z.infer<typeof MarketIntelligenceDossierSchema>;

// Supabase Database Row Models
export interface AgentModel {
  id: string; // 'AG-001' to 'AG-011'
  name: string;
  agent_type: string;
  version: string;
  role_description: string;
  system_prompt: string;
  configuration: {
    model: string;
    temperature: number;
    tools: string[];
    permissions: {
      database_read: boolean;
      database_write: boolean;
      external_publish: boolean;
      financial_commitment: boolean;
    };
    approval_required: string[];
    daily_budget_usd: number;
  };
  enabled: boolean;
  created_at: string;
  updated_at: string;
}

export interface ClientModel {
  id: string;
  company_name: string;
  cnpj?: string | null;
  segment?: string | null;
  stage: ClientStage | string;
  contact_name?: string | null;
  contact_email?: string | null;
  contact_phone?: string | null;
  contract_model?: string | null;
  monthly_fee_brl: number;
  success_fee_percent: number;
  metadata: Record<string, any>;
  created_at: string;
  updated_at: string;
}

export interface ConsumerUnitModel {
  id: string;
  client_id: string;
  uc_code: string;
  unit_name: string;
  distributor: string;
  tariff_group: TariffGroup | string;
  tariff_modality: TariffModality | string;
  contracted_demand_peak_kw: number;
  contracted_demand_offpeak_kw: number;
  is_free_market: boolean;
  has_distributed_generation: boolean;
  baseline_metrics: Record<string, any>;
  created_at: string;
}

export interface EnergyBillModel {
  id: string;
  consumer_unit_id: string;
  billing_period: string;
  due_date?: string | null;
  total_amount_brl: number;
  consumption_peak_kwh: number;
  consumption_offpeak_kwh: number;
  measured_demand_peak_kw: number;
  measured_demand_offpeak_kw: number;
  billed_demand_peak_kw: number;
  billed_demand_offpeak_kw: number;
  exceeded_demand_kw: number;
  exceeded_demand_fine_brl: number;
  reactive_energy_excess_kwh: number;
  reactive_energy_fine_brl: number;
  tariff_flag: TariffFlag | string;
  taxes_breakdown: Record<string, any>;
  raw_extracted_json: Record<string, any>;
  deterministic_audit_json: Record<string, any>;
  potential_savings_brl: number;
  verified_savings_brl: number;
  file_path?: string | null;
  validation_status: string;
  created_at: string;
}

export interface TaskModel {
  id: string;
  task_code: string;
  workflow_code?: WorkflowCode | string | null;
  parent_task_id?: string | null;
  client_id?: string | null;
  consumer_unit_id?: string | null;
  created_by: string;
  assigned_agent_id: AgentId | string;
  objective: string;
  task_type: string;
  priority: PriorityLevel;
  status: TaskStatus;
  risk_level: ActionRiskLevel;
  dependencies: string[];
  retry_count: number;
  max_retries: number;
  input_payload: Record<string, any>;
  expected_output: Record<string, any>;
  result_payload?: Record<string, any> | null;
  qa_review_payload?: Record<string, any> | null;
  requires_approval: boolean;
  approval_reason?: string | null;
  created_at: string;
  started_at?: string | null;
  completed_at?: string | null;
}

export interface AgentRunModel {
  id: string;
  task_id?: string | null;
  client_id?: string | null;
  consumer_unit_id?: string | null;
  execution_id?: string | null;
  is_internal?: boolean;
  agent_id: string;
  model_provider: string;
  model_name: string;
  input_tokens: number;
  output_tokens: number;
  execution_time_ms: number;
  cost_estimate: number;
  status: 'success' | 'error' | 'qa_rejected';
  error_message?: string | null;
  metadata?: Record<string, any>;
  created_at: string;
}

export interface ExecutionContext {
  taskId?: string | null;
  runId?: string;
  agentId: AgentId | string;
  clientId?: string | null;
  consumerUnitId?: string | null;
  executionId?: string | null;
  isInternal?: boolean;
  origin?: 'orchestrator' | 'worker' | 'qa_gate' | 'bill_parser' | 'email_intelligence' | 'chat' | 'system';
  metadata?: Record<string, any>;
}

export interface ApprovalModel {
  id: string;
  task_id: string;
  requested_by: string;
  approval_type: ApprovalType | string;
  approval_status: ApprovalStatus | string;
  reviewer?: string | null;
  comments?: string | null;
  created_at: string;
  decided_at?: string | null;
}

export interface ArtifactModel {
  id: string;
  task_id: string;
  client_id?: string | null;
  artifact_type: ArtifactType | string;
  title: string;
  summary?: string | null;
  content_markdown: string;
  structured_data: Record<string, any>;
  file_path?: string | null;
  version: string;
  metadata: Record<string, any>;
  created_at: string;
}

export interface KnowledgeSourceModel {
  id: string;
  source_type: string;
  source_name: string;
  distributor?: string | null;
  effective_from?: string | null;
  effective_until?: string | null;
  source_url?: string | null;
  document_id?: string | null;
  structured_content: Record<string, any>;
  version: string;
  metadata: Record<string, any>;
  created_at: string;
}

// ==============================================================================
// SPRINT 6 S6-02: FINOPS COST & USAGE LEDGER TYPES
// ==============================================================================

export type CostReliabilityTier = 'measured' | 'estimated' | 'reconciled' | 'incomplete' | 'unattributed';

export type CostCategory = 'client_attributable' | 'platform_internal' | 'unattributed_legacy' | 'unattributed_orphan';

export interface ModelPricingItem {
  inputUsdPerMillion: number;
  outputUsdPerMillion: number;
  currency: 'USD';
  effectiveFrom?: string;
  effectiveUntil?: string;
}

export interface ModelPricingMatrix {
  versionId: string;
  name: string;
  effectiveDate: string;
  models: Record<string, ModelPricingItem>;
  notes?: string;
}

export interface FinopsLedgerEntry {
  id: string;
  run_id: string;
  task_id?: string | null;
  agent_id: string;
  client_id?: string | null;
  consumer_unit_id?: string | null;
  execution_id?: string | null;
  model_name: string;
  input_tokens: number | null;
  output_tokens: number | null;
  pricing_version: string;
  cost_usd: number | null;
  cost_brl: number | null;
  exchange_rate: number;
  reliability_tier: CostReliabilityTier;
  category: CostCategory;
  origin?: string | null;
  run_created_at?: string | null;
  reconciled_at: string;
  is_reprocessed: boolean;
  divergence_notes?: string | null;
  metadata?: Record<string, any>;
}

export interface FinopsReconciliationSummary {
  batch_id: string;
  reconciled_at: string;
  pricing_version: string;
  exchange_rate: number;
  total_processed: number;
  new_entries_count: number;
  reprocessed_entries_count: number;
  skipped_duplicate_count: number;
  by_category: {
    client_attributable: { count: number; cost_usd: number; cost_brl: number };
    platform_internal: { count: number; cost_usd: number; cost_brl: number };
    unattributed_legacy: { count: number; cost_usd: number; cost_brl: number };
    unattributed_orphan: { count: number; cost_usd: number; cost_brl: number };
  };
  by_reliability_tier: {
    measured: number;
    estimated: number;
    reconciled: number;
    incomplete: number;
    unattributed: number;
  };
  by_client: Record<string, { count: number; cost_usd: number; cost_brl: number }>;
  by_agent: Record<string, { count: number; cost_usd: number; cost_brl: number }>;
  total_tokens: { input: number; output: number; combined: number };
  total_cost_usd: number;
  total_cost_brl: number;
}

// ==============================================================================
// SPRINT 6 S6-03: REAL REVENUE PIPELINE & CONTRACT BILLING SYNC
// ==============================================================================

export type ContractStatus = 'active' | 'expired' | 'suspended' | 'draft' | 'cancelled';
export type InvoiceStatus = 'draft' | 'issued' | 'paid' | 'partially_paid' | 'overdue' | 'cancelled';
export type SuccessFeeStatus = 'pending_approval' | 'approved' | 'invoiced' | 'received' | 'not_eligible' | 'rejected';
export type AdjustmentIndex = 'IPCA' | 'IGP-M' | 'INPC' | 'FIXED';

export interface ClientContractModel {
  id: string;
  client_id: string;
  contract_number: string;
  start_date: string; // ISO date YYYY-MM-DD
  end_date: string | null; // ISO date YYYY-MM-DD
  monthly_recurring_value_brl: number | null;
  has_success_fee: boolean;
  success_fee_percent: number | null;
  success_fee_clause: string | null;
  adjustment_index: AdjustmentIndex;
  adjustment_periodicity_months: number;
  last_adjustment_date?: string | null;
  status: ContractStatus;
  created_at: string;
  updated_at?: string;
  metadata?: Record<string, any>;
}

export interface RevenueInvoiceModel {
  id: string;
  contract_id: string;
  client_id: string;
  invoice_number: string;
  competence: string; // YYYY-MM
  issue_date: string;
  due_date: string;
  recurring_amount_brl: number;
  success_fee_amount_brl: number;
  total_amount_brl: number;
  status: InvoiceStatus;
  notes?: string | null;
  created_at: string;
}

export interface RevenueReceiptModel {
  id: string;
  invoice_id: string;
  client_id: string;
  receipt_date: string;
  amount_received_brl: number;
  transaction_reference: string;
  is_partial: boolean;
  balance_remaining_brl: number;
  created_at: string;
}

export interface SuccessFeeEventModel {
  id: string;
  contract_id: string;
  client_id: string;
  mv_report_id: string;
  competence: string; // YYYY-MM
  verified_savings_brl: number;
  clause_applied: string;
  fee_percent: number;
  eligible_amount_brl: number;
  approval_status: 'pending_approval' | 'approved' | 'rejected';
  approved_by?: string | null;
  approved_at?: string | null;
  invoice_id?: string | null;
  status: SuccessFeeStatus;
  created_at: string;
}

export interface RealMarginReport {
  client_id: string;
  competence: string;
  contracted_mrr_brl: number | null;
  invoiced_mrr_brl: number;
  invoiced_success_fee_brl: number;
  total_invoiced_brl: number;
  received_mrr_brl: number;
  received_success_fee_brl: number;
  total_received_brl: number;
  direct_support_cost_brl: number;
  ai_cost_usd: number;
  ai_cost_brl: number;
  total_direct_costs_brl: number;
  margin_on_invoiced_brl: number;
  margin_on_invoiced_percent: number;
  margin_on_received_brl: number;
  margin_on_received_percent: number;
  reliability: 'measured' | 'estimated' | 'incomplete';
}

// ==============================================================================
// SPRINT 6 S6-04: CAC, LTV & PAYBACK DATA FOUNDATION (UNIT ECONOMICS)
// ==============================================================================

export type AcquisitionExpenseCategory =
  | 'SALES'
  | 'MARKETING'
  | 'ADVERTISING'
  | 'SALES_COMMISSIONS'
  | 'LEAD_GENERATION'
  | 'EVENTS'
  | 'CUSTOMER_ACQUISITION_TOOLS'
  | 'OTHER_ACQUISITION';

export type OperationalExpenseCategory =
  | 'ONBOARDING'
  | 'IMPLEMENTATION'
  | 'CUSTOMER_SUPPORT'
  | 'OPERATIONAL_SERVICE'
  | 'THIRD_PARTY_SERVICE'
  | 'CUSTOMER_SPECIFIC_INFRASTRUCTURE'
  | 'OTHER_COGS';

export type ExpenseValidationStatus = 'validated' | 'pending' | 'rejected';

export interface ExpenseAuditLogEntry {
  previous_amount_brl: number;
  new_amount_brl: number;
  changed_by: string;
  reason: string;
  timestamp: string;
}

export interface AcquisitionExpenseModel {
  id: string;
  tenant_id: string;
  client_id?: string | null;
  campaign_id?: string | null;
  category: AcquisitionExpenseCategory;
  description: string;
  amount_brl: number;
  currency: 'BRL';
  competence: string; // YYYY-MM
  payment_date: string; // YYYY-MM-DD
  document_reference?: string | null;
  registered_by: string;
  validation_status: ExpenseValidationStatus;
  is_shared: boolean;
  allocation_rule?: string | null;
  created_at: string;
  updated_at?: string;
  history?: ExpenseAuditLogEntry[];
}

export interface OperationalExpenseModel {
  id: string;
  tenant_id: string;
  client_id?: string | null;
  consumer_unit_id?: string | null;
  contract_id?: string | null;
  category: OperationalExpenseCategory;
  description: string;
  amount_brl: number;
  currency: 'BRL';
  competence: string; // YYYY-MM
  payment_date: string; // YYYY-MM-DD
  document_reference?: string | null;
  registered_by: string;
  validation_status: ExpenseValidationStatus;
  is_shared: boolean;
  created_at: string;
  updated_at?: string;
}

export interface CustomerAcquisitionEvent {
  id: string;
  client_id: string;
  tenant_id: string;
  acquisition_date: string; // YYYY-MM-DD
  contract_id?: string | null;
  channel?: string | null;
  initial_mrr_brl?: number | null;
  created_at: string;
}

export interface RealCacResult {
  window_days: number;
  window_start: string;
  window_end: string;
  total_eligible_spend_brl: number;
  new_clients_acquired_count: number;
  cac_brl: number | null;
  status: 'measured' | 'estimated' | 'incomplete' | 'unattributed' | 'reconciled';
  limitation_notes: string[];
  included_expense_ids: string[];
  included_client_ids: string[];
}

export interface RealLtvResult {
  client_id?: string | null;
  monthly_contribution_margin_brl: number | null;
  observed_churn_rate_monthly?: number | null;
  estimated_lifespan_months: number | null;
  ltv_brl: number | null;
  status: 'measured' | 'estimated' | 'incomplete';
  methodology: string;
  limitation_notes: string[];
}

export interface RealPaybackResult {
  client_id?: string | null;
  cac_brl: number | null;
  monthly_contribution_margin_brl: number | null;
  payback_months: number | null;
  status: 'measured' | 'estimated' | 'incomplete';
  limitation_notes: string[];
}

