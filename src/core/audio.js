/* ------------------------------------------------------------------ *
 * Sound, all of it synthesised with WebAudio: there are no sound files.
 *
 *   audio.play(name, { volume, rate, pos })    one-shot voice
 *   audio.loop(name, { volume, rate, pos })    returns a handle with
 *        .set({ volume, rate, pos })  and  .stop()
 *   audio.update(dt, camera)                   positional mixing
 *
 * `pos` is a world position {x, y, z}; positional sounds fall off with
 * distance and pan left / right against the camera. Browsers only allow
 * audio after a user gesture, so nothing starts until `start()`.
 *
 * Background ambience (wind, the far hum of the town, sparrows) starts
 * with it. Optional music: list files in public/audio/playlist.json.
 * ------------------------------------------------------------------ */

const VOICES = {};
const LOOPS = {};

/** Register a one-shot voice: fn(ac, out, opts) plays into `out`. */
export function defineVoice(name, fn) { VOICES[name] = fn; }
/** Register a loop voice: fn(ac, out, opts) -> { set(params), stop() }. */
export function defineLoop(name, fn) { LOOPS[name] = fn; }

function noiseBuffer(ac, secs = 2) {
  const b = ac.createBuffer(1, ac.sampleRate * secs, ac.sampleRate);
  const d = b.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  return b;
}

let NOISE = null;
function noiseSrc(ac, loop = false) {
  const s = ac.createBufferSource();
  s.buffer = NOISE;
  s.loop = loop;
  return s;
}

function env(ac, g, t0, a, peak, d) {
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(Math.max(peak, 0.0002), t0 + a);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + a + d);
}

/* ---------------- built-in voices ---------------- */

defineVoice('step', (ac, out, { volume = 0.5, soft = false }) => {
  const t = ac.currentTime;
  const s = noiseSrc(ac);
  const f = ac.createBiquadFilter();
  // asphalt scuffs bright and short; earth and grass thud and rustle
  f.type = soft ? 'lowpass' : 'bandpass';
  f.frequency.value = soft ? 420 + Math.random() * 200 : 900 + Math.random() * 500;
  f.Q.value = soft ? 0.5 : 0.9;
  const g = ac.createGain();
  env(ac, g, t, soft ? 0.012 : 0.005, (soft ? 0.32 : 0.25) * volume, soft ? 0.13 : 0.09);
  s.connect(f).connect(g).connect(out);
  s.start(t, Math.random());
  s.stop(t + 0.15);
});

defineVoice('coins', (ac, out, { volume = 1 }) => {
  const t = ac.currentTime;
  for (let i = 0; i < 3; i++) {
    const o = ac.createOscillator();
    o.type = 'triangle';
    o.frequency.value = 2400 + Math.random() * 1400;
    const g = ac.createGain();
    env(ac, g, t + i * 0.07, 0.003, 0.12 * volume, 0.22);
    o.connect(g).connect(out);
    o.start(t + i * 0.07);
    o.stop(t + i * 0.07 + 0.3);
  }
});

defineVoice('deny', (ac, out, { volume = 1 }) => {
  const t = ac.currentTime;
  const o = ac.createOscillator();
  o.type = 'square';
  o.frequency.value = 140;
  const g = ac.createGain();
  env(ac, g, t, 0.01, 0.07 * volume, 0.25);
  o.connect(g).connect(out);
  o.start(t);
  o.stop(t + 0.3);
});

/** Two-tone text message beep, the way every phone on the bus sounded. */
defineVoice('sms', (ac, out, { volume = 1 }) => {
  const t = ac.currentTime;
  [[1760, 0], [1760, 0.13], [2349, 0.26]].forEach(([f, dt]) => {
    const o = ac.createOscillator();
    o.type = 'square';
    o.frequency.value = f;
    const g = ac.createGain();
    env(ac, g, t + dt, 0.004, 0.05 * volume, 0.08);
    o.connect(g).connect(out);
    o.start(t + dt);
    o.stop(t + dt + 0.12);
  });
});

/** Pneumatic door: a hiss that sweeps down, then a thunk. */
defineVoice('door', (ac, out, { volume = 1 }) => {
  const t = ac.currentTime;
  const s = noiseSrc(ac);
  const f = ac.createBiquadFilter();
  f.type = 'bandpass';
  f.Q.value = 1.2;
  f.frequency.setValueAtTime(3200, t);
  f.frequency.exponentialRampToValueAtTime(700, t + 0.8);
  const g = ac.createGain();
  env(ac, g, t, 0.04, 0.35 * volume, 0.8);
  s.connect(f).connect(g).connect(out);
  s.start(t, Math.random());
  s.stop(t + 1.0);
  const o = ac.createOscillator();
  o.frequency.setValueAtTime(120, t + 0.75);
  o.frequency.exponentialRampToValueAtTime(50, t + 0.9);
  const g2 = ac.createGain();
  env(ac, g2, t + 0.75, 0.005, 0.35 * volume, 0.15);
  o.connect(g2).connect(out);
  o.start(t + 0.75);
  o.stop(t + 1.0);
});

