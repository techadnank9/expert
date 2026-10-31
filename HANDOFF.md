# Understudy: hackathon build handoff

Read this whole file before writing code. It is the spec, the plan, and the cut list.
The `mockups/` folder holds the UI as HTML. Match its layout and copy; the inline styles are the design.

## 0. Hard constraints

- Event: Haunted Hacks, San Francisco, Oct 31, 2026. Hacking started 11:00. **Submission deadline 16:00. Judging 16:00 to 17:00 by live demo.**
- Current time when this handoff was written: 13:00. You have about 2 h 45 min of build time, then 15 min to rehearse.
- All code must be written at the hackathon. No copying old repos.
- Judges want either a very well executed product or a very creative use of **Terse Durable Actors** and **Agent Relay**. Bonus for using both. We use both, and both are load bearing.
- Prize tracks we are going for: best overall (YC interview), best Durable Actors project, best Agent Relay project.
- Pitch frame: YC's "The $15 an hour expert" request for startups. An ordinary worker plus a bench of specialist agents does work that used to need a credential. Understudy is the infrastructure for that.

## 1. Product in five sentences

A poster (clinic, firm, individual) posts a job that needs expert work, for example appealing a denied medical claim. A worker with judgment but no credential claims it. Each job is a **Durable Actor** that holds the case state, documents, decision log, deadlines and alarms. The worker asks a **bench** of three specialist agents, each running on a different machine, who debate on an **Agent Relay** channel and post one recommendation back into the case. The worker approves or overrides, the deliverable goes to the poster for review, and every step is persisted and traceable back to the agent session that produced it.

## 2. Architecture

```
Worker browser  ─┐                       ┌─ Policy agent   (laptop 1, Claude Code or Codex harness)
Supervisor UI   ─┼─ WebSocket ─ Case actor (Terse) ─ bridge.ts ─ Agent Relay ─┼─ Billing agent  (laptop 2)
Poster UI       ─┘               │  @Persisted state         channel #case-NNNN    └─ Appeals agent  (laptop 3)
                                 │  @Emittable to clients
                                 └─ Alarms (deadline nudge, escalation)
Board actor (Terse) ─ one global actor listing open jobs, claim() is the only way to take a job
```

Rule: **the actor is the system of record for case state. Relay is the system of record for reasoning and provenance.** Never duplicate, always link.

### 2.1 Terse Durable Actors (TypeScript, Bun 1.4.2+)

Docs: https://docs.useterse.ai/quickstart and the TypeScript guide linked from it. Verify every API name against the docs before using it; the names below are from the quickstart and may differ slightly for alarms.

- Install CLI, `terse init understudy --template counter`, then replace the counter.
- `terse actor dev` runs locally. `terse deploy` ships it. `terse actor generate` in the client folder regenerates the typed client after actor changes.
- Decorators: `@Persisted` saves a field, `@Emittable` syncs it to connected clients. `onMessage(socket, msg)` receives WebSocket messages. `this.broadcast(...)` pushes to all connected clients.
- Alarms exist per the docs' topic list. Find the exact API in the TypeScript guide. If alarms turn out to be hard, fall back to a `setAlarm(at)` method that stores the time and a dev only "fire alarms now" button for the demo. Do not spend more than 20 minutes on alarms.

### 2.2 Agent Relay

Docs: https://agentrelay.com/docs (also https://agentrelay.com/docs/markdown/introduction.md and sibling .md pages). Repo: https://github.com/agentworkforce/relay. SDK: `npm install @agent-relay/sdk zod`. Node 22+.

Confirmed primitives:
- Workspace: `AgentRelay.createWorkspace({ name })` once, then `new AgentRelay({ workspaceKey })`. Store the key in `RELAY_WORKSPACE_KEY`.
- Register: `relay.workspace.register({ name, type: 'agent' })` returns an agent client. `createHuman({ relay, name })` for people.
- Messaging: `agent.sendMessage({ to: '#channel' | '@handle', text })` returns `{ messageId }`. `agent.reply({ messageId, text })` threads. `agent.react({ messageId, emoji })`. `agent.channels.create({ name, topic })`, `agent.channels.join(name)`, `agent.threads.get(messageId, { limit })`.
- Events: `relay.addListener('message.created', ({ message }) => ...)`, also `'action.*'`, `agent.status.becomes('idle')`. Returns an unsubscribe function.
- Actions: `relay.registerAction({ name, description, input: zodSchema, availableTo: [...handles], handler })`. Exposed to agents as typed MCP tools. Results arrive as `action.completed` events, not return values.
- Webhooks: `relay.webhooks.createInbound({ channel })` returns URL and bearer token, POST `{ message, author }`. `relay.webhooks.subscribe({ url, events, secret })` for outbound, HMAC signed.
- Harnesses: `@agent-relay/harnesses` has `claude.create({ relay, model })` and `codex.create({ relay, model })`. CLI alternative: `agent-relay node agent spawn claude --runtime native --name policy`.
- Provenance: set `RELAY_ATTEST_SESSION_ID` in each agent's environment so every send carries `metadata.session_ref`. This is what the "view session" links in the UI point to.

