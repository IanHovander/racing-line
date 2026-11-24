// Dynamic racing lines: every car on every circuit, dry or wet, offline and online.
//
// The planner in dynline.ts works out the fastest line for a car within a difficulty level's reserves (see the
// contract at the top of that file). This module is the game's side of it:
//  - The player's car (Steering: Auto) is driven by the planner along the line of opts.dynlv:
//    0 = the classic fixed line, 1..4 = Novice / Intermediate / Cautious Expert / Perfect Expert.
//  - AI cars follow the line of the Opponents setting (Easy = Novice, Medium = Intermediate, Hard = Cautious
//    Expert) for their own car, with the usual traffic logic in ai.ts. Perfect Expert is the player's alone.
//  - Lines come ready-made from public/dynlines.json (written by tools/precompute.cjs); a missing or out-of-date
//    one is worked out in the background and kept in localStorage.
//  - Online: every player's own car is planned on their own machine at their own Line Difficulty (a personal
//    control, like pedals and steering); the host drives the AI on the lines of the room's Opponents level.
//    Only car states cross the network, as before.
// docs/dynamic-racing-line.md has the design and the reasons.
import { GS } from '../state';
import { clamp, store } from '../core/dom';
import { attract, cars, opts } from '../game/race';
import { pursuit } from './ai';
import { BPROF, BRK, GRIP, VCAP, VMAX } from './car-model';
import { create } from './dynline';
import { PS } from './passing';
import { PROF, buildProfile, setLineCurv } from './profile';
import { MP, hostPeer } from '../net/multiplayer';
import { TEAM_STATS } from '../teams/team-stats';
import { WETB, WETG, WX } from '../track/track';
import { showToast, updatePads } from '../ui/controls';
import { syncAllSegs } from '../ui/widgets';
import { WZ } from '../ui/wizard';

export const DYN_NAMES = ['Classic', 'Novice', 'Intermediate', 'Cautious Expert', 'Perfect Expert'];
/** AI pace on its line, added to the classic skill (0.9 / 0.955 / 1.0): about 0.973 / 0.983 / 0.983 of the line's own speeds. With the early braking aim in AI_TIMING (sim/ai.ts) that leaves the AI a little short of a well-timed player on the same line */
export const DYN_AIB = [0.073, 0.028, -0.017];
/** grip of each surface relative to tarmac in the wet (as in physics()) */
export const DYN_WETS = [34, 31, 18, 10, 22, 19].map(
  (g, i) => (g * [0.72, 0.55, 0.7, 0.85, 0.7, 0.55][i]) / (34 * 0.72),
);

/** the planner driving the player's car (null on the classic line), and its stats */
export let DYN: any = null,
  DYNSTAT: any = null;
/** circuit + weather the planners in DYNP belong to */
export let DYNKEY = '';
/** planners by "team:level" */
export let DYNP: any = {};
/** planners whose line is still being built */
export let DYNQ: any[] = [];
/** the team whose car the player drives */
export let DYNTM = 0;
/** per team: the line the AI drives (lateral offsets), its speed profile, zones, curvature and heading. Empty = the classic line */
export let AIL: any[] = [],
  AIV: any[] = [],
  AIZ: any[] = [],
  AIK: any[] = [],
  AIH: any[] = [];
/** the ready-made lines, by "circuit:team:level:wet" (null until public/dynlines.json has arrived) */
export let DYNLINES: any = null;
let busy = false;
/** circuit + weather whose expert lines the classic line was last taken from */
let classicKey = '';

