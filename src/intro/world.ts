// The intro's view of the game world. Everything the intro asks of the game (its renderer, its cars, its camera, its
// audio context and music) goes through this file, so porting the intro to another renderer (Matthew's Three.js main)
// means rewriting this file and nothing else.
//   stage()                    take the world over: Lone Star, the ten cars on the grid, held still
//   showCorner() / showGrid()  what is on track: one car at Turn 1 for the dawn shots, or the grid
//   camera.flyTo(a, b, u)      the helicopter between two poses (u = 0..1, already eased)
//   camera.frame(points)       the pose that fits a stretch of track on screen
//   camera.track()             hand the camera back to the game's own (the home screen's) camera
//   setGrade(mix)              0 = the inked page (INKED_PAGE on the game canvas), 1 = colour
//   turn1, placeCar(), drawLine()  Turn 1's racing line, the car on it and the line drawn over the frame
//   carsLaunch(), advance(), release()
//   audio()                    the game's audio context and an output for the intro's own sounds
import { GS } from '../state';
import { DPR, H, W, clamp } from '../core/dom';
import { cars, opts, setupRace } from '../game/race';
import { ISO_A, P, cam, updateCamera } from '../render/camera';
import { buildTrack } from '../track/build';
import { TRACKS } from '../track/circuits';
import { STEP } from '../sim/ai';
import { step } from '../sim/step';
import { VMAX } from '../sim/car-model';
import { AC, sfxG, unlockAudio } from '../audio/audio';
import { GO, INK, INKED_PAGE, PAPER, RED } from '../art/index';

/** A helicopter pose: the world point at the middle of the screen, how many pixels a metre is, how far the camera
 * tilts down (1 straight down, 0.5 the game's own view) and its bearing. */
export interface Pose {
  x: number;
  y: number;
  z: number;
  zoom: number;
  tilt: number;
  yaw: number;
}
/** where the look point sits on screen, as a fraction of the height (a little low, to clear the start lights) */
const LOOK_Y = 0.55;
/** the game draws heights with tilt 0.5 and a height scale of 0.8: the same camera seen from another elevation */
const hzOf = (tilt: number) => 0.924 * Math.sqrt(Math.max(0, 1 - tilt * tilt));

// ---- Turn 1 at Lone Star, measured from the circuit the game built ----
export interface Turn1 {
  /** sample indices: where the line starts to be drawn, the lift point, the apex, the end of the exit */
  from: number;
  lift: number;
  apex: number;
  to: number;
  /** speeds in km/h at the lift point and the apex */
  vLift: number;
  vApex: number;
}
export let turn1: Turn1 | null = null;
// the racing line from `from` to `to`, copied when the world is staged (later line updates don't move it)
let LX: Float64Array,
  LY: Float64Array,
  LZ: Float64Array,
  LV: Float64Array,
  LT: Float64Array,
  LOFF: Float64Array;
let grid: any[] = [];
let roller: any = null;
let lineCv: HTMLCanvasElement | null = null;
let shown: 'corner' | 'grid' | '' = '';

