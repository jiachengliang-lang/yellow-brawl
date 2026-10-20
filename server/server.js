/* Yellow Brawl game server: serves the static game + a WebSocket lobby on /ws.
 * Zero dependencies (Node 18+). Run:  node server/server.js
 *
 * Netcode model: host-authoritative. The room host runs the simulation;
 * the guest sends button states, the host streams state snapshots back.
 * This server only matches players and relays messages inside a room.
 */

import http from 'node:http';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const arg = (name) => { const i = process.argv.indexOf(`--${name}`); return i > 0 ? process.argv[i + 1] : undefined; };
const PORT = Number(arg('port') || process.env.PORT) || 8787;
const HOST = arg('host') || process.env.HOST || '0.0.0.0';
const MAX_MSG = 64 * 1024;
const CHAR_IDS = ['naiwa', 'kangaroo', 'chick'];
const STAGE_IDS = ['market', 'rooftop', 'temple'];

/* ------------------------------------------------------------------ static files */
const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.json': 'application/json', '.png': 'image/png', '.webp': 'image/webp', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml',
  '.md': 'text/plain; charset=utf-8', '.ico': 'image/x-icon'
};

function serveStatic(req, res) {
  let urlPath;
  try { urlPath = decodeURIComponent(new URL(req.url, 'http://x').pathname); } catch { res.writeHead(400).end(); return; }
  if (urlPath.endsWith('/')) urlPath += 'index.html';
  const file = path.resolve(ROOT, '.' + urlPath);
  // stay inside the project and never serve the server code or dotfiles
  if (!file.startsWith(ROOT + path.sep) || file.includes(`${path.sep}server${path.sep}`) || /\/\./.test(urlPath)) {
    res.writeHead(404).end('Not found');
    return;
  }
  fs.stat(file, (err, st) => {
    if (err || !st.isFile()) { res.writeHead(404).end('Not found'); return; }
    res.writeHead(200, {
      'Content-Type': MIME[path.extname(file).toLowerCase()] || 'application/octet-stream',
      'Content-Length': st.size,
      'Cache-Control': /\/assets\//.test(urlPath) ? 'public, max-age=3600' : 'no-cache'
    });
    fs.createReadStream(file).pipe(res);
  });
}

/* ------------------------------------------------------------------ minimal WebSocket (RFC 6455) */
class Socket {
  constructor(sock) {
    this.sock = sock;
    this.buf = Buffer.alloc(0);
    this.frag = null;
    this.open = true;
    this.onmessage = null;
    this.onclose = null;
    this.lastFrame = Date.now();
    sock.setNoDelay(true);
    sock.on('data', (d) => this.receive(d));
    sock.on('close', () => this.closed());
    sock.on('error', () => this.closed());
  }

  receive(chunk) {
    this.buf = Buffer.concat([this.buf, chunk]);
    while (this.buf.length >= 2) {
      const b0 = this.buf[0], b1 = this.buf[1];
      const fin = (b0 & 0x80) !== 0;
      const op = b0 & 0x0f;
      const masked = (b1 & 0x80) !== 0;
      let len = b1 & 0x7f;
      let off = 2;
      if (len === 126) { if (this.buf.length < 4) return; len = this.buf.readUInt16BE(2); off = 4; }
      else if (len === 127) { if (this.buf.length < 10) return; len = Number(this.buf.readBigUInt64BE(2)); off = 10; }
      if (len > MAX_MSG || !masked) return this.close(1009);
      if (this.buf.length < off + 4 + len) return;
      const mask = this.buf.subarray(off, off + 4);
      const data = Buffer.from(this.buf.subarray(off + 4, off + 4 + len));
      for (let i = 0; i < data.length; i++) data[i] ^= mask[i & 3];
      this.buf = this.buf.subarray(off + 4 + len);
      this.lastFrame = Date.now();       // any frame, including pongs, proves the peer is alive

      if (op === 0x8) return this.close(1000);
      if (op === 0x9) { this.frame(0xA, data); continue; }
      if (op === 0xA) continue;
      if (op === 0x1 || op === 0x2) this.frag = [data];
      else if (op === 0x0 && this.frag) this.frag.push(data);
      if (fin && this.frag) {
        const msg = Buffer.concat(this.frag).toString('utf8');
        this.frag = null;
        this.onmessage?.(msg);
      }
    }
  }

