import * as THREE from 'three';
import { cel } from '../core/toon.js';
import { canvasTex, cached, weather } from '../core/textures.js';
import { rngKit } from '../core/util.js';
import { SURF, TILE, hQuad, splitRect } from '../core/surfaces.js';
import { BOUNDS, RAIL } from '../world/plan.js';
import { texBox } from '../world/buildings/landmarks.js';
import { bakeType } from './rolling.js';
import { buildEr } from './steamEngine.js';
import { DEPOT, RAIL_Y, CROSSING, BRIDGE } from './layout.js';

/* ------------------------------------------------------------------ *
 * North of the rails: the locomotive depot shed with a pair of 2TE10
 * sections stabled outside, the Er 791-57 steam engine on its plinth
 * (placed 2004), the brick water tower, two goods warehouses with their
 * loading ramp, and the heating main on its low supports along the back.
 * ------------------------------------------------------------------ */

const B = { x0: BOUNDS.x0, x1: BOUNDS.x1, z0: BOUNDS.z0, z1: RAIL.corridor[0] };
export const ER = { x: 56, z: -189.2, len: 21 };
export const WATER_TOWER = { x: 86, z: -189.5 };
const WAREHOUSES = [{ x0: 126, x1: 172 }, { x0: 178, x1: 226 }];
const WH = { z0: -195, z1: -186, h: 6.2 };
const BRICK = 0x9a4e3c;
const SILICATE = 0xd8d2c4;

/* ---------------- textures ---------------- */

/** Brick wall with a tall steel-framed window per 4 m bay. */
function shedTex() {
  return cached('depot|shed', () => canvasTex(256, 512, (c, W, H) => {
    const r = rngKit(101);
    c.fillStyle = '#9a4e3c';
    c.fillRect(0, 0, W, H);
    for (let y = 0; y < H; y += 8) {
      const off = (y / 8) % 2 ? 12 : 0;
      for (let x = -24; x < W + 24; x += 24) {
        c.fillStyle = r.pick(['#9a4e3c', '#8f4636', '#a45642', '#8a4232']);
        c.fillRect(x + off + 1, y + 1, 22, 6);
      }
    }
    // pilasters at the bay edges
    c.fillStyle = '#8a4232';
    c.fillRect(0, 0, 18, H);
    c.fillRect(W - 18, 0, 18, H);
    // the window: steel glazing bars over dusty glass
    const x0 = 56, x1 = W - 56, y0 = 90, y1 = H - 110;
    c.fillStyle = '#d8d2c4';
    c.fillRect(x0 - 8, y0 - 8, x1 - x0 + 16, y1 - y0 + 16);
    const g = c.createLinearGradient(0, y0, 0, y1);
    g.addColorStop(0, '#8fa4ad');
    g.addColorStop(1, '#4f5f66');
    c.fillStyle = g;
    c.fillRect(x0, y0, x1 - x0, y1 - y0);
    c.fillStyle = '#39403f';
    for (let i = 1; i < 4; i++) c.fillRect(x0 + ((x1 - x0) * i) / 4 - 2, y0, 4, y1 - y0);
    for (let j = 1; j < 8; j++) c.fillRect(x0, y0 + ((y1 - y0) * j) / 8 - 2, x1 - x0, 4);
    // a few panes painted over or broken
    for (let k = 0; k < 5; k++) {
      c.fillStyle = r.pick(['#6d7d80', '#2e3638', '#9a8f76']);
      const i = r.int(0, 3), j = r.int(0, 7);
      c.fillRect(x0 + ((x1 - x0) * i) / 4 + 2, y0 + ((y1 - y0) * j) / 8 + 2, (x1 - x0) / 4 - 4, (y1 - y0) / 8 - 4);
    }
    weather(c, W, H, 102, 1.2);
  }, { repeat: [1, 1] }));
}