/** forget every planner (the track is being rebuilt) */
export function dynDrop(): void {
  classicKey = '';
  setLineCurv(null); // the track is being rebuilt: its line is the elastic one again
  DYN = null;
  DYNSTAT = null;
  DYNKEY = '';
  DYNP = {};
  DYNQ = [];
  AIL = [];
  AIV = [];
  AIZ = [];
  AIK = [];
  AIH = [];
}
export function dynEligible(): boolean {
  return !!GS.TR && !!GS.N;
}
/** the team whose car you drive: your pick, or in an online race the seat the host's grid gave you */
export function dynTeam(): number {
  const c = cars[GS.ctrl];
  return !attract && c && c.mine && !c.remote ? c.team : opts.team;
}
/** a planner for one car on the present circuit and weather (its line not built yet) */
export function dynMake(team: number, level: number) {
  const st = TEAM_STATS[team];
  return create(
    {
      N: GS.N,
      SEG: GS.SEG,
      L: GS.L,
      HW: GS.HW,
      cx: GS.cx,
      cy: GS.cy,
      tx: GS.tx,
      ty: GS.ty,
      nx: GS.nx,
      ny: GS.ny,
      SL: GS.SL,
      ccurv: GS.ccurv,
      refLat: GS.off,
      refV: PROF[team],
    },
    {
      grip: GRIP * st.grip * WETG(),
      acc: 13 * st.acc,
      vmax: VMAX * st.top,
      vcap: VCAP * st.top,
      brk: BRK * st.brk * WETB(),
      kmax: 1 / 7,
      surf: WX.rain ? DYN_WETS : null,
    },
    { level },
  );
}
// A line is kept as its spline control points in quarter-millimetre steps, packed as little-endian 16-bit numbers
// in base64 (range +-8.19 m; the road is at most 7 m either side). Coarser steps roughen the curvature of the line:
// 1 mm steps cost 0.02 to 0.08 s a lap, and rounding the 2 m samples of the line itself far more.
const CTL_STEPS = 4000; // steps per metre
export function dynDecode(b: string): Float64Array {
  const s = atob(b),
    n = s.length >> 1,
    a = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    let v = s.charCodeAt(2 * i) | (s.charCodeAt(2 * i + 1) << 8);
    if (v > 32767) v -= 65536;
    a[i] = v / CTL_STEPS;
  }
  return a;
}
export function dynEncode(c: ArrayLike<number>): string {
  let b = '';
  for (let j = 0; j < c.length; j++) {
    let v = Math.round(c[j] * CTL_STEPS);
    if (v < 0) v += 65536;
    b += String.fromCharCode(v & 255, v >> 8);
  }
  return btoa(b);
}
/** the planner for a car and level, with its line loaded if a ready-made or saved one matches */
export function dynGet(team: number, level: number) {
  const k = team + ':' + level;
  let D = DYNP[k];
  if (D) return D;
  D = DYNP[k] = dynMake(team, level);
  D.key = GS.TR.id + ':' + team + ':' + level + ':' + (WX.rain ? 1 : 0);
  const pre = DYNLINES && DYNLINES[D.key];
  if (pre && pre.sig === D.sig) D.setCtl(dynDecode(pre.c));
  if (!D.ready) {
    const sv = store.get('dynl_' + D.key, null);
    if (sv && sv.sig === D.sig && sv.c) D.setCtl(dynDecode(sv.c));
  }
  return D;
}
function dynSave(D): void {
  if (D.ctl) store.set('dynl_' + D.key, { sig: D.sig, c: dynEncode(D.ctl) });
}
/** which line each AI car drives: its team's line at the Opponents level, once that line is ready */
export function dynAssign(): void {
  AIL = [];
  AIV = [];
  AIZ = [];
  AIK = [];
  AIH = [];
  if (!DYNKEY) return;
  const lv = opts.diff + 1;
  for (let t = 0; t < TEAM_STATS.length; t++) {
    const D = DYNP[t + ':' + lv];
    if (D && D.ready) {
      AIL[t] = D.line.lat;
      AIV[t] = D.line.v;
      AIZ[t] = D.line.zone;
      AIK[t] = D.line.kap;
      AIH[t] = D.line.psi;
    }
  }
}
// ---- Classic: one fixed line for everyone, taken from the experts ----
// The classic line (GS.off: what Classic steering, Lanes, Overtake and the AI without a line of its own follow) used to
// come from an elastic band pulled tight through the corners. Once the ready-made lines are here it is replaced by the
// consensus of the experts: the average of the five cars' lines at one level, scaled in from that level's edge margin to
// the classic one (1.1 m), so it is a real racing line found for lap time. It stays a fixed line: nothing is re-planned
// from the car, which is what makes it Classic. Only ready-made lines are used; nothing is built for this.
/** level: which experts' lines (0 keeps the elastic line). care: how much sharper the line's corners are taken to be when its speeds are worked out; 1.1 leaves pure pursuit about as much room as it had on the elastic line (0.1 to 2 s of sliding a lap) */
export const CLASSIC = { level: 3, care: 1.1 };
function adoptClassic(): void {
  if (classicKey === DYNKEY || !CLASSIC.level) return;
  const P = [];
  for (let t = 0; t < TEAM_STATS.length; t++) {
    const D = dynGet(t, CLASSIC.level);
    if (!D.ready) return;
    P.push(D);
  }
  const E = GS.HW - 1.1,
    k = Math.min(1, E / (GS.HW - P[0].cfg.edge));
  for (let i = 0; i < GS.N; i++) {
    let a = 0;
    for (const D of P) a += D.line.lat[i];
    GS.off[i] = clamp((a / P.length) * k, -E, E);
    GS.rx[i] = GS.cx[i] + GS.nx[i] * GS.off[i];
    GS.ry[i] = GS.cy[i] + GS.ny[i] * GS.off[i];
  }
  // its curvature, measured as the planner measures a line (the circle through the points 4 m behind, here and 4 m
  // ahead) and lightly smoothed: the wide fit in buildProfile() suits the gentle elastic line but sees the sharper
  // corners of an expert line as rounder than they are, and the car then slides through them.
  const N = GS.N,
    raw = new Float64Array(N),
    kap = new Float64Array(N);
  for (let i = 0; i < N; i++) {
    const a = (i - 2 + N) % N,
      b = (i + 2) % N,
      ux = GS.rx[i] - GS.rx[a],
      uy = GS.ry[i] - GS.ry[a],
      wx = GS.rx[b] - GS.rx[i],
      wy = GS.ry[b] - GS.ry[i],
      d = Math.hypot(ux, uy) * Math.hypot(wx, wy) * Math.hypot(GS.rx[b] - GS.rx[a], GS.ry[b] - GS.ry[a]);
    raw[i] = Math.abs((2 * (ux * wy - uy * wx)) / Math.max(d, 1e-9));
  }
  for (let i = 0; i < N; i++)
    kap[i] = Math.max(raw[(i - 1 + N) % N], raw[i], raw[(i + 1) % N]) * CLASSIC.care;
  setLineCurv(kap);
  buildProfile(); // the speed profiles and zones of the fixed line
  classicKey = DYNKEY;
}
/** build the queued lines a few milliseconds at a time */
function dynPump(): void {
  if (busy) return;
  const go = () => {
    busy = false;
    const D = DYNQ[0];
    if (!D) return;
    if (D.ready) DYNQ.shift();
    else if (D.build(8) >= 1) {
      DYNQ.shift();
      dynSave(D);
      dynAssign();
      if (D === DYN && GS.state === 'race' && !attract) showToast(D.name + ' racing line ready');
    }
    if (DYNQ.length) {
      busy = true;
      setTimeout(go, 0);
    }
  };
  go();
}
/**
 * Get the lines for this circuit, weather, Opponents level and the car you drive. Call after anything
 * those depend on has changed (setupRace does). `sync` builds missing lines before returning (tools).
 */
