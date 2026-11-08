# BACKLOG TÉCNICO DE IMPLEMENTAÇÃO E CORREÇÃO — EI-AIOS (RECONCILIADO)

**Data:** 07/11/2026  
**Versão:** 1.1 (Reconciliada — 17 Atividades `BKL-001` a `BKL-017` / 60h Totais)  
**Referência:** `docs/EI_AIOS_Validacao_DEV_IA_AG011_AG012_v1.md` & `docs/EI_AIOS_GAP_ANALYSIS.md`  
**Abordagem:** Evolução incremental sobre a arquitetura TypeScript/Node.js + PostgreSQL/Supabase já funcional em produção, sem retrabalho ou duplicação de tabelas existentes.

---

## 1. Visão Geral das Sprints e Estimativa Reconciliada de Esforço

A tabela abaixo reconcilia 100% dos **19 Gaps (`GAP-P0-01` a `GAP-P3-03`)** em **17 atividades numeradas sequencialmente (`BKL-001` a `BKL-017`)**, totalizando **60 horas** exatas:

| Sprint | Foco Estratégico | IDs das Atividades | Qtd. Itens | Soma Exata (Horas) | Status |
|---|---|---|---:|---:|---|
| **Sprint 1** | **Correções Bloqueadoras (P0), Segurança Backend/RLS, Agent Router & Orquestração AG-001** | `BKL-001` a `BKL-005` | 5 | **18 h** (`2+3+3+6+4`) | ✅ **CONCLUÍDA EM PRODUÇÃO (`v1.1`)** |
| **Sprint 2** | **Evolução Completa do AG-011 (CFO Digital, `finops-calculator.ts` e Contratos)** | `BKL-006` a `BKL-008` | 3 | **14 h** (`6+5+3`) | ✅ **CONCLUÍDA EM PRODUÇÃO (`v1.2`)** |
| **Sprint 3** | **Evolução Completa do AG-012 (3 Modos, Políticas, Anti-Injection, Deduplicação RFC, TLS)** | `BKL-009` a `BKL-013` | 5 | **18 h** (`3+4+5+4+2`) | ✅ **CONCLUÍDA (`v1.3`)** |
| **Sprint 4** | **Integração RAG Regulatório (`AG-009`), Validador `AG-004`, Cron IMAP/`decision_logs` e Testes E2E** | `BKL-014` a `BKL-017` | 4 | **10 h** (`2+2+2+4`) | ⏳ Próxima Sprint |
| **TOTAL** | | **`BKL-001` a `BKL-017`** | **17** | **60 h** | **50h / 60h Concluídas** |

---

## 2. Detalhamento Completo do Backlog Técnico (`BKL-001` a `BKL-017`)

### SPRINT 1 — Correções Bloqueadoras (P0), Segurança & Orquestração AG-001 (18h)

#### `BKL-001` — Correção da Síntese Executiva do `AG-001` Pós-Aprovação Nível 2 (`GAP-P0-01`)
- **Prioridade:** `P0`
- **Módulo / Agente:** `AG-001` (`packages/agent-core/src/api/routes.ts`, `packages/agent-core/src/engine/worker.ts`)
- **História de Usuário:** Como fundador, quando eu aprovar a última subtarefa pendente de Nível 2 em `/approvals`, quero que o `AG-001` sintetize automaticamente o relatório consolidado da tarefa-mãe (`MACRO-*`) e mude seu status para `completed`.
- **Descrição Técnica:**
  1. Expor método público `checkAndSynthesizeParent(parentTaskId: string)` em `AutonomousWorker` (`worker.ts:255`) e garantir geração de artefato executivo consolidado na síntese.
  2. Em `POST /api/v1/approvals/:id/decide` (`routes.ts:226-237`), após atualizar a tarefa aprovada para `completed`, verificar se `approval.task?.parent_task_id` existe e invocar `await autonomousWorker.checkAndSynthesizeParent(approval.task.parent_task_id)`.
  3. Adicionar varredura de reconciliação no `worker.ts` para localizar objetivos macro em `status = 'running'` cujas subtarefas filhas já estejam 100% `completed` (destravando sem perda de dados tarefas existentes como `MACRO-106377`).
