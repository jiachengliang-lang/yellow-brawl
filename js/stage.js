/* Procedurally drawn stages. Static layers are cached once per stage;
 * animated details (neon, lanterns, searchlights, smoke) are drawn every frame.
 */

export const W = 1280;
export const H = 720;
export const GROUND = 640;

export const STAGES = [
  { id: 'market', name: { zh: '黄色大排档', en: 'Midnight Market' }, music: 'market' },
  { id: 'rooftop', name: { zh: '天台外卖站', en: 'Rooftop Rush' }, music: 'rooftop' },
  { id: 'temple', name: { zh: '金色神殿', en: 'Golden Temple' }, music: 'temple' }
];
export const STAGE_IDS = STAGES.map(s => s.id);

const FONT = '"PingFang SC","Microsoft YaHei","Noto Sans SC",sans-serif';
const cache = {};

function seeded(seed) {
  let s = seed >>> 0;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
}

function canvas() {
  const c = document.createElement('canvas');
  c.width = W; c.height = H;
  return [c, c.getContext('2d')];
}

function skyline(g, r, { base, minH, varH, color, lit, litColors, density }) {
  let x = -20;
  while (x < W + 40) {
    const w = 50 + r() * 90;
    const h = minH + r() * varH;
    const top = base - h;
    g.fillStyle = color;
    g.fillRect(x, top, w, H - top);
    for (let wy = top + 14; wy < base - 10; wy += 18) {
      for (let wx = x + 8; wx < x + w - 10; wx += 14) {
        if (r() < density) {
          g.fillStyle = litColors[Math.floor(r() * litColors.length)];
          g.fillRect(wx, wy, 6, 9);
        }
      }
    }
    if (lit && r() < 0.25) { g.fillStyle = '#2a2140'; g.fillRect(x + w / 2 - 1, top - 30, 2, 30); }
    x += w + 4 + r() * 10;
  }
}

/* ======================================================================== market */
function buildMarket() {
  const [c, g] = canvas();
  const r = seeded(7);
  const sky = g.createLinearGradient(0, 0, 0, GROUND);
  sky.addColorStop(0, '#120b26'); sky.addColorStop(0.55, '#2a1440'); sky.addColorStop(1, '#5a2340');
  g.fillStyle = sky; g.fillRect(0, 0, W, GROUND);
  const moon = g.createRadialGradient(1040, 120, 10, 1040, 120, 180);
  moon.addColorStop(0, 'rgba(255,230,170,.55)'); moon.addColorStop(0.2, 'rgba(255,210,140,.18)'); moon.addColorStop(1, 'rgba(255,200,120,0)');
  g.fillStyle = moon; g.fillRect(820, 0, 460, 320);
  g.fillStyle = '#ffe9b8'; g.beginPath(); g.arc(1040, 120, 34, 0, Math.PI * 2); g.fill();
  const lit = ['rgba(255,200,110,.75)', 'rgba(255,200,110,.75)', 'rgba(120,220,255,.6)'];
  skyline(g, r, { base: GROUND - 120, minH: 260, varH: 160, color: '#24143a', litColors: lit, density: 0.16 });
  skyline(g, r, { base: GROUND - 60, minH: 180, varH: 140, color: '#1b1030', litColors: lit, density: 0.28 });

  const stall = (x, w, color, sign) => {
    const top = GROUND - 190;
    g.fillStyle = '#2b1a24'; g.fillRect(x, top + 40, w, 150);
    g.fillStyle = color; g.beginPath();
    g.moveTo(x - 14, top + 44); g.lineTo(x + w + 14, top + 44); g.lineTo(x + w, top); g.lineTo(x, top); g.closePath(); g.fill();
    for (let i = 0; i < w; i += 28) { g.fillStyle = 'rgba(255,255,255,.18)'; g.fillRect(x + i, top, 14, 44); }
    g.fillStyle = 'rgba(255,190,90,.25)'; g.fillRect(x + 8, top + 56, w - 16, 70);
    g.font = `bold 26px ${FONT}`; g.textAlign = 'center'; g.fillStyle = '#ffe7a8';
    g.fillText(sign, x + w / 2, top + 98);
  };
  stall(40, 230, '#c2332f', '烧烤'); stall(330, 200, '#2f7dc2', '奶茶');
  stall(760, 210, '#3f9a4a', '炒粉'); stall(1010, 230, '#c27a2f', '夜宵');

  const floor = g.createLinearGradient(0, GROUND, 0, H);
  floor.addColorStop(0, '#3a2430'); floor.addColorStop(1, '#140c14');
  g.fillStyle = floor; g.fillRect(0, GROUND, W, H - GROUND);
  perspectiveGrid(g, 'rgba(255,200,150,.08)');
  g.fillStyle = 'rgba(255,210,140,.18)'; g.fillRect(0, GROUND, W, 2);
  return c;
}

