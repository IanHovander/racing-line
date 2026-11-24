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
const DRIVER_HELMETS = [
  '#ff302e',
  '#00c853',
  '#2979ff',
  '#ffd600',
  '#e040fb',
  '#00b8d4',
  '#ff6d00',
  '#7c4dff',
  '#c6ff00',
  '#ff4081',
];
export function helmetColor(c) {
  return DRIVER_HELMETS[((c.team || 0) * 2 + (c.drv || 0)) % DRIVER_HELMETS.length];
}
// Early/mid-1990s open-wheel silhouette: a slim raised nose, relatively square
// sidepods, an open cockpit, exposed slicks and tall, simple wings.
/** lower hull, nose tip to gearbox */
export const BODY = mirror([
  [2.92, -0.035],
  [2.8, -0.075],
  [2.48, -0.12],
  [2.1, -0.17],
  [1.7, -0.215],
  [1.25, -0.26],
  [0.8, -0.3],
  [0.25, -0.33],
  [-0.4, -0.34],
  [-1.0, -0.33],
  [-1.55, -0.3],
  [-1.92, -0.285],
  [-2.2, -0.25],
  [-2.4, -0.205],
  [-2.51, -0.145],
  [-2.56, -0.08],
]);
/** Raised nose bridge, a defining feature of mid-1990s cars */
export const NOSE2 = mirror([
  [2.7, -0.07],
  [2.42, -0.105],
  [2.05, -0.14],
  [1.55, -0.18],
  [1.05, -0.215],
]);
/** monocoque and engine bay, above the lower hull */
export const TUB = mirror([
  [1.25, -0.19],
  [0.9, -0.235],
  [0.45, -0.26],
  [-0.15, -0.27],
  [-0.8, -0.265],
  [-1.35, -0.235],
  [-1.82, -0.195],
  [-2.12, -0.155],
  [-2.34, -0.105],
  [-2.46, -0.05],
]);
export const COCKPIT = mirror([
  [0.62, -0.11],
  [0.42, -0.18],
  [0.03, -0.205],
  [-0.38, -0.19],
  [-0.56, -0.11],
]);
/** narrow period undertray */
export const FLOOR = mirror([
  [1.45, -0.23],
  [1.0, -0.47],
  [0.65, -0.53],
  [-1.35, -0.52],
  [-2.18, -0.34],
  [-2.4, -0.2],
]);
/** relatively square sidepods, rather than the deep undercut of a modern car */
export const PODS_LOW = mirror([
  [0.72, -0.3],
  [0.58, -0.55],
  [0.25, -0.66],
  [-0.55, -0.67],
  [-1.2, -0.59],
  [-1.75, -0.42],
  [-2.12, -0.26],
]);
export const PODS = mirror([
  [0.78, -0.31],
  [0.65, -0.56],
  [0.42, -0.72],
  [0.15, -0.77],
  [-0.45, -0.77],
  [-1.0, -0.69],
  [-1.48, -0.54],
  [-1.9, -0.39],
  [-2.18, -0.26],
]);
/** engine cover and the airbox on top of it */
export const COVER = mirror([
  [-0.28, -0.17],
  [-0.48, -0.24],
  [-0.88, -0.255],
  [-1.35, -0.23],
  [-1.76, -0.185],
  [-2.08, -0.15],
  [-2.32, -0.105],
  [-2.48, -0.05],
]);
export const AIRBOX = mirror([
  [-0.52, -0.11],
  [-0.62, -0.2],
  [-1.03, -0.205],
  [-1.43, -0.16],
  [-1.82, -0.09],
  [-2.0, -0.035],
]);
// a tyre as a short cylinder: tread drawn where it faces the camera, then the outer sidewall with a rim
export const WHL_N = 20,
  WHL_C = Array.from({ length: WHL_N }, (_, k) => {
    const a = (k / WHL_N) * Math.PI * 2;
    return [Math.cos(a), Math.sin(a)];
  });
export function drawWheel3(c, w, front) {
  const ch = Math.cos(c.h),
    sh = Math.sin(c.h),
    r = front ? 0.33 : 0.41,
    hw = front ? 0.17 : 0.23;
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
    const rim = WHL_C.map(q => toW(w[0] + q[0] * r * 0.52, near, r + q[1] * r * 0.52));
    ctx.fillStyle = '#aeb3b8';
    ctx.beginPath();
    rim.forEach((p, i) => (i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1])));
    ctx.closePath();
    ctx.fill();
    const hb = toW(w[0], near, r);
    ctx.fillStyle = '#d4d7d9';
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
export const FPLATE = [rect(2.2, 2.93, -1.06, -0.94), rect(2.2, 2.93, 0.94, 1.06)],
  RPLATE = [rect(-2.72, -2.05, -0.82, -0.71), rect(-2.72, -2.05, 0.71, 0.82)];
