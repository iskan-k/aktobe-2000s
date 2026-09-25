import * as THREE from 'three';
import { PAL } from '../../core/palette.js';
import { cel } from '../../core/toon.js';
import { SURF, TILE, hQuad } from '../../core/surfaces.js';
import { signTex } from '../../core/textures.js';
import { rngKit } from '../../core/util.js';
import { Batch } from '../../core/batch.js';
import { BLOCKS } from '../plan.js';
import { addWires } from '../props/street.js';
import { addPlot, fenceRun } from '../buildings/house.js';
import { frame, tbox, TILES, KIT } from '../buildings/houseKit.js';
import '../buildings/houseSounds.js';

/* ------------------------------------------------------------------ *
 * District: the private sector (частный сектор) between ул. Пушкина and
 * ул. Айтеке би, north of the avenue.
 *
 * Four rows of five plots: one row fronting ул. Вокзальная, two back to
 * back on either side of a dirt lane (ул. Садовая, not in the traffic
 * network), and one fronting the avenue. Along the lane: wooden power
 * poles on concrete stubs with the usual web of wires and service drops,
 * the yellow gas main on little posts that climbs over every gate in a
 * П, a cast-iron standpipe at the corner, a chained dog, a car or two by
 * the gates. One plot is a corner shop; one is a bare lot for sale.
 * ------------------------------------------------------------------ */

const B = BLOCKS.privateSector;
const LANE = { z0: -62.5, z1: -56.5 };
const GAS = 0xe0b12c;

export const privateSector = {
  name: 'privateSector',
  build(world) {
    // the district's own batch with one big cell: a few dozen materials
    // over six 64 m cells made too many draw calls
    const batch = new Batch({ name: 'privateSector', cell: Infinity });
    buildSector({ ...world, batch });
    batch.flush(world.root);
  },
};

function buildSector(ctx) {
  const rng = rngKit(1905);
  const W = (B.x1 - B.x0) / 5;
  const rows = [
    // faces ул. Вокзальная, to the north
    { ry: 0, oz: B.z0, D: -84.45 - B.z0, back: true, name: 'north' },
    // faces the lane, to the south
    { ry: Math.PI, oz: LANE.z0, D: LANE.z0 - -84.45, back: false, name: 'laneN' },
    // faces the lane, to the north
    { ry: 0, oz: LANE.z1, D: -36.2 - LANE.z1, back: true, name: 'laneS' },
    // faces the avenue, to the south
    { ry: Math.PI, oz: B.z1, D: B.z1 - -36.2, back: false, name: 'avenue' },
  ];
  const plots = [];
  let seed = 4100;
  rows.forEach((row, ri) => {
    for (let i = 0; i < 5; i++) {
      const ox = row.ry === 0 ? B.x0 + i * W : B.x0 + (i + 1) * W;
      const special = (ri === 1 && i === 3) ? 'lot' : (ri === 3 && i === 2) ? 'shop' : null;
      const p = { ox, oz: row.oz, ry: row.ry, W, D: row.D, seed: seed++, back: row.back, lastInRow: i === 4, row: row.name, special };
      if (special === 'lot') {
        p.result = emptyLot(ctx, p);
      } else {
        p.result = addPlot(ctx, { ...p, style: pickStyle(rng, ri, i) });
        if (special === 'shop') cornerShop(ctx, p);
      }
      gasMain(ctx, p);
      if (p.result.gateWorld) knockable(ctx, p);
      plots.push(p);
    }
  });

  lane(ctx);
  poles(ctx, plots, rng);
  standpipe(ctx, -138.4, -59.5);
  yardDog(ctx, plots.find((p) => p.row === 'laneS' && p.result.houseLeft !== undefined && !p.special), rng);
  gasCrossing(ctx);

  // cars by the gates on the lane
  for (const p of plots.filter((q) => (q.row === 'laneN' || q.row === 'laneS') && q.result.gateWorld)) {
    if (!rng.chance(0.35)) continue;
    const L = p.result.L;
    const gx = p.result.gateLocal;
    const c = L(gx + 2.0, -1.65);
    ctx.parking.push({ x: c[0], z: c[1], ry: p.ry + Math.PI / 2 * (rng.chance(0.5) ? 1 : -1), chance: 1 });
  }
}

