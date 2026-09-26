import * as THREE from 'three';
import { cel } from './toon.js';

/* ------------------------------------------------------------------ *
 * Shared pieces for the hand-held item models in items.js and
 * itemsFood.js: clean cel materials, a glass look, faceted glasses,
 * paper cones and piles of small things at a cone's mouth.
 * ------------------------------------------------------------------ */

export const m = (color, o = {}) => cel({ color, grime: 0, dirt: 0, bands: 3, ...o });
export const glass = (color, opacity = 0.42) => cel({ color, grime: 0, dirt: 0, bands: 'soft', transparent: true, opacity, depthWrite: false });

export function mesh(geo, mat, x = 0, y = 0, z = 0) {
  const o = new THREE.Mesh(geo, mat);
  o.position.set(x, y, z);
  return o;
}

/** A cylinder with flat facets, like a гранёный стакан. */
export function faceted(rTop, rBot, h, seg, open = false) {
  const g = new THREE.CylinderGeometry(rTop, rBot, h, seg, 1, open).toNonIndexed();
  g.computeVertexNormals();
  return g;
}

/** A paper cone (kulyok) opening upward, with its fill piled at the top. */
export function paperCone(group, map, color) {
  const cone = mesh(new THREE.CylinderGeometry(0.048, 0.006, 0.15, 14, 1, true), cel({ map, color, grime: 0, dirt: 0, bands: 3, side: THREE.DoubleSide, cache: false }), 0, 0.06, 0);
  group.add(cone);
  // the folded-over lip
  group.add(mesh(new THREE.TorusGeometry(0.048, 0.003, 4, 14), m(color), 0, 0.135, 0).rotateX(Math.PI / 2));
  return cone;
}

/** Scatter `n` copies of a small geometry over a disc at the cone's mouth. */
export function pile(n, r, make, seed = 1) {
  let s = seed;
  const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  const pieces = [];
  for (let i = 0; i < n; i++) {
    const a = rnd() * Math.PI * 2, d = Math.sqrt(rnd()) * r;
    const p = make(rnd);
    p.position.set(Math.cos(a) * d, rnd() * 0.012 + (1 - d / r) * 0.012, Math.sin(a) * d);
    p.rotation.set(rnd() * 3, rnd() * 3, rnd() * 3);
    pieces.push(p);
  }
  return pieces;
}
