import * as THREE from 'three';
import { cel, flat } from '../../core/toon.js';
import { canvasTex, cached } from '../../core/textures.js';
import { rngKit } from '../../core/util.js';

/* ------------------------------------------------------------------ *
 * Facade textures for the apartment blocks.
 *
 * Walls are small tileable canvases mapped in world metres (u along the
 * facade, v up), so a brick is a brick on every building:
 *
 *   silicate   the pale grey-beige sand-lime brick of the 9-storeys
 *   cream      the yellowish brick of the 1-447 Khrushchyovkas
 *   redBrick   red facing brick, schools and ornaments
 *   tile       small beige ceramic tiles on 1970s-80s panel blocks
 *   panel      a large concrete panel with seams, one bay by one storey
 *   stucco     Stalin-era render, ochre or pale yellow
 *
 * Windows are separate quads that sample one cell of a shared 8 x 8
 * atlas (WINDOW_ATLAS): residential windows with tulle, drapes, blinds,
 * foil against the heat and pot plants; ground-floor ones behind
 * grilles; stairwell windows and glass blocks; school windows; doors.
 * A facade picks a cell per window from the seeded rng, so no two
 * facades read the same.
 *
 * Kazakh ornament on end walls is drawn as if laid in red brick: the
 * motif is rasterised onto the brick grid, the way c08 shows it.
 * ------------------------------------------------------------------ */

/* ---------------- walls ---------------- */

export const WALLS = {
  silicate: { base: [214, 208, 196], mortar: [190, 183, 170], kind: 'brick', tileW: 2.08, tileH: 1.95, vary: 6 },
  cream: { base: [226, 208, 166], mortar: [205, 190, 160], kind: 'brick', tileW: 2.08, tileH: 1.95, vary: 9 },
  redBrick: { base: [168, 74, 52], mortar: [196, 176, 150], kind: 'brick', tileW: 2.08, tileH: 1.95, vary: 14 },
  tile: { base: [217, 203, 176], mortar: [186, 176, 158], kind: 'tile', tileW: 1.2, tileH: 1.2, vary: 7 },
  tileWhite: { base: [226, 222, 212], mortar: [196, 192, 184], kind: 'tile', tileW: 1.2, tileH: 1.2, vary: 5 },
  panel: { base: [190, 186, 176], mortar: [112, 106, 98], kind: 'panel', tileW: 3.2, tileH: 2.8, vary: 6 },
  panelBeige: { base: [214, 200, 172], mortar: [120, 110, 96], kind: 'panel', tileW: 3.2, tileH: 2.8, vary: 6 },
  stucco: { base: [227, 184, 120], mortar: [200, 160, 100], kind: 'stucco', tileW: 5, tileH: 4, vary: 8 },
  stuccoYellow: { base: [237, 224, 166], mortar: [210, 196, 140], kind: 'stucco', tileW: 5, tileH: 4, vary: 7 },
  concrete: { base: [178, 173, 163], mortar: [150, 146, 138], kind: 'stucco', tileW: 4, tileH: 4, vary: 10 },
};

const rgb = (c, d = 0) => `rgb(${Math.max(0, Math.min(255, c[0] + d))},${Math.max(0, Math.min(255, c[1] + d))},${Math.max(0, Math.min(255, c[2] + d))})`;

function drawBrick(ctx, w, h, spec, r) {
  const cols = 8, rows = 26;
  const bw = w / cols, bh = h / rows;
  ctx.fillStyle = rgb(spec.mortar);
  ctx.fillRect(0, 0, w, h);
  for (let j = 0; j < rows; j++) {
    const off = j % 2 ? bw / 2 : 0;
    for (let i = -1; i < cols + 1; i++) {
      const d = Math.round((r.next() - 0.5) * spec.vary * 2);
      ctx.fillStyle = rgb(spec.base, d);
      const x = i * bw + off;
      ctx.fillRect(x + 1.2, j * bh + 1.2, bw - 2.4, bh - 2.4);
    }
  }
}

function drawTile(ctx, w, h, spec, r) {
  const n = 8, s = w / n;
  ctx.fillStyle = rgb(spec.mortar);
  ctx.fillRect(0, 0, w, h);
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      const d = Math.round((r.next() - 0.5) * spec.vary * 2);
      ctx.fillStyle = r.chance(0.015) ? rgb(spec.mortar, -18) : rgb(spec.base, d);
      ctx.fillRect(i * s + 2, j * s + 2, s - 4, s - 4);
    }
  }
}

