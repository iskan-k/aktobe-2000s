import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { cel } from '../../core/toon.js';
import { canvasTex, flagTex } from '../../core/textures.js';
import { rngKit } from '../../core/util.js';
import { sitController } from '../districts/square.js';
import { B, RAIL, LOBBY, GATES, STANDS, ROW, FRONT_H, COL, standToWorld } from './layout.js';
import {
  emblemTex, clubFlagTex, lettersTex, boardTex, posterTex, tumbaTex, MATCH,
} from './textures.js';
import { panelAt, atlasAdd } from './util.js';

/* ------------------------------------------------------------------ *
 * The front of the stadium on ул. Айтеке би: the entrance block with
 * the name across its roof and the emblem over the doors, the main gate
 * in the railings, the flags, two КАССА booths, advertising columns with
 * the poster for the next match, the honours board, the champions'
 * banners. And a few seats in the stands to sit in.
 * ------------------------------------------------------------------ */

const FACE_W = Math.PI / 2;     // facing west, toward the street
const TICKET_PRICE = 300;

/* ---------------- the entrance block ---------------- */

function lobby(ctx) {
  const { batch: b, colliders } = ctx;
  const { x0, x1, z0, z1 } = LOBBY;
  const zc = (z0 + z1) / 2, H = 7.6;
  b.span(x0, 0, z0, x1, H, z1, 0xe4dfd4);
  b.span(x0 - 0.3, H, z0 - 0.3, x1, H + 0.5, z1 + 0.3, COL.concreteLight, { closed: true });
  // a glass curtain wall across the front, mullions every 1.5 m
  b.span(x0 - 0.05, 0.4, z0 + 1.2, x0, H - 0.8, z1 - 1.2, 0x33444e, { mat: 'glass' });
  for (let z = z0 + 1.2; z <= z1 - 1.19; z += 1.5) b.span(x0 - 0.12, 0.4, z - 0.05, x0, H - 0.8, z + 0.05, 0xd8d4ca);
  for (const y of [3.4, H - 0.8]) b.span(x0 - 0.14, y - 0.08, z0 + 1.1, x0, y + 0.08, z1 - 1.1, 0xd8d4ca);
  // the canopy over the doors, and the doors
  b.span(x0 - 3.2, 3.5, zc - 6, x0, 3.8, zc + 6, COL.red, { closed: true });
  for (const dz of [-5.6, 5.6]) b.cyl(0.14, 3.5, COL.steel, x0 - 2.9, 0, zc + dz, { seg: 8 });
  for (const dz of [-3, -1, 1, 3]) b.span(x0 - 0.1, 0, zc + dz - 0.85, x0 - 0.02, 2.4, zc + dz + 0.85, 0x5a4a3a);
  colliders.box(x0, z0, x1, z1, { top: H + 0.5, tag: 'lobby' });
  for (const dz of [-5.6, 5.6]) colliders.circle(x0 - 2.9, zc + dz, 0.16, { tag: 'pole' });
  // the name on the roof in two lines, Kazakh over Russian, and the emblem
  // the letters stand on a light steel frame: posts and two rails behind them
  for (let z = z0 - 2.5; z <= z1 + 2.51; z += 3.5) b.span(x0 + 1.05, H + 0.5, z - 0.05, x0 + 1.15, H + 3.3, z + 0.05, COL.steelDark, { cast: false });
  for (const y of [H + 1.1, H + 2.8]) b.span(x0 + 1.05, y, z0 - 2.6, x0 + 1.15, y + 0.08, z1 + 2.6, COL.steelDark, { cast: false });
  panelAt(b, lettersTex('kz', 'ОРТАЛЫҚ СТАДИОН'), 30, 1.5, { x: x0 + 0.95, z: zc }, H + 1.9, FACE_W, { cutout: true, maxPx: 1024 });
  panelAt(b, lettersTex('ru', 'ЦЕНТРАЛЬНЫЙ СТАДИОН'), 24, 1.1, { x: x0 + 0.9, z: zc }, H + 0.65, FACE_W, { cutout: true, maxPx: 1024 });
  panelAt(b, emblemTex(), 2.6, 2.6, { x: x0 - 0.1, z: zc }, 4.3, FACE_W, { cutout: true });
  // the honours board by the doors, under glass
  const hz = z0 + 0.9;
  panelAt(b, boardTex('honours', ['ФК «АКТОБЕ»', 'основан в 1967 году', 'Чемпион Казахстана 2005', 'Қазақстан чемпионы 2005'],
    { bg: '#7a1a1f', fg: '#f2e2b8', w: 512, h: 640, border: '#e3cc8e', sizes: [1.4, 0.8, 1, 1], wear: 0.2 }), 1.2, 1.5, { x: x0 - 0.12, z: hz }, 1.0, FACE_W);
  b.span(x0 - 0.2, 0.9, hz - 0.7, x0 - 0.05, 2.6, hz + 0.7, 0x4a3a2a, { cast: false });
  ctx.interact({
    x: x0 - 0.8, y: 1.7, z: hz, w: 1.2, h: 1.4, d: 1.8,
    label: 'Read the honours board',
    action: (game) => {
      game.hud.sms('ФК «Актобе»', 'Основан в 1967 году как «Актюбинец», в 1996–97 «Актобемунай», с 1997 года «Актобе». Чемпион Казахстана 2005 года. Цвета клуба: красный и белый. Стадион открыт 28 августа 1975 года матчем с московским ЦСКА.', 9000);
      game.audio.play('paper', { volume: 0.5 });
    },
  });
  // champions' banners down the back of the main stand, either side of the entrance
  const s = STANDS.west;
  for (const dz of [-20, -14, 14, 20]) {
    const tex = boardTex(`champ-${dz > 0 ? 'kz' : 'ru'}`, dz > 0 ? ['ҚАЗАҚСТАН', 'ЧЕМПИОНЫ', '2005'] : ['ЧЕМПИОН', 'КАЗАХСТАНА', '2005'],
      { bg: '#c0242a', fg: '#ffffff', w: 256, h: 768, sizes: [1, 1, 1.6], wear: 0.15 });
    panelAt(b, tex, 2.2, 6.6, { x: s.origin.x - s.depth - 0.08, z: zc + dz }, 2.4, FACE_W);
  }
}

