import { flat } from '../core/toon.js';
import { canvasTex, cached, centerText, FONT } from '../core/textures.js';
import { rngKit } from '../core/util.js';
import { texPlane } from '../world/buildings/landmarks.js';
import { addBench, addBin } from '../world/props/street.js';

/* ------------------------------------------------------------------ *
 * The working corners of the station block: the bus terminus pavilion,
 * the goods yard with its gantry crane and containers west of the
 * station, and the track maintenance yard east of the crossing road.
 * ------------------------------------------------------------------ */

const SILICATE = 0xd8d2c4;
const CONTAINERS = [0x2f5f8e, 0x9a3a2e, 0x6f7a73, 0x3e6b4f, 0xb8862e, 0x7a7f86];

function signTex(key, lines, { w = 1024, h = 128, bg = '#2f5f9e', fg = '#ffffff' } = {}) {
  return cached(`yard|${key}`, () => canvasTex(w, h, (c) => {
    c.fillStyle = bg;
    c.fillRect(0, 0, w, h);
    const n = lines.length;
    lines.forEach((t, i) => centerText(c, t, w / 2, (h * (i + 0.5)) / n, w - 40, (h / n) * 0.62, fg, { family: FONT.sans, weight: '700' }));
  }));
}

/** Small glazed pavilion for the bus terminus, backed onto the platform wall. */
export function busPavilion(ctx, x0, x1, zBack) {
  const b = ctx.batch;
  const xc = (x0 + x1) / 2, d = 4.4, h = 3.0, z = zBack + d / 2;
  b.box(x1 - x0 + 0.4, 0.2, d + 3.2, 0x9d998f, xc, 0, z + 1.4);
  b.box(x1 - x0, h, d, 0xeeebe2, xc, 0.2, z);
  b.box(x1 - x0 - 1.2, 1.6, 0.06, 0x3a5a78, xc, 1.0, zBack + d + 0.01, { mat: 'glass' });
  for (let i = 0; i <= 6; i++) b.box(0.08, 1.7, 0.1, 0x3f6d9a, x0 + 0.6 + (i * (x1 - x0 - 1.2)) / 6, 0.95, zBack + d + 0.03);
  b.box(1.0, 2.1, 0.06, 0x3f6d9a, x1 - 1.2, 0.2, zBack + d + 0.02);
  // flat roof with a deep canopy on two posts over the waiting bench
  b.box(x1 - x0 + 0.8, 0.22, d + 3.4, 0x8f9294, xc, h + 0.2, z + 1.5, { closed: true });
  for (const s of [-1, 1]) {
    b.cyl(0.08, h, 0x4a4d50, xc + s * ((x1 - x0) / 2 - 0.2), 0.2, zBack + d + 2.9, { seg: 6 });
    ctx.colliders.circle(xc + s * ((x1 - x0) / 2 - 0.2), zBack + d + 2.9, 0.15, { top: h });
  }
  const mat = cached('yard|pavilion-sign-mat', () => flat({ map: signTex('pavilion', ['ДИСПЕТЧЕРСКАЯ', 'Конечная остановка «Вокзал»']) }));
  texPlane(b, mat, x1 - x0 - 1, 0.7, xc, h - 0.55, zBack + d + 0.04, Math.PI);
  addBench(b, xc - 2, zBack + d + 1.4, Math.PI, { y: 0.2, style: 'park', color: 0x5f7fa6 });
  addBin(b, xc + 1.2, zBack + d + 1.6, Math.PI, 0.2);
  ctx.ground.flat(x0 - 0.2, zBack, x1 + 0.2, zBack + d + 3.0, 0.2, 'pavilion');
  ctx.colliders.box(x0, zBack, x1, zBack + d, { top: h + 0.4, tag: 'pavilion' });
  return { window: { x: xc - 3, z: zBack + d + 0.4 } };
}

/* ---------------- goods yard ---------------- */

function container(b, x, z, ry, color, y = 0) {
  b.box(6.06, 2.59, 2.44, color, x, y, z, { ry });
  // corrugation: a few darker ribs down each long side
  for (let i = -5; i <= 5; i += 2) {
    const dx = Math.cos(ry) * i * 0.5, dz = -Math.sin(ry) * i * 0.5;
    b.box(0.12, 2.4, 2.48, color - 0x0a0a0a, x + dx, y + 0.1, z + dz, { ry });
  }
}

