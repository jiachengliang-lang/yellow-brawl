/* Screens and flow: loading → title → menu → select → stage → fight → result. */

import { CHARACTERS, CHAR_IDS, ARCADE_LEVELS } from './data.js';
import { loadAll, usingPlaceholders } from './assets.js';
import { onKey } from './input.js';
import { Match } from './match.js';
import { STAGES, STAGE_IDS, stageThumb } from './stage.js';
import { sfx, loadClips } from './audio.js';
import { playMusic } from './music.js';
import { settings, setSetting } from './settings.js';
import { t, L, getLang, setLang, TICKER } from './i18n.js';
import { wipe } from './polish.js';
import { initOnline, showOnline } from './online.js';

const $ = (s, el = document) => el.querySelector(s);
const ui = $('#ui');
const canvas = $('#game');
const stageEl = $('#stage');

let keyHandler = null;     // the active screen's keyboard handler
let match = null;
let current = null;        // re-renders the current screen (used when switching language)

/* ------------------------------------------------------------ layout */
function fit() {
  const s = Math.min(window.innerWidth / 1280, window.innerHeight / 720);
  stageEl.style.transform = `translate(-50%, -50%) scale(${s})`;
}
window.addEventListener('resize', fit);
fit();

onKey((e) => keyHandler?.(e));

/* ------------------------------------------------------------ helpers */
const CONFIRM = ['Enter', 'Space', 'KeyJ', 'NumpadEnter'];
const UP = ['ArrowUp', 'KeyW'];
const DOWN = ['ArrowDown', 'KeyS'];
const LEFT = ['ArrowLeft', 'KeyA'];
const RIGHT = ['ArrowRight', 'KeyD'];

