// The intro's own sounds: a tiny WebAudio synth. Only the output comes from the game (world.audio()), so the port
// to another main carries this file along as it is. Nothing here plays music: the game's own music starts at lights
// out (world.startMusic).
//   beep       the start light's beep, one per bulb
//   wind       dawn air under the grey world
//   roll       the one car's engine as it rolls through Turn 1
//   radio      the click of Gus's radio before he speaks
//   grid       ten engines on the grid: idle, revs rising, then cut dead for the silence before lights out
//   launch     lights out: a low thump and ten engines pulling away through the gears
//   whoosh     the title's arrival
import { audio } from './world';

/** engine pitch for a speed in m/s: a seven-speed box, 75 Hz at the bottom of a gear and 305 at the top */
const GEARS = [0, 24, 38, 51, 63, 74, 85, 100];
export function enginePitch(v: number): number {
  let g = 1;
  while (g < GEARS.length - 1 && v > GEARS[g]) g++;
  const lo = g > 1 ? GEARS[g - 1] * 0.92 : 0;
  return 75 + 230 * Math.min(1.05, Math.max(0, (v - lo) / (GEARS[g] - lo)));
}

export class Sound {
  private ctx: AudioContext | null = null;
  private bus: GainNode | null = null;
  private noiseBuf: AudioBuffer | null = null;
  muted = false;

  /** true once the game's audio context exists and runs */
  get running(): boolean {
    const a = audio().ctx;
    return !!a && a.state === 'running';
  }
  now(): number {
    return audio().ctx?.currentTime ?? 0;
  }
  /** a fresh output; whatever was scheduled on the old one is cut (a skip) */
  newBus(): void {
    const { ctx, out } = audio();
    if (!ctx || !out) return;
    this.ctx = ctx;
    const old = this.bus;
    if (old) {
      old.gain.cancelScheduledValues(ctx.currentTime);
      old.gain.setTargetAtTime(0, ctx.currentTime, 0.01);
      setTimeout(() => old.disconnect(), 300);
    }
    this.bus = ctx.createGain();
    this.bus.gain.value = this.muted ? 0 : 1;
    this.bus.connect(out);
    if (!this.noiseBuf) {
      this.noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
      const d = this.noiseBuf.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    }
  }
  /** fade everything out (the intro is over or stopped) */
  close(): void {
    const old = this.bus;
    if (!old || !this.ctx) return;
    old.gain.cancelScheduledValues(this.ctx.currentTime);
    old.gain.setTargetAtTime(0, this.ctx.currentTime, 0.08);
    setTimeout(() => old.disconnect(), 800);
    this.bus = null;
  }
  private ready() {
    return !!(this.ctx && this.bus);
  }
  private osc(type: OscillatorType, hz: number, at: number, end: number) {
    const o = this.ctx.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(hz, at);
    o.start(at);
    o.stop(end + 0.05);
    return o;
  }
  private gain(v = 0) {
    const g = this.ctx.createGain();
    g.gain.value = v;
    return g;
  }
  private filter(type: BiquadFilterType, hz: number, q = 0.7) {
    const f = this.ctx.createBiquadFilter();
    f.type = type;
    f.frequency.value = hz;
    f.Q.value = q;
    return f;
  }
  private noise(at: number, end: number) {
    const s = this.ctx.createBufferSource();
    s.buffer = this.noiseBuf;
    s.loop = true;
    s.start(at, Math.random());
    s.stop(end + 0.05);
    return s;
  }

