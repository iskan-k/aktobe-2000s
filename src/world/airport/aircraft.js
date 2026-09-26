import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { cel } from '../../core/toon.js';
import { LIV, WHITE_UV, LIVERIES, liveryTex } from './liveries.js';

/* ------------------------------------------------------------------ *
 * Airliners, built from numbers.
 *
 * Every type is a table of real dimensions (length, fuselage radius,
 * span, sweep, chords, tail and engine layout) turned into geometry:
 * a lathed fuselage with an upswept tail cone, lofted airfoil sections
 * for the wings and tails, cylinder nacelles, and the landing gear.
 *
 * Local frame: the nose points to -z, starboard is +x, and the origin
 * is on the ground under the main gear, so a take-off rotation pivots
 * where a real one does. The body is one mesh with the livery canvas
 * (see liveries.js); the gear and the propellers are their own meshes
 * so they can retract and spin.
 * ------------------------------------------------------------------ */

const DEG = Math.PI / 180;

/**
 * Types, in metres. `along` values are measured back from the nose.
 * wing: span, root / tip chord, leading-edge sweep, dihedral, root LE,
 *       `high` for a high wing.
 * htail / vtail: the same for the tailplane and fin; `T` puts the
 *       tailplane on top of the fin.
 * eng:  kind 'wing' (pods under the wing), 'rear2' / 'rear3' (on the
 *       tail), 'prop' (turboprop nacelles); x from the centreline.
 */
export const TYPES = {
  b757: {
    name: 'Boeing 757-200', len: 47.3, r: 1.88, axisY: 3.55, noseLen: 6.4, tailLen: 12, tailUp: 1.1, gear: 25.5,
    wing: { span: 38.05, root: 8.2, tip: 1.8, sweep: 27, dihedral: 5, le: 16.8 },
    htail: { span: 15.2, root: 4.9, tip: 1.7, sweep: 33, le: 40.6, dihedral: 7 },
    vtail: { h: 7.3, root: 7.6, tip: 2.5, sweep: 42, le: 36.4 },
    eng: { kind: 'wing', x: 7.3, r: 1.08, len: 5.6, drop: 1.55, fwd: 3.4 },
    mains: { track: 7.3, wheels: 4 }, nose: 22.2, sound: 'jet', speed: { app: 70, rot: 74, taxi: 14 },
  },
  b737: {
    name: 'Boeing 737-200', len: 30.5, r: 1.88, axisY: 2.95, noseLen: 5.3, tailLen: 9, tailUp: 0.9, gear: 16.2,
    wing: { span: 28.35, root: 7.2, tip: 1.6, sweep: 28, dihedral: 6, le: 11.2 },
    htail: { span: 10.97, root: 3.9, tip: 1.3, sweep: 32, le: 25.6, dihedral: 7 },
    vtail: { h: 6.0, root: 6.0, tip: 2.0, sweep: 42, le: 23.6, dorsal: true },
    eng: { kind: 'wing', x: 4.9, r: 0.66, len: 6.6, drop: 0.95, fwd: 2.4, pencil: true },
    mains: { track: 5.2, wheels: 2 }, nose: 11.4, sound: 'jet', speed: { app: 68, rot: 72, taxi: 14 },
  },
  tu134: {
    name: 'Ту-134А', len: 37.1, r: 1.45, axisY: 2.55, noseLen: 5.8, tailLen: 10, tailUp: 0.7, gear: 19.6, glazedNose: true,
    wing: { span: 29.0, root: 6.9, tip: 2.0, sweep: 38, dihedral: -1.5, le: 14.2, pods: true },
    htail: { span: 11.8, root: 3.3, tip: 1.5, sweep: 42, le: 0, T: true },
    vtail: { h: 5.8, root: 6.4, tip: 3.3, sweep: 52, le: 27.6 },
    eng: { kind: 'rear2', r: 0.68, len: 5.6, at: 27.4 },
    mains: { track: 9.45, wheels: 4 }, nose: 13.9, sound: 'jet', speed: { app: 72, rot: 76, taxi: 14 },
  },
  yak42: {
    name: 'Як-42Д', len: 36.4, r: 1.9, axisY: 3.0, noseLen: 5.0, tailLen: 9, tailUp: 0.8, gear: 18.6,
    wing: { span: 34.9, root: 6.4, tip: 1.8, sweep: 25, dihedral: 2, le: 14.0 },
    htail: { span: 10.8, root: 3.2, tip: 1.7, sweep: 36, le: 0, T: true },
    vtail: { h: 5.0, root: 6.2, tip: 3.6, sweep: 45, le: 28.6 },
    eng: { kind: 'rear3', r: 0.78, len: 5.0, at: 28.8 },
    mains: { track: 5.6, wheels: 4 }, nose: 14.8, sound: 'jet', speed: { app: 64, rot: 68, taxi: 14 },
  },
  an24: {
    name: 'Ан-24', len: 23.5, r: 1.45, axisY: 2.3, noseLen: 3.8, tailLen: 8, tailUp: 1.0, gear: 11.6,
    wing: { span: 29.2, root: 3.6, tip: 1.3, sweep: 6, dihedral: -1.2, le: 9.5, high: true },
    htail: { span: 9.1, root: 2.6, tip: 1.4, sweep: 10, le: 20.0, dihedral: 9 },
    vtail: { h: 4.8, root: 4.6, tip: 1.8, sweep: 34, le: 18.0, dorsal: true },
    eng: { kind: 'prop', x: 3.9, r: 0.62, len: 7.2, blades: 4, prop: 1.95 },
    mains: { track: 7.9, wheels: 2 }, nose: 7.9, sound: 'prop', speed: { app: 55, rot: 58, taxi: 12 },
  },
  f50: {
    name: 'Fokker 50', len: 25.25, r: 1.35, axisY: 2.2, noseLen: 3.6, tailLen: 8.5, tailUp: 0.9, gear: 12.4,
    wing: { span: 29.0, root: 3.4, tip: 1.3, sweep: 4, dihedral: 2.5, le: 10.4, high: true },
    htail: { span: 9.75, root: 2.5, tip: 1.2, sweep: 12, le: 21.6, dihedral: 0 },
    vtail: { h: 5.0, root: 4.4, tip: 2.0, sweep: 35, le: 19.6 },
    eng: { kind: 'prop', x: 3.8, r: 0.56, len: 6.2, blades: 6, prop: 1.83 },
    mains: { track: 7.2, wheels: 2 }, nose: 9.7, sound: 'prop', speed: { app: 55, rot: 58, taxi: 12 },
  },
};
for (const [key, t] of Object.entries(TYPES)) t.key = key;

