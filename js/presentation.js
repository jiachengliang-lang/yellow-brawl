/* In-match presentation: HUD, round banners, VS intro, KO cinematics, ambience.
 * Everything here only reads match state; nothing changes the simulation.
 */

import { getImage } from './assets.js';
import { W, H, GROUND } from './stage.js';
import { t, L } from './i18n.js';

const FONT = '"PingFang SC","Microsoft YaHei","Noto Sans SC",system-ui,sans-serif';
const MONO = 'ui-monospace,"SF Mono",Menlo,monospace';
const TAU = Math.PI * 2;
const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));
const easeOut = (k) => 1 - Math.pow(1 - clamp(k), 3);
const easeIn = (k) => Math.pow(clamp(k), 3);
const easeBack = (k) => { k = clamp(k); const c = 1.7; return 1 + (c + 1) * Math.pow(k - 1, 3) + c * Math.pow(k - 1, 2); };

const SIDE = [
  { bar: ['#fff6b0', '#ffd23f', '#e8930c'], accent: '#ffd23f', tag: '#4fb6ff' },
  { bar: ['#ffd9b0', '#ff8a3d', '#d4431a'], accent: '#ff8a3d', tag: '#ff5a5a' }
];

const AMBIENT = {
  market: { color: '255,170,90', speed: 0.25 },
  rooftop: { color: '150,200,255', speed: 0.4 },
  temple: { color: '255,215,120', speed: 0.18 }
};

function rr(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/* ------------------------------------------------------------------ world layer */
export function drawAmbient(ctx, m) {
  const a = AMBIENT[m.stage] || AMBIENT.market;
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  for (let i = 0; i < 38; i++) {
    const sp = a.speed * (0.6 + (i % 5) * 0.25);
    const x = ((i * 137 + m.clock * sp) % (W + 40)) - 20;
    const y = 110 + ((i * 71) % 430) + Math.sin(m.clock * 0.012 + i) * 18;
    const r = 1.4 + (i % 3) * 1.1;
    const al = 0.18 + 0.16 * Math.sin(m.clock * 0.05 + i * 1.7);
    ctx.fillStyle = `rgba(${a.color},${al})`;
    ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill();
  }
  ctx.restore();
}

export function drawShadow(ctx, f) {
  const lift = Math.max(0, GROUND - f.y);
  const s = Math.max(0.35, 1 - lift / 380);
  const g = ctx.createRadialGradient(f.x, GROUND + 4, 4, f.x, GROUND + 4, 90 * s);
  g.addColorStop(0, `rgba(0,0,0,${0.5 * s})`); g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.save();
  ctx.translate(f.x, GROUND + 4); ctx.scale(1, 0.2); ctx.translate(-f.x, -(GROUND + 4));
  ctx.fillStyle = g;
  ctx.beginPath(); ctx.arc(f.x, GROUND + 4, 90 * s, 0, TAU); ctx.fill();
  ctx.restore();
}

/* Super freeze: speed spokes radiating from the attacker. */
export function drawSuperBackdrop(ctx, m) {
  const f = m.freezeWho;
  if (!f) return;
  const cx = f.x, cy = f.y - 170;
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  for (let i = 0; i < 40; i++) {
    const ang = i / 40 * TAU + m.clock * 0.004 + Math.sin(i * 7.3) * 0.04;
    const w = i % 3 === 0 ? 0.035 : 0.014;
    const r0 = 150 + (i % 4) * 30, r1 = 1100;
    ctx.fillStyle = `rgba(255,${200 + (i % 3) * 20},120,${0.1 + (i % 2) * 0.06})`;
    ctx.beginPath();
    ctx.moveTo(cx + Math.cos(ang) * r0, cy + Math.sin(ang) * r0);
    ctx.lineTo(cx + Math.cos(ang + w) * r1, cy + Math.sin(ang + w) * r1);
    ctx.lineTo(cx + Math.cos(ang - w) * r1, cy + Math.sin(ang - w) * r1);
    ctx.closePath(); ctx.fill();
  }
  ctx.restore();
}

/* ------------------------------------------------------------------ screen layer */
export function drawVignette(ctx) {
  const g = ctx.createRadialGradient(W / 2, H * 0.55, 300, W / 2, H * 0.55, 820);
  g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,0,.5)');
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  const top = ctx.createLinearGradient(0, 0, 0, 150);
  top.addColorStop(0, 'rgba(6,4,10,.55)'); top.addColorStop(1, 'rgba(6,4,10,0)');
  ctx.fillStyle = top; ctx.fillRect(0, 0, W, 150);
}

