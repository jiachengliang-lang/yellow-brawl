/* Built-in vector fighters, used whenever a character's sprite sheets aren't present.
 * Each animation clip maps to a pose function; the fighter is assembled from simple
 * shapes (body, belly, head, limbs) so the game is fully playable with no image files.
 */

const STYLES = {
  naiwa: {
    h: 250, w: 150, body: '#ffd42a', belly: '#fff3c4', limb: '#f4c418', line: '#5c4400',
    head: 'frog', headR: 52, legLen: 62, armLen: 70
  },
  kangaroo: {
    h: 268, w: 116, body: '#d8a25a', belly: '#f6e4c4', limb: '#cf9548', line: '#4a2e0c',
    head: 'roo', headR: 42, legLen: 74, armLen: 74, gloves: '#d8262c', tail: true
  },
  chick: {
    h: 245, w: 118, body: '#ffd84a', belly: '#eef2f6', limb: '#f2c12a', line: '#4a3a10',
    head: 'chick', headR: 46, legLen: 58, armLen: 64, coat: '#e9eef4'
  }
};

const lerp = (a, b, k) => a + (b - a) * k;
const wind = (p, peak = 0.45) => (p < 0.25 ? -0.3 * (p / 0.25) : p < peak ? lerp(-0.3, 1, (p - 0.25) / (peak - 0.25)) : lerp(1, 0.15, (p - peak) / (1 - peak)));

/* Pose = how the body parts are arranged for one frame. Angles in radians, 0 = forward. */
function basePose() {
  return {
    lean: 0, bob: 0, crouch: 0, rot: 0, lift: 0, fwd: 0, flip: false, belly: 0,
    armF: [0.6, 0.35], armB: [0.9, 0.3],            // [angle, extension 0..1+]
    legF: 0.12, legB: -0.12,                          // leg angles from vertical
    eyes: 'open', mouth: 'smile', glow: 0, scooter: false, gloves: false, carry: null
  };
}

