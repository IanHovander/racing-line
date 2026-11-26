import { test, expect, type Page } from 'playwright/test';

// The opening titles (src/intro/). Automated browsers skip them unless the address asks with ?intro (or ?at=,
// which freezes one moment of them), so the other tests start on the main screen as before.
declare const window: any;

const SPB = 60 / 112;

async function open(page: Page, query: string) {
  const errors: string[] = [];
  page.on('pageerror', e => errors.push(String(e)));
  await page.goto('/?debug' + query);
  await page.waitForFunction(() => typeof window.wzGo === 'function' && window.N > 0 && !!window.INTRO);
  return errors;
}
const homeShown = (page: Page) =>
  page.evaluate(() => {
    const h = document.getElementById('home')!;
    return {
      intro: h.classList.contains('intro'),
      buttons: getComputedStyle(h.querySelector('.hBot')!).opacity,
      logo: getComputedStyle(h.querySelector('.hLogo')!).opacity,
    };
  });

test('automated browsers go straight to the main screen', async ({ page }) => {
  const errors = await open(page, '');
  expect(await page.evaluate(() => window.INTRO.state)).toBe('off');
  await expect(page.locator('#hSolo')).toBeVisible();
  expect(await homeShown(page)).toEqual({ intro: false, buttons: '1', logo: '1' });
  expect(errors).toEqual([]);
});

test('a tap starts the intro, a tap skips to the title, and the main screen comes up', async ({ page }) => {
  const errors = await open(page, '&intro');
  expect(await page.evaluate(() => window.INTRO.state)).toBe('boot');
  expect((await homeShown(page)).intro).toBe(true);
  await page.mouse.click(200, 300);
  await page.waitForFunction(() => window.INTRO.state === 'play' && window.INTRO.B > 1);
  // the cars wait on the grid for the lights
  expect(await page.evaluate(() => window.cars.every((c: any) => c.v === 0))).toBe(true);
  await page.mouse.click(200, 300);
  await page.waitForFunction(() => window.INTRO.B > 35);
  // the title plays to its end (8 beats) and hands over to the main screen
  await page.waitForFunction(() => window.INTRO.state === 'off', null, { timeout: 10_000 });
  expect(await homeShown(page)).toEqual({ intro: false, buttons: '1', logo: '1' });
  expect(await page.evaluate(() => [window.state, window.attract])).toEqual(['menu', true]);
  await page.click('#hSolo');
  await expect(page.locator('#bSolo')).toBeVisible();
  expect(errors).toEqual([]);
});

test('every shot of the intro draws, and films the same race every time', async ({ page }) => {
  const seen: any[] = [];
  for (const beat of [1, 5, 9, 13, 16, 20, 25, 30, 34, 37, 42]) {
    const errors = await open(page, `&at=${beat * SPB}`);
    await page.waitForFunction(b => Math.abs(window.INTRO.B - b) < 1e-6, beat);
    await page.waitForTimeout(100);
    const s = await page.evaluate(() => ({
      state: window.INTRO.state,
      picks: Object.keys(window.INTRO.picks).sort(),
      cars: window.cars.map((c: any) => [Math.round(c.x * 100), Math.round(c.y * 100)]),
    }));
    expect(s.state).toBe('play');
    expect(errors).toEqual([]);
    seen.push([beat, s]);
  }
  const picks = Object.fromEntries(seen.map(([b, s]) => [b, s.picks]));
  expect(picks[20]).toEqual(['leader']);
  expect(picks[30]).toEqual(['battle', 'leader', 'line']);
  // on the grid until lights out at beat 12, racing after
  const grid = seen.find(([b]) => b === 1)[1].cars;
  expect(seen.find(([b]) => b === 9)[1].cars).toEqual(grid);
  expect(seen.find(([b]) => b === 16)[1].cars).not.toEqual(grid);
  // the same moment twice: the same race
  await open(page, `&at=${25 * SPB}`);
  await page.waitForFunction(() => window.INTRO.B > 24);
  const again = await page.evaluate(() =>
    window.cars.map((c: any) => [Math.round(c.x * 100), Math.round(c.y * 100)]),
  );
  expect(again).toEqual(seen.find(([b]) => b === 25)[1].cars);
});

test('Settings plays the intro again, and it can be turned off', async ({ page }) => {
  const errors = await open(page, '');
  await page.click('#hPrefs');
  await page.click('#sIntro button[data-v="0"]');
  expect(await page.evaluate(() => window.opts.intro)).toBe(0);
  await page.click('#bIntro');
  expect(await page.evaluate(() => window.INTRO.state)).toBe('play');
  await expect(page.locator('#menu')).toBeHidden();
  await page.keyboard.press('Space'); // to the title
  await page.keyboard.press('Space'); // and past it
  expect(await page.evaluate(() => window.INTRO.state)).toBe('off');
  expect(await homeShown(page)).toEqual({ intro: false, buttons: '1', logo: '1' });
  expect(errors).toEqual([]);
});
