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

# 5. Status dos Serviços
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
