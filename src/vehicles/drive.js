import * as THREE from 'three';
import { buildVehicle, TYPES } from './catalog.js';
import { pushCircle, rectProbes } from '../core/physics.js';
import { clamp, damp, wrapAngle } from '../core/util.js';
import { onCarriageway, ROADS, halfWidth, BOUNDS } from '../world/plan.js';

/* ------------------------------------------------------------------ *
 * Your car: a VAZ-2107, the "семёрка", in cherry red.
 *
 * V calls it: it turns up parked a few metres from you, off the
 * carriageway where it can. Look at the driver's door and press E to
 * get in, E again (slowly) to get out.
 *
 * Driving is arcade: a bicycle model (heading turns at speed / wheelbase
 * * tan(steer)), steering that tightens at low speed and relaxes at
 * speed, a slow Lada's acceleration, drag, and a brake that becomes
 * reverse once you have stopped. The body is a box of twelve probe
 * points pushed out of walls and traffic; a hard hit costs speed and
 * makes a noise. Kerbs are climbable, and the body pitches and rolls
 * with the four wheel heights.
 *
 * Cameras: chase (default) and driver's seat, toggled with F. The mouse
 * looks around; the chase camera drifts back behind you when you stop.
 * ------------------------------------------------------------------ */

const TOP_SPEED = 31;      // m/s, about 110 km/h: flat out in a семёрка
const REVERSE = 5.5;
const THROTTLE = 3.1;
const BRAKE = 9.5;
const STEER_MAX = 0.6;
const PROBE_R = 0.18;

