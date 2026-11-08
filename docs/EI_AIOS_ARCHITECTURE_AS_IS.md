# ARQUITETURA ATUAL ENCONTRADA (AS-IS) — EI-AIOS

**Data de Levantamento:** 07/11/2026  
**Escopo:** Documentação fiel da arquitetura efetivamente implementada no repositório `c:\_dev\ei-aios` e em execução na VPS Hostinger (`187.77.49.211`).

---

## 1. Visão Geral dos Componentes (Monorepo NPM Workspaces)

O projeto está estruturado como um **Monorepo TypeScript (Node.js 22 LTS / ESM)** gerenciado via `npm workspaces` (`package.json` raiz), dividido em três pacotes principais e duas pastas de infraestrutura/banco:

```text
ei-aios/
├── packages/
│   ├── shared/                 # (@ei-aios/shared) Enums, Tipos e Schemas Zod compartilhados
│   │   └── src/
│   │       ├── enums.ts        # AgentId (AG-001 a AG-012), TaskStatus, PriorityLevel, ActionRiskLevel
│   │       ├── schemas.ts      # Schemas Zod (TaskEnvelope, OrchestratorPlan, EnergyBill, QAReview)
│   │       └── index.ts
│   ├── agent-core/             # (@ei-aios/agent-core) Backend API REST, Worker, Agentes e Tools
│   │   └── src/
│   │       ├── agents/
│   │       │   ├── registry.ts # Catálogo AG-001 a AG-012 + lookup na tabela agents
│   │       │   └── executors.ts# Executor central de tarefas + chamada de tools determinísticas
│   │       ├── api/
│   │       │   ├── routes.ts   # 21 endpoints REST (/api/v1/*)
│   │       │   └── server.ts   # Servidor Express (porta 4000)
│   │       ├── config/
│   │       │   ├── env.ts      # Variáveis de ambiente
│   │       │   ├── gemini.ts   # Cliente @google/genai + failover de modelos + telemetria agent_runs
│   │       │   └── supabase.ts # Cliente @supabase/supabase-js apontando para PostgREST
│   │       ├── engine/
│   │       │   ├── orchestrator.ts  # Decomposição (AG-001) e síntese executiva
│   │       │   ├── policy-engine.ts # Circuit Breaker FinOps diário e regra Nível 2
│   │       │   ├── qa-gate.ts       # Auditoria AG-008 + trava textual "economia garantida"
│   │       │   └── worker.ts        # Loop contínuo de polling de tarefas (5s)
│   │       └── tools/
│   │           ├── energy-calculator.ts # Calculadora determinística Grupo A (REN 1.000/2021)
│   │           ├── mv-calculator.ts     # Calculadora determinística M&V (IPMVP)
│   │           ├── bill-parser.ts       # Extrator multimodal de faturas (OCR via Gemini)
│   │           ├── artifact-writer.ts   # Persistência de artefatos em Markdown/JSON
│   │           └── email-intelligence.ts# Cliente IMAP TLS HostGator + triagem AG-012
│   └── web-ui/                 # (@ei-aios/web-ui) Cockpit Executivo em Next.js 15.5 (App Router)
│       └── src/
│           ├── app/            # Rotas: /, /tasks, /agents, /emails, /energy, /approvals, /artifacts, /clients, /finops
│           ├── components/     # ExecutiveDeliverableView.tsx (Renderizador corporativo)
│           └── lib/            # api-client.ts
├── supabase/
│   ├── migrations/
│   │   ├── 0001_core_schema.sql      # 11 tabelas + enums + índices
│   │   └── 0002_rls_and_triggers.sql # Triggers updated_at + RLS + índices GIN
│   └── seed.sql                      # Seed de AG-001 a AG-012, cliente piloto e knowledge_sources
└── docker/
    ├── docker-compose.yml      # Stack Docker Swarm (traefik, postgres, postgrest, agent-core, web-ui, n8n)
    └── deploy.sh               # Script de deploy e aplicação de migrations no Swarm
```

---

## 2. Topologia de Infraestrutura e Containers (AS-IS)

A plataforma roda em produção sob uma stack **Docker Swarm (`ei-aios`)** orquestrada atrás do proxy reverso **Traefik v2.11** com certificados TLS Let's Encrypt automáticos:

