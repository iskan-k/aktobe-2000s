import * as THREE from 'three';
import { Batch } from '../../core/batch.js';
import { cel } from '../../core/toon.js';
import { SURF, TILE, hQuad } from '../../core/surfaces.js';
import { canvasTex, cached, centerText, signTex, FONT } from '../../core/textures.js';
import { rngKit } from '../../core/util.js';
import { KIT, TILES, tbox } from '../buildings/houseKit.js';
import '../buildings/houseSounds.js';

/* ------------------------------------------------------------------ *
 * The Nur Gasyr central mosque as a building site, summer 2007: behind
 * a blue profiled-sheet hoarding, a concrete podium with its frame of
 * columns and ring beams, the drum columns rising in the middle, four
 * minaret stubs at the corners (two in scaffolding), a tower crane that
 * slews slowly back and forth, and the usual yard of bricks on pallets,
 * rebar, sand, concrete rings and a site cabin. A bilingual board on the
 * avenue shows what it will look like.
 * ------------------------------------------------------------------ */

const C = { x: -196, z: 64 };          // centre of the future prayer hall
const POD = 21;                        // half-size of the podium
const FENCE = { x0: -230, x1: -157.6, z0: 15.4, z1: 109.4 };
const GATE = { z0: 24, z1: 32 };
const CONCRETE = 0xb4b0a6;
const CRANE_YELLOW = 0xe8b82a;

/* ------------------------------------------------------------------ hoarding and board */

function hoardingRun(ctx, x0, z0, x1, z1, color) {
  const { batch, colliders } = ctx;
  const len = Math.hypot(x1 - x0, z1 - z0);
  const ry = Math.atan2(-(z1 - z0), x1 - x0);
  const n = Math.max(1, Math.round(len / 6));
  for (let i = 0; i < n; i++) {
    const t = (i + 0.5) / n;
    tbox(batch, KIT.corrugated, TILES.corrugated, len / n - 0.02, 2.2, 0.05, color, x0 + (x1 - x0) * t, 0.05, z0 + (z1 - z0) * t, ry);
    const px = x0 + (x1 - x0) * (i / n), pz = z0 + (z1 - z0) * (i / n);
    batch.box(0.08, 2.3, 0.08, 0x5a5a5a, px, 0, pz, { ry });
  }
  colliders.obb((x0 + x1) / 2, (z0 + z1) / 2, len / 2, 0.12, ry, { top: 2.3, tag: 'hoarding' });
}

function boardTex() {
  return cached('nurgasyr-board', () => canvasTex(1024, 600, (ctx, w, h) => {
    const sky = ctx.createLinearGradient(0, 0, 0, h * 0.62);
    sky.addColorStop(0, '#4a86c8');
    sky.addColorStop(1, '#bcd8ec');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, w, h * 0.62);
    ctx.fillStyle = '#c8b890';
    ctx.fillRect(0, h * 0.52, w, h * 0.1);
    // the mosque as the architects drew it: white, a gold dome, four minarets
    const cx = w / 2, base = h * 0.56;
    ctx.fillStyle = '#f6f4ee';
    ctx.fillRect(cx - 200, base - 110, 400, 110);
    ctx.fillRect(cx - 90, base - 170, 180, 60);
    for (const mx of [-250, -175, 175, 250]) {
      ctx.fillStyle = '#f6f4ee';
      ctx.fillRect(cx + mx - 11, base - 300, 22, 300);
      ctx.fillStyle = '#e8c44a';
      ctx.beginPath();
      ctx.moveTo(cx + mx - 13, base - 300);
      ctx.lineTo(cx + mx, base - 345);
      ctx.lineTo(cx + mx + 13, base - 300);
      ctx.fill();
      ctx.fillStyle = '#d8d4c8';
      ctx.fillRect(cx + mx - 16, base - 220, 32, 8);
    }
    const g = ctx.createRadialGradient(cx - 30, base - 250, 10, cx, base - 200, 110);
    g.addColorStop(0, '#fff2a8');
    g.addColorStop(1, '#c8962a');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.ellipse(cx, base - 170, 95, 110, 0, Math.PI, 0);
    ctx.fill();
    ctx.fillStyle = '#6a8ab0';
    for (let i = 0; i < 7; i++) ctx.fillRect(cx - 170 + i * 52, base - 90, 18, 50);
    // the text panel
    ctx.fillStyle = '#1f4e8c';
    ctx.fillRect(0, h * 0.62, w, h * 0.38);
    centerText(ctx, '«НҰР ҒАСЫР» ОРТАЛЫҚ МЕШІТІНІҢ ҚҰРЫЛЫСЫ', w / 2, h * 0.7, w * 0.92, 40, '#ffffff', { family: FONT.sans });
    centerText(ctx, 'СТРОИТЕЛЬСТВО ЦЕНТРАЛЬНОЙ МЕЧЕТИ «НУР ГАСЫР»', w / 2, h * 0.79, w * 0.92, 38, '#ffffff', { family: FONT.sans });
    centerText(ctx, 'Құрылыс мерзімі / Срок строительства: 2007 – 2008', w / 2, h * 0.9, w * 0.8, 30, '#f2c230', { family: FONT.sans });
  }));
}

