/* ------------------------------------------------------------------ *
 * The master plan.
 *
 * One file says where every street, block and district is. The road
 * builder, the traffic network and every district builder read from it,
 * so nothing places itself by remembering a number from another file.
 *
 * Coordinates: metres, +x east, +z SOUTH, +y up. North is -z.
 * Traffic drives on the right.
 *
 *                 N (-z)
 *   z=-168  ==========  railway (two tracks, station platforms)  ======
 *   z=-150  |        station square, bus terminus                    |
 *   z=-112  ----------- ул. Вокзальная (Station St) -----------------
 *           | private sector |   central bazaar   |  school, shops  |
 *   z=   0  =========== пр. Абулхаир хана (the avenue, 4 lanes) =====
 *           | central square |  microdistrict     |  9-storey block |
 *           |  akimat, park  |  5-storey courts   |  boiler house   |
 *   z= 118  ----------- ул. Маресьева (South St) --------------------
 *           |        garages, waste ground, steppe edge               |
 *         x=-150           x=-20                x=110
 *
 * Road ends beyond the walkable bounds are "portals": traffic leaves the
 * map there and comes back in at another portal, so the town reads as a
 * piece of a larger city.
 * ------------------------------------------------------------------ */

export const BOUNDS = { x0: -232, x1: 232, z0: -196, z1: 158 };

/** Where the world visibly stops: beyond this is haze and backdrop. */
export const PORTAL_REACH = 460;

export const KERB_H = 0.15;     // pavement top above the carriageway
export const KERB_W = 0.18;     // kerb stone width
export const CORNER_R = 4.5;    // kerb radius at street corners
export const GROUND_Y = -0.04;  // bare earth sits just below the asphalt

/**
 * Streets. `axis: 'x'` runs east-west at z = c; `axis: 'z'` runs
 * north-south at x = c. `a`..`b` is its extent along its own axis.
 * `lanes` is per direction. `walk` is the pavement width on each side
 * (first = the -c side, i.e. north or west), `trees` the width of the
 * tree strip inside that pavement next to the kerb (0 = none). `median`
 * is the width of a raised central strip (the avenue has one, planted,
 * with the street lights down the middle, as on the real one).
 */
export const ROADS = [
  {
    id: 'ave', name: 'пр. Абулхаир хана', nameKz: 'Әбілқайыр хан даңғылы',
    axis: 'x', c: 0, a: -PORTAL_REACH, b: PORTAL_REACH,
    lanes: 2, laneW: 3.5, walk: [6.4, 6.4], trees: [2.4, 2.4],
    centre: 'median', median: 2.2, major: true, speed: 16,
  },
  {
    id: 'vokzal', name: 'ул. Вокзальная', nameKz: 'Вокзал көшесі',
    axis: 'x', c: -112, a: -150, b: PORTAL_REACH,
    lanes: 1, laneW: 3.75, walk: [3.5, 4], trees: [0, 1.6],
    centre: 'dashed', major: false, speed: 12,
  },
  {
    id: 'south', name: 'ул. Маресьева', nameKz: 'Маресьев көшесі',
    axis: 'x', c: 118, a: -PORTAL_REACH, b: PORTAL_REACH,
    lanes: 1, laneW: 3.75, walk: [4, 3], trees: [1.6, 0],
    centre: 'dashed', major: false, speed: 13,
  },
  {
    id: 'west', name: 'ул. Пушкина', nameKz: 'Пушкин көшесі',
    axis: 'z', c: -150, a: -112, b: 118,
    lanes: 1, laneW: 3.75, walk: [3, 4], trees: [0, 1.6],
    centre: 'dashed', major: false, speed: 11,
  },
  {
    id: 'mid', name: 'ул. Айтеке би', nameKz: 'Әйтеке би көшесі',
    axis: 'z', c: -20, a: -112, b: PORTAL_REACH,
    lanes: 1, laneW: 3.75, walk: [4, 4], trees: [1.6, 1.6],
    centre: 'dashed', major: false, speed: 12,
  },
  {
    id: 'east', name: 'пр. Санкибай батыра', nameKz: 'Сәңкібай батыр даңғылы',
    axis: 'z', c: 110, a: -PORTAL_REACH, b: 118,
    lanes: 1, laneW: 4.0, walk: [4, 4], trees: [1.6, 1.6],
    centre: 'double', major: false, speed: 13,
  },
];

