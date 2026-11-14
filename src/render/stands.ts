import { GS } from '../state';
import { ctx } from '../core/dom';
import { P, cam, depth } from './camera';
import { prism } from './primitives';
import { TEAMS, shade } from '../teams/teams';
// ---- grandstand styles (option preview): 1 stepped terraces, 2 stepped + roof, 3 colour-block seats, 4 packed crowd with flags, 5 grass bank
export let STAND_STYLE = +(new URLSearchParams(location.search).get('stands') || 0);
export function standFrame(b) {
  if (b.sf)
    return b.sf;
  let bi = 0, bd = 1e18;
  const pk = (x, y) => { let m = 1e18; for (let i = 0; i < GS.N; i += 6) {
    const d = (GS.cx[i] - x) ** 2 + (GS.cy[i] - y) ** 2;
    if (d < m)
      m = d;
  } return m; };
  for (let i = 0; i < 4; i++) {
    const j = (i + 1) % 4;
    const d = pk((b.pts[i][0] + b.pts[j][0]) / 2, (b.pts[i][1] + b.pts[j][1]) / 2);
    if (d < bd) {
      bd = d;
      bi = i;
    }
  }
  const F0 = b.pts[bi], F1 = b.pts[(bi + 1) % 4], B1 = b.pts[(bi + 2) % 4], B0 = b.pts[(bi + 3) % 4];
  const len = Math.hypot(F1[0] - F0[0], F1[1] - F0[1]), dep = Math.hypot(B0[0] - F0[0], B0[1] - F0[1]);
  let s2 = Math.floor(Math.abs(b.cx * 7 + b.cy * 3)) + 1;
  const rnd = () => { s2 = (s2 * 16807) % 2147483647; return (s2 % 1000) / 1000; };
  return b.sf = { F0, F1, B0, B1, len, dep, rnd, nr: Math.max(3, Math.min(9, Math.round(dep / 1.5))), np: Math.max(4, Math.round(len / 1.1)) };
}
export const LERP2 = (A, B, t): [
  number,
  number
] => [A[0] + (B[0] - A[0]) * t, A[1] + (B[1] - A[1]) * t];
export function quadZ(a, b2, c, d, col) { ctx.fillStyle = col; ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b2[0], b2[1]); ctx.lineTo(c[0], c[1]); ctx.lineTo(d[0], d[1]); ctx.closePath(); ctx.fill(); }
export function drawStand(b, H, sty) {
  const f = standFrame(b), { F0, F1, B0, B1, nr, np } = f;
  const at = (u, v): [
    number,
    number
  ] => { const fr = LERP2(F0, F1, u), bk = LERP2(B0, B1, u); return LERP2(fr, bk, v); };
  const base = GS.TR.crowdCols || ['#c94a4a', '#e8e2d6', '#4a6fb5', '#d9b64a', '#4c9a63', '#d9844a'];
  const cols = base.concat(['#c9a27e', '#2b2b2b']);
  const pz = Math.max(1.4, cam.zoom * 0.42);
  const skin = ['#f1c7a0', '#c98e62', '#8d5a3b', '#e8b48a'];
  if (sty === 5) { // grass bank sloping up from the fence, spectators sitting on it, a few umbrellas
    const z0 = 0.15, z1 = Math.min(3.2, H * 0.5);
    const P4 = (u, v) => { const q = at(u, v); return P(q[0], q[1], z0 + (z1 - z0) * v); };
    const sideCol = '#4f7a3a';
    const bk0 = P(B0[0], B0[1], 0), bk1 = P(B1[0], B1[1], 0);
    quadZ(bk0, bk1, P4(1, 1), P4(0, 1), sideCol);
    for (const [u] of [[0], [1]]) {
      const g0 = P(...at(u, 0), 0), g1 = P(...at(u, 1), 0);
      quadZ(g0, g1, P4(u, 1), P4(u, 0), sideCol);
    }
    quadZ(P4(0, 0), P4(1, 0), P4(1, 1), P4(0, 1), '#79a95a');
    if (!b.gb) {
      b.gb = [];
      for (let k = 0; k < np * nr * 0.5; k++) {
        const u = f.rnd(), v = 0.1 + f.rnd() * 0.85;
        b.gb.push([u, v, Math.floor(f.rnd() * cols.length), f.rnd() < 0.08]);
      }
      b.gb.sort((a, c) => depth(...at(c[0], c[1])) - depth(...at(a[0], a[1])));
    }
    for (const g of b.gb) {
      const q = P4(g[0], g[1]);
      ctx.fillStyle = cols[g[2]];
      ctx.fillRect(q[0] - pz / 2, q[1] - pz * 1.1, pz, pz * 1.2);
      if (g[3] && cam.zoom > 3) {
        ctx.fillStyle = ['#ff5a5a', '#ffd166', '#5ab0ff', '#ffffff'][g[2] % 4];
        ctx.beginPath();
        ctx.ellipse(q[0], q[1] - pz * 2.2, pz * 2.2, pz * 1.1, 0, Math.PI, 0);
        ctx.fill();
      }
    }
    return;
  }
  // stepped terraces: front row low, back row high; draw far rows first
  const h0 = Math.min(1.2, H * 0.25);
  const rows = [];
  for (let r = 0; r < nr; r++) {
    const t0 = r / nr, t1 = (r + 1) / nr, z = h0 + (H - h0) * (r + 1) / nr;
    rows.push({ r, pts: [LERP2(F0, B0, t0), LERP2(F1, B1, t0), LERP2(F1, B1, t1), LERP2(F0, B0, t1)], z, d: depth(...at(0.5, (t0 + t1) / 2)) });
  }
  rows.sort((a, c) => c.d - a.d);
  const concrete = sty === 3 ? '#9aa1aa' : '#a7adb5', side = sty === 3 ? '#6d747d' : '#7a828c';
  // back wall first (it sits behind the top row)
  {
    const bw = [B0, B1, LERP2(B1, F1, -0.05), LERP2(B0, F0, -0.05)];
    const top2 = H + 1.0;
    const dB = depth(...at(0.5, 1.02)), dF = depth(...at(0.5, 0));
    if (dB > dF)
      prism(bw, 0, top2, '#c9ced5', side);
    else
      b._bwLate = [bw, top2];
  }
  if (!b.st) {
    b.st = [];
    for (let r = 0; r < nr; r++)
      for (let k = 0; k < np; k++) {
        const fill = sty === 4 ? 0.95 : sty === 3 ? 0.45 : 0.8;
        if (f.rnd() > fill)
          continue;
        b.st.push([r, (k + 0.5 + (f.rnd() - 0.5) * 0.3) / np, Math.floor(f.rnd() * cols.length), f.rnd()]);
      }
  }
  const flagCols = (GS.TR.paint || base).slice(0, 3);
  for (const row of rows) {
    let top;
    if (sty === 3) {
      const k = Math.floor(row.r / Math.max(1, nr / 3));
      top = shade(flagCols[k % flagCols.length], 0.85);
    }
    else
      top = row.r % 2 ? '#8d949d' : '#b5bbc3';
    prism(row.pts, 0, row.z, top, side);
    // people on this step
    const zt = row.z, v = (row.r + 0.55) / nr;
    ctx.globalAlpha = 0.95;
    for (const s3 of b.st) {
      if (s3[0] !== row.r)
        continue;
      const q = P(...at(s3[1], v), zt);
      ctx.fillStyle = cols[s3[2]];
      ctx.fillRect(q[0] - pz / 2, q[1] - pz * 1.0, pz, pz * 1.05);
      if (cam.zoom > 5) {
        ctx.fillStyle = skin[(s3[2] + row.r) % 4];
        ctx.fillRect(q[0] - pz * 0.32, q[1] - pz * 1.6, pz * 0.64, pz * 0.6);
      }
      if (sty === 4 && s3[3] < 0.07 && cam.zoom > 2.5) {
        const w = Math.sin(performance.now() / 250 + s3[1] * 20) * pz * 0.6;
        ctx.fillStyle = flagCols[s3[2] % flagCols.length];
        ctx.beginPath();
        ctx.moveTo(q[0], q[1] - pz * 1.1);
        ctx.lineTo(q[0], q[1] - pz * 4);
        ctx.lineTo(q[0] + pz * 2.4 + w, q[1] - pz * 3.4);
        ctx.lineTo(q[0], q[1] - pz * 2.6);
        ctx.closePath();
        ctx.fill();
      }
    }
    ctx.globalAlpha = 1;
  }
  if (b._bwLate) {
    prism(b._bwLate[0], 0, b._bwLate[1], '#c9ced5', side);
    b._bwLate = null;
  }
  if (sty === 2) { // cantilever roof over the upper two thirds, on slim posts at the back
    const rz = H + 3.2, roofCol = shade(TEAMS[(Math.abs(Math.floor(b.cx)) % 5)].col, 1), r0 = 0.3;
    for (const u of [0.02, 0.5, 0.98]) {
      const q0 = P(...at(u, 1.02), 0), q1 = P(...at(u, 1.02), rz);
      ctx.strokeStyle = '#5d636b';
      ctx.lineWidth = Math.max(1, cam.zoom * 0.25);
      ctx.beginPath();
      ctx.moveTo(q0[0], q0[1]);
      ctx.lineTo(q1[0], q1[1]);
      ctx.stroke();
    }
    ctx.globalAlpha = 0.93;
    prism([at(-0.02, r0), at(1.02, r0), at(1.02, 1.06), at(-0.02, 1.06)], rz, rz + 0.35, '#eef1f4', roofCol);
    ctx.globalAlpha = 1;
    const e0 = P(...at(-0.02, r0), rz), e1 = P(...at(1.02, r0), rz);
    ctx.strokeStyle = roofCol;
    ctx.lineWidth = Math.max(1.5, cam.zoom * 0.35);
    ctx.beginPath();
    ctx.moveTo(e0[0], e0[1]);
    ctx.lineTo(e1[0], e1[1]);
    ctx.stroke();
  }
}
/** debug/test hook: reassign a module-level binding */
export function __set(name: string, v: any): void {
  switch (name) {
    case 'STAND_STYLE':
      STAND_STYLE = v;
      break;
  }
}
