# Understudy

**The $15 an hour expert.** A worker with judgment but no credential takes a job that used to need one, asks a bench of specialist agents, and approves what they agree on. Every decision is traceable to the agent session and the document that backed it.

Built at Haunted Hacks, San Francisco, October 31 2026, on **Terse Durable Actors** and **Agent Relay**. Both are load bearing.

## How one case flows through Understudy

```
 HUMANS                     TERSE DURABLE ACTOR                     AGENT RELAY BENCH

 Worker ───asks, approves──▶ Case actor  ──inbound webhook──▶ #case-4471 ──▶ Policy agent    (laptop 1)
  no credential,             @Persisted claim, docs,          one thread per    Billing agent   (laptop 2)
  good judgment              deadlines, decision log          question,         Appeals agent   (laptop 3)
                             @Emittable state to every        reactions as
 Supervisor ──supervises──▶  screen                           votes, every          │
  watches every case live         │                           message carries       │
                             Alarm ── wakes it                session_ref           │
                             no reply in 10 days,                                   │
                             escalate                     ◀──── typed Zod actions ──┘
                                                          post_recommendation, schedule_alarm, request_document
```

- **One Durable Actor per case.** The actor is the system of record for case state: claim, documents, deadlines, alarms, thread mirror, recommendation, decision log. Kill the server and the case comes back intact, pending alarms included.
- **Specialists coordinate over Agent Relay.** Each agent runs on a different laptop with `RELAY_ATTEST_SESSION_ID` set, so every reply carries `session_ref` and any expert can open the channel later and trace a reply back to the transcript that produced it. Agents touch the case only through actions scoped with `availableTo`.
- **A human stays in control.** Reactions are the vote ("3 of 3 agree"). The worker approves or overrides. Every approve or override lands in the persisted decision log as training signal.
- Both screens are WebSocket clients of the same actor, so a supervisor edit shows up on the worker's screen instantly.

## Repo layout

```
actor/     Terse actor project: Case and Board actors (actor/src/actor.ts), generated client in actor/client
bridge/    Bun process: Relay SDK, Zod actions, listeners, inbound webhooks, HTTP + WS server for the web app
agents/    system prompts for policy, billing, appeals and a launch script per machine
web/       Vite + React screens (Worker, Supervisor, Board, Brief, Post, Poster views)
seed/      seed-cases.ts loads the two demo cases
mockups/   the HTML designs the screens were ported from
```

## Run it

Prerequisites: Bun 1.4.2+, Node 22+, the Terse CLI (`bunx terse-cli@latest install`), a `.env` at the repo root (see `bridge/.env.example`).

```bash
cd actor && bun install && terse actor dev          # Durable Actors on :7100
```

```bash
cd bridge && bun install && bun setup.ts && bun index.ts   # Relay workspace, actions, webhooks, API on :8788
```

```bash
bun seed/seed-cases.ts --alarm-seconds 60            # cases 4471 and 4398, 4398 escalates in 60 s
```

```bash
cd web && bun install && bun run dev                 # http://localhost:5173/case/4471
```

Bench agents, one per laptop:

```bash
agents/launch.sh policy      # also: billing, appeals
```

Hosted actors: `terse deploy` from `actor/`, then export `TERSE_ACTOR_URL` and `TERSE_API_KEY` before `terse actor generate` in `actor/client` and the bridge talks to the deployed actors instead.

## Demo, 90 seconds

1. Worker screen, case 4471. Maya has no billing credential. She asks the bench.
2. Agent Relay, channel `#case-4471`: three agents from three laptops reply, disagree once, converge, react thumbs up.
3. Back on the Worker screen the recommendation card shows 3 of 3 agree with citations. "View session" opens the transcript it came from. Approve.
4. Kill the actor process. Restart. Reload. Everything is still there, alarms still pending. That is a Durable Actor.
5. Supervisor screen: case 4398's alarm fires live. The row turns amber, the alarm card appears, the same event is visible in `#case-4398`.

See `HANDOFF.md` for the full spec and `STATUS.md` for what works, what is stubbed and what was cut.
