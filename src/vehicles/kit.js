import * as THREE from 'three';
import { Batch } from '../core/batch.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { cel } from '../core/toon.js';

/* ------------------------------------------------------------------ *
 * Vehicle modelling kit.
 *
 * Every vehicle is authored in its own local frame: origin on the ground
 * at the centre of the footprint, front toward -z, driver's right +x.
 * Parts are collected in a `Parts` bag and merged into as few meshes as
 * possible:
 *
 *   body   one vertex-coloured cel mesh. It also carries the number
 *          plates, because its material samples a shared canvas atlas:
 *          ordinary parts point their uv at a white patch, plates at
 *          their own slot. So plates cost no extra draw call.
 *   glass  one transparent, double-sided mesh, so you can see into a car
 *          from the street and out of a bus from a seat.
 *
 * Side profiles are the main modelling tool: a car's silhouette is a
 * top line and a bottom line in (z, y), extruded across the width
 * (`slab`). Greenhouses are side frames with window holes cut in them
 * (`greenhouse`), leaning in with the tumblehome, plus roof, windscreen
 * and rear glass, so the cabin is hollow and see-through.
 * ------------------------------------------------------------------ */

/* ------------------------------------------------------------ atlas */

const ATLAS_W = 2048, ATLAS_H = 2048;
const WHITE_PX = 96;

function makeAtlas() {
  const canvas = document.createElement('canvas');
  canvas.width = ATLAS_W;
  canvas.height = ATLAS_H;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#808080';
  ctx.fillRect(0, 0, ATLAS_W, ATLAS_H);
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, WHITE_PX, WHITE_PX);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  tex.generateMipmaps = true;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  const slots = new Map();
  // shelf packer, starting to the right of the white patch
  let sx = WHITE_PX + 4, sy = 0, shelfH = WHITE_PX;
  let dirty = false;
  return {
    canvas, ctx, tex,
    /** uv of the white patch centre */
    white: [WHITE_PX / 2 / ATLAS_W, 1 - WHITE_PX / 2 / ATLAS_H],
    /**
     * Reserve (once per key) a w x h px slot, paint it with draw(ctx, x, y, w, h),
     * and return its uv rectangle { u0, v0, u1, v1 } (v0 = bottom).
     */
    slot(key, w, h, draw) {
      if (slots.has(key)) return slots.get(key);
      if (sx + w > ATLAS_W) { sx = 0; sy += shelfH + 4; shelfH = 0; }
      if (sy + h > ATLAS_H) {
        console.warn('[vehicles] texture atlas full');
        return { u0: 0, v0: 1, u1: 0.01, v1: 0.99 };
      }
      const x = sx, y = sy;
      sx += w + 4;
      shelfH = Math.max(shelfH, h);
      ctx.save();
      ctx.beginPath();
      ctx.rect(x, y, w, h);
      ctx.clip();
      draw(ctx, x, y, w, h);
      ctx.restore();
      // half-texel inset so neighbours do not bleed at the edges
      const r = {
        u0: (x + 1) / ATLAS_W, u1: (x + w - 1) / ATLAS_W,
        v1: 1 - (y + 1) / ATLAS_H, v0: 1 - (y + h - 1) / ATLAS_H,
      };
      slots.set(key, r);
      dirty = true;
      tex.needsUpdate = true;
      return r;
    },
    flushed() { const d = dirty; dirty = false; return d; },
  };
}

export const ATLAS = makeAtlas();

/* ------------------------------------------------------------ lenses */

/*
 * Lamp lenses painted into the atlas: fluted red and amber plastic,
 * the pale reversing lens, and the reflector of a headlamp behind its
 * ribbed glass. A lens is a decal on the face of its lamp box, so it
 * costs nothing extra to draw.
 */
const LENS = {
  red: ['#a3221c', '#c9372b', '#841914'],
  amber: ['#d8892a', '#f0a847', '#b46b1b'],
  white: ['#d9d5ca', '#f3f0e8', '#b3afa4'],
  smoke: ['#5e2420', '#7a332c', '#471a17'],
};

function paintFlutes(ctx, x0, y0, w, h, [base, hi, lo]) {
  ctx.fillStyle = base;
  ctx.fillRect(x0, y0, w, h);
  for (let x = 0; x < w; x += 6) {
    ctx.fillStyle = hi;
    ctx.fillRect(x0 + x, y0, 2, h);
    ctx.fillStyle = lo;
    ctx.fillRect(x0 + x + 3, y0, 2, h);
  }
  for (let y = 0; y < h; y += 10) {
    ctx.fillStyle = 'rgba(0,0,0,0.12)';
    ctx.fillRect(x0, y0 + y, w, 1);
  }
  // a soft highlight across the top, darker toward the edges
  const g = ctx.createLinearGradient(0, y0, 0, y0 + h);
  g.addColorStop(0, 'rgba(255,255,255,0.35)');
  g.addColorStop(0.35, 'rgba(255,255,255,0.05)');
  g.addColorStop(1, 'rgba(0,0,0,0.2)');
  ctx.fillStyle = g;
  ctx.fillRect(x0, y0, w, h);
  ctx.strokeStyle = 'rgba(0,0,0,0.35)';
  ctx.lineWidth = 3;
  ctx.strokeRect(x0 + 1.5, y0 + 1.5, w - 3, h - 3);
}

