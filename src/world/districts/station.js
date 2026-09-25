import { flat } from '../../core/toon.js';
import { Batch } from '../../core/batch.js';
import { SURF, TILE, hQuad, splitRect } from '../../core/surfaces.js';
import { canvasTex, cached, centerText, FONT } from '../../core/textures.js';
import { rngKit } from '../../core/util.js';
import { TYPES } from '../../vehicles/catalog.js';
import { BLOCKS, BOUNDS, roadById, outerEdge } from '../plan.js';
import { addTree } from '../props/trees.js';
import { addBench, addBin, addLamp } from '../props/street.js';
import { texPlane } from '../buildings/landmarks.js';
import { sitController } from './square.js';
import { buildTrack } from '../../rail/track.js';
import { buildPlatform, PASSAGES } from '../../rail/platform.js';
import { buildFootbridge } from '../../rail/footbridge.js';
import { buildStationHouse, createClocks, ENTRANCE } from '../../rail/stationhouse.js';
import { buildCinema, CINEMA, PROGRAMME } from '../../rail/cinema.js';
import { buildDepot } from '../../rail/depot.js';
import { buildCrossing } from '../../rail/crossing.js';
import { busPavilion, goodsYard, maintenanceYard } from '../../rail/yards.js';
import { STATION, BRIDGE, CROSSING, clockSeconds, clockText } from '../../rail/layout.js';

/* ------------------------------------------------------------------ *
 * District: the station and the railway.
 *
 * South of the line, from west to east: the goods yard, the taxi rank,
 * the Aktobe-1 station house with its forecourt of blue spruces and red
 * granite planters, the bus terminus, the foot of the footbridge, the
 * Lokomotiv cinema and its little plaza, then across the crossing road
 * the track maintenance yard. The corridor itself (track, platform,
 * footbridge, crossing) and the depot side north of it are built here
 * too, from the rail/ modules.
 *
 * Interactables: the ticket hall door (the next trains), the station
 * clock, the cinema poster, the steam engine's plaque, the bus
 * dispatcher's window, the crossing keeper, and the platform benches.
 * ------------------------------------------------------------------ */

const B = BLOCKS.station;
const FRONT = STATION.zBack + STATION.depth;       // hall front, z
const GRANITE = 0x8a3a32;
const Y = -0.02;
const ROAD_X0 = CROSSING.x - CROSSING.outer, ROAD_X1 = CROSSING.x + CROSSING.outer;

/* ---------------- surfaces ---------------- */

function lay(ctx, x0, z0, x1, z1, surf, tile) {
  for (const [a, b, c, d] of splitRect(x0, z0, x1, z1, 40)) {
    ctx.batch.add(hQuad(a, b, c, d, Y, tile), { mat: surf, color: null, cast: false });
  }
}

function surfaces(ctx) {
  const zb = B.z0, zf = B.z1;
  lay(ctx, B.x0, zb, -106, zf, SURF.asphalt, TILE.asphalt);            // taxi rank
  lay(ctx, -106, zb, PASSAGES[1].x1 + 1, zf, SURF.slabs, TILE.slabs);   // forecourt
  lay(ctx, PASSAGES[1].x1 + 1, zb, 26, zf, SURF.asphalt, TILE.asphalt); // bus terminus
  lay(ctx, 26, zb, ROAD_X0, zf, SURF.slabs, TILE.slabs);                // bridge foot, cinema plaza
  lay(ctx, ROAD_X1, zb, B.x1, zf, SURF.yard, TILE.yard);                // maintenance yard
  // the unclaimed corner west of the station block: goods yard
  lay(ctx, BOUNDS.x0, zb, B.x0, zf, SURF.yard, TILE.yard);
  const westPave = roadById.west.c - outerEdge(roadById.west, 0);
  lay(ctx, BOUNDS.x0, zf, westPave, BLOCKS.westEdge.z0, SURF.yard, TILE.yard);
}

/* ---------------- forecourt ---------------- */

