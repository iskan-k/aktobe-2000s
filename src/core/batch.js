import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { MAT } from './toon.js';

/* ------------------------------------------------------------------ *
 * Static geometry batcher.
 *
 * A town is thousands of small painted boxes. Drawing each one is
 * thousands of draw calls, so every static part goes through a Batch:
 * the part is transformed into world space, stamped with its colour as a
 * vertex attribute, and merged with every other part that shares its
 * material and its 48 m ground cell. The cell split keeps frustum
 * culling useful; the vertex colour lets a green fence, a white kerb and
 * a rusty garage door share one draw call.
 *
 *   const b = new Batch();
 *   b.box(2, 1, 0.1, PAL.fenceGreen, x, 0, z, { ry });   // base-anchored
 *   b.add(someGeometry, { color, matrix, mat: 'foliage' });
 *   b.flush(parentGroup);
 *
 * `mat` is a key of MAT (toon.js) or a Material instance. Pieces that use
 * a textured material keep their uv attribute; everything else drops it.
 * ------------------------------------------------------------------ */

const _color = new THREE.Color();
const _box = new THREE.Box3();
const _c = new THREE.Vector3();
const _m = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _e = new THREE.Euler();
const _p = new THREE.Vector3();
const _s = new THREE.Vector3();

/** Unit box with its base at y = 0 and no bottom face (never seen, costs 20%). */
function makeUnitBox(withBottom) {
  const g = new THREE.BoxGeometry(1, 1, 1);
  g.translate(0, 0.5, 0);
  if (withBottom) return g;
  // BoxGeometry face order: +x, -x, +y, -y, +z, -z; each face is 6 indices
  const idx = Array.from(g.index.array);
  const keep = idx.slice(0, 18).concat(idx.slice(24));
  g.setIndex(keep);
  return g;
}

export const UNIT_BOX = makeUnitBox(false);
export const UNIT_BOX_CLOSED = makeUnitBox(true);

const cylCache = new Map();
/** Unit cylinder (radius 1, height 1, base at y = 0), cached per segment count. */
export function unitCylinder(seg = 8, openEnded = false) {
  const key = seg + (openEnded ? 'o' : 'c');
  if (!cylCache.has(key)) {
    const g = new THREE.CylinderGeometry(1, 1, 1, seg, 1, openEnded);
    g.translate(0, 0.5, 0);
    cylCache.set(key, g);
  }
  return cylCache.get(key);
}

let materialIds = new WeakMap();
let nextMatId = 1;
function matId(mat) {
  if (!materialIds.has(mat)) materialIds.set(mat, nextMatId++);
  return materialIds.get(mat);
}

function ensureIndexed(g) {
  if (g.index) return g;
  const n = g.attributes.position.count;
  const idx = new (n > 65535 ? Uint32Array : Uint16Array)(n);
  for (let i = 0; i < n; i++) idx[i] = i;
  g.setIndex(new THREE.BufferAttribute(idx, 1));
  return g;
}

export class Batch {
  /**
   * @param {object} [o]
   * @param {number} [o.cell=48]  ground cell size used to split merged meshes
   * @param {string} [o.name]
   */
  constructor({ cell = 48, name = 'batch' } = {}) {
    this.cell = cell;
    this.name = name;
    this.groups = new Map();
    this.count = 0;
  }

  _resolveMat(mat) {
    if (typeof mat === 'string') {
      const m = MAT[mat];
      if (!m) throw new Error(`Batch: unknown material key "${mat}"`);
      return m;
    }
    return mat;
  }

