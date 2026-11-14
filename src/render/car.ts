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
// Car parts as outlines in car coordinates (x forward, y to the right, metres), each drawn as a slab between
// two heights. The hull is stacked in steps so the nose slopes down, the sidepods are undercut, and the
// engine cover rises to an airbox and tapers to the rear.
/** lower hull, nose tip to gearbox */
export const BODY = mirror([
  [2.9, -0.04],
  [2.82, -0.08],
  [2.6, -0.115],
  [2.3, -0.145],
  [1.95, -0.18],
  [1.6, -0.21],
  [1.25, -0.24],
  [0.9, -0.275],
  [0.5, -0.3],
  [0.0, -0.315],
  [-0.5, -0.32],
  [-1.0, -0.31],
  [-1.5, -0.28],
  [-1.9, -0.23],
  [-2.2, -0.16],
  [-2.38, -0.1],
]);
/** second nose step */
export const NOSE2 = mirror([
  [2.25, -0.1],
  [1.95, -0.15],
  [1.6, -0.19],
  [1.25, -0.22],
]);
/** monocoque and engine bay, above the lower hull */
export const TUB = mirror([
  [1.3, -0.2],
  [1.0, -0.25],
  [0.6, -0.285],
  [0.1, -0.3],
  [-0.5, -0.3],
  [-1.0, -0.285],
  [-1.5, -0.24],
  [-1.9, -0.18],
  [-2.25, -0.09],
]);
export const COCKPIT = mirror([
  [0.58, -0.12],
  [0.42, -0.19],
  [0.0, -0.21],
  [-0.3, -0.2],
  [-0.42, -0.12],
]);
/** floor, wider than the body between the wheels */
export const FLOOR = mirror([
  [1.25, -0.26],
  [1.02, -0.72],
  [0.8, -0.82],
  [-1.02, -0.85],
  [-1.1, -0.7],
  [-2.05, -0.68],
  [-2.3, -0.32],
]);
/** sidepods: an undercut lower part and a wider top */
export const PODS_LOW = mirror([
  [0.6, -0.3],
  [0.52, -0.52],
  [0.36, -0.63],
  [0.0, -0.66],
  [-0.5, -0.65],
  [-1.0, -0.56],
  [-1.5, -0.4],
  [-2.0, -0.24],
]);
export const PODS = mirror([
  [0.72, -0.3],
  [0.68, -0.52],
  [0.6, -0.66],
  [0.46, -0.75],
  [0.2, -0.79],
  [-0.15, -0.8],
  [-0.5, -0.78],
  [-0.85, -0.72],
  [-1.2, -0.61],
  [-1.5, -0.48],
  [-1.8, -0.35],
  [-2.05, -0.25],
]);
/** engine cover and the airbox on top of it */
export const COVER = mirror([
  [-0.34, -0.19],
  [-0.48, -0.26],
  [-0.8, -0.275],
  [-1.2, -0.25],
  [-1.6, -0.19],
  [-2.0, -0.11],
  [-2.3, -0.05],
]);
export const AIRBOX = mirror([
  [-0.36, -0.12],
  [-0.5, -0.165],
  [-0.8, -0.165],
  [-1.2, -0.13],
  [-1.6, -0.085],
  [-1.95, -0.04],
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
export const FPLATE = [rect(2.28, 2.92, -1.05, -0.97), rect(2.28, 2.92, 0.97, 1.05)],
  RPLATE = [rect(-2.66, -2.08, -0.85, -0.77), rect(-2.66, -2.08, 0.77, 0.85)];
export const FWING = rect(2.42, 2.88, -0.98, 0.98),
  /** front wing flaps, either side of the nose */
  FFLAP = [rect(2.3, 2.56, -0.97, -0.16), rect(2.3, 2.56, 0.16, 0.97)],
  RWING = rect(-2.62, -2.3, -0.78, 0.78),
  RFLAP = rect(-2.4, -2.14, -0.78, 0.78),
  BEAM = rect(-2.58, -2.34, -0.7, 0.7),
  MIRRORS = [rect(0.42, 0.54, -0.6, -0.44), rect(0.42, 0.54, 0.44, 0.6)],
  INLETS = [rect(0.62, 0.73, -0.7, -0.34), rect(0.62, 0.73, 0.34, 0.7)],
  /** suspension arms: [hull x, hull y, wheel x, wheel y, z], right side (mirrored for the left) */
  ARMS = [
    [1.85, 0.16, 1.55, 0.76, 0.33],
    [1.3, 0.22, 1.55, 0.76, 0.3],
    [1.55, 0.2, 1.55, 0.76, 0.42],
    [-1.1, 0.27, -1.5, 0.75, 0.3],
    [-1.85, 0.2, -1.5, 0.75, 0.33],
    [-1.5, 0.22, -1.5, 0.75, 0.44],
  ],
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
    pr(FWING, 0.05, 0.11, col(0.8), col(0.5));
    for (const fl of FFLAP) pr(fl, 0.13, 0.19, acc(0.95), acc(0.6));
    for (const fp of FPLATE) pr(fp, 0.04, 0.3, acc(0.85), acc(0.55));
  };
  const rearWing = () => {
    pr(BEAM, 0.42, 0.47, '#222', '#111');
    pr(rect(-2.5, -2.3, -0.05, 0.05), 0.4, 0.92, '#222', '#111'); // pylon
    pr(RWING, 0.9, 0.97, acc(1), acc(0.6));
    if (c.drs) pr(RFLAP, 1.17, 1.23, '#2e7dff', '#1d4fb0'); // flap open
    else pr(RFLAP, 1.0, 1.1, acc(1.08), acc(0.65));
    for (const rp of RPLATE) pr(rp, 0.3, 1.14, col(0.8), col(0.5));
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
    pr(FLOOR, 0.06, 0.1, '#1d1d1d', '#101010');
    pr(PODS_LOW, 0.1, 0.24, col(0.6), col(0.38));
    pr(BODY, 0.12, 0.34, col(1), col(0.6));
    pr(PODS, 0.24, 0.44, col(0.94), col(0.55));
    for (const inl of INLETS) pr(inl, 0.26, 0.43, '#0c0c0c', '#0c0c0c');
    pr(NOSE2, 0.34, 0.42, col(1.05), col(0.66));
    pr(TUB, 0.34, 0.52, col(1.06), col(0.64));
    pr(COCKPIT, 0.52, 0.52, '#0b0b0b', '#0b0b0b');
    for (const m of MIRRORS) pr(m, 0.56, 0.64, acc(0.95), acc(0.6));
    // helmet with a visor, then the engine cover behind it and the halo around it
    const hp = toS(-0.02, 0, 0.74);
    ctx.fillStyle = c.acc;
    ctx.beginPath();
    ctx.arc(hp[0], hp[1], Math.max(2, 0.23 * cam.zoom), 0, 7);
    ctx.fill();
    line(
      [
        [0.14, -0.11, 0.78],
        [0.19, 0, 0.78],
        [0.14, 0.11, 0.78],
      ],
      0.07,
      '#111',
    );
    pr(COVER, 0.52, 0.74, col(1.1), col(0.68));
    pr(AIRBOX, 0.74, 0.97, col(1.16), col(0.74));
    pr(rect(-0.36, -0.33, -0.1, 0.1), 0.78, 0.95, '#0b0b0b', '#0b0b0b'); // air intake
    pr(rect(-2.28, -1.5, -0.02, 0.02), 0.74, 0.92, col(0.9), col(0.6)); // shark fin
    line(
      [
        [-0.34, -0.25, 0.6],
        [-0.2, -0.26, 0.86],
        [0.3, -0.22, 0.86],
        [0.52, 0, 0.86],
        [0.3, 0.22, 0.86],
        [-0.2, 0.26, 0.86],
        [-0.34, 0.25, 0.6],
      ],
      0.05,
      '#17181b',
    );
    line(
      [
        [0.52, 0, 0.86],
        [0.64, 0, 0.52],
      ],
      0.045,
      '#17181b',
    );
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
