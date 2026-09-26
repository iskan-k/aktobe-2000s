import * as THREE from 'three';
import { cel } from '../../core/toon.js';
import { PITCH, FIELD, COL } from './layout.js';
import { pitchTex, netTex, adsTex, ADS, trainingTex } from './textures.js';
import { wallQuad, atlasAdd } from './util.js';

/* ------------------------------------------------------------------ *
 * On the grass: the pitch itself, the goals with their nets, the corner
 * flags, the two dugouts in front of the main stand, and the adverts
 * round the touchline.
 * ------------------------------------------------------------------ */

export const GOAL = { half: 3.66, h: 2.44, depth: 2.0, post: 0.06 };
const PITCH_Y = 0.01;

let netMat = null;

export function buildPitch(ctx) {
  const g = new THREE.PlaneGeometry(FIELD.x1 - FIELD.x0, FIELD.z1 - FIELD.z0);
  g.rotateX(-Math.PI / 2);
  const m = new THREE.Mesh(g, cel({ map: pitchTex(), cache: false, grime: 0.05, dirt: 0, bands: 3 }));
  m.position.set((FIELD.x0 + FIELD.x1) / 2, PITCH_Y, (FIELD.z0 + FIELD.z1) / 2);
  m.receiveShadow = true;
  m.name = 'stadium-pitch';
  ctx.root.add(m);
  for (const end of [-1, 1]) goal(ctx, PITCH.x, end < 0 ? PITCH.z0 : PITCH.z1, end, GOAL);
  cornerFlags(ctx.batch);
  dugouts(ctx);
  hoardings(ctx);
}

/* ---------------- goals ---------------- */

export function netMaterial() {
  if (!netMat) netMat = cel({ map: netTex(), alphaTest: 0.4, side: THREE.DoubleSide, cache: false, grime: 0, dirt: 0 });
  return netMat;
}

/** A net panel between four corners, the mesh 12 cm. */
function netPanel(b, p0, p1, p2, p3, w, h) {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(new Float32Array([...p0, ...p1, ...p2, ...p3]), 3));
  const U = w / 0.12, V = h / 0.12;
  g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array([0, 0, U, 0, U, V, 0, V]), 2));
  g.setIndex([0, 1, 2, 0, 2, 3]);
  g.computeVertexNormals();
  b.add(g, { mat: netMaterial(), color: null, cast: false });
}

/**
 * A goal on the line z = line; `end` is -1 for the north goal (net to
 * the north) and 1 for the south one. Posts and bar are white, the net
 * hangs from a frame of thin steel stanchions behind.
 */
export function goal(ctx, x, line, end, G) {
  const b = ctx.batch;
  const back = line + end * G.depth;
  const r = G.post;
  for (const s of [-1, 1]) {
    b.cyl(r, G.h + r, COL.white, x + s * (G.half + r), 0, line, { seg: 10 });
    // the stanchions: back post, top bar out to it, a ground bar
    b.cyl(0.025, G.h * 0.8, COL.white, x + s * G.half, 0, back, { seg: 5, cast: false });
    b.tube(x + s * G.half, G.h, line, x + s * G.half, G.h * 0.8, back, 0.025, COL.white, { seg: 5, cast: false });
    b.tube(x + s * G.half, 0.02, line, x + s * G.half, 0.02, back, 0.02, COL.white, { seg: 4, cast: false });
  }
  b.tube(x - G.half - r, G.h + r, line, x + G.half + r, G.h + r, line, r, COL.white, { seg: 10 });
  b.tube(x - G.half, G.h * 0.8, back, x + G.half, G.h * 0.8, back, 0.025, COL.white, { seg: 5, cast: false });
  b.tube(x - G.half, 0.02, back, x + G.half, 0.02, back, 0.02, COL.white, { seg: 4, cast: false });
  const L = x - G.half, R = x + G.half, H = G.h, Hb = G.h * 0.8;
  netPanel(b, [L, 0, back], [R, 0, back], [R, Hb, back], [L, Hb, back], G.half * 2, Hb);
  netPanel(b, [L, H, line], [R, H, line], [R, Hb, back], [L, Hb, back], G.half * 2, G.depth);
  for (const X of [L, R]) netPanel(b, [X, 0, line], [X, 0, back], [X, Hb, back], [X, H, line], G.depth, H);
  const z0 = Math.min(line, back), z1 = Math.max(line, back);
  for (const X of [L - r, R + r]) ctx.colliders.circle(X, line, r + 0.02, { top: H, tag: 'post' });
  ctx.colliders.box(L - 0.05, z0 + (end < 0 ? 0 : 0.05), L + 0.05, z1 - (end < 0 ? 0.05 : 0), { top: H, tag: 'net' });
  ctx.colliders.box(R - 0.05, z0 + (end < 0 ? 0 : 0.05), R + 0.05, z1 - (end < 0 ? 0.05 : 0), { top: H, tag: 'net' });
  ctx.colliders.box(L, back - 0.05, R, back + 0.05, { top: H, tag: 'net' });
}