function board(ctx) {
  const { batch, root, colliders } = ctx;
  const x = -170, z = 16.2;
  // high enough to clear the hoarding in front of it
  for (const s of [-1, 1]) {
    batch.box(0.16, 6.9, 0.16, 0x4a4c4e, x + s * 3.2, 0, z);
    colliders.circle(x + s * 3.2, z, 0.12, { tag: 'post' });
  }
  batch.box(7.4, 4.2, 0.12, 0x3a3c3e, x, 2.6, z + 0.1);
  const m = new THREE.Mesh(new THREE.PlaneGeometry(7.2, 4.0), cel({ map: boardTex(), cache: false, grime: 0.02, dirt: 0 }));
  m.position.set(x, 4.7, z + 0.03);
  m.rotation.y = Math.PI;
  root.add(m);
}

/* ------------------------------------------------------------------ the frame */

function rebar(batch, x, y, z, n = 4, r = 0.18) {
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + 0.4;
    const bx = x + Math.cos(a) * r, bz = z + Math.sin(a) * r;
    batch.tube(bx, y, bz, bx + Math.cos(a) * 0.08, y + 1.1, bz + Math.sin(a) * 0.08, 0.016, 0x4a3a2e, { seg: 3, cast: false });
  }
}

function frameWork(ctx) {
  const { batch, colliders, ground } = ctx;
  const { x, z } = C;
  // the podium, low enough to step onto
  batch.box(POD * 2, 0.35, POD * 2, CONCRETE, x, 0, z);
  ground.flat(x - POD, z - POD, x + POD, z + POD, 0.35);
  // perimeter columns and the ring beam at first-floor level
  const H1 = 9;
  const step = (POD * 2 - 2) / 7;
  for (let i = 0; i <= 7; i++) {
    for (const [cx, cz] of [
      [x - POD + 1 + i * step, z - POD + 1], [x - POD + 1 + i * step, z + POD - 1],
      [x - POD + 1, z - POD + 1 + i * step], [x + POD - 1, z - POD + 1 + i * step],
    ]) {
      batch.box(0.6, H1, 0.6, CONCRETE, cx, 0.35, cz);
      colliders.box(cx - 0.3, cz - 0.3, cx + 0.3, cz + 0.3, { top: H1, tag: 'column' });
    }
  }
  for (const s of [-1, 1]) {
    batch.box(POD * 2 - 1.4, 0.8, 0.6, CONCRETE, x, H1 + 0.35 - 0.8, z + s * (POD - 1));
    batch.box(0.6, 0.8, POD * 2 - 1.4, CONCRETE, x + s * (POD - 1), H1 + 0.35 - 0.8, z);
  }
  // a slab along the south side has been poured, the rest is still open
  batch.box(POD * 2 - 1.4, 0.25, 7, CONCRETE, x, H1 + 0.35, z + POD - 4.3);
  for (let i = 0; i <= 7; i++) rebar(batch, x - POD + 1 + i * step, H1 + 0.35, z - POD + 1);
  // block walls going up between some columns
  const wall = (x0, z0, x1, z1, h) => {
    const len = Math.hypot(x1 - x0, z1 - z0);
    const ry = Math.atan2(-(z1 - z0), x1 - x0);
    tbox(batch, KIT.brick, [0.8, 0.4], len, h, 0.4, 0xc8c2b4, (x0 + x1) / 2, 0.35, (z0 + z1) / 2, ry);
    ctx.colliders.obb((x0 + x1) / 2, (z0 + z1) / 2, len / 2, 0.2, ry, { top: h + 0.35, tag: 'wall' });
  };
  wall(x - POD + 1.3, z + POD - 1, x - 2, z + POD - 1, 4.2);
  wall(x + 2, z + POD - 1, x + POD - 1.3, z + POD - 1, 2.6);
  wall(x - POD + 1, z - 6, x - POD + 1, z + POD - 1.3, 3.4);
  wall(x + POD - 1, z - POD + 1.3, x + POD - 1, z - 2, 5.6);
  // the drum: sixteen columns on a circle, two ring beams
  const R = 10.5, N = 16, H2 = 17;
  for (let i = 0; i < N; i++) {
    const a = (i / N) * Math.PI * 2;
    const cx = x + Math.cos(a) * R, cz = z + Math.sin(a) * R;
    batch.box(0.7, H2 - 0.35, 0.7, CONCRETE, cx, 0.35, cz, { ry: -a });
    colliders.circle(cx, cz, 0.45, { tag: 'column' });
    rebar(batch, cx, H2, cz);
    for (const y of [H1 - 0.45, H2 - 0.9]) {
      const a2 = ((i + 0.5) / N) * Math.PI * 2;
      const chord = 2 * R * Math.sin(Math.PI / N);
      batch.box(chord + 0.3, 0.9, 0.6, CONCRETE, x + Math.cos(a2) * R * Math.cos(Math.PI / N), y, z + Math.sin(a2) * R * Math.cos(Math.PI / N), { ry: -a2 + Math.PI / 2 });
    }
  }
  // formwork boxed round two of the upper columns, still in plywood
  for (const i of [3, 4]) {
    const a = (i / N) * Math.PI * 2;
    batch.box(1.0, 3.0, 1.0, 0xd8b878, x + Math.cos(a) * R, H2 - 3.2, z + Math.sin(a) * R, { ry: -a });
  }
}

