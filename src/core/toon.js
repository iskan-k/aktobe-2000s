import * as THREE from 'three';
import { PAL } from './palette.js';

/* ------------------------------------------------------------------ *
 * Materials.
 *
 * The look is "cartoony but realistic": real proportions, simplified
 * shapes, flat colour with a few soft light bands, and shadow sides that
 * lean toward the cool blue-grey of a clear steppe sky instead of simply
 * going darker. Three things are patched into three.js's toon shader:
 *
 *   1. Shadow tint. The darker light bands are multiplied toward
 *      `uShadowTint`, so a wall in its own shade is blue-grey, not black.
 *      (Technique adapted from Sakura Crossing, MIT licence.)
 *   2. Grime. A two-octave world-space value noise nudges the base colour
 *      by a few percent, so a 60 m panel facade is not one flat RGB.
 *   3. Dirt line. Vertical surfaces darken and warm toward the ground,
 *      the dusty skirt every wall in a steppe town has.
 *
 * Everything static is batched with vertex colours (see batch.js), so the
 * whole town shares a small number of these programs.
 * ------------------------------------------------------------------ */

const RAMPS = {
  2: [110, 255],
  3: [100, 178, 255],
  4: [88, 150, 212, 255],
  5: [80, 128, 176, 220, 255],
  // high-key ramps, for pale masses (foliage canopies, fluff) that must
  // stay light on their shadow side
  soft: [176, 226, 255],
  // many small steps: close to smooth, for big curved things
  smooth: [70, 100, 130, 160, 190, 215, 238, 255],
};

const rampCache = new Map();

export function gradientMap(bands = 4) {
  if (rampCache.has(bands)) return rampCache.get(bands);
  const stops = RAMPS[bands] || RAMPS[4];
  const data = new Uint8Array(stops.length * 4);
  stops.forEach((s, i) => {
    data[i * 4] = data[i * 4 + 1] = data[i * 4 + 2] = s;
    data[i * 4 + 3] = 255;
  });
  const tex = new THREE.DataTexture(data, stops.length, 1, THREE.RGBAFormat);
  tex.minFilter = THREE.NearestFilter;
  tex.magFilter = THREE.NearestFilter;
  tex.generateMipmaps = false;
  tex.needsUpdate = true;
  rampCache.set(bands, tex);
  return tex;
}

const TOON_CHUNK = 'lights_toon_pars_fragment';
const TOON_LINE =
  'vec3 irradiance = getGradientIrradiance( geometryNormal, directLight.direction ) * directLight.color;';
const TOON_PATCH = `
	vec3 celBand = getGradientIrradiance( geometryNormal, directLight.direction );
	vec3 irradiance = celBand * mix( uShadowTint, vec3( 1.0 ), celBand ) * directLight.color;`;

const src = THREE.ShaderChunk[TOON_CHUNK];
const PATCH_OK = !!src && src.includes(TOON_LINE);
const PATCHED_CHUNK = PATCH_OK
  ? 'uniform vec3 uShadowTint;\n' + src.replace(TOON_LINE, TOON_PATCH)
  : src;
if (!PATCH_OK) console.warn('[toon] toon chunk changed; shadow tint disabled');

const NOISE_GLSL = /* glsl */ `
  varying vec3 vCWorld;
  uniform float uGrime;
  uniform float uDirt;
  uniform float uDirtH;
  float cHash( vec3 p ) {
    p = fract( p * 0.3183099 + 0.1 );
    p *= 17.0;
    return fract( p.x * p.y * p.z * ( p.x + p.y + p.z ) );
  }
  float cNoise( vec3 x ) {
    vec3 i = floor( x );
    vec3 f = fract( x );
    f = f * f * ( 3.0 - 2.0 * f );
    return mix(
      mix( mix( cHash( i ), cHash( i + vec3( 1, 0, 0 ) ), f.x ),
           mix( cHash( i + vec3( 0, 1, 0 ) ), cHash( i + vec3( 1, 1, 0 ) ), f.x ), f.y ),
      mix( mix( cHash( i + vec3( 0, 0, 1 ) ), cHash( i + vec3( 1, 0, 1 ) ), f.x ),
           mix( cHash( i + vec3( 0, 1, 1 ) ), cHash( i + vec3( 1, 1, 1 ) ), f.x ), f.y ),
      f.z );
  }
`;

const GRIME_FRAG = /* glsl */ `
  #include <color_fragment>
  {
    float gN = cNoise( vCWorld * 0.31 ) * 0.62 + cNoise( vCWorld * 2.7 ) * 0.38;
    diffuseColor.rgb *= 1.0 + uGrime * ( gN - 0.5 ) * 2.0;
    float gD = 1.0 - smoothstep( 0.0, uDirtH, vCWorld.y );
    diffuseColor.rgb = mix( diffuseColor.rgb, diffuseColor.rgb * vec3( 0.80, 0.74, 0.66 ), gD * uDirt );
  }
`;

const WORLD_VERT = /* glsl */ `
  #include <project_vertex>
  {
    vec4 cw = vec4( transformed, 1.0 );
    #ifdef USE_INSTANCING
      cw = instanceMatrix * cw;
    #endif
    vCWorld = ( modelMatrix * cw ).xyz;
  }
`;

