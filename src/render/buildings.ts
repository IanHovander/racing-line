import { GS } from '../state';
import { ctx } from '../core/dom';
import { FDT } from '../game/loop';
import { P, cam, depth } from './camera';
import { onScr, prism } from './primitives';
import { STAND_STYLE, drawStand } from './stands';
import { TEAMS } from '../teams/teams';
import { NEONQ } from '../track/track';
export function drawBox(b) { GS.PZ = b.hz || 0; try {
  drawBox0(b);
}
finally {
  GS.PZ = 0;
  ctx.globalAlpha = 1;
} }
export function drawBox0(b) {
  const g = P(b.cx, b.cy, 0);
  if (!onScr(g[0], g[1], (b.tall ? 60 : 40) * cam.zoom))
    return;
  let fade = false;
  if (b.tall) {
    let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9;
    for (const p of b.pts)
      for (const z of [b.z0 || 0, (b.z0 || 0) + b.h * GS.HMUL]) {
        const q = P(p[0], p[1], z);
        x0 = Math.min(x0, q[0]);
        x1 = Math.max(x1, q[0]);
        y0 = Math.min(y0, q[1]);
        y1 = Math.max(y1, q[1]);
      }
    let bd = -1e9;
    for (const p of b.pts)
      bd = Math.max(bd, depth(p[0], p[1]));
    for (const a of GS.AHEAD) {
      if (bd < a[2] + 1 && a[0] > x0 - 6 && a[0] < x1 + 6 && a[1] > y0 - 6 && a[1] < y1 + 4) {
        fade = true;
        break;
      }
    }
  }
  // buildings between the camera and the track sink into the ground (smoothly); the ones behind stay full height
  if (b.tall) {
    b.sink = (b.sink || 0) + ((fade ? 1 : 0) - (b.sink || 0)) * Math.min(1, FDT * 5);
  }
  const sk = b.tall ? 1 - 0.93 * (b.sink || 0) : 1;
  const sunk = (b.sink || 0) > 0.5;
  fade = false;
  const Z0 = (b.z0 || 0) * sk;
  const bh = (b.tall ? b.h * GS.HMUL : b.h) * sk;
  if (bh < 0.3 && !b.z0)
    return;
  if (b.crowd && STAND_STYLE > 0 && !b.z0 && bh >= 0.3) {
    drawStand(b, bh, STAND_STYLE);
    return;
  }
  prism(b.pts, b.z0 || 0, Z0 + bh, b.top, b.side);
  if (b.garage) {
    const A0 = b.pts[0], A1 = b.pts[1];
    const ex = A1[0] - A0[0], ey = A1[1] - A0[1];
    let nX = ey, nY = -ex;
    const qx = (A0[0] + A1[0]) / 2 - b.cx, qy = (A0[1] + A1[1]) / 2 - b.cy;
    if (nX * qx + nY * qy < 0) {
      nX = -nX;
      nY = -nY;
    }
    if (nX * GS.cC + nY * GS.cS < 0) {
      const q = (u, zz) => P(A0[0] + ex * u, A0[1] + ey * u, zz);
      const quad = (u0, u1, z0, z1, col) => { const a = q(u0, z0), b2 = q(u1, z0), c = q(u1, z1), d = q(u0, z1); ctx.fillStyle = col; ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b2[0], b2[1]); ctx.lineTo(c[0], c[1]); ctx.lineTo(d[0], d[1]); ctx.closePath(); ctx.fill(); };
      const T2 = TEAMS[b.team];
      quad(0.08, 0.92, 0, 4.4, '#191b20');
      quad(0.02, 0.98, 4.8, 6.1, T2.col);
      quad(0.02, 0.98, 4.8, 5.15, T2.acc);
      quad(0.3, 0.7, 0, 0.12, 'rgba(255,255,255,0.35)');
    }
  }
  if (b.neon && !sunk) {
    const top = b.pts.map(p => P(p[0], p[1], Z0 + bh));
    NEONQ.push([top, b.neon, true]);
    let bi = 0, bv = 1e9;
    for (let i = 0; i < 4; i++) {
      const j = (i + 1) % 4;
      const ex = b.pts[j][0] - b.pts[i][0], ey = b.pts[j][1] - b.pts[i][1];
      let nX = ey, nY = -ex;
      const qx = (b.pts[i][0] + b.pts[j][0]) / 2 - b.cx, qy = (b.pts[i][1] + b.pts[j][1]) / 2 - b.cy;
      if (nX * qx + nY * qy < 0) {
        nX = -nX;
        nY = -nY;
      }
      const v = (nX * GS.cC + nY * GS.cS) / Math.hypot(nX, nY);
      if (v < bv) {
        bv = v;
        bi = i;
      }
    }
    if (bv < -0.15) {
      const A = b.pts[bi], Bp = b.pts[(bi + 1) % 4], h0 = bh * 0.62, h1 = bh * 0.78;
      const q = (u, zz) => P(A[0] + (Bp[0] - A[0]) * u, A[1] + (Bp[1] - A[1]) * u, Z0 + zz);
      NEONQ.push([[q(0.15, h0), q(0.85, h0), q(0.85, h1), q(0.15, h1)], b.sign || b.neon, true]);
      NEONQ.push([[q(0.5, bh * 0.08), q(0.5, bh * 0.5)], b.neon, false]);
    }
  }
  if (b.win && cam.zoom > 3) {
    ctx.fillStyle = GS.TR.night ? 'rgba(255,214,150,0.42)' : 'rgba(60,70,90,0.35)';
    const fl = Math.floor(bh / 3.2);
    ctx.beginPath();
    for (let i = 0; i < 4; i++) {
      const j = (i + 1) % 4;
      const ex = b.pts[j][0] - b.pts[i][0], ey = b.pts[j][1] - b.pts[i][1];
      let nX = ey, nY = -ex;
      const qx = (b.pts[i][0] + b.pts[j][0]) / 2 - b.cx, qy = (b.pts[i][1] + b.pts[j][1]) / 2 - b.cy;
      if (nX * qx + nY * qy < 0) {
        nX = -nX;
        nY = -nY;
      }
      if (nX * GS.cC + nY * GS.cS >= 0)
        continue;
      const el = Math.hypot(ex, ey), nw = Math.floor(el / 4);
      for (let f = 0; f < fl; f++)
        for (let w = 0; w < nw; w++) {
          const u0 = (w + 0.3) / nw, u1 = (w + 0.7) / nw, z0 = f * 3.2 + 1.1, z1 = z0 + 1.4;
          const A = P(b.pts[i][0] + ex * u0, b.pts[i][1] + ey * u0, z0), B = P(b.pts[i][0] + ex * u1, b.pts[i][1] + ey * u1, z0), C = P(b.pts[i][0] + ex * u1, b.pts[i][1] + ey * u1, z1), D = P(b.pts[i][0] + ex * u0, b.pts[i][1] + ey * u0, z1);
          ctx.moveTo(A[0], A[1]);
          ctx.lineTo(B[0], B[1]);
          ctx.lineTo(C[0], C[1]);
          ctx.lineTo(D[0], D[1]);
          ctx.closePath();
        }
    }
    ctx.fill();
  }
  if (fade) {
    ctx.globalAlpha = 0.5;
    ctx.strokeStyle = 'rgba(255,255,255,0.6)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    b.pts.forEach((p, k) => { const q = P(p[0], p[1], Z0 + bh); k ? ctx.lineTo(q[0], q[1]) : ctx.moveTo(q[0], q[1]); });
    ctx.closePath();
    ctx.stroke();
    ctx.globalAlpha = 1;
  }
  if (b.crowd && cam.zoom > 1.6) {
    // stepped seating: rows of seats running parallel to the edge that faces the track, people seated in rows
    if (!b.rows) {
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
      const nr = Math.max(3, Math.min(8, Math.round(dep / 1.6))), np = Math.max(4, Math.round(len / 1.25));
      let s2 = Math.floor(b.cx * 7 + b.cy * 3) + 1;
      const rnd = () => { s2 = (s2 * 16807) % 2147483647; return (s2 % 1000) / 1000; };
      const L2 = (A, B2, t) => [A[0] + (B2[0] - A[0]) * t, A[1] + (B2[1] - A[1]) * t];
      b.rows = [];
      b.ppl = [];
      for (let r = 0; r < nr; r++) {
        const t0 = r / nr, t1 = (r + 1) / nr;
        b.rows.push([L2(F0, B0, t0), L2(F1, B1, t0), L2(F1, B1, t1), L2(F0, B0, t1)]);
        for (let k = 0; k < np; k++) {
          if (rnd() < 0.18)
            continue;
          const u = (k + 0.5 + (rnd() - 0.5) * 0.35) / np, v = (r + 0.55) / nr;
          const fr = L2(F0, F1, u), bk = L2(B0, B1, u);
          b.ppl.push([fr[0] + (bk[0] - fr[0]) * v, fr[1] + (bk[1] - fr[1]) * v, Math.floor(rnd() * 7)]);
        }
      }
    }
    const top = b.h;
    ctx.beginPath();
    for (let r = 0; r < b.rows.length; r += 2) {
      const q = b.rows[r].map(p => P(p[0], p[1], top));
      ctx.moveTo(q[0][0], q[0][1]);
      for (let k = 1; k < 4; k++)
        ctx.lineTo(q[k][0], q[k][1]);
      ctx.closePath();
    }
    ctx.fillStyle = 'rgba(0,0,0,.16)';
    ctx.fill();
    const base = GS.TR.crowdCols || ['#c94a4a', '#e8e2d6', '#4a6fb5', '#d9b64a', '#4c9a63', '#d9844a'];
    const cols = base.concat(['#c9a27e']);
    const sz = Math.max(1.4, cam.zoom * 0.3);
    ctx.globalAlpha = 0.85;
    for (let c = 0; c < 7; c++) {
      ctx.fillStyle = cols[c % cols.length];
      ctx.beginPath();
      for (const pp of b.ppl) {
        if (pp[2] !== c)
          continue;
        const q = P(pp[0], pp[1], top);
        ctx.rect(q[0] - sz / 2, q[1] - sz, sz, sz * 1.25);
      }
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }
}
