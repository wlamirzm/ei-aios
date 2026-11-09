# EI-AIOS — HANDOVER DA ARQUITETURA FINANCEIRA S6-06
## Manual de Transição Técnica e Arquitetura do AG-011 CFO Digital

**Projeto:** Energy Intelligence AIOS (EI-AIOS)  
**Sprint:** 6 — FinOps Ledger Engine & Sovereign Financial Architecture  
**Atividade:** S6-06 (E2E Financial Reconciliation Testing & Handover)  
**Data:** 08/11/2026  
**Público-Alvo:** Engenheiros de Software, Arquitetos, Analistas de FinOps e Operadores da Plataforma

---

## 1. VISÃO GERAL DA ARQUITETURA SOBERANA

A Sprint 6 estabeleceu a **Arquitetura Financeira Soberana** do EI-AIOS, transformando o **AG-011** em um verdadeiro CFO Digital baseado em dados contábeis rastreáveis e auditáveis:

```mermaid
graph TD
    subgraph Contexto & Execução
        A["Fatura de Energia / Tarefa"] --> B["Task Router / Worker"]
        B --> C["Execution Context<br/>(client_id, UC, execution_id)"]
        C --> D["LLM Inference<br/>(Gemini Flash/Lite/Pro)"]
        D --> E["Tabela agent_runs"]
    end

    subgraph FinOps Ledger (S6-02)
        E --> F["FinopsLedgerEngine"]
        F --> G["Tabela de Preços V2026_11"]
        F --> H["Lançamento Contábil no Ledger<br/>(client_attributable / internal / orphan)"]
    end

    subgraph Real Revenue Pipeline (S6-03)
        I["client_contracts"] --> J["RevenuePipelineEngine"]
        K["AG-004 M&V Report"] --> L["Success Fee Engine"]
        L -->|"Exige HITL Nível 2"| M["Faturamento (Invoices)"]
        J --> M
        N["Comprovantes Bancários"] --> O["Recebimentos (Receipts)"]
    end

    subgraph Unit Economics & Observability (S6-04 & S6-05)
        H --> P["RealMarginReport"]
        M --> P
        O --> P
        Q["acquisition_expenses (S&M)"] --> R["UnitEconomicsEngine"]
        S["customer_acquisitions"] --> R
        R --> T["CAC / LTV / Payback"]
        P --> U["ObservabilityDashboardService"]
        T --> U
        U --> V["Dashboard Web Next.js<br/>(Sem Defaults Fictícios)"]
    end
```

---

## 2. COMPONENTES E CLASSES CENTRAIS

### 2.1 `FinopsLedgerEngine`
Local: `packages/agent-core/src/tools/finops-ledger-engine.ts`
- **Função:** Reconcilia execuções da tabela `agent_runs` em lançamentos contábeis determinísticos.
- **Tabela de Preços Vigente (V2026_11):**
  * `gemini-3.5-flash-lite`: US$ 0.075 / 1M input, US$ 0.300 / 1M output.
  * `gemini-3.8-flash`: US$ 0.150 / 1M input, US$ 0.600 / 1M output.
  * `gemini-2.5-pro`: US$ 1.250 / 1M input, US$ 5.000 / 1M output.
- **Categorias Contábeis:** `client_attributable`, `platform_internal`, `unattributed_legacy`, `unattributed_orphan`.

### 2.2 `RevenuePipelineEngine`
Local: `packages/agent-core/src/tools/revenue-pipeline-engine.ts`
- **Função:** Gerencia contratos, emissão de faturas, liquidação de recebimentos e cálculo de Success Fee.
- **Regras Críticas:**
  * Faturamento segregado por competência mensal (`YYYY-MM`).
  * Prevenção ativa de faturamento duplicado para a mesma competência e contrato.
  * Success Fee condicionado à economia comprovada pelo AG-004 (IPMVP) e aprovação humana (HITL).
  * Rateio contábil proporcional em recebimentos parciais.

### 2.3 `UnitEconomicsEngine`
Local: `packages/agent-core/src/tools/unit-economics-engine.ts`
- **Função:** Ingestão de despesas de aquisição (S&M) e suporte operacional (COGS), calculando CAC, LTV e Payback.
- **Regras Críticas:**
  * Prevenção de divisão por zero: sem aquisições na janela móvel (30/60/90d), CAC retorna `null`.
  * LTV baseado exclusivamente na margem de contribuição mensal média real.
  * Payback em meses calculado como $\frac{\text{CAC}}{\text{Margem Mensal}}$.

### 2.4 `ObservabilityDashboardService`
Local: `packages/agent-core/src/tools/observability-dashboard-service.ts`
- **Função:** Consolidador de alto nível para endpoints REST e interface web.
- **Regras Críticas:**
  * Eliminação de fallbacks estáticos (R$ 1.490). Dados ausentes resultam em `null` ou `incomplete`.
  * Emissão de alertas de governança (`governance.alerts`) para custos órfãos e execuções sem modelo precificado.
  * Isolamento multi-tenant por `tenantId`.

---

## 3. PROCEDIMENTO DE AUDITORIA E VERIFICAÇÃO CONTÁBIL

1. **Checagem de Custos Órfãos:**
   ```typescript
   const summary = dashboardService.getCostAndUsageDetails();
   const orphanSpend = summary.breakdown.by_category.unattributed_legacy.cost_usd;
   ```
2. **Checagem de Saldos Devedores de Clientes:**
   ```typescript
   const report = revenueEngine.generateClientMarginReport(clientId, competence, aiCost);
   const pending = report.outstanding_invoiced_brl;
   ```
3. **Auditoria de Confiabilidade:**
   Verificar se qualquer indicador possui `reliability !== 'measured'`, inspecionando os alertas de governança associados.
