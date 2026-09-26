import * as THREE from 'three';
import { Batch } from '../../core/batch.js';
import { PAL } from '../../core/palette.js';
import { cel } from '../../core/toon.js';
import { SURF, TILE, hQuad } from '../../core/surfaces.js';
import { canvasTex, cached, signTex, flagTex, FONT } from '../../core/textures.js';
import { rngKit } from '../../core/util.js';
import { BLOCKS, KEEP_CLEAR } from '../plan.js';
import { KIT, TILES, tbox, tboxGeo, mtx, frame, quadGeo, scaleUV } from '../buildings/houseKit.js';
import { stall, container, umbrella, cart, crateStack, sack, tandyr, crate } from '../props/market.js';
import { addTree } from '../props/trees.js';
import '../buildings/houseSounds.js';

/* ------------------------------------------------------------------ *
 * District: the central bazaar (Орталық базар / Центральный рынок).
 *
 * The gate is built after the June 2008 photo (c31): salmon-pink stucco,
 * a white arch with relief rosettes, the blue sheet-metal fascia along
 * the two slopes of the gable with ОРТАЛЫҚ and БАЗАР in yellow letters
 * stepping up and down it, a round emblem and a round clock, low side
 * pavilions under blue metal tile with shop signs, and the flag on top.
 *
 * Behind it: a main aisle from the gate to the covered hall with its
 * blue barrel roof (c42), two double rows of produce stalls to the west,
 * two of clothes and household goods to the east, shipping containers as
 * shops along the east fence, a tandyr by the hall, and a car park on
 * the ул. Айтеке би side. A Soviet concrete panel fence closes the block.
 * ------------------------------------------------------------------ */

const B = BLOCKS.bazaar;
const GATE_Z = B.z1 - 0.6;     // front face of the gate
// the arch goes between two of the avenue's poplars, somewhere in x 50..60
let GATE_X = 56;
const PINK = 0xf0d4cc;
const WHITE = 0xf4f1ea;
const BLUE = 0x1f3e9c;
const YELLOW = '#f2c230';

export const bazaar = {
  name: 'bazaar',
  build(world) {
    // its own batch in one cell keeps the many market materials to a few draw calls
    const batch = new Batch({ name: 'bazaar', cell: Infinity });
    const ctx = { ...world, batch };
    const rng = rngKit(2214);
    GATE_X = pickGateX(ctx);
    ground(ctx);
    gate(ctx);
    hall(ctx);
    fences(ctx);
    rows(ctx, rng);
    containers(ctx, rng);
    carPark(ctx, rng);
    vendors(ctx, rng);
    batch.flush(world.root);
  },
};

/** The gate stands in the middle of its keep-clear zone in plan.js. */
function pickGateX(ctx) {
  const k = KEEP_CLEAR.find((z) => z.id === 'bazaar-gate');
  if (k) return (k.x0 + k.x1) / 2;
  return pickGateXFromTrees(ctx);
}

/** Fallback: the x in 50..60 whose arch is furthest from any street tree. */
function pickGateXFromTrees(ctx) {
  const trees = (ctx.streets?.treeSpots || []).filter((t) => t.z > B.z1 && t.z < B.z1 + 7 && t.x > 40 && t.x < 70);
  if (!trees.length) return 56;
  let best = 56, bestD = -1;
  for (let x = 50; x <= 60; x += 0.5) {
    const d = Math.min(...trees.map((t) => Math.abs(t.x - x)));
    if (d > bestD) { bestD = d; best = x; }
  }
  return best;
}

/* ------------------------------------------------------------------ ground */

function ground(ctx) {
  const { batch } = ctx;
  // worn asphalt over the market, rougher asphalt in the car park
  batch.add(hQuad(18, B.z0, B.x1, B.z1, -0.028, TILE.walk), { mat: SURF.walk, color: null, cast: false });
  batch.add(hQuad(B.x0, B.z0, 18, B.z1, -0.028, TILE.asphalt), { mat: SURF.asphalt, color: null, cast: false });
}

/* ------------------------------------------------------------------ the gate */

function fasciaTex(text, rising, angle) {
  return cached('fascia-' + text, () => canvasTex(1024, 112, (ctx, w, h) => {
    ctx.fillStyle = '#1f3e9c';
    ctx.fillRect(0, 0, w, h);
    // the sheet's ribs
    ctx.fillStyle = 'rgba(255,255,255,0.08)';
    for (let x = 0; x < w; x += 16) ctx.fillRect(x, 0, 3, h);
    const n = text.length;
    // letters stay upright in the world, so counter-rotate them against the slope
    for (let i = 0; i < n; i++) {
      const x = w * (0.12 + (0.76 * (i + 0.5)) / n);
      ctx.save();
      ctx.translate(x, h * 0.54);
      ctx.rotate(rising ? angle : -angle);
      ctx.font = `bold ${h * 0.74}px ${FONT.sans}`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.lineWidth = 5;
      ctx.strokeStyle = '#8a6a10';
      ctx.strokeText(text[i], 0, 0);
      ctx.fillStyle = YELLOW;
      ctx.fillText(text[i], 0, 0);
      ctx.restore();
    }
  }));
}

