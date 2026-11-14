// Race starts are about timing: the cars sit on the grid until the driver reacts to lights out.
//  - Your car launches when you press the throttle after the lights go out (or tap / press any key
//    in pedal modes without a GAS pad). Reaction time sets the launch: under 0.2 s is a perfect
//    start (extra traction for 2 s), under 0.35 s a good one, slower than 0.6 s a slow one.
//  - Holding the throttle as the lights go out is a jump start: +5 s (a warning in practice).
//  - If you don't react within 3 s the car goes anyway (a slow start), so nobody is stuck.
//  - AI cars react after 0.12–0.55 s, quicker for consistent drivers.
import { GS } from '../state';
import { attract, cars, opts } from '../game/race';
import { input } from '../input/input';
import { DRV } from '../teams/drivers';
import { feedback } from '../ui/feedback';
import { rcBanner } from '../ui/controls';

/** a tap or key press since lights out (used as the launch input when there's no GAS pad) */
export const START = { tap: false, jump: false, done: false };

/** pedal modes with a throttle the player works themselves */
const usesThrottle = () => opts.pedals === 0 || opts.pedals === 2;

/** called once, at lights out */
export function lightsOut(): void {
  START.tap = false;
  START.jump = false;
  if (attract) return;
  const c = cars[GS.ctrl];
  if (!c || c.remote) return;
  if (input.thr) {
    // anticipated the lights
    START.jump = true;
    launch(c, null);
    if (GS.PRACTICE) rcBanner('warn', 'JUMP START', 'Throttle before lights out — no penalty in practice');
    else {
      c.pen = (c.pen || 0) + 5;
      rcBanner('pen', '+5 SEC', 'JUMP START — throttle before lights out');
    }
  }
}

function launch(c, reaction: number | null): void {
  c.launched = true;
  c.reaction = reaction;
  c.launchBoost = 1;
  c.boostT = 0;
  if (reaction === null || c !== cars[GS.ctrl]) return;
  const r = reaction.toFixed(2);
  if (reaction < 0.2) {
    c.launchBoost = 1.15;
    c.boostT = 2;
    feedback(`Perfect start — ${r} s reaction`, '#c77dff');
  } else if (reaction < 0.35) {
    c.launchBoost = 1.07;
    c.boostT = 2;
    feedback(`Good start — ${r} s reaction`, '#2ecc71');
  } else if (reaction < 0.6) feedback(`${r} s reaction`, '#ffd60a');
  else feedback(`Slow start — ${r} s reaction`, '#ff8a3d');
}

/**
 * Is this car allowed to drive yet? Call each step during the race for cars this browser simulates.
 * Returns false while the car must stay on the grid.
 */
export function launchGate(c, isPlayer: boolean): boolean {
  if (c.launched || attract) return true;
  if (GS.raceTime > 8) {
    c.launched = true;
    return true;
  } // joined late, swapped cars, etc.
  if (isPlayer) {
    const go = input.thr || (!usesThrottle() && START.tap);
    if (go || GS.raceTime > 3) launch(c, GS.raceTime);
    return !!c.launched;
  }
  if (c.react === undefined) c.react = 0.12 + Math.random() * 0.23 + (1 - DRV(c).consist) * 0.2;
  if (GS.raceTime >= c.react) launch(c, GS.raceTime);
  return !!c.launched;
}

/** text under the start lights */
export function startHint(): string {
  return usesThrottle() ? 'Hit the GAS when the lights go out' : 'Tap when the lights go out';
}
