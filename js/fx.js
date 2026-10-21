/* Combat effects: impact bursts, slash arcs, speed lines, shockwaves, sparks, dust.
 * All effects are short-lived particles updated once per simulation step.
 */

import { GROUND } from './stage.js';

const rand = (a, b) => a + Math.random() * (b - a);
const TAU = Math.PI * 2;

export class Effects {
  constructor() {
    this.list = [];
  }

  clear() { this.list.length = 0; }

  push(p) {
    p.max = p.max || p.life;
    this.list.push(p);
    if (this.list.length > 260) this.list.splice(0, this.list.length - 260);
  }

  /* A landed hit. heavy = big hits, knockdowns and finishers. */
  hitSpark(x, y, dir, heavy = false, color = '#ffe27a') {
    // star-shaped burst at the contact point
    this.push({ kind: 'impact', x, y, life: heavy ? 12 : 8, size: heavy ? 50 : 32, spikes: heavy ? 14 : 10, rot: rand(0, TAU), color });
    // crescent slash swept along the attack direction
    if (dir) this.push({ kind: 'slash', x: x - dir * 18, y: y + rand(-8, 8), dir, life: heavy ? 8 : 6, size: heavy ? 130 : 90, tilt: rand(-0.35, 0.35), color });
    // sparks flying out of the impact
    const n = heavy ? 18 : 10;
    for (let i = 0; i < n; i++) {
      const a = rand(-1.1, 1.1) + (dir >= 0 ? 0 : Math.PI);
      const sp = rand(5, heavy ? 18 : 12);
      this.push({ kind: 'line', x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 1, g: 0.35, life: rand(8, 16), len: rand(12, 30), color: i % 3 ? '#fff6c8' : color, w: heavy ? 4 : 3 });
    }
    if (heavy) {
      // comic speed lines + floor shockwave + tumbling stars
      this.push({ kind: 'focus', x, y, life: 10, power: 1, seed: rand(0, TAU) });
      this.push({ kind: 'ground', x, y: GROUND + 2, life: 16, color });
      for (let i = 0; i < 5; i++) {
        this.push({ kind: 'star', x: x + rand(-16, 16), y: y + rand(-16, 16), vx: rand(-5, 5), vy: rand(-6, -1), g: 0.18, life: rand(18, 32), size: rand(5, 10), rot: rand(0, TAU), vr: rand(-0.3, 0.3), color: i % 2 ? '#fff4bd' : color });
      }
    }
  }

  blockSpark(x, y, dir) {
    this.push({ kind: 'shield', x: x - dir * 8, y, dir, life: 11 });
    for (let i = 0; i < 7; i++) {
      const a = rand(-1.2, 1.2) + (dir > 0 ? Math.PI : 0);
      const sp = rand(4, 9);
      this.push({ kind: 'line', x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, g: 0.2, life: 10, len: 14, color: '#9fe6ff', w: 3 });
    }
  }

  dust(x, y, n = 6, dir = 0) {
    for (let i = 0; i < n; i++) {
      this.push({ kind: 'dust', x: x + rand(-22, 22), y: y - rand(0, 10), vx: rand(-2, 2) + dir * rand(1, 3), vy: rand(-2.2, -0.4), r: rand(8, 18), life: rand(18, 30), max: 30 });
    }
  }

  superAura(x, y, color) {
    for (let i = 0; i < 3; i++) {
      this.push({ kind: 'dust', x: x + rand(-60, 60), y: y - rand(0, 260), vx: rand(-0.6, 0.6), vy: rand(-4, -1.5), r: rand(6, 14), life: 24, color });
    }
    if (Math.random() < 0.35) this.push({ kind: 'star', x: x + rand(-80, 80), y: y - rand(40, 280), vx: 0, vy: -1.5, g: 0, life: 20, size: rand(4, 8), rot: 0, vr: 0.1, color: '#fff4bd' });
  }

