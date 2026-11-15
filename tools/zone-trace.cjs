// Speed, auto-brake target and pedals through a stretch of a flying lap (dynamic line, perfect bot).
//   node tools/zone-trace.cjs [--from 1640] [--to 230] [--cfg '{"brkMargin":0.6}'] [--every 12]
'use strict';
const { load } = require('./headless.cjs');
const arg = (k, d) => {
  const i = process.argv.indexOf('--' + k);
  return i < 0 ? d : process.argv[i + 1];
};
const LV = +(i => (i < 0 ? 2 : process.argv[i + 1]))(process.argv.indexOf('--level'));
const H = load({ seed: 1 });
H.ctx.LV = LV;
const cfg = arg('cfg', null);
if (cfg) H.ctx.DYNCFG = JSON.parse(cfg);
H.ctx.__a = +arg('from', 1640);
H.ctx.__b = +arg('to', 230);
H.ctx.__e = +arg('every', 12);
H.run(`opts.pedals=0;opts.steer=0;opts.team=0;opts.rain=0;WX.rain=0;opts.dynlv=LV;trackIdx=1;buildTrack(TRACKS[1]);dynPrepare(true);PRACTICE=true;setupRace(false);var __r=[];
  for(let i=0;i<120*200;i++){const c=cars[ctrl];if(state==='race'&&START.done)input.thr=c.v<c.safeV-0.2;step(STEP);
    const inR=__a<__b?(c.idx>=__a&&c.idx<=__b):(c.idx>=__a||c.idx<=__b);
    if(c.cross>=2&&inR&&i%__e===0)__r.push(String(c.idx).padStart(5)+'  v '+c.v.toFixed(1).padStart(5)+'  safe '+Math.min(999,c.safeV).toFixed(1).padStart(6)+'  '+(input.thr?'GAS':'---')+' '+(c.brk>0?'BRK':'   ')+'  line.v '+DYN.line.v[c.idx].toFixed(1).padStart(5)+'  lat '+c.lat.toFixed(2).padStart(6)+'  line.lat '+DYN.line.lat[c.idx].toFixed(2).padStart(6)+'  '+(cornerAt(c.idx)||''));
    if(c.cross>=3&&!inR)break;}`);
console.log(H.run('__r.join("\\n")'));
