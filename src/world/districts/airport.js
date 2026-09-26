import { Batch } from '../../core/batch.js';
import { SURF, TILE, hQuad } from '../../core/surfaces.js';
import { B, APRON, MID_W, FENCE } from '../airport/layout.js';
import { slabs, SLAB_TILE } from '../airport/surfaces.js';
import { buildAirfield } from '../airport/airfield.js';
import { buildTerminal } from '../airport/terminal.js';
import { buildApron } from '../airport/apron.js';
import { buildLandside } from '../airport/landside.js';

/* ------------------------------------------------------------------ *
 * Aktobe airport, south of the town fence and west of ул. Айтеке би
 * (see airport/layout.js for where everything is).
 *
 *   landside   the airport road (ул. Бокенбай батыра) with the bus stop,
 *              a car park and kiosks on its north side, the two-storey
 *              houses of Авиагородок to the west, the forecourt with the
 *              taxi rank, the terminal (1975, rebuilt 2004) and the tower
 *   airside    behind a chain-link fence: the apron with four stands,
 *              stairs, fuel bowsers and tugs, two hangars, the fuel farm
 *   airfield   out in the steppe past the walkable bounds: the runway,
 *              the taxiways, the approach lights
 *
 * The aircraft themselves, parked and moving, belong to the flights
 * system (airport/flights.js).
 * ------------------------------------------------------------------ */

function ground(ctx) {
  const b = ctx.batch;
  // grass over the landside; the paved parts sit on top of it (the apron is
  // not a ground surface the tufts know, so no grass is laid under it)
  b.add(hQuad(B.x0, B.z0, MID_W, FENCE.z, -0.03, TILE.grass), { mat: SURF.grass, color: null, cast: false });
  // the apron: concrete from the fence to the taxilane, on past the bounds
  b.add(hQuad(APRON.x0, APRON.z0, APRON.x1, APRON.z1, 0.0, SLAB_TILE), { mat: slabs(), color: 0xf2f0ea, cast: false });
}

export const airport = {
  name: 'airport',
  build(world) {
    // one batch with one huge cell for the whole airport, as the edges do:
    // a draw call per material for all of it, instead of one per 128 m cell
    const batch = new Batch({ name: 'airport', cell: Infinity });
    const ctx = { ...world, batch };
    ground(ctx);
    buildAirfield(batch);
    buildTerminal(ctx);
    buildApron(ctx);
    buildLandside(ctx);
    batch.flush(world.root);
  },
};