```mermaid
flowchart LR
    User["Fundador / Browser"] -->|HTTPS 443| Traefik["Traefik v2.11 Reverse Proxy"]
    
    subgraph Swarm["Docker Swarm Stack: ei-aios ( Rede Overlay: ei-network )"]
        Traefik -->|app.eiaios.atendezen.com.br| WebUI["ei-aios_web-ui (Next.js 15 :3000)"]
        Traefik -->|api.eiaios.atendezen.com.br| AgentCore["ei-aios_agent-core (Express/Node 22 :4000)"]
        Traefik -->|n8n.eiaios.atendezen.com.br| N8N["ei-aios_n8n (n8n :5678)"]
        
        AgentCore -->|HTTP REST :3000| PostgREST["ei-aios_postgrest (PostgREST v12.2)"]
        PostgREST -->|TCP :5432| Postgres[("ei-aios_postgres (PostgreSQL 16 Alpine)")]
        AgentCore -->|Webhook HTTP| N8N
    end

    AgentCore -->|HTTPS REST| Gemini["Google Gemini API (gemini-3.5-flash-lite / 3.8-flash)"]
    AgentCore -->|IMAPS TLS :993| HostGator["HostGator cPanel IMAP (mail.<dominio>)"]
```

> **Observação Arquitetural Importante:** No ambiente atual, o pacote `@supabase/supabase-js` em `packages/agent-core/src/config/supabase.ts` conecta-se diretamente ao container **PostgREST standalone** (`http://postgrest:3000`), assinando um token JWT local com `role: 'service_role'` usando a variável `JWT_SECRET`. Não há container GoTrue (Supabase Auth) nem Kong API Gateway na stack Docker atual.

---

## 3. Fluxo Real de Orquestração e Execução de Tarefas (AS-IS)

O diagrama abaixo representa exatamente como o código atual (`orchestrator.ts`, `worker.ts`, `executors.ts`, `qa-gate.ts` e `routes.ts`) processa um objetivo macro ou tarefa:

```mermaid
sequenceDiagram
    actor Founder as Fundador (Web UI)
    participant API as routes.ts (Express)
    participant Orch as Orchestrator (AG-001)
    participant DB as PostgreSQL (tasks / approvals)
    participant Worker as AutonomousWorker (5s loop)
    participant Policy as PolicyEngine
    participant Exec as executeAgentTask()
    participant QA as QAGate (AG-008)

    Founder->>API: POST /api/v1/objectives
    API->>Orch: decomposeObjective(objective)
    Orch->>DB: INSERT parent task (MACRO-*, status='running')
    Orch->>DB: INSERT subtasks (MACRO-*-01..N, status='pending', dependencies=[])
    API->>Worker: triggerCycle()
    
    loop A cada 5 segundos (ou triggerCycle)
        Worker->>DB: SELECT * FROM tasks WHERE status='pending' LIMIT 5
        loop Sequencial (for rawTask of pendingTasks)
            Worker->>DB: areDependenciesSatisfied(task.dependencies)
            Worker->>Policy: evaluatePreExecution(agentId, riskLevel)
            Policy->>DB: SELECT SUM(cost_estimate) FROM agent_runs (Hoje)
            alt Orçamento Diário Excedido
                Policy-->>Worker: allowed = false (Bloqueia execução)
            else Permitido
                Worker->>DB: UPDATE tasks SET status='running'
                Worker->>Exec: executeAgentTask(task)
                Note over Exec: Se AG-003 -> runEnergyAudit()<br/>Se AG-010 -> calculateM&V()<br/>Chama Gemini API + Salva agent_runs + Salva Artifact
                Worker->>DB: UPDATE tasks SET status='review', result_payload=...
                Worker->>QA: auditTaskResult(task, outputPayload)
                alt QA Reprovou (approved = false)
                    Worker->>DB: Se retry_count < max_retries -> status='pending', retry_count++
                else QA Aprovou (approved = true)
                    alt Nível 2 (requires_approval = true)
                        Worker->>DB: UPDATE tasks SET status='waiting_input'
                        Worker->>DB: INSERT INTO approvals (status='pending')
                    else Nível 0 ou 1
                        Worker->>DB: UPDATE tasks SET status='completed'
                        Worker->>Orch: checkAndSynthesizeParent(parent_task_id)
                    end
                end
            end
        end
    end

    Note over Founder,DB: Fluxo de Aprovação Humana Nível 2 (AS-IS):
    Founder->>API: POST /api/v1/approvals/:id/decide (decision='approved')
    API->>DB: UPDATE approvals SET approval_status='approved'
    API->>DB: UPDATE tasks SET status='completed'
    API->>Worker: triggerCycle()
    Note right of API: ⚠️ GAP-P0-01: routes.ts não chama<br/>checkAndSynthesizeParent(), deixando<br/>a tarefa MACRO-* em status='running'
```

---

## 4. Fluxo Real do `AG-012` — Inteligência de E-mails (AS-IS)

