import * as THREE from 'three';
import { cel } from '../../core/toon.js';
import { canvasTex, cached } from '../../core/textures.js';
import { rngKit } from '../../core/util.js';
import { KIT, TILES, tbox, frame } from '../buildings/houseKit.js';

/* ------------------------------------------------------------------ *
 * Bazaar furniture: stalls on steel frames under blue and white tarps,
 * crates of June produce, sacks of sunflower seeds, kurt on trays, a
 * tandyr with lepyoshka, clothes and shoes, buckets and basins, shipping
 * containers turned into shops, rainbow umbrellas, carts and crates.
 *
 * Produce is a painted texture on the top of each crate (one atlas, one
 * material), with a few real round fruit on top so the crates read as
 * full rather than printed.
 *
 * Every function takes (ctx, x, z, ry, rng) and builds in a local frame
 * whose -z faces the aisle the customer stands in.
 * ------------------------------------------------------------------ */

export const PRODUCE = ['strawberry', 'cherry', 'apricot', 'tomato', 'cucumber', 'greens', 'potato', 'seeds', 'kurt', 'onion'];

const PRODUCE_LOOK = {
  strawberry: ['#8a1d1d', ['#d8262c', '#b81c24', '#e8453a'], 0.07, 'berry'],
  cherry: ['#3a0e14', ['#7a1024', '#5a0a1a', '#9a1a2e'], 0.05, 'round'],
  apricot: ['#a8561a', ['#f0a23a', '#e88a2a', '#f6b85a'], 0.08, 'round'],
  tomato: ['#8a1a12', ['#d83a26', '#c22e1e', '#e8543a'], 0.1, 'round'],
  cucumber: ['#2a4a1a', ['#3f7a2a', '#4f8a34', '#2f6a22'], 0.07, 'long'],
  greens: ['#2a5a1a', ['#4f9a2a', '#6aae3a', '#3f8a24'], 0.06, 'leafy'],
  potato: ['#6a5030', ['#c8a46a', '#b8945a', '#d4b27a'], 0.1, 'round'],
  seeds: ['#1a1a1a', ['#2a2a2a', '#dcd8cc', '#3a3a3a'], 0.018, 'seed'],
  kurt: ['#c8c0a8', ['#f2eee2', '#e6e0d0', '#fbf8ee'], 0.07, 'round'],
  onion: ['#8a5a2a', ['#d8a25a', '#c88a4a', '#e8b86a'], 0.09, 'round'],
};

function produceAtlas() {
  return cached('produce-atlas', () => canvasTex(1280, 256, (ctx) => {
    const r = rngKit(71);
    PRODUCE.forEach((kind, i) => {
      const x0 = (i % 5) * 256, y0 = Math.floor(i / 5) * 128;
      const [bg, cols, size, shape] = PRODUCE_LOOK[kind];
      ctx.fillStyle = bg;
      ctx.fillRect(x0, y0, 256, 128);
      const s = size * 256 / 0.55;   // crate top is about 0.55 m across
      const n = Math.floor((256 * 128) / (s * s) * 1.4);
      for (let k = 0; k < n; k++) {
        const cx = x0 + r.range(0, 256), cy = y0 + r.range(0, 128);
        ctx.fillStyle = r.pick(cols);
        ctx.beginPath();
        if (shape === 'long') ctx.ellipse(cx, cy, s * 1.6, s * 0.5, r.range(0, Math.PI), 0, Math.PI * 2);
        else if (shape === 'seed') ctx.ellipse(cx, cy, s * 0.9, s * 0.5, r.range(0, Math.PI), 0, Math.PI * 2);
        else if (shape === 'leafy') { ctx.ellipse(cx, cy, s * 0.9, s * 0.4, r.range(0, Math.PI), 0, Math.PI * 2); }
        else ctx.arc(cx, cy, s * 0.5, 0, Math.PI * 2);
        ctx.fill();
        if (shape === 'berry' || shape === 'round') {
          ctx.fillStyle = 'rgba(255,255,255,0.35)';
          ctx.beginPath();
          ctx.arc(cx - s * 0.15, cy - s * 0.15, s * 0.13, 0, Math.PI * 2);
          ctx.fill();
        }
        if (shape === 'berry') {
          ctx.fillStyle = '#3f7a2a';
          ctx.fillRect(cx - s * 0.2, cy - s * 0.55, s * 0.4, s * 0.15);
        }
      }
    });
  }));
}

