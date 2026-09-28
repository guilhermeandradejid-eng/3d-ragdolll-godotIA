// Entrada unificada: dois jogadores no teclado (lados esquerdo e direito) e até quatro
// controles (Gamepad API, mapeamento "standard"). Cada dispositivo vira um "controle virtual".

const KEYMAP = {
  kb1: {
    up: ['KeyW'], down: ['KeyS'], left: ['KeyA'], right: ['KeyD'],
    jump: ['Space'], spin: ['KeyF', 'KeyE'], pound: ['ShiftLeft', 'KeyC'],
    camL: ['KeyQ'], camR: ['KeyR'],
    pause: ['Escape', 'Tab'], confirm: ['Space', 'KeyF'], back: ['Escape', 'ShiftLeft'],
  },
  kb2: {
    up: ['ArrowUp'], down: ['ArrowDown'], left: ['ArrowLeft'], right: ['ArrowRight'],
    jump: ['Enter', 'NumpadEnter', 'Numpad0'], spin: ['ShiftRight', 'Numpad1', 'Period'],
    pound: ['ControlRight', 'Numpad2', 'Slash', 'IntlRo'],
    camL: ['Delete', 'Numpad4'], camR: ['PageDown', 'Numpad6'],
    pause: ['KeyP', 'Backspace'], confirm: ['Enter', 'NumpadEnter', 'Numpad0'], back: ['Backspace', 'ShiftRight'],
  },
};

const GAME_KEYS = new Set(Object.values(KEYMAP).flatMap((m) => Object.values(m).flat()));

const BTN = { A: 0, B: 1, X: 2, Y: 3, LB: 4, RB: 5, LT: 6, RT: 7, BACK: 8, START: 9, LS: 10, RS: 11, UP: 12, DOWN: 13, LEFT: 14, RIGHT: 15 };

const DEADZONE = 0.2;

function radial(x, y) {
  const m = Math.hypot(x, y);
  if (m < DEADZONE) return [0, 0];
  const k = Math.min(1, (m - DEADZONE) / (1 - DEADZONE)) / m;
  return [x * k, y * k];
}

function makeState(id, type, index = -1) {
  return {
    id, type, index,
    connected: true,
    move: { x: 0, y: 0 },
    cam: { x: 0, y: 0 },
    jump: false, spin: false, pound: false,
    pressed: {}, released: {},
    lastActive: 0,
    _navT: 0, _navDir: '',
  };
}

export class Input {
  constructor() {
    this.down = new Set();
    this.pressedKeys = new Set();
    this.releasedKeys = new Set();
    this.devices = new Map();
    this.devices.set('kb1', makeState('kb1', 'keyboard'));
    this.devices.set('kb2', makeState('kb2', 'keyboard'));
    this.prevPad = new Map();
    this.time = 0;
    this.lastDeviceType = 'keyboard';
    this.mouseClicked = false;

    window.addEventListener('keydown', (e) => {
      if (GAME_KEYS.has(e.code)) e.preventDefault();
      if (e.repeat) return;
      this.down.add(e.code);
      this.pressedKeys.add(e.code);
      this.lastDeviceType = 'keyboard';
    });
    window.addEventListener('keyup', (e) => {
      this.down.delete(e.code);
      this.releasedKeys.add(e.code);
    });
    window.addEventListener('blur', () => this.down.clear());
    window.addEventListener('gamepadconnected', (e) => {
      this.onPadChange?.('connected', e.gamepad);
    });
    window.addEventListener('gamepaddisconnected', (e) => {
      const d = this.devices.get('pad' + e.gamepad.index);
      if (d) d.connected = false;
      this.onPadChange?.('disconnected', e.gamepad);
    });
  }

  _key(map, action) {
    return map[action].some((c) => this.down.has(c));
  }
  _keyPressed(map, action) {
    return map[action].some((c) => this.pressedKeys.has(c));
  }
  _keyReleased(map, action) {
    return map[action].some((c) => this.releasedKeys.has(c));
  }

