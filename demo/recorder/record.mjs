// Records the live HireXpert walkthrough as separate 1080p clips (no audio), driving the real app.
// Long waits (VM provisioning, agent verification) happen between clips, so the final cut stays short.
// Usage: node record.mjs [--base https://hirexpert-eta.vercel.app] [--bridge https://8788-...superserve.ai]
import { chromium } from 'playwright';
import { mkdirSync, writeFileSync, readdirSync, renameSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const arg = (k, d) => { const i = process.argv.indexOf(k); return i > -1 ? process.argv[i + 1] : d; };
const BASE = arg('--base', 'https://hirexpert-eta.vercel.app');
const BRIDGE = arg('--bridge', 'https://8788-5975fada-698b-4c43-8ec3-1e554ae9d97c.sandbox.superserve.ai');
const BUSINESS = arg('--business', 'Harbor Dental Group');
const WORKER = 'Maya R.';
const OUT = join(process.cwd(), 'out');
mkdirSync(OUT, { recursive: true });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const slug = 'biz-' + BUSINESS.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const api = async (path, init) => { const r = await fetch(BRIDGE + path, init); return r.ok ? r.json() : null; };
const post = (path, body) => api(path, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });

let browser;
async function clip(name, fn) {
  const ctx = await browser.newContext({ viewport: { width: 1920, height: 1080 }, recordVideo: { dir: OUT, size: { width: 1920, height: 1080 } }, deviceScaleFactor: 1, colorScheme: 'light' });
  const page = await ctx.newPage();
  page.setDefaultTimeout(30_000);
  let ok = true;
  try { await fn(page, ctx); } catch (e) { ok = false; console.error(`[${name}] failed:`, e.message); await page.screenshot({ path: join(OUT, `${name}-FAILED.png`) }).catch(() => {}); }
  const video = page.video();
  await ctx.close();
  const p = await video.path();
  renameSync(p, join(OUT, `${name}.webm`));
  console.log(`[${name}] ${ok ? 'ok' : 'FAILED'} -> ${name}.webm`);
  return ok;
}
const human = async (page, locator, text) => { await locator.click(); await locator.fill(''); await locator.pressSequentially(text, { delay: 28 }); };
const glide = async (page, to, ms = 1400) => { await page.evaluate(([to, ms]) => new Promise((r) => { const s = window.scrollY, d = to - s, t0 = performance.now(); const f = (t) => { const k = Math.min(1, (t - t0) / ms), e = 1 - Math.pow(1 - k, 3); window.scrollTo(0, s + d * e); k < 1 ? requestAnimationFrame(f) : r(); }; requestAnimationFrame(f); }), [to, ms]); };
const settle = (ms = 900) => sleep(ms);

// Make sure the recording starts from a believable state: the business is new; worker local storage is empty.
const localWorkspace = `localStorage.setItem('hirexpert.workspace', '${slug}')`;

browser = await chromium.launch({ headless: true });
console.log('recording against', BASE, 'business', BUSINESS, 'slug', slug);

// 1. Landing: read, hover a category, go to onboarding
await clip('01-landing', async (page) => {
  await page.goto(BASE + '/'); await settle(2600);
  await page.hover('text=Medical billing').catch(() => {}); await settle(1400);
  await page.mouse.move(400, 500); await settle(400);
  await glide(page, 900, 1600); await settle(1200);
  await glide(page, 1800, 1600); await settle(1400);
  await glide(page, 0, 1200); await settle(600);
  await page.getByRole('link', { name: /Onboard your business/i }).first().click(); await settle(1800);
});

// 2. Onboard: type the business name, add a file, provision
let jobId = null;
await clip('02-onboard', async (page) => {
  await page.goto(BASE + '/onboard'); await settle(1500);
  const name = page.locator('input').first();
  await human(page, name, BUSINESS); await settle(600);
  writeFileSync(join(OUT, 'Denial letter - Harbor Dental.md'), '# Denial letter\nPayer: Harborline Health. CPT 72148 denied CO-50 (medical necessity). DOS 2026-10-02. Amount $1,840.\n');
  const input = page.locator('input[type="file"]');
  if (await input.count()) { await input.setInputFiles(join(OUT, 'Denial letter - Harbor Dental.md')); await settle(1200); }
  await page.getByRole('button', { name: /Provision/i }).first().click(); await settle(3500);
});

// wait (off camera) for the VM
console.log('waiting for workspace', slug);
for (let i = 0; i < 90; i++) { const w = await api(`/api/workspace/${slug}`); if (w?.status === 'ready' && w.ideUrl) break; if (w?.status === 'error') { console.error('provision error', w.error); break; } await sleep(6000); }

