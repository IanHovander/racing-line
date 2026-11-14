import { GS } from '../state';
import { AC, sfxG } from '../audio/audio';
import { $, clamp, isTouch, store } from '../core/dom';
import { attract, cars, opts } from '../game/race';
import { mpOn } from '../net/multiplayer';
import { cam } from '../render/camera';
import { renderLaneInd } from '../sim/ai';
import { GEARTOP, autoGear, isManual } from '../sim/car-model';
import { syncAllSegs } from './widgets';
export const PEDALS = ['Throttle only', 'Brake only', 'Throttle + Brake', 'Auto pedals'], STEERS = ['Auto steering', 'Lane steering', 'Manual steering', 'Overtake steering'];
export const PED_NOTE = ['Hold the gas; lift off and the car brakes to the safe speed for the next corner.', 'The car accelerates by itself; you choose when and how long to brake.', 'You control both the gas and the brake.', 'The car handles the gas and the brake for you, driving to the limit of the racing line.'];
export const STEER_NOTE = ['The car follows the racing line and steers around traffic.', 'Tap left/right to choose the left side, the racing line or the right side.', 'You steer: hold left/right.', 'The car follows the racing line and sits behind the car ahead. Tap left or right to pass on that side; it rejoins the line once you are clear.'];
// race-control banner: warning (white block, chequered-diagonal track-limits flag) or penalty (orange block, stopwatch)
export const RC_ICON = { warn: '<svg viewBox="0 0 24 24"><path d="M5 2v20" stroke="#111" stroke-width="2"/><path d="M6 3h14v11H6z" fill="#fff" stroke="#111" stroke-width="1.4"/><path d="M6 14L20 3v11z" fill="#111"/></svg>',
  pen: '<svg viewBox="0 0 24 24" fill="none" stroke="#111" stroke-width="2.2" stroke-linecap="round"><circle cx="12" cy="14" r="7.5"/><path d="M12 14V9.5M9.5 2.8h5M12 3v3.5M18.2 7.2l1.6-1.6"/></svg>' };
/** pending hide timers for the toast and race-control banner */
const UI_T: {
  rc?: ReturnType<typeof setTimeout>;
  toast?: ReturnType<typeof setTimeout>;
} = {};
export function rcBanner(type, title, sub) {
  const el = $('rcb');
  el.className = type;
  el.querySelector('.k').innerHTML = RC_ICON[type];
  el.querySelector('.v').innerHTML = `<b>${title}</b><span>${sub}</span>`;
  void el.offsetWidth;
  el.classList.add('on');
  clearTimeout(UI_T.rc);
  UI_T.rc = setTimeout(() => el.classList.remove('on'), 3800);
}
export function showToast(t) { const el = $('toast'); el.textContent = t; el.style.opacity = '1'; clearTimeout(UI_T.toast); UI_T.toast = setTimeout(() => el.style.opacity = '0', 1500); }
// single player only: time nearly stops while the camera pans over to the other car
GS.SWAP = null;
export function swapCar() {
  if (attract || mpOn() || GS.mateIdx < 0 || cars[GS.mateIdx].out || cars[GS.mateIdx].gone)
    return;
  cars[GS.mateIdx].gear = autoGear(cars[GS.mateIdx].v);
  if (GS.state === 'race' || GS.state === 'countdown') {
    const o = cars[GS.mateIdx], d = Math.hypot(o.x - cam.x, o.y - cam.y);
    GS.SWAP = { t: 0, dur: clamp(0.6 + d / 400, 0.7, 1.6), from: [cam.x, cam.y, cam.z, cam.a, cam.zoom] };
  }
  const t = GS.ctrl;
  GS.ctrl = GS.mateIdx;
  GS.mateIdx = t;
  const c = cars[GS.ctrl];
  c.lane = 0;
  showToast('Now driving: ' + c.name);
  updatePads();
}
export function sfxShift(d) { try {
  if (!AC || !sfxG || !opts.sound)
    return;
  const t = AC.currentTime;
  const o = AC.createOscillator();
  o.type = 'square';
  o.frequency.setValueAtTime(d > 0 ? 230 : 150, t);
  o.frequency.exponentialRampToValueAtTime(d > 0 ? 120 : 260, t + 0.08);
  const g = AC.createGain();
  g.gain.setValueAtTime(0.06, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + 0.1);
  o.connect(g);
  g.connect(sfxG);
  o.start(t);
  o.stop(t + 0.12);
}
catch (e) { } }
export function shift(d) {
  if (!isManual(cars[GS.ctrl] || {}) || GS.state === 'paused')
    return;
  const c = cars[GS.ctrl];
  const g = clamp(c.gear + d, 1, 8);
  if (g === c.gear)
    return;
  if (d < 0 && c.v > GEARTOP[g] * 0.99) {
    showToast('Too fast for gear ' + g);
    return;
  }
  c.gear = g;
  c.shiftT = 0.12;
  if (typeof sfxShift === 'function')
    sfxShift(d);
}
export function cycleMode() { opts.pedals = (opts.pedals + 1) % 4; store.set('pedals', opts.pedals); showToast(PEDALS[opts.pedals]); updatePads(); syncCtrlMenu(); }
export function cycleSteer() { opts.steer = (opts.steer + 1) % 4; store.set('steer', opts.steer); showToast(STEERS[opts.steer]); updatePads(); syncCtrlMenu(); }
export function syncCtrlMenu() { ([...$('sPedals').children] as HTMLElement[]).forEach(b => b.classList.toggle('sel', +b.dataset.v === opts.pedals)); ([...$('sSteer').children] as HTMLElement[]).forEach(b => b.classList.toggle('sel', +b.dataset.v === opts.steer)); $('pedNote').textContent = PED_NOTE[opts.pedals]; $('steerNote').textContent = STEER_NOTE[opts.steer]; }
export function toggleCam() { opts.cam = 1 - opts.cam; store.set('cam', opts.cam); showToast(opts.cam ? 'Isometric camera' : 'Chase camera'); }
export function toggleLine() { opts.line = !opts.line; store.set('line', opts.line); showToast(opts.line ? 'Racing line on' : 'Racing line off'); }
export function resetCar() { if (attract)
  return; if (mpOn() && !$('pause').classList.contains('hide'))
  $('pause').classList.add('hide'); const c = cars[GS.ctrl]; const i = c.idx; c.x = GS.rx[i]; c.y = GS.ry[i]; c.h = Math.atan2(GS.ty[i], GS.tx[i]); c.v = 0; c.lane = 0; if (GS.state === 'paused')
  togglePause(); }