function medallionTex(kind) {
  return cached('medallion-' + kind, () => canvasTex(256, 256, (ctx, w, h) => {
    ctx.fillStyle = '#f4f1ea';
    ctx.fillRect(0, 0, w, h);
    ctx.beginPath();
    ctx.arc(w / 2, h / 2, w * 0.4, 0, Math.PI * 2);
    ctx.fillStyle = kind === 'clock' ? '#fbfaf5' : '#f2c230';
    ctx.fill();
    ctx.lineWidth = 6;
    ctx.strokeStyle = '#8a8680';
    ctx.stroke();
    if (kind === 'clock') {
      ctx.fillStyle = '#2b2724';
      for (let i = 0; i < 12; i++) {
        const a = (i / 12) * Math.PI * 2;
        ctx.fillRect(w / 2 + Math.cos(a) * w * 0.32 - 3, h / 2 + Math.sin(a) * w * 0.32 - 3, 6, 6);
      }
      // twenty to seven in the evening
      ctx.lineCap = 'round';
      ctx.lineWidth = 8;
      ctx.beginPath(); ctx.moveTo(w / 2, h / 2); ctx.lineTo(w / 2 + Math.cos(-Math.PI / 2 + 6.67 / 12 * Math.PI * 2) * w * 0.18, h / 2 + Math.sin(-Math.PI / 2 + 6.67 / 12 * Math.PI * 2) * w * 0.18); ctx.stroke();
      ctx.lineWidth = 5;
      ctx.beginPath(); ctx.moveTo(w / 2, h / 2); ctx.lineTo(w / 2 + Math.cos(-Math.PI / 2 + 40 / 60 * Math.PI * 2) * w * 0.28, h / 2 + Math.sin(-Math.PI / 2 + 40 / 60 * Math.PI * 2) * w * 0.28); ctx.stroke();
    } else {
      // a stylised sheaf and a steppe eagle, gold on gold
      ctx.fillStyle = '#b8860b';
      ctx.beginPath();
      ctx.moveTo(w * 0.3, h * 0.45);
      ctx.quadraticCurveTo(w * 0.5, h * 0.3, w * 0.7, h * 0.45);
      ctx.quadraticCurveTo(w * 0.5, h * 0.4, w * 0.3, h * 0.45);
      ctx.fill();
      for (let i = 0; i < 7; i++) ctx.fillRect(w * (0.4 + i * 0.03), h * 0.5, 4, h * 0.2);
    }
  }));
}