/** uv rect of a lens texture: 'red' | 'amber' | 'white' | 'smoke' | 'head' | 'round'. */
export function lensUV(kind) {
  if (kind === 'head') {
    return ATLAS.slot('lens-head', 96, 48, (ctx, x0, y0, w, h) => {
      const g = ctx.createRadialGradient(x0 + w / 2, y0 + h / 2, 2, x0 + w / 2, y0 + h / 2, w * 0.55);
      g.addColorStop(0, '#fffbea');
      g.addColorStop(0.25, '#e7e6df');
      g.addColorStop(0.7, '#a9aba7');
      g.addColorStop(1, '#6d6f6d');
      ctx.fillStyle = g;
      ctx.fillRect(x0, y0, w, h);
      ctx.fillStyle = 'rgba(255,255,255,0.28)';
      for (let y = 3; y < h; y += 5) ctx.fillRect(x0, y0 + y, w, 1);
      ctx.fillStyle = 'rgba(40,40,40,0.25)';
      for (let x = 4; x < w; x += 8) ctx.fillRect(x0 + x, y0, 1, h);
      ctx.strokeStyle = 'rgba(0,0,0,0.4)';
      ctx.lineWidth = 3;
      ctx.strokeRect(x0 + 1.5, y0 + 1.5, w - 3, h - 3);
    });
  }
  if (kind === 'round') {
    return ATLAS.slot('lens-round', 64, 64, (ctx, x0, y0, w, h) => {
      const cx = x0 + w / 2, cy = y0 + h / 2;
      const g = ctx.createRadialGradient(cx, cy, 1, cx, cy, w / 2);
      g.addColorStop(0, '#fffbea');
      g.addColorStop(0.3, '#dcdcd4');
      g.addColorStop(0.85, '#8e908c');
      g.addColorStop(1, '#4f504e');
      ctx.fillStyle = g;
      ctx.fillRect(x0, y0, w, h);
      ctx.strokeStyle = 'rgba(255,255,255,0.3)';
      ctx.lineWidth = 1;
      for (let r = 6; r < w / 2; r += 5) { ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.stroke(); }
      ctx.fillStyle = 'rgba(255,255,255,0.45)';
      ctx.beginPath(); ctx.ellipse(cx - 9, cy - 11, 8, 4, -0.5, 0, Math.PI * 2); ctx.fill();
    });
  }
  return ATLAS.slot('lens-' + kind, 64, 48, (ctx, x0, y0, w, h) => paintFlutes(ctx, x0, y0, w, h, LENS[kind] || LENS.red));
}

/* ------------------------------------------------------------ materials */

export const VMAT = {
  // dusty skirt: the steppe gets onto every sill and bumper
  body: cel({ vertexColors: true, map: ATLAS.tex, grime: 0.025, dirt: 0.55, dirtH: 0.62, cache: false }),
  glass: cel({
    vertexColors: true, transparent: true, opacity: 0.52, depthWrite: false,
    side: THREE.DoubleSide, grime: 0, dirt: 0, bands: 3, cache: false,
  }),
  brake: new THREE.MeshBasicMaterial({ color: 0xff2618 }),
  blink: new THREE.MeshBasicMaterial({ color: 0xffa51c }),
};
VMAT.body.name = 'vehicle-body';
VMAT.glass.name = 'vehicle-glass';

/** Glass tints. */
export const GLASS = {
  clear: 0x86a2b6,
  tint: 0x647d90,
  dark: 0x44545f,
  bus: 0x97b0bd,
};

/** Window rubber and the headliner seen through the glass. */
export const RUBBER_SEAL = 0x18191a;
export const HEADLINER = 0xb7ae9e;

/* ------------------------------------------------------------ geometry helpers */

const _m = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _e = new THREE.Euler();
const _p = new THREE.Vector3();
const _s = new THREE.Vector3();

export const UNIT = (() => {
  const g = new THREE.BoxGeometry(1, 1, 1);
  g.deleteAttribute('uv');
  return g;
})();

const cylCache = new Map();
function unitCyl(seg, open = false) {
  const k = seg + (open ? 'o' : '');
  if (!cylCache.has(k)) {
    const g = new THREE.CylinderGeometry(1, 1, 1, seg, 1, open);
    g.deleteAttribute('uv');
    cylCache.set(k, g);
  }
  return cylCache.get(k);
}

const discCache = new Map();
function discGeo(seg) {
  if (!discCache.has(seg)) discCache.set(seg, new THREE.CircleGeometry(1, seg));
  return discCache.get(seg);
}

const sphCache = new Map();
function unitSphere(detail = 1) {
  if (!sphCache.has(detail)) {
    const g = new THREE.IcosahedronGeometry(1, detail);
    g.deleteAttribute('uv');
    sphCache.set(detail, g);
  }
  return sphCache.get(detail);
}

function fillUv(g, u, v) {
  const n = g.attributes.position.count;
  const a = new Float32Array(n * 2);
  for (let i = 0; i < n; i++) { a[i * 2] = u; a[i * 2 + 1] = v; }
  g.setAttribute('uv', new THREE.BufferAttribute(a, 2));
}

