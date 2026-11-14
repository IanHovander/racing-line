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
export const MP: MPState = { api: null, room: null, code: null, host: false, me: null, peers: [], phase: 'off', lastStart: null, sendT: 0, unsub: null };
export const mpOn = () => !!MP.room;
// ---- WebRTC multiplayer (outside claude.ai) ----
// Same interface as claude.ai's room service (join -> room.onPeers / presence / leave), built on PeerJS.
// The first browser to open a room code becomes its hub (the host); everyone else connects to the hub.
// Each player's presence object is merged into the hub's list, and the hub sends the whole list to everyone ~15 times a second.
// TURN relay (optional): fill in your own relay login (e.g. a free Metered account) to let players on strict networks / mobile data connect.
export const TURN = { urls: [], username: '', credential: '' };
export const P2P = { prefix: 'racingline-mt-', ice: [{ urls: ['stun:stun.l.google.com:19302', 'stun:stun.cloudflare.com:3478'] }].concat(TURN.urls.length ? [TURN] : []) };
export function loadPeerJS() {
  return new Promise<void>((res, rej) => {
    if (window.Peer)
      return res();
    const s = document.createElement('script');
    s.src = 'vendor/peerjs.min.js';
    s.onload = () => window.Peer ? res() : rej();
    s.onerror = () => { const t = document.createElement('script'); t.src = 'https://cdn.jsdelivr.net/npm/peerjs@1.5.5/dist/peerjs.min.js'; t.onload = () => window.Peer ? res() : rej(); t.onerror = rej; document.head.appendChild(t); };
    document.head.appendChild(s);
  });
}
export function makeP2PApi(PeerCls?) {
  PeerCls = PeerCls || window.Peer;
  const opt = () => ({ debug: 0, config: { iceServers: P2P.ice } });
  const openPeer = id => new Promise<void>((res, rej) => {
    const p = id ? new PeerCls(id, opt()) : new PeerCls(opt());
    let done = false;
    p.on('open', () => { done = true; res(p); });
    p.on('error', e => { if (!done) {
      done = true;
      try {
        p.destroy();
      }
      catch (_) { }
      rej(e);
    } });
    setTimeout(() => { if (!done) {
      done = true;
      try {
        p.destroy();
      }
      catch (_) { }
      rej({ type: 'timeout' });
    } }, 12000);
  });
  return { async join(code) {
      const hubId = P2P.prefix + code;
      let peer = null, hub = false;
      try {
        peer = await openPeer(hubId);
        hub = true;
      }
      catch (e) {
        if (e && e.type !== 'unavailable-id')
          throw e;
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
        const peers = list.map(p => ({ peer: p.peer, presence: p.presence || {}, kind: 'viewer', sameTab: p.peer === peer.id }));
        for (const f of subs)
          try {
            f({ peers, left });
          }
          catch (_) { }
      };
      const lost = () => { if (closed)
        return; closed = true; for (const f of lostCbs)
        try {
          f();
        }
        catch (_) { } };
      if (hub) { // ---- hub: keeps everyone's presence and broadcasts it
        const conns = new Map();
        const pres = new Map([[peer.id, mine]]);
        const seen = new Map();
        let dirty = true, lastB = 0;
        const snapshot = () => [...pres.entries()].map(([id, p]) => ({ peer: id, presence: p }));
        peer.on('connection', c => {
          c.on('open', () => { conns.set(c.peer, c); seen.set(c.peer, Date.now()); if (!pres.has(c.peer))
            pres.set(c.peer, {}); dirty = true; });
          c.on('data', m => { seen.set(c.peer, Date.now()); if (m && m.t === 'p' && m.p && typeof m.p === 'object') {
            pres.set(c.peer, Object.assign(pres.get(c.peer) || {}, m.p));
            dirty = true;
          } });
          const gone = () => { if (conns.get(c.peer) === c) {
            conns.delete(c.peer);
            pres.delete(c.peer);
            dirty = true;
          } };
          c.on('close', gone);
          c.on('error', gone);
        });
        peer.on('disconnected', () => { try {
          peer.reconnect();
        }
        catch (_) { } });
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
              }
              catch (_) { }
              dirty = true;
            } // silent guests are dropped
          if (!dirty && now - lastB < 2000)
            return;
          dirty = false;
          lastB = now;
          const s = snapshot();
          list = s;
          emit();
          const msg = { t: 's', peers: s };
          for (const c of conns.values()) {
            try {
              if (c.open)
                c.send(msg);
            }
            catch (_) { }
          }
        }, 40);
        return { onPeers(f, onLost) { subs.add(f); if (onLost)
            lostCbs.add(onLost); setTimeout(emit, 0); return () => { subs.delete(f); if (onLost)
            lostCbs.delete(onLost); }; },
          async presence(p) { Object.assign(mine, p); dirty = true; },
          async leave() { closed = true; clearInterval(tick); for (const c of conns.values())
            try {
              c.close();
            }
            catch (_) { } try {
            peer.destroy();
          }
          catch (_) { } } };
      }
      // ---- guest: one connection to the hub
      peer = await openPeer(null);
      const conn = peer.connect(hubId, { reliable: true, serialization: 'json' });
      await new Promise<void>((res, rej) => { let ok = false; conn.on('open', () => { ok = true; res(); }); conn.on('error', e => { if (!ok)
        rej(e); }); peer.on('error', e => { if (!ok)
        rej(e); }); setTimeout(() => { if (!ok)
        rej({ type: 'timeout' }); }, 12000); });
      let lastS = Date.now();
      conn.on('data', m => { lastS = Date.now(); if (m && m.t === 's' && Array.isArray(m.peers)) {
        list = m.peers;
        emit();
      } });
      const hb = setInterval(() => { if (closed) {
        clearInterval(hb);
        return;
      } try {
        if (conn.open)
          conn.send({ t: 'h' });
      }
      catch (_) { } if (Date.now() - lastS > 10000) {
        clearInterval(hb);
        lost();
      } }, 2000); // heartbeat both ways
      conn.on('close', lost);
      conn.on('error', lost);
      peer.on('disconnected', () => { try {
        peer.reconnect();
      }
      catch (_) { } });
      return { onPeers(f, onLost) { subs.add(f); if (onLost)
          lostCbs.add(onLost); return () => { subs.delete(f); if (onLost)
          lostCbs.delete(onLost); }; },
        async presence(p) { Object.assign(mine, p); try {
          if (conn.open)
            conn.send({ t: 'p', p });
        }
        catch (_) { } },
        async leave() { closed = true; try {
          conn.close();
        }
        catch (_) { } try {
          peer.destroy();
        }
        catch (_) { } } };
    } };
}
export function mpAvail() {
  const ok = !!MP.api;
  $('bHost').disabled = !ok;
  $('bJoin').disabled = !ok;
  $('bJoin2').disabled = !ok;
  $('mpNote').textContent = ok ? 'Friends join with your 5-character room code, the invite link or the QR code.' : 'Online play isn\'t available right now — check your connection and try again.';
}
// room codes: 5 letters/digits, no ambiguous characters; old gp-xxxxx links still work
export const normCode = v => { v = String(v || '').toLowerCase().replace(/[^a-z0-9]/g, ''); if (/^gp[a-z0-9]{5}$/.test(v))
  v = v.slice(2); return /^[a-z0-9]{4,8}$/.test(v) ? v : null; };
