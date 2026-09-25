import * as THREE from 'three';
import { PAL } from '../../core/palette.js';
import { rngKit, rotXZ } from '../../core/util.js';
import { signTex, FONT } from '../../core/textures.js';
import { QuadSet } from './panel.js';
import { wallMaterial, windowAtlas, cellUV, pickCell, WIN } from './facades.js';
import { placeSign } from './signs.js';

/* ------------------------------------------------------------------ *
 * The utilitarian buildings of a microdistrict: the district boiler
 * house with its brick chimney, and the 2007 building site next door
 * (a tower going up, a tower crane, scaffolding, a sheet-metal fence).
 * ------------------------------------------------------------------ */

const _up = new THREE.Vector3(0, 1, 0);
const _one = new THREE.Vector3(1, 1, 1);

function local(ctx, x, z, facing) {
  const matrix = new THREE.Matrix4().compose(new THREE.Vector3(x, 0, z), new THREE.Quaternion().setFromAxisAngle(_up, facing), _one);
  const toW = (lx, lz) => { const [a, b] = rotXZ(lx, lz, facing); return [x + a, z + b]; };
  const box = (w, h, d, color, lx, ly, lz, o = {}) => {
    const [wx, wz] = toW(lx, lz);
    ctx.batch.box(w, h, d, color, wx, ly, wz, { ...o, ry: facing + (o.ry || 0) });
  };
  const rect = (lx0, lz0, lx1, lz1) => {
    const a = toW(lx0, lz0), b = toW(lx1, lz1);
    return [Math.min(a[0], b[0]), Math.min(a[1], b[1]), Math.max(a[0], b[0]), Math.max(a[1], b[1])];
  };
  return { matrix, toW, box, rect };
}

/** A hipped roof over an L x D rectangle, eaves at y, ridge `h` higher. */
export function hipRoof(batch, matrix, L, D, y, h, color, over = 0.4) {
  const ridge = Math.max(0, L / 2 - D / 2);
  const hx = L / 2 + over, hz = D / 2 + over;
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(new Float32Array([
    -hx, y, -hz, hx, y, -hz, ridge, y + h, 0, -ridge, y + h, 0,
    hx, y, hz, -hx, y, hz, -ridge, y + h, 0, ridge, y + h, 0,
    -hx, y, hz, -hx, y, -hz, -ridge, y + h, 0,
    hx, y, -hz, hx, y, hz, ridge, y + h, 0,
  ]), 3));
  g.setIndex([0, 2, 1, 0, 3, 2, 4, 6, 5, 4, 7, 6, 8, 10, 9, 11, 13, 12]);
  g.computeVertexNormals();
  batch.add(g, { matrix, color });
  // eaves board
  const eave = new THREE.BoxGeometry(2 * hx, 0.18, 2 * hz);
  eave.translate(0, y + 0.09, 0);
  batch.add(eave, { matrix, color: 0xe8e4da });
}

/* ---------------- boiler house ---------------- */

/**
 * District boiler house (котельная): a red-brick hall with tall windows,
 * a gas inlet, a steel door, and a tapered brick chimney behind it.
 * Returns the points where the heating mains leave it.
 */
