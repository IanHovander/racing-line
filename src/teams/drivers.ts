// city blocks, a grandstand and harbour yachts for street circuits
// pit building: ten garages (two per team, in team order) facing the grid, with a pit lane in front
export const TEAMS_NAT = [['IE', 'FR'], ['DE', 'NG'], ['SE', 'JP'], ['BR', 'NL'], ['CZ', 'PT']];
// each driver's own character (0..1, 0.5 = average). pace = raw speed, aggr = how hard they attack and how close they follow,
// defend = how often and how quickly they cover a pass, consist = how steady their laps are (low = little mistakes), wet = rain skill, tyre = tyre care
export const DRIVER_STATS = [
  [{ pace: .80, aggr: .75, defend: .60, consist: .55, wet: .60, tyre: .40, tag: 'Fast and fearless, hard on tyres' }, { pace: .65, aggr: .50, defend: .70, consist: .75, wet: .50, tyre: .60, tag: 'Steady team player' }],
  [{ pace: .80, aggr: .45, defend: .65, consist: .90, wet: .70, tyre: .70, tag: 'Metronome — rarely makes a mistake' }, { pace: .70, aggr: .70, defend: .55, consist: .60, wet: .80, tyre: .50, tag: 'Bold overtaker, great in the rain' }],
  [{ pace: .75, aggr: .35, defend: .50, consist: .80, wet: .90, tyre: .65, tag: 'Clean and calm, rain master' }, { pace: .70, aggr: .60, defend: .80, consist: .70, wet: .55, tyre: .75, tag: 'Tough to pass, kind to tyres' }],
  [{ pace: .75, aggr: .85, defend: .70, consist: .50, wet: .85, tyre: .45, tag: 'All-out attacker, thrives in the wet' }, { pace: .70, aggr: .65, defend: .90, consist: .65, wet: .60, tyre: .55, tag: 'The wall — defends everything' }],
  [{ pace: .60, aggr: .40, defend: .45, consist: .85, wet: .50, tyre: .85, tag: 'Tyre whisperer, long-run specialist' }, { pace: .65, aggr: .80, defend: .55, consist: .45, wet: .65, tyre: .50, tag: 'Wild card — brilliant or in the wall' }]
];
export const DRV = (c) => (DRIVER_STATS[c.team] || [])[c.drv] || { pace: .5, aggr: .5, defend: .5, consist: .5, wet: .5, tyre: .5 };
