// The intro, played over the live game (index.html?intro, the first visit, or the campaign before its cold open).
//   playIntro({ onDone })   plays it and hands over to the home screen; returns { stop() }
// The picture is a pure function of the intro clock. While sound runs the clock is the audio clock, so the beeps,
// the silence and lights out land on the frame they belong to; before a tap (or muted) it runs on its own.
// Taps: the first starts it with sound (iOS only lets sound start from a tap); after the first second a tap skips to
// lights out, and one after lights out goes straight to the home screen. If the phone held the sound back, the next
// tap only wakes it.
import { GS } from '../state';
import { makeBoard, END, OUT, type Board } from './board';
import { Sound } from './sound';
import * as world from './world';

export interface IntroOpts {
  /** called once the home screen is up (after the last frame, or a skip) */
  onDone?: () => void;
  /** start at lights out */
  skipToTitle?: boolean;
  /** freeze this frame (seconds; ?at=) */
  at?: number | null;
  /** no intro sounds (?mute) */
  mute?: boolean;
}
/** set once the intro has played in this browser (it plays once; ?intro replays it) */
export const SEEN_KEY = 'hcgp_introSeen';

let current: { stop(): void } | null = null;

export function playIntro(o: IntroOpts = {}): { stop(): void } {
  current?.stop();
  const html = document.documentElement;
  html.classList.add('intro');
  const frozen = o.at != null && Number.isFinite(o.at) ? Math.max(0, o.at) : null;
  const sound = new Sound();
  sound.muted = !!o.mute;
  const perfNow = () => performance.now() / 1000;
  let state: 'invite' | 'play' | 'done' = 'invite',
    perf0 = perfNow(),
    ac0 = 0,
    onAudio = false,
    woke = false,
    musicOn = false,
    lastT = 0;
  let board: Board;
  const cues = () => board.cues();
  let list: ReturnType<typeof cues> = [],
    cursor = 0;

  /** the intro clock, in seconds */
  function time(): number {
    if (frozen !== null) return frozen;
    if (state !== 'play') return 0;
    if (!sound.muted && sound.running) {
      if (!onAudio) {
        // the sound has just come up: it joins the picture where the picture is
        ac0 = sound.now() - (perfNow() - perf0);
        onAudio = true;
        sound.newBus();
        resync(perfNow() - perf0);
      }
      const t = sound.now() - ac0;
      perf0 = perfNow() - t;
      return t;
    }
    onAudio = false;
    return perfNow() - perf0;
  }
  /** cues from time t on are still to come */
  function resync(t: number) {
    cursor = list.findIndex(c => c.t >= t - 0.12);
    if (cursor < 0) cursor = list.length;
  }
  /** queue the sounds of the next quarter second on the audio clock */
  function pump(t: number) {
    const ctx = world.audio().ctx;
    if (ctx) {
      // the game's music starts at lights out and never before
      if (t < OUT && !musicOn) world.holdMusic();
      else if (!musicOn) {
        musicOn = true;
        world.startMusic(onAudio ? ac0 + OUT : ctx.currentTime + 0.02);
      }
    }
    if (!onAudio) return;
    while (cursor < list.length && list[cursor].t < t + 0.25) {
      const c = list[cursor++];
      if (c.t >= t - 0.12) c.play(sound, ac0 + Math.max(c.t, t - 0.02));
    }
  }
  function seek(t: number) {
    perf0 = perfNow() - t;
    if (onAudio) {
      ac0 = sound.now() - t;
      sound.newBus();
    }
    resync(t);
  }
  function start(t: number) {
    state = 'play';
    board.invite(false);
    try {
      localStorage.setItem(SEEN_KEY, '1');
    } catch {
      // storage blocked: it plays again next time
    }
    seek(t);
  }

  // ---- each frame, inside the game's own loop ----
  function frame(): boolean {
    if (state === 'done') return false;
    if (state === 'invite' && frozen === null) {
      // the campaign may call this from a tap: then the sound is already running and there's nothing to wait for
      if (sound.muted || sound.running) start(o.skipToTitle ? OUT : 0);
      else return false; // the inked page covers the world until the tap
    }
    const t = time();
    lastT = t;
    pump(t);
    if (t >= END && frozen === null) {
      finish();
      return false;
    }
    return board.frame(t, frozen !== null);
  }
  function after() {
    if (state !== 'done') board.after(lastT);
  }

  // ---- taps and keys ----
  function press() {
    if (state === 'done' || frozen !== null) return;
    if (state === 'invite') {
      world.unlockSound();
      start(o.skipToTitle ? OUT : 0);
      return;
    }
    const t = time();
    if (t < 1) return;
    if (!sound.muted && !sound.running && !woke) {
      // the phone held the sound back: this tap wakes it, the next one skips
      woke = true;
      world.unlockSound();
      return;
    }
    if (t < OUT - 0.05) seek(OUT);
    else finish();
  }
  const onClick = (e: Event) => {
    e.preventDefault();
    press();
  };
  const onKey = (e: KeyboardEvent) => {
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    if (e.key === ' ' || e.key === 'Enter' || e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      if (!e.repeat) press();
    }
  };
  // any tap retries the sound, in case an earlier one didn't count (iOS counts the end of a tap)
  const retry = () => {
    if (state === 'play' && !sound.muted && !sound.running) world.unlockSound();
  };

  function cleanup() {
    if (state === 'done') return;
    state = 'done';
    window.removeEventListener('keydown', onKey, true);
    window.removeEventListener('pointerup', retry, true);
    world.release();
    sound.close();
    const ctx = world.audio().ctx;
    if (!musicOn && ctx) world.startMusic(ctx.currentTime + 0.05);
    board.remove();
    html.classList.remove('intro', 'intro-up');
    if (current === handle) current = null;
  }
  function finish() {
    cleanup();
    o.onDone?.();
  }

  world.stage({ frame: () => frame(), after });
  board = makeBoard();
  list = cues();
  board.el.addEventListener('click', onClick);
  window.addEventListener('keydown', onKey, true);
  window.addEventListener('pointerup', retry, true);
  html.classList.add('intro-up');
  board.invite(frozen === null);
  if (frozen !== null) state = 'play';

  const handle = { stop: cleanup };
  current = handle;
  if (/[?&]debug\b/.test(location.search) || /^(localhost|127\.0\.0\.1)$/.test(location.hostname))
    (window as any).__intro = {
      time: () => (state === 'play' ? lastT : state === 'invite' ? -1 : Infinity),
      state: () => state,
      press,
      stop: cleanup,
      hold: () => GS.INTRO?.hold,
    };
  return handle;
}
