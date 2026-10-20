/* Interface feel: screen-transition wipe, mouse parallax, 3D card tilt with shine,
 * click ripples, hover ticks, stat count-up and confetti. Purely cosmetic.
 */

import { sfx } from './audio.js';

const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
const fine = matchMedia('(hover: hover) and (pointer: fine)').matches;
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

/* ------------------------------------------------------------ screen wipe */
let wipeEl = null;

export function wipe() {
  if (reduced) return;
  if (!wipeEl) {
    wipeEl = document.createElement('div');
    wipeEl.className = 'wipe';
    wipeEl.innerHTML = '<i></i><i></i><i></i><i></i><i></i><i></i>';
    document.getElementById('stage').appendChild(wipeEl);
  }
  wipeEl.classList.remove('run');
  void wipeEl.offsetWidth;          // restart the animation
  wipeEl.classList.add('run');
  clearTimeout(wipeEl._t);
  wipeEl._t = setTimeout(() => wipeEl.classList.remove('run'), 800);
}

/* ------------------------------------------------------------ delegated pointer effects */
function initPointer() {
  const ui = document.getElementById('ui');

  // parallax: layers with data-depth drift opposite the cursor
  ui.addEventListener('pointermove', (e) => {
    if (!fine || reduced) return;
    const layers = ui.querySelectorAll('[data-depth]');
    if (!layers.length) return;
    const r = ui.getBoundingClientRect();
    const nx = clamp((e.clientX - r.left) / r.width * 2 - 1, -1, 1);
    const ny = clamp((e.clientY - r.top) / r.height * 2 - 1, -1, 1);
    layers.forEach((el) => {
      const d = Number(el.dataset.depth) || 0;
      el.style.setProperty('--px', `${(-nx * d).toFixed(1)}px`);
      el.style.setProperty('--py', `${(-ny * d * 0.6).toFixed(1)}px`);
    });
  }, { passive: true });

  // 3D tilt + moving highlight on character / stage cards
  ui.addEventListener('pointermove', (e) => {
    if (!fine || reduced) return;
    const card = e.target.closest?.('.char-card, .stage-card, .player-box');
    ui.querySelectorAll('.tilting').forEach((c) => { if (c !== card) resetTilt(c); });
    if (!card) return;
    const r = card.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width, y = (e.clientY - r.top) / r.height;
    card.classList.add('tilting');
    card.style.setProperty('--ry', `${((x - 0.5) * 14).toFixed(2)}deg`);
    card.style.setProperty('--rx', `${((0.5 - y) * 10).toFixed(2)}deg`);
    card.style.setProperty('--mx', `${(x * 100).toFixed(1)}%`);
    card.style.setProperty('--my', `${(y * 100).toFixed(1)}%`);
  }, { passive: true });
  ui.addEventListener('pointerleave', () => ui.querySelectorAll('.tilting').forEach(resetTilt));

  // ripple on press
  ui.addEventListener('pointerdown', (e) => {
    const el = e.target.closest?.('.menu-item, .btn, .stage-card, .char-card, .mini-char, .mini-stage');
    if (!el || reduced) return;
    const r = el.getBoundingClientRect();
    const scale = r.width / el.offsetWidth || 1;
    const dot = document.createElement('span');
    dot.className = 'ripple';
    const size = Math.max(el.offsetWidth, el.offsetHeight) * 1.4;
    dot.style.width = dot.style.height = `${size}px`;
    dot.style.left = `${(e.clientX - r.left) / scale - size / 2}px`;
    dot.style.top = `${(e.clientY - r.top) / scale - size / 2}px`;
    el.appendChild(dot);
    setTimeout(() => dot.remove(), 650);
  });

  // a soft tick when the mouse moves onto a new menu item
  let last = null;
  ui.addEventListener('pointerover', (e) => {
    const el = e.target.closest?.('.menu-item, .stage-card, .mini-char');
    if (el && el !== last) { last = el; sfx('move'); }
    if (!el) last = null;
  });
}

function resetTilt(c) {
  c.classList.remove('tilting');
  for (const k of ['--rx', '--ry']) c.style.setProperty(k, '0deg');
}

/* ------------------------------------------------------------ results: count-up + confetti */
function countUp(root) {
  root.querySelectorAll('[data-count]').forEach((el) => {
    const target = Number(el.dataset.count) || 0;
    if (reduced || !target) { el.textContent = target; return; }
    const t0 = performance.now(), dur = 700 + Math.min(600, target);
    const tick = (now) => {
      const k = clamp((now - t0) / dur, 0, 1);
      el.textContent = Math.round(target * (1 - Math.pow(1 - k, 3)));
      if (k < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
}

export function confetti() {
  if (reduced) return;
  const stage = document.getElementById('stage');
  const c = document.createElement('canvas');
  c.className = 'confetti';
  c.width = 1280; c.height = 720;
  stage.appendChild(c);
  const g = c.getContext('2d');
  const colors = ['#ffd23f', '#ff8a3d', '#5ef0ff', '#ff5a7a', '#fff4dc', '#7dff9a'];
  const bits = Array.from({ length: 160 }, (_, i) => ({
    x: 640 + (Math.random() - 0.5) * 300, y: 300,
    vx: (Math.random() - 0.5) * 22, vy: -Math.random() * 18 - 6,
    r: Math.random() * Math.PI, vr: (Math.random() - 0.5) * 0.4,
    w: 6 + Math.random() * 8, h: 4 + Math.random() * 6, c: colors[i % colors.length]
  }));
  let frame = 0;
  const tick = () => {
    g.clearRect(0, 0, 1280, 720);
    for (const b of bits) {
      b.vy += 0.45; b.vx *= 0.985; b.x += b.vx; b.y += b.vy; b.r += b.vr;
      g.save(); g.translate(b.x, b.y); g.rotate(b.r);
      g.fillStyle = b.c; g.fillRect(-b.w / 2, -b.h / 2, b.w, b.h * Math.abs(Math.cos(b.r * 2)));
      g.restore();
    }
    if (++frame < 150) requestAnimationFrame(tick); else c.remove();
  };
  requestAnimationFrame(tick);
}

function initObserver() {
  const ui = document.getElementById('ui');
  new MutationObserver(() => {
    const table = ui.querySelector('.stats-table:not(.counted)');
    if (table) { table.classList.add('counted'); countUp(table); }
    const win = ui.querySelector('.result-big.win:not(.celebrated)');
    if (win) { win.classList.add('celebrated'); confetti(); }
  }).observe(ui, { childList: true, subtree: true });
}

initPointer();
initObserver();
