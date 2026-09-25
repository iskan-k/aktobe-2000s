import * as THREE from 'three';
import { cel } from '../core/toon.js';
import { Batch } from '../core/batch.js';
import { canvasTex, cached } from '../core/textures.js';
import { rngKit } from '../core/util.js';
import { SURF, TILE, hQuad, splitRect } from '../core/surfaces.js';
import { BOUNDS, RAIL } from '../world/plan.js';
import { addUtilityPole, addWires } from '../world/props/street.js';
import { texBox } from '../world/buildings/landmarks.js';
import {
  RAIL_Y, SLEEPER_TOP, GAUGE, JOINT, TRACK_SOUTH, TRACK_NORTH, REACH,
  CROSSING, BRIDGE, DEPOT, SIGNAL_POSTS, sidingZ,
} from './layout.js';

/* ------------------------------------------------------------------ *
 * The permanent way: ballast, concrete sleepers and jointed rail for
 * both main tracks out to the portals, the depot siding, the concrete
 * ПО-2 fences along the corridor, the line's telegraph poles and the
 * colour-light signal masts (their lamps are lit by the rail system).
 * ------------------------------------------------------------------ */

const BALLAST_TILE = 2.5;
const SLEEPER_STEP = 0.55;
const SLEEPER = { len: 2.7, w: 0.28, h: 0.16 };
const RAIL_W = 0.075;
const RAIL_BROWN = 0x5d4c40;
const RAIL_HEAD = 0xa8aaa6;
const SLEEPER_GREY = 0x9d998f;
const FENCE_H = 2.2;
const PANEL = 4;
const CORRIDOR = { z0: RAIL.corridor[0], z1: RAIL.corridor[1] };
const MAST = 0x6c7072;

/* ---------------- textures ---------------- */

function ballastTex() {
  return cached('rail|ballast', () => canvasTex(256, 256, (c, W, H) => {
    const r = rngKit(71);
    c.fillStyle = '#7d766b';
    c.fillRect(0, 0, W, H);
    for (let i = 0; i < 5200; i++) {
      c.fillStyle = r.pick(['#6a645b', '#8e877b', '#9b9486', '#5c564e', '#7a6250', '#a39a8a']);
      const s = r.range(2, 6);
      c.fillRect(r.range(0, W), r.range(0, H), s, s * r.range(0.6, 1.2));
    }
    // rust and oil stains
    for (let i = 0; i < 14; i++) {
      c.globalAlpha = r.range(0.08, 0.2);
      c.fillStyle = r.pick(['#5a3a24', '#2a2622']);
      c.beginPath();
      c.ellipse(r.range(0, W), r.range(0, H), r.range(10, 40), r.range(6, 20), r.range(0, 3), 0, Math.PI * 2);
      c.fill();
    }
    c.globalAlpha = 1;
  }, { repeat: [1, 1] }));
}

export function ballastMat() {
  return cached('rail|ballast-mat', () => cel({ map: ballastTex(), bands: 3, grime: 0.06, dirt: 0, cache: false }));
}

/** The ПО-2 panel: concrete with its raised diamond lattice. One panel per repeat. */
function fenceTex() {
  return cached('rail|po2', () => canvasTex(512, 282, (c, W, H) => {
    const r = rngKit(72);
    c.fillStyle = '#b1ada3';
    c.fillRect(0, 0, W, H);
    const cols = 10, rows = 4;
    const dw = W / cols, dh = (H - 50) / rows;
    for (let j = 0; j < rows; j++) {
      for (let i = 0; i < cols; i++) {
        const cx = i * dw + dw / 2, cy = 30 + j * dh + dh / 2;
        c.fillStyle = '#c2beb4';
        c.beginPath();
        c.moveTo(cx, cy - dh * 0.42); c.lineTo(cx + dw * 0.42, cy);
        c.lineTo(cx, cy + dh * 0.42); c.lineTo(cx - dw * 0.42, cy);
        c.closePath(); c.fill();
        c.strokeStyle = '#8f8b82';
        c.lineWidth = 2;
        c.beginPath();
        c.moveTo(cx - dw * 0.42, cy); c.lineTo(cx, cy + dh * 0.42); c.lineTo(cx + dw * 0.42, cy);
        c.stroke();
      }
    }
    // plain band at the top and bottom, the moulded edge
    c.fillStyle = '#a7a398';
    c.fillRect(0, 0, W, 26);
    c.fillRect(0, H - 22, W, 22);
    c.fillStyle = '#8c887e';
    c.fillRect(0, 24, W, 3);
    // streaks, a patch of damp near the ground, the odd graffito
    for (let i = 0; i < 40; i++) {
      c.globalAlpha = r.range(0.05, 0.14);
      c.fillStyle = '#5f5b54';
      c.fillRect(r.range(0, W), 0, r.range(1, 4), r.range(40, H));
    }
    c.globalAlpha = 0.25;
    c.fillStyle = '#6f6a5c';
    c.fillRect(0, H - 60, W, 60);
    c.globalAlpha = 1;
  }, { repeat: [1, 1] }));
}

