import * as THREE from 'three';
import { cel } from '../../core/toon.js';
import { SURF, TILE, hQuad, splitRect } from '../../core/surfaces.js';
import { canvasTex, cached, centerText, FONT, weather } from '../../core/textures.js';
import { rngKit } from '../../core/util.js';
import { defineLoop } from '../../core/audio.js';
import { letters } from '../buildings/landmarks.js';
import { Sculpt, STONE, plaqueTex, panel, plaque } from './kit.js';

/* ------------------------------------------------------------------ *
 * Summer at the edge of town, on ул. Маресьева, east of the garages.
 *
 *   the stele      a white concrete slab on the axis of пр. Санкибай
 *                  батыра with a Soviet mosaic (the sun, a pump jack for
 *                  the oil, a ladle of ferrochrome for the Aktobe
 *                  ferroalloy works, wheat) and АҚТӨБЕ on top
 *   the kumys yurt a felt киіз үй with a painted door, a table of jars
 *                  and bottles under a tarp, a hand-painted sign, a mare
 *                  grazing and her foal on the tether line (желі)
 *   the shashlyk   a sheet-metal pavilion, a smoking mangal, white
 *   café           plastic chairs and beer umbrellas
 *
 * Kumys is sold like this by every road out of town in June. You can buy
 * a bowl of kumys or a shashlyk skewer.
 * ------------------------------------------------------------------ */

const Y = -0.02;
const STELE = { x: 110, z: 131.5 };
const YURT = { x: 136, z: 140, r: 3.1 };
const CAFE = { x: 167, z: 139 };

/* ---------------- textures ---------------- */

/** Felt wall: off-white felt with a woven band (басқұр) in red and brown. */
function feltTex() {
  return cached('yurt-felt', () => canvasTex(512, 128, (c, W, H) => {
    const r = rngKit(71);
    c.fillStyle = '#e6ddcb';
    c.fillRect(0, 0, W, H);
    for (let i = 0; i < 900; i++) {
      c.fillStyle = r.pick(['#d8ccb4', '#efe7d6', '#cfc2a8']);
      c.globalAlpha = r.range(0.2, 0.5);
      c.fillRect(r.range(0, W), r.range(0, H), r.range(2, 9), r.range(1, 3));
    }
    c.globalAlpha = 1;
    // the band round the wall, with a running ram's-horn pattern
    const y0 = H * 0.36, bh = H * 0.2;
    c.fillStyle = '#8a2a24';
    c.fillRect(0, y0, W, bh);
    c.strokeStyle = '#e8c872';
    c.lineWidth = 3;
    for (let x = 0; x < W; x += 32) {
      c.beginPath();
      c.moveTo(x + 4, y0 + bh * 0.8);
      c.bezierCurveTo(x + 4, y0 + bh * 0.1, x + 16, y0 + bh * 0.1, x + 16, y0 + bh * 0.5);
      c.bezierCurveTo(x + 16, y0 + bh * 0.1, x + 28, y0 + bh * 0.1, x + 28, y0 + bh * 0.8);
      c.stroke();
    }
    c.fillStyle = '#3a2a22';
    c.fillRect(0, y0 - 3, W, 3);
    c.fillRect(0, y0 + bh, W, 3);
    // ropes lashing the felt at the top and foot
    c.fillStyle = '#9a8a6a';
    c.fillRect(0, H * 0.06, W, 4);
    c.fillRect(0, H * 0.88, W, 4);
    weather(c, W, H, 71, 0.8);
  }));
}

/** Roof felt: panels of grey-white felt with ropes running up to the crown. */
function roofTex() {
  return cached('yurt-roof', () => canvasTex(512, 128, (c, W, H) => {
    const r = rngKit(72);
    c.fillStyle = '#ddd4c2';
    c.fillRect(0, 0, W, H);
    for (let i = 0; i < 700; i++) {
      c.fillStyle = r.pick(['#cbbfa8', '#e9e1d0', '#bfb29a']);
      c.globalAlpha = r.range(0.2, 0.5);
      c.fillRect(r.range(0, W), r.range(0, H), r.range(3, 12), r.range(1, 3));
    }
    c.globalAlpha = 1;
    c.fillStyle = '#8a7a5a';
    for (let x = 0; x < W; x += W / 8) c.fillRect(x, 0, 3, H);
    c.fillStyle = '#8a2a24';
    c.fillRect(0, H * 0.9, W, H * 0.1);
    weather(c, W, H, 72, 1);
  }));
}

