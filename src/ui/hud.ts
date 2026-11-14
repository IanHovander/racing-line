import { startHint } from '../sim/start';
import { GS } from '../state';
import { $, clamp } from '../core/dom';
import { attract, cars, goAt, opts } from '../game/race';
import { mpOn } from '../net/multiplayer';
import { GEARTOP, autoGear, isManual } from '../sim/car-model';
import { inYellow, standings } from '../sim/step';
import { gapT, progress } from '../sim/timing';
import { teamLogo } from '../teams/teams';
import { cornerAt } from '../track/track';
// ================= HUD =================
export const fmt = t => {
  if (!t) return '—';
  const m = Math.floor(t / 60),
    s = t - m * 60;
  return m + ':' + (s < 10 ? '0' : '') + s.toFixed(3);
};
export let hudT = 0;
/** cached HUD values so the DOM is only touched when something changes */
const HUD: {
  spd?: string;
  gr?: any;
  rows?: Map<number, HTMLElement>;
  rowsInit?: number;
} = {};
export function hud(dt) {
  hudT -= dt;
  if (hudT > 0 || attract) return;
  hudT = 0.1;
  const c = cars[GS.ctrl];
  const st = standings();
  {
    // current lap bright, the rest ("LAP", "/", total) faded
    const h = GS.PRACTICE
      ? `<i>PRACTICE · LAP</i> ${Math.max(1, c.cross)}`
      : `<i>LAP</i> ${clamp(c.cross, 1, opts.laps)}<i>/${opts.laps}</i>` + (c.finished ? ' ✓' : '');
    const el = $('hLap') as HTMLElement & { _h?: string };
    if (el._h !== h) {
      el._h = h;
      el.innerHTML = h;
    }
  }
  {
    // no race clock in the panel; only "Get ready…" before the start
    const t = GS.state === 'countdown' ? 'Get ready…' : '';
    if ($('hTime').textContent !== t) $('hTime').textContent = t;
  }
  const kmh = Math.round(c.v * 3.6);
  const gear = isManual(c) ? c.gear : c.v < 1 ? 'N' : autoGear(c.v);
  {
    const el = $('drsI'),
      pd = $('pDRS');
    if (!opts.drs) {
      if (el.className !== 'off') el.className = 'off';
    } else {
      const inZ = GS.DRSMAP[c.idx] >= 0,
        el2 = c.drsEl >= 0 && (inZ ? GS.DRSMAP[c.idx] === c.drsEl : true);
      const cl = c.drs ? 'open' : el2 && c.drsEl >= 0 ? 'ready' : '';
      if (el.className !== cl) el.className = cl;
      pd.classList.toggle('ready', !c.drs && inZ && c.drsEl === GS.DRSMAP[c.idx]);
    }
  }
  {
    const man = isManual(c);
    const rv = $('revs');
    {
      const gg = man ? c.gear : autoGear(c.v);
      const lo = gg > 1 ? GEARTOP[gg - 1] * 0.97 * 0.9 : 0;
      const r = man
        ? c.v / GEARTOP[c.gear]
        : 0.5 + 0.47 * clamp((c.v - lo) / (GEARTOP[gg] * 0.97 - lo), 0, 1);
      const NL = rv.children.length;
      const n = clamp(Math.round(((r - 0.5) / 0.45) * NL), 0, NL);
      const fl = man && r >= 0.97 && c.gear < 8;
      rv.classList.toggle('flash', fl && Math.floor(performance.now() / 90) % 2 === 0);
      ([...rv.children] as HTMLElement[]).forEach((b, k) => {
        const cl = k < n ? (k < NL * 0.4 ? 'g' : k < NL * 0.7 ? 'r' : 'u') : '';
        if (b.className !== cl) b.className = cl;
      });
    }
  }
  {
    const th = Math.round(clamp(c.thr || 0, 0, 1) * 100) + '%',
      bk = Math.round(clamp(c.brk || 0, 0, 1) * 100) + '%';
    if ($('gThr').style.width !== th) $('gThr').style.width = th;
    if ($('gBrk').style.width !== bk) $('gBrk').style.width = bk;
  }
  {
    const h = String(kmh).padStart(3, ' ');
    if (HUD.spd !== h) {
      HUD.spd = h;
      $('hSpd').textContent = h;
    }
    if (HUD.gr !== gear) {
      HUD.gr = gear;
      $('hGear').textContent = gear;
    }
  }
  {
    $('tow').style.visibility = opts.tow ? '' : 'hidden';
    const ch = $('tow').children;
    for (let k = 0; k < 4; k++) {
      const on = c.tow > 0.12 + k * 0.2;
      if (ch[k].classList.contains('on') !== on) ch[k].classList.toggle('on', on);
    }
  }
  {
    let h = '';
    const bar = (v, col) =>
      `<span class="b"><i style="width:${Math.round(v * 100)}%;background:${col}"></i></span>`;
    if (opts.tyres)
      h +=
        'Tyres' +
        bar(c.tyre, c.tyre > 0.5 ? '#5ad16b' : c.tyre > 0.25 ? '#ffc23d' : '#ff4b3e') +
        Math.round(c.tyre * 100) +
        '% ';
    if (opts.damage)
      h +=
        ' Dmg' +
        bar(c.dmg, c.dmg < 0.35 ? '#5ad16b' : c.dmg < 0.7 ? '#ffc23d' : '#ff4b3e') +
        Math.round(c.dmg * 100) +
        '%';
    $('cond').innerHTML = h;
  }
  $('yflag').classList.toggle('hide', !inYellow(c) || c.out);
  if (inYellow(c)) {
    const w = cars.find(o => o.out && !o.gone);
    const ca = w ? cornerAt(w.idx) : '';
    const yt = '⚑ YELLOW FLAG' + (ca ? ' at ' + ca : '') + ' — slow down, no overtaking';
    if ($('yflag').textContent !== yt) $('yflag').textContent = yt;
  }
  {
    const t =
      c.lock > 0.5
        ? 'LOCK-UP'
        : c.surf === 3
          ? 'GRAVEL!'
          : c.surf === 5
            ? 'SLICK PAINT'
            : c.surf === 2
              ? 'OFF TRACK'
              : c.slide > 0.3
                ? 'SLIDING'
                : '';
    if ($('hMode').textContent !== t) $('hMode').textContent = t;
    $('hMode').style.visibility = t ? 'visible' : 'hidden';
  }
  const lead = st[0];
  const bd = $('board');
  const rows = HUD.rows || (HUD.rows = new Map());
  const now = performance.now();
  const old = new Map();
  for (const [k, el] of rows) if (el.parentNode === bd) old.set(k, el.getBoundingClientRect().top);
  if (!HUD.rowsInit) {
    bd.innerHTML = '';
    HUD.rowsInit = 1;
  }
  st.forEach((o, i) => {
    const cls = o === c ? 'me' : o === cars[GS.mateIdx] ? 'mate' : o.human && mpOn() ? 'hum' : '';
    let gap = '';
    if (i > 0) {
      if (o.finished && lead.finished) gap = '+' + (o.ftime - lead.ftime).toFixed(1);
      else {
        const d = progress(lead) - progress(o);
        const gt = gapT(lead, o);
        gap =
          d > GS.L
            ? '+' + Math.floor(d / GS.L) + 'L'
            : '+' + (gt !== null ? gt : d / Math.max(lead.v, 30)).toFixed(1);
      }
    }
    if (o.out) gap = '<b style="color:#ff6b5e">OUT</b>';
    const ln =
      (o.name.split(' ').pop() || o.name)
        .replace(/[^A-Za-zÀ-ÿ]/g, '')
        .slice(0, 3)
        .toUpperCase() || o.name.slice(0, 3).toUpperCase();
    // places gained/lost: shown briefly in the gap column for your two cars
    if (o.lastPos !== undefined && o.lastPos !== i && GS.state === 'race' && o.mine)
      o.posChg = { d: o.lastPos - i, t: now };
    o.lastPos = i;
    let g = i ? gap : 'LEAD';
    if (o.posChg && now - o.posChg.t < 2600 && !o.out) {
      const d = o.posChg.d;
      g = `<b class="${d > 0 ? 'pu' : 'pd'}">${d > 0 ? '▲' : '▼'}${Math.abs(d)}</b>`;
    }
    const k = cars.indexOf(o);
    let el = rows.get(k);
    if (!el) {
      el = document.createElement('div');
      rows.set(k, el);
    }
    const h = `<span class="pos">${i + 1}</span>${teamLogo(o.team, 12)}<span class="nm">${ln}</span><span class="gap">${g}</span>${o.pen && !o.out ? `<span class="pb">+${o.pen}</span>` : ''}`;
    if (el._h !== h) {
      el._h = h;
      el.innerHTML = h;
    }
    if (el.className !== cls) el.className = cls;
    bd.appendChild(el);
  });
  for (const [k, el] of rows)
    if (!st.includes(cars[k])) {
      el.remove();
      rows.delete(k);
    }
  // slide rows to their new places (FLIP)
  for (const [k, el] of rows) {
    const t0 = old.get(k);
    if (t0 === undefined) continue;
    const dy = t0 - el.getBoundingClientRect().top;
    if (Math.abs(dy) < 1) continue;
    el.style.transition = 'none';
    el.style.transform = `translateY(${dy}px)`;
    el.style.zIndex = el.classList.contains('me') ? 3 : 2;
    void el.offsetHeight;
    el.style.transition = 'transform .45s cubic-bezier(.3,.7,.3,1)';
    el.style.transform = '';
    clearTimeout(el._zt);
    el._zt = setTimeout(() => {
      el.style.zIndex = '';
    }, 480);
  }
}
export function updateLights() {
  const sh = $('startHint');
  if (sh) {
    const on = GS.state === 'countdown' && !attract && GS.cdT > 0.5;
    sh.style.display = on ? 'block' : 'none';
    if (on) sh.textContent = startHint();
  }
  const el = $('lights');
  const n = Math.min(5, Math.floor(GS.cdT));
  el.style.display = GS.state === 'countdown' ? 'flex' : 'none';
  ([...el.children] as HTMLElement[]).forEach((d, i) => d.classList.toggle('on', i < n && GS.cdT < goAt));
}
/** debug/test hook: reassign a module-level binding */
export function __set(name: string, v: any): void {
  switch (name) {
    case 'hudT':
      hudT = v;
      break;
  }
}
