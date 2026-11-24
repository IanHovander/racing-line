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
import { PASS_TUNE, PASS_UI, passCommit, passSlide, passTap } from '../sim/pass';
import { passLatDir } from '../ui/pass-hud';
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
let passHeld = false;
/**
 * Passing gestures on the GAS pad, which keeps the pointer while it is held (Auto steering, sim/pass.ts). The thumb's
 * movement is read across your car's direction of travel as drawn on the screen (passLatDir), so dragging or flicking
 * towards where you want the car works whichever way it is heading. slide: the thumb's travel moves the car across the
 * road; swipe: a flick passes on that side; tap: sliding the thumb up onto PASS passes.
 */
function gasGestures(el: HTMLElement): void {
  let x0 = 0,
    y0 = 0,
    lastX = 0,
    lastY = 0,
    sliding = false,
    upDone = false;
  el.addEventListener('pointerdown', e => {
    x0 = lastX = e.clientX;
    y0 = lastY = e.clientY;
    sliding = upDone = false;
  });
  el.addEventListener('pointermove', e => {
    if (opts.steer !== 0 || !el.classList.contains('on')) return;
    // movement across your car's direction of travel as drawn on the screen (towards its right is positive)
    const [ux, uy] = passLatDir();
    const dx = e.clientX - x0,
      dy = e.clientY - y0,
      across = dx * ux + dy * uy,
      along = Math.abs(-dx * uy + dy * ux);
    if (PASS_UI === 'slide') {
      if (!sliding) {
        if (Math.abs(across) < PASS_TUNE.dead) return;
        sliding = true;
        lastX = e.clientX - ux * Math.sign(across) * (Math.abs(across) - PASS_TUNE.dead);
        lastY = e.clientY - uy * Math.sign(across) * (Math.abs(across) - PASS_TUNE.dead);
      }
      passSlide(((e.clientX - lastX) * ux + (e.clientY - lastY) * uy) / PASS_TUNE.span);
      lastX = e.clientX;
      lastY = e.clientY;
    } else if (PASS_UI === 'swipe') {
      if (Math.abs(across) > PASS_TUNE.flick && Math.abs(across) > 0.8 * along) {
        passCommit(Math.sign(across));
        x0 = e.clientX; // a further flick the other way counts from here
        y0 = e.clientY;
      }
    } else if (!upDone) {
      const p = $('pPass');
      if (p.classList.contains('hide')) return;
      const r = p.getBoundingClientRect();
      if (
        e.clientY < r.bottom + 2 &&
        e.clientY > r.top - 30 &&
        e.clientX > r.left - 16 &&
        e.clientX < r.right + 16
      ) {
        upDone = true;
        passTap();
        p.classList.add('on');
        setTimeout(() => p.classList.remove('on'), 160);
      }
    }
  });
}
export function init(): void {
  addEventListener('keydown', e => {
    if (typing(e)) return;
    if (opts.steer === 1 && !e.repeat && (KEYMAP[e.code] === 'left' || KEYMAP[e.code] === 'right'))
      laneShift(KEYMAP[e.code] === 'left' ? -1 : 1);
    if (opts.steer === 3 && !e.repeat && (KEYMAP[e.code] === 'left' || KEYMAP[e.code] === 'right'))
      passPick(KEYMAP[e.code] === 'left' ? -1 : 1);
    // Auto steering: ← / → pass on that side (swipe, tap); slide reads the held keys (sim/pass.ts)
    if (
      opts.steer === 0 &&
      !e.repeat &&
      PASS_UI !== 'slide' &&
      (KEYMAP[e.code] === 'left' || KEYMAP[e.code] === 'right')
    )
      passCommit(KEYMAP[e.code] === 'left' ? -1 : 1, 'key');
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
    if (k === 'pass') {
      // PASS (tap passing): go now; it is also the gas while it is held
      const up = () => {
        passHeld = false;
        input.thr = $('pThr').classList.contains('on');
        el.classList.remove('on');
      };
      el.addEventListener('pointerdown', e => {
        e.preventDefault();
        e.stopPropagation();
        passTap();
        passHeld = true;
        input.thr = true;
        el.classList.add('on');
        try {
          el.setPointerCapture(e.pointerId);
        } catch (_) {}
      });
      el.addEventListener('pointerup', up);
      el.addEventListener('pointercancel', up);
      el.addEventListener('lostpointercapture', up);
      return;
    }
    if (k === 'thr') gasGestures(el);
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
      input[k] = k === 'thr' ? passHeld : false;
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