```mermaid
flowchart TD
    A["Acionamento Manual na UI (/emails)<br/>POST /api/v1/emails/accounts/:id/sync ou /simulate"] --> B["fetchImapEmailsFromHostgator()<br/>(TLS porta 993 -> LOGIN -> SELECT INBOX -> FETCH últimos 5)"]
    B --> C{"message_uid já existe<br/>em email_messages?"}
    C -->|Sim| D["Retorna registro existente (Deduplicação por UID)"]
    C -->|Não| E["analyzeEmailWithAG012()<br/>(Gemini API: classifica P0-P3, categoria, resumo, próximo passo, minuta)"]
    E --> F{"account.operation_mode?"}
    F -->|read_summarize| G["Salva em email_messages com status='analyzed'<br/>(Aguarda clique manual do fundador)"]
    F -->|auto_action| H["createFollowUpTaskFromEmail()<br/>INSERT INTO tasks (EMAIL-*, assigned_agent_id)<br/>+ autonomousWorker.triggerCycle()"]
    H --> I["Salva em email_messages com<br/>status='task_dispatched' e triggered_task_code"]
```

---

## 5. Modelo de Dados Real no PostgreSQL (11 Tabelas Existentes)

Todas as 11 tabelas abaixo estão fisicamente criadas no banco de dados PostgreSQL (`supabase/migrations/0001_core_schema.sql`):

```mermaid
erDiagram
    agents ||--o{ tasks : "assigned_agent_id"
    agents ||--o{ agent_runs : "agent_id"
    agents ||--o{ approvals : "requested_by"
    clients ||--o{ consumer_units : "client_id"
    clients ||--o{ tasks : "client_id"
    clients ||--o{ artifacts : "client_id"
    consumer_units ||--o{ energy_bills : "consumer_unit_id"
    tasks ||--o{ tasks : "parent_task_id"
    tasks ||--o{ agent_runs : "task_id"
    tasks ||--o{ approvals : "task_id"
    tasks ||--o{ artifacts : "task_id"
    email_accounts ||--o{ email_messages : "account_id"
    tasks ||--o{ email_messages : "triggered_task_id"

    agents {
        varchar id PK "AG-001 a AG-012"
        varchar name
        varchar agent_type
        text system_prompt
        jsonb configuration "model, tools, permissions, daily_budget_usd"
        boolean enabled
    }
    clients {
        uuid id PK
        varchar company_name
        varchar cnpj UK
        varchar stage "lead, pilot_loi, active_saas, churned"
        numeric monthly_fee_brl
        numeric success_fee_percent
    }
    consumer_units {
        uuid id PK
        uuid client_id FK
        varchar uc_code
        varchar distributor
        varchar tariff_group "A4, A3a, etc"
        varchar tariff_modality "HOROSSAZONAL_VERDE, AZUL"
        numeric contracted_demand_peak_kw
        jsonb baseline_metrics
    }
    energy_bills {
        uuid id PK
        uuid consumer_unit_id FK
        varchar billing_period "YYYY-MM"
        numeric total_amount_brl
        jsonb deterministic_audit_json
        numeric potential_savings_brl
        numeric verified_savings_brl
    }
    tasks {
        uuid id PK
        varchar task_code UK
        uuid parent_task_id FK
        varchar assigned_agent_id FK
        priority_level priority "P0..P3"
        task_status status "pending..completed"
        action_risk_level risk_level
        uuid_array dependencies
        jsonb input_payload
        jsonb result_payload
        jsonb qa_review_payload
        boolean requires_approval
    }
    agent_runs {
        uuid id PK
        uuid task_id FK "Nullable em chamadas de chat/planejamento"
        varchar agent_id FK
        varchar model_name
        integer input_tokens
        integer output_tokens
        integer execution_time_ms
        numeric cost_estimate
        varchar status
    }
    approvals {
        uuid id PK
        uuid task_id FK
        varchar requested_by FK
        varchar approval_status "pending, approved, rejected"
        text comments
    }
    artifacts {
        uuid id PK
        uuid task_id FK
        uuid client_id FK
        varchar artifact_type
        varchar title
        text content_markdown
        jsonb structured_data
    }
    knowledge_sources {
        uuid id PK
        varchar source_type
        varchar source_name
        jsonb structured_content
    }
    email_accounts {
        uuid id PK
        varchar account_label
        varchar email_address UK
        varchar imap_host
        integer imap_port "993"
        varchar smtp_host
        integer smtp_port "465"
        text password_secret
        varchar operation_mode "read_summarize | auto_action"
    }
    email_messages {
        uuid id PK
        uuid account_id FK
        varchar message_uid
        varchar from_address
        varchar subject
        varchar category
        varchar priority "P0..P3"
        text ai_summary
        text recommended_next_step
        text suggested_reply_draft
        varchar recommended_agent_id
        uuid triggered_task_id FK
        varchar status "analyzed | task_dispatched"
    }
```

