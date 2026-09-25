import { defineVoice } from './audio.js';

/* ------------------------------------------------------------------ *
 * Street sounds, synthesised like everything else: the kiosk window,
 * a can, kvass pouring into a glass, a newspaper, the payphone (dial
 * tone at 425 Hz, the Soviet standard, DTMF digits, ringback), pigeons
 * cooing and clattering up, and a stray dog's whine and bark.
 *
 * Importing this file registers the voices; play them with
 * game.audio.play(name, { pos, volume }).
 * ------------------------------------------------------------------ */

let NOISE = null;
function noise(ac) {
  if (!NOISE || NOISE.sampleRate !== ac.sampleRate) {
    NOISE = ac.createBuffer(1, ac.sampleRate * 2, ac.sampleRate);
    const d = NOISE.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }
  const s = ac.createBufferSource();
  s.buffer = NOISE;
  return s;
}

function env(g, t0, a, peak, d) {
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(Math.max(peak, 0.0002), t0 + a);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + a + d);
}

function burst(ac, out, t, { f = 2000, q = 1, type = 'bandpass', peak = 0.3, a = 0.004, d = 0.08 } = {}) {
  const s = noise(ac);
  const fl = ac.createBiquadFilter();
  fl.type = type;
  fl.frequency.value = f;
  fl.Q.value = q;
  const g = ac.createGain();
  env(g, t, a, peak, d);
  s.connect(fl).connect(g).connect(out);
  s.start(t, Math.random() * 1.5);
  s.stop(t + a + d + 0.05);
}

function tone(ac, out, t, f, dur, { type = 'sine', peak = 0.1, a = 0.01 } = {}) {
  const o = ac.createOscillator();
  o.type = type;
  o.frequency.value = f;
  const g = ac.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(peak, t + a);
  g.gain.setValueAtTime(peak, t + Math.max(a, dur - 0.02));
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(out);
  o.start(t);
  o.stop(t + dur + 0.02);
  return o;
}

/** The kiosk's little serving window sliding open: scrape, then a knock. */
defineVoice('kioskWindow', (ac, out) => {
  const t = ac.currentTime;
  burst(ac, out, t, { f: 1800, q: 0.6, peak: 0.18, a: 0.02, d: 0.25 });
  burst(ac, out, t + 0.26, { f: 420, q: 1.2, peak: 0.35, a: 0.002, d: 0.06 });
});

/** Can of Pepsi-style soda: the tab, the hiss. */
defineVoice('canOpen', (ac, out) => {
  const t = ac.currentTime;
  burst(ac, out, t, { f: 3500, q: 2, peak: 0.4, a: 0.001, d: 0.03 });
  burst(ac, out, t + 0.02, { f: 6000, q: 0.5, type: 'highpass', peak: 0.2, a: 0.01, d: 0.4 });
});

/** Kvass from the barrel tap into a glass: a gurgling stream that rises in pitch. */
defineVoice('pour', (ac, out) => {
  const t = ac.currentTime;
  const s = noise(ac);
  const fl = ac.createBiquadFilter();
  fl.type = 'bandpass';
  fl.Q.value = 4;
  fl.frequency.setValueAtTime(500, t);
  fl.frequency.linearRampToValueAtTime(1400, t + 1.6);
  const g = ac.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(0.35, t + 0.08);
  g.gain.setValueAtTime(0.35, t + 1.5);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 1.8);
  // bubbles: amplitude wobble
  const lfo = ac.createOscillator();
  lfo.frequency.value = 17;
  const lg = ac.createGain();
  lg.gain.value = 0.15;
  lfo.connect(lg).connect(g.gain);
  s.connect(fl).connect(g).connect(out);
  s.start(t, Math.random());
  lfo.start(t);
  s.stop(t + 1.9);
  lfo.stop(t + 1.9);
});

/** Paper: a folded newspaper, or an ice-cream wrapper. */
defineVoice('paper', (ac, out) => {
  const t = ac.currentTime;
  for (let i = 0; i < 9; i++) {
    burst(ac, out, t + i * 0.045 + Math.random() * 0.03, { f: 2500 + Math.random() * 3000, q: 0.8, peak: 0.12 + Math.random() * 0.1, a: 0.002, d: 0.04 });
  }
});

/** 425 Hz continuous dial tone, 1.6 s. */
defineVoice('dialTone', (ac, out) => {
  tone(ac, out, ac.currentTime, 425, 1.6, { peak: 0.08 });
});

const DTMF = {
  1: [697, 1209], 2: [697, 1336], 3: [697, 1477], 4: [770, 1209], 5: [770, 1336],
  6: [770, 1477], 7: [852, 1209], 8: [852, 1336], 9: [852, 1477], 0: [941, 1336],
};
/** Dial a short number: `digits` string, one tone pair per digit. */
defineVoice('dtmf', (ac, out, { digits = '551407' }) => {
  const t = ac.currentTime;
  [...digits].forEach((d, i) => {
    const pair = DTMF[d] || DTMF[0];
    for (const f of pair) tone(ac, out, t + i * 0.18, f, 0.11, { peak: 0.05, a: 0.004 });
  });
});

