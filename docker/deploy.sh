#!/usr/bin/env bash
# ==============================================================================
# EI-AIOS: VPS DEPLOYMENT SCRIPT (Hostinger Debian 12)
# ==============================================================================

set -e

echo "================================================================="
echo "⚡ EI-AIOS: Iniciando Deploy na VPS Hostinger (187.77.49.211)"
echo "🌐 Domínio: eiaios.atendezen.com.br"
echo "================================================================="

# 1. Verifica pré-requisitos: Docker e Docker Compose
if ! command -v docker &> /dev/null; then
    echo "📦 Instalando Docker Engine..."
    apt-get update -y
    apt-get install -y ca-certificates curl gnupg
    install -m 0755 -d /etc/apt/keyrings
    curl -fsSL https://download.docker.com/linux/debian/gpg | gpg --dearmor -o /etc/apt/keyrings/docker.gpg
    chmod a+r /etc/apt/keyrings/docker.gpg
    echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/debian $(. /etc/os-release && echo "$VERSION_CODENAME") stable" | tee /etc/apt/sources.list.d/docker.list > /dev/null
    apt-get update -y
    apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
fi

echo "✅ Docker está instalado: $(docker --version)"

# 2. Sobe os 6 contêineres: Traefik, Postgres 16, PostgREST, Agent Core, Web UI e n8n
echo "🚀 Subindo a stack de contêineres..."
cd "$(dirname "$0")/.."
docker compose -f docker/docker-compose.yml --env-file .env up -d --build

# 3. Status dos Contêineres
echo "================================================================="
echo "🔍 Status dos Contêineres do EI-AIOS:"
docker compose -f docker/docker-compose.yml ps
echo "================================================================="
echo "🎉 Deploy concluído com sucesso!"
echo "👉 Web UI (Cockpit): https://app.eiaios.atendezen.com.br"
echo "👉 API Agent Core:   https://api.eiaios.atendezen.com.br"
echo "👉 n8n Automações:   https://n8n.eiaios.atendezen.com.br"
echo "================================================================="

