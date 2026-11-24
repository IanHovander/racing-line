import { START, launchGate, lightsOut } from './start';
import { GS } from '../state';
import { crashSnd } from '../audio/audio';
import { cheer } from '../audio/crowd';
import { $, store, wrapA } from '../core/dom';
import { attract, cars, goAt, opts } from '../game/race';
import { netFollow } from '../net/netcode';
import { FW, startFireworks, updateRain } from '../render/effects';
import { STEP, controlAI, pursuitLat } from './ai';
import { locate, physics, towTarget } from './physics';
import { controlPlayer } from './player';
import { PASS_TUNE } from './pass';
import { progress, secDone, statTick, tpRec } from './timing';
import { NEUTRAL } from '../teams/team-stats';
import { parts, skids } from '../track/active';
import { cornerAt, hAt } from '../track/track';
import { rcBanner, showToast, swapCar } from '../ui/controls';
import { coach, lapCard } from '../ui/feedback';
import { NCOL, PRI, notify } from '../ui/notify';
import { fmt, updateLights } from '../ui/hud';
import { resRender, showResults } from '../ui/results';
export function collide() {
  for (let i = 0; i < cars.length; i++)
    for (let j = i + 1; j < cars.length; j++) {
      const A = cars[i],
        B = cars[j];
      if (
        A.gone ||
        B.gone ||
        A.ghost > 0 ||
        B.ghost > 0 ||
        (A.remote && B.remote) ||
        (A.x - B.x) ** 2 + (A.y - B.y) ** 2 > 64 ||
        Math.abs((A.hz || 0) - (B.hz || 0)) > 3
      )
        continue;
      const net = A.remote || B.remote;
      const wA = A.remote ? 0 : B.remote ? 1 : 1,
        wB = B.remote ? 0 : A.remote ? 1 : 1;
      for (const fa of [1.6, -1.6])
        for (const fb of [1.6, -1.6]) {
          const ax = A.x + Math.cos(A.h) * fa,
            ay = A.y + Math.sin(A.h) * fa,
            bx = B.x + Math.cos(B.h) * fb,
            by = B.y + Math.sin(B.h) * fb;
          let dx = bx - ax,
            dy = by - ay,
            d = Math.hypot(dx, dy);
          if (d >= 1.9 || d < 1e-4) continue;
          const nX = dx / d,
            nY = dy / d,
            ov = 1.9 - d;
          A.bumpT = B.bumpT = GS.raceTime;
          A.x -= ((nX * ov) / 2) * wA;
          A.y -= ((nY * ov) / 2) * wA;
          B.x += ((nX * ov) / 2) * wB;
          B.y += ((nY * ov) / 2) * wB;
          // side contact: steer the two cars slightly apart so they don't keep grinding together
          {
            const sa = Math.sign(-Math.sin(A.h) * nX + Math.cos(A.h) * nY),
              sb = Math.sign(Math.sin(B.h) * nX - Math.cos(B.h) * nY);
            if (A.v > 3) A.h = wrapA(A.h - sa * 0.025 * wA);
            if (B.v > 3) B.h = wrapA(B.h - sb * 0.025 * wB);
            if (wA && !A.remote) A.lane += -sa * 0.05;
            if (wB && !B.remote) B.lane += -sb * 0.05;
          }
          const vax = Math.cos(A.h) * A.v,
            vay = Math.sin(A.h) * A.v,
            vbx = Math.cos(B.h) * B.v,
            vby = Math.sin(B.h) * B.v;
          const rel = (vbx - vax) * nX + (vby - vay) * nY;
          if (rel < 0) {
            if (-rel > 5) {
              if (!net) GS.HITS++;
              A.hits = (A.hits || 0) + 1;
              B.hits = (B.hits || 0) + 1;
            }
            const jj = -rel * (net ? 0.3 : 0.55);
            const nax = vax - nX * jj * wA,
              nay = vay - nY * jj * wA,
              nbx = vbx + nX * jj * wB,
              nby = vby + nY * jj * wB;
            if (wA) A.v = Math.max(0, nax * Math.cos(A.h) + nay * Math.sin(A.h));
            if (wB) B.v = Math.max(0, nbx * Math.cos(B.h) + nby * Math.sin(B.h));
            if (-rel > 2) {
              crashSnd(-rel, ax, ay);
              if (-rel > 5 && !net) {
                hurt(A, -rel, true);
                hurt(B, -rel, true);
              }
            }
            if (-rel > 2)
              for (let q = 0; q < 4; q++) spawn(ax + dx / 2, ay + dy / 2, 0.5, '#ffd27a', 0.35, 6);
          }
        }
    }
}
export function spawn(x, y, z, col, life, sp) {
  if (parts.length > 400) return;
  z += hAt(x, y);
  const a = Math.random() * Math.PI * 2,
    s = Math.random() * sp;
  parts.push({
    x,
    y,
    z,
    vx: Math.cos(a) * s,
    vy: Math.sin(a) * s,
    vz: 1 + Math.random() * 2,
    life,
    max: life,
    col,
    r: 0.3 + Math.random() * 0.5,
  });
}
/**
 * Catch-up grip (Rules: Catch-up Grip, opts.cgrip 0 off, 1 normal, up to 5): a car behind the leader gets up to
 * `grip` more grip at Normal, rising evenly with the distance behind until `full` metres (about 13–15 s).
 */