let shownFor = null;
function show(html, handler = null) {
  // slatted wipe whenever we move to a different full screen (not overlays or the fight)
  if (current !== shownFor && /class="screen(?! clear)/.test(html)) wipe();
  shownFor = current;
  ui.innerHTML = html;
  keyHandler = handler;
}

function ticker() {
  const items = TICKER[getLang()];
  const row = items.map(s => `<span>${s}</span><i>✦</i>`).join('');
  return `<div class="ticker"><div class="track">${row}${row}</div></div>`;
}

function logoStack(small = false) {
  return `<h1 class="logo-stack ${small ? 'small' : ''}"><span class="l1">${t('titleTop')}</span><span class="l2" data-text="${t('titleBottom')}">${t('titleBottom')}</span></h1>`;
}

/* Vertical menu navigation over [data-nav] elements. */
function navMenu(root, onBack, opts = {}) {
  const items = [...root.querySelectorAll('[data-nav]')];
  let i = 0;
  const focus = (n) => {
    i = (n + items.length) % items.length;
    items.forEach((el, k) => el.classList.toggle('focus', k === i));
  };
  items.forEach((el, k) => el.addEventListener('mouseenter', () => focus(k)));
  focus(0);
  return (e) => {
    if (UP.includes(e.code)) { focus(i - 1); sfx('move'); }
    else if (DOWN.includes(e.code)) { focus(i + 1); sfx('move'); }
    else if (opts.horizontal && LEFT.includes(e.code)) opts.horizontal(items[i], -1);
    else if (opts.horizontal && RIGHT.includes(e.code)) opts.horizontal(items[i], 1);
    else if (CONFIRM.includes(e.code)) { e.preventDefault(); items[i]?.click(); }
    else if (onBack && (e.code === 'Escape' || e.code === 'Backspace')) { sfx('back'); onBack(); }
  };
}

function cornerButtons() {
  return `<div class="corner">
    <button class="btn small" id="lang-btn">${t('language')}</button>
    <button class="btn small" id="settings-btn" title="${t('settings')}">⚙</button>
  </div>`;
}

function bindCorner(back) {
  $('#lang-btn')?.addEventListener('click', () => { setLang(getLang() === 'zh' ? 'en' : 'zh'); sfx('select'); current?.(); });
  $('#settings-btn')?.addEventListener('click', () => { sfx('select'); showSettings(back || current); });
}

function stopMatch() {
  if (match) { match.stop(); match = null; }
}

const panelItem = (id, label) => `<button class="menu-item" data-nav id="${id}"><b>${label}</b><span class="arrow">↗</span></button>`;

/* ------------------------------------------------------------ loading */
async function boot() {
  show(`<div class="screen"><div class="logo"><div class="kicker">${t('gameSub')}</div><h1>${t('gameTitle')}</h1></div>
    <div class="loadbar"><i id="load-fill"></i></div><div class="screen-sub" style="margin-top:10px">${t('loading')}</div></div>`);
  await Promise.all([loadAll((p) => { const el = $('#load-fill'); if (el) el.style.width = `${Math.round(p * 100)}%`; }), loadClips()]);
  // invite link: ?room=CODE jumps straight into that online room
  const code = new URLSearchParams(location.search).get('room');
  if (code) {
    history.replaceState(null, '', location.pathname + location.search.replace(/[?&]room=[^&]*/, '').replace(/^&/, '?'));
    return showOnline({ join: code.toUpperCase() });
  }
  showTitle();
}

/* ------------------------------------------------------------ title */
function showTitle() {
  stopMatch();
  current = showTitle;
  const chips = CHAR_IDS.map(id => `<span class="chip"><i style="background:${CHARACTERS[id].color}"></i>${L(CHARACTERS[id].name)}</span>`).join('<em>VS</em>');
  show(`<div class="screen title-screen" id="title" data-ghost="斗">
      ${cornerButtons()}
      <div class="title-grid">
        <div class="title-copy">
          <div class="kicker line">MEME FIGHTER · 2D ARCADE</div>
          ${logoStack()}
          <p class="tagline">${t('tagline')}</p>
          <div class="chips">${chips}</div>
          <div class="press"><kbd>Enter</kbd><span>${t('pressStart')}</span></div>
        </div>
        <div class="title-stage ${usingPlaceholders() ? 'ph' : ''}">
          <div class="spot" data-depth="6"></div>
          <img class="st st-l" data-depth="20" src="${CHARACTERS.naiwa.stand}" alt="">
          <img class="st st-r" data-depth="26" src="${CHARACTERS.kangaroo.stand}" alt="">
          <img class="st st-m" data-depth="12" src="${CHARACTERS.chick.stand}" alt="">
          <div class="floor"></div>
        </div>
      </div>
      ${ticker()}
      ${usingPlaceholders() ? '' : `<div class="footer">${t('footer')}</div>`}
    </div>`, (e) => { if (!['ShiftLeft', 'ShiftRight'].includes(e.code)) go(); });
  bindCorner();
  const go = () => { sfx('select'); playMusic('menu'); showMenu(); };
  $('#title').addEventListener('click', (e) => { if (!e.target.closest('.corner')) go(); });
}

/* ------------------------------------------------------------ main menu */
function showMenu() {
  stopMatch();
  playMusic('menu');
  current = showMenu;
  const vsCpu = settings.vsCpu !== 'off';
  const items = [
    ['arcade', '01', t('arcadeDesc'), () => showSelect('arcade')],
    ['versus', '02', vsCpu ? `${t('vsCpuDesc')} · ${t('difficulty_' + settings.vsCpu)}` : t('versusDesc'), () => showSelect('versus')],
    ['online', '03', t('onlineDesc'), () => showOnline()],
    ['training', '04', t('trainingDesc'), () => showSelect('training')],
    ['controls', '05', t('controlsDesc'), () => showControls()],
    ['settings', '06', t('settingsDesc'), () => showSettings(showMenu)]
  ];
  // the featured fighter rotates each visit
  showMenu.n = ((showMenu.n ?? Math.floor(Math.random() * 3)) + 1) % CHAR_IDS.length;
  const hero = CHARACTERS[CHAR_IDS[showMenu.n]];
  show(`<div class="screen menu-screen" data-ghost="战">
      ${cornerButtons()}
      <div class="menu-grid">
        <div class="menu-hero">
          <div class="kicker line">MEME FIGHTER</div>
          ${logoStack(true)}
          <div class="hero-fighter" data-depth="16"><img src="${hero.card}" alt=""></div>
          <div class="hero-name"><b>${L(hero.name)}</b><span>${L(hero.title)}</span></div>
        </div>
        <div class="panel mode-panel">
          <div class="panel-head"><span class="kicker">SELECT MODE</span><b>${t('selectMode')}</b></div>
          <div class="menu compact">
            ${items.map(([key, no, desc], i) => `<button class="menu-item" data-nav data-key="${key}" style="--i:${i}">
              <span class="no">${no}</span><span><b>${t(key)}</b><small>${desc}</small></span><span class="arrow">↗</span>
            </button>`).join('')}
          </div>
        </div>
      </div>
      ${ticker()}
    </div>`);
  bindCorner();
  items.forEach(([key, , , fn]) => $(`[data-key="${key}"]`).addEventListener('click', () => { sfx('select'); fn(); }));
  keyHandler = navMenu(ui, showTitle);
}

/* ------------------------------------------------------------ settings */
const SETTING_ROWS = [
  { key: 'music', label: 'musicVol', values: [0, .1, .2, .3, .4, .5, .6, .7, .8, .9, 1], fmt: v => `${Math.round(v * 10)} / 10` },
  { key: 'sfx', label: 'sfxVol', values: [0, .1, .2, .3, .4, .5, .6, .7, .8, .9, 1], fmt: v => `${Math.round(v * 10)} / 10` },
  { key: 'roundTime', label: 'roundTimeLbl', values: [30, 60, 99, 0], fmt: v => v ? t('seconds', { n: v }) : t('noLimit') },
  { key: 'winsNeeded', label: 'winsNeededLbl', values: [1, 2, 3], fmt: v => String(v) },
  { key: 'vsCpu', label: 'vsCpuLbl', values: ['off', 'easy', 'normal', 'hard'], fmt: v => v === 'off' ? t('vsHuman') : `${t('cpu')} · ${t('difficulty_' + v)}` }
];

function showSettings(back = showMenu) {
  current = () => showSettings(back);
  show(`<div class="screen">
      ${cornerButtons()}
      <h2 class="screen-title">${t('settings')}</h2>
      <div class="screen-sub">${t('settingsHint')}</div>
      <div class="menu" style="width:620px">
        ${SETTING_ROWS.map(r => `<div class="menu-item setting-row" data-nav data-setting="${r.key}">
          <span><b style="font-size:18px">${t(r.label)}</b></span>
          <span class="setting-val">
            <button class="btn small" data-step="-1">◀</button>
            <span class="val" id="val-${r.key}">${r.fmt(settings[r.key])}</span>
            <button class="btn small" data-step="1">▶</button>
          </span>
        </div>`).join('')}
        <button class="menu-item" data-nav id="s-back"><b style="font-size:18px">${t('back')}</b><span class="arrow">↗</span></button>
      </div>
    </div>`);
  bindCorner(back);
  const change = (el, d) => {
    const key = el?.dataset.setting;
    if (!key) return;
    const row = SETTING_ROWS.find(r => r.key === key);
    let idx = row.values.findIndex(v => Math.abs(v - settings[key]) < 1e-6 || v === settings[key]);
    idx = Math.max(0, Math.min(row.values.length - 1, (idx < 0 ? 0 : idx) + d));
    setSetting(key, row.values[idx]);
    $(`#val-${key}`).textContent = row.fmt(row.values[idx]);
    sfx(key === 'sfx' ? 'light' : 'move');
  };
  ui.querySelectorAll('[data-setting]').forEach(el => {
    el.querySelectorAll('[data-step]').forEach(b => b.addEventListener('click', (e) => { e.stopPropagation(); change(el, Number(b.dataset.step)); }));
    el.addEventListener('click', () => change(el, 1));
  });
  $('#s-back').onclick = () => { sfx('back'); back(); };
  keyHandler = navMenu(ui, back, { horizontal: change });
}

/* ------------------------------------------------------------ character select */
function charCard(id) {
  const c = CHARACTERS[id];
  const stat = (k) => `<span>${t(k)}</span><span class="track"><i style="width:${c.stats[k] * 20}%"></i></span>`;
  return `<div class="char-card" data-char="${id}">
    <div class="tags"></div>
    <img src="${c.card}" alt="">
    <div class="info">
      <b>${L(c.name)}</b><em>${L(c.title)}</em>
      <p>${L(c.bio)}</p>
      <div class="stats">${stat('power')}${stat('speed')}${stat('guts')}</div>
    </div>
  </div>`;
}

/**
 * mode 'arcade'   P1 picks, then the ladder starts
 * mode 'versus'   two humans pick together, or (vs CPU setting) P1 picks both sides
 * mode 'training' P1 picks a fighter, then the dummy
 * first = the side-1 pick already made in a two-step select
 */
function showSelect(mode, first = null) {
  stopMatch();
  playMusic('menu');
  current = () => showSelect(mode, first);
  const twoStep = mode === 'training' || (mode === 'versus' && settings.vsCpu !== 'off');
  const twoPlayers = mode === 'versus' && !twoStep;
  const st = { cursor: [0, 1], locked: [false, false] };
  if (first) st.cursor[0] = (CHAR_IDS.indexOf(first) + 1) % CHAR_IDS.length;
  const title = !first ? t('selectFighter') : mode === 'training' ? t('selectDummy') : t('selectOpponent');
  const sub = mode === 'versus' && twoStep ? `${t('versus')} · ${t('cpu')} ${t('difficulty_' + settings.vsCpu)}` : t(mode);
  show(`<div class="screen">
      ${cornerButtons()}
      <h2 class="screen-title">${title}</h2>
      <div class="screen-sub">${sub}</div>
      <div class="select-grid">${CHAR_IDS.map(charCard).join('')}</div>
      <div class="select-hints">
        <span><span class="p1">${t('p1')}</span> ${t('selectHint1')}</span>
        ${twoPlayers ? `<span><span class="p2">${t('p2')}</span> ${t('selectHint2')}</span>` : ''}
        <span>Esc · ${t('back')}</span>
      </div>
    </div>`);
  bindCorner();

  const cards = [...ui.querySelectorAll('.char-card')];
  const paint = () => {
    cards.forEach((card, i) => {
      const p1 = st.cursor[0] === i, p2 = twoPlayers && st.cursor[1] === i;
      card.classList.toggle('hover-p1', p1);
      card.classList.toggle('hover-p2', p2);
      const p1Tag = first ? (mode === 'training' ? 'DUMMY' : t('cpu')) : t('p1');
      card.querySelector('.tags').innerHTML =
        (p1 ? `<span class="tag ${first ? 'p2' : 'p1'} ${st.locked[0] ? 'locked' : ''}">${p1Tag}</span>` : '') +
        (p2 ? `<span class="tag p2 ${st.locked[1] ? 'locked' : ''}">${t('p2')}</span>` : '');
    });
  };
  const moveCursor = (side, d) => {
    if (st.locked[side]) return;
    st.cursor[side] = (st.cursor[side] + d + CHAR_IDS.length) % CHAR_IDS.length;
    sfx('move'); paint();
  };
  const lock = (side) => {
    if (st.locked[side]) return;
    st.locked[side] = true;
    sfx('select'); paint();
    const id = CHAR_IDS[st.cursor[side]];
    if (mode === 'arcade') return setTimeout(() => startArcade(id), 350);
    if (twoStep) {
      if (!first) return setTimeout(() => showSelect(mode, id), 250);
      return setTimeout(() => showStageSelect(stage => mode === 'training' ? startTraining(first, id, stage) : startVersus(first, id, stage), () => showSelect(mode, first)), 300);
    }
    if (st.locked[0] && st.locked[1]) {
      const a = CHAR_IDS[st.cursor[0]], b = CHAR_IDS[st.cursor[1]];
      setTimeout(() => showStageSelect(stage => startVersus(a, b, stage), () => showSelect('versus')), 400);
    }
  };
  const unlockOrBack = (side) => {
    if (st.locked[side]) { st.locked[side] = false; sfx('back'); paint(); return; }
    sfx('back');
    if (first) showSelect(mode);
    else showMenu();
  };

  cards.forEach((card, i) => {
    card.addEventListener('mouseenter', () => { if (!st.locked[0] && st.cursor[0] !== i) { st.cursor[0] = i; paint(); } });
    card.addEventListener('click', () => {
      const s = !st.locked[0] ? 0 : (twoPlayers && !st.locked[1] ? 1 : -1);
      if (s < 0) return;
      st.cursor[s] = i; lock(s);
    });
  });

  keyHandler = (e) => {
    const c = e.code;
    if (c === 'KeyA') moveCursor(0, -1);
    else if (c === 'KeyD') moveCursor(0, 1);
    else if (c === 'KeyJ' || c === 'Space') lock(0);
    else if (c === 'KeyK' || c === 'Escape') unlockOrBack(0);
    else if (twoPlayers) {
      if (c === 'ArrowLeft') moveCursor(1, -1);
      else if (c === 'ArrowRight') moveCursor(1, 1);
      else if (['Digit1', 'Numpad1', 'Enter', 'NumpadEnter'].includes(c)) lock(1);
      else if (['Digit2', 'Numpad2', 'Backspace'].includes(c)) unlockOrBack(1);
    } else {
      if (c === 'ArrowLeft') moveCursor(0, -1);
      else if (c === 'ArrowRight') moveCursor(0, 1);
      else if (c === 'Enter') lock(0);
      else if (c === 'Backspace') unlockOrBack(0);
    }
  };
  paint();
}

/* ------------------------------------------------------------ stage select */
const thumbs = {};

function showStageSelect(onPick, onBack) {
  current = () => showStageSelect(onPick, onBack);
  for (const id of STAGE_IDS) thumbs[id] = thumbs[id] || stageThumb(id);
  const options = [...STAGES.map(s => ({ id: s.id, name: L(s.name), img: thumbs[s.id] })), { id: 'random', name: t('randomStage'), img: null }];
  show(`<div class="screen">
      ${cornerButtons()}
      <h2 class="screen-title">${t('selectStage')}</h2>
      <div class="stage-grid">
        ${options.map((o, i) => `<button class="stage-card" data-i="${i}">
          ${o.img ? `<img src="${o.img}" alt="">` : '<div class="random-thumb">?</div>'}
          <b>${o.name}</b>
        </button>`).join('')}
      </div>
      <div class="select-hints"><span>A / D · ← / → · J / Enter</span><span>Esc · ${t('back')}</span></div>
    </div>`);
  bindCorner();
  const cards = [...ui.querySelectorAll('.stage-card')];
  let i = 0;
  const paint = () => cards.forEach((c, k) => c.classList.toggle('focus', k === i));
  const pick = () => {
    sfx('select');
    const id = options[i].id === 'random' ? STAGE_IDS[Math.floor(Math.random() * STAGE_IDS.length)] : options[i].id;
    onPick(id);
  };
  cards.forEach((c, k) => {
    c.addEventListener('mouseenter', () => { i = k; paint(); });
    c.addEventListener('click', () => { i = k; pick(); });
  });
  keyHandler = (e) => {
    if (LEFT.includes(e.code)) { i = (i + cards.length - 1) % cards.length; sfx('move'); paint(); }
    else if (RIGHT.includes(e.code)) { i = (i + 1) % cards.length; sfx('move'); paint(); }
    else if (CONFIRM.includes(e.code) || e.code === 'Digit1') pick();
    else if (['Escape', 'Backspace', 'KeyK'].includes(e.code)) { sfx('back'); onBack(); }
  };
  paint();
}

/* ------------------------------------------------------------ arcade */
let arcade = null;

function startArcade(charId) {
  const others = CHAR_IDS.filter(id => id !== charId).sort(() => Math.random() - 0.5);
  const offset = Math.floor(Math.random() * STAGE_IDS.length);
  arcade = {
    char: charId,
    idx: 0,
    fights: [...others, charId].slice(0, ARCADE_LEVELS.length).map((id, i) => ({
      id, level: ARCADE_LEVELS[i], stage: STAGE_IDS[(offset + i) % STAGE_IDS.length]
    }))
  };
  showVersusSplash();
}

function ladderHtml() {
  return `<div class="ladder">${arcade.fights.map((f, i) =>
    `<span class="${i === arcade.idx ? 'cur' : i < arcade.idx ? 'done' : ''}">${t('stageOf', { n: i + 1, total: arcade.fights.length })} · ${L(CHARACTERS[f.id].name)} · ${t('difficulty_' + f.level)}</span>`).join('')}</div>`;
}

function showVersusSplash() {
  stopMatch();
  current = showVersusSplash;
  const fight = arcade.fights[arcade.idx];
  const a = CHARACTERS[arcade.char], b = CHARACTERS[fight.id];
  const stage = STAGES.find(s => s.id === fight.stage);
  show(`<div class="screen">
      ${ladderHtml()}
      <div style="display:flex;align-items:center;gap:40px">
        <div class="char-card hover-p1 vs-in-l" style="cursor:default"><img src="${a.card}" alt=""><div class="info"><b>${L(a.name)}</b><em>${t('p1')}</em></div></div>
        <div style="text-align:center">
          <div class="vs-word" style="font:900 italic 110px var(--font);color:var(--gold);text-shadow:0 6px 0 #3a1500">VS</div>
          <div class="screen-sub">${L(stage.name)}</div>
        </div>
        <div class="char-card hover-p2 vs-in-r" style="cursor:default"><img src="${b.card}" alt="" style="transform:translateX(-50%) scaleX(-1)"><div class="info"><b>${L(b.name)}</b><em>${t('cpu')} · ${t('difficulty_' + fight.level)}</em></div></div>
      </div>
    </div>`, (e) => { if (CONFIRM.includes(e.code)) go(); });
  let started = false;
  const go = () => { if (started) return; started = true; clearTimeout(timer); runArcadeFight(); };
  const timer = setTimeout(go, 2000);
  sfx('round');
}

function runArcadeFight() {
  const fight = arcade.fights[arcade.idx];
  launch({
    mode: 'arcade',
    chars: [arcade.char, fight.id],
    cpu: [null, fight.level],
    stage: fight.stage,
    onEnd: (r) => setTimeout(() => arcadeResult(r), 700)
  });
}

function statsHtml(r) {
  const rows = [['statDealt', 'dealt'], ['statHits', 'hits'], ['statMaxCombo', 'maxCombo'], ['statBlocks', 'blocks'], ['statSupers', 'supers']];
  const [a, b] = r.fighters;
  return `<table class="stats-table">
    <tr><th>${L(CHARACTERS[a.id].name)}</th><th>${t('statsTitle')}</th><th>${L(CHARACTERS[b.id].name)}</th></tr>
    ${rows.map(([label, k]) => `<tr><td class="${a.stats[k] > b.stats[k] ? 'lead' : ''}" data-count="${a.stats[k]}">0</td><td>${t(label)}</td><td class="${b.stats[k] > a.stats[k] ? 'lead' : ''}" data-count="${b.stats[k]}">0</td></tr>`).join('')}
  </table>`;
}

function winQuoteHtml(r) {
  if (r.winner == null) return '';
  const c = CHARACTERS[r.fighters[r.winner].id];
  return `<div class="win-quote"><img src="${c.portrait}" alt=""><span>“${L(c.winQuote)}”</span></div>`;
}

function arcadeResult(r) {
  stopMatch();
  playMusic('menu');
  current = () => arcadeResult(r);
  const won = r.winner === 0;
  const last = arcade.idx >= arcade.fights.length - 1;
  if (won && last) {
    const c = CHARACTERS[arcade.char];
    show(`<div class="screen">
        <img src="${c.card}" alt="" style="height:330px;filter:drop-shadow(0 20px 30px rgba(0,0,0,.6))">
        <p class="result-big win">${t('champion')}</p>
        <div class="screen-sub">${t('championSub')}</div>
        ${winQuoteHtml(r)}
        <div class="menu" style="width:360px">${panelItem('r-menu', t('quit'))}</div>
      </div>`);
    sfx('win');
    $('#r-menu').onclick = showMenu;
    keyHandler = navMenu(ui, showMenu);
    return;
  }
  show(`<div class="screen clear">
      <div class="panel">
        ${ladderHtml()}
        <p class="result-big ${won ? 'win' : 'lose'}">${won ? t('youWin') : t('youLose')}</p>
        ${winQuoteHtml(r)}
        ${statsHtml(r)}
        <div class="menu">
          ${panelItem('r-main', won ? t('nextFight') : t('retry'))}
          ${panelItem('r-quit', t('quit'))}
        </div>
      </div>
    </div>`);
  sfx(won ? 'jingle' : 'lose');
  $('#r-main').onclick = () => { sfx('select'); if (won) arcade.idx++; showVersusSplash(); };
  $('#r-quit').onclick = () => { sfx('back'); showMenu(); };
  keyHandler = navMenu(ui, showMenu);
}

/* ------------------------------------------------------------ versus */
function startVersus(a, b, stage) {
  const level = settings.vsCpu !== 'off' ? settings.vsCpu : null;
  launch({
    mode: 'versus',
    chars: [a, b],
    cpu: [null, level],
    stage,
    onEnd: (r) => setTimeout(() => versusResult(r, a, b, stage), 700)
  });
}

function versusResult(r, a, b, stage) {
  stopMatch();
  playMusic('menu');
  current = () => versusResult(r, a, b, stage);
  const side = r.winner === 0 ? t('p1') : (settings.vsCpu !== 'off' ? t('cpu') : t('p2'));
  const name = r.winner == null ? '' : `${side} ${L(CHARACTERS[r.winner === 0 ? a : b].name)}`;
  show(`<div class="screen clear">
      <div class="panel">
        <p class="result-big win" style="font-size:48px">${r.winner == null ? t('draw') : t('matchWinner', { name })}</p>
        ${winQuoteHtml(r)}
        ${statsHtml(r)}
        <div class="menu">
          ${panelItem('v-again', t('rematch'))}
          ${panelItem('v-change', t('changeFighters'))}
          ${panelItem('v-quit', t('quit'))}
        </div>
      </div>
    </div>`);
  sfx('jingle');
  $('#v-again').onclick = () => { sfx('select'); startVersus(a, b, stage); };
  $('#v-change').onclick = () => { sfx('select'); showSelect('versus'); };
  $('#v-quit').onclick = () => { sfx('back'); showMenu(); };
  keyHandler = navMenu(ui, showMenu);
}

/* ------------------------------------------------------------ training */
function startTraining(a, b, stage) {
  launch({ mode: 'training', chars: [a, b], cpu: [null, null], stage });
}

const DUMMY_MODES = ['stand', 'crouch', 'block', 'jump', 'cpu'];

function trainingPanel() {
  const m = match;
  return `<div class="training-panel" id="tr-panel">
    <div class="row"><span>${t('trDummy')}</span><button class="btn" id="tr-dummy">${t('trDummy_' + m.dummyMode)}</button></div>
    <div class="row"><span>${t('trMeter')}</span><button class="btn" id="tr-meter">${m.infMeter ? t('on') : t('off')}</button></div>
    <div class="row"><span>${t('trHitboxes')}</span><button class="btn" id="tr-boxes">${m.showBoxes ? t('on') : t('off')}</button></div>
    <div class="row"><span></span><button class="btn" id="tr-reset">${t('trReset')}</button></div>
  </div>`;
}

function bindTrainingPanel() {
  const m = match;
  const refresh = () => {
    const el = $('#tr-panel'); if (!el) return;
    el.outerHTML = trainingPanel();
    bindTrainingPanel();
  };
  const actions = {
    dummy: () => { m.dummyMode = DUMMY_MODES[(DUMMY_MODES.indexOf(m.dummyMode) + 1) % DUMMY_MODES.length]; },
    meter: () => { m.infMeter = !m.infMeter; },
    boxes: () => { m.showBoxes = !m.showBoxes; },
    reset: () => m.resetPositions()
  };
  for (const [k, fn] of Object.entries(actions)) {
    $(`#tr-${k}`)?.addEventListener('click', (e) => { fn(); sfx('move'); refresh(); e.currentTarget.blur?.(); });
  }
  return { actions, refresh };
}

/* ------------------------------------------------------------ fight */
let lastLaunch = null;

/* Start a match without the local pause/training UI (used by online play). */
function launchRaw(config) {
  stopMatch();
  match = new Match(canvas, config);
  match.start();
  playMusic(STAGES.find(s => s.id === config.stage)?.music || 'market');
  return match;
}

function launch(config) {
  stopMatch();
  lastLaunch = config;
  const onEnd = config.onEnd;
  match = new Match(canvas, {
    ...config,
    // snapshot the stats before the match object is torn down
    onEnd: onEnd && ((r) => onEnd({ ...r, fighters: match.fighters.map(f => ({ id: f.id, stats: { ...f.stats } })) }))
  });
  match.start();
  playMusic(STAGES.find(s => s.id === config.stage)?.music || 'market');
  showFightUi();
}

function showFightUi() {
  current = showFightUi;
  const training = match.opts.mode === 'training';
  const hint = training ? 'WASD · J K L · U I · Shift  —  Esc' : 'Esc · ' + t('paused');
  show(`${training ? trainingPanel() : ''}<div class="hint-bar">${hint}</div>`);
  const tp = training ? bindTrainingPanel() : null;
  keyHandler = (e) => {
    if (e.code === 'Escape' || e.code === 'KeyP') return pause();
    if (tp) {
      const map = { KeyY: 'dummy', KeyM: 'meter', KeyT: 'boxes', KeyR: 'reset' };
      if (map[e.code]) { tp.actions[map[e.code]](); sfx('move'); tp.refresh(); }
    }
  };
}

function pause() {
  if (!match || match.phase === 'over') return;
  match.paused = true;
  sfx('back');
  current = pause;
  show(`<div class="screen clear">
      <div class="panel">
        <h2 class="screen-title">${t('paused')}</h2>
        <div class="menu">
          ${panelItem('p-resume', t('resume'))}
          ${panelItem('p-restart', t('restart'))}
          ${panelItem('p-controls', t('controls'))}
          ${panelItem('p-settings', t('settings'))}
          ${panelItem('p-quit', t('quit'))}
        </div>
      </div>
    </div>`);
  const resume = () => { match.paused = false; showFightUi(); };
  $('#p-resume').onclick = resume;
  $('#p-restart').onclick = () => { sfx('select'); launch(lastLaunch); };
  $('#p-controls').onclick = () => showControls(pause);
  $('#p-settings').onclick = () => showSettings(pause);
  $('#p-quit').onclick = () => { sfx('back'); showMenu(); };
  const nav = navMenu(ui, null);
  keyHandler = (e) => { if (e.code === 'Escape' || e.code === 'KeyP') resume(); else nav(e); };
}

/* ------------------------------------------------------------ controls */
const MOVE_LISTS = {
  zh: {
    naiwa: [['J ×4', '刺拳 → 刺拳 → 膝撞 → 连环拳'], ['K ×2', '重拳 → 肚皮顶飞'], ['L', '蛙腿横踢'], ['S + J / S + L', '蹲拳 / 扫堂腿（下段）'], ['U', '肚皮冲撞（击倒）'], ['S + U', '旋风拳（多段）'], ['I', '超必杀：笑脸连珠']],
    kangaroo: [['J ×4', '直拳 → 直拳 → 一二拳 → 拳套连打'], ['K ×2', '重拳 → 上勾击倒'], ['L', '长臂拳套（超远）'], ['S + J / S + L', '低段刺拳 / 低段连打（下段）'], ['U', '扔牛奶（抛物线飞行道具）'], ['S + U', '电动车冲撞（起手无敌）'], ['I', '超必杀：牛奶暴雨']],
    chick: [['J ×4', '啄击 → 横甩 → 点指 → 旋转五连'], ['K ×2', '运球撞 → 跳压击倒'], ['L', '歌声音波（远距离两段）'], ['S + J / S + L', '蹲啄 / 低位运球（下段）'], ['U', '公鸡冲锋（地面飞行道具）'], ['S + U', '快攻运球（三段）'], ['I', '超必杀：篮球雨']]
  },
  en: {
    naiwa: [['J ×4', 'Jab → jab → knee → flurry'], ['K ×2', 'Heavy punch → belly launcher'], ['L', 'Frog kick'], ['S + J / S + L', 'Low punch / sweep (low)'], ['U', 'Belly charge (knockdown)'], ['S + U', 'Whirlwind punches (multi-hit)'], ['I', 'Super: Grin Barrage']],
    kangaroo: [['J ×4', 'Jab → jab → one-two → glove rush'], ['K ×2', 'Heavy → uppercut knockdown'], ['L', 'Long-arm glove (huge reach)'], ['S + J / S + L', 'Low jab / low rush (low)'], ['U', 'Milk carton throw (arcing projectile)'], ['S + U', 'Scooter ram (invincible start)'], ['I', 'Super: Milk Storm']],
    chick: [['J ×4', 'Peck → swing → dab → shadow five'], ['K ×2', 'Dribble ram → jumping press'], ['L', 'Sound wave (long, 2 hits)'], ['S + J / S + L', 'Low peck / low dribble (low)'], ['U', 'Rooster run (ground projectile)'], ['S + U', 'Fast break dribble (3 hits)'], ['I', 'Super: Hoop Shower']]
  }
};

function showControls(back = showMenu) {
  current = () => showControls(back);
  const row = (label, p1, p2) => `<tr><td>${label}</td><td>${p1}</td><td>${p2}</td></tr>`;
  const k = (...keys) => keys.map(x => `<kbd>${x}</kbd>`).join('');
  const lists = MOVE_LISTS[getLang()];
  const moveList = (id) => `<div class="moves"><b>${t('movesTitle', { name: L(CHARACTERS[id].name) })}</b><br>${lists[id].map(([i, d]) => `<kbd>${i}</kbd> ${d}`).join('<br>')}</div>`;
  show(`<div class="screen">
      ${cornerButtons()}
      <h2 class="screen-title" style="margin-top:6px">${t('controls')}</h2>
      <div class="controls-wrap">
        <div class="panel" style="min-width:0;text-align:left;padding:18px 22px">
          <table class="ctrl-table">
            <tr><td></td><td><b style="color:var(--p1)">${t('p1')}</b></td><td><b style="color:var(--p2)">${t('p2')}</b></td></tr>
            ${row(t('ctrlMove'), k('A', 'D'), k('←', '→'))}
            ${row(t('ctrlDash'), k('A A') + ' ' + k('D D'), k('← ←') + ' ' + k('→ →'))}
            ${row(t('ctrlJump'), k('W') + ' / ' + k('Space'), k('↑'))}
            ${row(t('ctrlCrouch'), k('S'), k('↓'))}
            ${row(t('ctrlLight'), k('J'), k('1'))}
            ${row(t('ctrlHeavy'), k('K'), k('2'))}
            ${row(t('ctrlKick'), k('L'), k('3'))}
            ${row(t('ctrlSpecial'), k('U'), k('4'))}
            ${row(t('ctrlSuper'), k('I'), k('5'))}
            ${row(t('ctrlGuard'), k('Shift'), k('R-Shift') + k('0'))}
            ${row(t('ctrlPause'), k('Esc'), '')}
          </table>
        </div>
        <div class="panel moves-panel">${CHAR_IDS.map(moveList).join('')}</div>
        <div class="tips">${t('ctrlTips')}</div>
      </div>
      <div class="menu" style="width:260px;margin-top:12px">${panelItem('c-back', t('back'))}</div>
    </div>`);
  bindCorner(back);
  $('#c-back').onclick = () => { sfx('back'); back(); };
  keyHandler = navMenu(ui, back);
}

initOnline({
  show, navMenu, panelItem, cornerButtons, bindCorner, statsHtml, winQuoteHtml, showMenu, stopMatch, launchRaw,
  setCurrent: (fn) => { current = fn; },
  setKeyHandler: (fn) => { keyHandler = fn; },
  getMatch: () => match
});

// ?debug exposes the running match for testing from the console
if (new URLSearchParams(location.search).has('debug')) {
  window.__brawl = { get match() { return match; }, launch, showSelect, showMenu, showStageSelect, showSettings };
}

boot();
