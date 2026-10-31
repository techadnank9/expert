#!/usr/bin/env bash
# Launch one bench agent (Codex CLI + Agent Relay MCP).
# Usage: agents/launch.sh <policy|billing|appeals> [caseId=4471] [rounds=20]
set -euo pipefail
ROLE="${1:?usage: launch.sh <policy|billing|appeals> [caseId] [rounds]}"
CASE="${2:-4471}"
ROUNDS="${3:-20}"
case "$ROLE" in policy|billing|appeals) ;; *) echo "bad role $ROLE"; exit 1;; esac
HERE="$(cd "$(dirname "$0")" && pwd)"
ENV_FILE="$HERE/../.env"
[ -f "$ENV_FILE" ] || { echo "missing $ENV_FILE; run: bun bridge/setup.ts"; exit 1; }
grep -q '^RELAY_WORKSPACE_KEY=' "$ENV_FILE" || { echo "RELAY_WORKSPACE_KEY missing in .env"; exit 1; }
UPPER="$(echo "$ROLE" | tr '[:lower:]' '[:upper:]')"
grep -q "^RELAY_TOKEN_$UPPER=" "$ENV_FILE" || { echo "RELAY_TOKEN_$UPPER missing; run: bun bridge/setup.ts"; exit 1; }

export RELAY_ATTEST_SESSION_ID="$( (uuidgen 2>/dev/null || cat /proc/sys/kernel/random/uuid) | tr 'A-Z' 'a-z')"
LAUNCHED_AT="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
export RELAY_WORKSPACE_KEY="$(grep -E '^RELAY_WORKSPACE_KEY=' "$ENV_FILE" | tail -1 | cut -d= -f2-)"
CODEX="${CODEX:-$(command -v codex || echo $HOME/.bun/bin/codex)}"
# Codex auth: API key from .env when no ChatGPT login (VM case)
OA="$(grep -E '^OPENAI_API_KEY=' "$ENV_FILE" | tail -1 | cut -d= -f2-)"
if [ -n "$OA" ] && ! "$CODEX" login status >/dev/null 2>&1; then printf '%s' "$OA" | "$CODEX" login --with-api-key >/dev/null 2>&1 || true; fi
echo "[launch] $ROLE on #case-$CASE session=$RELAY_ATTEST_SESSION_ID"

PROMPT="$(cat "$HERE/$ROLE.md" "$HERE/_common.md")

## Your run
You are already registered on Agent Relay as \`$ROLE\` through the \`relay\` MCP server
(do not call register_agent or create_workspace). Your session id is $RELAY_ATTEST_SESSION_ID.
1. Call join_channel for \`case-$CASE\`.
2. Repeat up to $ROUNDS rounds: call check_inbox (and list_messages on case-$CASE if the inbox is empty).
   For every thread in #case-$CASE that mentions @$ROLE or contains a **Recommendation** you have
   not handled yet: read it with get_message_thread, then reply_to_thread / add_reaction / invoke
   the actions exactly as the rules above say. If nothing new arrived, wait by running the shell
   command \`sleep 15\` and continue.
3. Stop after $ROUNDS rounds, or once the recommendation in the active thread has a :+1: from you
   (or, for appeals, after you posted it). Print a one-line summary of what you did."

exec "$CODEX" exec \
  --skip-git-repo-check \
  -C "$HERE" \
  -c approval_policy='"never"' \
  -c sandbox_mode='"workspace-write"' \
  -c "mcp_servers.relay.command=\"bash\"" \
  -c "mcp_servers.relay.args=[\"$HERE/relay-mcp.sh\",\"$ROLE\",\"$RELAY_ATTEST_SESSION_ID\"]" \
  -c 'mcp_servers.relay.startup_timeout_sec=120' \
  -c 'mcp_servers.relay.default_tools_approval_mode="approve"' \
  -c 'mcp_servers.relay.tool_timeout_sec=120' \
  "$PROMPT"
