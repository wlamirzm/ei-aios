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

