import * as THREE from 'three';
import { flat } from '../core/toon.js';
import { canvasTex, cached, centerText, FONT } from '../core/textures.js';
import { SURF, TILE, hQuad, splitRect } from '../core/surfaces.js';
import { addBench, addBin, addLamp } from '../world/props/street.js';
import { texPlane } from '../world/buildings/landmarks.js';
import { PLATFORM, STATION } from './layout.js';

/* ------------------------------------------------------------------ *
 * Platform 1: a high concrete platform along the south track, slab
 * paved, with the white safety line, sloped ramps at both ends and two
 * flights of steps down to the station square either side of the
 * station house. Benches, bins, lamps and the station name boards.
 * ------------------------------------------------------------------ */

const P = { x0: PLATFORM.x0, x1: PLATFORM.x1, z0: PLATFORM.z0, z1: STATION.zBack, y: PLATFORM.y };
const RAMP = 8;
const FACE = 0x9a958a;
const COPING = 0xc9c5b8;
const RAIL_BLUE = 0x3f6d9a;

/** Passages from the platform down to the square, x ranges. */
export const PASSAGES = [
  { x0: -118, x1: -106 },
  { x0: STATION.x1 + 2, x1: STATION.x1 + 10 },
];
const STEP_RUN = 7;

/**
 * Triangular prism for a ramp: rises from 0 at the `low` end to `h` at
 * the other, along x or z.
 */
export function wedge(batch, x0, z0, x1, z1, h, axis, lowAtMin, color) {
  const lo = (x, z) => (axis === 'x' ? (lowAtMin ? x === x0 : x === x1) : (lowAtMin ? z === z0 : z === z1));
  const corners = [[x0, z0], [x1, z0], [x1, z1], [x0, z1]];
  const top = corners.map(([x, z]) => [x, lo(x, z) ? 0 : h, z]);
  const bot = corners.map(([x, z]) => [x, 0, z]);
  const tris = [[top[0], top[2], top[1]], [top[0], top[3], top[2]]];
  for (let i = 0; i < 4; i++) {
    const j = (i + 1) % 4;
    tris.push([bot[i], top[j], bot[j]], [bot[i], top[i], top[j]]);
  }
  const pos = new Float32Array(tris.length * 9);
  tris.forEach((t, i) => t.forEach((v, k) => pos.set(v, i * 9 + k * 3)));
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.computeVertexNormals();
  batch.add(g, { color });
}

/** Station name board: Kazakh above, Russian below. */
function nameBoardTex() {
  return cached('rail|name-board', () => canvasTex(512, 192, (c, W, H) => {
    c.fillStyle = '#f4f2ea';
    c.fillRect(0, 0, W, H);
    c.strokeStyle = '#2f5f9e';
    c.lineWidth = 10;
    c.strokeRect(5, 5, W - 10, H - 10);
    centerText(c, 'АҚТӨБЕ', W / 2, 64, W - 60, 72, '#244f8a', { family: FONT.sans, weight: '800' });
    centerText(c, 'АКТОБЕ', W / 2, 138, W - 60, 56, '#244f8a', { family: FONT.sans, weight: '700' });
  }));
}

function nameBoard(batch, x, z) {
  const mat = cached('rail|name-board-mat', () => flat({ map: nameBoardTex() }));
  for (const s of [-1, 1]) batch.cyl(0.05, 3.4, 0x4a4d50, x + s * 1.5, P.y, z, { seg: 6 });
  batch.box(3.3, 1.1, 0.06, 0x3f6d9a, x, P.y + 2.2, z);
  texPlane(batch, mat, 3.1, 0.95, x, P.y + 2.28, z - 0.04, 0);
  texPlane(batch, mat, 3.1, 0.95, x, P.y + 2.28, z + 0.04, Math.PI);
}

/** Tube railing along x or z at height y, posts every ~2 m. */
export function railing(batch, x0, z0, x1, z1, y, { h = 1.0, color = RAIL_BLUE } = {}) {
  batch.tube(x0, y + h, z0, x1, y + h, z1, 0.03, color);
  batch.tube(x0, y + h * 0.5, z0, x1, y + h * 0.5, z1, 0.02, color);
  const len = Math.hypot(x1 - x0, z1 - z0);
  const n = Math.max(1, Math.round(len / 2));
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    batch.cyl(0.025, h, color, x0 + (x1 - x0) * t, y, z0 + (z1 - z0) * t, { seg: 5 });
  }
}

