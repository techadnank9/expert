# HireXpert demo runbook (operator notes)

Local fallback terminals: T1 actor, T2 bridge, T3 web, T4 commands. Browser tabs: /onboard, /case/4471, /supervisor, and the Relay observer (read-only, channels case-4471 + case-4398).
Mint the observer link: `bunx agent-relay@15.0.1 observer --channels case-4471,case-4398 --expires 12h` (RELAY_WORKSPACE_KEY from .env). Keep the printed URL out of the repo.

## Deployed (preferred for the demo)
Bridge + web: https://8788-5975fada-698b-4c43-8ec3-1e554ae9d97c.sandbox.superserve.ai  (Superserve sandbox 'understudy'). Do NOT also run the local bridge.
Web: https://hirexpert-eta.vercel.app
Worker: https://hirexpert-eta.vercel.app/case/4471 · Supervisor: https://hirexpert-eta.vercel.app/supervisor · Poster: https://hirexpert-eta.vercel.app/post · Onboarding: https://hirexpert-eta.vercel.app/onboard
Actors: https://api.useterse.ai/cmvwuohyf00zwjy2a2dm8cjel/actors

## Before going on stage
Use the deployed web and bridge; local actor and web servers are not needed. Open /onboard and allow the business VM to reach ready before the timed demo. Mint a fresh Relay observer link above. Arm case 4398 four minutes before moment 5 using the command below.

On the Worker screen click **Start bench**, or run:
```bash
curl -X POST https://8788-5975fada-698b-4c43-8ec3-1e554ae9d97c.sandbox.superserve.ai/api/case/4471/startBench -H 'content-type: application/json' -d '[]'
```
Wait ~40 s for the three Codex processes inside the business VM, then Ask. Check the Worker workspace card for live agents and session logs.
Reset 4471 between runs: `curl -s -X POST https://8788-5975fada-698b-4c43-8ec3-1e554ae9d97c.sandbox.superserve.ai/api/case/4471/devReset -H 'content-type: application/json' -d '[]'`

## Bench: two ways
- Product way (story): /onboard shows the business VM biz-cedar-street-clinic ready; on /case/4471 click "Start bench" (POST /api/case/4471/startBench), wait ~40 s, then Ask. Agents run inside the VM; session logs listed on the Worker card.
- Laptop fallback: the laptop path passed twice end to end; the latest VM rehearsal had policy and billing replies, but appeals timed out on Relay (503/overload). If needed, stop the VM bench processes in the workstation before switching, then run these in three laptop terminals, reset 4471 and Ask:
  ```bash
  agents/launch.sh policy 4471 30
  agents/launch.sh billing 4471 30
  agents/launch.sh appeals 4471 30
  ```

## Moments
0. **Show onboarding -> VM provisioned (biz-cedar-street-clinic).** Open /onboard, show the ready business workspace, documents and **Open workstation** (VS Code in the browser, per-workspace password on the card). Explain that provisioning installs Codex + Relay MCP, connects Relay with `agent-relay init --key`, copies the documents and three prompts, and logs Codex in with the OpenAI API key. Real uploads land in `agents/docs/business` with PDF text extraction. Show /post carrying the workspace slug: posting creates the Case actor and #case-<id>; an atomic claim from /board grants the worker VM access. Return to demo case 4471.
1. /case/4471: click **Start bench** if not already started, wait ~40 s for the three Codex processes inside the business VM, then type the question and **Ask**. Switch to Relay dashboard #case-4471.
2. Agents reply in the thread, one disagreement, converge, :+1: on the recommendation.
3. Back to /case/4471: recommendation card, 3 of 3 agree, click "view session", Approve (or Override with a reason). Show /poster/4471/review: the poster reviews and approves, releasing pay.
4. Durability: restart the bridge + web service, then reload /case/4471. Case state and alarms remain in hosted Terse Durable Actors; the business VM keeps documents and Codex logs. Restarting a local actor does not test the hosted deployment. For a separately configured local demo, restart `terse actor dev` instead; `bun actor/client/durability.ts 4471` is the local backup proof.
5. /supervisor: 4398 goes amber when its alarm fires; alarm card appears; #case-4398 shows the case-actor post.
   Fallback if timing slips: "Fire alarms now" button in the Durable State panel, or `curl -X POST https://8788-5975fada-698b-4c43-8ec3-1e554ae9d97c.sandbox.superserve.ai/api/case/4398/fireDueAlarms -d '[]'`.
6. Close line.

## Arm the alarm for moment 5 (T-4 min)
```bash
curl -s -X POST https://8788-5975fada-698b-4c43-8ec3-1e554ae9d97c.sandbox.superserve.ai/api/case/4398/devReset -H 'content-type: application/json' -d '[{"escalateInSeconds":240}]'
```

## Reset between runs
Use the 4471 `devReset` command above and re-arm 4398 with its `devReset` command. These target the deployed actors; deleting local actor files does not reset them. Do not start another bench while the previous processes are still running.

For a separate local fallback, start `terse actor dev` from `actor/`, `bun index.ts` from `bridge/`, and `bun run dev` from `web/`, then seed with `bun seed/seed-cases.ts --alarm-seconds 240` from the repo root. Stop the deployed bridge before running a local bridge against the same Relay channels.