export const CATCHUP = { grip: 0.05, full: 1000 };
export function step(dt) {
  if (GS.state === 'countdown') {
    GS.cdT += dt;
    if (GS.cdT >= goAt) {
      GS.state = 'race';
      notify('Go!', NCOL.good, { ttl: 1.5, pri: PRI.start });
      cheer(0.8);
    }
    updateLights();
    return;
  }
  if (GS.state === 'race' || GS.state === 'finished' || GS.state === 'menu') GS.raceTime += dt;
  if (GS.state === 'race' && !START.done) {
    START.done = true;
    lightsOut();
  }
  if (opts.rain) updateRain(dt);
  for (const c of cars) {
    let tt = opts.tow ? towTarget(c) : 0;
    if (c.sling > 0) {
      // a charged pass (sim/pass.ts): the slipstream's pull lasts a moment after pulling out of it
      c.sling -= dt;
      tt = Math.max(tt, PASS_TUNE.sling);
    }
    c.tow += (tt - c.tow) * Math.min(1, dt * (tt > c.tow ? 3 : 6));
  }
  // catch-up grip: how far the leader is round the race, to give the cars behind more grip
  let lead = 0;
  const cg = GS.state === 'race' && !GS.PRACTICE ? opts.cgrip || 0 : 0;
  if (cg) for (const c of cars) if (!c.out && !c.gone) lead = Math.max(lead, progress(c));
  cars.forEach((c, i) => {
    let u;
    if (c.gone) return;
    if (c.remote) {
      netFollow(c, dt);
      if (c.out) {
        c.outT += dt;
        if (c.outT > clearTime()) c.gone = true;
      }
      return;
    }
    // grip: less with damage, more the further behind the leader (everything that judges speed reads c.gm)
    c.gm =
      (1 - 0.15 * c.dmg) *
      (1 + (cg ? cg * CATCHUP.grip * Math.min(1, Math.max(0, lead - progress(c)) / CATCHUP.full) : 0));
    if (c.out) {
      u = [
        0,
        c.v > 25 ? 0.35 : 0.8,
        pursuitLat(
          c,
          c.outSide *
            Math.min(GS.HW + (GS.TR.street ? 0.6 : 3.5), (c.outSide > 0 ? GS.BARR : GS.BARL)[c.idx] - 0.9),
        ),
      ];
      c.outT += dt;
      if (c.outT > clearTime()) {
        c.gone = true;
        showToast(c.name + "'s car has been cleared");
      }
      if (Math.random() < 0.35)
        spawn(c.x + (Math.random() - 0.5), c.y + (Math.random() - 0.5), 1, 'rgba(60,60,60,1)', 2.2, 0.8);
    } else if (!attract && i === GS.ctrl && !c.finished) u = controlPlayer(c, dt);
    else u = controlAI(c, dt, c.finished ? 0.72 : c.skill);
    // timing-based start: hold on the grid until the driver reacts to lights out
    if (GS.state === 'race' && !c.out && !launchGate(c, !attract && i === GS.ctrl && !c.finished))
      u = [0, 1, u[2]];
    physics(c, dt, u[0], u[1], u[2]);
    if (opts.rain && c.v > 22 && Math.random() < c.v / 450) {
      spawn(
        c.x - Math.cos(c.h) * 2.6 + (Math.random() - 0.5) * 1.6,
        c.y - Math.sin(c.h) * 2.6 + (Math.random() - 0.5) * 1.6,
        0.4,
        'rgba(225,230,238,1)',
        0.45,
        2,
      );
      const q = parts[parts.length - 1];
      if (q) q.spray = 1;
    }
    if (c.dmg > 0.55 && !c.out && Math.random() < c.dmg * 0.25)
      spawn(c.x - Math.cos(c.h) * 1.5, c.y - Math.sin(c.h) * 1.5, 0.8, 'rgba(90,90,90,1)', 1.2, 0.6);
    if (c.ghost > 0) c.ghost -= dt;
    if (GS.state === 'race' && !c.out && c.v < 4 && u[0] > 0.05) {
      c.stuckT = (c.stuckT || 0) + dt;
      if (c.stuckT > 1.6) {
        c.ghost = 3;
        c.stuckT = 0;
        c.ghosts = (c.ghosts || 0) + 1;
      }
    } else c.stuckT = Math.max(0, (c.stuckT || 0) - dt);
  });
  collide();
  statTick(dt);
  for (const c of cars) {
    if (c.gone) continue;
    locate(c);
    tpRec(c);
    if (!attract && GS.state === 'race' && c === cars[GS.ctrl] && !c.finished && !c.out) coach(c, dt);
    if (c.remote) {
      c.prevS = c.s;
      continue;
    }
    const lim = (c.lat > 0 ? GS.BARR : GS.BARL)[c.idx];
    if (Math.abs(c.lat) > lim) {
      const sg = Math.sign(c.lat),
        ex = c.lat - sg * lim;
      c.x -= GS.nx[c.idx] * ex;
      c.y -= GS.ny[c.idx] * ex;
      const ta = Math.atan2(GS.ty[c.idx], GS.tx[c.idx]);
      const rel = wrapA(c.h - ta);
      const sn = Math.abs(Math.sin(rel)),
        vn = c.v * sn;
      if (vn > 2.5) {
        crashSnd(vn * 1.6, c.x, c.y);
        hurt(c, vn);
        for (let q = 0; q < Math.min(8, 2 + vn / 3); q++) spawn(c.x, c.y, 0.5, '#ffd27a', 0.4, 8);
      } else if (c.v > 15 && Math.random() < 0.4) spawn(c.x, c.y, 0.4, '#ffd27a', 0.25, 4);
      if (Math.abs(rel) < Math.PI / 2) {
        c.v = Math.max(0, c.v * (Math.cos(rel) - 1.5 * sn) - 55 * STEP);
        if (vn > 9) c.v *= 0.35;
        if (Math.sign(rel) === sg) c.h = wrapA(ta - sg * 0.02);
      } else {
        c.v *= 0.4;
        c.h = wrapA(ta + wrapA(c.h - ta) * 0.3);
      }
      c.lat = sg * lim;
    }
    // DRS: within 1 s of the car ahead at the detection point lets you open the rear wing in the next zone (not on lap 1, not under yellow)
    if (opts.drs && GS.DRSZ.length) {
      const zi = GS.DRSMAP[c.idx];
      for (let k = 0; k < GS.DRSZ.length; k++) {
        const dd = GS.DRSZ[k].det;
        let a = c.prevS / GS.SEG,
          b = c.s / GS.SEG;
        if (a <= dd && b > dd && b - a < 40) {
          c.drsEl = -1;
          if (c.cross >= 2 && !inYellow(c) && !opts.rain) {
            let best = 1e9;
            for (const o of cars) {
              if (o === c || o.gone || o.out) continue;
              let d = o.s - c.s;
              if (d < -GS.L / 2) d += GS.L;
              else if (d > GS.L / 2) d -= GS.L;
              if (d > 0 && d < best) best = d;
            }
            if (best / Math.max(c.v, 10) < 1.0) c.drsEl = k;
          }
          if (c === cars[GS.ctrl] && !attract && c.drsEl === k)
            notify('DRS enabled', NCOL.good, { ttl: 2, pri: PRI.drs });
        }
      }
      if (zi < 0 || zi !== c.drsEl) c.drs = false;
      else {
        const auto = !(c === cars[GS.ctrl] && !attract && opts.drs === 1);
        if (auto && !c.drs && c.thr > 0.5 && c.brk < 0.05) c.drs = true;
      }
      if (c.drs && c.brk > 0.05) {
        c.drs = false;
        c.drsEl = -1;
      }
    } else c.drs = false;
    // track limits: all four wheels past the white line is an offence; every Nth offence costs 5 s
    if (opts.limits && !c.finished && c.cross >= 1 && !GS.TR.street && !c.out) {
      const outL = Math.abs(c.lat) > GS.HW + 1.3;
      if (outL && !c.tlOut && GS.raceTime - (c.bumpT ?? -99) < 3) {
        c.tlOut = true;
        if (!attract && c === cars[GS.ctrl])
          notify('Forced off after contact', NCOL.warn, {
            sub: 'No track-limits strike',
            key: 'rc',
            pri: PRI.warn,
          });
      }
      if (outL && !c.tlOut) {
        c.tlN = (c.tlN || 0) + 1;
        const ca = cornerAt(c.idx),
          me = !attract && c === cars[GS.ctrl];
        if (GS.PRACTICE) {
          if (me) rcBanner('warn', 'Track limits' + (ca ? ' at ' + ca : ''), 'Practice · no penalty');
        } else if (c.tlN % opts.limits === 0) {
          c.pen = (c.pen || 0) + 5;
          if (me)
            rcBanner(
              'pen',
              '<span class="m">+5</span>&#8239;s Track limits' + (ca ? ' at ' + ca : ''),
              'Time penalty · offence ' + c.tlN,
            );
        } else if (me) {
          const w = c.tlN % opts.limits,
            of = opts.limits - 1;
          rcBanner(
            'warn',
            'Track limits' + (ca ? ' at ' + ca : ''),
            'Warning ' + w + ' of ' + of + (w === of ? ' · next one is +5 s' : ''),
          );
        }
      }
      c.tlOut = outL;
    }
    // sectors
    if (!attract && c.cross >= 1 && !c.finished && c.secCur)
      for (let k = 1; k < 3; k++) {
        const b = GS.SECB[k];
        if (c.prevS < b && c.s >= b && c.s - c.prevS < 80) secDone(c, k - 1);
      }
    // laps
    if (c.prevS > GS.L - 80 && c.s < 80) {
      if (c.cross >= 1 && !c.finished && c.secCur) secDone(c, 2);
      c.cross++;
      c.secT = GS.raceTime;
      c.secCur = [];
      if (c.cross >= 2) {
        const lt = GS.raceTime - c.lapStart;
        c.last = lt;
        if (!c.best || lt < c.best) c.best = lt;
        if (c.mine) {
          const k = 'best_' + GS.TR.id,
            pb = store.get(k, 0);
          if (!pb || lt < pb) {
            store.set(k, lt);
            if (pb)
              notify('New circuit record <span class="m">' + fmt(lt) + '</span>', NCOL.best, {
                pri: PRI.record,
              });
          }
        }
      }
      if (!attract && c === cars[GS.ctrl] && c.cross >= 2) lapCard(c);
      c.lapStart = GS.raceTime;
      if (!attract && (c === cars[GS.ctrl] || c === cars[GS.mateIdx]))
        cheer(c.cross - 1 >= opts.laps ? 1 : 0.45);
      if (!attract && !GS.PRACTICE && !c.finished && c.cross - 1 >= opts.laps) {
        c.finished = true;
        c.ftime = GS.raceTime;
        c.place = ++GS.finishOrder;
      }
    } else if (c.prevS < 80 && c.s > GS.L - 80) c.cross--;
    c.prevS = c.s;
    // effects
    if (c.v > 12 && (c.slide > 0.2 || (c.brk > 0.95 && c.v > 55 && c.surf === 0 && Math.random() < 0.15))) {
      const ch = Math.cos(c.h),
        sh = Math.sin(c.h);
      for (let w = 0; w < 2; w++) {
        const ry2 = w ? 0.9 : -0.9;
        const px = c.x - ch * 1.5 - sh * ry2,
          py = c.y - sh * 1.5 + ch * ry2;
        const p = c.sk[w];
        if (p && Math.hypot(px - p[0], py - p[1]) < 4) skids.push([p[0], p[1], px, py, c.hz || 0]);
        c.sk[w] = [px, py];
      }
      if (skids.length > 1800) skids.splice(0, 200);
      if (Math.random() < c.slide * 0.6)
        spawn(c.x - Math.cos(c.h) * 2, c.y - Math.sin(c.h) * 2, 0.4, 'rgba(230,230,230,1)', 0.8, 1.5);
    } else {
      c.sk[0] = c.sk[1] = null;
    }
    if (c.surf === 3 && c.v > 4)
      for (let q = 0; q < 2; q++)
        spawn(
          c.x - Math.cos(c.h) * 2.2,
          c.y - Math.sin(c.h) * 2.2,
          0.3,
          q ? 'rgba(214,190,140,1)' : 'rgba(120,105,80,1)',
          1.1,
          4,
        );
    if (c.surf === 2 && c.v > 8 && Math.random() < 0.5)
      spawn(c.x - Math.cos(c.h) * 2.2, c.y - Math.sin(c.h) * 2.2, 0.3, 'rgba(150,120,70,1)', 0.9, 2);
  }
  for (let i = parts.length - 1; i >= 0; i--) {
    const p = parts[i];
    p.life -= dt;
    if (p.life <= 0) {
      parts.splice(i, 1);
      continue;
    }
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.z += p.vz * dt;
    p.r += dt * (p.spray ? 0.7 : 1.2);
  }
  if (!attract && !FW.on && cars[GS.ctrl] && cars[GS.ctrl].finished) startFireworks();
  if (!attract && GS.finishTimer < 0 && GS.state === 'race') {
    const mine = cars.filter(c => c.mine);
    if (mine.every(c => c.finished || c.out) || cars[GS.ctrl].finished) GS.finishTimer = c_done(mine);
  }
  if (!attract && GS.state === 'race') yellowPolice(dt);
  if (GS.finishTimer > 0) {
    GS.finishTimer -= dt;
    if (GS.finishTimer <= 0) showResults();
  }
  if (GS.state === 'finished' && !attract) {
    GS.RES_T -= dt;
    if (GS.RES_T <= 0) {
      GS.RES_T = 0.5;
      if (!$('results').classList.contains('hide')) resRender();
    }
  }
  if (attract && GS.raceTime > 1e4) GS.raceTime = 0;
}
export function standings() {
  return cars.slice().sort((a, b) => {
    if (a.out !== b.out) return a.out ? 1 : -1;
    if (a.finished && b.finished) return a.ftime + a.pen - (b.ftime + b.pen) || a.place - b.place;
    if (a.finished) return -1;
    if (b.finished) return 1;
    return progress(b) - progress(a);
  });
}
export const c_done = mine => (mine.some(c => c.finished) ? 2.5 : 3.5);
export const clearTime = () => opts.yellow || 3;
// damage from impacts; a hard enough hit, or too much damage, knocks the car out
export function hurt(c, imp, car?) {
  if (attract || c.out || c.remote || (GS.state !== 'race' && GS.state !== 'finished')) return;
  if (!opts.damage) return;
  if (imp > 3) c.dmg = Math.min(1, c.dmg + (imp - 3) * (car ? 0.008 : 0.012) * (c.st || NEUTRAL).dur);
  if (imp > (car ? 34 : 27) || c.dmg >= 1) knockOut(c);
}
export function knockOut(c) {
  if (c.out) return;
  c.out = true;
  c.outT = 0;
  c.dmg = 1;
  c.outSide = c.lat >= 0 ? 1 : -1;
  for (let q = 0; q < 14; q++) spawn(c.x, c.y, 0.8, q % 2 ? '#ffd27a' : 'rgba(70,70,70,1)', 1, 6);
  {
    const ca = cornerAt(c.idx);
    notify(c.name + ' is out' + (ca ? ' at ' + ca : ''), NCOL.bad, {
      sub: opts.yellow ? 'Yellow flag · no overtaking' : undefined,
      pri: PRI.out,
    });
  }
  const me = cars[GS.ctrl];
  if (c === me && GS.mateIdx >= 0 && !cars[GS.mateIdx].out && !cars[GS.mateIdx].finished) {
    setTimeout(() => {
      if (cars[GS.ctrl] === c) {
        swapCar();
        showToast(c.name + ' is out — now driving ' + cars[GS.ctrl].name);
      }
    }, 1400);
  }
}
// local yellow: from 160 m before the wreck to 25 m past it
export function inYellow(c) {
  if (!opts.yellow || attract) return false;
  for (const o of cars) {
    if (!o.out || o.gone || o === c) continue;
    let d = o.s - c.s;
    if (d < -GS.L / 2) d += GS.L;
    else if (d > GS.L / 2) d -= GS.L;
    if (d > -25 && d < 160) return true;
  }
  return false;
}
// overtaking under yellow costs the player's team 5 s
export function yellowPolice(dt) {
  for (const c of cars) {
    if (!c.mine || c.out || c.gone || c.finished) continue;
    const yz = inYellow(c);
    if (!yz) {
      c.yel = null;
      continue;
    }
    const pc = progress(c);
    const now = {};
    for (const o of cars) {
      if (o === c || o.out || o.gone) continue;
      if (inYellow(o) || Math.abs(progress(o) - pc) < 40) now[o.number] = progress(o) - pc;
    }
    if (c.yel) {
      for (const k in now) {
        if (c.yel[k] !== undefined && c.yel[k] > 0 && now[k] < 0) {
          c.pen += 5;
          rcBanner('pen', '<span class="m">+5</span>&#8239;s Overtaking under yellow', 'Time penalty');
          cheer(0.15);
        }
      }
    }
    c.yel = now;
  }
}
