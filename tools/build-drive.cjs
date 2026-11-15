// Builds a line fresh with the current builder (optionally with other builder settings) and drives it with the one-button bot.
//   node tools/build-drive.cjs [--track 1] [--team 0] [--level 3] [--rain 0] [--cfg {"levels":[106,212,424,848]}] [--stored]
// --stored drives the line stored in public/dynlines.json instead (for comparison). Prints the lap model's time and the driven lap.
'use strict';
const { load } = require('./headless.cjs');
const arg = (k, d) => {
  const i = process.argv.indexOf('--' + k);
  return i < 0 ? d : process.argv[i + 1];
};
const H = load({ seed: 1 });
H.ctx.A = [+arg('track', 1), +arg('team', 0), +arg('level', 3), +arg('rain', 0)];
H.ctx.CF = JSON.parse(arg('cfg', '{}'));
H.ctx.ST = process.argv.includes('--stored');
const t0 = Date.now();
console.log(
  H.run(`(()=>{const [T,tm,lv,rn]=A;opts.team=tm;opts.dynlv=lv;opts.rain=rn;WX.rain=rn;opts.pedals=0;opts.steer=0;opts.damage=0;trackIdx=T;buildTrack(TRACKS[T]);dynPrepare(true);
  let model=DYN.line.lapTime;
  if(!ST){globalThis.DYNCFG=CF;const D=dynMake(tm,lv);globalThis.DYNCFG=undefined;D.build(Infinity);model=D.line.lapTime;DYN.setLine(Float64Array.from(D.line.lat));}
  PRACTICE=true;setupRace(false);const c=cars[ctrl];let off=0,sl=0,laps=[],g=0;
  while(laps.length<3&&g++<120*400){if(state==="race"&&START.done)input.thr=c.v<c.safeV-0.2;const b=c.cross;step(STEP);if(c.cross>=2&&state==="race"){if(Math.abs(c.lat)>HW+0.45)off+=STEP;if(c.slide>0.05)sl+=STEP;}if(c.cross>b&&c.cross>=2)laps.push(c.last);}
  return TR.id+" "+DYN.name+(ST?" stored":" built "+JSON.stringify(CF))+": model "+model.toFixed(3)+" s, driven "+Math.min(...laps.slice(1)).toFixed(3)+" s, beyond the edge "+(off/2).toFixed(2)+" s/lap, sliding "+(sl/2).toFixed(2)+" s/lap";})()`),
  ((Date.now() - t0) / 1000).toFixed(0) + ' s',
);
