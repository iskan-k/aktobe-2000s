import { defineVoice } from '../../core/audio.js';

/* ------------------------------------------------------------------ *
 * Sounds for the private sector, the bazaar and the edges, registered
 * as synthesised voices on the shared audio engine:
 *
 *   bark      a yard dog behind a gate
 *   water     the standpipe gushing into a bucket
 *   knock     knuckles on a sheet-metal gate
 *   rustle    a paper bag at the bazaar
 *   clank     steel on steel (the crane, a garage door)
 * ------------------------------------------------------------------ */

function env(g, t0, a, peak, d) {
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(Math.max(peak, 0.0002), t0 + a);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + a + d);
}

function noise(ac, secs) {
  const b = ac.createBuffer(1, Math.max(1, Math.floor(ac.sampleRate * secs)), ac.sampleRate);
  const d = b.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  const s = ac.createBufferSource();
  s.buffer = b;
  return s;
}

defineVoice('bark', (ac, out, { volume = 1, rate = 1 }) => {
  const t = ac.currentTime;
  const n = 1 + Math.floor(Math.random() * 3);
  for (let i = 0; i < n; i++) {
    const t0 = t + i * (0.22 + Math.random() * 0.08);
    // voiced part: a sawtooth dropping in pitch through a formant
    const o = ac.createOscillator();
    o.type = 'sawtooth';
    const f0 = (380 + Math.random() * 80) * rate;
    o.frequency.setValueAtTime(f0, t0);
    o.frequency.exponentialRampToValueAtTime(f0 * 0.55, t0 + 0.12);
    const bp = ac.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 900 * rate;
    bp.Q.value = 1.4;
    const g = ac.createGain();
    env(g, t0, 0.012, 0.35 * volume, 0.13);
    o.connect(bp).connect(g).connect(out);
    o.start(t0);
    o.stop(t0 + 0.2);
    // breathy onset
    const s = noise(ac, 0.12);
    const hp = ac.createBiquadFilter();
    hp.type = 'bandpass';
    hp.frequency.value = 1800;
    const g2 = ac.createGain();
    env(g2, t0, 0.005, 0.18 * volume, 0.07);
    s.connect(hp).connect(g2).connect(out);
    s.start(t0);
  }
});

defineVoice('water', (ac, out, { volume = 1, dur = 2.4 }) => {
  const t = ac.currentTime;
  const s = noise(ac, dur + 0.3);
  const bp = ac.createBiquadFilter();
  bp.type = 'bandpass';
  bp.frequency.setValueAtTime(1400, t);
  bp.frequency.linearRampToValueAtTime(700, t + dur);
  bp.Q.value = 0.6;
  const g = ac.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(0.3 * volume, t + 0.15);
  g.gain.setValueAtTime(0.3 * volume, t + dur - 0.3);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  s.connect(bp).connect(g).connect(out);
  s.start(t);
  // the squeak of the lever
  const o = ac.createOscillator();
  o.type = 'triangle';
  o.frequency.setValueAtTime(900, t);
  o.frequency.linearRampToValueAtTime(1300, t + 0.18);
  const g2 = ac.createGain();
  env(g2, t, 0.01, 0.05 * volume, 0.2);
  o.connect(g2).connect(out);
  o.start(t);
  o.stop(t + 0.3);
});

defineVoice('knock', (ac, out, { volume = 1 }) => {
  const t = ac.currentTime;
  for (let i = 0; i < 3; i++) {
    const t0 = t + i * 0.18;
    const o = ac.createOscillator();
    o.type = 'square';
    o.frequency.setValueAtTime(190 + Math.random() * 30, t0);
    o.frequency.exponentialRampToValueAtTime(90, t0 + 0.08);
    const lp = ac.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 1400;
    const g = ac.createGain();
    env(g, t0, 0.002, 0.35 * volume, 0.12);
    o.connect(lp).connect(g).connect(out);
    o.start(t0);
    o.stop(t0 + 0.2);
    // sheet metal ring
    const r = ac.createOscillator();
    r.type = 'sine';
    r.frequency.value = 620 + Math.random() * 90;
    const g2 = ac.createGain();
    env(g2, t0, 0.002, 0.06 * volume, 0.35);
    r.connect(g2).connect(out);
    r.start(t0);
    r.stop(t0 + 0.4);
  }
});

defineVoice('rustle', (ac, out, { volume = 1 }) => {
  const t = ac.currentTime;
  const s = noise(ac, 0.5);
  const hp = ac.createBiquadFilter();
  hp.type = 'highpass';
  hp.frequency.value = 2500;
  const g = ac.createGain();
  g.gain.setValueAtTime(0.0001, t);
  for (let i = 0; i < 5; i++) {
    const t0 = t + i * 0.08 + Math.random() * 0.03;
    g.gain.exponentialRampToValueAtTime(0.18 * volume * (0.5 + Math.random() * 0.5), t0 + 0.01);
    g.gain.exponentialRampToValueAtTime(0.01, t0 + 0.06);
  }
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.48);
  s.connect(hp).connect(g).connect(out);
  s.start(t);
});

defineVoice('clank', (ac, out, { volume = 1 }) => {
  const t = ac.currentTime;
  for (const f of [310, 467, 733]) {
    const o = ac.createOscillator();
    o.type = 'sine';
    o.frequency.value = f * (0.95 + Math.random() * 0.1);
    const g = ac.createGain();
    env(g, t, 0.002, 0.12 * volume, 0.6);
    o.connect(g).connect(out);
    o.start(t);
    o.stop(t + 0.7);
  }
});
