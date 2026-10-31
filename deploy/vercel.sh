#!/usr/bin/env bash
# Build the web against the Superserve bridge and deploy to the Vercel project "hirexpert" (alias hirexpert-eta.vercel.app).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"; cd "$ROOT"
set -a; . ./.env; set +a
export PATH="$HOME/.local/bin:$HOME/.bun/bin:$PATH"
BRIDGE="${BRIDGE_URL:-https://8788-5975fada-698b-4c43-8ec3-1e554ae9d97c.sandbox.superserve.ai}"
( cd web && VITE_BRIDGE_URL="$BRIDGE" VITE_RELAY_OBSERVER_URL="${RELAY_OBSERVER_URL:-}" bun run build >/dev/null )
cp web/vercel.json web/dist/
cd web/dist
vercel link --yes --project hirexpert --scope mdadnan456gmailcoms-projects >/dev/null 2>&1   # vite wipes dist/, so relink every time
vercel deploy --prod --yes 2>&1 | grep -E "Production|Error" | tail -1
echo "alias: https://hirexpert-eta.vercel.app"
