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
    window.opts.pedals = 3;
    window.opts.steer = 0; // let the car drive itself
    window.setupRace(false);
    window.state = 'race';
    for (let i = 0; i < 120 * 150 && window.state === 'race'; i++) window.step(window.STEP);
    for (let i = 0; i < 120 * 6; i++) window.step(window.STEP);
    const me = window.cars[window.ctrl];
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
      window.opts.pedals = 3;
      window.opts.steer = 0;
      window.setupRace(false);
      window.state = 'race';
      const me = window.cars[window.ctrl];
      let off = 0;
      for (let i = 0; i < 120 * 130; i++) {
        window.step(window.STEP);
        if (me.surf >= 2) off++;
      }
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
    Object.assign(w.opts, { pedals: 0, steer: 0, dynlv: 3, team: 0, rain: 0 });
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