Not documented, do not depend on: a search API. "Searchable" in the demo means the Relay dashboard's own search.

### 2.3 Conventions we commit to

1. One Relay channel per case: `#case-<id>`, created by the bridge when the actor is created. Topic is the job title.
2. One thread per worker question. The root message is the question, agents `reply` in the thread, the recommendation is the last reply.
3. Reactions are votes. Agents react thumbs up on the recommendation. "3 of 3 agree" is the reaction count. Worker approval is a check mark reaction plus an actor method call.
4. Agents touch the case **only** through actions: `post_recommendation`, `schedule_alarm`, `request_document`. Each has a Zod schema and `availableTo` scoped to the three agent handles.
5. The actor posts into the channel through the inbound webhook as author `case-actor` (case opened, alarm fired, approval recorded). Humans and agents see the same history.
6. The bridge mirrors each thread into the actor (`thread: Message[]`) so the Worker screen renders from one WebSocket.

## 3. Data model

### Case actor (`Case:<id>`)

```ts
@Persisted @Emittable id: string
@Persisted @Emittable title: string               // "Appeal denied lumbar MRI, CPT 72148"
@Persisted @Emittable domain: 'medical-billing'
@Persisted @Emittable poster: { name: string }
@Persisted @Emittable worker: { name: string } | null
@Persisted @Emittable status: 'open' | 'claimed' | 'consulting' | 'recommended' | 'drafted' | 'awaiting_poster' | 'approved' | 'escalated'
@Persisted @Emittable facts: { payer, amount, denialCode, dateOfService, reason }
@Persisted @Emittable documents: { name, pages, source }[]
@Persisted @Emittable deadline: string             // ISO
@Persisted @Emittable alarms: { id, at, kind: 'nudge' | 'escalate', fired: boolean }[]
@Persisted @Emittable relay: { channel: string, threadRootId?: string, recommendationId?: string }
@Persisted @Emittable thread: { id, author, address?, sessionRef?, text, at, reactions: Record<string, string[]> }[]
@Persisted @Emittable recommendation: { summary, steps: string[], sources: string[], agrees: string[] } | null
@Persisted @Emittable decisionLog: { at, actor, event, reason? }[]
@Persisted @Emittable pay: { amount: number, released: boolean }
```

Methods (each appends to `decisionLog` and broadcasts):
`create(input)`, `claim(worker)`, `ask(question)`, `appendThreadMessage(msg)`, `postRecommendation(rec)`, `approveRecommendation()`, `overrideRecommendation(reason)`, `submitDeliverable(files, note)`, `posterApprove()`, `scheduleAlarm(at, kind)`, `fireAlarm(id)`, `escalate(reason)`.

### Board actor (`Board:main`)

```ts
@Persisted @Emittable jobs: { id, title, domain, poster, pay, deadline, estMinutes, status: 'open' | 'claimed', worker? }[]
```
`post(job)` creates the Case actor and the Relay channel (via bridge), `claim(jobId, worker)` is atomic because the actor is single threaded: first caller wins, second gets an error.

## 4. Repo layout

```
understudy/
  actor/            Terse actor project (Case, Board)
  bridge/           Bun or Node process: Relay SDK, actions, listeners, webhooks, Terse generated client
  agents/           system prompts for policy, billing, appeals + a launch script per machine
  web/              Vite + React (or plain HTML + the generated Terse client). Screens below.
  mockups/          the HTML from this handoff, reference only
  seed/             seed-cases.ts, loads 2 cases so alarms have something to fire on
  HANDOFF.md
```

## 5. Screens, in priority order

Mockup file in `mockups/` → route.

| Priority | Screen | Mockup | Route | Notes |
|---|---|---|---|---|
| P0 | Worker case view | `Worker.html` | `/case/:id` | The demo screen. Thread, recommendation card with reaction row, Approve/Override, Durable State panel. |
| P0 | Supervisor view | `Supervisor.html` | `/supervisor` | Table of cases, alarm card. Shows escalation when alarm fires. |
| P1 | Job board | `Find1.html` | `/board` | Subscribes to Board actor. Claim button. |
| P1 | Claim and brief | `Find2.html` | `/case/:id/brief` | Static brief from bench pre read. Can be stubbed with the thread's first messages. |
| P2 | Post a job | `Post1.html` | `/post` | Form that calls `Board.post`. |
| P2 | Job in progress (poster) | `Post2.html` | `/poster/:id` | Read only view of the same actor. Cheap once Worker view exists. |
| P2 | Review and approve (poster) | `Post3.html` | `/poster/:id/review` | Calls `posterApprove`. |
| P3 | Submit and get paid | `Find3.html` | `/case/:id/submit` | Only if time remains. |
| ref | System flow diagram | `Main.html` | none | For the README and the pitch slide. |

