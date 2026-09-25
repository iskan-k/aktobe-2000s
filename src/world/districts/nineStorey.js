import * as THREE from 'three';
import { BLOCKS } from '../plan.js';
import { buildBlock, STOREY } from '../buildings/panel.js';
import {
  hipRoof, buildBoilerHouse, siteFence, siteBoard, scaffold, towerCrane, siteClutter,
} from '../buildings/works.js';
import { SignSheet } from '../buildings/signs.js';
import {
  cover, addPath, plantTrees, scatterTrees, addGarages, addLaundryPoles, addSkips, addTyreBed,
  addTyreSwan, addHeatingMain, addSportsBox, districtCtx, groundQuad,
} from '../props/yard.js';
import { addPlasticPlayground, addCarpetFrame, addSwing } from '../props/play.js';
import { addBench } from '../props/street.js';

/* ------------------------------------------------------------------ *
 * District: nineStorey. East of пр. Санкибай батыра, south of the
 * avenue: the late-Soviet 9-storey belt.
 *
 * Two silicate-brick 9-storeys with loggia strips and red-brick
 * ornament on their end walls face the two streets; a tiled 9-storey
 * with pastel loggia fronts backs onto ул. Маресьева. In the yard: the
 * boiler house and its chimney, heating mains in silver cladding, the
 * hockey box, a new playground, garages. In the north-east corner a
 * 2007 building site: a beige brick tower with a red hipped roof, still
 * in scaffolding, a tower crane beside it.
 * ------------------------------------------------------------------ */

const DRIVE_W = 5.5;
const PASTELS = [0xe8b8a0, 0xa8c8d8, 0xd8d49a, 0xb8d8b0];

function bench(ctx, x, z, facing, style = 'park', color = 0x3e6aa6) {
  addBench(ctx.batch, x, z, facing, { style, color });
  ctx.colliders.circle(x, z, 0.7, { top: 0.5, tag: 'bench' });
}

