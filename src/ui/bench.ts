// Renderer benchmark: runs the race behind the menu with the canvas renderer, then with three.js,
// and reports the time spent drawing each frame (render(), CPU side) and the frame rate.
// Settings → Display → "Run Benchmark", or bench() in the console on localhost / ?debug.
import { $, H, W } from '../core/dom';
import { opts } from '../game/race';
import { PERF } from '../game/loop';
import { GS } from '../state';
import { setRenderer3d } from '../render3d/switch';
import { NCOL, notify } from './notify';

const wait = (ms: number) => new Promise(r => setTimeout(r, ms));
const pct = (a: number[], p: number) => {
  const s = a.slice().sort((x, y) => x - y);
  return s.length ? s[Math.min(s.length - 1, Math.floor(p * s.length))] : 0;
};
export interface BenchResult {
  renderer: string;
  frames: number;
  fps: number;
  renderMean: number;
  renderP95: number;
  frameP95: number;
}
async function measure(three: boolean, secs: number): Promise<BenchResult> {
  await setRenderer3d(three);
  await wait(1200); // warm up: scene build, shader compile, JIT
  PERF.render.length = 0;
  PERF.frame.length = 0;
  PERF.prev = performance.now();
  PERF.on = true;
  await wait(secs * 1000);
  PERF.on = false;
  const r = PERF.render,
    f = PERF.frame.slice(1);
  const mean = r.reduce((a, b) => a + b, 0) / Math.max(1, r.length);
  const fm = f.reduce((a, b) => a + b, 0) / Math.max(1, f.length);
  return {
    renderer: three ? 'three.js' : 'Canvas',
    frames: r.length,
    fps: fm ? 1000 / fm : 0,
    renderMean: mean,
    renderP95: pct(r, 0.95),
    frameP95: pct(f, 0.95),
  };
}
let running = false;
export async function bench(secs = 6): Promise<BenchResult[]> {
  if (running) return [];
  running = true;
  const was = !!opts.r3d;
  const menuOpen = !$('menu').classList.contains('hide');
  $('menu').classList.add('hide');
  notify('Benchmark running…', NCOL.info, { sub: `${GS.TR.name} · ${W}×${H}`, ttl: secs * 2 + 3 });
  const res = [await measure(false, secs), await measure(true, secs)];
  await setRenderer3d(was);
  if (menuOpen) $('menu').classList.remove('hide');
  running = false;
  const line = (b: BenchResult) =>
    `${b.renderer}: <span class="m">${b.fps.toFixed(0)}</span> fps · draw <span class="m">${b.renderMean.toFixed(1)}</span> ms (p95 <span class="m">${b.renderP95.toFixed(1)}</span>)`;
  notify(line(res[0]), NCOL.info, { sub: line(res[1]), ttl: 15, key: 'bench' });
  console.table(res);
  const out = $('benchOut');
  if (out)
    out.innerHTML =
      res
        .map(
          b =>
            `<div><b>${b.renderer}</b> <span class="m">${b.fps.toFixed(0)}</span> fps · draw <span class="m">${b.renderMean.toFixed(1)}</span> ms avg, <span class="m">${b.renderP95.toFixed(1)}</span> ms p95 · frame p95 <span class="m">${b.frameP95.toFixed(1)}</span> ms</div>`,
        )
        .join('') + `<div class="trk">${GS.TR.name} · ${W}×${H} · ${devicePixelRatio}x</div>`;
  return res;
}
export function init(): void {
  const b = $('bBench');
  if (b) b.onclick = () => bench();
}
