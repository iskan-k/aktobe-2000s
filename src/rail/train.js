import * as THREE from 'three';
import './sounds.js';
import { rngKit } from '../core/util.js';
import { bakeType, AXLES, BODY } from './rolling.js';
import { createFleet } from './fleet.js';
import { SERVICES } from './services.js';
import { createLamps, LAMP } from './lamps.js';
import { createCrossing } from './crossing.js';
import { signalLamps } from './track.js';
import {
  REACH, JOINT, PLATFORM, PLATFORM_MID, CROSSING, SIGNAL_POSTS, TRACK_OF,
  clockSeconds, clockText,
} from './layout.js';

/* ------------------------------------------------------------------ *
 * The railway system: a train every one to two minutes, passenger and
 * freight in turn, each way in turn. Passenger trains run on the track
 * by the platform and most of them call for half a minute or so; freight
 * trains take the far track. Trains come in at one portal and leave by
 * the other.
 *
 * It also works the level crossing (lights 25 s ahead of a train, 12 s
 * ahead of one leaving the platform, arms down, road traffic held at the
 * stop lines, the bell), the colour-light signals, and the sounds: the
 * diesel drone, the two-tone horn, wheels over rail joints, the station
 * chime.
 *
 * API (game.rail): update(dt), trains, upcoming(n), spawn(kind, dir, o),
 * crossing (its phase).
 * ------------------------------------------------------------------ */

const HEADWAY = [150, 260];      // s between trains: each one shuts the crossing for about a minute
const FIRST = 12;
const CRUISE = { passenger: 15, freight: 16.5 };
const DECEL = 0.45;
const ACCEL = 0.4;
const DWELL = [30, 60];
const PASS_EVERY = 4;            // one passenger train in four runs through without calling
const CROSS_MARGIN = CROSSING.outer + 2;
const CLEAR_X = CROSSING.x - CROSSING.outer - 6;   // stopped trains keep the crossing clear
const CLACK_RANGE = 35;

/*
 * Passenger and freight in turn, so consecutive trains use different
 * tracks; each kind alternates its direction: P east, F west, P west,
 * F east, and round again.
 */
const PATTERN = [['passenger', 1], ['freight', -1], ['passenger', -1], ['freight', 1]];
const HORN_DANGER = 180;
// feet above the tallest body are overhead (the footbridge), not on the line
const TRAIN_ROOF = Math.max(...Object.values(BODY).map(([, top]) => top));
const atTrackLevel = (p) => p.y < TRAIN_ROOF;


/* ---------------- composition ---------------- */

function compose(rng, kind) {
  const loco = rng.chance(0.5) ? 'loco_green' : 'loco_blue';
  const cars = [{ type: loco, flip: false }, { type: loco, flip: true }];
  if (kind === 'passenger') {
    const main = rng.chance(0.55) ? 'coach_grey' : 'coach_green';
    const odd = main === 'coach_grey' ? 'coach_green' : 'coach_grey';
    const n = rng.int(10, 14);
    for (let i = 0; i < n; i++) cars.push({ type: rng.chance(0.12) ? odd : main, flip: false });
  } else {
    const n = rng.int(30, 50) + 2;
    while (cars.length < n) {
      const type = rng.weighted([['gondola', 4], ['tank', 3], ['hopper', 2], ['boxcar', 2]]);
      const run = rng.int(3, 10);
      for (let i = 0; i < run && cars.length < n; i++) cars.push({ type, flip: rng.chance(0.5) });
    }
  }
  let off = 0;
  for (const c of cars) {
    c.len = bakeType(c.type).length;
    c.off = off + c.len / 2;
    off += c.len;
  }
  return { cars, length: off };
}

/** Head position for a train that stops with its middle by the platform. */
function stopHead(dir, length) {
  if (dir > 0) return Math.min(PLATFORM_MID + length / 2, CLEAR_X);
  return Math.min(PLATFORM_MID - length / 2, CLEAR_X - length);
}

/* ---------------- motion ---------------- */

const tailOf = (tr) => tr.head - tr.dir * tr.length;

