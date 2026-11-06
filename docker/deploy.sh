#!/usr/bin/env bash
# ==============================================================================
# EI-AIOS: VPS DEPLOYMENT SCRIPT (Hostinger Debian 12)
# ==============================================================================

set -e

echo "================================================================="
echo "⚡ EI-AIOS: Iniciando Deploy na VPS Hostinger (187.77.49.211)"
echo "🌐 Domínio: eiaios.atendezen.com.br"
echo "================================================================="

# 1. Garante que o .env existe na raiz e na pasta docker
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"
cd "$ROOT_DIR"

if [ -f .env ]; then
    cp .env docker/.env
fi

# 2. Remove contêiner ei-traefik antigo se estiver presente (o Traefik existente no Swarm é quem gerencia 80/443)
if docker ps -a --format '{{.Names}}' | grep -q "^ei-traefik$"; then
    echo "🧹 Removendo contêiner redundante ei-traefik..."
    docker rm -f ei-traefik || true
fi

# 3. Sobe os 5 contêineres: Postgres 16, PostgREST, Agent Core, Web UI e n8n conectados ao Traefik Swarm
echo "🚀 Subindo a stack de contêineres conectada à rede network_swarm_public..."
docker compose -f docker/docker-compose.yml --env-file docker/.env up -d --build

# 4. Status dos Contêineres
echo "================================================================="
echo "🔍 Status dos Contêineres do EI-AIOS:"
docker compose -f docker/docker-compose.yml ps
echo "================================================================="
echo "🎉 Deploy concluído com sucesso!"
echo "👉 Web UI (Cockpit): https://app.eiaios.atendezen.com.br"
echo "👉 API Agent Core:   https://api.eiaios.atendezen.com.br"
echo "👉 n8n Automações:   https://n8n.eiaios.atendezen.com.br"
echo "================================================================="
