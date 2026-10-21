/* Web Audio setup and sound effects: synthesized, plus optional recorded clips.
 * Graph: [sfx voices] → sfxBus ──────────────┐
 *        [music voices] → musicBus → duck ───┴→ master → speakers
 */

import { settings, onSettingChange } from './settings.js';

let ctx = null;
let master = null;
let sfxBus = null;
let musicBus = null;
let duckGain = null;
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
  master.gain.value = 0.75;
  // gentle limiter so stacked hits don't clip
  const comp = ctx.createDynamicsCompressor();
  comp.threshold.value = -10; comp.ratio.value = 6; comp.attack.value = 0.003; comp.release.value = 0.2;
  master.connect(comp).connect(ctx.destination);
  sfxBus = ctx.createGain();
  musicBus = ctx.createGain();
  duckGain = ctx.createGain();
  sfxBus.connect(master);
  musicBus.connect(duckGain).connect(master);
  applyVolumes();
  noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 1, ctx.sampleRate);
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

/* Temporarily lower the music (e.g. under a fanfare). */
function duck(seconds, level = 0.25) {
  const c = audioCtx(); if (!c) return;
  const now = c.currentTime;
  duckGain.gain.cancelScheduledValues(now);
  duckGain.gain.setTargetAtTime(level, now, 0.05);
  duckGain.gain.setTargetAtTime(1, now + seconds, 0.4);
}

/* ------------------------------------------------------------------ building blocks */
/* One enveloped oscillator note, optionally through a sweeping filter. */
export function tone({ type = 'sine', from = 440, to = from, dur = 0.12, vol = 0.3, delay = 0, at = null, bus = 'sfx', attack = 0.004, detune = 0, filter = null, vibrato = 0 }) {
  const c = audioCtx(); if (!c) return;
  const t0 = at ?? c.currentTime + delay;
  const o = c.createOscillator();
  const g = c.createGain();
  o.type = type;
  o.detune.value = detune;
  o.frequency.setValueAtTime(from, t0);
  if (to !== from) o.frequency.exponentialRampToValueAtTime(Math.max(20, to), t0 + dur);
  if (vibrato) {
    const lfo = c.createOscillator(), lg = c.createGain();
    lfo.frequency.value = 6; lg.gain.value = vibrato;
    lfo.connect(lg).connect(o.frequency); lfo.start(t0); lfo.stop(t0 + dur + 0.05);
  }
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.linearRampToValueAtTime(vol, t0 + attack);
  g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
  let node = o;
  if (filter) {
    const f = c.createBiquadFilter();
    f.type = filter.type || 'lowpass'; f.Q.value = filter.q ?? 1;
    f.frequency.setValueAtTime(filter.from, t0);
    if (filter.to) f.frequency.exponentialRampToValueAtTime(filter.to, t0 + dur);
    node = o.connect(f);
  }
  node.connect(g).connect(bus === 'music' ? musicBus : sfxBus);
  o.start(t0);
  o.stop(t0 + dur + 0.05);
}

/* One filtered noise burst; `to` sweeps the filter. */
export function noise({ dur = 0.1, vol = 0.3, freq = 1200, to = null, q = 1, type = 'bandpass', delay = 0, at = null, bus = 'sfx', attack = 0.002 }) {
  const c = audioCtx(); if (!c) return;
  const t0 = at ?? c.currentTime + delay;
  const src = c.createBufferSource();
  src.buffer = noiseBuf; src.loop = true;
  src.playbackRate.value = 0.9 + Math.random() * 0.2;
  const f = c.createBiquadFilter();
  f.type = type; f.Q.value = q;
  f.frequency.setValueAtTime(freq, t0);
  if (to) f.frequency.exponentialRampToValueAtTime(to, t0 + dur);
  const g = c.createGain();
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.linearRampToValueAtTime(vol, t0 + attack);
  g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
  src.connect(f).connect(g).connect(bus === 'music' ? musicBus : sfxBus);
  src.start(t0, Math.random() * 0.5);
  src.stop(t0 + dur + 0.05);
}

