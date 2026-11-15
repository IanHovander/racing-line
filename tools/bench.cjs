// One-button bot benchmark, run headless.
//   node tools/bench.cjs [--level 0..4] [--bot perfect|late0.2|early|jitter0.15|eager1.5|flat] [--laps 4]
//                       [--race] [--diff 1] [--seed 1] [--team 0] [--track 1] [--cfg '{...}'] [--json]
// --level: 0 = the classic fixed line, 1..4 = the dynamic line at Novice / Intermediate / Cautious Expert / Perfect Expert (default 2).
//          (--mode classic is the same as --level 0.)
// The bot only ever presses/releases the gas (Pedals: Throttle only, Steer: Auto), like a player on Space.
//   perfect  : holds gas while below the car's current safe speed, lifts otherwise
//   lateX    : as perfect, but each lift happens X seconds late
//   early    : lifts as soon as it is within 7% of the safe speed
//   jitterX  : reacts late to every change, lift or press, by a random time (half-normal, sigma X seconds): a sloppy human
//   eagerX   : keeps the gas on until X m/s over the safe speed: always overdriving a little
//   flat     : never lifts (worst case)
// "Safe speed" is what the game's auto-brake is using for the player's car: c.safeV on the dynamic line; on the
// classic line the braking envelope of the classic profile (the fastest speed from which braking still makes the corner).
// Without --race it is a solo practice session; with --race it is a full grid at the given difficulty.
'use strict';
const { load } = require('./headless.cjs');
const arg = (k, d) => {
  const i = process.argv.indexOf('--' + k);
  return i < 0
    ? d
    : process.argv[i + 1] === undefined || process.argv[i + 1].startsWith('--')
      ? true
      : process.argv[i + 1];
};