function cornerFlags(b) {
  for (const x of [PITCH.x0, PITCH.x1]) {
    for (const z of [PITCH.z0, PITCH.z1]) {
      b.cyl(0.02, 1.5, 0xf4f0e0, x, 0, z, { seg: 5, cast: false });
      const sx = x < PITCH.x ? 1 : -1;
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.BufferAttribute(new Float32Array([x, 1.5, z, x + sx * 0.42, 1.36, z, x, 1.18, z]), 3));
      g.computeVertexNormals();
      b.add(g, { color: COL.red, mat: 'solidClean', cast: false });
      const back = g.clone();
      back.index = null;
      const p = back.attributes.position.array;
      [p[3], p[6]] = [p[6], p[3]];
      [p[4], p[7]] = [p[7], p[4]];
      [p[5], p[8]] = [p[8], p[5]];
      back.computeVertexNormals();
      b.add(back, { color: COL.red, mat: 'solidClean', cast: false });
    }
  }
}

/* ---------------- dugouts ---------------- */

/**
 * Two dugouts on the west touchline, in front of the main stand: a
 * concrete back, a sloping roof, clear plastic sides, red seats inside.
 */
function dugouts(ctx) {
  const { batch: b, colliders } = ctx;
  const xBack = FIELD.x0 + 1.4, xFront = xBack + 1.7;
  for (const zc of [PITCH.z - 8, PITCH.z + 8]) {
    const len = 6.2, z0 = zc - len / 2, z1 = zc + len / 2;
    b.span(xBack - 0.15, 0, z0, xBack, 2.2, z1, COL.white);
    b.box(len + 0.2, 0.08, 2.0, COL.steelDark, xBack + 0.85, 2.1, zc, { ry: Math.PI / 2, rx: -0.12, closed: true });
    for (const z of [z0, z1]) b.span(xBack, 0, z - 0.02, xFront, 2.05, z + 0.02, 0x8fb4c4, { mat: 'glass', cast: false });
    b.span(xBack, 0, z0, xFront, 0.05, z1, 0x7a7670, { cast: false });
    for (let i = 0; i < 10; i++) {
      const z = z0 + 0.4 + i * 0.6;
      b.box(0.44, 0.06, 0.46, COL.red, xBack + 0.45, 0.42, z);
      b.box(0.06, 0.44, 0.46, COL.red, xBack + 0.2, 0.46, z, { rz: 0.1 });
      b.box(0.3, 0.42, 0.06, COL.steelDark, xBack + 0.45, 0, z, { cast: false });
    }
    colliders.box(xBack - 0.15, z0, xBack, z1, { tag: 'dugout' });
    for (const z of [z0, z1]) colliders.box(xBack, z - 0.05, xFront, z + 0.05, { tag: 'dugout' });
    colliders.box(xBack, z0, xBack + 0.7, z1, { top: 0.5, tag: 'dugout-bench' });
  }
  // the fourth official's table between them
  const tx = FIELD.x0 + 3.2;
  b.box(1.4, 0.75, 0.7, 0xe8e4da, tx, 0, PITCH.z, { ry: Math.PI / 2 });
  b.box(0.45, 0.45, 0.45, COL.red, tx - 0.8, 0, PITCH.z);
  colliders.box(tx - 0.4, PITCH.z - 0.75, tx + 0.4, PITCH.z + 0.75, { top: 0.75, tag: 'table' });
}

