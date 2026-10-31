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
