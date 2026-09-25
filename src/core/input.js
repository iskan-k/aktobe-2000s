/* ------------------------------------------------------------------ *
 * Keyboard and mouse.
 *
 * One place that knows which keys are down and how far the mouse moved
 * since the last frame. Controllers read `down()` for held keys and
 * subscribe with `on(code, fn)` for presses. Presses only fire while the
 * pointer is locked, so typing in the pause menu never walks you off.
 * ------------------------------------------------------------------ */

export class Input {
  constructor(dom) {
    this.dom = dom;
    this.keys = new Set();
    this.locked = false;
    this.mouseDX = 0;
    this.mouseDY = 0;
    this.sensitivity = 0.0022;
    this.handlers = new Map();
    this.anyHandlers = [];
    this.onLockChange = null;
    this.force = false;   // dev: act as if the pointer were locked

    document.addEventListener('mousemove', (e) => {
      if (!this.locked) return;
      this.mouseDX += e.movementX;
      this.mouseDY += e.movementY;
    });
    document.addEventListener('pointerlockchange', () => {
      this.locked = document.pointerLockElement === this.dom;
      if (!this.locked) this.keys.clear();
      this.onLockChange?.(this.locked);
    });
    window.addEventListener('keydown', (e) => {
      const c = e.code;
      if (['KeyW', 'KeyA', 'KeyS', 'KeyD', 'Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(c) && this.locked) {
        e.preventDefault();
      }
      if (e.repeat) return;
      this.keys.add(c);
      if (!this.locked && !this.force && !this.allowUnlocked?.(c)) return;
      for (const fn of this.anyHandlers) fn(c, e);
      const list = this.handlers.get(c);
      if (list) for (const fn of list) fn(e);
    });
    window.addEventListener('keyup', (e) => this.keys.delete(e.code));
    window.addEventListener('blur', () => this.keys.clear());
  }

  lock() { this.dom.requestPointerLock?.(); }

  down(...codes) {
    for (const c of codes) if (this.keys.has(c)) return true;
    return false;
  }

  /** Movement axes from WASD / arrows: forward (+1 = W) and side (+1 = D). */
  axes() {
    if (!this.locked && !this.force) return { fwd: 0, side: 0 };
    let fwd = 0, side = 0;
    if (this.down('KeyW', 'ArrowUp')) fwd += 1;
    if (this.down('KeyS', 'ArrowDown')) fwd -= 1;
    if (this.down('KeyD', 'ArrowRight')) side += 1;
    if (this.down('KeyA', 'ArrowLeft')) side -= 1;
    return { fwd, side };
  }

  get shift() { return this.down('ShiftLeft', 'ShiftRight'); }

  /** Mouse movement since the last call, in radians of look. */
  takeLook() {
    const dx = this.mouseDX * this.sensitivity;
    const dy = this.mouseDY * this.sensitivity;
    this.mouseDX = 0;
    this.mouseDY = 0;
    return { dx, dy };
  }

  on(code, fn) {
    if (!this.handlers.has(code)) this.handlers.set(code, []);
    this.handlers.get(code).push(fn);
  }

  onAny(fn) { this.anyHandlers.push(fn); }
}
