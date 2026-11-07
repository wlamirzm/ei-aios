### PROJETO ei-aios

Como usar este documento agora no Google Antigravity
Crie uma pasta limpa no seu computador chamada ei-aios e abra-a no Google Antigravity.

Salve o documento gerado acima com o nome MASTER_BLUEPRINT_EI_AIOS.md na raiz dessa pasta.

No chat do Antigravity, envie exatamente este comando inicial:

"Leia integralmente o arquivo MASTER_BLUEPRINT_EI_AIOS.md. Vamos começar a implementação pela Etapa 1 (Sprint 0) e Etapa 2 (Sprints 1 e 2): crie todos os arquivos de configuração do monorepo, as migrations SQL e o seed com os 11 agentes, o pacote shared com os schemas Zod e o pacote agent-core completo com as calculadoras determinísticas (energy-calculator.ts e mv-calculator.ts) e o Worker autônomo."

Assim que o Antigravity concluir o backend dos agentes, envie o segundo comando:

"Agora execute a Etapa 3 (Sprints 3 e 4) e a Etapa 4 (Sprint 5) do MASTER_BLUEPRINT_EI_AIOS.md: construa a aplicação completa packages/web-ui em Next.js com todas as 8 telas operacionais, configure os Dockerfiles e rode o build de verificação."

## CLOUDFLARE CONFIG (REDACTED FOR SECURITY)
Consulte seu arquivo .env local para os tokens de API e credenciais R2.


Resumo da Sessão e Como Começar com os Agentes

A infraestrutura completa do EI-AIOS está implantada e conectada na VPS da Hostinger com CI/CD ativo no GitHub.

Como Começar uma Atividade com os Agentes

Você tem 3 formas práticas de acionar e interagir com os 11 agentes:

1. Pelo Cockpit Web UI (Navegador)
Acesse: https://app.eiaios.atendezen.com.br
Conversa Direta no Catálogo de Agentes (/agents):
No menu lateral, acesse Agentes.
Clique em "Conversar" em qualquer um dos 11 agentes (ex: AG-001: AI Orchestrator, AG-003: Energy Audit, AG-002: Business Strategy).
Uma gaveta lateral interativa se abre para você enviar mensagens diretamente em tempo real.
Criação de Tarefas e Workflows (/tasks):
Acesse Tarefas e clique em "+ Nova Tarefa".
Defina o objetivo de negócio (ex: "Auditar faturas da distribuidora e buscar créditos tributários").
O AG-001 (CEO / Orchestrator) recebe a missão, decompõe em subtarefas e aciona os agentes especialistas em cadeia.
Auditoria de Faturas (/energy):
Envie um arquivo de fatura de energia (PDF ou dados brutos).
O AG-003 executa a calculadora determinística de ultrapassagem de demanda, reativo e enquadramento tarifário (Verde vs. Azul) gerando o diagnóstico.
2. Via API REST do Agent Core

A API responde diretamente em: https://api.eiaios.atendezen.com.br

Chat direto via HTTP:
bash
curl -X POST https://api.eiaios.atendezen.com.br/api/v1/agents/AG-001/chat \
  -H "Content-Type: application/json" \
  -d '{"message": "Olá AG-001, qual é a nossa prioridade estratégica hoje?"}'
Disparo de Workflow Orquestrado:
bash
curl -X POST https://api.eiaios.atendezen.com.br/api/v1/workflows/dispatch \
  -H "Content-Type: application/json" \
  -d '{
    "workflowCode": "WF-001",
    "objective": "Auditoria de fatura A4",
    "payload": { "distributor": "CPFL Paulista", "group": "A4" }
  }'

3. Automação Contínua (Worker Autônomo e n8n)
O Autonomous Worker roda em segundo plano a cada 5 segundos na VPS, verificando novas tarefas pendentes e executando-as sequencialmente.
Automações externas e webhooks de faturas estão configurados no n8n: https://n8n.eiaios.atendezen.com.br
.

Endereços Ativos
Cockpit Web UI: 
https://app.eiaios.atendezen.com.br
Agent Core API: 
https://api.eiaios.atendezen.com.br (Status: /health)
n8n Automações: 
https://n8n.eiaios.atendezen.com.br
Repositório GitHub: 
https://github.com/wlamirzm/ei-aios


## 1. Diagnóstico de Verificação do Sistema (Ao Vivo)
	Componente	Status	Endereço / Detalhe
	Catálogo de Agentes	✅ Operacional	Todos os 11 agentes (AG-001 a AG-011) ativos
	Motor de Agentes & Worker	✅ Saudável	api.eiaios.atendezen.com.br/health
	 (Polling autônomo ativo a cada 5s)
	Banco de Dados Relacional	✅ Limpo (Zero KM)	0 clientes mock, 0 tarefas pendentes, pronto para início
	API de Chat com Agentes	✅ Respondendo	/api/v1/agents/:id/chat com cálculo de tokens e custo em USD
	Web Cockpit (Frontend)	✅ Online	app.eiaios.atendezen.com.br

	Automações n8n	✅ Ativo	n8n.eiaios.atendezen.com.br

	CI/CD GitHub Actions	✅ Ativo	Commits na branch main executam testes e deploy automático