function pickStyle(rng, row, i) {
  // the lane gets the older wooden houses, the streets the plastered ones
  if (row === 1 || row === 2) return rng.pick(['maroon', 'lime', 'brownWood', 'lime', 'blueWood', 'limeGreen']);
  return rng.pick(['lime', 'paleYellow', 'brick', 'limeGreen', 'maroon']);
}

/* ------------------------------------------------------------------ lane */

function lane(ctx) {
  const { batch } = ctx;
  batch.add(hQuad(B.x0, LANE.z0, B.x1, LANE.z1, -0.032, TILE.sand), { mat: SURF.sand, color: null, cast: false });
  // two compacted ruts
  for (const z of [-60.4, -58.6]) {
    batch.add(hQuad(B.x0, z - 0.35, B.x1, z + 0.35, -0.028, TILE.dirt), { mat: SURF.dirt, color: null, cast: false });
  }
  // lane name plate on the first house wall
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.32), cel({ map: signTex({ w: 256, h: 92, bg: '#2a4f8c', fg: '#ffffff', lines: ['ул. Садовая', 'Бақша көшесі'], sizes: [1.1, 0.8], wear: 0.8, seed: 5 }), cache: false }));
  sign.position.set(B.x0 + 1.4, 2.4, LANE.z1 + 0.25);
  sign.rotation.y = Math.PI;
  ctx.root.add(sign);
}

/* ------------------------------------------------------------------ gas main */

/** The yellow gas main along a plot front, rising over the gate in a П. */
function gasMain(ctx, p) {
  const { batch } = ctx;
  const L = frame(p.ox, p.oz, p.ry);
  const z = -0.22, y = 2.25, yHigh = 4.3;
  const r = 0.035;
  const gx0 = p.result.gateLocal !== undefined ? p.result.gateLocal - 0.35 : null;
  const gx1 = gx0 !== null ? gx0 + 4.65 + 0.7 : null;
  const seg = (x0, y0, x1, y1) => {
    const a = L(x0, z), b = L(x1, z);
    batch.tube(a[0], y0, a[1], b[0], y1, b[1], r, GAS, { seg: 6 });
  };
  if (gx0 === null) {
    seg(0, y, p.W, y);
  } else {
    seg(0, y, gx0, y);
    seg(gx0, y, gx0, yHigh);
    seg(gx0, yHigh, gx1, yHigh);
    seg(gx1, yHigh, gx1, y);
    seg(gx1, y, p.W, y);
  }
  // posts every 3 m, off the gate span
  for (let x = 0.4; x < p.W; x += 3) {
    if (gx0 !== null && x > gx0 - 0.3 && x < gx1 + 0.3) continue;
    const a = L(x, z - 0.02);
    batch.cyl(0.03, y, 0x6a6c6e, a[0], 0, a[1], { seg: 5 });
    batch.box(0.16, 0.04, 0.04, 0x6a6c6e, a[0], y - 0.05, a[1], { ry: p.ry });
  }
  // riser into the house: a tee, a valve and a meter box on the wall
  if (p.result.houseFront) {
    const hx = p.result.houseLeft ? p.result.houseFront[1] - 0.4 : p.result.houseFront[0] + 0.4;
    const a = L(hx, z), b = L(hx, 0.25);
    batch.tube(a[0], y, a[1], b[0], y, b[1], r, GAS, { seg: 6 });
    batch.tube(b[0], y, b[1], b[0], 1.5, b[1], r, GAS, { seg: 6 });
    const m = L(hx, 0.22);
    batch.box(0.32, 0.4, 0.2, 0xd8d4c8, m[0], 1.1, m[1], { ry: p.ry });
    batch.box(0.1, 0.1, 0.12, 0xb8342b, a[0], y - 0.05, a[1], { ry: p.ry });
  }
}

