# EI-AIOS — RESULTADOS DOS TESTES SPRINT 6
## Validação Automatizada da Atividade S6-01 (Cenários CTX-01 a CTX-08)

**Data da Execução:** 08/11/2026 15:35:24  
**Branch:** `feat/sprint-6-finops-ledger`  
**Ambiente de Execução:** Local изолиado (Node.js test runner)  
**Total de Testes da Suíte Global:** 63  
**Sucesso:** 63/63 (100% de aprovação)  
**Falhas:** 0  
**Duração Total:** 15.5s  

---

## 1. RESUMO DOS CENÁRIOS CTX-01 A CTX-08

| ID | Descrição do Cenário | Duração | Status |
| :--- | :--- | :---: | :---: |
| **CTX-01** | Execução vinculada a cliente preserva `client_id` e define `is_internal=false` | 2.96 ms | **PASS** |
| **CTX-02** | Execução vinculada a cliente E unidade consumidora propaga ambas as dimensões no registro | 0.55 ms | **PASS** |
| **CTX-03** | Execução de plataforma sem cliente é identificada explicitamente como `is_internal=true` e `client_id=null` | 0.83 ms | **PASS** |
| **CTX-04** | Subtarefas geradas na decomposição herdam estritamente `client_id` e `consumer_unit_id` da tarefa-mãe | 0.55 ms | **PASS** |
| **CTX-05** | Worker autônomo detecta e rejeita inconsistência entre o cliente da tarefa e o proprietário da UC | 0.69 ms | **PASS** |
| **CTX-06** | Recuperação de timeout pelo watchdog preserva `client_id` e `consumer_unit_id` intactos | 0.64 ms | **PASS** |
| **CTX-07** | Registros legados sem `client_id` são tratados sem quebra e sem atribuição arbitrária | 0.48 ms | **PASS** |
| **CTX-08** | AG-011 calcula custos de IA isolados por cliente sem vazamento cruzado de despesas | 1.06 ms | **PASS** |

---

## 2. DETALHAMENTO DAS EVIDÊNCIAS DE TESTE

### CTX-01: Execução Vinculada a Cliente
- **Objetivo:** Garantir que quando uma tarefa pertence a um cliente, o contexto `ExecutionContext` propaga `clientId` e grava `client_id` e `is_internal: false` no banco de execuções.
- **Evidência:** Asserções `assert.equal(executionContext.clientId, clientId)`, `assert.equal(executionContext.isInternal, false)`.

### CTX-02: Granularidade por Unidade Consumidora (UC)
- **Objetivo:** Comprovar a capacidade de faturar e auditar custos de IA até o nível da unidade consumidora específica, essencial para clientes com múltiplas plantas fabris ou filiais.
- **Evidência:** `assert.equal(runRecord.consumer_unit_id, ucId)`.

### CTX-03: Execuções de Plataforma / Internas
- **Objetivo:** Impedir que chamadas de sistema (ex: triagem HostGator do AG-012, rotinas de saúde, chat) sejam erroneamente cobradas de clientes.
- **Evidência:** `assert.equal(executionContext.clientId, null)`, `assert.equal(executionContext.isInternal, true)`.

### CTX-04: Herança Estrita em Subtarefas
- **Objetivo:** Impedir que o LLM crie subtarefas com cliente vazio ou adulterado durante a decomposição orquestrada.
- **Evidência:** Laço iterativo sobre todas as subtarefas confirmando que todas mantêm `sub.client_id === parentClientId` e `sub.input_payload.consumer_unit_id === parentUcId`.

### CTX-05: Defesa contra Inconsistência e Violação de Tenant
- **Objetivo:** Simular um ataque ou erro em que uma tarefa possui o ID do Cliente A, mas aponta para uma UC do Cliente B.
- **Evidência:** Validador do worker rejeita a execução com erro estruturado `Violação de isolamento de contexto`, abortando a chamada para evitar contaminação financeira.

### CTX-06: Resiliência do Watchdog
- **Objetivo:** Comprovar que a recuperação de tarefas presas pelo watchdog (S5-02 / S5-03) invalida o lease antigo sem perder os identificadores de cliente e UC.
- **Evidência:** `assert.equal(recovered.client_id, originalClientId)`, `assert.equal(recovered.input_payload.consumer_unit_id, originalUcId)`.

### CTX-07: Compatibilidade com Histórico Sem Contexto
- **Objetivo:** Assegurar que os 33 runs históricos de produção que possuem `client_id: null` continuem sendo lidos pelo FinOps sem quebra e sem serem atribuídos ficticiamente a qualquer cliente.
- **Evidência:** `reconcileAgentRunsFinOps` classifica os 33 runs em `internal_platform_runs_count` (ou não atribuídos), mantendo a margem do cliente estritamente baseada em evidências.

### CTX-08: Segregação e Margem Bruta no AG-011
- **Objetivo:** Verificar se o cálculo de margem bruta por cliente isola estritamente os custos de IA de cada tenant.
- **Evidência:** Simulação com Cliente A e Cliente B. Cliente A tem US$ 0.07 de IA (R$ 0,41), gerando margem exata de R$ 1.309,59 sem qualquer contaminação dos custos do Cliente B (US$ 0.85).

---

## 3. REGRESSÃO DAS SPRINTS ANTERIORES

Todos os testes das sprints anteriores foram reexecutados e aprovados:
- **Sprint 1 (Segurança & Autenticação):** SP1-T01 a SP1-T08 (8/8 PASS)
- **Sprint 3 (AG-012 E-mail Intelligence):** EMAIL-001 a EMAIL-016 (13/13 PASS)
- **Sprint 4 (Auditoria Regulatória & E2E):** INT-001 a INT-006 (6/6 PASS)
- **Sprint 5 (Concorrência Real & Reliability):** HARD-01 a HARD-07 e EXEC-MULTI-PROC (8/8 PASS)
- **CFO Suite (AG-011 FinOps & M&V):** CFO-001 a CFO-010 e M&V (13/13 PASS)
- **Sprint 6 (S6-01 Context Propagation):** CTX-01 a CTX-08 (8/8 PASS)

**Total Global:** 63/63 PASS. Zero regressões.
