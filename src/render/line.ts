// The racing line on the canvas when the planner is driving the player's car (sim/lines.ts).
//
// What is drawn is the level's own line: the fastest line for the chosen Line Difficulty, the same every lap, as if
// painted on the road. Green = on the gas, yellow = holding speed, red = braking, orange = braking with a skid; a
// white bar marks where each braking starts (lift there). With "Difficult Turns" only the stretches around the
// circuit's heaviest braking points are drawn.
//
// The path the planner is steering the car down right now is not drawn. On the line and at its speeds the two are
// the same; when the car is off it, or too fast for it, the planner works out the best way on from where the car
// really is and drives that, and the painted line stays where it was. (Until v17.17 the plan itself was drawn from
// the car, solid, and the level's line only beyond it, dashed.)
import { GS } from '../state';
import { ctx } from '../core/dom';
import { opts } from '../game/race';
import { DYN, hardMask } from '../sim/lines';
import { onScr } from './primitives';

// by zone: 0 gas, 1 brake, 2 hold, 3 brake with a skid
const COLS = [
  'rgba(110,255,120,0.75)',
  'rgba(255,70,60,0.9)',
  'rgba(255,214,10,0.75)',
  'rgba(255,140,30,0.9)',
];
/** half the width of the lift bar, metres */
const BAR = 1.5;

/** z is the camera zoom (pixels per metre) */
export function drawDynLine(z: number): void {
  const N = GS.N,
    ln = DYN.line,
    la = ln.lat,
    zn = ln.zone,
    M = opts.line === 2 ? hardMask(ln.v, zn) : null;
  const X = (i: number, lat: number) => GS.TSX[i] + GS.NSX[i] * lat,
    Y = (i: number, lat: number) => GS.TSY[i] + GS.NSY[i] * lat;
  const drawn = (i: number) => (!M || !!M[i]) && onScr(GS.TSX[i], GS.TSY[i], 20);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.lineWidth = Math.max(2, 0.44 * z);
  for (let zc = 0; zc < 4; zc++) {
    let any = false,
      open = false; // a stretch of this colour is being drawn
    ctx.beginPath();
    for (let i = 0; i < N; i++) {
      if (zn[i] !== zc || !drawn(i)) {
        open = false;
        continue;
      }
      const j = (i + 1) % N;
      if (!open) ctx.moveTo(X(i, la[i]), Y(i, la[i]));
      ctx.lineTo(X(j, la[j]), Y(j, la[j]));
      open = any = true;
    }
    if (!any) continue;
    ctx.strokeStyle = COLS[zc];
    ctx.stroke();
  }
  // the lift markers: a bar across the line where each braking begins
  const brake = (i: number) => zn[i] === 1 || zn[i] === 3;
  ctx.strokeStyle = 'rgba(255,255,255,0.95)';
  ctx.lineWidth = Math.max(2, 0.5 * z);
  ctx.beginPath();
  for (let i = 0; i < N; i++) {
    if (!brake(i) || brake((i + N - 1) % N) || !drawn(i)) continue;
    ctx.moveTo(X(i, la[i] - BAR), Y(i, la[i] - BAR));
    ctx.lineTo(X(i, la[i] + BAR), Y(i, la[i] + BAR));
  }
  ctx.stroke();
  ctx.lineCap = 'butt';
  ctx.lineJoin = 'miter';
}
