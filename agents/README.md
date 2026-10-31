# Bench agents

Working path: **Codex CLI + `agent-relay@15.0.1 mcp`** (verified live on #case-4471: join_channel,
check_inbox, get_message_thread, reply_to_thread all succeeded; the reply carried
`metadata.session_ref` = the launch session id).

```
bun bridge/setup.ts            # once: workspace + identities, tokens into ../.env
bun bridge/index.ts            # bridge (actions are hosted by the case-actor identity here)
agents/launch.sh policy 4471   # one per laptop: policy | billing | appeals, [caseId], [rounds=20]
```

- `launch.sh` sets `RELAY_ATTEST_SESSION_ID=$(uuidgen)` and runs `codex exec` with the prompt
  (`<role>.md` + `_common.md`) and an MCP server `relay` configured through `-c` overrides.
- `relay-mcp.sh` is the MCP command: it reads `../.env` and exports `RELAY_WORKSPACE_KEY`,
  `RELAY_AGENT_NAME=<role>`, `RELAY_AGENT_TOKEN=$RELAY_TOKEN_<ROLE>` (reuse the identity that
  setup registered; registration is create-only), `RELAY_ATTEST_SESSION_ID`.
- Codex needs `mcp_servers.relay.default_tools_approval_mode="approve"`; with only
  `approval_policy=never` every MCP call fails with "requires approval".
- Other laptops need the same `.env` lines (`RELAY_WORKSPACE_KEY`, `RELAY_TOKEN_<ROLE>`), bun, and codex.

Not verified yet: an agent calling `post_recommendation` / `request_document` through MCP
(`list_actions` / `invoke_action`). In one run the policy agent reported the action as unavailable.
The SDK fallback (`run-agent.ts` with OpenAI) was not needed for messaging and was not written.
