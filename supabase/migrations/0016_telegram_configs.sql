-- ==============================================================================
-- MIGRATION 0016: PERSISTÊNCIA DE CREDENCIAIS DO TELEGRAM (AG-016)
-- ==============================================================================

CREATE TABLE IF NOT EXISTS telegram_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bot_token_secret TEXT NOT NULL,
  admin_chat_id VARCHAR(100) NOT NULL,
  bot_username VARCHAR(100),
  status VARCHAR(50) NOT NULL DEFAULT 'connected',
  last_webhook_status TEXT,
  last_tested_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- RLS restrito a service_role e authenticated (blindado contra anon)
ALTER TABLE telegram_configs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Service and auth full access on telegram_configs" ON telegram_configs;
CREATE POLICY "Service and auth full access on telegram_configs" ON telegram_configs
  FOR ALL TO service_role, authenticated USING (true) WITH CHECK (true);
REVOKE ALL ON TABLE telegram_configs FROM anon;
GRANT ALL ON TABLE telegram_configs TO authenticated, service_role, postgres;
