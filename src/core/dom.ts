// ================= Setup =================
export const cv = document.getElementById('c') as HTMLCanvasElement,
  ctx = cv.getContext('2d');
export const isTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
export let W = 0,
  H = 0,
  DPR = 1;
export function resize() {
  DPR = Math.min(isTouch ? 1.5 : 2, window.devicePixelRatio || 1);
  W = innerWidth;
  H = innerHeight;
  cv.width = Math.round(W * DPR);
  cv.height = Math.round(H * DPR);
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  const f = document.getElementById('fwc') as HTMLCanvasElement;
  if (f) {
    f.width = cv.width;
    f.height = cv.height;
    f.getContext('2d').setTransform(DPR, 0, 0, DPR, 0, 0);
  }
}
/** getElementById; typed loosely so form fields, canvases and custom expando props work without casts */
export const $ = (id: string): any => document.getElementById(id);
export const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
export const wrapA = a => {
  a = (a + Math.PI) % (2 * Math.PI);
  if (a < 0) a += 2 * Math.PI;
  return a - Math.PI;
};
export const store = {
  get(k, d) {
    try {
      const v = localStorage.getItem('hcgp_' + k);
      return v === null ? d : JSON.parse(v);
    } catch (e) {
      return d;
    }
  },
  set(k, v) {
    try {
      localStorage.setItem('hcgp_' + k, JSON.stringify(v));
    } catch (e) {}
  },
};
export function init(): void {
  addEventListener('resize', resize);
  resize();
  if (isTouch) document.body.classList.add('touch');
}
/** debug/test hook: reassign a module-level binding */
export function __set(name: string, v: any): void {
  switch (name) {
    case 'W':
      W = v;
      break;
    case 'H':
      H = v;
      break;
    case 'DPR':
      DPR = v;
      break;
  }
}
