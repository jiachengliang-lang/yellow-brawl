/* UI text in Chinese and English. */

const STRINGS = {
  gameTitle: { zh: '黄色大乱斗', en: 'YELLOW BRAWL' },
  gameSub: { zh: 'MEME FIGHTER · 2D 格斗', en: 'MEME FIGHTER · 2D ARCADE' },
  pressStart: { zh: '按任意键开始', en: 'PRESS ANY KEY' },
  arcade: { zh: '街机模式', en: 'Arcade' },
  arcadeDesc: { zh: '连打三场电脑，难度逐级提升', en: 'Beat three CPU fights of rising difficulty' },
  versus: { zh: '本地双人', en: 'Versus' },
  versusDesc: { zh: '同一键盘，两人对打', en: 'Two players, one keyboard' },
  training: { zh: '招式训练', en: 'Training' },
  trainingDesc: { zh: '无限血量与能量，练连段', en: 'Infinite health and meter, practice combos' },
  controls: { zh: '按键说明', en: 'Controls' },
  controlsDesc: { zh: '查看所有招式与按键', en: 'Every move and key' },
  language: { zh: 'English', en: '中文' },
  back: { zh: '返回', en: 'Back' },
  selectFighter: { zh: '选择角色', en: 'Select Fighter' },
  selectDummy: { zh: '选择训练对手', en: 'Select Dummy' },
  p1: { zh: '1P', en: 'P1' },
  p2: { zh: '2P', en: 'P2' },
  cpu: { zh: '电脑', en: 'CPU' },
  ready: { zh: '已就绪', en: 'READY' },
  power: { zh: '力量', en: 'Power' },
  speed: { zh: '速度', en: 'Speed' },
  guts: { zh: '耐打', en: 'Guts' },
  selectHint1: { zh: 'A / D 选择 · J 确认', en: 'A / D to move · J to confirm' },
  selectHint2: { zh: '← / → 选择 · 1 确认', en: '← / → to move · 1 to confirm' },
  round: { zh: '第 {n} 回合', en: 'ROUND {n}' },
  finalRound: { zh: '决胜回合', en: 'FINAL ROUND' },
  fight: { zh: '开打！', en: 'FIGHT!' },
  ko: { zh: 'K.O.', en: 'K.O.' },
  timeOver: { zh: '时间到', en: 'TIME OVER' },
  draw: { zh: '平局', en: 'DRAW' },
  wins: { zh: '{name} 胜！', en: '{name} WINS!' },
  perfect: { zh: '完美！', en: 'PERFECT!' },
  hits: { zh: '{n} 连击', en: '{n} HITS' },
  superReady: { zh: '必杀就绪', en: 'SUPER READY' },
  paused: { zh: '暂停', en: 'Paused' },
  resume: { zh: '继续', en: 'Resume' },
  restart: { zh: '重新开始', en: 'Restart' },
  quit: { zh: '退出到主菜单', en: 'Quit to Menu' },
  stageOf: { zh: '第 {n} / {total} 战', en: 'Fight {n} / {total}' },
  difficulty_easy: { zh: '简单', en: 'Easy' },
  difficulty_normal: { zh: '普通', en: 'Normal' },
  difficulty_hard: { zh: '困难', en: 'Hard' },
  youWin: { zh: '你赢了', en: 'You Win' },
  youLose: { zh: '你输了', en: 'You Lose' },
  nextFight: { zh: '下一战', en: 'Next Fight' },
  retry: { zh: '再来一次', en: 'Retry' },
  rematch: { zh: '再战一局', en: 'Rematch' },
  changeFighters: { zh: '重新选角', en: 'Change Fighters' },
  champion: { zh: '梗王诞生！', en: 'MEME KING CROWNED!' },
  championSub: { zh: '三连胜，整条大排档都是你的了。', en: 'Three straight wins. The whole night market is yours.' },
  matchWinner: { zh: '{name} 获得胜利', en: '{name} takes the match' },
  // training
  trDummy: { zh: '对手行为 (Y)', en: 'Dummy (Y)' },
  trDummy_stand: { zh: '站立', en: 'Stand' },
  trDummy_crouch: { zh: '下蹲', en: 'Crouch' },
  trDummy_block: { zh: '全防', en: 'Block all' },
  trDummy_jump: { zh: '跳跃', en: 'Jump' },
  trDummy_cpu: { zh: '电脑对打', en: 'CPU' },
  trMeter: { zh: '无限能量 (M)', en: 'Infinite meter (M)' },
  trHitboxes: { zh: '显示判定框 (T)', en: 'Show hitboxes (T)' },
  trReset: { zh: '复位 (R)', en: 'Reset (R)' },
  trLastCombo: { zh: '上次连段：{hits} 击 · {dmg} 伤害', en: 'Last combo: {hits} hits · {dmg} dmg' },
  on: { zh: '开', en: 'On' },
  off: { zh: '关', en: 'Off' },
  // controls screen
  ctrlMove: { zh: '移动 / 后退防御', en: 'Move / hold back to block' },
  ctrlJump: { zh: '跳跃', en: 'Jump' },
  ctrlCrouch: { zh: '下蹲（蹲防下段）', en: 'Crouch (crouch-block lows)' },
  ctrlLight: { zh: '轻拳（连按出连段）', en: 'Light (tap for a combo string)' },
  ctrlHeavy: { zh: '重拳（连按两次）', en: 'Heavy (tap twice)' },
  ctrlKick: { zh: '踢 / 长距离技', en: 'Kick / long-range move' },
  ctrlSpecial: { zh: '必杀技（消耗半条能量；下+必杀 = 第二必杀）', en: 'Special (costs half a bar; down + special = 2nd special)' },
  ctrlSuper: { zh: '超必杀（能量满）', en: 'Super (full meter)' },
  ctrlGuard: { zh: '防御（不按方向也能挡）', en: 'Guard (block without holding back)' },
  ctrlPause: { zh: '暂停', en: 'Pause' },
  ctrlTips: {
    zh: '小技巧：轻拳打中后立刻按必杀可以取消接必杀；下段扫腿必须蹲防；倒地后按任意键可以更快起身。',
    en: 'Tips: cancel a light hit straight into a special; sweeps must be crouch-blocked; mash buttons to get up faster.'
  },
  movesTitle: { zh: '{name} 招式表', en: '{name} move list' },
  loading: { zh: '加载中…', en: 'Loading…' },
  // phase 2
  settings: { zh: '设置', en: 'Settings' },
  settingsDesc: { zh: '音量、回合时间、对手', en: 'Volume, round time, opponents' },
  musicVol: { zh: '音乐音量', en: 'Music volume' },
  sfxVol: { zh: '音效音量', en: 'Sound effects' },
  roundTimeLbl: { zh: '回合时间', en: 'Round time' },
  noLimit: { zh: '不限时', en: 'No limit' },
  seconds: { zh: '{n} 秒', en: '{n}s' },
  winsNeededLbl: { zh: '胜利所需回合', en: 'Rounds to win' },
  vsCpuLbl: { zh: '本地双人 · 2P', en: 'Versus · P2' },
  vsHuman: { zh: '真人', en: 'Human' },
  vsCpuDesc: { zh: '1P 对电脑，自选对手', en: '1P vs CPU, pick the opponent' },
  settingsHint: { zh: '↑ ↓ 选择 · ← → 调整 · Esc 返回', en: '↑ ↓ select · ← → change · Esc back' },
  selectOpponent: { zh: '选择对手', en: 'Select Opponent' },
  selectStage: { zh: '选择场地', en: 'Select Stage' },
  randomStage: { zh: '随机', en: 'Random' },
  statsTitle: { zh: '本局数据', en: 'Match stats' },
  statDealt: { zh: '造成伤害', en: 'Damage dealt' },
  statHits: { zh: '命中次数', en: 'Hits landed' },
  statMaxCombo: { zh: '最大连击', en: 'Best combo' },
  statBlocks: { zh: '成功防御', en: 'Hits blocked' },
  statSupers: { zh: '超必杀', en: 'Supers' },
  // presentation
  titleTop: { zh: '黄色', en: 'YELLOW' },
  titleBottom: { zh: '大乱斗', en: 'BRAWL' },
  tagline: { zh: '三只黄色的家伙，一条夜市街，只有一个能站到最后。', en: 'Three yellow troublemakers, one night market, one left standing.' },
  selectMode: { zh: '选择模式', en: 'Select mode' },
  pressEnter: { zh: '按 Enter 开始', en: 'Press Enter to start' },
  fxDizzy: { zh: '眩晕', en: 'DIZZY' },
  fxDribble: { zh: '运球！', en: 'DRIBBLE!' },
  fxCatch: { zh: '接着！', en: 'CATCH!' },
  fxShadow: { zh: '鸡影！', en: 'SHADOW CLONES!' },
  fxShoulder: { zh: '肩撞', en: 'BUMP' },
  // phase 3: online
  online: { zh: '在线对战', en: 'Online' },
  onlineDesc: { zh: '房间号 / 邀请链接 / 快速匹配', en: 'Room codes, invite links, quick match' },
  nickname: { zh: '昵称', en: 'Nickname' },
  connecting: { zh: '正在连接服务器…', en: 'Connecting to server…' },
  connected: { zh: '已连接 · 在线 {n} 人 · 延迟 {ms}ms', en: 'Connected · {n} online · {ms}ms ping' },
  offline: { zh: '连不上联机服务器。请用 npm start 启动游戏服务器后再试。', en: 'Can\'t reach the online server. Start it with npm start and try again.' },
  retry2: { zh: '重试', en: 'Retry' },
  quickMatch: { zh: '快速匹配', en: 'Quick Match' },
  quickMatchDesc: { zh: '自动配对下一个在线玩家', en: 'Pair with the next player looking for a match' },
  createRoom: { zh: '创建房间', en: 'Create Room' },
  createRoomDesc: { zh: '拿到房间号，发给朋友', en: 'Get a room code to send to a friend' },
  joinRoom: { zh: '加入', en: 'Join' },
  roomCodePh: { zh: '输入 4 位房间号', en: '4-letter room code' },
  openRooms: { zh: '等待中的房间', en: 'Open rooms' },
  noRooms: { zh: '暂时没有房间，创建一个吧', en: 'No open rooms yet. Create one!' },
  searching: { zh: '正在寻找对手…', en: 'Looking for an opponent…' },
  cancel: { zh: '取消', en: 'Cancel' },
  room: { zh: '房间', en: 'Room' },
  copyLink: { zh: '复制邀请链接', en: 'Copy invite link' },
  copied: { zh: '已复制', en: 'Copied' },
  host: { zh: '房主', en: 'Host' },
  guest: { zh: '挑战者', en: 'Challenger' },
  you: { zh: '你', en: 'You' },
  waitingPlayer: { zh: '等待对手加入…', en: 'Waiting for an opponent…' },
  pickChar: { zh: '选角色（A / D）', en: 'Pick a fighter (A / D)' },
  stageHostOnly: { zh: '场地（房主选，Q / E）', en: 'Stage (host picks, Q / E)' },
  readyBtn: { zh: '准备（J / Enter）', en: 'Ready (J / Enter)' },
  unready: { zh: '取消准备', en: 'Not ready' },
  notReady: { zh: '未准备', en: 'Not ready' },
  leaveRoom: { zh: '离开房间', en: 'Leave room' },
  err_no_room: { zh: '没有找到这个房间', en: 'Room not found' },
  err_room_full: { zh: '房间已满或正在对战', en: 'That room is full or mid-match' },
  peerLeft: { zh: '对手离开了房间', en: 'Your opponent left the room' },
  peerQuit: { zh: '对手退出了对战', en: 'Your opponent quit the match' },
  lostConnection: { zh: '与服务器的连接断开了', en: 'Lost connection to the server' },
  quitMatchQ: { zh: '退出这场对战？', en: 'Quit this match?' },
  backToRoom: { zh: '回到房间（再来一局）', en: 'Back to room (rematch)' },
  onlineHint: { zh: '你用 1P 按键（WASD · J K L U I）', en: 'You use the P1 keys (WASD · J K L U I)' },
  ctrlDash: { zh: '冲刺 / 后撤（连按两下方向）', en: 'Dash / backdash (double-tap)' },
  footer: { zh: '本地素材版 · 角色贴图仅供本地使用', en: 'Local art build · character sprites for local use only' }
};