export function dynPrepare(sync?: boolean): void {
  if (!dynEligible() || !DYNLINES) {
    dynDrop();
    return;
  }
  const key = GS.TR.id + ':' + (WX.rain ? 1 : 0) + ':' + GS.N;
  if (key !== DYNKEY) {
    // lines are kept while the circuit and the weather stay the same
    DYNKEY = key;
    DYNP = {};
  }
  adoptClassic();
  DYNTM = dynTeam();
  const need = [];
  if (opts.dynlv) need.push(dynGet(DYNTM, opts.dynlv));
  for (let t = 0; t < TEAM_STATS.length; t++) {
    const D = dynGet(t, opts.diff + 1);
    if (!need.includes(D)) need.push(D);
  }
  DYN = opts.dynlv ? need[0] : null;
  DYNSTAT = DYN ? DYN.stats : null;
  if (DYN && DYN.ready) DYN.reset();
  DYNQ = need.filter(D => !D.ready);
  if (sync) {
    for (const D of DYNQ) {
      D.build(Infinity);
      dynSave(D);
    }
    DYNQ = [];
  }
  dynAssign();
  if (DYNQ.length) dynPump();
}
/** is this car being driven by the planner right now? */
export const dynOn = c =>
  !!(DYN && DYN.ready && opts.dynlv && opts.steer === 0 && c.team === DYNTM && !c.remote);
