import { START } from '../sim/start';
import type { Car } from '../types';
import { GS } from '../state';
import { H, W, clamp, store } from '../core/dom';
import { MP } from '../net/multiplayer';
import { ISO_A, cam } from '../render/camera';
import { FW } from '../render/effects';
import { flagFrames, flagImg } from '../render/scenery';
import { renderLaneInd } from '../sim/ai';
import { dynPrepare, lineLoad } from '../sim/lines';
import { locate } from '../sim/physics';
import { TEAM_STATS } from '../teams/team-stats';
import { TEAMS } from '../teams/teams';
import { parts, skids } from '../track/active';
import { clearNotes } from '../ui/notify';
export let opts: any;
export let cars = [],
  attract = true,
  goAt = 0;
GS.PRACTICE = false;
GS.RES_T = 0;
GS.ctrl = 0;
GS.mateIdx = 1;
GS.state = 'menu';
GS.raceTime = 0;
GS.cdT = 0;
GS.finishTimer = -1;
GS.finishOrder = 0;
export function prewarmFlags() {
  const base = clamp(Math.min(W, H) / 68, 4.6, 11);
  for (const f of GS.FLAGPOLES) {
    const im = flagImg(f.code);
    if (!im) continue;
    for (const m of [0.8, 0.9, 1.0, 1.12]) {
      const fw = Math.max(14, base * m * 2.7) * (f.big ? 3 : 1);
      flagFrames(f.code, im, Math.round(Math.pow(2, Math.round(Math.log2(fw) * 3) / 3)));
    }
  }
}
export function setupRace(isAttract, mpGrid?) {
  START.done = false;
  setTimeout(prewarmFlags, 30);
  GS.LANE_SEL = 0;
  GS.SWAP = null;
  FW.on = false;
  FW.p.length = 0;
  {
    const f = document.getElementById('fwc') as HTMLCanvasElement;
    if (f) f.getContext('2d').clearRect(0, 0, W, H);
  }
  GS.SB = [0, 0, 0];
  GS.PASS = { side: 0, car: null, t: 0, armed: 0 };
  setTimeout(renderLaneInd, 0);
  attract = isAttract;
  cars = [];
  GS.PAIRS = new Map();
  GS.STAT_T = 0;
  GS.FB_LAST = -99;
  clearNotes();
  skids.length = 0;
  parts.length = 0;
  GS.raceTime = 0;
  GS.finishOrder = 0;
  GS.finishTimer = -1;
  const base = [0.9, 0.955, 1.0][opts.diff];
  const others = [0, 1, 2, 3, 4].filter(t => isAttract || t !== opts.team);
  const order = [];
  if (isAttract) {
    for (const t of others) order.push([t, 0], [t, 1]);
  } else if (mpGrid) {
    for (const e of mpGrid) order.push([e.t, e.d]);
  } else if (GS.PRACTICE) order.push([opts.team, 0]);
  else {
    for (const t of [...others, opts.team]) order.push([t, 0], [t, 1]);
  }
  // random starting grid every race (online races keep the host's grid)
  if (!mpGrid)
    for (let i = order.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [order[i], order[j]] = [order[j], order[i]];
    }
  order.forEach(([t, d], g) => {
    const sDist = GS.L - 10 - g * 7.5;
    let idx = Math.round(sDist / GS.SEG) % GS.N;
    const lat = g % 2 ? 2.8 : -2.8;
    const c: Car = {
      st: TEAM_STATS[t],
      dmg: 0,
      gm: 1,
      out: false,
      outT: 0,
      gone: false,
      pen: 0,
      yel: null,
      tow: 0,
      ghost: 0,
      stuckT: 0,
      x: GS.cx[idx] + GS.nx[idx] * lat,
      y: GS.cy[idx] + GS.ny[idx] * lat,
      h: Math.atan2(GS.ty[idx], GS.tx[idx]),
      v: 0,
      idx,
      lat,
      s: idx * GS.SEG,
      prevS: idx * GS.SEG,
      team: t,
      drv: d,
      nat: TEAMS[t].nat[d],
      name: TEAMS[t].drivers[d],
      col: TEAMS[t].col,
      acc: TEAMS[t].acc,
      mine: !isAttract && t === opts.team,
      skill: clamp(base + (Math.random() - 0.5) * 0.014, 0.8, 0.995),
      lane: 0,
      cross: 0,
      lapStart: 0,
      last: 0,
      best: 0,
      finished: false,
      ftime: 0,
      place: 0,
      slide: 0,
      surf: 0,
      thr: 0,
      brk: 0,
      steer: 0,
      sk: [null, null],
      grid: g,
      number: t * 2 + d + 1,
    };
    if (c.mine) c.skill = base - 0.01;
    if (mpGrid) {
      const e = mpGrid[g];
      c.human = !!e.p;
      c.owner = e.owner;
      c.remote = e.owner !== MP.me;
      c.mine = e.p === MP.me;
      if (c.human) {
        c.name = e.n || 'Driver';
        c.nat = null;
      }
      c.number = g + 1;
    }
    locate(c);
    cars.push(c);
  });
  if (mpGrid) {
    GS.ctrl = Math.max(
      0,
      cars.findIndex(c => c.mine),
    );
    GS.mateIdx = -1;
  } else {
    GS.ctrl = cars.findIndex(c => c.mine && c.drv === 0);
    GS.mateIdx = cars.findIndex(c => c.mine && c.drv === 1);
  }
  if (isAttract) GS.PRACTICE = false;
  dynPrepare(); // racing lines for this circuit, weather, Opponents level and the car you drive (now that the grid is known)
  lineLoad(); // whether the line is drawn: practice and races each remember their own choice
  if (isAttract) {
    GS.ctrl = 0;
    GS.state = 'menu';
  } else {
    GS.state = 'countdown';
    GS.cdT = 0;
    goAt = mpGrid ? 6 : 5.2 + Math.random() * 1.3;
  }
  const cc = cars[Math.max(0, GS.ctrl)];
  cam.x = cc.x;
  cam.y = cc.y;
  cam.a = ISO_A;
}
export function init(): void {
  opts = {
    steer: store.get('defv4', 0) ? store.get('steer', 0) : (store.set('steer', 0), 0),
    team: store.get('team', 0),
    laps: store.get('laps', 5),
    diff: store.get('diff', 1),
    /** the racing line on screen: 0 hidden, 1 shown, 2 difficult turns only. Set by lineLoad() for practice or races */
    line: 0,
    /** the line you follow: 0 classic, 1..4 Novice / Intermediate / Cautious Expert / Perfect Expert (sim/lines.ts) */
    dynlv: clamp(store.get('dynlv', 3) | 0, 0, 4),
    crowd: store.get('crowd', 1),
    rain: store.get('rain', 0),
    damage: store.get('damage', 0),
    yellow: store.get('yellow', 10),
    limits: store.get('limits', 0),
    drs: store.get('defv4', 0) ? store.get('drs', 2) : (store.set('drs', 2), 2),
    /** slipstream strength: 0 off, 1 normal, up to 5 (5× as strong) */
    tow: clamp(+store.get('tow', 1) || 0, 0, 5),
    /** how much DRS adds: 1 normal, up to 5 (turning DRS off is opts.drs) */
    drsPow: clamp(+store.get('drsPow', 1) || 1, 1, 5),
    turns: store.get('turns', 1),
    gears: store.get('defv4', 0) ? store.get('gears', 0) : (store.set('gears', 0), store.set('defv4', 1), 0),
    sound: store.get('sound', true),
    music: store.get('music', true),
  };
}
/** debug/test hook: reassign a module-level binding */
export function __set(name: string, v: any): void {
  switch (name) {
    case 'opts':
      opts = v;
      break;
    case 'cars':
      cars = v;
      break;
    case 'attract':
      attract = v;
      break;
    case 'goAt':
      goAt = v;
      break;
  }
}
