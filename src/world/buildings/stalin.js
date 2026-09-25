import * as THREE from 'three';
import { PAL } from '../../core/palette.js';
import { rngKit, rotXZ } from '../../core/util.js';
import { signTex, FONT } from '../../core/textures.js';
import { QuadSet } from './panel.js';
import { wallMaterial, windowAtlas, cellUV, pickCell, WIN } from './facades.js';
import { placeSign } from './signs.js';

/* ------------------------------------------------------------------ *
 * A Stalin-era block (1950s): three or four storeys of ochre render with
 * white trim, the kind that lines the older stretch of the avenue.
 *
 *   - rusticated ground floor with shops behind big windows, a fascia
 *     sign over each (bilingual, as every sign was)
 *   - a white string course over the shops and a heavy white cornice
 *   - white window surrounds, little balconies with balusters
 *   - an arched gateway through to the courtyard (research c46)
 *   - a hipped metal roof with dormers and chimneys
 *
 * The street front is local -z (the side `facing` points to); the
 * courtyard side (+z) has the podyezd doors.
 *
 *   spec = { x, z, facing, length, depth, storeys, wall, roof,
 *            arch: { at, width }, shops: [{ at, width, lines, bg, fg }], seed,
 *            sheet }   a SignSheet for the fascias (optional)
 * ------------------------------------------------------------------ */

const GROUND_H = 3.9;
const UPPER_H = 3.2;
const WHITE = 0xf2f0ea;
const _up = new THREE.Vector3(0, 1, 0);
const _one = new THREE.Vector3(1, 1, 1);

function flipWinding(g) {
  const idx = g.index.array;
  for (let i = 0; i < idx.length; i += 3) { const t = idx[i + 1]; idx[i + 1] = idx[i + 2]; idx[i + 2] = t; }
  g.index.needsUpdate = true;
}