function drawMarket(ctx, frame, sx, sy) {
  const flick = (Math.sin(frame * 0.13) > 0.96 || (frame % 240) < 4) ? 0.35 : 1;
  neonText(ctx, 640 + sx * 0.5, 120 + sy * 0.5, '黄色大排档', 'MIDNIGHT  MARKET', '#ff4fa3', 'rgba(255,120,190,', flick);
  lanterns(ctx, frame, sx, sy);
}

/* ======================================================================== rooftop */
function buildRooftop() {
  const [c, g] = canvas();
  const r = seeded(21);
  const sky = g.createLinearGradient(0, 0, 0, GROUND);
  sky.addColorStop(0, '#060a1e'); sky.addColorStop(0.6, '#13244a'); sky.addColorStop(1, '#2f3f6e');
  g.fillStyle = sky; g.fillRect(0, 0, W, GROUND);
  for (let i = 0; i < 140; i++) {
    g.fillStyle = `rgba(255,255,255,${0.2 + r() * 0.6})`;
    g.fillRect(r() * W, r() * 330, r() < 0.1 ? 2 : 1, r() < 0.1 ? 2 : 1);
  }
  // the city far below the roof edge
  const lit = ['rgba(255,214,120,.8)', 'rgba(140,220,255,.7)', 'rgba(255,120,170,.6)'];
  skyline(g, r, { base: GROUND - 70, minH: 120, varH: 260, color: '#141c38', lit: true, litColors: lit, density: 0.22 });
  const haze = g.createLinearGradient(0, GROUND - 260, 0, GROUND - 60);
  haze.addColorStop(0, 'rgba(90,120,200,0)'); haze.addColorStop(1, 'rgba(120,150,230,.35)');
  g.fillStyle = haze; g.fillRect(0, GROUND - 260, W, 200);

  // billboard (left) and water tower (right)
  g.fillStyle = '#1a1a2a'; g.fillRect(120, 250, 12, 300); g.fillRect(400, 250, 12, 300);
  g.fillStyle = '#20223a'; g.fillRect(90, 200, 350, 150);
  g.strokeStyle = '#3a3f66'; g.lineWidth = 4; g.strokeRect(90, 200, 350, 150);
  g.fillStyle = '#2b2f52';
  for (let i = 0; i < 6; i++) g.fillRect(100 + i * 58, 350, 6, 8);
  g.fillStyle = '#2a2c44';
  g.fillRect(1010, 330, 16, 230); g.fillRect(1124, 330, 16, 230);
  g.beginPath(); g.ellipse(1075, 300, 90, 22, 0, 0, Math.PI * 2); g.fill();
  g.fillRect(985, 220, 180, 80);
  g.beginPath(); g.moveTo(985, 220); g.lineTo(1075, 175); g.lineTo(1165, 220); g.closePath(); g.fill();
  g.strokeStyle = '#3c4060'; g.lineWidth = 3;
  for (let y = 232; y < 300; y += 16) { g.beginPath(); g.moveTo(985, y); g.lineTo(1165, y); g.stroke(); }

  // railing at the back of the roof
  g.strokeStyle = '#5a6290'; g.lineWidth = 4;
  g.beginPath(); g.moveTo(0, GROUND - 70); g.lineTo(W, GROUND - 70); g.stroke();
  g.lineWidth = 2;
  g.beginPath(); g.moveTo(0, GROUND - 40); g.lineTo(W, GROUND - 40); g.stroke();
  for (let x = 10; x < W; x += 40) { g.beginPath(); g.moveTo(x, GROUND - 70); g.lineTo(x, GROUND); g.stroke(); }

  // AC units + delivery boxes
  const box = (x, y, w, h, top, side) => {
    g.fillStyle = side; g.fillRect(x, y, w, h);
    g.fillStyle = top; g.fillRect(x, y, w, 8);
  };
  box(40, GROUND - 60, 110, 60, '#7a7f99', '#5a5f77');
  g.strokeStyle = '#3f4258'; g.lineWidth = 2;
  for (let i = 0; i < 5; i++) { g.beginPath(); g.moveTo(52 + i * 20, GROUND - 46); g.lineTo(52 + i * 20, GROUND - 10); g.stroke(); }
  box(1160, GROUND - 46, 70, 46, '#ffcc33', '#e0a91a');
  box(1190, GROUND - 82, 50, 36, '#ffcc33', '#e0a91a');
  g.fillStyle = '#7a4b00'; g.font = `bold 14px ${FONT}`; g.textAlign = 'center';
  g.fillText('外卖', 1195, GROUND - 18);

  // roof floor
  const floor = g.createLinearGradient(0, GROUND, 0, H);
  floor.addColorStop(0, '#3b4058'); floor.addColorStop(1, '#14161f');
  g.fillStyle = floor; g.fillRect(0, GROUND, W, H - GROUND);
  perspectiveGrid(g, 'rgba(180,200,255,.09)');
  g.fillStyle = 'rgba(160,190,255,.25)'; g.fillRect(0, GROUND, W, 2);
  return c;
}

