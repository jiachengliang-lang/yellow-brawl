/* Hit sparks, dust and other short-lived effects. */

const rand = (a, b) => a + Math.random() * (b - a);

export class Effects {
  constructor() {
    this.list = [];
  }

  clear() { this.list.length = 0; }

  hitSpark(x, y, dir, heavy = false, color = '#fff3b0') {
    const n = heavy ? 14 : 8;
    for (let i = 0; i < n; i++) {
      const a = rand(-0.9, 0.9) + (dir > 0 ? 0 : Math.PI);
      const sp = rand(6, heavy ? 17 : 12);
      this.list.push({ kind: 'line', x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: rand(8, 14), max: 14, len: rand(10, 26), color, w: heavy ? 4 : 3 });
    }
    this.list.push({ kind: 'ring', x, y, r: 10, grow: heavy ? 7 : 5, life: 12, max: 12, color, w: heavy ? 6 : 4 });
    this.list.push({ kind: 'flash', x, y, r: heavy ? 70 : 46, life: 5, max: 5 });
  }

  blockSpark(x, y, dir) {
    for (let i = 0; i < 6; i++) {
      const a = rand(-1.2, 1.2) + (dir > 0 ? Math.PI : 0);
      this.list.push({ kind: 'line', x, y, vx: Math.cos(a) * rand(4, 9), vy: Math.sin(a) * rand(4, 9), life: 10, max: 10, len: 14, color: '#8fd3ff', w: 3 });
    }
    this.list.push({ kind: 'ring', x, y, r: 26, grow: 3, life: 10, max: 10, color: '#8fd3ff', w: 5 });
  }

  dust(x, y, n = 6, dir = 0) {
    for (let i = 0; i < n; i++) {
      this.list.push({ kind: 'dust', x: x + rand(-20, 20), y: y - rand(0, 10), vx: rand(-2, 2) + dir * rand(1, 3), vy: rand(-2.2, -0.4), r: rand(8, 18), life: rand(18, 30), max: 30 });
    }
  }

  superAura(x, y, color) {
    for (let i = 0; i < 3; i++) {
      this.list.push({ kind: 'dust', x: x + rand(-60, 60), y: y - rand(0, 260), vx: rand(-0.6, 0.6), vy: rand(-4, -1.5), r: rand(6, 14), life: 24, max: 24, color });
    }
  }

  update(speed = 1) {
    for (const p of this.list) {
      p.life -= speed;
      if (p.kind === 'line' || p.kind === 'dust') {
        p.x += p.vx * speed; p.y += p.vy * speed;
        p.vx *= 0.9; p.vy *= 0.9;
      }
      if (p.kind === 'ring') p.r += p.grow * speed;
    }
    this.list = this.list.filter(p => p.life > 0);
  }

  draw(ctx) {
    ctx.save();
    for (const p of this.list) {
      const a = Math.max(0, p.life / p.max);
      if (p.kind === 'line') {
        ctx.globalCompositeOperation = 'lighter';
        ctx.strokeStyle = p.color; ctx.globalAlpha = a; ctx.lineWidth = p.w; ctx.lineCap = 'round';
        const l = Math.hypot(p.vx, p.vy) || 1;
        ctx.beginPath();
        ctx.moveTo(p.x, p.y);
        ctx.lineTo(p.x - (p.vx / l) * p.len, p.y - (p.vy / l) * p.len);
        ctx.stroke();
      } else if (p.kind === 'ring') {
        ctx.globalCompositeOperation = 'lighter';
        ctx.strokeStyle = p.color; ctx.globalAlpha = a; ctx.lineWidth = p.w * a + 1;
        ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2); ctx.stroke();
      } else if (p.kind === 'flash') {
        ctx.globalCompositeOperation = 'lighter';
        const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.r);
        g.addColorStop(0, `rgba(255,255,255,${0.95 * a})`);
        g.addColorStop(1, 'rgba(255,220,120,0)');
        ctx.fillStyle = g; ctx.globalAlpha = 1;
        ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2); ctx.fill();
      } else if (p.kind === 'dust') {
        ctx.globalCompositeOperation = p.color ? 'lighter' : 'source-over';
        ctx.globalAlpha = a * (p.color ? 0.7 : 0.35);
        ctx.fillStyle = p.color || '#d9cbb0';
        ctx.beginPath(); ctx.arc(p.x, p.y, p.r * (1.4 - a * 0.4), 0, Math.PI * 2); ctx.fill();
      }
    }
    ctx.restore();
  }
}
