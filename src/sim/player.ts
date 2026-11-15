import { GS } from '../state';
import { clamp } from '../core/dom';
import { cars, opts } from '../game/race';
import { input } from '../input/input';
import { aheadCap, laneSafe, passGap, passTarget, pursuit, pursuitLane, renderLaneInd, traffic } from './ai';
import { GRIP, VMAX } from './car-model';
import { AIL, DYN, dynAheadCap, dynObstacles, dynOn } from './lines';
import { PROF, rejoin } from './profile';
import { NEUTRAL } from '../teams/team-stats';
import { WETG } from '../track/track';
export function controlPlayer(c, dt) {
  let thr = 0,
    brk = 0,
    k = 0,
    safe;
  // steering
  const dyn = opts.steer === 0 && dynOn(c); // the planner drives this car (sim/lines.ts)
  if (dyn) {
    const u = DYN.control(c, dynObstacles(c), { attack: !!input.thr }, dt);
    k = u.k;
    safe = u.safe;
    c.hold = null;
    c.lane = clamp(c.lat - (AIL[c.team] || GS.off)[c.idx], -GS.HW, GS.HW); // kept up to date for when the AI takes the car over
  } else if (opts.steer === 0) {
    const t = traffic(c);
    const free = t[2] === 0 && t[0] === 0;
    const tg = free ? rejoin(c) : ((c.hold = null), t[0]);
    const r = dt * (3 + t[2] * 3);
    c.lane += clamp(tg - c.lane, -r, r);
    k = pursuit(c);
    safe = Math.min(t[1], (PROF[c.team] || GS.vf)[(c.idx + 4) % GS.N] * Math.sqrt(c.gm));
  } else if (opts.steer === 3) {
    const EDGE = GS.HW - 1.1;
    GS.PASS.near = passTarget(c);
    if (GS.PASS.side && !GS.PASS.car) {
      GS.PASS.armed -= dt;
      if (GS.PASS.near) GS.PASS.car = GS.PASS.near;
      else if (GS.PASS.armed <= 0) GS.PASS.side = 0;
    }
    let o = GS.PASS.car;
    if (o && (o.gone || o.out)) {
      GS.PASS.side = 0;
      GS.PASS.car = o = null;
    }
    if (GS.PASS.side && o) {
      GS.PASS.t += dt;
      const g = passGap(c, o);
      if (g < -7.5 || g > 90 || GS.PASS.t > 14) {
        GS.PASS.side = 0;
        GS.PASS.car = null;
        o = null;
      }
    }
    let tgt;
    const slowAhead = GS.PASS.near && GS.PASS.near.v < 15;
    if (GS.PASS.side && o) {
      c.hold = null;
      const want = o.lat + GS.PASS.side * 3.2;
      GS.PASS.blocked = Math.abs(want) > EDGE + 0.4;
      if (GS.PASS.blocked) {
        const hold = GS.PASS.side > 0 ? Math.max(c.lat, o.lat + 0.2) : Math.min(c.lat, o.lat - 0.2);
        tgt = clamp(hold, -EDGE, EDGE) - GS.off[c.idx];
      } // no room on that side yet: wait on that side of its gearbox
      else tgt = clamp(want, -EDGE, EDGE) - GS.off[c.idx];
    } else if (slowAhead) {
      tgt = traffic(c)[0];
    } // stalled or wrecked car: steer round it for you
    else tgt = rejoin(c);
    // never squeeze into a car running alongside
    let lo = -EDGE,
      hi = EDGE;
    for (const q of cars) {
      if (q === c || q.gone) continue;
      const d = passGap(c, q);
      if (Math.abs(d) > 6.5) continue;
      const gq = q.lat - c.lat;
      if (Math.abs(gq) > 4.2) continue;
      if (gq >= 0) hi = Math.min(hi, q.lat - 3.1);
      else lo = Math.max(lo, q.lat + 3.1);
    }
    let lat = GS.off[c.idx] + tgt;
    if (lo <= hi) lat = clamp(lat, lo, hi);
    else lat = c.lat;
    tgt = lat - GS.off[c.idx];
    const r = dt * (GS.PASS.side ? 4.5 : 2.5);
    c.lane += clamp(tgt - c.lane, -r, r);
    k = pursuit(c);
    const sv = clamp(c.lane / (GS.HW - 1.7), -1, 1);
    safe = laneSafe(c, sv, 4);
    if (slowAhead) safe = Math.min(safe, traffic(c)[1]);
    if (Math.random() < dt * 8) renderLaneInd();
  } else if (opts.steer === 1) {
    c.lsm = (c.lsm || 0) + clamp(GS.LANE_SEL - (c.lsm || 0), -dt * 1.6, dt * 1.6);
    c.lane = 0;
    k = pursuitLane(c, c.lsm);
    safe = laneSafe(c, c.lsm, 4);
  } else {
    const s = (input.right ? 1 : 0) - (input.left ? 1 : 0);
    c.steer += clamp(s - c.steer, -dt * 5, dt * 5);
    const kmax = Math.min(1 / 8, (1.2 * GRIP * WETG() * (c.st || NEUTRAL).grip) / Math.max(c.v * c.v, 1));
    k = c.steer * kmax;
    safe = (PROF[c.team] || GS.vf)[(c.idx + 4) % GS.N] * Math.sqrt(c.gm);
  }
  if (c.drs && !dyn) safe *= 1.06; // the planner works from the real speed of the car, so it needs no DRS allowance
  c.safeV = safe;
  // throttle: you hold the gas; lift off and the car brakes itself to the safe speed
  thr = input.thr ? 1 : 0;
  if (!thr && c.v > safe + 0.3) brk = 1;
  else if (!thr && dyn && DYN.hold && c.v > 8 && c.v < safe - 0.6) {
    // Novice line: lifting holds the present speed instead of coasting down, so the only timing that matters is lifting before the braking point
    const st = c.st || NEUTRAL;
    thr = clamp(
      0.06 +
        (9.81 * Math.max(0, GS.SL[c.idx] || 0)) /
          Math.max(1, 13 * st.acc * (1 - (c.v / (VMAX * st.top)) ** 2)),
      0.06,
      0.7,
    );
  }
  // contact assist while the car is steering for you
  if (opts.steer !== 2) {
    const ah = dyn ? dynAheadCap(c) : aheadCap(c);
    if (c.v > ah + 0.5) {
      thr = 0;
      brk = Math.max(brk, clamp((c.v - ah) / 4, 0.25, 1));
    } else if (c.v > ah - 1.5) thr = Math.min(thr, 0.3);
  }
  return [thr, brk, k];
}