/* ---------------- adverts ---------------- */

/** One advert board from a to b (its face looks to the right of a -> b). */
function board(b, colliders, a, c, i) {
  const h = 0.9, y0 = 0.02;
  const v1 = 1 - i / ADS.length, v0 = 1 - (i + 1) / ADS.length;
  const g = wallQuad(a, c, y0 + 0.05, y0 + h, [0, v0 + 0.004, 1, v1 - 0.004]);
  atlasAdd(b, adsTex(), g, null);
  // the steel frame behind, leaning back on its struts
  const dx = c.x - a.x, dz = c.z - a.z, L = Math.hypot(dx, dz);
  const nx = dz / L, nz = -dx / L;   // the back of the board
  const mx = (a.x + c.x) / 2, mz = (a.z + c.z) / 2;
  b.box(L, h, 0.06, 0x3a3c3e, mx + nx * 0.035, y0, mz + nz * 0.035, { ry: Math.atan2(-dz, dx) });
  for (const t of [0.1, 0.9]) {
    const px = a.x + dx * t + nx * 0.06, pz = a.z + dz * t + nz * 0.06;
    b.tube(px, h - 0.05, pz, px + nx * 0.7, 0, pz + nz * 0.7, 0.025, 0x3a3c3e, { seg: 4, cast: false });
  }
  colliders.box(Math.min(a.x, c.x) - 0.05 + Math.min(0, nx * 0.7), Math.min(a.z, c.z) - 0.05 + Math.min(0, nz * 0.7),
    Math.max(a.x, c.x) + 0.05 + Math.max(0, nx * 0.7), Math.max(a.z, c.z) + 0.05 + Math.max(0, nz * 0.7), { top: 0.95, tag: 'advert' });
}

function hoardings(ctx) {
  const { batch: b, colliders } = ctx;
  const seg = 6.4, gap = 1.2;
  let i = 0;
  // east touchline, facing west
  const xe = PITCH.x1 + 3.2;
  for (let z = PITCH.z0 + 3; z + seg <= PITCH.z1 - 3; z += seg + gap) {
    board(b, colliders, { x: xe, z }, { x: xe, z: z + seg }, i++ % ADS.length);
  }
  // behind the goals, clear of the nets, facing the pitch
  for (const end of [-1, 1]) {
    const zb = end < 0 ? PITCH.z0 - 4.6 : PITCH.z1 + 4.6;
    for (const x0 of [PITCH.x0 + 4, PITCH.x0 + 4 + seg + gap, PITCH.x + 6, PITCH.x + 6 + seg + gap]) {
      const a = { x: x0, z: zb }, c = { x: x0 + seg, z: zb };
      if (end < 0) board(b, colliders, a, c, i++ % ADS.length);
      else board(b, colliders, c, a, i++ % ADS.length);
    }
  }
  // west touchline, either side of the dugouts
  const xw = PITCH.x0 - 2.6;
  for (const [z0, z1] of [[PITCH.z0 + 3, PITCH.z - 13], [PITCH.z + 13, PITCH.z1 - 3]]) {
    for (let z = z0; z + seg <= z1; z += seg + gap) {
      board(b, colliders, { x: xw, z: z + seg }, { x: xw, z }, i++ % ADS.length);
    }
  }
}

/* ---------------- the training pitch ---------------- */

export function buildTrainingPitch(ctx, T) {
  const g = new THREE.PlaneGeometry(T.w, T.l);
  g.rotateX(-Math.PI / 2);
  const m = new THREE.Mesh(g, cel({ map: trainingTex(T.w, T.l), cache: false, grime: 0.06, dirt: 0, bands: 3 }));
  m.position.set(T.x, 0.005, T.z);
  m.receiveShadow = true;
  ctx.root.add(m);
  const small = { half: 2.5, h: 2.0, depth: 1.2, post: 0.05 };
  goal(ctx, T.x, T.z - T.l / 2 + 1.5, -1, small);
  goal(ctx, T.x, T.z + T.l / 2 - 1.5, 1, small);
}