function pose(name, p, t, id) {
  const q = basePose();
  const s = Math.sin;
  const guard = () => { q.armF = [-0.5, 0.45]; q.armB = [-0.2, 0.3]; };
  const punch = (alt = false, power = 1) => {
    const e = wind(p);
    guard();
    q.lean = 0.12 * e * power;
    q.fwd = 10 * e * power;
    if (alt) q.armB = [-0.1, 0.3 + 0.9 * Math.max(0, e)];
    else q.armF = [-0.15, 0.4 + 0.9 * Math.max(0, e) * power];
  };
  const kick = (low = false) => {
    const e = Math.max(0, wind(p));
    guard();
    q.lean = -0.25 * e;
    if (low) { q.crouch = 0.55; q.legF = lerp(0.2, 1.45, e); }
    else q.legF = lerp(0.1, 1.5, e);
  };
  switch (name) {
    case 'idle': case 'boxIdle':
      guard(); q.bob = s(t * 0.35) * 3; q.gloves = id === 'kangaroo'; break;
    case 'walk': case 'walkSlow': case 'walkFast': case 'run':
      guard(); q.legF = s(t * 0.5) * 0.45; q.legB = -q.legF; q.bob = Math.abs(s(t * 0.5)) * -5;
      if (name === 'run') { q.lean = 0.25; q.armF = [0.2, 0.8]; q.carry = id === 'chick' ? 'ball' : null; }
      break;
    case 'crouch': q.crouch = 0.55; guard(); break;
    case 'block': case 'shield':
      if (id === 'chick') { q.crouch = 0.4; q.eyes = 'closed'; q.armF = [1.3, 0.25]; q.armB = [1.3, 0.25]; break; }
      q.armF = [-1.25, 0.32]; q.armB = [-1.1, 0.3]; q.lean = -0.08; q.gloves = id === 'kangaroo'; break;
    case 'jump':
      q.legF = 0.9; q.legB = 0.5; q.crouch = 0.15; q.armF = [-1.2, 0.6]; q.armB = [-1.0, 0.6]; break;
    case 'hurt':
      q.lean = -0.3 * s(Math.min(1, p * 2) * Math.PI); q.eyes = 'x'; q.mouth = 'ouch'; q.armF = [-1.6, 0.6]; q.armB = [1.4, 0.5]; q.fwd = -10; break;
    case 'ko':
      q.rot = -Math.min(1, p * 1.6) * Math.PI / 2; q.eyes = 'x'; q.mouth = 'ouch'; q.armF = [-1.8, 0.7]; q.armB = [-1.4, 0.7]; q.legF = 0.6; break;
    case 'laugh':
      q.bob = s(t * 0.9) * 4; q.mouth = 'open'; q.eyes = 'closed'; q.armF = [1.2, 0.2]; q.armB = [1.2, 0.2]; q.lean = -0.1; break;
    case 'taunt': case 'drink': case 'rally':
      q.armF = [-1.3, 0.7]; q.armB = [0.9, 0.3]; q.bob = s(t * 0.25) * 4; q.mouth = 'open';
      q.carry = id === 'kangaroo' ? 'milk' : null; break;
    case 'win':
      q.armF = [-2.2, 0.9]; q.armB = [-2.0, 0.9]; q.bob = -Math.abs(s(t * 0.3)) * 10; q.mouth = 'open'; q.gloves = true; break;

    // punches
    case 'lightL': case 'punchL': case 'atk5': punch(false, 0.9); break;
    case 'lightR': case 'punchR': punch(true, 0.9); break;
    case 'punchLR': punch(p > 0.5, 1); break;
    case 'heavy': case 'heavy1': case 'heavy3':
      punch(false, 1.25); q.lean = 0.2 * Math.max(0, wind(p)); q.gloves = id === 'kangaroo'; break;
    case 'flurry': case 'gloveCombo': case 'heavy4':
      guard(); q.fwd = 6; q.lean = 0.1;
      if ((t >> 1) % 2) q.armF = [-0.15, 1.25]; else q.armB = [-0.05, 1.2];
      q.gloves = id === 'kangaroo'; break;
    case 'dashPunch': {
      const e = Math.max(0, wind(p, 0.6));
      guard(); q.armF = [-0.1, 0.4 + 3 * e]; q.lean = 0.2 * e; q.gloves = true; break;
    }
    case 'crouchPunch': punch(false, 0.9); q.crouch = 0.5; break;

    // kicks / low attacks
    case 'kick': kick(false); break;
    case 'knee': kick(false); q.legF = lerp(0.1, 1.0, Math.max(0, wind(p))); break;
    case 'crouchKick': case 'crouchAttack': kick(true); break;

    // body moves
    case 'belly': case 'bellyCombo': {
      const e = wind(p, 0.5);
      q.belly = Math.max(0, e); q.lean = -0.25 * Math.max(0, e); q.fwd = 30 * e; q.armF = [0.9, 0.2]; q.armB = [0.9, 0.2]; q.mouth = 'open'; break;
    }
    case 'whirl': case 'atk1':
      q.flip = (t >> 2) % 2 === 1; q.armF = [-0.1, 1]; q.armB = [-0.1, 1]; q.bob = -6; break;
    case 'atk4': {     // jumping press
      const up = s(Math.min(1, p) * Math.PI);
      q.lift = up * 70; q.armF = [-2.3, 0.9]; q.armB = [-2.1, 0.9]; q.legF = 0.6; q.legB = 0.4; break;
    }
    case 'atk6':       // dribble
      punch(false, 0.8); q.crouch = 0.25; q.carry = 'ball'; break;
    case 'atk2':       // dab
      q.armF = [-0.7, 1]; q.armB = [-1.4, 0.4]; q.lean = 0.1; q.eyes = 'closed'; break;
    case 'atk3':       // arm swing
      q.armF = [lerp(1.2, -0.9, Math.min(1, p * 1.6)), 0.9]; q.lean = 0.1; break;
    case 'atk7':       // singing
      q.armF = [-2.4, 0.35]; q.armB = [-2.3, 0.35]; q.mouth = 'open'; q.bob = s(t * 0.6) * 3; break;

    // specials
    case 'scooter':
      q.scooter = true; q.crouch = 0.35; q.lean = 0.25; q.armF = [0.1, 0.8]; q.armB = [0.2, 0.8]; q.bob = s(t * 0.8) * 2; break;
    case 'milkThrow':
      q.armF = [lerp(-2.6, 0.2, Math.min(1, p * 1.5)), 0.95]; q.lean = 0.12 * p; q.carry = p < 0.5 ? 'milk' : null; break;
    case 'superPress':
      q.armF = [0.3, 0.6]; q.glow = 0.4 + 0.4 * s(t * 0.4); q.mouth = 'open'; break;
    case 'superMilk':
      q.armF = [lerp(-2.4, 0.1, (t % 12) / 12), 0.95]; q.armB = [-1.0, 0.6]; q.glow = 0.6; break;
    case 'superStart':
      q.crouch = 0.45; q.lift = 30 + s(t * 0.15) * 6; q.eyes = 'closed'; q.armF = [1.1, 0.3]; q.armB = [1.1, 0.3]; q.glow = 0.7; break;
    case 'stun':
      q.eyes = 'x'; q.bob = s(t * 0.3) * 3; q.lean = s(t * 0.2) * 0.1; break;
    default:
      guard();
  }
  return q;
}

