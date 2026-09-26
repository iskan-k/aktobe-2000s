import * as THREE from 'three';
import { cel } from '../core/toon.js';
import { Batch } from '../core/batch.js';
import { SURF } from '../core/surfaces.js';
import { rngKit } from '../core/util.js';
import { BOUNDS } from './plan.js';
import { FOLIAGE_TIME, withoutGrime } from './props/foliage.js';
import { tuftTex, decalTex, DECAL } from './groundcoverTex.js';

/* ------------------------------------------------------------------ *
 * Ground cover: the small things that make a June street look lived in.
 *
 * Runs once the town is built. It reads the finished ground surfaces
 * (every batched mesh drawn with a SURF material) and adds:
 *
 *   tufts   instanced grass tufts, dandelions, chicory and yarrow on the
 *           lawns, taller and weedier along their edges, sparse weeds in
 *           the pavement and on bare earth; shown only near the camera
 *           and sunk into the ground as they fade, so there is no pop
 *   decals  on the asphalt: cast-iron manholes, gutter grates, repair
 *           patches, tar-sealed cracks, oil and damp stains, and the
 *           sandy dust that gathers in every gutter; across the bigger
 *           lawns, the trodden short-cut paths (тропинки) nobody planned
 *
 * Placement is deterministic. A point only counts as, say, lawn if the
 * highest surface over it is lawn, so nothing grows through a path laid
 * on top, and nothing grows inside a collider (walls, kiosks, trunks).
 * ------------------------------------------------------------------ */

const CHUNK = 24;           // m, tuft instancing cell
const SHOW = 38;            // m, tufts fade to nothing by this distance
const FADE_FROM = 25;       // m, and start sinking here
const CELL = 8;             // m, surface lookup grid

/* ---------------- reading the ground ---------------- */

function surfaceKinds() {
  return new Map([
    [SURF.grass, 'grass'], [SURF.yard, 'yard'], [SURF.walk, 'walk'], [SURF.asphalt, 'asphalt'],
    [SURF.slabs, 'slabs'], [SURF.sand, 'sand'], [SURF.dirt, 'dirt'],
  ]);
}

/** Upward-facing triangles of every ground surface, in a grid for lookups. */
function readGround(scene) {
  const kinds = surfaceKinds();
  const tris = [];
  scene.traverse((o) => {
    if (!o.isMesh || !kinds.has(o.material)) return;
    const kind = kinds.get(o.material);
    o.updateMatrixWorld();
    const g = o.geometry;
    const p = g.attributes.position;
    const idx = g.index ? g.index.array : null;
    const n = idx ? idx.length : p.count;
    const v = new THREE.Vector3();
    const pts = [];
    for (let i = 0; i < n; i++) {
      v.fromBufferAttribute(p, idx ? idx[i] : i).applyMatrix4(o.matrixWorld);
      pts.push(v.x, v.y, v.z);
      if (pts.length < 9) continue;
      const [ax, ay, az, bx, by, bz, cx, cy, cz] = pts;
      pts.length = 0;
      const ux = bx - ax, uy = by - ay, uz = bz - az, wx = cx - ax, wy = cy - ay, wz = cz - az;
      const nx = uy * wz - uz * wy, ny = uz * wx - ux * wz, nz = ux * wy - uy * wx;
      const len = Math.hypot(nx, ny, nz);
      if (len < 1e-6 || Math.abs(ny) / len < 0.94) continue;
      tris.push({
        kind, ax, az, bx, bz, cx, cz, y: (ay + by + cy) / 3, area: len / 2,
        x0: Math.min(ax, bx, cx), x1: Math.max(ax, bx, cx), z0: Math.min(az, bz, cz), z1: Math.max(az, bz, cz),
      });
    }
  });
  const grid = new Map();
  const big = [];   // the far earth: one huge quad, kept out of the grid
  for (const t of tris) {
    if ((t.x1 - t.x0) * (t.z1 - t.z0) > 1e5) { big.push(t); continue; }
    for (let ix = Math.floor(t.x0 / CELL); ix <= Math.floor(t.x1 / CELL); ix++) {
      for (let iz = Math.floor(t.z0 / CELL); iz <= Math.floor(t.z1 / CELL); iz++) {
        const k = ix * 100003 + iz;
        if (!grid.has(k)) grid.set(k, []);
        grid.get(k).push(t);
      }
    }
  }
  const inside = (t, x, z) => {
    const d1 = (x - t.bx) * (t.az - t.bz) - (t.ax - t.bx) * (z - t.bz);
    const d2 = (x - t.cx) * (t.bz - t.cz) - (t.bx - t.cx) * (z - t.cz);
    const d3 = (x - t.ax) * (t.cz - t.az) - (t.cx - t.ax) * (z - t.az);
    const neg = d1 < 0 || d2 < 0 || d3 < 0, pos = d1 > 0 || d2 > 0 || d3 > 0;
    return !(neg && pos);
  };
  /** The highest surface triangle over (x, z), or null. */
  const top = (x, z) => {
    let best = null;
    const list = grid.get(Math.floor(x / CELL) * 100003 + Math.floor(z / CELL));
    if (list) for (const t of list) if ((!best || t.y > best.y) && inside(t, x, z)) best = t;
    if (!best) for (const t of big) if (inside(t, x, z)) best = t;
    return best;
  };
  return { tris: tris.filter((t) => !big.includes(t)), top };
}

