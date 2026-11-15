// Headless loader: bundles the game (src/main.ts) with esbuild and runs it inside a Node vm context with stubbed
// browser APIs, so the simulation (buildTrack, setupRace, step, cars, the racing-line planner, ...) can be driven and
// measured from the command line. Nothing is rendered; requestAnimationFrame never fires and timers never run.
//
//   const H = require('./headless.cjs').load({ seed: 1 });
//   H.run('buildTrack(TRACKS[1]); N')      // evaluate code with the game's bindings as globals
//
// The page thinks it is on localhost, so src/debug.ts puts every exported binding and every GS field on the
// global object, readable and writable (`cars`, `opts`, `state = 'race'`, `step(STEP)`, `dynPrepare(true)`, ...),
// exactly as in the browser console with ?debug.
//
// Options: seed (Math.random is seeded, default 12345), lines (false = do not hand over public/dynlines.json, so
// every line is built fresh), cache (false = do not keep freshly built lines in tools/.cache.json between runs).
'use strict';
const fs = require('fs'),
  path = require('path'),
  vm = require('vm');
const ROOT = path.resolve(__dirname, '..');

function mulberry32(a) {
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// A stub that swallows everything: any property is the stub, calling or constructing it returns the stub, it
// iterates as empty and converts to 0. Values assigned to it are remembered.
function makeStub() {
  const store = Object.create(null);
  const target = function () {};
  const p = new Proxy(target, {
    get(_, k) {
      if (k === Symbol.toPrimitive) return () => 0;
      if (k === Symbol.iterator) return function* () {};
      if (k === 'then') return undefined; // never look like a thenable
      if (k === 'length') return 0;
      if (k in store) return store[k];
      return p;
    },
    set(_, k, v) {
      store[k] = v;
      return true;
    },
    has() {
      return false;
    },
    apply() {
      return p;
    },
    construct() {
      return p;
    },
  });
  return p;
}

let bundle = null;
/** the game as one script (built once per process) */
function gameScript() {
  if (bundle) return bundle;
  const esbuild = require('esbuild');
  bundle = esbuild.buildSync({
    entryPoints: [path.join(ROOT, 'src/main.ts')],
    bundle: true,
    format: 'iife',
    write: false,
    target: 'es2020',
    loader: { '.css': 'empty' },
    external: ['*.woff', '*.woff2'],
    logLevel: 'silent',
  }).outputFiles[0].text;
  return bundle;
}

function load(o) {
  o = o || {};
  const stub = makeStub();
  const ls = new Map(Object.entries(o.localStorage || {}));
  // lines built during a run are kept between runs (tools/.cache.json), as the browser keeps them in localStorage
  const cacheFile = path.join(__dirname, '.cache.json');
  let cache = {};
  if (o.cache !== false) {
    try {
      cache = JSON.parse(fs.readFileSync(cacheFile, 'utf8'));
    } catch (e) {
      cache = {};
    }
    for (const k in cache) if (!ls.has(k)) ls.set(k, cache[k]);
  }
  const keep = (k, v) => {
    if (o.cache === false || !k.startsWith('hcgp_dynl_') || cache[k] === v) return;
    cache[k] = v;
    try {
      fs.writeFileSync(cacheFile, JSON.stringify(cache));
    } catch (e) {
      /* the cache is a convenience */
    }
  };
  let lines = null;
  if (o.lines !== false) {
    try {
      lines = JSON.parse(fs.readFileSync(path.join(ROOT, 'public/dynlines.json'), 'utf8'));
    } catch (e) {
      lines = null; // not generated yet: every line is built when asked for
    }
  }
  const sandbox = {
    console,
    URLSearchParams,
    atob,
    btoa,
    document: stub,
    navigator: { maxTouchPoints: 0, userAgent: 'node' },
    location: {
      hash: '',
      search: o.search || '',
      pathname: '/',
      hostname: 'localhost',
      protocol: 'http:',
      origin: 'http://localhost',
      href: 'http://localhost/',
    },
    localStorage: {
      getItem: k => (ls.has(k) ? ls.get(k) : null),
      setItem: (k, v) => {
        ls.set(k, String(v));
        keep(k, String(v));
      },
      removeItem: k => {
        ls.delete(k);
      },
    },
    innerWidth: 1280,
    innerHeight: 720,
    devicePixelRatio: 1,
    performance: { now: () => Number(process.hrtime.bigint() / 1000n) / 1000 },
    addEventListener() {},
    removeEventListener() {},
    requestAnimationFrame() {
      return 0;
    },
    cancelAnimationFrame() {},
    setTimeout() {
      return 0;
    },
    clearTimeout() {},
    setInterval() {
      return 0;
    },
    clearInterval() {},
    Image: stub,
    Path2D: stub,
    Blob: stub,
    AudioContext: undefined,
    webkitAudioContext: undefined,
    OfflineAudioContext: stub,
    ResizeObserver: stub,
    CanvasRenderingContext2D: { prototype: { ellipse() {} } },
    matchMedia: () => ({ matches: false, addEventListener() {} }),
    DYNLINES: lines || {}, // sim/lines.ts takes the ready-made lines from here instead of fetching them
  };
  sandbox.window = sandbox;
  sandbox.self = sandbox;
  sandbox.globalThis = sandbox;
  const ctx = vm.createContext(sandbox);
  ctx.__rnd = mulberry32(o.seed === undefined ? 12345 : o.seed);
  vm.runInContext('Math.random=__rnd', ctx);
  vm.runInContext(gameScript(), ctx, { filename: 'game-bundle.js' });
  const run = code => vm.runInContext(code, ctx);
  return { ctx, run, get: name => run(name) };
}
process.on('unhandledRejection', () => {});
module.exports = { load, ROOT };

if (require.main === module) {
  const H = load();
  console.log('loaded. circuits:', H.run('TRACKS.map(t=>t.id).join(",")'));
  H.run('trackIdx=1;buildTrack(TRACKS[1]);');
  console.log(
    'texas N',
    H.run('N'),
    'L',
    H.run('L').toFixed(1),
    'SEG',
    H.run('SEG').toFixed(4),
    'HW',
    H.run('HW'),
  );
}
