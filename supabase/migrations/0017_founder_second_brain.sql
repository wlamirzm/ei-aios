-- ==============================================================================
-- MIGRATION 0017: SEGUNDO CÉREBRO & MEMÓRIA EPISÓDICA DO FUNDADOR (EI-AIOS)
-- ==============================================================================

SET search_path = public;

-- 1. Habilitação condicional da extensão pgvector (caso disponível no ambiente)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_available_extensions WHERE name = 'vector') THEN
    CREATE EXTENSION IF NOT EXISTS vector;
  END IF;
END $$;

-- 2. Tabela de Personas e Diretrizes Estratégicas do Fundador
CREATE TABLE IF NOT EXISTS founder_personas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(120) NOT NULL,
  slug VARCHAR(80) UNIQUE NOT NULL,
  description TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT false,
  risk_tolerance VARCHAR(30) NOT NULL DEFAULT 'balanced' 
    CHECK (risk_tolerance IN ('conservative', 'balanced', 'growth_aggressive')),
  preferred_tone VARCHAR(40) NOT NULL DEFAULT 'analytical_executive',
  decision_weights JSONB NOT NULL DEFAULT '{
    "vector_similarity_weight": 0.45,
    "business_rules_weight": 0.35,
    "temporal_freshness_weight": 0.20,
    "auto_approval_threshold": 0.90,
    "review_warning_threshold": 0.65
  }',
  business_heuristics JSONB NOT NULL DEFAULT '{
    "min_success_fee_percent": 20.0,
    "max_monthly_churn_risk_usd": 500.0,
    "target_distributors": ["CPFL Paulista", "Enel SP", "Elektro", "Cemig"],
    "prohibited_claim_keywords": ["garantia incondicional", "sem risco", "economia garantida"],
    "max_daily_telegram_pushes": 5,
    "quiet_hours_start": "21:00",
    "quiet_hours_end": "07:30"
  }',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Seed de Persona Padrão do Fundador
INSERT INTO founder_personas (name, slug, description, is_active, risk_tolerance, preferred_tone)
VALUES (
  'Fundador Solo Energy Intelligence',
  'default-founder',
  'Persona executiva com foco em análise rigorosa de ROI tarifário, abordagem consultiva B2B e governança estrita.',
  true,
  'balanced',
  'analytical_executive'
)
ON CONFLICT (slug) DO NOTHING;

-- 3. Tabela de Conhecimento Base & Histórico (Bootstrap Opção A)
CREATE TABLE IF NOT EXISTS knowledge_chunks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_type VARCHAR(40) NOT NULL, -- 'google_drive', 'email', 'regulatory_source', 'internal_artifact'
  source_id VARCHAR(255) NOT NULL,
  chunk_index INTEGER NOT NULL DEFAULT 0,
  content TEXT NOT NULL,
  content_checksum VARCHAR(64) NOT NULL, -- SHA-256 para idempotência
  metadata JSONB NOT NULL DEFAULT '{}',
  embedding JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 4. Tabela de Memória Episódica (Ações, Rejeições e Edições do Fundador)
CREATE TABLE IF NOT EXISTS founder_action_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  persona_id UUID REFERENCES founder_personas(id) ON DELETE SET NULL,
  agent_id VARCHAR(60) NOT NULL,
  action_type VARCHAR(40) NOT NULL 
    CHECK (action_type IN ('APPROVE', 'EDIT_AND_APPROVE', 'REJECT', 'DISCARD', 'OVERRIDE')),
  task_type VARCHAR(80) NOT NULL,
  target_entity_type VARCHAR(50),
  target_entity_id VARCHAR(120),
  original_proposal TEXT NOT NULL,
  final_executed_content TEXT,
  diff_summary JSONB,
  reasoning_feedback TEXT,
  rejection_category VARCHAR(60),
  proposal_embedding JSONB,
  final_content_embedding JSONB,
  confidence_score NUMERIC(5,4) NOT NULL DEFAULT 0.5000,
  execution_channel VARCHAR(40) NOT NULL DEFAULT 'web_cockpit',
  applied_heuristics JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 5. Tabela de Sugestões Preditivas (Next-Best-Action Feed)