/** Flip every triangle of a geometry (after a mirroring transform). */
export function flipWinding(g) {
  if (g.index) {
    const a = g.index.array;
    for (let i = 0; i < a.length; i += 3) { const t = a[i + 1]; a[i + 1] = a[i + 2]; a[i + 2] = t; }
    g.index.needsUpdate = true;
    return g;
  }
  for (const name of Object.keys(g.attributes)) {
    const at = g.attributes[name];
    const n = at.itemSize;
    for (let i = 0; i < at.count; i += 3) {
      for (let c = 0; c < n; c++) {
        const t = at.array[(i + 1) * n + c];
        at.array[(i + 1) * n + c] = at.array[(i + 2) * n + c];
        at.array[(i + 2) * n + c] = t;
      }
    }
    at.needsUpdate = true;
  }
  return g;
}

/** Apply fn(v: Vector3) to every vertex; flip winding if the map mirrors. */
export function mapGeo(g, fn, mirrored) {
  const p = g.attributes.position;
  const v = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i);
    fn(v);
    p.setXYZ(i, v.x, v.y, v.z);
  }
  p.needsUpdate = true;
  if (mirrored) flipWinding(g);
  g.deleteAttribute('normal');
  g.computeVertexNormals();
  return g;
}

/** Value of a polyline [[z, y], ...] (sorted by z) at z. */
export function lineAt(line, z) {
  if (z <= line[0][0]) return line[0][1];
  for (let i = 1; i < line.length; i++) {
    if (z <= line[i][0]) {
      const [z0, y0] = line[i - 1], [z1, y1] = line[i];
      return y0 + (y1 - y0) * ((z - z0) / (z1 - z0 || 1e-6));
    }
  }
  return line[line.length - 1][1];
}

/** The part of a polyline between z0 and z1, with interpolated ends. */
function clipLine(line, z0, z1) {
  const out = [[z0, lineAt(line, z0)]];
  for (const [z, y] of line) if (z > z0 + 1e-4 && z < z1 - 1e-4) out.push([z, y]);
  out.push([z1, lineAt(line, z1)]);
  return out;
}

/**
 * Bottom line of a car body: sill height with a semicircular arch over
 * every wheel. `wheels` is [{ z, r }]; arches are r + gap in radius.
 */
export function bottomLine(zFront, zRear, yFront, yRear, sill, wheels, gap = 0.05) {
  const pts = [[zFront, yFront]];
  const sorted = [...wheels].sort((a, b) => a.z - b.z);
  for (const w of sorted) {
    const ra = w.r + gap;
    const n = 9;
    pts.push([w.z - ra - 0.02, sill]);
    for (let i = 0; i <= n; i++) {
      const a = Math.PI - (i / n) * Math.PI;
      pts.push([w.z + Math.cos(a) * ra, w.r + Math.sin(a) * ra]);
    }
    pts.push([w.z + ra + 0.02, sill]);
  }
  pts.push([zRear, yRear]);
  // keep it monotone in z
  return pts.sort((a, b) => a[0] - b[0]);
}

/* ------------------------------------------------------------ polygon clipping */

/** Sutherland-Hodgman clip of a convex/concave polygon by f(p) >= 0 (f linear). */
function clipBy(poly, f) {
  const out = [];
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i], b = poly[(i + 1) % poly.length];
    const fa = f(a), fb = f(b);
    if (fa >= 0) out.push(a);
    if ((fa >= 0) !== (fb >= 0)) {
      const t = fa / (fa - fb);
      out.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]);
    }
  }
  return out;
}

/** Signed distance-like function: which side of the line p0 -> p1 a point is, measured along z. */
function zOffsetFromLine(p0, p1, shift) {
  // line z(y) = z0 + (y - y0) / (y1 - y0) * (z1 - z0); returns z - zLine(y) - shift
  return (p) => {
    const t = (p[1] - p0[1]) / ((p1[1] - p0[1]) || 1e-6);
    return p[0] - (p0[0] + t * (p1[0] - p0[0])) - shift;
  };
}

/**
 * Grow a convex polygon [[z, y], ...] by d on every edge (either winding),
 * for the rubber seal round a window.
 */
export function growPoly(poly, d) {
  let area = 0;
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i], b = poly[(i + 1) % poly.length];
    area += a[0] * b[1] - b[0] * a[1];
  }
  const sgn = area > 0 ? 1 : -1;
  const lines = poly.map((a, i) => {
    const b = poly[(i + 1) % poly.length];
    const dx = b[0] - a[0], dy = b[1] - a[1];
    const len = Math.hypot(dx, dy) || 1;
    const nx = (dy / len) * sgn, ny = (-dx / len) * sgn;
    return { p: [a[0] + nx * d, a[1] + ny * d], v: [dx, dy] };
  });
  return lines.map((l1, i) => {
    const l0 = lines[(i + poly.length - 1) % poly.length];
    const den = l0.v[0] * l1.v[1] - l0.v[1] * l1.v[0];
    if (Math.abs(den) < 1e-9) return l1.p;
    const t = ((l1.p[0] - l0.p[0]) * l1.v[1] - (l1.p[1] - l0.p[1]) * l1.v[0]) / den;
    return [l0.p[0] + l0.v[0] * t, l0.p[1] + l0.v[1] * t];
  });
}

/* ------------------------------------------------------------ parts */

export class Parts {
  constructor() {
    // one cell for everything: with a finite cell, parts left of the origin
    // would floor into cell -1 and split the vehicle into several meshes
    this.body = new Batch({ cell: Infinity, name: 'veh-body' });
    this.glassB = new Batch({ cell: Infinity, name: 'veh-glass' });
    this.count = 0;
  }

