/* ------------------------------------------------------------------ *
 * Vehicle showroom: builds catalogue types in a row on open ground and
 * photographs them from a few angles.
 *
 *   node tools/showroom.mjs lada2107,lada2106 [--port 5191] [--out .shots/show]
 *        [--angles front,rear,side,top] [--gap 6] [--advance 0]
 * ------------------------------------------------------------------ */
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const args = process.argv.slice(2);
const opt = (k, d) => { const i = args.indexOf('--' + k); return i >= 0 ? args[i + 1] : d; };
const types = args[0].split(',');
const port = Number(opt('port', 5191));
const outDir = opt('out', '.shots/show');
const angles = opt('angles', 'front,rear').split(',');
const gap = Number(opt('gap', 6));
const open = Number(opt('open', 0));
const player = args.includes('--player');

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
page.on('pageerror', (e) => errors.push(`[pageerror] ${e.stack || e.message}`));
await page.goto(`http://127.0.0.1:${port}/?dev`, { waitUntil: 'load' });
await page.waitForFunction(() => window.__city?.ready, null, { timeout: 120000 });

const info = await page.evaluate(async ({ types, gap, open, player }) => {
  const cat = await import('/src/vehicles/catalog.js');
  const c = window.__city;
  // clear traffic out of the way
  for (const v of c.game.traffic?.vehicles || []) v.model.group.visible = false;
  c.game.traffic.update = () => {};
  const out = [];
  const X0 = 30, Z0 = -40;
  window.__showModels = [];
  types.forEach((t, i) => {
    const m = cat.buildVehicle(t, { seed: 3 + i * 11, player, ...(player ? { color: 0x7d1d27, plate: 'D 107 KZ' } : {}) });
    m.group.position.set(X0 + i * gap, 0, Z0);
    m.group.rotation.y = 0;
    c.game.scene.add(m.group);
    window.__showModels.push(m);
    if (m.routeBoard) m.routeBoard('44');
    for (const d of m.doors) d.set(open);
    let tris = 0, calls = 0;
    m.group.traverse((o) => { if (o.isMesh && o.visible) { calls++; const g = o.geometry; tris += (g.index ? g.index.count : g.attributes.position.count) / 3; } });
    const r = { t, L: m.length, W: m.width, H: m.height, calls, tris: Math.round(tris) };
    if (m.poleTips) {
      m.group.updateMatrixWorld(true);
      r.tips = m.poleTips.map((o) => { const v = o.isObject3D ? o.getWorldPosition(new c.THREE.Vector3()).sub(m.group.position) : o; return [+v.x.toFixed(2), +v.y.toFixed(2), +v.z.toFixed(2)]; });
    }
    out.push(r);
  });
  window.__show = { X0, Z0, n: types.length };
  return out;
}, { types, gap, open, player });
console.log(JSON.stringify(info));

