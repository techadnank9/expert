// Re-records clips 03..07 on a known job id with the workstation login shown on camera.
// Usage: node record2.mjs --job 4736 --slug biz-harbor-dental-group --title "Appeal a denied lumbar MRI claim"
import { chromium } from 'playwright';
import { mkdirSync, renameSync } from 'node:fs';
import { join } from 'node:path';

const arg = (k, d) => { const i = process.argv.indexOf(k); return i > -1 ? process.argv[i + 1] : d; };
const BASE = arg('--base', 'https://hirexpert-eta.vercel.app');
const BRIDGE = arg('--bridge', 'https://8788-5975fada-698b-4c43-8ec3-1e554ae9d97c.sandbox.superserve.ai');
const JOB = arg('--job', '4736');
const SLUG = arg('--slug', 'biz-harbor-dental-group');
const TITLE = arg('--title', 'Appeal a denied lumbar MRI claim');
const OUT = join(process.cwd(), 'out'); mkdirSync(OUT, { recursive: true });
const ONLY = arg('--only', '03,04,05,06,07').split(',');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const api = async (p) => { const r = await fetch(BRIDGE + p); return r.ok ? r.json() : null; };
const glide = async (page, to, ms = 1400) => { await page.evaluate(([to, ms]) => new Promise((r) => { const s = window.scrollY, d = to - s, t0 = performance.now(); const f = (t) => { const k = Math.min(1, (t - t0) / ms), e = 1 - Math.pow(1 - k, 3); window.scrollTo(0, s + d * e); k < 1 ? requestAnimationFrame(f) : r(); }; requestAnimationFrame(f); }), [to, ms]); };
const settle = (ms = 900) => sleep(ms);
const human = async (loc, text, delay = 28) => { await loc.click(); await loc.fill(''); await loc.pressSequentially(text, { delay }); };

const browser = await chromium.launch({ headless: true });
async function clip(name, fn) {
  if (!ONLY.some((o) => name.startsWith(o))) { console.log(`[${name}] skipped`); return; }
  const ctx = await browser.newContext({ viewport: { width: 1920, height: 1080 }, recordVideo: { dir: OUT, size: { width: 1920, height: 1080 } }, colorScheme: 'light' });
  const page = await ctx.newPage(); page.setDefaultTimeout(30_000);
  let ok = true;
  try { await fn(page); } catch (e) { ok = false; console.error(`[${name}]`, e.message); await page.screenshot({ path: join(OUT, `${name}-FAILED.png`) }).catch(() => {}); }
  const v = page.video(); await ctx.close(); renameSync(await v.path(), join(OUT, `${name}.webm`));
  console.log(`[${name}] ${ok ? 'ok' : 'FAILED'}`);
}

const ws = await api(`/api/workspace/${SLUG}`);
console.log('workspace', ws?.status, 'ide', !!ws?.ideUrl);

// 03: workspace ready card -> open the workstation (login on camera, VS Code appears) -> back -> post a job
await clip('03-workspace-post', async (page) => {
  await page.goto(BASE + '/onboard'); await page.evaluate((s) => localStorage.setItem('hirexpert.workspace', s), SLUG); await page.reload(); await settle(3000);
  await glide(page, 360, 1000); await settle(1600);
  if (ws?.ideUrl) {
    await page.goto(ws.ideUrl); await settle(1800);
    const pw = page.locator('input[type="password"], input[name="password"]').first();
    if (await pw.count()) { await human(pw, ws.idePassword ?? '', 40); await settle(500); await page.keyboard.press('Enter'); }
    await page.waitForSelector('.monaco-workbench', { timeout: 40_000 }).catch(() => {}); await settle(2500);
    // open the agents folder tree a little
    await page.locator('.monaco-workbench .explorer-folders-view .monaco-list-row').first().click().catch(() => {}); await settle(1800);
    await page.goto(BASE + '/onboard'); await settle(1800);
  }
  await page.getByRole('link', { name: /Next: post a job/i }).first().click().catch(async () => page.goto(BASE + '/post?workspace=' + SLUG)); await settle(1600);
  const outcome = page.locator('input, textarea').nth(0);
  await human(outcome, 'Appeal a denied lumbar MRI claim, CPT 72148, denial code CO-50'); await settle(500);
  await glide(page, 500, 900); await settle(800);
  await settle(1200); // (the job already exists from the first take; we show the filled form and move on)
});

