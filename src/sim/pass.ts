// Passing in Auto steering (opts.steer 0).
//
// The planner (sim/lines.ts) drives the car down the racing line and only ever follows a moving car: it never pulls
// out on its own, so the path stays predictable. Passing is the player's call. For the manoeuvre this module takes
// the car over: it steers to a sideways offset from the same line (c.lane, as the AI does), with the speed capped for
// that part of the road, and hands the car back to the planner once it is clear. The planner then merges back onto
// the line from wherever the car is.
//
// Three ways to ask for a pass are built in so they can be tried side by side (PASS_UI; set at build time with
// PASS_UI=slide|swipe|tap, or with ?pass=… in the URL):
//   slide  the GAS thumb is a slider. Drag it across the car's direction of travel and the car moves across the road
//          by that much. Left alone, the lane holds while the car is alongside another or lined up beside the car
//          ahead, and drifts back to the racing line once the pass is done.
//   swipe  flick the GAS thumb towards one side of the car (or tap ← / →) to pass the car ahead on that side. The car
//          takes the racing line wherever that keeps it on that side, runs beside the other car until clear, then
//          rejoins the line. Flick back the other way to tuck in behind again.
// The camera is isometric, so a car can be heading up, down or across the screen: touch gestures are read across the
// car's direction of travel as drawn (ui/pass-hud.ts passLatDir), keys are the car's own left and right.
//   tap    a PASS button sits above GAS and lights up when a car is ahead: slide the thumb up onto it or tap it
//          (← / → on a keyboard). The game picks the side. Sitting in the car's slipstream charges the button; a charged
//          pass keeps the slipstream's pull for a moment after pulling out (a slingshot).
import { GS } from '../state';
import { clamp, isTouch, store } from '../core/dom';
import { attract, cars, opts } from '../game/race';
import { input } from '../input/input';
import { passGap, pursuit } from './ai';
import { BRK, GRIP } from './car-model';
import { PROF } from './profile';
import { NEUTRAL } from '../teams/team-stats';
import { WETB, WETG } from '../track/track';
import { AIL, DYN } from './lines';
import { inYellow, standings } from './step';
import { NCOL, PRI, notify } from '../ui/notify';
import { sfxPass } from '../audio/audio';

declare const __PASS_UI__: string;
export type PassUI = 'slide' | 'swipe' | 'tap';
const UIS: PassUI[] = ['slide', 'swipe', 'tap'];
export let PASS_UI: PassUI = 'swipe';

/** tuning */
export const PASS_TUNE = {
  /** a car is "ahead" for a pass up to this far (m) */
  look: 70,
  /** centre-to-centre offset beside the car being passed (m) */
  beside: 3.2,
  /** a side is a good chance to pass when the path beside the car ahead keeps this share of the line's speed */
  good: 0.97,
  /** a committed pass waits on the line while the side's chance is below this, until it is alongside (this close, m) */
  hold: 0.95,
  committed: 4,
  /** a committed pass moves over beside the car from this far behind it (m), fully by 15 m closer */
  moveAt: 32,
  /** a pass is done once the car is this far behind (m) */
  clear: 7.5,
  /** ...and given up after this long (s), or if the car gets this far ahead (m) */
  maxT: 12,
  maxGap: 35,
  /** sideways speed of the target point (m/s): pulling out, coming back */
  rateOut: 3.5,
  rateBack: 2.6,
  rateSlide: 4.5,
  /** off the line, the share of grip kept back for the path not being exactly what was planned (full at 2 m off) */
  offCare: 0.03,
  /** slide: how fast the lane follows the thumb (lane units / s; 1 = from the line to the edge lane) */
  slideRate: 1.6,
  /** slide: thumb travel for the whole way from the line to one edge (CSS px), and the first bit that is ignored */
  span: 80,
  dead: 6,
  /** slide: seconds of a clear road before the lane drifts back to the line, and how fast (lane units / s) */
  settle: 0.7,
  drift: 0.9,
  /** swipe: thumb travel that counts as a flick (CSS px) */
  flick: 22,
  /** tap: seconds in a car's wake to charge, the slingshot's length (s) and its slipstream strength (0..1) */
  charge: 1.3,
  slingT: 1.8,
  sling: 0.85,
};

