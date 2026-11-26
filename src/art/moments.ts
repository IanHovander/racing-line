// The story layer's moments, as HTML the game and the campaign drop in, drawn like the game's own UI (clean-line
// comic: a 2.5 px ink border, flat fills, a hard ink shadow offset down-right). Styles are in art.css.
//   panelHTML(html)          a comic panel: cream, inked, with the hard shadow, like the game's Practice button
//   balloonHTML(text, tail)  a speech balloon on paper, its tail pointing at the speaker ('left' | 'right' | 'down' |
//                            'up'); *stars* set a word in red, as in powerHTML
//   captionHTML(text)        a narration box: rectangular, mono caps ("FINAL ROUND · LAP 71")
//   gusSays(face, text)      a panel with Gus drawn straight into it (no frame of his own) and his line in a balloon
//   bulbsHTML(lit)           the start lights, five in a row; anything counted to five uses them (a drill streak
//                            lights one per clean attempt; the fifth is followed by lights out). No glow: a lit bulb is
//                            a flat red disc with short ink rays, the comic way to draw light.
//   rollHTML(from, to)       a pass: the position rolls in an ink badge like the race's own position badge
//                            (P5 -> P4), tightening to the new number's width, and one ink speed streak shoots in.
//                            playRoll(el) runs it (again).
//   streaksSVG()             the logo's speed streaks, for anything that has to look fast; stretch to fill a box
//   powerHTML(words)         words of power in Geist 800 italic, the starred word in red ("Turn 1. *Again.*")
import { gusSVG, type GusFace } from './portraits';
import { INK, RED } from './tokens';

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');

export function panelHTML(html: string, cls = '') {
  return `<div class="lc-panel${cls ? ' ' + cls : ''}">${html}</div>`;
}
/** Wrap a word in *stars* to set it in red ("Turn 1. *Again.*"); new lines with \n. */
const marked = (text: string) =>
  esc(text)
    .split('\n')
    .map(l => l.replace(/\*([^*]+)\*/g, `<em class="lc-red">$1</em>`))
    .join('<br>');
export function balloonHTML(text: string, tail: 'left' | 'right' | 'down' | 'up' = 'left') {
  return `<div class="lc-balloon" data-tail="${tail}">${marked(text)}</div>`;
}
export function captionHTML(text: string) {
  return `<div class="lc-caption">${esc(text)}</div>`;
}
/** Gus speaking: a panel with him drawn straight into it and his line in a balloon that points at him. */
export function gusSays(face: GusFace, text: string, size = 64) {
  return panelHTML(`${gusSVG(face, { size, framed: false })}${balloonHTML(text, 'left')}`, 'lc-says');
}

const BULB =
  '<svg viewBox="-16 -16 32 32" aria-hidden="true">' +
  `<g class="rays" stroke="${INK}" stroke-width="2" stroke-linecap="round">` +
  [0, 45, 90, 135, 180, 225, 270, 315]
    .map(a => {
      const r = (a * Math.PI) / 180,
        c = Math.cos(r),
        s = Math.sin(r);
      return `<path d="M${(c * 11.6).toFixed(1)} ${(s * 11.6).toFixed(1)}L${(c * 15).toFixed(1)} ${(s * 15).toFixed(1)}"/>`;
    })
    .join('') +
  '</g>' +
  `<circle class="disc" r="8.6" stroke="${INK}" stroke-width="2"/>` +
  '<ellipse class="hi" cx="-3" cy="-3.4" rx="2.2" ry="1.5" transform="rotate(-35 -3 -3.4)"/>' +
  '</svg>';
export function bulbsHTML(lit: number, total = 5, label = `${lit} of ${total}`) {
  let s = `<span class="bulbs" role="img" aria-label="${label}">`;
  for (let i = 0; i < total; i++) s += `<i${i < lit ? ' class="on"' : ''}>${BULB}</i>`;
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
    `<span class="proll" data-dir="${up ? 'up' : 'down'}" aria-label="P${to}" style="--w0:${String(from).length}ch;--w1:${String(to).length}ch">` +
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

/** The logo's four streaks, tapering to the left. stretch: fill the given width and height (a long trail). */
export function streaksSVG(width: number | string = 72, colour = INK, stretch?: { height: number | string }) {
  const css = (v: number | string) => (typeof v === 'number' ? v + 'px' : v);
  const size = stretch
    ? `width:${css(width)};height:${css(stretch.height)}`
    : `width:${css(width)};height:auto`;
  return (
    `<svg class="streaks" viewBox="0 0 40 13"${stretch ? ' preserveAspectRatio="none"' : ''} style="display:block;${size}" aria-hidden="true">` +
    `<g transform="translate(4.7 1) skewX(-20)" fill="${colour}">` +
    `<path d="M0 1.8L34 1.3L34 2.3Z"/><path d="M0 4.8L34 4.2L34 5.4Z"/>` +
    `<path d="M0 7.8L34 7.3L34 8.3Z"/><path d="M0 10.8L34 10.2L34 11.4Z"/>` +
    `</g></svg>`
  );
}

/** Two or three words of power; wrap the word to colour in *stars* ("Turn 1. *Again.*"). New lines with \n. */
export function powerHTML(words: string) {
  return (
    `<span class="power">` +
    esc(words)
      .split('\n')
      .map(l => l.replace(/\*([^*]+)\*/g, `<em class="lc-red" style="color:${RED}">$1</em>`))
      .join('<br>') +
    `</span>`
  );
}
