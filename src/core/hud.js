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
      <div class="postcard" aria-hidden="true">
        <div class="pc-photo">
          <div class="pc-slides"><div class="pc-wait"><span>Ақтөбе</span></div></div>
          <div class="pc-caption"></div>
          <div class="pc-greeting">
            <span class="pc-big start-only">Привет из Актобе!</span>
            <span class="pc-big pause-only">Вы здесь</span>
            <span class="pc-small start-only">Ақтөбеден сәлем!</span>
            <span class="pc-small pause-only">you are here · сіз осындасыз</span>
          </div>
        </div>
        <div class="pc-stamp">
          <div class="pc-stamp-in">
            <div class="pc-stamp-img"></div>
            <b>ҚАЗАҚСТАН</b>
            <i>25 ₸</i><em>2007</em>
          </div>
        </div>
        <svg class="pc-postmark" viewBox="0 0 220 120">
          <defs><path id="pm-ring" d="M150,60 m-38,0 a38,38 0 1,1 76,0 a38,38 0 1,1 -76,0"/></defs>
          <g fill="none" stroke="currentColor">
            <path d="M4,42 q14,-9 28,0 t28,0 t28,0 t28,0" stroke-width="2.4"/>
            <path d="M4,56 q14,-9 28,0 t28,0 t28,0 t28,0" stroke-width="2.4"/>
            <path d="M4,70 q14,-9 28,0 t28,0 t28,0 t28,0" stroke-width="2.4"/>
            <path d="M4,84 q14,-9 28,0 t28,0 t28,0 t28,0" stroke-width="2.4"/>
            <circle cx="150" cy="60" r="46" stroke-width="2.6"/>
            <circle cx="150" cy="60" r="29" stroke-width="1.6"/>
          </g>
          <text font-size="11.5" font-weight="700" letter-spacing="1.6" fill="currentColor">
            <textPath href="#pm-ring" startOffset="2%">АҚТӨБЕ · АКТОБЕ · ПОЧТА ·</textPath>
          </text>
          <text x="150" y="56" text-anchor="middle" font-size="13" font-weight="700" fill="currentColor">15 06</text>
          <text x="150" y="72" text-anchor="middle" font-size="13" font-weight="700" fill="currentColor">2007</text>
        </svg>
      </div>
      <div class="card-copy">
        <div class="kicker">
          <span class="start-only">Ақтөбе · Актобе · Қазақстан</span>
          <span class="pause-only">Үзіліс · Пауза · Paused</span>
        </div>
        <h1 id="card-title">Aktobe <span>2000s</span></h1>
        <p class="lede start-only">
          A warm June evening. Poplar fluff drifts over the avenue, marshrutkas
          stop wherever you wave, and the kiosk sells пломбир for fifty tenge.
          Walk the microdistrict, ride trolleybus №1, or take the old семёрка
          for a spin.
        </p>
        <p class="lede pause-only">
          The town waits where you left it. Turn the sound up or down, then
          carry on.
        </p>
        <ul class="keys">
          <li><b>WASD</b><span>walk, drive</span></li>
          <li><b>Mouse</b><span>look</span></li>
          <li><b>Shift</b><span>run</span></li>
          <li><b>Space</b><span>jump · horn in the car</span></li>
          <li><b>E</b><span>use · buy · board · get in</span></li>
          <li><b>Click</b><span>eat or drink · also F</span></li>
          <li><b>V</b><span>call your car</span></li>
          <li><b>F</b><span>car camera</span></li>
          <li><b>T</b><span>map</span></li>
          <li><b>M</b><span>sound</span></li>
          <li><b>R</b><span>back to the start</span></li>
          <li><b>Esc</b><span>pause</span></li>
        </ul>
        <label class="audio pause-only">
          <span>Sound</span>
          <input class="volume" type="range" min="0" max="100" step="1" value="50" aria-label="Volume" />
          <output>50%</output>
        </label>
        <div class="card-actions">
          <button class="go" type="button">
            <span class="start-only">Поехали</span><span class="pause-only">Continue</span> <i>→</i>
          </button>
          <span class="go-note start-only">click to begin</span>
          <span class="go-note pause-only">Esc pauses again</span>
        </div>
        <div class="foot"><span>everything here is drawn in code</span><span>June 2007</span></div>
      </div>
    </section>`;

  /* The postcard: real views of the town, rendered when it is ready, in a
   * slow crossfade. Pausing puts the view you left on top. */
  const slidesEl = overlay.querySelector('.pc-slides');
  const captionEl = overlay.querySelector('.pc-caption');
  const stampImg = overlay.querySelector('.pc-stamp-img');
  let slides = [];
  let pausePhoto = null;
  let slideIdx = 0;
  let slideTimer = null;
  const SLIDE_MS = 6500;

  function showSlide(i) {
    const list = overlay.dataset.mode === 'paused' && pausePhoto ? [pausePhoto, ...slides] : slides;
    if (!list.length) return;
    slideIdx = ((i % list.length) + list.length) % list.length;
    const cur = list[slideIdx];
    for (const img of slidesEl.querySelectorAll('img')) img.classList.toggle('on', img.dataset.key === cur.key);
    captionEl.textContent = cur.caption || '';
  }

  function renderSlides() {
    const all = pausePhoto ? [pausePhoto, ...slides] : slides;
    slidesEl.innerHTML = '';
    for (const sl of all) {
      const img = document.createElement('img');
      img.src = sl.src;
      img.alt = '';
      img.dataset.key = sl.key;
      slidesEl.appendChild(img);
    }
    showSlide(0);
    clearInterval(slideTimer);
    slideTimer = setInterval(() => { if (!overlay.classList.contains('hidden')) showSlide(slideIdx + 1); }, SLIDE_MS);
  }

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
      if (!locked) showSlide(0);
      crosshair.classList.toggle('on', locked);
      if (locked && hintText) { hint.classList.remove('faded'); hintTimer = 12; }
    },

    hideOverlay() { overlay.classList.add('hidden'); },

    /** Show the card (dev and screenshots): 'start' or 'paused'. */
    showOverlay(mode = 'start') {
      overlay.dataset.mode = mode;
      overlay.classList.remove('hidden');
      showSlide(0);
    },

    /** Views of the town for the postcard: [{ src, caption }]. The first one also goes on the stamp. */
    setPostcards(list) {
      slides = list.map((sl, i) => ({ ...sl, key: 'v' + i }));
      if (slides[1]) stampImg.style.backgroundImage = `url(${slides[1].src})`;
      renderSlides();
    },

    /** The view you paused on, shown first while the card is up. */
    setPausePhoto(src) {
      pausePhoto = src ? { src, caption: 'Вы здесь · you are here', key: 'here' } : null;
      renderSlides();
    },
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