let produceMat = null;
function prodMat() {
  if (!produceMat) produceMat = cel({ map: produceAtlas(), cache: false, grime: 0.02, dirt: 0, bands: 'soft' });
  return produceMat;
}

/** A crate top (flat quad) showing produce `kind`, centred at (x, y, z). */
function produceTop(batch, kind, w, d, x, y, z, ry) {
  const i = PRODUCE.indexOf(kind);
  const u0 = (i % 5) / 5, v1 = 1 - Math.floor(i / 5) / 2;
  const g = new THREE.PlaneGeometry(w, d);
  g.rotateX(-Math.PI / 2);
  const uv = g.attributes.uv;
  for (let k = 0; k < uv.count; k++) uv.setXY(k, u0 + uv.getX(k) * 0.2, v1 - 0.5 + uv.getY(k) * 0.5);
  g.rotateY(ry);
  g.translate(x, y, z);
  batch.add(g, { mat: prodMat(), color: null, cast: false });
}

/** A crate of produce, with a few real fruit heaped on top. */
export function crate(batch, kind, x, y, z, ry, rng, { w = 0.55, d = 0.38, h = 0.24, plastic = true } = {}) {
  const col = plastic ? rng.pick([0x2e6ab0, 0x2f8a4a, 0xd8a02a, 0xb8342b]) : 0xa8865a;
  batch.box(w, h, d, col, x, y, z, { ry });
  produceTop(batch, kind, w - 0.04, d - 0.04, x, y + h - 0.02, z, ry);
  const look = PRODUCE_LOOK[kind];
  if (look[3] === 'round' || look[3] === 'berry') {
    const n = 3 + Math.floor(rng.next() * 4);
    for (let i = 0; i < n; i++) {
      const r = look[2] * 0.6;
      const c = new THREE.Color(rng.pick(look[1])).getHex();
      const g = new THREE.IcosahedronGeometry(r, 0);
      g.translate(x + rng.range(-w / 3, w / 3), y + h + r * 0.4, z + rng.range(-d / 3, d / 3));
      batch.add(g, { color: c, cast: false });
    }
  }
}

/** A sack of sunflower seeds (or rice, or flour) with the neck rolled down. */
export function sack(batch, kind, x, z, rng, y = 0) {
  const g = new THREE.CylinderGeometry(0.26, 0.3, 0.62, 9);
  g.translate(x, y + 0.31, z);
  batch.add(g, { color: rng.pick([0xe8e2cc, 0xd8ccb0, 0xf0ecde]) });
  const rim = new THREE.TorusGeometry(0.25, 0.05, 5, 12);
  rim.rotateX(Math.PI / 2);
  rim.translate(x, y + 0.62, z);
  batch.add(rim, { color: 0xd8ccb0 });
  const top = new THREE.CircleGeometry(0.24, 12);
  top.rotateX(-Math.PI / 2);
  const uv = top.attributes.uv;
  const i = PRODUCE.indexOf(kind);
  for (let k = 0; k < uv.count; k++) uv.setXY(k, (i % 5) / 5 + uv.getX(k) * 0.2, 1 - Math.floor(i / 5) / 2 - 0.5 + uv.getY(k) * 0.5);
  top.translate(x, y + 0.6, z);
  batch.add(top, { mat: prodMat(), color: null, cast: false });
}

const TARPS = [[0x2e6ab0, 0xeeeeea], [0x2e6ab0, 0x2e6ab0], [0xeeeeea, 0x3f8ac8], [0x3a8a5a, 0xeeeeea], [0xb8342b, 0xeeeeea]];

/**
 * A market stall: steel frame, a tarp roof sloping back, a counter and
 * whatever it sells. `kind` 'produce' | 'clothes' | 'goods' | 'seeds'.
 * Local frame: counter along x, customer at -z. Returns the counter centre.
 */