function drawPanel(ctx, w, h, spec, r) {
  ctx.fillStyle = rgb(spec.base);
  ctx.fillRect(0, 0, w, h);
  // pebble-dash surface
  for (let i = 0; i < 5000; i++) {
    const d = Math.round((r.next() - 0.5) * 40);
    ctx.fillStyle = rgb(spec.base, d);
    ctx.globalAlpha = 0.5;
    const s = r.range(1, 3);
    ctx.fillRect(r.range(0, w), r.range(0, h), s, s);
  }
  ctx.globalAlpha = 1;
  // seams: a strip of dark mastic with a pale chamfered panel edge either
  // side, patched here and there where the flat above complained of leaks
  const seam = (x, y, sw, sh) => {
    ctx.fillStyle = rgb(spec.base, 22);
    ctx.fillRect(x - 3, y - 3, sw + 6, sh + 6);
    ctx.fillStyle = rgb(spec.mortar);
    ctx.fillRect(x, y, sw, sh);
  };
  seam(0, 0, w, 7);
  seam(0, 0, 7, h);
  seam(0, h - 1, w, 1);
  ctx.fillStyle = 'rgba(40,36,32,0.55)';
  for (let i = 0; i < 3; i++) ctx.fillRect(r.range(20, w - 80), 0, r.range(30, 70), 9);
  const g = ctx.createLinearGradient(0, 7, 0, 70);
  g.addColorStop(0, 'rgba(80,72,64,0.3)');
  g.addColorStop(1, 'rgba(80,72,64,0)');
  ctx.fillStyle = g;
  ctx.fillRect(7, 7, w - 7, 63);
  // rust streaks from the embedded fixings at the panel corners
  ctx.fillStyle = 'rgba(140,86,50,0.22)';
  ctx.fillRect(14, 8, 3, r.range(30, 70));
  ctx.fillRect(w - 18, 8, 3, r.range(20, 60));
}

function drawStucco(ctx, w, h, spec, r) {
  ctx.fillStyle = rgb(spec.base);
  ctx.fillRect(0, 0, w, h);
  // soft, wide patches of uneven render; kept faint so the tiling never shows
  for (let i = 0; i < 12; i++) {
    const x = r.range(0, w), y = r.range(0, h), rad = r.range(120, 260);
    const d = r.chance(0.5) ? 7 : -8;
    for (const [ox, oy] of [[0, 0], [-w, 0], [w, 0], [0, -h], [0, h]]) {
      const gr = ctx.createRadialGradient(x + ox, y + oy, 2, x + ox, y + oy, rad);
      gr.addColorStop(0, `rgba(${spec.base[0] + d},${spec.base[1] + d},${spec.base[2] + d},0.35)`);
      gr.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = gr;
      ctx.fillRect(0, 0, w, h);
    }
  }
  for (let i = 0; i < 3000; i++) {
    ctx.globalAlpha = 0.25;
    ctx.fillStyle = rgb(spec.base, Math.round((r.next() - 0.5) * 30));
    ctx.fillRect(r.range(0, w), r.range(0, h), 2, 2);
  }
  ctx.globalAlpha = 1;
  // a few hairline cracks
  ctx.strokeStyle = 'rgba(90,70,50,0.35)';
  ctx.lineWidth = 1;
  for (let i = 0; i < 4; i++) {
    let x = r.range(0, w), y = r.range(0, h);
    ctx.beginPath();
    ctx.moveTo(x, y);
    for (let k = 0; k < 8; k++) { x += r.range(-10, 10); y += r.range(4, 14); ctx.lineTo(x, y); }
    ctx.stroke();
  }
}

/** Cached wall material for a WALLS key; uv in world metres / tile. */
export function wallMaterial(key) {
  return cached(`wallmat|${key}`, () => {
    const spec = WALLS[key];
    const r = rngKit(key.length * 131 + 7);
    const w = 512, h = spec.kind === 'panel' ? 448 : spec.kind === 'brick' ? 480 : 512;
    const tex = canvasTex(w, h, (ctx) => {
      if (spec.kind === 'brick') drawBrick(ctx, w, h, spec, r);
      else if (spec.kind === 'tile') drawTile(ctx, w, h, spec, r);
      else if (spec.kind === 'panel') drawPanel(ctx, w, h, spec, r);
      else drawStucco(ctx, w, h, spec, r);
    }, { repeat: [1, 1] });
    const m = cel({ map: tex, bands: 4, grime: 0.05, dirt: 0.45, dirtH: 1.2, cache: false });
    m.userData.tileW = spec.tileW;
    m.userData.tileH = spec.tileH;
    return m;
  });
}

/* ---------------- windows ---------------- */

export const ATLAS_N = 8;
/** Named ranges of atlas cells. */
export const WIN = {
  flat: [0, 40],        // ordinary flat windows (the last four have a lamp on)
  unlit: [0, 36],       // flat windows with the lights off
  lit: [36, 40],        // a lamp on behind the tulle; drawn with litWindowMaterial
  grille: [40, 48],     // ground floor behind grilles
  stair: [48, 52],      // stairwell windows
  glassBlock: [52, 54], // glass-block stair panels
  school: [54, 56],
  door: [56, 61],       // podyezd and service doors
  shop: [61, 64],       // shop windows
};

const CURTAIN = ['#e7dcc8', '#c9553d', '#d98c3a', '#6f8a4a', '#8c5a3c', '#b04a5a', '#d8c27a', '#5a7aa8', '#e8e2d0', '#9b6b8e'];