  poll(dt) {
    this.time += dt;
    // Teclado
    for (const id of ['kb1', 'kb2']) {
      const s = this.devices.get(id);
      const m = KEYMAP[id];
      let x = (this._key(m, 'right') ? 1 : 0) - (this._key(m, 'left') ? 1 : 0);
      let y = (this._key(m, 'up') ? 1 : 0) - (this._key(m, 'down') ? 1 : 0);
      if (x && y) { x *= Math.SQRT1_2; y *= Math.SQRT1_2; }
      s.move.x = x; s.move.y = y;
      s.cam.x = (this._key(m, 'camR') ? 1 : 0) - (this._key(m, 'camL') ? 1 : 0);
      s.cam.y = 0;
      s.jump = this._key(m, 'jump');
      s.spin = this._key(m, 'spin');
      s.pound = this._key(m, 'pound');
      const p = s.pressed, r = s.released;
      p.jump = this._keyPressed(m, 'jump');
      p.spin = this._keyPressed(m, 'spin');
      p.pound = this._keyPressed(m, 'pound');
      p.pause = this._keyPressed(m, 'pause');
      p.confirm = this._keyPressed(m, 'confirm');
      p.back = this._keyPressed(m, 'back');
      p.up = this._keyPressed(m, 'up');
      p.down = this._keyPressed(m, 'down');
      p.left = this._keyPressed(m, 'left');
      p.right = this._keyPressed(m, 'right');
      p.camL = this._keyPressed(m, 'camL');
      p.camR = this._keyPressed(m, 'camR');
      p.any = Object.values(KEYMAP[id]).flat().some((c) => this.pressedKeys.has(c));
      r.jump = this._keyReleased(m, 'jump');
      if (p.any) s.lastActive = this.time;
    }

    // Controles
    const pads = navigator.getGamepads ? navigator.getGamepads() : [];
    for (const pad of pads) {
      if (!pad || !pad.connected) continue;
      const id = 'pad' + pad.index;
      let s = this.devices.get(id);
      if (!s) {
        s = makeState(id, 'gamepad', pad.index);
        this.devices.set(id, s);
      }
      s.connected = true;
      s.pad = pad;
      const prev = this.prevPad.get(id) || [];
      const btn = (i) => !!(pad.buttons[i] && (pad.buttons[i].pressed || pad.buttons[i].value > 0.5));
      const cur = pad.buttons.map((_, i) => btn(i));
      const pr = (i) => cur[i] && !prev[i];
      const rl = (i) => !cur[i] && prev[i];
      let [lx, ly] = radial(pad.axes[0] || 0, pad.axes[1] || 0);
      const [rx, ry] = radial(pad.axes[2] || 0, pad.axes[3] || 0);
      if (cur[BTN.LEFT]) lx = -1;
      if (cur[BTN.RIGHT]) lx = 1;
      if (cur[BTN.UP]) ly = -1;
      if (cur[BTN.DOWN]) ly = 1;
      s.move.x = lx;
      s.move.y = -ly;
      s.cam.x = rx + (cur[BTN.RB] ? 1 : 0) - (cur[BTN.LB] ? 1 : 0);
      s.cam.y = -ry;
      s.jump = cur[BTN.A];
      s.spin = cur[BTN.X] || cur[BTN.Y];
      s.pound = cur[BTN.B] || cur[BTN.LT] || cur[BTN.RT];
      const p = s.pressed, r = s.released;
      p.jump = pr(BTN.A);
      p.spin = pr(BTN.X) || pr(BTN.Y);
      p.pound = pr(BTN.B) || pr(BTN.LT) || pr(BTN.RT);
      p.pause = pr(BTN.START);
      p.confirm = pr(BTN.A);
      p.back = pr(BTN.B);
      p.camL = pr(BTN.LB);
      p.camR = pr(BTN.RB);
      // navegação de menu: D-pad + analógico com repetição
      const nav = this._navFromStick(s, lx, -ly, dt);
      p.up = pr(BTN.UP) || nav === 'up';
      p.down = pr(BTN.DOWN) || nav === 'down';
      p.left = pr(BTN.LEFT) || nav === 'left';
      p.right = pr(BTN.RIGHT) || nav === 'right';
      r.jump = rl(BTN.A);
      p.any = cur.some((v, i) => v && !prev[i]) || Math.hypot(lx, ly) > 0.6 && !s._wasMoving;
      s._wasMoving = Math.hypot(lx, ly) > 0.6;
      if (p.any) {
        s.lastActive = this.time;
        this.lastDeviceType = 'gamepad';
      }
      this.prevPad.set(id, cur);
    }

    this.pressedKeys.clear();
    this.releasedKeys.clear();
  }

  _navFromStick(s, x, y, dt) {
    let dir = '';
    if (Math.abs(x) > 0.55 || Math.abs(y) > 0.55) {
      if (Math.abs(x) > Math.abs(y)) dir = x > 0 ? 'right' : 'left';
      else dir = y > 0 ? 'up' : 'down';
    }
    if (!dir) {
      s._navDir = '';
      s._navT = 0;
      return '';
    }
    if (dir !== s._navDir) {
      s._navDir = dir;
      s._navT = 0.38;
      return dir;
    }
    s._navT -= dt;
    if (s._navT <= 0) {
      s._navT = 0.13;
      return dir;
    }
    return '';
  }

  device(id) {
    return this.devices.get(id);
  }

  // Todos os dispositivos (para menus: qualquer um navega)
  get all() {
    return [...this.devices.values()].filter((d) => d.connected);
  }

  anyPressed(action) {
    for (const d of this.devices.values()) if (d.connected && d.pressed[action]) return d;
    return null;
  }

  rumble(id, strong = 0.5, weak = 0.5, duration = 120) {
    const d = this.devices.get(id);
    const act = d?.pad?.vibrationActuator;
    if (!act || !act.playEffect) return;
    try {
      act.playEffect('dual-rumble', { duration, strongMagnitude: strong, weakMagnitude: weak });
    } catch {
      /* sem suporte a vibração */
    }
  }

  static label(id) {
    if (id === 'kb1') return 'Teclado (WASD)';
    if (id === 'kb2') return 'Teclado (Setas)';
    return 'Controle ' + (Number(id.replace('pad', '')) + 1);
  }
}

export const CONTROL_HINTS = {
  kb1: { move: 'WASD', jump: 'Espaço', spin: 'F', pound: 'Shift', cam: 'Q/R', pause: 'Esc' },
  kb2: { move: 'Setas', jump: 'Enter', spin: 'Shift dir.', pound: 'Ctrl dir. ou /', cam: 'Del/PgDn', pause: 'P' },
  pad: { move: 'Analógico', jump: 'A', spin: 'X', pound: 'B / Gatilho', cam: 'Analógico dir.', pause: 'Start' },
};
