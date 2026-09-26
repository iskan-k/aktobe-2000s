
import { Batch } from '../core/batch.js';

/* ------------------------------------------------------------------ *
 * Running gear and fittings shared by the rolling stock in rolling.js.
 *
 * Local frame as in rolling.js: front toward -z, x across the car,
 * y up from the top of the rail. Gauge 1520 mm, so the wheel treads sit
 * about 0.76 m either side of the centre line.
 *
 *   bogie(b, zc, style)   'freight' 18-100 three-piece bogie,
 *                         'coach'   KVZ-TsNII passenger bogie,
 *                         'loco'    three-axle 2TE10 bogie
 *   coupler(b, zEnd, sign)  SA-3 automatic coupler on its end beam
 *   ladder, handrail, rib    small fittings
 *   stockBatch()          the batch a builder draws into: full detail,
 *                         or inside coarse(fn) the far-view version
 * ------------------------------------------------------------------ */

/**
 * Far-view batch: drops rods, rails and small fittings and halves the
 * segments of what is left, so a long train in the distance costs a
 * fraction of the triangles. Lettering is dropped too.
 */
class CoarseBatch extends Batch {
  constructor() { super({ cell: Infinity }); }

  box(w, h, d, color, x, y, z, o = {}) {
    const [a, m, c] = [w, h, d].sort((p, q) => p - q);
    if (m < 0.12 || c < 0.3 || a < 0.015) return this;
    return super.box(w, h, d, color, x, y, z, o);
  }

  cyl(r, h, color, x, y, z, o = {}) {
    if (r < 0.1 || Math.max(2 * r, h) < 0.3) return this;
    return super.cyl(r, h, color, x, y, z, { ...o, seg: Math.max(5, Math.round((o.seg ?? 8) / 2)) });
  }

  tube(ax, ay, az, bx, by, bz, r, color, o = {}) {
    if (r < 0.06) return this;
    return super.tube(ax, ay, az, bx, by, bz, r, color, o);
  }

  add(geometry, o = {}) {
    if (o.mat && typeof o.mat !== 'string' && o.mat.map) return this;
    return super.add(geometry, o);
  }
}

let coarseMode = false;

/** A batch for one car type, full or coarse depending on coarse(). */
export const stockBatch = () => (coarseMode ? new CoarseBatch() : new Batch({ cell: Infinity }));

/** Run a builder with stockBatch() handing out the far-view batch. */
export function coarse(fn) {
  coarseMode = true;
  try { return fn(); } finally { coarseMode = false; }
}

export const DARK = 0x2b2b2a;
export const STEEL = 0x3d3b37;
const CAST = 0x34332f;
const WHEEL = 0x4f4c46;
const TREAD = 0x8d8a82;
const SPRING = 0x55534c;
const RUST = 0x5a3d2c;

export const GAUGE = 1.52;
const TREAD_X = GAUGE / 2 + 0.02;

export const BOGIES = {
  freight: { axles: 2, spacing: 1.85, r: 0.475 },
  coach: { axles: 2, spacing: 2.4, r: 0.475 },
  loco: { axles: 3, spacing: 1.85, r: 0.525 },
};

/** Cylinder whose axis runs across the car (x) from x0 to x1. */
export function xCyl(b, r, x0, x1, y, z, color, seg = 10, open = false) {
  b.cyl(r, x1 - x0, color, x0, y, z, { rz: -Math.PI / 2, seg, open });
}

/** Cylinder whose axis runs along the car (z) from z0 to z1. */
export function zCyl(b, r, z0, z1, x, y, color, seg = 10) {
  b.cyl(r, z1 - z0, color, x, y, z0, { rx: Math.PI / 2, seg });
}

/** A wheelset: two rolled wheels with their flanges and hub bosses, and the axle. */
function wheelset(b, z, r) {
  for (const s of [-1, 1]) {
    const xo = s * (TREAD_X + 0.07), xi = s * (TREAD_X - 0.07);
    xCyl(b, r, Math.min(xo, xi), Math.max(xo, xi), r, z, WHEEL, 12);
    // bright tread band polished by the rail, open so the face stays dark
    xCyl(b, r + 0.004, s > 0 ? xi + 0.02 : xo, s > 0 ? xo : xi - 0.02, r, z, TREAD, 12, true);
    const f0 = s * (TREAD_X - 0.1), f1 = s * (TREAD_X - 0.065);
    xCyl(b, r + 0.03, Math.min(f0, f1), Math.max(f0, f1), r, z, WHEEL, 12);
    const h0 = s * (TREAD_X + 0.07), h1 = s * (TREAD_X + 0.12);
    xCyl(b, 0.13, Math.min(h0, h1), Math.max(h0, h1), r, z, CAST, 6);
  }
  xCyl(b, 0.075, -TREAD_X, TREAD_X, r, z, DARK, 5);
}