export function buildStalin(ctx, spec) {
  const {
    x, z, facing = 0, length: L = 64, depth: D = 13, storeys = 4, wall = 'stucco',
    roof = PAL.roofTin, arch = null, shops = [], seed = 5, sheet = null,
  } = spec;
  const { batch, colliders, ground } = ctx;
  /** Walkable step in local coordinates. */
  const step = (lx, lz, w, d, y) => {
    const a = toW(lx - w / 2, lz - d / 2), b = toW(lx + w / 2, lz + d / 2);
    ground.flat(Math.min(a[0], b[0]), Math.min(a[1], b[1]), Math.max(a[0], b[0]), Math.max(a[1], b[1]), y);
  };
  const rng = rngKit(seed);
  const matrix = new THREE.Matrix4().compose(new THREE.Vector3(x, 0, z), new THREE.Quaternion().setFromAxisAngle(_up, facing), _one);
  const toW = (lx, lz) => { const [a, b] = rotXZ(lx, lz, facing); return [x + a, z + b]; };
  const box = (w, h, d, color, lx, ly, lz, o = {}) => {
    const [wx, wz] = toW(lx, lz);
    batch.box(w, h, d, color, wx, ly, wz, { ...o, ry: facing + (o.ry || 0) });
  };
  const quads = new QuadSet();
  const wmat = wallMaterial(wall);
  const atlas = windowAtlas();
  const H = GROUND_H + (storeys - 1) * UPPER_H;
  const bays = Math.round(L / 3.4);
  const bayW = L / bays;
  const archAt = arch ? arch.at : null;
  const archW = arch ? arch.width : 0;
  const archH = 4.1;
  const inArch = (lx) => arch && Math.abs(lx - archAt) < archW / 2 + 0.6;

  /* ---- walls ---- */
  // upper floors: whole length, front and back
  const upH = H - GROUND_H + 0.6;
  for (const side of [-1, 1]) {
    const face = side < 0 ? '-z' : '+z';
    quads.wall(wmat, [0, GROUND_H + upH / 2 - 0.3, side * D / 2], face, L, upH, 0, GROUND_H - 0.3);
    // ground floor, split around the gateway
    if (arch) {
      const leftW = archAt - archW / 2 + L / 2, rightW = L / 2 - (archAt + archW / 2);
      quads.wall(wmat, [-L / 2 + leftW / 2, GROUND_H / 2, side * D / 2], face, leftW, GROUND_H, 0, 0);
      quads.wall(wmat, [L / 2 - rightW / 2, GROUND_H / 2, side * D / 2], face, rightW, GROUND_H, 0, 0);
      // wall above the arch (the spandrels), as a shape with an arched hole
      const sh = new THREE.Shape();
      sh.moveTo(-archW / 2, 0); sh.lineTo(archW / 2, 0); sh.lineTo(archW / 2, GROUND_H); sh.lineTo(-archW / 2, GROUND_H); sh.closePath();
      const hole = new THREE.Path();
      const rr = archW / 2;
      hole.moveTo(-rr, 0); hole.lineTo(-rr, archH - rr); hole.absarc(0, archH - rr, rr, Math.PI, 0, true); hole.lineTo(rr, 0); hole.closePath();
      sh.holes.push(hole);
      const g = new THREE.ShapeGeometry(sh, 12);
      const p = g.attributes.position;
      const uv = new Float32Array(p.count * 2);
      for (let i = 0; i < p.count; i++) {
        uv[i * 2] = (p.getX(i) + archAt + L / 2) / wmat.userData.tileW;
        uv[i * 2 + 1] = p.getY(i) / wmat.userData.tileH;
      }
      g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
      if (side < 0) { g.rotateY(Math.PI); }
      g.translate(archAt, 0, side * (D / 2 + 0.005));
      batch.add(g, { mat: wmat, matrix, color: null });
      // archivolt: a white ring around the opening
      const ring = new THREE.Shape();
      ring.absarc(0, archH - rr, rr + 0.35, Math.PI, 0, true);
      ring.lineTo(rr, archH - rr);
      ring.absarc(0, archH - rr, rr, 0, Math.PI, false);
      ring.closePath();
      const rg = new THREE.ExtrudeGeometry(ring, { depth: 0.12, bevelEnabled: false, curveSegments: 12 });
      rg.translate(archAt, 0, side < 0 ? -D / 2 - 0.12 : D / 2);
      batch.add(rg, { matrix, color: WHITE });
      for (const sx of [-1, 1]) box(0.35, archH - rr, 0.14, WHITE, archAt + sx * (rr + 0.17), 0, side * (D / 2 + 0.06));
    } else {
      quads.wall(wmat, [0, GROUND_H / 2, side * D / 2], face, L, GROUND_H, 0, 0);
    }
  }
  for (const sx of [-1, 1]) quads.wall(wmat, [sx * L / 2, H / 2, 0], sx < 0 ? '-x' : '+x', D, H, 0, 0);

  // the passage under the arch: side walls and a vaulted ceiling
  if (arch) {
    const rr = archW / 2;
    for (const sx of [-1, 1]) {
      quads.wall(wmat, [archAt + sx * rr, (archH - rr) / 2, 0], sx < 0 ? '+x' : '-x', D, archH - rr, 0, 0);
    }
    const vault = new THREE.CylinderGeometry(rr, rr, D, 14, 1, true, -Math.PI / 2, Math.PI);
    vault.rotateX(-Math.PI / 2);
    vault.translate(archAt, archH - rr, 0);
    flipWinding(vault);
    vault.computeVertexNormals();
    batch.add(vault, { matrix, color: 0xd9ccb0 });
    // cobbled floor of the passage
    box(archW, 0.02, D, PAL.concreteDark, archAt, 0.0, 0);
  }

  /* ---- rustication, string course, cornice, plinth ---- */
  // grooves on the street front, broken by the gateway, the shops and the windows
  const gaps = (y) => {
    const out = [];
    if (arch) out.push([archAt - archW / 2 - 0.35, archAt + archW / 2 + 0.35]);
    for (const s of shops) out.push([s.at - s.width / 2 - 0.1, s.at + s.width / 2 + 0.1]);
    if (y > 1.7 && y < 3.65) {
      for (let bi = 0; bi < bays; bi++) out.push([-L / 2 + (bi + 0.5) * bayW - 0.9, -L / 2 + (bi + 0.5) * bayW + 0.9]);
    }
    return out.sort((a, b) => a[0] - b[0]);
  };
  for (let y = 0.9; y < GROUND_H - 0.3; y += 0.46) {
    let a = -L / 2;
    for (const [g0, g1] of [...gaps(y), [L / 2, L / 2]]) {
      if (g0 - a > 0.15) box(g0 - a, 0.05, 0.04, 0xc99a5c, (a + g0) / 2, y, -D / 2 - 0.02);
      a = Math.max(a, g1);
    }
  }
  box(L + 0.3, 0.28, D + 0.3, WHITE, 0, GROUND_H - 0.05, 0);
  box(L + 0.9, 0.42, D + 0.9, WHITE, 0, H - 0.1, 0);
  box(L + 0.6, 0.2, D + 0.6, 0xe6e2d8, 0, H - 0.3, 0);
  for (let i = 0; i < L / 0.6; i++) {
    const lx = -L / 2 + 0.3 + i * 0.6;
    for (const side of [-1, 1]) box(0.18, 0.16, 0.16, WHITE, lx, H - 0.46, side * (D / 2 + 0.2));
  }
  box(L + 0.12, 0.85, D + 0.12, 0x8a4a3a, 0, 0, 0);

  /* ---- roof: a hip with dormers and chimneys ---- */
  const rh = 3.4;
  const ridge = L / 2 - D / 2;
  const rv = new Float32Array([
    // front slope
    -L / 2 - 0.45, H + 0.32, -D / 2 - 0.45, L / 2 + 0.45, H + 0.32, -D / 2 - 0.45, ridge, H + 0.32 + rh, 0, -ridge, H + 0.32 + rh, 0,
    // back slope
    L / 2 + 0.45, H + 0.32, D / 2 + 0.45, -L / 2 - 0.45, H + 0.32, D / 2 + 0.45, -ridge, H + 0.32 + rh, 0, ridge, H + 0.32 + rh, 0,
  ]);
  const rg = new THREE.BufferGeometry();
  rg.setAttribute('position', new THREE.BufferAttribute(rv, 3));
  rg.setIndex([0, 2, 1, 0, 3, 2, 4, 6, 5, 4, 7, 6]);
  rg.computeVertexNormals();
  batch.add(rg, { matrix, color: roof });
  const hips = new THREE.BufferGeometry();
  hips.setAttribute('position', new THREE.BufferAttribute(new Float32Array([
    -L / 2 - 0.45, H + 0.32, D / 2 + 0.45, -L / 2 - 0.45, H + 0.32, -D / 2 - 0.45, -ridge, H + 0.32 + rh, 0,
    L / 2 + 0.45, H + 0.32, -D / 2 - 0.45, L / 2 + 0.45, H + 0.32, D / 2 + 0.45, ridge, H + 0.32 + rh, 0,
  ]), 3));
  hips.setIndex([0, 2, 1, 3, 5, 4]);
  hips.computeVertexNormals();
  batch.add(hips, { matrix, color: roof });
  // seams on the metal roof
  for (let lx = -L / 2 + 1; lx < L / 2 - 1; lx += 0.9) {
    for (const side of [-1, 1]) {
      const span = Math.max(0, Math.min(1, (ridge - Math.abs(lx)) / D + 0.5));
      if (span <= 0) continue;
      const [ax, az] = toW(lx, side * (D / 2 + 0.4));
      const [bx, bz] = toW(lx, side * 0.2);
      batch.tube(ax, H + 0.36, az, bx, H + 0.36 + rh * 0.95, bz, 0.02, 0x7d8a90, { seg: 3, cast: false });
    }
  }
  for (let i = 0; i < Math.floor(L / 12); i++) {
    const lx = -L / 2 + 6 + i * 12;
    if (Math.abs(lx) > ridge - 1) continue;
    // dormer on the street slope
    box(1.3, 1.3, 1.6, WHITE, lx, H + 0.5, -D / 2 + 1.5);
    box(1.5, 0.12, 1.8, roof, lx, H + 1.8, -D / 2 + 1.5, { rx: 0.25 });
    quads.quad(atlas, [lx, H + 1.12, -D / 2 + 0.69], '-z', 0.8, 0.8, cellUV(pickCell(rng, WIN.stair)));
    // chimneys
    box(0.7, 2.2, 0.7, 0xb8a888, lx + 4, H + rh * 0.5, 1.5);
    box(0.85, 0.12, 0.85, PAL.concreteDark, lx + 4, H + rh * 0.5 + 2.2, 1.5);
  }

  /* ---- windows with white surrounds ---- */
  const shopAt = (lx) => shops.find((s) => Math.abs(lx - s.at) < s.width / 2);
  for (let bi = 0; bi < bays; bi++) {
    const lx = -L / 2 + (bi + 0.5) * bayW;
    for (const side of [-1, 1]) {
      const face = side < 0 ? '-z' : '+z';
      const zf = side * (D / 2 + 0.012);
      for (let k = 0; k < storeys; k++) {
        if (k === 0 && inArch(lx)) continue;
        if (k === 0 && side < 0 && shopAt(lx)) continue;
        const floorY = k === 0 ? 0.9 : GROUND_H + (k - 1) * UPPER_H;
        const wh = k === 0 ? 1.6 : 1.75, ww = 1.35;
        const cy = floorY + (k === 0 ? 0.95 : 0.8) + wh / 2;
        const cell = k === 0 ? pickCell(rng, WIN.grille) : pickCell(rng, WIN.flat);
        quads.quad(atlas, [lx, cy, zf], face, ww, wh, cellUV(cell));
        // surround and sill
        const zt = side * (D / 2 + 0.05);
        box(ww + 0.36, 0.14, 0.1, WHITE, lx, cy + wh / 2, zt);
        box(ww + 0.3, 0.08, 0.16, WHITE, lx, cy - wh / 2 - 0.08, side * (D / 2 + 0.08));
        box(0.14, wh, 0.08, WHITE, lx - ww / 2 - 0.1, cy - wh / 2, zt);
        box(0.14, wh, 0.08, WHITE, lx + ww / 2 + 0.1, cy - wh / 2, zt);
        if (k === 1 && side < 0) box(ww + 0.6, 0.22, 0.2, WHITE, lx, cy + wh / 2 + 0.16, side * (D / 2 + 0.1));
        // little balconies on the first upper floor, every third bay
        if (k >= 1 && k <= 2 && side < 0 && bi % 3 === 1 && !inArch(lx)) {
          const by = floorY;
          box(ww + 0.9, 0.16, 0.9, WHITE, lx, by - 0.16, -D / 2 - 0.45);
          for (let t = -(ww + 0.8) / 2; t <= (ww + 0.8) / 2 + 0.01; t += 0.22) {
            const [bx, bz] = toW(lx + t, -D / 2 - 0.84);
            batch.cyl(0.05, 0.8, WHITE, bx, by, bz, { seg: 6, rTop: 0.035 });
          }
          box(ww + 0.9, 0.08, 0.14, WHITE, lx, by + 0.8, -D / 2 - 0.84);
        }
        if (k > 0 && rng.chance(0.12)) {
          box(0.78, 0.5, 0.26, 0xeceae4, lx + ww / 2 + 0.55, floorY + 0.5, side * (D / 2 + 0.14));
        }
      }
    }
  }

  /* ---- shops: big windows, a door, a fascia sign ---- */
  for (const s of shops) {
    const n = Math.max(1, Math.round((s.width - 1.4) / 2.4));
    const w = (s.width - 1.4) / n;
    for (let i = 0; i < n; i++) {
      const lx = s.at - s.width / 2 + 0.7 + (i + 0.5) * w;
      quads.quad(atlas, [lx, 1.95, -D / 2 - 0.012], '-z', w - 0.2, 2.1, cellUV(pickCell(rng, WIN.shop)));
    }
    // door in the middle: steps up to it
    quads.quad(atlas, [s.at, 1.35, -D / 2 - 0.02], '-z', 1.3, 2.3, cellUV(WIN.door[0] + 3 + (s.at > 0 ? 1 : 0)));
    box(2.0, 0.3, 1.0, PAL.concrete, s.at, 0, -D / 2 - 0.5);
    box(2.0, 0.15, 0.5, PAL.concrete, s.at, 0, -D / 2 - 1.2);
    step(s.at, -D / 2 - 1.2, 2.0, 0.5, 0.15);
    step(s.at, -D / 2 - 0.5, 2.0, 1.0, 0.3);
    // fascia board
    const tex = signTex({ w: 512, h: 96, bg: s.bg ?? '#1f4e8c', fg: s.fg ?? '#f2c230', lines: s.lines, sizes: [1, 0.8], family: FONT.sans, stretch: 0.9, seed: seed + s.at });
    const [sx, sz] = toW(s.at, -D / 2 - 0.09);
    placeSign(ctx, sheet, tex, s.width - 0.4, 0.75, sx, GROUND_H - 0.55, sz, facing + Math.PI);
    box(s.width - 0.2, 0.85, 0.06, 0x2a2826, s.at, GROUND_H - 0.98, -D / 2 - 0.05);
  }

  /* ---- courtyard doors ---- */
  const entrances = [];
  const doorCount = Math.max(2, Math.round(L / 20));
  for (let i = 0; i < doorCount; i++) {
    let lx = -L / 2 + (i + 0.5) * (L / doorCount);
    if (inArch(lx)) lx += archW + 1.5;
    quads.quad(atlas, [lx, 1.25, D / 2 + 0.02], '+z', 1.4, 2.4, cellUV(WIN.door[0] + 3));
    box(2.2, 0.12, 1.3, WHITE, lx, 2.75, D / 2 + 0.65);
    box(2.0, 0.3, 1.2, PAL.concrete, lx, 0, D / 2 + 0.6);
    step(lx, D / 2 + 0.6, 2.0, 1.2, 0.3);
    const [ex, ez] = toW(lx, D / 2 + 1.6);
    entrances.push({ x: ex, z: ez, facing: facing + Math.PI, lx });
  }

  // gas pipe along the street front, as in c07
  {
    const [ax, az] = toW(-L / 2, -D / 2 - 0.16);
    const [bx, bz] = toW(L / 2, -D / 2 - 0.16);
    batch.tube(ax, GROUND_H + 0.35, az, bx, GROUND_H + 0.35, bz, 0.05, PAL.gasYellow, { seg: 6 });
  }

  quads.flush(batch, matrix);

  /* ---- colliders: two halves if there is a gateway ---- */
  const rect = (a0, a1) => {
    const c = [toW(a0, -D / 2 - 0.2), toW(a1, D / 2 + 0.2)];
    colliders.box(Math.min(c[0][0], c[1][0]), Math.min(c[0][1], c[1][1]), Math.max(c[0][0], c[1][0]), Math.max(c[0][1], c[1][1]), { tag: 'building' });
  };
  if (arch) { rect(-L / 2, archAt - archW / 2); rect(archAt + archW / 2, L / 2); } else rect(-L / 2, L / 2);
  return { entrances, height: H, toW };
}
