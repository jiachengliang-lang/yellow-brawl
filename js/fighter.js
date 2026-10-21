/* One fighter: state machine, movement, attacks and hit reactions.
 * Purely frame-based: call update() exactly once per 60 Hz simulation step.
 */

import { CHARACTERS } from './data.js';
import { GROUND } from './stage.js';
import { t as tr } from './i18n.js';
import { sfx } from './audio.js';

export const WALL_L = 70;
export const WALL_R = 1210;
const GRAVITY = 0.85;
const BUFFER = 8;          // frames a button press stays "fresh"
const DOWN_FRAMES = 52;    // time lying on the floor after a knockdown
const GETUP_FRAMES = 18;
const DASH_WINDOW = 12;     // max frames between taps for a dash
const DASH_FRAMES = 18;
const BACKDASH_FRAMES = 16;
const NEUTRAL = new Set(['idle', 'walk', 'crouch', 'guard']);
export const SPECIAL_METER_COST = 50;   // U / down+U cost half a bar, like the original
const SUPER_METER_LOCK = 180;          // after an ultimate the meter stays locked for 3 s
const ATTACK_BUTTONS = ['light', 'heavy', 'kick', 'special', 'super'];

export class Fighter {
  constructor(charId, side) {
    this.c = CHARACTERS[charId];
    this.id = charId;
    this.side = side;
    this.wins = 0;
    this.reset(side === 0 ? 400 : 880);
  }

  reset(x) {
    this.x = x; this.y = GROUND; this.vx = 0; this.vy = 0;
    this.facing = this.side === 0 ? 1 : -1;
    this.hp = this.c.hp;
    this.redHp = this.c.hp;           // trailing damage bar
    this.meter = this.meter ?? 0;
    this.state = 'intro'; this.t = 0;
    this.move = null; this.moveKey = null; this.step = 0; this.mt = 0;
    this.queued = null; this.connected = false; this.hitsDone = 0; this.lastHitAt = -999;
    this.barrageIdx = 0;
    this.stun = 0; this.knockdown = false; this.kdT = 0; this.invuln = 0;
    this.prev = {}; this.buf = {};
    this.holdingBack = false; this.guardKey = false; this.down = false;
    this.cooldowns = {};
    this.comboTaken = 0; this.comboDmg = 0;
    this.flash = 0;
    this.airAttackUsed = false;
    this.age = 0;
    this.lastTap = { dir: null, at: -99 };
    this.tapped = null;
    this.trail = [];
    this.stats = this.stats || { dealt: 0, hits: 0, maxCombo: 0, blocks: 0, supers: 0 };
    this.meterLock = 0;
    this.actionMeter = 0;
  }

  get grounded() { return this.y >= GROUND && this.vy >= 0; }
  get neutral() { return NEUTRAL.has(this.state); }
  get crouching() {
    return this.state === 'crouch' || (this.state === 'attack' && (this.moveKey === 'crouchLight' || this.moveKey === 'crouchKick'));
  }

  setState(s) { this.state = s; this.t = 0; }

  /* ---------------------------------------------------------------- input */
  readInput(inp) {
    for (const b of ATTACK_BUTTONS.concat(['up'])) {
      if (inp[b] && !this.prev[b]) this.buf[b] = BUFFER;
      else if (this.buf[b] > 0) this.buf[b]--;
    }
    // double-tap detection for dashes
    this.tapped = null;
    for (const d of ['left', 'right']) {
      if (inp[d] && !this.prev[d]) {
        if (this.lastTap.dir === d && this.age - this.lastTap.at <= DASH_WINDOW) { this.tapped = d; this.lastTap = { dir: null, at: -99 }; }
        else this.lastTap = { dir: d, at: this.age };
      }
    }
    this.prev = { ...inp };
    this.in = inp;
  }

  pressed(b) { return this.buf[b] > 0; }
  consume(b) { this.buf[b] = 0; }