function gate(ctx) {
  const { batch, root, colliders } = ctx;
  const L = frame(GATE_X, GATE_Z, Math.PI);   // local -z faces the avenue
  const ry = Math.PI;
  const put = (geo, mat, color, lx, y, lz, r2 = 0, rz = 0) => {
    const p = L(lx, lz);
    batch.add(geo, { mat, color, matrix: mtx(p[0], y, p[1], ry + r2, 0, rz) });
  };
  const H = 7.2, D = 6, HALF = 12, AW = 2.45, SPR = 3.4;
  const plaster = [3, 3];

  // piers either side of the arch
  for (const s of [-1, 1]) {
    const cx = s * (AW + (HALF - AW) / 2);
    put(tboxGeo(HALF - AW, H, D, plaster), KIT.plaster, PINK, cx, 0, D / 2);
    const c = L(cx, D / 2);
    colliders.obb(c[0], c[1], (HALF - AW) / 2, D / 2, ry, { top: H, tag: 'bazaar-gate' });
  }
  // above the arch, and the spandrels whose arc is the vault of the passage
  put(tboxGeo(AW * 2, H - (SPR + AW + 0.12), D, plaster), KIT.plaster, PINK, 0, SPR + AW + 0.12, D / 2);
  const sp = new THREE.Shape();
  sp.moveTo(-AW, SPR);
  sp.lineTo(-AW, SPR + AW + 0.12);
  sp.lineTo(AW, SPR + AW + 0.12);
  sp.lineTo(AW, SPR);
  sp.absarc(0, SPR, AW, 0, Math.PI, false);
  const spg = new THREE.ExtrudeGeometry(sp, { depth: D, bevelEnabled: false, curveSegments: 16 });
  scaleUV(spg, plaster);
  put(spg, KIT.plaster, PINK, 0, 0, 0);
  // the gable, a false front over the roofline
  const GH = 4.4;
  const gs = new THREE.Shape();
  gs.moveTo(-HALF - 0.4, 0);
  gs.lineTo(HALF + 0.4, 0);
  gs.lineTo(0, GH);
  gs.closePath();
  const gg = new THREE.ExtrudeGeometry(gs, { depth: 0.5, bevelEnabled: false });
  scaleUV(gg, plaster);
  put(gg, KIT.plaster, PINK, 0, H, 0);
  // blue fascia along both slopes, with the name on it
  const ang = Math.atan2(GH, HALF + 0.4);
  const slope = Math.hypot(HALF + 0.4, GH) + 0.3;
  const band = 1.45;
  for (const s of [-1, 1]) {
    // s = +1 is the viewer's left (local +x) and carries ОРТАЛЫҚ; the band
    // hangs from the slope line, its top edge a little proud of the gable
    const mx = s * (HALF + 0.4) / 2, my = H + GH / 2 + 0.12;
    const rz = -s * ang;
    const fg = tboxGeo(slope, band, 0.3);
    fg.translate(0, -band, 0);
    put(fg, 'solid', BLUE, mx, my, -0.2, 0, rz);
    const text = s > 0 ? 'ОРТАЛЫҚ' : 'БАЗАР';
    const qg = quadGeo(slope - 0.3, band - 0.16);
    qg.translate(0, -band + 0.08, 0);
    const plane = new THREE.Mesh(qg, cel({ map: fasciaTex(text, s > 0, ang), cache: false, grime: 0.02, dirt: 0 }));
    const pp = L(mx, -0.37);
    plane.position.set(pp[0], my, pp[1]);
    plane.rotation.set(0, ry, rz);
    root.add(plane);
  }
  // white arch surround, pilasters and rosettes
  const ring = new THREE.Shape();
  ring.absarc(0, SPR, AW + 0.62, 0, Math.PI, false);
  ring.absarc(0, SPR, AW, Math.PI, 0, true);
  const rg = new THREE.ExtrudeGeometry(ring, { depth: 0.2, bevelEnabled: false, curveSegments: 18 });
  put(rg, 'solid', WHITE, 0, 0, -0.2);
  put(rg, 'solid', WHITE, 0, 0, D);   // and a plainer one on the market side
  for (const s of [-1, 1]) {
    put(tboxGeo(0.62, SPR, 0.2), 'solid', WHITE, s * (AW + 0.31), 0, -0.1);
    put(tboxGeo(0.9, 0.25, 0.3), 'solid', WHITE, s * (AW + 0.31), SPR - 0.1, -0.15);
  }
  for (let i = 0; i < 5; i++) {
    const a = Math.PI * (0.12 + (i * 0.76) / 4);
    const g = new THREE.CylinderGeometry(0.26, 0.26, 0.12, 16);
    g.rotateX(Math.PI / 2);
    put(g, 'solid', 0xf2dcd4, Math.cos(a) * (AW + 0.31), SPR + Math.sin(a) * (AW + 0.31), -0.26);
  }
  for (const s of [-1, 1]) {
    for (const [dx, dy] of [[1.3, 5.6], [0.9, 4.2]]) {
      const g = new THREE.CylinderGeometry(0.32, 0.36, 0.1, 16);
      g.rotateX(Math.PI / 2);
      put(g, 'solid', 0xf6e6e0, s * (AW + dx + 0.6), dy, -0.06);
    }
  }
  // round medallions: the emblem on the left, the clock on the right
  for (const [s, kind] of [[1, 'emblem'], [-1, 'clock']]) {
    const g = new THREE.CylinderGeometry(0.85, 0.85, 0.14, 24);
    g.rotateX(Math.PI / 2);
    put(g, 'solid', WHITE, s * 8.4, 5.5, -0.07);
    const m = new THREE.Mesh(new THREE.CircleGeometry(0.66, 24), cel({ map: medallionTex(kind), cache: false, grime: 0, dirt: 0 }));
    const p = L(s * 8.4, -0.16);
    m.position.set(p[0], 5.5, p[1]);
    m.rotation.y = ry + Math.PI;
    root.add(m);
  }
  // corner pilasters and a grey stone base along the whole front
  for (const s of [-1, 1]) put(tboxGeo(0.5, H, 0.25), 'solid', WHITE, s * (HALF - 0.25), 0, -0.05);
  put(tboxGeo(HALF * 2 + 0.2, 0.45, 0.3), 'solid', 0x9a948a, 0, 0, -0.1);

  // side pavilions under blue metal tile
  wing(ctx, L, ry, 1, 'Колготки', 'Россия производства');
  wing(ctx, L, ry, -1, 'Сүт тағамдары', 'Молочная продукция');

  // the flag at the apex
  const fp = L(0, 0.2);
  batch.cyl(0.04, 3.0, 0xd8d8d8, fp[0], H + GH, fp[1], { seg: 6 });
  const flag = new THREE.Mesh(new THREE.PlaneGeometry(1.8, 0.9, 6, 1), cel({ map: flagTex(), cache: false, side: THREE.DoubleSide, grime: 0, dirt: 0 }));
  flag.geometry.translate(0.9, 0, 0);
  const fpos = flag.geometry.attributes.position;
  flag.position.set(fp[0], H + GH + 2.5, fp[1]);
  flag.rotation.y = 0.9;
  root.add(flag);
  ctx.update((dt, game) => {
    for (let i = 0; i < fpos.count; i++) {
      const x = fpos.getX(i);
      fpos.setZ(i, Math.sin(x * 2.4 - game.time * 5) * 0.12 * (x / 1.8));
    }
    fpos.needsUpdate = true;
  });

  // the passage floor
  const a = L(-AW, -0.4), b = L(AW, D + 0.4);
  batch.add(hQuad(Math.min(a[0], b[0]), Math.min(a[1], b[1]), Math.max(a[0], b[0]), Math.max(a[1], b[1]), -0.02, TILE.slabs), { mat: SURF.slabs, color: null, cast: false });
}

