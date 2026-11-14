import { GS } from '../state';
import { setMusic, setSfx, unlockAudio } from '../audio/audio';
import { $, clamp, store } from '../core/dom';
import { opts } from '../game/race';
import { placeCircuitPicker } from './menu';
import { ARTIFACT_URL, MP, enterRoom, leaveRoom, mpCode, mpPresence, normCode } from '../net/multiplayer';
import { hostStart } from '../net/netcode';
import {
  cycleMode,
  cycleSteer,
  resetCar,
  showToast,
  swapCar,
  toggleCam,
  toggleLine,
  togglePause,
} from './controls';
// ---- menu wizard: Mode -> Team -> Circuit -> Settings ----
export let WZ: any;
export function wzSteps() {
  return WZ.group === 'mp' ? [0] : WZ.group === 'prefs' ? [3] : [0, 1, 2, 3];
}
export function wzGo(n) {
  WZ.s = n;
  WZ.max = Math.max(WZ.max, n);
  const st = wzSteps();
  document
    .querySelectorAll<HTMLElement>('#menu .wz')
    .forEach(d => d.classList.toggle('on', +d.dataset.s === n));
  document.querySelectorAll<HTMLButtonElement>('#wzNav button').forEach(b => {
    const k = +b.dataset.s,
      inF = st.includes(k);
    b.style.display = inF ? '' : 'none';
    b.classList.toggle('cur', k === n);
    b.classList.toggle('done', k < n || (k <= WZ.max && k !== n));
    b.disabled = k > WZ.max;
  });
  {
    let k = 1;
    document.querySelectorAll<HTMLElement>('#wzNav button').forEach(b => {
      if (b.style.display !== 'none') b.querySelector('i').textContent = String(k++);
    });
  }
  // keep the chosen session type marked when coming back to the first step
  $('bSolo').classList.toggle('sel', WZ.picked && WZ.mode === 'solo');
  $('bPrac').classList.toggle('sel', WZ.picked && WZ.mode === 'practice');
  // which panel: Single player (session, team, circuit, settings), Multiplayer (host or join), or Settings (driving + display only)
  const g = WZ.group || 'solo',
    prefs = g === 'prefs';
  document
    .querySelectorAll<HTMLElement>('#sMode .g-solo')
    .forEach(e => (e.style.display = g === 'solo' ? '' : 'none'));
  document
    .querySelectorAll<HTMLElement>('#sMode .g-mp')
    .forEach(e => (e.style.display = g === 'mp' ? '' : 'none'));
  $('mpNote').style.display = g === 'mp' ? '' : 'none';
  $('wzNav').style.display = g === 'solo' ? '' : 'none';
  document
    .querySelectorAll<HTMLElement>('#menu .wz[data-s="3"] .sect')
    .forEach(
      e => (e.style.display = prefs && (e.dataset.grp === 'race' || e.dataset.grp === 'rules') ? 'none' : ''),
    );
  // title with a breadcrumb once the session type is picked: "Single Player › Practice"
  $('pnlTitle').innerHTML =
    g === 'solo'
      ? 'Single Player' +
        (WZ.picked
          ? `<span class="crumb">›</span><span class="crumb2">${WZ.mode === 'practice' ? 'Practice' : 'Race'}</span>`
          : '')
      : g === 'mp'
        ? 'Multiplayer'
        : 'Settings';
  $('wzBar').style.display = g === 'mp' ? 'none' : '';
  const last = n === 3;
  $('helpTxt').style.display = last && !prefs ? '' : 'none';
  $('wzBack').style.visibility = n === 0 ? 'hidden' : 'visible';
  $('wzBack').style.display = prefs ? 'none' : '';
  $('wzNext').style.display = last || n === 0 ? 'none' : '';
  $('bStart').style.display = last && !prefs ? '' : 'none';
  $('wzDone').style.display = prefs ? '' : 'none';
  $('bStart').textContent =
    WZ.mode === 'host'
      ? 'HOST RACE'
      : WZ.mode === 'join'
        ? 'JOIN RACE'
        : WZ.mode === 'practice'
          ? 'START PRACTICE'
          : 'START RACE';
  if (n === 2) placeCircuitPicker('circuitSlot');
  const c = $('menu');
  c.scrollTop = 0;
  const cd = c.querySelector('.card');
  if (cd) cd.scrollTop = 0;
}
export const wzStep = d => {
  const st = wzSteps(),
    i = st.indexOf(WZ.s);
  wzGo(st[clamp(i + d, 0, st.length - 1)]);
};
export const wzMode = m => {
  if (m === 'host') {
    wzHost();
    return;
  }
  if (m === 'join') {
    wzJoin();
    return;
  }
  if (WZ.mode !== m) WZ.max = 0;
  WZ.mode = m;
  WZ.picked = true;
  store.set('wzmode', m);
  wzGo(1);
};
export const wzHost = () => {
  unlockAudio();
  enterRoom(mpCode(), true);
};
export const wzJoin = () => {
  $('menu').classList.add('hide');
  $('home').classList.add('hide');
  $('joinDlg').classList.remove('hide');
  $('joinCode').focus();
};
export function init(): void {
  WZ = { s: 0, mode: store.get('wzmode', 'solo'), max: 0, group: 'solo' };
  $('bSolo').onclick = () => wzMode('solo');
  $('bPrac').onclick = () => wzMode('practice');
  $('bHost').onclick = () => wzMode('host');
  $('bJoin').onclick = () => wzMode('join');
  $('wzBack').onclick = () => wzStep(-1);
  $('wzNext').onclick = () => wzStep(1);
  $('wzNav').onclick = e => {
    const b = (e.target as HTMLElement).closest('button');
    if (b && !b.disabled) wzGo(+b.dataset.s);
  };
  if (!['solo', 'practice'].includes(WZ.mode)) WZ.mode = 'solo';
  wzGo(0);
  $('bJoinCancel').onclick = () => {
    $('joinDlg').classList.add('hide');
    $('home').classList.remove('hide');
  };
  $('bJoinGo').onclick = () => {
    unlockAudio();
    const c = normCode($('joinCode').value);
    if (!c) {
      showToast('Room codes are 5 letters and numbers, like AB3K9');
      return;
    }
    enterRoom(c, false);
  };
  $('bLbStart').onclick = hostStart;
  $('bLbClose').onclick = () => leaveRoom();
  $('bCopy').onclick = () => {
    const t = ARTIFACT_URL + '#' + MP.code;
    try {
      navigator.clipboard.writeText(t).then(
        () => showToast('Invite link copied'),
        () => showToast('Copy failed — select the link below'),
      );
    } catch (e) {
      showToast('Copy failed — select the link below');
    }
  };
  $('nick').addEventListener('input', e => {
    GS.NICK = (e.target as HTMLInputElement).value.replace(/[^\p{L}\p{N} ._-]/gu, '').slice(0, 16) || GS.NICK;
    store.set('nick', GS.NICK);
    mpPresence();
  });
  $('bResume').onclick = togglePause;
  $('bReset').onclick = resetCar;
  $('bPause').onclick = togglePause;
  $('bSwap').onclick = swapCar;
  $('pSwap').addEventListener('pointerdown', e => {
    e.preventDefault();
    e.stopPropagation();
    swapCar();
    $('pSwap').classList.add('on');
    setTimeout(() => $('pSwap').classList.remove('on'), 180);
  });
  $('bMode').onclick = cycleMode;
  $('bSteer').onclick = cycleSteer;
  $('bCam').onclick = toggleCam;
  $('bLine').onclick = toggleLine;
  $('bSnd').onclick = () => {
    unlockAudio();
    setSfx(!opts.sound);
  };
  $('bMus').onclick = () => {
    unlockAudio();
    setMusic(!opts.music);
  };
  $('bAudio').onclick = () => {
    unlockAudio();
  };
  document
    .querySelectorAll<HTMLElement>('#btns button')
    .forEach(b => b.addEventListener('pointerdown', e => e.stopPropagation()));
}
/** debug/test hook: reassign a module-level binding */
export function __set(name: string, v: any): void {
  switch (name) {
    case 'WZ':
      WZ = v;
      break;
  }
}
