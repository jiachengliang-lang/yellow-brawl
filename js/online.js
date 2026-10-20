/* Online play screens: lobby → (quick match | create | join) → room → match → result.
 * Netcode lives in match.js (snapshots) and server/server.js (relay); this file is UI + wiring.
 */

import { CHARACTERS, CHAR_IDS } from './data.js';
import { STAGES, STAGE_IDS, stageThumb } from './stage.js';
import { net } from './net.js';
import { sfx } from './audio.js';
import { playMusic } from './music.js';
import { t, L } from './i18n.js';

const $ = (s, el = document) => el.querySelector(s);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const NAMES = ['夜宵战神', '大排档常客', '黄色闪电', '肚皮选手', '拳套新人', '凌晨练习生', '路过的鸡', '牛奶党'];

let api = null;            // helpers from main.js
let room = null;           // latest room state from the server
let screen = null;         // 'lobby' | 'search' | 'room' | 'match' | 'result'
let cursor = 0;            // character cursor in the room screen
let roomTimer = null;
let notice = '';
const thumbs = {};

function getName() {
  try {
    const n = localStorage.getItem('brawl-name');
    if (n) return n;
  } catch (_) {}
  return NAMES[Math.floor(Math.random() * NAMES.length)];
}

function setName(n) {
  try { localStorage.setItem('brawl-name', n); } catch (_) {}
  net.send({ type: 'hello', name: n });
}

/* ------------------------------------------------------------ server events */
let wired = false;
function wire() {
  if (wired) return;
  wired = true;
  net.on('status', () => { if (screen === 'lobby') renderLobbyStatus(); if (net.state === 'offline' && screen && screen !== 'lobby') lostConnection(); });
  net.on('latency', () => { if (screen === 'lobby') renderLobbyStatus(); const el = $('#room-ping'); if (el) el.textContent = `${net.latency}ms`; });
  net.on('online', () => { if (screen === 'lobby') renderLobbyStatus(); });
  net.on('welcome', () => net.send({ type: 'hello', name: getName() }));
  net.on('rooms', (m) => { if (screen === 'lobby') renderRoomList(m.rooms); });
  net.on('queued', () => {});
  net.on('error', (m) => {
    notice = t(m.code === 'room-full' ? 'err_room_full' : 'err_no_room');
    sfx('back');
    showLobby();
  });
  net.on('room', (m) => {
    const fresh = !room || room.code !== m.code;
    room = m;
    if (fresh) cursor = Math.max(0, CHAR_IDS.indexOf(me()?.pick));
    if (screen === 'match' || screen === 'result') return;
    if (screen !== 'room' || fresh) { sfx('select'); showRoom(); } else renderRoom();
  });
  net.on('start', (m) => startOnlineMatch(m));
  net.on('snap', (m) => { const match = api.getMatch(); if (match?.isGuest) match.applySnapshot(m.d); });
  net.on('input', (m) => { const match = api.getMatch(); if (match?.online?.role === 'host') match.setRemoteInput(m.m); });
  net.on('match-over', (m) => { if (screen === 'match' && room?.you === 'guest') showResult(m.result); });
  net.on('peer-left', () => interrupted(t('peerLeft')));
  net.on('peer-quit', () => interrupted(t('peerQuit')));
}

function me() { return room ? room[room.you] : null; }
function them() { return room ? room[room.you === 'host' ? 'guest' : 'host'] : null; }

function interrupted(msg) {
  notice = msg;
  if (screen === 'match' || screen === 'result') { api.stopMatch(); screen = null; }
  if (room) showRoom(); else showLobby();
}

function lostConnection() {
  api.stopMatch();
  room = null;
  notice = t('lostConnection');
  showLobby();
}

/* ------------------------------------------------------------ lobby */
export function initOnline(helpers) {
  api = helpers;
  wire();
}

export function showOnline(opts = {}) {
  net.connect();
  if (opts.join) net.send({ type: 'join', code: opts.join });
  showLobby();
}

function leaveScreens() {
  clearInterval(roomTimer);
  roomTimer = null;
}

