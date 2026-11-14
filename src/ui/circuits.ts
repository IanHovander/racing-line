// ---- circuit icons: country colours + a cultural motif (all drawn here, 40x40) ----
export const CIRCUIT_ICON = {
  mexico: `<rect width="40" height="40" fill="#fff"/><rect width="13.4" height="40" fill="#006847"/><rect x="26.6" width="13.4" height="40" fill="#ce1126"/>
 <path d="M10 31h20v-3h-2.5v-3h-2.5v-3h-2.5v-3h-5v3h-2.5v3h-2.5v3h-2.5z" fill="#b8862b"/><rect x="18" y="16" width="4" height="3" fill="#8a5a1c"/><path d="M13.5 31v-3M26.5 31v-3" stroke="#8a5a1c" stroke-width=".8"/>`,
  texas: `<rect width="40" height="40" fill="#fff"/><rect y="20" width="40" height="20" fill="#bf0a30"/><rect width="15" height="40" fill="#002868"/>
 <path d="M7.5 13.5l1.9 5.7h6l-4.9 3.5 1.9 5.8-4.9-3.6-4.9 3.6 1.9-5.8-4.9-3.5h6z" fill="#fff" transform="translate(0 1) scale(1)"/>
 <path d="M19 12q4-4 6-1 2-3 4 0 2-3 6 1-4 0-5 3h-6q-1-3-5-3z" fill="#5a3a1a"/><path d="M23 14q4 2 8 0" stroke="#3a2410" fill="none" stroke-width="1"/>`,
  paulista: `<rect width="40" height="40" fill="#009c3b"/><path d="M20 5L36 20 20 35 4 20z" fill="#ffdf00"/><circle cx="20" cy="20" r="8" fill="#002776"/>
 <path d="M12.3 18.5q8-2.5 15.4 2.2" stroke="#fff" stroke-width="1.5" fill="none"/><circle cx="17" cy="23" r=".8" fill="#fff"/><circle cx="21" cy="25" r=".8" fill="#fff"/><circle cx="24" cy="22.5" r=".7" fill="#fff"/>`,
  monte: `<rect width="40" height="20" fill="#ce1126"/><rect y="20" width="40" height="20" fill="#fff"/><path d="M0 31q5-2 10 0t10 0 10 0 10 0v9H0z" fill="#3a7bd5"/>
 <path d="M9 29h22l-3 3H12z" fill="#1d2b44"/><path d="M14 29v-3h10l3 3" fill="#fff" stroke="#1d2b44" stroke-width=".8"/><rect x="16" y="23.5" width="6" height="2.5" fill="#1d2b44"/>
 <path d="M8 6l4 4 4-4M24 6l4 4 4-4" stroke="#ffd94a" stroke-width="1.2" fill="none" opacity=".9"/><circle cx="20" cy="9" r="2.4" fill="#ffd94a"/>`,
  sakhir: `<rect width="40" height="40" fill="#ce1126"/><path d="M0 0h11l5 4-5 4 5 4-5 4 5 4-5 4 5 4-5 4 5 4-5 4H0z" fill="#fff"/>
 <path d="M27 34V20" stroke="#6b4423" stroke-width="2"/><path d="M27 20q-6-3-9 1 5-2 9-1zm0 0q6-3 9 1-5-2-9-1zm0 0q-3-5-8-4 5 0 8 4zm0 0q3-5 8-4-5 0-8 4zm0 0q0-5 1-7" fill="#2f7d32" stroke="#2f7d32" stroke-width="1.2"/>
 <path d="M19 34h17" stroke="#e8c27a" stroke-width="2"/>`,
  suzuka: `<rect width="40" height="40" fill="#fff"/><circle cx="20" cy="18" r="9" fill="#bc002d"/>
 <g fill="#f7a8c8"><circle cx="9" cy="31" r="3"/><circle cx="31" cy="32" r="2.6"/><circle cx="34" cy="8" r="2.2"/></g>
 <g fill="#fff"><circle cx="9" cy="31" r=".9"/><circle cx="31" cy="32" r=".8"/><circle cx="34" cy="8" r=".7"/></g>
 <path d="M2 38q8-3 16-1M22 38q8-3 16-1" stroke="#7a4a2a" stroke-width="1.3" fill="none"/>`,
  spa: `<rect width="13.4" height="40" fill="#111"/><rect x="13.4" width="13.3" height="40" fill="#fdda24"/><rect x="26.7" width="13.3" height="40" fill="#ef3340"/>
 <g fill="#1d4d2b"><path d="M8 37l5-11 5 11z"/><path d="M8 30l5-10 5 10z"/><path d="M18 38l6-14 6 14z"/><path d="M18 30l6-12 6 12z"/><path d="M28 37l5-10 5 10z"/><path d="M1 38l4-9 4 9z"/></g>
 <path d="M0 39.5h40" stroke="#123" stroke-width="1.5"/>`,
  singapore: `<rect width="40" height="20" fill="#ef3340"/><rect y="20" width="40" height="20" fill="#fff"/><circle cx="8" cy="10" r="5" fill="#fff"/><circle cx="10" cy="10" r="5" fill="#ef3340"/>
 <g fill="#fff"><circle cx="15" cy="6" r=".9"/><circle cx="18" cy="9" r=".9"/><circle cx="17" cy="13" r=".9"/><circle cx="13" cy="13" r=".9"/><circle cx="12" cy="9" r=".9"/></g>
 <path d="M8 38V26h4v12zM18 38V25h4v13zM28 38V26h4v12z" fill="#2a3550"/><path d="M6 25.5h28l-1 1.5H7z" fill="#2a3550"/><path d="M0 38h40v2H0z" fill="#3a7bd5"/>`
};
// host-country colours for the bar under each circuit name
export const CIRCUIT_COLS = { mexico: ['#006847', '#ffffff', '#ce1126'], texas: ['#bf0a30', '#ffffff', '#002868'], paulista: ['#009c3b', '#ffdf00', '#002776'], monte: ['#ce1126', '#ffffff'],
  sakhir: ['#ffffff', '#ce1126'], suzuka: ['#ffffff', '#bc002d'], spa: ['#111111', '#fdda24', '#ef3340'], singapore: ['#ef3340', '#ffffff'] };
