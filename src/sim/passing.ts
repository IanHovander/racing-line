// Passing: three ways for a one-button driver to get past the car ahead (Settings · Driving · Passing, opts.pass).
//
// With Steering: Auto on a dynamic line the planner drives your car along the racing line and ignores moving cars;
// the contact assist then parks you behind anyone in the way. Each style below is a different answer to "how do I
// get by?", all built on one thing: a committed pass (PS.car, PS.side). Once a pass is committed the planner goes
// round that one car on that one side (dynline.ts, opts.pass) and the car being passed gives room (passAI below), so
// the path stays predictable: you see where the car will go before it goes.
//
//   1 Dive       out-brake them. Close behind a car into a braking zone, keep the gas on after they brake and your
//                car dives up the inside, with a little extra bite in the brakes. No new control: the skill you
//                already use (when to lift) is the passing skill.
//   2 Pressure   stay on their gearbox. Following close fills a pressure ring round the car ahead (faster in
//                corners and braking zones); when it is full the driver cracks: locks up and runs wide, and you
//                take the inside. No new control: the reward is for driving well enough to stay close.
//   3 Slingshot  tap the gas in the tow. Sit in the slipstream until the chevrons charge, then tap (lift and press
//                again quickly): the car swings out on the side shown and gets a short burst of extra power.
//
// 0 Off keeps the game as it was. docs/DESIGN.md (Passing) has the numbers and the reasons.
import { GS } from '../state';
import { clamp, store } from '../core/dom';
import { attract, cars, opts } from '../game/race';
import { DYN } from './lines';
import { spawn } from './step';
import { passSnd } from '../audio/audio';
import { NCOL, PRI, notify } from '../ui/notify';
import { cornerAt } from '../track/track';
import type { Car } from '../types';

export const PASS_NAMES = ['Off', 'Dive', 'Pressure', 'Slingshot'];
/** the one-line reminder shown just after lights out */
export const PASS_TIP = [
  '',
  'Brake later than the car ahead to dive up the inside',
  'Stay close behind until they crack',
  'Charge in the tow, then tap the gas',
];
export const PASS_NOTE = [
  'No passing help: the car follows the line and slows behind the car ahead.',
  'Brake later than the car ahead: keep the gas on into a braking zone after they brake and you dive up the inside.',
  'Stay close behind the car ahead: the ring fills, the driver cracks and runs wide, and you take the inside.',
  'Follow in the slipstream until the chevrons light up blue, then tap the gas (lift and press) to slingshot past.',
];
/**
 * Dive: a car ahead within `look` m and `lat` m sideways, with your braking zone within armT s, arms it; staying on
 * the gas once that car brakes, within commitGap m, dives. Your brakes bite `brake` times harder while you are not
 * yet past it. Given up when it gets `away` m ahead or after maxT s.
 */
export const DIVE = { look: 40, lat: 3.2, armT: 2.4, commitGap: 14, brake: 1.22, away: 25, maxT: 5 };
/**
 * Pressure: a car within gapT s ahead fills the ring at `fill` a second (full rate at `near` s or closer, `corner`
 * times as fast in corners and braking zones); it drains at `decay`. A full ring cracks the driver once you are
 * within `strike` m: it locks up, down to `lock` of its pace for the first `lockT` s, then `slow` until crackT s, and
 * drifts `wide` m/s towards the outside.
 */
export const PRESS = {
  gapT: 0.6,
  near: 0.25,
  fill: 0.22,
  corner: 1.7,
  decay: 0.12,
  strike: 12,
  crackT: 1.6,
  lockT: 1,
  lock: 0.7,
  slow: 0.86,
  wide: 2.6,
  away: 30,
  maxT: 5,
};
/**
 * Slingshot: tow above `tow` within `near` m of the car ahead charges in `charge` s; it is ready with at least `room`
 * m (or roomT s) of road before the next braking zone. A tap is a lift of at most tapMax s after holding the gas
 * holdMin s. The boost lasts boostT s: `top` more top speed and `pull` m/s^2 more acceleration.
 */
export const SLING = {
  tow: 0.4,
  near: 18,
  room: 120,
  roomT: 2.2,
  charge: 0.9,
  tapMax: 0.4,
  holdMin: 0.2,
  boostT: 2.2,
  top: 0.16,
  pull: 4,
  away: 35,
  maxT: 5,
};
/** a committed pass is done once the other car is this far behind; the lane beside it ends once it is AHEAD m behind */
const DONE = -5.5,
  AHEAD = -1;
