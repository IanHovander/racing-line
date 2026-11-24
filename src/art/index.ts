// The art kit: pixel art drawn in code, for the campaign, the intro and the race's moments.
//   pixel.ts    the painter (shapes on a pixel grid, outlines) and blit() to draw a sprite crisp at any scale
//   palette.ts  the colours, and livery() for a team's slots
//   grid.ts     hand-drawn sprites: a palette of letters and a grid
//   font.ts     a 5 x 7 pixel font
//   people.ts   Gus Marlow and You
//   cars.ts     the car, side on and from above
// art.html shows all of it (npm run build, then open dist/art.html).
export * from './pixel';
export * from './palette';
export { grid, paintGrid, type Grid, type Patch } from './grid';
export { text, measure, FONT_H, type TextOpts } from './font';
export { gus, you, GUS, YOU, GUS_FACES, type GusFace } from './people';
export { carSide, carTop } from './cars';

/** extra gallery sections, filled in as the kit grows */
export const galleryExtras: ((api: any) => void) | undefined = undefined;