/** Frame scaffolding: standards, ledgers every 2 m, planks every other lift. */
function scaffold(batch, x0, z0, x1, z1, top) {
  const col = 0x8a8c8e;
  const nx = Math.max(1, Math.round((x1 - x0) / 2.4)), nz = Math.max(1, Math.round((z1 - z0) / 2.4));
  const posts = [];
  for (let i = 0; i <= nx; i++) { posts.push([x0 + ((x1 - x0) * i) / nx, z0], [x0 + ((x1 - x0) * i) / nx, z1]); }
  for (let j = 1; j < nz; j++) { posts.push([x0, z0 + ((z1 - z0) * j) / nz], [x1, z0 + ((z1 - z0) * j) / nz]); }
  for (const [px, pz] of posts) batch.cyl(0.03, top, col, px, 0, pz, { seg: 4, cast: false });
  for (let y = 2; y <= top; y += 2) {
    for (const zz of [z0, z1]) batch.tube(x0, y, zz, x1, y, zz, 0.025, col, { seg: 4, cast: false });
    for (const xx of [x0, x1]) batch.tube(xx, y, z0, xx, y, z1, 0.025, col, { seg: 4, cast: false });
    if (y % 4 === 0) {
      batch.box(x1 - x0, 0.05, 0.6, 0xb89a6a, (x0 + x1) / 2, y, z0 + 0.35, { cast: false });
      batch.box(x1 - x0, 0.05, 0.6, 0xb89a6a, (x0 + x1) / 2, y, z1 - 0.35, { cast: false });
    }
  }
  // one diagonal brace per face
  batch.tube(x0, 0, z0, x1, Math.min(top, 8), z0, 0.025, col, { seg: 4, cast: false });
  batch.tube(x0, 0, z1, x1, Math.min(top, 8), z1, 0.025, col, { seg: 4, cast: false });
}