function measureTurn1(): Turn1 {
  const N = GS.N,
    v = GS.vf;
  // the first corner: the first slow point after the start, well below the speed reached before it
  let top = 0,
    apex = 1;
  for (let i = 1; i < N / 2; i++) {
    top = Math.max(top, v[i]);
    if (v[i] < 0.5 * top && v[i] <= v[i - 1] && v[i] <= v[i + 1]) {
      apex = i;
      break;
    }
  }
  let lift = apex;
  while (lift > 1 && v[lift - 1] > v[lift] + 0.02) lift--;
  const from = Math.max(0, lift - 36),
    to = Math.min(N - 1, apex + 40);
  return { from, lift, apex, to, vLift: v[lift] * 3.6, vApex: v[apex] * 3.6 };
}
function snapshot(T: Turn1) {
  const n = T.to - T.from + 1;
  LX = new Float64Array(n);
  LY = new Float64Array(n);
  LZ = new Float64Array(n);
  LV = new Float64Array(n);
  LT = new Float64Array(n);
  LOFF = new Float64Array(n);
  for (let k = 0; k < n; k++) {
    const i = T.from + k;
    LX[k] = GS.rx[i];
    LY[k] = GS.ry[i];
    LZ[k] = GS.HT[i] || 0;
    LV[k] = Math.max(8, GS.vf[i]);
    LOFF[k] = GS.off[i];
    // the time a car on the line takes from `from` to here, at the game's own speeds
    if (k) LT[k] = LT[k - 1] + Math.hypot(LX[k] - LX[k - 1], LY[k] - LY[k - 1]) / ((LV[k] + LV[k - 1]) / 2);
  }
}
/** Seconds a car at full racing speed takes from the start of the drawn line to sample index i. */
export function lineTime(i: number): number {
  const k = clamp(i - turn1.from, 0, LT.length - 1),
    a = Math.floor(k),
    b = Math.min(LT.length - 1, a + 1);
  return LT[a] + (LT[b] - LT[a]) * (k - a);
}
/** The sample index (fractional) a car reaches `sec` seconds after the start of the drawn line, at racing speed. */
export function lineAt(sec: number): number {
  if (sec <= 0) return turn1.from;
  let lo = 0,
    hi = LT.length - 1;
  if (sec >= LT[hi]) return turn1.to;
  while (hi - lo > 1) {
    const m = (lo + hi) >> 1;
    if (LT[m] <= sec) lo = m;
    else hi = m;
  }
  return turn1.from + lo + (sec - LT[lo]) / (LT[hi] - LT[lo]);
}
function lerpAt(arr: Float64Array, i: number) {
  const k = clamp(i - turn1.from, 0, arr.length - 1),
    a = Math.floor(k),
    b = Math.min(arr.length - 1, a + 1);
  return arr[a] + (arr[b] - arr[a]) * (k - a);
}
/** The game's speed (m/s) on Turn 1's racing line at sample index i. */
export function lineSpeed(i: number): number {
  return lerpAt(LV, i);
}
/** A point of Turn 1's racing line (world metres). */
export function linePoint(i: number): [number, number, number] {
  return [lerpAt(LX, i), lerpAt(LY, i), lerpAt(LZ, i)];
}

// ---- staging ----
/** Take the world over: Lone Star, the attract race's ten cars on the grid, held still, and the intro's hooks. */
export function stage(hooks: { frame: (dt: number) => boolean; after: () => void }): void {
  const T = TRACKS.find(t => t.id === 'texas');
  if (GS.TR !== T) buildTrack(T);
  setupRace(true);
  grid = cars.slice();
  turn1 = measureTurn1();
  snapshot(turn1);
  roller = { ...grid[0], gone: false, out: false, v: 0, tow: 0, drs: false };
  GS.INTRO = { hold: true, camera: hooks.frame, after: hooks.after };
  shown = '';
}
/** Give the world back: the cars run, the game's camera and the colour are its own again. */
export function release(): void {
  if (shown === 'corner') showGrid();
  GS.INTRO = null;
  setGrade(1);
  lineCv?.remove();
  lineCv = null;
}
/** An empty circuit for the dawn shots, with or without its one car (when it's out of the shot it waits far off the
 * map: the game expects at least one car). */
export function showCorner(withCar: boolean): void {
  if (shown !== 'corner') {
    shown = 'corner';
    cars.length = 0;
    cars.push(roller);
  }
  if (!withCar) {
    roller.x = roller.y = 1e6;
    roller.v = 0;
  }
}
/** The ten cars on the grid, held, with the game's own camera settled on them as the home screen has it. */
export function showGrid(): void {
  if (shown === 'grid') return;
  shown = 'grid';
  cars.length = 0;
  cars.push(...grid);
  camera.track(true);
}
/** Put the dawn car on Turn 1's line at sample index i (fractional), moving at v m/s. */
export function placeCar(i: number, v: number): void {
  const [x, y, z] = linePoint(i),
    [x2, y2] = linePoint(i + 0.5),
    [x0, y0] = linePoint(i - 0.5);
  const c = roller;
  c.x = x;
  c.y = y;
  c.hz = z;
  c.h = Math.atan2(y2 - y0, x2 - x0);
  c.v = v;
  c.idx = Math.round(i) % GS.N;
  c.s = c.prevS = c.idx * GS.SEG;
  c.lat = lerpAt(LOFF, i);
}

