-- ==============================================================================
-- SPRINT 4 MIGRATION: DECISION LOGS & AUDIT TRAIL (BKL-016)
-- Trilha auditável de decisões do AG-001 e orquestrador
-- ==============================================================================

CREATE TABLE IF NOT EXISTS decision_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  parent_task_id UUID REFERENCES tasks(id) ON DELETE CASCADE,
  task_id UUID REFERENCES tasks(id) ON DELETE SET NULL,
  agent_id VARCHAR(20) NOT NULL REFERENCES agents(id),
  decision_type VARCHAR(60) NOT NULL, -- 'decomposition_plan', 'routing_decision', 'synthesis_consolidation', 'policy_override'
  decision_summary TEXT NOT NULL,
  rationales JSONB NOT NULL DEFAULT '[]'::jsonb,
  alternatives_considered JSONB NOT NULL DEFAULT '[]'::jsonb,
  risk_assessment JSONB NOT NULL DEFAULT '{}'::jsonb,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_decision_logs_parent_task ON decision_logs(parent_task_id);
CREATE INDEX IF NOT EXISTS idx_decision_logs_agent_id ON decision_logs(agent_id);
CREATE INDEX IF NOT EXISTS idx_decision_logs_created_at ON decision_logs(created_at);

-- RLS: anon can only read, authenticated/service_role can write
ALTER TABLE decision_logs ENABLE ROW LEVEL SECURITY;

DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'decision_logs' AND policyname = 'Allow read decision_logs'
  ) THEN
    CREATE POLICY "Allow read decision_logs" ON decision_logs
      FOR SELECT USING (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'decision_logs' AND policyname = 'Allow service_role write decision_logs'
  ) THEN
    CREATE POLICY "Allow service_role write decision_logs" ON decision_logs
      FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
END $$;

