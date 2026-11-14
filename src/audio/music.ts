import type { Theme } from '../types';
import { GS } from '../state';
import { AC, arpDelay, env, mf, musG, noiseSrc } from './audio';
import { curTheme, playStep } from './mixer';
/** theme currently being scheduled */
const MUS: {
  th?: Theme;
} = {};
export function scheduleMusic() {
  if (!AC || AC.state !== 'running')
    return;
  if (GS.musNext < AC.currentTime - 0.2)
    GS.musNext = AC.currentTime + 0.05;
  const th = curTheme();
  if (MUS.th !== th) {
    MUS.th = th;
    GS.musStep = 0;
    arpDelay.delayTime.setValueAtTime(60 / th.bpm * 0.75, AC.currentTime);
  }
  while (GS.musNext < AC.currentTime + 0.15) {
    const sw = (th.swing && GS.musStep % 2 === 1) ? th.swing * 60 / th.bpm / 4 : 0;
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
  if (o.slide)
    os.frequency.exponentialRampToValueAtTime(o.slide, t + (o.slideT || dur * 0.6));
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
  if (o.det)
    os.detune.value = o.det;
  let n = os;
  if (o.lp) {
    const fl = AC.createBiquadFilter();
    fl.type = 'lowpass';
    fl.frequency.setValueAtTime(o.lp, t);
    if (o.lpEnd)
      fl.frequency.exponentialRampToValueAtTime(o.lpEnd, t + dur);
    fl.Q.value = o.q || 1;
    os.connect(fl);
    n = fl;
  }
  const gn = AC.createGain();
  if (o.pad) {
    gn.gain.setValueAtTime(0.0001, t);
    gn.gain.linearRampToValueAtTime(g, t + (o.att || 0.2));
    gn.gain.linearRampToValueAtTime(0.0001, t + dur);
  }
  else
    env(gn, t, g, dur, o.att);
  n.connect(gn);
  gn.connect(musG);
  if (o.echo)
    gn.connect(arpDelay);
  os.start(t);
  os.stop(t + dur + 0.05);
}
export function nz(t, dur, g, type, f, q?) { const n = noiseSrc(); const fl = AC.createBiquadFilter(); fl.type = type; fl.frequency.value = f; fl.Q.value = q || 0.8; const gn = AC.createGain(); env(gn, t, g, dur); n.connect(fl); fl.connect(gn); gn.connect(musG); n.start(t, Math.random() * 1.5); n.stop(t + dur + 0.05); }
export let lastKickT = -1, lastClapT = -1;
export function kick(t, g?) { if (Math.abs(t - lastKickT) < 0.01)
  return; lastKickT = t; const o = AC.createOscillator(); o.frequency.setValueAtTime(150, t); o.frequency.exponentialRampToValueAtTime(45, t + 0.12); const gn = AC.createGain(); env(gn, t, g || 0.9, 0.28); o.connect(gn); gn.connect(musG); o.start(t); o.stop(t + 0.3); }
export const clap = (t, g?) => { if (Math.abs(t - lastClapT) < 0.01)
  return; lastClapT = t; nz(t, 0.16, g || 0.5, 'bandpass', 1700, 0.8); }, hat = (t, open, g?) => nz(t, open ? 0.12 : 0.035, (g || 1) * (open ? 0.16 : 0.06), 'highpass', 7500);
export const THEMES: Record<string, Theme> = {
  // Riverside: original 132 BPM electro
  electro: { bpm: 132, play(s, t) {
      const CH = [[57, 60, 64], [53, 57, 60], [48, 52, 55], [55, 59, 62]], AR = [0, 1, 2, 1, 0, 2, 1, 2, 0, 1, 2, 1, 2, 1, 0, 2];
      const beat = s % 16, bar = Math.floor(s / 16), ch = CH[bar % 4], sec = Math.floor(bar / 8) % 4;
      if (beat % 4 === 0 && !(sec === 3 && bar % 8 >= 6))
        kick(t);
      if (beat === 4 || beat === 12)
        clap(t);
      hat(t, beat % 4 === 2);
      if (beat % 4 !== 0)
        tone('sawtooth', mf(ch[0] - 24 + (beat % 8 === 6 ? 12 : 0)), t, 0.15, 0.3, { lp: 1400, lpEnd: 220, q: 6 });
      if (sec > 0)
        tone('square', mf(ch[AR[beat]] + (sec === 2 ? 24 : 12)), t, 0.12, 0.07, { lp: 2600, echo: true });
      if (beat === 0)
        for (const m of ch)
          tone('sawtooth', mf(m), t, 60 / 132 * 4, 0.035, { lp: 900, pad: true, att: 0.25, det: (Math.random() - 0.5) * 16 });
    } },
  // Lone Star: electro-country — train beat, banjo rolls, boom-chicka bass, slide-guitar lead (G major, I-IV-V)
  country: { bpm: 118, swing: 0.16, play(s, t) {
      const CH = [[55, 59, 62], [55, 59, 62], [60, 64, 67], [62, 66, 69]], beat = s % 16, bar = Math.floor(s / 16), ch = CH[bar % 4], sec = Math.floor(bar / 8) % 4;
      if (beat % 4 === 0)
        kick(t, 0.8);
      if (beat === 4 || beat === 12)
        clap(t, 0.45);
      if (beat % 2 === 1)
        nz(t, 0.05, 0.09, 'bandpass', 4200, 1.2); // brushed train-beat snare ghosts
      if (beat % 4 === 2)
        hat(t, false, 1.6);
      if (beat % 8 === 0)
        tone('triangle', mf(ch[0] - 24), t, 0.22, 0.42, { lp: 900 }); // boom
      if (beat % 8 === 4)
        tone('triangle', mf(ch[2] - 24), t, 0.22, 0.36, { lp: 900 }); // ...chicka (fifth)
      if (beat % 4 === 2)
        tone('square', mf(ch[0]), t, 0.08, 0.05, { lp: 1800 }); // guitar chop
      const roll = [0, 1, 2, 1, 2, 0, 1, 2, 0, 2, 1, 2, 0, 1, 2, 1]; // banjo forward roll
      if (sec !== 1)
        tone('triangle', mf(ch[roll[beat]] + 12), t, 0.16, 0.09, { lp: 5000, echo: beat % 3 === 0 });
      if (sec >= 1) {
        const MEL = [[74, 0, 76, 0, 79, 0, 76, 74, 71, 0, 74, 0, 0, 0, 0, 0], [72, 0, 74, 76, 79, 0, 81, 0, 79, 76, 74, 0, 0, 0, 0, 0], [74, 0, 79, 0, 81, 0, 83, 81, 79, 0, 76, 0, 74, 0, 0, 0], [78, 0, 76, 0, 74, 0, 71, 0, 74, 0, 0, 0, 0, 0, 0, 0]];
        const n = MEL[bar % 4][beat];
        if (n)
          tone('sine', mf(n - 2), t, 0.42, 0.07, { slide: mf(n), slideT: 0.09, vib: 5.5, lp: 2400, echo: true });
      }
      if (beat === 0)
        for (const m of ch)
          tone('sawtooth', mf(m - 12), t, 60 / curTheme().bpm * 4, 0.02, { lp: 700, pad: true, att: 0.4 });
    } },
  // Paulista: samba / bossa groove — surdo, tamborim, shaker, agogô, syncopated Rhodes on ii-V-I-VI
  samba: { bpm: 100, play(s, t) {
      const CH = [[62, 65, 69, 72], [67, 71, 74, 77], [60, 64, 67, 71], [57, 61, 64, 67]], beat = s % 16, bar = Math.floor(s / 16), ch = CH[bar % 4], sec = Math.floor(bar / 8) % 4;
      if (beat === 0)
        tone('sine', 62, t, 0.25, 0.55, { slide: 48 });
      if (beat === 8)
        tone('sine', 70, t, 0.35, 0.85, { slide: 50 }); // surdo: light on 1, heavy on 2
      if (beat === 4 || beat === 12)
        tone('sine', 66, t, 0.15, 0.25, { slide: 52 });
      nz(t, 0.04, beat % 2 ? 0.05 : 0.08, 'highpass', 6000); // shaker 16ths
      const TAM = [1, 0, 1, 1, 0, 1, 0, 1, 1, 0, 1, 1, 0, 1, 0, 1];
      if (TAM[beat] && sec > 0)
        nz(t, 0.05, 0.12, 'bandpass', 3200, 4); // tamborim
      const AG = [1, 0, 0, 1, 0, 0, 1, 0, 0, 0, 1, 0, 1, 0, 0, 0];
      if (AG[beat] && sec >= 2)
        tone('square', beat % 6 === 0 ? 1180 : 880, t, 0.09, 0.035, { lp: 3000 }); // agogô
      const BS = [1, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0];
      if (BS[beat])
        tone('triangle', mf(ch[0] - 24 + (beat === 3 || beat === 11 ? 7 : beat === 14 ? 12 : 0)), t, 0.2, 0.4, { lp: 700 });
      const RH = [1, 0, 0, 1, 0, 0, 1, 0, 0, 0, 1, 0, 1, 0, 0, 0];
      if (RH[beat])
        for (const m of ch) {
          tone('sine', mf(m), t, 0.32, 0.035, { echo: true });
          tone('triangle', mf(m + 12), t, 0.12, 0.012);
        }
      if (sec === 3 || sec === 1) {
        const MEL = [81, 0, 79, 0, 77, 0, 76, 0, 74, 0, 76, 77, 0, 0, 0, 0];
        const n = MEL[beat];
        if (n && bar % 2 === 0)
          tone('triangle', mf(n - (bar % 4)), t, 0.28, 0.06, { lp: 3000, vib: 6, echo: true });
      }
      if (beat % 4 === 0 && sec >= 1)
        kick(t, 0.35);
    } },
  // Monte Porto: baroque meets electro — harpsichord alberti over a circle-of-fifths, strings pad, pizzicato bass
  baroque: { bpm: 124, play(s, t) {
      const CH = [[57, 60, 64], [50, 53, 57], [55, 59, 62], [48, 52, 55], [53, 57, 60], [47, 50, 53], [52, 56, 59], [57, 60, 64]], beat = s % 16, bar = Math.floor(s / 16), ch = CH[bar % 8], sec = Math.floor(bar / 8) % 4;
      const AL = [0, 2, 1, 2, 0, 2, 1, 2, 0, 2, 1, 2, 0, 2, 1, 2];
      const n = ch[AL[beat]] + 12 + (beat >= 8 ? 12 : 0);
      tone('sawtooth', mf(n), t, 0.14, 0.05, { lp: 4200, lpEnd: 900 });
      tone('square', mf(n + 12), t, 0.06, 0.012, { lp: 6000 }); // harpsichord pluck
      if (beat % 4 === 0)
        tone('triangle', mf(ch[0] - 12), t, 0.18, 0.32, { lp: 1200 });
      if (beat % 4 === 2)
        tone('triangle', mf(ch[2] - 12), t, 0.14, 0.18, { lp: 1200 }); // pizzicato bass
      if (beat === 0)
        for (const m of ch) {
          tone('sawtooth', mf(m), t, 60 / curTheme().bpm * 4, 0.028, { lp: 1600, pad: true, att: 0.5, det: -8 });
          tone('sawtooth', mf(m + 12), t, 60 / curTheme().bpm * 4, 0.018, { lp: 2000, pad: true, att: 0.6, det: 9 });
        }
      if (sec >= 1) {
        if (beat % 4 === 0)
          kick(t, 0.75);
        if (beat === 4 || beat === 12)
          clap(t, 0.4);
        hat(t, beat % 4 === 2, 0.8);
      }
      if (sec >= 2) {
        const MEL = [[76, 0, 0, 0, 74, 0, 72, 0, 71, 0, 0, 0, 72, 0, 74, 0], [77, 0, 0, 0, 76, 0, 74, 0, 72, 0, 0, 0, 71, 0, 69, 0]];
        const m = MEL[bar % 2][beat];
        if (m)
          tone('square', mf(m + (sec === 3 ? 12 : 0)), t, 0.3, 0.045, { lp: 2500, vib: 5, echo: true });
      }
    } }
};
// Lone Star: spaghetti-western score (original tune) — galloping rhythm, twangy reverb guitar, a lone
// whistler, wordless choir, a mariachi-style trumpet answer, whip cracks and an anvil, in A minor.
export function choir(m, t, dur, g) {
  const os = AC.createOscillator();
  os.type = 'sawtooth';
  os.frequency.value = mf(m);
  os.detune.value = (Math.random() - 0.5) * 14;
  const v = AC.createOscillator();
  v.frequency.value = 5;
  const vg = AC.createGain();
  vg.gain.value = mf(m) * 0.008;
  v.connect(vg);
  vg.connect(os.frequency);
  const out = AC.createGain();
  out.gain.setValueAtTime(0.0001, t);
  out.gain.linearRampToValueAtTime(g, t + 0.35);
  out.gain.setValueAtTime(g, t + dur - 0.3);
  out.gain.linearRampToValueAtTime(0.0001, t + dur);
  for (const [f, q, a] of [[800, 6, 1], [1150, 8, 0.6], [2900, 10, 0.15]]) {
    const bp = AC.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = f;
    bp.Q.value = q;
    const ga = AC.createGain();
    ga.gain.value = a;
    os.connect(bp);
    bp.connect(ga);
    ga.connect(out);
  }
  out.connect(musG);
  out.connect(arpDelay);
  os.start(t);
  v.start(t);
  os.stop(t + dur + 0.05);
  v.stop(t + dur + 0.05);
}
export function twang(m, t, dur, g) {
  const os = AC.createOscillator();
  os.type = 'sawtooth';
  os.frequency.setValueAtTime(mf(m) * 1.01, t);
  os.frequency.exponentialRampToValueAtTime(mf(m), t + 0.04);
  const lp = AC.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.setValueAtTime(3200, t);
  lp.frequency.exponentialRampToValueAtTime(700, t + dur);
  lp.Q.value = 4;
  const trem = AC.createOscillator();
  trem.frequency.value = 7;
  const tg = AC.createGain();
  tg.gain.value = 0.35;
  const amp = AC.createGain();
  amp.gain.value = 0.65;
  trem.connect(tg);
  tg.connect(amp.gain);
  const e = AC.createGain();
  env(e, t, g, dur, 0.004);
  os.connect(lp);
  lp.connect(amp);
  amp.connect(e);
  e.connect(musG);
  e.connect(arpDelay);
  os.start(t);
  trem.start(t);
  os.stop(t + dur + 0.05);
  trem.stop(t + dur + 0.05);
}
export function trumpet(m, t, dur, g) {
  const os = AC.createOscillator();
  os.type = 'sawtooth';
  os.frequency.setValueAtTime(mf(m) * 0.97, t);
  os.frequency.linearRampToValueAtTime(mf(m), t + 0.06);
  const v = AC.createOscillator();
  v.frequency.value = 5.5;
  const vg = AC.createGain();
  vg.gain.setValueAtTime(0, t);
  vg.gain.linearRampToValueAtTime(mf(m) * 0.012, t + dur * 0.6);
  v.connect(vg);
  vg.connect(os.frequency);
  const lp = AC.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.setValueAtTime(500, t);
  lp.frequency.linearRampToValueAtTime(2600, t + 0.08);
  lp.frequency.linearRampToValueAtTime(1500, t + dur);
  const e = AC.createGain();
  e.gain.setValueAtTime(0.0001, t);
  e.gain.linearRampToValueAtTime(g, t + 0.05);
  e.gain.setValueAtTime(g * 0.85, t + dur - 0.1);
  e.gain.linearRampToValueAtTime(0.0001, t + dur);
  os.connect(lp);
  lp.connect(e);
  e.connect(musG);
  e.connect(arpDelay);
  os.start(t);
  v.start(t);
  os.stop(t + dur + 0.05);
  v.stop(t + dur + 0.05);
}
export function whip(t) { nz(t, 0.05, 0.5, 'highpass', 2500); nz(t + 0.012, 0.12, 0.25, 'bandpass', 1800, 2); }
export function anvil(t, g?) { tone('triangle', 1420, t, 0.6, g || 0.09); tone('sine', 2230, t, 0.45, (g || 0.09) * 0.6); tone('sine', 3610, t, 0.3, (g || 0.09) * 0.3); }
// Racing drive layer (modelled on the Ardennes new-beat groove): four-on-the-floor kick from the first bar,
// backbeat clap, offbeat hats and a pulsing 16th-note acid bass in each theme's key, plus a faster tempo.
// Each circuit keeps its own instruments and melodies on top. Ardennes (newbeat) already has this.
export function drive(s, t, len, root, o) {
  const beat = s % len, bar = Math.floor(s / len);
  o = o || {};
  if (beat % 4 === 0)
    kick(t, o.kick || 0.85);
  if (len === 16 ? (beat === 4 || beat === 12) : (beat === 4 || beat === 8))
    clap(t, o.clap || 0.4);
  if (beat % 4 === 2)
    hat(t, true, 0.7);
  else if (beat % 2 === 1)
    hat(t, false, 0.6);
  const PAT = [0, 0, 12, 0, 0, 12, 0, 7, 0, 0, 12, 0, 0, 12, 10, 0], sw = 0.5 + 0.5 * Math.sin(bar * 0.7 + beat * 0.3);
  tone('sawtooth', mf(root + PAT[beat % 16]), t, 0.14, o.bass || 0.15, { lp: 420 + 1300 * sw, lpEnd: 170, q: 9 });
}
export const nr = m => 43 + (((m - 43) % 12) + 12) % 12;
// fold a note into the bass register (G2..F#3)
export const DRIVE = {
  country: { bpm: 130, root: b => [43, 43, 48, 50][b % 4] },
  samba: { bpm: 114, root: b => nr([62, 67, 60, 57][b % 4]), o: { bass: 0.12 } },
  baroque: { bpm: 132, root: b => nr([57, 50, 55, 48, 53, 47, 52, 57][b % 8]) },
  arabic: { bpm: 128, root: b => [50, 50, 51, 46][b % 4] },
  western: { bpm: 136, root: b => [45, 50, 45, 52][b % 4] },
  mariachi: { bpm: 168, len: 12, root: b => nr([55, 55, 50, 50, 55, 60, 50, 55][b % 8]), o: { bass: 0.12 } },
  japan: { bpm: 130, root: b => [50, 50, 48, 43][b % 4] },
  marina: { bpm: 132, root: b => [48, 48, 51, 46][b % 4] }
};
export function init(): void {
  // Desert Lights: maqsum darbuka groove, oud and ney in the Hijaz mode over a drone, with an electronic kick
  THEMES.arabic = { bpm: 116, play(s, t) {
      const beat = s % 16, bar = Math.floor(s / 16), sec = Math.floor(bar / 8) % 4;
      const DOUM = [1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0], TEK = [0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 0, 0, 1, 0, 0, 0];
      if (DOUM[beat])
        tone('sine', 95, t, 0.3, 0.7, { slide: 55 });
      if (TEK[beat])
        nz(t, 0.06, 0.28, 'bandpass', 3600, 3);
      else if (beat % 2 === 1)
        nz(t, 0.03, 0.07, 'bandpass', 5200, 4);
      if (sec >= 1 && beat % 4 === 0)
        kick(t, 0.6);
      if (sec >= 2)
        hat(t, beat % 4 === 2, 0.7);
      if (beat === 0)
        for (const m of [38, 45, 50])
          tone('sawtooth', mf(m), t, 60 / curTheme().bpm * 4, 0.03, { lp: 500, pad: true, att: 0.6 });
      const MEL = [[74, 0, 75, 0, 78, 0, 79, 78, 75, 0, 74, 0, 0, 0, 0, 0], [79, 0, 81, 0, 82, 81, 79, 0, 78, 0, 79, 0, 0, 0, 0, 0], [81, 0, 0, 82, 81, 79, 78, 0, 79, 0, 78, 75, 74, 0, 0, 0], [70, 0, 72, 0, 74, 0, 75, 0, 74, 0, 0, 0, 0, 0, 0, 0]];
      const n = MEL[bar % 4][beat];
      if (n) {
        tone('triangle', mf(n - 12), t, 0.35, 0.11, { lp: 2600, lpEnd: 500, slide: mf(n - 12) * 0.985, slideT: 0.3 });
        tone('sawtooth', mf(n - 12), t, 0.09, 0.03, { lp: 3000 });
        if (sec >= 2)
          tone('sine', mf(n), t, 0.45, 0.05, { vib: 5.5, att: 0.06, echo: true });
      }
      if (sec === 0 && beat % 4 === 2)
        tone('triangle', mf([62, 63, 66, 67][bar % 4]), t, 0.12, 0.05, { lp: 2400 });
    } };
  THEMES.western = { bpm: 126, play(s, t) {
      const beat = s % 16, bar = Math.floor(s / 16), sec = Math.floor(bar / 8) % 4, step = 60 / curTheme().bpm / 4;
      const ROOT = [45, 50, 45, 52][bar % 4]; // Am  Dm  Am  E
      const CH = [[57, 60, 64], [50, 53, 57], [57, 60, 64], [52, 56, 59]][bar % 4];
      // gallop: da-da-DUM on a low tom and a picked bass
      const GAL = [1, 0, 1, 1, 1, 0, 1, 1, 1, 0, 1, 1, 1, 0, 1, 1];
      if (GAL[beat]) {
        tone('sine', beat % 4 === 0 ? 120 : 95, t, 0.16, beat % 4 === 0 ? 0.5 : 0.25, { slide: 55 });
        if (beat % 4 === 0)
          tone('triangle', mf(ROOT - 12), t, 0.25, 0.32, { lp: 900 });
      }
      nz(t, 0.03, beat % 2 ? 0.035 : 0.06, 'bandpass', 6500, 3); // clip-clop shaker
      // twang guitar ostinato (low, reverb-drenched)
      const OST = [0, 0, 0, 0, 7, 0, 0, 0, 12, 0, 0, 0, 7, 0, 10, 0];
      if (OST[beat] || beat === 0)
        twang(ROOT + 12 + OST[beat], t, 0.5, 0.14);
      if (bar % 4 === 0 && beat === 0)
        whip(t);
      if (bar % 8 === 7 && beat === 12)
        anvil(t);
      // lone whistler with the tune
      const MEL = [[69, 0, 0, 0, 76, 0, 0, 0, 81, 0, 79, 0, 76, 0, 0, 0], [74, 0, 0, 0, 72, 0, 71, 0, 69, 0, 0, 0, 0, 0, 0, 0], [69, 0, 72, 0, 76, 0, 0, 0, 77, 0, 76, 0, 74, 0, 72, 0], [71, 0, 0, 0, 68, 0, 0, 0, 69, 0, 0, 0, 0, 0, 0, 0]];
      const DUR = [[4, 0, 0, 0, 4, 0, 0, 0, 2, 0, 2, 0, 4, 0, 0, 0], [4, 0, 0, 0, 2, 0, 2, 0, 8, 0, 0, 0, 0, 0, 0, 0], [2, 0, 2, 0, 4, 0, 0, 0, 2, 0, 2, 0, 2, 0, 2, 0], [4, 0, 0, 0, 4, 0, 0, 0, 8, 0, 0, 0, 0, 0, 0, 0]];
      const n = MEL[bar % 4][beat], d = DUR[bar % 4][beat] * step;
      if (n && sec !== 2)
        tone('sine', mf(n + 12), t, d * 0.95, 0.095, { slide: mf(n + 12) * 1.004, slideT: 0.05, vib: 6, att: 0.04, echo: true });
      if (n && sec === 2)
        trumpet(n, t, d * 0.95, 0.09);
      // wordless choir swells, then the trumpet answers
      if (sec >= 1 && beat === 0)
        for (const m of CH)
          choir(m, t, step * 16, 0.022);
      if (sec === 3 && bar % 2 === 1 && [0, 2, 4, 6].includes(beat))
        trumpet([76, 74, 72, 71][beat / 2], t, step * 1.8, 0.05);
      if (sec === 3 && beat % 4 === 0)
        kick(t, 0.55);
    } };
  // Autódromo Azteca: mariachi ranchera in 3/4 — guitarrón, vihuela strums, violins and a trumpet pair in thirds (original tune)
  THEMES.mariachi = { bpm: 150, play(s, t) {
      const st = 60 / curTheme().bpm / 4, beat = s % 12, bar = Math.floor(s / 12), sec = Math.floor(bar / 8) % 4;
      const PROG = [[55, 59, 62], [55, 59, 62], [50, 54, 57, 60], [50, 54, 57, 60], [55, 59, 62], [60, 64, 67], [50, 54, 57, 60], [55, 59, 62]], ch = PROG[bar % 8];
      if (beat === 0)
        tone('triangle', mf(ch[0] - 24), t, 0.32, 0.5, { lp: 700 }); // guitarrón on 1
      if (beat === 8 && bar % 2)
        tone('triangle', mf(ch[2] - 24), t, 0.18, 0.32, { lp: 700 });
      if (beat === 4 || beat === 8)
        for (const m of ch.slice(0, 3))
          tone('square', mf(m), t + (m - ch[0]) * 0.004, 0.09, 0.05, { lp: 2600 }); // vihuela strums (pah-pah)
      if (beat === 4 || beat === 8)
        nz(t, 0.05, 0.05, 'bandpass', 3000, 1.5);
      if (beat === 10)
        tone('triangle', mf(ch[1] + 12), t, 0.08, 0.03, { lp: 3000 });
      const MEL = [[74, 0, 0, 0, 76, 0, 74, 0, 71, 0, 74, 0], [79, 0, 0, 0, 0, 0, 78, 0, 76, 0, 0, 0], [78, 0, 0, 0, 76, 0, 74, 0, 72, 0, 0, 0], [74, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
        [74, 0, 0, 0, 76, 0, 79, 0, 76, 0, 74, 0], [76, 0, 0, 0, 72, 0, 0, 0, 76, 0, 79, 0], [78, 0, 76, 0, 74, 0, 72, 0, 69, 0, 72, 0], [71, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]];
      const n = MEL[bar % 8][beat];
      let d = 0;
      if (n) {
        d = st * 2;
        for (let k = beat + 1; k < 12 && !MEL[bar % 8][k]; k++)
          d += st;
      }
      if (n && sec !== 0) {
        trumpet(n, t, d * 0.92, 0.09);
        trumpet(n - (n % 12 === 2 || n % 12 === 7 ? 3 : 4), t, d * 0.92, 0.065);
      } // trumpet pair in thirds
      if (n && sec !== 2) {
        const o = { lp: 3200, vib: 5.8, att: 0.05, pad: true };
        tone('sawtooth', mf(n + 12), t, d * 0.95, 0.045, o);
        tone('sawtooth', mf(n + 12), t, d * 0.95, 0.035, { ...o, det: 12 });
      } // violins an octave up
      if (sec >= 2 && beat === 0 && bar % 2 === 0)
        for (const m of ch)
          tone('sawtooth', mf(m + 12), t, st * 24, 0.012, { lp: 2000, pad: true, att: 0.3, vib: 5 });
      if (sec === 3 && beat === 0)
        kick(t, 0.5);
    } };
  // Sakura Ring: koto, taiko and shakuhachi over a gentle electronic beat (in-sen scale on D)
  THEMES.japan = { bpm: 118, play(s, t) {
      const beat = s % 16, bar = Math.floor(s / 16), sec = Math.floor(bar / 8) % 4, st = 60 / curTheme().bpm / 4;
      const SC = [62, 63, 67, 69, 72, 74, 75, 79, 81, 84];
      const taiko = (tt, g) => { const o = AC.createOscillator(); o.frequency.setValueAtTime(95, tt); o.frequency.exponentialRampToValueAtTime(48, tt + 0.25); const gn = AC.createGain(); env(gn, tt, g, 0.45); o.connect(gn); gn.connect(musG); o.start(tt); o.stop(tt + 0.5); nz(tt, 0.08, g * 0.25, 'lowpass', 500); };
      if ([0, 6, 10].includes(beat))
        taiko(t, beat === 0 ? 0.8 : 0.5);
      if (sec >= 1 && bar % 2 === 1 && beat >= 12)
        taiko(t, 0.35);
      if (beat % 4 === 2)
        nz(t, 0.03, 0.07, 'bandpass', 2600, 4); // shime-daiko
      if (sec >= 2) {
        if (beat % 4 === 0)
          kick(t, 0.55);
        hat(t, beat % 4 === 2, 0.8);
      }
      const KO = [[0, 4, 2, 5, 4, 2, 1, 2], [0, 2, 4, 7, 5, 4, 2, 4], [1, 4, 3, 5, 4, 3, 1, 0], [0, 4, 2, 5, 6, 5, 4, 2]];
      if (beat % 2 === 0) {
        const n = SC[KO[bar % 4][beat / 2]];
        tone('triangle', mf(n), t, 0.35, 0.11, { slide: mf(n) * 0.995, slideT: 0.3, lp: 4200, echo: beat % 4 === 0 });
        tone('sine', mf(n + 12), t, 0.12, 0.03);
      }
      if (beat === 0 && bar % 2 === 0)
        tone('triangle', mf(50), t, st * 30, 0.12, { pad: true, att: 0.4, lp: 600 });
      if (sec === 1 || sec === 3) {
        const SH = [[74, 0, 0, 0, 0, 0, 0, 0, 72, 0, 0, 0, 69, 0, 0, 0], [67, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0], [69, 0, 0, 0, 72, 0, 0, 0, 74, 0, 0, 0, 75, 0, 0, 0], [74, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]];
        const n = SH[bar % 4][beat];
        if (n) {
          let d = st;
          for (let k = beat + 1; k < 16 && !SH[bar % 4][k]; k++)
            d += st;
          tone('sine', mf(n), t, d * 0.95, 0.08, { vib: 4.5, pad: true, att: 0.12, slide: mf(n), slideT: 0.1 });
          nz(t, Math.min(d, 0.6), 0.02, 'bandpass', mf(n) * 2, 2);
        }
      }
    } };
  // Ardennes Forest: Belgian new beat — slow, heavy EBM kick, acid bass line and dark stabs (A minor)
  THEMES.newbeat = { bpm: 112, play(s, t) {
      const beat = s % 16, bar = Math.floor(s / 16), sec = Math.floor(bar / 8) % 4;
      if (beat % 4 === 0)
        kick(t, 0.95);
      if (beat === 4 || beat === 12) {
        clap(t, 0.55);
        nz(t + 0.11, 0.12, 0.12, 'bandpass', 1500, 0.8);
      }
      if (beat % 2 === 1)
        hat(t, beat % 4 === 3, 0.7);
      const RT = [45, 45, 48, 43][bar % 4], AC1 = [0, 12, 0, 0, 12, 0, 15, 0, 0, 12, 0, 10, 0, 12, 7, 0];
      tone('sawtooth', mf(RT + AC1[beat]), t, 0.16, 0.2, { lp: 400 + (sec >= 1 ? 1600 * (0.5 + 0.5 * Math.sin(bar * 0.7 + beat * 0.3)) : 300), lpEnd: 180, q: 12 });
      if (sec >= 1 && (beat === 2 || beat === 10))
        for (const m of [RT + 24, RT + 27, RT + 31])
          tone('square', mf(m), t, 0.14, 0.035, { lp: 2200, echo: true });
      if (beat === 0)
        for (const m of [RT + 12, RT + 15, RT + 19])
          tone('sawtooth', mf(m), t, 60 / 112 * 4, 0.025, { lp: 700, pad: true, att: 0.4, det: (Math.random() - 0.5) * 20 });
      if (sec === 3 && beat % 2 === 0) {
        const L = [69, 72, 76, 72, 69, 67, 64, 67][beat / 2];
        tone('square', mf(L + 12), t, 0.1, 0.04, { lp: 3000, echo: true });
      }
    } };
  // Neon Strip: bright electro-house — four on the floor, pumping supersaw stabs, plucked arps and an offbeat bass (F minor)
  THEMES.vegas = { bpm: 126, play(s, t) {
      const beat = s % 16, bar = Math.floor(s / 16), sec = Math.floor(bar / 8) % 4;
      const CH = [[53, 56, 60], [49, 53, 56], [56, 60, 63], [51, 55, 58]][bar % 4];
      const brk = sec === 2 && bar % 8 < 4;
      if (beat % 4 === 0 && !brk)
        kick(t, 1);
      if ((beat === 4 || beat === 12) && !brk)
        clap(t, 0.5);
      if (beat % 4 === 2)
        hat(t, true, 0.9);
      else if (!brk)
        hat(t, false, 0.8);
      if (beat % 4 === 2 && !brk)
        tone('sawtooth', mf(CH[0] - 24), t, 0.18, 0.3, { lp: 900, lpEnd: 200, q: 4 });
      if (sec >= 1 && (beat % 4 === 2 || beat === 7 || beat === 15))
        for (const m of CH)
          for (const dd of [-14, 0, 14])
            tone('sawtooth', mf(m + 12), t, 0.16, 0.016, { lp: 3800, lpEnd: 900, det: dd });
      const AR = [0, 1, 2, 1, 0, 2, 1, 2, 0, 1, 2, 1, 0, 2, 1, 2];
      tone('square', mf(CH[AR[beat]] + 24), t, 0.08, brk ? 0.06 : 0.04, { lp: brk ? 1500 + bar % 4 * 800 : 4200, echo: true });
      if (beat === 0)
        for (const m of CH)
          tone('sawtooth', mf(m), t, 60 / 126 * 4, 0.03, { lp: 1100, pad: true, att: 0.2, det: (Math.random() - 0.5) * 18 });
      if (sec === 3) {
        const LD = [[72, 0, 75, 0, 77, 0, 75, 72, 0, 0, 68, 0, 70, 0, 0, 0], [68, 0, 72, 0, 73, 0, 72, 68, 0, 0, 65, 0, 68, 0, 0, 0]][bar % 2];
        const n = LD[beat];
        if (n)
          tone('sawtooth', mf(n), t, 0.22, 0.05, { lp: 3200, echo: true, vib: 5 });
      }
      if (brk && bar % 8 === 3 && beat >= 8)
        nz(t, 0.12, 0.03 + 0.01 * (beat - 8), 'highpass', 2000 + (beat - 8) * 900);
    } };
  // Marina Night: electronic with a Singapore mix — gongs and gamelan-style bells in a pentatonic scale, an erhu-like lead (C minor pentatonic)
  THEMES.marina = { bpm: 124, play(s, t) {
      const beat = s % 16, bar = Math.floor(s / 16), sec = Math.floor(bar / 8) % 4;
      const P = [60, 63, 65, 67, 70, 72, 75, 77, 79, 82];
      if (beat % 4 === 0)
        kick(t, 0.85);
      if (beat === 4 || beat === 12)
        clap(t, 0.4);
      hat(t, beat % 4 === 2, 0.75);
      if (beat === 0 && bar % 2 === 0) {
        const o = AC.createOscillator();
        o.type = 'sine';
        o.frequency.setValueAtTime(110, t);
        o.frequency.exponentialRampToValueAtTime(98, t + 2);
        const g = AC.createGain();
        env(g, t, 0.22, 2.4);
        o.connect(g);
        g.connect(musG);
        o.start(t);
        o.stop(t + 2.5);
        nz(t, 0.3, 0.05, 'bandpass', 600, 2);
      } // gong
      if (beat % 4 === 2)
        tone('sawtooth', mf([36, 36, 39, 34][bar % 4]), t, 0.18, 0.28, { lp: 800, lpEnd: 180, q: 5 });
      const BL = [[0, 2, 4, 2, 5, 4, 2, 1], [0, 3, 5, 4, 7, 5, 4, 2], [1, 2, 4, 5, 4, 2, 1, 0], [0, 2, 5, 7, 8, 7, 5, 4]][bar % 4];
      if (beat % 2 === 0) {
        const n = P[BL[beat / 2]] + 12;
        tone('sine', mf(n), t, 0.5, 0.06, { echo: beat % 4 === 0 });
        tone('sine', mf(n) * 2.76, t, 0.25, 0.015);
        tone('triangle', mf(n) * 5.4, t, 0.08, 0.008);
      } // bell partials
      if (beat === 0)
        for (const m of [48, 55, 60, 63])
          tone('sawtooth', mf(m), t, 60 / curTheme().bpm * 4, 0.02, { lp: 900, pad: true, att: 0.3, det: (Math.random() - 0.5) * 16 });
      if (sec >= 2) {
        const LD = [[72, 0, 0, 75, 0, 77, 0, 0, 79, 0, 77, 75, 72, 0, 0, 0], [75, 0, 77, 0, 79, 0, 82, 0, 79, 0, 0, 77, 75, 0, 0, 0]][bar % 2];
        const n = LD[beat];
        if (n) {
          let d = 60 / curTheme().bpm / 4;
          for (let k = beat + 1; k < 16 && !LD[k]; k++)
            d += 60 / curTheme().bpm / 4;
          tone('sawtooth', mf(n) * 0.97, t, d * 0.95, 0.04, { slide: mf(n), slideT: 0.08, vib: 6, lp: 2600, pad: true, att: 0.04 });
        }
      }
    } };
  for (const k in DRIVE) {
    const th = THEMES[k], d = DRIVE[k], play = th.play, len = d.len || 16;
    th.bpm = d.bpm;
    th.play = (s, t) => { drive(s, t, len, d.root(Math.floor(s / len)), d.o); play(s, t); };
  }
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
