// Dynamic racing line planner.
//
// CONTRACT (sim/lines.ts and tools/ depend on exactly this; internals are free to change)
// ---------------------------------------------------------------------------------
// LEVELS                   [null, {name, ...}, ...] the difficulty levels (1 = Novice, 2 = Intermediate, 3 = Cautious Expert, 4 = Perfect Expert), see below.
// create(geom, car, cfg) -> planner
//   geom : { N, SEG, L, HW, cx, cy, tx, ty, nx, ny, SL, ccurv, refLat, refV }
//          Closed-loop centreline sampled every SEG metres (N samples, typed arrays of length N).
//          cx,cy  centreline point          tx,ty  unit tangent        nx,ny  unit normal (= -ty, tx)
//          SL     gradient (rise/run)       ccurv  signed centreline curvature (1/m)
//          HW     half road width (m)
//          refLat the game's classic racing line as a lateral offset per sample (off[])
//          refV   the game's classic speed profile along refLat for this car (PROF[team])
//          A world point at lateral offset q from sample i is (cx[i]+nx[i]*q, cy[i]+ny[i]*q).
//   car  : { grip, acc, vmax, vcap, brk, kmax, surf }
//          grip  lateral acceleration limit on tarmac, m/s^2  (physics: |curvature| <= min(grip/v^2, kmax))
//          acc   full-throttle acceleration at v=0, m/s^2     (physics: a = acc*(1-(v/vmax)^2) - 9.81*SL)
//          vmax  speed where acceleration reaches zero        vcap  top speed the classic profile allows
//          brk   full-brake deceleration, m/s^2               kmax  hard curvature cap (1/7)
//          surf  optional: grip of each surface relative to tarmac (dry values by default). In the wet the caller
//                passes the wet grip, brakes and surface ratios; a wet line is simply another car.
//          Lifted and not braking the car coasts at -(2.5+0.02*v) m/s^2.
//          Asking for more turn than the tyres have makes them slide: the car still turns at its limit and
//          sheds up to 11 m/s^2 extra (slide = (asked-limit)/limit, capped at 1).
//   cfg  : { level }  1..4, default 2. Any field of a level can also be overridden here (or in window.DYNCFG).
// planner.level / planner.name / planner.hold   the level, its name, and whether lifting should hold speed (Novice).
// planner.build(budgetMs) -> progress 0..1   Do up to budgetMs of table building; build(Infinity) finishes synchronously.
// planner.ready            true once build() has returned 1; control()/plan() must not be called before that.
// planner.reset()          Forget plan history (race restart, car reset, teleport).
// planner.sig / planner.setLine(lat) -> bool   Reuse a line saved from an earlier build with the same sig (skips build()).
// planner.ctl / planner.setCtl(c) -> bool      The same, compactly: the line's spline control points (after build(); what
//                                              tools/precompute.js stores in dynlines.js).
// planner.control(car, obstacles, opts, dt) -> { k, safe }
//          Called every physics step (120 Hz) for the player's car while the dynamic line is on.
//          (AI cars do not use control(): the game steers them along planner.line with its own traffic logic.)
//          car        the game's car object, read-only here: { x, y, h, v, idx, lat, s, gm, surf, dirt, ... }
//                     x,y world position; h heading (rad); v speed (m/s); idx nearest centreline sample;
//                     lat signed lateral offset from the centreline; s arc position (m); gm grip multiplier (1)
//          obstacles  other cars near the player: [{ d, lat, v, x, y, h, out }]
//                     d = distance ahead along the track in metres (negative = behind), out = retired/crawling
//          opts       { attack }   attack = the player is holding the gas right now
//          returns    k     curvature command (1/m, same sign convention as the game's pursuit()); may exceed the
//                           tyre limit on purpose (a skid) to shed speed
//                     safe  speed (m/s) the auto-brake holds the car to when the player lifts
//          It replans internally at its own rate and keeps the latest plan in planner.cur.
// planner.cur              latest plan, for drawing: { i0, n, lat, v, zone, feasible }
//                          lat[k], v[k], zone[k] belong to centreline sample (i0+k)%N for k in 0..n-1.
//                          Sample i0 is at or just behind the car. v[k] is the planned speed there (what the car
//                          does if the gas is held wherever the plan allows); lat[k] the planned lateral offset;
//                          zone[k] 0 = on the gas, 1 = braking, 2 = holding speed, 3 = braking with a planned skid.
// planner.line             { lat, v, zone, kap, psi (length N), lapTime, refTime } this level's best flying lap, once ready:
//                          lateral offset, speed, zone, path curvature (1/m) and heading relative to the centreline (rad) per sample.
// planner.stats            { calls, ms, maxMs, flips, passes, buildMs }
//
// HOW IT WORKS
// ------------
// 1. build(): finds the minimum-lap-time line for this car within the level's limits. The line is a periodic
//    cubic B-spline of lateral offsets. Its curvature is measured on the path as it lies on the ground, and its lap
//    time comes from a forward/backward speed profile with the game's own rules (grip-limited cornering, braking,
//    acceleration, gradient, and, for the Perfect Expert level, the extra deceleration of a deliberate skid while
//    cornering at the limit). The search moves the control points by smooth bumps, many at once, wide to narrow,
//    keeping whatever makes the lap faster, on a coarse spline first and then finer ones; then it tries a wide entry
//    at every corner and keeps it where the lap gains. Repeating it from other starting points lands within a few
//    hundredths of a second: a well-converged local best, not a proof of the global one.
// 2. plan(): from the car's real state it builds a family of smooth candidate paths
//        lat(s) = line(s) + g(s)*(target(s) - line(s)) + r(s)
//    r carries the car's present offset, heading and curvature and fades to zero (so every path leaves the car
//    tangentially); g leans the path towards one edge of the road, or into a lane beside another car, for a
//    while and returns. Each candidate gets a speed profile starting at the car's real speed, using everything
//    the car really has (full brakes, full grip, the whole road, skidding); the fastest one wins. The plan being
//    driven is always a candidate, with a small bonus, so the line does not flicker.
// 3. control(): follows the chosen path with its own curvature plus a little feedback, and reports the level's
//    braking envelope as the auto-brake target. When the car is cornering at the tyre limit and still has to
//    lose speed, it asks for extra steering lock: the car skids, which sheds speed without changing its arc.
//
// LEVELS
// ------
// Every level shows the player a line and a braking point that hold something back; the reserve is what a
// mistimed press or lift eats into before the car runs wide. Novice holds a lot back, Perfect Expert nothing.
const root: any = globalThis;
const now =
  typeof performance !== 'undefined' && performance.now ? () => performance.now() : () => Date.now();
const G0 = 9.81,
  SLIDE = 11; // gravity; deceleration of a full skid (game physics)
const SURF0 = [1, 31 / 34, 18 / 34, 10 / 34, 22 / 34, 19 / 34]; // grip of each surface relative to tarmac in the dry (as in the game's physics)
const bsp = x => {
  x = x < 0 ? -x : x;
  return x < 1 ? (4 - 6 * x * x + 3 * x * x * x) / 6 : x < 2 ? ((2 - x) * (2 - x) * (2 - x)) / 6 : 0;
};
//   gripMargin  share of the cornering grip the shown line uses
//   brkMargin   share of the brakes the shown braking points assume
//   edge        how far (m) the shown line keeps the car's centre from the edge of the road
//   skid        share of the skid deceleration the shown line counts on (0 = skids are only ever a rescue)
//   hold        lifting holds the present speed instead of coasting down (the game applies it)
export const LEVELS = [
  null,
  { name: 'Novice', gripMargin: 0.86, brkMargin: 0.62, edge: 2.2, skid: 0, hold: true },
  { name: 'Intermediate', gripMargin: 0.93, brkMargin: 0.78, edge: 1.5, skid: 0, hold: false },
  { name: 'Cautious Expert', gripMargin: 0.97, brkMargin: 0.9, edge: 1.0, skid: 0, hold: false },
  { name: 'Perfect Expert', gripMargin: 0.995, brkMargin: 0.985, edge: 0.3, skid: 1, hold: false },
];

