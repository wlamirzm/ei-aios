# EI-AIOS — ROTEIRO DE SMOKE TESTS AO VIVO EM PRODUÇÃO (RELEASE v1.5)
## Validação Pós-Deploy na VPS Hostinger

**Data:** 08/11/2026  
**Ambiente:** Produção (`https://api.eiaios.atendezen.com.br`)  
**Executor:** Engenheiro de Release / Fundador

---

## 1. Tabela de Verificação dos Smoke Tests

| # | Área | Endpoint / Operação | Comando / Payload de Teste | Resultado Esperado | Status |
|---|---|---|---|---|---|
| **ST-01** | **API Health** | `GET /health` | `curl -s https://api.eiaios.atendezen.com.br/health` | `HTTP 200`, `status: "healthy"`, `worker.isRunning: true` | [ ] |
| **ST-02** | **Auth Founder** | `POST /api/v1/auth/login` | `curl -X POST https://api.eiaios.atendezen.com.br/api/v1/auth/login -d '{"email":"wlamir@atendezen.com.br","password":"..."}'` | `HTTP 200`, `token` JWT retornado, `role: "founder_admin"` | [ ] |
| **ST-03** | **Segurança - Token Ausente** | `GET /api/v1/decisions` | `curl -s -o /dev/null -w "%{http_code}" https://api.eiaios.atendezen.com.br/api/v1/decisions` | **`HTTP 401 Unauthorized`** | [ ] |
| **ST-04** | **Decisions API - Autorizada** | `GET /api/v1/decisions?limit=5` | `curl -H "Authorization: Bearer <TOKEN>" https://api.eiaios.atendezen.com.br/api/v1/decisions?limit=5` | `HTTP 200`, `success: true`, lista de decisões e `pagination` | [ ] |
| **ST-05** | **Orquestrador AG-001** | `POST /api/v1/objectives` | Envio de objetivo teste: `WF-003` (Diagnóstico Energético) | `HTTP 200`, objetivo decomposto em subtarefas | [ ] |
| **ST-06** | **Worker Claim & Lease** | `GET /api/v1/tasks?status=running` | Consulta tarefas em execução no banco | Tarefas em `running` contêm `lease_token` em `input_payload` | [ ] |
| **ST-07** | **Síntese AG-001** | Transição final de subtarefas | Completar/aprovar as subtarefas do objetivo criado | Tarefa-mãe passa por `synthesizing` e transiciona para `completed` com artefato gerado | [ ] |
| **ST-08** | **Watchdog Universal** | `GET /health` | `recoverStuckTasks()` executado periodicamente | Zero tarefas presas em `running` além de `TASK_TIMEOUT_MS` | [ ] |
| **ST-09** | **AG-011 FinOps Integrity** | `GET /api/v1/metrics/finops` | `curl -H "Authorization: Bearer <TOKEN>" https://api.eiaios.atendezen.com.br/api/v1/metrics/finops` | Não reporta MRR fictício; contratos sem valor retornam `incomplete` | [ ] |
| **ST-10** | **AG-012 Quarentena** | `POST /api/v1/emails/messages/:id/execute-next-step` | Tentar executar próximo passo em mensagem de quarentena | **`HTTP 403 Forbidden`** (*"Ação bloqueada: esta mensagem está em quarentena..."*) | [ ] |

---

## 2. Script Automatizado para Smoke Test Remoto

Pode ser executado diretamente pelo terminal do PowerShell após o deploy:

```powershell
# Carrega credenciais do fundador
$BASE_URL = "https://api.eiaios.atendezen.com.br"
$LOGIN_BODY = @{
    email = "wlamir@atendezen.com.br"
    password = $env:FOUNDER_PASSWORD
} | ConvertTo-Json

# 1. Login
$loginRes = Invoke-RestMethod -Uri "$BASE_URL/api/v1/auth/login" -Method Post -Body $LOGIN_BODY -ContentType "application/json"
$TOKEN = $loginRes.token
$HEADERS = @{ "Authorization" = "Bearer $TOKEN" }

Write-Host "✅ Login bem-sucedido. Role: $($loginRes.user.role)"

# 2. Health check
$health = Invoke-RestMethod -Uri "$BASE_URL/health"
Write-Host "✅ Health Status: $($health.status) | Worker Running: $($health.worker.isRunning)"

# 3. Decisions API
$decisions = Invoke-RestMethod -Uri "$BASE_URL/api/v1/decisions?limit=5" -Headers $HEADERS
Write-Host "✅ Decisions API OK. Total de Decisões Registradas: $($decisions.pagination.total)"

# 4. Checagem de Quarentena sem Token
try {
    Invoke-WebRequest -Uri "$BASE_URL/api/v1/decisions" -Method Get
} catch {
    if ($_.Exception.Response.StatusCode -eq 401) {
        Write-Host "✅ Bloqueio 401 para Decisions sem token validado com sucesso."
    }
}
```
