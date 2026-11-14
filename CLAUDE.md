# Racing Line — notes for Claude Code

A Formula-style racing game seen from above ("helicopter cam"), in TypeScript + canvas 2D, with
procedural WebAudio sound and WebRTC multiplayer. Deployed to GitHub Pages:
https://matthewtorgerson.github.io/racing-line/

The owner designs the game by playing it (often on an iPhone) and asking for changes. Many requests
are about feel and look, so check changes visually (screenshots via Playwright) and keep phones in mind.

## Commands

```sh
npm install
npm run dev         # esbuild dev server on http://localhost:5173 with live rebuild
npm run fmt         # oxfmt: format everything (config: .oxfmtrc.json)
npm run lint        # oxlint (config: .oxlintrc.json); must stay at 0 errors and 0 warnings
npm run typecheck   # tsc, must stay at 0 errors
npm run build       # minified bundle in dist/ (index.html, assets/main.js|css, vendor/, fonts/, .nojekyll)
npm test            # Playwright smoke tests against dist/ — run `npm run build` first
npm run check       # fmt:check + lint + typecheck + build + test, what CI runs
```

A pre-commit hook (`.githooks/pre-commit`, enabled by `npm install` through the `prepare` script) formats the
staged files with oxfmt, re-stages them and runs oxlint; the commit stops on any lint error or warning. CI fails
on unformatted code or any lint warning too. Without local Node, run the Format workflow (below) after pushing.

`CHROME_PATH=/path/to/chrome npm test` uses an installed Chrome instead of Playwright's Chromium.
Never edit `dist/`; it is generated and git-ignored.

## Deploying

`.github/workflows/deploy.yml` runs format check → lint → typecheck → build → tests on every push and PR, and deploys
`dist/` to GitHub Pages on pushes to `main` (Pages source must be "GitHub Actions" in the repo settings).
`.github/workflows/format.yml` (run it from the Actions tab) formats the code, applies oxlint's safe fixes
and commits the result, for when there's no local Node to run them.

## How the code is organised

`index.html` is the page shell (all the menu / HUD / lobby markup), `src/styles.css` all the styling,
`src/main.ts` the entry point. Modules by area:

| Folder    | What's there                                                                                                                                                                                                                                                                   |
| --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `core/`   | canvas setup and resize, `$` (getElementById), `clamp`, `wrapA`, `store` (localStorage, `hcgp_` prefix — keep it so players keep their settings)                                                                                                                               |
| `track/`  | circuit data (`circuits.ts`: control points, elevation, scenery options), geometry state and helpers (`track.ts`), the big `buildTrack` (spline, walls, run-off, gravel, paint, racing line, scenery), street-circuit city, the active track                                   |
| `teams/`  | teams, logos, flags, car stats, driver traits                                                                                                                                                                                                                                  |
| `sim/`    | car model (gears, top speeds), speed profiles and racing-line colours (`profile.ts`), AI driving and racecraft (`ai.ts`), the player's assists (`player.ts`), physics, timing/sectors/stats, and `step.ts` (the fixed-step simulation, collisions, standings, damage, yellows) |
| `render/` | camera + projection (`P(x,y,z)`), primitives (`prism`, track bands), cars, trees/flags, walls/sponsor boards/tunnel/bridge, effects (fireworks, rain, night glow), buildings, and `render.ts` (one frame)                                                                      |
| `ui/`     | HUD, lap card + coaching messages, results and awards, menu wizard, circuit posters/maps, settings widgets                                                                                                                                                                     |
| `audio/`  | engine/impact sounds, crowd (disabled), procedural music themes per circuit                                                                                                                                                                                                    |
| `net/`    | multiplayer: transport (claude.ai room or PeerJS), lobby, netcode (state sync, smoothing, shared race clock), QR codes                                                                                                                                                         |
| `vendor/` | third-party QR code generator                                                                                                                                                                                                                                                  |
| `game/`   | race setup (`setupRace`, options, race state) and the main loop                                                                                                                                                                                                                |

### State and start-up — read before adding code

The code came from a single-file game (see "History" below), and it keeps that shape:

- **Shared mutable state lives on `GS`** (`src/state.ts`): values that several modules reassign
  (`GS.N`, `GS.L`, the track arrays `GS.cx/cy/nx/ny/...`, `GS.state`, `GS.raceTime`, `GS.ctrl`, …).
  Use `GS.x` to read and write them anywhere.
- **Everything else is exported from the module that owns it** (`cars`, `opts`, `TRACKS`, functions…).
  A module may reassign its own `let` exports; other modules only read them (ES live bindings).
- **No side effects at import time.** A module's start-up code (DOM wiring, first `buildTrack`, …) lives in
  its exported `init()`, and `main.ts` calls the `init()`s in a fixed order. Module top levels hold only
  declarations, so import cycles between modules are harmless. Keep it that way: put new start-up code
  in an `init()` and add it to `main.ts` if the module didn't have one.
- `src/types.ts` has interfaces for the main objects (`Car`, `Box`, `Tree`, `MPState`, `Theme`).
  `tsconfig` is not strict yet (`strict: false`, implicit `any` allowed); tighten module by module.

### Debugging and tests

On `localhost` (or with `?debug` in the URL) `src/debug.ts` puts every exported binding and every `GS`
field on `window`, readable and writable: in the console you can do `opts.laps = 1`, `state = 'race'`,
`step(STEP)`, `cars[ctrl].v`, `buildTrack(TRACKS[3])`. The Playwright tests use this to run the
simulation faster than real time (`for (...) step(STEP)`) instead of waiting. (`__set` in a module is the
hook that makes its `let` exports writable from there.)

When you change racing behaviour, measure it: run AI or bot laps through `step()` and compare lap times,
contacts and time off track before and after, as the existing tests do.

## Conventions

- Units: metres, seconds, m/s (shown as km/h). Track samples every `GS.SEG` (2) m; `idx` is the sample,
  `s` the distance along the lap, `lat` the signed offset from the centre line.
- The simulation runs at a fixed `STEP` (1/120 s); rendering is separate.
- UI style: monochrome (white/grey) menus; colour only where it means something (brake/throttle,
  DRS, sectors purple/green/yellow, penalties).
- Everything visual is drawn in code (SVG strings or canvas): no image assets. Team logos, flags and
  circuit posters are inline SVG; don't add artwork that copies real teams or brands.
- Fonts: system UI font for text; **Geist Mono** (SIL OFL, self-hosted in `public/fonts/`) for every
  number and monospaced readout, through the CSS variable `--mono`. No other web fonts.
- Touch matters: big pads, no iOS long-press loupe (`touch-action`, `user-select: none`).
- Multiplayer: each player simulates their own car; the host simulates the AI and its clock is the
  race clock. Contacts with a remote car only move the local car.

## History

Until v16.1 (Nov 2026) the game was one self-contained `index.html`. It was split into these modules
mechanically: the code was moved as it was, references were rewritten to imports or `GS.`, then
reformatted. So a lot of it is still dense and tersely named. Clean up and rename freely when you work
in an area. `docs/DESIGN.md` records every feature, its tuning numbers and why — update it when you
change behaviour.
