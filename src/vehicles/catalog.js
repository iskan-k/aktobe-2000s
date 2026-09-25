import { PAL } from '../core/palette.js';
import { rngKit } from '../core/util.js';
import { buildCar } from './models/carBuilder.js';
import { CLASSIC_SPECS } from './models/lada.js';
import { IMPORT_SPECS, OTHER_SPECS, TAXI_SPECS } from './models/cars.js';
import { BUS_SPECS, buildBus } from './models/buses.js';
import { VAN_SPECS, buildVan } from './models/vans.js';
import { TRUCK_SPECS } from './models/trucks.js';
import { eraPlate } from './plates.js';

/* ------------------------------------------------------------------ *
 * Vehicle catalogue.
 *
 * `buildVehicle(type, opts)` returns a VehicleModel. Every model obeys
 * the same contract, which is all the traffic, transit and driving code
 * ever looks at:
 *
 *   group        THREE.Group; origin on the ground at the centre of the
 *                footprint; the FRONT faces local -z; the driver's right
 *                (the kerb side, where bus doors are) is local +x
 *   type, kind   catalogue key, and 'car' | 'bus' | 'marshrutka' | 'truck'
 *   length, width, height, wheelbase, wheelRadius   metres
 *   wheels       Object3D[]: spin about local x (rotation.x = -angle)
 *   steer        Object3D[]: front wheel pivots, rotation.y = steer angle
 *   brake        Object3D | null: brake lights, toggle .visible
 *   blink        { left, right } | null: indicator lamps, toggle .visible
 *   doors        [{ set(t) }] t = 0 closed .. 1 open (buses, marshrutkas)
 *   doorPos      [{ x, z }] local points outside each passenger door
 *   driverEye    { x, y, z } local, for first-person driving
 *   seats        [{ x, y, z, yaw }] local passenger eye points
 *   engine       'petrol' | 'diesel' | 'bus' | 'electric'
 *   routeBoard   function(text) | null: paint the route number sign
 *
 * Optional extras some models carry: `interior` (a Group shown only in
 * the driver's-seat camera), `poleTips` (trolleybus pole ends), `plate`.
 *
 * `opts`: { color, seed, plate, parked, player, route, routeLabel }.
 * ------------------------------------------------------------------ */

/* ------------------------------------------------------------ colours */

// Soviet and post-Soviet factory colours, sun-bleached
const LADA_COLORS = [
  [0xe9e5da, 10],  // белая ночь
  [0xd9c7a0, 4],   // сафари
  [0x7d1d27, 5],   // вишня
  [0x4a2a44, 3],   // баклажан
  [0x2f5a4a, 3],   // green metallic
  [0x2d4a78, 4],   // синий
  [0x9aa4a8, 3],   // silver
  [0xb8342c, 2],   // коррида red
  [0x6d7f4a, 1],   // хаки
  [0x2a3140, 2],   // мокрый асфальт
];
const IMPORT_COLORS = [
  [0x1f2022, 6], [0xa9adb0, 6], [0x26324a, 4], [0x6a1f24, 3], [0x2e4d3e, 3],
  [0xe8e6de, 4], [0x4d5358, 3], [0x8a8f6a, 1],
];
const JAPAN_COLORS = [[0xe9e7e0, 5], [0xb8bcbe, 5], [0x2a2c30, 4], [0x5a6b52, 2], [0x3a4a66, 2]];

/* ------------------------------------------------------------ registry */

/**
 * Types available to traffic. `weight` is the share of ordinary traffic
 * (0 = never spawned as random traffic; route vehicles use ROUTE_TYPES).
 */
export const TYPES = {};

function registerCar(spec, colors) {
  TYPES[spec.id] = {
    weight: spec.weight ?? 1, kind: spec.kind ?? 'car', colors,
    build: (o) => buildCar(spec, o),
  };
}

