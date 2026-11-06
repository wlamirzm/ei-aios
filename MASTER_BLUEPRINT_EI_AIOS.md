# MASTER ENGINEERING BLUEPRINT & PRD: ENERGY INTELLIGENCE AIOS (EI-AIOS)

> **INSTRUÇÃO DE SISTEMA PARA O GOOGLE ANTIGRAVITY (AI SOFTWARE ENGINEER):**
> Você atuará como Arquiteto de Software Principal e Engenheiro Full-Stack Sênior (`AG-005`). Sua missão é construir a plataforma completa **Energy Intelligence AI Operating System (EI-AIOS)** do zero, obedecendo rigorosamente a todos os schemas, contratos de API, ferramentas determinísticas, interfaces e fluxos descritos neste documento.
> O sistema deve funcionar como uma plataforma empresarial autônoma baseada em eventos e polling contínuo, permitindo que um fundador solo opere uma startup de eficiência e inteligência energética de ponta a ponta com supervisão humana (*Human-in-the-Loop*).

---

## 1. ARQUITETURA TÉCNICA E ESTRUTURA DO MONOREPO

### 1.1 Stack Tecnológica Obrigatória
* **Gerenciador de Pacotes & Monorepo:** `npm workspaces` (Node.js 20+ LTS) com TypeScript 5.x estrito.
* **Frontend (Cockpit do Fundador):** Next.js 15 (App Router), React 19, TypeScript, Tailwind CSS, Shadcn/UI, Lucide Icons, Recharts (gráficos energéticos e FinOps).
* **Backend & Motor de Agentes (`agent-core`):** Node.js + Fastify/Express (API REST & Webhooks) + Autonomous Background Worker + Google ADK pattern + SDK Oficial `@google/genai` (Modelos `gemini-2.5-flash` para execução rápida/extração multimodal e `gemini-2.5-pro` para raciocínio complexo/orquestração).
* **Persistência, Autenticação e Arquivos:** Supabase (PostgreSQL 16, Supabase Auth, Supabase Storage, Row Level Security).
* **Automação e Integrações Externas:** n8n (Self-hosted via Docker) integrado por Webhooks REST e banco compartilhado.
* **Infraestrutura de Produção:** Docker & Docker Compose preparados para VPS Linux (Hostinger) com proxy reverso Traefik (HTTPS/Let's Encrypt automático).

### 1.2 Árvore Completa de Diretórios do Projeto
O Antigravity deve criar exatamente esta estrutura de arquivos:

```text
ei-aios/
├── package.json                        # Configuração de Workspaces (shared, agent-core, web-ui)
├── tsconfig.base.json                  # Configuração TypeScript global
├── .env.example                        # Variáveis de ambiente documentadas
├── docker/
│   ├── docker-compose.yml              # Orquestração VPS Hostinger (Traefik, Postgres, n8n, Agent-Core, Web-UI)
│   └── traefik/
│       └── traefik.yml                 # Configuração SSL/Reverse Proxy
├── supabase/
│   ├── migrations/
│   │   ├── 0001_core_schema.sql        # Tabelas operacionais de agentes, tarefas e negócios
│   │   └── 0002_rls_and_triggers.sql   # Políticas RLS, índices e triggers de updated_at
│   └── seed.sql                        # Carga completa dos 11 agentes (AG-001 a AG-011) e tarifas iniciais
├── packages/
│   ├── shared/
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   └── src/
│   │       ├── index.ts
│   │       ├── enums.ts                # Status, Prioridades, Níveis de Risco, Tipos de Artefatos
│   │       ├── schemas.ts              # Contratos Zod (Task Envelope, Faturas, M&V, Outputs de Agentes)
│   │       └── types.ts                # Tipos TypeScript inferidos
│   ├── agent-core/
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   ├── Dockerfile
│   │   └── src/
│   │       ├── index.ts                # Inicializador do Servidor HTTP + Autonomous Worker Loop
│   │       ├── api/
│   │       │   ├── routes.ts           # Endpoints REST (/api/v1/objectives, /tasks, /approvals, /webhooks)
│   │       │   └── middleware.ts       # Auth validation & Error handling
│   │       ├── config/
│   │       │   ├── env.ts
│   │       │   ├── supabase.ts
│   │       │   └── gemini.ts           # Wrapper @google/genai com telemetria automática de tokens/custos
│   │       ├── engine/
│   │       │   ├── worker.ts           # Loop autônomo (busca tasks pending -> executa -> QA -> Policy)
│   │       │   ├── orchestrator.ts     # Lógica central do AG-001 (Decomposição e Consolidação)
│   │       │   ├── qa-gate.ts          # Lógica de auditoria obrigatória do AG-008
│   │       │   ├── policy-engine.ts    # Validador Nível 0, 1 e 2 + Circuit Breaker financeiro
│   │       │   └── workflow-runner.ts  # Executor dos fluxos WF-001 a WF-008
│   │       ├── tools/
│   │       │   ├── energy-calculator.ts# Motor matemático determinístico de faturas Grupo A/B (Sem LLM)
│   │       │   ├── mv-calculator.ts    # Motor determinístico de Medição e Verificação (Baseline vs Realizado)
│   │       │   ├── bill-parser.ts      # Extrator multimodal de PDF/Imagem de faturas via Gemini
│   │       │   └── artifact-writer.ts  # Gerador de relatórios Markdown/HTML e upload no Supabase Storage
│   │       └── agents/
│   │           ├── registry.ts         # Carregador dinâmico dos agentes (AG-001 a AG-011)
│   │           └── executors.ts        # Invocadores especializados com Schemas Zod por agente
│   └── web-ui/
│       ├── package.json
│       ├── tsconfig.json
│       ├── next.config.mjs
│       ├── tailwind.config.ts
│       ├── Dockerfile
│       └── src/
│           ├── app/
│           │   ├── layout.tsx          # Sidebar de navegação + Topbar com status do Worker e Custos
│           │   ├── login/page.tsx      # Autenticação do Fundador via Supabase Auth
│           │   ├── page.tsx            # 1. Command Center (Envio de Objetivos & Live Feed)
│           │   ├── approvals/page.tsx  # 2. Inbox Human-in-the-Loop (Aprovação Nível 2 + Parecer QA)
│           │   ├── tasks/page.tsx      # 3. Orquestração & Backlog (Árvore de Tarefas e Kanban)
│           │   ├── energy/page.tsx     # 4. Auditoria de Faturas & M&V (Upload WF-003, Gráficos e Relatórios)
│           │   ├── clients/page.tsx    # 5. Clientes, Unidades Consumidoras e Pilotos (Fase 0 a 3)
│           │   ├── artifacts/page.tsx  # 6. Repositório de Entregáveis (Visualizador Markdown/PDF)
│           │   ├── agents/page.tsx     # 7. Catálogo de Agentes (Editor de System Prompts e Permissões)
│           │   └── finops/page.tsx     # 8. Observabilidade, Métricas de Qualidade e Controle de Custos
│           ├── components/
│           │   ├── ui/                 # Componentes base (Button, Card, Dialog, Badge, Tabs, Table)
│           │   ├── command-bar.tsx     # Input de objetivos para o AG-001
│           │   ├── task-tree.tsx       # Visualizador hierárquico Parent -> Child tasks
│           │   ├── approval-modal.tsx  # Comparador Lado-a-Lado (Entregável vs Auditoria QA)
│           │   └── bill-dropzone.tsx   # Uploader de contas de energia
│           └── lib/
│               ├── supabase-client.ts
│               └── api-client.ts
└── workflows/
    └── n8n/
        ├── wf003_energy_diagnosis.json
        ├── wf006_email_bill_ingestion.json
        └── wf008_monthly_mv_report.json
```

---

## 2. MODELO DE DADOS COMPLETO (SUPABASE / POSTGRESQL)

Implemente integralmente no arquivo `supabase/migrations/0001_core_schema.sql`:

```sql
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 1. ENUMERAÇÕES DE CONTROLE
CREATE TYPE task_status AS ENUM (
  'pending', 'assigned', 'running', 'waiting_input', 
  'review', 'approved', 'rejected', 'completed', 'failed', 'cancelled'
);

CREATE TYPE priority_level AS ENUM ('P0', 'P1', 'P2', 'P3');
CREATE TYPE action_risk_level AS ENUM ('LEVEL_0_AUTO', 'LEVEL_1_SUPERVISED', 'LEVEL_2_APPROVAL_REQUIRED');

-- 2. CATÁLOGO DE AGENTES
CREATE TABLE agents (
  id VARCHAR(20) PRIMARY KEY, -- 'AG-001' a 'AG-011'
  name VARCHAR(100) NOT NULL,
  agent_type VARCHAR(50) NOT NULL,
  version VARCHAR(20) NOT NULL DEFAULT '1.0.0',
  role_description TEXT NOT NULL,
  system_prompt TEXT NOT NULL,
  configuration JSONB NOT NULL DEFAULT '{
    "model": "gemini-2.5-flash",
    "temperature": 0.1,
    "tools": [],
    "permissions": {
      "database_read": true,
      "database_write": false,
      "external_publish": false,
      "financial_commitment": false
    },
    "approval_required": [],
    "daily_budget_usd": 5.00
  }'::jsonb,
  enabled BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. CLIENTES E UNIDADES CONSUMIDORAS (CORE BUSINESS ENERGIA)
CREATE TABLE clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_name VARCHAR(200) NOT NULL,
  cnpj VARCHAR(20) UNIQUE,
  segment VARCHAR(100), -- Indústria, Supermercado, Condomínio, Rede Farmácia, etc.
  stage VARCHAR(50) NOT NULL DEFAULT 'lead', -- lead, pilot_loi, active_saas, churned
  contact_name VARCHAR(150),
  contact_email VARCHAR(150),
  contact_phone VARCHAR(50),
  contract_model VARCHAR(50) DEFAULT 'saas_plus_success_fee',
  monthly_fee_brl NUMERIC(12, 2) DEFAULT 0,
  success_fee_percent NUMERIC(5, 2) DEFAULT 20.00,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE consumer_units (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  uc_code VARCHAR(50) NOT NULL, -- Código da Instalação na Distribuidora
  unit_name VARCHAR(150) NOT NULL, -- Ex: Filial Centro
  distributor VARCHAR(100) NOT NULL, -- Enel SP, CPFL Paulista, Cemig, Neoenergia, etc.
  tariff_group VARCHAR(20) NOT NULL DEFAULT 'A4', -- A2, A3, A3a, A4, B3
  tariff_modality VARCHAR(30) NOT NULL DEFAULT 'HOROSSAZONAL_VERDE', -- VERDE, AZUL, CONVENCIONAL, BRANCA
  contracted_demand_peak_kw NUMERIC(10, 2) DEFAULT 0,
  contracted_demand_offpeak_kw NUMERIC(10, 2) DEFAULT 0,
  is_free_market BOOLEAN NOT NULL DEFAULT false,
  has_distributed_generation BOOLEAN NOT NULL DEFAULT false,
  baseline_metrics JSONB NOT NULL DEFAULT '{}'::jsonb, -- Linha de base para cálculo de M&V
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 4. FATURAS DE ENERGIA E DIAGNÓSTICOS DETERMINÍSTICOS
CREATE TABLE energy_bills (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  consumer_unit_id UUID NOT NULL REFERENCES consumer_units(id) ON DELETE CASCADE,
  billing_period VARCHAR(7) NOT NULL, -- Formato 'YYYY-MM'
  due_date DATE,
  total_amount_brl NUMERIC(12, 2) NOT NULL,
  consumption_peak_kwh NUMERIC(12, 2) NOT NULL DEFAULT 0,
  consumption_offpeak_kwh NUMERIC(12, 2) NOT NULL DEFAULT 0,
  measured_demand_peak_kw NUMERIC(10, 2) NOT NULL DEFAULT 0,
  measured_demand_offpeak_kw NUMERIC(10, 2) NOT NULL DEFAULT 0,
  billed_demand_peak_kw NUMERIC(10, 2) NOT NULL DEFAULT 0,
  billed_demand_offpeak_kw NUMERIC(10, 2) NOT NULL DEFAULT 0,
  exceeded_demand_kw NUMERIC(10, 2) NOT NULL DEFAULT 0,
  exceeded_demand_fine_brl NUMERIC(12, 2) NOT NULL DEFAULT 0,
  reactive_energy_excess_kwh NUMERIC(12, 2) NOT NULL DEFAULT 0,
  reactive_energy_fine_brl NUMERIC(12, 2) NOT NULL DEFAULT 0,
  tariff_flag VARCHAR(30) DEFAULT 'VERDE', -- VERDE, AMARELA, VERMELHA_P1, VERMELHA_P2
  taxes_breakdown JSONB NOT NULL DEFAULT '{"icms_rate": 0, "pis_rate": 0, "cofins_rate": 0, "cip_brl": 0}'::jsonb,
  raw_extracted_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  deterministic_audit_json JSONB NOT NULL DEFAULT '{}'::jsonb, -- Resultado da calculadora determinística
  potential_savings_brl NUMERIC(12, 2) NOT NULL DEFAULT 0,
  verified_savings_brl NUMERIC(12, 2) NOT NULL DEFAULT 0,
  file_path TEXT,
  validation_status VARCHAR(30) NOT NULL DEFAULT 'pending_review',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(consumer_unit_id, billing_period)
);

-- 5. TAREFAS E ORQUESTRAÇÃO (TASK ENVELOPE)
CREATE TABLE tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_code VARCHAR(30) UNIQUE NOT NULL, -- Ex: 'TASK-0001'
  workflow_code VARCHAR(20), -- Ex: 'WF-001' a 'WF-008'
  parent_task_id UUID REFERENCES tasks(id) ON DELETE CASCADE,
  client_id UUID REFERENCES clients(id) ON DELETE SET NULL,
  created_by VARCHAR(50) NOT NULL, -- 'FOUNDER' ou ID do Agente
  assigned_agent_id VARCHAR(20) REFERENCES agents(id),
  objective TEXT NOT NULL,
  task_type VARCHAR(50) NOT NULL,
  priority priority_level NOT NULL DEFAULT 'P1',
  status task_status NOT NULL DEFAULT 'pending',
  risk_level action_risk_level NOT NULL DEFAULT 'LEVEL_0_AUTO',
  dependencies UUID[] DEFAULT '{}',
  retry_count INTEGER NOT NULL DEFAULT 0,
  max_retries INTEGER NOT NULL DEFAULT 2,
  input_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  expected_output JSONB NOT NULL DEFAULT '{"format": "json", "schema_version": "1.0"}'::jsonb,
  result_payload JSONB,
  qa_review_payload JSONB,
  requires_approval BOOLEAN NOT NULL DEFAULT false,
  approval_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ
);

-- 6. EXECUÇÕES DE AGENTES E CONTROLE DE CUSTOS (FINOPS)
CREATE TABLE agent_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  agent_id VARCHAR(20) NOT NULL REFERENCES agents(id),
  model_provider VARCHAR(50) NOT NULL DEFAULT 'google',
  model_name VARCHAR(100) NOT NULL DEFAULT 'gemini-2.5-flash',
  input_tokens INTEGER NOT NULL DEFAULT 0,
  output_tokens INTEGER NOT NULL DEFAULT 0,
  execution_time_ms INTEGER NOT NULL DEFAULT 0,
  cost_estimate NUMERIC(10, 6) NOT NULL DEFAULT 0.000000,
  status VARCHAR(30) NOT NULL, -- 'success', 'error', 'qa_rejected'
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 7. GOVERNANÇA HUMAN-IN-THE-LOOP (APROVAÇÕES)
CREATE TABLE approvals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  requested_by VARCHAR(20) NOT NULL REFERENCES agents(id),
  approval_type VARCHAR(50) NOT NULL, -- 'contract_recommendation', 'external_delivery', 'deploy', 'financial_decision'
  approval_status VARCHAR(20) NOT NULL DEFAULT 'pending', -- 'pending', 'approved', 'rejected'
  reviewer UUID,
  comments TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  decided_at TIMESTAMPTZ
);

-- 8. ARTEFATOS E ENTREGÁVEIS
CREATE TABLE artifacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  client_id UUID REFERENCES clients(id) ON DELETE SET NULL,
  artifact_type VARCHAR(50) NOT NULL, -- 'energy_diagnosis', 'contest_dossier', 'mv_report', 'commercial_proposal', 'swot'
  title VARCHAR(255) NOT NULL,
  summary TEXT,
  content_markdown TEXT NOT NULL,
  structured_data JSONB NOT NULL DEFAULT '{}'::jsonb,
  file_path TEXT,
  version VARCHAR(20) NOT NULL DEFAULT '1.0',
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 9. BASE REGULATÓRIA E TARIFÁRIA (KNOWLEDGE SOURCES)
CREATE TABLE knowledge_sources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_type VARCHAR(50) NOT NULL, -- 'aneel_resolution', 'distributor_tariff_table', 'tariff_flag', 'contract_template'
  source_name VARCHAR(255) NOT NULL,
  distributor VARCHAR(100),
  effective_from DATE,
  effective_until DATE,
  source_url TEXT,
  document_id VARCHAR(100),
  structured_content JSONB NOT NULL DEFAULT '{}'::jsonb,
  version VARCHAR(20) NOT NULL DEFAULT '1.0',
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ÍNDICES DE PERFORMANCE PARA O WORKER AUTÔNOMO
CREATE INDEX idx_tasks_status_priority ON tasks(status, priority);
CREATE INDEX idx_tasks_parent_id ON tasks(parent_task_id);
CREATE INDEX idx_approvals_status ON approvals(approval_status);
CREATE INDEX idx_agent_runs_created_at ON agent_runs(created_at);
CREATE INDEX idx_energy_bills_uc_period ON energy_bills(consumer_unit_id, billing_period);
```

---

## 3. CATÁLOGO COMPLETO DOS 11 AGENTES E SYSTEM PROMPTS (`supabase/seed.sql`)

O Antigravity deve popular a tabela `agents` com os 11 agentes abaixo. Todos os agentes devem retornar exclusivamente JSON válido obedecendo aos seus respectivos schemas:

### AG-001 — CEO / AI Orchestrator
* **Modelo Padrão:** `gemini-2.5-pro`
* **System Prompt:**
  ```text
  Você é o AI Orchestrator (AG-001) da Energy Intelligence. Sua responsabilidade é coordenar uma equipe de 10 agentes especializados (AG-002 a AG-011) para apoiar o fundador solo na criação, desenvolvimento, análise energética, comercialização e operação da startup.
  Regras:
  1. Interprete o objetivo do fundador e decomponha em tarefas atômicas e sequenciais.
  2. Atribua cada tarefa ao agente exato e defina as dependências (quais tarefas precisam terminar antes).
  3. Defina requires_approval = true para toda tarefa de Nível 2 (envio externo ao cliente, recomendação contratual, deploy em produção, compromisso financeiro).
  4. Nunca invente resultados. Quando todas as subtarefas terminarem, consolide um resumo executivo com evidências, riscos e recomendações.
  ```

### AG-002 — Business Strategy Agent
* **Modelo Padrão:** `gemini-2.5-pro`
* **System Prompt:**
  ```text
  Você é o Business Strategy Agent (AG-002) da Energy Intelligence. Sua função é inteligência de mercado, definição e refinamento do ICP (PMEs multiunidade, indústrias, condomínios, comercializadoras), análise de concorrentes, modelagem de negócios (SaaS, consultoria, white-label, success fee) e avaliação de oportunidades em Open Energy, Mercado Livre e Geração Cooperada.
  Sempre explicite hipóteses, fontes, riscos de mercado e métricas de validação.
  ```

### AG-003 — Energy Specialist Agent
* **Modelo Padrão:** `gemini-2.5-pro`
* **System Prompt:**
  ```text
  Você é o Especialista Técnico em Energia Elétrica e Inteligência Energética (AG-003) da Energy Intelligence.
  Seu objetivo é transformar dados extraídos de contas de energia, medições e contratos em diagnósticos precisos para redução de custos e eficiência operacional.
  REGRAS OBRIGATÓRIAS:
  1. Utilize SEMPRE os resultados numéricos fornecidos pela ferramenta determinística (energy-calculator). Nunca faça cálculos tarifários por aproximação ou chute.
  2. Diferencie claramente FATOS (dados medidos na fatura), HIPÓTESES e ESTIMATIVAS de potencial de economia.
  3. Proibido apresentar estimativas como "economia garantida" ou emitir laudo de engenharia sem flag requires_specialist_review = true.
  4. Analise: Demanda contratada vs medida (ultrapassagem e ociosidade), enquadramento Horossazonal (Verde vs Azul), fator de potência/energia reativa excedente (UFER/DMCR), geração distribuída e elegibilidade para o Mercado Livre (ACL).
  ```

### AG-004 — AI & Data Engineering Agent
* **Modelo Padrão:** `gemini-2.5-flash`
* **System Prompt:**
  ```text
  Você é o Engenheiro de Dados e IA (AG-004) da Energy Intelligence. Sua responsabilidade é estruturar dados brutos de faturas de energia, validar a integridade dos campos extraídos via OCR multimodal, detectar anomalias estatísticas de consumo, checar se a soma dos itens da fatura bate com o valor total cobrado e preparar datasets limpos para o AG-003 e AG-010.
  ```

### AG-005 — Software Development Agent
* **Modelo Padrão:** `gemini-2.5-pro`
* **System Prompt:**
  ```text
  Você é o Engenheiro de Software Sênior (AG-005) da Energy Intelligence. Sua responsabilidade é especificar arquiteturas, propor migrations SQL, criar componentes Next.js, desenvolver conectores de API e documentar alterações técnicas.
  Restrições: Nunca executar alterações estruturais em produção ou expor segredos sem aprovação explícita Nível 2 do fundador.
  ```

### AG-006 — Marketing & Growth Agent
* **Modelo Padrão:** `gemini-2.5-flash`
* **System Prompt:**
  ```text
  Você é o Especialista em Marketing B2B e Growth (AG-006) da Energy Intelligence. Sua função é criar posicionamento de autoridade no setor elétrico, produzir artigos técnicos, posts para LinkedIn, estrutura de landing pages de alta conversão para diagnóstico energético e campanhas de geração de demanda. Nunca prometa reduções irreais ou garantidas sem base técnica.
  ```

### AG-007 — Sales Agent
* **Modelo Padrão:** `gemini-2.5-flash`
* **System Prompt:**
  ```text
  Você é o Especialista Comercial B2B (AG-007) da Energy Intelligence. Sua função é qualificar leads dentro do ICP, preparar dossiês pré-reunião, redigir abordagens consultivas personalizadas, elaborar propostas comerciais e Cartas de Intenção (LOI) para pilotos.
  Restrições: Respeitar integralmente a LGPD, nunca enviar comunicações externas ou assumir compromissos de preço sem aprovação do fundador.
  ```

### AG-008 — Quality & Risk Agent (Auditor QA)
* **Modelo Padrão:** `gemini-2.5-pro`
* **System Prompt:**
  ```text
  Você é o Auditor de Qualidade, Conformidade e Risco (AG-008) da Energy Intelligence.
  Todo entregável produzido pelos agentes AG-002 a AG-011 passa obrigatoriamente pelo seu crivo antes de ir para o fundador.
  Critérios de reprovação imediata (approved = false):
  1. Presença de números financeiros ou energéticos sem memória de cálculo rastreável.
  2. Promessa de "economia garantida" sem ressalvas técnicas e contratuais.
  3. Falta de identificação de premissas (assumptions) e limitações (limitations).
  4. Violação de regras da ANEEL ou LGPD.
  Retorne um parecer rigoroso com lista de inconsistências, nível de criticidade e instruções exatas de correção.
  ```

### AG-009 — Regulatory & Tariff Intelligence Agent
* **Modelo Padrão:** `gemini-2.5-pro`
* **System Prompt:**
  ```text
  Você é o Especialista em Regulação do Setor Elétrico Brasileiro (AG-009). Você domina a Resolução Normativa ANEEL nº 1.000/2021, a Lei 14.300/2022 (Marco Legal da Geração Distribuída), regras de comercialização da CCEE (Mercado Livre) e estruturas tarifárias (TUSD/TE, bandeiras tarifárias, tolerância de 5% de ultrapassagem de demanda, cobrança em dobro de devolução de valores faturados a maior).
  Sua missão é fundamentar juridicamente e regulatoriamente os diagnósticos e dossiês de contestação de faturas.
  ```

### AG-010 — Customer Onboarding & M&V Agent
* **Modelo Padrão:** `gemini-2.5-flash`
* **System Prompt:**
  ```text
  Você é o Agente de Sucesso do Cliente e Medição & Verificação (AG-010). Sua responsabilidade é garantir que todas as unidades consumidoras tenham suas faturas coletadas mensalmente e comprovar matematicamente (usando a ferramenta mv-calculator) a economia real verificada após a implementação das recomendações da Energy Intelligence, gerando relatórios executivos de retenção e base para cobrança de success fee.
  ```

### AG-011 — Startup CFO & Unit Economics Agent
* **Modelo Padrão:** `gemini-2.5-flash`
* **System Prompt:**
  ```text
  Você é o CFO Digital e Especialista em Unit Economics (AG-011) da Energy Intelligence. Sua função é monitorar a saúde financeira da startup: calcular MRR, ARPA, CAC, LTV, Payback, margem bruta por cliente (descontando custos de tokens de IA registrados em agent_runs) e estruturar simulações de precificação (SaaS vs Implantação vs Success Fee).
  ```

---

## 4. FERRAMENTAS DETERMINÍSTICAS OBRIGATÓRIAS (CÓDIGO PURO SEM LLM)

O Antigravity deve implementar em `packages/agent-core/src/tools/` dois módulos matemáticos puros em TypeScript, totalmente testáveis e determinísticos:

### 4.1 Calculadora de Diagnóstico Tarifário (`energy-calculator.ts`)
Recebe os dados estruturados da fatura e as tarifas vigentes e executa as seguintes fórmulas exatas:

1. **Tolerância e Multa de Ultrapassagem de Demanda (Grupo A — REN 1.000/2021 ANEEL):**
   * Tolerância regulatória: $5\%$ acima da demanda contratada ($\text{Limite} = 1.05 \times D_{\text{contratada}}$).
   * Se $D_{\text{medida}} > 1.05 \times D_{\text{contratada}}$:
     $$\text{Demanda Ultrapassada (kW)} = D_{\text{medida}} - D_{\text{contratada}}$$
     $$\text{Multa de Ultrapassagem (R\$)} = (D_{\text{medida}} - D_{\text{contratada}}) \times 2 \times \text{Tarifa}_{\text{demanda}}$$
2. **Demanda Contratada Ociosa (Sobrecontratação):**
   * Se $D_{\text{medida}} < D_{\text{contratada}}$:
     $$\text{Demanda Ociosa (kW)} = D_{\text{contratada}} - D_{\text{medida}}$$
     $$\text{Desperdício Mensal Ociosidade (R\$)} = (D_{\text{contratada}} - \max(D_{\text{medida}}, 30)) \times \text{Tarifa}_{\text{demanda}}$$
3. **Fator de Carga ($FC$) e Energia Reativa Excedente (UFER / DMCR):**
   * Considerando $H = 730\text{ horas/mês}$:
     $$FC = \frac{\text{Consumo Total (kWh)}}{D_{\text{máxima medida (kW)}} \times 730}$$
   * Economia potencial por correção de fator de potência (bancos de capacitores):
     $$\text{Economia Anual Reativo (R\$)} = \text{Multa Reativo Mensal (R\$)} \times 12$$
4. **Comparativo de Enquadramento Horossazonal (Tarifa Verde vs. Tarifa Azul):**
   * Custo Anual Projetado na **Modalidade Verde**:
     $$C_{\text{Verde}} = (D_{\text{única}} \times T_{\text{dem\_verde}}) + (\text{Cons}_{\text{ponta}} \times T_{\text{cons\_ponta\_verde}}) + (\text{Cons}_{\text{fora\_ponta}} \times T_{\text{cons\_fp\_verde}})$$
   * Custo Anual Projetado na **Modalidade Azul**:
     $$C_{\text{Azul}} = (D_{\text{ponta}} \times T_{\text{dem\_ponta\_azul}}) + (D_{\text{fora\_ponta}} \times T_{\text{dem\_fp\_azul}}) + (\text{Cons}_{\text{ponta}} \times T_{\text{cons\_ponta\_azul}}) + (\text{Cons}_{\text{fora\_ponta}} \times T_{\text{cons\_fp\_azul}})$$
   * O módulo retorna qual modalidade é mais econômica e a diferença exata em $\text{R\$/mês}$ e $\text{R\$/ano}$.

### 4.2 Calculadora de Medição e Verificação (`mv-calculator.ts`)
Calcula a economia real gerada para o cliente comparando o cenário base (antes da consultoria) com a fatura atual:
$$\text{Custo Evitado (R\$)} = \text{Custo Simulado na Condição Antiga (Tarifa Atual)} - \text{Custo Real Faturado Atual}$$
$$\text{Success Fee Devido (R\$)} = \max(0, \text{Custo Evitado (R\$)} \times \frac{\text{Percentual Success Fee}}{100})$$

---

## 5. MOTOR DE ORQUESTRAÇÃO AUTÔNOMA E OS 8 WORKFLOWS

### 5.1 Funcionamento do Autonomous Background Worker (`engine/worker.ts`)
O servidor `agent-core` mantém um loop assíncrono contínuo (intervalo configurável, padrão `5000ms`) que opera sem intervenção humana:

```text
[Loop a cada 5s]
   │
   ├─► 1. Busca no Supabase tarefas com status = 'pending'
   │      cujas tasks em `dependencies[]` já estejam 'completed'.
   │
   ├─► 2. Verifica no Policy Engine se o agente possui orçamento diário disponível.
   │
   ├─► 3. Atualiza status para 'running' e started_at = NOW().
   │
   ├─► 4. Se a tarefa exigir Tool Determinística (AG-003 ou AG-010),
   │      executa o cálculo em TypeScript puro primeiro e anexa ao contexto.
   │
   ├─► 5. Invoca a Gemini API com Structured Outputs (Schema Zod do Agente)
   │      e grava tokens, tempo e custo em `agent_runs`.
   │
   ├─► 6. Move a tarefa para status = 'review' e aciona automaticamente o AG-008 (QA Gate).
   │      ├─► Se AG-008 REPROVAR e retry_count < max_retries:
   │      │   Incrementa retry_count, anexa feedback do QA e volta status para 'pending'.
   │      └─► Se AG-008 APROVAR:
   │          ├─► Se requires_approval == true (Nível 2):
   │          │   Muda status para 'waiting_input', cria registro em `approvals`
   │          │   e dispara webhook para o n8n avisar o fundador.
   │          └─► Se requires_approval == false (Nível 0 ou 1):
   │              Salva entregável em `artifacts`, marca status = 'completed'
   │              e destrava automaticamente as próximas tarefas dependentes!
```

### 5.2 Catálogo dos 8 Workflows Automatizados (`engine/workflow-runner.ts`)

1. **WF-001 — Planejamento Estratégico e Técnico de Projeto**
   * **Trigger:** Fundador insere novo objetivo macro no Command Center.
   * **Cadeia Automática:** `AG-001` decompõe $\rightarrow$ `AG-002` analisa viabilidade de mercado e ICP $\rightarrow$ `AG-011` modela unit economics $\rightarrow$ `AG-005` propõe arquitetura técnica $\rightarrow$ `AG-004` define pipeline de dados $\rightarrow$ `AG-008` audita o plano consolidado $\rightarrow$ Pausa para aprovação Nível 2 do Fundador.
2. **WF-002 — Desenvolvimento Assistido de Funcionalidade**
   * **Trigger:** Tarefa técnica aprovada no backlog.
   * **Cadeia Automática:** `AG-005` gera especificação de código, schema SQL e testes $\rightarrow$ `AG-008` revisa segurança e conformidade arquitetural $\rightarrow$ Solicita aprovação do Fundador para deploy/merge.
3. **WF-003 — Diagnóstico Energético Automatizado (Core Product)**
   * **Trigger:** Upload de fatura de energia (PDF/Imagem) na UI ou via Webhook.
   * **Cadeia Automática:** Arquivo salvo no Supabase Storage $\rightarrow$ `bill-parser.ts` extrai dados estruturados via Gemini Multimodal $\rightarrow$ `AG-004` valida consistência matemática dos itens da conta $\rightarrow$ `energy-calculator.ts` executa os cálculos determinísticos $\rightarrow$ `AG-003` gera diagnóstico executivo com achados, oportunidades, premissas e limitações $\rightarrow$ `AG-008` audita o relatório $\rightarrow$ Gera entregável em `artifacts` $\rightarrow$ Solicita aprovação do Fundador antes de liberar para o cliente.
4. **WF-004 — Máquina de Campanha Comercial e Geração de Demanda**
   * **Trigger:** Fundador solicita campanha para um segmento específico (ex: redes de supermercados).
   * **Cadeia Automática:** `AG-002` refina dores do ICP $\rightarrow$ `AG-007` cria script de prospecção e estrutura de proposta $\rightarrow$ `AG-006` cria copy de landing page e sequência de e-mails/LinkedIn $\rightarrow$ `AG-008` valida conformidade LGPD e ausência de promessas enganosas $\rightarrow$ Aguarda aprovação do Fundador para publicação/disparo via n8n.
5. **WF-005 — Discovery de Clientes & Geração de Carta de Intenção (Fase 0)**
   * **Trigger:** Fundador envia anotações de entrevista com potencial cliente/parceiro.
   * **Cadeia Automática:** `AG-002` extrai dores, objeções e métricas de sucesso $\rightarrow$ `AG-011` sugere modelo de cobrança do piloto $\rightarrow$ `AG-007` gera minuta de Carta de Intenção (LOI) personalizada $\rightarrow$ `AG-008` revisa $\rightarrow$ Aprovação do Fundador.
6. **WF-006 — Ingestão Zero-Touch de Faturas (n8n Webhook)**
   * **Trigger:** E-mail recebido em `faturas@dominio` ou mensagem via WhatsApp no n8n.
   * **Cadeia Automática:** n8n extrai o anexo PDF e envia para `POST /api/v1/webhooks/bill-upload` $\rightarrow$ Sistema identifica a Unidade Consumidora pelo código da instalação/CNPJ $\rightarrow$ Dispara o `WF-003` automaticamente sem ação manual.
7. **WF-007 — Dossiê de Contestação e Restituição Tarifária (REN 1.000/2021)**
   * **Trigger:** `AG-003` detecta cobrança indevida na fatura (impostos, tarifa errada ou faturamento incorreto).
   * **Cadeia Automática:** `AG-009` fundamenta o erro citando os artigos aplicáveis da REN 1.000/2021 da ANEEL e calcula o valor de devolução (inclusive em dobro, quando cabível) $\rightarrow$ `AG-008` audita o dossiê $\rightarrow$ Gera petição administrativa pronta para revisão humana.
8. **WF-008 — Fechamento Mensal de Economia Verificada (M&V e Cobrança)**
   * **Trigger:** Agendamento mensal (ou botão na tela de Clientes).
   * **Cadeia Automática:** `mv-calculator.ts` cruza a fatura atual com a baseline da unidade $\rightarrow$ `AG-010` redige o Relatório Mensal de Economia Verificada $\rightarrow$ `AG-011` calcula o valor de *Success Fee* e mensalidade SaaS devidos pelo cliente $\rightarrow$ `AG-008` audita $\rightarrow$ Aprovação do Fundador para envio ao cliente.

---

## 6. CONTRATO DE API REST (`packages/agent-core`)

O serviço `agent-core` (porta `4000`) deve expor os seguintes endpoints consumidos pelo Next.js e pelo n8n:

* `POST /api/v1/objectives`
  * **Body:** `{ objective: string, priority: 'P0'|'P1'|'P2'|'P3', client_id?: string, workflow_code?: string }`
  * **Ação:** Aciona o `AG-001` para criar a tarefa-mãe e decompor as subtarefas no banco.
* `POST /api/v1/energy/upload-bill`
  * **Body:** `multipart/form-data` (`file`, `consumer_unit_id`)
  * **Ação:** Salva o PDF no Storage, executa extração multimodal, roda `energy-calculator.ts` e inicia o `WF-003`.
* `POST /api/v1/approvals/:id/decide`
  * **Body:** `{ decision: 'approved' | 'rejected', comments?: string }`
  * **Ação:** Registra a decisão humana do fundador. Se `approved`, muda a task para `completed` e destrava as tarefas filhas dependentes. Se `rejected`, recoloca a task em `pending` com os comentários do fundador para que o agente refaça o trabalho.
* `POST /api/v1/worker/trigger`
  * **Ação:** Força um ciclo imediato de execução do Worker autônomo.
* `GET /api/v1/metrics/finops`
  * **Ação:** Retorna os 7 indicadores operacionais consolidados (Taxa de conclusão, Taxa de retrabalho QA, Custo por tarefa, Tempo médio, Taxa de aprovação, Erros por agente, Custo por entregável).

---

## 7. ESPECIFICAÇÃO DETALHADA DAS TELAS (NEXT.JS COCKPIT HUMANO)

Construa em `packages/web-ui` uma interface moderna em **Dark Mode Executivo** (`slate-950` / `emerald-500` para acentos de energia), com barra lateral fixa e atualização em tempo real via Supabase Realtime:

### 7.1 Barra de Topo Global (Topbar Status)
* Indicador luminoso **Autonomous Worker Status**: `ONLINE (Polling every 5s)`.
* Contador de **Aprovações Pendentes (Nível 2)** com badge vermelho clicável.
* Mostrador de **Gasto de IA Hoje / Mês** (`$0.42 / $15.00`) e botão de pausa de emergência (*Kill Switch* do Worker).

### 7.2 As 8 Telas Obrigatórias da Aplicação
1. **Command Center (`/`)**:
   * Caixa de comando central para digitar objetivos em linguagem natural ou selecionar um Workflow rápido (`WF-001` a `WF-008`).
   * 4 KPIs no topo: Tarefas Ativas, Aguardando Aprovação Humana, Economia Identificada (R$), Custo Operacional de IA (US$).
   * **Live Agent Stream:** Timeline em tempo real exibindo cada passo que os agentes estão executando nos bastidores.
2. **Central de Aprovações Human-in-the-Loop (`/approvals`)**:
   * Lista de todas as decisões de Nível 2 aguardando o fundador.
   * **Visualizador Split-Screen:** Do lado esquerdo, o entregável formatado produzido pelo agente especialista; do lado direito, o card de auditoria do `AG-008 (QA Agent)` listando se as premissas estão claras, grau de confiança e riscos.
   * Botões: **[Aprovar e Prosseguir]** | **[Rejeitar com Instruções de Ajuste]**.
3. **Auditoria de Faturas & Inteligência Energética (`/energy`)**:
   * Seletor de Cliente e Unidade Consumidora + **Dropzone de PDF/Imagem de Fatura**.
   * Cards de diagnóstico automático gerados pelo `energy-calculator.ts`: Demanda Contratada vs. Medida (com barra de limite de 105%), Multas de Ultrapassagem e Reativo, Comparativo Tarifa Verde vs. Azul e Economia Mensal/Anual Estimada.
   * Botão direto para disparar o **Dossiê de Contestação ANEEL (`WF-007`)** ou o **Relatório de M&V (`WF-008`)**.
4. **Quadro de Orquestração e Tarefas (`/tasks`)**:
   * Visão em Árvore (Objetivo Pai $\rightarrow$ Subtarefas Filhas) e visão Kanban (`Pending`, `Running`, `QA Review`, `Waiting Human Approval`, `Completed`).
   * Ao clicar em uma tarefa, abre um modal mostrando o JSON do *Task Envelope*, o input enviado, o output bruto e os tokens consumidos.
5. **Gestão de Clientes, Unidades e Pilotos (`/clients`)**:
   * Cadastro rápido de Clientes (Leads, Pilotos Fase 0, Clientes Ativos SaaS) e suas Unidades Consumidoras (UC, Distribuidora, Subgrupo A4/A3a/B3, Demanda Contratada).
6. **Repositório de Artefatos e Entregáveis (`/artifacts`)**:
   * Galeria de todos os documentos produzidos pelos agentes (Diagnósticos Energéticos, Análises SWOT, Cartas de Intenção, Dossiês ANEEL, Propostas Comerciais).
   * Leitor Markdown rico integrado com botão para exportar em PDF/HTML ou copiar conteúdo.
7. **Catálogo de Agentes e Editor de Prompts (`/agents`)**:
   * Cards para cada um dos 11 agentes (`AG-001` a `AG-011`).
   * Permite ao fundador editar o `system_prompt`, ajustar a temperatura, escolher o modelo (`gemini-2.5-flash` ou `gemini-2.5-pro`), alterar o limite diário de gastos em dólares e ativar/desativar o agente sem precisar alterar código.
8. **Observabilidade e FinOps (`/finops`)**:
   * Painel completo com os 7 indicadores operacionais da Seção 13 da arquitetura, gráficos de consumo de tokens por agente e histórico auditável da tabela `agent_runs`.

---

## 8. INFRAESTRUTURA DOCKER PARA VPS HOSTINGER (`docker/docker-compose.yml`)

O arquivo `docker/docker-compose.yml` deve orquestrar todos os serviços prontos para deploy na VPS:

```yaml
version: '3.8'

services:
  traefik:
    image: traefik:v3.0
    container_name: ei-traefik
    restart: always
    command:
      - "--api.insecure=false"
      - "--providers.docker=true"
      - "--providers.docker.exposedbydefault=false"
      - "--entrypoints.web.address=:80"
      - "--entrypoints.websecure.address=:443"
      - "--certificatesresolvers.letsencrypt.acme.tlschallenge=true"
      - "--certificatesresolvers.letsencrypt.acme.email=${ACME_EMAIL}"
      - "--certificatesresolvers.letsencrypt.acme.storage=/letsencrypt/acme.json"
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - "/var/run/docker.sock:/var/run/docker.sock:ro"
      - "traefik_certs:/letsencrypt"
    networks:
      - ei-network

  agent-core:
    build:
      context: ..
      dockerfile: packages/agent-core/Dockerfile
    container_name: ei-agent-core
    restart: always
    environment:
      - NODE_ENV=production
      - PORT=4000
      - GEMINI_API_KEY=${GEMINI_API_KEY}
      - SUPABASE_URL=${SUPABASE_URL}
      - SUPABASE_SERVICE_ROLE_KEY=${SUPABASE_SERVICE_ROLE_KEY}
      - N8N_WEBHOOK_URL=http://n8n:5678/webhook
      - WORKER_POLL_INTERVAL_MS=5000
    ports:
      - "127.0.0.1:4000:4000"
    networks:
      - ei-network

  web-ui:
    build:
      context: ..
      dockerfile: packages/web-ui/Dockerfile
    container_name: ei-web-ui
    restart: always
    environment:
      - NODE_ENV=production
      - NEXT_PUBLIC_SUPABASE_URL=${SUPABASE_URL}
      - NEXT_PUBLIC_SUPABASE_ANON_KEY=${SUPABASE_ANON_KEY}
      - NEXT_PUBLIC_AGENT_CORE_URL=https://api.${DOMAIN}
    labels:
      - "traefik.enable=true"
      - "traefik.http.routers.webui.rule=Host(`app.${DOMAIN}`)"
      - "traefik.http.routers.webui.entrypoints=websecure"
      - "traefik.http.routers.webui.tls.certresolver=letsencrypt"
      - "traefik.http.services.webui.loadbalancer.server.port=3000"
    depends_on:
      - agent-core
    networks:
      - ei-network

  n8n:
    image: docker.n8n.io/n8nio/n8n:latest
    container_name: ei-n8n
    restart: always
    environment:
      - N8N_HOST=n8n.${DOMAIN}
      - N8N_PORT=5678
      - N8N_PROTOCOL=https
      - WEBHOOK_URL=https://n8n.${DOMAIN}/
      - GENERIC_TIMEZONE=America/Sao_Paulo
    volumes:
      - n8n_data:/home/node/.n8n
    labels:
      - "traefik.enable=true"
      - "traefik.http.routers.n8n.rule=Host(`n8n.${DOMAIN}`)"
      - "traefik.http.routers.n8n.entrypoints=websecure"
      - "traefik.http.routers.n8n.tls.certresolver=letsencrypt"
    networks:
      - ei-network

volumes:
  traefik_certs:
  n8n_data:

networks:
  ei-network:
    driver: bridge
```

---

## 9. ROTEIRO DE EXECUÇÃO SEQUENCIAL PARA O ANTIGRAVITY (SPRINTS 0 A 5)

Para construir a plataforma sem erros de dependência, execute as etapas abaixo em sequência:

### Etapa 1 (Sprint 0 — Fundação, Banco e Tipos Compartilhados)
1. Crie a estrutura de diretórios do monorepo (`package.json` raiz, `tsconfig.base.json`, `.env.example` e `docker/docker-compose.yml`).
2. Crie os arquivos SQL em `supabase/migrations/0001_core_schema.sql`, `0002_rls_and_triggers.sql` e `supabase/seed.sql` contendo os 11 agentes (`AG-001` a `AG-011`), um cliente piloto de exemplo e uma tabela tarifária base.
3. Implemente o pacote `packages/shared` com todas as enumerações e os Schemas Zod (`TaskEnvelopeSchema`, `OrchestratorPlanSchema`, `EnergyBillExtractionSchema`, `QAReviewSchema`).

### Etapa 2 (Sprint 1 & 2 — Ferramentas Determinísticas e Motor `agent-core`)
1. Implemente `energy-calculator.ts` e `mv-calculator.ts` com todas as fórmulas matemáticas de demanda, fator de carga, energia reativa, comparativo Verde vs. Azul e M&V.
2. Implemente o wrapper da Gemini API (`config/gemini.ts`) que calcula automaticamente o custo de cada chamada com base nos tokens consumidos e grava na tabela `agent_runs`.
3. Implemente o `orchestrator.ts` (`AG-001`), o `qa-gate.ts` (`AG-008`), o `policy-engine.ts` (travas Nível 0, 1 e 2) e os executores dos agentes `AG-002` a `AG-011`.
4. Implemente o `worker.ts` (loop autônomo em background) e o servidor HTTP Fastify/Express com todas as rotas da Seção 6.

### Etapa 3 (Sprint 3 & 4 — Cockpit Humano em Next.js e Workflows)
1. Inicialize `packages/web-ui` com Tailwind CSS, Shadcn/UI e layout executivo em Dark Mode.
2. Construa as 8 páginas completas (`/`, `/approvals`, `/energy`, `/tasks`, `/clients`, `/artifacts`, `/agents`, `/finops`) conectadas aos endpoints do `agent-core` e ao Supabase.
3. Crie os templates JSON de integração do n8n na pasta `workflows/n8n/` e os scripts `Dockerfile` de produção.

### Etapa 4 (Sprint 5 — Testes Automatizados e Validação End-to-End)
1. Crie testes unitários validando a calculadora determinística (`energy-calculator.test.ts`) e as travas do Policy Engine.
2. Verifique a compilação completa do monorepo (`npm run build`) garantindo tipagem TypeScript limpa em todos os pacotes.