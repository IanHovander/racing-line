import { GS } from '../state';
import { $, clamp } from '../core/dom';
import { attract, cars, opts } from '../game/race';
import { BPROF, VCAP } from './car-model';
import { AIK, AIL, AIV, AIZ, DYN_AIB, aiSteer } from './lines';
import { PROF, laneProfile } from './profile';
import { inYellow } from './step';
import { passAI } from './passing';
import { DRV } from '../teams/drivers';
import { NEUTRAL } from '../teams/team-stats';
import { WETB, nextCorner } from '../track/track';
import { showToast } from '../ui/controls';
// ================= Simulation =================
export const STEP = 1 / 120;
GS.HITS = 0;
// look ahead in proportion to closing speed; steer around slow/stopped cars, brake if there is no gap.
// LN is the line the car is driving (lane offsets are measured from it): the classic line unless given.
export function traffic(c, LN = GS.off) {
  let desired = 0,
    cap = 1e9,
    urg = 0,
    bestD = 1e9;
  const EDGE = GS.HW - 1.2;
  const yz = inYellow(c);
  const ag = c.mine && c === cars[GS.ctrl] ? 0.5 : DRV(c).aggr;
  for (const o of cars) {
    if (o === c || o.gone) continue;
    let d = o.s - c.s;
    if (d < -GS.L / 2) d += GS.L;
    else if (d > GS.L / 2) d -= GS.L;
    const close = c.v - o.v;
    const look = Math.min(170, 20 + 12 * ag + Math.max(0, close) * (1.8 + 0.8 * ag));
    if (d <= 0 || d > look || close < -1) continue;
    if (Math.abs(o.lat) > GS.HW + 2.5) continue; // well off the track, not in the way
    const wid = o.v < 15 ? 3.9 : 2.8 + 0.5 * (0.5 - ag); // stopped cars may sit sideways; aggressive drivers take tighter gaps
    const myLat = LN[o.idx] + c.lane;
    if (
      Math.abs(o.lat - myLat) >= wid &&
      Math.abs(o.lat - LN[o.idx]) >= wid &&
      Math.abs(c.lat - o.lat) >= wid
    )
      continue;
    if (yz && !o.out) {
      if (d < 28) cap = Math.min(cap, o.v + Math.max(0, d - 12) * 0.4);
      continue;
    }
    if (d >= bestD) continue;
    bestD = d;
    const roomL = o.lat - wid - -EDGE,
      roomR = EDGE - (o.lat + wid);
    let side = c.lat < o.lat - 0.3 ? -1 : c.lat > o.lat + 0.3 ? 1 : roomR > roomL ? 1 : -1;
    if ((side < 0 ? roomL : roomR) < 0) side = -side;
    const room = side < 0 ? roomL : roomR;
    desired = clamp(o.lat + side * wid, -EDGE, EDGE) - LN[o.idx];
    urg = clamp((close / Math.max(d, 1)) * 1.5, 0, 6);
    const need = Math.max(0, 2.4 - Math.abs(c.lat - o.lat)),
      tClear = need / (3 + urg * 3),
      ttc = Math.max(0, d - 5.5) / Math.max(close, 0.1); // can't get alongside in time: brake instead
    if (room < 0 || (d < 12 && Math.abs(c.lat - o.lat) < 2.3) || (need > 0 && ttc < tClear + 0.35)) {
      const vs = Math.sqrt(o.v * o.v + 2 * BPROF * WETB() * Math.max(0, d - (8.5 - 3 * ag)));
      cap = Math.min(cap, Math.max(0, vs - 1));
    }
  }
  // don't steer into a car running alongside: keep at least a car width from it
  let lo = -EDGE,
    hi = EDGE;
  for (const o of cars) {
    if (o === c || o.gone) continue;
    let d = o.s - c.s;
    if (d < -GS.L / 2) d += GS.L;
    else if (d > GS.L / 2) d -= GS.L;
    if (Math.abs(d) > 6.5) continue;
    const g = o.lat - c.lat;
    if (Math.abs(g) > 4.2) continue;
    if (g >= 0) hi = Math.min(hi, o.lat - 3.3);
    else lo = Math.max(lo, o.lat + 3.3);
  }
  if (lo > -EDGE || hi < EDGE) {
    let tgt = LN[c.idx] + (bestD < 1e9 ? desired : c.lane);
    if (lo <= hi) tgt = clamp(tgt, lo, hi);
    else tgt = c.lat;
    const jL = (c.idx + Math.round((7 + c.v * 0.32) / GS.SEG)) % GS.N;
    desired = tgt - LN[jL];
    urg = Math.max(urg, 3);
  } // hold that line where the steering is aiming, so cars side by side don't converge as the racing line swings across
  return [desired, cap, urg];
}
// steer towards a fixed lateral offset (used by knocked-out cars rolling off the line)
export function pursuitLat(c, tl) {
  const Ld = 6 + c.v * 0.4;
  const j = (c.idx + Math.round(Ld / GS.SEG)) % GS.N;
  const dx = GS.cx[j] + GS.nx[j] * tl - c.x,
    dy = GS.cy[j] + GS.ny[j] * tl - c.y;
  const ch = Math.cos(c.h),
    sh = Math.sin(c.h);
  return (2 * (-dx * sh + dy * ch)) / Math.max(dx * dx + dy * dy, 1);
}
export function pursuit(c, LN = GS.off) {
  const Ld = 7 + c.v * 0.32;
  const j = (c.idx + Math.round(Ld / GS.SEG)) % GS.N;
  const E = LN === GS.off ? GS.HW - 1.1 : GS.HW - 0.9; // the dynamic lines run closer to the edge than the classic one
  const o = clamp(LN[j] + c.lane, -E, E);
  const dx = GS.cx[j] + GS.nx[j] * o - c.x,
    dy = GS.cy[j] + GS.ny[j] * o - c.y;
  const ch = Math.cos(c.h),
    sh = Math.sin(c.h);
  const lat = -dx * sh + dy * ch;
  return (2 * lat) / Math.max(dx * dx + dy * dy, 1);
}
// AI defending: when a car behind pulls out to pass, the AI may make one move to cover that side.
// How often and how fast depends on difficulty (Easy rarely, Hard nearly always and quickly).
export let DEFN = 0;
export const DEF_CHANCE = [0.15, 0.5, 0.85],
  DEF_RATE = [1.1, 1.9, 2.9],
  DEF_REACT = [1.5, 1.0, 0.6],
  DEF_LOOK = [16, 22, 28];
