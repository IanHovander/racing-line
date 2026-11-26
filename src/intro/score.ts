// The intro's music: the menu theme's own intro, in its tempo (112 bpm) and key (A minor), cut to the picture.
// Times are in beats (one beat = 4 steps of the music scheduler); the shots in intro.ts cut on the same beats.
//
//   0–12   the grid: a low drone, one stab for each start light (beats 2, 4, 6, 8, 10), a riser, a breath
//   12     lights out: the drop
//   12–32  the race: kick, claps, acid bass opening up, stabs; a lead line from the battle (28)
//   32–36  the flyover: a snare roll and a riser into the title
//   36     the title: a hit and a chord
//   44     the menu theme carries on from its first bar
import type { Theme } from '../types';
import { AC, env, mf, musG, noiseSrc } from '../audio/audio';
import { THEMES, clap, hat, kick, nz, tone } from '../audio/music';

export const BPM = 112;
/** seconds per beat */
export const SPB = 60 / BPM;

/** where things happen, in beats from the start of the intro */
export const CUE = {
  lights: [2, 4, 6, 8, 10],
  out: 12,
  leader: 18,
  line: 22,
  battle: 28,
  fly: 32,
  title: 36,
  buttons: 40,
  end: 44,
};

/** the notes of the five light stabs (A minor, climbing) */
const LIGHT_NOTES = [69, 72, 74, 76, 79];
/** bass roots by bar of the race (the menu theme's progression) */
const ROOTS = [45, 45, 48, 43];
/** the acid bass pattern, semitones over the root by step */
const ACID = [0, 12, 0, 0, 12, 0, 15, 0, 0, 12, 0, 10, 0, 12, 7, 0];

/** a stretch of filtered noise sweeping from f0 to f1 and swelling from g0 to g1 (the risers, cut into one-beat pieces so a skip stops them) */
function sweep(t: number, dur: number, f0: number, f1: number, g0: number, g1: number): void {
  const n = noiseSrc(true),
    fl = AC.createBiquadFilter(),
    gn = AC.createGain();
  fl.type = 'bandpass';
  fl.Q.value = 2.2;
  fl.frequency.setValueAtTime(f0, t);
  fl.frequency.exponentialRampToValueAtTime(f1, t + dur);
  gn.gain.setValueAtTime(0.0001, t);
  gn.gain.linearRampToValueAtTime(g0, t + 0.012);
  gn.gain.linearRampToValueAtTime(g1, t + dur - 0.012);
  gn.gain.linearRampToValueAtTime(0.0001, t + dur);
  n.connect(fl);
  fl.connect(gn);
  gn.connect(musG);
  n.start(t, Math.random() * 1.5);
  n.stop(t + dur + 0.05);
}

/** a crash cymbal and a sub drop: lights out and the title */
function hit(t: number, g: number): void {
  nz(t, 1.6, 0.32 * g, 'highpass', 4800, 0.6);
  nz(t, 0.5, 0.25 * g, 'bandpass', 900, 0.7);
  kick(t, 1);
  const o = AC.createOscillator(),
    gn = AC.createGain();
  o.type = 'sine';
  o.frequency.setValueAtTime(70, t);
  o.frequency.exponentialRampToValueAtTime(32, t + 1.1);
  env(gn, t, 0.55 * g, 1.3, 0.01);
  o.connect(gn);
  gn.connect(musG);
  o.start(t);
  o.stop(t + 1.4);
}

/** the groove under the race; `drive` (0..1) opens the bass filter */
function groove(s: number, t: number, drive: number): void {
  const step = s % 16,
    bar = Math.floor(s / 16);
  const RT = ROOTS[bar % 4];
  if (step % 4 === 0) kick(t, 0.95);
  if (step === 4 || step === 12) {
    clap(t, 0.55);
    nz(t + 0.11, 0.12, 0.12, 'bandpass', 1500, 0.8);
  }
  hat(t, step % 4 === 2, step % 2 ? 0.45 : 0.75);
  tone('sawtooth', mf(RT + ACID[step]), t, 0.16, 0.2, { lp: 420 + 2600 * drive, lpEnd: 180, q: 12 });
  if (step === 2 || step === 10)
    for (const m of [RT + 24, RT + 27, RT + 31])
      tone('square', mf(m), t, 0.14, 0.035, { lp: 2400, echo: true });
}

