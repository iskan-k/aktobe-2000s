import * as THREE from 'three';
import { cel } from '../../core/toon.js';
import { canvasTex, cached } from '../../core/textures.js';
import { rngKit } from '../../core/util.js';

/* ------------------------------------------------------------------ *
 * Foliage materials and leaf cards.
 *
 * A canopy is two layers:
 *
 *   core   a few low-poly blobs with radial normals, a shade darker, the
 *          dense inner mass that also casts the shadow
 *   cards  alpha-tested quads with a drawn cluster of leaves, scattered
 *          round the blobs at random angles, so the silhouette breaks up
 *          into leafy lobes instead of facets
 *
 * Card normals point away from the centre of their blob, not along the
 * card, so the cel ramp shades the whole clump as one rounded mass and
 * the cards never flicker light and dark as they turn. Both layers sway
 * a little in the wind (a world-space sine in the vertex shader, so the
 * batched static geometry needs no per-tree data), the cards flutter on
 * top of that, and far away the cards dissolve with a screen-door fade
 * and leave the core to carry the shape.
 *
 * `FOLIAGE_TIME.value` is the wind clock; streetscape.js advances it.
 * ------------------------------------------------------------------ */

export const FOLIAGE_TIME = { value: 0 };

/* ---------------- leaf textures ---------------- */

/**
 * Leaf shapes per species, drawn in greyscale (the vertex colour gives
 * the hue). 2 x 2 atlas of cluster variants.
 *   poplar  small rounded-triangular leaves, dense and glossy
 *   elm     tiny ovals on zigzag twigs, airy
 *   broad   larger leaves in loose sprays (maple, lilac, acacia)
 *   clipped a close-shorn surface, for ball elms and hedges
 */
const LEAF = {
  poplar: { n: 70, len: [20, 30], wid: 0.85, twigs: 3, lumps: 7, tip: 1.3 },
  elm: { n: 95, len: [15, 22], wid: 0.7, twigs: 5, lumps: 6, tip: 1 },
  broad: { n: 46, len: [26, 38], wid: 0.75, twigs: 3, lumps: 5, tip: 1.15 },
  clipped: { n: 120, len: [12, 17], wid: 0.8, twigs: 0, lumps: 9, tip: 1 },
};

function leafShape(ctx, len, wid, tip) {
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.bezierCurveTo(len * 0.3, -len * wid * 0.55, len * 0.75, -len * wid * 0.45 / tip, len, 0);
  ctx.bezierCurveTo(len * 0.75, len * wid * 0.45 / tip, len * 0.3, len * wid * 0.55, 0, 0);
  ctx.fill();
}

