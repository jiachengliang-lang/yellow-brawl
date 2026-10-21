/* A match: fixed 60 Hz loop, hit detection, projectiles, rounds, HUD. */

import { CHARACTERS, PROJECTILES, ITEMS } from './data.js';
import { Fighter, WALL_L, WALL_R } from './fighter.js';
import { CpuController } from './ai.js';
import { readPlayer, blank, BUTTONS } from './input.js';
import { drawClip, getImage } from './assets.js';
import { drawCarton } from './placeholder.js';
import { drawAmbient, drawShadow, drawSuperBackdrop, drawVignette, drawKoFx, drawIntroVs, drawBanner, drawHud } from './presentation.js';
import { drawStage, W, H, GROUND } from './stage.js';
import { settings } from './settings.js';
import { Effects } from './fx.js';
import { sfx, setSfxHook, stopVoices } from './audio.js';
import { t, L } from './i18n.js';

const STEP = 1000 / 60;
const MAX_ROUNDS = 5;
const FONT = '"PingFang SC","Microsoft YaHei","Noto Sans SC",system-ui,sans-serif';

const overlap = (a, b) => a && b && a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;

export class Match {
  /**
   * opts.mode      'arcade' | 'versus' | 'training'
   * opts.chars     [p1CharId, p2CharId]
   * opts.cpu       [null | level, null | level]
   * opts.names     optional [p1Label, p2Label]
   * opts.stage     stage id
   * opts.onEnd     ({ winner: 0|1|null }) => void
   * opts.online    { role: 'host' | 'guest', send(msg) } for network matches
   */
  constructor(canvas, opts) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.opts = opts;
    this.training = opts.mode === 'training';
    this.stage = opts.stage || 'market';
    this.roundTime = settings.roundTime;
    this.winsNeeded = settings.winsNeeded;
    this.fighters = [new Fighter(opts.chars[0], 0), new Fighter(opts.chars[1], 1)];
    this.fighters.forEach(f => { f.meter = 0; });
    this.cpu = (opts.cpu || [null, null]).map(level => level ? new CpuController(level) : null);
    this.fx = new Effects();
    this.projectiles = [];
    this.round = 1;
    this.clock = 0;
    this.paused = false;
    this.running = false;
    // training options
    this.dummyMode = 'stand';
    this.infMeter = true;
    this.showBoxes = false;
    this.lastCombo = null;
    this.dummyCpu = new CpuController('normal');
    this.resetRound();

