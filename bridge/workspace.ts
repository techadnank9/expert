// Business workspaces: one Superserve VM per business. The bench agents (Codex + Relay MCP)
// run inside it with the business's documents and their own session logs. A hired worker is
// granted access to that VM. The bridge drives the `superserve` CLI; records live in
// .workspaces.json and on each Case actor (`workspace`).
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { CaseStore } from './casestore';

export type Workspace = {
  provider: 'superserve';
  slug: string;
  vmId: string;
  status: 'provisioning' | 'ready' | 'paused' | 'error';
  agents: { role: string; running: boolean; sessionRef?: string }[];
  owner: string;
  grantedTo: string[];
  createdAt: string;
  error?: string;
};

const ROOT = join(import.meta.dir, '..');
const FILE = process.env.WORKSPACES_FILE ?? join(import.meta.dir, '.workspaces.json');
const BIN = process.env.SUPERSERVE_BIN ?? 'superserve';
const ROLES = ['policy', 'billing', 'appeals'];

const load = (): Record<string, Workspace> => (existsSync(FILE) ? JSON.parse(readFileSync(FILE, 'utf8')) : {});
const save = (all: Record<string, Workspace>) => writeFileSync(FILE, JSON.stringify(all, null, 2));
export const slugFor = (owner: string) => 'biz-' + owner.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40);

async function ss(args: string[], opts: { timeoutMs?: number; input?: string } = {}): Promise<{ ok: boolean; out: string }> {
  const env = { ...process.env, SUPERSERVE_API_KEY: process.env.SUPERSERVE_API_KEY_2 ?? process.env.SUPERSERVE_API_KEY ?? '' };
  const proc = Bun.spawn([BIN, ...args], { env, stdout: 'pipe', stderr: 'pipe', stdin: opts.input ? new Response(opts.input) : undefined });
  const timer = setTimeout(() => proc.kill(), opts.timeoutMs ?? 180_000);
  const [out, err] = await Promise.all([new Response(proc.stdout).text(), new Response(proc.stderr).text()]);
  const code = await proc.exited;
  clearTimeout(timer);
  return { ok: code === 0, out: (out + (code === 0 ? '' : '\n' + err)).trim() };
}

const exec = (vm: string, script: string, timeoutMs = 180_000) => ss(['exec', vm, '--', 'bash', '-lc', script], { timeoutMs });

export function listWorkspaces(): Workspace[] { return Object.values(load()); }
export function getWorkspaceRecord(slug: string): Workspace | undefined { return load()[slug]; }
function put(ws: Workspace) { const all = load(); all[ws.slug] = ws; save(all); return ws; }

/** Create (or reuse) the business VM and install the bench inside it. Returns immediately with 'provisioning'. */
export async function provisionWorkspace(owner: string, store: CaseStore, onReady?: (ws: Workspace) => void): Promise<Workspace> {
  const slug = slugFor(owner);
  const existing = load()[slug];
  if (existing && existing.status !== 'error') return existing;
  const ws: Workspace = { provider: 'superserve', slug, vmId: '', status: 'provisioning', agents: ROLES.map((role) => ({ role, running: false })), owner, grantedTo: [], createdAt: new Date().toISOString() };
  put(ws);
  (async () => {
    try {
      // Names are not unique on Superserve: reuse an existing VM with this name before creating one.
      let vmId = existing?.vmId ?? '';
      if (!vmId) {
        const listed = await ss(['sandbox', 'list', '--json'], { timeoutMs: 60_000 });
        if (listed.ok) {
          const match = (JSON.parse(listed.out) as any[]).filter((x) => x.name === slug && x.status !== 'deleted').sort((a, b) => String(a.created_at).localeCompare(String(b.created_at)))[0];
          if (match) vmId = match.id;
        }
      }
      if (!vmId) {
        const created = await ss(['sandbox', 'create', '--name', slug, '--timeout', '7d', '--json'], { timeoutMs: 120_000 });
        if (!created.ok) throw new Error(created.out.slice(0, 300));
        vmId = JSON.parse(created.out).id;
      } else {
        await ss(['sandbox', 'resume', vmId, '--json'], { timeoutMs: 120_000 }).catch(() => {});
      }
      put({ ...ws, vmId });
      // Ship the bench: agents/ (prompts, docs, launcher) + .env with Relay + OpenAI keys.
      const tar = join(ROOT, 'agents.tar.gz');
      await Bun.spawn(['tar', 'czf', tar, '-C', ROOT, 'agents'], { env: { ...process.env, COPYFILE_DISABLE: '1' } }).exited;
      const envLines = Object.entries(process.env).filter(([k]) => k === 'RELAY_WORKSPACE_KEY' || k === 'OPENAI_API_KEY' || k.startsWith('RELAY_TOKEN_')).map(([k, v]) => `${k}=${v}`).join('\n') + '\n';
      await Bun.write(join(ROOT, 'vm.env'), envLines);
      const cp1 = await ss(['cp', tar, `${vmId}:/home/user/agents.tar.gz`]);
      const cp2 = await ss(['cp', join(ROOT, 'vm.env'), `${vmId}:/home/user/.env`]);
      if (!cp1.ok || !cp2.ok) throw new Error('copy failed: ' + (cp1.out + cp2.out).slice(0, 300));
      const setup = await exec(vmId, [
        'cd /home/user && rm -rf agents && tar xzf agents.tar.gz 2>/dev/null && chown -R root:root agents && chmod +x agents/*.sh',
        'command -v codex >/dev/null || npm install -g @openai/codex@0.166.0 >/tmp/npm.log 2>&1',
        'OA=$(grep "^OPENAI_API_KEY=" .env | cut -d= -f2-); [ -n "$OA" ] && printf "%s" "$OA" | codex login --with-api-key >/dev/null 2>&1 || true',
        'cd agents && (echo "{}" | timeout 240 ./relay-mcp.sh policy warm >/dev/null 2>&1 || true)', // warm the npx cache
        'echo SETUP_OK',
      ].join(' && '), 420_000);
      if (!setup.ok || !setup.out.includes('SETUP_OK')) throw new Error('setup failed: ' + setup.out.slice(-300));
      const ready = put({ ...ws, vmId, status: 'ready' });
      onReady?.(ready);
      console.log(`[workspace] ${slug} ready (${vmId})`);
    } catch (e) {
      put({ ...ws, status: 'error', error: (e as Error).message });
      console.warn(`[workspace] ${slug} failed:`, (e as Error).message);
    }
  })();
  return ws;
}