function insideCollider(colliders, x, z, pad) {
  for (const c of colliders.near(x - pad, z - pad, x + pad, z + pad)) {
    if (c.bottom > 0.5) continue;
    if (c.kind === 'box') {
      if (x > c.x0 - pad && x < c.x1 + pad && z > c.z0 - pad && z < c.z1 + pad) return true;
    } else if (c.kind === 'circle') {
      if ((x - c.cx) ** 2 + (z - c.cz) ** 2 < (c.r + pad) ** 2) return true;
    } else if (c.kind === 'obb') {
      const dx = x - c.cx, dz = z - c.cz;
      const lx = dx * c.cos + dz * c.sin, lz = -dx * c.sin + dz * c.cos;
      if (Math.abs(lx) < c.hx + pad && Math.abs(lz) < c.hz + pad) return true;
    }
  }
  return false;
}

/** Smooth 2D value noise in 0..1, for clumping. */
function noise2(x, z) {
  const h = (i, j) => {
    const s = Math.sin(i * 127.1 + j * 311.7) * 43758.5453;
    return s - Math.floor(s);
  };
  const i = Math.floor(x), j = Math.floor(z);
  const fx = x - i, fz = z - j;
  const ux = fx * fx * (3 - 2 * fx), uz = fz * fz * (3 - 2 * fz);
  return (h(i, j) * (1 - ux) + h(i + 1, j) * ux) * (1 - uz) + (h(i, j + 1) * (1 - ux) + h(i + 1, j + 1) * ux) * uz;
}

function randomIn(t, r) {
  let u = r.next(), v = r.next();
  if (u + v > 1) { u = 1 - u; v = 1 - v; }
  return [t.ax + (t.bx - t.ax) * u + (t.cx - t.ax) * v, t.az + (t.bz - t.az) * u + (t.cz - t.az) * v];
}

/* ---------------- tufts ---------------- */

// variants in the atlas: 0 short grass, 1 tall weedy grass, 2 dandelions,
// 3 chicory and yarrow
const TUFT_RULES = {
  grass: { density: 2.6, edge: 3.0, mix: [[0, 10], [1, 1.1], [2, 1.3], [3, 0.9]], scale: [0.55, 1.0] },
  yard: { density: 0.22, edge: 1.4, mix: [[0, 6], [1, 1.2], [2, 1], [3, 0.5]], scale: [0.5, 0.9] },
  walk: { density: 0.015, edge: 0.35, mix: [[0, 5], [1, 0.6], [2, 1]], scale: [0.4, 0.7] },
  slabs: { density: 0.03, edge: 0.3, mix: [[0, 5], [2, 1]], scale: [0.4, 0.7] },
  sand: { density: 0.05, edge: 0.4, mix: [[0, 3], [1, 2], [3, 1]], scale: [0.55, 1.0] },
  dirt: { density: 0.07, edge: 0.6, mix: [[0, 3], [1, 2.5], [3, 1]], scale: [0.6, 1.05] },
};