/* KO cinematic: letterbox bars, red vignette, radial burst from the loser. */
export function drawKoFx(ctx, m) {
  if (m.phase !== 'ko' || m.koKind !== 'ko' || m.koClock == null) return;
  const age = m.clock - m.koClock;
  if (age > 170) return;
  const loser = m.fighters[1 - (m.winner ?? 0)];
  ctx.save();
  const vig = clamp(1 - age / 110) * 0.5;
  if (vig > 0.01) {
    const g = ctx.createRadialGradient(W / 2, H / 2, 220, W / 2, H / 2, 760);
    g.addColorStop(0, 'rgba(255,30,40,0)'); g.addColorStop(1, `rgba(255,30,40,${vig})`);
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  }
  if (age < 36) {
    const a = 1 - age / 36;
    const cx = loser.x, cy = loser.y - 130;
    ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 30; i++) {
      const ang = i / 30 * TAU + (i % 2) * 0.03;
      const r0 = 70 + age * 18, r1 = r0 + 260 + (i % 5) * 90;
      const w = (i % 3 === 0 ? 7 : 3) * a / r1 * 40;
      ctx.fillStyle = i % 2 ? `rgba(255,236,170,${a * 0.55})` : `rgba(255,255,255,${a * 0.45})`;
      ctx.beginPath();
      ctx.moveTo(cx + Math.cos(ang) * r0, cy + Math.sin(ang) * r0);
      ctx.lineTo(cx + Math.cos(ang + w) * r1, cy + Math.sin(ang + w) * r1);
      ctx.lineTo(cx + Math.cos(ang - w) * r1, cy + Math.sin(ang - w) * r1);
      ctx.closePath(); ctx.fill();
    }
    ctx.globalCompositeOperation = 'source-over';
  }
  const bars = easeOut(age / 14) * (1 - easeIn((age - 140) / 30));
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, W, 70 * bars);
  ctx.fillRect(0, H - 70 * bars, W, 70 * bars);
  ctx.restore();
}