/** Silicate brick with a painted plinth, for the warehouses. */
function warehouseTex() {
  return cached('depot|warehouse', () => canvasTex(256, 256, (c, W, H) => {
    const r = rngKit(103);
    c.fillStyle = '#d8d2c4';
    c.fillRect(0, 0, W, H);
    for (let y = 0; y < H; y += 8) {
      const off = (y / 8) % 2 ? 12 : 0;
      for (let x = -24; x < W + 24; x += 24) {
        c.fillStyle = r.pick(['#d8d2c4', '#cfc8b8', '#ddd8cb']);
        c.fillRect(x + off + 1, y + 1, 22, 6);
      }
    }
    c.fillStyle = '#b8b09e';
    c.fillRect(0, H - 44, W, 44);
    // a small high window
    c.fillStyle = '#4f5b60';
    c.fillRect(W / 2 - 30, 40, 60, 34);
    c.fillStyle = '#e8e4da';
    c.fillRect(W / 2 - 2, 40, 4, 34);
    weather(c, W, H, 104, 1.4);
  }, { repeat: [1, 1] }));
}

/* ---------------- depot ---------------- */

function shed(ctx) {
  const b = ctx.batch;
  const { x0, x1, z0, z1 } = DEPOT.shed;
  const h = 9;
  const mat = cached('depot|shed-mat', () => cel({ map: shedTex(), grime: 0.07, dirt: 0.5, cache: false }));
  const xc = (x0 + x1) / 2, zc = (z0 + z1) / 2, d = z1 - z0;
  texBox(b, mat, x1 - x0, h, d, xc, 0, zc, { tileU: 5, tileV: h });
  // gable roof in corrugated asbestos sheet, a clerestory along the ridge
  for (const s of [-1, 1]) {
    b.box(x1 - x0 + 0.6, 0.18, d / 2 + 0.5, 0x8e8d86, xc, h + 0.9, zc + s * (d / 4 + 0.1), { rx: s * 0.2 });
  }
  b.box(x1 - x0 - 4, 1.0, 2.2, 0x9a4e3c, xc, h + 1.5, zc);
  b.box(x1 - x0 - 4, 0.6, 2.25, 0x56666b, xc, h + 1.7, zc, { mat: 'glass' });
  b.box(x1 - x0 - 3.6, 0.15, 2.8, 0x7e7d77, xc, h + 2.5, zc);
  // east end: the gate opening, dark inside, doors swung open
  b.box(0.2, 7.2, 5.4, 0x1c1b1a, x1 + 0.02, 0, DEPOT.z, { mat: 'glass' });
  for (const s of [-1, 1]) b.box(2.7, 6.8, 0.15, 0x3e6b5a, x1 + 1.3, 0.1, DEPOT.z + s * 2.85, { ry: s * 0.15 });
  b.box(0.3, 0.8, 6.4, 0x8a4232, x1 + 0.1, 7.2, DEPOT.z);
  // a smoke vent and a stove pipe
  b.cyl(0.35, 2.8, 0x4a4d50, x0 + 8, h + 1.2, zc - 3, { seg: 8 });
  ctx.colliders.box(x0, z0, x1, z1, { top: h + 2, tag: 'depot' });
}

/** A baked car added to the static batch. */
function stabled(batch, type, x, z, yaw) {
  const car = bakeType(type);
  const m = new THREE.Matrix4().makeRotationY(yaw).setPosition(x, RAIL_Y, z);
  for (const p of car.parts) batch.add(p.geometry, { mat: p.material, color: null, matrix: m });
  return car.length;
}

function stabledPair(ctx) {
  const len = bakeType('loco_green').length;
  const xA = DEPOT.shed.x1 + 2 + len / 2;
  // section A's cab faces the main line (east), B is coupled back to back
  stabled(ctx.batch, 'loco_green', xA + len, DEPOT.z, -Math.PI / 2);
  stabled(ctx.batch, 'loco_green', xA, DEPOT.z, Math.PI / 2);
  ctx.colliders.box(xA - len / 2, DEPOT.z - 1.7, xA + len * 1.5, DEPOT.z + 1.7, { top: 4.8, tag: 'loco' });
}

/* ---------------- Er 791-57 ---------------- */

