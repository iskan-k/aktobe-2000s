import { canvasTex, cached, FONT } from '../../core/textures.js';

/* ------------------------------------------------------------------ *
 * Airline liveries of June 2007, painted on one 1024 x 2048 canvas per
 * aircraft:
 *
 *   x 0..512,   y 0..2048   the fuselage wrap. y runs nose (top) to
 *                           tail (bottom); x runs round the fuselage:
 *                           0 top, 128 starboard, 256 belly, 384 port.
 *   x 512..1024, y 0..1024  the fin, seen from the port side: front
 *                           left, top up. The starboard side mirrors it.
 *   x 512..1024, y 1024..   a white patch for the vertex-coloured parts.
 *
 * Air Astana (Boeing 757-200, Fokker 50, both on the Aruba register as
 * P4-) is drawn from memory of the 2002 scheme: white, gold titles, a
 * blue-green fin with a gold steppe ornament. SCAT (Yak-42D, An-24),
 * Euro-Asia Air (Tu-134A) and Starline.kz (Boeing 737-200, flying from
 * Aktobe from May 2007) are plausible period schemes, not traced.
 * ------------------------------------------------------------------ */

export const LIV = { W: 1024, H: 2048, FUS_W: 512, FIN: { x: 512, y: 0, w: 512, h: 1024 } };

/** uv of the white patch. */
export const WHITE_UV = [0.75, 1 - 1300 / 2048];

export const LIVERIES = {
  airAstana: {
    title: 'AIR ASTANA', titleColor: '#a8843a', titleFont: FONT.sans, titleWeight: '700',
    body: '#f4f3ee', belly: '#f4f3ee', line: null,
    fin: '#1d6f86', finArt: 'ornament', finInk: '#caa24a',
    engine: 0xeceae4, sub: 'Қазақстан',
  },
  scat: {
    title: 'SCAT', titleColor: '#1f4f9a', titleFont: FONT.sans, titleWeight: '900',
    body: '#f4f3ee', belly: '#d8dcde', line: ['#1f4f9a', '#c8302a'],
    fin: '#f4f3ee', finArt: 'scat', finInk: '#1f4f9a',
    engine: 0xe8e6e0, sub: 'СКАТ',
  },
  euroAsia: {
    title: 'ЕВРО-АЗИЯ ЭЙР', titleColor: '#28407a', titleFont: FONT.sans, titleWeight: '700',
    body: '#f2f1ec', belly: '#b9bdc0', line: ['#b8302c', '#28407a'],
    fin: '#f2f1ec', finArt: 'bands', finInk: '#b8302c',
    engine: 0xc8ccce, sub: 'Қазақстан Республикасы',
  },
  starline: {
    title: 'starline.kz', titleColor: '#1c2f5e', titleFont: FONT.sans, titleWeight: '800',
    body: '#f4f3ee', belly: '#f4f3ee', line: null,
    fin: '#1c2f5e', finArt: 'star', finInk: '#f09a22',
    engine: 0x1c2f5e, sub: '',
  },
};

/* ---------------- fuselage helpers ---------------- */

const FW = LIV.FUS_W;
/** canvas x of a point `up` of the way from the side toward the top (0 side, 1 top). */
const sideX = (side, up) => (side > 0 ? 128 - up * 128 : 384 + up * 128);

/**
 * Text along one side. Starboard reads tail to nose, port nose to tail,
 * both upright as you look at them.
 */
function sideText(c, side, text, along, up, size, color, font, weight, maxLen) {
  c.save();
  c.translate(sideX(side, up), along);
  c.rotate(side > 0 ? -Math.PI / 2 : Math.PI / 2);
  c.font = `${weight} ${size}px ${font}`;
  let w = c.measureText(text).width;
  const sx = w > maxLen ? maxLen / w : 1;
  c.scale(sx, 1);
  w *= sx;
  c.fillStyle = color;
  c.textAlign = 'center';
  c.textBaseline = 'middle';
  c.fillText(text, 0, 0);
  c.restore();
}