  /**
   * Add one part.
   * @param {THREE.BufferGeometry} geometry  not modified; cloned internally
   * @param {object} [o]
   * @param {number|THREE.Color|null} [o.color]  null keeps the geometry's own
   *   colour attribute (or white if it has none)
   * @param {THREE.Matrix4} [o.matrix]
   * @param {string|THREE.Material} [o.mat='solid']
   * @param {boolean} [o.cast=true]
   * @param {boolean} [o.receive=true]
   */
  add(geometry, { color = 0xffffff, matrix = null, mat = 'solid', cast = true, receive = true } = {}) {
    const material = this._resolveMat(mat);
    const g = geometry.clone();
    if (matrix) g.applyMatrix4(matrix);
    ensureIndexed(g);

    const keepUv = !!material.map;
    for (const name of Object.keys(g.attributes)) {
      if (name === 'position' || name === 'normal') continue;
      if (name === 'uv' && keepUv) continue;
      if (name === 'color' && color === null) continue;
      g.deleteAttribute(name);
    }
    if (!g.attributes.normal) g.computeVertexNormals();
    if (keepUv && !g.attributes.uv) {
      g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2));
    }
    if (material.vertexColors) {
      if (color !== null || !g.attributes.color) {
        _color.set(color === null ? 0xffffff : color);
        const n = g.attributes.position.count;
        const arr = new Float32Array(n * 3);
        for (let i = 0; i < n; i++) {
          arr[i * 3] = _color.r;
          arr[i * 3 + 1] = _color.g;
          arr[i * 3 + 2] = _color.b;
        }
        g.setAttribute('color', new THREE.BufferAttribute(arr, 3));
      }
    } else if (g.attributes.color) {
      g.deleteAttribute('color');
    }

    g.computeBoundingBox();
    g.boundingBox.getCenter(_c);
    const cx = Math.floor(_c.x / this.cell);
    const cz = Math.floor(_c.z / this.cell);
    const key = `${cx},${cz}|${matId(material)}|${cast ? 1 : 0}${receive ? 1 : 0}`;
    let grp = this.groups.get(key);
    if (!grp) {
      grp = { material, cast, receive, parts: [] };
      this.groups.set(key, grp);
    }
    grp.parts.push(g);
    this.count++;
    return this;
  }

  /**
   * Base-anchored box: (x, y, z) is the centre of its bottom face.
   * Rotation is yaw first, then pitch, then roll (YXZ), about that point.
   */
  box(w, h, d, color, x = 0, y = 0, z = 0, o = {}) {
    const { rx = 0, ry = 0, rz = 0, closed = false } = o;
    _p.set(x, y, z);
    _e.set(rx, ry, rz, 'YXZ');
    _q.setFromEuler(_e);
    _s.set(w, h, d);
    _m.compose(_p, _q, _s);
    return this.add(closed ? UNIT_BOX_CLOSED : UNIT_BOX, { ...o, color, matrix: _m });
  }

  /** Axis-aligned box from min corner to max corner (no rotation). */
  span(x0, y0, z0, x1, y1, z1, color, o = {}) {
    const w = Math.abs(x1 - x0), h = Math.abs(y1 - y0), d = Math.abs(z1 - z0);
    return this.box(w, h, d, color, (x0 + x1) / 2, Math.min(y0, y1), (z0 + z1) / 2, o);
  }

  /** Base-anchored cylinder. */
  cyl(r, h, color, x = 0, y = 0, z = 0, o = {}) {
    const { rx = 0, ry = 0, rz = 0, seg = 8, rTop = null, open = false } = o;
    _p.set(x, y, z);
    _e.set(rx, ry, rz, 'YXZ');
    _q.setFromEuler(_e);
    _s.set(r, h, r);
    _m.compose(_p, _q, _s);
    if (rTop !== null && rTop !== r) {
      const g = new THREE.CylinderGeometry(rTop, r, h, seg, 1, open);
      g.translate(0, h / 2, 0);
      _m.compose(_p, _q, _s.set(1, 1, 1));
      return this.add(g, { ...o, color, matrix: _m });
    }
    return this.add(unitCylinder(seg, open), { ...o, color, matrix: _m });
  }

  /**
   * A cylinder between two points, for pipes, rails and poles at an angle.
   */
  tube(ax, ay, az, bx, by, bz, r, color, o = {}) {
    const { seg = 6 } = o;
    const a = new THREE.Vector3(ax, ay, az);
    const b = new THREE.Vector3(bx, by, bz);
    const len = a.distanceTo(b);
    if (len < 1e-4) return this;
    const dir = b.clone().sub(a).normalize();
    _q.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
    _s.set(r, len, r);
    _m.compose(a, _q, _s);
    return this.add(unitCylinder(seg, o.open ?? true), { ...o, color, matrix: _m });
  }

  /** Merge everything added so far into meshes under `parent`. */
  flush(parent) {
    const meshes = [];
    for (const grp of this.groups.values()) {
      const merged = mergeGeometries(grp.parts, false);
      grp.parts.forEach((g) => g.dispose());
      if (!merged) continue;
      merged.computeBoundingSphere();
      const mesh = new THREE.Mesh(merged, grp.material);
      mesh.name = this.name;
      mesh.castShadow = grp.cast;
      mesh.receiveShadow = grp.receive;
      mesh.matrixAutoUpdate = false;
      mesh.updateMatrix();
      parent.add(mesh);
      meshes.push(mesh);
    }
    this.groups.clear();
    return meshes;
  }
}

/** Reset material ids (tests only). */
export function _resetBatchIds() {
  materialIds = new WeakMap();
  nextMatId = 1;
}

/** World-space bounds of a set of meshes, handy for debugging. */
export function boundsOf(meshes) {
  const b = new THREE.Box3();
  for (const m of meshes) {
    m.geometry.computeBoundingBox();
    _box.copy(m.geometry.boundingBox).applyMatrix4(m.matrixWorld);
    b.union(_box);
  }
  return b;
}
