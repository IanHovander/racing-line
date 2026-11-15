// Each team's car is built differently. Multipliers on the base car:
// top = top speed, acc = acceleration, brk = braking, grip = cornering grip, dur = damage taken
export const TEAM_STATS = [
  {
    top: 1.05,
    acc: 1.02,
    brk: 1.0,
    grip: 0.984,
    dur: 1.0,
    tag: 'Power: fastest on the straights, edgy in the corners',
  },
  {
    top: 1.01,
    acc: 1.01,
    brk: 1.05,
    grip: 1.006,
    dur: 0.85,
    tag: 'All-rounder: no weak spot, toughest chassis',
  },
  {
    top: 0.98,
    acc: 1.0,
    brk: 1.0,
    grip: 1.026,
    dur: 1.1,
    tag: 'Downforce: best in the corners, slow on the straights',
  },
  {
    top: 1.01,
    acc: 1.0,
    brk: 1.36,
    grip: 1.0,
    dur: 1.0,
    tag: 'Late brakers: best stopping power on the grid',
  },
  {
    top: 0.99,
    acc: 1.055,
    brk: 1.0,
    grip: 0.997,
    dur: 1.15,
    tag: 'Traction: rockets out of slow corners',
  },
];
export const NEUTRAL = { top: 1, acc: 1, brk: 1, grip: 1, dur: 1 };
