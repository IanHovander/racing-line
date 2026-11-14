import { GS } from '../state';
import { H, W, clamp, wrapA } from '../core/dom';
import { cars, opts } from '../game/race';
import { VMAX } from '../sim/car-model';
// ================= Camera & projection =================
export const cam = { x: 0, y: 0, z: 0, a: 0, zoom: 8, tilt: 0.6, hz: 0.9 };
GS.PZ = 0;
GS.cS = 0;
GS.cC = 1;
GS.OX = 0;
GS.OY = 0;
export function updateCamera(dt) {
  const c = cars[Math.max(0, GS.ctrl)];
  if (!c) return;
  const look = Math.min(c.v * 0.38, 32);
  const tX = c.x + Math.cos(c.h) * look,
    tY = c.y + Math.sin(c.h) * look;
  if (GS.SWAP) {
    const u = clamp(GS.SWAP.t / GS.SWAP.dur, 0, 1),
      e = u * u * (3 - 2 * u),
      [fx, fy, fz, fa, fzm] = GS.SWAP.from;
    const ta = opts.cam === 0 ? c.h : -Math.PI / 4;
    cam.x = fx + (tX - fx) * e;
    cam.y = fy + (tY - fy) * e;
    cam.z = fz + ((c.hz || 0) - fz) * e;
    cam.a = wrapA(fa + wrapA(ta - fa) * e);
    cam.zoom = fzm * (1 - 0.28 * Math.sin(Math.PI * u));
    return;
  }
  const f = 1 - Math.exp(-dt * 4.5);
  cam.x += (tX - cam.x) * f;
  cam.y += (tY - cam.y) * f;
  cam.z += ((c.hz || 0) - cam.z) * f;
  const ta = opts.cam === 0 ? c.h : -Math.PI / 4;
  cam.a = wrapA(cam.a + wrapA(ta - cam.a) * (1 - Math.exp(-dt * (opts.cam === 0 ? 2.2 : 3))));
  const base = clamp(Math.min(W, H) / 68, 4.6, 11);
  const zt = base * (1.12 - (0.3 * c.v) / VMAX);
  cam.zoom += (zt - cam.zoom) * (1 - Math.exp(-dt * 2));
  const tt = opts.cam === 0 ? 0.6 : 0.5;
  cam.tilt += (tt - cam.tilt) * f;
  cam.hz = opts.cam === 0 ? 0.9 : 0.8;
}
export function P(x, y, z) {
  const dx = x - cam.x,
    dy = y - cam.y;
  return [
    GS.OX + cam.zoom * (-dx * GS.cS + dy * GS.cC),
    GS.OY - cam.zoom * (cam.tilt * (dx * GS.cC + dy * GS.cS) + (z + GS.PZ - cam.z) * cam.hz),
  ];
}
export function depth(x, y) {
  return (x - cam.x) * GS.cC + (y - cam.y) * GS.cS;
}
