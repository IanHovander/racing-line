// Is the approach to a corner better right at the outside limit? Takes a freshly built line, pushes it to the outside limit some way
// before one corner's apex (with a penalty in the search), then lets the search run free again, and compares lap times.
//   node tools/line-pin.cjs [--track 1] [--team 0] [--level 3] [--corner 1] [--before 150] [--cfg {"levels":[106,212,424,848]}]
'use strict';
const { load } = require('./headless.cjs');
const arg = (k, d) => {
  const i = process.argv.indexOf('--' + k);
  return i < 0 ? d : process.argv[i + 1];
};
const H = load({ seed: 1 });
H.ctx.A = [+arg('track', 1), +arg('team', 0), +arg('level', 3), +arg('corner', 1), +arg('before', 150)];
H.ctx.CF = JSON.parse(arg('cfg', '{"levels":[106,212,424,848]}'));
console.log(
  JSON.parse(
    H.run(`(()=>{const [T,tm,lv,cn,bef]=A;opts.team=tm;opts.dynlv=lv;opts.rain=0;WX.rain=0;trackIdx=T;buildTrack(TRACKS[T]);
  globalThis.DYNCFG=CF;const D=dynMake(tm,lv);globalThis.DYNCFG=undefined;D.build(Infinity);
  const lim=HW-D.cfg.edge,X=dynMake(tm,lv),q=Float64Array.from(D.line.lat),t=new Float64Array(N),out=[];
  const ak=i=>Math.abs(D.line.kap[(i%N+N)%N]);let ap=-1;for(let i=0;i<N;i++){if(cornerAt(i)!=="T"+cn)continue;if(ap<0||ak(i)>ak(ap))ap=i;}      // the tightest point of that corner
  const o=-Math.sign(D.line.kap[ap]),pin=((ap-Math.round(bef/SEG))%N+N)%N;let W8=0;
  const gapAt=a=>lim-o*a[pin],lap=a=>{X.setLine(a);return X.line.lapTime;},obj=a=>lap(a)+W8*gapAt(a)*gapAt(a);
  const run=(passes)=>{let best=obj(q);for(let p=0;p<passes;p++){let g=0;for(const w of [320,160,80,40,20,10])for(let c=0;c<N;c+=Math.max(2,w>>2))for(const amp of [1.5,-1.5,0.5,-0.5,0.15,-0.15,0.05,-0.05]){
      t.set(q);for(let d=-w;d<=w;d++){const i=((c+d)%N+N)%N;let v=q[i]+amp*0.5*(1+Math.cos(Math.PI*d/w));t[i]=v>lim?lim:v<-lim?-lim:v;}
      const L=obj(t);if(L<best-1e-6){g+=best-L;best=L;q.set(t);}}if(g<0.002)break;}};
  out.push(TR.id+" "+D.name+", T"+cn+" ("+(o>0?"outside is the left":"outside is the right")+"), looking "+bef+" m before the apex");
  out.push("  as built:                 lap "+lap(q).toFixed(3)+" s, "+gapAt(q).toFixed(2)+" m inside the outside limit there");
  W8=0.3;run(4);out.push("  pushed to the limit:      lap "+lap(q).toFixed(3)+" s, "+gapAt(q).toFixed(2)+" m inside");
  W8=0;run(5);out.push("  then left free again:     lap "+lap(q).toFixed(3)+" s, "+gapAt(q).toFixed(2)+" m inside");
  return JSON.stringify(out);})()`),
  ).join(String.fromCharCode(10)),
);
