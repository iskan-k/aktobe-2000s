import { defineVoice, defineLoop } from '../core/audio.js';

/* ------------------------------------------------------------------ *
 * Railway sounds, synthesised like everything else.
 *
 *   trainHorn  (voice) one note of the 2TE10's deep two-tone horn
 *   clack      (voice) a wheelset over a rail joint
 *   chime      (voice) the station's three-note chime and a murmur of
 *              an announcement nobody can quite make out
 *   diesel     (loop)  the 10D100 engines: a low drone with the
 *              knock of the cylinders, rising with `rate`
 *   bell       (loop)  the level crossing's electric bell
 * ------------------------------------------------------------------ */

let noise = null;
function noiseBuf(ac) {
  if (noise && noise.sampleRate === ac.sampleRate) return noise;
  noise = ac.createBuffer(1, ac.sampleRate * 2, ac.sampleRate);
  const d = noise.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  return noise;
}

const HORN_TONES = { low: [185, 233], high: [277, 349] };

/** One note of the two-tone horn: `tone` 'low' (the тифон) or 'high'. */
defineVoice('trainHorn', (ac, out, { volume = 1, dur = 1.6, tone = 'low' }) => {
  const t = ac.currentTime;
  const lp = ac.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.value = 1400;
  lp.Q.value = 1.2;
  const g = ac.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(0.32 * volume, t + 0.08);
  g.gain.setValueAtTime(0.32 * volume, t + dur);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur + 0.35);
  lp.connect(g).connect(out);
  const vib = ac.createOscillator();
  vib.frequency.value = 5.5;
  const vg = ac.createGain();
  vg.gain.value = 1.8;
  vib.connect(vg);
  for (const f of HORN_TONES[tone] || HORN_TONES.low) {
    const o = ac.createOscillator();
    o.type = 'sawtooth';
    o.frequency.value = f;
    vg.connect(o.frequency);
    o.connect(lp);
    o.start(t);
    o.stop(t + dur + 0.4);
  }
  vib.start(t);
  vib.stop(t + dur + 0.4);
});

defineVoice('clack', (ac, out, { volume = 1 }) => {
  const t = ac.currentTime;
  const s = ac.createBufferSource();
  s.buffer = noiseBuf(ac);
  const bp = ac.createBiquadFilter();
  bp.type = 'bandpass';
  bp.frequency.value = 1500 + Math.random() * 500;
  bp.Q.value = 1.6;
  const g = ac.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(0.5 * volume, t + 0.003);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.07);
  s.connect(bp).connect(g).connect(out);
  s.start(t, Math.random());
  s.stop(t + 0.1);
  const o = ac.createOscillator();
  o.frequency.setValueAtTime(140, t);
  o.frequency.exponentialRampToValueAtTime(60, t + 0.08);
  const g2 = ac.createGain();
  g2.gain.setValueAtTime(0.0001, t);
  g2.gain.exponentialRampToValueAtTime(0.4 * volume, t + 0.004);
  g2.gain.exponentialRampToValueAtTime(0.0001, t + 0.09);
  o.connect(g2).connect(out);
  o.start(t);
  o.stop(t + 0.12);
});

defineVoice('chime', (ac, out, { volume = 1 }) => {
  const t = ac.currentTime;
  [[659, 0], [523, 0.45], [784, 0.9]].forEach(([f, dt]) => {
    for (const h of [1, 2.01]) {
      const o = ac.createOscillator();
      o.type = 'sine';
      o.frequency.value = f * h;
      const g = ac.createGain();
      g.gain.setValueAtTime(0.0001, t + dt);
      g.gain.exponentialRampToValueAtTime((h === 1 ? 0.16 : 0.04) * volume, t + dt + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dt + 1.1);
      o.connect(g).connect(out);
      o.start(t + dt);
      o.stop(t + dt + 1.2);
    }
  });
  // the announcement: formant-filtered noise, syllable-paced
  const s = ac.createBufferSource();
  s.buffer = noiseBuf(ac);
  s.loop = true;
  const f1 = ac.createBiquadFilter();
  f1.type = 'bandpass';
  f1.frequency.value = 700;
  f1.Q.value = 3;
  const g = ac.createGain();
  g.gain.value = 0;
  const t0 = t + 1.8;
  for (let i = 0; i < 26; i++) {
    const st = t0 + i * 0.19 + (Math.random() - 0.5) * 0.04;
    g.gain.setTargetAtTime(Math.random() < 0.15 ? 0 : 0.09 * volume, st, 0.02);
    g.gain.setTargetAtTime(0.01, st + 0.12, 0.03);
    f1.frequency.setValueAtTime(500 + Math.random() * 900, st);
  }
  g.gain.setTargetAtTime(0, t0 + 26 * 0.19, 0.05);
  s.connect(f1).connect(g).connect(out);
  s.start(t0, Math.random());
  s.stop(t0 + 26 * 0.19 + 0.3);
});

