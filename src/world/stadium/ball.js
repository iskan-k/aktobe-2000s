import * as THREE from 'three';
import { cel } from '../../core/toon.js';
import { defineVoice } from '../../core/audio.js';
import { noise } from '../../core/sounds.js';
import { PITCH, FIELD } from './layout.js';
import { GOAL } from './pitch.js';
import { ballTex } from './textures.js';

/* ------------------------------------------------------------------ *
 * A football left on the centre spot. Walk into it and it rolls off your
 * feet; E kicks it where you look (look up for a lofted ball). It bounces,
 * rolls to a stop, comes off the posts and the advertising walls, and a
 * ball over the line between the posts and under the bar is a goal: the
 * scoreboard counts it for Aktobe and the ball goes back to the spot.
 * ------------------------------------------------------------------ */

const R = 0.11;
const GRAVITY = 9.8;
const BOUNCE = 0.55;
const ROLL_DRAG = 0.35;       // 1/s, grass drag while rolling
const ROLL_DECEL = 0.4;       // m/s², rolling resistance
const KICK_SPEED = 17;
const DRIBBLE = 1.35;         // ball speed as a share of your own when you walk into it
const RESET_AFTER = 3;        // seconds from a goal back to the centre spot

defineVoice('kick', (ac, out, { volume = 1 }) => {
  const t = ac.currentTime;
  const o = ac.createOscillator();
  o.frequency.setValueAtTime(160, t);
  o.frequency.exponentialRampToValueAtTime(60, t + 0.09);
  const g = ac.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(0.6 * volume, t + 0.004);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.14);
  o.connect(g).connect(out);
  o.start(t);
  o.stop(t + 0.2);
  const s = noise(ac);
  const f = ac.createBiquadFilter();
  f.type = 'bandpass';
  f.frequency.value = 900;
  const g2 = ac.createGain();
  g2.gain.setValueAtTime(0.0001, t);
  g2.gain.exponentialRampToValueAtTime(0.4 * volume, t + 0.002);
  g2.gain.exponentialRampToValueAtTime(0.0001, t + 0.06);
  s.connect(f).connect(g2).connect(out);
  s.start(t, Math.random());
  s.stop(t + 0.1);
});

defineVoice('netSwish', (ac, out, { volume = 1 }) => {
  const t = ac.currentTime;
  const s = noise(ac);
  const f = ac.createBiquadFilter();
  f.type = 'highpass';
  f.frequency.setValueAtTime(1800, t);
  f.frequency.linearRampToValueAtTime(900, t + 0.4);
  const g = ac.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(0.35 * volume, t + 0.05);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.5);
  s.connect(f).connect(g).connect(out);
  s.start(t, Math.random());
  s.stop(t + 0.6);
});

