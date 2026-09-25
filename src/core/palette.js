/* ------------------------------------------------------------------ *
 * The town's colours.
 *
 * Aktobe in early June, around half past six in the evening: a clear
 * steppe sky, a low warm sun from the west, dust in the air, and
 * everything man-made a little sun-bleached. Colours are authored as
 * sRGB hex, the way you would pick them off a photo. The material layer
 * converts them to linear.
 *
 * Keep new colours here when more than one module uses them. A colour
 * that belongs to one object only can live in that object's file.
 * ------------------------------------------------------------------ */

export const PAL = {
  /* ---- sky and air ---- */
  skyTop: 0x4f86c6,
  skyMid: 0x92b9df,
  skyHaze: 0xe3dccb,
  sunGlow: 0xfff0cf,
  cloud: 0xfbf8f1,
  cloudShade: 0xc9cfdc,
  fog: 0xd8d4c6,

  /* ---- light ---- */
  sun: 0xffeccc,
  fill: 0xa8bedf,
  hemiSky: 0xc3d6ef,
  hemiGround: 0x9d937f,
  shadowTint: 0x6f7c9a,   // cool blue-grey the shadow side leans toward
  ink: 0x2b2724,

  /* ---- ground ---- */
  asphalt: 0x5f6064,
  asphaltWorn: 0x75746f,
  asphaltPatch: 0x4d4e52,
  asphaltWalk: 0x8b8781,
  kerb: 0xcfccc2,
  kerbDark: 0x3b3a39,
  paint: 0xe9e6dc,
  paintYellow: 0xe0b43a,
  dirt: 0xb09a78,
  dirtDark: 0x8e7a5c,
  grass: 0x7f9550,
  grassDry: 0xa7a266,
  grassDeep: 0x60783e,
  sand: 0xcdb98f,
  concrete: 0xb3aea3,
  concreteDark: 0x8f8b82,
  tile: 0xa39c90,

  /* ---- building stock ---- */
  panelLight: 0xdcd5c6,
  panelGrey: 0xbdb9b0,
  panelBeige: 0xd9c8a8,
  panelPink: 0xd8b4a0,
  panelBlue: 0xaebdc6,
  panelSeam: 0x8d877c,
  brickRed: 0xa65a42,
  brickSand: 0xd6c096,
  brickWhite: 0xd8d2c4,
  plaster: 0xe2d6bd,
  plasterYellow: 0xe0c889,
  plasterPink: 0xd9a996,
  stucco: 0xeee6d4,
  roofTar: 0x4b4744,
  roofSlate: 0x9c9990,
  roofTin: 0x8d9aa0,
  roofRust: 0x9a5a3c,
  roofGreen: 0x4d7b62,
  windowDark: 0x2f3a45,
  windowSky: 0x7f9bb5,
  frameWhite: 0xe8e4da,
  frameWood: 0x8a6a4a,
  frameBrown: 0x6a4a36,
  glassTint: 0x5b7389,

  /* ---- paint and metal ---- */
  metalGrey: 0x8a8d8f,
  metalDark: 0x4a4d50,
  rust: 0x8c5236,
  gasYellow: 0xe0b12c,
  fenceGreen: 0x3e7a52,
  fenceBlue: 0x4d7fae,
  railingBlue: 0x3f6d9a,
  whitewash: 0xece8de,
  wood: 0x9a7650,
  woodDark: 0x6b5238,
  woodGrey: 0x8e8474,
  redPaint: 0xb8423a,
  bluePaint: 0x3e6aa6,
  greenPaint: 0x4f8a4a,
  yellowPaint: 0xe2bd3f,
  orangePaint: 0xdc7a36,

  /* ---- plants ---- */
  leaf: 0x6e9244,
  leafDark: 0x4f7236,
  leafLight: 0x94ad5a,
  poplar: 0x5f8a3f,
  elm: 0x6b8d45,
  bark: 0x6e6154,
  barkLight: 0x9c9384,
  fluff: 0xfbf9f2,

  /* ---- flags and brand accents ---- */
  kzSky: 0x00afca,
  kzGold: 0xfec50c,
};

export default PAL;