/* ------------------------------------------------------------------ fuselage shape */

/** Radius and vertical offset of the fuselage axis at `a` metres from the nose. */
function station(t, a) {
  const { len, r, noseLen, tailLen, tailUp } = t;
  let rr = r, dy = 0;
  if (a < noseLen) {
    const u = Math.max(0, a / noseLen);
    rr = r * Math.sqrt(1 - (1 - u) * (1 - u));
    dy = -0.22 * r * (1 - u) * (1 - u);
  } else if (a > len - tailLen) {
    const u = Math.min(1, (a - (len - tailLen)) / tailLen);
    const s = u * u * (3 - 2 * u);
    rr = r * (1 - s * 0.8);
    dy = tailUp * Math.pow(u, 1.5);
  }
  return { rr, dy };
}

/** y of the top of the fuselage at `a`, in the model frame. */
export const topAt = (t, a) => { const s = station(t, a); return t.axisY + s.dy + s.rr; };

function fuselageGeo(t, seg) {
  const pts = [];
  const n = seg > 12 ? 44 : 18;
  for (let i = 0; i <= n; i++) {
    // denser near the nose and the tail
    const k = i / n;
    const a = t.len * (0.5 - 0.5 * Math.cos(k * Math.PI));
    pts.push(new THREE.Vector2(Math.max(0.001, station(t, a).rr), t.gear - a));
  }
  // the lathe winds outward when its profile climbs in y: tail first
  pts.reverse();
  const g = new THREE.LatheGeometry(pts, seg);
  g.rotateX(-Math.PI / 2);
  const p = g.attributes.position, uv = g.attributes.uv;
  for (let i = 0; i < p.count; i++) {
    const a = p.getZ(i) + t.gear;
    p.setY(i, p.getY(i) + t.axisY + station(t, a).dy);
    uv.setXY(i, uv.getX(i) * (LIV.FUS_W / LIV.W), 1 - a / t.len);
  }
  g.computeVertexNormals();
  return g;
}

/* ------------------------------------------------------------------ lofted surfaces */

