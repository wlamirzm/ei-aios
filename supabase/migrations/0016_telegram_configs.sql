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

-- Permissões para service_role, authenticated e anon
ALTER TABLE telegram_configs DISABLE ROW LEVEL SECURITY;
GRANT ALL ON TABLE telegram_configs TO anon, authenticated, service_role, postgres;
