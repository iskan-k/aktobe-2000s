import * as THREE from 'three';

/* ------------------------------------------------------------------ *
 * Small maths and geometry helpers shared by every builder.
 * ------------------------------------------------------------------ */

export const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
export const lerp = (a, b, t) => a + (b - a) * t;
export const invLerp = (a, b, v) => (v - a) / (b - a);
export const TAU = Math.PI * 2;
export const DEG = Math.PI / 180;

/** Hermite smoothstep that tolerates a > b. */
export function sstep(a, b, v) {
  const t = clamp((v - a) / (b - a || 1e-6), 0, 1);
  return t * t * (3 - 2 * t);
}

/** Exponential approach that is frame-rate independent. */
export function damp(current, target, rate, dt) {
  return current + (target - current) * (1 - Math.exp(-rate * dt));
}

/** Wrap an angle into (-PI, PI]. */
export function wrapAngle(a) {
  a = (a + Math.PI) % TAU;
  if (a < 0) a += TAU;
  return a - Math.PI;
}

/** Deterministic PRNG so the town looks the same on every load. */
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function next() {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Helper bundle around a seeded PRNG. */
export function rngKit(seed) {
  const r = mulberry32(seed);
  return {
    next: r,
    range: (a, b) => a + (b - a) * r(),
    int: (a, b) => Math.floor(a + (b - a + 1) * r()),
    pick: (arr) => arr[Math.floor(r() * arr.length) % arr.length],
    chance: (p) => r() < p,
    sign: () => (r() < 0.5 ? -1 : 1),
    /** Weighted pick: `items` is [[value, weight], ...]. */
    weighted: (items) => {
      const total = items.reduce((s, it) => s + it[1], 0);
      let x = r() * total;
      for (const [v, w] of items) {
        x -= w;
        if (x <= 0) return v;
      }
      return items[items.length - 1][0];
    },
  };
}

/** Stable string hash, handy for seeding per-object variety. */
export function hashStr(s) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

const _m = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _e = new THREE.Euler();
const _v = new THREE.Vector3();
const _s = new THREE.Vector3();

/** Compose a matrix from loose position / euler / scale arguments. */
export function trs(px = 0, py = 0, pz = 0, rx = 0, ry = 0, rz = 0, sx = 1, sy = 1, sz = 1) {
  _v.set(px, py, pz);
  _e.set(rx, ry, rz, 'YXZ');
  _q.setFromEuler(_e);
  _s.set(sx, sy, sz);
  return _m.clone().compose(_v, _q, _s);
}

/** Rotate (x, z) by `ry` around the origin, the same way Object3D.rotation.y does. */
export function rotXZ(x, z, ry) {
  const c = Math.cos(ry), s = Math.sin(ry);
  return [x * c + z * s, -x * s + z * c];
}

/** A catenary-ish sagging curve between two points. */
export function sagPoints(a, b, sag, segments = 12) {
  const pts = [];
  for (let i = 0; i <= segments; i++) {
    const t = i / segments;
    const p = new THREE.Vector3().lerpVectors(a, b, t);
    p.y -= Math.sin(Math.PI * t) * sag;
    pts.push(p);
  }
  return pts;
}

/**
 * Recursively enable shadow casting / receiving on a subtree. Transparent
 * meshes are skipped, so glass never drops a hard shadow.
 */
export function shadowify(obj, cast = true, receive = true) {
  obj.traverse((o) => {
    if (!o.isMesh) return;
    const seeThrough = o.userData.noShadow ||
      (o.material && !Array.isArray(o.material) && o.material.transparent);
    o.castShadow = cast && !seeThrough;
    o.receiveShadow = receive;
  });
  return obj;
}

/** Distance from point (px, pz) to segment (ax, az)-(bx, bz), plus the t along it. */
export function segDist(px, pz, ax, az, bx, bz) {
  const dx = bx - ax, dz = bz - az;
  const L2 = dx * dx + dz * dz || 1e-9;
  const t = clamp(((px - ax) * dx + (pz - az) * dz) / L2, 0, 1);
  const qx = ax + dx * t, qz = az + dz * t;
  return { d: Math.hypot(px - qx, pz - qz), t };
}