/** Launch the three bench agents inside the business VM for one case. */
export async function startBench(caseId: string, ws: Workspace, rounds = 30): Promise<Workspace> {
  if (ws.status !== 'ready') throw new Error(`workspace ${ws.slug} is ${ws.status}`);
  const script = ROLES.map((r) => `(cd /home/user && CODEX_SANDBOX_MODE=danger-full-access nohup agents/launch.sh ${r} ${caseId} ${rounds} > /home/user/${r}-${caseId}.log 2>&1 &)`).join('; ') + '; sleep 2; pgrep -x codex | wc -l';
  const r = await exec(ws.vmId || ws.slug, script, 60_000);
  const running = r.ok && Number(r.out.trim().split('\n').pop()) > 0;
  const next = put({ ...ws, agents: ROLES.map((role) => ({ role, running })) });
  console.log(`[workspace] bench started in ${ws.slug} for case ${caseId}: ${r.out.trim().split('\n').pop()} codex processes`);
  return next;
}

/** Live view of the VM: status, agent processes, files, Codex session logs. */
export async function inspectWorkspace(slug: string) {
  const ws = load()[slug];
  if (!ws) return null;
  const [st, info] = await Promise.all([
    ss(['sandbox', 'get', ws.vmId || slug, '--json'], { timeoutMs: 30_000 }),
    ws.status === 'ready' ? exec(ws.vmId || slug, 'echo "==P"; pgrep -ax codex | sed "s/.*launch.sh //" | head -10; ps -eo args | grep "[l]aunch.sh" | awk "{print \\$2}" | sort -u; echo "==F"; find /home/user/agents/docs -type f -printf "%p %s\\n" 2>/dev/null | sed "s#/home/user/##"; echo "==S"; find /home/user/.codex/sessions -name "*.jsonl" -printf "%T@ %p\\n" 2>/dev/null | sort -rn | head -12 | sed "s#/home/user/.codex/sessions/##"', 30_000) : Promise.resolve({ ok: false, out: '' }),
  ]);
  let status = ws.status;
  try { if (st.ok) { const s = JSON.parse(st.out).status; if (s === 'paused') status = 'paused'; if (s === 'active' && ws.status === 'paused') status = 'ready'; } } catch {}
  const out = info.ok ? info.out : '';
  const sect = (k: string) => (out.split(`==${k}`)[1] ?? '').split(/==[PFS]/)[0].trim().split('\n').filter(Boolean);
  const procs = sect('P');
  const running = new Set(procs.map((l) => l.trim().split(/\s+/)[0]));
  const files = sect('F').map((l) => { const [path, size] = l.trim().split(/\s+/); return { path, size: Number(size) || undefined }; });
  const sessions = sect('S').map((l) => { const [ts, path] = l.trim().split(/\s+/); return { id: (path ?? '').split('/').pop()?.replace('.jsonl', '') ?? path, updatedAt: ts ? new Date(Number(ts) * 1000).toISOString() : undefined }; });
  return { ...ws, status, agents: ROLES.map((role) => ({ role, running: running.has(role) })), files, sessions, shell: `superserve shell ${ws.vmId || slug}` };
}
