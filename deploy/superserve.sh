#!/usr/bin/env bash
# Redeploy bridge + built web to the Superserve sandbox "understudy".
# Usage: deploy/superserve.sh   (needs SUPERSERVE_API_KEY in .env, bun, superserve CLI)
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
set -a; . ./.env; set +a
export SUPERSERVE_API_KEY="${SUPERSERVE_DEPLOY_KEY:-${SUPERSERVE_API_KEY_2:-$SUPERSERVE_API_KEY}}"
export PATH="$HOME/.bun/bin:$PATH"
SB="${SANDBOX:-understudy}"
STAGE="$(mktemp -d)"
mkdir -p "$STAGE/app/actor/client" "$STAGE/app/web"
( cd web && VITE_BRIDGE_URL="" VITE_RELAY_OBSERVER_URL="${RELAY_OBSERVER_URL:-}" bun run build >/dev/null )
cp -r bridge "$STAGE/app/bridge"; rm -rf "$STAGE/app/bridge/node_modules" "$STAGE/app/bridge/.webhooks.json"
cp -r actor/client/generated "$STAGE/app/actor/client/generated"
cp -r web/dist "$STAGE/app/web/dist"
cp -r agents "$STAGE/app/agents"
grep -E '^(TERSE_API_KEY|TERSE_ACTOR_URL|RELAY_WORKSPACE_KEY|RELAY_TOKEN_[A-Z_]+|OPENAI_API_KEY|SUPERSERVE_API_KEY_2|RELAY_OBSERVER_URL)=' .env > "$STAGE/app/.env"
printf 'TERSE_READY=1\nSTATIC_DIR=/home/user/app/web/dist\nBRIDGE_PORT=8788\nWEB_ORIGIN=%s\n' "${WEB_ORIGIN:-http://localhost:5173}" >> "$STAGE/app/.env"
( cd "$STAGE" && COPYFILE_DISABLE=1 tar czf app.tar.gz app )
superserve cp "$STAGE/app.tar.gz" "$SB:/home/user/app.tar.gz" >/dev/null
superserve exec "$SB" -- bash -c 'pkill -x bun || true; cd /home/user && rm -rf app && tar xzf app.tar.gz 2>/dev/null && (command -v superserve >/dev/null || npm install -g @superserve/cli >/dev/null 2>&1); cd app/bridge && /opt/bun/bin/bun install >/dev/null 2>&1 && set -a && . ../.env && set +a && (nohup /opt/bun/bin/bun index.ts > /home/user/bridge.log 2>&1 &) && sleep 8 && tail -5 /home/user/bridge.log && curl -s localhost:8788/health'
echo
superserve preview publish "$SB" 8788 --json 2>/dev/null | python3 -c "import sys,json; print(json.load(sys.stdin).get('url'))" || superserve preview url "$SB" 8788
