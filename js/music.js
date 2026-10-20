/* Procedural background music: a tiny step sequencer driving Web Audio synths.
 * Each theme = tempo + chord roots + bass/drum patterns + a lead melody.
 * Melodies are written as semitone offsets from the theme's root ('.' = rest).
 */

import { audioCtx, tone, noise } from './audio.js';

const mel = (s) => s.trim().split(/\s+/).map(x => (x === '.' ? null : Number(x)));
const pat = (s) => s.replace(/\s/g, '').split('').map(ch => ch === 'x');

const THEMES = {
  menu: {
    bpm: 92, root: 53, swing: 0.08,                 // F3
    chords: [[0, 4, 7, 11], [-1, 2, 7, 11], [-3, 0, 4, 7], [-5, -1, 2, 7]],
    bass: mel('0 . . . . . 7 . 0 . . . 12 . . .'),
    kick: pat('x... .... x... ....'), snare: pat('.... x... .... x...'), hat: pat('..x. ..x. ..x. ..x.'),
    lead: mel(`
      12 . 16 . 19 . 16 . 14 . . . 12 . . .
      11 . 14 . 19 . 14 . 12 . . . . . . .
      9 . 12 . 16 . 12 . 11 . 9 . 7 . . .
      7 . 9 . 11 . 14 . 12 . . . . . . .`),
    leadType: 'triangle', leadVol: 0.07, padVol: 0.03
  },
  market: {
    bpm: 112, root: 48, swing: 0.12,                // C3, minor funk
    chords: [[0, 3, 7, 10], [-4, 0, 3, 7], [-2, 2, 5, 9], [-5, -1, 2, 5]],
    bass: mel('0 . 12 . . 0 . 10 0 . 12 . 7 . 10 .'),
    kick: pat('x..x ..x. x... ..x.'), snare: pat('.... x... .... x..x'), hat: pat('x.xx x.x. x.xx x.x.'),
    lead: mel(`
      15 . 17 . 19 . . 22 . . 19 . 17 . 15 .
      12 . . . 15 . 17 . 15 . 12 . 10 . . .
      15 . 17 . 19 . . 22 . . 24 . 22 . 19 .
      17 . 19 . 17 . 15 . 12 . . . . . . .`),
    leadType: 'square', leadVol: 0.05, padVol: 0.025
  },
  rooftop: {
    bpm: 132, root: 45, swing: 0,                   // A2, synthwave
    chords: [[0, 3, 7, 12], [-4, 0, 3, 8], [3, 7, 10, 15], [-2, 2, 5, 10]],
    bass: mel('0 12 0 12 0 12 0 12 0 12 0 12 0 12 0 12'),
    kick: pat('x... x... x... x...'), snare: pat('.... x... .... x...'), hat: pat('..x. ..x. ..x. ..xx'),
    lead: mel(`
      24 . 27 . 31 . 27 . 24 . 22 . 19 . . .
      20 . 24 . 27 . 24 . 20 . . . 19 . . .
      27 . 31 . 34 . 31 . 27 . 26 . 24 . 22 .
      22 . 26 . 29 . 26 . 24 . . . . . . .`),
    leadType: 'sawtooth', leadVol: 0.035, padVol: 0.03, arp: true
  },
  temple: {
    bpm: 100, root: 50, swing: 0.05,                // D3, pentatonic
    chords: [[0, 3, 7, 10], [-4, 0, 3, 7], [-2, 2, 5, 9], [-5, -2, 2, 5]],
    bass: mel('0 . . . 7 . . . 0 . . . 5 . 7 .'),
    kick: pat('x... .... x.x. ....'), snare: pat('.... .... .... x...'), hat: pat('....x.......x...'),
    wood: pat('..x. ..x. ..x. x.x.'),
    lead: mel(`
      12 . . 15 17 . 19 . 17 . 15 . 12 . . .
      10 . 12 . 15 . 12 . 10 . 7 . . . . .
      12 . 15 . 17 . 22 . 19 . 17 . 15 . . .
      17 . 15 . 12 . 10 . 12 . . . . . . .`),
    leadType: 'triangle', leadVol: 0.09, padVol: 0.025, vibrato: true, gong: true
  }
};

