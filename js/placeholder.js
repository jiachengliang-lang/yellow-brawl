/* Built-in vector fighters, used whenever a character's sprite sheets aren't present.
 *
 * Each fighter is a small 2D skeleton (hips, torso, head, two-segment arms and legs).
 * Every animation clip maps to a pose: hand/foot targets plus torso lean, squash and a
 * facial expression. Limbs are solved with two-bone IK, then drawn with shading and
 * outlines, so all moves read clearly without any image files.
 */

const STYLES = {
  naiwa: {
    base: '#ffd23a', light: '#fff3a6', dark: '#d99a0c', line: '#4d3300',
    belly: '#fff6d6', limb: '#f7c51f', blush: 'rgba(255,120,110,.45)',
    legU: 34, legL: 32, armU: 34, armL: 34, limbW: 22, legW: 26,
    hipY: 62, torsoH: 118, torsoTop: 104, torsoBot: 158, headR: 50, headDY: -6, head: 'frog'
  },
  kangaroo: {
    base: '#d89d55', light: '#f6cf93', dark: '#a56b28', line: '#3f2408',
    belly: '#f8e7c9', limb: '#cf914a', blush: 'rgba(255,120,100,.35)',
    legU: 40, legL: 42, armU: 36, armL: 36, limbW: 18, legW: 22,
    hipY: 78, torsoH: 104, torsoTop: 82, torsoBot: 112, headR: 38, headDY: 34, head: 'roo',
    gloves: ['#ff5a52', '#d4161f', '#6a0008'], tail: true
  },
  chick: {
    base: '#ffd84a', light: '#fff2a0', dark: '#e0a815', line: '#3d2f08',
    belly: '#f4f6fa', limb: '#ffcf33', blush: 'rgba(255,120,120,.5)',
    legU: 28, legL: 28, armU: 30, armL: 30, limbW: 17, legW: 12, legColor: '#f29a1a',
    hipY: 54, torsoH: 108, torsoTop: 90, torsoBot: 120, headR: 46, headDY: 6, head: 'chick', coat: true
  }
};

/* ------------------------------------------------------------------ easing */
const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));
const lerp = (a, b, k) => a + (b - a) * k;
const ease = (k) => k * k * (3 - 2 * k);
/* attack curve: wind-up (negative), snap out to 1, ease back. */
function strike(p, windEnd = 0.28, peakEnd = 0.55) {
  if (p < windEnd) return -0.35 * ease(p / windEnd);
  if (p < windEnd + 0.08) return lerp(-0.35, 1, (p - windEnd) / 0.08);
  if (p < peakEnd) return 1;
  return lerp(1, 0.1, ease((p - peakEnd) / (1 - peakEnd)));
}

/* ------------------------------------------------------------------ poses */
function basePose(S) {
  const reach = S.armU + S.armL;
  return {
    hipDrop: 4, lean: 0, bodyX: 0, lift: 0, rot: 0, flip: false, squash: 1, belly: 0, headTilt: 0,
    handF: { x: reach * 0.55, y: 18 }, handB: { x: reach * 0.4, y: 26 },
    footF: { x: 20, y: 0 }, footB: { x: -18, y: 0 },
    face: 'neutral', gloves: false, prop: null, smear: 0, scooter: false, glow: 0, wings: false
  };
}

