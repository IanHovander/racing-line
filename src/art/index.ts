// The art kit for the campaign, the intro and the race's moments, after the art bible ("Lights Out"): flat vector
// drawn in code, two or three tones a face lit from the top left, black, white and one red, Geist and Geist Mono.
//   tokens.ts     the colours, fonts and the arrival easing
//   portraits.ts  Gus Marlow (five faces) and You, as SVG strings
//   honours.ts    engraved grey medals and your licence card
//   stamps.ts     a stamp for each circuit, drawn from its real centre line
//   moments.ts    the start bulbs, the position roll for a pass, the speed streaks, words of power (styles: art.css)
// Cars are the game's own renderer's: the helicopter is the only camera.
// art.html shows all of it (npm run build, then open dist/art.html).
import './art.css';
export * from './tokens';
export { gusSVG, gusBody, youSVG, youBody, GUS_FACES, type GusFace, type PortraitOpts } from './portraits';
export { medalSVG, licenceSVG, type Tier, type LicenceOpts } from './honours';
export { stampSVG, circuitPath, circuitPoints } from './stamps';
export { bulbsHTML, setBulbs, rollHTML, playRoll, streaksSVG, powerHTML } from './moments';