/** the manoeuvre and what the HUD shows about it */
export const PM = {
  /** this module is steering the player's car (the planner waits) */
  on: false,
  /** committed side: -1 left, 1 right (swipe, tap); 0 = none, the car rejoins / follows */
  side: 0,
  /** the car being passed */
  car: null as any,
  /** seconds into the pass */
  t: 0,
  /** the committed pass is waiting on the line for a better moment */
  wait: false,
  /** a side picked with no car in range: wait this long for one */
  armed: 0,
  /** slide: the lane, -1 left edge .. 0 the line .. 1 right edge */
  s: 0,
  /** slide: seconds since the thumb (or a key) last moved the lane */
  idle: 0,
  /** slide: the lane the car is actually steering to (follows s, smoothed) */
  sv: 0,
  /** the car ahead a pass would be on */
  near: null as any,
  /** room beside `near`: [left, right] */
  open: [false, false],
  /** how good a moment it is to pass `near` on each side: the slowest the path beside it is over the next 120 m, as a
   *  share of the racing line's speed (chance()); good = at least PASS_TUNE.good */
  chance: [0, 0],
  good: [false, false],
  /** tap: 0..1, fills in the slipstream of the car ahead */
  charge: 0,
  /** tap: this pass was launched fully charged, and its slingshot has not fired yet */
  charged: false,
  /** the better side to pass `near` on (tap takes it; swipe shows it brighter) */
  auto: 0,
  /** passes completed this race */
  done: 0,
  /** how the last pass ended: 'clear', 'gap' (the car got away), 'time', 'gone', 'back' (you tucked in) */
  why: '',
  /** the point the car is steering to, metres from the centre line at the look-ahead (also the drawn path) */
  aim: 0,
  /** the line's offset at the look-ahead on the last step (how fast it is swinging across the road) */
  lj: 0,
  /** the car being passed and its offset on the last step (how fast it is moving across) */
  ocar: null as any,
  olat: 0,
  /** celebrations to draw over your car: { t (s), pos } */
  fx: [] as { t: number; pos: number }[],
  /** cars near you and which side of you they were on: for the "+1" moment */
  rel: new Map<any, number>(),
  /** the hint about how to pass has been shown this race */
  hinted: false,
};

export function passReset(): void {
  PM.on = false;
  PM.side = 0;
  PM.car = null;
  PM.t = 0;
  PM.wait = false;
  PM.armed = 0;
  PM.s = 0;
  PM.idle = 0;
  PM.sv = 0;
  PM.near = null;
  PM.open = [false, false];
  PM.chance = [0, 0];
  PM.good = [false, false];
  PM.charge = 0;
  PM.charged = false;
  PM.auto = 0;
  PM.done = 0;
  PM.fx = [];
  PM.rel = new Map();
  PM.hinted = false;
  for (const c of cars) c.sling = 0;
}

/** drop the manoeuvre (car swapped or reset): the planner drives again */
export function passCancel(): void {
  PM.on = false;
  PM.charged = false;
  PM.side = 0;
  PM.car = null;
  PM.armed = 0;
  PM.s = 0;
  PM.idle = 0;
}

/** is passing on for this car right now? (Auto steering, your car, a race) */
export function passActive(c): boolean {
  return !attract && opts.steer === 0 && !!c && c === cars[GS.ctrl] && !c.finished && !c.remote;
}

const EDGE = () => GS.HW - 1.1;

