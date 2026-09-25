import { PAL } from '../../core/palette.js';
import { rotXZ, clamp, rngKit } from '../../core/util.js';
import { FONT } from '../../core/textures.js';
import { ROUTES, KERB_H } from '../plan.js';
import { atlasQuad, addQuad, boardGeo, posterGeo, roadSignGeo, signBackGeo, ATLAS, addSignPost } from './signs.js';

/* ------------------------------------------------------------------ *
 * Bus and trolleybus stops.
 *
 * Two kinds, as on the photos:
 *   pavilion  the long 2000s pavilion on the avenue: steel frame, a blue
 *             corrugated roof, plexiglass back panels (one or two long
 *             since broken), a bench, the stop name on the fascia
 *   concrete  the older Soviet shelter on the side streets: three
 *             concrete slabs and a flat roof, painted and repainted
 *
 * Each gets the stop sign on a post by the kerb (the blue GOST sign with
 * the bus or trolleybus pictogram, a plate with the route numbers under
 * "А" for buses and "Т" for trolleybuses, and the stop name in Kazakh and
 * Russian), a timetable board and a couple of torn posters.
 *
 * Geometry is authored in the shelter's local frame, front (open side)
 * toward local -z, and placed with its yaw `facing`.
 * ------------------------------------------------------------------ */

const ROOF_BLUE = 0x2f5fa8;
const FRAME = 0xd9dcdc;
const PANEL = 0xa9c4cc;

/** Which routes stop here, grouped: { A: ['4', '17'], T: ['1'] }. */
export function routesAt(stopId) {
  const out = { A: new Set(), T: new Set() };
  for (const r of ROUTES) {
    if (!r.serves.includes(stopId)) continue;
    (r.kind === 'trolleybus' ? out.T : out.A).add(r.label);
  }
  const num = (a, b) => Number(a) - Number(b);
  return { A: [...out.A].sort(num), T: [...out.T].sort(num) };
}

/** Local helper: world point from a local offset. */
function L(o, lx, ly, lz) {
  const [dx, dz] = rotXZ(lx, lz, o.yaw);
  return [o.x + dx, o.y + ly, o.z + dz];
}

function box(o, w, h, d, color, lx, ly, lz, extra = {}) {
  const [x, y, z] = L(o, lx, ly, lz);
  o.batch.box(w, h, d, color, x, y, z, { ry: o.yaw, ...extra });
}

function collideLocal(o, lx, lz, w, d, top = 2.4) {
  // shelters are always axis-aligned (yaw is a multiple of PI/2)
  const [cx, , cz] = L(o, lx, 0, lz);
  const along = Math.abs(Math.sin(o.yaw)) < 0.5;
  const hx = (along ? w : d) / 2, hz = (along ? d : w) / 2;
  o.ctx.colliders.box(cx - hx, cz - hz, cx + hx, cz + hz, { top: o.y + top, tag: 'shelter' });
}

/* ------------------------------------------------------------------ *
 * Sitting down
 * ------------------------------------------------------------------ */

/**
 * Sit on something: the camera drops to seat height at `seat` (world
 * x, z and eye y), looking out along `yaw`. Mouse looks around, E stands
 * you up in front of it.
 */
export function sitDown(game, seat) {
  const st = { yaw: seat.yaw, pitch: -0.05, t: 0 };
  const ctrl = {
    name: 'sit',
    crosshair: true,
    get pos() { return { x: seat.x, y: seat.y, z: seat.z }; },
    get yaw() { return st.yaw; },
    enter() { game.audio.play('click', { volume: 0.5 }); },
    exit() {},
    update(dt) {
      st.t += dt;
      const { dx, dy } = game.input.takeLook();
      st.yaw -= dx;
      st.pitch = clamp(st.pitch - dy, -1.1, 0.9);
      const settle = Math.min(1, st.t * 3);
      game.camera.position.set(seat.x, seat.eye + (1 - settle) * 0.4, seat.z);
      // a slow breath, so the view is not dead still
      game.camera.rotation.set(st.pitch + Math.sin(st.t * 1.3) * 0.003, st.yaw, 0, 'YXZ');
    },
    onInteract() {
      game.setController(null);
      game.player.placeAt(seat.standX, seat.standZ, st.yaw, 0);
      return true;
    },
    prompt: () => 'E · stand up',
  };
  game.setController(ctrl);
  if (seat.say) game.hud.flash(seat.say, 2200);
}

/* ------------------------------------------------------------------ *
 * Shelters
 * ------------------------------------------------------------------ */