export function buildBall(ctx, board) {
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(R, 14, 10), cel({ map: ballTex(), cache: false, grime: 0, dirt: 0 }));
  mesh.castShadow = true;
  mesh.name = 'stadium-ball';
  ctx.root.add(mesh);

  const pos = new THREE.Vector3(PITCH.x, R, PITCH.z);
  const vel = new THREE.Vector3();
  const axis = new THREE.Vector3(), q = new THREE.Quaternion();
  let goalsHome = 0, resetT = 0, inNet = 0, touchCool = 0;

  const place = () => {
    pos.set(PITCH.x, R, PITCH.z);
    vel.set(0, 0, 0);
    inNet = 0;
  };

  ctx.interact({
    x: 0, y: 0, z: 0, w: 1.0, h: 1.0, d: 1.0, parent: mesh,
    label: 'Kick the ball',
    enabled: () => resetT <= 0,
    action: (game) => {
      const p = game.player;
      const dx = -Math.sin(p.yaw), dz = -Math.cos(p.yaw);
      const loft = Math.max(0, Math.min(0.75, p.pitch + 0.12));
      const sp = KICK_SPEED * (0.85 + Math.random() * 0.15);
      vel.set(dx * sp * Math.cos(loft), sp * Math.sin(loft), dz * sp * Math.cos(loft));
      pos.y = Math.max(pos.y, R + 0.01);
      game.audio.play('kick', { pos, volume: 1 });
    },
  });

  /** Walls: the advert boards and the stand fronts, as one box round the grass. */
  const walls = (game) => {
    const lim = [[FIELD.x0 + R, FIELD.x1 - R, 'x'], [FIELD.z0 + R, FIELD.z1 - R, 'z']];
    for (const [lo, hi, k] of lim) {
      if (pos[k] < lo) { pos[k] = lo; vel[k] = Math.abs(vel[k]) * 0.4; bump(game, vel); }
      if (pos[k] > hi) { pos[k] = hi; vel[k] = -Math.abs(vel[k]) * 0.4; bump(game, vel); }
    }
  };
  const bump = (game, v) => {
    if (v.length() > 3) game.audio.play('thud', { pos, volume: Math.min(1, v.length() / 12) });
  };

  /** Posts are vertical cylinders; the net is a box you cannot leave through its sides. */
  const goals = (game, prevZ) => {
    for (const end of [-1, 1]) {
      const line = end < 0 ? PITCH.z0 : PITCH.z1;
      for (const s of [-1, 1]) {
        const px = PITCH.x + s * (GOAL.half + GOAL.post);
        const dx = pos.x - px, dz = pos.z - line, d = Math.hypot(dx, dz), min = GOAL.post + R;
        if (d < min && pos.y < GOAL.h + R) {
          const nx = dx / (d || 1), nz = dz / (d || 1);
          pos.x = px + nx * min;
          pos.z = line + nz * min;
          const vn = vel.x * nx + vel.z * nz;
          if (vn < 0) { vel.x -= 1.7 * vn * nx; vel.z -= 1.7 * vn * nz; game.audio.play('click', { pos, volume: 0.9 }); }
        }
      }
      const crossed = end < 0 ? prevZ >= line && pos.z < line : prevZ <= line && pos.z > line;
      if (crossed && Math.abs(pos.x - PITCH.x) < GOAL.half - R && pos.y < GOAL.h - R && !inNet) {
        inNet = end;
        scored(game);
      }
    }
    if (inNet) {
      const line = inNet < 0 ? PITCH.z0 : PITCH.z1, back = line + inNet * GOAL.depth;
      const zlo = Math.min(line, back) + R, zhi = Math.max(line, back) - R;
      if (pos.z < zlo) { pos.z = zlo; vel.z *= -0.15; }
      if (pos.z > zhi) { pos.z = zhi; vel.z *= -0.15; }
      const xl = PITCH.x - GOAL.half + R, xr = PITCH.x + GOAL.half - R;
      if (pos.x < xl) { pos.x = xl; vel.x *= -0.15; }
      if (pos.x > xr) { pos.x = xr; vel.x *= -0.15; }
      if (pos.y > GOAL.h * 0.8 - R) { pos.y = GOAL.h * 0.8 - R; vel.y = Math.min(0, vel.y); }
    }
  };

  const scored = (game) => {
    goalsHome++;
    resetT = RESET_AFTER;
    board.set(goalsHome, 0, goalsHome === 1 ? 'ГОЛ! ГООЛ!' : `ГОЛ! ${goalsHome}-й`);
    game.hud.flash('ГОЛ! Goal for Aktobe', 2200);
    game.audio.play('netSwish', { pos, volume: 1 });
  };

  const feet = (game, dt) => {
    const p = game.player;
    if (!p || !p.active || p.pos.y > R + 0.5 || resetT > 0) return;
    const dx = pos.x - p.pos.x, dz = pos.z - p.pos.z, d = Math.hypot(dx, dz), min = 0.3 + R;
    touchCool -= dt;
    if (d >= min || pos.y > 0.6) return;
    const nx = dx / (d || 1), nz = dz / (d || 1);
    pos.x = p.pos.x + nx * min;
    pos.z = p.pos.z + nz * min;
    const sp = Math.max(p.moving * DRIBBLE, 1.2);
    const vn = vel.x * nx + vel.z * nz;
    if (vn < sp) {
      vel.x += (sp - vn) * nx;
      vel.z += (sp - vn) * nz;
      if (touchCool <= 0 && p.moving > 1) { game.audio.play('kick', { pos, volume: 0.35 }); touchCool = 0.35; }
    }
  };

  ctx.update((dt, game) => {
    const cam = game.camera.position;
    if (Math.abs(cam.x - pos.x) > 200 || Math.abs(cam.z - pos.z) > 200) return;
    if (resetT > 0) {
      resetT -= dt;
      if (resetT <= 0) place();
    }
    const steps = Math.max(1, Math.ceil(vel.length() * dt / 0.08));
    const h = dt / steps;
    for (let i = 0; i < steps; i++) {
      const prevZ = pos.z;
      vel.y -= GRAVITY * h;
      pos.addScaledVector(vel, h);
      if (pos.y < R) {
        pos.y = R;
        if (vel.y < -1.2) {
          vel.y = -vel.y * BOUNCE;
          vel.x *= 0.85;
          vel.z *= 0.85;
        } else vel.y = 0;
      }
      if (pos.y <= R + 0.001) {
        const s = Math.hypot(vel.x, vel.z);
        if (s > 0) {
          const ns = Math.max(0, s * Math.exp(-ROLL_DRAG * h) - ROLL_DECEL * h);
          vel.x *= ns / s;
          vel.z *= ns / s;
        }
      }
      goals(game, prevZ);
      walls(game);
      feet(game, h);
    }
    // roll the ball: it turns about the axis across its path
    const s = Math.hypot(vel.x, vel.z);
    if (s > 0.01) {
      axis.set(vel.z, 0, -vel.x).normalize();
      q.setFromAxisAngle(axis, (s * dt) / R);
      mesh.quaternion.premultiply(q);
    }
    mesh.position.copy(pos);
  });

  mesh.position.copy(pos);
  return { get goals() { return goalsHome; } };
}