/* Round 1 opener: both fighters' panels slam in from the sides, then "VS". */
export function drawIntroVs(ctx, m) {
  if (m.phase !== 'intro' || m.round !== 1 || m.training) return;
  const e = m.phaseT;
  if (e > 80) return;
  const slide = easeOut(e / 16);
  const out = easeIn((e - 64) / 16);
  const fade = clamp(Math.min(e / 6, (80 - e) / 14));
  ctx.save();
  ctx.fillStyle = `rgba(6,4,10,${0.78 * fade})`;
  ctx.fillRect(0, 0, W, H);
  for (const side of [0, 1]) {
    const f = m.fighters[side];
    const dir = side === 0 ? -1 : 1;
    const off = dir * ((1 - slide) * 760 + out * 760);
    ctx.save();
    ctx.translate(off, 0);
    // skewed panel
    ctx.beginPath();
    if (side === 0) { ctx.moveTo(0, 150); ctx.lineTo(700, 150); ctx.lineTo(590, 570); ctx.lineTo(0, 570); }
    else { ctx.moveTo(W, 150); ctx.lineTo(690, 150); ctx.lineTo(580, 570); ctx.lineTo(W, 570); }
    ctx.closePath();
    const g = ctx.createLinearGradient(side ? W : 0, 0, side ? 580 : 700, 0);
    g.addColorStop(0, 'rgba(20,12,26,.95)'); g.addColorStop(1, side ? 'rgba(120,40,20,.9)' : 'rgba(120,90,10,.9)');
    ctx.fillStyle = g; ctx.fill();
    ctx.save(); ctx.clip();
    const card = getImage(f.c.card);
    if (card) {
      const h = 470, w = h * card.width / card.height;
      const cx = side === 0 ? 300 : W - 300;
      ctx.translate(cx, 0);
      if (side === 1) ctx.scale(-1, 1);
      ctx.drawImage(card, -w / 2, 130, w, h);
    }
    ctx.restore();
    ctx.lineWidth = 4; ctx.strokeStyle = SIDE[side].accent; ctx.stroke();
    // name plate
    ctx.textAlign = side === 0 ? 'left' : 'right';
    const nx = side === 0 ? 60 : W - 60;
    ctx.font = `900 italic 62px ${FONT}`;
    ctx.lineWidth = 10; ctx.strokeStyle = '#0a0610';
    ctx.strokeText(m.nameOf(side), nx, 548); ctx.fillStyle = '#fff6dc'; ctx.fillText(m.nameOf(side), nx, 548);
    ctx.font = `800 16px ${MONO}`; ctx.fillStyle = SIDE[side].accent;
    ctx.fillText(`${side === 0 ? 'P1' : 'P2'} · ${L(f.c.title).toUpperCase()}`, nx, 486);
    ctx.restore();
  }
  // VS stamp
  if (e > 10) {
    const k = clamp((e - 10) / 8);
    const s = 2.6 - 1.6 * easeOut(k);
    ctx.save();
    ctx.globalAlpha = clamp(k * 2) * (1 - out);
    ctx.translate(W / 2, 380); ctx.rotate(-0.08); ctx.scale(s, s);
    ctx.font = `900 italic 130px ${FONT}`; ctx.textAlign = 'center';
    ctx.lineWidth = 16; ctx.strokeStyle = '#120804'; ctx.strokeText('VS', 0, 40);
    const gg = ctx.createLinearGradient(0, -60, 0, 40);
    gg.addColorStop(0, '#fff8c8'); gg.addColorStop(0.55, '#ffd23f'); gg.addColorStop(1, '#ff7a1a');
    ctx.fillStyle = gg; ctx.fillText('VS', 0, 40);
    ctx.restore();
  }
  ctx.restore();
}

/* ------------------------------------------------------------------ banners */
const BANNERS = {
  round: { band: 'rgba(14,10,22,.92)', edge: '#ffd23f', fill: ['#ffffff', '#ffd23f'], ink: '#0a0610' },
  final: { band: 'rgba(40,6,10,.92)', edge: '#ff4a3d', fill: ['#ffffff', '#ff8a5a'], ink: '#0a0610' },
  fight: { band: '#d8321e', edge: '#ffd23f', fill: ['#ffffff', '#fff1b0'], ink: '#3a0600' },
  win: { band: '#ffd23f', edge: '#ffffff', fill: ['#3a1a00', '#2a1000'], ink: 'rgba(255,255,255,.6)' },
  time: { band: 'rgba(16,40,80,.94)', edge: '#7fd4ff', fill: ['#ffffff', '#bfe8ff'], ink: '#05101e' }
};