export function buildBoilerHouse(ctx, { x, z, facing = 0, L = 20, D = 12, H = 7.5, chimneyH = 42, seed = 3, sheet = null }) {
  const { batch, colliders } = ctx;
  const rng = rngKit(seed);
  const { matrix, toW, box, rect } = local(ctx, x, z, facing);
  const quads = new QuadSet();
  const brick = wallMaterial('redBrick');
  const atlas = windowAtlas();
  for (const side of [-1, 1]) {
    quads.wall(brick, [0, H / 2, side * D / 2], side < 0 ? '-z' : '+z', L, H, 0, 0);
    quads.wall(brick, [side * L / 2, H / 2, 0], side < 0 ? '-x' : '+x', D, H, 0, 0);
  }
  // tall windows of glass block and steel frames
  for (let i = 0; i < 5; i++) {
    const lx = -L / 2 + 2 + i * ((L - 4) / 4);
    if (i === 2) continue;
    for (const side of [-1, 1]) quads.quad(atlas, [lx, 3.6, side * (D / 2 + 0.012)], side < 0 ? '-z' : '+z', 1.8, 3.6, cellUV(pickCell(rng, WIN.glassBlock)));
  }
  // double steel door in the middle of the front
  box(3.2, 3.4, 0.08, 0x3e5a6a, 0, 0, -D / 2 - 0.04);
  box(0.06, 3.4, 0.1, 0x22282c, 0, 0, -D / 2 - 0.09);
  box(4.0, 0.15, 1.4, PAL.concrete, 0, 3.6, -D / 2 - 0.7);
  // roof: a low parapet round a tar roof, a vent box
  box(L, 0.12, D, 0x5a5652, 0, H, 0);
  box(L + 0.2, 0.6, 0.3, 0x9a4a36, 0, H, -D / 2 + 0.15);
  box(L + 0.2, 0.6, 0.3, 0x9a4a36, 0, H, D / 2 - 0.15);
  box(0.3, 0.6, D, 0x9a4a36, -L / 2 + 0.15, H, 0);
  box(0.3, 0.6, D, 0x9a4a36, L / 2 - 0.15, H, 0);
  box(3, 1.6, 2, PAL.metalGrey, -L / 4, H, 0);
  box(L + 0.1, 0.5, D + 0.1, PAL.concreteDark, 0, 0, 0);
  // the gas inlet: a yellow pipe with a regulator cabinet
  const [gx, gz] = toW(L / 2 + 1.2, -D / 4);
  box(1.0, 1.4, 0.6, PAL.gasYellow, L / 2 + 1.2, 0, -D / 4);
  batch.tube(gx, 1.2, gz, gx, 5.2, gz, 0.07, PAL.gasYellow, { seg: 6 });
  const [hx, hz] = toW(L / 2 + 0.1, -D / 4);
  batch.tube(gx, 5.2, gz, hx, 5.2, hz, 0.07, PAL.gasYellow, { seg: 6 });
  // plate by the door
  const [px, pz] = toW(2.8, -D / 2 - 0.03);
  placeSign(ctx, sheet, signTex({ w: 256, h: 72, bg: '#1f4e8c', fg: '#ffffff', lines: ['Котельная №3', 'Жылу орталығы'], sizes: [1, 0.8], family: FONT.narrow, seed }),
    1.8, 0.5, px, 2.6, pz, facing + Math.PI);
  quads.flush(batch, matrix);
  colliders.box(...rect(-L / 2 - 0.1, -D / 2 - 0.1, L / 2 + 0.1, D / 2 + 0.1), { tag: 'building' });
  colliders.box(...rect(L / 2, -D / 4 - 0.4, L / 2 + 1.8, -D / 4 + 0.4), { tag: 'gas' });

  // chimney: tapered brick, white bands, a ladder and a gallery
  const [cx, cz] = toW(L / 2 + 3.5, D / 2 - 1);
  buildChimney(ctx, cx, cz, chimneyH);
  // the breeching duct from hall to chimney
  const [dx, dz] = toW(L / 2, D / 2 - 1);
  batch.tube(dx, 5.5, dz, cx, 5.5, cz, 0.7, 0x8a8e90, { seg: 8 });
  return { toW, pipeOut: toW(-L / 2, D / 4), frontY: 0 };
}

/** A tapered red-brick chimney with two white bands and a steel ladder. */
export function buildChimney(ctx, x, z, h, { r0 = 1.9, r1 = 1.05 } = {}) {
  const { batch, colliders } = ctx;
  batch.cyl(r0 + 0.4, 1.2, PAL.concrete, x, 0, z, { seg: 12 });
  batch.cyl(r0, h, 0xa5503a, x, 1.2, z, { rTop: r1, seg: 16 });
  const rAt = (y) => r0 + (r1 - r0) * ((y - 1.2) / h);
  for (const y of [h - 5.5, h - 2.4]) batch.cyl(rAt(y) + 0.02, 1.4, 0xf0ece4, x, y, z, { rTop: rAt(y + 1.4) + 0.02, seg: 16 });
  batch.cyl(r1 + 0.12, 0.35, 0x3a3634, x, h + 0.9, z, { seg: 16 });
  // soot at the top
  batch.cyl(r1 + 0.03, 0.8, 0x4a4240, x, h + 0.4, z, { rTop: r1 + 0.02, seg: 16 });
  // ladder up the south side
  for (const s of [-0.22, 0.22]) {
    batch.tube(x + s, 2, z + rAt(2) + 0.12, x + s, h, z + r1 + 0.12, 0.025, PAL.metalDark, { seg: 3 });
  }
  for (let y = 2.5; y < h; y += 0.9) {
    const rr = rAt(y) + 0.12;
    batch.tube(x - 0.22, y, z + rr, x + 0.22, y, z + rr, 0.015, PAL.metalDark, { seg: 3, cast: false });
  }
  // gallery ring two thirds up
  const gy = h * 0.66, gr = rAt(gy) + 0.7;
  for (let i = 0; i < 16; i++) {
    const a0 = (i / 16) * Math.PI * 2, a1 = ((i + 1) / 16) * Math.PI * 2;
    batch.tube(x + Math.cos(a0) * gr, gy + 1, z + Math.sin(a0) * gr, x + Math.cos(a1) * gr, gy + 1, z + Math.sin(a1) * gr, 0.03, PAL.metalDark, { seg: 3, cast: false });
  }
  batch.cyl(gr, 0.08, PAL.metalDark, x, gy, z, { seg: 16 });
  colliders.circle(x, z, r0 + 0.4, { tag: 'chimney' });
}

