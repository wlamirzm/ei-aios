# EI-AIOS — SPRINT 6 IMPLEMENTATION BACKLOG
## FinOps Intelligence, Cost & Usage Ledger & Sovereign Observability

**Sprint:** Sprint 6  
**Foco Estratégico:** Governança Econômica, Rastreabilidade de Custos por Operação/Cliente e CFO Digital Soberano  
**Estimativa Total:** 24 Horas de Engenharia  
**Pré-requisito:** Release `v1.5-sprint5-complete` em Produção  
**Meta Central:** Capacitar a plataforma a responder com dados auditáveis: *"Quanto custa exatamente processar cada fatura, quanto gasta cada agente e qual é a rentabilidade real líquida de cada cliente da Energy Intelligence?"*

---

## 1. Tabela Resumo do Backlog da Sprint 6

| ID | Atividade | Prioridade | Horas | Módulos Envolvidos |
|---|---|:---:|:---:|---|
| **S6-01** | Propagação Mandatória de `client_id` e `consumer_unit_id` na Execução e Telemetria | **P0** | **3 h** | `executors.ts`, `gemini.ts`, `worker.ts` |
| **S6-02** | Criação do Cost & Usage Ledger (CUL) e Migration 0008 | **P0** | **4 h** | `supabase/migrations/0008_*.sql`, `db-schema` |
| **S6-03** | Tabela de Preços Versionada (`model_pricing_matrix`) e Dynamic Pricing Engine | **P1** | **3 h** | `gemini.ts`, `finops-calculator.ts` |
| **S6-04** | Rateio de Custos de Infraestrutura e Ferramentas Compartilhadas no AG-011 | **P1** | **3 h** | `finops-calculator.ts`, `routes.ts` |
| **S6-05** | Detecção em Tempo Real de Operações Deficitárias e Enforcement de Orçamentos | **P1** | **4 h** | `gemini.ts`, `registry.ts`, `finops-calculator.ts` |
| **S6-06** | Módulo de Despesas Comerciais e Cálculo Real de CAC e Payback | **P2** | **3 h** | `finops-calculator.ts`, `routes.ts` |
| **S6-07** | Testes Automatizados Unitários, Concorrência e Regressão FinOps | **P0** | **4 h** | `tests/finops-e2e.test.ts`, CI/CD |
| **TOTAL**| **Sprint 6 — FinOps Intelligence & Observability** | | **24 h** | |

---

## 2. Detalhamento Técnico das Atividades (`S6-01` a `S6-07`)

### `S6-01` — Propagação Mandatória de Contexto (`client_id` e `consumer_unit_id`)
- **História de Usuário:** Como fundador e gestor da startup, quero que toda invocação a modelos de IA carregue obrigatoriamente o `client_id` e a `consumer_unit_id` da tarefa associada, para que o custo de inferência seja atribuído à conta correspondente e não fique órfão no banco.
- **Requisitos Técnicos:**
  1. Estender a interface `GeminiCallParams` em `packages/agent-core/src/config/gemini.ts` para receber `clientId?: string | null` e `consumerUnitId?: string | null`.
  2. Em `packages/agent-core/src/agents/executors.ts`, extrair `task.client_id` e `task.input_payload.consumer_unit_id` e repassar explicitamente para todas as chamadas de agentes.
  3. No método `generateStructuredContent`, incluir `client_id: params.clientId || null` no `runPayload` inserido na tabela `agent_runs`.
  4. Garantir que o chat direto no cockpit (`chatWithAgent`) continue permitindo `client_id = null` sem falhas.
- **Critérios de Aceite:**
  - 100% das tarefas vinculadas a clientes gravam `client_id` não-nulo na tabela `agent_runs`.
  - Zero chamadas de tarefas operacionais geram execuções desvinculadas.
- **Estimativa:** **3 h**

---

### `S6-02` — Criação do Cost & Usage Ledger (CUL) e Migration 0008
- **História de Usuário:** Como CFO Digital (AG-011), quero um livro-razão imutável de custos e consumo (`cost_usage_ledger`), para consolidar despesas heterogêneas (IA, servidores, storage e APIs) em um único ponto auditável.
- **Requisitos Técnicos:**
  1. Criar a migration `0008_sprint6_cost_usage_ledger.sql`:
     - Tabela `cost_usage_ledger` com colunas para categoria, métricas de consumo, preço unitário, total USD/BRL e chaves estrangeiras para `client_id`, `consumer_unit_id`, `task_id` e `agent_id`.
     - Índices de alto desempenho para agregações por cliente, agente e período.
  2. Implementar a classe `CostLedgerService` em `packages/agent-core/src/services/cost-ledger.ts`:
     - Método `recordAiUsage(runRecord)` para persistir lançamentos de inferência.
     - Método `recordToolUsage(toolRecord)` para ferramentas determinísticas.
- **Critérios de Aceite:**
  - Lançamentos gravados atomicamente no banco sem impactar a latência do worker.
  - O Ledger é estritamente *append-only* (sem operações de UPDATE destrutivo).
- **Estimativa:** **4 h**

---

