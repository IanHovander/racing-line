// One notification style for everything during a race (and the few messages in the menus):
// a dark pill with a coloured dot, a short title and an optional second line. They stack at one
// place: top centre on desktop, above the pedals on touch screens (top centre in the menus).
import { GS } from '../state';
import { $ } from '../core/dom';

export const NCOL = {
  info: '#9aa1aa',
  good: '#2ecc71',
  best: '#c77dff',
  slow: '#ffd60a',
  bad: '#ff6b5e',
  lost: '#ff8a3d',
  warn: '#f2f4f7',
  pen: '#ff8a00',
};
export interface NoteOpts {
  /** second, smaller line */
  sub?: string;
  /** seconds on screen (default 3) */
  ttl?: number;
  /** a newer note with the same key replaces this one */
  key?: string;
  /** stronger pill (penalties) */
  strong?: boolean;
}
const MAX = 3;
/** show a notification; `text` and `sub` may hold simple inline HTML */
export function notify(text: string, col: string = NCOL.info, o: NoteOpts = {}): void {
  const box = $('notes');
  if (!box) return;
  box.classList.toggle('menu', GS.state === 'menu');
  if (o.key) box.querySelectorAll(`.nt[data-k="${o.key}"]`).forEach(n => n.remove());
  const el = document.createElement('div');
  el.className = 'nt' + (o.strong ? ' strong' : '');
  if (o.key) el.dataset.k = o.key;
  el.innerHTML =
    `<i style="background:${col}"></i><div class="tx"><div class="h">${text}</div>` +
    (o.sub ? `<div class="s">${o.sub}</div>` : '') +
    '</div>';
  box.prepend(el);
  while (box.children.length > MAX) box.lastElementChild.remove();
  setTimeout(
    () => {
      el.classList.add('out');
      setTimeout(() => el.remove(), 300);
    },
    (o.ttl || 3) * 1000,
  );
}
export function clearNotes(): void {
  const box = $('notes');
  if (box) box.innerHTML = '';
}
