// The touch cues for passing in Auto steering (sim/pass.ts), updated every frame:
//   slide  as swipe, the chevrons pointing the two ways to drag (the lane itself is shown on the road, render/pass.ts)
//   swipe  a chevron on the GAS pad for each side of your car, pointing the way to flick (the camera is isometric, so
//          that is not always left and right): faint while that side of the car ahead is open, bright and pulsing when
//          it is a good moment to go, gold once chosen
//   tap    the PASS strip above GAS: dim with nobody ahead, outlined when a car is in range, glowing when it is a good
//          moment to go, filling with the slipstream charge, gold when full, solid gold while the pass is on
import { GS } from '../state';
import { $ } from '../core/dom';
import { attract, cars, opts } from '../game/race';
import { PASS_UI, PM, passActive } from '../sim/pass';

/**
 * Your car's sideways direction as drawn on the screen (unit vector, towards positive lat = its right). The camera is
 * isometric, so a car can be heading up, down or across the screen; the passing gestures are read along this
 * direction (drag or flick towards where you want the car) and the cues point along it.
 */
export function passLatDir(): [number, number] {
  const c = cars[GS.ctrl];
  if (!c || !GS.NSX || GS.NSX.length !== GS.N) return [1, 0];
  const x = GS.NSX[c.idx],
    y = GS.NSY[c.idx],
    l = Math.hypot(x, y);
  return l > 1e-6 ? [x / l, y / l] : [1, 0];
}

const last: { k?: string; fill?: number; dot?: number; lab?: string; ang?: number } = {};
export function passHud(): void {
  const c = cars[GS.ctrl];
  const on = !attract && opts.steer === 0 && passActive(c) && GS.state === 'race';
  const gas = $('pThr'),
    pp = $('pPass');
  if (PASS_UI === 'swipe' || PASS_UI === 'slide') {
    // a chevron on the GAS pad for each side of your car, pointing the way to flick or drag
    const side = PASS_UI === 'slide' ? (Math.abs(PM.s) > 0.05 ? Math.sign(PM.s) : 0) : PM.side;
    const k = !on
      ? ''
      : side
        ? 'go' + side
        : PM.near
          ? 'cue' +
            (PM.open[0] ? 'L' : '') +
            (PM.open[1] ? 'R' : '') +
            (PM.good[0] ? 'l' : '') +
            (PM.good[1] ? 'r' : '')
          : '';
    if (k !== last.k) {
      last.k = k;
      const L = gas.querySelector('.pc.l') as HTMLElement,
        R = gas.querySelector('.pc.r') as HTMLElement;
      gas.classList.toggle('cue', k.startsWith('cue'));
      L.classList.toggle('open', on && !side && !!PM.near && PM.open[0]);
      R.classList.toggle('open', on && !side && !!PM.near && PM.open[1]);
      L.classList.toggle('good', on && !side && !!PM.near && PM.good[0]);
      R.classList.toggle('good', on && !side && !!PM.near && PM.good[1]);
      L.classList.toggle('chosen', on && side < 0);
      R.classList.toggle('chosen', on && side > 0);
    }
    if (on) {
      const [ux, uy] = passLatDir(),
        ang = Math.round((Math.atan2(uy, ux) * 180) / Math.PI);
      if (ang !== last.ang) {
        last.ang = ang;
        const w = gas.clientWidth / 2 - 22,
          h = gas.clientHeight / 2 - 16;
        // where the direction leaves an ellipse inside the pill
        const t = 1 / Math.max(1e-6, Math.hypot(ux / w, uy / h));
        for (const [cl, sd] of [
          ['.pc.l', -1],
          ['.pc.r', 1],
        ] as [string, number][]) {
          const el = gas.querySelector(cl) as HTMLElement;
          el.style.transform = `translate(${sd * ux * t}px, ${sd * uy * t}px) rotate(${sd < 0 ? ang + 180 : ang}deg)`;
        }
      }
    }
  } else if (!pp.classList.contains('hide')) {
    const live = on && !!PM.near,
      going = on && !!PM.side,
      good = live && !going && !!PM.auto && PM.good[PM.auto < 0 ? 0 : 1],
      full = live && !going && PM.charge >= 1;
    const k = (live ? 'l' : '') + (going ? 'g' : '') + (good ? 'o' : '') + (full ? 'f' : '');
    if (k !== last.k) {
      last.k = k;
      pp.classList.toggle('live', live || going);
      pp.classList.toggle('going', going);
      pp.classList.toggle('good', good);
      pp.classList.toggle('full', full);
    }
    const fill = going ? 1 : live ? Math.round(PM.charge * 50) / 50 : 0;
    if (fill !== last.fill) {
      last.fill = fill;
      pp.style.setProperty('--f', String(fill));
    }
    const lab = going ? 'PASSING' : full ? 'PASS ⚡' : 'PASS';
    if (lab !== last.lab) {
      last.lab = lab;
      (pp.querySelector('.lb') as HTMLElement).textContent = lab;
    }
  }
}