/** Car horn: two detuned squares through a boxy band-pass. */
defineVoice('horn', (ac, out, { volume = 1, rate = 1, dur = 0.35 }) => {
  const t = ac.currentTime;
  const f = ac.createBiquadFilter();
  f.type = 'bandpass';
  f.frequency.value = 900;
  f.Q.value = 0.8;
  const g = ac.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(0.22 * volume, t + 0.02);
  g.gain.setValueAtTime(0.22 * volume, t + dur);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur + 0.06);
  for (const fr of [415 * rate, 495 * rate]) {
    const o = ac.createOscillator();
    o.type = 'square';
    o.frequency.value = fr;
    o.connect(f);
    o.start(t);
    o.stop(t + dur + 0.1);
  }
  f.connect(g).connect(out);
});

defineVoice('thud', (ac, out, { volume = 1 }) => {
  const t = ac.currentTime;
  const o = ac.createOscillator();
  o.frequency.setValueAtTime(90, t);
  o.frequency.exponentialRampToValueAtTime(40, t + 0.2);
  const g = ac.createGain();
  env(ac, g, t, 0.003, 0.5 * volume, 0.22);
  o.connect(g).connect(out);
  o.start(t);
  o.stop(t + 0.3);
  const s = noiseSrc(ac);
  const nf = ac.createBiquadFilter();
  nf.type = 'lowpass';
  nf.frequency.value = 600;
  const g2 = ac.createGain();
  env(ac, g2, t, 0.002, 0.3 * volume, 0.12);
  s.connect(nf).connect(g2).connect(out);
  s.start(t, Math.random());
  s.stop(t + 0.2);
});

/** A generic soft click, for switches and handles. */
defineVoice('click', (ac, out, { volume = 1 }) => {
  const t = ac.currentTime;
  const s = noiseSrc(ac);
  const f = ac.createBiquadFilter();
  f.type = 'highpass';
  f.frequency.value = 2000;
  const g = ac.createGain();
  env(ac, g, t, 0.001, 0.25 * volume, 0.03);
  s.connect(f).connect(g).connect(out);
  s.start(t, Math.random());
  s.stop(t + 0.06);
});

/* ---------------- built-in loops ---------------- */

/**
 * Combustion engine. `rate` is roughly rpm / 1000 (0.8 idle .. 6 redline);
 * `kind` 'petrol' | 'diesel' | 'bus'. Load (0..1) opens the filter.
 */
defineLoop('engine', (ac, out, { kind = 'petrol' }) => {
  const base = kind === 'petrol' ? 28 : kind === 'diesel' ? 20 : 16;
  const o1 = ac.createOscillator();
  o1.type = 'sawtooth';
  const o2 = ac.createOscillator();
  o2.type = 'square';
  const n = noiseSrc(ac, true);
  const nf = ac.createBiquadFilter();
  nf.type = 'bandpass';
  nf.Q.value = 0.7;
  const ng = ac.createGain();
  ng.gain.value = kind === 'petrol' ? 0.12 : 0.22;
  const lp = ac.createBiquadFilter();
  lp.type = 'lowpass';
  lp.Q.value = 2.5;
  const mix = ac.createGain();
  mix.gain.value = 0.0001;
  const g1 = ac.createGain();
  g1.gain.value = 0.5;
  const g2 = ac.createGain();
  g2.gain.value = 0.25;
  o1.connect(g1).connect(lp);
  o2.connect(g2).connect(lp);
  n.connect(nf).connect(ng).connect(lp);
  lp.connect(mix).connect(out);
  o1.start(); o2.start(); n.start();
  const set = ({ rate = 1, load = 0.3, volume = 1 }) => {
    const t = ac.currentTime;
    const f = base * rate;
    o1.frequency.setTargetAtTime(f, t, 0.05);
    o2.frequency.setTargetAtTime(f * 0.5 * 1.01, t, 0.05);
    nf.frequency.setTargetAtTime(f * 4, t, 0.05);
    lp.frequency.setTargetAtTime(180 + f * (3 + load * 6), t, 0.06);
    mix.gain.setTargetAtTime(Math.max(0.0001, volume * 0.18), t, 0.08);
  };
  return {
    set,
    stop() {
      const t = ac.currentTime;
      mix.gain.setTargetAtTime(0.0001, t, 0.1);
      setTimeout(() => { o1.stop(); o2.stop(); n.stop(); }, 500);
    },
  };
});

