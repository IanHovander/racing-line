// Is a built line really the best the lap model can find? Tries smooth sideways bumps of many widths on top of the stored line
// (moves the builder's one-control-point-at-a-time search cannot make) and reports how much lap time they gain.
//   node tools/line-improve.cjs [--track 1] [--team 0] [--level 3] [--rain 0] [--passes 4]
'use strict';
const { load } = require('./headless.cjs');
const arg = (k, d) => {
  const i = process.argv.indexOf('--' + k);
  return i < 0 ? d : +process.argv[i + 1];
};
const H = load({ seed: 1 });
H.ctx.A = [arg('track', 1), arg('team', 0), arg('level', 3), arg('rain', 0), arg('passes', 4)];
{
  const i = process.argv.indexOf('--fresh');
  H.ctx.FRESH = i < 0 ? null : JSON.parse(process.argv[i + 1]);
} // --fresh '{...}': build the line now with these builder settings instead of using the stored one
console.log(
  H.run(`(()=>{const [T,tm,lv,rn,passes]=A;opts.team=tm;opts.dynlv=lv;opts.rain=rn;WX.rain=rn;trackIdx=T;buildTrack(TRACKS[T]);dynPrepare(true);
  if(FRESH){globalThis.DYNCFG=FRESH;const D=dynMake(tm,lv);globalThis.DYNCFG=undefined;D.build(Infinity);DYN.setLine(Float64Array.from(D.line.lat));}
  const lim=HW-DYN.cfg.edge,X=dynMake(tm,lv),q=Float64Array.from(DYN.line.lat),t=new Float64Array(N);
  const lap=a=>{X.setLine(a);return X.line.lapTime;};
  let best=lap(q);const t0=best,log=[];
  for(let p=0;p<passes;p++){let gained=0;
    for(const w of [320,160,80,40,20,10])for(let c=0;c<N;c+=Math.max(2,w>>2))for(const amp of [1.5,-1.5,0.5,-0.5,0.15,-0.15,0.05,-0.05]){
      t.set(q);for(let d=-w;d<=w;d++){const i=((c+d)%N+N)%N;let v=q[i]+amp*0.5*(1+Math.cos(Math.PI*d/w));t[i]=v>lim?lim:v<-lim?-lim:v;}
      const L=lap(t);if(L<best-1e-6){gained+=best-L;best=L;q.set(t);}}
    log.push('pass '+(p+1)+': '+best.toFixed(3)+' s (gained '+gained.toFixed(3)+')');if(gained<0.002)break;}
  const drive=()=>{opts.pedals=0;opts.steer=0;opts.damage=0;PRACTICE=true;setupRace(false);const c=cars[ctrl];let off=0,sl=0,laps=[],g=0;
    while(laps.length<3&&g++<120*400){if(state==='race'&&START.done)input.thr=c.v<c.safeV-0.2;const b=c.cross;step(STEP);if(c.cross>=2&&state==='race'){if(Math.abs(c.lat)>HW+0.45)off+=STEP;if(c.slide>0.05)sl+=STEP;}if(c.cross>b&&c.cross>=2)laps.push(c.last);}
    return 'driven '+Math.min(...laps.slice(1)).toFixed(2)+' s (beyond the edge '+(off/2).toFixed(2)+' s/lap, sliding '+(sl/2).toFixed(1)+' s/lap)';};
  const shape=a=>{const ak=i=>Math.abs(DYN.line.kap[(i%N+N)%N]);let r=[];for(let i=0;i<N;i++){if(ak(i)<1/60)continue;let pk=true;for(let d=-25;d<=25;d++)if(ak(i+d)>ak(i))pk=false;if(!pk)continue;const o=-Math.sign(DYN.line.kap[i]);let w=1e9;for(let d=-120;d<0;d++)w=Math.min(w,lim-o*a[((i+d)%N+N)%N]);r.push((cornerAt(i)||'-')+' '+w.toFixed(1));}return r.join('  ');};
  const before=drive(),sh0=shape(DYN.line.lat);DYN.setLine(q);const sh1=shape(DYN.line.lat),after=drive();
  return TR.id+' '+DYN.name+': stored line '+t0.toFixed(3)+' s -> '+best.toFixed(3)+' s with smooth bumps  ['+log.join('; ')+']'+String.fromCharCode(10)+'  stored line: '+before+String.fromCharCode(10)+'  improved line: '+after+String.fromCharCode(10)+'  closest approach to the outside limit before each tight corner (m), stored:   '+sh0+String.fromCharCode(10)+'  improved: '+sh1;})()`),
);