function stopSign(ctx, o, stop, lx, lz) {
  const routes = routesAt(stop.id);
  const trolley = routes.T.length > 0;
  const lines = [];
  if (routes.T.length) lines.push(`Т  ${routes.T.join('  ')}`);
  if (routes.A.length) lines.push(`А  ${routes.A.join('  ')}`);
  const plate = boardGeo(`routes|${stop.id}`, 0.62, 0.22 + 0.16 * lines.length, {
    bg: '#fbfaf3', fg: '#1a1a1a', lines, border: '#1b56a8', family: FONT.sans, wear: 0.3,
  });
  const name = boardGeo(`stopname|${stop.id}`, 0.62, 0.38, {
    bg: '#1b56a8', fg: '#ffffff', lines: [stop.nameKz, stop.name], sizes: [1, 1], family: FONT.narrow, wear: 0.35,
  });
  const [x, , z] = L(o, lx, 0, lz);
  addSignPost(ctx, x, z, o.yaw, [
    { geo: roadSignGeo(trolley ? 'trolleystop' : 'busstop', 0.6), size: 0.6, backGeo: signBackGeo(0.6) },
    { geo: plate, size: 0.62, h: 0.22 + 0.16 * lines.length, backGeo: signBackGeo(0.62) },
    { geo: name, size: 0.62, h: 0.38 },
  ], { y: KERB_H, height: 3.0 });
  // the same sign seen from the road: turn a copy to face the traffic
  return { x, z };
}

function timetableGeo(stop) {
  const routes = routesAt(stop.id);
  const all = [...routes.T.map((n) => `Т-${n}`), ...routes.A.map((n) => `№${n}`)];
  return atlasQuad(`timetable|${stop.id}`, 0.5, 0.7, (c, w, h) => {
    c.fillStyle = '#f3efe2';
    c.fillRect(0, 0, w, h);
    c.fillStyle = '#1b56a8';
    c.fillRect(0, 0, w, h * 0.13);
    c.fillStyle = '#fff';
    c.font = `bold ${Math.round(h * 0.07)}px ${FONT.narrow}`;
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    c.fillText('КЕСТЕ / РАСПИСАНИЕ', w / 2, h * 0.066);
    c.fillStyle = '#222';
    c.textAlign = 'left';
    const rows = all.length ? all : ['№—'];
    rows.forEach((r, i) => {
      const y = h * (0.22 + i * 0.17);
      c.font = `bold ${Math.round(h * 0.06)}px ${FONT.sans}`;
      c.fillText(r, w * 0.06, y);
      c.font = `${Math.round(h * 0.042)}px ${FONT.sans}`;
      c.fillText('6:30 – 22:00', w * 0.36, y - h * 0.025);
      c.fillText('интервал 10–15 мин', w * 0.36, y + h * 0.03);
    });
  }, { ppm: 400 });
}

/** Footprints, so a placer can make room before it builds. */
export const SHELTER_SIZE = {
  pavilion: { length: 7.2, depth: 1.9, height: 2.55 },
  concrete: { length: 4.4, depth: 1.5, height: 2.4 },
};

/**
 * Build the shelter for `stop` at world (x, z) with yaw `facing`.
 * `signZ` is the stop sign's local z (toward the road is negative); by
 * default it stands a little in front of the shelter.
 * Returns { length, depth, seat } for callers placing things beside it.
 */