  /* ---------------------------------------------------------------- update */
  update(inp, opp, match) {
    this.readInput(inp);
    this.t++;
    this.age++;
    this.recordTrail();
    if (this.invuln > 0) this.invuln--;
    if (this.meterLock > 0) this.meterLock--;
    if (this.flash > 0) this.flash--;
    for (const k in this.cooldowns) if (this.cooldowns[k] > 0) this.cooldowns[k]--;
    if (this.redHp > this.hp) this.redHp = Math.max(this.hp, this.redHp - (this.state === 'hurt' ? 0 : 6));

    switch (this.state) {
      case 'intro': case 'win': case 'lose':
        this.vx = 0;
        break;
      case 'ko':
        this.physics(match);
        if (this.grounded) this.vx *= 0.85;
        this.kdT++;
        break;
      case 'hurt': this.updateHurt(match); break;
      case 'blockstun':
        this.vx *= 0.82;
        if (--this.stun <= 0) this.toNeutral();
        this.physics(match);
        break;
      case 'down':
        this.vx *= 0.8;
        this.kdT++;
        // mashing gets you up faster
        if (ATTACK_BUTTONS.some(b => this.pressed(b))) { this.t += 4; ATTACK_BUTTONS.forEach(b => this.consume(b)); }
        if (this.t >= DOWN_FRAMES) { this.setState('getup'); this.invuln = GETUP_FRAMES + 6; }
        break;
      case 'getup':
        if (this.t >= GETUP_FRAMES) this.toNeutral();
        break;
      case 'dizzy':
        this.vx *= 0.8;
        this.physics(match);
        if (--this.stun <= 0) this.toNeutral();
        break;
      case 'jump': this.updateJump(opp, match); break;
      case 'dash': this.updateDash(opp, match); break;
      case 'attack': this.updateAttack(opp, match); break;
      default: this.updateNeutral(opp, match);
    }
  }

  toNeutral() {
    if (this.moveKey === 'super') { this.meter = Math.min(this.meter, 3); this.meterLock = SUPER_METER_LOCK; }
    this.move = null; this.moveKey = null; this.queued = null;
    this.hidden = false; this.cs = null;
    this.knockdown = false;
    this.setState(this.in?.down ? 'crouch' : 'idle');
  }

  faceOpponent(opp) {
    if (Math.abs(opp.x - this.x) > 4) this.facing = opp.x > this.x ? 1 : -1;
  }

  updateNeutral(opp, match) {
    const inp = this.in;
    this.faceOpponent(opp);
    const fwd = this.facing > 0 ? inp.right : inp.left;
    const back = this.facing > 0 ? inp.left : inp.right;
    this.holdingBack = back;
    this.guardKey = inp.guard;
    const mv = this.c.moves;

    if (this.pressed('super') && this.meter >= 100) { this.consume('super'); return this.startMove(mv.super, 'super', 0, match); }
    if (this.pressed('special')) {
      const key = inp.down ? 'special2' : 'special';
      if (!(this.cooldowns[key] > 0) && this.paySpecial(match)) { this.consume('special'); return this.startMove(mv[key], key, 0, match); }
    }
    if (this.pressed('light') || this.pressed('heavy') || this.pressed('kick')) {
      const b = this.pressed('light') ? 'light' : this.pressed('heavy') ? 'heavy' : 'kick';
      this.consume(b);
      if (inp.down) return this.startMove(b === 'light' ? mv.crouchLight : mv.crouchKick, b === 'light' ? 'crouchLight' : 'crouchKick', 0, match);
      if (b === 'kick') return this.startMove(mv.kick, 'kick', 0, match);
      return this.startMove(mv[b][0], b, 0, match);
    }
    if (this.tapped && !inp.down) {
      const dir = this.tapped === 'right' ? 1 : -1;
      this.dashDir = dir === this.facing ? 1 : -1;
      this.setState('dash');
      if (this.dashDir < 0) this.invuln = Math.max(this.invuln, 6);
      match.fx.dust(this.x, GROUND, 5, -dir);
      sfx('dash');
      return;
    }
    if (inp.up && !inp.guard) {
      this.consume('up');
      this.vy = this.c.jumpV;
      this.vx = (inp.right ? 1 : inp.left ? -1 : 0) * this.c.jumpX;
      this.y -= 1;
      this.airAttackUsed = false;
      this.setState('jump');
      match.fx.dust(this.x, GROUND, 5);
      return;
    }
    if (inp.down) {
      this.vx = 0;
      if (this.state !== 'crouch') this.setState('crouch');
    } else if (inp.guard) {
      this.vx = 0;
      if (this.state !== 'guard') this.setState('guard');
    } else if (fwd) {
      this.vx = this.facing * this.c.walk;
      if (this.state !== 'walk' || this.walkDir !== 1) { this.setState('walk'); this.walkDir = 1; }
    } else if (back) {
      this.vx = -this.facing * this.c.back;
      if (this.state !== 'walk' || this.walkDir !== -1) { this.setState('walk'); this.walkDir = -1; }
    } else {
      this.vx = 0;
      if (this.state !== 'idle') this.setState('idle');
    }
    this.physics(match);
  }

