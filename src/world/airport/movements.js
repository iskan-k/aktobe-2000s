import { groundTrack, airTrack } from './paths.js';
import { RUNWAY, TAXIWAY, TAXILANE_Z, LINK_X } from './layout.js';

/* ------------------------------------------------------------------ *
 * Arrivals and departures as lists of legs.
 *
 * A leg is { kind: 'track', track, mode, accel, decel, ... } to follow
 * a track, or { kind: 'wait', dur, ... } to stand still. `mode` sets
 * the attitude ('air', 'flare', 'rollout', 'ground', 'push', 'roll',
 * 'climb'); `thrust` 0..1 drives the engine sound; `lights` names the
 * lights that are on; `event` fires when the leg starts.
 *
 * An arrival flies a downwind leg over the town at about 330 m heading
 * east, turns in far out over the steppe, and comes back down a 3°
 * glide from the east to runway 30: flare, touchdown, reverse thrust,
 * the rapid exit, the parallel taxiway, and in to a stand. A departure
 * is pushed back, taxis to the intersection, lines up, rolls east,
 * lifts off south of the terminal and climbs out past the stadium.
 * ------------------------------------------------------------------ */

const G = RUNWAY.glide;
const glideY = (x) => (x - RUNWAY.touchdown) * G;
const HOLD_Z = RUNWAY.z - RUNWAY.w / 2 - 20;
const LAT = 1.6;                     // m/s² sideways on the ground: sets corner speeds

const AIR_LIGHTS = { nav: 1, beacon: 1, strobe: 1, land: 1 };
const TAXI_LIGHTS = { nav: 1, beacon: 1, taxi: 1 };

/** Taxi speed caps: the type's taxi speed on straights, slower through corners. */
function taxiCaps(t) {
  return (i, tr) => Math.min(t.speed.taxi, Math.max(3, Math.sqrt(LAT * tr.radius(i))));
}

/** Where the model origin (the main gear) stops for a nose-in stand. */
export const standStop = (t, stand) => stand.nose + t.gear;

export function arrivalLegs(t) {
  const app = t.speed.app;
  const Z = RUNWAY.z;
  const air = airTrack([
    [-2700, 400, -60], [-1300, 360, -60], [0, 330, -50], [1300, 300, -25], [2300, 280, 60],
    [2950, 250, Z - 300], [3050, 215, Z - 110], [2750, glideY(2750) + 6, Z], [2200, glideY(2200), Z],
    [1300, glideY(1300), Z], [500, glideY(500), Z], [RUNWAY.east, glideY(RUNWAY.east), Z],
  ], 10).vcap((i, tr) => (tr.z[i] > Z - 20 && tr.x[i] < 2600 ? app : 84), 0.9, app);
  // the flare: from the threshold down to the aiming point, easing off the descent
  const pts = [];
  for (let k = 0; k <= 30; k++) {
    const u = k / 30;
    pts.push([RUNWAY.east + (RUNWAY.touchdown - RUNWAY.east) * u, glideY(RUNWAY.east) * (1 - u) * (1 - 0.4 * u * u * u), RUNWAY.z]);
  }
  const flare = airTrack(pts, 6).vcap(() => app - 4, 1.0, app - 4);
  const rollEnd = RUNWAY.exit + 70;
  const rollout = groundTrack([[RUNWAY.touchdown, RUNWAY.z], [rollEnd, RUNWAY.z]]).vcap(() => app, 2.8, 15);
  return {
    legs: [
      { kind: 'track', track: air, mode: 'air', accel: 1, decel: 0.9, thrust: 0.45, lights: AIR_LIGHTS, gear: false, gearAt: 260 },
      { kind: 'track', track: flare, mode: 'flare', accel: 1, decel: 1, thrust: 0.3, lights: AIR_LIGHTS, gear: true },
      { kind: 'track', track: rollout, mode: 'rollout', accel: 1, decel: 2.8, thrust: 0.85, reverse: 9, lights: AIR_LIGHTS, gear: true, event: 'touchdown' },
    ],
  };
}