function body(ctx) {
  const b = ctx.batch;
  b.span(P.x0, 0, P.z0, P.x1, P.y - 0.01, P.z1, FACE);
  for (const [x0, z0, x1, z1] of splitRect(P.x0, P.z0 + 0.35, P.x1, P.z1, 48)) {
    b.add(hQuad(x0, z0, x1, z1, P.y, TILE.slabs), { mat: SURF.slabs, color: null, cast: false });
  }
  // coping stones, then the painted white line inside them
  b.span(P.x0, P.y - 0.04, P.z0 - 0.04, P.x1, P.y + 0.012, P.z0 + 0.35, COPING);
  b.span(P.x0, P.y, P.z0 + 0.62, P.x1, P.y + 0.006, P.z0 + 0.8, 0xeeebe0, { cast: false });
  // a dark stain along the face where the rain runs off
  b.span(P.x0, 0.0, P.z0 - 0.045, P.x1, 0.35, P.z0 - 0.04, 0x6f6a60, { cast: false });

  wedge(b, P.x0 - RAMP, P.z0, P.x0, P.z1, P.y, 'x', true, FACE);
  wedge(b, P.x1, P.z0, P.x1 + RAMP, P.z1, P.y, 'x', false, FACE);
  ctx.ground.flat(P.x0, P.z0, P.x1, P.z1, P.y, 'platform');
  ctx.ground.ramp(P.x0 - RAMP, P.z0, P.x0, P.z1, 0, P.y, 'x', 'platform');
  ctx.ground.ramp(P.x1, P.z0, P.x1 + RAMP, P.z1, P.y, 0, 'x', 'platform');
  ctx.colliders.box(P.x0, P.z0, P.x1, P.z1, { top: P.y, tag: 'platform' });

  // ramp railings on both sides keep you on the slope
  for (const [xa, xb, ya, yb] of [[P.x0 - RAMP, P.x0, 0, P.y], [P.x1, P.x1 + RAMP, P.y, 0]]) {
    for (const z of [P.z0 + 0.1, P.z1 - 0.1]) {
      slopedRailing(b, xa, ya, xb, yb, z);
      ctx.colliders.box(xa, z - 0.12, xb, z + 0.12, { top: 2.4, tag: 'railing' });
    }
  }
}

/** Railing along x whose rails follow a slope from (xa, ya) to (xb, yb). */
function slopedRailing(b, xa, ya, xb, yb, z, h = 1.0) {
  b.tube(xa, ya + h, z, xb, yb + h, z, 0.03, RAIL_BLUE);
  b.tube(xa, ya + h / 2, z, xb, yb + h / 2, z, 0.02, RAIL_BLUE);
  for (let i = 0; i <= 4; i++) {
    const t = i / 4;
    b.cyl(0.025, h, RAIL_BLUE, xa + (xb - xa) * t, ya + (yb - ya) * t, z, { seg: 5 });
  }
}

function passages(ctx) {
  const b = ctx.batch;
  const n = 7;
  for (const { x0, x1 } of PASSAGES) {
    for (let i = 0; i < n; i++) {
      const h = P.y * (1 - i / n);
      b.span(x0, 0, P.z1 + (i * STEP_RUN) / n, x1, h, P.z1 + ((i + 1) * STEP_RUN) / n, i % 2 ? 0xb9b4a8 : 0xc2beb2);
    }
    ctx.ground.ramp(x0, P.z1, x1, P.z1 + STEP_RUN, P.y, 0, 'z', 'steps');
    for (const x of [x0, x1]) {
      b.span(x - 0.15, 0, P.z1, x + 0.15, P.y + 0.1, P.z1 + STEP_RUN, 0xa8a397);
      railing(b, x, P.z1, x, P.z1 + STEP_RUN, P.y + 0.1, { h: 0.9 });
      ctx.colliders.box(x - 0.15, P.z1, x + 0.15, P.z1 + STEP_RUN, { top: P.y + 1.2, tag: 'railing' });
    }
  }
  // railing along the back edge wherever the platform drops to the square
  const edges = [[P.x0, PASSAGES[0].x0], [PASSAGES[0].x1, STATION.x0], [STATION.x1, PASSAGES[1].x0], [PASSAGES[1].x1, P.x1]];
  for (const [a, c] of edges) {
    if (c - a < 0.2) continue;
    railing(b, a, P.z1 - 0.1, c, P.z1 - 0.1, P.y);
    ctx.colliders.box(a, P.z1 - 0.25, c, P.z1 + 0.05, { top: P.y + 1.2, tag: 'railing' });
  }
}

function furniture(ctx) {
  const b = ctx.batch;
  const zb = P.z0 + 3.1;
  const benches = [];
  for (const x of [-114, -96, -80, -54, -38, -20, 8]) {
    addBench(b, x, zb, 0, { y: P.y, color: 0x5f7fa6 });
    if (x % 3 === 0) addBin(b, x + 1.6, zb + 0.2, 0, P.y);
    benches.push({ x, z: zb, facing: 0, y: P.y });
  }
  for (const x of [-116, 6, 17]) addLamp(b, x, P.z0 + 1.6, Math.PI, { y: P.y, height: 6.2 });
  nameBoard(b, -111, P.z0 + 2.2);
  nameBoard(b, 12, P.z0 + 2.2);
  return benches;
}

/** The platform and its steps. Returns its benches. */
export function buildPlatform(ctx) {
  body(ctx);
  passages(ctx);
  return { benches: furniture(ctx), top: P.y, edgeZ: P.z0 };
}

