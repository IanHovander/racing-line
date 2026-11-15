import { GS } from '../state';
import { render3dFrame } from '../render3d/switch';
import { drawCarMarks } from './car';
import { $, H, W, clamp, ctx } from '../core/dom';
import { attract, cars, opts } from '../game/race';
import { drawBox } from './buildings';
import { P, cam, depth } from './camera';
import { drawCar } from './car';
import { FW, GLOW_FLUSH, drawFireworks, drawPetals, drawRain, queueFlagMarshal } from './effects';
import { BAND_RULE, band, onScr } from './primitives';
import { GLOWS, drawBoulder, drawFlagpole, drawPole, drawTree, drawUndergrowth } from './scenery';
import {
  ADQ,
  drawBridge,
  drawSphere,
  drawTunnelFloor,
  drawWalls,
  drawWheel,
  queuePortals,
  secBoard,
  signBoard,
} from './trackside';
import { laneOff } from '../sim/ai';
import { liveZone, profileFor } from '../sim/profile';
import { clearTime } from '../sim/step';
import { TEAMS } from '../teams/teams';
import { parts, skids } from '../track/active';
import { NEONQ } from '../track/track';
const meadowTexture = new Image();
meadowTexture.src = new URL('../../meadow-groundcover.png', import.meta.url).href;
const mowedGrassTexture = new Image();
mowedGrassTexture.src = new URL('../../mowed-grass.png', import.meta.url).href;
const gravelTexture = new Image();
gravelTexture.src = new URL('../../gravel-surface.png', import.meta.url).href;
const asphaltTexture = new Image();
asphaltTexture.src = new URL('../../asphalt-surface.png', import.meta.url).href;
let meadowPattern: CanvasPattern | null = null;
let mowedGrassPattern: CanvasPattern | null = null;
let gravelPattern: CanvasPattern | null = null;
let asphaltPattern: CanvasPattern | null = null;

function worldTextureTransform(pattern: CanvasPattern, texture: HTMLImageElement, tileWorldWidth: number) {
  const scale = tileWorldWidth / texture.naturalWidth;
  const a = -cam.zoom * GS.cS * scale;
  const b = -cam.zoom * cam.tilt * GS.cC * scale;
  const c = cam.zoom * GS.cC * scale;
  const d = -cam.zoom * cam.tilt * GS.cS * scale;
  const e = GS.OX + cam.zoom * (cam.x * GS.cS - cam.y * GS.cC);
  const f = GS.OY + cam.zoom * (cam.tilt * (cam.x * GS.cC + cam.y * GS.cS) + cam.z * cam.hz);
  pattern.setTransform(new DOMMatrix([a, b, c, d, e, f]));
}

function fillGroundBackground() {
  ctx.fillStyle = GS.TR.bg;
  ctx.fillRect(0, 0, W, H);
  if (!GS.TR.forest || !meadowTexture.complete || !meadowTexture.naturalWidth) return;
  meadowPattern ??= ctx.createPattern(meadowTexture, 'repeat');
  if (!meadowPattern) return;
  worldTextureTransform(meadowPattern, meadowTexture, 56);
  ctx.fillStyle = meadowPattern;
  ctx.fillRect(0, 0, W, H);
}

function fillBarrierGrass() {
  if (!GS.TR.forest || !mowedGrassTexture.complete || !mowedGrassTexture.naturalWidth) return;
  mowedGrassPattern ??= ctx.createPattern(mowedGrassTexture, 'repeat');
  if (!mowedGrassPattern) return;
  worldTextureTransform(mowedGrassPattern, mowedGrassTexture, 168);
  band(GS.SIDES, mowedGrassPattern);
}

function texturePattern(texture: HTMLImageElement, current: CanvasPattern | null, tileWidth: number) {
  if (!texture.complete || !texture.naturalWidth) return current;
  const pattern = current || ctx.createPattern(texture, 'repeat');
  if (pattern) worldTextureTransform(pattern, texture, tileWidth);
  return pattern;
}