export function sideRoom(c, lat) {
  const EDGE = GS.HW - 1.1;
  let lo = -EDGE,
    hi = EDGE;
  for (const q of cars) {
    if (q === c || q.gone) continue;
    let d = q.s - c.s;
    if (d < -GS.L / 2) d += GS.L;
    else if (d > GS.L / 2) d -= GS.L;
    if (Math.abs(d) > 6.5) continue;
    const g = q.lat - c.lat;
    if (Math.abs(g) > 4.2) continue;
    if (g >= 0) hi = Math.min(hi, q.lat - 3.1);
    else lo = Math.max(lo, q.lat + 3.1);
  }
  return lo <= hi ? clamp(lat, lo, hi) : c.lat;
}
export function defend(c, dt, ZN = GS.zone) {
  if (attract && !c.defAll) return null;
  const dv = opts.diff;
  if (c.def) {
    const o = c.def.o;
    let g = o.s - c.s;
    if (g < -GS.L / 2) g += GS.L;
    else if (g > GS.L / 2) g -= GS.L;
    c.def.t += dt;
    if (o.gone || o.out || g > -1 || g < -45 || c.def.t > 7 || inYellow(c)) {
      c.def = null;
      c.defCool = 2.5;
      return null;
    }
    if (g > -9 || ZN[(c.idx + 12) % GS.N] === 1) c.def.frozen = true; // attacker alongside: hold the line you chose
    return c.def;
  }
  if ((c.defCool || 0) > 0) {
    c.defCool -= dt;
    return null;
  }
  if (c.out || inYellow(c) || GS.raceTime < 10) return null;
  for (let k = 0; k < 45; k += 3) {
    const i = (c.idx + k) % GS.N;
    if (ZN[i] === 1 || Math.abs(GS.ccurv[i]) > 1 / 260) return null;
  } // only on a straight, never under braking
  for (const o of cars) {
    if (o === c || o.gone || o.out || o.ghost > 0) continue;
    let g = o.s - c.s;
    if (g < -GS.L / 2) g += GS.L;
    else if (g > GS.L / 2) g -= GS.L;
    if (g > -10 || g < -DEF_LOOK[dv] || o.v < c.v - 1.5) continue;
    const dl = o.lat - c.lat;
    if (Math.abs(dl) < DEF_REACT[dv]) continue;
    if (c.defSeen === o && c.defSeenT > 0) continue;
    c.defSeen = o;
    c.defSeenT = 4;
    const dsk = DRV(c);
    if (Math.random() < clamp(DEF_CHANCE[dv] * (0.4 + 1.2 * dsk.defend), 0, 0.97)) {
      c.def = {
        o,
        side: Math.sign(dl),
        t: 0,
        frozen: false,
        lat: clamp(c.lat + Math.sign(dl) * Math.min(Math.abs(dl), 2.6), -(GS.HW - 1.3), GS.HW - 1.3),
      };
      DEFN++;
      if (o === cars[GS.ctrl] && !attract) {
        const nc = nextCorner(c.idx);
        showToast(c.name + ' defends the ' + (dl > 0 ? 'right' : 'left') + (nc ? ' into T' + nc.n : ''));
      }
      return c.def;
    }
    return null;
  }
  return null;
}
/**
 * How exactly an AI driver meets the braking points of its dynamic line, by Opponents level (Easy, Medium, Hard).
 * sigma: the spread of the timing error in seconds (normally distributed; a consistent driver has up to a quarter
 * less, an erratic one a little more). early: how many seconds before the braking point the driver aims, so that
 * the late end of the spread still makes the corner. fix: a constant error for measurements (tools), null in play.
 */