/** The taxi in from the rapid exit to a stand. */
export function taxiInLeg(t, stand) {
  const tr = groundTrack([
    [RUNWAY.exit + 70, RUNWAY.z], [RUNWAY.exit, RUNWAY.z], [RUNWAY.exit, TAXIWAY.z], [LINK_X, TAXIWAY.z],
    [LINK_X, TAXILANE_Z], [stand.x, TAXILANE_Z], [stand.x, standStop(t, stand)],
  ], 26).vcap(taxiCaps(t), 1.0, 0);
  return { kind: 'track', track: tr, mode: 'ground', accel: 0.7, decel: 1.0, thrust: 0.22, lights: TAXI_LIGHTS, gear: true };
}

export function departureLegs(t, stand) {
  // push back: tail first down to the taxilane, swinging the nose toward the link
  const side = stand.x < LINK_X ? -1 : 1;
  const zs = standStop(t, stand);
  const endX = stand.x + side * 28;
  const push = groundTrack([[stand.x, zs], [stand.x, TAXILANE_Z], [endX, TAXILANE_Z]], 20).vcap(() => 1.8, 0.35, 0);
  const out = groundTrack([
    [endX, TAXILANE_Z], [LINK_X, TAXILANE_Z], [LINK_X, TAXIWAY.z], [RUNWAY.lineup, TAXIWAY.z], [RUNWAY.lineup, HOLD_Z],
  ], 26).vcap(taxiCaps(t), 1.0, 0);
  const lineup = groundTrack([[RUNWAY.lineup, HOLD_Z], [RUNWAY.lineup, RUNWAY.z], [RUNWAY.lineup + 70, RUNWAY.z]], 24)
    .vcap(taxiCaps(t), 0.8, 0);
  const x0 = RUNWAY.lineup + 70;
  const roll = groundTrack([[x0, RUNWAY.z], [x0 + 2200, RUNWAY.z]]).vcap(() => t.speed.rot + 10, 3, t.speed.rot + 10);
  return {
    legs: [
      { kind: 'wait', dur: 8, until: 'tug', mode: 'ground', thrust: 0.06, lights: { nav: 1, beacon: 1 }, gear: true, event: 'tugAttach' },
      { kind: 'track', track: push, mode: 'push', accel: 0.35, decel: 0.35, thrust: 0.14, lights: { nav: 1, beacon: 1 }, gear: true },
      { kind: 'wait', dur: 7, mode: 'ground', thrust: 0.2, lights: { nav: 1, beacon: 1 }, gear: true, event: 'tugRelease' },
      { kind: 'track', track: out, mode: 'ground', accel: 0.7, decel: 1.0, thrust: 0.25, lights: TAXI_LIGHTS, gear: true },
      { kind: 'wait', dur: 9, mode: 'ground', thrust: 0.2, lights: TAXI_LIGHTS, gear: true },
      { kind: 'track', track: lineup, mode: 'ground', accel: 0.6, decel: 0.8, thrust: 0.25, lights: { ...AIR_LIGHTS, taxi: 1 }, gear: true },
      { kind: 'wait', dur: 4, mode: 'ground', thrust: 0.5, lights: { ...AIR_LIGHTS, taxi: 1 }, gear: true },
      { kind: 'track', track: roll, mode: 'roll', accel: 2.2, decel: 1, thrust: 1, lights: { ...AIR_LIGHTS, taxi: 1 }, gear: true, untilV: t.speed.rot },
      { kind: 'climb', mode: 'climb', accel: 1.4, decel: 1, thrust: 0.95, lights: AIR_LIGHTS, gear: true, gearUpAt: 35, event: 'liftoff' },
    ],
  };
}

/** The climb-out track from wherever the roll ended. */
export function climbTrack(x0, z0, t) {
  return airTrack([
    [x0, 0, z0], [x0 + 140, 1.5, z0], [x0 + 520, 26, z0], [x0 + 1200, 92, z0 - 5],
    [x0 + 2400, 215, z0 - 30], [x0 + 4200, 400, z0 - 140], [x0 + 6800, 680, z0 - 420],
  ], 8).vcap(() => t.speed.rot + 22, 1, t.speed.rot + 22);
}