function wing(ctx, L, ry, s, title, sub) {
  const { batch, root, colliders } = ctx;
  const W = 9.5, D = 7, H = 3.9;
  const cx = s * (12 + W / 2);
  const put = (geo, mat, color, lx, y, lz, r2 = 0, rx = 0) => {
    const p = L(lx, lz);
    batch.add(geo, { mat, color, matrix: mtx(p[0], y, p[1], ry + r2, rx, 0) });
  };
  put(tboxGeo(W, H, D, [3, 3]), KIT.plaster, PINK, cx, 0, D / 2 + 0.5);
  put(tboxGeo(W + 0.2, 0.4, 0.3), 'solid', 0x9a948a, cx, 0, 0.45);
  const c = L(cx, D / 2 + 0.5);
  colliders.obb(c[0], c[1], W / 2, D / 2, ry, { top: H, tag: 'bazaar-wing' });
  // pent roof of blue metal tile, sloping to the front
  const rg = tboxGeo(W + 0.6, 0.06, D + 1.4, TILES.tile);
  put(rg, KIT.tile, 0x2b55a0, cx, H + 0.55, D / 2 + 0.2, 0, -0.16);
  // arched shop windows and a door, white surrounds
  for (let i = 0; i < 3; i++) {
    const lx = cx - W / 2 + 1.7 + i * 3.05;
    const door = i === (s > 0 ? 2 : 0);
    const w = door ? 1.2 : 1.7, h = door ? 2.2 : 1.9, y0 = door ? 0 : 0.9;
    put(tboxGeo(w + 0.36, h + 0.3, 0.12), 'solid', WHITE, lx, y0 - 0.1, 0.44);
    if (!door) {
      const arch = new THREE.CylinderGeometry((w + 0.36) / 2, (w + 0.36) / 2, 0.12, 16, 1, false, -Math.PI / 2, Math.PI);
      arch.rotateX(-Math.PI / 2);
      put(arch, 'solid', WHITE, lx, y0 + h + 0.2, 0.44);
    }
    put(quadGeo(w, h, door ? 0.5 : 0.25, 0, door ? 0.75 : 0.5, 1), KIT.curtains, 0xffffff, lx, y0, 0.37);
  }
  // the shop sign over the door, as in the photo
  const tex = s > 0
    ? signTex({ w: 384, h: 200, bg: '#f2d23a', fg: '#b8262c', lines: [title.toUpperCase(), sub], sizes: [1.2, 0.7], border: '#b8262c', seed: 12, wear: 0.4 })
    : signTex({ w: 512, h: 160, bg: '#ffffff', fg: '#1f3e9c', lines: [title.toUpperCase(), sub.toUpperCase()], border: '#1f3e9c', seed: 13, wear: 0.4 });
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(s > 0 ? 1.4 : 5.2, s > 0 ? 0.75 : 0.8), cel({ map: tex, cache: false, grime: 0.02, dirt: 0 }));
  const lx = s > 0 ? cx - W / 2 + 1.7 + 2 * 3.05 : cx;
  const p = L(lx, 0.3);
  sign.position.set(p[0], s > 0 ? 2.75 : 3.4, p[1]);
  sign.rotation.y = ry + Math.PI;
  root.add(sign);
}

/* ------------------------------------------------------------------ covered hall */

