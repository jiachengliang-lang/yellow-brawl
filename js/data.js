/* Characters, animation clips and move frame data.
 *
 * Every number here is in 60 Hz simulation frames or canvas pixels.
 * Swapping a character's art = replacing its sheets and the clip table below.
 *
 * Clip fields
 *   src, frames, rows, cols   sprite-sheet grid (frames laid out left-to-right, top-to-bottom)
 *   fw, fh                    one frame's size in the sheet
 *   fps, loop                 playback for looping/idle-type clips
 *   foot                      empty pixels under the feet in the source frame (keeps feet on the floor)
 *   rh                        on-screen height of the whole frame (keeps body size consistent across clips)
 *   offX                      horizontal shift (source px) for frames whose body isn't centered
 *
 * Hitbox `hb` / hurtbox are relative to the fighter's feet:
 *   hb.x  forward offset where the box starts, hb.w its width
 *   hb.y  height of the box bottom above the floor, hb.h its height
 */

const clip = (src, frames, rows, fw, fh, fps, loop, foot, rh, extra = {}) =>
  ({ src: `assets/${src}`, frames, rows, cols: 6, fw, fh, fps, loop, foot, rh, ...extra });

export const ITEMS = {
  milk: 'assets/items/milk-carton.webp'
};

const NAIWA_CLIPS = {
  idle:        clip('naiwa/naiwa-anim-idle.webp',        24, 4, 288, 348, 16, true,  38, 384),
  walk:        clip('naiwa/naiwa-anim-walk.webp',        25, 5, 288, 320, 24, true,  33, 415),
  crouch:      clip('naiwa/naiwa-anim-crouch.webp',      15, 3, 288, 348, 18, true,  21, 328),
  lightL:      clip('naiwa/naiwa-anim-punch-l.webp',      8, 2, 288, 348, 24, false, 35, 394),
  lightR:      clip('naiwa/naiwa-anim-punch-r.webp',      8, 2, 288, 348, 24, false, 35, 396),
  knee:        clip('naiwa/naiwa-anim-knee.webp',         6, 1, 288, 261, 24, false, 42, 375),
  kick:        clip('naiwa/naiwa-anim-kick.webp',        24, 4, 288, 261, 24, false, 42, 375),
  heavy:       clip('naiwa/naiwa-anim-heavy.webp',       12, 2, 288, 348, 24, false, 35, 397),
  flurry:      clip('naiwa/naiwa-anim-flurry.webp',      36, 6, 288, 348, 24, false, 35, 396),
  whirl:       clip('naiwa/naiwa-anim-whirl.webp',       36, 6, 288, 252, 24, false, 33, 394),
  belly:       clip('naiwa/naiwa-anim-belly.webp',       26, 5, 288, 320, 24, false,  4, 328),
  bellyCombo:  clip('naiwa/naiwa-anim-belly-combo.webp', 14, 3, 288, 376, 24, false, 10, 337),
  crouchPunch: clip('naiwa/naiwa-anim-crouchPunch.webp', 16, 3, 288, 348, 24, false, 22, 311),
  crouchKick:  clip('naiwa/naiwa-anim-crouchKick.webp',  19, 4, 288, 348, 24, false, 28, 300),
  block:       clip('naiwa/naiwa-anim-block.webp',       15, 3, 288, 348, 24, true,  16, 338),
  hurt:        clip('naiwa/naiwa-anim-hurt.webp',        16, 3, 288, 348, 24, false, 16, 329),
  ko:          clip('naiwa/naiwa-anim-ko.webp',          45, 8, 288, 282, 24, false, 13, 405),
  laugh:       clip('naiwa/naiwa-anim-laugh.webp',       12, 2, 288, 348, 18, true,  29, 367),
  taunt:       clip('naiwa/naiwa-anim-taunt.webp',       12, 2, 288, 348, 18, true,  22, 348),
  orb:         clip('naiwa/naiwa-orb.webp',              12, 2, 192, 192, 18, true,   0,  96)
};

