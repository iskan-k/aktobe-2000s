import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { cel } from './toon.js';
import { canvasTex, cached } from './textures.js';
import { m, mesh, paperCone, pile } from './itemKit.js';

/* ------------------------------------------------------------------ *
 * Street food and drink from the stalls, held like everything in
 * items.js (origin at the grip, +y up the item).
 *
 *   samsa      a tandyr samsa: a puffed triangle of flaky dough with
 *              sesame, lamb and onion inside
 *   cheburek   a big fried half-moon with a crimped edge and blisters
 *   belyash    a round fried patty, open in the middle over the meat
 *   shashlik   five pieces of lamb and onion on a flat steel skewer
 *   baursak    a paper cone of puffed fried dough squares
 *   tea        a piala (кесе) of black tea, the cotton-boll pattern
 *   kumys      a piala of mare's milk; shubat, camel's milk, is thicker
 *
 * Pastries are bitten from the top: each bite cuts the outline lower
 * with a double scallop of teeth and shows the filling in the cut.
 * ------------------------------------------------------------------ */

const C = {
  samsa: 0xcf8a3c, cheburek: 0xdca55c, belyash: 0xb8742e, blister: 0xe8bd72,
  mince: 0x6a3a22, onion: 0xece2cc, lamb: 0x6e3a1e, char: 0x3a2014,
  steel: 0xb4b8ba, baursak: 0xd49848, paper: 0xeae3d0, sesame: 0xf3e6c4,
};

/* ---------------- bitten outlines ---------------- */

const BITE_DEPTH = 0.011;   // how deep a row of teeth cuts under the line
const BITE_TEETH = 2;       // scallops per bite

/** Keep the part of polygon `pts` (CCW) with y <= yc (Sutherland-Hodgman). */
function clipBelow(pts, yc) {
  const out = [];
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i], b = pts[(i + 1) % pts.length];
    const aIn = a.y <= yc, bIn = b.y <= yc;
    if (aIn) out.push(a);
    if (aIn !== bIn) {
      const t = (yc - a.y) / (b.y - a.y);
      out.push(new THREE.Vector2(a.x + (b.x - a.x) * t, yc));
    }
  }
  return out;
}

/** Replace the straight cut along y = yc with a scalloped row of bites. */
function scallop(pts, yc) {
  const out = [];
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i], b = pts[(i + 1) % pts.length];
    out.push(a);
    const onCut = Math.abs(a.y - yc) < 1e-6 && Math.abs(b.y - yc) < 1e-6 && Math.abs(a.x - b.x) > 1e-4;
    if (!onCut) continue;
    const n = 10 * BITE_TEETH;
    for (let k = 1; k < n; k++) {
      const t = k / n;
      out.push(new THREE.Vector2(a.x + (b.x - a.x) * t, yc - BITE_DEPTH * Math.abs(Math.sin(Math.PI * BITE_TEETH * t))));
    }
  }
  return out;
}

/** Width of the cut through `pts` at height yc (its x span there). */
function cutSpan(pts, yc) {
  const xs = pts.filter((p) => Math.abs(p.y - yc) < 1e-6).map((p) => p.x);
  return xs.length >= 2 ? [Math.min(...xs), Math.max(...xs)] : null;
}

/**
 * A flat pastry from an outline. `stage(n)` rebuilds it cut down to
 * heights[n]; `extras` are small meshes (sesame, blisters) that hide
 * once the cut passes below them.
 */
function pastry(outline, { depth, bevel, color, filling, heights, extras = [] }) {
  const g = new THREE.Group();
  const H = Math.max(...outline.map((p) => p.y));
  const dough = m(color, { bands: 4 });
  const fill = m(filling, { bands: 'soft' });
  const cache = new Map();
  let body = null, cap = null;
  function geoFor(yc) {
    if (cache.has(yc)) return cache.get(yc);
    const pts = yc >= H ? outline : scallop(clipBelow(outline, yc), yc);
    const geo = new THREE.ExtrudeGeometry(new THREE.Shape(pts), {
      depth, bevelEnabled: true, bevelThickness: bevel, bevelSize: bevel * 0.7, bevelSegments: 3, curveSegments: 4,
    });
    geo.translate(0, 0, -depth / 2);
    const span = yc >= H ? null : cutSpan(clipBelow(outline, yc), yc);
    cache.set(yc, { geo, span });
    return cache.get(yc);
  }
  for (const e of extras) g.add(e);
  return {
    group: g,
    stage(n) {
      if (body) g.remove(body);
      if (cap) g.remove(cap);
      const yc = heights[n] ?? 0;
      extras.forEach((e) => { e.visible = yc > 0 && e.position.y < yc - BITE_DEPTH; });
      body = cap = null;
      if (yc <= 0) return;
      const { geo, span } = geoFor(yc);
      body = mesh(geo, dough);
      g.add(body);
      if (span) {
        // the filling shows in the bite, just proud of the cut
        const w = (span[1] - span[0]) * 0.72;
        cap = mesh(new THREE.BoxGeometry(w, 0.014, depth + bevel), fill, (span[0] + span[1]) / 2, yc - BITE_DEPTH - 0.004, 0);
        g.add(cap);
      }
    },
  };
}