/** Where the main crosses the lane at each end: a tall П over the road. */
function gasCrossing(ctx) {
  const { batch } = ctx;
  for (const x of [B.x0 + 0.6, B.x1 - 0.6]) {
    const z0 = LANE.z0 - 0.3, z1 = LANE.z1 + 0.3;
    const y = 2.25, top = 5.2;
    batch.tube(x, y, z0, x, top, z0, 0.035, GAS, { seg: 6 });
    batch.tube(x, top, z0, x, top, z1, 0.035, GAS, { seg: 6 });
    batch.tube(x, top, z1, x, y, z1, 0.035, GAS, { seg: 6 });
    for (const z of [z0, z1]) batch.cyl(0.05, top + 0.1, 0x6a6c6e, x, 0, z + (z === z0 ? -0.1 : 0.1), { seg: 6 });
  }
}

/* ------------------------------------------------------------------ power */

function woodPole(batch, x, z, h, ry) {
  batch.cyl(0.12, h, 0x5a4636, x, 0.8, z, { rTop: 0.1, seg: 7 });
  // concrete stub (приставка) the pole is strapped to
  batch.box(0.18, 2.2, 0.16, PAL.concrete, x + 0.2, 0, z, { ry });
  for (const y of [0.9, 1.8]) batch.cyl(0.2, 0.05, 0x3a3a3a, x + 0.1, y, z, { seg: 6 });
  batch.box(1.4, 0.09, 0.09, 0x4a3a2a, x, h + 0.6, z, { ry });
  for (const s of [-0.6, -0.2, 0.2, 0.6]) {
    const dx = Math.cos(ry) * s, dz = -Math.sin(ry) * s;
    batch.cyl(0.03, 0.1, 0xdad6c8, x + dx, h + 0.69, z + dz, { seg: 5 });
  }
}

function poles(ctx, plots, rng) {
  const { batch, colliders } = ctx;
  const h = 7.6;
  const zPole = LANE.z1 - 0.35;
  const xs = [];
  for (let x = B.x0 + 4; x < B.x1 - 2; x += 27) xs.push(x);
  const tops = [];
  for (const x of xs) {
    woodPole(batch, x, zPole, h, Math.PI / 2);
    colliders.circle(x, zPole, 0.2, { tag: 'pole' });
    tops.push([x, h + 0.8, zPole]);
  }
  // four line wires along the lane
  addWires(batch, tops, { sag: 0.5, offsets: [-0.6, -0.2, 0.2, 0.6] });
  // a second line along ул. Вокзальная frontage, inside the block edge
  const north = [];
  for (let x = B.x0 + 6; x < B.x1 - 2; x += 30) {
    woodPole(batch, x, B.z0 + 0.15, h, Math.PI / 2);
    colliders.circle(x, B.z0 + 0.15, 0.2, { tag: 'pole' });
    north.push([x, h + 0.8, B.z0 + 0.15]);
  }
  addWires(batch, north, { sag: 0.5, offsets: [-0.3, 0.3] });

  // service drops from the nearest pole to each lane house gable
  for (const p of plots) {
    if (!p.result.houseWorld || (p.row !== 'laneN' && p.row !== 'laneS')) continue;
    const hw = p.result.houseWorld;
    const L = p.result.L;
    const hx = (p.result.houseFront[0] + p.result.houseFront[1]) / 2;
    const at = L(hx, 0.25);
    let best = tops[0];
    for (const t of tops) if (Math.abs(t[0] - hw[0]) < Math.abs(best[0] - hw[0])) best = t;
    const drop = [at[0], 3.9, at[1]];
    addWires(batch, [best, drop], { sag: 0.35, offsets: [-0.1, 0.1] });
    // the insulator bracket on the gable
    batch.box(0.4, 0.06, 0.06, 0x6b5238, at[0], 3.85, at[1], { ry: p.ry });
    if (rng.chance(0.3)) addWires(batch, [best, [at[0] + 0.5, 3.4, at[1]]], { sag: 0.4 });
  }
}

/* ------------------------------------------------------------------ standpipe */

