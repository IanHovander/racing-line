import type { MPState } from '../types';
import { GS } from '../state';
import { $, store } from '../core/dom';
import { opts } from '../game/race';
import { LBS, drawQR, lbGo, lbRulesInit, renderLobby } from './lobby';
import { mpPeers } from './netcode';
import { showToast } from '../ui/controls';
import { toMenu } from '../ui/menu';
// ================= Online multiplayer (claude "room" capability) =================
// Each player simulates their own car; the host also simulates the AI field. Everyone shares
// car state through room presence (~15 Hz) and draws the others with smoothing.
export let ARTIFACT_URL = 'https://claude.ai/artifact/4uMtojwaKLSZyAuExYwu75';
export const MP: MPState = {
  api: null,
  room: null,
  code: null,
  host: false,
  me: null,
  peers: [],
  phase: 'off',
  lastStart: null,
  sendT: 0,
  unsub: null,
};
export const mpOn = () => !!MP.room;
// ---- WebRTC multiplayer (outside claude.ai) ----
// Same interface as claude.ai's room service (join -> room.onPeers / presence / leave), built on PeerJS.
// The host opens the room: its browser registers the room code with PeerJS's matchmaking server and becomes the
// hub. Guests connect to the hub, and only ever as guests: a guest that arrives while the host is unreachable
// tries again, it does not open a room of its own.
// Each player's presence object is merged into the hub's list, and the hub sends the whole list to everyone ~15 times a second.
// Relay (TURN): when two players can't reach each other directly (mobile data, guest Wi-Fi, a router that keeps
// its devices apart) the connection has to go through a relay. PeerJS's own free relay is used (see iceServers);
// fill in a relay login of your own here (e.g. a free Metered account) to add a second one.
export const TURN = { urls: [], username: '', credential: '' };
export const P2P = {
  prefix: 'racingline-mt-',
  ice: [{ urls: ['stun:stun.l.google.com:19302', 'stun:stun.cloudflare.com:3478'] }].concat(
    TURN.urls.length ? [TURN] : [],
  ),
  /** attempts at reaching the matchmaking server, and at connecting to the host, before giving up */
  tries: 3,
  /** ms to wait for the matchmaking server, per attempt */
  openMs: 10000,
  /** ms to wait for the connection to the host to open, per attempt */
  connMs: 8000,
  /** ms for the host to answer a connection request at all. The matchmaking server says "no such room" only
   *  once every ~3 s per room and stays silent in between (measured against the PeerJS cloud server), and a
   *  host whose screen has just locked still looks registered for a while: both show up as no answer. */
  answerMs: 3500,
  /** ms before looking again for a room the server doesn't know: long enough for it to answer again */
  findMs: 3500,
  /** ms the page must have been hidden before the host registers afresh on coming back */
  staleMs: 4000,
};
/** The STUN and relay servers for a connection: ours plus the ones PeerJS ships with, which include its free TURN
 *  relay. (Giving PeerJS a `config` replaces its defaults, so without this there is no relay at all and players
 *  who can't reach each other directly never connect.) */