function glassFill(ctx, x, y, w, h, r) {
  const g = ctx.createLinearGradient(x, y, x + w * 0.3, y + h);
  g.addColorStop(0, `rgb(${120 + r.int(-10, 10)},${150 + r.int(-10, 10)},${178 + r.int(-10, 10)})`);
  g.addColorStop(0.5, '#45566a');
  g.addColorStop(1, '#2c3642');
  ctx.fillStyle = g;
  ctx.fillRect(x, y, w, h);
}

function tulle(ctx, x, y, w, h, r) {
  ctx.fillStyle = 'rgba(244,240,230,0.62)';
  ctx.fillRect(x, y, w, h);
  ctx.fillStyle = 'rgba(255,255,255,0.35)';
  for (let i = 0; i < 40; i++) ctx.fillRect(x + r.range(0, w), y + r.range(0, h), 2, 2);
  // folds
  ctx.fillStyle = 'rgba(200,196,186,0.35)';
  for (let fx = x + 3; fx < x + w; fx += 6) ctx.fillRect(fx, y, 1.5, h);
}

function drape(ctx, x, y, w, h, color) {
  ctx.fillStyle = color;
  ctx.fillRect(x, y, w, h);
  ctx.fillStyle = 'rgba(0,0,0,0.18)';
  for (let fx = x + 2; fx < x + w; fx += 5) ctx.fillRect(fx, y, 1.5, h);
}

/** A flat window: frame, sashes, fortochka, glass, and what hangs behind it. */
function drawFlatWindow(ctx, x0, y0, s, r, i) {
  const pad = 7;
  const x = x0 + pad, y = y0 + pad, w = s - pad * 2, h = s - pad * 2;
  const lit = i >= WIN.lit[0] && i < WIN.lit[1];
  // the reveal: the window sits a brick deep in the wall, so the lintel
  // throws a shadow across the top and one jamb catches the light
  ctx.fillStyle = '#4a4640';
  ctx.fillRect(x0, y0, s, s);
  ctx.fillStyle = '#2c2a27';
  ctx.fillRect(x0, y0, s, pad + 3);
  ctx.fillStyle = '#6a655c';
  ctx.fillRect(x0, y0 + pad, pad * 0.6, s - pad);
  const frames = [['#ebe7dc', 5], ['#e3dccb', 5], ['#7b5a3e', 5], ['#f6f6f2', 7], ['#9a7b5a', 5]];
  const [frame, fw] = r.pick(frames);
  ctx.fillStyle = frame;
  ctx.fillRect(x, y, w, h);
  // two sashes below a transom; one small fortochka top-left
  const tH = h * 0.26;
  const panes = [
    [x + fw, y + fw, w / 2 - fw * 1.5, tH - fw],
    [x + w / 2 + fw / 2, y + fw, w / 2 - fw * 1.5, tH - fw],
    [x + fw, y + tH + fw * 0.5, w / 2 - fw * 1.5, h - tH - fw * 1.5],
    [x + w / 2 + fw / 2, y + tH + fw * 0.5, w / 2 - fw * 1.5, h - tH - fw * 1.5],
  ];
  const kind = r.weighted([['tulle', 10], ['drapes', 6], ['blinds', 3], ['foil', 2], ['bare', 3], ['paper', 1]]);
  const cc = r.pick(CURTAIN);
  for (const [px, py, pw, ph] of panes) {
    if (lit) litRoom(ctx, px, py, pw, ph, r);
    else glassFill(ctx, px, py, pw, ph, r);
    if (kind === 'tulle') tulle(ctx, px, py, pw, ph, r);
    if (kind === 'drapes') { tulle(ctx, px, py, pw, ph, r); drape(ctx, px, py, pw * 0.35, ph, cc); drape(ctx, px + pw * 0.65, py, pw * 0.35, ph, cc); }
    if (kind === 'blinds') {
      ctx.fillStyle = r.pick(['#dcd8cc', '#c8d4dc', '#e2d2a8']);
      for (let bx = px; bx < px + pw; bx += 4) ctx.fillRect(bx, py, 3, ph * r.range(0.7, 1));
    }
    if (kind === 'foil') {
      ctx.fillStyle = '#c8ccd0';
      ctx.fillRect(px, py, pw, ph);
      ctx.fillStyle = 'rgba(255,255,255,0.5)';
      for (let k = 0; k < 20; k++) ctx.fillRect(px + r.range(0, pw), py + r.range(0, ph), r.range(2, 6), 1);
      ctx.fillStyle = 'rgba(90,96,104,0.4)';
      for (let k = 0; k < 14; k++) ctx.fillRect(px + r.range(0, pw), py + r.range(0, ph), 1, r.range(2, 6));
    }
    if (kind === 'paper') {
      ctx.fillStyle = '#d8ceb0';
      ctx.fillRect(px, py, pw, ph);
      ctx.fillStyle = 'rgba(60,50,40,0.35)';
      for (let ly = py + 3; ly < py + ph; ly += 3) ctx.fillRect(px + 2, ly, pw - 4, 1);
    }
    // a glint of sky
    ctx.fillStyle = 'rgba(255,255,255,0.14)';
    ctx.beginPath();
    ctx.moveTo(px, py + ph * 0.3); ctx.lineTo(px + pw * 0.4, py); ctx.lineTo(px + pw * 0.6, py); ctx.lineTo(px, py + ph * 0.55);
    ctx.fill();
  }
  // open fortochka reads darker
  if (r.chance(0.35)) { ctx.fillStyle = 'rgba(20,24,28,0.6)'; const p = panes[0]; ctx.fillRect(p[0], p[1], p[2], p[3]); }
  // the lintel's shadow falls on the top of the frame too
  ctx.fillStyle = 'rgba(20,18,16,0.28)';
  ctx.fillRect(x, y, w, 5);
  // on the sill inside: geraniums, an aloe, a jar of pickles
  const pots = r.chance(0.4) ? r.int(1, 3) : 0;
  for (let k = 0; k < pots; k++) {
    const px = x + fw + 6 + r.range(0, w - 2 * fw - 22);
    const base = y + h - fw - 2;
    const kind = r.int(0, 2);
    if (kind === 2) {
      ctx.fillStyle = 'rgba(190,200,170,0.85)';
      ctx.fillRect(px, base - 13, 9, 13);
      ctx.fillStyle = '#a8b04a';
      ctx.fillRect(px + 1, base - 9, 7, 8);
      continue;
    }
    ctx.fillStyle = '#b0603a';
    ctx.fillRect(px, base - 9, 11, 9);
    ctx.fillStyle = kind ? '#5b8a3c' : '#4f7a36';
    ctx.beginPath(); ctx.arc(px + 5.5, base - 14, kind ? 6 : 8, 0, Math.PI * 2); ctx.fill();
    if (!kind) {
      ctx.fillStyle = r.pick(['#d8322e', '#e8506a', '#f07a3a']);
      for (let f = 0; f < 4; f++) ctx.fillRect(px + r.range(0, 10), base - 22 + r.range(0, 6), 3, 3);
    } else {
      ctx.fillStyle = '#6f9a4a';
      for (let f = 0; f < 4; f++) ctx.fillRect(px + 2 + f * 2, base - 22, 1.5, 10);
    }
  }
  // steel sill below
  ctx.fillStyle = '#b4b2ac';
  ctx.fillRect(x0 + 1, y0 + s - 6, s - 2, 3);
  ctx.fillStyle = '#5e5a54';
  ctx.fillRect(x0 + 1, y0 + s - 3, s - 2, 3);
}