function minarets(ctx) {
  const { batch, colliders } = ctx;
  const heights = [22, 14, 9.5, 17.5];
  const d = POD - 1.5;
  [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([sx, sz], i) => {
    const mx = C.x + sx * d, mz = C.z + sz * d;
    const h = heights[i];
    batch.cyl(2.0, h, CONCRETE, mx, 0.35, mz, { seg: 8 });
    batch.cyl(2.25, 0.3, 0xa8a49a, mx, 0.35 + h * 0.5, mz, { seg: 8 });
    colliders.circle(mx, mz, 2.0, { tag: 'minaret' });
    rebar(batch, mx, h + 0.35, mz, 8, 1.6);
    if (h > 15) scaffold(batch, mx - 2.8, mz - 2.8, mx + 2.8, mz + 2.8, h + 1.5);
  });
  // and a run of scaffolding along the south face
  scaffold(batch, C.x - POD, C.z + POD + 0.4, C.x + POD, C.z + POD + 1.6, 8);
}

/* ------------------------------------------------------------------ the crane */

function lattice(batch, ax, ay, az, bx, by, bz, w, color, seg = 2) {
  // four chords of a square lattice from a to b (a vertical or horizontal member)
  const len = Math.hypot(bx - ax, by - ay, bz - az);
  const n = Math.max(1, Math.round(len / seg));
  const dir = new THREE.Vector3(bx - ax, by - ay, bz - az).normalize();
  const up = Math.abs(dir.y) > 0.9 ? new THREE.Vector3(1, 0, 0) : new THREE.Vector3(0, 1, 0);
  const u = new THREE.Vector3().crossVectors(dir, up).normalize().multiplyScalar(w / 2);
  const v = new THREE.Vector3().crossVectors(dir, u).normalize().multiplyScalar(w / 2);
  const corners = [u.clone().add(v), u.clone().sub(v), u.clone().negate().sub(v), u.clone().negate().add(v)];
  for (const c of corners) batch.tube(ax + c.x, ay + c.y, az + c.z, bx + c.x, by + c.y, bz + c.z, 0.06, color, { seg: 4 });
  for (let i = 0; i < n; i++) {
    const t0 = i / n, t1 = (i + 1) / n;
    const p0 = [ax + (bx - ax) * t0, ay + (by - ay) * t0, az + (bz - az) * t0];
    const p1 = [ax + (bx - ax) * t1, ay + (by - ay) * t1, az + (bz - az) * t1];
    for (let k = 0; k < 4; k++) {
      const c0 = corners[k], c1 = corners[(k + 1) % 4];
      const flip = (i + k) % 2;
      const s = flip ? c0 : c1, e = flip ? c1 : c0;
      batch.tube(p0[0] + s.x, p0[1] + s.y, p0[2] + s.z, p1[0] + e.x, p1[1] + e.y, p1[2] + e.z, 0.035, color, { seg: 3, cast: false });
    }
  }
}

