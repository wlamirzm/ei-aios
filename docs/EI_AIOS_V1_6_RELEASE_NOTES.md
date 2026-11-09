# EI-AIOS — RELEASE NOTES v1.6
## Release v1.6: Sovereign FinOps Ledger & Real Revenue Architecture

**Data de Lançamento:** Novembro/2026  
**Versão:** `v1.6-sprint6-complete`  
**Tag Git:** `v1.6-sprint6-complete`  
**Commit de Base:** `53ec0ca`  
**Status:** PRONTA PARA PUBLICAÇÃO ASSISTIDA

---

## 1. DESTAQUES DA RELEASE

A **Release v1.6** consolida a maturidade financeira e contábil do **EI-AIOS**, introduzindo a arquitetura soberana de **FinOps Ledger**, **Real Revenue Pipeline** e **Auditable Unit Economics** sob governança do agente **AG-011 (CFO Digital)**.

A plataforma agora possui capacidade autônoma e determinística de:
1. Rastrear exatamente quanto cada inferência de IA custou, qual agente consumiu, qual modelo foi utilizado e a qual cliente/unidade consumidora o custo pertence.
2. Calcular receitas contratuais recorrentes, faturadas e recebidas, segregando-as do Success Fee.
3. Condicionar qualquer cobrança de Success Fee à validação formal de economia real por protocolo internacional IPMVP (AG-004) e aprovação humana obrigatória (HITL Nível 2).
4. Calcular CAC real (janelas de 30, 60 e 90 dias), LTV sustentável baseado em margem de contribuição efetiva e tempo de Payback em meses.
5. Apresentar um Dashboard Executivo sem valores demonstrativos ou fallbacks arbitrários (eliminação definitiva do default estático de R$ 1.490).

---

## 2. NOVOS RECURSOS & MÓDULOS

### 2.1 Context Propagation & Rastreabilidade Multi-Tenant (S6-01)
- Injeção e propagação dos campos `client_id`, `consumer_unit_id`, `execution_id`, `task_id` e `is_internal` através de todos os pontos de processamento do sistema.
- Validação multi-tenant em tempo de execução para evitar vazamento cross-tenant entre unidades consumidoras e clientes.

### 2.2 Cost & Usage Ledger Engine (S6-02)
- Motor determinístico de reconciliação de custos de IA sobre a tabela `agent_runs`.
- Tabela oficial de precificação por milhão de tokens (Gemini 3.5 Flash Lite, Gemini 3.8 Flash, Gemini 2.5 Pro).
- Segregação de custos em 3 categorias contábeis: `client_attributable`, `platform_internal` e `unattributed_legacy`.
- Classificação por tiers de confiabilidade: `measured`, `estimated` e `incomplete`.

### 2.3 Real Revenue Pipeline & Success Fee Engine (S6-03)
- Motor determinístico de faturamento e contratos com suporte a múltiplos índices de reajuste (IPCA, IGP-M, INPC, FIXED).
- Segregação em 4 dimensões financeiras: *Contracted Revenue*, *Invoiced Revenue*, *Received Revenue* e *Success Fee*.
- Prevenção ativa contra emissão de faturas duplicadas para a mesma competência e contrato.
- Tratamento proporcional em recebimentos parciais.

### 2.4 CAC, LTV & Payback Data Foundation (S6-04)
- Ingestão contábil de despesas de aquisição (S&M) e custos operacionais de suporte (COGS).
- Cálculo auditável de CAC em janelas móveis com proteção contra divisão por zero.
- LTV fundamentado em margem de contribuição real e cálculo de Payback do capital investido.

### 2.5 Observability Ledger Dashboard (S6-05)
- Agregador executivo backend `ObservabilityDashboardService` com novos endpoints:
  * `GET /api/v1/finops/dashboard/overview`
  * `GET /api/v1/finops/dashboard/cost-usage`
- Interface web Next.js (`packages/web-ui/src/app/finops/page.tsx`) reestruturada com seletor de competência, badges visuais de confiabilidade, painel de consumo por agente/modelo e auditoria detalhada de execuções.

---

## 3. BANCO DE DADOS (NOVAS MIGRATIONS)

- **Migration 0008:** Expande `agent_runs` e `tasks` com colunas de rastreabilidade operacional (`consumer_unit_id`, `execution_id`, `is_internal`).
- **Migration 0009:** Cria o catálogo de preços `finops_model_pricing` e o ledger contábil `finops_ledger`.
- **Migration 0010:** Cria tabelas de contratos (`client_contracts`), faturamento (`revenue_invoices`), recebimentos (`revenue_receipts`) e taxa de sucesso (`success_fee_events`).
- **Migration 0011:** Cria tabelas de despesas de aquisição (`acquisition_expenses`), suporte (`operational_expenses`), aquisições (`customer_acquisition_events`) e snapshots (`financial_metric_snapshots`).

---

## 4. AUDITORIA DE TESTES AUTOMATIZADOS

- **Suíte Global de Testes:** **123 testes aprovados (100% PASS)**.
- **Zero Falhas, Zero Regressões, Zero Testes Pulados**.
- Tempo médio de execução da suíte completa: **~15.6 segundos**.

---

## 5. INSTRUÇÕES DE IMPLANTAÇÃO

A implantação desta versão deve seguir estritamente o [`docs/EI_AIOS_V1_6_DEPLOYMENT_RUNBOOK.md`](file:///c:/_dev/ei-aios/docs/EI_AIOS_V1_6_DEPLOYMENT_RUNBOOK.md), executando as migrations 0008 a 0011 em sequência atômica antes da atualização dos serviços no Docker Swarm.

