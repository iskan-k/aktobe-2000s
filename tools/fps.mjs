/* Measure real frame rate at a few views: node tools/fps.mjs [--port 5188] */
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
const args = process.argv.slice(2);
const opt = (k, d) => { const i = args.indexOf('--' + k); return i >= 0 ? args[i + 1] : d; };
const port = Number(opt('port', 5188));
const views = JSON.parse(opt('views', '[{"name":"spawn","x":32,"z":-10.8,"yaw":-1.8,"pitch":-0.03},{"name":"court","x":40,"z":40,"yaw":0.8,"pitch":0.05},{"name":"aerial","x":0,"y":150,"z":230,"yaw":0,"pitch":-0.55},{"name":"lane","x":-85,"z":-60,"yaw":1.57,"pitch":0.02}]'));
async function up(u) { try { return (await fetch(u)).ok; } catch { return false; } }
let server = null;
if (!(await up(`http://127.0.0.1:${port}/`))) {
  server = spawn('npx', ['vite', '--port', String(port), '--strictPort'], { stdio: 'ignore', detached: true });
  for (let i = 0; i < 60 && !(await up(`http://127.0.0.1:${port}/`)); i++) await new Promise((r) => setTimeout(r, 500));
}
const browser = await chromium.launch({ headless: true, args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist', '--disable-gpu-vsync', '--disable-frame-rate-limit'] });
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
await page.goto(`http://127.0.0.1:${port}/?dev&fixed`, { waitUntil: 'load' });
await page.waitForFunction(() => window.__city?.ready, null, { timeout: 120000 });
for (const v of views) {
  const r = await page.evaluate(async (v) => {
    window.__city.view(v);
    await new Promise((res) => setTimeout(res, 500));
    let n = 0; const t0 = performance.now();
    await new Promise((res) => { const f = () => { n++; if (performance.now() - t0 < 3000) requestAnimationFrame(f); else res(); }; requestAnimationFrame(f); });
    const dt = performance.now() - t0;
    return { fps: +(n / (dt / 1000)).toFixed(1), ...window.__city.stats() };
  }, v);
  console.log(v.name, JSON.stringify(r));
}
await browser.close();
if (server) process.kill(-server.pid);
