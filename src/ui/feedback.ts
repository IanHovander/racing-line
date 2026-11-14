import { GS } from '../state';
import { $ } from '../core/dom';
import { cars, opts } from '../game/race';
import { PROF } from '../sim/profile';
import { standings } from '../sim/step';
import { fmtS, gapT, progress } from '../sim/timing';
import { cornerAt } from '../track/track';
// lap complete card: laps to go, the lap time (purple = fastest of anyone, green = your best or close to it, yellow = slower), gaps to the cars around you
// coaching: short comments on notably good or poor corners and on passes made or lost (your car only)
GS.FB_T = 0;
GS.FB_LAST = -99;
export function feedback(txt, col) {
  if (GS.raceTime - GS.FB_LAST < 2.5) return;
  GS.FB_LAST = GS.raceTime;
  const el = $('fb');
  el.innerHTML = '<i style="background:' + col + '"></i>' + txt;
  el.classList.toggle('top2', GS.LAPC_T > 0);
  el.classList.remove('hide');
  el.style.animation = 'none';
  void el.offsetWidth;
  el.style.animation = '';
  GS.FB_T = 3;
}
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
      pv = PROF[c.team] || GS.vf;
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
      else if (K.off) feedback('Ran wide at ' + ca, '#ff6b5e');
      else if (!K.traffic && C.R < 150 && K.minV >= K.minP * 0.98) {
        const cb = c.cBest || (c.cBest = {}),
          pb = cb[K.n];
        if (pb !== undefined && K.minV > pb + 0.6)
          feedback(
            'Best yet at ' + ca + ' — ' + kmh(K.minV) + ' km/h, +' + (kmh(K.minV) - kmh(pb)) + ' km/h',
            '#2ecc71',
          );
      } else if (!K.traffic && C.R < 150 && K.minV < K.minP * 0.86)
        feedback('Slow through ' + ca + ' (−' + (kmh(K.minP) - kmh(K.minV)) + ' km/h)', '#ffd60a');
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
    if (side < 0) feedback('Nice move on ' + nm(o) + (at ? ' into ' + at : ''), '#c77dff');
    else feedback(nm(o) + ' gets past' + (at ? ' at ' + at : ''), '#ff8a3d');
  }
}
export function lapCard(c) {
  const lt = c.last;
  if (!lt) return;
  const done = c.cross - 1,
    left = opts.laps - done;
  const fast = Math.min(...cars.filter(o => o.best).map(o => o.best));
  const col = lt <= fast + 1e-6 ? 'p' : lt <= c.best + 0.3 ? 'g' : 'y';
  const st = standings(),
    i = st.indexOf(c);
  const ah = i > 0 ? st[i - 1] : null,
    bh = st[i + 1] && !st[i + 1].out ? st[i + 1] : null;
  const nm = o => (o.name.split(' ').pop() || o.name).slice(0, 3).toUpperCase();
  let d = '';
  if (ah) {
    const g = gapT(ah, c);
    d += `<span><b>P${i} ${nm(ah)}</b>${g !== null ? '+' + g.toFixed(1) : '—'}</span>`;
  }
  if (bh) {
    const g = gapT(c, bh);
    d += `<span><b>P${i + 2} ${nm(bh)}</b>${g !== null ? '−' + g.toFixed(1) : '—'}</span>`;
  }
  const lab = GS.PRACTICE
    ? 'LAP ' + done + (c.best === lt && done > 1 ? ' · NEW BEST' : '')
    : left <= 0
      ? 'FINISH'
      : `LAP ${done}/${opts.laps} · ` + (left === 1 ? 'FINAL LAP' : left + ' LAPS TO GO');
  const el = $('lapc');
  el.innerHTML = `<div class="l">${lab}</div><div class="t ${col}">${fmtS(lt)}</div>${d ? '<div class="d">' + d + '</div>' : ''}`;
  el.classList.remove('hide');
  el.style.animation = 'none';
  void el.offsetWidth;
  el.style.animation = '';
  GS.LAPC_T = 4.5;
}
