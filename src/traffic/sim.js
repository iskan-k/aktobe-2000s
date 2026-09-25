import * as THREE from 'three';
import { buildNetwork, findLane } from './network.js';
import { buildSignals } from './signals.js';
import { buildVehicle, randomType, ROUTE_TYPES, TYPES } from '../vehicles/catalog.js';
import { wheelGeometry } from '../vehicles/kit.js';
import { ROUTES, STOPS, roadById } from '../world/plan.js';
import { rngKit, clamp, damp, wrapAngle } from '../core/util.js';

/* ------------------------------------------------------------------ *
 * Traffic.
 *
 * Every vehicle rides a path (lane or junction connector) at distance
 * `s`, and its speed comes from the Intelligent Driver Model against the
 * nearest obstacle ahead: another vehicle, a red light, a junction it
 * must yield at, a closed level crossing, a bus stop it is pulling into,
 * or you. Vehicles change lanes on the avenue to get into the right lane
 * for a turn or around a bus at a stop. At unsignalled junctions the
 * bigger road has priority and equal roads yield to the right
 * ("помеха справа"), with a patience timer so four-way stand-offs clear.
 *
 * Traffic leaves through portals at the road ends and comes back in at
 * another, so the population stays constant.
 *
 * Public API (game.traffic):
 *   vehicles, net, signals
 *   addBlocker(lane, s) -> { active }   a virtual stop line (level crossing)
 *   nearestVehicle(x, z, filter)        for boarding and hailing
 *   requestStop(v, s)                   ask a route vehicle to stop on its lane
 * ------------------------------------------------------------------ */

const LOOKAHEAD = 75;
const AMBER_CLEAR = 2.5;       // m from the line: still close enough to go on amber
const AXLE_REACH = 0.34;       // axle distance from the centre, as a share of length
const TRAFFIC_COUNT = 46;
const ENGINE_VOICES = 6;

const _p = { x: 0, z: 0, heading: 0 };

