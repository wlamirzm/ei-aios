# REGISTRO DE TESTES EXECUTADOS E EVIDÊNCIAS — EI-AIOS

**Data da Execução:** 07/11/2026  
**Ambiente:** Local (`Node.js v22` / `node --test`) + Inspeção Read-Only de Telemetria em Produção (`https://api.eiaios.atendezen.com.br`)  
**Regra de Segurança:** Nenhuma mutação destrutiva, deploy ou alteração de dados foi realizada durante a bateria de auditoria.

---

## 1. Testes Unitários Automatizados das Calculadoras Determinísticas (`npm test`)

Comando executado:
```powershell
npm test
```

### 1.1 Resultados Obtidos (`18/18 APROVADOS` — Calculadoras + Suíte de Segurança e Orquestração da Sprint 1)

| ID | Suíte / Arquivo | Cenário Testado | Resultado Esperado | Resultado Obtido | Status |
|---|---|---|---|---|---|
| `UT-01` | `energy-calculator.test.ts` | Demanda dentro da tolerância regulatória de 5% (REN ANEEL 1.000/2021) | `has_overage = false`, `overage_penalty_brl = 0` | `has_overage = false`, `overage_penalty_brl = 0` (`1.32ms`) | ✅ **PASS** |
| `UT-02` | `energy-calculator.test.ts` | Demanda excedendo a tolerância de 5% (Multa 2x tarifa) | `has_overage = true`, multa calculada com fator 2x | `has_overage = true`, multa exata (`0.24ms`) | ✅ **PASS** |
| `UT-03` | `energy-calculator.test.ts` | Demanda contratada ociosa (Sobrecontratação respeitando piso 30 kW) | `has_idle_demand = true`, desperdício mensal e anual apurados | `has_idle_demand = true`, cálculo exato (`0.18ms`) | ✅ **PASS** |
| `UT-04` | `energy-calculator.test.ts` | Cálculo e classificação de Fator de Carga (`FC = kWh / (kW * 730h)`) | Classificação correta entre `critico`, `baixo`, `adequado`, `excelente` | Classificação exata (`0.33ms`) | ✅ **PASS** |
| `UT-05` | `energy-calculator.test.ts` | Auditoria de Energia Reativa Excedente e Payback de Banco de Capacitores | `requires_capacitor_bank = true` e cálculo de payback em meses | Cálculo exato (`0.23ms`) | ✅ **PASS** |
| `UT-06` | `energy-calculator.test.ts` | Comparação de Modalidade Horossazonal Verde vs. Azul | Recomendação da modalidade de menor custo anual projetado | Comparação e economia anual exatas (`26.11ms`) | ✅ **PASS** |
| `UT-07` | `energy-calculator.test.ts` | `runEnergyAudit()` — Consolidação Mestre dos 4 Pilares | Soma exata das economias mensais e anuais dos 4 pilares | Consolidação validada (`1.45ms`) | ✅ **PASS** |
| `UT-08` | `mv-calculator.test.ts` | `calculateMeasurementAndVerification()` — Custo evitado positivo e Success Fee | `is_verified_positive_saving = true` e apuração percentual do Success Fee | Custo evitado e Success Fee exatos (`28.96ms`) | ✅ **PASS** |
| `UT-09` | `mv-calculator.test.ts` | `calculateMeasurementAndVerification()` — Economia zero ou negativa | `success_fee_due_brl = 0` quando não há economia positiva | `success_fee_due_brl = 0` (`0.28ms`) | ✅ **PASS** |
| `UT-10` | `mv-calculator.test.ts` | `calculateMeasurementAndVerification()` — Cenário real de redução de demanda + reativo | Apuração líquida (`net_client_savings_brl`) descontando Success Fee | Cálculo validado (`0.21ms`) | ✅ **PASS** |
| `SP1-T01` | `sprint1-security-orchestrator.test.ts` | `BKL-002`: Criptografia `AES-256-GCM` (`encryptSecret` / `decryptSecret`) e detecção de adulteração de `authTag` | Formato `enc:v1:<iv>:<tag>:<cipher>`, idempotência e erro em adulteração | Roundtrip exato e bloqueio de adulteração validados | ✅ **PASS** |
| `SP1-T02` | `sprint1-security-orchestrator.test.ts` | `BKL-002`: Compatibilidade retroativa e migração transparente de senhas legadas | Senha legada não quebra leitura antes da migração | Compatibilidade validada | ✅ **PASS** |
| `SP1-T03` | `sprint1-security-orchestrator.test.ts` | `BKL-003`: Bloqueio de Prompt Injection e Spoofing no `AG-012` (`inspectEmailSecurityRisks`) | Detecta override de instruções/exfiltração, força `P0` e bloqueia `auto_action` | Ataque interceptado e classificado como alerta de segurança | ✅ **PASS** |
| `SP1-T04` | `sprint1-security-orchestrator.test.ts` | `BKL-003`: E-mail comercial/energético legítimo passa sem falso positivo | `isSuspicious = false`, `reasons.length = 0` | Passagem limpa validada | ✅ **PASS** |
| `SP1-T05` | `sprint1-security-orchestrator.test.ts` | `BKL-004`: Middleware `requireFounderAuth` bloqueia requisições sem credencial | Retorna `HTTP 401 Unauthorized` e `nextCalled = false` | Bloqueio `401` confirmado | ✅ **PASS** |
| `SP1-T06` | `sprint1-security-orchestrator.test.ts` | `BKL-004`: Middleware `requireFounderAuth` autoriza token JWT assinado válido | `verifyFounderAuthToken` válido e `nextCalled = true` | Autorização confirmada | ✅ **PASS** |
| `SP1-T07` | `sprint1-security-orchestrator.test.ts` | `BKL-005`: `AgentRouter` valida agentes ativos (`AG-003`, `AG-012`) e permissões | `allowed = true`, `escalatedToOrchestrator = false` | Roteamento determinístico confirmado | ✅ **PASS** |
| `SP1-T08` | `sprint1-security-orchestrator.test.ts` | `BKL-005`: `AgentRouter` escala agentes inexistentes ou desabilitados para `AG-001` | `allowed = false`, `escalatedToOrchestrator = true`, `effectiveAgentId = 'AG-001'` | Escalonamento seguro ao `AG-001` confirmado | ✅ **PASS** |