export function drawBanner(ctx, m) {
  const a = m.announce;
  if (!a) return;
  if (a.style === 'ko') return drawKoStamp(ctx, a);
  const st = BANNERS[a.style] || BANNERS.round;
  const inK = easeOut(a.t / 9);
  const outK = easeIn((a.t - (a.dur - 12)) / 12);
  const cy = 330, h = a.sub ? 150 : 124;
  ctx.save();
  // the band sweeps across, then leaves to the right
  const bw = W * inK;
  const bx = outK * W;
  ctx.globalAlpha = 1 - outK * 0.6;
  ctx.beginPath();
  ctx.moveTo(bx - 40, cy - h / 2 + 10); ctx.lineTo(bx + bw + 40, cy - h / 2 - 10);
  ctx.lineTo(bx + bw + 40, cy + h / 2 - 10); ctx.lineTo(bx - 40, cy + h / 2 + 10); ctx.closePath();
  ctx.fillStyle = st.band; ctx.fill();
  ctx.lineWidth = 3; ctx.strokeStyle = st.edge;
  ctx.beginPath(); ctx.moveTo(bx - 40, cy - h / 2 + 10); ctx.lineTo(bx + bw + 40, cy - h / 2 - 10); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(bx - 40, cy + h / 2 + 10); ctx.lineTo(bx + bw + 40, cy + h / 2 - 10); ctx.stroke();
  // text slides in with a slight overshoot
  const tk = easeBack(a.t / 12);
  const tx = W / 2 + (1 - tk) * 380 - outK * 420;
  ctx.globalAlpha = clamp(a.t / 4) * (1 - outK);
  ctx.textAlign = 'center';
  ctx.font = `900 italic 92px ${FONT}`;
  ctx.lineWidth = 12; ctx.strokeStyle = st.ink;
  const ty = cy + (a.sub ? 14 : 32);
  ctx.strokeText(a.text, tx, ty);
  const g = ctx.createLinearGradient(0, ty - 70, 0, ty);
  g.addColorStop(0, st.fill[0]); g.addColorStop(1, st.fill[1]);
  ctx.fillStyle = g; ctx.fillText(a.text, tx, ty);
  if (a.sub) {
    ctx.font = `800 20px ${MONO}`;
    ctx.fillStyle = a.style === 'win' ? '#3a1a00' : st.edge;
    ctx.fillText(a.sub, tx, cy + 52);
  }
  ctx.restore();
}

function drawKoStamp(ctx, a) {
  const k = clamp(a.t / 8);
  const s = a.t < 8 ? 2.8 - 1.8 * easeOut(k) : 1 + Math.sin(a.t * 0.5) * 0.012 * Math.max(0, 1 - (a.t - 8) / 30);
  const out = easeIn((a.t - (a.dur - 14)) / 14);
  ctx.save();
  ctx.globalAlpha = clamp(k * 3) * (1 - out);
  ctx.translate(W / 2, 330); ctx.rotate(-0.07); ctx.scale(s, s);
  if (a.t < 22) {
    ctx.strokeStyle = `rgba(255,255,255,${1 - a.t / 22})`; ctx.lineWidth = 4;
    for (let i = 0; i < 12; i++) {
      const ang = i / 12 * TAU;
      ctx.beginPath(); ctx.moveTo(Math.cos(ang) * 150, Math.sin(ang) * 90); ctx.lineTo(Math.cos(ang) * (220 + a.t * 8), Math.sin(ang) * (130 + a.t * 5)); ctx.stroke();
    }
  }
  ctx.textAlign = 'center';
  ctx.font = `900 italic 190px ${FONT}`;
  ctx.lineWidth = 26; ctx.strokeStyle = '#fff'; ctx.strokeText('K.O.', 0, 66);
  ctx.lineWidth = 14; ctx.strokeStyle = '#2a0000'; ctx.strokeText('K.O.', 0, 66);
  const g = ctx.createLinearGradient(0, -90, 0, 66);
  g.addColorStop(0, '#ffb0a0'); g.addColorStop(0.5, '#ff3b30'); g.addColorStop(1, '#a00a10');
  ctx.fillStyle = g; ctx.fillText('K.O.', 0, 66);
  ctx.restore();
}

