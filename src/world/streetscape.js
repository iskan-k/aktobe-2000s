import { addTree } from './props/trees.js';
import { addLamp } from './props/street.js';
import { KERB_H } from './plan.js';

/* ------------------------------------------------------------------ *
 * Street trees and street lights along every road, placed from the
 * spots the road builder reserved (see roads.js). The avenue gets rows
 * of pyramidal poplars with an elm every few trees; side streets get
 * elms and self-seeded maples, a little less orderly.
 * ------------------------------------------------------------------ */

export function buildStreetscape(ctx, streets) {
  const { batch, colliders, rng } = ctx;
  const r = rng(77);
  let i = 0;
  for (const s of streets.treeSpots) {
    i++;
    // leave the occasional gap: a tree that died and was never replaced
    if (r.chance(0.08)) continue;
    const kind = s.major
      ? (i % 5 === 0 ? 'elm' : 'poplar')
      : r.weighted([['elm', 5], ['maple', 3], ['poplar', 1], ['young', 1]]);
    const { r: trunkR } = addTree(batch, kind, s.x, s.z, 1000 + i, { y: KERB_H });
    colliders.circle(s.x, s.z, trunkR + 0.05, { tag: 'tree' });
  }
  for (const l of streets.lampSpots) {
    addLamp(batch, l.x, l.z, l.facing, { y: KERB_H });
    colliders.circle(l.x, l.z, 0.2, { tag: 'lamp' });
  }
}