for (const s of Object.values(CLASSIC_SPECS)) registerCar(s, LADA_COLORS);
for (const s of Object.values(IMPORT_SPECS)) registerCar(s, IMPORT_COLORS);
registerCar(OTHER_SPECS.nexia, [[0xe9e7e0, 5], [0xb8bcbe, 4], [0x2a2c30, 3], [0x6a1f24, 2], [0x2d4a78, 2]]);
registerCar(OTHER_SPECS.camry30, JAPAN_COLORS);
registerCar(OTHER_SPECS.landCruiser80, [[0xe9e7e0, 4], [0x3a4a3a, 3], [0xa9adb0, 3], [0x2a2c30, 2]]);
registerCar(OTHER_SPECS.volga24, [[0xe9e5da, 3], [0x2d2d30, 3], [0xd9c7a0, 2], [0x8a8f6a, 1], [0x2d4a78, 2]]);
registerCar(OTHER_SPECS.volga3110, [[0xe9e5da, 3], [0x2d2d30, 4], [0x9aa4a8, 3], [0x6a1f24, 2]]);
registerCar(OTHER_SPECS.moskvich2141, LADA_COLORS);
registerCar(OTHER_SPECS.uaz469, [[0x5b6a3c, 6], [0x7a7a5a, 1], [0x3e5a7a, 1]]);
registerCar(TAXI_SPECS.passatTaxi, [[0xb8342c, 6], [0xe9e5da, 2], [0xe0b52e, 1]]);
registerCar(TAXI_SPECS.volgaTaxi, [[0xe0b52e, 3], [0xe9e5da, 3]]);

for (const s of Object.values(BUS_SPECS)) {
  TYPES[s.id] = { weight: 0, kind: s.kind, build: (o) => buildBus(s, o) };
}

for (const s of [...Object.values(VAN_SPECS), ...Object.values(TRUCK_SPECS)]) {
  TYPES[s.id] = { weight: s.weight ?? 0, kind: s.kind, colors: s.colors, build: (o) => buildVan(s, o) };
}

/** Which catalogue types serve a route of a given kind. */
export const ROUTE_TYPES = {
  bus: ['ikarus260', 'manSL202'],
  paz: ['paz3205', 'county'],
  marshrutka: ['gazelle3221', 'gazelle3221', 'sprinter'],
  trolleybus: ['ziu682', 'btz5276'],
};

/**
 * Types that may stand parked in yards and on kerbs. A type appears once
 * per unit of traffic weight, so a uniform pick from this list still
 * parks many more Zhigulis than Land Cruisers.
 */
export const PARKED_TYPES = Object.keys(TYPES)
  .filter((k) => TYPES[k].kind === 'car')
  .flatMap((k) => Array(Math.max(1, Math.round(TYPES[k].weight))).fill(k));

/** Pick a random traffic type by weight. */
export function randomType(rng) {
  return rng.weighted(Object.entries(TYPES).filter(([, t]) => t.weight > 0).map(([k, t]) => [k, t.weight]));
}

/** Paint colour for a car of that era, by weight; per type where known. */
export function randomCarColor(rng, type = null) {
  const list = (type && TYPES[type]?.colors) || LADA_COLORS;
  return rng.weighted(list);
}

export { LADA_COLORS, IMPORT_COLORS, JAPAN_COLORS };

/** Generic names other code may ask for, mapped to a real model. */
const ALIAS = { car: 'lada2107', bus: 'ikarus260', paz: 'paz3205', marshrutka: 'gazelle3221', trolleybus: 'ziu682', truck: 'gaz3307', taxi: 'volgaTaxi' };

export function buildVehicle(type, opts = {}) {
  const t = TYPES[type] || TYPES[ALIAS[type]] || TYPES.lada2107;
  const rng = rngKit((opts.seed ?? 1) * 7 + 3);
  const color = opts.color ?? (t.colors ? rng.weighted(t.colors) : undefined);
  const plate = opts.plate === undefined ? undefined : eraPlate(opts.plate, opts.seed ?? 1, { company: t.kind !== 'car' });
  const m = t.build({ ...opts, color, plate });
  m.type = type;
  return m;
}

export { PAL };
