// Smoke test against the hosted Relay: open #case-9999, ask as maya, post as
// case-actor via the inbound webhook, assert the listener mirrored both into
// an in-process MemoryCaseStore. With BRIDGE_URL set, also drives the running
// bridge over HTTP (create + ask) and checks its mirrored state.
import { MemoryCaseStore } from './casestore';
import { loadEnv } from './env';
import { startListeners } from './listeners';
import { askAsWorker, openCaseChannel, postAsActor } from './relay';

loadEnv();
const CASE = process.env.SMOKE_CASE ?? '9999';
const store = new MemoryCaseStore(false);
const stop = startListeners(store);
const t0 = Date.now();
const fail = (m: string) => { console.error(`FAIL ${m}`); process.exit(1); };

const ch = await openCaseChannel(CASE, 'Smoke test case');
console.log(`opened #${ch.channel} webhook=${ch.webhookUrl.replace(/[^/]+$/, '<id>')}`);
await store.setRelayInfo(CASE, ch);
await Bun.sleep(1500); // let the event stream connect

const stamp = Date.now().toString(36);
const qid = await askAsWorker(CASE, `smoke ${stamp}: does CO-50 need a peer-to-peer first?`);
console.log(`maya asked, messageId=${qid}`);
const hook = await postAsActor(CASE, `smoke ${stamp}: case-actor via webhook`);
console.log(`webhook POST ok=${hook.ok}`);

async function waitFor(pred: () => boolean, ms = 20000) {
  const end = Date.now() + ms;
  while (Date.now() < end) { if (pred()) return true; await Bun.sleep(250); }
  return false;
}
const thread = () => store.getCase(CASE).then((s) => s?.thread ?? []);
let t: Awaited<ReturnType<typeof thread>> = [];
const okQ = await waitFor(() => { thread().then((x) => (t = x)); return t.some((m) => m.id === qid); });
if (!okQ) fail(`maya question not mirrored; thread=${JSON.stringify(t)}`);
const okA = await waitFor(() => { thread().then((x) => (t = x)); return t.some((m) => m.text.includes(`smoke ${stamp}: case-actor`)); });
if (!okA) fail(`webhook message not mirrored; thread=${JSON.stringify(t)}`);
for (const m of t.filter((m) => m.text.includes(stamp))) console.log(`  mirrored: id=${m.id} author=${m.author} text="${m.text}"`);

if (process.env.BRIDGE_URL) {
  const B = process.env.BRIDGE_URL;
  const post = (path: string, args: unknown[]) => fetch(`${B}${path}`, { method: 'POST', body: JSON.stringify(args) }).then((r) => r.json());
  await post(`/api/case/${CASE}/create`, [{ title: 'Smoke via bridge HTTP' }]);
  const asked: any = await post(`/api/case/${CASE}/ask`, [`bridge ${stamp}: http ask`]);
  const root = asked.relay?.threadRootId;
  if (!root) fail(`bridge ask returned no threadRootId: ${JSON.stringify(asked).slice(0, 300)}`);
  let s: any;
  const ok = await waitFor(() => { fetch(`${B}/api/case/${CASE}`).then((r) => r.json()).then((x) => (s = x)); return s?.thread?.some((m: any) => m.id === root); });
  if (!ok) fail('bridge did not mirror its own ask');
  console.log(`  bridge HTTP: status=${s.status} threadRootId=${root} thread=${s.thread.length} msgs`);
}
stop();
console.log(`PASS in ${Date.now() - t0}ms`);
process.exit(0);
