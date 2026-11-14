// Renderer switch: the canvas renderer (default) or the three.js layer, chosen in Settings → Display
// (opts.r3d) or with ?three / ?canvas in the URL. three.js (~650 KB) is only downloaded when the
// 3D renderer is first turned on: view3d.ts is loaded with a dynamic import into its own chunk.
import { opts } from '../game/race';
import { store } from '../core/dom';

export const R3: { mod: any; loading: boolean } = { mod: null, loading: false };

/** draw the frame with three.js if it's on and loaded; false means the canvas renderer should draw */
export function render3dFrame(): boolean {
  return !!(opts.r3d && R3.mod && R3.mod.render3d());
}

export async function setRenderer3d(on: boolean): Promise<void> {
  opts.r3d = on;
  store.set('r3d', on);
  if (on && !R3.mod && !R3.loading) {
    R3.loading = true;
    try {
      R3.mod = await import('./view3d');
      R3.mod.start();
    } catch (e) {
      console.error('three.js renderer failed to load', e);
      opts.r3d = false;
    }
    R3.loading = false;
  }
  if (R3.mod) R3.mod.show(opts.r3d);
}

export function init(): void {
  const q = location.search;
  const want = /[?&]three\b/.test(q) ? true : /[?&]canvas\b/.test(q) ? false : !!opts.r3d;
  if (want) setRenderer3d(true);
  else opts.r3d = false;
}
