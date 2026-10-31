#!/usr/bin/env bash
# MCP stdio server wrapper: agent-relay MCP bound to one bench identity.
# Usage (by codex, not humans): relay-mcp.sh <policy|billing|appeals> <session-id>
set -euo pipefail
ROLE="$1"; SESSION="${2:-}"
HERE="$(cd "$(dirname "$0")" && pwd)"
ENV_FILE="$HERE/../.env"
get() { grep -E "^$1=" "$ENV_FILE" | tail -1 | cut -d= -f2-; }
UPPER="$(echo "$ROLE" | tr '[:lower:]-' '[:upper:]_')"
export RELAY_WORKSPACE_KEY="$(get RELAY_WORKSPACE_KEY)"
export RELAY_AGENT_NAME="$ROLE"
export RELAY_AGENT_TOKEN="$(get "RELAY_TOKEN_$UPPER")"
export RELAY_AGENT_TYPE=agent
[ -n "$SESSION" ] && export RELAY_ATTEST_SESSION_ID="$SESSION"
exec "${BUNX:-$HOME/.bun/bin/bunx}" agent-relay@15.0.1 mcp
