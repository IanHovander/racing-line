import { GS } from '../state';
import { clamp } from '../core/dom';
import { catmull, resample } from '../track/track';
import { CIRCUIT_ICON } from './circuits';
export const CIRCUIT_PLACE = {
  mexico: 'Mexico City, Mexico',
  texas: 'Austin, Texas, USA',
  paulista: 'São Paulo, Brazil',
  monte: 'Monte Carlo, Monaco',
  sakhir: 'Sakhir, Bahrain',
  suzuka: 'Suzuka, Japan',
  spa: 'Spa, Belgium',
  singapore: 'Marina Bay, Singapore',
};
export const circuitIcon = (id, sz) =>
  `<svg viewBox="0 0 40 40" width="${sz}" height="${sz}" class="ci">${CIRCUIT_ICON[id] || ''}</svg>`;
// rough centreline for menu thumbnails (same spline + smoothing as buildTrack, at a coarser step)
export const LAYOUT = {};
export function trackLayout(T) {
  if (LAYOUT[T.id]) return LAYOUT[T.id];
  const CP = T.cp.map(p => [p[0] * T.sc, p[1] * T.sc]);
  let pts = [];
  const n = CP.length;
  for (let i = 0; i < n; i++) {
    const p0 = CP[(i - 1 + n) % n],
      p1 = CP[i],
      p2 = CP[(i + 1) % n],
      p3 = CP[(i + 2) % n];
    for (let k = 0; k < 40; k++) pts.push(catmull(p0, p1, p2, p3, k / 40));
  }
  pts = resample(pts, 6);
  for (let it = 0; it < Math.ceil((T.smooth || 40) / 3); it++) {
    const m = pts.length;
    pts = pts.map((p, i) => {
      const a = pts[(i - 1 + m) % m],
        b = pts[(i + 1) % m];
      return [p[0] * 0.5 + (a[0] + b[0]) * 0.25, p[1] * 0.5 + (a[1] + b[1]) * 0.25];
    });
  }
  return (LAYOUT[T.id] = pts);
}
export function layoutPath(pts, w, h, pad) {
  let x0 = 1e9,
    y0 = 1e9,
    x1 = -1e9,
    y1 = -1e9;
  for (const [x, y] of pts) {
    x0 = Math.min(x0, x);
    x1 = Math.max(x1, x);
    y0 = Math.min(y0, y);
    y1 = Math.max(y1, y);
  }
  const k = Math.min((w - 2 * pad) / (x1 - x0), (h - 2 * pad) / (y1 - y0)),
    ox = (w - (x1 - x0) * k) / 2 - x0 * k,
    oy = (h - (y1 - y0) * k) / 2 - y0 * k;
  const f = p => [+(p[0] * k + ox).toFixed(1), +(p[1] * k + oy).toFixed(1)];
  return { f, d: 'M' + pts.map(p => f(p).join(' ')).join('L') + 'Z' };
}
// circuit-step map: seen from a low angle (28°), track raised to its true height, walls beneath, ground shadow, corner numbers; drag to turn
export let MAPYAW = 30;
/** the circuit the map shows: its centre line, heights, sectors, DRS zones and corners, copied when the
 *  picker shows a circuit (which need not be the one racing behind the menu) */