/* ------------------------------------------------------------ drawing */
function limb(ctx, x1, y1, x2, y2, w, color, line) {
  ctx.lineCap = 'round';
  ctx.strokeStyle = line; ctx.lineWidth = w + 6;
  ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
  ctx.strokeStyle = color; ctx.lineWidth = w;
  ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
}

function blob(ctx, x, y, rx, ry, fill, line, lw = 4) {
  ctx.beginPath(); ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
  ctx.fillStyle = fill; ctx.fill();
  if (line) { ctx.lineWidth = lw; ctx.strokeStyle = line; ctx.stroke(); }
}

function drawEyes(ctx, S, q, hx, hy, r) {
  const eye = (ex, ey, er) => {
    if (q.eyes === 'closed') {
      ctx.strokeStyle = S.line; ctx.lineWidth = 4;
      ctx.beginPath(); ctx.arc(ex, ey + 2, er * 0.7, Math.PI * 1.1, Math.PI * 1.9); ctx.stroke();
    } else if (q.eyes === 'x') {
      ctx.strokeStyle = S.line; ctx.lineWidth = 4;
      ctx.beginPath(); ctx.moveTo(ex - er * .6, ey - er * .6); ctx.lineTo(ex + er * .6, ey + er * .6);
      ctx.moveTo(ex + er * .6, ey - er * .6); ctx.lineTo(ex - er * .6, ey + er * .6); ctx.stroke();
    } else {
      blob(ctx, ex, ey, er, er, '#fff', S.line, 3);
      blob(ctx, ex + er * 0.3, ey, er * 0.48, er * 0.55, '#1a1208');
    }
  };
  if (S.head === 'frog') { eye(hx - r * 0.1, hy - r * 0.62, r * 0.32); eye(hx + r * 0.55, hy - r * 0.5, r * 0.3); }
  else { eye(hx + r * 0.05, hy - r * 0.15, r * 0.22); eye(hx + r * 0.55, hy - r * 0.12, r * 0.2); }
}

function drawMouth(ctx, S, q, x, y, r) {
  ctx.strokeStyle = S.line; ctx.lineWidth = 4;
  if (q.mouth === 'open') {
    blob(ctx, x, y, r * 0.28, r * 0.2, '#7a1e1e', S.line, 3);
  } else if (q.mouth === 'ouch') {
    ctx.beginPath(); ctx.moveTo(x - r * .25, y); ctx.lineTo(x - r * .08, y - 5); ctx.lineTo(x + r * .08, y + 3); ctx.lineTo(x + r * .25, y - 3); ctx.stroke();
  } else {
    ctx.beginPath(); ctx.arc(x, y - r * 0.15, r * 0.3, 0.2 * Math.PI, 0.8 * Math.PI); ctx.stroke();
  }
}