  updateDash(opp, match) {
    const fwd = this.dashDir > 0;
    const len = fwd ? DASH_FRAMES : BACKDASH_FRAMES;
    const k = 1 - this.t / len;
    this.vx = this.facing * this.dashDir * this.c.walk * (fwd ? 3.1 : 2.6) * Math.max(0.25, k);
    // a forward dash can be cancelled into any attack
    if (fwd && this.t > 4 && ['light', 'heavy', 'kick', 'special', 'super'].some(b => this.pressed(b))) {
      this.vx *= 0.5;
      this.setState('idle');
      return this.updateNeutral(opp, match);
    }
    this.physics(match);
    if (this.t >= len) { this.vx = 0; this.toNeutral(); }
  }

  /* Remember recent poses for afterimages during dashes and lunging specials. */
  recordTrail() {
    const showing = (this.state === 'dash' && this.dashDir > 0) || (this.state === 'attack' && this.move?.afterimage && this.mt < (this.move.lungeUntil ?? 30));
    if (showing && this.age % 3 === 0) {
      const a = this.anim(this.age);
      this.trail.push({ x: this.x, y: this.y, facing: this.facing, name: a.name, frame: a.frame, life: 12 });
      if (this.trail.length > 4) this.trail.shift();
    }
    for (const g of this.trail) g.life--;
    this.trail = this.trail.filter(g => g.life > 0);
  }

  updateJump(opp, match) {
    if (!this.airAttackUsed && (this.pressed('light') || this.pressed('heavy') || this.pressed('kick'))) {
      ['light', 'heavy', 'kick'].forEach(b => this.consume(b));
      this.airAttackUsed = true;
      this.startMove(this.c.moves.air, 'air', 0, match, true);
      return;
    }
    this.physics(match);
    if (this.grounded) this.land(opp, match);
  }

  land(opp, match) {
    match.fx.dust(this.x, GROUND, 6);
    sfx('land');
    this.vx = 0;
    this.faceOpponent(opp);
    this.toNeutral();
  }

  /* Specials spend half a bar; returns false when there isn't enough meter. */
  paySpecial(match) {
    if (match.training) return true;
    if (this.meter < SPECIAL_METER_COST) return false;
    this.meter -= SPECIAL_METER_COST;
    return true;
  }

  /* --------------------------------------------------------------- attacks */
  startMove(def, key, step, match, airborne = false) {
    this.move = def; this.moveKey = key; this.step = step;
    this.mt = 0; this.queued = null; this.connected = false;
    this.hitsDone = 0; this.lastHitAt = -999; this.barrageIdx = 0;
    this.actionMeter = 0;
    this.airborne = airborne;
    this.setState('attack');
    if (!airborne) this.vx = 0;
    if (def.invuln) this.invuln = def.invuln;
    if (def.cooldown) this.cooldowns[key] = def.cooldown;
    if (def.music) sfx('comboMusic');
    if (def.rampage) sfx('engine');
    if (def.freeze) {
      this.meter = 0;
      match.startSuper(this, def.freeze);
    }
  }

