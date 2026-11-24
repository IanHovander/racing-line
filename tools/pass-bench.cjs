// Passing in Auto steering (src/sim/pass.ts), measured: races of the one-button bot (perfect gas) with a simple
// "player" that asks for passes in one of the three ways, against the same grids with no passing at all.
//   node tools/pass-bench.cjs [--styles none,slide,swipe,tap] [--seeds 1,2,3,4] [--tracks 1,3,6] [--laps 3] [--diff 1] [--level 3]
// Prints, per style: finishing place, passes made and lost (the results' counters), your contacts, seconds off the
// tarmac per race, and how the manoeuvres ended (cleared the car / given up).
'use strict';
const { load } = require('./headless.cjs');
const arg = (k, d) => {
  const i = process.argv.indexOf('--' + k);
  return i < 0 ? d : process.argv[i + 1];
};
const styles = arg('styles', 'none,slide,swipe,tap').split(','),
  seeds = arg('seeds', '1,2,3,4').split(',').map(Number),
  tracks = arg('tracks', '1,3,6').split(',').map(Number),
  laps = +arg('laps', 3),
  diff = +arg('diff', 1),
  level = +arg('level', 3);

function race(style, seed, track) {
  const H = load({ seed });
  H.ctx.__o = { style, laps, diff, level, track };
  H.run(`opts.steer=0;opts.team=0;opts.diff=__o.diff;opts.laps=__o.laps;opts.rain=0;WX.rain=0;opts.damage=0;opts.gears=0;
    opts.dynlv=__o.level;trackIdx=__o.track;buildTrack(TRACKS[trackIdx]);dynPrepare(true);
    PASS_UI=__o.style==='none'?'swipe':__o.style;
    PRACTICE=false;setupRace(false);`);
  H.run(`var __r={whys:{},off:0,start:0,clear:0,quit:0,wait:0,was:0,prevCar:null,slideDir:0};
    function __player(c){
      const st=__o.style; if(st==='none')return;
      const P=PM;
      // a manoeuvre ended: cleared the car, or gave up
      if(__r.was&&!P.side){ if(P.why==='clear')__r.clear++; else {__r.quit++;__r.whys[P.why]=(__r.whys[P.why]||0)+1;} __r.wait=1.0; P.why=''; }
      __r.was=P.side; __r.prevCar=P.car;
      if(__r.wait>0){__r.wait-=STEP;}
      const o=P.near; const g=o?passGap(c,o):99;
      // a player passes when stuck: a car close ahead, on your line, for a moment
      const stuck=o&&g<22&&Math.abs(o.lat-c.lat)<2.4;
      __r.stuckT=stuck?(__r.stuckT||0)+STEP:0;
      // ...and the cues say it is a good moment on the side the game suggests
      const go=__r.stuckT>0.5&&!P.side&&__r.wait<=0&&P.auto&&P.good[P.auto<0?0:1];
      if(st==='swipe'){
        if(go){ passCommit(P.auto,'key'); __r.start++; }
      } else if(st==='tap'){
        if(go&&(P.charge>=1||__r.stuckT>2.5)){ passTap(); __r.start++; }
      } else if(st==='slide'){
        // slide out towards the better side while stuck, stop touching once the car is behind
        if(go&&!__r.slideDir){__r.slideDir=P.auto;__r.start++;}
        // move over just far enough to clear the car ahead, then leave the thumb still
        if(__r.slideDir){ if(o&&g>-1&&g<40){ if(Math.abs(o.lat-c.lat)<3.1&&Math.abs(P.s)<0.9)passSlide(__r.slideDir*STEP*1.6);} else __r.slideDir=0; }
      }
    }
    function __tick(){const c=cars[ctrl];
      if(state==='race'&&START.done&&c&&!c.finished){input.thr=c.v<(c.safeV||0)-0.2;__player(c);}
      step(STEP);
      if(c&&state==='race'&&c.surf>=2)__r.off+=STEP;}`);
  let guard = 0;
  while (guard++ < 900 * 120) {
    H.run('__tick()');
    if (H.run("state==='finished'||!!(cars[ctrl]&&(cars[ctrl].finished||cars[ctrl].out))")) break;
  }
  return JSON.parse(
    H.run(`JSON.stringify({place:standings().indexOf(cars[ctrl])+1,start:(cars[ctrl].grid||0),pass:(cars[ctrl].stat||{}).pass||0,lost:(cars[ctrl].stat||{}).lost||0,
      hits:cars[ctrl].hits||0,off:+__r.off.toFixed(2),tries:__r.start,clear:__r.clear,quit:__r.quit,whys:__r.whys,time:+raceTime.toFixed(1)})`),
  );
}

console.log('style   track seed  place  pass lost  hits   off  tries clear quit   time');
for (const style of styles) {
  const T = { place: 0, pass: 0, lost: 0, hits: 0, off: 0, tries: 0, clear: 0, quit: 0, n: 0 };
  for (const track of tracks)
    for (const seed of seeds) {
      const r = race(style, seed, track);
      console.log(
        style.padEnd(7),
        String(track).padStart(5),
        String(seed).padStart(4),
        String(r.place).padStart(6),
        String(r.pass).padStart(5),
        String(r.lost).padStart(4),
        String(r.hits).padStart(5),
        String(r.off).padStart(5),
        String(r.tries).padStart(6),
        String(r.clear).padStart(5),
        String(r.quit).padStart(4),
        String(r.time).padStart(6),
        JSON.stringify(r.whys),
      );
      for (const k of ['place', 'pass', 'lost', 'hits', 'off', 'tries', 'clear', 'quit']) T[k] += r[k];
      T.n++;
    }
  const m = k => (T[k] / T.n).toFixed(2);
  console.log(
    `${style} mean: place ${m('place')}  passes ${m('pass')}  lost ${m('lost')}  hits ${m('hits')}  off ${m('off')} s  tries ${m('tries')}  cleared ${m('clear')}  gave up ${m('quit')}\n`,
  );
}
