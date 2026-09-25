import { Batch } from '../../core/batch.js';
import { buildSkyline } from '../skyline.js';
import { nurdaulet } from './edgesMosque.js';
import { nurGasyr } from './edgesSite.js';
import { southEdge } from './edgesSouth.js';

/* ------------------------------------------------------------------ *
 * District: edges. See plan.js BLOCKS for its footprint.
 *
 *   west, north of the avenue   the Nurdaulet mosque and shopping centre
 *   west, south of the avenue   the Nur Gasyr mosque building site (2007)
 *   south                       garage cooperatives, waste ground with a
 *                               boys' football pitch, the high-voltage
 *                               line, and the steppe beyond
 *   beyond the bounds           the rest of the town as a low-detail
 *                               skyline (see skyline.js)
 *
 * Things that reach far past the bounds go into their own batch with
 * one huge cell, so they merge into a few draw calls instead of one per
 * 64 m cell of the static batch.
 * ------------------------------------------------------------------ */

export const edges = {
  name: 'edges',
  build(world) {
    const ctx = { ...world, batch: new Batch({ name: 'edges', cell: Infinity }) };
    nurdaulet(ctx);
    nurGasyr(ctx);
    const far = new Batch({ name: 'far', cell: Infinity });
    southEdge(ctx, far);
    buildSkyline(far);
    far.flush(world.root);
    ctx.batch.flush(world.root);
  },
};
