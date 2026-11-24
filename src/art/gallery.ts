// art.html: everything in the art kit, at the sizes it's used. The page to check art on, on a phone or a desktop.
import { TRACKS } from '../track/circuits';
import {
  GUS_FACES,
  gusSVG,
  youSVG,
  licenceSVG,
  medalSVG,
  type Tier,
  stampSVG,
  bulbsHTML,
  playRoll,
  powerHTML,
  rollHTML,
  setBulbs,
  streaksSVG,
  gusSays,
  captionHTML,
  panelHTML,
} from './index';

const main = document.getElementById('gallery');

function section(title: string, note = '') {
  const s = document.createElement('section');
  s.innerHTML = `<h2>${title}</h2>${note ? `<p class="muted">${note}</p>` : ''}<div class="row"></div>`;
  main.appendChild(s);
  return s.querySelector('.row') as HTMLElement;
}
function show(row: HTMLElement, html: string, caption: string, cls = '') {
  const f = document.createElement('figure');
  if (cls) f.className = cls;
  f.innerHTML = `<div class="art">${html}</div><figcaption>${caption}</figcaption>`;
  row.appendChild(f);
  return f;
}

const FACE_NOTE = {
  stern: 'stern, the default',
  doubt: 'unconvinced',
  smile: 'the almost-smile',
  count: 'counting: “Three.”',
  blink: 'blink',
};

export function init() {
  let row = section(
    'Gus Marlow',
    'Inked, flat, one red mark, and a stopwatch on a lanyard: he lost a title by 0.040 s. He acts with his brows, eyes and mouth.',
  );
  for (const f of GUS_FACES) show(row, gusSVG(f, { size: 112 }), FACE_NOTE[f]);
  show(row, gusSVG('stern', { size: 44 }), 'dialogue size');

  row = section(
    'Panels',
    'Story panels are comic panels, built like the game’s own buttons. Gus speaks in balloons; narration goes in a caption.',
  );
  show(row, captionHTML('Final round · Lap 71'), 'caption');
  show(
    row,
    gusSays('stern', 'Ninth. You gave away four tenths at Turn 1, every lap.', 64),
    'Gus speaks',
    'wide',
  );
  show(row, gusSays('doubt', 'It felt fast?', 64), 'unconvinced', 'wide');
  show(
    row,
    panelHTML(
      `<span style="font:600 12px/1.4 'Geist Mono',monospace;letter-spacing:.12em">TURN 1 · LIFT POINT</span><br><b style="font:900 19px Geist">Attempt 4</b>`,
    ),
    'panel',
  );

  row = section('You', 'Helmet on, visor down, your number on the side of the shell under Gus’s red.');
  show(row, youSVG(27, { size: 112 }), 'car 27');
  show(row, youSVG(7, { size: 112 }), 'car 7');
  show(row, youSVG(27, { size: 44 }), 'dialogue size');

  row = section(
    'Medals',
    'Paper with an ink rim, cream with a pencil rim, wash with none. Each carries the timing error it was won with. Only the top one has red.',
  );
  const marks: [Tier, string][] = [
    [1, '0.08'],
    [2, '0.12'],
    [3, '0.20'],
  ];
  for (const [t, m] of marks) show(row, medalSVG(t, m, 72), `tier ${t} · ${m} s`);
  for (const [t, m] of marks) show(row, medalSVG(t, m, 32), '32 px');

  row = section(
    'Licence',
    'What you’ve proved, carried into multiplayer, stamped like a passport at each circuit you reach.',
  );
  show(
    row,
    licenceSVG({ grade: 'C', name: 'Rookie', num: 27, size: 300, circuits: TRACKS, reached: 1 }),
    'grade C',
  );
  show(
    row,
    licenceSVG({ grade: 'B', name: 'E. Lindqvist', num: 4, size: 300, circuits: TRACKS, reached: 3 }),
    'grade B',
  );

  row = section(
    'Circuit stamps',
    'Each circuit’s real centre line inked on paper, the start line ticked. One not reached yet is a pencil silhouette on wash.',
  );
  TRACKS.forEach((T, i) => show(row, stampSVG(T, i + 1, i > 2, 112), i > 2 ? 'not reached' : T.name));

  row = section(
    'Five lights',
    'Five lights. No glow: a lit bulb is flat red with ink rays. A drill streak lights one per clean attempt.',
  );
  for (const n of [0, 1, 3, 5]) show(row, bulbsHTML(n), n ? `${n} lit` : 'lights out');
  const run = show(row, bulbsHTML(0), 'tap to run', 'tap');
  run.addEventListener('click', () => {
    const b = run.querySelector('.bulbs');
    for (let i = 1; i <= 5; i++) setTimeout(() => setBulbs(b, i), i * 650);
    setTimeout(() => setBulbs(b, 0), 5 * 650 + 900 + Math.random() * 500);
  });

  row = section(
    'A pass',
    'The position rolls in an ink badge like the race’s own, and one ink streak shoots in. Tap to replay.',
  );
  for (const [a, b] of [
    [5, 4],
    [10, 9],
    [4, 6],
  ]) {
    const f = show(row, `<span style="font-size:56px">${rollHTML(a, b)}</span>`, `P${a} → P${b}`, 'tap');
    f.addEventListener('click', () => playRoll(f));
    setTimeout(() => playRoll(f), 600);
  }

  row = section(
    'Speed and words',
    'The logo’s streaks, and words of power in Geist 800 italic, the last word red.',
  );
  show(row, streaksSVG(160), 'speed streaks');
  show(row, `<span style="font-size:44px">${powerHTML('Turn 1.\n*Again.*')}</span>`, 'words of power');
  show(row, `<span style="font-size:44px">${powerHTML('*Lift.*')}</span>`, 'one word');
}
init();
