import { ATLAS } from './kit.js';
import { rngKit } from '../core/util.js';

/* ------------------------------------------------------------------ *
 * Kazakhstan number plates, 1993-2012 format.
 *
 * Black characters on white, a thin black border, no flag, no "KZ".
 * Region letter first (Aktobe region is D), then three digits, then
 * three letters for private cars or two for company vehicles. Every
 * readable private plate in the 2007-2009 Aktobe photos ends in M:
 * "D 362 UDM", "D 201 KCM", "D 571 PHM".
 *
 * Plates are drawn once per string into the shared vehicle atlas, so
 * a plate is part of its car's body mesh and costs no draw call.
 * ------------------------------------------------------------------ */

// Latin letters that also read as Cyrillic were the ones in use
const LETTERS = 'ABCEHKMOPTXUDS';
export const PLATE_W = 0.52;
export const PLATE_H = 0.112;

/** A plausible plate for a vehicle seed. */
export function randomPlate(seed, { company = false } = {}) {
  const r = rngKit(seed * 131 + 7);
  const d = `${r.int(0, 9)}${r.int(0, 9)}${r.int(0, 9)}`;
  const L = () => LETTERS[r.int(0, LETTERS.length - 1)];
  const letters = company ? `${L()}${L()}` : `${L()}${L()}M`;
  return `D ${d} ${letters}`;
}

const ERA_FORMAT = /^[A-Z] \d{3} [A-Z]{2,3}$/;

/**
 * Keep a plate that fits the 1993-2012 format; rebuild one that does not
 * (a "KZ" ending belongs to the plates issued after 2012). The digits
 * are kept, so "D 107 KZ" becomes "D 107 xxM".
 */
export function eraPlate(text, seed, { company = false } = {}) {
  if (typeof text !== 'string' || !text.trim()) return randomPlate(seed, { company });
  const t = text.trim().toUpperCase().replace(/\s+/g, ' ');
  if (ERA_FORMAT.test(t) && !t.endsWith('KZ')) return t;
  const digits = (t.match(/\d/g) || []).join('').padEnd(3, '0').slice(0, 3);
  return `D ${digits} ${randomPlate(seed, { company }).split(' ')[2]}`;
}

/** uv rect of a plate in the atlas. */
export function plateUV(text) {
  return ATLAS.slot('plate|' + text, 232, 50, (ctx, x, y, w, h) => {
    ctx.fillStyle = '#f4f2ea';
    ctx.fillRect(x, y, w, h);
    ctx.strokeStyle = '#1a1a1a';
    ctx.lineWidth = 3;
    ctx.strokeRect(x + 2.5, y + 2.5, w - 5, h - 5);
    // two tiny rivets
    ctx.fillStyle = '#8a8a86';
    ctx.beginPath(); ctx.arc(x + 12, y + h / 2, 2.5, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(x + w - 12, y + h / 2, 2.5, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#141414';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const family = '"DIN Condensed", "PT Sans Narrow", "Arial Narrow", "Roboto Condensed", Arial, sans-serif';
    let size = 40;
    ctx.font = `bold ${size}px ${family}`;
    while (ctx.measureText(text).width > w - 34 && size > 10) {
      size -= 1;
      ctx.font = `bold ${size}px ${family}`;
    }
    ctx.fillText(text, x + w / 2, y + h / 2 + 2);
    // a little road dust
    ctx.globalAlpha = 0.12;
    ctx.fillStyle = '#8a7a60';
    ctx.fillRect(x, y + h - 10, w, 10);
    ctx.globalAlpha = 1;
  });
}

/**
 * Add a front and a rear plate to a Parts bag.
 * @param {import('./kit.js').Parts} P
 * @param {string} text
 * @param {{y:number, z:number}} front  plate centre; front faces -z
 * @param {{y:number, z:number}} rear   rear faces +z
 */
export function addPlates(P, text, front, rear, { tiltRear = 0 } = {}) {
  const uv = plateUV(text);
  if (front) {
    P.decal(PLATE_W, PLATE_H, uv, front.x ?? 0, front.y, front.z - 0.004, { ry: Math.PI });
    P.box(PLATE_W + 0.02, PLATE_H + 0.02, 0.01, 0x1c1c1c, front.x ?? 0, front.y, front.z + 0.002);
  }
  if (rear) {
    P.decal(PLATE_W, PLATE_H, uv, rear.x ?? 0, rear.y, rear.z + 0.004, { rx: -tiltRear });
    P.box(PLATE_W + 0.02, PLATE_H + 0.02, 0.01, 0x1c1c1c, rear.x ?? 0, rear.y, rear.z - 0.002);
  }
}