function standpipe(ctx, x, z) {
  const { batch, root } = ctx;
  const col = 0x3f6d52;
  batch.cyl(0.13, 1.05, col, x, 0, z, { seg: 10 });
  batch.cyl(0.17, 0.12, col, x, 1.05, z, { seg: 10 });
  batch.cyl(0.1, 0.18, 0x2e4a3a, x, 1.17, z, { seg: 10, rTop: 0.05 });
  // spout
  batch.box(0.08, 0.08, 0.34, col, x, 0.62, z + 0.17);
  batch.box(0.07, 0.1, 0.07, col, x, 0.54, z + 0.33);
  // the puddle it always stands in
  batch.add(hQuad(x - 0.7, z + 0.05, x + 0.8, z + 1.1, -0.026, TILE.dirt), { mat: SURF.dirt, color: 0x8a7a66, cast: false });
  batch.box(0.9, 0.02, 0.6, 0x5a5850, x + 0.1, -0.03, z + 0.55, { mat: 'glass', cast: false });
  ctx.colliders.circle(x, z, 0.2, { tag: 'standpipe' });

  // the lever moves and the water runs when you use it
  const lever = new THREE.Group();
  lever.position.set(x, 1.12, z);
  const bar = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.05, 0.9), cel({ color: col }));
  bar.position.z = -0.4;
  bar.castShadow = true;
  lever.add(bar);
  root.add(lever);
  const stream = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.04, 0.5, 6), new THREE.MeshBasicMaterial({ color: 0xcfe3ee, transparent: true, opacity: 0.7 }));
  stream.position.set(x, 0.25, z + 0.33);
  stream.visible = false;
  root.add(stream);
  let t = 0;
  ctx.interact({
    x, y: 0.9, z, w: 0.8, h: 1.2, d: 1.2,
    label: 'Pump water at the колонка',
    action: (game) => {
      t = 2.6;
      game.audio.play('water', { pos: { x, y: 0.6, z } });
      game.hud.flash('Ice-cold well water. «Холодная, из скважины»');
    },
  });
  ctx.update((dt) => {
    if (t > 0) t -= dt;
    lever.rotation.x = THREE.MathUtils.lerp(lever.rotation.x, t > 0.3 ? 0.55 : 0, 1 - Math.exp(-10 * dt));
    stream.visible = t > 0.3;
    if (stream.visible) stream.scale.y = 0.9 + Math.sin(t * 40) * 0.1;
  });
}

/* ------------------------------------------------------------------ the dog */

function yardDog(ctx, p, rng) {
  if (!p) return;
  const { batch, root } = ctx;
  const L = p.result.L;
  // the kennel in the yard behind the gate, toward the fence so you see it
  const kx = p.result.gateLocal + 2.3, kz = 3.2;
  const k = L(kx, kz);
  tbox(batch, KIT.boards, TILES.boards, 1.0, 0.8, 1.2, 0x8a6a4a, k[0], 0, k[1], p.ry);
  batch.box(1.25, 0.05, 1.4, 0x6e6a64, k[0], 0.95, k[1], { ry: p.ry, rz: 0.35 });
  const door = L(kx, kz - 0.61);
  batch.box(0.42, 0.5, 0.02, 0x1d1a16, door[0], 0.05, door[1], { ry: p.ry });
  ctx.colliders.obb(k[0], k[1], 0.55, 0.65, p.ry, { top: 0.9, tag: 'kennel' });

  const dogPos = L(kx, kz - 1.3);
  // the chain, from a staple by the kennel door to the collar
  batch.tube(door[0], 0.12, door[1], dogPos[0], 0.5, dogPos[1], 0.012, 0x6a6a66, { seg: 3, cast: false });
  const dog = makeDog(rng);
  dog.position.set(dogPos[0], 0, dogPos[1]);
  dog.rotation.y = p.ry;
  root.add(dog);
  ctx.colliders.circle(dogPos[0], dogPos[1], 0.45, { tag: 'dog' });

  let barkT = 0, alert = 0, jump = 0;
  const head = dog.userData.head, tail = dog.userData.tail;
  ctx.update((dt, game) => {
    const pp = game.player.pos;
    const d = Math.hypot(pp.x - dogPos[0], pp.z - dogPos[1]);
    const near = d < 9 && !game.controller;
    alert += ((near ? 1 : 0) - alert) * (1 - Math.exp(-4 * dt));
    barkT -= dt;
    if (near && barkT <= 0) {
      game.audio.play('bark', { pos: { x: dogPos[0], y: 0.6, z: dogPos[1] } });
      barkT = 1.2 + Math.random() * 1.6;
      jump = 1;
    }
    jump = Math.max(0, jump - dt * 4);
    // lies with its head down, stands up and yaps when you come close
    dog.userData.body.position.y = 0.34 + alert * 0.12 + Math.sin(jump * Math.PI) * 0.06;
    head.rotation.x = -0.35 + alert * 0.55 - Math.sin(jump * Math.PI) * 0.25;
    tail.rotation.x = 0.5 + Math.sin(game.time * (alert > 0.5 ? 14 : 3)) * 0.4;
    // turn toward you
    if (near) {
      const want = Math.atan2(-(pp.x - dogPos[0]), -(pp.z - dogPos[1]));
      let dy = want - dog.rotation.y;
      dy = Math.atan2(Math.sin(dy), Math.cos(dy));
      dog.rotation.y += dy * (1 - Math.exp(-3 * dt));
    }
  });
  ctx.interact({
    x: dogPos[0], y: 0.5, z: dogPos[1], w: 1.2, h: 1, d: 1.2,
    label: 'Say hello to the dog',
    action: (game) => {
      game.audio.play('bark', { pos: { x: dogPos[0], y: 0.6, z: dogPos[1] }, rate: 1.15 });
      game.hud.flash('Шарик is not interested in friendship. He is on duty.');
    },
  });
}