// 3. Workspace ready: show the card, open the workstation, come back, post a job
await clip('03-workspace-post', async (page) => {
  await page.goto(BASE + '/onboard'); await page.evaluate(localWorkspace); await page.reload(); await settle(3200);
  await glide(page, 400, 1000); await settle(1800);
  const ide = page.getByRole('link', { name: /Open workstation/i }).first();
  const href = await ide.getAttribute('href').catch(() => null);
  if (href) { const p2 = await page.context().newPage(); await p2.goto(href).catch(() => {}); await settle(2500); await p2.close(); }
  await page.getByRole('link', { name: /Next: post a job/i }).first().click().catch(async () => page.goto(BASE + '/post?workspace=' + slug)); await settle(1600);
  // fill the job form slowly (fields are prefilled; retype the outcome so the typing is visible)
  const outcome = page.locator('input, textarea').nth(0);
  await human(page, outcome, 'Appeal a denied lumbar MRI claim, CPT 72148, denial code CO-50'); await settle(500);
  await glide(page, 500, 900); await settle(600);
  await page.getByRole('button', { name: /^Post job/i }).first().click(); await settle(3500);
  const m = page.url().match(/\/poster\/(\d+)/); if (m) jobId = m[1];
  await settle(1500);
});
if (!jobId) { const b = await api('/api/board'); const j = (b?.jobs ?? []).filter((x) => x.poster === BUSINESS).pop(); jobId = j?.id ?? '4471'; }
console.log('job', jobId);

// 4. Worker: board -> claim -> case
await clip('04-worker-claim', async (page) => {
  await page.goto(BASE + '/board'); await settle(2200);
  const card = page.locator('text=' + 'Appeal a denied lumbar MRI claim').first();
  await card.scrollIntoViewIfNeeded().catch(() => {}); await settle(800);
  const claim = page.getByRole('button', { name: /^Claim$/ }).first();
  await claim.click().catch(() => {}); await settle(2600);
  if (!/\/case\//.test(page.url())) await page.goto(BASE + `/case/${jobId}/brief`); await settle(1600);
  await glide(page, 500, 1000); await settle(1200);
  await page.goto(BASE + `/case/${jobId}`); await settle(2600);
  await page.getByRole('button', { name: /Request access/i }).first().click().catch(() => {}); await settle(1600);
  await page.getByRole('button', { name: /Start bench/i }).first().click().catch(() => {}); await settle(2500);
});

// start agents (off camera) and wait until they run
console.log('waiting for agents in', slug);
for (let i = 0; i < 40; i++) { const w = await api(`/api/workspace/${slug}`); if (w?.agents?.every((a) => a.running)) break; await sleep(5000); }
await sleep(20_000);

// 5. Worker does the work in the workspace and submits it for verification
await clip('05-submit-work', async (page) => {
  await page.goto(BASE + `/case/${jobId}`); await settle(2200);
  const ta = page.locator('textarea').first();
  await ta.scrollIntoViewIfNeeded(); await settle(500);
  const draft = `Dear Harborline Health Appeals,\n\nI am requesting a Level 1 appeal of the CO-50 denial for CPT 72148 (lumbar MRI), DOS 2026-10-02, billed $1,840.\n\nPlan policy CG-0423 sec 4.2 is met: radicular pain for over 6 weeks, failure of 8 weeks of physical therapy and NSAIDs (Aug 4 to Sep 29), and a new motor deficit documented at the Sep 30 re-evaluation. The MRI order with indication is attached.\n\nPlease reverse the denial and reprocess the claim.`;
  await ta.click(); await ta.fill(''); await ta.pressSequentially(draft, { delay: 9 }); await settle(800);
  await page.getByRole('button', { name: /Submit for verification/i }).first().click(); await settle(3200);
});

// wait (off camera) for the verdict and 3 votes
console.log('waiting for verification of', jobId);
for (let i = 0; i < 80; i++) { const c = await api(`/api/case/${jobId}`); if (c?.recommendation && c.recommendation.agrees.length >= 3) break; await sleep(8000); }

// 6. Verification verdict: read the thread, accept
await clip('06-verdict', async (page) => {
  await page.goto(BASE + `/case/${jobId}`); await settle(2600);
  await glide(page, 700, 1800); await settle(2200);
  await glide(page, 1500, 1800); await settle(2400);
  const accept = page.getByRole('button', { name: /Accept and send/i }).first();
  await accept.scrollIntoViewIfNeeded().catch(() => {}); await settle(800);
  await accept.click().catch(() => {}); await settle(2800);
});

// 7. Business review + supervisor + how it works
await clip('07-review-supervisor', async (page) => {
  await page.goto(BASE + `/poster/${jobId}/review`); await settle(2600);
  await glide(page, 500, 1200); await settle(1500);
  await page.getByRole('button', { name: /Approve/i }).first().click().catch(() => {}); await settle(2200);
  await page.goto(BASE + '/supervisor'); await settle(3000);
  await page.goto(BASE + '/how-it-works'); await settle(2400);
  await glide(page, 900, 1800); await settle(2200);
});

await browser.close();
console.log('done. clips in', OUT, readdirSync(OUT).filter((f) => f.endsWith('.webm')));
