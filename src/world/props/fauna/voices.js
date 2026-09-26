import { defineVoice } from '../../../core/audio.js';

/* ------------------------------------------------------------------ *
 * Animal voices, synthesised like every other sound in town:
 *
 *   purr     a cat under your hand: a low buzzing rumble that swells
 *            on the in-breath and the out-breath
 *   thump    a lying dog's tail beating the ground, three or four times
 *   snort    a horse blowing through its nose
 *   whinny   a horse calling, far off or close
 *   growl    a chained dog's warning before the barking starts
 * ------------------------------------------------------------------ */

function noiseSrc(ac, secs) {
  const b = ac.createBuffer(1, Math.max(1, Math.floor(ac.sampleRate * secs)), ac.sampleRate);
  const d = b.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  const s = ac.createBufferSource();
  s.buffer = b;
  return s;
}

function env(g, t0, a, peak, d) {
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(Math.max(peak, 0.0002), t0 + a);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + a + d);
}

defineVoice('purr', (ac, out, { volume = 1 }) => {
  const t = ac.currentTime;
  const dur = 2.6;
  // the buzz: noise through a low band, gated at about 26 Hz
  const s = noiseSrc(ac, dur + 0.1);
  const bp = ac.createBiquadFilter();
  bp.type = 'bandpass';
  bp.frequency.value = 180;
  bp.Q.value = 0.8;
  const gate = ac.createGain();
  gate.gain.value = 0.5;
  const lfo = ac.createOscillator();
  lfo.type = 'sine';
  lfo.frequency.value = 26;
  const depth = ac.createGain();
  depth.gain.value = 0.5;
  lfo.connect(depth).connect(gate.gain);
  // two breaths: in, out
  const g = ac.createGain();
  g.gain.setValueAtTime(0.0001, t);
  for (let i = 0; i < 2; i++) {
    const t0 = t + i * 1.3;
    g.gain.exponentialRampToValueAtTime(0.5 * volume, t0 + 0.35);
    g.gain.exponentialRampToValueAtTime(0.18 * volume, t0 + 1.2);
  }
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  s.connect(bp).connect(gate).connect(g).connect(out);
  s.start(t); lfo.start(t);
  s.stop(t + dur + 0.1); lfo.stop(t + dur + 0.1);
});

defineVoice('thump', (ac, out, { volume = 1 }) => {
  const t = ac.currentTime;
  const n = 3 + Math.floor(Math.random() * 2);
  for (let i = 0; i < n; i++) {
    const t0 = t + i * 0.19;
    const o = ac.createOscillator();
    o.type = 'sine';
    o.frequency.setValueAtTime(120, t0);
    o.frequency.exponentialRampToValueAtTime(60, t0 + 0.08);
    const g = ac.createGain();
    env(g, t0, 0.004, 0.3 * volume, 0.09);
    o.connect(g).connect(out);
    o.start(t0);
    o.stop(t0 + 0.14);
    const s = noiseSrc(ac, 0.06);
    const lp = ac.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 900;
    const g2 = ac.createGain();
    env(g2, t0, 0.002, 0.12 * volume, 0.04);
    s.connect(lp).connect(g2).connect(out);
    s.start(t0);
  }
});

defineVoice('snort', (ac, out, { volume = 1 }) => {
  const t = ac.currentTime;
  const s = noiseSrc(ac, 0.8);
  const bp = ac.createBiquadFilter();
  bp.type = 'bandpass';
  bp.frequency.setValueAtTime(700, t);
  bp.frequency.linearRampToValueAtTime(380, t + 0.6);
  bp.Q.value = 0.9;
  // the lips flutter: amplitude wobble at 30-40 Hz
  const flutter = ac.createGain();
  flutter.gain.value = 0.6;
  const lfo = ac.createOscillator();
  lfo.frequency.setValueAtTime(38, t);
  lfo.frequency.linearRampToValueAtTime(24, t + 0.6);
  const depth = ac.createGain();
  depth.gain.value = 0.4;
  lfo.connect(depth).connect(flutter.gain);
  const g = ac.createGain();
  env(g, t, 0.03, 0.55 * volume, 0.6);
  s.connect(bp).connect(flutter).connect(g).connect(out);
  s.start(t); lfo.start(t);
  s.stop(t + 0.8); lfo.stop(t + 0.8);
});

defineVoice('whinny', (ac, out, { volume = 1, rate = 1 }) => {
  const t = ac.currentTime;
  const o = ac.createOscillator();
  o.type = 'sawtooth';
  const f0 = 900 * rate;
  o.frequency.setValueAtTime(f0 * 0.8, t);
  o.frequency.linearRampToValueAtTime(f0 * 1.25, t + 0.15);
  o.frequency.linearRampToValueAtTime(f0 * 0.7, t + 1.1);
  o.frequency.linearRampToValueAtTime(f0 * 0.45, t + 1.4);
  // the whinny's shake: fast vibrato that widens as it falls
  const vib = ac.createOscillator();
  vib.frequency.value = 14;
  const vg = ac.createGain();
  vg.gain.setValueAtTime(10, t);
  vg.gain.linearRampToValueAtTime(90 * rate, t + 1.2);
  vib.connect(vg).connect(o.frequency);
  const bp = ac.createBiquadFilter();
  bp.type = 'bandpass';
  bp.frequency.value = 1400 * rate;
  bp.Q.value = 1.1;
  const g = ac.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(0.14 * volume, t + 0.08);
  g.gain.setValueAtTime(0.12 * volume, t + 1.0);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 1.5);
  o.connect(bp).connect(g).connect(out);
  o.start(t); vib.start(t);
  o.stop(t + 1.6); vib.stop(t + 1.6);
});

defineVoice('growl', (ac, out, { volume = 1 }) => {
  const t = ac.currentTime;
  const o = ac.createOscillator();
  o.type = 'sawtooth';
  o.frequency.setValueAtTime(95, t);
  o.frequency.linearRampToValueAtTime(110, t + 0.5);
  o.frequency.linearRampToValueAtTime(90, t + 1.0);
  const am = ac.createGain();
  am.gain.value = 0.6;
  const lfo = ac.createOscillator();
  lfo.frequency.value = 22;
  const d = ac.createGain();
  d.gain.value = 0.4;
  lfo.connect(d).connect(am.gain);
  const bp = ac.createBiquadFilter();
  bp.type = 'bandpass';
  bp.frequency.value = 420;
  bp.Q.value = 1.2;
  const g = ac.createGain();
  env(g, t, 0.15, 0.3 * volume, 0.9);
  o.connect(bp).connect(am).connect(g).connect(out);
  o.start(t); lfo.start(t);
  o.stop(t + 1.2); lfo.stop(t + 1.2);
});
