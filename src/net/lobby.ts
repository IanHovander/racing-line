import { GS } from '../state';
import { $, clamp, store } from '../core/dom';
import { opts } from '../game/race';
import { MP, hostPeer, mpCfg, mpPresence } from './multiplayer';
import { qrSvg } from './qr';
import { TEAMS, teamLogo } from '../teams/teams';
import { TRACKS } from '../track/circuits';
import { setMusic, setSfx, unlockAudio } from '../audio/audio';
import { lineLoad, lineSave } from '../sim/lines';
import { showToast } from '../ui/controls';
import { syncAllSegs } from '../ui/widgets';
import { placeCircuitPicker, showCircuit, teamCardHtml } from '../ui/menu';
// ---- lobby: circuit (host), race settings (host), controls (each player)
export const LB_RULES: [string, string, [number, string][]][] = [
  [
    'practice',
    'Session',
    [
      [0, 'Race'],
      [1, 'Practice (players only)'],
    ],
  ],
  [
    'diff',
    'Opponents',
    [
      [0, 'Easy'],
      [1, 'Medium'],
      [2, 'Hard'],
    ],
  ],
  [
    'laps',
    'Laps',
    [
      [3, '3'],
      [5, '5'],
      [10, '10'],
    ],
  ],
  [
    'rain',
    'Weather',
    [
      [0, 'Dry'],
      [1, 'Rain'],
    ],
  ],
  [
    'tyres',
    'Tyre Wear',
    [
      [0, 'Off'],
      [1, 'On'],
    ],
  ],
  [
    'damage',
    'Damage & Knockouts',
    [
      [0, 'Off'],
      [1, 'On'],
    ],
  ],
  [
    'tow',
    'Slipstream',
    [
      [0, 'Off'],
      [1, 'On'],
    ],
  ],
  [
    'drsOn',
    'DRS',
    [
      [0, 'Off'],
      [1, 'On'],
    ],
  ],
  [
    'limits',
    'Track Limits',
    [
      [0, 'Off'],
      [3, 'Penalty Every 3rd'],
      [2, 'Every 2nd'],
    ],
  ],
  [
    'yellow',
    'Yellow Flags',
    [
      [0, 'Off'],
      [3, '3 s'],
      [10, '10 s'],
      [30, '30 s'],
    ],
  ],
];
export const LB_CTRL: [string, string, [number, string][]][] = [
  [
    'pedals',
    'Pedals',
    [
      [0, 'Throttle Only'],
      [1, 'Brake Only'],
      [2, 'Throttle + Brake'],
      [3, 'Auto'],
    ],
  ],
  [
    'steer',
    'Steering',
    [
      [0, 'Auto'],
      [1, 'Lanes'],
      [2, 'Manual'],
      [3, 'Overtake'],
    ],
  ],
  [
    'dynlv',
    'Line Difficulty',
    [
      [1, 'Novice'],
      [2, 'Intermediate'],
      [3, 'Cautious Expert'],
      [4, 'Perfect Expert'],
      [0, 'Classic'],
    ],
  ],
  [
    'gears',
    'Gearbox',
    [
      [0, 'Automatic'],
      [1, 'Manual'],
    ],
  ],
  [
    'drsMode',
    'DRS',
    [
      [1, 'Button'],
      [2, 'Automatic'],
    ],
  ],
];
// What the pause menu offers under Display & Sound, so nothing has to wait until the race has started.
// (Sound Effects and Music are on/off switches: 1 and 0 here, booleans in opts.)
export const LB_VIEW: [string, string, [number, string][]][] = [
  [
    'cam',
    'Camera',
    [
      [1, 'Isometric'],
      [0, 'Chase'],
    ],
  ],
  [
    'line',
    'Racing Line',
    [
      [0, 'Hidden'],
      [2, 'Difficult Turns'],
      [1, 'Shown'],
    ],
  ],
  [
    'turns',
    'Turn Numbers',
    [
      [0, 'Hidden'],
      [1, 'Shown'],
    ],
  ],
  [
    'sound',
    'Sound Effects',
    [
      [1, 'On'],
      [0, 'Off'],
    ],
  ],
  [
    'music',
    'Music',
    [
      [1, 'On'],
      [0, 'Off'],
    ],
  ],
];
export function lbRulesInit() {
  MP.rules = {
    practice: 0,
    diff: opts.diff,
    laps: opts.laps,
    rain: opts.rain,
    tyres: opts.tyres,
    damage: opts.damage,
    tow: opts.tow,
    drsOn: opts.drs ? 1 : 0,
    limits: opts.limits,
    yellow: opts.yellow,
  };
}
export function segRow(label, list, cur, dis, onPick) {
  const d = document.createElement('div');
  const sp = document.createElement('span');
  sp.textContent = label;
  d.appendChild(sp);
  const g = document.createElement('div');
  g.className = 'seg';
  for (const [v, t] of list) {
    const b = document.createElement('button');
    b.textContent = t;
    b.classList.toggle('sel', v === cur);
    b.disabled = dis;
    b.onclick = () => {
      if (!dis) onPick(v);
    };
    g.appendChild(b);
  }
  d.appendChild(g);
  return d;
}
export const LBS = { s: 0 };
// the lobby is the multiplayer version of the setup wizard: Room -> Team -> Circuit -> Settings
export function lbGo(n) {
  LBS.s = clamp(n, 0, 3);
  document
    .querySelectorAll<HTMLElement>('#lobby .wz')
    .forEach(d => d.classList.toggle('on', +d.dataset.s === LBS.s));
  ([...$('lbNav').children] as HTMLElement[]).forEach((b, i) => {
    b.classList.toggle('cur', i === LBS.s);
    b.classList.toggle('done', i < LBS.s);
  });
  if (LBS.s === 2) placeCircuitPicker('lbCircuitSlot');
  const last = LBS.s === 3;
  $('lbBack').style.visibility = LBS.s === 0 ? 'hidden' : 'visible';
  $('lbNext').style.display = last ? 'none' : '';
  $('bLbStart').style.display = last && MP.host ? '' : 'none';
  $('lbWait').style.display = last ? '' : 'none';
  const cd = $('lobby').querySelector('.card');
  if (cd) cd.scrollTop = 0;
}
export function renderLobbySettings(cfg) {
  const r = $('lbRules');
  r.textContent = '';
  const src = MP.host ? MP.rules : cfg || {};
  for (const [k, label, list] of LB_RULES)
    r.appendChild(
      segRow(label, list, src[k], !MP.host, v => {
        MP.rules[k] = v;
        mpPresence();
        renderLobby();
      }),
    );
  $('lbRulesNote').textContent = MP.host
    ? 'You set these for everyone.'
    : cfg
      ? 'Set by the host.'
      : 'Waiting for the host…';
  const c = $('lbCtrl');
  c.textContent = '';
  const drsPref = store.get('drs', 2) || 2;
  for (const [k, label, list] of LB_CTRL) {
    const cur = k === 'drsMode' ? drsPref : opts[k];
    c.appendChild(
      segRow(label, list, cur, false, v => {
        if (k === 'drsMode') {
          store.set('drs', v);
        } else {
          opts[k] = v;
          store.set(k, v);
        }
        try {
          syncAllSegs();
        } catch (e) {}
        renderLobby();
      }),
    );
  }
  // display and sound: the same switches as the pause menu
  if (MP.phase === 'lobby') lineLoad(); // the Racing Line choice for the session the host has picked (practice or race)
  const vw = $('lbView');
  vw.textContent = '';
  for (const [k, label, list] of LB_VIEW) {
    const cur = k === 'sound' || k === 'music' ? (opts[k] ? 1 : 0) : opts[k];
    vw.appendChild(
      segRow(label, list, cur, false, v => {
        if (k === 'sound' || k === 'music') {
          unlockAudio();
          (k === 'sound' ? setSfx : setMusic)(!!v);
        } else if (k === 'line') {
          opts.line = v;
          lineSave();
        } else {
          opts[k] = v;
          store.set(k, v);
        }
        try {
          syncAllSegs();
        } catch (e) {}
        renderLobby();
      }),
    );
  }
  $('lbTrackTitle').textContent = MP.host ? '' : cfg ? 'Chosen by the host' : 'Waiting for the host…';
}
// ---- every player races a different team: earlier arrivals keep their pick, later ones move to a free team
export function lobbyOrder() {
  return MP.peers
    .filter(p => p.kind === 'viewer' && p.presence && p.presence.nick)
    .sort((a, b) => {
      const ra = a.presence.role === 'host' ? 0 : 1,
        rb = b.presence.role === 'host' ? 0 : 1;
      return ra - rb || (a.presence.jt || 0) - (b.presence.jt || 0) || (a.peer < b.peer ? -1 : 1);
    });
}
export function teamOwners() {
  const own = {};
  for (const p of lobbyOrder()) {
    const t = clamp(+p.presence.team || 0, 0, 4);
    (own[t] = own[t] || []).push(p);
  }
  return own;
}
// team -> players, in arrival order (max 2 race)
export function resolveTeam() {
  if (!MP.room || MP.phase !== 'lobby') return;
  const own = teamOwners();
  const l = own[opts.team] || [];
  const idx = l.findIndex(p => p.sameTab);
  if (idx >= 2) {
    const free = [0, 1, 2, 3, 4].find(t => (own[t] || []).length < 2);
    MP.full = free === undefined;
    if (!MP.full) {
      const was = TEAMS[opts.team].name;
      opts.team = free;
      store.set('team', free);
      mpPresence();
      showToast(was + " already has two drivers — you're now with " + TEAMS[free].name);
    }
  } else MP.full = false;
}
export function renderLobbyTeams() {
  const el = $('lbTeams');
  if (!el) return;
  const own = teamOwners();
  el.textContent = '';
  TEAMS.forEach((t, i) => {
    const b = document.createElement('button');
    const l = (own[i] || []).filter(p => !p.sameTab);
    const names = l.map(p => String(p.presence.nick).replace(/[<>&]/g, ''));
    if (i === opts.team && !MP.full) names.unshift('You');
    b.innerHTML =
      teamLogo(i, 30) +
      `<span class="tn">${t.name}</span><span class="tdc">${names.length ? names.map(n => `<span>${n}</span>`).join('') : '<span class="ai">AI</span>'}</span>`;
    b.classList.toggle('sel', i === opts.team && !MP.full);
    b.disabled = l.length >= 2 && i !== opts.team;
    b.onclick = () => {
      if (b.disabled || !MP.room) return;
      opts.team = i;
      store.set('team', i);
      mpPresence();
      renderLobby();
    };
    el.appendChild(b);
  });
  $('lbTeamStats').innerHTML = teamCardHtml(opts.team);
  $('lbTeamNote').textContent = MP.full
    ? 'All ten seats are taken — this race is full, so you can watch the lobby but not race.'
    : 'Up to two players per team. Empty seats are driven by the AI.';
}
export function renderLobby() {
  if (!MP.room) return;
  resolveTeam();
  renderLobbyTeams();
  const hp = hostPeer(),
    list = $('lbPlayers');
  list.textContent = '';
  for (const p of MP.peers) {
    if (p.kind !== 'viewer') continue;
    const pr = p.presence || {};
    const d = document.createElement('div');
    d.className = 'lbp';
    const sw = document.createElement('span');
    sw.style.flex = '0 0 auto';
    sw.innerHTML = teamLogo(clamp(+pr.team || 0, 0, 4), 18);
    d.appendChild(sw);
    const n = document.createElement('span');
    n.textContent =
      String(pr.nick || 'Joining…').slice(0, 16) + (p.sameTab ? ' (you)' : '') + (p.guest ? ' · guest' : '');
    d.appendChild(n);
    const r = document.createElement('small');
    r.textContent = pr.role === 'host' ? 'Host' : pr.phase === 'race' ? 'Racing' : 'Ready';
    d.appendChild(r);
    list.appendChild(d);
  }
  const cfg = MP.host ? mpCfg() : (hp && hp.presence.cfg) || null;
  $('lbInfo').textContent = cfg
    ? `${TRACKS[clamp(cfg.track | 0, 0, TRACKS.length - 1)].name} · ${cfg.laps | 0} Laps · ${cfg.rain ? 'Rain' : 'Dry'}${cfg.practice ? ' · Practice' : ''}`
    : 'Waiting for the host…';
  $('lbRoomTag').textContent = MP.code ? '· Room ' + MP.code.toUpperCase() : '';
  $('lobby').classList.toggle('guest', !MP.host);
  $('lbCrumb').innerHTML = cfg
    ? `<span class="crumb">›</span><span class="crumb2">${cfg.practice ? 'Practice' : 'Race'}</span>`
    : '';
  // guests follow the host's circuit so the map they see is the one they'll race on
  if (!MP.host && cfg && MP.phase === 'lobby') {
    const ti = clamp(cfg.track | 0, 0, TRACKS.length - 1);
    if (ti !== GS.trackIdx) showCircuit(ti);
  }
  if (LBS.s === 2) placeCircuitPicker('lbCircuitSlot');
  $('bLbStart').classList.toggle('hide', !MP.host);
  renderLobbySettings(cfg);
  const n = MP.peers.filter(p => p.kind === 'viewer').length;
  $('lbWait').textContent = MP.host
    ? n > 1
      ? `${n} players — start when everyone's in. Empty grid slots are filled with AI.`
      : 'Waiting for players… you can also start alone.'
    : hp
      ? 'The host will start the race.'
      : 'No host here yet — share this code with whoever is hosting.';
}
export async function drawQR(text) {
  const el = $('qr');
  try {
    el.innerHTML = qrSvg(text);
  } catch (e) {
    el.textContent = 'QR unavailable — share the link below';
  }
}
export function init(): void {
  $('lbBack').onclick = () => lbGo(LBS.s - 1);
  $('lbNext').onclick = () => lbGo(LBS.s + 1);
  $('lbNav').onclick = e => {
    const b = (e.target as HTMLElement).closest('button');
    if (b) lbGo(+b.dataset.s);
  };
}
