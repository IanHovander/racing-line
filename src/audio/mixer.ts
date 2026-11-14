import { GS } from '../state';
import { AC, cgn, e1, e2, egn, flt, gn, o1, o2, ragn, rflt, rgn, wgn } from './audio';
import { crowdEvents } from './crowd';
import { THEMES } from './music';
import { clamp } from '../core/dom';
import { attract, cars, opts } from '../game/race';
import { input } from '../input/input';
import { GEARTOP, autoGear, isManual } from '../sim/car-model';
export const TRACK_THEME = {
  mexico: 'mariachi',
  texas: 'western',
  paulista: 'samba',
  monte: 'baroque',
  sakhir: 'arabic',
  suzuka: 'japan',
  spa: 'newbeat',
  singapore: 'marina',
};
export const curTheme = () => THEMES[TRACK_THEME[GS.musId || GS.TR.id]] || THEMES.electro;
export function playStep(s, t) {
  if (!opts.music) return;
  curTheme().play(s, t);
}
export function engineNote(v, thr?, g?) {
  g = g || autoGear(v);
  const lo = g > 1 ? GEARTOP[g - 1] * 0.97 * 0.9 : 0;
  const fr = clamp((v - lo) / (GEARTOP[g] - lo), 0, 1.05);
  return 0.4 + 0.6 * fr;
}
GS.sqg = null;
GS.sqf = null;
export function audio(dt) {
  if (!AC) return;
  const c = cars[GS.ctrl],
    t = AC.currentTime;
  const racing = GS.state === 'race' || GS.state === 'countdown' || GS.state === 'finished';
  const live = !attract && racing;
  const rpm =
    GS.state === 'countdown' ? (input.thr ? 0.85 : 0.3) : engineNote(c.v, 0, isManual(c) ? c.gear : 0);
  const f = 70 + rpm * 240;
  o1.frequency.setTargetAtTime(f, t, 0.03);
  o2.frequency.setTargetAtTime(f * 0.502, t, 0.03);
  flt.frequency.setTargetAtTime(500 + rpm * 1500, t, 0.05);
  gn.gain.setTargetAtTime(live ? 0.03 + 0.05 * (c.thr || input.thr ? 1 : 0.3) : 0, t, 0.05);
  // nearby cars
  let sum = 0,
    near = null,
    nd = 1e9;
  for (const o of cars) {
    if (o === c) continue;
    const d = Math.hypot(o.x - c.x, o.y - c.y);
    sum += 1 / (1 + (d / 14) ** 2);
    if (d < nd) {
      nd = d;
      near = o;
    }
  }
  if (near) {
    const dx = near.x - c.x,
      dy = near.y - c.y,
      dd = Math.max(nd, 1);
    const vr =
      ((Math.cos(near.h) * near.v - Math.cos(c.h) * c.v) * dx +
        (Math.sin(near.h) * near.v - Math.sin(c.h) * c.v) * dy) /
      dd;
    const ef = (70 + engineNote(near.v) * 240) * clamp(340 / (340 + vr), 0.7, 1.4);
    e1.frequency.setTargetAtTime(ef * 1.01, t, 0.05);
    e2.frequency.setTargetAtTime(ef * 0.5, t, 0.05);
  }
  egn.gain.setTargetAtTime(live && GS.state !== 'countdown' ? Math.min(0.06, 0.045 * sum) : 0, t, 0.08);
  wgn.gain.setTargetAtTime(live ? 0.028 * c.tow : 0, t, 0.25);
  // surface rumble
  const sv = clamp(c.v / 40, 0, 1);
  const sr = [
    [0, 300],
    [0.16, 140],
    [0.09, 320],
    [0.22, 900],
    [0.05, 240],
    [0.08, 520],
  ][c.surf || 0] || [0, 300];
  rgn.gain.setTargetAtTime(live ? sr[0] * sv : 0, t, 0.05);
  if (GS.sqg) {
    GS.sqg.gain.setTargetAtTime(live && c.lock > 0.5 ? 0.55 * clamp(c.v / 40, 0.3, 1) : 0, t, 0.03);
    GS.sqf.frequency.setTargetAtTime(2000 + 300 * Math.sin(t * 23), t, 0.02);
  }
  rflt.frequency.setTargetAtTime(sr[1] * (c.surf === 1 ? 1 + 0.5 * Math.sin(t * 60) : 1), t, 0.02);
  // crowd: louder near the grandstands, swells with cheers
  GS.cheerT = Math.max(0, GS.cheerT - dt * 0.35);
  const gs = Math.hypot(c.x - GS.cx[0], c.y - GS.cy[0]);
  const near2 = clamp(1 - gs / 220, 0, 1);
  const cv = (racing || GS.state === 'paused' ? 1 : 0.5) * (0.035 + 0.12 * near2 + 0.05 * GS.cheerT);
  cgn.gain.setTargetAtTime(cv, t, 0.3);
  ragn.gain.setTargetAtTime(opts.rain && GS.state !== 'menu' ? 0.045 : 0, t, 0.4);
  crowdEvents(dt, near2, racing && !attract);
}
