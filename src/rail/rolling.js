import * as THREE from 'three';
import { Batch } from '../core/batch.js';

/* ------------------------------------------------------------------ *
 * Rolling stock, built once per type and drawn instanced.
 *
 *   loco_green  2TE10M section, Soviet dark green with a red band and
 *               thin yellow lines (Aktobe depot, January 2007)
 *   loco_blue   2TE10M in the new KTZ scheme: light blue body, red
 *               front, yellow chevron, blue skirt
 *   coach_grey  Soviet all-metal passenger coach, blue-grey, pale stripe
 *   coach_green the same in dark green with a yellow stripe
 *   gondola     open wagon (полувагон), red-brown, ribbed sides
 *   tank        tank car, black
 *   hopper      covered hopper, grey-beige
 *   boxcar      covered wagon (крытый вагон), brown, sliding door
 *
 * Every type is authored with its front toward local -z, origin at the
 * top of the rail in the middle of the car, and returns
 * { parts: { solid, glass?, glow? }, length } where length is over the
 * couplers. `bakeType` merges the parts into geometries by material.
 * ------------------------------------------------------------------ */

// Batches here use cell: Infinity so every part lands in one cell (with a
// finite cell, parts either side of the origin would split into two).
const DARK = 0x2b2b2a;
const BOGIE = 0x33322f;
const WHEEL = 0x55524c;
const ROOF_GREY = 0x75786f;

function bogie(b, zc, axles, spacing, r, gauge = 1.52) {
  const n = axles;
  const span = (n - 1) * spacing;
  b.box(2.3, 0.45, span + 1.4, BOGIE, 0, r * 0.55, zc);
  for (let i = 0; i < n; i++) {
    const z = zc - span / 2 + i * spacing;
    for (const s of [-1, 1]) {
      b.cyl(r, 0.12, WHEEL, s * (gauge / 2 + 0.02), r, z, { rz: Math.PI / 2, seg: 12 });
    }
    b.cyl(0.08, gauge + 0.3, DARK, -(gauge + 0.3) / 2, r, z, { rz: -Math.PI / 2, seg: 5 });
  }
  // springs and axle boxes on the outside
  for (const s of [-1, 1]) b.box(0.3, 0.35, span + 0.4, 0x3d3b37, s * 1.1, r * 0.4, zc);
}

function buffers(b, zEnd, y, sign) {
  for (const s of [-1, 1]) b.cyl(0.17, 0.4, DARK, s * 0.88, y, zEnd, { rx: sign * Math.PI / 2, seg: 8 });
  b.box(0.35, 0.3, 0.4, DARK, 0, y - 0.15, zEnd + sign * 0.15);
}

/* ---------------- locomotive section ---------------- */

