// The opening titles: a 24-second reel cut to its own music, filmed with the game itself, then the main screen.
//
// It is the start of the race that runs behind the main screen. The cars sit on the grid while the five start lights
// come on, one a second, each with a cut to a new angle; at lights out the music drops and the real race starts;
// then a slow-motion close-up of the leader, the racing line painting itself through a corner (GAS / HOLD / BRAKE in
// the line's own colours), the closest battle on track, a flyover of the whole circuit, and the logo, which lands
// where it sits on the main screen as the camera settles on the race behind it and the buttons come up.
//
// Like the FRC game's opening (Strategy-Training: public/team-manager/intro.js): a first tap starts it with sound,
// a tap skips to the title, every cut lands on a beat of the music and the picture follows the music's clock.
// The race is simulated with a seeded random generator, so on a given circuit the intro films the same race
// every time. Times are in beats (score.ts, 112 bpm); B is the beat into the intro.
//
// URL options: ?nointro, ?intro (play it even in an automated browser, which skips it by default), ?at=SECONDS
// (freeze that moment, for screenshots). Settings → Display & Sound → Intro turns it off or plays it again.
import { GS } from '../state';
import { $, DPR, H, W, clamp, ctx, isTouch, wrapA } from '../core/dom';
import { AC, unlockAudio } from '../audio/audio';
import { cueTheme } from '../audio/music';
import { cars, opts, setupRace } from '../game/race';
import { ISO_A, P, cam } from '../render/camera';
import { LINE_COLS } from '../render/line';
import { flagImg } from '../render/scenery';
import { STEP } from '../sim/ai';
import { VMAX } from '../sim/car-model';
import { AIL, AIZ, DYNLINES } from '../sim/lines';
import { standings, step } from '../sim/step';
import { progress } from '../sim/timing';
import { TEAMS } from '../teams/teams';
import type { Car, Theme } from '../types';
import { BPM, CUE, INTRO_THEME, SPB } from './score';

type Cam = { x: number; y: number; z: number; a: number; zoom: number; tilt: number };

/** the intro's state, on window as INTRO with ?debug */
export const INTRO = {
  /** off: not showing; boot: waiting for the first tap; play: running */
  state: 'off' as 'off' | 'boot' | 'play',
  /** ?at=SECONDS: the moment shown, frozen (screenshots), else null */
  frozen: null as number | null,
  /** beat into the intro, this frame */
  B: -1,
  /** seconds of race simulated since lights out */
  sim: 0,
  /** race time the score has had that the race hasn't (a skip moves the picture on, not the race) */
  simOff: 0,
  /** the cars each shot films, chosen as the race reaches the shot */
  picks: {} as { leader?: Car; line?: Car; battle?: [Car, Car] },
  /** the heading of the grid */
  h0: 0,
  /** the cut being shown (the camera snaps on a new one and glides within one) */
  shot: -1,
  /** the word under the racing line and the half-beat it was chosen on */
  word: -1,
  wordAt: -1,
  rng: Math.random,
};
/** what the engine sound follows during the intro (read by audio/mixer.ts) */
export const INTRO_SND = {
  on: false,
  car: null as Car | null,
  rpm: -1,
  thr: 0,
  pitch: 1,
  /** engines under the music */ vol: 0.5,
};

const SANS = 'Geist, system-ui, -apple-system, "Segoe UI", sans-serif',
  MONO = '"Geist Mono", ui-monospace, SFMono-Regular, Menlo, monospace',
  GREY = '#c4c9d1',
  /** the logo's lean (skewX(-20deg)), for the big words */
  SKEW = Math.tan((20 * Math.PI) / 180);
const reduceMotion = () => !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

// ---------------------------------------------------------------- small helpers
const lerp = (a: number, b: number, u: number) => a + (b - a) * u;
const seg = (B: number, b0: number, b1: number) => clamp((B - b0) / (b1 - b0), 0, 1);
const easeOut = (u: number) => 1 - (1 - u) ** 3;
const easeInOut = (u: number) => (u < 0.5 ? 4 * u * u * u : 1 - (-2 * u + 2) ** 3 / 2);
/** 0..1..0: in over `fade` beats from b0, out over `fade` beats to b1 */
const window01 = (B: number, b0: number, b1: number, fade = 0.25) =>
  Math.min(seg(B, b0, b0 + fade), 1 - seg(B, b1 - fade, b1));
