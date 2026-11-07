-- ==============================================================================
-- MIGRATION 0002: RLS POLICIES, TRIGGERS AND PERFORMANCE EXTENSIONS
-- Platform: Energy Intelligence AIOS (EI-AIOS)
-- ==============================================================================

-- 1. TRIGGER PARA ATUALIZAÇÃO AUTOMÁTICA DE updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_agents_updated_at ON agents;
CREATE TRIGGER trg_agents_updated_at
BEFORE UPDATE ON agents
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS trg_clients_updated_at ON clients;
CREATE TRIGGER trg_clients_updated_at
BEFORE UPDATE ON clients
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 2. HABILITAR ROW LEVEL SECURITY (RLS)
-- Tabelas de catálogo público (agentes e normas ANEEL) não possuem RLS para garantir disponibilidade
ALTER TABLE agents DISABLE ROW LEVEL SECURITY;
ALTER TABLE knowledge_sources DISABLE ROW LEVEL SECURITY;

-- Tabelas transacionais
ALTER TABLE clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE consumer_units ENABLE ROW LEVEL SECURITY;
ALTER TABLE energy_bills ENABLE ROW LEVEL SECURITY;
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE approvals ENABLE ROW LEVEL SECURITY;
ALTER TABLE artifacts ENABLE ROW LEVEL SECURITY;

-- 2.5 GARANTIA DE PRIVILÉGIOS NO SCHEMA PUBLIC
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role, postgres;
GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated, service_role, postgres;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated, service_role, postgres;
GRANT ALL ON ALL ROUTINES IN SCHEMA public TO anon, authenticated, service_role, postgres;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO anon, authenticated, service_role, postgres;

-- 3. POLÍTICAS DE ACESSO PARA SERVICE_ROLE, AUTHENTICATED, ANON E POSTGRES
DROP POLICY IF EXISTS "Full access on clients" ON clients;
CREATE POLICY "Full access on clients" ON clients FOR ALL TO anon, authenticated, service_role, postgres USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Full access on consumer_units" ON consumer_units;
CREATE POLICY "Full access on consumer_units" ON consumer_units FOR ALL TO anon, authenticated, service_role, postgres USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Full access on energy_bills" ON energy_bills;
CREATE POLICY "Full access on energy_bills" ON energy_bills FOR ALL TO anon, authenticated, service_role, postgres USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Full access on tasks" ON tasks;
CREATE POLICY "Full access on tasks" ON tasks FOR ALL TO anon, authenticated, service_role, postgres USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Full access on agent_runs" ON agent_runs;
CREATE POLICY "Full access on agent_runs" ON agent_runs FOR ALL TO anon, authenticated, service_role, postgres USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Full access on approvals" ON approvals;
CREATE POLICY "Full access on approvals" ON approvals FOR ALL TO anon, authenticated, service_role, postgres USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Full access on artifacts" ON artifacts;
CREATE POLICY "Full access on artifacts" ON artifacts FOR ALL TO anon, authenticated, service_role, postgres USING (true) WITH CHECK (true);

-- 5. ÍNDICES COMPLEMENTARES DE QUERY E BUSCA
CREATE INDEX IF NOT EXISTS idx_tasks_dependencies ON tasks USING GIN (dependencies);
CREATE INDEX IF NOT EXISTS idx_tasks_assigned_agent ON tasks(assigned_agent_id);
CREATE INDEX IF NOT EXISTS idx_tasks_workflow_code ON tasks(workflow_code);
CREATE INDEX IF NOT EXISTS idx_consumer_units_client ON consumer_units(client_id);
CREATE INDEX IF NOT EXISTS idx_artifacts_client ON artifacts(client_id);
CREATE INDEX IF NOT EXISTS idx_artifacts_type ON artifacts(artifact_type);
CREATE INDEX IF NOT EXISTS idx_knowledge_sources_type ON knowledge_sources(source_type, distributor);