function pose(id, name, p, t, state) {
  const S = STYLES[id];
  const q = basePose(S);
  const R = S.armU + S.armL;
  const L = S.legU + S.legL;
  const sin = Math.sin;
  const guard = () => { q.handF = { x: R * 0.6, y: -6 }; q.handB = { x: R * 0.45, y: 4 }; };
  const breathe = (amt = 1) => { q.squash = 1 + sin(t * 0.3) * 0.02 * amt; q.lift = 0; };
  const punch = (back = false, power = 1) => {
    const e = strike(p);
    guard();
    const hand = { x: lerp(R * 0.5, R * 1.02, clamp(e, 0, 1)) + (e < 0 ? e * 30 : 0), y: lerp(-4, -10, clamp(e, 0, 1)) };
    if (back) q.handB = { x: hand.x + 10, y: hand.y }; else q.handF = hand;
    q.lean = 0.14 * e * power;
    q.bodyX = 12 * e * power;
    q.footF = { x: 26 + 8 * clamp(e, 0, 1), y: 0 };
    q.face = e > 0.2 ? 'angry' : 'neutral';
    q.smear = e > 0.6 && p < 0.6 ? (back ? -1 : 1) : 0;
  };
  const kick = (low = false) => {
    const e = strike(p, 0.3, 0.6);
    guard();
    const k = clamp(e, 0, 1);
    q.lean = -0.28 * k;
    q.face = k > 0.2 ? 'angry' : 'neutral';
    if (low) {
      q.hipDrop = L * 0.45;
      q.footF = { x: lerp(22, L * 1.55, k), y: 4 };
      q.lean = 0.05;
    } else {
      q.footF = { x: lerp(20, L * 1.2, k), y: lerp(0, L * 1.0, k) };
      q.footB = { x: -14, y: 0 };
      q.handB = { x: -R * 0.5, y: 10 };
    }
    q.smear = k > 0.8 && p < 0.62 ? 2 : 0;
  };

  switch (name) {
    case 'idle': case 'boxIdle':
      guard(); breathe();
      q.hipDrop = 6 + sin(t * 0.3) * 2;
      q.gloves = id === 'kangaroo';
      if (id === 'chick') { q.handF = { x: R * 0.6, y: 12 + sin(t * 0.5) * 10 }; q.handB = { x: R * 0.35, y: 6 - sin(t * 0.5) * 10 }; q.headTilt = sin(t * 0.25) * 0.12; }
      break;

    case 'walk': case 'walkSlow': case 'walkFast': case 'run': {
      guard();
      const ph = t * (name === 'run' ? 0.7 : 0.45);
      const stride = name === 'run' ? 34 : 24;
      q.footF = { x: 8 + sin(ph) * stride, y: Math.max(0, Math.cos(ph)) * 14 };
      q.footB = { x: -8 - sin(ph) * stride, y: Math.max(0, -Math.cos(ph)) * 14 };
      q.lift = Math.abs(sin(ph)) * 4;
      q.gloves = id === 'kangaroo';
      if (name === 'run') {
        q.lean = 0.28; q.handF = { x: R * 0.7, y: 34 }; q.prop = id === 'chick' ? 'ball' : null;
        if (id === 'chick') q.handF = { x: R * 0.75, y: 40 + Math.abs(sin(ph * 2)) * 25 };
      }
      if (state === 'dash') q.lean = 0.3;
      break;
    }

    case 'jump':
      q.footF = { x: 18, y: L * 0.55 }; q.footB = { x: -10, y: L * 0.35 };
      q.handF = { x: R * 0.4, y: -R * 0.75 }; q.handB = { x: R * 0.2, y: -R * 0.8 };
      q.face = 'shout'; break;

    case 'crouch':
      guard(); q.hipDrop = L * 0.5; q.footF = { x: 30, y: 0 }; q.footB = { x: -28, y: 0 };
      q.lean = 0.12; q.squash = 0.94; q.gloves = id === 'kangaroo'; break;

    case 'block': case 'shield':
      q.hipDrop = id === 'chick' ? L * 0.35 : 12;
      q.handF = { x: R * 0.45, y: -R * 0.55 }; q.handB = { x: R * 0.55, y: -R * 0.35 };
      q.lean = -0.1; q.face = 'grit'; q.gloves = id === 'kangaroo';
      if (id === 'chick') { q.face = 'focus'; q.handF = { x: R * 0.35, y: 22 }; q.handB = { x: R * 0.5, y: 20 }; q.lean = 0; }
      break;

    case 'hurt': case 'stun': {
      const k = sin(clamp(p * 1.4) * Math.PI);
      q.lean = -0.38 * k; q.bodyX = -14 * k; q.face = 'hurt';
      q.handF = { x: R * 0.75, y: -R * 0.55 }; q.handB = { x: -R * 0.7, y: -R * 0.35 };
      q.footF = { x: 26, y: 0 }; q.squash = 1 - 0.06 * k;
      if (name === 'stun') { q.lean = sin(t * 0.25) * 0.15; q.face = 'dizzy'; }
      break;
    }

    case 'ko': {
      const k = ease(clamp(p * 1.5));
      q.rot = -k * Math.PI / 2;
      q.face = 'hurt';
      q.handF = { x: -R * 0.2, y: -R * 0.8 }; q.handB = { x: -R * 0.6, y: -R * 0.6 };
      q.footF = { x: 30, y: k * 22 }; q.footB = { x: 6, y: k * 10 };
      if (state === 'down' || state === 'getup') q.face = 'dizzy';
      break;
    }

    case 'laugh': case 'win':
      q.face = 'happy'; q.lift = Math.abs(sin(t * 0.35)) * (name === 'win' ? 14 : 4);
      q.squash = 1 + sin(t * 0.7) * 0.04;
      if (name === 'win') { q.handF = { x: R * 0.3, y: -R * 0.95 }; q.handB = { x: R * 0.1, y: -R * 0.95 }; q.gloves = true; }
      else { q.handF = { x: R * 0.55, y: 40 }; q.handB = { x: R * 0.45, y: 44 }; q.lean = -0.12; }
      break;

    case 'taunt': case 'rally':
      breathe(2); q.face = 'happy';
      if (id === 'kangaroo') { q.handF = { x: R * 0.35, y: -R * 0.55 }; q.prop = 'milk'; q.headTilt = -0.35; q.face = 'focus'; }
      else { q.handF = { x: R * 0.6, y: -R * 0.6 + sin(t * 0.4) * 12 }; q.handB = { x: R * 0.4, y: 30 }; }
      break;

    // -------- punches
    case 'lightL': case 'punchL': case 'atk5': punch(false, 0.9); q.gloves = id === 'kangaroo' && name !== 'punchL'; break;
    case 'lightR': case 'punchR': punch(true, 0.9); break;
    case 'punchLR': punch(p > 0.5, 1); break;
    case 'heavy': case 'heavy1': case 'heavy3': {
      punch(false, 1.3);
      const e = clamp(strike(p, 0.35, 0.6), 0, 1);
      q.handF = { x: lerp(R * 0.4, R * 1.05, e), y: lerp(10, -R * (name === 'heavy3' ? 0.6 : 0.1), e) };
      q.hipDrop = 10 + 8 * e; q.gloves = id === 'kangaroo'; q.face = 'shout';
      break;
    }
    case 'flurry': case 'gloveCombo': case 'heavy4': {
      guard(); q.lean = 0.12; q.bodyX = 8; q.face = 'shout'; q.gloves = id === 'kangaroo';
      const alt = (t >> 1) % 2;
      const hit = { x: R * 1.0, y: -6 + ((t * 7) % 20) - 10 };
      if (alt) q.handF = hit; else q.handB = { x: hit.x + 8, y: hit.y + 6 };
      q.smear = alt ? 1 : -1;
      break;
    }
    case 'dashPunch': {
      const e = clamp(strike(p, 0.45, 0.7), 0, 1);
      guard(); q.handF = { x: lerp(R * 0.5, R * 3.4, e), y: -6 }; q.lean = 0.2 * e; q.gloves = true; q.face = 'shout';
      q.stretchArm = e;
      break;
    }
    case 'crouchPunch': punch(false, 0.9); q.hipDrop = L * 0.5; q.footF = { x: 30, y: 0 }; q.footB = { x: -26, y: 0 }; q.handF.y += 26; break;

    // -------- kicks / lows
    case 'kick': kick(false); break;
    case 'knee': {
      const e = clamp(strike(p, 0.25, 0.6), 0, 1);
      guard(); q.face = 'angry';
      q.footF = { x: lerp(20, 30, e), y: lerp(0, L * 0.75, e) }; q.lean = -0.1 * e; q.kneeUp = e;
      break;
    }
    case 'crouchKick': case 'crouchAttack': kick(true); q.gloves = id === 'kangaroo'; break;

    // -------- body moves
    case 'belly': case 'bellyCombo': {
      const e = strike(p, 0.32, 0.6);
      q.belly = clamp(e, 0, 1); q.lean = -0.28 * clamp(e, 0, 1) + (e < 0 ? 0.15 * -e : 0);
      q.bodyX = 34 * e; q.face = e > 0.3 ? 'shout' : 'angry';
      q.handF = { x: -R * 0.2, y: 20 }; q.handB = { x: -R * 0.35, y: 18 };
      q.footF = { x: 34, y: 0 }; q.squash = 1 - 0.06 * clamp(e, 0, 1);
      break;
    }
    case 'whirl': case 'atk1':
      q.flip = (t >> 2) % 2 === 1; q.handF = { x: R * 0.95, y: -8 }; q.handB = { x: R * 0.9, y: 4 };
      q.lift = 6 + Math.abs(sin(t * 0.4)) * 6; q.face = 'shout'; q.smear = 1;
      break;
    case 'atk4': {     // jumping press
      const up = sin(clamp(p) * Math.PI);
      q.lift = up * 80; q.handF = { x: R * 0.35, y: -R * 0.9 }; q.handB = { x: R * 0.15, y: -R * 0.9 };
      q.footF = { x: 16, y: up * 30 }; q.footB = { x: -12, y: up * 20 }; q.face = 'shout';
      if (state === 'jump') { q.lift = 0; }
      break;
    }
    case 'atk6':       // dribble
      guard(); q.hipDrop = 18; q.lean = 0.18; q.prop = 'ball'; q.face = 'angry';
      q.handF = { x: R * 0.8, y: 28 + Math.abs(sin(t * 0.8)) * 34 }; q.bodyX = 14 * clamp(strike(p), 0, 1);
      break;
    case 'atk2': {     // dab
      const e = clamp(strike(p, 0.25, 0.7), 0, 1);
      q.handF = { x: lerp(R * 0.4, R * 0.95, e), y: lerp(0, -R * 0.55, e) }; q.handB = { x: R * 0.2, y: -R * 0.5 * e };
      q.headTilt = 0.4 * e; q.face = e > 0.5 ? 'focus' : 'neutral';
      break;
    }
    case 'atk3': {     // arm swing
      const k = ease(clamp(p * 1.6));
      q.handF = { x: lerp(-R * 0.6, R * 0.95, k), y: lerp(10, -R * 0.3, k) }; q.lean = 0.12 * k; q.face = 'angry';
      q.smear = k > 0.4 && k < 1 ? 1 : 0;
      break;
    }
    case 'atk7':       // singing
      q.handF = { x: R * 0.2, y: -R * 0.85 }; q.handB = { x: R * 0.05, y: -R * 0.85 }; q.face = 'sing';
      q.headTilt = -0.2 + sin(t * 0.4) * 0.08; q.lift = Math.abs(sin(t * 0.5)) * 4;
      break;

    // -------- specials
    case 'scooter':
      q.scooter = true; q.hipDrop = 26; q.lean = 0.3; q.handF = { x: R * 0.95, y: -4 }; q.handB = { x: R * 0.9, y: 4 };
      q.footF = { x: 20, y: 36 }; q.footB = { x: -6, y: 36 }; q.face = 'shout'; q.lift = 6 + sin(t) * 2;
      break;
    case 'milkThrow': {
      const k = ease(clamp(p * 1.4));
      q.handF = { x: lerp(-R * 0.7, R * 0.95, k), y: lerp(-R * 0.8, -R * 0.1, k) };
      q.lean = lerp(-0.15, 0.18, k); q.prop = p < 0.55 ? 'milk' : null; q.face = 'angry'; q.smear = k > 0.5 && k < 0.95 ? 1 : 0;
      break;
    }
    case 'superPress':
      q.handF = { x: R * 0.3, y: -R * 0.15 + (p > 0.6 ? 10 : 0) }; q.glow = 0.4 + 0.4 * sin(t * 0.4); q.face = 'shout';
      q.squash = 1 + 0.04 * sin(t * 0.9); break;
    case 'superMilk': {
      const k = (t % 12) / 12;
      q.handF = { x: lerp(-R * 0.6, R * 0.95, ease(k)), y: lerp(-R * 0.8, -R * 0.1, k) }; q.handB = { x: R * 0.4, y: -R * 0.5 };
      q.glow = 0.6; q.face = 'shout'; q.prop = k < 0.5 ? 'milk' : null; q.smear = k > 0.4 ? 1 : 0;
      break;
    }
    case 'superStart':
      q.hipDrop = L * 0.55; q.footF = { x: 22, y: 0 }; q.footB = { x: -22, y: 0 };
      q.lift = 34 + sin(t * 0.15) * 8; q.face = 'focus'; q.handF = { x: R * 0.45, y: 30 }; q.handB = { x: R * 0.4, y: 34 }; q.glow = 0.8;
      break;
    default:
      guard();
  }
  if (S.coat) q.wings = true;
  return q;
}