function steamEngine(ctx) {
  const b = ctx.batch;
  const { x, z } = ER;
  // plinth: a concrete bed with a short length of track on it
  b.box(ER.len + 2, 0.7, 4, 0xa8a397, x, -0.04, z);
  b.box(ER.len + 2.2, 0.08, 4.2, 0x8f8b82, x, 0.62, z);
  for (let i = 0; i < 34; i++) b.box(0.25, 0.1, 2.6, 0x6b5238, x - ER.len / 2 + 0.3 + i * 0.62, 0.7, z);
  for (const s of [-1, 1]) b.box(ER.len + 1.6, 0.14, 0.07, 0x5d4c40, x, 0.8, z + s * 0.76);
  const { x0, x1 } = buildEr(b, x, z, 0.94);
  // the plaque on its stand, beside the steps
  b.box(0.2, 1.1, 0.2, 0x4a4d50, x - 3, 0, z + 2.8);
  b.box(1.2, 0.7, 0.08, 0x8a7a4a, x - 3, 1.0, z + 2.84, { rx: -0.3 });
  ctx.colliders.box(x0, z - 2, x1, z + 2, { top: 5.2, tag: 'monument' });
  return { plaque: { x: x - 3, z: z + 2.9 } };
}

/* ---------------- water tower, warehouses, pipes ---------------- */

function waterTower(ctx) {
  const b = ctx.batch;
  const { x, z } = WATER_TOWER;
  b.cyl(3.1, 11, BRICK, x, 0, z, { seg: 20, rTop: 2.8 });
  b.cyl(3.3, 0.6, 0x8a4232, x, 0, z, { seg: 20 });
  for (let i = 0; i < 4; i++) {
    const a = (i * Math.PI) / 2 + 0.4;
    b.box(0.7, 1.4, 0.1, 0x3d4648, x + Math.cos(a) * 2.95, 3 + i * 1.8, z + Math.sin(a) * 2.95, { ry: -a + Math.PI / 2, mat: 'glass' });
  }
  b.cyl(3.0, 0.5, SILICATE, x, 11, z, { seg: 20, rTop: 4.1 });
  b.cyl(4.1, 4.2, 0xcfc7b6, x, 11.5, z, { seg: 20 });
  for (let i = 0; i < 20; i++) {
    const a = (i * Math.PI) / 10;
    b.box(0.12, 4.2, 0.15, 0xbdb4a2, x + Math.cos(a) * 4.12, 11.5, z + Math.sin(a) * 4.12, { ry: -a });
  }
  b.cyl(4.4, 1.6, 0x7e7d77, x, 15.7, z, { seg: 20, rTop: 0.3 });
  b.box(0.9, 2.1, 0.1, 0x4a3a2a, x, 0, z + 3.05);
  ctx.colliders.circle(x, z, 3.2, { top: 11 });
}

function warehouses(ctx) {
  const b = ctx.batch;
  const mat = cached('depot|warehouse-mat', () => cel({ map: warehouseTex(), grime: 0.08, dirt: 0.5, cache: false }));
  for (const { x0, x1 } of WAREHOUSES) {
    const xc = (x0 + x1) / 2, zc = (WH.z0 + WH.z1) / 2, d = WH.z1 - WH.z0;
    texBox(b, mat, x1 - x0, WH.h, d, xc, 0, zc, { tileU: 4, tileV: WH.h });
    for (const s of [-1, 1]) b.box(x1 - x0 + 0.8, 0.12, d / 2 + 0.6, 0x9c9990, xc, WH.h + 0.85, zc + s * (d / 4 + 0.15), { rx: s * 0.3 });
    // loading ramp with a canopy, gates along it
    b.span(x0, 0, WH.z1, x1, 1.2, WH.z1 + 2.6, 0xa8a397);
    b.span(x0 + 0.2, 1.2, WH.z1, x1 - 0.2, 1.24, WH.z1 + 2.5, 0x8f8b82, { cast: false });
    b.box(x1 - x0, 0.12, 3.2, 0x8d9aa0, xc, 4.6, WH.z1 + 1.5, { rx: -0.06, closed: true });
    for (let gx = x0 + 5; gx < x1 - 3; gx += 9) {
      b.box(3.2, 3.0, 0.08, 0x6b5238, gx, 1.2, WH.z1 + 0.03);
      b.box(3.4, 0.12, 0.12, 0x4a4d50, gx, 4.2, WH.z1 + 0.05);
    }
    ctx.colliders.box(x0, WH.z0, x1, WH.z1, { top: WH.h, tag: 'warehouse' });
    ctx.colliders.box(x0, WH.z1, x1, WH.z1 + 2.6, { top: 1.2, tag: 'ramp' });
    ctx.ground.flat(x0, WH.z1, x1, WH.z1 + 2.6, 1.2, 'ramp');
  }
}