/**
 * The car being passed, once the pass is committed and the passing car is within `look` m: it keeps its centre
 * `lane` m in from the edge on the passing side (a lane for the other car), and drives at `dive` / `sling` of its
 * speed. Once the passing car has pulled out beside it within `near` m it keeps a car's width from it, and once
 * that car is less than `along` m behind (its nose alongside) it stays `by` m/s slower than it.
 */
export const YIELD = { look: 30, lane: 3.6, dive: 0.94, sling: 0.97, near: 14, along: 4.5, by: 3 };

/** the player's passing state (the car you drive; one per machine) */
export const PS = {
  /** the committed pass: the car being passed, its side (+1 = positive lat, the left of the road), what started it, seconds since */
  car: null as Car | null,
  side: 0,
  kind: '',
  t: 0,
  /** your car is ahead of the car being passed: the planner is back on its line, the other car keeps clear */
  ahead: false,
  /** the cue: the car it points at and the side a pass would take */
  cand: null as Car | null,
  candSide: 0,
  /** Dive: a pass is on offer (braking zone ahead, a car in the way) */
  armed: false,
  /** Pressure: how full the ring round cand is; Slingshot: the charge (0..1) */
  meter: 0,
  /** Slingshot: charged and a car to pass */
  ready: false,
  /** Slingshot boost left (s) */
  boostT: 0,
  /** the gas, for spotting a tap */
  prevThr: false,
  heldT: 0,
  heldPrev: 0,
  liftT: -1,
  /** the last pass that worked, so the coaching does not praise it twice */
  won: null as Car | null,
  wonT: -99,
  /** seconds since the last pass ended (a short pause before the next cue) */
  rest: 0,
  /** counts for the tools: committed, completed */
  n: 0,
  ok: 0,
  /** the reminder at the start has been shown */
  told: false,
  /** the car all this is for */
  me: null as Car | null,
};
export function passReset(): void {
  Object.assign(PS, {
    car: null,
    side: 0,
    kind: '',
    t: 0,
    ahead: false,
    cand: null,
    candSide: 0,
    armed: false,
    meter: 0,
    ready: false,
    boostT: 0,
    prevThr: false,
    heldT: 0,
    heldPrev: 0,
    liftT: -1,
    won: null,
    wonT: -99,
    rest: 9,
    n: 0,
    ok: 0,
    told: false,
    me: null,
  });
  for (const c of cars) {
    c.crackT = 0;
    c.boost = 0;
    c.brkX = 1;
  }
}
/** pick a passing style (Settings, the pause menu) */
export function setPassMode(m: number): void {
  opts.pass = clamp(m | 0, 0, PASS_NAMES.length - 1);
  store.set('pass', opts.pass);
  PS.car = null;
  PS.cand = null;
  PS.meter = 0;
  PS.ready = PS.armed = false;
}
/** distance from c forward to o along the track (negative: o is behind) */
export function gapTo(c: Car, o: Car): number {
  let d = o.s - c.s;
  if (d < -GS.L / 2) d += GS.L;
  else if (d > GS.L / 2) d -= GS.L;
  return d;
}
/**
 * The nearest car ahead within `look` m that is in the way (within `lat` m sideways). Only cars this machine drives
 * (the AI here): another player's car, or the host's AI seen from a guest, cannot be asked to give room.
 */
