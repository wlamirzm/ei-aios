# EI-AIOS — MONITORAMENTO E MÉTRICAS OPERACIONAIS PÓS-RELEASE v1.5
## Telemetria das Primeiras 24 Horas em Produção

**Data:** 08/11/2026  
**Responsável:** Engenheiro SRE / DevOps / Monitoramento de Agentes

---

## 1. Indicadores Críticos de Concorrência e Confiabilidade (SLIs / SLAs)

Nas primeiras 24 horas após o deploy da Release v1.5, os seguintes indicadores devem ser acompanhados:

| Métrica Operacional | Fonte / Consulta | Faixa Normal | Limite de Alerta (Warning) | Critério de Abort/Rollback |
|---|---|---|---|---|
| **Tarefas Pendentes (`pending`)** | `SELECT count(*) FROM tasks WHERE status = 'pending'` | `0 a 15` | `> 30` por mais de 10 min | `> 100` persistente (Workers travados) |
| **Tarefas em Execução (`running`)** | `SELECT count(*) FROM tasks WHERE status = 'running'` | `0 a 8` | `> 15` | `> 25` (Suspeita de loop infinito) |
| **Tarefas em Síntese (`synthesizing`)** | `SELECT count(*) FROM tasks WHERE status = 'synthesizing'` | `0 ou 1` transitório (`< 30s`) | `> 2` simultâneas | Qualquer tarefa presa em `synthesizing` `> 5 min` |
| **Tarefas Recuperadas pelo Watchdog** | `SELECT count(*) FROM tasks WHERE input_payload->>'recovery_reason' IS NOT NULL` | `0 a 5 / dia` | `> 10 / hora` | `> 25 / hora` (Falhas massivas de agentes) |
| **Leases Rejeitados / Conclusões Tardias** | Logs de `agent-core`: `"Zombie execution aborted"` | `0` | `> 3 / hora` | `> 10 / hora` (Worker zumbi concorrente) |
| **Workers Ativos** | `GET /health` (`worker.isRunning`) | `true` | Ciclo travado (`> 60s`) | `false` ou container em Restart Loop |
| **Tempo Médio de Execução** | `SELECT avg(execution_time_ms) FROM agent_runs` | `1.5s a 5s` | `> 15s` | `> 45s` (Degradação de latência LLM) |
| **Taxa de Erro HTTP 500** | Logs do Nginx / Traefik / Express | `< 0.1%` | `> 1%` | `> 5%` persistente |
| **Erros de Bloqueio 401 / 403** | Logs de `routes.ts` | Normal em quarentena | Disparo anormal de 401 para o fundador | Falha de validação do JWT_SECRET |

---

## 2. Consultas Rápidas de Diagnóstico no PostgreSQL

Para auditoria direta no banco durante o plantão pós-deploy:

```sql
-- 1. Visão geral da distribuição de status de tarefas
SELECT status, count(*) 
FROM tasks 
GROUP BY status 
ORDER BY count(*) DESC;

-- 2. Detecta se há alguma tarefa em synthesizing presa além de 5 minutos
SELECT id, task_code, started_at, NOW() - started_at AS duracao
FROM tasks 
WHERE status = 'synthesizing' AND started_at < NOW() - INTERVAL '5 minutes';

-- 3. Lista tarefas recuperadas pelo Watchdog nas últimas horas
SELECT task_code, retry_count, input_payload->>'recovery_reason' AS motivo
FROM tasks 
WHERE input_payload->>'recovery_reason' IS NOT NULL
ORDER BY created_at DESC 
LIMIT 10;

-- 4. Confirmação de integridade de leases ativos
SELECT id, task_code, assigned_agent_id, status, input_payload->>'lease_token' AS lease
FROM tasks 
WHERE status = 'running';
```

---

## 3. Protocolo de Escalonamento e Decisão

```
                              [Evento Anômalo Detectado]
                                          |
                        +-----------------+-----------------+
                        |                                   |
                [Warning / Alerta]                  [Critério de Abort]
                        |                                   |
           1. Inspecionar logs do worker        1. Notificar Fundador imediatamente
           2. Verificar latência Gemini API     2. Acionar ROLLBACK_PLAN.md
           3. Forçar ciclo do worker:           3. Re-executar tag v1.4-sprint4-complete
              POST /api/v1/system/worker/poll   4. Limpar status 'synthesizing'
                        |                                   |
           (Normalizado em < 15 min?)                  (Restaurado v1.4)
           SIM -> Manter em observação
           NÃO -> Escalar para Rollback
```