export function stall(ctx, x, z, ry, kind, rng, { w = 3.0, d = 2.2 } = {}) {
  const { batch } = ctx;
  const L = frame(x, z, ry);
  const H = 2.3;
  const frameCol = rng.pick([0x5a6066, 0x3f7a52, 0x3a5a8a]);
  for (const [lx, lz] of [[-w / 2, -d / 2], [w / 2, -d / 2], [-w / 2, d / 2], [w / 2, d / 2]]) {
    const p = L(lx, lz);
    batch.box(0.05, lz < 0 ? H : H - 0.35, 0.05, frameCol, p[0], 0, p[1], { ry });
  }
  // tarp roof in stripes, sloping to the back
  const [a, b] = rng.pick(TARPS);
  const stripes = 6;
  for (let i = 0; i < stripes; i++) {
    const p = L(-w / 2 + (i + 0.5) * (w / stripes), 0);
    batch.box(w / stripes + 0.01, 0.03, d + 0.5, i % 2 ? a : b, p[0], H - 0.18, p[1], { ry, rx: -0.16, cast: true });
  }
  // valance at the front
  const fv = L(0, -d / 2 - 0.26);
  batch.box(w + 0.05, 0.28, 0.02, a, fv[0], H - 0.2, fv[1], { ry });
  // counter
  const c = L(0, -d / 2 + 0.45);
  batch.box(w - 0.1, 0.78, 0.8, 0xa8865a, c[0], 0, c[1], { ry });
  batch.box(w - 0.02, 0.04, 0.9, 0xc8b08a, c[0], 0.78, c[1], { ry });
  ctx.colliders.obb(c[0], c[1], w / 2, 0.45, ry, { top: 0.82, tag: 'counter' });
  if (kind === 'produce') {
    const kinds = [];
    for (let i = 0; i < 4; i++) kinds.push(rng.pick(['strawberry', 'cherry', 'apricot', 'tomato', 'cucumber', 'greens', 'potato', 'onion']));
    const n = Math.floor((w - 0.3) / 0.6);
    for (let i = 0; i < n; i++) {
      for (const row of [0, 1]) {
        const p = L(-w / 2 + 0.45 + i * 0.6, -d / 2 + 0.25 + row * 0.42);
        crate(batch, kinds[(i + row) % kinds.length], p[0], 0.82 + row * 0.08, p[1], ry, rng);
      }
    }
    // the scales with their weights
    const sc = L(w / 2 - 0.35, -d / 2 + 0.75);
    batch.box(0.3, 0.12, 0.22, 0xe8e6e0, sc[0], 0.82, sc[1], { ry });
    batch.box(0.26, 0.02, 0.2, 0xb8bcbe, sc[0], 0.97, sc[1], { ry });
    // stock under the counter
    for (let i = 0; i < 3; i++) {
      const p = L(-w / 2 + 0.5 + i * 0.9, 0.3);
      batch.box(0.5, 0.35, 0.4, 0x9a7a52, p[0], 0, p[1], { ry: ry + i * 0.2 });
    }
  } else if (kind === 'clothes') {
    const rail = L(0, 0.2);
    batch.box(w - 0.3, 0.04, 0.04, 0x8a8d8f, rail[0], 1.95, rail[1], { ry });
    const n = Math.floor((w - 0.4) / 0.28);
    for (let i = 0; i < n; i++) {
      const p = L(-w / 2 + 0.35 + i * 0.28, 0.2);
      const col = rng.pick([0x2f4e7e, 0x3a5a9a, 0x1e1e24, 0xd8584a, 0xe8d06a, 0xf2efe6, 0x7a3a5a, 0x5a8a5a]);
      const len = rng.range(0.6, 1.1);
      batch.box(0.04, len, rng.range(0.4, 0.55), col, p[0], 1.93 - len, p[1], { ry });
    }
    // shoes on the counter in pairs
    for (let i = 0; i < 6; i++) {
      const p = L(-w / 2 + 0.4 + i * 0.42, -d / 2 + 0.45);
      const col = rng.pick([0x1e1a16, 0x5a3a24, 0xe8e4d8, 0x3a3a3a]);
      batch.box(0.1, 0.1, 0.26, col, p[0] - 0.06, 0.82, p[1], { ry });
      batch.box(0.1, 0.1, 0.26, col, p[0] + 0.06, 0.82, p[1], { ry });
    }
  } else if (kind === 'goods') {
    const n = Math.floor((w - 0.3) / 0.45);
    for (let i = 0; i < n; i++) {
      const p = L(-w / 2 + 0.4 + i * 0.45, -d / 2 + 0.45);
      const col = rng.pick([0x2e6ab0, 0xd83a26, 0x3f9a4a, 0xe8c83a, 0xf2efe6, 0xe07a2a]);
      if (i % 2) batch.cyl(0.17, 0.26, col, p[0], 0.82, p[1], { rTop: 0.2, seg: 10 });
      else batch.cyl(0.24, 0.12, col, p[0], 0.82, p[1], { rTop: 0.28, seg: 12 });
    }
    // brooms and buckets hanging at the front
    for (let i = 0; i < 4; i++) {
      const p = L(-w / 2 + 0.4 + i * 0.7, -d / 2 - 0.05);
      batch.cyl(0.15, 0.28, rng.pick([0x2e6ab0, 0xd83a26, 0x3f9a4a]), p[0], 1.5, p[1], { rTop: 0.17, seg: 9 });
    }
  } else if (kind === 'seeds') {
    for (let i = 0; i < 4; i++) {
      const p = L(-w / 2 + 0.55 + i * 0.65, -d / 2 - 0.25);
      sack(batch, i === 1 ? 'kurt' : 'seeds', p[0], p[1], rng);
    }
  }
  return { counter: L(0, -d / 2 + 0.45), front: L(0, -d / 2 - 0.6) };
}