  /** Add a geometry (not modified) with a colour and optional matrix. */
  add(geo, color, matrix = null, { glass = false, uv = null, cast = true } = {}) {
    const g = geo.clone();
    if (matrix) g.applyMatrix4(matrix);
    if (glass) {
      g.deleteAttribute('uv');
      this.glassB.add(g, { color, mat: VMAT.glass, cast: false });
    } else {
      if (uv) {
        const a = g.attributes.uv;
        for (let i = 0; i < a.count; i++) {
          a.setXY(i, uv.u0 + a.getX(i) * (uv.u1 - uv.u0), uv.v0 + a.getY(i) * (uv.v1 - uv.v0));
        }
      } else fillUv(g, ATLAS.white[0], ATLAS.white[1]);
      this.body.add(g, { color: uv ? 0xffffff : color, mat: VMAT.body, cast });
    }
    this.count++;
    return this;
  }

  _mat(x, y, z, sx, sy, sz, rx = 0, ry = 0, rz = 0) {
    _p.set(x, y, z);
    _e.set(rx, ry, rz, 'YXZ');
    _q.setFromEuler(_e);
    _s.set(sx, sy, sz);
    return _m.compose(_p, _q, _s);
  }

  /** Box centred at (x, y, z). */
  box(w, h, d, color, x, y, z, o = {}) {
    return this.add(UNIT, color, this._mat(x, y, z, w, h, d, o.rx, o.ry, o.rz), o);
  }

  /** Box from corner to corner (axis aligned). */
  span(x0, y0, z0, x1, y1, z1, color, o = {}) {
    return this.box(Math.abs(x1 - x0), Math.abs(y1 - y0), Math.abs(z1 - z0), color,
      (x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2, o);
  }

  /** Mirrored pair of boxes at +-x. */
  pair(w, h, d, color, x, y, z, o = {}) {
    this.box(w, h, d, color, x, y, z, o);
    return this.box(w, h, d, color, -x, y, z, { ...o, ry: o.ry ? -o.ry : 0, rz: o.rz ? -o.rz : 0 });
  }

  /** Cylinder centred at (x, y, z) along `axis`. */
  cyl(r, len, color, x, y, z, { axis = 'y', seg = 10, open = false, rx = 0, ry = 0, rz = 0, ...o } = {}) {
    const m = new THREE.Matrix4();
    const rot = new THREE.Matrix4();
    if (axis === 'x') rot.makeRotationZ(Math.PI / 2);
    else if (axis === 'z') rot.makeRotationX(Math.PI / 2);
    m.makeScale(r, len, r).premultiply(rot);
    _e.set(rx, ry, rz, 'YXZ');
    m.premultiply(new THREE.Matrix4().makeRotationFromEuler(_e));
    m.premultiply(new THREE.Matrix4().makeTranslation(x, y, z));
    return this.add(unitCyl(seg, open), color, m, o);
  }

  /** Tube (open cylinder) between two points. */
  tube(a, b, r, color, { seg = 6, ...o } = {}) {
    const A = new THREE.Vector3(...a), B = new THREE.Vector3(...b);
    const len = A.distanceTo(B);
    if (len < 1e-4) return this;
    _q.setFromUnitVectors(new THREE.Vector3(0, 1, 0), B.clone().sub(A).normalize());
    const mid = A.clone().add(B).multiplyScalar(0.5);
    const m = new THREE.Matrix4().compose(mid, _q, new THREE.Vector3(r, len, r));
    return this.add(unitCyl(seg, true), color, m, o);
  }

  /** Low-poly ellipsoid. */
  blob(rx, ry, rz, color, x, y, z, { detail = 1, ...o } = {}) {
    return this.add(unitSphere(detail), color, this._mat(x, y, z, rx, ry, rz, o.rx, o.ry, o.rz), o);
  }

  /** Flat quad through four points (in order), either side visible for glass. */
  quad(a, b, c, d, color, o = {}) {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute([...a, ...b, ...c, ...a, ...c, ...d], 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute([0, 0, 1, 0, 1, 1, 0, 0, 1, 1, 0, 1], 2));
    g.computeVertexNormals();
    return this.add(g, color, null, o);
  }

  /** Textured quad (e.g. a number plate) facing +z (front -z if faceBack false). */
  decal(w, h, uv, x, y, z, { ry = 0, rx = 0, rz = 0 } = {}) {
    const g = new THREE.PlaneGeometry(w, h);
    return this.add(g, 0xffffff, this._mat(x, y, z, 1, 1, 1, rx, ry, rz), { uv });
  }

  /** Round textured disc of radius r facing +z (a lamp lens, a badge). */
  disc(r, uv, x, y, z, { ry = 0, rx = 0, seg = 16 } = {}) {
    return this.add(discGeo(seg), 0xffffff, this._mat(x, y, z, r, r, 1, rx, ry, 0), { uv });
  }

  /**
   * Side-profile slab: the region between `top` and `bottom` polylines for
   * z in [z0, z1], extruded from x0 to x1. `taper(z, y)` can scale x to
   * round the corners in plan.
   */
  slab(top, bottom, z0, z1, x0, x1, color, { taper = null, ...o } = {}) {
    const t = clipLine(top, z0, z1);
    const b = clipLine(bottom, z0, z1).reverse();
    const shape = new THREE.Shape();
    shape.moveTo(t[0][0], t[0][1]);
    for (let i = 1; i < t.length; i++) shape.lineTo(t[i][0], t[i][1]);
    for (const p of b) shape.lineTo(p[0], p[1]);
    const g = new THREE.ExtrudeGeometry(shape, { depth: x1 - x0, bevelEnabled: false, curveSegments: 1 });
    mapGeo(g, (v) => {
      const X = v.x, Y = v.y, Z = v.z;
      let x = x0 + Z;
      if (taper) x *= taper(X, Y);
      v.set(x, Y, X);
    }, true);
    return this.add(g, color, null, o);
  }

  /**
   * A flat polygon [[z, y], ...] in a side plane at x = sgn * xAt(y),
   * extruded `depth` inward. With `holes` it becomes a frame.
   */
  sidePanel(outline, holes, sgn, xAt, depth, color, { outward = false, ...o } = {}) {
    const shape = new THREE.Shape(outline.map(([z, y]) => new THREE.Vector2(z, y)));
    for (const h of holes) shape.holes.push(new THREE.Path(h.map(([z, y]) => new THREE.Vector2(z, y))));
    const g = depth > 0
      ? new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: false, curveSegments: 1 })
      : new THREE.ShapeGeometry(shape);
    mapGeo(g, (v) => {
      const X = v.x, Y = v.y, Z = v.z;
      v.set(sgn * (xAt(Y) - Z), Y, X);
    }, sgn < 0);
    // a flat panel faces inward as mapped; `outward` turns it to face out
    if (outward) flipWinding(g).computeVertexNormals();
    return this.add(g, color, null, o);
  }

  flush(parent) {
    const b = this.body.flush(parent);
    const g = this.glassB.flush(parent);
    for (const m of g) { m.castShadow = false; m.renderOrder = 2; }
    return { body: b.find((m) => m.castShadow) || b[0] || null, bodies: b, glass: g[0] || null };
  }
}