/**
 * Trolleybus: no engine, just the traction motor's whine rising with
 * speed, the hum of the converter and a tick of relays.
 */
defineLoop('electric', (ac, out) => {
  const whine = ac.createOscillator();
  whine.type = 'sine';
  const hum = ac.createOscillator();
  hum.type = 'triangle';
  hum.frequency.value = 100;
  const gw = ac.createGain();
  gw.gain.value = 0.0001;
  const gh = ac.createGain();
  gh.gain.value = 0.0001;
  whine.connect(gw).connect(out);
  hum.connect(gh).connect(out);
  whine.start(); hum.start();
  return {
    set({ rate = 1, load = 0.3, volume = 1 }) {
      const t = ac.currentTime;
      whine.frequency.setTargetAtTime(180 + rate * 260, t, 0.1);
      gw.gain.setTargetAtTime(Math.max(0.0001, volume * 0.035 * (0.3 + load)), t, 0.1);
      gh.gain.setTargetAtTime(Math.max(0.0001, volume * 0.04), t, 0.1);
    },
    stop() {
      const t = ac.currentTime;
      gw.gain.setTargetAtTime(0.0001, t, 0.1);
      gh.gain.setTargetAtTime(0.0001, t, 0.1);
      setTimeout(() => { whine.stop(); hum.stop(); }, 500);
    },
  };
});

/** Filtered noise bed, for wind, tyres on asphalt and a far-off town. */
defineLoop('noise', (ac, out, { freq = 400, q = 0.5, type = 'lowpass' }) => {
  const n = noiseSrc(ac, true);
  const f = ac.createBiquadFilter();
  f.type = type;
  f.frequency.value = freq;
  f.Q.value = q;
  const g = ac.createGain();
  g.gain.value = 0.0001;
  n.connect(f).connect(g).connect(out);
  n.start(0, Math.random() * 1.5);
  return {
    set({ volume = 1, freq: fr }) {
      const t = ac.currentTime;
      g.gain.setTargetAtTime(Math.max(0.0001, volume), t, 0.2);
      if (fr) f.frequency.setTargetAtTime(fr, t, 0.2);
    },
    stop() { g.gain.setTargetAtTime(0.0001, ac.currentTime, 0.2); setTimeout(() => n.stop(), 800); },
  };
});

/* ---------------- engine ---------------- */

const REF_DIST = 6;     // full volume inside this distance
const MAX_DIST = 140;   // silent beyond

