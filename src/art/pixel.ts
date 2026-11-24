// Pixel art, drawn in code. Every sprite is painted at its true size into a small buffer (one colour per pixel, no
// blending), turned into a canvas once, and scaled up by whole numbers with smoothing off, so it stays crisp on any
// screen. Shapes snap to whole pixels. Nothing here touches the game's state: the kit can be used on any page.

/** A painted sprite, ready to blit. */
export interface Art {
  canvas: HTMLCanvasElement;
  w: number;
  h: number;
  /** where the sprite's "foot" or centre sits, for placing it (defaults to the middle of the bottom row) */
  ax: number;
  ay: number;
}

const rgbaCache = new Map<string, number>();
/** '#rrggbb' (or '#rgb') to a little-endian ABGR word for ImageData */
export function rgba(hex: string): number {
  let v = rgbaCache.get(hex);
  if (v !== undefined) return v;
  let h = hex.replace('#', '');
  if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
  const n = parseInt(h.slice(0, 6), 16);
  const a = h.length === 8 ? parseInt(h.slice(6, 8), 16) : 255;
  v = ((a << 24) | ((n & 255) << 16) | (n & 0xff00) | ((n >> 16) & 255)) >>> 0;
  rgbaCache.set(hex, v);
  return v;
}

/** Paints into a w x h pixel buffer. Colours are '#rrggbb'; null or '' paints nothing. */
export class Painter {
  readonly w: number;
  readonly h: number;
  readonly buf: Uint32Array;
  private readonly img: ImageData;
  /** offset added to every coordinate, for drawing parts in their own frame */
  ox = 0;
  oy = 0;
  constructor(w: number, h: number) {
    this.w = w;
    this.h = h;
    this.img = new ImageData(w, h);
    this.buf = new Uint32Array(this.img.data.buffer);
  }
  px(x: number, y: number, c: string | null) {
    if (!c) return;
    x = Math.round(x + this.ox);
    y = Math.round(y + this.oy);
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return;
    this.buf[y * this.w + x] = rgba(c);
  }
  /** true where something has been painted */
  on(x: number, y: number) {
    x = Math.round(x + this.ox);
    y = Math.round(y + this.oy);
    return x >= 0 && y >= 0 && x < this.w && y < this.h && this.buf[y * this.w + x] >>> 24 > 0;
  }
  rect(x: number, y: number, w: number, h: number, c: string | null) {
    if (!c) return;
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) this.px(x + i, y + j, c);
  }
  hline(x0: number, x1: number, y: number, c: string | null) {
    if (x1 < x0) [x0, x1] = [x1, x0];
    for (let x = x0; x <= x1; x++) this.px(x, y, c);
  }
  vline(x: number, y0: number, y1: number, c: string | null) {
    if (y1 < y0) [y0, y1] = [y1, y0];
    for (let y = y0; y <= y1; y++) this.px(x, y, c);
  }
  /** Bresenham line, both ends included */
  line(x0: number, y0: number, x1: number, y1: number, c: string | null) {
    x0 = Math.round(x0);
    y0 = Math.round(y0);
    x1 = Math.round(x1);
    y1 = Math.round(y1);
    const dx = Math.abs(x1 - x0),
      dy = -Math.abs(y1 - y0),
      sx = x0 < x1 ? 1 : -1,
      sy = y0 < y1 ? 1 : -1;
    let err = dx + dy;
    for (;;) {
      this.px(x0, y0, c);
      if (x0 === x1 && y0 === y1) break;
      const e2 = 2 * err;
      if (e2 >= dy) {
        err += dy;
        x0 += sx;
      }
      if (e2 <= dx) {
        err += dx;
        y0 += sy;
      }
    }
  }
  /** a filled ellipse inside the box x..x+w-1, y..y+h-1 (so even sizes stay symmetric) */
  oval(x: number, y: number, w: number, h: number, c: string | null) {
    const cx = x + w / 2,
      cy = y + h / 2,
      rx = w / 2,
      ry = h / 2;
    for (let j = 0; j < h; j++) {
      const dy = (y + j + 0.5 - cy) / ry;
      const half = rx * Math.sqrt(Math.max(0, 1 - dy * dy));
      const a = Math.round(cx - half),
        b = Math.round(cx + half) - 1;
      if (b >= a) this.hline(a, b, y + j, c);
    }
  }
  /** a filled disc of diameter d with its box's top-left at (x, y) */
  disc(x: number, y: number, d: number, c: string | null) {
    this.oval(x, y, d, d, c);
  }
  /** an ellipse's outline, one pixel thick */
  ring(x: number, y: number, w: number, h: number, c: string | null) {
    const tmp = new Painter(w, h);
    tmp.oval(0, 0, w, h, '#ffffff');
    for (let j = 0; j < h; j++)
      for (let i = 0; i < w; i++)
        if (
          tmp.on(i, j) &&
          (!tmp.on(i - 1, j) || !tmp.on(i + 1, j) || !tmp.on(i, j - 1) || !tmp.on(i, j + 1))
        )
          this.px(x + i, y + j, c);
  }
  /** a filled polygon (pixel centres inside the shape are painted) */
  poly(pts: number[][], c: string | null) {
    if (!c || pts.length < 3) return;
    let y0 = Infinity,
      y1 = -Infinity;
    for (const p of pts) {
      y0 = Math.min(y0, p[1]);
      y1 = Math.max(y1, p[1]);
    }
    for (let y = Math.floor(y0); y <= Math.ceil(y1); y++) {
      const yc = y + 0.5,
        xs: number[] = [];
      for (let i = 0; i < pts.length; i++) {
        const a = pts[i],
          b = pts[(i + 1) % pts.length];
        if (a[1] <= yc !== b[1] <= yc) xs.push(a[0] + ((yc - a[1]) / (b[1] - a[1])) * (b[0] - a[0]));
      }
      xs.sort((p, q) => p - q);
      for (let k = 0; k + 1 < xs.length; k += 2) {
        const xa = Math.ceil(xs[k] - 0.5),
          xb = Math.floor(xs[k + 1] - 0.5);
        if (xb >= xa) this.hline(xa, xb, y, c);
      }
    }
  }
  /** checkerboard of two colours over a box (b = null leaves every other pixel alone) */
  dither(x: number, y: number, w: number, h: number, a: string | null, b: string | null) {
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) this.px(x + i, y + j, (i + j) & 1 ? b : a);
  }
  /** Paint c on every empty pixel that touches a painted one: the ink line round a sprite. */
  outline(c: string, diagonals = false) {
    const { w, h, buf } = this,
      v = rgba(c),
      add: number[] = [];
    for (let y = 0; y < h; y++)
      for (let x = 0; x < w; x++) {
        if (buf[y * w + x] >>> 24) continue;
        const hit = (i: number, j: number) => i >= 0 && j >= 0 && i < w && j < h && buf[j * w + i] >>> 24 > 0;
        if (
          hit(x - 1, y) ||
          hit(x + 1, y) ||
          hit(x, y - 1) ||
          hit(x, y + 1) ||
          (diagonals && (hit(x - 1, y - 1) || hit(x + 1, y - 1) || hit(x - 1, y + 1) || hit(x + 1, y + 1)))
        )
          add.push(y * w + x);
      }
    for (const i of add) buf[i] = v;
  }
  /** Replace one colour with another everywhere (for flashing a sprite white, say). */
  recolor(from: string, to: string) {
    const a = rgba(from),
      b = rgba(to);
    for (let i = 0; i < this.buf.length; i++) if (this.buf[i] === a) this.buf[i] = b;
  }
  /** Copy another painter's pixels in (empty pixels stay empty), optionally mirrored left to right. */
  stamp(src: Painter | Art, x: number, y: number, flip = false) {
    const p = src instanceof Painter ? src : painterOf(src);
    for (let j = 0; j < p.h; j++)
      for (let i = 0; i < p.w; i++) {
        const v = p.buf[j * p.w + (flip ? p.w - 1 - i : i)];
        if (!(v >>> 24)) continue;
        const X = Math.round(x + i + this.ox),
          Y = Math.round(y + j + this.oy);
        if (X >= 0 && Y >= 0 && X < this.w && Y < this.h) this.buf[Y * this.w + X] = v;
      }
  }
  /** Finish: the buffer as an Art (a canvas plus its anchor). */
  toArt(ax = this.w / 2, ay = this.h): Art {
    const canvas = document.createElement('canvas');
    canvas.width = this.w;
    canvas.height = this.h;
    canvas.getContext('2d').putImageData(this.img, 0, 0);
    const art: Art = { canvas, w: this.w, h: this.h, ax, ay };
    painters.set(art, this);
    return art;
  }
}
const painters = new WeakMap<Art, Painter>();
function painterOf(a: Art): Painter {
  let p = painters.get(a);
  if (!p) {
    p = new Painter(a.w, a.h);
    const d = a.canvas.getContext('2d').getImageData(0, 0, a.w, a.h);
    p.buf.set(new Uint32Array(d.data.buffer));
  }
  return p;
}