// ---- the helicopter ----
function applyPose(p: Pose) {
  const s = Math.sin(p.yaw),
    c = Math.cos(p.yaw),
    oy = H * (GS.state === 'menu' ? 0.48 : 0.56); // where render() puts the camera's point (attract: 0.48)
  const k = (H * LOOK_Y - oy) / (p.zoom * p.tilt);
  cam.x = p.x + k * c;
  cam.y = p.y + k * s;
  cam.z = p.z;
  cam.a = p.yaw;
  cam.zoom = p.zoom;
  cam.tilt = p.tilt;
  cam.hz = hzOf(p.tilt);
}
export const camera = {
  /** The helicopter between two poses: zoom moves in proportion (a steady descent), the rest in a straight line. */
  flyTo(a: Pose, b: Pose, u: number): void {
    const l = (p: number, q: number) => p + (q - p) * u;
    let dy = b.yaw - a.yaw;
    dy = Math.atan2(Math.sin(dy), Math.cos(dy));
    applyPose({
      x: l(a.x, b.x),
      y: l(a.y, b.y),
      z: l(a.z, b.z),
      zoom: Math.exp(l(Math.log(a.zoom), Math.log(b.zoom))),
      tilt: l(a.tilt, b.tilt),
      yaw: a.yaw + dy * u,
    });
  },
  /** The pose that fits these points on screen at this bearing and tilt (or the best bearing, if yaw is null). */
  frame(pts: [number, number, number][], tilt: number, yaw: number | null, margin = 0.1): Pose {
    const fit = (a: number) => {
      const s = Math.sin(a),
        c = Math.cos(a),
        hz = hzOf(tilt);
      let a0 = Infinity,
        a1 = -Infinity,
        b0 = Infinity,
        b1 = -Infinity;
      for (const [x, y, z] of pts) {
        const u = -x * s + y * c,
          v = tilt * (x * c + y * s) + z * hz;
        a0 = Math.min(a0, u);
        a1 = Math.max(a1, u);
        b0 = Math.min(b0, v);
        b1 = Math.max(b1, v);
      }
      // the screen below the start lights, with a margin all round
      const zoom = Math.min((W * (1 - 2 * margin)) / (a1 - a0), (H * (0.74 - 2 * margin)) / (b1 - b0));
      const u = (a0 + a1) / 2,
        v = (b0 + b1) / 2 / tilt;
      return { x: -s * u + c * v, y: c * u + s * v, z: 0, zoom, tilt, yaw: a };
    };
    if (yaw !== null) return fit(yaw);
    let best = fit(ISO_A);
    for (let k = 1; k < 48; k++) {
      const p = fit(ISO_A + (k / 48) * 2 * Math.PI);
      if (p.zoom > best.zoom * 1.0001) best = p;
    }
    return best;
  },
  /** The game's own camera, settled on the leading car as the home screen shows it (snap: jump there now). */
  track(snap = false): void {
    if (!snap) return;
    const c = cars[Math.max(0, GS.ctrl)];
    if (!c) return;
    cam.x = c.x;
    cam.y = c.y;
    cam.z = c.hz || 0;
    cam.a = ISO_A;
    cam.tilt = 0.5;
    cam.hz = 0.8;
    cam.zoom = clamp(Math.min(W, H) / 68, 4.6, 11) * (1.12 - (0.3 * c.v) / VMAX);
  },
};

// ---- the grade ----
/**
 * The inked page belongs to the renderer. The kit's INKED_PAGE was tuned for Matthew's outlined renderer (the
 * Three.js port uses it); on this fork's canvas renderer it turns the painted run-off into black wedges, so this one
 * is gentler: the same uncoloured page, with the greys kept.
 */
export const INKED_CANVAS = 'grayscale(1) brightness(1.5) contrast(1.35) sepia(.12)';
export const GRADES = { canvas: INKED_CANVAS, outlined: INKED_PAGE };
/** the grade this renderer uses before lights out */
const GRADE = GRADES.canvas;
// each part of the filter, and its value with no grade at all
const NONE: Record<string, number> = { grayscale: 0, sepia: 0, brightness: 1, contrast: 1, saturate: 1 };
const PARTS = [...GRADE.matchAll(/([a-z-]+)\(([\d.]+)\)/g)].map(p => [p[1], +p[2]] as [string, number]);
let gradeNow = -1;
/** The game canvas's grade: 0 is the inked page (an uncoloured comic page), 1 full colour; between, the flats going in. */
export function setGrade(mix: number): void {
  const m = clamp(mix, 0, 1);
  if (m === gradeNow) return;
  gradeNow = m;
  const cv = document.getElementById('c');
  if (!cv) return;
  if (m >= 1) cv.style.filter = '';
  else if (m <= 0) cv.style.filter = GRADE;
  else
    cv.style.filter = PARTS.map(([f, v]) => `${f}(${(v + ((NONE[f] ?? v) - v) * m).toFixed(3)})`).join(' ');
}

