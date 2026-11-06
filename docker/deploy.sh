#!/usr/bin/env bash
# ==============================================================================
# EI-AIOS: VPS SWARM DEPLOYMENT SCRIPT (Hostinger Debian 12 / Docker Swarm)
# ==============================================================================

set -e

echo "================================================================="
echo "⚡ EI-AIOS: Iniciando Deploy no Docker Swarm (187.77.49.211)"
echo "🌐 Domínio: eiaios.atendezen.com.br"
echo "================================================================="

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"
cd "$ROOT_DIR"

# 1. Garante variáveis de ambiente carregadas
if [ -f .env ]; then
    set -a
    source .env
    set +a
fi

# 2. Compila as imagens Docker localmente caso necessário
echo "📦 Verificando/compilando imagens Docker..."
docker compose -f docker/docker-compose.yml build

# 3. Limpa contêineres standalone antigos para não conflitar
echo "🧹 Limpando contêineres avulsos antigos..."
docker rm -f ei-traefik ei-postgres ei-postgrest ei-agent-core ei-web-ui ei-n8n 2>/dev/null || true

# 4. Faz o deploy como Stack nativa do Docker Swarm
echo "🚀 Publicando stack 'ei-aios' no Docker Swarm..."
docker stack deploy --resolve-image=never -c docker/docker-compose.yml ei-aios

# Força atualização dos serviços que foram recompilados localmente
docker service update --force ei-aios_agent-core 2>/dev/null || true
docker service update --force ei-aios_web-ui 2>/dev/null || true

# 5. Aplica schema e seed limpo no PostgreSQL
echo "🗄️ Inicializando banco de dados e catálogo dos 11 agentes..."
sleep 5
POSTGRES_CONTAINER=$(docker ps -q -f name=ei-aios_postgres | head -n 1)
if [ -n "$POSTGRES_CONTAINER" ]; then
    echo "Executando migrações no contêiner $POSTGRES_CONTAINER..."
    docker cp supabase/migrations/0001_core_schema.sql "$POSTGRES_CONTAINER":/tmp/01.sql
    docker cp supabase/migrations/0002_rls_and_triggers.sql "$POSTGRES_CONTAINER":/tmp/02.sql
    docker cp supabase/seed.sql "$POSTGRES_CONTAINER":/tmp/03.sql
    docker exec "$POSTGRES_CONTAINER" psql -U postgres -d postgres -f /tmp/01.sql
    docker exec "$POSTGRES_CONTAINER" psql -U postgres -d postgres -f /tmp/02.sql
    docker exec "$POSTGRES_CONTAINER" psql -U postgres -d postgres -f /tmp/03.sql
    
    # Limpa dados transacionais mantendo o catálogo dos 11 agentes e normas ANEEL intactos
    docker exec "$POSTGRES_CONTAINER" psql -U postgres -d postgres -c "
      DELETE FROM approvals;
      DELETE FROM artifacts;
      DELETE FROM tasks;
      DELETE FROM energy_bills;
      DELETE FROM consumer_units;
      DELETE FROM clients;
      DELETE FROM agent_runs;
      GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role, postgres;
      GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated, service_role, postgres;
      GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated, service_role, postgres;
    "

    echo "📊 Total de Agentes no Banco:"
    docker exec "$POSTGRES_CONTAINER" psql -U postgres -d postgres -c "SELECT id, name, enabled FROM agents ORDER BY id;"

    echo "Recarregando schema cache do PostgREST via NOTIFY e update..."
    docker exec "$POSTGRES_CONTAINER" psql -U postgres -d postgres -c "NOTIFY pgrst, 'reload schema';" || true
    docker service update --force ei-aios_postgrest 2>/dev/null || true
fi

# 6. Status dos Serviços
echo "================================================================="
echo "🔍 Status dos Serviços da Stack EI-AIOS:"
sleep 3
docker stack services ei-aios
echo "================================================================="
echo "🎉 Deploy concluído com sucesso!"
echo "👉 Web UI (Cockpit): https://app.eiaios.atendezen.com.br"
echo "👉 API Agent Core:   https://api.eiaios.atendezen.com.br"
echo "👉 n8n Automações:   https://n8n.eiaios.atendezen.com.br"
echo "================================================================="