function heatingMain(ctx) {
  const b = ctx.batch;
  const z = B.z0 + 0.8;
  // the main climbs over the foot of the footbridge stairs in a goalpost hump
  const hump = [BRIDGE.x - 4, BRIDGE.x + 4];
  const runs = [[DEPOT.shed.x1 + 6, hump[0]], [hump[1], WATER_TOWER.x + 8], [WAREHOUSES[0].x0 - 2, B.x1 - 2]];
  for (const dz of [-0.35, 0.35]) {
    const [a, c] = hump;
    b.tube(a, 1.3, z + dz, a, 4.4, z + dz, 0.26, 0xa7aaa6, { seg: 8, open: false });
    b.tube(c, 1.3, z + dz, c, 4.4, z + dz, 0.26, 0xa7aaa6, { seg: 8, open: false });
    b.tube(a, 4.4, z + dz, c, 4.4, z + dz, 0.26, 0xa7aaa6, { seg: 8, open: false });
  }
  for (const x of hump) b.box(0.3, 4.2, 1.4, 0x8f8b82, x, 0, z);
  for (const [a, c] of runs) {
    for (const dz of [-0.35, 0.35]) {
      b.tube(a, 1.3, z + dz, c, 1.3, z + dz, 0.26, 0xa7aaa6, { seg: 8, open: false });
    }
    for (let x = a; x <= c; x += 6) {
      b.box(0.2, 1.0, 1.4, 0x8f8b82, x, 0, z);
      b.box(0.4, 0.1, 1.6, 0x4a4d50, x, 1.0, z);
    }
    // the ends dive into concrete chambers
    for (const x of [a, c]) b.box(1.8, 1.8, 2.0, 0x9d998f, x, -0.04, z);
    ctx.colliders.box(a - 0.9, z - 1, c + 0.9, z + 1, { top: 1.6, tag: 'pipes' });
  }
  // a rusted patch every so often
  const r = rngKit(105);
  for (let i = 0; i < 14; i++) {
    const [a, c] = runs[i % runs.length];
    const x = r.range(a + 2, c - 2);
    b.cyl(0.27, r.range(0.8, 2.4), 0x8a5a3c, x, 1.3, z + (i % 2 ? 0.35 : -0.35), { rz: Math.PI / 2, seg: 8 });
  }
}

function ground(ctx) {
  const skip = [CROSSING.x - CROSSING.outer, CROSSING.x + CROSSING.outer];
  for (const [xa, xb] of [[B.x0, skip[0]], [skip[1], B.x1]]) {
    for (const [x0, z0, x1, z1] of splitRect(xa, B.z0, xb, B.z1, 60)) {
      ctx.batch.add(hQuad(x0, z0, x1, z1, -0.03, TILE.yard), { mat: SURF.yard, color: null, cast: false });
    }
  }
}

/** Everything north of the line. Returns interactable spots. */
export function buildDepot(ctx) {
  ground(ctx);
  shed(ctx);
  stabledPair(ctx);
  const er = steamEngine(ctx);
  waterTower(ctx);
  warehouses(ctx);
  heatingMain(ctx);
  return { erPlaque: er.plaque, bridgeX: BRIDGE.x };
}