// ---- the racing line, drawn over the frame ----
/** Project a world point to CSS pixels with the camera of the frame just drawn. */
export function project(x: number, y: number, z: number): [number, number] {
  const pz = GS.PZ;
  GS.PZ = 0;
  const q = P(x, y, z);
  GS.PZ = pz;
  return q as [number, number];
}
function lineCanvas() {
  if (!lineCv) {
    lineCv = document.createElement('canvas');
    lineCv.className = 'iLine';
    lineCv.setAttribute('aria-hidden', 'true');
  }
  const w = Math.round(W * DPR),
    h = Math.round(H * DPR);
  if (lineCv.width !== w || lineCv.height !== h) {
    lineCv.width = w;
    lineCv.height = h;
  }
  return lineCv;
}
/** The canvas the line is drawn on, to put in the intro's overlay (above the graded game canvas, so it keeps colour). */
export function lineLayer(): HTMLCanvasElement {
  return lineCanvas();
}
/**
 * Draw Turn 1's racing line up to sample `head` (fractional): paper on the approach, red from the lift point, green
 * from the apex, each with an ink outline. Pass head < from to clear it.
 */
export function drawLine(head: number): void {
  const cv = lineCanvas(),
    g = cv.getContext('2d');
  g.setTransform(1, 0, 0, 1, 0, 0);
  g.clearRect(0, 0, cv.width, cv.height);
  if (!turn1 || head <= turn1.from) return;
  g.setTransform(DPR, 0, 0, DPR, 0, 0);
  g.lineCap = 'round';
  g.lineJoin = 'round';
  const w = Math.max(3, 0.55 * cam.zoom);
  const runs: [number, number, string][] = [
    [turn1.from, turn1.lift, PAPER],
    [turn1.lift, turn1.apex, RED],
    [turn1.apex, turn1.to, GO],
  ];
  const path = (a: number, b: number) => {
    g.beginPath();
    for (let i = a; ; i = Math.min(b, i + 1)) {
      const [x, y, z] = linePoint(i),
        q = project(x, y, z);
      if (i === a) g.moveTo(q[0], q[1]);
      else g.lineTo(q[0], q[1]);
      if (i >= b) break;
    }
  };
  // the ink first, under the whole drawn length, then each colour
  path(turn1.from, Math.min(head, turn1.to));
  g.strokeStyle = INK;
  g.lineWidth = w + 3;
  g.stroke();
  for (const [a, b, col] of runs) {
    if (head <= a) break;
    path(a, Math.min(head, b));
    g.strokeStyle = col;
    g.lineWidth = w;
    g.stroke();
  }
}

// ---- the start ----
/** Lights out: the cars go (in the attract race they race at once). */
export function carsLaunch(): void {
  if (shown !== 'grid') showGrid();
  if (GS.INTRO) GS.INTRO.hold = false;
}
/** Run the race on by `sec` seconds at once (for a frozen frame after lights out), then hold it there. */
export function advance(sec: number): void {
  if (!GS.INTRO) return;
  GS.INTRO.hold = false;
  const hook = GS.INTRO.camera;
  GS.INTRO.camera = () => false;
  for (let n = Math.round(sec / STEP); n > 0; n--) {
    step(STEP);
    updateCamera(STEP);
  }
  GS.INTRO.camera = hook;
  GS.INTRO.hold = true;
}

// ---- audio ----
/** The game's audio context (null until a tap has made one) and the output the intro's sounds go to: the game's
 * sound-effects bus, so the game's own sound switch mutes them too. */
export function audio(): { ctx: AudioContext | null; out: AudioNode | null; on: boolean } {
  return { ctx: AC, out: sfxG, on: !!(opts.sound || opts.music) };
}
/** From a tap: make or wake the game's audio context (iOS also needs this for sound with the ringer off). */
export function unlockSound(): void {
  unlockAudio();
}
/** Keep the game's music from starting (music starts at lights out, never before). */
export function holdMusic(): void {
  if (AC) GS.musNext = AC.currentTime + 1e5;
}
/** Start the game's own music (the home screen's) from its first beat at audio time `when`. */
export function startMusic(when: number): void {
  GS.musStep = 0;
  GS.musNext = when;
}
