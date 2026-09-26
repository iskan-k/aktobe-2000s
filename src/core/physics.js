/* ------------------------------------------------------------------ *
 * Collision and ground height.
 *
 * The town is flat steppe, so "physics" is two small things:
 *
 *   Colliders  2D footprints (axis boxes, rotated boxes, circles) with an
 *              optional vertical range, stored in a spatial hash. The
 *              walker pushes a circle out of them; the player's car
 *              pushes a rotated box out of them.
 *   Ground     raised flat areas (kerbed pavements, porches, platforms)
 *              and ramps (steps are walked as ramps). `heightAt` returns
 *              the highest surface within a step of your current feet,
 *              so an elevated platform can be walked under as well as on.
 *
 * Coordinates: metres, +x east, +z south, +y up.
 * ------------------------------------------------------------------ */

const EPS = 1e-6;

class SpatialHash {
  constructor(cell) {
    this.cell = cell;
    this.map = new Map();
    this.stamp = 0;
  }

  _key(ix, iz) { return ix * 73856093 ^ iz * 19349663; }

  insert(item, x0, z0, x1, z1) {
    const c = this.cell;
    const ix0 = Math.floor(x0 / c), ix1 = Math.floor(x1 / c);
    const iz0 = Math.floor(z0 / c), iz1 = Math.floor(z1 / c);
    for (let ix = ix0; ix <= ix1; ix++) {
      for (let iz = iz0; iz <= iz1; iz++) {
        const k = this._key(ix, iz);
        let list = this.map.get(k);
        if (!list) { list = []; this.map.set(k, list); }
        list.push(item);
      }
    }
  }

  /** Items whose cells overlap the rectangle; each returned once. */
  query(x0, z0, x1, z1, out = []) {
    out.length = 0;
    const c = this.cell;
    const s = ++this.stamp;
    const ix0 = Math.floor(x0 / c), ix1 = Math.floor(x1 / c);
    const iz0 = Math.floor(z0 / c), iz1 = Math.floor(z1 / c);
    for (let ix = ix0; ix <= ix1; ix++) {
      for (let iz = iz0; iz <= iz1; iz++) {
        const list = this.map.get(this._key(ix, iz));
        if (!list) continue;
        for (const it of list) {
          if (it._stamp === s) continue;
          it._stamp = s;
          out.push(it);
        }
      }
    }
    return out;
  }
}

export class Colliders {
  constructor(cell = 8) {
    this.hash = new SpatialHash(cell);
    this.all = [];
    this._scratch = [];
  }

  /**
   * Axis-aligned box footprint. `top` is the height of its top surface
   * (anything lower than a step is walked over), `bottom` the height its
   * underside starts at (a sign 3 m up is not a wall).
   */
  box(x0, z0, x1, z1, { top = Infinity, bottom = -Infinity, tag = '' } = {}) {
    const c = {
      kind: 'box',
      x0: Math.min(x0, x1), x1: Math.max(x0, x1),
      z0: Math.min(z0, z1), z1: Math.max(z0, z1),
      top, bottom, tag,
    };
    this.all.push(c);
    this.hash.insert(c, c.x0, c.z0, c.x1, c.z1);
    return c;
  }

  /** Rotated box: centre, half extents along its own x / z, yaw `ry`. */
  obb(cx, cz, hx, hz, ry, { top = Infinity, bottom = -Infinity, tag = '' } = {}) {
    if (Math.abs(ry) < EPS) return this.box(cx - hx, cz - hz, cx + hx, cz + hz, { top, bottom, tag });
    const cos = Math.cos(ry), sin = Math.sin(ry);
    const ex = Math.abs(hx * cos) + Math.abs(hz * sin);
    const ez = Math.abs(hx * sin) + Math.abs(hz * cos);
    const c = { kind: 'obb', cx, cz, hx, hz, cos, sin, top, bottom, tag };
    this.all.push(c);
    this.hash.insert(c, cx - ex, cz - ez, cx + ex, cz + ez);
    return c;
  }

  /** Round footprint: poles, trunks, bollards. */
  circle(cx, cz, r, { top = Infinity, bottom = -Infinity, tag = '' } = {}) {
    const c = { kind: 'circle', cx, cz, r, top, bottom, tag };
    this.all.push(c);
    this.hash.insert(c, cx - r, cz - r, cx + r, cz + r);
    return c;
  }

  near(x0, z0, x1, z1) {
    return this.hash.query(x0, z0, x1, z1, this._scratch);
  }
}

/**
 * Push a circle (p.x, p.z, radius r) out of one collider. Returns true if it
 * moved. `feetY` and `stepH` decide whether a low collider is stepped over.
 */
