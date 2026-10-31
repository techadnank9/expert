// Bridge entrypoint: Relay identities, listeners, actions, HTTP/WS server.
import { makeCaseStore } from './casestore';
import { AGENTS, getAgent, loadEnv } from './env';
import { registerActions } from './actions';
import { startListeners } from './listeners';
import { startServer } from './server';
import { openCaseChannel } from './relay';
import { watchCase } from './terse-ws';
import type { TerseCaseStore } from './casestore';

loadEnv();
if (!process.env.RELAY_WORKSPACE_KEY) {
  console.error('RELAY_WORKSPACE_KEY missing. Run: bun bridge/setup.ts');
  process.exit(1);
}
await Promise.all(AGENTS.map((a) => getAgent(a.name, a.type)));
console.log(`[bridge] relay identities ready: ${AGENTS.map((a) => a.name).join(', ')}`);

export const store = makeCaseStore();
startListeners(store);
await registerActions(store);
console.log('[bridge] actions registered: post_recommendation, schedule_alarm, request_document');
startServer(store);

const SEEDED = (process.env.BRIDGE_CASES ?? '4471,4398').split(',').filter(Boolean);
if (store.kind === 'terse') {
  for (const id of SEEDED) watchCase(store as TerseCaseStore, id).catch((e) => console.warn(`[bridge] watch ${id}:`, e.message));
} else if (process.env.BRIDGE_OPEN_SEEDED !== '0') {
  // Open channels for seeded cases so the demo starts with live webhooks.
  for (const id of SEEDED) {
    const s = await store.getCase(id);
    if (!s || s.relay.webhookUrl) continue;
    try {
      await store.setRelayInfo(id, await openCaseChannel(id, s.title));
      console.log(`[bridge] #case-${id} ready`);
    } catch (e) {
      console.warn(`[bridge] could not open #case-${id}:`, (e as Error).message);
    }
  }
}
