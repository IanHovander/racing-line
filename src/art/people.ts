// The campaign's two faces, drawn by hand (see grid.ts for the format). 32 x 32, facing you.
//   Gus Marlow, the coach: team cap with the red mark, a one-ear radio headset, grey moustache, pit jacket.
//   You: helmet on, visor down, in your team's suit. The helmet and suit take the livery's colours.
import { C } from './palette';
import { grid, paintGrid, type Patch } from './grid';
import { paint, type Art } from './pixel';
import { ROOKIE, type Livery } from './palette';

export const GUS = grid(
  {
    k: C.ink,
    C: '#2a3646',
    c: '#3f5064',
    b: '#161d27',
    R: C.red,
    r: C.red1,
    S: C.skin0,
    s: C.skin1,
    d: C.skin2,
    D: C.skin3,
    g: '#9aa0a8',
    G: '#d5d8dc',
    B: '#5f646c',
    W: '#f6f7f9',
    E: '#1a1412',
    M: '#5a2a22',
    m: '#a5473a',
    J: '#2b3440',
    j: '#1a2029',
    L: '#3d4856',
    H: '#15181d',
    h: '#4a5059',
    X: C.grey0,
  },
  `
  ................................
  ................................
  ...........kkkkkkkkkk...........
  .........kkCCCCCCCCCCkk.........
  ........kCcCCCCRRCCCCCCk........
  .......kCcCCCCCRrCCCCCCk........
  .......kcCCCCCCCCCCCCCCk........
  ......kbbbbbbbbbbbbbbbbbbk......
  .......kkkkkkkkkkkkkkkkkk.......
  .......kkgDDDDDDDDDDDDgk........
  ......khHgSBBBSSSSBBBSgk........
  ......khHgSSSSBssBSSSSgkk.......
  ......khHSSWEESddSEEWSSsdk......
  ......khHSSsssSddSsssSSddk......
  ......khHsSSSSSSdSSSSSskk.......
  .......kHsSSSSdDDdSSSSsk........
  ........kHSSgGGggGGgSSsk........
  ........ksHXSdMMMMdSSSsk........
  ........kssSdSSSSSSdSssk........
  .........kdsSSSSSSSSsdk.........
  ..........kddssSSssddk..........
  ...........kkddddddkk...........
  ............kDDDDDDk............
  .......kkkkkkWDDDDWkkkkkk.......
  .....kJJJJJJJWWDDWWJJJJJJJk.....
  ....kJJJJJJJJLWjjWLJJJJJJJJk....
  ...kJJJJJJJJJLWjjWLJJJJJJJJJk...
  ..kJJJJJJJJJJLWjjWLJJJJJJJJJJk..
  .kJJJJJJJJJJJjLjjLjJJJJJJJJJJJk.
  .kjJJJJJJJJJJjLjjLjJJJJJJJJJJjk.
  kjjJJJJJJJJJJjLRRLjJJJJJJJJJJjjk
  kjjjJJJJJJJJJjLRRLjJJJJJJJJJjjjk
`,
  'gus',
);

/** Gus's faces. Each is a patch over the eyes, brows and mouth (columns 9 to 22). */
export const GUS_FACES: Record<string, Patch> = {
  stern: {},
  doubt: {
    10: [9, 'gSSSSSSSSBBBSg'],
    11: [9, 'gSBBBBssSSSSSg'],
    12: [9, 'SSdEESddSWEEWS'],
    13: [9, 'SSsssSddSssssS'],
    17: [9, 's__SSMMMMMSSSs'],
  },
  smile: {
    10: [9, 'gSBBBSSSSBBBSg'],
    11: [9, 'gSSSSSssSSSSSg'],
    13: [9, 'SdsssSddSsssdS'],
    17: [9, 's__MSSSSSSMSSs'],
    18: [9, 'ssSSMMMMMMSSss'],
  },
  shout: {
    10: [9, 'gSBBSSSSSSBBSg'],
    11: [9, 'gSSSBBssBBSSSg'],
    16: [9, '_SSgGGGGGGgSSs'],
    17: [9, 's__MMMMMMMMSSs'],
    18: [9, 'ssSMmmmmmmMSss'],
    19: [9, '_dsSMMMMMMSsd_'],
  },
  blink: { 12: [9, 'SSEEESddSEEESS'] },
};
export type GusFace = 'stern' | 'doubt' | 'smile' | 'shout' | 'blink';

export const YOU = grid(
  {
    k: C.ink,
    '1': '@helmet',
    '2': '@accent',
    h: '@helmetLight',
    V: '#151a24',
    v: '#3a4a66',
    w: '#9fd2ff',
    '3': '@body',
    '4': '@bodyDark',
    '5': '#2b2f36',
    W: '#f2f4f7',
  },
  `
  ................................
  ................................
  ...........kkkkkkkkkk...........
  .........kk1111221111kk.........
  ........k1hh11122111111k........
  .......k1h11111221111111k.......
  ......k1h1111112211111111k......
  ......k1h1111112211111111k......
  .....k11111111122111111111k.....
  .....k11kkkkkkkkkkkkkkkk11k.....
  .....k1kVwwVVVVVVVVVVVVVk1k.....
  .....k1kVVwVVVVVVVVVVVVVk1k.....
  .....k1kvVVVVVVVVVVVVVVvk1k.....
  .....k11kkkkkkkkkkkkkkkk11k.....
  .....k11111111111111111111k.....
  .....k111111kkkkkkkk111111k.....
  ......k111111111111111111k......
  .......k1111111111111111k.......
  ........kkkkkkkkkkkkkkkk........
  ......kk5555555555555555kk......
  ....kk33555555555555555533kk....
  ...k333335555555555555533333k...
  ..k33333333355555555333333333k..
  .k3333333333335555333333333333k.
  .k3323333333334444333333333233k.
  k333233333333334433333333332333k
  k333233333333334433333333332333k
  k33323333333334WW43333333332333k
  k33323333333334WW43333333332333k
  k33323333333334WW43333333332333k
  k33323333333334WW43333333332333k
  k33323333333334WW43333333332333k
`,
  'you',
);

/** Gus with a face: 'stern' (the default), 'doubt' (one eyebrow up), 'smile' (rare), 'shout' (counting), 'blink'. */
export function gus(face: GusFace = 'stern'): Art {
  return paint('gus:' + face, 32, 32, p => paintGrid(p, GUS, 0, 0, undefined, [GUS_FACES[face]]), 16, 32);
}
/** You, in a livery (defaults to the rookie's red and yellow). */
export function you(look: Livery = ROOKIE): Art {
  return paint(
    'you:' + look.body + look.accent + look.helmet,
    32,
    32,
    p => paintGrid(p, YOU, 0, 0, look),
    16,
    32,
  );
}
