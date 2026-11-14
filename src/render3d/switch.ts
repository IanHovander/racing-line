// Renderer switch: the canvas renderer (default) or the three.js layer, chosen in Settings → Display
// (opts.r3d) or with ?three / ?canvas in the URL. three.js (~650 KB) is only downloaded when the
// 3D renderer is first turned on: view3d.ts is loaded with a dynamic import into its own chunk.
import { opts } from '../game/race';
import { store } from '../core/dom';
import { NCOL, notify } from '../ui/notify';

export const R3: { mod: any; loading: boolean; err: string; frames: number } = {
  mod: null,
  loading: false,
  err: '',
  frames: 0,
};

/** draw the frame with three.js if it's on and loaded; false means the canvas renderer should draw */
export function render3dFrame(): boolean {
  if (!(opts.r3d && R3.mod)) return false;
  try {
    if (!R3.mod.render3d()) return false;
  } catch (e) {
    // a frame that throws (lost WebGL context, an unsupported feature): fall back to the canvas renderer
    R3.err = String((e && e.message) || e);
    console.error('three.js frame failed', e);
    opts.r3d = false;
    R3.mod.show(false);
    notify('3D renderer stopped', NCOL.bad, { sub: R3.err });
    return false;
  }
  R3.frames++;
  return true;
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
      R3.err = String((e && e.message) || e);
      console.error('three.js renderer failed to start', e);
      R3.mod = null;
      opts.r3d = false;
      store.set('r3d', false);
      notify('3D renderer unavailable', NCOL.bad, { sub: R3.err, ttl: 8 });
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