export function render() {
  NEONQ.length = 0;
  GS.cS = Math.sin(cam.a);
  GS.cC = Math.cos(cam.a);
  GS.OX = W / 2;
  // where the followed car sits on screen; higher on the main screen so it clears the big buttons
  GS.OY = H * (attract && GS.state === 'menu' ? 0.48 : opts.cam === 0 ? 0.64 : 0.56);
  // three.js layer (branch three-js, ?three): it draws the world; the canvas stays clear on top
  if (render3dFrame()) {
    ctx.clearRect(0, 0, W, H);
    // overlays the 3D scene doesn't draw: car markers and players' name tags
    cars.forEach((c, i) => {
      if (c.gone) return;
      GS.PZ = c.hz || 0;
      drawCarMarks(c, !attract && i === GS.ctrl, !attract && i === GS.mateIdx);
    });
    GS.PZ = 0;
    if (GS.state !== 'menu') minimap();
    return;
  }
  fillGroundBackground();
  const z = cam.zoom,
    t = cam.tilt;
  for (let i = 0; i < GS.N; i++) {
    const dx = GS.cx[i] - cam.x,
      dy = GS.cy[i] - cam.y;
    GS.TSX[i] = GS.OX + z * (-dx * GS.cS + dy * GS.cC);
    GS.TSY[i] = GS.OY - z * t * (dx * GS.cC + dy * GS.cS) - (GS.HT[i] - cam.z) * z * cam.hz;
    GS.NSX[i] = z * (-GS.nx[i] * GS.cS + GS.ny[i] * GS.cC);
    GS.NSY[i] = -z * t * (GS.nx[i] * GS.cC + GS.ny[i] * GS.cS);
  }
  for (const poly of GS.WATER) {
    ctx.beginPath();
    poly.forEach((q, k) => {
      const p = P(q[0], q[1], -0.6);
      k ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1]);
    });
    ctx.closePath();
    ctx.fillStyle = '#1f6f9a';
    ctx.fill();
    ctx.strokeStyle = '#d8d2c2';
    ctx.lineWidth = Math.max(2, z * 0.8);
    ctx.stroke();
    ctx.save();
    ctx.clip();
    ctx.strokeStyle = 'rgba(255,255,255,0.08)';
    ctx.lineWidth = 1;
    const tt = performance.now() / 2000;
    for (let k = -20; k < 20; k++) {
      ctx.beginPath();
      ctx.moveTo(-50, H / 2 + k * 40 + Math.sin(tt + k) * 6);
      ctx.lineTo(W + 50, H / 2 + k * 40 + Math.sin(tt + k + 1) * 6);
      ctx.stroke();
    }
    ctx.restore();
  }
  band(GS.SIDES, GS.TR.run);
  fillBarrierGrass();
  // mowing stripes inside runoff
  if (!GS.TR.street) {
    ctx.save();
    band(GS.SIDES, GS.TR.run, 0, false);
    ctx.clip(BAND_RULE as CanvasFillRule);
    ctx.strokeStyle = 'rgba(255,255,255,0.035)';
    ctx.lineWidth = 5 * z;
    ctx.beginPath();
    for (let i = 0; i < GS.N; i += 10) {
      if (!onScr(GS.TSX[i], GS.TSY[i], 40 * z)) continue;
      const b = GS.BARR[i],
        bl = GS.BARL[i];
      ctx.moveTo(GS.TSX[i] + GS.NSX[i] * b, GS.TSY[i] + GS.NSY[i] * b);
      ctx.lineTo(GS.TSX[i] - GS.NSX[i] * bl, GS.TSY[i] - GS.NSY[i] * bl);
    }
    ctx.stroke();
    ctx.restore();
  }
  // gravel traps
  {
    const gp = new Path2D();
    for (let i = 0; i < GS.N; i++) {
      const j = (i + 1) % GS.N;
      if (!GS.gside[i] || !GS.gside[j]) continue;
      if (!onScr(GS.TSX[i], GS.TSY[i], 40 * z)) continue;
      const sg = GS.gside[i];
      const a1 = sg * GS.GINA[i],
        b1 = sg * GS.gout[i],
        b2 = sg * GS.gout[j];
      gp.moveTo(GS.TSX[i] + GS.NSX[i] * a1, GS.TSY[i] + GS.NSY[i] * a1);
      gp.lineTo(GS.TSX[j] + GS.NSX[j] * a1, GS.TSY[j] + GS.NSY[j] * a1);
      gp.lineTo(GS.TSX[j] + GS.NSX[j] * b2, GS.TSY[j] + GS.NSY[j] * b2);
      gp.lineTo(GS.TSX[i] + GS.NSX[i] * b1, GS.TSY[i] + GS.NSY[i] * b1);
      gp.closePath();
    }
    gravelPattern = texturePattern(gravelTexture, gravelPattern, 96);
    ctx.fillStyle = gravelPattern || '#cbb68a';
    ctx.fill(gp);
    ctx.fillStyle = 'rgba(110,95,70,0.55)';
    for (const p of GS.STONES) {
      const q = P(p[0], p[1], p[2] || 0);
      if (onScr(q[0], q[1], 5)) ctx.fillRect(q[0], q[1], Math.max(1, z * 0.25), Math.max(1, z * 0.2));
    }
  }
  if (GS.TR.paint) {
    const bandsP = GS.TR.paint.map(() => new Path2D());
    for (const sg of [1, -1]) {
      const Wd = sg > 0 ? GS.PWR : GS.PWL,
        Sw = sg > 0 ? GS.SWR : GS.SWL;
      for (let i = 0; i < GS.N; i++) {
        const j = (i + 1) % GS.N;
        if (Wd[i] <= 0.05 || Wd[j] <= 0.05) continue;
        if (!onScr(GS.TSX[i], GS.TSY[i], 60 * z)) continue;
        const sw = Sw[i] || 1.6,
          nS = Math.ceil(Math.max(Wd[i], Wd[j]) / sw);
        for (let b = 0; b < nS; b++) {
          const a0 = GS.HW + 1 + Math.min(b * sw, Wd[i]),
            a1 = GS.HW + 1 + Math.min((b + 1) * sw, Wd[i]),
            c0 = GS.HW + 1 + Math.min(b * sw, Wd[j]),
            c1 = GS.HW + 1 + Math.min((b + 1) * sw, Wd[j]);
          if (a1 - a0 < 0.02 && c1 - c0 < 0.02) continue;
          const p = bandsP[b % bandsP.length];
          p.moveTo(GS.TSX[i] + GS.NSX[i] * sg * a0, GS.TSY[i] + GS.NSY[i] * sg * a0);
          p.lineTo(GS.TSX[j] + GS.NSX[j] * sg * c0, GS.TSY[j] + GS.NSY[j] * sg * c0);
          p.lineTo(GS.TSX[j] + GS.NSX[j] * sg * c1, GS.TSY[j] + GS.NSY[j] * sg * c1);
          p.lineTo(GS.TSX[i] + GS.NSX[i] * sg * a1, GS.TSY[i] + GS.NSY[i] * sg * a1);
          p.closePath();
        }
      }
    }
    GS.TR.paint.forEach((col, b) => {
      ctx.fillStyle = col;
      ctx.fill(bandsP[b]);
    });
  }
  band(GS.HW + 0.45, '#ececec');
  asphaltPattern = texturePattern(asphaltTexture, asphaltPattern, 120);
  band(GS.HW, asphaltPattern || (opts.rain ? '#35373c' : '#46484e'));
  if (GS.BRIDGE) {
    const B = GS.BRIDGE;
    ctx.fillStyle = 'rgba(0,0,0,0.28)';
    ctx.beginPath();
    for (let k = -B.r0; k < B.r1; k++) {
      const i = (B.up + k + GS.N) % GS.N,
        j = (i + 1) % GS.N;
      const b1 = GS.BAR[i],
        b2 = GS.BAR[j];
      const q = [
        P(GS.cx[i] + GS.nx[i] * b1, GS.cy[i] + GS.ny[i] * b1, B.hl),
        P(GS.cx[j] + GS.nx[j] * b2, GS.cy[j] + GS.ny[j] * b2, B.hl),
        P(GS.cx[j] - GS.nx[j] * b2, GS.cy[j] - GS.ny[j] * b2, B.hl),
        P(GS.cx[i] - GS.nx[i] * b1, GS.cy[i] - GS.ny[i] * b1, B.hl),
      ];
      ctx.moveTo(q[0][0], q[0][1]);
      for (let u = 1; u < 4; u++) ctx.lineTo(q[u][0], q[u][1]);
      ctx.closePath();
    }
    ctx.fill();
  }
  if (GS.TR.elev) {
    const lv = 8,
      up = [],
      dn = [];
    for (let q = 0; q < lv; q++) {
      up.push(new Path2D());
      dn.push(new Path2D());
    }
    for (let i = 0; i < GS.N; i++) {
      const sl = GS.SL[i];
      if (Math.abs(sl) < 0.008) continue;
      const j = (i + 1) % GS.N;
      if (!onScr(GS.TSX[i], GS.TSY[i], 40 * z)) continue;
      const q = Math.min(lv - 1, Math.floor(Math.abs(sl) / 0.012));
      const p = (sl > 0 ? up : dn)[q];
      const bi = GS.BARR[i],
        bj = GS.BARR[j],
        li = GS.BARL[i],
        lj = GS.BARL[j];
      p.moveTo(GS.TSX[i] + GS.NSX[i] * bi, GS.TSY[i] + GS.NSY[i] * bi);
      p.lineTo(GS.TSX[j] + GS.NSX[j] * bj, GS.TSY[j] + GS.NSY[j] * bj);
      p.lineTo(GS.TSX[j] - GS.NSX[j] * lj, GS.TSY[j] - GS.NSY[j] * lj);
      p.lineTo(GS.TSX[i] - GS.NSX[i] * li, GS.TSY[i] - GS.NSY[i] * li);
      p.closePath();
    }
    for (let q = 0; q < lv; q++) {
      ctx.fillStyle = `rgba(255,250,235,${(0.05 + q * 0.03).toFixed(3)})`;
      ctx.fill(up[q]);
      ctx.fillStyle = `rgba(0,0,20,${(0.07 + q * 0.04).toFixed(3)})`;
      ctx.fill(dn[q]);
    }
  }
  // rubbered-in line
  ctx.strokeStyle = 'rgba(0,0,0,0.16)';
  ctx.lineWidth = 2.2 * z;
  ctx.lineJoin = 'round';
  ctx.beginPath();
  for (let i = 0; i <= GS.N; i++) {
    const k = i % GS.N;
    const x = GS.TSX[k] + GS.NSX[k] * GS.off[k],
      y = GS.TSY[k] + GS.NSY[k] * GS.off[k];
    i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
  }
  ctx.stroke();
  // kerbs
  const kr = new Path2D(),
    kw = new Path2D();
  for (let i = 0; i < GS.N; i++) {
    if (!GS.kerb[i]) continue;
    const j = (i + 1) % GS.N;
    if (!onScr(GS.TSX[i], GS.TSY[i], 30 * z)) continue;
    const p = Math.floor(i / 2) % 2 ? kr : kw;
    for (const sg of [1, -1]) {
      const o1 = sg * (GS.HW - 0.5),
        o2 = sg * (GS.HW + 1.4);
      p.moveTo(GS.TSX[i] + GS.NSX[i] * o1, GS.TSY[i] + GS.NSY[i] * o1);
      p.lineTo(GS.TSX[j] + GS.NSX[j] * o1, GS.TSY[j] + GS.NSY[j] * o1);
      p.lineTo(GS.TSX[j] + GS.NSX[j] * o2, GS.TSY[j] + GS.NSY[j] * o2);
      p.lineTo(GS.TSX[i] + GS.NSX[i] * o2, GS.TSY[i] + GS.NSY[i] * o2);
      p.closePath();
    }
  }
  ctx.fillStyle = '#d42a2a';
  ctx.fill(kr);
  ctx.fillStyle = '#f4f4f4';
  ctx.fill(kw);
  // pit lane in front of the garages
  if (GS.PITLANE) {
    const p = new Path2D(),
      wk = new Path2D(),
      ln = new Path2D();
    const sg = GS.PITLANE.side,
      SB = sg > 0 ? GS.BARR : GS.BARL,
      w = GS.PITLANE.w;
    for (let k = 0; k < GS.PITLANE.n; k++) {
      const i = (GS.PITLANE.i0 + k) % GS.N,
        j = (i + 1) % GS.N;
      if (!onScr(GS.TSX[i], GS.TSY[i], 60 * z)) continue;
      const q = (o0i, o1i, o0j, o1j, path) => {
        path.moveTo(GS.TSX[i] + GS.NSX[i] * sg * o0i, GS.TSY[i] + GS.NSY[i] * sg * o0i);
        path.lineTo(GS.TSX[j] + GS.NSX[j] * sg * o0j, GS.TSY[j] + GS.NSY[j] * sg * o0j);
        path.lineTo(GS.TSX[j] + GS.NSX[j] * sg * o1j, GS.TSY[j] + GS.NSY[j] * sg * o1j);
        path.lineTo(GS.TSX[i] + GS.NSX[i] * sg * o1i, GS.TSY[i] + GS.NSY[i] * sg * o1i);
        path.closePath();
      };
      const bi = SB[i] + 0.5,
        bj = SB[j] + 0.5;
      q(bi, bi + w, bj, bj + w, p);
      q(bi + w * 0.55, bi + w, bj + w * 0.55, bj + w, wk);
      ln.moveTo(GS.TSX[i] + GS.NSX[i] * sg * (bi + w * 0.55), GS.TSY[i] + GS.NSY[i] * sg * (bi + w * 0.55));
      ln.lineTo(GS.TSX[j] + GS.NSX[j] * sg * (bj + w * 0.55), GS.TSY[j] + GS.NSY[j] * sg * (bj + w * 0.55));
    }
    ctx.fillStyle = opts.rain ? '#3a3c41' : '#4b4d53';
    ctx.fill(p);
    ctx.fillStyle = opts.rain ? '#55575c' : '#6a6c72';
    ctx.fill(wk);
    // team boxes painted in front of each garage
    for (const bx of GS.boxes) {
      if (!bx.garage) continue;
      const A0 = bx.pts[0],
        A1 = bx.pts[1];
      const T2 = TEAMS[bx.team];
      const mxp = (A0[0] + A1[0]) / 2,
        myp = (A0[1] + A1[1]) / 2;
      const ux = A1[0] - A0[0],
        uy = A1[1] - A0[1],
        ul = Math.hypot(ux, uy) || 1;
      const vx = -(mxp - bx.cx),
        vy = -(myp - bx.cy),
        vl = Math.hypot(vx, vy) || 1;
      const c = [mxp + (vx / vl) * w * 0.22, myp + (vy / vl) * w * 0.22];
      const hz = bx.hz || 0;
      const pt = (a, bb) =>
        P(c[0] + (ux / ul) * a + (vx / vl) * bb, c[1] + (uy / ul) * a + (vy / vl) * bb, hz);
      const qq = [
        pt(-ul * 0.38, -w * 0.2),
        pt(ul * 0.38, -w * 0.2),
        pt(ul * 0.38, w * 0.2),
        pt(-ul * 0.38, w * 0.2),
      ];
      if (!onScr(qq[0][0], qq[0][1], 40)) continue;
      ctx.fillStyle = T2.col;
      ctx.globalAlpha = 0.45;
      ctx.beginPath();
      qq.forEach((v, k) => (k ? ctx.lineTo(v[0], v[1]) : ctx.moveTo(v[0], v[1])));
      ctx.closePath();
      ctx.fill();
      ctx.globalAlpha = 1;
      ctx.strokeStyle = 'rgba(255,255,255,0.8)';
      ctx.lineWidth = Math.max(1, 0.12 * z);
      ctx.stroke();
    }
    ctx.strokeStyle = 'rgba(255,255,255,0.85)';
    ctx.lineWidth = Math.max(1, 0.18 * z);
    ctx.stroke(ln);
    // pit speed-limit lines across the lane at both ends
    ctx.strokeStyle = 'rgba(255,255,255,0.9)';
    ctx.lineWidth = Math.max(1.5, 0.35 * z);
    ctx.beginPath();
    for (const k of [2, GS.PITLANE.n - 2]) {
      const i = (GS.PITLANE.i0 + k) % GS.N,
        a0 = SB[i] + 0.5,
        a1 = a0 + w;
      ctx.moveTo(GS.TSX[i] + GS.NSX[i] * sg * a0, GS.TSY[i] + GS.NSY[i] * sg * a0);
      ctx.lineTo(GS.TSX[i] + GS.NSX[i] * sg * a1, GS.TSY[i] + GS.NSY[i] * sg * a1);
    }
    ctx.stroke();
  }
  // start line checker
  {
    const i = 0;
    for (let r = 0; r < 2; r++)
      for (let q = 0; q < 10; q++) {
        const o1 = -GS.HW + q * 1.4,
          o2 = o1 + 1.4,
          a = r * 1.2,
          b = a + 1.2;
        const pts4 = [
          [o1, a],
          [o2, a],
          [o2, b],
          [o1, b],
        ].map(([o, s]) =>
          P(GS.cx[i] + GS.nx[i] * o + GS.tx[i] * s, GS.cy[i] + GS.ny[i] * o + GS.ty[i] * s, GS.HT[i]),
        );
        ctx.fillStyle = (q + r) % 2 ? '#111' : '#fff';
        ctx.beginPath();
        pts4.forEach((p, k) => (k ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1])));
        ctx.closePath();
        ctx.fill();
      }
  }
  // grid slots
  ctx.strokeStyle = 'rgba(255,255,255,0.8)';
  ctx.lineWidth = Math.max(1, 0.2 * z);
  ctx.beginPath();
  for (let g = 0; g < 10; g++) {
    const sD = GS.L - 10 - g * 7.5 + 2.9;
    const i = Math.round(sD / GS.SEG) % GS.N;
    const lat = g % 2 ? 2.8 : -2.8;
    const a = P(GS.cx[i] + GS.nx[i] * (lat - 1.1), GS.cy[i] + GS.ny[i] * (lat - 1.1), GS.HT[i]),
      b = P(GS.cx[i] + GS.nx[i] * (lat + 1.1), GS.cy[i] + GS.ny[i] * (lat + 1.1), GS.HT[i]);
    ctx.moveTo(a[0], a[1]);
    ctx.lineTo(b[0], b[1]);
  }
  ctx.stroke();
  // racing line overlay
  if (opts.line && !attract && cars[GS.ctrl] && GS.PZONE.team !== cars[GS.ctrl].team) {
    GS.PZONE = new Uint8Array(GS.N);
    GS.PZONE.team = cars[GS.ctrl].team;
    profileFor(cars[GS.ctrl].st, GS.PZONE);
  }
  if (opts.line && !attract) {
    const ZN = liveZone(cars[GS.ctrl], GS.PZONE.length === GS.N ? GS.PZONE : GS.zone);
    const cols = ['rgba(120,255,120,0.55)', 'rgba(255,70,60,0.75)', 'rgba(255,214,10,0.65)'];
    ctx.lineWidth = Math.max(1.5, 0.3 * z);
    ctx.setLineDash([z * 1.6, z * 1.2]);
    for (let zc = 0; zc < 3; zc++) {
      ctx.strokeStyle = cols[zc];
      ctx.beginPath();
      for (let i = 0; i < GS.N; i++) {
        if (ZN[i] !== zc) continue;
        const j = (i + 1) % GS.N;
        if (!onScr(GS.TSX[i], GS.TSY[i], 20)) continue;
        ctx.moveTo(GS.TSX[i] + GS.NSX[i] * GS.off[i], GS.TSY[i] + GS.NSY[i] * GS.off[i]);
        ctx.lineTo(GS.TSX[j] + GS.NSX[j] * GS.off[j], GS.TSY[j] + GS.NSY[j] * GS.off[j]);
      }
      ctx.stroke();
    }
    ctx.setLineDash([]);
  }
  // yellow flag zones
  if (opts.yellow && !attract)
    for (const o of cars) {
      if (!o.out || o.gone) continue;
      const i0 = (o.idx - 80 + GS.N) % GS.N;
      ctx.strokeStyle = 'rgba(255,212,0,0.55)';
      ctx.lineWidth = Math.max(2, 0.45 * z);
      ctx.setLineDash([z * 2, z * 1.5]);
      for (const sg of [1, -1]) {
        ctx.beginPath();
        for (let k = 0; k <= 92; k++) {
          const i = (i0 + k) % GS.N,
            b = sg * (GS.HW + 0.2);
          const x = GS.TSX[i] + GS.NSX[i] * b,
            y = GS.TSY[i] + GS.NSY[i] * b;
          k ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
        }
        ctx.stroke();
      }
      ctx.setLineDash([]);
      for (const k of [0, 80]) {
        const i = (i0 + k) % GS.N,
          b = GS.BARR[i] - 0.6;
        const base = P(GS.cx[i] + GS.nx[i] * b, GS.cy[i] + GS.ny[i] * b, GS.HT[i]),
          top = P(GS.cx[i] + GS.nx[i] * b, GS.cy[i] + GS.ny[i] * b, GS.HT[i] + 4.2);
        ctx.strokeStyle = '#333';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(base[0], base[1]);
        ctx.lineTo(top[0], top[1]);
        ctx.stroke();
        const w = Math.sin(performance.now() / 120 + k) * 0.35,
          fl = 1.6 * z;
        ctx.fillStyle = '#ffd400';
        ctx.beginPath();
        ctx.moveTo(top[0], top[1]);
        ctx.lineTo(top[0] + fl * (0.9 + w * 0.3), top[1] + fl * (0.15 + w));
        ctx.lineTo(top[0] + fl * (0.85 - w * 0.2), top[1] + fl * (0.75 + w));
        ctx.lineTo(top[0], top[1] + fl * 0.6);
        ctx.closePath();
        ctx.fill();
      }
    }
  // lane steering: show where the car is heading
  if (opts.steer === 3 && !attract && cars[GS.ctrl] && GS.state === 'race') {
    const c = cars[GS.ctrl],
      o = GS.PASS.side ? GS.PASS.car : GS.PASS.near;
    if (o && !o.gone) {
      const i = o.idx,
        x = GS.TSX[i] + GS.NSX[i] * o.lat,
        y = GS.TSY[i] + GS.NSY[i] * o.lat;
      ctx.strokeStyle = GS.PASS.side ? 'rgba(255,224,102,0.85)' : 'rgba(255,255,255,0.55)';
      ctx.lineWidth = Math.max(2, 0.3 * z);
      ctx.beginPath();
      ctx.ellipse(x, y, 4.2 * z, 3.2 * z * Math.max(0.5, cam.tilt || 0.6), 0, 0, Math.PI * 2);
      ctx.stroke();
      if (GS.PASS.side) {
        ctx.strokeStyle = 'rgba(255,224,102,0.55)';
        ctx.lineWidth = Math.max(2, 0.35 * z);
        ctx.setLineDash([z * 1.2, z * 1.6]);
        ctx.beginPath();
        const sl = clamp(o.lat + GS.PASS.side * 3.2, -(GS.HW - 1.1), GS.HW - 1.1);
        for (let q = 4; q <= 40; q++) {
          const j = (c.idx + q) % GS.N;
          const a = clamp((q - 4) / 10, 0, 1);
          const tl = c.lat * (1 - a) + sl * a;
          const xx = GS.TSX[j] + GS.NSX[j] * tl,
            yy = GS.TSY[j] + GS.NSY[j] * tl;
          q > 4 ? ctx.lineTo(xx, yy) : ctx.moveTo(xx, yy);
        }
        ctx.stroke();
        ctx.setLineDash([]);
      }
    }
  }
  if (opts.steer === 1 && !attract && cars[GS.ctrl]) {
    const c = cars[GS.ctrl],
      s = c.lsm || 0,
      a = Math.abs(s);
    ctx.strokeStyle = 'rgba(255,224,102,0.55)';
    ctx.lineWidth = Math.max(2, 0.35 * z);
    ctx.setLineDash([z * 1.2, z * 1.6]);
    ctx.beginPath();
    for (let q = 4; q <= 40; q++) {
      const i = (c.idx + q) % GS.N;
      const tl = GS.off[i] * (1 - a) + laneOff(s) * a;
      const x = GS.TSX[i] + GS.NSX[i] * tl,
        y = GS.TSY[i] + GS.NSY[i] * tl;
      q > 4 ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
    }
    ctx.stroke();
    ctx.setLineDash([]);
  }
  // barriers: solid walls with a face, a top and (on some stretches) sponsor boards; catch fences where the circuit has them
  drawWalls(z);
  drawTunnelFloor(z);
  // sector lines across the track and corner number boards on the outside of each apex
  ctx.lineWidth = Math.max(1, 0.22 * z);
  for (let k = 1; k < 3; k++) {
    const i = GS.SECI[k];
    if (!onScr(GS.TSX[i], GS.TSY[i], 80 * z)) continue;
    ctx.strokeStyle = 'rgba(255,255,255,0.45)';
    ctx.setLineDash([z * 0.8, z * 0.8]);
    ctx.beginPath();
    ctx.moveTo(GS.TSX[i] + GS.NSX[i] * GS.HW, GS.TSY[i] + GS.NSY[i] * GS.HW);
    ctx.lineTo(GS.TSX[i] - GS.NSX[i] * GS.HW, GS.TSY[i] - GS.NSY[i] * GS.HW);
    ctx.stroke();
    ctx.setLineDash([]);
    secBoard(i, k);
  }
  if (onScr(GS.TSX[GS.SECI[0]], GS.TSY[GS.SECI[0]], 80 * z)) secBoard(GS.SECI[0], 0);
  for (const dz of GS.DRSZ) {
    if (onScr(GS.TSX[dz.z0], GS.TSY[dz.z0], 80 * z))
      signBoard(dz.z0, GS.BARL[dz.z0] < GS.BARR[dz.z0] ? -1 : 1, 'DRS', '#1f6fff');
    const i = dz.det;
    if (onScr(GS.TSX[i], GS.TSY[i], 80 * z)) {
      ctx.strokeStyle = 'rgba(120,170,255,0.55)';
      ctx.setLineDash([z * 0.5, z * 0.5]);
      ctx.beginPath();
      ctx.moveTo(GS.TSX[i] + GS.NSX[i] * GS.HW, GS.TSY[i] + GS.NSY[i] * GS.HW);
      ctx.lineTo(GS.TSX[i] - GS.NSX[i] * GS.HW, GS.TSY[i] - GS.NSY[i] * GS.HW);
      ctx.stroke();
      ctx.setLineDash([]);
    }
  }
  if (z > 2.5 && opts.turns)
    for (const cn of GS.CORNERS) {
      const i = cn.apex;
      if (!onScr(GS.TSX[i], GS.TSY[i], 60 * z)) continue;
      signBoard(i, -cn.dir, String(cn.n), '#1b1d22');
    }
  // pit entry / exit lanes cut through the runoff and the barrier line
  if (GS.PITLANE && GS.PITLANE.ramps) {
    const sg = GS.PITLANE.side,
      hw = GS.PITLANE.w * 0.5;
    const p = new Path2D(),
      ln = new Path2D();
    for (const R of GS.PITLANE.ramps)
      for (let k = 0; k < R.length - 1; k++) {
        const [i, c0] = R[k],
          [j, c1] = R[k + 1];
        if (!onScr(GS.TSX[i], GS.TSY[i], 60 * z)) continue;
        const a0 = sg * (c0 - hw),
          a1 = sg * (c0 + hw),
          b0 = sg * (c1 - hw),
          b1 = sg * (c1 + hw);
        p.moveTo(GS.TSX[i] + GS.NSX[i] * a0, GS.TSY[i] + GS.NSY[i] * a0);
        p.lineTo(GS.TSX[j] + GS.NSX[j] * b0, GS.TSY[j] + GS.NSY[j] * b0);
        p.lineTo(GS.TSX[j] + GS.NSX[j] * b1, GS.TSY[j] + GS.NSY[j] * b1);
        p.lineTo(GS.TSX[i] + GS.NSX[i] * a1, GS.TSY[i] + GS.NSY[i] * a1);
        p.closePath();
        for (const [aa, bb] of [
          [a0, b0],
          [a1, b1],
        ]) {
          ln.moveTo(GS.TSX[i] + GS.NSX[i] * aa, GS.TSY[i] + GS.NSY[i] * aa);
          ln.lineTo(GS.TSX[j] + GS.NSX[j] * bb, GS.TSY[j] + GS.NSY[j] * bb);
        }
      }
    ctx.fillStyle = opts.rain ? '#3a3c41' : '#4b4d53';
    ctx.fill(p);
    ctx.strokeStyle = 'rgba(255,255,255,0.75)';
    ctx.lineWidth = Math.max(1, 0.18 * z);
    ctx.stroke(ln);
  }
  // skids
  ctx.strokeStyle = 'rgba(20,20,20,0.35)';
  ctx.lineWidth = Math.max(1, 0.3 * z);
  ctx.beginPath();
  for (const s of skids) {
    const a = P(s[0], s[1], s[4] || 0);
    if (!onScr(a[0], a[1], 10)) continue;
    const b = P(s[2], s[3], s[4] || 0);
    ctx.moveTo(a[0], a[1]);
    ctx.lineTo(b[0], b[1]);
  }
  ctx.stroke();
  // objects sorted by depth
  GS.HMUL += (1 - GS.HMUL) * 0.08;
  {
    const me = cars[Math.max(0, GS.ctrl)];
    GS.AHEAD = [];
    if (me) {
      GS.CARSCR = P(me.x, me.y, 0.5);
      GS.CARDEP = depth(me.x, me.y);
      GS.AHEAD.push([GS.CARSCR[0], GS.CARSCR[1], GS.CARDEP]);
      // every bit of road on screen counts: a building that sits in front of any of it sinks, wherever your car is
      if (GS.TR.street || GS.TR.night)
        for (let i = 0; i < GS.N; i += 2) {
          if (!onScr(GS.TSX[i], GS.TSY[i], 8)) continue;
          GS.AHEAD.push([GS.TSX[i], GS.TSY[i], depth(GS.cx[i], GS.cy[i])]);
          for (const sg of [1, -1]) {
            const b = (sg > 0 ? GS.BARR : GS.BARL)[i] * sg;
            const x = GS.TSX[i] + GS.NSX[i] * b,
              y = GS.TSY[i] + GS.NSY[i] * b;
            if (onScr(x, y, 0))
              GS.AHEAD.push([x, y, depth(GS.cx[i] + GS.nx[i] * b, GS.cy[i] + GS.ny[i] * b)]);
          }
        }
    }
  }
  const objs = [];
  for (const tr of GS.trees) objs.push([depth(tr.x, tr.y), 0, tr]);
  for (const shrub of GS.undergrowth) objs.push([depth(shrub.x, shrub.y), 8, shrub]);
  for (const rock of GS.boulders) objs.push([depth(rock.x, rock.y), 9, rock]);
  for (const b of GS.boxes) objs.push([depth(b.cx, b.cy) + 6, 1, b]);
  cars.forEach((c, i) => {
    if (!c.gone) objs.push([depth(c.x, c.y), 2, c, i]);
  });
  objs.sort((a, b) => b[0] - a[0]);
  GLOWS.length = 0;
  for (const L of GS.LIGHTS) if (L.pole) objs.push([depth(L.x, L.y), 3, L]);
  for (const f of GS.FLAGPOLES) objs.push([depth(f.x, f.y), 4, f]);
  for (const a of ADQ) objs.push([a[0], 7, a[1]]);
  queuePortals(objs);
  queueFlagMarshal(objs);
  if (GS.WHEEL) objs.push([depth(GS.WHEEL.x, GS.WHEEL.y), 5, GS.WHEEL]);
  if (GS.SPHERE) objs.push([depth(GS.SPHERE.x, GS.SPHERE.y), 6, GS.SPHERE]);
  objs.sort((a, b) => b[0] - a[0]);
  for (const o of objs) {
    if (o[1] === 3) {
      drawPole(o[2]);
      continue;
    }
    if (o[1] === 5) {
      drawWheel(o[2]);
      continue;
    }
    if (o[1] === 7) {
      o[2]();
      continue;
    }
    if (o[1] === 6) {
      drawSphere(o[2]);
      continue;
    }
    if (o[1] === 4) {
      drawFlagpole(o[2]);
      continue;
    }
    if (o[1] === 0) drawTree(o[2]);
    else if (o[1] === 1) drawBox(o[2]);
    else if (o[1] === 8) drawUndergrowth(o[2]);
    else if (o[1] === 9) drawBoulder(o[2]);
    else {
      const c = o[2];
      const g = P(c.x, c.y, 0);
      if (onScr(g[0], g[1], 60)) {
        if (c.ghost > 0) ctx.globalAlpha = 0.45 + 0.2 * Math.sin(performance.now() / 80);
        if (c.out) {
          const left = clearTime() - c.outT;
          if (left < 1) ctx.globalAlpha = Math.max(0, left);
        }
        drawCar(c, !attract && o[3] === GS.ctrl, !attract && o[3] === GS.mateIdx);
        ctx.globalAlpha = 1;
      }
    }
  }
  drawBridge();
  // particles
  for (const p of parts) {
    const q = P(p.x, p.y, p.z);
    ctx.globalAlpha = clamp(p.life / p.max, 0, 1) * (p.spray ? 0.22 : 0.55);
    ctx.fillStyle = p.col;
    ctx.beginPath();
    ctx.arc(q[0], q[1], p.r * z, 0, 7);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
  GLOW_FLUSH();
  if (GS.TR.sakura) drawPetals();
  if (FW.on) drawFireworks();
  if (opts.rain) drawRain();
  if (GS.state !== 'menu') minimap();
}
export function minimap() {
  const s = Math.min(110, W * 0.26),
    x0 = W - s - 12,
    y0 = $('btns').getBoundingClientRect().bottom + 12;
  const sc = s / Math.max(GS.maxX - GS.minX, GS.maxY - GS.minY);
  const ox = x0 + (s - (GS.maxX - GS.minX) * sc) / 2,
    oy = y0 + (s - (GS.maxY - GS.minY) * sc) / 2;
  ctx.fillStyle = 'rgba(10,12,18,0.55)';
  ctx.beginPath();
  ctx.roundRect ? ctx.roundRect(x0 - 6, y0 - 6, s + 12, s + 12, 8) : ctx.rect(x0 - 6, y0 - 6, s + 12, s + 12);
  ctx.fill();
  ctx.strokeStyle = '#ddd';
  ctx.lineWidth = 3;
  ctx.lineJoin = 'round';
  ctx.beginPath();
  GS.MM.forEach((p, i) => {
    const X = ox + (p[0] - GS.minX) * sc,
      Y = oy + (p[1] - GS.minY) * sc;
    i ? ctx.lineTo(X, Y) : ctx.moveTo(X, Y);
  });
  ctx.closePath();
  ctx.stroke();
  const sl = [ox + (GS.cx[0] - GS.minX) * sc, oy + (GS.cy[0] - GS.minY) * sc];
  ctx.fillStyle = '#fff';
  ctx.fillRect(sl[0] - 1, sl[1] - 4, 3, 8);
  cars.forEach((c, i) => {
    if (c.gone) return;
    const X = ox + (c.x - GS.minX) * sc,
      Y = oy + (c.y - GS.minY) * sc;
    if (c.out) {
      ctx.fillStyle = '#ffd400';
      ctx.beginPath();
      ctx.arc(X, Y, 6, 0, 7);
      ctx.fill();
    }
    const me = i === GS.ctrl,
      mt = i === GS.mateIdx;
    ctx.fillStyle = c.col;
    ctx.strokeStyle = me ? '#ffe066' : mt ? '#bfe3ff' : '#000';
    ctx.lineWidth = me || mt ? 2 : 1;
    ctx.beginPath();
    ctx.arc(X, Y, me || mt ? 4.5 : 3, 0, 7);
    ctx.fill();
    ctx.stroke();
  });
}