  frame(op, payload) {
    if (!this.open) return;
    const len = payload.length;
    let header;
    if (len < 126) header = Buffer.from([0x80 | op, len]);
    else if (len < 65536) { header = Buffer.alloc(4); header[0] = 0x80 | op; header[1] = 126; header.writeUInt16BE(len, 2); }
    else { header = Buffer.alloc(10); header[0] = 0x80 | op; header[1] = 127; header.writeBigUInt64BE(BigInt(len), 2); }
    this.sock.write(Buffer.concat([header, payload]));
  }

  send(obj) {
    this.frame(0x1, Buffer.from(typeof obj === 'string' ? obj : JSON.stringify(obj)));
  }

  close(code = 1000) {
    if (!this.open) return;
    const b = Buffer.alloc(2); b.writeUInt16BE(code);
    try { this.frame(0x8, b); } catch {}
    this.sock.end();
    this.closed();
  }

  closed() {
    if (!this.open) return;
    this.open = false;
    this.sock.destroy();
    this.onclose?.();
  }
}

function upgrade(req, sock) {
  if (new URL(req.url, 'http://x').pathname !== '/ws' || req.headers.upgrade?.toLowerCase() !== 'websocket') {
    sock.end('HTTP/1.1 400 Bad Request\r\n\r\n');
    return;
  }
  const key = req.headers['sec-websocket-key'];
  const accept = crypto.createHash('sha1').update(key + '258EAFA5-E914-47DA-95CA-C5AB0DC85B11').digest('base64');
  sock.write(`HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Accept: ${accept}\r\n\r\n`);
  connect(new Socket(sock));
}

/* ------------------------------------------------------------------ lobby */
const clients = new Map();   // id → client
const rooms = new Map();     // code → room
let queue = [];              // quick-match waiting clients
let nextId = 1;

const clean = (s, n = 16) => String(s ?? '').replace(/[\u0000-\u001f<>]/g, '').trim().slice(0, n);

function newCode() {
  const letters = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code;
  do { code = Array.from({ length: 4 }, () => letters[crypto.randomInt(letters.length)]).join(''); } while (rooms.has(code));
  return code;
}

function connect(ws) {
  const c = { id: nextId++, ws, name: `Player${Math.floor(Math.random() * 900 + 100)}`, room: null };
  clients.set(c.id, c);
  ws.send({ type: 'welcome', id: c.id });
  broadcastCount();
  ws.onmessage = (raw) => {
    let msg;
    try { msg = JSON.parse(raw); } catch { return; }
    try { handle(c, msg, raw); } catch (err) { console.error('[handle]', err); }
  };
  ws.onclose = () => {
    clients.delete(c.id);
    queue = queue.filter(q => q !== c);
    leaveRoom(c);
    broadcastCount();
  };
}

function broadcastCount() {
  for (const c of clients.values()) c.ws.send({ type: 'online', count: clients.size });
}

function roomView(room, forClient) {
  const p = (cl, side) => cl && { name: cl.name, pick: room.picks[side], ready: room.ready[side] };
  return {
    type: 'room', code: room.code, status: room.status, stage: room.stage,
    you: room.host === forClient ? 'host' : 'guest',
    host: p(room.host, 0), guest: p(room.guest, 1)
  };
}

function syncRoom(room) {
  for (const cl of [room.host, room.guest]) if (cl) cl.ws.send(roomView(room, cl));
}

function openRooms() {
  return [...rooms.values()].filter(r => !r.guest && r.status === 'lobby').slice(0, 20).map(r => ({ code: r.code, host: r.host.name }));
}

function makeRoom(host) {
  const room = { code: newCode(), host, guest: null, picks: [null, null], ready: [false, false], stage: 'random', status: 'lobby' };
  rooms.set(room.code, room);
  host.room = room;
  return room;
}

function joinRoom(c, room) {
  room.guest = c;
  room.picks[1] = null; room.ready = [false, false];
  c.room = room;
}

function leaveRoom(c) {
  const room = c.room;
  if (!room) return;
  c.room = null;
  const other = room.host === c ? room.guest : room.host;
  if (!other) { rooms.delete(room.code); return; }
  // the remaining player becomes (or stays) host
  if (room.host === c) room.picks[0] = room.picks[1];
  room.host = other; room.guest = null;
  room.picks[1] = null; room.ready = [false, false]; room.status = 'lobby';
  other.ws.send({ type: 'peer-left' });
  syncRoom(room);
}