/** An airfoil section: 6 points round a chord from (x, y, z) leading edge. */
function section(le, chord, thick, vertical) {
  const prof = [[0, 0], [0.12, 0.42], [0.4, 0.5], [1, 0], [0.4, -0.42], [0.12, -0.34]];
  return prof.map(([c, h]) => (vertical
    ? new THREE.Vector3(le.x + h * thick, le.y, le.z + c * chord)
    : new THREE.Vector3(le.x, le.y + h * thick, le.z + c * chord)));
}

/** Loft between two closed sections of equal count, with flat end caps. */
function loft(a, b) {
  const pos = [];
  const tri = (p, q, r) => pos.push(p.x, p.y, p.z, q.x, q.y, q.z, r.x, r.y, r.z);
  const n = a.length;
  const ca = a.reduce((s, v) => s.add(v), new THREE.Vector3()).multiplyScalar(1 / n);
  const cb = b.reduce((s, v) => s.add(v), new THREE.Vector3()).multiplyScalar(1 / n);
  const mid = ca.clone().add(cb).multiplyScalar(0.5);
  const _n = new THREE.Vector3(), _c = new THREE.Vector3(), _e1 = new THREE.Vector3(), _e2 = new THREE.Vector3();
  const face = (p, q, r) => {
    _e1.subVectors(q, p); _e2.subVectors(r, p); _n.crossVectors(_e1, _e2);
    _c.copy(p).add(q).add(r).multiplyScalar(1 / 3).sub(mid);
    if (_n.dot(_c) < 0) tri(p, r, q); else tri(p, q, r);
  };
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    face(a[i], a[j], b[j]);
    face(a[i], b[j], b[i]);
  }
  for (let i = 1; i < n - 1; i++) { face(a[0], a[i], a[i + 1]); face(b[0], b[i + 1], b[i]); }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.computeVertexNormals();
  return g;
}

/** One half of a wing or tailplane, root at x = 0, tip at x = side * span / 2. */
function halfWing(w, side, rootY, rootZ, thickK = 0.12) {
  const hs = w.span / 2;
  const tipZ = rootZ + hs * Math.tan(w.sweep * DEG);
  const tipY = rootY + hs * Math.tan((w.dihedral || 0) * DEG);
  return loft(
    section(new THREE.Vector3(0, rootY, rootZ), w.root, w.root * thickK, false),
    section(new THREE.Vector3(side * hs, tipY, tipZ), w.tip, w.tip * thickK * 0.8, false),
  );
}

/** Where a point `f` of the way out along a half wing sits: leading edge x, y, z and chord. */
function wingAt(w, side, rootY, rootZ, f) {
  const hs = w.span / 2;
  return {
    x: side * hs * f,
    y: rootY + hs * f * Math.tan((w.dihedral || 0) * DEG),
    z: rootZ + hs * f * Math.tan(w.sweep * DEG),
    chord: w.root + (w.tip - w.root) * f,
  };
}

/* ------------------------------------------------------------------ helpers */

const _m = new THREE.Matrix4();

/** Prepare a part for the body merge: non-indexed, coloured, uv on the white patch unless kept. */
function part(g, color, keepUv = false) {
  let q = g.index ? g.toNonIndexed() : g;
  if (!q.attributes.normal) q.computeVertexNormals();
  const n = q.attributes.position.count;
  const c = new THREE.Color(color);
  const col = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b; }
  q.setAttribute('color', new THREE.BufferAttribute(col, 3));
  if (!keepUv || !q.attributes.uv) {
    const uv = new Float32Array(n * 2);
    for (let i = 0; i < n; i++) { uv[i * 2] = WHITE_UV[0]; uv[i * 2 + 1] = WHITE_UV[1]; }
    q.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  }
  for (const k of Object.keys(q.attributes)) if (!['position', 'normal', 'uv', 'color'].includes(k)) q.deleteAttribute(k);
  return q;
}

/** Cylinder along z from z0 to z1 at (x, y). */
function zCyl(r0, r1, x, y, z0, z1, seg) {
  const g = new THREE.CylinderGeometry(r0, r1, Math.abs(z1 - z0), seg, 1, false);
  g.rotateX(Math.PI / 2);           // +y becomes +z: r0 is the aft end, r1 the front
  g.translate(x, y, (z0 + z1) / 2);
  return g;
}

