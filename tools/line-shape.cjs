// Where a line sits across the road on the way into each corner: does it use the outside edge before turning in?
//   node tools/line-shape.cjs [--track 1] [--team 0] [--level 3] [--rain 0]
// For every corner (a peak of the line's own curvature) it prints the side of the turn, the car's distance from the OUTSIDE limit of the
// line (0 = right at the limit the level allows) at 200 / 120 / 60 m before the apex and at its widest point, and the same at the exit.
'use strict';
const { load } = require('./headless.cjs');
const arg = (k, d) => {
  const i = process.argv.indexOf('--' + k);
  return i < 0 ? d : +process.argv[i + 1];
};
const H = load({ seed: 1 });
H.ctx.A = [arg('track', 1), arg('team', 0), arg('level', 3), arg('rain', 0)];
console.log(
  JSON.parse(
    H.run(`(()=>{const [T,tm,lv,rn]=A;opts.team=tm;opts.dynlv=lv;opts.rain=rn;WX.rain=rn;trackIdx=T;buildTrack(TRACKS[T]);dynPrepare(true);
  const ln=DYN.line,lim=HW-DYN.cfg.edge,out=[TR.id+' '+DYN.name+'  lap '+ln.lapTime.toFixed(3)+' s   (limit '+lim.toFixed(1)+' m from the centre; numbers are metres inside the outside limit)'];
  const ak=i=>Math.abs(ln.kap[(i%N+N)%N]);
  for(let i=0;i<N;i++){if(ak(i)<1/150)continue;let pk=true;for(let d=-25;d<=25;d++)if(ak(i+d)>ak(i))pk=false;if(!pk)continue;
    const sg=Math.sign(ln.kap[i]),o=-sg;      // outside of the turn: right (negative lat) for a left turn
    const gap=d=>lim-o*ln.lat[((i+d)%N+N)%N];
    let wIn=1e9,wInD=0;for(let d=-120;d<0;d++){const g=gap(d);if(g<wIn){wIn=g;wInD=d;}}
    let wOut=1e9,wOutD=0;for(let d=1;d<=120;d++){const g=gap(d);if(g<wOut){wOut=g;wOutD=d;}}
    out.push('  '+(cornerAt(i)||'-').padEnd(4)+(sg>0?'left ':'right')+' R'+(1/ak(i)).toFixed(0).padStart(4)+' m  v '+(ln.v[i]*3.6|0).toString().padStart(3)+' km/h | before: 200m '+gap(-100).toFixed(1)+'  120m '+gap(-60).toFixed(1)+'  60m '+gap(-30).toFixed(1)+'  widest '+wIn.toFixed(1)+' at '+(-wInD*SEG|0)+'m | apex inside gap '+(lim-sg*ln.lat[i]).toFixed(1)+' | exit widest '+wOut.toFixed(1)+' at '+(wOutD*SEG|0)+'m');}
  return JSON.stringify(out);})()`),
  ).join(String.fromCharCode(10)),
);
