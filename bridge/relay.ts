// Relay-side operations the bridge performs on behalf of the case actor and the worker.
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { AGENTS, SPECIALISTS, getAgent, getRelay, withRetry } from './env';

// Inbound webhook tokens are shown once; cache them locally (gitignored) so a
// bridge restart reuses the same webhook instead of minting a new one.
const CACHE = join(import.meta.dir, '.webhooks.json');

export const channelFor = (caseId: string) => `case-${caseId}`;

const webhooks = new Map<string, { url: string; token: string }>(
  existsSync(CACHE) ? Object.entries(JSON.parse(readFileSync(CACHE, 'utf8'))) : [],
);
const saveCache = () => writeFileSync(CACHE, JSON.stringify(Object.fromEntries(webhooks), null, 2));

/** Seed known webhooks (e.g. from case.relay) so postAsActor works after a restart. */
export function rememberWebhook(caseId: string, url?: string, token?: string) {
  if (url && token) { webhooks.set(caseId, { url, token }); saveCache(); }
}

/** Create #case-<id> (idempotent), join all six participants, create inbound webhook. */
export async function openCaseChannel(caseId: string, title: string) {
  const channel = channelFor(caseId);
  const actor = await getAgent('case-actor', 'system');
  try {
    await withRetry('channels.create', () => actor.channels.create({ name: channel, topic: title }));
  } catch (e: any) {
    if (!/409|conflict|exists/i.test(`${e?.statusCode} ${e?.code} ${e?.rawCode} ${e?.message}`)) throw e;
  }
  // Hosted Relay calls take seconds each: only join missing members, in parallel.
  const members = new Set(
    (await withRetry('channels.members', () => actor.channels.members(channel)).catch(() => [] as any[])).map((m: any) => m.agentName ?? m.name ?? m.agent_name),
  );
  const relay = getRelay();
  const hookP = webhooks.get(caseId)
    ? Promise.resolve(webhooks.get(caseId)!)
    : withRetry('webhooks.createInbound', () => relay.webhooks.createInbound({ channel })).then((wh) => {
        const h = { url: wh.url, token: wh.token };
        webhooks.set(caseId, h);
        saveCache();
        return h;
      });
  await Promise.all(
    AGENTS.filter((a) => !members.has(a.name)).map(async (a) => {
      const c = await getAgent(a.name, a.type);
      await withRetry(`join ${a.name}`, () => c.channels.join(channel)).catch((e) => console.warn(`[relay] join ${a.name} ${channel}:`, e.message));
    }),
  );
  const hook = await hookP;
  return { channel, webhookUrl: hook.url, webhookToken: hook.token };
}

/** Post into #case-<id> through the inbound webhook, author 'case-actor'. */
export async function postAsActor(caseId: string, text: string) {
  let hook = webhooks.get(caseId);
  if (!hook) {
    const r = await openCaseChannel(caseId, `Case ${caseId}`);
    hook = { url: r.webhookUrl, token: r.webhookToken };
  }
  return withRetry('webhook POST', async () => {
    const res = await fetch(hook!.url, {
      method: 'POST',
      headers: { authorization: `Bearer ${hook!.token}`, 'content-type': 'application/json' },
      body: JSON.stringify({ message: text, author: 'case-actor' }),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      const err: any = new Error(`webhook ${res.status}: ${JSON.stringify(body)}`);
      err.statusCode = res.status;
      throw err;
    }
    return body as { ok: boolean; data?: any };
  });
}

/** Worker (maya) asks the bench in #case-<id>; returns the thread root messageId. */
export async function askAsWorker(caseId: string, question: string, worker = 'maya') {
  const maya = await getAgent(worker, 'human');
  const text = `${SPECIALISTS.map((s) => `@${s}`).join(' ')} ${question}`;
  const msg = await withRetry('ask sendMessage', () =>
    maya.sendMessage({ to: `#${channelFor(caseId)}`, text, mentions: [...SPECIALISTS] }),
  );
  return msg.messageId;
}

/** Worker approval: check mark reaction on the recommendation message. */
export async function approveAsWorker(messageId: string, worker = 'maya') {
  const maya = await getAgent(worker, 'human');
  return withRetry('approve react', () => maya.react({ messageId, emoji: ':white_check_mark:' }));
}

/** Post the recommendation as a thread reply from case-actor; returns its messageId. */
export async function replyAsActor(threadRootId: string, text: string) {
  const actor = await getAgent('case-actor', 'system');
  const msg = await withRetry('actor reply', () => actor.reply({ messageId: threadRootId, text }));
  return msg.messageId;
}
