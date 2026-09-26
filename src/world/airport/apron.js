import * as THREE from 'three';
import { cel } from '../../core/toon.js';
import { B, APRON, STANDS, TAXILANE_Z, LINK_X, HANGARS, FENCE, TERMINAL } from './layout.js';
import { mark, numerals, meshFence } from './airfield.js';
import { stairsTruck, fuelBowser, baggageCarts, parkedTug } from './gse.js';

/* ------------------------------------------------------------------ *
 * The apron behind the terminal: stand markings, the ramp stairs and
 * the fuel bowser waiting by the stands, baggage carts, the floodlight
 * masts, two arched hangars and the fuel farm to the west, the airfield
 * radar turning on its mast, and the chain-link fence between all this
 * and the walker (colliders only where the walkable land meets it).
 * ------------------------------------------------------------------ */

const YELLOW = 0xe8b830, WHITE = 0xf2f0e8, RED = 0xc8302a;

function markings(far) {
  // taxilane centreline, and the lead-in lines, stop bars and numbers of the stands
  mark(far, APRON.x0 + 10, TAXILANE_Z - 0.15, APRON.x1 - 6, TAXILANE_Z + 0.15, YELLOW);
  mark(far, LINK_X - 0.15, TAXILANE_Z, LINK_X + 0.15, APRON.z1, YELLOW);
  for (const s of STANDS) {
    mark(far, s.x - 0.15, s.nose + 1, s.x + 0.15, TAXILANE_Z, YELLOW);
    for (const k of [2, 4, 6]) mark(far, s.x - 2.5, s.nose + k * 5 - 0.2, s.x + 2.5, s.nose + k * 5 + 0.2, YELLOW);
    numerals(far, String(s.id), s.x + 6, s.nose + 30, [0, -1], 0.4, YELLOW);
    // the equipment box by the nose: a red line round it
    const x0 = s.x - 14, x1 = s.x - 5, z0 = FENCE.z + 1, z1 = FENCE.z + 10;
    mark(far, x0, z0, x1, z0 + 0.2, RED);
    mark(far, x0, z1 - 0.2, x1, z1, RED);
    mark(far, x0, z0, x0 + 0.2, z1, RED);
    mark(far, x1 - 0.2, z0, x1, z1, RED);
  }
  // the service road along the terminal: two white lines
  mark(far, APRON.x0 + 20, FENCE.z + 11, APRON.x1 - 4, FENCE.z + 11.2, WHITE);
  mark(far, APRON.x0 + 20, FENCE.z + 17, APRON.x1 - 4, FENCE.z + 17.2, WHITE);
}

function equipment(far) {
  // stairs by the front door of every stand, the bowser and carts in between
  for (const s of STANDS) stairsTruck(far, s.x - 4.6, s.nose + 4.2, Math.PI, { color: s.id % 2 ? 0xe0a020 : 0xe8e4d6 });
  fuelBowser(far, (STANDS[1].x + STANDS[2].x) / 2, FENCE.z + 5, Math.PI / 2);
  baggageCarts(far, (STANDS[0].x + STANDS[1].x) / 2 - 5, FENCE.z + 4, Math.PI / 2, 4);
  parkedTug(far, (STANDS[2].x + STANDS[3].x) / 2 + 12, FENCE.z + 4.5, Math.PI / 2);
  // cones at the stand noses
  for (const s of STANDS) {
    for (const dx of [-3, 3]) {
      far.cyl(0.18, 0.7, 0xff6a1a, s.x + dx, 0, s.nose - 2, { rTop: 0.03, seg: 6, cast: false });
    }
  }
}

function floodMast(far, x, z) {
  const H = 24;
  for (const [sx, sz] of [[1, 1], [1, -1], [-1, -1], [-1, 1]]) {
    far.tube(x + sx * 1.1, 0, z + sz * 1.1, x + sx * 0.3, H, z + sz * 0.3, 0.07, 0x9a9e9e, { seg: 4, cast: false });
  }
  for (let y = 3; y < H; y += 3) far.box(0.9 + (H - y) * 0.03, 0.06, 0.9 + (H - y) * 0.03, 0x9a9e9e, x, y, z, { cast: false });
  far.box(3.6, 0.2, 1.4, 0x6a6e70, x, H, z, { cast: false });
  for (let i = 0; i < 4; i++) {
    far.box(0.7, 0.5, 0.2, 0xfff0c8, x - 1.2 + i * 0.8, H + 0.3, z - 0.5, { mat: 'glow', cast: false });
  }
}