/* ---------------- building site ---------------- */

/**
 * Sheet-metal site fence along a closed polygon, with a gate gap on edge
 * `gate`, centred `gateAt` of the way along it.
 */
export function siteFence(ctx, pts, { gate = 0, gateAt = 0.5, gateW = 6, color = 0x2f5fa8, h = 2.0, seed = 7 } = {}) {
  const { batch, colliders } = ctx;
  const rng = rngKit(seed);
  for (let i = 0; i < pts.length; i++) {
    const [ax, az] = pts[i], [bx, bz] = pts[(i + 1) % pts.length];
    const len = Math.hypot(bx - ax, bz - az);
    const dx = (bx - ax) / len, dz = (bz - az) / len;
    const dir = Math.atan2(dx, dz);
    const g = len * gateAt;
    const spans = i === gate ? [[0, g - gateW / 2], [g + gateW / 2, len]] : [[0, len]];
    for (const [s0, s1] of spans) {
      for (let s = s0; s < s1 - 0.01; s += 2.5) {
        const e = Math.min(s1, s + 2.5);
        const mx = ax + dx * (s + e) / 2, mz = az + dz * (s + e) / 2;
        const c = rng.chance(0.15) ? rng.pick([0x3a6a4a, 0x8a8e90, PAL.rust]) : color;
        batch.box(0.04, h, e - s - 0.04, c, mx, 0.05, mz, { ry: dir });
        batch.cyl(0.05, h + 0.1, PAL.metalGrey, ax + dx * s, 0, az + dz * s, { seg: 4 });
      }
      const m0 = s0, m1 = s1;
      colliders.obb(ax + dx * (m0 + m1) / 2, az + dz * (m0 + m1) / 2, 0.08, (m1 - m0) / 2, dir, { tag: 'fence' });
    }
  }
}

/** A sign board on two posts: the builder, the object, the handover date. */
export function siteBoard(ctx, x, z, facing, seed, sheet = null) {
  const { batch } = ctx;
  const [ox, oz] = rotXZ(1.6, 0, facing);
  for (const s of [-1, 1]) batch.cyl(0.06, 3.2, PAL.metalGrey, x + s * ox, 0, z + s * oz, { seg: 5 });
  const tex = signTex({
    w: 512, h: 256, bg: '#f4f2ec', fg: '#1f3e7c',
    lines: ['Строительство 12-этажного', 'жилого дома', 'Заказчик: ТОО «Ақтөбе құрылыс»', 'Срок сдачи: IV кв. 2008 г.'],
    sizes: [1, 1, 0.7, 0.7], family: FONT.sans, seed,
  });
  const [fx, fz] = rotXZ(0, -0.03, facing);
  placeSign(ctx, sheet, tex, 3.4, 1.7, x + fx, 2.3, z + fz, facing + Math.PI);
  // the steel back of the board
  batch.box(3.44, 1.74, 0.04, 0x8a8e90, x, 1.43, z, { ry: facing });
}

/**
 * Tubular scaffolding against a wall: `L` wide, from y0 to y1, standing
 * `off` metres out from the wall along local -z of (x, z, facing).
 */
