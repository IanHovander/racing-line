// Hand-drawn sprites: a palette (one letter per colour) and a grid of letters, one per pixel, '.' for see-through.
// Change a letter to change a pixel. A palette entry can name a livery slot instead of a colour ('@body', '@helmet',
// ...) so one drawing serves every team. Expressions and other variants are patches: rows of letters laid over the
// base at a column, where '_' keeps the pixel underneath.
import { Painter } from './pixel';
import type { Livery } from './palette';

export interface Grid {
  w: number;
  h: number;
  pal: Record<string, string>;
  rows: string[];
}
/** Rows as one template string (blank lines and surrounding spaces are ignored). Every row must be the same width. */
export function grid(pal: Record<string, string>, src: string, name = 'grid'): Grid {
  const rows = src
    .split('\n')
    .map(r => r.trim())
    .filter(Boolean);
  const w = rows[0].length;
  for (const r of rows)
    if (r.length !== w) throw new Error(`${name}: row "${r}" is ${r.length} wide, not ${w}`);
  return { w, h: rows.length, pal, rows };
}

/** rows to overwrite: row index -> [first column, letters] */
export type Patch = Record<number, [number, string]>;

function colourOf(g: Grid, ch: string, look?: Partial<Livery> & Record<string, any>) {
  const v = g.pal[ch];
  if (!v) throw new Error(`no colour for "${ch}"`);
  if (v[0] !== '@') return v;
  return (look && look[v.slice(1)]) || '#ff00ff';
}
/** Paint a grid at (x, y), with a livery for its slots, optional patches, and mirrored if flip. */
export function paintGrid(
  p: Painter,
  g: Grid,
  x: number,
  y: number,
  look?: Partial<Livery> & Record<string, any>,
  patches: Patch[] = [],
  flip = false,
) {
  const rows = g.rows.slice();
  for (const patch of patches)
    for (const k in patch) {
      const [col, s] = patch[k],
        r = rows[+k].split('');
      for (let i = 0; i < s.length; i++) if (s[i] !== '_') r[col + i] = s[i];
      rows[+k] = r.join('');
    }
  for (let j = 0; j < g.h; j++)
    for (let i = 0; i < g.w; i++) {
      const ch = rows[j][flip ? g.w - 1 - i : i];
      if (ch !== '.') p.px(x + i, y + j, colourOf(g, ch, look));
    }
}
