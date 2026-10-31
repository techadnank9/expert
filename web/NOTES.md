# web/ notes

Vite + React 19 + TypeScript, plain CSS (`src/index.css`, tokens from the mockups), react-router-dom.

## Run

```
cd web
bun install
bun run dev        # http://localhost:5173  (strictPort)
bun run build      # tsc -b && vite build, zero TS errors
```

`/` redirects to `/case/4471`. With no bridge running every screen renders from `src/fixtures.ts`
and the header shows an amber dot plus "bridge offline, showing fixtures".

Bridge URL: in `vite dev`, `/api/*` is proxied to `http://localhost:8788` (no CORS needed).
For `vite preview`/builds it calls `http://localhost:8788` directly, so the bridge must send CORS
headers and answer `OPTIONS`. Override with `VITE_BRIDGE_URL=...`.

## Routes

| Route | Mockup | State |
|---|---|---|
| `/case/:id` | Worker.html | P0, done. Thread, recommendation card ("3 of 3 agree" reaction pill), Approve / Override (reason via prompt) / Send back to bench (ask), Ask box, Deadlines and alarms with live countdowns, Decision log, Durable State panel with dev "Fire alarms now" + per-alarm "fire". "view session" links → `https://agentrelay.com/sessions/${sessionRef}`. |
| `/supervisor` | Supervisor.html | P0, done. Live rows for 4471 and 4398 (one `useCase` each) + the 4 decorative mockup rows. Row turns amber and an AlarmCard appears when status is `escalated` or any alarm has `fired`. Before that a quiet card shows "case 4398 escalates in 0:57". Take the case → `claim({name:'Dana K.'})`, Snooze → `scheduleAlarm(+2d,'escalate')`. |
| `/board` | Find1.html | Done. `useBoard()`, Claim → `callBoard('claim', jobId, {name:'Maya Chen'})`, then navigates to the brief. Second claim shows the error inline. |
| `/case/:id/brief` | Find2.html | Done. Built from the case thread (latest substantive message per agent). |
| `/post` | Post1.html | Done. Form → `callBoard('post', job)` (id = random 45xx), then `/poster/:id`. |
| `/poster/:id` | Post2.html | Done. Read-only thread, 5-step timeline driven by status, note to worker → `appendThreadMessage({author:'poster',...})`. |
| `/poster/:id/review` | Post3.html | Done. Approve → `posterApprove()`. Request changes → `appendThreadMessage`. |

## api.ts

- `useCase(id)` / `useBoard()` return `{ data, offline, loading, connected, lastWrite }`.
  GET state → GET `.../ws-url` → open WebSocket → `{type:'state'}` replaces, `{type:'state_update', changes}` merges.
  `changes` may be a partial object or an array of `{path|key|field, value}`; both handled. Other socket message types are ignored.
- Bridge down → fixtures, `offline: true`, retries every 5 s and switches to live by itself when the bridge comes up. Socket close → reconnect after 2 s.
- `callCase(id, method, ...args)` → `POST /api/case/:id/:method` with JSON array body, then re-fetches state.
  `callBoard(method, ...args)` → `POST /api/board/:method`, then re-fetches.
- Case state from the bridge is normalised (missing `id` filled from the route param, missing arrays defaulted), per STATUS.md "Emitted state lacks id".
- One shared store per actor, so every component showing case 4471 updates together.

## Stubbed / offline-only

- Offline, `callCase`/`callBoard` run a local simulation of the actor methods (`applyCase` / `applyBoard` in api.ts) so every button works for a no-backend demo. Online they never run.
- Offline, due alarms fire on their own (1 s ticker calling the local `fireDueAlarms`). Case 4398's escalate alarm is seeded 60 s after the page first loads it, so `/supervisor` turns amber about a minute in.
- Static copy kept from the mockups: supervisor stats (42 open, 61 recommendations; "alarms fired" and "waiting" add live counts), 4 decorative case rows, worker standing, letter text on Post3, checklist, filters (not functional), "Release the job", "Upload document", "Add documents", "Save draft".
- "Open in Relay" / channel links go to `https://agentrelay.com` (no per-channel URL documented).
- Mockups say "Maya R."; per instructions the worker is Maya Chen, shown as "Maya C." / "MC".
- Fixture 4471 thread adds a Billing vs Appeals disagreement (corrected claim vs appeal) before convergence.
