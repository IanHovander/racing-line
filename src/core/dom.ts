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
    const s = JSON.stringify(v);
    try {
      localStorage.setItem('hcgp_' + k, s);
    } catch (e) {
      // Storage is full. The racing lines cached by sim/lines.ts are the only large entries and can be worked out
      // again, so they make room for the setting (a full store used to drop every later save without a word).
      try {
        for (const key of Object.keys(localStorage))
          if (key.startsWith('hcgp_dynl_')) localStorage.removeItem(key);
        localStorage.setItem('hcgp_' + k, s);
      } catch (_) {}
    }
  },
};
/**
 * A year-long cookie, as a second place beside `store` for the little that should outlive a browser clearing a
 * site's storage (the player's name). Same `hcgp_` prefix; kept to the game's own folder.
 */
export const cookie = {
  get(k: string): string | null {
    try {
      const m = document.cookie.match(new RegExp('(?:^|; )hcgp_' + k + '=([^;]*)'));
      return m ? decodeURIComponent(m[1]) : null;
    } catch (e) {
      return null;
    }
  },
  set(k: string, v: string): void {
    try {
      document.cookie =
        'hcgp_' +
        k +
        '=' +
        encodeURIComponent(v) +
        '; max-age=31536000; path=' +
        location.pathname.replace(/[^/]*$/, '') +
        '; SameSite=Lax' +
        (location.protocol === 'https:' ? '; Secure' : '');
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