- **Dependências:** Nenhuma.
- **Critérios de Aceite:**
  - Aprovar a última subtarefa Nível 2 de um objetivo macro muda o status da tarefa-mãe de `running` para `completed` e persiste o `result_payload` + artefato de síntese do `AG-001`.
- **Estimativa:** **2 h**
- **Riscos:** Baixo.

---

#### `BKL-002` — Criptografia AES-256-GCM para Credenciais de E-mail (`password_secret`) (`GAP-P0-03`)
- **Prioridade:** `P0`
- **Módulo / Agente:** `AG-012` / Segurança (`packages/agent-core/src/config/crypto-vault.ts`, `packages/agent-core/src/tools/email-intelligence.ts`, `packages/agent-core/src/api/routes.ts`)
- **História de Usuário:** Como fundador, quero que as senhas das minhas contas de e-mail cPanel HostGator sejam criptografadas com AES-256-GCM antes de serem salvas no PostgreSQL e descriptografadas apenas em memória no momento da conexão IMAP/SMTP, migrando com segurança contas já existentes.
- **Descrição Técnica:**
  1. Criar `packages/agent-core/src/config/crypto-vault.ts` implementando `encryptSecret(plaintext)` e `decryptSecret(payload)` com `aes-256-gcm`, IV aleatório de 12 bytes, AuthTag de 16 bytes e prefixo versionado `enc:v1:<iv_hex>:<tag_hex>:<cipher_hex>`, usando chave de 32 bytes derivada via HKDF/SHA-256 de `EMAIL_SECRET_KEY` (ou fallback para `JWT_SECRET`).
  2. No cadastro (`POST /api/v1/emails/accounts`) e edição (`PATCH /api/v1/emails/accounts/:id`), criptografar `password_secret` antes do `INSERT`/`UPDATE`.
  3. Criar rotina de migração transparente e não-destrutiva (`migratePlaintextEmailPasswords()`) que converte senhas legadas sem prefixo `enc:v1:` para formato criptografado sem interromper a operação.
- **Dependências:** Nenhuma.
- **Critérios de Aceite:**
  - Nenhuma senha permanece em texto puro na coluna `email_accounts.password_secret`.
  - A API nunca retorna `password_secret` em respostas `GET`/`POST`/`PATCH`.
  - Contas existentes são migradas automaticamente sem perda de acesso.
- **Estimativa:** **3 h**
- **Riscos:** Perda da chave de ambiente invalida senhas salvas (mitigado por derivação determinística do segredo da stack e backup prévio).

---

#### `BKL-003` — Blindagem contra Prompt Injection e Phishing no `AG-012` (`GAP-P0-04`)
- **Prioridade:** `P0`
- **Módulo / Agente:** `AG-012` (`packages/agent-core/src/tools/email-intelligence.ts`)
- **História de Usuário:** Como auditor de segurança, quero garantir que instruções maliciosas contidas no remetente, assunto ou corpo de um e-mail externo nunca alterem o comportamento, regras de roteamento, prioridade ou permissões do `AG-012`.
- **Descrição Técnica:**
  1. Criar função determinística `inspectEmailSecurityRisks(email)` em `email-intelligence.ts` que detecta padrões de *Prompt Injection* (ex.: `ignore previous instructions`, `ignore todas as instruções`, `system prompt`, `você agora é`, tentativas de extrair `api_key`/`password`, ou comandos forçando `auto_action`/transferência bancária) e indicadores de *Phishing/Spoofing* (divergência entre domínio exibido no `fromName` e o domínio real do `fromAddress`).
  2. Isolar os dados do e-mail dentro de tags `<untrusted_email_data>...</untrusted_email_data>` com diretriz de sistema estrita proibindo obedecer comandos contidos no bloco.
  3. Se `inspectEmailSecurityRisks()` detectar ameaça (`hasPromptInjection || hasSpoofingRisk`), forçar bloqueio de despacho automático mesmo se a conta estiver em `auto_action` (`status = 'blocked_security_review'`) e registrar o alerta de segurança.