/* ------------------------------------------------------------------ drawing helpers */
function shade(ctx, x, y, r, S, base = S.base) {
  const g = ctx.createRadialGradient(x - r * 0.35, y - r * 0.45, r * 0.08, x, y, r * 1.15);
  g.addColorStop(0, S.light); g.addColorStop(0.45, base); g.addColorStop(1, S.dark);
  return g;
}

function blob(ctx, x, y, rx, ry, fill, line, lw = 4, rot = 0) {
  ctx.beginPath(); ctx.ellipse(x, y, rx, ry, rot, 0, Math.PI * 2);
  ctx.fillStyle = fill; ctx.fill();
  if (line) { ctx.lineWidth = lw; ctx.strokeStyle = line; ctx.stroke(); }
}

/* Two-bone IK: elbow/knee position for a joint at (ax, ay) reaching (tx, ty). bend = ±1. */
function solve(ax, ay, tx, ty, a, b, bend) {
  let dx = tx - ax, dy = ty - ay;
  let d = Math.hypot(dx, dy);
  const max = a + b - 0.5;
  if (d > max) { tx = ax + dx / d * max; ty = ay + dy / d * max; dx = tx - ax; dy = ty - ay; d = max; }
  d = Math.max(d, Math.abs(a - b) + 1);
  const base = Math.atan2(dy, dx);
  const cos = clamp((a * a + d * d - b * b) / (2 * a * d), -1, 1);
  const ang = base + bend * Math.acos(cos);
  return { jx: ax + Math.cos(ang) * a, jy: ay + Math.sin(ang) * a, tx, ty };
}