function hall(ctx) {
  const { batch, root, colliders } = ctx;
  const x0 = 30, x1 = 84, z0 = B.z0 + 2.5, z1 = B.z0 + 20;
  const W = x1 - x0, D = z1 - z0, H = 6.2;
  const cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;
  tbox(batch, KIT.brick, TILES.brick, W, 1.2, D, 0xb05a40, cx, 0, cz);
  tbox(batch, KIT.plaster, TILES.plaster, W, H - 1.2, D, 0xe8dcc0, cx, 1.2, cz);
  // a band of windows on the long sides
  for (const side of [-1, 1]) {
    for (let i = 0; i < 11; i++) {
      const x = x0 + 3 + i * ((W - 6) / 10);
      const z = side < 0 ? z0 - 0.02 : z1 + 0.02;
      const g = quadGeo(3.2, 1.8, 0.25, 0, 0.5, 1);
      batch.add(g, { mat: KIT.curtains, color: 0xffffff, matrix: mtx(x, 3.4, z, side < 0 ? 0 : Math.PI) });
      batch.box(3.4, 0.12, 0.2, WHITE, x, 3.3, z + side * 0.05);
    }
  }
  // barrel roof in blue sheet, along the hall
  const R = (D * D / 4 + 3.2 * 3.2) / (2 * 3.2);
  const th = Math.asin((D / 2) / R);
  const g = new THREE.CylinderGeometry(R, R, W + 1.2, 28, 1, true, -th, th * 2);
  g.rotateZ(Math.PI / 2);
  g.rotateX(-Math.PI / 2);
  // uv: seams run over the curve, spaced along the hall
  const uv = g.attributes.uv;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getY(i) * (W + 1.2) / 0.6, uv.getX(i) * (2 * th * R) / 2);
  g.translate(cx, H - (R - 3.2), cz);
  batch.add(g, { mat: KIT.seam, color: 0x2f6ac0 });
  // gable ends of the barrel
  for (const [x, ry] of [[x0 - 0.02, -Math.PI / 2], [x1 + 0.02, Math.PI / 2]]) {
    const s = new THREE.Shape();
    const n = 16;
    s.moveTo(-D / 2, 0);
    for (let i = 0; i <= n; i++) {
      const a = -th + (2 * th * i) / n;
      s.lineTo(R * Math.sin(a), R * Math.cos(a) - (R - 3.2));
    }
    s.lineTo(D / 2, 0);
    const eg = new THREE.ShapeGeometry(s);
    batch.add(eg, { color: 0xe8dcc0, matrix: mtx(x, H, cz, ry) });
  }
  colliders.box(x0, z0, x1, z1, { top: H + 3, tag: 'hall' });
  // entrance on the aisle side, with the strip curtain every meat hall had
  const ex = GATE_X;
  batch.box(4.2, 3.4, 0.4, WHITE, ex, 0, z1 + 0.1);
  batch.box(3.4, 2.9, 0.1, 0x2a2622, ex, 0, z1 + 0.32, { mat: 'glass' });
  for (let i = 0; i < 12; i++) batch.box(0.26, 2.8, 0.01, 0xcfe0e0, ex - 1.55 + i * 0.28, 0.02, z1 + 0.4, { mat: 'glass', cast: false });
  const tex = signTex({ w: 768, h: 150, bg: '#1f3e9c', fg: '#ffffff', lines: ['ЖАБЫҚ БАЗАР · ЕТ, СҮТ', 'КРЫТЫЙ РЫНОК · МЯСО, МОЛОКО'], border: '#f2c230', seed: 31, wear: 0.5 });
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(7.5, 1.45), cel({ map: tex, cache: false, grime: 0.02, dirt: 0 }));
  sign.position.set(ex, 4.3, z1 + 0.06);
  root.add(sign);
}

/* ------------------------------------------------------------------ fences */

function panelFenceTex() {
  return cached('fence-po2', () => canvasTex(256, 256, (ctx, w, h) => {
    const r = rngKit(44);
    ctx.fillStyle = '#b8b3a8';
    ctx.fillRect(0, 0, w, h);
    // the ПО-2 relief: a lattice of little rhombi
    const n = 6;
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) {
        const cx = (i + 0.5) * w / n, cy = (j + 0.5) * h / n;
        ctx.fillStyle = 'rgba(80,76,70,0.35)';
        ctx.beginPath();
        ctx.moveTo(cx, cy - h / n * 0.42);
        ctx.lineTo(cx + w / n * 0.42, cy);
        ctx.lineTo(cx, cy + h / n * 0.42);
        ctx.lineTo(cx - w / n * 0.42, cy);
        ctx.fill();
        ctx.fillStyle = 'rgba(230,226,218,0.55)';
        ctx.beginPath();
        ctx.moveTo(cx, cy - h / n * 0.3);
        ctx.lineTo(cx + w / n * 0.3, cy);
        ctx.lineTo(cx, cy + h / n * 0.3);
        ctx.lineTo(cx - w / n * 0.3, cy);
        ctx.fill();
      }
    }
    for (let i = 0; i < 20; i++) {
      ctx.fillStyle = `rgba(90,80,60,${r.range(0.05, 0.14)})`;
      ctx.fillRect(r.range(0, w), h * 0.6, r.range(2, 6), r.range(20, 100));
    }
  }, { repeat: [1, 1] }));
}

let fenceMat = null;
function panelFence(ctx, x0, z0, x1, z1) {
  const { batch, colliders } = ctx;
  if (!fenceMat) fenceMat = cel({ map: panelFenceTex(), vertexColors: true, cache: false, grime: 0.05, dirt: 0.4 });
  const len = Math.hypot(x1 - x0, z1 - z0);
  const n = Math.max(1, Math.round(len / 4));
  const ry = Math.atan2(-(z1 - z0), x1 - x0);
  for (let i = 0; i < n; i++) {
    const t = (i + 0.5) / n;
    const x = x0 + (x1 - x0) * t, z = z0 + (z1 - z0) * t;
    tbox(batch, fenceMat, [len / n, 2.4], len / n - 0.04, 2.4, 0.14, 0xffffff, x, 0, z, ry);
    const px = x0 + (x1 - x0) * (i / n), pz = z0 + (z1 - z0) * (i / n);
    batch.box(0.28, 2.6, 0.28, 0xa8a398, px, 0, pz, { ry });
  }
  colliders.obb((x0 + x1) / 2, (z0 + z1) / 2, len / 2, 0.15, ry, { top: 2.4, tag: 'fence' });
}

