import * as THREE from 'three';
import { clamp, wrapAngle, damp } from '../../core/util.js';
import { climbTrack } from './movements.js';

/* ------------------------------------------------------------------ *
 * One aircraft movement in progress: it walks the legs of an arrival or
 * a departure (see movements.js), puts the airframe where the track
 * says with a believable attitude (glide pitch, flare, de-rotation,
 * banking into turns), and runs its lights and engine sound.
 * ------------------------------------------------------------------ */

const DEG = Math.PI / 180;
const _p = {}, _v = new THREE.Vector3(), _f = new THREE.Vector3();

export function newMove(kind, plane, legs, stand) {
  return {
    kind, plane, legs, stand, i: 0, s: 0, v: 0, legT: 0,
    yaw: 0, pitch: 0, bank: 0, lastYaw: null, thrust: 0.1, track: null, endPose: null, sound: null,
  };
}

export const legOf = (m) => m.legs[m.i] || null;

/** Advance the legs by dt. `hooks.event(name, m)` fires as a leg starts; returns true when done. */
export function stepMove(m, dt, hooks) {
  const leg = legOf(m);
  if (!leg) return true;
  if (m.legT === 0 && leg.event) hooks.event(leg.event, m);
  m.legT += dt;
  if (leg.kind === 'wait') {
    const ready = leg.until !== 'tug' || hooks.tugAttached();
    if (m.legT >= leg.dur && ready) return nextLeg(m);
    return false;
  }
  if (leg.kind === 'climb' && !m.track) {
    const g = m.plane.a.group.position;
    m.track = climbTrack(g.x, g.z, m.plane.a.type);
  }
  const tr = leg.track || m.track;
  m.v += clamp(tr.capAt(m.s) - m.v, -leg.decel * dt, leg.accel * dt);
  const remaining = tr.length - m.s;
  // never stall short of a stop point
  if (tr.caps[tr.n - 1] === 0 && remaining > 0.05) m.v = Math.max(m.v, Math.min(0.5, remaining));
  m.s += m.v * dt;
  if ((leg.untilV && m.v >= leg.untilV) || m.s >= tr.length - 0.02) return nextLeg(m);
  return false;
}

function nextLeg(m) {
  const leg = legOf(m);
  const tr = leg && (leg.track || m.track);
  if (tr) m.endPose = { ...tr.at(Math.min(m.s, tr.length), {}) };
  m.i++;
  m.s = 0;
  m.legT = 0;
  m.track = null;
  return m.i >= m.legs.length;
}

/** Place the airframe for the current leg. */
export function pose(m, dt) {
  const leg = legOf(m) || m.legs[m.legs.length - 1];
  const a = m.plane.a, g = a.group, T = a.type;
  const tr = leg.track || m.track;
  if (tr) tr.at(m.s, _p);
  else if (m.endPose) Object.assign(_p, m.endPose);
  else Object.assign(_p, { x: g.position.x, y: g.position.y, z: g.position.z, tx: -Math.sin(m.yaw), ty: 0, tz: -Math.cos(m.yaw) });
  g.position.set(_p.x, _p.y, _p.z);
  let yaw = Math.atan2(-_p.tx, -_p.tz);
  if (leg.mode === 'push') yaw = wrapAngle(yaw + Math.PI);
  if (leg.kind === 'wait') yaw = m.yaw;
  const gamma = Math.asin(clamp(_p.ty, -1, 1));
  let pitch = 0, bankTarget = 0;
  if (leg.mode === 'air') pitch = gamma + (m.v < T.speed.app + 6 ? 5.5 : 3) * DEG;
  else if (leg.mode === 'flare') pitch = gamma + (5.5 + 2.5 * (tr ? m.s / tr.length : 1)) * DEG;
  else if (leg.mode === 'rollout') pitch = Math.max(0, 5 - m.legT * 1.1) * DEG;
  else if (leg.mode === 'climb') pitch = Math.min(gamma + 8 * DEG, m.legT * 2.8 * DEG);
  if ((leg.mode === 'air' || leg.mode === 'climb') && m.lastYaw !== null && dt > 0) {
    const rate = wrapAngle(yaw - m.lastYaw) / dt;
    bankTarget = clamp(Math.atan((m.v * rate) / 9.81), -0.55, 0.55);
  }
  m.lastYaw = yaw;
  m.yaw = yaw;
  m.pitch = damp(m.pitch, pitch, 3, dt);
  m.bank = damp(m.bank, bankTarget, 1.5, dt);
  g.rotation.set(m.pitch, yaw, m.bank);
  // gear: up after take-off, down on the way in
  if (leg.gearUpAt !== undefined && _p.y > leg.gearUpAt) a.setGear(false);
  else if (leg.gearAt !== undefined) a.setGear(_p.y < leg.gearAt);
  else if (leg.gear !== undefined) a.setGear(leg.gear);
  // thrust: the leg's, with reverse thrust just after touchdown
  let thrust = leg.thrust;
  if (leg.reverse) thrust = m.legT < leg.reverse ? 0.85 : 0.25;
  m.thrust = damp(m.thrust, thrust, 1.2, dt);
  a.spin(dt, 0.35 + m.thrust * 0.65);
}

/** Lights for the leg: position lights, blinking beacons and strobes, landing lights that flare at you. */
export function lights(m, time, cam) {
  const leg = legOf(m);
  const on = leg ? leg.lights : {};
  const beacon = (time % 1.1) < 0.12;
  const beaconLow = (time % 1.1) > 0.55 && (time % 1.1) < 0.67;
  const strobe = (time % 1.3) < 0.05 || ((time % 1.3) > 0.12 && (time % 1.3) < 0.16);
  const g = m.plane.a.group;
  _f.set(0, 0, -1).applyQuaternion(g.quaternion);
  _v.subVectors(cam, g.position).normalize();
  const facing = Math.max(0, _f.dot(_v));
  const land = 1.2 + 6 * Math.pow(facing, 6);
  m.plane.lights.set({
    navL: on.nav, navR: on.nav, tail: on.nav,
    beaconTop: on.beacon && beacon ? 1 : 0, beaconBottom: on.beacon && beaconLow ? 1 : 0,
    strobeL: on.strobe && strobe ? 1 : 0, strobeR: on.strobe && strobe ? 1 : 0,
    landL: on.land ? land : 0, landR: on.land ? land : 0,
    taxi: on.taxi ? 0.6 + 2.4 * Math.pow(facing, 4) : 0,
  });
}

/**
 * Engine sound, heard from far off: the level falls with distance on its
 * own curve (jets carry for kilometres), and the source is put a few
 * metres from the listener in the aircraft's direction so it still pans.
 */
export function sound(m, cam) {
  if (!m.sound) return;
  const g = m.plane.a.group.position;
  const d = Math.max(1, cam.distanceTo(g));
  const fall = Math.min(1, Math.pow(70 / d, 1.15));
  const loud = m.plane.a.type.sound === 'prop' ? 0.8 : 1;
  const volume = loud * (0.25 + 0.75 * m.thrust) * fall;
  _v.subVectors(g, cam).normalize().multiplyScalar(3).add(cam);
  m.sound.set({ volume, rate: m.thrust, near: clamp(1 - d / 900, 0, 1), pos: { x: _v.x, y: _v.y, z: _v.z } });
}
