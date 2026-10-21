/* One fighter: state machine, movement, attacks and hit reactions.
 * Purely frame-based: call update() exactly once per 60 Hz simulation step.
 */

import { CHARACTERS } from './data.js';
import { GROUND } from './stage.js';
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
      case 'jump': this.updateJump(opp, match); break;
      case 'dash': this.updateDash(opp, match); break;
      case 'attack': this.updateAttack(opp, match); break;
      default: this.updateNeutral(opp, match);
    }
  }

  toNeutral() {
    this.move = null; this.moveKey = null; this.queued = null;
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
      if (!(this.cooldowns[key] > 0)) { this.consume('special'); return this.startMove(mv[key], key, 0, match); }
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

  /* --------------------------------------------------------------- attacks */
  startMove(def, key, step, match, airborne = false) {
    this.move = def; this.moveKey = key; this.step = step;
    this.mt = 0; this.queued = null; this.connected = false;
    this.hitsDone = 0; this.lastHitAt = -999; this.barrageIdx = 0;
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
        match.spawnProjectile(this, { ...b, y: b.y + wave, x: 60, vx: b.speed, knockdown: last }, true);
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
        if (!(this.cooldowns[key] > 0)) { this.consume('special'); return this.startMove(this.c.moves[key], key, 0, match); }
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
      this.meter = Math.min(100, this.meter + 2);
      return 'block';
    }
    const scale = Math.max(0.4, 1 - 0.06 * this.comboTaken);
    const dmg = Math.max(1, Math.round(d.dmg * scale));
    this.hp = Math.max(opts.noKo ? 1 : 0, this.hp - dmg);
    this.comboTaken++;
    this.comboDmg += dmg;
    this.meter = Math.min(100, this.meter + dmg * 0.035);
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
