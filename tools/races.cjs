// Races the one-button bot against the AI field on both line modes over several grids.
//   node tools/races.cjs [--seeds 1,2,3,4,5,6] [--bot perfect] [--laps 5] [--diff 1] [--cfg '{...}'] [--modes classic,dynamic]
'use strict';
const { bench } = require('./bench.cjs');
const arg = (k, d) => {
  const i = process.argv.indexOf('--' + k);
  return i < 0 ? d : process.argv[i + 1];
};
const level = +arg('level', 2),
  seeds = arg('seeds', '1,2,3,4,5,6').split(',').map(Number),
  bot = arg('bot', 'perfect'),
  laps = +arg('laps', 5),
  diff = +arg('diff', 1),
  cfg = arg('cfg', null);
console.log(
  'mode     seed  place  raceTime  avgLap  bestLap  passes lost  myHits allHits  slide  off   planPasses flips  maxMs',
);
for (const mode of arg('modes', 'classic,dynamic').split(',')) {
  const tot = { place: 0, time: 0, pass: 0, lost: 0, my: 0, hits: 0, off: 0 };
  for (const seed of seeds) {
    const r = bench({
        level: mode === 'classic' ? 0 : level,
        bot,
        laps,
        race: true,
        diff,
        seed,
        cfg: mode === 'dynamic' ? cfg : null,
      }),
      s = r.raceStats,
      f = r.flying,
      p = r.planner || {};
    console.log(
      mode.padEnd(8),
      String(seed).padStart(4),
      String(s.place).padStart(6),
      String(s.time).padStart(9),
      String(f.time).padStart(7),
      String(f.best).padStart(8),
      String(s.pass).padStart(7),
      String(s.lost).padStart(4),
      String(s.myHits).padStart(7),
      String(s.hits).padStart(7),
      String(f.slideT).padStart(6),
      String(f.offT).padStart(5),
      String(p.passes || 0).padStart(9),
      String(p.flips || 0).padStart(6),
      (p.maxMs || 0).toFixed(1).padStart(7),
    );
    tot.place += s.place;
    tot.time += s.time;
    tot.pass += s.pass;
    tot.lost += s.lost;
    tot.my += s.myHits;
    tot.hits += s.hits;
    tot.off += f.offT;
  }
  const n = seeds.length;
  console.log(
    `${mode} mean: place ${(tot.place / n).toFixed(1)}  race ${(tot.time / n).toFixed(1)} s  passes ${(tot.pass / n).toFixed(1)}  lost ${(tot.lost / n).toFixed(1)}  myHits ${(tot.my / n).toFixed(1)}  allHits ${(tot.hits / n).toFixed(1)}  off ${(tot.off / n).toFixed(2)} s/lap\n`,
  );
}