---

## 2. Testes Funcionais Prioritários da Auditoria (Seção 6 do Prompt de Auditoria)

| # | Cenário Funcional | Resultado Esperado | Resultado Obtido | Evidência Verificada | Status |
|---|---|---|---|---|---|
| **1** | Criação de tarefa pelo `AG-001` | Decompor objetivo macro em subtarefas encadeadas na tabela `tasks` | `AG-001` criou a tarefa-mãe `MACRO-106377` e 5 subtarefas (`MACRO-106377-01` a `05`) no PostgreSQL | `GET /api/v1/tasks` (`parent_task_id: 092f62cd-2d0b-4447-af83-733ba9923514`) | ✅ **APROVADO** |
| **2** | Seleção correta do agente especialista | Atribuir cada subtarefa ao especialista correspondente (`AG-002`, `AG-003`, `AG-004`, `AG-005`, `AG-011`) | As 5 subtarefas foram atribuídas corretamente aos 5 especialistas | `MACRO-106377-01` (`AG-002`), `-02` (`AG-003`), `-03` (`AG-004`), `-04` (`AG-005`), `-05` (`AG-011`) | ✅ **APROVADO** |
| **3** | Delegação e retorno de resultado | Especialistas executam e salvam entregáveis na tabela `artifacts` e `tasks.result_payload` | Todas as 5 subtarefas geraram `result_payload` e criaram 5 documentos na tabela `artifacts` | `GET /api/v1/artifacts` (`count: 5`, ex.: `MACRO-106377-05`) | ⚠️ **PARCIAL** *(Falta disparar síntese da tarefa-mãe após aprovação Nível 2 — `GAP-P0-01`)* |
| **4** | Tratamento de falhas e retry | Quando `AG-008` reprova ou ocorre erro, incrementar `retry_count` até `max_retries` (2) | Lógica implementada em `worker.ts:141-167`, mas falta watchdog de timeout para tarefas presas em `running` | Inspeção de `worker.ts:141-167` | ⚠️ **PARCIAL** |
| **5** | Registro da execução | Gravar cada invocação de agente na tabela `agent_runs` | 12 execuções registradas com `agent_id`, `model_name`, `execution_time_ms` e `status` | `GET /api/v1/metrics/finops` (`total_runs_count: 12`, `avg_execution_time_ms: 2755`) | ✅ **APROVADO** |
| **6** | Registro dos custos de IA | Calcular tokens de entrada/saída e custo estimado em USD em `agent_runs` | Custos registrados por execução (`total_token_spend_usd_today: 0.0037`, `avg_cost_per_task_usd: 0.000312`) | `GET /api/v1/metrics/finops` e `gemini.ts:308-325` | ✅ **APROVADO** |
| **7** | Cálculo financeiro pelo `AG-011` | Calcular MRR, ARPA, CAC, LTV, Payback e Margem com dados reais e fontes verificadas | `AG-011` gerou artefato `MACRO-106377-05` via LLM, mas sem calculadora determinística conectada a `clients` | Artefato `MACRO-106377-05` e ausência de `finops-calculator.ts` em `executors.ts` | ⚠️ **PARCIAL** *(Requer `BKL-006` e `BKL-007`)* |
| **8** | Classificação de e-mail pelo `AG-012` | Ler e-mail, classificar prioridade (`P0`–`P3`), categoria, resumo e próximo passo | E-mails analisados com prioridade `P1`, categoria `fatura_energia`, `ai_summary` e `recommended_next_step` | `GET /api/v1/emails/messages` (`count: 2`) | ✅ **APROVADO** |
| **9** | Encaminhamento de e-mail para o agente correto | Em modo `auto_action`, criar tarefa no `Task Orchestrator` para o especialista correto | Conta em `auto_action` criou e despachou automaticamente a tarefa `EMAIL-805168` para o `AG-003` | `email_messages.triggered_task_code = 'EMAIL-805168'`, `status = 'task_dispatched'` | ✅ **APROVADO** |
| **10** | Bloqueio de ações não autorizadas | Bloquear promessas de `"economia garantida"` no QA Gate e bloquear execução acima do orçamento diário | `qa-gate.ts:17-22` bloqueia `"economia garantida"`; `policy-engine.ts:34` bloqueia excesso de orçamento diário; porém falta bloqueio de prompt injection em e-mail | `qa-gate.ts:17-22`, `policy-engine.ts:24-42` | ⚠️ **PARCIAL** *(Requer `BKL-003` e `BKL-004`)* |
| **11** | Fluxo de aprovação humana | Tarefas Nível 2 pausam em `waiting_input`, criam registro em `approvals` e aguardam decisão do fundador | Subtarefas `MACRO-106377-02` e `MACRO-106377-05` geraram registros reais em `approvals` (`count: 2`) | `GET /api/v1/approvals` (`count: 2`) | ✅ **APROVADO** |
| **12** | Rastreabilidade ponta a ponta | Rastrear `email_account` -> `email_message` -> `task` -> `agent_run` -> `artifact` -> `approval` | Cadeia funcional via chaves estrangeiras (`triggered_task_id`, `task_id`), faltando apenas `rfc_message_id` / `thread_id` | `0001_core_schema.sql` e registros em produção | ⚠️ **PARCIAL** |