- **Dependências:** Nenhuma.
- **Critérios de Aceite:**
  - E-mails simulados com payload de Prompt Injection não disparam tarefas automáticas, têm a instrução maliciosa ignorada e são marcados com alerta de segurança.
- **Estimativa:** **3 h**
- **Riscos:** Baixo.

---

#### `BKL-004` — Autenticação/Autorização Backend nas Rotas Críticas, Hardening RLS e Persistência de Agentes (`GAP-P0-02` & `GAP-P1-07`)
- **Prioridade:** `P0`
- **Módulo / Agente:** Segurança API, Banco de Dados & Web UI (`packages/agent-core/src/api/auth-middleware.ts`, `routes.ts`, `supabase/migrations/0003_sprint1_security_rls.sql`, `packages/web-ui/src/lib/api-client.ts`, `packages/web-ui/src/app/agents/page.tsx`)
- **História de Usuário:** Como fundador, quero que todas as rotas críticas (`/api/v1/system/*`, `/api/v1/approvals/*`, `/api/v1/emails/*` e administração de `/api/v1/agents/*`) validem autenticação no backend, que o role `anon` do PostgreSQL não possa escrever/excluir em tabelas transacionais, e que a edição de agentes em `/agents` persista no banco.
- **Descrição Técnica:**
  1. Criar middleware `requireFounderAuth` em `packages/agent-core/src/api/auth-middleware.ts` que valida token Bearer JWT (assinado com `JWT_SECRET` ou `ADMIN_API_TOKEN`) ou sessão autenticada do fundador no backend, protegendo obrigatoriamente:
     - `/api/v1/system/*` (`POST /api/v1/system/llm-key`, `POST /api/v1/system/clean-db`)
     - `/api/v1/approvals/*` (`GET /api/v1/approvals`, `POST /api/v1/approvals/:id/decide`)
     - `/api/v1/emails/*` (todas as rotas de contas, sincronização e disparo de e-mails)
     - Administração de agentes (`PATCH /api/v1/agents/:id`)
  2. Adicionar endpoint de autenticação `POST /api/v1/auth/login` (validando credenciais do fundador configuradas via variáveis de ambiente `FOUNDER_EMAIL` / `FOUNDER_PASSWORD` ou token mestre) que emite um JWT assinado pelo backend, integrado ao `api-client.ts` e `/login`.
  3. Implementar `PATCH /api/v1/agents/:id` em `routes.ts` e conectar o botão "Salvar" de `packages/web-ui/src/app/agents/page.tsx` para persistir `system_prompt`, `model`, `temperature`, `daily_budget_usd` e `enabled` no PostgreSQL.
  4. Criar migration `supabase/migrations/0003_sprint1_security_rls.sql` revogando permissões de escrita/deleção (`INSERT`, `UPDATE`, `DELETE`, `TRUNCATE`) do role `anon` sobre todas as tabelas transacionais (`clients`, `consumer_units`, `energy_bills`, `tasks`, `agent_runs`, `approvals`, `artifacts`, `email_accounts`, `email_messages`) e restringindo as policies RLS de escrita exclusivamente para `service_role` e `authenticated`.
- **Dependências:** Nenhuma.
- **Critérios de Aceite:**
  - Requisições sem token válido para `/api/v1/system/*`, `/api/v1/approvals/*`, `/api/v1/emails/*` e `PATCH /api/v1/agents/:id` retornam `HTTP 401 Unauthorized`.
  - O role `anon` é bloqueado pelo PostgreSQL em qualquer tentativa de `INSERT`, `UPDATE` ou `DELETE` nas tabelas transacionais.
  - O botão "Salvar" em `/agents` grava efetivamente as alterações no banco de dados.
- **Estimativa:** **6 h**
- **Riscos:** Médio (exige sincronia entre token emitido pelo backend e cabeçalhos enviados pelo `api-client.ts` para não quebrar a navegação do fundador no Cockpit).

---