/** Seconds until the head reaches `d` metres further on, roughly. */
function eta(tr, d) {
  if (d <= 0) return 0;
  const launch = (dist) => Math.sqrt((2 * dist) / ACCEL);
  if (tr.state === 'dwell') return tr.dwellLeft + launch(d);
  if (tr.stop) {
    const toStop = (tr.stop.head - tr.head) * tr.dir;
    if (toStop >= 0 && toStop < d) {
      return toStop / Math.max(tr.v * 0.5, 0.5) + tr.stop.dwell + launch(d - toStop);
    }
  }
  return d / Math.max(tr.v, 1);
}

function move(tr, dt) {
  if (tr.state === 'dwell') {
    tr.dwellLeft -= dt;
    if (tr.dwellLeft <= 0) { tr.state = 'run'; tr.stop = null; tr.departed = true; }
    return;
  }
  let a = ACCEL;
  if (tr.stop) {
    const d = (tr.stop.head - tr.head) * tr.dir;
    const need = (tr.v * tr.v) / (2 * Math.max(d, 0.05));
    if (d < 0.25 && tr.v < 0.6) {
      tr.v = 0;
      tr.head = tr.stop.head;
      tr.state = 'dwell';
      tr.dwellLeft = tr.stop.dwell;
      tr.arrived = true;
      return;
    }
    if (need > DECEL * 0.8 || d < 1) a = -Math.max(need, 0.05);
  }
  tr.v = Math.max(0.3, Math.min(tr.vMax, tr.v + a * dt));
  tr.head += tr.dir * tr.v * dt;
}

/* ---------------- system ---------------- */

