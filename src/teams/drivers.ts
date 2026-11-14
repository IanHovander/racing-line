// city blocks, a grandstand and harbour yachts for street circuits
// pit building: ten garages (two per team, in team order) facing the grid, with a pit lane in front
export const TEAMS_NAT = [
  ['IE', 'FR'],
  ['DE', 'NG'],
  ['SE', 'JP'],
  ['BR', 'NL'],
  ['CZ', 'PT'],
];
// each driver's own character (0..1, 0.5 = average). pace = raw speed, aggr = how hard they attack and how close they follow,
// defend = how often and how quickly they cover a pass, consist = how steady their laps are (low = little mistakes), wet = rain skill, tyre = tyre care
export const DRIVER_STATS = [
  [
    {
      pace: 0.8,
      aggr: 0.75,
      defend: 0.6,
      consist: 0.55,
      wet: 0.6,
      tyre: 0.4,
      tag: 'Fast and fearless, hard on tyres',
    },
    { pace: 0.65, aggr: 0.5, defend: 0.7, consist: 0.75, wet: 0.5, tyre: 0.6, tag: 'Steady team player' },
  ],
  [
    {
      pace: 0.8,
      aggr: 0.45,
      defend: 0.65,
      consist: 0.9,
      wet: 0.7,
      tyre: 0.7,
      tag: 'Metronome — rarely makes a mistake',
    },
    {
      pace: 0.7,
      aggr: 0.7,
      defend: 0.55,
      consist: 0.6,
      wet: 0.8,
      tyre: 0.5,
      tag: 'Bold overtaker, great in the rain',
    },
  ],
  [
    {
      pace: 0.75,
      aggr: 0.35,
      defend: 0.5,
      consist: 0.8,
      wet: 0.9,
      tyre: 0.65,
      tag: 'Clean and calm, rain master',
    },
    {
      pace: 0.7,
      aggr: 0.6,
      defend: 0.8,
      consist: 0.7,
      wet: 0.55,
      tyre: 0.75,
      tag: 'Tough to pass, kind to tyres',
    },
  ],
  [
    {
      pace: 0.75,
      aggr: 0.85,
      defend: 0.7,
      consist: 0.5,
      wet: 0.85,
      tyre: 0.45,
      tag: 'All-out attacker, thrives in the wet',
    },
    {
      pace: 0.7,
      aggr: 0.65,
      defend: 0.9,
      consist: 0.65,
      wet: 0.6,
      tyre: 0.55,
      tag: 'The wall — defends everything',
    },
  ],
  [
    {
      pace: 0.6,
      aggr: 0.4,
      defend: 0.45,
      consist: 0.85,
      wet: 0.5,
      tyre: 0.85,
      tag: 'Tyre whisperer, long-run specialist',
    },
    {
      pace: 0.65,
      aggr: 0.8,
      defend: 0.55,
      consist: 0.45,
      wet: 0.65,
      tyre: 0.5,
      tag: 'Wild card — brilliant or in the wall',
    },
  ],
];
export const DRV = c =>
  (DRIVER_STATS[c.team] || [])[c.drv] || {
    pace: 0.5,
    aggr: 0.5,
    defend: 0.5,
    consist: 0.5,
    wet: 0.5,
    tyre: 0.5,
  };