## 2. Tutorial: Como Começar a Interagir com os Agentes

	Você tem 3 formas de trabalhar com os agentes, dependendo do seu objetivo no momento:

	Método 1: Pelo Cockpit Web (Recomendado para Conversas e Gestão Visual)

	Abra o Catálogo de Agentes:

	Acesse app.eiaios.atendezen.com.br/agents
	.
	Você verá os cards com cada um dos 11 agentes, seus modelos de IA (gemini-2.5-pro ou gemini-2.5-flash), orçamentos e permissões.

	Converse Diretamente com Qualquer Agente:

	No card do agente desejado, clique no botão azul "Conversar com o Agente" (ex: no AG-001 para estratégia geral ou no AG-003 para engenharia técnica).
	Uma gaveta lateral (Drawer) abrirá com o histórico da conversa.
	Digite sua mensagem (ex: "Olá AG-001, quero planejar a prospecção de condomínios comerciais em Campinas sob a área da CPFL Paulista").
	O agente responderá aplicando estritamente as diretrizes do seu cargo, citando normas regulatórias e exibindo a quantidade de tokens consumidos e o custo em USD.

	Submeta um Objetivo para Decomposição Automática:

	Acesse app.eiaios.atendezen.com.br/tasks
	.
	O AG-001 (CEO / Orchestrator) pode quebrar um objetivo macro em tarefas sequenciais distribuídas para os outros agentes executarem autonomamente.

	Audite Contas de Energia com o Especialista:

	Acesse app.eiaios.atendezen.com.br/energy
	.
	Faça o upload de uma conta de energia em PDF ou imagem (ou preencha os dados de medição).
	O AG-003 (Energy Specialist) e os motores matemáticos calcularão ultrapassagem de demanda com tolerância de 5%, excedente de reativos (UFER/DMCR), enquadramento Verde vs Azul e bandeiras tarifárias da ANEEL.

	Aprovação de Ações Críticas (Nível 2):

	Acesse app.eiaios.atendezen.com.br/approvals
	.
	Tarefas que envolvem envio de proposta externa, compromisso financeiro ou recomendação contratual só são executadas após o seu "Aprovar" nesta tela (Human-in-the-Loop).
	Método 2: Via Terminal ou Chamada de API REST

	Se você preferir conversar via script, terminal (cURL, Python, Node.js) ou WhatsApp/Telegram integrados:

	Exemplo: Conversar com o AG-001 (CEO / AI Orchestrator):

	bash
	curl -X POST https://api.eiaios.atendezen.com.br/api/v1/agents/AG-001/chat \
	  -H "Content-Type: application/json" \
	  -d '{
		"message": "Qual deve ser nosso primeiro passo para validar o MVP com 5 clientes piloto de PMEs?"
	  }'

	Exemplo: Consultar o Especialista Técnico em Energia (AG-003):

	bash
	curl -X POST https://api.eiaios.atendezen.com.br/api/v1/agents/AG-003/chat \
	  -H "Content-Type: application/json" \
	  -d '{
		"message": "Qual é a regra da ANEEL REN 1.000/2021 sobre a margem de tolerância para faturamento de ultrapassagem de demanda no Grupo A?"
	  }'

	Exemplo: Criar um Objetivo de Decomposição:

	bash
	curl -X POST https://api.eiaios.atendezen.com.br/api/v1/objectives \
	  -H "Content-Type: application/json" \
	  -d '{
		"title": "Onboarding do Primeiro Cliente Piloto de Supermercado",
		"description": "Coletar as últimas 3 contas de luz, auditar demanda e emitir relatório de potencial de economia.",
		"priority": "P0"
	  }'
	Método 3: Automação Contínua com n8n

	Para agendar fluxos diários ou capturar leads de formulários:

	Acesse n8n.eiaios.atendezen.com.br
	.
	Você pode criar gatilhos (como recebimento de e-mail com fatura em anexo) e disparar chamadas HTTP para https://api.eiaios.atendezen.com.br/api/v1/bills/audit-upload ou /api/v1/agents/:id/chat.

## 3. Guia Rápido dos 11 Agentes Disponíveis
	ID	Nome	Quando Chamar
	AG-001	CEO / AI Orchestrator	Para planejar metas gerais, delegar demandas e consolidar resultados executivos.
	AG-002	Business Strategy Agent	Para inteligência de mercado, definição de ICP (supermercados, indústrias, condomínios) e modelagem de receita.
	AG-003	Energy Specialist Agent	Para auditoria técnica de faturas do Grupo A/B, horossazonal (Verde/Azul), demanda e reativos.
	AG-004	AI & Data Engineering Agent	Para estruturação e validação matemática de dados extraídos de contas e relatórios.
	AG-005	Software Development Agent	Para arquitetura de software, automações, APIs e integrações do sistema.
	AG-006	Marketing & Growth Agent	Para geração de conteúdo B2B, posicionamento de autoridade no setor elétrico e copywriting.
	AG-007	Sales Agent	Para estruturação de cadências de prospecção, qualificação B2B e scripts de vendas.
	AG-008	Quality & Risk Agent (QA)	Para auditar relatórios antes de entregar ao cliente (elimina alucinações e confere memória de cálculo).
	AG-009	Regulatory Intelligence Agent	Para fundamentar petições e contestações segundo a REN 1.000/2021 e Lei 14.300/2022 da ANEEL.
	AG-010	Customer Onboarding & M&V Agent	Para Medição e Verificação (M&V) de economia comprovada e suporte à cobrança de success fee.
	AG-011	Startup CFO & Unit Economics	Para acompanhar custos de tokens de IA, CAC, LTV, MRR e saúde financeira do negócio.

## TIP

Caso queira limpar o banco novamente no futuro e voltar a este estado inicial limpo, basta clicar no botão vermelho "Zerar Dados de Demonstração" no canto superior direito de app.eiaios.atendezen.com.br/agents
 ou disparar POST https://api.eiaios.atendezen.com.br/api/v1/system/clean-database.