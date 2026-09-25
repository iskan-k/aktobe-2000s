import * as THREE from 'three';
import { cel, flat } from '../../core/toon.js';
import { SURF, TILE, hQuad } from '../../core/surfaces.js';
import { canvasTex, cached, FONT } from '../../core/textures.js';
import { rngKit } from '../../core/util.js';
import { BLOCKS } from '../plan.js';
import { KIT, TILES, tbox, tboxGeo, mtx } from '../buildings/houseKit.js';
import { addTree } from '../props/trees.js';

/* ------------------------------------------------------------------ *
 * The Nurdaulet mosque and shopping centre (1999), on the west edge
 * north of the avenue (c30, c38, c42): white blocks with turquoise
 * pointed-arch panels, a turquoise dome on a drum with small domes at
 * the corners, and the 57 m minaret with its beige tile shaft and two
 * white balconies. The shopping centre is the lower white block on the
 * avenue with a band of blue glass and NURDAULET across the top.
 * ------------------------------------------------------------------ */

const B = BLOCKS.westEdge;
const TURQ = 0x5fb8d6;
const WHITE = 0xf4f2ec;
const BEIGE = 0xd8c6a4;
const ROOF = 0x9a9c9a;

/* ------------------------------------------------------------------ textures */

/** Pointed (equilateral) arch path from x0..x1, springing at ys, feet at yb. */
function archPath(ctx, x0, x1, ys, yb) {
  const w = x1 - x0;
  ctx.beginPath();
  ctx.moveTo(x0, yb);
  ctx.lineTo(x0, ys);
  ctx.arc(x1, ys, w, Math.PI, Math.PI + Math.PI / 3);
  ctx.arc(x0, ys, w, -Math.PI / 3, 0);
  ctx.lineTo(x1, yb);
  ctx.closePath();
}

/** One bay of white wall with a turquoise pointed-arch panel and a window slit. */
function archTex() {
  return cached('nur-arch', () => canvasTex(256, 512, (ctx, w, h) => {
    const r = rngKit(58);
    ctx.fillStyle = '#f4f2ec';
    ctx.fillRect(0, 0, w, h);
    for (let i = 0; i < 40; i++) {
      ctx.fillStyle = `rgba(120,110,90,${r.range(0.02, 0.06)})`;
      ctx.fillRect(r.range(0, w), r.range(0, h), r.range(10, 50), r.range(10, 60));
    }
    archPath(ctx, w * 0.2, w * 0.8, h * 0.34, h * 0.93);
    ctx.fillStyle = '#5fb8d6';
    ctx.fill();
    archPath(ctx, w * 0.27, w * 0.73, h * 0.36, h * 0.93);
    ctx.lineWidth = 5;
    ctx.strokeStyle = 'rgba(255,255,255,0.8)';
    ctx.stroke();
    // the window slit, glazed dark
    archPath(ctx, w * 0.42, w * 0.58, h * 0.46, h * 0.8);
    ctx.fillStyle = '#26404c';
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.18)';
    ctx.fillRect(w * 0.44, h * 0.5, w * 0.03, h * 0.28);
  }, { repeat: [1, 1] }));
}

/** Beige ceramic tile on the minaret shaft, with a narrow window every few metres. */
function minaretTex() {
  return cached('nur-minaret', () => canvasTex(128, 512, (ctx, w, h) => {
    ctx.fillStyle = '#e6d6b6';
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = 'rgba(120,100,70,0.35)';
    ctx.lineWidth = 1.5;
    for (let y = 0; y < h; y += 16) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke(); }
    for (let x = 0; x < w; x += 16) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke(); }
    archPath(ctx, w * 0.36, w * 0.64, h * 0.28, h * 0.62);
    ctx.fillStyle = '#3a4c56';
    ctx.fill();
    ctx.lineWidth = 6;
    ctx.strokeStyle = '#f4f2ec';
    ctx.stroke();
  }, { repeat: [1, 1] }));
}

