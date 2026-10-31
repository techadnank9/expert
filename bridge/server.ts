// HTTP + WS bridge for the browser (CONTRACT.md "WebSocket to browser").
import type { ServerWebSocket } from 'bun';
import { getBusiness, getWorkspaceRecord, inspectWorkspace, listWorkspaces, provisionWorkspace, slugFor, startBench, uploadFiles } from './workspace';
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
  // With the Terse actor, ask/alarm/approval side effects come from its socket broadcasts (terse-ws.ts).
  if (store.kind === 'terse' && method !== 'create') return state;
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
        if (p[0] !== 'api') {
          // Production: serve the built web app (SPA fallback to index.html) from STATIC_DIR.
          const dir = process.env.STATIC_DIR;
          if (!dir) return json({ error: 'not found' }, 404);
          const rel = url.pathname === '/' ? '/index.html' : url.pathname;
          let f = Bun.file(`${dir}${rel}`);
          if (!(await f.exists()) || rel.endsWith('/')) f = Bun.file(`${dir}/index.html`);
          return new Response(f, { headers: { 'cache-control': rel.startsWith('/assets/') ? 'public, max-age=31536000, immutable' : 'no-cache' } });
        }

        // ---- business workspaces (Superserve VM per business) ----
        if (p[1] === 'business' && p[2] && req.method === 'GET') {
          const b = await getBusiness(p[2]);
          return b ? json(b) : json({ error: `no business ${p[2]}` }, 404);
        }
        if (p[1] === 'workspace') {
          if (req.method === 'GET' && !p[2]) return json(listWorkspaces());
          if (req.method === 'POST' && p[2] === 'provision') {
            const args = await readArgs(req);
            const owner = String(args[0]?.owner ?? args[0] ?? '').trim();
            if (!owner) return json({ error: 'owner required' }, 400);
            const ws = await provisionWorkspace(owner, store, async (ready) => {
              // attach the ready workspace to every case this business owns
              for (const id of await caseIdsFor(store, owner)) await store.callCase(id, 'setWorkspace', [ready]).catch(() => {});
            }, { force: !!args[0]?.force });
            return json(ws);
          }
          if (req.method === 'POST' && p[2] && p[3] === 'files') {
            const form = await req.formData();
            const files: { name: string; bytes: Uint8Array }[] = [];
            for (const [, v] of form.entries()) if (v instanceof File) files.push({ name: v.name, bytes: new Uint8Array(await v.arrayBuffer()) });
            if (!files.length) return json({ error: 'no files' }, 400);
            const stored = await uploadFiles(p[2], files);
            return json({ ok: true, stored, workspace: await inspectWorkspace(p[2]) });
          }
          if (req.method === 'GET' && p[2]) {
            const ws = await inspectWorkspace(p[2]);
            return ws ? json(ws) : json({ error: `no workspace ${p[2]}` }, 404);
          }
        }
        if (p[1] === 'case' && p[2] && p[3] === 'startBench' && req.method === 'POST') {
          const id = p[2];
          const s0 = await store.getCase(id);
          if (!s0) return json({ error: `no case ${id}` }, 404);
          let ws = s0.workspace ?? getWorkspaceRecord(slugFor(s0.poster?.name ?? ''));
          if (!ws) {
            // The business never onboarded: provision its VM now and report provisioning; the UI polls and the user clicks again.
            const started = await provisionWorkspace(s0.poster?.name || `case-${id}`, store, async (ready) => { await store.callCase(id, 'setWorkspace', [ready]).catch(() => {}); });
            return json(await store.callCase(id, 'setWorkspace', [started]));
          }
          if (ws.status !== 'ready') return json(await store.callCase(id, 'setWorkspace', [getWorkspaceRecord(ws.slug) ?? ws]));
          ws = getWorkspaceRecord(ws.slug) ?? ws;
          const next = await startBench(id, ws);
          return json(await store.callCase(id, 'setWorkspace', [next]));
        }
        if (p[1] === 'board') {
          if (req.method === 'GET' && !p[2]) return json(await store.getBoard());
          if (req.method === 'GET' && p[2] === 'ws-url') return json({ websocketUrl: await wsUrl(store, 'Board', 'main', url) });
          if (req.method === 'POST' && p[2]) {
            const args = await readArgs(req);
            const board = await store.callBoard(p[2], args);
            if (p[2] === 'post') {
              // Board.post returns the job; create the Case actor for it (HANDOFF 3: post() creates the Case + Relay channel via bridge).
              const job: any = board && !('jobs' in (board as any)) ? board : null;
              const id = String(job?.id ?? args[0]?.id ?? '');
              if (id) {
                let s = await store.getCase(id);
                if (!s && job) {
                  s = await store.callCase(id, 'create', [{
                    id, title: job.title, domain: job.domain ?? 'medical-billing', poster: { name: job.poster },
                    facts: job.facts ?? { payer: '', amount: job.pay ?? 0, denialCode: '', dateOfService: '', reason: '' },
                    documents: job.documents ?? [], deadline: job.deadline, pay: { amount: job.pay ?? 0 }, estMinutes: job.estMinutes ?? 45,
                  }]);
                }
                if (s) await afterCaseCall(store, id, 'create', [], null, s).catch((e) => console.warn('[bridge] open channel failed:', e.message));
                (globalThis as any).__watchCase?.(id);
                if (job?.poster) await bizAddJob(slugFor(String(job.poster)), id);
                const ws = getWorkspaceRecord(String(job?.workspace ?? slugFor(job?.poster ?? '')));
                if (ws && s && !s.workspace) await store.callCase(id, 'setWorkspace', [ws]).catch(() => {});
              }
              return json(await store.getBoard());
            }
            if (p[2] === 'claim') {
              const job: any = board && !('jobs' in (board as any)) ? board : null;
              if (job?.id) await store.callCase(String(job.id), 'claim', [args[1]]).catch((e) => console.warn('[bridge] case claim:', e.message));
              if (job?.id && args[1]?.name) await store.callCase(String(job.id), 'grantWorkspace', [args[1].name]).catch(() => {});
              if (job?.poster && args[1]?.name) await bizGrant(slugFor(String(job.poster)), String(args[1].name));
              return json(await store.getBoard());
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
            (globalThis as any).__watchCase?.(id);
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


async function caseIdsFor(store: CaseStore, owner: string): Promise<string[]> {
  const b = await store.getBoard();
  return b.jobs.filter((j) => j.poster === owner).map((j) => j.id);
}


async function bizGrant(slug: string, worker: string) {
  try { const { actors } = await import('../actor/client/generated/index.js'); await (actors as any).Business.get(slug).grantAccess(worker); } catch {}
}
async function bizAddJob(slug: string, caseId: string) {
  try { const { actors } = await import('../actor/client/generated/index.js'); const b = (actors as any).Business.get(slug); if (await b.exists()) await b.addJob(caseId); } catch {}
}
