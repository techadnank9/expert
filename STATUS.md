# STATUS

Updated: 13:08

## Works
- (nothing yet)

## Stubbed
- (nothing yet)

## Cut
- (nothing yet)

## Decisions
- Repo root is the `understudy/` layout from HANDOFF section 4 (repo name on GitHub is `expert`).

## 13:20 update
- Works: actor/ compiles and runs on `terse actor dev` (:7100). Case + Board actors with all HANDOFF methods. Alarms use real Terse `this.alarm.set()` + `onAlarm()`; one hardware alarm re-armed to the earliest unfired logical alarm.
- Decision: skipped `terse init` (CLI says "Not authenticated" even after `terse auth login` succeeded; `terse actor dev` works without it). Hand-scaffolded actor/package.json. Revisit only for `terse deploy`.
- Decision: Case `id` is the Terse actor id (`this.id`), not a persisted field (SDK forbids overriding `id`). Emitted state lacks `id`; web uses the route param.
- Decision: actor cannot be assumed to make outbound HTTP; it `broadcast`s `asked`, `alarm_fired`, `event` socket messages and the bridge posts into Relay on its behalf.
- Stubbed: nothing in actor. Bridge + web in progress via subagents.

## 13:24 update
- Works: actor smoke test (actor/client/smoke.ts) passes end to end incl. real alarm firing over WebSocket. Durability verified: killed `terse actor dev`, restarted, case state + pending alarm intact (actor/client/durability.ts).
- Works: seed/seed-cases.ts seeds cases 4471 and 4398 + 2 open board jobs. `--alarm-seconds N` controls 4398's escalate alarm.
- Note: `terse auth login` says already logged in but `terse init` says not authenticated. Not needed; dev works. Will matter only for `terse deploy` (cut list item 5).

## 13:32 update
- Works: `terse deploy` succeeded. Hosted actors at https://api.useterse.ai/cmvwuohyf00zwjy2a2dm8cjel/actors (TERSE_ACTOR_URL in .env). Local dev remains default; bridge switches to hosted by exporting TERSE_ACTOR_URL + TERSE_API_KEY before `terse actor generate`.
- Decision: `terse init` and `terse deploy` only authenticate when TERSE_API_KEY is exported (the browser login is not picked up). Copied terse.config.json from a scratch init into actor/.

## 13:37 update
- Works: web/ all 8 routes over fixtures, build clean, Worker screen verified against mockups/Worker.html in headless Chrome.
- Decision (user OK): deploy bridge + web to Freestyle at 15:10 only if integration is solid. Actors already hosted on Terse. Demo default remains localhost.
- Waiting: bridge/ + agents/ (Relay) from subagent.

## 13:55 update
- Works: full loop verified live. Worker ask (HTTP) -> actor `asked` broadcast -> bridge posts as maya in #case-4471 with case brief -> three Codex agents (Relay MCP) reply in thread -> appeals posts **Recommendation** -> bridge lifts it into actor -> status `recommended`. Hosted Terse actor is the store (TERSE_READY=1 + TERSE_ACTOR_URL).
- Decision: Relay `registerAction` on the agent client registers nothing server-side today (GET /actions returns []), agents report tools unavailable. Fallback per HANDOFF rule 6: appeals posts a structured **Recommendation** thread reply; bridge/listeners.ts parses it into postRecommendation + recommendationId. Actions stay registered for when the platform catches up.
- Decision: agents read case documents from agents/docs/<caseId>/*.md (text excerpts). Without them they only asked for documents.
- Decision: single laptop runs all three agents (user: this laptop owns everything). Each has its own RELAY_ATTEST_SESSION_ID so session_ref provenance still differs per agent. Cut-list item 4 partially taken.
- Decision: Freestyle over Superserve for the optional 15:10 deploy (key present, event sponsor).
- Stubbed: votes (:+1:) -> agrees path coded, not yet seen live. Approve -> ✅ reaction coded, not yet seen live.

## 14:00 update — both demo moments verified live on the hosted actor
- Moment 1-3: ask -> three Codex agents reply with document citations (agents/docs) -> appeals **Recommendation** lifted -> policy + billing :+1: -> Approve -> status drafted, maya :white_check_mark: in Relay, case-actor posts "Approval recorded" via webhook.
- Moment 5: `devReset 4398 {escalateInSeconds:75}` -> Terse onAlarm fired at the scheduled second -> status escalated -> bridge posted "Alarm fired" into #case-4398 as case-actor via webhook.
- Moment 4 (durability): state lives in the hosted Terse actor; kill bridge + web, restart, reload: intact. Also actor hibernates after 10 s idle between every step and wakes with state. Local `terse actor dev` kill/restart verified earlier too.
- Relay observer link for judges minted (12 h), scoped to case-4471 + case-4398. Command in DEMO.md.
- Next: Freestyle deploy of bridge + built web on one VM (style.dev name), then FLOWS.html walkthrough (subagent running).

## 14:05 update — deployed
- Freestyle refused (account flagged FORBIDDEN signup_risk). Per user rule, deployed to Superserve instead.
- Superserve sandbox "understudy" (2 vCPU, 4 GiB, 7 d timeout) runs the bridge + built web on :8788, published publicly:
  https://8788-37c50edb-9314-4d3c-af56-e0df8916b0af.sandbox.superserve.ai
  Poster side: https://8788-37c50edb-9314-4d3c-af56-e0df8916b0af.sandbox.superserve.ai/post , https://8788-37c50edb-9314-4d3c-af56-e0df8916b0af.sandbox.superserve.ai/poster/4471 , https://8788-37c50edb-9314-4d3c-af56-e0df8916b0af.sandbox.superserve.ai/poster/4471/review
  Worker side: https://8788-37c50edb-9314-4d3c-af56-e0df8916b0af.sandbox.superserve.ai/board , https://8788-37c50edb-9314-4d3c-af56-e0df8916b0af.sandbox.superserve.ai/case/4471/brief , https://8788-37c50edb-9314-4d3c-af56-e0df8916b0af.sandbox.superserve.ai/case/4471
  Supervisor:  https://8788-37c50edb-9314-4d3c-af56-e0df8916b0af.sandbox.superserve.ai/supervisor
- Only ONE bridge may run at a time (two would double-post into Relay). Local bridge stopped; local Vite proxies to the cloud bridge via BRIDGE_URL.
- Bench agents still run on this laptop (agents/launch.sh), talking to Relay directly; the cloud bridge mirrors them.
- Redeploy: rebuild tarball (bridge, actor/client/generated, web/dist, trimmed .env), `superserve cp`, `superserve exec understudy -- bash -c 'pkill bun; cd /home/user/app/bridge && set -a && . ../.env && set +a && nohup /opt/bun/bin/bun index.ts > /home/user/bridge.log 2>&1 &'`.
- FLOWS.html + docs/screens/: walkthrough of both flows with live screenshots.
