# EI-AIOS — MATRIZ DE CONCILIAÇÃO FINANCEIRA S6-06
## Mapeamento e Rastreabilidade Cruzada dos Indicadores Financeiros

**Projeto:** Energy Intelligence AIOS (EI-AIOS)  
**Sprint:** 6 — FinOps Ledger Engine & Sovereign Financial Architecture  
**Atividade:** S6-06 (E2E Financial Reconciliation Testing & Handover)  
**Data:** 08/11/2026  
**Status:** CONCILIADO COM 100% DE EXATIDÃO MATEMÁTICA

---

## 1. MATRIZ DE CONCILIAÇÃO POR ENTIDADE E MÓDULO

| Indicador Financeiro | Módulo de Origem | Módulo de Destino / Visualização | Fórmula / Regra Contábil | Tolerância de Divergência | Status de Conciliação |
| :--- | :--- | :--- | :--- | :---: | :---: |
| **Custo de Inferência IA (USD)** | `agent_runs` / `FinopsLedgerEngine` | `ObservabilityDashboardService` & `RealMarginReport` | $\sum \left( \frac{\text{Tokens In}}{10^6} \times P_{\text{in}} + \frac{\text{Tokens Out}}{10^6} \times P_{\text{out}} \right)$ | US$ 0.0000 | **CONCILIADO** |
| **Custo de Inferência IA (BRL)** | `FinopsLedgerEngine` | `RealMarginReport` & Dashboard | $\text{Custo USD} \times \text{Taxa Câmbio Oficial (5.80)}$ | R$ 0.00 | **CONCILIADO** |
| **Receita Contratada (MRR)** | `client_contracts` | `RevenuePipelineEngine` & Dashboard | Valor fixo mensal do contrato ativo na competência | R$ 0.00 | **CONCILIADO** |
| **Success Fee Elegível** | AG-004 M&V Report / `success_fee_events` | `RevenuePipelineEngine` | $\text{Economia Comprovada} \times \%_{\text{Contrato}}$ (se validado e aprovado HITL) | R$ 0.00 | **CONCILIADO** |
| **Receita Faturada Total** | `RevenuePipelineEngine` (`invoices`) | `RealMarginReport` & Dashboard | $\text{MRR Faturado} + \text{Success Fee Faturado}$ | R$ 0.00 | **CONCILIADO** |
| **Receita Recebida Total** | `RevenuePipelineEngine` (`receipts`) | `RealMarginReport` & Dashboard | $\sum \text{Pagamentos Liquidados com Comprovante}$ | R$ 0.00 | **CONCILIADO** |
| **Saldo a Receber (Pendente)** | `RevenuePipelineEngine` | `ObservabilityDashboardService` | $\max(0, \text{Faturado} - \text{Recebido})$ | R$ 0.00 | **CONCILIADO** |
| **Margem s/ Faturado (BRL)** | `RealMarginReport` | Dashboard Executivo | $\text{Total Faturado} - (\text{Custo Direto} + \text{Custo IA BRL})$ | R$ 0.00 | **CONCILIADO** |
| **Margem s/ Recebido (BRL)** | `RealMarginReport` | Dashboard Executivo | $\text{Total Recebido} - (\text{Custo Direto} + \text{Custo IA BRL})$ | R$ 0.00 | **CONCILIADO** |
| **Despesas de Aquisição (S&M)**| `acquisition_expenses` | `UnitEconomicsEngine` & Dashboard | $\sum \text{Despesas Validadas na Janela}$ | R$ 0.00 | **CONCILIADO** |
| **CAC Real (30/60/90d)** | `UnitEconomicsEngine` | Dashboard Executivo | $\frac{\text{Despesas S\&M Elegíveis}}{\text{Novos Clientes Adquiridos na Janela}}$ | R$ 0.00 | **CONCILIADO** |
| **LTV Baseado em Margem** | `UnitEconomicsEngine` | Dashboard Executivo | $\text{Margem Média Mensal Real} \times \text{Lifespan Meses}$ | R$ 0.00 | **CONCILIADO** |
| **Payback em Meses** | `UnitEconomicsEngine` | Dashboard Executivo | $\frac{\text{CAC BRL}}{\text{Margem de Contribuição Mensal BRL}}$ | 0.01 mês | **CONCILIADO** |

---

## 2. AUDITORIA DE REGRAS ESPECIAIS DE RATEIO E GOVERNANÇA

### 2.1 Rateio Proporcional em Pagamentos Parciais
Quando uma fatura contempla simultaneamente cobrança recorrente (MRR) e taxa de sucesso (Success Fee), pagamentos parciais são rateados estritamente na proporção de cada rubrica:

$$\text{Recebido}_{\text{MRR}} = \text{Valor Pago} \times \frac{\text{Faturado}_{\text{MRR}}}{\text{Total Faturado}}$$

$$\text{Recebido}_{\text{SF}} = \text{Valor Pago} \times \frac{\text{Faturado}_{\text{SF}}}{\text{Total Faturado}}$$

*Evidência Validada no Teste E2E-01:* Fatura de R$ 6.000,00 (R$ 4.000,00 MRR e R$ 2.000,00 Success Fee) com pagamento de R$ 5.000,00 resultou com precisão de centavos em R$ 3.333,33 de MRR recebido e R$ 1.666,67 de Success Fee recebido, totalizando R$ 5.000,00 com saldo devedor de R$ 1.000,00.

### 2.2 Política de Tolerância Zero para Dados Fictícios
1. **MRR Sem Contrato:** Ausência de contrato ativo retorna `mrr_brl: null`, `reliability: incomplete` e gera alerta formal no dashboard. Jamais retorna o fallback estático de R$ 1.490.
2. **Success Fee Não Homologado:** Qualquer estimativa de economia não chancelada pelo protocolo IPMVP do AG-004 retorna `eligible_amount_brl: 0` e `status: not_eligible`.
3. **Divisão por Zero no CAC:** Se nenhum cliente novo for adquirido na janela móvel de 30, 60 ou 90 dias, o motor não inventa 0 nem divide por zero: retorna `cac_brl: null`, `status: incomplete` e emite nota de auditoria.