/** The carved and painted double door of a yurt. */
function doorTex() {
  return cached('yurt-door', () => canvasTex(128, 192, (c, W, H) => {
    c.fillStyle = '#b8481e';
    c.fillRect(0, 0, W, H);
    c.fillStyle = '#6a2a14';
    c.fillRect(W / 2 - 2, 0, 4, H);
    c.strokeStyle = '#f0c850';
    c.lineWidth = 3;
    for (const x0 of [6, W / 2 + 4]) {
      const w = W / 2 - 10;
      c.strokeRect(x0, 8, w, H - 16);
      for (let k = 0; k < 3; k++) {
        const cy = 36 + k * 58, cx = x0 + w / 2;
        c.beginPath();
        c.moveTo(cx, cy + 14);
        c.bezierCurveTo(cx - 20, cy + 10, cx - 18, cy - 16, cx - 4, cy - 6);
        c.moveTo(cx, cy + 14);
        c.bezierCurveTo(cx + 20, cy + 10, cx + 18, cy - 16, cx + 4, cy - 6);
        c.stroke();
      }
    }
    weather(c, W, H, 73, 1);
  }));
}

function kumysSignTex() {
  return cached('kumys-sign', () => canvasTex(256, 160, (c, W, H) => {
    c.fillStyle = '#f2eee2';
    c.fillRect(0, 0, W, H);
    centerText(c, 'ҚЫМЫЗ', W / 2, H * 0.24, W * 0.9, H * 0.3, '#c0241e', { family: FONT.sans, weight: '800' });
    centerText(c, 'КУМЫС', W / 2, H * 0.52, W * 0.9, H * 0.24, '#c0241e', { family: FONT.sans, weight: '800' });
    centerText(c, 'ШҰБАТ бар', W / 2, H * 0.8, W * 0.8, H * 0.18, '#1f3e7c', { family: FONT.sans, weight: '700' });
    weather(c, W, H, 74, 1.2);
  }));
}

function cafeSignTex() {
  return cached('cafe-sign', () => canvasTex(512, 96, (c, W, H) => {
    c.fillStyle = '#f2c230';
    c.fillRect(0, 0, W, H);
    centerText(c, 'КАФЕ «ЖАЙЛАУ» · ШАШЛЫК', W / 2, H * 0.5, W * 0.94, H * 0.66, '#b0201c', { family: FONT.narrow, weight: '800' });
    weather(c, W, H, 75, 0.8);
  }));
}

/**
 * Umbrella canopy: eight panels alternating the brand colour and white,
 * the brand name on the coloured ones. The colours are period-plausible,
 * not checked against the real brands' 2007 artwork.
 */
function umbrellaTex(brand) {
  return cached(`umbrella|${brand}`, () => canvasTex(512, 64, (c, W, H) => {
    const col = brand === 'Derbes' ? '#1d4f9a' : '#2f7a3a';
    for (let i = 0; i < 8; i++) {
      c.fillStyle = i % 2 ? '#f2efe6' : col;
      c.fillRect((i * W) / 8, 0, W / 8, H);
      if (i % 2 === 0) centerText(c, brand, ((i + 0.5) * W) / 8, H * 0.72, W / 8 - 6, H * 0.34, '#ffffff', { family: FONT.sans, weight: '800' });
    }
    weather(c, W, H, brand.length, 0.6);
  }));
}

/**
 * The mosaic: drawn as a picture first, then re-laid in small glass
 * tesserae with grout between them and a little colour scatter per tile.
 */