export function createRail(game) {
  const root = new THREE.Group();
  root.name = 'rail';
  game.world.root.add(root);
  const rng = rngKit(2007);
  const fleet = createFleet(game, root);
  const lamps = createLamps(root, 48);
  const crossing = createCrossing(game, root, lamps);
  const signals = SIGNAL_POSTS.map((post) => ({
    post, lenses: signalLamps(post).map((l) => lamps.add(l.x, l.y, l.z, l.yaw, 0.11)),
  }));

  const trains = [];
  const plan = [];
  const later = [];
  let serial = 0;
  let passengers = 0;
  let lastAt = 0;

  function planNext() {
    const [kind, dir] = PATTERN[serial % PATTERN.length];
    serial++;
    const at = serial === 1 ? FIRST : lastAt + rng.range(HEADWAY[0], HEADWAY[1]);
    lastAt = at;
    if (kind === 'passenger') passengers++;
    const stops = kind === 'passenger' && passengers % PASS_EVERY !== 0;
    plan.push({ kind, dir, at, stops, name: kind === 'passenger' ? rng.pick(SERVICES[dir]) : 'грузовой', dwell: rng.range(DWELL[0], DWELL[1]) });
  }
  while (plan.length < 4) planNext();

  function sound(name, pos, opts = {}, delay = 0) {
    if (delay > 0) later.push({ t: delay, name, pos: { ...pos }, opts });
    else game.audio.play(name, { pos, ...opts });
  }

  /** Two-tone blast: `pattern` is a list of [tone, seconds]. */
  function horn(tr, pattern) {
    const pos = { x: tr.head, y: 5, z: tr.z };
    let t = 0;
    for (const [tone, dur] of pattern) {
      sound('trainHorn', pos, { tone, dur, volume: 1 }, t);
      t += dur + 0.12;
    }
  }

  function spawn(kind, dir, o = {}) {
    const { cars, length } = compose(rng, kind);
    const z = TRACK_OF[kind];
    const tr = {
      kind, dir, z, cars, length,
      name: o.name || (kind === 'passenger' ? rng.pick(SERVICES[dir]) : 'грузовой'),
      head: o.head ?? -dir * REACH,
      v: o.v ?? CRUISE[kind],
      vMax: CRUISE[kind] * rng.range(0.92, 1.05),
      state: 'run', dwellLeft: 0,
      stop: null, arrived: false, departed: false,
      flags: new Set(),
      prevHead: 0, dangerT: 0,
      engine: game.audio.loop('diesel', { pos: { x: 0, y: 4, z }, volume: 1, rate: 1 }),
    };
    const stops = o.stops ?? kind === 'passenger';
    if (stops) tr.stop = { head: stopHead(dir, length), dwell: o.dwell ?? rng.range(DWELL[0], DWELL[1]) };
    if (o.dwelling && tr.stop) {
      tr.head = tr.stop.head;
      tr.v = 0;
      tr.state = 'dwell';
      tr.dwellLeft = tr.stop.dwell;
      tr.arrived = true;
    }
    tr.prevHead = tr.head;
    trains.push(tr);
    return tr;
  }

  const trackBusy = (z) => trains.some((t) => t.z === z);

  function schedule() {
    const next = plan[0];
    if (!next || game.time < next.at) return;
    if (trackBusy(TRACK_OF[next.kind])) { next.at = game.time + 5; return; }
    plan.shift();
    spawn(next.kind, next.dir, { stops: next.stops, name: next.name, dwell: next.dwell });
    while (plan.length < 4) planNext();
  }

  /* ---- crossing, signals ---- */

  function crossingWanted() {
    for (const tr of trains) {
      const dHead = (CROSSING.x - tr.head) * tr.dir;
      const dTail = (CROSSING.x - tailOf(tr)) * tr.dir;
      if (dHead <= CROSS_MARGIN && dTail > -CROSS_MARGIN) return true;
      const warn = tr.state === 'dwell' ? CROSSING.warnDepart : CROSSING.warn;
      if (dHead > CROSS_MARGIN && eta(tr, dHead - CROSS_MARGIN) < warn) return true;
    }
    return false;
  }

  function aspect(post) {
    const tr = trains.find((t) => t.z === post.track && t.dir === post.dir);
    if (!tr) return LAMP.red;
    const d = (post.x - tr.head) * tr.dir;
    if (d < 0) return LAMP.red;
    if (tr.state === 'dwell') return tr.dwellLeft > 6 ? LAMP.red : LAMP.green;
    if (tr.stop && (tr.stop.head - post.x) * tr.dir < 0) return LAMP.yellow;
    return LAMP.green;
  }

  function lightSignals() {
    for (const s of signals) {
      const a = aspect(s.post);
      lamps.set(s.lenses[0], a === LAMP.yellow ? LAMP.yellow : LAMP.off);
      lamps.set(s.lenses[1], a === LAMP.green ? LAMP.green : LAMP.off);
      lamps.set(s.lenses[2], a === LAMP.red ? LAMP.red : LAMP.off);
    }
  }

  /* ---- sounds ---- */

  function listener() {
    return game.camera?.position || game.player.pos;
  }

  function clatter(tr, L) {
    if (tr.v < 0.5 || Math.abs(L.z - tr.z) > 60) return;
    const vol = Math.min(1, 0.35 + tr.v / 18);
    for (const car of tr.cars) {
      const cx = tr.head - tr.dir * car.off;
      if (Math.abs(cx - L.x) > CLACK_RANGE + car.len) continue;
      const flip = car.flip ? -1 : 1;
      for (const a of AXLES[car.type]) {
        // local -z is the front; the axle's distance behind the head
        const behind = car.off + a * flip;
        const x1 = tr.head - tr.dir * behind, x0 = tr.prevHead - tr.dir * behind;
        const j0 = Math.floor(x0 / JOINT), j1 = Math.floor(x1 / JOINT);
        if (j0 === j1) continue;
        const jx = Math.max(j0, j1) * JOINT;
        if (Math.abs(jx - L.x) > CLACK_RANGE) continue;
        game.audio.play('clack', { pos: { x: jx, y: 0.3, z: tr.z }, volume: vol });
      }
    }
  }

  function hornCues(tr, dt) {
    const toCross = (CROSSING.x - tr.head) * tr.dir;
    const once = (flag, fn) => { if (!tr.flags.has(flag)) { tr.flags.add(flag); fn(); } };
    if (toCross < 230 && toCross > 200) once('approach', () => horn(tr, [['low', 1.4], ['high', 0.9]]));
    if (toCross < 70 && toCross > 40 && tr.v > 3) once('crossing', () => horn(tr, [['high', 0.45], ['high', 0.45]]));
    if (tr.kind === 'passenger') {
      const toPlat = (PLATFORM_MID - tr.dir * (PLATFORM.x1 - PLATFORM.x0) / 2 - tr.head) * tr.dir;
      if (toPlat < 120 && toPlat > 0) once('station', () => horn(tr, [['low', 0.8]]));
      if (tr.stop && eta(tr, (tr.stop.head - tr.head) * tr.dir) < 40) {
        once('chime', () => sound('chime', { x: PLATFORM_MID, y: 5, z: PLATFORM.z0 + 3 }, { volume: 1 }));
      }
    }
    if (tr.departed) once('depart', () => horn(tr, [['high', 0.35], ['low', 0.9]]));
    // somebody on the line ahead: keep blowing
    tr.dangerT -= dt;
    const p = game.controller ? null : game.player.pos;
    if (p && atTrackLevel(p) && tr.v > 2 && Math.abs(p.z - tr.z) < 2.2 && tr.dangerT <= 0) {
      const ahead = (p.x - tr.head) * tr.dir;
      if (ahead > 0 && ahead < HORN_DANGER) { horn(tr, [['low', 1.0], ['high', 1.0]]); tr.dangerT = 3; }
    }
    // the engine drone
    const rate = tr.state === 'dwell' ? 0.35 : tr.v < tr.vMax - 0.5 ? 1.4 : 1.0;
    tr.engine.set({ pos: { x: tr.head - tr.dir * 12, y: 4, z: tr.z }, rate, volume: 1 });
  }

  /** A moving train shoves you clear rather than carrying you along. */
  function jumpClear(tr) {
    if (game.controller || tr.v < 0.5) return;
    const p = game.player.pos;
    if (!atTrackLevel(p)) return;
    if (Math.abs(p.z - tr.z) > BODY.loco_green[0] + 0.4) return;
    const front = tr.head + tr.dir * 0.8, back = tailOf(tr);
    if ((p.x - back) * tr.dir < 0 || (p.x - front) * tr.dir > 0) return;
    const side = p.z < tr.z ? -1 : 1;
    game.player.placeAt(p.x, tr.z + side * 3.0, game.player.yaw, game.player.pitch);
    game.hud.flash('Осторожно, поезд! You jump clear just in time.', 2200);
  }

  function pump(dt) {
    for (let i = later.length - 1; i >= 0; i--) {
      const s = later[i];
      s.t -= dt;
      if (s.t <= 0) { game.audio.play(s.name, { pos: s.pos, ...s.opts }); later.splice(i, 1); }
    }
  }

  const api = {
    trains,
    get crossing() { return crossing.phase; },
    spawn,
    /** The next `n` trains at the station: [{ time, name, kind, track, stops }]. */
    upcoming(n = 3) {
      const now = clockSeconds(game);
      const out = [];
      const track = (kind) => (kind === 'passenger' ? 1 : 2);
      for (const tr of trains) {
        if (tr.state === 'dwell') {
          out.push({ time: clockText(now + tr.dwellLeft), name: tr.name, kind: tr.kind, track: 1, stops: true, here: true });
          continue;
        }
        const d = (PLATFORM_MID - tr.head) * tr.dir;
        if (d < 0) continue;
        out.push({ time: clockText(now + eta(tr, d)), name: tr.name, kind: tr.kind, track: track(tr.kind), stops: !!tr.stop, here: false });
      }
      for (const p of plan) {
        const t = p.at - game.time + (REACH + PLATFORM_MID * p.dir) / CRUISE[p.kind];
        out.push({ time: clockText(now + Math.max(0, t)), name: p.name, kind: p.kind, track: track(p.kind), stops: p.stops, here: false });
      }
      return out.slice(0, n);
    },
    update(dt) {
      schedule();
      const L = listener();
      for (const tr of trains) {
        tr.prevHead = tr.head;
        move(tr, dt);
        clatter(tr, L);
        hornCues(tr, dt);
        jumpClear(tr);
      }
      for (let i = trains.length - 1; i >= 0; i--) {
        const tr = trains[i];
        if (tailOf(tr) * tr.dir > REACH + 5) {
          tr.engine.stop();
          trains.splice(i, 1);
        }
      }
      pump(dt);
      crossing.update(dt, crossingWanted());
      lightSignals();
      fleet.draw(trains, L);
      fleet.collide(trains, game.controller?.pos || game.player.pos);
    },
  };
  return api;
}
