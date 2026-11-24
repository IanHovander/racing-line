// The cars, painted from shapes (like the FRC game's robots): the same 1990s open-wheeler the race draws, a raised
// nose, square sidepods, tall wings and big slicks. Every team's car is one drawing in its livery.
//   carSide: 62 x 22 (with its outline), facing right, for scenes (the intro, the garage, the podium). frame 0..3 turns the wheels.
//   carTop:  17 x 34, nose up, for maps, icons and the campaign's chapter list.
import { C } from './palette';
import type { Livery } from './palette';
import { paint, type Painter } from './pixel';
import { ROOKIE } from './palette';

const RUBBER = '#17191d',
  WALL = '#34383f',
  CARBON = '#24272d';

function tyreSide(p: Painter, x: number, y: number, d: number, frame: number) {
  p.disc(x, y, d, RUBBER);
  p.ring(x + 1, y + 1, d - 2, d - 2, WALL);
  const c = x + d / 2,
    m = y + d / 2,
    hub = d >= 12 ? 5 : 4;
  p.disc(Math.round(c - hub / 2), Math.round(m - hub / 2), hub, C.grey1);
  p.px(Math.floor(c), Math.floor(m), C.grey3);
  // one bright spoke on the rim, a quarter turn per frame, so a rolling car reads as rolling
  const a = (frame % 4) * (Math.PI / 2) + Math.PI / 4,
    r = d / 2 - 2;
  p.px(c - 0.5 + Math.cos(a) * r, m - 0.5 + Math.sin(a) * r, C.grey0);
  p.px(c - 0.5 - Math.cos(a) * r, m - 0.5 - Math.sin(a) * r, C.grey0);
}

/** A car seen from the side, nose to the right. */
export function carSide(look: Livery = ROOKIE, frame = 0) {
  const key = `carSide:${look.body}${look.accent}${look.helmet}:${frame & 3}`;
  return paint(
    key,
    62,
    22,
    p => {
      p.ox = p.oy = 1; // a pixel of room all round for the ink outline
      const { body, bodyDark, bodyLight, accent, accentDark, helmet, helmetLight } = look;
      // rear wing: endplate, two elements, the pillar
      p.rect(1, 1, 3, 11, CARBON);
      p.rect(0, 1, 11, 3, accent);
      p.hline(0, 10, 3, accentDark);
      p.rect(2, 6, 8, 2, accentDark);
      p.rect(8, 4, 2, 6, CARBON);
      // floor and diffuser
      p.rect(9, 14, 42, 2, CARBON);
      // engine cover, from the gearbox up to the airbox
      p.poly(
        [
          [9, 13],
          [12, 9],
          [21, 5],
          [28, 4],
          [29, 9],
          [14, 11],
        ],
        body,
      );
      // airbox intake above the driver's head
      p.rect(23, 2, 6, 4, body);
      p.rect(26, 3, 2, 2, C.ink);
      p.hline(23, 27, 2, bodyLight);
      // sidepod and tub
      p.poly(
        [
          [13, 10],
          [19, 8],
          [36, 8],
          [39, 10],
          [39, 14],
          [13, 14],
        ],
        body,
      );
      p.hline(19, 36, 8, bodyLight);
      p.rect(15, 11, 23, 1, accent); // the livery's stripe
      p.rect(15, 12, 23, 1, accentDark);
      p.poly(
        [
          [33, 10],
          [38, 10],
          [39, 14],
          [31, 14],
        ],
        bodyDark,
      ); // sidepod inlet shadow
      // raised nose sloping down to the front wing
      p.poly(
        [
          [36, 7],
          [44, 8],
          [52, 10],
          [57, 11],
          [57, 13],
          [50, 13],
          [41, 12],
          [36, 12],
        ],
        body,
      );
      p.line(37, 7, 52, 10, bodyLight);
      p.line(44, 12, 56, 13, bodyDark);
      // cockpit and driver
      p.rect(29, 7, 7, 2, C.ink);
      p.disc(30, 2, 6, helmet);
      p.px(31, 3, helmetLight);
      p.px(32, 3, helmetLight);
      p.rect(33, 4, 3, 2, '#151a24'); // visor
      p.px(35, 4, '#9fd2ff');
      // front wing: main plane and endplate
      p.rect(47, 15, 13, 2, accent);
      p.hline(47, 59, 16, accentDark);
      p.rect(56, 12, 2, 5, CARBON);
      // wheels last, over the bodywork, the rear one bigger
      tyreSide(p, 3, 6, 13, frame);
      tyreSide(p, 40, 7, 12, frame + 1);
      p.outline(C.ink);
    },
    31,
    21,
  );
}

/** A car from above, nose up. */
export function carTop(look: Livery = ROOKIE) {
  return paint(
    `carTop:${look.body}${look.accent}${look.helmet}`,
    17,
    34,
    p => {
      p.ox = p.oy = 1;
      const { body, bodyDark, bodyLight, accent, accentDark, helmet, helmetLight } = look;
      // front wing and nose
      p.rect(1, 1, 13, 2, accent);
      p.hline(1, 13, 2, accentDark);
      p.rect(6, 2, 3, 11, body);
      p.vline(6, 3, 12, bodyLight);
      // front tyres and suspension arms
      p.line(3, 7, 11, 7, C.grey1);
      p.line(3, 9, 11, 9, C.grey1);
      p.rect(0, 5, 3, 6, RUBBER);
      p.vline(0, 6, 9, WALL);
      p.rect(12, 5, 3, 6, RUBBER);
      p.vline(14, 6, 9, WALL);
      // tub and sidepods
      p.poly(
        [
          [5, 12],
          [10, 12],
          [12, 15],
          [12, 23],
          [10, 25],
          [5, 25],
          [3, 23],
          [3, 15],
        ],
        body,
      );
      p.vline(3, 15, 23, bodyDark);
      p.vline(12, 15, 23, bodyDark);
      p.rect(4, 15, 1, 7, accent);
      p.rect(10, 15, 1, 7, accent);
      // cockpit, helmet, engine cover with a centre stripe
      p.rect(6, 13, 3, 5, C.ink);
      p.disc(6, 14, 3, helmet);
      p.px(7, 14, helmetLight);
      p.rect(6, 18, 3, 8, body);
      p.vline(7, 18, 25, accent);
      // rear tyres, wider than the fronts
      p.rect(0, 21, 4, 7, RUBBER);
      p.vline(0, 22, 26, WALL);
      p.rect(11, 21, 4, 7, RUBBER);
      p.vline(14, 22, 26, WALL);
      // rear wing
      p.rect(2, 28, 11, 3, accent);
      p.hline(2, 12, 30, accentDark);
      p.outline(C.ink);
    },
    8.5,
    17,
  );
}