/** A band round the fuselage sides between `up0` and `up1`, from along a0 to a1. */
function band(c, up0, up1, a0, a1, color) {
  c.fillStyle = color;
  for (const side of [1, -1]) {
    const x0 = sideX(side, up0), x1 = sideX(side, up1);
    c.fillRect(Math.min(x0, x1), a0, Math.abs(x1 - x0), a1 - a0);
  }
}

function paintFuselage(c, spec, liv, H) {
  const len = spec.len;
  const A = (m) => (m / len) * H;          // metres from the nose to canvas y
  c.fillStyle = liv.body;
  c.fillRect(0, 0, FW, H);
  // the belly: lower third round the bottom
  c.fillStyle = liv.belly;
  c.fillRect(256 - 70, 0, 140, H);
  // cheatlines along the window row
  if (liv.line) {
    band(c, -0.2, -0.05, A(spec.noseLen * 0.6), A(len - 2), liv.line[0]);
    band(c, -0.29, -0.24, A(spec.noseLen * 0.8), A(len - 3), liv.line[1]);
  }
  // cabin windows
  const w0 = A(spec.noseLen + 2.2), w1 = A(len - spec.tailLen + 1.2);
  const pitch = A(0.51 * (spec.winPitch || 1)), ww = Math.max(3, A(0.24)), wh = 14;
  for (const side of [1, -1]) {
    const x = sideX(side, 0.1);
    c.fillStyle = '#23303a';
    for (let y = w0; y < w1; y += pitch) {
      c.fillRect(x - wh / 2, y, wh, ww);
    }
  }
  // doors: front left and right, rear, outlined
  c.strokeStyle = 'rgba(60,64,70,0.55)';
  c.lineWidth = 2;
  for (const side of [1, -1]) {
    for (const d of [spec.noseLen + 1.0, len - spec.tailLen - 0.4]) {
      const x = sideX(side, 0.25);
      c.strokeRect(x - 20, A(d), 40, A(0.9));
    }
  }
  // cockpit windows
  c.fillStyle = '#1b2228';
  for (const side of [1, -1]) {
    const x = sideX(side, 0.42);
    c.beginPath();
    c.moveTo(x - 16, A(spec.noseLen * 0.62));
    c.lineTo(x + 16, A(spec.noseLen * 0.55));
    c.lineTo(x + 16, A(spec.noseLen * 0.9));
    c.lineTo(x - 16, A(spec.noseLen * 0.95));
    c.fill();
  }
  c.fillRect(0, A(spec.noseLen * 0.5), 26, A(spec.noseLen * 0.3));
  c.fillRect(FW - 26, A(spec.noseLen * 0.5), 26, A(spec.noseLen * 0.3));
  if (spec.glazedNose) {
    // the navigator's glazed nose of the Tu-134
    c.fillStyle = '#2a3844';
    c.fillRect(150, 0, 212, A(1.8));
    c.strokeStyle = '#cfd3d4';
    c.lineWidth = 3;
    for (let x = 150; x < 362; x += 30) { c.beginPath(); c.moveTo(x, 0); c.lineTo(x, A(1.8)); c.stroke(); }
  }
  // titles over the windows, the small line under them, the registration aft
  const tA = A(spec.noseLen + len * 0.2);
  for (const side of [1, -1]) {
    sideText(c, side, liv.title, tA, 0.42, 60, liv.titleColor, liv.titleFont, liv.titleWeight, A(len * 0.36));
    if (liv.sub) sideText(c, side, liv.sub, tA, -0.2, 24, liv.titleColor, FONT.sans, '600', A(len * 0.2));
    sideText(c, side, spec.reg, A(len - spec.tailLen * 0.55), 0.05, 26, '#2a2a2a', FONT.sans, '700', A(4));
  }
  // panel lines and a little grime along the belly
  c.globalAlpha = 0.25;
  c.fillStyle = '#9aa0a4';
  for (let y = A(spec.noseLen); y < H; y += A(2.6)) c.fillRect(0, y, FW, 1);
  c.globalAlpha = 0.12;
  c.fillStyle = '#5a5046';
  c.fillRect(256 - 40, 0, 80, H);
  c.globalAlpha = 1;
}