function planter(b, ctx, x, z, w, d, rng) {
  b.box(w, 0.6, d, GRANITE, x, 0, z);
  b.box(w - 0.3, 0.05, d - 0.3, 0x4f3a2a, x, 0.6, z);
  for (let i = 0; i < Math.round(w * d * 4); i++) {
    b.box(0.18, 0.12, 0.18, rng.pick([0xc42f2a, 0xf5f2ea, 0xd8453a, 0xe0a02a]), x + rng.range(-w / 2 + 0.3, w / 2 - 0.3), 0.62, z + rng.range(-d / 2 + 0.3, d / 2 - 0.3), { cast: false });
  }
  ctx.colliders.box(x - w / 2, z - d / 2, x + w / 2, z + d / 2, { top: 0.6 });
}

function forecourt(ctx, clocks) {
  const b = ctx.batch;
  const rng = rngKit(4041);
  const ax = ENTRANCE.x;
  // blue spruces along the street side, leaving the entrance and the bus stop open
  for (let x = STATION.x0 + 2; x <= STATION.x1 - 2; x += 8) {
    if (Math.abs(x - ax) < 10 || Math.abs(x + 46) < 6) continue;
    addTree(b, 'spruce', x, B.z1 - 3.2, 700 + x, { scale: 0.9 });
    ctx.colliders.circle(x, B.z1 - 3.2, 0.5, { top: 3 });
  }
  // red granite planters either side of the axis, benches between
  for (const s of [-1, 1]) {
    for (const k of [1, 2]) {
      const x = ax + s * (6 + k * 8);
      planter(b, ctx, x, FRONT + 8, 4, 2.2, rng);
      addBench(b, x + s * 4, FRONT + 8, s > 0 ? Math.PI / 2 : -Math.PI / 2, { style: 'park', color: 0x5f7fa6 });
    }
    planter(b, ctx, ax + s * 8, FRONT + 13, 2.2, 2.2, rng);
    addBin(b, ax + s * 10, FRONT + 5.5, 0);
  }
  for (const x of [STATION.x0 + 4, ax - 22, ax + 22, STATION.x1 - 4]) {
    addLamp(b, x, B.z1 - 6.5, Math.PI, { height: 8, steel: true, double: true });
    ctx.colliders.circle(x, B.z1 - 6.5, 0.2, { top: 8 });
  }
  return streetClock(ctx, clocks, ax + 30, FRONT + 9);
}

/** The forecourt clock: two faces on a light blue post, at arm's reach of the eye. */
function streetClock(ctx, clocks, x, z) {
  const b = ctx.batch;
  b.box(0.8, 0.3, 0.8, GRANITE, x, 0, z);
  b.cyl(0.12, 3.4, 0x7fb8e6, x, 0.3, z, { seg: 10 });
  b.cyl(0.62, 0.3, 0x2f6fc0, x, 3.9, z - 0.15, { rx: Math.PI / 2, seg: 24 });
  ctx.colliders.circle(x, z, 0.4, { top: 3 });
  clocks.face(b, x, 3.9, z - 0.16, 0, 0.55);
  return clocks.face(b, x, 3.9, z + 0.16, Math.PI, 0.55);
}

/* ---------------- taxi rank ---------------- */

function taxiSignTex() {
  return cached('station|taxi-sign', () => canvasTex(256, 128, (c, W, H) => {
    c.fillStyle = '#f2c230';
    c.fillRect(0, 0, W, H);
    for (let i = 0; i < 8; i++) {
      c.fillStyle = i % 2 ? '#1c1c1c' : '#f2c230';
      c.fillRect(i * 32, 0, 32, 18);
      c.fillStyle = i % 2 ? '#f2c230' : '#1c1c1c';
      c.fillRect(i * 32, 18, 32, 18);
    }
    centerText(c, 'ТАКСИ', W / 2, 84, W - 30, 62, '#1c1c1c', { family: FONT.sans, weight: '800' });
  }));
}

