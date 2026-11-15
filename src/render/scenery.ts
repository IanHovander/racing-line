import { GS } from '../state';
import { ctx } from '../core/dom';
import { P, cam } from './camera';
import { onScr } from './primitives';
import { FLAGS } from '../teams/teams';
const pineSprite = new Image();
pineSprite.src = new URL('../../pine-realistic.png', import.meta.url).href;
const birchSprite = new Image();
birchSprite.src = new URL('../../birch-realistic.png', import.meta.url).href;
const undergrowthSprites = [new Image(), new Image()];
undergrowthSprites[0].src = new URL('../../undergrowth-cluster.png', import.meta.url).href;
undergrowthSprites[1].src = new URL('../../shrub-cluster.png', import.meta.url).href;
const boulderSprite = new Image();
boulderSprite.src = new URL('../../moss-boulder.png', import.meta.url).href;

function drawGroundSprite(sprite: HTMLImageElement, item, width: number, heightRatio: number) {
  if (!sprite.complete || !sprite.naturalWidth) return;
  const g = P(item.x, item.y, 0);
  const w = width * cam.zoom;
  const h = w * (sprite.naturalHeight / sprite.naturalWidth) * heightRatio;
  if (!onScr(g[0], g[1], w)) return;
  if (item.c < 0.5) {
    ctx.drawImage(sprite, g[0] - w / 2, g[1] - h, w, h);
  } else {
    ctx.save();
    ctx.translate(g[0], 0);
    ctx.scale(-1, 1);
    ctx.drawImage(sprite, -w / 2, g[1] - h, w, h);
    ctx.restore();
  }
}

export function drawUndergrowth(item) {
  const sprite = undergrowthSprites[item.variant || 0];
  drawGroundSprite(sprite, item, item.w, 0.72);
}

export function drawBoulder(item) {
  drawGroundSprite(boulderSprite, item, item.w, 0.72);
}

function drawSpeciesSprite(sprite: HTMLImageElement, t, g, zTop = 0.88) {
  if (!sprite.complete || !sprite.naturalWidth) return;
  const top = P(t.x, t.y, t.h * zTop);
  const h = g[1] - top[1];
  const shape = t.r / Math.max(1, t.h * 0.22);
  const w = h * (sprite.naturalWidth / sprite.naturalHeight) * Math.max(0.8, Math.min(1.3, shape));
  if (t.c < 0.5) {
    ctx.drawImage(sprite, g[0] - w / 2, top[1], w, h);
  } else {
    ctx.save();
    ctx.translate(g[0], 0);
    ctx.scale(-1, 1);
    ctx.drawImage(sprite, -w / 2, top[1], w, h);
    ctx.restore();
  }
}

