import { GS } from '../state';
import { AC, sfxG } from '../audio/audio';
import { nz } from '../audio/music';
import { DPR, H, W, ctx, cv } from '../core/dom';
import { attract, cars, opts } from '../game/race';
import { P, cam, depth } from './camera';
import { onScr } from './primitives';
import { GLOWS } from './scenery';
import { drawNeon } from './trackside';
// fireworks over the circuit when you finish
export const FW = { on: false, t: 0, p: [], next: 0, last: 0 };
export function FWC() { let f = document.getElementById('fwc') as HTMLCanvasElement; if (!f) {
  f = document.createElement('canvas');
  f.id = 'fwc';
  f.style.cssText = 'position:fixed;inset:0;width:100%;height:100%;pointer-events:none;z-index:9';
  document.body.appendChild(f);
  f.width = cv.width;
  f.height = cv.height;
  f.getContext('2d').setTransform(DPR, 0, 0, DPR, 0, 0);
} return f.getContext('2d'); }
export function startFireworks() { FW.on = true; FW.t = 0; FW.next = 0; FW.p.length = 0; FW.last = performance.now(); }
export function drawFireworks() {
  const ctx = FWC();
  ctx.clearRect(0, 0, W, H);
  const now = performance.now(), dt = Math.min(0.05, (now - FW.last) / 1000);
  FW.last = now;
  FW.t += dt;
  if (FW.t > 14) {
    FW.on = FW.p.length > 0;
    if (!FW.on) {
      ctx.clearRect(0, 0, W, H);
      return;
    }
  }
  FW.next -= dt;
  if (FW.next <= 0 && FW.t < 12) {
    FW.next = 0.25 + Math.random() * 0.45;
    const hue = Math.floor(Math.random() * 360);
    FW.p.push({ x: W * (0.15 + Math.random() * 0.7), y: H + 10, vx: (Math.random() - 0.5) * 60, vy: -(H * 0.9 + Math.random() * H * 0.5), rocket: true, hue, life: 0.9 + Math.random() * 0.5 });
    if (opts.sound && AC && sfxG)
      try {
        nz(AC.currentTime, 0.25, 0.05, 'bandpass', 900, 1);
      }
      catch (e) { }
  }
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  for (let i = FW.p.length - 1; i >= 0; i--) {
    const q = FW.p[i];
    q.life -= dt;
    q.x += q.vx * dt;
    q.y += q.vy * dt;
    q.vy += (q.rocket ? H * 0.55 : H * 0.18) * dt;
    q.vx *= q.rocket ? 1 : 0.985;
    if (q.rocket) {
      ctx.fillStyle = `hsla(${q.hue},90%,80%,0.9)`;
      ctx.fillRect(q.x - 1.5, q.y - 1.5, 3, 3);
      if (q.life <= 0 || q.vy > -H * 0.08) {
        FW.p.splice(i, 1);
        const n = 60 + Math.floor(Math.random() * 40), sp = Math.min(W, H) * (0.32 + Math.random() * 0.18);
        for (let k = 0; k < n; k++) {
          const a = k / n * Math.PI * 2 + Math.random() * 0.1, v = sp * (0.6 + Math.random() * 0.5);
          FW.p.push({ x: q.x, y: q.y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, rocket: false, hue: (q.hue + (Math.random() < 0.3 ? 40 : 0)) % 360, life: 1.1 + Math.random() * 0.8, max: 1.9 });
        }
        if (opts.sound && AC && sfxG)
          try {
            nz(AC.currentTime, 0.35, 0.12, 'lowpass', 700, 0.7);
          }
          catch (e) { }
      }
      continue;
    }
    if (q.life <= 0) {
      FW.p.splice(i, 1);
      continue;
    }
    const a = Math.min(1, q.life / 1.0);
    ctx.fillStyle = `hsla(${q.hue},95%,${55 + 20 * a}%,${a.toFixed(3)})`;
    const r = 2 + 2.6 * a;
    ctx.beginPath();
    ctx.arc(q.x, q.y, r, 0, 7);
    ctx.fill();
  }
  ctx.restore();
}
// the marshal waving the chequered flag at the line once the leader starts the last lap
export function queueFlagMarshal(objs) {
  if (attract || GS.state === 'menu' || !cars.length)
    return;
  const lead = cars.reduce((m, c) => Math.max(m, c.cross || 0), 0);
  if (lead < opts.laps && !cars.some(c => c.finished))
    return;
  const i = 2 % GS.N, sg = GS.PIT_SIDE, o = sg * ((sg > 0 ? GS.BARR : GS.BARL)[i] + 0.6);
  const x = GS.cx[i] + GS.nx[i] * o, y = GS.cy[i] + GS.ny[i] * o;
  objs.push([depth(x, y), 7, () => {
      const z = cam.zoom;
      const S = 2.6;
      const g = P(x, y, GS.HT[i]);
      if (!onScr(g[0], g[1], 60 * z))
        return;
      const pt = (dx, dz) => P(x + GS.tx[i] * dx * S, y + GS.ty[i] * dx * S, GS.HT[i] + dz * S);
      const tm = performance.now() / 1000;
      ctx.strokeStyle = '#222';
      ctx.lineCap = 'round';
      ctx.lineWidth = Math.max(2, 0.28 * z * S);
      const hip = pt(0, 0.95), neck = pt(0, 1.55), head = pt(0, 1.78);
      for (const lx of [-0.18, 0.18]) {
        const f = pt(lx, 0);
        ctx.beginPath();
        ctx.moveTo(f[0], f[1]);
        ctx.lineTo(hip[0], hip[1]);
        ctx.stroke();
      }
      ctx.strokeStyle = '#ff7a1a';
      ctx.lineWidth = Math.max(3, 0.45 * z * S);
      ctx.beginPath();
      ctx.moveTo(hip[0], hip[1]);
      ctx.lineTo(neck[0], neck[1]);
      ctx.stroke();
      ctx.fillStyle = '#f1c9a5';
      ctx.beginPath();
      ctx.arc(head[0], head[1], Math.max(2, 0.16 * z * S), 0, 7);
      ctx.fill();
      const sw = Math.sin(tm * 7);
      const hand = pt(0.35 + 0.25 * sw, 2.25);
      ctx.strokeStyle = '#ff7a1a';
      ctx.lineWidth = Math.max(2, 0.22 * z * S);
      ctx.beginPath();
      ctx.moveTo(neck[0], neck[1]);
      ctx.lineTo(hand[0], hand[1]);
      ctx.stroke();
      const tip = pt(0.35 + 0.25 * sw + 0.15, 3.1);
      ctx.strokeStyle = '#ddd';
      ctx.lineWidth = Math.max(1, 0.08 * z * S);
      ctx.beginPath();
      ctx.moveTo(hand[0], hand[1]);
      ctx.lineTo(tip[0], tip[1]);
      ctx.stroke();
      const fw = 0.95, fh = 0.65, cols = 6, rows = 4;
      const fl = (u, v) => { const ww = Math.sin(tm * 9 - u * 4) * 0.12 * u; const b = pt(0.35 + 0.25 * sw + 0.15 + u * fw * (sw > 0 ? 1 : -1) * 0.9 + 0, 3.1 - v * fh + ww); return b; };
      for (let a = 0; a < cols; a++)
        for (let b = 0; b < rows; b++) {
          const p1 = fl(a / cols, b / rows), p2 = fl((a + 1) / cols, b / rows), p3 = fl((a + 1) / cols, (b + 1) / rows), p4 = fl(a / cols, (b + 1) / rows);
          ctx.fillStyle = (a + b) % 2 ? '#111' : '#fafafa';
          ctx.beginPath();
          ctx.moveTo(p1[0], p1[1]);
          ctx.lineTo(p2[0], p2[1]);
          ctx.lineTo(p3[0], p3[1]);
          ctx.lineTo(p4[0], p4[1]);
          ctx.closePath();
          ctx.fill();
        }
    }]);
}
// cherry blossom petals drifting across the screen
export const PETALS = [];
export function drawPetals() {
  if (!PETALS.length)
    for (let i = 0; i < 70; i++)
      PETALS.push({ x: Math.random(), y: Math.random(), s: 0.4 + Math.random() * 0.6, p: Math.random() * 6 });
  const dt = 1 / 60;
  ctx.fillStyle = 'rgba(255,205,225,0.85)';
  for (const q of PETALS) {
    q.y += dt * 0.05 * q.s;
    q.x += dt * (0.03 + 0.03 * Math.sin(q.p + q.y * 6));
    if (q.y > 1.05) {
      q.y = -0.05;
      q.x = Math.random();
    }
    if (q.x > 1.05)
      q.x = -0.05;
    ctx.save();
    ctx.translate(q.x * W, q.y * H);
    ctx.rotate(q.p + q.y * 8);
    ctx.beginPath();
    ctx.ellipse(0, 0, 3.2 * q.s + 1, 1.6 * q.s + 0.6, 0, 0, 7);
    ctx.fill();
    ctx.restore();
  }
}
// night: darken everything, then punch light pools out of the dark under each floodlight
export const LC = document.createElement('canvas'), lctx = LC.getContext('2d');
// pre-rendered light-pool sprites (much cheaper than building a gradient for every pool every frame)
export const POOLS = (() => {
  const mk = (stops) => { const c = document.createElement('canvas'); c.width = c.height = 128; const x = c.getContext('2d'); const g = x.createRadialGradient(64, 64, 0, 64, 64, 64); stops.forEach(([o, col]) => g.addColorStop(o, col)); x.fillStyle = g; x.fillRect(0, 0, 128, 128); return c; };
  return { cut: mk([[0, 'rgba(0,0,0,0.97)'], [0.55, 'rgba(0,0,0,0.75)'], [1, 'rgba(0,0,0,0)']]), tint: mk([[0, 'rgba(255,214,150,0.10)'], [0.8, 'rgba(255,214,150,0)'], [1, 'rgba(255,214,150,0)']]) };
})();
export function GLOW_FLUSH() {
  if (GS.TR.night) {
    const lw = Math.ceil(cv.width / 2), lh = Math.ceil(cv.height / 2);
    if (LC.width !== lw || LC.height !== lh) {
      LC.width = lw;
      LC.height = lh;
    } // the dark layer is soft, so half resolution is plenty
    lctx.setTransform(DPR / 2, 0, 0, DPR / 2, 0, 0);
    lctx.globalCompositeOperation = 'source-over';
    lctx.clearRect(0, 0, W, H);
    lctx.fillStyle = GS.TR.dark || 'rgba(5,8,24,0.84)';
    lctx.fillRect(0, 0, W, H);
    lctx.globalCompositeOperation = 'destination-out';
    const pools = [];
    for (const L of GS.LIGHTS) {
      GS.PZ = L.hz || 0;
      const p = P(L.px, L.py, 0);
      GS.PZ = 0;
      const r = L.r * cam.zoom;
      if (p[0] < -r || p[0] > W + r || p[1] < -r || p[1] > H + r)
        continue;
      pools.push([p, r]);
      const ry = r * (cam.tilt + 0.15);
      lctx.drawImage(POOLS.cut, p[0] - r, p[1] - ry, 2 * r, 2 * ry);
    }
    for (const b of GS.boxes)
      if (b.crowd || b.lit) {
        const p = P(b.cx, b.cy, b.h + (b.hz || 0));
        const r = 18 * cam.zoom;
        if (!onScr(p[0], p[1], r))
          continue;
        const g = lctx.createRadialGradient(p[0], p[1], 0, p[0], p[1], r);
        g.addColorStop(0, 'rgba(0,0,0,0.8)');
        g.addColorStop(1, 'rgba(0,0,0,0)');
        lctx.fillStyle = g;
        lctx.beginPath();
        lctx.arc(p[0], p[1], r, 0, 7);
        lctx.fill();
      }
    ctx.drawImage(LC, 0, 0, W, H);
    ctx.globalCompositeOperation = 'lighter';
    for (const [p, r] of pools) {
      const ry = r * (cam.tilt + 0.15);
      ctx.drawImage(POOLS.tint, p[0] - r, p[1] - ry, 2 * r, 2 * ry);
    }
    ctx.globalCompositeOperation = 'source-over';
    drawNeon();
    // keep your car's marker readable in the dark
    const me = cars[Math.max(0, GS.ctrl)];
    if (me && !attract) {
      const m = P(me.x, me.y, 3.2 + (me.hz || 0));
      ctx.fillStyle = '#ffe066';
      ctx.beginPath();
      ctx.moveTo(m[0], m[1] + 9);
      ctx.lineTo(m[0] - 9, m[1] - 5);
      ctx.lineTo(m[0] + 9, m[1] - 5);
      ctx.closePath();
      ctx.fill();
    }
  }
  if (GLOWS.length) {
    ctx.globalCompositeOperation = 'lighter';
    for (const [x, y, r, c, a] of GLOWS) {
      const g = ctx.createRadialGradient(x, y, 0, x, y, r);
      g.addColorStop(0, `rgba(${c},${a})`);
      g.addColorStop(1, `rgba(${c},0)`);
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, 7);
      ctx.fill();
    }
    ctx.globalCompositeOperation = 'source-over';
  }
  GLOWS.length = 0;
}
// rain: screen-space streaks plus a cool grey cast
export const RAIN = [];
export function updateRain(dt) {
  if (!RAIN.length)
    for (let i = 0; i < 260; i++)
      RAIN.push({ x: Math.random(), y: Math.random(), l: 0.5 + Math.random() * 0.5, s: 0.9 + Math.random() * 0.6 });
  for (const d of RAIN) {
    d.y += dt * d.s * 1.6;
    d.x -= dt * d.s * 0.25;
    if (d.y > 1.05) {
      d.y = -0.05;
      d.x = Math.random() * 1.2;
    }
    if (d.x < -0.05)
      d.x += 1.1;
  }
}
export function drawRain() {
  if (!RAIN.length)
    updateRain(0);
  ctx.fillStyle = GS.TR.night ? 'rgba(30,40,60,0.12)' : 'rgba(70,82,100,0.22)';
  ctx.fillRect(0, 0, W, H);
  ctx.strokeStyle = 'rgba(205,220,240,0.38)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (const d of RAIN) {
    const x = d.x * W, y = d.y * H, l = 18 * d.l;
    ctx.moveTo(x, y);
    ctx.lineTo(x - l * 0.16, y + l);
  }
  ctx.stroke();
}