/** Green steel bars on a low plinth: the fence either side of the gate on the avenue. */
function barFence(ctx, x0, x1, z) {
  const { batch, colliders } = ctx;
  batch.box(x1 - x0, 0.4, 0.3, 0x9a948a, (x0 + x1) / 2, 0, z);
  batch.box(x1 - x0, 0.06, 0.06, PAL.fenceGreen, (x0 + x1) / 2, 1.9, z);
  batch.box(x1 - x0, 0.05, 0.05, PAL.fenceGreen, (x0 + x1) / 2, 0.55, z);
  for (let x = x0 + 0.1; x < x1; x += 0.16) batch.box(0.025, 1.55, 0.025, PAL.fenceGreen, x, 0.4, z, { cast: false });
  for (let x = x0; x <= x1 + 0.01; x += 3) batch.box(0.34, 2.2, 0.34, 0xe8e2d4, x, 0, z);
  colliders.box(x0, z - 0.2, x1, z + 0.2, { top: 2.1, tag: 'fence' });
}

function fences(ctx) {
  const z = B.z1 - 0.3;
  barFence(ctx, B.x0 + 0.3, GATE_X - 21.6, z);
  barFence(ctx, GATE_X + 21.6, B.x1 - 0.3, z);
  // concrete panels on the other three sides, with the car park gap on ул. Айтеке би
  panelFence(ctx, B.x0 + 0.3, B.z0 + 0.3, B.x1 - 0.3, B.z0 + 0.3);
  panelFence(ctx, B.x1 - 0.3, B.z0 + 0.3, B.x1 - 0.3, B.z1 - 0.3);
  panelFence(ctx, B.x0 + 0.3, B.z0 + 0.3, B.x0 + 0.3, -66);
  panelFence(ctx, B.x0 + 0.3, -56, B.x0 + 0.3, B.z1 - 0.3);
}

/* ------------------------------------------------------------------ stalls */

function rows(ctx, rng) {
  const z0 = -76, z1 = -26;
  const specs = [
    { xc: 30, kinds: ['produce', 'produce', 'produce', 'seeds'] },
    { xc: 42, kinds: ['produce', 'produce', 'goods'] },
    { xc: 68, kinds: ['clothes', 'clothes', 'goods'] },
    { xc: 80, kinds: ['clothes', 'goods', 'goods', 'clothes'] },
  ];
  const W = 3.4;
  ctx.spots.bazaarStalls = [];
  for (const sp of specs) {
    // the spine: a steel fence of backs, then stalls both sides
    ctx.batch.box(0.1, 2.0, z1 - z0, 0x6a6c6e, sp.xc, 0, (z0 + z1) / 2);
    for (let z = z0 + W / 2; z < z1; z += W) {
      for (const side of [-1, 1]) {
        const kind = rng.pick(sp.kinds);
        // stall front faces away from the spine: -x side faces west (ry = -PI/2 makes local -z point to -x)
        const ry = side < 0 ? Math.PI / 2 : -Math.PI / 2;
        const x = sp.xc + side * 1.15;
        const s = stall(ctx, x, z, ry, kind, rng, { w: W - 0.05, d: 2.2 });
        ctx.spots.bazaarStalls.push({ x, z, ry, kind, ...s });
      }
    }
  }
  aisle(ctx, rng);
  // a few elms that survived the paving
  for (const [x, z] of [[24, -22], [90, -22], [36, -80], [62, -80]]) {
    addTree(ctx.batch, 'elm', x, z, x * 13 + 7);
    ctx.colliders.circle(x, z, 0.3, { tag: 'tree' });
  }
}

/**
 * The main aisle: two lines of folding tables and blankets facing a
 * walkway down the middle, under rainbow umbrellas, with the loaders'
 * carts and empty crates wherever they were left.
 */
function aisle(ctx, rng) {
  const { batch } = ctx;
  for (const side of [-1, 1]) {
    const x = GATE_X + side * 6.2;
    for (let z = -31; z > -76; z -= 3.3) {
      if (rng.chance(0.12)) continue;
      if (rng.chance(0.3)) {
        blanket(batch, x, z, rng);
        continue;
      }
      // a folding table, its seller's side toward the stalls
      batch.box(1.4, 0.72, 0.7, 0xb8a888, x, 0, z, { ry: Math.PI / 2 });
      batch.box(1.5, 0.03, 0.8, rng.pick([0xe8e0d0, 0xc8d8e8, 0xe8c8c8]), x, 0.72, z, { ry: Math.PI / 2 });
      const goods = rng.pick(['strawberry', 'cherry', 'apricot', 'greens', 'kurt', 'jars']);
      if (goods === 'jars') {
        for (let k = 0; k < 6; k++) batch.cyl(0.06, 0.16, rng.pick([0xf2eee0, 0xd8a23a, 0xc84a2a]), x + (k % 2 - 0.5) * 0.25, 0.75, z - 0.5 + Math.floor(k / 2) * 0.45, { seg: 8 });
      } else {
        for (let k = 0; k < 2; k++) crate(batch, goods, x, 0.75, z - 0.35 + k * 0.7, Math.PI / 2, rng, { plastic: goods !== 'kurt' });
      }
      batch.box(0.35, 0.42, 0.35, rng.pick([0x3a6aa0, 0xd83a26, 0x2f8a4a]), x + side * 0.8, 0, z);
      ctx.colliders.box(x - 0.4, z - 0.75, x + 0.4, z + 0.75, { top: 0.9, tag: 'table' });
      if (rng.chance(0.35)) umbrella(ctx, x + side * 0.4, z, rng, { r: 1.1, h: 2.2 });
    }
  }
  for (let z = -34; z > -76; z -= 11) {
    if (rng.chance(0.6)) cart(batch, GATE_X + rng.range(-2.5, 2.5), z, rng.range(0, 6), rng);
    crateStack(batch, GATE_X + rng.sign() * 4.2, z - 4, rng);
  }
}