/* ------------------------------------------------------------ greenhouse */

/**
 * The cabin above the belt line: two leaning side frames with the side
 * windows cut out, a roof, a windscreen and a rear window, all hollow.
 *
 * gh = {
 *   aBase: [z, y], aTop: [z, y], roofRear: [z, y], cBase: [z, y],
 *   extra: [[z, y], ...]  optional points between roofRear and cBase
 *                         (wagons: the D pillar line)
 *   hwBelt, hwRoof        half widths at belt and roof
 *   pillars: [z, ...]     B / C pillar centres between the windows
 *   pW: [aW, roofW, cW, bW] pillar widths (along z) and roof rail height
 *   pillarColor           default body colour (black-out for many cars)
 *   roofColor, glass      colours
 *   rearGlass: false      for vans with no rear window
 * }
 */
export function greenhouse(P, gh, color) {
  const [za, yb] = gh.aBase;
  const [zat, yr] = gh.aTop;
  const [zrr] = gh.roofRear;
  const [zc, yc] = gh.cBase;
  const hwb = gh.hwBelt, hwr = gh.hwRoof;
  const [aW, rW, cW, bW] = gh.pW || [0.07, 0.06, 0.12, 0.08];
  const sill = gh.sill ?? 0.03;
  const xAt = (y) => hwb - ((y - yb) / ((yr - yb) || 1)) * (hwb - hwr);
  const outline = [[za, yb], [zat, yr], [zrr, yr], ...(gh.extra || []), [zc, yc]];
  const cLineTop = gh.extra?.length ? gh.extra[gh.extra.length - 1] : [zrr, yr];

  // windows: strips between pillars, clipped by the A and C lines
  const cuts = [za - 1, ...(gh.pillars || []), zc + 1];
  const holes = [];
  const ylo = Math.max(yb, yc) + sill, yhi = yr - rW;
  for (let i = 0; i < cuts.length - 1; i++) {
    const z0 = cuts[i] + (i === 0 ? 0 : bW / 2);
    const z1 = cuts[i + 1] - (i === cuts.length - 2 ? 0 : bW / 2);
    let poly = [[z0, ylo], [z1, ylo], [z1, yhi], [z0, yhi]];
    poly = clipBy(poly, zOffsetFromLine([za, yb], [zat, yr], aW));
    poly = clipBy(poly, (p) => -zOffsetFromLine(cLineTop, [zc, yc], -cW)(p));
    if (poly.length >= 3) holes.push(poly);
  }
  const pc = gh.pillarColor ?? color;
  const seal = gh.seal ?? RUBBER_SEAL;
  for (const sgn of [1, -1]) {
    P.sidePanel(outline, holes, sgn, xAt, 0.035, pc);
    for (const h of holes) {
      P.sidePanel(h, [], sgn, (y) => xAt(y) - 0.012, 0, gh.glass ?? GLASS.clear, { glass: true });
      // the rubber seal: a thin frame standing just proud of the pillars
      if (seal !== null) P.sidePanel(growPoly(h, 0.016), [h], sgn, (y) => xAt(y) + 0.004, 0, seal, { outward: true });
    }
  }
  // roof, a little crowned, with the pale headliner under it
  const roofC = gh.roofColor ?? color;
  P.span(-hwr - 0.005, yr - 0.045, zat - 0.01, hwr + 0.005, yr + 0.005, zrr + 0.01, roofC);
  P.span(-hwr + 0.08, yr + 0.004, zat + 0.08, hwr - 0.08, yr + 0.026, zrr - 0.06, roofC);
  if (gh.headliner !== null) P.span(-hwr + 0.03, yr - 0.06, zat + 0.02, hwr - 0.03, yr - 0.045, zrr - 0.02, gh.headliner ?? HEADLINER);
  // windscreen
  const inset = 0.015;
  const rim = (pts) => {
    if (seal === null) return;
    for (let i = 0; i < 4; i++) P.tube(pts[i], pts[(i + 1) % 4], 0.012, seal, { seg: 4 });
  };
  rim([[-xAt(yb) + inset, yb + 0.005, za + 0.01], [xAt(yb) - inset, yb + 0.005, za + 0.01],
    [xAt(yr) - inset, yr - 0.02, zat + 0.005], [-xAt(yr) + inset, yr - 0.02, zat + 0.005]]);
  P.quad(
    [-xAt(yb) + inset, yb + 0.005, za + 0.01], [xAt(yb) - inset, yb + 0.005, za + 0.01],
    [xAt(yr) - inset, yr - 0.02, zat + 0.005], [-xAt(yr) + inset, yr - 0.02, zat + 0.005],
    gh.glass ?? GLASS.clear, { glass: true },
  );
  // rear glass
  if (gh.rearGlass !== false) {
    const [zt, yt] = cLineTop;
    rim([[xAt(yc) - inset, yc + 0.01, zc - 0.01], [-xAt(yc) + inset, yc + 0.01, zc - 0.01],
      [-xAt(yt) + inset, yt - 0.02, zt - 0.005], [xAt(yt) - inset, yt - 0.02, zt - 0.005]]);
    P.quad(
      [xAt(yc) - inset, yc + 0.01, zc - 0.01], [-xAt(yc) + inset, yc + 0.01, zc - 0.01],
      [-xAt(yt) + inset, yt - 0.02, zt - 0.005], [xAt(yt) - inset, yt - 0.02, zt - 0.005],
      gh.glass ?? GLASS.clear, { glass: true },
    );
  }
  return { xAt, holes };
}

