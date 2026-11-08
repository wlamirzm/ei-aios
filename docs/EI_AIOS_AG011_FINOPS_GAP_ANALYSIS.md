# EI-AIOS — AUDITORIA FINANCEIRA DO AG-011 & FINOPS GAP ANALYSIS
## Desconstrução dos Dados Econômicos, Métricas Reais vs. Configuradas e Lacunas de Custeio

**Data:** 08/11/2026  
**Agente Auditado:** AG-011 (Startup CFO & Unit Economics Agent)  
**Módulos Centrais:** `packages/agent-core/src/tools/finops-calculator.ts`, `packages/agent-core/src/api/routes.ts`, `packages/agent-core/src/agents/executors.ts`  
**Classificação dos Indicadores:**
- **REAL:** Obtido diretamente de fonte primária comprovável (ex: contagem de tokens retornada pela API Gemini).
- **ESTIMADO:** Calculado através de fórmulas matemáticas a partir de premissas explicitadas (ex: conversão cambial USD/BRL a R$ 5,80).
- **CONFIGURADO:** Declarado estaticamente em schema DDL, seed de banco de dados ou fallback de código.
- **AUSENTE:** Inexistente na arquitetura atual; não há fonte nem tabela de dados para captura.
- **INCOMPLETO:** A estrutura matemática existe, mas faltam dados de entrada ou correlações operacionais para viabilizar o cálculo.

---

## 1. Origem e Análise Forense do MRR de R$ 1.490,00 (ST-09)

Durante o teste de fumaça **ST-09**, o endpoint `GET /api/v1/metrics/finops` reportou:
`MRR: R$ 1.490,00 | ARR: R$ 17.880,00`.

### Rastreabilidade do Dado:
1. **Origem Primária no Banco de Dados:**
   - Na **Migration 0004** (`0004_sprint2_cfo_unit_economics.sql`), a coluna `mrr_brl` foi adicionada à tabela `clients` com a seguinte definição DDL:
     ```sql
     ALTER TABLE clients
       ADD COLUMN IF NOT EXISTS mrr_brl NUMERIC(12, 2) NOT NULL DEFAULT 1490.00;
     ```
   - No arquivo `supabase/seed.sql`, existe exatamente 1 cliente cadastrado no banco:
     - ID: `a1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d`
     - Empresa: **Indústrias Metalúrgicas Alvorada S.A.**
     - Estágio: `active_saas`
2. **Fallback no Código da API (`routes.ts:416`):**
   ```typescript
   mrrBrl: Number(c.mrr_brl ?? 1490)
   ```
3. **Cálculo Determinístico (`finops-calculator.ts:135-204`):**
   ```typescript
   mrrBrl = SUM(clients.mrr_brl WHERE is_active = true) = R$ 1.490,00
   arrBrl = mrrBrl * 12 = R$ 17.880,00
   ```
4. **Classificação Oficial:**
   - **CONFIGURADO / DEMONSTRATIVO.**
   - O valor **NÃO provém de cobrança bancária real** (Open Finance, Asaas, Stripe ou extrato bancário). Trata-se de um valor contratual de referência imputado no cadastro do cliente piloto da seed inicial.

---

## 2. Como São Obtidos os Dados de Receita

O cálculo de receita da plataforma é estritamente determinístico (executado por `calculateMrrAndArr` em TypeScript, sem qualquer inferência ou "chute" de LLM):

1. **Receita Recorrente (MRR):**
   - Fonte: Campo `clients.mrr_brl`.
   - Regra Regulatória Soberana: Taxas de setup (`setup_fee_brl`) e taxas de sucesso (`success_fee_percent`) são **estritamente excluídas** da receita recorrente mensal.
2. **Receita Variável (Success Fee):**
   - Fonte: Tabela `energy_bills` vinculada às unidades consumidoras do cliente.
   - Regra Contratual Anti-Alucinação: O AG-011 só reconhece Success Fee se a fatura possuir status `validation_status === 'verified_mv'` (economias verificadas por laudo do AG-010). Economias apenas estimadas são classificadas como `blocked_unverified_success_fee_brl`.
3. **Classificação:**
   - **ESTIMADO / CONTRATUAL**: A lógica de segregação é perfeita e auditável, mas a base de dados atual reflete faturamento contratual estático, não faturamento financeiro liquidado.

---

## 3. Análise da Conciliação de 33 Runs de IA

O relatório reportou:
`Total Runs: 33 | Gasto Acumulado: US$ 0.0163 (R$ 0,09) | Tokens: 115.870 In / 25.514 Out`.

### Como são contabilizados:
1. Toda invocação ao Gemini realizada por qualquer agente através do método `generateStructuredContent` (`packages/agent-core/src/config/gemini.ts`) captura os metadados de telemetria retornados pelo SDK `@google/genai`:
   - `input_tokens = response.usageMetadata.promptTokenCount`
   - `output_tokens = response.usageMetadata.candidatesTokenCount`
   - `execution_time_ms = Date.now() - startTime`
2. O método calcula o custo estimado em dólares através de `estimateTokenCost(modelUsed, inputTokens, outputTokens)`.
3. O registro é persistido de forma assíncrona na tabela `agent_runs` do PostgreSQL.
4. O `finops-calculator.ts` executa a função `reconcileAgentRunsFinOps`, somando os tokens e agrupando por `agent_id`.
5. **Classificação:**
   - **REAL:** Contagem de tokens e tempo de execução reais.
   - **ESTIMADO:** Custo em dólares (calculado via tabela de preços no código) e conversão para reais (câmbio fixado em R$ 5,80/USD).

