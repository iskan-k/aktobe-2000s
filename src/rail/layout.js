import { RAIL, PORTAL_REACH, halfWidth, roadById } from '../world/plan.js';

/* ------------------------------------------------------------------ *
 * Railway layout shared by the static corridor (station.js, corridor.js)
 * and the moving parts (train.js, crossing.js). Everything derives from
 * RAIL in plan.js; this file only adds the railway's own dimensions.
 *
 * The line is jointed track of the old kind, laid low: ballast flush with
 * the ground, rail heads 0.18 m up, so the level crossing deck sits at
 * kerb height and the pavements run straight onto it.
 * ------------------------------------------------------------------ */

export const RAIL_Y = 0.18;          // top of rail
export const SLEEPER_TOP = 0.06;
export const GAUGE = RAIL.gauge;     // 1.52 m, Russian gauge
export const JOINT = 25;             // rail length: one "ta-dam" every 25 m
export const TRACK_SOUTH = RAIL.tracks[0];   // by the platform
export const TRACK_NORTH = RAIL.tracks[1];
export const REACH = PORTAL_REACH;

/** The main platform, as planned, and its low extensions at each end. */
export const PLATFORM = { ...RAIL.platform };
export const PLATFORM_MID = (PLATFORM.x0 + PLATFORM.x1) / 2;

/** Footbridge over the tracks, just east of the platform. */
export const BRIDGE = {
  x: 31, width: 3.2, deckY: 7.2,
  z0: RAIL.corridor[1] - 0.5,   // south end of the span, over the corridor edge
  z1: RAIL.corridor[0] + 0.5,   // north end
  stairRun: 12.6,
};

/** The level crossing on пр. Санкибай батыра. */
const east = roadById.east;
export const CROSSING = {
  x: RAIL.crossingX,
  hw: halfWidth(east),
  outer: halfWidth(east) + Math.max(east.walk[0], east.walk[1]),
  // barriers stand a few metres outside the outer tracks
  zSouth: RAIL.corridor[1] - 2.2,   // for northbound traffic
  zNorth: RAIL.corridor[0] + 2.2,   // for southbound traffic
  stopGap: 6,                       // vehicles stop this far before a barrier
  deckZ0: TRACK_NORTH - 2.4,
  deckZ1: TRACK_SOUTH + 2.4,
  deckY: 0.15,                      // level with the pavements
  ramp: 1.6,                        // carriageway hump either side of the deck
  warn: 25,                         // seconds of lights before a train arrives
  lower: 6,                         // lights flash this long before the arms fall
};

/** Where the station building stands (its back wall on the corridor edge). */
export const STATION = { x0: -104, x1: -8, zBack: RAIL.corridor[1], depth: 17 };

/** Which track a service uses: passenger trains call at the platform. */
export const TRACK_OF = { passenger: TRACK_SOUTH, freight: TRACK_NORTH };

/** Depot siding: runs off the north track and west into the shed. */
export const DEPOT = {
  z: -188,                       // siding centreline north of the rails
  shed: { x0: -228, x1: -178, z0: -194.5, z1: -181.5 },
  curve: { x0: -142, x1: -40 },  // S-curve between siding and main line
};

/** Siding centreline z at x (straight west of curve.x0, joins the north track at curve.x1). */
export function sidingZ(x) {
  const { x0, x1 } = DEPOT.curve;
  if (x <= x0) return DEPOT.z;
  if (x >= x1) return TRACK_NORTH;
  const t = (x - x0) / (x1 - x0);
  return DEPOT.z + (TRACK_NORTH - DEPOT.z) * (1 - Math.cos(Math.PI * t)) / 2;
}

/**
 * Colour-light signals, one per track and direction, on the right of the
 * line where there is room and on the outside where there is not.
 */
export const SIGNAL_POSTS = [
  { track: TRACK_SOUTH, dir: 1, x: 44, z: TRACK_SOUTH + 2.6 },
  { track: TRACK_SOUTH, dir: -1, x: -138, z: TRACK_SOUTH + 2.6 },
  { track: TRACK_NORTH, dir: 1, x: -150, z: TRACK_NORTH - 2.6 },
  { track: TRACK_NORTH, dir: -1, x: 150, z: TRACK_NORTH - 2.6 },
];

/** The game clock: the walk starts at half past five on a June evening. */
export const CLOCK_START = 17 * 3600 + 30 * 60;
export const clockSeconds = (game) => CLOCK_START + (game?.time || 0);
export function clockText(sec) {
  const m = Math.floor(sec / 60) % (24 * 60);
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
}
