import { test, expect, type Page } from 'playwright/test';

// The game exposes its state on window when served from localhost (see src/debug.ts),
// so the tests can drive the simulation directly instead of waiting for real time.
declare const window: any;

async function open(page: Page) {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.goto('/?debug');
  await page.waitForFunction(() => typeof window.wzGo === 'function' && window.N > 0);
  return errors;
}

test('menu loads with every circuit and team', async ({ page }) => {
  const errors = await open(page);
  await expect(page.locator('#bSolo')).toBeVisible();
  expect(await page.evaluate(() => [window.TRACKS.length, window.TEAMS.length])).toEqual([8, 5]);
  expect(errors).toEqual([]);
});

test('a single-player race runs, finishes and shows awards', async ({ page }) => {
  const errors = await open(page);
  await page.evaluate(() => { window.WZ.mode = 'solo'; window.opts.laps = 1; window.wzGo(3); });
  await page.click('#bStart');
  const r = await page.evaluate(() => {
    window.opts.pedals = 3; window.opts.steer = 0;          // let the car drive itself
    window.setupRace(false); window.state = 'race';
    for (let i = 0; i < 120 * 150 && window.state === 'race'; i++) window.step(window.STEP);
    for (let i = 0; i < 120 * 6; i++) window.step(window.STEP);
    const me = window.cars[window.ctrl];
    return { state: window.state, lap: me.cross, best: me.best, awards: document.getElementById('resAw')!.children.length };
  });
  expect(r.state).toBe('finished');
  expect(r.best).toBeGreaterThan(40);
  expect(r.best).toBeLessThan(90);
  expect(r.awards).toBeGreaterThan(3);
  expect(errors).toEqual([]);
});

test('practice mode puts only your car on track', async ({ page }) => {
  const errors = await open(page);
  await page.evaluate(() => { window.wzMode('practice'); window.wzGo(3); });
  await page.click('#bStart');
  expect(await page.evaluate(() => [window.cars.length, window.PRACTICE])).toEqual([1, true]);
  expect(errors).toEqual([]);
});

test('every circuit builds and the AI laps it without leaving the track', async ({ page }) => {
  const errors = await open(page);
  const out = await page.evaluate(() => {
    const res: any[] = [];
    for (let t = 0; t < window.TRACKS.length; t++) {
      window.trackIdx = t; window.buildTrack(window.TRACKS[t]); window.PRACTICE = true;
      window.opts.pedals = 3; window.opts.steer = 0; window.setupRace(false); window.state = 'race';
      const me = window.cars[window.ctrl]; let off = 0;
      for (let i = 0; i < 120 * 130; i++) { window.step(window.STEP); if (me.surf >= 2) off++; }
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
