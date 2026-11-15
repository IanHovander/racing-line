// A two-player online race without a network: two copies of the game run side by side in this process, joined by a fake room that
// hands each one the other's presence, exactly as the real room service does. The host owns the AI cars; each side drives its own car
// with the one-button bot. Checks that both players' cars are on the dynamic line of their own level, the AI is on the room's
// Opponents line, the guest sees everyone move, and both sides finish with the same result.
//   node tools/mp-test.cjs [--track 2] [--rain 0] [--diff 1] [--laps 3] [--hostLevel 2] [--guestLevel 4] [--hostTeam 0] [--guestTeam 3] [--classic]
// --classic runs the same race on the old fixed line (for comparing how well the two sides stay in step).
'use strict';
const { load } = require('./headless.cjs');
const arg = (k, d) => {
  const i = process.argv.indexOf('--' + k);
  return i < 0 ? d : +process.argv[i + 1];
};
const o = {
  track: arg('track', 2),
  rain: arg('rain', 0),
  diff: arg('diff', 1),
  laps: arg('laps', 3),
  hostLevel: arg('hostLevel', 2),
  guestLevel: arg('guestLevel', 4),
  hostTeam: arg('hostTeam', 0),
  guestTeam: arg('guestTeam', 3),
};

const pres = { A: {}, B: {} };
function mk(id, host, team, level, seed) {
  const H = load({ seed });
  H.ctx.__id = id;
  H.ctx.__pres = pres[id];
  H.ctx.__o = o;
  H.ctx.__team = team;
  H.ctx.__lv = level;
  H.ctx.__host = host;
  H.ctx.__now = 1e6;
  H.ctx.__classic = process.argv.includes('--classic');
  H.run(`Date.now=()=>__now;if(__classic)DynLine=undefined;opts.pedals=0;opts.steer=0;opts.team=__team;opts.dynlv=__lv;opts.gears=0;opts.tyres=0;opts.damage=0;opts.diff=__host?__o.diff:0;opts.laps=__host?__o.laps:1;opts.rain=__host?__o.rain:0;WX.rain=opts.rain;
    if(__host){trackIdx=__o.track;buildTrack(TRACKS[trackIdx]);setupRace(true);}
    MP.room={presence(p){Object.assign(__pres,p);return Promise.resolve();},leave(){return Promise.resolve();}};MP.me=__id;MP.host=__host;MP.phase='lobby';MP.jt=__host?1:2;
    if(__host)lbRulesInit();mpPresence();
    var __m={off:0,wide:0,dyn:0,n:0,seen:0,err:0,errN:0};
    function __peers(P){MP.peers=P;mpPeers({peers:P,left:[]});}
    function __tick(){const c=cars[ctrl];if(MP.phase==='race'&&c&&c.mine){if(state==='race'&&START.done&&!c.finished)input.thr=c.v<c.safeV-0.2;else input.thr=false;}
      step(STEP);mpSend(STEP);
      if(MP.phase==='race'&&state==='race'&&c&&c.mine&&!c.finished){__m.n++;if(dynOn(c))__m.dyn++;if(c.surf>=2)__m.off+=STEP;if(Math.abs(c.lat)>HW+0.45)__m.wide+=STEP;}}
    function __report(){const c=cars[ctrl];return JSON.stringify({state,track:TR.id,rain:WX.rain,diff:opts.diff,myTeam:c.team,dynTeam:DYNTM,level:DYN?DYN.name:'Classic',dynShare:__m.n?+(__m.dyn/__m.n).toFixed(3):0,off:+__m.off.toFixed(2),wide:+__m.wide.toFixed(2),
      best:+(c.best||0).toFixed(2),place:c.place||0,aiLines:AIL.filter(Boolean).length,
      cars:cars.map(q=>({n:q.name,team:q.team,human:!!q.human,remote:!!q.remote,laps:Math.max(0,q.cross-1),best:+(q.best||0).toFixed(2),fin:!!q.finished,place:q.place||0,out:!!q.out})),hits:HITS});}`);
  return H;
}
const A = mk('A', true, o.hostTeam, o.hostLevel, 11),
  B = mk('B', false, o.guestTeam, o.guestLevel, 22);
const peers = me =>
  ['A', 'B'].map(id => ({
    peer: id,
    kind: 'viewer',
    sameTab: id === me,
    presence: JSON.parse(JSON.stringify(pres[id])),
  }));
const deliver = () => {
  A.ctx.__P = peers('A');
  A.run('__peers(__P)');
  B.ctx.__P = peers('B');
  B.run('__peers(__P)');
};

deliver(); // both in the lobby
A.ctx.__P = peers('A');
A.run('MP.peers=__P;hostStart()');
deliver(); // the guest sees the countdown and starts too
if (B.run('MP.phase') !== 'race') {
  console.log('FAIL the guest did not start the race');
  process.exit(1);
}

