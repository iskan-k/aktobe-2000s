import * as THREE from 'three';
import { Atlas } from '../props/signs.js';

/* ------------------------------------------------------------------ *
 * Small helpers shared by the stadium modules.
 * ------------------------------------------------------------------ */

/** Forward of a yaw: the way something facing `yaw` looks. */
export function fwd(yaw) {
  return { x: -Math.sin(yaw), z: -Math.cos(yaw) };
}

/**
 * The stadium's own sign atlas: every board, banner and poster face is
 * copied into it, so all of them together cost two draw calls (solid
 * and cut-out) instead of one per texture.
 */
const ATLAS = new Atlas(2048);
const MAX_SLOT = 640;         // longest side of a face in the atlas, in pixels

const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _p = new THREE.Vector3(), _s = new THREE.Vector3(1, 1, 1);
const _up = new THREE.Vector3(0, 1, 0);

/**
 * A textured vertical quad added to a batch: bottom centre at (p.x, y, p.z),
 * its face looking along the forward of `facing`. `cutout` drops the
 * transparent pixels (letters, the round emblem).
 */
export function panelAt(batch, map, w, h, p, y, facing, { cutout = false, maxPx = MAX_SLOT } = {}) {
  _q.setFromAxisAngle(_up, facing + Math.PI);
  _m.compose(_p.set(p.x, y + h / 2, p.z), _q, _s);
  atlasAdd(batch, map, new THREE.PlaneGeometry(w, h), _m, { cutout, maxPx });
}

/** Add any geometry with a 0..1 uv to a batch, its texture copied into the stadium atlas. */
export function atlasAdd(batch, map, geo, matrix, { cutout = false, cast = false, maxPx = MAX_SLOT } = {}) {
  const img = map.image;
  const k = Math.min(1, maxPx / Math.max(img.width, img.height));
  const pw = Math.round(img.width * k), ph = Math.round(img.height * k);
  const rect = ATLAS.slot(map.uuid, pw, ph, (c) => c.drawImage(img, 0, 0, pw, ph));
  ATLAS.remap(geo, rect);
  batch.add(geo, { mat: cutout ? ATLAS.cutout : ATLAS.material, color: null, matrix, cast });
  geo.dispose();
}

/**
 * A quad in world space for a batch: from a to b along the ground, from
 * y0 to y1 up, with uv [u0, v0, u1, v1]. Its face looks to the right of
 * a -> b (a at the left edge as you look at it).
 */
export function wallQuad(a, b, y0, y1, uv = [0, 0, 1, 1]) {
  const g = new THREE.BufferGeometry();
  const pos = new Float32Array([
    a.x, y0, a.z, b.x, y0, b.z, b.x, y1, b.z, a.x, y1, a.z,
  ]);
  const [u0, v0, u1, v1] = uv;
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array([u0, v0, u1, v0, u1, v1, u0, v1]), 2));
  g.setIndex([0, 1, 2, 0, 2, 3]);
  g.computeVertexNormals();
  return g;
}
