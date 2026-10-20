# Yellow Brawl · 黄色大乱斗

A 2D browser fighting game with local and online multiplayer: plain JavaScript modules + one `<canvas>`,
no build step, no dependencies. A zero-dependency Node server handles the online lobby.

**Play it:** https://yellow-brawl.onrender.com (free hosting: the first load after a quiet period can take ~30–50 s while the server wakes up)

## Run

```bash
cd ~/Desktop/brawl-game
npm start
```

Open http://localhost:8787. This one Node process (no dependencies, Node 18+) serves the game and the online lobby.
Offline-only alternative: `python3 -m http.server 5173` (everything except Online works).

### Playing online

- **Same Wi-Fi:** `npm start` prints a `http://192.168.x.x:8787` address; your friend opens that. (macOS may ask to allow incoming connections for `node`.)
- **Over the internet:** deploy to any host that runs Node and supports WebSockets. `render.yaml` sets it up on Render
  (New → Blueprint → pick this repo); Fly.io, Railway or a VPS work the same way with `npm start`.
- In the game: **Online → Create Room**, then send the room code or the **Copy invite link** URL. Or both players press **Quick Match**.
- Options: `node server/server.js --port 9000 --host 127.0.0.1` (or `PORT` / `HOST` env vars).

## Modes

- **Arcade / 街机模式**: three CPU fights (the other two fighters, then a mirror match), easy → normal → hard, a different stage each fight.
- **Versus / 本地双人**: two players on one keyboard (or two gamepads), or 1P vs CPU (Settings → Versus · P2).
- **Online / 在线对战**: room codes, invite links, quick match, open-room list, rematch.
- **Training / 招式训练**: infinite health and meter, dummy behaviour (stand / crouch / block / jump / CPU), hitbox view, combo damage readout.

Fighters: 奶蛙 Naiwa (tanky, belly charges), 肥嘟嘟 Feidudu (fast, milk projectiles, e-scooter), 小鸡子 Chick (sound wave, rooster projectile, basketball super).

Stages: 黄色大排档 Midnight Market, 天台外卖站 Rooftop Rush, 金色神殿 Golden Temple, all drawn in code, each with its own generated music theme. No audio files either: sound effects and music are synthesized with Web Audio.

Settings (⚙ or the main menu): music / SFX volume, round time (30 / 60 / 99 / unlimited), rounds to win (1–3), Versus P2 human or CPU difficulty.

UI language switches between 中文 and English from the top-right button.

## Controls

| | P1 | P2 |
|---|---|---|
| Move (hold back = block) | A / D | ← / → |
| Dash / backdash (double-tap) | A A / D D | ← ← / → → |
| Jump | W / Space | ↑ |
| Crouch (crouch-block lows) | S | ↓ |
| Light (tap for a string) | J | 1 |
| Heavy (tap twice) | K | 2 |
| Kick / long-range | L | 3 |
| Special (down + special = 2nd special) | U | 4 |
| Super (full meter) | I | 5 |
| Guard | Left Shift | Right Shift / 0 |
| Pause | Esc | |

Training hotkeys: **Y** dummy mode, **M** infinite meter, **T** hitboxes, **R** reset.

## Code map

| File | What it does |
|---|---|
| `js/data.js` | Characters, sprite-sheet clips, and every move's frame data |
| `js/fighter.js` | Fighter state machine: movement, attacks, chaining, blocking, knockdowns |
| `js/match.js` | Fixed 60 Hz loop, hit detection, projectiles, rounds/timer, HUD rendering |
| `js/ai.js` | CPU opponent (outputs the same button states as a human) |
| `js/input.js` | Keyboard + gamepad → per-player button states |
| `js/stage.js` | Three procedurally drawn stages + stage-select thumbnails |
| `js/fx.js` / `js/audio.js` | Hit sparks, dust; synthesized sound effects (Web Audio) |
| `js/music.js` | Step-sequencer background music, one theme per stage + menu |
| `js/settings.js` | Persisted settings (volume, round time, rounds, versus CPU) |
| `js/online.js` / `js/net.js` | Online lobby/room screens; WebSocket client |
| `server/server.js` | Static file server + WebSocket lobby and in-match relay (zero dependencies) |
| `js/main.js` | Screens: title, menu, settings, select, stage select, VS splash, pause, results, controls |
| `js/i18n.js` | Chinese / English strings |

### How a move is defined

```js
heavy: { clip: 'heavy', dur: 32, startup: 10, active: 4, dmg: 85,
         hb: { x: 20, w: 165, y: 140, h: 110 },   // hitbox, relative to the feet
         hitstun: 24, blockstun: 13, push: 6, lunge: 3.5, meter: 10, hitstop: 10 }
```

All timings are in 60 Hz frames. Tuning the game means editing these numbers.

### Swapping character art

Each clip in `data.js` points at a sprite sheet (6 columns, frames left→right, top→bottom) plus
`fw`/`fh` (frame size), `foot` (empty pixels below the feet) and `rh` (on-screen frame height).
Replace the sheet and those numbers and the engine picks it up. No code changes.

Sprite sheets are not included in this repository. Without them the game draws built-in vector
fighters (`js/placeholder.js`) that use the same clips, timings and hitboxes, so everything is playable
straight from a clone. Add sheets under `assets/<character>/` (paths in `data.js`) to use real art;
`?noart` in the URL forces the vector fighters for comparison.

## Netcode

Host-authoritative, like many browser fighters:

1. The room host's browser runs the real simulation at 60 Hz.
2. The guest sends only its button state (a bitmask, on change).
3. Every frame the host sends a ~1 KB state snapshot (fighters, projectiles, round/timer, HUD state)
   plus the sounds and hit effects that happened, and the guest draws exactly that.

Simple and cheat-resistant, but the guest feels one round-trip of input delay
(fine on the same Wi-Fi or within a region). Rollback netcode would fix that and is a possible next step.

## Debugging

Open `http://localhost:5173/?debug` to get `window.__brawl` in the console:
`__brawl.match` is the running match (call `.step()` / `.render()` to advance frame-by-frame,
set `.showBoxes = true` for hitboxes).
