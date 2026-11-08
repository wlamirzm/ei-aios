-- ==============================================================================
-- MIGRATION 0003: SPRINT 1 SECURITY HARDENING & RLS RESTRICTIONS (BKL-004)
-- Platform: Energy Intelligence AIOS (EI-AIOS)
-- ==============================================================================

SET search_path = public;

-- 1. HABILITA RLS NAS TABELAS TRANSACIONAIS E DE E-MAIL
ALTER TABLE clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE consumer_units ENABLE ROW LEVEL SECURITY;
ALTER TABLE energy_bills ENABLE ROW LEVEL SECURITY;
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE approvals ENABLE ROW LEVEL SECURITY;
ALTER TABLE artifacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_messages ENABLE ROW LEVEL SECURITY;

-- 2. REVOGA PERMISSÕES DE ESCRITA E EXCLUSÃO DO ROLE ANON
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON TABLE
  agents,
  knowledge_sources,
  clients,
  consumer_units,
  energy_bills,
  tasks,
  agent_runs,
  approvals,
  artifacts,
  email_accounts,
  email_messages
FROM anon;

-- Bloqueia também leitura anônima de credenciais em email_accounts
REVOKE SELECT ON TABLE email_accounts FROM anon;

-- Garante permissões plenas apenas para service_role, authenticated e postgres
GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated, service_role, postgres;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO authenticated, service_role, postgres;

-- 3. SUBSTITUI POLÍTICAS PERMISSIVAS POR POLÍTICAS RESTRITAS DE ESCRITA
DROP POLICY IF EXISTS "Full access on clients" ON clients;
DROP POLICY IF EXISTS "Service and auth full access on clients" ON clients;
DROP POLICY IF EXISTS "Anon read-only on clients" ON clients;
CREATE POLICY "Service and auth full access on clients" ON clients
  FOR ALL TO authenticated, service_role, postgres USING (true) WITH CHECK (true);
CREATE POLICY "Anon read-only on clients" ON clients
  FOR SELECT TO anon USING (true);

DROP POLICY IF EXISTS "Full access on consumer_units" ON consumer_units;
DROP POLICY IF EXISTS "Service and auth full access on consumer_units" ON consumer_units;
DROP POLICY IF EXISTS "Anon read-only on consumer_units" ON consumer_units;
CREATE POLICY "Service and auth full access on consumer_units" ON consumer_units
  FOR ALL TO authenticated, service_role, postgres USING (true) WITH CHECK (true);
CREATE POLICY "Anon read-only on consumer_units" ON consumer_units
  FOR SELECT TO anon USING (true);

DROP POLICY IF EXISTS "Full access on energy_bills" ON energy_bills;
DROP POLICY IF EXISTS "Service and auth full access on energy_bills" ON energy_bills;
DROP POLICY IF EXISTS "Anon read-only on energy_bills" ON energy_bills;
CREATE POLICY "Service and auth full access on energy_bills" ON energy_bills
  FOR ALL TO authenticated, service_role, postgres USING (true) WITH CHECK (true);
CREATE POLICY "Anon read-only on energy_bills" ON energy_bills
  FOR SELECT TO anon USING (true);

DROP POLICY IF EXISTS "Full access on tasks" ON tasks;
DROP POLICY IF EXISTS "Service and auth full access on tasks" ON tasks;
DROP POLICY IF EXISTS "Anon read-only on tasks" ON tasks;
CREATE POLICY "Service and auth full access on tasks" ON tasks
  FOR ALL TO authenticated, service_role, postgres USING (true) WITH CHECK (true);
CREATE POLICY "Anon read-only on tasks" ON tasks
  FOR SELECT TO anon USING (true);

DROP POLICY IF EXISTS "Full access on agent_runs" ON agent_runs;
DROP POLICY IF EXISTS "Service and auth full access on agent_runs" ON agent_runs;
DROP POLICY IF EXISTS "Anon read-only on agent_runs" ON agent_runs;
CREATE POLICY "Service and auth full access on agent_runs" ON agent_runs
  FOR ALL TO authenticated, service_role, postgres USING (true) WITH CHECK (true);
CREATE POLICY "Anon read-only on agent_runs" ON agent_runs
  FOR SELECT TO anon USING (true);

DROP POLICY IF EXISTS "Full access on approvals" ON approvals;
DROP POLICY IF EXISTS "Service and auth full access on approvals" ON approvals;
DROP POLICY IF EXISTS "Anon read-only on approvals" ON approvals;
CREATE POLICY "Service and auth full access on approvals" ON approvals
  FOR ALL TO authenticated, service_role, postgres USING (true) WITH CHECK (true);
CREATE POLICY "Anon read-only on approvals" ON approvals
  FOR SELECT TO anon USING (true);

DROP POLICY IF EXISTS "Full access on artifacts" ON artifacts;
DROP POLICY IF EXISTS "Service and auth full access on artifacts" ON artifacts;
DROP POLICY IF EXISTS "Anon read-only on artifacts" ON artifacts;
CREATE POLICY "Service and auth full access on artifacts" ON artifacts
  FOR ALL TO authenticated, service_role, postgres USING (true) WITH CHECK (true);
CREATE POLICY "Anon read-only on artifacts" ON artifacts
  FOR SELECT TO anon USING (true);

DROP POLICY IF EXISTS "Service and auth full access on email_accounts" ON email_accounts;
CREATE POLICY "Service and auth full access on email_accounts" ON email_accounts
  FOR ALL TO authenticated, service_role, postgres USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Service and auth full access on email_messages" ON email_messages;
CREATE POLICY "Service and auth full access on email_messages" ON email_messages
  FOR ALL TO authenticated, service_role, postgres USING (true) WITH CHECK (true);
