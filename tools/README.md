# Tools

Command-line tools for the dynamic racing line. They run the real game headless in Node, without a browser:
`headless.cjs` bundles `src/main.ts` with esbuild and runs it in a `vm` context with stubbed browser APIs. The
game thinks it is on localhost, so `src/debug.ts` exposes every binding as a global and the tools can drive
`buildTrack`, `setupRace`, `step`, `cars` and the planner directly, as the Playwright tests do in a real browser.

Run everything from the repository root after `npm install` (Node 20 or newer). The tools are CommonJS files
(`.cjs`) because the package is an ES module. Background on what is being measured is in
[docs/dynamic-racing-line.md](../docs/dynamic-racing-line.md).

Common options: `--track 0..7` (circuit index; 1 = Lone Star, the default), `--team 0..4` (0 = Scuderia
Rosso), `--level 0..4` (0 = Classic, 1 = Novice, 2 = Intermediate, 3 = Cautious Expert, 4 = Perfect
Expert), `--rain 0|1`.

## The bots

A bot only presses and releases the gas, like a player on Space. It waits for the lights to go out first
(the gas held at lights out is a jump start).

| Bot       | What it does                                                                   |
| --------- | ------------------------------------------------------------------------------ |
| `perfect` | holds the gas while below the car's safe speed, lifts otherwise                |
| `lateX`   | as `perfect`, but every lift comes X seconds late (`late0.2`)                  |
| `early`   | lifts as soon as it is within 7% of the safe speed                             |
| `jitterX` | reacts late to every change by a random time (sigma X seconds): a sloppy human |
| `eagerX`  | keeps the gas on until X m/s over the safe speed (`eager3`)                    |
| `flat`    | never lifts                                                                    |

## Everyday checks

- `smoke.cjs`: check the game still boots headless and runs a few seconds on the dynamic and the classic line
  without an exception (it proves nothing about how it looks). Run first after any change.
- `test-dynline.cjs`: check the planner on real geometry. The line stays inside its limit, its speeds match the
  grip of the path as drawn, and plans from 216 odd starting states are finite, tangent to the car and back on
  the road.
- `bench.cjs`: drive laps with one bot. Prints lap time, seconds sliding, off the tarmac, against a wall,
  steering jerk and planner time. `--race` adds a full grid (`--diff 0..2`, `--seed`). `--json` for scripts.
  Exports `bench()`.
- `table.cjs`: a table of levels x bots on one circuit (`--levels 0,1,2,3,4 --bots perfect,late0.2`).
- `races.cjs`: several race grids on one circuit (`--seeds 1,2,3 --modes classic,dynamic`). Results vary a lot
  by grid, so compare several.
- `ai-lap.cjs`: an AI car alone on the circuit on each Opponents level. Lap time, sliding and time off the road,
  against the line's own lap time. `--classic` uses the old fixed line.
- `rollout.cjs`: the full sweep. Every circuit x car x level, dry, and two cars in the wet, with `perfect` and
  `late0.2`; then races against each Opponents level. One process per circuit; 5 to 10 minutes. `--quick` (two
  cars, no races), `--races` (races only), `--show` (print the last results).
- `classic-lap.cjs`: the Classic fixed line driven by the bot on several circuits (`--tracks 1,3,6,7`). `--set
  'CLASSIC.level=0'` keeps the old elastic-band line for comparison.
- `ai-offs.cjs`: run a race and log every time an AI car leaves the tarmac, with what it was doing (in a lane,
  beside another car, just hit, over the line's speed, its braking error). Prints the share of race time off
  the tarmac; `--list` prints each excursion. `--set 'AI_TIMING.early=[0,0,0];AI_LANE.slow=0'` turns the early
  aim and the lane caution off for comparison.
- `mp-test.cjs`: a two-player online race with no network, two copies of the game joined by a fake room. Checks
  both players' lines, the host's AI, what the guest sees, and that both sides agree on the result.

## Line builder tools

- `precompute.cjs` (`npm run lines`): build every line the game can ask for and write `public/dynlines.json`.
  One process per circuit and weather; parts are kept in `tools/.lines/` so an interrupted run can be
  restarted. **Run it after changing a level, a car's stats, a circuit or the builder.** `--cfg '{...}'` builds
  with other builder settings, `--merge` only rewrites the file from the parts.
- `build-drive.cjs`: build one line fresh with the current builder and drive it with the bot. Prints the
  model's lap and the driven lap. `--stored` drives the stored line instead; `--cfg '{...}'` tries other builder
  settings. The quickest way to see whether a builder change is real.
- `line-improve.cjs`: ask whether a line is really the best the model can find. It tries smooth sideways bumps
  of many widths on top of the line and reports the gain; more than a few hundredths means the builder stopped
  early. `--fresh '{}'` builds the line now instead of using the stored one.
- `line-pin.cjs`: ask whether one corner's approach is better at the outside edge. It pushes the line to its
  limit before the corner, lets the search run free again, and compares lap times (`--corner 1 --before 150`).
- `line-shape.cjs`: print where a line sits across the road on the way into and out of each corner (metres
  inside its outside limit).
- `grip-check.cjs`: find samples where a line's speed asks for more grip than the path as drawn has. Should
  report none; anything else means the lap model and the real path disagree.

## Tracing a problem

- `trace.cjs`: list every excursion off the tarmac on a flying lap for one bot; `--detail N` prints the two
  seconds around excursion N (speed, safe speed, plan, slide).
- `zone-trace.cjs`: print speed, auto-brake target and pedals through a stretch of a flying lap
  (`--from 1640 --to 230`, in samples).
- `traffic-trace.cjs`: print a timeline of a race for the bot, what is ahead and what the plan is doing
  (`--seed 2 --from 20 --to 80`, in seconds).

## Typical sequences

After changing the planner's control or live planning:

```sh
node tools/smoke.cjs && node tools/test-dynline.cjs --level 3
node tools/bench.cjs --level 3 --bot perfect && node tools/bench.cjs --level 3 --bot late0.2
node tools/rollout.cjs            # before handing it over
```

After changing the line builder:

```sh
node tools/build-drive.cjs --level 3                 # is the driven lap better, not only the model's?
node tools/line-improve.cjs --level 3 --fresh '{}'   # anything left to find?
node tools/grip-check.cjs --track 3 --level 3        # model and drawn path still agree?
npm run lines                                        # regenerate all 320 lines (about 15 minutes)
node tools/rollout.cjs
```

Generated files (`tools/.lines/`, `tools/.rollout/`, `tools/.cache.json`) are ignored by git.