function gantry(ctx, x0, x1, z0, z1) {
  const b = ctx.batch;
  const YELLOW = 0xd9a42a, h = 9;
  for (const z of [z0, z1]) {
    b.box(x1 - x0 + 8, 0.12, 0.3, 0x5d4c40, (x0 + x1) / 2, 0, z);       // crane rail
  }
  const cx = (x0 + x1) / 2 - 6;
  for (const z of [z0, z1]) {
    for (const s of [-1, 1]) b.tube(cx + s * 2.4, 0.4, z, cx, h, z, 0.28, YELLOW, { seg: 6, open: false });
    b.box(5.6, 0.8, 0.9, YELLOW, cx, 0, z);
    ctx.colliders.box(cx - 2.8, z - 0.5, cx + 2.8, z + 0.5, { top: 1.5, tag: 'crane' });
  }
  b.box(1.4, 1.3, z1 - z0 + 7, YELLOW, cx, h, (z0 + z1) / 2);
  b.box(2.4, 1.6, 2.4, 0x3f6d9a, cx, h - 1.8, z0 + 3);               // cab
  b.box(2.0, 1.2, 0.06, 0x36464f, cx, h - 1.4, z0 + 4.22, { mat: 'glass' });
  b.box(1.6, 0.9, 2.0, 0x4a4d50, cx, h - 0.9, (z0 + z1) / 2 + 2);     // trolley
  b.tube(cx, h - 0.9, (z0 + z1) / 2 + 2, cx, 3.2, (z0 + z1) / 2 + 2, 0.03, 0x2a2a2a);
  b.box(0.8, 0.3, 0.3, 0x4a4d50, cx, 3.0, (z0 + z1) / 2 + 2);
}

export function goodsYard(ctx, { x0, x1, z0, z1 }) {
  const b = ctx.batch;
  const r = rngKit(311);
  // goods platform with a shed along the north side
  const px0 = x0 + 6, px1 = x0 + 44, pz = z0 + 2;
  b.span(px0, 0, pz, px1, 1.2, pz + 6, 0xa8a397);
  b.span(px0 + 2, 1.2, pz + 0.5, px1 - 2, 5.2, pz + 4.5, SILICATE);
  b.box(px1 - px0, 0.14, 7, 0x9c9990, (px0 + px1) / 2, 5.2, pz + 3, { rx: 0.06, closed: true });
  for (let x = px0 + 5; x < px1 - 4; x += 8) b.box(2.8, 2.8, 0.08, 0x6b5238, x, 1.2, pz + 4.52);
  ctx.colliders.box(px0, pz, px1, pz + 6, { top: 1.2, tag: 'ramp' });
  ctx.colliders.box(px0 + 2, pz + 0.5, px1 - 2, pz + 4.5, { top: 5.2, tag: 'shed' });
  ctx.ground.flat(px0, pz, px1, pz + 6, 1.2, 'ramp');

  // container stacks, some two high
  const cz0 = pz + 12;
  for (let row = 0; row < 3; row++) {
    for (let i = 0; i < 6; i++) {
      if (r.chance(0.15)) continue;
      const x = x0 + 8 + i * 7, z = cz0 + row * 3.4;
      const high = r.chance(0.35);
      container(b, x, z, 0, r.pick(CONTAINERS));
      if (high) container(b, x + r.range(-0.2, 0.2), z, 0, r.pick(CONTAINERS), 2.59);
      ctx.colliders.box(x - 3.03, z - 1.22, x + 3.03, z + 1.22, { top: high ? 5.2 : 2.6, tag: 'container' });
    }
  }
  gantry(ctx, x0 + 4, x1 - 6, cz0 - 3, cz0 + 10.5);
  // a lorry-width gate in a concrete fence along the east side
  for (let z = z0 + 1; z < z1 - 1; z += 4) {
    if (z > z0 + 30 && z < z0 + 40) continue;
    b.box(0.15, 2.2, 3.9, 0xb1ada3, x1 - 0.5, 0, z + 2);
  }
  ctx.colliders.box(x1 - 0.6, z0 + 1, x1 - 0.4, z0 + 30, { top: 2.2 });
  ctx.colliders.box(x1 - 0.6, z0 + 40, x1 - 0.4, z1 - 1, { top: 2.2 });
}

/* ---------------- track maintenance yard ---------------- */

