-- ==============================================================================
-- MIGRATION 0015: REGISTRO DO AG-018 (GOOGLE WORKSPACE & CLOUD DRIVE AGENT)
-- ==============================================================================

-- 1. REGISTRA O AG-018 NA TABELA DE AGENTES
INSERT INTO agents (
  id,
  name,
  role,
  description,
  system_prompt,
  agent_type,
  default_model,
  temperature,
  daily_token_budget,
  status,
  created_at,
  updated_at
) VALUES (
  'AG-018',
  'Google Workspace & Cloud Drive Agent',
  'Especialista em Repositórios em Nuvem, Gestão Documental & Google Workspace',
  'Busca, indexação, download e upload seguro de laudos, faturas e apresentações no Google Drive corporativo sob governança Nível 2.',
  'Você é o AG-018 - Especialista em Google Workspace & Cloud Drive da Energy Intelligence. Sua responsabilidade é atuar como o guardião dos repositórios em nuvem, localizando faturas e contratos de clientes no Google Drive, indexando acervos de eficiência energética e realizando uploads de laudos, apresentações e Relatórios Master em PDF/Markdown de forma auditável e segura.',
  'cloud_storage',
  'gemini-2.5-flash',
  0.2,
  10,
  'active',
  NOW(),
  NOW()
) ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  role = EXCLUDED.role,
  description = EXCLUDED.description,
  system_prompt = EXCLUDED.system_prompt,
  agent_type = EXCLUDED.agent_type,
  status = 'active',
  updated_at = NOW();

-- 2. TABELA DE CONFIGURAÇÃO DO GOOGLE DRIVE (SERVICE ACCOUNT / OAUTH2)
CREATE TABLE IF NOT EXISTS google_drive_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  auth_type VARCHAR(30) NOT NULL DEFAULT 'service_account',
  service_account_email VARCHAR(255),
  credentials_secret TEXT,
  default_folder_id VARCHAR(120),
  reports_folder_id VARCHAR(120),
  status VARCHAR(50) NOT NULL DEFAULT 'unconfigured',
  last_error TEXT,
  last_synced_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- RLS
ALTER TABLE google_drive_configs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Service and auth full access on google_drive_configs" ON google_drive_configs;
CREATE POLICY "Service and auth full access on google_drive_configs" ON google_drive_configs
  FOR ALL TO service_role, authenticated USING (true) WITH CHECK (true);