  updateAttack(opp, match) {
    const d = this.move;
    this.mt++;
    if (d.kind === 'chickBasketball') return this.updateChickSuper(opp, match);
    const activeEnd = d.startup + d.active;

    // forward movement
    if (!this.airborne) {
      const until = d.lungeUntil ?? activeEnd;
      if (d.lunge && this.mt <= until) this.vx = this.facing * d.lunge;
      else this.vx *= 0.7;
    }
    if (this.mt === d.startup) sfx(d.wave ? 'wave' : 'whiff');
    // rampage: dust kicked up behind the wheels
    if (d.rampage && this.mt >= d.startup && this.mt % 3 === 0) match.fx.dust(this.x - this.facing * 60, GROUND, 2, -this.facing);

    // projectiles
    if (d.spawn && this.mt === d.spawn.at) { match.spawnProjectile(this, d.spawn); sfx(d.spawn.kind === 'chicken' ? 'cluck' : 'throw'); }
    if (d.barrage) {
      const b = d.barrage;
      if (this.mt >= b.start && (this.mt - b.start) % b.gap === 0 && this.barrageIdx < b.count) {
        const last = this.barrageIdx === b.count - 1;
        const wave = Math.sin(this.barrageIdx * 1.7) * (b.spread || 0);
        match.spawnProjectile(this, { ...b, y: b.y + wave, x: 60, vx: b.speed, knockdown: last, dmg: last && b.lastDmg ? b.lastDmg : b.dmg }, true);
        this.barrageIdx++;
        sfx('throw');
      }
    }

    // chaining the next hit of a string
    const chain = this.c.moves[this.moveKey];
    if (Array.isArray(chain) && this.step < chain.length - 1 && this.pressed(this.moveKey) && this.mt >= d.startup) {
      this.consume(this.moveKey);
      this.queued = { key: this.moveKey, step: this.step + 1 };
    }
    const isNormal = ['light', 'heavy', 'kick', 'crouchLight', 'crouchKick'].includes(this.moveKey);
    if (isNormal && this.connected && this.mt >= d.startup) {
      // cancel a connected normal into a special or super
      if (this.pressed('super') && this.meter >= 100) { this.consume('super'); return this.startMove(this.c.moves.super, 'super', 0, match); }
      if (this.pressed('special')) {
        const key = this.in.down ? 'special2' : 'special';
        if (!(this.cooldowns[key] > 0) && this.paySpecial(match)) { this.consume('special'); return this.startMove(this.c.moves[key], key, 0, match); }
      }
    }
    if (this.queued && this.mt >= activeEnd) {
      const q = this.queued;
      this.faceOpponent(opp);
      return this.startMove(this.c.moves[q.key][q.step], q.key, q.step, match);
    }

    if (this.airborne) {
      this.physics(match);
      if (this.grounded) return this.land(opp, match);
      return;
    }
    this.physics(match);
    if (this.mt >= d.dur) this.toNeutral();
  }

