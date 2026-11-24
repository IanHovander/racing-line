// Passing in Auto steering (sim/pass.ts), drawn on the road and over your car:
//   - the car a pass would be on gets a thin ring (gold once the pass is on);
//   - a chevron in each open lane beside it, bright and pulsing when it is a good moment to pass on that side (tap:
//     only the side the game will take);
//   - while a pass (or a slide) is on, a dashed path from your car to where it is heading;
//   - getting past a car: your new position pops up over your car.
import { GS } from '../state';
import { clamp, ctx } from '../core/dom';
import { attract, cars, opts } from '../game/race';
import { P, cam } from './camera';
import { DYN } from '../sim/lines';
import { PASS_TUNE, PASS_UI, PM, passActive } from '../sim/pass';

const GOLD = '255,224,102'; // #ffe066, as the other passing cues
let barA = 0; // slide: the lane bar fades in while a car is near or the car is off the line
const at = (i: number, lat: number): [number, number] => [
  GS.TSX[i] + GS.NSX[i] * lat,
  GS.TSY[i] + GS.NSY[i] * lat,
];
/** a forward-pointing chevron on the road at sample i, lat m from the centre line */
function chevron(i: number, lat: number, z: number, col: string): void {
  const j = (i + 2) % GS.N;
  const p = at(i, lat),
    q = at(j, lat);
  let fx = q[0] - p[0],
    fy = q[1] - p[1];
  const fl = Math.hypot(fx, fy) || 1;
  fx /= fl;
  fy /= fl;
  let nx = GS.NSX[i],
    ny = GS.NSY[i];
  const nl = Math.hypot(nx, ny) || 1;
  nx /= nl;
  ny /= nl;
  const a = 1.6 * z,
    b = 1.3 * z;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.beginPath();
  ctx.moveTo(p[0] - fx * a + nx * b, p[1] - fy * a + ny * b);
  ctx.lineTo(p[0] + fx * a * 0.5, p[1] + fy * a * 0.5);
  ctx.lineTo(p[0] - fx * a - nx * b, p[1] - fy * a - ny * b);
  ctx.strokeStyle = 'rgba(0,0,0,0.35)';
  ctx.lineWidth = Math.max(4.5, 0.75 * z);
  ctx.stroke();
  ctx.strokeStyle = col;
  ctx.lineWidth = Math.max(2.5, 0.42 * z);
  ctx.stroke();
  ctx.lineCap = 'butt';
  ctx.lineJoin = 'miter';
}
function ring(o, z: number, col: string): void {
  const [x, y] = at(o.idx, o.lat);
  ctx.strokeStyle = col;
  ctx.lineWidth = Math.max(2, 0.3 * z);
  ctx.beginPath();
  ctx.ellipse(x, y, 4.2 * z, 3.2 * z * Math.max(0.5, cam.tilt || 0.6), 0, 0, Math.PI * 2);
  ctx.stroke();
}

