// The campaign's two faces as flat vector portraits, after the 16 Nov concept: a 64 x 64 square with 22% corners,
// greys lit from the top left (two or three tones a face, no outlines) and one red mark, the stripe on Gus's cap.
// Gus animates by swapping brows, eyes and mouth (and a small turn of the head when he doubts you); nothing else moves.
// He wears a stopwatch on a lanyard: the man who lost a title by 0.040 s carries the clock.
import { GRAPHITE, GRAPHITE_2, GREY, MARK, MONO, PAPER, STEEL } from './tokens';

export type GusFace = 'stern' | 'doubt' | 'smile' | 'count' | 'blink';
export const GUS_FACES: GusFace[] = ['stern', 'doubt', 'smile', 'count', 'blink'];

const CAP = '#0c0f14';

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

/** Gus: jacket, the stopwatch he wears on a lanyard (he lost a title by 0.040 s), then his head. */
function gusParts(face: GusFace) {
  const f = FACE[face];
  return (
    `<rect width="64" height="64" fill="${GRAPHITE}"/>` +
    // jacket, the left shoulder catching the light
    `<path d="M6 64c2-12 11-17 26-17s24 5 26 17z" fill="${GRAPHITE_2}"/>` +
    `<path d="M6 64c2-12 11-17 26-17-8 2-14 8-15.5 17z" fill="${GREY.g1}"/>` +
    // neck in the shadow of the jaw
    `<rect x="27" y="40" width="10" height="10" fill="${GREY.g4}"/>` +
    // the lanyard and the stopwatch at its point: steel rim, crown, paper face, one hand
    `<path d="M25 46.5l7 6.2 7-6.2" fill="none" stroke="${PAPER}" stroke-width="1.6" stroke-linejoin="round"/>` +
    `<rect x="31" y="52" width="2" height="1.8" rx=".4" fill="${STEEL}"/>` +
    `<circle cx="32" cy="58.4" r="5" fill="${STEEL}"/>` +
    `<circle cx="31.7" cy="58.1" r="4" fill="${PAPER}"/>` +
    `<path d="M31.8 58.3l1.9-2.4" stroke="${CAP}" stroke-width="1" stroke-linecap="round"/>` +
    // the head, turned a little for some faces
    `<g${f.tilt ? ` transform="rotate(${f.tilt} 32 44)"` : ''}>` +
    // face with its shaded right side, and one age crease from the nose down beside the mouth, in the shadow
    `<path d="M19 26c0-9 5-13 13-13s13 4 13 13v6c0 8-6 13-13 13s-13-5-13-13z" fill="${GREY.g6}"/>` +
    `<path d="M38 14.5c4.5 2 7 5.8 7 11.5v6c0 8-6 13-13 13 4.5-2.5 7.5-7 7.5-13v-6c0-5-.5-8.8-1.5-11.5z" fill="${GREY.g4}"/>` +
    line('M37.6 37.6c.9 1.9 1.1 3.9.5 6', STEEL, 1) +
    // cap: crown, a sheen on its left, the peak, the red mark
    `<path d="M17 25c0-10 6-16 15-16s15 6 15 16z" fill="${CAP}"/>` +
    `<path d="M19.5 22c.5-6.5 4.5-10.5 10.5-11.5-3.8 2.4-6.2 6.2-6.8 11.5z" fill="${GRAPHITE_2}"/>` +
    `<path d="M17 23h33l6 4H17z" fill="${CAP}"/>` +
    `<rect x="28" y="12" width="8" height="3" rx="1.5" fill="${MARK}"/>` +
    // one-ear radio headset and its boom
    `<rect x="13" y="26" width="7" height="11" rx="3.5" fill="${PAPER}"/>` +
    `<rect x="16.5" y="27" width="3.5" height="10" rx="1.75" fill="${GREY.g5}"/>` +
    `<path d="M16 37c0 7 4 9 10 9" fill="none" stroke="${PAPER}" stroke-width="1.6" stroke-linecap="round"/>` +
    f.brows +
    f.eyes +
    // the moustache: heavy, steel, wider than the mouth, drooping at both ends
    `<path d="M22.6 42.4c.6-3.4 4-5.4 9.4-5.4s8.8 2 9.4 5.4c-.5 1.1-1.5 1.3-2.4.5-1.9-1.6-4.2-2.3-7-2.3s-5.1.7-7 2.3c-.9.8-1.9.6-2.4-.5z" fill="${STEEL}"/>` +
    f.mouth +
    `</g>`
  );
}

export interface PortraitOpts {
  /** CSS size, e.g. 64 or '100%' (default 64) */
  size?: number | string;
  /** round the corners at 22% (default true) */
  rounded?: boolean;
  /** accessible name */
  label?: string;
}
function wrap(inner: string, o: PortraitOpts, label: string) {
  const s = o.size ?? 64,
    sz = typeof s === 'number' ? `${s}px` : s;
  const round = o.rounded === false ? '' : 'border-radius:22%;';
  return `<svg viewBox="0 0 64 64" width="${typeof s === 'number' ? s : 64}" height="${typeof s === 'number' ? s : 64}" style="${round}display:block;width:${sz};height:auto" role="img" aria-label="${o.label || label}">${inner}</svg>`;
}

/** The inside of Gus's portrait (no <svg> wrapper), for nesting in a bigger drawing. */
export function gusBody(face: GusFace = 'stern') {
  return gusParts(face);
}
/** Gus Marlow, as an inline SVG string. */
export function gusSVG(face: GusFace = 'stern', o: PortraitOpts = {}) {
  return wrap(gusBody(face), o, `Gus, ${face}`);
}

/** The inside of your portrait: helmet on, visor down, your number on the shell. */
export function youBody(num: number | string = 27) {
  return (
    `<rect width="64" height="64" fill="${GRAPHITE}"/>` +
    `<path d="M6 64c2-11 11-15 26-15s24 4 26 15z" fill="${GRAPHITE_2}"/>` +
    `<path d="M6 64c2-11 11-15 26-15-8 1.8-14 7-15.5 15z" fill="${GREY.g1}"/>` +
    // shell, its lower right in shadow
    `<path d="M12 33c0-13 9-21 21-21s20 8 20 20v6c0 5-3 8-8 8H24c-7 0-12-5-12-13z" fill="${PAPER}"/>` +
    `<path d="M13.5 40c2 3.8 5.6 6 10.5 6h21c5 0 8-3 8-8v-4c-.3 4.4-3 7-7.4 7H24c-4.6 0-8.2-.4-10.5-1z" fill="${GREY.g5}"/>` +
    // visor with a sheen at its top left
    `<path d="M27 27h26v9c0 2-1 3-3 3H31c-3 0-4-2-4-5z" fill="${CAP}"/>` +
    `<path d="M29 29h9l-1.6 2.4H29z" fill="${GREY.g1}"/>` +
    // the red stripe (you wear Gus's colour) and your number on the side of the shell, below it
    `<path d="M12.5 29c6-4 12-5.5 19-5.5" fill="none" stroke="${MARK}" stroke-width="3"/>` +
    `<text x="19.5" y="38" text-anchor="middle" font-family="${MONO.replace(/"/g, "'")}" font-size="7" font-weight="600" fill="${CAP}">${String(num).slice(0, 2)}</text>`
  );
}
/** You, as an inline SVG string. */
export function youSVG(num: number | string = 27, o: PortraitOpts = {}) {
  return wrap(youBody(num), o, `You, car ${num}`);
}