/** The main gate in the railings opposite the entrance: two pillars and open steel leaves. */
function mainGate(ctx) {
  const { batch: b, colliders } = ctx;
  const x = RAIL.x0, zc = (LOBBY.z0 + LOBBY.z1) / 2;
  const half = (LOBBY.z1 - LOBBY.z0) / 2 + 1;
  for (const s of [-1, 1]) {
    const z = zc + s * half;
    b.box(1.2, 3.4, 1.2, 0xd8d2c4, x, 0, z);
    b.box(1.4, 0.25, 1.4, COL.red, x, 3.4, z, { closed: true });
    colliders.box(x - 0.6, z - 0.6, x + 0.6, z + 0.6, { tag: 'pillar' });
    panelAt(b, emblemTex(), 0.9, 0.9, { x: x - 0.61, z }, 2.0, FACE_W, { cutout: true });
    // gate leaves, swung open against the railings
    for (const k of [0.6, 1.9]) {
      const zz = z - s * (0.7 + k * 0.1);
      b.box(0.06, 2.0, 1.3, COL.paintGreen, x + 0.7 + k * 0.9, 0, zz, { ry: 0, cast: false });
    }
  }
}

/* ---------------- ticket booths ---------------- */

function kassa(ctx, x, z, state) {
  const { batch: b, colliders } = ctx;
  const w = 3.2, d = 4.4, h = 2.9;
  b.box(w, h, d, 0xe8e2d4, x, 0, z);
  b.box(w + 0.5, 0.3, d + 0.5, 0x2d5a8a, x, h, z, { closed: true });
  b.box(w - 0.3, 0.12, d - 0.3, COL.white, x, h + 0.3, z);
  // two windows on the street side, each with a grille and a slot
  for (const dz of [-1, 1]) {
    const wz = z + dz * 1.0;
    b.span(x - w / 2 - 0.04, 1.0, wz - 0.45, x - w / 2 + 0.01, 1.9, wz + 0.45, 0x3a4a54, { mat: 'glass' });
    for (let k = -2; k <= 2; k++) b.span(x - w / 2 - 0.07, 1.0, wz + k * 0.18 - 0.012, x - w / 2 - 0.04, 1.9, wz + k * 0.18 + 0.012, 0x3a3c3e, { cast: false });
    b.span(x - w / 2 - 0.35, 0.95, wz - 0.5, x - w / 2, 1.0, wz + 0.5, 0xb8b4aa);
  }
  colliders.box(x - w / 2, z - d / 2, x + w / 2, z + d / 2, { top: h + 0.4, tag: 'kassa' });
  panelAt(b, boardTex('kassa', ['КАССА'], { bg: '#2d5a8a', fg: '#ffffff', w: 512, h: 128, border: '#ffffff', wear: 0.3 }), 2.6, 0.65, { x: x - w / 2 - 0.26, z }, h + 0.05, FACE_W);
  panelAt(b, boardTex('kassa-hours', ['Билеты на матчи', 'Суперлиги', 'Касса: 10:00 – 18:00', 'Перерыв 13:00 – 14:00'],
    { bg: '#f2efe8', fg: '#2a2624', w: 384, h: 384, border: '#2d5a8a', sizes: [1.2, 1.2, 1, 1] }), 0.7, 0.7, { x: x - w / 2 - 0.02, z: z - 1.8 }, 1.3, FACE_W);
  panelAt(b, posterTex(), 0.6, 0.9, { x: x - w / 2 - 0.02, z: z + 1.75 }, 1.1, FACE_W);
  ctx.interact({
    x: x - w / 2 - 0.5, y: 1.4, z, w: 0.9, h: 1.2, d: 2.8,
    label: () => (state.ticket ? 'Look at your ticket' : `Buy a ticket · Актобе – Кайрат · ${TICKET_PRICE} ₸`),
    action: (game) => {
      if (!state.ticket) {
        if (!game.pay(TICKET_PRICE, 'a ticket')) return;
        const r = rngKit(Math.floor(game.time * 7) + 3);
        const stand = r.pick(['Восточная', 'Северная', 'Южная']);
        state.ticket = `${stand} трибуна, сектор ${r.int(1, 7)}, ряд ${r.int(1, 20)}, место ${r.int(1, 40)}`;
        game.audio.play('kioskWindow', { volume: 0.8 });
      }
      game.hud.sms('Билет · Центральный стадион', `«${MATCH.home}» — «${MATCH.away}», ${MATCH.date}, ${MATCH.time}. ${state.ticket}. Цена ${TICKET_PRICE} тг. Сохраняйте билет до конца матча.`, 8000);
    },
  });
}

