// What the Passing styles draw on the road (sim/passing.ts): quiet markings in the style of the racing line, colour
// only where it means something.
//  - the side a pass would take: a row of chevrons on the road beside the car ahead. White = on offer (Dive), blue =
//    Slingshot ready, yellow = committed (as the old Overtake steering drew its pass).
//  - Pressure: a thin ring round the car ahead that fills as you stay close, white to orange to red.
import { GS } from '../state';
import { clamp, ctx } from '../core/dom';
import { attract, cars, opts } from '../game/race';
import { cam } from './camera';
import { PS } from '../sim/passing';
import type { Car } from '../types';

const YEL = '255,224,102',
  WHT = '255,255,255',
  BLU = '77,163,255';
/** chevrons pointing down the road at lateral offset `side` beside car o, from its tail to about 30 m ahead of it */
function chevrons(o: Car, side: number, rgb: string, a: number, z: number) {
  const lat = clamp(o.lat + side * 3.3, -(GS.HW - 0.9), GS.HW - 0.9);
  const t = performance.now() / 1000;
  ctx.lineWidth = Math.max(3, 0.45 * z);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  for (let k = 0; k < 5; k++) {
    const i = (o.idx - 1 + k * 4) % GS.N,
      j = (i + 1) % GS.N;
    // a pulse runs along the row towards the front
    const ph = (t * 1.6 - k * 0.18) % 1,
      al = a * (0.45 + 0.55 * Math.max(0, Math.sin(Math.PI * ph)));
    const x = GS.TSX[i] + GS.NSX[i] * lat,
      y = GS.TSY[i] + GS.NSY[i] * lat;
    let tx = GS.TSX[j] + GS.NSX[j] * lat - x,
      ty = GS.TSY[j] + GS.NSY[j] * lat - y;
    const tl = Math.hypot(tx, ty) || 1;
    tx /= tl;
    ty /= tl;
    // square to the screen, so they read as arrows whatever the angle of the road
    const nx = -ty,
      ny = tx,
      len = 1.4 * z,
      wid = 1.1 * z;
    ctx.strokeStyle = `rgba(${rgb},${al.toFixed(3)})`;
    ctx.beginPath();
    ctx.moveTo(x - tx * len + nx * wid, y - ty * len + ny * wid);
    ctx.lineTo(x, y);
    ctx.lineTo(x - tx * len - nx * wid, y - ty * len - ny * wid);
    ctx.stroke();
  }
  ctx.lineCap = 'butt';
  ctx.lineJoin = 'miter';
}
/** an ellipse on the ground round car o; `fill` 0..1 of it drawn (from the front, clockwise) */
function ring(o: Car, rgb: string, a: number, fill: number, z: number, w = 0.28) {
  const i = o.idx,
    x = GS.TSX[i] + GS.NSX[i] * o.lat,
    y = GS.TSY[i] + GS.NSY[i] * o.lat;
  const rx = 4.2 * z,
    ry = 3.2 * z * Math.max(0.5, cam.tilt || 0.6),
    a0 = -Math.PI / 2;
  ctx.strokeStyle = `rgba(${rgb},${a.toFixed(3)})`;
  ctx.lineWidth = Math.max(2, w * z);
  ctx.beginPath();
  ctx.ellipse(x, y, rx, ry, 0, a0, a0 + Math.PI * 2 * clamp(fill, 0, 1));
  ctx.stroke();
}
/** draw the passing cues for your car (ground layer, before the cars) */
export function drawPassCues(z: number) {
  if (attract || (GS.state !== 'race' && GS.state !== 'paused') || !(opts.pass | 0)) return;
  const me = cars[GS.ctrl];
  if (!me || me.finished) return;
  // a committed pass: the side it takes, in yellow, until your car is by
  if (PS.car && !PS.car.gone) {
    if (!PS.ahead) chevrons(PS.car, PS.side, YEL, 0.9, z);
    return;
  }
  const o = PS.cand;
  if (!o || o.gone) return;
  const m = opts.pass | 0;
  if (m === 1 && PS.armed) chevrons(o, PS.candSide, WHT, 0.75, z);
  else if (m === 2 && PS.meter > 0.02) {
    // white to orange to red as it fills
    const f = PS.meter,
      rgb =
        f < 0.5
          ? `255,${Math.round(255 - 116 * f * 2)},${Math.round(255 - 194 * f * 2)}`
          : `255,${Math.round(139 - 32 * (f - 0.5) * 2)},${Math.round(61 + 33 * (f - 0.5) * 2)}`;
    ring(o, WHT, 0.25, 1, z, 0.25);
    ring(o, rgb, 0.95, f, z, 0.5);
  } else if (m === 3) {
    if (PS.ready) chevrons(o, PS.candSide, BLU, 0.9, z);
    else if (PS.meter > 0.02) ring(o, BLU, 0.55, PS.meter, z, 0.2);
  }
}
