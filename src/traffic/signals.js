import * as THREE from 'three';
import { PAL } from '../core/palette.js';
import { cel } from '../core/toon.js';
import { KERB_H } from '../world/plan.js';

/* ------------------------------------------------------------------ *
 * Traffic lights at the signalled junctions.
 *
 * Cycle: the avenue (east-west arms) gets the long green, the side
 * street the short one, with amber and a short all-red between. Before
 * green comes red plus amber together, as on every Soviet-built signal.
 * The last three seconds of green blink, which is also how they were
 * set up in Kazakhstan.
 *
 * Each approach arm has a three-lamp head on a pole at the right-hand
 * corner, facing the traffic that has to obey it, and a two-lamp
 * pedestrian head on the same pole facing across the street.
 * ------------------------------------------------------------------ */

const PHASES = [
  // [E-W state, N-S state, seconds]
  ['G', 'R', 22],
  ['g', 'R', 3],     // blinking green
  ['Y', 'R', 3],
  ['R', 'R', 1.5],
  ['R', 'RY', 1.5],
  ['R', 'G', 13],
  ['R', 'g', 3],
  ['R', 'Y', 3],
  ['R', 'R', 1.5],
  ['RY', 'R', 1.5],
];
const CYCLE = PHASES.reduce((s, p) => s + p[2], 0);

const LAMP_ON = { R: new THREE.Color(0xff3b2a), Y: new THREE.Color(0xffb52a), G: new THREE.Color(0x3dff9a) };
const LAMP_OFF = { R: new THREE.Color(0x3a1714), Y: new THREE.Color(0x3a2a10), G: new THREE.Color(0x0f2d20) };

function lampMat() {
  return new THREE.MeshBasicMaterial({ color: 0x222222 });
}

/** Build one signal head on a pole; returns the lamp materials. */
function signalPole(root, x, z, yaw, pedYaw) {
  const g = new THREE.Group();
  g.position.set(x, KERB_H, z);
  root.add(g);
  const body = cel({ color: PAL.metalDark });
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.08, 3.6, 8), cel({ color: 0x5b6166 }));
  pole.position.y = 1.8;
  pole.castShadow = true;
  g.add(pole);
  // stripes on the pole: black and white, like the kerbs
  const band = new THREE.Mesh(new THREE.CylinderGeometry(0.085, 0.085, 0.25, 8), cel({ color: PAL.whitewash }));
  band.position.y = 0.5;
  g.add(band);

  const head = new THREE.Group();
  head.position.y = 3.05;
  head.rotation.y = yaw;
  g.add(head);
  const box = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.98, 0.26), body);
  box.castShadow = true;
  head.add(box);
  const lamps = {};
  ['R', 'Y', 'G'].forEach((k, i) => {
    const m = lampMat();
    const lens = new THREE.Mesh(new THREE.CircleGeometry(0.11, 16), m);
    lens.position.set(0, 0.3 - i * 0.3, -0.135);
    lens.rotation.y = Math.PI;
    head.add(lens);
    // visor over each lamp
    const visor = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.13, 0.14, 12, 1, true, -Math.PI / 2, Math.PI), body);
    visor.rotation.x = Math.PI / 2;
    visor.position.set(0, 0.3 - i * 0.3 + 0.02, -0.2);
    head.add(visor);
    lamps[k] = m;
  });
  // back plate with the white border every Soviet signal had
  const plate = new THREE.Mesh(new THREE.BoxGeometry(0.56, 1.22, 0.02), cel({ color: 0x1d1f21 }));
  plate.position.z = 0.14;
  head.add(plate);

  // pedestrian head
  const ped = new THREE.Group();
  ped.position.y = 2.3;
  ped.rotation.y = pedYaw;
  g.add(ped);
  const pbox = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.6, 0.2), body);
  ped.add(pbox);
  const pl = {};
  ['R', 'G'].forEach((k, i) => {
    const m = lampMat();
    const lens = new THREE.Mesh(new THREE.PlaneGeometry(0.2, 0.22), m);
    lens.position.set(0, 0.14 - i * 0.28, -0.105);
    lens.rotation.y = Math.PI;
    ped.add(lens);
    pl[k] = m;
  });
  return { lamps, ped: pl };
}

export function buildSignals(net, root) {
  const junctions = new Map();
  const signalled = new Set(net.connectors.filter((c) => c.junction.signal).map((c) => c.junction));
  for (const j of signalled) {
    const heads = [];
    // Approaching from the W arm means driving east, so the pole stands on
    // the right-hand (south-west) corner and the lens faces west, toward
    // the driver. The pedestrian head faces across the same arm.
    const off = 1.2;
    const corners = {
      W: { x: j.x - j.hx - off, z: j.z + j.hz + off, yaw: Math.PI / 2, ped: 0 },
      E: { x: j.x + j.hx + off, z: j.z - j.hz - off, yaw: -Math.PI / 2, ped: Math.PI },
      N: { x: j.x - j.hx - off, z: j.z - j.hz - off, yaw: 0, ped: -Math.PI / 2 },
      S: { x: j.x + j.hx + off, z: j.z + j.hz + off, yaw: Math.PI, ped: Math.PI / 2 },
    };
    for (const arm of ['W', 'E', 'N', 'S']) {
      if (!j.arms[arm]) continue;
      const c = corners[arm];
      const h = signalPole(root, c.x, c.z, c.yaw, c.ped);
      heads.push({ arm, ...h });
    }
    junctions.set(j, { j, heads, t: (j.x * 0.37) % CYCLE });
  }

  function phaseOf(state) {
    let t = state.t % CYCLE;
    for (const p of PHASES) {
      if (t < p[2]) return { ew: p[0], ns: p[1], left: p[2] - t, dur: p[2] };
      t -= p[2];
    }
    return { ew: 'R', ns: 'R', left: 1, dur: 1 };
  }

  let blink = 0;
  return {
    junctions,
    /** Light shown to traffic entering from `arm`: 'G' | 'Y' | 'R' (blinking green reads as G). */
    stateFor(j, arm) {
      const s = junctions.get(j);
      if (!s) return 'G';
      const p = phaseOf(s);
      const v = arm === 'W' || arm === 'E' ? p.ew : p.ns;
      if (v === 'g') return 'G';
      if (v === 'RY') return 'R';
      return v;
    },
    update(dt) {
      blink += dt;
      const on = Math.floor(blink * 2) % 2 === 0;
      for (const s of junctions.values()) {
        s.t += dt;
        const p = phaseOf(s);
        for (const h of s.heads) {
          const v = h.arm === 'W' || h.arm === 'E' ? p.ew : p.ns;
          const r = v === 'R' || v === 'RY';
          const y = v === 'Y' || v === 'RY';
          const gr = v === 'G' || (v === 'g' && on);
          h.lamps.R.color.copy(r ? LAMP_ON.R : LAMP_OFF.R);
          h.lamps.Y.color.copy(y ? LAMP_ON.Y : LAMP_OFF.Y);
          h.lamps.G.color.copy(gr ? LAMP_ON.G : LAMP_OFF.G);
          // the pedestrian head faces people crossing this same arm, so
          // they may walk exactly when this arm's traffic has plain red
          const walk = v === 'R';
          h.ped.R.color.copy(walk ? LAMP_OFF.R : LAMP_ON.R);
          h.ped.G.color.copy(walk ? LAMP_ON.G : LAMP_OFF.G);
        }
      }
    },
  };
}