/** the nearest car ahead, roughly in your path, that a pass would be on */
function target(c) {
  let best = null,
    bd = 1e9;
  for (const o of cars) {
    if (o === c || o.gone || o.out || o.ghost > 0) continue;
    const d = passGap(c, o);
    if (d <= 2 || d > PASS_TUNE.look || Math.abs(o.lat) > GS.HW + 1) continue;
    if (Math.abs(o.lat - c.lat) > 4.5) continue;
    if (d < bd) {
      bd = d;
      best = o;
    }
  }
  return best;
}
/** is there room on this side of car o (the road edge, and no other car in that lane beside it)? */
function room(c, o, side: number): boolean {
  const want = o.lat + side * PASS_TUNE.beside;
  if (Math.abs(want) > EDGE() + 0.4) return false;
  for (const q of cars) {
    if (q === c || q === o || q.gone || q.ghost > 0) continue;
    const d = passGap(o, q);
    if (Math.abs(d) > 9) continue;
    if (Math.abs(q.lat - want) < 2.4) return false;
  }
  return true;
}
/**
 * The better side to pass car o on: the open one; of two, the one where the path beside it costs less over the next
 * 120 m (chance()), and if that is close, the side the racing line takes past it. Neither open: your side.
 */
function pickSide(c, o, LN: ArrayLike<number>): number {
  const L = PM.open[0],
    R = PM.open[1],
    mine = c.lat < o.lat ? -1 : 1;
  if (L !== R) return L ? -1 : 1;
  if (!L) return mine;
  if (Math.abs(PM.chance[0] - PM.chance[1]) > 0.01) return PM.chance[0] > PM.chance[1] ? -1 : 1;
  let w = 0;
  for (let k = 15; k <= 65; k += 5) w += LN[(o.idx + k) % GS.N] - o.lat;
  return Math.abs(w) < 2 ? mine : w < 0 ? -1 : 1;
}

/** start a pass on side d (-1 left, 1 right); the same way again keeps going, the other way tucks back in */
export function passCommit(d: number, why: 'swipe' | 'tap' | 'key' = 'swipe'): void {
  const c = cars[GS.ctrl];
  if (!passActive(c) || GS.state !== 'race') return;
  if (inYellow(c) && !PM.side) {
    notify('Yellow flag · no overtaking', NCOL.slow, { key: 'passhint', ttl: 2, pri: PRI.coach });
    return;
  }
  if (PM.side === d) return;
  if (PM.side === -d && PM.car) {
    PM.side = 0; // flicked back: tuck in behind
    PM.car = null;
    PM.armed = 0;
    PM.charged = false;
    sfxPass('back');
    return;
  }
  const o = PM.near || target(c);
  PM.side = d;
  PM.car = o;
  PM.t = 0;
  PM.armed = o ? 0 : 3;
  PM.charged = PASS_UI === 'tap' && PM.charge >= 1; // the slingshot fires as the car pulls out (passDrive)
  if (PM.charged) PM.charge = 0;
  sfxPass(PM.charged ? 'sling' : 'go');
  if (why !== 'key' && navigator.vibrate) navigator.vibrate(12);
}
/** tap: go, on the side the game picks */
export function passTap(): void {
  const c = cars[GS.ctrl];
  if (!passActive(c)) return;
  if (PM.side && PM.car) {
    // tapped again during a pass: give it up and tuck in
    PM.charged = false;
    PM.side = 0;
    PM.car = null;
    sfxPass('back');
    return;
  }
  if (!PM.near || !PM.auto) return;
  passCommit(PM.auto, 'tap');
}
/** slide: move the lane by this much (-1..1 is the whole road) */
export function passSlide(ds: number): void {
  if (!ds) return;
  PM.s = clamp(PM.s + ds, -1, 1);
  PM.idle = 0;
}

const PE = new Float64Array(68);
/**
 * The safe speed off the line: the speed the path the car is about to drive allows, never above the line's own speed
 * there, with braking for what is coming, and easing off at once if the car starts to slide. The path is the line plus
 * an offset e (the car's present offset carried along, or the slide's lane), held inside the road; its curvature is the
 * line's own at that offset, 1/(R - e), plus the bend from the offset changing, e''.
 */