function crane(ctx) {
  const { batch, root, colliders } = ctx;
  const X = -168, Z = 97, H = 42, JIB = 44, CJ = 13;
  // ballast base and the mast
  batch.box(6, 1.2, 6, CONCRETE, X, 0, Z);
  colliders.box(X - 3, Z - 3, X + 3, Z + 3, { top: 1.2, tag: 'crane' });
  lattice(batch, X, 1.2, Z, X, H, Z, 1.7, CRANE_YELLOW, 2.2);
  // the slewing part rotates as one group
  const slew = new THREE.Group();
  slew.position.set(X, H, Z);
  root.add(slew);
  const sb = new Batch({ name: 'crane', cell: Infinity });
  sb.box(2.2, 1.2, 2.2, CRANE_YELLOW, 0, 0, 0);
  sb.box(1.6, 2.0, 1.8, 0xe8e6e0, 1.6, 0.4, 1.4);                      // the cab
  sb.box(1.5, 0.9, 0.05, 0x2a3a44, 1.6, 1.2, 2.31, { mat: 'glass' });
  // tower head and tie bars
  sb.tube(-0.8, 1.2, 0, 0, 7, 0, 0.1, CRANE_YELLOW, { seg: 4 });
  sb.tube(0.8, 1.2, 0, 0, 7, 0, 0.1, CRANE_YELLOW, { seg: 4 });
  sb.tube(0, 7, 0, -JIB * 0.7, 1.9, 0, 0.04, 0x3a3a3a, { seg: 3 });
  sb.tube(0, 7, 0, CJ * 0.9, 1.9, 0, 0.04, 0x3a3a3a, { seg: 3 });
  // jib (along -x) and counter-jib (along +x) with its concrete weights
  lattice(sb, -1.1, 1.8, 0, -JIB, 1.8, 0, 1.2, CRANE_YELLOW, 2.5);
  lattice(sb, 1.1, 1.6, 0, CJ, 1.6, 0, 1.0, CRANE_YELLOW, 2.5);
  for (let i = 0; i < 3; i++) sb.box(1.1, 2.2, 2.0, 0xa8a49a, CJ - 1.0 - i * 1.15, -0.6, 0);
  // a red-and-white tip and a flag
  sb.box(0.9, 0.9, 0.9, 0xd8262c, -JIB + 0.3, 1.35, 0);
  sb.flush(slew);
  // trolley, hook and a pallet of blocks, moved every frame
  const trolley = new THREE.Group();
  slew.add(trolley);
  const tb = new Batch({ name: 'crane-trolley', cell: Infinity });
  tb.box(1.4, 0.4, 1.4, 0x5a5a5a, 0, 1.0, 0);
  tb.flush(trolley);
  const cable = new THREE.Mesh(new THREE.BoxGeometry(0.04, 1, 0.04).translate(0, -0.5, 0), cel({ color: 0x2a2a2a, cache: true }));
  cable.position.y = 1.0;
  trolley.add(cable);
  const hook = new THREE.Group();
  trolley.add(hook);
  const hb = new Batch({ name: 'crane-hook', cell: Infinity });
  hb.box(0.5, 0.7, 0.3, 0xe8b82a, 0, -0.7, 0);
  for (const [a, b] of [[-0.6, -0.6], [0.6, -0.6], [-0.6, 0.6], [0.6, 0.6]]) hb.tube(0, -0.7, 0, a, -2.6, b, 0.015, 0x2a2a2a, { seg: 3 });
  hb.box(1.3, 0.12, 1.3, 0xb89a6a, 0, -2.75, 0);
  tbox(hb, KIT.brick, [0.8, 0.4], 1.1, 0.9, 1.1, 0xc8c2b4, 0, -2.63, 0);
  hb.flush(hook);
  const base = Math.atan2(-(C.z - Z), C.x - X) + Math.PI;   // jib (-x) toward the hall
  let clankAt = 6;
  ctx.update((dt, game) => {
    const t = game.time || 0;
    slew.rotation.y = base + 0.55 * Math.sin(t * 0.045);
    const reach = 14 + 22 * (0.5 + 0.5 * Math.sin(t * 0.07 + 1));
    trolley.position.x = -reach;
    const drop = 8 + 12 * (0.5 + 0.5 * Math.sin(t * 0.11));
    cable.scale.y = drop;
    hook.position.y = 1.0 - drop;
    if (t > clankAt) {
      clankAt = t + 9 + (t * 7.3) % 6;
      const p = game.player?.pos;
      if (p && Math.hypot(p.x - X, p.z - Z) < 90) game.audio.play('clank', { pos: { x: X, y: 10, z: Z }, volume: 0.5 });
    }
  });
}

