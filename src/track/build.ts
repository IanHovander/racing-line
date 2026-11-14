import type { Tree } from '../types';
import { GS } from '../state';
import { clamp } from '../core/dom';
import { DS, GIN, WALL } from '../sim/car-model';
import { buildProfile } from '../sim/profile';
import { TEAMS_NAT } from '../teams/drivers';
import { skids } from './active';
import { buildCity, buildPits } from './city';
import { PIT_RL, catmull, hAt, inWater, outSideT, resample, rnd } from './track';
export function buildTrack(T) {
  GS.TR = T;
  GS.seed = T.seed;
  GS.HW = T.hw || 7;
  const CP = T.cp.map(p => [p[0] * T.sc, p[1] * T.sc]);
  let pts = [];
  {
    const n = CP.length;
    for (let i = 0; i < n; i++) {
      const p0 = CP[(i - 1 + n) % n],
        p1 = CP[i],
        p2 = CP[(i + 1) % n],
        p3 = CP[(i + 2) % n];
      for (let k = 0; k < 120; k++) pts.push(catmull(p0, p1, p2, p3, k / 120));
    }
  }
  pts = resample(pts, DS);
  for (let it = 0; it < (T.smooth || 40); it++) {
    const n = pts.length,
      np = Array.from({ length: n });
    for (let i = 0; i < n; i++) {
      const a = pts[(i - 1 + n) % n],
        b = pts[(i + 1) % n],
        p = pts[i];
      np[i] = [p[0] * 0.5 + (a[0] + b[0]) * 0.25, p[1] * 0.5 + (a[1] + b[1]) * 0.25];
    }
    pts = np;
  }
  pts = resample(pts, DS);
  {
    const sx = T.start[0] * T.sc,
      sy = T.start[1] * T.sc;
    let bi = 0,
      bd = 1e18;
    for (let i = 0; i < pts.length; i++) {
      const d = (pts[i][0] - sx) ** 2 + (pts[i][1] - sy) ** 2;
      if (d < bd) {
        bd = d;
        bi = i;
      }
    }
    pts = pts.slice(bi).concat(pts.slice(0, bi));
  }
  GS.N = pts.length;
  const F = () => new Float64Array(GS.N);
  GS.cx = F();
  GS.cy = F();
  GS.tx = F();
  GS.ty = F();
  GS.nx = F();
  GS.ny = F();
  GS.ccurv = F();
  GS.BAR = F();
  GS.gout = F();
  GS.off = F();
  GS.rx = F();
  GS.ry = F();
  GS.rk = F();
  GS.vf = F();
  GS.TSX = F();
  GS.TSY = F();
  GS.NSX = F();
  GS.NSY = F();
  GS.kerb = new Uint8Array(GS.N);
  GS.gside = new Int8Array(GS.N);
  GS.zone = new Uint8Array(GS.N);
  for (let i = 0; i < GS.N; i++) {
    GS.cx[i] = pts[i][0];
    GS.cy[i] = pts[i][1];
  }
  GS.L = 0;
  for (let i = 0; i < GS.N; i++) {
    const j = (i + 1) % GS.N;
    GS.L += Math.hypot(GS.cx[j] - GS.cx[i], GS.cy[j] - GS.cy[i]);
  }
  GS.SEG = GS.L / GS.N;
  for (let i = 0; i < GS.N; i++) {
    const a = (i - 1 + GS.N) % GS.N,
      b = (i + 1) % GS.N;
    let dx = GS.cx[b] - GS.cx[a],
      dy = GS.cy[b] - GS.cy[a],
      l = Math.hypot(dx, dy);
    GS.tx[i] = dx / l;
    GS.ty[i] = dy / l;
    GS.nx[i] = -GS.ty[i];
    GS.ny[i] = GS.tx[i];
  }
  for (let i = 0; i < GS.N; i++) {
    const a = (i - 3 + GS.N) % GS.N,
      b = (i + 3) % GS.N;
    const cr = GS.tx[a] * GS.ty[b] - GS.ty[a] * GS.tx[b],
      dt = GS.tx[a] * GS.tx[b] + GS.ty[a] * GS.ty[b];
    GS.ccurv[i] = Math.atan2(cr, dt) / (6 * GS.SEG);
  }
  // elevation: keyframes at control points, eased between them, then smoothed
  GS.HT = F();
  GS.SL = F();
  const nCP = CP.length;
  GS.cpIdx = k => {
    const q = CP[k],
      a = CP[(k - 1 + nCP) % nCP],
      b = CP[(k + 1) % nCP];
    let dx = b[0] - a[0],
      dy = b[1] - a[1];
    const dl = Math.hypot(dx, dy) || 1;
    dx /= dl;
    dy /= dl;
    let bi = 0,
      bd = 1e18;
    for (let i = 0; i < GS.N; i++) {
      const d = Math.hypot(GS.cx[i] - q[0], GS.cy[i] - q[1]) + 60 * (1 - (GS.tx[i] * dx + GS.ty[i] * dy));
      if (d < bd) {
        bd = d;
        bi = i;
      }
    }
    return bi;
  };
  if (T.elev) {
    const keys = T.elev.map(([k, h]) => [GS.cpIdx(k), h]).sort((a, b) => a[0] - b[0]);
    for (let q = 0; q < keys.length; q++) {
      const [i0, h0] = keys[q],
        [i1r, h1] = keys[(q + 1) % keys.length];
      const i1 = i1r <= i0 ? i1r + GS.N : i1r;
      for (let i = i0; i < i1; i++) {
        const u = (i - i0) / (i1 - i0),
          e = (1 - Math.cos(Math.PI * u)) / 2;
        GS.HT[i % GS.N] = h0 + (h1 - h0) * e;
      }
    }
    for (let pass = 0; pass < 3; pass++) {
      const t2 = Float64Array.from(GS.HT);
      for (let i = 0; i < GS.N; i++) {
        let s2 = 0;
        for (let k = -10; k <= 10; k++) s2 += t2[(i + k + GS.N) % GS.N];
        GS.HT[i] = s2 / 21;
      }
    }
    for (let i = 0; i < GS.N; i++)
      GS.SL[i] = (GS.HT[(i + 1) % GS.N] - GS.HT[(i - 1 + GS.N) % GS.N]) / (2 * GS.SEG);
  }
  // runoff: as wide as WALL, narrowed only where another part of the track is close
  {
    const raw = F();
    for (let i = 0; i < GS.N; i++) {
      let m = 1e9;
      for (let j = 0; j < GS.N; j += 2) {
        let di = Math.abs(i - j);
        di = Math.min(di, GS.N - di);
        if (di < 70) continue;
        const d = Math.hypot(GS.cx[i] - GS.cx[j], GS.cy[i] - GS.cy[j]);
        if (d < m) m = d;
      }
      raw[i] = clamp(m / 2 - GS.HW - 3, Math.min(14, T.wall || WALL), T.wall || WALL);
    }
    const mn = F();
    for (let i = 0; i < GS.N; i++) {
      let m = 1e9;
      for (let k = -25; k <= 25; k++) m = Math.min(m, raw[(i + k + GS.N) % GS.N]);
      mn[i] = m;
    }
    for (let i = 0; i < GS.N; i++) {
      let s = 0;
      for (let k = -12; k <= 12; k++) s += mn[(i + k + GS.N) % GS.N];
      GS.BAR[i] = GS.HW + s / 25;
    }
    if (T.street) {
      for (let i = 0; i < GS.N; i++) {
        let m = 0;
        for (let k = -8; k <= 8; k++) m = Math.max(m, Math.abs(GS.ccurv[(i + k + GS.N) % GS.N]));
        raw[i] = 1.9 + clamp((m - 1 / 120) * 120, 0, 2.2);
      }
      for (let i = 0; i < GS.N; i++) {
        let s = 0;
        for (let k = -6; k <= 6; k++) s += raw[(i + k + GS.N) % GS.N];
        GS.BAR[i] = GS.HW + s / 13;
      }
    }
  }
  GS.BRIDGE = null;
  if (T.bridge) {
    let bd = 1e18,
      a = 0,
      b = 0;
    for (let i = 0; i < GS.N; i += 2)
      for (let j = i + 150; j < GS.N; j += 2) {
        if (GS.N - (j - i) < 150) continue;
        const d = (GS.cx[i] - GS.cx[j]) ** 2 + (GS.cy[i] - GS.cy[j]) ** 2;
        if (d < bd) {
          bd = d;
          a = i;
          b = j;
        }
      }
    for (const [p, q] of [[a, b]]) {
      let best = bd;
      for (let u = -3; u <= 3; u++)
        for (let v = -3; v <= 3; v++) {
          const i = (p + u + GS.N) % GS.N,
            j = (q + v + GS.N) % GS.N,
            d = (GS.cx[i] - GS.cx[j]) ** 2 + (GS.cy[i] - GS.cy[j]) ** 2;
          if (d < best) {
            best = d;
            a = i;
            b = j;
          }
        }
    }
    const up = GS.HT[a] >= GS.HT[b] ? a : b,
      lo = up === a ? b : a;
    const cd = (i, j) => {
      let d = i - j;
      if (d > GS.N / 2) d -= GS.N;
      if (d < -GS.N / 2) d += GS.N;
      return d;
    };
    const dl = k => {
      let m = 1e9;
      for (let v = -60; v <= 60; v++) {
        const j = (lo + v + GS.N) % GS.N;
        m = Math.min(m, Math.hypot(GS.cx[k] - GS.cx[j], GS.cy[k] - GS.cy[j]));
      }
      return m;
    };
    let r0 = 0,
      r1 = 0;
    while (r0 < 80 && dl((up - r0 - 1 + GS.N) % GS.N) < 2 * GS.HW + 14) r0++;
    while (r1 < 80 && dl((up + r1 + 1) % GS.N) < 2 * GS.HW + 14) r1++;
    for (let k = -90; k <= 90; k++) {
      const i = (up + k + GS.N) % GS.N,
        e = k < 0 ? -k - r0 : k - r1;
      GS.BAR[i] = Math.min(GS.BAR[i], GS.HW + 1.6 + Math.max(0, e - 4) * 0.45);
    }
    for (let k = -80; k <= 80; k++) {
      const i = (lo + k + GS.N) % GS.N;
      GS.BAR[i] = Math.min(GS.BAR[i], GS.HW + 3 + Math.max(0, Math.abs(k) - 16) * 0.45);
    }
    const pil = [];
    for (let k = -r0; k <= r1; k++) {
      const i = (up + k + GS.N) % GS.N,
        d = dl(i);
      if (Math.abs(d - (GS.HW + 5)) < 1.1 && !pil.some(p => Math.abs(cd(p.k, i)) < 4))
        for (const o of [-(GS.HW + 0.4), GS.HW + 0.4]) pil.push({ k: i, o, h0: GS.HT[lo] });
    }
    GS.BRIDGE = { up, lo, r0, r1, hl: GS.HT[lo], pil, cd };
  }
  GS.BARR = Float64Array.from(GS.BAR);
  GS.BARL = Float64Array.from(GS.BAR);
  for (const [sg, A] of [
    [1, GS.BARR],
    [-1, GS.BARL],
  ]) {
    const lim = F();
    for (let i = 0; i < GS.N; i++) {
      let k = 0;
      for (let q = -12; q <= 12; q++) k = Math.max(k, sg * GS.ccurv[(i + q + GS.N) % GS.N]);
      lim[i] = k > 0 ? Math.max(GS.HW + 2, 0.7 / k) : 1e9;
    }
    const mn = F();
    for (let i = 0; i < GS.N; i++) {
      let m = 1e9;
      for (let q = -10; q <= 10; q++) m = Math.min(m, lim[(i + q + GS.N) % GS.N]);
      mn[i] = m;
    }
    for (let i = 0; i < GS.N; i++) {
      let s2 = 0;
      for (let q = -6; q <= 6; q++) s2 += Math.min(mn[(i + q + GS.N) % GS.N], GS.BAR[(i + q + GS.N) % GS.N]);
      A[i] = Math.min(GS.BAR[i], s2 / 13);
    }
  }
  GS.SIDES = { R: GS.BARR, L: GS.BARL };
  {
    let mx0 = 0,
      my0 = 0;
    for (let i = 0; i < GS.N; i++) {
      mx0 += GS.cx[i];
      my0 += GS.cy[i];
    }
    mx0 /= GS.N;
    my0 /= GS.N;
    GS.PIT_SIDE = (GS.cx[0] - mx0) * GS.nx[0] + (GS.cy[0] - my0) * GS.ny[0] > 0 ? -1 : 1;
    if (!T.street) {
      const PA = GS.PIT_SIDE > 0 ? GS.BARR : GS.BARL,
        a = -46 - PIT_RL,
        b = 36 + PIT_RL;
      for (let u = a - 30; u <= b + 30; u++) {
        const q = (u + GS.N) % GS.N,
          e = u < a ? a - u : u > b ? u - b : 0;
        PA[q] = Math.min(PA[q], GS.HW + 2.6 + e * 0.7);
      }
    }
  }
  for (let i = 0; i < GS.N; i++) {
    let m = 0;
    for (let k = -6; k <= 6; k++) m = Math.max(m, Math.abs(GS.ccurv[(i + k + GS.N) % GS.N]));
    if (m > 1 / 140) GS.kerb[i] = 1;
  }
  // corners (dir +1 = right-hander, -1 = left-hander), numbered from the start line like the real circuits: every bend tighter than ~170 m radius;
  // a change of direction starts a new corner, same-direction bends closer than ~50 m count as one (double apex)
  {
    const sk = F();
    for (let i = 0; i < GS.N; i++) {
      let a = 0;
      for (let k = -5; k <= 5; k++) a += GS.ccurv[(i + k + GS.N) % GS.N];
      sk[i] = a / 11;
    }
    const runs = [];
    for (let i = 0; i < GS.N;) {
      if (Math.abs(sk[i]) < 1 / 170) {
        i++;
        continue;
      }
      const sg = Math.sign(sk[i]);
      let j = i;
      while (j < GS.N && Math.abs(sk[j]) >= 1 / 170 && Math.sign(sk[j]) === sg) j++;
      if (j - i >= 6) runs.push({ i0: i, i1: j - 1, dir: sg });
      i = j;
    }
    const merged = [];
    for (const r of runs) {
      const p = merged[merged.length - 1];
      if (p && p.dir === r.dir && r.i0 - p.i1 < 25) p.i1 = r.i1;
      else merged.push({ ...r });
    }
    if (merged.length > 1) {
      const a = merged[0],
        z2 = merged[merged.length - 1];
      if (a.dir === z2.dir && a.i0 + GS.N - z2.i1 < 25 && a.i0 < 30) {
        z2.i1 = a.i1 + GS.N;
        merged.shift();
      }
    }
    GS.CORNERS = merged.map((r, k) => {
      let ap = r.i0,
        m = 0;
      for (let i = r.i0; i <= r.i1; i++) {
        const q = i % GS.N;
        if (Math.abs(sk[q]) > m) {
          m = Math.abs(sk[q]);
          ap = q;
        }
      }
      return { n: k + 1, i0: r.i0 % GS.N, i1: r.i1 % GS.N, len: r.i1 - r.i0, apex: ap, dir: r.dir, R: 1 / m };
    });
    GS.NEXTC = new Int16Array(GS.N);
    {
      const ap = new Int16Array(GS.N).fill(-1);
      GS.CORNERS.forEach((c, k) => (ap[c.apex] = k));
      let cur = GS.CORNERS.length ? 0 : -1;
      for (let p = 2 * GS.N - 1; p >= 0; p--) {
        const i = p % GS.N;
        if (ap[i] >= 0) cur = ap[i];
        GS.NEXTC[i] = cur;
      }
    }
    GS.CMAP = new Int16Array(GS.N).fill(-1);
    const cd = new Float64Array(GS.N).fill(1e9);
    for (const c of GS.CORNERS)
      for (let u = -22; u <= c.len + 8; u++) {
        const q = (c.i0 + u + GS.N) % GS.N;
        let d = Math.abs(q - c.apex);
        d = Math.min(d, GS.N - d);
        if (d < cd[q]) {
          cd[q] = d;
          GS.CMAP[q] = c.n;
        }
      }
  }
  // DRS zones on the longest straights, with a detection point before each
  {
    const sk = F();
    for (let i = 0; i < GS.N; i++) {
      let m = 0;
      for (let k = -8; k <= 8; k++) m = Math.max(m, Math.abs(GS.ccurv[(i + k + GS.N) % GS.N]));
      sk[i] = m;
    }
    const runs = [];
    let st = -1;
    for (let p = 0; p < 2 * GS.N; p++) {
      const i = p % GS.N,
        ok = sk[i] < 1 / 500;
      if (ok && st < 0) st = p;
      if ((!ok || p === 2 * GS.N - 1) && st >= 0) {
        if (p - st >= 140 && st < GS.N) runs.push([st, p - 1]);
        st = -1;
      }
    }
    const seen = new Set();
    GS.DRSZ = runs
      .filter(r => {
        const k = r[0] % GS.N;
        if (seen.has(k)) return false;
        seen.add(k);
        return r[1] - r[0] < GS.N;
      })
      .sort((a, b) => b[1] - b[0] - (a[1] - a[0]))
      .slice(0, T.street ? 2 : 3)
      .map(([a, b]) => ({
        z0: (a + 15) % GS.N,
        z1: (b - 25 + GS.N) % GS.N,
        det: (a - 60 + GS.N) % GS.N,
        len: b - a - 40,
      }));
    GS.DRSMAP = new Int8Array(GS.N).fill(-1);
    GS.DRSZ.forEach((z, k) => {
      for (let u = 0; u <= z.len; u++) GS.DRSMAP[(z.z0 + u) % GS.N] = k;
    });
  }
  // three timing sectors: split near a third and two thirds of the lap, on the straightest bit nearby
  {
    const pick = f => {
      let best = Math.round(GS.N * f),
        bv = 1e9;
      for (let i = Math.round(GS.N * (f - 0.07)); i <= Math.round(GS.N * (f + 0.07)); i++) {
        let v = 0;
        for (let k = -8; k <= 8; k++) v += Math.abs(GS.ccurv[(i + k + GS.N) % GS.N]);
        if (v < bv) {
          bv = v;
          best = i;
        }
      }
      return best;
    };
    GS.SECI = [0, pick(1 / 3), pick(2 / 3)];
    GS.SECB = GS.SECI.map(i => i * GS.SEG);
  }
  // painted run-off bands (COTA / Bahrain style) flowing round the outside of corners and their exits
  // narrow three-colour bands at every corner; at the big corners wide painted fields outside (up to 20 m)
  // and a painted apex area inside, striped in the circuit's colours
  GS.PWR = F();
  GS.PWL = F();
  GS.SWR = F();
  GS.SWL = F();
  GS.GINA = F();
  for (let i = 0; i < GS.N; i++) GS.GINA[i] = GS.HW + GIN;
  if (T.paint) {
    const raw = new Int8Array(GS.N);
    for (let i = 0; i < GS.N; i++) {
      let any = 0,
        sum = 0;
      for (let k = -24; k <= 8; k++) {
        const j = (i + k + GS.N) % GS.N;
        if (Math.abs(GS.ccurv[j]) > 1 / 110) {
          any = 1;
          sum += GS.ccurv[j];
        }
      }
      if (any && i > 30 && i < GS.N - 40) raw[i] = sum > 0 ? -1 : 1;
    }
    const setW = (side, i, w, sw) => {
      if (side > 0) {
        if (w > GS.PWR[i]) {
          GS.PWR[i] = w;
          GS.SWR[i] = sw;
        }
      } else {
        if (w > GS.PWL[i]) {
          GS.PWL[i] = w;
          GS.SWL[i] = sw;
        }
      }
    };
    for (let i = 0; i < GS.N;) {
      if (!raw[i]) {
        i++;
        continue;
      }
      let j = i;
      while (j < GS.N && raw[j] === raw[i]) j++;
      let peak = 0;
      for (let k = i; k < j; k++) peak = Math.max(peak, Math.abs(GS.ccurv[k]));
      const big = peak > 1 / 75 && j - i > 25;
      for (let k = i; k < j; k++) {
        const e = Math.min(k - i, j - 1 - k),
          tp = Math.min(1, 0.15 + e / 12),
          room = (raw[i] > 0 ? GS.BARR : GS.BARL)[k] - GS.HW - 4,
          roomIn = (raw[i] > 0 ? GS.BARL : GS.BARR)[k] - GS.HW - 4;
        if (big) {
          const ez = x => {
            const u = Math.min(1, x);
            return u * u * (3 - 2 * u);
          };
          setW(
            raw[i],
            k,
            Math.max(0, Math.min(room, 20)) * Math.max(ez(e / 22), (Math.min(1, 0.15 + e / 12) * 4.8) / 20),
            3.2,
          );
          setW(-raw[i], k, Math.max(0, Math.min(roomIn, 9)) * ez(e / 18), 3.0);
        } else setW(raw[i], k, 4.8 * tp, 1.6);
      }
      i = j;
    }
  }
  // gravel traps on the outside of the tighter corners and their exits
  {
    const strong = new Uint8Array(GS.N);
    for (let i = 0; i < GS.N; i++) {
      let m = 0;
      for (let k = -4; k <= 4; k++) m = Math.max(m, Math.abs(GS.ccurv[(i + k + GS.N) % GS.N]));
      strong[i] = m > 1 / 62 ? 1 : 0;
    }
    const raw = new Int8Array(GS.N);
    for (let i = 0; i < GS.N; i++) {
      let any = 0,
        sum = 0;
      for (let k = -18; k <= 2; k++) {
        const j = (i + k + GS.N) % GS.N;
        if (strong[j]) {
          any = 1;
          sum += GS.ccurv[j];
        }
      }
      if (any && i > 40 && i < GS.N - 60 && !T.street) raw[i] = sum > 0 ? -1 : 1;
    }
    for (let i = 0; i < GS.N; i++) {
      if (!raw[i]) continue;
      let e = 0;
      while (e < 14 && raw[(i + e + 1) % GS.N] === raw[i] && raw[(i - e - 1 + GS.N) % GS.N] === raw[i]) e++;
      const pw = raw[i] > 0 ? GS.PWR[i] : GS.PWL[i];
      if (pw > 6) continue;
      const gi = pw > 0 ? GS.HW + 1 + pw + 1.2 : GS.HW + GIN;
      const w = Math.min((raw[i] > 0 ? GS.BARR : GS.BARL)[i] - 3, GS.HW + 24) - gi;
      if (w < 6) continue;
      GS.gside[i] = raw[i];
      GS.GINA[i] = gi;
      GS.gout[i] = gi + w * Math.min(1, 0.25 + e / 14);
    }
    // tidy the traps (v16.1): join short gaps, drop small ones, then give each trap a smooth inner edge and a smooth, tapered outer edge
    const runs = () => {
      const out = [];
      let a = -1;
      for (let i = 0; i <= GS.N; i++) {
        const g = i < GS.N ? GS.gside[i] : 0;
        if (a >= 0 && (g !== GS.gside[a] || i === GS.N)) {
          out.push([a, i, GS.gside[a]]);
          a = -1;
        }
        if (g && a < 0) a = i;
      }
      return out;
    };
    let rs = runs();
    for (let k = 0; k + 1 < rs.length; k++) {
      const [, b0, s0] = rs[k],
        [a1, , s1] = rs[k + 1];
      if (s0 === s1 && a1 - b0 <= Math.ceil(16 / GS.SEG)) {
        for (let i = b0; i < a1; i++) {
          const t = (i - b0 + 1) / (a1 - b0 + 1);
          GS.gside[i] = s0;
          GS.GINA[i] = GS.GINA[b0 - 1] * (1 - t) + GS.GINA[a1] * t;
        }
      }
    }
    rs = runs();
    const minLen = Math.ceil(50 / GS.SEG);
    // short traps grow to a proper size (mostly towards the corner exit) where there is room for them
    const giAt = (i, sg) => {
      const pw = sg > 0 ? GS.PWR[i] : GS.PWL[i];
      const gi = pw > 0 ? GS.HW + 1 + pw + 1.2 : GS.HW + GIN;
      return Math.min((sg > 0 ? GS.BARR : GS.BARL)[i] - 3, GS.HW + 24) - gi >= 5 ? gi : null;
    };
    for (const [a, b, sg] of rs) {
      const len = b - a;
      if (len >= minLen || len < 2) continue;
      let need = minLen - len,
        fw = Math.ceil(need * 0.65),
        bw = need - fw;
      for (let k = 0; k < fw; k++) {
        const i = b + k;
        if (i >= GS.N - 60 || (GS.gside[i] && GS.gside[i] !== sg)) break;
        const g = giAt(i, sg);
        if (g === null) break;
        GS.gside[i] = sg;
        GS.GINA[i] = g;
      }
      for (let k = 1; k <= bw; k++) {
        const i = a - k;
        if (i <= 40 || (GS.gside[i] && GS.gside[i] !== sg)) break;
        const g = giAt(i, sg);
        if (g === null) break;
        GS.gside[i] = sg;
        GS.GINA[i] = g;
      }
    }
    rs = runs();
    for (const [a, b, sg] of rs) {
      const len = b - a;
      if (len < minLen) {
        for (let i = a; i < b; i++) {
          GS.gside[i] = 0;
        }
        continue;
      }
      const gi = new Float64Array(len),
        wo = new Float64Array(len);
      for (let k = 0; k < len; k++) {
        let m = 0;
        for (let q = -6; q <= 6; q++) {
          const i = clamp(a + k + q, a, b - 1);
          m = Math.max(m, GS.GINA[i]);
        }
        gi[k] = m;
      } // inner edge: never inside the paint, no steps
      for (let k = 0; k < len; k++) {
        let sm = 0,
          n = 0;
        for (let q = -5; q <= 5; q++) {
          const i = clamp(k + q, 0, len - 1);
          sm += gi[i];
          n++;
        }
        gi[k] = sm / n;
      }
      let wmax = 0;
      for (let k = 0; k < len; k++) {
        const i = a + k;
        wo[k] = Math.min((sg > 0 ? GS.BARR : GS.BARL)[i] - 3, GS.HW + 24) - gi[k];
        wmax = Math.max(wmax, wo[k]);
      }
      const W0 = Math.min(wmax, 16);
      if (W0 < 5) {
        for (let i = a; i < b; i++) GS.gside[i] = 0;
        continue;
      }
      for (let k = 0; k < len; k++) {
        const t = Math.min(k, len - 1 - k) / Math.max(1, len * 0.25);
        const tp = t >= 1 ? 1 : t * t * (3 - 2 * t);
        GS.GINA[a + k] = gi[k];
        GS.gout[a + k] = gi[k] + Math.max(2.5, Math.min(wo[k], W0 * (0.35 + 0.65 * tp)));
      }
      for (let r = 0; r < 2; r++) {
        const o = new Float64Array(len);
        for (let k = 0; k < len; k++) {
          let sm = 0,
            n = 0;
          for (let q = -4; q <= 4; q++) {
            const i = clamp(k + q, 0, len - 1);
            sm += GS.gout[a + i];
            n++;
          }
          o[k] = sm / n;
        }
        for (let k = 0; k < len; k++) GS.gout[a + k] = Math.min(o[k], gi[k] + wo[k]);
      }
      for (let k = 0; k < len; k++) if (wo[k] < 2.5) GS.gside[a + k] = 0;
    }
    for (const [a, b] of runs()) if (b - a < minLen) for (let i = a; i < b; i++) GS.gside[i] = 0;
  }
  // racing line (elastic band, curvature minimising)
  {
    const lim = GS.HW - 1.0; // the line uses the whole road, wheels up to the white lines
    for (const [k, it] of [
      [30, 120],
      [16, 140],
      [8, 140],
      [4, 100],
    ]) {
      for (let r = 0; r < it; r++) {
        for (let i = 0; i < GS.N; i++) {
          const a = (i - k + GS.N) % GS.N,
            b = (i + k) % GS.N;
          const ax = GS.cx[a] + GS.nx[a] * GS.off[a],
            ay = GS.cy[a] + GS.ny[a] * GS.off[a],
            bx = GS.cx[b] + GS.nx[b] * GS.off[b],
            by = GS.cy[b] + GS.ny[b] * GS.off[b];
          const px = GS.cx[i] + GS.nx[i] * GS.off[i],
            py = GS.cy[i] + GS.ny[i] * GS.off[i];
          GS.off[i] = clamp(
            GS.off[i] + (((ax + bx) / 2 - px) * GS.nx[i] + ((ay + by) / 2 - py) * GS.ny[i]) * 0.6,
            -lim,
            lim,
          );
        }
      }
    }
  }
  for (let i = 0; i < GS.N; i++) {
    GS.rx[i] = GS.cx[i] + GS.nx[i] * GS.off[i];
    GS.ry[i] = GS.cy[i] + GS.ny[i] * GS.off[i];
  }
  buildProfile();
  // scenery
  GS.HG = null;
  GS.minX = 1e9;
  GS.minY = 1e9;
  GS.maxX = -1e9;
  GS.maxY = -1e9;
  let mx = 0,
    my = 0;
  for (let i = 0; i < GS.N; i++) {
    GS.minX = Math.min(GS.minX, GS.cx[i]);
    GS.maxX = Math.max(GS.maxX, GS.cx[i]);
    GS.minY = Math.min(GS.minY, GS.cy[i]);
    GS.maxY = Math.max(GS.maxY, GS.cy[i]);
    mx += GS.cx[i];
    my += GS.cy[i];
  }
  mx /= GS.N;
  my /= GS.N;
  const outSide = (GS.cx[0] - mx) * GS.nx[0] + (GS.cy[0] - my) * GS.ny[0] > 0 ? 1 : -1; // grandstands go on the outside of the lap
  if (T.elev) {
    const cs = 10,
      x0 = GS.minX - 220,
      y0 = GS.minY - 220,
      gw = Math.ceil((GS.maxX - GS.minX + 440) / cs),
      gh = Math.ceil((GS.maxY - GS.minY + 440) / cs),
      g = new Float32Array(gw * gh);
    for (let gy = 0; gy < gh; gy++)
      for (let gx = 0; gx < gw; gx++) {
        const x = x0 + gx * cs,
          y = y0 + gy * cs;
        let bd = 1e18,
          bh = 0;
        for (let i = 0; i < GS.N; i += 3) {
          const d = (x - GS.cx[i]) ** 2 + (y - GS.cy[i]) ** 2;
          if (d < bd) {
            bd = d;
            bh = GS.HT[i];
          }
        }
        g[gy * gw + gx] = bh;
      }
    GS.HG = { x0, y0, cs, gw, gh, g };
  }
  const clear = (x, y, m) => {
    for (let i = 0; i < GS.N; i += 2) {
      const dx = x - GS.cx[i],
        dy = y - GS.cy[i],
        b = (dx * GS.nx[i] + dy * GS.ny[i] > 0 ? GS.BARR : GS.BARL)[i];
      if (dx * dx + dy * dy < (b + m) ** 2) return false;
    }
    return true;
  };
  GS.WATER = (T.water || []).map(p => p.map(q => [q[0] * T.sc, q[1] * T.sc]));
  GS.TUN = null;
  if (T.tunnel) {
    const near = q => {
      let bi = 0,
        bd = 1e18;
      for (let i = 0; i < GS.N; i++) {
        const d = (GS.cx[i] - q[0] * T.sc) ** 2 + (GS.cy[i] - q[1] * T.sc) ** 2;
        if (d < bd) {
          bd = d;
          bi = i;
        }
      }
      return bi;
    };
    GS.TUN = [near(T.tunnel[0]), near(T.tunnel[1])];
  }
  const inTunnel = i =>
    GS.TUN && (GS.TUN[0] <= GS.TUN[1] ? i >= GS.TUN[0] && i <= GS.TUN[1] : i >= GS.TUN[0] || i <= GS.TUN[1]);
  GS.boxes = [];
  GS.SPHERE = null;
  GS.FOUNT = [];
  GS.WHEEL = null;
  if (T.wheelXY)
    GS.WHEEL = { x: T.wheelXY[0] * T.sc, y: T.wheelXY[1] * T.sc, r: T.wheelXY[2], hz: 0, lit: !!T.night };
  if (T.mbs) {
    const bx0 = T.mbs[0] * T.sc,
      by0 = T.mbs[1] * T.sc,
      H = 62;
    for (let k = -1; k <= 1; k++) {
      const x = bx0 + k * 30,
        y = by0;
      GS.boxes.push({
        pts: [
          [x - 7, y - 10],
          [x + 7, y - 10],
          [x + 7, y + 10],
          [x - 7, y + 10],
        ],
        h: H,
        top: '#9fb0bd',
        side: '#6f8090',
        win: '#6f8090',
        tall: true,
        cx: x,
        cy: y,
        crowd: false,
        lit: true,
      });
    }
    GS.boxes.push({
      pts: [
        [bx0 - 52, by0 - 8],
        [bx0 + 46, by0 - 8],
        [bx0 + 58, by0],
        [bx0 + 46, by0 + 8],
        [bx0 - 52, by0 + 8],
      ],
      z0: H,
      h: 3,
      top: '#c9d6df',
      side: '#8597a6',
      tall: true,
      cx: bx0,
      cy: by0 + 0.1,
      crowd: false,
      neon: '255,240,200',
      sign: '255,240,200',
    });
  }
  GS.FLAGPOLES = [];
  GS.PITLANE = null;
  if (T.sphere) GS.SPHERE = { x: T.sphere[0] * T.sc, y: T.sphere[1] * T.sc, r: T.sphere[2], hz: 0 };
  if (T.fountain) {
    GS.FOUNT = [];
    const f = T.fountain.map(q => [q[0] * T.sc, q[1] * T.sc]);
    for (let k = 0; k <= 24; k++) {
      const u = k / 24;
      GS.FOUNT.push({
        x: f[0][0] + (f[1][0] - f[0][0]) * u,
        y: f[0][1] + (f[1][1] - f[0][1]) * u,
        ph: k * 0.45,
      });
    }
  }
  if (T.street) {
    buildPits(-outSide, 0.4, (a, b, o1, o2, h, top, side, crowd) => ({
      pts: [
        [GS.cx[a] + GS.nx[a] * o1, GS.cy[a] + GS.ny[a] * o1],
        [GS.cx[b] + GS.nx[b] * o1, GS.cy[b] + GS.ny[b] * o1],
        [GS.cx[b] + GS.nx[b] * o2, GS.cy[b] + GS.ny[b] * o2],
        [GS.cx[a] + GS.nx[a] * o2, GS.cy[a] + GS.ny[a] * o2],
      ],
      h,
      top,
      side,
      crowd,
    }));
    for (const b of GS.boxes) {
      b.cx = (b.pts[0][0] + b.pts[2][0]) / 2;
      b.cy = (b.pts[0][1] + b.pts[2][1]) / 2;
    }
    buildCity(T, outSide, clear, inTunnel);
  } else {
    const mk = (a, b, o1, o2, h, top, side, crowd) => ({
      pts: [
        [GS.cx[a] + GS.nx[a] * o1, GS.cy[a] + GS.ny[a] * o1],
        [GS.cx[b] + GS.nx[b] * o1, GS.cy[b] + GS.ny[b] * o1],
        [GS.cx[b] + GS.nx[b] * o2, GS.cy[b] + GS.ny[b] * o2],
        [GS.cx[a] + GS.nx[a] * o2, GS.cy[a] + GS.ny[a] * o2],
      ],
      h,
      top,
      side,
      crowd,
    });
    // (grandstands removed in v16.1)
    buildPits(-outSide, 0.5, mk);
    for (const b of GS.boxes) {
      b.cx = (b.pts[0][0] + b.pts[2][0]) / 2;
      b.cy = (b.pts[0][1] + b.pts[2][1]) / 2;
    }
    GS.boxes = GS.boxes.filter(b => b.pts.every(p => clear(p[0], p[1], 1)));
  }
  GS.STAD = null;
  if (!T.wheelXY) GS.WHEEL = null;
  if (T.wheel) {
    const i = T.wheel[0] % GS.N,
      o = outSide * (GS.BAR[i] + T.wheel[1]);
    const x = GS.cx[i] + GS.nx[i] * o,
      y = GS.cy[i] + GS.ny[i] * o;
    if (clear(x, y, 6)) GS.WHEEL = { x, y, r: 20, hz: hAt(x, y) };
  }
  GS.trees = [];
  {
    const want = T.trees || (T.street ? 60 : T.palms ? 90 : 320);
    let tries = 0;
    while (GS.trees.length < want && tries < want * 20) {
      tries++;
      let x = GS.minX - 150 + rnd() * (GS.maxX - GS.minX + 300),
        y = GS.minY - 150 + rnd() * (GS.maxY - GS.minY + 300);
      if (T.forest && rnd() < 0.8) {
        const i = Math.floor(rnd() * GS.N),
          o = (rnd() < 0.5 ? -1 : 1) * (GS.BAR[i] + 3 + rnd() * rnd() * 90);
        x = GS.cx[i] + GS.nx[i] * o;
        y = GS.cy[i] + GS.ny[i] * o;
      }
      let ok =
        clear(x, y, T.treeGap || 7) &&
        !inWater(x, y) &&
        !(GS.STAD && Math.hypot(x - GS.STAD.x, y - GS.STAD.y) < GS.STAD.r2 + 6) &&
        !(GS.WHEEL && Math.hypot(x - GS.WHEEL.x, y - GS.WHEEL.y) < 14) &&
        !(GS.SPHERE && Math.hypot(x - GS.SPHERE.x, y - GS.SPHERE.y) < GS.SPHERE.r + 8);
      if (ok)
        for (const b of GS.boxes) {
          if ((x - b.cx) ** 2 + (y - b.cy) ** 2 < 26 * 26) {
            ok = false;
            break;
          }
        }
      if (ok) {
        const t: Tree = {
          hz: hAt(x, y),
          x,
          y,
          r: 2.2 + rnd() * 2.2,
          h: (T.palms ? 7 : 4) + rnd() * 4,
          c: rnd(),
          palm: !!T.palms,
        };
        if (T.forest && rnd() < 0.78) {
          t.pine = 1;
          t.h = 11 + rnd() * 9;
          t.r = 2.6 + rnd() * 1.6;
        }
        if (T.sakura && rnd() < 0.62) {
          t.sak = 1;
          t.r = 2.6 + rnd() * 2.2;
        }
        GS.trees.push(t);
      }
    }
  }
  GS.LIGHTS = [];
  if (T.night) {
    let k = 0;
    for (let i = 0; i < GS.N; i += 12) {
      const sg = k++ % 2 ? 1 : -1;
      const o = sg * (GS.BAR[i] + 2.5);
      const x = GS.cx[i] + GS.nx[i] * o,
        y = GS.cy[i] + GS.ny[i] * o;
      GS.LIGHTS.push({
        x,
        y,
        px: GS.cx[i] + GS.nx[i] * sg * GS.HW * 0.2,
        py: GS.cy[i] + GS.ny[i] * sg * GS.HW * 0.2,
        r: 40,
        pole: clear(x, y, 1),
      });
    }
    // a sandstone tower and a lit paddock building by the start line
    const ti = (GS.N - 25) % GS.N,
      o1 = outSideT(outSide) * (GS.BAR[ti] + 30),
      tx0 = GS.cx[ti] + GS.nx[ti] * o1,
      ty0 = GS.cy[ti] + GS.ny[ti] * o1;
    if (clear(tx0, ty0, 8)) {
      const w = 6;
      GS.boxes.push({
        pts: [
          [tx0 - w, ty0 - w],
          [tx0 + w, ty0 - w],
          [tx0 + w, ty0 + w],
          [tx0 - w, ty0 + w],
        ],
        h: 34,
        top: '#e6d2a8',
        side: '#b89a68',
        crowd: false,
        tall: true,
        cx: tx0,
        cy: ty0,
        win: '#e6d2a8',
        lit: true,
      });
    }
  }
  {
    const nats = [];
    for (const t of TEAMS_NAT) for (const n of t) if (!nats.includes(n)) nats.push(n);
    const off0 = T.street ? 1.2 : 2.2;
    nats.forEach((code, k) => {
      const i = (-27 + k * 6 + GS.N) % GS.N,
        o = outSide * (GS.BAR[i] + off0);
      GS.FLAGPOLES.push({ x: GS.cx[i] + GS.nx[i] * o, y: GS.cy[i] + GS.ny[i] * o, code, ph: k * 0.7 });
    });
    if (T.host) {
      const i = (GS.N - 6) % GS.N,
        o = outSide * (GS.BAR[i] + (T.street ? 2 : 6));
      GS.FLAGPOLES.push({
        x: GS.cx[i] + GS.nx[i] * o,
        y: GS.cy[i] + GS.ny[i] * o,
        code: T.host,
        ph: 0,
        big: true,
      });
    }
    for (const f of GS.FLAGPOLES) f.hz = hAt(f.x, f.y);
  }
  for (const b of GS.boxes) b.hz = b.boat ? 0 : hAt(b.cx, b.cy);
  for (const L of GS.LIGHTS) L.hz = hAt(L.px, L.py);
  GS.STONES = [];
  for (let i = 0; i < GS.N; i++) {
    if (!GS.gside[i]) continue;
    for (let k = 0; k < 5; k++) {
      const o = GS.gside[i] * (GS.GINA[i] + rnd() * (GS.gout[i] - GS.GINA[i])),
        u = rnd() * GS.SEG;
      GS.STONES.push([
        GS.cx[i] + GS.nx[i] * o + GS.tx[i] * u,
        GS.cy[i] + GS.ny[i] * o + GS.ty[i] * u,
        GS.HT[i],
      ]);
    }
  }
  GS.MM = [];
  for (let i = 0; i < GS.N; i += 4) GS.MM.push([GS.cx[i], GS.cy[i]]);
  skids.length = 0;
}