/** Cylinder along x (a wheel) centred at (x, y, z). */
function xCyl(r, w, x, y, z, seg) {
  const g = new THREE.CylinderGeometry(r, r, w, seg);
  g.rotateZ(Math.PI / 2);
  g.translate(x, y, z);
  return g;
}

/** A strut from a to b. */
function strut(a, b, r) {
  const d = new THREE.Vector3().subVectors(b, a);
  const g = new THREE.CylinderGeometry(r, r, d.length(), 6);
  g.translate(0, d.length() / 2, 0);
  const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize());
  g.applyMatrix4(_m.compose(a, q, new THREE.Vector3(1, 1, 1)));
  return g;
}

/** Map the fin's uv onto the fin art, mirrored on the starboard side so it reads the same. */
function finUV(g, z0, z1, y0, y1) {
  const p = g.attributes.position, n = g.attributes.normal;
  const uv = new Float32Array(p.count * 2);
  const { x, y, w, h } = LIV.FIN;
  for (let i = 0; i < p.count; i += 3) {
    const star = n.getX(i) + n.getX(i + 1) + n.getX(i + 2) > 0;
    for (let k = i; k < i + 3; k++) {
      let fu = (p.getZ(k) - z0) / (z1 - z0);
      if (star) fu = 1 - fu;
      const fv = (p.getY(k) - y0) / (y1 - y0);
      uv[k * 2] = (x + fu * w) / LIV.W;
      uv[k * 2 + 1] = 1 - (y + (1 - fv) * h) / LIV.H;
    }
  }
  g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  return g;
}

/* ------------------------------------------------------------------ build */

const METAL = 0xb8bcc0, DARK = 0x2a2c2e, TYRE = 0x1f1f20, WING = 0xd6d9dc, WING_TOP = 0xc9cdd0;

/**
 * Build the geometry of a type: { body, gear, props: [{ geo, x, y, z }], lights }.
 * `detail` false gives the far model: fewer segments, no gear doors or fans.
 */
