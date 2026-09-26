import * as THREE from 'three';
import { rngKit } from '../../core/util.js';
import { makeAircraft } from './aircraft.js';
import { makeLights, setLightView } from './lights.js';
import { createTug } from './tug.js';
import { STANDS } from './layout.js';
import { arrivalLegs, taxiInLeg, departureLegs, standStop } from './movements.js';
import { newMove, legOf, stepMove, pose, lights, sound } from './mover.js';
import './sounds.js';

/* ------------------------------------------------------------------ *
 * The flights system: the airport's aircraft, parked and moving.
 *
 * Six airframes rotate through four stands. Arrivals and departures
 * take turns. A departure needs the apron and the taxiway to itself; an
 * arrival may set off while a departure is already rolling, since it is
 * two minutes out and the runway will be clear by then. So something is
 * on the move most of the time, and a landing or a take-off comes every
 * few minutes.
 *
 * Dev: __city.plane('arrival' | 'departure', skipSeconds, reg?) starts
 * one now (finishing any in progress), optionally with a given
 * airframe; game.flights.state() says where it is.
 * ------------------------------------------------------------------ */

/** The June 2007 fleet through Aktobe. Flight numbers and routes are flavour. */
const FLEET = [
  { type: 'b757', liv: 'airAstana', reg: 'P4-EAS', flight: 'KC 941', city: 'Алматы' },
  { type: 'tu134', liv: 'euroAsia', reg: 'UP-T3406', flight: '5B 322', city: 'Москва' },
  { type: 'an24', liv: 'scat', reg: 'UP-AN428', flight: 'DV 708', city: 'Уральск' },
  { type: 'f50', liv: 'airAstana', reg: 'P4-HAR', flight: 'KC 915', city: 'Атырау' },
  { type: 'yak42', liv: 'scat', reg: 'UP-Y4204', flight: 'DV 721', city: 'Шымкент' },
  { type: 'b737', liv: 'starline', reg: 'UP-B3703', flight: 'SL 103', city: 'Астана' },
];

const FIRST = 35;                 // seconds before the first movement
const GAP = [30, 75];             // seconds of quiet after the apron empties
const AFTER_ROLL = [6, 20];       // an arrival sets off this soon after a take-off roll starts

