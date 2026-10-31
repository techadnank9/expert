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