export const RAIL = {
  z: -168,              // corridor centreline
  tracks: [-165.4, -170.6],
  gauge: 1.52,          // Russian gauge
  corridor: [-180, -156],
  crossingX: 110,       // level crossing on пр. Санкибай батыра
  platform: { x0: -120, x1: 20, z0: -162.9, z1: -158.2, y: 1.1 },
};

/**
 * Pavement stretches kept clear of street trees, poles, kiosks and
 * shelters: gates and forecourts that need to be seen and walked into.
 */
export const KEEP_CLEAR = [
  { id: 'bazaar-gate', x0: 45, x1: 67, z0: -15, z1: -7.6 },
];

/** Is (x, z) inside a keep-clear zone (grown by margin)? */
export function inKeepClear(x, z, margin = 0) {
  return KEEP_CLEAR.some((k) => x > k.x0 - margin && x < k.x1 + margin && z > k.z0 - margin && z < k.z1 + margin);
}

/** Traffic-light controlled junctions (by road id pair). */
export const SIGNALS = [
  ['ave', 'mid'],
  ['ave', 'east'],
];

export const roadById = Object.fromEntries(ROADS.map((r) => [r.id, r]));

/** Half width of the carriageway, median included. */
export const halfWidth = (r) => (r.median || 0) / 2 + r.lanes * r.laneW;

/** Distance from the road centreline to the outer edge of the pavement on side 0 / 1. */
export const outerEdge = (r, side) => halfWidth(r) + r.walk[side];

/**
 * Junctions, found by intersecting every east-west street with every
 * north-south one whose extents overlap. `kind` is 'cross' or 'tee'.
 */
export const JUNCTIONS = (() => {
  const out = [];
  for (const rx of ROADS.filter((r) => r.axis === 'x')) {
    for (const rz of ROADS.filter((r) => r.axis === 'z')) {
      const x = rz.c, z = rx.c;
      const inX = x >= rx.a - 0.01 && x <= rx.b + 0.01;
      const inZ = z >= rz.a - 0.01 && z <= rz.b + 0.01;
      if (!inX || !inZ) continue;
      const armW = x > rx.a + 0.01, armE = x < rx.b - 0.01;
      const armN = z > rz.a + 0.01, armS = z < rz.b - 0.01;
      const signal = SIGNALS.some(([a, b]) =>
        (a === rx.id && b === rz.id) || (a === rz.id && b === rx.id));
      out.push({
        id: `${rx.id}/${rz.id}`, x, z, rx, rz,
        hx: halfWidth(rz), hz: halfWidth(rx),
        arms: { W: armW, E: armE, N: armN, S: armS },
        kind: armW && armE && armN && armS ? 'cross' : 'tee',
        signal,
      });
    }
  }
  return out;
})();

/**
 * Blocks: the land between streets, measured to the back of the pavement.
 * Districts build inside these. Each is { x0, x1, z0, z1 }.
 */
function blockBetween(west, east, north, south) {
  const W = roadById[west], E = roadById[east], N = roadById[north], S = roadById[south];
  return {
    x0: W.c + outerEdge(W, 1),
    x1: E.c - outerEdge(E, 0),
    z0: N.c + outerEdge(N, 1),
    z1: S.c - outerEdge(S, 0),
  };
}

