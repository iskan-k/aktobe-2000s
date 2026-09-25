import * as THREE from 'three';
import { clamp, damp } from '../core/util.js';
import { pushCircle } from '../core/physics.js';
import { STOPS, FARES } from '../world/plan.js';

/* ------------------------------------------------------------------ *
 * Riding public transport.
 *
 *   Buses (№4, №17 PAZ) and trolleybus №1 stop only at their stops. Stand at the
 *   shelter; when one pulls in and opens its doors, look at it and press
 *   E to board. The fare goes in the driver's tray.
 *
 *   Marshrutkas (№44, №31) stop anywhere. Look at one coming along your
 *   side of the street and press E to wave it down; it pulls in beside
 *   you. Inside, press E to call "Остановите здесь!" and it lets you out
 *   at the next safe spot. On a bus, E asks for the next stop.
 *
 * While riding, the camera sits in a seat (or stands at a pole) and the
 * mouse looks around. The next stop is announced on the phone screen.
 * ------------------------------------------------------------------ */

export function createTransit(game) {
  const traffic = game.traffic;
  if (!traffic) return null;
  const routeVehicles = traffic.vehicles.filter((v) => v.route);
  const tmp = new THREE.Vector3();
  const eye = new THREE.Vector3();

  const state = {
    riding: null,        // vehicle
    seat: null,
    lookYaw: 0,
    lookPitch: -0.05,
    wantOff: false,
    boardedAt: 0,
  };

  const fareOf = (v) => FARES[v.route?.kind] ?? FARES[v.kind] ?? 30;
  const nameOf = (v) => {
    const k = v.route?.kind;
    if (k === 'marshrutka') return `marshrutka №${v.route.label}`;
    if (k === 'trolleybus') return `trolleybus №${v.route.label}`;
    return `bus №${v.route.label}`;
  };

  function playerNear(v, r) {
    const p = game.player.pos;
    return (p.x - v.x) ** 2 + (p.z - v.z) ** 2 < r * r;
  }

  function doorWorld(v, i = 0) {
    const d = v.model.doorPos[i] || { x: v.wid / 2 + 0.6, z: 0 };
    const c = Math.cos(v.heading), s = Math.sin(v.heading);
    return { x: v.x + d.x * c + d.z * s, z: v.z - d.x * s + d.z * c };
  }

  function nearestDoorDist(v) {
    const p = game.player.pos;
    let best = Infinity;
    for (let i = 0; i < Math.max(1, v.model.doorPos.length); i++) {
      const d = doorWorld(v, i);
      best = Math.min(best, Math.hypot(d.x - p.x, d.z - p.z));
    }
    return best;
  }

  function canBoard(v) {
    return !state.riding && v.state === 'dwell' && (v.doorT ?? 0) > 0.6 && nearestDoorDist(v) < 3.2;
  }

  function canHail(v) {
    if (state.riding || v.kind !== 'marshrutka' || v.state === 'dwell' || v.hailed) return false;
    if (v.path?.kind !== 'lane') return false;
    // coming toward you on the kerb lane of your side of the street
    const p = game.player.pos;
    const fx = -Math.sin(v.heading), fz = -Math.cos(v.heading);
    const dx = p.x - v.x, dz = p.z - v.z;
    const f = dx * fx + dz * fz;
    const lat = dx * -fz + dz * fx;
    // right-hand side of the vehicle is -lat in this frame... accept either
    // side within reach of the kerb, the driver will pull over to the right
    return f > 8 && f < 70 && Math.abs(lat) < 7.5 && v.path.index === 0;
  }

  /* ---------- interactables on every route vehicle ---------- */
  for (const v of routeVehicles) {
    const m = v.model;
    game.world.ctx.interact({
      parent: m.group,
      x: 0, y: m.height * 0.5, z: 0, w: m.width + 0.6, h: m.height, d: m.length,
      label: () => {
        if (canBoard(v)) return `Board ${nameOf(v)} · ${fareOf(v)} ₸`;
        if (canHail(v)) return `Wave down ${nameOf(v)}`;
        return v.route ? `${nameOf(v)} · ${v.route.via}` : '';
      },
      enabled: () => !state.riding && (canBoard(v) || canHail(v) || playerNear(v, 5)),
      action: () => {
        if (canBoard(v)) board(v);
        else if (canHail(v)) hail(v);
      },
    });
  }

  function hail(v) {
    // stop with the door level with the walker
    const p = game.player.pos;
    const fx = -Math.sin(v.heading), fz = -Math.cos(v.heading);
    const f = (p.x - v.x) * fx + (p.z - v.z) * fz;
    const door = v.model.doorPos[0] || { z: 0 };
    traffic.requestStop(v, v.s + f + door.z);
    game.hud.flash(`${nameOf(v)} is pulling over`);
    game.audio.play('horn', { pos: { x: v.x, y: 1, z: v.z }, dur: 0.12 });
  }

  function board(v) {
    if (!game.pay(fareOf(v), 'the fare')) return;
    state.riding = v;
    const seats = v.model.seats.length ? v.model.seats : [{ x: 0, y: 2.2, z: 0, yaw: 0 }];
    state.seat = seats[(v.passengers++) % seats.length];
    state.lookYaw = state.seat.yaw ?? 0;
    state.lookPitch = -0.05;
    state.wantOff = false;
    state.boardedAt = game.time;
    v.holdDoors = false;
    game.setController(controller);
    const next = nextStopName(v);
    const title = { marshrutka: 'Маршрутка', trolleybus: 'Троллейбус' }[v.route.kind] || 'Автобус';
    game.hud.sms(`${title} №${v.route.label}`,
      `${v.route.via}. ${next ? `Следующая: ${next}.` : ''} E: ${v.kind === 'marshrutka' ? '«Остановите здесь!»' : 'выйти на остановке'}`);
    game.audio.play('sms');
  }

  function nextStopName(v) {
    const ids = v.route.serves.filter((id) => !v.served.has(id));
    const st = STOPS.find((s) => s.id === ids[0]);
    return st ? st.name : null;
  }

  function alight() {
    const v = state.riding;
    if (!v) return;
    // out of the nearest door, onto the kerb
    for (let i = 0; i < Math.max(1, v.model.doorPos.length); i++) {
      const d = doorWorld(v, i);
      const q = { x: d.x, z: d.z };
      const near = game.world.colliders.near(d.x - 1, d.z - 1, d.x + 1, d.z + 1);
      let blocked = false;
      for (const c of near) if (pushCircle(q, 0.3, c, 0)) { blocked = true; break; }
      if (blocked && i < v.model.doorPos.length - 1) continue;
      state.riding = null;
      game.player.placeAt(q.x, q.z, v.heading + state.lookYaw, 0);
      game.setController(null);
      game.hud.flash('Вы вышли · you got off');
      return;
    }
  }

  const controller = {
    name: 'ride',
    crosshair: true,
    get pos() { return state.riding ? { x: state.riding.x, y: 0, z: state.riding.z } : game.player.pos; },
    get yaw() { return state.riding ? state.riding.heading + state.lookYaw : 0; },
    update(dt) {
      const v = state.riding;
      if (!v || v.hidden) {
        // drove out of town with you on board: you get off at the terminus
        if (v) {
          state.riding = null;
          game.player.reset();
          game.setController(null);
          game.hud.flash('Конечная! End of the line.');
        }
        return;
      }
      const { dx, dy } = game.input.takeLook();
      state.lookYaw -= dx;
      state.lookPitch = clamp(state.lookPitch - dy, -1.0, 0.9);
      const g = v.model.group;
      const s = state.seat;
      eye.set(s.x, s.y, s.z);
      // a little sway with the ride
      eye.y += Math.sin(game.time * 7.3) * 0.004 * Math.min(1, v.v / 5);
      tmp.copy(eye).applyEuler(g.rotation).add(g.position);
      game.camera.position.copy(tmp);
      game.camera.rotation.set(state.lookPitch + v.pitch, v.heading + state.lookYaw, v.roll, 'YXZ');

      // let the passenger off when it has stopped for them
      if (state.wantOff && v.state === 'dwell' && (v.doorT ?? 0) > 0.7 && game.time - state.boardedAt > 2) {
        alight();
      }
      // doors wait while you are getting off
      v.holdDoors = state.wantOff && v.state === 'dwell';
    },
    onInteract() {
      const v = state.riding;
      if (!v) return true;
      if (v.state === 'dwell' && (v.doorT ?? 0) > 0.6 && game.time - state.boardedAt > 1.5) {
        alight();
        return true;
      }
      if (state.wantOff) return true;
      state.wantOff = true;
      if (v.kind === 'marshrutka') {
        traffic.requestStop(v, v.s + Math.max(18, v.v * 3));
        game.hud.flash('«Остановите здесь, пожалуйста!»');
      } else {
        const next = nextStopName(v);
        game.hud.flash(next ? `Next stop: ${next}` : 'Next stop, please');
      }
      return true;
    },
    prompt() {
      const v = state.riding;
      if (!v) return null;
      if (v.state === 'dwell' && (v.doorT ?? 0) > 0.6) return 'E · get off';
      if (state.wantOff) return v.kind === 'marshrutka' ? 'pulling over…' : 'getting off at the next stop';
      return v.kind === 'marshrutka' ? 'E · «Остановите здесь!»' : 'E · request the next stop';
    },
    exit() {},
  };

  return {
    get riding() { return state.riding; },
    onArrive(v, stop) {
      if (state.riding === v && stop) {
        game.hud.sms(`№${v.route.label}`, `Остановка «${stop.name}». ${nextStopName(v) ? `Следующая: ${nextStopName(v)}.` : 'Конечная.'}`, 4000);
        game.audio.play('sms');
      }
    },
    update() {},
  };
}