defineLoop('diesel', (ac, out) => {
  const o = ac.createOscillator();
  o.type = 'sawtooth';
  const o2 = ac.createOscillator();
  o2.type = 'square';
  const lp = ac.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.value = 220;
  lp.Q.value = 1.5;
  // the knock: amplitude modulation at the firing rate
  const am = ac.createGain();
  am.gain.value = 0.6;
  const lfo = ac.createOscillator();
  lfo.type = 'square';
  const lfoG = ac.createGain();
  lfoG.gain.value = 0.35;
  lfo.connect(lfoG).connect(am.gain);
  const n = ac.createBufferSource();
  n.buffer = noiseBuf(ac);
  n.loop = true;
  const nf = ac.createBiquadFilter();
  nf.type = 'bandpass';
  nf.frequency.value = 420;
  nf.Q.value = 0.8;
  const ng = ac.createGain();
  ng.gain.value = 0.25;
  const mix = ac.createGain();
  mix.gain.value = 0.0001;
  o.connect(lp);
  o2.connect(lp);
  n.connect(nf).connect(ng).connect(lp);
  lp.connect(am).connect(mix).connect(out);
  o.start(); o2.start(); n.start(); lfo.start();
  return {
    set({ rate = 1, volume = 1 }) {
      const t = ac.currentTime;
      o.frequency.setTargetAtTime(26 + rate * 12, t, 0.2);
      o2.frequency.setTargetAtTime(13 + rate * 6, t, 0.2);
      lfo.frequency.setTargetAtTime(6 + rate * 5, t, 0.2);
      lp.frequency.setTargetAtTime(180 + rate * 160, t, 0.2);
      mix.gain.setTargetAtTime(Math.max(0.0001, volume * 0.5), t, 0.15);
    },
    stop() {
      mix.gain.setTargetAtTime(0.0001, ac.currentTime, 0.15);
      setTimeout(() => { o.stop(); o2.stop(); n.stop(); lfo.stop(); }, 700);
    },
  };
});

/** Pre-rendered strikes of a crossing bell, twelve a second, looped. */
defineLoop('bell', (ac, out) => {
  const sr = ac.sampleRate;
  const len = sr;              // one second loop
  const buf = ac.createBuffer(1, len, sr);
  const d = buf.getChannelData(0);
  const strikes = 12;
  const partials = [[1180, 1], [2830, 0.5], [4150, 0.25]];
  for (let k = 0; k < strikes; k++) {
    const t0 = Math.floor((k * len) / strikes);
    for (let i = 0; i < len - t0; i++) {
      const tt = i / sr;
      const env = Math.exp(-tt * 38);
      if (env < 0.001) break;
      let v = 0;
      for (const [f, a] of partials) v += Math.sin(2 * Math.PI * f * tt) * a;
      d[t0 + i] += v * env * 0.28;
    }
  }
  const s = ac.createBufferSource();
  s.buffer = buf;
  s.loop = true;
  const g = ac.createGain();
  g.gain.value = 0.0001;
  s.connect(g).connect(out);
  s.start();
  return {
    set({ volume = 1 }) { g.gain.setTargetAtTime(Math.max(0.0001, volume * 0.5), ac.currentTime, 0.05); },
    stop() { g.gain.setTargetAtTime(0.0001, ac.currentTime, 0.05); setTimeout(() => s.stop(), 300); },
  };
});
