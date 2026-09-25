import { PAL } from '../../core/palette.js';
import { rotXZ } from '../../core/util.js';

/* ------------------------------------------------------------------ *
 * Street furniture shared by every district: lamp posts, bollards,
 * litter bins, benches. Each `add*` writes into a Batch; `facing` is a
 * yaw (0 = the object's front faces north, -z).
 * ------------------------------------------------------------------ */

/** Transform a local (x, z) offset by yaw and add the origin. */
function at(ox, oz, lx, lz, yaw) {
  const [x, z] = rotXZ(lx, lz, yaw);
  return [ox + x, oz + z];
}

/**
 * Soviet street light: a tapered grey concrete pole with a steel arm
 * reaching out over the road and a "cobra head" luminaire.
 * `facing` is the direction the arm reaches.
 */
export function addLamp(batch, x, z, facing, { y = 0, height = 9.5, double = false, steel = false } = {}) {
  // concrete on side streets; white-painted steel on the avenue
  const pole = steel ? 0xe4e2dc : PAL.concrete;
  batch.cyl(steel ? 0.12 : 0.16, height, pole, x, y, z, { rTop: steel ? 0.07 : 0.1, seg: 8 });
  batch.cyl(0.2, 0.5, steel ? 0xcfcdc6 : PAL.concreteDark, x, y, z, { seg: 8 });
  const arms = double ? [facing, facing + Math.PI] : [facing];
  for (const f of arms) {
    const dx = -Math.sin(f), dz = -Math.cos(f);
    const top = y + height - 0.3;
    const reach = 1.9;
    const arm = steel ? pole : PAL.metalGrey;
    batch.tube(x, top - 0.6, z, x + dx * reach * 0.6, top + 0.25, z + dz * reach * 0.6, 0.045, arm);
    batch.tube(x + dx * reach * 0.6, top + 0.25, z + dz * reach * 0.6, x + dx * reach, top + 0.3, z + dz * reach, 0.045, arm);
    // the cobra head, slightly nose-down
    const hx = x + dx * (reach + 0.35), hz = z + dz * (reach + 0.35);
    batch.box(0.34, 0.16, 0.8, PAL.metalGrey, hx, top + 0.18, hz, { ry: f, rx: 0.08 });
    batch.box(0.26, 0.04, 0.6, 0xf3ecd4, hx, top + 0.15, hz, { ry: f, rx: 0.08, mat: 'glow' });
  }
}

/** A green municipal litter bin (урна), the tipping kind on two posts. */
export function addBin(batch, x, z, facing = 0, y = 0) {
  const [ax, az] = at(x, z, -0.28, 0, facing);
  const [bx, bz] = at(x, z, 0.28, 0, facing);
  batch.cyl(0.025, 0.75, PAL.metalDark, ax, y, az, { seg: 5 });
  batch.cyl(0.025, 0.75, PAL.metalDark, bx, y, bz, { seg: 5 });
  batch.cyl(0.22, 0.46, PAL.fenceGreen, x, y + 0.24, z, { seg: 9, rTop: 0.25, open: true });
  batch.cyl(0.2, 0.02, PAL.metalDark, x, y + 0.26, z, { seg: 9 });
}

/**
 * Park / courtyard bench: concrete or cast-iron legs with painted slats.
 * `style` 'park' has a backrest, 'yard' is the plain backless kind.
 */
export function addBench(batch, x, z, facing = 0, { y = 0, style = 'park', color = PAL.greenPaint, len = 1.9 } = {}) {
  const legs = style === 'park' ? PAL.metalDark : PAL.concrete;
  for (const s of [-1, 1]) {
    const [lx, lz] = at(x, z, s * (len / 2 - 0.15), 0, facing);
    batch.box(0.08, 0.42, 0.45, legs, lx, y, lz, { ry: facing });
  }
  // seat slats
  for (let i = 0; i < 3; i++) {
    const [sx, sz] = at(x, z, 0, -0.14 + i * 0.14, facing);
    batch.box(len, 0.035, 0.1, color, sx, y + 0.42, sz, { ry: facing });
  }
  if (style === 'park') {
    for (let i = 0; i < 2; i++) {
      const [bx, bz] = at(x, z, 0, 0.24, facing);
      batch.box(len, 0.1, 0.035, color, bx, y + 0.56 + i * 0.16, bz, { ry: facing, rx: -0.2 });
    }
    for (const s of [-1, 1]) {
      const [px, pz] = at(x, z, s * (len / 2 - 0.15), 0.25, facing);
      batch.box(0.05, 0.42, 0.05, legs, px, y + 0.42, pz, { ry: facing, rx: -0.2 });
    }
  }
}

/** A short concrete bollard, the kind that keeps cars off a pavement. */
export function addBollard(batch, x, z, y = 0) {
  batch.cyl(0.14, 0.6, PAL.concrete, x, y, z, { seg: 8, rTop: 0.11 });
  batch.cyl(0.12, 0.08, PAL.kerbDark, x, y + 0.42, z, { seg: 8 });
}

/** A steel utility pole with crossarm, for overhead lines on side streets. */
export function addUtilityPole(batch, x, z, facing = 0, { y = 0, height = 8.5 } = {}) {
  batch.cyl(0.13, height, PAL.concrete, x, y, z, { rTop: 0.09, seg: 6 });
  const [ax, az] = at(x, z, 0, 0, facing);
  batch.box(1.6, 0.1, 0.1, PAL.woodDark, ax, y + height - 0.5, az, { ry: facing });
  for (const s of [-0.7, -0.25, 0.25, 0.7]) {
    const [ix, iz] = at(x, z, s, 0, facing);
    batch.cyl(0.035, 0.12, 0xdad6c8, ix, y + height - 0.4, iz, { seg: 5 });
  }
}

/**
 * Sagging overhead wires between consecutive pole tops.
 * `points` is [[x, y, z], ...]. Adds thin tubes.
 */
export function addWires(batch, points, { sag = 0.45, r = 0.012, color = 0x2e2c2a, offsets = [0] } = {}) {
  for (let i = 0; i < points.length - 1; i++) {
    const a = points[i], b = points[i + 1];
    for (const off of offsets) {
      const dx = b[0] - a[0], dz = b[2] - a[2];
      const len = Math.hypot(dx, dz) || 1;
      const nx = -dz / len * off, nz = dx / len * off;
      const seg = 8;
      let prev = null;
      for (let s = 0; s <= seg; s++) {
        const t = s / seg;
        const p = [a[0] + dx * t + nx, a[1] + (b[1] - a[1]) * t - Math.sin(Math.PI * t) * sag, a[2] + dz * t + nz];
        if (prev) batch.tube(prev[0], prev[1], prev[2], p[0], p[1], p[2], r, color, { seg: 3, cast: false });
        prev = p;
      }
    }
  }
}

export const STREET_Y = 0.15;