export const FWING = rect(2.25, 2.88, -0.94, 0.94),
  /** front wing flaps, either side of the nose */
  FFLAP = [rect(2.3, 2.56, -0.97, -0.16), rect(2.3, 2.56, 0.16, 0.97)],
  RWING = rect(-2.68, -2.26, -0.72, 0.72),
  RFLAP = rect(-2.43, -2.13, -0.72, 0.72),
  BEAM = rect(-2.62, -2.36, -0.65, 0.65),
  MIRRORS = [rect(0.38, 0.52, -0.62, -0.46), rect(0.38, 0.52, 0.46, 0.62)],
  INLETS = [rect(0.52, 0.68, -0.74, -0.47), rect(0.52, 0.68, 0.47, 0.74)],
  /** suspension arms: [hull x, hull y, wheel x, wheel y, z], right side (mirrored for the left) */
  ARMS = [
    [1.9, 0.15, 1.58, 0.78, 0.35],
    [1.22, 0.22, 1.58, 0.78, 0.3],
    [1.58, 0.2, 1.58, 0.78, 0.43],
    [-1.12, 0.28, -1.55, 0.82, 0.32],
    [-1.95, 0.2, -1.55, 0.82, 0.35],
    [-1.55, 0.23, -1.55, 0.82, 0.45],
  ],
  WHEELS = [
    [1.58, -0.96],
    [1.58, 0.96],
    [-1.55, -1.02],
    [-1.55, 1.02],
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
  const k1 = c.out ? 0.45 : 1; // a stopped car is drawn darker
  const col = (m: number) => shade(c.col, m * k1),
    acc = (m: number) => shade(c.acc, m * k1);
  const pr = (poly, z0, z1, top, side) => prism(local(c, poly), z0, z1, top, side);
  const toS = (lx, ly, z) => P(c.x + lx * ch - ly * sh, c.y + lx * sh + ly * ch, z);
  const line = (pts, w, colr) => {
    ctx.strokeStyle = colr;
    ctx.lineWidth = Math.max(1, w * cam.zoom);
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    ctx.beginPath();
    pts.forEach((q, i) => {
      const p = toS(q[0], q[1], q[2]);
      i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1]);
    });
    ctx.stroke();
    ctx.lineCap = 'butt';
  };
  const frontWing = () => {
    if (c.dmg >= 0.35) return; // knocked off
    pr(FWING, 0.2, 0.27, col(0.82), col(0.5));
    for (const fl of FFLAP) pr(fl, 0.28, 0.34, acc(0.95), acc(0.6));
    for (const fp of FPLATE) pr(fp, 0.16, 0.58, acc(0.85), acc(0.55));
  };
  const rearWing = () => {
    pr(BEAM, 0.55, 0.62, '#222', '#111');
    pr(rect(-2.53, -2.35, -0.06, 0.06), 0.58, 1.25, '#222', '#111'); // twin rear-wing supports
    pr(RWING, 1.2, 1.28, acc(1), acc(0.6));
    if (c.drs) pr(RFLAP, 1.4, 1.47, acc(1.08), acc(0.65)); // keep the flap in the car's period livery
    else pr(RFLAP, 1.3, 1.38, acc(1.08), acc(0.65));
    for (const rp of RPLATE) pr(rp, 0.5, 1.48, col(0.8), col(0.5));
  };
  const hull = () => {
    for (const a of ARMS)
      for (const sg of [1, -1])
        line(
          [
            [a[0], a[1] * sg, a[4]],
            [a[2], a[3] * sg, 0.32],
          ],
          0.05,
          '#191919',
        );
    pr(FLOOR, 0.07, 0.11, '#1d1d1d', '#101010');
    pr(PODS_LOW, 0.13, 0.3, col(0.62), col(0.4));
    pr(BODY, 0.15, 0.4, col(1), col(0.6));
    pr(PODS, 0.29, 0.5, col(0.95), col(0.6));
    for (const inl of INLETS) pr(inl, 0.32, 0.48, '#0c0c0c', '#0c0c0c');
    pr(NOSE2, 0.4, 0.53, col(1.05), col(0.66));
    pr(TUB, 0.4, 0.58, col(1.04), col(0.64));
    pr(COCKPIT, 0.58, 0.58, '#0b0b0b', '#0b0b0b');
    for (const m of MIRRORS) pr(m, 0.6, 0.69, acc(0.95), acc(0.6));
    // Open cockpit and a separately coloured 1990s helmet; no modern halo.
    const hp = toS(-0.01, 0, 0.79);
    ctx.fillStyle = helmetColor(c);
    ctx.beginPath();
    ctx.ellipse(
      hp[0],
      hp[1],
      Math.max(2.2, 0.27 * cam.zoom),
      Math.max(1.7, 0.21 * cam.zoom),
      0,
      0,
      Math.PI * 2,
    );
    ctx.fill();
    line(
      [
        [0.16, -0.12, 0.82],
        [0.2, 0, 0.84],
        [0.16, 0.12, 0.82],
      ],
      0.065,
      '#111',
    );
    pr(COVER, 0.58, 0.82, col(1.08), col(0.66));
    pr(AIRBOX, 0.78, 1.14, col(1.13), col(0.7));
    pr(rect(-0.7, -0.53, -0.095, 0.095), 1.13, 1.15, '#101214', '#101214'); // large airbox intake
    pr(rect(-1.92, -0.95, -0.025, 0.025), 0.77, 1.0, col(0.9), col(0.6)); // narrow engine-cover fin
  };
  // far end first: fd > 0 means the front of the car points away from the camera
  const fd = ch * GS.cC + sh * GS.cS;
  if (fd > 0) frontWing();
  else rearWing();
  hull();
  WHEELS.forEach((w, k) => {
    if (nearW(w)) drawWheel3(c, w, k < 2);
  });
  if (fd > 0) rearWing();
  else frontWing();
  const tw = Math.max(c.tow, c.boost || 0, (c.streakT || 0) * 1.4); // slipstream, a slingshot, a pass just made (sim/passing.ts)
  if (tw > 0.2) {
    const tm = performance.now() / 1000;
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
  drawCarMarks(c, isMe, isMate);
}

/** flashing light on a stopped car, your car's marker (and your teammate's), name tags of other players */
export function drawCarMarks(c, isMe, isMate) {
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
