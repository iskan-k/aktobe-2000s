import * as THREE from 'three';
import { mulberry32 } from '../core/util.js';

/* ------------------------------------------------------------------ *
 * Poplar fluff (тополиный пух) drifting through June.
 *
 * Every avenue in town was planted with poplars, and for three weeks in
 * June their seed fluff hangs in the air and rolls along the gutters.
 * One draw call of GPU points: the flakes live in a box that wraps
 * around the camera, drift on a slow breeze with a lazy wobble, sink a
 * little and fade out at the edges of the box, so the wrap never shows.
 * The drifts on the ground are static geometry (districts/streetlife.js).
 * ------------------------------------------------------------------ */

const COUNT = 3200;
const BOX = 40;          // horizontal size of the wrap box, metres
const HEIGHT = 10;       // flakes fill 0..HEIGHT above the street
const FLAKE = 0.05;      // world size of a flake, metres
const WIND = new THREE.Vector3(0.55, 0, 0.22);   // gentle westerly-ish breeze, m/s
const SINK = 0.05;       // m/s

const VERT = /* glsl */ `
  attribute vec4 aSeed;          // phase, frequency, speed, size
  uniform float uTime, uBox, uHeight, uScale, uFlake, uSink;
  uniform vec3 uCam, uWind;
  varying float vAlpha;
  void main() {
    float t = uTime;
    float ph = aSeed.x, fr = aSeed.y, sp = aSeed.z;
    vec3 p = position + uWind * (t * sp);
    p.x += sin(t * 0.61 * fr + ph) * 0.55 + sin(t * 1.73 + ph * 3.1) * 0.12;
    p.z += cos(t * 0.47 * fr + ph * 1.7) * 0.55 + cos(t * 1.31 + ph * 2.3) * 0.1;
    p.y += sin(t * 0.83 * fr + ph * 2.9) * 0.4 - t * uSink * sp;
    vec2 rel = mod(p.xz - uCam.xz + uBox * 0.5, uBox) - uBox * 0.5;
    float y = mod(p.y, uHeight) + 0.04;
    vec3 world = vec3(uCam.x + rel.x, y, uCam.z + rel.y);
    vec4 mv = viewMatrix * vec4(world, 1.0);
    gl_Position = projectionMatrix * mv;
    float dist = -mv.z;
    float px = uFlake * aSeed.w * uScale / max(dist, 0.1);
    gl_PointSize = clamp(px, 1.2, 40.0);
    // fade: edges of the wrap box, the ground and the top, right at the lens,
    // and flakes too small to be more than a speck
    float edge = 1.0 - smoothstep(uBox * 0.5 - 7.0, uBox * 0.5 - 0.5, length(rel));
    float vert = smoothstep(0.04, 0.35, y) * (1.0 - smoothstep(uHeight - 2.0, uHeight, y));
    float lens = smoothstep(0.25, 0.8, dist);
    float speck = clamp(px / 2.2, 0.35, 1.0);
    vAlpha = edge * vert * lens * speck;
  }
`;

const FRAG = /* glsl */ `
  uniform vec3 uColor;
  varying float vAlpha;
  void main() {
    vec2 c = gl_PointCoord - 0.5;
    float r = length(c);
    // a fuzzy tuft: soft body, a brighter core
    float a = smoothstep(0.5, 0.12, r);
    a *= 0.55 + 0.45 * smoothstep(0.3, 0.0, r);
    if (a * vAlpha < 0.02) discard;
    gl_FragColor = vec4(uColor * (0.9 + 0.1 * smoothstep(0.3, 0.0, r)), a * vAlpha * 0.9);
  }
`;

export function createFluff(game) {
  const rand = mulberry32(2007);
  const pos = new Float32Array(COUNT * 3);
  const seed = new Float32Array(COUNT * 4);
  for (let i = 0; i < COUNT; i++) {
    pos[i * 3] = rand() * BOX;
    pos[i * 3 + 1] = rand() * HEIGHT;
    pos[i * 3 + 2] = rand() * BOX;
    seed[i * 4] = rand() * Math.PI * 2;
    seed[i * 4 + 1] = 0.6 + rand() * 0.9;
    seed[i * 4 + 2] = 0.55 + rand() * 0.9;
    // most tufts are small; a few are fat clumps
    seed[i * 4 + 3] = rand() < 0.12 ? 1.6 + rand() * 0.8 : 0.6 + rand() * 0.6;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('aSeed', new THREE.BufferAttribute(seed, 4));

  const uniforms = {
    uTime: { value: 0 },
    uBox: { value: BOX },
    uHeight: { value: HEIGHT },
    uScale: { value: 800 },
    uFlake: { value: FLAKE },
    uSink: { value: SINK },
    uCam: { value: new THREE.Vector3() },
    uWind: { value: WIND.clone() },
    // linear colour: warm white, it glows a little in the low sun
    uColor: { value: new THREE.Color(0xf7f2e4) },
  };
  const mat = new THREE.ShaderMaterial({
    uniforms,
    vertexShader: VERT,
    fragmentShader: FRAG,
    transparent: true,
    depthWrite: false,
    fog: false,
  });
  const points = new THREE.Points(geo, mat);
  points.name = 'poplar-fluff';
  points.frustumCulled = false;
  points.renderOrder = 5;
  game.scene.add(points);

  const size = new THREE.Vector2();
  return {
    points,
    update(dt) {
      uniforms.uTime.value += dt;
      uniforms.uCam.value.copy(game.camera.position);
      game.renderer.getDrawingBufferSize(size);
      const fov = THREE.MathUtils.degToRad(game.camera.fov);
      uniforms.uScale.value = size.y / (2 * Math.tan(fov / 2));
    },
  };
}
