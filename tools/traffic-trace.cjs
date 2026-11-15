// Timeline of a race for the one-button bot on the dynamic line: what is ahead, what the plan is doing.
//   node tools/traffic-trace.cjs --seed 2 [--from 20] [--to 80] [--every 0.5] [--cfg '{...}']
'use strict';
const { load } = require('./headless.cjs');
const arg = (k, d) => {
  const i = process.argv.indexOf('--' + k);
  return i < 0 ? d : process.argv[i + 1];
};
const LV = +arg('level', 2);
const H = load({ seed: +arg('seed', 2) });
H.ctx.LV = LV;
const cfg = arg('cfg', null);
if (cfg) H.ctx.DYNCFG = JSON.parse(cfg);
const from = +arg('from', 8),
  to = +arg('to', 70),
  every = +arg('every', 0.5);
H.run(`opts.steer=0;opts.team=0;opts.diff=1;opts.laps=5;opts.rain=0;WX.rain=0;opts.damage=0;opts.gears=0;opts.dynlv=LV;trackIdx=1;buildTrack(TRACKS[1]);dynPrepare(true);PRACTICE=false;setupRace(false);
  var __rows=[],__hits=0;
  function __tick(){const c=cars[ctrl];if(state==='race'&&START.done){input.thr=c.v<c.safeV-0.2;}
    step(STEP);if(state!=='race')return raceTime;
    if((c.hits||0)>__hits){__hits=c.hits;__rows.push('   *** contact at '+raceTime.toFixed(2)+' idx '+c.idx+' '+cornerAt(c.idx));}
    if(raceTime>=${from}&&Math.round(raceTime*120)%${Math.round(every * 120)}===0){
      let best=null,bd=1e9;for(const o of cars){if(o===c||o.gone)continue;let d=o.s-c.s;if(d<-L/2)d+=L;else if(d>L/2)d-=L;if(d>0&&d<bd){bd=d;best=o;}}
      const g=DYN.debug(),ah=dynAheadCap(c);
      __rows.push([raceTime.toFixed(1),'P'+(standings().indexOf(c)+1),'i'+c.idx,(cornerAt(c.idx)||'-').padEnd(3),'v'+c.v.toFixed(0),'safe'+Math.min(999,c.safeV).toFixed(0),input.thr?'GAS':'---',c.brk>0?'BRK':'   ','lat'+c.lat.toFixed(1),
        best?('ahead '+bd.toFixed(0)+'m v'+best.v.toFixed(0)+' lat'+best.lat.toFixed(1)):'clear',ah<900?'cap'+ah.toFixed(0):'      ',g.isPass?('PASS'+(g.side>0?'+':'-')):g.kind?'lane ':(g.gT?'lean ':'merge'),g.feasible?'':'INFEAS','cars'+g.cars].join(' '));}
    return raceTime;}`);
let g = 0;
while (g++ < 120 * 400 && H.run('__tick()') < to) {}
console.log(H.run('__rows.join("\\n")'));