function drawHead(ctx, S, q, hx, hy) {
  const r = S.headR;
  if (S.head === 'roo') {
    // ears, snout
    for (const [ex, tilt] of [[-12, -0.25], [12, 0.15]]) {
      ctx.save(); ctx.translate(hx + ex, hy - r * 0.7); ctx.rotate(tilt);
      blob(ctx, 0, -r * 0.55, r * 0.26, r * 0.62, S.body, S.line, 4);
      blob(ctx, 0, -r * 0.5, r * 0.12, r * 0.42, '#f2c6a0');
      ctx.restore();
    }
    blob(ctx, hx, hy, r, r * 0.92, S.body, S.line);
    blob(ctx, hx + r * 0.72, hy + r * 0.25, r * 0.48, r * 0.36, S.belly, S.line, 3);
    blob(ctx, hx + r * 1.08, hy + r * 0.12, r * 0.14, r * 0.12, '#3a1a0a');
    drawEyes(ctx, S, q, hx, hy, r);
    drawMouth(ctx, S, q, hx + r * 0.75, hy + r * 0.5, r);
    return;
  }
  if (S.head === 'chick') {
    blob(ctx, hx, hy, r, r * 0.95, S.body, S.line);
    // fluffy grey wig
    ctx.fillStyle = '#a3abb5'; ctx.strokeStyle = S.line; ctx.lineWidth = 3;
    for (let i = -3; i <= 3; i++) {
      ctx.beginPath(); ctx.arc(hx + i * r * 0.26, hy - r * 0.72 + Math.abs(i) * 4, r * 0.32, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    }
    drawEyes(ctx, S, q, hx, hy + 4, r);
    ctx.fillStyle = '#ff8a1a';
    ctx.beginPath(); ctx.moveTo(hx + r * 0.75, hy + r * 0.12); ctx.lineTo(hx + r * 1.2, hy + r * 0.28); ctx.lineTo(hx + r * 0.75, hy + r * 0.44); ctx.closePath(); ctx.fill();
    ctx.stroke();
    if (q.mouth === 'open') blob(ctx, hx + r * 0.85, hy + r * 0.3, r * 0.12, r * 0.1, '#7a1e1e');
    return;
  }
  // frog
  blob(ctx, hx, hy, r * 1.05, r * 0.85, S.body, S.line);
  drawEyes(ctx, S, q, hx, hy, r);
  drawMouth(ctx, S, q, hx + r * 0.35, hy + r * 0.35, r * 1.4);
  blob(ctx, hx + r * 0.62, hy + r * 0.12, r * 0.14, r * 0.08, '#ffb0a0');
}

function drawProp(ctx, kind, x, y) {
  if (kind === 'ball') drawBallProp(ctx, x, y, 18);
  if (kind === 'milk') drawCarton(ctx, x, y, 0.8, 0);
}

export function drawBallProp(ctx, x, y, r) {
  blob(ctx, x, y, r, r, '#e06a1a', '#3a1500', 2);
  ctx.strokeStyle = '#3a1500'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(x - r, y); ctx.lineTo(x + r, y); ctx.moveTo(x, y - r); ctx.lineTo(x, y + r); ctx.stroke();
}

export function drawCarton(ctx, x, y, scale = 1, angle = 0) {
  ctx.save();
  ctx.translate(x, y); ctx.rotate(angle); ctx.scale(scale, scale);
  ctx.fillStyle = '#f7f7f2'; ctx.strokeStyle = '#2a3a5a'; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.moveTo(-20, -18); ctx.lineTo(0, -34); ctx.lineTo(20, -18); ctx.lineTo(20, 30); ctx.lineTo(-20, 30); ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#3d7ad6'; ctx.fillRect(-18, -2, 36, 18);
  ctx.fillStyle = '#fff'; ctx.font = 'bold 11px sans-serif'; ctx.textAlign = 'center'; ctx.fillText('MILK', 0, 12);
  ctx.restore();
}

/**
 * Draw a fighter frame with its feet at (x, footY).
 * clipName/frames/frame come from the sprite clip so poses line up with move timing.
 */
export function drawPlaceholderFighter(ctx, id, clipName, frame, frames, x, footY, facing, opts = {}) {
  const S = STYLES[id] || STYLES.naiwa;
  const p = frames > 1 ? frame / (frames - 1) : 0;
  const q = pose(clipName, p, frame, id);
  const scale = opts.scale ?? 1;
  ctx.save();
  if (opts.alpha != null) ctx.globalAlpha = opts.alpha;
  if (opts.filter) ctx.filter = opts.filter;
  ctx.translate(x, footY);
  ctx.scale(scale * (q.flip ? -facing : facing), scale);
  ctx.translate(q.fwd, -q.lift + q.bob);

  const crouch = q.crouch;
  const legLen = S.legLen * (1 - crouch * 0.45);
  const hipY = -legLen - 6;
  const bodyH = (S.h - S.legLen - S.headR * 1.3) * (1 - crouch * 0.25);
  const bodyCY = hipY - bodyH * 0.45;

  if (q.rot) {
    // knocked down: pivot around the feet, falling backwards
    ctx.translate(-20, 0);
    ctx.rotate(q.rot);
  }
  if (q.glow) {
    const g = ctx.createRadialGradient(0, bodyCY, 10, 0, bodyCY, S.h * 0.7);
    g.addColorStop(0, `rgba(255,230,120,${0.45 * q.glow})`); g.addColorStop(1, 'rgba(255,200,80,0)');
    ctx.fillStyle = g; ctx.fillRect(-S.h, bodyCY - S.h, S.h * 2, S.h * 2);
  }
  if (q.scooter) {
    ctx.fillStyle = '#ffcc33'; ctx.strokeStyle = '#3a2a00'; ctx.lineWidth = 4;
    ctx.fillRect(-70, -40, 140, 18); ctx.strokeRect(-70, -40, 140, 18);
    ctx.fillRect(48, -110, 10, 75);
    blob(ctx, -52, -14, 16, 16, '#222', '#000', 3); blob(ctx, 52, -14, 16, 16, '#222', '#000', 3);
    ctx.fillStyle = '#d33'; ctx.fillRect(-72, -70, 34, 28);
  }

  ctx.save();
  ctx.translate(0, hipY);
  ctx.rotate(q.lean);
  ctx.translate(0, -hipY);

  const shoulderY = bodyCY - bodyH * 0.32;
  const arm = (a, side, color) => {
    const len = S.armLen * (0.55 + 0.6 * a[1]);
    const sx = side * S.w * 0.18;
    const ex = sx + Math.cos(a[0]) * len;
    const ey = shoulderY + Math.sin(a[0]) * len;
    limb(ctx, sx, shoulderY, ex, ey, 20, color, S.line);
    const fist = q.gloves && S.gloves ? S.gloves : S.limb;
    blob(ctx, ex, ey, q.gloves && S.gloves ? 17 : 12, q.gloves && S.gloves ? 15 : 12, fist, S.line, 3);
    return [ex, ey];
  };

  // back limbs
  if (S.tail) limb(ctx, -S.w * 0.35, hipY - 10, -S.w * 0.95, -8, 22, S.body, S.line);
  arm(q.armB, -1, S.limb);
  limb(ctx, -S.w * 0.18, hipY, -S.w * 0.18 + Math.sin(q.legB) * legLen, hipY + Math.cos(q.legB) * legLen, 24, S.limb, S.line);

  // body
  const bw = S.w * 0.5 * (1 + crouch * 0.12) * (1 + q.belly * 0.15);
  blob(ctx, 0, bodyCY, bw, bodyH * 0.58, S.coat || S.body, S.line);
  if (S.coat) { // lab coat + yellow body peeking out
    blob(ctx, bw * 0.25, bodyCY + 6, bw * 0.38, bodyH * 0.42, S.body, S.line, 3);
    ctx.fillStyle = '#222'; ctx.fillRect(bw * 0.1, bodyCY - bodyH * 0.45, bw * 0.3, 14);
  } else {
    blob(ctx, bw * 0.28 + q.belly * 18, bodyCY + bodyH * 0.06, bw * (0.62 + q.belly * 0.2), bodyH * 0.42, S.belly, null);
  }

  // front leg
  const fx = S.w * 0.18 + Math.sin(q.legF) * legLen;
  const fy = hipY + Math.cos(q.legF) * legLen;
  limb(ctx, S.w * 0.18, hipY, fx, fy, 26, S.limb, S.line);
  blob(ctx, fx + 8, fy, 18, 9, S.limb, S.line, 3);
  blob(ctx, -S.w * 0.18 + Math.sin(q.legB) * legLen + 8, hipY + Math.cos(q.legB) * legLen, 18, 9, S.limb, S.line, 3);

  // head
  const headY = bodyCY - bodyH * 0.58 - S.headR * 0.55;
  drawHead(ctx, S, q, S.w * 0.08, headY);

  // front arm (+ held prop)
  const [hx, hy] = arm(q.armF, 1, S.limb);
  if (q.carry) drawProp(ctx, q.carry, hx + 10, hy - 6);
  ctx.restore();
  ctx.restore();
}

/* Static images for menus/HUD (portrait circle, select card, title stand). */
export function placeholderImage(id, kind) {
  const S = STYLES[id] || STYLES.naiwa;
  const size = { portrait: [420, 420], card: [800, 1000], stand: [360, 720] }[kind];
  const c = document.createElement('canvas');
  [c.width, c.height] = size;
  const g = c.getContext('2d');
  if (kind === 'portrait') {
    const bg = g.createRadialGradient(210, 200, 20, 210, 210, 230);
    bg.addColorStop(0, '#3a2a58'); bg.addColorStop(1, '#140c22');
    g.fillStyle = bg; g.fillRect(0, 0, 420, 420);
    drawPlaceholderFighter(g, id, 'idle', 0, 1, 190, 640, 1, { scale: 2.0 });
  } else if (kind === 'card') {
    drawPlaceholderFighter(g, id, id === 'naiwa' ? 'laugh' : 'win', 3, 12, 400, 960, 1, { scale: 3.0 });
  } else {
    drawPlaceholderFighter(g, id, 'idle', 0, 1, 180, 700, 1, { scale: 2.3 });
  }
  return c.toDataURL('image/png');
}

/* Projectiles whose sprite sheets are missing. (x, footY) matches drawClip's anchor. */
export function drawPlaceholderProjectile(ctx, name, frame, x, footY, facing) {
  ctx.save();
  if (name === 'orb') {
    const y = footY - 48, r = 34 + Math.sin(frame) * 2;
    blob(ctx, x, y, r, r, '#ffd42a', '#5c4400', 4);
    ctx.strokeStyle = '#5c4400'; ctx.lineWidth = 4;
    ctx.beginPath(); ctx.arc(x - 11, y - 6, 6, Math.PI * 1.1, Math.PI * 1.9); ctx.stroke();
    ctx.beginPath(); ctx.arc(x + 11, y - 6, 6, Math.PI * 1.1, Math.PI * 1.9); ctx.stroke();
    blob(ctx, x, y + 10, 14, 10, '#7a1e1e', '#5c4400', 3);
  } else if (name === 'chicken') {
    ctx.translate(x, footY - 40);
    ctx.scale(facing, 1);
    const step = Math.sin(frame * 1.2) * 0.5;
    limb(ctx, -6, 18, -6 - step * 14, 40, 5, '#e0a020', '#5a3a00');
    limb(ctx, 8, 18, 8 + step * 14, 40, 5, '#e0a020', '#5a3a00');
    blob(ctx, 0, 0, 34, 26, '#8a3a1a', '#2a1000', 3);
    blob(ctx, -30, -10, 14, 22, '#3a2a10', '#2a1000', 3);      // tail
    blob(ctx, 26, -22, 15, 15, '#8a3a1a', '#2a1000', 3);       // head
    blob(ctx, 26, -38, 8, 6, '#e0201a');                       // comb
    ctx.fillStyle = '#f2b01a';
    ctx.beginPath(); ctx.moveTo(38, -24); ctx.lineTo(50, -20); ctx.lineTo(38, -16); ctx.fill();
    blob(ctx, 30, -24, 3, 3, '#000');
  }
  ctx.restore();
}