/** Ringback: 425 Hz, one second on, four off; two rings. */
defineVoice('ringback', (ac, out) => {
  const t = ac.currentTime;
  tone(ac, out, t, 425, 1.0, { peak: 0.07 });
  tone(ac, out, t + 5.0, 425, 1.0, { peak: 0.07 });
});

/** The card slot: a click and a short beep. */
defineVoice('cardBeep', (ac, out) => {
  const t = ac.currentTime;
  burst(ac, out, t, { f: 2600, q: 3, peak: 0.25, a: 0.001, d: 0.03 });
  tone(ac, out, t + 0.1, 1400, 0.12, { type: 'square', peak: 0.03 });
});

/** Rock dove coo: "croo-croo-oo", a low throaty tremolo. */
defineVoice('coo', (ac, out, { rate = 1 }) => {
  const t = ac.currentTime;
  const parts = [[0, 0.28, 330], [0.32, 0.22, 300], [0.58, 0.45, 280]];
  for (const [dt, dur, f] of parts) {
    const o = ac.createOscillator();
    o.type = 'sine';
    o.frequency.setValueAtTime(f * rate, t + dt);
    o.frequency.linearRampToValueAtTime(f * rate * 0.92, t + dt + dur);
    const trem = ac.createOscillator();
    trem.frequency.value = 28;
    const tg = ac.createGain();
    tg.gain.value = 0.02;
    const g = ac.createGain();
    env(g, t + dt, 0.04, 0.05, dur);
    trem.connect(tg).connect(g.gain);
    o.connect(g).connect(out);
    o.start(t + dt); trem.start(t + dt);
    o.stop(t + dt + dur + 0.1); trem.stop(t + dt + dur + 0.1);
  }
});

/** A flock clattering up: many overlapping wingbeats, fading. */
defineVoice('wings', (ac, out, { count = 10 }) => {
  const t = ac.currentTime;
  const n = Math.min(40, count * 4);
  for (let i = 0; i < n; i++) {
    const tt = t + Math.random() * 0.9 + (i / n) * 0.4;
    const fade = 1 - i / n * 0.6;
    burst(ac, out, tt, { f: 700 + Math.random() * 900, q: 0.7, peak: 0.16 * fade, a: 0.004, d: 0.05 });
  }
});

/** A dog's happy whine, gliding up and down. */
defineVoice('whine', (ac, out) => {
  const t = ac.currentTime;
  const o = ac.createOscillator();
  o.type = 'triangle';
  o.frequency.setValueAtTime(700, t);
  o.frequency.linearRampToValueAtTime(1150, t + 0.35);
  o.frequency.linearRampToValueAtTime(820, t + 0.7);
  o.frequency.linearRampToValueAtTime(1050, t + 0.95);
  const fl = ac.createBiquadFilter();
  fl.type = 'lowpass';
  fl.frequency.value = 1800;
  const g = ac.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(0.07, t + 0.06);
  g.gain.setValueAtTime(0.07, t + 0.85);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 1.05);
  o.connect(fl).connect(g).connect(out);
  o.start(t);
  o.stop(t + 1.1);
});

/** A single woof. */
defineVoice('woof', (ac, out, { rate = 1 }) => {
  const t = ac.currentTime;
  const o = ac.createOscillator();
  o.type = 'sawtooth';
  o.frequency.setValueAtTime(260 * rate, t);
  o.frequency.exponentialRampToValueAtTime(140 * rate, t + 0.16);
  const fl = ac.createBiquadFilter();
  fl.type = 'bandpass';
  fl.frequency.value = 700;
  fl.Q.value = 1.3;
  const g = ac.createGain();
  env(g, t, 0.01, 0.35, 0.16);
  o.connect(fl).connect(g).connect(out);
  o.start(t);
  o.stop(t + 0.25);
  burst(ac, out, t, { f: 900, q: 0.9, peak: 0.2, a: 0.005, d: 0.12 });
});

/** A tiny sparrow chirp, for the birds by the kiosks. */
defineVoice('chirp', (ac, out) => {
  const t = ac.currentTime;
  for (let i = 0; i < 2; i++) {
    const o = ac.createOscillator();
    o.type = 'sine';
    const f0 = 4200 + Math.random() * 1200;
    o.frequency.setValueAtTime(f0, t + i * 0.1);
    o.frequency.exponentialRampToValueAtTime(f0 * 0.75, t + i * 0.1 + 0.05);
    const g = ac.createGain();
    env(g, t + i * 0.1, 0.004, 0.05, 0.05);
    o.connect(g).connect(out);
    o.start(t + i * 0.1);
    o.stop(t + i * 0.1 + 0.08);
  }
});
