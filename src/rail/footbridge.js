import { BRIDGE } from './layout.js';
import { railing } from './platform.js';

/* ------------------------------------------------------------------ *
 * The footbridge over the tracks: a steel bowstring truss on lattice
 * piers, with open-tread stairs and a landing at each end. The deck and
 * stairs are walkable; side walls keep you on them and stop you walking
 * into the space underneath.
 * ------------------------------------------------------------------ */

const STEEL = 0x5f7d8c;
const STEEL_DARK = 0x46606e;
const TREAD = 0x6f7577;
const HALF = BRIDGE.width / 2;
const RISE = 0.172;
const LANDING = 1.6;
const DECK_T = 0.35;

/**
 * Flights for one end. `sign` is +1 when the stairs run toward +z.
 * Each flight is { za, zb, ya, yb } from the deck end down.
 */
function flightsFor(zEnd, sign) {
  const half = BRIDGE.deckY / 2;
  const run = BRIDGE.stairRun / 2;
  const z1 = zEnd + sign * run;
  const z2 = z1 + sign * LANDING;
  const z3 = z2 + sign * run;
  return {
    flights: [{ za: zEnd, zb: z1, ya: BRIDGE.deckY, yb: half }, { za: z2, zb: z3, ya: half, yb: 0 }],
    landing: { za: z1, zb: z2, y: half },
    foot: z3,
  };
}

function truss(b, x) {
  const { z0, z1 } = BRIDGE;
  const y0 = BRIDGE.deckY - DECK_T;
  const len = z0 - z1;
  const n = 10;
  const top = (t) => BRIDGE.deckY + 0.3 + 3.2 * Math.sin(Math.PI * t);
  b.box(0.22, 0.34, len, STEEL_DARK, x, y0 - 0.05, (z0 + z1) / 2);
  const arcN = 20;
  for (let i = 0; i < arcN; i++) {
    const ta = i / arcN, tb = (i + 1) / arcN;
    b.tube(x, top(ta), z1 + len * ta, x, top(tb), z1 + len * tb, 0.12, STEEL_DARK, { seg: 6, open: false });
  }
  for (let i = 0; i <= n; i++) {
    const t = i / n, z = z1 + len * t;
    b.tube(x, y0, z, x, top(t), z, 0.06, STEEL, { seg: 5 });
    if (i < n) {
      const t2 = (i + 1) / n, zb = z1 + len * t2;
      if (i % 2) b.tube(x, y0, z, x, top(t2), zb, 0.05, STEEL, { seg: 5 });
      else b.tube(x, top(t), z, x, y0, zb, 0.05, STEEL, { seg: 5 });
    }
  }
  return top;
}

function span(ctx) {
  const b = ctx.batch;
  const { x, z0, z1, deckY } = BRIDGE;
  const len = z0 - z1, zc = (z0 + z1) / 2;
  b.box(BRIDGE.width + 0.3, DECK_T, len, 0x7c7f80, x, deckY - DECK_T, zc, { closed: true });
  b.box(BRIDGE.width - 0.2, 0.02, len, 0x5b5e60, x, deckY, zc, { cast: false });
  const top = truss(b, x - HALF - 0.05);
  truss(b, x + HALF + 0.05);
  // overhead bracing where there is headroom
  for (let i = 2; i <= 8; i++) {
    const t = i / 10, z = z1 + len * t, y = top(t);
    b.tube(x - HALF, y, z, x + HALF, y, z, 0.06, STEEL, { seg: 5 });
    if (i < 8) {
      const t2 = (i + 1) / 10, zb = z1 + len * t2;
      b.tube(x - HALF, y, z, x + HALF, top(t2), zb, 0.035, STEEL, { seg: 4 });
    }
  }
  for (const s of [-1, 1]) railing(b, x + s * (HALF - 0.1), z1, x + s * (HALF - 0.1), z0, deckY, { h: 1.1, color: STEEL });
  ctx.ground.flat(x - HALF, z1, x + HALF, z0, deckY, 'bridge');
  for (const s of [-1, 1]) {
    const xs = x + s * HALF;
    ctx.colliders.box(xs - 0.12, z1, xs + 0.12, z0, { top: deckY + 1.3, bottom: deckY - 0.2, tag: 'bridge' });
  }
  // lattice piers under both ends
  for (const z of [z0 - 0.4, z1 + 0.4]) pier(ctx, x, z, deckY - DECK_T);
}