function aheadOf(c: Car, look: number, lat: number): Car | null {
  let best = null,
    bd = 1e9;
  for (const o of cars) {
    if (o === c || o.gone || o.out || o.ghost > 0 || o.remote) continue;
    const d = gapTo(c, o);
    if (d <= 2 || d > look || d >= bd) continue;
    if (Math.abs(o.lat - c.lat) > lat || Math.abs(o.lat) > GS.HW + 1) continue;
    bd = d;
    best = o;
  }
  return best;
}
/** metres to the next braking zone of the line your car drives (0 = in one now), or 1e9 within 500 m */
function brakeAhead(c: Car): number {
  const z = DYN && DYN.ready ? DYN.line.zone : GS.zone;
  for (let k = 0; k < 250; k++) {
    const q = z[(c.idx + k) % GS.N];
    if (q === 1 || q === 3) return k * GS.SEG;
  }
  return 1e9;
}
/** the next corner starting within `look` m (or the one the car is in, before its apex): { C, d } */
function cornerAhead(c: Car, look: number) {
  const C = GS.CORNERS[GS.NEXTC[c.idx]];
  if (!C) return null;
  const toApex = ((C.apex - c.idx + GS.N) % GS.N) * GS.SEG;
  const toStart = ((C.i0 - c.idx + GS.N) % GS.N) * GS.SEG;
  const d = toApex < toStart ? 0 : toStart; // already in it
  return d <= look ? { C, d } : null;
}
/** metres of road beside o on `side`, from its centre to the edge */
const roomBeside = (o: Car, side: number) => GS.HW - o.lat * side;
/**
 * The side to pass o on: the side you are already on when your car sits a little to one side of it and there is
 * room there (going for the other side would cut across its gearbox), else the inside of a corner within `look` m
 * if there is room, else the side with more road.
 */
function sideFor(c: Car, o: Car, look: number): number {
  const dl = c.lat - o.lat,
    mine = dl > 0 ? 1 : -1;
  if (Math.abs(dl) > 0.9 && roomBeside(o, mine) >= ROOM) return mine;
  const ca = cornerAhead(c, look),
    ins = ca ? (ca.C.dir > 0 ? 1 : -1) : 0;
  if (ins && roomBeside(o, ins) >= ROOM) return ins;
  return o.lat > 0 ? -1 : 1;
}
/** the road beside the other car a pass needs (m from its centre to the edge): your car's width and a little */
const ROOM = 3.2;
const nm = (o: Car) => o.name.split(' ').pop() || o.name;

function commit(c: Car, o: Car, side: number, kind: string): void {
  PS.car = o;
  PS.side = side;
  PS.kind = kind;
  PS.t = 0;
  PS.ahead = false;
  PS.n++;
  PS.cand = null;
  PS.armed = PS.ready = false;
  PS.meter = 0;
  if (o.def) o.def = null; // a committed pass is not blocked: the defence that was under way stops
  o.defCool = Math.max(o.defCool || 0, 4);
  if (attract) return;
  passSnd(kind);
  if (kind === 'dive')
    notify('Dive!', NCOL.warn, { sub: 'Up the inside of ' + nm(o), ttl: 1.6, key: 'pass', pri: PRI.drs });
  else if (kind === 'pressure')
    notify(nm(o) + ' cracks!', NCOL.lost, {
      sub: 'Locks up under pressure',
      ttl: 1.8,
      key: 'pass',
      pri: PRI.drs,
    });
  else
    notify('Slingshot!', '#4da3ff', {
      sub: 'Out of the tow past ' + nm(o),
      ttl: 1.6,
      key: 'pass',
      pri: PRI.drs,
    });
}
function finish(c: Car, ok: boolean): void {
  const o = PS.car;
  if (ok && o) {
    PS.ok++;
    c.streakT = 0.7; // a short white streak along your car (render/car.ts)
    PS.won = o;
    PS.wonT = GS.raceTime;
    if (!attract) {
      passSnd('done');
      const at = cornerAt(c.idx);
      notify('Past ' + nm(o) + (at ? ' at ' + at : '') + '!', NCOL.best, {
        ttl: 2.2,
        key: 'pass',
        pri: PRI.drs,
      });
    }
  }
  PS.car = null;
  PS.side = 0;
  PS.kind = '';
  PS.rest = 0;
}

/**
 * Every step for your car while the planner drives it: spots the cues and gestures of the chosen style, keeps a
 * committed pass going, and sets the car's brake bite (c.brkX) and slingshot boost (c.boost). Returns what the
 * planner needs for a committed pass ({ side, brk }), or null.
 */
