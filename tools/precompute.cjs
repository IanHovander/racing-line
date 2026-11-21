// Works out every racing line the game can ask for (circuit x car x level x dry/wet) and writes them to public/dynlines.json,
// so the game never has to build one while you wait. A line is stored as its spline control points (quarter-millimetre steps).
//   node tools/precompute.cjs                all circuits, one process per circuit and weather, then writes public/dynlines.json
//   node tools/precompute.cjs --track 3 --wet 0  one circuit in one weather only: writes tools/.lines/<id>.<wet>.json
//   node tools/precompute.cjs --merge        only rebuild public/dynlines.json from tools/.lines/*.json
// Re-run it after changing LEVELS in src/sim/dynline.ts, the line builder, the car stats or a circuit: the game checks each stored line's signature
// and falls back to building in the browser when it no longer matches.
'use strict';
const fs = require('fs'),
  path = require('path'),
  cp = require('child_process');
const { load, ROOT } = require('./headless.cjs');
const arg = (k, d) => {
  const i = process.argv.indexOf('--' + k);
  return i < 0
    ? d
    : process.argv[i + 1] === undefined || process.argv[i + 1].startsWith('--')
      ? true
      : process.argv[i + 1];
};

// builder settings to precompute with (the planner's defaults unless given): --cfg '{"levels":[106,212,424,848]}'
const DIR = arg('out', null) ? path.resolve(String(arg('out', ''))) : path.join(__dirname, '.lines'); // --out <dir>: keep the parts somewhere else
const CFG = arg('cfg', null) ? JSON.parse(arg('cfg', '{}')) : null;
// One circuit in one weather. Lines already in tools/.lines with the same signature are kept, and the file is rewritten after
// every line, so an interrupted run can simply be started again.
function one(T, W) {
  const H = load({ seed: 1, cache: false, lines: false });
  H.ctx.__T = T;
  H.ctx.__W = W;
  if (CFG) H.ctx.DYNCFG = CFG;
  const id = H.run('opts.rain=__W;WX.rain=__W;trackIdx=__T;buildTrack(TRACKS[__T]);TR.id');
  fs.mkdirSync(DIR, { recursive: true });
  const file = path.join(DIR, id + '.' + W + '.json');
  let out = {};
  try {
    out = JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (e) {
    out = {};
  }
  const teams = H.run('TEAM_STATS.length');
  for (let tm = 0; tm < teams; tm++)
    for (let lv = 1; lv <= 4; lv++) {
      const key = id + ':' + tm + ':' + lv + ':' + W;
      H.ctx.__tm = tm;
      H.ctx.__lv = lv;
      H.ctx.__have = out[key] ? out[key].sig : '';
      const r = JSON.parse(
        H.run(
          '(()=>{const D=dynMake(__tm,__lv);if(D.sig===__have)return "null";D.build(Infinity);return JSON.stringify({sig:D.sig,c:dynEncode(D.ctl),t:+D.line.lapTime.toFixed(3),ref:+D.line.refTime.toFixed(3)});})()',
        ),
      );
      if (r) {
        out[key] = r;
        fs.writeFileSync(file, JSON.stringify(out));
      }
    }
  return id + (W ? ' wet' : ' dry');
}
function merge() {
  const all = {},
    times = {};
  for (const f of fs.readdirSync(DIR).filter(n => n.endsWith('.json') && n !== 'times.json')) {
    const o = JSON.parse(fs.readFileSync(path.join(DIR, f), 'utf8'));
    for (const k in o) {
      all[k] = { sig: o[k].sig, c: o[k].c };
      times[k] = { t: o[k].t, ref: o[k].ref };
    }
  }
  const keys = Object.keys(all).sort();
  const out = path.join(ROOT, 'public/dynlines.json');
  const NL = String.fromCharCode(10); // one line of JSON per racing line, so a diff shows which lines changed
  fs.writeFileSync(
    out,
    '{' + NL + keys.map(k => JSON.stringify(k) + ':' + JSON.stringify(all[k])).join(',' + NL) + NL + '}' + NL,
  );
  fs.writeFileSync(path.join(DIR, 'times.json'), JSON.stringify(times));
  console.log(`public/dynlines.json: ${keys.length} lines, ${(fs.statSync(out).size / 1024).toFixed(0)} kB`);
}

if (arg('track', null) !== null) {
  const t0 = Date.now();
  console.log('done', one(+arg('track', 0), +arg('wet', 0)), ((Date.now() - t0) / 1000).toFixed(0) + ' s');
} else if (arg('merge', false)) merge();
else {
  const n = load({ seed: 1, cache: false, lines: false }).run('TRACKS.length');
  let left = 2 * n;
  for (let t = 0; t < n; t++)
    for (const w of [0, 1]) {
      const p = cp.spawn(
        process.execPath,
        [__filename, '--track', String(t), '--wet', String(w)].concat(
          CFG ? ['--cfg', JSON.stringify(CFG)] : [],
          arg('out', null) ? ['--out', String(arg('out', ''))] : [],
        ),
        { stdio: 'inherit' },
      );
      p.on('exit', code => {
        if (code) {
          console.error('circuit', t, 'failed');
          process.exitCode = 1;
        }
        if (--left === 0) merge();
      });
    }
}