  /* 篮球轮回: teleport → ball drops from the sky (stun) → meditate → dribble → throw →
   * 36-hit accelerating ball rally that pins the opponent → teleport back, opponent collapses. */
  updateChickSuper(opp, match) {
    const d = this.move;
    const f = this.mt;
    if (!this.cs) {
      const center = (WALL_L + WALL_R) / 2;
      const facing = opp.x > this.x ? 1 : -1;
      const frontX = opp.x > center ? WALL_L + 56 : WALL_R - 56;    // the corner away from the opponent
      const hitTimes = [];
      let at = 0, gap = 10;
      const medEnd = 10 + 180, vanishEnd = medEnd + 6, dribbleEnd = vanishEnd + 16, vanish2End = dribbleEnd + 6;
      const throwAt = vanish2End, firstHit = throwAt + 10;
      at = firstHit;
      for (let i = 0; i < d.hits; i++) { hitTimes.push(Math.round(at)); at += gap; gap = Math.max(2, gap * 0.9); }
      const endHide = hitTimes[hitTimes.length - 1] + 14;
      this.cs = {
        phase: 'teleport', startX: this.x, frontX, facing,
        dribbleX: Math.max(WALL_L + 130, Math.min(WALL_R - 130, frontX + (opp.x - frontX) * 0.34)),
        medEnd, vanishEnd, dribbleEnd, vanish2End, throwAt, firstHit, hitTimes, endHide,
        returnAt: endHide + 6, finishAt: endHide + 14, hitIndex: 0, bodyCd: 0, sky: null, ball: null, shadow: false, x0: 0
      };
      this.facing = facing;
      this.invuln = 9999;
      this.vx = 0;
    }
    const s = this.cs;
    this.vx = 0;
    const teleport = (fromX, toX) => { match.fx.teleport(fromX, this.y); match.fx.teleport(toX, this.y); sfx('dash'); };

    // the opponent was KO'd: wrap up early
    if (opp.state === 'ko' && f < s.endHide) { s.endHide = f; s.returnAt = f + 6; s.finishAt = f + 14; }

    // ball falling from the sky onto the opponent's head
    if (s.sky && !s.sky.done) {
      const k = Math.min(1, (f - s.sky.start) / (s.sky.land - s.sky.start));
      s.sky.x = opp.x;
      s.sky.y = -60 + (opp.y - opp.c.hurtH * 0.92 + 60) * k * k;
      if (f >= s.sky.land) {
        s.sky.done = true;
        opp.move = null; opp.queued = null; opp.knockdown = false;
        opp.setState('dizzy'); opp.stun = s.firstHit - f + 4; opp.vx = 0;
        match.fx.hitSpark(opp.x, opp.y - opp.c.hurtH * 0.88, 0, true, this.c.color);
        match.fx.float(opp.x, opp.y - opp.c.hurtH - 30, tr('fxDizzy'), '#8ef0ff');
        match.shake = Math.max(match.shake, 10);
        sfx('bounce'); sfx('heavy');
      }
    }

    if (f <= 5) { this.hidden = true; s.phase = 'teleport'; }
    else if (f < 10) {
      if (this.hidden) {
        this.hidden = false;
        teleport(s.startX, s.frontX);
        this.x = s.frontX;
        s.sky = { x: opp.x, y: -60, start: f, land: f + 12, done: false };
      }
      s.phase = 'meditate';
    } else if (f < s.medEnd) {
      s.phase = 'meditate';
      if (f % 4 === 0) match.fx.superAura(this.x, this.y, this.c.color);
    } else if (f < s.vanishEnd) {
      if (!this.hidden) { this.hidden = true; match.fx.teleport(this.x, this.y); }
      s.phase = 'vanish';
    } else if (f < s.dribbleEnd) {
      if (this.hidden) {
        this.hidden = false;
        this.x = s.dribbleX;
        match.fx.teleport(this.x, this.y);
        match.fx.float(this.x, this.y - this.c.hurtH - 24, tr('fxDribble'), '#ffd23f');
        sfx('dash');
      }
      s.phase = 'dribble';
      if (f % 6 === 0) sfx('bounce');
    } else if (f < s.vanish2End) {
      this.hidden = true;
      s.phase = 'vanish';
    } else if (f < s.endHide) {
      this.hidden = false;
      s.phase = s.hitIndex >= 1 ? 'rally' : 'throw';
      if (f === s.throwAt) {
        s.x0 = this.x;
        s.ball = { x: this.x + s.facing * 46, y: GROUND - 245 };
        match.fx.float(this.x, this.y - this.c.hurtH - 24, tr('fxCatch'), '#ffe6a0');
        sfx('throw');
      }
      // creep toward the opponent as the rally speeds up
      const last = s.hitTimes[s.hitTimes.length - 1];
      const k = Math.max(0, Math.min(1, (f - s.firstHit) / Math.max(1, last - s.firstHit)));
      const targetX = Math.max(WALL_L + 38, Math.min(WALL_R - 38, opp.x - s.facing * 54));
      this.x = s.x0 + (targetX - s.x0) * k;
      // shoulder bumps when touching
      if (s.bodyCd > 0) s.bodyCd--;
      if (Math.abs(this.x - opp.x) <= (this.c.hurtW + opp.c.hurtW) / 2 + 6 && s.bodyCd <= 0 && opp.state !== 'ko') {
        s.bodyCd = 10;
        match.resolveHit(this, opp, { dmg: d.bodyDamage, hitstun: 60, blockstun: 10, push: 0.4, hitstop: 2, meter: 0, hits: 1 }, s.facing,
          opp.x, opp.y - opp.c.hurtH * 0.5, { final: false, noScale: true });
        match.fx.float(opp.x, opp.y - opp.c.hurtH * 0.5, tr('fxShoulder'), '#ffe6a0');
      }
      const next = s.hitTimes[s.hitIndex];
      if (next != null && f >= next && opp.state !== 'ko') {
        const per = Math.floor(d.dmg / d.hits);
        const final = s.hitIndex === d.hits - 1;
        const dmg = final ? d.dmg - per * (d.hits - 1) : per;
        const first = s.hitIndex === 0;
        match.resolveHit(this, opp, { dmg, hitstun: 60, blockstun: 10, push: first ? 10 : 0.6, hitstop: first ? 8 : 1, meter: 0, hits: 1 },
          s.facing, opp.x - s.facing * 30, GROUND - 245, { final: false, noScale: true });
        if (first) { match.screenFlash = Math.max(match.screenFlash, 5); match.shake = Math.max(match.shake, 18); }
        if (s.hitIndex % 2 === 1) sfx('bounce');
        s.hitIndex++;
        if (s.hitIndex === 8) {
          s.shadow = true;
          match.fx.superAura(this.x, this.y, this.c.color);
          match.fx.float(this.x, this.y - this.c.hurtH - 30, tr('fxShadow'), '#ffe6a0');
        }
      }
      // the ball travels in a straight line between the two of them
      if (s.ball) {
        const prev = s.hitIndex > 0 ? s.hitTimes[s.hitIndex - 1] : s.throwAt;
        const nxt = s.hitTimes[s.hitIndex] ?? s.endHide;
        const k2 = s.hitIndex >= s.hitTimes.length ? 1 : Math.max(0, Math.min(1, (f - prev) / Math.max(1, nxt - prev)));
        const toTarget = s.hitIndex % 2 === 0;
        const a = toTarget ? this.x + s.facing * 46 : opp.x - s.facing * 46;
        const b = toTarget ? opp.x - s.facing * 46 : this.x + s.facing * 46;
        s.ball.x = a + (b - a) * k2;
        s.ball.y = GROUND - 245;
      }
    } else {
      if (f === s.endHide) {
        this.hidden = true;
        s.ball = null; s.shadow = false;
        match.fx.teleport(this.x, this.y);
        if (opp.state !== 'ko') {
          // the opponent finally collapses
          match.resolveHit(this, opp, { dmg: 1, hitstun: 30, blockstun: 10, push: 4, hitstop: 10, meter: 0, hits: 1, knockdown: true },
            s.facing, opp.x, opp.y - opp.c.hurtH * 0.5, { final: true });
        }
        match.screenFlash = Math.max(match.screenFlash, 5);
      }
      if (f >= s.returnAt && this.hidden) {
        this.hidden = false;
        this.x = s.frontX;
        match.fx.teleport(this.x, this.y);
        s.phase = 'end';
      }
      if (f >= s.finishAt) {
        this.invuln = 8;
        this.toNeutral();
      }
    }
  }

