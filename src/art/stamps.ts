// Circuit stamps: a postage stamp for each circuit, its real shape drawn in a white stroke on ink from the circuit's
// own control points (the same spline the game builds the track from), the circuit's name in Geist Mono caps.
// Collect them as the campaign moves from circuit to circuit. One not reached yet shows its shape in steel on graphite,
// a tease, with "ROUND n" in place of the name until you arrive.
//   stampSVG(T, n, locked)   T is a circuit from TRACKS (name, cp, sc, smooth), n its chapter number.
import { GRAPHITE, GRAPHITE_2, INK, MONO, PAPER, STEEL } from './tokens';

interface CircuitLike {
  id?: string;
  name: string;
  cp: number[][];
  sc?: number;
  smooth?: number;
}

/** the circuit's centreline as points (Catmull-Rom through the control points, then smoothed like buildTrack) */
export function circuitPoints(T: CircuitLike, perSeg = 10) {
  const sc = T.sc || 1,
    P = T.cp.map(p => [p[0] * sc, p[1] * sc]),
    n = P.length,
    out: number[][] = [];
  for (let i = 0; i < n; i++) {
    const p0 = P[(i - 1 + n) % n],
      p1 = P[i],
      p2 = P[(i + 1) % n],
      p3 = P[(i + 2) % n];
    for (let k = 0; k < perSeg; k++) {
      const t = k / perSeg,
        t2 = t * t,
        t3 = t2 * t;
      const f = (a: number, b: number, c: number, d: number) =>
        0.5 * (2 * b + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (-a + 3 * b - 3 * c + d) * t3);
      out.push([f(p0[0], p1[0], p2[0], p3[0]), f(p0[1], p1[1], p2[1], p3[1])]);
    }
  }
  let pts = out;
  for (let it = 0; it < Math.ceil((T.smooth || 40) / 12); it++) {
    const m = pts.length;
    pts = pts.map((p, i) => {
      const a = pts[(i - 1 + m) % m],
        b = pts[(i + 1) % m];
      return [p[0] * 0.5 + (a[0] + b[0]) * 0.25, p[1] * 0.5 + (a[1] + b[1]) * 0.25];
    });
  }
  return pts;
}

/** The centreline as an SVG path fitted into a box, with the start line's position and heading. */
export function circuitPath(T: CircuitLike, x: number, y: number, w: number, h: number) {
  const pts = circuitPoints(T);
  let x0 = Infinity,
    y0 = Infinity,
    x1 = -Infinity,
    y1 = -Infinity;
  for (const [px, py] of pts) {
    x0 = Math.min(x0, px);
    x1 = Math.max(x1, px);
    y0 = Math.min(y0, py);
    y1 = Math.max(y1, py);
  }
  const k = Math.min(w / (x1 - x0), h / (y1 - y0)),
    ox = x + (w - (x1 - x0) * k) / 2 - x0 * k,
    oy = y + (h - (y1 - y0) * k) / 2 - y0 * k;
  const at = (p: number[]) => [+(p[0] * k + ox).toFixed(2), +(p[1] * k + oy).toFixed(2)];
  const d = 'M' + pts.map(p => at(p).join(' ')).join('L') + 'Z';
  const s0 = at(pts[0]),
    s1 = at(pts[1]);
  return { d, start: s0, dir: Math.atan2(s1[1] - s0[1], s1[0] - s0[0]) };
}

const mono = MONO.replace(/"/g, "'");
let uid = 0;
export function stampSVG(T: CircuitLike, n = 1, locked = false, size: number | string = 96) {
  const W = 64,
    H = 80,
    id = 'stp' + ++uid,
    sz = typeof size === 'number' ? size + 'px' : size;
  const { d, start, dir } = circuitPath(T, 11, 17, W - 22, 38);
  // the perforations: half-circles bitten out of every edge
  let holes = '';
  for (let x = 4; x < W; x += 6)
    holes += `<circle cx="${x}" cy="0" r="1.8"/><circle cx="${x}" cy="${H}" r="1.8"/>`;
  for (let y = 4; y < H; y += 6)
    holes += `<circle cx="0" cy="${y}" r="1.8"/><circle cx="${W}" cy="${y}" r="1.8"/>`;
  const name = locked ? `ROUND ${n}` : T.name.normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase();
  // Geist Mono is about 0.6 em a character: shrink a long name to fit
  const fs = Math.min(6.4, (W - 12) / (0.62 * name.length));
  const nx = Math.cos(dir + Math.PI / 2) * 3.2,
    ny = Math.sin(dir + Math.PI / 2) * 3.2;
  return (
    `<svg viewBox="0 0 ${W} ${H}" style="display:block;width:${sz};height:auto" role="img" aria-label="${locked ? 'Circuit not reached yet' : T.name}, chapter ${n}">` +
    `<mask id="${id}"><rect width="${W}" height="${H}" fill="#fff"/><g fill="#000">${holes}</g></mask>` +
    `<g mask="url(#${id})">` +
    `<rect width="${W}" height="${H}" fill="${locked ? GRAPHITE : INK}"/>` +
    `<rect x="4.5" y="4.5" width="${W - 9}" height="${H - 9}" rx="1.5" fill="none" stroke="${GRAPHITE_2}"/>` +
    `<text x="9" y="13" font-family="${mono}" font-size="5.6" letter-spacing=".6" fill="${STEEL}">${String(n).padStart(2, '0')}</text>` +
    `<path d="${d}" fill="none" stroke="${locked ? STEEL : PAPER}" stroke-width="2.2" stroke-linejoin="round"${locked ? ' opacity=".35"' : ''}/>` +
    (locked
      ? ''
      : `<path d="M${(start[0] - nx).toFixed(2)} ${(start[1] - ny).toFixed(2)}L${(start[0] + nx).toFixed(2)} ${(start[1] + ny).toFixed(2)}" stroke="${PAPER}" stroke-width="1.4"/>`) +
    `<text x="${W / 2}" y="${H - 11}" text-anchor="middle" font-family="${mono}" font-weight="600" font-size="${fs.toFixed(2)}" letter-spacing=".3" fill="${locked ? STEEL : PAPER}">${name}</text>` +
    `</g></svg>`
  );
}
