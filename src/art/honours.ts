// What the campaign hands out, inked like the rest of the story layer: drill medals and your licence.
//   medalSVG(tier, mark)  no painted metals: tier 1 is paper with an ink rim, 2 cream with a pencil rim, 3 wash with no
//                         rim. The mark is the timing error it was won with (0.08 / 0.12 / 0.20) in Geist 900. Only
//                         the top medal carries red: a thin ring in Gus's colour, the one time he hands it to you.
//   licenceSVG(o)         your licence card: portrait, grade, name and car number, one red mark, and a strip of
//                         circuit stamps along the bottom, so it reads like a passport stamped at each circuit.
import { youBody } from './portraits';
import { circuitPath } from './stamps';
import { CREAM, INK, LINE, PAPER, PENCIL, RED, SANS, WASH } from './tokens';

export type Tier = 1 | 2 | 3;
const q = (s: string) => s.replace(/"/g, "'");
const O = (w = LINE) => `stroke="${INK}" stroke-width="${w}" stroke-linejoin="round"`;

export function medalSVG(
  tier: Tier = 1,
  mark = ['', '0.08', '0.12', '0.20'][tier],
  size: number | string = 48,
) {
  const fs = mark.length > 2 ? 9.5 : 16;
  // below 40 px the numeral can't be read: tone and rim carry the tier there
  const small = typeof size === 'number' && size < 40;
  const sz = typeof size === 'number' ? size + 'px' : size;
  // the rim band that tells the tiers apart (paper: ink, cream: pencil, wash: none), then the face
  const rim = tier === 1 ? INK : tier === 2 ? PENCIL : null;
  const face = tier === 1 ? PAPER : tier === 2 ? CREAM : WASH;
  return (
    `<svg viewBox="0 0 48 64" style="display:block;width:${sz};height:auto" role="img" aria-label="Medal, tier ${tier}, ${mark}">` +
    // the ribbon: two inked straps
    `<path d="M9 1h12l6 29h-9z" fill="${PENCIL}" ${O(1.6)}/>` +
    `<path d="M27 1h12l-9 29h-9z" fill="${WASH}" ${O(1.6)}/>` +
    (rim
      ? `<circle cx="24" cy="44" r="18" fill="${rim}" ${O()}/><circle cx="24" cy="44" r="14.8" fill="${face}" ${O(1.2)}/>`
      : `<circle cx="24" cy="44" r="18" fill="${face}" ${O()}/>`) +
    // Gus's red, on the top medal only
    (tier === 1 ? `<circle cx="24" cy="44" r="12.6" fill="none" stroke="${RED}" stroke-width="1.2"/>` : '') +
    (small
      ? ''
      : `<text x="24" y="47.8" text-anchor="middle" font-family="${q(SANS)}" font-weight="900" font-size="${fs}" letter-spacing="-.3" style="font-variant-numeric:tabular-nums" fill="${INK}">${mark}</text>`) +
    `</svg>`
  );
}

interface CircuitLike {
  name: string;
  cp: number[][];
  sc?: number;
  smooth?: number;
}
export interface LicenceOpts {
  grade?: string;
  name?: string;
  num?: number | string;
  size?: number | string;
  /** the campaign's circuits in order, for the passport strip along the bottom */
  circuits?: CircuitLike[];
  /** how many of them you've reached (their stamps are white; the rest are steel silhouettes) */
  reached?: number;
}
/** Your licence: what you've proved, carried into multiplayer, stamped like a passport at each circuit. */
export function licenceSVG(o: LicenceOpts = {}) {
  const grade = (o.grade || 'C').slice(0, 1).toUpperCase(),
    name = (o.name || 'Rookie').slice(0, 16),
    num = o.num ?? 27,
    sz = typeof o.size === 'number' ? o.size + 'px' : o.size || '100%',
    circuits = (o.circuits || []).slice(0, 8),
    H = circuits.length ? 128 : 104;
  // the strip: one small stamp per circuit, earned in ink on paper, the rest a pencil silhouette on wash
  let strip = '';
  circuits.forEach((T, i) => {
    const x = 12 + i * 19,
      y = 101,
      got = i < (o.reached ?? 0);
    const { d } = circuitPath(T, x + 2.5, y + 2.5, 10, 11);
    strip +=
      `<rect x="${x}" y="${y}" width="15" height="16" rx="1.5" fill="${got ? PAPER : WASH}" ${O(1)}/>` +
      `<path d="${d}" fill="none" stroke="${got ? INK : PENCIL}" stroke-width="1" stroke-linejoin="round"/>`;
  });
  return (
    `<svg viewBox="-2 -2 180 ${H + 7}" style="display:block;width:${sz};max-width:100%;height:auto" role="img" aria-label="Licence ${grade}, ${name}, car ${num}">` +
    // the card: cream, inked, a hard offset shadow under it
    `<rect x="4" y="4" width="172" height="${H}" rx="9" fill="${INK}"/>` +
    `<rect width="172" height="${H}" rx="9" fill="${CREAM}" ${O()}/>` +
    `<path d="M0 22h172" stroke="${INK}" stroke-width="1.2"/>` +
    `<rect x="12" y="9" width="12" height="4" rx="2" fill="${RED}"/>` +
    `<text x="31" y="14.6" font-family="${q(SANS)}" font-size="7.5" font-weight="800" letter-spacing=".9" fill="${INK}">LICENCE</text>` +
    `<svg x="12" y="32" width="56" height="56" viewBox="0 0 64 64"><clipPath id="lcp"><rect width="64" height="64" rx="14"/></clipPath><g clip-path="url(#lcp)">${youBody(num)}</g></svg>` +
    // grade (a word of power, Geist 800 italic) and car number (Geist 900, tabular) on one baseline
    `<text x="80" y="42" font-family="${q(SANS)}" font-size="6.2" font-weight="800" letter-spacing=".7" fill="${PENCIL}">GRADE</text>` +
    `<text x="124" y="42" font-family="${q(SANS)}" font-size="6.2" font-weight="800" letter-spacing=".7" fill="${PENCIL}">CAR</text>` +
    `<text x="78" y="74" font-family="${q(SANS)}" font-size="38" font-weight="800" font-style="italic" letter-spacing="-1.5" fill="${INK}">${grade}</text>` +
    `<text x="124" y="74" font-family="${q(SANS)}" font-size="24" font-weight="900" letter-spacing="-.6" style="font-variant-numeric:tabular-nums" fill="${INK}">${num}</text>` +
    `<text x="80" y="88" font-family="${q(SANS)}" font-size="${name.length > 12 ? 8 : 9.5}" font-weight="600" fill="${INK}">${name}</text>` +
    (circuits.length ? `<path d="M12 95.5h148" stroke="${PENCIL}"/>` + strip : '') +
    `</svg>`
  );
}
