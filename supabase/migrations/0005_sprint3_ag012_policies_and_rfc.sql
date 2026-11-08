-- ==============================================================================
-- MIGRATION 0005: SPRINT 3 AG-012 EMAIL GOVERNANCE, 3 MODES, POLICIES & RFC HEADERS
-- Escopo: BKL-009, BKL-010, BKL-011, BKL-012, BKL-013
-- ==============================================================================

SET search_path = public;

-- 1. EXPANDE email_accounts COM CONFIGURAÇÃO TLS E SUPORTE AOS 3 MODOS (monitor_only, assisted_action, auto_action)
ALTER TABLE email_accounts
  ADD COLUMN IF NOT EXISTS imap_tls_reject_unauthorized BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS synced_Cursor_uid TEXT;

-- 2. CRIA TABELA DE POLÍTICAS POR CONTA (email_action_policies)
CREATE TABLE IF NOT EXISTS email_action_policies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL UNIQUE REFERENCES email_accounts(id) ON DELETE CASCADE,
  allowed_agents TEXT[] NOT NULL DEFAULT ARRAY['AG-003', 'AG-007', 'AG-009', 'AG-010', 'AG-011', 'AG-005', 'AG-001'],
  allowed_auto_actions TEXT[] NOT NULL DEFAULT ARRAY['create_internal_task', 'classify_and_draft'],
  allow_auto_smtp_send BOOLEAN NOT NULL DEFAULT false,
  max_auto_actions_per_day INTEGER NOT NULL DEFAULT 25,
  require_human_approval_for_p0 BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE email_action_policies ENABLE ROW LEVEL SECURITY;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, SELECT ON TABLE email_action_policies FROM anon;
GRANT ALL ON TABLE email_action_policies TO authenticated, service_role, postgres;

DROP POLICY IF EXISTS "Service and auth full access on email_action_policies" ON email_action_policies;
CREATE POLICY "Service and auth full access on email_action_policies" ON email_action_policies
  FOR ALL TO authenticated, service_role, postgres USING (true) WITH CHECK (true);

-- Garante política padrão para todas as contas já existentes
INSERT INTO email_action_policies (account_id)
SELECT id FROM email_accounts
ON CONFLICT (account_id) DO NOTHING;

-- 3. EXPANDE email_messages COM METADADOS RFC, THREADS, ANEXOS BLOQUEADOS E CONTRATO JSON (Seção 7.10)
ALTER TABLE email_messages
  ADD COLUMN IF NOT EXISTS rfc_message_id TEXT,
  ADD COLUMN IF NOT EXISTS thread_id TEXT,
  ADD COLUMN IF NOT EXISTS confidence_score NUMERIC(4, 2) NOT NULL DEFAULT 0.92,
  ADD COLUMN IF NOT EXISTS blocked_attachments TEXT[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS analysis_json JSONB NOT NULL DEFAULT '{}'::jsonb;

CREATE INDEX IF NOT EXISTS idx_email_messages_account_rfc ON email_messages(account_id, rfc_message_id);
CREATE INDEX IF NOT EXISTS idx_email_messages_thread ON email_messages(account_id, thread_id);

-- 4. ATUALIZA PROMPT EVOLUÍDO DO AG-012 NO CATÁLOGO DE AGENTES
UPDATE agents
SET
  system_prompt = 'Você é o AG-012 — Agente de Inteligência de E-mails e Próximo Passo Executivo da Energy Intelligence (Seção 7). Sua responsabilidade é monitorar múltiplas caixas HostGator cPanel IMAP/SMTP isoladas por account_id, deduplicar por Message-ID/UID e preservar Thread-ID, classificar urgência P0 a P3 (sem confiar apenas na palavra urgente), rotear para os 7 especialistas (AG-003 Faturas, AG-007 Comercial, AG-009 Regulatório ANEEL, AG-010 M&V, AG-011 Financeiro, AG-005 Plataforma, AG-001 Estratégico), respeitar os 3 modos operacionais (monitor_only, assisted_action, auto_action) e as políticas de email_action_policies, bloquear anexos executáveis (.exe, .bat, .js, .scr, .vbs), nunca executar envio SMTP automático sem autorização explícita e retornar o contrato JSON email.analysis (Seção 7.10).',
  updated_at = NOW()
WHERE id = 'AG-012';