---

## 6. Ferramentas Reais vs. Ferramentas Declaradas no `seed.sql`

Durante a auditoria, confrontamos as ferramentas listadas no campo `configuration.tools` de `supabase/seed.sql` com os módulos efetivamente implementados em `packages/agent-core/src/tools/`:

| Ferramenta Citada no `seed.sql` | Agente Associado | Status Real no Código (`packages/agent-core/src/tools/`) |
|---|---|---|
| `energy-calculator` (`energy_calculator`) | `AG-003` | **IMPLEMENTADO E INTEGRADO** (`energy-calculator.ts` -> chamado em `executors.ts:28` e `routes.ts:116`) |
| `mv-calculator` (`mv_calculator`) | `AG-010` | **IMPLEMENTADO E INTEGRADO** (`mv-calculator.ts` -> chamado em `executors.ts:43`) |
| `bill_parser` | `AG-004` | **IMPLEMENTADO PARCIALMENTE** (`bill-parser.ts` -> chamado em `routes.ts:108`, mas não em `executors.ts`) |
| `artifact_writer` | Todos | **IMPLEMENTADO E INTEGRADO** (`artifact-writer.ts` -> chamado em `executors.ts:106, 134`) |
| `imap_reader`, `next_step_analyzer`, `task_dispatcher` | `AG-012` | **IMPLEMENTADO E INTEGRADO** (`email-intelligence.ts` -> chamado em `routes.ts:724, 774, 899`) |
| `task_router`, `workflow_planner`, `executive_synthesizer` | `AG-001` | **IMPLEMENTADO EM `orchestrator.ts`** (via métodos `decomposeObjective` e `synthesizeCompletedObjective`) |
| `qa_validator`, `math_consistency_checker`, `compliance_scanner` | `AG-008` | **IMPLEMENTADO EM `qa-gate.ts`** (`auditTaskResult`) |
| `finops_calculator`, `saas_metrics` | `AG-011` | **NÃO IMPLEMENTADO COMO TOOL** (existe apenas agregação de tokens em `routes.ts:287`, sem módulo em `src/tools/`) |
| `data_validator` | `AG-004` | **NÃO IMPLEMENTADO** (apenas referenciado como string no JSON de seed) |
| `market_analyzer`, `swot_generator`, `icp_scorer` | `AG-002` | **NÃO IMPLEMENTADO COMO TOOL** (executado via prompt LLM genérico) |
| `code_generator`, `schema_designer` | `AG-005` | **NÃO IMPLEMENTADO COMO TOOL** (executado via prompt LLM genérico) |
| `copywriter`, `campaign_planner` | `AG-006` | **NÃO IMPLEMENTADO COMO TOOL** (executado via prompt LLM genérico) |
| `proposal_generator`, `lead_qualifier`, `loi_builder` | `AG-007` | **NÃO IMPLEMENTADO COMO TOOL** (executado via prompt LLM genérico) |
| `aneel_rag`, `dossier_writer` | `AG-009` | **NÃO IMPLEMENTADO COMO TOOL** (tabela `knowledge_sources` existe, mas não é consultada em `executors.ts`) |

---

## 7. Variáveis de Ambiente e Gerenciamento de Credenciais (Sem Exposição de Segredos)

Em `packages/agent-core/src/config/env.ts` e `.github/workflows/deploy.yml`, foram identificadas as seguintes variáveis de configuração:

| Variável | Presença em Produção | Finalidade | Observação de Auditoria |
|---|---|---|---|
| `GEMINI_API_KEY` | Presente (injetada via GitHub Secrets) | Autenticação na API Google Gemini (`@google/genai`) | Configurada e operacional (`mode: gemini_live_api`) |
| `GEMINI_DEFAULT_FAST_MODEL` | Presente (`gemini-3.5-flash-lite`) | Modelo padrão de baixa latência | Operacional com failover para `gemini-3.1-flash-lite` |
| `GEMINI_DEFAULT_REASONING_MODEL` | Presente (`gemini-3.8-flash`) | Modelo padrão para raciocínio complexo | Operacional |
| `SUPABASE_URL` | Presente (`http://postgrest:3000`) | Endpoint interno PostgREST na rede Docker Swarm | Operacional |
| `JWT_SECRET` | Presente | Assinatura de JWT `service_role` para o PostgREST | Operacional |
| `POSTGRES_PASSWORD` | Presente | Senha do banco PostgreSQL 16 interno | Operacional |
| `N8N_WEBHOOK_URL` | Presente | Notificação externa de aprovações Nível 2 | Operacional |

