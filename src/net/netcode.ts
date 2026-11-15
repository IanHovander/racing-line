import { GS } from '../state';
import { setMusic, setSfx, unlockAudio } from '../audio/audio';
import { raceTrackStarted } from '../track/active';
import { cheer } from '../audio/crowd';
import { $, clamp, store, wrapA } from '../core/dom';
import { cars, goAt, opts, setupRace } from '../game/race';
import { lobbyOrder, renderLobby } from './lobby';
import { MP, cleanNick, hostPeer, mpCfg, mpPresence } from './multiplayer';
import { buildProfile } from '../sim/profile';
import { buildTrack } from '../track/build';
import { TRACKS } from '../track/circuits';
import { WX } from '../track/track';
import { showToast, updatePads } from '../ui/controls';
import { updateLights } from '../ui/hud';
// --- peers changed: lobby, race start, car states ---
export function mpPeers(ch) {
  if (!MP.room) return;
  if (!$('lobby').classList.contains('hide')) renderLobby();
  const hp = hostPeer();
  if (!MP.host) {
    if (!hp && MP.phase === 'race' && ch.left.length) {
      showToast('The host left the race');
    }
    if (
      hp &&
      hp.presence.phase === 'countdown' &&
      hp.presence.start &&
      hp.presence.start !== MP.lastStart &&
      Array.isArray(hp.presence.grid)
    ) {
      MP.lastStart = hp.presence.start;
      startMpRace(hp.presence.grid, hp.presence.cfg, hp.peer);
    }
  }
  measureRtt(ch.peers);
  if (MP.phase === 'race')
    for (const p of ch.peers) {
      if (p.sameTab) continue;
      const pr = p.presence || {};
      if (Array.isArray(pr.me)) {
        const c = cars.find(o => o.owner === p.peer && o.human);
        if (c) netSet(c, pr.me);
      }
      if (hp && p.peer === hp.peer && !MP.host) mpSyncClock(pr.clk);
      if (Array.isArray(pr.ai) && hp && p.peer === hp.peer && !MP.host)
        for (const e of pr.ai) {
          const c = cars[e[0] | 0];
          if (c && c.owner === p.peer) netSet(c, e.slice(1));
        }
    }
  if (MP.phase === 'race')
    for (const c of cars) {
      if (c.remote && c.human && !MP.peers.some(p => p.peer === c.owner) && !c.out) {
        c.out = true;
        c.outT = 0;
        c.net = null;
        showToast(c.name + ' disconnected');
      }
    }
}
export function hostStart() {
  if (!MP.host || !MP.room) return;
  unlockAudio();
  const used = {};
  const grid = [];
  for (const p of lobbyOrder()) {
    const t = clamp(+p.presence.team || 0, 0, 4);
    const d = used[t] || 0;
    if (d >= 2) continue;
    used[t] = d + 1;
    grid.push({ p: p.peer, t, d, n: cleanNick(p.presence.nick) || 'Driver' });
  } // up to two players per team
  const ai = [];
  for (let t = 0; t < 5; t++)
    for (let d = 0; d < 2; d++) {
      if ((used[t] || 0) > d) continue;
      ai.push({ p: null, t, d });
    }
  const slots = [];
  const nAI = MP.rules && MP.rules.practice ? 0 : 10 - grid.length;
  for (let i = 0; i < nAI; i++) slots.push(ai[i]);
  // random grid: the AI cars in a random order at the front, the human players in a random order behind them
  const shuffle = <T>(a: T[]): T[] => {
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  };
  const order = shuffle(slots).concat(shuffle(grid));
  const start = Date.now().toString(36);
  MP.lastStart = start;
  MP.room
    .presence({ phase: 'countdown', start, grid: order, cfg: mpCfg(), me: null, ai: null })
    .catch(() => {});
  startMpRace(order, mpCfg(), MP.me);
}
export function startMpRace(grid, cfg, hostId) {
  if (!MP.host && MP.me && !grid.some(e => e.p === MP.me)) {
    showToast('This race is full — wait for the next one');
    return;
  }
  if (cfg) {
    if (TRACKS[cfg.track | 0]) {
      GS.trackIdx = cfg.track | 0;
      if (GS.TR !== TRACKS[GS.trackIdx]) buildTrack(TRACKS[GS.trackIdx]);
    }
    GS.PRACTICE = !!cfg.practice;
    opts.laps = clamp(cfg.laps | 0, 1, 20);
    opts.damage = cfg.damage ? 1 : 0;
    opts.yellow = [0, 3, 10, 30].includes(cfg.yellow) ? cfg.yellow : 10;
    opts.diff = clamp(cfg.diff | 0, 0, 2);
    opts.rain = cfg.rain ? 1 : 0;
    if (cfg.tow !== undefined) opts.tow = clamp(+cfg.tow || 0, 0, 5);
    opts.drsPow = clamp(+cfg.drsPow || 1, 1, 5); // (a host without the setting: normal)
    opts.cgrip = cfg.cgrip === undefined ? 0 : clamp(+cfg.cgrip || 0, 0, 5); // (a host without it races without it)
    if (cfg.limits !== undefined) opts.limits = [0, 2, 3].includes(cfg.limits) ? cfg.limits : 0;
    opts.drs = cfg.drsOn === 0 ? 0 : store.get('drs', 2) || 2;
    WX.rain = opts.rain;
    buildProfile();
  }
  MP.phase = 'race';
  if (!MP.host) mpPresence();
  $('lobby').classList.add('hide');
  $('results').classList.add('hide');
  $('menu').classList.add('hide');
  $('home').classList.add('hide');
  setupRace(
    false,
    // names come from other players' browsers and end up in on-screen messages: letters, digits and . _ - only
    grid.map(e => ({
      p: e.p,
      t: clamp(e.t | 0, 0, 4),
      d: e.d ? 1 : 0,
      n: e.n === undefined ? e.n : cleanNick(e.n) || 'Driver',
      owner: e.p || hostId,
    })),
  );
  raceTrackStarted();
  ['tl', 'board', 'spd', 'btns'].forEach(id => $(id).classList.remove('hide'));
  updatePads();
  updateLights();
  setSfx(opts.sound);
  setMusic(opts.music);
  cheer(0.5);
  showToast(
    (GS.PRACTICE ? 'Online practice · ' : 'Online race · ') + cars.filter(c => c.human).length + ' players',
  );
}
export const R1 = v => Math.round(v * 10) / 10,
  R3 = v => Math.round(v * 1000) / 1000;