let t = 0,
  posErr = 0,
  posN = 0;
for (let i = 0; i < 120 * 420; i++) {
  A.ctx.__now += 1000 / 120;
  B.ctx.__now += 1000 / 120;
  A.run('__tick()');
  B.run('__tick()');
  if (i % 6 === 5) deliver(); // presence reaches the other side 20 times a second
  if (i % 120 === 0 && A.run('state') === 'race') {
    // how far the guest's picture of the host's car is from where the host really is
    const a = JSON.parse(A.run('JSON.stringify([cars[ctrl].x,cars[ctrl].y,cars[ctrl].number,cars[ctrl].v])'));
    B.ctx.__n = a[2];
    const b = JSON.parse(
      B.run('(()=>{const q=cars.find(q=>q.number===__n);return JSON.stringify([q.x,q.y]);})()'),
    );
    posErr += Math.hypot(a[0] - b[0], a[1] - b[1]) / Math.max(a[3], 10);
    posN++;
  }
  t = i / 120;
  if (
    A.run('cars.every(q=>q.finished||q.out||q.gone)') &&
    B.run('cars.filter(q=>q.human).every(q=>q.finished||q.out)')
  )
    break;
}
const ra = JSON.parse(A.run('__report()')),
  rb = JSON.parse(B.run('__report()'));
let fails = 0;
const ok = (c, m) => {
  console.log((c ? '  ok   ' : '  FAIL ') + m);
  if (!c) fails++;
};
console.log(
  `online race on ${ra.track}, ${ra.rain ? 'wet' : 'dry'}, ${o.laps} laps, Opponents ${['Easy', 'Medium', 'Hard'][o.diff]}  (${t.toFixed(0)} s simulated)`,
);
ok(
  rb.track === ra.track && rb.rain === ra.rain && rb.diff === ra.diff,
  `the guest took the room's circuit, weather and Opponents level (${rb.track}, ${rb.rain ? 'wet' : 'dry'}, ${rb.diff})`,
);
ok(
  (o.hostLevel || process.argv.includes('--classic')
    ? ra.dynShare > 0.999 || process.argv.includes('--classic')
    : ra.dynShare === 0) && ra.dynTeam === ra.myTeam,
  `host's car is driven on the ${ra.level} line the whole race (team ${ra.myTeam})`,
);
ok(
  (o.guestLevel ? rb.dynShare > 0.999 : rb.dynShare === 0) && rb.dynTeam === rb.myTeam,
  `guest's car is driven on the ${rb.level} line the whole race (team ${rb.myTeam})`,
);
ok(
  ra.aiLines === 5,
  `host drives the AI on the ${['Easy', 'Medium', 'Hard'][o.diff]} lines (${ra.aiLines} of 5 teams)`,
);
// (in a pack a car can be pushed wide for a moment; a player on the Classic line is not held to this)
// (Perfect Expert keeps nothing in reserve and runs 0.3 m from the edge, so being held up in a pack costs it more: allowed 5 s)
const wideMax = lv => (lv === 4 ? 5 : 1.5);
ok(
  (ra.wide < wideMax(o.hostLevel) || !o.hostLevel) && (rb.wide < wideMax(o.guestLevel) || !o.guestLevel),
  `players on a dynamic line stayed on the tarmac but for moments in traffic (beyond the edge: host ${ra.wide} s, guest ${rb.wide} s)`,
);
const ai = ra.cars.filter(c => !c.human),
  aiB = rb.cars.filter(c => !c.human);
ok(
  ai.every(c => c.laps >= o.laps || c.fin) && !ai.some(c => c.out),
  `all ${ai.length} AI cars completed the race on the host (best laps ${ai
    .map(c => c.best)
    .sort((a, b) => a - b)
    .join(' ')})`,
);
ok(
  aiB.every(c => c.remote) && aiB.every(c => c.laps >= o.laps - 1),
  `the guest sees every AI car go round (laps seen: ${aiB.map(c => c.laps).join(' ')})`,
);
// (remote cars are smoothed towards their reported position, which trails by about 1/14 s; the old fixed line gives the same figure)
ok(
  posErr / Math.max(1, posN) < 0.1,
  `guest's picture of the host's car trails the truth by ${((1000 * posErr) / Math.max(1, posN)).toFixed(0)} ms on average`,
);
const hum = r =>
  r.cars
    .filter(c => c.human)
    .map(c => c.n + ':P' + c.place)
    .sort()
    .join(' ');
ok(
  ra.cars.filter(c => c.human).every(c => c.fin) && hum(ra) === hum(rb),
  `both sides agree on the players' finishing places (${hum(ra)})`,
);
console.log(
  `  host best lap ${ra.best} s (${ra.level}), guest best lap ${rb.best} s (${rb.level}), contacts ${ra.hits}`,
);
console.log(fails ? `${fails} FAILED` : 'all passed');
process.exit(fails ? 1 : 0);