function stack(b, x, z, n, w, h, len, color, r) {
  for (let j = 0; j < n; j++) {
    for (let i = 0; i < 6 - j; i++) {
      b.box(w, h, len, r.chance(0.3) ? color - 0x0b0b0b : color, x + (i - (5 - j) / 2) * (w + 0.04), j * h, z, { ry: r.range(-0.02, 0.02) });
    }
  }
}

export function maintenanceYard(ctx, { x0, x1, z0, z1 }) {
  const b = ctx.batch;
  const r = rngKit(312);
  // the ПЧ office: two storeys of silicate brick, a flat roof
  const ox0 = x0 + 30, ox1 = ox0 + 26, oz0 = z0 + 4, oz1 = oz0 + 10;
  b.span(ox0, 0, oz0, ox1, 6.6, oz1, SILICATE);
  b.span(ox0 - 0.1, 6.6, oz0 - 0.1, ox1 + 0.1, 6.9, oz1 + 0.1, 0xc8c2b4);
  for (let fl = 0; fl < 2; fl++) {
    for (let i = 0; i < 8; i++) {
      b.box(1.4, 1.5, 0.06, 0x3d4d56, ox0 + 2 + i * 3.1, 1.0 + fl * 3.1, oz1 + 0.01, { mat: 'glass' });
      b.box(1.55, 0.1, 0.12, 0xece8de, ox0 + 2 + i * 3.1, 0.95 + fl * 3.1, oz1 + 0.03);
    }
  }
  b.box(1.4, 2.2, 0.08, 0x6b5238, ox1 - 3, 0, oz1 + 0.02);
  b.box(2.6, 0.15, 1.4, 0xb1ada3, ox1 - 3, 2.4, oz1 + 0.7, { closed: true });
  const mat = cached('yard|pch-mat', () => flat({ map: signTex('pch', ['ДИСТАНЦИЯ ПУТИ'], { w: 512, h: 64 }) }));
  texPlane(b, mat, 5, 0.6, (ox0 + ox1) / 2, 6.0, oz1 + 0.05, Math.PI);
  ctx.colliders.box(ox0, oz0, ox1, oz1, { top: 6.9, tag: 'office' });

  // old sleepers and new rail, a hand trolley, a shed
  stack(b, x0 + 8, z0 + 10, 3, 0.28, 0.2, 2.7, 0x5a4a3a, r);
  stack(b, x0 + 14, z0 + 10, 4, 0.28, 0.2, 2.7, 0x5a4a3a, r);
  ctx.colliders.box(x0 + 6, z0 + 8.6, x0 + 16, z0 + 11.4, { top: 0.9 });
  for (let j = 0; j < 3; j++) for (let i = 0; i < 5; i++) b.box(0.08, 0.15, 12.5, 0x5d4c40, x0 + 20 + i * 0.25, j * 0.16 + 0.2, z0 + 20);
  b.box(1.8, 0.2, 13, 0x6b5238, x0 + 20.5, 0, z0 + 20);
  ctx.colliders.box(x0 + 19.4, z0 + 13.5, x0 + 21.6, z0 + 26.5, { top: 0.8 });
  const sx0 = ox1 + 8;
  b.span(sx0, 0, z0 + 3, sx0 + 12, 3.4, z0 + 11, 0x8d9aa0);
  b.box(12.4, 0.12, 8.6, 0x9a5a3c, sx0 + 6, 3.4, z0 + 7, { rx: 0.05 });
  b.box(3.4, 2.8, 0.06, 0x6f7a73, sx0 + 6, 0, z0 + 11.02);
  ctx.colliders.box(sx0, z0 + 3, sx0 + 12, z0 + 11, { top: 3.5 });
  // fence to the street with a gate
  for (let x = x0 + 1; x < x1 - 1; x += 4) {
    if (x > ox0 - 6 && x < ox0 + 2) continue;
    b.box(3.9, 2.0, 0.15, 0xb1ada3, x + 2, 0, z1 - 0.6);
  }
  ctx.colliders.box(x0 + 1, z1 - 0.7, ox0 - 6, z1 - 0.5, { top: 2 });
  ctx.colliders.box(ox0 + 2, z1 - 0.7, x1 - 1, z1 - 0.5, { top: 2 });
  return { office: { x: ox1 - 3, z: oz1 + 0.6 } };
}