#### `BKL-005` — Implementação do `AgentRouter`, Validação de Permissões e Recuperação de Tarefas (`GAP-P1-05` & `GAP-P2-01`)
- **Prioridade:** `P1`
- **Módulo / Agente:** `AG-001` (`packages/agent-core/src/engine/agent-router.ts`, `registry.ts`, `orchestrator.ts`, `worker.ts`)
- **História de Usuário:** Como `AG-001`, quero um `AgentRouter` determinístico que valide se o agente selecionado está ativo (`enabled`), possui competência e permissões antes de delegar, além de executar subtarefas independentes em paralelo e recuperar tarefas presas por timeout.
- **Descrição Técnica:**
  1. Expandir `AgentDefinition` em `registry.ts` para incluir `enabled: boolean`, `tools: string[]` e `permissions: Record<string, boolean>`.
  2. Criar `packages/agent-core/src/engine/agent-router.ts` com validação pré-delegação (`validateAndRouteAgent()`), garantindo que agentes desabilitados ou sem permissão sejam bloqueados/escalonados ao `AG-001` e que o catálogo dinâmico inclua `AG-001` a `AG-012`.
  3. Em `worker.ts`, adicionar rotina de recuperação de tarefas órfãs/timeout (`recoverStuckTasks()`, para tarefas em `running` há mais de 5 minutos) e execução paralela controlada (`Promise.allSettled`) para tarefas independentes no mesmo ciclo.
- **Dependências:** `BKL-001`.
- **Critérios de Aceite:**
  - Delegação para agente `enabled = false` é bloqueada pelo `AgentRouter`.
  - Tarefas independentes são disparadas concorrentemente pelo `AutonomousWorker`.
  - Tarefas presas em `running` além do timeout retornam para `pending` (se `retry_count < max_retries`) ou `failed`.
- **Estimativa:** **4 h**
- **Riscos:** Baixo.

---

### SPRINT 2 — Evolução Completa do AG-011 (CFO Digital & Unit Economics) (14h)

#### `BKL-006` — Criação da Ferramenta Determinística `finops-calculator.ts` (`GAP-P1-01`)
- **Prioridade:** `P1`
- **Módulo / Agente:** `AG-011` (`packages/agent-core/src/tools/finops-calculator.ts`, `finops-calculator.test.ts`)
- **História de Usuário:** Como `AG-011`, quero calcular deterministicamente MRR, ARR, ARPA, CAC, LTV, Payback, Margem por Cliente e Custos de IA conciliados com `agent_runs`.
- **Descrição Técnica:** Implementar `finops-calculator.ts` seguindo as regras da Seção 6.4 do Documento de Validação e criar testes unitários `CFO-001` a `CFO-010`.
- **Dependências:** Sprint 1.
- **Critérios de Aceite:** 100% dos testes `CFO-001` a `CFO-010` aprovados.
- **Estimativa:** **6 h**
- **Riscos:** Baixo.

#### `BKL-007` — Atualização do Prompt Evoluído e Contrato JSON do `AG-011` (`GAP-P1-02`)
- **Prioridade:** `P1`
- **Módulo / Agente:** `AG-011` (`schemas.ts`, `registry.ts`, `executors.ts`, `seed.sql`)
- **História de Usuário:** Como fundador, quero que o `AG-011` utilize o prompt completo da Seção 6 e retorne o contrato JSON da Seção 6.8.
- **Descrição Técnica:** Adicionar `CFODeliverableSchema` em `schemas.ts`, atualizar prompt do `AG-011` e injetar `finops-calculator` em `executors.ts`.
- **Dependências:** `BKL-006`.
- **Critérios de Aceite:** Retorno do `AG-011` validado pelo `CFODeliverableSchema`.
- **Estimativa:** **5 h**
- **Riscos:** Baixo.

