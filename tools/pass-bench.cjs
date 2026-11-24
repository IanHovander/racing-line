// Compare the Passing styles (sim/passing.ts) over several race grids, one process per style.
//   node tools/pass-bench.cjs [--modes 0,1,2,3] [--seeds 1,2,3,4] [--track 1] [--diff 1] [--level 3] [--laps 4]
//                             [--bot perfect] [--team 0]
// For each style: where you finished, places gained from your grid slot, passes counted by the race stats, passes
// lost, committed passes and how many worked, your contacts and everyone's, seconds with the gas held while the
// contact assist held the car back behind another car, and time off the tarmac per lap.
// The bot is the one-button bot of bench.cjs; with Slingshot it taps the gas as soon as the slingshot is ready.
'use strict';
const path = require('path');
const { execFile } = require('child_process');
const arg = (k, d) => {
  const i = process.argv.indexOf('--' + k);
  return i < 0 ? d : process.argv[i + 1];
};
const NAMES = ['Off', 'Dive', 'Pressure', 'Slingshot'];

if (process.argv.includes('--one')) {
  // child: one style, every seed
  const { bench } = require('./bench.cjs');
  const out = [];
  for (const seed of arg('seeds', '1').split(',').map(Number)) {
    const r = bench({
      level: +arg('level', 3),
      bot: arg('bot', 'perfect'),
      laps: +arg('laps', 4),
      race: true,
      diff: +arg('diff', 1),
      seed,
      team: +arg('team', 0),
      track: +arg('track', 1),
      pass: +arg('pass', 0),
    });
    out.push({ seed, s: r.raceStats, f: r.flying });
  }
  process.stdout.write(JSON.stringify(out));
  process.exit(0);
}

const modes = arg('modes', '0,1,2,3').split(',').map(Number);
const jobs = modes.map(
  m =>
    new Promise(res => {
      const a = [path.join(__dirname, 'pass-bench.cjs'), '--one', '--pass', String(m)];
      for (const k of ['seeds', 'track', 'diff', 'level', 'laps', 'bot', 'team']) {
        const v = arg(k, null);
        if (v !== null) a.push('--' + k, v);
      }
      execFile(process.execPath, a, { maxBuffer: 1 << 26 }, (err, so, se) => {
        if (err) {
          console.error(NAMES[m], se || err);
          return res(null);
        }
        res({ m, r: JSON.parse(so) });
      });
    }),
);
Promise.all(jobs).then(all => {
  console.log(
    'style       seed grid place gained passes lost  tried worked  myHits allHits  held s  off/lap  race s',
  );
  for (const j of all) {
    if (!j) continue;
    const t = { gain: 0, pass: 0, lost: 0, pm: 0, ok: 0, my: 0, all: 0, held: 0, off: 0, place: 0 };
    for (const { seed, s, f } of j.r) {
      const gain = s.grid - s.place;
      console.log(
        NAMES[j.m].padEnd(11),
        String(seed).padStart(4),
        String(s.grid).padStart(4),
        String(s.place).padStart(5),
        String(gain).padStart(6),
        String(s.pass).padStart(6),
        String(s.lost).padStart(4),
        String(s.pm).padStart(6),
        String(s.pmOk).padStart(6),
        String(s.myHits).padStart(7),
        String(s.hits).padStart(7),
        String(s.held).padStart(7),
        String(f.offT).padStart(8),
        String(s.time).padStart(7),
      );
      t.gain += gain;
      t.pass += s.pass;
      t.lost += s.lost;
      t.pm += s.pm;
      t.ok += s.pmOk;
      t.my += s.myHits;
      t.all += s.hits;
      t.held += s.held;
      t.off += f.offT || 0;
      t.place += s.place;
    }
    const n = j.r.length,
      a = k => (t[k] / n).toFixed(1);
    console.log(
      `${NAMES[j.m]} mean: place ${a('place')}  gained ${a('gain')}  passes ${a('pass')}  lost ${a('lost')}  tried ${a('pm')}  worked ${a('ok')}  myHits ${a('my')}  allHits ${a('all')}  held ${a('held')} s  off ${(t.off / n).toFixed(2)} s/lap\n`,
    );
  }
});