export function scaffold(ctx, x, z, facing, L, y0, y1, { off = 0.4, mesh = 0.5, seed = 9 } = {}) {
  const { batch } = ctx;
  const rng = rngKit(seed);
  const toW = (lx, lz) => { const [a, b] = rotXZ(lx, lz, facing); return [x + a, z + b]; };
  const n = Math.round(L / 2);
  for (let i = 0; i <= n; i++) {
    const lx = -L / 2 + (i * L) / n;
    for (const d of [off, off + 1.1]) {
      const [px, pz] = toW(lx, -d);
      batch.tube(px, 0, pz, px, y1 + 1, pz, 0.03, 0x9aa0a2, { seg: 4 });
    }
  }
  for (let y = Math.max(2, y0); y <= y1; y += 2) {
    for (const d of [off, off + 1.1]) {
      const [ax, az] = toW(-L / 2, -d), [bx, bz] = toW(L / 2, -d);
      batch.tube(ax, y + 1, az, bx, y + 1, bz, 0.025, 0x9aa0a2, { seg: 4, cast: false });
    }
    const [cx, cz] = toW(0, -off - 0.55);
    batch.box(L, 0.05, 1.0, 0xb89a6a, cx, y, cz, { ry: facing });
  }
  // green safety mesh over part of it
  for (let i = 0; i < n; i++) {
    if (!rng.chance(mesh)) continue;
    const lx = -L / 2 + ((i + 0.5) * L) / n;
    const [mx, mz] = toW(lx, -off - 1.18);
    const top = rng.range(y1 - 8, y1 + 1);
    batch.box(L / n - 0.05, top - y0, 0.02, 0x3f7a4a, mx, y0, mz, { ry: facing });
  }
}

/**
 * Soviet-style tower crane (КБ): lattice mast, a horizontal jib toward
 * `yaw`, a counter-jib with concrete blocks, the cab, a hook on a line.
 */
export function towerCrane(ctx, x, z, yaw, { h = 44, jib = 32, color = 0xe0a020, hookAt = 20, hookY = 20 } = {}) {
  const { batch, colliders } = ctx;
  const s = 0.8;
  const corners = [[-s, -s], [s, -s], [s, s], [-s, s]];
  // rail bogie and ballast
  batch.box(5, 0.8, 5, 0x6a6e70, x, 0, z);
  for (const [a, b] of [[-1.6, -1.6], [1.6, -1.6], [1.6, 1.6], [-1.6, 1.6]]) batch.box(1.2, 0.8, 1.2, PAL.concrete, x + a, 0.8, z + b);
  for (const [a, b] of corners) batch.tube(x + a, 0.8, z + b, x + a, h, z + b, 0.06, color, { seg: 4 });
  for (let y = 0.8; y < h - 1.5; y += 1.6) {
    for (let i = 0; i < 4; i++) {
      const [a0, b0] = corners[i], [a1, b1] = corners[(i + 1) % 4];
      batch.tube(x + a0, y, z + b0, x + a1, y + 1.6, z + b1, 0.03, color, { seg: 3, cast: false });
      batch.tube(x + a0, y, z + b0, x + a1, y, z + b1, 0.03, color, { seg: 3, cast: false });
    }
  }
  const fx = -Math.sin(yaw), fz = -Math.cos(yaw);
  const top = h;
  // slewing ring, cab and a cat-head
  batch.box(2.2, 0.6, 2.2, color, x, top, z, { ry: yaw });
  const [kx, kz] = [x - fz * 1.3, z + fx * 1.3];
  batch.box(1.4, 1.8, 1.8, 0xe8e4da, kx + fx * 0.8, top - 1.9, kz + fz * 0.8, { ry: yaw });
  batch.box(1.2, 1.0, 0.04, 0x5b7389, kx + fx * 1.7, top - 1.0, kz + fz * 1.7, { ry: yaw, mat: 'glass' });
  for (const [a, b] of corners) batch.tube(x + a * 0.7, top + 0.6, z + b * 0.7, x, top + 6, z, 0.05, color, { seg: 4 });
  // jib: a triangular lattice toward the building
  const jy = top + 0.6;
  const side = [fz, -fx];
  const chord = (o, y, len, rr = 0.05) => {
    const ox = side[0] * o, oz = side[1] * o;
    batch.tube(x + ox, y, z + oz, x + ox + fx * len, y, z + oz + fz * len, rr, color, { seg: 4 });
  };
  chord(-0.5, jy, jib); chord(0.5, jy, jib); chord(0, jy + 1.2, jib - 0.5);
  for (let t = 0; t < jib - 1.2; t += 1.6) {
    for (const o of [-0.5, 0.5]) {
      const ox = side[0] * o, oz = side[1] * o;
      batch.tube(x + ox + fx * t, jy, z + oz + fz * t, x + fx * (t + 0.8), jy + 1.2, z + fz * (t + 0.8), 0.025, color, { seg: 3, cast: false });
      batch.tube(x + fx * (t + 0.8), jy + 1.2, z + fz * (t + 0.8), x + ox + fx * (t + 1.6), jy, z + oz + fz * (t + 1.6), 0.025, color, { seg: 3, cast: false });
    }
  }
  // stays from the cat-head
  batch.tube(x, top + 6, z, x + fx * jib * 0.7, jy + 1.2, z + fz * jib * 0.7, 0.025, 0x3a3634, { seg: 3, cast: false });
  batch.tube(x, top + 6, z, x - fx * 10, jy + 0.6, z - fz * 10, 0.025, 0x3a3634, { seg: 3, cast: false });
  // counter-jib and ballast blocks
  chord(-0.5, jy, -11); chord(0.5, jy, -11);
  for (let i = 0; i < 3; i++) {
    const t = -8.5 - i * 0.9;
    batch.box(2.0, 1.6, 0.8, PAL.concrete, x + fx * t, jy - 1.2, z + fz * t, { ry: yaw });
  }
  // trolley, hook line and a pallet of bricks on the hook
  const hx = x + fx * hookAt, hz = z + fz * hookAt;
  batch.box(1.0, 0.4, 1.0, 0x3a3634, hx, jy - 0.4, hz, { ry: yaw });
  batch.tube(hx, jy - 0.4, hz, hx, hookY + 1.4, hz, 0.02, 0x2a2826, { seg: 3, cast: false });
  batch.box(0.4, 0.6, 0.3, 0xe0a020, hx, hookY + 0.8, hz, { ry: yaw });
  batch.box(1.2, 0.15, 1.0, 0x9a7650, hx, hookY - 0.8, hz, { ry: yaw });
  batch.box(1.1, 0.7, 0.9, 0xb85a42, hx, hookY - 0.65, hz, { ry: yaw });
  for (const s2 of [-1, 1]) batch.tube(hx, hookY + 0.8, hz, hx + s2 * 0.5, hookY - 0.1, hz, 0.01, 0x2a2826, { seg: 3, cast: false });
  colliders.box(x - 2.5, z - 2.5, x + 2.5, z + 2.5, { tag: 'crane' });
}