function drawRooftop(ctx, frame, sx, sy) {
  // searchlights
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  for (const [bx, speed, phase] of [[300, 0.011, 0], [980, 0.008, 2]]) {
    const a = -Math.PI / 2 + Math.sin(frame * speed + phase) * 0.55;
    const g = ctx.createLinearGradient(bx, GROUND - 70, bx + Math.cos(a) * 700, GROUND - 70 + Math.sin(a) * 700);
    g.addColorStop(0, 'rgba(180,210,255,.22)'); g.addColorStop(1, 'rgba(180,210,255,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(bx + sx * 0.3, GROUND - 70);
    ctx.lineTo(bx + Math.cos(a - 0.06) * 800, GROUND - 70 + Math.sin(a - 0.06) * 800);
    ctx.lineTo(bx + Math.cos(a + 0.06) * 800, GROUND - 70 + Math.sin(a + 0.06) * 800);
    ctx.closePath(); ctx.fill();
  }
  ctx.restore();
  // billboard neon
  const flick = (frame % 300) < 6 ? 0.3 : 1;
  ctx.save();
  ctx.translate(sx * 0.5, sy * 0.5);
  ctx.textAlign = 'center';
  ctx.shadowColor = '#ffcc33'; ctx.shadowBlur = 24 * flick;
  ctx.font = `900 50px ${FONT}`;
  ctx.fillStyle = `rgba(255,214,80,${flick})`;
  ctx.fillText('准时达', 265, 278);
  ctx.shadowColor = '#5ef0ff'; ctx.shadowBlur = 14;
  ctx.font = `800 20px ${FONT}`;
  ctx.fillStyle = 'rgba(140,240,255,.95)';
  ctx.fillText('ON-TIME DELIVERY · 30 MIN', 265, 318);
  ctx.restore();
  // blinking aircraft lights
  if (frame % 90 < 45) {
    ctx.fillStyle = '#ff3030';
    ctx.beginPath(); ctx.arc(1075 + sx * 0.5, 172 + sy * 0.5, 4, 0, Math.PI * 2); ctx.fill();
  }
  // a delivery drone drifting across
  const dx = ((frame * 0.8) % (W + 300)) - 150;
  const dy = 150 + Math.sin(frame * 0.04) * 12;
  ctx.fillStyle = '#0d1020';
  ctx.fillRect(dx - 18, dy, 36, 8);
  ctx.fillRect(dx - 30, dy - 4, 16, 3); ctx.fillRect(dx + 14, dy - 4, 16, 3);
  ctx.fillStyle = frame % 20 < 10 ? '#5ef0ff' : '#ffcc33';
  ctx.fillRect(dx - 2, dy + 8, 4, 3);
}

/* ======================================================================== temple */
function buildTemple() {
  const [c, g] = canvas();
  const r = seeded(99);
  const sky = g.createLinearGradient(0, 0, 0, GROUND);
  sky.addColorStop(0, '#2a0b1e'); sky.addColorStop(0.45, '#7a1f2c'); sky.addColorStop(0.8, '#d0622a'); sky.addColorStop(1, '#f2a33a');
  g.fillStyle = sky; g.fillRect(0, 0, W, GROUND);

  // distant mountains
  g.fillStyle = 'rgba(70,15,30,.55)';
  g.beginPath(); g.moveTo(0, GROUND - 160);
  for (let x = 0; x <= W; x += 40) g.lineTo(x, GROUND - 170 - Math.sin(x * 0.006) * 60 - r() * 20);
  g.lineTo(W, GROUND); g.lineTo(0, GROUND); g.closePath(); g.fill();

  // giant golden meme statue (round head, round belly), with halo
  const cx = 640, cy = 330;
  const halo = g.createRadialGradient(cx, cy - 60, 40, cx, cy - 60, 280);
  halo.addColorStop(0, 'rgba(255,230,140,.6)'); halo.addColorStop(0.5, 'rgba(255,190,80,.18)'); halo.addColorStop(1, 'rgba(255,160,60,0)');
  g.fillStyle = halo; g.fillRect(cx - 300, cy - 340, 600, 600);
  const gold = g.createLinearGradient(cx - 200, 0, cx + 200, 0);
  gold.addColorStop(0, '#8a5a10'); gold.addColorStop(0.45, '#e8b84a'); gold.addColorStop(0.55, '#ffd877'); gold.addColorStop(1, '#8a5a10');
  g.fillStyle = gold;
  g.beginPath(); g.ellipse(cx, cy + 120, 190, 170, 0, 0, Math.PI * 2); g.fill();     // body
  g.beginPath(); g.ellipse(cx, cy - 70, 120, 100, 0, 0, Math.PI * 2); g.fill();      // head
  g.fillStyle = 'rgba(80,40,0,.45)';
  g.beginPath(); g.ellipse(cx - 42, cy - 80, 14, 18, 0, 0, Math.PI * 2); g.fill();
  g.beginPath(); g.ellipse(cx + 42, cy - 80, 14, 18, 0, 0, Math.PI * 2); g.fill();
  g.lineWidth = 8; g.strokeStyle = 'rgba(80,40,0,.45)';
  g.beginPath(); g.arc(cx, cy - 50, 40, 0.15 * Math.PI, 0.85 * Math.PI); g.stroke();
  g.fillStyle = 'rgba(255,240,200,.25)';
  g.beginPath(); g.ellipse(cx, cy + 140, 110, 100, 0, 0, Math.PI * 2); g.fill();    // belly

  // steps + platform under statue
  for (let i = 0; i < 4; i++) {
    g.fillStyle = i % 2 ? '#5a1a1a' : '#6a2020';
    g.fillRect(cx - 300 + i * 30, GROUND - 120 + i * 30, 600 - i * 60, 30);
  }

  // red pillars with gold caps
  for (const px of [120, 300, 980, 1160]) {
    const pg = g.createLinearGradient(px - 26, 0, px + 26, 0);
    pg.addColorStop(0, '#5a0f12'); pg.addColorStop(0.5, '#c8282a'); pg.addColorStop(1, '#5a0f12');
    g.fillStyle = pg; g.fillRect(px - 26, 120, 52, GROUND - 120);
    g.fillStyle = '#e8b84a'; g.fillRect(px - 34, 112, 68, 18); g.fillRect(px - 34, GROUND - 24, 68, 24);
  }
  // roof beam
  g.fillStyle = '#4a0c10'; g.fillRect(0, 80, W, 40);
  g.fillStyle = '#e8b84a'; g.fillRect(0, 116, W, 6);
  for (let x = 20; x < W; x += 60) { g.fillStyle = '#7a1418'; g.fillRect(x, 86, 40, 26); }

  // floor: stone tiles
  const floor = g.createLinearGradient(0, GROUND, 0, H);
  floor.addColorStop(0, '#6a3a2a'); floor.addColorStop(1, '#22100c');
  g.fillStyle = floor; g.fillRect(0, GROUND, W, H - GROUND);
  perspectiveGrid(g, 'rgba(255,210,140,.12)');
  g.fillStyle = '#e8b84a'; g.fillRect(0, GROUND, W, 3);
  return c;
}

function drawTemple(ctx, frame, sx, sy) {
  // hanging banners
  ctx.save();
  ctx.translate(sx * 0.6, sy * 0.6);
  for (const [bx, ch] of [[210, '梗'], [1070, '王']]) {
    const sway = Math.sin(frame * 0.02 + bx) * 3;
    ctx.save();
    ctx.translate(bx, 122);
    ctx.rotate(sway * 0.01);
    ctx.fillStyle = '#b81e24'; ctx.fillRect(-34, 0, 68, 210);
    ctx.beginPath(); ctx.moveTo(-34, 210); ctx.lineTo(0, 240); ctx.lineTo(34, 210); ctx.fill();
    ctx.strokeStyle = '#e8b84a'; ctx.lineWidth = 3; ctx.strokeRect(-28, 6, 56, 196);
    ctx.font = `900 46px ${FONT}`; ctx.textAlign = 'center'; ctx.fillStyle = '#ffd877';
    ctx.fillText(ch, 0, 120);
    ctx.restore();
  }
  ctx.restore();
  // halo pulse
  const pulse = 0.12 + Math.sin(frame * 0.05) * 0.06;
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  const g = ctx.createRadialGradient(640, 270, 20, 640, 270, 220);
  g.addColorStop(0, `rgba(255,220,130,${pulse})`); g.addColorStop(1, 'rgba(255,200,100,0)');
  ctx.fillStyle = g; ctx.fillRect(400, 40, 480, 480);
  // incense smoke + floating sparkles
  for (let i = 0; i < 18; i++) {
    const t = (frame * 0.6 + i * 37) % 360;
    const x = 640 + Math.sin((frame + i * 50) * 0.02) * 30 + (i % 2 ? 260 : -260);
    const y = GROUND - 130 - t;
    ctx.fillStyle = `rgba(255,230,190,${0.12 * (1 - t / 360)})`;
    ctx.beginPath(); ctx.arc(x, y, 10 + t * 0.06, 0, Math.PI * 2); ctx.fill();
  }
  for (let i = 0; i < 24; i++) {
    const t = (frame * 0.4 + i * 53) % 600;
    const x = (i * 97 + Math.sin((frame + i * 30) * 0.015) * 40) % W;
    const y = H - t * 1.1;
    ctx.fillStyle = `rgba(255,220,120,${0.6 * Math.sin(t / 600 * Math.PI)})`;
    ctx.fillRect(x, y, 3, 3);
  }
  ctx.restore();
}

/* ======================================================================== shared */
function perspectiveGrid(g, color) {
  g.strokeStyle = color; g.lineWidth = 2;
  for (let i = -20; i <= 20; i++) { g.beginPath(); g.moveTo(W / 2 + i * 40, GROUND); g.lineTo(W / 2 + i * 140, H); g.stroke(); }
  for (let y = GROUND + 12, s = 10; y < H; y += s, s *= 1.5) { g.beginPath(); g.moveTo(0, y); g.lineTo(W, y); g.stroke(); }
}

function neonText(ctx, x, y, text, sub, glow, fill, flick) {
  ctx.save();
  ctx.translate(x, y);
  ctx.font = `bold 54px ${FONT}`; ctx.textAlign = 'center';
  ctx.shadowColor = glow; ctx.shadowBlur = 28 * flick;
  ctx.fillStyle = `${fill}${0.9 * flick})`;
  ctx.fillText(text, 0, 0);
  ctx.shadowColor = '#59e1ff'; ctx.shadowBlur = 18;
  ctx.font = 'bold 18px system-ui, sans-serif';
  ctx.fillStyle = 'rgba(140,235,255,.9)';
  ctx.fillText(sub, 0, 34);
  ctx.restore();
}

function lanterns(ctx, frame, sx, sy) {
  ctx.save();
  ctx.strokeStyle = 'rgba(30,15,20,.9)'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(0, 210); ctx.quadraticCurveTo(640, 290, 1280, 210); ctx.stroke();
  for (let i = 0; i < 11; i++) {
    const t = (i + 0.5) / 11;
    const x = t * 1280, y = 210 + 4 * t * (1 - t) * 80;
    const sway = Math.sin(frame * 0.03 + i) * 4;
    ctx.save();
    ctx.translate(x + sx * 0.7, y + sy * 0.7);
    ctx.rotate(sway * 0.02);
    const glow = ctx.createRadialGradient(0, 22, 2, 0, 22, 50);
    glow.addColorStop(0, 'rgba(255,120,60,.45)'); glow.addColorStop(1, 'rgba(255,80,40,0)');
    ctx.fillStyle = glow; ctx.fillRect(-50, -28, 100, 100);
    ctx.fillStyle = i % 2 ? '#e8432f' : '#f0a12a';
    ctx.beginPath(); ctx.ellipse(0, 22, 14, 18, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#3a1a10'; ctx.fillRect(-6, 2, 12, 4); ctx.fillRect(-6, 38, 12, 4);
    ctx.restore();
  }
  ctx.restore();
}

const BUILDERS = { market: buildMarket, rooftop: buildRooftop, temple: buildTemple };
const ANIMATORS = { market: drawMarket, rooftop: drawRooftop, temple: drawTemple };

export function drawStage(ctx, id, frame, sx = 0, sy = 0) {
  if (!BUILDERS[id]) id = 'market';
  if (!cache[id]) cache[id] = BUILDERS[id]();
  ctx.drawImage(cache[id], sx * 0.5, sy * 0.5);
  ANIMATORS[id](ctx, frame, sx, sy);
}

/* Small preview image for the stage-select screen. */
export function stageThumb(id, w = 320, h = 180) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const g = c.getContext('2d');
  g.scale(w / W, h / H);
  drawStage(g, id, 120);
  return c.toDataURL('image/jpeg', 0.8);
}
