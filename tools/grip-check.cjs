// Where does a line's speed profile ask for more grip than the line drawn on the ground has? Compares the planner's speed at every
// sample with the grip-limited speed from the curvature measured on the world polyline of the line (chords over +-4 m and +-8 m).
//   node tools/grip-check.cjs [--track 3] [--team 2] [--level 3] [--rain 0] [--top 8]
'use strict';
const { load } = require('./headless.cjs');
const arg = (k, d) => {
  const i = process.argv.indexOf('--' + k);
  return i < 0 ? d : +process.argv[i + 1];
};
const H = load({ seed: 1 });
H.ctx.A = [arg('track', 3), arg('team', 2), arg('level', 3), arg('rain', 0)];
H.run(
  '(()=>{const [T,tm,lv,rn]=A;opts.team=tm;opts.dynlv=lv;opts.rain=rn;WX.rain=rn;trackIdx=T;buildTrack(TRACKS[T]);dynPrepare(true);})()',
);
const g = n => H.run(n),
  N = g('N'),
  cx = g('cx'),
  cy = g('cy'),
  nx = g('nx'),
  ny = g('ny'),
  line = g('DYN.line'),
  GR = g('GRIP*TEAM_STATS[opts.team].grip*WETG()*DYN.cfg.gripMargin'),
  cc = g('ccurv');
const P = i => {
  i = ((i % N) + N) % N;
  return [cx[i] + nx[i] * line.lat[i], cy[i] + ny[i] * line.lat[i]];
};
const K = (i, w) => {
  const a = P(i - w),
    b = P(i),
    c = P(i + w);
  const cr = (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
  const d =
    Math.hypot(b[0] - a[0], b[1] - a[1]) *
    Math.hypot(c[0] - b[0], c[1] - b[1]) *
    Math.hypot(c[0] - a[0], c[1] - a[1]);
  return Math.abs((2 * cr) / Math.max(d, 1e-9));
};
const rows = [];
let n4 = 0,
  n8 = 0;
for (let i = 0; i < N; i++) {
  const o4 = line.v[i] / Math.sqrt(GR / Math.max(K(i, 2), 1e-6)) - 1,
    o8 = line.v[i] / Math.sqrt(GR / Math.max(K(i, 4), 1e-6)) - 1;
  if (o4 > 0.05) n4++;
  if (o8 > 0.05) n8++;
  rows.push([i, o4, o8]);
}
rows.sort((a, b) => b[2] - a[2]);
console.log(
  `${g('TR.id')} ${g('DYN.name')}: samples where the line's speed is over 5% above the level's grip on the drawn line: ${n4} (chords +-4 m), ${n8} (chords +-8 m) of ${N}`,
);
for (const r of rows.slice(0, arg('top', 8))) {
  const i = r[0];
  console.log(
    `  i ${i}  ${g('cornerAt(' + i + ')') || '-'}  v ${(line.v[i] * 3.6).toFixed(0)} km/h  over ${(r[1] * 100).toFixed(0)}% (4 m) ${(r[2] * 100).toFixed(0)}% (8 m)  radius: drawn ${(1 / K(i, 2)).toFixed(0)} / ${(1 / K(i, 4)).toFixed(0)} m, planner ${(1 / Math.abs(line.kap[i])).toFixed(0)} m, centreline ${(1 / Math.abs(cc[i])).toFixed(0)} m, lat ${line.lat[i].toFixed(2)}`,
  );
}