/* ------------------------------------------------------------ wheels */

const wheelCache = new Map();

/**
 * Wheel geometry (tyre + rim + hub) with its axle along x, centred on
 * the wheel, hub face toward +x (side = 1) or -x (side = -1).
 * `pair` > 0 builds both wheels of an axle at +-pair.
 */
export function wheelGeometry(r, w, { rim = 0xb9b7b0, hub = 0xd8d6cf, style = 'cap', side = 1, pair = 0 } = {}) {
  const key = [r, w, rim, hub, style, side, pair].join('|');
  if (wheelCache.has(key)) return wheelCache.get(key);
  const P = new Parts();
  // Everything on the wheel face is placed in fractions of the tyre width
  // beyond its sidewall, so a unit wheel scaled per instance looks the
  // same as one built to size. Faces are flat and one-sided: nobody sees
  // the inside of a hubcap.
  const face = (x, s, k) => x + s * (w / 2 + k * w);
  const turn = (s) => new THREE.Matrix4().makeRotationY(s > 0 ? Math.PI / 2 : -Math.PI / 2);
  const plate = (x, s, k, rr, color, seg = 14) => {
    const m = turn(s).premultiply(new THREE.Matrix4().makeTranslation(face(x, s, k), 0, 0));
    m.multiply(new THREE.Matrix4().makeScale(rr, rr, 1));
    P.add(discGeo(seg), color, m);
  };
  const ring = (x, s, k0, k1, rr, color, seg = 12) => {
    P.cyl(rr, (k1 - k0) * w, color, face(x, s, (k0 + k1) / 2), 0, 0, { axis: 'x', seg, open: true });
  };
  // a flat mark on the wheel face (a vent hole, a slot, a nut, a spoke gap): one quad
  const dot = (x, s, k, a, rr, hy, hz, color) => {
    const px = face(x, s, k), cy = Math.cos(a) * rr, cz = Math.sin(a) * rr;
    const ty = -Math.sin(a), tz = Math.cos(a);      // tangent round the wheel
    const ry = Math.cos(a), rz = Math.sin(a);        // radial
    const pts = [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([u, v]) => [px, cy + ty * u * hz + ry * v * hy, cz + tz * u * hz + rz * v * hy]);
    if (s > 0) P.quad(pts[0], pts[1], pts[2], pts[3], color); else P.quad(pts[3], pts[2], pts[1], pts[0], color);
  };
  const one = (x, s) => {
    P.cyl(r, w, 0x262626, x, 0, 0, { axis: 'x', seg: 14 });
    if (style === 'lada') {
      // Zhiguli: silver steel wheel, a ring of vent holes, the chrome dome cap
      plate(x, s, 0.03, r * 0.7, rim);
      for (let i = 0; i < 6; i++) dot(x, s, 0.04, (i / 6) * Math.PI * 2, r * 0.5, r * 0.05, r * 0.08, 0x1e1e1e);
      ring(x, s, 0.03, 0.12, r * 0.33, hub);
      plate(x, s, 0.12, r * 0.33, hub, 12);
      ring(x, s, 0.12, 0.2, r * 0.2, 0xf4f4f0, 10);
      plate(x, s, 0.2, r * 0.2, 0xf4f4f0, 10);
    } else if (style === 'volga') {
      // the big chrome hubcap of a Volga, with its raised centre and badge
      plate(x, s, 0.03, r * 0.74, rim, 16);
      plate(x, s, 0.05, r * 0.52, 0x9a9a96);
      ring(x, s, 0.05, 0.12, r * 0.44, hub);
      plate(x, s, 0.12, r * 0.44, hub);
      plate(x, s, 0.13, r * 0.12, 0x7a1d18, 8);
    } else if (style === 'deckel') {
      // flat slotted hubcap (a Mercedes, an Audi 100 on steel wheels)
      plate(x, s, 0.03, r * 0.7, rim, 16);
      for (let i = 0; i < 8; i++) dot(x, s, 0.04, (i / 8) * Math.PI * 2, r * 0.5, r * 0.035, r * 0.1, 0x303030);
      plate(x, s, 0.06, r * 0.2, hub, 10);
    } else if (style === 'cap') {
      // chrome hubcap of a Soviet saloon
      plate(x, s, 0.03, r * 0.6, rim, 12);
      ring(x, s, 0.03, 0.1, r * 0.22, hub, 8);
      plate(x, s, 0.1, r * 0.22, hub, 8);
    } else if (style === 'alloy') {
      // five spokes: dark windows between them on a silver disc
      plate(x, s, 0.03, r * 0.62, rim, 14);
      for (let i = 0; i < 5; i++) dot(x, s, 0.04, (i / 5 + 0.1) * Math.PI * 2, r * 0.38, r * 0.16, r * 0.13, 0x3a3a3a);
      plate(x, s, 0.06, r * 0.14, hub, 8);
    } else {
      // plain steel wheel (trucks, buses, Niva): painted disc, hand holes, hub and nuts
      plate(x, s, 0.03, r * 0.66, rim);
      for (let i = 0; i < 4; i++) dot(x, s, 0.04, (i / 4) * Math.PI * 2 + Math.PI / 4, r * 0.46, r * 0.07, r * 0.07, 0x1e1e1e);
      ring(x, s, 0.03, 0.14, r * 0.25, hub, 8);
      plate(x, s, 0.14, r * 0.25, hub, 8);
      for (let i = 0; i < 6; i++) dot(x, s, 0.15, (i / 6) * Math.PI * 2, r * 0.17, r * 0.028, r * 0.028, 0x8a8a86);
    }
  };
  if (pair) { one(pair, 1); one(-pair, -1); } else one(0, side);
  const tmp = new THREE.Group();
  const { body } = P.flush(tmp);
  const g = body.geometry;
  wheelCache.set(key, g);
  return g;
}