function locoSection(livery) {
  const b = new Batch({ cell: Infinity });
  const L = 16.2, W = 3.36, y0 = 1.62, y1 = 4.75;
  const blue = livery === 'blue';
  const body = blue ? 0x56a6da : 0x2f6b3a;
  const band = 0xc0302a;
  const yellow = 0xe2b33a;
  const zF = -L / 2, zR = L / 2;

  // frame, tank, bogies
  b.box(W - 0.2, 0.42, L, DARK, 0, y0 - 0.42, 0);
  b.box(2.6, 0.95, 5.2, 0x3a3935, 0, 0.75, 0);
  bogie(b, -5.1, 3, 1.85, 0.525);
  bogie(b, 5.1, 3, 1.85, 0.525);
  buffers(b, zF - 0.2, 1.25, -1);
  buffers(b, zR + 0.2, 1.25, 1);

  // body sides and roof
  b.box(W, y1 - y0, L - 1.2, body, 0, y0, 0.6);
  b.box(W - 0.35, 0.28, L - 0.6, ROOF_GREY, 0, y1, 0.3);
  if (blue) b.box(W + 0.02, 0.5, L, 0x2a5f9a, 0, y0, 0);     // blue skirt
  // livery bands along the sides
  if (!blue) {
    b.box(W + 0.03, 0.36, L - 0.2, band, 0, 2.72, 0);
    b.box(W + 0.035, 0.07, L - 0.2, yellow, 0, 3.12, 0);
    b.box(W + 0.035, 0.07, L - 0.2, yellow, 0, 2.6, 0);
  } else {
    b.box(W + 0.03, 0.12, L - 0.2, 0xf1efe6, 0, 3.05, 0);
  }

  // the cab: a slightly narrower nose with a raked windscreen
  const noseZ = zF + 0.6;
  b.box(W - 0.06, 1.3, 1.2, body, 0, y0, noseZ);
  b.box(W - 0.3, 1.9, 1.0, body, 0, y0 + 1.3, noseZ + 0.15, { rx: -0.12 });
  b.box(W - 0.4, 0.26, 1.4, ROOF_GREY, 0, y1, noseZ + 0.35);
  if (!blue) {
    b.box(W + 0.02, 0.36, 1.25, band, 0, 2.72, noseZ);
    b.box(W - 0.02, 0.38, 0.06, band, 0, 2.7, zF - 0.02);
  } else {
    // red front with the yellow chevron
    b.box(W - 0.02, 1.35, 0.06, band, 0, y0, zF - 0.02);
    for (const s of [-1, 1]) b.box(1.8, 0.2, 0.07, yellow, s * 0.8, 2.95, zF - 0.04, { rz: s * 0.28 });
  }
  // windscreen and cab side windows
  for (const s of [-1, 1]) {
    b.box(1.3, 0.8, 0.08, 0x2e3a42, s * 0.75, 3.45, zF + 0.7, { rx: -0.12, mat: 'glass' });
    b.box(0.08, 0.7, 0.9, 0x2e3a42, s * (W / 2 + 0.01), 3.5, zF + 1.5, { mat: 'glass' });
  }
  // headlight on the roof edge and two marker lamps
  b.cyl(0.2, 0.25, 0xfff6d8, 0, y1 - 0.05, zF + 0.45, { rx: Math.PI / 2, seg: 10, mat: 'glow' });
  for (const s of [-1, 1]) b.cyl(0.1, 0.1, 0xfff0c8, s * 1.1, 2.1, zF - 0.05, { rx: Math.PI / 2, seg: 8, mat: 'glow' });
  // handrails and steps under the cab doors
  for (const s of [-1, 1]) {
    b.box(0.05, 1.8, 0.05, 0xd8d6cc, s * (W / 2 + 0.06), 1.9, zF + 2.2);
    b.box(0.5, 0.06, 0.3, DARK, s * (W / 2 - 0.1), 1.0, zF + 2.2);
  }

  // side louvres and small windows along the engine room
  for (let i = 0; i < 6; i++) {
    const z = zF + 3.5 + i * 2.0;
    for (const s of [-1, 1]) {
      b.box(0.06, 0.55, 1.2, 0x223028, s * (W / 2 + 0.01), 3.55, z, { mat: 'glass' });
      b.box(0.05, 0.9, 1.4, blue ? 0x4a8fc0 : 0x255a31, s * (W / 2 + 0.015), 1.75, z);
    }
  }
  // roof: radiator fans at the rear, exhaust stack, horns
  for (let i = 0; i < 4; i++) {
    b.cyl(0.6, 0.18, 0x5c5f58, (i % 2 ? -0.75 : 0.75), y1 + 0.2, zR - 1.4 - Math.floor(i / 2) * 1.5, { seg: 14 });
    b.cyl(0.52, 0.2, 0x2f312e, (i % 2 ? -0.75 : 0.75), y1 + 0.22, zR - 1.4 - Math.floor(i / 2) * 1.5, { seg: 14 });
  }
  b.cyl(0.22, 0.45, DARK, 0, y1 + 0.2, 0.5, { seg: 8 });
  b.cyl(0.07, 0.4, 0xb9b6ab, 0.4, y1 + 0.25, zF + 1.4, { rx: Math.PI / 2, seg: 6 });
  // rear end: flat with a gangway door (the sections couple back to back)
  b.box(W - 0.2, 2.6, 0.08, blue ? 0x4a8fc0 : 0x285c33, 0, y0 + 0.2, zR - 0.02);
  return { b, length: 16.97 };
}

/* ---------------- passenger coach ---------------- */

