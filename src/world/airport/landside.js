import * as THREE from 'three';
import { SURF, TILE, hQuad } from '../../core/surfaces.js';
import { PAL } from '../../core/palette.js';
import { KERB_H } from '../plan.js';
import { hall } from '../buildings/civic.js';
import { WIN } from '../buildings/facades.js';
import { addTree } from '../props/trees.js';
import { addBench, addBin, addLamp } from '../props/street.js';
import { addLarek, addFlowers, addIceCream } from '../props/kiosk.js';
import { B, ROAD, TERMINAL, MID_W } from './layout.js';

/* ------------------------------------------------------------------ *
 * The landside: the forecourt between the airport road and the terminal
 * (a paved square with the taxi rank in a bay along the kerb, flower
 * sellers for the people meeting flights, a drinks kiosk and an ice
 * cream stand, benches under poplars), and north of the road the car
 * park by the bus stop and the two-storey brick houses of Авиагородок.
 * ------------------------------------------------------------------ */

const T = TERMINAL;
const FORE = { x0: T.x0 - 12, x1: T.x1 + 12, z0: ROAD.south, z1: T.z0 - 8 };
const BAY = { x0: -160, x1: -70, z0: ROAD.south, z1: ROAD.south + 7.5 };
const PARK = { x0: -140, x1: MID_W - 8, z0: B.z0 + 10, z1: ROAD.north - 2 };

/** A raised paved area, kerb-high, walkable. */
function paved(ctx, x0, z0, x1, z1, surf = SURF.slabs, tile = TILE.slabs) {
  ctx.batch.add(hQuad(x0, z0, x1, z1, KERB_H, tile), { mat: surf, color: null, cast: false });
  ctx.batch.box(x1 - x0, KERB_H, z1 - z0, PAL.concrete, (x0 + x1) / 2, 0, (z0 + z1) / 2, { cast: false });
  ctx.ground.flat(x0, z0, x1, z1, KERB_H);
}

function forecourt(ctx) {
  const b = ctx.batch;
  // the square: slabs west and east of the taxi bay, and all along the terminal
  paved(ctx, FORE.x0, BAY.z1, FORE.x1, FORE.z1);
  paved(ctx, FORE.x0, FORE.z0, BAY.x0, BAY.z1);
  paved(ctx, BAY.x1, FORE.z0, FORE.x1, BAY.z1);
  // the taxi bay at road level, asphalt, with its rank
  b.add(hQuad(BAY.x0, BAY.z0, BAY.x1, BAY.z1, 0.005, TILE.asphalt), { mat: SURF.asphalt, color: null, cast: false });
  const rank = ['volgaTaxi', 'passatTaxi', 'volgaTaxi', 'lada2107', 'passatTaxi', 'volgaTaxi', 'passatTaxi', 'lada2107'];
  let slot = 0;
  for (let x = BAY.x0 + 5; x < BAY.x1 - 4; x += 5.4) {
    b.box(0.1, 0.01, 5.2, 0xeeebe0, x - 2.7, 0.01, (BAY.z0 + BAY.z1) / 2, { cast: false });
    ctx.parking.push({ x, z: (BAY.z0 + BAY.z1) / 2, ry: Math.PI / 2, kind: rank[slot % rank.length], chance: 0.8 });
    slot++;
  }
  // lamps, poplars and benches along the square
  for (let x = FORE.x0 + 6; x < FORE.x1; x += 18) {
    addLamp(b, x, FORE.z1 - 2, 0, { y: KERB_H, height: 8, steel: true });
    ctx.colliders.circle(x, FORE.z1 - 2, 0.2, { tag: 'lamp' });
  }
  for (const x of [FORE.x0 + 3, FORE.x1 - 3]) {
    for (let z = BAY.z1 + 3; z < FORE.z1 - 1; z += 6) {
      addTree(b, 'poplar', x, z, 7100 + Math.round(x + z), { y: KERB_H });
      ctx.colliders.circle(x, z, 0.3, { tag: 'tree' });
    }
  }
  for (const x of [-150, -138, -92, -80]) {
    addBench(b, x, BAY.z1 + 3.2, Math.PI, { y: KERB_H });
    addBin(b, x + 1.6, BAY.z1 + 3.4, Math.PI, KERB_H);
  }
  // a lawn with a flower bed and the airport's name stone in the middle
  const lx = (T.hall[0] + T.hall[1]) / 2, lz = BAY.z1 + 7;
  b.add(hQuad(lx - 10, lz - 3, lx + 10, lz + 3, KERB_H + 0.02, TILE.grass), { mat: SURF.grass, color: null, cast: false });
  b.box(20.2, 0.25, 6.2, PAL.concrete, lx, KERB_H, lz, { cast: false });
  for (let i = 0; i < 40; i++) {
    const a = (i / 40) * Math.PI * 2;
    const g = new THREE.IcosahedronGeometry(0.22, 0);
    g.translate(lx + Math.cos(a) * 8.2, KERB_H + 0.35, lz + Math.sin(a) * 2.2);
    b.add(g, { color: i % 3 ? 0xc8203a : 0xf2d040, mat: 'foliage', cast: false });
  }
  b.box(3.4, 1.4, 0.8, 0xb8b2a6, lx, KERB_H + 0.25, lz, { cast: false });
  ctx.colliders.box(lx - 10.1, lz - 3.1, lx + 10.1, lz + 3.1, { top: KERB_H + 0.27, tag: 'bed' });
}

