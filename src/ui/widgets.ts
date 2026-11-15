import { $, store } from '../core/dom';
import { opts } from '../game/race';
// never throw on a negative radius
export const SEG_SYNC = [];
export const syncAllSegs = () => SEG_SYNC.forEach(f => f());
export function segInit(id, key, cast) {
  const el = $(id);
  const sync = () =>
    ([...el.children] as HTMLElement[]).forEach(b =>
      b.classList.toggle('sel', cast(b.dataset.v) === opts[key]),
    );
  SEG_SYNC.push(sync);
  el.addEventListener('click', e => {
    const b = (e.target as HTMLElement).closest('button');
    if (!b) return;
    opts[key] = cast(b.dataset.v);
    store.set(key, opts[key]);
    sync();
  });
  sync();
}
/** how a strength slider reads: Off, Normal, 2.5× … */
export const sliderText = (v: number) => (v <= 0 ? 'Off' : v === 1 ? 'Normal' : `${v}×`);
/**
 * The stops of a strength slider, from Normal to 50×: fine near Normal, where most tuning happens, coarser
 * further up, so the low end stays easy to hit with a finger. STRENGTH_OFF adds Off (0) at the left end.
 */
export const STRENGTH = [
  1, 1.25, 1.5, 1.75, 2, 2.5, 3, 3.5, 4, 4.5, 5, 6, 7, 8, 9, 10, 12, 15, 20, 25, 30, 35, 40, 45, 50,
];
export const STRENGTH_OFF = [0, ...STRENGTH];
/** the stop nearest to v */
const nearest = (stops: number[], v: number) =>
  stops.reduce((b, s, i) => (Math.abs(s - v) < Math.abs(stops[b] - v) ? i : b), 0);
/**
 * Fill el (an empty .sld box) with a slider over the values in stops and its readout. onMove runs while
 * dragging, onSet once it is let go. Returns a function that moves the slider to a value without either.
 */
export function makeSlider(
  el: HTMLElement,
  stops: number[],
  cur: number,
  dis: boolean,
  onMove: (v: number) => void,
  onSet: (v: number) => void,
): (v: number) => void {
  el.classList.add('sld');
  el.textContent = '';
  const r = document.createElement('input'),
    out = document.createElement('b'),
    last = stops.length - 1;
  r.type = 'range';
  r.min = '0';
  r.max = String(last);
  r.step = '1';
  r.disabled = dis;
  el.append(r, out);
  const showAt = (i: number) => {
    r.value = String(i);
    out.textContent = sliderText(stops[i]);
    r.style.setProperty('--p', `${(i / last) * 100}%`);
  };
  r.addEventListener('input', () => {
    showAt(+r.value);
    onMove(stops[+r.value]);
  });
  r.addEventListener('change', () => onSet(stops[+r.value]));
  showAt(nearest(stops, cur));
  return v => showAt(nearest(stops, v));
}
/** a slider in a menu row for opts[key], saved when it is let go */
export function sliderInit(id: string, key: string, stops: number[]) {
  const set = makeSlider(
    $(id),
    stops,
    opts[key],
    false,
    v => (opts[key] = v),
    v => {
      store.set(key, v);
      syncAllSegs(); // the same slider in the other menu
    },
  );
  SEG_SYNC.push(() => set(opts[key]));
}
export function init(): void {
  // ================= Menu wiring =================
  {
    const E = CanvasRenderingContext2D.prototype.ellipse;
    CanvasRenderingContext2D.prototype.ellipse = function (x, y, a, b, ...r) {
      return E.call(this, x, y, Math.abs(a) || 0, Math.abs(b) || 0, ...r);
    };
  }
}