export const BLOCKS = {
  // north of the avenue
  privateSector: blockBetween('west', 'mid', 'vokzal', 'ave'),
  bazaar: blockBetween('mid', 'east', 'vokzal', 'ave'),
  school: { x0: 110 + outerEdge(roadById.east, 1), x1: BOUNDS.x1, z0: -112 + outerEdge(roadById.vokzal, 1), z1: 0 - outerEdge(roadById.ave, 0) },
  // south of the avenue
  square: blockBetween('west', 'mid', 'ave', 'south'),
  mikro: blockBetween('mid', 'east', 'ave', 'south'),
  nineStorey: { x0: 110 + outerEdge(roadById.east, 1), x1: BOUNDS.x1, z0: 0 + outerEdge(roadById.ave, 1), z1: 118 - outerEdge(roadById.south, 0) },
  // edges
  westEdge: { x0: BOUNDS.x0, x1: -150 - outerEdge(roadById.west, 0), z0: -112 + outerEdge(roadById.vokzal, 1), z1: 118 - outerEdge(roadById.south, 0) },
  station: { x0: -150, x1: BOUNDS.x1, z0: RAIL.corridor[1], z1: -112 - outerEdge(roadById.vokzal, 0) },
  southEdge: { x0: BOUNDS.x0, x1: BOUNDS.x1, z0: 118 + outerEdge(roadById.south, 1), z1: BOUNDS.z1 },
  northOfRail: { x0: BOUNDS.x0, x1: BOUNDS.x1, z0: BOUNDS.z0, z1: RAIL.corridor[0] },
};

/**
 * Where the walker starts: the avenue's north pavement at the bazaar bus
 * stop, looking east along the traffic with the evening sun behind you.
 */
export const SPAWN = { x: 29, z: -11.8, yaw: -1.85, pitch: -0.03 };

/**
 * Is (x, z) on a carriageway (including junction boxes and corner
 * fillets, approximately)? Used to keep props off the road.
 */
export function onCarriageway(x, z, margin = 0) {
  for (const r of ROADS) {
    const hw = halfWidth(r) + margin;
    if (r.axis === 'x') {
      if (x >= r.a && x <= r.b && Math.abs(z - r.c) <= hw) return true;
    } else if (z >= r.a && z <= r.b && Math.abs(x - r.c) <= hw) return true;
  }
  return false;
}

/** Is (x, z) on any street corridor (carriageway plus pavements)? */
export function onStreet(x, z, margin = 0) {
  for (const r of ROADS) {
    const n = r.c - outerEdge(r, 0) - margin, s = r.c + outerEdge(r, 1) + margin;
    if (r.axis === 'x') {
      if (x >= r.a - margin && x <= r.b + margin && z >= n && z <= s) return true;
    } else if (z >= r.a - margin && z <= r.b + margin && x >= n && x <= s) return true;
  }
  return false;
}

/* ------------------------------------------------------------------ *
 * Public transport.
 *
 * A stop is on the kerb lane of `road` travelling in `dir`, centred at
 * along-coordinate `at`. Its shelter stands on the pavement behind it.
 * Names are what the conductor would call out.
 *
 * A route is a loop of legs { road, dir }. At every junction a route
 * vehicle takes the turn onto its next leg if that road meets this one
 * here, and otherwise goes straight on. When it drives out through a
 * portal it comes back in at `entry`. `serves` lists the stops it halts
 * at; marshrutkas also stop anywhere they are hailed.
 * ------------------------------------------------------------------ */

export const STOPS = [
  { id: 'rynok-n', name: 'Центральный рынок', nameKz: 'Орталық базар', road: 'ave', dir: -1, at: 34 },
  { id: 'rynok-s', name: 'Центральный рынок', nameKz: 'Орталық базар', road: 'ave', dir: 1, at: 58 },
  { id: 'akimat-s', name: 'Акимат', nameKz: 'Әкімдік', road: 'ave', dir: 1, at: -96 },
  { id: 'akimat-n', name: 'Акимат', nameKz: 'Әкімдік', road: 'ave', dir: -1, at: -70 },
  { id: 'vokzal', name: 'Вокзал', nameKz: 'Вокзал', road: 'vokzal', dir: -1, at: -46 },
  { id: 'mkr-e', name: '12 микрорайон', nameKz: '12 шағынаудан', road: 'mid', dir: -1, at: 64 },
  { id: 'mkr-w', name: '12 микрорайон', nameKz: '12 шағынаудан', road: 'mid', dir: 1, at: 48 },
  { id: 'school-w', name: 'Школа №9', nameKz: '№9 мектеп', road: 'east', dir: 1, at: -62 },
  { id: 'school-e', name: 'Школа №9', nameKz: '№9 мектеп', road: 'east', dir: -1, at: -48 },
  { id: 'mares', name: 'ул. Маресьева', nameKz: 'Маресьев көшесі', road: 'south', dir: -1, at: 40 },
];

