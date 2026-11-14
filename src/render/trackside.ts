import { GS } from '../state';
import { ctx } from '../core/dom';
import { attract, cars, opts } from '../game/race';
import { P, cam, depth } from './camera';
import { drawCar } from './car';
import { edge, onScr } from './primitives';
import { GLOWS } from './scenery';
import { NEONQ, TUN_STYLE } from '../track/track';
// crossover bridge: pillars, deck, walls, then the cars on it drawn again on top
// invented sponsors for the barrier boards
export const ADS = [
  ['VOLTRA', '#0b3d91', '#ffffff'],
  ['APEXA', '#e10600', '#ffffff'],
  ['NOVEX', '#111111', '#39d353'],
  ['ZEPHYRA', '#f5f5f5', '#0a58ca'],
  ['KITEWAY', '#ffcc00', '#111111'],
  ['ORBANI', '#5a2ca0', '#ffffff'],
  ['TORQEL', '#00857c', '#ffffff'],
  ['LUMORA', '#ff6a00', '#ffffff'],
];
export const ADQ = [];
export function drawWalls(z) {
  ADQ.length = 0;
  const hz = z * cam.hz,
    st = !!GS.TR.street,
    WH = st ? 1.1 : 1.0,
    TH = st ? 0.35 : 0.7;
  ctx.lineJoin = 'round';
  const strip = (sg, z0, z1, o0, o1, col, step?) => {
    const A = sg > 0 ? GS.BARR : GS.BARL;
    ctx.beginPath();
    for (let i = 0; i < GS.N; i += step || 1) {
      const j = (i + (step || 1)) % GS.N;
      if (!onScr(GS.TSX[i], GS.TSY[i], 50 * z)) continue;
      const a0 = sg * (A[i] + o0),
        a1 = sg * (A[i] + o1),
        b0 = sg * (A[j] + o0),
        b1 = sg * (A[j] + o1);
      ctx.moveTo(GS.TSX[i] + GS.NSX[i] * a0, GS.TSY[i] + GS.NSY[i] * a0 - z0 * hz);
      ctx.lineTo(GS.TSX[j] + GS.NSX[j] * b0, GS.TSY[j] + GS.NSY[j] * b0 - z0 * hz);
      ctx.lineTo(GS.TSX[j] + GS.NSX[j] * b1, GS.TSY[j] + GS.NSY[j] * b1 - z1 * hz);
      ctx.lineTo(GS.TSX[i] + GS.NSX[i] * a1, GS.TSY[i] + GS.NSY[i] * a1 - z1 * hz);
      ctx.closePath();
    }
    ctx.fillStyle = col;
    ctx.fill();
  };
  for (const sg of [1, -1]) {
    strip(sg, 0, 0, TH, TH, 'rgba(0,0,0,0.25)'); // footing shadow
    strip(sg, 0, WH, TH, TH, st ? '#9ea3a9' : '#878c93'); // outer face
    strip(sg, 0, WH, 0, 0, st ? '#b8bcc2' : '#a4a9b0'); // track-side face
    strip(sg, WH, WH, 0, TH, st ? '#e9ebee' : '#d6d9dd'); // top
    if (st) {
      ctx.strokeStyle = 'rgba(200,30,30,0.9)';
      ctx.lineWidth = Math.max(1, 0.12 * z);
      ctx.beginPath();
      edge(GS.SIDES, WH * 0.68, sg);
      ctx.stroke();
    }
    // sponsor boards on the track-side face of some stretches (only faces turned towards the camera)
    if (z > 2.2) {
      const A = sg > 0 ? GS.BARR : GS.BARL;
      for (let i0 = 0; i0 < GS.N; i0 += 6) {
        const blk = Math.floor(i0 / 6),
          grp = Math.floor(blk / 8);
        if ((grp * 5 + (GS.TR.seed || 0) + (sg > 0 ? 1 : 0)) % 4 === 0) continue;
        const i = i0,
          j = (i0 + 6) % GS.N;
        if (!onScr(GS.TSX[i], GS.TSY[i], 30 * z) || !onScr(GS.TSX[j], GS.TSY[j], 30 * z)) continue;
        // which way the board's printed face (towards the track) is turned: > 0 faces the camera
        const face = sg * (GS.nx[i] * GS.cC + GS.ny[i] * GS.cS);
        if (Math.abs(face) < 0.04) continue; // edge-on
        const ad = ADS[(grp * 3 + (sg > 0 ? 5 : 0)) % ADS.length];
        const pa = (k, zz, ex = 0) => {
          const o = sg * (A[k] + ex);
          return [GS.TSX[k] + GS.NSX[k] * o, GS.TSY[k] + GS.NSY[k] * o - zz * hz];
        };
        const m = i0 % GS.N,
          m2 = (i0 + 6) % GS.N;
        const AH = WH + 1.3,
          TK = 0.14; // board thickness
        const poly = (pts, fill) => {
          ctx.fillStyle = fill;
          ctx.beginPath();
          pts.forEach((p, k) => (k ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1])));
          ctx.closePath();
          ctx.fill();
        };
        const q = [pa(m, 0.12), pa(m2, 0.12), pa(m2, AH), pa(m, AH)];
        const cap = [pa(m, AH), pa(m2, AH), pa(m2, AH, TK), pa(m, AH, TK)];
        const om = (i0 + 3) % GS.N,
          oo = sg * A[om];
        // true length of the board on the ground, so the lettering can be painted in the board's own plane
        const wl = Math.hypot(
          GS.cx[m2] + GS.nx[m2] * sg * A[m2] - (GS.cx[m] + GS.nx[m] * sg * A[m]),
          GS.cy[m2] + GS.ny[m2] * sg * A[m2] - (GS.cy[m] + GS.ny[m] * sg * A[m]),
        );
        ADQ.push([
          depth(GS.cx[om] + GS.nx[om] * oo, GS.cy[om] + GS.ny[om] * oo),
          () => {
            if (face < 0) {
              // seen from behind: the unprinted back above the wall, with braces down to the wall top
              const bk = [pa(m, WH, TK), pa(m2, WH, TK), pa(m2, AH, TK), pa(m, AH, TK)];
              poly(bk, '#3b4047');
              ctx.strokeStyle = '#23262b';
              ctx.lineWidth = Math.max(1, 0.07 * z);
              ctx.beginPath();
              for (let k = 0; k <= 6; k += 2) {
                const n = (i0 + k) % GS.N,
                  t0 = pa(n, AH, TK),
                  t1 = pa(n, WH, TK),
                  ft = pa(n, WH, TH * 0.9);
                ctx.moveTo(t0[0], t0[1]);
                ctx.lineTo(t1[0], t1[1]);
                ctx.moveTo(t0[0] * 0.25 + t1[0] * 0.75, t0[1] * 0.25 + t1[1] * 0.75);
                const mid = [t0[0] * 0.75 + t1[0] * 0.25, t0[1] * 0.75 + t1[1] * 0.25];
                ctx.moveTo(mid[0], mid[1]);
                ctx.lineTo(ft[0], ft[1]);
              }
              ctx.stroke();
              poly(cap, '#c9cdd2');
              return;
            }
            poly(q, ad[1]);
            // boards turned away from the camera are a little darker, like a lit surface
            poly(q, `rgba(0,0,0,${(0.26 * (1 - Math.min(1, face * 1.25))).toFixed(3)})`);
            ctx.strokeStyle = 'rgba(20,22,26,0.8)';
            ctx.lineWidth = Math.max(1, 0.08 * z);
            ctx.beginPath();
            q.forEach((p, k) => (k ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1])));
            ctx.closePath();
            ctx.stroke();
            poly(cap, '#e4e6e9');
            const fh = (AH - 0.12) * hz,
              lp = wl * z;
            // lettering painted on the face: sheared and foreshortened with the board, read left to right
            let ux = q[1][0] - q[0][0],
              uy = q[1][1] - q[0][1],
              o0 = q[3];
            if (ux < 0) {
              ux = -ux;
              uy = -uy;
              o0 = q[2];
            }
            if (fh < 6 || ux / lp < 0.22) return;
            ctx.save();
            ctx.beginPath();
            q.forEach((p, k) => (k ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1])));
            ctx.clip();
            ctx.transform(ux / lp, uy / lp, 0, 1, o0[0], o0[1]);
            ctx.font = '900 ' + Math.round(fh * 0.7) + 'px Geist,system-ui,sans-serif';
            const tw = ctx.measureText(ad[0]).width;
            const fx = Math.min(1, (lp * 0.9) / Math.max(tw, 1));
            ctx.translate(lp / 2, fh * 0.54);
            ctx.scale(fx, 1);
            ctx.fillStyle = ad[2];
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(ad[0], 0, 0);
            ctx.restore();
          },
        ]);
      }
    }
    if (GS.TR.fence) {
      strip(sg, WH, WH + 3.2, 0.15, 0.15, 'rgba(190,205,220,0.13)', 2);
      ctx.strokeStyle = 'rgba(205,215,225,0.55)';
      ctx.lineWidth = Math.max(1, 0.12 * z);
      ctx.beginPath();
      edge(GS.SIDES, WH + 3.2, sg);
      const A = sg > 0 ? GS.BARR : GS.BARL;
      for (let i = 0; i < GS.N; i += 3) {
        if (!onScr(GS.TSX[i], GS.TSY[i], 30 * z)) continue;
        const o = sg * (A[i] + 0.15);
        const x = GS.TSX[i] + GS.NSX[i] * o,
          y = GS.TSY[i] + GS.NSY[i] * o;
        ctx.moveTo(x, y - WH * hz);
        ctx.lineTo(x, y - (WH + 3.2) * hz);
      }
      ctx.stroke();
    }
  }
}
// sector board where a sector ends: labelled with that sector, coloured by your latest time in it
export const SECCOL = { p: '#8e3bff', g: '#18a84a', y: '#d4a900' };
export function secBoard(i, k) {
  const me = cars[Math.max(0, GS.ctrl)];
  const prev = (k + 2) % 3;
  let e = null;
  if (me && !attract) {
    e = (me.secCur && me.secCur[prev]) || (me.secPrev && me.secPrev[prev]) || null;
  }
  signBoard(i, GS.BARL[i] < GS.BARR[i] ? -1 : 1, 'S' + (prev + 1), e ? SECCOL[e.col] : '#4a4f59');
}
export function tunSeg() {
  if (!GS.TUN) return [];
  if (GS.TUN.seg && GS.TUN.seg.N === GS.N) return GS.TUN.seg;
  const seg: any = [];
  for (let i = GS.TUN[0]; ; i = (i + 1) % GS.N) {
    seg.push(i);
    if (i === GS.TUN[1] || seg.length > GS.N) break;
  }
  seg.N = GS.N;
  GS.TUN.seg = seg;
  return seg;
}
// tunnel interior, drawn with the road: darker inside, strip lights along both walls (and, for the cut-away, tall inner walls)
export function drawTunnelFloor(z) {
  if (!GS.TUN) return;
  const seg = tunSeg(),
    hz = z * cam.hz;
  ctx.fillStyle = 'rgba(8,8,12,0.5)';
  ctx.beginPath();
  for (let k = 0; k < seg.length - 1; k++) {
    const i = seg[k],
      j = seg[k + 1];
    if (!onScr(GS.TSX[i], GS.TSY[i], 60 * z)) continue;
    const ai = GS.BARR[i],
      aj = GS.BARR[j],
      li = GS.BARL[i],
      lj = GS.BARL[j];
    ctx.moveTo(GS.TSX[i] + GS.NSX[i] * ai, GS.TSY[i] + GS.NSY[i] * ai);
    ctx.lineTo(GS.TSX[j] + GS.NSX[j] * aj, GS.TSY[j] + GS.NSY[j] * aj);
    ctx.lineTo(GS.TSX[j] - GS.NSX[j] * lj, GS.TSY[j] - GS.NSY[j] * lj);
    ctx.lineTo(GS.TSX[i] - GS.NSX[i] * li, GS.TSY[i] - GS.NSY[i] * li);
    ctx.closePath();
  }
  ctx.fill();
  if (TUN_STYLE === 2)
    for (const sg of [1, -1]) {
      const A = sg > 0 ? GS.BARR : GS.BARL;
      ctx.fillStyle = '#4a4743';
      ctx.beginPath();
      for (let k = 0; k < seg.length - 1; k++) {
        const i = seg[k],
          j = seg[k + 1];
        if (!onScr(GS.TSX[i], GS.TSY[i], 60 * z)) continue;
        const a = sg * A[i],
          b = sg * A[j];
        ctx.moveTo(GS.TSX[i] + GS.NSX[i] * a, GS.TSY[i] + GS.NSY[i] * a);
        ctx.lineTo(GS.TSX[j] + GS.NSX[j] * b, GS.TSY[j] + GS.NSY[j] * b);
        ctx.lineTo(GS.TSX[j] + GS.NSX[j] * b, GS.TSY[j] + GS.NSY[j] * b - 4.2 * hz);
        ctx.lineTo(GS.TSX[i] + GS.NSX[i] * a, GS.TSY[i] + GS.NSY[i] * a - 4.2 * hz);
        ctx.closePath();
      }
      ctx.fill();
    }
  for (const sg of [1, -1]) {
    const A = sg > 0 ? GS.BARR : GS.BARL;
    const hl = TUN_STYLE === 2 ? 3.6 : 0.3;
    ctx.strokeStyle = 'rgba(255,220,140,0.9)';
    ctx.lineWidth = Math.max(1.5, 0.25 * z);
    ctx.beginPath();
    for (let k = 0; k < seg.length; k++) {
      const i = seg[k];
      const o = sg * (A[i] - 0.15);
      const x = GS.TSX[i] + GS.NSX[i] * o,
        y = GS.TSY[i] + GS.NSY[i] * o - hl * hz;
      k ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
    }
    ctx.stroke();
    for (let k = 2; k < seg.length; k += 5) {
      const i = seg[k];
      const o = sg * (A[i] - 0.15);
      const x = GS.TSX[i] + GS.NSX[i] * o,
        y = GS.TSY[i] + GS.NSY[i] * o - hl * hz;
      if (onScr(x, y, 10)) GLOWS.push([x, y, z * 2.2, '255,214,140', 0.55]);
    }
  }
}
// tunnel portals: two pillars and a lintel across the road at each end (depth-sorted with the cars)
export function queuePortals(objs) {
  if (!GS.TUN || TUN_STYLE !== 2) return;
  const z = cam.zoom;
  for (const i of [GS.TUN[0], GS.TUN[1]]) {
    const d = depth(GS.cx[i], GS.cy[i]);
    objs.push([
      d,
      7,
      () => {
        if (!onScr(GS.TSX[i], GS.TSY[i], 80 * z)) return;
        const a = GS.BARR[i] + 1.2,
          b = -(GS.BARL[i] + 1.2);
        const quad = (p, col) => {
          ctx.fillStyle = col;
          ctx.beginPath();
          p.forEach((q, k) => (k ? ctx.lineTo(q[0], q[1]) : ctx.moveTo(q[0], q[1])));
          ctx.closePath();
          ctx.fill();
        };
        const thick = 1.2;
        const sh = (o, zz, dd) => {
          const x = GS.cx[i] + GS.nx[i] * o + GS.tx[i] * dd,
            y = GS.cy[i] + GS.ny[i] * o + GS.ty[i] * dd;
          return P(x, y, zz + GS.HT[i]);
        };
        for (const o of [a, b]) {
          const w = o > 0 ? -1.2 : 1.2;
          quad([sh(o, 0, 0), sh(o + w, 0, 0), sh(o + w, 5.6, 0), sh(o, 5.6, 0)], '#c9c2b4');
        }
        quad([sh(a, 4.5, 0), sh(b, 4.5, 0), sh(b, 5.8, 0), sh(a, 5.8, 0)], '#d8d1c3');
        quad([sh(a, 5.8, 0), sh(b, 5.8, 0), sh(b, 5.8, thick), sh(a, 5.8, thick)], '#ece6da');
      },
    ]);
  }
}
export function signBoard(i, sg, txt, bg) {
  const z = cam.zoom,
    o = sg * (GS.HW + 2.6);
  const bx = GS.TSX[i] + GS.NSX[i] * o,
    by = GS.TSY[i] + GS.NSY[i] * o,
    top = by - 2.4 * z * cam.hz;
  ctx.strokeStyle = '#cfd3d8';
  ctx.lineWidth = Math.max(1, 0.15 * z);
  ctx.beginPath();
  ctx.moveTo(bx, by);
  ctx.lineTo(bx, top);
  ctx.stroke();
  const fs = Math.max(9, Math.min(22, z * 1.25));
  ctx.font = '800 ' + fs + 'px Geist,system-ui,sans-serif';
  const w = Math.max(fs * 1.1, ctx.measureText(txt).width + fs * 0.6),
    h = fs * 1.25;
  ctx.fillStyle = bg;
  ctx.strokeStyle = '#fff';
  ctx.lineWidth = Math.max(1, fs * 0.1);
  ctx.beginPath();
  if (ctx.roundRect) ctx.roundRect(bx - w / 2, top - h, w, h, fs * 0.25);
  else ctx.rect(bx - w / 2, top - h, w, h);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = '#fff';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(txt, bx, top - h / 2 + fs * 0.05);
  ctx.textAlign = 'start';
  ctx.textBaseline = 'alphabetic';
}
export function drawBridge() {
  const B = GS.BRIDGE;
  if (!B) return;
  const z = cam.zoom,
    hz = cam.hz;
  const ids = [];
  for (let k = -B.r0; k <= B.r1; k++) ids.push((B.up + k + GS.N) % GS.N);
  if (!ids.some(i => onScr(GS.TSX[i], GS.TSY[i], 120 * z))) return;
  const me = cars[Math.max(0, GS.ctrl)];
  const under = me && !me.gone && !attract && Math.abs(B.cd(me.idx, B.lo)) < 24 && (me.hz || 0) < B.hl + 3;
  ctx.globalAlpha = under ? 0.42 : 1;
  const th = 1.5 * z * hz,
    wh = -1.0 * z * hz;
  ctx.fillStyle = '#8f8b83';
  for (const p of B.pil) {
    const i = p.k;
    const x = GS.TSX[i] + GS.NSX[i] * p.o,
      y = GS.TSY[i] + GS.NSY[i] * p.o;
    const dh = (GS.HT[i] - p.h0) * z * hz;
    const w = Math.max(1.5, 0.7 * z);
    if (dh > th) ctx.fillRect(x - w, y + th, 2 * w, dh - th);
  }
  const strip = (a0f, a1f, zy0, zy1, col) => {
    ctx.beginPath();
    for (let k = 0; k < ids.length - 1; k++) {
      const i = ids[k],
        j = ids[k + 1];
      const a0 = a0f(i),
        a1 = a1f(i),
        b0 = a0f(j),
        b1 = a1f(j);
      ctx.moveTo(GS.TSX[i] + GS.NSX[i] * a0, GS.TSY[i] + GS.NSY[i] * a0 + zy0);
      ctx.lineTo(GS.TSX[j] + GS.NSX[j] * b0, GS.TSY[j] + GS.NSY[j] * b0 + zy0);
      ctx.lineTo(GS.TSX[j] + GS.NSX[j] * b1, GS.TSY[j] + GS.NSY[j] * b1 + zy1);
      ctx.lineTo(GS.TSX[i] + GS.NSX[i] * a1, GS.TSY[i] + GS.NSY[i] * a1 + zy1);
      ctx.closePath();
    }
    ctx.fillStyle = col;
    ctx.fill();
  };
  strip(
    i => GS.BARR[i],
    i => GS.BARR[i],
    0,
    th,
    '#6f6b64',
  );
  strip(
    i => -GS.BARL[i],
    i => -GS.BARL[i],
    0,
    th,
    '#6f6b64',
  );
  strip(
    i => GS.BARR[i],
    i => -GS.BARL[i],
    0,
    0,
    '#a8a49b',
  );
  strip(
    () => GS.HW + 0.45,
    () => -GS.HW - 0.45,
    0,
    0,
    '#ececec',
  );
  strip(
    () => GS.HW,
    () => -GS.HW,
    0,
    0,
    opts.rain ? '#35373c' : '#46484e',
  );
  ctx.strokeStyle = 'rgba(0,0,0,0.16)';
  ctx.lineWidth = 2.2 * z;
  ctx.beginPath();
  ids.forEach((i, k) => {
    const x = GS.TSX[i] + GS.NSX[i] * GS.off[i],
      y = GS.TSY[i] + GS.NSY[i] * GS.off[i];
    k ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
  });
  ctx.stroke();
  strip(
    i => GS.BARR[i],
    i => GS.BARR[i],
    0,
    wh,
    '#cfccc5',
  );
  strip(
    i => -GS.BARL[i],
    i => -GS.BARL[i],
    0,
    wh,
    '#cfccc5',
  );
  ctx.strokeStyle = '#eceae4';
  ctx.lineWidth = Math.max(1, 0.3 * z);
  for (const sg of [1, -1]) {
    ctx.beginPath();
    ids.forEach((i, k) => {
      const b = sg * (sg > 0 ? GS.BARR : GS.BARL)[i];
      const x = GS.TSX[i] + GS.NSX[i] * b,
        y = GS.TSY[i] + GS.NSY[i] * b + wh;
      k ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
    });
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
  const R = Math.max(B.r0, B.r1) + 3;
  cars.forEach((c, i) => {
    if (c.gone || Math.abs(B.cd(c.idx, B.up)) > R || (c.hz || 0) < B.hl + 3) return;
    if (c.ghost > 0) ctx.globalAlpha = 0.5;
    drawCar(c, !attract && i === GS.ctrl, !attract && i === GS.mateIdx);
    ctx.globalAlpha = 1;
  });
}
// Ferris wheel by the main straight
export function drawWheel(w) {
  GS.PZ = w.hz || 0;
  try {
    const hub = P(w.x, w.y, w.r + 3);
    if (!onScr(hub[0], hub[1], w.r * cam.zoom * 1.6)) return;
    const i0 = 0,
      d = [GS.tx[i0], GS.ty[i0]];
    const ax = P(w.x + d[0] * w.r, w.y + d[1] * w.r, w.r + 3),
      bx = P(w.x, w.y, 2 * w.r + 3);
    const A = [ax[0] - hub[0], ax[1] - hub[1]],
      Bv = [bx[0] - hub[0], bx[1] - hub[1]];
    const pt = a => [
      hub[0] + A[0] * Math.cos(a) + Bv[0] * Math.sin(a),
      hub[1] + A[1] * Math.cos(a) + Bv[1] * Math.sin(a),
    ];
    ctx.strokeStyle = '#d8dce2';
    ctx.lineWidth = Math.max(1.5, 0.4 * cam.zoom);
    for (const s2 of [-0.55, 0.55]) {
      const g = P(w.x + d[0] * w.r * s2, w.y + d[1] * w.r * s2, 0);
      ctx.beginPath();
      ctx.moveTo(g[0], g[1]);
      ctx.lineTo(hub[0], hub[1]);
      ctx.stroke();
    }
    ctx.strokeStyle = '#e8ecf0';
    ctx.lineWidth = Math.max(1, 0.3 * cam.zoom);
    ctx.beginPath();
    for (let k = 0; k <= 40; k++) {
      const p = pt((k / 40) * Math.PI * 2);
      k ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1]);
    }
    ctx.stroke();
    const rot = performance.now() / 9000;
    ctx.lineWidth = Math.max(1, 0.15 * cam.zoom);
    ctx.beginPath();
    for (let k = 0; k < 16; k++) {
      const p = pt(rot + (k / 16) * Math.PI * 2);
      ctx.moveTo(hub[0], hub[1]);
      ctx.lineTo(p[0], p[1]);
    }
    ctx.stroke();
    const cols = ['#e94b6b', '#ffd34d', '#4bb3e9', '#7ad06b'];
    for (let k = 0; k < 16; k++) {
      const p = pt(rot + (k / 16) * Math.PI * 2);
      const s2 = Math.max(3, 0.9 * cam.zoom);
      ctx.fillStyle = cols[k % 4];
      ctx.fillRect(p[0] - s2 / 2, p[1], s2, s2 * 1.1);
      if (w.lit) GLOWS.push([p[0], p[1], s2 * 2.2, '180,220,255', 0.8]);
    }
    if (w.lit) {
      const rim = [];
      for (let k = 0; k < 40; k++) rim.push(pt((k / 40) * Math.PI * 2));
      NEONQ.push([rim, '120,200,255', true]);
    }
  } finally {
    GS.PZ = 0;
  }
}
// a giant LED sphere (Las Vegas)
export function drawSphere(o) {
  GS.PZ = o.hz || 0;
  try {
    const c = P(o.x, o.y, o.r);
    const r = o.r * cam.zoom;
    o.scr = null;
    if (!onScr(c[0], c[1], r * 1.3)) return;
    o.scr = [c[0], c[1], r];
    const sh = P(o.x, o.y, 0);
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.beginPath();
    ctx.ellipse(sh[0], sh[1], r, r * cam.tilt, 0, 0, 7);
    ctx.fill();
    const g = ctx.createRadialGradient(c[0] - r * 0.3, c[1] - r * 0.3, r * 0.1, c[0], c[1], r);
    g.addColorStop(0, '#3a4560');
    g.addColorStop(1, '#141826');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(c[0], c[1], r, 0, 7);
    ctx.fill();
  } finally {
    GS.PZ = 0;
  }
}
// emissive things drawn after the night layer
export function drawNeon() {
  const tm = performance.now() / 1000;
  ctx.globalCompositeOperation = 'lighter';
  ctx.lineJoin = 'round';
  if (GS.TR.neon) {
    const z = cam.zoom;
    for (const [sg, col] of [
      [1, '255,60,200'],
      [-1, '60,220,255'],
    ]) {
      ctx.beginPath();
      edge(GS.SIDES, 1.1, sg);
      ctx.strokeStyle = `rgba(${col},0.28)`;
      ctx.lineWidth = Math.max(4, 1.2 * z);
      ctx.stroke();
      ctx.strokeStyle = `rgba(${col},0.9)`;
      ctx.lineWidth = Math.max(1.2, 0.25 * z);
      ctx.stroke();
    }
  }
  for (const [pts, col, closed] of NEONQ) {
    ctx.beginPath();
    pts.forEach((p, k) => (k ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1])));
    if (closed) ctx.closePath();
    const fl = 0.75 + 0.25 * Math.sin(tm * 3 + pts[0][0] * 0.05);
    ctx.strokeStyle = `rgba(${col},${(0.25 * fl).toFixed(3)})`;
    ctx.lineWidth = Math.max(4, cam.zoom * 0.9);
    ctx.stroke();
    ctx.strokeStyle = `rgba(${col},${(0.9 * fl).toFixed(3)})`;
    ctx.lineWidth = Math.max(1.2, cam.zoom * 0.22);
    ctx.stroke();
  }
  if (GS.SPHERE && GS.SPHERE.scr) {
    const [x, y, r] = GS.SPHERE.scr;
    const ph = Math.floor(tm / 8) % 3,
      hu = (tm * 25) % 360;
    ctx.save();
    ctx.beginPath();
    ctx.arc(x, y, r, 0, 7);
    ctx.clip();
    if (ph === 0) {
      const g = ctx.createLinearGradient(x - r, y - r, x + r, y + r);
      for (let k = 0; k <= 6; k++) g.addColorStop(k / 6, `hsla(${(hu + k * 55) % 360},90%,55%,0.85)`);
      ctx.fillStyle = g;
      ctx.fillRect(x - r, y - r, 2 * r, 2 * r);
    } else if (ph === 1) {
      ctx.fillStyle = `hsla(${hu},80%,45%,0.6)`;
      ctx.fillRect(x - r, y - r, 2 * r, 2 * r);
      ctx.strokeStyle = `hsla(${(hu + 180) % 360},95%,65%,0.9)`;
      ctx.lineWidth = Math.max(2, r * 0.06);
      for (let k = -6; k <= 6; k++) {
        const yy = y + (k * r) / 6 + ((tm * r * 0.3) % (r / 6));
        ctx.beginPath();
        ctx.moveTo(x - r, yy);
        ctx.lineTo(x + r, yy);
        ctx.stroke();
      }
    } else {
      const g = ctx.createRadialGradient(x - r * 0.2, y - r * 0.2, r * 0.05, x, y, r);
      g.addColorStop(0, 'rgba(255,240,180,0.95)');
      g.addColorStop(0.5, `hsla(${hu},90%,55%,0.7)`);
      g.addColorStop(1, 'rgba(30,20,80,0.6)');
      ctx.fillStyle = g;
      ctx.fillRect(x - r, y - r, 2 * r, 2 * r);
    }
    ctx.restore();
  }
  if (GS.FOUNT.length) {
    ctx.lineCap = 'round';
    for (const f of GS.FOUNT) {
      const h = 4 + 12 * Math.max(0, Math.sin(tm * 1.3 + f.ph));
      const a = P(f.x, f.y, 0),
        b = P(f.x, f.y, h);
      if (!onScr(a[0], a[1], 40)) continue;
      ctx.strokeStyle = 'rgba(170,220,255,0.35)';
      ctx.lineWidth = Math.max(3, cam.zoom * 0.8);
      ctx.beginPath();
      ctx.moveTo(a[0], a[1]);
      ctx.lineTo(b[0], b[1]);
      ctx.stroke();
      ctx.strokeStyle = 'rgba(235,248,255,0.85)';
      ctx.lineWidth = Math.max(1, cam.zoom * 0.2);
      ctx.stroke();
    }
    ctx.lineCap = 'butt';
  }
  ctx.globalCompositeOperation = 'source-over';
}
