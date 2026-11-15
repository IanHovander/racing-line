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
 * Fill el (an empty .sld box) with a slider from min to max and its readout. onMove runs while dragging,
 * onSet once it is let go. Returns a function that moves the slider to a value without either.
 */
export function makeSlider(
  el: HTMLElement,
  min: number,
  max: number,
  step: number,
  cur: number,
  dis: boolean,
  onMove: (v: number) => void,
  onSet: (v: number) => void,
): (v: number) => void {
  el.classList.add('sld');
  el.textContent = '';
  const r = document.createElement('input'),
    out = document.createElement('b');
  r.type = 'range';
  r.min = String(min);
  r.max = String(max);
  r.step = String(step);
  r.disabled = dis;
  el.append(r, out);
  const show = (v: number) => {
    r.value = String(v);
    out.textContent = sliderText(v);
    r.style.setProperty('--p', `${((v - min) / (max - min)) * 100}%`);
  };
  r.addEventListener('input', () => {
    show(+r.value);
    onMove(+r.value);
  });
  r.addEventListener('change', () => onSet(+r.value));
  show(cur);
  return show;
}
/** a slider in a menu row for opts[key], saved when it is let go */
export function sliderInit(id: string, key: string, min: number, max: number, step: number) {
  const set = makeSlider(
    $(id),
    min,
    max,
    step,
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