function taxiRank(ctx) {
  const b = ctx.batch;
  const x0 = B.x0 + 4, x1 = PASSAGES[0].x0 - 3;
  // liveried taxis, and now and then a private cab in a семёрка
  const rank = ['volgaTaxi', 'passatTaxi', 'lada2107', 'volgaTaxi', 'passatTaxi', 'passatTaxi', 'lada2107'].filter((k) => TYPES[k]);
  const rows = [{ z: -146, ry: 0 }, { z: -128, ry: Math.PI }];
  let slot = 0;
  for (const { z, ry } of rows) {
    for (let x = x0 + 1.4; x < x1 - 1.4; x += 3.6) {
      b.box(0.1, 0.01, 5.2, 0xeeebe0, x - 1.8, Y + 0.005, z, { cast: false });
      ctx.parking.push({ x, z, ry, kind: rank[slot % rank.length], chance: 0.75 });
      slot++;
    }
  }
  const mat = cached('station|taxi-sign-mat', () => flat({ map: taxiSignTex() }));
  b.cyl(0.06, 3.2, 0x4a4d50, x1 + 1.5, 0, -137, { seg: 6 });
  texPlane(b, mat, 1.2, 0.6, x1 + 1.5, 2.5, -137 + 0.05, Math.PI);
  texPlane(b, mat, 1.2, 0.6, x1 + 1.5, 2.5, -137 - 0.05, 0);
  ctx.colliders.circle(x1 + 1.5, -137, 0.15, { top: 3 });
}

/* ---------------- cinema plaza, bus terminus ---------------- */

function plaza(ctx) {
  const b = ctx.batch;
  const xc = (CINEMA.x0 + CINEMA.x1) / 2;
  for (const s of [-1, 1]) {
    for (const dz of [5, 10]) {
      addBench(b, xc + s * 14, CINEMA.z1 + dz, s > 0 ? Math.PI / 2 : -Math.PI / 2, { color: 0x4f8a4a });
    }
    addBin(b, xc + s * 11, CINEMA.z1 + 6, 0);
  }
  const trees = [[CINEMA.x0 - 4, B.z1 - 4, 'elm'], [CINEMA.x1 + 5, B.z1 - 4, 'elm'], [CINEMA.x1 + 10, CINEMA.z0 + 4, 'poplar'],
    [CINEMA.x1 + 10, CINEMA.z0 + 14, 'poplar'], [BRIDGE.x + 8, B.z1 - 5, 'ball'], [BRIDGE.x - 5, B.z1 - 3, 'ball']];
  for (const [x, z, kind] of trees) {
    addTree(b, kind, x, z, 900 + x, {});
    ctx.colliders.circle(x, z, 0.3, { top: 3 });
  }
}

function buses(ctx) {
  const x0 = PASSAGES[1].x1 + 1, x1 = 26;
  for (const [x, kind] of [[x0 + 6, 'paz'], [x1 - 6, 'bus']]) {
    if (TYPES[kind]) ctx.parking.push({ x, z: -133, ry: Math.PI, kind, color: kind === 'paz' ? 0xd8c65a : 0xe8e4d8 });
  }
  return busPavilion(ctx, x0 + 3, x1 - 3, STATION.zBack);
}

/* ---------------- interactables ---------------- */

function timetable(game) {
  const now = clockText(clockSeconds(game));
  const list = game.rail?.upcoming?.(3) || [];
  if (!list.length) return `${now}. Поездов по расписанию нет.`;
  const line = (t) => {
    if (t.kind === 'freight') return `${t.time} грузовой, ${t.track} путь, без остановки`;
    if (t.here) return `${t.name} на 1 пути, отправление в ${t.time}`;
    return `${t.time} ${t.name}, ${t.track} путь${t.stops ? ', стоянка 1 мин' : ', без остановки'}`;
  };
  return `Сейчас ${now}. ${list.map(line).join(' · ')}`;
}

function keeper(game) {
  const next = (game.rail?.upcoming?.(4) || []).find((t) => !t.here);
  const phase = game.rail?.crossing;
  if (phase && phase !== 'open') return 'Дежурная: «Куда? Поезд идёт! Стой за шлагбаумом.»';
  return next ? `Дежурная: «Следующий в ${next.time}. Под шлагбаум не лезь.»` : 'Дежурная: «Тихо пока. Проходи.»';
}