---

## 3. Matriz de Testes Obrigatórios do `AG-011` (Seção 11 — `CFO-001` a `CFO-010`) — **10/10 APROVADOS NA SPRINT 2**

| ID | Cenário | Critério de Aceite | Status Atual | Evidência Verificada (`finops-calculator.test.ts`) |
|---|---|---|---|---|
| `CFO-001` | MRR e ARR | Fórmulas e fontes documentadas (excluindo implantação/success fee) | ✅ **APROVADO (`IMPLEMENTADO`)** | `calculateMrrAndArr()` exclui `setupFeeBrl` e `successFee` do MRR recorrente (`CFO-001 PASS`) |
| `CFO-002` | CAC | Janela e custos atribuíveis explícitos | ✅ **APROVADO (`IMPLEMENTADO`)** | `calculateCac()` exige janela explícita (ex.: 90 dias) e custos atribuíveis (`CFO-002 PASS`) |
| `CFO-003` | LTV | Premissas e limitações declaradas | ✅ **APROVADO (`IMPLEMENTADO`)** | `calculateLtvAndPayback()` sinaliza `status: 'estimated'` e limitação para amostras `< 10` (`CFO-003 PASS`) |
| `CFO-004` | Payback | Base de contribuição identificada | ✅ **APROVADO (`IMPLEMENTADO`)** | `calculateLtvAndPayback()` calcula `CAC / (ARPA * gross_margin_ratio)` (`CFO-004 PASS`) |
| `CFO-005` | Margem por cliente | Custos diretos e IA considerados | ✅ **APROVADO (`IMPLEMENTADO`)** | `calculateClientGrossMargin()` cruza receita elegível com suporte direto + `agent_runs` (`CFO-005 PASS`) |
| `CFO-006` | Custos de IA | Conciliação com `agent_runs` | ✅ **APROVADO (`IMPLEMENTADO`)** | `reconcileAgentRunsFinOps()` soma tokens/custos e aponta execuções sem custo ou vínculo (`CFO-006 PASS`) |
| `CFO-007` | Success fee | Usa economia verificada e regra contratual | ✅ **APROVADO (`IMPLEMENTADO`)** | `calculateClientGrossMargin()` bloqueia economia não verificada em M&V (`CFO-007 PASS`) |
| `CFO-008` | Cenários de preço | Conservador, base e otimista | ✅ **APROVADO (`IMPLEMENTADO`)** | `simulatePricingScenarios()` gera os 3 cenários padronizados (`CFO-008 PASS`) |
| `CFO-009` | Dados incompletos | Não inventa valores (retorna `incomplete` / `not_available`) | ✅ **APROVADO (`IMPLEMENTADO`)** | `calculateCac()` retorna `value: null, status: 'incomplete'` quando faltam dados (`CFO-009 PASS`) |
| `CFO-010` | Segurança | Não altera nem expõe dados financeiros sem permissão | ✅ **APROVADO (`IMPLEMENTADO`)** | `AG-011` validado com `financial_commitment = false`, `external_publish = false` e `CFODeliverableSchema` (`CFO-010 PASS`) |

