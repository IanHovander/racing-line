import type { Box } from '../types';
import { GS } from '../state';
import { shade } from '../teams/teams';
import { PIT_RL, inPoly, inWater, rnd } from './track';
export const CITY = ['#e9d8b4', '#e7c6a8', '#d9a982', '#f1e6cf', '#e3b9a4', '#cfc0a0', '#f0d2b0', '#d7c9b8', '#e8ddc5'];
export function buildPits(side, gap, mk) {
  const laneW = 7, depth = 11, i0 = -46, step = 8;
  const SB = side > 0 ? GS.BARR : GS.BARL;
  const o1 = b => side * (SB[b] + gap + laneW), o2 = b => side * (SB[b] + gap + laneW + depth);
  GS.PITLANE = { i0: (i0 + GS.N) % GS.N, n: 10 * step + 2, side, a: BAR => gap, w: laneW };
  // pit entry and exit: lanes that peel off the track edge and merge back after the garages
  {
    const RL = PIT_RL, ent = [], ex = [];
    const e0 = (GS.PITLANE.i0 - RL + GS.N) % GS.N, x0 = (GS.PITLANE.i0 + GS.PITLANE.n) % GS.N;
    for (let k = 0; k <= RL; k++) {
      const u = k / RL, sm = u * u * (3 - 2 * u);
      const i = (e0 + k) % GS.N, j = (x0 + k) % GS.N;
      ent.push([i, (GS.HW + laneW * 0.45) * (1 - sm) + (SB[i] + gap + laneW * 0.5) * sm]);
      ex.push([j, (SB[j] + gap + laneW * 0.5) * (1 - sm) + (GS.HW + laneW * 0.45) * sm]);
    }
    GS.PITLANE.ramps = [ent, ex];
  }
  for (let g = 0; g < 10; g++) {
    const a = ((i0 + g * step) + GS.N) % GS.N, b = ((i0 + g * step + step - 1) + GS.N) % GS.N;
    const box = mk(a, b, o1(a), o2(a), 6.5, '#d9dde2', '#8d939b', false);
    box.garage = true;
    box.team = Math.floor(g / 2);
    GS.boxes.push(box);
  }
  for (const b of GS.boxes) {
    b.cx = (b.pts[0][0] + b.pts[2][0]) / 2;
    b.cy = (b.pts[0][1] + b.pts[2][1]) / 2;
  }
}
export function buildCity(T, outSide, clear, inTunnel) {
  const mk = (pts, h, top, side, crowd) => { const b: Box = { pts, h, top, side, crowd, tall: h > 6 }; b.cx = pts.reduce((a, p) => a + p[0], 0) / 4; b.cy = pts.reduce((a, p) => a + p[1], 0) / 4; return b; };
  const pitB = GS.boxes.filter(b => b.garage || b.pitWall || b.stand);
  const ok = b => b.pts.every(p => clear(p[0], p[1], 1.2) && !inWater(p[0], p[1]) && !pitB.some(g => Math.hypot(p[0] - g.cx, p[1] - g.cy) < 15)) && clear(b.cx, b.cy, 3) && !pitB.some(g => Math.hypot(b.cx - g.cx, b.cy - g.cy) < 18);
  // grandstand on the start straight
  for (let i = -30; i < 30; i += 6) {
    const a = (i + GS.N) % GS.N, b = (i + 6 + GS.N) % GS.N, o1 = outSide * (GS.BAR[a] + 2), o2 = outSide * (GS.BAR[a] + 10);
    const bx = mk([[GS.cx[a] + GS.nx[a] * o1, GS.cy[a] + GS.ny[a] * o1], [GS.cx[b] + GS.nx[b] * o1, GS.cy[b] + GS.ny[b] * o1], [GS.cx[b] + GS.nx[b] * o2, GS.cy[b] + GS.ny[b] * o2], [GS.cx[a] + GS.nx[a] * o2, GS.cy[a] + GS.ny[a] * o2]], 6, '#9aa3ad', '#5b6470', true);
    if (ok(bx))
      GS.boxes.push(bx);
  }
  for (const sg of [1, -1])
    for (let i = 0; i < GS.N;) {
      const len = 6 + Math.floor(rnd() * 6), a = i, b = (i + len) % GS.N;
      i += len + 1;
      if (inTunnel(a) || inTunnel(b))
        continue;
      for (let row = 0; row < 2; row++) {
        const gap = row ? 14 + rnd() * 8 : 0;
        const o1 = sg * (GS.BAR[a] + 1.5 + gap), d = 9 + rnd() * 12, o2 = sg * (GS.BAR[a] + 1.5 + gap + d);
        let h = (row ? 11 : 6) + rnd() * (row ? 15 : 9);
        let col = CITY[Math.floor(rnd() * CITY.length)];
        if (T.neon) {
          h = (row ? 30 : 12) + rnd() * (row ? 45 : 16);
          col = ['#2a2f4a', '#3a3350', '#24384a', '#41344a', '#2e3b3f', '#4a3f3a'][Math.floor(rnd() * 6)];
        }
        if (T.towers) {
          h = (row ? 26 : 10) + rnd() * (row ? 50 : 14);
          col = ['#2c3e50', '#34495e', '#2e4053', '#3d566e', '#283747', '#3b4a5a', '#46505c'][Math.floor(rnd() * 7)];
        }
        const bx = mk([[GS.cx[a] + GS.nx[a] * o1, GS.cy[a] + GS.ny[a] * o1], [GS.cx[b] + GS.nx[b] * o1, GS.cy[b] + GS.ny[b] * o1], [GS.cx[b] + GS.nx[b] * o2, GS.cy[b] + GS.ny[b] * o2], [GS.cx[a] + GS.nx[a] * o2, GS.cy[a] + GS.ny[a] * o2]], h, shade(col, 0.82), shade(col, 0.62), false);
        bx.win = col;
        if (T.neon)
          bx.neon = ['255,60,200', '60,220,255', '255,200,40', '150,100,255', '70,255,150', '255,90,60'][Math.floor(rnd() * 6)];
        if (ok(bx) && !(GS.SPHERE && Math.hypot(bx.cx - GS.SPHERE.x, bx.cy - GS.SPHERE.y) < GS.SPHERE.r + 20) && !GS.FOUNT.some(f => Math.hypot(bx.cx - f.x, bx.cy - f.y) < 30) && !(GS.WHEEL && Math.hypot(bx.cx - GS.WHEEL.x, bx.cy - GS.WHEEL.y) < GS.WHEEL.r * 0.8 + 12))
          GS.boxes.push(bx);
      }
    }
  // yachts in the harbour
  for (let k = 0, tries = 0; k < 26 && tries < 600; tries++) {
    const p = GS.WATER[Math.floor(rnd() * GS.WATER.length)];
    let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
    for (const q of p) {
      x0 = Math.min(x0, q[0]);
      y0 = Math.min(y0, q[1]);
      x1 = Math.max(x1, q[0]);
      y1 = Math.max(y1, q[1]);
    }
    const x = x0 + rnd() * (x1 - x0), y = y0 + rnd() * (y1 - y0);
    if (!inPoly(x, y, p) || !clear(x, y, 10))
      continue;
    const a = rnd() * Math.PI, ca = Math.cos(a), sa = Math.sin(a), l = 8 + rnd() * 14, w = l * 0.3;
    const loc = (u, v) => [x + u * ca - v * sa, y + u * sa + v * ca];
    const hull = [loc(l / 2, 0), loc(l / 4, w / 2), loc(-l / 2, w / 2), loc(-l / 2, -w / 2), loc(l / 4, -w / 2)];
    const bt = { pts: hull, h: 1.6, top: '#f7f7f7', side: '#c9d3dc', crowd: false, cx: x, cy: y, boat: true };
    GS.boxes.push(bt);
    GS.boxes.push({ pts: [loc(l / 6, w / 4), loc(-l / 3, w / 4), loc(-l / 3, -w / 4), loc(l / 6, -w / 4)], z0: 1.6, h: 3, top: '#e8eef3', side: '#9fb3c4', crowd: false, cx: x + 0.01, cy: y, boat: true });
    k++;
  }
}