/* ------------------------------------------------------------------ the yard */

function yard(ctx) {
  const { batch, colliders, root } = ctx;
  const rng = rngKit(2007);
  batch.add(hQuad(FENCE.x0, FENCE.z0, FENCE.x1, FENCE.z1, -0.028, TILE.dirt), { mat: SURF.dirt, color: null, cast: false });
  // track from the gate to the podium
  batch.add(hQuad(-175, GATE.z0 + 1, FENCE.x1, GATE.z1 - 1, -0.024, TILE.sand), { mat: SURF.sand, color: null, cast: false });
  batch.add(hQuad(-182, GATE.z0 + 1, -175, 44, -0.024, TILE.sand), { mat: SURF.sand, color: null, cast: false });
  // bricks on pallets
  for (let i = 0; i < 10; i++) {
    const px = -172 + (i % 5) * 1.6, pz = 58 + Math.floor(i / 5) * 1.6;
    batch.box(1.2, 0.14, 1.2, 0xb89a6a, px, 0, pz, { cast: false });
    tbox(batch, KIT.brick, [0.8, 0.4], 1.05, rng.range(0.6, 1.0), 1.05, rng.pick([0xc8c2b4, 0xb85a40]), px, 0.14, pz);
  }
  colliders.box(-173, 57.2, -164.2, 61, { top: 1.2, tag: 'pallets' });
  // rebar bundles along the west hoarding
  for (let i = 0; i < 6; i++) batch.box(0.4, 0.3, 11.7, 0x6a4a36, -226.5 + i * 0.55, rng.range(0, 0.1), 32, { cast: false });
  colliders.box(-227, 26, -223, 38, { top: 0.5, tag: 'rebar' });
  // sand and gravel heaps
  const heap = (x, z, r, h, color) => {
    const g = new THREE.ConeGeometry(r, h, 10, 1, true);
    g.translate(x, h / 2 - 0.05, z);
    batch.add(g, { color, cast: false });
    colliders.circle(x, z, r * 0.7, { top: h * 0.6, tag: 'heap' });
  };
  heap(-170, 48, 3.2, 1.6, 0xd8b878);
  heap(-163, 48, 2.6, 1.3, 0x9a968e);
  heap(-222, 100, 5, 2.6, 0x8a6a4a);
  // concrete rings
  for (let i = 0; i < 5; i++) {
    const cx = -224 + (i % 3) * 2.3, cz = 88 + Math.floor(i / 3) * 2.3;
    batch.cyl(1.0, 0.9, CONCRETE, cx, 0, cz, { seg: 12, open: true });
    batch.cyl(0.85, 0.9, 0x8a867e, cx, 0, cz, { seg: 12, open: true });
    colliders.circle(cx, cz, 1.0, { top: 0.9, tag: 'ring' });
  }
  // plywood formwork boards and timber
  for (let i = 0; i < 4; i++) batch.box(2.5, 0.25, 1.25, 0xd8b878, -205 + i * 3, 0, 24, { ry: rng.range(-0.1, 0.1) });
  colliders.box(-207, 23, -192, 25, { top: 0.3, tag: 'boards' });
  // the site cabin (вагончик) by the gate
  const vx = -163.5, vz = 38;
  tbox(batch, KIT.corrugated, TILES.corrugated, 6, 2.5, 2.4, 0x3a6aa0, vx, 0.3, vz);
  batch.box(6.1, 0.12, 2.5, 0x9a9c9a, vx, 2.8, vz);
  batch.box(0.9, 2.0, 0.05, 0x5a5a5a, vx - 1.8, 0.35, vz - 1.22);
  batch.box(1.2, 0.8, 0.05, 0x9ab8c8, vx + 1.2, 1.4, vz - 1.22, { mat: 'glass' });
  for (const s of [-1, 1]) batch.box(0.3, 0.3, 2.4, 0x6a6a6a, vx + s * 2.6, 0, vz);
  colliders.box(vx - 3, vz - 1.2, vx + 3, vz + 1.2, { top: 2.8, tag: 'cabin' });
  const plate = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 0.4), cel({ map: signTex({ w: 256, h: 72, bg: '#ffffff', fg: '#222222', lines: ['ПРОРАБ'], seed: 4, wear: 0.4 }), cache: false, grime: 0, dirt: 0 }));
  plate.position.set(vx - 1.8, 2.55, vz - 1.25);
  plate.rotation.y = Math.PI;
  root.add(plate);
  // a cement mixer
  batch.cyl(0.7, 1.1, 0xd83a26, -181, 0.6, 32, { rz: 0.6, seg: 10, rTop: 0.45 });
  batch.box(1.2, 0.6, 0.8, 0x4a4c4e, -181, 0, 32);
  colliders.circle(-181, 32, 0.9, { tag: 'mixer' });
  // a floodlight mast over the yard
  batch.cyl(0.12, 10, 0x6a6c6e, -160, 0, 88, { seg: 6 });
  batch.box(1.2, 0.5, 0.3, 0x3a3a3a, -160, 10, 88);
  colliders.circle(-160, 88, 0.15, { tag: 'mast' });
}

