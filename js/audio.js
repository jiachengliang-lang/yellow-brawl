/* Web Audio setup + synthesized sound effects. No audio files needed.
 * Graph: [sfx voices] → sfxBus ─┐
 *        [music voices] → musicBus ─┴→ master → speakers
 */

import { settings, onSettingChange } from './settings.js';

let ctx = null;
let master = null;
let sfxBus = null;
let musicBus = null;
let noiseBuf = null;

export function audioCtx() {
  if (ctx) {
    if (ctx.state === 'suspended') ctx.resume();
    return ctx;
  }
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return null;
  ctx = new AC();
  master = ctx.createGain();
  master.gain.value = 0.7;
  master.connect(ctx.destination);
  sfxBus = ctx.createGain();
  musicBus = ctx.createGain();
  sfxBus.connect(master);
  musicBus.connect(master);
  applyVolumes();
  noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 0.5, ctx.sampleRate);
  const d = noiseBuf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  return ctx;
}

export function buses() { return { ctx, sfxBus, musicBus, noiseBuf }; }

function applyVolumes() {
  if (!ctx) return;
  sfxBus.gain.value = settings.sfx;
  musicBus.gain.value = settings.music * 0.55;
}
onSettingChange(applyVolumes);

// Browsers only allow audio after a user gesture.
['keydown', 'pointerdown'].forEach(ev => window.addEventListener(ev, audioCtx, { passive: true }));

/* One enveloped oscillator note. */
export function tone({ type = 'sine', from = 440, to = from, dur = 0.12, vol = 0.3, delay = 0, at = null, bus = 'sfx', attack = 0.004 }) {
  const c = audioCtx(); if (!c) return;
  const t0 = at ?? c.currentTime + delay;
  const o = c.createOscillator();
  const g = c.createGain();
  o.type = type;
  o.frequency.setValueAtTime(from, t0);
  if (to !== from) o.frequency.exponentialRampToValueAtTime(Math.max(20, to), t0 + dur);
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.linearRampToValueAtTime(vol, t0 + attack);
  g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
  o.connect(g).connect(bus === 'music' ? musicBus : sfxBus);
  o.start(t0);
  o.stop(t0 + dur + 0.03);
}

/* One filtered noise burst. */
export function noise({ dur = 0.1, vol = 0.3, freq = 1200, q = 1, type = 'bandpass', delay = 0, at = null, bus = 'sfx' }) {
  const c = audioCtx(); if (!c) return;
  const t0 = at ?? c.currentTime + delay;
  const src = c.createBufferSource();
  src.buffer = noiseBuf;
  const f = c.createBiquadFilter();
  f.type = type; f.frequency.value = freq; f.Q.value = q;
  const g = c.createGain();
  g.gain.setValueAtTime(vol, t0);
  g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
  src.connect(f).connect(g).connect(bus === 'music' ? musicBus : sfxBus);
  src.start(t0);
  src.stop(t0 + dur + 0.03);
}

const SFX = {
  whiff: () => noise({ dur: 0.09, vol: 0.12, freq: 2400, q: 0.7, type: 'highpass' }),
  dash: () => noise({ dur: 0.14, vol: 0.16, freq: 1600, q: 0.6, type: 'bandpass' }),
  light: () => { noise({ dur: 0.07, vol: 0.35, freq: 1800 }); tone({ type: 'square', from: 220, to: 90, dur: 0.06, vol: 0.12 }); },
  heavy: () => { noise({ dur: 0.16, vol: 0.5, freq: 700 }); tone({ type: 'sine', from: 160, to: 45, dur: 0.22, vol: 0.5 }); },
  block: () => { tone({ type: 'triangle', from: 900, to: 600, dur: 0.06, vol: 0.18 }); noise({ dur: 0.05, vol: 0.18, freq: 3500 }); },
  land: () => tone({ type: 'sine', from: 120, to: 50, dur: 0.12, vol: 0.25 }),
  throw: () => tone({ type: 'triangle', from: 300, to: 700, dur: 0.12, vol: 0.15 }),
  bounce: () => tone({ type: 'sine', from: 260, to: 120, dur: 0.08, vol: 0.2 }),
  cluck: () => { tone({ type: 'square', from: 900, to: 600, dur: 0.05, vol: 0.08 }); tone({ type: 'square', from: 1100, to: 700, dur: 0.06, vol: 0.08, delay: 0.07 }); },
  wave: () => { tone({ type: 'sawtooth', from: 520, to: 780, dur: 0.25, vol: 0.1 }); tone({ type: 'sine', from: 260, to: 390, dur: 0.25, vol: 0.12 }); },
  super: () => {
    tone({ type: 'sawtooth', from: 110, to: 880, dur: 0.6, vol: 0.18 });
    tone({ type: 'square', from: 220, to: 1760, dur: 0.6, vol: 0.08, delay: 0.05 });
    noise({ dur: 0.5, vol: 0.12, freq: 900, q: 0.5 });
  },
  ko: () => {
    tone({ type: 'sine', from: 200, to: 30, dur: 0.9, vol: 0.6 });
    noise({ dur: 0.6, vol: 0.4, freq: 400, q: 0.4, type: 'lowpass' });
  },
  round: () => { tone({ type: 'square', from: 523, dur: 0.1, vol: 0.12 }); tone({ type: 'square', from: 659, dur: 0.14, vol: 0.12, delay: 0.1 }); },
  fight: () => { tone({ type: 'sawtooth', from: 392, to: 784, dur: 0.25, vol: 0.18 }); noise({ dur: 0.3, vol: 0.15, freq: 1500 }); },
  move: () => tone({ type: 'square', from: 660, dur: 0.04, vol: 0.06 }),
  select: () => { tone({ type: 'square', from: 523, dur: 0.06, vol: 0.1 }); tone({ type: 'square', from: 1046, dur: 0.1, vol: 0.1, delay: 0.06 }); },
  back: () => tone({ type: 'square', from: 400, to: 260, dur: 0.08, vol: 0.08 }),
  win: () => [523, 659, 784, 1046].forEach((f, i) => tone({ type: 'square', from: f, dur: 0.16, vol: 0.1, delay: i * 0.12 }))
};

let sfxHook = null;

/* Online host: every sound played during a match is also forwarded to the guest. */
export function setSfxHook(fn) { sfxHook = fn; }

export function sfx(name) {
  sfxHook?.(name);
  try { SFX[name]?.(); } catch (_) { /* audio is best-effort */ }
}