  /* Is the current move's hitbox live this frame? */
  hitboxLive() {
    if (this.state !== 'attack' || !this.move?.hb) return false;
    const d = this.move;
    if (this.mt < d.startup || this.mt >= d.startup + d.active) return false;
    if (this.hitsDone >= d.hits) return false;
    return this.mt - this.lastHitAt >= d.gap;
  }

  hitbox() {
    const hb = this.move.hb;
    const x = this.facing > 0 ? this.x + hb.x : this.x - hb.x - hb.w;
    return { x, y: this.y - hb.y - hb.h, w: hb.w, h: hb.h };
  }

  hurtbox() {
    if (this.hidden) return null;
    if (this.state === 'down' || this.state === 'getup' || this.state === 'ko') return null;
    const h = this.crouching ? this.c.hurtH * 0.6 : this.c.hurtH;
    return { x: this.x - this.c.hurtW / 2, y: this.y - h, w: this.c.hurtW, h };
  }

  /* --------------------------------------------------------- getting hit */
  canBlock(d) {
    if (!(this.neutral || this.state === 'blockstun') || !this.grounded) return false;
    if (!(this.guardKey || this.holdingBack || this.state === 'blockstun')) return false;
    if (d.low && !(this.state === 'crouch' || this.in?.down)) return false;
    return true;
  }