function drawCluster(ctx, x0, y0, S, spec, r) {
  const cx = x0 + S / 2, cy = y0 + S / 2;
  const R = S * 0.36;
  ctx.save();
  ctx.beginPath();
  ctx.rect(x0, y0, S, S);
  ctx.clip();
  // a solid lumpy body, the shadowed depth of the cluster; it keeps the
  // card opaque in its smaller mipmaps, where single leaves would vanish
  const lumps = [];
  for (let i = 0; i < spec.lumps; i++) {
    const a = (i / spec.lumps) * Math.PI * 2 + r.range(-0.3, 0.3);
    const d = R * r.range(0.25, 0.55);
    lumps.push([cx + Math.cos(a) * d, cy + Math.sin(a) * d, R * r.range(0.42, 0.6)]);
  }
  lumps.push([cx, cy, R * 0.6]);
  for (const [lx, ly, lr] of lumps) {
    ctx.fillStyle = 'rgb(178,178,178)';
    ctx.beginPath(); ctx.arc(lx, ly, lr, 0, Math.PI * 2); ctx.fill();
  }
  // twigs poking out between the leaves
  ctx.strokeStyle = '#6a6254';
  ctx.lineCap = 'round';
  for (let i = 0; i < spec.twigs; i++) {
    const a = r.range(0, Math.PI * 2);
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(cx + Math.cos(a) * R * 0.5, cy + Math.sin(a) * R * 0.5);
    ctx.lineTo(cx + Math.cos(a + r.range(-0.2, 0.2)) * R * 1.25, cy + Math.sin(a + r.range(-0.2, 0.2)) * R * 1.25);
    ctx.stroke();
  }
  // leaves: back ones darker, front ones lighter and nearer the centre,
  // the outermost ones making a scalloped, leafy edge
  for (let i = 0; i < spec.n; i++) {
    const depth = i / spec.n;
    const a = r.range(0, Math.PI * 2);
    const d = R * (depth < 0.45 ? r.range(0.75, 1.12) : Math.sqrt(r.next()) * 0.95);
    const lx = cx + Math.cos(a) * d, ly = cy + Math.sin(a) * d;
    const v = Math.min(255, Math.round(196 + depth * 56 + r.range(-10, 10) - (ly - cy) / R * 10));
    ctx.fillStyle = `rgb(${v},${v},${v})`;
    ctx.save();
    ctx.translate(lx, ly);
    // leaves point outward, a little random
    ctx.rotate(a + r.range(-0.9, 0.9));
    const len = r.range(spec.len[0], spec.len[1]);
    leafShape(ctx, len, spec.wid, spec.tip);
    if (depth > 0.55 && r.chance(0.5)) {
      ctx.strokeStyle = `rgba(${v - 40},${v - 40},${v - 40},0.55)`;
      ctx.lineWidth = 1.2;
      ctx.beginPath(); ctx.moveTo(2, 0); ctx.lineTo(len * 0.8, 0); ctx.stroke();
    }
    ctx.restore();
  }
  ctx.restore();
}

function leafTex(kind) {
  return cached('leaf|' + kind, () => canvasTex(512, 512, (ctx, w) => {
    const r = rngKit(kind.length * 31 + 7);
    ctx.clearRect(0, 0, w, w);
    const S = w / 2;
    for (let i = 0; i < 4; i++) drawCluster(ctx, (i % 2) * S, Math.floor(i / 2) * S, S, LEAF[kind], r);
  }, { mips: true }));
}

/* ---------------- shader patches ---------------- */

const WIND_VERT = /* glsl */ `
  #include <begin_vertex>
  {
    // world-space sway: the batched geometry is already in world space
    float hgt = clamp( ( transformed.y - 1.8 ) / 13.0, 0.0, 1.0 );
    float ph = transformed.x * 0.071 + transformed.z * 0.053;
    float g = sin( uFolTime * 0.37 + ph * 0.6 ) * 0.5 + 0.5;
    vec2 sway = vec2( sin( uFolTime * 1.13 + ph ), cos( uFolTime * 0.87 + ph * 1.3 ) * 0.6 );
    transformed.xz += sway * ( 0.05 + 0.07 * g ) * hgt * hgt;
    #ifdef LEAF_CARD
      float f = uFolTime * 5.3 + transformed.x * 1.9 + transformed.y * 2.3 + transformed.z * 1.7;
      transformed += vec3( sin( f ), sin( f * 1.3 + 1.0 ) * 0.6, cos( f * 0.9 ) ) * 0.028 * hgt;
    #endif
  }
`;

const CARD_FRAG_NORMAL = /* glsl */ `
  float faceDirection = gl_FrontFacing ? 1.0 : - 1.0;
  // the radial clump normal, never flipped for the back of a card
  vec3 normal = normalize( vNormal );
  vec3 nonPerturbedNormal = normal;
`;

const CARD_FADE = /* glsl */ `
  #include <alphatest_fragment>
  {
    // screen-door fade with distance: the core carries the far canopy
    float dCam = distance( vCWorld, cameraPosition );
    vec2 q = floor( gl_FragCoord.xy );
    float dither = fract( 52.9829189 * fract( dot( q, vec2( 0.06711056, 0.00583715 ) ) ) );
    if ( dither < smoothstep( 85.0, 150.0, dCam ) ) discard;
  }
`;

