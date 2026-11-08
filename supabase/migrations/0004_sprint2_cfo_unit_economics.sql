-- ==============================================================================
-- MIGRATION 0004: SPRINT 2 CFO DIGITAL (AG-011) & UNIT ECONOMICS SCHEMA (BKL-007 / BKL-008)
-- Platform: Energy Intelligence AIOS (EI-AIOS)
-- ==============================================================================

SET search_path = public;

-- 1. ADICIONA COLUNAS CONTRATUAIS EM clients PARA CÁLCULO DETERMINÍSTICO DE MRR, ARR E MARGEM
ALTER TABLE clients
  ADD COLUMN IF NOT EXISTS mrr_brl NUMERIC(12, 2) NOT NULL DEFAULT 1490.00,
  ADD COLUMN IF NOT EXISTS setup_fee_brl NUMERIC(12, 2) NOT NULL DEFAULT 2500.00,
  ADD COLUMN IF NOT EXISTS success_fee_percent NUMERIC(5, 2) NOT NULL DEFAULT 20.00,
  ADD COLUMN IF NOT EXISTS direct_monthly_cost_brl NUMERIC(12, 2) NOT NULL DEFAULT 180.00;

-- 2. ADICIONA VÍNCULO OPCIONAL client_id EM agent_runs PARA CONCILIAÇÃO DE MARGEM POR CLIENTE
ALTER TABLE agent_runs
  ADD COLUMN IF NOT EXISTS client_id UUID REFERENCES clients(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_agent_runs_client_id ON agent_runs(client_id);

-- 3. ATUALIZA O PROMPT EVOLUÍDO E FERRAMENTAS DO AG-011 NO CATÁLOGO DE AGENTES
UPDATE agents
SET
  system_prompt = 'Você é o AG-011 — CFO Digital, Controladoria, Precificação, FinOps e Unit Economics da Energy Intelligence. Sua responsabilidade é atuar como inteligência financeira executiva da empresa, combinando controladoria, FP&A, precificação B2B, gestão de caixa, análise de rentabilidade por cliente, governança de custos de IA (conciliados em agent_runs) e unit economics. Regras obrigatórias (Seção 6): 1. Receita e Recorrência: Calcular MRR, ARR e ARPA excluindo estritamente taxa de implantação (setup_fee) e Success Fee variável. 2. Unit Economics: Calcular CAC (com janela de atribuição explícita), LTV, Payback e Margem Bruta por cliente, explicitando limitações quando a amostra for < 10 clientes. 3. Custos de IA: Conciliar agent_runs e sinalizar execuções sem custo ou vínculo. 4. Success Fee: Somente reconhecer sobre economia energética verificada em M&V (AG-010). 5. Simular sempre os 3 cenários (Conservador, Base, Otimista). 6. Nunca inventar dados ausentes (declarar incomplete ou not_available).',
  configuration = jsonb_set(
    COALESCE(configuration, '{}'::jsonb),
    '{tools}',
    '["finops-calculator", "finops_calculator", "saas_metrics"]'::jsonb,
    true
  ),
  updated_at = NOW()
WHERE id = 'AG-011';