  /** The start light's beep: a short clean tone with a little edge, the same for every bulb. */
  beep(at: number): void {
    if (!this.ready()) return;
    const g = this.gain(),
      f = this.filter('lowpass', 2600);
    g.gain.setValueAtTime(0, at);
    g.gain.linearRampToValueAtTime(0.2, at + 0.004);
    g.gain.setValueAtTime(0.2, at + 0.15);
    g.gain.linearRampToValueAtTime(0, at + 0.19);
    this.osc('sine', 988, at, at + 0.2).connect(g);
    const sq = this.osc('square', 988, at, at + 0.2),
      sg = this.gain(0.05);
    sq.connect(sg).connect(f).connect(g);
    g.connect(this.bus);
  }
  /** Dawn air: low, slowly breathing noise from `at` to `end`, cut on the cut. */
  wind(at: number, end: number): void {
    if (!this.ready() || end <= at) return;
    const f = this.filter('lowpass', 380, 0.5),
      g = this.gain();
    g.gain.setValueAtTime(0, at);
    g.gain.linearRampToValueAtTime(0.05, at + 1.2);
    for (let t = at + 1.2, k = 0; t < end - 0.05; t += 0.9, k++)
      g.gain.linearRampToValueAtTime(0.035 + 0.02 * Math.sin(k * 1.7), t);
    g.gain.setValueAtTime(g.gain.value, end - 0.02);
    g.gain.linearRampToValueAtTime(0, end);
    this.noise(at, end).connect(f).connect(g).connect(this.bus);
  }
  /**
   * One car's engine from `at` to `end`: speed(sec) is its speed in m/s and level(sec) how close the helicopter is
   * (0..1), both sampled a few times a second.
   */
  roll(at: number, end: number, speed: (sec: number) => number, level: (sec: number) => number): void {
    if (!this.ready() || end <= at) return;
    const o1 = this.osc('sawtooth', enginePitch(speed(0)), at, end),
      o2 = this.osc('sawtooth', enginePitch(speed(0)) * 0.502, at, end);
    o2.detune.value = 12;
    const f = this.filter('lowpass', 900, 1.2),
      g = this.gain();
    g.gain.setValueAtTime(0, at);
    for (let s = 0; at + s < end; s += 1 / 20) {
      const hz = enginePitch(speed(s));
      o1.frequency.linearRampToValueAtTime(hz, at + s);
      o2.frequency.linearRampToValueAtTime(hz * 0.502, at + s);
      f.frequency.linearRampToValueAtTime(500 + hz * 5, at + s);
      g.gain.linearRampToValueAtTime(0.11 * level(s), at + s);
    }
    g.gain.linearRampToValueAtTime(0, end);
    o1.connect(f);
    o2.connect(f);
    f.connect(g).connect(this.bus);
  }
  /** The click of a radio opening, before a line. */
  radio(at: number): void {
    if (!this.ready()) return;
    const f = this.filter('bandpass', 2400, 1.4),
      g = this.gain();
    g.gain.setValueAtTime(0, at);
    g.gain.linearRampToValueAtTime(0.12, at + 0.003);
    g.gain.exponentialRampToValueAtTime(0.001, at + 0.07);
    this.noise(at, at + 0.08).connect(f).connect(g).connect(this.bus);
    const t = this.gain();
    t.gain.setValueAtTime(0, at + 0.01);
    t.gain.linearRampToValueAtTime(0.04, at + 0.012);
    t.gain.linearRampToValueAtTime(0, at + 0.045);
    this.osc('square', 1760, at + 0.01, at + 0.05).connect(t).connect(this.bus);
  }
  /** Ten engines on the grid: idling from `at`, revs climbing from `rev`, cut dead at `cut`. */
  grid(at: number, rev: number, cut: number): void {
    if (!this.ready() || cut <= at) return;
    const f = this.filter('lowpass', 700, 0.9),
      g = this.gain();
    g.gain.setValueAtTime(0, at);
    g.gain.linearRampToValueAtTime(0.06, at + 0.4);
    g.gain.setValueAtTime(0.06, rev);
    g.gain.linearRampToValueAtTime(0.1, cut - 0.01);
    g.gain.linearRampToValueAtTime(0, cut); // the hard cut into silence
    f.frequency.setValueAtTime(700, rev);
    f.frequency.linearRampToValueAtTime(1700, cut);
    for (let k = 0; k < 5; k++) {
      const base = 128 + k * 7,
        o = this.osc('sawtooth', base, at, cut);
      o.detune.value = (k - 2) * 9;
      // idle, then each driver blipping higher and higher towards the start
      for (let t = rev, n = 0; t < cut; n++) {
        const up = (t - rev) / (cut - rev);
        o.frequency.setValueAtTime(o.frequency.value, t);
        o.frequency.linearRampToValueAtTime(base * (1.5 + 0.7 * up) * (n % 2 ? 0.86 : 1), t + 0.12);
        t += 0.22 + ((k * 0.37 + n * 0.11) % 0.14);
      }
      o.connect(f);
    }
    f.connect(g).connect(this.bus);
  }
  /** Lights out: a low thump and ten engines pulling away up the gears, fading as the music takes over by `end`. */
  launch(at: number, end: number): void {
    if (!this.ready()) return;
    const th = this.gain();
    th.gain.setValueAtTime(0, at);
    th.gain.linearRampToValueAtTime(0.7, at + 0.006);
    th.gain.exponentialRampToValueAtTime(0.001, at + 0.55);
    const s = this.osc('sine', 72, at, at + 0.6);
    s.frequency.exponentialRampToValueAtTime(30, at + 0.5);
    s.connect(th).connect(this.bus);
    const nf = this.filter('bandpass', 900, 0.8),
      ng = this.gain();
    ng.gain.setValueAtTime(0, at);
    ng.gain.linearRampToValueAtTime(0.12, at + 0.02);
    ng.gain.exponentialRampToValueAtTime(0.001, at + 0.5);
    this.noise(at, at + 0.55).connect(nf).connect(ng).connect(this.bus);
    const f = this.filter('lowpass', 1200, 1),
      g = this.gain();
    g.gain.setValueAtTime(0, at);
    g.gain.linearRampToValueAtTime(0.13, at + 0.03);
    g.gain.setValueAtTime(0.13, at + 0.9);
    g.gain.linearRampToValueAtTime(0, end);
    f.frequency.setValueAtTime(1200, at);
    f.frequency.linearRampToValueAtTime(600, end); // pulling away from the helicopter
    for (let k = 0; k < 5; k++) {
      const o = this.osc('sawtooth', 160, at, end);
      o.detune.value = (k - 2) * 11;
      // up through the gears: each pull rises, each shift drops back
      let t = at + k * 0.03;
      for (let gear = 0; gear < 5 && t < end; gear++) {
        const len = 0.42 + gear * 0.14;
        o.frequency.setValueAtTime(150 + gear * 12, t);
        o.frequency.linearRampToValueAtTime(300 + gear * 6, t + len);
        t += len + 0.04;
      }
      o.connect(f);
    }
    f.connect(g).connect(this.bus);
  }
  /** Air rushing past, arriving at `at + dur`. */
  whoosh(at: number, dur: number): void {
    if (!this.ready()) return;
    const f = this.filter('bandpass', 400, 1.1),
      g = this.gain();
    f.frequency.setValueAtTime(400, at);
    f.frequency.exponentialRampToValueAtTime(2800, at + dur);
    g.gain.setValueAtTime(0.001, at);
    g.gain.exponentialRampToValueAtTime(0.16, at + dur);
    g.gain.linearRampToValueAtTime(0, at + dur + 0.08);
    this.noise(at, at + dur + 0.1).connect(f).connect(g).connect(this.bus);
  }
  setMuted(m: boolean): void {
    this.muted = m;
    if (this.bus && this.ctx) this.bus.gain.setTargetAtTime(m ? 0 : 1, this.ctx.currentTime, 0.02);
  }
}
