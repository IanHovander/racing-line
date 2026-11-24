import { test, expect, type Page } from 'playwright/test';

// The game exposes its state on window when served from localhost (see src/debug.ts),
// so the tests can drive the simulation directly instead of waiting for real time.
declare const window: any;

async function open(page: Page) {
  const errors: string[] = [];
  page.on('pageerror', e => errors.push(String(e)));
  await page.goto('/?debug');
  await page.waitForFunction(() => typeof window.wzGo === 'function' && window.N > 0);
  return errors;
}

test('main screen opens the single-player and multiplayer panels', async ({ page }) => {
  const errors = await open(page);
  await expect(page.locator('#hSolo')).toBeVisible();
  await page.click('#hSolo');
  await expect(page.locator('#bSolo')).toBeVisible();
  await expect(page.locator('#bHost')).toBeHidden();
  await page.click('#pnlClose');
  await page.click('#hMulti');
  await expect(page.locator('#bHost')).toBeVisible();
  await expect(page.locator('#bSolo')).toBeHidden();
  await page.click('#pnlClose');
  await expect(page.locator('#menu')).toBeHidden();
  expect(await page.evaluate(() => [window.TRACKS.length, window.TEAMS.length])).toEqual([8, 5]);
  expect(errors).toEqual([]);
});

test('a single-player race runs, finishes and shows awards', async ({ page }) => {
  const errors = await open(page);
  await page.click('#hSolo');
  await page.click('#bSolo');
  await page.evaluate(() => {
    window.opts.laps = 1;
    window.wzGo(3);
  });
  await page.click('#bStart');
  const r = await page.evaluate(() => {
    window.opts.steer = 0; // the car steers itself
    window.setupRace(false);
    window.state = 'race';
    const me = window.cars[window.ctrl];
    // a one-button bot: hold the gas below the car's safe speed, lift otherwise (and wait for lights out)
    for (let i = 0; i < 120 * 150 && window.state === 'race'; i++) {
      window.input.thr = window.START.done && me.v < (me.safeV || 0) - 0.2;
      window.step(window.STEP);
    }
    window.input.thr = false;
    for (let i = 0; i < 120 * 6; i++) window.step(window.STEP);
    return {
      state: window.state,
      lap: me.cross,
      best: me.best,
      awards: document.getElementById('resAw')!.children.length,
    };
  });
  expect(r.state).toBe('finished');
  expect(r.best).toBeGreaterThan(40);
  expect(r.best).toBeLessThan(90);
  expect(r.awards).toBeGreaterThan(3);
  expect(errors).toEqual([]);
});

test('practice mode puts only your car on track', async ({ page }) => {
  const errors = await open(page);
  await page.click('#hSolo');
  await page.click('#bPrac');
  await page.evaluate(() => window.wzGo(3));
  await page.click('#bStart');
  expect(await page.evaluate(() => [window.cars.length, window.PRACTICE])).toEqual([1, true]);
  expect(errors).toEqual([]);
});

test('every circuit builds and the AI laps it without leaving the track', async ({ page }) => {
  const errors = await open(page);
  const out = await page.evaluate(() => {
    const res: any[] = [];
    for (let t = 0; t < window.TRACKS.length; t++) {
      window.trackIdx = t;
      window.buildTrack(window.TRACKS[t]);
      window.PRACTICE = true;
      window.opts.steer = 0;
      window.setupRace(false);
      window.state = 'race';
      const me = window.cars[window.ctrl];
      let off = 0;
      for (let i = 0; i < 120 * 130; i++) {
        window.input.thr = window.START.done && me.v < (me.safeV || 0) - 0.2; // one-button bot
        window.step(window.STEP);
        if (me.surf >= 2) off++;
      }
      window.input.thr = false;
      res.push({ id: window.TRACKS[t].id, best: me.best, offSeconds: off / 120 });
    }
    window.PRACTICE = false;
    return res;
  });
  for (const r of out) {
    expect(r.best, r.id).toBeGreaterThan(30);
    expect(r.offSeconds, r.id).toBeLessThan(3);
  }
  expect(errors).toEqual([]);
});