/* Crowd: two bands of noise with a fast wobble so it reads as many voices. */
function crowd(vol = 0.25, dur = 1.8, delay = 0, bright = true) {
  const c = audioCtx(); if (!c) return;
  const t0 = c.currentTime + delay;
  for (const [freq, q, v] of [[bright ? 1100 : 600, 0.7, vol], [bright ? 2600 : 1300, 0.9, vol * 0.5]]) {
    const src = c.createBufferSource(); src.buffer = noiseBuf; src.loop = true;
    const f = c.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = freq; f.Q.value = q;
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.linearRampToValueAtTime(v, t0 + 0.25);
    g.gain.setValueAtTime(v, t0 + dur * 0.55);
    g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    const lfo = c.createOscillator(), lg = c.createGain();
    lfo.frequency.value = 7 + Math.random() * 3; lg.gain.value = v * 0.35;
    lfo.connect(lg).connect(g.gain);
    src.connect(f).connect(g).connect(sfxBus);
    src.start(t0, Math.random()); src.stop(t0 + dur + 0.05);
    lfo.start(t0); lfo.stop(t0 + dur + 0.05);
  }
}

const note = (n) => 440 * Math.pow(2, (n - 69) / 12);

/* Brass-ish stab: detuned saws through an opening low-pass filter. */
function brass(midi, at, dur, vol = 0.09) {
  for (const d of [-8, 7]) {
    tone({ at, type: 'sawtooth', from: note(midi), dur, vol, detune: d, attack: 0.02, filter: { type: 'lowpass', from: 700, to: 3200, q: 2 } });
  }
}

function cymbal(at, dur = 1.4, vol = 0.22) {
  noise({ at, dur, vol, freq: 7000, type: 'highpass', q: 0.5 });
  noise({ at, dur: dur * 0.6, vol: vol * 0.6, freq: 3800, type: 'bandpass', q: 0.6 });
}

/* ------------------------------------------------------------------ recorded clips (optional, local only) */
const CLIP_FILES = {
  open: 'battle-open', ko: 'battle-ko', naiwaLaugh: 'naiwa-laugh', kangarooSuper: 'kangaroo-super',
  chickWin: 'chick-win', ball: 'chick-ball-hit', hen: 'chick-hen-launch', combo: 'chick-combo-music',
  chickHit1: 'chick-hit-1', chickHit2: 'chick-hit-2', chickHit3: 'chick-hit-3', chickHit4: 'chick-hit-4'
};
const clips = {};

/* Decode any clips found in assets/audio/. Missing files → synthesized sounds are used instead. */
export async function loadClips() {
  if (new URLSearchParams(location.search).has('noart')) return;
  const c = audioCtx(); if (!c) return;
  try {
    const probe = await fetch(`assets/audio/${CLIP_FILES.ko}.mp3`, { method: 'HEAD' });
    if (!probe.ok) return;
  } catch (_) { return; }
  await Promise.all(Object.entries(CLIP_FILES).map(async ([key, file]) => {
    try {
      const buf = await (await fetch(`assets/audio/${file}.mp3`)).arrayBuffer();
      clips[key] = await c.decodeAudioData(buf);
    } catch (_) { /* skip a broken clip */ }
  }));
}

export function hasClips() { return Object.keys(clips).length > 0; }

const voices = new Set();      // character voice clips currently playing

/* Play a decoded clip; returns false if it isn't available. max = seconds before fading out. */
function playClip(key, { vol = 1, rate = 1, max = null, duckFor = 0, voice = false } = {}) {
  const buf = clips[key];
  const c = audioCtx();
  if (!buf || !c) return false;
  const src = c.createBufferSource();
  src.buffer = buf; src.playbackRate.value = rate;
  const g = c.createGain();
  const t0 = c.currentTime;
  g.gain.setValueAtTime(vol, t0);
  if (max && max < buf.duration) {
    g.gain.setValueAtTime(vol, t0 + Math.max(0, max - 0.4));
    g.gain.linearRampToValueAtTime(0.0001, t0 + max);
    src.stop(t0 + max + 0.05);
  }
  src.connect(g).connect(sfxBus);
  src.start(t0);
  if (voice) {
    for (const v of voices) { try { v.stop(); } catch (_) {} }   // one voice at a time
    voices.clear();
    voices.add(src);
    src.onended = () => voices.delete(src);
  }
  if (duckFor) duck(duckFor, 0.3);
  return true;
}

/* Stop character voices (e.g. a laugh) when leaving a match. */
export function stopVoices() {
  for (const v of voices) { try { v.stop(); } catch (_) {} }
  voices.clear();
}

const WIN_CLIP = { naiwa: 'naiwaLaugh', kangaroo: 'kangarooSuper', chick: 'chickWin' };
const SUPER_CLIP = { naiwa: 'naiwaLaugh', kangaroo: 'kangarooSuper', chick: 'combo' };

/* ------------------------------------------------------------------ sound catalogue */
const r = (a, b) => a + Math.random() * (b - a);
const cluckSynth = () => SFX.cluckSynth();