function coach(livery) {
  const b = new Batch({ cell: Infinity });
  const L = 23.6, W = 3.1, y0 = 1.25, y1 = 3.78;
  const green = livery === 'green';
  const body = green ? 0x3d5e46 : 0x6f8aa0;
  const stripe = green ? 0xd9c060 : 0xdcdfd8;
  b.box(W - 0.3, 0.35, L - 0.4, DARK, 0, y0 - 0.35, 0);
  bogie(b, -8.6, 2, 2.4, 0.475);
  bogie(b, 8.6, 2, 2.4, 0.475);
  b.box(1.6, 0.6, 2.2, 0x3a3935, 0, 0.6, 0);        // generator box
  buffers(b, -L / 2 - 0.3, 1.1, -1);
  buffers(b, L / 2 + 0.3, 1.1, 1);
  b.box(W, y1 - y0, L, body, 0, y0, 0);
  // the roof, stepped in to suggest its curve
  b.box(W - 0.2, 0.22, L - 0.1, 0x6c6e69, 0, y1, 0);
  b.box(W - 0.9, 0.18, L - 0.3, 0x74766f, 0, y1 + 0.22, 0);
  for (let i = 0; i < 6; i++) b.cyl(0.18, 0.14, 0x5c5e59, 0, y1 + 0.38, -9 + i * 3.6, { seg: 8 });
  // pale stripe under the windows
  b.box(W + 0.02, 0.18, L - 0.3, stripe, 0, 2.2, 0);
  // windows: ten per side, dark glass with white curtains drawn to the sides
  for (let i = 0; i < 10; i++) {
    const z = -L / 2 + 3.0 + i * 1.95;
    for (const s of [-1, 1]) {
      b.box(0.06, 0.8, 1.15, 0x2f3c46, s * (W / 2 + 0.005), 2.55, z, { mat: 'glass' });
      b.box(0.07, 0.8, 0.22, 0xeeeee8, s * (W / 2 + 0.01), 2.55, z - 0.44);
      b.box(0.07, 0.8, 0.22, 0xeeeee8, s * (W / 2 + 0.01), 2.55, z + 0.44);
    }
  }
  // vestibule doors at both ends, the gangway bellows
  for (const e of [-1, 1]) {
    for (const s of [-1, 1]) b.box(0.07, 2.0, 0.85, green ? 0x34523d : 0x5f798f, s * (W / 2 + 0.01), 1.45, e * (L / 2 - 1.0));
    for (const s of [-1, 1]) b.box(0.06, 0.55, 0.5, 0x2f3c46, s * (W / 2 + 0.02), 2.7, e * (L / 2 - 1.0), { mat: 'glass' });
    b.box(1.6, 2.3, 0.5, 0x1f1f1e, 0, 1.35, e * (L / 2 + 0.2));
  }
  return { b, length: 24.5 };
}

/* ---------------- freight ---------------- */

function gondola() {
  const b = new Batch({ cell: Infinity });
  const L = 12.7, W = 3.13, y0 = 1.28, y1 = 3.36;
  const c = 0x7a3a2a;
  b.box(W - 0.4, 0.3, L, DARK, 0, y0 - 0.3, 0);
  bogie(b, -4.3, 2, 1.85, 0.475);
  bogie(b, 4.3, 2, 1.85, 0.475);
  buffers(b, -L / 2 - 0.3, 1.1, -1);
  buffers(b, L / 2 + 0.3, 1.1, 1);
  // floor, the load (coal, heaped), four walls
  b.box(W - 0.1, 0.1, L - 0.1, 0x3e2a22, 0, y0, 0);
  b.box(W - 0.3, 1.2, L - 0.4, 0x26231f, 0, y0 + 0.1, 0);
  b.box(W - 0.8, 0.35, L - 1.2, 0x2c2925, 0, y0 + 1.3, 0);
  for (const s of [-1, 1]) {
    b.box(0.08, y1 - y0, L, c, s * (W / 2 - 0.04), y0, 0);
    b.box(W, y1 - y0, 0.08, c, 0, y0, s * (L / 2 - 0.04));
    for (let i = 0; i <= 10; i++) {
      b.box(0.12, y1 - y0, 0.14, 0x6a3122, s * (W / 2 + 0.02), y0, -L / 2 + 0.3 + i * ((L - 0.6) / 10));
    }
    b.box(0.13, 0.12, L, 0x6a3122, s * (W / 2 + 0.03), y1 - 0.12, 0);
  }
  return { b, length: 13.92 };
}