/** on the road, under the cars */
export function drawPassRoad(z: number): void {
  const c = cars[GS.ctrl];
  if (attract || GS.state !== 'race' || opts.steer !== 0 || !passActive(c)) return;
  const pulse = 0.55 + 0.35 * Math.sin(performance.now() / 160);
  const o = PM.side ? PM.car : PM.near;
  if (o && !o.gone) {
    ring(o, z, PM.side ? `rgba(${GOLD},0.9)` : 'rgba(255,255,255,0.5)');
    if (PM.side && PM.wait)
      // committed, waiting in the slipstream for a better moment: the chosen side's chevron, gold and calm
      chevron(
        (o.idx + 2) % GS.N,
        clamp(o.lat + PM.side * PASS_TUNE.beside, -GS.HW, GS.HW),
        z,
        `rgba(${GOLD},0.5)`,
      );
    if (!PM.side) {
      // chevrons in the lanes beside it: bright and pulsing where now is a good moment to go, faint where the side is
      // open but the path beside it would be slow (tap shows only the side it will take)
      const i = (o.idx + 2) % GS.N;
      for (const sd of [-1, 1]) {
        const k = sd < 0 ? 0 : 1;
        if (!PM.open[k] || (PASS_UI === 'tap' && sd !== PM.auto)) continue;
        const lat = clamp(o.lat + sd * PASS_TUNE.beside, -GS.HW, GS.HW),
          gold = PASS_UI === 'tap' && PM.charge >= 1;
        chevron(
          i,
          lat,
          z,
          PM.good[k]
            ? gold
              ? `rgba(${GOLD},${0.6 + 0.4 * pulse})`
              : `rgba(255,255,255,${0.55 + 0.45 * pulse})`
            : 'rgba(255,255,255,0.22)',
        );
      }
    }
  }
  const LN: ArrayLike<number> = DYN && DYN.line && DYN.ready && opts.dynlv ? DYN.line.lat : GS.off;
  // slide: the road itself is the slider, a bar across it ahead of the car with a dot where your thumb has put it
  if (PASS_UI === 'slide') {
    barA += ((PM.near || PM.on ? 1 : 0) - barA) * 0.12;
    if (barA > 0.03) {
      const i = (c.idx + Math.round(Math.max(16, c.v * 0.55) / GS.SEG)) % GS.N,
        E = GS.HW - 0.8,
        a = Math.abs(PM.s),
        lane = clamp(LN[i] * (1 - a) + Math.sign(PM.s) * (GS.HW - 1.7) * a, -E, E);
      const p0 = at(i, -E),
        p1 = at(i, E),
        pl = at(i, LN[i]),
        pd = at(i, lane);
      ctx.globalAlpha = barA;
      ctx.lineCap = 'round';
      ctx.strokeStyle = 'rgba(255,255,255,0.4)';
      ctx.lineWidth = Math.max(2.5, 0.32 * z);
      ctx.beginPath();
      ctx.moveTo(p0[0], p0[1]);
      ctx.lineTo(p1[0], p1[1]);
      ctx.stroke();
      ctx.fillStyle = 'rgba(255,255,255,0.55)'; // the racing line's place on the bar
      ctx.beginPath();
      ctx.arc(pl[0], pl[1], Math.max(2, 0.3 * z), 0, 7);
      ctx.fill();
      ctx.fillStyle = a > 0.02 ? `rgb(${GOLD})` : '#fff'; // where you are taking the car
      ctx.strokeStyle = 'rgba(0,0,0,0.6)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(pd[0], pd[1], Math.max(4, 0.62 * z), 0, 7);
      ctx.fill();
      ctx.stroke();
      ctx.lineCap = 'butt';
      ctx.globalAlpha = 1;
    }
  }
  // where the car is heading while it is off the line
  if (!PM.on) return;
  const sl = PM.aim;
  ctx.strokeStyle = PASS_UI === 'slide' ? 'rgba(255,255,255,0.55)' : `rgba(${GOLD},0.6)`;
  ctx.lineWidth = Math.max(2, 0.35 * z);
  ctx.setLineDash([z * 1.2, z * 1.6]);
  ctx.beginPath();
  const j0 = (c.idx + Math.round((7 + c.v * 0.32) / GS.SEG)) % GS.N;
  const off = sl - LN[j0]; // the aim as an offset from the line, carried on along it
  for (let q = 3; q <= 40; q++) {
    const j = (c.idx + q) % GS.N;
    const a = clamp((q - 3) / 12, 0, 1);
    const tl = clamp(c.lat * (1 - a) + (LN[j] + off) * a, -(GS.HW - 0.9), GS.HW - 0.9);
    const [x, y] = at(j, tl);
    q > 3 ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
  }
  ctx.stroke();
  ctx.setLineDash([]);
}

/** over the cars: your new place pops up when you get past someone */
export function drawPassFx(): void {
  const c = cars[GS.ctrl];
  if (attract || !c || !PM.fx.length) return;
  for (const f of PM.fx) {
    const t = f.t,
      a = t < 1.1 ? 1 : clamp(1 - (t - 1.1) / 0.5, 0, 1),
      pop = 1 + 0.45 * Math.max(0, 1 - t / 0.18);
    const m = P(c.x, c.y, 5.2 + t * 2.2);
    const txt = '▲ P' + f.pos;
    ctx.save();
    ctx.globalAlpha = a;
    ctx.translate(m[0], m[1]);
    ctx.scale(pop, pop);
    ctx.font = '700 15px "Geist Mono",ui-monospace,monospace';
    const w = ctx.measureText(txt).width + 18,
      h = 24;
    ctx.fillStyle = 'rgba(12,14,19,0.88)';
    ctx.beginPath();
    ctx.roundRect(-w / 2, -h / 2, w, h, 12);
    ctx.fill();
    ctx.strokeStyle = 'rgba(46,204,113,0.9)';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.fillStyle = '#2ecc71';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(txt, 0, 1);
    ctx.restore();
  }
}
