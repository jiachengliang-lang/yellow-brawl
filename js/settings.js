/* Player settings, persisted in localStorage when available. */

const DEFAULTS = {
  music: 0.6,          // 0..1
  sfx: 0.8,            // 0..1
  roundTime: 60,       // seconds, 0 = no timer
  winsNeeded: 2,       // rounds to win a match
  vsCpu: 'off'         // versus P2: 'off' (human) | 'easy' | 'normal' | 'hard'
};

const KEY = 'brawl-settings';
const listeners = new Set();

export const settings = { ...DEFAULTS };
try {
  Object.assign(settings, JSON.parse(localStorage.getItem(KEY) || '{}'));
} catch (_) { /* storage blocked or bad JSON */ }

export function setSetting(key, value) {
  settings[key] = value;
  try { localStorage.setItem(KEY, JSON.stringify(settings)); } catch (_) {}
  for (const fn of listeners) fn(key, value);
}

export function onSettingChange(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
