// The racing line on the canvas when the planner is driving the player's car (sim/lines.ts).
//
// Solid, from the car: the path the planner is steering it down right now. Green = on the gas, yellow = holding
// speed, red = braking, orange = braking with a skid; a white bar marks where the braking starts (lift there).
// Dashed, beyond that: the level's line for the rest of the lap, so braking zones can be seen coming.
// With "Difficult Turns" only the stretches around the circuit's heaviest braking points are drawn.
import { GS } from '../state';
import { ctx } from '../core/dom';
import { opts } from '../game/race';
import { DYN, hardMask } from '../sim/lines';
import { onScr } from './primitives';

const COLS = ['rgba(110,255,120,', 'rgba(255,70,60,', 'rgba(255,214,10,', 'rgba(255,140,30,'];

/** c is the player's car, z the camera zoom (pixels per metre) */
export function drawDynLine(c, z: number): void {
  const N = GS.N,
    p = DYN.cur,
    n = p.n,
    la = p.lat,
    zn = p.zone,
    ln = DYN.line,
    M = opts.line === 2 ? hardMask(ln.v, ln.zone) : null;
  let d0 = p.i0 * GS.SEG - c.s; // how far plan sample 0 is ahead of the car (normally just behind it)
  if (d0 < -GS.L / 2) d0 += GS.L;
  else if (d0 > GS.L / 2) d0 -= GS.L;
  const k0 = Math.max(0, Math.ceil((3 - d0) / GS.SEG)); // start at the car's nose
  if (k0 >= n - 2) return;
  const bad = !p.feasible,
    pulse = bad ? 0.75 + 0.25 * Math.sin(performance.now() / 70) : 1;
  const X = (i: number, lat: number) => GS.TSX[i] + GS.NSX[i] * lat,
    Y = (i: number, lat: number) => GS.TSY[i] + GS.NSY[i] * lat;
  // the rest of the lap, dashed and fainter
  ctx.lineWidth = Math.max(1.5, 0.3 * z);
  ctx.setLineDash([z * 1.6, z * 1.2]);
  for (let zc = 0; zc < 4; zc++) {
    let any = false;
    ctx.beginPath();
    for (let k = n - 2; k < N - 12; k++) {
      const i = (p.i0 + k) % N;
      if (ln.zone[i] !== zc || (M && !M[i]) || !onScr(GS.TSX[i], GS.TSY[i], 20)) continue;
      const j = (i + 1) % N;
      any = true;
      ctx.moveTo(X(i, ln.lat[i]), Y(i, ln.lat[i]));
      ctx.lineTo(X(j, ln.lat[j]), Y(j, ln.lat[j]));
    }
    if (any) {
      ctx.strokeStyle = COLS[zc] + (zc === 0 ? 0.4 : 0.6) + ')';
      ctx.stroke();
    }
  }
  ctx.setLineDash([]);
  // the planned path
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  for (let zc = 0; zc < 4; zc++) {
    let any = false;
    ctx.beginPath();
    for (let k = k0; k < n - 2; k++) {
      if (zn[k] !== zc) continue;
      const i = (p.i0 + k) % N,
        j = (i + 1) % N;
      if ((M && !M[i]) || !onScr(GS.TSX[i], GS.TSY[i], 20)) continue;
      any = true;
      ctx.moveTo(X(i, la[k]), Y(i, la[k]));
      ctx.lineTo(X(j, la[k + 1]), Y(j, la[k + 1]));
    }
    if (!any) continue;
    const red = zc === 1 || zc === 3;
    ctx.strokeStyle = COLS[zc] + (red ? 0.9 : 0.75) * (red ? pulse : 1) + ')';
    ctx.lineWidth = Math.max(2, (red && bad ? 0.62 : 0.44) * z);
    ctx.stroke();
  }
  // the lift marker: a bar across the line where the next braking begins
  for (let k = k0; k < n - 2; k++) {
    if (zn[k] !== 1 && zn[k] !== 3) continue;
    if (k === k0) break;
    const i = (p.i0 + k) % N,
      w = 1.5;
    if (M && !M[i]) break;
    ctx.strokeStyle = 'rgba(255,255,255,0.95)';
    ctx.lineWidth = Math.max(2, 0.5 * z);
    ctx.beginPath();
    ctx.moveTo(X(i, la[k] - w), Y(i, la[k] - w));
    ctx.lineTo(X(i, la[k] + w), Y(i, la[k] + w));
    ctx.stroke();
    break;
  }
  ctx.lineCap = 'butt';
  ctx.lineJoin = 'miter';
}