/** Shoes, toys or kitchen things laid out on a blanket on the asphalt. */
function blanket(batch, x, z, rng) {
  batch.box(1.3, 0.02, 1.9, rng.pick([0x8a2a3a, 0x3a4a8a, 0x5a3a2a, 0x2a5a4a]), x, 0.0, z, { cast: false });
  for (let k = 0; k < 8; k++) {
    const px = x + rng.range(-0.5, 0.5), pz = z + rng.range(-0.8, 0.8);
    const col = rng.pick([0x1e1a16, 0x5a3a24, 0xe8e4d8, 0x2e6ab0, 0xd83a26, 0xe8c83a]);
    batch.box(0.12, 0.08, 0.26, col, px, 0.02, pz, { ry: rng.range(0, 3), cast: false });
  }
}

function containers(ctx, rng) {
  const names = [
    ['АЯҚ КИІМ', 'ОБУВЬ'], ['КІЛЕМДЕР', 'КОВРЫ'], ['ЫДЫС-АЯҚ', 'ПОСУДА'], ['ОЙЫНШЫҚТАР', 'ИГРУШКИ'],
    ['ҚҰРЫЛЫС', 'СТРОЙМАТЕРИАЛЫ'], ['КИІМ', 'ОДЕЖДА'], ['ЭЛЕКТРОТОВАРЫ', 'ЛАМПЫ, ПРОВОДА'], ['АУДИО, ВИДЕО', 'КАССЕТЫ, ДИСКИ'],
    ['ТЕКСТИЛЬ', 'ТКАНИ'], ['САҒАТ ЖӨНДЕУ', 'РЕМОНТ ЧАСОВ'], ['АЯҚ КИІМ', 'ОБУВЬ'],
  ];
  const spots = [];
  for (let z = -24; z > B.z0 + 24; z -= 6.4) spots.push(z);
  const looks = spots.map(() => rng.pick([['#ffffff', '#1f3e9c'], ['#f2d23a', '#b8262c'], ['#1f3e9c', '#ffffff'], ['#b8262c', '#ffffff']]));
  // all the container signs share one atlas texture and one draw call
  const H = 128;
  const atlas = cached('bazaar-container-signs', () => canvasTex(512, H * spots.length, (c) => {
    spots.forEach((_, i) => {
      const [kz, ru] = names[i % names.length];
      const [bg, fg] = looks[i];
      c.drawImage(signTex({ w: 512, h: H, bg, fg, lines: [kz, ru], wear: 0.6, seed: 200 + i }).image, 0, i * H);
    });
  }));
  const mat = cel({ map: atlas, cache: false, grime: 0.02, dirt: 0 });
  const ry = Math.PI / 2;
  spots.forEach((z, i) => {
    // containers along the east fence, doors toward the aisle at the west
    const x = B.x1 - 2.2;
    container(ctx, x, z, ry, rng);
    const g = new THREE.PlaneGeometry(3.6, 0.9);
    const uv = g.attributes.uv;
    const v0 = 1 - (i + 1) / spots.length, v1 = 1 - i / spots.length;
    for (let k = 0; k < uv.count; k++) uv.setY(k, v0 + uv.getY(k) * (v1 - v0));
    const p = frame(x, z, ry)(0, -1.27);
    ctx.batch.add(g, { mat, color: null, matrix: mtx(p[0], 2.94, p[1], ry + Math.PI), cast: false });
  });
}

/* ------------------------------------------------------------------ car park */