let lang = 'zh';
try {
  const saved = localStorage.getItem('brawl-lang');
  if (saved === 'zh' || saved === 'en') lang = saved;
  else if (!/^zh/i.test(navigator.language || '')) lang = 'en';
} catch (_) { /* storage blocked */ }

export function getLang() { return lang; }

/* Lines for the scrolling ticker on the title and menu screens. */
export const TICKER = {
  zh: ['奶蛙：肚子不是用来挨打的，是用来顶人的。', '肥嘟嘟：差评可以，迟到不行。', '小鸡子：这一段，只唱给对手听。', '小提示：下段扫腿必须蹲防。', '小提示：连按两下方向键可以冲刺。', '小提示：轻拳命中后立刻按必杀可以取消。'],
  en: ['Naiwa: this belly isn\'t for taking hits. It\'s for giving them.', 'Feidudu: bad reviews are fine. Late deliveries aren\'t.', 'Chick: this verse is for my opponent only.', 'Tip: sweeps must be crouch-blocked.', 'Tip: double-tap a direction to dash.', 'Tip: cancel a landed light attack into a special.']
};

export function setLang(next) {
  lang = next === 'en' ? 'en' : 'zh';
  try { localStorage.setItem('brawl-lang', lang); } catch (_) {}
  document.documentElement.lang = lang === 'zh' ? 'zh-CN' : 'en';
}

export function t(key, vars = {}) {
  const entry = STRINGS[key];
  let s = entry ? (entry[lang] ?? entry.zh) : key;
  for (const [k, v] of Object.entries(vars)) s = s.replace(`{${k}}`, v);
  return s;
}

/* Pick the current language from a { zh, en } object. */
export function L(obj) {
  return obj ? (obj[lang] ?? obj.zh) : '';
}

document.documentElement.lang = lang === 'zh' ? 'zh-CN' : 'en';
