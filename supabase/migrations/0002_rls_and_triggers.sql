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

-- 2. HABILITAR ROW LEVEL SECURITY (RLS) EM TODAS AS TABELAS
ALTER TABLE agents ENABLE ROW LEVEL SECURITY;
ALTER TABLE clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE consumer_units ENABLE ROW LEVEL SECURITY;
ALTER TABLE energy_bills ENABLE ROW LEVEL SECURITY;
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE approvals ENABLE ROW LEVEL SECURITY;
ALTER TABLE artifacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE knowledge_sources ENABLE ROW LEVEL SECURITY;

-- 2.5 GARANTIA DE PRIVILÉGIOS NO SCHEMA PUBLIC
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role, postgres;
GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated, service_role, postgres;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated, service_role, postgres;
GRANT ALL ON ALL ROUTINES IN SCHEMA public TO anon, authenticated, service_role, postgres;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO anon, authenticated, service_role, postgres;

-- 3. POLÍTICAS DE ACESSO (SERVICE ROLE TEM ACESSO TOTAL)
DROP POLICY IF EXISTS "Anon read access on agents" ON agents;
CREATE POLICY "Anon read access on agents" ON agents FOR SELECT TO anon, postgres USING (true);

DROP POLICY IF EXISTS "Anon read access on knowledge_sources" ON knowledge_sources;
CREATE POLICY "Anon read access on knowledge_sources" ON knowledge_sources FOR SELECT TO anon, postgres USING (true);

DROP POLICY IF EXISTS "Service role full access on agents" ON agents;
CREATE POLICY "Service role full access on agents" ON agents FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Service role full access on clients" ON clients;
CREATE POLICY "Service role full access on clients" ON clients FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Service role full access on consumer_units" ON consumer_units;
CREATE POLICY "Service role full access on consumer_units" ON consumer_units FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Service role full access on energy_bills" ON energy_bills;
CREATE POLICY "Service role full access on energy_bills" ON energy_bills FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Service role full access on tasks" ON tasks;
CREATE POLICY "Service role full access on tasks" ON tasks FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Service role full access on agent_runs" ON agent_runs;
CREATE POLICY "Service role full access on agent_runs" ON agent_runs FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Service role full access on approvals" ON approvals;
CREATE POLICY "Service role full access on approvals" ON approvals FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Service role full access on artifacts" ON artifacts;
CREATE POLICY "Service role full access on artifacts" ON artifacts FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Service role full access on knowledge_sources" ON knowledge_sources;
CREATE POLICY "Service role full access on knowledge_sources" ON knowledge_sources FOR ALL TO service_role USING (true) WITH CHECK (true);

-- 4. POLÍTICAS PARA USUÁRIOS AUTENTICADOS (COCKPIT DO FUNDADOR)
DROP POLICY IF EXISTS "Authenticated users full access on agents" ON agents;
CREATE POLICY "Authenticated users full access on agents" ON agents FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Authenticated users full access on clients" ON clients;
CREATE POLICY "Authenticated users full access on clients" ON clients FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Authenticated users full access on consumer_units" ON consumer_units;
CREATE POLICY "Authenticated users full access on consumer_units" ON consumer_units FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Authenticated users full access on energy_bills" ON energy_bills;
CREATE POLICY "Authenticated users full access on energy_bills" ON energy_bills FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Authenticated users full access on tasks" ON tasks;
CREATE POLICY "Authenticated users full access on tasks" ON tasks FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Authenticated users full access on agent_runs" ON agent_runs;
CREATE POLICY "Authenticated users full access on agent_runs" ON agent_runs FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Authenticated users full access on approvals" ON approvals;
CREATE POLICY "Authenticated users full access on approvals" ON approvals FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Authenticated users full access on artifacts" ON artifacts;
CREATE POLICY "Authenticated users full access on artifacts" ON artifacts FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Authenticated users full access on knowledge_sources" ON knowledge_sources;
CREATE POLICY "Authenticated users full access on knowledge_sources" ON knowledge_sources FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- 5. ÍNDICES COMPLEMENTARES DE QUERY E BUSCA
CREATE INDEX IF NOT EXISTS idx_tasks_dependencies ON tasks USING GIN (dependencies);
CREATE INDEX IF NOT EXISTS idx_tasks_assigned_agent ON tasks(assigned_agent_id);
CREATE INDEX IF NOT EXISTS idx_tasks_workflow_code ON tasks(workflow_code);
CREATE INDEX IF NOT EXISTS idx_consumer_units_client ON consumer_units(client_id);
CREATE INDEX IF NOT EXISTS idx_artifacts_client ON artifacts(client_id);
CREATE INDEX IF NOT EXISTS idx_artifacts_type ON artifacts(artifact_type);
CREATE INDEX IF NOT EXISTS idx_knowledge_sources_type ON knowledge_sources(source_type, distributor);

