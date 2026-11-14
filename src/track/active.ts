import { GS } from '../state';
import { clamp, store } from '../core/dom';
import { buildTrack } from './build';
import { TRACKS } from './circuits';
export const skids = [],
  parts = [];
export function init(): void {
  GS.trackIdx = clamp(store.get('track', 0), 0, TRACKS.length - 1);
  buildTrack(TRACKS[GS.trackIdx]);
}