export function createCar(game) {
  const type = TYPES.lada2107 ? 'lada2107' : 'car';
  const model = buildVehicle(type, { color: 0x7d1d27, seed: 7, plate: 'D 107 KZ', player: true });
  game.scene.add(model.group);
  model.group.visible = false;
  if (model.interior) model.interior.visible = false;

  const car = {
    model,
    active: false,
    placed: false,
    pos: new THREE.Vector3(0, 0, 0),
    yaw: 0,
    speed: 0,
    steer: 0,
    length: model.length,
    width: model.width,
    cam: 'chase',
    lookYaw: 0,
    lookPitch: -0.08,
    lookIdle: 0,
    y: 0,
    pitch: 0,
    roll: 0,
    wheelAngle: 0,
    engine: null,
    crosshair: false,
    collider: { kind: 'obb', cx: 1e5, cz: 1e5, hx: model.width / 2, hz: model.length / 2, cos: 1, sin: 0, top: model.height, bottom: -1 },
  };
  game.world.dynamic.push(car.collider);

  const camPos = new THREE.Vector3();
  const camTarget = new THREE.Vector3();
  const tmp = new THREE.Vector3();
  const probes = [];

  /* ---------- door interactable ---------- */
  game.world.ctx.interact({
    parent: model.group,
    x: -model.width / 2 - 0.1, y: 1.0, z: -0.1, w: 0.5, h: 1.2, d: 1.6,
    label: 'Get in the семёрка',
    enabled: () => car.placed && !car.active,
    action: () => enter(),
  });

  function fitsAt(x, z, yaw) {
    rectProbes(x, z, car.width / 2 + 0.25, car.length / 2 + 0.25, yaw, probes);
    for (const p of probes) {
      if (onCarriageway(p.x, p.z, 0.2)) return false;
      if (p.x < BOUNDS.x0 + 2 || p.x > BOUNDS.x1 - 2 || p.z < BOUNDS.z0 + 2 || p.z > BOUNDS.z1 - 2) return false;
      const near = game.world.colliders.near(p.x - 0.5, p.z - 0.5, p.x + 0.5, p.z + 0.5);
      const q = { x: p.x, z: p.z };
      for (const c of near) if (pushCircle(q, 0.25, c, 0, 0.3)) return false;
    }
    return true;
  }

  function nearestRoadYaw(x, z) {
    let best = null, bd = Infinity;
    for (const r of ROADS) {
      const d = r.axis === 'x' ? Math.abs(z - r.c) : Math.abs(x - r.c);
      if (d < bd) { bd = d; best = r; }
    }
    if (!best) return 0;
    // park with the traffic on the near side
    const side = best.axis === 'x' ? Math.sign(z - best.c) : Math.sign(x - best.c);
    if (best.axis === 'x') return side > 0 ? -Math.PI / 2 : Math.PI / 2;
    return side > 0 ? 0 : Math.PI;
  }

  function place(x, z, yaw) {
    car.pos.set(x, game.world.heightAt(x, z), z);
    car.yaw = yaw;
    car.speed = 0;
    car.steer = 0;
    car.placed = true;
    model.group.visible = true;
    sync(0);
  }

  /** V: bring the car to you, or tell you where it is. */
  function summon() {
    if (car.active) return;
    const p = game.player.pos;
    const yawP = game.player.yaw;
    const baseYaw = nearestRoadYaw(p.x, p.z);
    // try a ring of spots in front of the walker, nearest first
    for (const d of [4.5, 6, 8, 10, 13]) {
      for (let k = 0; k < 16; k++) {
        const a = yawP + (k % 2 ? 1 : -1) * Math.ceil(k / 2) * (Math.PI / 8);
        const x = p.x - Math.sin(a) * d, z = p.z - Math.cos(a) * d;
        for (const yaw of [baseYaw, baseYaw + Math.PI / 2]) {
          if (fitsAt(x, z, yaw)) {
            place(x, z, yaw);
            game.audio.play('horn', { pos: { x, y: 1, z }, dur: 0.18 });
            game.hud.flash('Your семёрка is parked nearby');
            return;
          }
        }
      }
    }
    game.hud.flash('No room to park here. Try somewhere more open.');
  }

  function enter() {
    car.active = true;
    car.lookYaw = 0;
    car.lookPitch = -0.08;
    game.setController(controller);
    game.hud.setSpeed(0);
    game.audio.play('click');
    if (!car.engine) car.engine = game.audio.loop('engine', { kind: 'petrol', pos: car.pos, volume: 1 });
    game.hud.setHint('<b>W</b> gas · <b>S</b> brake / reverse · <b>A D</b> steer · <b>Space</b> horn · <b>F</b> camera · <b>E</b> get out', 10);
  }

  function exit() {
    if (Math.abs(car.speed) > 1.5) {
      game.hud.flash('Stop the car first');
      return false;
    }
    car.speed = 0;
    // step out of the driver's door, or whichever side is clear
    const cos = Math.cos(car.yaw), sin = Math.sin(car.yaw);
    const spots = [[-car.width / 2 - 0.6, -0.2], [car.width / 2 + 0.6, -0.2], [0, car.length / 2 + 0.8], [0, -car.length / 2 - 0.8]];
    for (const [lx, lz] of spots) {
      const x = car.pos.x + lx * cos + lz * sin, z = car.pos.z - lx * sin + lz * cos;
      const q = { x, z };
      const near = game.world.colliders.near(x - 1, z - 1, x + 1, z + 1);
      let blocked = false;
      for (const c of near) if (pushCircle(q, 0.3, c, 0)) { blocked = true; break; }
      if (blocked) continue;
      car.active = false;
      game.player.placeAt(x, z, car.yaw + car.lookYaw, 0);
      game.setController(null);
      return true;
    }
    game.hud.flash('No room to open the door');
    return false;
  }

  /* ---------- physics ---------- */

  function collide(dt) {
    const hits = [];
    rectProbes(car.pos.x, car.pos.z, car.width / 2 - PROBE_R * 0.5, car.length / 2 - PROBE_R * 0.5, car.yaw, probes);
    let pushX = 0, pushZ = 0, n = 0;
    const feet = car.pos.y;
    for (const p of probes) {
      const q = { x: p.x, z: p.z };
      const near = game.world.colliders.near(p.x - 1, p.z - 1, p.x + 1, p.z + 1);
      for (const c of near) pushCircle(q, PROBE_R, c, feet, 0.32, 1.4);
      for (const c of game.world.dynamic) {
        if (c === car.collider || Math.abs(c.cx - p.x) > 14 || Math.abs(c.cz - p.z) > 14) continue;
        if (pushCircle(q, PROBE_R, c, feet, 0.3, 1.4) && c.vehicle) hits.push(c.vehicle);
      }
      const dx = q.x - p.x, dz = q.z - p.z;
      if (dx || dz) { pushX += dx; pushZ += dz; n++; }
    }
    if (n) {
      car.pos.x += pushX / n * 1.6;
      car.pos.z += pushZ / n * 1.6;
      const fx = -Math.sin(car.yaw), fz = -Math.cos(car.yaw);
      const into = -(pushX * fx + pushZ * fz) / Math.max(1e-6, Math.hypot(pushX, pushZ));
      const impact = Math.abs(car.speed) * Math.max(0, into * Math.sign(car.speed || 1));
      if (impact > 2.5) game.audio.play('thud', { pos: car.pos, volume: Math.min(1, impact / 12) });
      car.speed *= into > 0.4 ? 0.35 : 0.9;
    }
    return hits;
  }

  function wheelHeights() {
    const cos = Math.cos(car.yaw), sin = Math.sin(car.yaw);
    const hx = car.width / 2 - 0.15, hz = model.wheelbase / 2;
    const at = (lx, lz) => {
      const x = car.pos.x + lx * cos + lz * sin, z = car.pos.z - lx * sin + lz * cos;
      return game.world.heightAt(x, z, car.pos.y + 0.2);
    };
    return { fl: at(-hx, -hz), fr: at(hx, -hz), rl: at(-hx, hz), rr: at(hx, hz) };
  }

  function sync(dt) {
    const g = model.group;
    const h = wheelHeights();
    const yTarget = (h.fl + h.fr + h.rl + h.rr) / 4;
    car.y = dt ? damp(car.y, yTarget, 14, dt) : yTarget;
    const pitchT = Math.atan2(((h.rl + h.rr) - (h.fl + h.fr)) / 2, model.wheelbase);
    const rollT = Math.atan2(((h.fr + h.rr) - (h.fl + h.rl)) / 2, car.width - 0.3);
    const accelPitch = clamp(-(car.accel || 0) * 0.008, -0.04, 0.03);
    const turnRoll = clamp(car.speed * car.steer * 0.03, -0.06, 0.06);
    car.pitch = dt ? damp(car.pitch, -pitchT + accelPitch, 8, dt) : -pitchT;
    car.roll = dt ? damp(car.roll, rollT + turnRoll, 8, dt) : rollT;
    car.pos.y = car.y;
    g.position.set(car.pos.x, car.y, car.pos.z);
    g.rotation.set(car.pitch, car.yaw, car.roll, 'YXZ');
    for (const w of model.wheels) w.rotation.x = -car.wheelAngle;
    for (const s of model.steer) s.rotation.y = car.steer;
    if (model.brake) model.brake.visible = (car.braking || false);
    const c = car.collider;
    c.cx = car.pos.x; c.cz = car.pos.z;
    c.cos = Math.cos(car.yaw); c.sin = Math.sin(car.yaw);
  }

  function drive(dt) {
    const inp = game.input;
    const { fwd, side } = inp.axes();
    const v = car.speed;
    let a = 0;
    car.braking = false;
    if (fwd > 0) {
      a = v < -0.3 ? BRAKE : THROTTLE * (1 - Math.pow(Math.max(v, 0) / TOP_SPEED, 2));
    } else if (fwd < 0) {
      if (v > 0.3) { a = -BRAKE; car.braking = true; } else a = -THROTTLE * 0.7 * (1 - Math.pow(Math.max(-v, 0) / REVERSE, 2));
    }
    // rolling resistance and drag
    const drag = 0.35 + 0.0035 * v * v;
    a -= Math.sign(v) * drag;
    if (!fwd && Math.abs(v) < 0.4) car.speed = 0;
    else car.speed = clamp(v + a * dt, -REVERSE, TOP_SPEED);
    car.accel = a;

    const steerMax = STEER_MAX / (1 + Math.abs(car.speed) / 9);
    car.steer = damp(car.steer, -side * steerMax, side ? 6 : 9, dt);
    const yawRate = (car.speed / model.wheelbase) * Math.tan(car.steer);
    car.yaw = wrapAngle(car.yaw + yawRate * dt);

    const dist = car.speed * dt;
    const n = Math.max(1, Math.ceil(Math.abs(dist) / 0.25));
    for (let i = 0; i < n; i++) {
      car.pos.x += -Math.sin(car.yaw) * dist / n;
      car.pos.z += -Math.cos(car.yaw) * dist / n;
      collide(dt / n);
    }
    car.pos.x = clamp(car.pos.x, BOUNDS.x0 + 1, BOUNDS.x1 - 1);
    car.pos.z = clamp(car.pos.z, BOUNDS.z0 + 1, BOUNDS.z1 - 1);
    car.wheelAngle += dist / model.wheelRadius;
  }

  function camera(dt) {
    const cam = game.camera;
    const { dx, dy } = game.input.takeLook();
    car.lookYaw -= dx;
    car.lookPitch = clamp(car.lookPitch - dy, -0.9, 0.5);
    if (dx || dy) car.lookIdle = 0; else car.lookIdle += dt;
    if (car.cam === 'chase' && car.lookIdle > 1.6 && Math.abs(car.speed) > 2) {
      car.lookYaw = damp(car.lookYaw, 0, 1.5, dt);
      car.lookPitch = damp(car.lookPitch, -0.08, 1.5, dt);
    }
    if (car.cam === 'seat') {
      const e = model.driverEye;
      tmp.set(e.x, e.y, e.z).applyEuler(model.group.rotation).add(model.group.position);
      cam.position.copy(tmp);
      cam.rotation.set(car.lookPitch + car.pitch * 0.6, car.yaw + car.lookYaw, car.roll * 0.6, 'YXZ');
      return;
    }
    const yaw = car.yaw + car.lookYaw;
    const back = 6.6, up = 2.3;
    const wantX = car.pos.x + Math.sin(yaw) * back * Math.cos(car.lookPitch);
    const wantZ = car.pos.z + Math.cos(yaw) * back * Math.cos(car.lookPitch);
    const wantY = car.y + up - Math.sin(car.lookPitch) * back * 0.9;
    if (!camPos.lengthSq()) camPos.set(wantX, wantY, wantZ);
    camPos.x = damp(camPos.x, wantX, 9, dt);
    camPos.z = damp(camPos.z, wantZ, 9, dt);
    camPos.y = damp(camPos.y, Math.max(car.y + 0.6, wantY), 6, dt);
    camTarget.set(car.pos.x - Math.sin(yaw) * 2.5, car.y + 1.2, car.pos.z - Math.cos(yaw) * 2.5);
    cam.position.copy(camPos);
    cam.lookAt(camTarget);
  }

  const controller = {
    name: 'car',
    crosshair: false,
    get pos() { return car.pos; },
    get yaw() { return car.yaw; },
    enter() {
      camPos.set(0, 0, 0);
      model.group.visible = true;
      if (model.interior) model.interior.visible = car.cam === 'seat';
    },
    exit() {
      car.active = false;
      game.hud.setSpeed(null);
      if (model.interior) model.interior.visible = false;
      if (car.engine) { car.engine.stop(); car.engine = null; }
    },
    update(dt) {
      drive(dt);
      sync(dt);
      camera(dt);
      game.hud.setSpeed(car.speed * 3.6);
      car.engine?.set({ pos: car.pos, rate: 0.9 + Math.abs(car.speed) / 5.5 % 2.2 + Math.abs(car.speed) / 20, load: clamp(car.accel / 3 + 0.4, 0, 1) });
    },
    onInteract() { exit(); return true; },
    prompt: () => null,
  };

  game.input.on('KeyV', () => {
    if (!game.controller) summon();
  });
  game.input.on('KeyF', () => {
    if (!car.active) return;
    car.cam = car.cam === 'chase' ? 'seat' : 'chase';
    model.group.visible = true;
    if (model.interior) model.interior.visible = car.cam === 'seat';
    game.hud.flash(car.cam === 'seat' ? "driver's seat" : 'chase camera', 900);
  });
  game.input.on('Space', () => {
    if (car.active) game.audio.play('horn', { pos: car.pos, dur: 0.4 });
  });

  return {
    get active() { return car.active; },
    get pos() { return car.pos; },
    get speed() { return car.speed; },
    get width() { return car.width; },
    get length() { return car.length; },
    get placed() { return car.placed; },
    get yaw() { return car.yaw; },
    summon, place, model,
    enter: () => { if (car.placed && !car.active) enter(); },
    update() {},
  };
}