  /* Returns 'block' | 'hit' | 'ko'. dir = direction the hit pushes (+1 right). */
  takeHit(att, d, dir, opts = {}) {
    if (this.canBlock(d)) {
      this.setState('blockstun');
      this.stun = d.blockstun;
      this.vx = dir * d.push * 0.9;
      const chip = opts.projectile || d.freeze != null ? Math.round(d.dmg * 0.12) : 0;
      this.hp = Math.max(1, this.hp - chip);
      return 'block';
    }
    const scale = opts.noScale ? 1 : Math.max(0.4, 1 - 0.06 * this.comboTaken);
    const dmg = Math.max(1, Math.round(d.dmg * scale));
    this.hp = Math.max(opts.noKo ? 1 : 0, this.hp - dmg);
    this.comboTaken++;
    this.comboDmg += dmg;
    this.flash = 6;
    this.move = null; this.queued = null;

    const airborne = !this.grounded;
    if (this.hp <= 0) {
      this.setState('ko');
      this.kdT = 0;
      this.vy = -11; this.vx = dir * 7; this.y = Math.min(this.y, GROUND - 1);
      return 'ko';
    }
    const knock = d.knockdown || (opts.final && d.finalKnockdown) || airborne;
    this.setState('hurt');
    if (knock) {
      this.knockdown = true;
      this.kdT = 0;
      this.vy = airborne ? -6 : -9;
      this.vx = dir * (d.push * 0.5 + 3);
      this.y = Math.min(this.y, GROUND - 1);
      this.stun = 999;
    } else {
      this.knockdown = false;
      this.stun = d.hitstun;
      this.vx = dir * d.push;
    }
    return 'hit';
  }

  updateHurt(match) {
    if (this.knockdown) {
      this.kdT++;
      this.physics(match);
      if (this.grounded && this.kdT > 4) {
        match.fx.dust(this.x, GROUND, 10);
        sfx('land');
        this.setState('down');
      }
      return;
    }
    this.vx *= 0.86;
    this.physics(match);
    if (--this.stun <= 0 && this.grounded) this.toNeutral();
  }

  /* -------------------------------------------------------------- physics */
  physics() {
    this.x += this.vx;
    if (this.y < GROUND || this.vy < 0) {
      this.vy += GRAVITY;
      this.y += this.vy;
      if (this.y >= GROUND) { this.y = GROUND; this.vy = 0; }
    }
    this.x = Math.max(WALL_L, Math.min(WALL_R, this.x));
  }