/**
 * A 20 ft shipping container turned into a shop: doors swung open, shelves
 * of boxes inside, a hand-painted sign over the doorway. Front is -z.
 */
export function container(ctx, x, z, ry, rng, signMesh = null) {
  const { batch } = ctx;
  const L = frame(x, z, ry);
  const W = 2.44, D = 6.06, H = 2.59;
  const col = rng.pick([0x3a6aa0, 0xa8342b, 0x3f7a52, 0x8a8d8f, 0xc8a03a, 0x5a4a8a]);
  // the container lies along x; its doors face the aisle at -z
  const c = L(0, 0);
  // build as a long box open at the front: sides and roof in profiled sheet
  tbox(batch, KIT.corrugated, TILES.corrugated, D, H, 0.06, col, ...xz(L(0, W / 2 - 0.03)), ry);
  for (const s of [-1, 1]) {
    tbox(batch, KIT.corrugated, TILES.corrugated, 0.06, H, W, col, ...xz(L(s * (D / 2 - 0.03), 0)), ry);
  }
  batch.box(D, 0.06, W, col, c[0], H - 0.06, c[1], { ry });
  batch.box(D, 0.1, W, 0x6a5a4a, c[0], 0, c[1], { ry });
  // doors folded back against the front, both ends
  for (const s of [-1, 1]) {
    const p = L(s * (D / 2 + 0.02), -W / 2 - 0.55);
    tbox(batch, KIT.corrugated, TILES.corrugated, 0.05, H - 0.1, 1.15, col, p[0], 0.05, p[1], ry);
  }
  // a shelf of boxes and rolls inside
  for (let i = 0; i < 7; i++) {
    const p = L(-D / 2 + 0.6 + i * 0.8, W / 2 - 0.4);
    const bc = rng.pick([0xc8a878, 0xe8e0c8, 0x9a7a52, 0x3a6aa0, 0xd83a26]);
    batch.box(0.6, rng.range(0.6, 1.9), 0.5, bc, p[0], 0.1, p[1], { ry });
  }
  const t = L(0, -W / 2 + 0.5);
  batch.box(D - 1.2, 0.75, 0.6, 0xa8865a, t[0], 0.1, t[1], { ry });
  ctx.colliders.obb(c[0], c[1], D / 2, W / 2, ry, { top: H, tag: 'container' });
  if (signMesh) {
    const sp = L(0, -W / 2 - 0.05);
    signMesh.position.set(sp[0], H + 0.35, sp[1]);
    signMesh.rotation.y = ry + Math.PI;
    ctx.root.add(signMesh);
  }
  return { width: D };
}

function xz(p) { return [p[0], 0, p[1]]; }