let MAPD: any = null;
export function setMapData(): void {
  MAPD = { N: GS.N, cx: GS.cx, cy: GS.cy, HT: GS.HT, SECI: GS.SECI, DRSZ: GS.DRSZ, CORNERS: GS.CORNERS };
}
export function drawTrackMap() {
  return `<canvas class="big" width="720" height="440" aria-label="Circuit map — drag to turn it"></canvas><div class="lg"><div><i style="background:#ff5a5a"></i>S1</div><div><i style="background:#ffd166"></i>S2</div><div><i style="background:#5ab0ff"></i>S3</div><div><i style="background:#2ecc71"></i>DRS</div></div>`;
}
export function elevProfile() {
  const W = 360,
    H = 64,
    st = 4;
  let hmin = 1e9,
    hmax = -1e9;
  for (let i = 0; i < GS.N; i++) {
    hmin = Math.min(hmin, GS.HT[i]);
    hmax = Math.max(hmax, GS.HT[i]);
  }
  const rng = Math.max(1, hmax - hmin);
  const X = i => 8 + ((W - 16) * i) / GS.N,
    Y = h => H - 8 - ((h - hmin) / rng) * (H - 24);
  let d = '';
  for (let i = 0; i <= GS.N; i += st)
    d += (i ? 'L' : 'M') + X(i).toFixed(1) + ' ' + Y(GS.HT[i % GS.N]).toFixed(1);
  const SC = ['#ff5a5a', '#ffd166', '#5ab0ff'];
  let g = '';
  for (let k = 0; k < 3; k++) {
    const a = GS.SECI[k],
      b = k < 2 ? GS.SECI[k + 1] : GS.N;
    let p = '';
    for (let i = a; i <= b; i += st)
      p += (i === a ? 'M' : 'L') + X(i).toFixed(1) + ' ' + Y(GS.HT[i % GS.N]).toFixed(1);
    g += `<path d="${p}" fill="none" stroke="${SC[k]}" stroke-width="2"/>`;
  }
  for (const z of GS.DRSZ) {
    const a = z.z0,
      b = z.z1 > z.z0 ? z.z1 : z.z1 + GS.N;
    g += `<line x1="${X(a)}" y1="${H - 3}" x2="${X(Math.min(b, GS.N))}" y2="${H - 3}" stroke="#2ecc71" stroke-width="2.5" stroke-linecap="round"/>`;
    if (b > GS.N)
      g += `<line x1="${X(0)}" y1="${H - 3}" x2="${X(b - GS.N)}" y2="${H - 3}" stroke="#2ecc71" stroke-width="2.5" stroke-linecap="round"/>`;
  }
  return `<svg class="prof" viewBox="0 0 ${W} ${H}"><path d="${d}L${W - 8} ${H - 6}L8 ${H - 6}Z" fill="rgba(255,255,255,.09)"/>${g}<text x="10" y="11" font-size="9" fill="#fff" opacity=".7" font-family="Geist,system-ui">Elevation · ${Math.round(rng)} m</text></svg>`;
}
export function renderTrackMap(cv) {
  const M = MAPD || GS;
  if (!cv) return;
  const ctx = cv.getContext('2d'),
    W = cv.width,
    H = cv.height;
  ctx.clearRect(0, 0, W, H);
  const st = 4,
    idx = [];
  for (let i = 0; i < M.N; i += st) idx.push(i);
  const n = idx.length;
  let mx = 0,
    my = 0,
    hmin = 1e9;
  for (const i of idx) {
    mx += M.cx[i];
    my += M.cy[i];
    hmin = Math.min(hmin, M.HT[i]);
  }
  mx /= n;
  my /= n;
  const a = (MAPYAW * Math.PI) / 180,
    pr = (28 * Math.PI) / 180,
    sp = Math.sin(pr),
    cp = Math.cos(pr);
  // exaggerate height so climbs read clearly: relief scaled to ~7% of the layout's size (between 1.25x and 3.5x true height)
  let hmax = -1e9,
    span = 0;
  for (const i of idx) {
    hmax = Math.max(hmax, M.HT[i]);
    span = Math.max(span, Math.hypot(M.cx[i] - mx, M.cy[i] - my));
  }
  const EX = hmax - hmin > 0.5 ? clamp((0.14 * span) / (hmax - hmin), 1.25, 3.5) : 1;
  const proj = (i, ground) => {
    const dx = M.cx[i] - mx,
      dy = M.cy[i] - my;
    const u = dx * Math.cos(a) - dy * Math.sin(a),
      v = dx * Math.sin(a) + dy * Math.cos(a);
    return [u, v * sp - (ground ? 0 : M.HT[i] - hmin) * cp * EX, v];
  };
  const Q = idx.map(i => proj(i, 0)),
    G = idx.map(i => proj(i, 1));
  let x0 = 1e9,
    x1 = -1e9,
    y0 = 1e9,
    y1 = -1e9;
  for (const q of Q.concat(G)) {
    x0 = Math.min(x0, q[0]);
    x1 = Math.max(x1, q[0]);
    y0 = Math.min(y0, q[1]);
    y1 = Math.max(y1, q[1]);
  }
  const pad = W * 0.07,
    k = Math.min((W - 2 * pad) / (x1 - x0), (H - 2 * pad) / (y1 - y0)),
    ox = W / 2 - ((x0 + x1) / 2) * k,
    oy = H / 2 - ((y0 + y1) / 2) * k;
  const S = q => [q[0] * k + ox, q[1] * k + oy];
  const lw = W / 150;
  ctx.lineJoin = 'round';
  ctx.beginPath();
  G.forEach((q, j) => {
    const p = S(q);
    j ? ctx.lineTo(...p) : ctx.moveTo(...p);
  });
  ctx.closePath();
  ctx.strokeStyle = 'rgba(0,0,0,.55)';
  ctx.lineWidth = lw * 2.6;
  ctx.stroke();
  const SC = ['#ff5a5a', '#ffd166', '#5ab0ff'];
  const secOf = i => (i >= M.SECI[2] ? 2 : i >= M.SECI[1] ? 1 : 0);
  const inDrs = i => M.DRSZ.some(z => (z.z0 <= z.z1 ? i >= z.z0 && i <= z.z1 : i >= z.z0 || i <= z.z1));
  const order = [...Array(n).keys()].sort(
    (p, q) => Q[p][2] + Q[(p + 1) % n][2] - (Q[q][2] + Q[(q + 1) % n][2]),
  );
  for (const j of order) {
    const j2 = (j + 1) % n,
      i = idx[j];
    const a1 = S(Q[j]),
      a2 = S(Q[j2]),
      g1 = S(G[j]),
      g2 = S(G[j2]);
    ctx.beginPath();
    ctx.moveTo(...g1);
    ctx.lineTo(...g2);
    ctx.lineTo(...a2);
    ctx.lineTo(...a1);
    ctx.closePath();
    ctx.fillStyle = 'rgba(200,215,235,.13)';
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(...a1);
    ctx.lineTo(...a2);
    ctx.lineCap = 'round';
    ctx.lineWidth = lw * 1.25;
    ctx.strokeStyle = SC[secOf(i)];
    ctx.stroke();
    if (inDrs(i)) {
      const dx = a2[0] - a1[0],
        dy = a2[1] - a1[1],
        L2 = Math.hypot(dx, dy) || 1;
      const ux = (-dy / L2) * lw * 2,
        uy = (dx / L2) * lw * 2;
      ctx.beginPath();
      ctx.moveTo(a1[0] + ux, a1[1] + uy);
      ctx.lineTo(a2[0] + ux, a2[1] + uy);
      ctx.strokeStyle = '#2ecc71';
      ctx.lineWidth = lw * 0.8;
      ctx.stroke();
    }
  }
  {
    const a1 = S(Q[0]),
      a2 = S(Q[1]);
    const dx = a2[0] - a1[0],
      dy = a2[1] - a1[1],
      L2 = Math.hypot(dx, dy) || 1;
    const ux = (-dy / L2) * lw * 2.2,
      uy = (dx / L2) * lw * 2.2;
    ctx.beginPath();
    ctx.moveTo(a1[0] - ux, a1[1] - uy);
    ctx.lineTo(a1[0] + ux, a1[1] + uy);
    ctx.lineCap = 'butt';
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = lw * 0.9;
    ctx.stroke();
    ctx.setLineDash([lw * 0.6, lw * 0.6]);
    ctx.strokeStyle = '#111';
    ctx.stroke();
    ctx.setLineDash([]);
  }
  ctx.font = `700 ${Math.round(lw * 3.1)}px Geist,system-ui,sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  for (const c of M.CORNERS) {
    const j = Math.round(c.apex / st) % n;
    const q = S(Q[j]);
    ctx.lineWidth = lw * 1.1;
    ctx.strokeStyle = '#000';
    ctx.strokeText(c.n, q[0], q[1] - lw * 3.4);
    ctx.fillStyle = '#fff';
    ctx.fillText(c.n, q[0], q[1] - lw * 3.4);
  }
}
export function bindTrackMap() {
  const cv = document.querySelector('#trkMap canvas');
  if (!cv) return;
  renderTrackMap(cv);
  let dx = null;
  cv.addEventListener('pointerdown', (e: PointerEvent) => {
    dx = e.clientX;
    cv.setPointerCapture(e.pointerId);
  });
  cv.addEventListener('pointermove', (e: PointerEvent) => {
    if (dx === null) return;
    MAPYAW = (MAPYAW + (e.clientX - dx) * 0.5 + 360) % 360;
    dx = e.clientX;
    renderTrackMap(cv);
  });
  cv.addEventListener('pointerup', () => (dx = null));
  cv.addEventListener('pointercancel', () => (dx = null));
}
/** debug/test hook: reassign a module-level binding */
export function __set(name: string, v: any): void {
  switch (name) {
    case 'MAPYAW':
      MAPYAW = v;
      break;
  }
}
