import * as THREE from 'three';

/* ------------------------------------------------------------------ *
 * Geometry for the animals.
 *
 * Bodies are swept tubes: a path of stations, each with its own side
 * and vertical radius, so a torso gets a deep chest, a tucked belly and
 * a round rump from one smooth surface. Every vertex carries, besides
 * its position and normal:
 *
 *   color      a tone that multiplies the coat colour (1 = plain coat),
 *              or, with `fixed`, the final colour (eyes, nose, hooves,
 *              straps)
 *   fur        four marking weights: x chest and belly, y paws and
 *              socks, z face, w dark (saddle, points, stripes). The
 *              shader in herd.js mixes the animal's own coat colours by
 *              these, so one mesh draws any coat pattern.
 *   fixedTone  1 where `color` is final
 * ------------------------------------------------------------------ */

const _v = new THREE.Vector3();
const _n = new THREE.Vector3();
const _c = new THREE.Color();
const _nm = new THREE.Matrix3();

/** Accumulates painted pieces into one BufferGeometry. */
export class Geo {
  constructor() {
    this.pos = []; this.nor = []; this.col = []; this.fur = []; this.fix = [];
  }

  /**
   * Add a geometry. `paint` is { color = 0xffffff, fixed = false, fur }
   * where fur is [x, y, z, w] or (p, n) => [x, y, z, w] in the piece's
   * own coordinates after `matrix`.
   */
  add(g, paint = {}, matrix = null) {
    const { color = 0xffffff, fixed = false, fur = null } = paint;
    const src = g.index ? g.toNonIndexed() : g;
    if (!src.attributes.normal) src.computeVertexNormals();
    const P = src.attributes.position, N = src.attributes.normal;
    if (matrix) _nm.getNormalMatrix(matrix);
    _c.set(color);
    const furFn = typeof fur === 'function' ? fur : null;
    const furK = furFn ? null : (fur || [0, 0, 0, 0]);
    for (let i = 0; i < P.count; i++) {
      _v.fromBufferAttribute(P, i);
      _n.fromBufferAttribute(N, i);
      if (matrix) { _v.applyMatrix4(matrix); _n.applyMatrix3(_nm).normalize(); }
      this.pos.push(_v.x, _v.y, _v.z);
      this.nor.push(_n.x, _n.y, _n.z);
      this.col.push(_c.r, _c.g, _c.b);
      const f = furFn ? furFn(_v, _n) : furK;
      this.fur.push(f[0], f[1], f[2], f[3]);
      this.fix.push(fixed ? 1 : 0);
    }
    return this;
  }

  build() {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(this.nor, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(this.col, 3));
    g.setAttribute('fur', new THREE.Float32BufferAttribute(this.fur, 4));
    g.setAttribute('fixedTone', new THREE.Float32BufferAttribute(this.fix, 1));
    g.computeBoundingSphere();
    return g;
  }
}

/**
 * A smooth tube through `path`, a list of { p: [x, y, z], rx, ry } where
 * rx is the half width across the path and ry the half height (toward
 * +y, or toward -z where the path runs vertically). `seg` points per
 * ring. Ends are closed with a rounded cap unless the radius is tiny.
 */
