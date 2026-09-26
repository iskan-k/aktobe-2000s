import { BLOCKS } from '../plan.js';
import { buildMemorial } from '../landmarks/memorial.js';
import { buildLenin } from '../landmarks/lenin.js';
import { buildRoadside } from '../landmarks/roadside.js';
import { buildHeatingMain } from '../landmarks/heating.js';

/* ------------------------------------------------------------------ *
 * District: sights on the south edge, on land the garage cooperatives
 * give up at either end (see edgesSouth.js and plan.js SIGHTS).
 *
 *   west, x -228..-196    the Lenin statue in a pocket square
 *   west, x -192..-108    the Memorial of Glory on the axis of
 *                         ул. Пушкина: obelisk, Eternal Flame, name
 *                         walls, Aliya Moldagulova, a T-34
 *   east, x 104..190      the АҚТӨБЕ stele with its mosaic on the axis
 *                         of пр. Санкибай батыра, a kumys yurt and a
 *                         shashlyk café
 *   along the back        the heating main, over ул. Айтеке би in a U
 * ------------------------------------------------------------------ */

export const sights = {
  name: 'sights',
  build(ctx) {
    const z0 = BLOCKS.southEdge.z0;
    buildLenin(ctx, z0);
    buildMemorial(ctx, z0);
    buildRoadside(ctx, z0);
    buildHeatingMain(ctx);
  },
};