CREATE TABLE IF NOT EXISTS predictive_suggestions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  persona_id UUID REFERENCES founder_personas(id) ON DELETE SET NULL,
  category VARCHAR(50) NOT NULL, -- 'email_response', 'crm_followup', 'market_opportunity', 'calendar_prep', 'tariff_optimization', 'social_post', 'governance_alert'
  priority VARCHAR(10) NOT NULL DEFAULT 'P2' CHECK (priority IN ('P0', 'P1', 'P2', 'P3')),
  title VARCHAR(255) NOT NULL,
  context_summary TEXT NOT NULL,
  action_type VARCHAR(80) NOT NULL,
  target_agent_id VARCHAR(60) NOT NULL,
  target_entity_type VARCHAR(50),
  target_entity_id VARCHAR(120),
  action_payload JSONB NOT NULL,
  confidence_score NUMERIC(5,4) NOT NULL DEFAULT 0.0000,
  approval_probability NUMERIC(5,4) NOT NULL DEFAULT 0.0000,
  score_breakdown JSONB NOT NULL DEFAULT '{}',
  dedup_fingerprint VARCHAR(64) NOT NULL, -- SHA-256 para deduplicação
  status VARCHAR(30) NOT NULL DEFAULT 'pending' 
    CHECK (status IN ('pending', 'accepted', 'edited', 'rejected', 'expired')),
  feedback_payload JSONB,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 6. Tabela de Controle de Locks Distribuídos do Scheduler
CREATE TABLE IF NOT EXISTS scheduler_locks (
  job_name VARCHAR(100) PRIMARY KEY,
  locked_until TIMESTAMPTZ NOT NULL,
  locked_by VARCHAR(120) NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 7. Índices de Performance
CREATE INDEX IF NOT EXISTS idx_knowledge_chunks_checksum 
  ON knowledge_chunks(content_checksum);

CREATE INDEX IF NOT EXISTS idx_founder_action_logs_created_agent 
  ON founder_action_logs(agent_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_predictive_suggestions_status_priority 
  ON predictive_suggestions(status, priority, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_predictive_suggestions_dedup 
  ON predictive_suggestions(dedup_fingerprint, status);

-- 8. Segurança & Row Level Security (RLS)
ALTER TABLE founder_personas ENABLE ROW LEVEL SECURITY;
ALTER TABLE knowledge_chunks ENABLE ROW LEVEL SECURITY;
ALTER TABLE founder_action_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE predictive_suggestions ENABLE ROW LEVEL SECURITY;
ALTER TABLE scheduler_locks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service and auth full access on founder_personas" ON founder_personas;
CREATE POLICY "Service and auth full access on founder_personas" ON founder_personas
  FOR ALL TO service_role, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Service and auth full access on knowledge_chunks" ON knowledge_chunks;
CREATE POLICY "Service and auth full access on knowledge_chunks" ON knowledge_chunks
  FOR ALL TO service_role, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Service and auth full access on founder_action_logs" ON founder_action_logs;
CREATE POLICY "Service and auth full access on founder_action_logs" ON founder_action_logs
  FOR ALL TO service_role, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Service and auth full access on predictive_suggestions" ON predictive_suggestions;
CREATE POLICY "Service and auth full access on predictive_suggestions" ON predictive_suggestions
  FOR ALL TO service_role, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Service and auth full access on scheduler_locks" ON scheduler_locks;
CREATE POLICY "Service and auth full access on scheduler_locks" ON scheduler_locks
  FOR ALL TO service_role, authenticated USING (true) WITH CHECK (true);

-- Blindagem contra acesso público anon
REVOKE ALL ON TABLE founder_personas FROM anon;
REVOKE ALL ON TABLE knowledge_chunks FROM anon;
REVOKE ALL ON TABLE founder_action_logs FROM anon;
REVOKE ALL ON TABLE predictive_suggestions FROM anon;
REVOKE ALL ON TABLE scheduler_locks FROM anon;

GRANT ALL ON TABLE founder_personas TO authenticated, service_role, postgres;
GRANT ALL ON TABLE knowledge_chunks TO authenticated, service_role, postgres;
GRANT ALL ON TABLE founder_action_logs TO authenticated, service_role, postgres;
GRANT ALL ON TABLE predictive_suggestions TO authenticated, service_role, postgres;
GRANT ALL ON TABLE scheduler_locks TO authenticated, service_role, postgres;
