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
  TriggerWorkerRequestSchema
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
  task_id: string;
  agent_id: string;
  model_provider: string;
  model_name: string;
  input_tokens: number;
  output_tokens: number;
  execution_time_ms: number;
  cost_estimate: number;
  status: 'success' | 'error' | 'qa_rejected';
  error_message?: string | null;
  created_at: string;
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

