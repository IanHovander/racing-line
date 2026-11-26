// The campaign's two faces, drawn like the game they ship in (clean-line comic): a 64 x 64 inked square with 22%
// corners, flat fills, one uniform ink outline, no modelling, and one red, the mark on Gus's cap.
// Gus animates by swapping brows, eyes and mouth (and a small turn of the head when he doubts you); nothing else moves.
// He wears a stopwatch on a lanyard: the man who lost a title by 0.040 s carries the clock.
import { CREAM, INK, LINE, PAPER, PENCIL, RED, SANS } from './tokens';

export type GusFace = 'stern' | 'doubt' | 'smile' | 'count' | 'blink';
export const GUS_FACES: GusFace[] = ['stern', 'doubt', 'smile', 'count', 'blink'];

const CAP = INK;

const line = (d: string, col: string, w: number) =>
  `<path d="${d}" fill="none" stroke="${col}" stroke-width="${w}" stroke-linecap="round"/>`;
const dot = (x: number, y: number, rx = 1.4, ry = 1.4) =>
  `<ellipse cx="${x}" cy="${y}" rx="${rx}" ry="${ry}" fill="${CAP}"/>`;

/** What each face changes: brows, eyes, mouth (under the moustache), and a tilt of the head. */
const FACE: Record<GusFace, { brows: string; eyes: string; mouth: string; tilt?: number }> = {
  // symmetric: brows driven down to the middle, the mouth a flat line
  stern: {
    brows: line('M22 28.5l8 2.4M42 28.5l-8 2.4', CAP, 2.6),
    eyes: dot(26.5, 33.5) + dot(37.5, 33.5),
    mouth: line('M28.6 43.4h6.8', CAP, 1.6),
  },
  // one brow high, the mouth pulled to one side, the head turned a little
  doubt: {
    brows: line('M22 29.6l8 1.2M34 26.6l8-1.8', CAP, 2.6),
    eyes: dot(26.5, 33.7, 1.4, 1.1) + dot(37.5, 33.3, 1.4, 1.6),
    mouth: line('M28.4 43.8l7.6-1.4', CAP, 1.6),
    tilt: -4,
  },
  // the almost-smile: level brows, narrowed eyes, ONE corner of the mouth up
  smile: {
    brows: line('M22 29.4h8M34 29.4h8', CAP, 2.6),
    eyes: dot(26.5, 33.8, 1.5, 0.85) + dot(37.5, 33.8, 1.5, 0.85),
    mouth: line('M28.4 43.4h5.4c1 0 1.9-.5 2.6-1.6', CAP, 1.6),
  },
  // counting out loud: the mouth open under the moustache
  count: {
    brows: line('M22 28.8l8 1.8M42 28.8l-8 1.8', CAP, 2.6),
    eyes: dot(26.5, 33.5) + dot(37.5, 33.5),
    mouth: `<rect x="28.6" y="41.6" width="6.8" height="3.4" rx="1.7" fill="${CAP}"/>`,
  },
  blink: {
    brows: line('M22 28.5l8 2.4M42 28.5l-8 2.4', CAP, 2.6),
    eyes: line('M25 33.6h3M36 33.6h3', CAP, 1.5),
    mouth: line('M28.6 43.4h6.8', CAP, 1.6),
  },
};

const O = `stroke="${INK}" stroke-width="${LINE}" stroke-linejoin="round"`;
/** the portrait's square, inked */
const FRAME = `<rect x="1" y="1" width="62" height="62" rx="13" fill="none" ${O}/>`;