test('the planner drives the car on a ready-made racing line; the line is shown by default', async ({
  page,
}) => {
  const errors = await open(page);
  await page.waitForFunction(() => window.DYNLINES && Object.keys(window.DYNLINES).length > 0);
  const r = await page.evaluate(() => {
    const w = window;
    Object.assign(w.opts, { steer: 0, dynlv: 3, team: 0, rain: 0 });
    w.WX.rain = 0;
    w.PRACTICE = true;
    w.buildTrack(w.TRACKS[1]); // Lone Star
    w.setupRace(false);
    const lineInPractice = w.opts.line;
    w.state = 'race';
    const c = w.cars[w.ctrl];
    let wide = 0,
      planned = 0,
      n = 0;
    // a one-button bot: hold the gas below the car's safe speed, lift otherwise (and wait for lights out)
    for (let i = 0; i < 120 * 150 && c.cross < 3; i++) {
      w.input.thr = w.START.done && c.v < (c.safeV || 0) - 0.2;
      w.step(w.STEP);
      if (c.cross >= 2) {
        n++;
        if (w.dynOn(c)) planned++;
        if (Math.abs(c.lat) > w.HW + 0.45) wide++;
      }
    }
    w.input.thr = false;
    const lap = c.last;
    w.PRACTICE = false;
    w.setupRace(false);
    return {
      level: w.DYN && w.DYN.ready ? w.DYN.name : null,
      lineInPractice,
      lineInRace: w.opts.line,
      lap,
      wide,
      planned: planned / Math.max(1, n),
      aiLines: w.AIL.filter(Boolean).length,
    };
  });
  expect(r.level).toBe('Cautious Expert');
  expect(r.lineInPractice).toBe(1);
  expect(r.lineInRace).toBe(1);
  expect(r.planned).toBe(1); // the planner drove the whole flying lap
  expect(r.wide).toBe(0); // and never left the tarmac
  expect(r.lap).toBeGreaterThan(50);
  expect(r.lap).toBeLessThan(55); // the fixed line laps in about 61 s
  expect(r.aiLines).toBe(5); // every team's AI has its line
  expect(errors).toEqual([]);
});

test('each Passing style commits passes from the back of the grid, and no pass is left hanging', async ({
  page,
}) => {
  const errors = await open(page);
  await page.waitForFunction(() => window.DYNLINES && Object.keys(window.DYNLINES).length > 0);
  const out = await page.evaluate(() => {
    const w = window,
      res: any[] = [];
    for (const mode of [1, 2, 3]) {
      Object.assign(w.opts, { steer: 0, dynlv: 3, team: 0, rain: 0, diff: 2, laps: 3, pass: mode });
      w.WX.rain = 0;
      w.PRACTICE = false;
      w.buildTrack(w.TRACKS[1]); // Lone Star
      w.setupRace(false);
      w.state = 'race';
      const me = w.cars[w.ctrl],
        grid = me.grid,
        b: any = {};
      let cue = 0,
        longest = 0;
      // the one-button bot; with Slingshot it taps the gas (a short lift) as soon as the slingshot is ready
      for (let i = 0; i < 120 * 150 && w.state === 'race'; i++) {
        let hold = w.START.done && me.v < (me.safeV || 0) - 0.2;
        if (w.PS.ready && !(b.tapT > 0) && !b.tapped) {
          b.tapT = 0.12;
          b.tapped = true;
        }
        if (!w.PS.ready) b.tapped = false;
        if (b.tapT > 0) {
          b.tapT -= w.STEP;
          hold = false;
        }
        w.input.thr = hold;
        w.step(w.STEP);
        if (w.PS.cand || w.PS.car) cue++;
        if (w.PS.car) longest = Math.max(longest, w.PS.t);
      }
      w.input.thr = false;
      res.push({ mode, grid, tried: w.PS.n, made: w.PS.ok, cue: cue / 120, longest });
    }
    w.opts.pass = 1;
    return res;
  });
  for (const r of out) {
    expect(r.grid, 'you start last').toBe(9);
    expect(r.cue, 'mode ' + r.mode + ': a cue was shown').toBeGreaterThan(0);
    expect(r.tried, 'mode ' + r.mode + ': passes committed').toBeGreaterThan(0);
    expect(r.longest, 'mode ' + r.mode + ': a committed pass ends').toBeLessThan(6);
  }
  expect(out.reduce((a, r) => a + r.made, 0)).toBeGreaterThan(1);
  expect(errors).toEqual([]);
});