  /* -------------------------------------------------------------- animation */
  /* Which clip + frame to draw right now. */
  anim(clock) {
    const clips = this.c.clips;
    const loopFrame = (name, t = clock) => {
      const cl = clips[name];
      return Math.floor(t * cl.fps / 60) % cl.frames;
    };
    const once = (name, t) => Math.min(clips[name].frames - 1, Math.floor(t * clips[name].fps / 60));
    switch (this.state) {
      case 'attack': {
        const d = this.move;
        if (d.kind === 'chickBasketball' && this.cs) {
          const s = this.cs;
          if (s.phase === 'meditate' || s.phase === 'teleport') {
            const k = Math.max(0, Math.min(1, (this.mt - 6) / (s.medEnd - 6)));
            return { name: 'superStart', frame: Math.floor(k * (clips.superStart.frames - 1)) };
          }
          if (s.phase === 'dribble') return { name: 'atk6', frame: Math.floor(this.mt / 2) % clips.atk6.frames };
          if (s.phase === 'throw' || s.phase === 'rally') return { name: s.hitIndex % 2 ? 'atk4' : 'atk5', frame: Math.floor(clips.atk5.frames * 0.5) };
          return { name: 'idle', frame: loopFrame('idle') };
        }
        if (d.thenClip && this.mt >= d.thenAt) return { name: d.thenClip, frame: loopFrame(d.thenClip, this.mt - d.thenAt) };
        const cl = clips[d.clip];
        if (cl.loop) return { name: d.clip, frame: loopFrame(d.clip, this.mt) };
        const from = d.animFrom || 0;
        const count = d.animFrames || (cl.frames - from);
        return { name: d.clip, frame: from + Math.min(count - 1, Math.floor(this.mt / d.dur * count)) };
      }
      case 'walk': {
        const f = loopFrame('walk');
        return { name: 'walk', frame: this.walkDir < 0 ? clips.walk.frames - 1 - f : f };
      }
      case 'crouch': {
        const n = this.c.crouchClip || 'crouch';
        return { name: n, frame: clips[n].loop ? loopFrame(n) : Math.min(clips[n].frames - 1, Math.floor(this.t * 1.6)) };
      }
      case 'guard': case 'blockstun': {
        const n = this.c.guardClip || 'block';
        return { name: n, frame: loopFrame(n) };
      }
      case 'dash': {
        const n = this.dashDir > 0 ? (this.c.dashClip || 'walk') : 'walk';
        const f = Math.floor(this.t * 2) % clips[n].frames;
        return { name: n, frame: this.dashDir > 0 ? f : clips[n].frames - 1 - f };
      }
      case 'jump': {
        const j = this.c.jumpClip;
        if (j.frame != null) return { name: j.clip, frame: j.frame };
        // map rise/fall onto the clip
        const p = Math.max(0, Math.min(1, (this.vy - this.c.jumpV) / (-2 * this.c.jumpV)));
        const cl = clips[j.clip];
        return { name: j.clip, frame: Math.floor(cl.frames * 0.2 + p * cl.frames * 0.6) };
      }
      case 'hurt':
        if (this.knockdown) return { name: 'ko', frame: Math.min(Math.floor(clips.ko.frames * 0.55), once('ko', this.kdT)) };
        return { name: 'hurt', frame: Math.min(clips.hurt.frames - 1, Math.floor(this.t / Math.max(1, this.t + this.stun) * clips.hurt.frames)) };
      case 'down':
        return { name: 'ko', frame: Math.min(clips.ko.frames - 1, Math.floor(clips.ko.frames * 0.55) + Math.floor(this.t * 0.9)) };
      case 'dizzy':
        if (clips.stun) return { name: 'stun', frame: loopFrame('stun') };
        return { name: 'hurt', frame: Math.floor(clips.hurt.frames * 0.35) + (Math.floor(clock / 8) % 2) };
      case 'getup':
        return { name: 'ko', frame: Math.max(0, clips.ko.frames - 1 - Math.floor(this.t / GETUP_FRAMES * clips.ko.frames)) };
      case 'ko':
        return { name: 'ko', frame: once('ko', this.kdT) };
      case 'win':
        return { name: this.c.winClip, frame: loopFrame(this.c.winClip) };
      case 'intro':
        return { name: this.c.introClip, frame: loopFrame(this.c.introClip) };
      default:
        return { name: 'idle', frame: loopFrame('idle') };
    }
  }
}
