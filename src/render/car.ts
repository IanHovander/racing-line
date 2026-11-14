import { GS } from '../state';
import { ctx } from '../core/dom';
import { attract, opts } from '../game/race';
import { P, cam } from './camera';
import { prism } from './primitives';
import { GLOWS } from './scenery';
import { shade } from '../teams/teams';
export const mirror = half =>
  half.concat(
    half
      .slice()
      .reverse()
      .map(p => [p[0], -p[1]]),
  );
export const BODY = mirror([
  [2.86, -0.06],
  [2.7, -0.11],
  [2.4, -0.15],
  [2.0, -0.19],
  [1.5, -0.23],
  [1.0, -0.27],
  [0.5, -0.3],
  [-0.4, -0.31],
  [-1.4, -0.29],
  [-2.0, -0.22],
  [-2.35, -0.12],
]);
export const PODS = mirror([
  [0.72, -0.3],
  [0.62, -0.6],
  [0.45, -0.74],
  [0.15, -0.79],
  [-0.45, -0.78],
  [-0.95, -0.7],
  [-1.4, -0.52],
  [-1.8, -0.34],
  [-2.05, -0.24],
]);
export const COVER = mirror([
  [0.62, -0.18],
  [0.42, -0.3],
  [0.1, -0.36],
  [-0.5, -0.36],
  [-1.1, -0.29],
  [-1.6, -0.2],
  [-2.05, -0.1],
]);
// a tyre as a short cylinder: tread drawn where it faces the camera, then the outer sidewall with a rim
export const WHL_N = 14,
  WHL_C = Array.from({ length: WHL_N }, (_, k) => {
    const a = (k / WHL_N) * Math.PI * 2;
    return [Math.cos(a), Math.sin(a)];
  });
export function drawWheel3(c, w, front) {
  const ch = Math.cos(c.h),
    sh = Math.sin(c.h),
    r = front ? 0.31 : 0.34,
    hw = front ? 0.17 : 0.21;
  const toW = (lx, ly, z) => P(c.x + lx * ch - ly * sh, c.y + lx * sh + ly * ch, z);
  const fd = ch * GS.cC + sh * GS.cS; // forward vs camera: <0 means the front of the car faces the camera
  const lat = Math.sign(w[1]),
    out = -sh * lat * GS.cC + ch * lat * GS.cS < 0; // is the outer sidewall turned towards the camera?
  const yo = w[1] + lat * hw,
    yi = w[1] - lat * hw,
    near = out ? yo : yi,
    far = out ? yi : yo;
  const A = WHL_C.map(q => toW(w[0] + q[0] * r, far, r + q[1] * r)),
    Bn = WHL_C.map(q => toW(w[0] + q[0] * r, near, r + q[1] * r));
  ctx.fillStyle = '#1a1a1a';
  ctx.beginPath();
  A.forEach((p, i) => (i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1])));
  ctx.closePath();
  ctx.fill();
  for (let k = 0; k < WHL_N; k++) {
    const j = (k + 1) % WHL_N,
      mc = (WHL_C[k][0] + WHL_C[j][0]) / 2,
      ms = (WHL_C[k][1] + WHL_C[j][1]) / 2;
    if (ms * 0.9 - mc * fd < -0.05) continue;
    ctx.fillStyle = ms > 0.5 ? '#2c2c2c' : '#202020';
    ctx.beginPath();
    ctx.moveTo(A[k][0], A[k][1]);
    ctx.lineTo(A[j][0], A[j][1]);
    ctx.lineTo(Bn[j][0], Bn[j][1]);
    ctx.lineTo(Bn[k][0], Bn[k][1]);
    ctx.closePath();
    ctx.fill();
  }
  ctx.fillStyle = '#151515';
  ctx.beginPath();
  Bn.forEach((p, i) => (i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1])));
  ctx.closePath();
  ctx.fill();
  if (cam.zoom > 3) {
    const rim = WHL_C.map(q => toW(w[0] + q[0] * r * 0.62, near, r + q[1] * r * 0.62));
    ctx.fillStyle = front ? '#5c6068' : '#5c6068';
    ctx.beginPath();
    rim.forEach((p, i) => (i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1])));
    ctx.closePath();
    ctx.fill();
    const hb = toW(w[0], near, r);
    ctx.fillStyle = c.acc;
    ctx.beginPath();
    ctx.arc(hb[0], hb[1], Math.max(1, r * 0.22 * cam.zoom), 0, 7);
    ctx.fill();
  }
}
export const rect = (x0, x1, y0, y1) => [
  [x1, y0],
  [x1, y1],
  [x0, y1],
  [x0, y0],
];
export const FPLATE = [rect(2.3, 2.9, -1.04, -0.96), rect(2.3, 2.9, 0.96, 1.04)],
  RPLATE = [rect(-2.62, -2.1, -0.84, -0.76), rect(-2.62, -2.1, 0.76, 0.84)];