/** A beach umbrella in rainbow segments over a folding table. */
export function umbrella(ctx, x, z, rng, { r = 1.3, h = 2.3 } = {}) {
  const { batch } = ctx;
  const seg = 8;
  const cols = [0xd8262c, 0xf0a23a, 0xe8d03a, 0x3f9a4a, 0x2e6ab0, 0x7a3a8a];
  const g = new THREE.ConeGeometry(r, 0.45, seg, 1, true).toNonIndexed();
  const pos = g.attributes.position;
  const colors = new Float32Array(pos.count * 3);
  const c = new THREE.Color();
  // one colour per segment, from the angle of each triangle's centre
  for (let t = 0; t < pos.count; t += 3) {
    const cx = pos.getX(t) + pos.getX(t + 1) + pos.getX(t + 2);
    const cz = pos.getZ(t) + pos.getZ(t + 1) + pos.getZ(t + 2);
    const k = Math.floor(((Math.atan2(cz, cx) + Math.PI) / (Math.PI * 2)) * seg) % seg;
    c.set(cols[k % cols.length]);
    for (let v = t; v < t + 3; v++) { colors[v * 3] = c.r; colors[v * 3 + 1] = c.g; colors[v * 3 + 2] = c.b; }
  }
  g.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  g.translate(x, h, z);
  batch.add(g, { color: null, mat: 'solidClean' });
  // the same cone wound the other way, so it is not see-through from below
  const u = g.clone();
  const up = u.attributes.position;
  for (let t = 0; t < up.count; t += 3) {
    const x1 = up.getX(t + 1), y1 = up.getY(t + 1), z1 = up.getZ(t + 1);
    up.setXYZ(t + 1, up.getX(t + 2), up.getY(t + 2), up.getZ(t + 2));
    up.setXYZ(t + 2, x1, y1, z1);
  }
  u.deleteAttribute('normal');
  u.deleteAttribute('color');
  u.computeVertexNormals();
  u.translate(0, -0.015, 0);
  batch.add(u, { color: 0xd8c8a8 });
  batch.cyl(0.025, h + 0.2, 0xdddddd, x, 0, z, { seg: 5 });
  ctx.colliders.circle(x, z, 0.08, { tag: 'umbrella' });
}

/** A two-wheeled loader's cart (тележка), tipped on its legs. */
export function cart(batch, x, z, ry, rng) {
  const L = frame(x, z, ry);
  const c = L(0, 0);
  batch.box(0.9, 0.08, 1.4, 0x5a6066, c[0], 0.5, c[1], { ry, rx: 0.12 });
  for (const s of [-1, 1]) {
    const w = L(s * 0.5, 0.35);
    batch.cyl(0.22, 0.08, 0x2a2a2a, w[0], 0.22, w[1], { rz: Math.PI / 2, ry, seg: 10 });
    const a = L(s * 0.38, -0.6), hnd = L(s * 0.38, -0.95);
    batch.tube(a[0], 0.55, a[1], hnd[0], 0.95, hnd[1], 0.02, 0x5a6066);
  }
  for (let i = 0; i < rng.int(0, 3); i++) {
    const b = L(rng.range(-0.2, 0.2), rng.range(-0.4, 0.4));
    batch.box(0.5, 0.35, 0.4, rng.pick([0xc8a878, 0x9a7a52]), b[0], 0.6 + i * 0.35, b[1], { ry: ry + rng.range(-0.3, 0.3) });
  }
}

/** A stack of empty crates, the bazaar's universal furniture. */
export function crateStack(batch, x, z, rng) {
  const n = rng.int(2, 6);
  const col = rng.pick([0x2e6ab0, 0x2f8a4a, 0xa8865a]);
  for (let i = 0; i < n; i++) batch.box(0.55, 0.24, 0.38, col, x + rng.range(-0.03, 0.03), i * 0.25, z, { ry: rng.range(-0.1, 0.1) });
}

/** A clay tandyr oven with lepyoshka stacked on a table beside it. */
export function tandyr(ctx, x, z, ry) {
  const { batch } = ctx;
  const L = frame(x, z, ry);
  const o = L(0, 0);
  const g = new THREE.SphereGeometry(0.75, 12, 8, 0, Math.PI * 2, 0, Math.PI * 0.62);
  g.translate(o[0], 0.2, o[1]);
  batch.add(g, { color: 0xb88a5a });
  batch.cyl(0.8, 0.25, 0x9a6e44, o[0], 0, o[1], { seg: 12 });
  batch.cyl(0.24, 0.08, 0x2a1e16, o[0], 0.9, o[1], { seg: 10 });
  const t = L(1.3, 0);
  batch.box(1.2, 0.78, 0.7, 0xa8865a, t[0], 0, t[1], { ry });
  for (let i = 0; i < 6; i++) {
    const p = L(1.0 + (i % 3) * 0.3, (i < 3 ? -0.12 : 0.18));
    batch.cyl(0.14, 0.035, 0xd8a25a, p[0], 0.78 + Math.floor(i / 3) * 0.035, p[1], { seg: 12 });
    batch.cyl(0.07, 0.04, 0xe8c07a, p[0], 0.79 + Math.floor(i / 3) * 0.035, p[1], { seg: 10 });
  }
  ctx.colliders.circle(o[0], o[1], 0.8, { tag: 'tandyr' });
  ctx.colliders.obb(t[0], t[1], 0.6, 0.35, ry, { top: 0.8, tag: 'table' });
  return { table: t };
}