export const mpCode = () => Array.from({ length: 5 }, () => 'abcdefghjkmnpqrstuvwxyz23456789'[Math.floor(Math.random() * 31)]).join('');
export async function enterRoom(code, asHost) {
  if (!MP.api)
    return;
  try {
    if (MP.room)
      await leaveRoom(true);
    MP.room = await MP.api.join(code);
  }
  catch (e) {
    const t = e && e.type;
    showToast(t === 'peer-unavailable' ? 'No race found with code ' + code : t === 'timeout' ? 'Couldn\'t reach the host for ' + code + ' — their network may block direct connections' : t === 'network' || t === 'server-error' || t === 'socket-error' ? 'Can\'t reach the matchmaking server right now' : 'Could not join ' + code);
    MP.room = null;
    return;
  }
  LBS.s = 0;
  MP.code = code;
  MP.host = asHost;
  MP.phase = 'lobby';
  MP.jt = Date.now();
  opts.drs = store.get('drs', 2);
  lbRulesInit();
  MP.lastStart = null;
  try {
    location.hash = code;
  }
  catch (e) { }
  MP.unsub = MP.room.onPeers(ch => { MP.peers = ch.peers; const me = ch.peers.find(p => p.sameTab); if (me)
    MP.me = me.peer; mpPeers(ch); }, () => { showToast('Lost connection to the room'); leaveRoom(); });
  mpPresence(true);
  showLobby();
}
export async function leaveRoom(quiet?) {
  const r = MP.room;
  MP.room = null;
  MP.phase = 'off';
  MP.host = false;
  if (MP.unsub)
    MP.unsub();
  MP.unsub = null;
  try {
    if (r)
      await r.leave();
  }
  catch (e) { }
  try {
    history.replaceState(null, '', location.pathname + location.search);
  }
  catch (e) {
    try {
      location.hash = '';
    }
    catch (_) { }
  }
  $('lobby').classList.add('hide');
  if (!quiet)
    toMenu();
}
export function hostPeer() { const hs = MP.peers.filter(p => p.presence && p.presence.role === 'host'); if (!hs.length)
  return null; hs.sort((a, b) => a.peer < b.peer ? -1 : 1); return hs[0]; }