const KANGAROO_CLIPS = {
  idle:         clip('kangaroo/kangaroo-box-idle.webp',      15, 3, 300, 292, 24, true,  1, 342),
  walk:         clip('kangaroo/kangaroo-walk-slow.webp',     24, 4, 300, 400, 24, true,  1, 352),
  crouch:       clip('kangaroo/kangaroo-crouch.webp',        22, 4, 300, 470, 24, false, 1, 342),
  jump:         clip('kangaroo/kangaroo-jump.webp',          30, 5, 300, 470, 24, false, 1, 352),
  punchL:       clip('kangaroo/kangaroo-punchL.webp',        11, 2, 300, 292, 24, false, 1, 342),
  punchR:       clip('kangaroo/kangaroo-punchR.webp',        11, 2, 300, 292, 24, false, 1, 342),
  punchLR:      clip('kangaroo/kangaroo-punchLR.webp',       16, 3, 300, 292, 24, false, 1, 342),
  gloveCombo:   clip('kangaroo/kangaroo-glove-combo.webp',   24, 4, 300, 292, 24, false, 1, 342),
  heavy1:       clip('kangaroo/kangaroo-heavy1.webp',         7, 2, 300, 292, 24, false, 1, 342),
  heavy3:       clip('kangaroo/kangaroo-heavy3.webp',        16, 3, 300, 292, 24, false, 1, 342),
  heavy4:       clip('kangaroo/kangaroo-heavy4.webp',        20, 4, 300, 292, 24, false, 1, 342),
  dashPunch:    clip('kangaroo/kangaroo-dash-punch.webp',    16, 3, 900, 506, 24, false, 0, 380, { offX: 202 }),
  crouchAttack: clip('kangaroo/kangaroo-crouchAttack.webp',  24, 4, 300, 470, 24, false, 1, 352),
  milkThrow:    clip('kangaroo/kangaroo-milk-throw.webp',    16, 3, 300, 292, 24, false, 1, 347),
  scooter:      clip('kangaroo/kangaroo-scooter-5s.webp',   120, 20, 300, 310, 24, false, 1, 380),
  superPress:   clip('kangaroo/kangaroo-super-press.webp',   42, 7, 300, 292, 24, false, 1, 342),
  superMilk:    clip('kangaroo/kangaroo-super-milk2.webp',   48, 8, 300, 292, 24, true,  1, 342),
  block:        clip('kangaroo/kangaroo-shield.webp',        48, 8, 300, 470, 24, true,  1, 342),
  hurt:         clip('kangaroo/kangaroo-hurt2.webp',          6, 1, 300, 292, 24, false, 1, 356),
  ko:           clip('kangaroo/kangaroo-ko.webp',            17, 3, 400, 300, 24, false, 0, 355),
  win:          clip('kangaroo/kangaroo-win2.webp',          24, 4, 300, 292, 24, true,  1, 360),
  taunt:        clip('kangaroo/kangaroo-drink.webp',         24, 4, 360, 428, 24, true,  9, 342)
};