export function createAudio({ volume = 0.5 } = {}) {
  let ac = null, master = null, sfx = null, amb = null, musicGain = null;
  let muted = false;
  let vol = volume;
  const loops = new Set();
  const listener = { x: 0, y: 0, z: 0, rx: 1, rz: 0 };
  let birdsT = 2;
  let ambience = null;

  function spatial(pos, volumeIn) {
    if (!pos) return { gain: volumeIn, pan: 0 };
    const dx = pos.x - listener.x, dy = (pos.y ?? 0) - listener.y, dz = pos.z - listener.z;
    const d = Math.hypot(dx, dy, dz);
    if (d > MAX_DIST) return { gain: 0, pan: 0 };
    const fall = d < REF_DIST ? 1 : REF_DIST / (REF_DIST + (d - REF_DIST) * 1.1);
    const edge = 1 - Math.max(0, (d - MAX_DIST * 0.7) / (MAX_DIST * 0.3));
    const pan = d > 0.5 ? Math.max(-1, Math.min(1, (dx * listener.rx + dz * listener.rz) / d)) : 0;
    return { gain: volumeIn * fall * edge, pan: pan * 0.8 };
  }

  function chain(pos, volumeIn) {
    const g = ac.createGain();
    const p = ac.createStereoPanner();
    const s = spatial(pos, volumeIn);
    g.gain.value = s.gain;
    p.pan.value = s.pan;
    g.connect(p).connect(sfx);
    return { g, p };
  }

  async function loadMusic() {
    try {
      const res = await fetch('./audio/playlist.json');
      if (!res.ok) return;
      const list = await res.json();
      if (!Array.isArray(list) || !list.length) return;
      const el = new Audio();
      let i = Math.floor(Math.random() * list.length);
      const next = () => { el.src = `./audio/${list[i % list.length]}`; i++; el.play().catch(() => {}); };
      el.addEventListener('ended', next);
      const src = ac.createMediaElementSource(el);
      src.connect(musicGain);
      next();
    } catch {
      // no playlist: the town runs on its own sounds
    }
  }

  function startAmbience() {
    const wind = LOOPS.noise(ac, amb, { freq: 380, q: 0.3 });
    const hum = LOOPS.noise(ac, amb, { freq: 120, q: 0.7 });
    wind.set({ volume: 0.05 });
    hum.set({ volume: 0.06 });
    ambience = { wind, hum, t: 0 };
  }

  function sparrow(when) {
    const t = ac.currentTime + when;
    const n = 2 + Math.floor(Math.random() * 4);
    const g = ac.createGain();
    const p = ac.createStereoPanner();
    p.pan.value = Math.random() * 1.6 - 0.8;
    g.gain.value = 0.02 + Math.random() * 0.03;
    g.connect(p).connect(amb);
    for (let i = 0; i < n; i++) {
      const o = ac.createOscillator();
      o.type = 'sine';
      const t0 = t + i * (0.09 + Math.random() * 0.05);
      const f0 = 3800 + Math.random() * 1400;
      o.frequency.setValueAtTime(f0, t0);
      o.frequency.exponentialRampToValueAtTime(f0 * (0.7 + Math.random() * 0.2), t0 + 0.06);
      const e = ac.createGain();
      env(ac, e, t0, 0.005, 1, 0.06);
      o.connect(e).connect(g);
      o.start(t0);
      o.stop(t0 + 0.1);
    }
  }

  const api = {
    get ready() { return !!ac; },
    get muted() { return muted; },
    get volume() { return vol; },
    start() {
      if (ac) { if (ac.state === 'suspended') ac.resume(); return; }
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (!Ctx) return;
      ac = new Ctx();
      NOISE = noiseBuffer(ac, 2);
      master = ac.createGain();
      master.gain.value = muted ? 0 : vol;
      const comp = ac.createDynamicsCompressor();
      comp.threshold.value = -14;
      comp.ratio.value = 4;
      master.connect(comp).connect(ac.destination);
      sfx = ac.createGain();
      sfx.connect(master);
      amb = ac.createGain();
      amb.connect(master);
      musicGain = ac.createGain();
      musicGain.gain.value = 0.5;
      musicGain.connect(master);
      startAmbience();
      loadMusic();
      document.addEventListener('visibilitychange', () => {
        if (document.hidden) ac.suspend(); else ac.resume();
      });
    },
    setVolume(v) {
      vol = v;
      if (master && !muted) master.gain.setTargetAtTime(v, ac.currentTime, 0.05);
    },
    toggleMute() {
      muted = !muted;
      if (master) master.gain.setTargetAtTime(muted ? 0 : vol, ac.currentTime, 0.05);
      return muted;
    },
    play(name, opts = {}) {
      if (!ac || !VOICES[name]) return;
      const { g } = chain(opts.pos, opts.volume ?? 1);
      if (g.gain.value <= 0.0005) return;
      VOICES[name](ac, g, { ...opts, volume: 1 });
    },
    loop(name, opts = {}) {
      const handle = {
        name, opts: { ...opts }, voice: null, g: null, p: null, stopped: false,
        set(params) { Object.assign(this.opts, params); if (this.voice) this.voice.set({ ...this.opts, volume: 1 }); },
        stop() { this.stopped = true; this.voice?.stop(); loops.delete(this); },
      };
      loops.add(handle);
      return handle;
    },
    update(dt, camera) {
      if (camera) {
        listener.x = camera.position.x;
        listener.y = camera.position.y;
        listener.z = camera.position.z;
        const yaw = camera.rotation.y;
        listener.rx = Math.cos(yaw);
        listener.rz = -Math.sin(yaw);
      }
      if (!ac) return;
      for (const h of loops) {
        if (h.stopped) continue;
        const s = spatial(h.opts.pos, h.opts.volume ?? 1);
        if (!h.voice && s.gain > 0.001) {
          // create lazily when the source comes into earshot
          const c = chain(h.opts.pos, h.opts.volume ?? 1);
          h.g = c.g; h.p = c.p;
          h.voice = LOOPS[h.name](ac, h.g, h.opts);
          h.voice.set({ ...h.opts, volume: 1 });
        }
        if (h.voice) {
          h.g.gain.setTargetAtTime(s.gain, ac.currentTime, 0.08);
          h.p.pan.setTargetAtTime(s.pan, ac.currentTime, 0.08);
          if (s.gain <= 0.0005 && h.opts.pos) {
            // out of earshot: free the nodes, keep the handle
            h.voice.stop();
            h.voice = null;
            h.g = null;
          }
        }
      }
      if (ambience) {
        ambience.t += dt;
        const gust = 0.045 + 0.03 * Math.sin(ambience.t * 0.21) * Math.sin(ambience.t * 0.53 + 1);
        ambience.wind.set({ volume: gust, freq: 300 + gust * 3000 });
      }
      birdsT -= dt;
      if (birdsT <= 0) {
        sparrow(0);
        birdsT = 1.5 + Math.random() * 5;
      }
    },
  };
  return api;
}
