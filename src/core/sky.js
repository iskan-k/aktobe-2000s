import * as THREE from 'three';
import { PAL } from './palette.js';
import { flat } from './toon.js';
import { cirrusTex, canvasTex, cached } from './textures.js';
import { rngKit } from './util.js';

/* ------------------------------------------------------------------ *
 * Sky: a painted gradient dome, a ring of fair-weather cumulus and a
 * couple of cirrus bands. The dome and the clouds trail the camera, so
 * they never get closer.
 *
 * The dome is deep blue overhead and pales to a dusty steppe haze at the
 * horizon, which is the fog colour too, so the far edge of town melts
 * into the sky instead of stopping against it. Toward the sun the haze
 * warms to gold: a June evening, the sun low in the west.
 *
 * Cumulus are drawn cel style in three tones (lit crown, body, cool
 * shadowed base) with soft edges and a flat bottom, in a few variants so
 * the ring does not repeat. Clouds on the sun side get a warm rim.
 *
 * SUN_DIR is shared with the key light in main.js, so the glow in the
 * sky and the shadows on the ground agree: about seven in the evening in
 * June, the sun a little south of west and some 27 degrees up.
 * ------------------------------------------------------------------ */

export const SUN_DIR = new THREE.Vector3(-0.84, 0.47, 0.2).normalize();

/* ---------------- cumulus textures ---------------- */

function cumulusTex(seed) {
  return cached('cumulus|' + seed, () => canvasTex(512, 256, (ctx, w, h) => {
    const r = rngKit(seed);
    ctx.clearRect(0, 0, w, h);
    const base = h * 0.8;
    const puffs = [];
    const n = r.int(9, 15);
    for (let i = 0; i < n; i++) {
      const x = r.range(0.12, 0.88) * w;
      const edge = 1 - Math.abs(x / w - 0.5) * 1.35;
      const rad = r.range(0.16, 0.3) * h * (0.45 + edge * 0.7);
      puffs.push([x, base - rad * r.range(0.35, 1.25), rad]);
    }
    // a few small turrets on the crown
    for (let i = 0; i < 4; i++) {
      const p = r.pick(puffs);
      puffs.push([p[0] + r.range(-p[2] * 0.4, p[2] * 0.4), p[1] - p[2] * r.range(0.5, 0.8), p[2] * r.range(0.4, 0.6)]);
    }
    const disc = (x, y, rad, rgb, a) => {
      const g = ctx.createRadialGradient(x, y, rad * 0.8, x, y, rad);
      g.addColorStop(0, `rgba(${rgb},${a})`);
      g.addColorStop(1, `rgba(${rgb},0)`);
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(x, y, rad, 0, Math.PI * 2); ctx.fill();
    };
    // shadowed base, the body, then the lit crown offset up and left
    // (the crown sits inside the body, so it shows only on top; the cool
    // underside comes from the gradient below)
    for (const [x, y, rad] of puffs) disc(x, y, rad, '226,229,236', 1);
    for (const [x, y, rad] of puffs) disc(x - rad * 0.12, y - rad * 0.26, rad * 0.68, '255,252,244', 1);
    // flat base, cumulus style, with a soft shadowed underside
    ctx.globalCompositeOperation = 'destination-out';
    const fade = ctx.createLinearGradient(0, base - h * 0.04, 0, base + h * 0.06);
    fade.addColorStop(0, 'rgba(0,0,0,0)');
    fade.addColorStop(1, 'rgba(0,0,0,1)');
    ctx.fillStyle = fade;
    ctx.fillRect(0, base - h * 0.04, w, h);
    ctx.globalCompositeOperation = 'source-atop';
    const under = ctx.createLinearGradient(0, base - h * 0.34, 0, base);
    under.addColorStop(0, 'rgba(170,180,204,0)');
    under.addColorStop(1, 'rgba(170,180,204,0.7)');
    ctx.fillStyle = under;
    ctx.fillRect(0, 0, w, h);
    ctx.globalCompositeOperation = 'source-over';
  }, { mips: true }));
}

/* ---------------- dome ---------------- */