export function sweep(path0, seg = 10, { flatBottom = 0, sub = 1 } = {}) {
  const path = sub > 1 ? subdivide(path0, sub) : path0;
  const pts = path.map((s) => new THREE.Vector3(...s.p));
  const n = pts.length;
  const tangents = pts.map((p, i) => {
    const a = pts[Math.max(0, i - 1)], b = pts[Math.min(n - 1, i + 1)];
    return new THREE.Vector3().subVectors(b, a).normalize();
  });
  // parallel-transported frame, starting from world up (or forward if
  // the path starts vertical)
  const up = Math.abs(tangents[0].y) > 0.9 ? new THREE.Vector3(0, 0, -1) : new THREE.Vector3(0, 1, 0);
  const normals = [], binormals = [];
  let N = up.clone().sub(tangents[0].clone().multiplyScalar(up.dot(tangents[0]))).normalize();
  for (let i = 0; i < n; i++) {
    const T = tangents[i];
    N = N.sub(T.clone().multiplyScalar(N.dot(T))).normalize();
    normals.push(N.clone());
    binormals.push(new THREE.Vector3().crossVectors(T, N).normalize());
  }
  const pos = [];
  const idx = [];
  for (let i = 0; i < n; i++) {
    const { rx, ry } = path[i];
    for (let k = 0; k < seg; k++) {
      const a = (k / seg) * Math.PI * 2;
      let sy = Math.sin(a);
      // a flatter underside for bellies and chests that sit on the ground
      if (flatBottom && sy < 0) sy *= 1 - flatBottom;
      const q = pts[i].clone()
        .addScaledVector(binormals[i], Math.cos(a) * rx)
        .addScaledVector(normals[i], sy * ry);
      pos.push(q.x, q.y, q.z);
    }
  }
  for (let i = 0; i < n - 1; i++) {
    for (let k = 0; k < seg; k++) {
      const a = i * seg + k, b = i * seg + ((k + 1) % seg);
      const c = a + seg, d = b + seg;
      idx.push(a, c, b, b, c, d);
    }
  }
  // rounded caps: a point pushed out along the tangent
  const cap = (i, dir) => {
    const r = Math.min(path[i].rx, path[i].ry);
    if (r < 0.004) return;
    const c = pts[i].clone().addScaledVector(tangents[i], dir * r * 0.6);
    const ci = pos.length / 3;
    pos.push(c.x, c.y, c.z);
    for (let k = 0; k < seg; k++) {
      const a = i * seg + k, b = i * seg + ((k + 1) % seg);
      if (dir > 0) idx.push(b, a, ci); else idx.push(a, b, ci);
    }
  };
  cap(0, -1);
  cap(n - 1, 1);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

/**
 * Catmull-Rom through the stations, `k` rings per span: a smoother
 * outline, and enough vertices for painted markings to stay soft.
 */
function subdivide(path, k) {
  const n = path.length;
  const at = (i) => path[Math.max(0, Math.min(n - 1, i))];
  const cr = (a, b, c, d, t) => 0.5 * ((2 * b) + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t * t + (-a + 3 * b - 3 * c + d) * t * t * t);
  const out = [];
  for (let i = 0; i < n - 1; i++) {
    const [a, b, c, d] = [at(i - 1), at(i), at(i + 1), at(i + 2)];
    for (let s = 0; s < k; s++) {
      const t = s / k;
      out.push({
        p: [0, 1, 2].map((q) => cr(a.p[q], b.p[q], c.p[q], d.p[q], t)),
        rx: Math.max(0.001, cr(a.rx, b.rx, c.rx, d.rx, t)),
        ry: Math.max(0.001, cr(a.ry, b.ry, c.ry, d.ry, t)),
      });
    }
  }
  out.push(path[n - 1]);
  return out;
}

/** Ellipsoid at (x, y, z). */
export function ell(rx, ry, rz, x = 0, y = 0, z = 0, seg = 10) {
  const g = new THREE.SphereGeometry(1, seg, Math.max(5, Math.round(seg * 0.7)));
  g.scale(rx, ry, rz);
  g.translate(x, y, z);
  return g;
}

/** Tapered cone from base centre (x, y, z), pointing along +y before rotation. */
export function cone(r, h, x, y, z, rx = 0, ry = 0, rz = 0, seg = 6) {
  const g = new THREE.ConeGeometry(r, h, seg, 1);
  g.translate(0, h / 2, 0);
  g.rotateX(rx); g.rotateY(ry); g.rotateZ(rz);
  g.translate(x, y, z);
  return g;
}

/** Torus ring (straps, collars) in the xz plane before rotation. */
export function ring(R, r, x, y, z, rx = 0, ry = 0, rz = 0) {
  const g = new THREE.TorusGeometry(R, r, 4, 14);
  g.rotateX(Math.PI / 2 + rx); g.rotateY(ry); g.rotateZ(rz);
  g.translate(x, y, z);
  return g;
}

export function box(w, h, d, x, y, z, rx = 0, ry = 0, rz = 0) {
  const g = new THREE.BoxGeometry(w, h, d);
  g.rotateX(rx); g.rotateY(ry); g.rotateZ(rz);
  g.translate(x, y, z);
  return g;
}

/** Smooth 0..1 ramp. */
export function ramp(a, b, v) {
  const t = Math.min(1, Math.max(0, (v - a) / (b - a)));
  return t * t * (3 - 2 * t);
}

/**
 * Stations for a torso, from rump (+z) to chest (-z): rows of
 * [z, top, bottom, halfWidth]. Returns a path for sweep().
 */
export function torsoPath(rows) {
  return rows.map(([z, top, bot, rx]) => ({ p: [0, (top + bot) / 2, z], rx, ry: (top - bot) / 2 }));
}

/** A limb from (0,0,0) down through `pts` ([x, y, z, r] rows). */
export function limbPath(rows) {
  return rows.map(([x, y, z, rx, ry = rx]) => ({ p: [x, y, z], rx, ry }));
}