export function aircraftGeometry(t, liv, detail = true) {
  const seg = detail ? 22 : 10, eSeg = detail ? 16 : 8;
  const parts = [];
  const body = LIVERIES[liv];
  const Z = (a) => a - t.gear;                  // along from the nose to model z
  parts.push(part(fuselageGeo(t, seg), 0xffffff, true));

  // wings
  const W = t.wing;
  const wy = W.high ? t.axisY + t.r * 0.82 : t.axisY - t.r * 0.62;
  const wz = Z(W.le);
  for (const s of [-1, 1]) {
    parts.push(part(halfWing(W, s, wy, wz, W.high ? 0.14 : 0.12), W.high ? WING_TOP : WING));
    // Tu-134 main gear pods behind the trailing edge
    if (W.pods) {
      const at = wingAt(W, s, wy, wz, 0.33);
      parts.push(part(zCyl(0.12, 0.42, at.x, at.y - 0.1, at.z + at.chord * 0.3, at.z + at.chord + 3.2, eSeg), WING));
    }
  }
  if (W.high) {
    // the wing root fairing on top of the fuselage
    parts.push(part(zCyl(0.5, 0.5, 0, wy - 0.3, wz - 0.3, wz + W.root + 0.3, 8).scale(t.r * 1.2, 1, 1), 0xffffff));
  } else {
    // the belly fairing where the wing passes under the cabin: wide and shallow
    const fg = zCyl(t.r * 0.96, t.r * 0.96, 0, 0, wz - 1.4, wz + W.root + 1.0, 14);
    fg.scale(1, 0.42, 1);
    fg.translate(0, t.axisY - t.r * 0.5, 0);
    parts.push(part(fg, new THREE.Color(body.belly).getHex()));
  }

  // fin
  const V = t.vtail;
  const vz = Z(V.le), vy = topAt(t, V.le + V.root * 0.4) - 0.25;
  const vtz = vz + V.h * Math.tan(V.sweep * DEG);
  const fin = loft(
    section(new THREE.Vector3(0, vy, vz), V.root, V.root * 0.11, true),
    section(new THREE.Vector3(0, vy + V.h, vtz), V.tip, V.tip * 0.11, true),
  );
  parts.push(part(finUV(fin, vz, vtz + V.tip, vy, vy + V.h), 0xffffff, true));
  if (V.dorsal) {
    const d = loft(
      section(new THREE.Vector3(0, vy - 0.1, vz - V.root * 0.8), V.root * 0.8, 0.3, true),
      section(new THREE.Vector3(0, vy + V.h * 0.25, vz + V.h * 0.25 * Math.tan(V.sweep * DEG)), 0.4, 0.2, true),
    );
    parts.push(part(d, body.fin === '#f4f3ee' || body.fin === '#f2f1ec' ? 0xf2f1ec : new THREE.Color(body.fin).getHex()));
  }

  // tailplane: on the fuselage, or on top of the fin
  const HT = t.htail;
  let hy, hz;
  if (HT.T) { hy = vy + V.h - 0.1; hz = vtz - 0.3; } else { hz = Z(HT.le); hy = t.axisY + station(t, HT.le).dy + 0.15; }
  for (const s of [-1, 1]) parts.push(part(halfWing(HT, s, hy, hz, 0.1), HT.T ? new THREE.Color(body.fin).getHex() : WING));

  // engines
  const E = t.eng;
  const engCol = body.engine;
  const props = [];
  if (E.kind === 'wing') {
    for (const s of [-1, 1]) {
      const f = E.x / (W.span / 2);
      const at = wingAt(W, s, wy, wz, f);
      const ey = at.y - E.drop, z0 = at.z - E.fwd, z1 = z0 + E.len;
      parts.push(part(zCyl(E.r * 0.72, E.r, at.x, ey, z0 + E.len * 0.55, z1, eSeg), engCol));      // core cowl, tapering aft
      parts.push(part(zCyl(E.r, E.r * 0.94, at.x, ey, z0, z0 + E.len * 0.55, eSeg), engCol));
      parts.push(part(zCyl(E.r * 0.9, E.r * 0.9, at.x, ey, z0 - 0.02, z0 + 0.12, eSeg), DARK));     // the intake face
      if (detail) parts.push(part(new THREE.ConeGeometry(E.r * 0.25, 0.7, 8).rotateX(-Math.PI / 2).translate(at.x, ey, z0 + 0.05), METAL));
      parts.push(part(zCyl(E.r * 0.3, E.r * 0.5, at.x, ey, z1, z1 + (E.pencil ? 0.9 : 1.4), 8), METAL)); // exhaust cone
      // the pylon up into the wing
      const py = loft(
        section(new THREE.Vector3(at.x, ey + E.r * 0.8, z0 + E.len * 0.3), E.len * 0.75, 0.3, true),
        section(new THREE.Vector3(at.x, at.y + 0.1, at.z + 0.3), at.chord * 0.7, 0.3, true),
      );
      parts.push(part(py, WING));
    }
  } else if (E.kind === 'rear2' || E.kind === 'rear3') {
    const z0 = Z(E.at), ey = t.axisY + station(t, E.at).dy + 0.35;
    const ex = station(t, E.at + E.len / 2).rr + E.r + 0.35;
    for (const s of [-1, 1]) {
      parts.push(part(zCyl(E.r * 0.82, E.r, s * ex, ey, z0, z0 + E.len, eSeg), engCol));
      parts.push(part(zCyl(E.r * 0.86, E.r * 0.86, s * ex, ey, z0 - 0.02, z0 + 0.1, eSeg), DARK));
      parts.push(part(zCyl(E.r * 0.62, E.r * 0.62, s * ex, ey, z0 + E.len, z0 + E.len + 0.04, 8), DARK));
      const py = loft(
        section(new THREE.Vector3(s * 0.2, ey, z0 + 1.0), E.len * 0.6, 0.35, false),
        section(new THREE.Vector3(s * (ex - E.r * 0.6), ey, z0 + 1.2), E.len * 0.5, 0.3, false),
      );
      parts.push(part(py, 0xe6e6e2));
    }
    if (E.kind === 'rear3') {
      // the centre engine's S-duct intake on top, ahead of the fin, and its exhaust in the tail
      const ia = V.le - 1.8, iy = topAt(t, ia);
      const hump = zCyl(0.62, 0.7, 0, iy - 0.1, Z(ia), Z(V.le + 1), eSeg);
      parts.push(part(hump, 0xffffff));
      parts.push(part(zCyl(0.56, 0.56, 0, iy - 0.1, Z(ia) - 0.03, Z(ia) + 0.06, eSeg), DARK));
      parts.push(part(zCyl(0.42, 0.42, 0, t.axisY + t.tailUp * 0.95, Z(t.len) - 0.1, Z(t.len) + 0.02, 10), DARK));
    }
  } else if (E.kind === 'prop') {
    for (const s of [-1, 1]) {
      const at = wingAt(W, s, wy, wz, E.x / (W.span / 2));
      const ey = at.y - E.r * 0.55, z0 = at.z - 2.4, z1 = z0 + E.len;
      parts.push(part(zCyl(E.r, E.r * 0.8, at.x, ey, z0, z0 + 1.6, eSeg), engCol));
      parts.push(part(zCyl(E.r * 0.45, E.r, at.x, ey, z0 + 1.6, z1, eSeg), engCol));
      parts.push(part(zCyl(E.r * 0.35, E.r * 0.35, at.x, ey - E.r * 0.72, z0 + 0.2, z0 + 0.3, 8), DARK)); // oil cooler scoop
      props.push({ x: at.x, y: ey, z: z0 - 0.35, r: E.prop, blades: E.blades, hub: E.r * 0.55 });
    }
  }

  const bodyGeo = mergeGeometries(parts, false);
  bodyGeo.computeBoundingSphere();

  // landing gear: its own mesh, so it can retract
  const gp = [];
  const M = t.mains;
  const wr = t.r > 1.6 ? 0.56 : 0.45;
  const legTop = W.high ? t.axisY - t.r * 0.2 : wy;
  for (const s of [-1, 1]) {
    const x = s * M.track / 2;
    gp.push(part(strut(new THREE.Vector3(x, wr, 0), new THREE.Vector3(x, legTop, -0.2), 0.12), METAL));
    const rows = M.wheels === 4 ? [-0.65, 0.65] : [0];
    for (const dz of rows) {
      for (const dx of [-0.34, 0.34]) {
        gp.push(part(xCyl(wr, 0.3, x + dx, wr, dz, detail ? 12 : 6), TYRE));
        if (detail) gp.push(part(xCyl(wr * 0.5, 0.32, x + dx, wr, dz, 8), 0x9a9ea2));
      }
    }
    if (M.wheels === 4) gp.push(part(new THREE.BoxGeometry(0.16, 0.14, 1.6).translate(x, wr, 0), METAL));
  }
  const nz = -t.nose, nr = wr * 0.7;
  gp.push(part(strut(new THREE.Vector3(0, nr, nz), new THREE.Vector3(0, t.axisY - t.r * 0.6, nz - 0.1), 0.09), METAL));
  for (const dx of [-0.2, 0.2]) gp.push(part(xCyl(nr, 0.22, dx, nr, nz, detail ? 10 : 6), TYRE));
  const gearGeo = mergeGeometries(gp, false);
  gearGeo.computeBoundingSphere();

  // lights, in the model frame
  const tipL = wingAt(W, -1, wy, wz, 1), tipR = wingAt(W, 1, wy, wz, 1);
  const rootL = wingAt(W, -1, wy, wz, 0.18), rootR = wingAt(W, 1, wy, wz, 0.18);
  const lights = {
    navL: [tipL.x - 0.1, tipL.y, tipL.z + 0.2],
    navR: [tipR.x + 0.1, tipR.y, tipR.z + 0.2],
    tail: [0, t.axisY + t.tailUp, Z(t.len) + 0.1],
    beaconTop: [0, topAt(t, t.len * 0.45) + 0.12, Z(t.len * 0.45)],
    beaconBottom: [0, t.axisY - t.r - 0.1, Z(t.len * 0.4)],
    strobeL: [tipL.x, tipL.y, tipL.z + tipL.chord * 0.8],
    strobeR: [tipR.x, tipR.y, tipR.z + tipR.chord * 0.8],
    landL: [rootL.x, rootL.y, rootL.z - 0.1],
    landR: [rootR.x, rootR.y, rootR.z - 0.1],
    taxi: [0, t.axisY - t.r * 0.6, nz - 0.3],
  };
  return { body: bodyGeo, gear: gearGeo, props, lights };
}

