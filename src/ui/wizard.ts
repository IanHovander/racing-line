import { GS } from '../state';
import { lineLoad } from '../sim/lines';
import { setMusic, setSfx, unlockAudio } from '../audio/audio';
import { $, clamp, store } from '../core/dom';
import { opts } from '../game/race';
import { placeCircuitPicker } from './menu';
import {
  ARTIFACT_URL,
  MP,
  enterRoom,
  leaveRoom,
  mpCode,
  mpPresence,
  mpWarm,
  normCode,
  commitName,
} from '../net/multiplayer';
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
  lineLoad(); // the Racing Line setting shows the choice for practice or for races
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
  mpWarm(); // a join is coming: connect to the matchmaking server while the code is typed
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
  const nick = $('nick') as HTMLInputElement;
  // The name is taken from the box on every kind of edit, not only on "input": autofill and some phone keyboards
  // fill a box without that event, and the name was then shown but never saved.
  const commit = () => {
    if (commitName()) mpPresence();
  };
  for (const ev of ['input', 'change', 'keyup', 'compositionend']) nick.addEventListener(ev, commit);
  nick.addEventListener('blur', () => {
    commit();
    nick.value = GS.NICK; // (an empty box keeps the name until a new one is typed)
  });
  addEventListener('pagehide', commit);
  nick.addEventListener('keydown', e => {
    if (e.key === 'Enter') nick.blur();
  });
  // text boxes with a clear button (.clrX): one tap empties the box and leaves the keyboard up for the new text
  document.querySelectorAll<HTMLButtonElement>('.clrX').forEach(b => {
    const box = $(b.dataset.for) as HTMLInputElement;
    b.addEventListener('pointerdown', e => e.preventDefault()); // do not take the focus from the box
    b.onclick = () => {
      box.value = '';
      box.focus();
      box.dispatchEvent(new Event('input', { bubbles: true }));
    };
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
