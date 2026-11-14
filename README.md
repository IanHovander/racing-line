# Racing Line

Formula-style racing seen from a helicopter: eight circuits, five teams, AI drivers, DRS, slipstream,
track limits, rain, practice mode and online multiplayer. Written in TypeScript, drawn with canvas 2D,
with procedural WebAudio music. No game engine and no runtime dependencies.

**Play:** https://matthewtorgerson.github.io/racing-line/

## Develop

```sh
npm install
npm run dev        # http://localhost:5173 — rebuilds on save
npm run typecheck
npm run build      # production build in dist/
npm test           # Playwright smoke tests against dist/ (build first)
```

Every push to `main` is type-checked, built, tested and deployed to GitHub Pages by
`.github/workflows/deploy.yml`.

## Multiplayer

Outside claude.ai the game connects players directly with WebRTC through PeerJS (`public/vendor/peerjs.min.js`,
MIT licence, with a jsDelivr fallback). The first browser to open a room code becomes the hub; friends join
with the 5-character code or the invite link / QR code. Only STUN servers are configured, so a few strict
networks (some mobile carriers, corporate firewalls) may not connect; add a TURN relay in `TURN` in
`src/net/multiplayer.ts` if that matters. Inside a claude.ai artifact the game uses the artifact room capability instead.

## Layout

See [CLAUDE.md](CLAUDE.md) for how the code is organised and [docs/DESIGN.md](docs/DESIGN.md) for the design
notes and the history of every feature.
