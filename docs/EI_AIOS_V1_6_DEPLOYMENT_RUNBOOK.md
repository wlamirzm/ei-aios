# EI-AIOS — RUNBOOK DE DEPLOY v1.6
## Procedimento Operacional Padrão (SOP) para Implantação Controlada da Release v1.6

**Projeto:** Energy Intelligence AIOS (EI-AIOS)  
**Ambiente Alvo:** Produção (VPS Hostinger / Docker Swarm / Supabase)  
**Versão Alvo:** `v1.6-sprint6-complete`  
**Data:** 08/11/2026  
**Status:** PRONTO PARA EXECUÇÃO QUANDO AUTORIZADO (Bloqueado no momento)

---

## 1. PRÉ-REQUISITOS E CHECKLIST DE PRÉ-DEPLOY

- [ ] Autorização expressa formal do Founder / Operador Técnico.
- [ ] Confirmação de que a suíte global passou com 123/123 testes em staging/local.
- [ ] Backup do banco de dados de produção gerado no painel do Supabase.
- [ ] Acesso SSH ativo à VPS Hostinger (`hostinger-vps`).
- [ ] Docker Swarm com todos os nós em estado `Ready` e serviços `Healthy`.

---

## 2. ETAPAS DE IMPLANTAÇÃO PASSO A PASSO

### Passo 1: Criação da Tag Git da Release
Na máquina de desenvolvimento:
```bash
git checkout feat/sprint-6-finops-ledger
git tag -a v1.6-sprint6-complete -m "Release v1.6: Sovereign FinOps Ledger & Real Revenue Engine"
git push origin v1.6-sprint6-complete
```

### Passo 2: Execução das Migrations 0008 a 0011 no Supabase
1. Conectar ao painel do Supabase PostgreSQL de Produção.
2. Executar o bloco de migrations sequenciais 0008, 0009, 0010 e 0011 conforme estabelecido no [`docs/EI_AIOS_V1_6_MIGRATION_PLAN.md`](file:///c:/_dev/ei-aios/docs/EI_AIOS_V1_6_MIGRATION_PLAN.md).
3. Executar as queries de validação de schema.

### Passo 3: Build das Imagens Docker
No runner de CI/CD ou máquina de build:
```bash
docker build -t ghcr.io/wlamirzm/ei-aios-agent-core:v1.6 -f docker/Dockerfile.agent-core .
docker build -t ghcr.io/wlamirzm/ei-aios-worker:v1.6 -f docker/Dockerfile.worker .
docker build -t ghcr.io/wlamirzm/ei-aios-web:v1.6 -f docker/Dockerfile.web .

docker push ghcr.io/wlamirzm/ei-aios-agent-core:v1.6
docker push ghcr.io/wlamirzm/ei-aios-worker:v1.6
docker push ghcr.io/wlamirzm/ei-aios-web:v1.6
```

### Passo 4: Atualização dos Serviços no Docker Swarm (Zero Downtime)
Conectar via SSH na VPS Hostinger:
```bash
# 1. Atualiza agent-core
docker service update \
  --image ghcr.io/wlamirzm/ei-aios-agent-core:v1.6 \
  --update-order start-first \
  --update-failure-action rollback \
  ei-aios_agent-core

# 2. Atualiza worker autônomo
docker service update \
  --image ghcr.io/wlamirzm/ei-aios-worker:v1.6 \
  --update-order start-first \
  --update-failure-action rollback \
  ei-aios_worker

# 3. Atualiza interface web
docker service update \
  --image ghcr.io/wlamirzm/ei-aios-web:v1.6 \
  --update-order start-first \
  --update-failure-action rollback \
  ei-aios_web
```

---

## 3. SMOKE TESTS & VALIDAÇÃO PÓS-DEPLOY

Executar os seguintes testes de sanidade imediatamente após a atualização dos serviços:

1. **Health Check da API:**
   ```bash
   curl -f http://localhost:4000/api/v1/health
   # Resposta esperada: {"status":"healthy"}
   ```
2. **Endpoint de FinOps Overview:**
   ```bash
   curl -f -H "X-EI-Admin-Token: <FOUNDER_TOKEN>" http://localhost:4000/api/v1/finops/dashboard/overview?competence=2026-11
   # Resposta esperada: JSON estruturado com status measured/incomplete e ausência de fallback 1490.
   ```
3. **Endpoint de Cost & Usage:**
   ```bash
   curl -f -H "X-EI-Admin-Token: <FOUNDER_TOKEN>" http://localhost:4000/api/v1/finops/dashboard/cost-usage
   # Resposta esperada: Lista paginada e breakdowns contábeis.
   ```
4. **Verificação dos Logs dos Containers:**
   ```bash
   docker service logs --tail 50 ei-aios_agent-core
   docker service logs --tail 50 ei-aios_worker
   ```
   *Critério de Sucesso:* Ausência de erros `Cannot connect to database`, `Unknown column` ou `FATAL`.

---

## 4. CRITÉRIOS DE ABORTO IMEDIATO

Abortar imediatamente a implantação e disparar o plano de rollback caso:
1. O serviço `agent-core` ou `worker` entre em crash loop (`Restarting (1)`).
2. O healthcheck HTTP falhe por mais de 3 tentativas consecutivas.
3. Ocorram erros de chave estrangeira violada ou regressão em tarefas ativas.
