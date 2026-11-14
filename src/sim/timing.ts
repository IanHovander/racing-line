import { GS } from '../state';
import { attract, cars } from '../game/race';
import { standings } from './step';
import { fmt } from '../ui/hud';
// sector times: purple = fastest of anyone this race, green = your best or within 0.15 s of it, yellow = slower
export const fmtS = t => (t < 60 ? t.toFixed(3) : fmt(t));
export function secDone(c, k) {
  const t = GS.raceTime - c.secT;
  c.secT = GS.raceTime;
  if (!c.secCur || t < 1) return;
  c.secBest = c.secBest || [0, 0, 0];
  const pb = c.secBest[k];
  let col;
  if (!GS.SB[k] || t < GS.SB[k]) {
    GS.SB[k] = t;
    col = 'p';
  } else if (!pb || t <= pb + 0.15) col = 'g';
  else col = 'y';
  if (col === 'p') {
    for (const o of cars)
      if (o.secCur)
        o.secCur.forEach((e, j) => {
          if (j === k && e && e.col === 'p' && o !== c) e.col = 'g';
        });
  }
  if (!pb || t < pb) c.secBest[k] = t;
  c.secCur[k] = { t, col };
  if (k === 2) {
    c.secPrev = c.secCur;
    c.secHold = GS.raceTime + 4;
  }
}
// timing points every 10 m of race distance: the race time each car reached them, for steady time gaps
export function tpB(c) {
  return Math.floor((progress(c) + GS.L) / 10);
}
// race stats for the results awards: top speed, overtakes, places gained, laps led, clean driving, DRS, slipstream, contacts
GS.STAT_T = 0;
GS.PAIRS = new Map();
export function statTick(dt) {
  if (attract || GS.state !== 'race') return;
  for (const c of cars) {
    if (c.gone) continue;
    const S =
      c.stat ||
      (c.stat = { vmax: 0, pass: 0, lost: 0, offT: 0, ledT: 0, drsN: 0, towT: 0, hits: 0, minPos: 99 });
    if (!c.out && !c.finished) {
      S.vmax = Math.max(S.vmax, c.v);
      if (c.surf >= 2) S.offT += dt;
      if (c.tow > 0.3) S.towT += dt;
      if (c.drs && !S._drs) S.drsN++;
      S._drs = !!c.drs;
    }
  }
  GS.STAT_T -= dt;
  if (GS.STAT_T > 0) return;
  GS.STAT_T = 0.1;
  const st = standings();
  if (st[0] && !st[0].finished && st[0].stat) st[0].stat.ledT += 0.1;
  st.forEach((c, i) => {
    if (c.stat) c.stat.minPos = Math.min(c.stat.minPos, i + 1);
  });
  if (GS.raceTime < 3) return;
  for (let i = 0; i < cars.length; i++)
    for (let j = i + 1; j < cars.length; j++) {
      const A = cars[i],
        B = cars[j];
      if (A.gone || B.gone || A.out || B.out || A.finished || B.finished) continue;
      const d = progress(A) - progress(B),
        key = i * 64 + j;
      if (Math.abs(d) > 40) {
        GS.PAIRS.delete(key);
        continue;
      }
      const sd = d > 3.5 ? 1 : d < -3.5 ? -1 : 0;
      if (!sd) continue;
      const r = GS.PAIRS.get(key);
      if (!r) {
        GS.PAIRS.set(key, { s: sd, t: -99 });
        continue;
      }
      if (r.s === sd) continue;
      const ok = GS.raceTime - r.t > 4;
      r.s = sd;
      r.t = GS.raceTime;
      if (!ok) continue;
      const W = sd > 0 ? A : B,
        Lz = sd > 0 ? B : A;
      W.stat.pass++;
      Lz.stat.lost++;
    }
}
export function tpRec(c) {
  if (attract || (GS.state !== 'race' && GS.state !== 'finished') || c.finished) return;
  const b = tpB(c);
  if (!c.tp) {
    c.tp = [];
    c.tpN = b;
    c.tp[b] = GS.raceTime;
    return;
  }
  if (b > c.tpN && b - c.tpN < 400) {
    for (let k = c.tpN + 1; k <= b; k++) c.tp[k] = GS.raceTime;
    c.tpN = b;
  }
}
// how many seconds a is ahead of b (null if unknown)
export function gapT(a, b) {
  if (a.finished && b.finished) return b.ftime + b.pen - (a.ftime + a.pen);
  if (!a.tp) return null;
  const t = a.tp[tpB(b)];
  return t === undefined ? null : Math.max(0, GS.raceTime - t);
}
export function progress(c) {
  return c.cross >= 1 ? (c.cross - 1) * GS.L + c.s : c.s - GS.L;
}
