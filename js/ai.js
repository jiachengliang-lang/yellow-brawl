/* CPU opponent. Produces the same button states a human would,
 * so it plays by exactly the same rules as the player.
 */

import { blank } from './input.js';

const LEVELS = {
  easy:   { react: 20, block: 0.18, aggr: 0.35, think: 24, cancel: 0.0, antiAir: 0.15 },
  normal: { react: 12, block: 0.45, aggr: 0.55, think: 12, cancel: 0.3, antiAir: 0.4 },
  hard:   { react: 6,  block: 0.72, aggr: 0.75, think: 6,  cancel: 0.8, antiAir: 0.7 }
};

const rand = (a, b) => a + Math.random() * (b - a);
const chance = (p) => Math.random() < p;

export class CpuController {
  constructor(level = 'normal') {
    this.p = LEVELS[level] || LEVELS.normal;
    this.queue = [];
    this.wait = 30;
    this.seenMove = null;
    this.seenProj = new WeakSet();
    this.blocking = 0;
  }

  /* ---- plan helpers: each step is { inp, frames } */
  hold(buttons, frames) { this.queue.push({ inp: buttons, frames: Math.round(frames) }); }
  tap(buttons) { this.hold(buttons, 1); this.hold({}, 1); }
  idle(frames) { this.hold({}, frames); }

  next(self, opp, match) {
    const fwd = opp.x > self.x ? 'right' : 'left';
    const back = fwd === 'right' ? 'left' : 'right';
    this.reactToThreats(self, opp, match, back);

    let step = this.queue[0];
    if (!step && --this.wait <= 0 && (self.neutral || self.state === 'jump')) {
      this.decide(self, opp, fwd, back);
      this.wait = this.p.think + rand(0, this.p.think);
      step = this.queue[0];
    }
    const out = blank();
    if (step) {
      Object.assign(out, step.inp);
      if (--step.frames <= 0) this.queue.shift();
    }
    // specials cost half a bar outside training: don't press them without the meter
    if (out.special && !match.training && self.meter < 50) out.special = false;
    // hit-confirm: cancel a connected normal into a special
    if (self.state === 'attack' && self.connected && !this.cancelled && chance(this.p.cancel * 0.12)) {
      this.queue = [];
      this.tap({ special: true, down: chance(0.4) });
      this.cancelled = true;
    }
    if (self.state !== 'attack') this.cancelled = false;
    return out;
  }

  reactToThreats(self, opp, match, back) {
    if (!self.neutral) return;
    // a new attack from the opponent
    if (opp.state === 'attack' && opp.move !== this.seenMove) {
      this.seenMove = opp.move;
      const d = Math.abs(opp.x - self.x);
      const reach = (opp.move.hb ? opp.move.hb.x + opp.move.hb.w : 900) + 120;
      if (d < reach && chance(this.p.block)) {
        const remaining = (opp.move.dur || 30) + 10;
        this.queue = [];
        this.idle(Math.max(1, this.p.react - 4));
        this.hold({ [back]: true, down: !!opp.move.low || chance(0.2) }, remaining);
      }
    }
    if (opp.state !== 'attack') this.seenMove = null;
    // incoming projectiles
    for (const pr of match.projectiles) {
      if (pr.owner === self || this.seenProj.has(pr)) continue;
      if (Math.abs(pr.x - self.x) < 380) {
        this.seenProj.add(pr);
        if (chance(this.p.block)) {
          this.queue = [];
          this.hold({ [back]: true }, 26);
        }
      }
    }
  }

  decide(self, opp, fwd, back) {
    const d = Math.abs(opp.x - self.x);
    const p = this.p;
    // fighters with a projectile dash attack (forward + J) can zone from range
    const zoner = !!self.c.moves.dashLight?.spawn;
    const shoot = () => this.tap({ [fwd]: true, light: true });
    const dashHeavy = () => this.tap({ [fwd]: true, heavy: true });

    if (opp.state === 'down' || opp.state === 'getup') {
      if (d > 260) this.hold({ [fwd]: true }, rand(10, 20));
      else this.idle(rand(8, 18));
      return;
    }
    if (opp.state === 'jump' && d < 320 && chance(p.antiAir)) {
      this.tap({ heavy: true });
      return;
    }
    if (self.meter >= 100 && d < 640 && chance(0.25 + p.aggr * 0.3)) {
      this.tap({ super: true });
      return;
    }

    if (d > 340) {
      if (zoner && chance(0.28)) shoot();
      else if (!zoner && d < 470 && chance(0.12)) this.tap({ special: true });
      else if (chance(0.1)) this.hold({ up: true, [fwd]: true }, 4);
      else if (chance(0.2 * p.aggr)) { this.tap({ [fwd]: true }); this.idle(2); this.tap({ [fwd]: true }); this.idle(10); }
      else this.hold({ [fwd]: true }, rand(14, 34));
      return;
    }
    if (d > 210) {
      const r = Math.random();
      if (r < 0.25) this.tap({ kick: true });
      else if (r < 0.37) { this.hold({ down: true }, 2); this.tap({ down: true, kick: true }); }
      else if (r < 0.45 && self.c.moves.dashHeavy && self.meter >= 35) dashHeavy();
      else if (r < 0.5) this.tap({ special: true });
      else if (r < 0.55 && chance(p.aggr)) { this.hold({ up: true, [fwd]: true }, 3); this.idle(16); this.tap({ kick: true }); }
      else this.hold({ [fwd]: true }, rand(8, 18));
      return;
    }

    // close range
    if (chance(p.aggr)) {
      const r = Math.random();
      if (r < 0.45) {
        const n = 2 + Math.floor(rand(0, 3));
        for (let i = 0; i < n; i++) { this.tap({ light: true }); this.idle(5); }
      } else if (r < 0.65) {
        this.tap({ heavy: true }); this.idle(12); this.tap({ heavy: true });
      } else if (r < 0.8) {
        this.hold({ down: true }, 2); this.tap({ down: true, kick: true });
      } else if (r < 0.9) {
        this.tap({ down: true, light: true });
      } else {
        this.tap({ special: true, down: chance(0.5) });
      }
      this.idle(rand(4, 14));
    } else if (chance(0.25)) {
      this.tap({ [back]: true }); this.idle(2); this.tap({ [back]: true }); this.idle(12);
    } else if (chance(0.5)) {
      this.hold({ [back]: true }, rand(10, 24));
    } else if (chance(0.3)) {
      this.hold({ up: true, [back]: true }, 4);
    } else {
      this.hold({ [back]: true, down: chance(0.4) }, rand(14, 26));
    }
  }
}
