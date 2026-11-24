// What the campaign hands out, in the story layer's greys: drill medals and your licence.
//   medalSVG(tier, mark)  engraved greys, not painted metals: tier 1 is paper, 2 steel, 3 graphite, told apart by tone
//                         and edge (paper has a crisp graphite rim, steel a soft one, graphite none). The mark is the
//                         timing error it was won with (0.08 / 0.12 / 0.20), cut into the face in Geist Mono. Only the
//                         top medal carries red: a thin ring in Gus's colour, the one time he hands it to you.
//   licenceSVG(o)         your licence card: portrait, grade, name and car number, one red mark, and a strip of
//                         circuit stamps along the bottom, so it reads like a passport stamped at each circuit.
import { youBody } from './portraits';
import { circuitPath } from './stamps';
import { GRAPHITE, GRAPHITE_2, GREY, INK, MARK, MONO, PAPER, SANS, STEEL } from './tokens';

export type Tier = 1 | 2 | 3;
/** [shadow side, face, groove, groove's lit edge] for each tier */
const TIER: Record<Tier, [string, string, string, string]> = {
  1: [GREY.g5, PAPER, INK, '#ffffff'],
  2: [GREY.g3, STEEL, INK, GREY.g5],
  3: [GRAPHITE, GRAPHITE_2, STEEL, INK],
};
const q = (s: string) => s.replace(/"/g, "'");

export function medalSVG(
  tier: Tier = 1,
  mark = ['', '0.08', '0.12', '0.20'][tier],
  size: number | string = 48,
) {
  const [shade, face, groove, lit] = TIER[tier];
  const fs = mark.length > 2 ? 9.5 : 16;
  // below 40 px the numeral can't be read: tone and rim carry the tier there
  const small = typeof size === 'number' && size < 40;
  const sz = typeof size === 'number' ? size + 'px' : size;
  return (
    `<svg viewBox="0 0 48 64" style="display:block;width:${sz};height:auto" role="img" aria-label="Medal, tier ${tier}, ${mark}">` +
    // the ribbon: two straps, the left one in the light
    `<path d="M9 0h12l6 30h-9z" fill="${GREY.g1}"/>` +
    `<path d="M27 0h12l-9 30h-9z" fill="${GRAPHITE_2}"/>` +
    `<path d="M14 0h2l5.6 27h-2z" fill="${GREY.g2}"/>` +
    // the edge that tells the tiers apart, then the shadow side and the face
    (tier === 1 ? `<circle cx="24" cy="44" r="19.4" fill="${GRAPHITE}"/>` : '') +
    (tier === 2 ? `<circle cx="24" cy="44" r="19" fill="${GREY.g2}"/>` : '') +
    `<circle cx="24" cy="44" r="18" fill="${shade}"/>` +
    `<circle cx="23" cy="43" r="17" fill="${face}"/>` +
    (tier === 1 ? `<circle cx="24" cy="44" r="14.2" fill="none" stroke="${MARK}" stroke-width=".9"/>` : '') +
    `<circle cx="24" cy="44" r="13" fill="${shade}"/>` +
    `<circle cx="23.6" cy="43.6" r="12.6" fill="${face}"/>` +
    // the mark, cut in: the groove, then its lower right edge catching the light
    (small
      ? ''
      : `<text x="24.4" y="48.4" text-anchor="middle" font-family="${q(MONO)}" font-weight="600" font-size="${fs}" letter-spacing="-.5" fill="${lit}">${mark}</text>` +
        `<text x="24" y="48" text-anchor="middle" font-family="${q(MONO)}" font-weight="600" font-size="${fs}" letter-spacing="-.5" fill="${groove}">${mark}</text>`) +
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
  // the strip: one small stamp per circuit, earned in white on ink, the rest a steel silhouette on graphite
  let strip = '';
  circuits.forEach((T, i) => {
    const x = 12 + i * 19,
      y = 101,
      got = i < (o.reached ?? 0);
    const { d } = circuitPath(T, x + 2.5, y + 2.5, 10, 11);
    strip +=
      `<rect x="${x}" y="${y}" width="15" height="16" rx="1.5" fill="${got ? INK : GRAPHITE_2}"/>` +
      `<path d="${d}" fill="none" stroke="${got ? PAPER : STEEL}" stroke-width="1" stroke-linejoin="round"${got ? '' : ' opacity=".35"'}/>`;
  });
  return (
    `<svg viewBox="0 0 172 ${H}" style="display:block;width:${sz};max-width:100%;height:auto" role="img" aria-label="Licence ${grade}, ${name}, car ${num}">` +
    `<rect width="172" height="${H}" rx="9" fill="${GRAPHITE}"/>` +
    `<path d="M0 9a9 9 0 0 1 9-9h154a9 9 0 0 1 9 9v13H0z" fill="${GRAPHITE_2}"/>` +
    `<rect x="12" y="9" width="12" height="4" rx="2" fill="${MARK}"/>` +
    `<text x="31" y="14.5" font-family="${q(MONO)}" font-size="7.5" font-weight="600" letter-spacing="1.6" fill="${STEEL}">LICENCE</text>` +
    `<svg x="12" y="32" width="56" height="56" viewBox="0 0 64 64"><clipPath id="lcp"><rect width="64" height="64" rx="14"/></clipPath><g clip-path="url(#lcp)">${youBody(num)}</g></svg>` +
    // grade (a word of power) and car number (a number, in mono) on one baseline
    `<text x="80" y="42" font-family="${q(MONO)}" font-size="6.5" letter-spacing="1.2" fill="${STEEL}">GRADE</text>` +
    `<text x="124" y="42" font-family="${q(MONO)}" font-size="6.5" letter-spacing="1.2" fill="${STEEL}">CAR</text>` +
    `<text x="78" y="74" font-family="${q(SANS)}" font-size="38" font-weight="800" font-style="italic" letter-spacing="-1.5" fill="${PAPER}">${grade}</text>` +
    `<text x="124" y="74" font-family="${q(MONO)}" font-size="22" font-weight="600" letter-spacing="-1" fill="${PAPER}">${num}</text>` +
    `<text x="80" y="88" font-family="${q(SANS)}" font-size="${name.length > 12 ? 8 : 9.5}" font-weight="600" fill="${PAPER}">${name}</text>` +
    (circuits.length ? `<path d="M12 95.5h148" stroke="${GRAPHITE_2}"/>` + strip : '') +
    `</svg>`
  );
}
