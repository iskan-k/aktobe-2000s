import { BLOCKS, roadById, outerEdge } from '../plan.js';

/* ------------------------------------------------------------------ *
 * Where everything at the airport is. The walkable part (landside) is
 * BLOCKS.airport, south of the town fence and west of ул. Айтеке би:
 * the airport road (ул. Бокенбай батыра) runs across it, the terminal
 * and its forecourt face that road, and the apron lies behind the
 * terminal behind a fence. The runway, the taxiways and the approach
 * lights are out in the steppe past the walkable bounds.
 *
 * The real runway is 12/30, 3,203 x 45 m, south-west of the town. Here
 * it is turned to run east-west so the approach passes south of the
 * stadium. Landings come in from the east (runway 30, the long final
 * over open steppe); take-offs roll east from an intersection, lift off
 * south of the terminal and climb away past the stadium, as the tower
 * lets them on a calm evening.
 * ------------------------------------------------------------------ */

export const B = BLOCKS.airport;
const AERO = roadById.aero;
const MID = roadById.mid;

/** Pavement edges of the airport road. */
export const ROAD = {
  z: AERO.c,
  north: AERO.c - outerEdge(AERO, 0),    // back of the north pavement
  south: AERO.c + outerEdge(AERO, 1),    // back of the south pavement
};

/** Back of the west pavement of ул. Айтеке би. */
export const MID_W = MID.c - outerEdge(MID, 0);

/** The terminal: landside front on z0, apron side on z1. */
export const TERMINAL = { x0: -168, x1: -62, z0: 238, z1: 262, hall: [-138, -92] };

/** The control tower (КДП), just west of the terminal. */
export const TOWER = { x: -192, z: 247 };

/** The airside fence line: along the terminal's apron wall, then down the road. */
export const FENCE = { z: TERMINAL.z1 + 0.6, x: MID_W - 1.4, zEnd: 468 };

/** Apron: concrete from the fence to the taxilane and a little beyond. */
export const APRON = { x0: -340, x1: FENCE.x - 0.5, z0: FENCE.z, z1: 420 };

/** Stands: nose-in toward the terminal. `x` is the centreline, noses stop at `nose`. */
export const STANDS = [
  { id: 1, x: -205 },
  { id: 2, x: -160 },
  { id: 3, x: -115 },
  { id: 4, x: -70 },
].map((s) => ({ ...s, nose: TERMINAL.z1 + 10 }));

/** The taxilane behind the stands and the link down to the parallel taxiway. */
export const TAXILANE_Z = 345;
export const LINK_X = -92;

export const RUNWAY = {
  z: 540, w: 45,
  east: 60,                 // threshold of runway 30, landing west
  west: 60 - 3203,
  touchdown: -240,          // aiming point, 300 m in
  exit: -960,               // rapid exit for landings
  lineup: -1320,            // intersection for take-offs rolling east
  glide: Math.tan((3 * Math.PI) / 180),
};

export const TAXIWAY = { z: 490, w: 18, x0: RUNWAY.lineup - 60, x1: RUNWAY.east + 20 };

/** Hangars and the fuel farm, airside west of the stands. */
export const HANGARS = [
  { x: -292, z: 300, w: 48, d: 40, h: 14 },
  { x: -300, z: 372, w: 36, d: 30, h: 11 },
];

/** Where the pushback tug waits between jobs. */
export const TUG_PARK = { x: -92, z: 276, yaw: Math.PI };
