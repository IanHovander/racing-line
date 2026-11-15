import { GS } from '../state';
import { clamp, wrapA } from '../core/dom';
import { cars, opts } from '../game/race';
import { BRK, GEARTOP, GRIP, VMAX, autoGear, gearEff, isManual } from './car-model';
import { NEUTRAL } from '../teams/team-stats';
import { WETB } from '../track/track';
// slipstream: a car 5-45 m ahead, roughly in line, cuts drag (higher top speed, more pull)
export function towTarget(c) {
  if (c.v < 28) return 0;
  let best = 0;
  for (const o of cars) {
    if (o === c || o.ghost > 0 || o.out) continue;
    let d = o.s - c.s;
    if (d < -GS.L / 2) d += GS.L;
    else if (d > GS.L / 2) d -= GS.L;
    if (d < 5 || d > 45) continue;
    const lat = Math.abs(o.lat - c.lat);
    if (lat > 2.4) continue;
    const t = (1 - (d - 5) / 40) * (1 - (0.5 * lat) / 2.4) * clamp((o.v - 20) / 30, 0, 1);
    if (t > best) best = t;
  }
  return best;
}
export function physics(c, dt, thr, brk, kd) {
  const al = Math.abs(c.lat);
  const gl = c.lat * GS.gside[c.idx];
  let surf = al <= GS.HW + 0.45 ? 0 : (al <= GS.HW + 1.4 && GS.kerb[c.idx]) || GS.TR.street ? 1 : 2;
  const pw = c.lat > 0 ? GS.PWR[c.idx] : GS.PWL[c.idx];
  if (pw > 0 && al > GS.HW + 0.45 && al < GS.HW + 1.0 + pw) surf = 5;
  else if (GS.gside[c.idx] && gl > GS.GINA[c.idx] && gl < GS.gout[c.idx]) surf = 3;
  else if (surf === 2 && GS.TR.runoffAsphalt) surf = 4;
  const man = isManual(c);
  if (!c.gear) c.gear = 1;
  if (!man) c.gear = autoGear(c.v);
  const gE = man ? gearEff(c.gear, c.v) : 1;
  const st = c.st || NEUTRAL;
  c.dirt =
    surf === 2 || surf === 3 || surf === 4
      ? Math.min(1, (c.dirt || 0) + dt * 1.5)
      : Math.max(0, (c.dirt || 0) - dt * 0.35); // dirty tyres after a trip off the track
  const grip =
    [GRIP, 31, 18, 10, 22, 19][surf] *
    (1 - 0.2 * c.dirt) *
    st.grip *
    c.gm *
    (opts.rain ? [0.72, 0.55, 0.7, 0.85, 0.7, 0.55][surf] : 1);
  const v = c.v;
  const dr = c.drs ? 1 : 0;
  if (c.boostT > 0) c.boostT -= dt; // launch boost after a quick start
  let a =
    thr *
    (c.boostT > 0 ? c.launchBoost : 1) *
    (13 *
      st.acc *
      (1 + 0.06 * dr) *
      gE *
      (1 - 0.25 * c.dmg) *
      Math.max(0, 1 - (v / (VMAX * st.top * (1 + 0.075 * c.tow + 0.055 * dr) * (1 - 0.12 * c.dmg))) ** 2) +
      0.9 * c.tow * (gE > 0 ? 1 : 0));
  if (thr < 0.05) a -= 2.5 + v * 0.02 + (man ? 2.2 * Math.min(1, v / GEARTOP[c.gear]) : 0); // engine braking is stronger in a lower gear
  a -= brk * [BRK, 38, 18, 10, 30, 22][surf] * st.brk * (0.6 + 0.4 * c.gm) * WETB();
  a -= 9.81 * (GS.SL[c.idx] || 0);
  if (surf === 2) a -= 1.6 + v * 0.08 + v * v * 0.0018;
  else if (surf === 3) a -= 4 + v * 0.22;
  else if (surf === 4) a -= 1.0 + v * 0.05 + v * v * 0.0012;
  else if (surf === 5) a -= 1.2 + v * 0.06 + v * v * 0.0013;
  const kmax = Math.min(grip / Math.max(v * v, 4), 1 / 7);
  let k = kd;
  c.slide = 0;
  if (Math.abs(k) > kmax) {
    c.slide = Math.min(1, (Math.abs(k) - kmax) / kmax);
    k = Math.sign(k) * kmax;
    if (v > 12) a -= c.slide * 11;
  }
  c.v = Math.max(0, v + a * dt);
  const vTurn = Math.max(c.v, thr > 0.05 ? 3 : 0);
  c.h = wrapA(c.h + vTurn * Math.sign(k) * Math.min(Math.abs(k), Math.max(kmax, 1 / 7)) * dt);
  c.x += Math.cos(c.h) * c.v * dt;
  c.y += Math.sin(c.h) * c.v * dt;
  c.surf = surf;
  c.thr = thr;
  c.brk = brk;
}
export function locate(c) {
  let best = c.idx,
    bd = 1e18;
  for (let k = -35; k <= 35; k++) {
    const i = (c.idx + k + GS.N) % GS.N;
    const d = (c.x - GS.cx[i]) ** 2 + (c.y - GS.cy[i]) ** 2;
    if (d < bd) {
      bd = d;
      best = i;
    }
  }
  c.idx = best;
  c.hz = GS.HT[best] || 0;
  c.lat = (c.x - GS.cx[best]) * GS.nx[best] + (c.y - GS.cy[best]) * GS.ny[best];
  let s = best * GS.SEG + (c.x - GS.cx[best]) * GS.tx[best] + (c.y - GS.cy[best]) * GS.ty[best];
  c.s = (s + GS.L) % GS.L;
}