/** Site clutter: brick pallets, a cement mixer, a pile of sand, rebar, a bytovka. */
export function siteClutter(ctx, x0, z0, x1, z1, avoid, seed = 11) {
  const { batch, colliders } = ctx;
  const rng = rngKit(seed);
  const free = (x, z, r) => !avoid.some(([a0, b0, a1, b1]) => x > a0 - r && x < a1 + r && z > b0 - r && z < b1 + r);
  let placed = 0;
  for (let tries = 0; tries < 80 && placed < 14; tries++) {
    const x = rng.range(x0 + 2, x1 - 2), z = rng.range(z0 + 2, z1 - 2);
    if (!free(x, z, 2)) continue;
    const kind = rng.weighted([['bricks', 4], ['sand', 2], ['mixer', 1], ['rebar', 2], ['blocks', 2]]);
    const ry = rng.range(0, Math.PI);
    if (kind === 'bricks') {
      batch.box(1.2, 0.15, 1.0, 0x9a7650, x, 0, z, { ry });
      batch.box(1.1, 0.8, 0.9, rng.pick([0xb85a42, 0xe0d4b4]), x, 0.15, z, { ry });
      colliders.circle(x, z, 0.8, { top: 0.95, tag: 'site' });
    } else if (kind === 'sand') {
      batch.cyl(2.0, 1.1, 0xd8bc84, x, 0, z, { rTop: 0.2, seg: 9 });
      colliders.circle(x, z, 1.6, { top: 1.1, tag: 'site' });
    } else if (kind === 'mixer') {
      batch.box(0.9, 0.6, 1.4, 0xd05030, x, 0, z, { ry });
      batch.cyl(0.55, 0.9, 0xd05030, x, 0.6, z, { rTop: 0.3, rx: 0.6, ry, seg: 10 });
      colliders.circle(x, z, 0.9, { tag: 'site' });
    } else if (kind === 'rebar') {
      for (let i = 0; i < 8; i++) {
        const o = rng.range(-0.3, 0.3);
        const [ax, az] = rotXZ(o, -3, ry), [bx, bz] = rotXZ(o, 3, ry);
        batch.tube(x + ax, 0.08 + i * 0.02, z + az, x + bx, 0.08 + i * 0.02, z + bz, 0.012, PAL.rust, { seg: 3, cast: false });
      }
    } else {
      for (let i = 0; i < 3; i++) batch.box(2.4, 0.6, 1.2, PAL.concrete, x, i * 0.6, z + (i % 2) * 0.1, { ry });
      colliders.circle(x, z, 1.4, { top: 1.8, tag: 'site' });
    }
    placed++;
  }
}

