/* ------------------------------------------------------------------ *
 * Scripted play-through for testing controllers headlessly.
 *
 *   node tools/play.mjs script.json [--port 5188] [--out .shots]
 *
 * A script is a list of steps:
 *   { "eval": "js expression run in the page (has __city)" }
 *   { "keys": ["KeyW"], "hold": 2.5 }   hold keys for simulated seconds
 *   { "wait": 1.0 }                     simulate seconds with no input
 *   { "shot": "name" }                  render and save a screenshot
 * Simulation time is advanced deterministically, not in real time.
 * ------------------------------------------------------------------ */
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const args = process.argv.slice(2);
const opt = (k, d) => { const i = args.indexOf('--' + k); return i >= 0 ? args[i + 1] : d; };
const port = Number(opt('port', 5188));
const outDir = opt('out', '.shots');
const src = args[0];
const steps = src.trim().startsWith('[') ? JSON.parse(src) : JSON.parse(fs.readFileSync(src, 'utf8'));

async function up(url) { try { return (await fetch(url)).ok; } catch { return false; } }
let server = null;
if (!(await up(`http://127.0.0.1:${port}/`))) {
  server = spawn('npx', ['vite', '--port', String(port), '--strictPort'], { stdio: 'ignore', detached: true });
  for (let i = 0; i < 60 && !(await up(`http://127.0.0.1:${port}/`)); i++) await new Promise((r) => setTimeout(r, 500));
}
fs.mkdirSync(outDir, { recursive: true });
const browser = await chromium.launch({ headless: true, args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 1600, height: 900 } });
const errors = [];
page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') errors.push(`[${m.type()}] ${m.text()}`); });
page.on('pageerror', (e) => errors.push(`[pageerror] ${e.message}`));
await page.goto(`http://127.0.0.1:${port}/?dev`, { waitUntil: 'load' });
await page.waitForFunction(() => window.__city?.ready, null, { timeout: 120000 });
await page.evaluate(() => { window.__city.game.input.force = true; });

for (const st of steps) {
  if (st.eval) {
    const r = await page.evaluate((code) => { try { return JSON.stringify(eval(code)); } catch (e) { return 'ERR ' + e.message; } }, st.eval);
    if (r !== undefined) console.log('eval:', r?.slice?.(0, 400));
  }
  if (st.keys) {
    for (const k of st.keys) await page.keyboard.down(k);
    await page.evaluate((s) => window.__city.advance(s), st.hold ?? 0.5);
    for (const k of st.keys) await page.keyboard.up(k);
  }
  if (st.press) await page.keyboard.press(st.press);
  if (st.wait) await page.evaluate((s) => window.__city.advance(s), st.wait);
  if (st.shot) {
    await page.evaluate(() => window.__city.renderNow());
    await page.waitForTimeout(150);
    const file = path.join(outDir, `${st.shot}.jpg`);
    await page.screenshot({ path: file, type: 'jpeg', quality: 86 });
    console.log(file);
  }
}
if (errors.length) console.log('--- console ---\n' + [...new Set(errors)].slice(0, 30).join('\n'));
await browser.close();
if (server) process.kill(-server.pid);