/** Blue glass curtain wall with pale mullions, for the shopping centre. */
function mallGlassTex() {
  return cached('nur-glass', () => canvasTex(256, 256, (ctx, w, h) => {
    const g = ctx.createLinearGradient(0, 0, w * 0.3, h);
    g.addColorStop(0, '#6fa6c8');
    g.addColorStop(0.5, '#2c5e8e');
    g.addColorStop(1, '#1e446e');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = 'rgba(255,255,255,0.12)';
    ctx.beginPath();
    ctx.moveTo(w * 0.1, h); ctx.lineTo(w * 0.5, 0); ctx.lineTo(w * 0.65, 0); ctx.lineTo(w * 0.25, h);
    ctx.fill();
    ctx.fillStyle = '#c8d2d8';
    ctx.fillRect(0, 0, w, 8);
    ctx.fillRect(0, h / 2 - 3, w, 6);
    ctx.fillRect(0, 0, 8, h);
    ctx.fillRect(w / 2 - 3, 0, 6, h);
  }, { repeat: [1, 1] }));
}

/** NURDAULET in blue capitals on a transparent ground. */
function lettersTex() {
  return cached('nur-letters', () => canvasTex(1024, 128, (ctx, w, h) => {
    ctx.clearRect(0, 0, w, h);
    ctx.font = `bold ${h * 0.82}px ${FONT.display}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const text = 'NURDAULET';
    const step = w / text.length;
    for (let i = 0; i < text.length; i++) {
      ctx.fillStyle = '#1f4ea0';
      ctx.fillText(text[i], step * (i + 0.5), h * 0.54);
    }
  }));
}

const mats = {};
function mat(key, make) {
  if (!mats[key]) mats[key] = make();
  return mats[key];
}
const archMat = () => mat('arch', () => cel({ map: archTex(), cache: false, grime: 0.03, dirt: 0.25 }));
const minaretMat = () => mat('minaret', () => cel({ map: minaretTex(), cache: false, grime: 0.03, dirt: 0 }));
const glassMat = () => mat('glass', () => flat({ map: mallGlassTex(), cache: false }));

/* ------------------------------------------------------------------ pieces */

/** A white block whose walls are bays of arch panels, `bay` metres wide, with a grey roof slab. */
function archBlock(batch, w, h, d, x, y, z, bay = 3.6) {
  const g = tboxGeo(w, h, d, [1, h]);
  // a whole number of bays on every wall, so no arch is cut at a corner
  const uv = g.attributes.uv;
  const faceW = [d, d, w, w, w, w];
  for (let f = 0; f < 6; f++) {
    const k = Math.max(1, Math.round(faceW[f] / bay)) / faceW[f];
    for (let v = f * 4; v < f * 4 + 4; v++) uv.setX(v, uv.getX(v) * k);
  }
  batch.add(g, { mat: archMat(), color: null, matrix: mtx(x, y, z) });
  batch.box(w + 0.4, 0.35, d + 0.4, WHITE, x, y + h, z);
  batch.box(w - 0.2, 0.05, d - 0.2, ROOF, x, y + h + 0.35, z, { cast: false });
}

/** Onion dome of radius r (base at y), turquoise, with a finial and crescent. */
function dome(batch, x, y, z, r, { stretch = 1.15, seg = 20, finial = true } = {}) {
  const pts = [];
  const n = 10;
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const a = t * Math.PI * 0.5;
    // a little bulge above the base, then the curve to the point
    const rr = r * Math.cos(a) * (1 + 0.08 * Math.sin(t * Math.PI));
    pts.push(new THREE.Vector2(Math.max(rr, 0.001), r * stretch * Math.sin(a)));
  }
  const g = new THREE.LatheGeometry(pts, seg);
  g.translate(x, y, z);
  batch.add(g, { color: TURQ, mat: 'solidClean' });
  if (!finial) return;
  const top = y + r * stretch;
  batch.cyl(0.06 * r + 0.03, r * 0.35, 0xd8b048, x, top - 0.05, z, { seg: 6 });
  const cres = new THREE.TorusGeometry(0.12 * r + 0.12, 0.03 * r + 0.03, 4, 10, Math.PI * 1.4);
  cres.rotateZ(-Math.PI * 0.2);
  cres.translate(x, top + r * 0.35 + 0.12 * r + 0.1, z);
  batch.add(cres, { color: 0xd8b048 });
}

/** A small octagonal pavilion with a dome, for the roof corners. */
function turret(batch, x, y, z, r, h) {
  const g = new THREE.CylinderGeometry(r, r, h, 8, 1, true);
  const uv = g.attributes.uv;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * 8, uv.getY(i));
  g.translate(x, y + h / 2, z);
  batch.add(g, { mat: archMat(), color: null });
  batch.cyl(r + 0.18, 0.25, WHITE, x, y + h, z, { seg: 8 });
  dome(batch, x, y + h + 0.25, z, r * 1.05, { seg: 12 });
}

/* ------------------------------------------------------------------ the mosque */

const HALL = { x: -198, z: -78, w: 30, d: 26, h: 9 };

function mosque(ctx) {
  const { batch, colliders } = ctx;
  const { x, z, w, d, h } = HALL;
  archBlock(batch, w, h, d, x, 0, z);
  colliders.box(x - w / 2, z - d / 2, x + w / 2, z + d / 2, { top: h, tag: 'mosque' });
  // the raised centre carrying the drum
  archBlock(batch, 17, 4.6, 17, x, h + 0.4, z, 4.25);
  const drumY = h + 0.4 + 4.6 + 0.4;
  const drum = new THREE.CylinderGeometry(6.2, 6.2, 3.2, 20, 1, true);
  const uv = drum.attributes.uv;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * 11, uv.getY(i));
  drum.translate(x, drumY + 1.6, z);
  batch.add(drum, { mat: archMat(), color: null });
  batch.cyl(6.6, 0.35, WHITE, x, drumY + 3.2, z, { seg: 20 });
  dome(batch, x, drumY + 3.55, z, 6.4, { seg: 24 });
  // domed turrets at the corners of the hall and of the raised centre
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      turret(batch, x + sx * (w / 2 - 1.4), h + 0.35, z + sz * (d / 2 - 1.4), 1.2, 2.2);
      turret(batch, x + sx * 7.6, h + 5.35, z + sz * 7.6, 0.8, 1.6);
    }
  }
  // the entrance portal on the east, a tall arch in a white frame
  const px = x + w / 2 + 1.2;
  archBlock(batch, 2.4, 12.5, 9, px, 0, z, 9);
  turret(batch, px, 12.85, z - 3.6, 0.7, 1.4);
  turret(batch, px, 12.85, z + 3.6, 0.7, 1.4);
  batch.box(0.3, 3.0, 2.8, 0x6a4a2a, px + 1.2, 0, z);      // the doors
  batch.box(3.4, 0.36, 12, 0xd8d4c8, px + 2.8, 0, z);      // steps
  ctx.ground.flat(px + 1.1, z - 6, px + 4.5, z + 6, 0.36);
  colliders.box(px - 1.2, z - 4.5, px + 1.25, z + 4.5, { top: 12.5, tag: 'mosque' });
  // a lower wing on the north side: offices, the ablution rooms
  archBlock(batch, 22, 6.2, 10, x - 2, 0, z - d / 2 - 5);
  colliders.box(x - 13, z - d / 2 - 10, x + 9, z - d / 2, { top: 6.2, tag: 'mosque' });
}

/** The minaret: plinth, two shafts of beige tile, two white balconies, a lantern and a dome. */
function minaret(ctx, x, z) {
  const { batch, colliders } = ctx;
  archBlock(batch, 5.6, 7, 5.6, x, 0, z, 2.8);
  colliders.box(x - 2.8, z - 2.8, x + 2.8, z + 2.8, { top: 7, tag: 'minaret' });
  const shaft = (r, y0, y1) => {
    const g = new THREE.CylinderGeometry(r, r, y1 - y0, 8, 1, true);
    const uv = g.attributes.uv;
    const reps = Math.round((y1 - y0) / 4.5);
    for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * 8, uv.getY(i) * reps);
    g.translate(x, (y0 + y1) / 2, z);
    batch.add(g, { mat: minaretMat(), color: null });
  };
  const balcony = (r0, r1, y) => {
    batch.cyl(r0, 1.3, WHITE, x, y - 1.3, z, { rTop: r1, seg: 16 });
    batch.cyl(r1, 0.3, WHITE, x, y, z, { seg: 16 });
    batch.cyl(r1, 0.35, TURQ, x, y + 0.3, z, { seg: 16, open: true });
    batch.cyl(r1, 0.7, WHITE, x, y + 0.65, z, { seg: 16, open: true });
    batch.cyl(r1 + 0.08, 0.12, WHITE, x, y + 1.35, z, { seg: 16 });
  };
  batch.cyl(3.0, 0.5, WHITE, x, 7, z, { seg: 8 });
  shaft(2.1, 7.5, 34.5);
  balcony(2.1, 3.0, 34.5);
  shaft(1.8, 35, 46);
  balcony(1.8, 2.6, 46);
  // the lantern: white with arched openings, then the cap
  const lan = new THREE.CylinderGeometry(1.5, 1.5, 3.6, 8, 1, true);
  const uv = lan.attributes.uv;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * 8, uv.getY(i));
  lan.translate(x, 46.5 + 1.8, z);
  batch.add(lan, { mat: archMat(), color: null });
  batch.cyl(1.75, 0.3, WHITE, x, 50.1, z, { seg: 12 });
  dome(batch, x, 50.4, z, 1.6, { stretch: 2.0, seg: 12 });
  // a thin lightning conductor keeps the silhouette to 57 m
  batch.cyl(0.03, 1.2, 0x888888, x, 55.8, z, { seg: 4 });
}

/* ------------------------------------------------------------------ the shopping centre */

const MALL = { x0: -224, x1: -166, z0: -46, z1: -24, h: 9 };

function mall(ctx) {
  const { batch, root, colliders } = ctx;
  const { x0, x1, z0, z1, h } = MALL;
  const cx = (x0 + x1) / 2, cz = (z0 + z1) / 2, W = x1 - x0, D = z1 - z0;
  tbox(batch, KIT.plaster, TILES.plaster, W, h + 1.6, D, WHITE, cx, 0, cz);
  batch.box(W + 0.3, 0.25, D + 0.3, 0xe8e6e0, cx, h + 1.6, cz);
  batch.box(W - 0.8, 0.04, D - 0.8, ROOF, cx, h + 1.85, cz, { cast: false });
  colliders.box(x0, z0, x1, z1, { top: h + 1.6, tag: 'mall' });
  // glass bands on the avenue front and on the road side
  const band = (len, y0, y1, px, pz, ry) => {
    const g = new THREE.PlaneGeometry(len, y1 - y0);
    const uv = g.attributes.uv;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * (len / 3), uv.getY(i) * ((y1 - y0) / 3));
    g.translate(0, (y0 + y1) / 2, 0);
    batch.add(g, { mat: glassMat(), color: null, matrix: mtx(px, 0, pz, ry), cast: false });
  };
  const PX = -195;   // the entrance portal on the avenue front
  band(PX - 5.5 - (x0 + 1.5), 0.6, 4.2, (x0 + 1.5 + PX - 5.5) / 2, z1 + 0.03, 0);
  band(x1 - 1.5 - (PX + 5.5), 0.6, 4.2, (x1 - 1.5 + PX + 5.5) / 2, z1 + 0.03, 0);
  band(W - 3, 5.2, 7.9, cx, z1 + 0.03, 0);
  band(D - 3, 0.6, 4.2, x1 + 0.03, cz, Math.PI / 2);
  band(D - 3, 5.2, 7.9, x1 + 0.03, cz, Math.PI / 2);
  // blue fascia strips between the storeys
  batch.box(W + 0.1, 0.5, 0.2, 0x2a64a8, cx, 4.45, z1 + 0.05);
  batch.box(0.2, 0.5, D + 0.1, 0x2a64a8, x1 + 0.05, 4.45, cz);
  // the portal: a turquoise pointed arch, glass doors and a canopy
  archBlock(batch, 11, 12.6, 2.4, PX, 0, z1 + 0.6, 11);
  colliders.box(PX - 5.5, z1 - 0.6, PX + 5.5, z1 + 1.8, { top: 12.6, tag: 'mall' });
  turret(batch, PX - 4.6, 12.95, z1 + 0.6, 0.7, 1.4);
  turret(batch, PX + 4.6, 12.95, z1 + 0.6, 0.7, 1.4);
  batch.box(3.6, 2.6, 0.1, 0x2a3a44, PX, 0, z1 + 1.82, { mat: 'glass' });
  batch.box(7.5, 0.3, 3.2, 0x2a64a8, PX, 3.4, z1 + 3.3);
  for (const s of [-1, 1]) batch.cyl(0.12, 3.4, 0xdddddd, PX + s * 3.4, 0, z1 + 4.6, { seg: 8 });
  colliders.circle(PX - 3.4, z1 + 4.6, 0.15, { tag: 'post' });
  colliders.circle(PX + 3.4, z1 + 4.6, 0.15, { tag: 'post' });
  // corner domes, as on the real one
  turret(batch, x0 + 1.6, h + 1.85, z1 - 1.6, 1.1, 1.8);
  turret(batch, x1 - 1.6, h + 1.85, z1 - 1.6, 1.1, 1.8);
  // NURDAULET across the parapet, right of the portal and on the road side
  const lm = mat('letters', () => cel({ map: lettersTex(), alphaTest: 0.5, cache: false, grime: 0, dirt: 0, side: THREE.DoubleSide }));
  const front = new THREE.Mesh(new THREE.PlaneGeometry(20, 2.5), lm);
  front.position.set((PX + 5.5 + x1) / 2, h + 0.35, z1 + 0.08);
  root.add(front);
  const side = new THREE.Mesh(new THREE.PlaneGeometry(16, 2.0), lm);
  side.position.set(x1 + 0.08, h + 0.3, cz);
  side.rotation.y = Math.PI / 2;
  root.add(side);
  // plant on the roof
  for (let i = 0; i < 5; i++) batch.box(1.8, 1.1, 1.2, 0xb8bcbe, x0 + 8 + i * 9, h + 1.85, z0 + 4);
}

/* ------------------------------------------------------------------ grounds */

function fenceBars(ctx, x0, z0, x1, z1) {
  const { batch, colliders } = ctx;
  const len = Math.hypot(x1 - x0, z1 - z0);
  const ry = Math.atan2(-(z1 - z0), x1 - x0);
  const n = Math.max(1, Math.round(len / 3));
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    batch.box(0.45, 2.1, 0.45, WHITE, x0 + (x1 - x0) * t, 0, z0 + (z1 - z0) * t, { ry });
    batch.box(0.55, 0.15, 0.55, TURQ, x0 + (x1 - x0) * t, 2.1, z0 + (z1 - z0) * t, { ry });
  }
  const mx = (x0 + x1) / 2, mz = (z0 + z1) / 2;
  batch.box(len, 0.4, 0.3, WHITE, mx, 0, mz, { ry });
  batch.box(len, 0.05, 0.05, 0x2f6a8a, mx, 1.75, mz, { ry });
  // bars as one thin striped panel each side would read the same from a distance: keep real bars
  const bars = Math.floor(len / 0.18);
  for (let i = 0; i < bars; i++) {
    const t = (i + 0.5) / bars;
    batch.box(0.025, 1.4, 0.025, 0x2f6a8a, x0 + (x1 - x0) * t, 0.4, z0 + (z1 - z0) * t, { cast: false });
  }
  colliders.obb(mx, mz, len / 2, 0.2, ry, { top: 2.1, tag: 'fence' });
}

function grounds(ctx) {
  const { batch } = ctx;
  const rng = rngKit(1999);
  // yard slabs, lawns and the forecourt
  batch.add(hQuad(-230, -103.5, -157.5, -51.5, -0.025, TILE.slabs), { mat: SURF.slabs, color: null, cast: false });
  batch.add(hQuad(-230, -24, -157.5, -14.8, -0.025, TILE.slabs), { mat: SURF.slabs, color: null, cast: false });
  batch.add(hQuad(-230, -51.5, -157.5, -46, -0.028, TILE.asphalt), { mat: SURF.asphalt, color: null, cast: false });
  batch.add(hQuad(-166, -46, -157.5, -24, -0.028, TILE.asphalt), { mat: SURF.asphalt, color: null, cast: false });
  batch.add(hQuad(-230, -46, -224, -24, -0.028, TILE.asphalt), { mat: SURF.asphalt, color: null, cast: false });
  for (const [a, b, c, d] of [[-179, -102, -172, -86], [-163, -102, -159, -84], [-179, -70, -159, -56], [-230, -64, -214, -54]]) {
    batch.add(hQuad(a, b, c, d, -0.02, TILE.grass), { mat: SURF.grass, color: null, cast: false });
    const n = Math.floor(((c - a) * (d - b)) / 60);
    for (let i = 0; i < n; i++) {
      const tx = rng.range(a + 1.5, c - 1.5), tz = rng.range(b + 1.5, d - 1.5);
      addTree(batch, rng.pick(['young', 'shrub', 'ball']), tx, tz, 900 + i + a, { scale: 0.8 });
      ctx.colliders.circle(tx, tz, 0.25, { tag: 'tree' });
    }
  }
  // the yard fence with a white gate on the road side
  fenceBars(ctx, -157.6, -103.5, -157.6, -83);
  fenceBars(ctx, -157.6, -73, -157.6, -52);
  fenceBars(ctx, -230, -103.5, -157.6, -103.5);
  fenceBars(ctx, -230, -52, -181, -52);
  fenceBars(ctx, -171, -52, -157.6, -52);
  fenceBars(ctx, -230, -103.5, -230, -52);
  for (const s of [-1, 1]) {
    batch.box(1.0, 4.2, 1.0, WHITE, -157.6, 0, -78 + s * 5.5);
    batch.cyl(0.6, 0.2, WHITE, -157.6, 4.2, -78 + s * 5.5, { seg: 8 });
    batch.cyl(0.35, 0.6, TURQ, -157.6, 4.4, -78 + s * 5.5, { seg: 8, rTop: 0.02 });
    ctx.colliders.box(-158.1, -78 + s * 5.5 - 0.5, -157.1, -78 + s * 5.5 + 0.5, { top: 4.2, tag: 'gate' });
  }
  const arch = new THREE.Shape();
  arch.moveTo(-5, 0); arch.lineTo(5, 0); arch.lineTo(5, 0.9); arch.lineTo(0, 2.1); arch.lineTo(-5, 0.9); arch.closePath();
  const ag = new THREE.ExtrudeGeometry(arch, { depth: 0.5, bevelEnabled: false });
  batch.add(ag, { color: WHITE, matrix: mtx(-157.35, 4.2, -78, -Math.PI / 2) });
  // parked cars along the forecourt and in the side yard
  for (let x = -221; x < -205; x += 2.8) ctx.parking.push({ x, z: -19.4, ry: rng.chance(0.5) ? 0 : Math.PI, chance: 0.75 });
  for (let x = -186; x < -168; x += 2.8) ctx.parking.push({ x, z: -19.4, ry: rng.chance(0.5) ? 0 : Math.PI, chance: 0.75 });
  for (let z = -44; z < -27; z += 2.8) ctx.parking.push({ x: -161.8, z, ry: Math.PI / 2, chance: 0.6 });
}

export function nurdaulet(ctx) {
  mosque(ctx);
  minaret(ctx, -168, -93);
  mall(ctx);
  grounds(ctx);
}

export { dome };
