import { ROADS, JUNCTIONS, BOUNDS, halfWidth } from '../world/plan.js';

/* ------------------------------------------------------------------ *
 * The lane graph, derived from the master plan.
 *
 *   Lane       one lane of one road segment in one direction, between
 *              two junction stop lines (or a stop line and a portal).
 *   Connector  a path through a junction from an incoming lane end to an
 *              outgoing lane start: straight, left or right.
 *
 * Both are "paths": { len, pointAt(s, out), vehicles: [] }. A vehicle is
 * always on exactly one path at distance `s` from its start.
 *
 * Lane index 0 is the kerb lane (rightmost); higher indices are toward
 * the centre line. Right turns leave from the kerb lane, left turns from
 * the innermost, straight on from any.
 *
 * Direction: `dir` +1 travels toward increasing along-coordinate (east
 * on an x road, south on a z road). With right-hand traffic an
 * eastbound lane is on the south half (across > 0) and a southbound
 * lane on the west half (across < 0).
 * ------------------------------------------------------------------ */

const STOP_BUSY = 5.2;   // stop line setback where there is a zebra
const STOP_PLAIN = 1.2;
const CONFLICT_R = 2.3;  // two connector paths closer than this conflict

/** +1 if the right-hand side of travel is the +across side. */
export const rightSign = (road, dir) => (road.axis === 'x' ? dir : -dir);

function toWorld(road, along, across) {
  return road.axis === 'x' ? [along, road.c + across] : [road.c + across, along];
}

/** Heading (yaw) of travel along a road in direction dir. */
function headingOf(road, dir) {
  // forward = (-sin yaw, -cos yaw)
  if (road.axis === 'x') return dir > 0 ? -Math.PI / 2 : Math.PI / 2;
  return dir > 0 ? Math.PI : 0;
}

let nextId = 1;

class Lane {
  constructor(road, dir, index, a0, a1) {
    this.id = nextId++;
    this.kind = 'lane';
    this.road = road;
    this.dir = dir;
    this.index = index;
    const hw = halfWidth(road);
    this.across = rightSign(road, dir) * (hw - (index + 0.5) * road.laneW);
    // a0 -> a1 in the direction of travel
    this.a0 = a0;
    this.a1 = a1;
    [this.x0, this.z0] = toWorld(road, a0, this.across);
    [this.x1, this.z1] = toWorld(road, a1, this.across);
    this.len = Math.abs(a1 - a0);
    this.heading = headingOf(road, dir);
    this.dx = (this.x1 - this.x0) / (this.len || 1);
    this.dz = (this.z1 - this.z0) / (this.len || 1);
    this.speed = road.speed;
    this.next = [];          // connectors leaving the far end
    this.endJunction = null; // junction at the far end, or null at a portal
    this.startJunction = null;
    this.portalOut = false;  // far end leaves the map
    this.portalIn = false;   // near end is where traffic enters
    this.left = null;        // same-direction neighbour toward the centre
    this.right = null;       // same-direction neighbour toward the kerb
    this.vehicles = [];
    this.stops = [];         // transit stops on this lane: { s, stop }
  }

  pointAt(s, out) {
    out.x = this.x0 + this.dx * s;
    out.z = this.z0 + this.dz * s;
    out.heading = this.heading;
    return out;
  }
}