/**
 * A yard mongrel in black and tan, built from boxes; faces local -z.
 * Body, head and tail are one merged mesh each, so the dog costs three
 * draw calls, not thirteen.
 */
function makeDog(rng) {
  const g = new THREE.Group();
  const coat = rng.pick([0x3a2a20, 0x7a5232, 0x2a2624]);
  const tan = 0xb07a44;
  const part = (parent, build) => {
    const b = new Batch({ name: 'dog', cell: Infinity });
    build(b);
    b.flush(parent);
  };
  const body = new THREE.Group();
  body.position.y = 0.34;
  g.add(body);
  // Batch boxes are base-anchored, so y below is each box's bottom face
  part(body, (b) => {
    b.box(0.34, 0.3, 0.72, coat, 0, -0.15, 0);
    b.box(0.28, 0.2, 0.2, tan, 0, -0.18, -0.3);
    for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
      b.box(0.08, 0.34, 0.08, sz < 0 ? tan : coat, sx * 0.11, -0.47, sz * 0.26);
    }
  });
  const head = new THREE.Group();
  head.position.set(0, 0.16, -0.4);
  body.add(head);
  part(head, (b) => {
    b.box(0.24, 0.22, 0.26, coat, 0, -0.11, -0.08);
    b.box(0.14, 0.12, 0.16, tan, 0, -0.1, -0.27);
    b.box(0.06, 0.05, 0.03, 0x111111, 0, -0.025, -0.36);
    for (const s of [-1, 1]) b.add(new THREE.ConeGeometry(0.06, 0.14, 4).translate(s * 0.08, 0.15, -0.05), { color: coat });
  });
  const tail = new THREE.Group();
  tail.position.set(0, 0.1, 0.36);
  body.add(tail);
  part(tail, (b) => b.box(0.05, 0.05, 0.3, coat, 0, -0.025, 0.14));
  g.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  g.userData = { body, head, tail };
  return g;
}

/* ------------------------------------------------------------------ specials */

function knockable(ctx, p) {
  const gw = p.result.gateWorld;
  const lines = [
    'Nobody answers. Somewhere inside, a television is on.',
    '«Кто там?» ...then nothing. They must have gone to the dacha.',
    'A dog starts up behind the gate, then gives up.',
    'The smell of plov drifts over the fence. Nobody comes.',
    'You hear a radio playing a song from the nineties.',
  ];
  let i = Math.floor(p.seed % lines.length);
  ctx.interact({
    x: gw[0], y: 1.1, z: gw[1], w: 1.8, h: 2, d: 0.6, ry: p.ry,
    label: 'Knock on the gate',
    action: (game) => {
      game.audio.play('knock', { pos: { x: gw[0], y: 1.2, z: gw[1] } });
      game.hud.flash(lines[i++ % lines.length], 2600);
    },
  });
}

