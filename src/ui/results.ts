import { GS } from '../state';
import { $ } from '../core/dom';
import { cars, opts } from '../game/race';
import { standings } from '../sim/step';
import { gapT, progress } from '../sim/timing';
import { TEAMS, flag, teamLogo } from '../teams/teams';
import { fmt } from './hud';
export function awardsHtml() {
  const live = cars.filter(c => c.stat && !c.gone || c.stat && c.finished);
  const all = cars.filter(c => c.stat);
  if (!all.length)
    return '';
  const kmh = v => Math.round(v * 3.6);
  const best = (f, lowest?): [
    any,
    number
  ] | null => { let w = null, bv = null; for (const c of all) {
    const v = f(c);
    if (v === null || v === undefined || !isFinite(v))
      continue;
    if (bv === null || (lowest ? v < bv : v > bv)) {
      bv = v;
      w = c;
    }
  } return w ? [w, bv] : null; };
  const fin = all.filter(c => c.finished);
  const A: [
    string,
    [
      any,
      number
    ] | null,
    (v: number) => string
  ][] = [['Fastest lap', best(c => c.best || null, true), v => fmt(v)], ['Top speed', best(c => c.stat.vmax), v => kmh(v) + ' km/h'], ['Most overtakes', best(c => c.stat.pass || null), v => v + ' pass' + (v > 1 ? 'es' : '')],
    ['Places gained', best(c => c.out ? null : ((c.grid ?? 0) - standings().indexOf(c)) || null), v => (v > 0 ? '▲' : '▼') + Math.abs(v)], ['Time in the lead', best(c => c.stat.ledT > 1 ? c.stat.ledT : null), v => Math.round(v) + ' s'],
    ['Cleanest race', best(c => c.out ? null : c.stat.offT + (c.tlN || 0) * 2 + (c.hits || 0), true), () => 'fewest offs and contacts'], ['Slipstream king', best(c => c.stat.towT > 2 ? c.stat.towT : null), v => Math.round(v) + ' s in the tow'],
    ['DRS hunter', best(c => c.stat.drsN || null), v => v + ' DRS run' + (v > 1 ? 's' : '')], ['Most contacts', best(c => c.hits || null), v => v + ' hit' + (v > 1 ? 's' : '')]];
  let h = '';
  for (const [k, r, f] of A) {
    if (!r)
      continue;
    const [c, v] = r;
    if (k === 'Places gained' && v <= 0)
      continue;
    h += `<div class="aw ${c.mine ? 'me' : ''}"><div class="k">${k}</div><b>${teamLogo(c.team, 14)}${c.name}</b><span class="v">${f(v)}</span></div>`;
  }
  return h;
}
export function runStr(o, st) { const lead = st[0]; if (o === lead)
  return 'Lap ' + Math.min(opts.laps, Math.max(1, o.cross)) + '/' + opts.laps; const d = progress(lead) - progress(o); if (d > GS.L)
  return '+' + Math.floor(d / GS.L) + ' lap' + (d >= 2 * GS.L ? 's' : '') + ' · running'; const g = gapT(lead, o); return (g !== null ? '+' + g.toFixed(1) + ' s' : '') + ' · running'; }
export function resRender() {
  const st = standings();
  const c = cars[GS.ctrl];
  const pos = st.indexOf(c) + 1;
  const best = Math.min(...cars.filter(o => o.mine).map(o => o.out ? 99 : st.indexOf(o) + 1));
  const bc = cars.filter(o => o.mine && !o.out).sort((a, b) => st.indexOf(a) - st.indexOf(b))[0];
  const g0 = bc ? (bc.grid + 1) - (st.indexOf(bc) + 1) : 0;
  $('resTitle').textContent = (best === 99 ? 'Both cars out — DNF' : best === 1 ? '🏆 Victory! P1' : 'Best finish P' + best) + (bc ? (g0 > 0 ? ' (▲' + g0 + ' from P' + (bc.grid + 1) + ')' : g0 < 0 ? ' (▼' + (-g0) + ' from P' + (bc.grid + 1) + ')' : ' (held P' + (bc.grid + 1) + ')') : '') + ' · ' + GS.TR.name;
  let h = '<tr><td>#</td><td title="Places gained or lost from the grid">+/−</td><td>Driver</td><td>Team</td><td>Time</td><td>Best</td></tr>';
  st.forEach((o, i) => { const gd = (o.grid ?? i) - i; const gs = gd > 0 ? `<b style="color:#2ecc71">▲${gd}</b>` : gd < 0 ? `<b style="color:#ff6b5e">▼${-gd}</b>` : '<span style="opacity:.5">–</span>'; h += `<tr class="${o.mine ? 'me' : ''}"><td>${i + 1}</td><td style="white-space:nowrap" title="Started P${(o.grid ?? i) + 1}">${gs}</td><td>${flag(o.nat, 11)} ${o.name}</td><td style="opacity:.85;white-space:nowrap">${teamLogo(o.team, 16)} ${TEAMS[o.team].name}</td><td>${o.out ? '<b style="color:#ff6b5e">DNF</b>' : o.finished ? fmt(o.ftime + o.pen) + (o.pen ? ` <small>(+${o.pen}s)</small>` : '') : 'running'}</td><td>${fmt(o.best)}</td></tr>`; });
  const aw = awardsHtml();
  if ($('resAw')._h !== aw) {
    $('resAw')._h = aw;
    $('resAw').innerHTML = aw;
  }
  const nh = h;
  if ($('resTable')._h !== nh) {
    $('resTable')._h = nh;
    $('resTable').innerHTML = nh;
  }
}
export function showResults() { GS.state = 'finished'; resRender(); $('results').classList.remove('hide'); }