/** Coil spring: a light core with two dark bands, which reads as a coil at range. */
function spring(b, x, y0, h, z, r = 0.075) {
  b.cyl(r, h, SPRING, x, y0, z, { seg: 6 });
  for (const t of [0.33, 0.66]) b.cyl(r + 0.008, h * 0.12, DARK, x, y0 + h * t, z, { seg: 6, open: true });
}

function brakeShoes(b, zAxle, r, towards) {
  for (const s of [-1, 1]) {
    b.box(0.1, 0.34, 0.09, RUST, s * TREAD_X, r - 0.17, zAxle + towards * (r + 0.05));
  }
  b.box(GAUGE + 0.1, 0.06, 0.07, DARK, 0, r - 0.05, zAxle + towards * (r + 0.1));
}

function freightBogie(b, zc, { spacing, r }) {
  const za = zc - spacing / 2, zb = zc + spacing / 2;
  wheelset(b, za, r);
  wheelset(b, zb, r);
  for (const s of [-1, 1]) {
    const x = s * (TREAD_X + 0.2);
    // cast side frame: top chord, the two lower struts to the centre, axle boxes
    b.box(0.2, 0.16, spacing + 0.7, CAST, x, r + 0.08, zc);
    for (const e of [-1, 1]) {
      b.box(0.18, 0.13, spacing * 0.62, CAST, x, r - 0.1, zc + e * spacing * 0.26, { rx: e * 0.34 });
      b.box(0.26, 0.3, 0.32, STEEL, x, r - 0.16, zc + e * spacing / 2);
    }
    b.box(0.2, 0.12, 0.8, CAST, x, r - 0.36, zc);
    // spring set in the central window under the bolster
    for (const dz of [-0.22, 0, 0.22]) spring(b, x, r - 0.24, 0.26, zc + dz, 0.07);
  }
  // bolster across the bogie, the centre bearing on top
  b.box(GAUGE + 0.5, 0.28, 0.42, CAST, 0, r - 0.02, zc);
  b.cyl(0.24, 0.08, STEEL, 0, r + 0.26, zc, { seg: 10 });
  brakeShoes(b, za, r, 1);
  brakeShoes(b, zb, r, -1);
}

function coachBogie(b, zc, { spacing, r }) {
  const za = zc - spacing / 2, zb = zc + spacing / 2;
  wheelset(b, za, r);
  wheelset(b, zb, r);
  for (const s of [-1, 1]) {
    const x = s * (TREAD_X + 0.24);
    // H-frame side member, low in the middle, carried on the axle-box springs
    b.box(0.16, 0.2, spacing - 0.5, CAST, x, r + 0.12, zc);
    for (const e of [-1, 1]) {
      const zAx = zc + e * spacing / 2;
      b.box(0.16, 0.16, 0.7, CAST, x, r + 0.36, zAx - e * 0.05);
      b.box(0.26, 0.26, 0.3, STEEL, x - s * 0.04, r - 0.12, zAx);       // axle box
      b.cyl(0.11, 0.06, DARK, x + s * 0.06, r - 0.02, zAx, { rz: s * Math.PI / 2, seg: 8 });
      for (const dz of [-0.16, 0.16]) spring(b, x, r + 0.14, 0.22, zAx + dz, 0.065);
      b.box(0.1, 0.08, 0.5, RUST, x + s * 0.05, r + 0.08, zAx);              // leaf of the equaliser
    }
    // the tall central bolster springs and the hydraulic damper
    for (const dz of [-0.2, 0.2]) spring(b, x - s * 0.08, r - 0.2, 0.42, zc + dz, 0.11);
    b.box(0.07, 0.36, 0.07, DARK, x + s * 0.06, r - 0.08, zc + 0.5, { rx: 0.35 });
  }
  b.box(GAUGE + 0.55, 0.22, 0.5, CAST, 0, r + 0.22, zc);                 // top bolster
  b.box(GAUGE + 0.3, 0.14, 0.42, STEEL, 0, r - 0.26, zc);                // spring plank
  brakeShoes(b, za, r, 1);
  brakeShoes(b, za, r, -1);
  brakeShoes(b, zb, r, 1);
  brakeShoes(b, zb, r, -1);
}

