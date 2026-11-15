import { cycleDyn } from '../sim/lines';
import { GS } from '../state';
import { audioStatus } from '../audio/audio';
import { attract, cars, opts } from '../game/race';
import { mpOn } from '../net/multiplayer';
import { laneShift, passPick } from '../sim/ai';
import { resetCar, sfxShift, shift, swapCar, toggleLine, togglePause } from '../ui/controls';
import { startRace } from '../ui/menu';
import { $ } from '../core/dom';
import { WZ } from '../ui/wizard';
// ================= Input =================
export const input = { thr: false, left: false, right: false };
export function pressDRS() {
  const c = cars[GS.ctrl];
  if (!c || attract || opts.drs !== 1 || GS.state !== 'race') return;
  if (GS.DRSMAP[c.idx] >= 0 && c.drsEl === GS.DRSMAP[c.idx] && !c.drs) {
    c.drs = true;
    if (typeof sfxShift === 'function') sfxShift(1);
  }
}
export const SHIFTKEYS = { KeyE: 1, KeyX: 1, ShiftRight: 1, KeyQ: -1, KeyZ: -1, ControlRight: -1 };
export const KEYMAP = {
  ArrowUp: 'thr',
  KeyW: 'thr',
  Space: 'thr',
  ArrowLeft: 'left',
  KeyA: 'left',
  ArrowRight: 'right',
  KeyD: 'right',
};
// typing in a text box (name, room code) must not drive the car or trigger shortcuts
export const typing = e => {
  const t = e.target;
  return !!t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable);
};
export function init(): void {
  addEventListener('keydown', e => {
    if (typing(e)) return;
    if (opts.steer === 1 && !e.repeat && (KEYMAP[e.code] === 'left' || KEYMAP[e.code] === 'right'))
      laneShift(KEYMAP[e.code] === 'left' ? -1 : 1);
    if (opts.steer === 3 && !e.repeat && (KEYMAP[e.code] === 'left' || KEYMAP[e.code] === 'right'))
      passPick(KEYMAP[e.code] === 'left' ? -1 : 1);
    if (KEYMAP[e.code]) {
      input[KEYMAP[e.code]] = true;
      e.preventDefault();
      return;
    }
    if (e.repeat) return;
    if (e.code === 'Tab' || e.code === 'KeyC') {
      e.preventDefault();
      swapCar();
    } else if (e.code === 'KeyR') resetCar();
    else if (e.code === 'KeyL' && GS.state !== 'menu') cycleDyn(); // the line you follow
    else if (e.code === 'KeyH' && GS.state !== 'menu') toggleLine(); // the line on screen
    else if (e.code === 'Escape' && GS.state === 'menu' && !$('menu').classList.contains('hide'))
      $('menu').classList.add('hide');
    else if (e.code === 'KeyP' || e.code === 'Escape') togglePause();
    else if (
      e.code === 'Enter' &&
      GS.state === 'menu' &&
      !$('menu').classList.contains('hide') &&
      WZ.group === 'solo' &&
      WZ.s === 3
    )
      startRace();
  });
  addEventListener('keyup', e => {
    if (typing(e)) return;
    if (KEYMAP[e.code]) {
      input[KEYMAP[e.code]] = false;
      e.preventDefault();
    }
  });
  addEventListener('blur', () => {
    for (const k in input) input[k] = false;
  });
  addEventListener('keydown', e => {
    if (typing(e)) return;
    if ((e.code === 'KeyF' || e.code === 'Enter') && !e.repeat && GS.state === 'race') {
      pressDRS();
    }
    const d = SHIFTKEYS[e.code];
    if (d && !e.repeat && (GS.state === 'race' || GS.state === 'countdown')) {
      shift(d);
      e.preventDefault();
    }
  });
  // iOS: stop long-press loupe / double-tap zoom on the touch pads
  document.querySelectorAll<HTMLElement>('.pad').forEach(el => {
    el.addEventListener('touchstart', e => e.preventDefault(), { passive: false });
    el.addEventListener('dblclick', e => e.preventDefault());
  });
  document.querySelectorAll<HTMLElement>('.pad').forEach(el => {
    const k = el.dataset.k;
    if (k === 'drs') {
      el.addEventListener('pointerdown', e => {
        e.preventDefault();
        e.stopPropagation();
        pressDRS();
      });
      return;
    }
    if (k === 'up' || k === 'dn') {
      el.addEventListener('pointerdown', e => {
        e.preventDefault();
        e.stopPropagation();
        shift(k === 'up' ? 1 : -1);
        el.classList.add('on');
        setTimeout(() => el.classList.remove('on'), 120);
      });
      return;
    }
    const on = e => {
      e.preventDefault();
      if (opts.steer === 1 && (k === 'left' || k === 'right')) laneShift(k === 'left' ? -1 : 1);
      if (opts.steer === 3 && (k === 'left' || k === 'right')) passPick(k === 'left' ? -1 : 1);
      input[k] = true;
      el.classList.add('on');
      try {
        el.setPointerCapture(e.pointerId);
      } catch (_) {}
    };
    const offf = e => {
      input[k] = false;
      el.classList.remove('on');
    };
    el.addEventListener('pointerdown', on);
    el.addEventListener('pointerup', offf);
    el.addEventListener('pointercancel', offf);
    el.addEventListener('lostpointercapture', offf);
  });
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) setTimeout(audioStatus, 500);
    if (document.hidden && !mpOn() && (GS.state === 'race' || GS.state === 'countdown')) togglePause();
  });
}