const OBS: any[] = [];
/** the other cars near the player, as the planner wants them */
export function dynObstacles(c) {
  OBS.length = 0;
  for (const o of cars) {
    if (o === c || o.gone || o.ghost > 0) continue;
    let d = o.s - c.s;
    if (d < -GS.L / 2) d += GS.L;
    else if (d > GS.L / 2) d -= GS.L;
    if (d < -30 || d > 220) continue;
    OBS.push({ d, lat: o.lat, v: o.v, x: o.x, y: o.y, h: o.h, out: !!o.out, tgt: o === PS.car });
  }
  return OBS;
}
/** contact assist for the dynamic line: brake only for a car that the planned path does not steer clear of */
export function dynAheadCap(c): number {
  let cap = 1e9;
  const p = DYN.cur,
    look = Math.max(14, c.v * 0.9),
    k0 = (c.idx - p.i0 + GS.N) % GS.N;
  for (const o of cars) {
    if (o === c || o.gone || o.ghost > 0) continue;
    let d = o.s - c.s;
    if (d < -GS.L / 2) d += GS.L;
    else if (d > GS.L / 2) d -= GS.L;
    if (d <= 0 || d > look) continue;
    if (o === PS.car && (c.lat - o.lat) * PS.side > 0.6) continue; // a committed pass, pulled out beside it: the plan goes by (sim/passing.ts)
    const tl = p.lat[clamp(k0 + Math.round(d / GS.SEG), 0, p.n - 1)]; // where the plan puts this car when it reaches the other one
    if (Math.abs(o.lat - tl) > 2.3 && (d > 9 || Math.abs(o.lat - c.lat) > 2.0)) continue;
    cap = Math.min(cap, Math.sqrt(Math.max(0, o.v * o.v + 2 * BPROF * WETB() * 0.8 * Math.max(0, d - 5.5))));
  }
  return cap;
}
/**
 * AI steering on its line: while the car is on the line (no lane offset for traffic, small errors) it steers by
 * the line's own curvature plus a little correction, which is smooth and exact; otherwise, and blended in
 * between, pure pursuit as on the classic line.
 */
export function aiSteer(c, LN): number {
  const k = pursuit(c, LN);
  const KP = AIK[c.team];
  if (!KP || LN === GS.off) return k;
  const al = Math.abs(c.lane);
  if (al >= 0.5) return k;
  const N = GS.N,
    f = c.s / GS.SEG,
    i = Math.floor(f) % N,
    j = (i + 1) % N,
    u = f - Math.floor(f),
    e = c.lat - (LN[i] + (LN[j] - LN[i]) * u),
    ae = Math.abs(e);
  if (ae >= 1.5) return k;
  const HP = AIH[c.team],
    tX = GS.tx[i] + (GS.tx[j] - GS.tx[i]) * u,
    tY = GS.ty[i] + (GS.ty[j] - GS.ty[i]) * u,
    ch = Math.cos(c.h),
    sh = Math.sin(c.h);
  const pe = Math.atan2(tX * sh - tY * ch, tX * ch + tY * sh) - (HP[i] + (HP[j] - HP[i]) * u),
    ap = Math.abs(pe);
  if (ap >= 0.25) return k;
  const w = clamp((0.5 - al) / 0.3, 0, 1) * clamp((1.5 - ae) / 0.7, 0, 1) * clamp((0.25 - ap) / 0.12, 0, 1);
  return k + w * (KP[i] + (KP[j] - KP[i]) * u - 0.012 * e - 0.22 * pe - k);
}
/** choose the line you follow (Settings, the pause menu, the lobby, or L in a race) */
export function setDynLevel(lv: number): void {
  if (!dynEligible()) return;
  opts.dynlv = lv;
  store.set('dynlv', lv);
  dynPrepare();
  if (!attract) showToast('Racing line: ' + DYN_NAMES[lv] + (lv && DYN && !DYN.ready ? ' (preparing…)' : ''));
  updatePads();
  syncAllSegs();
}
export function cycleDyn(): void {
  if (attract) return;
  setDynLevel((opts.dynlv + 1) % 5);
}

