import { streetlife } from './streetlife.js';
import { mikro } from './mikro.js';
import { nineStorey } from './nineStorey.js';
import { school } from './school.js';
import { privateSector } from './privateSector.js';
import { bazaar } from './bazaar.js';
import { square } from './square.js';
import { station } from './station.js';
import { edges } from './edges.js';

/* ------------------------------------------------------------------ *
 * District registry. Each entry is { name, build(ctx) }; see
 * world/index.js for what ctx carries and plan.js for where each block
 * is. Street life (shelters, kiosks, signs) goes first so districts can
 * see which pavement spots it took in ctx.spots.
 * ------------------------------------------------------------------ */

export const DISTRICTS = [
  streetlife,
  mikro,
  nineStorey,
  school,
  privateSector,
  bazaar,
  square,
  station,
  edges,
];
