import { canvasTex, cached, centerText, fitFont, FONT, weather } from '../../core/textures.js';
import { rngKit } from '../../core/util.js';
import { FIELD, PITCH } from './layout.js';

/* ------------------------------------------------------------------ *
 * Canvas textures for the stadium: the pitch, the club emblem, signs,
 * the match poster, the honours board, pitchside adverts, the goal net
 * and the bulb scoreboard. The emblem is drawn in the spirit of the
 * club (red and white, a ball, the year 1967), not copied from the
 * real crest.
 * ------------------------------------------------------------------ */

const RED = '#c0242a', RED_DARK = '#8e1a1f', WHITE = '#f4f1ea', INK = '#2a2624';

/* ---------------- the pitch ---------------- */

const PPM = 16;   // pixels per metre on the pitch texture

/**
 * The grass inside the stands, pitch and run-off together: mown stripes
 * across the pitch, the markings of 2007 (goal area, penalty area and
 * arc, centre circle, corner arcs), worn goalmouths and a worn strip
 * down the touchline where the linesman runs.
 */
export function pitchTex() {
  return cached('stadium-pitch', () => {
    const W = Math.round((FIELD.x1 - FIELD.x0) * PPM), H = Math.round((FIELD.z1 - FIELD.z0) * PPM);
    return canvasTex(W, H, (c) => {
      const r = rngKit(1975);
      const X = (x) => (x - FIELD.x0) * PPM, Z = (z) => (z - FIELD.z0) * PPM;
      c.fillStyle = '#5f8a3a';
      c.fillRect(0, 0, W, H);
      // stripes: 20 bands across the pitch, carried a little into the run-off
      const band = PITCH.l / 20;
      for (let i = -2; i < 22; i++) {
        c.fillStyle = i % 2 ? '#6a9642' : '#5b8537';
        c.fillRect(0, Z(PITCH.z0 + i * band), W, band * PPM + 1);
      }
      // the run-off is rougher and a touch paler
      c.fillStyle = 'rgba(150,150,90,0.18)';
      c.fillRect(0, 0, X(PITCH.x0 - 1.5), H);
      c.fillRect(X(PITCH.x1 + 1.5), 0, W, H);
      // mottle
      for (let i = 0; i < 9000; i++) {
        c.fillStyle = r.pick(['rgba(40,70,20,0.10)', 'rgba(140,170,80,0.10)', 'rgba(90,110,40,0.12)']);
        const s = r.range(2, 9);
        c.fillRect(r.range(0, W), r.range(0, H), s, s * r.range(0.5, 1.5));
      }
      // worn earth in the goalmouths and along the west touchline
      const wear = (x, z, rx, rz, a) => {
        const g = c.createRadialGradient(X(x), Z(z), 0, X(x), Z(z), Math.max(rx, rz) * PPM);
        g.addColorStop(0, `rgba(150,125,80,${a})`);
        g.addColorStop(1, 'rgba(150,125,80,0)');
        c.save();
        c.translate(X(x), Z(z));
        c.scale(rx / Math.max(rx, rz), rz / Math.max(rx, rz));
        c.translate(-X(x), -Z(z));
        c.fillStyle = g;
        c.fillRect(X(x) - Math.max(rx, rz) * PPM, Z(z) - Math.max(rx, rz) * PPM, Math.max(rx, rz) * 2 * PPM, Math.max(rx, rz) * 2 * PPM);
        c.restore();
      };
      wear(PITCH.x, PITCH.z0 + 2.5, 4.5, 3, 0.7);
      wear(PITCH.x, PITCH.z1 - 2.5, 4.5, 3, 0.7);
      wear(PITCH.x, PITCH.z0 + 11, 1.4, 1.4, 0.5);
      wear(PITCH.x, PITCH.z1 - 11, 1.4, 1.4, 0.5);
      wear(PITCH.x, PITCH.z, 3, 2, 0.35);
      wear(PITCH.x0 - 0.8, PITCH.z, 1.2, 40, 0.35);
      wear(PITCH.x1 + 0.8, PITCH.z, 1.2, 40, 0.3);

      // the markings, 12 cm wide, chalk white
      c.strokeStyle = 'rgba(248,246,236,0.92)';
      c.fillStyle = 'rgba(248,246,236,0.92)';
      c.lineWidth = 0.12 * PPM;
      const rect = (x0, z0, x1, z1) => c.strokeRect(X(x0), Z(z0), (x1 - x0) * PPM, (z1 - z0) * PPM);
      const arc = (x, z, rad, a0, a1) => { c.beginPath(); c.arc(X(x), Z(z), rad * PPM, a0, a1); c.stroke(); };
      const spot = (x, z, rad = 0.12) => { c.beginPath(); c.arc(X(x), Z(z), rad * PPM, 0, Math.PI * 2); c.fill(); };
      rect(PITCH.x0, PITCH.z0, PITCH.x1, PITCH.z1);
      c.beginPath();
      c.moveTo(X(PITCH.x0), Z(PITCH.z));
      c.lineTo(X(PITCH.x1), Z(PITCH.z));
      c.stroke();
      arc(PITCH.x, PITCH.z, 9.15, 0, Math.PI * 2);
      spot(PITCH.x, PITCH.z, 0.15);
      for (const end of [-1, 1]) {
        const line = end < 0 ? PITCH.z0 : PITCH.z1;
        const inward = -end;
        const za = line, zb16 = line + inward * 16.5, zb5 = line + inward * 5.5;
        rect(PITCH.x - 20.16, Math.min(za, zb16), PITCH.x + 20.16, Math.max(za, zb16));
        rect(PITCH.x - 9.16, Math.min(za, zb5), PITCH.x + 9.16, Math.max(za, zb5));
        const pz = line + inward * 11;
        spot(PITCH.x, pz);
        // the arc outside the penalty area: the part of a 9.15 m circle
        // round the spot that lies beyond the 16.5 m line
        const half = Math.acos(5.5 / 9.15);
        const mid = inward > 0 ? Math.PI / 2 : -Math.PI / 2;
        arc(PITCH.x, pz, 9.15, mid - half, mid + half);
      }
      arc(PITCH.x0, PITCH.z0, 1, 0, Math.PI / 2);
      arc(PITCH.x1, PITCH.z0, 1, Math.PI / 2, Math.PI);
      arc(PITCH.x0, PITCH.z1, 1, -Math.PI / 2, 0);
      arc(PITCH.x1, PITCH.z1, 1, Math.PI, Math.PI * 1.5);
    }, { aniso: 16 });
  });
}

