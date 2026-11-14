// Main screen: the attract-mode race runs behind the logo, with two big buttons.
// Single player and Multiplayer each open the setup wizard as a panel (a bottom sheet on phones);
// the gear opens the same panel with just the driving and display settings.
import { GS } from '../state';
import { $ } from '../core/dom';
import { opts } from '../game/race';
import { TRACKS } from '../track/circuits';
import { standings } from '../sim/step';
import { setMusic, setSfx, unlockAudio } from '../audio/audio';
import { SEG_SYNC, syncAllSegs } from './widgets';
import { WZ, wzGo } from './wizard';
import { normCode, enterRoom } from '../net/multiplayer';
import { showToast } from './controls';

export type PanelGroup = 'solo' | 'mp' | 'prefs';

const TITLES: Record<PanelGroup, string> = { solo: 'Single player', mp: 'Multiplayer', prefs: 'Settings' };

export function showHome(): void {
  $('home').classList.remove('hide');
  $('menu').classList.add('hide');
  updateLive();
}

export function hideHome(): void {
  $('home').classList.add('hide');
  $('menu').classList.add('hide');
}

export function panelOpen(): boolean {
  return !$('menu').classList.contains('hide');
}

export function openPanel(group: PanelGroup): void {
  unlockAudio();
  WZ.group = group;
  if (group === 'solo' && WZ.mode !== 'solo' && WZ.mode !== 'practice') WZ.mode = 'solo';
  $('pnlTitle').textContent = TITLES[group];
  const menu = $('menu');
  menu.dataset.group = group;
  menu.classList.remove('hide');
  WZ.max = group === 'solo' ? Math.max(WZ.max, 0) : 0;
  wzGo(group === 'prefs' ? 3 : 0);
  syncAllSegs();
}

export function closePanel(): void {
  $('menu').classList.add('hide');
}

/** "LIVE · Ardennes Forest · lap 3" under the buttons, for the race running behind the menu */
function updateLive(): void {
  const el = $('hLive');
  if (!el || $('home').classList.contains('hide')) return;
  const lead = standings()[0];
  const lap = lead ? Math.max(1, lead.cross) : 1;
  el.textContent = `LIVE · ${TRACKS[GS.trackIdx].name} · lap ${lap}`;
}

function syncSound(): void {
  const on = !!(opts.music || opts.sound);
  $('hSnd').classList.toggle('off', !on);
  $('hSnd').setAttribute('aria-label', on ? 'Mute sound and music' : 'Turn on sound and music');
}

export function init(): void {
  $('hSolo').onclick = () => openPanel('solo');
  $('hMulti').onclick = () => openPanel('mp');
  $('hPrefs').onclick = () => openPanel('prefs');
  $('pnlClose').onclick = closePanel;
  $('wzDone').onclick = closePanel;
  // tap the dimmed area around the panel to close it
  $('menu').addEventListener('click', (e: MouseEvent) => {
    if (e.target === $('menu')) closePanel();
  });
  $('hSnd').onclick = () => {
    unlockAudio();
    const on = !(opts.music || opts.sound);
    setMusic(on);
    setSfx(on);
    syncAllSegs();
  };
  SEG_SYNC.push(syncSound);
  syncSound();
  // join a room straight from the Multiplayer panel
  const join = () => {
    unlockAudio();
    const c = normCode($('joinCode2').value);
    if (!c) {
      showToast('Room codes are 5 letters and numbers, like AB3K9');
      return;
    }
    enterRoom(c, false);
  };
  $('bJoin2').onclick = join;
  $('joinCode2').addEventListener('keydown', (e: KeyboardEvent) => {
    if (e.key === 'Enter') join();
  });
  setInterval(updateLive, 500);
  showHome();
}