/* ------------------------------------------------------------------ HUD */
export function drawHud(ctx, m) {
  ctx.save();
  m.fighters.forEach((f, i) => drawPlayerHud(ctx, m, f, i));
  drawTimer(ctx, m);
  m.combo.forEach((c, side) => drawCombo(ctx, c, side));
  if (m.training && m.lastCombo) {
    ctx.textAlign = 'center'; ctx.font = `700 15px ${MONO}`; ctx.fillStyle = 'rgba(255,246,220,.8)';
    ctx.fillText(t('trLastCombo', { hits: m.lastCombo.hits, dmg: m.lastCombo.dmg }), W / 2, 122);
  }
  ctx.restore();
}

function drawPlayerHud(ctx, m, f, side) {
  const P = SIDE[side];
  const left = side === 0;
  const barW = 455, barH = 22, y = 34;
  const bx = left ? 118 : W - 118 - barW;

  // portrait: rounded square with a coloured rim
  const px = left ? 26 : W - 26 - 78, py = 22;
  ctx.save();
  ctx.shadowColor = P.accent; ctx.shadowBlur = 14;
  rr(ctx, px, py, 78, 78, 16); ctx.fillStyle = '#140c1c'; ctx.fill();
  ctx.restore();
  ctx.save();
  rr(ctx, px, py, 78, 78, 16); ctx.clip();
  const img = getImage(f.c.portrait);
  if (img) {
    if (!left) { ctx.translate(px * 2 + 78, 0); ctx.scale(-1, 1); }
    ctx.drawImage(img, px - 6, py - 4, 90, 90);
  }
  ctx.restore();
  rr(ctx, px, py, 78, 78, 16); ctx.lineWidth = 3; ctx.strokeStyle = P.accent; ctx.stroke();
  const tag = m.cpu[side] ? t('cpu') : side === 0 ? 'P1' : 'P2';
  ctx.font = `900 12px ${MONO}`;
  const tw = ctx.measureText(tag).width + 14;
  rr(ctx, px + 39 - tw / 2, py + 70, tw, 18, 9); ctx.fillStyle = P.tag; ctx.fill();
  ctx.fillStyle = '#fff'; ctx.textAlign = 'center'; ctx.fillText(tag, px + 39, py + 83);

  // health bar frame
  ctx.save();
  rr(ctx, bx - 3, y - 3, barW + 6, barH + 6, 6); ctx.fillStyle = 'rgba(7,5,9,.78)'; ctx.fill();
  ctx.strokeStyle = 'rgba(255,244,216,.22)'; ctx.lineWidth = 1; ctx.stroke();
  rr(ctx, bx, y, barW, barH, 4); ctx.clip();
  ctx.fillStyle = '#2a2229'; ctx.fillRect(bx, y, barW, barH);
  const ratio = clamp(f.hp / f.c.hp), ghost = clamp(f.redHp / f.c.hp);
  const span = (r) => (left ? [bx, barW * r] : [bx + barW - barW * r, barW * r]);
  let [gx, gw] = span(ghost);
  ctx.fillStyle = 'rgba(255,244,214,.55)'; ctx.fillRect(gx, y, gw, barH);
  const low = ratio < 0.25;
  const pulse = low ? 0.5 + 0.5 * Math.sin(m.clock * 0.25) : 0;
  const g = ctx.createLinearGradient(0, y, 0, y + barH);
  if (low) { g.addColorStop(0, '#ffb0a0'); g.addColorStop(0.45, `rgb(255,${60 + pulse * 60},${50 + pulse * 40})`); g.addColorStop(1, '#a01018'); }
  else { g.addColorStop(0, P.bar[0]); g.addColorStop(0.45, P.bar[1]); g.addColorStop(1, P.bar[2]); }
  const [hx, hw] = span(ratio);
  ctx.fillStyle = g; ctx.fillRect(hx, y, hw, barH);
  ctx.fillStyle = 'rgba(255,255,255,.3)'; ctx.fillRect(hx, y + 2, hw, 4);
  if (ratio > 0 && ratio < 1) { ctx.fillStyle = 'rgba(255,255,255,.85)'; ctx.fillRect(left ? hx + hw - 2 : hx, y, 2, barH); }
  ctx.fillStyle = 'rgba(0,0,0,.28)';
  for (let i = 1; i < 10; i++) ctx.fillRect(bx + barW * i / 10, y + barH - 6, 1, 6);
  ctx.restore();

  // name + round pips
  ctx.textAlign = left ? 'left' : 'right';
  ctx.font = `900 19px ${FONT}`;
  ctx.lineWidth = 5; ctx.strokeStyle = 'rgba(6,4,10,.9)';
  const nx = left ? bx : bx + barW;
  ctx.strokeText(m.nameOf(side), nx, y + barH + 24); ctx.fillStyle = '#fff6dc'; ctx.fillText(m.nameOf(side), nx, y + barH + 24);
  ctx.font = `700 12px ${MONO}`; ctx.fillStyle = 'rgba(255,246,220,.55)';
  const nameW = ctx.measureText(m.nameOf(side)).width;
  ctx.font = `900 19px ${FONT}`;
  const realW = ctx.measureText(m.nameOf(side)).width;
  ctx.font = `700 12px ${MONO}`;
  ctx.fillText(L(f.c.title).toUpperCase(), left ? nx + realW + 10 : nx - realW - 10, y + barH + 23);
  void nameW;
  if (!m.training) {
    for (let i = 0; i < m.winsNeeded; i++) {
      const cx = left ? bx + barW - 10 - i * 22 : bx + 10 + i * 22, cy = y + barH + 16;
      ctx.save(); ctx.translate(cx, cy); ctx.rotate(Math.PI / 4);
      ctx.fillStyle = i < f.wins ? P.accent : 'rgba(255,255,255,.1)';
      ctx.fillRect(-6, -6, 12, 12);
      ctx.strokeStyle = 'rgba(255,230,160,.8)'; ctx.lineWidth = 1.5; ctx.strokeRect(-6, -6, 12, 12);
      ctx.restore();
    }
  }

  // super meter (bottom corners), 4 segments
  const mw = 300, mh = 12, my = H - 40;
  const mx = left ? 36 : W - 36 - mw;
  const full = f.meter >= 100;
  ctx.font = `900 13px ${MONO}`; ctx.textAlign = left ? 'left' : 'right';
  ctx.fillStyle = full ? '#7ff3ff' : 'rgba(255,246,220,.65)';
  const locked = f.meterLock > 0;
  ctx.fillText(full ? `${t('superReady')} ◆` : locked ? `SUPER  ⏸ ${Math.ceil(f.meterLock / 60)}s` : `SUPER  ${Math.floor(f.meter)}%${f.meter >= 50 ? '  · SP ✓' : ''}`, left ? mx : mx + mw, my - 8);
  for (let s = 0; s < 4; s++) {
    const sw = (mw - 9) / 4, sx = mx + s * (sw + 3);
    rr(ctx, sx, my, sw, mh, 3); ctx.fillStyle = 'rgba(7,5,9,.75)'; ctx.fill();
    const segFill = clamp((f.meter - s * 25) / 25);
    if (segFill > 0) {
      const fw = sw * segFill;
      const fx = left ? sx : sx + sw - fw;
      const gg = ctx.createLinearGradient(0, my, 0, my + mh);
      gg.addColorStop(0, full ? '#e8ffff' : '#9fe6ff'); gg.addColorStop(1, full ? '#2ec8ff' : '#1f8fd6');
      rr(ctx, fx, my, fw, mh, 3); ctx.fillStyle = gg; ctx.fill();
    }
  }
  // the half-bar mark: a special costs this much
  ctx.fillStyle = f.meter >= 50 ? '#ffd23f' : 'rgba(255,210,63,.45)';
  ctx.fillRect(mx + mw / 2 - 1.5, my - 4, 3, mh + 8);
  if (full) {
    // sheen sweeping across a full meter
    const k = (m.clock % 50) / 50;
    const sx = mx + k * (mw + 80) - 40;
    ctx.save();
    rr(ctx, mx, my, mw, mh, 3); ctx.clip();
    const sg = ctx.createLinearGradient(sx - 30, 0, sx + 30, 0);
    sg.addColorStop(0, 'rgba(255,255,255,0)'); sg.addColorStop(0.5, 'rgba(255,255,255,.85)'); sg.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = sg; ctx.fillRect(mx, my, mw, mh);
    ctx.restore();
    ctx.save(); ctx.shadowColor = '#5ef0ff'; ctx.shadowBlur = 16;
    rr(ctx, mx - 2, my - 2, mw + 4, mh + 4, 4); ctx.strokeStyle = 'rgba(126,243,255,.8)'; ctx.lineWidth = 2; ctx.stroke();
    ctx.restore();
  }
}

