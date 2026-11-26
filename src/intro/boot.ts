// Whether the intro plays on this page load, and loading it if so. The decision is made before the first paint by
// the script in index.html's <head> (html.intro): ?intro always plays it; otherwise it plays once, on the first visit
// to the published game (not from an invite link, not on localhost or with ?debug, not under test automation).
// The intro itself (src/intro/index.ts) is loaded only then.
//   ?intro&at=SECONDS  freeze one frame      ?intro&mute  without its sounds
export function init(): void {
  const html = document.documentElement;
  if (!html.classList.contains('intro')) return;
  const q = new URLSearchParams(location.search);
  const at = q.has('at') ? Number(q.get('at')) : null;
  import('./index').then(
    m => m.playIntro({ at: Number.isFinite(at) ? at : null, mute: q.has('mute') }),
    () => html.classList.remove('intro'), // couldn't load it: the home screen as usual
  );
}
