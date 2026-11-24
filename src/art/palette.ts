// The art kit's colours. One palette for every sprite and scene, taken from the game itself: the asphalt and steel of
// the circuits, the kerb red, the pine greens, the racing line's green/yellow/red and the purple of a best sector.
// Team colours are not fixed here: a sprite that wears a livery takes it as slots (see livery()).

export const C = {
  ink: '#0b0e14',
  ink2: '#151a21',
  // asphalt, steel and paint
  tar0: '#202329',
  tar1: '#2e3239',
  tar2: '#40454d',
  tar3: '#565c66',
  grey0: '#6b727c',
  grey1: '#9aa1aa',
  grey2: '#c9ced6',
  grey3: '#e8ebee',
  white: '#ffffff',
  // kerbs, lights and the game's one red
  red0: '#6e0d12',
  red1: '#a3141a',
  red: '#e0232b',
  red3: '#ff6a5c',
  // grass and pines
  grass0: '#132f1c',
  grass1: '#1d4528',
  grass2: '#2a6136',
  grass3: '#46863f',
  grass4: '#83b957',
  // the racing line and timing colours
  go: '#2ecc71',
  slow: '#ffd60a',
  off: '#ff4d42',
  best: '#a259ff',
  // medals
  gold0: '#6b4304',
  gold1: '#b87a0e',
  gold2: '#f2b62a',
  gold3: '#fff0a6',
  silver0: '#3e4652',
  silver1: '#7d8796',
  silver2: '#c3ccd8',
  silver3: '#ffffff',
  bronze0: '#4a230e',
  bronze1: '#8a4a22',
  bronze2: '#c97b3d',
  bronze3: '#f6c08c',
  // sky for scenes: dusk into night
  dusk0: '#140f33',
  dusk1: '#2b1b52',
  dusk2: '#5a2468',
  dusk3: '#a8396b',
  dusk4: '#ec6a5c',
  dusk5: '#ffad6b',
  dusk6: '#ffe1a3',
  night0: '#070a1a',
  night1: '#0e1430',
  night2: '#1b2552',
  // people
  skin0: '#f2c7a0',
  skin1: '#dca07a',
  skin2: '#b47652',
  skin3: '#7d4a34',
};

/** '#rrggbb' times f (0..2), clamped, as '#rrggbb' */
export function tint(hex: string, f: number) {
  const n = parseInt(hex.replace('#', '').slice(0, 6), 16);
  const ch = (v: number) =>
    Math.max(0, Math.min(255, Math.round(f <= 1 ? v * f : v + (255 - v) * (f - 1))))
      .toString(16)
      .padStart(2, '0');
  return '#' + ch(n >> 16) + ch((n >> 8) & 255) + ch(n & 255);
}
/** a and b mixed, t = 0 gives a */
export function mix(a: string, b: string, t: number) {
  const p = parseInt(a.slice(1, 7), 16),
    q = parseInt(b.slice(1, 7), 16);
  const ch = (s: number) =>
    Math.round(((p >> s) & 255) * (1 - t) + ((q >> s) & 255) * t)
      .toString(16)
      .padStart(2, '0');
  return '#' + ch(16) + ch(8) + ch(0);
}

/** A team's colours as the slots a sprite asks for: '1'..'9' in grids, or livery.body etc. in painted sprites. */
export interface Livery {
  body: string;
  bodyDark: string;
  bodyLight: string;
  accent: string;
  accentDark: string;
  helmet: string;
  helmetDark: string;
  helmetLight: string;
  /** car number, drawn where there is room */
  num: number;
}
export function livery(body: string, accent: string, helmet = accent, num = 27): Livery {
  return {
    body,
    bodyDark: tint(body, 0.62),
    bodyLight: tint(body, 1.28),
    accent,
    accentDark: tint(accent, 0.66),
    helmet,
    helmetDark: tint(helmet, 0.62),
    helmetLight: tint(helmet, 1.4),
    num,
  };
}
/** The player's colours when nothing else is chosen: the game's red with a yellow stripe, car 27. */
export const ROOKIE = livery('#e0232b', '#ffd400', '#e0232b', 27);
