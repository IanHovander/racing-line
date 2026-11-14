declare module '*.css';

// Browser features the game uses that aren't in TypeScript's DOM types (yet)
interface Window {
  /** claude.ai artifact runtime (room capability for multiplayer) */
  claude?: any;
  /** PeerJS, loaded on demand from vendor/peerjs.min.js */
  Peer?: any;
  webkitAudioContext?: typeof AudioContext;
  __RL_DEBUG?: boolean;
}
interface Navigator {
  /** iOS 17+: lets Web Audio play with the ringer switch off */
  audioSession?: { type: string };
}
