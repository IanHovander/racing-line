// The intro's board, "Lights Out": five beats, each lighting one more start bulb, then lights out. Everything on
// screen is a function of the intro clock t (seconds), so a frame can be frozen (?at=) and the cuts land on the beat.
//   Light 1  The wound    an inked page; a caption and a timing tower type on: MARLOW +0.040. Hold on the number.
//   Light 2  Dawn         the helicopter comes down onto an empty Lone Star, an uncoloured comic page; one car rolls
//                         through Turn 1
//   Light 3  The line     the racing line draws itself through Turn 1: paper, red from the lift point, green from
//                         the apex. "Lift."
//   Light 4  Gus          his panel on the inked page: "Turn 1." then "Again."
//   Light 5  You          your helmet over the ten cars on the grid; revs, then 0.6 s of silence
//   Lights out            the bulbs go dark, the colourist's flats go in (120 ms), the cars launch, the game's music
//                         starts and the title arrives with its streaks; the home screen's buttons settle in.
// The grid is the game's music tempo (112 bpm): lights out is its first beat, so the home screen's music carries on.
import './intro.css';
import {
  EASE_OUT,
  PAPER,
  balloonHTML,
  bulbsHTML,
  captionHTML,
  gusSVG,
  panelHTML,
  powerHTML,
  setBulbs,
  streaksSVG,
  youSVG,
  type GusFace,
} from '../art/index';
import * as world from './world';
import type { Pose } from './world';
import type { Sound } from './sound';

export const BEAT = 60 / 112;
const b = (n: number) => n * BEAT;
/** the five lights */
export const LIGHTS = [b(0), b(8), b(16), b(24), b(32)];
export const [L1, L2, L3, L4, L5] = LIGHTS;
/** lights out, a little before the rhythm says (real lights go out when they choose) */
export const OUT = b(39);
/** the silence before it */
export const HUSH = OUT - 0.6;
/** the title lands */
export const LAND = b(40);
/** the home screen's buttons arrive, then the intro hands over */
export const SETTLE = b(43);
export const END = b(44);

const clamp01 = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x);
const seg = (t: number, a: number, z: number) => clamp01((t - a) / (z - a));
/** a CSS cubic-bezier as a function */
function bezier(x1: number, y1: number, x2: number, y2: number) {
  const cx = 3 * x1,
    bx = 3 * (x2 - x1) - cx,
    ax = 1 - cx - bx,
    cy = 3 * y1,
    by = 3 * (y2 - y1) - cy,
    ay = 1 - cy - by;
  return (x: number) => {
    if (x <= 0) return 0;
    if (x >= 1) return 1;
    let u = x;
    for (let i = 0; i < 8; i++) {
      const e = ((ax * u + bx) * u + cx) * u - x;
      if (Math.abs(e) < 1e-5) break;
      u = clamp01(u - e / ((3 * ax * u + 2 * bx) * u + cx || 1e-6));
    }
    return ((ay * u + by) * u + cy) * u;
  };
}
/** the bible's arrival, cubic-bezier(.2,.8,.2,1) */
const arrive = bezier(...(EASE_OUT.match(/[\d.]+/g).map(Number) as [number, number, number, number]));
/** the helicopter settling: moving at once, slowing all the way down */
const descend = (u: number) => 1 - Math.pow(1 - u, 2.4);

// ---- light 1: the wound ----
const CAPTION = 'Final round · Lap 71';
const TOWER = [
  { at: b(2), pos: '1', name: 'Vance', gap: '' },
  { at: b(3.5), pos: '2', name: 'Marlow', gap: '+0.040' },
];
const GAP_AT = b(5); // +0.040 comes up on the tower
const HERO_AT = b(6); // and the cut to it, close
const TYPE = 0.03; // seconds a letter
// ---- light 2: the dawn car (its timing at racing speed times ROLL_K) ----
const ROLL_K = 0.8;
const ROLL_FROM = L2 + 0.15;
// ---- light 3: the line, drawn at LINE_RATE times a racing car's pace ----
const LINE_FROM = L3 + 0.3;
const LINE_RATE = 1.8;
// ---- light 4: Gus ----
const SAY = [b(26), b(28)];
const BLINK = b(30.5);
// ---- light 5: the grid ----
const REVS = L5 + 1.4;

