import * as THREE from 'three';
import { Batch } from '../core/batch.js';
import { bogie, coupler, ladder, handrail, zCyl, xCyl, DARK, STEEL } from './stockParts.js';
import { gondola, tank, hopper, boxcar } from './freight.js';
import { sideDecal, decalMaterial, WIDE } from './decals.js';

/* ------------------------------------------------------------------ *
 * Rolling stock, built once per type and drawn instanced.
 *
 *   loco_green  2TE10M section, Soviet dark green with a red band and
 *               thin yellow lines (Aktobe depot, January 2007)
 *   loco_blue   2TE10M in the new KTZ scheme: light blue body, red
 *               front, yellow chevron, blue skirt
 *   coach_grey  Soviet all-metal passenger coach, blue-grey, pale stripe
 *   coach_green the same in dark green with a yellow stripe
 *   gondola, tank, hopper, boxcar   freight, see freight.js
 *
 * Every type is authored with its front toward local -z, origin at the
 * top of the rail in the middle of the car, and returns { b, length }
 * where length is over the couplers. `bakeType` merges the parts into
 * geometries by material. Route boards, coach numbers and loco number
 * plates use the decal atlas (decals.js), picked per instance.
 * ------------------------------------------------------------------ */

// Batches here use cell: Infinity so every part lands in one cell (with a
// finite cell, parts either side of the origin would split into two).
const ROOF_GREY = 0x75786f;
const FRAME = 0xb4b7b2;         // window frames, light alloy
const GLASS = 0x2e3a42;
const RUBBER = 0x1c1c1b;

/** Ribbed rubber gangway bellows at an end face. */
function bellows(b, zFace, sign, w = 1.5, h = 2.3, y = 1.3, depth = 0.45) {
  const n = 6;
  for (let i = 0; i < n; i++) {
    const t = (i + 0.5) / n;
    const grow = i % 2 ? 0.08 : 0;
    b.box(w + grow, h + grow, depth / n * 0.9, RUBBER, 0, y - grow / 2, zFace + sign * t * depth);
  }
  b.box(w - 0.2, h - 0.2, 0.06, 0x2a2a28, 0, y + 0.1, zFace + sign * depth);
}

/** A curved roof: a half ellipse extruded along the car. */
function curvedRoof(b, W, rise, L, y, color) {
  const sh = new THREE.Shape();
  sh.moveTo(-W / 2, 0);
  sh.absellipse(0, 0, W / 2, rise, Math.PI, 0, true);
  sh.lineTo(-W / 2, 0);
  const g = new THREE.ExtrudeGeometry(sh, { depth: L, bevelEnabled: false, curveSegments: 10 });
  g.translate(0, y, -L / 2);
  b.add(g, { color });
}

/* ---------------- locomotive section ---------------- */

