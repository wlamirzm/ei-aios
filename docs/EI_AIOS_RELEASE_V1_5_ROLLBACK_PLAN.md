# EI-AIOS — PLANO DE CONTINGÊNCIA E ROLLBACK (RELEASE v1.5)
## Procedimento de Recuperação Rápida Sem Perda de Dados

**Versão Alvo de Reversão:** Release `v1.4-sprint4-complete` (commit `0404681`)  
**Data:** 08/11/2026  
**Responsável:** Engenharia SRE e Operações

---

## 1. Critérios de Disparo do Rollback (Triggers)

O procedimento de rollback deve ser acionado imediatamente caso ocorra qualquer uma das seguintes condições nas primeiras 2 horas pós-deploy:
1. **Falha Crítica no Worker:** Erros recorrentes de inicialização do container `ei-aios_agent-core` (crash loop).
2. **Degradação de Integridade:** Bloqueio generalizado de tarefas em `running` ou `synthesizing` sem recuperação pelo watchdog.
3. **Erros HTTP 500 Persistentes:** Mais de 5% de requisições falhando nos endpoints `/api/v1/*`.
4. **Instabilidade no Banco:** Erros de schema ou deadlock nas tabelas `tasks` ou `decision_logs`.

---

## 2. Compatibilidade do Banco de Dados no Rollback

> [!IMPORTANT]
> **NÃO execute comandos `DROP TYPE` ou remoção do valor `synthesizing` no PostgreSQL!**
> 
> No PostgreSQL, a adição de um valor ao enum (`ALTER TYPE task_status ADD VALUE 'synthesizing'`) e a criação dos índices `idx_tasks_status_task_type` e `idx_tasks_started_at` são **100% retrocompatíveis**. A versão anterior (v1.4) simplesmente ignora esses valores e índices adicionais. Nenhuma alteração destrutiva DDL deve ser executada no banco.

---

## 3. Passo a Passo do Procedimento de Rollback

### Passo 1: Reversão do Código no Repositório
```powershell
# 1. Garante que está na branch main
git checkout main

# 2. Reverte o commit de merge da v1.5
git revert -m 1 HEAD -n   # se foi merge commit
# ou se foi fast-forward:
git reset --hard 040468132bf64cbaf5b8e92c23178df6e5b47c0b

# 3. Força a publicação da versão anterior no GitHub
git push origin main --force-with-lease
```

### Passo 2: Re-deploy da Versão v1.4 na VPS via SSH
A pipeline de CI/CD aplicará a versão v1.4 automaticamente. Caso seja necessário forçar via terminal SSH:
```bash
# Na VPS Hostinger:
cd /opt/ei-aios
git fetch origin main
git reset --hard 040468132bf64cbaf5b8e92c23178df6e5b47c0b
docker service update --force ei-aios_agent-core
docker service update --force ei-aios_web-ui
```

### Passo 3: Tratamento de Tarefas em Andamento no Banco
Para evitar que tarefas fiquem presas em status desconhecido pela versão v1.4:
```sql
-- Executar via psql no contêiner ei-postgres da VPS:
-- 1. Reseta tarefas que estavam no novo status 'synthesizing' para 'running'
-- permitindo que a versão v1.4 as retome via loop de reconciliação:
UPDATE tasks 
SET status = 'running' 
WHERE status = 'synthesizing';

-- 2. Limpa qualquer lease pendente de workers interrompidos:
UPDATE tasks 
SET input_payload = jsonb_set(input_payload, '{lease_token}', 'null'::jsonb)
WHERE status = 'running';
```

> [!NOTE]
> Tarefas já marcadas como `completed` ou `failed` **NÃO são alteradas nem reabertas**. O histórico é 100% preservado.

---

## 4. Restauração do Backup Completo do Banco (Último Recurso)

Apenas caso tenha ocorrido corrupção catastrófica de dados (cenário improvável):
```bash
# Na VPS Hostinger:
POSTGRES_CONTAINER=$(docker ps -q --filter "label=com.docker.swarm.service.name=ei-aios_postgres" | head -n 1)

# Restaura o dump pré-deploy gerado automaticamente pelo deploy.sh:
docker exec -i "$POSTGRES_CONTAINER" psql -U postgres -d postgres < /opt/ei-aios/backup_pre_sprint1.sql
```

---

## 5. Validação Pós-Rollback
- Checar `/health` (deve retornar `status: 'healthy'`).
- Confirmar que nenhuma tarefa permaneceu em `synthesizing`:
  ```sql
  SELECT count(*) FROM tasks WHERE status = 'synthesizing'; -- Deve retornar 0
  ```