function offSafe(
  c,
  LN: ArrayLike<number>,
  PV: ArrayLike<number> | undefined,
  KP: ArrayLike<number> | null,
  Lj: number,
): number {
  const N = GS.N,
    E = GS.HW - 0.9,
    sl = PASS_UI === 'slide',
    a = Math.abs(PM.sv),
    edge = Math.sign(PM.sv) * (GS.HW - 1.7),
    d = PM.aim - Lj,
    // the grip the line itself is built to use (its level's margin), so that on the line this is the line's speed
    G =
      GRIP * ((c.st || NEUTRAL).grip || 1) * WETG() * c.gm * ((DYN && DYN.cfg && DYN.cfg.gripMargin) || 0.95),
    // braking as the line plans it: the car's brakes at the level's braking margin
    B =
      2 *
      BRK *
      ((c.st || NEUTRAL).brk || 1) *
      WETB() *
      ((DYN && DYN.cfg && DYN.cfg.brkMargin) || 0.8) *
      GS.SEG,
    V = PV || PROF[c.team] || GS.vf,
    g = Math.sqrt(c.gm),
    h2 = 1 / (3 * GS.SEG) ** 2;
  // the offset from the line along the path, from 1 sample behind to 50 ahead
  for (let q = -1; q <= 50; q++) {
    const i = (c.idx + q + N) % N;
    PE[q + 1] = clamp(sl ? LN[i] * (1 - a) + edge * a : LN[i] + d, -E, E) - LN[i];
  }
  let safe = 1e9;
  for (let q = 2; q <= 45; q++) {
    const i = (c.idx + q) % N,
      e = PE[q + 1],
      kl = KP ? KP[i] : (GS.rk[i] || 0) * Math.sign(GS.ccurv[i]), // the classic line: its curvature, turning with the road
      k = Math.abs(kl / Math.max(0.2, 1 - e * kl) + (PE[q + 4] - 2 * e + PE[q - 2]) * h2);
    // off the line the path is not quite what was planned: a little margin, growing to 3% at 2 m off
    const v = Math.min(
      V[i] * g,
      Math.sqrt((G * (1 - PASS_TUNE.offCare * Math.min(1, Math.abs(e) / 2))) / Math.max(k, 1e-5)),
    );
    const vb = Math.sqrt(v * v + B * (q - 2));
    if (vb < safe) safe = vb;
  }
  if (c.slide > 0.2) safe = Math.min(safe, c.v - 2); // sliding: ease off at once
  return safe;
}

/**
 * How good a moment it is to pass car o on side sd: over the next 120 m from it, the slowest the path beside it would
 * be, as a share of the racing line's speed there (1 = costs nothing). The path is the line wherever that keeps the car
 * on that side of the other one (taken as following its own line), and beside it otherwise.
 */
function chance(
  c,
  o,
  sd: number,
  LN: ArrayLike<number>,
  PV: ArrayLike<number> | undefined,
  KP: ArrayLike<number> | null,
): number {
  const N = GS.N,
    E = GS.HW - 0.9,
    OL = AIL[o.team] || null,
    oOff = OL ? o.lat - OL[o.idx] : 0,
    G =
      GRIP * ((c.st || NEUTRAL).grip || 1) * WETG() * c.gm * ((DYN && DYN.cfg && DYN.cfg.gripMargin) || 0.95),
    V = PV || PROF[c.team] || GS.vf,
    h2 = 1 / (3 * GS.SEG) ** 2;
  for (let q = -1; q <= 64; q++) {
    const i = (o.idx + q + N) % N,
      ol = OL && !o.human ? OL[i] + oOff : o.lat,
      by = clamp(ol + sd * PASS_TUNE.beside, -E, E);
    PE[q + 1] = (sd > 0 ? Math.max(LN[i], by) : Math.min(LN[i], by)) - LN[i];
  }
  let worst = 1;
  for (let q = 2; q <= 60; q++) {
    const i = (o.idx + q) % N,
      e = PE[q + 1],
      kl = KP ? KP[i] : (GS.rk[i] || 0) * Math.sign(GS.ccurv[i]),
      k = Math.abs(kl / Math.max(0.2, 1 - e * kl) + (PE[q + 4] - 2 * e + PE[q - 2]) * h2),
      vl = Math.min(V[i], Math.sqrt(G / Math.max(Math.abs(kl), 1e-5))),
      vp = Math.min(
        V[i],
        Math.sqrt((G * (1 - PASS_TUNE.offCare * Math.min(1, Math.abs(e) / 2))) / Math.max(k, 1e-5)),
      );
    worst = Math.min(worst, vp / Math.max(vl, 1));
  }
  return worst;
}