function locoCab(b, { W, y0, y1, zF, body, blue }) {
  const band = 0xc0302a, yellow = 0xe2b33a;
  const noseZ = zF + 0.6;
  // lower nose, then the upper cab front raked back over it
  const RAKE = 0.2, hUp = y1 - y0 - 1.3, zUp = zF + 0.1;
  const onRake = (h) => zUp + h * Math.tan(RAKE);
  b.box(W - 0.06, 1.3, 1.2, body, 0, y0, noseZ);
  b.box(W - 0.3, hUp, 1.4, body, 0, y0 + 1.3, zUp + 0.7, { rx: RAKE });
  b.box(W - 0.4, 0.26, 1.4, ROOF_GREY, 0, y1, noseZ + 0.35);
  if (!blue) {
    b.box(W + 0.02, 0.36, 1.25, band, 0, 2.72, noseZ);
    b.box(W - 0.02, 0.38, 0.06, band, 0, 2.7, zF - 0.02);
  } else {
    b.box(W - 0.02, 1.35, 0.06, band, 0, y0, zF - 0.02);
    for (const s of [-1, 1]) b.box(1.8, 0.2, 0.07, yellow, s * 0.8, 2.95, zF - 0.04, { rz: s * 0.28 });
  }
  // two windscreens in rubber-sealed frames on the raked face, wipers
  const hb = 0.55, yb = y0 + 1.3 + hb;
  for (const s of [-1, 1]) {
    b.box(1.34, 0.94, 0.05, FRAME, s * 0.74, yb - 0.07, onRake(hb - 0.07) - 0.02, { rx: RAKE });
    b.box(1.2, 0.8, 0.05, GLASS, s * 0.74, yb, onRake(hb) - 0.05, { rx: RAKE, mat: 'glass' });
    b.box(0.04, 0.55, 0.03, 0x1a1a1a, s * 0.74 - 0.25, yb + 0.05, onRake(hb) - 0.09, { rx: RAKE, rz: s * 0.5 });
  }
  // sun visor over the screens
  b.box(W - 0.5, 0.05, 0.3, body, 0, yb + 0.95, onRake(hb + 0.95) - 0.12);
  // cab side windows and doors with their handrails and steps
  for (const s of [-1, 1]) {
    const x = s * (W / 2 + 0.01);
    b.box(0.07, 0.82, 1.02, FRAME, x, 3.44, zF + 1.5);
    b.box(0.08, 0.7, 0.9, GLASS, s * (W / 2 + 0.015), 3.5, zF + 1.5, { mat: 'glass' });
    b.box(0.06, 1.95, 0.8, blue ? 0x4d97cc : 0x2a6135, x, y0 + 0.3, zF + 2.35);
    b.box(0.07, 0.45, 0.4, GLASS, s * (W / 2 + 0.02), 3.3, zF + 2.35, { mat: 'glass' });
    handrail(b, s * (W / 2 + 0.07), 1.3, zF + 1.88, s * (W / 2 + 0.07), 3.3, zF + 1.88);
    handrail(b, s * (W / 2 + 0.07), 1.3, zF + 2.82, s * (W / 2 + 0.07), 3.3, zF + 2.82);
    for (const y of [0.55, 0.95]) b.box(0.45, 0.05, 0.6, DARK, s * (W / 2 - 0.12), y, zF + 2.35);
    b.box(0.05, 0.9, 0.05, DARK, s * (W / 2 + 0.1), 0.5, zF + 2.05);
    b.box(0.05, 0.9, 0.05, DARK, s * (W / 2 + 0.1), 0.5, zF + 2.65);
    // number plate under the side window
    sideDecal(b, s, 1.5, 0.125, s * (W / 2 + 0.03), 2.95, zF + 1.5, 'wide', WIDE.loco0);
  }
  // roof headlight in its hood, marker lamps, pilot below the beam
  b.cyl(0.26, 0.3, body, 0, y1 - 0.02, zF + 0.3, { rx: Math.PI / 2, seg: 12 });
  b.cyl(0.2, 0.25, 0xfff6d8, 0, y1 - 0.02, zF + 0.27, { rx: Math.PI / 2, seg: 10, mat: 'glow' });
  for (const s of [-1, 1]) {
    b.cyl(0.13, 0.1, 0x1c1c1c, s * 1.1, 2.1, zF - 0.02, { rx: Math.PI / 2, seg: 8 });
    b.cyl(0.1, 0.1, 0xfff0c8, s * 1.1, 2.1, zF - 0.05, { rx: Math.PI / 2, seg: 8, mat: 'glow' });
    b.box(1.4, 0.55, 0.08, 0x2f2f2d, s * 0.62, 0.18, zF - 0.45, { ry: s * 0.45 });
  }
}