function interactables(ctx, { clock, posters, erPlaque, pavilion, office, benches }) {
  // clock is the forecourt one (the tower clock is out of reach)
  ctx.interact({
    x: ENTRANCE.x, y: 1.6, z: FRONT + 1.6, w: 11, h: 3.2, d: 0.6,
    label: 'Ticket hall · timetable',
    action: (game) => game.hud.sms('Справочная вокзала Актобе', timetable(game), 9000),
  });
  ctx.interact({
    x: clock.x, y: clock.y, z: clock.z, w: 1.4, h: 1.4, d: 0.8,
    label: 'Station clock',
    action: (game) => game.hud.flash(`Вокзальные часы: ${clockText(clockSeconds(game))}, местное время`, 2600),
  });
  const films = PROGRAMME.map(([t, times]) => `${t} (${times})`).join(' · ');
  for (const p of posters) {
    ctx.interact({
      x: p.x, y: 1.9, z: p.z, w: 1.6, h: 2.3, d: 0.6,
      label: 'Cinema poster',
      action: (game) => game.hud.sms('Кинотеатр «Локомотив» · июнь 2007', `${films}. Билеты 300-500 тг.`, 9000),
    });
  }
  ctx.interact({
    x: erPlaque.x, y: 1.2, z: erPlaque.z, w: 1.4, h: 1.2, d: 0.8,
    label: 'Plaque on the steam engine',
    action: (game) => game.hud.sms('Паровоз Эр 791-57', 'Установлен на вечную стоянку в 2004 году в память о паровозной тяге на Актюбинском отделении.', 7000),
  });
  ctx.interact({
    x: pavilion.window.x, y: 1.5, z: pavilion.window.z, w: 2, h: 1.6, d: 0.8,
    label: 'Bus dispatcher',
    action: (game) => game.hud.sms('Диспетчерская «Вокзал»', 'Автобусы №1, 3 и 12 от вокзала до центра, интервал 10-15 минут. Проезд 30 тг.', 6500),
  });
  ctx.interact({
    x: CROSSING.x + CROSSING.outer + 3.6 - 1.7, y: 1.5, z: CROSSING.zNorth + 1.2, w: 0.6, h: 1.6, d: 2.4,
    label: "Knock at the crossing keeper's window",
    action: (game) => game.hud.flash(keeper(game), 3200),
  });
  ctx.interact({
    x: office.x, y: 1.2, z: office.z, w: 1.6, h: 2.2, d: 0.6,
    label: 'Track maintenance office',
    action: (game) => game.hud.flash('Закрыто. Бригада на перегоне до 20:00.', 2200),
  });
  for (const bn of benches) {
    ctx.interact({
      x: bn.x, y: bn.y + 0.6, z: bn.z, w: 2, h: 0.9, d: 0.8, ry: bn.facing,
      label: 'Sit on the bench',
      action: (game) => game.setController(sitController(game, bn.x, bn.z, bn.facing, bn.y + 0.02)),
    });
  }
}

/* ---------------- the district ---------------- */

/*
 * The district uses its own batch with coarse cells: the station block
 * and the depot side are long and thin, and 64 m cells would split every
 * material into a dozen draw calls along the line.
 */
const CELL = 128;

export const station = {
  name: 'station',
  build(shared) {
    const ctx = Object.create(shared);
    ctx.batch = new Batch({ cell: CELL, name: 'station' });
    surfaces(ctx);
    buildTrack(ctx);
    const platform = buildPlatform(ctx);
    buildFootbridge(ctx);
    buildCrossing(ctx);
    const clocks = createClocks(ctx.root);
    buildStationHouse(ctx, clocks);
    const cinema = buildCinema(ctx);
    const depot = buildDepot(ctx);
    const streetClockFace = forecourt(ctx, clocks);
    taxiRank(ctx);
    plaza(ctx);
    const pavilion = buses(ctx);
    const westPave = roadById.west.c - outerEdge(roadById.west, 0);
    goodsYard(ctx, { x0: BOUNDS.x0 + 2, x1: westPave - 1, z0: B.z0, z1: BLOCKS.westEdge.z0 - 1 });
    const yard = maintenanceYard(ctx, { x0: ROAD_X1 + 1, x1: B.x1 - 1, z0: B.z0 + 1, z1: B.z1 });
    interactables(ctx, {
      clock: streetClockFace, posters: cinema.posters, erPlaque: depot.erPlaque,
      pavilion, office: yard.office, benches: platform.benches,
    });

    ctx.update((dt, game) => {
      clocks.set(clockSeconds(game));
    });
    ctx.batch.flush(ctx.root);
  },
};

