import { GS } from '../state';
import { clamp } from '../core/dom';
import { attract, cars, opts } from '../game/race';
GS.HW = 7;
export const WALL = 34,
  DS = 2,
  GIN = 3.5;
// 8-speed gearbox: top speed of each gear (m/s). Automatic picks the best gear; manual is up to you.
export const GEARTOP = [0, 20, 31, 42, 53, 64, 75, 86, 97];
export const autoGear = v => {
  for (let g = 1; g < 8; g++) if (v < GEARTOP[g] * 0.97) return g;
  return 8;
};
// engine pull in a gear: full from half revs up to the limiter, weaker when lugging, nothing on the limiter (1st gear slips the clutch)
export const gearEff = (g, v) => {
  const r = v / GEARTOP[g];
  if (r >= 1) return 0;
  if (g === 1) return 1;
  return clamp(1.75 * r - 0.05, 0.2, 1);
};
export const isManual = c => opts.gears === 1 && !attract && c === cars[GS.ctrl] && !c.remote;
export const VMAX = 92,
  VCAP = 88,
  GRIP = 34,
  GPROF = GRIP * 0.975,
  BRK = 42,
  BPROF = 40;
export const accelAt = v => 13 * Math.max(0, 1 - (v / VMAX) ** 2);