/** Paint a sprite once; later calls with the same key reuse it. */
const made = new Map<string, Art>();
export function paint(
  key: string,
  w: number,
  h: number,
  draw: (p: Painter) => void,
  ax?: number,
  ay?: number,
) {
  let a = made.get(key);
  if (!a) {
    const p = new Painter(w, h);
    draw(p);
    a = p.toArt(ax, ay);
    made.set(key, a);
  }
  return a;
}

export interface BlitOpts {
  scale?: number;
  flip?: boolean;
  alpha?: number;
  /** place by the sprite's anchor instead of its top-left corner */
  anchored?: boolean;
}
/** Draw a sprite onto any 2D context at (x, y), scaled by a whole number, crisp. */
export function blit(g: CanvasRenderingContext2D, a: Art, x: number, y: number, o: BlitOpts = {}) {
  const s = o.scale || 1;
  if (o.anchored) {
    x -= a.ax * s;
    y -= a.ay * s;
  }
  const prevA = g.globalAlpha,
    prevS = g.imageSmoothingEnabled;
  g.imageSmoothingEnabled = false;
  if (o.alpha !== undefined) g.globalAlpha = prevA * o.alpha;
  if (o.flip) {
    g.save();
    g.translate(Math.round(x) + a.w * s, Math.round(y));
    g.scale(-1, 1);
    g.drawImage(a.canvas, 0, 0, a.w * s, a.h * s);
    g.restore();
  } else g.drawImage(a.canvas, Math.round(x), Math.round(y), a.w * s, a.h * s);
  g.globalAlpha = prevA;
  g.imageSmoothingEnabled = prevS;
}

/** A sprite as a data: URL, for <img> tags and CSS. */
export function dataURL(a: Art, scale = 1) {
  if (scale === 1) return a.canvas.toDataURL();
  const c = document.createElement('canvas');
  c.width = a.w * scale;
  c.height = a.h * scale;
  blit(c.getContext('2d'), a, 0, 0, { scale });
  return c.toDataURL();
}
