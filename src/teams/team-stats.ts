// Each team's car is built differently. Multipliers on the base car:
// top = top speed, acc = acceleration, brk = braking, grip = cornering grip, tyre = tyre wear rate, dur = damage taken
export const TEAM_STATS = [
  { top: 1.05, acc: 1.02, brk: 1.0, grip: 0.984, tyre: 1.12, dur: 1.0, tag: 'Power: fastest on the straights, hard on its tyres' },
  { top: 1.01, acc: 1.01, brk: 1.05, grip: 1.006, tyre: 1.0, dur: 0.85, tag: 'All-rounder: no weak spot, toughest chassis' },
  { top: 0.98, acc: 1.0, brk: 1.0, grip: 1.026, tyre: 1.05, dur: 1.1, tag: 'Downforce: best in the corners, slow on the straights' },
  { top: 1.01, acc: 1.0, brk: 1.36, grip: 1.0, tyre: 0.75, dur: 1.0, tag: 'Late brakers: best stopping power, kindest to tyres' },
  { top: 0.99, acc: 1.055, brk: 1.0, grip: 0.997, tyre: 1.0, dur: 1.15, tag: 'Traction: rockets out of slow corners' }
];
export const NEUTRAL = { top: 1, acc: 1, brk: 1, grip: 1, tyre: 1, dur: 1 };