export function createFlights(game) {
  const root = new THREE.Group();
  root.name = 'flights';
  game.scene.add(root);
  const rng = rngKit(2007);
  const tug = createTug(root);

  const planes = FLEET.map((f) => {
    const a = makeAircraft(f.type, f.liv, f.reg);
    a.group.rotation.order = 'YXZ';
    const lightSet = makeLights(a.lights);
    a.group.add(lightSet.points);
    lightSet.set({});
    return { ...f, a, lights: lightSet, stand: null, since: 0 };
  });

  /* ---------------- stands ---------------- */

  const moves = [];
  const moving = (p) => moves.some((m) => m.plane === p);

  function park(p, stand) {
    p.stand = stand;
    p.since = game.time;
    root.add(p.a.group);
    p.a.group.position.set(stand.x, 0, standStop(p.a.type, stand));
    p.a.group.rotation.set(0, 0, 0);
    p.a.setGear(true);
    p.a.spin(0, 0);
    p.lights.set({});
  }
  const occupied = () => planes.filter((p) => p.stand);
  const freeStands = () => STANDS.filter((s) => !planes.some((p) => p.stand === s) && !moves.some((m) => m.kind === 'arrival' && m.stand === s));
  const pool = () => planes.filter((p) => !p.stand && !moving(p));

  // at the start: the An-24, the Tu-134 and the 757 are on stands 1 to 3
  park(planes[2], STANDS[0]);
  park(planes[1], STANDS[1]);
  park(planes[0], STANDS[2]);

  /* ---------------- scheduling ---------------- */

  let timer = FIRST;
  let nextKind = 'arrival';
  let devMove = null;              // a movement started from the console plays alone

  function canStart(kind) {
    if (devMove) return false;
    if (!moves.length) return true;
    // an arrival may follow a departure that is already on its take-off roll
    return kind === 'arrival' && moves.length === 1 && moves[0].kind === 'departure' && moves[0].rolling;
  }

  function start(kind, reg = null) {
    let m;
    if (kind === 'arrival') {
      const stand = freeStands()[0];
      const candidates = pool();
      if (!stand || !candidates.length) return false;
      const plane = candidates.find((p) => p.reg === reg) || candidates[0];
      m = newMove('arrival', plane, [...arrivalLegs(plane.a.type).legs, taxiInLeg(plane.a.type, stand)], stand);
      m.v = 84;
      root.add(plane.a.group);
    } else {
      const list = occupied().sort((a, b) => a.since - b.since);
      if (!list.length) return false;
      const plane = list.find((p) => p.reg === reg) || list[0];
      const stand = plane.stand;
      plane.stand = null;
      m = newMove('departure', plane, departureLegs(plane.a.type, stand).legs, stand);
    }
    const voice = m.plane.a.type.sound === 'prop' ? 'propEngine' : 'jetEngine';
    m.sound = game.audio?.loop(voice, { volume: 0, rate: 0.2, pos: { x: 0, y: 0, z: 0 } }) || null;
    moves.push(m);
    nextKind = kind === 'arrival' ? 'departure' : 'arrival';
    return true;
  }

  function finish(m) {
    const p = m.plane;
    if (m.kind === 'arrival') park(p, m.stand);
    else {
      root.remove(p.a.group);
      p.lights.set({});
    }
    m.sound?.stop();
    moves.splice(moves.indexOf(m), 1);
    if (m === devMove) devMove = null;
    if (!moves.length) timer = rng.range(GAP[0], GAP[1]);
  }

  const log = { landings: [], takeoffs: [] };
  const hooks = {
    tugAttached: () => tug.attached,
    event(name, m) {
      if (name === 'tugAttach') tug.fetch(m.plane.a);
      if (name === 'tugRelease') tug.release();
      if (name === 'touchdown') {
        log.landings.push(Math.round(game.time));
        game.audio?.play('tyreChirp', { pos: m.plane.a.group.position });
      }
      if (name === 'liftoff') log.takeoffs.push(Math.round(game.time));
    },
  };

  /* ---------------- the system ---------------- */

  function update(dt, quiet = false) {
    if (timer > 0) timer -= dt;
    else if (canStart(nextKind) && !start(nextKind)) {
      // no free stand or no aircraft for this kind: try the other
      const other = nextKind === 'arrival' ? 'departure' : 'arrival';
      if (canStart(other)) start(other);
    }
    const cam = game.camera.position;
    for (const m of [...moves]) {
      if (stepMove(m, dt, hooks)) { finish(m); continue; }
      const leg = legOf(m);
      if (leg && leg.mode === 'roll' && !m.rolling) {
        m.rolling = true;
        timer = rng.range(AFTER_ROLL[0], AFTER_ROLL[1]);
      }
      pose(m, dt);
      lights(m, game.time, cam);
      if (!quiet) sound(m, cam);
    }
    tug.update(dt);
    setLightView(game.renderer.domElement.height, game.scene.fog ? game.scene.fog.far : 1100);
  }

  function describe(m) {
    const g = m.plane.a.group.position;
    const leg = legOf(m);
    return {
      kind: m.kind, reg: m.plane.reg, type: m.plane.a.type.name, leg: m.i, mode: leg?.mode,
      x: +g.x.toFixed(1), y: +g.y.toFixed(1), z: +g.z.toFixed(1), v: +m.v.toFixed(1),
    };
  }

  const api = {
    update,
    /** Game times of every touchdown and lift-off so far (for tests). */
    log,
    /** Start a movement now, finishing any in progress; optionally fast-forward it. */
    spawn(kind = 'arrival', { skip = 0, reg = null } = {}) {
      while (moves.length) finish(moves[0]);
      tug.reset();
      if (kind === 'arrival' && !freeStands().length) {
        // all stands full: send the longest-parked airframe away to make room
        const p = occupied().sort((a, b) => a.since - b.since)[0];
        p.stand = null;
        root.remove(p.a.group);
      }
      if (!start(kind, reg)) return false;
      const m = moves[moves.length - 1];
      devMove = m;                       // nothing else starts while a dev movement plays
      for (let t = 0; t < skip && moves.includes(m); t += 0.1) update(0.1, true);
      return true;
    },
    /** The newest movement, or what comes next. */
    state() {
      if (!moves.length) return { kind: null, next: nextKind, in: +timer.toFixed(1), parked: occupied().map((p) => p.reg) };
      return describe(moves[moves.length - 1]);
    },
    /** Lines for the departures and arrivals board in the terminal. */
    board() {
      const dep = moves.filter((m) => m.kind === 'departure').map((m) => ({ flight: m.plane.flight, city: m.plane.city, status: 'Вылетает' }));
      occupied().sort((a, b) => a.since - b.since).forEach((p, i) => {
        dep.push({ flight: p.flight, city: p.city, status: i === 0 && !dep.length ? 'Посадка' : 'Регистрация' });
      });
      const arr = moves.filter((m) => m.kind === 'arrival').map((m) => ({
        flight: m.plane.flight, city: m.plane.city, status: m.i >= 3 ? 'Прибыл' : 'Заходит на посадку',
      }));
      pool().forEach((p) => arr.push({ flight: p.flight, city: p.city, status: 'Ожидается' }));
      return { dep, arr };
    },
  };

  // dev hook, once main.js has made __city
  setTimeout(() => {
    if (typeof window !== 'undefined' && window.__city) {
      window.__city.plane = (kind, skip = 0, reg = null) => api.spawn(kind, { skip, reg });
    }
  }, 0);
  return api;
}