/** The small pitch for training: the same stripes and lines, no stands. */
export function trainingTex(w, l) {
  return cached(`stadium-training|${w}|${l}`, () => canvasTex(Math.round(w * 10), Math.round(l * 10), (c, W, H) => {
    const r = rngKit(77);
    const P = 10;
    c.fillStyle = '#5f9a3a';
    c.fillRect(0, 0, W, H);
    for (let i = 0; i < 16; i++) {
      c.fillStyle = i % 2 ? '#6aa646' : '#5a9236';
      c.fillRect(0, (i * H) / 16, W, H / 16 + 1);
    }
    for (let i = 0; i < 3500; i++) {
      c.fillStyle = r.pick(['rgba(150,130,80,0.18)', 'rgba(40,70,20,0.12)', 'rgba(140,170,80,0.10)']);
      const s = r.range(2, 10);
      c.fillRect(r.range(0, W), r.range(0, H), s, s);
    }
    // bare patches: a pitch that is played on every day
    for (let i = 0; i < 14; i++) {
      c.fillStyle = 'rgba(160,135,90,0.35)';
      c.beginPath();
      c.ellipse(r.range(W * 0.2, W * 0.8), r.pick([r.range(0, H * 0.12), r.range(H * 0.88, H), r.range(0, H)]), r.range(8, 30), r.range(6, 20), r.range(0, 3), 0, Math.PI * 2);
      c.fill();
    }
    c.strokeStyle = 'rgba(245,242,230,0.85)';
    c.lineWidth = 2.4;
    const m = 1.5 * P;
    c.strokeRect(m, m, W - 2 * m, H - 2 * m);
    c.beginPath();
    c.moveTo(m, H / 2);
    c.lineTo(W - m, H / 2);
    c.stroke();
    c.beginPath();
    c.arc(W / 2, H / 2, 7 * P, 0, Math.PI * 2);
    c.stroke();
    for (const y of [m, H - m]) {
      const d = y < H / 2 ? 1 : -1;
      c.strokeRect(W / 2 - 16 * P, Math.min(y, y + d * 13 * P), 32 * P, 13 * P);
    }
  }));
}

