import { createTraffic } from './traffic/sim.js';
import { createTransit } from './traffic/transit.js';
import { createCar } from './vehicles/drive.js';
import { createParked } from './vehicles/parked.js';
import { createMap } from './core/map.js';
import { createRail } from './rail/train.js';
import { createFluff } from './world/fluff.js';
import { createGroundcover } from './world/groundcover.js';
import { createFlights } from './world/airport/flights.js';

/* ------------------------------------------------------------------ *
 * Moving systems: traffic, transit, the railway, the player's car, the
 * aircraft at the airport.
 * Each entry is { name, create(game) } where create returns an object
 * with update(dt). main.js stores it as game[name]. Order matters where
 * one system reads another at creation (transit reads traffic).
 * ------------------------------------------------------------------ */

export const SYSTEMS = [
  { name: 'traffic', create: createTraffic },
  { name: 'transit', create: createTransit },
  { name: 'car', create: createCar },
  { name: 'parked', create: createParked },
  { name: 'map', create: createMap },
  { name: 'rail', create: createRail },
  { name: 'fluff', create: createFluff },
  { name: 'groundcover', create: createGroundcover },
  { name: 'flights', create: createFlights },
];
