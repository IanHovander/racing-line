import { test, expect, type Page } from 'playwright/test';

// Passing in Auto steering (src/sim/pass.ts): each of the three ways to ask for a pass, driven with real pointer
// events on the touch pads of a phone-sized page. ?pass= picks the way; the build's own default is swipe.
declare const window: any;

test.use({ viewport: { width: 390, height: 664 }, hasTouch: true, isMobile: true });

async function raceUntilACarIsAhead(page: Page, style: string) {
  const errors: string[] = [];
  page.on('pageerror', e => errors.push(String(e)));
  await page.goto('/?debug&pass=' + style);
  await page.waitForFunction(() => typeof window.wzGo === 'function' && window.N > 0);
  await page.click('#hSolo');
  await page.click('#bSolo');
  await page.evaluate(() => window.wzGo(3));
  await page.click('#bStart');
  const found = await page.evaluate(() => {
    const w = window;
    w.opts.steer = 0;
    w.setupRace(false);
    w.state = 'race';
    w.updatePads();
    const me = w.cars[w.ctrl];
    // start from the back of the (random) grid, so there are cars to pass
    const last = w.cars.reduce((a: any, o: any) => (o.s > 0 && o.s < a.s ? o : a), me);
    if (last !== me)
      for (const k of ['x', 'y', 'h', 'idx', 'lat', 's', 'prevS']) [me[k], last[k]] = [last[k], me[k]];
    // the one-button bot until a car is close ahead with room beside it
    for (let i = 0; i < 120 * 120; i++) {
      w.input.thr = w.START.done && me.v < (me.safeV || 0) - 0.2;
      w.step(w.STEP);
      const o = w.PM.near;
      if (w.raceTime > 4 && o && w.passGap(me, o) < 30 && (w.PM.open[0] || w.PM.open[1])) return true;
    }
    return false;
  });
  // draw a frame so the on-screen direction of the car is known
  await page.evaluate(() => window.render());
  return { errors, found };
}

/** press GAS, move the thumb by (dx, dy) in steps, keep it down */
async function gasDrag(page: Page, to: (r: DOMRect, dir: [number, number]) => [number, number]) {
  await page.evaluate(to_ => {
    const el = document.getElementById('pThr')!,
      r = el.getBoundingClientRect(),
      x0 = r.left + r.width / 2,
      y0 = r.top + r.height / 2;
    const [x1, y1] = new Function('r', 'dir', 'return (' + to_ + ')(r, dir)')(r, window.passLatDir());
    const ev = (type: string, x: number, y: number) =>
      el.dispatchEvent(
        new PointerEvent(type, { pointerId: 7, clientX: x, clientY: y, bubbles: true, pointerType: 'touch' }),
      );
    ev('pointerdown', x0, y0);
    for (let k = 1; k <= 6; k++) ev('pointermove', x0 + ((x1 - x0) * k) / 6, y0 + ((y1 - y0) * k) / 6);
  }, to.toString());
}

for (const style of ['swipe', 'slide', 'tap']) {
  test(`passing by ${style}: the gesture on the pads starts a pass and the car stays on the road`, async ({
    page,
  }) => {
    const { errors, found } = await raceUntilACarIsAhead(page, style);
    expect(found).toBe(true);
    if (style === 'tap') {
      await expect(page.locator('#pPass')).toBeVisible();
      // slide the thumb from GAS up onto PASS
      await gasDrag(page, (_r, _d) => {
        const p = document.getElementById('pPass')!.getBoundingClientRect();
        return [p.left + p.width / 2, p.top + p.height / 2];
      });
    } else {
      await expect(page.locator('#pPass')).toBeHidden();
      // across the car's direction of travel as drawn, towards its right
      await gasDrag(page, (r, d) => [r.left + r.width / 2 + d[0] * 60, r.top + r.height / 2 + d[1] * 60]);
    }
    const r = await page.evaluate(() => {
      const w = window,
        me = w.cars[w.ctrl],
        s0 = { side: w.PM.side, s: w.PM.s, thr: w.input.thr };
      let wide = 0,
        on = 0;
      for (let i = 0; i < 120 * 6; i++) {
        w.input.thr = me.v < (me.safeV || 0) - 0.2;
        w.step(w.STEP);
        if (w.PM.on || w.PM.wait) on++; // pulling out, or waiting in the slipstream for a good moment
        if (Math.abs(me.lat) > w.HW + 0.45) wide++;
      }
      return { ...s0, on, wide, out: me.out };
    });
    if (style === 'slide') expect(r.s).toBeGreaterThan(0.3);
    else expect(r.side).not.toBe(0);
    expect(r.thr).toBe(true); // the thumb on the pads keeps the gas on
    expect(r.on).toBeGreaterThan(0); // the pass took the car over from the planner (or waits for its moment)
    expect(r.wide).toBe(0);
    expect(r.out).toBe(false);
    expect(errors).toEqual([]);
  });
}