/* ---------------- fin art ---------------- */

function ornament(c, x, y, w, h, color) {
  // a koshkar-muiz scroll, repeated up the fin, and a stylised bird
  c.strokeStyle = color;
  c.lineWidth = w * 0.03;
  for (let k = 0; k < 4; k++) {
    const cy = y + h * (0.2 + k * 0.2), cx = x + w * (0.5 + (k % 2 ? 0.12 : -0.05));
    const s = w * 0.12;
    c.beginPath();
    c.arc(cx - s, cy, s, Math.PI * 0.1, Math.PI * 1.7);
    c.stroke();
    c.beginPath();
    c.arc(cx + s, cy, s, Math.PI * 1.3, Math.PI * 0.9, true);
    c.stroke();
  }
  c.fillStyle = color;
  c.beginPath();
  c.moveTo(x + w * 0.2, y + h * 0.3);
  c.quadraticCurveTo(x + w * 0.55, y + h * 0.08, x + w * 0.95, y + h * 0.1);
  c.quadraticCurveTo(x + w * 0.6, y + h * 0.2, x + w * 0.45, y + h * 0.36);
  c.fill();
}

function paintFin(c, liv) {
  const { x, y, w, h } = LIV.FIN;
  c.fillStyle = liv.fin;
  c.fillRect(x, y, w, h);
  if (liv.finArt === 'ornament') ornament(c, x, y, w, h, liv.finInk);
  else if (liv.finArt === 'scat') {
    c.fillStyle = liv.finInk;
    c.fillRect(x, y + h * 0.7, w, h * 0.3);
    c.fillStyle = '#c8302a';
    c.beginPath();
    c.moveTo(x + w * 0.25, y + h * 0.55);
    c.lineTo(x + w * 0.85, y + h * 0.22);
    c.lineTo(x + w * 0.6, y + h * 0.55);
    c.fill();
    c.save();
    c.translate(x + w * 0.55, y + h * 0.63);
    c.font = `900 ${w * 0.2}px ${FONT.sans}`;
    c.fillStyle = liv.finInk;
    c.textAlign = 'center';
    c.fillText('SCAT', 0, 0);
    c.restore();
  } else if (liv.finArt === 'bands') {
    c.fillStyle = liv.finInk;
    c.fillRect(x, y + h * 0.3, w, h * 0.12);
    c.fillStyle = '#28407a';
    c.fillRect(x, y + h * 0.44, w, h * 0.06);
    c.fillStyle = '#f4c430';
    c.beginPath();
    c.arc(x + w * 0.62, y + h * 0.66, w * 0.1, 0, Math.PI * 2);
    c.fill();
  } else if (liv.finArt === 'star') {
    c.fillStyle = liv.finInk;
    const cx = x + w * 0.6, cy = y + h * 0.42, R = w * 0.2;
    c.beginPath();
    for (let i = 0; i < 10; i++) {
      const a = -Math.PI / 2 + (i * Math.PI) / 5, rr = i % 2 ? R * 0.42 : R;
      c.lineTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr);
    }
    c.fill();
  }
}

/** The livery texture for one airframe: `spec` is its aircraft type, `reg` its registration. */
export function liveryTex(spec, liveryKey, reg) {
  const liv = LIVERIES[liveryKey];
  return cached(`livery|${spec.key}|${liveryKey}|${reg}`, () => canvasTex(LIV.W, LIV.H, (c, W, H) => {
    c.fillStyle = '#ffffff';
    c.fillRect(0, 0, W, H);
    paintFuselage(c, { ...spec, reg }, liv, H);
    paintFin(c, liv);
    c.fillStyle = '#ffffff';
    c.fillRect(LIV.FIN.x, 1100, 512, 400);
  }, { aniso: 8 }));
}