#### `BKL-008` — Evolução do Painel `/finops` com Unit Economics Reais (`GAP-P1-01`)
- **Prioridade:** `P2`
- **Módulo / Agente:** Web UI (`packages/web-ui/src/app/finops/page.tsx`, `routes.ts`)
- **História de Usuário:** Como fundador, quero visualizar MRR, ARR, ARPA e Margem por Cliente reais no painel `/finops`.
- **Descrição Técnica:** Integrar `finops-calculator` no endpoint `GET /api/v1/metrics/finops` e renderizar em `/finops`.
- **Dependências:** `BKL-006`.
- **Critérios de Aceite:** Painel `/finops` alimentado por dados reais do PostgreSQL.
- **Estimativa:** **3 h**
- **Riscos:** Baixo.

---

### SPRINT 3 — Evolução Completa do AG-012 (Inteligência de E-mails & Governança) (18h)

#### `BKL-009` — Migration Incremental para Políticas (`email_action_policies`) e Campos RFC (`GAP-P2-02`)
- **Prioridade:** `P1`
- **Módulo / Agente:** Banco de Dados / `AG-012` (`supabase/migrations/0004_ag012_policies_and_rfc.sql`)
- **História de Usuário:** Como arquiteto, quero adicionar suporte a políticas por conta e cabeçalhos RFC sem duplicar tabelas existentes.
- **Descrição Técnica:** Criar `email_action_policies` e adicionar `rfc_message_id`, `thread_id`, `confidence_score`, `analysis_json` em `email_messages`.
- **Dependências:** Sprint 1.
- **Critérios de Aceite:** Migration idempotente aplicada sem perda de dados.
- **Estimativa:** **3 h**
- **Riscos:** Baixo.

#### `BKL-010` — Suporte aos 3 Modos (`monitor_only`, `assisted_action`, `auto_action`) (`GAP-P1-04`)
- **Prioridade:** `P1`
- **Módulo / Agente:** `AG-012` (`email-intelligence.ts`, `routes.ts`, `emails/page.tsx`)
- **História de Usuário:** Como fundador, quero escolher entre `monitor_only`, `assisted_action` e `auto_action` em cada conta cadastrada.
- **Descrição Técnica:** Implementar os 3 modos respeitando `email_action_policies` e `AgentRouter`.
- **Dependências:** `BKL-005`, `BKL-009`.
- **Critérios de Aceite:** Testes `EMAIL-010`, `EMAIL-011` e `EMAIL-012` aprovados.
- **Estimativa:** **4 h**
- **Riscos:** Baixo.

#### `BKL-011` — Prompt Evoluído e Contrato JSON `email.analysis` (Seção 7.10) (`GAP-P1-03`)
- **Prioridade:** `P1`
- **Módulo / Agente:** `AG-012` (`schemas.ts`, `registry.ts`, `email-intelligence.ts`)
- **História de Usuário:** Como `AG-012`, quero gerar o contrato JSON completo da Seção 7.10 e rotear para todos os 7 especialistas da Seção 7.6.
- **Descrição Técnica:** Implementar `EmailAnalysisContractSchema` e atualizar prompt e roteamento do `AG-012`.
- **Dependências:** `BKL-009`.
- **Critérios de Aceite:** Testes `EMAIL-003` a `EMAIL-007` aprovados.
- **Estimativa:** **5 h**
- **Riscos:** Baixo.

#### `BKL-012` — Extração de `Message-ID`, `Thread-ID` e Filtro de Anexos Seguros (`GAP-P1-06`)
- **Prioridade:** `P1`
- **Módulo / Agente:** `AG-012` (`email-intelligence.ts`)
- **História de Usuário:** Como `AG-012`, quero deduplicar mensagens por `Message-ID` RFC, preservar `Thread-ID` e bloquear anexos executáveis.
- **Descrição Técnica:** Expandir cabeçalhos do IMAP `FETCH` e validar extensões de anexos.
- **Dependências:** `BKL-009`.
- **Critérios de Aceite:** Testes `EMAIL-002`, `EMAIL-008` e `EMAIL-015` aprovados.
- **Estimativa:** **4 h**
- **Riscos:** Baixo.

