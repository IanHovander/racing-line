import { GS } from '../state';
import { cars, opts } from '../game/race';
import { DYN, dynOn } from '../sim/lines';
import { PROF } from '../sim/profile';
import { standings } from '../sim/step';
import { gapT, progress } from '../sim/timing';
import { NCOL, PRI, notify } from './notify';
import { cornerAt } from '../track/track';
// coaching: short comments on notably good or poor corners and on passes made or lost (your car only)
GS.FB_LAST = -99;
export function feedback(txt, col) {
  if (GS.raceTime - GS.FB_LAST < 2.5) return;
  GS.FB_LAST = GS.raceTime;
  notify(txt, col, { key: 'coach', pri: PRI.coach });
}
const PASS_HOLD = 3;
export function coach(c, dt) {
  if (!GS.CORNERS.length || c.v < 1) return;
  const kmh = v => Math.round(v * 3.6);
  const nm = o => o.name.split(' ').pop() || o.name;
  // corners
  const n = GS.CMAP[c.idx];
  const K = c.coach || (c.coach = {});
  if (n > 0 && K.n !== n) {
    const C = GS.CORNERS[n - 1];
    K.n = n;
    K.minV = c.v;
    K.minP = 1e9;
    K.off = false;
    K.bump = c.bumpT;
    K.traffic = false;
    K.C = C;
  }
  if (K.n > 0 && K.C) {
    const C = K.C,
      pv = opts.steer === 0 && dynOn(c) ? DYN.line.v : PROF[c.team] || GS.vf; // the line being driven
    K.minV = Math.min(K.minV, c.v);
    K.minP = Math.min(K.minP, pv[c.idx]);
    if (c.surf >= 2 || Math.abs(c.lat) > GS.HW + 0.8) K.off = true;
    for (const o of cars) {
      if (o === c || o.gone) continue;
      let d = o.s - c.s;
      if (d < -GS.L / 2) d += GS.L;
      else if (d > GS.L / 2) d -= GS.L;
      if (d > 0 && d < 28 && Math.abs(o.lat - c.lat) < 3) K.traffic = true;
    }
    let past = (c.idx - C.i1 + GS.N) % GS.N;
    if (past < GS.N / 2 && past > 10) {
      const ca = 'T' + K.n;
      if (K.bump !== c.bumpT) {
      } // contact in the corner: no grade
      else if (K.off) feedback('Ran wide at ' + ca, NCOL.bad);
      else if (!K.traffic && C.R < 150 && K.minV >= K.minP * 0.98) {
        const cb = c.cBest || (c.cBest = {}),
          pb = cb[K.n];
        if (pb !== undefined && K.minV > pb + 0.6)
          feedback(
            'Best yet at ' + ca + ' — ' + kmh(K.minV) + ' km/h, +' + (kmh(K.minV) - kmh(pb)) + ' km/h',
            NCOL.good,
          );
      } else if (!K.traffic && C.R < 150 && K.minV < K.minP * 0.86)
        feedback('Slow through ' + ca + ' (−' + (kmh(K.minP) - kmh(K.minV)) + ' km/h)', NCOL.slow);
      if (!K.off && K.bump === c.bumpT) {
        const cb = c.cBest || (c.cBest = {});
        cb[K.n] = Math.max(cb[K.n] || 0, K.minV);
      }
      K.n = 0;
      K.C = null;
    }
  }
  // passes: compare race distance to nearby cars
  const P0 = progress(c);
  const rel = c.relP || (c.relP = new Map());
  for (const o of cars) {
    if (o === c || o.gone) continue;
    const d = progress(o) - P0;
    if (Math.abs(d) > 40) {
      rel.delete(o);
      continue;
    }
    let r = rel.get(o);
    const side = d > 3.5 ? 1 : d < -3.5 ? -1 : 0;
    if (!r) {
      if (side) rel.set(o, { s: side, t: -99 });
      continue;
    }
    if (!side || side === r.s) continue;
    const flip = GS.raceTime - r.t > 6;
    r.s = side;
    r.t = GS.raceTime;
    if (!flip || o.out || GS.raceTime < 8) continue;
    const at = cornerAt(c.idx);
    // a pass is only praised once it sticks: still ahead PASS_HOLD s later (checked below)
    if (side < 0) (c.passPend || (c.passPend = [])).push({ o, t: GS.raceTime, at });
    else feedback(nm(o) + ' gets past' + (at ? ' at ' + at : ''), NCOL.lost);
  }
  if (c.passPend && c.passPend.length)
    c.passPend = c.passPend.filter(p => {
      if (p.o.gone || progress(p.o) > progress(c)) return false; // repassed (or gone): no praise
      if (GS.raceTime - p.t < PASS_HOLD) return true;
      feedback('Nice move on ' + nm(p.o) + (p.at ? ' into ' + p.at : ''), NCOL.best);
      return false;
    });
}
/** lap complete: laps done and the gap to the leader (or, when leading, the margin over P2).
 *  The dot is purple for the fastest lap of anyone, green for your best (or close), yellow for slower. */
export function lapCard(c) {
  const lt = c.last;
  if (!lt) return;
  const done = c.cross - 1,
    left = opts.laps - done;
  const fast = Math.min(...cars.filter(o => o.best).map(o => o.best));
  const col = lt <= fast + 1e-6 ? NCOL.best : lt <= c.best + 0.3 ? NCOL.good : NCOL.slow;
  const st = standings().filter(o => !o.out),
    i = st.indexOf(c);
  const nm = o => o.name.split(' ').pop() || o.name;
  const m = (v: number) => `<span class="m">${v.toFixed(1)}</span>&#8239;s`;
  let gap = '';
  if (i > 0) {
    const g = gapT(st[0], c);
    if (g !== null) gap = `${m(g)} behind ${nm(st[0])}`;
  } else if (st[1]) {
    const g = gapT(c, st[1]);
    if (g !== null) gap = `Leading by ${m(g)}`;
  }
  const lab = GS.PRACTICE
    ? `Lap ${done}`
    : left <= 0
      ? 'Finished'
      : `Lap ${done} of ${opts.laps}` + (left === 1 ? ' · Final lap' : '');
  notify(GS.PRACTICE || !gap ? lab : `${lab} · ${gap}`, col, { key: 'lap', ttl: 4, pri: PRI.lap });
}