function tuftGeometry() {
  const g = new THREE.BufferGeometry();
  const pos = [], uv = [], nor = [], idx = [];
  const W = 0.5, H = 0.42;
  for (let k = 0; k < 3; k++) {
    const a = (k * Math.PI) / 3;
    const dx = Math.cos(a) * W / 2, dz = Math.sin(a) * W / 2;
    const b = pos.length / 3;
    pos.push(-dx, 0, -dz, dx, 0, dz, dx, H, dz, -dx, H, -dz);
    uv.push(0, 0, 1, 0, 1, 1, 0, 1);
    // grass lit like the ground it grows from
    for (let i = 0; i < 4; i++) nor.push(0, 1, 0);
    idx.push(b, b + 1, b + 2, b, b + 2, b + 3);
  }
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  g.setIndex(idx);
  return g;
}

function tuftMaterial() {
  const m = cel({ map: tuftTex(), alphaTest: 0.45, side: THREE.DoubleSide, bands: 3, grime: 0.05, dirt: 0, cache: false });
  const base = m.onBeforeCompile;
  m.onBeforeCompile = (shader, renderer) => {
    base(shader, renderer);
    withoutGrime(shader);
    shader.uniforms.uFolTime = FOLIAGE_TIME;
    shader.vertexShader = 'uniform float uFolTime;\nattribute float aVariant;\n' + shader.vertexShader
      .replace('#include <begin_vertex>', /* glsl */ `
        #include <begin_vertex>
        #ifdef USE_INSTANCING
        {
          vec3 ip = instanceMatrix[3].xyz;
          float dCam = distance( ip, cameraPosition );
          // sink into the ground on the way out, so the edge never pops
          transformed *= 1.0 - smoothstep( ${FADE_FROM.toFixed(1)}, ${SHOW.toFixed(1)}, dCam );
          float s = sin( uFolTime * 1.9 + ip.x * 0.41 + ip.z * 0.33 ) + 0.4 * sin( uFolTime * 4.3 + ip.x * 1.7 );
          transformed.x += s * 0.045 * uv.y;
          transformed.z += s * 0.03 * uv.y;
        }
        #endif
      `)
      .replace('#include <uv_vertex>', `#include <uv_vertex>
        vMapUv.x = ( vMapUv.x + aVariant ) * 0.25;`);
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <normal_fragment_begin>', `
        float faceDirection = gl_FrontFacing ? 1.0 : - 1.0;
        vec3 normal = normalize( vNormal );
        vec3 nonPerturbedNormal = normal;`)
      .replace('#include <dithering_fragment>', `#include <dithering_fragment>
        gl_FragColor.a = 0.0;`);
  };
  m.customProgramCacheKey = () => 'cel2-tuft';
  return m;
}

function scatterTufts(ground, colliders, paths, seed) {
  const r = rngKit(seed);
  const out = [];
  const inBounds = (x, z) => x > BOUNDS.x0 && x < BOUNDS.x1 && z > BOUNDS.z0 && z < BOUNDS.z1;
  const onPath = (x, z) => paths.some((p) => x > p.x0 && x < p.x1 && z > p.z0 && z < p.z1
    && p.pts.some(([px, pz]) => (px - x) ** 2 + (pz - z) ** 2 < 0.36));
  const nearEdge = (t, x, z, d) => {
    for (const [ox, oz] of [[d, 0], [-d, 0], [0, d], [0, -d]]) {
      const s = ground.top(x + ox, z + oz);
      if (!s || s.kind !== t.kind) return true;
    }
    return false;
  };
  const place = (t, x, z, rule, edge) => {
    if (!inBounds(x, z)) return;
    const s = ground.top(x, z);
    if (s !== t && (!s || s.kind !== t.kind || Math.abs(s.y - t.y) > 0.02)) return;
    if (insideCollider(colliders, x, z, 0.12)) return;
    if (t.kind === 'grass' && onPath(x, z)) return;
    let variant = r.weighted(rule.mix);
    if (edge && r.chance(0.28)) variant = 1;
    const sc = r.range(rule.scale[0], rule.scale[1]) * (edge ? 1.15 : 1) * (variant === 1 ? 1.1 : 1);
    out.push({ x, y: s.y, z, ry: r.range(0, Math.PI * 2), s: sc, v: variant, tint: r.range(0.86, 1.1) });
  };
  for (const t of ground.tris) {
    const rule = TUFT_RULES[t.kind];
    if (!rule) continue;
    // patchy: some parts of a lawn are thick with weeds, some mown bare
    const n = t.area * rule.density;
    let count = Math.floor(n) + (r.chance(n % 1) ? 1 : 0);
    for (let i = 0; i < count; i++) {
      const [x, z] = randomIn(t, r);
      const clump = noise2(x * 0.18, z * 0.18) * 0.75 + noise2(x * 0.9, z * 0.9) * 0.25;
      if (r.next() > clump * 1.5 - 0.15) continue;
      const edge = nearEdge(t, x, z, 0.7);
      place(t, x, z, rule, edge);
    }
    // the uncut strip along a lawn's kerb or fence, weeds against a wall
    count = Math.round(Math.sqrt(t.area) * 4 * rule.edge * 0.5);
    for (let i = 0; i < count; i++) {
      const [x, z] = randomIn(t, r);
      if (!nearEdge(t, x, z, 0.45)) continue;
      place(t, x, z, rule, true);
    }
  }
  return out;
}

function buildTuftChunks(scene, tufts) {
  const geo = tuftGeometry();
  const mat = tuftMaterial();
  const chunks = new Map();
  for (const t of tufts) {
    const k = `${Math.floor(t.x / CHUNK)},${Math.floor(t.z / CHUNK)}`;
    if (!chunks.has(k)) chunks.set(k, []);
    chunks.get(k).push(t);
  }
  const group = new THREE.Group();
  group.name = 'groundcover-tufts';
  const list = [];
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), p = new THREE.Vector3(), s = new THREE.Vector3();
  const up = new THREE.Vector3(0, 1, 0);
  const col = new THREE.Color();
  for (const [k, items] of chunks) {
    const mesh = new THREE.InstancedMesh(geo, mat, items.length);
    const variant = new Float32Array(items.length);
    items.forEach((t, i) => {
      q.setFromAxisAngle(up, t.ry);
      m.compose(p.set(t.x, t.y, t.z), q, s.set(t.s, t.s, t.s));
      mesh.setMatrixAt(i, m);
      mesh.setColorAt(i, col.setScalar(t.tint));
      variant[i] = t.v;
    });
    // each chunk carries its own variant attribute, so its own geometry
    mesh.geometry = geo.clone();
    mesh.geometry.setAttribute('aVariant', new THREE.InstancedBufferAttribute(variant, 1));
    mesh.castShadow = false;
    mesh.receiveShadow = true;
    mesh.computeBoundingSphere();
    const [cx, cz] = k.split(',').map((n) => (Number(n) + 0.5) * CHUNK);
    list.push({ mesh, cx, cz });
    group.add(mesh);
  }
  scene.add(group);
  return list;
}

/* ---------------- decals ---------------- */

let decalMatCache = null;
function decalMat() {
  if (!decalMatCache) {
    decalMatCache = cel({
      map: decalTex(), transparent: true, depthWrite: false, bands: 3, grime: 0.03, dirt: 0,
      polygonOffset: 3, cache: false,
    });
    const base = decalMatCache.onBeforeCompile;
    decalMatCache.onBeforeCompile = (shader, renderer) => { base(shader, renderer); withoutGrime(shader); };
    decalMatCache.customProgramCacheKey = () => 'cel2-decal';
  }
  return decalMatCache;
}

/** A flat quad centred at (x, z), rotated ry, using atlas rect `rect`. */
function decalQuad(x, y, z, w, d, ry, rect, vRepeat = 1) {
  const g = new THREE.PlaneGeometry(w, d);
  g.rotateX(-Math.PI / 2);
  g.rotateY(ry);
  g.translate(x, y, z);
  const uv = g.attributes.uv;
  for (let i = 0; i < uv.count; i++) {
    uv.setXY(i, rect[0] + uv.getX(i) * rect[2], rect[1] + uv.getY(i) * rect[3] * vRepeat);
  }
  return g;
}

/** A strip along a polyline on the ground, `rect` repeated along it. */
function decalStrip(pts, y, width, rect, metresPerTile, offset = 0) {
  const pos = [], uv = [], idx = [];
  let along = 0;
  for (let i = 0; i < pts.length; i++) {
    const [x, z] = pts[i];
    const [px, pz] = pts[Math.max(0, i - 1)];
    const [nx, nz] = pts[Math.min(pts.length - 1, i + 1)];
    let dx = nx - px, dz = nz - pz;
    const l = Math.hypot(dx, dz) || 1;
    dx /= l; dz /= l;
    if (i) along += Math.hypot(x - px, z - pz);   // pieces are shorter than one tile
    // left edge at u = 0, right edge at u = 1; offset shifts the strip sideways
    const lx = -dz, lz = dx;
    const a = offset - width / 2, b = offset + width / 2;
    pos.push(x + lx * a, y, z + lz * a, x + lx * b, y, z + lz * b);
    // the dust and path cells tile along v; each piece starts at v = 0 and
    // is shorter than one tile, so v stays inside the atlas cell
    const v = Math.min(1, along / metresPerTile);
    uv.push(rect[0], rect[1] + v * rect[3], rect[0] + rect[2], rect[1] + v * rect[3]);
    if (i) {
      const bi = (i - 1) * 2;
      idx.push(bi, bi + 1, bi + 3, bi, bi + 3, bi + 2);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(new Float32Array(pos.length).map((_, i) => (i % 3 === 1 ? 1 : 0)), 3));
  g.setIndex(idx);
  return g;
}

/** Split a polyline into pieces so no piece's v coordinate wraps. */
function stripPieces(pts, metresPerTile) {
  const pieces = [];
  let cur = [pts[0]], acc = 0;
  for (let i = 1; i < pts.length; i++) {
    const seg = Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
    if (acc + seg > metresPerTile * 0.98) {
      pieces.push(cur);
      cur = [pts[i - 1]];
      acc = 0;
    }
    cur.push(pts[i]);
    acc += seg;
  }
  if (cur.length > 1) pieces.push(cur);
  return pieces;
}

function addStrip(batch, pts, y, width, rect, metresPerTile, offset = 0) {
  const mat = decalMat();
  for (const piece of stripPieces(pts, metresPerTile)) {
    batch.add(decalStrip(piece, y, width, rect, metresPerTile, offset), { color: null, mat, cast: false });
  }
}

/** Runs of asphalt edge: the kerb line, where the gutter dust gathers. */
function asphaltEdges(ground) {
  const runs = [];
  for (const t of ground.tris) {
    if (t.kind !== 'asphalt') continue;
    const cxm = (t.ax + t.bx + t.cx) / 3, czm = (t.az + t.bz + t.cz) / 3;
    const edges = [[t.ax, t.az, t.bx, t.bz], [t.bx, t.bz, t.cx, t.cz], [t.cx, t.cz, t.ax, t.az]];
    for (const [x0, z0, x1, z1] of edges) {
      const len = Math.hypot(x1 - x0, z1 - z0);
      // only the straight, axis-aligned sides of the road pieces
      if (len < 2 || (Math.abs(x1 - x0) > 0.01 && Math.abs(z1 - z0) > 0.01)) continue;
      let nx = -(z1 - z0) / len, nz = (x1 - x0) / len;
      const mx = (x0 + x1) / 2, mz = (z0 + z1) / 2;
      if ((cxm - mx) * nx + (czm - mz) * nz > 0) { nx = -nx; nz = -nz; }   // outward
      let run = null;
      const steps = Math.floor(len);
      for (let i = 0; i <= steps; i++) {
        const f = i / Math.max(1, steps);
        const x = x0 + (x1 - x0) * f, z = z0 + (z1 - z0) * f;
        const out = ground.top(x + nx * 0.4, z + nz * 0.4);
        const edge = !out || out.kind !== 'asphalt';
        if (edge) {
          if (!run) { run = { pts: [], nx, nz, y: t.y }; runs.push(run); }
          run.pts.push([x, z]);
        } else run = null;
      }
    }
  }
  return runs.filter((r) => r.pts.length >= 3);
}

function trodPaths(ground, r) {
  const paths = [];
  for (const t of ground.tris) {
    if (t.kind !== 'grass') continue;
    const w = t.x1 - t.x0, d = t.z1 - t.z0;
    // one path per lawn quad at most (each quad is two triangles)
    if (w < 9 || d < 9 || t.area < (w * d) * 0.4 || !r.chance(0.42)) continue;
    const alongX = w > d ? true : w < d ? false : r.chance(0.5);
    const a = alongX
      ? [t.x0 + 0.2, t.z0 + d * r.range(0.2, 0.8)]
      : [t.x0 + w * r.range(0.2, 0.8), t.z0 + 0.2];
    const b = alongX
      ? [t.x1 - 0.2, t.z0 + d * r.range(0.2, 0.8)]
      : [t.x0 + w * r.range(0.2, 0.8), t.z1 - 0.2];
    const c = [t.x0 + w * r.range(0.3, 0.7), t.z0 + d * r.range(0.3, 0.7)];
    const pts = [];
    for (let i = 0; i <= 16; i++) {
      const u = i / 16;
      const x = (1 - u) ** 2 * a[0] + 2 * (1 - u) * u * c[0] + u * u * b[0] + Math.sin(u * 9 + t.x0) * 0.25;
      const z = (1 - u) ** 2 * a[1] + 2 * (1 - u) * u * c[1] + u * u * b[1] + Math.cos(u * 7 + t.z0) * 0.25;
      const s = ground.top(x, z);
      if (s && s.kind === 'grass') pts.push([x, z]);
    }
    if (pts.length < 6) continue;
    paths.push({ pts, y: t.y, x0: t.x0 - 1, x1: t.x1 + 1, z0: t.z0 - 1, z1: t.z1 + 1 });
  }
  return paths;
}

function buildDecals(scene, ground, colliders, paths, seed, stats) {
  const r = rngKit(seed);
  const batch = new Batch({ name: 'groundcover-decals', cell: 160 });
  const mat = decalMat();
  const Y = 0.012;
  const clearAsphalt = (x, z, d) => [[d, 0], [-d, 0], [0, d], [0, -d]].every(([ox, oz]) => {
    const s = ground.top(x + ox, z + oz);
    return s && s.kind === 'asphalt';
  });

  // gutter dust and grates along the kerbs
  const runs = asphaltEdges(ground);
  stats.kerbRuns = runs.length;
  for (const run of runs) {
    const lx = run.nx, lz = run.nz;
    // strip sits inside the road, its dusty edge (u = 0) against the kerb
    const pts = run.pts.map(([x, z]) => [x - lx * 0.001, z - lz * 0.001]);
    const dir = [pts[pts.length - 1][0] - pts[0][0], pts[pts.length - 1][1] - pts[0][1]];
    const leftIsOut = (-dir[1]) * lx + dir[0] * lz > 0;
    const ordered = leftIsOut ? pts : pts.slice().reverse();
    addStrip(batch, ordered, run.y + Y, 0.8, DECAL.dust, 6, -0.4);
    for (let i = 4; i < run.pts.length - 2; i += r.int(26, 44)) {
      const [x, z] = run.pts[i];
      if (insideCollider(colliders, x, z, 0.3)) continue;
      const ry = Math.atan2(lx, lz);
      batch.add(decalQuad(x - lx * 0.32, run.y + Y + 0.002, z - lz * 0.32, 0.9, 0.45, ry, DECAL.grate), { color: null, mat, cast: false });
    }
  }

  // manholes, patches, sealed cracks and stains on the carriageway
  for (const t of ground.tris) {
    if (t.kind !== 'asphalt') continue;
    const put = (n, fn) => {
      const k = Math.floor(n) + (r.chance(n % 1) ? 1 : 0);
      for (let i = 0; i < k; i++) {
        const [x, z] = randomIn(t, r);
        const s = ground.top(x, z);
        if (s !== t) continue;
        fn(x, z);
      }
    };
    put(t.area / 260, (x, z) => {
      if (!clearAsphalt(x, z, 1.6)) return;
      batch.add(decalQuad(x, t.y + Y + 0.003, z, 1.15, 1.15, r.range(0, 6.3), DECAL.manhole), { color: null, mat, cast: false });
      if (!stats.manholes++) stats.firstManhole = [x, z];
    });
    put(t.area / 320, (x, z) => {
      if (!clearAsphalt(x, z, 2.5)) return;
      batch.add(decalQuad(x, t.y + Y, z, r.range(1.6, 4.5), r.range(1.2, 3), r.pick([0, Math.PI / 2]) + r.range(-0.05, 0.05), DECAL.patch), { color: null, mat, cast: false });
    });
    put(t.area / 190, (x, z) => {
      if (!clearAsphalt(x, z, 1.5)) return;
      const len = r.range(2, 5.5);
      batch.add(decalQuad(x, t.y + Y + 0.001, z, 0.4, len, r.range(0, Math.PI), DECAL.crack), { color: null, mat, cast: false });
    });
    put(t.area / 700, (x, z) => {
      batch.add(decalQuad(x, t.y + Y + 0.001, z, r.range(1.2, 2.4), r.range(1, 2), r.range(0, 6.3), r.chance(0.5) ? DECAL.oil : DECAL.damp), { color: null, mat, cast: false });
    });
  }

  // the trodden short cuts across the lawns
  for (const p of paths) addStrip(batch, p.pts, p.y + Y, 0.8, DECAL.path, 4);

  const group = new THREE.Group();
  group.name = 'groundcover-decals';
  batch.flush(group);
  scene.add(group);
  return group;
}

/* ---------------- system ---------------- */

export function createGroundcover(game) {
  const ground = readGround(game.scene);
  const colliders = game.world.colliders;
  const r = rngKit(1907);
  const paths = trodPaths(ground, r);
  const stats = { kerbRuns: 0, manholes: 0, paths: paths.length, tufts: 0 };
  buildDecals(game.scene, ground, colliders, paths, 1908, stats);
  const chunks = buildTuftChunks(game.scene, scatterTufts(ground, colliders, paths, 1909));
  const reach = SHOW + CHUNK * 0.75;
  // chunks beyond the fade distance are hidden, checked against the camera
  // that is actually rendering (a scripted free camera moves after update)
  const prev = game.scene.onBeforeRender;
  game.scene.onBeforeRender = (renderer, scene, camera, ...rest) => {
    prev.call(scene, renderer, scene, camera, ...rest);
    const p = camera.position;
    for (const c of chunks) {
      const dx = c.cx - p.x, dz = c.cz - p.z;
      c.mesh.visible = dx * dx + dz * dz < reach * reach && p.y < 60;
    }
  };
  stats.tufts = chunks.reduce((n, c) => n + c.mesh.count, 0);
  return { stats, update() {} };
}
