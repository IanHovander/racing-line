// Sweep of the dynamic lines over every circuit, car, level and weather, with the one-button bots and with races.
//   node tools/rollout.cjs                 every circuit, one process each; prints a summary and writes tools/.rollout/<id>.json
//   node tools/rollout.cjs --track 3       one circuit, in this process
//   node tools/rollout.cjs --quick         fewer cars (teams 0 and 3) and no races
//   node tools/rollout.cjs --races         races only (two grids per case)
// Solo: bots "perfect" and "late0.2" for each car and level, dry; in the wet for two cars.
//   wide = seconds per lap with the car's centre beyond the tarmac edge, wall = seconds against a barrier.
// Races: 5 laps against the AI on each Opponents level (the bot on the matching line), dry, and Medium in the wet.
'use strict';
const fs = require('fs'),
  path = require('path'),
  cp = require('child_process');
const { bench } = require('./bench.cjs');
const DIR = path.join(__dirname, '.rollout');
const arg = (k, d) => {
  const i = process.argv.indexOf('--' + k);
  return i < 0
    ? d
    : process.argv[i + 1] === undefined || process.argv[i + 1].startsWith('--')
      ? true
      : process.argv[i + 1];
};
const quick = !!arg('quick', false),
  racesOnly = !!arg('races', false);

function one(track) {
  const out = { solo: [], races: [] };
  if (!racesOnly)
    for (const rain of [0, 1])
      for (const team of rain ? [0, 3] : quick ? [0, 3] : [0, 1, 2, 3, 4])
        for (let level = 1; level <= 4; level++)
          for (const bot of ['perfect', 'late0.2']) {
            const r = bench({ track, team, level, bot, rain, laps: 3 }),
              f = r.flying;
            out.solo.push({
              rain,
              team,
              level,
              bot,
              time: f.time,
              slideT: f.slideT,
              offT: f.offT,
              wideT: f.wideT,
              wallT: f.wallT,
              jerk: f.jerk,
              model: +(+r.model).toFixed(2),
              n: f.n,
              maxMs: r.planner ? +r.planner.maxMs.toFixed(2) : 0,
            });
          }
  if (!quick)
    for (const [diff, rain] of [
      [0, 0],
      [1, 0],
      [2, 0],
      [1, 1],
    ])
      for (const sd of racesOnly ? [3, 11] : [3]) {
        const r = bench({
            track,
            team: (track + sd) % 5,
            level: diff + 1,
            bot: 'perfect',
            rain,
            race: true,
            diff,
            laps: 5,
            seed: sd + track,
          }),
          s = r.raceStats,
          ai = s.ai;
        const best = ai
          .map(a => a.best)
          .filter(x => x > 0)
          .sort((a, b) => a - b);
        out.races.push({
          diff,
          rain,
          place: s.place,
          myBest: r.flying.best,
          myAvg: r.flying.time,
          aiBest: best[0],
          aiMed: best[best.length >> 1],
          aiWorst: best[best.length - 1],
          aiOff: +(ai.reduce((t, a) => t + a.off, 0) / ai.length).toFixed(1),
          hits: s.hits,
          myHits: s.myHits,
          outs: ai.filter(a => a.out).length,
          ghosts: ai.reduce((t, a) => t + a.ghosts, 0),
          aiLaps: Math.min(...ai.map(a => a.laps)),
          gain: s.pass - s.lost,
        });
      }
  return out;
}
function show(id, o) {
  const L = ['', 'Novice', 'Intermediate', 'Cautious Expert', 'Perfect Expert'];
  console.log(`\n== ${id} ==`);
  for (const rain of [0, 1])
    for (let level = 1; level <= 4; level++) {
      const row = bot => {
        const a = o.solo.filter(s => s.rain === rain && s.level === level && s.bot === bot);
        if (!a.length) return '';
        const mx = k => Math.max(...a.map(s => s[k])),
          mn = k => Math.min(...a.map(s => s[k]));
        return `${bot}: lap ${mn('time').toFixed(1)}-${mx('time').toFixed(1)} slide<=${mx('slideT').toFixed(1)} off<=${mx('offT').toFixed(1)} wide<=${mx('wideT').toFixed(1)} wall<=${mx('wallT').toFixed(2)}`;
      };
      if (row('perfect'))
        console.log(
          ` ${rain ? 'wet' : 'dry'} ${L[level].padEnd(15)} ${row('perfect')}  |  ${row('late0.2')}`,
        );
    }
  for (const r of o.races)
    console.log(
      ` race ${r.rain ? 'wet' : 'dry'} vs ${['Easy', 'Medium', 'Hard'][r.diff].padEnd(6)}: bot P${r.place} best ${r.myBest} | AI best ${r.aiBest} median ${r.aiMed} slowest ${r.aiWorst} | AI off ${r.aiOff} s/car  places gained ${r.gain}  hits ${r.hits} (bot ${r.myHits})  retired ${r.outs}  stuck ${r.ghosts}`,
    );
}
if (arg('track', null) !== null) {
  const t = +arg('track', 0),
    o = one(t);
  fs.mkdirSync(DIR, { recursive: true });
  fs.writeFileSync(path.join(DIR, t + (racesOnly ? 'r' : '') + '.json'), JSON.stringify(o));
  if (!arg('child', false)) show('track ' + t, o);
} else if (arg('show', false)) {
  for (const f of fs.readdirSync(DIR).sort())
    show('track ' + f.replace('.json', ''), JSON.parse(fs.readFileSync(path.join(DIR, f), 'utf8')));
} else {
  let left = 8;
  for (let t = 0; t < 8; t++) {
    const p = cp.spawn(
      process.execPath,
      [__filename, '--track', String(t), '--child'].concat(
        quick ? ['--quick'] : [],
        racesOnly ? ['--races'] : [],
      ),
      { stdio: 'inherit' },
    );
    p.on('exit', code => {
      if (code) {
        console.error('track', t, 'failed');
        process.exitCode = 1;
      }
      if (--left === 0)
        for (let k = 0; k < 8; k++) {
          try {
            show(
              'track ' + k,
              JSON.parse(fs.readFileSync(path.join(DIR, k + (racesOnly ? 'r' : '') + '.json'), 'utf8')),
            );
          } catch (e) {
            console.log('track', k, 'no result');
          }
        }
    });
  }
}
