import { defineVoice } from './audio.js';
import { env, burst, tone } from './sounds.js';

/* ------------------------------------------------------------------ *
 * Sounds of the walker's own body and what is in their hand: landing
 * from a hop, biting, chewing, licking, gulping, slurping hot tea,
 * cracking seeds, a wrapper and an empty dropped into a steel bin.
 * Synthesised like everything else.
 * ------------------------------------------------------------------ */

/** Feet coming down after a jump: a soft low thump with a scuff. */
defineVoice('land', (ac, out, { volume = 1 }) => {
  const t = ac.currentTime;
  const o = ac.createOscillator();
  o.frequency.setValueAtTime(110, t);
  o.frequency.exponentialRampToValueAtTime(48, t + 0.12);
  const g = ac.createGain();
  env(g, t, 0.004, 0.32 * volume, 0.13);
  o.connect(g).connect(out);
  o.start(t);
  o.stop(t + 0.2);
  burst(ac, out, t, { f: 520, q: 0.7, type: 'lowpass', peak: 0.28 * volume, a: 0.006, d: 0.1 });
  burst(ac, out, t + 0.03, { f: 1400, q: 0.8, peak: 0.08 * volume, a: 0.01, d: 0.12 });
});

/** A bite of bread or a waffle: three or four dry crackles close together. */
defineVoice('crunch', (ac, out, { volume = 1, soft = false }) => {
  const t = ac.currentTime;
  const n = soft ? 2 : 3 + Math.floor(Math.random() * 2);
  for (let i = 0; i < n; i++) {
    const at = t + i * (0.035 + Math.random() * 0.03);
    burst(ac, out, at, { f: soft ? 900 + Math.random() * 400 : 1800 + Math.random() * 1600, q: 1.4, peak: (soft ? 0.14 : 0.24) * volume, a: 0.002, d: 0.04 + Math.random() * 0.03 });
  }
  // the chew after it
  for (let i = 0; i < 2; i++) burst(ac, out, t + 0.28 + i * 0.22, { f: 500, q: 0.8, type: 'lowpass', peak: 0.08 * volume, a: 0.02, d: 0.1 });
});

/** Soft ice cream: a wet little smack. */
defineVoice('lick', (ac, out, { volume = 1 }) => {
  const t = ac.currentTime;
  burst(ac, out, t, { f: 1100, q: 2.2, peak: 0.16 * volume, a: 0.01, d: 0.09 });
  burst(ac, out, t + 0.1, { f: 2600, q: 3, peak: 0.07 * volume, a: 0.003, d: 0.04 });
  tone(ac, out, t + 0.02, 380, 0.06, { type: 'sine', peak: 0.03 * volume, a: 0.01 });
});

/** A swallow of something fizzy: two low gulps and a fizz behind them. */
defineVoice('gulp', (ac, out, { volume = 1, fizz = true }) => {
  const t = ac.currentTime;
  for (let i = 0; i < 2; i++) {
    const at = t + 0.12 + i * 0.36;
    const o = ac.createOscillator();
    o.type = 'sine';
    o.frequency.setValueAtTime(260, at);
    o.frequency.exponentialRampToValueAtTime(120, at + 0.11);
    const g = ac.createGain();
    env(g, at, 0.01, 0.2 * volume, 0.12);
    o.connect(g).connect(out);
    o.start(at);
    o.stop(at + 0.16);
    burst(ac, out, at, { f: 420, q: 1, type: 'lowpass', peak: 0.1 * volume, a: 0.01, d: 0.08 });
  }
  if (fizz) burst(ac, out, t, { f: 6500, q: 0.4, type: 'highpass', peak: 0.05 * volume, a: 0.05, d: 0.7 });
});

/** A sunflower seed cracked between the teeth, and the husk spat out. */
defineVoice('seedCrack', (ac, out, { volume = 1 }) => {
  const t = ac.currentTime;
  burst(ac, out, t, { f: 3200, q: 3, peak: 0.26 * volume, a: 0.001, d: 0.02 });
  burst(ac, out, t + 0.05, { f: 2400, q: 3, peak: 0.12 * volume, a: 0.001, d: 0.02 });
  burst(ac, out, t + 0.32, { f: 1500, q: 1, peak: 0.07 * volume, a: 0.01, d: 0.05 });
});

/** Paper or foil: a short rustle for unwrapping gum. */
defineVoice('unwrap', (ac, out, { volume = 1 }) => {
  const t = ac.currentTime;
  for (let i = 0; i < 5; i++) burst(ac, out, t + i * 0.05 + Math.random() * 0.03, { f: 4000 + Math.random() * 3000, q: 0.8, peak: 0.1 * volume, a: 0.004, d: 0.05 });
});

/** Something light dropped into a steel bin: a tinny knock that rings a little. */
defineVoice('binDrop', (ac, out, { volume = 1, glass = false }) => {
  const t = ac.currentTime;
  burst(ac, out, t, { f: 700, q: 1.5, peak: 0.3 * volume, a: 0.002, d: 0.08 });
  const ring = glass ? [1800, 2750] : [520, 1310];
  for (const f of ring) tone(ac, out, t, f, glass ? 0.5 : 0.35, { type: 'triangle', peak: 0.05 * volume, a: 0.003 });
});

/** Meat or soft dough: a wet squelch, then slow low chewing. */
defineVoice('chew', (ac, out, { volume = 1, soft = false }) => {
  const t = ac.currentTime;
  burst(ac, out, t, { f: soft ? 700 : 520, q: 1.2, type: 'lowpass', peak: 0.2 * volume, a: 0.008, d: 0.08 });
  burst(ac, out, t + 0.02, { f: 1600, q: 2, peak: 0.06 * volume, a: 0.004, d: 0.05 });
  for (let i = 0; i < 3; i++) {
    const at = t + 0.26 + i * 0.24;
    burst(ac, out, at, { f: 420, q: 0.9, type: 'lowpass', peak: 0.1 * volume, a: 0.03, d: 0.1 });
    tone(ac, out, at, 150, 0.08, { type: 'sine', peak: 0.03 * volume, a: 0.02 });
  }
});

/** Hot tea, sipped with air to cool it: a hiss drawn in, then a swallow. */
defineVoice('slurp', (ac, out, { volume = 1 }) => {
  const t = ac.currentTime;
  burst(ac, out, t + 0.05, { f: 2400, q: 1.5, peak: 0.12 * volume, a: 0.12, d: 0.22 });
  burst(ac, out, t + 0.1, { f: 5200, q: 2.5, peak: 0.04 * volume, a: 0.1, d: 0.2 });
  const at = t + 0.5;
  const o = ac.createOscillator();
  o.type = 'sine';
  o.frequency.setValueAtTime(240, at);
  o.frequency.exponentialRampToValueAtTime(110, at + 0.12);
  const g = ac.createGain();
  env(g, at, 0.01, 0.16 * volume, 0.12);
  o.connect(g).connect(out);
  o.start(at);
  o.stop(at + 0.16);
});