const n = types.length;
const cx = 30 + ((n - 1) * gap) / 2;
const span = Math.max(8, n * gap);
const views = {
  // camera looks at the front (-z) three-quarter from the front-right
  front: { x: cx + span * 0.35, y: 2.6, z: -40 - span * 0.55, look: [cx, 0.8, -40] },
  rear: { x: cx - span * 0.35, y: 2.6, z: -40 + span * 0.55, look: [cx, 0.8, -40] },
  side: { x: cx, y: 1.5, z: -40 + span * 0.62 + 2, look: [cx, 0.9, -40] },
  top: { x: cx, y: span * 0.9, z: -40 + 0.1, look: [cx, 0, -40] },
  close: { x: 30 + 3.2, y: 1.5, z: -40 - 4.2, look: [30, 0.8, -40] },
  closer: { x: 30 - 3.4, y: 1.4, z: -40 + 4.4, look: [30, 0.8, -40] },
};
const shots = [];
for (const a of angles) {
  if (a.startsWith('seat') || a === 'driver' || a === 'dash') {
    for (let i = 0; i < n; i++) {
      await page.evaluate(({ i, a }) => {
        const c = window.__city;
        const m = window.__showModels[i];
        if (m.interior) m.interior.visible = a === 'driver' || a === 'dash';
        if (m.driverGroup) m.driverGroup.visible = false;
        const k = a === 'driver' || a === 'dash' ? -1 : Number(a.slice(4) || 0);
        const e = k < 0 ? m.driverEye : m.seats[k % m.seats.length];
        const g = m.group;
        const p = new c.THREE.Vector3(e.x, e.y, e.z).applyEuler(g.rotation).add(g.position);
        c.view({ x: p.x, y: p.y, z: p.z, yaw: (e.yaw || 0) + g.rotation.y + (a === 'dash' ? 0 : 0), pitch: a === 'dash' ? -0.35 : -0.08 });
        c.renderNow();
      }, { i, a });
      await page.waitForTimeout(150);
      const file = path.join(outDir, `${types[i]}_${a}.jpg`);
      await page.screenshot({ path: file, type: 'jpeg', quality: 85 });
      shots.push(file);
    }
    continue;
  }
  if (a.startsWith('door')) {
    for (let i = 0; i < n; i++) {
      await page.evaluate(({ i, a }) => {
        const c = window.__city;
        const m = window.__showModels[i];
        const d = m.doorPos[Number(a.slice(4) || 0) % m.doorPos.length];
        const g = m.group.position;
        const at = [g.x + d.x - 0.7, 1.4, g.z + d.z];
        const from = [g.x + d.x + 3.2, 1.9, g.z + d.z - 1.6];
        const dir = new c.THREE.Vector3(at[0] - from[0], at[1] - from[1], at[2] - from[2]).normalize();
        c.view({ x: from[0], y: from[1], z: from[2], yaw: Math.atan2(-dir.x, -dir.z), pitch: Math.asin(dir.y) });
        c.renderNow();
      }, { i, a });
      await page.waitForTimeout(150);
      const file = path.join(outDir, `${types[i]}_${a}.jpg`);
      await page.screenshot({ path: file, type: 'jpeg', quality: 85 });
      shots.push(file);
    }
    continue;
  }
  if (a === 'each' || a === 'eachRear') {
    for (let i = 0; i < n; i++) {
      const X = 30 + i * gap;
      const k = Math.max(1, info[i].L / 4.3);
      const hy = Math.max(1.55, info[i].H * 0.6);
      const v = a === 'each'
        ? { x: X + 3.4 * k, y: hy, z: -40 - 4.6 * k, look: [X, info[i].H * 0.45, -40] }
        : { x: X - 3.4 * k, y: hy, z: -40 + 4.6 * k, look: [X, info[i].H * 0.45, -40] };
      await page.evaluate((v) => {
        const c = window.__city;
        const THREE = c.THREE;
        const dir = new THREE.Vector3(v.look[0] - v.x, v.look[1] - v.y, v.look[2] - v.z).normalize();
        c.view({ x: v.x, y: v.y, z: v.z, yaw: Math.atan2(-dir.x, -dir.z), pitch: Math.asin(dir.y) });
        c.renderNow();
      }, v);
      await page.waitForTimeout(150);
      const file = path.join(outDir, `${types[i]}_${a}.jpg`);
      await page.screenshot({ path: file, type: 'jpeg', quality: 85 });
      shots.push(file);
    }
    continue;
  }
  const v = views[a];
  await page.evaluate((v) => {
    const c = window.__city;
    const THREE = c.THREE;
    const cam = c.game.camera;
    const dir = new THREE.Vector3(v.look[0] - v.x, v.look[1] - v.y, v.look[2] - v.z).normalize();
    const yaw = Math.atan2(-dir.x, -dir.z);
    const pitch = Math.asin(dir.y);
    c.view({ x: v.x, y: v.y, z: v.z, yaw, pitch });
    c.renderNow();
    cam.updateMatrixWorld();
  }, v);
  await page.waitForTimeout(200);
  const file = path.join(outDir, `${types.length === 1 ? types[0] : 'row'}_${a}.jpg`);
  await page.screenshot({ path: file, type: 'jpeg', quality: 88 });
  console.log(file);
}
if (shots.length) console.log(shots.join(' '));
if (errors.length) console.log('--- console ---\n' + [...new Set(errors)].slice(0, 20).join('\n'));
await browser.close();
if (server) process.kill(-server.pid);