function locoBogie(b, zc, { axles, spacing, r }) {
  const span = (axles - 1) * spacing;
  for (let i = 0; i < axles; i++) wheelset(b, zc - span / 2 + i * spacing, r);
  for (const s of [-1, 1]) {
    const x = s * (TREAD_X + 0.3);
    // welded box frame outside the wheels
    b.box(0.22, 0.38, span + 1.5, CAST, x, r + 0.1, zc);
    b.box(0.26, 0.08, span + 1.6, STEEL, x, r + 0.48, zc);
    for (let i = 0; i < axles; i++) {
      const z = zc - span / 2 + i * spacing;
      b.box(0.3, 0.34, 0.4, STEEL, x - s * 0.05, r - 0.2, z);
      for (const dz of [-0.14, 0.14]) spring(b, x + s * 0.02, r + 0.14, 0.34, z + dz, 0.08);
      // brake cylinder on the frame side between the axles
      if (i < axles - 1) zCyl(b, 0.1, z + spacing / 2 - 0.2, z + spacing / 2 + 0.2, x + s * 0.18, r + 0.25, DARK, 8);
    }
    // sandboxes at the ends of the frame
    for (const e of [-1, 1]) b.box(0.3, 0.45, 0.4, CAST, x + s * 0.05, r + 0.3, zc + e * (span / 2 + 0.55));
  }
  // traction motors hung between the frames, one per axle
  for (let i = 0; i < axles; i++) {
    const z = zc - span / 2 + i * spacing;
    b.box(1.1, 0.6, 0.55, 0x2c2e2c, 0, r - 0.25, z + 0.55 * (i === axles - 1 ? -1 : 1));
  }
  b.box(GAUGE + 0.3, 0.2, 0.5, CAST, 0, r + 0.42, zc);
}

/** A bogie centred at local z = zc. */
export function bogie(b, zc, style) {
  const spec = BOGIES[style];
  if (style === 'coach') coachBogie(b, zc, spec);
  else if (style === 'loco') locoBogie(b, zc, spec);
  else freightBogie(b, zc, spec);
}

/**
 * SA-3 automatic coupler at the end of a car: the end (buffer) beam, the
 * draft gear housing, the shank and the knuckle head with its lock lever.
 * `zEnd` is the pulling face; `sign` is -1 at the front, +1 at the rear.
 */
export function coupler(b, zEnd, sign, { y = 1.06, beam = 0xb3262b, beamW = 2.9 } = {}) {
  b.box(beamW, 0.38, 0.22, beam, 0, y - 0.24, zEnd - sign * 0.62);
  b.box(0.36, 0.3, 0.5, DARK, 0, y - 0.15, zEnd - sign * 0.42);
  b.box(0.26, 0.22, 0.28, DARK, 0, y - 0.11, zEnd - sign * 0.16);
  // knuckle head: the body and the hook to one side
  b.box(0.34, 0.36, 0.2, CAST, 0.02, y - 0.18, zEnd - sign * 0.05);
  b.box(0.12, 0.3, 0.14, CAST, -0.16, y - 0.15, zEnd + sign * 0.03);
  b.box(0.7, 0.04, 0.04, 0xb8b4a8, 0.45, y + 0.05, zEnd - sign * 0.55);     // uncoupling lever
  b.box(0.05, 0.05, 0.05, DARK, 0.1, y, zEnd - sign * 0.3);
  // brake hose hanging beside the coupler
  b.tube(0.3, y - 0.05, zEnd - sign * 0.45, 0.32, y - 0.35, zEnd - sign * 0.12, 0.035, 0x1a1a1a, { seg: 5 });
}

/** A vertical steel ladder: two stiles and rungs, against a face at local x or z. */
export function ladder(b, x, z, y0, y1, { along = 'x', w = 0.4, color = 0x3a3936 } = {}) {
  const dx = along === 'x' ? w / 2 : 0, dz = along === 'z' ? w / 2 : 0;
  for (const s of [-1, 1]) b.box(0.04, y1 - y0, 0.04, color, x + s * dx, y0, z + s * dz);
  for (let y = y0 + 0.2; y < y1 - 0.05; y += 0.32) {
    b.box(along === 'x' ? w : 0.03, 0.03, along === 'z' ? w : 0.03, color, x, y, z);
  }
}

/** A grab rail between two points, on short stand-offs. */
export function handrail(b, ax, ay, az, bx, by, bz, color = 0xd6d3c8) {
  b.tube(ax, ay, az, bx, by, bz, 0.02, color, { seg: 4 });
}