function locoSection(livery) {
  const b = new Batch({ cell: Infinity });
  const L = 16.2, W = 3.36, y0 = 1.62, y1 = 4.75;
  const blue = livery === 'blue';
  const body = blue ? 0x56a6da : 0x2f6b3a;
  const band = 0xc0302a, yellow = 0xe2b33a;
  const zF = -L / 2, zR = L / 2;

  // main frame, fuel tank with its straps, air reservoirs, bogies
  b.box(W - 0.2, 0.42, L, DARK, 0, y0 - 0.42, 0);
  b.box(W + 0.04, 0.1, L - 0.4, blue ? 0x2a5f9a : 0x21252a, 0, y0 - 0.1, 0);
  b.box(2.7, 0.62, 5.6, 0x3a3935, 0, 0.58, 0);
  for (const z of [-2, 0, 2]) b.box(2.76, 0.66, 0.08, 0x2c2b28, 0, 0.56, z);
  for (const s of [-1, 1]) {
    b.cyl(0.1, 0.25, 0x2c2b28, s * 1.1, 1.2, 1.6, { seg: 8 });
    zCyl(b, 0.24, -2.5, 2.5, s * 1.5, 0.98, STEEL, 10);
  }
  bogie(b, -5.1, 'loco');
  bogie(b, 5.1, 'loco');
  coupler(b, zF - 0.285, -1, { y: 1.06, beam: blue ? band : DARK, beamW: W - 0.1 });
  coupler(b, zR + 0.285, 1, { y: 1.06, beam: DARK, beamW: W - 0.1 });

  // body sides and roof
  b.box(W, y1 - y0, L - 1.2, body, 0, y0, 0.6);
  b.box(W - 0.35, 0.28, L - 0.6, ROOF_GREY, 0, y1, 0.3);
  if (blue) b.box(W + 0.02, 0.5, L, 0x2a5f9a, 0, y0, 0);
  if (!blue) {
    b.box(W + 0.03, 0.36, L - 0.2, band, 0, 2.72, 0);
    b.box(W + 0.035, 0.07, L - 0.2, yellow, 0, 3.12, 0);
    b.box(W + 0.035, 0.07, L - 0.2, yellow, 0, 2.6, 0);
  } else {
    b.box(W + 0.03, 0.12, L - 0.2, 0xf1efe6, 0, 3.05, 0);
  }
  locoCab(b, { W, y0, y1, zF, body, blue });

  // engine room: framed windows above, louvred doors below
  for (let i = 0; i < 6; i++) {
    const z = zF + 3.6 + i * 2.0;
    for (const s of [-1, 1]) {
      b.box(0.05, 0.66, 1.3, FRAME, s * (W / 2 + 0.005), 3.5, z);
      b.box(0.06, 0.55, 1.2, 0x223028, s * (W / 2 + 0.01), 3.55, z, { mat: 'glass' });
      b.box(0.05, 0.9, 1.4, blue ? 0x4a8fc0 : 0x255a31, s * (W / 2 + 0.015), 1.75, z);
      for (let k = 0; k < 5; k++) b.box(0.04, 0.04, 1.3, blue ? 0x3d7aa8 : 0x1f4b29, s * (W / 2 + 0.035), 1.85 + k * 0.16, z);
    }
  }
  // roof: radiator fans under grilles, the exhaust, horns, hatch seams
  for (let i = 0; i < 4; i++) {
    const fx = i % 2 ? -0.75 : 0.75, fz = zR - 1.4 - Math.floor(i / 2) * 1.5;
    b.cyl(0.62, 0.18, 0x5c5f58, fx, y1 + 0.2, fz, { seg: 16 });
    b.cyl(0.54, 0.2, 0x2a2c29, fx, y1 + 0.22, fz, { seg: 16 });
    for (let k = -2; k <= 2; k++) b.box(1.1, 0.03, 0.05, 0x6a6d66, fx, y1 + 0.42, fz + k * 0.2);
  }
  b.box(W - 0.6, 0.12, 1.6, 0x5a5d56, 0, y1 + 0.2, zR - 5.2);
  for (let k = 0; k < 7; k++) b.box(W - 0.7, 0.03, 0.06, 0x3c3e3a, 0, y1 + 0.32, zR - 5.9 + k * 0.23);
  b.cyl(0.22, 0.45, DARK, 0, y1 + 0.2, 0.5, { seg: 8 });
  b.cyl(0.26, 0.06, 0x1a1a1a, 0, y1 + 0.62, 0.5, { seg: 8 });
  for (const s of [-1, 1]) b.cyl(0.07, 0.4, 0xb9b6ab, s * 0.4, y1 + 0.25, zF + 1.4, { rx: Math.PI / 2, seg: 6 });
  for (let k = 1; k < 5; k++) b.box(W - 0.4, 0.02, 0.04, 0x60635c, 0, y1 + 0.28, zF + 2 + k * 2.4);
  // rear end: gangway door and bellows (the sections couple back to back)
  b.box(W - 0.2, 2.6, 0.08, blue ? 0x4a8fc0 : 0x285c33, 0, y0 + 0.2, zR - 0.02);
  b.box(0.8, 1.9, 0.06, 0x3a3a38, 0, y0 + 0.3, zR + 0.02);
  bellows(b, zR, 1, 1.3, 2.1, y0 + 0.2, 0.27);
  ladder(b, 1.2, zR + 0.06, y0 + 0.2, y1, { along: 'x' });
  return { b, length: 16.97 };
}

/* ---------------- passenger coach ---------------- */

