import { GS } from '../state';
import { setMusic, setSfx, unlockAudio } from '../audio/audio';
import { cheer } from '../audio/crowd';
import { $, clamp, isTouch, store } from '../core/dom';
import { cars, opts, setupRace } from '../game/race';
import { MP, leaveRoom, mpOn, mpPresence, showLobby } from '../net/multiplayer';
import { renderLaneInd } from '../sim/ai';
import { buildProfile } from '../sim/profile';
import { DRIVER_STATS } from '../teams/drivers';
import { TEAM_STATS } from '../teams/team-stats';
import { TEAMS, flag, teamLogo } from '../teams/teams';
import { buildTrack } from '../track/build';
import { TRACKS } from '../track/circuits';
import { WX } from '../track/track';
import { CIRCUIT_PLACE, bindTrackMap, drawTrackMap } from './circuit-map';
import { showToast, syncCtrlMenu, updatePads } from './controls';
import { fmt, updateLights } from './hud';
import { POSTERS } from './posters';
import { segInit, syncAllSegs } from './widgets';
import { WZ, wzHost, wzJoin } from './wizard';
export function showTeamStats() {
  const t = TEAMS[opts.team],
    st = TEAM_STATS[opts.team];
  const R: [string, number, number, number][] = [
    ['Top Speed', st.top, 0.96, 1.06],
    ['Acceleration', st.acc, 0.97, 1.07],
    ['Braking', st.brk, 0.9, 1.4],
    ['Cornering', st.grip, 0.975, 1.035],
    ['Tyre Life', 2 - st.tyre, 0.8, 1.3],
    ['Durability', 2 - st.dur, 0.75, 1.2],
  ];
  let h = `<div class="tg" style="display:flex;gap:8px;align-items:center">${teamLogo(opts.team, 22)}<span><b>${t.name}</b> — ${st.tag}</span></div>`;
  for (const [n, v, a, b] of R) {
    const p = Math.round(clamp((v - a) / (b - a), 0.06, 1) * 100);
    h += `<div class="sr"><span>${n}</span><div class="sb"><i style="width:${p}%;background:${t.col};box-shadow:inset -3px 0 ${t.acc}"></i></div></div>`;
  }
  h += `<div class="drvs">`;
  for (let d = 0; d < 2; d++) {
    const ds = DRIVER_STATS[opts.team][d];
    h += `<div class="drv"><b>${flag(t.nat[d], 11)} ${t.drivers[d]}</b><div class="dtag">${ds.tag}</div>`;
    for (const [n, k] of [
      ['Pace', 'pace'],
      ['Aggression', 'aggr'],
      ['Defending', 'defend'],
      ['Consistency', 'consist'],
      ['Wet', 'wet'],
      ['Tyre Care', 'tyre'],
    ])
      h += `<div class="sr"><span>${n}</span><div class="sb"><i style="width:${Math.round(ds[k] * 100)}%;background:${t.acc}"></i></div></div>`;
    h += `</div>`;
  }
  h += `</div>`;
  $('teamStats').innerHTML = h;
}
export function startRace() {
  GS.PRACTICE = WZ.mode === 'practice';
  unlockAudio();
  $('menu').classList.add('hide');
  $('home').classList.add('hide');
  $('results').classList.add('hide');
  $('pause').classList.add('hide');
  setupRace(false);
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
export function init(): void {
  {
    const el = $('sTrack');
    TRACKS.forEach((t, i) => {
      const b = document.createElement('button');
      b.dataset.v = String(i);
      b.innerHTML = `<span class="pst">${POSTERS[t.id] || ''}</span>`;
      b.title = t.name;
      b.setAttribute('aria-label', t.name);
      el.appendChild(b);
    });
    const sync = () => {
      ([...el.children] as HTMLElement[]).forEach((b, i) => b.classList.toggle('sel', i === GS.trackIdx));
      const t = TRACKS[GS.trackIdx];
      const best = store.get('best_' + t.id, 0);
      $('trkMap').innerHTML = drawTrackMap();
      bindTrackMap();
      {
        let hmin = 1e9,
          hmax = -1e9;
        for (let i = 0; i < GS.N; i++) {
          hmin = Math.min(hmin, GS.HT[i]);
          hmax = Math.max(hmax, GS.HT[i]);
        }
        $('trkInfo').innerHTML =
          `<div class="tname">${t.name} <span>${CIRCUIT_PLACE[t.id] || ''}</span></div><div class="tdesc">${t.sub}</div><div class="tstats">${(GS.L / 1000).toFixed(2)} km · ${GS.CORNERS.length} corners · ${GS.DRSZ.length} DRS zone${GS.DRSZ.length === 1 ? '' : 's'} · ${Math.round(hmax - hmin)} m elevation${t.night ? ' · night race' : ''}${t.street ? ' · street circuit' : ''}${best ? ' · <b>Your best ' + fmt(best) + '</b>' : ''}</div>`;
      }
    };
    el.addEventListener('click', e => {
      const b = (e.target as HTMLElement).closest('button');
      if (!b) return;
      const i = +b.dataset.v;
      if (i === GS.trackIdx) return;
      GS.trackIdx = i;
      store.set('track', i);
      buildTrack(TRACKS[i]);
      setupRace(true);
      sync();
    });
    sync();
  }
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
  segInit('sLine', 'line', v => v === '1');
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
    ['pLine', 'line', v => v === '1'],
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
      b.innerHTML = `${teamLogo(i, 34)}<span><div class="tn">${t.name}</div><div class="td">${flag(t.nat[0], 10)} ${t.drivers[0]}</div><div class="td">${flag(t.nat[1], 10)} ${t.drivers[1]}</div></span>`;
      el.appendChild(b);
    });
    segInit('sTeam', 'team', Number);
  }
  $('helpTxt').innerHTML = isTouch
    ? '<b>Touch:</b> GAS and BRAKE buttons on the right, ◀ ▶ on the left for Lanes or Manual steering. The Swap button switches between your two cars; pedals, steering, camera and sound are set here in the menu.<br>Watch the red braking zones on the racing line — overcook a corner and you run wide.'
    : '<b>Keys:</b> ↑/W/Space gas · ↓/S brake · ←→/A D steer or change lane · <b>Tab/C swap to teammate</b> · R reset car · P/Esc pause<br>Throttle only: lift before the red braking zones and the car brakes itself — stay flat too long and you run wide.';
  $('bStart').onclick = () => (WZ.mode === 'host' ? wzHost() : WZ.mode === 'join' ? wzJoin() : startRace());
  $('bAgain').onclick = () => (mpOn() ? backToLobby() : startRace());
  $('bRestart').onclick = () => (mpOn() ? backToLobby() : startRace());
  $('bQuit').onclick = () => (mpOn() ? leaveRoom() : toMenu());
  $('bQuit2').onclick = () => (mpOn() ? leaveRoom() : toMenu());
}
