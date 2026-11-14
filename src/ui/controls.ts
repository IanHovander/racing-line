import { GS } from '../state';
import { NCOL, notify } from './notify';
import { AC, sfxG } from '../audio/audio';
import { $, clamp, isTouch, store } from '../core/dom';
import { attract, cars, opts } from '../game/race';
import { mpOn } from '../net/multiplayer';
import { cam } from '../render/camera';
import { renderLaneInd } from '../sim/ai';
import { GEARTOP, autoGear, isManual } from '../sim/car-model';
import { syncAllSegs } from './widgets';
export const PEDALS = ['Throttle Only', 'Brake Only', 'Throttle + Brake', 'Auto Pedals'],
  STEERS = ['Auto Steering', 'Lane Steering', 'Manual Steering', 'Overtake Steering'];
export const PED_NOTE = [
  'Hold the gas; lift off and the car brakes to the safe speed for the next corner.',
  'The car accelerates by itself; you choose when and how long to brake.',
  'You control both the gas and the brake.',
  'The car handles the gas and the brake for you, driving to the limit of the racing line.',
];
export const STEER_NOTE = [
  'The car follows the racing line and steers around traffic.',
  'Tap left/right to choose the left side, the racing line or the right side.',
  'You steer: hold left/right.',
  'The car follows the racing line and sits behind the car ahead. Tap left or right to pass on that side; it rejoins the line once you are clear.',
];
/** race control: a track-limits / jump-start warning, or a time penalty */
export function rcBanner(type: 'warn' | 'pen', title: string, sub: string) {
  notify(title, type === 'pen' ? NCOL.pen : NCOL.warn, {
    sub,
    ttl: 4,
    key: 'rc',
    strong: type === 'pen',
    icon: type === 'pen' ? 'pen' : title.startsWith('Track limits') ? 'flag' : undefined,
  });
}
export function showToast(t: string) {
  notify(t);
}
// single player only: time nearly stops while the camera pans over to the other car
GS.SWAP = null;
export function swapCar() {
  if (attract || mpOn() || GS.mateIdx < 0 || cars[GS.mateIdx].out || cars[GS.mateIdx].gone) return;
  cars[GS.mateIdx].gear = autoGear(cars[GS.mateIdx].v);
  if (GS.state === 'race' || GS.state === 'countdown') {
    const o = cars[GS.mateIdx],
      d = Math.hypot(o.x - cam.x, o.y - cam.y);
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
export function sfxShift(d) {
  try {
    if (!AC || !sfxG || !opts.sound) return;
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
  } catch (e) {}
}
export function shift(d) {
  if (!isManual(cars[GS.ctrl] || {}) || GS.state === 'paused') return;
  const c = cars[GS.ctrl];
  const g = clamp(c.gear + d, 1, 8);
  if (g === c.gear) return;
  if (d < 0 && c.v > GEARTOP[g] * 0.99) {
    showToast('Too fast for gear ' + g);
    return;
  }
  c.gear = g;
  c.shiftT = 0.12;
  if (typeof sfxShift === 'function') sfxShift(d);
}
export function cycleMode() {
  opts.pedals = (opts.pedals + 1) % 4;
  store.set('pedals', opts.pedals);
  showToast(PEDALS[opts.pedals]);
  updatePads();
  syncCtrlMenu();
}
export function cycleSteer() {
  opts.steer = (opts.steer + 1) % 4;
  store.set('steer', opts.steer);
  showToast(STEERS[opts.steer]);
  updatePads();
  syncCtrlMenu();
}
export function syncCtrlMenu() {
  ([...$('sPedals').children] as HTMLElement[]).forEach(b =>
    b.classList.toggle('sel', +b.dataset.v === opts.pedals),
  );
  ([...$('sSteer').children] as HTMLElement[]).forEach(b =>
    b.classList.toggle('sel', +b.dataset.v === opts.steer),
  );
  $('pedNote').textContent = PED_NOTE[opts.pedals];
  $('steerNote').textContent = STEER_NOTE[opts.steer];
}
export function toggleCam() {
  opts.cam = 1 - opts.cam;
  store.set('cam', opts.cam);
  showToast(opts.cam ? 'Isometric camera' : 'Chase camera');
}
export function toggleLine() {
  opts.line = !opts.line;
  store.set('line', opts.line);
  showToast(opts.line ? 'Racing line on' : 'Racing line off');
}
export function resetCar() {
  if (attract) return;
  if (mpOn() && !$('pause').classList.contains('hide')) $('pause').classList.add('hide');
  const c = cars[GS.ctrl];
  const i = c.idx;
  c.x = GS.rx[i];
  c.y = GS.ry[i];
  c.h = Math.atan2(GS.ty[i], GS.tx[i]);
  c.v = 0;
  c.lane = 0;
  if (GS.state === 'paused') togglePause();
}
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
  } else if (GS.state === 'paused') {
    GS.state = pausedFrom;
    $('pause').classList.add('hide');
  }
}
export let pausedFrom = 'race';
export function updatePads() {
  const show = !attract && isTouch && GS.state !== 'menu';
  $('bSwap').classList.toggle('hide', mpOn() || GS.PRACTICE || show);
  $('pSwap').classList.toggle('hide', !show || mpOn() || GS.PRACTICE);
  $('pThr').classList.toggle('hide', !show || opts.pedals === 1 || opts.pedals === 3);
  $('pBrk').classList.toggle('hide', !show || opts.pedals === 0 || opts.pedals === 3);
  $('pBrk').classList.toggle('solo', opts.pedals === 1);
  $('pThr').classList.toggle('big', opts.pedals === 0);
  $('pL').classList.toggle('hide', !show || opts.steer === 0);
  $('pUp').classList.toggle('hide', !show || opts.gears !== 1);
  $('pDRS').classList.toggle('hide', !show || opts.drs !== 1 || (mpOn() && false));
  $('pDn').classList.toggle('hide', !show || opts.gears !== 1);
  $('pR').classList.toggle('hide', !show || opts.steer === 0);
  $('bMode').textContent = ['Pedals: Gas', 'Pedals: Brake', 'Pedals: Both', 'Pedals: Auto'][opts.pedals];
  $('bSteer').textContent = ['Steer: Auto', 'Steer: Lanes', 'Steer: Manual', 'Steer: Overtake'][opts.steer];
  $('laneInd').classList.toggle('hide', (opts.steer !== 1 && opts.steer !== 3) || attract);
  renderLaneInd();
  layoutPads();
}
const vis = (id: string) => !$(id).classList.contains('hide');
/** touch layout: the speed panel sits left of the pedal pads (bottom-aligned) and Swap sits above the main pedal */
export function layoutPads() {
  const spd = $('spd'),
    sw = $('pSwap');
  spd.style.cssText = '';
  sw.style.cssText = '';
  spd.classList.remove('compact');
  if (!isTouch || GS.state === 'menu') return;
  const right = ['pThr', 'pBrk'].filter(vis).map(id => $(id).getBoundingClientRect());
  const W = innerWidth,
    H = innerHeight;
  if (right.length) {
    const padL = Math.min(...right.map(r => r.left)),
      padTop = Math.min(...right.map(r => r.top)),
      leftEdge = Math.max(
        10,
        ...['pL', 'pR', 'pDn'].filter(vis).map(id => $(id).getBoundingClientRect().right + 10),
      );
    const main = right.reduce((a, r) => (r.right > a.right ? r : a));
    const bottom = H - Math.max(...right.map(r => r.bottom));
    if (H > W) {
      // portrait: fill the space between any left pads and the pedals
      let w = padL - 10 - leftEdge,
        b = bottom,
        l = leftEdge;
      if (w < 180) {
        // steering pads on the left too: sit above them instead
        const lt = Math.min(...['pL', 'pR', 'pDn'].filter(vis).map(id => $(id).getBoundingClientRect().top));
        l = 10;
        w = padL - 20;
        b = H - lt + 10;
      }
      spd.style.left = l + 'px';
      spd.style.width = w + 'px';
      spd.style.transform = 'none';
      spd.style.bottom = b + 'px';
      spd.classList.toggle('compact', w < 250);
    } else {
      const w = 262;
      spd.style.left = Math.max(leftEdge, padL - 12 - w) + 'px';
      spd.style.width = w + 'px';
      spd.style.transform = 'none';
      spd.style.bottom = bottom + 'px';
    }
    // Swap: centred above the main pedal, and above the gear-up / DRS pads if they are there
    if (vis('pSwap')) {
      const sr = sw.getBoundingClientRect();
      let top = padTop;
      for (const id of ['pUp', 'pDRS'])
        if (vis(id)) {
          const r = $(id).getBoundingClientRect();
          if (r.right > main.left && r.left < main.right) top = Math.min(top, r.top);
        }
      sw.style.left = main.left + main.width / 2 - sr.width / 2 + 'px';
      sw.style.right = 'auto';
      sw.style.bottom = H - top + 12 + 'px';
    }
  }
}
export function init(): void {
  addEventListener('resize', () => setTimeout(layoutPads, 50));
}
/** debug/test hook: reassign a module-level binding */
export function __set(name: string, v: any): void {
  switch (name) {
    case 'pausedFrom':
      pausedFrom = v;
      break;
  }
}