const CHICK_CLIPS = {
  idle:       clip('chick/chick-anim-idle.webp',        73, 13, 360, 600, 10, true,  62, 470),
  walk:       clip('chick/chick-anim-walk.webp',        45,  8, 360, 600, 10, true,  50, 430),
  run:        clip('chick/chick-anim-run.webp',         60, 10, 360, 600, 12, true,  50, 430),
  rally:      clip('chick/chick-anim-rally.webp',       19,  4, 360, 600, 12, true,   0, 430),
  block:      clip('chick/chick-anim-block.webp',       29,  5, 480, 600, 24, true,   0, 470),
  stun:       clip('chick/chick-anim-stun.webp',        24,  4, 480, 600, 12, true,   0, 470),
  hurt:       clip('chick/chick-anim-hurt.webp',        10,  2, 480, 600, 24, false,  0, 470),
  ko:         clip('chick/chick-anim-ko.webp',          34,  6, 480, 600, 24, false,  0, 470),
  atk1:       clip('chick/chick-anim-atk1.webp',        10,  2, 480, 600, 24, false,  0, 470),
  atk2:       clip('chick/chick-anim-atk2.webp',         8,  2, 480, 600, 24, false,  0, 470),
  atk3:       clip('chick/chick-anim-atk3.webp',        10,  2, 480, 600, 24, false,  0, 470),
  atk4:       clip('chick/chick-anim-atk4.webp',        10,  2, 480, 600, 24, false,  0, 470),
  atk5:       clip('chick/chick-anim-atk5.webp',        10,  2, 480, 600, 24, false,  0, 470),
  atk6:       clip('chick/chick-anim-atk6.webp',         9,  2, 480, 600, 24, false,  0, 470),
  atk7:       clip('chick/chick-anim-atk7.webp',        10,  2, 480, 600, 24, false,  0, 470),
  superStart: clip('chick/chick-anim-super-start.webp', 45,  8, 360, 600, 12, false, 50, 500),
  chicken:    clip('chick/chick-projectile.webp',       12,  2, 240, 300, 18, true,   0, 195)
};

/* Shared defaults so each move only lists what's special about it. */
const M = (o) => ({
  startup: 4, active: 3, dur: 18, dmg: 30, hitstun: 16, blockstun: 9, push: 3,
  meter: 5, hitstop: 5, hits: 1, gap: 99, lunge: 0, low: false, knockdown: false,
  ...o
});

