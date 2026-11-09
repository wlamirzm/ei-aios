-- ==============================================================================
-- MIGRATION 0010: SPRINT 6 S6-03 REAL REVENUE PIPELINE & CONTRACT BILLING SYNC
-- Segregated Contracted, Invoiced, Received Revenue & Verified Success Fee
-- ==============================================================================
--
-- ATENÇÃO: ESTA MIGRATION FAZ PARTE DA SPRINT 6 (S6-03).
-- NÃO EXECUTAR DIRETAMENTE NO BANCO DE PRODUÇÃO SEM APROVAÇÃO FORMAL.
-- COMPATIBILIDADE GARANTIDA COM MIGRATIONS 0001 A 0009.
-- ==============================================================================

-- 1. Contratos Reais B2B (Contracted Revenue)
CREATE TABLE IF NOT EXISTS client_contracts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
    contract_number TEXT NOT NULL UNIQUE,
    start_date DATE NOT NULL,
    end_date DATE,
    monthly_recurring_value_brl NUMERIC(14, 2),
    has_success_fee BOOLEAN NOT NULL DEFAULT false,
    success_fee_percent NUMERIC(5, 2),
    success_fee_clause TEXT,
    adjustment_index TEXT NOT NULL DEFAULT 'IPCA' CHECK (adjustment_index IN ('IPCA', 'IGP-M', 'INPC', 'FIXED')),
    adjustment_periodicity_months INTEGER NOT NULL DEFAULT 12,
    last_adjustment_date DATE,
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'expired', 'suspended', 'draft', 'cancelled')),
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 2. Faturas Emitidas por Competência (Invoiced Revenue)
CREATE TABLE IF NOT EXISTS revenue_invoices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    contract_id UUID NOT NULL REFERENCES client_contracts(id) ON DELETE RESTRICT,
    client_id UUID NOT NULL REFERENCES clients(id) ON DELETE RESTRICT,
    invoice_number TEXT NOT NULL UNIQUE,
    competence TEXT NOT NULL, -- YYYY-MM
    issue_date DATE NOT NULL,
    due_date DATE NOT NULL,
    recurring_amount_brl NUMERIC(14, 2) NOT NULL DEFAULT 0.00,
    success_fee_amount_brl NUMERIC(14, 2) NOT NULL DEFAULT 0.00,
    total_amount_brl NUMERIC(14, 2) NOT NULL DEFAULT 0.00,
    status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'issued', 'paid', 'partially_paid', 'overdue', 'cancelled')),
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 3. Recebimentos e Liquidações Financeiras (Received Revenue)
CREATE TABLE IF NOT EXISTS revenue_receipts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    invoice_id UUID NOT NULL REFERENCES revenue_invoices(id) ON DELETE RESTRICT,
    client_id UUID NOT NULL REFERENCES clients(id) ON DELETE RESTRICT,
    receipt_date DATE NOT NULL,
    amount_received_brl NUMERIC(14, 2) NOT NULL,
    transaction_reference TEXT NOT NULL,
    is_partial BOOLEAN NOT NULL DEFAULT false,
    balance_remaining_brl NUMERIC(14, 2) NOT NULL DEFAULT 0.00,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 4. Eventos Auditáveis de Success Fee (AG-004 + HITL)
CREATE TABLE IF NOT EXISTS success_fee_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    contract_id UUID NOT NULL REFERENCES client_contracts(id) ON DELETE RESTRICT,
    client_id UUID NOT NULL REFERENCES clients(id) ON DELETE RESTRICT,
    mv_report_id TEXT NOT NULL,
    competence TEXT NOT NULL, -- YYYY-MM
    verified_savings_brl NUMERIC(14, 2) NOT NULL,
    clause_applied TEXT NOT NULL,
    fee_percent NUMERIC(5, 2) NOT NULL,
    eligible_amount_brl NUMERIC(14, 2) NOT NULL,
    approval_status TEXT NOT NULL DEFAULT 'pending_approval' CHECK (approval_status IN ('pending_approval', 'approved', 'rejected')),
    approved_by TEXT,
    approved_at TIMESTAMPTZ,
    invoice_id UUID REFERENCES revenue_invoices(id) ON DELETE SET NULL,
    status TEXT NOT NULL DEFAULT 'pending_approval' CHECK (status IN ('pending_approval', 'approved', 'invoiced', 'received', 'not_eligible', 'rejected')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 5. Índices de Performance e Integridade
CREATE INDEX IF NOT EXISTS idx_client_contracts_client_id ON client_contracts(client_id);
CREATE INDEX IF NOT EXISTS idx_client_contracts_status ON client_contracts(status);
CREATE INDEX IF NOT EXISTS idx_revenue_invoices_client_id ON revenue_invoices(client_id);
CREATE INDEX IF NOT EXISTS idx_revenue_invoices_competence ON revenue_invoices(competence);
CREATE INDEX IF NOT EXISTS idx_revenue_invoices_status ON revenue_invoices(status);
CREATE INDEX IF NOT EXISTS idx_revenue_receipts_invoice_id ON revenue_receipts(invoice_id);
CREATE INDEX IF NOT EXISTS idx_revenue_receipts_client_id ON revenue_receipts(client_id);
CREATE INDEX IF NOT EXISTS idx_success_fee_events_client_id ON success_fee_events(client_id);
CREATE INDEX IF NOT EXISTS idx_success_fee_events_competence ON success_fee_events(competence);
CREATE INDEX IF NOT EXISTS idx_success_fee_events_approval_status ON success_fee_events(approval_status);

-- 6. Políticas de RLS
ALTER TABLE client_contracts ENABLE ROW LEVEL SECURITY;
ALTER TABLE revenue_invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE revenue_receipts ENABLE ROW LEVEL SECURITY;
ALTER TABLE success_fee_events ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'client_contracts' AND policyname = 'service_role_client_contracts_all') THEN
        CREATE POLICY service_role_client_contracts_all ON client_contracts FOR ALL USING (auth.role() = 'service_role' OR auth.role() = 'authenticated');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'revenue_invoices' AND policyname = 'service_role_revenue_invoices_all') THEN
        CREATE POLICY service_role_revenue_invoices_all ON revenue_invoices FOR ALL USING (auth.role() = 'service_role' OR auth.role() = 'authenticated');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'revenue_receipts' AND policyname = 'service_role_revenue_receipts_all') THEN
        CREATE POLICY service_role_revenue_receipts_all ON revenue_receipts FOR ALL USING (auth.role() = 'service_role' OR auth.role() = 'authenticated');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'success_fee_events' AND policyname = 'service_role_success_fee_events_all') THEN
        CREATE POLICY service_role_success_fee_events_all ON success_fee_events FOR ALL USING (auth.role() = 'service_role' OR auth.role() = 'authenticated');
    END IF;
END $$;