function segment(ctx, pts, w, color, S) {
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  const path = () => { ctx.beginPath(); ctx.moveTo(pts[0], pts[1]); for (let i = 2; i < pts.length; i += 2) ctx.lineTo(pts[i], pts[i + 1]); };
  path(); ctx.strokeStyle = S.line; ctx.lineWidth = w + 7; ctx.stroke();
  path(); ctx.strokeStyle = color; ctx.lineWidth = w; ctx.stroke();
  ctx.save(); ctx.translate(-w * 0.18, -w * 0.18);
  path(); ctx.strokeStyle = 'rgba(255,255,255,.28)'; ctx.lineWidth = w * 0.32; ctx.stroke();
  ctx.restore();
}

function mitt(ctx, x, y, S, gloves, big = 1) {
  if (gloves && S.gloves) {
    const r = 17 * big;
    const g = ctx.createRadialGradient(x - r * 0.4, y - r * 0.4, 2, x, y, r * 1.1);
    g.addColorStop(0, S.gloves[0]); g.addColorStop(0.6, S.gloves[1]); g.addColorStop(1, S.gloves[2]);
    blob(ctx, x, y, r, r * 0.9, g, S.line, 4);
    blob(ctx, x - r * 0.35, y - r * 0.35, r * 0.25, r * 0.16, 'rgba(255,255,255,.7)', null, 0, -0.6);
    ctx.fillStyle = '#fff'; ctx.fillRect(x - r * 0.9, y + r * 0.35, r * 0.7, r * 0.35);
    return;
  }
  const r = (S.head === 'chick' ? 10 : 12) * big;
  blob(ctx, x, y, r, r, shade(ctx, x, y, r, S, S.limb), S.line, 3.5);
}

function foot(ctx, x, y, S, ang = 0) {
  if (S.head === 'chick') {
    ctx.strokeStyle = S.line; ctx.lineWidth = 7; ctx.lineCap = 'round';
    for (const a of [-0.4, 0, 0.4]) { ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + Math.cos(a + ang) * 18, y + Math.sin(a + ang) * 18 * 0.4); ctx.stroke(); }
    ctx.strokeStyle = S.legColor; ctx.lineWidth = 4;
    for (const a of [-0.4, 0, 0.4]) { ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + Math.cos(a + ang) * 17, y + Math.sin(a + ang) * 17 * 0.4); ctx.stroke(); }
    return;
  }
  const len = S.head === 'roo' ? 30 : 22;
  ctx.save(); ctx.translate(x, y); ctx.rotate(ang);
  blob(ctx, len * 0.45, -4, len, 10, shade(ctx, len * 0.45, -4, len, S, S.limb), S.line, 3.5);
  ctx.restore();
}

/* ------------------------------------------------------------------ faces */
function eye(ctx, x, y, r, face, S, look = 1) {
  ctx.lineCap = 'round';
  if (face === 'happy') {
    ctx.strokeStyle = S.line; ctx.lineWidth = 4.5;
    ctx.beginPath(); ctx.arc(x, y + r * 0.35, r * 0.75, Math.PI * 1.15, Math.PI * 1.85); ctx.stroke(); return;
  }
  if (face === 'focus' || face === 'sing') {
    ctx.strokeStyle = S.line; ctx.lineWidth = 4.5;
    ctx.beginPath(); ctx.arc(x, y - r * 0.2, r * 0.7, Math.PI * 0.15, Math.PI * 0.85); ctx.stroke(); return;
  }
  if (face === 'hurt') {
    ctx.strokeStyle = S.line; ctx.lineWidth = 4.5;
    ctx.beginPath(); ctx.moveTo(x - r * 0.6, y - r * 0.5); ctx.lineTo(x + r * 0.5, y); ctx.lineTo(x - r * 0.6, y + r * 0.5); ctx.stroke(); return;
  }
  if (face === 'dizzy') {
    ctx.strokeStyle = S.line; ctx.lineWidth = 3;
    ctx.beginPath();
    for (let a = 0; a < Math.PI * 4; a += 0.3) { const rr = r * 0.12 * a / Math.PI; ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); }
    ctx.stroke(); return;
  }
  blob(ctx, x, y, r * 0.82, r, '#ffffff', S.line, 3);
  const px = x + r * 0.28 * look, py = y + r * 0.05;
  blob(ctx, px, py, r * 0.42, r * 0.5, '#20160a');
  blob(ctx, px - r * 0.14, py - r * 0.2, r * 0.14, r * 0.14, '#ffffff');
}

function brows(ctx, x1, y1, x2, y2, face, S) {
  if (face !== 'angry' && face !== 'shout' && face !== 'grit') return;
  ctx.strokeStyle = S.line; ctx.lineWidth = 5; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(x1 - 9, y1 - 5); ctx.lineTo(x1 + 9, y1 + 3); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(x2 - 9, y2 + 3); ctx.lineTo(x2 + 9, y2 - 5); ctx.stroke();
}

function mouth(ctx, x, y, w, face, S) {
  ctx.strokeStyle = S.line; ctx.lineWidth = 4; ctx.lineCap = 'round';
  if (face === 'shout' || face === 'sing' || face === 'happy') {
    const h = face === 'sing' ? w * 0.45 : w * 0.38;
    ctx.beginPath(); ctx.ellipse(x, y, w * 0.45, h, 0, 0, Math.PI * (face === 'happy' ? 1 : 2));
    if (face === 'happy') ctx.closePath();
    ctx.fillStyle = '#8a1d1d'; ctx.fill(); ctx.stroke();
    blob(ctx, x, y + h * 0.45, w * 0.22, h * 0.32, '#ff7b7b');
  } else if (face === 'hurt' || face === 'dizzy') {
    ctx.beginPath(); ctx.moveTo(x - w * 0.4, y); ctx.lineTo(x - w * 0.15, y - 5); ctx.lineTo(x + w * 0.1, y + 3); ctx.lineTo(x + w * 0.4, y - 3); ctx.stroke();
  } else if (face === 'angry' || face === 'grit') {
    ctx.beginPath(); ctx.moveTo(x - w * 0.35, y + 2); ctx.lineTo(x + w * 0.35, y - 2); ctx.stroke();
  } else {
    ctx.beginPath(); ctx.arc(x, y - w * 0.25, w * 0.4, 0.2 * Math.PI, 0.8 * Math.PI); ctx.stroke();
  }
}

