// Why do AI cars leave the tarmac in a race? Runs a race with the one-button bot and logs every AI excursion:
// how far the car was from its own line when it left, its lane offset (set by traffic), its speed against the
// line's speed, its braking error, and whether another car was beside it.
//   node tools/ai-offs.cjs [--track 0] [--diff 1] [--laps 5] [--seed 3] [--rain 0] [--set '...'] [--list]
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
function aiOffs(o) {
  o = Object.assign({ track: 0, diff: 1, laps: 5, seed: 3, rain: 0, set: '', team: 0 }, o);
  const H = load({ seed: +o.seed });
  H.ctx.__o = o;
  H.run(
    `${o.set || ''};opts.steer=0;opts.team=__o.team|0;opts.diff=__o.diff|0;opts.laps=__o.laps|0;opts.rain=__o.rain|0;WX.rain=opts.rain;opts.damage=0;opts.dynlv=(__o.diff|0)+1;
    trackIdx=__o.track|0;buildTrack(TRACKS[trackIdx]);dynPrepare(true);PRACTICE=false;setupRace(false);
    var __ev=[],__in=new Map(),__offT=0,__aiT=0;
    function __tick(){const me=cars[ctrl];if(state==='race'&&START.done&&me&&!me.finished)input.thr=me.v<me.safeV-0.2;step(STEP);if(state!=='race')return;
      for(const c of cars){if(c===me||c.out||c.gone||c.finished)continue;__aiT+=STEP;const off=c.surf>=2||Math.abs(c.lat)>HW+0.45,LN=AIL[c.team]||GS_off,PV=AIV[c.team];
        if(off){__offT+=STEP;if(!__in.has(c)){let near=1e9,side=false;for(const q of cars){if(q===c||q.gone)continue;let d=q.s-c.s;if(d<-L/2)d+=L;else if(d>L/2)d-=L;if(Math.abs(d)<near)near=Math.abs(d);if(Math.abs(d)<7&&Math.abs(q.lat-c.lat)<4.5)side=true;}
            const e={t:+raceTime.toFixed(1),car:c.name,turn:cornerAt(c.idx)||'-',lane:+c.lane.toFixed(2),err:+(c.lat-LN[c.idx]).toFixed(2),dv:PV?+(c.v-PV[c.idx]).toFixed(1):0,brkErr:+(c.brkErr||0).toFixed(3),near:+near.toFixed(0),side,bump:raceTime-(c.bumpT??-99)<2,dur:0};__in.set(c,e);__ev.push(e);}
          __in.get(c).dur+=STEP;}else __in.delete(c);}}`.replace('GS_off', 'off'),
  );
  let g = 0;
  while (g++ < 120 * 900) {
    H.run('__tick()');
    if (H.run('state') === 'finished' || H.run('!!(cars[ctrl]&&(cars[ctrl].finished||cars[ctrl].out))'))
      break;
  }
  const ev = JSON.parse(H.run('JSON.stringify(__ev)'));
  return { id: H.run('TR.id'), ev, offT: H.run('__offT'), aiT: H.run('__aiT'), hits: H.run('HITS') };
}
module.exports = { aiOffs };
if (require.main === module) {
  const r = aiOffs({
    track: +arg('track', 0),
    diff: +arg('diff', 1),
    laps: +arg('laps', 5),
    seed: +arg('seed', 3),
    rain: +arg('rain', 0),
    set: arg('set', ''),
  });
  const n = r.ev.length,
    cnt = f => r.ev.filter(f).length;
  console.log(
    `${r.id}: ${n} AI excursions, ${r.offT.toFixed(1)} s off in ${(r.aiT / 60).toFixed(1)} car-minutes (${((100 * r.offT) / r.aiT).toFixed(2)}%), contacts ${r.hits}`,
  );
  console.log(
    `  in a lane (|lane| > 0.5 m): ${cnt(e => Math.abs(e.lane) > 0.5)}   car beside: ${cnt(e => e.side)}   just hit: ${cnt(e => e.bump)}   on its line, alone, no contact: ${cnt(e => Math.abs(e.lane) <= 0.5 && !e.side && !e.bump)}   over the line's speed by > 1 m/s: ${cnt(e => e.dv > 1)}`,
  );
  if (arg('list', false)) for (const e of r.ev) console.log('   ' + JSON.stringify(e));
}