function coachUnderframe(b, L, W, y0) {
  b.box(W - 0.3, 0.35, L - 0.4, DARK, 0, y0 - 0.35, 0);
  b.box(0.5, 0.2, L - 1, 0x232322, 0, y0 - 0.55, 0);
  // battery boxes on one side, the axle-driven generator on the other
  b.box(0.8, 0.5, 3.4, 0x33332f, 0.95, y0 - 0.85, -0.6);
  for (const dz of [-1.2, 0, 1.2]) b.box(0.84, 0.05, 0.06, 0x252523, 0.95, y0 - 0.6, -0.6 + dz);
  b.box(0.7, 0.55, 1.0, 0x3a3935, -0.9, y0 - 0.9, 6.2);
  b.tube(-0.9, y0 - 0.65, 6.7, -0.6, 0.47, 7.9, 0.05, DARK, { seg: 5 });
  // water tank across, reservoirs and brake cylinder, the brake pipe
  xCyl(b, 0.38, -1.05, 1.05, y0 - 0.72, 3.3, 0x3a3935, 12);
  zCyl(b, 0.22, -5.8, -4.2, -0.95, y0 - 0.62, STEEL, 10);
  zCyl(b, 0.2, -3.8, -2.6, -0.95, y0 - 0.62, STEEL, 10);
  zCyl(b, 0.19, 1.2, 1.8, -0.35, y0 - 0.6, DARK, 10);
  b.box(0.05, 0.05, L - 0.6, 0x1a1a1a, 0.35, y0 - 0.5, 0);
  for (const dz of [-3, 0.6]) b.box(0.08, 0.05, 2.4, 0x444340, -0.35, y0 - 0.55, dz);
}

function coachWindows(b, L, W, green) {
  for (let i = 0; i < 10; i++) {
    const z = -L / 2 + 3.0 + i * 1.95;
    for (const s of [-1, 1]) {
      const x = s * (W / 2 + 0.005);
      b.box(0.05, 0.96, 1.3, FRAME, x, 2.47, z);
      b.box(0.06, 0.8, 1.15, GLASS, s * (W / 2 + 0.01), 2.55, z, { mat: 'glass' });
      // the drop light: a transom bar a third of the way down
      b.box(0.07, 0.05, 1.15, FRAME, s * (W / 2 + 0.015), 3.07, z);
      // white curtains drawn to the sides, a tie-back at the bottom
      for (const e of [-1, 1]) b.box(0.07, 0.78, 0.22, 0xeeeee8, s * (W / 2 + 0.018), 2.56, z + e * 0.44);
      b.box(0.075, 0.05, 1.15, green ? 0x8a3a30 : 0x6a3a58, s * (W / 2 + 0.02), 3.28, z);
    }
  }
}

function coachEnds(b, L, W, y0, green) {
  const door = green ? 0x34523d : 0x5f798f;
  for (const e of [-1, 1]) {
    const zd = e * (L / 2 - 1.0);
    for (const s of [-1, 1]) {
      const x = s * (W / 2 + 0.01);
      b.box(0.07, 2.05, 0.9, door, x, 1.4, zd);
      b.box(0.08, 2.1, 0.04, 0x222222, x, 1.37, zd - 0.46);
      b.box(0.08, 2.1, 0.04, 0x222222, x, 1.37, zd + 0.46);
      b.box(0.06, 0.55, 0.5, GLASS, s * (W / 2 + 0.02), 2.7, zd, { mat: 'glass' });
      handrail(b, s * (W / 2 + 0.08), 0.9, zd - 0.56, s * (W / 2 + 0.08), 2.9, zd - 0.56);
      handrail(b, s * (W / 2 + 0.08), 0.9, zd + 0.56, s * (W / 2 + 0.08), 2.9, zd + 0.56);
      // fold-down steps in their frame under the door
      b.box(0.06, 0.85, 0.06, DARK, s * (W / 2 - 0.05), 0.45, zd - 0.42);
      b.box(0.06, 0.85, 0.06, DARK, s * (W / 2 - 0.05), 0.45, zd + 0.42);
      for (const y of [0.5, 0.88]) b.box(0.32, 0.05, 0.84, 0x484844, s * (W / 2 - 0.14), y, zd);
    }
    // end wall, the gangway door and its bellows
    b.box(1.0, 1.95, 0.06, 0x3a3a38, 0, y0 + 0.15, e * (L / 2 + 0.02));
    bellows(b, e * L / 2, e, 1.6, 2.35, y0 + 0.05, 0.42);
  }
}