/** a fixed random number for i */
const rnd = (i: number) => {
  const x = Math.sin(i * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
};
function mulberry32(a: number) {
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const hash = (s: string) => [...s].reduce((h, ch) => Math.imul(h ^ ch.charCodeAt(0), 16777619), 2166136261);
/** run f with the intro's own random numbers, so the filmed race is the same every time */
function seeded<T>(f: () => T): T {
  const keep = Math.random;
  Math.random = INTRO.rng;
  try {
    return f();
  } finally {
    Math.random = keep;
  }
}
const baseZoom = () => clamp(Math.min(W, H) / 68, 4.6, 11);
/** the screen insets of a notched phone */
const SAFE = { top: 0, bottom: 0 };
function readSafe(): void {
  if (typeof getComputedStyle !== 'function') return;
  const d = document.createElement('div');
  d.style.cssText =
    'position:fixed;visibility:hidden;padding-top:env(safe-area-inset-top);padding-bottom:env(safe-area-inset-bottom)';
  document.body.appendChild(d);
  const cs = getComputedStyle(d);
  SAFE.top = parseFloat(cs.paddingTop) || 0;
  SAFE.bottom = parseFloat(cs.paddingBottom) || 0;
  d.remove();
}

// ---------------------------------------------------------------- the clock
// The picture runs on its own clock until the music is playing, then follows the music's (what you hear, so the
// output latency is taken off). If the audio stops, the picture carries on and the music joins again when it can.
const CLK = { perf0: 0, ac0: -1 };
const perfNow = () => performance.now() / 1000;
const latency = () => (AC && (AC.outputLatency || AC.baseLatency)) || 0;
const audioLive = () => !!AC && AC.state === 'running';
/** a theme that plays nothing: holds the menu theme back until the intro's music starts in time with the picture */
const HUSH: Theme = { bpm: BPM, play() {} };

function introTime(): number {
  if (INTRO.frozen !== null) return INTRO.frozen;
  if (CLK.ac0 >= 0) {
    if (audioLive()) {
      const t = AC.currentTime - latency() - CLK.ac0;
      CLK.perf0 = perfNow() - t;
      return t;
    }
    CLK.ac0 = -1;
  }
  return perfNow() - CLK.perf0;
}
/** start the score at intro time t (its next step), if the music can play */
function joinMusic(t: number): void {
  if (CLK.ac0 >= 0 || INTRO.frozen !== null || !audioLive() || !opts.music) return;
  CLK.ac0 = AC.currentTime - latency() - t;
  const sd = SPB / 4,
    k = Math.max(0, Math.ceil((AC.currentTime + 0.06 - CLK.ac0) / sd));
  cueTheme(INTRO_THEME, k, CLK.ac0 + k * sd);
}

// ---------------------------------------------------------------- the race
/** seconds of race the score has had at beat B: none before lights out, slow motion on the leader */
const SLOWMO = 0.35;
function raceTime(B: number): number {
  if (B <= CUE.out) return 0;
  const a = Math.min(B, CUE.leader) - CUE.out,
    b = clamp(B - CUE.leader, 0, CUE.line - CUE.leader),
    c = Math.max(0, B - CUE.line);
  return (a + SLOWMO * b + c) * SPB;
}
/** step the race up to `target` seconds after lights out, at most `max` steps */
function simulate(target: number, max: number): void {
  if (INTRO.sim + STEP > target) return;
  seeded(() => {
    let n = 0;
    while (INTRO.sim + STEP <= target && n++ < max) {
      step(STEP);
      INTRO.sim += STEP;
      pickShots();
    }
  });
  // a slow device can't keep up: the race falls behind the music rather than stall the picture
  if (target - INTRO.sim > 0.1) INTRO.simOff += target - INTRO.sim;
}
const live = () => standings().filter(c => !c.out && !c.gone);
/** choose the cars a shot films as the race reaches its first beat */
function pickShots(): void {
  const r = INTRO.sim + INTRO.simOff,
    pk = INTRO.picks;
  if (!pk.leader && r >= raceTime(CUE.leader)) pk.leader = live()[0];
  if (!pk.line && r >= raceTime(CUE.line)) pk.line = pickLine();
  if (!pk.battle && r >= raceTime(CUE.battle)) pk.battle = pickBattle();
}
/** the line a car's team drives (the classic line until the ready-made ones are in) */
const lineOf = (c: Car) => ({ lat: AIL[c.team] || GS.off, zone: AIZ[c.team] || GS.zone });
const braking = (z: number) => z === 1 || z === 3;
/** a car near the front that starts braking for a corner about a second into the shot */
function pickLine(): Car {
  const st = live().slice(0, 6);
  let best = st[0],
    bs = 1e9;
  for (const c of st) {
    const zn = lineOf(c).zone;
    if (braking(zn[c.idx])) continue;
    for (let k = 1; k < 700; k++) {
      if (!braking(zn[(c.idx + k) % GS.N])) continue;
      const s = Math.abs((k * GS.SEG) / Math.max(c.v, 15) - 0.9);
      if (s < bs) {
        bs = s;
        best = c;
      }
      break;
    }
  }
  return best;
}
/** the two cars closest together, ahead first */
function pickBattle(): [Car, Car] {
  const st = live();
  let best: [Car, Car] = [st[0], st[1] || st[0]],
    bg = 1e9;
  for (let i = 1; i < Math.min(st.length, 8); i++) {
    const g = progress(st[i - 1]) - progress(st[i]);
    if (g < bg) {
      bg = g;
      best = [st[i - 1], st[i]];
    }
  }
  return best;
}
const position = (c: Car) => standings().indexOf(c) + 1;

// ---------------------------------------------------------------- the camera, shot by shot
const byGrid = (g: number): Car => cars.find(c => c.grid === g) || cars[0];
const at = (c: Car, ahead = 0): [number, number, number] => [
  c.x + Math.cos(c.h) * ahead,
  c.y + Math.sin(c.h) * ahead,
  c.hz || 0,
];
const mid = (p: number[], q: number[], u = 0.5): [number, number, number] => [
  lerp(p[0], q[0], u),
  lerp(p[1], q[1], u),
  lerp(p[2], q[2], u),
];
const view = (p: number[], a: number, tilt: number, zoom: number): Cam => ({
  x: p[0],
  y: p[1],
  z: p[2],
  a,
  tilt,
  zoom,
});
/** from camera A to camera Z: the zoom changes at an even rate and the point in view keeps up with it */
function glide(A: Cam, Z: Cam, u: number): Cam {
  const zoom = Math.exp(lerp(Math.log(A.zoom), Math.log(Z.zoom), u)),
    w =
      Math.abs(Z.zoom - A.zoom) < 1e-3 ? u : clamp((1 / zoom - 1 / A.zoom) / (1 / Z.zoom - 1 / A.zoom), 0, 1);
  return {
    x: lerp(A.x, Z.x, w),
    y: lerp(A.y, Z.y, w),
    z: lerp(A.z, Z.z, w),
    a: A.a + wrapA(Z.a - A.a) * u,
    tilt: lerp(A.tilt, Z.tilt, u),
    zoom,
  };
}

/** the grid: a new angle for each light */
function gridCam(B: number): Cam {
  const k = baseZoom(),
    h = INTRO.h0,
    p0 = byGrid(0);
  if (B < 2) {
    const u = B / 2; // high over the grid, coming down
    return view(mid(at(byGrid(4)), at(byGrid(5))), h - 0.95 + 0.3 * u, 0.66 - 0.06 * u, k * (0.5 + 0.18 * u));
  }
  if (B < 4) {
    const u = (B - 2) / 2; // light 1: the pole sitter, nose on
    return view(at(p0, 1.6), h + Math.PI - 0.75 + 0.15 * u, 0.4, k * (2.7 + 0.4 * u));
  }
  if (B < 6) {
    const u = (B - 4) / 2; // light 2: from the back of the grid, looking up it
    return view(at(byGrid(7), -4 + 6 * u), h + 0.12, 0.36, k * 1.35);
  }
  if (B < 8) {
    const u = (B - 6) / 2; // light 3: side on, along the front rows
    return view(
      mid(mid(at(byGrid(2)), at(byGrid(3))), mid(at(p0), at(byGrid(1))), u),
      h - Math.PI / 2,
      0.46,
      k * 2.1,
    );
  }
  if (B < 10) {
    const u = (B - 8) / 2; // light 4: straight down on the front row
    return view(mid(at(p0), at(byGrid(1))), h + 0.5 - 0.35 * u, 0.92, k * (2.2 + 0.3 * u));
  }
  const u = seg(B, 10, 12); // light 5 and the hold: behind the pole sitter, closing in
  return view(at(p0, 2), h + 0.28, 0.5, k * (2.3 + 0.9 * u * u));
}
/** lights out: the whole grid lurches away, then a cut to close behind the leader */
const LAUNCH_CUT = CUE.out + 3;
function launchCam(B: number): Cam {
  const k = baseZoom();
  if (B < LAUNCH_CUT) {
    const u = seg(B, CUE.out, LAUNCH_CUT),
      p = mid(at(byGrid(3)), at(byGrid(4)));
    return view(
      [p[0] + Math.cos(INTRO.h0) * 6 * u * u, p[1] + Math.sin(INTRO.h0) * 6 * u * u, p[2]],
      INTRO.h0 + 0.2,
      0.48,
      k * lerp(1.3, 1.2, u),
    );
  }
  const c = live()[0],
    u = seg(B, LAUNCH_CUT, CUE.leader),
    i = (c.idx + 8) % GS.N;
  return view(at(c, 5), Math.atan2(GS.ty[i], GS.tx[i]) - 0.55 + 0.2 * u, 0.42, k * 2.4);
}
/** the leader, close and slow */
function leaderCam(B: number): Cam {
  const c = INTRO.picks.leader || live()[0],
    u = seg(B, CUE.leader, CUE.line);
  return view(at(c, 1.2), c.h + Math.PI * 0.78 - 0.4 * u, 0.4, baseZoom() * 3.5);
}
/** the racing line: the game's own camera */
function lineCam(): Cam {
  const c = INTRO.picks.line || live()[0],
    look = Math.min(c.v * 0.38, 32);
  return view(at(c, look), ISO_A, 0.5, baseZoom() * 1.2);
}
/** the battle: swinging round from the side to behind them */
function battleCam(B: number): Cam {
  const [a, b] = INTRO.picks.battle || pickBattle(),
    u = seg(B, CUE.battle, CUE.fly),
    p = mid(at(a), at(b)),
    i = b.idx,
    h = Math.atan2(GS.ty[i], GS.tx[i]),
    gap = Math.hypot(a.x - b.x, a.y - b.y),
    k = baseZoom();
  return view(
    p,
    h - 1.25 + 0.9 * easeInOut(u),
    0.42,
    Math.min(k * 2.5, (Math.min(W, H) * 0.42) / Math.max(gap, 1)),
  );
}
/** the whole circuit from high up, turned to fill the screen, a little above the circuit's name */
const FIT = { key: '', cam: null as Cam | null };
function overviewCam(): Cam {
  const key = `${GS.TR.id}:${W}x${H}`;
  if (FIT.key === key && FIT.cam) return FIT.cam;
  const tilt = 0.78,
    ox = (GS.minX + GS.maxX) / 2,
    oy = (GS.minY + GS.maxY) / 2;
  let best: Cam | null = null,
    bs = -1;
  for (let k = 0; k < 36; k++) {
    const a = ISO_A - Math.PI / 2 + (k / 36) * Math.PI,
      sn = Math.sin(a),
      cs = Math.cos(a);
    let x0 = 1e9,
      x1 = -1e9,
      y0 = 1e9,
      y1 = -1e9;
    for (let i = 0; i < GS.N; i += 3) {
      const dx = GS.cx[i] - ox,
        dy = GS.cy[i] - oy,
        X = -dx * sn + dy * cs,
        Y = dx * cs + dy * sn; // depth: up the screen
      x0 = Math.min(x0, X);
      x1 = Math.max(x1, X);
      y0 = Math.min(y0, Y);
      y1 = Math.max(y1, Y);
    }
    const zoom = Math.min((W * 0.88) / (x1 - x0), (H * 0.5) / ((y1 - y0) * tilt)),
      score = zoom * (1 - (0.1 * Math.abs(a - ISO_A)) / (Math.PI / 2));
    if (score <= bs) continue;
    bs = score;
    // aim so the circuit's middle sits at 40% of the screen height (the camera's point sits at 48%)
    const X = (x0 + x1) / 2,
      Y = (y0 + y1) / 2 - (H * 0.08) / (zoom * tilt);
    best = { x: ox - X * sn + Y * cs, y: oy + X * cs + Y * sn, z: 0, a, tilt, zoom };
  }
  FIT.key = key;
  FIT.cam = best;
  return best;
}
function flyCam(B: number): Cam {
  return glide(battleCam(CUE.fly), overviewCam(), easeInOut(seg(B, CUE.fly, CUE.title - 0.4)));
}
/** where the main screen's camera wants to be (render/camera.ts updateCamera) */
function homeCam(): Cam {
  const c = cars[Math.max(0, GS.ctrl)],
    look = Math.min(c.v * 0.38, 32);
  return view(at(c, look), ISO_A, 0.5, baseZoom() * (1.12 - (0.3 * c.v) / VMAX));
}
/** the camera at beat B and which cut it belongs to, or null when the game's own camera takes over */
function shotCam(B: number): [Cam, number] | null {
  if (B < CUE.out) return [gridCam(B), Math.max(0, Math.floor(B / 2))];
  if (B < CUE.leader) return [launchCam(B), B < LAUNCH_CUT ? 10 : 16];
  if (B < CUE.line) return [leaderCam(B), 11];
  if (B < CUE.battle) return [lineCam(), 12];
  if (B < CUE.fly) return [battleCam(B), 13];
  if (B < CUE.title) return [flyCam(B), 14];
  if (B < CUE.title + 3)
    return [glide(overviewCam(), homeCam(), easeInOut(seg(B, CUE.title, CUE.title + 3))), 15];
  return null;
}
function applyCam(k: Cam, shot: number, dt: number): void {
  const snap = shot !== INTRO.shot || INTRO.frozen !== null;
  INTRO.shot = shot;
  const f = snap ? 1 : 1 - Math.exp(-dt * 14);
  cam.x += (k.x - cam.x) * f;
  cam.y += (k.y - cam.y) * f;
  cam.z += (k.z - cam.z) * f;
  cam.a = wrapA(cam.a + wrapA(k.a - cam.a) * f);
  cam.zoom += (k.zoom - cam.zoom) * f;
  cam.tilt += (k.tilt - cam.tilt) * f;
  cam.hz = 0.8;
}

// ---------------------------------------------------------------- engine sound
/** the car the sound follows and, on the grid, the revs */
function engines(B: number): void {
  const S = INTRO_SND;
  S.pitch = 1;
  S.rpm = -1;
  if (INTRO.frozen !== null || B >= CUE.fly) {
    S.car = null;
    return;
  }
  if (B < CUE.out) {
    // on the grid: a blip of revs with each light, held high for the start
    S.car = byGrid(0);
    let r = 0.3;
    for (const l of CUE.lights) if (B >= l) r = Math.max(r, 0.3 + 0.5 * Math.exp(-(B - l) * 2.5));
    if (B >= CUE.lights[4]) r = Math.max(r, 0.78);
    S.rpm = r;
    S.thr = r > 0.45 ? 1 : 0.3;
    return;
  }
  const pk = INTRO.picks;
  S.car =
    B < CUE.leader
      ? live()[0]
      : B < CUE.line
        ? pk.leader || null
        : B < CUE.battle
          ? pk.line || null
          : pk.battle
            ? pk.battle[1]
            : null;
  if (S.car) S.thr = S.car.thr || 0;
  if (B >= CUE.leader && B < CUE.line) S.pitch = 0.62;
}

// ---------------------------------------------------------------- the overlay: lights, words, cards
let oc: HTMLCanvasElement | null = null,
  o: CanvasRenderingContext2D | null = null;
function sizeOverlay(): void {
  if (!oc) return;
  oc.width = Math.round(W * DPR);
  oc.height = Math.round(H * DPR);
  o.setTransform(DPR, 0, 0, DPR, 0, 0);
  readSafe();
  measureLogo();
}
/** text in the logo's style: heavy, leaning, capitals */
function big(
  t: string,
  x: number,
  y: number,
  px: number,
  align: CanvasTextAlign = 'left',
  col = '#fff',
): void {
  o.save();
  o.translate(x, y);
  o.transform(1, 0, -SKEW, 1, 0, 0);
  o.font = `800 ${px}px ${SANS}`;
  o.textAlign = align;
  o.textBaseline = 'alphabetic';
  o.fillStyle = col;
  o.fillText(t, 0, 0);
  o.restore();
}
function bigWidth(t: string, px: number): number {
  o.font = `800 ${px}px ${SANS}`;
  return o.measureText(t).width;
}
/** Geist Mono, spaced out like the main screen's LIVE line */
function mono(t: string, x: number, y: number, px: number, align = 'left', col = GREY, weight = 600): number {
  o.font = `${weight} ${px}px ${MONO}`;
  o.textAlign = 'left';
  o.textBaseline = 'alphabetic';
  o.fillStyle = col;
  const tr = px * 0.16;
  let w = -tr;
  for (const ch of t) w += o.measureText(ch).width + tr;
  let cx = align === 'center' ? x - w / 2 : align === 'right' ? x - w : x;
  for (const ch of t) {
    o.fillText(ch, cx, y);
    cx += o.measureText(ch).width + tr;
  }
  return w;
}
function roundRect(x: number, y: number, w: number, h: number, r: number): void {
  o.beginPath();
  o.moveTo(x + r, y);
  o.arcTo(x + w, y, x + w, y + h, r);
  o.arcTo(x + w, y + h, x, y + h, r);
  o.arcTo(x, y + h, x, y, r);
  o.arcTo(x, y, x + w, y, r);
  o.closePath();
}
/** the dark panel the main screen's buttons sit on */
function panel(x: number, y: number, w: number, h: number): void {
  roundRect(x, y, w, h, 16);
  o.fillStyle = 'rgba(12,14,19,0.78)';
  o.fill();
  o.strokeStyle = 'rgba(255,255,255,0.18)';
  o.lineWidth = 1;
  o.stroke();
}
function cover(a: number, col = '#000'): void {
  if (a <= 0) return;
  o.globalAlpha = Math.min(1, a);
  o.fillStyle = col;
  o.fillRect(0, 0, W, H);
  o.globalAlpha = 1;
}
function flash(B: number, b0: number, dur: number, peak = 0.85): void {
  if (B < b0 || B >= b0 + dur) return;
  cover(peak * (reduceMotion() ? 0.3 : 1) * (1 - (B - b0) / dur), '#fff');
}
/** shade the bottom of the screen for words over the race (as the main screen does) */
function shadeBottom(a: number): void {
  if (a <= 0) return;
  const g = o.createLinearGradient(0, H * 0.55, 0, H);
  g.addColorStop(0, 'rgba(10,12,16,0)');
  g.addColorStop(1, 'rgba(10,12,16,0.85)');
  o.globalAlpha = a;
  o.fillStyle = g;
  o.fillRect(0, H * 0.55, W, H * 0.45);
  o.globalAlpha = 1;
}
const sizeK = () => clamp(Math.min(W, H * 0.62) / 390, 0.85, 1.7);
const bottomY = () => H - SAFE.bottom - 40 * sizeK();

/** the start lights: five on a dark gantry, like the race HUD's */
function gantry(n: number, a: number, B: number): void {
  if (a <= 0) return;
  const s = sizeK(),
    r = 17 * s,
    gap = 14 * s,
    pad = 14 * s,
    w = 5 * 2 * r + 4 * gap + 2 * pad,
    h = 2 * r + 2 * pad,
    x0 = (W - w) / 2,
    y0 = SAFE.top + Math.max(56, H * 0.075);
  o.globalAlpha = a;
  roundRect(x0, y0, w, h, 14 * s);
  o.fillStyle = '#111';
  o.fill();
  o.strokeStyle = 'rgba(255,255,255,0.12)';
  o.lineWidth = 1;
  o.stroke();
  for (let i = 0; i < 5; i++) {
    const cx = x0 + pad + r + i * (2 * r + gap),
      cy = y0 + pad + r,
      on = i < n,
      age = on ? B - CUE.lights[i] : 9,
      rr = r * (on ? 1 + 0.22 * Math.max(0, 1 - age / 0.35) : 1);
    o.beginPath();
    o.arc(cx, cy, rr, 0, Math.PI * 2);
    o.fillStyle = on ? '#ff2020' : '#330a0a';
    if (on) {
      o.shadowColor = '#ff3030';
      o.shadowBlur = 18 * s;
    }
    o.fill();
    o.shadowBlur = 0;
    o.lineWidth = 2;
    o.strokeStyle = '#000';
    o.stroke();
  }
  o.globalAlpha = 1;
}
/** a caption at the bottom left: a small grey line over big words, sliding in */
function lowerThird(B: number, b0: number, b1: number, small: string, words: string, stripe?: string): void {
  const a = window01(B, b0, b1, 0.3);
  if (a <= 0) return;
  shadeBottom(a);
  const s = sizeK(),
    px = Math.round(clamp(W * 0.085, 28, 46)),
    x = 24 * s - 30 * (1 - easeOut(seg(B, b0, b0 + 0.5))),
    y = bottomY();
  o.globalAlpha = a;
  let tx = x;
  if (stripe) {
    o.fillStyle = stripe;
    o.fillRect(x, y - px - 22 * s, 5 * s, px + 24 * s);
    tx += 16 * s;
  }
  mono(small, tx, y - px - 8 * s, Math.round(12 * s));
  big(words, tx + px * 0.2, y, px);
  o.globalAlpha = 1;
}
/** streaks along the direction of travel, round the edge of the screen */
function speedLines(B: number, amount: number, c: Car | null): void {
  if (amount < 0.05 || !c || reduceMotion()) return;
  const p = P(c.x, c.y, c.hz || 0),
    q = P(c.x + Math.cos(c.h) * 4, c.y + Math.sin(c.h) * 4, c.hz || 0),
    L = Math.hypot(q[0] - p[0], q[1] - p[1]) || 1,
    dx = (q[0] - p[0]) / L,
    dy = (q[1] - p[1]) / L,
    n = Math.round(16 * amount),
    seed = Math.floor(B * 12) * 97,
    keep = Math.min(W, H) * 0.4;
  o.strokeStyle = 'rgba(255,255,255,0.38)';
  o.lineWidth = 1;
  o.beginPath();
  for (let i = 0; i < n * 2; i++) {
    const x = rnd(seed + i * 3.1) * W,
      y = rnd(seed + i * 5.7) * H;
    if (Math.hypot(x - W / 2, y - H * 0.48) < keep) continue;
    const len = 30 + rnd(seed + i * 7.3) * 110 * amount;
    o.moveTo(x, y);
    o.lineTo(x - dx * len, y - dy * len);
  }
  o.stroke();
}
function vignette(a: number): void {
  if (a <= 0) return;
  const g = o.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.3, W / 2, H / 2, Math.hypot(W, H) * 0.6);
  g.addColorStop(0, 'rgba(0,0,0,0)');
  g.addColorStop(1, 'rgba(0,0,0,0.6)');
  o.globalAlpha = a;
  o.fillStyle = g;
  o.fillRect(0, 0, W, H);
  o.globalAlpha = 1;
}
const surname = (c: Car) => (c.name || '').replace(/^.*\.\s*/, '').toUpperCase();
/** the leader's card: position, driver, flag, team, number */
function leaderCard(B: number): void {
  const c = INTRO.picks.leader;
  if (!c) return;
  const a = window01(B, CUE.leader + 0.25, CUE.line, 0.4);
  if (a <= 0) return;
  shadeBottom(a);
  const s = sizeK(),
    w = Math.min(W - 32 * s, 400 * s),
    h = 92 * s,
    x = (W - w) / 2 - 40 * (1 - easeOut(seg(B, CUE.leader + 0.25, CUE.leader + 0.9))),
    y = bottomY() - h + 10 * s;
  o.globalAlpha = a;
  panel(x, y, w, h);
  o.fillStyle = c.col;
  o.fillRect(x, y + 14 * s, 5 * s, h - 28 * s);
  mono('P' + position(c), x + 22 * s, y + 58 * s, Math.round(32 * s), 'left', '#fff', 700);
  const nx = x + 92 * s,
    im = c.nat ? flagImg(c.nat) : null;
  if (im) {
    o.drawImage(im, nx, y + 22 * s, 24 * s, 16 * s);
    o.strokeStyle = 'rgba(0,0,0,0.35)';
    o.strokeRect(nx, y + 22 * s, 24 * s, 16 * s);
  }
  big((c.name || '').toUpperCase(), nx + (im ? 32 * s : 0), y + 40 * s, Math.round(22 * s));
  mono(TEAMS[c.team].name.toUpperCase(), nx, y + 68 * s, Math.round(12 * s));
  mono(
    '#' + c.number,
    x + w - 18 * s,
    y + 58 * s,
    Math.round(22 * s),
    'right',
    'rgba(255,255,255,0.55)',
    700,
  );
  o.globalAlpha = 1;
}
/** the line's colours, as on the track: what the driver is doing */
const WORDS = ['GAS', 'BRAKE', 'HOLD', 'BRAKE'];
function lineWords(B: number): void {
  const c = INTRO.picks.line;
  if (!c) return;
  const a = window01(B, CUE.line + 0.5, CUE.battle, 0.3);
  if (a <= 0) return;
  // the word changes on a half beat, to the zone the car is in
  const half = Math.floor(B * 2);
  if (INTRO.frozen !== null || half !== INTRO.wordAt) {
    INTRO.wordAt = half;
    INTRO.word = lineOf(c).zone[c.idx] || 0;
  }
  const z = INTRO.word,
    s = sizeK(),
    px = Math.round(clamp(W * 0.16, 52, 96)),
    pop = 1 + 0.12 * Math.max(0, 1 - (B * 2 - half) / 0.6),
    y = bottomY() - 26 * s;
  shadeBottom(a);
  o.globalAlpha = a;
  o.save();
  o.translate(W / 2, y);
  o.scale(pop, pop);
  big(WORDS[z], 0, 0, px, 'center', LINE_COLS[z].replace(/[\d.]+\)$/, '1)'));
  o.restore();
  mono(`${Math.round(c.v * 3.6)} KM/H`, W / 2, y + 30 * s, Math.round(14 * s), 'center', '#fff', 600);
  // the key, at the top
  const keys: [string, number][] = [
    ['GAS', 0],
    ['HOLD', 2],
    ['BRAKE', 1],
  ];
  const kpx = Math.round(12 * s),
    ky = SAFE.top + 40 * s;
  o.font = `600 ${kpx}px ${MONO}`;
  let tw = 0;
  for (const [t] of keys) tw += o.measureText(t).width * 1.16 + 34 * s;
  let kx = (W - tw) / 2;
  for (const [t, zc] of keys) {
    o.fillStyle = LINE_COLS[zc].replace(/[\d.]+\)$/, '1)');
    o.beginPath();
    o.arc(kx + 6 * s, ky - kpx * 0.35, 5 * s, 0, Math.PI * 2);
    o.fill();
    kx += 16 * s + mono(t, kx + 16 * s, ky, kpx, 'left', '#fff') + 18 * s;
  }
  o.globalAlpha = 1;
}
/** the battle: two cars and the gap between them */
function battleCard(B: number): void {
  const pair = INTRO.picks.battle;
  if (!pair) return;
  const a = window01(B, CUE.battle + 0.3, CUE.fly, 0.35);
  if (a <= 0) return;
  // ahead first, as they are now
  const [f, b] = progress(pair[0]) >= progress(pair[1]) ? pair : [pair[1], pair[0]],
    s = sizeK(),
    w = Math.min(W - 32 * s, 360 * s),
    h = 84 * s,
    x = (W - w) / 2,
    y = bottomY() - h + 10 * s + 20 * (1 - easeOut(seg(B, CUE.battle + 0.3, CUE.battle + 0.9))),
    pf = position(f),
    gap = Math.max(0, progress(f) - progress(b)) / Math.max(b.v, 1);
  shadeBottom(a);
  o.globalAlpha = a;
  panel(x, y, w, h);
  mono(`BATTLE FOR P${pf}`, x + w / 2, y + 24 * s, Math.round(11 * s), 'center');
  const row = y + 62 * s,
    px = Math.round(24 * s);
  o.fillStyle = f.col;
  o.fillRect(x + 16 * s, row - 24 * s, 5 * s, 28 * s);
  big(surname(f).slice(0, 3), x + 30 * s, row, px);
  o.fillStyle = b.col;
  o.fillRect(x + w - 21 * s, row - 24 * s, 5 * s, 28 * s);
  big(surname(b).slice(0, 3), x + w - 30 * s, row, px, 'right');
  mono(gap.toFixed(3), x + w / 2, row - 2 * s, Math.round(20 * s), 'center', '#fff', 700);
  o.globalAlpha = 1;
}
/** the circuit's name, typed out over the flyover */
function circuitCard(B: number): void {
  const a = window01(B, CUE.fly + 0.5, CUE.title, 0.3);
  if (a <= 0) return;
  const s = sizeK(),
    name = String(GS.TR.name || '').toUpperCase(),
    n = Math.floor((B - CUE.fly - 0.5) * 8),
    px = Math.round(clamp(W * 0.09, 28, 54)),
    y = bottomY() - 10 * s;
  shadeBottom(a);
  o.globalAlpha = a;
  big(name.slice(0, Math.max(0, n)), W / 2 - bigWidth(name, px) / 2 + px * 0.15, y, px);
  mono(
    `${(GS.L / 1000).toFixed(2)} KM · ${cars.length} CARS`,
    W / 2,
    y + 28 * s,
    Math.round(12 * s),
    'center',
  );
  o.globalAlpha = 1;
}
function bootScreen(now: number): void {
  cover(1);
  gantry(0, 1, 0);
  const s = sizeK(),
    y = H * 0.5,
    pulse = 0.55 + 0.45 * Math.cos(now * 3.2);
  o.globalAlpha = pulse;
  o.font = `700 ${Math.round(20 * s)}px ${SANS}`;
  o.textAlign = 'center';
  o.fillStyle = '#fff';
  o.fillText(isTouch ? 'Tap to start' : 'Click or press any key', W / 2, y);
  o.globalAlpha = 1;
  mono('SOUND ON', W / 2, y + 30 * s, Math.round(11 * s), 'center');
}

