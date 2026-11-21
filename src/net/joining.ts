// The waiting screen while a room is being opened or joined (#mpWait): a loading bar, what is happening right now,
// a way out, and on failure the reason with Try Again. Joining used to show nothing until the lobby appeared.
// From an invite link the screen is up before this code has loaded: index.html sets the class "joining" on <html>
// and the stylesheet shows #mpWait with "Loading the game…"; the first call here takes over.
import { $ } from '../core/dom';

/** what a join is doing right now: reaching the matchmaking server, connecting to the host, looking again for a
 *  room the server did not know, or opening a room */
export type JoinStep = 'start' | 'server' | 'host' | 'find' | 'room';

const STEP_TEXT: Record<JoinStep, string> = {
  start: 'Getting ready…',
  server: 'Reaching the matchmaking server…',
  host: 'Connecting to the host…',
  find: 'Looking for the room…',
  room: 'Opening your room…',
};
/** how far along the loading bar each step is, in percent; it creeps on from there while the step lasts */
const STEP_AT: Record<JoinStep, number> = { start: 24, server: 42, room: 55, host: 68, find: 68 };
const CREEP = 16;
let slowT: ReturnType<typeof setTimeout> | undefined, creepT: ReturnType<typeof setTimeout> | undefined;
let cancelFn: (() => void) | null = null,
  retryFn: (() => void) | null = null;

function bar(at: number): void {
  const f = $('mwFill');
  clearTimeout(creepT);
  f.classList.remove('creep');
  f.style.width = at + '%';
  creepT = setTimeout(() => {
    f.classList.add('creep');
    f.style.width = at + CREEP + '%';
  }, 450);
}
function show(on: boolean): void {
  document.documentElement.classList.remove('joining'); // the screen index.html put up while the game loaded
  $('mpWait').classList.toggle('hide', !on);
  if (on) for (const id of ['menu', 'home', 'joinDlg', 'results', 'pause']) $(id).classList.add('hide');
}
/**
 * Start waiting: `code` is the room being joined (null while a new room is opened); `onCancel` backs out;
 * `back`: getting back into a room the player was dropped from.
 */
export function showJoining(code: string | null, asHost: boolean, onCancel: () => void, back = false): void {
  cancelFn = onCancel;
  retryFn = null;
  $('mwTitle').textContent = asHost
    ? 'Opening Your Room'
    : (back ? 'Reconnecting to Race ' : 'Joining Race ') + (code || '').toUpperCase();
  $('mwProg').classList.remove('hide');
  $('mwRetry').classList.add('hide');
  $('mwCancel').textContent = 'Cancel';
  $('mwHint').textContent = '';
  joinStep('start');
  show(true);
  clearTimeout(slowT);
  // most joins take a second or two; say so when one takes longer, instead of looking stuck
  slowT = setTimeout(() => {
    $('mwHint').textContent = 'Still connecting. On some networks this takes up to ten seconds.';
  }, 4000);
}
/** `attempt` of `of`: a step that is being tried again says so */
export function joinStep(step: JoinStep, attempt = 1, of = 3): void {
  $('mwStep').textContent =
    (step === 'host' && attempt > 1 ? 'Still connecting to the host…' : STEP_TEXT[step] || STEP_TEXT.start) +
    (attempt > 1 ? ` (try ${attempt} of ${of})` : '');
  bar(STEP_AT[step] || STEP_AT.start);
}
/** the join did not work: say why, offer Try Again and a way back */
export function joinFailed(message: string, onRetry: () => void, onBack: () => void, title?: string): void {
  if (title) $('mwTitle').textContent = title;
  clearTimeout(slowT);
  clearTimeout(creepT);
  cancelFn = onBack;
  retryFn = onRetry;
  $('mwProg').classList.add('hide');
  $('mwStep').textContent = message;
  $('mwHint').textContent = '';
  $('mwRetry').classList.remove('hide');
  $('mwCancel').textContent = 'Back';
  show(true);
}
export function hideJoining(): void {
  clearTimeout(slowT);
  clearTimeout(creepT);
  cancelFn = retryFn = null;
  show(false);
}
export function init(): void {
  $('mwCancel').onclick = () => {
    const f = cancelFn;
    hideJoining();
    if (f) f();
  };
  $('mwRetry').onclick = () => {
    const f = retryFn;
    if (f) f();
  };
}
