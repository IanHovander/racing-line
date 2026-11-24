// The story layer's colours, from the art bible ("Lights Out", Ligne Claire edition): the campaign is drawn like the
// game it ships in, a clean-line comic. One uniform ink outline on every shape, flat fills, no modelling, no glow; one
// hard offset shadow where depth is needed. Before lights out the world is an uncoloured comic page; colour belongs to
// racing. Tones match the game's UI tokens.
export const INK = '#141418';
export const PAPER = '#fffdf7';
export const CREAM = '#faf4e4';
/** ink at about 45% on cream: the one grey, for silhouettes and secondary lines */
export const PENCIL = '#8f8c84';
/** locked or empty states */
export const WASH = '#ece5d3';
/** the one red: the mark on Gus's cap, the lit bulbs, the last word of power */
export const RED = '#d93829';
/** @deprecated the first edition's names, kept so callers keep working */
export const MARK = RED;
export const SIGNAL = RED;
export const STEEL = PENCIL;
export const GRAPHITE = INK;
export const GRAPHITE_2 = PENCIL;
// meaning colours, never decoration (the game's own)
export const GO = '#2d6a4f';
export const SLOW = '#f2c12e';
export const BEST = '#8a4fd8';

/** the outline every shape carries, in a 64-unit drawing */
export const LINE = 2;
/** the game's UI border, and the hard ink shadows (offset down-right) under controls and panels */
export const BORDER = '2.5px solid ' + INK;
export const SHADOW = '3px 3px 0 ' + INK;
export const SHADOW_LG = '4px 4px 0 ' + INK;

export const SANS = "Geist, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif";
export const MONO = "'Geist Mono', ui-monospace, SFMono-Regular, Menlo, Consolas, monospace";
/** the bible's arrival: ease out, fast */
export const EASE_OUT = 'cubic-bezier(.2,.8,.2,1)';
/** the grade before lights out: the world as an uncoloured comic page (a CSS filter for the game canvas) */
export const INKED_PAGE = 'grayscale(1) brightness(1.6) contrast(2.6) sepia(.1)';