/** draw the overlay for this frame (after the race is drawn) */
export function introDraw(): void {
  if (!o) return;
  o.clearRect(0, 0, W, H);
  if (INTRO.state === 'off') return;
  if (INTRO.state === 'boot') return bootScreen(perfNow());
  const B = INTRO.B;
  if (B < 0) return cover(1);
  // the grid
  cover(1 - seg(B, 0.4, 1.6));
  const lit = B < CUE.out ? CUE.lights.filter(l => B >= l).length : 0;
  gantry(lit, B < CUE.out ? 1 : 1 - seg(B, CUE.out + 0.3, CUE.out + 1), B);
  if (B < CUE.out) {
    const pole = byGrid(0);
    lowerThird(B, 2.1, 4, 'POLE POSITION', (pole.name || '').toUpperCase(), pole.col);
    lowerThird(B, 4.1, 6, 'ON THE GRID', `${cars.length} CARS`);
    lowerThird(B, 6.1, 8, 'TWO CARS EACH', `${new Set(cars.map(c => c.team)).size} TEAMS`);
    if (B < 6) {
      const a = window01(B, 0.6, 6, 0.5) * 0.75;
      o.globalAlpha = a;
      mono(isTouch ? 'TAP TO SKIP' : 'CLICK TO SKIP', W - 18, H - SAFE.bottom - 18, 11, 'right');
      o.globalAlpha = 1;
    }
  }
  // lights out
  flash(B, CUE.out, 0.35);
  if (B >= LAUNCH_CUT && B < CUE.leader) speedLines(B, 1 - seg(B, CUE.leader - 1, CUE.leader), live()[0]);
  // the leader, slowed down
  if (B >= CUE.leader && B < CUE.line) {
    flash(B, CUE.leader, 0.2, 0.4);
    vignette(window01(B, CUE.leader, CUE.line, 0.3));
    leaderCard(B);
  }
  if (B >= CUE.line && B < CUE.battle) lineWords(B);
  if (B >= CUE.battle && B < CUE.fly) {
    const pr = INTRO.picks.battle;
    speedLines(B, 0.35 * window01(B, CUE.battle, CUE.fly, 0.5), pr ? pr[1] : null);
    battleCard(B);
  }
  if (B >= CUE.fly && B < CUE.title) circuitCard(B);
  flash(B, CUE.title, 0.6, 0.95);
}

