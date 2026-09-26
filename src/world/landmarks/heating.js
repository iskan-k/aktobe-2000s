import * as THREE from 'three';
import { cel } from '../../core/toon.js';
import { canvasTex, cached } from '../../core/textures.js';
import { rngKit } from '../../core/util.js';
import { BOUNDS, roadById, outerEdge } from '../plan.js';

/* ------------------------------------------------------------------ *
 * An above-ground heating main (теплотрасса): the supply and return
 * pipes from the thermal plant, lagged and clad in silver sheet, on low
 * concrete saddles along the south edge of town. Where they meet
 * ул. Айтеке би they climb over it in a tall U, the way every Soviet
 * town carried its heating across a road, and just past it they dive
 * into a concrete chamber and go underground toward the microdistrict.
 * ------------------------------------------------------------------ */

export const MAIN = { z: [148.7, 149.55], y: 0.78, r: 0.27, xEnd: -1.5 };
const HIGH = 6.2;                 // centre height of the span over the road
const SPACING = 7;                // metres between saddles

/** Silver cladding: sheet laps every metre, bands, a few dents and rust. */
function claddingTex() {
  return cached('heating-cladding', () => canvasTex(128, 128, (c, W, H) => {
    const r = rngKit(81);
    c.fillStyle = '#c4c8c8';
    c.fillRect(0, 0, W, H);
    for (let i = 0; i < 260; i++) {
      c.fillStyle = r.pick(['#d6dada', '#b2b6b6', '#cacece']);
      c.globalAlpha = r.range(0.2, 0.6);
      c.fillRect(r.range(0, W), r.range(0, H), r.range(4, 20), r.range(1, 4));
    }
    c.globalAlpha = 1;
    // one sheet lap across the pipe per tile (v runs along the pipe)
    c.fillStyle = '#8e9292';
    c.fillRect(0, 0, W, 3);
    c.fillStyle = '#e4e8e8';
    c.fillRect(0, 3, W, 2);
    // the long seam along the underside
    c.fillStyle = '#9a9e9e';
    c.fillRect(W * 0.72, 0, 2, H);
    for (let i = 0; i < 4; i++) {
      c.fillStyle = 'rgba(140,90,50,0.35)';
      c.fillRect(r.range(0, W), r.range(0, H), r.range(2, 6), r.range(6, 20));
    }
  }));
}

let _mat = null;
function claddingMat() {
  if (!_mat) {
    const t = claddingTex();
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    _mat = cel({ map: t, grime: 0.06, dirt: 0.2, dirtH: 0.6 });
  }
  return _mat;
}

/** A straight clad pipe from a to b with uv tiling one sheet per metre. */
function pipe(batch, a, b, r) {
  const A = new THREE.Vector3(...a), B = new THREE.Vector3(...b);
  const len = A.distanceTo(B);
  const g = new THREE.CylinderGeometry(r, r, len, 10, 1, true);
  const uv = g.attributes.uv;
  for (let i = 0; i < uv.count; i++) uv.setY(i, uv.getY(i) * len);
  g.translate(0, len / 2, 0);
  const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), B.clone().sub(A).normalize());
  g.applyMatrix4(new THREE.Matrix4().compose(A, q, new THREE.Vector3(1, 1, 1)));
  batch.add(g, { mat: claddingMat(), color: null });
}

/** A rounded elbow at a corner: a ball of cladding. */
function elbow(batch, p, r) {
  const g = new THREE.SphereGeometry(r * 1.04, 10, 6);
  g.translate(...p);
  batch.add(g, { mat: claddingMat(), color: null });
}

function saddle(batch, x, z0, z1) {
  batch.box(0.55, MAIN.y - MAIN.r, z1 - z0 + 0.8, 0xa8a49a, x, -0.04, (z0 + z1) / 2);
  batch.box(0.2, 0.06, z1 - z0 + 0.7, 0x4a4644, x, MAIN.y - MAIN.r - 0.04, (z0 + z1) / 2);
}

export function buildHeatingMain(ctx) {
  const { batch: b, colliders, ground } = ctx;
  const mid = roadById.mid;
  const legW = mid.c - outerEdge(mid, 0) - 1.8;     // west leg, just off the pavement
  const legE = mid.c + outerEdge(mid, 1) + 1.8;
  const x0 = BOUNDS.x0 - 190;                       // from beyond the edge of the map
  const [za, zb] = MAIN.z;
  const { y, r } = MAIN;
  for (const z of MAIN.z) {
    pipe(b, [x0, y, z], [legW, y, z], r);
    pipe(b, [legW, y, z], [legW, HIGH, z], r);
    pipe(b, [legW, HIGH, z], [legE, HIGH, z], r);
    pipe(b, [legE, HIGH, z], [legE, y, z], r);
    pipe(b, [legE, y, z], [MAIN.xEnd, y, z], r);
    for (const p of [[legW, y, z], [legW, HIGH, z], [legE, HIGH, z], [legE, y, z]]) elbow(b, p, r);
  }
  // saddles along the runs, and a steel frame holding up each leg of the U
  for (let x = legW - 2; x > x0; x -= SPACING) saddle(b, x, za, zb);
  for (let x = legE + 3; x < MAIN.xEnd - 1; x += SPACING) saddle(b, x, za, zb);
  for (const x of [legW, legE]) {
    const s = x < mid.c ? -1 : 1;
    for (const z of [za - 0.55, zb + 0.55]) b.box(0.14, HIGH + 0.4, 0.14, 0x5a5e60, x + s * 0.45, 0, z);
    b.box(0.14, 0.14, zb - za + 1.25, 0x5a5e60, x + s * 0.45, HIGH - r - 0.16, (za + zb) / 2);
    b.box(0.14, 0.14, zb - za + 1.25, 0x5a5e60, x + s * 0.45, HIGH * 0.5, (za + zb) / 2);
    colliders.box(x - 0.5, za - 0.7, x + 0.6, zb + 0.7, { top: HIGH + 0.4, tag: 'heating' });
  }
  // the chamber the pipes dive into: a concrete box with a manhole
  const cx = MAIN.xEnd + 1.2, cz = (za + zb) / 2;
  b.box(2.6, 0.62, 2.8, 0xb0aca2, cx, -0.04, cz);
  b.cyl(0.36, 0.04, 0x3a3836, cx + 0.4, 0.58, cz, { seg: 14 });
  colliders.box(cx - 1.3, cz - 1.4, cx + 1.3, cz + 1.4, { top: 0.58, tag: 'chamber' });
  ground.flat(cx - 1.3, cz - 1.4, cx + 1.3, cz + 1.4, 0.58, 'chamber');
  // the low runs are a barrier on the walkable side of the map
  const top = y + r + 0.05;
  colliders.box(BOUNDS.x0, za - r - 0.3, legW - 0.5, zb + r + 0.3, { top, tag: 'heating' });
  colliders.box(legE + 0.6, za - r - 0.3, MAIN.xEnd, zb + r + 0.3, { top, tag: 'heating' });
}