export function drawTree(t) {
  GS.PZ = t.hz || 0;
  try {
    drawTree0(t);
  } finally {
    GS.PZ = 0;
  }
}
export function drawTree0(t) {
  const g = P(t.x, t.y, 0);
  const R = t.r * cam.zoom;
  if (!onScr(g[0], g[1], R * 3 + 60)) return;
  if (t.pine) {
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.beginPath();
    ctx.ellipse(g[0] + R * 0.5, g[1] + R * 0.15, R * 1.1, R * cam.tilt, 0, 0, 7);
    ctx.fill();
    drawSpeciesSprite(pineSprite, t, g);
    return;
  }
  if (t.birch) {
    ctx.fillStyle = 'rgba(0,0,0,0.23)';
    ctx.beginPath();
    ctx.ellipse(g[0] + R * 0.35, g[1] + R * 0.15, R * 1.35, R * cam.tilt, 0, 0, 7);
    ctx.fill();
    drawSpeciesSprite(birchSprite, t, g);
    return;
  }
  if (t.palm) {
    const tp = P(t.x, t.y, t.h);
    ctx.strokeStyle = '#6b5132';
    ctx.lineWidth = Math.max(1, 0.3 * cam.zoom);
    ctx.beginPath();
    ctx.moveTo(g[0], g[1]);
    ctx.quadraticCurveTo(g[0] + R * 0.4, (g[1] + tp[1]) / 2, tp[0], tp[1]);
    ctx.stroke();
    ctx.strokeStyle = t.c < 0.5 ? '#3f7a2e' : '#4f8c35';
    ctx.lineWidth = Math.max(1.5, 0.5 * cam.zoom);
    for (let k = 0; k < 7; k++) {
      const a = (k / 7) * Math.PI * 2 + t.c * 3;
      ctx.beginPath();
      ctx.moveTo(tp[0], tp[1]);
      ctx.quadraticCurveTo(
        tp[0] + Math.cos(a) * R * 0.9,
        tp[1] + Math.sin(a) * R * 0.5 - R * 0.4,
        tp[0] + Math.cos(a) * R * 1.5,
        tp[1] + Math.sin(a) * R * 0.8 + R * 0.3,
      );
      ctx.stroke();
    }
    return;
  }
  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  ctx.beginPath();
  ctx.ellipse(g[0] + R * 0.4, g[1] + R * 0.15, R, R * cam.tilt, 0, 0, 7);
  ctx.fill();
  const tp = P(t.x, t.y, t.h);
  ctx.strokeStyle = '#5a3d22';
  ctx.lineWidth = Math.max(1, 0.35 * cam.zoom);
  ctx.beginPath();
  ctx.moveTo(g[0], g[1]);
  ctx.lineTo(tp[0], tp[1]);
  ctx.stroke();
  if (t.sak) {
    ctx.fillStyle = t.c < 0.5 ? '#e88fb2' : '#f0a3c2';
    ctx.beginPath();
    ctx.arc(tp[0], tp[1], R, 0, 7);
    ctx.fill();
    ctx.fillStyle = t.c < 0.5 ? '#f6bfd5' : '#fbd3e3';
    ctx.beginPath();
    ctx.arc(tp[0] - R * 0.25, tp[1] - R * 0.3, R * 0.6, 0, 7);
    ctx.fill();
    ctx.fillStyle = '#fff0f6';
    for (let k = 0; k < 5; k++) {
      const a = k * 1.3 + t.c * 9;
      ctx.beginPath();
      ctx.arc(tp[0] + Math.cos(a) * R * 0.6, tp[1] + Math.sin(a) * R * 0.5, Math.max(1, R * 0.12), 0, 7);
      ctx.fill();
    }
    return;
  }
  ctx.fillStyle = t.c < 0.5 ? '#1f5a25' : '#2a6b2a';
  ctx.beginPath();
  ctx.arc(tp[0], tp[1], R, 0, 7);
  ctx.fill();
  ctx.fillStyle = t.c < 0.5 ? '#2d7633' : '#3b8a36';
  ctx.beginPath();
  ctx.arc(tp[0] - R * 0.25, tp[1] - R * 0.3, R * 0.55, 0, 7);
  ctx.fill();
}
GS.CARSCR = [0, 0];
GS.CARDEP = 0;
GS.AHEAD = [];
GS.HMUL = 1;
export const GLOWS = [];
export const FLAGIMG = {};
export function flagImg(code) {
  if (FLAGIMG[code] !== undefined) return FLAGIMG[code];
  FLAGIMG[code] = null;
  const im = new Image();
  im.onload = () => {
    const cv2 = document.createElement('canvas');
    cv2.width = 60;
    cv2.height = 40;
    cv2.getContext('2d').drawImage(im, 0, 0, 60, 40);
    FLAGIMG[code] = cv2;
  };
  im.src =
    'data:image/svg+xml;charset=utf-8,' +
    encodeURIComponent(
      `<svg xmlns="http://www.w3.org/2000/svg" width="60" height="40" viewBox="0 0 30 20">${FLAGS[code][1]}</svg>`,
    );
  return null;
}
// waving flags are pre-rendered into 12 animation frames per flag and size, so each flag is one image per frame
export const FLAGANIM: Record<string, any> = {};
export function flagFrames(code, im, fw) {
  const key = code + '|' + fw;
  if (FLAGANIM[key]) return FLAGANIM[key];
  const fh = Math.round((fw * 2) / 3),
    pad = Math.ceil(fh * 0.14) + 1,
    n = 12,
    sl = 12,
    arr: any = [];
  for (let j = 0; j < n; j++) {
    const c = document.createElement('canvas');
    c.width = fw + 2;
    c.height = fh + pad * 2;
    const x = c.getContext('2d');
    const tt = (j / n) * Math.PI * 2;
    for (let k = 0; k < sl; k++) {
      const u = k / sl,
        wv = Math.sin(tt - u * 5) * fh * 0.12 * u;
      x.drawImage(im, u * 60, 0, 60 / sl + 0.5, 40, u * fw, pad + wv, fw / sl + 0.6, fh);
    }
    arr.push(c);
  }
  arr.pad = pad;
  const keys = Object.keys(FLAGANIM);
  if (keys.length > 60) delete FLAGANIM[keys[0]];
  FLAGANIM[key] = arr;
  return arr;
}
export function drawFlagpole(f) {
  GS.PZ = f.hz || 0;
  try {
    const b = P(f.x, f.y, 0);
    if (!onScr(b[0], b[1], 40 * cam.zoom)) return;
    const t = P(f.x, f.y, f.big ? 24 : 9);
    ctx.strokeStyle = '#d9dde2';
    ctx.lineWidth = Math.max(1, 0.18 * cam.zoom);
    ctx.beginPath();
    ctx.moveTo(b[0], b[1]);
    ctx.lineTo(t[0], t[1]);
    ctx.stroke();
    const im = flagImg(f.code);
    const fw = Math.max(14, cam.zoom * 2.7) * (f.big ? 3 : 1),
      fh = (fw * 2) / 3,
      tm = performance.now() / 1000;
    if (im) {
      const fq = Math.round(Math.pow(2, Math.round(Math.log2(fw) * 3) / 3));
      const sc = fw / fq;
      const fr = flagFrames(f.code, im, fq);
      const ph = ((tm * 4 + f.ph) / (Math.PI * 2)) % 1;
      const k = Math.floor((ph < 0 ? ph + 1 : ph) * fr.length) % fr.length;
      const cvF = fr[k];
      ctx.drawImage(cvF, t[0], t[1] - fr.pad * sc, cvF.width * sc, cvF.height * sc);
    } // frames are built at a few fixed sizes and scaled, so zooming never rebuilds them
    else {
      ctx.fillStyle = '#ccc';
      ctx.fillRect(t[0], t[1], fw, fh);
    }
  } finally {
    GS.PZ = 0;
  }
}
export function drawPole(L) {
  GS.PZ = L.hz || 0;
  try {
    drawPole0(L);
  } finally {
    GS.PZ = 0;
  }
}
export function drawPole0(L) {
  const b = P(L.x, L.y, 0);
  if (!onScr(b[0], b[1], 60 * cam.zoom)) return;
  const t = P(L.x, L.y, 20);
  ctx.strokeStyle = '#3b3f46';
  ctx.lineWidth = Math.max(1.5, 0.35 * cam.zoom);
  ctx.beginPath();
  ctx.moveTo(b[0], b[1]);
  ctx.lineTo(t[0], t[1]);
  ctx.stroke();
  ctx.fillStyle = '#22252a';
  ctx.fillRect(t[0] - cam.zoom * 0.9, t[1] - cam.zoom * 0.5, cam.zoom * 1.8, cam.zoom * 0.9);
  GLOWS.push([t[0], t[1], cam.zoom * 2.2, '255,236,190', 1]);
}