export function passUpdate(c: Car, dt: number, thr: boolean) {
  // the gas, for a tap: a short lift after holding it
  let tap = false;
  if (thr) {
    if (!PS.prevThr && PS.liftT >= 0 && PS.liftT <= SLING.tapMax && PS.heldPrev >= SLING.holdMin) tap = true;
    PS.heldT += dt;
    PS.liftT = -1;
  } else {
    if (PS.prevThr) {
      PS.heldPrev = PS.heldT;
      PS.liftT = 0;
    } else if (PS.liftT >= 0) PS.liftT += dt;
    PS.heldT = 0;
  }
  PS.prevThr = thr;
  PS.rest += dt;
  if (PS.me !== c) {
    // swapped to the other car of your team: start afresh
    PS.me = c;
    PS.car = PS.cand = null;
    PS.meter = PS.boostT = 0;
  }
  if (c.streakT > 0) c.streakT -= dt;
  c.brkX = 1;
  if (PS.boostT > 0) PS.boostT -= dt;
  c.boost = PS.boostT > 0 ? Math.min(1, PS.boostT / 0.4) : 0; // fades over the last 0.4 s
  const mode = opts.pass | 0;
  if (mode && !PS.told && GS.state === 'race' && GS.raceTime > 2.5 && !attract && !GS.PRACTICE) {
    PS.told = true;
    notify('Passing: ' + PASS_NAMES[mode], NCOL.info, {
      sub: PASS_TIP[mode],
      ttl: 4,
      key: 'pass',
      pri: PRI.coach,
    });
  }
  if (!mode || GS.state !== 'race' || GS.raceTime < 4 || c.finished) {
    PS.car = PS.cand = null;
    PS.armed = PS.ready = false;
    return null;
  }
  // a committed pass under way: the planner takes the lane beside the other car until your car is ahead
  // (PS.ahead), then drives its own line again while the other car keeps clear, until the pass is done
  if (PS.car) {
    const o = PS.car,
      g = gapTo(c, o);
    PS.t += dt;
    const K = PS.kind === 'dive' ? DIVE : PS.kind === 'pressure' ? PRESS : SLING;
    if (g < AHEAD && !PS.ahead) {
      PS.ahead = true;
      PS.t = 0; // a few more seconds to get clear
    }
    if (g < DONE) finish(c, true);
    else if (o.gone || o.out || g > K.away || PS.t > K.maxT || (PS.ahead && g > 3)) finish(c, false);
    else if (!PS.ahead) {
      if (PS.kind === 'dive') c.brkX = DIVE.brake;
      return { side: PS.side, brk: c.brkX };
    }
  }
  const rested = PS.rest > 0.8;
  if (mode === 1) {
    // Dive: a car in the way and a braking zone coming up
    PS.armed = false;
    const o = rested ? aheadOf(c, DIVE.look, DIVE.lat) : null,
      bz = o ? brakeAhead(c) : 1e9,
      ca = o ? cornerAhead(c, bz + 160) : null,
      ins = ca ? (ca.C.dir > 0 ? 1 : -1) : 0;
    // the door is open: room on the inside of the car ahead, and you are not on its far side
    const open = o && ins && roomBeside(o, ins) >= ROOM && (c.lat - o.lat) * ins > -1.5;
    if (open && bz <= Math.max(50, c.v * DIVE.armT) && o.v < c.v + 4) {
      PS.cand = o;
      PS.candSide = ins;
      PS.armed = true;
      // still on the gas once they are on the brakes, close enough to get alongside: dive
      const g = gapTo(c, o);
      if (thr && g < DIVE.commitGap && (o.brk > 0.1 || o.v < c.v - 6)) commit(c, o, PS.candSide, 'dive');
    } else PS.cand = null;
  } else if (mode === 2) {
    // Pressure: the ring fills while you stay close
    const o = rested ? aheadOf(c, 70, 4) : null;
    const gt = o ? gapTo(c, o) / Math.max(c.v, 10) : 9;
    if (o && gt < PRESS.gapT && GS.raceTime > 8) {
      if (o !== PS.cand) PS.meter *= 0.4;
      PS.cand = o;
      const q = clamp((PRESS.gapT - gt) / (PRESS.gapT - PRESS.near), 0, 1),
        z = DYN && DYN.ready ? DYN.line.zone[c.idx] : 0,
        hot = z === 1 || z === 3 || Math.abs(GS.ccurv[c.idx]) > 1 / 180;
      PS.meter = Math.min(1, PS.meter + dt * PRESS.fill * q * (hot ? PRESS.corner : 1));
      PS.candSide = sideFor(c, o, 220);
      if (PS.meter >= 1 && gapTo(c, o) < PRESS.strike) {
        o.crackT = PRESS.crackT;
        o.crackSide = -PS.candSide; // it runs wide, away from the side you take
        commit(c, o, PS.candSide, 'pressure');
      }
    } else {
      PS.meter = Math.max(0, PS.meter - dt * PRESS.decay);
      if (PS.meter <= 0) PS.cand = null;
    }
  } else if (mode === 3) {
    // Slingshot: charge in the tow, tap to go
    const o = rested ? aheadOf(c, 48, 3) : null;
    if (o && c.tow > SLING.tow && gapTo(c, o) < SLING.near)
      PS.meter = Math.min(1, PS.meter + dt / SLING.charge);
    else PS.meter = Math.max(0, PS.meter - dt * 0.7);
    PS.cand = o && PS.meter > 0 ? o : null;
    // ready: charged, on a straight with room to get by before the next braking zone, and the car ahead not pulling away
    PS.ready =
      !!o && PS.meter >= 1 && o.v < c.v + 3 && brakeAhead(c) >= Math.max(SLING.room, c.v * SLING.roomT);
    if (o) PS.candSide = sideFor(c, o, 220);
    if (PS.ready && tap) {
      PS.boostT = SLING.boostT;
      commit(c, o, PS.candSide, 'sling');
    }
  }
  return null;
}

