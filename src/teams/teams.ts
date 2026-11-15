import { clamp } from '../core/dom';
// ================= Teams & cars =================
// ---------- team logos and driver flags (original artwork, inline SVG) ----------
export const LOGOS = [
  '<path d="M20 2 L36 8 V20 C36 30 28 36 20 38 C12 36 4 30 4 20 V8 Z" fill="#d81f26" stroke="#ffd400" stroke-width="2"/><path d="M23 7 L13 22 H19 L16 33 L27 17 H21 Z" fill="#ffd400"/>',
  '<path d="M20 2 L36 11 V29 L20 38 L4 29 V11 Z" fill="#c8cdd3" stroke="#00b3a4" stroke-width="2"/><path d="M8 24 L20 12 L32 24 H27 L20 17 L13 24 Z" fill="#00b3a4"/><path d="M12 30 L20 22 L28 30 H24 L20 26 L16 30 Z" fill="#4a515b"/>',
  '', // Papaya logo is the supplied transparent PNG asset.
  '', // Verde logo is the supplied transparent PNG asset.
  '<path d="M20 1 L38 20 L20 39 L2 20 Z" fill="#2449c4" stroke="#ff3b6b" stroke-width="2"/><path d="M20 9 L23 17 H31 L25 22 L27 30 L20 25 L13 30 L15 22 L9 17 H17 Z" fill="#ff3b6b"/>',
];
export const teamLogo = (t, s) =>
  t === 2
    ? `<img class="logo" width="${s}" height="${s}" src="./papaya-racing-logo.png" alt="" aria-hidden="true">`
    : t === 3
      ? `<img class="logo" width="${s}" height="${s}" src="./verde-team-logo.png" alt="" aria-hidden="true">`
      : `<svg class="logo" width="${s}" height="${s}" viewBox="0 0 40 40" aria-hidden="true">${LOGOS[t] || ''}</svg>`;