/* ---------------- the club ---------------- */

/** The emblem: a red ring lettered in Kazakh and Russian round a striped shield with a ball. */
export function drawEmblem(c, cx, cy, R) {
  c.save();
  c.fillStyle = RED;
  c.beginPath();
  c.arc(cx, cy, R, 0, Math.PI * 2);
  c.fill();
  c.fillStyle = WHITE;
  c.beginPath();
  c.arc(cx, cy, R * 0.93, 0, Math.PI * 2);
  c.fill();
  c.fillStyle = RED;
  c.beginPath();
  c.arc(cx, cy, R * 0.9, 0, Math.PI * 2);
  c.fill();
  // lettering round the ring
  const ring = (text, start, dir) => {
    c.font = `bold ${R * 0.17}px ${FONT.sans}`;
    c.fillStyle = WHITE;
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    const step = 0.21;
    const a0 = start - (dir * (text.length - 1) * step) / 2;
    for (let i = 0; i < text.length; i++) {
      const a = a0 + dir * i * step;
      c.save();
      c.translate(cx + Math.cos(a) * R * 0.76, cy + Math.sin(a) * R * 0.76);
      c.rotate(a + (dir > 0 ? Math.PI / 2 : -Math.PI / 2));
      c.fillText(text[i], 0, 0);
      c.restore();
    }
  };
  ring('АҚТӨБЕ', -Math.PI / 2, 1);
  ring('1967', Math.PI / 2, -1);
  // the shield: red and white stripes
  const sw = R * 0.52, sh = R * 0.62, sx = cx - sw / 2, sy = cy - sh * 0.48;
  c.save();
  c.beginPath();
  c.moveTo(sx, sy);
  c.lineTo(sx + sw, sy);
  c.lineTo(sx + sw, sy + sh * 0.55);
  c.quadraticCurveTo(sx + sw, sy + sh * 0.9, cx, sy + sh);
  c.quadraticCurveTo(sx, sy + sh * 0.9, sx, sy + sh * 0.55);
  c.closePath();
  c.fillStyle = WHITE;
  c.fill();
  c.clip();
  c.fillStyle = RED;
  for (let i = 0; i < 5; i += 2) c.fillRect(sx + (i * sw) / 5, sy, sw / 5, sh);
  c.restore();
  c.strokeStyle = WHITE;
  c.lineWidth = R * 0.03;
  c.stroke();
  // the ball in the middle of the shield
  const br = R * 0.16, bx = cx, by = cy + R * 0.03;
  c.fillStyle = WHITE;
  c.beginPath();
  c.arc(bx, by, br, 0, Math.PI * 2);
  c.fill();
  c.strokeStyle = INK;
  c.lineWidth = R * 0.018;
  c.stroke();
  c.fillStyle = INK;
  const pent = (px, py, pr, rot) => {
    c.beginPath();
    for (let i = 0; i < 5; i++) {
      const a = rot + (i * Math.PI * 2) / 5;
      if (i) c.lineTo(px + Math.cos(a) * pr, py + Math.sin(a) * pr);
      else c.moveTo(px + Math.cos(a) * pr, py + Math.sin(a) * pr);
    }
    c.fill();
  };
  pent(bx, by, br * 0.38, -Math.PI / 2);
  for (let i = 0; i < 5; i++) {
    const a = -Math.PI / 2 + (i * Math.PI * 2) / 5;
    pent(bx + Math.cos(a) * br * 0.86, by + Math.sin(a) * br * 0.86, br * 0.22, a + Math.PI);
  }
  c.restore();
}

export function emblemTex() {
  return cached('stadium-emblem', () => canvasTex(512, 512, (c, W, H) => {
    c.clearRect(0, 0, W, H);
    drawEmblem(c, W / 2, H / 2, W * 0.48);
  }));
}

/** A club flag: red, a white stripe, the emblem at the hoist. */
export function clubFlagTex() {
  return cached('stadium-flag', () => canvasTex(512, 256, (c, W, H) => {
    c.fillStyle = RED;
    c.fillRect(0, 0, W, H);
    c.fillStyle = WHITE;
    c.fillRect(0, H * 0.4, W, H * 0.2);
    drawEmblem(c, W * 0.25, H / 2, H * 0.38);
    centerText(c, 'ФК «АКТОБЕ»', W * 0.68, H * 0.22, W * 0.55, H * 0.2, WHITE, { family: FONT.sans });
    centerText(c, 'АҚТӨБЕ', W * 0.68, H * 0.8, W * 0.5, H * 0.2, WHITE, { family: FONT.sans });
  }));
}