export const ROUTES = [
  // trolleybus route 1 runs the length of the avenue under the wires, one
  // vehicle each way; they turn back beyond the edge of the map
  {
    id: '1w', kind: 'trolleybus', label: '1', color: 0xede9da,
    via: 'Студенческая – Парк им. Пушкина',
    legs: [{ road: 'ave', dir: -1 }],
    entry: { road: 'ave', dir: -1 },
    serves: ['rynok-n', 'akimat-n'],
    count: 2,
  },
  {
    id: '1e', kind: 'trolleybus', label: '1', color: 0xede9da,
    via: 'Парк им. Пушкина – Студенческая',
    legs: [{ road: 'ave', dir: 1 }],
    entry: { road: 'ave', dir: 1 },
    serves: ['akimat-s', 'rynok-s'],
    count: 2,
  },
  {
    id: '4', kind: 'bus', label: '4', color: 0xd9a63a,
    via: 'Вокзал – Акимат – Рынок',
    legs: [{ road: 'vokzal', dir: -1 }, { road: 'west', dir: 1 }, { road: 'ave', dir: 1 }],
    entry: { road: 'vokzal', dir: -1 },
    serves: ['vokzal', 'akimat-s', 'rynok-s'],
    count: 3,
  },
  {
    id: '44', kind: 'marshrutka', label: '44',
    via: '12 мкр – Школа – Рынок',
    legs: [{ road: 'mid', dir: -1 }, { road: 'vokzal', dir: 1 }, { road: 'east', dir: 1 }, { road: 'ave', dir: -1 }, { road: 'mid', dir: 1 }],
    entry: { road: 'mid', dir: -1 },
    serves: ['mkr-e', 'school-w', 'rynok-n', 'mkr-w'],
    count: 4,
  },
  {
    id: '17', kind: 'paz', label: '17',
    via: 'Разъезд – Школа – Акимат',
    legs: [{ road: 'east', dir: 1 }, { road: 'ave', dir: -1 }],
    entry: { road: 'east', dir: 1 },
    serves: ['school-w', 'rynok-n', 'akimat-n'],
    count: 2,
  },
  {
    id: '31', kind: 'marshrutka', label: '31',
    via: 'Маресьева – 12 мкр – Школа',
    legs: [{ road: 'south', dir: -1 }, { road: 'mid', dir: -1 }, { road: 'ave', dir: 1 }, { road: 'east', dir: -1 }],
    entry: { road: 'south', dir: -1 },
    serves: ['mares', 'mkr-e', 'rynok-s', 'school-e'],
    count: 3,
  },
];

/** Fares in tenge, June 2007. */
export const FARES = { bus: 30, paz: 30, trolleybus: 25, marshrutka: 35 };

/** The trolleybus contact wires: height, and the kerb lanes they hang over. */
export const TROLLEY = { road: 'ave', wireY: 5.8, wireGap: 0.6, spacing: 30, reach: 250 };

/** World position of a stop's kerb point and its shelter spot on the pavement. */
export function stopPlacement(stop) {
  const r = roadById[stop.road];
  const hw = halfWidth(r);
  const sgn = r.axis === 'x' ? stop.dir : -stop.dir;   // right-hand side of travel
  const side = sgn > 0 ? 1 : 0;
  const kerb = sgn * hw;
  const shelter = sgn * (hw + Math.min(r.walk[side] - 1.2, 3.2));
  const w = (across) => (r.axis === 'x' ? { x: stop.at, z: r.c + across } : { x: r.c + across, z: stop.at });
  // the shelter faces the road: its front (local -z) points at the kerb
  const facing = r.axis === 'x' ? (sgn > 0 ? 0 : Math.PI) : (sgn > 0 ? Math.PI / 2 : -Math.PI / 2);
  return { kerb: w(kerb), shelter: w(shelter), facing, side, road: r };
}