function bench(o) {
  o = Object.assign(
    {
      level: 2,
      bot: 'perfect',
      laps: 4,
      race: false,
      diff: 1,
      seed: 1,
      team: 0,
      track: 1,
      rain: 0,
      maxT: 900,
    },
    o,
  );
  if (o.mode === 'classic') o.level = 0;
  const H = load({ seed: +o.seed });
  H.ctx.__o = o;
  if (o.cfg) H.ctx.DYNCFG = typeof o.cfg === 'string' ? JSON.parse(o.cfg) : o.cfg;
  H.run(`opts.pedals=0;opts.steer=0;opts.team=__o.team|0;opts.diff=__o.diff|0;opts.laps=__o.laps|0;opts.rain=__o.rain|0;WX.rain=opts.rain;opts.damage=0;opts.gears=0;
    opts.dynlv=__o.level|0;
    trackIdx=__o.track|0;buildTrack(TRACKS[trackIdx]);
    dynPrepare(true);   // build the planner's line synchronously
    PRACTICE=!__o.race;setupRace(false);`);
  const m = /^(late|jitter|eager)([\d.]+)$/.exec(o.bot);
  H.ctx.__bot = {
    kind: m ? m[1] : o.bot,
    x: m ? parseFloat(m[2]) : 0,
    t0: -1,
    held: false,
    due: -1,
    want: false,
  };
  H.run(`var __m={laps:[],cur:null};
    // classic line: the bot lifts at the braking envelope of the classic profile, not at the profile itself, which would have it lifting on every straight
    var __env=new Float64Array(N);{const st=TEAM_STATS[opts.team],G=GPROF*st.grip,B=BPROF*st.brk,cap=VCAP*st.top;
      for(let i=0;i<N;i++)__env[i]=Math.min(cap*1.2,Math.sqrt(G/Math.max(rk[i],1e-6)));
      for(let r=0;r<2;r++)for(let i=N-1;i>=0;i--){const j=(i+1)%N;__env[i]=Math.min(__env[i],Math.sqrt(__env[j]*__env[j]+2*Math.max(8,B+9.81*SL[i])*SEG));}}
    function __safe(c){return dynOn(c)?c.safeV:__env[(c.idx+4)%N];}
    function __gauss(){return Math.sqrt(-2*Math.log(1-Math.random()))*Math.cos(6.2831853*Math.random());}
    function __tick(){const c=cars[ctrl];
      if(state==='race'&&START.done&&c&&!c.finished){const b=__bot,s=__safe(c);let hold;
        if(b.kind==='flat')hold=true;else if(b.kind==='early')hold=c.v<s*0.93;else if(b.kind==='eager')hold=c.v<s+b.x;else hold=c.v<s-0.2;
        if(b.kind==='late'){if(hold)b.t0=-1;else{if(b.t0<0)b.t0=raceTime;if(raceTime-b.t0<b.x)hold=true;}}
        if(b.kind==='jitter'){if(hold!==b.want){b.want=hold;b.due=raceTime+Math.abs(__gauss())*b.x;}if(raceTime>=b.due)b.held=b.want;hold=b.held;}
        input.thr=hold;}
      const lapsBefore=c?c.cross:0,h0=c?c.h:0;
      step(STEP);
      if(!c||state==='countdown')return;
      if(!__m.cur)__m.cur={slideT:0,offT:0,wideT:0,wallT:0,jerk:0,n:0,w:0,vmax:0,hold:0};
      const m=__m.cur;const w=wrapA(c.h-h0)/STEP;m.jerk+=Math.abs(w-m.w)/STEP;m.w=w;m.n++;
      if(c.slide>0.05)m.slideT+=STEP;if(c.surf>=2)m.offT+=STEP;if(Math.abs(c.lat)>HW+0.45)m.wideT+=STEP;if(Math.abs(c.lat)>=(c.lat>0?BARR:BARL)[c.idx]-0.02)m.wallT+=STEP;if(c.v>m.vmax)m.vmax=c.v;if(input.thr)m.hold+=STEP;
      if(c.cross>lapsBefore&&c.cross>=2){m.time=c.last;m.jerk/=m.n;__m.laps.push(m);__m.cur=null;}
      else if(c.cross>lapsBefore)__m.cur=null;   // crossing the line off the grid: start measuring lap 1 here
    }`);
  const t0 = Date.now();
  let guard = 0;
  while (guard++ < o.maxT * 120) {
    H.run('__tick()');
    if (
      H.run('state') === 'finished' ||
      H.run('__m.laps.length') >= o.laps ||
      H.run('!!(cars[ctrl]&&(cars[ctrl].finished||cars[ctrl].out))')
    )
      break;
  }
  const laps = JSON.parse(H.run('JSON.stringify(__m.laps)'));
  const res = {
    level: o.level,
    bot: o.bot,
    race: !!o.race,
    laps: laps.map(l => ({
      time: +l.time.toFixed(3),
      slideT: +l.slideT.toFixed(2),
      offT: +l.offT.toFixed(2),
      wideT: +l.wideT.toFixed(2),
      wallT: +l.wallT.toFixed(2),
      jerk: +l.jerk.toFixed(2),
      vmax: +l.vmax.toFixed(1),
      holdPct: Math.round((100 * l.hold) / l.time),
    })),
  };
  const fly = res.laps.slice(1).length ? res.laps.slice(1) : res.laps; // lap 1 is from a standing start
  const avg = k => (fly.length ? +(fly.reduce((a, l) => a + l[k], 0) / fly.length).toFixed(3) : null);
  res.flying = {
    n: fly.length,
    time: avg('time'),
    best: fly.length ? Math.min(...fly.map(l => l.time)) : null,
    worst: fly.length ? Math.max(...fly.map(l => l.time)) : null,
    slideT: avg('slideT'),
    offT: avg('offT'),
    wideT: avg('wideT'),
    wallT: avg('wallT'),
    jerk: avg('jerk'),
  };
  if (o.race)
    res.raceStats = JSON.parse(
      H.run(
        `JSON.stringify({hits:HITS,myHits:cars[ctrl].hits||0,pass:(cars[ctrl].stat||{}).pass||0,lost:(cars[ctrl].stat||{}).lost||0,place:standings().indexOf(cars[ctrl])+1,of:cars.length,out:!!cars[ctrl].out,time:+raceTime.toFixed(2),ai:cars.filter(c=>c!==cars[ctrl]).map(c=>({best:+(c.best||0).toFixed(2),off:+(((c.stat||{}).offT)||0).toFixed(1),hits:c.hits||0,out:!!c.out,laps:Math.max(0,c.cross-1),ghosts:c.ghosts||0}))})`,
      ),
    );
  const ds = H.run('typeof DYNSTAT==="object"&&DYNSTAT?JSON.stringify(DYNSTAT):""');
  if (ds) res.planner = JSON.parse(ds);
  if (o.level) res.model = H.run('DYN.line.lapTime');
  res.wallMs = Date.now() - t0;
  return res;
}
module.exports = { bench };

if (require.main === module) {
  const o = {
    level: +arg('level', 2),
    mode: arg('mode', ''),
    bot: arg('bot', 'perfect'),
    laps: +arg('laps', 4),
    race: !!arg('race', false),
    diff: +arg('diff', 1),
    seed: +arg('seed', 1),
    team: +arg('team', 0),
    track: +arg('track', 1),
    rain: +arg('rain', 0),
    cfg: arg('cfg', '') || null,
  };
  const r = bench(o);
  if (arg('json', false)) console.log(JSON.stringify(r));
  else {
    console.log(`level ${r.level} / ${r.bot}${r.race ? ' / race' : ' / solo'}`);
    r.laps.forEach((l, i) =>
      console.log(
        `  lap ${i + 1}: ${l.time.toFixed(3)} s  slide ${l.slideT}s  off ${l.offT}s  jerk ${l.jerk}  vmax ${l.vmax}  gas ${l.holdPct}%`,
      ),
    );
    console.log('  flying avg:', JSON.stringify(r.flying));
    if (r.raceStats) console.log('  race:', JSON.stringify(r.raceStats));
    if (r.planner) console.log('  planner:', JSON.stringify(r.planner));
    console.log(`  (${r.wallMs} ms wall)`);
  }
}