function fenceMat() {
  return cached('rail|po2-mat', () => cel({ map: fenceTex(), bands: 3, grime: 0.08, dirt: 0.4, cache: false }));
}

/* ---------------- geometry helpers ---------------- */

/**
 * A strip swept along x with a fixed cross-section `profile`
 * ([[z, y], ...] absolute), uv in world metres / tile.
 */
function profileStrip(x0, x1, profile, tile) {
  const n = profile.length;
  const pos = new Float32Array(n * 2 * 3);
  const uv = new Float32Array(n * 2 * 2);
  for (let i = 0; i < n; i++) {
    const [z, y] = profile[i];
    pos.set([x0, y, z, x1, y, z], i * 6);
    uv.set([x0 / tile, -z / tile, x1 / tile, -z / tile], i * 4);
  }
  const idx = [];
  for (let i = 0; i < n - 1; i++) {
    const a = i * 2, b = a + 1, c = a + 2, d = a + 3;
    idx.push(a, c, b, b, c, d);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

/** A flat ribbon following a polyline [[x, z], ...] at height y. */
function ribbon(points, width, y, tile) {
  const n = points.length;
  const pos = new Float32Array(n * 2 * 3);
  const uv = new Float32Array(n * 2 * 2);
  for (let i = 0; i < n; i++) {
    const [x, z] = points[i];
    const [ax, az] = points[Math.max(0, i - 1)];
    const [bx, bz] = points[Math.min(n - 1, i + 1)];
    const len = Math.hypot(bx - ax, bz - az) || 1;
    const nx = -(bz - az) / len * width / 2, nz = (bx - ax) / len * width / 2;
    pos.set([x - nx, y, z - nz, x + nx, y, z + nz], i * 6);
    uv.set([(x - nx) / tile, -(z - nz) / tile, (x + nx) / tile, -(z + nz) / tile], i * 4);
  }
  const idx = [];
  for (let i = 0; i < n - 1; i++) {
    const a = i * 2, b = a + 1, c = a + 2, d = a + 3;
    idx.push(a, b, c, b, d, c);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

/** Skip sleepers where the crossing deck covers the track. */
const underDeck = (x) => x > CROSSING.x - CROSSING.outer - 0.5 && x < CROSSING.x + CROSSING.outer + 0.5;

/* ---------------- main line ---------------- */

function mainLine(batch) {
  const mat = ballastMat();
  // one bed for both tracks, humped under each
  const zn = TRACK_NORTH, zs = TRACK_SOUTH, mid = (zn + zs) / 2;
  const profile = [
    [zn - 2.5, -0.04], [zn - 1.7, 0.05], [mid - 0.9, 0.05], [mid, 0.0],
    [mid + 0.9, 0.05], [zs + 1.7, 0.05], [zs + 2.5, -0.04],
  ];
  const SEG = 46;
  for (let x = -REACH; x < REACH; x += SEG) {
    batch.add(profileStrip(x, Math.min(REACH, x + SEG), profile, BALLAST_TILE), { mat, color: null, cast: false });
  }

  const r = rngKit(73);
  for (const z of [zn, zs]) {
    for (let x = -REACH; x <= REACH; x += SLEEPER_STEP) {
      if (underDeck(x)) continue;
      const shade = r.chance(0.12) ? 0x8a8377 : SLEEPER_GREY;
      batch.box(SLEEPER.w, SLEEPER.h, SLEEPER.len, shade, x + r.range(-0.03, 0.03), SLEEPER_TOP - SLEEPER.h, z, { ry: r.range(-0.015, 0.015), cast: false });
    }
    rails(batch, z);
  }
}

function rails(batch, z) {
  const k0 = Math.floor(-REACH / JOINT), k1 = Math.ceil(REACH / JOINT);
  for (let k = k0; k < k1; k++) {
    const xc = (k + 0.5) * JOINT;
    for (const s of [-1, 1]) {
      const rz = z + s * GAUGE / 2;
      batch.box(JOINT - 0.03, RAIL_Y - SLEEPER_TOP - 0.014, RAIL_W, RAIL_BROWN, xc, SLEEPER_TOP, rz, { cast: false });
      batch.box(JOINT - 0.03, 0.014, 0.06, RAIL_HEAD, xc, RAIL_Y - 0.014, rz, { cast: false });
      // fishplate at the joint
      batch.box(0.6, 0.07, RAIL_W + 0.05, 0x4a3f36, k * JOINT, SLEEPER_TOP + 0.02, rz, { cast: false });
    }
  }
}

/* ---------------- depot siding ---------------- */

/** Points along the siding centreline from the shed out to the main line. */
export function sidingPoints() {
  const pts = [];
  const { shed, curve } = DEPOT;
  for (let x = shed.x0 + 2; x < curve.x0; x += 6) pts.push([x, DEPOT.z]);
  for (let x = curve.x0; x <= curve.x1 + 0.01; x += 2) pts.push([x, sidingZ(x)]);
  return pts;
}

function siding(batch) {
  const pts = sidingPoints();
  batch.add(ribbon(pts, 3.6, 0.03, BALLAST_TILE), { mat: ballastMat(), color: null, cast: false });
  const r = rngKit(74);
  // sleepers by arc length, rails as short straight pieces
  let carry = 0;
  for (let i = 0; i < pts.length - 1; i++) {
    const [ax, az] = pts[i], [bx, bz] = pts[i + 1];
    const len = Math.hypot(bx - ax, bz - az);
    const ry = -Math.atan2(bz - az, bx - ax);
    const nx = -(bz - az) / len, nz = (bx - ax) / len;
    for (let d = carry; d < len; d += SLEEPER_STEP + 0.05) {
      const t = d / len;
      batch.box(SLEEPER.w, SLEEPER.h, SLEEPER.len, r.chance(0.3) ? 0x7a6a58 : 0x8d877c,
        ax + (bx - ax) * t, SLEEPER_TOP - SLEEPER.h, az + (bz - az) * t, { ry, cast: false });
      carry = d + SLEEPER_STEP + 0.05 - len;
    }
    for (const s of [-1, 1]) {
      const ox = nx * s * GAUGE / 2, oz = nz * s * GAUGE / 2;
      batch.box(len + 0.02, RAIL_Y - SLEEPER_TOP, RAIL_W, 0x6a4e3c, (ax + bx) / 2 + ox, SLEEPER_TOP, (az + bz) / 2 + oz, { ry, cast: false });
    }
  }
  // buffer stop inside the shed: a sleeper crib and a red-white beam
  const x = DEPOT.shed.x0 + 1.2;
  batch.box(1.2, 1.1, 2.6, 0x6b5238, x, 0, DEPOT.z);
  batch.box(0.3, 0.4, 3.0, 0xc0302a, x + 0.7, 0.8, DEPOT.z);
}

/* ---------------- fences ---------------- */

/** x ranges for the concrete fence on each edge of the corridor. */
function fenceRuns() {
  const cx0 = CROSSING.x - CROSSING.outer, cx1 = CROSSING.x + CROSSING.outer;
  const pl0 = RAIL.platform.x0 - 8, pl1 = RAIL.platform.x1 + 8;
  const gap = sidingGap();
  return [
    { z: CORRIDOR.z1 - 0.3, runs: [[BOUNDS.x0, pl0], [pl1, cx0], [cx1, BOUNDS.x1]] },
    { z: CORRIDOR.z0 + 0.3, runs: [[BOUNDS.x0, gap[0]], [gap[1], cx0], [cx1, BOUNDS.x1]] },
  ];
}

/** Where the siding crosses the north fence line. */
function sidingGap() {
  const { x0, x1 } = DEPOT.curve;
  let lo = x0, hi = x1;
  const zf = CORRIDOR.z0 + 0.3;
  for (let i = 0; i < 40; i++) {
    const m = (lo + hi) / 2;
    if (sidingZ(m) < zf) lo = m; else hi = m;
  }
  return [lo - 6, lo + 6];
}

function fences(ctx) {
  const mat = fenceMat();
  for (const { z, runs } of fenceRuns()) {
    for (const [a, b] of runs) {
      const n = Math.max(1, Math.round((b - a) / PANEL));
      const w = (b - a) / n;
      for (let i = 0; i < n; i++) {
        const x = a + w * (i + 0.5);
        texBox(ctx.batch, mat, w - 0.24, FENCE_H, 0.1, x, 0, z, { tileU: w - 0.24, tileV: FENCE_H, cast: true });
      }
      for (let i = 0; i <= n; i++) ctx.batch.box(0.24, FENCE_H + 0.15, 0.24, 0x9d998f, a + w * i, -0.05, z);
      ctx.colliders.box(a, z - 0.15, b, z + 0.15, { top: FENCE_H, tag: 'fence' });
    }
  }
}

/* ---------------- telegraph line ---------------- */

function poles(batch) {
  const z = CORRIDOR.z0 + 1.4;
  const gap = sidingGap();
  const skip = (x) => Math.abs(x - BRIDGE.x) < 5 || (x > gap[0] - 2 && x < gap[1] + 2)
    || Math.abs(x - CROSSING.x) < CROSSING.outer + 2;
  let run = [];
  const flush = () => {
    if (run.length > 1) addWires(batch, run, { sag: 0.5, offsets: [-0.7, -0.25, 0.25, 0.7] });
    run = [];
  };
  for (let x = BOUNDS.x0 + 8; x < BOUNDS.x1; x += 48) {
    if (skip(x)) { flush(); continue; }
    addUtilityPole(batch, x, z, Math.PI / 2, { height: 7.5 });
    run.push([x, 7.1, z]);
  }
  flush();
}

/* ---------------- signals ---------------- */

/**
 * Where each lamp of a signal sits and which way it looks, shared by the
 * static mast (here) and the lit faces (rail system).
 * Order: yellow, green, red, top to bottom.
 */
export function signalLamps(post) {
  const face = -post.dir;                 // looks toward the trains it governs
  const x = post.x + face * 0.2;
  const yaw = face > 0 ? -Math.PI / 2 : Math.PI / 2;   // project yaw: forward = (-sin, -cos)
  return [4.95, 4.55, 4.15].map((y) => ({ x, y, z: post.z, yaw, face }));
}

function signals(ctx) {
  const b = ctx.batch;
  for (const post of SIGNAL_POSTS) {
    const { x, z } = post;
    b.box(0.6, 0.3, 0.6, 0x9d998f, x, -0.04, z);
    b.cyl(0.11, 5.6, MAST, x, 0.2, z, { seg: 8 });
    b.box(0.24, 1.35, 0.5, 0x1d1e1e, x, 3.9, z);              // target plate
    for (const l of signalLamps(post)) {
      // hood: an open tube from just in front of the plate to past the lens
      b.cyl(0.16, 0.2, 0x1a1a1a, l.x + l.face * 0.14, l.y, z, { rz: l.face > 0 ? Math.PI / 2 : -Math.PI / 2, seg: 10, open: true });
    }
    // ladder and a white number board
    for (let y = 0.5; y < 3.8; y += 0.35) b.box(0.03, 0.03, 0.4, MAST, x + post.dir * 0.2, y, z);
    b.box(0.05, 0.3, 0.4, 0xeeeee6, x - post.dir * 0.14, 3.1, z);
    ctx.colliders.circle(x, z, 0.35, { top: 5 });
  }
}

/* ---------------- the corridor floor ---------------- */

function floor(batch) {
  for (const [a, b] of [[CORRIDOR.z0, TRACK_NORTH - 2.4], [TRACK_SOUTH + 2.4, CORRIDOR.z1]]) {
    for (const [x0, z0, x1, z1] of splitRect(BOUNDS.x0, a, BOUNDS.x1, b, 60)) {
      batch.add(hQuad(x0, z0, x1, z1, -0.03, TILE.dirt), { mat: SURF.dirt, color: null, cast: false });
    }
  }
}

/**
 * Everything static along the line. The line is 920 m long and cheap per
 * metre, so it goes into one uncelled batch: a few draw calls in total
 * rather than a few per 64 m.
 */
export function buildTrack(ctx) {
  const line = new Batch({ cell: Infinity, name: 'railway' });
  const lctx = Object.create(ctx);
  lctx.batch = line;
  floor(line);
  mainLine(line);
  siding(line);
  fences(lctx);
  poles(line);
  signals(ctx);
  line.flush(ctx.root);
}