    // online: the host records sounds/effects so the guest can replay them
    this.online = opts.online || null;
    this.remoteInput = blank();
    this.events = [];
    this.lastMask = -1;
    if (this.online?.role === 'host') {
      for (const m of ['hitSpark', 'blockSpark', 'dust', 'superAura', 'float', 'teleport']) {
        const orig = this.fx[m].bind(this.fx);
        this.fx[m] = (...args) => { this.events.push(['f', m, args]); orig(...args); };
      }
      setSfxHook((name, args) => this.events.push(['s', name, args]));
    }
  }

  get isGuest() { return this.online?.role === 'guest'; }

  /* ------------------------------------------------------------ loop */
  start() {
    this.running = true;
    this.last = performance.now();
    this.acc = 0;
    const loop = (now) => {
      if (!this.running) return;
      this.acc += Math.min(250, now - this.last);
      this.last = now;
      let steps = 0;
      while (this.acc >= STEP && steps < 4) {
        if (this.isGuest) this.guestTick();
        else if (!this.paused) {
          this.step();
          if (this.online) this.sendSnapshot();
        }
        this.acc -= STEP;
        steps++;
      }
      this.render();
      this.raf = requestAnimationFrame(loop);
    };
    this.raf = requestAnimationFrame(loop);
  }

  stop() {
    this.running = false;
    cancelAnimationFrame(this.raf);
    if (this.online?.role === 'host') setSfxHook(null);
    stopVoices();
  }

  /* ------------------------------------------------------------ online */
  /* Host → guest: everything the guest needs to draw this frame. */
  serialize() {
    const F = ['x', 'y', 'vx', 'vy', 'facing', 'hp', 'redHp', 'meter', 'state', 't', 'moveKey', 'step', 'mt', 'stun',
      'knockdown', 'kdT', 'invuln', 'flash', 'wins', 'dashDir', 'walkDir', 'comboTaken', 'comboDmg', 'airborne',
      'hitsDone', 'lastHitAt', 'trail', 'stats', 'cs', 'hidden'];
    return {
      c: this.clock, ph: this.phase, pt: this.phaseT, r: this.round, tm: this.timer === Infinity ? -1 : this.timer,
      hs: this.hitstop, fz: this.freeze, fw: this.freezeWho ? this.freezeWho.side : -1, sn: this.superName,
      sh: this.shake, sl: this.slow, sf: this.screenFlash, zm: this.zoom, an: this.announce, cb: this.combo,
      w: this.winner, q: this.quotes, rt: this.roundTime, wn: this.winsNeeded,
      kk: this.koKind, kc: this.koClock, sb: this.shakeBias,
      f: this.fighters.map(f => Object.fromEntries(F.map(k => [k, f[k]]))),
      p: this.projectiles.map(p => ({ k: p.kind, o: p.owner.side, x: p.x, y: p.y, vx: p.vx, vy: p.vy, t: p.t, s: p.spin })),
      ev: this.events
    };
  }

  sendSnapshot() {
    const round = (k, v) => (typeof v === 'number' && !Number.isInteger(v) ? Math.round(v * 100) / 100 : v);
    this.online.send(`{"type":"snap","d":${JSON.stringify(this.serialize(), round)}}`);
    this.events = [];
  }

  /* Guest: overwrite local state with the host's snapshot, then replay its sounds/effects. */
  applySnapshot(d) {
    this.clock = d.c; this.phase = d.ph; this.phaseT = d.pt; this.round = d.r;
    this.timer = d.tm < 0 ? Infinity : d.tm;
    this.hitstop = d.hs; this.freeze = d.fz; this.freezeWho = d.fw >= 0 ? this.fighters[d.fw] : null;
    this.superName = d.sn; this.shake = d.sh; this.slow = d.sl; this.screenFlash = d.sf;
    this.zoom = d.zm; this.announce = d.an; this.combo = d.cb; this.winner = d.w; this.quotes = d.q;
    this.roundTime = d.rt; this.winsNeeded = d.wn;
    this.koKind = d.kk; this.koClock = d.kc; this.shakeBias = d.sb || 0;
    d.f.forEach((src, i) => {
      const f = this.fighters[i];
      Object.assign(f, src);
      const mv = src.moveKey ? f.c.moves[src.moveKey] : null;
      f.move = Array.isArray(mv) ? mv[src.step] : mv;
    });
    this.projectiles = d.p.map(p => ({
      kind: p.k, info: PROJECTILES[p.k], owner: this.fighters[p.o],
      x: p.x, y: p.y, vx: p.vx, vy: p.vy, t: p.t, spin: p.s, alive: true
    }));
    for (const e of d.ev || []) {
      if (e[0] === 'f') this.fx[e[1]]?.(...e[2]);
      else if (e[0] === 's') sfx(e[1], ...(e[2] || []));
    }
  }

  /* Guest: send our buttons (on change, plus a periodic refresh), keep local effects moving. */
  guestTick() {
    const inp = readPlayer('p1');
    let mask = 0;
    BUTTONS.forEach((b, i) => { if (inp[b]) mask |= 1 << i; });
    this.guestFrame = (this.guestFrame || 0) + 1;
    if (mask !== this.lastMask || this.guestFrame % 15 === 0) {
      this.online.send({ type: 'input', m: mask });
      this.lastMask = mask;
    }
    this.fx.update(this.hitstop > 0 ? 0.25 : 1);
  }

  /* Host: latest buttons from the guest. */
  setRemoteInput(mask) {
    const s = blank();
    BUTTONS.forEach((b, i) => { s[b] = !!(mask & (1 << i)); });
    this.remoteInput = s;
  }

  /* ------------------------------------------------------------ rounds */
  resetRound() {
    const [a, b] = this.fighters;
    a.reset(400); b.reset(880);
    this.projectiles = [];
    this.fx.clear();
    this.hitstop = 0; this.freeze = 0; this.freezeWho = null;
    this.shake = 0; this.slow = 0;
    this.timer = this.roundTime || Infinity;
    this.screenFlash = 0;
    this.zoom = null;
    this.shakeBias = 0;
    this.koKind = null; this.koClock = null;
    this.timerFrames = 0;
    this.combo = [null, null];
    this.announce = null;
    this.winner = null;
    if (this.training) {
      this.phase = 'fight';
      a.setState('idle'); b.setState('idle');
    } else {
      this.phase = 'intro';
      this.phaseT = 0;
    }
  }

  say(text, opts = {}) {
    this.announce = { text, sub: opts.sub || '', t: 0, dur: opts.dur || 70, style: opts.style || 'round' };
  }

  /* ------------------------------------------------------------ simulation */
  step() {
    this.clock++;
    if (this.announce && ++this.announce.t > this.announce.dur) this.announce = null;
    if (this.shake > 0) this.shake *= 0.86;
    if (this.shake < 0.3) this.shake = 0;

    if (this.hitstop > 0) { this.hitstop--; this.fx.update(0.25); return; }
    if (this.freeze > 0) {
      this.freeze--;
      const f = this.freezeWho;
      this.fx.superAura(f.x, f.y, f.c.color);
      this.fx.update(0.6);
      return;
    }
    if (this.slow > 0) { this.slow--; if (this.slow % 2) { this.fx.update(0.5); return; } }

    this.updatePhase();
    const canAct = this.phase === 'fight';
    const [a, b] = this.fighters;
    const inputs = [0, 1].map(i => canAct ? this.inputFor(i) : blank());
    a.update(inputs[0], b, this);
    b.update(inputs[1], a, this);

    this.separate(a, b);
    this.checkHit(a, b);
    this.checkHit(b, a);
    this.updateProjectiles();
    this.trackCombos();

    if (this.training) this.updateTraining();
    this.fx.update(1);
  }

  inputFor(i) {
    const f = this.fighters[i], o = this.fighters[1 - i];
    if (this.training && i === 1) return this.dummyInput(f, o);
    if (this.online && i === 1) return this.remoteInput;
    if (this.cpu[i]) return this.cpu[i].next(f, o, this);
    return readPlayer(i === 0 ? 'p1' : 'p2');
  }

  updatePhase() {
    const [a, b] = this.fighters;
    if (this.training) return;
    this.phaseT++;
    if (this.phase === 'intro') {
      // round 1: VS panels (0–80), each fighter's line, then ROUND / FIGHT
      const q = this.round === 1 ? 165 : 0;
      if (this.round === 1 && this.phaseT === 8) sfx('vs');
      if (q && this.phaseT === 82) this.quotes = [{ side: 0, t: 0 }, { side: 1, t: -30 }];
      if (this.phaseT === q + 10) {
        const need = this.winsNeeded;
        const final = this.round === MAX_ROUNDS || (need > 1 && a.wins === need - 1 && b.wins === need - 1);
        this.say(final ? t('finalRound') : t('round', { n: this.round }), { dur: 62, style: final ? 'final' : 'round', sub: final ? '' : `${this.nameOf(0)}  VS  ${this.nameOf(1)}` });
        sfx('round');
      }
      if (this.phaseT === q + 72) { this.say(t('fight'), { dur: 42, style: 'fight' }); sfx('fight'); a.toNeutral(); b.toNeutral(); this.quotes = null; }
      if (this.phaseT >= q + 76) { this.phase = 'fight'; this.phaseT = 0; }
    } else if (this.phase === 'fight') {
      if (this.roundTime && ++this.timerFrames >= 60) {
        this.timerFrames = 0;
        this.timer--;
        if (this.timer <= 0) this.timeOver();
      }
    } else if (this.phase === 'ko') {
      const loser = this.winner == null ? null : this.fighters[1 - this.winner];
      const settled = !loser || loser.state !== 'ko' || (loser.grounded && loser.kdT > 50);
      if (this.phaseT > 100 && settled && !this.winShown) {
        this.winShown = true;
        if (this.winner != null) {
          const w = this.fighters[this.winner];
          w.vx = 0; w.setState('win');
          this.say(t('wins', { name: this.nameOf(this.winner) }), { dur: 120, style: 'win', sub: this.perfect ? t('perfect') : '' });
          sfx('win');
          sfx('quote', w.id);
        } else {
          this.say(t('draw'), { dur: 120, style: 'time' });
        }
        this.phaseT = 100;
      }
      if (this.winShown && this.phaseT > 230) this.endRound();
    }
  }

  onKO(winnerSide) {
    this.phase = 'ko'; this.phaseT = 0; this.winShown = false;
    this.winner = winnerSide;
    const w = this.fighters[winnerSide];
    this.perfect = w.hp === w.c.hp;
    this.hitstop = 28; this.slow = 80; this.shake = 16;
    this.screenFlash = 8;
    const loser = this.fighters[1 - winnerSide];
    this.zoom = { x: loser.x, y: loser.y - 150, t: 0, dur: 150 };
    this.projectiles = [];
    this.koKind = 'ko'; this.koClock = this.clock;
    this.say(t('ko'), { dur: 96, style: 'ko' });
    sfx('ko');
  }

  timeOver() {
    const [a, b] = this.fighters;
    const ra = a.hp / a.c.hp, rb = b.hp / b.c.hp;
    this.phase = 'ko'; this.phaseT = 40; this.winShown = false; this.perfect = false;
    this.winner = ra === rb ? null : ra > rb ? 0 : 1;
    if (this.winner != null) this.fighters[1 - this.winner].setState('lose');
    this.koKind = 'time'; this.koClock = this.clock;
    this.say(t('timeOver'), { dur: 70, style: 'time' });
  }

  endRound() {
    if (this.winner != null) this.fighters[this.winner].wins++;
    const [a, b] = this.fighters;
    if (a.wins >= this.winsNeeded || b.wins >= this.winsNeeded || this.round >= MAX_ROUNDS) {
      this.phase = 'over';
      const winner = a.wins === b.wins ? null : a.wins > b.wins ? 0 : 1;
      this.opts.onEnd?.({ winner, wins: [a.wins, b.wins] });
      return;
    }
    this.round++;
    this.resetRound();
  }

  nameOf(i) {
    return this.opts.names?.[i] || L(this.fighters[i].c.name);
  }

  /* ------------------------------------------------------------ physics & hits */
  separate(a, b) {
    if (Math.abs(a.y - b.y) > 170) return;
    const minD = (a.c.hurtW + b.c.hurtW) / 2 * 0.72;
    const dx = b.x - a.x;
    if (Math.abs(dx) >= minD) return;
    const dir = dx === 0 ? (a.facing || 1) : Math.sign(dx);
    let push = (minD - Math.abs(dx)) / 2;
    a.x -= dir * push; b.x += dir * push;
    // whoever is pinned against a wall pushes the other one out instead
    for (const [f, o, s] of [[a, b, -dir], [b, a, dir]]) {
      const clamped = Math.max(WALL_L, Math.min(WALL_R, f.x));
      if (clamped !== f.x) { o.x += clamped - f.x; f.x = clamped; }
    }
  }

  checkHit(att, def) {
    if (!att.hitboxLive() || def.invuln > 0) return;
    const hb = att.hitbox();
    const hu = def.hurtbox();
    if (!overlap(hb, hu)) return;
    const d = att.move;
    att.hitsDone++;
    att.lastHitAt = att.mt;
    const final = att.hitsDone >= d.hits;
    const move = final && d.lastDmg ? { ...d, dmg: d.lastDmg } : d;
    const px = (Math.max(hb.x, hu.x) + Math.min(hb.x + hb.w, hu.x + hu.w)) / 2;
    const py = (Math.max(hb.y, hu.y) + Math.min(hb.y + hb.h, hu.y + hu.h)) / 2;
    this.resolveHit(att, def, move, att.facing, px, py, { final, noScale: !!d.noScale });
  }

  resolveHit(att, def, d, dir, px, py, opts) {
    const hpBefore = def.hp;
    // counter hit: the defender was in the middle of their own attack
    const counter = def.state === 'attack' && def.move && def.mt < def.move.startup + def.move.active;
    const res = def.takeHit(att, d, dir, { ...opts, noKo: this.training || this.phase !== 'fight' });
    if (res === 'block') def.stats.blocks++;
    else {
      att.stats.dealt += hpBefore - def.hp;
      att.stats.hits++;
      att.stats.maxCombo = Math.max(att.stats.maxCombo, def.comboTaken);
    }
    if (res === 'block') {
      this.fx.blockSpark(px, py, dir);
      sfx('block');
      this.hitstop = Math.max(this.hitstop, 4);
      att.meter = Math.min(100, att.meter + d.meter * 0.5);
    } else {
      att.connected = true;
      const heavy = d.dmg >= 60 || d.knockdown || (opts.final && d.finalKnockdown);
      this.fx.hitSpark(px, py, dir, heavy, att.c.color);
      sfx(heavy ? 'heavy' : 'light');
      if (att.id === 'chick') sfx('chickHit', heavy);
      if (heavy && (d.knockdown || opts.final) && res === 'hit') sfx('ooh');
      this.hitstop = Math.max(this.hitstop, d.hitstop + (counter ? 3 : 0));
      this.shake = Math.max(this.shake, heavy ? 9 : 3);
      this.shakeBias = dir * (heavy ? 14 : 6);
      if (counter && res === 'hit') this.fx.float(px, py - 70, 'COUNTER', '#ff8a3d');
      if (d.knockdown || (opts.final && d.finalKnockdown)) this.screenFlash = Math.max(this.screenFlash, 3);
      att.meter = Math.min(100, att.meter + d.meter * 0.7);
      this.combo[att.side] = { hits: def.comboTaken, dmg: def.comboDmg, t: 100, pop: 8 };
    }
    // pinned against the wall: the attacker gets pushed back instead
    if (res !== 'ko' && (def.x <= WALL_L + 4 || def.x >= WALL_R - 4) && !opts.projectile) {
      att.vx = -dir * d.push * 0.8;
    }
    if (res === 'ko') this.onKO(att.side);
  }

  /* ------------------------------------------------------------ projectiles */
  spawnProjectile(owner, spec) {
    const info = PROJECTILES[spec.kind];
    this.projectiles.push({
      owner, kind: spec.kind, info,
      x: owner.x + owner.facing * (spec.x ?? 60),
      y: owner.y - (spec.y ?? 180),
      vx: owner.facing * (spec.vx ?? spec.speed ?? 10),
      vy: spec.vy ?? 0,
      gravity: spec.gravity ?? 0,
      t: 0, spin: 0, alive: true,
      bounces: 0,
      hit: {
        dmg: spec.dmg, hitstun: spec.hitstun ?? 18, blockstun: 10, push: spec.knockdown ? 6 : 2.5,
        hitstop: spec.knockdown ? 10 : 4, meter: 3, knockdown: !!spec.knockdown, low: false, hits: 1, noScale: !!spec.noScale
      }
    });
  }

  updateProjectiles() {
    for (const p of this.projectiles) {
      p.t++;
      p.vy += p.gravity;
      p.x += p.vx; p.y += p.vy;
      p.spin += (p.info.spin || 0) * Math.sign(p.vx);
      const radius = p.info.r || 10;
      if (p.y > GROUND - radius) {
        if (p.info.bounce && p.bounces < p.info.bounce) {
          p.y = GROUND - radius; p.vy = -Math.abs(p.vy) * 0.68; p.bounces++;
          this.fx.dust(p.x, GROUND, 3);
          sfx('bounce');
        } else {
          p.alive = false;
          this.fx.dust(p.x, GROUND, 5);
        }
      }
      if (p.x < -100 || p.x > W + 100 || p.t > 240) p.alive = false;
      if (!p.alive) continue;
      const box = { x: p.x - p.info.w / 2, y: p.y - p.info.h / 2, w: p.info.w, h: p.info.h };
      const target = this.fighters[1 - p.owner.side];
      if (target.invuln <= 0 && overlap(box, target.hurtbox())) {
        p.alive = false;
        this.resolveHit(p.owner, target, p.hit, Math.sign(p.vx), p.x, p.y, { projectile: true, final: true, noScale: p.hit.noScale });
      }
    }
    // opposing projectiles cancel each other out
    for (const p of this.projectiles) for (const q of this.projectiles) {
      if (p.alive && q.alive && p.owner !== q.owner && Math.abs(p.x - q.x) < 50 && Math.abs(p.y - q.y) < 60) {
        p.alive = q.alive = false;
        this.fx.hitSpark((p.x + q.x) / 2, (p.y + q.y) / 2, 1, false, '#ffffff');
        sfx('block');
      }
    }
    this.projectiles = this.projectiles.filter(p => p.alive);
  }

  startSuper(f, frames) {
    this.freeze = frames;
    this.freezeWho = f;
    this.superName = L(f.c.moves.super.label);
    f.stats.supers++;
    sfx('super');
    sfx('superVoice', f.id);
  }

  trackCombos() {
    for (const f of this.fighters) {
      const recovered = f.neutral || f.state === 'jump' || f.state === 'attack' || f.state === 'getup';
      if (recovered && f.comboTaken > 0) {
        if (this.training && f.side === 1) this.lastCombo = { hits: f.comboTaken, dmg: f.comboDmg };
        f.comboTaken = 0; f.comboDmg = 0;
      }
    }
    for (const c of this.combo) if (c) { c.t--; if (c.pop > 0) c.pop--; }
  }

  /* ------------------------------------------------------------ training */
  dummyInput(dummy, player) {
    const s = blank();
    const back = player.x > dummy.x ? 'left' : 'right';
    switch (this.dummyMode) {
      case 'crouch': s.down = true; break;
      case 'jump': s.up = dummy.grounded && this.clock % 50 === 0; break;
      case 'block':
        s[back] = true;
        s.down = !!(player.state === 'attack' && player.move?.low);
        break;
      case 'cpu': return this.dummyCpu.next(dummy, player, this);
    }
    return s;
  }

  updateTraining() {
    const [p, d] = this.fighters;
    if (this.infMeter) p.meter = 100;
    for (const f of this.fighters) {
      const idle = f.neutral && f.comboTaken === 0;
      f.idleT = idle ? (f.idleT || 0) + 1 : 0;
      if (f.idleT > 50 && f.hp < f.c.hp) { f.hp = f.c.hp; f.redHp = f.c.hp; }
    }
    if (this.dummyMode === 'cpu') d.meter = Math.min(100, d.meter + 0.05);
  }

  resetPositions() {
    const [a, b] = this.fighters;
    a.reset(400); b.reset(880);
    a.setState('idle'); b.setState('idle');
    this.projectiles = [];
    this.lastCombo = null;
  }

  /* ------------------------------------------------------------ rendering */
  render() {
    const ctx = this.ctx;
    // camera shake leans in the direction of the last hit
    const sx = this.shake ? (Math.random() - 0.5) * this.shake * 1.6 + this.shakeBias * (this.shake / 16) : 0;
    const sy = this.shake ? (Math.random() - 0.5) * this.shake * 1.2 : 0;
    if (this.shake < 1) this.shakeBias = 0;
    ctx.save();
    ctx.clearRect(0, 0, W, H);
    // KO camera: brief zoom toward the loser
    let z = 1;
    if (this.zoom) {
      const k = this.zoom.t / this.zoom.dur;
      z = 1 + 0.16 * Math.sin(Math.min(1, k) * Math.PI);
      if (++this.zoom.t > this.zoom.dur) this.zoom = null;
    }
    if (z !== 1) {
      const fx = Math.max(W / 2 / z, Math.min(W - W / 2 / z, this.zoom.x));
      const fy = Math.max(H / 2 / z, Math.min(H - H / 2 / z, this.zoom.y));
      ctx.translate(W / 2, H / 2); ctx.scale(z, z); ctx.translate(-fx, -fy);
    }
    // super freeze: drain colour from the stage so the attacker pops
    if (this.freeze > 0) ctx.filter = 'saturate(.25) brightness(.5)';
    drawStage(ctx, this.stage, this.clock, sx, sy);
    ctx.filter = 'none';
    ctx.translate(sx, sy);
    if (this.freeze > 0) drawSuperBackdrop(ctx, this);
    else drawAmbient(ctx, this);

    for (const f of this.fighters) if (!f.hidden) drawShadow(ctx, f);
    // the attacking fighter is drawn on top
    const order = [...this.fighters].sort((a, b) => (a.state === 'attack') - (b.state === 'attack'));
    for (const f of order) this.drawTrail(ctx, f);
    for (const f of order) this.drawFighter(ctx, f);

    for (const p of this.projectiles) this.drawProjectile(ctx, p);
    for (const f of this.fighters) this.drawSuperProps(ctx, f);
    this.fx.draw(ctx);
    if (this.showBoxes) this.drawBoxes(ctx);
    ctx.restore();

    drawVignette(ctx);
    if (this.screenFlash > 0) {
      ctx.fillStyle = `rgba(255,255,255,${this.screenFlash / 10})`;
      ctx.fillRect(0, 0, W, H);
      if (!this.paused) this.screenFlash--;
    }
    drawKoFx(ctx, this);
    if (this.freeze > 0) this.drawSuperCutIn(ctx);
    if (!(this.phase === 'intro' && this.round === 1 && this.phaseT < 80)) drawHud(ctx, this);
    drawIntroVs(ctx, this);
    this.drawQuotes(ctx);
    drawBanner(ctx, this);
  }

  /* 篮球轮回 props: the ball dropping from the sky and the rally ball. */
  drawSuperProps(ctx, f) {
    const s = f.cs;
    if (!s) return;
    for (const b of [s.sky && !s.sky.done ? s.sky : null, s.ball]) {
      if (!b) continue;
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      const g = ctx.createRadialGradient(b.x, b.y, 4, b.x, b.y, 54);
      g.addColorStop(0, 'rgba(255,200,120,.6)'); g.addColorStop(1, 'rgba(255,140,40,0)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(b.x, b.y, 54, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
      drawBall(ctx, b.x, b.y, 26, this.clock * 0.35);
    }
  }

  drawFighter(ctx, f) {
    if (f.hidden) return;
    const a = f.anim(this.clock);
    const clip = f.c.clips[a.name];
    let filter = null, alpha = null;
    // mirror match: tint player 2 so the two are easy to tell apart
    if (f.side === 1 && this.fighters[0].id === f.id) filter = 'hue-rotate(-28deg) saturate(1.35) brightness(.92)';
    if (f.flash > 0) filter = 'brightness(1.9) saturate(0.6)';
    if (f.state === 'getup' && this.clock % 4 < 2) alpha = 0.6;
    if (f.state === 'attack' && f.move?.invuln && f.invuln > 0) filter = 'drop-shadow(0 0 14px rgba(255,220,120,.95))';
    const jolt = this.hitstop > 0 && f.flash > 0 ? (Math.random() - 0.5) * 9 : 0;
    // 篮球轮回 shadow clones trailing behind
    if (f.cs?.shadow) {
      for (const k of [2, 1]) {
        drawClip(ctx, clip, a.frame, f.x - f.facing * 58 * k, f.y - 6 * k, f.facing, { alpha: 0.32 / k, filter: 'brightness(1.6) saturate(.4)', state: f.state });
      }
    }
    drawClip(ctx, clip, a.frame, f.x + jolt, f.y, f.facing, { filter, alpha, state: f.state });
    // dizzy stars circling the head
    if (f.state === 'dizzy') {
      const hy = f.y - f.c.hurtH - 18;
      ctx.save();
      for (let i = 0; i < 3; i++) {
        const ang = this.clock * 0.12 + i * (Math.PI * 2 / 3);
        const sx = f.x + Math.cos(ang) * 46, sy = hy + Math.sin(ang) * 12;
        ctx.fillStyle = i % 2 ? '#fff4bd' : '#8ef0ff';
        ctx.beginPath();
        for (let j = 0; j < 10; j++) { const r = j % 2 ? 4 : 10; const t2 = j / 10 * Math.PI * 2 - Math.PI / 2; ctx.lineTo(sx + Math.cos(t2) * r, sy + Math.sin(t2) * r); }
        ctx.closePath(); ctx.fill();
      }
      ctx.restore();
    }
    // sound-wave rings in front of the singer
    if (f.state === 'attack' && f.move?.wave && f.mt >= f.move.startup && f.mt < f.move.startup + f.move.active) {
      const k = (f.mt - f.move.startup) / f.move.active;
      ctx.save();
      ctx.strokeStyle = '#9fe8ff'; ctx.lineCap = 'round';
      for (let i = 0; i < 3; i++) {
        const r = 40 + ((k * 3 + i / 3) % 1) * 220;
        ctx.globalAlpha = 0.8 * (1 - r / 260);
        ctx.lineWidth = 6;
        ctx.beginPath(); ctx.arc(f.x + f.facing * 40, f.y - 190, r, f.facing > 0 ? -0.6 : Math.PI - 0.6, f.facing > 0 ? 0.6 : Math.PI + 0.6); ctx.stroke();
      }
      ctx.restore();
    }
  }

  drawTrail(ctx, f) {
    for (const g of f.trail) {
      const clip = f.c.clips[g.name];
      drawClip(ctx, clip, g.frame, g.x, g.y, g.facing, {
        alpha: (g.life / 12) * 0.35,
        filter: 'brightness(1.6) saturate(0.35)'
      });
    }
  }

  drawQuotes(ctx) {
    if (!this.quotes) return;
    for (const q of this.quotes) {
      q.t++;
      if (q.t < 0) continue;
      const f = this.fighters[q.side];
      const text = L(f.c.introQuote);
      if (!text) continue;
      const a = Math.min(1, q.t / 10);
      ctx.save();
      ctx.globalAlpha = a;
      ctx.font = `800 20px ${FONT}`;
      const w = ctx.measureText(text).width + 32;
      const x = Math.max(20, Math.min(W - 20 - w, f.x - w / 2));
      const y = GROUND - 420 - (1 - a) * 10;
      ctx.fillStyle = 'rgba(255,250,235,.96)';
      roundRect(ctx, x, y, w, 46, 14); ctx.fill();
      ctx.beginPath(); ctx.moveTo(f.x - 10, y + 46); ctx.lineTo(f.x, y + 62); ctx.lineTo(f.x + 10, y + 46); ctx.fill();
      ctx.fillStyle = '#2a1500'; ctx.textAlign = 'left';
      ctx.fillText(text, x + 16, y + 30);
      ctx.restore();
    }
  }

  drawProjectile(ctx, p) {
    if (p.info.glow) {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      const g = ctx.createRadialGradient(p.x, p.y, 4, p.x, p.y, 60);
      g.addColorStop(0, p.info.glow); g.addColorStop(1, 'rgba(255,200,60,0)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(p.x, p.y, 60, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
    }
    if (p.info.clip) {
      const clip = CHARACTERS[p.info.char].clips[p.info.clip];
      drawClip(ctx, clip, Math.floor(p.t * clip.fps / 60) % clip.frames, p.x, p.y + p.info.drawOffset, Math.sign(p.vx), { scale: 1.05 });
    } else if (p.info.draw === 'ball') {
      drawBall(ctx, p.x, p.y, p.info.r, p.spin);
    } else {
      const img = getImage(ITEMS[p.info.image]);
      if (!img) { drawCarton(ctx, p.x, p.y, 0.9, p.spin); return; }
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.spin);
      ctx.drawImage(img, -p.info.drawW / 2, -p.info.drawH / 2, p.info.drawW, p.info.drawH);
      ctx.restore();
    }
  }

  drawBoxes(ctx) {
    ctx.save();
    ctx.lineWidth = 2;
    for (const f of this.fighters) {
      const hu = f.hurtbox();
      if (hu) { ctx.strokeStyle = f.invuln > 0 ? '#9a9aff' : '#3dff8a'; ctx.strokeRect(hu.x, hu.y, hu.w, hu.h); }
      if (f.hitboxLive()) {
        const hb = f.hitbox();
        ctx.fillStyle = 'rgba(255,40,40,.3)'; ctx.fillRect(hb.x, hb.y, hb.w, hb.h);
        ctx.strokeStyle = '#ff3b3b'; ctx.strokeRect(hb.x, hb.y, hb.w, hb.h);
      }
      ctx.fillStyle = '#fff'; ctx.fillRect(f.x - 1, f.y - 8, 2, 8);
    }
    for (const p of this.projectiles) {
      ctx.strokeStyle = '#ff3b3b';
      ctx.strokeRect(p.x - p.info.w / 2, p.y - p.info.h / 2, p.info.w, p.info.h);
    }
    ctx.restore();
  }

  drawSuperCutIn(ctx) {
    const f = this.freezeWho;
    const total = f.move?.freeze || 40;
    const k = 1 - this.freeze / total;            // 0 → 1
    const slide = Math.min(1, k * 4);
    const out = k > 0.85 ? (k - 0.85) / 0.15 : 0;
    const dir = f.side === 0 ? 1 : -1;
    ctx.save();
    ctx.globalAlpha = 1 - out;
    const y = 250;
    ctx.translate((1 - slide) * -W * dir, 0);
    const band = ctx.createLinearGradient(0, y, 0, y + 200);
    band.addColorStop(0, f.c.color); band.addColorStop(1, '#ff5a2a');
    ctx.fillStyle = band;
    ctx.beginPath(); ctx.moveTo(0, y + 30); ctx.lineTo(W, y); ctx.lineTo(W, y + 170); ctx.lineTo(0, y + 200); ctx.closePath(); ctx.fill();
    // speed lines
    ctx.strokeStyle = 'rgba(255,255,255,.35)'; ctx.lineWidth = 3;
    for (let i = 0; i < 14; i++) {
      const ly = y + 20 + i * 12;
      const off = (this.clock * 40 + i * 97) % W;
      ctx.beginPath(); ctx.moveTo(off, ly); ctx.lineTo(off + 120, ly); ctx.stroke();
    }
    const card = getImage(f.c.card);
    if (card) {
      ctx.save();
      ctx.beginPath(); ctx.moveTo(0, y + 30); ctx.lineTo(W, y); ctx.lineTo(W, y + 170); ctx.lineTo(0, y + 200); ctx.closePath(); ctx.clip();
      const cx = f.side === 0 ? 120 : W - 120 - 360;
      ctx.drawImage(card, 0, 80, 800, 600, cx, y - 40, 360, 270);
      ctx.restore();
    }
    ctx.textAlign = f.side === 0 ? 'left' : 'right';
    const tx = f.side === 0 ? 520 : W - 520;
    ctx.font = `900 64px ${FONT}`;
    ctx.lineWidth = 10; ctx.strokeStyle = '#3a1500'; ctx.fillStyle = '#fff';
    ctx.strokeText(this.superName, tx, y + 110); ctx.fillText(this.superName, tx, y + 110);
    ctx.font = `800 20px ${FONT}`; ctx.fillStyle = '#3a1500';
    ctx.fillText('SUPER  ·  ' + L(f.c.name), tx, y + 145);
    ctx.restore();
  }
}

function drawBall(ctx, x, y, r, angle) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  const g = ctx.createRadialGradient(-r * 0.35, -r * 0.35, r * 0.1, 0, 0, r);
  g.addColorStop(0, '#ffb15a'); g.addColorStop(1, '#c4520f');
  ctx.fillStyle = g;
  ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = '#3a1500'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(-r, 0); ctx.lineTo(r, 0); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(0, -r); ctx.lineTo(0, r); ctx.stroke();
  ctx.beginPath(); ctx.arc(-r * 1.25, 0, r * 0.95, -0.75, 0.75); ctx.stroke();
  ctx.beginPath(); ctx.arc(r * 1.25, 0, r * 0.95, Math.PI - 0.75, Math.PI + 0.75); ctx.stroke();
  ctx.restore();
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}