/** Rounded triangle, apex up, base on y = 0. */
function triangleOutline(w, h, r = 0.012) {
  const c = [new THREE.Vector2(-w / 2, 0), new THREE.Vector2(w / 2, 0), new THREE.Vector2(0, h)];
  const pts = [];
  for (let i = 0; i < 3; i++) {
    const prev = c[(i + 2) % 3], p = c[i], next = c[(i + 1) % 3];
    const a = p.clone().add(prev.clone().sub(p).setLength(r));
    const b = p.clone().add(next.clone().sub(p).setLength(r));
    for (let k = 0; k <= 4; k++) {
      const t = k / 4;
      // quadratic corner from a through p to b
      pts.push(new THREE.Vector2(
        (1 - t) * (1 - t) * a.x + 2 * (1 - t) * t * p.x + t * t * b.x,
        (1 - t) * (1 - t) * a.y + 2 * (1 - t) * t * p.y + t * t * b.y,
      ));
    }
  }
  return pts;
}

/** Scatter small dots over the front face (z = +front) below height h. */
function dots(n, geo, mat, inside, front, seed) {
  let s = seed;
  const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  const out = [];
  for (let tries = 0; out.length < n && tries < n * 20; tries++) {
    const x = (rnd() - 0.5) * 0.2, y = rnd() * 0.12;
    if (!inside(x, y)) continue;
    const d = mesh(geo, mat, x, y, front);
    d.rotation.z = rnd() * 3;
    out.push(d);
  }
  return out;
}

/* ---------------- the pastries ---------------- */

function samsa() {
  const W = 0.115, H = 0.098;
  const outline = triangleOutline(W, H);
  const sesame = new THREE.SphereGeometry(0.0026, 5, 3);
  sesame.scale(1, 1.7, 0.5);
  const inside = (x, y) => y > 0.012 && y < H - 0.014 && Math.abs(x) < (W / 2) * (1 - y / H) - 0.012;
  const seeds = dots(22, sesame, m(C.sesame, { bands: 'soft' }), inside, 0.026, 5);
  return pastry(outline, {
    depth: 0.022, bevel: 0.012, color: C.samsa, filling: C.mince,
    heights: [1, 0.074, 0.052, 0.03, 0], extras: seeds,
  });
}

function cheburek() {
  const R = 0.092;
  const outline = [];
  // a half-moon, the curved edge crimped with a fork
  for (let i = 0; i <= 64; i++) {
    const a = (i / 64) * Math.PI;
    const r = R + (i > 0 && i < 64 ? 0.0018 * Math.sin(i * 2.4) : 0);
    outline.push(new THREE.Vector2(Math.cos(a) * r, Math.sin(a) * r));
  }
  const blister = new THREE.SphereGeometry(0.006, 6, 4);
  blister.scale(1, 0.75, 0.3);
  const inside = (x, y) => y > 0.01 && Math.hypot(x, y) < R - 0.014;
  const blisters = dots(9, blister, m(0xe0ad64, { bands: 'soft' }), inside, 0.01, 9);
  return pastry(outline, {
    depth: 0.008, bevel: 0.007, color: C.cheburek, filling: C.mince,
    heights: [1, 0.068, 0.046, 0.024, 0], extras: blisters,
  });
}

function belyash() {
  const R = 0.046;
  const outline = [];
  for (let i = 0; i < 40; i++) {
    const a = (i / 40) * Math.PI * 2 - Math.PI / 2;
    outline.push(new THREE.Vector2(Math.cos(a) * R, R + Math.sin(a) * R));
  }
  // the open middle, meat showing through a ring of pinched dough
  const hole = mesh(new THREE.CylinderGeometry(0.014, 0.014, 0.004, 14), m(C.mince, { bands: 'soft' }), 0, R, 0.024);
  hole.rotation.x = Math.PI / 2;
  const lip = mesh(new THREE.TorusGeometry(0.016, 0.004, 5, 14), m(C.blister, { bands: 'soft' }), 0, R, 0.023);
  return pastry(outline, {
    depth: 0.02, bevel: 0.01, color: C.belyash, filling: C.mince,
    heights: [1, 0.06, 0.034, 0], extras: [hole, lip],
  });
}