/** Blades and spinner of one propeller, spinning about local z. */
export function propGeometry(p, detail = true) {
  const parts = [];
  parts.push(part(new THREE.ConeGeometry(p.hub, 1.0, 10).rotateX(-Math.PI / 2).translate(0, 0, -0.1), 0xd8d8d4));
  if (detail) {
    for (let i = 0; i < p.blades; i++) {
      const a = (i / p.blades) * Math.PI * 2;
      const g = new THREE.BoxGeometry(0.2, p.r, 0.05);
      g.translate(0, p.r / 2 + p.hub * 0.4, 0.2);
      g.rotateY(0.35);
      g.rotateZ(a);
      parts.push(part(g, 0x2a2a2c));
    }
  }
  const g = mergeGeometries(parts, false);
  g.computeBoundingSphere();
  return g;
}

/** A soft grey disc for a propeller at speed. */
const discGeo = new THREE.CircleGeometry(1, 24);
const discMat = new THREE.MeshBasicMaterial({ color: 0x3a3c3e, transparent: true, opacity: 0.18, depthWrite: false, side: THREE.DoubleSide });

/* ------------------------------------------------------------------ instances */

const geoCache = new Map();
function cachedGeometry(t, liv, detail) {
  const k = `${t.key}|${liv}|${detail}`;
  if (!geoCache.has(k)) geoCache.set(k, aircraftGeometry(t, liv, detail));
  return geoCache.get(k);
}