function kiosks(ctx) {
  // meeting a flight in 2007 meant flowers, so the flower sellers stand by the doors
  addFlowers(ctx, -160, FORE.z1 - 5, Math.PI);
  addFlowers(ctx, -157.6, FORE.z1 - 5, Math.PI);
  addLarek(ctx, -170, BAY.z1 + 8, Math.PI / 2, {
    sign: ['Сусындар', 'Напитки'],
    item: {
      label: 'A bottle of «Тархун»', price: 70, what: 'lemonade', sound: 'canOpen', hold: 'tarkhun',
      toast: 'Тархун at airport prices: seventy instead of sixty.',
    },
  });
  addIceCream(ctx, -64, BAY.z1 + 8, -Math.PI / 2);
}

/** The car park across the road, by the bus stop. */
function carPark(ctx) {
  const b = ctx.batch;
  b.add(hQuad(PARK.x0, PARK.z0, PARK.x1, PARK.z1, 0.005, TILE.asphalt), { mat: SURF.asphalt, color: null, cast: false });
  const rows = [{ z: PARK.z0 + 3, ry: 0 }, { z: PARK.z1 - 3, ry: Math.PI }];
  for (const { z, ry } of rows) {
    for (let x = PARK.x0 + 2; x < PARK.x1 - 2; x += 2.9) {
      b.box(0.1, 0.01, 5, 0xeeebe0, x - 1.45, 0.01, z, { cast: false });
      ctx.parking.push({ x, z, ry, chance: 0.55 });
    }
  }
  // the attendant's hut and a barrier
  b.box(2.4, 2.5, 2.2, 0xd8d4c6, PARK.x1 - 1.5, 0, PARK.z1 - 9);
  b.box(1.6, 0.8, 0.05, 0x3a4a56, PARK.x1 - 1.5, 1.3, PARK.z1 - 10.12, { mat: 'glass' });
  b.box(2.8, 0.15, 2.6, 0x8a4a3a, PARK.x1 - 1.5, 2.5, PARK.z1 - 9);
  ctx.colliders.box(PARK.x1 - 2.7, PARK.z1 - 10.1, PARK.x1 - 0.3, PARK.z1 - 7.9, { tag: 'hut' });
  for (let x = PARK.x0; x <= PARK.x1; x += 12) {
    addTree(b, 'young', x, PARK.z0 - 2.5, 7300 + x);
    ctx.colliders.circle(x, PARK.z0 - 2.5, 0.2, { tag: 'tree' });
  }
}

/** Авиагородок: two-storey brick houses for the airport's people, 1950s. */
function aviagorodok(ctx) {
  const b = ctx.batch;
  const houses = [
    { x: -212, z: 178, L: 26, wall: 'cream' },
    { x: -176, z: 178, L: 22, wall: 'redBrick' },
  ];
  houses.forEach((h, i) => {
    hall(ctx, { x: h.x, z: h.z, facing: Math.PI, L: h.L, D: 10, storeys: 2, storeyH: 3.1, wall: h.wall, cells: WIN.flat, winW: 1.4, winH: 1.6, bay: 3.2, seed: 60 + i });
    // a pitched roof of red-brown sheet over the flat top
    const H = 0.6 + 2 * 3.1, r = 10.8 / Math.sqrt(3);
    const roof = new THREE.CylinderGeometry(r, r, h.L + 0.8, 3, 1);
    roof.rotateZ(Math.PI / 2);
    roof.rotateX(-Math.PI / 2);
    roof.scale(1, 0.5, 1);
    roof.translate(h.x, H + 0.55 + 0.25 * r, h.z);
    b.add(roof, { color: 0x8a4a3a });
    for (let k = -1; k <= 1; k += 2) {
      addTree(b, i ? 'elm' : 'maple', h.x + k * (h.L / 2 + 4), h.z + 7, 7400 + i * 10 + k);
      ctx.colliders.circle(h.x + k * (h.L / 2 + 4), h.z + 7, 0.3, { tag: 'tree' });
    }
    addBench(b, h.x, h.z + 8.5, Math.PI);
  });
  for (let x = B.x0 + 4; x < -150; x += 7) {
    addTree(b, 'poplar', x, B.z0 + 4, 7500 + x);
    ctx.colliders.circle(x, B.z0 + 4, 0.3, { tag: 'tree' });
  }
}

export function buildLandside(ctx) {
  forecourt(ctx);
  kiosks(ctx);
  carPark(ctx);
  aviagorodok(ctx);
}
