import { test, expect, type Page } from 'playwright/test';

// The intro (src/intro/) plays over the game on index.html?intro. On localhost it never plays by itself, so the other
// tests see the home screen as before.
declare const window: any;

const BEAT = 60 / 112;
const OUT = 39 * BEAT; // lights out
const END = 44 * BEAT; // the home screen

async function open(page: Page, query: string) {
  const errors: string[] = [];
  page.on('pageerror', e => errors.push(String(e)));
  await page.goto('/?' + query);
  await page.waitForFunction(() => window.__intro && window.__intro.state() !== undefined);
  return errors;
}
/** distinct colours in a coarse sample of the game canvas: a blank or one-colour frame has very few */
async function canvasColours(page: Page) {
  return page.evaluate(() => {
    const c = document.getElementById('c') as HTMLCanvasElement,
      d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data,
      seen = new Set<number>();
    for (let i = 0; i < d.length; i += 4 * 97) seen.add((d[i] << 16) | (d[i + 1] << 8) | d[i + 2]);
    return seen.size;
  });
}

test('the home screen is untouched without ?intro on localhost', async ({ page }) => {
  await page.goto('/');
  await page.waitForFunction(() => document.getElementById('hSolo')?.offsetParent !== null);
  expect(await page.evaluate(() => document.documentElement.classList.contains('intro'))).toBe(false);
  expect(await page.evaluate(() => !!document.getElementById('intro'))).toBe(false);
});

test('frozen frames render each beat', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', e => errors.push(String(e)));
  const beats: [number, string | null][] = [
    [2.9, '.iTower'],
    [3.8, '.iHero'],
    [7.2, null], // the dawn car at Turn 1
    [11.5, '.iLift .power'],
    [16, '.iGus'],
    [19, '.iYou'],
    [OUT + 1, null], // lights out, in colour
  ];
  for (const [t, sel] of beats) {
    await page.goto(`/?intro&mute&at=${t}`);
    await page.waitForFunction(() => window.__intro?.state() === 'play');
    await page.waitForTimeout(250);
    if (sel) await expect(page.locator('#intro ' + sel)).toBeVisible();
    else expect(await canvasColours(page)).toBeGreaterThan(40);
    expect(await page.evaluate(() => window.__intro.time())).toBeCloseTo(t, 5);
  }
  // before lights out the world is graded as an inked page; after, in colour
  await page.goto('/?intro&mute&at=7');
  await page.waitForFunction(() => window.__intro?.state() === 'play');
  await page.waitForTimeout(100);
  expect(await page.evaluate(() => document.getElementById('c').style.filter)).toContain('grayscale(1)');
  expect(errors).toEqual([]);
});

test('it plays in real time to the home screen and is remembered', async ({ page }) => {
  test.setTimeout(90_000);
  const errors = await open(page, 'intro&mute');
  await page.waitForFunction(() => window.__intro.state() === 'play');
  const t0 = Date.now();
  await page.waitForFunction(() => window.__intro.state() === 'done', null, { timeout: 60_000 });
  const took = (Date.now() - t0) / 1000;
  expect(took).toBeGreaterThan(END - 2);
  expect(took).toBeLessThan(END + 6);
  await expect(page.locator('#hSolo')).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.className)).not.toContain('intro');
  expect(await page.evaluate(() => document.getElementById('c').style.filter)).toBe('');
  expect(await page.evaluate(() => localStorage.getItem('hcgp_introSeen'))).toBe('1');
  expect(await page.evaluate(() => window.cars.length)).toBe(10);
  expect(errors).toEqual([]);
});

test('a tap starts it, a tap skips to lights out, a tap goes home', async ({ page }) => {
  const errors = await open(page, 'intro');
  expect(await page.evaluate(() => window.__intro.state())).toBe('invite');
  await expect(page.locator('#intro .iTap')).toBeVisible();
  await page.click('#intro');
  await page.waitForFunction(() => window.__intro.state() === 'play');
  await page.waitForTimeout(1300);
  await page.click('#intro'); // the first tap after the start may only wake the sound
  await page.waitForTimeout(100);
  if ((await page.evaluate(() => window.__intro.time())) < OUT) await page.click('#intro');
  await page.waitForFunction(o => window.__intro.time() >= o, OUT);
  await page.click('#intro');
  await page.waitForFunction(() => window.__intro.state() === 'done');
  await expect(page.locator('#hSolo')).toBeVisible();
  expect(errors).toEqual([]);
});