function drawHead(ctx, S, q, hx, hy) {
  const r = S.headR;
  const f = q.face;
  ctx.save();
  ctx.translate(hx, hy);
  ctx.rotate(q.headTilt);
  if (S.head === 'frog') {
    // eye bumps behind the head outline
    blob(ctx, -r * 0.28, -r * 0.62, r * 0.42, r * 0.4, shade(ctx, -r * 0.28, -r * 0.62, r * 0.42, S), S.line);
    blob(ctx, r * 0.5, -r * 0.58, r * 0.42, r * 0.4, shade(ctx, r * 0.5, -r * 0.58, r * 0.42, S), S.line);
    blob(ctx, 0, 0, r * 1.2, r * 0.82, shade(ctx, 0, 0, r * 1.2, S), S.line);
    blob(ctx, -r * 0.28, -r * 0.55, r * 0.3, r * 0.3, S.base);
    blob(ctx, r * 0.5, -r * 0.52, r * 0.3, r * 0.3, S.base);
    eye(ctx, -r * 0.28, -r * 0.6, r * 0.3, f, S);
    eye(ctx, r * 0.5, -r * 0.56, r * 0.3, f, S);
    brows(ctx, -r * 0.28, -r * 0.98, r * 0.5, -r * 0.94, f, S);
    blob(ctx, -r * 0.55, r * 0.15, r * 0.2, r * 0.12, S.blush);
    blob(ctx, r * 0.95, r * 0.12, r * 0.16, r * 0.11, S.blush);
    // wide frog mouth
    if (f === 'neutral') {
      ctx.strokeStyle = S.line; ctx.lineWidth = 4.5; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(-r * 0.35, r * 0.15); ctx.quadraticCurveTo(r * 0.3, r * 0.55, r * 1.0, r * 0.08); ctx.stroke();
    } else mouth(ctx, r * 0.35, r * 0.32, r * 0.95, f, S);
    blob(ctx, r * 0.95, -r * 0.1, 3, 2.5, S.line);
  } else if (S.head === 'roo') {
    for (const [ex, tilt] of [[-r * 0.45, -0.32], [r * 0.05, 0.12]]) {
      ctx.save(); ctx.translate(ex, -r * 0.65); ctx.rotate(tilt + Math.sin(q.headTilt * 3) * 0.1);
      blob(ctx, 0, -r * 0.62, r * 0.3, r * 0.7, shade(ctx, 0, -r * 0.62, r * 0.7, S), S.line);
      blob(ctx, 0, -r * 0.55, r * 0.15, r * 0.48, '#f4b9a0');
      ctx.restore();
    }
    blob(ctx, 0, 0, r, r * 0.95, shade(ctx, 0, 0, r, S), S.line);
    // courier helmet
    ctx.beginPath(); ctx.ellipse(-r * 0.05, -r * 0.35, r * 0.98, r * 0.72, 0, Math.PI, 0);
    const hg = ctx.createLinearGradient(0, -r * 1.1, 0, -r * 0.3);
    hg.addColorStop(0, '#ffe680'); hg.addColorStop(1, '#f2b705');
    ctx.fillStyle = hg; ctx.fill(); ctx.lineWidth = 4; ctx.strokeStyle = S.line; ctx.stroke();
    ctx.fillStyle = '#f2b705'; ctx.strokeStyle = S.line;
    ctx.beginPath(); ctx.ellipse(r * 0.55, -r * 0.33, r * 0.55, r * 0.12, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#d4161f'; ctx.font = `900 ${Math.round(r * 0.42)}px sans-serif`; ctx.textAlign = 'center';
    ctx.fillText('⚡', -r * 0.15, -r * 0.5);
    // snout
    blob(ctx, r * 0.78, r * 0.3, r * 0.58, r * 0.4, shade(ctx, r * 0.78, r * 0.3, r * 0.58, S, S.belly), S.line);
    blob(ctx, r * 1.25, r * 0.15, r * 0.17, r * 0.13, '#2a1405');
    eye(ctx, r * 0.15, -r * 0.08, r * 0.24, f, S);
    eye(ctx, r * 0.62, -r * 0.05, r * 0.22, f, S);
    brows(ctx, r * 0.12, -r * 0.35, r * 0.62, -r * 0.32, f, S);
    blob(ctx, -r * 0.2, r * 0.3, r * 0.17, r * 0.1, S.blush);
    mouth(ctx, r * 0.85, r * 0.55, r * 0.6, f, S);
  } else {
    // chick
    blob(ctx, 0, 0, r, r * 0.95, shade(ctx, 0, 0, r, S), S.line);
    // curly grey wig: back curls, then front fringe
    const curl = (cx, cy, cr) => {
      const g = ctx.createRadialGradient(cx - cr * 0.3, cy - cr * 0.3, 1, cx, cy, cr);
      g.addColorStop(0, '#e2e7ec'); g.addColorStop(1, '#8e97a2');
      blob(ctx, cx, cy, cr, cr, g, S.line, 3);
    };
    for (const [cx, cy] of [[-r * 0.85, -r * 0.1], [-r * 0.9, r * 0.3], [-r * 0.7, -r * 0.5]]) curl(cx, cy, r * 0.3);
    for (let i = -3; i <= 3; i++) curl(i * r * 0.27, -r * 0.78 + Math.abs(i) * r * 0.08, r * 0.3);
    eye(ctx, r * 0.1, -r * 0.08, r * 0.26, f, S);
    eye(ctx, r * 0.6, -r * 0.05, r * 0.24, f, S);
    brows(ctx, r * 0.08, -r * 0.4, r * 0.6, -r * 0.37, f, S);
    blob(ctx, -r * 0.15, r * 0.35, r * 0.17, r * 0.1, S.blush);
    // beak (opens when singing / shouting)
    const open = f === 'sing' || f === 'shout' || f === 'happy' ? r * 0.18 : 0;
    ctx.fillStyle = '#ff9a1a'; ctx.strokeStyle = S.line; ctx.lineWidth = 3.5; ctx.lineJoin = 'round';
    ctx.beginPath(); ctx.moveTo(r * 0.72, r * 0.18 - open * 0.3); ctx.lineTo(r * 1.28, r * 0.28); ctx.lineTo(r * 0.72, r * 0.4); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#e8700a';
    ctx.beginPath(); ctx.moveTo(r * 0.72, r * 0.4 + open * 0.2); ctx.lineTo(r * 1.15, r * 0.38 + open); ctx.lineTo(r * 0.72, r * 0.55 + open); ctx.closePath(); ctx.fill(); ctx.stroke();
  }
  ctx.restore();
}

/* ------------------------------------------------------------------ props */
export function drawBallProp(ctx, x, y, r) {
  const g = ctx.createRadialGradient(x - r * 0.35, y - r * 0.35, r * 0.1, x, y, r);
  g.addColorStop(0, '#ffb15a'); g.addColorStop(1, '#c4520f');
  blob(ctx, x, y, r, r, g, '#3a1500', 2.5);
  ctx.strokeStyle = '#3a1500'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(x - r, y); ctx.lineTo(x + r, y); ctx.moveTo(x, y - r); ctx.lineTo(x, y + r); ctx.stroke();
}

export function drawCarton(ctx, x, y, scale = 1, angle = 0) {
  ctx.save();
  ctx.translate(x, y); ctx.rotate(angle); ctx.scale(scale, scale);
  ctx.fillStyle = '#f7f7f2'; ctx.strokeStyle = '#22314f'; ctx.lineWidth = 3; ctx.lineJoin = 'round';
  ctx.beginPath(); ctx.moveTo(-20, -18); ctx.lineTo(0, -34); ctx.lineTo(20, -18); ctx.lineTo(20, 30); ctx.lineTo(-20, 30); ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#dfe3ea'; ctx.beginPath(); ctx.moveTo(0, -34); ctx.lineTo(20, -18); ctx.lineTo(0, -18); ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#3d7ad6'; ctx.fillRect(-18, -2, 36, 18);
  ctx.fillStyle = '#fff'; ctx.font = 'bold 11px sans-serif'; ctx.textAlign = 'center'; ctx.fillText('MILK', 0, 12);
  ctx.restore();
}

function drawScooter(ctx, S) {
  const wheel = (x) => {
    blob(ctx, x, -16, 17, 17, '#26262e', '#000', 3);
    blob(ctx, x, -16, 7, 7, '#9aa0aa', '#000', 2);
  };
  wheel(-58); wheel(62);
  const g = ctx.createLinearGradient(0, -60, 0, -26);
  g.addColorStop(0, '#ffe066'); g.addColorStop(1, '#f2a900');
  ctx.fillStyle = g; ctx.strokeStyle = S.line; ctx.lineWidth = 4; ctx.lineJoin = 'round';
  ctx.beginPath(); ctx.moveTo(-80, -30); ctx.lineTo(70, -30); ctx.lineTo(84, -56); ctx.lineTo(56, -60); ctx.lineTo(40, -44); ctx.lineTo(-64, -44); ctx.closePath(); ctx.fill(); ctx.stroke();
  segment(ctx, [62, -50, 74, -128], 8, '#3a3a44', S);
  segment(ctx, [62, -128, 86, -132], 6, '#3a3a44', S);
  // delivery box
  ctx.fillStyle = '#e63a2e'; ctx.fillRect(-92, -96, 44, 46); ctx.strokeRect(-92, -96, 44, 46);
  ctx.fillStyle = '#fff'; ctx.font = 'bold 13px sans-serif'; ctx.textAlign = 'center'; ctx.fillText('外卖', -70, -68);
}

/* ------------------------------------------------------------------ fighter */
/**
 * Draw a fighter frame with its feet at (x, footY), facing 1 = right.
 * clipName/frame/frames come from the sprite clip so poses line up with move timing.
 */
export function drawPlaceholderFighter(ctx, id, clipName, frame, frames, x, footY, facing, opts = {}) {
  const S = STYLES[id] || STYLES.naiwa;
  const p = frames > 1 ? frame / (frames - 1) : 0;
  const state = opts.state || '';
  let name = clipName;
  if (state === 'jump' && id !== 'kangaroo') name = 'jump';
  if (state === 'down') name = 'ko';
  const q = pose(id, name, state === 'down' ? 1 : p, frame + (opts.clock || 0), state);
  const scale = opts.scale ?? 1;

  ctx.save();
  if (opts.alpha != null) ctx.globalAlpha = opts.alpha;
  if (opts.filter) ctx.filter = opts.filter;
  ctx.translate(x, footY);
  ctx.scale(scale * (q.flip ? -facing : facing), scale);

  // knocked down: tip over backwards around the heels, keeping the body above the floor
  if (q.rot) {
    ctx.translate(-10, -Math.sin(-q.rot) * (S.torsoBot * 0.42));
    ctx.rotate(q.rot);
  }
  ctx.translate(q.bodyX * 0.4, -q.lift);

  const hipY = -(S.hipY - q.hipDrop);
  const tH = S.torsoH * q.squash;
  const shoulderY = hipY - tH * 0.78;

  if (q.glow) {
    const g = ctx.createRadialGradient(0, hipY - tH * 0.5, 10, 0, hipY - tH * 0.5, 230);
    g.addColorStop(0, `rgba(255,232,120,${0.5 * q.glow})`); g.addColorStop(1, 'rgba(255,200,80,0)');
    ctx.fillStyle = g; ctx.fillRect(-240, hipY - 330, 480, 480);
  }
  if (q.scooter) drawScooter(ctx, S);

  // legs (feet are given in ground space; convert to hip space)
  const legs = [];
  for (const [side, ft] of [[-1, q.footB], [1, q.footF]]) {
    const hx = side * (S.torsoBot * 0.16);
    const tx = ft.x + q.bodyX * 0.6 * (side > 0 ? 1 : 0.4);
    const ty = -ft.y;
    const k = solve(hx, hipY, tx, ty, S.legU, S.legL, -1);
    legs.push({ hx, k, side });
  }
  // arms are drawn in torso space (rotated by lean around the hips)
  const torso = (fn) => {
    ctx.save();
    ctx.translate(q.bodyX * 0.6, 0);
    ctx.translate(0, hipY); ctx.rotate(q.lean); ctx.translate(0, -hipY);
    fn();
    ctx.restore();
  };
  const arm = (hand, side) => {
    const sx = side > 0 ? S.torsoTop * 0.3 : -S.torsoTop * 0.05;
    const reach = (S.armU + S.armL) * (1 + 1.2 * (side > 0 ? (q.stretchArm || 0) : 0));
    const k = solve(sx, shoulderY, sx + hand.x, shoulderY + hand.y, S.armU * reach / (S.armU + S.armL), S.armL * reach / (S.armU + S.armL), 1);
    return { sx, k };
  };
  const drawArm = (a, color, side) => {
    if (q.wings && side < 0) return;
    segment(ctx, [a.sx, shoulderY, a.k.jx, a.k.jy, a.k.tx, a.k.ty], S.limbW, color, S);
    mitt(ctx, a.k.tx, a.k.ty, S, q.gloves);
  };
  const legColor = S.legColor || S.limb;
  const drawLeg = (l) => {
    segment(ctx, [l.hx, hipY, l.k.jx, l.k.jy, l.k.tx, l.k.ty], S.legW, legColor, S);
    foot(ctx, l.k.tx, l.k.ty, S, l.k.ty < -4 ? -0.25 : 0);
  };

  // tail + back limbs
  if (S.tail) {
    ctx.save();
    ctx.lineCap = 'round';
    ctx.strokeStyle = S.line; ctx.lineWidth = 30;
    ctx.beginPath(); ctx.moveTo(-S.torsoBot * 0.25, hipY - 6); ctx.quadraticCurveTo(-S.torsoBot * 0.75, hipY + 4, -S.torsoBot * 0.92, -8); ctx.stroke();
    ctx.strokeStyle = S.dark; ctx.lineWidth = 23; ctx.stroke();
    ctx.restore();
  }
  const armB = arm(q.handB, -1);
  torso(() => drawArm(armB, S.dark, -1));
  drawLeg(legs[0]);

  // torso
  torso(() => {
    const top = shoulderY - tH * 0.18, bot = hipY + 12;
    const wt = S.torsoTop / 2, wb = S.torsoBot / 2 * (1 + q.belly * 0.12);
    const torsoPath = () => {
      ctx.beginPath();
      ctx.moveTo(-wt * 0.8, top);
      ctx.bezierCurveTo(wt * 0.6, top - 12, wt * 1.1, top + 10, wb * 0.95 + q.belly * 18, (top + bot) / 2 + 10);
      ctx.bezierCurveTo(wb * 1.05 + q.belly * 18, bot - 6, wb * 0.4, bot + 8, 0, bot + 6);
      ctx.bezierCurveTo(-wb * 0.6, bot + 8, -wb * 1.05, bot - 8, -wb * 0.95, (top + bot) / 2 + 8);
      ctx.bezierCurveTo(-wb * 0.95, top + 20, -wt * 1.1, top, -wt * 0.8, top);
      ctx.closePath();
    };
    torsoPath();
    const cy = (top + bot) / 2;
    ctx.fillStyle = shade(ctx, 0, cy, Math.max(wb, tH / 2), S, S.coat ? '#eef1f6' : S.base);
    if (S.coat) {
      const g = ctx.createLinearGradient(-wb, 0, wb, 0);
      g.addColorStop(0, '#c9d0da'); g.addColorStop(0.5, '#ffffff'); g.addColorStop(1, '#bcc4cf');
      ctx.fillStyle = g;
    }
    ctx.fill();
    ctx.save();
    torsoPath();
    ctx.clip();                      // belly / coat details stay inside the body outline
    if (S.coat) {
      // yellow tummy between the coat lapels, plus a collar and buttons
      blob(ctx, wb * 0.32, cy + 12, wb * 0.36, tH * 0.32, shade(ctx, wb * 0.32, cy + 12, wb * 0.4, S), S.line, 3);
      ctx.strokeStyle = S.line; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(-wt * 0.2, top + 4); ctx.lineTo(wt * 0.25, top + tH * 0.35); ctx.lineTo(wt * 0.75, top + 2); ctx.stroke();
      blob(ctx, wt * 0.15, top + 8, wt * 0.55, 9, '#2b2b33', S.line, 2.5);
      for (const by of [0.5, 0.72]) blob(ctx, -wb * 0.2, top + tH * by, 4, 4, '#9aa3ad', S.line, 1.5);
    } else {
      blob(ctx, wb * 0.25 + q.belly * 20, cy + tH * 0.08, wb * (0.62 + q.belly * 0.18), tH * 0.36, shade(ctx, wb * 0.25, cy, wb * 0.7, { ...S, light: '#ffffff', dark: S.belly }, S.belly), null);
      if (id === 'kangaroo') {
        ctx.strokeStyle = 'rgba(80,50,20,.55)'; ctx.lineWidth = 3;
        ctx.beginPath(); ctx.arc(wb * 0.25, cy + tH * 0.15, wb * 0.4, 0.15 * Math.PI, 0.85 * Math.PI); ctx.stroke();
      }
    }
    ctx.restore();
    torsoPath();
    ctx.lineWidth = 4.5; ctx.strokeStyle = S.line; ctx.stroke();
    if (q.wings) {
      // little coat sleeves/wings flapping at the back
      ctx.save(); ctx.translate(-wt * 0.6, top + tH * 0.3); ctx.rotate(-0.6 + Math.sin((opts.clock || frame) * 0.4) * 0.25);
      blob(ctx, -10, 0, 20, 30, '#dfe4ea', S.line, 3.5);
      ctx.restore();
    }
    drawHead(ctx, S, q, S.torsoTop * 0.12, shoulderY - S.headR * 0.55 + S.headDY * 0.6 - (S.head === 'frog' ? 10 : 18));
  });

  drawLeg(legs[1]);

  // front arm + prop + strike smear
  const armF = arm(q.handF, 1);
  torso(() => {
    if (q.smear) {
      const a = q.smear === -1 ? armB : armF;
      const tgt = q.smear === 2 ? legs[1].k : a.k;
      const ox = q.smear === 2 ? legs[1].hx : a.sx, oy = q.smear === 2 ? hipY : shoulderY;
      const g = ctx.createLinearGradient(ox, oy, tgt.tx, tgt.ty);
      g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(1, 'rgba(255,255,255,.75)');
      ctx.strokeStyle = g; ctx.lineCap = 'round'; ctx.lineWidth = 34;
      ctx.beginPath(); ctx.moveTo(ox + (tgt.tx - ox) * 0.25, oy + (tgt.ty - oy) * 0.25 - 8); ctx.quadraticCurveTo((ox + tgt.tx) / 2, oy - 26, tgt.tx, tgt.ty); ctx.stroke();
    }
    drawArm(armF, S.limb, 1);
    if (q.prop === 'ball') drawBallProp(ctx, armF.k.tx + 6, armF.k.ty + 26, 18);
    if (q.prop === 'milk') drawCarton(ctx, armF.k.tx + 4, armF.k.ty - 18, 0.75, 0.2);
  });
  ctx.restore();
}

/* ------------------------------------------------------------------ projectiles */
/* (x, footY) matches drawClip's anchor for these clips. */
export function drawPlaceholderProjectile(ctx, name, frame, x, footY, facing) {
  ctx.save();
  if (name === 'orb') {
    const y = footY - 48, r = 32 + Math.sin(frame) * 2;
    const S = STYLES.naiwa;
    blob(ctx, x, y, r, r, shade(ctx, x, y, r, S), S.line, 4);
    ctx.strokeStyle = S.line; ctx.lineWidth = 4; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.arc(x - 11, y - 4, 7, Math.PI * 1.15, Math.PI * 1.85); ctx.stroke();
    ctx.beginPath(); ctx.arc(x + 11, y - 4, 7, Math.PI * 1.15, Math.PI * 1.85); ctx.stroke();
    ctx.beginPath(); ctx.ellipse(x, y + 9, 14, 11, 0, 0, Math.PI); ctx.closePath();
    ctx.fillStyle = '#8a1d1d'; ctx.fill(); ctx.stroke();
    blob(ctx, x - 20, y + 6, 6, 4, S.blush); blob(ctx, x + 20, y + 6, 6, 4, S.blush);
  } else if (name === 'chicken') {
    const line = '#2a1000';
    ctx.translate(x, footY - 40);
    ctx.scale(facing, 1);
    const step = Math.sin(frame * 1.2) * 0.5;
    ctx.lineCap = 'round';
    for (const [lx, d] of [[-6, -step], [8, step]]) {
      ctx.strokeStyle = line; ctx.lineWidth = 8; ctx.beginPath(); ctx.moveTo(lx, 16); ctx.lineTo(lx + d * 16, 40); ctx.stroke();
      ctx.strokeStyle = '#f2a91a'; ctx.lineWidth = 4; ctx.stroke();
    }
    for (let i = 0; i < 4; i++) {
      blob(ctx, -30 - i * 4, -16 + i * 7, 9, 22, ['#1f6b3a', '#2a2a6a', '#7a1a1a', '#3a2410'][i], line, 2.5, -0.5 - i * 0.15);
    }
    const g = ctx.createRadialGradient(-6, -8, 4, 0, 0, 36);
    g.addColorStop(0, '#d0703a'); g.addColorStop(1, '#7a2e10');
    blob(ctx, 0, 0, 34, 26, g, line, 3);
    blob(ctx, -4, 2, 18, 12, '#5a200a', null, 0, 0.3);
    blob(ctx, 26, -24, 15, 15, '#b4501e', line, 3);
    blob(ctx, 24, -42, 7, 6, '#e0201a', line, 2); blob(ctx, 31, -40, 6, 5, '#e0201a', line, 2);
    blob(ctx, 34, -12, 5, 7, '#e0201a', line, 2);
    ctx.fillStyle = '#f2b01a'; ctx.strokeStyle = line; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(38, -28); ctx.lineTo(52, -22); ctx.lineTo(38, -17); ctx.closePath(); ctx.fill(); ctx.stroke();
    blob(ctx, 30, -27, 3.5, 3.5, '#fff', line, 1.5); blob(ctx, 31, -27, 1.8, 1.8, '#000');
  }
  ctx.restore();
}

/* ------------------------------------------------------------------ menu images */
/* Static images for menus/HUD (portrait circle, select card, title stand). */
export function placeholderImage(id, kind) {
  const size = { portrait: [420, 420], card: [800, 1000], stand: [360, 720] }[kind];
  const c = document.createElement('canvas');
  [c.width, c.height] = size;
  const g = c.getContext('2d');
  if (kind === 'portrait') {
    const bg = g.createRadialGradient(210, 190, 20, 210, 210, 240);
    bg.addColorStop(0, '#4a3470'); bg.addColorStop(1, '#140c22');
    g.fillStyle = bg; g.fillRect(0, 0, 420, 420);
    const S = STYLES[id];
    const headTop = S.hipY + S.torsoH + S.headR;     // rough height of the head above the feet
    drawPlaceholderFighter(g, id, 'idle', 0, 1, 170, 300 + headTop * 1.9 - 80, 1, { scale: 1.9 });
  } else if (kind === 'card') {
    const [clip, f, n] = { naiwa: ['laugh', 4, 12], kangaroo: ['heavy1', 3, 7], chick: ['rally', 2, 19] }[id];
    drawPlaceholderFighter(g, id, clip, f, n, 360, 950, 1, { scale: 2.75 });
  } else {
    drawPlaceholderFighter(g, id, 'idle', 0, 1, 170, 700, 1, { scale: 2.2 });
  }
  return c.toDataURL('image/png');
}