export function iceServers(): any[] {
  const lib = window.peerjs && window.peerjs.util && window.peerjs.util.defaultConfig;
  const seen = new Set<string>();
  const out = [];
  for (const s of [...P2P.ice, ...((lib && lib.iceServers) || [])]) {
    const urls = [].concat(s.urls).filter(u => !seen.has(u));
    if (!urls.length) continue;
    urls.forEach(u => seen.add(u));
    out.push(Object.assign({}, s, { urls }));
  }
  return out;
}
export function loadPeerJS() {
  return new Promise<void>((res, rej) => {
    if (window.Peer) return res();
    const s = document.createElement('script');
    s.src = 'vendor/peerjs.min.js';
    s.onload = () => (window.Peer ? res() : rej());
    s.onerror = () => {
      const t = document.createElement('script');
      t.src = 'https://cdn.jsdelivr.net/npm/peerjs@1.5.5/dist/peerjs.min.js';
      t.onload = () => (window.Peer ? res() : rej());
      t.onerror = rej;
      document.head.appendChild(t);
    };
    document.head.appendChild(s);
  });
}
export interface JoinOpts {
  /** open the room (be its hub) instead of connecting to it */
  host?: boolean;
  /** the host's key for its room code: with the same key a reloaded host page gets its code back straight away */
  token?: string;
  /** progress, for the joining dialog: 'server', 'host' or 'find' (looking again for the room), and which
   *  attempt this is */
  onStep?: (step: string, attempt: number) => void;
  /** true once the player has given up waiting */
  cancelled?: () => boolean;
}
const sleep = (ms: number) => new Promise<void>(r => setTimeout(r, ms));
/** failures of the matchmaking server that are worth another attempt */
const SERVER_RETRY = ['network', 'server-error', 'socket-error', 'socket-closed', 'timeout'];
/** failures that another attempt can't fix */
const NO_RETRY = ['cancelled', 'browser-incompatible', 'invalid-id', 'invalid-key', 'ssl-unavailable'];
const tag = (e: any, stage: string) => {
  e = e || { type: 'unknown' };
  try {
    e.stage = stage;
  } catch (_) {}
  return e;
};
export function makeP2PApi(PeerCls?) {
  PeerCls = PeerCls || window.Peer;
  const peerOpts = (token?: string) =>
    Object.assign({ debug: 0, config: { iceServers: iceServers() } }, token ? { token } : {});
  /** register with the matchmaking server once (no id: the server picks one) */
  const openOnce = (id: string | null, token?: string) =>
    new Promise<any>((res, rej) => {
      let done = false,
        timer = null;
      const p = id ? new PeerCls(id, peerOpts(token)) : new PeerCls(peerOpts(token));
      const end = (err?) => {
        if (done) return;
        done = true;
        clearTimeout(timer);
        if (!err) return res(p);
        try {
          p.destroy();
        } catch (_) {}
        rej(err);
      };
      p.on('open', () => end());
      p.on('error', e => end(e || { type: 'server-error' }));
      timer = setTimeout(() => end({ type: 'timeout' }), P2P.openMs);
    });
  /** ...and again if the server didn't answer: its free tier drops the odd request */
  const openPeer = async (id: string | null, o: JoinOpts, token?: string) => {
    let err = null;
    for (let i = 0; i < P2P.tries; i++) {
      if (i) await sleep(500 * i);
      if (o.cancelled && o.cancelled()) throw { type: 'cancelled' };
      try {
        return await openOnce(id, token);
      } catch (e) {
        err = e || {};
        if (!SERVER_RETRY.includes(err.type)) break;
      }
    }
    throw tag(err, 'server');
  };
  /** one attempt at a data connection to the hub */
  const connectOnce = (peer, hubId: string, hook: { f: ((e: any) => void) | null }) =>
    new Promise<any>((res, rej) => {
      let done = false,
        timer = null,
        answerTimer = null;
      const conn = peer.connect(hubId, { reliable: true, serialization: 'json' });
      const end = (err?) => {
        if (done) return;
        done = true;
        clearTimeout(timer);
        clearTimeout(answerTimer);
        hook.f = null;
        if (!err) return res(conn);
        try {
          if (conn) conn.close();
        } catch (_) {}
        rej(tag(err, 'host'));
      };
      if (!conn) return end({ type: 'disconnected' }); // PeerJS refuses to connect while it has no server connection
      // "no such room" and server trouble are reported on the peer, not on the connection
      hook.f = e => end(e || { type: 'network' });
      conn.on('open', () => end());
      conn.on('error', e => end(e || { type: 'negotiation-failed' }));
      conn.on('close', () => end({ type: 'connection-closed' }));
      timer = setTimeout(() => end({ type: 'timeout' }), P2P.connMs);
      // has the host replied to the request yet? (if not, it never arrived: ask again rather than wait it out)
      answerTimer = setTimeout(() => {
        const pc = conn.peerConnection;
        if (pc && !pc.remoteDescription) end({ type: 'no-answer' });
      }, P2P.answerMs);
    });
  /** Stay registered with the matchmaking server: reconnect when the socket drops (after a growing pause, so a
   *  dead network isn't hammered) and at once when the page comes back to the front. A phone cuts the socket
   *  while its screen is locked or another app is in front, often without telling the page, and a host that
   *  isn't registered can't be found by guests: so a host (`refresh`) registers afresh whenever its page has
   *  been hidden for more than a few seconds. Connections that are already open are not affected. */
  const keepRegistered = (peer, isClosed: () => boolean, refresh: boolean) => {
    let timer = null,
      n = 0,
      hiddenAt = 0;
    const retry = () => {
      if (timer || isClosed() || peer.destroyed || !peer.disconnected) return;
      timer = setTimeout(
        () => {
          timer = null;
          if (isClosed() || peer.destroyed || !peer.disconnected) return;
          try {
            peer.reconnect();
          } catch (_) {}
        },
        Math.min(8000, 250 * 2 ** n++),
      );
    };
    const wake = () => {
      if (document.visibilityState !== 'visible') {
        hiddenAt = hiddenAt || Date.now();
        return;
      }
      const away = hiddenAt ? Date.now() - hiddenAt : 0;
      hiddenAt = 0;
      clearTimeout(timer);
      timer = null;
      n = 0;
      if (refresh && away > P2P.staleMs && !isClosed() && !peer.destroyed && !peer.disconnected)
        try {
          peer.disconnect(); // -> 'disconnected' -> retry()
        } catch (_) {}
      retry();
    };
    peer.on('disconnected', retry);
    peer.on('open', () => (n = 0));
    document.addEventListener('visibilitychange', wake);
    addEventListener('online', wake);
    return () => {
      clearTimeout(timer);
      document.removeEventListener('visibilitychange', wake);
      removeEventListener('online', wake);
    };
  };
  return {
    async join(code, o: JoinOpts = {}) {
      const hubId = P2P.prefix + code;
      const step = (s: string, n: number) => {
        try {
          if (o.onStep) o.onStep(s, n);
        } catch (_) {}
      };
      const cancelled = () => !!(o.cancelled && o.cancelled());
      const subs = new Set<(ch: any) => void>();
      const lostCbs = new Set<() => void>();
      const mine = {};
      let list = [];
      let prevIds = new Set();
      let closed = false;
      let peer = null;
      let myId = null; // PeerJS forgets its id while it's off the server, so keep our own copy
      const emit = () => {
        const ids = new Set(list.map(p => p.peer));
        const left = [...prevIds].filter(i => !ids.has(i));
        prevIds = ids;
        const peers = list.map(p => ({
          peer: p.peer,
          presence: p.presence || {},
          kind: 'viewer',
          sameTab: p.peer === myId,
        }));
        for (const f of subs)
          try {
            f({ peers, left });
          } catch (_) {}
      };
      let dead = false; // the connection to the hub was lost (as opposed to left)
      const lost = () => {
        if (closed) return;
        closed = true;
        dead = true;
        for (const f of lostCbs)
          try {
            f();
          } catch (_) {}
      };
      if (o.host) {
        // ---- hub: keeps everyone's presence and broadcasts it
        step('server', 1);
        try {
          peer = await openPeer(hubId, o, o.token);
        } catch (e) {
          throw e && e.type === 'unavailable-id' ? tag({ type: 'code-taken' }, 'server') : e;
        }
        if (cancelled()) {
          try {
            peer.destroy();
          } catch (_) {}
          throw { type: 'cancelled' };
        }
        myId = peer.id;
        const conns = new Map();
        const pres = new Map([[myId, mine]]);
        const seen = new Map();
        let dirty = true,
          lastB = 0;
        const snapshot = () => [...pres.entries()].map(([id, p]) => ({ peer: id, presence: p }));
        peer.on('connection', c => {
          c.on('open', () => {
            conns.set(c.peer, c);
            seen.set(c.peer, Date.now());
            if (!pres.has(c.peer)) pres.set(c.peer, {});
            dirty = true;
          });
          c.on('data', m => {
            seen.set(c.peer, Date.now());
            if (m && m.t === 'p' && m.p && typeof m.p === 'object') {
              pres.set(c.peer, Object.assign(pres.get(c.peer) || {}, m.p));
              dirty = true;
            }
          });
          const gone = () => {
            if (conns.get(c.peer) === c) {
              conns.delete(c.peer);
              pres.delete(c.peer);
              seen.delete(c.peer);
              dirty = true;
            }
          };
          c.on('close', gone);
          c.on('error', gone);
        });
        const stopKeep = keepRegistered(peer, () => closed, true);
        let lastTick = Date.now();
        const tick = setInterval(() => {
          if (closed) {
            clearInterval(tick);
            return;
          }
          const now = Date.now();
          // this page was frozen (screen locked, another app in front): the guests weren't silent, we were deaf
          if (now - lastTick > 3000) for (const id of seen.keys()) seen.set(id, now);
          lastTick = now;
          for (const [id, t] of seen)
            if (now - t > 8000) {
              seen.delete(id);
              const c = conns.get(id);
              conns.delete(id);
              pres.delete(id);
              try {
                c && c.close();
              } catch (_) {}
              dirty = true;
            } // silent guests are dropped
          if (!dirty && now - lastB < 2000) return;
          dirty = false;
          lastB = now;
          const s = snapshot();
          list = s;
          emit();
          const msg = { t: 's', peers: s };
          for (const c of conns.values()) {
            try {
              if (c.open) c.send(msg);
            } catch (_) {}
          }
        }, 40);
        return {
          onPeers(f, onLost) {
            subs.add(f);
            if (onLost) lostCbs.add(onLost);
            setTimeout(emit, 0);
            return () => {
              subs.delete(f);
              if (onLost) lostCbs.delete(onLost);
            };
          },
          async presence(p) {
            Object.assign(mine, p);
            dirty = true;
          },
          async leave() {
            closed = true;
            clearInterval(tick);
            stopKeep();
            for (const c of conns.values())
              try {
                c.close();
              } catch (_) {}
            try {
              peer.destroy();
            } catch (_) {}
          },
        };
      }
      // ---- guest: one connection to the hub, tried a few times
      // (the route between two phones often doesn't open at the first attempt, and the host may be off the
      // matchmaking server for a moment: its screen dimmed, or it switched apps to send the invite)
      const hook = { f: null as ((e: any) => void) | null };
      let conn = null,
        err = null,
        looks = 0; // times the server has said there is no such room
      for (let i = 0; i < P2P.tries && !conn; i++) {
        const noRoom = !!err && err.type === 'peer-unavailable';
        if (i) await sleep(noRoom ? P2P.findMs : 400);
        if (cancelled()) {
          err = { type: 'cancelled' };
          break;
        }
        try {
          if (!peer || peer.destroyed || peer.disconnected) {
            try {
              if (peer) peer.destroy();
            } catch (_) {}
            peer = null;
            step('server', i + 1);
            peer = await openPeer(null, o);
            peer.on('error', e => {
              if (hook.f) hook.f(e);
            });
          }
          step(noRoom ? 'find' : 'host', i + 1);
          conn = await connectOnce(peer, hubId, hook);
        } catch (e) {
          err = e || {};
          if (err.stage === 'server' || NO_RETRY.includes(err.type)) break; // the server was retried already
          if (err.type === 'peer-unavailable' && ++looks >= 2) break; // asked twice, seconds apart: no such room
        }
      }
      if (!conn || cancelled()) {
        try {
          if (conn) conn.close();
        } catch (_) {}
        try {
          if (peer) peer.destroy();
        } catch (_) {}
        throw cancelled() ? { type: 'cancelled' } : err || { type: 'unknown' };
      }
      myId = peer.id;
      let lastS = Date.now();
      let gotFirst = () => {};
      // open the lobby with the players already in it: wait (briefly) for the hub's first list
      const first = new Promise<void>(r => {
        gotFirst = r;
        setTimeout(r, 1500);
      });
      conn.on('data', m => {
        lastS = Date.now();
        if (m && m.t === 's' && Array.isArray(m.peers)) {
          list = m.peers;
          emit();
          gotFirst();
        }
      });
      let lastHb = Date.now();
      const hb = setInterval(() => {
        if (closed) {
          clearInterval(hb);
          return;
        }
        const now = Date.now();
        if (now - lastHb > 5000) lastS = now; // this page was frozen: give the hub a fresh chance to be heard
        lastHb = now;
        try {
          if (conn.open) conn.send({ t: 'h' });
        } catch (_) {}
        if (now - lastS > 10000) {
          clearInterval(hb);
          lost();
        }
      }, 2000); // heartbeat both ways
      conn.on('close', lost);
      conn.on('error', lost);
      const stopKeep = keepRegistered(peer, () => closed, false);
      try {
        if (conn.open) conn.send({ t: 'h' });
      } catch (_) {}
      await first;
      return {
        onPeers(f, onLost) {
          subs.add(f);
          if (onLost) lostCbs.add(onLost);
          setTimeout(dead ? () => onLost && onLost() : emit, 0);
          return () => {
            subs.delete(f);
            if (onLost) lostCbs.delete(onLost);
          };
        },
        async presence(p) {
          Object.assign(mine, p);
          try {
            if (conn.open) conn.send({ t: 'p', p });
          } catch (_) {}
        },
        async leave() {
          closed = true;
          clearInterval(hb);
          stopKeep();
          try {
            conn.close();
          } catch (_) {}
          try {
            peer.destroy();
          } catch (_) {}
        },
      };
    },
  };
}
export function mpAvail() {
  const ok = !!MP.api;
  $('bHost').disabled = !ok;
  $('bJoin').disabled = !ok;
  $('bJoin2').disabled = !ok;
  $('mpNote').textContent = ok
    ? 'Friends join with your 5-character room code, the invite link or the QR code.'
    : "Online play isn't available right now — check your connection and try again.";
}
// room codes: 5 letters/digits, no ambiguous characters; old gp-xxxxx links still work
export const normCode = v => {
  v = String(v || '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
  if (/^gp[a-z0-9]{5}$/.test(v)) v = v.slice(2);
  return /^[a-z0-9]{4,8}$/.test(v) ? v : null;
};
export const mpCode = () =>
  Array.from({ length: 5 }, () => 'abcdefghjkmnpqrstuvwxyz23456789'[Math.floor(Math.random() * 31)]).join('');
// ---- your name: saved on this device, and read again every time the lobby opens. (It used to be read once, when
// the page loaded, so a tab or home-screen app that had been open since before you last typed your name went on
// showing the old one.)
export const cleanNick = (v: unknown) =>
  String(v ?? '')
    .replace(/[^\p{L}\p{N} ._-]/gu, '')
    .replace(/\s+/g, ' ')
    .slice(0, 16);
/** the saved name, or (until one is typed) a Driver-123 made up once per visit */
export function loadNick(): string {
  const saved = cleanNick(store.get('nick', '')).trim();
  if (saved) GS.NICK = saved;
  else if (!GS.NICK) GS.NICK = 'Driver-' + Math.floor(100 + Math.random() * 900);
  return GS.NICK;
}
/** keep what's typed in the name box; false if it's empty or unchanged */
export function saveNick(v: unknown): boolean {
  const n = cleanNick(v).trim();
  if (!n || (n === GS.NICK && store.get('nick', '') === n)) return false;
  GS.NICK = n;
  store.set('nick', n);
  return true;
}
/** the name was changed somewhere else (another tab of the game): follow it */
function syncNick() {
  const was = GS.NICK;
  if (loadNick() === was) return;
  const box = $('nick');
  if (box && document.activeElement !== box) box.value = GS.NICK;
  mpPresence();
}
// ---- the host's room survives a reload: phones reload a page that was in the background (say, while the host
// switched apps to send the invite). The tab remembers that it was hosting, and with which key, so it comes back
// as the host of the same code instead of as a guest of a room that no longer has a host.
const HOSTING = 'hcgp_hosting';
function hostingGet(): { code: string; token: string; t: number } | null {
  try {
    const v = JSON.parse(sessionStorage.getItem(HOSTING) || 'null');
    return v && v.code && v.token && Date.now() - v.t < 6 * 3600e3 ? v : null;
  } catch (e) {
    return null;
  }
}
function hostingSet(v: { code: string; token: string; t: number } | null) {
  try {
    if (v) sessionStorage.setItem(HOSTING, JSON.stringify(v));
    else sessionStorage.removeItem(HOSTING);
  } catch (e) {}
}
const newToken = () => Math.random().toString(36).slice(2) + Date.now().toString(36);
// ---- the screen stays on while you're in a room: a phone that dims and locks drops off the matchmaking server
// (guests can't find the host any more) and out of the room. The lock is given up by the browser whenever the
// page is hidden, so it is taken again when the page comes back.
let screenLock: any = null;
async function holdScreen(on: boolean) {
  try {
    if (!on) {
      const l = screenLock;
      screenLock = null;
      if (l) await l.release();
      return;
    }
    const wl = (navigator as any).wakeLock;
    if (screenLock || !wl || document.visibilityState !== 'visible') return;
    const l = await wl.request('screen');
    if (!MP.room) return void l.release().catch(() => {});
    screenLock = l;
    l.addEventListener('release', () => {
      if (screenLock === l) screenLock = null;
    });
  } catch (e) {}
}
const clearHash = () => {
  try {
    history.replaceState(null, '', location.pathname + location.search);
  } catch (e) {
    try {
      location.hash = '';
    } catch (_) {}
  }
};
// ---- joining dialog: says what is happening while the connection opens (it can take a few attempts), and if it
// doesn't open, why, with Try Again
const CONN: { code: string; host: boolean; back: boolean; timer: any } = {
  code: '',
  host: false,
  back: false,
  timer: null,
};
/** `back`: getting back into a room we were dropped from */
function connShow(code: string, asHost: boolean, back = false) {
  CONN.code = code;
  CONN.host = asHost;
  CONN.back = back;
  $('mcTitle').textContent = asHost
    ? 'Opening a Room'
    : (back ? 'Reconnecting to Room ' : 'Joining Room ') + code.toUpperCase();
  $('mcMsg').textContent = 'Contacting the matchmaking server…';
  $('bMcRetry').classList.add('hide');
  $('bMcCancel').textContent = 'Cancel';
  clearTimeout(CONN.timer);
  // hosting usually takes well under a second: only put the dialog up if it drags on
  if (asHost) CONN.timer = setTimeout(() => $('mpConn').classList.remove('hide'), 600);
  else $('mpConn').classList.remove('hide');
}
function connStep(step: string, attempt: number) {
  const again = attempt > 1 ? ` (try ${attempt} of ${P2P.tries})` : '';
  $('mcMsg').textContent =
    step === 'find'
      ? 'Looking for the room…' + again
      : step === 'host'
        ? attempt > 1
          ? 'Still connecting to the host…' + again
          : 'Connecting to the host…'
        : 'Contacting the matchmaking server…' + again;
}
function connHide() {
  clearTimeout(CONN.timer);
  $('mpConn').classList.add('hide');
}
/** what went wrong, in words a player can act on */
export function joinError(e: any, code: string, asHost: boolean): string {
  const t = e && e.type,
    C = code.toUpperCase();
  if (t === 'no-api')
    return "Online play isn't available right now. Check your internet connection and try again.";
  if (t === 'browser-incompatible' || t === 'webrtc') return "This browser can't play online.";
  if (t === 'peer-unavailable')
    return `No race found with code ${C}. Check the code, and that the host's lobby is still open on their screen.`;
  if (t === 'code-taken') return "Couldn't open a room just now. Try again.";
  if ((e && e.stage === 'server') || ['network', 'server-error', 'socket-error', 'socket-closed'].includes(t))
    return "Can't reach the matchmaking server. Check your internet connection and try again.";
  if (t === 'no-answer')
    return `Room ${C} is open, but the host's device isn't answering. Check that its screen is on and showing the lobby, then try again.`;
  if (!asHost && e && e.stage === 'host')
    return `Found room ${C}, but couldn't open a connection to the host's device. Try again; if it keeps failing, put both devices on the same Wi-Fi.`;
  return asHost ? "Couldn't open a room." : `Couldn't join ${C}.`;
}
function connFail(code: string, asHost: boolean, e: any) {
  CONN.code = code;
  CONN.host = asHost;
  clearTimeout(CONN.timer);
  $('mcTitle').textContent = asHost
    ? "Couldn't Open a Room"
    : (CONN.back ? 'Lost Connection to ' : "Couldn't Join ") + code.toUpperCase();
  $('mcMsg').textContent =
    CONN.back && e && e.type === 'peer-unavailable'
      ? 'The room is no longer open: the host has left, or their screen is off.'
      : joinError(e, code, asHost);
  $('bMcRetry').classList.remove('hide');
  $('bMcCancel').textContent = 'Close';
  $('mpConn').classList.remove('hide');
}
/** Cancel / Close on the joining dialog: stop waiting (an attempt still in flight is dropped when it lands) */
export function cancelJoin() {
  MP.joinSeq = (MP.joinSeq || 0) + 1;
  MP.joining = false;
  connHide();
  if (MP.room) return;
  clearHash();
  if (CONN.back) toMenu(); // the lobby we were dropped from has gone: back to the main screen
  CONN.back = false;
}
/** `back`: we were dropped from this room and are getting back in */
export async function enterRoom(code, asHost, back = false) {
  if (MP.joining) return; // one attempt at a time: the dialog is up, with Cancel
  if (!MP.api) {
    connFail(code, asHost, { type: 'no-api' });
    return;
  }
  const seq = (MP.joinSeq = (MP.joinSeq || 0) + 1);
  const live = () => seq === MP.joinSeq;
  MP.joining = true;
  connShow(code, asHost, back);
  const was = asHost ? hostingGet() : null;
  const rehost = !!was && was.code === code;
  const token = rehost ? was.token : newToken();
  let room = null;
  try {
    if (MP.room) await leaveRoom(true);
    for (let i = 0; !room; i++) {
      try {
        room = await MP.api.join(code, {
          host: asHost,
          token,
          cancelled: () => !live(),
          onStep: (s, n) => live() && connStep(s, n),
        });
      } catch (e) {
        // a new room whose code someone else already holds: take another code
        if (!(asHost && !rehost && e && e.type === 'code-taken' && i < 2)) throw e;
        code = mpCode();
      }
    }
  } catch (e) {
    if (!live()) return; // cancelled: the dialog has gone already
    MP.joining = false;
    connFail(code, asHost, e);
    return;
  }
  if (!live()) {
    room.leave().catch(() => {});
    return;
  }
  MP.joining = false;
  connHide();
  MP.room = room;
  LBS.s = 0;
  MP.code = code;
  MP.host = asHost;
  MP.phase = 'lobby';
  MP.jt = Date.now();
  if (asHost) hostingSet({ code, token, t: Date.now() });
  opts.drs = store.get('drs', 2);
  lbRulesInit();
  MP.lastStart = null;
  try {
    location.hash = code;
  } catch (e) {}
  MP.unsub = MP.room.onPeers(
    ch => {
      MP.peers = ch.peers;
      const me = ch.peers.find(p => p.sameTab);
      if (me) MP.me = me.peer;
      mpPeers(ch);
    },
    () => {
      // dropped while waiting in the lobby (say, after a look at another app): get straight back in
      if (MP.phase === 'lobby' && !MP.host) {
        const c = MP.code;
        leaveRoom(true).then(() => enterRoom(c, false, true));
        return;
      }
      showToast('Lost connection to the room');
      leaveRoom();
    },
  );
  holdScreen(true);
  loadNick(); // the saved name, as it is now: other players are sent the same name the box shows
  mpPresence(true);
  showLobby();
}
export async function leaveRoom(quiet?) {
  const r = MP.room;
  MP.room = null;
  MP.phase = 'off';
  MP.host = false;
  hostingSet(null);
  holdScreen(false);
  if (MP.unsub) MP.unsub();
  MP.unsub = null;
  try {
    if (r) await r.leave();
  } catch (e) {}
  clearHash();
  $('lobby').classList.add('hide');
  if (!quiet) toMenu();
}
export function hostPeer() {
  const hs = MP.peers.filter(p => p.presence && p.presence.role === 'host');
  if (!hs.length) return null;
  hs.sort((a, b) => (a.peer < b.peer ? -1 : 1));
  return hs[0];
}
export function mpCfg() {
  if (!MP.rules) lbRulesInit();
  return Object.assign({ track: GS.trackIdx }, MP.rules);
}
export function mpPresence(full?) {
  if (!MP.room) return;
  const p: any = {
    v: 1,
    nick: GS.NICK.slice(0, 16),
    team: opts.team,
    role: MP.host ? 'host' : 'guest',
    phase: MP.phase,
    jt: MP.jt || 0,
  };
  if (MP.host) p.cfg = mpCfg();
  MP.room.presence(p).catch(() => {});
}
// --- lobby UI ---
export let showLobby = function () {
  $('menu').classList.add('hide');
  $('home').classList.add('hide');
  $('results').classList.add('hide');
  $('pause').classList.add('hide');
  $('joinDlg').classList.add('hide');
  $('lobby').classList.remove('hide');
  lbGo(LBS.s);
  const link = ARTIFACT_URL + '#' + MP.code;
  $('lbCode').textContent = MP.code.toUpperCase();
  $('lbLink').textContent = link;
  $('nick').value = loadNick();
  drawQR(link);
  renderLobby();
};
export function init(): void {
  loadNick();
  addEventListener('storage', e => {
    if (e.key === null || e.key === 'hcgp_nick') syncNick();
  });
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState !== 'visible') return;
    syncNick();
    if (MP.room) holdScreen(true);
  });
  $('bMcRetry').onclick = () => {
    MP.joining = false;
    enterRoom(CONN.code, CONN.host, CONN.back);
  };
  $('bMcCancel').onclick = cancelJoin;
  // opened from an invite link: say so straight away, before online play is even ready
  const linked = normCode((location.hash || '').slice(1));
  if (linked) {
    const was = hostingGet();
    connShow(linked, !!was && was.code === linked);
  }
  (async () => {
    const onClaude =
      /(^|\.)claude(usercontent)?\.(ai|com)$/.test(location.hostname) ||
      location.hostname.endsWith('.claude.ai');
    const hasClaude = () => !!(window.claude && window.claude.use);
    const canP2P = !!window.RTCPeerConnection && location.protocol !== 'file:';
    // claude.ai adds its room service a moment after the page loads, so wait for it there. Anywhere else there
    // is nothing to wait for: load PeerJS at once, so a player arriving from an invite link isn't kept waiting.
    const lib =
      !onClaude && canP2P
        ? loadPeerJS().then(
            () => true,
            () => false,
          )
        : null;
    if (lib) await lib;
    else for (let i = 0; i < 50 && !hasClaude(); i++) await sleep(200);
    try {
      if (hasClaude()) MP.api = await window.claude.use('room');
    } catch (e) {
      MP.api = null;
    }
    if (
      !MP.api &&
      canP2P &&
      (await (lib ||
        loadPeerJS().then(
          () => true,
          () => false,
        )))
    ) {
      MP.api = makeP2PApi();
      MP.p2p = true;
      ARTIFACT_URL = location.origin + location.pathname;
    }
    if (MP.p2p)
      $('lbHelp').textContent =
        'Friends open this page (or scan the QR code) and join with the code. Players connect directly to the host.';
    mpAvail();
    const fromHash = () => {
      const c = normCode((location.hash || '').slice(1));
      if (!c || MP.room || MP.joining) return;
      // a reloaded host page comes back as the host of its room; everyone else joins as a guest
      const was = hostingGet();
      enterRoom(c, !!was && was.code === c);
    };
    fromHash();
    addEventListener('hashchange', fromHash);
  })();
}
/** debug/test hook: reassign a module-level binding */
export function __set(name: string, v: any): void {
  switch (name) {
    case 'ARTIFACT_URL':
      ARTIFACT_URL = v;
      break;
    case 'showLobby':
      showLobby = v;
      break;
  }
}
