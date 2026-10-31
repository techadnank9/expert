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

## 13:35 update
- Works: actor/ compiles and runs on `terse actor dev` (:7100). Case + Board actors with all HANDOFF methods. Alarms use real Terse `this.alarm.set()` + `onAlarm()`; one hardware alarm re-armed to the earliest unfired logical alarm.
- Decision: skipped `terse init` (CLI says "Not authenticated" even after `terse auth login` succeeded; `terse actor dev` works without it). Hand-scaffolded actor/package.json. Revisit only for `terse deploy`.
- Decision: Case `id` is the Terse actor id (`this.id`), not a persisted field (SDK forbids overriding `id`). Emitted state lacks `id`; web uses the route param.
- Decision: actor cannot be assumed to make outbound HTTP; it `broadcast`s `asked`, `alarm_fired`, `event` socket messages and the bridge posts into Relay on its behalf.
- Stubbed: nothing in actor. Bridge + web in progress via subagents.
