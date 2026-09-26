import { defineLoop, defineVoice } from '../../core/audio.js';

/* ------------------------------------------------------------------ *
 * Aircraft engines, synthesised.
 *
 *   jetEngine   a broadband roar (filtered noise), a low rumble and the
 *               fan whine; `rate` 0..1 is thrust, `near` 0..1 opens the
 *               top end as the aircraft comes close (air eats the highs
 *               of a far jet first)
 *   propEngine  the blade-pass drone of a turboprop, its harmonics and
 *               the turbine whistle over it
 *
 * Both take { rate, near, volume } in set().
 * ------------------------------------------------------------------ */

let noise = null;
function noiseBuf(ac) {
  if (noise && noise.sampleRate === ac.sampleRate) return noise;
  noise = ac.createBuffer(1, ac.sampleRate * 2, ac.sampleRate);
  const d = noise.getChannelData(0);
  let b = 0;
  for (let i = 0; i < d.length; i++) {
    // a little pinkish: white noise through a leaky integrator, mixed back
    const w = Math.random() * 2 - 1;
    b = 0.97 * b + 0.03 * w;
    d[i] = w * 0.6 + b * 3;
  }
  return noise;
}

function noiseSource(ac) {
  const s = ac.createBufferSource();
  s.buffer = noiseBuf(ac);
  s.loop = true;
  s.loopStart = Math.random();
  return s;
}

defineLoop('jetEngine', (ac, out) => {
  const mix = ac.createGain();
  mix.gain.value = 0.0001;
  mix.connect(out);
  const roar = noiseSource(ac);
  const roarLp = ac.createBiquadFilter();
  roarLp.type = 'lowpass';
  roarLp.Q.value = 0.5;
  const roarG = ac.createGain();
  roar.connect(roarLp).connect(roarG).connect(mix);
  const rumble = noiseSource(ac);
  const rumbleLp = ac.createBiquadFilter();
  rumbleLp.type = 'lowpass';
  rumbleLp.frequency.value = 140;
  const rumbleG = ac.createGain();
  rumble.connect(rumbleLp).connect(rumbleG).connect(mix);
  const whine = ac.createOscillator();
  whine.type = 'triangle';
  const whine2 = ac.createOscillator();
  whine2.type = 'sine';
  const whineG = ac.createGain();
  whine.connect(whineG);
  whine2.connect(whineG);
  whineG.connect(mix);
  roar.start(); rumble.start(); whine.start(); whine2.start();
  return {
    set({ rate = 0.3, near = 0.5, volume = 1 }) {
      const t = ac.currentTime;
      roarLp.frequency.setTargetAtTime(300 + near * (900 + rate * 2600), t, 0.25);
      roarG.gain.setTargetAtTime(0.35 + rate * 0.65, t, 0.25);
      rumbleG.gain.setTargetAtTime(0.5 + rate * 0.9, t, 0.25);
      whine.frequency.setTargetAtTime(1400 + rate * 2200, t, 0.6);
      whine2.frequency.setTargetAtTime(2150 + rate * 3100, t, 0.6);
      whineG.gain.setTargetAtTime(0.03 * near * near * (0.4 + rate), t, 0.3);
      mix.gain.setTargetAtTime(Math.max(0.0001, volume * 0.55), t, 0.2);
    },
    stop() {
      mix.gain.setTargetAtTime(0.0001, ac.currentTime, 0.3);
      setTimeout(() => { roar.stop(); rumble.stop(); whine.stop(); whine2.stop(); }, 1500);
    },
  };
});

defineLoop('propEngine', (ac, out) => {
  const mix = ac.createGain();
  mix.gain.value = 0.0001;
  mix.connect(out);
  const lp = ac.createBiquadFilter();
  lp.type = 'lowpass';
  lp.Q.value = 1.2;
  const buzz = ac.createOscillator();
  buzz.type = 'sawtooth';
  const buzz2 = ac.createOscillator();
  buzz2.type = 'sawtooth';
  const buzzG = ac.createGain();
  buzz.connect(lp);
  buzz2.connect(lp);
  lp.connect(buzzG).connect(mix);
  const hiss = noiseSource(ac);
  const bp = ac.createBiquadFilter();
  bp.type = 'bandpass';
  bp.Q.value = 0.7;
  const hissG = ac.createGain();
  hiss.connect(bp).connect(hissG).connect(mix);
  const whistle = ac.createOscillator();
  whistle.type = 'sine';
  const whistleG = ac.createGain();
  whistle.connect(whistleG).connect(mix);
  buzz.start(); buzz2.start(); hiss.start(); whistle.start();
  return {
    set({ rate = 0.3, near = 0.5, volume = 1 }) {
      const t = ac.currentTime;
      // blade passing: about 80 Hz at idle to 110 Hz at take-off power, two engines a hair apart
      buzz.frequency.setTargetAtTime(78 + rate * 32, t, 0.5);
      buzz2.frequency.setTargetAtTime(79.3 + rate * 32.5, t, 0.5);
      lp.frequency.setTargetAtTime(260 + near * (500 + rate * 900), t, 0.3);
      buzzG.gain.setTargetAtTime(0.35 + rate * 0.5, t, 0.3);
      bp.frequency.setTargetAtTime(500 + rate * 900, t, 0.3);
      hissG.gain.setTargetAtTime(0.25 + rate * 0.4, t, 0.3);
      whistle.frequency.setTargetAtTime(2600 + rate * 1500, t, 0.6);
      whistleG.gain.setTargetAtTime(0.02 * near * near, t, 0.3);
      mix.gain.setTargetAtTime(Math.max(0.0001, volume * 0.5), t, 0.2);
    },
    stop() {
      mix.gain.setTargetAtTime(0.0001, ac.currentTime, 0.3);
      setTimeout(() => { buzz.stop(); buzz2.stop(); hiss.stop(); whistle.stop(); }, 1500);
    },
  };
});

/** Main wheels meeting the runway: a short smoky squeal. */
defineVoice('tyreChirp', (ac, out, { volume = 1 }) => {
  const t = ac.currentTime;
  const s = noiseSource(ac);
  const bp = ac.createBiquadFilter();
  bp.type = 'bandpass';
  bp.frequency.setValueAtTime(1900, t);
  bp.frequency.exponentialRampToValueAtTime(900, t + 0.35);
  bp.Q.value = 4;
  const g = ac.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(0.6 * volume, t + 0.02);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.45);
  s.connect(bp).connect(g).connect(out);
  s.start(t);
  s.stop(t + 0.5);
});
