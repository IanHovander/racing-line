// Prints lap results for every line (classic and the four dynamic levels) against every bot.
//   node tools/table.cjs [--levels 0,1,2,3,4] [--bots perfect,late0.1,...] [--laps 4] [--cfg '{...}']
'use strict';
const { bench } = require('./bench.cjs');
const arg = (k, d) => {
  const i = process.argv.indexOf('--' + k);
  return i < 0 ? d : process.argv[i + 1];
};
const cfg = arg('cfg', null),
  laps = +arg('laps', 4);
const bots = arg('bots', 'perfect,late0.1,late0.2,late0.3,jitter0.1,jitter0.2,eager1.5,early').split(','),
  levels = arg('levels', '0,1,2,3,4').split(',').map(Number);
const NAMES = ['Classic', 'Novice', 'Intermediate', 'Cautious Expert', 'Perfect Expert'];
console.log('line     bot         lap(s)  worst   skid(s)  off(s)  jerk   plan avg/max ms  flips');
for (const lv of levels) {
  for (const bot of bots) {
    const r = bench({ level: lv, bot, laps, cfg: lv ? cfg : null }),
      f = r.flying,
      p = r.planner || {};
    console.log(
      NAMES[lv].padEnd(8),
      bot.padEnd(10),
      String(f.time).padStart(7),
      String(f.worst).padStart(7),
      String(f.slideT).padStart(8),
      String(f.offT).padStart(7),
      String(f.jerk).padStart(6),
      lv && p.calls ? `   ${(p.ms / p.calls).toFixed(2)} / ${p.maxMs.toFixed(1)}`.padEnd(18) + p.flips : '',
    );
  }
  console.log('');
}