export const FLAGS = {
  MX: [
    'Mexico',
    '<rect width="10" height="20" fill="#006847"/><rect x="10" width="10" height="20" fill="#fff"/><rect x="20" width="10" height="20" fill="#ce1126"/><circle cx="15" cy="10" r="2.6" fill="#8c6a2c"/><circle cx="15" cy="10" r="1.4" fill="#5d7a2a"/>',
  ],
  BE: [
    'Belgium',
    '<rect width="10" height="20" fill="#000"/><rect x="10" width="10" height="20" fill="#fdda24"/><rect x="20" width="10" height="20" fill="#ef3340"/>',
  ],
  SG: [
    'Singapore',
    '<rect width="30" height="10" fill="#ef3340"/><rect y="10" width="30" height="10" fill="#fff"/><circle cx="7" cy="5" r="3.4" fill="#fff"/><circle cx="8.4" cy="5" r="3.2" fill="#ef3340"/>' +
      [
        [10, 2.6],
        [12.4, 4.2],
        [11.5, 6.9],
        [8.6, 6.9],
        [7.8, 4.2],
      ]
        .map(p => `<circle cx="${p[0] + 1.2}" cy="${p[1]}" r="0.6" fill="#fff"/>`)
        .join(''),
  ],
  US: [
    'United States',
    '<rect width="30" height="20" fill="#fff"/>' +
      [0, 2, 4, 6, 8, 10, 12]
        .map(
          k =>
            `<rect y="${((k * 20) / 13).toFixed(2)}" width="30" height="${(20 / 13).toFixed(2)}" fill="#b22234"/>`,
        )
        .join('') +
      '<rect width="12" height="10.8" fill="#3c3b6e"/>',
  ],
  CA: [
    'Canada',
    '<rect width="30" height="20" fill="#fff"/><rect width="7.5" height="20" fill="#d52b1e"/><rect x="22.5" width="7.5" height="20" fill="#d52b1e"/><path d="M15 3.2l1.3 2.6 1.5-.6-.6 3.6 2.1-2.2.5 1.2 2.3-.4-.7 2.2 1 .5-3.6 2.9.4 1.2-3.5-.5.1 3.4h-.6l.1-3.4-3.5.5.4-1.2-3.6-2.9 1-.5-.7-2.2 2.3.4.5-1.2 2.1 2.2-.6-3.6 1.5.6z" fill="#d52b1e"/>',
  ],
  IE: [
    'Ireland',
    '<rect width="10" height="20" fill="#169b62"/><rect x="10" width="10" height="20" fill="#fff"/><rect x="20" width="10" height="20" fill="#ff883e"/>',
  ],
  FR: [
    'France',
    '<rect width="10" height="20" fill="#0055a4"/><rect x="10" width="10" height="20" fill="#fff"/><rect x="20" width="10" height="20" fill="#ef4135"/>',
  ],
  DE: [
    'Germany',
    '<rect width="30" height="7" fill="#000"/><rect y="6.6" width="30" height="7" fill="#dd0000"/><rect y="13.3" width="30" height="6.7" fill="#ffce00"/>',
  ],
  NG: [
    'Nigeria',
    '<rect width="10" height="20" fill="#008751"/><rect x="10" width="10" height="20" fill="#fff"/><rect x="20" width="10" height="20" fill="#008751"/>',
  ],
  SE: [
    'Sweden',
    '<rect width="30" height="20" fill="#006aa7"/><rect x="9" width="4" height="20" fill="#fecc00"/><rect y="8" width="30" height="4" fill="#fecc00"/>',
  ],
  MC: [
    'Monaco',
    '<rect width="30" height="10" fill="#ce1126"/><rect y="10" width="30" height="10" fill="#fff"/>',
  ],
  BH: [
    'Bahrain',
    '<rect width="30" height="20" fill="#ce1126"/><path d="M0 0H8L11 1L8 3L11 5L8 7L11 9L8 11L11 13L8 15L11 17L8 19L8 20H0Z" fill="#fff"/>',
  ],
  JP: ['Japan', '<rect width="30" height="20" fill="#fff"/><circle cx="15" cy="10" r="6" fill="#bc002d"/>'],
  BR: [
    'Brazil',
    '<rect width="30" height="20" fill="#009c3b"/><path d="M15 2 L28 10 L15 18 L2 10 Z" fill="#ffdf00"/><circle cx="15" cy="10" r="4.6" fill="#002776"/>',
  ],
  NL: [
    'Netherlands',
    '<rect width="30" height="7" fill="#ae1c28"/><rect y="6.6" width="30" height="7" fill="#fff"/><rect y="13.3" width="30" height="6.7" fill="#21468b"/>',
  ],
  CZ: [
    'Czechia',
    '<rect width="30" height="10" fill="#fff"/><rect y="10" width="30" height="10" fill="#d7141a"/><path d="M0 0 L15 10 L0 20 Z" fill="#11457e"/>',
  ],
  PT: [
    'Portugal',
    '<rect width="12" height="20" fill="#046a38"/><rect x="12" width="18" height="20" fill="#da291c"/><circle cx="12" cy="10" r="4" fill="#ffe900" stroke="#046a38" stroke-width="0.6"/>',
  ],
};
export const flag = (c, h) =>
  FLAGS[c]
    ? `<svg class="flag" width="${Math.round(h * 1.5)}" height="${h}" viewBox="0 0 30 20" aria-label="${FLAGS[c][0]}"><title>${FLAGS[c][0]}</title>${FLAGS[c][1]}<rect width="30" height="20" fill="none" stroke="rgba(0,0,0,.35)" stroke-width="1"/></svg>`
    : '';
export const TEAMS = [
  {
    name: 'Scuderia Rosso',
    col: '#d81f26',
    acc: '#ffd400',
    drivers: ['M. Vance', 'L. Moreau'],
    nat: ['CA', 'FR'],
  },
  {
    name: 'Argent GP',
    col: '#c8cdd3',
    acc: '#00b3a4',
    drivers: ['J. Keller', 'T. Okafor'],
    nat: ['DE', 'NG'],
  },
  {
    name: 'Papaya Racing',
    col: '#ff7a00',
    acc: '#1d8cff',
    drivers: ['E. Lindqvist', 'K. Sato'],
    nat: ['SE', 'JP'],
  },
  {
    name: 'Verde Motorsport',
    col: '#0e8a55',
    acc: '#c9f24d',
    drivers: ['R. Duarte', 'S. Visser'],
    nat: ['BR', 'NL'],
  },
  {
    name: 'Azure F1',
    col: '#2449c4',
    acc: '#ff3b6b',
    drivers: ['P. Novak', 'D. Ferreira'],
    nat: ['CZ', 'PT'],
  },
];
export function shade(hex, f) {
  const n = parseInt(hex.slice(1), 16);
  let r = n >> 16,
    g = (n >> 8) & 255,
    b = n & 255;
  r = Math.round(clamp(r * f, 0, 255));
  g = Math.round(clamp(g * f, 0, 255));
  b = Math.round(clamp(b * f, 0, 255));
  return `rgb(${r},${g},${b})`;
}