export function create(geom, car, cfg?) {
  const level = Math.max(1, Math.min(4, ((cfg && cfg.level) || (root.DYNCFG && root.DYNCFG.level) || 2) | 0));
  cfg = Object.assign(
    {
      horizon: 240, // metres planned ahead
      rate: 60, // plans per second (the heavier candidate sets run less often)
      hyst: 0.03, // seconds a new path must gain to replace the one being driven
      hystTraffic: 0.03, // ...and to replace a pass or a lane beside another car (a bigger value commits harder but reacted too late to other cars moving: more contacts in testing)
      kLat: 0.012, // feedback on lateral error (1/m^2)
      kHead: 0.22, // feedback on heading error (1/m)
      skidGain: 12, // how hard the driver scrubs when the path needs more turn than the tyres have (1 = only what happens by itself)
      rescueTurn: 0.75, // too fast and lifted: turn in at the limit and skid once the path asks for this share of the available turn...
      rescueOver: 2, // ...and the car is this many m/s over the braking envelope (or less, when no path can be held)
      passing: false, // pull out and pass moving cars (off: the path depends on the track and your own car only; it still goes round stopped cars)
      Wc: 2.6, // centre-to-centre room needed beside another car (m)
      Wp: 3.3, // the sideways offset from a car that a pass aims for (m)
      levels: [106, 212, 424, 848], // B-spline control points per search stage (the last is what a stored line holds; finer than 848 gains nothing)
      rounds: 8,
      roundTol: 0.01, // build: most search rounds on each coarse spline, and the gain (s a lap) below which it moves on
      polish: 16,
      polishTol: 0.002, // ...and the same on the final, finest spline
      kickLevels: 2,
      kickAt: [150, 70],
      kickPull: 0.3, // build: try a wide entry at each corner on the last two splines, pulling the line out 150 m and 70 m before its tightest point
    },
    LEVELS[level],
    root.DYNCFG || {},
    cfg || {},
    { level },
  );
  const N = geom.N,
    SEG = geom.SEG,
    L = N * SEG,
    HW = geom.HW;
  const lim = HW - cfg.edge; // the shown line stays within this
  const limE = HW + 0.3; // when it has to, the car's centre may go this far out: still on full-grip tarmac, inside track limits (HW+1.3)
  const offLat = HW + 0.45; // beyond this the car is on grass/kerb/gravel
  const invM = 1 / Math.sqrt(cfg.gripMargin),
    rescueR = Math.sqrt(cfg.rescueTurn),
    kcap = (car.kmax || 1 / 7) * 0.98;
  const tx = geom.tx,
    ty = geom.ty,
    SL = geom.SL,
    SURF = car.surf || SURF0;
  const F = () => new Float64Array(N);

  // ---- centreline curvature and its derivative (from the tangents, lightly smoothed): used to turn the car's heading and steering
  //      into a lateral slope and back; the curvature of lines and plans is measured on the ground instead (geomAt, evalCand) ----
  const kc = F(),
    dkc = F();
  {
    const raw = F();
    for (let i = 0; i < N; i++) {
      const a = (i - 1 + N) % N,
        b = (i + 1) % N;
      raw[i] = Math.atan2(tx[a] * ty[b] - ty[a] * tx[b], tx[a] * tx[b] + ty[a] * ty[b]) / (2 * SEG);
    }
    for (let i = 0; i < N; i++) kc[i] = 0.25 * raw[(i - 1 + N) % N] + 0.5 * raw[i] + 0.25 * raw[(i + 1) % N];
    for (let i = 0; i < N; i++) dkc[i] = (kc[(i + 1) % N] - kc[(i - 1 + N) % N]) / (2 * SEG);
  }
  const Gp = car.grip * cfg.gripMargin; // grip the shown line uses
  const Bp = car.brk * cfg.brkMargin; // brakes the shown braking points assume
  const SK = SLIDE * cfg.skid; // skid deceleration the shown line counts on
  const vTop = car.vmax * 0.999;
  const acc = v => {
    const r = v / car.vmax;
    return car.acc * (1 - r * r);
  };

  // ---- lap model on the closed loop: geometry of a lateral-offset line, then the speed profile ----
  const kapL = F(),
    dsL = F(),
    vlL = F(),
    vBk = F(),
    vL = F(),
    dtL = F();
  // Geometry of a line at sample i, measured on the path as it lies on the ground: curvature from the circle through the points
  // 4 m behind, here and 4 m ahead, and the length of the step to the next sample. (A formula from the centreline's own
  // curvature is cheaper but only as good as that curvature: where the centreline has a kink a few metres long it saw a
  // gentler bend than the car has to drive, and a thorough search learns to put the line exactly there.)
  const cxA = geom.cx,
    cyA = geom.cy,
    nxA = geom.nx,
    nyA = geom.ny;
  function geomAt(q, i) {
    const a = i < 2 ? i - 2 + N : i - 2,
      b = i >= N - 2 ? i + 2 - N : i + 2,
      e = i === N - 1 ? 0 : i + 1;
    const x0 = cxA[a] + nxA[a] * q[a],
      y0 = cyA[a] + nyA[a] * q[a],
      x1 = cxA[i] + nxA[i] * q[i],
      y1 = cyA[i] + nyA[i] * q[i],
      x2 = cxA[b] + nxA[b] * q[b],
      y2 = cyA[b] + nyA[b] * q[b];
    const ux = x1 - x0,
      uy = y1 - y0,
      wx = x2 - x1,
      wy = y2 - y1,
      tx2 = x2 - x0,
      ty2 = y2 - y0;
    const d = Math.sqrt((ux * ux + uy * uy) * (wx * wx + wy * wy) * (tx2 * tx2 + ty2 * ty2)),
      k = d > 1e-9 ? (2 * (ux * wy - uy * wx)) / d : 0;
    const ex = cxA[e] + nxA[e] * q[e] - x1,
      ey = cyA[e] + nyA[e] * q[e] - y1;
    kapL[i] = k;
    dsL[i] = Math.sqrt(ex * ex + ey * ey);
    const ak = k < 0 ? -k : k;
    vlL[i] = ak * vTop * vTop > Gp ? Math.sqrt(Gp / ak) : vTop;
  }
  // the fastest the car may be at sample i and still brake for what follows (vBk), given the sample after it. Where the car is
  // on the grip limit of a corner, a skid adds to the brakes (if the level counts on it).
  function bval(i) {
    const j = i === N - 1 ? 0 : i + 1;
    let B = Bp + G0 * SL[i];
    if (B < 8) B = 8;
    const m = vBk[j] * vBk[j] + 2 * B * dsL[i],
      l = vlL[i],
      l2 = l * l;
    return m >= l2 || (SK > 0 && l < vTop && l > 12 && m + 2 * SK * dsL[i] >= l2) ? l : Math.sqrt(m);
  }
  // the speed at sample i (vL): that limit, or what full throttle from the sample before it reaches
  function fval(i) {
    const j = i === 0 ? N - 1 : i - 1,
      u = vL[j],
      r = u / car.vmax,
      m = u * u + 2 * (car.acc * (1 - r * r) - G0 * SL[j]) * dsL[j],
      b = vBk[i];
    return m < b * b ? Math.sqrt(m > 1 ? m : 1) : b;
  }
  function lapTime() {
    vBk.set(vlL);
    for (let r = 0; r < 2; r++) for (let i = N - 1; i >= 0; i--) vBk[i] = bval(i);
    vL.set(vBk);
    for (let r = 0; r < 2; r++) for (let i = 0; i < N; i++) vL[i] = fval(i);
    let T = 0;
    for (let i = 0; i < N; i++) {
      const j = i === N - 1 ? 0 : i + 1;
      T += dtL[i] = (2 * dsL[i]) / (vL[i] + vL[j]);
    }
    return T;
  }
  function lapTimeOf(q) {
    for (let i = 0; i < N; i++) geomAt(q, i);
    return lapTime();
  }
  // The same lap time after the line has moved on samples a..b only (unwrapped indices): the braking limit is redone backwards
  // from b for as long as it changes, then the speeds forwards from there for as long as they change. A trial move costs the
  // stretch of lap it really affects, not the whole lap. lapUndo() puts the profile back (call it after restoring the geometry).
  const uB = new Float64Array(N + 4),
    uF = new Float64Array(N + 4),
    uT = new Float64Array(N + 4);
  let uLo = 0,
    uHi = 0,
    uB0 = 0,
    uFull = false;
  function lapInc(T, a, b) {
    uFull = false;
    let lo = b,
      n = 0;
    for (let u = b; ; u--) {
      const i = ((u % N) + N) % N,
        nv = bval(i);
      if (u < a && nv === vBk[i]) break;
      if (++n > N - 4) {
        uFull = true;
        return lapTime();
      }
      uB[b - u] = vBk[i];
      vBk[i] = nv;
      lo = u;
    }
    let hi = lo - 1;
    n = 0;
    for (let u = lo; ; u++) {
      const i = ((u % N) + N) % N,
        nv = fval(i);
      if (u > b + 1 && nv === vL[i]) break;
      if (++n > N - 4) {
        uFull = true;
        return lapTime();
      }
      uF[u - lo] = vL[i];
      vL[i] = nv;
      hi = u;
    }
    let dT = 0;
    for (let u = lo - 1; u <= hi; u++) {
      const i = ((u % N) + N) % N,
        j = i === N - 1 ? 0 : i + 1,
        nd = (2 * dsL[i]) / (vL[i] + vL[j]);
      uT[u - lo + 1] = dtL[i];
      dT += nd - dtL[i];
      dtL[i] = nd;
    }
    uLo = lo;
    uHi = hi;
    uB0 = b;
    return T + dT;
  }
  function lapUndo() {
    if (uFull) {
      lapTime();
      return;
    }
    for (let u = uB0; u >= uLo; u--) vBk[((u % N) + N) % N] = uB[uB0 - u];
    for (let u = uLo; u <= uHi; u++) vL[((u % N) + N) % N] = uF[u - uLo];
    for (let u = uLo - 1; u <= uHi; u++) dtL[((u % N) + N) % N] = uT[u - uLo + 1];
  }

  // ---- build: minimum-lap-time line, searched on the control points of a periodic B-spline ----
  const qs = F(),
    vs = F(); // this level's line and its speed profile
  const qsd = F(),
    qsdd = F(); // its first and second derivative per metre of centreline
  let refTime = 0,
    bestTime = 0;
  // The search moves the line by smooth bumps: a raised cosine over 2W+1 control points, from wide (whole approaches to a
  // corner, entire esses) down to a single control point, keeping each bump that makes the lap faster and pushing on in the
  // same direction while it keeps gaining. Round after round until a round gains almost nothing, first on a coarse spline,
  // then on finer ones. (An earlier version moved one control point at a time only. That stalls wherever a longer stretch has
  // to move together, e.g. taking the whole run to a corner out to the edge of the road, and left about 2 s a lap unused.)
  function* builder() {
    refTime = lapTimeOf(geom.refLat);
    const q = F();
    let ctl = null,
      Mprev = 0,
      T = 0;
    const WMAX = 80,
      WSall = [WMAX, 40, 20, 10, 5, 3, 1],
      AM = [1.5, 0.5, 0.15, 0.05, 0.02],
      nLv = cfg.levels.length;
    const cOld = new Float64Array(2 * WMAX + 1),
      qOld = F(),
      kO = new Float64Array(N + 4),
      dO = new Float64Array(N + 4),
      vO = new Float64Array(N + 4);
    for (let lv = 0; lv < nLv; lv++) {
      const M = cfg.levels[lv],
        c = new Float64Array(M),
        sc = M / N;
      if (!ctl)
        for (let j = 0; j < M; j++) c[j] = Math.max(-lim, Math.min(lim, geom.refLat[Math.round(j / sc) % N]));
      else if (M === 2 * Mprev)
        for (let j = 0; j < Mprev; j++) {
          const a = ctl[(j - 1 + Mprev) % Mprev],
            b = ctl[j],
            d = ctl[(j + 1) % Mprev];
          c[2 * j] = (a + 6 * b + d) / 8;
          c[2 * j + 1] = (b + d) / 2;
        }
      else for (let j = 0; j < M; j++) c[j] = q[Math.round(j / sc) % N];
      for (let j = 0; j < M; j++) c[j] = c[j] > lim ? lim : c[j] < -lim ? -lim : c[j];
      for (let i = 0; i < N; i++) {
        const x = i * sc,
          j0 = Math.floor(x);
        let s = 0;
        for (let m = -1; m <= 2; m++) s += c[(((j0 + m) % M) + M) % M] * bsp(x - (j0 + m));
        q[i] = s;
      }
      T = lapTimeOf(q);
      let pinI = -1,
        pinO = 1,
        pinW = 0,
        pinP = 0; // wide-entry step: sample to pull outwards, which side, how hard, and the pull's present cost
      const tryBump = (cc, W, amp) => {
        for (let d = -W; d <= W; d++) {
          const j = (((cc + d) % M) + M) % M;
          cOld[d + W] = c[j];
          const v = c[j] + amp * 0.5 * (1 + Math.cos((Math.PI * d) / W));
          c[j] = v > lim ? lim : v < -lim ? -lim : v;
        }
        const iA = Math.ceil((cc - W - 2) / sc),
          iB = Math.floor((cc + W + 2) / sc),
          len = iB - iA + 1; // samples the bump moves (unwrapped)
        for (let t = 0; t < len; t++) {
          const u = iA + t,
            i = ((u % N) + N) % N,
            x = u * sc,
            j0 = Math.floor(x);
          qOld[t] = q[i];
          let v = 0;
          for (let m = -1; m <= 2; m++) v += c[(((j0 + m) % M) + M) % M] * bsp(x - (j0 + m));
          q[i] = v;
        }
        for (let t = -2; t <= len + 1; t++) {
          const i = (((iA + t) % N) + N) % N;
          kO[t + 2] = kapL[i];
          dO[t + 2] = dsL[i];
          vO[t + 2] = vlL[i];
        }
        for (let t = -2; t <= len + 1; t++) geomAt(q, (((iA + t) % N) + N) % N);
        const T2 = lapInc(T, iA - 2, iB + 2);
        let P2 = 0;
        if (pinI >= 0) {
          const g = lim - pinO * q[pinI];
          P2 = pinW * g * g;
        }
        if (T2 + P2 < T + pinP - 1e-7) {
          T = T2;
          pinP = P2;
          return true;
        }
        for (let d = -W; d <= W; d++) c[(((cc + d) % M) + M) % M] = cOld[d + W];
        for (let t = 0; t < len; t++) q[(((iA + t) % N) + N) % N] = qOld[t];
        for (let t = -2; t <= len + 1; t++) {
          const i = (((iA + t) % N) + N) % N;
          kapL[i] = kO[t + 2];
          dsL[i] = dO[t + 2];
          vlL[i] = vO[t + 2];
        }
        lapUndo();
        return false;
      };
      const WS = WSall.filter(W => (2 * W + 5) / sc + 4 < N / 2),
        last = lv === nLv - 1,
        rounds = last ? cfg.polish : cfg.rounds,
        tol = last ? cfg.polishTol : cfg.roundTol;
      for (let r = 0; r < rounds; r++) {
        T = lapTime();
        const T0 = T;
        let nTry = 0; // (re-summed from scratch each round, so rounding never builds up)
        for (let wi = 0; wi < WS.length; wi++) {
          const W = WS[wi],
            st = Math.max(1, W >> 2);
          for (let cc = 0; cc < M; cc += st)
            for (const a of AM) {
              const sg = tryBump(cc, W, a) ? 1 : tryBump(cc, W, -a) ? -1 : 0;
              if (sg) for (let k = 0; k < 6 && tryBump(cc, W, sg * a); k++);
              if ((++nTry & 31) === 0) yield (lv + (r + wi / WS.length) / rounds) / nLv;
            }
        }
        if (root.DYNLOG) {
          const Tf = lapTime();
          root.DYNLOG.push(
            'level ' +
              M +
              ' round ' +
              (r + 1) +
              ': ' +
              T.toFixed(3) +
              ' (gain ' +
              (T0 - T).toFixed(3) +
              ', incremental sum off by ' +
              (T - Tf).toExponential(1) +
              ')',
          );
        }
        if (T0 - T < tol) break;
      }
      // Wide entries. The bumps only ever keep a change that is faster at once, so an approach that sits in the middle of the
      // road stays there even where running it out to the edge would pay once the turn-in and the apex have moved to suit.
      // So, corner by corner and at two distances before its tightest point: pull the line out to the limit there (a penalty on
      // the gap, added to the lap time while the bumps rework the stretch around it), drop the pull and let the stretch settle
      // freely, and keep the result only if the lap itself is now faster. Worth a few hundredths where it applies, and it is
      // what a driver expects to see: the car out at the edge before it turns in.
      if (lv >= nLv - cfg.kickLevels) {
        const cSave = new Float64Array(M),
          setQ = () => {
            for (let i = 0; i < N; i++) {
              const x = i * sc,
                j0 = Math.floor(x);
              let v = 0;
              for (let m = -1; m <= 2; m++) v += c[(((j0 + m) % M) + M) % M] * bsp(x - (j0 + m));
              q[i] = v;
            }
            return lapTimeOf(q);
          };
        const ak = i => {
            const k = kapL[((i % N) + N) % N];
            return k < 0 ? -k : k;
          },
          corners = [];
        for (let i = 0; i < N; i++) {
          if (ak(i) < 1 / 160) continue;
          let pk = true;
          for (let d = -25; d <= 25 && pk; d++) if (ak(i + d) > ak(i)) pk = false;
          if (pk) corners.push(i);
        }
        const local = (jA, jB, nRounds) => {
          for (let r = 0; r < nRounds; r++) {
            const O0 = T + pinP;
            for (const W of WS) {
              if (W > 40) continue;
              const st = Math.max(1, W >> 2);
              for (let cc = jA - W; cc <= jB + W; cc += st)
                for (const a of AM) {
                  const sg = tryBump(cc, W, a) ? 1 : tryBump(cc, W, -a) ? -1 : 0;
                  if (sg) for (let k = 0; k < 6 && tryBump(cc, W, sg * a); k++);
                }
            }
            if (O0 - T - pinP < 0.001) break;
          }
        };
        let kept = 0,
          tried = 0;
        for (const ap of corners)
          for (const dist of cfg.kickAt) {
            const pin = (((ap - Math.round(dist / SEG)) % N) + N) % N,
              o = kapL[ap] > 0 ? -1 : 1;
            if (lim - o * q[pin] < 0.4) continue; // already out there
            const jA = Math.round((ap - (dist + 150) / SEG) * sc),
              jB = Math.round((ap + 90 / SEG) * sc);
            cSave.set(c);
            const Ts = T;
            tried++;
            pinI = pin;
            pinO = o;
            pinW = cfg.kickPull;
            {
              const g = lim - o * q[pin];
              pinP = pinW * g * g;
            }
            local(jA, jB, 3);
            yield (lv + 0.95) / nLv;
            pinI = -1;
            pinP = 0;
            T = lapTime();
            local(jA, jB, 3);
            yield (lv + 0.96) / nLv;
            if (T < Ts - 1e-4) kept++;
            else {
              c.set(cSave);
              T = setQ();
            }
          }
        if (kept)
          for (let r = 0; r < 2; r++) {
            // let the whole lap settle again
            T = lapTime();
            for (let wi = 0; wi < WS.length; wi++) {
              const W = WS[wi],
                st = Math.max(1, W >> 2);
              for (let cc = 0; cc < M; cc += st)
                for (const a of AM) {
                  const sg = tryBump(cc, W, a) ? 1 : tryBump(cc, W, -a) ? -1 : 0;
                  if (sg) for (let k = 0; k < 6 && tryBump(cc, W, sg * a); k++);
                }
              yield (lv + 0.97) / nLv;
            }
          }
        if (root.DYNLOG)
          root.DYNLOG.push(
            'level ' +
              M +
              ' wide entries: kept ' +
              kept +
              ' of ' +
              tried +
              ' tried at ' +
              corners.length +
              ' corners, ' +
              T.toFixed(3),
          );
      }
      ctl = c;
      Mprev = M;
    }
    pl.ctl = ctl;
    finish(q);
  }
  // tidy a run of zone codes: drop braking blips shorter than a few samples, close short gaps inside a braking zone
  function tidy(z, len, ring) {
    const at = k => z[ring ? ((k % len) + len) % len : k],
      end = ring ? Infinity : len; // a ring has no end to run off
    for (let k = 0; k < len; k++)
      if (z[k] !== 1 && z[k] !== 3) {
        let a = 1;
        while (a <= 3 && k + a < end && at(k + a) !== 1 && at(k + a) !== 3) a++;
        if (a <= 3 && (ring || k > 0) && (ring || k + a < len) && (at(k - 1) === 1 || at(k - 1) === 3))
          z[k] = 1;
      }
    let k = 0;
    while (k < len) {
      if (z[k] === 1 || z[k] === 3) {
        let e = k;
        while (e < len && (z[e] === 1 || z[e] === 3)) e++;
        if (e - k < 4 && !(ring && (k === 0 || e === len))) for (let t = k; t < e; t++) z[t] = 2;
        k = e;
      } else k++;
    }
  }
  function finish(q) {
    bestTime = lapTimeOf(q);
    qs.set(q);
    vs.set(vL);
    for (let i = 0; i < N; i++) {
      const a = (i - 1 + N) % N,
        b = (i + 1) % N;
      qsd[i] = (q[b] - q[a]) / (2 * SEG);
      qsdd[i] = (q[b] - 2 * q[i] + q[a]) / (SEG * SEG);
    }
    const zone = new Uint8Array(N);
    for (let i = 0; i < N; i++) {
      const j = (i + 1) % N,
        a = (vs[j] * vs[j] - vs[i] * vs[i]) / (2 * dsL[i]);
      zone[i] = a < -3 ? (a < -(Bp + G0 * SL[i]) - 0.5 ? 3 : 1) : a > 0.4 ? 0 : 2;
    }
    tidy(zone, N, true);
    const psi = new Float32Array(N);
    for (let i = 0; i < N; i++) psi[i] = Math.atan2(qsd[i], 1 - q[i] * kc[i]);
    pl.line = {
      lat: Float32Array.from(qs),
      v: Float32Array.from(vs),
      zone,
      kap: Float32Array.from(kapL),
      psi,
      lapTime: bestTime,
      refTime,
    };
    pl.ready = true;
  }
  let gen = null,
    prog = 0,
    tBuild = 0;

  // ---- live planning ----
  const n = Math.round(cfg.horizon / SEG);
  const mk = () => ({
    lat: new Float64Array(n + 2),
    kap: new Float64Array(n),
    ds: new Float64Array(n),
    vl: new Float64Array(n),
    vb: new Float64Array(n),
    vf: new Float64Array(n),
    qd: new Float64Array(n),
    sk: new Float64Array(n),
    wx: new Float64Array(n + 4),
    wy: new Float64Array(n + 4),
  });
  let W = mk(),
    Bst = mk(); // work buffers and the best candidate's buffers
  const cur = {
    i0: 0,
    n,
    lat: new Float32Array(n),
    v: new Float32Array(n),
    zone: new Uint8Array(n),
    feasible: true,
  };
  const out = { k: 0, safe: 0 };
  // a candidate path:  lat(s) = line(s) + g(s)*(target(s) - line(s)) + r(s)
  //   g rises to gT over D1 from station Sg, holds for Dh, then returns over D2
  //   target is one edge of the road (kind 0: p) or a lane (kind 1: the smoothed classic line + tOff), e.g. beside another car
  //   r carries the car's own offset/heading/curvature at station S0 and fades to zero over Dr
  const mkc = () => ({
    kind: 0,
    p: 0,
    tOff: 0,
    gT: 0,
    S0: 0,
    Sg: 0,
    D1: 1,
    Dh: 0,
    D2: 1,
    Dr: 1,
    a0: 0,
    a1: 0,
    a2: 0,
    isPass: false,
    side: 0,
  });
  // other cars, as the planner sees them: distance ahead, speed, lane offset from the classic line, speed as a share of the classic profile
  const MAXO = 12,
    oD = new Float64Array(MAXO),
    oV = new Float64Array(MAXO),
    oOff = new Float64Array(MAXO),
    oR = new Float64Array(MAXO),
    oS = new Float64Array(MAXO),
    oVn = new Float64Array(MAXO);
  let nO = 0;
  const Wc = cfg.Wc,
    Wp = cfg.Wp; // centre-to-centre room needed beside a car; the offset a pass aims for
  const refLat = geom.refLat,
    refV = geom.refV,
    refS = F(); // refS: the classic line smoothed, so lanes built on it have clean curvature
  {
    refS.set(refLat);
    const t = F();
    for (let r = 0; r < 3; r++) {
      for (let i = 0; i < N; i++) {
        let a = 0;
        for (let m = -5; m <= 5; m++) a += refS[(((i + m) % N) + N) % N];
        t[i] = a / 11;
      }
      refS.set(t);
    }
  }
  const limS = limE - 1;
  let act = mkc(),
    tmp = mkc(),
    bestC = mkc();
  let have = false,
    Sabs = 0,
    lastS = 0,
    tPlan = 1e9,
    kLast = 0,
    planS = 0,
    bestCost = 0,
    bestFeas = true,
    planN = 0;
  const s5 = t => (t <= 0 ? 0 : t >= 1 ? 1 : t * t * t * (10 - 15 * t + 6 * t * t));

  // evaluate candidate c from the car's state; fills W; returns its cost (seconds, lower is better)
  let evFeas = true,
    evOff = false,
    bestOff = false;
  function evalCand(c, i0, f, v0, gm, bw) {
    const lat = W.lat,
      kap = W.kap,
      ds = W.ds,
      vl = W.vl,
      vb = W.vb,
      vf = W.vf,
      qdA = W.qd,
      sk = W.sk,
      wx = W.wx,
      wy = W.wy;
    const offS = Sabs - f * SEG - c.S0,
      offG = Sabs - f * SEG - c.Sg; // distance of sample 0 from the origins of r and g
    const hasG = c.gT !== 0,
      sA = c.D1,
      sB = c.D1 + c.Dh,
      sC = sB + c.D2;
    for (let k = -2; k <= n + 1; k++) {
      const i = (((i0 + k) % N) + N) % N,
        sr = offS + k * SEG,
        base = qs[i];
      let val = base;
      if (hasG) {
        const sg = offG + k * SEG,
          g =
            sg <= 0
              ? 0
              : sg < sA
                ? c.gT * s5(sg / sA)
                : sg <= sB
                  ? c.gT
                  : sg < sC
                    ? c.gT * (1 - s5((sg - sB) / c.D2))
                    : 0;
        if (g) {
          let tg = c.p;
          if (c.kind) {
            tg = refS[i] + c.tOff;
            const a = tg < 0 ? -tg : tg;
            if (a > limS) tg = (tg < 0 ? -1 : 1) * (limS + Math.tanh(a - limS));
          }
          val += g * (tg - base);
        } // lanes bend smoothly along the road edge
      }
      if (sr < c.Dr) {
        const t = sr / c.Dr,
          om = 1 - t;
        val += om * om * om * (c.a0 + c.a1 * t + c.a2 * t * t);
      }
      if (k >= -1 && k <= n) lat[k + 1] = val;
      wx[k + 2] = cxA[i] + nxA[i] * val;
      wy[k + 2] = cyA[i] + nyA[i] * val; // the path on the ground
    }
    const G = Gp * gm;
    let pen = 0,
      offRoad = false,
      tight = 0;
    for (let k = 0; k < n; k++) {
      const q = lat[k + 1],
        qd = (lat[k + 2] - lat[k]) / (2 * SEG);
      // curvature from the circle through the path 4 m behind, here and 4 m ahead; step length to the next sample (as in the lap model)
      const ux = wx[k + 2] - wx[k],
        uy = wy[k + 2] - wy[k],
        vx = wx[k + 4] - wx[k + 2],
        vy = wy[k + 4] - wy[k + 2],
        tx2 = wx[k + 4] - wx[k],
        ty2 = wy[k + 4] - wy[k];
      const dd = Math.sqrt((ux * ux + uy * uy) * (vx * vx + vy * vy) * (tx2 * tx2 + ty2 * ty2)),
        kk = dd > 1e-9 ? (2 * (ux * vy - uy * vx)) / dd : 0,
        ak = kk < 0 ? -kk : kk;
      const sx = wx[k + 3] - wx[k + 2],
        sy = wy[k + 3] - wy[k + 2];
      const aq = q < 0 ? -q : q,
        Gk = aq > offLat ? G * 0.5 : G; // off the tarmac there is about half the grip
      kap[k] = kk;
      ds[k] = Math.sqrt(sx * sx + sy * sy);
      qdA[k] = qd;
      vl[k] = ak * vTop * vTop > Gk ? Math.sqrt(Gk / ak) : vTop;
      if (ak > kcap) {
        const e = ak / kcap - 1;
        if (e > tight) tight = e;
      } // tighter than the car can turn at any speed
      const ex = aq - limE;
      if (ex > 0) {
        pen += ex * ex * (k < 6 ? 0.02 : 0.25);
        if (k >= 6 && aq > offLat) offRoad = true;
      } // leaving the road costs; less so right at the car, where it already is
    }
    // the level's braking envelope, backwards from the end of the horizon (where every candidate is back on the line)
    const iE = (i0 + n - 1) % N;
    vb[n - 1] = vl[n - 1] < vs[iE] ? vl[n - 1] : vs[iE];
    sk[n - 1] = 0;
    for (let k = n - 2; k >= 0; k--) {
      let B = Bp * bw + G0 * SL[(i0 + k) % N];
      if (B < 8) B = 8;
      const m = vb[k + 1] * vb[k + 1] + 2 * B * ds[k],
        l2 = vl[k] * vl[k];
      if (m >= l2) {
        vb[k] = vl[k];
        sk[k] = 0;
      } else if (SK > 0 && vl[k] < vTop && vl[k] > 12 && m + 2 * SK * ds[k] >= l2) {
        vb[k] = vl[k];
        sk[k] = (l2 - m) / (2 * SLIDE * ds[k]);
      } // on the grip limit: a skid makes up what the brakes lack
      else {
        vb[k] = Math.sqrt(m);
        sk[k] = 0;
      }
    }
    // forward from the car (a fraction f into the first segment) at its real speed, with everything the car really has.
    // The other cars move along with the clock of this pass: each keeps its lane and its share of the classic speed.
    // In a car's lane behind it, this path can only follow; overlapping a car counts as a collision.
    let v = v0,
      T = 0,
      viol = tight,
      coll = 0;
    vf[0] = v0;
    for (let j = 0; j < nO; j++) {
      oS[j] = oD[j];
      oVn[j] = oV[j];
    }
    for (let k = 1; k < n; k++) {
      const d = k === 1 ? ds[0] * (1 - f) : ds[k - 1],
        sl = G0 * SL[(i0 + k - 1) % N],
        b0 = car.brk * bw + sl;
      let vn = Math.sqrt(Math.max(1, v * v + 2 * (acc(v) - sl) * d));
      const Su = sk[k - 1] > 0 || sk[k] > 0 ? SK : 0; // a skid the line already counts on here
      let m = v * v - 2 * (b0 + Su) * d,
        vbr = m > 0 ? Math.sqrt(m) : 0;
      if (vn > vb[k]) {
        if (vbr <= vb[k]) vn = vb[k];
        else {
          // over the envelope even on full brakes. Past the true tyre limit the car slides, which sheds more speed; what is left over runs wide
          // (as the driver does in control(): scrub hard past the limit, and turn in at the limit to skid wherever the path curves enough)
          const lt = vl[k] * invM;
          if (v > 12) {
            const r = vbr / lt,
              nb = r >= rescueR ? SLIDE : 0;
            if (nb > Su) {
              m = v * v - 2 * (b0 + nb) * d;
              vbr = m > 0 ? Math.sqrt(m) : 0;
              if (vbr < vb[k]) vbr = vb[k];
            }
          }
          vn = vbr;
          if (vn > lt) {
            const e = vn / lt - 1;
            if (e > viol) viol = e;
          }
        }
      }
      if (nO) {
        const sig = (k - f) * SEG;
        for (let j = 0; j < nO; j++) {
          const gap = oS[j] - sig;
          if (gap < -6 || gap > 45) continue;
          const dk = Math.round(gap / SEG),
            io = (((i0 + k + dk) % N) + N) % N;
          let kk = k + dk;
          if (kk < 0) kk = 0;
          else if (kk > n - 1) kk = n - 1;
          const lo = refS[io] + oOff[j],
            lm = lat[kk + 1],
            dl = lm > lo ? lm - lo : lo - lm; // this path's lateral gap to the car, where the car is
          if (dl >= Wc) continue;
          if (gap > 5.5) {
            const vc = oVn[j] + (gap - 8) * 0.6;
            if (vn > vc) vn = vc > vbr ? vc : vbr;
          } else if (k > 2) coll += Wc - dl;
        }
      }
      const dt = (2 * d) / (v + vn + 1e-3);
      T += dt;
      v = vn;
      vf[k] = v;
      for (let j = 0; j < nO; j++) {
        let vo = oV[j];
        if (oR[j] >= 0) vo = refV[(((i0 + Math.round(f + oS[j] / SEG)) % N) + N) % N] * oR[j];
        oVn[j] = vo;
        oS[j] += vo * dt;
      }
    }
    const ve = vs[iE];
    if (v < ve) {
      const dv = ve - v;
      T += (dv * dv) / (2 * Math.max(acc(v), 2) * Math.max(v, 10));
    }
    evFeas = viol === 0;
    evOff = offRoad; // can the tyres hold it; does it stay on the road
    return T + pen + (viol > 0 ? 4 + 60 * viol : 0) + (coll > 0 ? 3 + 0.6 * coll : 0);
  }
  const D = [0, 0, 0, 0];
  function plan(c, obstacles, opts) {
    const t0 = now();
    planN++;
    const sI = c.s / SEG,
      fl = Math.floor(sI),
      i0 = ((fl % N) + N) % N,
      f = sI - fl,
      i1 = (i0 + 1) % N,
      gm = (c.gm || 1) * (1 - 0.2 * (c.dirt || 0)),
      bw = 0.6 + 0.4 * (c.gm || 1),
      v0 = c.v; // worn tyres: less grip, and the game's brakes fade with them
    // the car's state relative to the centreline: offset, slope and second derivative (from the last steering command)
    const tX = tx[i0] + (tx[i1] - tx[i0]) * f,
      tY = ty[i0] + (ty[i1] - ty[i0]) * f,
      ch = Math.cos(c.h),
      sh = Math.sin(c.h);
    let psi = Math.atan2(tX * sh - tY * ch, tX * ch + tY * sh);
    if (psi > 0.6) psi = 0.6;
    else if (psi < -0.6) psi = -0.6;
    const kcc = kc[i0] + (kc[i1] - kc[i0]) * f,
      dk = dkc[i0] + (dkc[i1] - dkc[i0]) * f,
      q0 = c.lat,
      A = 1 - q0 * kcc,
      qd0 = Math.tan(psi) * A,
      den = A * A + qd0 * qd0;
    const qdd0 = (kLast * den * Math.sqrt(den) - qd0 * (2 * qd0 * kcc + q0 * dk)) / A - A * kcc;
    const r0 = q0 - (qs[i0] + (qs[i1] - qs[i0]) * f),
      r1 = qd0 - (qsd[i0] + (qsd[i1] - qsd[i0]) * f),
      r2 = qdd0 - (qsdd[i0] + (qsdd[i1] - qsdd[i0]) * f);
    const setR = (cd, Dr) => {
      cd.S0 = Sabs;
      cd.Dr = Dr;
      cd.a0 = r0;
      cd.a1 = r1 * Dr + 3 * r0;
      cd.a2 = (r2 * Dr * Dr) / 2 + 3 * r1 * Dr + 6 * r0;
    };
    let best = 1e18,
      bestF = true,
      switched = false;
    const take = (cd, cost) => {
      best = cost;
      bestF = evFeas;
      bestOff = evOff;
      const t = W;
      W = Bst;
      Bst = t;
      Object.assign(bestC, cd);
    };
    const attack = !!(opts && opts.attack),
      H = n * SEG - 6,
      wasFeas = bestFeas,
      fresh = !have;
    nO = 0;
    if (obstacles)
      for (let j = 0; j < obstacles.length && nO < MAXO; j++) {
        const o = obstacles[j];
        if (o.d < -8 || o.d > H) continue;
        if (!cfg.passing && !(o.out || o.v < 15)) continue; // moving cars do not bend the path: the game's contact assist brakes for them
        const io = (((i0 + Math.round(f + o.d / SEG)) % N) + N) % N;
        oD[nO] = o.d;
        oV[nO] = o.v;
        oOff[nO] = o.lat - refS[io];
        oR[nO] = o.out || o.v < 15 ? -1 : Math.min(1.15, Math.max(0.3, o.v / Math.max(refV[io], 5)));
        nO++;
      }
    // lifting while still behind the car being passed gives the pass up: the car tucks back in
    if (cfg.passing && have && act.isPass && !attack)
      for (let j = 0; j < nO; j++)
        if (oD[j] > 6 && oD[j] < 80 && Math.abs(oOff[j] + act.side * Wp - act.tOff) < 1.2) {
          have = false;
          break;
        }
    // 1. the path being driven, unchanged (valid only while the car is still on it)
    if (have) {
      const cost = evalCand(act, i0, f, v0, gm, bw);
      const el = c.lat - (W.lat[1] + (W.lat[2] - W.lat[1]) * f);
      // it keeps a small head start over fresh paths, so the line does not dither
      if ((el < 0 ? -el : el) < 0.7) take(act, cost - (nO && act.kind ? cfg.hystTraffic : cfg.hyst));
    }
    // 2. fresh paths from the car's real state that simply merge back onto the line.
    //    With other cars about, changes of mind are only considered every fourth plan (15 a second): deciding more
    //    often made the car dither between lanes. The path being driven is still re-timed on every plan.
    const full = fresh || best > 1e17 || !nO || (planN & 3) === 0;
    D[0] = Math.min(H, Math.max(14, 0.55 * v0));
    D[1] = Math.min(H, Math.max(22, 1.0 * v0));
    D[2] = Math.min(H, Math.max(36, 1.8 * v0));
    D[3] = Math.min(H, Math.max(60, 3.0 * v0));
    if (full)
      for (let a = 0; a < 4; a++) {
        tmp.kind = 0;
        tmp.isPass = false;
        tmp.side = 0;
        tmp.gT = 0;
        tmp.p = 0;
        tmp.D1 = 1;
        tmp.Dh = 0;
        tmp.D2 = 1;
        setR(tmp, D[a]);
        const cost = evalCand(tmp, i0, f, v0, gm, bw);
        if (cost < best) {
          take(tmp, cost);
          switched = true;
        }
      }
    if (nO && full) {
      // 2b. a car alongside: staying in the present lane for a while is an option (merging could cut across it)
      let near = false;
      for (let j = 0; j < nO; j++) if (oD[j] > -8 && oD[j] < 14) near = true;
      if (near) {
        const rs0 = refS[i0] + (refS[i1] - refS[i0]) * f,
          rs1 = (refS[i1] - refS[i0]) / SEG,
          im = (i0 - 1 + N) % N,
          i2 = (i1 + 1) % N,
          rs2 = (refS[i2] - refS[i1] - refS[i0] + refS[im]) / (2 * SEG * SEG);
        for (let a = 0; a < 2; a++) {
          tmp.kind = 1;
          tmp.isPass = false;
          tmp.side = 0;
          tmp.gT = 1;
          tmp.tOff = q0 - rs0;
          tmp.Sg = Sabs - 1e4;
          tmp.D1 = 1e4;
          tmp.Dh = a ? 70 : 30;
          tmp.D2 = Math.max(25, v0);
          tmp.S0 = Sabs;
          tmp.Dr = D[1];
          tmp.a0 = 0;
          {
            const b1 = qd0 - rs1,
              b2 = qdd0 - rs2;
            tmp.a1 = b1 * tmp.Dr;
            tmp.a2 = (b2 * tmp.Dr * tmp.Dr) / 2 + 3 * b1 * tmp.Dr;
          }
          const cost = evalCand(tmp, i0, f, v0, gm, bw);
          if (cost < best) {
            take(tmp, cost);
            switched = true;
          }
        }
      }
      // 2c. lanes that pull out to either side of a car ahead, go by, and come back. Always for a stopped or crawling car;
      //     for a moving one only with cfg.passing (gas held), which is off: it made the path hard to predict.
      {
        let tried = 0,
          lastD = 0;
        const all = cfg.passing && attack;
        for (let pick = 0; pick < 2 && tried < 2; pick++) {
          let j = -1,
            bd = 1e9;
          for (let q = 0; q < nO; q++)
            if ((all || oR[q] < 0) && oD[q] > 4 && oD[q] < 130 && oD[q] < bd && oD[q] > lastD + 1) {
              bd = oD[q];
              j = q;
            }
          if (j < 0) break;
          lastD = bd;
          if (v0 < oV[j] - 3) continue;
          tried++;
          const closing = Math.max(v0 - oV[j], 3),
            tReach = Math.max(0, oD[j] - 9) / closing,
            tPass = (oD[j] + 16) / closing;
          const io = (((i0 + Math.round(f + oD[j] / SEG)) % N) + N) % N;
          for (let side = -1; side <= 1; side += 2) {
            if (Math.abs(refS[io] + oOff[j] + side * Wp) > limE) continue; // no room on that side of it
            for (let a = 0; a < 2; a++) {
              tmp.kind = 1;
              tmp.isPass = true;
              tmp.side = side;
              tmp.gT = 1;
              tmp.tOff = oOff[j] + side * Wp;
              tmp.Sg = Sabs;
              tmp.D1 = Math.min(
                Math.max(v0 * tReach * (a ? 0.55 : 1), Math.max(10, 0.4 * v0)),
                Math.max(30, 1.6 * v0),
              );
              tmp.Dh = Math.min(Math.max(v0 * tPass - tmp.D1, 20), Math.max(20, H - tmp.D1 - 25));
              tmp.D2 = Math.max(10, Math.min(Math.max(25, v0), H - tmp.D1 - tmp.Dh));
              setR(tmp, D[a ? 0 : 1]);
              const cost = evalCand(tmp, i0, f, v0, gm, bw);
              if (cost < best) {
                take(tmp, cost);
                switched = true;
              }
            }
          }
        }
      }
    }
    // 3. if none of those can be driven at this speed, try leaning towards either edge (wider or tighter arcs).
    //    This is the big set: all of it at once when a plan first fails, then one side of the road on every other plan.
    if (!bestF && (fresh || wasFeas || (nO ? full : (planN & 1) === 0))) {
      const d1a = Math.max(15, 0.6 * v0),
        d1b = Math.max(30, 1.4 * v0),
        d2a = Math.max(25, v0),
        d2b = Math.max(50, 2.2 * v0);
      const only = fresh || wasFeas ? 0 : (nO ? planN >> 2 : planN >> 1) & 1 ? 1 : -1;
      for (let side = -1; side <= 1; side += 2)
        if (!only || only === side)
          for (let gi = 0; gi < 3; gi++)
            for (let a = 0; a < 2; a++)
              for (let b = 0; b < 2; b++)
                for (let e = 0; e < 2; e++)
                  for (let rr = 1; rr < 3; rr++) {
                    tmp.kind = 0;
                    tmp.isPass = false;
                    tmp.side = 0;
                    tmp.Sg = Sabs;
                    tmp.p = side * limE;
                    tmp.gT = gi === 0 ? 0.3 : gi === 1 ? 0.6 : 1;
                    tmp.D1 = a ? d1b : d1a;
                    tmp.Dh = b ? 50 : 10;
                    tmp.D2 = e ? d2b : d2a;
                    if (tmp.D1 + tmp.Dh + tmp.D2 > H) tmp.D2 = Math.max(10, H - tmp.D1 - tmp.Dh);
                    setR(tmp, D[rr]);
                    const cost = evalCand(tmp, i0, f, v0, gm, bw);
                    if (cost < best) {
                      take(tmp, cost);
                      switched = true;
                    }
                  }
    }
    if (
      switched &&
      have &&
      (bestC.kind !== act.kind ||
        bestC.p !== act.p ||
        bestC.side !== act.side ||
        Math.abs(bestC.gT - act.gT) > 0.2)
    )
      pl.stats.flips++;
    if (switched && bestC.isPass) pl.stats.passes++;
    Object.assign(act, bestC);
    have = true;
    bestCost = best;
    bestFeas = bestF;
    planS = Sabs - f * SEG;
    // what to draw: the path, its speeds, and where it is on the gas / holding / braking / skidding
    const B = Bst,
      z = cur.zone;
    cur.i0 = i0;
    cur.feasible = bestF && !bestOff;
    for (let k = 0; k < n; k++) {
      cur.lat[k] = B.lat[k + 1];
      cur.v[k] = B.vf[k];
    }
    for (let k = 0; k < n - 1; k++) {
      const a = (B.vf[k + 1] * B.vf[k + 1] - B.vf[k] * B.vf[k]) / (2 * B.ds[k]);
      z[k] = a < -3 ? (B.sk[k] > 0.05 ? 3 : 1) : a > 0.4 ? 0 : 2;
    }
    z[n - 1] = z[n - 2];
    tidy(z, n, false);
    const ms = now() - t0;
    pl.stats.calls++;
    pl.stats.ms += ms;
    if (ms > pl.stats.maxMs) pl.stats.maxMs = ms;
    return cur;
  }

  const pl = {
    ready: false,
    cur,
    line: null,
    cfg,
    level,
    name: cfg.name,
    hold: !!cfg.hold,
    stats: { calls: 0, ms: 0, maxMs: 0, flips: 0, passes: 0, buildMs: 0 },
    build(budget) {
      if (pl.ready) return 1;
      if (!gen) gen = builder();
      const t0 = now();
      let r;
      do {
        r = gen.next();
        if (!r.done) prog = r.value;
      } while (!r.done && now() - t0 < budget);
      tBuild += now() - t0;
      pl.stats.buildMs = tBuild;
      return r.done ? 1 : Math.min(0.999, prog);
    },
    // sig identifies what a built line depends on; a line saved from an earlier build with the same sig can be
    // handed back with setLine() to skip the build
    sig: [
      N,
      SEG.toFixed(4),
      cfg.gripMargin,
      cfg.brkMargin,
      cfg.edge,
      cfg.skid,
      cfg.levels.join('.'),
      car.grip.toFixed(3),
      car.acc.toFixed(3),
      car.vmax.toFixed(2),
      car.brk.toFixed(2),
      'b3',
    ].join('|'), // b3: version of the line builder (change it whenever build() would give a different line)
    ctl: null,
    setCtl(c) {
      const M = cfg.levels[cfg.levels.length - 1];
      if (!c || c.length !== M) return false;
      const q = F(),
        sc = M / N;
      for (let j = 0; j < M; j++) if (!(Math.abs(c[j]) <= lim + 1e-3)) return false;
      for (let i = 0; i < N; i++) {
        const x = i * sc,
          j0 = Math.floor(x);
        let v = 0;
        for (let m = -1; m <= 2; m++) v += c[(((j0 + m) % M) + M) % M] * bsp(x - (j0 + m));
        q[i] = v;
      }
      refTime = lapTimeOf(geom.refLat);
      pl.ctl = Float64Array.from(c);
      finish(q);
      return true;
    },
    setLine(lat) {
      if (!lat || lat.length !== N) return false;
      for (let i = 0; i < N; i++) if (!(Math.abs(lat[i]) <= lim + 1e-3)) return false;
      refTime = lapTimeOf(geom.refLat);
      finish(Float64Array.from(lat));
      return true;
    },
    reset() {
      have = false;
      tPlan = 1e9;
      kLast = 0;
    },
    debug() {
      return {
        kind: act.kind,
        isPass: act.isPass,
        side: act.side,
        gT: act.gT,
        tOff: act.tOff,
        cost: bestCost,
        feasible: bestFeas,
        cars: nO,
      };
    },
    plan,
    control(c, obstacles, opts, dt) {
      let dS = c.s - lastS;
      if (dS < -L / 2) dS += L;
      else if (dS > L / 2) dS -= L;
      if (dS > 30 || dS < -30) {
        have = false;
        dS = 0;
      }
      Sabs += dS;
      lastS = c.s;
      tPlan += dt;
      if (!have || tPlan >= 1 / cfg.rate - 1e-6) {
        tPlan = 0;
        plan(c, obstacles, opts);
      }
      // where the car is along the plan
      let x = (Sabs - planS) / SEG;
      if (x < 0) x = 0;
      let k = Math.floor(x);
      if (k > n - 2) k = n - 2;
      const u = x - k;
      const B = Bst,
        latP = B.lat[k + 1] + (B.lat[k + 2] - B.lat[k + 1]) * u,
        qd = B.qd[k] + (B.qd[k + 1] - B.qd[k]) * u,
        kp = B.kap[k] + (B.kap[k + 1] - B.kap[k]) * u;
      const i0 = (cur.i0 + k) % N,
        i1 = (i0 + 1) % N,
        tX = tx[i0] + (tx[i1] - tx[i0]) * u,
        tY = ty[i0] + (ty[i1] - ty[i0]) * u,
        ch = Math.cos(c.h),
        sh = Math.sin(c.h);
      const psi = Math.atan2(tX * sh - tY * ch, tX * ch + tY * sh),
        psiP = Math.atan2(qd, 1 - latP * kc[i0]);
      let kcmd = kp - cfg.kLat * (c.lat - latP) - cfg.kHead * (psi - psiP);
      // auto-brake target: the level's braking envelope a little ahead of the car
      let x2 = x + 2 / SEG,
        k2 = Math.floor(x2);
      if (k2 > n - 2) k2 = n - 2;
      const u2 = x2 - k2;
      const sa = B.vb[k] + (B.vb[k + 1] - B.vb[k]) * u,
        sb = B.vb[k2] + (B.vb[k2 + 1] - B.vb[k2]) * u2,
        safe = sa < sb ? sa : sb;
      out.safe = safe;
      // steering. Up to the tyre limit the car simply turns as asked. At the limit, asking for more only makes the
      // tyres slide, which sheds speed without changing the arc: used when the car is lifted and still too fast
      // (a skid the line counts on, or a rescue), and it happens by itself when the path needs more turn than there is.
      const gm = (c.gm || 1) * (1 - 0.2 * (c.dirt || 0)) * SURF[c.surf || 0],
        km = Math.min((car.grip * gm) / Math.max(c.v * c.v, 4), car.kmax);
      const ak = kcmd < 0 ? -kcmd : kcmd,
        sg = kcmd < 0 ? -1 : 1,
        lifted = !(opts && opts.attack),
        over = c.v - safe - 0.25;
      let s = -1; // skid share to ask for; -1 = steer normally
      if (ak >= 0.985 * km) {
        // the path needs all the turn there is, or more: any shortfall is scrubbed off hard (gas held or not)
        s = (ak / km - 1) * cfg.skidGain;
        if (s < 0) s = 0;
        if (lifted && c.v > 12) s += B.sk[k] + (B.sk[k + 1] - B.sk[k]) * u + (over > 0 ? over : 0);
      } else if (
        lifted &&
        c.v > 12 &&
        ak >= cfg.rescueTurn * km &&
        (over > cfg.rescueOver || (!bestFeas && over > 0.3))
      ) {
        // far too fast for what is coming, and the brakes alone are not enough: turn in at the tyre limit and skid the speed off
        s = over / 1.5;
        if (s < 0.3) s = 0.3;
      }
      if (s >= 0) {
        if (s > 1) s = 1;
        kcmd = sg * km * (1 + s);
        kLast = sg * km;
      } else kLast = kcmd;
      out.k = kcmd;
      return out;
    },
  };
  return pl;
}