function patchMaterial(mat, { tint, grime, dirt, dirtH }) {
  const uTint = { value: new THREE.Color(tint) };
  const uGrime = { value: grime };
  const uDirt = { value: dirt };
  const uDirtH = { value: dirtH };
  mat.userData.uniforms = { uShadowTint: uTint, uGrime, uDirt, uDirtH };
  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uShadowTint = uTint;
    shader.uniforms.uGrime = uGrime;
    shader.uniforms.uDirt = uDirt;
    shader.uniforms.uDirtH = uDirtH;
    shader.vertexShader = 'varying vec3 vCWorld;\n' +
      shader.vertexShader.replace('#include <project_vertex>', WORLD_VERT);
    shader.fragmentShader = NOISE_GLSL + shader.fragmentShader
      .replace(`#include <${TOON_CHUNK}>`, PATCHED_CHUNK)
      .replace('#include <color_fragment>', GRIME_FRAG);
  };
  mat.customProgramCacheKey = () => 'cel2';
  return mat;
}

const celCache = new Map();

/**
 * Cel material factory. Results are cached by parameter signature.
 *
 * @param {object} o
 * @param {number} [o.color=0xffffff]  base colour (sRGB hex); with
 *   `vertexColors` it multiplies the vertex colour, so leave it white.
 * @param {number|string} [o.bands=4]  ramp key, see RAMPS
 * @param {number} [o.grime=0.05]  world-noise strength, 0 turns it off
 * @param {number} [o.dirt=0.35]   dusty skirt strength near y = 0
 */
export function cel(o = {}) {
  const {
    color = 0xffffff,
    bands = 4,
    tint = PAL.shadowTint,
    flat: flatShading = true,   // kept for the cache key; boxes carry split normals anyway
    map = null,
    emissive = 0x000000,
    emissiveIntensity = 1,
    transparent = false,
    opacity = 1,
    side = THREE.FrontSide,
    alphaTest = 0,
    depthWrite = null,
    fog = true,
    vertexColors = false,
    grime = 0.05,
    dirt = 0.35,
    dirtH = 0.9,
    polygonOffset = 0,
    cache = true,
  } = o;

  const key = cache && !map
    ? [color, bands, tint, flatShading, emissive, emissiveIntensity, transparent, opacity,
      side, alphaTest, depthWrite, fog, vertexColors, grime, dirt, dirtH, polygonOffset].join('|')
    : null;
  if (key && celCache.has(key)) return celCache.get(key);

  const mat = new THREE.MeshToonMaterial({
    color,
    gradientMap: gradientMap(bands),
    map,
    transparent,
    opacity,
    side,
    alphaTest,
    fog,
    vertexColors,
    emissive,
    emissiveIntensity,
  });
  if (depthWrite !== null) mat.depthWrite = depthWrite;
  if (polygonOffset) {
    mat.polygonOffset = true;
    mat.polygonOffsetFactor = -polygonOffset;
    mat.polygonOffsetUnits = -polygonOffset;
  }
  patchMaterial(mat, { tint, grime, dirt, dirtH });
  if (key) celCache.set(key, mat);
  return mat;
}

const flatCache = new Map();

/** Unlit flat colour: sky, glass, lamps, signs that should not shade. */
export function flat(o = {}) {
  const {
    color = 0xffffff,
    map = null,
    transparent = false,
    opacity = 1,
    side = THREE.FrontSide,
    alphaTest = 0,
    depthWrite = null,
    fog = true,
    vertexColors = false,
    polygonOffset = 0,
    cache = true,
  } = o;
  const key = cache && !map
    ? [color, transparent, opacity, side, alphaTest, depthWrite, fog, vertexColors, polygonOffset].join('|')
    : null;
  if (key && flatCache.has(key)) return flatCache.get(key);
  const mat = new THREE.MeshBasicMaterial({
    color, map, transparent, opacity, side, alphaTest, fog, vertexColors,
  });
  if (depthWrite !== null) mat.depthWrite = depthWrite;
  if (polygonOffset) {
    mat.polygonOffset = true;
    mat.polygonOffsetFactor = -polygonOffset;
    mat.polygonOffsetUnits = -polygonOffset;
  }
  if (key) flatCache.set(key, mat);
  return mat;
}

/**
 * Material shorthands used by the batcher. `MAT.solid` is the workhorse:
 * vertex-coloured cel, so any number of differently painted parts merge
 * into one draw call.
 */
export const MAT = {
  get solid() { return cel({ vertexColors: true }); },
  get solidClean() { return cel({ vertexColors: true, grime: 0.02, dirt: 0 }); },
  get ground() { return cel({ vertexColors: true, grime: 0.07, dirt: 0, bands: 3 }); },
  get foliage() { return cel({ vertexColors: true, bands: 'soft', grime: 0.09, dirt: 0, flat: false }); },
  get glass() { return flat({ vertexColors: true }); },
  get glow() { return flat({ vertexColors: true, fog: true }); },
  get decal() { return cel({ vertexColors: true, grime: 0.06, dirt: 0, bands: 3, polygonOffset: 2 }); },
  get ink() { return flat({ color: PAL.ink }); },
};