// foliage leaves alpha 0 in the scene target: the ink pass draws the
// outline of a tree but only faint lines inside its leafy mass
const MARK_FOLIAGE = /* glsl */ `
  #include <dithering_fragment>
  gl_FragColor.a = 0.0;
`;

function withWind(mat, card) {
  const base = mat.onBeforeCompile;
  mat.onBeforeCompile = (shader, renderer) => {
    base(shader, renderer);
    shader.uniforms.uFolTime = FOLIAGE_TIME;
    shader.vertexShader = (card ? '#define LEAF_CARD\n' : '') + 'uniform float uFolTime;\n' +
      shader.vertexShader.replace('#include <begin_vertex>', WIND_VERT);
    shader.fragmentShader = shader.fragmentShader.replace('#include <dithering_fragment>', MARK_FOLIAGE);
    if (card) {
      shader.fragmentShader = shader.fragmentShader
        .replace('#include <normal_fragment_begin>', CARD_FRAG_NORMAL)
        .replace('#include <alphatest_fragment>', CARD_FADE);
    }
  };
  mat.customProgramCacheKey = () => (card ? 'cel2-leafcard' : 'cel2-leafcore');
  return mat;
}

let coreMat = null;
/** The inner canopy mass: vertex-coloured soft cel, with wind. */
export function foliageCore() {
  if (!coreMat) {
    coreMat = withWind(cel({ vertexColors: true, bands: 'soft', grime: 0.08, dirt: 0, cache: false }), false);
  }
  return coreMat;
}

const cardMats = {};
/** Leaf-card material for a leaf kind (see LEAF). */
export function foliageCard(kind = 'elm') {
  if (!cardMats[kind]) {
    const m = cel({
      vertexColors: true, bands: 'soft', map: leafTex(kind), alphaTest: 0.5,
      side: THREE.DoubleSide, grime: 0.06, dirt: 0, cache: false,
    });
    cardMats[kind] = withWind(m, true);
  }
  return cardMats[kind];
}

/* ---------------- canopy geometry ---------------- */

const _c = new THREE.Color();
const _c2 = new THREE.Color();
const _v = new THREE.Vector3();
const _a = new THREE.Vector3();
const _b = new THREE.Vector3();
const _n = new THREE.Vector3();

/** Canopy colour at a height fraction t (0 underside, 1 crown), sun side lighter. */
function canopyColor(out, t, west, base, light, dark) {
  out.set(dark).lerp(_c2.set(base), Math.min(1, t * 1.6));
  if (t > 0.62) out.lerp(_c2.set(light), (t - 0.62) * 1.4);
  if (west > 0.4) out.lerp(_c2.set(light), 0.15 * (west - 0.4) / 0.6);
  return out;
}

/**
 * A jittered ellipsoid blob with radial normals and baked colour.
 * `detail` 1 is 80 triangles; the cards give the fine outline.
 */
export function coreBlob(rng, cx, cy, cz, rx, ry, rz, { base, light, dark, shade = 0.86, detail = 1 }) {
  const g = new THREE.IcosahedronGeometry(1, detail);
  const p = g.attributes.position;
  const n = new Float32Array(p.count * 3);
  const col = new Float32Array(p.count * 3);
  const seedX = rng.range(0, 100);
  for (let i = 0; i < p.count; i++) {
    let x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    const len = Math.hypot(x, y, z) || 1;
    x /= len; y /= len; z /= len;
    const k = 1 + 0.12 * Math.sin(x * 5.1 + seedX) * Math.cos(z * 4.3 + seedX * 0.7) + 0.06 * Math.sin(y * 7.7 + seedX * 1.3);
    p.setXYZ(i, cx + x * rx * k, cy + y * ry * k, cz + z * rz * k);
    _n.set(x / rx, y / ry, z / rz).normalize();
    n[i * 3] = _n.x; n[i * 3 + 1] = _n.y; n[i * 3 + 2] = _n.z;
    canopyColor(_c, y * 0.5 + 0.5, -x, base, light, dark).multiplyScalar(shade);
    col[i * 3] = _c.r; col[i * 3 + 1] = _c.g; col[i * 3 + 2] = _c.b;
  }
  g.setAttribute('normal', new THREE.BufferAttribute(n, 3));
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  return g;
}

