-- ==============================================================================
-- Migration 0012: Diagnostic Reports (Relatórios Públicos de Diagnóstico)
-- Permite gerar links compartilháveis para clientes visualizarem laudos
-- ==============================================================================

CREATE TABLE IF NOT EXISTS diagnostic_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  token UUID UNIQUE NOT NULL DEFAULT gen_random_uuid(),
  energy_bill_id UUID NOT NULL REFERENCES energy_bills(id) ON DELETE CASCADE,
  created_by TEXT NOT NULL DEFAULT 'founder',
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '30 days'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_diagnostic_reports_token ON diagnostic_reports(token);
CREATE INDEX idx_diagnostic_reports_bill ON diagnostic_reports(energy_bill_id);
