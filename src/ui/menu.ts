import { GS } from '../state';
import { setMusic, setSfx, unlockAudio } from '../audio/audio';
import { cheer } from '../audio/crowd';
import { $, clamp, store } from '../core/dom';
import { cars, opts, setupRace } from '../game/race';
import { MP, leaveRoom, mpOn, mpPresence, showLobby } from '../net/multiplayer';
import { renderLobby } from '../net/lobby';
import { renderLaneInd } from '../sim/ai';
import { dynPrepare, lineSave, setDynLevel } from '../sim/lines';
import { buildProfile } from '../sim/profile';
import { DRIVER_STATS } from '../teams/drivers';
import { TEAM_STATS } from '../teams/team-stats';
import { TEAMS, flag, teamLogo } from '../teams/teams';
import { buildTrack } from '../track/build';
import { buildSelectedTrack, raceTrackStarted } from '../track/active';
import { TRACKS } from '../track/circuits';
import { WX } from '../track/track';
import { CIRCUIT_PLACE, bindTrackMap, drawTrackMap, elevProfile, setMapData } from './circuit-map';
import { CIRCUIT_COLS, CIRCUIT_FLAG } from './circuits';
import { showToast, syncCtrlMenu, updatePads } from './controls';
import { fmt, updateLights } from './hud';
import { segInit, syncAllSegs } from './widgets';
import { WZ, wzHost, wzJoin } from './wizard';
/** summary card for one team: tagline, car bars in two columns, one line per driver (team step and lobby) */
export function teamCardHtml(team: number) {
  const t = TEAMS[team],
    st = TEAM_STATS[team];
  const R: [string, number, number, number][] = [
    ['Top Speed', st.top, 0.96, 1.06],
    ['Acceleration', st.acc, 0.97, 1.07],
    ['Braking', st.brk, 0.9, 1.4],
    ['Cornering', st.grip, 0.975, 1.035],
    ['Tyre Life', 2 - st.tyre, 0.8, 1.3],
    ['Durability', 2 - st.dur, 0.75, 1.2],
  ];
  // summary card: tagline, car bars in two columns, one line per driver
  let h = `<div class="tg"><b>${t.name}</b><span>${st.tag}</span></div><div class="bars">`;
  for (const [n, v, a, b] of R) {
    const p = Math.round(clamp((v - a) / (b - a), 0.06, 1) * 100);
    h += `<div class="sr"><span>${n}</span><div class="sb"><i style="width:${p}%;background:${t.col};box-shadow:inset -3px 0 ${t.acc}"></i></div></div>`;
  }
  h += `</div><div class="drvs">`;
  for (let d = 0; d < 2; d++)
    h += `<div class="drv">${flag(t.nat[d], 13)}<b>${t.drivers[d]}</b><span>${DRIVER_STATS[team][d].tag}</span></div>`;
  return h + '</div>';
}
const DYN_LV_NOTE = [
  'Classic: one fixed line, taken from the experts. The car is steered back to it and nothing is re-planned.',
  'Novice: a slower line with big reserves. Lifting holds your speed, so just lift before the bar; a late lift is forgiven.',
  'Intermediate: quicker, with a moderate reserve for late lifts and early gas.',
  'Cautious Expert: close to the limit. A small reserve only.',
  'Perfect Expert: the fastest possible line, skids included. No reserve at all: it needs exact timing.',
];
export function showTeamStats() {
  $('teamStats').innerHTML = teamCardHtml(opts.team);
}
export function startRace() {
  GS.PRACTICE = WZ.mode === 'practice';
  unlockAudio();
  $('menu').classList.add('hide');
  $('home').classList.add('hide');
  $('results').classList.add('hide');
  $('pause').classList.add('hide');
  buildSelectedTrack();
  setupRace(false);
  raceTrackStarted();
  ['tl', 'board', 'spd', 'btns'].forEach(id => $(id).classList.remove('hide'));
  updatePads();
  updateLights();
  setSfx(opts.sound);
  setMusic(opts.music);
  cheer(0.5);
  showToast(
    GS.PRACTICE
      ? 'Practice · ' + cars[GS.ctrl].name + ' — unlimited laps'
      : TEAMS[opts.team].name + ': ' + cars[GS.ctrl].name + ' & ' + cars[GS.mateIdx].name,
  );
}
export function toMenu() {
  $('yflag').classList.add('hide');
  ['pause', 'results'].forEach(id => $(id).classList.add('hide'));
  ['tl', 'board', 'spd', 'btns'].forEach(id => $(id).classList.add('hide'));
  $('lights').style.display = 'none';
  setupRace(true);
  updatePads();
  $('home').classList.remove('hide');
  $('menu').classList.add('hide');
}
export const backToLobby = () => {
  MP.phase = 'lobby';
  mpPresence();
  MP.room && MP.room.presence({ me: null, ai: null, start: null, grid: null }).catch(() => {});
  ['tl', 'board', 'spd', 'btns'].forEach(id => $(id).classList.add('hide'));
  $('yflag').classList.add('hide');
  $('lights').style.display = 'none';
  setupRace(true);
  showLobby();
};
// ---- circuit picker (map first, ‹ › to change circuit): one set of elements, moved between the
// single-player wizard and the multiplayer lobby. In the lobby only the host can change the circuit.
const inLobby = () => !!MP.room && MP.phase === 'lobby';
export function placeCircuitPicker(slotId: string) {
  const el = $('circuitPicker'),
    slot = $(slotId);
  if (el.parentElement !== slot) slot.appendChild(el);
  const ro = inLobby() && !MP.host;
  el.classList.toggle('ro', ro);
  ['trkPrev', 'trkNext'].forEach(id => ($(id).disabled = ro));
  ([...$('trkFlags').children] as HTMLButtonElement[]).forEach(b => (b.disabled = ro));
  syncCircuit();
}
/** build circuit i only to read its map and numbers, then put back the circuit racing behind the menu */
function withPreview(i: number, fn: () => void) {
  if (GS.TR === TRACKS[i]) return fn();
  const save = { ...GS };
  buildTrack(TRACKS[i]);
  try {
    fn();
  } finally {
    for (const k of Object.keys(GS)) if (!(k in save)) delete GS[k];
    Object.assign(GS, save);
  }
}
export function syncCircuit() {
  withPreview(GS.trackIdx, syncCircuit0);
}
function syncCircuit0() {
  const t = TRACKS[GS.trackIdx];
  const best = store.get('best_' + t.id, 0);
  ([...$('trkFlags').children] as HTMLElement[]).forEach((b, i) =>
    b.classList.toggle('sel', i === GS.trackIdx),
  );
  setMapData();
  $('trkMap').innerHTML = drawTrackMap();
  bindTrackMap();
  $('trkElev').innerHTML = elevProfile();
  let hmin = 1e9,
    hmax = -1e9;
  for (let i = 0; i < GS.N; i++) {
    hmin = Math.min(hmin, GS.HT[i]);
    hmax = Math.max(hmax, GS.HT[i]);
  }
  const cols = CIRCUIT_COLS[t.id] || [];
  $('trkInfo').innerHTML =
    `<div class="tname"><span class="cb">${cols.map(c => `<i style="background:${c}"></i>`).join('')}</span>${t.name}</div>` +
    `<div class="tplace">${CIRCUIT_PLACE[t.id] || ''}${t.night ? ' · Night' : ''}${t.street ? ' · Street' : ''}</div>`;
  const tiles: [string, string][] = [
    [(GS.L / 1000).toFixed(2) + ' km', 'Length'],
    [String(GS.CORNERS.length), 'Corners'],
    [String(GS.DRSZ.length), GS.DRSZ.length === 1 ? 'DRS Zone' : 'DRS Zones'],
    [best ? fmt(best) : Math.round(hmax - hmin) + ' m', best ? 'Your Best' : 'Climb'],
  ];
  $('trkStats').innerHTML = tiles.map(([v, k]) => `<div><b>${v}</b><span>${k}</span></div>`).join('');
}
/** show circuit i in the picker; the race behind the menu keeps running on its own circuit until a race starts */
export function showCircuit(i: number) {
  i = (i + TRACKS.length) % TRACKS.length;
  if (i === GS.trackIdx) return;
  GS.trackIdx = i;
  if (!inLobby() || MP.host) store.set('track', i);
  syncCircuit();
}
function pickCircuit(i: number) {
  if (inLobby() && !MP.host) return;
  showCircuit(i);
  if (inLobby()) {
    mpPresence();
    renderLobby();
  }
}
function initCircuitPicker() {
  // a row of host-nation flags at the top: jump straight to a circuit
  const row = $('trkFlags');
  TRACKS.forEach((t, i) => {
    const b = document.createElement('button');
    b.setAttribute('aria-label', t.name);
    b.title = t.name;
    b.innerHTML = flag(CIRCUIT_FLAG[t.id], 16);
    b.onclick = () => pickCircuit(i);
    row.appendChild(b);
  });
  $('trkPrev').onclick = () => pickCircuit(GS.trackIdx - 1);
  $('trkNext').onclick = () => pickCircuit(GS.trackIdx + 1);
  placeCircuitPicker('circuitSlot');
}
export function init(): void {
  initCircuitPicker();
  $('sTeam').addEventListener('click', () => setTimeout(showTeamStats, 0));
  showTeamStats();
  segInit('sPedals', 'pedals', Number);
  segInit('sSteer', 'steer', Number);
  $('sPedals').addEventListener('click', () => setTimeout(syncCtrlMenu, 0));
  $('sSteer').addEventListener('click', () => setTimeout(syncCtrlMenu, 0));
  syncCtrlMenu();
  segInit('sLaps', 'laps', Number);
  segInit('sDiff', 'diff', Number);
  segInit('sCam', 'cam', Number);
  segInit('sRain', 'rain', Number);
  $('sRain').addEventListener('click', () => {
    WX.rain = opts.rain;
    buildProfile();
  });
  segInit('sTyres', 'tyres', Number);
  segInit('sDmg', 'damage', Number);
  segInit('sYellow', 'yellow', Number);
  segInit('sLimits', 'limits', Number);
  segInit('sDRS', 'drs', Number);
  segInit('sTow', 'tow', Number);
  segInit('sTurns', 'turns', Number);
  $('sDRS').addEventListener('click', () => setTimeout(updatePads, 0));
  segInit('sLine', 'line', Number);
  segInit('sDyn', 'dynlv', Number);
  segInit('sGears', 'gears', Number);
  $('sGears').addEventListener('click', () => setTimeout(updatePads, 0));
  for (const [id, key, cast] of [
    ['pTurns', 'turns', Number],
    ['pTow', 'tow', Number],
    ['pDRSs', 'drs', Number],
    ['pGears', 'gears', Number],
    ['pPedals', 'pedals', Number],
    ['pSteer', 'steer', Number],
    ['pCam', 'cam', Number],
    ['pLine', 'line', Number],
    ['pDyn', 'dynlv', Number],
    ['pSnd', 'sound', v => v === '1'],
    ['pMus', 'music', v => v === '1'],
  ])
    segInit(id, key, cast);
  $('pause').addEventListener('click', e => {
    if (!(e.target as HTMLElement).closest('.seg')) return;
    setTimeout(() => {
      unlockAudio();
      setSfx(opts.sound);
      setMusic(opts.music);
      updatePads();
      syncCtrlMenu();
      renderLaneInd();
      syncAllSegs();
    }, 0);
  });
  // the Racing Line switch sets the choice for practice or for races, whichever is on
  for (const id of ['sLine', 'pLine'])
    $(id).addEventListener('click', e => {
      if ((e.target as HTMLElement).closest('button')) setTimeout(lineSave, 0);
    });
  // picking the line you follow (the buttons themselves are ordinary segmented controls on opts.dynlv)
  const dynLvSync = () => {
    $('dynLvNote').textContent = DYN_LV_NOTE[opts.dynlv];
  };
  for (const id of ['pDyn', 'sDyn'])
    $(id).addEventListener('click', e => {
      if (!(e.target as HTMLElement).closest('button')) return;
      setTimeout(() => {
        setDynLevel(opts.dynlv);
        dynLvSync();
        syncCtrlMenu();
      }, 0);
    });
  dynLvSync();
  // the lines depend on the car, the weather and the Opponents level
  for (const id of ['sTeam', 'sRain', 'sDiff'])
    $(id).addEventListener('click', () => setTimeout(dynPrepare, 0));
  segInit('sSnd', 'sound', v => v === '1');
  segInit('sMus', 'music', v => v === '1');
  $('sSnd').addEventListener('click', () =>
    setTimeout(() => {
      unlockAudio();
      setSfx(opts.sound);
    }, 0),
  );
  $('sMus').addEventListener('click', () =>
    setTimeout(() => {
      unlockAudio();
      setMusic(opts.music);
    }, 0),
  );
  {
    const el = $('sTeam');
    TEAMS.forEach((t, i) => {
      const b = document.createElement('button');
      b.dataset.v = String(i);
      const code = (n: string) => n.split(' ').pop().slice(0, 3).toUpperCase();
      b.innerHTML = `${teamLogo(i, 30)}<span class="tn">${t.name}</span><span class="tdc"><span>${flag(t.nat[0], 12)}${code(t.drivers[0])}</span><span>${flag(t.nat[1], 12)}${code(t.drivers[1])}</span></span>`;
      el.appendChild(b);
    });
    segInit('sTeam', 'team', Number);
  }
  $('bStart').onclick = () => (WZ.mode === 'host' ? wzHost() : WZ.mode === 'join' ? wzJoin() : startRace());
  $('bAgain').onclick = () => (mpOn() ? backToLobby() : startRace());
  $('bRestart').onclick = () => (mpOn() ? backToLobby() : startRace());
  $('bQuit').onclick = () => (mpOn() ? leaveRoom() : toMenu());
  $('bQuit2').onclick = () => (mpOn() ? leaveRoom() : toMenu());
}
