// Exposes every game binding (add new modules to the imports and MODS below) on window (get + set) for the browser console and the Playwright tests: open the game with ?debug.
import { GS } from './state';
import * as m0 from './core/dom';
import * as m1 from './track/circuits';
import * as m2 from './sim/car-model';
import * as m3 from './track/track';
import * as m4 from './teams/team-stats';
import * as m5 from './sim/profile';
import * as m6 from './track/build';
import * as m7 from './teams/drivers';
import * as m8 from './track/city';
import * as m9 from './track/active';
import * as m10 from './teams/teams';
import * as m11 from './game/race';
import * as m12 from './input/input';
import * as m13 from './ui/controls';
import * as m14 from './sim/ai';
import * as m15 from './sim/player';
import * as m16 from './sim/physics';
import * as m17 from './sim/timing';
import * as m18 from './sim/step';
import * as m19 from './render/camera';
import * as m20 from './render/primitives';
import * as m21 from './render/car';
import * as m22 from './render/scenery';
import * as m23 from './render/trackside';
import * as m24 from './render/effects';
import * as m26 from './render/buildings';
import * as m27 from './render/render';
import * as m28 from './ui/hud';
import * as m29 from './ui/feedback';
import * as m30 from './ui/results';
import * as m31 from './audio/audio';
import * as m32 from './audio/crowd';
import * as m33 from './audio/music';
import * as m34 from './audio/mixer';
import * as m35 from './vendor/qrlib';
import * as m36 from './net/qr';
import * as m37 from './net/multiplayer';
import * as m38 from './net/lobby';
import * as m39 from './net/netcode';
import * as m40 from './ui/widgets';
import * as m41 from './ui/circuits';
import * as m42 from './ui/posters';
import * as m43 from './ui/circuit-map';
import * as m44 from './ui/menu';
import * as m45 from './ui/wizard';
import * as m46 from './game/loop';

import * as m47 from './sim/start';
import * as m48 from './ui/home';

const MODS: any[] = [
  m47,
  m48,
  m0,
  m1,
  m2,
  m3,
  m4,
  m5,
  m6,
  m7,
  m8,
  m9,
  m10,
  m11,
  m12,
  m13,
  m14,
  m15,
  m16,
  m17,
  m18,
  m19,
  m20,
  m21,
  m22,
  m23,
  m24,
 
  m26,
  m27,
  m28,
  m29,
  m30,
  m31,
  m32,
  m33,
  m34,
  m35,
  m36,
  m37,
  m38,
  m39,
  m40,
  m41,
  m42,
  m43,
  m44,
  m45,
  m46,
];
export function installDebug(): void {
  const w = window as any;
  for (const k of Object.keys(GS))
    def(
      k,
      () => (GS as any)[k],
      v => {
        (GS as any)[k] = v;
      },
    );
  [
    'HW',
    'seed',
    'cpIdx',
    'STAD',
    'BRIDGE',
    'WHEEL',
    'SPHERE',
    'FOUNT',
    'DRSZ',
    'DRSMAP',
    'CORNERS',
    'CMAP',
    'SECI',
    'SECB',
    'SB',
    'NEXTC',
    'BARR',
    'BARL',
    'SIDES',
    'PIT_SIDE',
    'TR',
    'N',
    'L',
    'SEG',
    'cx',
    'cy',
    'tx',
    'ty',
    'nx',
    'ny',
    'ccurv',
    'BAR',
    'kerb',
    'gside',
    'gout',
    'off',
    'rx',
    'ry',
    'rk',
    'vf',
    'zone',
    'boxes',
    'trees',
    'STONES',
    'MM',
    'TSX',
    'TSY',
    'NSX',
    'NSY',
    'PWR',
    'PWL',
    'SWR',
    'SWL',
    'GINA',
    'FLAGPOLES',
    'PITLANE',
    'minX',
    'minY',
    'maxX',
    'maxY',
    'WATER',
    'TUN',
    'LIGHTS',
    'HT',
    'SL',
    'HG',
    'PZONE',
    'trackIdx',
    'PRACTICE',
    'RES_T',
    'LAPC_T',
    'ctrl',
    'mateIdx',
    'state',
    'raceTime',
    'cdT',
    'finishTimer',
    'finishOrder',
    'SWAP',
    'HITS',
    'LANE_SEL',
    'PASS',
    'STAT_T',
    'PAIRS',
    'PZ',
    'cS',
    'cC',
    'OX',
    'OY',
    'CARSCR',
    'CARDEP',
    'AHEAD',
    'HMUL',
    'FB_T',
    'FB_LAST',
    'musStep',
    'musNext',
    'cheerT',
    'sqg',
    'sqf',
    'NICK',
  ].forEach((k: string) =>
    def(
      k,
      () => (GS as any)[k],
      v => {
        (GS as any)[k] = v;
      },
    ),
  );
  for (const m of MODS)
    for (const k of Object.keys(m)) {
      if (k === 'init' || k === '__set') continue;
      def(
        k,
        () => m[k],
        v => {
          if (m.__set) m.__set(k, v);
        },
      );
    }
  function def(k: string, get: () => any, set: (v: any) => void) {
    try {
      Object.defineProperty(w, k, { get, set, configurable: true });
    } catch (e) {
      /* unforgeable window property */
    }
  }
}