export const CHARACTERS = {
  naiwa: {
    id: 'naiwa',
    name: { zh: '奶蛙', en: 'Naiwa' },
    title: { zh: '肚皮相扑手', en: 'Belly Bruiser' },
    bio: {
      zh: '圆滚滚的黄色蛙人，打不疼也推不动。血最厚，靠肚皮冲撞压制对手，超必杀会放出一整排笑脸气球。',
      en: 'A round yellow frog who shrugs off hits. The tankiest fighter: pushes opponents around with belly charges, and the super fires a row of grinning orbs.'
    },
    stats: { power: 3, speed: 2, guts: 5 },
    color: '#ffd42a',
    hp: 1150, walk: 3.3, back: 2.5, jumpV: -16, jumpX: 4.2,
    hurtW: 120, hurtH: 262,
    clips: NAIWA_CLIPS,
    portrait: 'assets/naiwa/naiwa.png',
    card: 'assets/naiwa/naiwa-laugh.png',
    jumpClip: { clip: 'idle', frame: 4 },
    dashClip: 'walk',
    winClip: 'laugh', introClip: 'taunt',
    introQuote: { zh: '先说好，打完请我吃夜宵。', en: 'Loser buys the late-night snacks.' },
    winQuote: { zh: '这肚子可不是白长的。', en: 'This belly isn\'t just for show.' },
    moves: {
      // light string: J J J J
      light: [
        M({ name: 'jab', clip: 'lightL', dur: 15, startup: 4, active: 3, dmg: 30, hb: { x: 20, w: 130, y: 150, h: 90 }, hitstun: 16, lunge: 1.5 }),
        M({ name: 'jab2', clip: 'lightR', dur: 15, startup: 4, active: 3, dmg: 32, hb: { x: 20, w: 135, y: 150, h: 90 }, hitstun: 17, lunge: 1.5 }),
        M({ name: 'knee', clip: 'knee', dur: 20, startup: 5, active: 4, dmg: 40, hb: { x: 20, w: 135, y: 90, h: 100 }, hitstun: 19, lunge: 2.2, hitstop: 6 }),
        M({ name: 'flurry', clip: 'flurry', dur: 46, startup: 6, active: 30, dmg: 18, hits: 4, gap: 8, hb: { x: 20, w: 150, y: 140, h: 110 }, hitstun: 14, push: 1.4, lunge: 0.8, meter: 3, hitstop: 3, finalKnockdown: true })
      ],
      // heavy string: K K
      heavy: [
        M({ name: 'heavy', clip: 'heavy', dur: 32, startup: 10, active: 4, dmg: 85, hb: { x: 20, w: 165, y: 140, h: 110 }, hitstun: 24, blockstun: 13, push: 6, lunge: 3.5, meter: 10, hitstop: 10 }),
        M({ name: 'bellyCombo', clip: 'bellyCombo', dur: 34, startup: 8, active: 5, dmg: 80, hb: { x: 10, w: 180, y: 110, h: 140 }, hitstun: 28, blockstun: 14, push: 9, lunge: 4, meter: 10, hitstop: 11, knockdown: true })
      ],
      kick: M({ name: 'kick', clip: 'kick', dur: 34, startup: 9, active: 5, dmg: 62, hb: { x: 30, w: 160, y: 85, h: 105 }, hitstun: 21, blockstun: 11, push: 4.5, lunge: 2.2, meter: 7, hitstop: 7 }),
      crouchLight: M({ name: 'crouchPunch', clip: 'crouchPunch', dur: 20, startup: 5, active: 3, dmg: 30, hb: { x: 20, w: 125, y: 70, h: 80 }, hitstun: 15 }),
      crouchKick: M({ name: 'sweep', clip: 'crouchKick', dur: 36, startup: 8, active: 5, dmg: 55, hb: { x: 20, w: 165, y: 0, h: 70 }, low: true, knockdown: true, hitstun: 22, blockstun: 12, push: 3, meter: 8, hitstop: 7 }),
      air: M({ name: 'airKick', clip: 'kick', animFrom: 6, animFrames: 10, dur: 26, startup: 5, active: 10, dmg: 50, hb: { x: 0, w: 140, y: 40, h: 110 }, hitstun: 18, hitstop: 6 }),
      // U: belly charge
      special: M({ name: 'belly', clip: 'belly', dur: 48, startup: 12, active: 10, dmg: 95, hb: { x: 0, w: 190, y: 70, h: 160 }, hitstun: 30, blockstun: 16, push: 10, lunge: 9, lungeUntil: 22, meter: 8, hitstop: 12, knockdown: true, afterimage: true }),
      // S+U: whirlwind punches
      special2: M({ name: 'whirl', clip: 'whirl', dur: 64, startup: 8, active: 46, dmg: 24, hits: 4, gap: 12, hb: { x: 0, w: 165, y: 90, h: 140 }, hitstun: 18, blockstun: 9, push: 1.5, lunge: 3.2, lungeUntil: 54, meter: 4, hitstop: 4, finalKnockdown: true }),
      // I: super, needs a full meter
      super: M({
        name: 'laughRiot', clip: 'laugh', dur: 136, startup: 999, active: 0, freeze: 40,
        // 18 orbs: 17 × 29 + 39 = 532 total (the original's damage)
        barrage: { start: 18, count: 18, gap: 6, kind: 'orb', speed: 12, dmg: 29, lastDmg: 39, hitstun: 16, y: 170, spread: 60, noScale: true },
        label: { zh: '笑脸连珠', en: 'GRIN BARRAGE' },
        meter: 0
      })
    }
  },

  kangaroo: {
    id: 'kangaroo',
    name: { zh: '肥嘟嘟', en: 'Feidudu' },
    title: { zh: '极速配送员', en: 'Express Courier' },
    bio: {
      zh: '跑单最快的袋鼠，戴上拳套就进入工作状态。血薄但出手快，会远程扔牛奶，也会骑电动车直接撞过来。',
      en: 'The fastest courier in town, gloves always on. Fragile but quick: lobs milk cartons from range and rams in on an e-scooter.'
    },
    stats: { power: 4, speed: 5, guts: 3 },
    color: '#ff9a1a',
    hp: 950, walk: 4.4, back: 3.2, jumpV: -17, jumpX: 5,
    hurtW: 110, hurtH: 268,
    clips: KANGAROO_CLIPS,
    portrait: 'assets/kangaroo/kangaroo.png',
    card: 'assets/kangaroo/kangaroo-drink.png',
    jumpClip: { clip: 'jump' },
    dashClip: 'walk',
    winClip: 'win', introClip: 'taunt',
    introQuote: { zh: '这单要准时送达。', en: 'This order arrives on time.' },
    winQuote: { zh: '已送达，记得好评。', en: 'Delivered. Leave a good review.' },
    moves: {
      light: [
        M({ name: 'jabL', clip: 'punchL', dur: 14, startup: 4, active: 3, dmg: 26, hb: { x: 20, w: 125, y: 160, h: 90 }, hitstun: 15, lunge: 1.8 }),
        M({ name: 'jabR', clip: 'punchR', dur: 14, startup: 4, active: 3, dmg: 28, hb: { x: 20, w: 130, y: 160, h: 90 }, hitstun: 16, lunge: 1.8 }),
        M({ name: 'oneTwo', clip: 'punchLR', dur: 22, startup: 5, active: 6, dmg: 22, hits: 2, gap: 5, hb: { x: 20, w: 135, y: 150, h: 100 }, hitstun: 16, lunge: 2 }),
        M({ name: 'gloveRush', clip: 'gloveCombo', dur: 44, startup: 4, active: 32, dmg: 12, hits: 6, gap: 6, hb: { x: 20, w: 160, y: 130, h: 120 }, hitstun: 12, push: 1.2, lunge: 1.6, meter: 2, hitstop: 2, finalKnockdown: true })
      ],
      heavy: [
        M({ name: 'heavy', clip: 'heavy1', dur: 26, startup: 7, active: 4, dmg: 70, hb: { x: 20, w: 150, y: 150, h: 110 }, hitstun: 22, blockstun: 12, push: 5, lunge: 3, meter: 9, hitstop: 8 }),
        M({ name: 'heavy2', clip: 'heavy3', dur: 32, startup: 8, active: 5, dmg: 78, hb: { x: 20, w: 165, y: 140, h: 120 }, hitstun: 28, blockstun: 13, push: 9, lunge: 3.5, meter: 10, hitstop: 11, knockdown: true })
      ],
      // long-arm punch
      kick: M({ name: 'longArm', clip: 'dashPunch', dur: 40, startup: 13, active: 6, dmg: 72, hb: { x: 40, w: 290, y: 140, h: 100 }, hitstun: 22, blockstun: 12, push: 6, meter: 8, hitstop: 9 }),
      crouchLight: M({ name: 'lowJab', clip: 'crouchAttack', animFrom: 0, animFrames: 12, dur: 18, startup: 5, active: 3, dmg: 28, hb: { x: 20, w: 125, y: 50, h: 90 }, hitstun: 15 }),
      crouchKick: M({ name: 'lowRush', clip: 'crouchAttack', dur: 34, startup: 8, active: 5, dmg: 52, hb: { x: 20, w: 160, y: 0, h: 80 }, low: true, knockdown: true, hitstun: 22, blockstun: 12, push: 3, meter: 8, hitstop: 7 }),
      air: M({ name: 'airPunch', clip: 'punchR', dur: 24, startup: 4, active: 10, dmg: 46, hb: { x: 0, w: 130, y: 60, h: 120 }, hitstun: 18, hitstop: 6 }),
      // S+U: throw a milk carton
      special2: M({ name: 'milkThrow', clip: 'milkThrow', dur: 36, startup: 999, active: 0, cooldown: 50,
        spawn: { at: 14, kind: 'milk', vx: 10.5, vy: -7, gravity: 0.34, dmg: 62, hitstun: 22, x: 50, y: 210 } }),
      // U: scooter ram, briefly invulnerable at the start (same as the original)
      special: M({ name: 'scooter', clip: 'scooter', animFrom: 30, animFrames: 70, dur: 66, startup: 8, active: 46, dmg: 20, hits: 5, gap: 9, invuln: 14,
        hb: { x: 0, w: 170, y: 20, h: 170 }, hitstun: 20, blockstun: 10, push: 2, lunge: 11, lungeUntil: 54, meter: 4, hitstop: 4, finalKnockdown: true, afterimage: true }),
      super: M({
        // motorcycle rampage: guns the scooter across the screen, ramming repeatedly, wheelie launch at the end
        name: 'expressRampage', clip: 'scooter', animFrom: 18, animFrames: 92, dur: 128, startup: 8, active: 104, freeze: 40,
        // 11 × 53 + 57 = 640 total (the original's damage)
        dmg: 53, lastDmg: 57, noScale: true, hits: 12, gap: 8, hb: { x: -30, w: 230, y: 10, h: 210 }, hitstun: 24, blockstun: 10, push: 2.6,
        lunge: 12.5, lungeUntil: 112, invuln: 50, hitstop: 4, finalKnockdown: true, afterimage: true, rampage: true,
        label: { zh: '超级配送', en: 'EXPRESS RAMPAGE' },
        meter: 0
      })
    }
  },
  chick: {
    id: 'chick',
    name: { zh: '小鸡子', en: 'Chick' },
    title: { zh: '篮球歌手', en: 'Hoop Crooner' },
    bio: {
      zh: '戴着蓬松灰发的小黄鸡，边唱边打。用歌声远程压制，放出公鸡冲锋，超必杀是一场篮球雨。',
      en: 'A little yellow chick with fluffy grey hair who fights mid-song. Zones with sound waves, sends roosters charging, and the super rains basketballs.'
    },
    stats: { power: 3, speed: 4, guts: 4 },
    color: '#c9d3df',
    hp: 1020, walk: 3.9, back: 2.9, jumpV: -16.5, jumpX: 4.6,
    hurtW: 115, hurtH: 275,
    clips: CHICK_CLIPS,
    portrait: 'assets/chick/chick-laugh.webp',
    card: 'assets/chick/chick.webp',
    jumpClip: { clip: 'atk4', frame: 2 },
    crouchClip: 'block',
    dashClip: 'run',
    winClip: 'idle', introClip: 'idle',
    introQuote: { zh: '来，跟上节拍。', en: 'Try to keep up with the beat.' },
    winQuote: { zh: '这首歌，送给你。', en: 'That one was dedicated to you.' },
    moves: {
      light: [
        M({ name: 'peck', clip: 'atk5', dur: 15, startup: 4, active: 3, dmg: 28, hb: { x: 20, w: 125, y: 150, h: 100 }, hitstun: 16, lunge: 1.6 }),
        M({ name: 'swing', clip: 'atk3', dur: 16, startup: 4, active: 3, dmg: 30, hb: { x: 20, w: 140, y: 140, h: 110 }, hitstun: 17, lunge: 1.8 }),
        M({ name: 'dab', clip: 'atk2', dur: 18, startup: 4, active: 4, dmg: 34, hb: { x: 20, w: 150, y: 150, h: 100 }, hitstun: 19, lunge: 2 }),
        M({ name: 'shadow5', clip: 'atk1', dur: 44, startup: 3, active: 32, dmg: 13, hits: 5, gap: 6, hb: { x: 0, w: 175, y: 110, h: 150 }, hitstun: 13, push: 1.2, lunge: 1.2, meter: 2, hitstop: 3, finalKnockdown: true, music: true })
      ],
      heavy: [
        M({ name: 'dribble', clip: 'atk6', dur: 28, startup: 8, active: 5, dmg: 72, hb: { x: 10, w: 165, y: 60, h: 150 }, hitstun: 23, blockstun: 12, push: 5.5, lunge: 4, meter: 9, hitstop: 9 }),
        M({ name: 'press', clip: 'atk4', dur: 34, startup: 10, active: 5, dmg: 82, hb: { x: 0, w: 175, y: 60, h: 190 }, hitstun: 28, blockstun: 14, push: 8, lunge: 3, meter: 10, hitstop: 11, knockdown: true })
      ],
      // sound wave: long reach, two hits
      kick: M({ name: 'soundwave', clip: 'atk7', dur: 40, startup: 12, active: 12, dmg: 34, hits: 2, gap: 8, hb: { x: 60, w: 230, y: 120, h: 140 }, hitstun: 20, blockstun: 11, push: 3.5, meter: 7, hitstop: 6, wave: true }),
      crouchLight: M({ name: 'lowPeck', clip: 'atk5', dur: 18, startup: 5, active: 3, dmg: 28, hb: { x: 20, w: 120, y: 40, h: 90 }, hitstun: 15 }),
      crouchKick: M({ name: 'lowDribble', clip: 'atk6', dur: 34, startup: 8, active: 5, dmg: 52, hb: { x: 20, w: 165, y: 0, h: 70 }, low: true, knockdown: true, hitstun: 22, blockstun: 12, push: 3, meter: 8, hitstop: 7 }),
      air: M({ name: 'airPress', clip: 'atk4', animFrom: 3, animFrames: 6, dur: 24, startup: 4, active: 10, dmg: 48, hb: { x: 0, w: 140, y: 30, h: 130 }, hitstun: 18, hitstop: 6 }),
      // U: send a rooster running along the floor
      special: M({ name: 'rooster', clip: 'atk2', dur: 34, startup: 999, active: 0, cooldown: 55,
        spawn: { at: 10, kind: 'chicken', vx: 7.5, vy: 0, gravity: 0, dmg: 58, hitstun: 22, x: 70, y: 52 } }),
      // S+U: dribble dash, three hits
      special2: M({ name: 'fastBreak', clip: 'run', dur: 52, startup: 6, active: 38, dmg: 26, hits: 3, gap: 11, hb: { x: 0, w: 160, y: 40, h: 170 }, hitstun: 20, blockstun: 10, push: 2, lunge: 8.5, lungeUntil: 42, meter: 4, hitstop: 5, finalKnockdown: true, afterimage: true }),
      super: M({
        // scripted sequence (see Fighter.updateChickSuper): teleport, ball from the sky stuns,
        // meditate, dribble, then a 36-hit accelerating ball rally pinning the opponent
        name: 'basketball', kind: 'chickBasketball', clip: 'superStart', dur: 9999, startup: 999, active: 0, freeze: 40,
        dmg: 520, hits: 36, bodyDamage: 18,
        label: { zh: '篮球轮回', en: 'BASKETBALL SAMSARA' },
        meter: 0
      })
    }
  }
};

export const CHAR_IDS = ['naiwa', 'kangaroo', 'chick'];

for (const c of Object.values(CHARACTERS)) {
  c.stand = c.stand || `assets/${c.id}/${c.id}-idle.${c.id === 'chick' ? 'webp' : 'png'}`;
  for (const [name, cl] of Object.entries(c.clips)) { cl.name = name; cl.char = c.id; }
}

export const PROJECTILES = {
  orb: { char: 'naiwa', clip: 'orb', w: 70, h: 70, drawOffset: 50, glow: 'rgba(255,240,120,.55)' },
  milk: { image: 'milk', w: 54, h: 60, drawW: 62, drawH: 74, spin: 0.22 },
  chicken: { char: 'chick', clip: 'chicken', w: 90, h: 80, drawOffset: 52 },
  ball: { draw: 'ball', r: 24, w: 48, h: 48, bounce: 3, spin: 0.25 }
};

/* Arcade ladder: the other fighters first, then a mirror match; difficulty rises each fight. */
export const ARCADE_LEVELS = ['easy', 'normal', 'hard'];