export function pushCircle(p, r, c, feetY, stepH = 0.4, headH = 1.8) {
  if (c.top <= feetY + stepH) return false;
  if (c.bottom > feetY + headH) return false;
  if (c.kind === 'box') {
    const qx = Math.max(c.x0, Math.min(p.x, c.x1));
    const qz = Math.max(c.z0, Math.min(p.z, c.z1));
    let dx = p.x - qx, dz = p.z - qz;
    const d2 = dx * dx + dz * dz;
    if (d2 > r * r) return false;
    if (d2 > EPS) {
      const d = Math.sqrt(d2);
      p.x = qx + (dx / d) * r;
      p.z = qz + (dz / d) * r;
      return true;
    }
    // centre is inside the box: leave by the nearest side
    const l = p.x - c.x0, rr = c.x1 - p.x, t = p.z - c.z0, b = c.z1 - p.z;
    const m = Math.min(l, rr, t, b);
    if (m === l) p.x = c.x0 - r;
    else if (m === rr) p.x = c.x1 + r;
    else if (m === t) p.z = c.z0 - r;
    else p.z = c.z1 + r;
    return true;
  }
  if (c.kind === 'circle') {
    const dx = p.x - c.cx, dz = p.z - c.cz;
    const rr = r + c.r;
    const d2 = dx * dx + dz * dz;
    if (d2 >= rr * rr) return false;
    const d = Math.sqrt(d2) || 1e-4;
    p.x = c.cx + (dx / d) * rr;
    p.z = c.cz + (dz / d) * rr;
    return true;
  }
  // obb: go to local space, clamp, come back
  const lx0 = p.x - c.cx, lz0 = p.z - c.cz;
  // local = R(-ry) * world. With three.js yaw, local x axis in world is (cos, -sin).
  const lx = lx0 * c.cos - lz0 * c.sin;
  const lz = lx0 * c.sin + lz0 * c.cos;
  const qx = Math.max(-c.hx, Math.min(lx, c.hx));
  const qz = Math.max(-c.hz, Math.min(lz, c.hz));
  let dx = lx - qx, dz = lz - qz;
  const d2 = dx * dx + dz * dz;
  if (d2 > r * r) return false;
  let nx, nz;
  if (d2 > EPS) {
    const d = Math.sqrt(d2);
    nx = qx + (dx / d) * r;
    nz = qz + (dz / d) * r;
  } else {
    const l = lx + c.hx, rr = c.hx - lx, t = lz + c.hz, b = c.hz - lz;
    const m = Math.min(l, rr, t, b);
    nx = lx; nz = lz;
    if (m === l) nx = -c.hx - r;
    else if (m === rr) nx = c.hx + r;
    else if (m === t) nz = -c.hz - r;
    else nz = c.hz + r;
  }
  p.x = c.cx + nx * c.cos + nz * c.sin;
  p.z = c.cz - nx * c.sin + nz * c.cos;
  return true;
}

/** Is (x, z) inside the collider's footprint, grown by `margin`? */
export function colliderContains(c, x, z, margin = 0) {
  if (c.kind === 'box') {
    return x >= c.x0 - margin && x <= c.x1 + margin && z >= c.z0 - margin && z <= c.z1 + margin;
  }
  if (c.kind === 'circle') {
    const dx = x - c.cx, dz = z - c.cz, r = c.r + margin;
    return dx * dx + dz * dz <= r * r;
  }
  const lx0 = x - c.cx, lz0 = z - c.cz;
  const lx = lx0 * c.cos - lz0 * c.sin;
  const lz = lx0 * c.sin + lz0 * c.cos;
  return Math.abs(lx) <= c.hx + margin && Math.abs(lz) <= c.hz + margin;
}

/**
 * Corners of a rotated rectangle, in world space. Used for car-vs-world
 * contacts: each corner and each edge midpoint is pushed like a small
 * circle, which is enough for a car that is mostly a box.
 */
export function rectProbes(cx, cz, hx, hz, ry, out = []) {
  out.length = 0;
  const cos = Math.cos(ry), sin = Math.sin(ry);
  const pts = [
    [hx, hz], [-hx, hz], [hx, -hz], [-hx, -hz],
    [hx, 0], [-hx, 0], [0, hz], [0, -hz],
    [hx * 0.5, hz], [-hx * 0.5, hz], [hx * 0.5, -hz], [-hx * 0.5, -hz],
  ];
  for (const [lx, lz] of pts) {
    out.push({ x: cx + lx * cos + lz * sin, z: cz - lx * sin + lz * cos, lx, lz });
  }
  return out;
}

/* ------------------------------------------------------------------ *
 * Ground
 * ------------------------------------------------------------------ */

export class Ground {
  constructor(cell = 8) {
    this.hash = new SpatialHash(cell);
    this._scratch = [];
    this.base = 0;
  }

  /** Flat raised rectangle, top at `y`. */
  flat(x0, z0, x1, z1, y, tag = '') {
    const s = {
      kind: 'flat', x0: Math.min(x0, x1), x1: Math.max(x0, x1),
      z0: Math.min(z0, z1), z1: Math.max(z0, z1), y, tag,
    };
    this.hash.insert(s, s.x0, s.z0, s.x1, s.z1);
    return s;
  }

  /**
   * Ramp: height goes from y0 to y1 along `axis` ('x' or 'z'), from the
   * low coordinate side to the high one. Stairs are walked as ramps.
   */
  ramp(x0, z0, x1, z1, y0, y1, axis = 'z', tag = '') {
    const s = {
      kind: 'ramp', x0: Math.min(x0, x1), x1: Math.max(x0, x1),
      z0: Math.min(z0, z1), z1: Math.max(z0, z1), y0, y1, axis, tag,
    };
    this.hash.insert(s, s.x0, s.z0, s.x1, s.z1);
    return s;
  }

  _surfaceY(s, x, z) {
    if (s.kind === 'flat') return s.y;
    const t = s.axis === 'x'
      ? (x - s.x0) / Math.max(s.x1 - s.x0, EPS)
      : (z - s.z0) / Math.max(s.z1 - s.z0, EPS);
    return s.y0 + (s.y1 - s.y0) * Math.max(0, Math.min(1, t));
  }

  /**
   * Height of the ground at (x, z). With `fromY`, surfaces more than a step
   * above the current feet are ignored, so you walk under a bridge deck.
   */
  heightAt(x, z, fromY = Infinity, step = 0.45) {
    let best = this.base;
    const list = this.hash.query(x, z, x, z, this._scratch);
    for (const s of list) {
      if (x < s.x0 || x > s.x1 || z < s.z0 || z > s.z1) continue;
      const y = this._surfaceY(s, x, z);
      if (y > fromY + step) continue;
      if (y > best) best = y;
    }
    return best;
  }
}