/** the racing line, painting itself ahead of the car in the line shot (drawn under the cars by render.ts) */
export function introLine(z: number): void {
  if (INTRO.state !== 'play') return;
  const B = INTRO.B,
    c = INTRO.picks.line;
  if (!c || B < CUE.line || B >= CUE.battle) return;
  const { lat, zone } = lineOf(c),
    N = GS.N,
    back = 30,
    ahead = Math.round(260 * easeOut(seg(B, CUE.line + 0.25, CUE.line + 1.75))),
    a = 1 - seg(B, CUE.battle - 0.4, CUE.battle),
    X = (i: number) => GS.TSX[i] + GS.NSX[i] * lat[i],
    Y = (i: number) => GS.TSY[i] + GS.NSY[i] * lat[i];
  if (ahead <= 0 || a <= 0) return;
  {
    ctx.globalAlpha = a;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.lineWidth = Math.max(2, 0.44 * z);
    for (let zc = 0; zc < 4; zc++) {
      ctx.beginPath();
      let open = false,
        any = false;
      for (let k = -back; k < ahead; k++) {
        const i = (c.idx + k + N) % N,
          j = (i + 1) % N;
        if (zone[i] !== zc) {
          open = false;
          continue;
        }
        if (!open) ctx.moveTo(X(i), Y(i));
        ctx.lineTo(X(j), Y(j));
        open = any = true;
      }
      if (!any) continue;
      ctx.strokeStyle = LINE_COLS[zc];
      ctx.stroke();
    }
    // the brush at the front of the paint
    if (B < CUE.line + 1.75) {
      const i = (c.idx + ahead) % N;
      ctx.fillStyle = '#fff';
      ctx.shadowColor = '#fff';
      ctx.shadowBlur = 12;
      ctx.beginPath();
      ctx.arc(X(i), Y(i), Math.max(3, 0.5 * z), 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
    }
    ctx.globalAlpha = 1;
    ctx.lineCap = 'butt';
    ctx.lineJoin = 'miter';
  }
}

// ---------------------------------------------------------------- the main screen comes up under the logo
const LOGO = {
  el: null as HTMLElement | null,
  clip: null as SVGRectElement | null,
  clipW: '',
  lines: [] as SVGPathElement[],
  glint: null as SVGGElement | null,
  glintRect: null as SVGRectElement | null,
  dx: 0,
  dy: 0,
  s0: 1,
};
function measureLogo(): void {
  const el = LOGO.el;
  if (!el) return;
  const keep = el.style.transform;
  el.style.transform = 'none';
  const r = el.getBoundingClientRect();
  el.style.transform = keep;
  if (!r.width) return;
  LOGO.dx = W / 2 - (r.left + r.width / 2);
  LOGO.dy = H * 0.44 - (r.top + r.height / 2);
  LOGO.s0 = clamp((W * 0.9) / r.width, 1, 1.45);
}
function logoParts(): void {
  const home = $('home'),
    el = home && (home.querySelector('.hLogo') as HTMLElement);
  LOGO.el = el;
  if (!el) return;
  const svg = el.querySelector('svg'),
    skew = svg && (svg.querySelector('g[transform]') as SVGGElement);
  LOGO.clip = svg && (svg.querySelector('clipPath rect') as SVGRectElement);
  LOGO.clipW = LOGO.clip ? LOGO.clip.getAttribute('width') || '' : '';
  LOGO.lines = skew ? ([...skew.children].filter(e => e.tagName === 'path') as SVGPathElement[]) : [];
  // a white copy of the letters, seen through a narrow window that sweeps across them: the glint
  const letters = skew && skew.querySelector('g[clip-path]');
  if (svg && skew && letters && !LOGO.glint) {
    const NS = 'http://www.w3.org/2000/svg',
      cp = document.createElementNS(NS, 'clipPath'),
      rect = document.createElementNS(NS, 'rect'),
      g = document.createElementNS(NS, 'g');
    cp.id = 'introGlint';
    rect.setAttribute('x', '0');
    rect.setAttribute('y', '-4');
    rect.setAttribute('width', '7');
    rect.setAttribute('height', '24');
    cp.appendChild(rect);
    (svg.querySelector('defs') || svg).appendChild(cp);
    g.setAttribute('clip-path', 'url(#introGlint)');
    for (const p of letters.querySelectorAll('path')) {
      const q = p.cloneNode() as SVGPathElement;
      q.setAttribute('stroke', '#fff');
      g.appendChild(q);
    }
    g.style.display = 'none';
    skew.appendChild(g);
    LOGO.glint = g;
    LOGO.glintRect = rect;
  }
}
/** the main screen's parts, shown as the title plays (B from 36) or hidden before it */
function homeFrame(B: number): void {
  const home = $('home');
  if (!home) return;
  const top = home.querySelector('.hTop') as HTMLElement,
    bot = home.querySelector('.hBot') as HTMLElement,
    T = CUE.title;
  home.style.setProperty('--shade', String(seg(B, T + 3.5, T + 5)));
  const el = LOGO.el;
  if (el) {
    el.style.opacity = B >= T ? '1' : '0';
    const m = easeInOut(seg(B, T + 2.2, T + 3.6));
    el.style.transform = `translate(${LOGO.dx * (1 - m)}px, ${LOGO.dy * (1 - m)}px) scale(${lerp(LOGO.s0, 1, m)})`;
    // the letters wipe in from the left, as a car crosses the screen, after the speed lines
    if (LOGO.clip) LOGO.clip.setAttribute('width', String(lerp(72, 200, easeOut(seg(B, T + 0.15, T + 1.1)))));
    const q = easeOut(seg(B, T, T + 0.8));
    for (const p of LOGO.lines) {
      p.setAttribute('transform', `translate(${-36 * (1 - q)} 0)`);
      p.style.opacity = String(0.5 * q);
    }
    if (LOGO.glint) {
      const g = seg(B, T + 1.5, T + 2.3);
      LOGO.glint.style.display = g > 0 && g < 1 ? '' : 'none';
      LOGO.glintRect.setAttribute('x', String(lerp(14, 150, g)));
    }
  }
  if (top) top.style.opacity = String(seg(B, T + 4.5, T + 5.5));
  if (bot) {
    const u = easeOut(seg(B, T + 4, T + 5.25));
    bot.style.opacity = String(u);
    bot.style.transform = `translateY(${24 * (1 - u)}px)`;
  }
  // the buttons work once they're up
  home.classList.toggle('intro', B < T + 5);
}
function homeReset(): void {
  const home = $('home');
  if (!home) return;
  home.classList.remove('intro');
  home.style.removeProperty('--shade');
  for (const sel of ['.hTop', '.hBot', '.hLogo']) {
    const e = home.querySelector(sel) as HTMLElement;
    if (e) {
      e.style.opacity = '';
      e.style.transform = '';
    }
  }
  if (LOGO.clip && LOGO.clipW) LOGO.clip.setAttribute('width', LOGO.clipW);
  for (const p of LOGO.lines) {
    p.removeAttribute('transform');
    p.style.opacity = '';
  }
  if (LOGO.glint) LOGO.glint.style.display = 'none';
}

// ---------------------------------------------------------------- running it
/** the loop's side: run the race and the camera for this frame. 0: not running; 1: the intro set the camera; 2: the game's camera follows; 3: nothing to draw behind the intro */
export function introFrame(dt: number): number {
  if (INTRO.state === 'off') return 0;
  if (INTRO.state === 'boot') return 3;
  // a frozen moment waits for the ready-made racing lines, so it always shows the same race
  if (INTRO.frozen !== null && !DYNLINES) return 3;
  let t = introTime();
  if (CLK.ac0 < 0) {
    joinMusic(t);
    t = introTime();
  }
  const B = (INTRO.B = t / SPB);
  if (B >= CUE.end) {
    finish();
    return 0;
  }
  simulate(raceTime(B) - INTRO.simOff, INTRO.frozen !== null ? 1e6 : 12);
  engines(B);
  homeFrame(B);
  const sc = shotCam(B);
  if (!sc) return 2;
  applyCam(sc[0], sc[1], dt);
  return 1;
}
/** set up the race the intro films and start the clock */
function begin(): void {
  INTRO.state = 'play';
  INTRO.rng = mulberry32(hash(String(GS.TR.id || GS.TR.name)) ^ 0x5eed);
  seeded(() => setupRace(true));
  INTRO.sim = 0;
  INTRO.simOff = 0;
  INTRO.picks = {};
  INTRO.shot = -1;
  INTRO.wordAt = -1;
  INTRO.h0 = byGrid(0).h;
  for (const c of cars) if (c.nat) flagImg(c.nat);
  CLK.perf0 = perfNow() + 0.15;
  CLK.ac0 = -1;
  // the menu music waits for the intro's, which starts in time with the picture
  if (opts.music && INTRO.frozen === null) cueTheme(HUSH);
  INTRO_SND.on = INTRO.frozen === null;
  oc.classList.add('on');
  logoParts();
  measureLogo();
  homeFrame(0);
}
/** a tap: start, skip to the title, or end it */
function press(): void {
  if (INTRO.state === 'boot') {
    unlockAudio(); // a tap is what lets a phone play sound
    begin();
    return;
  }
  if (INTRO.state !== 'play' || INTRO.frozen !== null) return;
  if (introTime() / SPB < CUE.title - 0.5) skipToTitle();
  else finish();
}
/** jump to the title: the race carries on from where it is, the music jumps to the title's hit */
function skipToTitle(): void {
  const t = CUE.title * SPB - 0.12 - latency();
  INTRO.simOff = raceTime(t / SPB) - INTRO.sim;
  CLK.perf0 = perfNow() - t;
  if (CLK.ac0 >= 0) {
    CLK.ac0 = -1;
    joinMusic(t);
  }
}
/** the end: hand the race, the camera and the screen back to the game */
function finish(): void {
  if (INTRO.state === 'off') return;
  // ended early (a tap on the title), or the intro's music never started: the menu theme from its first bar. (Played
  // to the end, the intro's score has already gone on into it.)
  if (INTRO.B < CUE.end || CLK.ac0 < 0) cueTheme(null);
  INTRO.state = 'off';
  INTRO_SND.on = false;
  INTRO_SND.car = null;
  oc?.classList.remove('on');
  o?.clearRect(0, 0, W, H);
  homeReset();
}
/** play it again (Settings) */
export function playIntro(): void {
  unlockAudio();
  if (INTRO.state !== 'off') finish();
  INTRO.frozen = null;
  begin();
}

export function init(): void {
  oc = document.createElement('canvas');
  oc.id = 'introC';
  document.body.appendChild(oc);
  o = oc.getContext('2d');
  sizeOverlay();
  addEventListener('resize', sizeOverlay);
  // taps act on click: phones only allow sound from the end of a tap
  oc.addEventListener('click', press);
  addEventListener(
    'keydown',
    (e: KeyboardEvent) => {
      if (INTRO.state === 'off' || e.metaKey || e.ctrlKey || e.altKey || e.repeat) return;
      e.preventDefault();
      e.stopPropagation();
      press();
    },
    { capture: true },
  );
  // the main screen's buttons, once they're up, end the intro too
  $('home')?.addEventListener('click', () => INTRO.state === 'play' && finish(), { capture: true });
  // the canvas draws its words in the game's fonts
  try {
    document.fonts?.load(`800 20px ${SANS}`);
    document.fonts?.load(`700 20px ${SANS}`);
    document.fonts?.load(`600 12px ${MONO}`);
    document.fonts?.load(`700 12px ${MONO}`);
  } catch (e) {}
  const q = new URLSearchParams(location.search),
    atS = q.has('at') ? Number(q.get('at')) : NaN,
    wanted = q.has('intro') || isFinite(atS);
  if (
    q.has('nointro') ||
    document.documentElement.classList.contains('joining') ||
    (!wanted && ((navigator as any).webdriver || !opts.intro))
  )
    return;
  if (isFinite(atS)) {
    INTRO.frozen = atS;
    begin();
    return;
  }
  INTRO.state = 'boot';
  oc.classList.add('on');
  logoParts();
  homeFrame(0);
}