/**
 * Leaf cards round one blob, merged into one geometry.
 * @param {object} o
 * @param {number} o.count
 * @param {number} o.size      card edge in metres
 * @param {number} [o.shell]   how far out the cards sit (fraction of radius)
 * @param {number} [o.up]      0 random tilt, 1 cards stand upright (poplar)
 * @param {number} [o.droop]   pull card centres below the equator (birch)
 */
export function leafCards(rng, cx, cy, cz, rx, ry, rz, o) {
  const { count, size, shell = [0.72, 1.02], up = 0, droop = 0, base, light, dark } = o;
  const pos = new Float32Array(count * 12);
  const nor = new Float32Array(count * 12);
  const col = new Float32Array(count * 12);
  const uv = new Float32Array(count * 8);
  const idx = new Uint16Array(count * 6);
  for (let i = 0; i < count; i++) {
    // a direction on the sphere, a little denser on the sunny top
    let dy = rng.range(-0.75, 1) - droop * 0.5;
    dy = Math.max(-1, Math.min(1, dy));
    const a = rng.range(0, Math.PI * 2);
    const rr = Math.sqrt(1 - dy * dy);
    const dx = Math.cos(a) * rr, dz = Math.sin(a) * rr;
    const s = rng.range(shell[0], shell[1]);
    const px = cx + dx * rx * s, py = cy + dy * ry * s, pz = cz + dz * rz * s;
    // card axes: random orientation, optionally stood upright
    _v.set(rng.range(-1, 1), rng.range(-1, 1), rng.range(-1, 1)).normalize();
    if (up) _v.lerp(_n.set(dx, 0, dz), up).normalize();
    _a.set(0, 1, 0).cross(_v);
    if (_a.lengthSq() < 1e-4) _a.set(1, 0, 0);
    _a.normalize();
    _b.copy(_v).cross(_a).normalize();
    if (up) _b.lerp(_n.set(0, 1, 0), up).normalize();
    const hs = size * rng.range(0.8, 1.2) / 2;
    const sy = hs * (1 + up * 0.5);
    const corners = [[-1, -1], [1, -1], [1, 1], [-1, 1]];
    const q = rng.int(0, 3);
    const u0 = (q % 2) * 0.5, v0 = Math.floor(q / 2) * 0.5;
    // shade by height on the blob; pale on the sun side (west, -x)
    canopyColor(_c, dy * 0.5 + 0.5, -dx, base, light, dark);
    for (let k = 0; k < 4; k++) {
      const [ca, cb] = corners[k];
      const vx = px + _a.x * ca * hs + _b.x * cb * sy;
      const vy = py + _a.y * ca * hs + _b.y * cb * sy;
      const vz = pz + _a.z * ca * hs + _b.z * cb * sy;
      const o3 = i * 12 + k * 3;
      pos[o3] = vx; pos[o3 + 1] = vy; pos[o3 + 2] = vz;
      _n.set((vx - cx) / rx, (vy - cy) / ry, (vz - cz) / rz).normalize();
      nor[o3] = _n.x; nor[o3 + 1] = _n.y; nor[o3 + 2] = _n.z;
      col[o3] = _c.r; col[o3 + 1] = _c.g; col[o3 + 2] = _c.b;
      uv[i * 8 + k * 2] = u0 + (ca > 0 ? 0.5 : 0);
      uv[i * 8 + k * 2 + 1] = v0 + (cb > 0 ? 0.5 : 0);
    }
    const b = i * 4;
    idx.set([b, b + 1, b + 2, b, b + 2, b + 3], i * 6);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  g.setIndex(new THREE.BufferAttribute(idx, 1));
  return g;
}
