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
  https://8788-5975fada-698b-4c43-8ec3-1e554ae9d97c.sandbox.superserve.ai
  Poster side: https://8788-5975fada-698b-4c43-8ec3-1e554ae9d97c.sandbox.superserve.ai/post , https://8788-5975fada-698b-4c43-8ec3-1e554ae9d97c.sandbox.superserve.ai/poster/4471 , https://8788-5975fada-698b-4c43-8ec3-1e554ae9d97c.sandbox.superserve.ai/poster/4471/review
  Worker side: https://8788-5975fada-698b-4c43-8ec3-1e554ae9d97c.sandbox.superserve.ai/board , https://8788-5975fada-698b-4c43-8ec3-1e554ae9d97c.sandbox.superserve.ai/case/4471/brief , https://8788-5975fada-698b-4c43-8ec3-1e554ae9d97c.sandbox.superserve.ai/case/4471
  Supervisor:  https://8788-5975fada-698b-4c43-8ec3-1e554ae9d97c.sandbox.superserve.ai/supervisor
- Only ONE bridge may run at a time (two would double-post into Relay). Local bridge stopped; local Vite proxies to the cloud bridge via BRIDGE_URL.
- Bench agents still run on this laptop (agents/launch.sh), talking to Relay directly; the cloud bridge mirrors them.
- Redeploy: rebuild tarball (bridge, actor/client/generated, web/dist, trimmed .env), `superserve cp`, `superserve exec understudy -- bash -c 'pkill bun; cd /home/user/app/bridge && set -a && . ../.env && set +a && nohup /opt/bun/bin/bun index.ts > /home/user/bridge.log 2>&1 &'`.
- FLOWS.html + docs/screens/: walkthrough of both flows with live screenshots.

## 14:12 update
- Works (cloud): poster flow live. Board.post -> bridge creates Case actor + #case-<id> channel + webhook; Board.claim -> Case.claim; second claim rejected ("already claimed"). Tested with job 4490.
- Deploy script: deploy/superserve.sh (rebuild web, tarball, cp, restart bridge).
- Rehearsal 1 started 14:12 on the deployed stack.

## 14:22 update
- Moved deployment to the credited Superserve account (SUPERSERVE_API_KEY_2). New sandbox 5975fada; old sandbox 37c50edb bridge stopped (paused). deploy/superserve.sh now uses SUPERSERVE_API_KEY_2 by default.
- Rehearsal 1 on the deployed stack: ask -> 3 agent replies with citations -> Recommendation lifted -> 3 of 3 agree -> Approve -> drafted. PASS.

## 14:35 update
- Rehearsal 2 on the deployed stack: PASS (ask -> 3 replies -> Recommendation -> 3 of 3 -> Approve -> drafted). Two consecutive passes, per HANDOFF rule 7.
- Landing page at / redesigned (fastwork-style hero, product mock, reveals; web/src/pages/Landing.tsx + web/src/landing.css). Deployed.
- Pending: nicer URL via Vercel (needs user to approve `vercel login`); GitHub push (not done, awaiting user).
- Known: 390px landing layout unverified visually (no horizontal overflow measured).

## 15:15 update — HireXpert, business workspace VMs
- Product renamed HireXpert. Web on Vercel: https://hirexpert-eta.vercel.app (API = Superserve bridge, CORS allows that origin). hirexpert.vercel.app / understudy.vercel.app are NOT ours.
- New (real, verified live): business onboarding provisions a Superserve VM per business (bridge/workspace.ts drives the superserve CLI: sandbox create, copy agents/ + env, install Codex, API-key login, warm Relay MCP). `POST /api/workspace/provision`, `GET /api/workspace/:slug` (live agents, files, Codex session logs), `POST /api/case/:id/startBench` launches the 3 bench agents INSIDE the business VM for that case; `Board.claim` grants the worker access (`grantWorkspace`). Case actor has `workspace` persisted field.
- Verified: biz-cedar-street-clinic VM provisioned by the bridge; startBench launched 3 Codex agents inside it; they picked up the 4471 question from Relay.
- Web: /onboard page, WorkspaceCard on Worker + Poster screens, workspace badge on board jobs (offline simulation when bridge down).
- Known: workspace registry is a JSON file on the bridge VM (/home/user/workspaces.json), not in the actor; Vercel direct deployment URLs are SSO-protected (use the alias).

