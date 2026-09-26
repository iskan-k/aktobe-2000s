import * as THREE from 'three';
import { withInside } from '../../core/batch.js';

/* ------------------------------------------------------------------ *
 * Figure kit for statues: the geometry a sculptor's forms need, so a
 * bronze reads as a person and not as a stack of cylinders.
 *
 *   loft      horizontal rings stacked up a body: torso, skirt, coat.
 *             Rings can be egg-shaped (fuller front or back), carry
 *             vertical cloth folds, and leave a gap at the front for an
 *             open coat (then both sides are drawn).
 *   sweep     a tube along a smooth curve with a radius per point: arms,
 *             legs, a neck, a sabre, a strap.
 *   headGeo   a head with a face pushed out of a sphere: skull, jaw,
 *             brow, eye sockets, nose, lips, chin, and optionally a
 *             moustache and beard, dense at the face and sparse behind.
 *   hairGeo   a shell over the skull, cut at a hairline, with combed
 *             grooves.
 *   hand      a mitten with a thumb, open or clenched.
 *   chamferFrustum  a tapering block with chamfered edges, for granite.
 *
 * Everything is authored in a figure's local space (y up, facing -z,
 * a person's right is +x) at life size; a Sculpt scales and places it.
 * A standing adult is 1.72-1.80 tall here.
 * ------------------------------------------------------------------ */

