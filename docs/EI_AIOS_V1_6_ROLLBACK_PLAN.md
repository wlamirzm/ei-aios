# EI-AIOS — PLANO DE ROLLBACK DA RELEASE v1.6
## Procedimento de Contingência e Reversão Segura para a Versão v1.5

**Projeto:** Energy Intelligence AIOS (EI-AIOS)  
**Versão Alvo de Reversão:** `v1.5-sprint5-complete` (Commit `e25e3814bcc5dac7c6b779c870673eb0bc1da03f`)  
**Data:** 08/11/2026  
**Status:** VALIDADO E PRONTO PARA USO EM CASO DE EMERGÊNCIA

---

## 1. GATILHOS PARA ACIONAMENTO DO ROLLBACK

O Rollback deve ser acionado imediatamente se:
1. Os serviços Docker Swarm não estabilizarem dentro da janela de 5 minutos após o deploy.
2. A API REST começar a retornar HTTP 500 em endpoints essenciais (`/api/v1/tasks`, `/api/v1/auth/login`).
3. O worker falhar repetidamente na reivindicação atômica de tarefas (`lease_token`).
4. For detectada inconsistência irrecuperável de dados durante os smoke tests.

---

## 2. PROCEDIMENTO DE ROLLBACK DOS CONTAINERS (DOCKER SWARM)

A reversão dos containers para a imagem estável anterior `v1.5-sprint5-complete` é instantânea:

```bash
# Na VPS Hostinger via SSH:

# 1. Reverte o serviço agent-core para v1.5
docker service update \
  --image ghcr.io/wlamirzm/ei-aios-agent-core:v1.5-sprint5-complete \
  ei-aios_agent-core

# 2. Reverte o worker para v1.5
docker service update \
  --image ghcr.io/wlamirzm/ei-aios-worker:v1.5-sprint5-complete \
  ei-aios_worker

# 3. Reverte a interface web para v1.5
docker service update \
  --image ghcr.io/wlamirzm/ei-aios-web:v1.5-sprint5-complete \
  ei-aios_web
```

---

## 3. PROCEDIMENTO DE ROLLBACK DO BANCO DE DADOS (SUPABASE POSTGRESQL)

Como as migrations 0008, 0009, 0010 e 0011 foram desenhadas como **aditivas e retrocompatíveis** (tabelas novas e colunas opcionais com default nulo), a versão de código v1.5 continuará funcionando perfeitamente mesmo que as novas tabelas permaneçam no banco.

No entanto, caso seja necessário o expurgo completo dos schemas criados na Sprint 6, execute o seguinte script DDL em ordem inversa:

```sql
BEGIN;

-- 1. Reversão da Migration 0011 (Unit Economics)
DROP TABLE IF EXISTS financial_metric_snapshots CASCADE;
DROP TABLE IF EXISTS customer_acquisition_events CASCADE;
DROP TABLE IF EXISTS operational_expenses CASCADE;
DROP TABLE IF EXISTS acquisition_expenses CASCADE;

-- 2. Reversão da Migration 0010 (Real Revenue Pipeline)
DROP TABLE IF EXISTS success_fee_events CASCADE;
DROP TABLE IF EXISTS revenue_receipts CASCADE;
DROP TABLE IF EXISTS revenue_invoices CASCADE;
DROP TABLE IF EXISTS client_contracts CASCADE;

-- 3. Reversão da Migration 0009 (FinOps Cost Ledger)
DROP TABLE IF EXISTS finops_ledger CASCADE;
DROP TABLE IF EXISTS finops_model_pricing CASCADE;

-- 4. Reversão da Migration 0008 (Context Propagation)
DROP INDEX IF EXISTS idx_tasks_consumer_unit;
DROP INDEX IF EXISTS idx_agent_runs_is_internal;
DROP INDEX IF EXISTS idx_agent_runs_execution_id;
DROP INDEX IF EXISTS idx_agent_runs_consumer_unit;

ALTER TABLE tasks DROP COLUMN IF EXISTS consumer_unit_id;
ALTER TABLE agent_runs DROP COLUMN IF EXISTS metadata;
ALTER TABLE agent_runs DROP COLUMN IF EXISTS is_internal;
ALTER TABLE agent_runs DROP COLUMN IF EXISTS execution_id;
ALTER TABLE agent_runs DROP COLUMN IF EXISTS consumer_unit_id;

COMMIT;
```

---

## 4. VALIDAÇÃO PÓS-ROLLBACK

Após executar a reversão:
1. Verificar status dos serviços: `docker service ls` (todos com réplicas `1/1`).
2. Testar health check: `curl http://localhost:4000/api/v1/health`.
3. Confirmar que o worker da v1.5 está processando a fila normalmente.