## 15:50 final
- Web: https://hirexpert-eta.vercel.app (landing: light hero, rotating cursive word, onboarding CTA; /onboard, /post, /board, /case/4471, /poster/4471, /supervisor). Deploy: deploy/vercel.sh (relinks project "hirexpert"; vite wipes dist/.vercel). Bridge + web: https://8788-5975fada-698b-4c43-8ec3-1e554ae9d97c.sandbox.superserve.ai (deploy/superserve.sh).
- Business VM path (startBench): verified that provision -> 3 Codex agents start inside biz-cedar-street-clinic -> policy and billing replied in #case-4471 with their own session refs, documents read from the VM. Appeals timed out on Relay (503/overload) in that run, so no recommendation from the VM path yet. Laptop path (agents/launch.sh) passed twice end to end. DEMO: start the VM bench for the story, keep laptop agents as the reliable fallback.
- Cut / not done: Codex docs refresh (.codex-tasks/docs-refresh.md) not run (sandbox blocked launching Codex); FLOWS.html still describes the pre-VM flow; 390px landing unverified; GitHub push pending user OK; Vercel project "dist" created by accident, not deleted (needs user).

## 15:05 (second session) — workstation
- Each business VM now runs code-server (VS Code in the browser) published on a preview URL; "Open workstation" button on the onboarding and workspace cards, password shown on the card. biz-taxing and biz-cedar-street-clinic both ready with IDE URLs. Shell command moved under "Advanced".
- Real file uploads: /onboard queues files, uploads to POST /api/workspace/:slug/files, bridge copies into the VM at agents/docs/business and extracts PDF text; agents read docs/business too.
- Inner pages re-skinned to the landing palette (tokens in index.css, floating pill header).
- Start bench auto-provisions the business VM when the poster never onboarded. Provision accepts {force:true} to upgrade an existing VM.
- Not done: business console to chat with agents directly (agents still work per case thread); Relay share link expired (needs a fresh link); GitHub push still needs the user's two commands.

## 15:50 (second session) — final
- Landing: workspace-first copy ("Your business, with a <digital workspace>"), 5-category hover mega-menu, three easy steps (onboard, create your digital workspace, hire workers), business-language "under the hood". /how-it-works page with architecture SVG, job timeline, sponsor cards. README rewritten with badges, Mermaid architecture + sequence diagrams, fresh screenshots, API table, FAQ; MIT LICENSE added. FLOWS.html + DEMO.md refreshed by Codex.
- Workstations: code-server per business VM under a supervisor loop; GET /api/workspace/:slug self-heals it; three VMs live (biz-taxing, biz-cedar-street-clinic, biz-accounting). Password shown on the case card only after access is granted.
- Provisioning now also runs `agent-relay init --key` inside each VM so the VM's Codex is connected to the Relay workspace.
- Pending: GitHub push (user runs: gh auth switch -u techadnank9 && git push -u origin main); Relay share upload (both links returned 404/expired on POST); Claude MCP agent-relay-sessions needs /mcp sign-in in an interactive claude session.

## 16:30 (second session)
- Demo video: demo/demo.mp4 (also docs/demo.mp4), 69 s, 1080p, ElevenLabs narration; scenes are live screenshots; rebuild with demo/build.sh (script in demo/script.json).
- Terse Business actor added (one per business: workspace, documents, access, jobs); bridge writes through; GET /api/business/:slug. Three businesses backfilled.
- Landing: sourced comparison strip (SHRM, BLS, Fiverr, Upwork, KFF), proof line, sources block, announcement bar.