/** An arched hangar, doors toward the apron (east), half open. */
function hangar(far, { x, z, w, d, h }) {
  const wall = 0xc8ccc8, roof = 0x9aa0a2;
  far.box(w, h * 0.55, 0.4, wall, x, 0, z - d / 2);
  far.box(w, h * 0.55, 0.4, wall, x, 0, z + d / 2);
  const g = new THREE.CylinderGeometry(d / 2, d / 2, w, 20, 1, true, -Math.PI / 2, Math.PI);
  g.rotateZ(Math.PI / 2);
  g.scale(1, (h * 0.45) / (d / 2), 1);
  g.translate(x, h * 0.55, z);
  far.add(g, { color: roof });
  // the back gable: a half disc over a wall
  const back = new THREE.CircleGeometry(d / 2, 20, 0, Math.PI);
  back.scale(1, (h * 0.45) / (d / 2), 1);
  back.rotateY(-Math.PI / 2);
  back.translate(x - w / 2, h * 0.55, z);
  far.add(back, { color: wall });
  far.box(0.4, h * 0.55, d, wall, x - w / 2, 0, z);
  // the doors: corrugated leaves slid to both sides, the dark inside between
  far.box(0.3, h * 0.55, d * 0.36, 0xa8aeb0, x + w / 2, 0, z - d * 0.3);
  far.box(0.3, h * 0.55, d * 0.36, 0xa8aeb0, x + w / 2, 0, z + d * 0.3);
  far.box(0.1, h * 0.55, d * 0.3, 0x2a2e30, x + w / 2 - 1, 0, z);
  far.box(0.5, 1.2, d, 0xd8dcd8, x + w / 2, h * 0.55, z);
}

function fuelFarm(far, x, z) {
  for (let i = 0; i < 3; i++) {
    far.cyl(5, 8, 0xe8e8e4, x + i * 13, 0, z, { seg: 18 });
    far.cyl(5.1, 0.6, 0xc8302a, x + i * 13, 6.6, z, { seg: 18 });
    far.cyl(5.05, 0.6, 0xd4d4d0, x + i * 13, 8, z, { rTop: 1, seg: 18 });
  }
  far.box(40, 1.2, 0.4, 0xb4b0a6, x + 13, 0, z - 7);
  far.box(40, 1.2, 0.4, 0xb4b0a6, x + 13, 0, z + 7);
}

/** The surveillance radar: a curved antenna turning on a lattice mast. */
function radar(ctx, far, x, z) {
  const H = 16;
  for (const [sx, sz] of [[1, 1], [1, -1], [-1, -1], [-1, 1]]) {
    far.tube(x + sx * 2, 0, z + sz * 2, x + sx * 0.8, H, z + sz * 0.8, 0.1, 0xc8c8c4, { seg: 4, cast: false });
  }
  far.box(2.6, 0.3, 2.6, 0x8a8e90, x, H, z);
  const dish = new THREE.CylinderGeometry(4, 4, 2.4, 16, 1, true, -0.9, 1.8);
  dish.translate(0, 1.6, 0);
  const mesh = new THREE.Mesh(dish, cel({ color: 0xe8e8e4, side: THREE.DoubleSide, grime: 0, dirt: 0 }));
  mesh.position.set(x, H + 0.3, z);
  mesh.castShadow = true;
  ctx.root.add(mesh);
  ctx.update((dt) => { mesh.rotation.y += dt * 1.1; });
}

/** The fence between the walker and the apron, with its colliders. */
function fence(ctx, far) {
  const segs = [
    [B.x0, FENCE.z, TERMINAL.x0, FENCE.z],
    [TERMINAL.x1, FENCE.z, FENCE.x, FENCE.z],
    [FENCE.x, FENCE.z, FENCE.x, B.z1],
  ];
  for (const [x0, z0, x1, z1] of segs) {
    meshFence(far, x0, z0, x1, z1);
    ctx.colliders.box(Math.min(x0, x1) - 0.15, Math.min(z0, z1) - 0.15, Math.max(x0, x1) + 0.15, Math.max(z0, z1) + 0.15, { tag: 'fence' });
  }
  // a gate with a barrier for the apron service road, by the tower
  far.box(0.4, 1.1, 0.4, 0xd8d4c8, TERMINAL.x0 - 8, 0, FENCE.z);
  far.tube(TERMINAL.x0 - 8, 1.0, FENCE.z, TERMINAL.x0 - 2, 1.0, FENCE.z, 0.06, RED, { seg: 4 });
}

export function buildApron(ctx) {
  const far = ctx.batch;
  markings(far);
  equipment(far);
  for (const x of [-260, -160, -40]) floodMast(far, x, APRON.z1 - 12);
  for (const h of HANGARS) hangar(far, h);
  fuelFarm(far, -330, 400);
  radar(ctx, far, -420, 385);
  fence(ctx, far);
}