// ---- drawing the line: when, and for which corners ----
// Whether the racing line is drawn. It starts shown, in practice and in races (single player and online);
// each of the two remembers its own choice, made in Settings, in the pause menu or with H. opts.line is the
// choice for the session being set up or driven: 0 = hidden, 1 = shown, 2 = difficult turns only (hardMask).
export function linePractice(): boolean {
  if (!attract) return !!GS.PRACTICE;
  if (MP.room) {
    // in an online lobby: the session the host has picked
    const hp = MP.host ? null : hostPeer(),
      cfg = MP.host ? MP.rules : hp && hp.presence.cfg;
    return !!(cfg && cfg.practice);
  }
  return !!WZ && WZ.mode === 'practice';
}
export function lineLoad(): void {
  const p = linePractice(),
    v = store.get(p ? 'lineP' : 'lineR', 1);
  opts.line = v === true ? 1 : v === 1 || v === 2 ? v : 0;
  syncAllSegs();
}
export function lineSave(): void {
  store.set(linePractice() ? 'lineP' : 'lineR', opts.line | 0);
}
/**
 * "Difficult turns": the line is drawn only for the hardest braking points of the circuit. A braking zone counts
 * when the car has to lose 28 m/s (100 km/h) or more, or come down to 55% of its speed or less; of those the five
 * biggest stops are kept, and a circuit with fewer than three gets its next biggest stops added (if they lose at
 * least 15 m/s). The line then shows from about two seconds before the braking point to a little past the slowest
 * point of the corner.
 */
export const HARD = { drop: 28, ratio: 0.55, lead: 2, max: 5, min: 3 };
const HARDM = new WeakMap<object, any>();
/** v and z are a line's speeds and zones (the dynamic line's or the classic one's); returns 1 per sample where the line is drawn */
export function hardMask(v, z) {
  const N = GS.N;
  let m = HARDM.get(z);
  if (m && m.length === N) return m;
  m = new Uint8Array(N);
  HARDM.set(z, m);
  const br = i => z[i] === 1 || z[i] === 3;
  let s0 = 0;
  while (s0 < N && br(s0)) s0++;
  if (s0 >= N) return m;
  const Z = [];
  for (let n = 0; n < N;) {
    const a = (s0 + n) % N;
    if (!br(a)) {
      n++;
      continue;
    }
    let len = 0;
    while (len < N && br((a + len) % N)) len++;
    let mn = 1e9,
      mk = 0;
    for (let k = 0; k < len + 25; k++) {
      const u = v[(a + k) % N];
      if (u < mn) {
        mn = u;
        mk = k;
      }
    }
    Z.push({ a, mk, drop: v[a] - mn, hard: v[a] - mn >= HARD.drop || mn <= HARD.ratio * v[a] });
    n += len;
  }
  Z.sort((p, q) => q.drop - p.drop);
  const pick = Z.filter(e => e.hard).slice(0, HARD.max);
  for (const e of Z) {
    if (pick.length >= HARD.min) break;
    if (!pick.includes(e) && e.drop >= 15) pick.push(e);
  }
  for (const e of pick) {
    const lead = Math.round(clamp(v[e.a] * HARD.lead, 60, 170) / GS.SEG);
    for (let k = -lead; k <= e.mk + 10; k++) m[(((e.a + k) % N) + N) % N] = 1;
  }
  m.turns = pick.length;
  return m;
}

/** start-up: fetch the ready-made lines (tools and tests may hand them over on globalThis.DYNLINES instead) */
export function init(): void {
  const pre = (globalThis as any).DYNLINES;
  if (pre) {
    DYNLINES = pre;
    return;
  }
  if (typeof fetch !== 'function') {
    DYNLINES = {};
    return;
  }
  fetch('./dynlines.json')
    .then(r => (r.ok ? r.json() : {}))
    .catch(() => ({}))
    .then(d => {
      DYNLINES = d || {};
      dynPrepare();
    });
}
/** debug/test hook: reassign a module-level binding */
export function __set(name: string, v: any): void {
  switch (name) {
    case 'DYN':
      DYN = v;
      break;
    case 'DYNKEY':
      DYNKEY = v;
      break;
    case 'DYNP':
      DYNP = v;
      break;
    case 'DYNQ':
      DYNQ = v;
      break;
    case 'DYNLINES':
      DYNLINES = v;
      break;
  }
}