/** Big letters for the roof of the entrance: white on transparent, cut out. */
export function lettersTex(key, text, { color = WHITE, edge = '#5a1014', w = 2048, h = 160 } = {}) {
  return cached(`stadium-letters|${key}`, () => canvasTex(w, h, (c) => {
    c.clearRect(0, 0, w, h);
    // room under the baseline for the tails of Қ and Ң; a dark edge so the
    // letters read against the red band of the stand behind them
    centerText(c, text, w / 2, h * 0.44, w * 0.96, h * 0.66, color, { family: FONT.sans, stretch: 0.9, stroke: edge, strokeW: h * 0.07 });
  }));
}

/** A painted sign board: `lines` on `bg`, with a border and some weather. */
export function boardTex(key, lines, { bg = RED, fg = WHITE, w = 1024, h = 256, border = WHITE, emblem = false, sizes = null, wear = 0.4 } = {}) {
  return cached(`stadium-board|${key}`, () => canvasTex(w, h, (c) => {
    c.fillStyle = bg;
    c.fillRect(0, 0, w, h);
    if (border) {
      c.strokeStyle = border;
      c.lineWidth = h * 0.035;
      c.strokeRect(h * 0.06, h * 0.06, w - h * 0.12, h - h * 0.12);
    }
    let x0 = 0;
    if (emblem) {
      drawEmblem(c, h * 0.55, h / 2, h * 0.38);
      x0 = h * 0.95;
    }
    const rel = sizes || lines.map((_, i) => (i === 0 ? 1.3 : 1));
    const total = rel.reduce((a, b) => a + b, 0);
    const pad = h * 0.14;
    let y = pad;
    lines.forEach((t, i) => {
      const lh = ((h - pad * 2) * rel[i]) / total;
      centerText(c, t, x0 + (w - x0) / 2, y + lh / 2, (w - x0) * 0.88, lh * 0.78, fg, { family: FONT.sans });
      y += lh;
    });
    if (wear) weather(c, w, h, key.length * 13, wear);
  }));
}

/* ---------------- the match poster ---------------- */

/**
 * The poster for the next home match. Aktobe did play Kairat at home in
 * the 2007 Superliga (2:0), but the date on this poster and the prices
 * are not checked: flavour.
 */
export const MATCH = {
  home: 'АКТОБЕ', away: 'КАЙРАТ', awayCity: 'Алматы',
  date: '30 июня 2007', day: 'суббота', time: '18:00',
  prices: 'Билеты: 200, 300, 500 тг',
};

export function posterTex() {
  return cached('stadium-poster', () => canvasTex(512, 768, (c, W, H) => {
    c.fillStyle = WHITE;
    c.fillRect(0, 0, W, H);
    c.fillStyle = RED;
    c.fillRect(0, 0, W, H * 0.3);
    drawEmblem(c, W * 0.2, H * 0.15, H * 0.1);
    centerText(c, 'СУПЕРЛИГА', W * 0.62, H * 0.08, W * 0.6, H * 0.07, WHITE, { family: FONT.sans });
    centerText(c, 'ЧЕМПИОНАТ КАЗАХСТАНА', W * 0.62, H * 0.155, W * 0.6, H * 0.038, WHITE, { family: FONT.sans });
    centerText(c, '2007 · 14 тур', W * 0.62, H * 0.22, W * 0.6, H * 0.04, '#ffd9d0', { family: FONT.sans });
    centerText(c, `«${MATCH.home}»`, W / 2, H * 0.39, W * 0.86, H * 0.1, RED, { family: FONT.sans });
    centerText(c, '—', W / 2, H * 0.47, W * 0.3, H * 0.06, INK, { family: FONT.sans });
    centerText(c, `«${MATCH.away}»`, W / 2, H * 0.55, W * 0.86, H * 0.1, '#1d3f7a', { family: FONT.sans });
    centerText(c, `(${MATCH.awayCity})`, W / 2, H * 0.615, W * 0.6, H * 0.04, INK, { family: FONT.sans, weight: '600' });
    c.fillStyle = INK;
    c.fillRect(W * 0.08, H * 0.66, W * 0.84, 3);
    centerText(c, `${MATCH.date}, ${MATCH.day}`, W / 2, H * 0.71, W * 0.84, H * 0.05, INK, { family: FONT.sans });
    centerText(c, `Начало в ${MATCH.time}`, W / 2, H * 0.77, W * 0.84, H * 0.045, RED, { family: FONT.sans });
    centerText(c, 'Центральный стадион', W / 2, H * 0.83, W * 0.84, H * 0.04, INK, { family: FONT.sans, weight: '600' });
    centerText(c, MATCH.prices, W / 2, H * 0.885, W * 0.84, H * 0.036, INK, { family: FONT.sans, weight: '600' });
    c.fillStyle = RED;
    c.fillRect(0, H * 0.93, W, H * 0.07);
    centerText(c, 'БӘРІ СТАДИОНҒА! ВСЕ НА СТАДИОН!', W / 2, H * 0.965, W * 0.9, H * 0.036, WHITE, { family: FONT.sans });
    weather(c, W, H, 30, 0.5);
  }));
}

