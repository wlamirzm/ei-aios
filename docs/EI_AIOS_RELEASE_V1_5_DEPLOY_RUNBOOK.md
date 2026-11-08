# EI-AIOS — RUNBOOK OPERACIONAL DE DEPLOY (RELEASE v1.5)
## Reliability, Concurrency Governance & Zero-Downtime Migration

**Alvo:** VPS Hostinger (`187.77.49.211`) — Docker Swarm Stack `ei-aios`  
**Ambiente:** Produção Sovereign (`https://api.eiaios.atendezen.com.br` e `https://app.eiaios.atendezen.com.br`)  
**Versão:** Release `v1.5-sprint5-complete`  
**Data:** 08/11/2026

---

## 1. Pré-Requisitos e Checagens Iniciais (Checklist Pré-Deploy)

Antes de iniciar os comandos de publicação, o Engenheiro de Release deve confirmar:
- [ ] O relatório `EI_AIOS_RELEASE_V1_5_FINAL_VALIDATION.md` foi aprovado com parecer **GO**.
- [ ] O fundador emitiu **autorização expressa** para deploy.
- [ ] A branch local `feat/sprint-5-reliability-hardening` está no commit `009ea80`.
- [ ] O repositório remoto no GitHub está acessível e a branch `main` está no commit `0404681`.

---

## 2. Passo a Passo de Execução Controlada

### Passo 1: Merge Local Fast-Forward na Branch `main`
```powershell
# 1. Muda para a branch main
git checkout main

# 2. Atualiza a main com a origem
git pull origin main

# 3. Executa o merge com garantia fast-forward (sem gerar commit espúrio de merge)
git merge --ff-only feat/sprint-5-reliability-hardening

# 4. Cria a tag de release anotada
git tag -a v1.5-sprint5-complete -m "Release v1.5: Reliability, Orchestration Hardening & Concurrency Governance"
```

### Passo 2: Push para o Repositório Remoto
```powershell
# 5. Publica os commits da main e a nova tag no GitHub
git push origin main
git push origin v1.5-sprint5-complete
```

### Passo 3: Acompanhamento da Pipeline de CI/CD (GitHub Actions)
O workflow `.github/workflows/deploy.yml` será disparado automaticamente:
1. **Job `test`:**
   - Instalação limpa (`npm ci`).
   - Build de `@ei-aios/shared` e `@ei-aios/agent-core`.
   - Execução da suíte completa de 55 testes.
2. **Job `deploy`:**
   - Conexão SSH segura na VPS Hostinger (`/opt/ei-aios`).
   - Sincronização via `git reset --hard origin/main`.
   - Execução de `bash docker/deploy.sh`.

---

## 3. O Que Acontece Durante o Script de Deploy na VPS (`docker/deploy.sh`)

1. **Backup Preventivo:**
   O PostgreSQL realiza dump de segurança do banco antes de qualquer alteração:
   `/opt/ei-aios/backup_pre_sprint1.sql`
2. **Execução das Migrações na Ordem Estrita:**
   ```bash
   # Migrações 0001 a 0006 existentes
   ...
   # Migração 0007 da Sprint 5:
   docker exec -i "$POSTGRES_CONTAINER" psql -U postgres -d postgres < supabase/migrations/0007_sprint5_reliability_hardening.sql
   ```
3. **Recarga do Schema Cache:**
   O PostgREST é notificado para recarregar o schema imediatamente (`NOTIFY pgrst, 'reload schema'`).
4. **Atualização dos Containers dos Workers e UI:**
   ```bash
   docker service update --force ei-aios_agent-core
   docker service update --force ei-aios_web-ui
   ```

---

## 4. Verificação Imediata Pós-Deploy (Sanity Checks)

Executar os seguintes testes de validação em produção:

```powershell
# 1. Checa a saúde da API e status do Worker
curl -s https://api.eiaios.atendezen.com.br/health

# 2. Testa o novo endpoint de decisões com o token do fundador
$headers = @{ "Authorization" = "Bearer <FOUNDER_JWT_TOKEN>" }
Invoke-RestMethod -Uri "https://api.eiaios.atendezen.com.br/api/v1/decisions?limit=5" -Headers $headers

# 3. Valida a rota web
curl -I https://app.eiaios.atendezen.com.br
```

---

## 5. Critérios de Sucesso do Deploy
- Status HTTP 200 retornado em `/health` com `worker.isRunning = true`.
- Zero erros de migração no log do deploy.
- Endpoint `GET /api/v1/decisions` respondendo com payload paginado.
- Nenhuma tarefa presa em `running` além do timeout.

