#!/usr/bin/env bash
set -euo pipefail

echo "[doctor] docker: $(docker --version || true)"
echo "[doctor] compose: $(docker compose version || true)"
echo "[doctor] node: $(docker compose exec -T orchestrator node -v || true)"
echo "[doctor] api health: $(curl -skf http://localhost:8000/healthz && echo ok || echo fail)"
echo "[doctor] orch health: $(curl -skf http://localhost:8080/healthz && echo ok || echo fail)"
echo "[doctor] volumes:"
docker volume ls | grep workspace- || true

echo "[doctor] recent workspaces:"
docker compose exec -T api bash -lc 'ls -1t /workspaces | head -n 5' || true


