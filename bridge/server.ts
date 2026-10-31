// HTTP + WS bridge for the browser (CONTRACT.md "WebSocket to browser").
import type { ServerWebSocket } from 'bun';
import type { CaseState, CaseStore, TerseCaseStore } from './casestore';
import { approveAsWorker, askAsWorker, openCaseChannel, postAsActor, rememberWebhook } from './relay';

const ORIGIN = process.env.WEB_ORIGIN ?? 'http://localhost:5173';
const cors = {
  'access-control-allow-origin': ORIGIN,
  'access-control-allow-methods': 'GET,POST,OPTIONS',
  'access-control-allow-headers': 'content-type,authorization',
};
const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json', ...cors } });

type WsData = { kind: 'case' | 'board'; id: string; off?: () => void };

/** Relay side effects of actor methods (bridge acts for the actor and the worker). */
async function afterCaseCall(store: CaseStore, id: string, method: string, args: any[], before: CaseState | null, state: CaseState): Promise<CaseState> {
  const bg = (p: Promise<unknown>) => p.catch((e) => console.warn(`[bridge] relay side effect for ${method} failed:`, e.message));
  switch (method) {
    case 'create': {
      const r = await openCaseChannel(id, state.title);
      state = await store.setRelayInfo(id, r);
      bg(postAsActor(id, `Case ${id} opened: ${state.title}`));
      break;
    }
    case 'ask': {
      if (!state.relay.webhookUrl) state = await store.setRelayInfo(id, await openCaseChannel(id, state.title));
      const threadRootId = await askAsWorker(id, String(args[0]));
      state = await store.setRelayInfo(id, { threadRootId });
      break;
    }
    case 'approveRecommendation':
      if (state.relay.recommendationId) bg(approveAsWorker(state.relay.recommendationId));
      bg(postAsActor(id, `Approval recorded: ${state.worker?.name ?? 'worker'} approved the recommendation.`));
      break;
    case 'overrideRecommendation':
      bg(postAsActor(id, `Override recorded: ${args[0] ?? ''}`));
      break;
    case 'fireAlarm':
    case 'fireDueAlarms': {
      const fired = state.alarms.filter((a) => a.fired && !before?.alarms.find((b) => b.id === a.id)?.fired);
      for (const a of fired) bg(postAsActor(id, `Alarm fired: ${a.kind} (${a.id}, due ${a.at}). Status: ${state.status}.`));
      break;
    }
    case 'escalate':
      bg(postAsActor(id, `Escalated to supervisor: ${args[0] ?? ''}`));
      break;
  }
  return state;
}

export function startServer(store: CaseStore, port = Number(process.env.BRIDGE_PORT ?? 8788)) {
  const server = Bun.serve<WsData, {}>({
    port,
    async fetch(req, srv) {
      const url = new URL(req.url);
      const p = url.pathname.split('/').filter(Boolean);
      if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
      try {
        // WS (memory store only)
        if (p[0] === 'ws' && p[1] === 'case' && p[2]) return srv.upgrade(req, { data: { kind: 'case', id: p[2] } }) ? undefined : json({ error: 'upgrade failed' }, 400);
        if (p[0] === 'ws' && p[1] === 'board') return srv.upgrade(req, { data: { kind: 'board', id: 'main' } }) ? undefined : json({ error: 'upgrade failed' }, 400);
        if (p[0] === 'health') return json({ ok: true, store: store.kind });
        if (p[0] !== 'api') return json({ error: 'not found' }, 404);

        if (p[1] === 'board') {
          if (req.method === 'GET' && !p[2]) return json(await store.getBoard());
          if (req.method === 'GET' && p[2] === 'ws-url') return json({ websocketUrl: await wsUrl(store, 'Board', 'main', url) });
          if (req.method === 'POST' && p[2]) {
            const args = await readArgs(req);
            const board = await store.callBoard(p[2], args);
            if (p[2] === 'post' && args[0]?.id) {
              const s = await store.getCase(String(args[0].id));
              if (s) await afterCaseCall(store, s.id, 'create', [], null, s).catch((e) => console.warn('[bridge] open channel failed:', e.message));
            }
            return json(board);
          }
        }
        if (p[1] === 'case' && p[2]) {
          const id = p[2];
          if (req.method === 'GET' && !p[3]) {
            const s = await store.getCase(id);
            return s ? json(s) : json({ error: `no case ${id}` }, 404);
          }
          if (req.method === 'GET' && p[3] === 'ws-url') return json({ websocketUrl: await wsUrl(store, 'Case', id, url) });
          if (req.method === 'POST' && p[3]) {
            const args = await readArgs(req);
            const before = await store.getCase(id);
            let state = await store.callCase(id, p[3], args);
            state = await afterCaseCall(store, id, p[3], args, before, state);
            return json(state);
          }
        }
        return json({ error: 'not found' }, 404);
      } catch (e) {
        return json({ error: (e as Error).message }, 400);
      }
    },
    websocket: {
      async open(ws: ServerWebSocket<WsData>) {
        const d = ws.data;
        if (d.kind === 'case') {
          const s = (await store.getCase(d.id)) ?? (await store.callCase(d.id, 'getState', []));
          ws.send(JSON.stringify({ type: 'state', state: s }));
          d.off = store.subscribeCase(d.id, (state) => ws.send(JSON.stringify({ type: 'state_update', changes: state })));
        } else {
          ws.send(JSON.stringify({ type: 'state', state: await store.getBoard() }));
          d.off = store.subscribeBoard((state) => ws.send(JSON.stringify({ type: 'state_update', changes: state })));
        }
      },
      message() {},
      close(ws: ServerWebSocket<WsData>) {
        ws.data.off?.();
      },
    },
  });

  // Memory store: fire due alarms every 5 s (Terse actor owns its own alarms).
  if (store.kind === 'memory') {
    setInterval(async () => {
      for (const id of ['4471', '4398', ...((globalThis as any).__extraCaseIds ?? [])]) {
        const before = await store.getCase(id);
        if (!before?.alarms.some((a) => !a.fired && Date.parse(a.at) <= Date.now())) continue;
        const state = await store.callCase(id, 'fireDueAlarms', []);
        await afterCaseCall(store, id, 'fireDueAlarms', [], before, state);
        console.log(`[alarm] case ${id} fired due alarms -> status ${state.status}`);
      }
    }, 5000);
  }
  console.log(`[bridge] http://localhost:${server.port} (store=${store.kind}, cors=${ORIGIN})`);
  return server;
}

async function readArgs(req: Request): Promise<any[]> {
  const t = await req.text();
  if (!t) return [];
  const v = JSON.parse(t);
  return Array.isArray(v) ? v : [v];
}

async function wsUrl(store: CaseStore, kind: 'Case' | 'Board', id: string, url: URL) {
  if (store.kind === 'terse') return (store as unknown as TerseCaseStore).wsUrl(kind, id);
  return kind === 'Case' ? `ws://${url.host}/ws/case/${id}` : `ws://${url.host}/ws/board`;
}

export { rememberWebhook };