#### `BKL-013` — Validação TLS Configurável no IMAP e Indicadores Operacionais do `AG-012` (`GAP-P2-05` & `GAP-P3-02`)
- **Prioridade:** `P2`
- **Módulo / Agente:** `AG-012` (`email-intelligence.ts`, `emails/page.tsx`)
- **História de Usuário:** Como administrador, quero verificação TLS estrita por padrão (com opção explícita para certificado compartilhado cPanel) e painel de métricas da Seção 7.14.
- **Descrição Técnica:** Parametrizar `rejectUnauthorized` por conta e exibir taxa de processamento, bloqueios e falhas em `/emails`.
- **Dependências:** `BKL-011`.
- **Critérios de Aceite:** Indicadores da Seção 7.14 visíveis na central `/emails`.
- **Estimativa:** **2 h**
- **Riscos:** Baixo.

---

### SPRINT 4 — RAG Regulatório (`AG-009`), Validador `AG-004`, Cron IMAP e Testes E2E (10h)

#### `BKL-014` — Injeção Automática da Base Regulatória (`knowledge_sources`) no `AG-009` (`GAP-P2-03`)
- **Prioridade:** `P2`
- **Módulo / Agente:** `AG-009` (`executors.ts`)
- **História de Usuário:** Como `AG-009`, quero receber automaticamente as normas vigentes da tabela `knowledge_sources` ao elaborar pareceres.
- **Descrição Técnica:** Consultar `knowledge_sources` em `executors.ts` antes da chamada ao Gemini para o `AG-009`.
- **Dependências:** Nenhuma.
- **Critérios de Aceite:** Pareceres do `AG-009` fundamentados nos registros reais de `knowledge_sources`.
- **Estimativa:** **2 h**
- **Riscos:** Baixo.

#### `BKL-015` — Validador Determinístico de Integridade de Faturas (`data_validator`) para o `AG-004` (`GAP-P2-04`)
- **Prioridade:** `P2`
- **Módulo / Agente:** `AG-004` (`bill-parser.ts`, `executors.ts`)
- **História de Usuário:** Como `AG-004`, quero validar matematicamente a consistência de soma e tributos de faturas extraídas via OCR.
- **Descrição Técnica:** Implementar `validateExtractedBillIntegrity()` em `bill-parser.ts` e conectá-lo ao `AG-004` em `executors.ts`.
- **Dependências:** Nenhuma.
- **Critérios de Aceite:** Divergências de soma sinalizadas deterministicamente.
- **Estimativa:** **2 h**
- **Riscos:** Baixo.

#### `BKL-016` — Sincronização IMAP Agendada Configurável e Trilha `decision_logs` (`GAP-P3-01` & `GAP-P3-03`)
- **Prioridade:** `P3`
- **Módulo / Agente:** `AG-001` / `AG-012` (`worker.ts`, `orchestrator.ts`)
- **História de Usuário:** Como fundador, quero sincronização IMAP periódica opcional para contas ativas e log auditável de decisões do `AG-001`.
- **Descrição Técnica:** Adicionar ciclo opcional de sync IMAP no worker (controlado por `EMAIL_AUTO_SYNC_MINUTES`) e registro estruturado de decisões.
- **Dependências:** Sprint 3.
- **Critérios de Aceite:** Sincronização periódica respeitando `enabled = true` e intervalo configurado.
- **Estimativa:** **2 h**
- **Riscos:** Baixo.

#### `BKL-017` — Suíte Automatizada de Testes Integrados (`AG-001` + `AG-011` + `AG-012`)
- **Prioridade:** `P1`
- **Módulo / Agente:** Testes (`packages/agent-core/src/engine/integration-audit.test.ts`)
- **História de Usuário:** Como auditor técnico, quero uma suíte automatizada (`npm test`) que comprove todos os cenários das Seções 5.1, 11, 12 e 13.
- **Descrição Técnica:** Implementar testes integrados automatizados com `node:test`.
- **Dependências:** `BKL-001` a `BKL-016`.
- **Critérios de Aceite:** `npm test` executando todas as suítes (Energia, M&V, Segurança, Orquestração, CFO e E-mail) com 100% de aprovação.
- **Estimativa:** **4 h**
- **Riscos:** Baixo.