function drawTimer(ctx, m) {
  const cx = W / 2, y = 20;
  ctx.save();
  rr(ctx, cx - 46, y, 92, 74, 14);
  const g = ctx.createLinearGradient(0, y, 0, y + 74);
  g.addColorStop(0, 'rgba(30,22,36,.95)'); g.addColorStop(1, 'rgba(10,7,14,.95)');
  ctx.fillStyle = g; ctx.fill();
  ctx.lineWidth = 2; ctx.strokeStyle = 'rgba(255,210,63,.75)'; ctx.stroke();
  ctx.font = `800 10px ${MONO}`; ctx.fillStyle = 'rgba(255,210,63,.8)'; ctx.textAlign = 'center';
  ctx.fillText(m.training ? 'TRAINING' : `ROUND ${m.round}`, cx, y + 16);
  const inf = m.training || !m.roundTime;
  const urgent = !inf && m.timer <= 10;
  const s = urgent ? 1 + 0.12 * Math.max(0, 1 - (m.clock % 60) / 12) : 1;
  ctx.translate(cx, y + 56); ctx.scale(s, s);
  ctx.font = `900 40px ${FONT}`;
  ctx.fillStyle = urgent ? '#ff5a4a' : '#fff4d1';
  ctx.fillText(inf ? '∞' : String(Math.max(0, m.timer)).padStart(2, '0'), 0, 0);
  ctx.restore();
}