function pier(ctx, x, z, h) {
  const b = ctx.batch;
  for (const s of [-1, 1]) {
    b.box(0.36, h, 0.36, STEEL_DARK, x + s * 1.3, 0, z);
    b.box(0.8, 0.3, 0.8, 0x9d998f, x + s * 1.3, -0.04, z);
    ctx.colliders.circle(x + s * 1.3, z, 0.3, { top: h });
  }
  for (let y = 0.6; y < h - 1; y += 1.6) {
    b.tube(x - 1.3, y, z, x + 1.3, y + 1.6, z, 0.04, STEEL, { seg: 4 });
    b.tube(x + 1.3, y, z, x - 1.3, y + 1.6, z, 0.04, STEEL, { seg: 4 });
  }
  b.box(2.9, 0.3, 0.4, STEEL_DARK, x, h - 0.3, z);
}

function stairs(ctx, zEnd, sign) {
  const b = ctx.batch;
  const { x } = BRIDGE;
  const { flights, landing, foot } = flightsFor(zEnd, sign);
  for (const f of flights) {
    const n = Math.round((f.ya - f.yb) / RISE);
    for (let i = 0; i < n; i++) {
      const t = (i + 0.5) / n;
      const y = f.ya - (f.ya - f.yb) * ((i + 1) / n);
      b.box(BRIDGE.width - 0.3, 0.06, (f.zb - f.za) * sign / n + 0.04, TREAD, x, y - 0.06, f.za + (f.zb - f.za) * t, { closed: true });
    }
    for (const s of [-1, 1]) {
      const xs = x + s * (HALF - 0.1);
      b.tube(xs, f.ya - 0.35, f.za, xs, f.yb - 0.35, f.zb, 0.1, STEEL_DARK, { seg: 5, open: false });
      b.tube(xs, f.ya + 1.0, f.za, xs, f.yb + 1.0, f.zb, 0.03, STEEL);
      b.tube(xs, f.ya + 0.5, f.za, xs, f.yb + 0.5, f.zb, 0.02, STEEL);
      for (let i = 0; i <= 4; i++) {
        const t = i / 4;
        b.cyl(0.025, 1.0, STEEL, xs, f.ya + (f.yb - f.ya) * t, f.za + (f.zb - f.za) * t, { seg: 4 });
      }
    }
    const lo = Math.min(f.za, f.zb), hi = Math.max(f.za, f.zb);
    // ramp y0 belongs to the low-z side
    const yLo = f.za < f.zb ? f.ya : f.yb, yHi = f.za < f.zb ? f.yb : f.ya;
    ctx.ground.ramp(x - HALF, lo, x + HALF, hi, yLo, yHi, 'z', 'bridge');
  }
  // the landing on two posts
  const lz = (landing.za + landing.zb) / 2;
  b.box(BRIDGE.width, 0.2, LANDING, TREAD, x, landing.y - 0.2, lz, { closed: true });
  for (const s of [-1, 1]) {
    b.box(0.26, landing.y - 0.2, 0.26, STEEL_DARK, x + s * (HALF - 0.2), 0, lz);
    railing(b, x + s * (HALF - 0.1), landing.za, x + s * (HALF - 0.1), landing.zb, landing.y, { h: 1.0, color: STEEL });
  }
  ctx.ground.flat(x - HALF, Math.min(landing.za, landing.zb), x + HALF, Math.max(landing.za, landing.zb), landing.y, 'bridge');

  // side walls from the deck end to the foot, and a wall across the top end at ground level
  const lo = Math.min(zEnd, foot), hi = Math.max(zEnd, foot);
  for (const s of [-1, 1]) {
    const xs = x + s * HALF;
    ctx.colliders.box(xs - 0.12, lo, xs + 0.12, hi, { top: BRIDGE.deckY + 1.3, bottom: -1, tag: 'bridge' });
  }
  ctx.colliders.box(x - HALF, zEnd - 0.15, x + HALF, zEnd + 0.15, { top: BRIDGE.deckY - 0.5, bottom: -1, tag: 'bridge' });
}

/** The footbridge. Returns where its stairs come down. */
export function buildFootbridge(ctx) {
  span(ctx);
  stairs(ctx, BRIDGE.z0, 1);
  stairs(ctx, BRIDGE.z1, -1);
  return {
    southFoot: flightsFor(BRIDGE.z0, 1).foot,
    northFoot: flightsFor(BRIDGE.z1, -1).foot,
  };
}
