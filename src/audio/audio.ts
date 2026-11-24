import { GS } from '../state';
import { buildCrowd } from './crowd';
import { scheduleMusic } from './music';
import { $, clamp, store } from '../core/dom';
import { cars, opts } from '../game/race';
// ================= Audio =================
// Everything is synthesised with WebAudio: engines, impacts, surface rumble, crowd and a procedural electro track.
export let ragn,
  wgn,
  AC = null,
  master,
  sfxG,
  musG,
  noiseBuf,
  o1,
  o2,
  gn,
  flt,
  e1,
  e2,
  eflt,
  egn,
  rgn,
  rflt,
  cgn,
  cgn2,
  arpDelay;
export let lastCrash = 0;
GS.musStep = 0;
GS.musNext = 0;
GS.cheerT = 0;
// --- unlocking: iOS keeps Web Audio muted (ringer switch) unless a media element is playing, and
// browsers may leave the context suspended; every user gesture retries until it is running.
export let silentEl = null;
export function makeSilentWav() {
  const sr = 8000,
    n = sr / 2,
    buf = new ArrayBuffer(44 + n * 2),
    v = new DataView(buf);
  const w = (o, str) => {
    for (let i = 0; i < str.length; i++) v.setUint8(o + i, str.charCodeAt(i));
  };
  w(0, 'RIFF');
  v.setUint32(4, 36 + n * 2, true);
  w(8, 'WAVE');
  w(12, 'fmt ');
  v.setUint32(16, 16, true);
  v.setUint16(20, 1, true);
  v.setUint16(22, 1, true);
  v.setUint32(24, sr, true);
  v.setUint32(28, sr * 2, true);
  v.setUint16(32, 2, true);
  v.setUint16(34, 16, true);
  w(36, 'data');
  v.setUint32(40, n * 2, true);
  return URL.createObjectURL(new Blob([buf], { type: 'audio/wav' }));
}
export function unlockAudio() {
  try {
    if (navigator.audioSession) navigator.audioSession.type = 'playback';
  } catch (e) {}
  try {
    if (!silentEl) {
      silentEl = document.createElement('audio');
      silentEl.src = makeSilentWav();
      silentEl.loop = true;
      silentEl.setAttribute('playsinline', '');
      silentEl.setAttribute('x-webkit-playsinline', '');
      document.body.appendChild(silentEl);
    }
    const p = silentEl.play();
    if (p && p.catch) p.catch(() => {});
  } catch (e) {}
  initAudio();
  if (!AC) return;
  try {
    if (AC.state !== 'running') {
      const p = AC.resume();
      if (p && p.then) p.then(audioStatus, audioStatus);
    }
    const b = AC.createBuffer(1, 1, 22050),
      src = AC.createBufferSource();
    src.buffer = b;
    src.connect(AC.destination);
    src.start(0);
  } catch (e) {}
  setTimeout(audioStatus, 300);
}
export function audioStatus() {
  const el = $('bAudio');
  if (!el) return;
  const bad = (opts.sound || opts.music) && GS.state !== 'menu' && (!AC || AC.state !== 'running');
  el.classList.toggle('hide', !bad);
}
export function noiseSrc(loop?) {
  const s = AC.createBufferSource();
  s.buffer = noiseBuf;
  s.loop = !!loop;
  return s;
}
export function initAudio() {
  if (AC) return;
  try {
    AC = new (window.AudioContext || window.webkitAudioContext)();
    const comp = AC.createDynamicsCompressor();
    comp.threshold.value = -14;
    comp.ratio.value = 4;
    comp.connect(AC.destination);
    master = AC.createGain();
    master.gain.value = 0.9;
    master.connect(comp);
    sfxG = AC.createGain();
    sfxG.gain.value = opts.sound ? 1 : 0;
    sfxG.connect(master);
    musG = AC.createGain();
    musG.gain.value = opts.music ? 0.32 : 0;
    musG.connect(master);
    noiseBuf = AC.createBuffer(1, AC.sampleRate * 2, AC.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    // player engine
    o1 = AC.createOscillator();
    o1.type = 'sawtooth';
    o2 = AC.createOscillator();
    o2.type = 'square';
    flt = AC.createBiquadFilter();
    flt.type = 'lowpass';
    gn = AC.createGain();
    gn.gain.value = 0;
    o1.connect(flt);
    o2.connect(flt);
    flt.connect(gn);
    gn.connect(sfxG);
    o1.start();
    o2.start();
    // other cars (summed, follows nearest car, with doppler)
    e1 = AC.createOscillator();
    e1.type = 'sawtooth';
    e2 = AC.createOscillator();
    e2.type = 'sawtooth';
    e2.detune.value = 14;
    eflt = AC.createBiquadFilter();
    eflt.type = 'lowpass';
    eflt.frequency.value = 1100;
    egn = AC.createGain();
    egn.gain.value = 0;
    e1.connect(eflt);
    e2.connect(eflt);
    eflt.connect(egn);
    egn.connect(sfxG);
    e1.start();
    e2.start();
    // surface rumble (kerb / grass / gravel)
    {
      const ws = noiseSrc(true);
      const wf = AC.createBiquadFilter();
      wf.type = 'bandpass';
      wf.frequency.value = 2600;
      wf.Q.value = 0.7;
      wgn = AC.createGain();
      wgn.gain.value = 0;
      ws.connect(wf);
      wf.connect(wgn);
      wgn.connect(sfxG);
      ws.start(0, 0.4);
    }
    const rs = noiseSrc(true);
    rflt = AC.createBiquadFilter();
    rflt.type = 'bandpass';
    rflt.Q.value = 1.2;
    rgn = AC.createGain();
    rgn.gain.value = 0;
    rs.connect(rflt);
    rflt.connect(rgn);
    rgn.connect(sfxG);
    rs.start();
    // crowd: synthesised voice loop (built offline in buildCrowd) through one gain
    cgn = AC.createGain();
    cgn.gain.value = 0;
    cgn.connect(sfxG);
    cgn2 = AC.createGain();
    setTimeout(buildCrowd, 50);
    {
      const rs2 = noiseSrc(true);
      const hp = AC.createBiquadFilter();
      hp.type = 'highpass';
      hp.frequency.value = 500;
      const lp = AC.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.value = 5000;
      ragn = AC.createGain();
      ragn.gain.value = 0;
      rs2.connect(hp);
      hp.connect(lp);
      lp.connect(ragn);
      ragn.connect(sfxG);
      rs2.start(0, 0.9);
    }
    // music bus: arp echo
    arpDelay = AC.createDelay(1);
    arpDelay.delayTime.value = (60 / 132) * 0.75;
    const fb = AC.createGain();
    fb.gain.value = 0.33;
    const dw = AC.createGain();
    dw.gain.value = 0.45;
    arpDelay.connect(fb);
    fb.connect(arpDelay);
    arpDelay.connect(dw);
    dw.connect(musG);
    GS.musNext = AC.currentTime + 0.1;
    setInterval(scheduleMusic, 25);
    AC.onstatechange = audioStatus;
  } catch (e) {
    AC = null;
  }
}
export function setSfx(on) {
  opts.sound = on;
  store.set('sound', on);
  if (AC) sfxG.gain.setTargetAtTime(on ? 1 : 0, AC.currentTime, 0.05);
  $('bSnd').textContent = on ? '🔊' : '🔇';
}
export function setMusic(on) {
  opts.music = on;
  store.set('music', on);
  if (AC) musG.gain.setTargetAtTime(on ? 0.32 : 0, AC.currentTime, 0.1);
  $('bMus').textContent = on ? '🎵' : '🎵✕';
  $('bMus').style.opacity = on ? 1 : 0.6;
}
export const mf = m => 440 * Math.pow(2, (m - 69) / 12);
export function env(g, t, peak, dec, att?) {
  g.gain.setValueAtTime(0.0001, t);
  g.gain.linearRampToValueAtTime(peak, t + (att || 0.003));
  g.gain.exponentialRampToValueAtTime(0.0001, t + dec);
}
/**
 * Passing moments (sim/passing.ts): 'sling' a rising whoosh, 'dive' a short tyre chirp and low thump, 'pressure' a
 * long screech (the other car locking up), 'done' a bright two-note chime when the pass is made.
 */
export function passSnd(kind: string) {
  try {
    if (!AC || !sfxG || !opts.sound) return;
    const t = AC.currentTime;
    if (kind === 'done') {
      for (const [k, m] of [
        [0, 79],
        [0.09, 86],
      ]) {
        const o = AC.createOscillator();
        o.type = 'triangle';
        o.frequency.setValueAtTime(mf(m), t + k);
        const g = AC.createGain();
        env(g, t + k, 0.09, 0.35, 0.005);
        o.connect(g);
        g.connect(sfxG);
        o.start(t + k);
        o.stop(t + k + 0.4);
      }
      return;
    }
    const sling = kind === 'sling',
      dur = sling ? 0.9 : kind === 'pressure' ? 0.7 : 0.28;
    const n = noiseSrc();
    const f = AC.createBiquadFilter();
    f.type = 'bandpass';
    f.Q.value = sling ? 1.2 : 6;
    if (sling) {
      f.frequency.setValueAtTime(300, t);
      f.frequency.exponentialRampToValueAtTime(2600, t + 0.55);
      f.frequency.exponentialRampToValueAtTime(900, t + dur);
    } else {
      f.frequency.setValueAtTime(kind === 'pressure' ? 1500 : 2200, t);
      f.frequency.exponentialRampToValueAtTime(kind === 'pressure' ? 900 : 1600, t + dur);
    }
    const g = AC.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(sling ? 0.32 : 0.16, t + (sling ? 0.35 : 0.02));
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    n.connect(f);
    f.connect(g);
    g.connect(sfxG);
    n.start(t, Math.random() * 1.2);
    n.stop(t + dur + 0.05);
    if (kind === 'dive') {
      const o = AC.createOscillator();
      o.type = 'sine';
      o.frequency.setValueAtTime(90, t);
      o.frequency.exponentialRampToValueAtTime(45, t + 0.2);
      const g2 = AC.createGain();
      env(g2, t, 0.25, 0.22);
      o.connect(g2);
      g2.connect(sfxG);
      o.start(t);
      o.stop(t + 0.25);
    }
  } catch (e) {}
}
export function crashSnd(intensity, x, y) {
  if (!AC || !opts.sound) return;
  const c = cars[GS.ctrl];
  const dist = Math.hypot(x - c.x, y - c.y);
  const vol = clamp(intensity / 25, 0.15, 1) * clamp(1 - dist / 140, 0, 1);
  if (vol < 0.03 || AC.currentTime - lastCrash < 0.07) return;
  lastCrash = AC.currentTime;
  const t = AC.currentTime;
  const n = noiseSrc();
  const f = AC.createBiquadFilter();
  f.type = 'lowpass';
  f.frequency.setValueAtTime(3500, t);
  f.frequency.exponentialRampToValueAtTime(400, t + 0.3);
  const g = AC.createGain();
  env(g, t, 0.55 * vol, 0.35);
  n.connect(f);
  f.connect(g);
  g.connect(sfxG);
  n.start(t, Math.random() * 1.5);
  n.stop(t + 0.4);
  const o = AC.createOscillator();
  o.type = 'sine';
  o.frequency.setValueAtTime(110, t);
  o.frequency.exponentialRampToValueAtTime(38, t + 0.25);
  const g2 = AC.createGain();
  env(g2, t, 0.7 * vol, 0.3);
  o.connect(g2);
  g2.connect(sfxG);
  o.start(t);
  o.stop(t + 0.32);
  const m = AC.createOscillator();
  m.type = 'square';
  m.frequency.setValueAtTime(1300 + Math.random() * 900, t);
  const g3 = AC.createGain();
  env(g3, t, 0.05 * vol, 0.12);
  m.connect(g3);
  g3.connect(sfxG);
  m.start(t);
  m.stop(t + 0.14);
}
export function init(): void {
  // try to start the menu music straight away; browsers may still wait for the first tap/click/key
  setTimeout(() => {
    try {
      initAudio();
      if (AC && AC.state !== 'running') {
        const p = AC.resume();
        if (p && p.then) p.then(audioStatus, audioStatus);
      }
    } catch (e) {}
    audioStatus();
  }, 50);
  // no music or sound while the page is hidden (another tab or app, screen locked): suspend the audio
  // context and the silent keep-alive element, and pick up again when the page is visible
  const onVis = () => {
    if (document.hidden) {
      try {
        if (AC && AC.state === 'running') AC.suspend();
        if (silentEl) silentEl.pause();
      } catch (e) {}
    } else unlockAudio();
  };
  document.addEventListener('visibilitychange', onVis);
  addEventListener('pagehide', () => {
    try {
      if (AC) AC.suspend();
      if (silentEl) silentEl.pause();
    } catch (e) {}
  });
  ['pointerdown', 'touchend', 'keydown', 'click'].forEach(ev =>
    document.addEventListener(
      ev,
      () => {
        if (!document.hidden && (!AC || AC.state !== 'running' || (silentEl && silentEl.paused)))
          unlockAudio();
      },
      true,
    ),
  );
}
/** debug/test hook: reassign a module-level binding */
export function __set(name: string, v: any): void {
  switch (name) {
    case 'ragn':
      ragn = v;
      break;
    case 'wgn':
      wgn = v;
      break;
    case 'AC':
      AC = v;
      break;
    case 'master':
      master = v;
      break;
    case 'sfxG':
      sfxG = v;
      break;
    case 'musG':
      musG = v;
      break;
    case 'noiseBuf':
      noiseBuf = v;
      break;
    case 'o1':
      o1 = v;
      break;
    case 'o2':
      o2 = v;
      break;
    case 'gn':
      gn = v;
      break;
    case 'flt':
      flt = v;
      break;
    case 'e1':
      e1 = v;
      break;
    case 'e2':
      e2 = v;
      break;
    case 'eflt':
      eflt = v;
      break;
    case 'egn':
      egn = v;
      break;
    case 'rgn':
      rgn = v;
      break;
    case 'rflt':
      rflt = v;
      break;
    case 'cgn':
      cgn = v;
      break;
    case 'cgn2':
      cgn2 = v;
      break;
    case 'arpDelay':
      arpDelay = v;
      break;
    case 'lastCrash':
      lastCrash = v;
      break;
    case 'silentEl':
      silentEl = v;
      break;
  }
}