  /* Teleport flash: a column of light plus a ring at the feet. */
  teleport(x, y) {
    this.push({ kind: 'beam', x, y, life: 16 });
    for (let i = 0; i < 8; i++) {
      this.push({ kind: 'star', x: x + rand(-40, 40), y: y - rand(20, 260), vx: rand(-1, 1), vy: rand(-3, -1), g: 0, life: rand(14, 22), size: rand(4, 8), rot: 0, vr: 0.2, color: '#fff4bd' });
    }
  }

  /* Floating text, e.g. "COUNTER" or "REVERSAL". */
  float(x, y, text, color = '#ffd84a') {
    this.push({ kind: 'float', x, y, vy: -1.4, life: 46, text, color });
  }

  update(speed = 1) {
    for (const p of this.list) {
      p.life -= speed;
      if (p.vx !== undefined) {
        p.x += p.vx * speed; p.y += p.vy * speed;
        if (p.g) p.vy += p.g * speed;
        if (p.kind === 'line' || p.kind === 'dust') { p.vx *= 0.9; p.vy *= 0.9; }
      }
      if (p.kind === 'float') p.y += p.vy * speed;
      if (p.vr) p.rot += p.vr * speed;
    }
    this.list = this.list.filter(p => p.life > 0);
  }

  draw(ctx) {
    ctx.save();
    for (const p of this.list) {
      const a = Math.max(0, p.life / p.max);
      const age = 1 - a;
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = p.kind === 'dust' && !p.color ? 'source-over' : 'lighter';
      switch (p.kind) {
        case 'impact': {
          const r = p.size * (0.6 + age * 0.9);
          const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, r);
          g.addColorStop(0, `rgba(255,255,255,${a})`);
          g.addColorStop(0.35, hexA(p.color, a * 0.9));
          g.addColorStop(1, hexA(p.color, 0));
          ctx.fillStyle = g;
          ctx.beginPath();
          for (let i = 0; i < p.spikes * 2; i++) {
            const ang = p.rot + i / (p.spikes * 2) * TAU;
            const rr = i % 2 ? r * 0.38 : r * (i % 4 ? 1 : 1.25);
            ctx.lineTo(p.x + Math.cos(ang) * rr, p.y + Math.sin(ang) * rr);
          }
          ctx.closePath(); ctx.fill();
          ctx.fillStyle = `rgba(255,255,255,${a})`;
          ctx.beginPath(); ctx.arc(p.x, p.y, r * 0.22, 0, TAU); ctx.fill();
          break;
        }
        case 'slash': {
          ctx.save();
          ctx.translate(p.x, p.y);
          ctx.rotate(p.tilt);
          ctx.scale(p.dir, 1);
          const r = p.size * (0.85 + age * 0.25);
          const g = ctx.createLinearGradient(-r, 0, r, 0);
          g.addColorStop(0, 'rgba(255,255,255,0)');
          g.addColorStop(0.6, hexA(p.color, a * 0.8));
          g.addColorStop(1, `rgba(255,255,255,${a})`);
          ctx.fillStyle = g;
          ctx.beginPath();
          ctx.arc(0, 0, r, -0.95, 0.95);
          ctx.arc(-r * 0.22, 0, r * 0.9, 0.85, -0.85, true);
          ctx.closePath(); ctx.fill();
          ctx.restore();
          break;
        }
        case 'focus': {
          // manga speed lines converging on the hit
          for (let i = 0; i < 34; i++) {
            const ang = p.seed + i / 34 * TAU + Math.sin(i * 12.9) * 0.05;
            const near = 140 + age * 150 + (i % 5) * 24;
            const far = 820 + (i % 4) * 80;
            const w = (i % 3 === 0 ? 0.03 : 0.014) * p.power;
            ctx.fillStyle = `rgba(255,255,255,${(0.13 + (i % 3) * 0.05) * a * p.power})`;
            ctx.beginPath();
            ctx.moveTo(p.x + Math.cos(ang) * near, p.y + Math.sin(ang) * near * 0.85);
            ctx.lineTo(p.x + Math.cos(ang + w) * far, p.y + Math.sin(ang + w) * far * 0.85);
            ctx.lineTo(p.x + Math.cos(ang - w) * far, p.y + Math.sin(ang - w) * far * 0.85);
            ctx.closePath(); ctx.fill();
          }
          break;
        }
        case 'ground': {
          const r = 30 + age * 170;
          ctx.strokeStyle = hexA(p.color, a * 0.9);
          ctx.lineWidth = 6 * a + 1;
          ctx.beginPath(); ctx.ellipse(p.x, p.y, r, r * 0.16, 0, 0, TAU); ctx.stroke();
          ctx.strokeStyle = `rgba(255,255,255,${a * 0.6})`;
          ctx.lineWidth = 2;
          ctx.beginPath(); ctx.ellipse(p.x, p.y, r * 0.7, r * 0.11, 0, 0, TAU); ctx.stroke();
          break;
        }
        case 'shield': {
          const s = 1 + age * 0.35;
          ctx.save();
          ctx.translate(p.x, p.y);
          ctx.scale(s * 0.6, s);
          ctx.beginPath();
          for (let i = 0; i < 6; i++) ctx.lineTo(Math.cos(i / 6 * TAU) * 70, Math.sin(i / 6 * TAU) * 70);
          ctx.closePath();
          ctx.fillStyle = `rgba(110,200,255,${a * 0.22})`; ctx.fill();
          ctx.strokeStyle = `rgba(170,235,255,${a})`; ctx.lineWidth = 4; ctx.stroke();
          ctx.restore();
          break;
        }
        case 'line': {
          ctx.strokeStyle = p.color; ctx.globalAlpha = a; ctx.lineWidth = p.w; ctx.lineCap = 'round';
          const l = Math.hypot(p.vx, p.vy) || 1;
          ctx.beginPath();
          ctx.moveTo(p.x, p.y);
          ctx.lineTo(p.x - (p.vx / l) * p.len, p.y - (p.vy / l) * p.len);
          ctx.stroke();
          break;
        }
        case 'star': {
          ctx.fillStyle = p.color; ctx.globalAlpha = Math.min(1, a * 1.5);
          ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot);
          ctx.beginPath();
          for (let i = 0; i < 8; i++) { const rr = i % 2 ? p.size * 0.35 : p.size; ctx.lineTo(Math.cos(i / 8 * TAU) * rr, Math.sin(i / 8 * TAU) * rr); }
          ctx.closePath(); ctx.fill();
          ctx.restore();
          break;
        }
        case 'dust':
          ctx.globalAlpha = a * (p.color ? 0.7 : 0.35);
          ctx.fillStyle = p.color || '#d9cbb0';
          ctx.beginPath(); ctx.arc(p.x, p.y, p.r * (1.4 - a * 0.4), 0, TAU); ctx.fill();
          break;
        case 'beam': {
          const w = 70 * a;
          const g = ctx.createLinearGradient(p.x - w, 0, p.x + w, 0);
          g.addColorStop(0, 'rgba(255,240,180,0)'); g.addColorStop(0.5, `rgba(255,250,220,${0.85 * a})`); g.addColorStop(1, 'rgba(255,240,180,0)');
          ctx.fillStyle = g; ctx.fillRect(p.x - w, 0, w * 2, p.y);
          ctx.strokeStyle = `rgba(255,230,140,${a})`; ctx.lineWidth = 4 * a + 1;
          ctx.beginPath(); ctx.ellipse(p.x, p.y, 40 + age * 80, (40 + age * 80) * 0.18, 0, 0, TAU); ctx.stroke();
          break;
        }
        case 'float':
          ctx.globalCompositeOperation = 'source-over';
          ctx.globalAlpha = Math.min(1, a * 2);
          ctx.font = '900 italic 26px "PingFang SC","Microsoft YaHei",sans-serif';
          ctx.textAlign = 'center';
          ctx.lineWidth = 6; ctx.strokeStyle = '#1a0a00'; ctx.strokeText(p.text, p.x, p.y);
          ctx.fillStyle = p.color; ctx.fillText(p.text, p.x, p.y);
          break;
      }
    }
    ctx.restore();
  }
}

/* '#rrggbb' + alpha → rgba(). */
function hexA(hex, a) {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${n >> 16 & 255},${n >> 8 & 255},${n & 255},${Math.max(0, Math.min(1, a))})`;
}
