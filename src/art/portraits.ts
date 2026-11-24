// The campaign's two faces as flat vector portraits, after the 16 Nov concept: a 64 x 64 square with 22% corners,
// greys lit from the top left (two or three tones a face, no outlines) and one red mark, the stripe on Gus's cap.
// Gus animates by swapping brows and mouth, plus a blink; nothing else moves.
import { GRAPHITE, GRAPHITE_2, GREY, MARK, MONO, PAPER } from './tokens';

export type GusFace = 'stern' | 'doubt' | 'smile' | 'count' | 'blink';
export const GUS_FACES: GusFace[] = ['stern', 'doubt', 'smile', 'count', 'blink'];

const CAP = '#0c0f14';

/** Gus's head and shoulders, without brows and mouth. */
function gusBase(blink: boolean) {
  return (
    `<rect width="64" height="64" fill="${GRAPHITE}"/>` +
    // jacket, the left shoulder catching the light
    `<path d="M6 64c2-12 11-17 26-17s24 5 26 17z" fill="${GRAPHITE_2}"/>` +
    `<path d="M6 64c2-12 11-17 26-17-8 2-14 8-15.5 17z" fill="${GREY.g1}"/>` +
    // neck in the shadow of the jaw, the shirt collar
    `<rect x="27" y="40" width="10" height="10" fill="${GREY.g4}"/>` +
    `<path d="M25 47l7 8 7-8" fill="none" stroke="${PAPER}" stroke-width="2.6" stroke-linejoin="round"/>` +
    // face, with its shaded right side
    `<path d="M19 26c0-9 5-13 13-13s13 4 13 13v6c0 8-6 13-13 13s-13-5-13-13z" fill="${GREY.g6}"/>` +
    `<path d="M38 14.5c4.5 2 7 5.8 7 11.5v6c0 8-6 13-13 13 4.5-2.5 7.5-7 7.5-13v-6c0-5-.5-8.8-1.5-11.5z" fill="${GREY.g4}"/>` +
    // cap: crown, a sheen on its left, the peak, the red mark
    `<path d="M17 25c0-10 6-16 15-16s15 6 15 16z" fill="${CAP}"/>` +
    `<path d="M19.5 22c.5-6.5 4.5-10.5 10.5-11.5-3.8 2.4-6.2 6.2-6.8 11.5z" fill="${GRAPHITE_2}"/>` +
    `<path d="M17 23h33l6 4H17z" fill="${CAP}"/>` +
    `<rect x="28" y="12" width="8" height="3" rx="1.5" fill="${MARK}"/>` +
    // one-ear radio headset and its boom
    `<rect x="13" y="26" width="7" height="11" rx="3.5" fill="${PAPER}"/>` +
    `<rect x="16.5" y="27" width="3.5" height="10" rx="1.75" fill="${GREY.g5}"/>` +
    `<path d="M16 37c0 7 4 9 10 9" fill="none" stroke="${PAPER}" stroke-width="1.6" stroke-linecap="round"/>` +
    // eyes
    (blink
      ? `<path d="M25 33.6h3M36 33.6h3" stroke="${CAP}" stroke-width="1.5" stroke-linecap="round"/>`
      : `<circle cx="26.5" cy="33.5" r="1.4" fill="${CAP}"/><circle cx="37.5" cy="33.5" r="1.4" fill="${CAP}"/>`)
  );
}
const line = (d: string, col: string, w: number) =>
  `<path d="${d}" fill="none" stroke="${col}" stroke-width="${w}" stroke-linecap="round"/>`;
/** brows, then mouth (the grey moustache line is his mouth) */
const FACE: Record<GusFace, string> = {
  stern: line('M22 28.5l8 2.4M42 28.5l-8 2.4', CAP, 2.6) + line('M24 41.5h16', PAPER, 3),
  doubt: line('M22 29.5l8 1.4M34 27.5l8-1.5', CAP, 2.6) + line('M24.5 41.5h15', PAPER, 3),
  smile: line('M22 29.5h8M34 29.5h8', CAP, 2.6) + line('M23.5 39.5c3 3.5 14 3.5 17 0', PAPER, 3.2),
  count:
    line('M22 28.8l8 1.8M42 28.8l-8 1.8', CAP, 2.6) +
    `<rect x="27.5" y="39.2" width="9" height="5.6" rx="2.8" fill="${CAP}"/>` +
    line('M24.5 39h15', PAPER, 2.6),
  blink: line('M22 28.5l8 2.4M42 28.5l-8 2.4', CAP, 2.6) + line('M24 41.5h16', PAPER, 3),
};

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
  return gusBase(face === 'blink') + FACE[face];
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
    `<path d="M29 29h9l-1.6 2.4H29z" fill="${GRAPHITE_2}"/>` +
    // the red stripe, and your number
    `<path d="M12.5 29c6-4 12-5.5 19-5.5" fill="none" stroke="${MARK}" stroke-width="3"/>` +
    `<text x="22" y="21.5" font-family="${MONO.replace(/"/g, "'")}" font-size="7" font-weight="600" fill="${CAP}">${String(num).slice(0, 2)}</text>`
  );
}
/** You, as an inline SVG string. */
export function youSVG(num: number | string = 27, o: PortraitOpts = {}) {
  return wrap(youBody(num), o, `You, car ${num}`);
}
