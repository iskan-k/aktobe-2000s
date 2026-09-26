import { BLOCKS } from '../plan.js';

/* ------------------------------------------------------------------ *
 * Where everything in the stadium block stands.
 *
 * The Central Stadium (1975) is an "English" ground: football only, no
 * running track, four stands close to the pitch, named after the
 * compass. The west stand is the main one, with the roof, the press box
 * and the VIP seats; its back faces the forecourt on ул. Айтеке би.
 * The floodlight masts stand in the four open corners.
 *
 *   x  -12 .. 24     forecourt, flags, КАССА, poster boards
 *   x   24 .. 160    the stadium inside its railings
 *   x  166 .. 230    the training pitch
 *   z  160 .. 182    the car park, along the town fence
 *   z  342 .. 380    grass and trees, down to the south fence
 * ------------------------------------------------------------------ */

export const B = BLOCKS.stadium;

/** The pitch: 105 x 68 m, long axis north-south. */
export const PITCH = { x: 95, z: 262, w: 68, l: 105 };
PITCH.x0 = PITCH.x - PITCH.w / 2;
PITCH.x1 = PITCH.x + PITCH.w / 2;
PITCH.z0 = PITCH.z - PITCH.l / 2;
PITCH.z1 = PITCH.z + PITCH.l / 2;

/** The grass inside the stands: the pitch plus its run-off. */
export const FIELD = { x0: PITCH.x0 - 6, x1: PITCH.x1 + 6, z0: PITCH.z0 - 8, z1: PITCH.z1 + 8 };

/** Terrace steps: every row is this deep and this much higher than the last. */
export const ROW = { depth: 0.8, rise: 0.38 };
/** Height of the first row above the pitch (the wall along the grass). */
export const FRONT_H = 1.3;

/**
 * The four stands. `yaw` turns the stand's local frame (x = out from the
 * pitch, z = along the stand) into the world; `origin` is the world point
 * of local (0, 0, 0): the foot of the front wall at the start of the stand.
 * `walk` is the depth of the walkway behind the last row.
 */
const alongWE = [FIELD.z0 + 4, FIELD.z1 - 4];
const alongNS = [PITCH.x0, PITCH.x1];
export const STANDS = {
  west: {
    rows: 24, walk: 4.6, seats: 'plastic', roof: true,
    yaw: Math.PI, origin: { x: FIELD.x0, z: alongWE[1] }, len: alongWE[1] - alongWE[0],
  },
  east: {
    rows: 20, walk: 2.2, seats: 'plastic', letters: 'АКТОБЕ',
    yaw: 0, origin: { x: FIELD.x1, z: alongWE[0] }, len: alongWE[1] - alongWE[0],
  },
  north: {
    rows: 14, walk: 2.2, seats: 'bench',
    yaw: Math.PI / 2, origin: { x: alongNS[0], z: FIELD.z0 }, len: alongNS[1] - alongNS[0],
  },
  south: {
    rows: 14, walk: 2.2, seats: 'bench',
    yaw: -Math.PI / 2, origin: { x: alongNS[1], z: FIELD.z1 }, len: alongNS[1] - alongNS[0],
  },
};

for (const s of Object.values(STANDS)) {
  s.depth = s.rows * ROW.depth + s.walk;       // front wall to back wall
  s.top = FRONT_H + (s.rows - 1) * ROW.rise;   // the last row and the walkway
}

/** Local stand coordinates (out, along) to world (x, z). */
export function standToWorld(s, out, along) {
  const c = Math.cos(s.yaw), n = Math.sin(s.yaw);
  return {
    x: s.origin.x + out * c + along * n,
    z: s.origin.z - out * n + along * c,
  };
}

/** A local rectangle of a stand as a world AABB [x0, z0, x1, z1]. */
export function standRect(s, out0, out1, a0, a1) {
  const p = standToWorld(s, out0, a0), q = standToWorld(s, out1, a1);
  return [Math.min(p.x, q.x), Math.min(p.z, q.z), Math.max(p.x, q.x), Math.max(p.z, q.z)];
}

/** The railings round the stadium grounds, with the gates in them. */
export const RAIL = { x0: 22, x1: 162, z0: 184, z1: 342 };
/** Turnstile gates: west side north and south of the main stand, east side the same. */
export const GATES = [
  { side: 'w', z: 194 }, { side: 'w', z: 331 },
  { side: 'e', z: 194 }, { side: 'e', z: 331 },
];
/** The main entrance in the middle of the west front. */
export const LOBBY = { x0: 24.6, x1: 31.4, z0: 250, z1: 274 };

/** Floodlight masts in the open corners, heads aimed at the centre spot. */
export const MAST_H = 42;
export const MASTS = [
  { x: 40, z: 191 }, { x: 150, z: 191 },
  { x: 40, z: 333 }, { x: 150, z: 333 },
];

/** Forecourt between the pavement of ул. Айтеке би and the railings. */
export const FORECOURT = { x0: B.x0, x1: RAIL.x0, z0: 186, z1: 338 };

export const TRAINING = { x: 198, z: 258, w: 56, l: 90 };

export const PARKING = { x0: 2, x1: 150, z0: 161, z1: 181 };

/** The club's red and white, and the concrete of 1975. */
export const COL = {
  red: 0xc0242a, redDark: 0x8e1a1f, white: 0xf2efe8,
  concrete: 0xbab5aa, concreteDark: 0x9a958a, concreteLight: 0xd2cdc2,
  steel: 0x8e9296, steelDark: 0x5e6266, paintGreen: 0x3f6a4a,
};