### `S6-03` — Tabela de Preços Versionada (`model_pricing_matrix`)
- **História de Usuário:** Como fundador, quero atualizar os preços dos modelos Gemini e configurar novos modelos pelo banco de dados sem precisar recompilar código ou alterar arquivos TypeScript.
- **Requisitos Técnicos:**
  1. Criar na migration 0008 a tabela `model_pricing_matrix` com colunas `provider`, `model_name`, `effective_from`, `effective_to`, `input_price_per_million_usd`, `output_price_per_million_usd`.
  2. Inserir os preços vigentes dos modelos Gemini 3.5 Flash Lite, Gemini 3.8 Flash e Gemini 2.5 Pro.
  3. Atualizar a função `estimateTokenCost` em `gemini.ts` para consultar em cache de memória (TTL de 1 hora com fallback gracioso) a tabela de preços do banco, aplicando a tarifa correta pela data de execução.
- **Critérios de Aceite:**
  - O cálculo de custo de tokens consulta os valores vigentes no banco.
  - Se o banco estiver temporariamente indisponível, o fallback seguro em memória mantém a operação ativa.
- **Estimativa:** **3 h**

---

### `S6-04` — Rateio de Custos de Infraestrutura Compartilhada no AG-011
- **História de Usuário:** Como CFO Digital, quero que os custos fixos da VPS Hostinger, containers Docker e armazenamento de faturas sejam rateados entre as contas ativas, para que a margem de contribuição reflita o custo operacional real.
- **Requisitos Técnicos:**
  1. Criar tabela `infra_fixed_costs` (mês de competência, valor BRL, categoria, descrição).
  2. No módulo `finops-calculator.ts`, adicionar a função `calculateInfrastructureAllocation(activeClients, totalBillsProcessed, fixedCostsBrl)`:
     - 50% do custo rateado por cliente ativo (R$ 60 / N).
     - 50% rateado pelo volume de faturas e tarefas processadas.
  3. Atualizar a margem bruta de cada cliente para subtrair a parcela de infraestrutura alocada.
- **Critérios de Aceite:**
  - A soma do rateio de infraestrutura entre os clientes bate exatamente com o valor lançado em `infra_fixed_costs`.
  - Contratos sem atividade no mês recebem apenas a parcela fixa básica.
- **Estimativa:** **3 h**

---

### `S6-05` — Detecção em Tempo Real de Operações Deficitárias & Budget Enforcement
- **História de Usuário:** Como fundador, quero ser alertado imediatamente caso o custo de processamento de um cliente ameace sua rentabilidade, e quero que os agentes respeitem seus orçamentos diários (`daily_budget_usd`).
- **Requisitos Técnicos:**
  1. Em `finops-calculator.ts`, implementar detecção de margem de contribuição crítica:
     - Alerta se Margem Bruta < 70% da meta.
     - Alerta P1 se Margem Bruta < 0 (operação deficitária).
  2. Em `gemini.ts`, implementar verificação do `daily_budget_usd` do agente chamador consultando o CUL:
     - Se o gasto diário acumulado ultrapassar o orçamento, rebaixar modelo para `gemini-3.5-flash-lite` ou emitir evento de alerta no log.
- **Critérios de Aceite:**
  - Nenhum agente excede seu orçamento diário de US$ sem alerta ou rebaixamento para modelo econômico.
  - O cockpit sinaliza clientes com rentabilidade negativa em vermelho.
- **Estimativa:** **4 h**

---

### `S6-06` — Módulo de Despesas Comerciais e Cálculo Real de CAC e Payback
- **História de Usuário:** Como fundador, quero cadastrar os gastos mensais de aquisição de clientes (Google Ads, outbound, eventos) para que o AG-011 calcule o CAC e o Payback com status `verified`, sem retornar `incomplete`.
- **Requisitos Técnicos:**
  1. Criar tabela `acquisition_expenses` (data, canal, valor_brl, descrição, novos_clientes_atribuidos).
  2. Criar endpoint soberano protegido `POST /api/v1/finops/expenses/acquisition` e `GET /api/v1/finops/expenses/acquisition`.
  3. Conectar a função `calculateCac` do `finops-calculator.ts` para ler os dados dessa tabela.
- **Critérios de Aceite:**
  - Com despesas cadastradas, o CAC transiciona de `incomplete` para `verified`.
  - O Payback do CAC é calculado em meses com base na margem de contribuição média real.
- **Estimativa:** **3 h**

---

### `S6-07` — Suíte Completa de Testes de FinOps & Regressão
- **História de Usuário:** Como engenheiro de release, quero uma suíte automatizada cobrindo 100% dos cálculos de CUL, pricing matrix, rateio e margens, para garantir zero regressão na Release v1.6.
- **Requisitos Técnicos:**
  1. Implementar `packages/agent-core/tests/finops-ledger.test.ts` testando:
     - Inserção e agregação no Ledger.
     - Cálculo de margem por cliente com e sem rateio de infraestrutura.
     - Aplicação da tabela de preços versionada.
     - Enforcement de orçamentos e fallback de modelos.
  2. Integrar ao script `pnpm test` de modo que a suíte passe de 55 para ~65 testes com 100% de aprovação.
- **Critérios de Aceite:**
  - Suíte completa executando em < 20 segundos em ambiente local e no CI do GitHub Actions.
- **Estimativa:** **4 h**

