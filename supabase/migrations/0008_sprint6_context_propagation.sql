-- ==============================================================================
-- MIGRATION 0008: SPRINT 6 S6-01 CONTEXT PROPAGATION & EXECUTION TRACEABILITY
-- Platform: Energy Intelligence AIOS (EI-AIOS)
-- ==============================================================================

SET search_path = public;

-- 1. EXPANDE agent_runs COM CONTEXTO OPERACIONAL E FINANCEIRO
ALTER TABLE agent_runs
  ADD COLUMN IF NOT EXISTS consumer_unit_id UUID REFERENCES consumer_units(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS execution_id VARCHAR(120),
  ADD COLUMN IF NOT EXISTS is_internal BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS metadata JSONB NOT NULL DEFAULT '{}'::jsonb;

-- 2. EXPANDE tasks COM consumer_unit_id EXPLÍCITO
ALTER TABLE tasks
  ADD COLUMN IF NOT EXISTS consumer_unit_id UUID REFERENCES consumer_units(id) ON DELETE SET NULL;

-- 3. ÍNDICES DE ALTA PERFORMANCE PARA AUDITORIA E FINOPS
CREATE INDEX IF NOT EXISTS idx_agent_runs_consumer_unit ON agent_runs(consumer_unit_id);
CREATE INDEX IF NOT EXISTS idx_agent_runs_execution_id ON agent_runs(execution_id);
CREATE INDEX IF NOT EXISTS idx_agent_runs_is_internal ON agent_runs(is_internal);
CREATE INDEX IF NOT EXISTS idx_tasks_consumer_unit ON tasks(consumer_unit_id);

-- 4. ATUALIZAÇÃO DA TELEMETRIA HISTÓRICA:
-- S6-01: Não alterar registros históricos nem atribuir inferências arbitrárias
COMMENT ON COLUMN agent_runs.client_id IS 'ID do cliente vinculado à execução (S6-01)';
COMMENT ON COLUMN agent_runs.consumer_unit_id IS 'ID da Unidade Consumidora vinculada à execução (S6-01)';
COMMENT ON COLUMN agent_runs.execution_id IS 'Identificador ou lease_token do ciclo de execução (S6-01)';
COMMENT ON COLUMN agent_runs.is_internal IS 'Sinaliza se a execução é de governança interna da plataforma (S6-01)';