/* ---------------- shashlik ---------------- */

function shashlik() {
  const g = new THREE.Group();
  const steel = m(C.steel, { bands: 4 });
  // the flat skewer with its twisted ring handle below the fist
  g.add(mesh(new THREE.BoxGeometry(0.008, 0.36, 0.002), steel, 0, 0.06, 0));
  g.add(mesh(new THREE.TorusGeometry(0.016, 0.0025, 5, 14), steel, 0, -0.136, 0));
  const SLOTS = [0.2, 0.164, 0.128, 0.092, 0.056];
  const lambMat = [m(C.lamb, { bands: 4 }), m(0x7e4626, { bands: 4 }), m(0x5e3018, { bands: 4 })];
  const charMat = m(C.char);
  const onionMat = m(C.onion, { bands: 'soft' });
  const pieces = SLOTS.map((_, i) => {
    const p = new THREE.Group();
    const geo = new THREE.IcosahedronGeometry(0.019, 1);
    const pos = geo.attributes.position;
    for (let k = 0; k < pos.count; k++) {
      const j = Math.sin(k * 12.9 + i * 3.1) * 0.18;
      pos.setXYZ(k, pos.getX(k) * (1.05 + j), pos.getY(k) * (0.82 - j * 0.4), pos.getZ(k) * (0.9 + j * 0.5));
    }
    geo.computeVertexNormals();
    p.add(mesh(geo, lambMat[i % 3]));
    // a charred edge or two from the coals
    const c = mesh(new THREE.BoxGeometry(0.012, 0.008, 0.012), charMat, 0.013, 0.006, 0.008);
    c.rotation.set(0.4, i, 0.3);
    p.add(c);
    // and a ring of onion between the pieces
    const ring = mesh(new THREE.TorusGeometry(0.011, 0.0035, 4, 10), onionMat, 0, -0.019, 0);
    ring.rotation.x = Math.PI / 2 + 0.25;
    p.add(ring);
    p.rotation.y = i * 1.3;
    g.add(p);
    return p;
  });
  return {
    group: g,
    stage(n) {
      // eaten from the tip; the rest is pushed up the skewer
      pieces.forEach((p, i) => {
        const left = i - n;
        p.visible = left >= 0;
        if (left >= 0) p.position.y = SLOTS[left];
      });
    },
  };
}

/* ---------------- baursaks ---------------- */

function baursak() {
  const g = new THREE.Group();
  paperCone(g, null, C.paper);
  const heap = new THREE.Group();
  heap.position.y = 0.13;
  g.add(heap);
  const geo = new RoundedBoxGeometry(0.026, 0.02, 0.026, 2, 0.008);
  const mats = [m(C.baursak, { bands: 'soft' }), m(0xc88a3a, { bands: 'soft' }), m(0xdcaa5c, { bands: 'soft' })];
  const pieces = pile(7, 0.026, (rnd) => new THREE.Mesh(geo, mats[Math.floor(rnd() * 3)]), 13);
  for (const p of pieces) heap.add(p);
  return {
    group: g,
    stage(n) {
      const left = 1 - n / 5;
      pieces.forEach((p, i) => { p.visible = i < Math.round(pieces.length * left); });
      heap.position.y = 0.13 - (1 - left) * 0.045;
    },
  };
}

/* ---------------- piala ---------------- */