export interface Board {
  /** the overlay's root element */
  el: HTMLElement;
  /** show the frame for time t; returns true while the intro is placing the camera itself */
  frame(t: number, frozen: boolean): boolean;
  /** draw what goes over the game's finished frame */
  after(t: number): void;
  /** the invitation before the first tap */
  invite(on: boolean): void;
  /** the sounds of the film, by time */
  cues(): { t: number; play: (s: Sound, at: number) => void }[];
  remove(): void;
}

export function makeBoard(): Board {
  const el = document.createElement('div');
  el.id = 'intro';
  el.setAttribute('role', 'presentation');
  el.innerHTML =
    `<div class="iPage"></div>` +
    `<div class="iBulbs">${bulbsHTML(0)}</div>` +
    `<div class="iInvite"><p class="iTap">Tap to start</p><p class="iSnd">Sound on</p></div>` +
    `<div class="iBeat iWound">${captionHTML(CAPTION)}` +
    panelHTML(
      TOWER.map(
        r =>
          `<p class="iRow"><b class="iNum">${r.pos}</b><span class="iName"></span><i class="iNum iGap"></i></p>`,
      ).join(''),
      'iTower',
    ) +
    `</div>` +
    `<div class="iBeat iHero">${panelHTML(`<p class="iLabel">2 Marlow</p><p class="iNum iBig">+0.040</p>`, 'iHeroP')}</div>` +
    `<div class="iCorner">${captionHTML('Lone Star Circuit · Turn 1')}</div>` +
    `<div class="iLift">${powerHTML('Lift.')}</div>` +
    `<div class="iBeat iGus">${panelHTML(`<div class="iFace"></div>${balloonHTML('Turn 1.\n*Again.*', 'down')}`, 'iGusP')}</div>` +
    `<div class="iBeat iYou">${panelHTML(`<div class="iHelmet">${youSVG(27, { size: '100%', framed: false })}</div>`, 'iYouP')}</div>` +
    `<div class="iTrail">${streaksSVG('100%', PAPER, { height: '100%' })}</div>` +
    `<p class="iSkip">Skip</p>`;
  el.insertBefore(world.lineLayer(), el.children[1]);
  document.body.appendChild(el);
  const q = (s: string) => el.querySelector(s) as HTMLElement;
  const page = q('.iPage'),
    bulbs = q('.iBulbs'),
    inviteEl = q('.iInvite'),
    wound = q('.iWound'),
    cap = q('.iWound .lc-caption'),
    names = [...el.querySelectorAll('.iName')] as HTMLElement[],
    rows = [...el.querySelectorAll('.iRow')] as HTMLElement[],
    gap = rows[1].querySelector('.iGap') as HTMLElement,
    tower = q('.iTower'),
    hero = q('.iHero'),
    corner = q('.iCorner'),
    lift = q('.iLift'),
    gus = q('.iGus'),
    face = q('.iFace'),
    balloon = q('.iGus .lc-balloon'),
    again = q('.iGus .lc-balloon em'),
    you = q('.iYou'),
    trail = q('.iTrail'),
    skip = q('.iSkip');
  /** reduced motion: the title appears where it lands, without the flight or the streaks */
  const still = !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  const root = document.documentElement.style;
  const logo = document.querySelector('.hLogo') as HTMLElement | null;

  // cheap DOM writes: only when something changes
  const vis = new Map<HTMLElement, boolean>();
  const show = (e: HTMLElement, on: boolean) => {
    if (vis.get(e) === on) return;
    vis.set(e, on);
    e.style.display = on ? '' : 'none';
  };
  const txt = new Map<HTMLElement, string>();
  const text = (e: HTMLElement, s: string) => {
    if (txt.get(e) === s) return;
    txt.set(e, s);
    e.textContent = s;
  };
  const typed = (s: string, from: number, t: number) =>
    s.slice(0, Math.max(0, Math.floor((t - from) / TYPE)));
  let lit = -1,
    faceNow = '',
    vars = '';
  const setFace = (f: GusFace) => {
    if (f === faceNow) return;
    faceNow = f;
    face.innerHTML = gusSVG(f, { size: '100%', framed: false });
  };
  const setVars = (logoO: number, logoX: number, ui: number) => {
    const k = `${logoO}|${logoX.toFixed(1)}|${ui.toFixed(3)}`;
    if (k === vars) return;
    vars = k;
    root.setProperty('--intro-logo', String(logoO));
    root.setProperty('--intro-logo-x', logoX.toFixed(1) + 'px');
    root.setProperty('--intro-ui', ui.toFixed(3));
  };

  // the helicopter for the dawn shots, worked out for this screen's shape: high over the circuit, then down onto the
  // one car and along with it through Turn 1 (light 2); the cut to the whole corner for the line (light 3)
  let poses: { high: Pose; wide: Pose } | null = null,
    posesFor = '';
  const descent = () => {
    const key = innerWidth + 'x' + innerHeight;
    if (!poses || key !== posesFor) {
      const T = world.turn1,
        pts = [];
      for (let i = T.from; i <= T.to; i += 4) pts.push(world.linePoint(i));
      const wide = world.camera.frame(pts, 0.5, null, 0.08);
      poses = { high: { ...wide, zoom: wide.zoom * 0.2, tilt: 0.88, yaw: wide.yaw + 0.6 }, wide };
      posesFor = key;
    }
    return poses;
  };
  // the dawn car: where it is at time t (sample index)
  const T1 = world.turn1;
  const rollStart = world.lineTime(T1.from);
  const rollAt = (t: number) => world.lineAt(rollStart + (t - ROLL_FROM) * ROLL_K);
  /** metres of road across the screen's short side at the bottom of the descent: the car about 44 px long on a phone */
  const ROAD_M = 46;

  let launched = false,
    advanced = false,
    lineDrawn = false;

  const board: Board = {
    el,
    invite(on) {
      show(inviteEl, on);
      if (on) {
        show(page, true);
        for (const e of [wound, hero, corner, lift, gus, you, trail, skip]) show(e, false);
        setBulbs(bulbs, 0);
        show(bulbs, true);
        setVars(0, 0, 0);
      }
    },
    frame(t, frozen) {
      // ---- the world ----
      let mine = false;
      if (t < L4) {
        world.showCorner(t >= L2 && t < L3);
        const { high, wide } = descent();
        if (t < L3) {
          // down onto the car, following a moment behind it
          const i = rollAt(t),
            [x, y, z] = world.linePoint(rollAt(t - 0.3));
          world.placeCar(i, world.lineSpeed(i) * ROLL_K);
          const close = Math.min(innerWidth, innerHeight) / ROAD_M;
          world.camera.flyTo(high, { ...wide, x, y, z, zoom: close }, descend(seg(t, L2, L3)));
        } else world.camera.flyTo(wide, wide, 1);
        mine = true;
      } else world.showGrid();
      if (t >= OUT && !launched) {
        launched = true;
        world.carsLaunch();
        if (frozen && !advanced) {
          advanced = true;
          world.advance(t - OUT);
        }
      }
      world.setGrade(seg(t, OUT, OUT + 0.12));

      // ---- the page and the bulbs ----
      show(page, t < L2 || (t >= L4 && t < L5));
      const n = t >= OUT ? 0 : LIGHTS.filter(l => t >= l).length;
      if (n !== lit) {
        lit = n;
        setBulbs(bulbs, n);
      }
      show(bulbs, t < LAND - 0.3); // dark for a moment, then out of the title's way
      show(skip, t >= 1 && t < OUT && !frozen);

      // ---- light 1 ----
      show(wound, t < HERO_AT);
      if (t < HERO_AT) {
        text(cap, typed(CAPTION, 0.45, t));
        show(tower, t >= TOWER[0].at);
        TOWER.forEach((r, k) => {
          show(rows[k], t >= r.at);
          text(names[k], typed(r.name, r.at, t));
        });
        text(gap, t >= GAP_AT ? '+0.040' : '');
      }
      show(hero, t >= HERO_AT && t < L2);

      // ---- lights 2 and 3 ----
      show(corner, t >= L2 + BEAT && t < L3);
      show(lift, false);
      if (t >= L3 && t < L4) {
        const head = world.lineAt((t - LINE_FROM) * LINE_RATE);
        // the word and the turn to red are one event: it appears on that frame, beside the red segment's start, on
        // the outside of the bend, like a note in the margin
        if (head >= T1.lift) {
          show(lift, true);
          const p = (i: number) => {
              const [x, y, z] = world.linePoint(i);
              return world.project(x, y, z);
            },
            [sx, sy] = p(T1.lift),
            [tx, ty] = p(T1.lift + 4),
            [ax, ay] = p(T1.apex);
          let nx = sy - ty,
            ny = tx - sx;
          const nl = Math.hypot(nx, ny) || 1;
          nx /= nl;
          ny /= nl;
          if (nx * (ax - sx) + ny * (ay - sy) > 0) {
            nx = -nx;
            ny = -ny;
          }
          const w = lift.offsetWidth,
            h = lift.offsetHeight,
            g = 10,
            px = sx + nx * g - (nx < -0.35 ? w : nx > 0.35 ? 0 : w / 2),
            py = sy + ny * g - (ny < -0.35 ? h : ny > 0.35 ? 0 : h / 2);
          lift.style.transform = `translate(${Math.round(px)}px, ${Math.round(py)}px)`;
        }
      }

      // ---- light 4 ----
      show(gus, t >= L4 && t < L5);
      if (t >= L4 && t < L5) {
        const speaking = SAY.some(s => t >= s && t < s + 0.28);
        setFace(speaking ? 'count' : t >= BLINK && t < BLINK + 0.14 ? 'blink' : 'stern');
        show(balloon, t >= SAY[0]);
        again.style.visibility = t >= SAY[1] ? '' : 'hidden';
        balloon.dataset.tail = innerWidth > innerHeight ? 'left' : 'down';
      }

      // ---- light 5 ----
      show(you, t >= L5 && t < OUT);

      // ---- lights out: the title arrives from the left, its streaks trailing, then the home screen ----
      const fly = still ? (t >= LAND ? 1 : 0) : seg(t, LAND - 0.3, LAND),
        lw = logo ? logo.offsetWidth : 300,
        x = -(1 - arrive(fly)) * (innerWidth * 0.5 + lw);
      setVars(t >= (still ? LAND : LAND - 0.3) ? 1 : 0, x, arrive(seg(t, SETTLE, SETTLE + 0.3)));
      const trailOn = !still && t >= LAND - 0.3 && t < LAND + 0.25;
      show(trail, trailOn);
      if (trailOn && logo) {
        const r = logo.getBoundingClientRect(),
          len = innerWidth * (0.15 + 0.45 * (1 - fly));
        trail.style.width = Math.round(len) + 'px';
        trail.style.transform = `translate(${Math.round(r.left + r.width * 0.12 - len)}px, ${Math.round(r.top + r.height * 0.02)}px)`;
        trail.style.height = Math.round(r.height) + 'px';
        trail.style.opacity = String(1 - seg(t, LAND, LAND + 0.25));
      }
      return mine;
    },
    after(t) {
      if (t >= L3 && t < L4) {
        world.drawLine(world.lineAt((t - LINE_FROM) * LINE_RATE));
        lineDrawn = true;
      } else if (lineDrawn) {
        world.drawLine(-1);
        lineDrawn = false;
      }
    },
    cues() {
      const out: { t: number; play: (s: Sound, at: number) => void }[] = [];
      for (const l of LIGHTS) out.push({ t: l, play: (s, at) => s.beep(at) });
      out.push({ t: L2, play: (s, at) => s.wind(at, at + (L4 - L2)) });
      const rollFrom = L2,
        rollEnd = L3;
      out.push({
        t: rollFrom,
        play: (s, at) =>
          s.roll(
            at,
            at + (rollEnd - rollFrom),
            sec => world.lineSpeed(rollAt(rollFrom + sec)) * ROLL_K,
            sec => 0.2 + 0.8 * descend(seg(rollFrom + sec, L2, L3)),
          ),
      });
      for (const s of SAY) out.push({ t: s - 0.12, play: (snd, at) => snd.radio(at) });
      out.push({
        t: L5 + 0.25,
        play: (s, at) => s.grid(at, at + (REVS - L5 - 0.25), at + (HUSH - L5 - 0.25)),
      });
      out.push({ t: OUT, play: (s, at) => s.launch(at, at + 2.6) });
      out.push({ t: LAND - 0.3, play: (s, at) => s.whoosh(at, 0.3) });
      return out.sort((p, q2) => p.t - q2.t);
    },
    remove() {
      el.remove();
      for (const k of ['--intro-logo', '--intro-logo-x', '--intro-ui']) root.removeProperty(k);
    },
  };
  return board;
}