/** A room with the light on: warm wallpaper, a carpet on the wall, the lamp. */
function litRoom(ctx, x, y, w, h, r) {
  const g = ctx.createLinearGradient(x, y, x, y + h);
  g.addColorStop(0, '#f6d58c');
  g.addColorStop(1, '#c98f4a');
  ctx.fillStyle = g;
  ctx.fillRect(x, y, w, h);
  ctx.fillStyle = 'rgba(150,90,50,0.18)';
  for (let fx = x + 2; fx < x + w; fx += 7) ctx.fillRect(fx, y, 2, h);
  if (r.chance(0.5)) {
    ctx.fillStyle = 'rgba(150,40,40,0.55)';
    ctx.fillRect(x + w * 0.2, y + h * 0.25, w * 0.6, h * 0.5);
  }
  ctx.fillStyle = 'rgba(255,240,200,0.9)';
  ctx.beginPath(); ctx.arc(x + w / 2, y + 6, 5, 0, Math.PI * 2); ctx.fill();
}

function drawGrille(ctx, x0, y0, s, r) {
  const style = r.int(0, 2);
  ctx.strokeStyle = r.chance(0.5) ? '#f0ede4' : '#2a2826';
  ctx.lineWidth = 3;
  const x = x0 + 8, y = y0 + 8, w = s - 16, h = s - 16;
  ctx.strokeRect(x, y, w, h);
  if (style === 0) {
    for (let bx = x + 12; bx < x + w; bx += 14) { ctx.beginPath(); ctx.moveTo(bx, y); ctx.lineTo(bx, y + h); ctx.stroke(); }
    ctx.beginPath(); ctx.moveTo(x, y + h / 2); ctx.lineTo(x + w, y + h / 2); ctx.stroke();
  } else {
    // the sunrise grille: rays from the bottom centre
    const cx = x + w / 2, cy = y + h;
    for (let k = 0; k <= 8; k++) {
      const a = Math.PI + (k / 8) * Math.PI;
      ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx + Math.cos(a) * w, cy + Math.sin(a) * h * 1.1); ctx.stroke();
    }
    ctx.beginPath(); ctx.arc(cx, cy, w * 0.22, Math.PI, 0); ctx.stroke();
    ctx.beginPath(); ctx.arc(cx, cy, w * 0.46, Math.PI, 0); ctx.stroke();
  }
}