// 04: board -> claim THE job by title -> brief -> case -> request access -> start bench
await clip('04-worker-claim', async (page) => {
  await page.goto(BASE + '/board'); await settle(2400);
  const card = page.locator('article, .job, li, div').filter({ hasText: TITLE }).filter({ has: page.getByRole('button', { name: /^Claim$/ }) }).first();
  await card.scrollIntoViewIfNeeded().catch(() => {}); await settle(900);
  const claim = card.getByRole('button', { name: /^Claim$/ }).first();
  await claim.click({ timeout: 8000 }).catch(() => {}); await settle(2600);
  if (!/\/case\//.test(page.url())) await page.goto(BASE + `/case/${JOB}/brief`); await settle(1800);
  await glide(page, 500, 1000); await settle(1200);
  await page.goto(BASE + `/case/${JOB}`); await settle(2600);
  await page.getByRole('button', { name: /Request access/i }).first().click().catch(() => {}); await settle(1800);
  await page.getByRole('button', { name: /Start bench/i }).first().click().catch(() => {}); await settle(2200);
});

// 05: write and submit the work
await clip('05-submit-work', async (page) => {
  await page.goto(BASE + `/case/${JOB}`); await settle(2200);
  const ta = page.locator('textarea').first(); await ta.scrollIntoViewIfNeeded(); await settle(500);
  const draft = `Dear Harborline Health Appeals,\n\nI am requesting a Level 1 appeal of the CO-50 denial for CPT 72148 (lumbar MRI), DOS 2026-10-02, billed $1,840.\n\nPlan policy CG-0423 sec 4.2 is met: radicular pain for over 6 weeks, failure of 8 weeks of physical therapy and NSAIDs (Aug 4 to Sep 29), and a new motor deficit documented at the Sep 30 re-evaluation. The MRI order with indication is attached.\n\nPlease reverse the denial and reprocess the claim.`;
  await ta.click(); await ta.fill(''); await ta.pressSequentially(draft, { delay: 9 }); await settle(800);
  await page.getByRole('button', { name: /Submit for verification/i }).first().click(); await settle(3200);
});

console.log('waiting for verification of', JOB);
for (let i = 0; i < (ONLY.includes('06') ? 80 : 0); i++) { const c = await api(`/api/case/${JOB}`); if (c?.recommendation && c.recommendation.agrees.length >= 3) break; await sleep(8000); }

await clip('06-verdict', async (page) => {
  await page.goto(BASE + `/case/${JOB}`); await settle(2600);
  await glide(page, 700, 1800); await settle(2200);
  await glide(page, 1500, 1800); await settle(2400);
  const accept = page.getByRole('button', { name: /Accept and send/i }).first();
  await accept.scrollIntoViewIfNeeded().catch(() => {}); await settle(800);
  await accept.click().catch(() => {}); await settle(2800);
});

await clip('07-review-supervisor', async (page) => {
  await page.goto(BASE + `/poster/${JOB}/review`); await settle(2600);
  await glide(page, 500, 1200); await settle(1500);
  await page.getByRole('button', { name: /Approve/i }).first().click().catch(() => {}); await settle(2200);
  await page.goto(BASE + '/supervisor'); await settle(3000);
  await page.goto(BASE + '/how-it-works'); await settle(2400);
  await glide(page, 900, 1800); await settle(2200);
});

await browser.close();
console.log('done');