function coach(livery) {
  const b = new Batch({ cell: Infinity });
  const L = 23.6, W = 3.1, y0 = 1.25, y1 = 3.78;
  const green = livery === 'green';
  const body = green ? 0x3d5e46 : 0x6f8aa0;
  const stripe = green ? 0xd9c060 : 0xdcdfd8;
  coachUnderframe(b, L, W, y0);
  bogie(b, -8.6, 'coach');
  bogie(b, 8.6, 'coach');
  coupler(b, -L / 2 - 0.45, -1, { y: 1.06, beam: DARK, beamW: 2.4 });
  coupler(b, L / 2 + 0.45, 1, { y: 1.06, beam: DARK, beamW: 2.4 });

  // body, the dark skirt line along its foot, the pale stripe
  b.box(W, y1 - y0, L, body, 0, y0, 0);
  b.box(W + 0.02, 0.1, L - 0.1, 0x262a2c, 0, y0, 0);
  b.box(W + 0.02, 0.18, L - 0.3, stripe, 0, 2.2, 0);
  // curved roof with gutters, the row of vents and the stove chimney
  curvedRoof(b, W - 0.04, 0.5, L - 0.1, y1, 0x6c6e69);
  for (const s of [-1, 1]) b.box(0.06, 0.06, L - 0.2, 0x55574f, s * (W / 2 - 0.02), y1 - 0.02, 0);
  for (let i = 0; i < 8; i++) {
    const z = -8.4 + i * 2.4;
    b.cyl(0.13, 0.22, 0x5c5e59, 0, y1 + 0.42, z, { seg: 8 });
    b.cyl(0.24, 0.1, 0x55574f, 0, y1 + 0.62, z, { seg: 10, rTop: 0.14 });
  }
  b.cyl(0.1, 0.55, 0x2b2b2a, 0.55, y1 + 0.3, -L / 2 + 1.4, { seg: 8 });
  b.cyl(0.18, 0.08, 0x2b2b2a, 0.55, y1 + 0.85, -L / 2 + 1.4, { seg: 8 });
  coachWindows(b, L, W, green);
  coachEnds(b, L, W, y0, green);
  // route board at mid length on its bracket, the coach number by the door
  for (const s of [-1, 1]) {
    b.box(0.03, 0.31, 3.3, 0x2b2b2a, s * (W / 2 + 0.02), 1.8, 0);
    sideDecal(b, s, 3.2, 0.27, s * (W / 2 + 0.04), 1.955, 0, 'wide', WIDE.service0);
    sideDecal(b, s, 0.5, 0.13, s * (W / 2 + 0.02), 2.0, -L / 2 + 2.25, 'number', 0);
  }
  return { b, length: 24.5 };
}

const BUILDERS = {
  loco_green: () => locoSection('green'),
  loco_blue: () => locoSection('blue'),
  coach_grey: () => coach('grey'),
  coach_green: () => coach('green'),
  gondola, tank, hopper, boxcar,
};

export const CAR_TYPES = Object.keys(BUILDERS);

/** Axle positions along each type (local z, metres), for the joint clatter. */
const axles = (bogies, n, spacing) => bogies.flatMap((zc) => Array.from({ length: n }, (_, i) => zc + (i - (n - 1) / 2) * spacing));
export const AXLES = {
  loco_green: axles([-5.1, 5.1], 3, 1.85),
  loco_blue: axles([-5.1, 5.1], 3, 1.85),
  coach_grey: axles([-8.6, 8.6], 2, 2.4),
  coach_green: axles([-8.6, 8.6], 2, 2.4),
  gondola: axles([-4.3, 4.3], 2, 1.85),
  tank: axles([-3.6, 3.6], 2, 1.85),
  hopper: axles([-4.6, 4.6], 2, 1.85),
  boxcar: axles([-4.6, 4.6], 2, 1.85),
};

/** Collision half width and height of each type. */
export const BODY = {
  loco_green: [1.7, 5.2], loco_blue: [1.7, 5.2],
  coach_grey: [1.58, 4.4], coach_green: [1.58, 4.4],
  gondola: [1.6, 3.4], tank: [1.55, 4.3], hopper: [1.58, 4.8], boxcar: [1.52, 4.5],
};

const cache = new Map();

/**
 * Build (once) and return a type's geometry by material key.
 * @param {string} type
 * @returns {{ length: number, parts: Array<{ geometry: THREE.BufferGeometry, material: THREE.Material, decal: boolean }> }}
 */
export function bakeType(type) {
  if (cache.has(type)) return cache.get(type);
  const { b, length } = BUILDERS[type]();
  const g = new THREE.Group();
  const meshes = b.flush(g);
  const decal = decalMaterial();
  const parts = meshes.map((m) => ({ geometry: m.geometry, material: m.material, decal: m.material === decal }));
  const out = { length, parts };
  cache.set(type, out);
  return out;
}