/**
 * Called every step for your car in Auto steering. Returns null while the planner drives, or the steering and safe
 * speed while this module does; LN is the line the car is on (the planner's line, or the classic one).
 */
export function passDrive(
  c,
  dt: number,
  dyn: boolean,
): { k: number; safe: number; LN: ArrayLike<number> } | null {
  const LN: ArrayLike<number> = dyn && DYN && DYN.line ? DYN.line.lat : GS.off,
    PV = dyn && DYN && DYN.line ? DYN.line.v : undefined,
    T = PASS_TUNE,
    E = EDGE();
  const racing = GS.state === 'race';
  PM.near = racing && !inYellow(c) ? target(c) : null; // no passing under a yellow flag
  const o0 = PM.near;
  PM.open = o0 ? [room(c, o0, -1), room(c, o0, 1)] : [false, false];
  const KP = dyn && DYN && DYN.line ? DYN.line.kap : null;
  if (o0) {
    PM.chance[0] = PM.open[0] ? chance(c, o0, -1, LN, PV, KP) : 0;
    PM.chance[1] = PM.open[1] ? chance(c, o0, 1, LN, PV, KP) : 0;
  } else PM.chance[0] = PM.chance[1] = 0;
  PM.good = [PM.chance[0] >= T.good, PM.chance[1] >= T.good];
  PM.auto = o0 ? pickSide(c, o0, LN) : 0;
  if (PASS_UI === 'tap') {
    // charge in the wake of the car ahead (faster with the slipstream's pull), drain otherwise
    const inWake = o0 && passGap(c, o0) < 40 && Math.abs(o0.lat - c.lat) < 2.4 && !PM.side;
    PM.charge = clamp(PM.charge + (inWake ? (dt * (0.6 + c.tow)) / T.charge : -dt * 0.5), 0, 1);
  }
  if (o0 && !PM.hinted && racing && GS.raceTime > 3) passHint();

  // the committed pass: keep it, finish it or give it up
  if (PM.side && !PM.car) {
    PM.armed -= dt;
    if (o0) {
      PM.car = o0;
      PM.t = 0;
    } else if (PM.armed <= 0) PM.side = 0;
  }
  let o = PM.car;
  if (o && (o.gone || o.out)) {
    PM.side = 0;
    PM.car = o = null;
  }
  if (PM.side && o) {
    PM.t += dt;
    const g = passGap(c, o);
    if (g < -T.clear || g > T.maxGap || PM.t > T.maxT) {
      PM.why = g < -T.clear ? 'clear' : g > T.maxGap ? 'gap' : 'time';
      PM.charged = false;
      PM.side = 0;
      PM.car = o = null;
    }
  }
  // slide: keys move the lane. Left alone, the lane holds while you are alongside a car or lined up beside the car
  // ahead (a pass under way), and otherwise drifts back to the racing line.
  if (PASS_UI === 'slide') {
    const kd = (input.right ? 1 : 0) - (input.left ? 1 : 0);
    if (kd) passSlide(kd * dt * 1.4);
    else PM.idle += dt;
    let busy = !!o0 && passGap(c, o0) < 30 && Math.abs(o0.lat - c.lat) > 2;
    if (!busy)
      for (const q of cars) {
        if (q === c || q.gone) continue;
        if (Math.abs(passGap(c, q)) < 8 && Math.abs(q.lat - c.lat) < 4.5) busy = true;
      }
    if (!busy && PM.idle > T.settle && PM.s) {
      const st = dt * T.drift;
      PM.s = Math.abs(PM.s) <= st ? 0 : PM.s - Math.sign(PM.s) * st;
    }
  }

  const j = (c.idx + Math.round((7 + c.v * 0.32) / GS.SEG)) % GS.N,
    Lj = LN[j];
  // A committed pass moves over as the gap closes (pulling out early only loses time): from 32 m behind, fully by 17 m.
  // Not yet alongside and the side has turned slow (a corner where the car would be on the outside), it waits in the
  // slipstream and goes as soon as it is a good chance again. Until then the planner keeps driving.
  let w = 0;
  PM.wait = false;
  if (PASS_UI !== 'slide' && PM.side && o) {
    const g = passGap(c, o),
      ch = o === PM.near ? PM.chance[PM.side < 0 ? 0 : 1] : chance(c, o, PM.side, LN, PV, KP);
    PM.wait = g > T.committed && ch < T.hold;
    w = PM.wait ? 0 : clamp((T.moveAt - g) / 15, 0, 1);
    if (PM.charged && w > 0.2) {
      c.sling = T.slingT; // a charged pass: the slipstream's pull stays with the car as it pulls out
      PM.charged = false;
    }
  }
  const want = PASS_UI === 'slide' ? Math.abs(PM.s) > 0.01 : w > 0;
  if (!PM.on) {
    if (!want || !racing) return null;
    PM.on = true;
    PM.sv = 0;
    PM.aim = c.lat; // start from where the car really is
    PM.lj = Lj;
    PM.ocar = null;
  }
  // where to go, across the road at the steering look-ahead point (metres from the centre line)
  let goal: number;
  if (PASS_UI === 'slide') {
    // the lane follows the thumb, smoothed; between the line and the edge lane on that side
    PM.sv += clamp(PM.s - PM.sv, -dt * T.slideRate, dt * T.slideRate);
    const a = Math.abs(PM.sv);
    goal = Lj * (1 - a) + Math.sign(PM.sv) * (GS.HW - 1.7) * a;
  } else if (want) {
    // the racing line wherever it keeps the car on the chosen side of the other one; beside it otherwise
    const by = o.lat + PM.side * T.beside;
    if (Math.abs(by) > E + 0.4)
      goal = PM.side > 0 ? Math.max(c.lat, o.lat + 0.2) : Math.min(c.lat, o.lat - 0.2); // no room yet: wait on that side of its gearbox
    else goal = PM.side > 0 ? Math.max(Lj, by) : Math.min(Lj, by);
    goal = Lj + (goal - Lj) * w;
  } else goal = Lj; // done, given up or waiting: back onto the line, then the planner drives
  goal = clamp(goal, -E, E);
  // never squeeze into a car running alongside
  let lo = -E,
    hi = E;
  for (const q of cars) {
    if (q === c || q.gone) continue;
    const d = passGap(c, q);
    if (Math.abs(d) > 6.5) continue;
    const gq = q.lat - c.lat;
    if (Math.abs(gq) > 4.2) continue;
    if (gq >= 0) hi = Math.min(hi, q.lat - 3.1);
    else lo = Math.max(lo, q.lat + 3.1);
  }
  goal = lo <= hi ? clamp(goal, lo, hi) : c.lat;
  // The point steered to moves towards the goal at a limited sideways rate, plus however fast the line swings across
  // the road towards the goal (to keep up with it through a chicane); it never overshoots the goal.
  // (and the other car's own sideways movement while the goal is beside it)
  const toGoal = goal - PM.aim,
    dL = Lj - PM.lj,
    dO = o && PM.ocar === o ? o.lat - PM.olat : 0;
  const r =
    dt * (PASS_UI === 'slide' ? T.rateSlide : want ? T.rateOut : T.rateBack) +
    Math.max(dL * toGoal > 0 ? Math.abs(dL) : 0, dO * toGoal > 0 ? Math.abs(dO) : 0);
  PM.lj = Lj;
  PM.ocar = o;
  PM.olat = o ? o.lat : 0;
  PM.aim = clamp(PM.aim + clamp(goal - PM.aim, -r, r), -E, E);
  c.lane = PM.aim - Lj; // pursuit() steers to the line plus c.lane
  // back on the line: the planner takes over again
  if (!want && Math.abs(c.lane) < 0.3 && Math.abs(c.lat - LN[c.idx]) < 0.45) {
    PM.on = false;
    if (dyn && DYN) DYN.reset();
    return null;
  }
  const k = pursuit(c, LN as any);
  const safe = offSafe(c, LN, PV, KP, Lj);
  return { k, safe, LN };
}