function mosaicTex() {
  return cached('stele-mosaic', () => canvasTex(512, 640, (c, W, H) => {
    const src = document.createElement('canvas');
    src.width = W; src.height = H;
    const p = src.getContext('2d');
    // sky
    const sky = p.createLinearGradient(0, 0, 0, H * 0.7);
    sky.addColorStop(0, '#2c62a8');
    sky.addColorStop(1, '#7fb0dc');
    p.fillStyle = sky;
    p.fillRect(0, 0, W, H);
    // the sun and its rays
    p.fillStyle = '#f2c230';
    p.beginPath(); p.arc(W * 0.5, H * 0.2, 62, 0, Math.PI * 2); p.fill();
    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * Math.PI * 2;
      p.beginPath();
      p.moveTo(W * 0.5 + Math.cos(a) * 74, H * 0.2 + Math.sin(a) * 74);
      p.lineTo(W * 0.5 + Math.cos(a + 0.1) * 118, H * 0.2 + Math.sin(a + 0.1) * 118);
      p.lineTo(W * 0.5 + Math.cos(a - 0.1) * 118, H * 0.2 + Math.sin(a - 0.1) * 118);
      p.fill();
    }
    // steppe
    p.fillStyle = '#c9a45a';
    p.fillRect(0, H * 0.62, W, H * 0.38);
    p.fillStyle = '#a8843e';
    p.fillRect(0, H * 0.62, W, 10);
    // the pump jack, left
    p.fillStyle = '#1f2a44';
    p.fillRect(40, H * 0.6, 150, 12);
    p.beginPath(); p.moveTo(80, H * 0.6); p.lineTo(115, H * 0.42); p.lineTo(150, H * 0.6); p.fill();
    p.save(); p.translate(115, H * 0.42); p.rotate(-0.18);
    p.fillRect(-90, -9, 170, 18);
    p.beginPath(); p.arc(-92, 0, 26, Math.PI * 0.5, Math.PI * 1.5); p.fill();
    p.restore();
    p.fillRect(40, H * 0.47, 6, H * 0.14);
    // the ladle pouring ferrochrome, right
    p.fillStyle = '#3a3634';
    p.save(); p.translate(W - 120, H * 0.44); p.rotate(0.5);
    p.beginPath(); p.moveTo(-50, -40); p.lineTo(50, -40); p.lineTo(38, 40); p.lineTo(-38, 40); p.fill();
    p.restore();
    const melt = p.createLinearGradient(0, H * 0.42, 0, H * 0.62);
    melt.addColorStop(0, '#fff2a0');
    melt.addColorStop(1, '#f06a1e');
    p.fillStyle = melt;
    p.beginPath();
    p.moveTo(W - 168, H * 0.43); p.quadraticCurveTo(W - 190, H * 0.5, W - 180, H * 0.62);
    p.lineTo(W - 162, H * 0.62); p.quadraticCurveTo(W - 170, H * 0.5, W - 152, H * 0.45); p.fill();
    // the worker at the centre: helmet, face, shoulders, a raised fist
    p.fillStyle = '#b8432e';
    p.beginPath(); p.moveTo(W * 0.3, H * 0.66); p.quadraticCurveTo(W * 0.5, H * 0.46, W * 0.7, H * 0.66); p.fill();
    p.fillStyle = '#e0a878';
    p.beginPath(); p.ellipse(W * 0.5, H * 0.43, 34, 42, 0, 0, Math.PI * 2); p.fill();
    p.fillStyle = '#e8e2d0';
    p.beginPath(); p.ellipse(W * 0.5, H * 0.39, 42, 26, 0, Math.PI, Math.PI * 2); p.fill();
    p.fillRect(W * 0.5 - 50, H * 0.39 - 2, 100, 8);
    p.fillStyle = '#e0a878';
    p.save(); p.translate(W * 0.64, H * 0.5); p.rotate(-0.5);
    p.fillStyle = '#b8432e'; p.fillRect(-12, -70, 24, 80);
    p.fillStyle = '#e0a878'; p.beginPath(); p.arc(0, -78, 17, 0, Math.PI * 2); p.fill();
    p.restore();
    // wheat ears round the foot
    p.strokeStyle = '#f2c230';
    p.fillStyle = '#f2c230';
    p.lineWidth = 6;
    for (const s of [-1, 1]) {
      for (let k = 0; k < 6; k++) {
        const x = W / 2 + s * (60 + k * 30), y = H * 0.93 - k * 22;
        p.beginPath(); p.moveTo(W / 2, H * 0.99); p.quadraticCurveTo(x - s * 10, y + 30, x, y); p.stroke();
        p.beginPath(); p.ellipse(x, y - 10, 8, 18, s * 0.5, 0, Math.PI * 2); p.fill();
      }
    }
    // ornament border: ram's horns in gold on red
    p.fillStyle = '#8a2a24';
    p.fillRect(0, 0, W, 28); p.fillRect(0, H - 28, W, 28);
    p.fillRect(0, 0, 28, H); p.fillRect(W - 28, 0, 28, H);

    // re-lay the picture in tesserae
    const img = p.getImageData(0, 0, W, H).data;
    const r = rngKit(76);
    const T = 8;
    c.fillStyle = '#6f6a60';
    c.fillRect(0, 0, W, H);
    for (let y = 0; y < H; y += T) {
      for (let x = 0; x < W; x += T) {
        const i = ((y + T / 2) * W + (x + T / 2)) * 4;
        const k = r.range(-18, 18);
        const rr = Math.max(0, Math.min(255, img[i] + k)), gg = Math.max(0, Math.min(255, img[i + 1] + k)), bb = Math.max(0, Math.min(255, img[i + 2] + k));
        c.fillStyle = `rgb(${rr | 0},${gg | 0},${bb | 0})`;
        c.fillRect(x + 1 + r.range(-0.6, 0.6), y + 1 + r.range(-0.6, 0.6), T - 1.8, T - 1.8);
      }
    }
    // the gold of the border ornament over the tiles
    c.strokeStyle = '#e8c060';
    c.lineWidth = 5;
    for (let x = 14; x < W - 14; x += 40) {
      for (const y of [14, H - 14]) {
        c.beginPath(); c.arc(x + 10, y, 7, Math.PI, Math.PI * 2.4); c.stroke();
        c.beginPath(); c.arc(x + 30, y, 7, Math.PI * 0.6, Math.PI * 2); c.stroke();
      }
    }
    weather(c, W, H, 76, 0.6);
  }));
}