class Connector {
  constructor(from, to, junction, turn) {
    this.id = nextId++;
    this.kind = 'connector';
    this.from = from;
    this.to = to;
    this.junction = junction;
    this.turn = turn;
    this.vehicles = [];
    this.conflicts = new Set();
    this.speed = turn === 'S' ? Math.min(from.speed, to.speed) : turn === 'R' ? 5.5 : 7;

    const A = [from.x1, from.z1], B = [to.x0, to.z0];
    const pts = [];
    if (turn === 'S') {
      pts.push(A, B);
    } else {
      // corner where the two lane lines would meet
      const C = from.road.axis === 'x' ? [B[0], A[1]] : [A[0], B[1]];
      const k = 0.56;
      const P1 = [A[0] + (C[0] - A[0]) * k, A[1] + (C[1] - A[1]) * k];
      const P2 = [B[0] + (C[0] - B[0]) * k, B[1] + (C[1] - B[1]) * k];
      const n = 14;
      for (let i = 0; i <= n; i++) {
        const t = i / n, u = 1 - t;
        pts.push([
          u * u * u * A[0] + 3 * u * u * t * P1[0] + 3 * u * t * t * P2[0] + t * t * t * B[0],
          u * u * u * A[1] + 3 * u * u * t * P1[1] + 3 * u * t * t * P2[1] + t * t * t * B[1],
        ]);
      }
    }
    this.pts = pts;
    this.cum = [0];
    for (let i = 1; i < pts.length; i++) {
      this.cum.push(this.cum[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
    }
    this.len = this.cum[this.cum.length - 1];
  }

  pointAt(s, out) {
    const cum = this.cum, pts = this.pts;
    if (s <= 0) {
      out.x = pts[0][0]; out.z = pts[0][1];
      const d = [pts[1][0] - pts[0][0], pts[1][1] - pts[0][1]];
      out.heading = Math.atan2(-d[0], -d[1]);
      return out;
    }
    let i = 1;
    while (i < cum.length - 1 && cum[i] < s) i++;
    const seg = cum[i] - cum[i - 1] || 1e-6;
    const t = Math.min(1, (s - cum[i - 1]) / seg);
    const ax = pts[i - 1][0], az = pts[i - 1][1], bx = pts[i][0], bz = pts[i][1];
    out.x = ax + (bx - ax) * t;
    out.z = az + (bz - az) * t;
    out.heading = Math.atan2(-(bx - ax), -(bz - az));
    return out;
  }
}

function inBounds(x, z, m = 0) {
  return x >= BOUNDS.x0 - m && x <= BOUNDS.x1 + m && z >= BOUNDS.z0 - m && z <= BOUNDS.z1 + m;
}

/** Road priority at unsignalled junctions: bigger wins. */
function rank(road) {
  if (road.major) return 3;
  if (road.id === 'east') return 2;
  return 1;
}

export function buildNetwork() {
  nextId = 1;
  const lanes = [];
  const connectors = [];
  const portalsIn = [];

  /* ---- per-road junction stations ---- */
  const stations = new Map(); // road id -> [{ at, junction, setback }]
  for (const r of ROADS) stations.set(r.id, []);
  for (const j of JUNCTIONS) {
    const busy = j.rx.major || j.signal;
    const setback = busy ? STOP_BUSY : STOP_PLAIN;
    stations.get(j.rx.id).push({ at: j.x, j, stop: j.hx + setback });
    stations.get(j.rz.id).push({ at: j.z, j, stop: j.hz + setback });
  }

  /* ---- lanes ---- */
  // For each road: pieces between consecutive stations (or the road ends).
  const laneAt = new Map(); // key `${junctionId}|${arm}|in|out|${index}` -> lane
  const armOf = (road, dir, atEnd) => {
    // arm of the junction this lane touches. A lane heading east (+x)
    // ends at a junction's W arm and starts at an E arm.
    if (road.axis === 'x') return (dir > 0) === atEnd ? 'W' : 'E';
    return (dir > 0) === atEnd ? 'N' : 'S';
  };

  for (const r of ROADS) {
    const st = stations.get(r.id).sort((a, b) => a.at - b.at);
    const marks = [{ at: r.a, end: true }, ...st, { at: r.b, end: true }];
    for (let k = 0; k < marks.length - 1; k++) {
      const m0 = marks[k], m1 = marks[k + 1];
      if (m1.at - m0.at < 1) continue;
      const lo = m0.j ? m0.at + m0.stop : m0.at;
      const hi = m1.j ? m1.at - m1.stop : m1.at;
      if (hi - lo < 2) continue;
      for (const dir of [1, -1]) {
        const group = [];
        for (let i = 0; i < r.lanes; i++) {
          const lane = dir > 0 ? new Lane(r, dir, i, lo, hi) : new Lane(r, dir, i, hi, lo);
          const startM = dir > 0 ? m0 : m1;
          const endM = dir > 0 ? m1 : m0;
          lane.startJunction = startM.j || null;
          lane.endJunction = endM.j || null;
          if (!endM.j) lane.portalOut = !inBounds(lane.x1, lane.z1, -1);
          if (!startM.j) lane.portalIn = !inBounds(lane.x0, lane.z0, -1);
          if (lane.endJunction) laneAt.set(`${lane.endJunction.id}|${armOf(r, dir, true)}|in|${i}`, lane);
          if (lane.startJunction) laneAt.set(`${lane.startJunction.id}|${armOf(r, dir, false)}|out|${i}`, lane);
          if (lane.portalIn) portalsIn.push(lane);
          lanes.push(lane);
          group.push(lane);
        }
        for (let i = 0; i < group.length; i++) {
          group[i].left = group[i + 1] || null;
          group[i].right = group[i - 1] || null;
        }
      }
    }
  }

  /* ---- connectors ---- */
  // Arm geometry: approaching from arm X, which arm is straight / left / right.
  const TURNS = {
    // entering from the W arm means travelling east
    W: { S: 'E', L: 'N', R: 'S' },
    E: { S: 'W', L: 'S', R: 'N' },
    N: { S: 'S', L: 'E', R: 'W' },
    S: { S: 'N', L: 'W', R: 'E' },
  };
  for (const j of JUNCTIONS) {
    for (const inArm of ['W', 'E', 'N', 'S']) {
      if (!j.arms[inArm]) continue;
      const inRoad = inArm === 'W' || inArm === 'E' ? j.rx : j.rz;
      for (const turn of ['S', 'L', 'R']) {
        const outArm = TURNS[inArm][turn];
        if (!j.arms[outArm]) continue;
        const outRoad = outArm === 'W' || outArm === 'E' ? j.rx : j.rz;
        for (let i = 0; i < inRoad.lanes; i++) {
          const from = laneAt.get(`${j.id}|${inArm}|in|${i}`);
          if (!from) continue;
          const allowed = inRoad.lanes === 1 ||
            (turn === 'S') ||
            (turn === 'R' && i === 0) ||
            (turn === 'L' && i === inRoad.lanes - 1);
          if (!allowed) continue;
          let oi = turn === 'R' ? 0 : turn === 'L' ? outRoad.lanes - 1 : Math.min(i, outRoad.lanes - 1);
          const to = laneAt.get(`${j.id}|${outArm}|out|${oi}`);
          if (!to) continue;
          const c = new Connector(from, to, j, turn);
          c.inArm = inArm;
          c.outArm = outArm;
          c.rank = rank(inRoad);
          from.next.push(c);
          connectors.push(c);
        }
      }
    }
  }

  /* ---- conflicts ---- */
  const byJunction = new Map();
  for (const c of connectors) {
    if (!byJunction.has(c.junction)) byJunction.set(c.junction, []);
    byJunction.get(c.junction).push(c);
  }
  const tmpA = {}, tmpB = {};
  for (const list of byJunction.values()) {
    for (let a = 0; a < list.length; a++) {
      for (let b = a + 1; b < list.length; b++) {
        const A = list[a], B = list[b];
        if (A.from === B.from) continue;
        let hit = false;
        for (let s = 0; s <= A.len && !hit; s += 0.6) {
          A.pointAt(s, tmpA);
          for (let u = 0; u <= B.len; u += 0.6) {
            B.pointAt(u, tmpB);
            if (Math.hypot(tmpA.x - tmpB.x, tmpA.z - tmpB.z) < CONFLICT_R) { hit = true; break; }
          }
        }
        if (hit) { A.conflicts.add(B); B.conflicts.add(A); }
      }
    }
  }

  return { lanes, connectors, portalsIn, laneAt };
}

/** Find the lane of `road` in direction `dir`, lane `index`, containing along-coordinate `at`. */
export function findLane(net, roadId, dir, index, at) {
  for (const l of net.lanes) {
    if (l.road.id !== roadId || l.dir !== dir || l.index !== index) continue;
    const lo = Math.min(l.a0, l.a1), hi = Math.max(l.a0, l.a1);
    if (at >= lo && at <= hi) return l;
  }
  return null;
}
