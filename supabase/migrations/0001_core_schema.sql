-- ==============================================================================
-- MIGRATION 0001: CORE SCHEMA
-- Platform: Energy Intelligence AIOS (EI-AIOS)
-- ==============================================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 0. GARANTIA DE ROLES DO POSTGREST/SUPABASE
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'anon') THEN
    CREATE ROLE anon NOLOGIN;
  END IF;
  IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'authenticated') THEN
    CREATE ROLE authenticated NOLOGIN;
  END IF;
  IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'service_role') THEN
    CREATE ROLE service_role NOLOGIN;
  END IF;
  GRANT anon, authenticated, service_role TO postgres;
END $$;

-- 1. ENUMERAÇÕES DE CONTROLE (IDEMPOTENTES)
DO $$ BEGIN
  CREATE TYPE task_status AS ENUM (
    'pending', 'assigned', 'running', 'waiting_input', 
    'review', 'approved', 'rejected', 'completed', 'failed', 'cancelled'
  );
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE priority_level AS ENUM ('P0', 'P1', 'P2', 'P3');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE action_risk_level AS ENUM ('LEVEL_0_AUTO', 'LEVEL_1_SUPERVISED', 'LEVEL_2_APPROVAL_REQUIRED');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

-- 2. CATÁLOGO DE AGENTES
CREATE TABLE IF NOT EXISTS agents (
  id VARCHAR(20) PRIMARY KEY, -- 'AG-001' a 'AG-011'
  name VARCHAR(100) NOT NULL,
  agent_type VARCHAR(50) NOT NULL,
  version VARCHAR(20) NOT NULL DEFAULT '1.0.0',
  role_description TEXT NOT NULL,
  system_prompt TEXT NOT NULL,
  configuration JSONB NOT NULL DEFAULT '{
    "model": "gemini-2.5-flash",
    "temperature": 0.1,
    "tools": [],
    "permissions": {
      "database_read": true,
      "database_write": false,
      "external_publish": false,
      "financial_commitment": false
    },
    "approval_required": [],
    "daily_budget_usd": 5.00
  }'::jsonb,
  enabled BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. CLIENTES E UNIDADES CONSUMIDORAS (CORE BUSINESS ENERGIA)
CREATE TABLE IF NOT EXISTS clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_name VARCHAR(200) NOT NULL,
  cnpj VARCHAR(20) UNIQUE,
  segment VARCHAR(100), -- Indústria, Supermercado, Condomínio, Rede Farmácia, etc.
  stage VARCHAR(50) NOT NULL DEFAULT 'lead', -- lead, pilot_loi, active_saas, churned
  contact_name VARCHAR(150),
  contact_email VARCHAR(150),
  contact_phone VARCHAR(50),
  contract_model VARCHAR(50) DEFAULT 'saas_plus_success_fee',
  monthly_fee_brl NUMERIC(12, 2) DEFAULT 0,
  success_fee_percent NUMERIC(5, 2) DEFAULT 20.00,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS consumer_units (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  uc_code VARCHAR(50) NOT NULL, -- Código da Instalação na Distribuidora
  unit_name VARCHAR(150) NOT NULL, -- Ex: Filial Centro
  distributor VARCHAR(100) NOT NULL, -- Enel SP, CPFL Paulista, Cemig, Neoenergia, etc.
  tariff_group VARCHAR(20) NOT NULL DEFAULT 'A4', -- A2, A3, A3a, A4, B3
  tariff_modality VARCHAR(30) NOT NULL DEFAULT 'HOROSSAZONAL_VERDE', -- VERDE, AZUL, CONVENCIONAL, BRANCA
  contracted_demand_peak_kw NUMERIC(10, 2) DEFAULT 0,
  contracted_demand_offpeak_kw NUMERIC(10, 2) DEFAULT 0,
  is_free_market BOOLEAN NOT NULL DEFAULT false,
  has_distributed_generation BOOLEAN NOT NULL DEFAULT false,
  baseline_metrics JSONB NOT NULL DEFAULT '{}'::jsonb, -- Linha de base para cálculo de M&V
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 4. FATURAS DE ENERGIA E DIAGNÓSTICOS DETERMINÍSTICOS
CREATE TABLE IF NOT EXISTS energy_bills (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  consumer_unit_id UUID NOT NULL REFERENCES consumer_units(id) ON DELETE CASCADE,
  billing_period VARCHAR(7) NOT NULL, -- Formato 'YYYY-MM'
  due_date DATE,
  total_amount_brl NUMERIC(12, 2) NOT NULL,
  consumption_peak_kwh NUMERIC(12, 2) NOT NULL DEFAULT 0,
  consumption_offpeak_kwh NUMERIC(12, 2) NOT NULL DEFAULT 0,
  measured_demand_peak_kw NUMERIC(10, 2) NOT NULL DEFAULT 0,
  measured_demand_offpeak_kw NUMERIC(10, 2) NOT NULL DEFAULT 0,
  billed_demand_peak_kw NUMERIC(10, 2) NOT NULL DEFAULT 0,
  billed_demand_offpeak_kw NUMERIC(10, 2) NOT NULL DEFAULT 0,
  exceeded_demand_kw NUMERIC(10, 2) NOT NULL DEFAULT 0,
  exceeded_demand_fine_brl NUMERIC(12, 2) NOT NULL DEFAULT 0,
  reactive_energy_excess_kwh NUMERIC(12, 2) NOT NULL DEFAULT 0,
  reactive_energy_fine_brl NUMERIC(12, 2) NOT NULL DEFAULT 0,
  tariff_flag VARCHAR(30) DEFAULT 'VERDE', -- VERDE, AMARELA, VERMELHA_P1, VERMELHA_P2
  taxes_breakdown JSONB NOT NULL DEFAULT '{"icms_rate": 0, "pis_rate": 0, "cofins_rate": 0, "cip_brl": 0}'::jsonb,
  raw_extracted_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  deterministic_audit_json JSONB NOT NULL DEFAULT '{}'::jsonb, -- Resultado da calculadora determinística
  potential_savings_brl NUMERIC(12, 2) NOT NULL DEFAULT 0,
  verified_savings_brl NUMERIC(12, 2) NOT NULL DEFAULT 0,
  file_path TEXT,
  validation_status VARCHAR(30) NOT NULL DEFAULT 'pending_review',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(consumer_unit_id, billing_period)
);

-- 5. TAREFAS E ORQUESTRAÇÃO (TASK ENVELOPE)
CREATE TABLE IF NOT EXISTS tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_code VARCHAR(30) UNIQUE NOT NULL, -- Ex: 'TASK-0001'
  workflow_code VARCHAR(20), -- Ex: 'WF-001' a 'WF-008'
  parent_task_id UUID REFERENCES tasks(id) ON DELETE CASCADE,
  client_id UUID REFERENCES clients(id) ON DELETE SET NULL,
  created_by VARCHAR(50) NOT NULL, -- 'FOUNDER' ou ID do Agente
  assigned_agent_id VARCHAR(20) REFERENCES agents(id),
  objective TEXT NOT NULL,
  task_type VARCHAR(50) NOT NULL,
  priority priority_level NOT NULL DEFAULT 'P1',
  status task_status NOT NULL DEFAULT 'pending',
  risk_level action_risk_level NOT NULL DEFAULT 'LEVEL_0_AUTO',
  dependencies UUID[] DEFAULT '{}',
  retry_count INTEGER NOT NULL DEFAULT 0,
  max_retries INTEGER NOT NULL DEFAULT 2,
  input_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  expected_output JSONB NOT NULL DEFAULT '{"format": "json", "schema_version": "1.0"}'::jsonb,
  result_payload JSONB,
  qa_review_payload JSONB,
  requires_approval BOOLEAN NOT NULL DEFAULT false,
  approval_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ
);

