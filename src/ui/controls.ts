import { GS } from '../state';
import { NCOL, PRI, notify } from './notify';
import { AC, sfxG } from '../audio/audio';
import { $, clamp, isTouch, store } from '../core/dom';
import { attract, cars, opts } from '../game/race';
import { mpOn } from '../net/multiplayer';
import { cam } from '../render/camera';
import { renderLaneInd } from '../sim/ai';
import { GEARTOP, autoGear, isManual } from '../sim/car-model';
import { DYN, dynEligible, lineSave } from '../sim/lines';
import { syncAllSegs } from './widgets';
import { PASS_UI, passCancel, passNote } from '../sim/pass';
export const STEERS = ['Auto Steering', 'Lane Steering', 'Manual Steering', 'Overtake Steering'];
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
    pri: type === 'pen' ? PRI.pen : PRI.warn,
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
  passCancel();
  if (DYN) DYN.reset();
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
export function cycleSteer() {
  opts.steer = (opts.steer + 1) % 4;
  store.set('steer', opts.steer);
  showToast(STEERS[opts.steer]);
  updatePads();
  syncCtrlMenu();
}
export function syncCtrlMenu() {
  ([...$('sSteer').children] as HTMLElement[]).forEach(b =>
    b.classList.toggle('sel', +b.dataset.v === opts.steer),
  );
  $('steerNote').textContent =
    opts.steer === 0 && opts.dynlv && dynEligible()
      ? 'The car follows the racing line of your Line Difficulty and sits behind moving cars. ' + passNote()
      : STEER_NOTE[opts.steer];
}
/** H or the Line button: hidden -> difficult turns -> shown. Hiding the line changes nothing about how the car drives. */
export function toggleLine() {
  opts.line = [2, 0, 1][opts.line | 0];
  lineSave();
  showToast(
    [
      'Racing line hidden (the car still follows it)',
      'Racing line shown',
      'Racing line shown for difficult turns only',
    ][opts.line],
  );
  updatePads();
  syncAllSegs();
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
  passCancel();
  if (DYN) DYN.reset();
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
  $('pThr').classList.toggle('hide', !show);
  $('pL').classList.toggle('hide', !show || opts.steer === 0);
  $('pUp').classList.toggle('hide', !show || opts.gears !== 1);
  $('pDRS').classList.toggle('hide', !show || opts.drs !== 1 || (mpOn() && false));
  $('pDn').classList.toggle('hide', !show || opts.gears !== 1);
  $('pR').classList.toggle('hide', !show || opts.steer === 0);
  $('pPass').classList.toggle('hide', !show || opts.steer !== 0 || PASS_UI !== 'tap');
  $('bSteer').textContent = ['Steer: Auto', 'Steer: Lanes', 'Steer: Manual', 'Steer: Overtake'][opts.steer];
  $('laneInd').classList.toggle('hide', (opts.steer !== 1 && opts.steer !== 3) || attract);
  renderLaneInd();
  layoutPads();
}
const vis = (id: string) => !$(id).classList.contains('hide');
/** touch layout: the speed panel sits left of the GAS pad (bottom-aligned) and Swap sits above it */
export function layoutPads() {
  const spd = $('spd'),
    sw = $('pSwap');
  spd.style.cssText = '';
  sw.style.cssText = '';
  spd.classList.remove('compact');
  document.body.style.removeProperty('--notesB');
  const pz = $('bPause');
  pz.style.bottom = '';
  if (!isTouch || GS.state === 'menu') return;
  // no steering pads: everything on the right thumb. GAS bottom right, Swap to its left at the
  // same height, the speed panel above them centred on the screen, notifications above that.
  if (vis('pThr') && !['pL', 'pR', 'pUp', 'pDn', 'pDRS'].some(vis)) {
    const g = $('pThr').getBoundingClientRect(),
      W = innerWidth,
      H = innerHeight;
    const w = Math.max(g.width, 210);
    const swW = vis('pSwap') ? g.height : 0,
      swL = g.left - 12 - swW; // left edge of Swap
    spd.style.right = 'auto';
    spd.style.width = w + 'px';
    spd.style.transform = 'none';
    spd.classList.add('compact');
    // PASS (tap passing): a strip right above GAS, so the thumb slides up onto it
    let gTop = g.top;
    const ps = $('pPass');
    ps.style.cssText = '';
    if (vis('pPass')) {
      const ph = H > W ? 54 : 46;
      ps.style.left = g.left + 'px';
      ps.style.right = 'auto';
      ps.style.width = g.width + 'px';
      ps.style.height = ph + 'px';
      ps.style.bottom = H - g.top + 8 + 'px';
      gTop = g.top - 8 - ph;
    }
    let pb: number; // speed panel bottom
    if (H > W) {
      // portrait: centred on the screen, above GAS and Swap
      spd.style.left = Math.round((W - w) / 2) + 'px';
      pb = H - gTop + 10;
    } else {
      // landscape: above GAS would cover the car, so on the bottom edge, centred unless that reaches Swap
      spd.style.left = Math.round(Math.max(10, Math.min((W - w) / 2, swL - 12 - w))) + 'px';
      pb = H - g.bottom;
    }
    spd.style.bottom = pb + 'px';
    if (vis('pSwap')) {
      sw.style.left = 'auto';
      sw.style.right = W - g.left + 12 + 'px';
      sw.style.bottom = H - g.bottom + 'px';
      sw.style.width = sw.style.height = g.height + 'px';
    }
    const top = pb + spd.getBoundingClientRect().height;
    document.body.style.setProperty('--notesB', Math.round(top + 12) + 'px');
    return;
  }
  const right = ['pThr'].filter(vis).map(id => $(id).getBoundingClientRect());
  const W = innerWidth,
    H = innerHeight;
  {
    // PASS (tap passing) with the gear / DRS pads up: above GAS, left of the column of small pads
    const ps = $('pPass');
    ps.style.cssText = '';
    if (vis('pPass') && vis('pThr')) {
      const g = $('pThr').getBoundingClientRect(),
        col = ['pUp', 'pDRS'].some(vis) ? 94 : 0;
      ps.style.left = g.left + 'px';
      ps.style.right = 'auto';
      ps.style.width = Math.max(90, g.width - col) + 'px';
      ps.style.height = '54px';
      ps.style.bottom = H - g.top + 8 + 'px';
    }
  }
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
      // portrait: fill the space between any left pads and GAS
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
    // Swap: centred above GAS, and above the gear-up / DRS pads if they are there
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
  // steering / gear-down pads (and the speed panel above them) take the bottom left corner: pause goes above
  const lp = ['pL', 'pR', 'pDn', 'spd', 'laneInd']
    .filter(id => vis(id))
    .map(id => $(id).getBoundingClientRect())
    .filter(r => r.width && r.left < 70);
  if (lp.length) pz.style.bottom = innerHeight - Math.min(...lp.map(r => r.top)) + 10 + 'px';
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
