// The art kit for the campaign, the intro and the race's moments, after the art bible ("Lights Out", Ligne Claire
// edition): drawn in code like the game it ships in, a clean-line comic. Ink, paper and cream with one red; one ink
// outline on every shape, flat fills, hard ink shadows down-right; Geist only, as in the game.
//   tokens.ts     the colours, fonts and the arrival easing
//   portraits.ts  Gus Marlow (five faces) and You, as SVG strings
//   honours.ts    engraved grey medals and your licence card
//   stamps.ts     a stamp for each circuit, drawn from its real centre line
//   moments.ts    comic panels, speech balloons and captions, the start bulbs, the position roll for a pass, the
//                 speed streaks, words of power (styles: art.css)
// Cars are the game's own renderer's: the helicopter is the only camera.
// art.html shows all of it (npm run build, then open dist/art.html).
import './art.css';
export * from './tokens';
export { gusSVG, gusBody, youSVG, youBody, GUS_FACES, type GusFace, type PortraitOpts } from './portraits';
export { medalSVG, licenceSVG, type Tier, type LicenceOpts } from './honours';
export { stampSVG, circuitPath, circuitPoints } from './stamps';
export {
  panelHTML,
  balloonHTML,
  captionHTML,
  gusSays,
  bulbsHTML,
  setBulbs,
  rollHTML,
  playRoll,
  streaksSVG,
  powerHTML,
} from './moments';