-- 6. EXECUÇÕES DE AGENTES E CONTROLE DE CUSTOS (FINOPS)
CREATE TABLE IF NOT EXISTS agent_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  agent_id VARCHAR(20) NOT NULL REFERENCES agents(id),
  model_provider VARCHAR(50) NOT NULL DEFAULT 'google',
  model_name VARCHAR(100) NOT NULL DEFAULT 'gemini-2.5-flash',
  input_tokens INTEGER NOT NULL DEFAULT 0,
  output_tokens INTEGER NOT NULL DEFAULT 0,
  execution_time_ms INTEGER NOT NULL DEFAULT 0,
  cost_estimate NUMERIC(10, 6) NOT NULL DEFAULT 0.000000,
  status VARCHAR(30) NOT NULL, -- 'success', 'error', 'qa_rejected'
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 7. GOVERNANÇA HUMAN-IN-THE-LOOP (APROVAÇÕES)
CREATE TABLE IF NOT EXISTS approvals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  requested_by VARCHAR(20) NOT NULL REFERENCES agents(id),
  approval_type VARCHAR(50) NOT NULL, -- 'contract_recommendation', 'external_delivery', 'deploy', 'financial_decision'
  approval_status VARCHAR(20) NOT NULL DEFAULT 'pending', -- 'pending', 'approved', 'rejected'
  reviewer UUID,
  comments TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  decided_at TIMESTAMPTZ
);

-- 8. ARTEFATOS E ENTREGÁVEIS
CREATE TABLE IF NOT EXISTS artifacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  client_id UUID REFERENCES clients(id) ON DELETE SET NULL,
  artifact_type VARCHAR(50) NOT NULL, -- 'energy_diagnosis', 'contest_dossier', 'mv_report', 'commercial_proposal', 'swot'
  title VARCHAR(255) NOT NULL,
  summary TEXT,
  content_markdown TEXT NOT NULL,
  structured_data JSONB NOT NULL DEFAULT '{}'::jsonb,
  file_path TEXT,
  version VARCHAR(20) NOT NULL DEFAULT '1.0',
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 9. BASE REGULATÓRIA E TARIFÁRIA (KNOWLEDGE SOURCES)
CREATE TABLE IF NOT EXISTS knowledge_sources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_type VARCHAR(50) NOT NULL, -- 'aneel_resolution', 'distributor_tariff_table', 'tariff_flag', 'contract_template'
  source_name VARCHAR(255) NOT NULL,
  distributor VARCHAR(100),
  effective_from DATE,
  effective_until DATE,
  source_url TEXT,
  document_id VARCHAR(100),
  structured_content JSONB NOT NULL DEFAULT '{}'::jsonb,
  version VARCHAR(20) NOT NULL DEFAULT '1.0',
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ÍNDICES DE PERFORMANCE PARA O WORKER AUTÔNOMO
CREATE INDEX IF NOT EXISTS idx_tasks_status_priority ON tasks(status, priority);
CREATE INDEX IF NOT EXISTS idx_tasks_parent_id ON tasks(parent_task_id);
CREATE INDEX IF NOT EXISTS idx_approvals_status ON approvals(approval_status);
CREATE INDEX IF NOT EXISTS idx_agent_runs_created_at ON agent_runs(created_at);
CREATE INDEX IF NOT EXISTS idx_energy_bills_uc_period ON energy_bills(consumer_unit_id, billing_period);

