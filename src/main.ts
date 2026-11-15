import './styles.css';
import { init as init0 } from './core/dom';
import { init as init1 } from './track/track';
import { init as init2 } from './track/active';
import { init as init3 } from './game/race';
import { init as init4 } from './input/input';
import { init as init5 } from './audio/audio';
import { init as init6 } from './audio/music';
import { init as init7 } from './net/multiplayer';
import { init as init8 } from './net/lobby';
import { init as init9 } from './ui/widgets';
import { init as init10 } from './ui/menu';
import { init as init11 } from './ui/wizard';
import { init as init12 } from './game/loop';
import { init as initHome } from './ui/home';
import { init as initControls } from './ui/controls';
import { init as initLines } from './sim/lines';
import { installDebug } from './debug';

// Run every module's start-up code in the original order.
init0(); // core/dom
init1(); // track/track
init2(); // track/active
init3(); // game/race
init4(); // input/input
init5(); // audio/audio
init6(); // audio/music
init7(); // net/multiplayer
init8(); // net/lobby
init9(); // ui/widgets
init10(); // ui/menu
init11(); // ui/wizard
initHome(); // ui/home
initControls(); // ui/controls
initLines(); // sim/lines: the ready-made racing lines
init12(); // game/loop

if (
  /[?&]debug\b/.test(location.search) ||
  /^(localhost|127\.0\.0\.1)$/.test(location.hostname) ||
  (window as any).__RL_DEBUG
)
  installDebug();
