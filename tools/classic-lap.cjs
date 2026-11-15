// The Classic line (a fixed line followed by pure pursuit, no planner) driven by the one-button bot.
//   node tools/classic-lap.cjs [--tracks 1,3,6,7] [--team 0] [--rain 0] [--set 'CLASSIC.level=3;CLASSIC.care=1']
// --set runs game-side code before the lines are prepared: CLASSIC.level = 0 keeps the old elastic-band line.
// The bot lifts at the braking envelope of the classic profile (the fastest speed from which braking still makes the corner).
'use strict';
const { load } = require('./headless.cjs');
const arg = (k, d) => {
  const i = process.argv.indexOf('--' + k);
  return i < 0 ? d : process.argv[i + 1];
};
const out = [];
for (const T of String(arg('tracks', '1,3,6,7')).split(',').map(Number)) {
  const H = load({ seed: 1 });
  H.ctx.A = [T, +arg('team', 0), +arg('rain', 0)];
  H.run(`${arg('set', '')};opts.pedals=0;opts.steer=0;opts.team=A[1];opts.rain=A[2];WX.rain=A[2];opts.damage=0;opts.dynlv=0;
    trackIdx=A[0];buildTrack(TRACKS[A[0]]);dynPrepare(true);PRACTICE=true;setupRace(false);
    var __env=new Float64Array(N);{const st=TEAM_STATS[opts.team],G=GPROF*WETG()*st.grip,B=BPROF*WETB()*st.brk,cap=VCAP*st.top;
      for(let i=0;i<N;i++)__env[i]=Math.min(cap*1.2,Math.sqrt(G/Math.max(rk[i],1e-6)));
      for(let r=0;r<2;r++)for(let i=N-1;i>=0;i--){const j=(i+1)%N;__env[i]=Math.min(__env[i],Math.sqrt(__env[j]*__env[j]+2*Math.max(8,B+9.81*SL[i])*SEG));}}
    var __r={off:0,sl:0,laps:[]};
    function __tick(){const c=cars[ctrl],b=c.cross;if(state==='race'&&START.done)input.thr=c.v<__env[(c.idx+4)%N]-0.2;step(STEP);
      if(c.cross>=2&&state==='race'){if(Math.abs(c.lat)>HW+0.45)__r.off+=STEP;if(c.slide>0.05)__r.sl+=STEP;}
      if(c.cross>b&&c.cross>=2)__r.laps.push(c.last);}`);
  let g = 0;
  while (g++ < 120 * 400 && H.run('__r.laps.length') < 3) H.run('__tick()');
  const r = JSON.parse(H.run('JSON.stringify(__r)'));
  out.push(
    `${H.run('TR.id')} ${Math.min(...r.laps.slice(1)).toFixed(2)} s (slide ${(r.sl / 2).toFixed(1)}, off ${(r.off / 2).toFixed(1)})`,
  );
}
console.log(out.join('  |  '));