Shared header, colors and type are identical across mockups: ground `#F6F5F1`, surface `#FFFFFF`, border `#E2DFD6`, ink `#1C1C1E`, muted `#5F5E5A`, agent blue `#2F4BD6`, approve green `#1E6B3A`, alarm amber `#8A4B00` on `#FBEFD5`, Inter.

## 6. Build order with time boxes

Work in parallel across machines where marked. Commit every 20 minutes.

**13:05 to 13:40, actor (machine A)**
1. `terse init`, define `Case` and `Board` with the fields above, methods as plain mutations plus `broadcast`.
2. `terse actor dev`, generate client, smoke test `create`, `ask`, `appendThreadMessage` from a script.
3. Alarms: find the API, implement `scheduleAlarm` and `fireAlarm`. 20 minute cap, then fallback.

**13:05 to 13:40, Relay (machine B)**
1. Create workspace, save key. Register `policy`, `billing`, `appeals`, `case-actor`, humans `maya`, `dana`.
2. `bridge/index.ts`: register the three actions with Zod schemas, `addListener('message.created')` that filters by channel prefix `case-` and calls `Case.appendThreadMessage`. Stub the Terse client until machine A publishes it.
3. Inbound webhook per channel, store URL and token on the actor's `relay` field.

**13:05 to 13:40, web (machine C)**
1. Scaffold web, port `Worker.html` to a component tree fed by a `useCase(id)` hook over the Terse WebSocket. Hardcode fixture data first.
2. Port `Supervisor.html` the same way.

**13:40 to 14:30, integrate**
1. Wire bridge to the real actor client. `ask()` on the actor → bridge posts the question into `#case-<id>` as the worker, stores `threadRootId`.
2. Launch the three agents on three laptops with harnesses, system prompts in `agents/`, `RELAY_ATTEST_SESSION_ID` set, all joined to the channel. Each prompt: you are the X specialist, reply only in the thread you are mentioned in, be concrete, cite the document and section, react thumbs up on a recommendation you agree with, call `post_recommendation` only when you are the Appeals agent and the others have agreed.
3. Run one real question end to end. Fix until the recommendation renders in the Worker screen.

**14:30 to 15:10, the two demo moments**
1. Durability: kill `terse actor dev` mid case, restart, reload, confirm state and pending alarms are intact. If deployed, demonstrate on the deployed actor instead.
2. Alarm: seed case 4398 with an alarm 60 seconds in the future, confirm `fireAlarm` posts into `#case-4398` via webhook, sets `status: 'escalated'`, and the Supervisor view highlights the row and shows the alarm card.

**15:10 to 15:40, breadth**
Board + claim, then Post a job, then poster views. Stop adding at 15:40 whatever state they are in.

**15:40 to 16:00**
Seed data, README with the flow diagram, record a 90 second backup video, submit on Builderbase.

## 7. Cut list, in order

1. Find3 submit screen (show the poster review instead)
2. Poster screens (describe them in the pitch, show mockups)
3. Alarms via real Terse alarm API (fallback to stored time plus a dev "fire now" button)
4. Three machines (run two agents on one laptop if a teammate's setup fails; never fewer than two machines, cross machine is the Relay story)
5. `terse deploy` (demo on local dev server if deploy misbehaves)

Never cut: the thread rendered from the actor, reactions as the vote, `session_ref` links, the kill and restart moment, the alarm firing into the Supervisor view.

## 8. Demo script, 90 seconds

1. Worker screen, case 4471. "Maya has no billing credential. She asks the bench." Type the question, hit Ask.
2. Second screen: Agent Relay dashboard, channel `#case-4471`. Three agents from three laptops reply, disagree once, converge, react thumbs up.
3. Back to Worker screen: the recommendation card is there with 3 reactions and citations. Click "view session" on one message to show the transcript it came from. Approve.
4. Kill the actor process on camera. Restart. Reload. Everything is still there, two alarms still pending. "That is a Durable Actor."
5. Supervisor screen: case 4398's alarm fires live (seeded 60 seconds earlier). Row turns amber, alarm card appears, the same event is visible in `#case-4398` in Relay.
6. One line close: "Every $15 an hour decision is traceable to the exact agent session and document that backed it. That is what makes it safe to let non experts do expert work. YC published a request for exactly this two days ago."

## 9. Environment

```
TERSE_ACTOR_URL=
TERSE_API_KEY=
RELAY_WORKSPACE_KEY=
RELAY_ATTEST_SESSION_ID=   # set per agent process
OPENAI_API_KEY=            # $100 credits per participant, use for agents if harness supports it
```

## 10. Open questions to resolve by reading docs, not by guessing

- Exact Terse alarm API and whether an actor can make outbound HTTP (needed for the actor to hit the Relay inbound webhook directly; if not, the bridge does it on the actor's behalf from a `message.created` style event or by polling `alarms`).
- Whether the Terse generated client works in the browser or only in Bun. If browser is unsupported, the web app talks to a tiny Bun server that holds the client and relays over WebSocket.
- Which harness runtime works on each teammate's machine (`native` vs `pty`).