function drawStair(ctx, x0, y0, s, r) {
  ctx.fillStyle = '#3c3935';
  ctx.fillRect(x0, y0, s, s);
  const frame = r.pick(['#c9c2b2', '#7b5a3e', '#e8e4da']);
  ctx.fillStyle = frame;
  ctx.fillRect(x0 + 10, y0 + 6, s - 20, s - 12);
  const cols = 2, rows = 3;
  const pw = (s - 20 - 6 * (cols + 1)) / cols, ph = (s - 12 - 6 * (rows + 1)) / rows;
  for (let i = 0; i < cols; i++) {
    for (let j = 0; j < rows; j++) {
      const px = x0 + 10 + 6 + i * (pw + 6), py = y0 + 6 + 6 + j * (ph + 6);
      ctx.fillStyle = r.chance(0.12) ? '#1d2024' : `rgb(${86 + r.int(-8, 8)},${98 + r.int(-8, 8)},${108 + r.int(-8, 8)})`;
      ctx.fillRect(px, py, pw, ph);
      ctx.fillStyle = 'rgba(210,200,170,0.25)';   // dust
      ctx.fillRect(px, py + ph * 0.6, pw, ph * 0.4);
    }
  }
}

function drawGlassBlock(ctx, x0, y0, s, r) {
  ctx.fillStyle = '#b8b4aa';
  ctx.fillRect(x0, y0, s, s);
  const n = 6, c = s / n;
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      const g = ctx.createRadialGradient(x0 + i * c + c / 2, y0 + j * c + c / 2, 1, x0 + i * c + c / 2, y0 + j * c + c / 2, c * 0.6);
      g.addColorStop(0, '#dfe8e6');
      g.addColorStop(1, `rgb(${140 + r.int(-10, 10)},${160 + r.int(-10, 10)},${158 + r.int(-10, 10)})`);
      ctx.fillStyle = g;
      ctx.fillRect(x0 + i * c + 2, y0 + j * c + 2, c - 4, c - 4);
    }
  }
}

function drawSchool(ctx, x0, y0, s, r) {
  ctx.fillStyle = '#3c3935';
  ctx.fillRect(x0, y0, s, s);
  ctx.fillStyle = '#ebe7dc';
  ctx.fillRect(x0 + 4, y0 + 4, s - 8, s - 8);
  const cols = 3;
  const pw = (s - 8 - 5 * (cols + 1)) / cols;
  for (let i = 0; i < cols; i++) {
    const px = x0 + 4 + 5 + i * (pw + 5);
    glassFill(ctx, px, y0 + 9, pw, s * 0.2, r);
    glassFill(ctx, px, y0 + 14 + s * 0.2, pw, s - 23 - s * 0.2, r);
    if (r.chance(0.3)) { ctx.fillStyle = 'rgba(240,236,226,0.5)'; ctx.fillRect(px, y0 + 14 + s * 0.2, pw, (s - 23 - s * 0.2) * 0.5); }
  }
}

function drawDoor(ctx, x0, y0, s, r, k) {
  const colors = ['#5b3a2c', '#6b2f2a', '#3d5a44', '#4a4f58', '#7a5a3a'];
  ctx.fillStyle = '#2e2b28';
  ctx.fillRect(x0, y0, s, s);
  ctx.fillStyle = colors[k % colors.length];
  ctx.fillRect(x0 + 6, y0 + 4, s - 12, s - 4);
  if (k < 3) {
    // steel podyezd door: a code lock box and a notice taped on
    ctx.fillStyle = '#9a9a96';
    ctx.fillRect(x0 + s * 0.68, y0 + s * 0.42, 12, 18);
    ctx.fillStyle = '#2a2a2a';
    for (let i = 0; i < 3; i++) for (let j = 0; j < 4; j++) ctx.fillRect(x0 + s * 0.68 + 2 + i * 3.5, y0 + s * 0.42 + 2 + j * 4, 2.2, 2.6);
    ctx.fillStyle = '#efe9d6';
    ctx.fillRect(x0 + s * 0.24, y0 + s * 0.3, 24, 30);
    ctx.fillStyle = 'rgba(40,40,40,0.6)';
    for (let ly = 0; ly < 6; ly++) ctx.fillRect(x0 + s * 0.24 + 3, y0 + s * 0.3 + 4 + ly * 4.5, 18, 1.5);
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.fillRect(x0 + 10, y0 + s * 0.5, s - 20, 2);
  } else {
    // old wooden double door with glazed tops
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.fillRect(x0 + s / 2 - 1, y0 + 4, 2, s - 4);
    glassFill(ctx, x0 + 12, y0 + 12, s / 2 - 18, s * 0.3, r);
    glassFill(ctx, x0 + s / 2 + 6, y0 + 12, s / 2 - 18, s * 0.3, r);
  }
  ctx.fillStyle = '#c8c0a8';
  ctx.fillRect(x0 + s * 0.44, y0 + s * 0.55, 3, 10);
}

