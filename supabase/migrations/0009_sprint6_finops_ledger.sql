-- ==============================================================================
-- MIGRATION 0009: SPRINT 6 S6-02 FINOPS COST & USAGE LEDGER
-- Deterministic, Append-Only and Idempotent AI Cost Ledger
-- ==============================================================================
--
-- ATENÇÃO: ESTA MIGRATION FAZ PARTE DA SPRINT 6 (S6-02).
-- NÃO EXECUTAR DIRETAMENTE NO BANCO DE PRODUÇÃO SEM APROVAÇÃO FORMAL.
-- COMPATIBILIDADE GARANTIDA COM MIGRATIONS 0001 A 0008.
-- ==============================================================================

-- 1. Catálogo Versionado de Preços de Modelos de Linguagem
CREATE TABLE IF NOT EXISTS finops_model_pricing (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    version_id TEXT NOT NULL,
    model_name TEXT NOT NULL,
    input_usd_per_million NUMERIC(12, 6) NOT NULL,
    output_usd_per_million NUMERIC(12, 6) NOT NULL,
    currency TEXT NOT NULL DEFAULT 'USD',
    effective_from TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    effective_until TIMESTAMPTZ,
    is_active BOOLEAN NOT NULL DEFAULT true,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    CONSTRAINT uq_finops_model_pricing_version_model UNIQUE (version_id, model_name)
);

-- Seed inicial de tabela de preços oficial (versão v2026.11)
INSERT INTO finops_model_pricing (version_id, model_name, input_usd_per_million, output_usd_per_million, is_active)
VALUES
    ('v2026.11', 'gemini-3.5-flash-lite', 0.075000, 0.300000, true),
    ('v2026.11', 'gemini-3.1-flash-lite', 0.075000, 0.300000, true),
    ('v2026.11', 'gemini-3.8-flash',      0.150000, 0.600000, true),
    ('v2026.11', 'gemini-4-argon',        1.250000, 5.000000, true),
    ('v2026.11', 'gemini-2.5-flash',      0.150000, 0.600000, true),
    ('v2026.11', 'gemini-2.5-pro',        1.250000, 5.000000, true),
    ('v2026.11', 'gemini-2.0-flash',      0.100000, 0.400000, true),
    ('v2026.11', 'gemini-1.5-pro',        1.250000, 5.000000, true)
ON CONFLICT (version_id, model_name) DO NOTHING;

-- 2. Tabela Central do Ledger de Custos e Uso de IA (Cost & Usage Ledger)
CREATE TABLE IF NOT EXISTS finops_ledger (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    run_id UUID NOT NULL,
    task_id UUID REFERENCES tasks(id) ON DELETE SET NULL,
    agent_id TEXT NOT NULL,
    client_id UUID REFERENCES clients(id) ON DELETE SET NULL,
    consumer_unit_id UUID REFERENCES consumer_units(id) ON DELETE SET NULL,
    execution_id TEXT,
    model_name TEXT NOT NULL,
    input_tokens INTEGER,
    output_tokens INTEGER,
    pricing_version TEXT NOT NULL,
    cost_usd NUMERIC(14, 6),
    cost_brl NUMERIC(14, 4),
    exchange_rate NUMERIC(8, 4) NOT NULL,
    reliability_tier TEXT NOT NULL CHECK (reliability_tier IN ('measured', 'estimated', 'reconciled', 'incomplete', 'unattributed')),
    category TEXT NOT NULL CHECK (category IN ('client_attributable', 'platform_internal', 'unattributed_legacy', 'unattributed_orphan')),
    origin TEXT,
    run_created_at TIMESTAMPTZ,
    reconciled_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    is_reprocessed BOOLEAN NOT NULL DEFAULT false,
    divergence_notes TEXT,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    CONSTRAINT uq_finops_ledger_run_id UNIQUE (run_id)
);

-- 3. Índices Estratégicos para Idempotência e Consultas Agregadas
CREATE UNIQUE INDEX IF NOT EXISTS idx_finops_ledger_run_id ON finops_ledger (run_id);
CREATE INDEX IF NOT EXISTS idx_finops_ledger_client_id ON finops_ledger (client_id) WHERE client_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_finops_ledger_consumer_unit_id ON finops_ledger (consumer_unit_id) WHERE consumer_unit_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_finops_ledger_category ON finops_ledger (category);
CREATE INDEX IF NOT EXISTS idx_finops_ledger_reliability_tier ON finops_ledger (reliability_tier);
CREATE INDEX IF NOT EXISTS idx_finops_ledger_reconciled_at ON finops_ledger (reconciled_at DESC);
CREATE INDEX IF NOT EXISTS idx_finops_ledger_pricing_version ON finops_ledger (pricing_version);
CREATE INDEX IF NOT EXISTS idx_finops_ledger_agent_id ON finops_ledger (agent_id);

-- 4. Políticas de Leitura RLS
ALTER TABLE finops_ledger ENABLE ROW LEVEL SECURITY;
ALTER TABLE finops_model_pricing ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename = 'finops_ledger' AND policyname = 'service_role_finops_ledger_all'
    ) THEN
        CREATE POLICY service_role_finops_ledger_all ON finops_ledger
            FOR ALL USING (auth.role() = 'service_role' OR auth.role() = 'authenticated');
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename = 'finops_model_pricing' AND policyname = 'service_role_finops_pricing_all'
    ) THEN
        CREATE POLICY service_role_finops_pricing_all ON finops_model_pricing
            FOR ALL USING (auth.role() = 'service_role' OR auth.role() = 'authenticated');
    END IF;
END $$;