/**
 * Standard wheel rig for a model: two steerable front wheels and one or
 * more rear axles. Returns { wheels, steer } for the contract.
 */
export function wheelRig(group, { r, w, track, zFront, zRear = [], rim, hub, style, dual = false }) {
  const wheels = [], steer = [];
  const rears = Array.isArray(zRear) ? zRear : [zRear];
  for (const s of [-1, 1]) {
    const pivot = new THREE.Group();
    pivot.position.set(s * track / 2, r, zFront);
    const m = new THREE.Mesh(wheelGeometry(r, w, { rim, hub, style, side: s }), VMAT.body);
    m.userData.wheel = { r, w, rim, style: style || 'cap', side: s, pair: 0 };
    m.castShadow = true;
    pivot.add(m);
    group.add(pivot);
    wheels.push(m);
    steer.push(pivot);
  }
  for (const z of rears) {
    const axle = new THREE.Mesh(wheelGeometry(r, dual ? w * 1.9 : w, { rim, hub, style, pair: track / 2 }), VMAT.body);
    axle.userData.wheel = { r, w: dual ? w * 1.9 : w, rim, style: style || 'cap', side: 1, pair: track / 2 };
    axle.position.set(0, r, z);
    axle.castShadow = true;
    group.add(axle);
    wheels.push(axle);
  }
  return { wheels, steer };
}

/* ------------------------------------------------------------ lamps */

/**
 * Brake lights and indicators as small unlit meshes. `rects` are
 * { x, y, w, h, z, face } with face -1 (front) or +1 (rear); mirrored
 * to -x automatically when `mirror` is set.
 */
