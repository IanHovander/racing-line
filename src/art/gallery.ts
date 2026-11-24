// art.html: every sprite in the kit, at a few sizes and in every team's colours. The page to check art on, on a
// phone or a desktop, after changing a grid or a shape.
import { TEAMS } from '../teams/teams';
import { TRACKS } from '../track/circuits';
import { blit, type Art } from './pixel';
import { C, livery, ROOKIE } from './palette';
import { gus, you, type GusFace } from './people';
import { carSide, carTop } from './cars';
import * as kit from './index';

const main = document.getElementById('gallery');
const teamLooks = () => TEAMS.map((t, i) => livery(t.col, t.acc, t.acc, [7, 3, 4, 11, 22][i] || i + 1));

function section(title: string, note = '') {
  const s = document.createElement('section');
  s.innerHTML = `<h2>${title}</h2>${note ? `<p class="muted">${note}</p>` : ''}<div class="row"></div>`;
  main.appendChild(s);
  return s.querySelector('.row') as HTMLElement;
}
/** one sprite in a captioned frame, scaled crisp */
function show(row: HTMLElement, art: Art, caption: string, scale = 3, pad = 6, bg = '') {
  const f = document.createElement('figure'),
    cv = document.createElement('canvas');
  cv.width = art.w * scale + pad * 2;
  cv.height = art.h * scale + pad * 2;
  cv.style.width = cv.width + 'px';
  const g = cv.getContext('2d');
  if (bg) {
    g.fillStyle = bg;
    g.fillRect(0, 0, cv.width, cv.height);
  }
  blit(g, art, pad, pad, { scale });
  f.appendChild(cv);
  const cap = document.createElement('figcaption');
  cap.textContent = caption;
  f.appendChild(cap);
  row.appendChild(f);
  return cv;
}

export function init() {
  let row = section(
    'Gus Marlow',
    'The coach. Five faces: stern is the default, the almost-smile is rare and earned.',
  );
  for (const f of ['stern', 'doubt', 'smile', 'shout', 'blink'] as GusFace[]) show(row, gus(f), f, 4);

  row = section('You', 'Helmet on, visor down, in your team’s colours.');
  show(row, you(ROOKIE), 'rookie, car 27', 4);
  teamLooks().forEach((l, i) => show(row, you(l), TEAMS[i].name.toLowerCase(), 3));

  row = section('Cars, side on', 'For scenes: the intro, the garage, the podium. Four wheel frames.');
  show(row, carSide(ROOKIE, 0), 'rookie', 4);
  teamLooks().forEach((l, i) => show(row, carSide(l, i), TEAMS[i].name.toLowerCase(), 3));

  row = section('Cars, from above', 'For maps, icons and the chapter list.');
  show(row, carTop(ROOKIE), 'rookie', 4);
  teamLooks().forEach((l, i) => show(row, carTop(l), TEAMS[i].name.toLowerCase(), 3));

  kit.galleryExtras?.({ section, show, teamLooks, TRACKS, C });
}
init();
