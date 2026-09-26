import { BLOCKS } from '../plan.js';

/* ------------------------------------------------------------------ *
 * Aktobe airport, south of the town fence and west of ул. Айтеке би.
 * The block is BLOCKS.airport; the airfield itself may run on past the
 * walkable bounds into the steppe.
 * ------------------------------------------------------------------ */

const B = BLOCKS.airport;

export const airport = {
  name: 'airport',
  build() {
    void B;
  },
};