/* ---------------- pitchside adverts ---------------- */

/**
 * The adverts round the pitch, one atlas of 8 boards in rows. CNPC
 * Aktobemunaigas as the club's big sponsor is from memory, not checked.
 */
export const ADS = [
  { lines: ['CNPC — АҚТӨБЕМҰНАЙГАЗ'], bg: '#ffffff', fg: '#c0242a' },
  { lines: ['ҚАЗАҚТЕЛЕКОМ'], bg: '#1d5aa8', fg: '#ffffff' },
  { lines: ["K'CELL"], bg: '#ffffff', fg: '#1d4f9c' },
  { lines: ['HALYK BANK · НАРОДНЫЙ БАНК'], bg: '#0f7a4a', fg: '#ffffff' },
  { lines: ['БАНК ТУРАНАЛЕМ'], bg: '#0e8fc4', fg: '#ffffff' },
  { lines: ['АЛҒА, АҚТӨБЕ!'], bg: '#c0242a', fg: '#ffffff' },
  { lines: ['КАЗКОММЕРЦБАНК'], bg: '#123a6e', fg: '#ffd84a' },
  { lines: ['ҚАЗАҚСТАН ФУТБОЛ ФЕДЕРАЦИЯСЫ'], bg: '#00a3c8', fg: '#ffe24a' },
];

export function adsTex() {
  return cached('stadium-ads', () => canvasTex(1024, 1024, (c, W, H) => {
    const h = H / ADS.length;
    ADS.forEach((a, i) => {
      const y = i * h;
      c.fillStyle = a.bg;
      c.fillRect(0, y, W, h);
      fitFont(c, a.lines[0], W * 0.9, h * 0.62, FONT.sans, 'bold');
      c.fillStyle = a.fg;
      c.textAlign = 'center';
      c.textBaseline = 'middle';
      c.fillText(a.lines[0], W / 2, y + h * 0.54);
    });
    weather(c, W, H, 12, 0.3);
  }));
}

/* ---------------- goal net ---------------- */

export function netTex() {
  return cached('stadium-net', () => canvasTex(64, 64, (c, W, H) => {
    c.clearRect(0, 0, W, H);
    c.strokeStyle = 'rgba(245,245,240,1)';
    c.lineWidth = 3;
    c.beginPath();
    c.moveTo(0, 1); c.lineTo(W, 1);
    c.moveTo(1, 0); c.lineTo(1, H);
    c.stroke();
  }, { repeat: [1, 1], mips: true }));
}

/* ---------------- the stand backs ---------------- */

/**
 * Concrete of 1975: storey-high panels, narrow vertical fins, a band of
 * small high windows, rain streaks. Tiles every 6 m along, 6 m up.
 */