export function addShelter(ctx, stop, x, z, facing, kind = 'pavilion', { signZ = null } = {}) {
  const o = { ctx, batch: ctx.batch, x, y: KERB_H, z, yaw: facing };
  const rng = rngKit(stop.id.length * 97 + Math.round(x * 3 + z));
  const pavilion = kind === 'pavilion';
  const { length: Lh, depth: D, height: H } = SHELTER_SIZE[pavilion ? 'pavilion' : 'concrete'];

  if (pavilion) {
    // steel frame: posts front and back
    const nx = 5;
    for (let i = 0; i < nx; i++) {
      const lx = -Lh / 2 + (Lh * i) / (nx - 1);
      box(o, 0.08, H, 0.08, FRAME, lx, 0, D / 2 - 0.05);
      if (i === 0 || i === nx - 1) box(o, 0.08, H, 0.08, FRAME, lx, 0, -D / 2 + 0.05);
    }
    // back: a painted lower panel, plexiglass above (some panes long gone)
    box(o, Lh, 0.85, 0.04, 0x3d6fa8, 0, 0.12, D / 2 - 0.05);
    for (let i = 0; i < nx - 1; i++) {
      const lx = -Lh / 2 + (Lh * (i + 0.5)) / (nx - 1);
      if (rng.chance(0.2)) continue;
      box(o, Lh / (nx - 1) - 0.1, H - 1.2, 0.02, PANEL, lx, 1.0, D / 2 - 0.05, { mat: 'solidClean' });
    }
    box(o, Lh, 0.06, 0.06, FRAME, 0, 0.97, D / 2 - 0.05);
    box(o, Lh, 0.08, 0.08, FRAME, 0, H - 0.08, D / 2 - 0.05);
    // side walls: plexiglass in a frame
    for (const s of [-1, 1]) {
      box(o, 0.04, 0.85, D - 0.1, 0x3d6fa8, s * Lh / 2, 0.12, 0);
      box(o, 0.02, H - 1.2, D - 0.2, PANEL, s * Lh / 2, 1.0, 0.05, { mat: 'solidClean' });
    }
    // roof: blue corrugated sheet over a fascia board, pitched to the back
    box(o, Lh + 0.5, 0.05, D + 0.55, ROOF_BLUE, 0, H, 0.05, { rx: -0.05 });
    for (let i = 0; i < 26; i++) {
      const lx = -Lh / 2 - 0.2 + ((Lh + 0.4) * i) / 25;
      box(o, 0.05, 0.035, D + 0.55, 0x2a5596, lx, H + 0.04, 0.05, { rx: -0.05 });
    }
    box(o, Lh + 0.5, 0.34, 0.05, ROOF_BLUE, 0, H - 0.27, -D / 2 - 0.22);
    const fascia = boardGeo(`fascia|${stop.id}`, Lh * 0.7, 0.28, {
      bg: '#244f93', fg: '#ffffff', lines: [`${stop.nameKz}  ·  ${stop.name}`], family: FONT.narrow, wear: 0.3,
    });
    const [fx, fy, fz] = L(o, 0, H - 0.1, -D / 2 - 0.25);
    addQuad(ctx.batch, fascia, fx, fy, fz, facing);
    // bench along the back
    box(o, Lh - 0.8, 0.05, 0.42, PAL.wood, 0, 0.45, D / 2 - 0.35);
    for (const s of [-1, 0, 1]) box(o, 0.06, 0.45, 0.35, FRAME, s * (Lh / 2 - 0.8), 0, D / 2 - 0.35);
    collideLocal(o, 0, D / 2 - 0.35, Lh - 0.8, 0.45, 0.5);
  } else {
    // Soviet concrete shelter: back and side slabs, flat roof, painted
    const paint = rng.pick([0xd9d2c0, 0xc8d6c9, 0xd6cbb2]);
    const band = rng.pick([0x5a8ab8, 0x6f9a62, 0xb85b45]);
    box(o, Lh, H, 0.14, paint, 0, 0, D / 2 - 0.07);
    box(o, Lh, 0.3, 0.02, band, 0, 1.25, D / 2 - 0.15);
    for (const s of [-1, 1]) box(o, 0.14, H, D, paint, s * (Lh / 2 - 0.07), 0, 0);
    box(o, Lh + 0.4, 0.16, D + 0.5, 0xbab4a6, 0, H, 0.0);
    box(o, Lh - 0.5, 0.06, 0.4, PAL.woodDark, 0, 0.43, D / 2 - 0.36);
    box(o, 0.3, 0.43, 0.35, PAL.concrete, -Lh / 2 + 0.6, 0, D / 2 - 0.36);
    box(o, 0.3, 0.43, 0.35, PAL.concrete, Lh / 2 - 0.6, 0, D / 2 - 0.36);
    collideLocal(o, 0, D / 2 - 0.36, Lh - 0.5, 0.45, 0.5);
  }

  // colliders: back wall and the two side walls; the front stays open
  collideLocal(o, 0, D / 2 - 0.05, Lh, 0.14);
  collideLocal(o, -Lh / 2, 0, 0.14, D);
  collideLocal(o, Lh / 2, 0, 0.14, D);

  // timetable inside the left wall, posters on the back
  const tt = timetableGeo(stop);
  {
    const [tx, ty, tz] = L(o, -Lh / 2 + 0.1, 1.5, 0.0);
    addQuad(ctx.batch, tt, tx, ty, tz, facing - Math.PI / 2);
  }
  for (let i = 0; i < 3; i++) {
    const lx = -Lh / 2 + 0.8 + rng.range(0, Lh - 1.6);
    const [px, py, pz] = L(o, lx, rng.range(1.1, 1.7), D / 2 - 0.1);
    addQuad(ctx.batch, posterGeo(stop.id.length * 31 + i + Math.round(x)), px, py, pz, facing, { mat: ATLAS.cutout });
  }
  // outside of the back wall gets them too, facing away from the road
  for (let i = 0; i < 2; i++) {
    const lx = -Lh / 2 + 0.6 + rng.range(0, Lh - 1.2);
    const [px, py, pz] = L(o, lx, rng.range(1.0, 1.6), D / 2 + 0.02);
    addQuad(ctx.batch, posterGeo(stop.id.length * 53 + i * 7 + Math.round(z)), px, py, pz, facing + Math.PI, { mat: ATLAS.cutout });
  }

  // the stop sign: at the kerb end of the shelter, toward the road
  const sign = stopSign(ctx, o, stop, Lh / 2 + 0.7, signZ ?? -D / 2 - (pavilion ? 1.4 : 0.9));

  // a seat to sit on
  const [sx, , sz] = L(o, 0.8, 0, D / 2 - 0.4);
  const [stx, , stz] = L(o, 0.8, 0, -D / 2 - 0.5);
  const seat = { x: sx, z: sz, eye: KERB_H + 1.17, y: KERB_H + 0.45, yaw: facing, standX: stx, standZ: stz, say: `«${stop.name}». The bus will come.` };
  ctx.interact({
    x: sx, y: KERB_H + 0.6, z: sz, w: 1.6, h: 0.8, d: 1.6,
    label: 'Sit and wait for the bus',
    action: (game) => sitDown(game, seat),
  });

  return { length: Lh, depth: D, sign, seat };
}