function showLobby() {
  leaveScreens();
  api.stopMatch();
  playMusic('menu');
  screen = 'lobby';
  api.setCurrent(showLobby);
  if (room) { net.send({ type: 'leave' }); room = null; }
  const name = getName();
  api.show(`<div class="screen online">
      ${api.cornerButtons()}
      <h2 class="screen-title">${t('online')}</h2>
      <div class="screen-sub" id="net-status"></div>
      ${notice ? `<div class="notice">${esc(notice)}</div>` : ''}
      <div class="online-grid">
        <div class="panel online-actions">
          <label class="field"><span>${t('nickname')}</span><input id="nick" maxlength="16" value="${esc(name)}" autocomplete="off"></label>
          <div class="menu">
            <button class="menu-item" data-nav id="o-quick"><span class="no">⚡</span><span><b>${t('quickMatch')}</b><small>${t('quickMatchDesc')}</small></span><span class="arrow">↗</span></button>
            <button class="menu-item" data-nav id="o-create"><span class="no">＋</span><span><b>${t('createRoom')}</b><small>${t('createRoomDesc')}</small></span><span class="arrow">↗</span></button>
          </div>
          <div class="join-row">
            <input id="code" maxlength="4" placeholder="${t('roomCodePh')}" autocomplete="off">
            <button class="btn" id="o-join">${t('joinRoom')}</button>
          </div>
          <button class="btn" id="o-back" style="margin-top:12px">${t('back')}</button>
        </div>
        <div class="panel online-rooms">
          <b>${t('openRooms')}</b>
          <div id="room-list" class="room-list"></div>
        </div>
      </div>
    </div>`);
  notice = '';
  api.bindCorner();
  renderLobbyStatus();
  const nick = $('#nick');
  nick.addEventListener('change', () => setName(nick.value.trim() || name));
  const code = $('#code');
  code.addEventListener('input', () => { code.value = code.value.toUpperCase().replace(/[^A-Z0-9]/g, ''); });
  code.addEventListener('keydown', (e) => { if (e.key === 'Enter') join(); e.stopPropagation(); });
  nick.addEventListener('keydown', (e) => e.stopPropagation());
  const join = () => { if (code.value.length === 4) { sfx('select'); net.send({ type: 'join', code: code.value }); } };
  $('#o-join').onclick = join;
  $('#o-quick').onclick = () => { sfx('select'); setName(nick.value.trim() || name); showSearching(); };
  $('#o-create').onclick = () => { sfx('select'); setName(nick.value.trim() || name); net.send({ type: 'create' }); };
  $('#o-back').onclick = () => { sfx('back'); exitOnline(); };
  api.setKeyHandler(api.navMenu($('.online-actions'), exitOnline));
  net.send({ type: 'list' });
  roomTimer = setInterval(() => net.send({ type: 'list' }), 3000);
}

function exitOnline() {
  leaveScreens();
  if (room) net.send({ type: 'leave' });
  room = null; screen = null;
  api.showMenu();
}

function renderLobbyStatus() {
  const el = $('#net-status');
  if (!el) return;
  if (net.state === 'online') el.textContent = t('connected', { n: net.online || 1, ms: net.latency });
  else if (net.state === 'connecting') el.textContent = t('connecting');
  else {
    el.innerHTML = `${t('offline')} <button class="btn small" id="net-retry">${t('retry2')}</button>`;
    $('#net-retry').onclick = () => net.connect();
  }
}

function renderRoomList(list) {
  const el = $('#room-list');
  if (!el) return;
  el.innerHTML = list.length
    ? list.map(r => `<div class="room-row"><span class="code">${esc(r.code)}</span><span>${esc(r.host)}</span><button class="btn small" data-code="${esc(r.code)}">${t('joinRoom')}</button></div>`).join('')
    : `<div class="muted">${t('noRooms')}</div>`;
  el.querySelectorAll('[data-code]').forEach(b => b.addEventListener('click', () => { sfx('select'); net.send({ type: 'join', code: b.dataset.code }); }));
}

/* ------------------------------------------------------------ quick match */
function showSearching() {
  leaveScreens();
  screen = 'search';
  api.setCurrent(showSearching);
  net.send({ type: 'quick' });
  api.show(`<div class="screen">
      <div class="spinner"></div>
      <h2 class="screen-title" style="margin-top:22px">${t('searching')}</h2>
      <div class="screen-sub" id="search-time">0s</div>
      <div class="menu" style="width:260px">${api.panelItem('s-cancel', t('cancel'))}</div>
    </div>`);
  const t0 = Date.now();
  roomTimer = setInterval(() => { const el = $('#search-time'); if (el) el.textContent = `${Math.floor((Date.now() - t0) / 1000)}s`; }, 500);
  const cancel = () => { sfx('back'); net.send({ type: 'cancel-quick' }); showLobby(); };
  $('#s-cancel').onclick = cancel;
  api.setKeyHandler(api.navMenu(document, cancel));
}

