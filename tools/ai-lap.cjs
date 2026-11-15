// An AI car alone on the circuit: how well it drives the line of each Opponents level.
//   node tools/ai-lap.cjs [--track 1] [--team 0] [--diffs 0,1,2] [--rain 0] [--laps 3] [--set 'AI_TUNE.look=2;AI_TUNE.bgain=1.5'] [--neutral]
// --neutral gives the driver average traits (no pace bonus, no wobble) so only the line and the controller are measured.
// Prints the flying lap, time sliding and off the road, and for comparison the line's own lap time.
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

function aiLap(o) {
  o = Object.assign(
    { track: 1, team: 0, diff: 1, rain: 0, laps: 3, set: '', neutral: false, classic: false },
    o,
  );
  const H = load({ seed: 1 });
  H.ctx.__o = o;
  H.run(`opts.pedals=0;opts.steer=0;opts.team=__o.team|0;opts.diff=__o.diff|0;opts.rain=__o.rain|0;WX.rain=opts.rain;opts.damage=0;opts.gears=0;opts.dynlv=0;
    trackIdx=__o.track|0;buildTrack(TRACKS[trackIdx]);
    if(__o.neutral){DRIVER_STATS.length=0;}
    setupRace(true);if(!__o.classic)dynPrepare(true);else dynDrop();      // the menu's demo race: every car is driven by the AI
    var __c=cars.find(c=>c.team===opts.team&&c.drv===0);cars=[__c];ctrl=0;__c.skill=[0.9,0.955,1.0][opts.diff];      // ...and this one has the circuit to itself
    ${o.set || ''};
    var __m={laps:[],cur:null};
    function __tick(){const c=__c,before=c.cross;step(STEP);if(state==='countdown')return;
      if(!__m.cur)__m.cur={slideT:0,offT:0,wall:0,n:0};const m=__m.cur;if(c.slide>0.05)m.slideT+=STEP;if(c.surf>=2||Math.abs(c.lat)>HW+0.45)m.offT+=STEP;
      if(c.cross>before&&c.cross>=2){m.time=c.last;__m.laps.push(m);__m.cur=null;}else if(c.cross>before)__m.cur=null;}`);
  let g = 0;
  while (g++ < 120 * 600 && H.run('__m.laps.length') < o.laps) H.run('__tick()');
  const laps = JSON.parse(H.run('JSON.stringify(__m.laps)')),
    fly = laps.slice(1).length ? laps.slice(1) : laps;
  const avg = k => (fly.length ? fly.reduce((a, l) => a + l[k], 0) / fly.length : NaN);
  return {
    id: H.run('TR.id'),
    time: avg('time'),
    slideT: avg('slideT'),
    offT: avg('offT'),
    line: o.classic ? NaN : H.run('(DYNP[opts.team+":"+(opts.diff+1)]||{line:{}}).line.lapTime'),
    hits: H.run('__c.hits||0'),
  };
}
module.exports = { aiLap };
if (require.main === module) {
  for (const d of String(arg('diffs', '0,1,2')).split(',').map(Number)) {
    const r = aiLap({
      track: +arg('track', 1),
      team: +arg('team', 0),
      diff: d,
      rain: +arg('rain', 0),
      laps: +arg('laps', 3),
      set: arg('set', ''),
      neutral: !!arg('neutral', false),
      classic: !!arg('classic', false),
    });
    console.log(
      `${r.id} team ${arg('team', 0)} ${['Easy', 'Medium', 'Hard'][d]}: lap ${r.time.toFixed(2)} s  slide ${r.slideT.toFixed(2)} s  off ${r.offT.toFixed(2)} s  (line ${(+r.line).toFixed(2)} s)`,
    );
  }
}