export function buildSky(scene, radius = 800) {
  const geo = new THREE.SphereGeometry(radius, 40, 24);
  const mat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
    uniforms: {
      uTop: { value: new THREE.Color(PAL.skyTop) },
      uMid: { value: new THREE.Color(PAL.skyMid) },
      uHaze: { value: new THREE.Color(PAL.skyHaze) },
      uGlow: { value: new THREE.Color(PAL.sunGlow) },
      uGold: { value: new THREE.Color(0xf3cf96) },
      uSun: { value: SUN_DIR.clone() },
    },
    vertexShader: /* glsl */ `
      varying vec3 vDir;
      void main() {
        vDir = normalize( position );
        vec4 wp = modelMatrix * vec4( position, 1.0 );
        gl_Position = projectionMatrix * viewMatrix * wp;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform vec3 uTop, uMid, uHaze, uGlow, uGold, uSun;
      varying vec3 vDir;
      void main() {
        vec3 d = normalize( vDir );
        vec3 sd = normalize( uSun );
        float h = d.y;
        float s = max( dot( d, sd ), 0.0 );
        // how much this part of the sky faces the sun, along the horizon
        float side = max( dot( normalize( vec2( d.x, d.z ) + 1e-5 ), normalize( sd.xz ) ), 0.0 );
        vec3 haze = mix( uHaze, uGold, pow( side, 3.0 ) * 0.55 );
        vec3 col = mix( haze, uMid, smoothstep( 0.0, 0.26, h ) );
        col = mix( col, uTop, smoothstep( 0.2, 0.9, h ) );
        // below the horizon: the dust layer, never a black hole
        col = mix( col, uHaze * 0.97, smoothstep( 0.0, -0.08, h ) );
        col = mix( col, uGlow, pow( s, 6.0 ) * 0.45 + pow( s, 48.0 ) * 0.5 );
        col += uGlow * smoothstep( 0.9993, 0.9997, s ) * 1.6;
        gl_FragColor = vec4( col, 1.0 );
      }
    `,
  });
  const dome = new THREE.Mesh(geo, mat);
  dome.frustumCulled = false;
  dome.renderOrder = -10;
  scene.add(dome);

  const clouds = new THREE.Group();
  const rng = rngKit(2007);
  const sunA = Math.atan2(SUN_DIR.z, SUN_DIR.x);
  const warm = new THREE.Color(0xffe8c4), cool = new THREE.Color(0xf4f4f6);
  const cloudMats = [11, 23, 37, 51].map((seed) => ({ seed, byTone: new Map() }));
  const matFor = (variant, towardSun) => {
    // three tone steps between neutral and warm, so the materials stay few
    const step = Math.round(towardSun * 2);
    const v = cloudMats[variant];
    if (!v.byTone.has(step)) {
      const m = flat({ map: cumulusTex(v.seed), transparent: true, depthWrite: false, fog: false, cache: false });
      m.color.copy(cool).lerp(warm, step / 2);
      v.byTone.set(step, m);
    }
    return v.byTone.get(step);
  };
  for (let i = 0; i < 30; i++) {
    const r = rng.range(radius * 0.6, radius * 0.9);
    const a = rng.range(0, Math.PI * 2);
    const far = r / radius;
    const w = rng.range(80, 200) * (1.25 - far * 0.35);
    const hgt = w * rng.range(0.4, 0.55);
    const y = rng.range(45, 150) * (1.3 - far * 0.4);
    const towardSun = Math.max(0, Math.cos(a - sunA));
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, hgt), matFor(i % 4, towardSun * towardSun));
    m.position.set(Math.cos(a) * r, y, Math.sin(a) * r);
    m.lookAt(0, y * 0.6, 0);
    m.renderOrder = -9;
    clouds.add(m);
  }
  const cirMat = flat({ map: cirrusTex(), transparent: true, opacity: 0.3, depthWrite: false, fog: false, cache: false });
  for (let i = 0; i < 4; i++) {
    const a = rng.range(0, Math.PI * 2);
    const r = radius * 0.8;
    const m = new THREE.Mesh(new THREE.PlaneGeometry(rng.range(400, 700), 70), cirMat);
    m.position.set(Math.cos(a) * r, rng.range(230, 320), Math.sin(a) * r);
    m.lookAt(0, 0, 0);
    m.renderOrder = -9;
    clouds.add(m);
  }
  clouds.frustumCulled = false;
  scene.add(clouds);

  return {
    dome,
    clouds,
    follow(camera) {
      dome.position.copy(camera.position);
      clouds.position.set(camera.position.x, 0, camera.position.z);
    },
  };
}