/** A house turned into the corner shop, a common thing in the 2000s. */
function cornerShop(ctx, p) {
  const { root, batch } = ctx;
  const r = p.result;
  const L = r.L;
  const hx = (r.houseFront[0] + r.houseFront[1]) / 2;
  const tex = signTex({ w: 768, h: 160, bg: '#1f4e8c', fg: '#ffe066', lines: ['АЗЫҚ-ТҮЛІК · ПРОДУКТЫ', '«АЙГЕРИМ»'], sizes: [1, 0.8], border: '#ffe066', seed: 81, wear: 0.5 });
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(4.6, 0.95), cel({ map: tex, cache: false }));
  const s = L(hx, -0.08);
  sign.position.set(s[0], 3.0, s[1]);
  sign.rotation.y = p.ry + Math.PI;
  root.add(sign);
  // a steel door put in where the middle window was, with two steps
  const d = L(hx, -0.05);
  batch.box(1.0, 2.1, 0.08, 0x6b4a36, d[0], 0.55, d[1], { ry: p.ry });
  const st = L(hx, -0.55);
  batch.box(1.6, 0.18, 0.9, PAL.concrete, st[0], 0, st[1], { ry: p.ry });
  batch.box(1.6, 0.18, 0.45, PAL.concrete, st[0], 0.18, st[1], { ry: p.ry });
  const plate = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.3), cel({ map: signTex({ w: 160, h: 96, bg: '#ffffff', fg: '#b8342b', lines: ['АШЫҚ', 'ОТКРЫТО'], wear: 0.3, seed: 3 }), cache: false }));
  const pl = L(hx + 0.8, -0.07);
  plate.position.set(pl[0], 1.6, pl[1]);
  plate.rotation.y = p.ry + Math.PI;
  root.add(plate);
  ctx.interact({
    x: d[0], y: 1.2, z: d[1], w: 1.4, h: 2.2, d: 1, ry: p.ry,
    label: 'Buy a loaf of bread · нан, 35 ₸',
    action: (game) => {
      if (game.pay(35, 'bread')) game.hud.flash('Still warm. The shop lady says the bread truck came at six.');
    },
  });
}

/** A bare lot: fence, a foundation that has waited years, bricks, weeds, a for-sale sign. */
function emptyLot(ctx, p) {
  const { batch, root } = ctx;
  const L = frame(p.ox, p.oz, p.ry);
  fenceRun(ctx, L, p.ry, 0, 0.3, p.W, 0.3, 'sheet', 0x9aa2a6);
  fenceRun(ctx, L, p.ry, 0, 0.3, 0, p.D, 'plank', 0x8e8474, { h: 1.7 });
  const c = L(p.W / 2, 7);
  batch.box(9, 0.45, 8, PAL.concreteDark, c[0], -0.05, c[1], { ry: p.ry });
  for (let i = 0; i < 3; i++) {
    const b = L(3 + i * 1.3, 13);
    batch.box(1.0, 0.8, 1.0, 0xa65a42, b[0], 0, b[1], { ry: p.ry + i * 0.2 });
  }
  const rng = rngKit(p.seed);
  for (let i = 0; i < 40; i++) {
    const w = L(rng.range(0.5, p.W - 0.5), rng.range(1, p.D - 0.5));
    batch.box(0.3, rng.range(0.3, 0.9), 0.3, rng.pick([0x7f8a44, 0x9a9a58, 0x6e8040]), w[0], -0.02, w[1], { ry: rng.range(0, 3), mat: 'foliage' });
  }
  const sale = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 0.7), cel({ map: signTex({ w: 256, h: 150, bg: '#ffffff', fg: '#1a1a1a', lines: ['САТЫЛАДЫ', 'ПРОДАЁТСЯ', 'тел. 21-45-78'], sizes: [1, 1, 0.8], wear: 0.9, seed: 9, weight: '700' }), cache: false }));
  const sp = L(p.W / 2, 0.25);
  sale.position.set(sp[0], 1.3, sp[1]);
  sale.rotation.y = p.ry + Math.PI;
  root.add(sale);
  return {};
}