/* Rate-limit busy sounds (multi-hit moves would otherwise stack them). */
const lastPlayed = {};
function throttled(key, seconds) {
  const now = performance.now() / 1000;
  if (now - (lastPlayed[key] ?? -99) < seconds) return false;
  lastPlayed[key] = now;
  return true;
}

const SFX = {
  whiff: () => noise({ dur: 0.11, vol: 0.13, freq: 3200, to: 1100, q: 0.8, type: 'bandpass' }),
  dash: () => { noise({ dur: 0.18, vol: 0.18, freq: 2200, to: 500, q: 0.7 }); tone({ type: 'sine', from: 90, to: 50, dur: 0.12, vol: 0.2 }); },
  light: () => {
    const p = r(0.9, 1.15);
    noise({ dur: 0.06, vol: 0.4, freq: 2600 * p, q: 0.9 });
    tone({ type: 'sine', from: 190 * p, to: 70, dur: 0.09, vol: 0.38 });
    tone({ type: 'square', from: 1300 * p, to: 700, dur: 0.02, vol: 0.06 });
  },
  heavy: () => {
    const p = r(0.92, 1.08);
    tone({ type: 'sine', from: 130 * p, to: 36, dur: 0.32, vol: 0.8 });
    noise({ dur: 0.24, vol: 0.55, freq: 900, type: 'lowpass', q: 0.7 });
    noise({ dur: 0.07, vol: 0.32, freq: 4200, type: 'highpass' });
    tone({ type: 'triangle', from: 420 * p, to: 140, dur: 0.12, vol: 0.12 });
  },
  block: () => {
    tone({ type: 'triangle', from: 1450, to: 900, dur: 0.08, vol: 0.2 });
    tone({ type: 'square', from: 2200, dur: 0.03, vol: 0.05 });
    noise({ dur: 0.06, vol: 0.2, freq: 5200, q: 1.2 });
  },
  land: () => { tone({ type: 'sine', from: 120, to: 48, dur: 0.14, vol: 0.3 }); noise({ dur: 0.1, vol: 0.12, freq: 500, type: 'lowpass' }); },
  throw: () => { tone({ type: 'triangle', from: 300, to: 760, dur: 0.12, vol: 0.15 }); noise({ dur: 0.12, vol: 0.1, freq: 1800, to: 3600 }); },
  bounce: () => playClip('ball', { vol: 0.75 }) || tone({ type: 'sine', from: 280, to: 120, dur: 0.09, vol: 0.24 }),
  chickHit: (heavy) => throttled('chickHit', heavy ? 0.6 : 0.9) && playClip(heavy ? 'chickHit1' : `chickHit${2 + Math.floor(Math.random() * 3)}`, { vol: 0.8, max: heavy ? 2.2 : null }),
  comboMusic: () => playClip('combo', { vol: 0.8, max: 3.4, duckFor: 3 }),
  superVoice: (charId) => playClip(SUPER_CLIP[charId], { vol: 1, max: charId === 'chick' ? 3.4 : null, duckFor: charId === 'naiwa' ? 6 : 3, voice: true }),
  cluck: () => playClip('hen', { vol: 0.9 }) || cluckSynth(),
  cluckSynth: () => { tone({ type: 'square', from: 900, to: 600, dur: 0.05, vol: 0.08 }); tone({ type: 'square', from: 1150, to: 700, dur: 0.06, vol: 0.08, delay: 0.07 }); },
  wave: () => { tone({ type: 'sawtooth', from: 520, to: 780, dur: 0.28, vol: 0.09, vibrato: 12 }); tone({ type: 'sine', from: 260, to: 390, dur: 0.28, vol: 0.12 }); },
  ooh: () => throttled('ooh', 2.5) && crowd(0.14, 1.1, 0.05, false),
  super: () => {
    duck(1.2, 0.35);
    noise({ dur: 0.8, vol: 0.25, freq: 300, to: 5000, q: 1.2, attack: 0.5 });
    for (const n of [48, 55, 60, 64]) tone({ type: 'sawtooth', from: note(n), dur: 0.9, vol: 0.06, attack: 0.35, filter: { type: 'lowpass', from: 400, to: 4000, q: 4 } });
    tone({ type: 'sine', from: 70, to: 35, dur: 0.9, vol: 0.4, delay: 0.55 });
  },
  ko: () => {
    duck(3, 0.2);
    if (playClip('ko', { vol: 1 })) { tone({ type: 'sine', from: 90, to: 30, dur: 0.8, vol: 0.5 }); crowd(0.24, 2.6, 0.2, true); return; }
    tone({ type: 'sine', from: 110, to: 28, dur: 1.2, vol: 0.9 });
    noise({ dur: 1.0, vol: 0.5, freq: 380, type: 'lowpass', q: 0.4 });
    noise({ dur: 0.15, vol: 0.4, freq: 3000, type: 'highpass' });
    cymbal(audioCtx()?.currentTime + 0.02, 2.2, 0.18);
    crowd(0.28, 2.6, 0.15, true);
  },
  vs: () => { if (playClip('open', { vol: 0.9, duckFor: 3 })) return; noise({ dur: 0.5, vol: 0.25, freq: 400, to: 3500, q: 0.8 }); brass(55, audioCtx()?.currentTime + 0.12, 0.35, 0.07); brass(62, audioCtx()?.currentTime + 0.12, 0.35, 0.07); },
  round: () => {
    tone({ type: 'sine', from: 98, to: 94, dur: 1.6, vol: 0.4, attack: 0.005 });
    tone({ type: 'sine', from: 98 * 2.76, to: 98 * 2.7, dur: 1.0, vol: 0.12 });
    noise({ dur: 0.6, vol: 0.18, freq: 600, to: 2400, q: 0.6, attack: 0.25 });
  },
  fight: () => {
    const c = audioCtx(); if (!c) return;
    const t0 = c.currentTime;
    for (const n of [60, 64, 67, 72]) brass(n, t0, 0.45, 0.06);
    cymbal(t0, 1.2, 0.2);
    tone({ type: 'sine', from: 90, to: 40, dur: 0.3, vol: 0.5 });
  },
  /* the big one: plays when the round winner is announced */
  win: () => {
    const c = audioCtx(); if (!c) return;
    // with recorded voices, keep this soft so the winner's laugh / line is clear
    if (hasClips()) { duck(4, 0.2); cymbal(c.currentTime + 0.05, 1.6, 0.1); crowd(0.12, 2.4, 0.2, true); return; }
    duck(3.2, 0.2);
    const t0 = c.currentTime + 0.05;
    for (let i = 0; i < 10; i++) noise({ at: t0 + i * 0.035, dur: 0.05, vol: 0.06 + i * 0.012, freq: 900, q: 0.8 });   // drum roll
    const seq = [[67, 0.36, 0.12], [72, 0.48, 0.12], [76, 0.60, 0.12], [79, 0.72, 0.28], [76, 1.0, 0.12], [79, 1.12, 1.1]];
    for (const [n, at, d] of seq) brass(n, t0 + at, d, 0.075);
    for (const n of [60, 64, 67]) brass(n, t0 + 1.12, 1.1, 0.045);
    tone({ at: t0 + 1.12, type: 'sine', from: note(48), dur: 1.2, vol: 0.3 });
    cymbal(t0 + 1.12, 1.8, 0.2);
    crowd(0.26, 2.8, 0.3, true);
  },
  /* short victory jingle for result screens */
  jingle: () => [72, 76, 79, 84].forEach((n, i) => { tone({ type: 'square', from: note(n), dur: 0.16, vol: 0.08, delay: i * 0.1 }); tone({ type: 'triangle', from: note(n - 12), dur: 0.2, vol: 0.08, delay: i * 0.1 }); }),
  lose: () => [67, 66, 65, 64].forEach((n, i) => tone({ type: 'triangle', from: note(n), to: note(n) * (i === 3 ? 0.97 : 1), dur: i === 3 ? 0.9 : 0.32, vol: 0.14, delay: i * 0.34, vibrato: i === 3 ? 8 : 3 })),
  move: () => tone({ type: 'square', from: 660, dur: 0.035, vol: 0.05 }),
  select: () => { tone({ type: 'square', from: 523, dur: 0.06, vol: 0.09 }); tone({ type: 'square', from: 1046, dur: 0.1, vol: 0.09, delay: 0.06 }); tone({ type: 'sine', from: 2093, dur: 0.12, vol: 0.05, delay: 0.1 }); },
  back: () => tone({ type: 'square', from: 400, to: 260, dur: 0.08, vol: 0.07 }),

  /* the round winner's recorded voice: 奶蛙 laughs, 肥嘟嘟 and 小鸡子 say their lines */
  quote: (charId) => playClip(WIN_CLIP[charId], { vol: 1, duckFor: 5, voice: true })
};

let sfxHook = null;

/* Online host: every sound played during a match is also forwarded to the guest. */
export function setSfxHook(fn) { sfxHook = fn; }

export function sfx(name, ...args) {
  sfxHook?.(name, args);
  try { SFX[name]?.(...args); } catch (_) { /* audio is best-effort */ }
}
