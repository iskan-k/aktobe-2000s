import { Batch } from '../../core/batch.js';
import { buildStands } from '../stadium/stands.js';
import { buildPitch, buildTrainingPitch } from '../stadium/pitch.js';
import { buildMasts } from '../stadium/masts.js';
import { buildBall } from '../stadium/ball.js';
import { buildGrounds } from '../stadium/grounds.js';
import { buildFront } from '../stadium/front.js';
import { TRAINING } from '../stadium/layout.js';

/* ------------------------------------------------------------------ *
 * The Central Stadium, home of FC Aktobe, south of the town fence and
 * east of ул. Айтеке би (BLOCKS.stadium).
 *
 * Opened on 28 August 1975 with a match against CSKA Moscow; a football
 * ground only, with no running track, four stands for about 12 800, the
 * main stand on the west side with the press and VIP seats. Plastic
 * seats came in 2000, new floodlights and the UEFA upgrade in 2005. In
 * June 2007 Aktobe are the 2005 champions on their way to a second
 * title. See stadium/layout.js for the plan of the block.
 *
 * The stadium has its own batch, one cell for the whole block: it is
 * one compact thing, usually seen whole, so merging it into a few big
 * meshes saves draw calls that finer culling would not win back
 * (measured: 64 m cells cost 60-100 more calls in every view, 128 m
 * cells 20-50 more).
 * ------------------------------------------------------------------ */

/**
 * A batch that merges the whole block into one cell per material, and
 * folds the small variants together: plain painted parts all cast
 * shadows (one group, not two), unlit glass and lamps never do.
 */
class BlockBatch extends Batch {
  add(geometry, o = {}) {
    const mat = o.mat ?? 'solid';
    if (mat === 'solid' || mat === 'solidClean') return super.add(geometry, { ...o, mat: 'solid', cast: true });
    if (mat === 'glass' || mat === 'glow') return super.add(geometry, { ...o, cast: false });
    return super.add(geometry, o);
  }

  flush(parent) {
    const merged = new Map();
    for (const [key, grp] of this.groups) {
      const k = key.slice(key.indexOf('|') + 1);   // drop the cell part of the key
      const into = merged.get(k);
      if (into) into.parts.push(...grp.parts);
      else merged.set(k, grp);
    }
    this.groups = merged;
    return super.flush(parent);
  }
}

export const stadium = {
  name: 'stadium',
  build(ctx) {
    const batch = new BlockBatch({ name: 'stadium' });
    const sctx = { ...ctx, batch };
    buildGrounds(sctx);
    buildStands(sctx);
    buildPitch(sctx);
    buildTrainingPitch(sctx, TRAINING);
    const board = buildMasts(sctx);
    buildBall(sctx, board);
    buildFront(sctx);
    batch.flush(ctx.root);
  },
};