function drawCombo(ctx, c, side) {
  if (!c || c.t <= 0 || c.hits < 2) return;
  const a = clamp(c.t / 20);
  const pop = 1 + 0.35 * clamp((c.pop || 0) / 8);
  const left = side === 0;
  const x = left ? 42 : W - 42;
  ctx.save();
  ctx.globalAlpha = a;
  ctx.translate(x, 236);
  ctx.textAlign = left ? 'left' : 'right';
  ctx.save();
  ctx.scale(pop, pop);
  ctx.font = `900 italic 74px ${FONT}`;
  ctx.lineWidth = 10; ctx.strokeStyle = '#1a0800';
  ctx.strokeText(String(c.hits), 0, 0);
  const g = ctx.createLinearGradient(0, -60, 0, 0);
  g.addColorStop(0, '#fff8c8'); g.addColorStop(1, '#ff8a1a');
  ctx.fillStyle = g; ctx.fillText(String(c.hits), 0, 0);
  ctx.restore();
  ctx.font = `900 italic 26px ${FONT}`;
  const hitsX = left ? ctx.measureText('').width : 0;
  ctx.lineWidth = 6; ctx.strokeStyle = '#1a0800';
  ctx.strokeText('HITS', hitsX, 30); ctx.fillStyle = '#ffd23f'; ctx.fillText('HITS', hitsX, 30);
  ctx.font = `800 15px ${MONO}`; ctx.fillStyle = 'rgba(255,246,220,.85)';
  ctx.fillText(`${c.dmg} DMG`, hitsX, 52);
  ctx.restore();
}