const freq = (midi) => 440 * Math.pow(2, (midi - 69) / 12);

let theme = null;
let timer = null;
let step = 0;
let nextTime = 0;

export function playMusic(name) {
  if (theme === THEMES[name] && timer) return;
  stopMusic();
  const c = audioCtx();
  theme = THEMES[name];
  if (!c || !theme) return;
  step = 0;
  nextTime = c.currentTime + 0.08;
  timer = setInterval(schedule, 25);
}

export function stopMusic() {
  if (timer) clearInterval(timer);
  timer = null;
  theme = null;
}

function schedule() {
  const c = audioCtx();
  if (!c || !theme) return;
  const stepDur = 60 / theme.bpm / 4;
  // if the tab slept, skip ahead instead of firing a burst of notes
  if (nextTime < c.currentTime - 0.2) nextTime = c.currentTime + 0.05;
  while (nextTime < c.currentTime + 0.12) {
    const swing = (step % 2) ? theme.swing * stepDur : 0;
    playStep(step, nextTime + swing, stepDur);
    nextTime += stepDur;
    step++;
  }
}

function playStep(n, t, stepDur) {
  const T = theme;
  const s = n % 16;
  const bar = Math.floor(n / 16) % T.chords.length;
  const chord = T.chords[bar];
  const root = T.root + chord[0];

  // drums
  if (T.kick[s]) tone({ at: t, type: 'sine', from: 150, to: 42, dur: 0.2, vol: 0.55, bus: 'music' });
  if (T.snare[s]) { noise({ at: t, dur: 0.13, vol: 0.22, freq: 1900, q: 0.8, bus: 'music' }); tone({ at: t, type: 'triangle', from: 220, to: 160, dur: 0.07, vol: 0.12, bus: 'music' }); }
  if (T.hat[s]) noise({ at: t, dur: 0.035, vol: 0.06, freq: 8000, type: 'highpass', bus: 'music' });
  if (T.wood?.[s]) tone({ at: t, type: 'sine', from: 1300, to: 900, dur: 0.05, vol: 0.12, bus: 'music' });
  if (T.gong && n % 64 === 0) {
    noise({ at: t, dur: 1.8, vol: 0.12, freq: 300, q: 0.4, type: 'lowpass', bus: 'music' });
    tone({ at: t, type: 'sine', from: 98, to: 92, dur: 2.2, vol: 0.18, bus: 'music', attack: 0.01 });
  }

  // bass
  const b = T.bass[s];
  if (b != null) tone({ at: t, type: 'sawtooth', from: freq(root - 12 + b), dur: stepDur * 1.7, vol: 0.09, bus: 'music' });

  // pad: one sustained chord per bar
  if (s === 0) {
    for (const iv of chord.slice(1)) {
      tone({ at: t, type: 'triangle', from: freq(T.root + 12 + iv), dur: stepDur * 16, vol: T.padVol, bus: 'music', attack: 0.25 });
    }
  }
  // arpeggio
  if (T.arp && s % 2 === 0) {
    const iv = chord[(s / 2) % chord.length];
    tone({ at: t, type: 'square', from: freq(T.root + 24 + iv), dur: stepDur * 0.9, vol: 0.025, bus: 'music' });
  }

  // lead (4-bar melody, plays every other loop so the track breathes)
  const leadStep = n % T.lead.length;
  const loop = Math.floor(n / T.lead.length);
  const note = T.lead[leadStep];
  if (note != null && loop % 2 === 1) {
    tone({ at: t, type: T.leadType, from: freq(T.root + note), dur: stepDur * 1.9, vol: T.leadVol, bus: 'music', attack: 0.01 });
    if (T.vibrato) tone({ at: t + 0.02, type: 'sine', from: freq(T.root + note) * 1.005, dur: stepDur * 1.9, vol: T.leadVol * 0.5, bus: 'music', attack: 0.04 });
  }
}
