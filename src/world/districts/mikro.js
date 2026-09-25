import { BLOCKS } from '../plan.js';
import { buildBlock } from '../buildings/panel.js';
import { buildStalin } from '../buildings/stalin.js';
import { SignSheet } from '../buildings/signs.js';
import {
  cover, addPath, plantTrees, scatterTrees, addLoopFence, addGarages, addOldPlayground,
  addPlasticPlayground, addCarpetFrame, addLaundryPoles, addSkips, addTyreBed, addTyreSwan,
  addCat, addDominoTable, districtCtx, groundQuad,
} from '../props/yard.js';
import { addBench } from '../props/street.js';

/* ------------------------------------------------------------------ *
 * District: mikro. The 5-storey courtyard microdistrict between
 * ул. Айтеке би and пр. Санкибай батыра, south of the avenue.
 *
 * On the avenue: a 4-storey Stalin-era block in ochre stucco with shops
 * on the ground floor and an arched gateway into the courtyard. Behind
 * it four Khrushchyovkas (1-464 panel and 1-447 brick) close two yards:
 * the north yard with the old metal playground, the south yard with the
 * new plastic one and the skips. An asphalt drive runs in from the
 * avenue past the garages and along the south block.
 *
 * Layout numbers are offsets from the block's north-west corner, so the
 * plan can move the block without breaking it.
 * ------------------------------------------------------------------ */

const DRIVE_W = 5.5;

function bench(ctx, x, z, facing, style = 'yard', color = 0x8a5a3a) {
  addBench(ctx.batch, x, z, facing, { style, color });
  ctx.colliders.circle(x, z, 0.7, { top: 0.5, tag: 'bench' });
}