export function mpCfg() { if (!MP.rules)
  lbRulesInit(); return Object.assign({ track: GS.trackIdx }, MP.rules); }
export function mpPresence(full?) {
  if (!MP.room)
    return;
  const p: any = { v: 1, nick: GS.NICK.slice(0, 16), team: opts.team, role: MP.host ? 'host' : 'guest', phase: MP.phase, jt: MP.jt || 0 };
  if (MP.host)
    p.cfg = mpCfg();
  MP.room.presence(p).catch(() => { });
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
  GS.NICK = store.get('nick', '') || ('Driver-' + Math.floor(100 + Math.random() * 900));
  (async () => {
    const onClaude = /(^|\.)claude(usercontent)?\.(ai|com)$/.test(location.hostname) || location.hostname.endsWith('.claude.ai');
    for (let i = 0; i < (onClaude ? 50 : 8) && !(window.claude && window.claude.use); i++)
      await new Promise(r => setTimeout(r, 200));
    try {
      if (window.claude && window.claude.use)
        MP.api = await window.claude.use('room');
    }
    catch (e) {
      MP.api = null;
    }
    if (!MP.api && window.RTCPeerConnection && location.protocol !== 'file:') {
      try {
        await loadPeerJS();
        MP.api = makeP2PApi();
        MP.p2p = true;
        ARTIFACT_URL = location.origin + location.pathname;
      }
      catch (e) {
        MP.api = null;
      }
    }
    if (MP.p2p)
      $('lbHelp').textContent = 'Friends open this page (or scan the QR code) and join with the code. Players connect directly to the host over WebRTC. Everyone picks a team and their own controls here; the host picks the circuit and race settings.';
    mpAvail();
    const h = (location.hash || '').slice(1);
    if (MP.api && normCode(h))
      enterRoom(normCode(h), false);
    addEventListener('hashchange', () => { const h2 = (location.hash || '').slice(1); if (MP.api && !MP.room && normCode(h2))
      enterRoom(normCode(h2), false); });
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