export function createTraffic(game) {
  const net = buildNetwork();
  const rng = rngKit(2007);
  const root = new THREE.Group();
  root.name = 'traffic';
  game.scene.add(root);
  const signals = buildSignals(net, root);

  // stops onto lanes
  const stopById = {};
  for (const st of STOPS) {
    const lane = findLane(net, st.road, st.dir, 0, st.at);
    if (!lane) { console.warn('[traffic] stop off network', st.id); continue; }
    const s = Math.abs(st.at - lane.a0);
    const rec = { ...st, lane, s, waiting: false };
    lane.stops.push(rec);
    stopById[st.id] = rec;
  }

  const blockers = [];
  const vehicles = [];
  let nextId = 1;

  /* ------------------------------------------------------------ helpers */

  function laneGroup(lane) {
    let l = lane;
    while (l.right) l = l.right;
    const out = [];
    while (l) { out.push(l); l = l.left; }
    return out;
  }

  function setPath(v, path, s) {
    if (v.path) {
      const i = v.path.vehicles.indexOf(v);
      if (i >= 0) v.path.vehicles.splice(i, 1);
    }
    v.path = path;
    v.s = s;
    if (path) path.vehicles.push(v);
  }

  function makeVehicle(type, opts = {}) {
    const seed = 100 + nextId * 17;
    const model = buildVehicle(type, { seed, ...opts });
    root.add(model.group);
    const kind = model.kind;
    const heavy = kind === 'bus' || kind === 'truck';
    const v = {
      id: nextId++, type, kind, model,
      len: model.length, wid: model.width,
      path: null, s: 0, v: 0, acc: 0,
      lat: 0, lcCool: rng.range(1, 4),
      nextConn: null, cleared: null, desiredLane: null,
      route: null, leg: 0, served: new Set(),
      state: 'drive', dwell: 0, wait: 0, arrive: 0,
      honkT: rng.range(3, 6),
      personality: rng.range(0.86, 1.14),
      accMax: heavy ? 0.9 : kind === 'marshrutka' ? 1.7 : rng.range(1.3, 2.1),
      decComf: heavy ? 1.6 : 2.4,
      T: heavy ? 1.6 : rng.range(1.0, 1.5),
      s0: heavy ? 3.0 : 2.2,
      wheelAngle: 0, pitch: 0, roll: 0, yawRate: 0,
      x: 0, z: 0, heading: 0, lastHeading: 0,
      blinkDir: 0,
      hailed: null,       // marshrutka: stop requested at s on current lane
      passengers: 0,
      hidden: false,
      collider: { kind: 'obb', cx: 0, cz: 0, hx: model.width / 2, hz: model.length / 2, cos: 1, sin: 0, top: model.height, bottom: -1, vehicle: null },
      engine: null,
    };
    v.collider.vehicle = v;
    if (model.routeBoard && opts.routeLabel) model.routeBoard(opts.routeLabel);
    game.world.dynamic.push(v.collider);
    vehicles.push(v);
    return v;
  }

  /* ------------------------------------------------------------ routing */

  function turnOptions(lane) {
    // every movement available from any lane of this group
    const opts = new Map();
    for (const l of laneGroup(lane)) for (const c of l.next) if (!opts.has(c.turn + c.to.road.id + c.to.dir)) opts.set(c.turn + c.to.road.id + c.to.dir, c);
    return [...opts.values()];
  }

  function chooseNext(v) {
    const lane = v.path;
    v.nextConn = null;
    v.desiredLane = null;
    v.cleared = null;
    if (lane.kind !== 'lane' || lane.portalOut || !lane.next.length) return;
    const all = turnOptions(lane);
    let want = null;
    if (v.route && lane.index > 0) {
      const group = laneGroup(lane);
      const kerb = group[0];
      if (kerb.stops.some((st) => v.route.serves.includes(st.id) && !v.served.has(st.id) && st.s > v.s + 20)) {
        v.desiredLane = kerb;
        v.nextConn = lane.next.find((c) => c.turn === 'S') || lane.next[0];
        v.stopFirst = true;
        return;
      }
    }
    v.stopFirst = false;
    if (v.route) {
      const legs = v.route.legs;
      const nextLeg = legs[(v.leg + 1) % legs.length];
      want = all.find((c) => c.to.road.id === nextLeg.road && c.to.dir === nextLeg.dir) ||
        all.find((c) => c.turn === 'S') || all[0];
    } else {
      const w = all.map((c) => [c, c.turn === 'S' ? 6 : c.turn === 'R' ? 2.2 : 1.8]);
      want = rng.weighted(w);
    }
    // same movement from my own lane?
    const mine = lane.next.find((c) => c.turn === want.turn && c.to.road === want.to.road && c.to.dir === want.to.dir);
    if (mine) {
      v.nextConn = mine;
      return;
    }
    v.desiredLane = laneGroup(lane).find((l) => l.next.some((c) => c.turn === want.turn && c.to.road === want.to.road));
    v.wantTurn = want;
    // until the change happens, a fallback from my own lane
    v.nextConn = lane.next.find((c) => c.turn === 'S') || lane.next[0];
  }

  /* ------------------------------------------------------------ junction rules */

  function occupies(u, c) {
    if (u.path === c) return true;
    // front already past the stop line, committed to c
    if (u.path === c.from && u.cleared === c && u.s + u.len / 2 > c.from.len - 0.2) return true;
    // rear still inside the junction
    if (u.path === c.to && u.lastConn === c && u.s - u.len / 2 < 0.5) return true;
    return false;
  }

  function hasPriority(other, mine, j) {
    if (j.signal) {
      // permissive left turn yields to oncoming straight and right-turners
      if (mine.turn !== 'L') return false;
      const opp = { W: 'E', E: 'W', N: 'S', S: 'N' }[mine.inArm];
      return other.inArm === opp && other.turn !== 'L';
    }
    if (other.rank !== mine.rank) return other.rank > mine.rank;
    // equal roads: yield to traffic from the right
    const rightOf = { W: 'S', S: 'E', E: 'N', N: 'W' };
    return other.inArm === rightOf[mine.inArm];
  }

  function canEnter(v, c) {
    const j = c.junction;
    const distToLine = c.from.len - v.s - v.len / 2;
    if (j.signal) {
      const light = signals.stateFor(j, c.inArm);
      if (light === 'R') return false;
      // a left-turner already waiting at the line clears on amber, as they do
      if (light === 'Y' && distToLine > Math.max((v.v * v.v) / (2 * 3.2) + 1, AMBER_CLEAR)) return false;
    }
    // exit lane must have room for me
    const out = c.to;
    let room = Infinity;
    for (const u of out.vehicles) room = Math.min(room, u.s - u.len / 2);
    if (room < v.len + 1.5) return false;
    for (const other of c.conflicts) {
      for (const u of other.vehicles) if (u !== v) return false;
      for (const u of other.from.vehicles) {
        if (u === v) continue;
        if (occupies(u, other)) return false;
        // approaching with priority?
        if (u.cleared === other || (u.nextConn === other && hasPriority(other, c, j))) {
          const d = other.from.len - u.s - u.len / 2;
          const eta = d / Math.max(u.v, 0.5);
          if (u.cleared === other && d < 12) return false;
          if (hasPriority(other, c, j) && (eta < 3.2 || (d < 3 && u.v < 0.5 && u.wait < v.wait + 2))) return false;
        }
      }
      for (const u of other.to.vehicles) if (occupies(u, other)) return false;
    }
    // equal-rank stand-off breaker: waited long and nothing is physically moving in there
    return true;
  }

  /* ------------------------------------------------------------ obstacles */

  function ahead(v) {
    let gap = Infinity, lead = 0;
    let why = '';
    let tag = '';
    const consider = (g, sp) => { if (g < gap) { gap = g; lead = sp; why = tag; } };
    const half = v.len / 2;

    for (const u of v.path.vehicles) {
      if (u === v || u.s <= v.s) continue;
      tag = 'same:' + u.id;
      consider(u.s - u.len / 2 - (v.s + half), u.v);
    }

    // stop line / junction permission
    let dist = v.path.len - v.s;   // centre to end of path
    if (v.path.kind === 'lane') {
      const lane = v.path;
      // transit stop or hail point on this lane
      // IDM settles s0 short of a standing obstacle, so the stop target is
      // pushed s0 further on: the bus then halts with its centre on the stop
      const stopAt = targetStop(v);
      tag = 'stop';
      if (stopAt !== null) consider(stopAt - v.s + v.s0 - 0.2, 0);
      tag = 'blocker';
      for (const b of blockers) {
        if (b.active && b.lane === lane && b.s > v.s + half - 1) consider(b.s - v.s - half, 0);
      }
      tag = 'line';
      if (v.nextConn && v.cleared !== v.nextConn && dist - half < 45) {
        const commit = (v.v * v.v) / (2 * 4) + 0.5;
        if (canEnter(v, v.nextConn)) {
          if (dist - half < commit + 2) v.cleared = v.nextConn;
        } else if (v.nextConn.junction.signal || v.wait < 7 || !canEnterPhysically(v, v.nextConn)) {
          consider(dist - half - 1.4 + v.s0, 0);
        } else if (dist - half < 3) {
          // patience ran out and the box is empty: go
          v.cleared = v.nextConn;
        } else consider(dist - half - 1.4 + v.s0, 0);
      }
    }

    // look into the next paths
    let path = v.path.kind === 'lane' ? v.nextConn : v.path.to;
    let hops = 0;
    while (path && dist < LOOKAHEAD && hops < 3) {
      for (const u of path.vehicles) {
        if (u === v) continue;
        tag = 'next:' + u.id;
        consider(dist + u.s - u.len / 2 - half, u.v);
      }
      dist += path.len;
      path = path.kind === 'connector' ? path.to : (path === v.path ? null : null);
      hops++;
    }

    // Anything physically in front that the path logic did not see: a
    // lane changer easing across, or someone inside the junction box on a
    // crossing path. Opposing and far-off crossing traffic is left to the
    // junction rules, and two vehicles that block each other break the tie
    // by id, so nobody waits forever nose to nose.
    const fx = -Math.sin(v.heading), fz = -Math.cos(v.heading);
    const inBox = v.path.kind === 'connector' || (v.path.len - v.s < v.len / 2 + 2 && v.cleared);
    const ghost = v.path.kind === 'connector' && v.wait > 4;
    for (const u of vehicles) {
      if (ghost) break;
      if (u === v || u.hidden || u.path === v.path) continue;
      const dx = u.x - v.x, dz = u.z - v.z;
      if (dx * dx + dz * dz > 400) continue;
      const f = dx * fx + dz * fz;
      if (f <= 0) continue;
      const l = Math.abs(dx * -fz + dz * fx);
      if (l > (v.wid + u.wid) / 2 + 0.15) continue;
      const hd = Math.abs(wrapAngle(u.heading - v.heading));
      const uInBox = u.path.kind === 'connector';
      if (hd > 0.6 && !(inBox && uInBox && f < 9)) continue;
      if (u.why === 'phys:' + v.id && v.id < u.id) continue;
      tag = 'phys:' + u.id;
      consider(f - half - u.len / 2 - 0.5, hd < 0.6 ? u.v * Math.cos(hd) : 0);
    }
    const pl = playerObstacle(v, fx, fz);
    tag = 'player';
    if (pl) {
      consider(pl.gap, pl.v);
      v.blockedByPlayer = pl.gap < 12;
    } else v.blockedByPlayer = false;
    v.why = why;
    return { gap, lead };
  }

  function canEnterPhysically(v, c) {
    for (const other of c.conflicts) {
      if (other.vehicles.length) return false;
    }
    return true;
  }

  /** The walker in the road, or your car (driven or parked), ahead of v. */
  function playerObstacle(v, fx, fz) {
    const pc = game.car?.placed ? game.car : null;
    let best = null;
    const test = (px, pz, r, extra, sp) => {
      const dx = px - v.x, dz = pz - v.z;
      const f = dx * fx + dz * fz;
      if (f <= 0 || f > 40) return;
      const l = Math.abs(dx * -fz + dz * fx);
      if (l > v.wid / 2 + r + 0.5) return;
      const gap = f - v.len / 2 - extra - 0.8;
      if (!best || gap < best.gap) best = { gap, v: sp };
    };
    if (pc) {
      const along = Math.cos(pc.yaw - v.heading);
      test(pc.pos.x, pc.pos.z, pc.width / 2 + 0.2, pc.length / 2, pc.active ? Math.max(0, pc.speed * along) : 0);
    }
    if (!game.controller) test(game.player.pos.x, game.player.pos.z, 0.45, 0.3, 0);
    return best;
  }

  function targetStop(v) {
    const lane = v.path;
    if (!lane || lane.kind !== 'lane') return null;
    if (v.hailed && v.hailed.lane === lane && v.hailed.s > v.s - 0.5) return v.hailed.s;
    if (!v.route) return null;
    for (const st of lane.stops) {
      if (!v.route.serves.includes(st.id) || v.served.has(st.id)) continue;
      if (st.s > v.s - 0.5) return st.s;
    }
    return null;
  }

  /* ------------------------------------------------------------ lane changes */

  function laneGap(target, s, len) {
    let lead = null, follow = null;
    for (const u of target.vehicles) {
      if (u.s >= s) { if (!lead || u.s < lead.s) lead = u; } else if (!follow || u.s > follow.s) follow = u;
    }
    return { lead, follow };
  }

  function tryLaneChange(v, target, urgent) {
    if (!target || v.lat !== 0) return false;
    if (target.len - v.s < 25) return false;
    const { lead, follow } = laneGap(target, v.s, v.len);
    if (follow && v.s - follow.s - (v.len + follow.len) / 2 < Math.max(urgent ? 3 : 5, follow.v * (urgent ? 0.7 : 1.1))) return false;
    if (lead && lead.s - v.s - (v.len + lead.len) / 2 < Math.max(3.5, (v.v - lead.v) * 1.6)) return false;
    const from = v.path;
    const s = v.s;
    setPath(v, target, s);
    // keep the body where it was; ease sideways into the new lane
    v.lat = from.across - target.across;
    v.lcCool = urgent ? 1.5 : rng.range(4, 8);
    chooseNext(v);
    return true;
  }

  function laneChangeLogic(v, dt, gap, lead) {
    v.lcCool -= dt;
    if (v.path.kind !== 'lane' || v.lat !== 0 || v.lcCool > 0) return;
    // a bus keeps to the kerb until it has served the stop ahead
    if (v.route && targetStop(v) !== null) return;
    const lane = v.path;
    if (v.route && v.stopFirst && v.desiredLane && v.desiredLane !== lane) {
      tryLaneChange(v, lane.right, true);
      return;
    }
    if (v.desiredLane && v.desiredLane !== lane) {
      const toward = v.desiredLane.index > lane.index ? lane.left : lane.right;
      if (lane.len - v.s > 14) tryLaneChange(v, toward, true);
      return;
    }
    // stuck behind something slow (a bus at a stop, a Kamaz): overtake
    if (!v.route && gap < 28 && lead < 3 && v.v < 8 && lane.left && lane.len - v.s > 30) {
      tryLaneChange(v, lane.left, false);
      return;
    }
    // drift back to the kerb lane on a free road
    if (!v.route && lane.right && gap > 60 && rng.chance(dt * 0.1) && !v.wantTurn) tryLaneChange(v, lane.right, false);
  }

  /* ------------------------------------------------------------ spawning */

  function spawnAt(v, lane, s) {
    setPath(v, lane, s);
    v.v = lane.speed * 0.7;
    v.lat = 0;
    v.served.clear();
    v.hidden = false;
    v.model.group.visible = true;
    chooseNext(v);
    place(v, 0);
  }

  function entryClear(lane, need = 14) {
    for (const u of lane.vehicles) if (u.s - u.len / 2 < need) return false;
    return true;
  }

  function respawn(v) {
    if (v.route) {
      const e = v.route.entry;
      const lane = net.portalsIn.find((l) => l.road.id === e.road && l.dir === e.dir && l.index === 0);
      if (lane && entryClear(lane)) { v.leg = 0; spawnAt(v, lane, 0); return true; }
      return false;
    }
    const lane = rng.pick(net.portalsIn);
    if (!entryClear(lane)) return false;
    spawnAt(v, lane, 0);
    return true;
  }

  function hide(v) {
    setPath(v, null, 0);
    v.hidden = true;
    v.model.group.visible = false;
    v.collider.cx = 1e5;
    v.respawnT = rng.range(0.5, 4);
  }

  /* ------------------------------------------------------------ motion */

  function advance(v, ds) {
    v.s += ds;
    let guard = 0;
    while (v.path && v.s > v.path.len && guard++ < 4) {
      const over = v.s - v.path.len;
      const p = v.path;
      if (p.kind === 'lane') {
        if (p.portalOut || !v.nextConn) { hide(v); return; }
        const c = v.nextConn;
        v.lastConn = null;
        v.lat = 0;
        setPath(v, c, over);
        if (v.route) {
          const legs = v.route.legs;
          const nextLeg = legs[(v.leg + 1) % legs.length];
          if (c.to.road.id === nextLeg.road && c.to.dir === nextLeg.dir) v.leg = (v.leg + 1) % legs.length;
        }
      } else {
        v.lastConn = p;
        setPath(v, p.to, over);
        v.wantTurn = null;
        chooseNext(v);
      }
    }
  }

  function place(v, dt) {
    v.path.pointAt(Math.min(v.s, v.path.len), _p);
    let x = _p.x, z = _p.z;
    let heading = _p.heading;
    if (v.lat !== 0 && v.path.kind === 'lane') {
      const alongX = v.path.road.axis === 'x';
      if (alongX) z += v.lat; else x += v.lat;
      // yaw into the lane change: lateral speed against forward speed
      if (dt > 0) {
        const latVel = (v.lat - (v.prevLat ?? v.lat)) / dt;
        // +lat is +z on an x road, +x on a z road; convert to "left of travel"
        const fx = -Math.sin(heading), fz = -Math.cos(heading);
        const lx = alongX ? 0 : 1, lz = alongX ? 1 : 0;
        const rightDot = lx * -fz + lz * fx;   // + if +lat points to the right
        heading -= Math.atan2(latVel * rightDot, Math.max(v.v, 1.5)) * 0.9;
      }
    }
    v.prevLat = v.lat;
    if (dt > 0) v.yawRate = wrapAngle(heading - v.heading) / dt;
    v.x = x; v.z = z; v.heading = heading;
  }

  function dwellLogic(v, dt) {
    // at a stop (route) or a hail point: open doors, wait, close
    v.dwell -= dt;
    const t = v.doorT ?? 0;
    const opening = v.dwell > 1.2;
    v.doorT = clamp(t + (opening ? dt * 1.6 : -dt * 1.6), 0, 1);
    for (const d of v.model.doors) d.set(v.doorT);
    if (v.dwell <= 0 && v.doorT <= 0 && !v.holdDoors) {
      v.state = 'drive';
      v.hailed = null;
      if (v.replan && v.path.kind === 'lane') { v.replan = false; chooseNext(v); }
    }
  }

  function arriveAtStop(v) {
    const lane = v.path;
    let st = null;
    if (v.route) st = lane.stops.find((x) => v.route.serves.includes(x.id) && !v.served.has(x.id) && Math.abs(x.s - v.s) < 1.5);
    if (st) { v.served.add(st.id); v.replan = true; }
    const hailHere = v.hailed && Math.abs(v.hailed.s - v.s) < 1.5;
    if (!st && !hailHere) return false;
    v.state = 'dwell';
    v.dwell = st ? rng.range(6, 10) : 5;
    v.atStop = st;
    game.audio.play('door', { pos: { x: v.x, y: 1.5, z: v.z }, volume: 0.9 });
    game.transit?.onArrive?.(v, st);
    return true;
  }

  function stepVehicle(v, dt) {
    if (v.hidden) {
      v.respawnT -= dt;
      if (v.respawnT <= 0 && !respawn(v)) v.respawnT = 0.7;
      return;
    }
    if (v.state === 'dwell') {
      dwellLogic(v, dt);
      v.v = 0;
      v.acc = 0;
      updateModel(v, dt, 0);
      return;
    }
    const { gap, lead } = ahead(v);
    laneChangeLogic(v, dt, gap, lead);

    let v0 = (v.path.speed || 10) * (v.route ? 0.95 : v.personality);
    // slow for the coming turn
    if (v.path.kind === 'lane' && v.nextConn && v.nextConn.turn !== 'S') {
      const d = v.path.len - v.s;
      v0 = Math.min(v0, Math.sqrt(v.nextConn.speed * v.nextConn.speed + 2 * 1.6 * Math.max(0, d - 4)));
    }
    const dv = v.v - lead;
    const sStar = v.s0 + Math.max(0, v.v * v.T + (v.v * dv) / (2 * Math.sqrt(v.accMax * v.decComf)));
    const free = 1 - Math.pow(v.v / Math.max(v0, 0.5), 4);
    const inter = gap < Infinity ? Math.pow(sStar / Math.max(gap, 0.05), 2) : 0;
    let acc = v.accMax * (free - inter);
    acc = clamp(acc, -8, v.accMax);
    // do not creep backwards, and settle cleanly when stopped at a line
    v.v = Math.max(0, v.v + acc * dt);
    v.acc = acc;
    const ds = v.v * dt;

    v.wait = v.v < 0.3 ? v.wait + dt : 0;
    if (v.lat !== 0) {
      v.lat = damp(v.lat, 0, 2.2, dt);
      if (Math.abs(v.lat) < 0.02) v.lat = 0;
    }

    advance(v, ds);
    if (v.hidden) return;
    place(v, dt);

    // pull in at stops
    if (v.path.kind === 'lane' && v.v < 0.25 && (v.route || v.hailed)) arriveAtStop(v);

    // lean on the horn at a pedestrian standing in the road
    if (v.blockedByPlayer && v.wait > 1.5) {
      v.honkT -= dt;
      if (v.honkT <= 0) {
        game.audio.play('horn', { pos: { x: v.x, y: 1, z: v.z }, rate: v.kind === 'bus' ? 0.7 : 1 + (v.id % 3) * 0.06, dur: rng.range(0.2, 0.5) });
        v.honkT = rng.range(2.5, 5);
      }
    }
    updateModel(v, dt, ds);
  }

  function updateModel(v, dt, ds) {
    const m = v.model;
    const g = m.group;
    // ride over raised ground (the level-crossing deck) on both axles;
    // surfaces overhead, like the footbridge, are ignored
    const reach = v.len * AXLE_REACH;
    const fx = -Math.sin(v.heading) * reach, fz = -Math.cos(v.heading) * reach;
    const yFront = game.world.heightAt(v.x + fx, v.z + fz, 0);
    const yRear = game.world.heightAt(v.x - fx, v.z - fz, 0);
    g.position.set(v.x, (yFront + yRear) / 2, v.z);
    // cartoon weight: nose dips when braking, squats when pulling away
    v.pitch = damp(v.pitch, clamp(-v.acc * 0.011, -0.05, 0.035), 6, dt);
    v.roll = damp(v.roll, clamp(-v.yawRate * v.v * 0.004, -0.05, 0.05), 5, dt);
    g.rotation.set(v.pitch + Math.atan2(yFront - yRear, 2 * reach), v.heading, v.roll, 'YXZ');
    v.wheelAngle += ds / m.wheelRadius;
    for (const w of m.wheels) w.rotation.x = -v.wheelAngle;
    let steer = 0;
    if (v.path?.kind === 'connector' && v.path.turn !== 'S') steer = v.path.turn === 'L' ? 0.42 : -0.5;
    for (const s of m.steer) s.rotation.y = damp(s.rotation.y, steer, 5, dt);
    if (m.brake) m.brake.visible = v.acc < -0.7 || v.v < 0.3;
    // indicators before and through a turn, and when pulling in
    let dir = 0;
    const turnConn = v.path?.kind === 'connector' ? v.path : (v.path && v.path.len - v.s < 34 ? v.nextConn : null);
    if (turnConn && turnConn.turn !== 'S') dir = turnConn.turn === 'L' ? -1 : 1;
    if (v.lat !== 0 && v.path?.kind === 'lane') {
      const rs = v.path.road.axis === 'x' ? v.path.dir : -v.path.dir;
      dir = v.lat > 0 ? -rs : rs;
    }
    if (v.state === 'dwell' || targetStop(v) !== null && v.path.kind === 'lane' && (targetStop(v) - v.s) < 30) dir = 1;
    if (m.blink) {
      const on = Math.floor(game.time * 3) % 2 === 0;
      m.blink.left.visible = dir < 0 && on;
      m.blink.right.visible = dir > 0 && on;
    }
    const c = v.collider;
    c.cx = v.x; c.cz = v.z;
    c.cos = Math.cos(v.heading); c.sin = Math.sin(v.heading);
  }

  /* ------------------------------------------------------------ population */

  function placeInitial(v, lanePool) {
    for (let tries = 0; tries < 40; tries++) {
      const lane = rng.pick(lanePool);
      if (lane.len < 20) continue;
      const s = rng.range(6, lane.len - 8);
      if (lane.vehicles.some((u) => Math.abs(u.s - s) < (u.len + v.len) / 2 + 6)) continue;
      setPath(v, lane, s);
      v.v = lane.speed * 0.6;
      chooseNext(v);
      place(v, 0);
      v.lastHeading = v.heading;
      return true;
    }
    hide(v);
    return false;
  }

  const inside = net.lanes.filter((l) => !l.portalIn && !l.portalOut);
  for (let i = 0; i < TRAFFIC_COUNT; i++) {
    const v = makeVehicle(randomType(rng));
    placeInitial(v, rng.chance(0.25) ? net.lanes : inside);
  }
  for (const route of ROUTES) {
    const types = ROUTE_TYPES[route.kind] || ['bus'];
    const legLanes = net.lanes.filter((l) => route.legs.some((g) => g.road === l.road.id && g.dir === l.dir) && l.index === 0);
    for (let i = 0; i < route.count; i++) {
      const v = makeVehicle(types[i % types.length], { routeLabel: route.label, route });
      v.route = route;
      // start somewhere along the route
      const lane = legLanes[Math.floor(((i + 0.5) / route.count) * legLanes.length) % legLanes.length];
      v.leg = Math.max(0, route.legs.findIndex((g) => g.road === lane.road.id && g.dir === lane.dir));
      if (!placeInitial(v, [lane])) placeInitial(v, legLanes);
    }
  }

  /* ------------------------------------------------------------ wheels */

  /* Every traffic wheel is drawn through a few instanced meshes: one unit
   * wheel per style and side (radius 1, width 1), scaled per instance,
   * with the rim colour as the instance colour. The wheel objects stay in
   * each model and keep spinning and steering; only their drawing moves
   * here, which turns ~190 small draw calls into about six. Wheels without
   * rig data (a model that builds its own) are left alone. */
  const wheelSets = new Map();
  const _off = new THREE.Matrix4();
  const _scl = new THREE.Matrix4();
  const _col = new THREE.Color();
  function setFor(style, side, material) {
    const key = `${style}|${side}`;
    if (!wheelSets.has(key)) {
      wheelSets.set(key, { geometry: wheelGeometry(1, 1, { rim: 0xffffff, hub: 0xffffff, style, side }), material, list: [] });
    }
    return wheelSets.get(key);
  }
  for (const v of vehicles) {
    for (const w of v.model.wheels) {
      const d = w.isMesh && w.userData.wheel;
      if (!d) continue;
      const sides = d.pair ? [[1, d.pair], [-1, -d.pair]] : [[d.side, 0]];
      for (const [side, x] of sides) {
        const off = new THREE.Matrix4().makeTranslation(x, 0, 0).multiply(_scl.makeScale(d.w, d.r, d.r));
        setFor(d.style, side, w.material).list.push({ v, w, off, rim: d.rim ?? 0xb9b7b0 });
      }
      w.visible = false;
    }
  }
  const HIDE = new THREE.Matrix4().makeScale(0, 0, 0);
  for (const set of wheelSets.values()) {
    const im = new THREE.InstancedMesh(set.geometry, set.material, set.list.length);
    im.name = 'wheels';
    im.castShadow = true;
    im.receiveShadow = true;
    im.frustumCulled = false;
    set.list.forEach((e, i) => im.setColorAt(i, _col.set(e.rim)));
    set.mesh = im;
    root.add(im);
  }
  let frameNo = 0;
  function syncWheels() {
    for (const set of wheelSets.values()) {
      const im = set.mesh;
      for (let i = 0; i < set.list.length; i++) {
        const { v, w, off } = set.list[i];
        if (v.hidden || !v.model.group.visible) { im.setMatrixAt(i, HIDE); continue; }
        if (v._wheelFrame !== frameNo) { v.model.group.updateMatrixWorld(true); v._wheelFrame = frameNo; }
        im.setMatrixAt(i, _off.multiplyMatrices(w.matrixWorld, off));
      }
      im.instanceMatrix.needsUpdate = true;
    }
  }

  /* ------------------------------------------------------------ sound */

  let voiceT = 0;
  function engineVoices(dt) {
    voiceT -= dt;
    const cam = game.camera.position;
    if (voiceT <= 0) {
      voiceT = 0.4;
      const near = vehicles.filter((v) => !v.hidden)
        .map((v) => [v, (v.x - cam.x) ** 2 + (v.z - cam.z) ** 2])
        .filter(([, d]) => d < 90 * 90)
        .sort((a, b) => a[1] - b[1]).slice(0, ENGINE_VOICES).map(([v]) => v);
      for (const v of vehicles) {
        const want = near.includes(v);
        const voice = v.model.engine === 'electric' ? 'electric' : 'engine';
        if (want && !v.engine) v.engine = game.audio.loop(voice, { kind: v.model.engine, pos: { x: v.x, y: 0.8, z: v.z }, volume: v.kind === 'car' ? 0.55 : 0.9 });
        if (!want && v.engine) { v.engine.stop(); v.engine = null; }
      }
    }
    for (const v of vehicles) {
      if (!v.engine) continue;
      const rpm = 0.8 + Math.min(v.v / 3.2, 1) * 1.6 + (v.v % 5) * 0.15;
      v.engine.set({ pos: { x: v.x, y: 0.8, z: v.z }, rate: rpm, load: clamp(v.acc / 2 + 0.3, 0, 1) });
    }
  }

  /* ------------------------------------------------------------ api */

  const api = {
    net, vehicles, signals, stops: stopById, root,
    addBlocker(lane, s) {
      const b = { lane, s, active: false };
      blockers.push(b);
      return b;
    },
    /** Nearest visible vehicle to (x, z) within r metres that passes `filter`. */
    nearestVehicle(x, z, r = 8, filter = () => true) {
      let best = null, bd = r * r;
      for (const v of vehicles) {
        if (v.hidden || !filter(v)) continue;
        const d = (v.x - x) ** 2 + (v.z - z) ** 2;
        if (d < bd) { bd = d; best = v; }
      }
      return best;
    },
    /** Ask a vehicle to pull in at distance s along its current lane. */
    requestStop(v, s) {
      if (v.path?.kind !== 'lane') return false;
      v.hailed = { lane: v.path, s: Math.min(Math.max(s, v.s + 1), v.path.len - 2) };
      return true;
    },
    update(dt) {
      signals.update(dt);
      const n = Math.max(1, Math.ceil(dt / (1 / 30)));
      const h = dt / n;
      for (let i = 0; i < n; i++) for (const v of vehicles) stepVehicle(v, h);
      engineVoices(dt);
      // far vehicles do not need drawing
      const cam = game.camera.position;
      for (const v of vehicles) {
        if (v.hidden) continue;
        const d2 = (v.x - cam.x) ** 2 + (v.z - cam.z) ** 2;
        v.model.group.visible = d2 < 420 * 420;
      }
      frameNo++;
      syncWheels();
    },
  };
  return api;
}

export { roadById, TYPES };