function handle(c, msg, raw) {
  const room = c.room;
  const peer = room && (room.host === c ? room.guest : room.host);
  switch (msg.type) {
    case 'ping': c.ws.send({ type: 'pong', t: msg.t }); break;
    case 'hello': c.name = clean(msg.name) || c.name; if (room) syncRoom(room); break;
    case 'list': c.ws.send({ type: 'rooms', rooms: openRooms() }); break;

    case 'create':
      leaveRoom(c); queue = queue.filter(q => q !== c);
      syncRoom(makeRoom(c));
      break;
    case 'join': {
      const target = rooms.get(clean(msg.code, 4).toUpperCase());
      if (!target) { c.ws.send({ type: 'error', code: 'no-room' }); break; }
      if (target.guest || target.status !== 'lobby') { c.ws.send({ type: 'error', code: 'room-full' }); break; }
      if (target.host === c) break;
      leaveRoom(c); queue = queue.filter(q => q !== c);
      joinRoom(c, target);
      syncRoom(target);
      break;
    }
    case 'quick': {
      leaveRoom(c);
      queue = queue.filter(q => q !== c && clients.has(q.id));
      const other = queue.shift();
      if (other) {
        const r = makeRoom(other);
        joinRoom(c, r);
        syncRoom(r);
      } else {
        queue.push(c);
        c.ws.send({ type: 'queued' });
      }
      break;
    }
    case 'cancel-quick': queue = queue.filter(q => q !== c); c.ws.send({ type: 'unqueued' }); break;
    case 'leave': leaveRoom(c); c.ws.send({ type: 'left' }); break;

    case 'pick':
      if (!room || room.status !== 'lobby' || !CHAR_IDS.includes(msg.charId)) break;
      room.picks[room.host === c ? 0 : 1] = msg.charId;
      room.ready[room.host === c ? 0 : 1] = false;
      syncRoom(room);
      break;
    case 'stage':
      if (!room || room.host !== c || room.status !== 'lobby') break;
      if (STAGE_IDS.includes(msg.stage) || msg.stage === 'random') { room.stage = msg.stage; syncRoom(room); }
      break;
    case 'ready': {
      if (!room || room.status !== 'lobby') break;
      const side = room.host === c ? 0 : 1;
      if (!room.picks[side]) break;
      room.ready[side] = !!msg.ready;
      syncRoom(room);
      if (room.guest && room.ready[0] && room.ready[1]) {
        room.status = 'playing';
        const stage = room.stage === 'random' ? STAGE_IDS[crypto.randomInt(STAGE_IDS.length)] : room.stage;
        const start = { type: 'start', chars: [...room.picks], stage, names: [room.host.name, room.guest.name] };
        room.host.ws.send(start); room.guest.ws.send(start);
        syncRoom(room);
      }
      break;
    }

    // in-match relay: guest → host inputs, host → guest snapshots / result
    case 'input': if (room?.status === 'playing' && room.guest === c) room.host.ws.send(raw); break;
    case 'snap': if (room?.status === 'playing' && room.host === c && room.guest) room.guest.ws.send(raw); break;
    case 'match-over':
      if (!room || room.host !== c) break;
      room.guest?.ws.send(raw);
      room.status = 'lobby'; room.ready = [false, false];
      syncRoom(room);
      break;
    case 'quit-match':
      if (!room || room.status !== 'playing') break;
      room.status = 'lobby'; room.ready = [false, false];
      peer?.ws.send({ type: 'peer-quit' });
      syncRoom(room);
      break;
  }
}

/* Heartbeat: ping every client; drop any that stay silent.
 * Needed behind hosting proxies, which may keep the upstream socket open after a tab closes. */
setInterval(() => {
  const now = Date.now();
  for (const c of clients.values()) {
    if (now - c.ws.lastFrame > 10000) c.ws.close(1001);
    else c.ws.frame(0x9, Buffer.alloc(0));
  }
}, 3000);

/* ------------------------------------------------------------------ start */
const server = http.createServer(serveStatic);
server.on('upgrade', upgrade);
server.listen(PORT, HOST, () => {
  console.log(`Yellow Brawl server: http://localhost:${PORT}`);
  if (HOST === '0.0.0.0') {
    for (const list of Object.values(os.networkInterfaces())) {
      for (const a of list || []) if (a.family === 'IPv4' && !a.internal) console.log(`  on your network: http://${a.address}:${PORT}`);
    }
  }
});
