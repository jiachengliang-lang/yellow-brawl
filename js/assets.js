/* Image loading and sprite drawing. */

import { CHARACTERS, ITEMS } from './data.js';
import { drawPlaceholderFighter, drawPlaceholderProjectile, placeholderImage } from './placeholder.js';

// ?noart previews the built-in placeholder fighters even when sprite files exist
const NO_ART = new URLSearchParams(location.search).has('noart');
let placeholders = false;

/* True when at least one character is drawn with the built-in vector art. */
export function usingPlaceholders() { return placeholders; }

const images = new Map();

function loadImage(src) {
  if (images.has(src)) return images.get(src).promise;
  if (NO_ART && src.startsWith('assets/')) {
    const entry = { img: null, ok: false, promise: Promise.resolve(null) };
    images.set(src, entry);
    return entry.promise;
  }
  const img = new Image();
  const entry = { img, ok: false };
  entry.promise = new Promise((resolve) => {
    img.onload = () => { entry.ok = true; resolve(img); };
    img.onerror = () => { console.warn('[assets] failed', src); resolve(img); };
  });
  img.decoding = 'async';
  img.src = src;
  images.set(src, entry);
  return entry.promise;
}

export function getImage(src) {
  const e = images.get(src);
  return e && e.ok ? e.img : null;
}

/* Small UI images first, then every sprite sheet. onProgress(0..1). */
export async function loadAll(onProgress = () => {}) {
  const srcs = new Set(Object.values(ITEMS));
  for (const c of Object.values(CHARACTERS)) {
    srcs.add(c.portrait);
    srcs.add(c.card);
    for (const clip of Object.values(c.clips)) srcs.add(clip.src);
  }
  for (const c of Object.values(CHARACTERS)) srcs.add(c.stand);
  // probe each character's idle sheet first; if it's missing, skip the rest of that
  // character's files instead of firing dozens of failing requests
  for (const c of Object.values(CHARACTERS)) {
    if (await loadImage(c.clips.idle.src) && getImage(c.clips.idle.src)) continue;
    for (const src of [...Object.values(c.clips).map(cl => cl.src), c.portrait, c.card, c.stand]) {
      srcs.delete(src);
      if (!images.has(src)) images.set(src, { img: null, ok: false, promise: Promise.resolve(null) });
    }
  }
  let done = 0;
  const list = [...srcs];
  await Promise.all(list.map(src => loadImage(src).then(() => onProgress(++done / list.length))));

  // anything missing → generated stand-ins, so menus and the HUD still have pictures
  for (const c of Object.values(CHARACTERS)) {
    if (!getImage(c.clips.idle.src)) placeholders = true;
    for (const field of ['portrait', 'card', 'stand']) {
      if (!getImage(c[field])) {
        c[field] = placeholderImage(c.id, field);
        await loadImage(c[field]);
      }
    }
  }
}

export function loadUiImages() {
  return Promise.all(Object.values(CHARACTERS).flatMap(c => [loadImage(c.portrait), loadImage(c.card)]));
}

export const SPRITE_SCALE = 0.86;

/* Draw one frame of a clip with its feet at (x, footY). facing 1 = right. */
export function drawClip(ctx, clip, frame, x, footY, facing, opts = {}) {
  const img = getImage(clip.src);
  if (!img) {
    if (!clip.char) return false;
    const frame0 = Math.max(0, Math.min(clip.frames - 1, frame | 0));
    if (clip.name === 'orb' || clip.name === 'chicken') drawPlaceholderProjectile(ctx, clip.name, frame0, x, footY, facing);
    else drawPlaceholderFighter(ctx, clip.char, clip.name, frame0, clip.frames, x, footY, facing, { alpha: opts.alpha, filter: opts.filter });
    return true;
  }
  const f = Math.max(0, Math.min(clip.frames - 1, frame | 0));
  const sx = (f % clip.cols) * clip.fw;
  const sy = Math.floor(f / clip.cols) * clip.fh;
  const scale = (clip.rh / clip.fh) * (opts.scale ?? SPRITE_SCALE);
  const dw = clip.fw * scale;
  const dh = clip.fh * scale;
  const dy = footY - dh + clip.foot * scale;
  const shift = (clip.offX || 0) * scale;
  ctx.save();
  ctx.translate(x, 0);
  if (facing < 0) ctx.scale(-1, 1);
  if (opts.alpha != null) ctx.globalAlpha = opts.alpha;
  if (opts.filter) ctx.filter = opts.filter;
  ctx.drawImage(img, sx, sy, clip.fw, clip.fh, -dw / 2 + shift, dy, dw, dh);
  ctx.restore();
  return true;
}
