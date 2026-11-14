import { $, store } from '../core/dom';
import { opts } from '../game/race';
// never throw on a negative radius
export const SEG_SYNC = [];
export const syncAllSegs = () => SEG_SYNC.forEach(f => f());
export function segInit(id, key, cast) {
  const el = $(id);
  const sync = () => ([...el.children] as HTMLElement[]).forEach(b => b.classList.toggle('sel', cast(b.dataset.v) === opts[key]));
  SEG_SYNC.push(sync);
  el.addEventListener('click', e => { const b = (e.target as HTMLElement).closest('button'); if (!b)
    return; opts[key] = cast(b.dataset.v); store.set(key, opts[key]); sync(); });
  sync();
}
export function init(): void {
  // ================= Menu wiring =================
  {
    const E = CanvasRenderingContext2D.prototype.ellipse;
    CanvasRenderingContext2D.prototype.ellipse = function (x, y, a, b, ...r) { return E.call(this, x, y, Math.abs(a) || 0, Math.abs(b) || 0, ...r); };
  }
}
