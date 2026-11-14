import { GS } from '../state';
import { AC, cgn, noiseBuf, sfxG } from './audio';
import { opts } from '../game/race';
// ---------- crowd: breathy (noise-excited) voices in stereo with stadium reverb ----------
// A far-off crowd has no clear pitch: what you hear is many vowel-shaped breaths rising and falling,
// spread left/right, smeared by the stands. Rendered once, offline: a seamless murmur loop and a cheer.
export let crowdLoop = null,
  crowdCheer = null,
  crowdSrc = null,
  lastCheer = 0;
export const VOWELS = [
  [730, 1090],
  [570, 840],
  [300, 870],
  [270, 2290],
  [530, 1840],
  [660, 1720],
  [440, 1020],
  [390, 1990],
];
export function stadiumIR(oc, sec) {
  const sr = oc.sampleRate,
    n = Math.floor(sr * sec),
    b = oc.createBuffer(2, n, sr);
  for (let c = 0; c < 2; c++) {
    const d = b.getChannelData(c);
    for (let i = 0; i < n; i++) {
      const t = i / sr;
      d[i] = (Math.random() * 2 - 1) * Math.exp(-t * 3.2) * (t < 0.012 ? t / 0.012 : 1);
    }
  }
  return b;
}
export function breathVoice(oc, dest, t0, dur, o) {
  const src = oc.createBufferSource();
  src.buffer = noiseBuf;
  src.loop = true;
  const f1 = oc.createBiquadFilter(),
    f2 = oc.createBiquadFilter();
  f1.type = f2.type = 'bandpass';
  f1.Q.value = o.q;
  f2.Q.value = o.q * 1.3;
  const g = oc.createGain();
  g.gain.value = 0;
  const pan = oc.createStereoPanner();
  pan.pan.value = Math.random() * 1.8 - 0.9;
  src.connect(f1);
  src.connect(f2);
  f1.connect(g);
  f2.connect(g);
  g.connect(pan);
  pan.connect(dest);
  let t = t0;
  const V = o.vowels;
  while (t < t0 + dur) {
    const syl = o.syl[0] + Math.random() * (o.syl[1] - o.syl[0]);
    const v = V[Math.floor(Math.random() * V.length)];
    f1.frequency.setTargetAtTime(v[0] * (0.85 + Math.random() * 0.3), t, 0.04);
    f2.frequency.setTargetAtTime(v[1] * (0.85 + Math.random() * 0.3), t, 0.04);
    const a = o.amp * (o.env ? o.env((t - t0) / dur) : 1) * (0.35 + Math.random() * 0.65);
    g.gain.setTargetAtTime(a, t, 0.03);
    g.gain.setTargetAtTime(a * 0.3, t + syl * 0.55, 0.05);
    t += syl;
    if (o.gaps && Math.random() < 0.22) {
      g.gain.setTargetAtTime(0, t, 0.06);
      t += 0.2 + Math.random() * 0.7;
    }
  }
  g.gain.setTargetAtTime(0, t0 + dur, 0.08);
  src.start(t0, Math.random() * 1.8);
  src.stop(t0 + dur + 0.5);
}
export async function renderCrowd(dur, build, wet) {
  const sr = AC.sampleRate,
    oc = new OfflineAudioContext(2, Math.ceil(sr * dur), sr);
  const bus = oc.createGain();
  const hp = oc.createBiquadFilter();
  hp.type = 'highpass';
  hp.frequency.value = 160;
  const lp = oc.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.value = 4200;
  bus.connect(hp);
  hp.connect(lp);
  const dry = oc.createGain();
  dry.gain.value = 1 - wet * 0.5;
  lp.connect(dry);
  dry.connect(oc.destination);
  const cv = oc.createConvolver();
  cv.buffer = stadiumIR(oc, 1.6);
  const wg = oc.createGain();
  wg.gain.value = wet;
  lp.connect(cv);
  cv.connect(wg);
  wg.connect(oc.destination);
  build(oc, bus);
  const b = await oc.startRendering();
  let pk = 0;
  for (let c = 0; c < 2; c++) for (const v of b.getChannelData(c)) pk = Math.max(pk, Math.abs(v));
  for (let c = 0; c < 2; c++) {
    const d = b.getChannelData(c);
    for (let i = 0; i < d.length; i++) d[i] /= pk || 1;
  }
  return b;
}
// ---------- crowd styles (menu: Crowd) ----------
// 0 Stadium voices: breathy vowel-shaped voices in stereo with stadium reverb
// 1 Distant grandstand: a smooth far-off roar that swells and settles, cheer = a rising roar with applause
// 2 Air horns & applause: a light murmur, fans' air horns now and then, cheer = horns, whistles and applause
export const CROWD_NAMES = ['Stadium voices', 'Distant grandstand', 'Air horns & applause', 'Off'];
export const crowdBufs = {};
export function applause(oc, bus, t0, t1, count, amp) {
  for (let c = 0; c < count; c++) {
    const t = t0 + (t1 - t0) * Math.random() ** 0.6,
      s = oc.createBufferSource();
    s.buffer = noiseBuf;
    const f = oc.createBiquadFilter();
    f.type = 'bandpass';
    f.frequency.value = 1000 + Math.random() * 1800;
    f.Q.value = 1.2;
    const g = oc.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(amp * Math.random(), t + 0.002);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.025);
    const p = oc.createStereoPanner();
    p.pan.value = Math.random() * 1.8 - 0.9;
    s.connect(f);
    f.connect(g);
    g.connect(p);
    p.connect(bus);
    s.start(t, Math.random() * 1.5);
    s.stop(t + 0.04);
  }
}
export function whistles(oc, bus, n, t0, t1) {
  for (let w = 0; w < n; w++) {
    const t = t0 + Math.random() * (t1 - t0),
      os = oc.createOscillator();
    os.type = 'sine';
    const f = 2000 + Math.random() * 900;
    os.frequency.setValueAtTime(f * 0.85, t);
    os.frequency.linearRampToValueAtTime(f * 1.12, t + 0.3);
    os.frequency.linearRampToValueAtTime(f, t + 0.7);
    const g = oc.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(0.025, t + 0.06);
    g.gain.setValueAtTime(0.025, t + 0.6);
    g.gain.linearRampToValueAtTime(0, t + 0.75);
    const p = oc.createStereoPanner();
    p.pan.value = Math.random() * 1.6 - 0.8;
    os.connect(g);
    g.connect(p);
    p.connect(bus);
    os.start(t);
    os.stop(t + 0.8);
  }
}
// an air horn: a brassy chord through a horn-shaped band, with the pressure sag at the end
export function airHorn(ctx2, dest, t, dur, amp, pan) {
  const out = ctx2.createGain();
  out.gain.setValueAtTime(0.0001, t);
  out.gain.linearRampToValueAtTime(amp, t + 0.03);
  out.gain.setValueAtTime(amp, t + dur - 0.12);
  out.gain.linearRampToValueAtTime(0.0001, t + dur);
  const bp = ctx2.createBiquadFilter();
  bp.type = 'bandpass';
  bp.frequency.value = 1100;
  bp.Q.value = 0.7;
  const lp = ctx2.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.value = 3200;
  bp.connect(lp);
  lp.connect(out);
  const p = ctx2.createStereoPanner();
  p.pan.value = pan;
  out.connect(p);
  p.connect(dest);
  const base = [311, 392, 466][Math.floor(Math.random() * 3)];
  for (const r of [1, 1.26, 1.5]) {
    const o = ctx2.createOscillator();
    o.type = 'sawtooth';
    o.frequency.setValueAtTime(base * r, t);
    o.frequency.setValueAtTime(base * r, t + dur - 0.15);
    o.frequency.linearRampToValueAtTime(base * r * 0.94, t + dur);
    o.connect(bp);
    o.start(t);
    o.stop(t + dur + 0.05);
  }
}
export async function buildCrowdStyle(v) {
  if (crowdBufs[v]) return crowdBufs[v];
  const sr = AC.sampleRate,
    dur = 10,
    pre = 1.5;
  let loopRaw, cheerB;
  const swell = (oc, node, depth, rate?) => {
    const base = node.gain.value,
      n = 64,
      curve = new Float32Array(n);
    let x = 0;
    for (let i = 0; i < n; i++) {
      x = x * 0.85 + (Math.random() - 0.5) * 0.6;
      curve[i] = Math.max(0.2, 1 + depth * x) * base;
    }
    node.gain.setValueCurveAtTime(curve, 0, dur + pre + 1);
  };
  if (v === 0) {
    loopRaw = await renderCrowd(
      dur + pre + 1,
      (oc, bus) => {
        for (let i = 0; i < 46; i++)
          breathVoice(oc, bus, Math.random() * 0.4, dur + pre + 0.8, {
            vowels: VOWELS,
            syl: [0.12, 0.3],
            amp: 0.06,
            q: 5,
            gaps: true,
          });
      },
      0.45,
    );
    const env = x => (x < 0.1 ? x / 0.1 : x < 0.4 ? 1 : Math.max(0, 1 - (x - 0.4) / 0.6));
    cheerB = await renderCrowd(
      4,
      (oc, bus) => {
        for (let i = 0; i < 60; i++)
          breathVoice(oc, bus, Math.random() * 0.2, 3.4, {
            vowels: [
              [750, 1200],
              [700, 1150],
              [620, 1800],
              [760, 1320],
            ],
            syl: [0.4, 1.0],
            amp: 0.07,
            q: 3.5,
            env,
          });
        whistles(oc, bus, 4, 0.25, 1.5);
        applause(oc, bus, 0.25, 3.4, 320, 0.05);
      },
      0.5,
    );
  } else {
    loopRaw = await renderCrowd(
      dur + pre + 1,
      (oc, bus) => {
        for (const [f, q, a, pan] of [
          [450, 0.9, 0.5, -0.5],
          [800, 0.8, 0.6, 0.4],
          [1400, 1.0, 0.35, -0.2],
          [2300, 1.4, 0.15, 0.6],
        ]) {
          const s = oc.createBufferSource();
          s.buffer = noiseBuf;
          s.loop = true;
          const bp = oc.createBiquadFilter();
          bp.type = 'bandpass';
          bp.frequency.value = f;
          bp.Q.value = q;
          const g = oc.createGain();
          g.gain.value = a;
          swell(oc, g, v === 1 ? 0.5 : 0.35);
          const p = oc.createStereoPanner();
          p.pan.value = pan;
          s.connect(bp);
          bp.connect(g);
          g.connect(p);
          p.connect(bus);
          s.start(0, Math.random() * 1.5);
        }
        for (let i = 0; i < 18; i++)
          breathVoice(oc, bus, Math.random() * 0.4, dur + pre + 0.8, {
            vowels: VOWELS,
            syl: [0.15, 0.35],
            amp: 0.025,
            q: 4,
            gaps: true,
          });
        if (v === 2)
          for (let k = 0; k < 6; k++) {
            const t = 0.5 + Math.random() * (dur + pre - 1);
            applause(oc, bus, t, t + 1.2, 40, 0.03);
          }
      },
      v === 1 ? 0.65 : 0.5,
    );
    cheerB = await renderCrowd(
      4,
      (oc, bus) => {
        const roar = (f, q, a) => {
          const s = oc.createBufferSource();
          s.buffer = noiseBuf;
          s.loop = true;
          const bp = oc.createBiquadFilter();
          bp.type = 'bandpass';
          bp.frequency.value = f;
          bp.Q.value = q;
          const g = oc.createGain();
          g.gain.setValueAtTime(0.0001, 0);
          g.gain.linearRampToValueAtTime(a, 0.3);
          g.gain.setValueAtTime(a, 1.4);
          g.gain.linearRampToValueAtTime(0.0001, 3.8);
          bp.frequency.setValueAtTime(f * 0.85, 0);
          bp.frequency.linearRampToValueAtTime(f * 1.1, 0.4);
          s.connect(bp);
          bp.connect(g);
          g.connect(bus);
          s.start(0, Math.random());
        };
        if (v === 1) {
          roar(700, 0.8, 0.6);
          roar(1200, 1, 0.45);
          roar(2100, 1.4, 0.2);
          applause(oc, bus, 0.3, 3.6, 380, 0.045);
          whistles(oc, bus, 3, 0.3, 1.4);
        } else {
          roar(800, 0.9, 0.25);
          for (let k = 0; k < 4; k++)
            airHorn(
              oc,
              bus,
              0.05 + Math.random() * 1.4,
              0.7 + Math.random() * 0.7,
              0.09,
              Math.random() * 1.6 - 0.8,
            );
          whistles(oc, bus, 5, 0.2, 1.8);
          applause(oc, bus, 0.2, 3.6, 420, 0.05);
        }
      },
      0.4,
    );
  }
  const n = Math.floor(sr * dur),
    xf = Math.floor(sr * 0.8),
    off = Math.floor(sr * pre),
    loop = AC.createBuffer(2, n, sr);
  for (let c = 0; c < 2; c++) {
    const d = loopRaw.getChannelData(c),
      o = loop.getChannelData(c);
    for (let i = 0; i < n; i++) {
      let x = d[off + i];
      if (i < xf) {
        const k = i / xf;
        x = x * k + d[off + n + i] * (1 - k);
      }
      o[i] = x * (v === 2 ? 0.6 : 1);
    }
  }
  return (crowdBufs[v] = { loop, cheer: cheerB });
}
export const CROWD_ENABLED = false;
// crowd audio removed for now; the synth code is kept for a later attempt
export async function buildCrowd() {
  if (!AC || !CROWD_ENABLED) return;
  const v = opts.crowd | 0;
  if (crowdSrc) {
    try {
      crowdSrc.stop();
    } catch (e) {}
    crowdSrc = null;
  }
  crowdLoop = crowdCheer = null;
  if (v === 3) return;
  const b = await buildCrowdStyle(v);
  if ((opts.crowd | 0) !== v) return;
  crowdLoop = b.loop;
  crowdCheer = b.cheer;
  crowdSrc = AC.createBufferSource();
  crowdSrc.buffer = crowdLoop;
  crowdSrc.loop = true;
  crowdSrc.connect(cgn);
  crowdSrc.start();
}
export let hornT = 3;
export function crowdEvents(dt, near, live) {
  if (!CROWD_ENABLED || !AC || (opts.crowd | 0) !== 2 || !live || !opts.sound) return;
  hornT -= dt;
  if (hornT > 0) return;
  hornT = 1.5 + Math.random() * 4;
  if (Math.random() < 0.25 + 0.6 * near)
    airHorn(
      AC,
      sfxG,
      AC.currentTime + 0.02,
      0.5 + Math.random() * 0.9,
      0.025 + 0.05 * near,
      Math.random() * 1.6 - 0.8,
    );
}
export function cheer(amount) {
  GS.cheerT = Math.max(GS.cheerT, amount);
  if (!CROWD_ENABLED || !AC || !crowdCheer || !opts.sound) return;
  const t = AC.currentTime;
  if (t - lastCheer < 1.2) return;
  lastCheer = t;
  const s = AC.createBufferSource();
  s.buffer = crowdCheer;
  s.playbackRate.value = 0.95 + Math.random() * 0.1;
  const g = AC.createGain();
  g.gain.value = 0.1 + 0.28 * amount;
  s.connect(g);
  g.connect(sfxG);
  s.start(t);
}
/** debug/test hook: reassign a module-level binding */
export function __set(name: string, v: any): void {
  switch (name) {
    case 'crowdLoop':
      crowdLoop = v;
      break;
    case 'crowdCheer':
      crowdCheer = v;
      break;
    case 'crowdSrc':
      crowdSrc = v;
      break;
    case 'lastCheer':
      lastCheer = v;
      break;
    case 'hornT':
      hornT = v;
      break;
  }
}
