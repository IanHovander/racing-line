// One notification style for everything during a race (and the few messages in the menus):
// a dark pill with a coloured dot, a short title and an optional second line, one at a time by priority, at one
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
  /** priority (PRI); default info */
  pri?: number;
  /** an icon in place of the dot */
  icon?: keyof typeof NICON;
}
/** track-limits flag (black and white, split diagonally) and penalty (warning triangle) */
export const NICON = {
  flag: '<svg viewBox="0 0 20 20"><path d="M4 2v16" stroke="#fff" stroke-width="1.8" stroke-linecap="round"/><path d="M5 3h12v9H5z" fill="#fff"/><path d="M5 12L17 3v9z" fill="#111"/><path d="M5 3h12v9H5z" fill="none" stroke="#fff" stroke-width="1"/></svg>',
  pen: '<svg viewBox="0 0 20 20"><path d="M10 2.2L18.6 17H1.4z" fill="#ffb000" stroke="#ffb000" stroke-width="1.4" stroke-linejoin="round"/><path d="M10 7.2v4.6" stroke="#111" stroke-width="2" stroke-linecap="round"/><circle cx="10" cy="14.4" r="1.2" fill="#111"/></svg>',
};
/** priorities: one note shows at a time; a higher (or equal) priority note replaces the one showing,
 *  a lower one waits (up to QWAIT s) until it's gone. Penalty > warning > car out > DRS > lap > sector > coach > info. */
export const PRI = { pen: 100, warn: 90, start: 85, out: 80, drs: 60, record: 55, lap: 50, sector: 40, coach: 30, info: 20 };
const QWAIT = 3;
interface Note {
  text: string;
  col: string;
  o: NoteOpts;
  pri: number;
  at: number;
}
const NQ: { cur: Note | null; el: HTMLElement | null; timer: any; queue: Note[] } = {
  cur: null,
  el: null,
  timer: null,
  queue: [],
};
function showNote(n: Note): void {
  const box = $('notes');
  if (!box) return;
  box.classList.toggle('menu', GS.state === 'menu');
  if (NQ.el) {
    const old = NQ.el;
    old.classList.add('out');
    setTimeout(() => old.remove(), 300);
  }
  clearTimeout(NQ.timer);
  const o = n.o;
  const el = document.createElement('div');
  el.className = 'nt' + (o.strong ? ' strong' : '');
  el.innerHTML =
    (o.icon ? `<span class="ic">${NICON[o.icon]}</span>` : `<i style="background:${n.col}"></i>`) +
    `<div class="tx"><div class="h">${n.text}</div>` +
    (o.sub ? `<div class="s">${o.sub}</div>` : '') +
    '</div>';
  box.prepend(el);
  NQ.cur = n;
  NQ.el = el;
  NQ.timer = setTimeout(() => {
    el.classList.add('out');
    setTimeout(() => el.remove(), 300);
    NQ.cur = null;
    NQ.el = null;
    next();
  }, (o.ttl || 3) * 1000);
}
function next(): void {
  const now = performance.now() / 1000;
  NQ.queue = NQ.queue.filter(n => now - n.at < QWAIT);
  if (!NQ.queue.length) return;
  NQ.queue.sort((a, b) => b.pri - a.pri || a.at - b.at);
  showNote(NQ.queue.shift());
}
/** show a notification; `text` and `sub` may hold simple inline HTML */
export function notify(text: string, col: string = NCOL.info, o: NoteOpts = {}): void {
  const n: Note = { text, col, o, pri: o.pri ?? PRI.info, at: performance.now() / 1000 };
  // a newer note of the same kind replaces an older one, shown or waiting
  if (o.key) NQ.queue = NQ.queue.filter(q => q.o.key !== o.key);
  if (!NQ.cur || n.pri >= NQ.cur.pri || (o.key && NQ.cur.o.key === o.key)) showNote(n);
  else NQ.queue.push(n);
}
export function clearNotes(): void {
  clearTimeout(NQ.timer);
  NQ.cur = null;
  NQ.el = null;
  NQ.queue = [];
  const box = $('notes');
  if (box) box.innerHTML = '';
}

