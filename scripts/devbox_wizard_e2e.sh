#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR=$(cd "$(dirname "$0")/.." && pwd)
LOG_DIR="$ROOT_DIR/artifacts/devbox-e2e/$(date +%Y%m%d-%H%M%S)"
mkdir -p "$LOG_DIR"

echo "[e2e] starting" | tee -a "$LOG_DIR/run.log"

# Matrix: minimal next app
echo "[e2e] headless create (next)" | tee -a "$LOG_DIR/run.log"
docker compose exec -T api python -m app.cli new --stack next --name "E2E Next" --model gemini --purpose modern-web | tee "$LOG_DIR/create.json"
PID=$(jq -r .project_id < "$LOG_DIR/create.json")
SID=$(jq -r .sandbox_id < "$LOG_DIR/create.json")
PREVIEW=$(jq -r .preview_url < "$LOG_DIR/create.json")
echo "[e2e] project=$PID sandbox=$SID preview=$PREVIEW" | tee -a "$LOG_DIR/run.log"

echo "[e2e] wait for preview" | tee -a "$LOG_DIR/run.log"
DEADLINE=$((SECONDS+180))
until curl -skfI "https://localhost${PREVIEW}" >/dev/null 2>&1; do
  if (( SECONDS > DEADLINE )); then
    echo "[e2e] timeout waiting for preview" | tee -a "$LOG_DIR/run.log"
    docker compose logs --no-log-prefix api orchestrator > "$LOG_DIR/stack.log" || true
    docker compose exec -T api bash -lc "cat /workspaces/$PID/session.log || true" > "$LOG_DIR/session.log" || true
    exit 2
  fi
  sleep 2
done

echo "[e2e] OK" | tee -a "$LOG_DIR/run.log"
exit 0


