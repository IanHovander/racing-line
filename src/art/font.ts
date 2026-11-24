// A 5 x 7 pixel font for words inside sprites and scenes (the logo, a licence card, PASS!). Capitals, digits and a
// little punctuation; lower case is drawn as capitals. Each glyph is seven rows, '#' for ink; glyphs are as wide as
// their rows, with one pixel between letters. Text outside the pixel art stays in Geist, the game's font.
import type { Painter } from './pixel';

const G: Record<string, string> = {
  A: '.###./#...#/#...#/#####/#...#/#...#/#...#',
  B: '####./#...#/#...#/####./#...#/#...#/####.',
  C: '.###./#...#/#..../#..../#..../#...#/.###.',
  D: '####./#...#/#...#/#...#/#...#/#...#/####.',
  E: '#####/#..../#..../####./#..../#..../#####',
  F: '#####/#..../#..../####./#..../#..../#....',
  G: '.###./#...#/#..../#.###/#...#/#...#/.####',
  H: '#...#/#...#/#...#/#####/#...#/#...#/#...#',
  I: '###/.#./.#./.#./.#./.#./###',
  J: '..###/...#./...#./...#./#..#./#..#./.##..',
  K: '#...#/#..#./#.#../##.../#.#../#..#./#...#',
  L: '#..../#..../#..../#..../#..../#..../#####',
  M: '#...#/##.##/#.#.#/#.#.#/#...#/#...#/#...#',
  N: '#...#/#...#/##..#/#.#.#/#..##/#...#/#...#',
  O: '.###./#...#/#...#/#...#/#...#/#...#/.###.',
  P: '####./#...#/#...#/####./#..../#..../#....',
  Q: '.###./#...#/#...#/#...#/#.#.#/#..#./.##.#',
  R: '####./#...#/#...#/####./#.#../#..#./#...#',
  S: '.####/#..../#..../.###./....#/....#/####.',
  T: '#####/..#../..#../..#../..#../..#../..#..',
  U: '#...#/#...#/#...#/#...#/#...#/#...#/.###.',
  V: '#...#/#...#/#...#/#...#/#...#/.#.#./..#..',
  W: '#...#/#...#/#...#/#.#.#/#.#.#/#.#.#/.#.#.',
  X: '#...#/#...#/.#.#./..#../.#.#./#...#/#...#',
  Y: '#...#/#...#/.#.#./..#../..#../..#../..#..',
  Z: '#####/....#/...#./..#../.#.../#..../#####',
  '0': '.###./#...#/#..##/#.#.#/##..#/#...#/.###.',
  '1': '.#./##./.#./.#./.#./.#./###',
  '2': '.###./#...#/....#/...#./..#../.#.../#####',
  '3': '####./....#/....#/.###./....#/....#/####.',
  '4': '...#./..##./.#.#./#..#./#####/...#./...#.',
  '5': '#####/#..../####./....#/....#/#...#/.###.',
  '6': '.###./#..../#..../####./#...#/#...#/.###.',
  '7': '#####/....#/...#./..#../.#.../.#.../.#...',
  '8': '.###./#...#/#...#/.###./#...#/#...#/.###.',
  '9': '.###./#...#/#...#/.####/....#/....#/.###.',
  ' ': '.../.../.../.../.../.../...',
  '.': './././././././#',
  ',': '../../../../../.#/#.',
  '!': '#/#/#/#/#/./#',
  '?': '.###./#...#/....#/...#./..#../...../..#..',
  "'": '#/#/./././././.',
  '-': '.../.../.../###/.../.../...',
  ':': '././#/././#/.',
  '/': '....#/...#./...#./..#../.#.../.#.../#....',
  '+': '...../..#../..#../#####/..#../..#../.....',
  '%': '##..#/##.#./...#./..#../.#.../.#.##/#..##',
  '>': '...../..#../...#./#####/...#./..#../.....',
  '<': '...../..#../.#.../#####/.#.../..#../.....',
  '(': '.#/#./#./#./#./#./.#',
  ')': '#./.#/.#/.#/.#/.#/#.',
  '*': './././#/./././.',
  '#': '.#.#./#####/.#.#./.#.#./.#.#./#####/.#.#.',
};
const GLYPHS: Record<string, string[]> = {};
function glyph(ch: string) {
  const k = G[ch] ? ch : G[ch.toUpperCase()] ? ch.toUpperCase() : '?';
  return (GLYPHS[k] ||= G[k].split('/'));
}

export interface TextOpts {
  /** each font pixel drawn as an s x s block */
  scale?: number;
  /** extra pixels between letters (at scale 1) */
  spacing?: number;
  /** colour by font row (0..6), for gradients like the logo's */
  fillAt?: (row: number) => string;
  /** a ring of this colour round every letter */
  outline?: string;
  /** a drop shadow this many pixels down and right */
  shadow?: [string, number];
}
/** Width of a line of text in pixels. */
export function measure(s: string, o: TextOpts = {}) {
  const sc = o.scale || 1,
    sp = o.spacing ?? 1;
  let w = 0;
  for (const ch of s) w += (glyph(ch)[0].length + sp) * sc;
  return Math.max(0, w - sp * sc);
}
export const FONT_H = 7;

/** Draw text with its top-left at (x, y). Returns the width drawn. */
export function text(p: Painter, s: string, x: number, y: number, color: string, o: TextOpts = {}) {
  const sc = o.scale || 1,
    sp = o.spacing ?? 1;
  const pass = (dx: number, dy: number, col: string | null, fat: number) => {
    let cx = x;
    for (const ch of s) {
      const g = glyph(ch);
      for (let r = 0; r < 7; r++)
        for (let c = 0; c < g[r].length; c++)
          if (g[r][c] === '#')
            p.rect(
              cx + c * sc + dx - fat,
              y + r * sc + dy - fat,
              sc + 2 * fat,
              sc + 2 * fat,
              col || o.fillAt(r),
            );
      cx += (g[0].length + sp) * sc;
    }
  };
  if (o.shadow) pass(o.shadow[1], o.shadow[1], o.shadow[0], o.outline ? 1 : 0);
  if (o.outline) pass(0, 0, o.outline, 1);
  pass(0, 0, o.fillAt ? null : color, 0);
  return measure(s, o);
}
