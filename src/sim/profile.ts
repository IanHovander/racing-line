import { GS } from '../state';
import { clamp } from '../core/dom';
import { BPROF, GPROF, VCAP, VMAX } from './car-model';
import { NEUTRAL, TEAM_STATS } from '../teams/team-stats';
import { WETB, WETG } from '../track/track';
export let PROF = [];
GS.PZONE = [];
// speed profile for one car spec: grip-limited corners, braking into them, accelerating out
export function profileFor(st, zoneOut?) {
  const F = () => new Float64Array(GS.N);
  const G = GPROF * WETG() * st.grip, B = BPROF * WETB() * st.brk, cap = VCAP * st.top, vm = VMAX * st.top;
  const v = F();
  for (let i = 0; i < GS.N; i++)
    v[i] = Math.min(cap, Math.sqrt(G / Math.max(GS.rk[i], 1e-6)));
  for (let r = 0; r < 2; r++)
    for (let i = GS.N - 1; i >= 0; i--) {
      const j = (i + 1) % GS.N;
      v[i] = Math.min(v[i], Math.sqrt(v[j] * v[j] + 2 * Math.max(8, B + 9.81 * GS.SL[i]) * GS.SEG));
    }
  const acc = u => 13 * st.acc * Math.max(0, 1 - (u / vm) ** 2);
  for (let r = 0; r < 2; r++)
    for (let i = 0; i < GS.N; i++) {
      const j = (i - 1 + GS.N) % GS.N;
      v[i] = Math.min(v[i], Math.sqrt(Math.max(0, v[j] * v[j] + 2 * (acc(v[j]) - 9.81 * GS.SL[j]) * GS.SEG)));
    }
  // zones: red only where the brakes are really needed (deceleration beyond what drag and an uphill slope give), green when gaining speed or flat out, yellow holding speed
  if (zoneOut) {
    for (let i = 0; i < GS.N; i++) {
      const j = (i + 1) % GS.N;
      const dec = (v[i] * v[i] - v[j] * v[j]) / (2 * GS.SEG) - 9.81 * GS.SL[i];
      zoneOut[i] = dec > 3 ? 1 : (v[j] > v[i] + 0.02 || v[i] > cap - 0.5) ? 0 : 2;
    }
    // tidy: drop red blips shorter than 8 m, and fill gaps under 6 m inside a braking zone
    const runs = val => { const out = []; let i0 = -1; for (let k = 0; k < GS.N * 2; k++) {
      const i = k % GS.N;
      if (zoneOut[i] === val) {
        if (i0 < 0)
          i0 = k;
      }
      else if (i0 >= 0) {
        out.push([i0, k]);
        i0 = -1;
        if (k >= GS.N)
          break;
      }
    } return out; };
    const mx = Math.ceil(8 / GS.SEG);
    for (const [a, b] of runs(1))
      if (b - a < mx)
        for (let k = a; k < b; k++)
          zoneOut[k % GS.N] = 2;
    const gp = Math.ceil(6 / GS.SEG);
    for (let i = 0; i < GS.N; i++) {
      if (zoneOut[i] !== 1)
        continue;
      let k = 1;
      while (k <= gp && zoneOut[(i + k) % GS.N] !== 1)
        k++;
      if (k > 1 && k <= gp)
        for (let q = 1; q < k; q++)
          zoneOut[(i + q) % GS.N] = 1;
    }
  }
  return v;
}
// racing-line colours just ahead of your car follow YOUR speed: red starts where you would actually have to brake, so a slow car isn't told to brake early
export let LZ = null;
export function liveZone(c, base) {
  if (!c || c.out || !PROF.length)
    return base;
  if (!LZ || LZ.length !== GS.N)
    LZ = new Uint8Array(GS.N);
  LZ.set(base);
  const st = c.st || NEUTRAL, v = PROF[c.team] || GS.vf, vm = VMAX * st.top, cap = VCAP * st.top;
  let u = c.v;
  for (let k = 0; k < Math.round(450 / GS.SEG); k++) {
    const i = (c.idx + k) % GS.N, j = (i + 1) % GS.N;
    // speed limit at the next sample: you can brake from u down to v[j] only if u is no more than the braking curve allows
    const a = 13 * st.acc * Math.max(0, 1 - (u / vm) ** 2) - 9.81 * GS.SL[i];
    const un = Math.min(cap, Math.sqrt(Math.max(0, u * u + 2 * a * GS.SEG)));
    if (u > v[i] * 1.04 + 1.5) {
      // faster than the line allows here: only a braking zone if the limit is a corner (not the top-speed cap on a straight) and you really have to slow down
      const capped = v[i] > cap - 1.5 || (base[i] !== 1 && v[j] >= v[i] - 0.05);
      if (capped || k < Math.round(6 / GS.SEG)) {
        LZ[i] = capped ? 0 : base[i];
        u = v[j];
      }
      else {
        LZ[i] = 1;
        u = Math.max(v[j], Math.sqrt(Math.max(0, u * u - 2 * Math.max(8, BPROF * WETB() * st.brk + 9.81 * GS.SL[i]) * GS.SEG)));
      }
    }
    else if (un <= v[j]) {
      LZ[i] = un > u + 0.02 || u > cap - 0.5 ? 0 : 2;
      u = un;
    }
    else {
      const nu = Math.min(un, v[j]), uu = Math.min(u, v[i]);
      LZ[i] = (uu * uu - nu * nu) / (2 * GS.SEG) - 9.81 * GS.SL[i] > 3 ? 1 : (base[i] === 0 && nu >= uu - 0.05 ? 0 : 2);
      u = nu;
    }
  }
  return LZ;
}
// back to the racing line without hurry: off the line on a straight, keep your position and ease back so you meet the line at the next turn-in
export function rejoin(c) {
  const ZN = GS.zone;
  if (Math.abs(c.lane) < 0.25 && !c.hold) {
    return 0;
  }
  if (!c.hold)
    c.hold = { lat: c.lat };
  let d = 0;
  const mx = Math.round(320 / GS.SEG);
  for (; d < mx; d++) {
    const i = (c.idx + d) % GS.N;
    if (ZN[i] === 1 || Math.abs(GS.ccurv[i]) > 1 / 180)
      break;
  }
  const dist = d * GS.SEG, span = Math.max(90, c.v * 3.2);
  const w = dist <= 25 ? 1 : clamp(1 - (dist - 25) / span, 0, 1);
  const tgtLat = c.hold.lat * (1 - w) + GS.off[c.idx] * w;
  if (w >= 1 && Math.abs(c.lane) < 0.3)
    c.hold = null;
  return clamp(tgtLat, -(GS.HW - 1.2), GS.HW - 1.2) - GS.off[c.idx];
}
export let LANEPROF = {};
export function laneProfile(side, team) {
  const key = side + ':' + team;
  if (LANEPROF[key])
    return LANEPROF[key];
  const o = side * (GS.HW - 1.7), k = new Float64Array(GS.N), raw = new Float64Array(GS.N);
  const px = i => GS.cx[i] + GS.nx[i] * o, py = i => GS.cy[i] + GS.ny[i] * o;
  for (let i = 0; i < GS.N; i++) {
    const a = (i - 4 + GS.N) % GS.N, b = (i + 4) % GS.N;
    const cr = (px(i) - px(a)) * (py(b) - py(a)) - (py(i) - py(a)) * (px(b) - px(a));
    const d = Math.hypot(px(i) - px(a), py(i) - py(a)) * Math.hypot(px(b) - px(i), py(b) - py(i)) * Math.hypot(px(b) - px(a), py(b) - py(a));
    raw[i] = Math.abs(2 * cr / Math.max(d, 1e-6));
  }
  for (let i = 0; i < GS.N; i++) {
    let s = 0;
    for (let q = -3; q <= 3; q++)
      s += raw[(i + q + GS.N) % GS.N];
    k[i] = s / 7;
  }
  const save = GS.rk;
  GS.rk = k;
  const v = profileFor(TEAM_STATS[team] || NEUTRAL);
  GS.rk = save;
  return LANEPROF[key] = v;
}
export function buildProfile() {
  if (!GS.N)
    return;
  LANEPROF = {};
  const F = () => new Float64Array(GS.N);
  {
    const raw = F();
    for (let i = 0; i < GS.N; i++) {
      const a = (i - 4 + GS.N) % GS.N, b = (i + 4) % GS.N;
      const ax = GS.rx[a], ay = GS.ry[a], bx = GS.rx[b], by = GS.ry[b], px = GS.rx[i], py = GS.ry[i];
      const cr = (px - ax) * (by - ay) - (py - ay) * (bx - ax);
      const d = Math.hypot(px - ax, py - ay) * Math.hypot(bx - px, by - py) * Math.hypot(bx - ax, by - ay);
      raw[i] = Math.abs(2 * cr / Math.max(d, 1e-6));
    }
    for (let i = 0; i < GS.N; i++) {
      let s = 0;
      for (let k = -3; k <= 3; k++)
        s += raw[(i + k + GS.N) % GS.N];
      GS.rk[i] = s / 7;
    }
    const vr = F();
    for (let i = 0; i < GS.N; i++)
      vr[i] = Math.min(VCAP, Math.sqrt(GPROF * WETG() / Math.max(GS.rk[i], 1e-6)));
    const vb = Float64Array.from(vr);
    for (let r = 0; r < 2; r++)
      for (let i = GS.N - 1; i >= 0; i--) {
        const j = (i + 1) % GS.N;
        vb[i] = Math.min(vb[i], Math.sqrt(vb[j] * vb[j] + 2 * BPROF * WETB() * GS.SEG));
      }
    GS.vf.set(profileFor(NEUTRAL, GS.zone));
    PROF = TEAM_STATS.map(st => profileFor(st));
    GS.PZONE = [];
  }
}
/** debug/test hook: reassign a module-level binding */
export function __set(name: string, v: any): void {
  switch (name) {
    case 'PROF':
      PROF = v;
      break;
    case 'LZ':
      LZ = v;
      break;
    case 'LANEPROF':
      LANEPROF = v;
      break;
  }
}