/** The white piala with the cobalt cotton-boll (мақта) pattern and gilt rim. */
function pialaTex() {
  return cached('item|piala', () => canvasTex(512, 128, (c, w, h) => {
    c.fillStyle = '#f6f4ee';
    c.fillRect(0, 0, w, h);
    // v runs from the foot (0) to the rim (1): canvas top is the rim
    c.fillStyle = '#c9a23a';
    c.fillRect(0, 0, w, 5);
    c.fillStyle = '#1f3f9a';
    c.fillRect(0, 9, w, 3);
    c.fillRect(0, h - 22, w, 4);
    for (let i = 0; i < 8; i++) {
      const x = (i + 0.5) * (w / 8), y = h * 0.5;
      // a boll: four rounded lobes in a net of blue lines
      c.fillStyle = '#1f3f9a';
      for (let k = 0; k < 4; k++) {
        const a = (k * Math.PI) / 2 + Math.PI / 4;
        c.beginPath();
        c.ellipse(x + Math.cos(a) * 11, y + Math.sin(a) * 11, 10, 7, a, 0, Math.PI * 2);
        c.fill();
      }
      c.fillStyle = '#f6f4ee';
      c.beginPath(); c.arc(x, y, 5, 0, Math.PI * 2); c.fill();
      c.strokeStyle = '#1f3f9a';
      c.lineWidth = 2;
      c.beginPath();
      c.moveTo(x + 26, y - 30); c.lineTo(x + 32, y + 30);
      c.stroke();
    }
  }));
}

const PIALA = [[0, 0], [0.022, 0], [0.023, 0.006], [0.021, 0.008], [0.03, 0.016], [0.04, 0.03], [0.046, 0.045], [0.048, 0.052]];

function piala(liquid, opacity) {
  const g = new THREE.Group();
  const outer = PIALA.map(([r, y]) => new THREE.Vector2(r, y));
  const bowl = mesh(new THREE.LatheGeometry(outer, 24), cel({ map: pialaTex(), grime: 0, dirt: 0, bands: 3, cache: false }), 0, -0.01, 0);
  const inner = mesh(new THREE.LatheGeometry(outer.map((p) => new THREE.Vector2(Math.max(0, p.x - 0.003), p.y + 0.002)).reverse(), 24), m(0xf6f4ee, { bands: 'soft' }), 0, -0.01, 0);
  const drink = mesh(new THREE.CylinderGeometry(1, 1, 0.003, 22), cel({ color: liquid, grime: 0, dirt: 0, bands: 'soft', transparent: opacity < 1, opacity }));
  g.add(bowl, inner, drink);
  return {
    group: g,
    stage(n) {
      const level = [0.82, 0.55, 0.3, 0][n] ?? 0;
      drink.visible = level > 0;
      const y = 0.01 + 0.036 * level;
      // the bowl flares, so the surface shrinks as the level drops
      drink.scale.set(0.024 + 0.021 * level, 1, 0.024 + 0.021 * level);
      drink.position.y = -0.01 + y;
    },
  };
}

/* ---------------- the catalogue ---------------- */

export const FOOD_ITEMS = {
  samsa: { name: 'samsa', make: samsa, bites: 4, mode: 'bite', sound: 'crunch', soundOpts: { soft: true }, grip: 0.024, lift: 0.07, done: 'The last corner of the samsa. Your fingers smell of lamb and cumin.' },
  cheburek: { name: 'cheburek', make: cheburek, bites: 4, mode: 'bite', sound: 'crunch', grip: 0.008, lift: 0.08, done: 'Gone. The juice ran down to your wrist, as it always does.' },
  belyash: { name: 'belyash', make: belyash, bites: 3, mode: 'bite', sound: 'chew', grip: 0.02, lift: 0.06, done: 'The belyash is gone. The paper napkin is see-through with oil.' },
  shashlik: { name: 'shashlik', make: shashlik, bites: 5, mode: 'bite', sound: 'chew', grip: 0.006, lift: 0.1, empty: 'skewer', done: 'Five pieces, an onion ring each. The skewer should go back to the mangal man.' },
  baursak: { name: 'baursaks', make: baursak, bites: 5, mode: 'pinch', sound: 'chew', soundOpts: { soft: true }, grip: 0.03, lift: 0.08, empty: 'paper cone', done: 'The last baursak. Still warm.' },
  tea: { name: 'tea', make: () => piala(0x8a4414, 0.92), bites: 3, mode: 'drink', sound: 'slurp', grip: 0.04, lift: 0.02, done: 'You hand the piala back. «Тағы құяйын ба?» Another?' },
  kumys: { name: 'kumys', make: () => piala(0xf1eee4, 1), bites: 3, mode: 'drink', sound: 'gulp', soundOpts: { fizz: true }, grip: 0.04, lift: 0.02, done: 'Sour, fizzy, a little smoky. The piala goes back on the table.' },
  shubat: { name: 'shubat', make: () => piala(0xf7f2e2, 1), bites: 3, mode: 'drink', sound: 'gulp', soundOpts: { fizz: false }, grip: 0.04, lift: 0.02, done: 'Thick, sour camel\'s milk. You feel healthier already.' },
};
