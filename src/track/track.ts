import { GS } from '../state';
import { clamp, store } from '../core/dom';
GS.seed = 7;
export const rnd = () => {
  GS.seed = (GS.seed * 16807) % 2147483647;
  return GS.seed / 2147483647;
};
export function catmull(p0, p1, p2, p3, t) {
  const t2 = t * t,
    t3 = t2 * t;
  const f = i =>
    0.5 *
    (2 * p1[i] +
      (-p0[i] + p2[i]) * t +
      (2 * p0[i] - 5 * p1[i] + 4 * p2[i] - p3[i]) * t2 +
      (-p0[i] + 3 * p1[i] - 3 * p2[i] + p3[i]) * t3);
  return [f(0), f(1)];
}
export function resample(pts, ds) {
  const out = [pts[0].slice()];
  let acc = 0,
    prev = pts[0];
  for (let i = 1; i <= pts.length; i++) {
    const cur = pts[i % pts.length];
    let sx = cur[0] - prev[0],
      sy = cur[1] - prev[1],
      len = Math.hypot(sx, sy);
    while (acc + len >= ds && len > 1e-9) {
      const t = (ds - acc) / len;
      const np = [prev[0] + sx * t, prev[1] + sy * t];
      out.push(np);
      prev = np;
      sx = cur[0] - prev[0];
      sy = cur[1] - prev[1];
      len = Math.hypot(sx, sy);
      acc = 0;
    }
    acc += len;
    prev = cur;
  }
  const l = out[out.length - 1];
  if (Math.hypot(l[0] - out[0][0], l[1] - out[0][1]) < ds * 0.6) out.pop();
  return out;
}
// all per-track data lives in these globals, rebuilt by buildTrack()
export let NEONQ = [];
GS.cpIdx = null;
GS.STAD = null;
GS.BRIDGE = null;
GS.WHEEL = null;
GS.SPHERE = null;
GS.FOUNT = [];
export const TUN_STYLE = 2;
// Monaco tunnel: open cut-away with lit walls and portals (chosen over a hotel roof and a glass roof)
GS.DRSZ = [];
GS.DRSMAP = new Int8Array(1);
GS.CORNERS = [];
GS.CMAP = new Int16Array(1);
GS.SECI = [0, 0, 0];
GS.SECB = [0, 0, 0];
GS.SB = [0, 0, 0];
export const cornerAt = i => {
    const n = GS.CMAP[i];
    return n > 0 ? 'T' + n : '';
  },
  nextCorner = i => GS.CORNERS[GS.NEXTC[i]] || null;
GS.NEXTC = new Int16Array(1);
GS.PIT_SIDE = 1;
export const PIT_RL = 26;
GS.PWR = new Float64Array(1);
GS.PWL = new Float64Array(1);
GS.SWR = new Float64Array(1);
GS.SWL = new Float64Array(1);
GS.GINA = new Float64Array(1);
GS.FLAGPOLES = [];
GS.PITLANE = null;
GS.WATER = [];
GS.TUN = null;
GS.LIGHTS = [];
GS.HT = new Float64Array(1);
GS.SL = new Float64Array(1);
GS.HG = null;
export const outSideT = s => s;
export const inPoly = (x, y, poly) => {
  let c = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i],
      b = poly[j];
    if (a[1] > y !== b[1] > y && x < ((b[0] - a[0]) * (y - a[1])) / (b[1] - a[1]) + a[0]) c = !c;
  }
  return c;
};
export const inWater = (x, y) => GS.WATER.some(p => inPoly(x, y, p));
export function hAt(x, y) {
  if (!GS.HG) return 0;
  const fx = (x - GS.HG.x0) / GS.HG.cs,
    fy = (y - GS.HG.y0) / GS.HG.cs;
  const ix = clamp(Math.floor(fx), 0, GS.HG.gw - 2),
    iy = clamp(Math.floor(fy), 0, GS.HG.gh - 2),
    ux = clamp(fx - ix, 0, 1),
    uy = clamp(fy - iy, 0, 1);
  const g = GS.HG.g,
    w = GS.HG.gw;
  return (
    (g[iy * w + ix] * (1 - ux) + g[iy * w + ix + 1] * ux) * (1 - uy) +
    (g[(iy + 1) * w + ix] * (1 - ux) + g[(iy + 1) * w + ix + 1] * ux) * uy
  );
}
export let WX: any;
export const WETG = () => (WX.rain ? 0.72 : 1),
  WETB = () => (WX.rain ? 0.75 : 1);
export function init(): void {
  WX = { rain: store.get('rain', 0) };
}
/** debug/test hook: reassign a module-level binding */
export function __set(name: string, v: any): void {
  switch (name) {
    case 'NEONQ':
      NEONQ = v;
      break;
    case 'WX':
      WX = v;
      break;
  }
}
