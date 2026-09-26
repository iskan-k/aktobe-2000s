import * as THREE from 'three';

/* ------------------------------------------------------------------ *
 * Tracks for aircraft to follow: sampled polylines with arc length.
 *
 *   groundTrack(points, radius)  a taxi route: corners rounded with a
 *                                quadratic curve of about `radius`
 *   airTrack(points)             a smooth 3D curve through the points
 *
 * `track.at(s, out)` gives the position and the unit tangent at arc
 * length s; `track.vcap(vmax, decel, vEnd)` precomputes the fastest
 * speed at each sample that can still brake for every later limit.
 * ------------------------------------------------------------------ */

export class Track {
  constructor(pts) {
    const n = pts.length;
    this.x = new Float32Array(n);
    this.y = new Float32Array(n);
    this.z = new Float32Array(n);
    this.s = new Float32Array(n);
    let s = 0;
    for (let i = 0; i < n; i++) {
      const p = pts[i];
      if (i) s += Math.hypot(p.x - pts[i - 1].x, p.y - pts[i - 1].y, p.z - pts[i - 1].z);
      this.x[i] = p.x; this.y[i] = p.y; this.z[i] = p.z; this.s[i] = s;
    }
    this.length = s;
    this.n = n;
  }

  /** Index of the segment containing s. */
  seg(s) {
    let lo = 0, hi = this.n - 1;
    while (hi - lo > 1) {
      const m = (lo + hi) >> 1;
      if (this.s[m] <= s) lo = m; else hi = m;
    }
    return lo;
  }

  at(s, out = {}) {
    const cs = Math.max(0, Math.min(this.length, s));
    const i = this.seg(cs), j = Math.min(i + 1, this.n - 1);
    const ds = this.s[j] - this.s[i] || 1;
    const f = (cs - this.s[i]) / ds;
    out.x = this.x[i] + (this.x[j] - this.x[i]) * f;
    out.y = this.y[i] + (this.y[j] - this.y[i]) * f;
    out.z = this.z[i] + (this.z[j] - this.z[i]) * f;
    // tangent: blend the directions of this segment and its neighbours
    const t0 = this.dir(i), t1 = f < 0.5 ? this.dir(Math.max(0, i - 1)) : this.dir(Math.min(this.n - 2, i + 1));
    const w = f < 0.5 ? 0.5 - f : f - 0.5;
    out.tx = t0[0] * (1 - w) + t1[0] * w;
    out.ty = t0[1] * (1 - w) + t1[1] * w;
    out.tz = t0[2] * (1 - w) + t1[2] * w;
    const l = Math.hypot(out.tx, out.ty, out.tz) || 1;
    out.tx /= l; out.ty /= l; out.tz /= l;
    return out;
  }

  dir(i) {
    const j = Math.min(i + 1, this.n - 1), k = j === i ? i - 1 : i;
    const dx = this.x[j] - this.x[k], dy = this.y[j] - this.y[k], dz = this.z[j] - this.z[k];
    const l = Math.hypot(dx, dy, dz) || 1;
    return [dx / l, dy / l, dz / l];
  }

  /**
   * Speed caps: vmax(i, track) per sample, then a backward pass so the
   * aircraft can always brake at `decel` for the next limit.
   */
  vcap(vmax, decel, vEnd = 0) {
    const cap = new Float32Array(this.n);
    cap[this.n - 1] = Math.min(vmax(this.n - 1, this), vEnd);
    for (let i = this.n - 2; i >= 0; i--) {
      const ds = this.s[i + 1] - this.s[i];
      cap[i] = Math.min(vmax(i, this), Math.sqrt(cap[i + 1] * cap[i + 1] + 2 * decel * ds));
    }
    this.caps = cap;
    return this;
  }

  capAt(s) {
    const i = this.seg(Math.max(0, Math.min(this.length, s)));
    const j = Math.min(i + 1, this.n - 1);
    const f = (s - this.s[i]) / ((this.s[j] - this.s[i]) || 1);
    return this.caps[i] + (this.caps[j] - this.caps[i]) * Math.max(0, Math.min(1, f));
  }

  /** Horizontal turn radius at sample i (Infinity on a straight). */
  radius(i) {
    if (i <= 0 || i >= this.n - 1) return Infinity;
    const a = this.dir(i - 1), b = this.dir(i);
    const ang = Math.abs(Math.atan2(a[0] * b[2] - a[2] * b[0], a[0] * b[0] + a[2] * b[2]));
    const ds = (this.s[i + 1] - this.s[i - 1]) / 2;
    return ang < 1e-4 ? Infinity : ds / ang;
  }
}

/**
 * A ground route through [x, z] points, corners rounded: each corner is
 * cut back by up to `radius` on both sides and joined by a quadratic.
 */
export function groundTrack(points, radius = 25, step = 1.5) {
  const out = [];
  const P = points.map(([x, z]) => new THREE.Vector2(x, z));
  const push = (v) => out.push({ x: v.x, y: 0, z: v.y });
  const line = (a, b) => {
    const n = Math.max(1, Math.ceil(a.distanceTo(b) / step));
    for (let i = out.length ? 1 : 0; i <= n; i++) push(a.clone().lerp(b, i / n));
  };
  let from = P[0];
  for (let i = 1; i < P.length - 1; i++) {
    const A = P[i - 1], C = P[i + 1], Bv = P[i];
    const cut = Math.min(radius, Bv.distanceTo(A) / 2, Bv.distanceTo(C) / 2);
    const p1 = Bv.clone().add(A.clone().sub(Bv).setLength(cut));
    const p2 = Bv.clone().add(C.clone().sub(Bv).setLength(cut));
    line(from, p1);
    const n = Math.max(4, Math.ceil((cut * 1.6) / step));
    for (let k = 1; k <= n; k++) {
      const t = k / n, u = 1 - t;
      push(new THREE.Vector2(
        u * u * p1.x + 2 * u * t * Bv.x + t * t * p2.x,
        u * u * p1.y + 2 * u * t * Bv.y + t * t * p2.y,
      ));
    }
    from = p2;
  }
  line(from, P[P.length - 1]);
  return new Track(out);
}

/** A smooth air route through [x, y, z] points, sampled about every `step` metres. */
export function airTrack(points, step = 8) {
  const curve = new THREE.CatmullRomCurve3(points.map(([x, y, z]) => new THREE.Vector3(x, y, z)), false, 'centripetal');
  const n = Math.max(8, Math.ceil(curve.getLength() / step));
  return new Track(curve.getSpacedPoints(n));
}

/** Join tracks end to end (the first point of each later track is dropped). */
export function joinTracks(...tracks) {
  const pts = [];
  tracks.forEach((t, k) => {
    for (let i = k ? 1 : 0; i < t.n; i++) pts.push({ x: t.x[i], y: t.y[i], z: t.z[i] });
  });
  return new Track(pts);
}
