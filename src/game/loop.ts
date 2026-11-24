import { GS } from '../state';
import { passHud } from '../ui/pass-hud';
import { audioStatus } from '../audio/audio';
import { audio } from '../audio/mixer';
import { setupRace } from './race';
import { mpOn } from '../net/multiplayer';
import { mpSend } from '../net/netcode';
import { updateCamera } from '../render/camera';
import { render } from '../render/render';
import { STEP } from '../sim/ai';
import { step } from '../sim/step';
import { hud } from '../ui/hud';
export let last = performance.now(),
  acc = 0,
  frameN = 0;
export let FDT = 1 / 60;
const perfEnabled = new URLSearchParams(location.search).has('perf');
const perfSamples = {
  frame: [] as number[],
  sim: [] as number[],
  render: [] as number[],
  hud: [] as number[],
};
let perfPanel: HTMLDivElement | null = null;
let perfUpdatedAt = 0;
function recordPerf(key: keyof typeof perfSamples, value: number) {
  const samples = perfSamples[key];
  samples.push(value);
  if (samples.length > 180) samples.shift();
}
function percentile(values: number[], p: number) {
  if (!values.length) return 0;
  const sorted = values.slice().sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * p))];
}
function updatePerfPanel(now: number) {
  if (!perfEnabled) return;
  if (!perfPanel) {
    perfPanel = document.createElement('div');
    perfPanel.style.cssText =
      'position:fixed;left:6px;bottom:6px;z-index:99999;padding:6px 8px;border-radius:5px;background:#10151ddd;color:#bdf7ce;font:11px/1.4 ui-monospace,monospace;pointer-events:none;white-space:pre;';
    perfPanel.setAttribute('aria-label', 'Performance timings');
    document.body.appendChild(perfPanel);
  }
  if (now - perfUpdatedAt < 250) return;
  perfUpdatedAt = now;
  const frameMs = percentile(perfSamples.frame, 0.95);
  perfPanel.textContent = `Frame p95 ${frameMs.toFixed(1)}ms (${frameMs ? (1000 / frameMs).toFixed(0) : '—'} fps)\nRender p95 ${percentile(perfSamples.render, 0.95).toFixed(1)}ms  Sim ${percentile(perfSamples.sim, 0.95).toFixed(1)}ms  HUD ${percentile(perfSamples.hud, 0.95).toFixed(1)}ms`;
}
export function frame(now) {
  if (perfEnabled) recordPerf('frame', now - last);
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  FDT = dt || 1 / 60;
  let ts = 1;
  if (GS.SWAP) {
    GS.SWAP.t += dt;
    const u = GS.SWAP.t / GS.SWAP.dur;
    ts = u < 0.8 ? 0.04 : 0.04 + 0.96 * Math.min(1, (u - 0.8) / 0.2);
    if (u >= 1 || mpOn()) GS.SWAP = null;
  }
  if (GS.state !== 'paused') {
    const simStart = perfEnabled ? performance.now() : 0;
    acc += dt * ts;
    let n = 0;
    while (acc >= STEP && n < 12) {
      step(STEP);
      acc -= STEP;
      n++;
    }
    if (n >= 12) acc = 0;
    if (perfEnabled) recordPerf('sim', performance.now() - simStart);
  }
  mpSend(dt);
  updateCamera(GS.state === 'paused' ? 0 : dt);
  const renderStart = perfEnabled ? performance.now() : 0;
  render();
  if (perfEnabled) recordPerf('render', performance.now() - renderStart);
  const hudStart = perfEnabled ? performance.now() : 0;
  hud(dt);
  passHud(); // every frame: the passing cues on the touch pads
  if (perfEnabled) recordPerf('hud', performance.now() - hudStart);
  audio(dt);
  updatePerfPanel(now);
  if ((frameN = (frameN + 1) % 60) === 0) audioStatus();
  requestAnimationFrame(frame);
}
export function init(): void {
  // ================= Loop =================
  setupRace(true);
  requestAnimationFrame(frame);
}
/** debug/test hook: reassign a module-level binding */
export function __set(name: string, v: any): void {
  switch (name) {
    case 'last':
      last = v;
      break;
    case 'acc':
      acc = v;
      break;
    case 'frameN':
      frameN = v;
      break;
    case 'FDT':
      FDT = v;
      break;
  }
}