function carPark(ctx, rng) {
  const { batch, root } = ctx;
  const bays = [];
  for (const zr of [-30, -46, -76, -92]) {
    for (let x = B.x0 + 3.5; x < 14; x += 2.7) bays.push([x, zr]);
  }
  for (const [x, z] of bays) {
    batch.box(0.1, 0.01, 5, 0xe8e5da, x - 1.35, -0.02, z, { cast: false, mat: 'decal' });
    ctx.parking.push({ x, z, ry: rng.chance(0.5) ? 0 : Math.PI, chance: 0.7 });
  }
  // attendant's booth and barrier at the gap on ул. Айтеке би
  const bx = B.x0 + 3, bz = -54;
  tbox(batch, KIT.corrugated, TILES.corrugated, 1.6, 2.3, 1.6, 0x3a6aa0, bx, 0, bz);
  batch.box(1.9, 0.08, 1.9, 0x2b55a0, bx, 2.3, bz);
  batch.box(1.2, 0.8, 0.02, 0x9ab8c8, bx + 0.81, 1.2, bz, { ry: Math.PI / 2, mat: 'glass' });
  ctx.colliders.box(bx - 0.8, bz - 0.8, bx + 0.8, bz + 0.8, { top: 2.3, tag: 'booth' });
  const arm = [B.x0 + 1.2, -60.5];
  batch.box(0.3, 1.0, 0.3, 0x3a3a3a, arm[0], 0, -65.6);
  for (let k = 0; k < 8; k++) batch.box(0.1, 0.1, 1.1, k % 2 ? 0xd8262c : 0xf2f0ea, arm[0], 0.95, -65 + k * 1.1);
  const tex = signTex({ w: 512, h: 150, bg: '#1f3e9c', fg: '#ffffff', lines: ['АВТОТҰРАҚ', 'АВТОСТОЯНКА'], border: '#ffffff', seed: 51, wear: 0.4 });
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(2.2, 0.65), cel({ map: tex, cache: false, grime: 0.02, dirt: 0 }));
  sign.position.set(bx - 0.82, 2.8, bz);
  sign.rotation.y = -Math.PI / 2;
  root.add(sign);
  // entrance lane marking
  batch.add(hQuad(B.x0, -66, B.x0 + 8, -56, -0.024, TILE.asphalt), { mat: SURF.asphalt, color: null, cast: false });
}

/* ------------------------------------------------------------------ things to buy */

function vendors(ctx, rng) {
  const { batch } = ctx;
  // the seed lady's spot: sacks and a stool just inside the gate
  const sx = GATE_X + 3.8, sz = B.z1 - 9;
  sack(batch, 'seeds', sx, sz, rng);
  sack(batch, 'seeds', sx + 0.7, sz + 0.2, rng);
  batch.box(0.35, 0.45, 0.35, 0x3a6aa0, sx + 0.35, 0, sz + 0.8);
  batch.cyl(0.06, 0.1, 0xe8e6e0, sx, 0.62, sz, { seg: 8, rTop: 0.075 });
  ctx.colliders.box(sx - 0.4, sz - 0.4, sx + 1.1, sz + 1.1, { top: 0.7, tag: 'sacks' });
  buy(ctx, sx + 0.35, 0.6, sz, 'Buy a glass of sunflower seeds · шемішке, 20 ₸', 20, 'seeds',
    'A glass of warm roasted seeds poured into a newspaper cone. The husks go on the pavement, like everyone else\'s.', 'seeds');

  // kurt on a tray on a folding table
  const kx = GATE_X - 4.2, kz = B.z1 - 12;
  batch.box(1.1, 0.75, 0.6, 0xa8865a, kx, 0, kz);
  for (let i = 0; i < 3; i++) crate(batch, i === 1 ? 'kurt' : 'kurt', kx - 0.35 + i * 0.35, 0.75, kz, 0, rng, { w: 0.32, d: 0.4, h: 0.05, plastic: false });
  ctx.colliders.box(kx - 0.6, kz - 0.35, kx + 0.6, kz + 0.35, { top: 0.8, tag: 'table' });
  buy(ctx, kx, 0.9, kz, 'Buy kurt · құрт, 50 ₸', 50, 'kurt', 'Salty and rock hard. It will last you the whole summer.', 'kurt');

  // strawberries at the first produce stall on the main aisle
  // the produce stall on the main aisle nearest the gate
  const st = ctx.spots.bazaarStalls
    .filter((s) => s.kind === 'produce' && s.x > 42 && s.x < GATE_X)
    .reduce((a, s) => (!a || s.z > a.z ? s : a), null);
  if (st) {
    buy(ctx, st.counter[0], 1.0, st.counter[1], 'Buy a kilo of strawberries · 250 ₸', 250, 'strawberries', 'A kilo of garden strawberries in a paper cone. The seller throws in one more.', 'strawberries');
    buy(ctx, st.counter[0], 1.0, st.counter[1] + 1.7, 'Taste a cherry (the seller insists)', 0, 'cherry', '«Кушай, кушай, не стесняйся!» Sweet, a little sour.');
  }

  // lepyoshka from the tandyr by the hall
  const t = tandyr(ctx, GATE_X + 7, B.z0 + 24.5, 0);
  buy(ctx, t.table[0], 1.0, t.table[1], 'Buy a lepyoshka · нан, 40 ₸', 40, 'bread', 'Hot from the tandyr, with sesame on top. You tear off a piece straight away.', 'lepyoshka');
}

/** A seller's counter. `hold` names the item that ends up in your hand. */
function buy(ctx, x, y, z, label, price, what, toast, hold = null) {
  ctx.interact({
    x, y, z, w: 1.0, h: 1.0, d: 1.0,
    label,
    action: (game) => {
      if (price && !game.pay(price, what)) return;
      game.audio.play('rustle', { pos: { x, y, z } });
      game.hud.flash(toast, 3200);
      if (hold) game.hands?.give(hold);
    },
  });
}

export { GATE_X, GATE_Z };
