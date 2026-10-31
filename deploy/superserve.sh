#!/usr/bin/env bash
# Redeploy bridge + built web to the Superserve sandbox "understudy".
# Usage: deploy/superserve.sh   (needs SUPERSERVE_API_KEY in .env, bun, superserve CLI)
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
set -a; . ./.env; set +a
export PATH="$HOME/.bun/bin:$PATH"
SB="${SANDBOX:-understudy}"
STAGE="$(mktemp -d)"
mkdir -p "$STAGE/app/actor/client" "$STAGE/app/web"
( cd web && VITE_BRIDGE_URL="" bun run build >/dev/null )
cp -r bridge "$STAGE/app/bridge"; rm -rf "$STAGE/app/bridge/node_modules" "$STAGE/app/bridge/.webhooks.json"
cp -r actor/client/generated "$STAGE/app/actor/client/generated"
cp -r web/dist "$STAGE/app/web/dist"
grep -E '^(TERSE_API_KEY|TERSE_ACTOR_URL|RELAY_WORKSPACE_KEY|RELAY_TOKEN_[A-Z_]+)=' .env > "$STAGE/app/.env"
printf 'TERSE_READY=1\nSTATIC_DIR=/home/user/app/web/dist\nBRIDGE_PORT=8788\n' >> "$STAGE/app/.env"
( cd "$STAGE" && COPYFILE_DISABLE=1 tar czf app.tar.gz app )
superserve cp "$STAGE/app.tar.gz" "$SB:/home/user/app.tar.gz" >/dev/null
superserve exec "$SB" -- bash -c 'pkill -f "bun index.ts" || true; cd /home/user && rm -rf app && tar xzf app.tar.gz 2>/dev/null && cd app/bridge && /opt/bun/bin/bun install >/dev/null 2>&1 && set -a && . ../.env && set +a && (nohup /opt/bun/bin/bun index.ts > /home/user/bridge.log 2>&1 &) && sleep 8 && tail -5 /home/user/bridge.log && curl -s localhost:8788/health'
echo
superserve preview url "$SB" 8788 2>/dev/null || true