export function facadeTex() {
  return cached('stadium-facade', () => canvasTex(512, 512, (c, W, H) => {
    const r = rngKit(28);
    c.fillStyle = '#c4bfb3';
    c.fillRect(0, 0, W, H);
    // panel joints every 3 m (256 px here is 3 m)
    c.fillStyle = '#9e998e';
    for (let x = 0; x < W; x += W / 2) c.fillRect(x, 0, 4, H);
    for (let y = 0; y < H; y += H / 2) c.fillRect(0, y, W, 3);
    // fins: light face and shadow side
    for (let i = 0; i < 4; i++) {
      const x = (i + 0.5) * (W / 4);
      c.fillStyle = '#d8d3c8';
      c.fillRect(x - 10, 0, 10, H);
      c.fillStyle = '#8f8a80';
      c.fillRect(x, 0, 8, H);
    }
    // windows high up in each panel, dark glass with a pale frame
    for (let i = 0; i < 4; i++) {
      for (const y of [H * 0.08, H * 0.58]) {
        const x = i * (W / 4) + 22;
        c.fillStyle = '#e6e2d8';
        c.fillRect(x - 3, y - 3, W / 4 - 58, 36);
        c.fillStyle = '#3c4a52';
        c.fillRect(x, y, W / 4 - 64, 30);
        c.fillStyle = 'rgba(255,255,255,0.18)';
        c.fillRect(x, y, W / 4 - 64, 8);
      }
    }
    for (let i = 0; i < 60; i++) {
      c.fillStyle = `rgba(90,84,74,${r.range(0.04, 0.12)})`;
      c.fillRect(r.range(0, W), r.range(0, H * 0.5), r.range(2, 6), r.range(40, 200));
    }
    weather(c, W, H, 9, 0.6);
  }, { repeat: [1, 1] }));
}

/* ---------------- the bulb scoreboard ---------------- */

const SB = { cols: 96, rows: 40, px: 10 };

/**
 * A board of lamps, the kind Soviet stadiums had: every lamp is lit or
 * dark, the text is drawn at lamp resolution and then lit lamp by lamp.
 * Returns the texture and a function that redraws it with a new score.
 */
export function scoreboard() {
  const W = SB.cols * SB.px, H = SB.rows * SB.px;
  const small = document.createElement('canvas');
  small.width = SB.cols;
  small.height = SB.rows;
  const s = small.getContext('2d', { willReadFrequently: true });
  let tex = null;
  const draw = (c, home, away, msg) => {
    s.fillStyle = '#000';
    s.fillRect(0, 0, SB.cols, SB.rows);
    s.textAlign = 'center';
    s.textBaseline = 'middle';
    const text = (t, x, y, size, color, maxW) => {
      s.font = `bold ${size}px ${FONT.narrow}`;
      const w = s.measureText(t).width;
      s.save();
      s.translate(x, y);
      if (maxW && w > maxW) s.scale(maxW / w, 1);
      s.fillStyle = color;
      s.fillText(t, 0, 0);
      s.restore();
    };
    text('ОРТАЛЫҚ СТАДИОН', SB.cols / 2, 5, 8, '#ffd070', SB.cols - 4);
    text('АКТОБЕ', SB.cols * 0.19, 17, 10, '#ff5040', 32);
    text('ГОСТИ', SB.cols * 0.81, 17, 10, '#ffd070', 30);
    text(`${home}`, SB.cols * 0.43, 18, 14, '#ffffff', 12);
    text(':', SB.cols * 0.5, 17, 12, '#ffffff', 5);
    text(`${away}`, SB.cols * 0.57, 18, 14, '#ffffff', 12);
    text(msg, SB.cols / 2, 32, 9, '#ffd070', SB.cols - 4);
    const data = s.getImageData(0, 0, SB.cols, SB.rows).data;
    c.fillStyle = '#16181a';
    c.fillRect(0, 0, W, H);
    const rad = SB.px * 0.36;
    for (let y = 0; y < SB.rows; y++) {
      for (let x = 0; x < SB.cols; x++) {
        const i = (y * SB.cols + x) * 4;
        const lit = data[i] + data[i + 1] + data[i + 2] > 240;
        c.fillStyle = lit ? `rgb(${Math.min(255, data[i] + 40)},${Math.min(255, data[i + 1] + 30)},${Math.min(255, data[i + 2] + 20)})` : '#2c2e2e';
        c.beginPath();
        c.arc(x * SB.px + SB.px / 2, y * SB.px + SB.px / 2, lit ? rad : rad * 0.8, 0, Math.PI * 2);
        c.fill();
      }
    }
  };
  tex = canvasTex(W, H, (c) => draw(c, 0, 0, 'ҚОШ КЕЛДІҢІЗ! ДОБРО ПОЖАЛОВАТЬ!'));
  const canvas = tex.image;
  return {
    tex,
    aspect: W / H,
    set(home, away, msg) {
      draw(canvas.getContext('2d'), home, away, msg);
      tex.needsUpdate = true;
    },
  };
}