export function netState(c) {
  return [
    R1(c.x),
    R1(c.y),
    R3(c.h),
    R1(c.v),
    c.cross,
    (c.out ? 1 : 0) | (c.finished ? 2 : 0),
    Math.round(c.ftime * 100) / 100,
    Math.round(c.dmg * 100) / 100,
    Math.round(c.tow * 100) / 100,
    Math.round(c.best * 100) / 100,
    c.pen | 0,
    Date.now() % 1e9,
  ];
}
// ---- latency: every presence carries the sender's clock (ts) and, for each peer heard from, an echo of that
// peer's last ts and how long we held it. A peer that sees its own ts come back knows the round trip in its own
// clock: RTT = now - echoed ts - hold time. Half the round trip is the one-way delay used to extrapolate cars.
const nowMs = () => Date.now() % 1e9;
function measureRtt(peers) {
  MP.rx = MP.rx || {};
  MP.rtt = MP.rtt || {};
  const now = nowMs();
  for (const p of peers) {
    if (p.sameTab || p.peer === MP.me) continue;
    const pr = p.presence || {};
    if (typeof pr.ts === 'number' && (!MP.rx[p.peer] || MP.rx[p.peer].ts !== pr.ts))
      MP.rx[p.peer] = { ts: pr.ts, at: now };
    const e = pr.echo && pr.echo[MP.me];
    if (Array.isArray(e) && e.length === 2 && isFinite(e[0]) && isFinite(e[1])) {
      if (MP.rtt['_e' + p.peer] === e[0]) continue; // this echo was already counted
      MP.rtt['_e' + p.peer] = e[0];
      const r = now - e[0] - e[1];
      if (r < 0 || r > 3000) continue;
      const o = MP.rtt[p.peer];
      MP.rtt[p.peer] = o === undefined || r < o ? r : o + (r - o) * 0.03;
    }
  }
}
/** one-way delay to a peer, seconds (100 ms until it has been measured) */
export function oneWay(peer): number {
  const r = MP.rtt && MP.rtt[peer];
  return r === undefined ? 0.1 : r / 2000;
}
// last field: sender clock (ms) so receivers can time-stamp each state
export function netSet(c, a) {
  if (a.length < 11 || !a.every(v => typeof v === 'number' && isFinite(v))) return;
  // clock offset between sender and us: track the smallest (now - sent) seen, drifting slowly so a clock jump recovers
  let ts = a.length > 11 ? a[11] : null;
  if (ts !== null) {
    const o = nowMs() - ts;
    c.netOff = c.netOff === undefined || o < c.netOff ? o : c.netOff + (o - c.netOff) * 0.02;
  }
  const prev = c.net;
  let w = 0;
  if (prev && ts !== null && prev.ts !== null && ts > prev.ts) {
    w = clamp(wrapA(a[2] - prev.h) / ((ts - prev.ts) / 1000), -3, 3);
  }
  if (prev && ts !== null && prev.ts !== null && ts <= prev.ts) return; // older than what we have: ignore
  c.net = {
    ts,
    w,
    x: a[0],
    y: a[1],
    h: a[2],
    v: Math.max(0, a[3]),
    cross: a[4] | 0,
    out: !!(a[5] & 1),
    fin: !!(a[5] & 2),
    ft: a[6],
    dmg: clamp(a[7], 0, 1),
    tow: clamp(a[8], 0, 1),
    best: a[9],
    pen: a[10] | 0,
    t: performance.now(),
  };
}
/** where a car is now according to state n: extrapolated along an arc (speed and turn rate) by the state's age */
function predict(c, n): [number, number, number] {
  // how old this state really is. netOff is the smallest (now - sent) seen = clock difference + the fastest
  // delivery, so (now - sent - netOff) is the extra delay of this packet; add the measured one-way delay.
  const age = Math.min(
    1.0,
    n.ts !== null && c.netOff !== undefined
      ? Math.max(0, ((Date.now() % 1e9) - n.ts - c.netOff) / 1000 + oneWay(c.owner))
      : (performance.now() - n.t) / 1000,
  );
  let px = n.x,
    py = n.y,
    ph = n.h;
  const steps = Math.max(1, Math.ceil(age / 0.05)),
    sdt = age / steps;
  for (let i = 0; i < steps; i++) {
    ph += n.w * sdt;
    px += Math.cos(ph) * n.v * sdt;
    py += Math.sin(ph) * n.v * sdt;
  }
  return [px, py, ph];
}
// remote cars: drawn at the prediction from their owner's latest state, plus a correction that fades out
export function netFollow(c, dt) {
  const n = c.net;
  if (!n) return;
  const [px, py, ph] = predict(c, n);
  // When a new state arrives, the correction is the gap between the previous state's prediction and the new one,
  // both for this moment, so the car doesn't jump; between states the prediction itself moves the car at full speed.
  if (c.netSeen !== n.t) {
    const old = c.netPrev;
    c.netSeen = n.t;
    c.netPrev = n;
    if (old) {
      const q = predict(c, old);
      c.ex = (c.ex || 0) + q[0] - px;
      c.ey = (c.ey || 0) + q[1] - py;
      c.eh = wrapA((c.eh || 0) + wrapA(q[2] - ph));
    } else c.ex = c.ey = c.eh = 0;
    if (c.ex * c.ex + c.ey * c.ey > 3600) c.ex = c.ey = c.eh = 0; // too far off: snap
  }
  const f = Math.exp(-dt * 6);
  c.ex = (c.ex || 0) * f;
  c.ey = (c.ey || 0) * f;
  c.eh = (c.eh || 0) * f;
  c.x = px + c.ex;
  c.y = py + c.ey;
  c.h = wrapA(ph + c.eh);
  c.v = n.v;
  c.tow = n.tow;
  c.dmg = n.dmg;
  c.best = n.best;
  c.pen = n.pen;
  if (n.cross !== c.cross) {
    c.cross = n.cross;
  }
  if (n.out && !c.out) {
    c.out = true;
    c.outT = 0;
    showToast(c.name + ' is out');
  }
  if (n.fin && !c.finished) {
    c.finished = true;
    c.ftime = n.ft;
    c.place = ++GS.finishOrder;
  }
}
// ---- shared race clock: guests follow the host's clock, so every finish time is measured on the same clock and all results screens agree
export function mpClock() {
  return GS.state === 'countdown' ? GS.cdT - goAt : GS.raceTime;
}
export function mpSyncClock(clk) {
  if (!Array.isArray(clk) || clk.length < 2 || MP.host) return;
  const [hv, hts] = clk;
  if (!isFinite(hv) || !isFinite(hts)) return;
  const o = (Date.now() % 1e9) - hts;
  MP.hostOff = MP.hostOff === undefined || o < MP.hostOff ? o : MP.hostOff + (o - MP.hostOff) * 0.02;
  const hp = hostPeer();
  const target = hv + Math.max(0, ((Date.now() % 1e9) - hts - MP.hostOff) / 1000 + oneWay(hp && hp.peer)),
    diff = target - mpClock();
  if (Math.abs(diff) < 0.004) return;
  const nv = mpClock() + (Math.abs(diff) > 0.4 ? diff : diff * 0.15);
  if (GS.state === 'countdown') {
    if (nv >= 0) {
      GS.cdT = goAt;
      GS.raceTime = nv;
    } else GS.cdT = nv + goAt;
  } else if (GS.state === 'race' && nv < 0) {
    GS.state = 'countdown';
    GS.cdT = nv + goAt;
    GS.raceTime = 0;
    updateLights();
  } else if (GS.state === 'race' || GS.state === 'finished') GS.raceTime = nv;
}
export function mpSend(dt) {
  if (!MP.room || MP.phase !== 'race') return;
  MP.sendT -= dt;
  if (MP.sendT > 0) return;
  MP.sendT = 1 / 20;
  const me = cars[GS.ctrl];
  const now = nowMs();
  const echo = {};
  for (const id in MP.rx || {}) if (now - MP.rx[id].at < 3000) echo[id] = [MP.rx[id].ts, now - MP.rx[id].at];
  const p: any = { me: me ? netState(me) : null, ts: now, echo };
  if (MP.host) {
    p.ai = cars.map((c, i) => (!c.human && !c.remote ? [i].concat(netState(c)) : null)).filter(Boolean);
    p.clk = [Math.round(mpClock() * 1000) / 1000, Date.now() % 1e9];
  }
  MP.room.presence(p).catch(() => {});
}