/** Gus: jacket, the stopwatch he wears on a lanyard (he lost a title by 0.040 s), then his head. */
function gusParts(face: GusFace, framed = true) {
  const f = FACE[face];
  return (
    `<rect width="64" height="64" fill="${CREAM}"/>` +
    // jacket and neck
    `<path d="M6 65c2-12 11-18 26-18s24 6 26 18z" fill="${INK}" ${O}/>` +
    `<rect x="27" y="40" width="10" height="9" fill="${PAPER}" ${O}/>` +
    // the lanyard and the stopwatch at its point: crown, rim, paper face, one ink hand
    `<path d="M25 47l7 5.6 7-5.6" fill="none" stroke="${PAPER}" stroke-width="1.6" stroke-linejoin="round"/>` +
    `<rect x="30.9" y="51.6" width="2.2" height="2" rx=".5" fill="${PAPER}" stroke="${INK}"/>` +
    `<circle cx="32" cy="58.4" r="5.2" fill="${PENCIL}"/>` +
    `<circle cx="32" cy="58.4" r="4" fill="${PAPER}" stroke="${INK}" stroke-width="1"/>` +
    `<path d="M32 58.4l1.9-2.4" stroke="${INK}" stroke-width="1.1" stroke-linecap="round"/>` +
    // the head, turned a little for some faces
    `<g${f.tilt ? ` transform="rotate(${f.tilt} 32 44)"` : ''}>` +
    `<path d="M19 26c0-9 5-13 13-13s13 4 13 13v6c0 8-6 13-13 13s-13-5-13-13z" fill="${PAPER}" ${O}/>` +
    line('M37.8 37.6c.9 1.9 1.1 3.9.5 6', INK, 1) +
    // cap: crown, peak, the red mark
    `<path d="M17 25c0-10 6-16 15-16s15 6 15 16z" fill="${INK}" ${O}/>` +
    `<path d="M17 23h33l6 4H17z" fill="${INK}" ${O}/>` +
    `<rect x="28" y="12" width="8" height="3" rx="1.5" fill="${RED}"/>` +
    // one-ear radio headset and its boom
    `<rect x="13" y="26" width="7" height="11" rx="3.5" fill="${PAPER}" ${O}/>` +
    line('M16 38c0 6 4 8 9.5 8', INK, 1.6) +
    f.brows +
    f.eyes +
    // the moustache: heavy, wider than the mouth, drooping at both ends
    `<path d="M22.6 42.4c.6-3.4 4-5.4 9.4-5.4s8.8 2 9.4 5.4c-.5 1.1-1.5 1.3-2.4.5-1.9-1.6-4.2-2.3-7-2.3s-5.1.7-7 2.3c-.9.8-1.9.6-2.4-.5z" fill="${PENCIL}" stroke="${INK}" stroke-width="1.4" stroke-linejoin="round"/>` +
    f.mouth +
    `</g>` +
    (framed ? FRAME : '')
  );
}

export interface PortraitOpts {
  /** CSS size, e.g. 64 or '100%' (default 64) */
  size?: number | string;
  /** round the corners at 22% (default true) */
  rounded?: boolean;
  /** accessible name */
  label?: string;
  /** draw the portrait's own inked square (default true). Off inside a panel: the panel is its frame. */
  framed?: boolean;
}
function wrap(inner: string, o: PortraitOpts, label: string) {
  const s = o.size ?? 64,
    sz = typeof s === 'number' ? `${s}px` : s;
  const round = o.rounded === false || o.framed === false ? '' : 'border-radius:22%;';
  return `<svg viewBox="0 0 64 64" width="${typeof s === 'number' ? s : 64}" height="${typeof s === 'number' ? s : 64}" style="${round}display:block;width:${sz};height:auto" role="img" aria-label="${o.label || label}">${inner}</svg>`;
}

/** The inside of Gus's portrait (no <svg> wrapper), for nesting in a bigger drawing. */
export function gusBody(face: GusFace = 'stern', framed = true) {
  return gusParts(face, framed);
}
/** Gus Marlow, as an inline SVG string. */
export function gusSVG(face: GusFace = 'stern', o: PortraitOpts = {}) {
  return wrap(gusBody(face, o.framed !== false), o, `Gus, ${face}`);
}

/** The inside of your portrait: helmet on, visor down, your number on the side of the shell. */
export function youBody(num: number | string = 27, framed = true) {
  return (
    `<rect width="64" height="64" fill="${CREAM}"/>` +
    `<path d="M6 65c2-11 11-16 26-16s24 5 26 16z" fill="${PENCIL}" ${O}/>` +
    // shell, visor and its flat sheen at the top left
    `<path d="M12 33c0-13 9-21 21-21s20 8 20 20v6c0 5-3 8-8 8H24c-7 0-12-5-12-13z" fill="${PAPER}" ${O}/>` +
    `<path d="M27 27h26v9c0 2-1 3-3 3H31c-3 0-4-2-4-5z" fill="${INK}" ${O}/>` +
    `<path d="M29.5 29.2h8.5l-1.6 2.3h-6.9z" fill="${PENCIL}"/>` +
    // the red stripe (you wear Gus's colour) and your number on the side of the shell, below it
    `<path d="M12.5 29c6-4 12-5.5 19-5.5" fill="none" stroke="${RED}" stroke-width="3"/>` +
    `<text x="19.5" y="38" text-anchor="middle" font-family="${SANS.replace(/"/g, "'")}" font-size="7.4" font-weight="900" letter-spacing="-.2" style="font-variant-numeric:tabular-nums" fill="${INK}">${String(num).slice(0, 2)}</text>` +
    (framed ? FRAME : '')
  );
}
/** You, as an inline SVG string. */
export function youSVG(num: number | string = 27, o: PortraitOpts = {}) {
  return wrap(youBody(num, o.framed !== false), o, `You, car ${num}`);
}
