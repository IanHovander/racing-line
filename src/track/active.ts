import { GS } from '../state';
import { clamp, store } from '../core/dom';
import { buildTrack } from './build';
import { TRACKS } from './circuits';
export const skids = [],
  parts = [];
export function init(): void {
  // the menu shows the last raced circuit (and plays its music); Spa (Ardennes) the first time
  const spa = Math.max(
    0,
    TRACKS.findIndex(t => t.id === 'spa'),
  );
  GS.trackIdx = clamp(store.get('lastTrack', spa), 0, TRACKS.length - 1);
  buildTrack(TRACKS[GS.trackIdx]);
  GS.musId = TRACKS[GS.trackIdx].id;
}
/** build the selected circuit if the one behind the menu is a different one (the picker doesn't swap it) */
export function buildSelectedTrack(): void {
  const T = TRACKS[GS.trackIdx];
  if (GS.TR !== T) buildTrack(T);
}
/** a race starts on the current circuit: its music takes over, and the menu comes back to it next time */
export function raceTrackStarted(): void {
  GS.musId = TRACKS[GS.trackIdx].id;
  store.set('lastTrack', GS.trackIdx);
}