export const AI_TIMING: { sigma: number[]; early: number[]; fix: number | null } = {
  sigma: [0.2, 0.12, 0.08],
  early: [0.1, 0.08, 0.08],
  fix: null,
};
/**
 * An AI car away from its dynamic line slows for corners: by `slow` (a share of its speed) when it is `full` metres or
 * more off the line and the line corners at `g` m/s^2 or more, proportionally less when closer or on a gentler bend.
 */
export const AI_LANE = { full: 3, slow: 0.12, g: 18 };
/** a standard normal random number (Box-Muller) */
function gauss(): number {
  return Math.sqrt(-2 * Math.log(1 - Math.random())) * Math.cos(2 * Math.PI * Math.random());
}
/** how an AI car follows a dynamic line: samples it looks ahead for its target speed, and how sharply it brakes when over it */
export const AI_TUNE = { look: 2, bgain: 1.5 };
// AI drivers. With the dynamic lines ready (sim/lines.ts) they drive the line of the Opponents level for their own car, at close
// to that line's own speeds: the line carries the difficulty. Without them (a line still being worked out) the classic line and profile.
export function controlAI(c, dt, factor) {
  const ds = DRV(c);
  const LN = AIL[c.team] || GS.off,
    PV = AIV[c.team],
    ZN = AIZ[c.team] || GS.zone;
  if (PV && !c.finished) factor += DYN_AIB[opts.diff];
  factor *= 1 + 0.05 * (ds.pace - 0.5) + (opts.rain ? 0.06 * (ds.wet - 0.5) : 0);
  if (!PV) {
    // on the classic line a driver's imperfection is a wandering pace and the odd late-braking moment
    c.wobT = (c.wobT || 0) - dt;
    if (c.wobT <= 0) {
      c.wobT = 1.5 + Math.random() * 2;
      c.wob = (Math.random() * 2 - 1) * (1 - ds.consist) * 0.02;
    }
    factor *= 1 + (c.wob || 0);
    if (c.slipT > 0) c.slipT -= dt;
    else if (
      ZN[(c.idx + 8) % GS.N] === 1 &&
      ZN[c.idx] !== 1 &&
      Math.random() < dt * 0.6 * (1 - ds.consist) ** 2
    )
      c.slipT = 0.45; // a late-braking moment
  }
  factor = Math.min(factor, 1.012); // never beyond what the grip allows
  let [des, cap, urg] = traffic(c, LN);
  if (c.defSeenT > 0) c.defSeenT -= dt;
  const D = defend(c, dt, ZN);
  let defV = 1e9;
  if (D) {
    if (!D.frozen) {
      const tgt = sideRoom(c, D.lat);
      const r = dt * DEF_RATE[opts.diff] * (0.7 + 0.6 * DRV(c).defend);
      c.lane += clamp(tgt - LN[c.idx] - c.lane, -r, r);
    }
    des = c.lane;
    urg = 0;
    const sv = clamp((LN[c.idx] + c.lane) / (GS.HW - 1.7), -1, 1);
    defV = laneSafe(c, sv, 3, PV);
  }
  // being passed (give room on the passing side) or cracking under pressure (run wide): sim/passing.ts
  const PY = passAI(c, dt);
  let r = dt * (3 + urg * 3);
  if (PY) {
    const jL = (c.idx + Math.round((7 + c.v * 0.32) / GS.SEG)) % GS.N;
    des = clamp(des, PY.lo - LN[jL], PY.hi - LN[jL]);
    r = Math.max(r, dt * 4);
    c.def = null;
  }
  c.lane += clamp(des - c.lane, -r, r);
  let vp = (PV || PROF[c.team] || GS.vf)[(c.idx + (PV ? AI_TUNE.look : 3)) % GS.N];
  if (PV) {
    // On a dynamic line a driver's imperfection is timing: every braking zone is met a little early or late, by a
    // normally distributed error around a deliberately early aim (AI_TIMING). Early: the car slows to the speeds the
    // line asks for a few metres further on. Late: it keeps the speeds of a few metres back.
    const braking = ZN[c.idx] === 1 || ZN[c.idx] === 3;
    if (c.brkErr === undefined || (c.wasBrk && !braking)) {
      const lv = opts.diff;
      c.brkErr =
        AI_TIMING.fix !== null
          ? AI_TIMING.fix
          : gauss() * AI_TIMING.sigma[lv] * (1.25 - 0.5 * ds.consist) - AI_TIMING.early[lv];
    }
    c.wasBrk = braking;
    const sh = Math.round((-c.brkErr * c.v) / GS.SEG), // samples: ahead when early, behind when late
      vs = PV[(((c.idx + AI_TUNE.look + sh) % GS.N) + GS.N) % GS.N];
    vp = sh >= 0 ? Math.min(vp, vs) : Math.max(vp, vs);
    // Off its line (in a lane beside or round another car) the line's speeds no longer fit: the dynamic lines use the
    // whole road, so a lane is often a tighter arc or the far edge. Take what is coming slower in proportion to how far
    // off the line the car is and how hard the line corners over the next second and a half.
    const dev = Math.min(1, Math.abs(c.lat - LN[c.idx]) / AI_LANE.full);
    if (dev > 0.05) {
      const KP = AIK[c.team];
      let hard = 0;
      for (let t = 0; t <= 1.5; t += 0.5) {
        const i = (c.idx + Math.round((c.v * t) / GS.SEG)) % GS.N,
          g = Math.abs(KP[i]) * PV[i] * PV[i];
        if (g > hard) hard = g;
      }
      vp *= 1 - AI_LANE.slow * dev * Math.min(1, hard / AI_LANE.g);
    }
  }
  let vt = Math.min(
    (vp < VCAP * (c.st || NEUTRAL).top - 1 ? vp * Math.sqrt(c.gm) : vp * (1 - 0.1 * c.dmg)) *
      factor *
      (1 + 0.06 * c.tow * (opts.tow || 0)),
    cap,
  );
  if (c.drs && vp >= VCAP * (c.st || NEUTRAL).top - 1)
    vt = Math.min(cap, vt * (1 + 0.06 * (opts.drsPow || 1)));
  if (PY) vt = Math.min(vt * PY.slow, Math.max(PY.cap, vt * 0.6)); // letting a car by costs at most 40% of the pace
  if (inYellow(c)) vt = Math.min(vt, vp * 0.72);
  vt = Math.min(vt, defV * factor);
  if (c.slipT > 0) vt += 3.5;
  let thr = 0,
    brk = 0;
  if (PV) {
    // the braking of a dynamic line is planned: follow its speeds closely
    if (c.v < vt - 0.3) thr = 1;
    else if (c.v > vt + 0.3) brk = clamp((c.v - vt) / AI_TUNE.bgain, 0.15, 1);
    else thr = 0.3;
  } else if (c.v < vt - 0.4) thr = 1;
  else if (c.v > vt + 0.8) brk = clamp((c.v - vt) / 5, 0.2, 1);
  else thr = 0.35;
  return [thr, brk, aiSteer(c, LN)];
}
// fastest speed that still stops short of the nearest car directly in your path
export function aheadCap(c) {
  let cap = 1e9;
  const look = Math.max(14, c.v * 0.9);
  for (const o of cars) {
    if (o === c || o.gone || o.ghost > 0) continue;
    let d = o.s - c.s;
    if (d < -GS.L / 2) d += GS.L;
    else if (d > GS.L / 2) d -= GS.L;
    if (d <= 0 || d > look) continue;
    const tl = GS.off[(c.idx + Math.round(d / GS.SEG)) % GS.N] + c.lane;
    if (Math.abs(o.lat - c.lat) > 2.1 && Math.abs(o.lat - tl) > 2.1) continue;
    cap = Math.min(cap, Math.sqrt(Math.max(0, o.v * o.v + 2 * BPROF * WETB() * 0.8 * Math.max(0, d - 5.5))));
  }
  return cap;
}
// lane steering: the player picks left / racing line / right; the car steers there and brakes for that line when you lift
GS.LANE_SEL = 0;
export function laneShift(d) {
  if (attract || GS.state === 'menu') return;
  GS.LANE_SEL = clamp(GS.LANE_SEL + d, -1, 1);
  renderLaneInd();
}
export function renderLaneInd() {
  const el = $('laneInd');
  if (!el) return;
  const ov = opts.steer === 3;
  const lab = ov ? ['◀ PASS', 'FOLLOW', 'PASS ▶'] : ['LEFT', 'LINE', 'RIGHT'];
  const sel = ov ? GS.PASS.side : GS.LANE_SEL;
  ([...el.children] as HTMLElement[]).forEach((b, i) => {
    if (b.textContent !== lab[i]) b.textContent = lab[i];
    b.classList.toggle('on', i - 1 === sel);
    b.classList.toggle('cue', ov && i !== 1 && !GS.PASS.side && !!GS.PASS.near);
  });
}
// overtake steering: follow the line behind the car ahead; tap left/right to commit to a pass on that side
GS.PASS = { side: 0, car: null, t: 0, armed: 0, near: null };
export function passTarget(c) {
  let best = null,
    bd = 1e9;
  for (const o of cars) {
    if (o === c || o.gone || o.out || o.ghost > 0) continue;
    let d = o.s - c.s;
    if (d < -GS.L / 2) d += GS.L;
    else if (d > GS.L / 2) d -= GS.L;
    if (d <= 2 || d > 70 || Math.abs(o.lat) > GS.HW + 1) continue;
    if (Math.abs(o.lat - c.lat) > 4.5) continue;
    if (d < bd) {
      bd = d;
      best = o;
    }
  }
  return best;
}
export function passPick(d) {
  if (attract || GS.state === 'menu') return;
  const c = cars[GS.ctrl];
  if (!c) return;
  if (GS.PASS.side === d) {
    GS.PASS.side = 0;
    GS.PASS.car = null;
    renderLaneInd();
    return;
  } // tap the same side again to cancel
  const o = passTarget(c);
  GS.PASS.side = d;
  GS.PASS.car = o;
  GS.PASS.t = 0;
  GS.PASS.armed = o ? 0 : 3;
  renderLaneInd();
}
export function passGap(c, o) {
  let d = o.s - c.s;
  if (d < -GS.L / 2) d += GS.L;
  else if (d > GS.L / 2) d -= GS.L;
  return d;
}
export const laneOff = s => Math.sign(s) * (GS.HW - 1.7);
export function pursuitLane(c, s) {
  const Ld = 7 + c.v * 0.32;
  const j = (c.idx + Math.round(Ld / GS.SEG)) % GS.N;
  const a = Math.abs(s);
  const tl = GS.off[j] * (1 - a) + laneOff(s) * a;
  const dx = GS.cx[j] + GS.nx[j] * tl - c.x,
    dy = GS.cy[j] + GS.ny[j] * tl - c.y;
  const ch = Math.cos(c.h),
    sh = Math.sin(c.h);
  return (2 * (-dx * sh + dy * ch)) / Math.max(dx * dx + dy * dy, 1);
}
export function laneSafe(c, s, ahead, PV?) {
  const i = (c.idx + ahead) % GS.N;
  let v = (PV || PROF[c.team] || GS.vf)[i];
  if (Math.abs(s) > 0.05) {
    const lp = laneProfile(s > 0 ? 1 : -1, c.team);
    v = v * (1 - Math.abs(s)) + Math.min(v, lp[i]) * Math.abs(s);
  }
  return v * Math.sqrt(c.gm);
}
/** debug/test hook: reassign a module-level binding */
export function __set(name: string, v: any): void {
  switch (name) {
    case 'DEFN':
      DEFN = v;
      break;
  }
}
