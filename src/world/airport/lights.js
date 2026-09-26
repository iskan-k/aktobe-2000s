import * as THREE from 'three';

/* ------------------------------------------------------------------ *
 * Aircraft lights: one Points object per airframe, so every light on it
 * is a single draw call. Each light is a soft additive dot of a fixed
 * size on screen, so a red wingtip still reads at a kilometre; the haze
 * dims it, but less than it dims the airframe.
 *
 *   navL navR tail            red, green, white position lights
 *   beaconTop beaconBottom    the red anti-collision beacons
 *   strobeL strobeR           white wingtip strobes
 *   landL landR taxi          landing and taxi lights, far brighter
 *                             when they point at you
 * ------------------------------------------------------------------ */

export const LIGHT_NAMES = ['navL', 'navR', 'tail', 'beaconTop', 'beaconBottom', 'strobeL', 'strobeR', 'landL', 'landR', 'taxi'];

const COLORS = {
  navL: 0xff3a2a, navR: 0x3aff6a, tail: 0xfff6e6, beaconTop: 0xff2a1a, beaconBottom: 0xff2a1a,
  strobeL: 0xffffff, strobeR: 0xffffff, landL: 0xfff2d6, landR: 0xfff2d6, taxi: 0xfff2d6,
};
const BASE = { navL: 6, navR: 6, tail: 5, beaconTop: 8, beaconBottom: 8, strobeL: 12, strobeR: 12, landL: 10, landR: 10, taxi: 7 };

const VERT = /* glsl */`
  attribute float size;
  attribute vec3 tint;
  varying vec3 vColor;
  varying float vFade;
  uniform float uScale;
  uniform float uFogFar;
  void main() {
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    float d = -mv.z;
    vFade = 1.0 - smoothstep(uFogFar * 0.5, uFogFar * 1.7, d);
    vColor = tint;
    gl_PointSize = size * uScale;
    gl_Position = projectionMatrix * mv;
  }
`;
const FRAG = /* glsl */`
  varying vec3 vColor;
  varying float vFade;
  void main() {
    vec2 p = gl_PointCoord - 0.5;
    float r = length(p) * 2.0;
    float core = smoothstep(0.35, 0.0, r);
    float halo = smoothstep(1.0, 0.0, r) * 0.45;
    float a = (core + halo) * vFade;
    if (a < 0.01) discard;
    gl_FragColor = vec4(vColor * a, a);
  }
`;

const material = new THREE.ShaderMaterial({
  vertexShader: VERT,
  fragmentShader: FRAG,
  uniforms: { uScale: { value: 1 }, uFogFar: { value: 1100 } },
  transparent: true,
  depthWrite: false,
  blending: THREE.AdditiveBlending,
});

/** Screen scale and haze distance for every light set, once a frame. */
export function setLightView(pixelHeight, fogFar) {
  material.uniforms.uScale.value = Math.max(0.5, pixelHeight / 900);
  material.uniforms.uFogFar.value = fogFar;
}

/** Build the light set for an airframe from its model-space light positions. */
export function makeLights(defs) {
  const n = LIGHT_NAMES.length;
  const pos = new Float32Array(n * 3), tint = new Float32Array(n * 3), size = new Float32Array(n);
  const c = new THREE.Color();
  LIGHT_NAMES.forEach((k, i) => {
    pos.set(defs[k], i * 3);
    c.set(COLORS[k]);
    tint.set([c.r, c.g, c.b], i * 3);
  });
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('tint', new THREE.BufferAttribute(tint, 3));
  const sizeAttr = new THREE.BufferAttribute(size, 1);
  sizeAttr.setUsage(THREE.DynamicDrawUsage);
  g.setAttribute('size', sizeAttr);
  g.computeBoundingSphere();
  g.boundingSphere.radius += 5;
  const points = new THREE.Points(g, material);
  points.frustumCulled = false;
  points.renderOrder = 5;
  return {
    points,
    /** on: { name: brightness 0..n }; everything not named is off. */
    set(on) {
      LIGHT_NAMES.forEach((k, i) => { size[i] = on[k] ? BASE[k] * on[k] : 0; });
      sizeAttr.needsUpdate = true;
      points.visible = LIGHT_NAMES.some((k) => on[k]);
    },
  };
}
