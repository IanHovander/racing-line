import { GS } from '../state';
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
/** frame timing for the renderer benchmark (ui/bench.ts): time spent in render() and time between frames, ms */
export const PERF = { on: false, prev: 0, render: [] as number[], frame: [] as number[] };
export function frame(now) {
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
    acc += dt * ts;
    let n = 0;
    while (acc >= STEP && n < 12) {
      step(STEP);
      acc -= STEP;
      n++;
    }
    if (n >= 12) acc = 0;
  }
  mpSend(dt);
  updateCamera(GS.state === 'paused' ? 0 : dt);
  if (PERF.on) {
    const t0 = performance.now();
    render();
    PERF.render.push(performance.now() - t0);
    PERF.frame.push(now - PERF.prev);
    PERF.prev = now;
  } else render();
  hud(dt);
  audio(dt);
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