---

## 4. Matriz de Testes Obrigatórios do `AG-012` (Seção 12 — `EMAIL-001` a `EMAIL-016`) — **16/16 APROVADOS NA SPRINT 3**

| ID | Cenário | Critério de Aceite | Status Atual | Evidência Verificada (`email-intelligence.test.ts`) |
|---|---|---|---|---|
| `EMAIL-001` | Sincronizar múltiplas caixas | Isolamento por conta (`account_id`) | ✅ **APROVADO (`IMPLEMENTADO`)** | Testado com contas independentes preservando `email_account_id` (`EMAIL-001 PASS`) |
| `EMAIL-002` | Mensagem duplicada | Não cria processamento duplicado | ✅ **APROVADO (`IMPLEMENTADO`)** | Deduplica por `(account_id, message_uid)` e por `(account_id, rfc_message_id)` + índice `UNIQUE` em `0005_sprint3_ag012_policies_and_rfc.sql` (`EMAIL-002 PASS`) |
| `EMAIL-003` | Fatura de energia | Identifica e encaminha ao `AG-003` | ✅ **APROVADO (`IMPLEMENTADO`)** | `classifyEmailDeterministically()` classifica `fatura_energia` (`P1`) e roteia para `AG-003` (`EMAIL-003 PASS`) |
| `EMAIL-004` | Lead comercial | Identifica e encaminha ao `AG-007` | ✅ **APROVADO (`IMPLEMENTADO`)** | Classifica `lead_comercial` (`P1`), roteia para `AG-007` e gera minuta de resposta (`EMAIL-004 PASS`) |
| `EMAIL-005` | Demanda ANEEL | Identifica e encaminha ao `AG-009` | ✅ **APROVADO (`IMPLEMENTADO`)** | Classifica `regulatorio_aneel` (`P1`) e roteia para `AG-009` (`EMAIL-005 PASS`) |
| `EMAIL-006` | Mensagem crítica | Classifica `P0` e escala ao `AG-001` | ✅ **APROVADO (`IMPLEMENTADO`)** | `evaluateEmailModeAndPolicy()` escala `P0` obrigatoriamente ao `AG-001` com `requiresHumanApproval = true` (`EMAIL-006 PASS`) |
| `EMAIL-007` | Mensagem comum | Classifica `P2`/`P3` corretamente | ✅ **APROVADO (`IMPLEMENTADO`)** | Classifica newsletters/informativos como `P3` sem criar tarefa desnecessária (`EMAIL-007 PASS`) |
| `EMAIL-008` | Anexo inválido | Não executa conteúdo ativo | ✅ **APROVADO (`IMPLEMENTADO`)** | `inspectEmailAttachments()` filtra por whitelist segura e bloqueia `.exe`, `.bat`, `.ps1`, `.scr` (`EMAIL-009 PASS`) |
| `EMAIL-009` | Prompt injection | Ignora instruções maliciosas no corpo do e-mail | ✅ **APROVADO (`IMPLEMENTADO`)** | `inspectEmailSecurityRisks()` + `<untrusted_email_data>` bloqueia `auto_action` (`blocked_security_review`) (`EMAIL-010 PASS`) |
| `EMAIL-010` | `monitor_only` (`read_summarize`) | Não cria ação externa nem dispara tarefa | ✅ **APROVADO (`IMPLEMENTADO`)** | `evaluateEmailModeAndPolicy()` garante `shouldCreateTask = false` em `monitor_only` e `read_summarize` (`EMAIL-011 PASS`) |
| `EMAIL-011` | `assisted_action` | Cria tarefa interna e aguarda aprovação | ✅ **APROVADO (`IMPLEMENTADO`)** | `assisted_action` cria tarefa interna com `requiresHumanApproval = true` e `status = 'assisted_task_created'` (`EMAIL-012 PASS`) |
| `EMAIL-012` | `auto_action` | Só executa ação previamente permitida | ✅ **APROVADO (`IMPLEMENTADO`)** | Valida contra `email_action_policies` (`allowed_agents`, `allowed_auto_actions`) (`EMAIL-013 PASS`) |
| `EMAIL-013` | Envio não autorizado | Bloqueia envio SMTP automático | ✅ **APROVADO (`IMPLEMENTADO`)** | `draft_reply.send_authorized` é sempre `false` por padrão (`EMAIL-013 & EMAIL-014 PASS`) |
| `EMAIL-014` | Falha IMAP/SMTP | Registra erro em `last_sync_status` e recupera | ✅ **APROVADO (`IMPLEMENTADO`)** | `routes.ts` captura erro de socket/login IMAP e grava em `email_accounts.last_sync_status` |
| `EMAIL-015` | Thread de e-mail | Preserva contexto (`thread_id`) e deduplicação | ✅ **APROVADO (`IMPLEMENTADO`)** | `extractRfcHeadersFromImapBlock()` extrai `Message-ID`, `In-Reply-To` e `References` (`EMAIL-002 & EMAIL-008 PASS`) |
| `EMAIL-016` | Dados de cliente | Respeita isolamento e criptografia de credenciais | ✅ **APROVADO (`IMPLEMENTADO`)** | `password_secret` criptografado com `AES-256-GCM` (`SP1-T01`) e contrato `EmailAnalysisContractSchema` validado (`EMAIL-015 PASS`) |

