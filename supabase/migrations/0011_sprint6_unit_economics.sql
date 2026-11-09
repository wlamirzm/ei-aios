-- ==============================================================================
-- MIGRATION 0011: SPRINT 6 S6-04 CAC, LTV & PAYBACK DATA FOUNDATION
-- Auditable Unit Economics, Acquisition Spend, COGS & Customer Lifespan
-- ==============================================================================
--
-- ATENÇÃO: ESTA MIGRATION FAZ PARTE DA SPRINT 6 (S6-04).
-- NÃO EXECUTAR DIRETAMENTE NO BANCO DE PRODUÇÃO SEM APROVAÇÃO FORMAL.
-- COMPATIBILIDADE GARANTIDA COM MIGRATIONS 0001 A 0010.
-- ==============================================================================

-- 1. Despesas de Aquisição de Clientes (Sales & Marketing - S&M)
CREATE TABLE IF NOT EXISTS acquisition_expenses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id TEXT NOT NULL DEFAULT 'default_tenant',
    client_id UUID REFERENCES clients(id) ON DELETE SET NULL,
    campaign_id TEXT,
    category TEXT NOT NULL CHECK (category IN (
        'SALES', 'MARKETING', 'ADVERTISING', 'SALES_COMMISSIONS',
        'LEAD_GENERATION', 'EVENTS', 'CUSTOMER_ACQUISITION_TOOLS', 'OTHER_ACQUISITION'
    )),
    description TEXT NOT NULL,
    amount_brl NUMERIC(14, 2) NOT NULL CHECK (amount_brl >= 0),
    currency TEXT NOT NULL DEFAULT 'BRL',
    competence TEXT NOT NULL, -- YYYY-MM
    payment_date DATE NOT NULL,
    document_reference TEXT,
    registered_by TEXT NOT NULL,
    validation_status TEXT NOT NULL DEFAULT 'pending' CHECK (validation_status IN ('validated', 'pending', 'rejected')),
    is_shared BOOLEAN NOT NULL DEFAULT false,
    allocation_rule TEXT,
    history JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 2. Despesas Operacionais e de Suporte (COGS / Onboarding / Maintenance)
CREATE TABLE IF NOT EXISTS operational_expenses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id TEXT NOT NULL DEFAULT 'default_tenant',
    client_id UUID REFERENCES clients(id) ON DELETE SET NULL,
    consumer_unit_id UUID REFERENCES consumer_units(id) ON DELETE SET NULL,
    contract_id UUID REFERENCES client_contracts(id) ON DELETE SET NULL,
    category TEXT NOT NULL CHECK (category IN (
        'ONBOARDING', 'IMPLEMENTATION', 'CUSTOMER_SUPPORT', 'OPERATIONAL_SERVICE',
        'THIRD_PARTY_SERVICE', 'CUSTOMER_SPECIFIC_INFRASTRUCTURE', 'OTHER_COGS'
    )),
    description TEXT NOT NULL,
    amount_brl NUMERIC(14, 2) NOT NULL CHECK (amount_brl >= 0),
    currency TEXT NOT NULL DEFAULT 'BRL',
    competence TEXT NOT NULL, -- YYYY-MM
    payment_date DATE NOT NULL,
    document_reference TEXT,
    registered_by TEXT NOT NULL,
    validation_status TEXT NOT NULL DEFAULT 'pending' CHECK (validation_status IN ('validated', 'pending', 'rejected')),
    is_shared BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 3. Eventos Formais de Aquisição de Clientes
CREATE TABLE IF NOT EXISTS customer_acquisition_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
    tenant_id TEXT NOT NULL DEFAULT 'default_tenant',
    acquisition_date DATE NOT NULL,
    contract_id UUID REFERENCES client_contracts(id) ON DELETE SET NULL,
    channel TEXT,
    initial_mrr_brl NUMERIC(14, 2),
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    CONSTRAINT uq_client_acquisition_event UNIQUE (client_id, acquisition_date)
);

-- 4. Snapshots Históricos de Métricas Financeiras (CAC, LTV, Payback)
CREATE TABLE IF NOT EXISTS financial_metric_snapshots (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id TEXT NOT NULL DEFAULT 'default_tenant',
    metric_type TEXT NOT NULL CHECK (metric_type IN ('CAC', 'LTV', 'PAYBACK', 'MARGIN_SUMMARY')),
    client_id UUID REFERENCES clients(id) ON DELETE SET NULL,
    competence TEXT,
    window_days INTEGER,
    metric_value NUMERIC(14, 2),
    status TEXT NOT NULL CHECK (status IN ('measured', 'estimated', 'incomplete', 'unattributed', 'reconciled')),
    methodology TEXT NOT NULL,
    metadata JSONB DEFAULT '{}'::jsonb,
    calculated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 5. Índices de Auditoria e Desempenho Multi-Tenant
CREATE INDEX IF NOT EXISTS idx_acq_expenses_tenant ON acquisition_expenses(tenant_id);
CREATE INDEX IF NOT EXISTS idx_acq_expenses_client ON acquisition_expenses(client_id);
CREATE INDEX IF NOT EXISTS idx_acq_expenses_payment_date ON acquisition_expenses(payment_date);
CREATE INDEX IF NOT EXISTS idx_acq_expenses_status ON acquisition_expenses(validation_status);

CREATE INDEX IF NOT EXISTS idx_op_expenses_tenant ON operational_expenses(tenant_id);
CREATE INDEX IF NOT EXISTS idx_op_expenses_client ON operational_expenses(client_id);
CREATE INDEX IF NOT EXISTS idx_op_expenses_competence ON operational_expenses(competence);

CREATE INDEX IF NOT EXISTS idx_acq_events_tenant ON customer_acquisition_events(tenant_id);
CREATE INDEX IF NOT EXISTS idx_acq_events_date ON customer_acquisition_events(acquisition_date);

CREATE INDEX IF NOT EXISTS idx_fin_snapshots_tenant ON financial_metric_snapshots(tenant_id);
CREATE INDEX IF NOT EXISTS idx_fin_snapshots_metric ON financial_metric_snapshots(metric_type);

-- 6. Políticas RLS
ALTER TABLE acquisition_expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE operational_expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE customer_acquisition_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE financial_metric_snapshots ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'acquisition_expenses' AND policyname = 'service_role_acq_expenses_all') THEN
        CREATE POLICY service_role_acq_expenses_all ON acquisition_expenses FOR ALL USING (auth.role() = 'service_role' OR auth.role() = 'authenticated');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'operational_expenses' AND policyname = 'service_role_op_expenses_all') THEN
        CREATE POLICY service_role_op_expenses_all ON operational_expenses FOR ALL USING (auth.role() = 'service_role' OR auth.role() = 'authenticated');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'customer_acquisition_events' AND policyname = 'service_role_acq_events_all') THEN
        CREATE POLICY service_role_acq_events_all ON customer_acquisition_events FOR ALL USING (auth.role() = 'service_role' OR auth.role() = 'authenticated');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'financial_metric_snapshots' AND policyname = 'service_role_fin_snapshots_all') THEN
        CREATE POLICY service_role_fin_snapshots_all ON financial_metric_snapshots FOR ALL USING (auth.role() = 'service_role' OR auth.role() = 'authenticated');
    END IF;
END $$;

