// Shared env + Relay identity helpers for the bridge.
import { AgentRelay, type RelayAgentClient } from '@agent-relay/sdk';
import { existsSync, readFileSync, appendFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

export const ROOT = join(import.meta.dir, '..');
export const ENV_PATH = join(ROOT, '.env');

/** Load repo-root .env into process.env (Bun only auto-loads from cwd). */
export function loadEnv(): void {
  if (!existsSync(ENV_PATH)) return;
  for (const line of readFileSync(ENV_PATH, 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (!m) continue;
    const [, k, raw] = m;
    const v = raw.replace(/^['"]|['"]$/g, '');
    if (v && !process.env[k]) process.env[k] = v;
  }
}

export function persistEnv(key: string, value: string): void {
  process.env[key] = value;
  const cur = existsSync(ENV_PATH) ? readFileSync(ENV_PATH, 'utf8') : '';
  if (new RegExp(`^${key}=`, 'm').test(cur)) {
    // replace in place
    const next = cur.replace(new RegExp(`^${key}=.*$`, 'm'), `${key}=${value}`);
    writeFileSync(ENV_PATH, next);
    return;
  }
  appendFileSync(ENV_PATH, `${cur && !cur.endsWith('\n') ? '\n' : ''}${key}=${value}\n`);
}

export type Who = 'policy' | 'billing' | 'appeals' | 'case-actor' | 'maya' | 'dana';
export const AGENTS: { name: Who; type: 'agent' | 'human' | 'system' }[] = [
  { name: 'policy', type: 'agent' },
  { name: 'billing', type: 'agent' },
  { name: 'appeals', type: 'agent' },
  { name: 'case-actor', type: 'system' },
  { name: 'maya', type: 'human' },
  { name: 'dana', type: 'human' },
];
export const SPECIALISTS = ['policy', 'billing', 'appeals'] as const;

export const tokenKey = (name: string) => `RELAY_TOKEN_${name.toUpperCase().replace(/-/g, '_')}`;

let relaySingleton: AgentRelay | undefined;
export function getRelay(): AgentRelay {
  loadEnv();
  const workspaceKey = process.env.RELAY_WORKSPACE_KEY;
  if (!workspaceKey) throw new Error('RELAY_WORKSPACE_KEY missing; run `bun bridge/setup.ts` first');
  relaySingleton ??= new AgentRelay({ workspaceKey });
  return relaySingleton;
}

const clients = new Map<string, RelayAgentClient>();

function isConflict(err: unknown): boolean {
  const s = String((err as any)?.code ?? '') + ' ' + String((err as any)?.status ?? '') + ' ' + String((err as any)?.message ?? err);
  return /409|name_conflict|conflict|already exists/i.test(s);
}

/**
 * Live client for a named participant. Reconnects with the persisted token
 * (RELAY_TOKEN_<NAME>); otherwise registers and persists the issued token.
 * Registration is create-only (409 name_conflict): if the name exists but we
 * lost the token, release it with deleteAgent and register again.
 */
export async function getAgent(name: Who | string, type: 'agent' | 'human' | 'system' = 'agent'): Promise<RelayAgentClient> {
  const cached = clients.get(name);
  if (cached) return cached;
  const relay = getRelay();
  const key = tokenKey(name);
  const saved = process.env[key];
  let client: RelayAgentClient | undefined;
  if (saved) {
    try {
      client = await withRetry(`reconnect ${name}`, () => relay.workspace.reconnect({ apiToken: saved }));
    } catch (e) {
      console.warn(`[relay] reconnect ${name} failed, re-registering:`, (e as Error).message);
    }
  }
  if (!client) {
    try {
      client = await withRetry(`register ${name}`, () => relay.workspace.register({ name, type }));
    } catch (e) {
      if (!isConflict(e)) throw e;
      console.warn(`[relay] ${name} exists without a saved token; releasing and re-registering`);
      await withRetry(`release ${name}`, () => relay.workspace.release({ name, deleteAgent: true, reason: 'token lost, re-register' }));
      client = await withRetry(`register ${name}`, () => relay.workspace.register({ name, type }));
    }
    if (client.token) persistEnv(key, client.token);
  }
  clients.set(name, client);
  return client;
}

/** Retry transient hosted-Relay errors (503 database_overloaded, 429). */
export async function withRetry<T>(label: string, fn: () => Promise<T>, tries = 10): Promise<T> {
  for (let i = 1; ; i++) {
    try {
      return await fn();
    } catch (e: any) {
      const retryable = e?.retryable || e?.statusCode === 503 || e?.statusCode === 429;
      if (!retryable || i >= tries) throw e;
      const wait = Math.min(e?.retryAfterMs ?? 1000 * i, 10000);
      console.warn(`[relay] ${label} transient (${e?.rawCode ?? e?.statusCode}), retry ${i} in ${wait}ms`);
      await Bun.sleep(wait);
    }
  }
}