const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const smooth = (a, b, v) => { const t = clamp((v - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
const gauss = (d, s) => Math.exp(-(d * d) / (2 * s * s));
const lerp = (a, b, t) => a + (b - a) * t;

/* ---------------- loft ---------------- */

/**
 * Rings from bottom to top (or any order). A ring is
 *   { y, x = 0, z = 0, rx, rf, rb = rf, fold = 0, folds = 0, phase = 0,
 *     openR = 0, openL = openR }
 * rx is the half width, rf / rb the half depth to the front (-z) and the
 * back. `fold` is a fraction of the radius, `folds` how many round the
 * ring. openR / openL are the half gaps (radians from the front) on the
 * right (+x) and left sides: a coat worn open. With a gap the surface is
 * drawn from both sides.
 */
export function loft(rings, { seg = 28, capTop = false, capBottom = false } = {}) {
  const open = rings.some((r) => (r.openR || 0) > 0 || (r.openL ?? r.openR ?? 0) > 0);
  const cols = open ? seg + 1 : seg;
  const pos = [], shade = [];
  for (const r of rings) {
    const a0 = open ? (r.openR || 0) : 0;
    const a1 = open ? Math.PI * 2 - (r.openL ?? r.openR ?? 0) : Math.PI * 2;
    const rb = r.rb ?? r.rf;
    for (let j = 0; j < cols; j++) {
      const a = a0 + ((a1 - a0) * j) / seg;
      const s = Math.sin(a), c = Math.cos(a);
      const w = smooth(-0.3, 0.3, c);
      const rz = rb + (r.rf - rb) * w;
      const wave = Math.sin((r.folds || 0) * a + (r.phase || 0));
      const f = 1 + (r.fold || 0) * wave;
      pos.push((r.x || 0) + r.rx * s * f, r.y, (r.z || 0) - rz * c * f);
      // the valleys of the folds hold a little shadow whatever the light
      shade.push(1 - Math.min(0.28, (r.fold || 0) * 4) * (0.5 - 0.5 * wave));
    }
  }
  const idx = [];
  for (let i = 0; i < rings.length - 1; i++) {
    for (let j = 0; j < seg; j++) {
      const j1 = open ? j + 1 : (j + 1) % seg;
      const a = i * cols + j, b = i * cols + j1, c = (i + 1) * cols + j, d = (i + 1) * cols + j1;
      // wound so the outside faces out when rings run bottom to top
      if (rings[i + 1].y >= rings[i].y) idx.push(a, d, b, a, c, d); else idx.push(a, b, d, a, d, c);
    }
  }
  const up = rings[rings.length - 1].y >= rings[0].y;
  const cap = (ri, top) => {
    const r = rings[ri];
    const centre = pos.length / 3;
    pos.push(r.x || 0, r.y, r.z || 0);
    shade.push(1);
    for (let j = 0; j < seg; j++) {
      const a = ri * cols + j, b = ri * cols + ((j + 1) % cols);
      if (top === up) idx.push(a, centre, b); else idx.push(a, b, centre);
    }
  };
  if (!open && capTop) cap(rings.length - 1, true);
  if (!open && capBottom) cap(0, false);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  if (rings.some((r) => r.fold)) g.setAttribute('shade', new THREE.Float32BufferAttribute(shade, 1));
  g.setIndex(idx);
  g.computeVertexNormals();
  return open ? withInside(g) : g;
}

/* ---------------- sweep ---------------- */

const _t = new THREE.Vector3();
const _n = new THREE.Vector3();
const _b = new THREE.Vector3();
const _p = new THREE.Vector3();

/**
 * A tube through `pts` ([x, y, z] each) on a smooth curve, radius
 * interpolated from `radii` (one per point, or a single number). The
 * ends are closed with a low dome. `flat` squashes the section across
 * the curve's binormal (1 = round).
 */
export function sweep(pts, radii, { seg = 10, samples = 0, caps = [true, true], flat = 1, curve: kind = 'centripetal' } = {}) {
  const P = pts.map((p) => new THREE.Vector3(...p));
  const R = Array.isArray(radii) ? radii : P.map(() => radii);
  const curve = P.length === 2 ? new THREE.LineCurve3(P[0], P[1]) : new THREE.CatmullRomCurve3(P, false, kind);
  const n = samples || Math.max(4, (P.length - 1) * 6);
  // radius along arc length, by the chord lengths between control points
  const cum = [0];
  for (let i = 1; i < P.length; i++) cum.push(cum[i - 1] + P[i].distanceTo(P[i - 1]));
  const total = cum[cum.length - 1] || 1;
  const radiusAt = (u) => {
    const d = u * total;
    for (let i = 1; i < cum.length; i++) {
      if (d <= cum[i] || i === cum.length - 1) {
        const t = clamp((d - cum[i - 1]) / ((cum[i] - cum[i - 1]) || 1), 0, 1);
        return lerp(R[i - 1], R[i], t);
      }
    }
    return R[R.length - 1];
  };
  const frames = curve.computeFrenetFrames(n, false);
  const pos = [];
  const ring = (c, T, N, B, r) => {
    for (let j = 0; j < seg; j++) {
      const a = (j / seg) * Math.PI * 2;
      const cx = Math.cos(a) * r, sy = Math.sin(a) * r * flat;
      pos.push(c.x + N.x * cx + B.x * sy, c.y + N.y * cx + B.y * sy, c.z + N.z * cx + B.z * sy);
    }
  };
  for (let i = 0; i <= n; i++) {
    const u = i / n;
    curve.getPointAt(u, _p);
    ring(_p, frames.tangents[i], frames.normals[i], frames.binormals[i], radiusAt(u));
  }
  const idx = [];
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < seg; j++) {
      const j1 = (j + 1) % seg;
      const a = i * seg + j, b = i * seg + j1, c = (i + 1) * seg + j, d = (i + 1) * seg + j1;
      idx.push(a, d, c, a, b, d);
    }
  }
  const dome = (i, sign) => {
    const u = i / n;
    curve.getPointAt(u, _p);
    const r = radiusAt(u);
    _t.copy(frames.tangents[i]).multiplyScalar(sign);
    const base = pos.length / 3;
    // a half-size ring a little out, then the tip
    _n.copy(_p).addScaledVector(_t, r * 0.45);
    ring(_n, _t, frames.normals[i], frames.binormals[i], r * 0.72);
    _b.copy(_p).addScaledVector(_t, r * 0.62);
    const tip = pos.length / 3;
    pos.push(_b.x, _b.y, _b.z);
    const edge = i * seg;
    for (let j = 0; j < seg; j++) {
      const j1 = (j + 1) % seg;
      if (sign > 0) {
        idx.push(edge + j, base + j1, base + j, edge + j, edge + j1, base + j1);
        idx.push(base + j, base + j1, tip);
      } else {
        idx.push(edge + j, base + j, base + j1, edge + j, base + j1, edge + j1);
        idx.push(base + j, tip, base + j1);
      }
    }
  };
  if (caps[1]) dome(n, 1);
  if (caps[0]) dome(0, -1);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

/* ---------------- heads ---------------- */

/**
 * A lat-long sphere whose longitudes crowd toward the front (-z), with
 * every vertex passed through `shape(x, y, z, c)` on the unit sphere.
 * `c` is cos of the angle from the front, 1 at the nose, -1 behind.
 */
function warpedSphere(shape, { lon = 52, lat = 40, warp = 0.62 } = {}) {
  const pos = [], shade = [];
  const out = new THREE.Vector3();
  for (let i = 0; i <= lat; i++) {
    const phi = (i / lat) * Math.PI;
    const sp = Math.sin(phi), y = Math.cos(phi);
    for (let j = 0; j < lon; j++) {
      const u = j / lon;
      const th = Math.PI * 2 * u - warp * Math.sin(Math.PI * 2 * u);
      const x = Math.sin(th) * sp, z = -Math.cos(th) * sp;
      shade.push(shape(x, y, z, Math.cos(th), out) ?? 1);
      pos.push(out.x, out.y, out.z);
    }
  }
  const idx = [];
  for (let i = 0; i < lat; i++) {
    for (let j = 0; j < lon; j++) {
      const j1 = (j + 1) % lon;
      const a = i * lon + j, b = i * lon + j1, c = (i + 1) * lon + j, d = (i + 1) * lon + j1;
      idx.push(a, b, c, b, d, c);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('shade', new THREE.Float32BufferAttribute(shade, 1));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

/**
 * Baked cavity shade of a face, 1 = none: the eye sockets and the lid
 * line, under the brow, the nostrils, the line of the mouth and the dip
 * under the lip, the underside of the jaw. Bronze faces read by these
 * dark hollows as much as by the light, so a face lit square from the
 * front still has its eyes and mouth.
 */
function faceShade(x, y, front) {
  let d = 0;
  for (const s of [-1, 1]) {
    const ex = x - s * 0.35;
    d += 0.42 * gauss(ex, 0.13) * gauss(y - 0.09, 0.08) * (1 - 0.85 * gauss(ex, 0.07) * gauss(y - 0.05, 0.04));
    d += 0.35 * gauss(ex, 0.085) * gauss(y - 0.125, 0.018);
    d += 0.18 * gauss(ex + s * 0.05, 0.14) * gauss(y - 0.2, 0.035);
  }
  d += 0.5 * gauss(x, 0.13) * gauss(y + 0.35, 0.028);
  d += 0.55 * gauss(x, 0.16) * gauss(y + 0.495, 0.017);
  d += 0.25 * gauss(x, 0.2) * gauss(y + 0.62, 0.03);
  d *= front;
  d += 0.3 * smooth(-0.82, -1, y);
  return clamp(1 - d, 0.42, 1);
}

/** The skull and jaw without the face: shared by the head and its hair. */
function skull(x, y, z, o, out) {
  let px = x, py = y, pz = z;
  if (y < 0) {
    const t = -y;
    px *= 1 - o.jaw * t * t;
    pz *= z > 0 ? 1 - 0.55 * t * t : 1 - 0.12 * t;
  } else if (z > 0) {
    pz *= 1.06;
  }
  const front = smooth(0.1, 0.85, -z);
  px *= 1 - 0.07 * front;
  return out.set(px, py, pz);
}

export const HEAD = { rx: 0.076, ry: 0.118, rz: 0.1 };

/**
 * Head geometry centred on the middle of the head (eyes a little above
 * it), life size, face toward -z.
 *   female   finer nose and chin, fuller lips
 *   beard    'goatee' | 'full' | null, with `moustache`
 *   bald     no hair shell is needed (the hair is separate anyway)
 */
export function headGeo({ female = false, beard = null, moustache = false, nose = 1, brow = 0, jaw = null, lon = 56, lat = 44 } = {}) {
  const o = {
    jaw: jaw ?? (female ? 0.34 : 0.24),
    nose: nose * (female ? 0.85 : 1),
    brow: brow || (female ? 0.035 : 0.07),
    chin: female ? 0.8 : 1.1,
    lips: female ? 1.3 : 1,
  };
  const shape = (x, y, z, c, out) => {
    skull(x, y, z, o, out);
    const front = smooth(0.12, 0.85, -z);
    // a face is flatter than a ball: pull the front out to a gently
    // curved mask from the forehead to the chin
    const fd = y > 0.35 ? lerp(0.93, 0.76, smooth(0.35, 0.9, y)) : y > -0.55 ? 0.93 : lerp(0.93, 0.72, smooth(-0.55, -0.95, y));
    const mask = -fd * Math.sqrt(Math.max(0, 1 - (out.x / 0.84) ** 2));
    out.z = Math.min(out.z, lerp(out.z, mask, front * (1 - smooth(-0.86, -1, y))));
    let f = 0;
    f += o.brow * gauss(y - 0.24, 0.08) * gauss(x, 0.5);
    let side = 0;
    for (const s of [-1, 1]) {
      f -= 0.14 * gauss(x - s * 0.35, 0.13) * gauss(y - 0.08, 0.09);     // socket
      f += 0.075 * gauss(x - s * 0.35, 0.075) * gauss(y - 0.07, 0.05);    // eyeball
      f += 0.02 * gauss(x - s * 0.35, 0.1) * gauss(y - 0.14, 0.025);      // upper lid
      side += s * 0.05 * gauss(x - s * 0.6, 0.17) * gauss(y + 0.06, 0.13) * front;   // cheekbone
    }
    // the nose, narrow at the bridge and fuller at the tip, nostril wings
    if (y < 0.24) {
      const k = clamp((0.2 - y) / 0.5, 0, 1);
      const amp = y > -0.3 ? 0.025 + 0.33 * k * k : 0.355 * gauss(y + 0.3, 0.045);
      f += o.nose * amp * gauss(x, 0.055 + 0.075 * k);
      f += o.nose * 0.065 * (gauss(x - 0.14, 0.05) + gauss(x + 0.14, 0.05)) * gauss(y + 0.3, 0.05);
    }
    // lips, the dip beneath, the chin
    f += gauss(x, 0.2) * (0.045 * o.lips * gauss(y + 0.45, 0.04) + 0.04 * o.lips * gauss(y + 0.54, 0.035));
    f -= 0.02 * gauss(x - 0.2, 0.04) * gauss(y + 0.5, 0.04) + 0.02 * gauss(x + 0.2, 0.04) * gauss(y + 0.5, 0.04);
    f -= 0.03 * gauss(x, 0.3) * gauss(y + 0.64, 0.035);
    f += o.chin * 0.13 * gauss(x, 0.3) * gauss(y + 0.78, 0.08);
    let down = 0;
    if (moustache) {
      f += 0.06 * gauss(y + 0.39, 0.045) * gauss(x, 0.3) * (1 + 0.25 * Math.sin(x * 60));
      down += 0.05 * gauss(y + 0.42, 0.06) * gauss(Math.abs(x) - 0.3, 0.1);
    }
    if (beard === 'goatee') {
      const m = gauss(x, 0.28) * smooth(-0.55, -0.85, y);
      f += m * (0.12 + 0.03 * Math.sin(x * 50));
      down += m * 0.35 * smooth(-0.7, -1, y);
    } else if (beard === 'full') {
      const m = smooth(-0.35, -0.65, y) * smooth(-0.6, 0.2, -z);
      f += m * (0.14 + 0.035 * Math.sin(x * 40 + y * 12));
      side += m * x * 0.18;
      down += m * 0.45 * smooth(-0.6, -1, y) * gauss(x, 0.45);
    }
    out.x += side;
    out.y -= down;
    out.z -= f * front;
    out.set(out.x * HEAD.rx, out.y * HEAD.ry, out.z * HEAD.rz);
    let sh = faceShade(x, y, front);
    if (beard) sh *= 1 - 0.14 * smooth(-0.5, -0.7, y) * (0.5 + 0.5 * Math.sin(x * 40 + y * 12));
    return sh;
  };
  return warpedSphere(shape, { lon, lat });
}

/**
 * Hair over the skull. `visible(y, c)` is positive where the hair is
 * (c = cos of the angle from the front); elsewhere the shell tucks
 * inside the head. `thick` is how far it stands off at the crown;
 * `comb` 'back' grooves run front to back, 'down' grooves run down.
 */
export function hairGeo(visible, { thick = 0.08, comb = 'back', groove = 0.02 } = {}) {
  const o = { jaw: 0.3 };
  const shape = (x, y, z, c, out) => {
    skull(x, y, z, o, out);
    const v = visible(y, c);
    const k = smooth(-0.07, 0.02, v);
    const g = comb === 'back' ? Math.sin(x * 34) : Math.sin(Math.atan2(x, -z) * 22 + y * 3);
    const s = lerp(0.8, 1 + thick * smooth(-0.6, 0.8, y) + 0.02, k) * (1 + groove * k * g);
    out.multiplyScalar(s);
    out.set(out.x * HEAD.rx, out.y * HEAD.ry, out.z * HEAD.rz);
    // dark between the combed strands and along the hairline edge
    return 1 - 0.2 * (0.5 - 0.5 * g) - 0.25 * (1 - smooth(-0.02, 0.1, v));
  };
  return warpedSphere(shape, { lon: 48, lat: 34, warp: 0.3 });
}

/** Hairlines for hairGeo. */
export const HAIRLINE = {
  /** combed back into a knot: forehead, over the ear tops, the nape */
  swept: (y, c) => y - (c > 0 ? lerp(0.1, 0.5, c) : lerp(0.1, -0.58, -c)),
  /** a bald crown with the fringe round the sides and back */
  fringe: (y, c) => Math.min(0.3 - y + 0.25 * Math.max(0, -c), y - (c > 0 ? lerp(-0.12, 0.25, c) : lerp(-0.12, -0.55, -c)), 0.3 - c),
  /** short back and sides under a cap */
  short: (y, c) => y - (c > 0 ? lerp(0.0, 0.55, c) : lerp(0.0, -0.5, -c)),
};

/* ---------------- hands ---------------- */

const _m = new THREE.Matrix4();
const _x = new THREE.Vector3();
const _y = new THREE.Vector3();
const _z = new THREE.Vector3();

/** A matrix at `at` whose -y runs along `along` and whose +x leans toward `toward`. */
export function frame(at, along, toward) {
  _y.set(...along).normalize().negate();
  _x.set(...toward);
  _x.addScaledVector(_y, -_x.dot(_y)).normalize();
  _z.crossVectors(_x, _y);
  return new THREE.Matrix4().makeBasis(_x, _y, _z).setPosition(...at);
}

/**
 * A hand from the wrist, fingers along -y, palm toward +x. `side` +1 is a
 * right hand, -1 a left one (the thumb swaps sides). 'open' is a flat
 * hand with the fingers together, 'fist' a clenched one, 'grip' a fist
 * with a hole for a rod along z.
 */
export function handGeo(kind = 'open', side = 1) {
  const tz = side > 0 ? 1 : -1;
  const parts = [];
  const ell = (c, r, rot = [0, 0, 0]) => {
    const g = new THREE.SphereGeometry(1, 12, 9);
    g.applyMatrix4(_m.compose(new THREE.Vector3(...c), new THREE.Quaternion().setFromEuler(new THREE.Euler(...rot)), new THREE.Vector3(...r)));
    parts.push(g);
  };
  if (kind === 'open') {
    ell([0, -0.045, 0], [0.015, 0.05, 0.04]);
    ell([0.005, -0.112, 0], [0.012, 0.042, 0.037], [0, 0, 0.12]);
    parts.push(sweep([[0.006, -0.02, tz * 0.028], [0.018, -0.05, tz * 0.045], [0.026, -0.078, tz * 0.04]], [0.012, 0.01, 0.008], { seg: 7, samples: 6 }));
  } else {
    ell([0.008, -0.05, 0], [0.03, 0.046, 0.041]);
    // the curled fingers and the knuckles
    ell([0.022, -0.078, 0], [0.024, 0.025, 0.04]);
    ell([-0.008, -0.085, 0], [0.018, 0.018, 0.043]);
    parts.push(sweep([[0.01, -0.03, tz * 0.03], [0.03, -0.055, tz * 0.035], [0.034, -0.075, tz * 0.012]], [0.013, 0.011, 0.009], { seg: 7, samples: 6 }));
  }
  return parts;
}

/* ---------------- granite ---------------- */

/**
 * A block tapering from w0 x d0 at y = 0 to w1 x d1 at y = h, every edge
 * chamfered by c, flat-shaded. Base-anchored, centred on x and z.
 */
export function chamferFrustum(w0, d0, w1, d1, h, c = 0.04) {
  const sect = (w, d, y, inset) => {
    const hw = w / 2 - inset, hd = d / 2 - inset, k = Math.min(c, hw, hd);
    return [
      [hw - k, y, -hd], [hw, y, -hd + k], [hw, y, hd - k], [hw - k, y, hd],
      [-hw + k, y, hd], [-hw, y, hd - k], [-hw, y, -hd + k], [-hw + k, y, -hd],
    ];
  };
  const t = c / h;
  const rings = [
    sect(w0, d0, 0, c),
    sect(lerp(w0, w1, t), lerp(d0, d1, t), c, 0),
    sect(lerp(w0, w1, 1 - t), lerp(d0, d1, 1 - t), h - c, 0),
    sect(w1, d1, h, c),
  ];
  const tri = [];
  const quad = (a, b, cc, d) => tri.push(a, cc, b, a, d, cc);
  for (let i = 0; i < rings.length - 1; i++) {
    for (let j = 0; j < 8; j++) {
      const j1 = (j + 1) % 8;
      quad(rings[i][j], rings[i][j1], rings[i + 1][j1], rings[i + 1][j]);
    }
  }
  const top = rings[3], bot = rings[0];
  for (let j = 1; j < 7; j++) {
    tri.push(top[0], top[j + 1], top[j]);
    tri.push(bot[0], bot[j], bot[j + 1]);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(tri.flat(), 3));
  g.computeVertexNormals();
  return g;
}

/** A chamfered block, base-anchored. */
export const chamferBox = (w, h, d, c = 0.04) => chamferFrustum(w, d, w, d, h, c);

/**
 * World-scale uv by box projection, so a speckled stone texture keeps
 * its grain size on any face. Works on non-indexed geometry.
 */
export function boxUV(g, tile = 1) {
  const p = g.attributes.position, n = g.attributes.normal;
  const uv = new Float32Array(p.count * 2);
  for (let i = 0; i < p.count; i++) {
    const ax = Math.abs(n.getX(i)), ay = Math.abs(n.getY(i)), az = Math.abs(n.getZ(i));
    let u, v;
    if (ay >= ax && ay >= az) { u = p.getX(i); v = p.getZ(i); } else if (ax >= az) { u = p.getZ(i); v = p.getY(i); } else { u = p.getX(i); v = p.getY(i); }
    uv[i * 2] = u / tile;
    uv[i * 2 + 1] = v / tile;
  }
  g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  return g;
}

/** A five-pointed star with bevelled points, facing -z, centred on the origin. */
export function starGeo(r, depth = 0.05, inner = 0.4) {
  const s = new THREE.Shape();
  for (let i = 0; i < 10; i++) {
    const a = Math.PI / 2 + (i * Math.PI) / 5, rr = i % 2 ? r * inner : r;
    if (i) s.lineTo(Math.cos(a) * rr, Math.sin(a) * rr); else s.moveTo(Math.cos(a) * rr, Math.sin(a) * rr);
  }
  const bev = Math.min(depth * 0.5, r * 0.08);
  const g = new THREE.ExtrudeGeometry(s, { depth: depth - bev, bevelEnabled: true, bevelThickness: bev, bevelSize: bev * 0.6, bevelSegments: 1 });
  g.rotateY(Math.PI);
  return g;
}

/* ---------------- arms and kit ---------------- */

/** A matrix at `from` whose +y runs to `to` and whose +z leans toward `top`. */
export function alongFrame(from, to, top) {
  const Y = new THREE.Vector3(to[0] - from[0], to[1] - from[1], to[2] - from[2]).normalize();
  const Z = new THREE.Vector3(...top);
  Z.addScaledVector(Y, -Z.dot(Y)).normalize();
  const X = new THREE.Vector3().crossVectors(Y, Z);
  return new THREE.Matrix4().makeBasis(X, Y, Z).setPosition(...from);
}

const cylAt = (r0, r1, y0, y1, z = 0, seg = 10) => {
  const g = new THREE.CylinderGeometry(r1, r0, y1 - y0, seg);
  g.translate(0, (y0 + y1) / 2, z);
  return g;
};

/**
 * A Mosin rifle, 1.23 m, butt at the origin, muzzle up +y, the top of
 * the action toward +z. `scope` adds the PU sniper sight and the turned
 * down bolt handle.
 */
export function mosinGeo({ scope = true } = {}) {
  const wood = [], steel = [];
  const block = (w0, d0, w1, d1, h, y, z) => { const g = chamferFrustum(w0, d0, w1, d1, h, 0.006); g.translate(0, y, z); return g; };
  wood.push(block(0.04, 0.125, 0.034, 0.055, 0.3, 0, -0.035));      // butt
  wood.push(block(0.033, 0.05, 0.034, 0.045, 0.11, 0.3, -0.012));  // wrist
  wood.push(block(0.038, 0.042, 0.03, 0.034, 0.56, 0.52, -0.012)); // fore-end
  steel.push(cylAt(0.014, 0.014, 0.4, 0.56));                      // receiver
  steel.push(block(0.026, 0.035, 0.026, 0.03, 0.09, 0.39, -0.035)); // magazine and guard
  steel.push(cylAt(0.0095, 0.008, 0.56, 1.23, 0, 8));               // barrel
  for (const y of [0.74, 0.99]) steel.push(cylAt(0.023, 0.023, y, y + 0.014, -0.006));
  steel.push(block(0.04, 0.008, 0.04, 0.008, 0.02, 0, -0.035));      // butt plate
  if (scope) {
    steel.push(sweep([[0.014, 0.5, 0.004], [0.045, 0.49, -0.004], [0.052, 0.465, -0.02]], 0.005, { seg: 6, samples: 5 }));
    steel.push(block(0.016, 0.03, 0.016, 0.03, 0.07, 0.47, 0.026));  // mount
    steel.push(cylAt(0.013, 0.013, 0.42, 0.66, 0.048, 12));
    steel.push(cylAt(0.013, 0.018, 0.63, 0.69, 0.048, 12));          // objective
    steel.push(cylAt(0.016, 0.014, 0.41, 0.44, 0.048, 12));          // eyepiece
  } else {
    steel.push(cylAt(0.006, 0.006, 0.5, 0.56, 0.02, 6));
  }
  return { wood, steel };
}

/** A cavalry shashka, hilt at the origin, blade up +y (curving toward +z). */
export function shashkaGeo(len = 0.95) {
  const blade = [];
  const n = 8;
  for (let i = 0; i < n; i++) {
    const t0 = i / n, t1 = (i + 1) / n;
    const w0 = 0.048 * (1 - t0 * 0.4), w1 = 0.048 * (1 - t1 * 0.4);
    const seg = chamferFrustum(0.013, w0, 0.011, w1, len / n + 0.002, 0.003);
    const bend = (t) => 0.06 * t * t;
    const g = seg.clone();
    g.rotateX(-Math.atan2(bend(t1) - bend(t0), 1 / n) * 0.6);
    g.translate(0, 0.1 + t0 * len, bend(t0) * len * 0.35);
    blade.push(g);
  }
  // the point
  const tip = new THREE.ConeGeometry(0.012, 0.08, 4);
  tip.scale(0.4, 1, 1.3);
  tip.translate(0, 0.1 + len + 0.04, 0.06 * len * 0.35 + 0.004);
  blade.push(tip);
  const hilt = [
    sweep([[0, -0.02, 0], [0, 0.1, 0]], [0.016, 0.018], { seg: 8 }),       // grip
    sweep([[0, -0.03, 0], [0, -0.02, -0.05], [0, 0.03, -0.07]], 0.006, { seg: 6 }),   // the head bent forward
  ];
  return { blade, hilt };
}