export const mikro = {
  name: 'mikro',
  build(shared) {
    const ctx = districtCtx(shared, 'mikro');
    const B = BLOCKS.mikro;
    const X = (u) => B.x0 + u, Z = (v) => B.z0 + v;

    const sheet = new SignSheet('mikro-signs');

    /* ---- buildings ---- */
    const st = { x: X(50.25), z: Z(8.5), L: 64, D: 13 };
    buildStalin(ctx, {
      x: st.x, z: st.z, facing: 0, length: st.L, depth: st.D, storeys: 4, wall: 'stucco',
      arch: { at: 0, width: 4.6 }, seed: 5, sheet,
      shops: [
        { at: -24, width: 10, lines: ['Азық-түлік', 'Продукты'], bg: '#1f4e8c', fg: '#f2c230' },
        { at: -11, width: 7.4, lines: ['Дәріхана', 'Аптека'], bg: '#f4f4f0', fg: '#1f7a3a' },
        { at: 12, width: 6.6, lines: ['Ателье', 'Тігін · Пошив'], bg: '#8a2032', fg: '#f4ead8' },
        { at: 24, width: 7.2, lines: ['Фото', 'Kodak Express'], bg: '#f2c230', fg: '#c8201e' },
      ],
    });
    const sN = st.z - st.D / 2, sS = st.z + st.D / 2;
    const sW = st.x - st.L / 2, sE = st.x + st.L / 2;
    const archX = st.x;

    // west: 1-464 panel, entrances to the yard, balconies to Айтеке би
    const A = buildBlock(ctx, {
      sheet, x: X(10.75), z: Z(49.5), facing: -Math.PI / 2, storeys: 5, sections: 4, sectionW: 15, depth: 12,
      wall: 'panel', back: 'balconies', parapet: 'sheet', plinth: 'grey', gasPipe: true, seed: 31,
    });
    // middle: 1-447 cream brick, between the two yards
    const D = buildBlock(ctx, {
      sheet, x: X(55.25), z: Z(43.5), facing: 0, storeys: 5, sections: 4, sectionW: 15, depth: 12,
      wall: 'cream', back: 'balconies', parapet: 'bars', plinth: 'red', gasPipe: true, seed: 11,
    });
    // east: silicate brick, balconies to Санкибай батыра
    const C = buildBlock(ctx, {
      sheet, x: X(104.25), z: Z(44.5), facing: Math.PI / 2, storeys: 5, sections: 4, sectionW: 15, depth: 12,
      wall: 'silicate', back: 'balconies', parapet: 'sheet', plinth: 'grey', gasPipe: true, seed: 47,
    });
    // south: a long 1-464, six podyezds, backing onto ул. Маресьева
    const S = buildBlock(ctx, {
      sheet, x: X(65.25), z: Z(85.5), facing: 0, storeys: 5, sections: 6, sectionW: 15, depth: 12,
      wall: 'panel', back: 'balconies', parapet: 'sheet', plinth: 'grey', gasPipe: true, seed: 53,
    });

    /* ---- ground ---- */
    cover(ctx, B.x0, B.z0, B.x1, B.z1, 'yard');
    // slab forecourt in front of the shops, flush with the pavement
    const fore = [sW - 1, B.z0, sE + 1, sN - 0.05];
    groundQuad(ctx, fore[0], fore[1], fore[2], fore[3], 0.15, 'walk');
    ctx.batch.span(fore[0], -0.04, fore[1], fore[0] + 0.06, 0.15, fore[3], 0x9a948a, { cast: false });
    ctx.batch.span(fore[2] - 0.06, -0.04, fore[1], fore[2], 0.15, fore[3], 0x9a948a, { cast: false });
    ctx.ground.flat(fore[0], fore[1], fore[2], fore[3], 0.15);

    // the drive: in from the avenue, down past the east block, along the south block
    const dX0 = D.x1 + 4.4, dX1 = dX0 + DRIVE_W;
    const dZ1 = S.z0 - 2.6, dZ0 = dZ1 - DRIVE_W;
    const dW = A.x1 + 3;
    const asphalt = (x0, z0, x1, z1) => groundQuad(ctx, x0, z0, x1, z1, -0.005, 'asphalt');
    asphalt(dX0, B.z0, dX1, dZ1);
    asphalt(dW, dZ0, dX0, dZ1);
    for (const [x0, z0, x1, z1] of [[dX0 - 0.15, B.z0 + 0.4, dX0, dZ0], [dX1, B.z0 + 0.4, dX1 + 0.15, dZ1], [dW, dZ0 - 0.15, dX0, dZ0]]) {
      ctx.batch.span(x0, -0.04, z0, x1, 0.1, z1, 0xb8b2a6, { cast: false });
    }

    // grass: strips under the balconies, the corner green, patches in the yards
    const lawn = (x0, z0, x1, z1) => cover(ctx, x0, z0, x1, z1, 'grass', -0.024);
    lawn(B.x0 + 0.3, A.z0 + 1, A.x0 - 0.3, A.z1 - 1);
    lawn(C.x1 + 0.3, C.z0 + 1, B.x1 - 0.3, C.z1 - 1);
    lawn(S.x0 + 1, S.z1 + 0.3, S.x1 - 1, B.z1 - 0.3);
    lawn(D.x0 + 2, D.z1 + 0.6, D.x1 - 2, D.z1 + 4.5);
    lawn(B.x0 + 0.5, B.z0 + 0.5, sW - 2, A.z0 - 2);
    lawn(sW + 3, sS + 3, sW + 15, sS + 10.5);
    lawn(D.x0 + 34, D.z1 + 11, dX0 - 3, dZ0 - 7);

    // trodden paths: gateway to the podyezds, walks along the fronts, short cuts
    const dFront = D.z0 - 3;
    addPath(ctx, [[archX, sS + 0.5], [archX, dFront]]);
    addPath(ctx, [[D.x0 + 2, dFront], [D.x1 - 2, dFront]], 1.8);
    addPath(ctx, [[dW, A.z0 + 2], [dW, dZ0 - 0.5]], 1.8);
    addPath(ctx, [[archX, sS + 6], [dW, A.z0 + 5]]);
    addPath(ctx, [[dW, D.z1 + 3], [D.x0 + 20, D.z1 + 9], [D.x0 + 33, dZ0 - 0.5]]);
    addPath(ctx, [[D.x1 + 1.3, dFront], [D.x1 + 1.3, D.z1 + 2]], 1.3);

    /* ---- north yard ---- */
    const nyZ = (sS + D.z0) / 2;
    addOldPlayground(ctx, archX + 13, nyZ - 0.3, 0, 3);
    addLoopFence(ctx, [[sW + 3, sS + 3], [sW + 15, sS + 3], [sW + 15, sS + 10.5], [sW + 3, sS + 10.5]], { closed: true });
    addTyreBed(ctx, sW + 9, sS + 6.8, 7);
    addCarpetFrame(ctx, sW + 9, nyZ + 6, 0, { seed: 9 });
    addLaundryPoles(ctx, sW + 19, sS + 4.5, sW + 19, sS + 14, 5);
    addTyreSwan(ctx, archX - 2.6, sS + 2.4, Math.PI);
    addTyreSwan(ctx, archX + 2.6, sS + 2.4, Math.PI);
    addTyreBed(ctx, archX - 8, sS + 2.6, 17, { r: 1.0 });
    bench(ctx, archX - 12.5, sS + 1.6, Math.PI);
    bench(ctx, archX + 27, sS + 2.4, Math.PI, 'park', 0x3e6aa6);
    addDominoTable(ctx, sE - 3, nyZ - 2, Math.PI / 2, 8);

    /* ---- south yard ---- */
    const syZ = (D.z1 + dZ0) / 2;
    addPlasticPlayground(ctx, D.x0 + 10, syZ + 0.5, 0, 4);
    bench(ctx, D.x0 + 3, syZ + 1, -Math.PI / 2, 'park', 0x3e6aa6);
    bench(ctx, D.x0 + 17.2, syZ + 1, Math.PI / 2, 'park', 0x3e6aa6);
    addCarpetFrame(ctx, D.x0 + 26, syZ - 2, Math.PI / 2, { seed: 13 });
    addLaundryPoles(ctx, D.x0 + 34, D.z1 + 6.5, D.x0 + 46, D.z1 + 6.5, 12);
    bench(ctx, D.x0 + 40, syZ + 2.5, 0);
    addSkips(ctx, dX0 - 6, dZ0 - 2.6, Math.PI, 6);
    addTyreBed(ctx, D.x0 + 1.5, dZ0 - 2.4, 14, { r: 1.0 });
    addTyreSwan(ctx, D.x0 + 4.4, dZ0 - 2.2, 0.3);

    /* ---- garages: the north-east corner and the south-west corner ---- */
    const gx = B.x1 - 9, gz = (B.z0 + C.z0) / 2 - 0.2;
    const gNE = addGarages(ctx, gx, gz, 4, Math.PI / 2, 21);
    addCat(ctx, gx - 2.0, gNE.roofY + 0.1, gz + 2.4, Math.PI / 2 + 0.5, 0xd08a3a);
    addGarages(ctx, A.x0 + 1.2, (A.z1 + B.z1) / 2 + 0.4, 4, -Math.PI / 2, 22);

    /* ---- parking ---- */
    const spots = [];
    for (let i = 0; i < 9; i++) spots.push({ x: D.x0 + 22 + i * 2.7, z: dZ0 - 2.4, ry: i % 3 === 0 ? Math.PI : 0 });
    for (const z of [nyZ - 4, nyZ + 2.5, D.z1 + 4, D.z1 + 10.5]) spots.push({ x: dX0 - 1.3, z, ry: Math.PI });
    spots.push({ x: dW + 3, z: dZ0 + 2.7, ry: Math.PI / 2 });
    for (const s of spots) ctx.parking.push({ ...s, chance: 0.7 });

    /* ---- trees ---- */
    const rows = [];
    for (let z = A.z0 + 3; z < A.z1 - 2; z += 8) rows.push(['poplar', B.x0 + 1.3, z]);
    for (let z = C.z0 + 4; z < C.z1 - 2; z += 8.5) rows.push(['poplar', B.x1 - 1.1, z]);
    for (let x = S.x0 + 4, i = 0; x < S.x1 - 2; x += 9, i++) rows.push([i % 2 ? 'poplar' : 'young', x, B.z1 - 1.1]);
    plantTrees(ctx, rows, 101);
    plantTrees(ctx, [
      ['elm', B.x0 + 4, B.z0 + 4], ['black', B.x0 + 9.5, B.z0 + 11], ['maple', sW - 3.5, B.z0 + 3.5],
      ['ball', sW - 4, A.z0 - 5], ['shrub', B.x0 + 3, A.z0 - 3], ['shrub', B.x0 + 6, A.z0 - 3.5],
      ['elm', sW + 9, sS + 8.8], ['maple', gx - 1, B.z0 + 1.5], ['young', B.x1 - 2, B.z0 + 2],
    ], 131);
    const pad = 2.5;
    const keepOut = [
      [sW, sN, sE, sS + 2.5], [A.x0, A.z0, A.x1 + pad, A.z1], [D.x0, D.z0 - pad, D.x1, D.z1 + 1.5],
      [C.x0 - pad, C.z0, C.x1, C.z1], [S.x0, S.z0 - pad, S.x1, S.z1],
      [dX0 - 2.2, B.z0, dX1, dZ1], [dW, dZ0 - 4.6, dX0, dZ1],
      [archX + 3, nyZ - 8, archX + 23, nyZ + 7.5], [D.x0 + 3, syZ - 4, D.x0 + 18, syZ + 6.5],
      [sW + 2, sS + 2, sW + 21, sS + 15], [archX - 2, sS, archX + 2, D.z0], [sW + 6, nyZ + 5, sW + 12, nyZ + 7],
      [D.x0 + 24, syZ - 4, D.x0 + 48, syZ - 1], [dX1, B.z0, B.x1, C.z0], [sE - 5, nyZ - 4, sE, nyZ],
      [D.x0, dFront - 1, D.x1, dFront + 1],
    ];
    scatterTrees(ctx, [dW, sS + 2, dX0 - 1, D.z0 - 2], 8, ['elm', 'maple', 'black', 'elm'], keepOut, { seed: 141, spacing: 6 });
    scatterTrees(ctx, [dW, D.z1 + 1, dX0 - 1, dZ0 - 1], 9, ['elm', 'maple', 'maple', 'young'], keepOut, { seed: 151, spacing: 5.5 });

    ctx.flush();
    sheet.flush(ctx.root);
  },
};
