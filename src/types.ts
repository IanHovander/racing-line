// Shared shapes for the game's main objects. Known fields are typed; the index signature
// keeps room for the per-feature fields that get added at runtime (timing, coaching, net state…).

export interface TeamStats {
  top: number;
  acc: number;
  brk: number;
  grip: number;
  dur: number;
  [k: string]: any;
}

export interface Car {
  st: TeamStats;
  team: number;
  drv: number;
  name: string;
  nat: string | null;
  col: string;
  acc: string;
  x: number;
  y: number;
  h: number;
  v: number;
  idx: number;
  lat: number;
  s: number;
  prevS: number;
  hz?: number;
  lane: number;
  cross: number;
  lapStart: number;
  last: number;
  best: number;
  finished: boolean;
  ftime: number;
  place: number;
  pen: number;
  out: boolean;
  outT: number;
  gone: boolean;
  dmg: number;
  gm: number;
  tow: number;
  ghost: number;
  stuckT: number;
  thr: number;
  brk: number;
  steer: number;
  slide: number;
  surf: number;
  sk: any[];
  grid: number;
  number: number;
  skill: number;
  mine: boolean;
  human?: boolean;
  remote?: boolean;
  owner?: string;
  [k: string]: any;
}

/** A building, stand, garage or other extruded box of scenery */
export interface Box {
  pts: number[][];
  h: number;
  top: string;
  side: string;
  crowd?: boolean;
  tall?: boolean;
  cx?: number;
  cy?: number;
  [k: string]: any;
}

export interface Tree {
  x: number;
  y: number;
  hz: number;
  r: number;
  h: number;
  c: number;
  palm?: boolean;
  pine?: number;
  sak?: number;
}

/** Multiplayer session state */
export interface MPState {
  api: any;
  room: any;
  code: string | null;
  host: boolean;
  me: string | null;
  peers: any[];
  phase: string;
  lastStart: string | null;
  sendT: number;
  unsub: any;
  rules?: Record<string, number>;
  full?: boolean;
  jt?: number;
  p2p?: boolean;
  hostOff?: number;
  /** round-trip time to each peer, ms (minimum seen, drifting up slowly), measured by echoing timestamps */
  rtt?: Record<string, number>;
  /** last presence timestamp received from each peer (their clock) and when it arrived (ours) */
  rx?: Record<string, { ts: number; at: number }>;
  [k: string]: any;
}

/** A procedural music theme: called once per 16th step */
export interface Theme {
  bpm: number;
  swing?: number;
  play(step: number, t: number): void;
  [k: string]: any;
}