/* ---------------- poster columns ---------------- */

function tumba(ctx, x, z) {
  const { batch: b, colliders } = ctx;
  b.cyl(0.8, 0.25, 0x8a8478, x, 0, z, { seg: 16 });
  const m = new THREE.Matrix4().compose(
    new THREE.Vector3(x, 0.25 + 1.25, z),
    new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI * 0.75),
    new THREE.Vector3(1, 1, 1),
  );
  atlasAdd(b, tumbaTex(), new THREE.CylinderGeometry(0.7, 0.7, 2.5, 20, 1, true), m);
  b.cyl(0.78, 0.18, 0x6a1418, x, 2.75, z, { seg: 16 });
  b.add(new THREE.SphereGeometry(0.72, 16, 6, 0, Math.PI * 2, 0, Math.PI / 2).scale(1, 0.45, 1).translate(x, 2.93, z), { color: 0x7a1a1f });
  b.cyl(0.05, 0.35, 0x7a1a1f, x, 3.2, z, { seg: 6 });
  colliders.circle(x, z, 0.8, { tag: 'tumba' });
  ctx.interact({
    x, y: 1.6, z, w: 1.8, h: 1.6, d: 1.8,
    label: 'Read the match poster',
    action: (game) => {
      game.hud.sms('Суперлига 2007', `«${MATCH.home}» — «${MATCH.away}» (${MATCH.awayCity}). ${MATCH.date}, ${MATCH.day}, начало в ${MATCH.time}. Центральный стадион. ${MATCH.prices}. Касса у главного входа.`, 8000);
      game.audio.play('paper', { volume: 0.5 });
    },
  });
}

/* ---------------- flags ---------------- */

const FLAG = { w: 2.4, h: 1.2, pole: 10 };

function flagpole(ctx, x, z) {
  const { batch: b, colliders } = ctx;
  const H = FLAG.pole;
  b.cyl(0.07, H, 0xd8dcde, x, 0, z, { seg: 8, rTop: 0.045 });
  b.add(new THREE.SphereGeometry(0.1, 8, 6).translate(x, H + 0.05, z), { color: 0xd8b84a });
  b.cyl(0.35, 0.25, 0x9a958a, x, 0, z, { seg: 10 });
  colliders.circle(x, z, 0.35, { tag: 'flagpole' });
}

