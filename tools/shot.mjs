/* ------------------------------------------------------------------ *
 * Headless screenshots for reviewing the town while building it.
 *
 *   node tools/shot.mjs [views.json | inline-json] [--port 5188] [--w 1600 --h 900] [--out .shots]
 *
 * A view is { name, x, z, yaw, pitch, y?, advance? }. With `y` the camera
 * is free (aerial); without it the walker stands at (x, z). `advance`
 * runs the simulation for that many seconds first (traffic, trains).
 * Starts its own Vite dev server unless one answers on the port.
 * ------------------------------------------------------------------ */
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const args = process.argv.slice(2);
const opt = (k, d) => { const i = args.indexOf('--' + k); return i >= 0 ? args[i + 1] : d; };
const port = Number(opt('port', 5188));
const W = Number(opt('w', 1600)), H = Number(opt('h', 900));
const outDir = opt('out', '.shots');
const first = args.find((a) => !a.startsWith('--') && !/^\d+$/.test(a) && args[args.indexOf(a) - 1]?.startsWith('--') !== true);

let views;
if (!first) views = [{ name: 'spawn' }];
else if (first.trim().startsWith('[') || first.trim().startsWith('{')) views = JSON.parse(first);
else views = JSON.parse(fs.readFileSync(first, 'utf8'));
if (!Array.isArray(views)) views = [views];

async function up(url) {
  try { const r = await fetch(url); return r.ok; } catch { return false; }
}

const url = `http://127.0.0.1:${port}/?dev`;
let server = null;
if (!(await up(`http://127.0.0.1:${port}/`))) {
  server = spawn('npx', ['vite', '--port', String(port), '--strictPort'], { stdio: 'ignore', detached: true });
  for (let i = 0; i < 60 && !(await up(`http://127.0.0.1:${port}/`)); i++) await new Promise((r) => setTimeout(r, 500));
}

fs.mkdirSync(outDir, { recursive: true });
const browser = await chromium.launch({
  headless: true,
  args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist', '--enable-unsafe-swiftshader'],
});
const page = await browser.newPage({ viewport: { width: W, height: H } });
const errors = [];
page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') errors.push(`[${m.type()}] ${m.text()}`); });
page.on('pageerror', (e) => errors.push(`[pageerror] ${e.message}`));
await page.goto(url, { waitUntil: 'load' });
await page.waitForFunction(() => window.__city?.ready, null, { timeout: 120000 });
await page.waitForTimeout(800);

for (const v of views) {
  const name = v.name || 'shot';
  await page.evaluate((v) => {
    const c = window.__city;
    if (v.x !== undefined) c.view(v);
    if (v.advance) c.advance(v.advance);
    if (v.x !== undefined) c.view(v);
    c.renderNow();
  }, v);
  await page.waitForTimeout(v.wait ?? 250);
  const file = path.join(outDir, `${name}.jpg`);
  await page.screenshot({ path: file, type: 'jpeg', quality: 86 });
  const stats = await page.evaluate(() => window.__city.stats());
  console.log(`${file}  ${JSON.stringify(stats)}`);
}
if (errors.length) console.log('--- console ---\n' + [...new Set(errors)].slice(0, 30).join('\n'));
await browser.close();
if (server) process.kill(-server.pid);