function lampMesh(rects, material) {
  if (!rects.length) return null;
  const pos = [];
  for (const r of rects) {
    const hw = r.w / 2, hh = r.h / 2, z = r.z;
    const quad = r.face > 0
      ? [[r.x - hw, r.y - hh], [r.x + hw, r.y - hh], [r.x + hw, r.y + hh], [r.x - hw, r.y + hh]]
      : [[r.x + hw, r.y - hh], [r.x - hw, r.y - hh], [r.x - hw, r.y + hh], [r.x + hw, r.y + hh]];
    const v = quad.map(([x, y]) => [x, y, z]);
    pos.push(...v[0], ...v[1], ...v[2], ...v[0], ...v[2], ...v[3]);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  const m = new THREE.Mesh(g, material);
  m.visible = false;
  m.castShadow = false;
  return m;
}

/**
 * Attach brake and indicator lamps.
 * @param {THREE.Group} group
 * @param {object} o
 * @param {Array} o.brake  rear brake rects on the +x side {x,y,w,h}; mirrored
 * @param {Array} o.frontBlink  front indicator rects on +x
 * @param {Array} o.rearBlink   rear indicator rects on +x
 * @param {number} o.zFront, o.zRear  lamp face planes
 */
export function lamps(group, { brake = [], frontBlink = [], rearBlink = [], zFront, zRear, extraBrake = [] }) {
  const mir = (list, z, face) => list.flatMap((r) => [
    { ...r, z: (r.z ?? z) + face * 0.006, face },
    { ...r, x: -r.x, z: (r.z ?? z) + face * 0.006, face },
  ]);
  const b = lampMesh([...mir(brake, zRear, 1), ...extraBrake.map((r) => ({ ...r, z: (r.z ?? zRear) + 0.006, face: 1 }))], VMAT.brake);
  const side = (sgn) => lampMesh([
    ...frontBlink.map((r) => ({ ...r, x: sgn * r.x, z: (r.z ?? zFront) - 0.006, face: -1 })),
    ...rearBlink.map((r) => ({ ...r, x: sgn * r.x, z: (r.z ?? zRear) + 0.006, face: 1 })),
  ], VMAT.blink);
  const left = side(-1), right = side(1);
  for (const m of [b, left, right]) if (m) group.add(m);
  return { brake: b, blink: left && right ? { left, right } : null };
}

/* ------------------------------------------------------------ people */

const SHIRTS = [0xe8e4da, 0x5b6f8a, 0x8a3a34, 0x3e5a3a, 0x2f2f33, 0xc9b27a, 0x6a7fa6, 0xd9d2c0, 0x7a5a8a];
const SKIN = [0xd9a784, 0xc8926c, 0xe2b594, 0xb98260, 0xd0a07a];
const HAIR = [0x1e1a17, 0x2c241e, 0x3b2e24, 0x6b6560, 0x1a1a1a];

/**
 * A seated figure (driver or passenger) facing -z with its hip at
 * (x, y, z). `wheel` bends the arms forward to a steering wheel.
 */
export function seatedFigure(P, x, y, z, seed = 1, { wheel = false, scarf = false } = {}) {
  const pick = (arr, k) => arr[Math.abs(Math.floor(seed * 7.13 + k * 3.7)) % arr.length];
  const shirt = pick(SHIRTS, 1), skin = pick(SKIN, 2), hair = pick(HAIR, 3);
  P.box(0.4, 0.52, 0.24, shirt, x, y + 0.3, z + 0.02, { rx: -0.08 });
  P.box(0.14, 0.08, 0.12, skin, x, y + 0.6, z);            // neck
  P.blob(0.1, 0.12, 0.11, skin, x, y + 0.72, z - 0.01);
  if (scarf) P.blob(0.115, 0.1, 0.12, pick([0xb8423a, 0x3e6aa6, 0xd9c35a, 0x7a5a8a], 4), x, y + 0.77, z + 0.01);
  else P.blob(0.105, 0.07, 0.115, hair, x, y + 0.79, z + 0.015);
  // thighs forward
  P.box(0.36, 0.13, 0.42, 0x2f3440, x, y + 0.04, z - 0.2);
  if (wheel) {
    for (const s of [-1, 1]) P.box(0.08, 0.08, 0.4, shirt, x + s * 0.17, y + 0.42, z - 0.2, { rx: 0.5 });
  } else {
    for (const s of [-1, 1]) P.box(0.08, 0.32, 0.1, shirt, x + s * 0.22, y + 0.28, z, { rx: 0.2 });
  }
}

/* ------------------------------------------------------------ canvas helpers */

/** A standalone canvas-textured plane (route boards and other per-vehicle signs). */
export function signMesh(w, h, px, draw) {
  const canvas = document.createElement('canvas');
  canvas.width = px;
  canvas.height = Math.round((px * h) / w);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  const mat = cel({ map: tex, grime: 0, dirt: 0, bands: 3, cache: false });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat);
  mesh.castShadow = false;
  const paint = (...args) => {
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    draw(ctx, canvas.width, canvas.height, ...args);
    tex.needsUpdate = true;
  };
  return { mesh, paint, canvas };
}

/**
 * One canvas shown on several planes in a single draw call: the same
 * route card in the windscreen, a side window and the back window.
 * `places` are [{ x, y, z, ry, rx }]; a plane faces +z before rotation.
 */
export function signCards(w, h, px, draw, places) {
  const s = signMesh(w, h, px, draw);
  const geos = places.map(({ x, y, z, ry = 0, rx = 0 }) => new THREE.PlaneGeometry(w, h).applyMatrix4(
    new THREE.Matrix4().compose(new THREE.Vector3(x, y, z),
      new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, 0, 'YXZ')), new THREE.Vector3(1, 1, 1))));
  s.mesh.geometry.dispose();
  s.mesh.geometry = mergeGeometries(geos);
  for (const g of geos) g.dispose();
  return s;
}

/** Fit and draw a line of text centred at (x, y). */
export function fitText(ctx, text, x, y, maxW, size, color, { family = '"PT Sans Narrow", "Arial Narrow", Arial, sans-serif', weight = 'bold', align = 'center' } = {}) {
  let s = size;
  ctx.font = `${weight} ${s}px ${family}`;
  while (s > 6 && ctx.measureText(text).width > maxW) {
    s -= 1;
    ctx.font = `${weight} ${s}px ${family}`;
  }
  ctx.fillStyle = color;
  ctx.textAlign = align;
  ctx.textBaseline = 'middle';
  ctx.fillText(text, x, y);
}

/** Make a colour lighter / darker by factor (1 = unchanged). */
export function tone(hex, f) {
  const c = new THREE.Color(hex);
  const hsl = {};
  c.getHSL(hsl);
  c.setHSL(hsl.h, hsl.s, Math.max(0, Math.min(1, hsl.l * f)));
  return c.getHex();
}