function drawShop(ctx, x0, y0, s, r) {
  ctx.fillStyle = '#2e2b28';
  ctx.fillRect(x0, y0, s, s);
  ctx.fillStyle = '#d8d4c8';
  ctx.fillRect(x0 + 3, y0 + 3, s - 6, s - 6);
  glassFill(ctx, x0 + 7, y0 + 7, s - 14, s - 14, r);
  // shelves and goods behind the glass
  for (let j = 0; j < 4; j++) {
    const y = y0 + 20 + j * 24;
    ctx.fillStyle = 'rgba(200,190,170,0.5)';
    ctx.fillRect(x0 + 8, y + 14, s - 16, 2);
    for (let i = 0; i < 12; i++) {
      ctx.fillStyle = r.pick(['#c9553d', '#e8c24a', '#3e6aa6', '#e8e2d0', '#5a8a4a', '#d98c3a']);
      ctx.globalAlpha = 0.7;
      ctx.fillRect(x0 + 10 + i * 9, y + 2, 6, 12);
    }
    ctx.globalAlpha = 1;
  }
  ctx.fillStyle = 'rgba(255,255,255,0.12)';
  ctx.fillRect(x0 + 7, y0 + 7, (s - 14) * 0.3, s - 14);
}

/** The shared window atlas material and its cell lookup. */
export function windowAtlas() {
  return cached('window-atlas', () => {
    const S = 128;
    const tex = canvasTex(S * ATLAS_N, S * ATLAS_N, (ctx) => {
      const r = rngKit(2007);
      for (let i = 0; i < ATLAS_N * ATLAS_N; i++) {
        const x0 = (i % ATLAS_N) * S, y0 = Math.floor(i / ATLAS_N) * S;
        if (i < WIN.flat[1]) drawFlatWindow(ctx, x0, y0, S, r, i);
        else if (i < WIN.grille[1]) { drawFlatWindow(ctx, x0, y0, S, r, i); drawGrille(ctx, x0, y0, S, r); }
        else if (i < WIN.stair[1]) drawStair(ctx, x0, y0, S, r);
        else if (i < WIN.glassBlock[1]) drawGlassBlock(ctx, x0, y0, S, r);
        else if (i < WIN.school[1]) drawSchool(ctx, x0, y0, S, r);
        else if (i < WIN.door[1]) drawDoor(ctx, x0, y0, S, r, i - WIN.door[0]);
        else drawShop(ctx, x0, y0, S, r);
      }
    }, { mips: true });
    tex.anisotropy = 8;
    const m = cel({ map: tex, bands: 3, grime: 0.02, dirt: 0.2, polygonOffset: 1, cache: false });
    m.userData.noShadow = true;
    return m;
  });
}

/** uv rectangle [u0, v0, u1, v1] of an atlas cell (flipY-aware). */
export function cellUV(i) {
  const c = i % ATLAS_N, row = Math.floor(i / ATLAS_N);
  const e = 0.5 / 128 / ATLAS_N;
  const u0 = c / ATLAS_N + e, u1 = (c + 1) / ATLAS_N - e;
  const v1 = 1 - row / ATLAS_N - e, v0 = 1 - (row + 1) / ATLAS_N + e;
  return [u0, v0, u1, v1];
}

/** Pick a cell from a named range. */
export function pickCell(r, range) {
  return r.int(range[0], range[1] - 1);
}

/* ---------------- ornament decals ---------------- */

/**
 * A red-brick Kazakh ornament panel, rasterised to a brick grid so it
 * reads as laid in brick. `kind`: 'end' (tall panel for a blind end
 * wall: a column of koshkar-muiz diamonds inside a stepped frame) or
 * 'frieze' (a horizontal band for the top floor). Opaque: the bricks
 * outside the motif are the wall's own, so it never fades at a distance.
 */
