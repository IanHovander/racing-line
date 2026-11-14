import { GS } from '../state';
import { H, W, ctx } from '../core/dom';
import { P, cam } from './camera';
// ================= Rendering =================
export const OV = (o, i) => typeof o === 'number' ? o : o.R ? o.R[i] : o[i], OVL = (o, i) => typeof o === 'number' ? o : o.L ? o.L[i] : o[i];
export let BAND_RULE = 'evenodd';
export function band(o, col, z?) {
  const zy = -(z || 0) * cam.zoom * cam.hz;
  ctx.beginPath();
  if (!GS.BRIDGE) {
    BAND_RULE = 'evenodd'; // a track that never crosses itself: two edge loops, filled even-odd (fast)
    for (let i = 0; i < GS.N; i++) {
      const v = OV(o, i);
      i ? ctx.lineTo(GS.TSX[i] + GS.NSX[i] * v, GS.TSY[i] + GS.NSY[i] * v + zy) : ctx.moveTo(GS.TSX[i] + GS.NSX[i] * v, GS.TSY[i] + GS.NSY[i] * v + zy);
    }
    ctx.closePath();
    for (let i = 0; i < GS.N; i++) {
      const v = OVL(o, i);
      i ? ctx.lineTo(GS.TSX[i] - GS.NSX[i] * v, GS.TSY[i] - GS.NSY[i] * v + zy) : ctx.moveTo(GS.TSX[i] - GS.NSX[i] * v, GS.TSY[i] - GS.NSY[i] * v + zy);
    }
    ctx.closePath();
    ctx.fillStyle = col;
    ctx.fill('evenodd');
    return;
  }
  BAND_RULE = 'nonzero';
  const m = 60 * cam.zoom; // figure of eight: per-segment quads so the crossing isn't cut out
  for (let i = 0; i < GS.N; i++) {
    const j = (i + 1) % GS.N;
    const vi = OV(o, i), vj = OV(o, j), li = OVL(o, i), lj = OVL(o, j);
    if (!onScr(GS.TSX[i], GS.TSY[i], m + Math.abs(GS.NSX[i] * vi) + Math.abs(GS.NSY[i] * vi)))
      continue;
    ctx.moveTo(GS.TSX[i] + GS.NSX[i] * vi, GS.TSY[i] + GS.NSY[i] * vi + zy);
    ctx.lineTo(GS.TSX[j] + GS.NSX[j] * vj, GS.TSY[j] + GS.NSY[j] * vj + zy);
    ctx.lineTo(GS.TSX[j] - GS.NSX[j] * lj, GS.TSY[j] - GS.NSY[j] * lj + zy);
    ctx.lineTo(GS.TSX[i] - GS.NSX[i] * li, GS.TSY[i] - GS.NSY[i] * li + zy);
    ctx.closePath();
  }
  ctx.fillStyle = col;
  ctx.fill('nonzero');
}
export function edge(o, z, sg) { const zy = -z * cam.zoom * cam.hz; for (let i = 0; i < GS.N; i++) {
  const v = (sg > 0 ? OV(o, i) : OVL(o, i)) * sg;
  i ? ctx.lineTo(GS.TSX[i] + GS.NSX[i] * v, GS.TSY[i] + GS.NSY[i] * v + zy) : ctx.moveTo(GS.TSX[i] + GS.NSX[i] * v, GS.TSY[i] + GS.NSY[i] * v + zy);
} ctx.closePath(); }
export const onScr = (x, y, m) => x > -m && x < W + m && y > -m && y < H + m;
export function prism(wp, z0, z1, top, side) {
  let mx = 0, my = 0;
  for (const p of wp) {
    mx += p[0];
    my += p[1];
  }
  mx /= wp.length;
  my /= wp.length;
  const B = wp.map(p => P(p[0], p[1], z0)), T = wp.map(p => P(p[0], p[1], z1));
  if (z1 - z0 > 0.01) {
    ctx.fillStyle = side;
    for (let i = 0; i < wp.length; i++) {
      const j = (i + 1) % wp.length;
      const ex = wp[j][0] - wp[i][0], ey = wp[j][1] - wp[i][1];
      let nX = ey, nY = -ex;
      const qx = (wp[i][0] + wp[j][0]) / 2 - mx, qy = (wp[i][1] + wp[j][1]) / 2 - my;
      if (nX * qx + nY * qy < 0) {
        nX = -nX;
        nY = -nY;
      }
      if (nX * GS.cC + nY * GS.cS < 0) {
        ctx.beginPath();
        ctx.moveTo(B[i][0], B[i][1]);
        ctx.lineTo(B[j][0], B[j][1]);
        ctx.lineTo(T[j][0], T[j][1]);
        ctx.lineTo(T[i][0], T[i][1]);
        ctx.closePath();
        ctx.fill();
      }
    }
  }
  ctx.fillStyle = top;
  ctx.beginPath();
  ctx.moveTo(T[0][0], T[0][1]);
  for (let i = 1; i < T.length; i++)
    ctx.lineTo(T[i][0], T[i][1]);
  ctx.closePath();
  ctx.fill();
}
/** debug/test hook: reassign a module-level binding */
export function __set(name: string, v: any): void {
  switch (name) {
    case 'BAND_RULE':
      BAND_RULE = v;
      break;
  }
}
