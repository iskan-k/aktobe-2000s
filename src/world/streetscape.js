import { addTree } from './props/trees.js';
import { FOLIAGE_TIME } from './props/foliage.js';
import { addLamp } from './props/street.js';
import { buildOverhead } from './overhead.js';
import { KERB_H, STOPS, stopPlacement, RAIL, inKeepClear } from './plan.js';

/* ------------------------------------------------------------------ *
 * Street trees and street lights along every road, placed from the
 * spots the road builder reserved (see roads.js). The avenue gets rows
 * of pyramidal poplars with an elm every few trees; side streets get
 * elms and self-seeded maples, a little less orderly.
 * ------------------------------------------------------------------ */

export function buildStreetscape(ctx, streets) {
  const { batch, colliders, rng } = ctx;
  const r = rng(77);
  // bus shelters need 7 m of clear pavement either side of their centre
  const shelters = STOPS.map((s) => stopPlacement(s).shelter);
  const nearShelter = (x, z, d = 7) => shelters.some((p) => Math.abs(p.x - x) < d && Math.abs(p.z - z) < d)
    // nothing grows or stands inside the railway corridor
    || (z > RAIL.corridor[0] - 4 && z < RAIL.corridor[1] + 2)
    || inKeepClear(x, z, 1);
  let i = 0;
  for (const s of streets.treeSpots) {
    i++;
    if (nearShelter(s.x, s.z)) continue;
    // leave the occasional gap: a tree that died and was never replaced
    if (r.chance(0.08)) continue;
    const kind = s.major
      ? (i % 6 === 0 ? 'ball' : i % 5 === 0 ? 'elm' : 'poplar')
      : r.weighted([['elm', 5], ['maple', 3], ['poplar', 1], ['young', 1]]);
    const { r: trunkR } = addTree(batch, kind, s.x, s.z, 1000 + i, { y: KERB_H });
    colliders.circle(s.x, s.z, trunkR + 0.05, { tag: 'tree' });
  }
  buildOverhead(ctx);
  // the clock for the leaves' sway, shared by every canopy in town
  ctx.update((dt) => { FOLIAGE_TIME.value += dt; });
  for (const l of streets.lampSpots) {
    if (nearShelter(l.x, l.z, 4)) continue;
    addLamp(batch, l.x, l.z, l.facing, { y: KERB_H, double: !!l.double, steel: !!l.double, height: l.double ? 10.5 : 9.5 });
    colliders.circle(l.x, l.z, 0.2, { tag: 'lamp' });
  }
}