/* ---------------- railings ---------------- */

/** A panel of steel railings: vertical bars with spear tops, two rails, cut out. Tiles every 3 m. */
export function railTex() {
  return cached('stadium-rail', () => canvasTex(256, 192, (c, W, H) => {
    c.clearRect(0, 0, W, H);
    const col = '#3f5a4a';
    c.fillStyle = col;
    c.fillRect(0, H * 0.12, W, 7);
    c.fillRect(0, H * 0.86, W, 7);
    c.fillRect(0, 0, 9, H);
    const n = 20;
    for (let i = 1; i < n; i++) {
      const x = (i * W) / n;
      c.fillRect(x - 2, H * 0.06, 4, H * 0.94);
      c.beginPath();
      c.moveTo(x - 5, H * 0.07);
      c.lineTo(x, 0);
      c.lineTo(x + 5, H * 0.07);
      c.fill();
    }
  }, { repeat: [1, 1] }));
}

/** An advertising column (афишная тумба): the match poster three times round, and a circus bill. */
export function tumbaTex() {
  return cached('stadium-tumba', () => canvasTex(2048, 768, (c, W, H) => {
    c.fillStyle = '#d8d2c2';
    c.fillRect(0, 0, W, H);
    const poster = posterTex().image;
    const pw = H * 0.62 * (512 / 768), ph = H * 0.62;
    for (let i = 0; i < 3; i++) c.drawImage(poster, (i * W) / 4 + (W / 4 - pw) / 2, H * 0.19, pw, ph);
    // the fourth side: an old bill for the circus, half torn
    const x = (3 * W) / 4 + (W / 4 - pw) / 2;
    c.fillStyle = '#f0d84a';
    c.fillRect(x, H * 0.19, pw, ph);
    centerText(c, 'ЦИРК', x + pw / 2, H * 0.3, pw * 0.9, H * 0.12, '#b8202a', { family: FONT.sans });
    centerText(c, 'КАЗАХСКИЙ', x + pw / 2, H * 0.42, pw * 0.9, H * 0.05, '#1d3f7a', { family: FONT.sans });
    centerText(c, 'ГОСЦИРК', x + pw / 2, H * 0.48, pw * 0.9, H * 0.05, '#1d3f7a', { family: FONT.sans });
    centerText(c, 'только 3 дня!', x + pw / 2, H * 0.6, pw * 0.9, H * 0.05, '#b8202a', { family: FONT.sans });
    c.fillStyle = '#d8d2c2';
    c.beginPath();
    c.moveTo(x + pw, H * 0.6);
    c.lineTo(x + pw * 0.55, H * 0.81);
    c.lineTo(x + pw, H * 0.81);
    c.fill();
    // the band at the top and the old paste marks
    c.fillStyle = '#8e1a1f';
    c.fillRect(0, 0, W, H * 0.1);
    c.fillStyle = '#6a1418';
    c.fillRect(0, H * 0.92, W, H * 0.08);
    weather(c, W, H, 44, 0.8);
  }));
}

/* ---------------- the ball ---------------- */

export function ballTex() {
  return cached('stadium-ball', () => canvasTex(256, 128, (c, W, H) => {
    c.fillStyle = '#f6f4ee';
    c.fillRect(0, 0, W, H);
    c.fillStyle = '#222';
    const pent = (x, y, r) => {
      c.beginPath();
      for (let i = 0; i < 5; i++) {
        const a = -Math.PI / 2 + (i * Math.PI * 2) / 5;
        if (i) c.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r * 0.9);
        else c.moveTo(x + Math.cos(a) * r, y + Math.sin(a) * r * 0.9);
      }
      c.fill();
    };
    for (let i = 0; i < 5; i++) {
      pent((i + 0.5) * (W / 5), H * 0.3, 12);
      pent((i + 1) * (W / 5), H * 0.7, 12);
    }
    pent(W / 2, 4, 10);
    pent(W / 2, H - 4, 10);
  }));
}

export { RED, RED_DARK, WHITE, INK };