/** one step (a 16th) of the intro: s counts from the start of the intro */
function play(s: number, t: number): void {
  const B = s / 4,
    spb = SPB;
  if (B >= CUE.end) {
    // the intro is over: the menu theme, from its first bar
    THEMES.newbeat.play(s - CUE.end * 4, t);
    return;
  }
  if (B < CUE.out) {
    // ---- the grid ----
    if (s % 8 === 0 && B < CUE.out - 1)
      // a low drone, re-struck every two beats so a skip cuts it short
      for (const m of [33, 45])
        tone('sawtooth', mf(m), t, spb * 2.2, 0.05, {
          lp: 220 + 60 * B,
          pad: true,
          att: B === 0 ? 0.9 : 0.25,
          det: m === 45 ? 7 : -7,
        });
    const li = CUE.lights.indexOf(B);
    if (li >= 0) {
      // a light comes on: a thump and a stab, a step higher each time
      kick(t, 0.75);
      tone('square', mf(LIGHT_NOTES[li]), t, 0.32, 0.07, { lp: 3200, echo: true });
      tone('sawtooth', mf(LIGHT_NOTES[li] - 24), t, 0.5, 0.09, { lp: 900, lpEnd: 200 });
    }
    // hats creep in, then claps, then a roll into the drop
    if (B >= 6 && s % 2 === 0) hat(t, false, 0.35 + 0.05 * (B - 6));
    if (B >= 8 && B < 10 && s % 4 === 0) clap(t, 0.25);
    if (B >= 10 && B < 11.5) clap(t, 0.08 + 0.17 * ((B - 10) / 1.5));
    // the riser, a beat at a time
    if (s % 4 === 0 && B >= 2 && B < 11.5) {
      const u0 = (B - 2) / 9.5,
        u1 = Math.min(1, (B + 1 - 2) / 9.5),
        dur = Math.min(spb, (11.5 - B) * spb);
      sweep(t, dur, 300 * Math.pow(14, u0), 300 * Math.pow(14, u1), 0.02 + 0.08 * u0, 0.02 + 0.08 * u1);
    }
    return; // 11.5 to 12: silence, the breath before lights out
  }
  if (B === CUE.out) hit(t, 1.1);
  if (B < CUE.fly) {
    // ---- the race ----
    const u = (B - CUE.out) / (CUE.fly - CUE.out);
    groove(s - CUE.out * 4, t, 0.25 + 0.75 * u);
    if (B >= CUE.battle && s % 2 === 0) {
      const L = [69, 72, 76, 72, 69, 67, 64, 67][(s / 2) % 8];
      tone('square', mf(L + 12), t, 0.1, 0.045, { lp: 3000, echo: true });
    }
    return;
  }
  if (B < CUE.title) {
    // ---- the flyover: everything rolls into the title ----
    const u = (B - CUE.fly) / (CUE.title - CUE.fly);
    if (s % 4 === 0 && B < CUE.title - 0.5) kick(t, 0.9);
    if (B < CUE.title - 0.5) {
      if (u < 0.5 ? s % 2 === 0 : true) clap(t, 0.08 + 0.14 * u);
      hat(t, false, 0.5);
      if (s % 2 === 0)
        tone('sawtooth', mf(45 + (s % 4 ? 12 : 0)), t, 0.14, 0.12, { lp: 600 + 1800 * u, q: 8 });
    }
    if (s % 4 === 0 && B < CUE.title - 0.5) {
      const u1 = Math.min(1, u + 0.25);
      sweep(t, spb, 500 * Math.pow(12, u), 500 * Math.pow(12, u1), 0.03 + 0.07 * u, 0.03 + 0.07 * u1);
    }
    return;
  }
  // ---- the title ----
  if (B === CUE.title) {
    hit(t, 1.5);
    for (const m of [57, 60, 64, 69])
      tone('sawtooth', mf(m), t, spb * 6, 0.05, {
        lp: 1600,
        lpEnd: 500,
        pad: true,
        att: 0.05,
        det: (m % 3) * 6,
      });
  }
  if (B >= CUE.title && B < CUE.title + 1) {
    // the logo's sparkle: a fast arpeggio up the chord
    const k = s - CUE.title * 4;
    tone('square', mf([81, 84, 88, 93][k]), t, 0.12, 0.04, { lp: 4200, echo: true });
  }
  if (B >= CUE.title + 2) {
    // the groove comes back, gently, and hands over to the menu theme at 44
    const step = s % 16;
    if (step % 4 === 0) kick(t, 0.85);
    if (step % 2 === 1) hat(t, step % 4 === 3, 0.6);
    if (B >= CUE.title + 4 && (step === 4 || step === 12)) clap(t, 0.45);
    tone('sawtooth', mf(45 + ACID[step]), t, 0.16, 0.16, { lp: 380, lpEnd: 180, q: 12 });
  }
}

/** the intro's theme for the music scheduler (audio/music.ts cueTheme) */
export const INTRO_THEME: Theme = { bpm: BPM, play };