const FAR = 420;          // metres: beyond this the far model draws

/**
 * An airliner against the sky stays readable much further off than a
 * wall does: thin the haze on its materials to about half.
 */
function lessHaze(mat) {
  const prev = mat.onBeforeCompile;
  mat.onBeforeCompile = (shader, renderer) => {
    prev.call(mat, shader, renderer);
    shader.fragmentShader = shader.fragmentShader.replace('#include <fog_fragment>', `
      #ifdef USE_FOG
        float fogFactor = smoothstep( fogNear, fogFar * 2.2, vFogDepth ) * 0.8;
        gl_FragColor.rgb = mix( gl_FragColor.rgb, fogColor, fogFactor );
      #endif`);
  };
  const baseProgram = mat.customProgramCacheKey();
  mat.customProgramCacheKey = () => `${baseProgram}-aircraft`;
  return mat;
}

let gearMat = null;
const gearMaterial = () => (gearMat ||= lessHaze(cel({ vertexColors: true, grime: 0.03, dirt: 0, cache: false })));

/**
 * One airframe: a group with the body (near and far), the gear, the
 * propellers and the light positions. `setGear(down)`, `spin(dt, rate)`.
 */
export function makeAircraft(typeKey, livKey, reg) {
  const t = TYPES[typeKey];
  const near = cachedGeometry(t, livKey, true), far = cachedGeometry(t, livKey, false);
  const mat = lessHaze(cel({ map: liveryTex(t, livKey, reg), vertexColors: true, grime: 0.02, dirt: 0, bands: 4, cache: false }));
  const group = new THREE.Group();
  group.name = `aircraft ${reg}`;
  const lod = new THREE.LOD();
  const nearMesh = new THREE.Mesh(near.body, mat);
  const farMesh = new THREE.Mesh(far.body, mat);
  nearMesh.castShadow = true;
  nearMesh.receiveShadow = true;
  lod.addLevel(nearMesh, 0);
  lod.addLevel(farMesh, FAR);
  group.add(lod);
  const gear = new THREE.Mesh(near.gear, gearMaterial());
  gear.castShadow = true;
  group.add(gear);
  const props = near.props.map((p) => {
    const pivot = new THREE.Group();
    pivot.position.set(p.x, p.y, p.z);
    const blades = new THREE.Mesh(propGeometry(p, true), gearMaterial());
    const disc = new THREE.Mesh(discGeo, discMat);
    disc.scale.setScalar(p.r + p.hub * 0.4);
    disc.position.z = 0.2;
    disc.visible = false;
    pivot.add(blades, disc);
    group.add(pivot);
    return { pivot, blades, disc, angle: p.x };
  });
  return {
    type: t, key: typeKey, livery: livKey, reg, group, gear, props, lights: near.lights,
    setGear(down) { gear.visible = down; },
    /** Spin the propellers; `rate` 0 stopped .. 1 take-off power. */
    spin(dt, rate) {
      for (const p of props) {
        p.angle += dt * rate * 40;
        p.blades.rotation.z = p.angle;
        p.disc.visible = rate > 0.25;
        p.blades.visible = rate < 0.6 || Math.sin(p.angle * 3) > 0;
      }
    },
  };
}