export function ornamentMaterial(kind = 'end', seed = 1, wallType = 'silicate') {
  return cached(`ornament|${kind}|${seed}|${wallType}`, () => {
    const wall = WALLS[wallType];
    const bricksW = kind === 'end' ? 35 : 96, rows = kind === 'end' ? 180 : 22;
    const bw = 14, bh = 5;
    const W = bricksW * bw, H = rows * bh;
    const r = rngKit(seed);
    // The motif is set on a coarse grid of one brick by two courses, which
    // is close to square on the wall, then expanded to single courses.
    const cols = bricksW, crow = rows / 2;
    const grid = new Uint8Array(cols * crow);
    const set = (x, y) => { if (x >= 0 && x < cols && y >= 0 && y < crow) grid[y * cols + x] = 1; };
    /** Stepped diamond of radius R with a solid heart and koshkar-muiz horns at its tips. */
    const motif = (cx, cy, R, horns = true) => {
      for (let dy = -R; dy <= R; dy++) {
        for (let dx = -R; dx <= R; dx++) {
          const d = Math.abs(dx) + Math.abs(dy);
          if (d === R || d <= Math.max(0, R - 4)) set(cx + dx, cy + dy);
        }
      }
      if (!horns) return;
      // each tip grows a stem that splits into two horns curling back
      for (const [ux, uy] of [[0, -1], [0, 1], [-1, 0], [1, 0]]) {
        const vx = uy, vy = ux;   // across the stem
        const tx = cx + ux * R, ty = cy + uy * R;
        set(tx + ux, ty + uy); set(tx + 2 * ux, ty + 2 * uy);
        for (const s of [-1, 1]) {
          const hx = tx + 2 * ux + s * vx, hy = ty + 2 * uy + s * vy;
          set(hx, hy); set(hx + s * vx, hy + s * vy);
          set(hx + s * vx - ux, hy + s * vy - uy);
        }
      }
    };
    if (kind === 'end') {
      for (let y = 1; y < crow - 1; y++) {
        for (const x of [1, 2, cols - 3, cols - 2]) set(x, y);
        // a stepped zigzag just inside the frame
        const z = (y >> 1) % 2;
        set(4 + z, y); set(cols - 5 - z, y);
      }
      for (let x = 1; x < cols - 1; x++) { set(x, 1); set(x, 2); set(x, crow - 2); set(x, crow - 3); }
      const cx = Math.floor(cols / 2);
      for (let cy = 12; cy < crow - 10; cy += 20) {
        motif(cx, cy, 6);
        if (cy + 10 < crow - 8) motif(cx, cy + 10, 1, false);
      }
    } else {
      for (let x = 0; x < cols; x++) { set(x, 0); set(x, crow - 1); }
      for (let cx = 6; cx < cols; cx += 12) motif(cx, Math.floor(crow / 2), 3);
    }
    const tex = canvasTex(W, H, (ctx) => {
      ctx.fillStyle = rgb(wall.mortar);
      ctx.fillRect(0, 0, W, H);
      for (let j = 0; j < rows; j++) {
        const off = j % 2 ? bw / 2 : 0;
        for (let i = -1; i <= bricksW; i++) {
          const ci = Math.max(0, Math.min(bricksW - 1, i));
          const on = grid[(j >> 1) * cols + ci] === 1;
          const d = Math.round((r.next() - 0.5) * (on ? 24 : wall.vary * 2));
          ctx.fillStyle = on ? `rgb(${168 + d},${70 + d / 2},${48 + d / 3})` : rgb(wall.base, d);
          ctx.fillRect(i * bw + off + 0.6, j * bh + 0.5, bw - 1.2, bh - 1);
        }
      }
    }, { mips: true });
    tex.magFilter = THREE.LinearFilter;
    const mat = cel({ map: tex, bands: 4, grime: 0.05, dirt: 0.45, dirtH: 1.2, polygonOffset: 1, cache: false });
    mat.userData.aspect = W / H;
    return mat;
  });
}

/** Greek-key relief band for loggia parapets (concrete, low contrast). */
export function greekKeyMaterial() {
  return cached('greek-key', () => {
    const tex = canvasTex(256, 64, (ctx, w, h) => {
      ctx.fillStyle = '#cfc8b8';
      ctx.fillRect(0, 0, w, h);
      ctx.strokeStyle = '#a79f8f';
      ctx.lineWidth = 5;
      const u = 32;
      for (let x = 0; x < w; x += u) {
        ctx.beginPath();
        ctx.moveTo(x + 4, h - 10); ctx.lineTo(x + 4, 10); ctx.lineTo(x + u - 6, 10); ctx.lineTo(x + u - 6, h - 22);
        ctx.lineTo(x + 14, h - 22); ctx.lineTo(x + 14, 22);
        ctx.stroke();
      }
      ctx.fillStyle = 'rgba(255,255,255,0.18)';
      ctx.fillRect(0, 0, w, 3);
    }, { repeat: [1, 1] });
    const m = cel({ map: tex, bands: 4, grime: 0.05, dirt: 0.1, cache: false });
    m.userData.noShadow = true;
    m.userData.tileW = 1.6;
    m.userData.tileH = 1.0;
    return m;
  });
}

/**
 * The window atlas again, unlit, for the few windows where somebody has
 * already switched the light on. Use with cells from WIN.lit.
 */
export function litWindowMaterial() {
  return cached('window-atlas-lit', () => {
    const m = flat({ map: windowAtlas().map, color: 0xe8dcc4, polygonOffset: 1, cache: false });
    m.userData.noShadow = true;
    return m;
  });
}

/* ---------------- glazed balconies ---------------- */

export const BGLASS_N = 8;   // cells, 4 across by 2 down

/**
 * What you see through the glazing of an enclosed balcony: sky caught in
 * the glass, and behind it the things that live on balconies. Jars of
 * preserves on a shelf, cardboard boxes, skis, a bicycle wheel, washing,
 * a curtain. One cell per run of panes; the frames are real geometry.
 */
export function balconyGlassMaterial() {
  return cached('balcony-glass', () => {
    const CW = 256, CH = 128;
    const tex = canvasTex(CW * 4, CH * 2, (ctx) => {
      const r = rngKit(4471);
      for (let i = 0; i < BGLASS_N; i++) {
        drawBalconyGlass(ctx, (i % 4) * CW, Math.floor(i / 4) * CH, CW, CH, r, i);
      }
    }, { mips: true });
    const m = cel({ map: tex, bands: 3, grime: 0.02, dirt: 0, polygonOffset: 1, cache: false });
    m.userData.noShadow = true;
    return m;
  });
}

