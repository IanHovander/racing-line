import type { Theme } from '../types';
import { GS } from '../state';
import { AC, arpDelay, env, mf, musG, noiseSrc } from './audio';
import { curTheme, playStep } from './mixer';
/** theme currently being scheduled */
const MUS: {
  th?: Theme;
} = {};
/** a theme playing instead of the usual one (the intro's: intro/score.ts), or null */
export const MUSIC_CUE: { th: Theme | null } = { th: null };
/**
 * Play `th` instead of the usual theme, starting with its step `step` at audio time `at` (the intro starts its
 * score this way, in time with its pictures, and jumps it to the title on a skip). null goes back to the usual theme.
 */
export function cueTheme(th: Theme | null, step = 0, at?: number): void {
  MUSIC_CUE.th = th;
  if (!AC) return;
  const t = curTheme();
  MUS.th = t;
  GS.musStep = step;
  GS.musNext = at ?? AC.currentTime + 0.05;
  arpDelay.delayTime.setValueAtTime((60 / t.bpm) * 0.75, AC.currentTime);
}
export function scheduleMusic() {
  if (!AC || AC.state !== 'running') return;
  if (GS.musNext < AC.currentTime - 0.2) GS.musNext = AC.currentTime + 0.05;
  const th = curTheme();
  if (MUS.th !== th) {
    MUS.th = th;
    GS.musStep = 0;
    arpDelay.delayTime.setValueAtTime((60 / th.bpm) * 0.75, AC.currentTime);
  }
  while (GS.musNext < AC.currentTime + 0.15) {
    const sw = th.swing && GS.musStep % 2 === 1 ? (th.swing * 60) / th.bpm / 4 : 0;
    playStep(GS.musStep, GS.musNext + sw);
    GS.musNext += 60 / th.bpm / 4;
    GS.musStep++;
  }
}
// ---------- music: one procedural theme per circuit ----------
// small synth kit shared by every theme
export function tone(type, f, t, dur, g, o?) {
  o = o || {};
  const os = AC.createOscillator();
  os.type = type;
  os.frequency.setValueAtTime(f, t);
  if (o.slide) os.frequency.exponentialRampToValueAtTime(o.slide, t + (o.slideT || dur * 0.6));
  if (o.vib) {
    const l = AC.createOscillator();
    l.frequency.value = o.vib;
    const lg = AC.createGain();
    lg.gain.value = f * 0.012;
    l.connect(lg);
    lg.connect(os.frequency);
    l.start(t);
    l.stop(t + dur + 0.05);
  }
  if (o.det) os.detune.value = o.det;
  let n = os;
  if (o.lp) {
    const fl = AC.createBiquadFilter();
    fl.type = 'lowpass';
    fl.frequency.setValueAtTime(o.lp, t);
    if (o.lpEnd) fl.frequency.exponentialRampToValueAtTime(o.lpEnd, t + dur);
    fl.Q.value = o.q || 1;
    os.connect(fl);
    n = fl;
  }
  const gn = AC.createGain();
  if (o.pad) {
    gn.gain.setValueAtTime(0.0001, t);
    gn.gain.linearRampToValueAtTime(g, t + (o.att || 0.2));
    gn.gain.linearRampToValueAtTime(0.0001, t + dur);
  } else env(gn, t, g, dur, o.att);
  n.connect(gn);
  gn.connect(musG);
  if (o.echo) gn.connect(arpDelay);
  os.start(t);
  os.stop(t + dur + 0.05);
}
export function nz(t, dur, g, type, f, q?) {
  const n = noiseSrc();
  const fl = AC.createBiquadFilter();
  fl.type = type;
  fl.frequency.value = f;
  fl.Q.value = q || 0.8;
  const gn = AC.createGain();
  env(gn, t, g, dur);
  n.connect(fl);
  fl.connect(gn);
  gn.connect(musG);
  n.start(t, Math.random() * 1.5);
  n.stop(t + dur + 0.05);
}
export let lastKickT = -1,
  lastClapT = -1;
export function kick(t, g?) {
  if (Math.abs(t - lastKickT) < 0.01) return;
  lastKickT = t;
  const o = AC.createOscillator();
  o.frequency.setValueAtTime(150, t);
  o.frequency.exponentialRampToValueAtTime(45, t + 0.12);
  const gn = AC.createGain();
  env(gn, t, g || 0.9, 0.28);
  o.connect(gn);
  gn.connect(musG);
  o.start(t);
  o.stop(t + 0.3);
}
export const clap = (t, g?) => {
    if (Math.abs(t - lastClapT) < 0.01) return;
    lastClapT = t;
    nz(t, 0.16, g || 0.5, 'bandpass', 1700, 0.8);
  },
  hat = (t, open, g?) => nz(t, open ? 0.12 : 0.035, (g || 1) * (open ? 0.16 : 0.06), 'highpass', 7500);
/** the one music theme (Ardennes new beat), set up in init() */
export const THEMES: Record<string, Theme> = {};
export function init(): void {
  // Ardennes Forest: Belgian new beat — slow, heavy EBM kick, acid bass line and dark stabs (A minor)
  THEMES.newbeat = {
    bpm: 112,
    play(s, t) {
      const beat = s % 16,
        bar = Math.floor(s / 16),
        sec = Math.floor(bar / 8) % 4;
      if (beat % 4 === 0) kick(t, 0.95);
      if (beat === 4 || beat === 12) {
        clap(t, 0.55);
        nz(t + 0.11, 0.12, 0.12, 'bandpass', 1500, 0.8);
      }
      if (beat % 2 === 1) hat(t, beat % 4 === 3, 0.7);
      const RT = [45, 45, 48, 43][bar % 4],
        AC1 = [0, 12, 0, 0, 12, 0, 15, 0, 0, 12, 0, 10, 0, 12, 7, 0];
      tone('sawtooth', mf(RT + AC1[beat]), t, 0.16, 0.2, {
        lp: 400 + (sec >= 1 ? 1600 * (0.5 + 0.5 * Math.sin(bar * 0.7 + beat * 0.3)) : 300),
        lpEnd: 180,
        q: 12,
      });
      if (sec >= 1 && (beat === 2 || beat === 10))
        for (const m of [RT + 24, RT + 27, RT + 31])
          tone('square', mf(m), t, 0.14, 0.035, { lp: 2200, echo: true });
      if (beat === 0)
        for (const m of [RT + 12, RT + 15, RT + 19])
          tone('sawtooth', mf(m), t, (60 / 112) * 4, 0.025, {
            lp: 700,
            pad: true,
            att: 0.4,
            det: (Math.random() - 0.5) * 20,
          });
      if (sec === 3 && beat % 2 === 0) {
        const L = [69, 72, 76, 72, 69, 67, 64, 67][beat / 2];
        tone('square', mf(L + 12), t, 0.1, 0.04, { lp: 3000, echo: true });
      }
    },
  };
}
/** debug/test hook: reassign a module-level binding */
export function __set(name: string, v: any): void {
  switch (name) {
    case 'lastKickT':
      lastKickT = v;
      break;
    case 'lastClapT':
      lastClapT = v;
      break;
  }
}
