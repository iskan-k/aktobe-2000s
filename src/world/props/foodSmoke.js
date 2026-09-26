import * as THREE from 'three';
import { canvasTex, cached } from '../../core/textures.js';
import { rngKit } from '../../core/util.js';
import { defineLoop } from '../../core/audio.js';

/* ------------------------------------------------------------------ *
 * Smoke and sizzle for the food stalls.
 *
 * Every mangal, tandyr, fryer and samovar in town registers a source;
 * all their puffs share one Points object, so the lot is one draw call.
 * Puffs only move near the camera. Each source can also start a
 * positional loop: fat on coals, or oil bubbling in a fryer.
 *
 *   addSmoke(ctx, { x, y, z }, { strength, color })
 *   addSizzle(ctx, { x, y, z }, 'grill' | 'fryer', volume)
 * ------------------------------------------------------------------ */

const PUFFS = 14;            // puffs per source
const MAX_SOURCES = 32;
const LIFE = 4.5;            // seconds from the coals to gone
const NEAR = 150;            // metres: farther sources stop drawing

const systems = new WeakMap();

function puffTex() {
  // same key and look as the roadside café's smoke, so they share it
  return cached('smoke-puff', () => canvasTex(64, 64, (c, W, H) => {
    const g = c.createRadialGradient(W / 2, H / 2, 0, W / 2, H / 2, W / 2);
    g.addColorStop(0, 'rgba(255,255,255,0.9)');
    g.addColorStop(0.5, 'rgba(255,255,255,0.4)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    c.fillStyle = g;
    c.fillRect(0, 0, W, H);
  }));
}

function createSystem(ctx) {
  const N = PUFFS * MAX_SOURCES;
  const pos = new Float32Array(N * 3), size = new Float32Array(N), alpha = new Float32Array(N), tint = new Float32Array(N * 3);
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('size', new THREE.BufferAttribute(size, 1));
  geo.setAttribute('alpha', new THREE.BufferAttribute(alpha, 1));
  geo.setAttribute('tint', new THREE.BufferAttribute(tint, 3));
  geo.setDrawRange(0, 0);
  const mat = new THREE.ShaderMaterial({
    uniforms: { map: { value: puffTex() }, halfH: { value: 450 } },
    vertexShader: `
      attribute float size; attribute float alpha; attribute vec3 tint;
      varying float vA; varying vec3 vT; uniform float halfH;
      void main() {
        vA = alpha; vT = tint;
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        gl_PointSize = size * projectionMatrix[1][1] * halfH / -mv.z;
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: `
      uniform sampler2D map; varying float vA; varying vec3 vT;
      void main() {
        vec4 t = texture2D(map, gl_PointCoord);
        gl_FragColor = vec4(vT, t.a * vA);
      }`,
    transparent: true, depthWrite: false,
  });
  const pts = new THREE.Points(geo, mat);
  pts.frustumCulled = false;
  pts.renderOrder = 4;
  ctx.root.add(pts);

  const sources = [];
  ctx.update((dt, game) => {
    if (!sources.length) return;
    const cam = game.camera.position;
    mat.uniforms.halfH.value = window.innerHeight / 2;
    let any = false;
    sources.forEach((s, si) => {
      const near = (cam.x - s.at.x) ** 2 + (cam.z - s.at.z) ** 2 < NEAR * NEAR;
      const base = si * PUFFS;
      for (let i = 0; i < PUFFS; i++) {
        const k = base + i;
        if (!near) { alpha[k] = 0; continue; }
        any = true;
        s.age[i] = (s.age[i] + dt) % LIFE;
        const t = s.age[i] / LIFE, [ox, oz, sp] = s.seed[i];
        const rise = (1.2 + 3.2 * s.strength) * sp;
        pos[k * 3] = s.at.x + ox * 0.35 + t * 1.2 * sp;
        pos[k * 3 + 1] = s.at.y + t * rise;
        pos[k * 3 + 2] = s.at.z + oz + Math.sin(t * 5 + i) * 0.2;
        size[k] = 0.25 + t * (0.8 + 1.8 * s.strength);
        alpha[k] = Math.min(0.55, Math.min(1, t * 6) * (1 - t)) * (0.45 + 0.55 * s.strength);
      }
    });
    pts.visible = any;
    if (!any) return;
    geo.attributes.position.needsUpdate = true;
    geo.attributes.size.needsUpdate = true;
    geo.attributes.alpha.needsUpdate = true;
  });

  return {
    add(at, strength, color) {
      if (sources.length >= MAX_SOURCES) return;
      const rng = rngKit(Math.round(at.x * 31 + at.z * 17));
      const si = sources.length;
      const c = new THREE.Color(color);
      for (let i = 0; i < PUFFS; i++) {
        const k = si * PUFFS + i;
        tint[k * 3] = c.r; tint[k * 3 + 1] = c.g; tint[k * 3 + 2] = c.b;
      }
      geo.attributes.tint.needsUpdate = true;
      sources.push({
        at, strength,
        age: Float32Array.from({ length: PUFFS }, (_, i) => (i / PUFFS) * LIFE),
        seed: Array.from({ length: PUFFS }, () => [rng.range(-0.6, 0.6), rng.range(-0.12, 0.12), rng.range(0.7, 1.2)]),
      });
      geo.setDrawRange(0, sources.length * PUFFS);
    },
  };
}

/**
 * A plume over a stall. `strength` 1 is a busy mangal, 0.3 a tandyr or
 * a fryer vent, 0.15 the steam off a samovar.
 */
export function addSmoke(ctx, at, { strength = 1, color = 0xaaa69f } = {}) {
  if (!systems.has(ctx.root)) systems.set(ctx.root, createSystem(ctx));
  systems.get(ctx.root).add(at, strength, color);
}

/** A positional loop at a stall: 'grill' (fat on coals) or 'fryer' (hot oil). */
export function addSizzle(ctx, at, kind = 'grill', volume = 0.6) {
  let handle = null;
  ctx.update((dt, game) => {
    if (!handle && game.audio.ready) handle = game.audio.loop(kind, { pos: { x: at.x, y: at.y, z: at.z }, volume });
  });
}

/* ---------------- sound ---------------- */

/** A looping noise buffer with `pops` sharp crackles in it, high-passed. */
function crackleLoop(ac, out, { seconds, hiss, pops, popLen, hp, gain }) {
  const len = Math.floor(ac.sampleRate * seconds);
  const buf = ac.createBuffer(1, len, ac.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * hiss;
  for (let k = 0; k < pops; k++) {
    const at = Math.floor(Math.random() * (len - popLen * 8));
    const amp = 0.3 + Math.random() * 0.7;
    for (let j = 0; j < popLen * 8; j++) d[at + j] += (Math.random() * 2 - 1) * amp * Math.exp(-j / popLen);
  }
  const n = ac.createBufferSource();
  n.buffer = buf;
  n.loop = true;
  const f = ac.createBiquadFilter();
  f.type = 'highpass';
  f.frequency.value = hp;
  const g = ac.createGain();
  g.gain.value = 0.0001;
  n.connect(f).connect(g).connect(out);
  n.start();
  return {
    set({ volume = 1 }) { g.gain.setTargetAtTime(Math.max(0.0001, volume * gain), ac.currentTime, 0.2); },
    stop() { g.gain.setTargetAtTime(0.0001, ac.currentTime, 0.2); setTimeout(() => n.stop(), 600); },
  };
}

// fat dripping on coals: a soft hiss and a crackle now and then
defineLoop('grill', (ac, out) => crackleLoop(ac, out, { seconds: 3, hiss: 0.07, pops: 80, popLen: 40, hp: 900, gain: 0.32 }));

// oil in a deep pan: a thick bed of tiny pops over a low seethe
defineLoop('fryer', (ac, out) => crackleLoop(ac, out, { seconds: 2.5, hiss: 0.12, pops: 420, popLen: 12, hp: 1800, gain: 0.26 }));