/**
 * All the flags as one mesh that waves: the republic's flag and the
 * club's share one small texture (top and bottom half), each flag is a
 * block of vertices whose distance from its pole drives the ripple.
 */
function flagCloth(ctx, poles) {
  const tex = canvasTex(512, 512, (c) => {
    c.drawImage(flagTex().image, 0, 0, 512, 256);
    c.drawImage(clubFlagTex().image, 0, 256, 512, 256);
  });
  const parts = poles.map(({ x, z, kz }) => {
    const g = new THREE.PlaneGeometry(FLAG.w, FLAG.h, 14, 6);
    g.translate(FLAG.w / 2 + x + 0.06, FLAG.pole - 0.2 - FLAG.h / 2, z);
    const uv = g.attributes.uv;
    for (let i = 0; i < uv.count; i++) uv.setY(i, uv.getY(i) * 0.5 + (kz ? 0.5 : 0));
    return g;
  });
  const geo = mergeGeometries(parts, false);
  parts.forEach((g) => g.dispose());
  const mesh = new THREE.Mesh(geo, cel({ map: tex, side: THREE.DoubleSide, grime: 0, dirt: 0, cache: false, bands: 3 }));
  mesh.castShadow = true;
  mesh.name = 'stadium-flags';
  ctx.root.add(mesh);
  const base = Float32Array.from(geo.attributes.position.array);
  const per = geo.attributes.position.count / poles.length;
  const centre = { x: poles[0].x, z: poles[Math.floor(poles.length / 2)].z };
  return (t, cam) => {
    if (Math.abs(centre.x - cam.x) > 160 || Math.abs(centre.z - cam.z) > 160) return;
    const a = geo.attributes.position.array;
    for (let f = 0; f < poles.length; f++) {
      const { x, z } = poles[f];
      const phase = x * 0.37 + z * 0.11;
      for (let i = f * per; i < (f + 1) * per; i++) {
        const u = base[i * 3] - x - 0.06, k = u / FLAG.w;
        a[i * 3 + 2] = base[i * 3 + 2] + Math.sin(u * 2.6 - t * 5.2 + phase) * 0.16 * k + Math.sin(u * 5.1 - t * 8.3) * 0.04 * k;
        a[i * 3 + 1] = base[i * 3 + 1] - k * k * 0.08;
      }
    }
    geo.attributes.position.needsUpdate = true;
    geo.computeVertexNormals();
  };
}

/* ---------------- sitting in the stands ---------------- */

function seatsToSit(ctx) {
  const spots = [
    ['west', 10, STANDS.west.len / 2 + 2, 'Sit in the VIP seats'],
    ['west', 21, STANDS.west.len / 2 - 22, 'Sit in the main stand'],
    ['east', 6, 40, 'Sit in the east stand'],
    ['north', 8, 20, 'Sit on the bench'],
  ];
  for (const [key, r, along, label] of spots) {
    const s = STANDS[key];
    const p = standToWorld(s, r * ROW.depth + 0.42, along);
    const y = FRONT_H + r * ROW.rise;
    // you sit facing the pitch
    const facing = s.yaw + Math.PI / 2;
    ctx.interact({
      x: p.x, y: y + 0.6, z: p.z, w: 0.8, h: 0.8, d: 0.8, label,
      action: (game) => game.setController(sitController(game, p.x, p.z, facing, y + 0.02)),
    });
  }
}

export function buildFront(ctx) {
  lobby(ctx);
  mainGate(ctx);
  const state = { ticket: null };
  const gz = GATES.filter((g) => g.side === 'w').map((g) => g.z);
  kassa(ctx, 14, gz[0] + 12, state);
  kassa(ctx, 14, gz[1] - 12, state);
  tumba(ctx, B.x0 + 9, gz[0] + 26);
  tumba(ctx, B.x0 + 9, gz[1] - 26);
  // flags along the street edge of the forecourt: the republic in the middle, the club either side
  const zc = (LOBBY.z0 + LOBBY.z1) / 2;
  const poles = [-12, -6, 0, 6, 12].map((dz) => ({ x: B.x0 + 5, z: zc + dz, kz: dz === 0 }));
  poles.forEach((p) => flagpole(ctx, p.x, p.z));
  const wave = flagCloth(ctx, poles);
  seatsToSit(ctx);
  let t = 0;
  ctx.update((dt, game) => {
    t += dt;
    wave(t, game.camera.position);
  });
}
