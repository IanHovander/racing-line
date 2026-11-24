// The small moments, as HTML the game and the campaign can drop in. Styles are in art.css.
//   bulbsHTML(lit)        the race's own start bulbs, five in a row: anything counted to five uses them (a drill
//                         streak lights one per clean attempt; the fifth is followed by lights out).
//   rollHTML(from, to)    a pass: the position rolls like a timing tower (P5 -> P4) and one white streak shoots in.
//                         playRoll(el) runs it (again).
//   streaksSVG()          the logo's speed streaks, for anything that has to look fast.
//   powerHTML(words)      words of power in Geist 800 italic, the last one in red ("Turn 1. *Again.*").
import { MARK, PAPER } from './tokens';

export function bulbsHTML(lit: number, total = 5, label = `${lit} of ${total}`) {
  let s = `<span class="bulbs" role="img" aria-label="${label}">`;
  for (let i = 0; i < total; i++) s += `<i${i < lit ? ' class="on"' : ''}></i>`;
  return s + '</span>';
}
/** Light n bulbs of a .bulbs row (0 is lights out). */
export function setBulbs(el: Element, lit: number) {
  el.querySelectorAll('i').forEach((b, i) => b.classList.toggle('on', i < lit));
}

export function rollHTML(from: number, to: number) {
  const up = to < from;
  const reel = up ? [from, to] : [to, from];
  return (
    `<span class="proll" data-dir="${up ? 'up' : 'down'}" aria-label="P${to}">` +
    `<i class="proll-streak" aria-hidden="true"></i>` +
    `<span class="proll-p">P</span>` +
    `<span class="proll-win"><span class="proll-reel">${reel.map(n => `<span>${n}</span>`).join('')}</span></span>` +
    `</span>`
  );
}
/** Run (or re-run) a roll's animation. */
export function playRoll(el: Element) {
  const r = el.classList.contains('proll') ? el : el.querySelector('.proll');
  if (!r) return;
  r.classList.remove('play');
  void (r as HTMLElement).offsetWidth; // restart the CSS animation
  r.classList.add('play');
}

/** The logo's four streaks, tapering to the left. */
export function streaksSVG(width: number | string = 72, colour = PAPER) {
  const w = typeof width === 'number' ? width + 'px' : width;
  return (
    `<svg class="streaks" viewBox="0 0 40 13" style="display:block;width:${w};height:auto" aria-hidden="true">` +
    `<g transform="translate(4.7 1) skewX(-20)" fill="${colour}" opacity=".5">` +
    `<path d="M0 1.8L34 1.55L34 2.05Z"/><path d="M0 4.8L34 4.35L34 5.25Z"/>` +
    `<path d="M0 7.8L34 7.55L34 8.05Z"/><path d="M0 10.8L34 10.35L34 11.25Z"/>` +
    `</g></svg>`
  );
}

/** Two or three words of power; wrap the word to colour in *stars* ("Turn 1. *Again.*"). New lines with \n. */
export function powerHTML(words: string) {
  const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');
  return (
    `<span class="power">` +
    esc(words)
      .split('\n')
      .map(l => l.replace(/\*([^*]+)\*/g, `<em style="color:${MARK}">$1</em>`))
      .join('<br>') +
    `</span>`
  );
}