/**
 * How an AI car drives while it is being passed or has cracked under pressure: the lateral room it keeps
 * ({lo, hi}, metres from the centre line) and a speed factor. null = drive as usual.
 */
export function passAI(c: Car, dt: number) {
  let lo = -1e9,
    hi = 1e9,
    slow = 1,
    cap = 1e9,
    on = false;
  if (c.crackT > 0) {
    // cracked: locked brakes and a run wide
    c.crackT -= dt;
    slow = c.crackT > PRESS.crackT - PRESS.lockT ? PRESS.lock : PRESS.slow;
    const w = c.crackSide * PRESS.wide * dt;
    if (c.crackSide > 0) lo = Math.min(GS.HW - 0.6, c.lat + w);
    else hi = Math.max(-GS.HW + 0.6, c.lat + w);
    if (c.crackT > PRESS.crackT - 0.6 && c.v > 15 && Math.random() < 0.6) {
      const ch = Math.cos(c.h),
        sh = Math.sin(c.h);
      for (const s of [-0.8, 0.8])
        spawn(c.x + ch * 1.4 - sh * s, c.y + sh * 1.4 + ch * s, 0.4, 'rgba(235,235,235,1)', 0.9, 1.2);
    }
    on = true;
  }
  const p = cars[GS.ctrl];
  if (PS.car === c && p && !p.gone) {
    // being passed: once a pass is committed the other driver leaves a car's width on that side (and, once the
    // passing car is alongside, keeps clear of it), and on a dive lifts a touch, so a committed move sticks
    const g = gapTo(c, p);
    if (g > -YIELD.look && g < 12) {
      let room = PS.side * (GS.HW - YIELD.lane);
      // pulled out beside it, or alongside: keep a car's width from the passing car; once its nose is alongside, let
      // it by (only then: capped to the speed of a car still behind, both would slow down together)
      const out = (p.lat - c.lat) * PS.side;
      if ((g > -YIELD.near && out > 0.6) || PS.ahead)
        room = PS.side > 0 ? Math.min(room, p.lat - 3.5) : Math.max(room, p.lat + 3.5);
      if ((g > -YIELD.near && out > 1.2) || (g > -YIELD.along && out > 0.6) || PS.ahead)
        cap = Math.max(0, p.v - YIELD.by);
      if (PS.side > 0) hi = Math.min(hi, room);
      else lo = Math.max(lo, room);
      slow = Math.min(slow, PS.kind === 'dive' ? YIELD.dive : PS.kind === 'sling' ? YIELD.sling : 1);
      on = true;
    }
  }
  return on ? { lo, hi, slow, cap } : null;
}

/** your car is not on the planner (Classic line, other steering): no passing style, no boost */
export function passIdle(c: Car): void {
  c.brkX = 1;
  c.boost = 0;
  PS.car = PS.cand = null;
  PS.armed = PS.ready = false;
}
/** debug: is a pass request on, and for which car */
export function passDebug() {
  return {
    mode: opts.pass,
    car: PS.car ? PS.car.name : null,
    side: PS.side,
    kind: PS.kind,
    cand: PS.cand ? PS.cand.name : null,
    armed: PS.armed,
    meter: +PS.meter.toFixed(2),
    ready: PS.ready,
    n: PS.n,
    ok: PS.ok,
  };
}