function tank() {
  const b = new Batch({ cell: Infinity });
  const L = 11.0, y0 = 1.2;
  const c = 0x2b2b2d;
  b.box(2.8, 0.3, L + 0.6, DARK, 0, y0 - 0.3, 0);
  bogie(b, -3.6, 2, 1.85, 0.475);
  bogie(b, 3.6, 2, 1.85, 0.475);
  buffers(b, -L / 2 - 0.55, 1.1, -1);
  buffers(b, L / 2 + 0.55, 1.1, 1);
  b.cyl(1.5, L, c, 0, 2.75, -L / 2, { rx: Math.PI / 2, seg: 18 });
  for (const s of [-1, 1]) {
    const cap = new THREE.SphereGeometry(1.5, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2);
    cap.scale(1, 1, 0.35);
    cap.rotateX(s * Math.PI / 2);
    cap.translate(0, 2.75, s * L / 2);
    b.add(cap, { color: c });
  }
  b.cyl(0.45, 0.5, c, 0, 4.15, 0, { seg: 12 });
  b.box(1.4, 0.05, 1.2, 0x6f6f6a, 0, 4.25, 0);
  for (const s of [-1, 1]) b.box(0.05, 1.9, 0.5, 0x8a8a84, s * 1.4, 1.3, 0.8);
  return { b, length: 12.02 };
}

function hopper() {
  const b = new Batch({ cell: Infinity });
  const L = 13.4, W = 3.1;
  const c = 0x9b958a;
  bogie(b, -4.6, 2, 1.85, 0.475);
  bogie(b, 4.6, 2, 1.85, 0.475);
  b.box(W - 0.4, 0.3, L, DARK, 0, 1.0, 0);
  buffers(b, -L / 2 - 0.4, 1.1, -1);
  buffers(b, L / 2 + 0.4, 1.1, 1);
  b.box(W, 2.2, L, c, 0, 2.2, 0);
  b.box(W - 0.3, 0.3, L - 0.6, 0x8c867b, 0, 4.4, 0);
  // the sloped hoppers underneath
  for (const z of [-3.6, 0, 3.6]) b.box(W - 0.2, 1.1, 2.6, 0x8f897e, 0, 1.3, z);
  for (const s of [-1, 1]) for (let i = 0; i < 7; i++) b.box(0.08, 2.2, 0.12, 0x847e73, s * (W / 2 + 0.02), 2.2, -L / 2 + 0.5 + i * ((L - 1) / 6));
  for (let i = 0; i < 4; i++) b.cyl(0.35, 0.12, 0x6f6a61, 0, 4.7, -4.5 + i * 3, { seg: 10 });
  return { b, length: 14.72 };
}

function boxcar() {
  const b = new Batch({ cell: Infinity });
  const L = 13.8, W = 2.95, y0 = 1.3, y1 = 4.2;
  const c = 0x6e4a34;
  b.box(W - 0.3, 0.3, L, DARK, 0, y0 - 0.3, 0);
  bogie(b, -4.6, 2, 1.85, 0.475);
  bogie(b, 4.6, 2, 1.85, 0.475);
  buffers(b, -L / 2 - 0.4, 1.1, -1);
  buffers(b, L / 2 + 0.4, 1.1, 1);
  b.box(W, y1 - y0, L, c, 0, y0, 0);
  b.box(W - 0.1, 0.18, L, 0x5f4030, 0, y1, 0);
  b.box(W - 0.8, 0.12, L - 0.2, 0x644433, 0, y1 + 0.18, 0);
  for (const s of [-1, 1]) {
    b.box(0.06, 2.4, 3.8, 0x5c3c2b, s * (W / 2 + 0.02), y0 + 0.15, 0);        // sliding door
    b.box(0.08, 0.1, 4.6, 0x3a3a38, s * (W / 2 + 0.03), y1 - 0.1, 0);          // door rail
    for (let i = 0; i < 9; i++) if (Math.abs(i - 4) > 1) b.box(0.08, y1 - y0, 0.1, 0x5c3c2b, s * (W / 2 + 0.02), y0, -L / 2 + 0.4 + i * ((L - 0.8) / 8));
    b.box(0.06, 0.5, 0.9, 0x3e342c, s * (W / 2 + 0.02), 3.2, -L / 2 + 1.4);   // hatch
  }
  return { b, length: 14.73 };
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
 * @returns {{ length: number, parts: Array<{ geometry: THREE.BufferGeometry, material: THREE.Material }> }}
 */
export function bakeType(type) {
  if (cache.has(type)) return cache.get(type);
  const { b, length } = BUILDERS[type]();
  const g = new THREE.Group();
  const meshes = b.flush(g);
  const parts = meshes.map((m) => ({ geometry: m.geometry, material: m.material }));
  const out = { length, parts };
  cache.set(type, out);
  return out;
}
