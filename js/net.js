/* WebSocket client for the online lobby and in-match relay. */

class Net {
  constructor() {
    this.ws = null;
    this.state = 'offline';      // offline | connecting | online
    this.handlers = new Map();
    this.latency = 0;
    this.online = 0;
    this.pingTimer = null;
    this.queue = [];
  }

  on(type, fn) {
    if (!this.handlers.has(type)) this.handlers.set(type, new Set());
    this.handlers.get(type).add(fn);
    return () => this.handlers.get(type)?.delete(fn);
  }

  emit(type, msg) {
    for (const fn of this.handlers.get(type) || []) {
      try { fn(msg); } catch (err) { console.error('[net]', type, err); }
    }
  }

  url() {
    const q = new URLSearchParams(location.search).get('server');
    if (q) return q;
    return `${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}/ws`;
  }

  connect() {
    if (this.ws && this.state !== 'offline') return;
    this.state = 'connecting';
    this.emit('status', this.state);
    let ws;
    try { ws = new WebSocket(this.url()); } catch (_) { this.fail(); return; }
    this.ws = ws;
    const timeout = setTimeout(() => { if (this.state === 'connecting') ws.close(); }, 5000);
    ws.onopen = () => {
      clearTimeout(timeout);
      this.state = 'online';
      this.emit('status', this.state);
      for (const m of this.queue.splice(0)) this.send(m);
      this.pingTimer = setInterval(() => this.send({ type: 'ping', t: performance.now() }), 2000);
      this.send({ type: 'ping', t: performance.now() });
    };
    ws.onmessage = (e) => {
      let msg;
      try { msg = JSON.parse(e.data); } catch (_) { return; }
      if (msg.type === 'pong') { this.latency = Math.round(performance.now() - msg.t); this.emit('latency', this.latency); return; }
      if (msg.type === 'online') this.online = msg.count;
      this.emit(msg.type, msg);
    };
    ws.onclose = () => { clearTimeout(timeout); this.fail(); };
    ws.onerror = () => {};
  }

  fail() {
    clearInterval(this.pingTimer);
    const was = this.state;
    this.state = 'offline';
    this.ws = null;
    this.queue = [];
    if (was !== 'offline') this.emit('status', this.state);
  }

  disconnect() {
    if (this.ws) { this.ws.onclose = null; this.ws.close(); }
    this.fail();
  }

  /* Messages sent while still connecting are queued until the socket opens. */
  send(msg) {
    if (this.state === 'connecting') { this.queue.push(msg); return true; }
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return false;
    this.ws.send(typeof msg === 'string' ? msg : JSON.stringify(msg));
    return true;
  }
}

export const net = new Net();
