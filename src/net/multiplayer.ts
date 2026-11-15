import type { MPState } from '../types';
import { GS } from '../state';
import { $, cookie, store } from '../core/dom';
import { opts } from '../game/race';
import { hideJoining, joinFailed, joinStep, showJoining } from './joining';
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
// The host's browser registers the room code as its id and becomes the hub; everyone else connects to the hub.
// Each player's presence object is merged into the hub's list, and the hub sends the whole list to everyone ~15 times a second.
// TURN relay (optional): fill in your own relay login (e.g. a free Metered account) to let players on strict networks / mobile data connect.
export const TURN = { urls: [], username: '', credential: '' };
export const P2P = {
  prefix: 'racingline-mt-',
  ice: [{ urls: ['stun:stun.l.google.com:19302', 'stun:stun.cloudflare.com:3478'] }].concat(
    TURN.urls.length ? [TURN] : [],
  ),
};
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
export function makeP2PApi(PeerCls?) {
  PeerCls = PeerCls || window.Peer;
  const opt = () => ({ debug: 0, config: { iceServers: P2P.ice } });
  const openPeer = id =>
    new Promise<void>((res, rej) => {
      const p = id ? new PeerCls(id, opt()) : new PeerCls(opt());
      let done = false;
      p.on('open', () => {
        done = true;
        res(p);
      });
      p.on('error', e => {
        if (!done) {
          done = true;
          try {
            p.destroy();
          } catch (_) {}
          rej(e);
        }
      });
      setTimeout(() => {
        if (!done) {
          done = true;
          try {
            p.destroy();
          } catch (_) {}
          rej({ type: 'timeout' });
        }
      }, 12000);
    });
  // A guest needs a connection to the matchmaking server before it can call the host. Opening one takes about half a
  // second, so it is opened ahead of time when a join is likely (the Multiplayer panel or the join box is open) and
  // dropped again if nothing comes of it.
  let warm: Promise<any> | null = null,
    warmT: ReturnType<typeof setTimeout> | undefined;
  const dropWarm = () => {
    const w = warm;
    warm = null;
    clearTimeout(warmT);
    if (w)
      w.then(p => {
        try {
          if (p) p.destroy();
        } catch (_) {}
      });
  };
  const takeWarm = async () => {
    const w = warm;
    warm = null;
    clearTimeout(warmT);
    const p = w ? await w : null;
    return p && !p.destroyed && !p.disconnected ? p : null;
  };
  return {
    /** get ready for a join that is likely to follow */
    warm() {
      if (warm) return;
      warm = openPeer(null).catch(() => null);
      warmT = setTimeout(dropWarm, 90000);
    },
    /**
     * Open the room `code` as its host (o.host) or join it as a guest. o.onStep reports progress ('room', 'server',
     * 'host'). Rejects with {type}: 'code-taken' (host: someone holds that code), 'peer-unavailable' (guest: no such
     * room), 'timeout', or a PeerJS error type.
     */
    async join(code, o: { host?: boolean; onStep?: (s: string) => void } = {}) {
      const hubId = P2P.prefix + code;
      const step = (st: string) => {
        try {
          if (o.onStep) o.onStep(st);
        } catch (_) {}
      };
      let peer = null;
      const hub = !!o.host;
      if (hub) {
        step('room');
        try {
          peer = await openPeer(hubId);
        } catch (e) {
          throw e && e.type === 'unavailable-id' ? { type: 'code-taken' } : e;
        }
      }
      const subs = new Set<(ch: any) => void>();
      let lostCbs = new Set<() => void>();
      let mine = {};
      let list = [];
      let prevIds = new Set();
      let closed = false;
      const emit = () => {
        const ids = new Set(list.map(p => p.peer));
        const left = [...prevIds].filter(i => !ids.has(i));
        prevIds = ids;
        const peers = list.map(p => ({
          peer: p.peer,
          presence: p.presence || {},
          kind: 'viewer',
          sameTab: p.peer === peer.id,
        }));
        for (const f of subs)
          try {
            f({ peers, left });
          } catch (_) {}
      };
      const lost = () => {
        if (closed) return;
        closed = true;
        for (const f of lostCbs)
          try {
            f();
          } catch (_) {}
      };
      if (hub) {
        // ---- hub: keeps everyone's presence and broadcasts it
        const conns = new Map();
        const pres = new Map([[peer.id, mine]]);
        const seen = new Map();
        let dirty = true,
          lastB = 0;
        const snapshot = () => [...pres.entries()].map(([id, p]) => ({ peer: id, presence: p }));
        const broadcast = (now: number) => {
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
        };
        // The timer below sets the normal pace. A browser slows the timers of a tab that is not in front (to once a
        // second, later once a minute), so the hub also answers what arrives: a new guest gets the list at once, and
        // a guest's update or heartbeat is passed on when the timer is late. A host whose tab is in the background
        // (the game open in two tabs, or another app in front) keeps its room going that way.
        const nudge = () => {
          const now = Date.now();
          if (now - lastB >= (dirty ? 60 : 2000)) broadcast(now);
        };
        peer.on('connection', c => {
          c.on('open', () => {
            conns.set(c.peer, c);
            seen.set(c.peer, Date.now());
            if (!pres.has(c.peer)) pres.set(c.peer, {});
            broadcast(Date.now());
          });
          c.on('data', m => {
            seen.set(c.peer, Date.now());
            if (m && m.t === 'p' && m.p && typeof m.p === 'object') {
              pres.set(c.peer, Object.assign(pres.get(c.peer) || {}, m.p));
              dirty = true;
            }
            nudge();
          });
          const gone = () => {
            if (conns.get(c.peer) === c) {
              conns.delete(c.peer);
              pres.delete(c.peer);
              dirty = true;
            }
          };
          c.on('close', gone);
          c.on('error', gone);
        });
        peer.on('disconnected', () => {
          try {
            peer.reconnect();
          } catch (_) {}
        });
        const tick = setInterval(() => {
          if (closed) {
            clearInterval(tick);
            return;
          }
          const now = Date.now();
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
          broadcast(now);
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
      // ---- guest: one connection to the hub. (A guest does not try for the room's id first, as it used to: that cost
      // a round trip to the matchmaking server on every join, and a mistyped code opened an empty room with no host.)
      step('server');
      peer = (await takeWarm()) || (await openPeer(null));
      step('host');
      const conn = peer.connect(hubId, { reliable: true, serialization: 'json' });
      try {
        await new Promise<void>((res, rej) => {
          let ok = false;
          conn.on('open', () => {
            ok = true;
            res();
          });
          conn.on('error', e => {
            if (!ok) rej(e);
          });
          peer.on('error', e => {
            if (!ok) rej(e);
          });
          setTimeout(() => {
            if (!ok) rej({ type: 'timeout' });
          }, 12000);
        });
      } catch (e) {
        try {
          peer.destroy(); // do not leave a half-open connection behind
        } catch (_) {}
        throw e;
      }
      let lastS = Date.now(),
        lastH = 0;
      const beat = () => {
        lastH = Date.now();
        try {
          if (conn.open) conn.send({ t: 'h' });
        } catch (_) {}
      };
      conn.on('data', m => {
        lastS = Date.now();
        if (m && m.t === 's' && Array.isArray(m.peers)) {
          list = m.peers;
          emit();
        }
        if (lastS - lastH > 3000) beat(); // this tab's timers are slowed (it is in the background): stay in the room
      });
      const hb = setInterval(() => {
        if (closed) {
          clearInterval(hb);
          return;
        }
        beat();
        if (Date.now() - lastS > 10000) {
          clearInterval(hb);
          lost();
        }
      }, 2000); // heartbeat both ways
      conn.on('close', lost);
      conn.on('error', lost);
      peer.on('disconnected', () => {
        try {
          peer.reconnect();
        } catch (_) {}
      });
      return {
        onPeers(f, onLost) {
          subs.add(f);
          if (onLost) lostCbs.add(onLost);
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
/** only letters, digits, spaces and . _ - in a name, 16 at most */
export const cleanName = (v): string =>
  String(v || '')
    .replace(/[^\p{L}\p{N} ._-]/gu, '')
    .slice(0, 16);
/** the player's name is kept in the browser's storage and in a cookie, so either brings it back */
export function saveName(name: string): void {
  GS.NICK = name;
  store.set('nick', name);
  cookie.set('nick', name);
}
/**
 * Take the name from the lobby's name box if it holds a new one; true when the name changed. Called on every edit
 * of the box and before the name is sent to the room, so what the box shows is what is saved.
 */
export function commitName(): boolean {
  const name = cleanName(($('nick') as HTMLInputElement).value).trim();
  if (!name || name === GS.NICK) return false; // an empty box keeps the name until a new one is typed
  saveName(name);
  return true;
}
/** why a join failed, in the player's words */
function joinError(e, code: string, asHost: boolean): string {
  const t = e && e.type;
  if (t === 'no-api') return "Online play isn't available right now. Check your connection and try again.";
  if (t === 'peer-unavailable')
    return 'No race found with code ' + code.toUpperCase() + '. Check the code with the host.';
  if (t === 'timeout')
    return asHost
      ? "Couldn't reach the matchmaking server in time."
      : "Couldn't reach the host. Their network, or yours, may block direct connections.";
  if (t === 'network' || t === 'server-error' || t === 'socket-error' || t === 'socket-closed')
    return "Can't reach the matchmaking server right now. Check your connection.";
  return asHost ? 'Could not open a room.' : 'Could not join ' + code.toUpperCase() + '.';
}
/** bumped by every join and every cancel: a join that finds it changed has been overtaken and backs out */
let joinSeq = 0;
// A host remembers its room's code twice. In the tab (sessionStorage): reloading the page takes the room straight
// back. In the browser (localStorage, for half a day): the invite link opened in another tab joins the room if a tab
// still hosts it, and reopens it as host if that tab has been closed.
const HOST_KEY = 'rl_host',
  HOST_TTL = 12 * 3600e3;
/** the room this tab was hosting before a reload */
function hostedHere(): string | null {
  try {
    return sessionStorage.getItem(HOST_KEY);
  } catch (e) {
    return null;
  }
}
/** the room this browser last hosted, in any tab */
function hostedBefore(): string | null {
  const h = store.get('mphost', null);
  return h && typeof h.code === 'string' && Date.now() - h.t < HOST_TTL ? h.code : null;
}
function rememberHost(code: string | null): void {
  try {
    if (code) sessionStorage.setItem(HOST_KEY, code);
    else sessionStorage.removeItem(HOST_KEY);
  } catch (e) {}
  if (code) store.set('mphost', { code, t: Date.now() });
}
/** the host closed its room on purpose: a link to it is an ordinary invite again */
function forgetHost(code: string | null): void {
  rememberHost(null);
  if (code && hostedBefore() === code) store.set('mphost', null);
}
/** back out of a join in progress (the Cancel button) */
export function cancelJoin(): void {
  joinSeq++;
  MP.joining = false;
  hideJoining();
  $('home').classList.remove('hide');
}
/**
 * Open a room (asHost) or join the room `code`, with the waiting screen up until the lobby can be shown.
 * mine: this browser hosted the room `code`. asHost then only says what to try first: if the code is held (another
 * tab still hosts it) the room is joined as a guest, and if nobody holds it the room is reopened as its host.
 */
export async function enterRoom(code, asHost, mine = false) {
  if (MP.joining) return; // one join at a time (a second tap on Join)
  const seq = ++joinSeq;
  const first = asHost;
  const again = () => enterRoom(code, first, mine);
  const back = () => {
    if (asHost) $('home').classList.remove('hide');
    else {
      // back to the join box with the code still in it
      $('joinDlg').classList.remove('hide');
      $('joinCode').value = code.toUpperCase();
    }
  };
  showJoining(asHost && !mine ? null : code, asHost, cancelJoin);
  if (!MP.api) {
    joinFailed(joinError({ type: 'no-api' }, code, asHost), again, back);
    return;
  }
  MP.joining = true;
  let room = null;
  try {
    if (MP.room) await leaveRoom(true);
    for (let tries = 0; !room; tries++) {
      try {
        room = await MP.api.join(code, { host: asHost, onStep: st => seq === joinSeq && joinStep(st) });
      } catch (e) {
        const t = e && e.type;
        if (tries >= 3) throw e;
        if (mine && (asHost ? t === 'code-taken' : t === 'peer-unavailable')) {
          asHost = !asHost; // held by another tab: join it. Held by nobody: it is ours to reopen
          if (seq === joinSeq) showJoining(code, asHost, cancelJoin);
        } else if (asHost && !mine && t === 'code-taken') code = mpCode(); // a clash with another room's code: take another
        else throw e;
      }
    }
  } catch (e) {
    if (seq !== joinSeq) return; // cancelled meanwhile
    MP.joining = false;
    joinFailed(joinError(e, code, asHost), again, back);
    return;
  }
  if (seq !== joinSeq) {
    // cancelled while it was connecting
    try {
      room.leave();
    } catch (e) {}
    return;
  }
  MP.joining = false;
  MP.room = room;
  LBS.s = 0;
  MP.code = code;
  MP.host = asHost;
  MP.phase = 'lobby';
  MP.jt = Date.now();
  rememberHost(asHost ? code : null);
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
      showToast('Lost connection to the room');
      leaveRoom();
    },
  );
  mpPresence(true);
  hideJoining();
  showLobby();
}
export async function leaveRoom(quiet?) {
  const r = MP.room;
  if (!quiet) {
    // leaving on purpose: this tab no longer hosts the room
    if (MP.host) forgetHost(MP.code);
    else rememberHost(null);
  }
  MP.room = null;
  MP.phase = 'off';
  MP.host = false;
  if (MP.unsub) MP.unsub();
  MP.unsub = null;
  try {
    if (r) await r.leave();
  } catch (e) {}
  try {
    history.replaceState(null, '', location.pathname + location.search);
  } catch (e) {
    try {
      location.hash = '';
    } catch (_) {}
  }
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
  if (MP.phase === 'lobby' && !$('lobby').classList.contains('hide')) commitName();
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
  $('nick').value = GS.NICK;
  drawQR(link);
  renderLobby();
};
export function init(): void {
  const saved = cleanName(store.get('nick', '')).trim() || cleanName(cookie.get('nick')).trim();
  if (saved) saveName(saved); // (writes it to whichever of the two places had lost it)
  else GS.NICK = 'Driver-' + Math.floor(100 + Math.random() * 900);
  // opened from an invite link: say so at once, the lobby follows as soon as the connection is up
  const linked = normCode((location.hash || '').slice(1));
  if (linked)
    setTimeout(() => {
      if (!MP.room && !MP.joining) showJoining(linked, false, cancelJoin); // (after the other modules have set up their screens)
    }, 0);
  (async () => {
    const onClaude =
      /(^|\.)claude(usercontent)?\.(ai|com)$/.test(location.hostname) ||
      location.hostname.endsWith('.claude.ai');
    // claude.ai hands its room service to the page a moment after it loads. Anywhere else there is nothing to
    // wait for (this used to wait 1.6 s regardless, before even loading PeerJS).
    for (let i = 0; i < (onClaude ? 50 : 0) && !(window.claude && window.claude.use); i++)
      await new Promise(r => setTimeout(r, 200));
    try {
      if (window.claude && window.claude.use) MP.api = await window.claude.use('room');
    } catch (e) {
      MP.api = null;
    }
    if (!MP.api && window.RTCPeerConnection && location.protocol !== 'file:') {
      try {
        await loadPeerJS();
        MP.api = makeP2PApi();
        MP.p2p = true;
        ARTIFACT_URL = location.origin + location.pathname;
      } catch (e) {
        MP.api = null;
      }
    }
    if (MP.p2p)
      $('lbHelp').textContent =
        'Friends open this page (or scan the QR code) and join with the code. Players connect directly to the host.';
    mpAvail();
    // a link to a room this tab was hosting (the page was reloaded) takes the room back; a link to a room another tab
    // of this browser hosted joins it, or reopens it if that tab is gone; any other link joins
    const go = (c: string) => enterRoom(c, hostedHere() === c, hostedHere() === c || hostedBefore() === c);
    if (linked) go(linked);
    else hideJoining();
    addEventListener('hashchange', () => {
      const h2 = normCode((location.hash || '').slice(1));
      if (h2 && !MP.room && !MP.joining) go(h2);
    });
  })();
}
/** a join is likely (the Multiplayer panel or the join box was opened): have the transport get ready */
export function mpWarm(): void {
  try {
    if (MP.api && MP.api.warm && !MP.room && !MP.joining) MP.api.warm();
  } catch (e) {}
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