/* ------------------------------------------------------------ room */
function inviteLink() {
  return `${location.origin}${location.pathname}?room=${room.code}`;
}

function showRoom() {
  leaveScreens();
  screen = 'room';
  playMusic('menu');
  api.setCurrent(showRoom);
  for (const id of STAGE_IDS) thumbs[id] = thumbs[id] || stageThumb(id, 192, 108);
  api.show(`<div class="screen online">
      ${api.cornerButtons()}
      <div class="room-head">
        <div><small>${t('room')}</small><div class="room-code">${esc(room.code)}</div></div>
        <button class="btn" id="r-copy">${t('copyLink')}</button>
        <span class="ping" id="room-ping">${net.latency}ms</span>
      </div>
      ${notice ? `<div class="notice">${esc(notice)}</div>` : ''}
      <div id="room-body"></div>
      <div class="select-hints"><span>${t('onlineHint')}</span><span>Esc · ${t('leaveRoom')}</span></div>
    </div>`);
  notice = '';
  api.bindCorner();
  $('#r-copy').onclick = async (e) => {
    const btn = e.currentTarget;
    try { await navigator.clipboard.writeText(inviteLink()); btn.textContent = t('copied'); }
    catch (_) { prompt(t('copyLink'), inviteLink()); }
    sfx('select');
  };
  renderRoom();
  api.setKeyHandler((e) => {
    const c = e.code;
    if (c === 'Escape' || c === 'Backspace') { sfx('back'); showLobby(); }
    else if (c === 'KeyA' || c === 'ArrowLeft') pick(-1);
    else if (c === 'KeyD' || c === 'ArrowRight') pick(1);
    else if (c === 'KeyQ') stage(-1);
    else if (c === 'KeyE') stage(1);
    else if (c === 'KeyJ' || c === 'Enter' || c === 'Space') { e.preventDefault(); toggleReady(); }
  });
  if (!me()?.pick) net.send({ type: 'pick', charId: CHAR_IDS[cursor] });
}

function pick(d) {
  if (me()?.ready) return;
  cursor = (cursor + d + CHAR_IDS.length) % CHAR_IDS.length;
  sfx('move');
  net.send({ type: 'pick', charId: CHAR_IDS[cursor] });
}

function stage(d) {
  if (room.you !== 'host') return;
  const opts = [...STAGE_IDS, 'random'];
  const i = (opts.indexOf(room.stage) + d + opts.length) % opts.length;
  sfx('move');
  net.send({ type: 'stage', stage: opts[i] });
}

function toggleReady() {
  if (!me()?.pick) return;
  sfx('select');
  net.send({ type: 'ready', ready: !me().ready });
}

function playerBox(p, label, isMe) {
  if (!p) return `<div class="player-box empty"><div class="spinner small"></div><span>${t('waitingPlayer')}</span></div>`;
  const c = p.pick && CHARACTERS[p.pick];
  return `<div class="player-box ${p.ready ? 'ready' : ''} ${isMe ? 'me' : ''}">
    ${c ? `<img src="${c.card}" alt="">` : '<div class="no-pick">?</div>'}
    <div class="pb-info">
      <small>${label}${isMe ? ` · ${t('you')}` : ''}</small>
      <b>${esc(p.name)}</b>
      <span>${c ? L(c.name) : '—'}</span>
      <em class="${p.ready ? 'on' : ''}">${p.ready ? t('ready') : t('notReady')}</em>
    </div>
  </div>`;
}