export const nineStorey = {
  name: 'nineStorey',
  build(shared) {
    const ctx = districtCtx(shared, 'nineStorey');
    const B = BLOCKS.nineStorey;
    const X = (u) => B.x0 + u, Z = (v) => B.z0 + v;

    const sheet = new SignSheet('nine-signs');

    /* ---- buildings ---- */
    // along the avenue: entrances to the yard, loggias and ornament to the street
    const N1 = buildBlock(ctx, {
      sheet, x: X(39), z: Z(15.5), facing: Math.PI, storeys: 9, sections: 3, sectionW: 22, depth: 13,
      wall: 'silicate', back: 'strips', front: 'strips', parapet: 'greek', ornament: 'end', plinth: 'grey', seed: 21,
      shops: [{ section: 1, bay: 3, lines: ['Шаштараз «Ару»', 'Парикмахерская «Ару»'], bg: '#9a3a6a', fg: '#ffffff', roof: 0x9a3a6a }],
    });
    // along Санкибай батыра
    const N2 = buildBlock(ctx, {
      sheet, x: X(15), z: Z(64.5), facing: -Math.PI / 2, storeys: 9, sections: 3, sectionW: 19, depth: 13,
      wall: 'silicate', back: 'strips', front: 'strips', parapet: 'sheet', ornament: 'end', plinth: 'red', seed: 27,
    });
    // along Маресьева: glazed tile, pastel loggia fronts
    const P = buildBlock(ctx, {
      sheet, x: X(67), z: B.z1 - 10.2, facing: 0, storeys: 9, sections: 3, sectionW: 18, depth: 12,
      wall: 'tile', back: 'strips', front: 'plain', bands: PASTELS, parapet: 'sheet', plinth: 'grey', seed: 61,
    });

    /* ---- ground ---- */
    cover(ctx, B.x0, B.z0, B.x1, B.z1, 'yard');
    const lawn = (x0, z0, x1, z1) => cover(ctx, x0, z0, x1, z1, 'grass', -0.024);
    lawn(N1.x0, B.z0 + 0.4, N1.x1, N1.z0 - 1.5);
    lawn(B.x0 + 0.4, N2.z0, N2.x0 - 1.5, N2.z1);
    lawn(P.x0, P.z1 + 1.5, P.x1, B.z1 - 0.3);

    // drives: in from Санкибай батыра past the north block, then south along N2
    const eZ0 = N1.z1 + 4.5, eZ1 = eZ0 + DRIVE_W;
    const nX0 = N2.x1 + 4.4, nX1 = nX0 + DRIVE_W;
    const siteX0 = B.x1 - 35;
    const asphalt = (x0, z0, x1, z1) => groundQuad(ctx, x0, z0, x1, z1, -0.005, 'asphalt');
    asphalt(B.x0, eZ0, siteX0, eZ1);
    asphalt(nX0, eZ1, nX1, P.z0 - 3);
    for (const [x0, z0, x1, z1] of [
      [B.x0 + 0.4, eZ0 - 0.15, siteX0, eZ0], [B.x0 + 0.4, eZ1, nX0, eZ1 + 0.15], [nX1, eZ1, siteX0, eZ1 + 0.15],
      [nX0 - 0.15, eZ1, nX0, P.z0 - 3], [nX1, eZ1, nX1 + 0.15, P.z0 - 3],
    ]) {
      ctx.batch.span(x0, -0.04, z0, x1, 0.1, z1, 0xb8b2a6, { cast: false });
    }

    /* ---- boiler house, chimney, heating mains ---- */
    const bh = { x: B.x1 - 18, z: Z(51.5) };
    buildBoilerHouse(ctx, { x: bh.x, z: bh.z, facing: Math.PI / 2, L: 20, D: 12, H: 7.5, chimneyH: 42, seed: 3, sheet });
    // the main leaves the boiler house between N2's podyezds and loops up
    // over the drive, over a footpath and once more as an expansion loop
    const mainZ = bh.z + 5;
    const pX0 = nX0 - 1.2, pX1 = nX1 + 1.2;
    const pgX = nX1 + 7.5, pgZ = (mainZ + P.z0) / 2 + 2;
    const walkX = pgX + 7;
    const hoopA = [walkX - 2, walkX + 2];
    addHeatingMain(ctx, [
      [bh.x - 6.1, mainZ], [hoopA[1] + 20, mainZ], [hoopA[1] + 16, mainZ], [hoopA[1], mainZ], [hoopA[0], mainZ],
      [pX1, mainZ], [pX0, mainZ], [N2.x1 + 0.1, mainZ],
    ], { hoops: [1, 3, 5] });
    // branch north to N1 between two podyezds, over the east-west drive
    const bN = N1.x0 + 46;
    addHeatingMain(ctx, [[bN, mainZ - 0.8], [bN, eZ1 + 1.2], [bN, eZ0 - 1.2], [bN, N1.z1 + 0.1]], { hoops: [1] });
    // branch south to P
    const bS = P.x0 + 42;
    addHeatingMain(ctx, [[bS, mainZ + 0.8], [bS, P.z0 - 0.1]]);

    /* ---- the building site ---- */
    const site = [siteX0 + 1, B.z0 + 1.5, B.x1 - 1, eZ1 + 1.5];
    cover(ctx, site[0], site[1], site[2], site[3], 'dirt', -0.02);
    const tw = { x: (site[0] + site[2]) / 2 + 2, z: B.z0 + 16 };
    const T = buildBlock(ctx, {
      sheet, x: tw.x, z: tw.z, facing: Math.PI, storeys: 11, sections: 1, sectionW: 20, depth: 16, bays: 6,
      wall: 'cream', back: 'strips', front: 'strips', parapet: 'bars', plinth: 'red',
      liftRooms: false, aerials: 0, benches: false, doors: false, seed: 71,
    });
    const tm = new THREE.Matrix4().compose(new THREE.Vector3(tw.x, 0, tw.z), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI), new THREE.Vector3(1, 1, 1));
    hipRoof(ctx.batch, tm, 20, 16, T.height + 0.5, 4.6, 0xa8382c, 0.6);
    scaffold(ctx, T.x0 - 0.05, tw.z, Math.PI / 2, 15, 0, 11 * STOREY - 1, { seed: 9 });
    const crane = { x: site[0] + 4, z: site[1] + 5 };
    const yaw = Math.atan2(-(tw.x + 4 - crane.x), -(tw.z + 2 - crane.z));
    towerCrane(ctx, crane.x, crane.z, yaw, { h: 44, jib: 32, hookAt: 20, hookY: T.height + 6.5 });
    const gateAt = (site[3] - (eZ0 + eZ1) / 2) / (site[3] - site[1]);
    siteFence(ctx, [[site[0], site[1]], [site[2], site[1]], [site[2], site[3]], [site[0], site[3]]], { gate: 3, gateAt, gateW: 5, seed: 7 });
    siteBoard(ctx, site[0] - 0.4, site[3] - 12, Math.PI / 2, 12, sheet);
    // a bytovka for the workers, inside the gate
    const by = { x: site[0] + 2.6, z: site[3] - 15 };
    ctx.batch.box(6, 2.6, 2.5, 0x3e6aa6, by.x, 0.2, by.z, { ry: Math.PI / 2 });
    ctx.batch.box(6.2, 0.1, 2.7, 0x8a8e90, by.x, 2.8, by.z, { ry: Math.PI / 2 });
    ctx.batch.box(0.9, 1.9, 0.04, 0xe8e4da, by.x + 1.27, 0.3, by.z + 1.2, { ry: Math.PI / 2 });
    ctx.colliders.box(by.x - 1.3, by.z - 3.1, by.x + 1.3, by.z + 3.1, { tag: 'site' });
    siteClutter(ctx, site[0], site[1], site[2], site[3], [
      [T.x0 - 3, T.z0 - 1.5, T.x1 + 0.5, T.z1 + 1.5], [crane.x - 3, crane.z - 3, crane.x + 3, crane.z + 3],
      [site[0], eZ0 - 1, site[0] + 8, eZ1 + 1], [by.x - 1.5, by.z - 3.5, by.x + 1.5, by.z + 3.5],
    ], 11);

    /* ---- the yard ---- */
    const yard = { x0: nX1 + 1, z0: eZ1 + 1, x1: bh.x - 7, z1: P.z0 - 3 };
    const sbX = (walkX + 3 + bS - 1) / 2, sbZ = (mainZ + P.z0) / 2 - 1;
    addSportsBox(ctx, sbX, sbZ, 0, { L: 28, W: 14, seed: 10 });
    addPlasticPlayground(ctx, pgX, pgZ, Math.PI / 2, 14);
    addSwing(ctx, pgX, pgZ - 9, 0, 0xc9453d);
    bench(ctx, pgX, pgZ + 7.2, Math.PI, 'yard', 0x8a5a3a);
    // north yard strip between the drive and the heating main
    addCarpetFrame(ctx, bN + 10, (eZ1 + mainZ) / 2, 0, { seed: 23 });
    addLaundryPoles(ctx, bN - 16, eZ1 + 8, bN - 6, eZ1 + 8, 24);
    addSkips(ctx, bN + 24, eZ1 + 3.4, 0, 25);
    addTyreBed(ctx, bN + 3.5, eZ1 + 11.5, 26, { r: 1.1 });
    addTyreSwan(ctx, bN + 6.2, eZ1 + 11.7, -0.4);
    bench(ctx, bN - 2.5, eZ1 + 11, 0, 'yard', 0x8a5a3a);

    // garages along the east edge, doors to the yard
    addGarages(ctx, B.x1 - 3.3, (bh.z + 6 + P.z1) / 2 + 3, 7, Math.PI / 2, 31);

    // paths: across the yard under the loop, and to the playground
    addPath(ctx, [[walkX, eZ1 + 5.5], [walkX, P.z0 - 4], [P.x0 + 10.6, P.z0 - 2.4]], 1.6);
    addPath(ctx, [[walkX, mainZ + 4], [pgX + 3, pgZ - 3]], 1.2);

    /* ---- parking ---- */
    const spots = [];
    for (let i = 0; i < 7; i++) {
      const x = nX1 + 6 + i * 2.7;
      if (Math.abs(x - bN) > 2.4 && Math.abs(x - walkX) > 2) spots.push({ x, z: eZ1 + 2.25, ry: i % 2 ? 0 : Math.PI });
    }
    for (const z of [eZ1 + 6, eZ1 + 12, mainZ + 6, mainZ + 12]) spots.push({ x: nX1 + 1.2, z, ry: Math.PI });
    for (const x of [N1.x0 + 21, N1.x0 + 42, N1.x1 - 0.5]) spots.push({ x, z: eZ0 - 1.3, ry: Math.PI / 2 });
    for (const s of spots) ctx.parking.push({ ...s, chance: 0.7 });

    /* ---- trees ---- */
    const rows = [];
    for (let x = N1.x0 + 2; x < N1.x1; x += 7.5) rows.push(['poplar', x, B.z0 + 3]);
    for (let z = N2.z0 + 2; z < N2.z1; z += 7.5) rows.push(['poplar', B.x0 + 3.2, z]);
    for (let x = P.x0 + 3, i = 0; x < P.x1; x += 9, i++) rows.push([i % 2 ? 'young' : 'maple', x, B.z1 - 1.2]);
    rows.push(['elm', B.x0 + 3, B.z0 + 3], ['black', B.x0 + 2.5, eZ0 - 4], ['elm', B.x0 + 3, N2.z0 - 2.5]);
    plantTrees(ctx, rows, 201);
    const keepOut = [
      [N1.x0, N1.z0, N1.x1, N1.z1 + 2.5], [N2.x0, N2.z0, N2.x1 + 2.5, N2.z1], [P.x0, P.z0 - 3, P.x1, P.z1],
      [B.x0, eZ0, siteX0, eZ1], [nX0, eZ1, nX1 + 2, P.z0], [site[0] - 1, site[1], site[2], site[3] + 1],
      [bh.x - 7, bh.z - 12, B.x1, bh.z + 12], [B.x1 - 7, bh.z, B.x1, P.z1],
      [pgX - 6, pgZ - 12, pgX + 6, pgZ + 8], [sbX - 15, sbZ - 8, sbX + 15, sbZ + 8],
      [nX0, mainZ - 1.5, bh.x, mainZ + 1.5], [bN - 1.5, eZ1, bN + 1.5, mainZ], [bS - 1.5, mainZ, bS + 1.5, P.z0],
      [bN - 17, eZ1, bN + 28, eZ1 + 13], [walkX - 1.5, eZ1, walkX + 1.5, P.z0],
    ];
    scatterTrees(ctx, [yard.x0, eZ1 + 1, yard.x1, mainZ - 1], 7, ['elm', 'maple', 'black'], keepOut, { seed: 211, spacing: 7 });
    scatterTrees(ctx, [yard.x0, mainZ + 1, yard.x1 + 4, yard.z1], 9, ['elm', 'maple', 'young', 'elm'], keepOut, { seed: 221, spacing: 6 });

    ctx.flush();
    sheet.flush(ctx.root);
  },
};
