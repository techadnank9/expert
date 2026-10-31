# Demo runbook (operator notes)

Terminals: T1 actor, T2 bridge, T3 web, T4 commands. Browser tabs: /case/4471, /supervisor, and the Relay observer (read-only, channels case-4471 + case-4398).
Mint the observer link: `bunx agent-relay@15.0.1 observer --channels case-4471,case-4398 --expires 12h` (RELAY_WORKSPACE_KEY from .env). Keep the printed URL out of the repo.

## Deployed (preferred for the demo)
Bridge + web: https://8788-5975fada-698b-4c43-8ec3-1e554ae9d97c.sandbox.superserve.ai  (Superserve sandbox 'understudy'). Do NOT also run the local bridge.
Worker: https://8788-5975fada-698b-4c43-8ec3-1e554ae9d97c.sandbox.superserve.ai/case/4471 · Supervisor: https://8788-5975fada-698b-4c43-8ec3-1e554ae9d97c.sandbox.superserve.ai/supervisor · Poster: https://8788-5975fada-698b-4c43-8ec3-1e554ae9d97c.sandbox.superserve.ai/post

## Before going on stage (T-3 min)
```bash
cd actor && terse actor dev                      # T1
# T2: bridge already runs in the Superserve sandbox. Local fallback only: cd bridge && bun index.ts
cd web && bun run dev                            # T3
bun seed/seed-cases.ts --alarm-seconds 240       # T4, 4398 escalates in 4 min: fires during step 5
```
Agents (this laptop, three terminal tabs, launch BEFORE asking): `agents/launch.sh policy 4471 30`, same for billing and appeals.
Reset 4471 between runs: `curl -s -X POST https://8788-5975fada-698b-4c43-8ec3-1e554ae9d97c.sandbox.superserve.ai/api/case/4471/devReset -H 'content-type: application/json' -d '[]'`

## Moments
1. /case/4471: type the question, Ask. Switch to Relay dashboard #case-4471.
2. Agents reply in the thread, one disagreement, converge, :+1: on the recommendation.
3. Back to /case/4471: recommendation card, 3 of 3 agree, click "view session", Approve.
4. T1: Ctrl-C. `terse actor dev` again. Reload /case/4471. State + alarms intact.
   Backup proof: `bun actor/client/durability.ts 4471` before and after.
5. /supervisor: 4398 goes amber when its alarm fires; alarm card appears; #case-4398 shows the case-actor post.
   Fallback if timing slips: "Fire alarms now" button in the Durable State panel, or `curl -X POST https://8788-5975fada-698b-4c43-8ec3-1e554ae9d97c.sandbox.superserve.ai/api/case/4398/fireDueAlarms -d '[]'`.
6. Close line.

## Arm the alarm for moment 5 (T-4 min)
```bash
curl -s -X POST https://8788-5975fada-698b-4c43-8ec3-1e554ae9d97c.sandbox.superserve.ai/api/case/4398/devReset -H 'content-type: application/json' -d '[{"escalateInSeconds":240}]'
```

## Reset between runs
```bash
rm -rf actor/.durable-actors && bun seed/seed-cases.ts --alarm-seconds 240
```
(The bridge recreates #case-NNNN channels idempotently.)
