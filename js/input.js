/* Keyboard + gamepad input, reduced to plain button states per player. */

export const BUTTONS = ['left', 'right', 'up', 'down', 'light', 'heavy', 'kick', 'special', 'super', 'guard'];

export const KEYMAP = {
  p1: {
    KeyA: 'left', KeyD: 'right', KeyW: 'up', KeyS: 'down', Space: 'up',
    KeyJ: 'light', KeyK: 'heavy', KeyL: 'kick', KeyU: 'special', KeyI: 'super', ShiftLeft: 'guard'
  },
  p2: {
    ArrowLeft: 'left', ArrowRight: 'right', ArrowUp: 'up', ArrowDown: 'down',
    Digit1: 'light', Digit2: 'heavy', Digit3: 'kick', Digit4: 'special', Digit5: 'super', ShiftRight: 'guard',
    Numpad1: 'light', Numpad2: 'heavy', Numpad3: 'kick', Numpad4: 'special', Numpad5: 'super', Numpad0: 'guard'
  }
};

/* Standard-mapping gamepad: A light, B heavy, X kick, Y special, RB/RT super, LB guard. */
const PAD = { light: 0, heavy: 1, kick: 2, special: 3, guard: 4, super: [5, 7] };

export const blank = () => Object.fromEntries(BUTTONS.map(b => [b, false]));

const held = new Set();
const listeners = new Set();

window.addEventListener('keydown', (e) => {
  if (e.repeat) return;
  held.add(e.code);
  for (const fn of listeners) fn(e);
  if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) e.preventDefault();
});
window.addEventListener('keyup', (e) => held.delete(e.code));
window.addEventListener('blur', () => held.clear());

/* Raw keydown hook for menus. Returns an unsubscribe function. */
export function onKey(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

function readPad(index) {
  const pads = navigator.getGamepads ? navigator.getGamepads() : [];
  const pad = [...pads].filter(Boolean)[index];
  if (!pad) return null;
  const btn = (i) => !!pad.buttons[i] && (pad.buttons[i].pressed || pad.buttons[i].value > 0.4);
  const ax = pad.axes[0] || 0, ay = pad.axes[1] || 0;
  const s = blank();
  s.left = ax < -0.45 || btn(14);
  s.right = ax > 0.45 || btn(15);
  s.up = ay < -0.6 || btn(12);
  s.down = ay > 0.6 || btn(13);
  for (const [name, idx] of Object.entries(PAD)) {
    s[name] = Array.isArray(idx) ? idx.some(btn) : btn(idx);
  }
  return s;
}

/* Current button state for 'p1' or 'p2' (keyboard OR gamepad). */
export function readPlayer(side) {
  const s = blank();
  for (const [code, name] of Object.entries(KEYMAP[side])) {
    if (held.has(code)) s[name] = true;
  }
  const pad = readPad(side === 'p1' ? 0 : 1);
  if (pad) for (const b of BUTTONS) s[b] = s[b] || pad[b];
  return s;
}

export function isHeld(code) {
  return held.has(code);
}