export const FWING = rect(2.35, 2.85, -1.0, 1.0),
  RWING = rect(-2.6, -2.15, -0.8, 0.8),
  WHEELS = [
    [1.55, -0.92],
    [1.55, 0.92],
    [-1.5, -0.95],
    [-1.5, 0.95],
  ];
export function local(c, poly) {
  const ch = Math.cos(c.h),
    sh = Math.sin(c.h);
  return poly.map(p => [c.x + p[0] * ch - p[1] * sh, c.y + p[0] * sh + p[1] * ch]);
}
export function drawCar(c, isMe, isMate) {
  GS.PZ = c.hz || 0;
  try {
    drawCar0(c, isMe, isMate);
  } finally {
    GS.PZ = 0;
  }
}
export function drawCar0(c, isMe, isMate) {
  const ch = Math.cos(c.h),
    sh = Math.sin(c.h);
  // shadow
  const shp = local(
    { x: c.x + 0.35, y: c.y + 0.35, h: c.h },
    mirror([
      [2.8, -0.4],
      [1.6, -1.15],
      [-1.9, -1.15],
      [-2.6, -0.8],
    ]),
  );
  ctx.fillStyle = 'rgba(0,0,0,0.33)';
  ctx.beginPath();
  shp.forEach((p, i) => {
    const q = P(p[0], p[1], 0);
    i ? ctx.lineTo(q[0], q[1]) : ctx.moveTo(q[0], q[1]);
  });
  ctx.closePath();
  ctx.fill();
  // wheels on the far side first, the body, then the near-side wheels in front of it
  const latC = -sh * GS.cC + ch * GS.cS;
  const nearW = w => Math.sign(w[1]) * latC < 0;
  WHEELS.forEach((w, k) => {
    if (!nearW(w)) drawWheel3(c, w, k < 2);
  });
  const bc = c.out ? shade(c.col, 0.45) : c.col;
  prism(
    local(c, [
      [1.2, -0.12],
      [1.2, 0.12],
      [-1.95, 0.12],
      [-1.95, -0.12],
    ]),
    0.18,
    0.3,
    '#222',
    '#111',
  ); // suspension/floor line
  prism(local(c, PODS), 0.1, 0.38, shade(c.col, 0.92), shade(c.col, c.out ? 0.28 : 0.52));
  prism(local(c, BODY), 0.12, 0.46, bc, shade(c.col, c.out ? 0.3 : 0.6));
  prism(local(c, COVER), 0.46, 0.78, shade(c.col, 1.12), shade(c.col, 0.7));
  if (c.dmg < 0.35) {
    prism(local(c, FWING), 0.05, 0.18, shade(c.col, 0.85), shade(c.col, 0.5));
    for (const fp of FPLATE) prism(local(c, fp), 0.05, 0.3, shade(c.acc, 0.9), shade(c.acc, 0.55));
  }
  WHEELS.forEach((w, k) => {
    if (nearW(w)) drawWheel3(c, w, k < 2);
  });
  prism(local(c, rect(-2.5, -2.3, -0.06, 0.06)), 0.4, 0.95, '#222', '#111');
  if (c.drs) {
    prism(local(c, RWING), 0.9, 0.97, c.acc, shade(c.acc, 0.6));
    prism(local(c, RWING), 1.13, 1.18, '#2e7dff', '#1d4fb0');
  } else prism(local(c, RWING), 0.9, 1.08, c.acc, shade(c.acc, 0.6));
  for (const rp of RPLATE) prism(local(c, rp), 0.55, 1.12, shade(c.col, 0.8), shade(c.col, 0.5));
  // helmet + halo
  const hp = P(c.x + ch * -0.05, c.y + sh * -0.05, 0.85);
  ctx.fillStyle = c.acc;
  ctx.beginPath();
  ctx.arc(hp[0], hp[1], Math.max(2, 0.27 * cam.zoom), 0, 7);
  ctx.fill();
  ctx.fillStyle = '#111';
  const vp = P(c.x + ch * 0.12, c.y + sh * 0.12, 0.88);
  ctx.beginPath();
  ctx.arc(vp[0], vp[1], Math.max(1, 0.12 * cam.zoom), 0, 7);
  ctx.fill();
  if (c.tow > 0.2) {
    const tw = c.tow,
      tm = performance.now() / 1000;
    ctx.lineCap = 'round';
    const vis = Math.min(1, tw * 0.9);
    for (let k = 0; k < (isMe ? 9 : 5); k++) {
      const yl = ((k * 0.377) % 1) * 3.4 - 1.7,
        zl = 0.4 + ((k * 0.618) % 1) * 1.6;
      const ph = (tm * (1.4 + c.v / 55) + k * 0.137) % 1;
      const x0 = 9 - ph * 20,
        len = 3.5 + ((k * 0.29) % 1) * 4;
      const a = P(c.x + ch * x0 - sh * yl, c.y + sh * x0 + ch * yl, zl),
        b = P(c.x + ch * (x0 - len) - sh * yl, c.y + sh * (x0 - len) + ch * yl, zl);
      const al = vis * Math.sin(Math.PI * ph) * (isMe ? 1 : 0.6);
      ctx.strokeStyle = `rgba(255,255,255,${(al * 0.45).toFixed(3)})`;
      ctx.lineWidth = Math.max(1, cam.zoom * 0.09);
      ctx.beginPath();
      ctx.moveTo(a[0], a[1]);
      ctx.lineTo(b[0], b[1]);
      ctx.stroke();
    }
    ctx.lineCap = 'butt';
  }
  if ((opts.rain || GS.TR.night) && !c.gone) {
    const rp = P(c.x - ch * 2.45, c.y - sh * 2.45, 0.55);
    const on = !opts.rain || Math.floor(performance.now() / 220 + c.number) % 2;
    if (on) GLOWS.push([rp[0], rp[1], Math.max(4, cam.zoom * 0.9), '255,40,30', 0.9]);
  }
  if (c.out && Math.floor(performance.now() / 350) % 2) {
    const q = P(c.x, c.y, 1.3);
    ctx.fillStyle = '#ffb000';
    ctx.beginPath();
    ctx.arc(q[0], q[1], Math.max(3, cam.zoom * 0.45), 0, 7);
    ctx.fill();
  }
  if (isMe || isMate) {
    const t = performance.now() / 300;
    const m = P(c.x, c.y, 3.2 + (isMe ? Math.sin(t) * 0.3 : 0));
    const s = isMe ? 9 : 6;
    ctx.fillStyle = isMe ? '#ffe066' : '#bfe3ff';
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(m[0], m[1] + s);
    ctx.lineTo(m[0] - s, m[1] - s * 0.6);
    ctx.lineTo(m[0] + s, m[1] - s * 0.6);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    if (isMate) {
      ctx.font = 'bold 10px Geist,system-ui';
      ctx.textAlign = 'center';
      ctx.fillStyle = '#fff';
      ctx.fillText('2', m[0], m[1] - s);
    }
  }
  // other human players online: a name tag in their team colour over the car
  else if (c.human && !attract && !c.gone) {
    const m = P(c.x, c.y, 3.0);
    const nm = c.name;
    ctx.font = 'bold 11px Geist,system-ui';
    const tw = ctx.measureText(nm).width + 14,
      th = 17,
      x = m[0] - tw / 2,
      y = m[1] - th - 6;
    ctx.globalAlpha *= c.out ? 0.5 : 1;
    ctx.fillStyle = 'rgba(12,14,19,0.88)';
    ctx.beginPath();
    ctx.roundRect ? ctx.roundRect(x, y, tw, th, 8) : ctx.rect(x, y, tw, th);
    ctx.fill();
    ctx.fillStyle = c.col;
    ctx.fillRect(x + 5, y + 4, 3, th - 8);
    ctx.fillStyle = '#fff';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(nm, x + 11, y + th / 2 + 0.5);
    ctx.textBaseline = 'alphabetic';
    ctx.fillStyle = 'rgba(12,14,19,0.88)';
    ctx.beginPath();
    ctx.moveTo(m[0] - 5, y + th);
    ctx.lineTo(m[0] + 5, y + th);
    ctx.lineTo(m[0], y + th + 5);
    ctx.closePath();
    ctx.fill();
  }
}