---

## 4. Auditoria de Unit Economics: Por que CAC Aparece como "Incomplete"?

O campo CAC retornou:
`"cac": { "value": null, "status": "incomplete" }`.

### Motivo Técnico:
1. Em `finops-calculator.ts:219`:
   ```typescript
   if (spend === undefined || spend === null || newClients === undefined || newClients === null || newClients <= 0) {
     return { cac_brl: null, status: 'incomplete', ... };
   }
   ```
2. O AG-011 foi arquitetado sob o princípio da **Veracidade Soberana**: se a empresa não possui registro das despesas de marketing e vendas (`marketingAndSalesSpendBrl`) nem o número exato de clientes conquistados no período, o sistema **NÃO pode inventar um CAC médio de mercado**.
3. **O que falta para calcular o CAC:**
   - Uma tabela de lançamentos de despesas de aquisição (ex: `acquisition_expenses` ou `cost_ledger`) registrando gastos com anúncios (Google/Meta Ads), prospecção outbound (LinkedIn, Apollo) e comissões comerciais.
   - Marcação temporal da conversão de novos clientes por safra (cohorts).

---

## 5. Matriz de Auditoria de Indicadores e Custos

| Dimensão / Indicador | Status Atual | Fonte Primária | Lacuna Identificada / Ação Necessária |
|---|:---:|---|---|
| **MRR (Receita Recorrente)** | **CONFIGURADO** | `table:clients (mrr_brl)` | Valor contratual de seed; falta conciliação bancária/NF. |
| **ARR (Receita Anual)** | **ESTIMADO** | Fórmula `MRR * 12` | Derivado matematicamente do MRR. |
| **ARPA (Receita Média por Conta)** | **ESTIMADO** | `MRR / active_clients` | Preciso para a carteira atual (1 cliente). |
| **Tokens por Execução** | **REAL** | `agent_runs (usageMetadata)` | Capturado pelo SDK Google Gemini em cada chamada. |
| **Custo por Modelo de IA** | **ESTIMADO** | `PRICING_PER_MILLION` em `gemini.ts` | **Hardcoded no código**. Não há versionamento de preços no banco. |
| **Custo por Agente (FinOps)** | **REAL / ESTIMADO** | `agent_runs (agent_id)` | Agrupamento perfeito por agente em `cost_by_agent_usd`. |
| **Custo de Infraestrutura** | **AUSENTE** | Nenhuma | Custos da VPS Hostinger, Docker e disco não são capturados. |
| **Custo de APIs Externas** | **AUSENTE** | Nenhuma | Tráfego IMAP/SMTP, OCR externo e DNS não possuem telemetria de custo. |
| **CAC (Custo de Aquisição)** | **INCOMPLETO** | Nenhuma | Faltam registros de despesas comerciais e de marketing. |
| **LTV (Lifetime Value)** | **ESTIMADO** | Fórmula com piso de churn 2% | Amostra reduzida (1 cliente); classificado como estimado. |
| **Payback do CAC** | **INCOMPLETO** | Nenhuma | Depende do CAC; retorna nulo até que o CAC seja calculado. |
| **Margem de Contribuição por Cliente** | **INCOMPLETO** | `agent_runs.client_id` (sempre `NULL`) | **Grave:** `gemini.ts` não vincula `client_id` em `agent_runs`! |

---

## 6. O Gap Crítico da Margem por Cliente (`client_id = NULL`)

A auditoria forense identificou um **elo quebrado** entre o `AutonomousWorker` e a telemetria do `GeminiService`:

1. A migration `0004` adicionou a coluna `client_id` na tabela `agent_runs`.
2. A função `calculateClientGrossMargin` busca os custos de IA com a condição:
   ```typescript
   const runsForClient = input.agentRuns.filter((r) => r.client_id && r.client_id === c.clientId);
   ```
3. No entanto, no método `generateStructuredContent` (`gemini.ts:10-18`), a interface de parâmetros é:
   ```typescript
   export interface GeminiCallParams {
     taskId: string;
     agentId: string;
     // Faltam: clientId e consumerUnitId!
   }
   ```
4. Na gravação do payload em `agent_runs`:
   ```typescript
   const runPayload: Record<string, any> = {
     agent_id: params.agentId,
     // client_id NUNCA é passado nem inserido!
   };
   ```
5. **Impacto Econômico:** Em todas as 33 execuções de produção, `client_id` está `NULL`. Com isso, a margem bruta de cada cliente computa `ai_cost_usd = 0`! O custo de IA só é subtraído na margem global da empresa (`globalGrossMarginBrl`).

---

## 7. Diretrizes para o CFO Digital na Sprint 6

Para que o AG-011 atue com soberania e veracidade econômica absoluta, a plataforma necessita de:
1. **Passagem Obrigatória de Contexto:** `taskId -> task.client_id -> runPayload.client_id` em 100% dos disparos de agentes.
2. **Cost Ledger Unificado:** Registrar tanto custos diretos de IA quanto custos indiretos de infraestrutura e ferramentas.
3. **Tabela de Preços Versionada:** Migrar o array estático `PRICING_PER_MILLION` para uma tabela no PostgreSQL gerenciável pelo fundador.
4. **Módulo de Despesas Comerciais:** Permitir o lançamento de despesas de marketing/vendas para habilitar o cálculo real de CAC e Payback.

