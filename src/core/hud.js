/* ------------------------------------------------------------------ *
 * HUD: title card, crosshair, interaction prompt, toasts styled as an
 * SMS on a mid-2000s phone screen, a wallet in tenge, a speedometer
 * for when you drive, and the coordinate readout (C) for building.
 *
 * Styles live in index.html. This file only builds DOM and exposes a
 * small API; it never reads game state by itself.
 * ------------------------------------------------------------------ */

const fmtTenge = (n) => `${Math.round(n).toLocaleString('ru-RU').replace(/ /g, ' ')} ₸`;

export function createHud({ volume = 0.5 } = {}) {
  const el = (tag, cls, parent, html) => {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (html !== undefined) n.innerHTML = html;
    (parent || document.body).appendChild(n);
    return n;
  };

  const root = el('div', 'hud');
  const crosshair = el('div', 'crosshair', root);
  const prompt = el('div', 'prompt', root, '');
  const toast = el('div', 'toast', root, '');
  const sms = el('div', 'sms', root, `
    <div class="sms-top"><span class="sms-net">K'CELL</span><span class="sms-bars">▂▄▆█</span></div>
    <div class="sms-from"></div>
    <div class="sms-body"></div>`);
  const wallet = el('div', 'wallet', root, '');
  const speedo = el('div', 'speedo', root, `
    <div class="speedo-dial"><div class="speedo-needle"></div><div class="speedo-hub"></div>
      <div class="speedo-ticks"></div></div>
    <div class="speedo-read"><b>0</b> км/ч</div>`);
  const hint = el('div', 'hint', root, '');
  const coords = el('div', 'coords', root, '');
  const stats = el('div', 'stats', root, '');

  const ticks = speedo.querySelector('.speedo-ticks');
  for (let v = 0; v <= 160; v += 20) {
    const t = el('span', 'tick', ticks, `<i>${v}</i>`);
    t.style.setProperty('--a', `${-130 + (v / 160) * 260}deg`);
  }

  const overlay = el('div', 'overlay', root);
  overlay.dataset.mode = 'start';
  overlay.innerHTML = `
    <section class="card" role="dialog" aria-labelledby="card-title">
      <div class="card-art" aria-hidden="true">
        <div class="art-sky"></div>
        <div class="art-sun"></div>
        <div class="art-block b1"></div><div class="art-block b2"></div><div class="art-block b3"></div>
        <div class="art-poplar p1"></div><div class="art-poplar p2"></div><div class="art-poplar p3"></div>
        <div class="art-road"></div>
        <div class="art-bus"><i></i><i></i><i></i><i></i><b>44</b></div>
        <div class="art-stamp">ИЮНЬ 2007</div>
      </div>
      <div class="card-copy">
        <div class="kicker">
          <span class="start-only">Ақтөбе · Актобе · Kazakhstan</span>
          <span class="pause-only">Пауза · Paused</span>
        </div>
        <h1 id="card-title">Aktobe <span>2000s</span></h1>
        <p class="lede start-only">
          A warm June evening. Poplar fluff drifting over the avenue, marshrutkas
          stopping wherever you wave, a kiosk selling ice cream for sixty tenge.
          Walk the microdistrict, ride the number 44, or take the old семёрка
          for a spin.
        </p>
        <p class="lede pause-only">
          The town waits where you left it. Adjust the sound, then carry on.
        </p>
        <div class="keys">
          <span><b>WASD</b> walk</span>
          <span><b>Shift</b> run</span>
          <span><b>Mouse</b> look</span>
          <span><b>E</b> use · board · get in</span>
          <span><b>V</b> call your car</span>
          <span><b>Space</b> brake / horn in car</span>
          <span><b>F</b> car camera</span>
          <span><b>M</b> sound</span>
          <span><b>T</b> map</span>
          <span><b>R</b> back to start</span>
        </div>
        <label class="audio pause-only">
          <span>Sound</span>
          <input class="volume" type="range" min="0" max="100" step="1" value="50" aria-label="Volume" />
          <output>50%</output>
        </label>
        <button class="go" type="button">
          <span class="start-only">Поехали</span><span class="pause-only">Continue</span> <i>→</i>
        </button>
        <div class="foot"><span>everything here is drawn in code</span><span class="start-only">click to begin</span><span class="pause-only">esc pauses</span></div>
      </div>
    </section>`;

  const goBtn = overlay.querySelector('.go');
  const slider = overlay.querySelector('.volume');
  const out = overlay.querySelector('.audio output');
  const setVol = (v) => {
    const p = Math.round(Math.max(0, Math.min(1, v)) * 100);
    slider.value = String(p);
    out.textContent = `${p}%`;
  };
  setVol(volume);

  let toastTimer = null;
  let smsTimer = null;
  let started = false;
  let coordsOn = false;
  let coordsAcc = 1e9;
  let lastLine = '';
  let hintTimer = 0;
  let hintText = '';

  const api = {
    root,
    onStart: null,
    onVolume: null,

    flash(text, ms = 1600) {
      toast.textContent = text;
      toast.classList.add('on');
      clearTimeout(toastTimer);
      toastTimer = setTimeout(() => toast.classList.remove('on'), ms);
    },

    /** A text message on the phone in the corner. */
    sms(from, body, ms = 5200) {
      sms.querySelector('.sms-from').textContent = from;
      sms.querySelector('.sms-body').textContent = body;
      sms.classList.add('on');
      clearTimeout(smsTimer);
      smsTimer = setTimeout(() => sms.classList.remove('on'), ms);
    },

    setPrompt(text) {
      if (text) {
        if (prompt.textContent !== text) prompt.textContent = text;
        prompt.classList.add('on');
      } else prompt.classList.remove('on');
    },

    setWallet(n) {
      wallet.innerHTML = `<span>кошелёк</span> ${fmtTenge(n)}`;
      wallet.classList.add('on');
    },

    pulseWallet(delta) {
      wallet.classList.remove('spent');
      void wallet.offsetWidth;
      if (delta < 0) wallet.classList.add('spent');
    },

    /** Speedometer: null hides it. */
    setSpeed(kmh) {
      if (kmh === null) { speedo.classList.remove('on'); return; }
      speedo.classList.add('on');
      const v = Math.max(0, Math.min(160, Math.abs(kmh)));
      speedo.querySelector('.speedo-needle').style.transform = `rotate(${-130 + (v / 160) * 260}deg)`;
      speedo.querySelector('.speedo-read b').textContent = String(Math.round(Math.abs(kmh)));
    },

    setHint(text, secs = 12) {
      hintText = text;
      hint.innerHTML = text;
      hint.classList.toggle('faded', !text);
      hintTimer = secs;
    },

    setCrosshair(on) { crosshair.classList.toggle('hidden', !on); },

    setLocked(locked) {
      if (locked) started = true;
      overlay.dataset.mode = started ? 'paused' : 'start';
      overlay.classList.toggle('hidden', locked);
      crosshair.classList.toggle('on', locked);
      if (locked && hintText) { hint.classList.remove('faded'); hintTimer = 12; }
    },

    hideOverlay() { overlay.classList.add('hidden'); },
    setVolume(v) { setVol(v); },

    toggleCoords() {
      coordsOn = !coordsOn;
      coords.classList.toggle('on', coordsOn);
      coordsAcc = 1e9;
      return coordsOn;
    },

    setCoords(p, yaw, pitch, dt) {
      if (!coordsOn) return;
      coordsAcc += dt;
      if (coordsAcc < 0.1) return;
      coordsAcc = 0;
      const n = (v, d = 2) => v.toFixed(d);
      let y = yaw % (Math.PI * 2);
      if (y > Math.PI) y -= Math.PI * 2;
      if (y <= -Math.PI) y += Math.PI * 2;
      // forward = (-sin yaw, -cos yaw): yaw 0 faces north (-z), yaw grows toward west
      const DIRS = ['north', 'north-west', 'west', 'south-west', 'south', 'south-east', 'east', 'north-east'];
      const compass = DIRS[((Math.round((y / (Math.PI * 2)) * 8) % 8) + 8) % 8];
      lastLine = `{ x: ${n(p.x, 1)}, z: ${n(p.z, 1)}, yaw: ${n(y)}, pitch: ${n(pitch)} }`;
      coords.innerHTML = `x ${n(p.x)}  z ${n(p.z)}  y ${n(p.y)}<br>yaw ${n(y)}  pitch ${n(pitch)}  <i>${compass}</i><br><small>${lastLine}</small>`;
    },

    copyCoords() {
      if (!lastLine) return;
      navigator.clipboard?.writeText(lastLine).then(() => api.flash('copied  ' + lastLine, 2000), () => {});
    },

    setStats(text) {
      stats.textContent = text;
      stats.classList.toggle('on', !!text);
    },

    update(dt) {
      if (hintTimer > 0) {
        hintTimer -= dt;
        if (hintTimer <= 0) hint.classList.add('faded');
      }
    },
  };

  goBtn.addEventListener('click', (e) => { e.stopPropagation(); api.onStart?.(); });
  overlay.addEventListener('click', (e) => {
    if (e.target.closest('.audio')) return;
    api.onStart?.();
  });
  for (const ev of ['click', 'pointerdown', 'pointerup']) {
    overlay.querySelector('.audio').addEventListener(ev, (e) => e.stopPropagation());
  }
  slider.addEventListener('input', () => {
    const v = Number(slider.value) / 100;
    setVol(v);
    api.onVolume?.(v);
  });
  coords.addEventListener('click', (e) => { e.stopPropagation(); api.copyCoords(); });

  return api;
}
