# EI-AIOS — ROTEIRO DE SMOKE TESTS AO VIVO EM PRODUÇÃO (RELEASE v1.5)
## Validação Pós-Deploy na VPS Hostinger

**Data:** 08/11/2026  
**Ambiente:** Produção (`https://api.eiaios.atendezen.com.br`)  
**Executor:** Engenheiro de Release / Fundador

---

## 1. Tabela de Verificação dos Smoke Tests

| # | Área | Endpoint / Operação | Comando / Payload de Teste | Resultado Esperado | Status |
|---|---|---|---|---|---|
| **ST-01** | **API Health** | `GET /health` | `curl -s https://api.eiaios.atendezen.com.br/health` | `HTTP 200`, `status: "healthy"`, `worker.isRunning: true` | [X] APROVADO |
| **ST-02** | **Auth Founder** | `POST /api/v1/auth/login` | `curl -X POST https://api.eiaios.atendezen.com.br/api/v1/auth/login` | `HTTP 200`, `token` JWT retornado, `role: "founder_admin"` | [X] APROVADO |
| **ST-03** | **Segurança - Token Ausente** | `GET /api/v1/decisions` | `curl -s -o /dev/null -w "%{http_code}" https://api.eiaios.atendezen.com.br/api/v1/decisions` | **`HTTP 401 Unauthorized`** | [X] APROVADO |
| **ST-04** | **Decisions API - Autorizada** | `GET /api/v1/decisions?limit=5` | `curl -H "Authorization: Bearer <TOKEN>" https://api.eiaios.atendezen.com.br/api/v1/decisions?limit=5` | `HTTP 200`, `success: true`, lista de decisões e `pagination` | [X] APROVADO |
| **ST-05** | **Orquestrador AG-001 & Swarm** | `GET /api/v1/agents` | Validação do catálogo de 12 agentes com AG-001/011/012 ativos | `HTTP 200`, 12 agentes registrados e operacionais no banco | [X] APROVADO |
| **ST-06** | **Worker Claim & Lease** | `GET /api/v1/tasks` | Consulta governança da fila de tarefas | `HTTP 200`, 13 tarefas persistidas, zero zumbis em running | [X] APROVADO |
| **ST-07** | **Síntese AG-001** | `GET /api/v1/tasks` | Validação de macro-objetivos concluídos | `HTTP 200`, síntese executiva consolidada por AG-001 com sucesso | [X] APROVADO |
| **ST-08** | **PostgREST / Postgres 16** | `GET /api/v1/system/debug` | Validação de integridade do PostgREST e BD | `HTTP 200`, `supabaseResult.status: 200`, zero erros | [X] APROVADO |
| **ST-09** | **AG-011 FinOps Integrity** | `GET /api/v1/metrics/finops` | `curl -s https://api.eiaios.atendezen.com.br/api/v1/metrics/finops` | MRR R$ 1.490 determinístico, runs de IA conciliadas, CAC incomplete | [X] APROVADO |
| **ST-10** | **AG-012 Quarentena** | `POST /api/v1/emails/messages/:id/execute-next-step` | Tentativa de execução sem autorização / mensagens quarentenadas | `HTTP 401` sem token / `HTTP 403` quarentena / `HTTP 404` not found | [X] APROVADO |

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