function smokeTex() {
  return cached('smoke-puff', () => canvasTex(64, 64, (c, W, H) => {
    const g = c.createRadialGradient(W / 2, H / 2, 0, W / 2, H / 2, W / 2);
    g.addColorStop(0, 'rgba(255,255,255,0.9)');
    g.addColorStop(0.5, 'rgba(255,255,255,0.4)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    c.fillStyle = g;
    c.fillRect(0, 0, W, H);
  }));
}

/* ---------------- sound ---------------- */

// fat dripping on coals: soft crackle over a low hiss
defineLoop('mangal', (ac, out) => {
  const len = ac.sampleRate * 3;
  const buf = ac.createBuffer(1, len, ac.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * 0.08;
  for (let k = 0; k < 90; k++) {
    const at = Math.floor(Math.random() * (len - 400));
    const amp = 0.4 + Math.random() * 0.6;
    for (let j = 0; j < 300; j++) d[at + j] += (Math.random() * 2 - 1) * amp * Math.exp(-j / 40);
  }
  const n = ac.createBufferSource();
  n.buffer = buf;
  n.loop = true;
  const hp = ac.createBiquadFilter();
  hp.type = 'highpass';
  hp.frequency.value = 900;
  const g = ac.createGain();
  g.gain.value = 0.0001;
  n.connect(hp).connect(g).connect(out);
  n.start();
  return {
    set({ volume = 1 }) { g.gain.setTargetAtTime(Math.max(0.0001, volume * 0.35), ac.currentTime, 0.2); },
    stop() { g.gain.setTargetAtTime(0.0001, ac.currentTime, 0.2); setTimeout(() => n.stop(), 600); },
  };
});

/* ---------------- the stele ---------------- */

function stele(ctx) {
  const { batch: b, colliders, root } = ctx;
  const { x, z } = STELE;
  b.box(7.4, 0.25, 3.6, STONE.concrete, x, Y, z);
  b.box(6.6, 0.25, 2.8, STONE.slab, x, 0.23, z);
  b.box(5.6, 8.2, 0.9, 0xe8e4da, x, 0.48, z);
  b.box(5.9, 0.3, 1.1, 0xd4d0c6, x, 8.68, z);
  colliders.box(x - 3.7, z - 1.8, x + 3.7, z + 1.8, { top: 0.48, tag: 'stele' });
  colliders.box(x - 2.8, z - 0.45, x + 2.8, z + 0.45, { tag: 'stele' });
  ctx.ground.flat(x - 3.7, z - 1.8, x + 3.7, z + 1.8, 0.23, 'stele');
  ctx.ground.flat(x - 3.3, z - 1.4, x + 3.3, z + 1.4, 0.48, 'stele');
  // the mosaic on the face toward the street, and the name above it
  const m = panel(root, mosaicTex(), 4.8, 6.0, x, 1.6, z - 0.46, 0, { bands: 3 });
  m.castShadow = false;
  letters(root, 'АҚТӨБЕ', x, 9.0, z, 0, { width: 6.2, height: 1.3, color: '#c9a44a', back: '#6f5a2a' });
  panel(root, plaqueTex('stele', ['АҚТӨБЕ · АКТЮБИНСК', '1869'], { bg: '#e8e4da', fg: '#8a2a24', h: 160 }), 3.2, 0.7, x, 0.75, z - 0.46, 0);
  // the back is plain, with the year the fort was founded
  panel(root, plaqueTex('stele-back', ['1869'], { bg: '#e8e4da', fg: '#8a2a24', h: 128, w: 256 }), 1.6, 0.8, x, 5.2, z + 0.46, Math.PI);
  plaque(ctx, {
    x, z: z - 2.6, y: 1.6, w: 5, label: 'Look at the mosaic',
    title: 'Стела «Ақтөбе»',
    body: 'Смальтовая мозаика: солнце, нефтяная качалка, ковш с феррохромом и пшеница. Актюбинск основан в 1869 году как укрепление Ак-Тюбе.',
  });
}

/* ---------------- the kumys yurt ---------------- */

function yurt(ctx) {
  const { batch: b, colliders, root } = ctx;
  const { x, z, r: R } = YURT;
  const WALL = 1.65, CROWN = 3.35;
  // wall and roof carry their own felt textures
  const wall = new THREE.CylinderGeometry(R, R, WALL, 24, 1, true);
  wall.translate(x, WALL / 2, z);
  b.add(wall, { mat: cel({ map: feltTex(), grime: 0.04, dirt: 0.5, dirtH: 0.5 }), color: null });
  const roofLow = new THREE.CylinderGeometry(R * 0.62, R + 0.08, 1.05, 24, 1, true);
  roofLow.translate(x, WALL + 0.5, z);
  const roofHigh = new THREE.CylinderGeometry(0.72, R * 0.62, 0.62, 24, 1, true);
  roofHigh.translate(x, WALL + 1.05 + 0.29, z);
  const roofMat = cel({ map: roofTex(), grime: 0.05, dirt: 0 });
  b.add(roofLow, { mat: roofMat, color: null });
  b.add(roofHigh, { mat: roofMat, color: null });
  // the shanyrak: a wooden crown ring with its crossed bars, the smoke
  // flap folded half back
  const ring = new THREE.TorusGeometry(0.72, 0.07, 6, 20);
  ring.rotateX(Math.PI / 2);
  ring.translate(x, CROWN - 0.02, z);
  b.add(ring, { color: 0x8a5a2e });
  for (const a of [0, Math.PI / 2]) {
    for (const o of [-0.2, 0.2]) {
      const bx = Math.cos(a + Math.PI / 2) * o, bz = Math.sin(a + Math.PI / 2) * o;
      b.tube(x + bx - Math.cos(a) * 0.72, CROWN, z + bz - Math.sin(a) * 0.72, x + bx + Math.cos(a) * 0.72, CROWN + 0.18, z + bz + Math.sin(a) * 0.72, 0.03, 0x8a5a2e, { seg: 5 });
    }
  }
  b.box(1.3, 0.05, 0.9, 0xcfc4ae, x, CROWN + 0.02, z + 0.35, { rx: 0.25 });
  // dark disc inside the crown, so the open half does not show sky
  b.cyl(0.66, 0.02, 0x2a211a, x, CROWN - 0.1, z, { seg: 16 });
  // the door on the road side, in its frame, the felt flap rolled above
  const dz = z - R - 0.02;
  b.box(1.3, 1.6, 0.14, 0x6a3a1c, x, 0, dz + 0.06);
  panel(root, doorTex(), 1.0, 1.42, x, 0.04, dz - 0.02, 0);
  b.cyl(0.13, 1.4, 0x9a8a6a, x - 0.7, 1.62, dz - 0.05, { rz: -Math.PI / 2, seg: 8 });
  b.box(1.5, 0.1, 0.3, 0x5a3a24, x, 0, dz - 0.15);
  colliders.circle(x, z, R + 0.1, { top: CROWN, tag: 'yurt' });

  // the table under a blue tarp by the road
  const tx = x - 1, tz = z - 7;
  for (const [px, pz] of [[-1.6, -1.2], [1.6, -1.2], [-1.6, 1.2], [1.6, 1.2]]) b.cyl(0.03, 2.3, 0x7a7c7e, tx + px, 0, tz + pz, { seg: 5 });
  b.box(3.5, 0.03, 2.8, 0x2f5fa8, tx, 2.3, tz, { rx: 0.08, closed: true });
  b.box(1.8, 0.04, 0.8, 0xece6d6, tx, 0.74, tz);
  for (const [px, pz] of [[-0.8, -0.35], [0.8, -0.35], [-0.8, 0.35], [0.8, 0.35]]) b.box(0.04, 0.74, 0.04, 0x8a8a88, tx + px, 0, tz + pz);
  colliders.box(tx - 0.95, tz - 0.45, tx + 0.95, tz + 0.45, { top: 0.8, tag: 'table' });
  // three-litre jars of kumys, plastic bottles, a stack of bowls
  const rng = rngKit(77);
  for (let i = 0; i < 4; i++) b.cyl(0.09, 0.3, 0xeeeae0, tx - 0.7 + i * 0.22, 0.78, tz - 0.15, { seg: 10 });
  for (let i = 0; i < 4; i++) b.cyl(0.095, 0.03, 0x3a6a3a, tx - 0.7 + i * 0.22, 1.08, tz - 0.15, { seg: 10 });
  for (let i = 0; i < 6; i++) {
    const bx = tx + 0.2 + (i % 3) * 0.16, bz = tz + 0.05 + Math.floor(i / 3) * 0.18;
    b.cyl(0.045, 0.28, 0xf2f0ea, bx, 0.78, bz, { seg: 8 });
    b.cyl(0.02, 0.04, rng.pick([0x2f5fa8, 0xc0241e]), bx, 1.06, bz, { seg: 6 });
  }
  for (let i = 0; i < 5; i++) b.cyl(0.08, 0.04, 0xf4f0e6, tx + 0.72, 0.78 + i * 0.035, tz + 0.2, { seg: 10, rTop: 0.1 });
  // the seller's stool and a milk churn
  b.box(0.35, 0.45, 0.35, 0x5a4a3a, tx + 0.4, 0, tz + 1.0);
  b.cyl(0.2, 0.6, 0xb4b8ba, tx - 1.3, 0, tz + 0.8, { seg: 12, rTop: 0.14 });

  // the sign on a stake at the road
  b.box(0.06, 1.8, 0.06, 0x6a5a44, x - 5, 0, z - 13.2);
  panel(root, kumysSignTex(), 1.3, 0.8, x - 5, 1.0, z - 13.25, 0, { side: THREE.DoubleSide });
  colliders.circle(x - 5, z - 13.2, 0.1, { tag: 'post' });

  ctx.interact({
    x: tx, y: 1.0, z: tz - 0.6, w: 2.0, h: 1.0, d: 0.6,
    label: 'Buy a bowl of kumys · 100 ₸',
    action: (game) => {
      if (!game.pay(100, 'kumys')) return;
      game.audio.play('pour', { pos: { x: tx, y: 1, z: tz }, volume: 0.8 });
      game.hud.flash('Қымыз · sour, fizzy and cold from the churn', 2800);
    },
  });

  // a қазан on its iron tripod over a dead fire, round the side
  const kx = x - 4.2, kz = z + 3.2;
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2;
    b.tube(kx + Math.cos(a) * 0.55, 0, kz + Math.sin(a) * 0.55, kx, 1.0, kz, 0.02, 0x2a2622, { seg: 4 });
  }
  const pot = new THREE.SphereGeometry(0.34, 12, 6, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2);
  pot.translate(kx, 0.72, kz);
  b.add(pot, { color: 0x24211f });
  b.cyl(0.36, 0.04, 0x1c1a18, kx, 0.7, kz, { seg: 12 });
  b.cyl(0.5, 0.06, 0x3a342e, kx, -0.02, kz, { seg: 10 });
  colliders.circle(kx, kz, 0.6, { top: 1.0, tag: 'kazan' });

  // the mare grazing, and her foal tied on the желі line
  horse(b, x + 8, z + 2, 2.3, 1, 0x7a4a2a, 0x3a2418, true);
  horse(b, x + 9.5, z + 7.5, 0.4, 0.66, 0x8a5a36, 0x4a2e1c, false);
  colliders.circle(x + 8, z + 2, 1.3, { top: 1.8, tag: 'horse' });
  colliders.circle(x + 9.5, z + 7.5, 0.8, { top: 1.2, tag: 'horse' });
  const line = [[x + 5, z + 9], [x + 14, z + 9]];
  for (const [px, pz] of line) b.cyl(0.05, 0.9, 0x6a5a44, px, 0, pz, { seg: 5 });
  b.tube(line[0][0], 0.35, line[0][1], line[1][0], 0.35, line[1][1], 0.012, 0x3a3228, { seg: 3, cast: false });
  b.tube(x + 9.9, 0.35, z + 9, x + 9.6, 0.95, z + 7.1, 0.01, 0x3a3228, { seg: 3, cast: false });
  // an old UAZ belongs to the family that keeps the yurt
  ctx.parking.push({ x: x - 7.5, z: z + 1, ry: 0.35, kind: 'uaz469', chance: 1 });
}

/**
 * A horse at life size, front toward -z before `ry`. `graze` drops the
 * head to the grass. Same construction as the monument horse, plainer.
 */
function horse(b, x, z, ry, scale, coat, mane, graze) {
  const s = new Sculpt(b, x, 0, z, ry, scale);
  s.ball([0, 1.3, 0], [0.4, 0.44, 0.9], coat);
  s.ball([0, 1.38, -0.66], [0.38, 0.46, 0.44], coat);
  s.ball([0, 1.42, 0.68], [0.42, 0.44, 0.46], coat);
  const poll = graze ? [0, 0.72, -1.55] : [0, 2.05, -1.2];
  const muzzle = graze ? [0, 0.22, -1.62] : [0, 1.8, -1.6];
  s.limb([0, 1.5, -0.8], poll, 0.3, 0.18, coat);
  s.ball(poll, 0.19, coat);
  s.limb(poll, muzzle, 0.17, 0.1, coat);
  s.ball(muzzle, [0.11, 0.1, 0.13], coat);
  s.box(0.07, 0.12, 0.7, [0, (1.5 + poll[1]) / 2 + 0.2, (-0.8 + poll[2]) / 2], mane, [graze ? -0.5 : 0.7, 0, 0]);
  for (const [a, k, h] of [
    [[-0.22, 1.1, -0.7], [-0.23, 0.6, -0.72], [-0.22, 0.08, -0.74]],
    [[0.22, 1.1, -0.7], [0.23, 0.6, -0.66], [0.22, 0.08, -0.6]],
    [[-0.23, 1.2, 0.72], [-0.25, 0.62, 0.88], [-0.23, 0.08, 0.78]],
    [[0.23, 1.2, 0.72], [0.25, 0.62, 0.9], [0.23, 0.08, 0.84]],
  ]) {
    s.limb(a, k, 0.14, 0.08, coat);
    s.limb(k, h, 0.065, 0.055, coat);
    s.limb([h[0], 0, h[2]], [h[0], 0.1, h[2]], 0.08, 0.065, 0x2a221c, 7);
  }
  s.limb([0, 1.55, 1.1], [0, 0.75, 1.32], 0.09, 0.05, mane);
}

/* ---------------- the shashlyk café ---------------- */

function cafe(ctx) {
  const { batch: b, colliders, root } = ctx;
  const { x, z } = CAFE;
  // the pavilion: sheet-metal walls painted pale green, a pitched roof
  const px = x + 4, pz = z + 6, W = 7, D = 4.2, H = 2.7;
  b.box(W, H, D, 0x9ec4a8, px, 0, pz);
  // corrugated roof in two slopes meeting at the ridge, gables filled
  b.box(W + 0.6, 0.1, D / 2 + 0.5, 0x8a8e90, px, H + 0.3, pz - D / 4 - 0.05, { rx: -0.3, closed: true });
  b.box(W + 0.6, 0.1, D / 2 + 0.5, 0x8a8e90, px, H + 0.3, pz + D / 4 + 0.05, { rx: 0.3, closed: true });
  const gable = new THREE.Shape();
  gable.moveTo(-D / 2, 0); gable.lineTo(D / 2, 0); gable.lineTo(0, 0.68); gable.closePath();
  for (const s of [-1, 1]) {
    const g = new THREE.ShapeGeometry(gable);
    g.rotateY(s * Math.PI / 2);
    g.translate(px + s * (W / 2 + 0.01), H, pz);
    b.add(g, { color: 0x9ec4a8 });
  }
  // the serving hatch and its counter
  b.box(2.6, 1.0, 0.04, 0x2a3440, px - 1, 1.0, pz - D / 2 - 0.01, { mat: 'glass' });
  b.box(2.8, 0.06, 0.45, 0xb8b4aa, px - 1, 0.95, pz - D / 2 - 0.2);
  b.box(0.9, 2.0, 0.04, 0x6a7478, px + 2.3, 0, pz - D / 2 - 0.01);
  panel(root, cafeSignTex(), 5.6, 0.62, px, H + 0.02, pz - D / 2 - 0.08, 0);
  colliders.box(px - W / 2, pz - D / 2, px + W / 2, pz + D / 2, { top: H + 0.8, tag: 'cafe' });
  // a strip of trodden asphalt under the terrace
  for (const [a, c, d, e] of splitRect(x - 9, z - 11, x + 9, z + 4, 40)) b.add(hQuad(a, c, d, e, Y, TILE.asphalt), { mat: SURF.asphalt, color: null, cast: false });

  // the mangal: a long steel box on legs, skewers across it, glowing coals
  const mx = px - 5.2, mz = pz - 1.2;
  for (const [ox, oz] of [[-0.95, -0.15], [0.95, -0.15], [-0.95, 0.15], [0.95, 0.15]]) b.box(0.04, 0.72, 0.04, 0x2a2a2a, mx + ox, 0, mz + oz);
  b.box(2.1, 0.28, 0.4, 0x3a3634, mx, 0.72, mz);
  b.box(2.0, 0.02, 0.32, 0xff7a2a, mx, 0.9, mz, { mat: 'glow', cast: false });
  const rng = rngKit(78);
  for (let i = 0; i < 9; i++) {
    const sx = mx - 0.85 + i * 0.21;
    b.tube(sx, 1.02, mz - 0.32, sx, 1.02, mz + 0.34, 0.006, 0xb8bcbe, { seg: 3, cast: false });
    for (let k = 0; k < 5; k++) b.box(0.07, 0.06, 0.07, rng.pick([0x6a3a1e, 0x7a4424, 0x5a2e18]), sx, 0.99, mz - 0.2 + k * 0.1, { ry: rng.range(0, 1), cast: false });
  }
  colliders.box(mx - 1.1, mz - 0.25, mx + 1.1, mz + 0.25, { top: 1.0, tag: 'mangal' });

  // four white plastic tables, each with its chairs and a beer umbrella
  const tables = [[x - 5, z - 6], [x - 0.5, z - 7.5], [x + 4, z - 6], [x - 3, z - 1.5]];
  tables.forEach(([tx, tz], i) => {
    plasticTable(b, tx, tz, rng);
    umbrella(b, tx, tz, i % 2 ? 'Derbes' : 'Шымкентское');
    colliders.circle(tx, tz, 0.55, { top: 0.72, tag: 'table' });
  });

  ctx.interact({
    x: px - 1, y: 1.3, z: pz - D / 2 - 0.3, w: 2.8, h: 1.0, d: 0.5,
    label: 'Buy a shashlyk skewer · 250 ₸',
    action: (game) => {
      if (!game.pay(250, 'shashlyk')) return;
      game.audio.play('kioskWindow', { pos: { x: px, y: 1.2, z: pz }, volume: 0.6 });
      game.hud.flash('Шашлык on a skewer, raw onion, a slice of лепёшка', 2800);
    },
  });

  return { mangal: { x: mx, y: 1.1, z: mz } };
}

function plasticTable(b, x, z, rng) {
  const WHITE = 0xeeece4;
  b.box(0.8, 0.04, 0.8, WHITE, x, 0.7, z);
  for (const [ox, oz] of [[-0.34, -0.34], [0.34, -0.34], [-0.34, 0.34], [0.34, 0.34]]) b.box(0.05, 0.7, 0.05, WHITE, x + ox, 0, z + oz);
  for (let k = 0; k < 4; k++) {
    const a = (k * Math.PI) / 2 + rng.range(-0.25, 0.25);
    const d = 0.72 + rng.range(-0.05, 0.12);
    monobloc(b, x + Math.sin(a) * d, z + Math.cos(a) * d, a + Math.PI);
  }
}

/** The white monobloc chair, seen outside every café of the 2000s. */
function monobloc(b, x, z, facing) {
  const WHITE = 0xf0eee6;
  const fx = -Math.sin(facing), fz = -Math.cos(facing);
  b.box(0.44, 0.04, 0.42, WHITE, x, 0.43, z, { ry: facing });
  b.box(0.44, 0.42, 0.03, WHITE, x - fx * 0.22, 0.47, z - fz * 0.22, { ry: facing, rx: 0.12 });
  for (const s of [-1, 1]) {
    for (const t of [-1, 1]) {
      const ox = Math.cos(facing) * s * 0.19 - fx * t * 0.18, oz = -Math.sin(facing) * s * 0.19 - fz * t * 0.18;
      b.box(0.035, 0.43, 0.035, WHITE, x + ox, 0, z + oz, { ry: facing });
    }
    const ax = Math.cos(facing) * s * 0.22, az = -Math.sin(facing) * s * 0.22;
    b.box(0.03, 0.03, 0.4, WHITE, x + ax, 0.64, z + az, { ry: facing });
  }
}

function umbrella(b, x, z, brand) {
  b.cyl(0.025, 2.3, 0xd8d8d4, x, 0, z, { seg: 6 });
  const g = new THREE.ConeGeometry(1.25, 0.5, 8, 1, true);
  g.translate(x, 2.3, z);
  b.add(g, { mat: cel({ map: umbrellaTex(brand), side: THREE.DoubleSide, grime: 0.03, dirt: 0 }), color: null });
  // the valance round the rim
  const v = new THREE.CylinderGeometry(1.25, 1.25, 0.16, 8, 1, true);
  v.translate(x, 1.97, z);
  b.add(v, { mat: cel({ map: umbrellaTex(brand), side: THREE.DoubleSide, grime: 0.03, dirt: 0 }), color: null });
}

/* ---------------- smoke from the mangal ---------------- */

/**
 * Soft puffs rising from the coals and drifting east on the evening air.
 * Points with a per-puff size and fade, so they need no sorting worth
 * mentioning and cost one draw call.
 */
function smoke(ctx, at) {
  const N = 28;
  const pos = new Float32Array(N * 3), size = new Float32Array(N), alpha = new Float32Array(N);
  const age = new Float32Array(N), life = 5;
  const rng = rngKit(79);
  for (let i = 0; i < N; i++) age[i] = (i / N) * life;
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('size', new THREE.BufferAttribute(size, 1));
  geo.setAttribute('alpha', new THREE.BufferAttribute(alpha, 1));
  const mat = new THREE.ShaderMaterial({
    uniforms: { map: { value: smokeTex() }, halfH: { value: 450 }, color: { value: new THREE.Color(0xaaa69f) } },
    vertexShader: `
      attribute float size; attribute float alpha; varying float vA; uniform float halfH;
      void main() {
        vA = alpha;
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        gl_PointSize = size * projectionMatrix[1][1] * halfH / -mv.z;
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: `
      uniform sampler2D map; uniform vec3 color; varying float vA;
      void main() {
        vec4 t = texture2D(map, gl_PointCoord);
        gl_FragColor = vec4(color, t.a * vA);
      }`,
    transparent: true, depthWrite: false,
  });
  const pts = new THREE.Points(geo, mat);
  pts.frustumCulled = false;
  pts.renderOrder = 4;
  ctx.root.add(pts);
  const seed = Array.from({ length: N }, () => [rng.range(-0.9, 0.9), rng.range(-0.15, 0.15), rng.range(0.7, 1.2)]);
  ctx.update((dt, game) => {
    const cam = game.camera.position;
    const near = (cam.x - at.x) ** 2 + (cam.z - at.z) ** 2 < 160 * 160;
    pts.visible = near;
    if (!near) return;
    mat.uniforms.halfH.value = window.innerHeight / 2;
    for (let i = 0; i < N; i++) {
      age[i] += dt;
      if (age[i] > life) age[i] -= life;
      const t = age[i] / life, [ox, oz, sp] = seed[i];
      pos[i * 3] = at.x + ox * 0.6 + t * 1.4 * sp;
      pos[i * 3 + 1] = at.y + t * 4.2 * sp;
      pos[i * 3 + 2] = at.z + oz + Math.sin(t * 5 + i) * 0.25;
      size[i] = 0.45 + t * 2.4;
      alpha[i] = Math.min(0.6, Math.min(1, t * 5) * (1 - t) * 1.1);
    }
    geo.attributes.position.needsUpdate = true;
    geo.attributes.size.needsUpdate = true;
    geo.attributes.alpha.needsUpdate = true;
  });
  let sizzle = null;
  ctx.update((dt, game) => {
    if (!sizzle && game.audio.ready) sizzle = game.audio.loop('mangal', { pos: { x: at.x, y: 1, z: at.z }, volume: 1 });
  });
}

/* ---------------- ground ---------------- */

function grounds(ctx, z0) {
  const b = ctx.batch;
  // trodden sandy ground along the road, patchy grass behind it
  for (const [a, c, d, e] of splitRect(120, z0, 190, 149, 40)) b.add(hQuad(a, c, d, e, Y - 0.006, TILE.sand), { mat: SURF.sand, color: null, cast: false });
  for (const [a, c, d, e] of splitRect(128, 143, 158, 156, 40)) b.add(hQuad(a, c, d, e, Y - 0.004, TILE.grass), { mat: SURF.grass, color: null, cast: false });
}

export function buildRoadside(ctx, z0) {
  grounds(ctx, z0);
  stele(ctx);
  yurt(ctx);
  const c = cafe(ctx);
  smoke(ctx, c.mangal);
}
