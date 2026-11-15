// Lists every off-track excursion on a flying lap for a bot, and can print the seconds around one of them.
//   node tools/trace.cjs --bot late0.3 [--level 2] [--track 1] [--team 0] [--rain 0] [--cfg '{...}'] [--detail N]
'use strict';
const { load } = require('./headless.cjs');
const arg = (k, d) => {
  const i = process.argv.indexOf('--' + k);
  return i < 0 ? d : process.argv[i + 1];
};
const bot = arg('bot', 'late0.3'),
  m = /^(late|eager)([\d.]+)$/.exec(bot),
  detail = +arg('detail', -1),
  LV = +arg('level', 2);
const H = load({ seed: 1 });
H.ctx.LV = LV;
H.ctx.TK = +arg('track', 1);
H.ctx.TM = +arg('team', 0);
H.ctx.RN = +arg('rain', 0);
const cfg = arg('cfg', null);
if (cfg) H.ctx.DYNCFG = JSON.parse(cfg);
H.ctx.__b = { kind: m ? m[1] : bot, x: m ? parseFloat(m[2]) : 0, w: -1 };
H.ctx.__detail = detail;
H.run(`opts.pedals=0;opts.steer=0;opts.team=TM;opts.rain=RN;WX.rain=RN;opts.damage=0;opts.gears=0;opts.dynlv=LV;trackIdx=TK;buildTrack(TRACKS[TK]);dynPrepare(true);PRACTICE=true;setupRace(false);
  var __ev=[],__cur=null,__rows=[],__buf=[];
  function __row(c){const g=DYN.debug(),p=DYN.cur;return [raceTime.toFixed(2),c.idx,cornerAt(c.idx)||'-','lat '+c.lat.toFixed(2),'v '+c.v.toFixed(1),'safe '+Math.min(999,c.safeV).toFixed(1),input.thr?'GAS':'---',c.brk>0?'BRK':'   ','surf'+c.surf,p.feasible?'ok ':'XX ','slide '+(c.slide||0).toFixed(2),g.kind?'lane':g.gT?('lean'+(g.gT*Math.sign(DYN.debug().tOff||1)).toFixed(1)):'merge','plan+20m '+p.lat[10].toFixed(1),'+60m '+p.lat[30].toFixed(1)].join('  ');}
  function __tick(){const c=cars[ctrl],b=__b;if(state==='race'&&START.done){const s=c.safeV;let hold=b.kind==='flat'?true:b.kind==='eager'?c.v<s+b.x:c.v<s-0.2;if(b.kind==='late'){if(hold)b.w=-1;else{if(b.w<0)b.w=raceTime;if(raceTime-b.w<b.x)hold=true;}}input.thr=hold;}
    step(STEP);if(state!=='race'||c.cross<2)return c.cross;
    const off=c.surf>=2||Math.abs(c.lat)>HW+0.45,tick=Math.round(raceTime*120)%12===0;
    if(tick&&!__cur){__buf.push(__row(c));if(__buf.length>22)__buf.shift();}
    if(off&&!__cur){__cur={n:__ev.length,idx:c.idx,T:cornerAt(c.idx)||('->T'+((nextCorner(c.idx)||{}).n||'?')),t0:raceTime,v0:c.v,maxLat:0,minV:c.v,slide:0};if(__detail===__cur.n)__rows=__buf.slice();}
    if(__cur){__cur.maxLat=Math.max(__cur.maxLat,Math.abs(c.lat));__cur.minV=Math.min(__cur.minV,c.v);if(c.slide>0.05)__cur.slide+=STEP;
      if(__detail===__cur.n&&tick)__rows.push(__row(c)+'  <-- off');
      if(!off&&Math.abs(c.lat)<HW){__cur.dur=raceTime-__cur.t0;__cur.v1=c.v;__ev.push(__cur);__cur=null;__buf=[];}}
    return c.cross;}`);
let g = 0;
while (g++ < 120 * 400 && H.run('__tick()') < 3) {}
const ev = JSON.parse(H.run('JSON.stringify(__ev)'));
console.log(`level ${LV} ${bot}: lap ${H.run('cars[ctrl].last').toFixed(3)} s, ${ev.length} excursions`);
for (const e of ev)
  console.log(
    `  #${e.n} ${String(e.T).padEnd(6)} idx ${e.idx}  ${e.dur.toFixed(2)} s  entry ${e.v0.toFixed(0)} m/s  min ${e.minV.toFixed(0)}  exit ${e.v1.toFixed(0)}  max|lat| ${e.maxLat.toFixed(1)}  slide ${e.slide.toFixed(2)} s`,
  );
if (detail >= 0) for (const r of H.run('__rows')) console.log('   ' + r);
