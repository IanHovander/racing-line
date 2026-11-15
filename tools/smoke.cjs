// Smoke test of the game-side hooks with the page booted headless (canvas calls are swallowed by a stub,
// so this proves "no exceptions", not what it looks like).   node tools/smoke.cjs
'use strict';
const { load } = require('./headless.cjs');
const H = load({ seed: 3 });
const step = (n, thr) => H.run(`for(let i=0;i<${n};i++){input.thr=${thr};step(STEP);}`);
H.run(
  'opts.pedals=0;opts.steer=0;opts.team=0;opts.dynlv=2;opts.line=1;opts.rain=0;WX.rain=0;trackIdx=1;buildTrack(TRACKS[1]);dynPrepare(true);PRACTICE=false;setupRace(false);',
);
console.log(
  'eligible',
  H.run('dynEligible()'),
  'ready',
  H.run('DYN.ready'),
  'ready-made',
  H.run('typeof DYNLINES==="object"&&!!DYNLINES["texas:0:2:0"]'),
);
step(1200, true);
H.run('render()');
console.log(
  'racing: dynOn',
  H.run('dynOn(cars[ctrl])'),
  'v',
  H.run('cars[ctrl].v').toFixed(1),
  'plan calls',
  H.run('DYN.stats.calls'),
);
H.run('setDynLevel(0)');
step(240, true);
H.run('render()');
console.log('classic: level', H.run('opts.dynlv'), 'dynOn', H.run('dynOn(cars[ctrl])'));
H.run('cycleDyn();dynPrepare(true)');
step(240, true);
H.run('render()');
console.log('cycled on: level', H.run('opts.dynlv'), 'dynOn', H.run('dynOn(cars[ctrl])'));
H.run('swapCar()');
step(240, true);
H.run('render()');
console.log('after swapCar: driving', H.run('cars[ctrl].name'), 'dynOn', H.run('dynOn(cars[ctrl])'));
H.run('resetCar()');
step(240, true);
H.run('render()');
console.log('after resetCar: v', H.run('cars[ctrl].v').toFixed(1), 'lat', H.run('cars[ctrl].lat').toFixed(2));
H.run('updatePads()');
// a second planner for the same combination must come from the saved line (no rebuild)
H.run('DYN=null;DYNKEY="";const t=performance.now();dynPrepare(true);globalThis.__t=performance.now()-t;');
console.log('re-prepare from saved line:', H.run('__t').toFixed(1), 'ms, ready', H.run('DYN.ready'));
// other cars and circuits
H.run('opts.team=1;setupRace(false);');
console.log('team 1: line', H.run('DYN.key'), 'ready', H.run('DYN.ready'));
step(240, true);
H.run('render()');
H.run('opts.team=0;trackIdx=0;buildTrack(TRACKS[0]);setupRace(false);');
console.log('mexico: line', H.run('DYN.key'), 'ready', H.run('DYN.ready'));
step(240, true);
H.run('render()');
console.log('smoke ok');