/** every step, for your car: notice when you get past someone, for the "+1" moment */
export function passWatch(c, dt: number): void {
  for (const f of PM.fx) f.t += dt;
  if (PM.fx.length && PM.fx[0].t > 1.6) PM.fx.shift();
  if (attract || GS.state !== 'race' || !c || GS.raceTime < 4) return;
  for (const o of cars) {
    if (o === c || o.gone) continue;
    const d = passGap(c, o);
    if (Math.abs(d) > 30) {
      PM.rel.delete(o);
      continue;
    }
    const side = d > 1.5 ? 1 : d < -3 ? -1 : 0;
    if (!side) continue;
    const was = PM.rel.get(o);
    PM.rel.set(o, side);
    if (was === 1 && side === -1 && !o.out) {
      PM.done++;
      const pos = standings().indexOf(c) + 1;
      PM.fx.push({ t: 0, pos });
      sfxPass('done');
    }
  }
}

function passHint(): void {
  PM.hinted = true;
  const n = +store.get('passhint_' + PASS_UI, 0) || 0;
  if (n >= 3) return;
  store.set('passhint_' + PASS_UI, n + 1);
  const H = {
    slide: isTouch
      ? [
          'Drag your thumb on GAS to move the car across',
          'It holds its lane beside a car, then drifts back to the line',
        ]
      : [
          'Hold ← or → to move the car across the road',
          'It holds its lane beside a car, then drifts back to the line',
        ],
    swipe: isTouch
      ? ['Flick your thumb on GAS towards a chevron to pass', 'Flick back the other way to tuck in behind']
      : ['Tap ← or → to pass on that side', 'Tap the other way to tuck in behind'],
    tap: isTouch
      ? ['Slide up onto PASS to overtake', 'A full bar in the slipstream gives a slingshot']
      : ['Press ← or → to overtake on that side', 'A full bar in the slipstream gives a slingshot'],
  }[PASS_UI];
  notify(H[0], NCOL.info, { sub: H[1], ttl: 4.5, key: 'passhint', pri: PRI.coach });
}

/** words for the steering notes in the menu */
export function passNote(): string {
  return {
    slide: 'To pass, drag your thumb on GAS (or hold ← / →) the way you want the car to go.',
    swipe:
      'To pass, flick your thumb on GAS (or tap ← / →) towards the side of the car ahead you want to take.',
    tap: 'To pass, slide your thumb up onto PASS (or press ← / →) when a car is ahead: the car picks the side and goes.',
  }[PASS_UI];
}

export function init(): void {
  const q = /[?&]pass=(slide|swipe|tap)\b/.exec(location.search);
  const built = typeof __PASS_UI__ !== 'undefined' ? __PASS_UI__ : '';
  PASS_UI = (q ? q[1] : UIS.includes(built as PassUI) ? built : 'swipe') as PassUI;
  document.body.dataset.pass = PASS_UI;
}

/** debug/test hook: reassign a module-level binding */
export function __set(name: string, v: any): void {
  switch (name) {
    case 'PASS_UI':
      PASS_UI = v;
      document.body.dataset.pass = v;
      break;
  }
}