export function togglePause() {
  if (mpOn() && (GS.state === 'race' || GS.state === 'countdown' || GS.state === 'finished')) {
    const p = $('pause');
    syncAllSegs();
    p.classList.toggle('hide');
    return;
  }
  if (GS.state === 'race' || GS.state === 'countdown') {
    pausedFrom = GS.state;
    GS.state = 'paused';
    syncAllSegs();
    $('pause').classList.remove('hide');
  }
  else if (GS.state === 'paused') {
    GS.state = pausedFrom;
    $('pause').classList.add('hide');
  }
}
export let pausedFrom = 'race';
export function updatePads() {
  const show = !attract && isTouch && (GS.state !== 'menu');
  $('bSwap').classList.toggle('hide', mpOn() || GS.PRACTICE || show);
  $('pSwap').classList.toggle('hide', !show || mpOn() || GS.PRACTICE);
  $('pThr').classList.toggle('hide', !show || opts.pedals === 1 || opts.pedals === 3);
  $('pBrk').classList.toggle('hide', !show || opts.pedals === 0 || opts.pedals === 3);
  $('pBrk').classList.toggle('solo', opts.pedals === 1);
  $('pThr').classList.toggle('big', opts.pedals === 0);
  $('pL').classList.toggle('hide', !show || opts.steer === 0);
  $('pUp').classList.toggle('hide', !show || opts.gears !== 1);
  $('pDRS').classList.toggle('hide', !show || opts.drs !== 1 || mpOn() && false);
  $('pDn').classList.toggle('hide', !show || opts.gears !== 1);
  $('pR').classList.toggle('hide', !show || opts.steer === 0);
  $('bMode').textContent = ['Pedals: Gas', 'Pedals: Brake', 'Pedals: Both', 'Pedals: Auto'][opts.pedals];
  $('bSteer').textContent = ['Steer: Auto', 'Steer: Lanes', 'Steer: Manual', 'Steer: Overtake'][opts.steer];
  $('laneInd').classList.toggle('hide', (opts.steer !== 1 && opts.steer !== 3) || attract);
  renderLaneInd();
}
/** debug/test hook: reassign a module-level binding */
export function __set(name: string, v: any): void {
  switch (name) {
    case 'pausedFrom':
      pausedFrom = v;
      break;
  }
}