/** uv rectangle [u0, v0, u1, v1] of a balcony glass cell. */
export function balconyGlassUV(i) {
  const c = i % 4, row = Math.floor(i / 4) % 2;
  const e = 0.002;
  return [c / 4 + e, 1 - (row + 1) / 2 + e, (c + 1) / 4 - e, 1 - row / 2 - e];
}

function drawBalconyGlass(ctx, x0, y0, w, h, r, i) {
  const g = ctx.createLinearGradient(x0, y0, x0, y0 + h);
  g.addColorStop(0, '#5a6570');
  g.addColorStop(1, '#3a3f44');
  ctx.fillStyle = g;
  ctx.fillRect(x0, y0, w, h);
  // the back wall of the balcony: the flat's own door and window
  ctx.fillStyle = 'rgba(40,44,50,0.8)';
  ctx.fillRect(x0 + w * 0.1, y0 + h * 0.15, w * 0.3, h * 0.85);
  ctx.fillStyle = 'rgba(210,206,196,0.35)';
  ctx.fillRect(x0 + w * 0.55, y0 + h * 0.2, w * 0.3, h * 0.4);
  const shelf = () => {
    ctx.fillStyle = '#7a6048';
    ctx.fillRect(x0 + 4, y0 + h * 0.55, w - 8, 3);
    for (let k = 0; k < 14; k++) {
      const jx = x0 + 10 + k * ((w - 20) / 14);
      ctx.globalAlpha = 0.85;
      ctx.fillStyle = r.pick(['#b8423a', '#c9a23a', '#7a9a4a', '#d86a3a', '#9a3a5a']);
      ctx.fillRect(jx, y0 + h * 0.55 - 12, 9, 12);
      ctx.fillStyle = '#c8c4b8';
      ctx.fillRect(jx, y0 + h * 0.55 - 14, 9, 2);
      ctx.globalAlpha = 1;
    }
  };
  const boxes = () => {
    for (let k = 0; k < 4; k++) {
      const bw = r.range(26, 50), bh = r.range(20, 44);
      ctx.fillStyle = r.pick(['#b89a6a', '#a8875a', '#c8b08a']);
      ctx.fillRect(x0 + 8 + k * 58, y0 + h - bh, bw, bh);
      ctx.fillStyle = 'rgba(60,40,20,0.3)';
      ctx.fillRect(x0 + 8 + k * 58, y0 + h - bh + 6, bw, 2);
    }
  };
  if (i === 0 || i === 4) shelf();
  if (i === 1 || i === 4) boxes();
  if (i === 2) {
    // skis stood on end and a bicycle wheel
    ctx.fillStyle = '#c8322e'; ctx.fillRect(x0 + 30, y0 + 8, 6, h - 8);
    ctx.fillStyle = '#2d4a78'; ctx.fillRect(x0 + 40, y0 + 12, 6, h - 12);
    ctx.strokeStyle = '#2a2a2a'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(x0 + w * 0.7, y0 + h * 0.62, 30, 0, Math.PI * 2); ctx.stroke();
    boxes();
  }
  if (i === 3 || i === 6) {
    ctx.fillStyle = '#d8d4c8'; ctx.fillRect(x0, y0 + 16, w, 2);
    for (let k = 0; k < 6; k++) {
      ctx.fillStyle = r.pick(['#e8e2d0', '#c9553d', '#5a7aa8', '#d8c27a', '#6f8a4a', '#f2f0ea']);
      ctx.fillRect(x0 + 12 + k * 40, y0 + 18, r.range(18, 30), r.range(24, 50));
    }
  }
  if (i === 5 || i === 7) {
    // a curtain drawn across, faded by the sun
    const cw = i === 5 ? w : w * 0.55;
    ctx.globalAlpha = 0.85;
    ctx.fillStyle = r.pick(['#d8c8a0', '#c8d0d8', '#e0c0a8']);
    ctx.fillRect(x0, y0, cw, h);
    ctx.globalAlpha = 1;
    ctx.fillStyle = 'rgba(0,0,0,0.12)';
    for (let fx = x0 + 3; fx < x0 + cw; fx += 7) ctx.fillRect(fx, y0, 2, h);
  }
  // the sky caught in the glass: a pale band and a diagonal glint
  const sky = ctx.createLinearGradient(x0, y0, x0, y0 + h);
  sky.addColorStop(0, 'rgba(190,214,236,0.45)');
  sky.addColorStop(0.45, 'rgba(160,186,210,0.15)');
  sky.addColorStop(1, 'rgba(120,140,160,0.05)');
  ctx.fillStyle = sky;
  ctx.fillRect(x0, y0, w, h);
  ctx.fillStyle = 'rgba(255,255,255,0.16)';
  const gx = x0 + r.range(0, w * 0.6);
  ctx.beginPath();
  ctx.moveTo(gx, y0 + h); ctx.lineTo(gx + 40, y0); ctx.lineTo(gx + 70, y0); ctx.lineTo(gx + 30, y0 + h);
  ctx.fill();
}
