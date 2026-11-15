// Checks on the planner against the real track geometry (headless).
//   node tools/test-dynline.cjs [--level 2] [--track 1] [--team 0] [--rain 0]
'use strict';
const { load } = require('./headless.cjs');
const LV = +(i => (i < 0 ? 2 : process.argv[i + 1]))(process.argv.indexOf('--level'));
const A = (k, d) => {
  const i = process.argv.indexOf('--' + k);
  return i < 0 ? d : +process.argv[i + 1];
};
const H = load({ seed: 1 });
H.ctx.LV = LV;
H.ctx.TK = A('track', 1);
H.ctx.TM = A('team', 0);
H.ctx.RN = A('rain', 0);
H.run('opts.team=TM;opts.dynlv=LV;opts.rain=RN;WX.rain=RN;trackIdx=TK;buildTrack(TRACKS[TK]);');
const t0 = Date.now();
H.run('dynPrepare(true)');
const buildWall = Date.now() - t0;
const g = n => H.run(n);
const N = g('N'),
  lim = g('HW') - g('DYN.cfg.edge');
const line = g('DYN.line'),
  stats = g('DYN.stats');
let fails = 0;
const ok = (c, m) => {
  console.log((c ? '  ok   ' : '  FAIL ') + m);
  if (!c) fails++;
};

console.log('build');
console.log(
  `  build ${buildWall} ms wall (${stats.buildMs.toFixed(0)} ms inside)   model lap: optimal ${line.lapTime.toFixed(3)} s  classic line ${line.refTime.toFixed(3)} s`,
);
ok(line.lapTime < line.refTime, 'optimal line beats the classic line in the lap model');
let mx = 0;
for (let i = 0; i < N; i++) mx = Math.max(mx, Math.abs(line.lat[i]));
ok(mx <= lim + 1e-6, `line stays within ±${lim.toFixed(1)} m (max ${mx.toFixed(2)})`);

// analytic curvature of the optimal line vs curvature measured on its world polyline
{
  const cx = g('cx'),
    cy = g('cy'),
    nx = g('nx'),
    ny = g('ny');
  const GR = g('GRIP*TEAM_STATS[opts.team].grip*WETG()');
  const P = i => {
    i = ((i % N) + N) % N;
    return [cx[i] + nx[i] * line.lat[i], cy[i] + ny[i] * line.lat[i]];
  };
  let worst = 0,
    sum = 0;
  const overs = [];
  // grip-limited speed from the measured curvature must not be below the planner's profile by much
  for (let i = 0; i < N; i++) {
    const a = P(i - 2),
      b = P(i),
      c = P(i + 2);
    const cr = (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
    const d =
      Math.hypot(b[0] - a[0], b[1] - a[1]) *
      Math.hypot(c[0] - b[0], c[1] - b[1]) *
      Math.hypot(c[0] - a[0], c[1] - a[1]);
    const k = Math.abs((2 * cr) / Math.max(d, 1e-9)),
      vg = Math.sqrt(GR / Math.max(k, 1e-6));
    const over = line.v[i] / vg - 1;
    if (over > worst) worst = over;
    sum += Math.max(0, over);
    overs.push(over);
  }
  // (the curvature measured over ±4 m of polyline is itself only good to a few percent)
  const tol = 0.04 + (g('DYN.cfg.gripMargin') > 0.96 ? 0.02 : 0);
  // a centreline sample that sits a few millimetres out of line (or a kink a few metres long, on the street circuits) spoils the measurement at one or two
  // samples; the car is past it in a few hundredths of a second. So: no more than two samples over the tolerance.
  const nOver = overs.filter(o => o >= tol).length;
  ok(
    nOver <= 2,
    `profile speed stays within ${(100 * tol).toFixed(0)}% of the true grip limit of the drawn line (${nOver} of ${N} samples over, worst ${(100 * worst).toFixed(1)}%)`,
  );
}

// plans from odd states
console.log('plans from odd states');
H.run('PRACTICE=true;setupRace(false);');
{
  let bad = 0,
    cnt = 0,
    worstMs = 0,
    tangentErr = 0,
    infeas = 0,
    tangentAt = '';
  for (const frac of [0.02, 0.11, 0.23, 0.37, 0.5, 0.64, 0.78, 0.9])
    for (const lt of [-lim, 0, lim])
      for (const dh of [-0.15, 0, 0.15])
        for (const v of [20, 50, 85]) {
          H.ctx.__s = { i: Math.floor(frac * N), lt, dh, v };
          const r = JSON.parse(
            H.run(`(function(){const c=cars[ctrl],i=__s.i;c.x=cx[i]+nx[i]*__s.lt;c.y=cy[i]+ny[i]*__s.lt;c.h=Math.atan2(ty[i],tx[i])+__s.dh;c.v=__s.v;c.idx=i;locate(c);DYN.reset();
      const t=performance.now();const u=DYN.control(c,[],{attack:true},1/120);const ms=performance.now()-t;const p=DYN.cur;let fin=isFinite(u.k)&&isFinite(u.safe),mxl=0;
      for(let k=0;k<p.n;k++){if(!isFinite(p.lat[k])||!isFinite(p.v[k]))fin=false;if(k>40)mxl=Math.max(mxl,Math.abs(p.lat[k]));}
      // slope of the plan at the car vs the car's heading
      const a=p.i0,b=(p.i0+1)%N,sl=wrapA(Math.atan2(cy[b]+ny[b]*p.lat[1]-cy[a]-ny[a]*p.lat[0],cx[b]+nx[b]*p.lat[1]-cx[a]-nx[a]*p.lat[0])-c.h);      // heading of the plan's first 2 m on the ground, against the car's
      return JSON.stringify({fin,mxl,ms,sl,feas:p.feasible,k:u.k});})()`),
          );
          cnt++;
          worstMs = Math.max(worstMs, r.ms);
          // a state the tyres cannot save (e.g. 85 m/s at the edge of the road just before a corner) may run wide: only drivable plans must stay in
          if (!r.fin || (r.feas && r.mxl > H.run('HW') + 0.45 + 1e-6)) {
            bad++;
            if (bad < 6) console.log('    bad', H.ctx.__s, r);
          }
          if (!r.feas) infeas++;
          if (Math.abs(r.sl) > tangentErr) {
            tangentErr = Math.abs(r.sl);
            tangentAt =
              JSON.stringify(H.ctx.__s) + ' k ' + r.k.toFixed(3) + (r.feas ? '' : ' (beyond saving)');
          }
        }
  ok(
    bad === 0,
    `${cnt} odd states give finite plans; the ${cnt - infeas} drivable ones are back inside the road after 80 m (${infeas} are beyond saving)`,
  );
  ok(
    tangentErr < 0.1,
    `plans leave the car tangentially (worst heading mismatch ${tangentErr.toFixed(3)} rad, measured over the first 2 m, at ${tangentAt})`,
  );
  console.log(`  worst single plan from a cold start: ${worstMs.toFixed(2)} ms`);
}
console.log(fails ? `${fails} FAILED` : 'all passed');
process.exit(fails ? 1 : 0);