function renderRoom() {
  const body = $('#room-body');
  if (!body || !room) return;
  const mine = me();
  const isHost = room.you === 'host';
  const stages = [...STAGES.map(s => ({ id: s.id, name: L(s.name), img: thumbs[s.id] })), { id: 'random', name: t('randomStage') }];
  body.innerHTML = `
    <div class="room-players">
      ${playerBox(room.host, t('host'), isHost)}
      <div class="vs">VS</div>
      ${playerBox(room.guest, t('guest'), !isHost)}
    </div>
    <div class="room-pickers">
      <div>
        <small>${t('pickChar')}</small>
        <div class="mini-chars">${CHAR_IDS.map((id, i) => `<button class="mini-char ${mine?.pick === id ? 'on' : ''}" data-char="${i}" ${mine?.ready ? 'disabled' : ''}>
          <img src="${CHARACTERS[id].portrait}" alt=""><span>${L(CHARACTERS[id].name)}</span></button>`).join('')}</div>
      </div>
      <div>
        <small>${t('stageHostOnly')}</small>
        <div class="mini-stages">${stages.map(s => `<button class="mini-stage ${room.stage === s.id ? 'on' : ''}" data-stage="${s.id}" ${isHost ? '' : 'disabled'}>
          ${s.img ? `<img src="${s.img}" alt="">` : '<div class="random-thumb">?</div>'}<span>${s.name}</span></button>`).join('')}</div>
      </div>
    </div>
    <div class="room-actions">
      <button class="btn big ${mine?.ready ? 'on' : ''}" id="r-ready" ${mine?.pick ? '' : 'disabled'}>${mine?.ready ? t('unready') : t('readyBtn')}</button>
      <button class="btn" id="r-leave">${t('leaveRoom')}</button>
    </div>`;
  body.querySelectorAll('[data-char]').forEach(b => b.addEventListener('click', () => { cursor = Number(b.dataset.char); pick(0); }));
  body.querySelectorAll('[data-stage]').forEach(b => b.addEventListener('click', () => { if (isHost) { sfx('move'); net.send({ type: 'stage', stage: b.dataset.stage }); } }));
  $('#r-ready').onclick = toggleReady;
  $('#r-leave').onclick = () => { sfx('back'); showLobby(); };
}

/* ------------------------------------------------------------ match */
function startOnlineMatch(m) {
  leaveScreens();
  screen = 'match';
  const role = room.you;
  const match = api.launchRaw({
    mode: 'online',
    chars: m.chars,
    cpu: [null, null],
    stage: m.stage,
    names: m.names,
    online: { role, send: (msg) => net.send(msg) },
    onEnd: role === 'host' ? (r) => {
      const result = { winner: r.winner, wins: r.wins, fighters: match.fighters.map(f => ({ id: f.id, stats: { ...f.stats } })) };
      net.send({ type: 'match-over', result });
      setTimeout(() => showResult(result), 700);
    } : null
  });
  api.setCurrent(() => {});
  api.show(`<div class="hint-bar">${role === 'host' ? t('host') : t('guest')} · ${t('onlineHint')} · Esc</div>`);
  api.setKeyHandler((e) => { if (e.code === 'Escape') confirmQuit(); });
}

function confirmQuit() {
  api.show(`<div class="screen clear"><div class="panel">
      <h2 class="screen-title">${t('quitMatchQ')}</h2>
      <div class="menu">${api.panelItem('q-no', t('resume'))}${api.panelItem('q-yes', t('quit'))}</div>
    </div></div>`);
  const resume = () => { api.show(`<div class="hint-bar">${t('onlineHint')} · Esc</div>`); api.setKeyHandler((e) => { if (e.code === 'Escape') confirmQuit(); }); };
  $('#q-no').onclick = resume;
  $('#q-yes').onclick = () => { sfx('back'); net.send({ type: 'quit-match' }); api.stopMatch(); screen = null; showRoom(); };
  const nav = api.navMenu(document, null);
  api.setKeyHandler((e) => { if (e.code === 'Escape') resume(); else nav(e); });
}

function showResult(result) {
  api.stopMatch();
  playMusic('menu');
  screen = 'result';
  api.setCurrent(() => showResult(result));
  const mySide = room?.you === 'guest' ? 1 : 0;
  const won = result.winner === mySide;
  const draw = result.winner == null;
  api.show(`<div class="screen clear">
      <div class="panel">
        <p class="result-big ${won || draw ? 'win' : 'lose'}">${draw ? t('draw') : won ? t('youWin') : t('youLose')}</p>
        ${api.winQuoteHtml(result)}
        ${api.statsHtml(result)}
        <div class="menu">${api.panelItem('or-room', t('backToRoom'))}${api.panelItem('or-leave', t('leaveRoom'))}</div>
      </div>
    </div>`);
  sfx(won ? 'win' : 'back');
  $('#or-room').onclick = () => { sfx('select'); screen = null; room ? showRoom() : showLobby(); };
  $('#or-leave').onclick = () => { sfx('back'); showLobby(); };
  api.setKeyHandler(api.navMenu(document, () => showLobby()));
}