function hoarding(ctx) {
  const blue = 0x3f6f9a;
  const { x0, x1, z0, z1 } = FENCE;
  hoardingRun(ctx, x0, z0, x1, z0, blue);
  hoardingRun(ctx, x0, z1, x1, z1, blue);
  hoardingRun(ctx, x0, z0, x0, z1, blue);
  hoardingRun(ctx, x1, z0, x1, GATE.z0, blue);
  hoardingRun(ctx, x1, GATE.z1, x1, z1, blue);
  // the gate: two leaves, one swung inwards
  const { batch, colliders, root } = ctx;
  tbox(batch, KIT.corrugated, TILES.corrugated, 4, 2.2, 0.05, blue, x1, 0.05, GATE.z0 + 2, Math.PI / 2);
  colliders.obb(x1, GATE.z0 + 2, 2, 0.12, Math.PI / 2, { top: 2.3, tag: 'gate' });
  tbox(batch, KIT.corrugated, TILES.corrugated, 4, 2.2, 0.05, blue, x1 - 2.1, 0.05, GATE.z1 + 0.1, 0.15);
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 0.6), cel({
    map: signTex({ w: 320, h: 120, bg: '#ffffff', fg: '#c8262c', lines: ['ҚҰРЫЛЫС АЛАҢЫ', 'ПОСТОРОННИМ ВХОД ВОСПРЕЩЁН'], sizes: [1, 0.8], border: '#c8262c', seed: 9, wear: 0.5 }),
    cache: false, grime: 0, dirt: 0,
  }));
  sign.position.set(x1 + 0.05, 1.5, GATE.z0 + 2);
  sign.rotation.y = Math.PI / 2;
  root.add(sign);
  const lines = [
    'Сторож: «Куда? Стройка! Посторонним нельзя.»',
    'Through the gap: a crane, a lot of concrete, and a man asleep in a Niva.',
    'Сторож: «Мечеть будет, большая. Через год приходи.»',
  ];
  let n = 0;
  ctx.interact({
    x: x1 + 0.3, y: 1.2, z: (GATE.z0 + GATE.z1) / 2, w: 0.8, h: 2, d: GATE.z1 - GATE.z0,
    label: 'Look through the site gate',
    action: (game) => {
      game.hud.flash(lines[n++ % lines.length], 3200);
      game.audio.play('knock', { pos: { x: x1, y: 1, z: GATE.z0 + 4 }, volume: 0.6 });
    },
  });
}

export function nurGasyr(ctx) {
  hoarding(ctx);
  board(ctx);
  yard(ctx);
  frameWork(ctx);
  minarets(ctx);
  crane(ctx);
}
