# Dynamic racing line

A replacement for the fixed racing line in one-button driving (Pedals: Throttle Only, Steering: Auto).
The car no longer chases one fixed line and skids when it misses it. A planner works out the fastest
line for the car, re-plans from wherever the car really is, and steers along that plan. The player
still only holds or lifts the gas.

This document explains what was built, how the line builder works, what it found, and how to check a
change. The command-line tools are described in [tools/README.md](../tools/README.md).

## What the player gets

- **Four lines to follow** ("Line Difficulty" in Settings, the pause menu and the online lobby; `L` cycles
  them in a race), plus "Classic": one fixed line that the car is steered back to, with nothing re-planned.
  The default is Cautious Expert.

  | Level           | Grip used | Brakes assumed | Distance kept from the road edge | Notes                                    |
  | --------------- | --------- | -------------- | -------------------------------- | ---------------------------------------- |
  | Novice          | 86%       | 62%            | 2.2 m                            | lifting holds your speed (no coasting)   |
  | Intermediate    | 93%       | 78%            | 1.5 m                            |                                          |
  | Cautious Expert | 97%       | 90%            | 1.0 m                            |                                          |
  | Perfect Expert  | 99.5%     | 98.5%          | 0.3 m                            | plans skids into its braking; no reserve |

  The reserve is what a late lift or early press eats into before the car runs wide. It belongs to the
  player: while the gas is held the car uses its real grip, so lifting later than the line says is
  faster, up to the point where the road runs out.

- **The drawn line** ("Racing Line" setting, or `H`): Hidden, Difficult Turns (only each circuit's three
  to five heaviest braking points, from about two seconds before the braking point until the car is
  through the corner) or Shown. It is shown by default; practice and races each remember their own
  choice. The car follows the line whether or not it is drawn. What is drawn is the level's own line,
  fixed on the road: green on the gas, yellow holding speed, red braking, a white bar where each braking
  starts. The path the planner steers when the car is off that line, or too fast for it, is worked out
  and driven but not drawn (it was drawn from the car until v17.17).

- **Opponents** drive the line of the Opponents setting for their own car: Easy = Novice,
  Medium = Intermediate, Hard = Cautious Expert. Perfect Expert is the player's alone.

- **Online**: each player's car is planned on their own machine at their own level; the host drives the
  AI on the room's Opponents line. Only car states cross the network, as before.

- It works for every car on every circuit, dry and wet.

## The pieces

| File                   | What it is                                                                                                           |
| ---------------------- | -------------------------------------------------------------------------------------------------------------------- |
| `src/sim/dynline.ts`   | The planner: line builder, live planner, steering/braking control. No DOM and no game state.                         |
| `src/sim/lines.ts`     | The game's side: which planner drives which car, loading and saving lines, AI steering on a line, the line settings. |
| `src/render/line.ts`   | Drawing the level's line on the canvas.                                                                              |
| `public/dynlines.json` | The 320 ready-made lines (8 circuits x 5 cars x 4 levels x dry/wet), written by a tool, fetched at start-up.         |
| `tools/`               | Headless harness, bots, tests and the line precompute. See [tools/README.md](../tools/README.md).                    |

Smaller changes: `src/sim/player.ts` (the planner's branch of `controlPlayer`), `src/sim/ai.ts` (`controlAI`,
`traffic`, `pursuit` and `defend` take the line a car drives), `src/game/race.ts`, the menus and the lobby.

The contract between the game and the planner is the comment at the top of `src/sim/dynline.ts`.

## How a line is built (`build()` in `src/sim/dynline.ts`)

A line is a periodic cubic B-spline of lateral offsets from the centreline (848 control points).
Its lap time comes from a lap model that follows the game's own physics:

1. **Geometry.** For every 2 m sample, the curvature of the path as it lies on the ground (the circle
   through the points 4 m behind, here and 4 m ahead) and the step length to the next sample.
2. **Speed limit.** `v <= sqrt(grip / curvature)` with the level's share of the grip.
3. **Braking, backwards.** The fastest the car may be at each sample and still brake for what follows,
   with the level's share of the brakes and the gradient. On the Perfect Expert level a skid at the grip
   limit adds its deceleration, as in the game.
4. **Acceleration, forwards.** Full throttle from the previous sample, capped by step 3.
5. **Lap time** is the sum of the segment times.

The search moves the line by **smooth bumps**: a raised cosine over many control points at once, from
wide (a whole approach to a corner, an entire set of esses) down to a single control point. A bump is
kept if the lap gets faster, and pushed further in the same direction while it keeps gaining. Rounds
repeat until a round gains almost nothing, on a coarse spline first (106 control points), then 212, 424
and 848.

Then the **wide-entry step**: corner by corner, the line is pulled out to its outside limit 150 m and
70 m before the corner's tightest point (a penalty added to the lap time while the bumps rework that
stretch), the pull is dropped, the stretch settles freely, and the result is kept only if the lap itself
is faster.

Each trial bump is evaluated **incrementally**: the braking limit is redone backwards from the end of
the bump for as long as it changes, then the speeds forwards for as long as they change. A trial costs
the stretch of lap it really affects, not the whole lap. That is what makes a thorough search affordable
(about 30 to 60 s a line; all 320 take about 15 minutes on a 32-core machine).

### What went wrong on the way (worth knowing before changing the builder)

- **One point at a time stalls.** The first builder moved one control point at a time. It stopped about
  2 s a lap short on Lone Star and left the car in the middle of the road before corners, because taking
  a whole approach out to the edge only pays when the whole stretch moves together. It looked wrong to
  the player before any number showed it. Check for this with `tools/line-improve.cjs`.
- **A formula for curvature can be fooled.** The first lap model got a line's curvature from a formula
  using a smoothed centreline curvature. Where the centreline has a kink a few metres long (street
  circuits), the formula saw a gentler bend than the car has to drive, and the better search learned to
  put the line exactly there. Measuring the drawn path fixed it and cut sliding sharply. Check for this
  with `tools/grip-check.cjs`.
- **The edge is not always best.** Braking and cornering do not compete in this game's physics, so a
  car can brake at full while turning at its limit. Forcing an approach to the edge is slower at Monte
  Porto's hairpin and at Ardennes T1, and the builder correctly leaves the line inside there. Check a
  specific corner with `tools/line-pin.cjs`.
- **Rounding roughens a line.** A stored line is its control points in quarter-millimetre steps, never
  the 2 m samples themselves. Rounding the samples to 1 mm added enough curvature noise to cost 0.3 s a
  lap; even the control points in 1 mm steps cost 0.02 to 0.08 s.

### How good is the result?

It is a well-converged local best, not a proof of the global one. On the final lines: bumps of the kind
that exposed the first problem gain under 0.02 s; rebuilding from other starting points lands within
about 0.05 s; a finer spline (1696 control points) gains 0.01 s.

Lap times on Lone Star with the Rosso car (one-button bot lifting exactly on time):

| Line            | First builder | Final builder |
| --------------- | ------------- | ------------- |
| Novice          | 58.3 s        | 56.1 s        |
| Intermediate    | 55.8 s        | 53.7 s        |
| Cautious Expert | 54.7 s        | 52.4 s        |
| Perfect Expert  | 53.7 s        | 51.4 s        |

(The original fixed line: 61.1 s driven cleanly.)

## Live planning and control

- **`plan()`** runs up to 60 times a second for the player's car. From the car's real position, heading,
  steering and speed it builds a family of smooth paths
  `lat(s) = line(s) + g(s) * (target(s) - line(s)) + r(s)`: `r` carries the car's present state and fades
  out, `g` leans the path towards one edge for a while (only tried when no plain merge back onto the line
  can be driven at the present speed). Each candidate gets a speed profile from the car's real speed with
  everything the car really has (full grip, full brakes, the whole road, skidding). The fastest wins; the
  path being driven keeps a small head start so the line does not flicker.
- **`control()`** steers along the plan (its curvature plus a little feedback) and reports the level's
  braking envelope as the auto-brake target. When the car is too fast for what is coming, it turns in at
  the tyre limit and asks for extra lock: the car skids, which sheds speed without changing its arc.
- **Other cars.** The path ignores moving cars (a pass-planning version was tried and removed: it made
  the path hard to predict). The game's contact assist brakes behind them. Stopped or crawling cars are
  steered round.
- **AI cars** do not use `plan()`. They follow `planner.line` with the game's existing traffic and
  defending logic (lane offsets from the line), steering by the line's own curvature when they are on it
  and by pure pursuit otherwise. Their pace on the line is `DYN_AIB` in `src/sim/lines.ts` (about 97.3% /
  98.3% / 98.3% of the line's speeds for Easy / Medium / Hard).
- **AI timing** (`AI_TIMING` in `src/sim/ai.ts`). A driver meets each braking zone a little early or late:
  a normally distributed error with a spread of 0.20 s (Easy), 0.12 s (Medium) or 0.08 s (Hard), a quarter
  less for the most consistent drivers. They aim 0.10 / 0.08 / 0.08 s early, so the late end of the spread
  still makes the corner (solo, the Hard line takes 0.05 s late cleanly and slides at 0.10 s; Medium is
  clean to 0.10 s; Easy to at least 0.20 s). Together with the pace above this leaves the AI a little short
  of a well-timed player on the same line.
- **AI in traffic** (`AI_LANE`). Most AI excursions came from cars off their own line beside or round
  another car: the dynamic lines use the whole road, so a lane is often a tighter arc or the far edge.
  A car away from its line now takes corners up to 12% slower, in proportion to how far off the line it is
  (3 m or more for the full amount) and how hard the line corners over the next second and a half. With
  the early aim this cut AI time off the tarmac in test races from 0.7-2.3% of race time to 0.1-0.5%.

## Classic: a fixed line from the experts

Classic used to follow an elastic band pulled tight through the corners. It now follows the consensus of the
experts: the average of the five cars' Cautious Expert lines for the circuit and weather, scaled in to the
classic 1.1 m edge margin (`adoptClassic` in `src/sim/lines.ts`). It is still one fixed line for everyone,
followed by pure pursuit with the classic speed profile; nothing is re-planned from the car. The same line is
what Lanes and Overtake steering follow, and what an AI car falls back to when its own line is not ready.

The speed profile of that line is worked out from its curvature measured as the planner measures it, taken 10%
sharper (`CLASSIC.care`): the wide circle fit that suited the elastic line saw the expert line's corners as
rounder than they are and the car slid about 9 s a lap. With it Classic slides about as much as it used to
(0 to 2 s a lap) and laps much faster: Lone Star 54.8 s (was 61.1 s), Monte Porto 42.7 s (45.0 s), Ardennes
49.5 s (54.1 s), Marina Night 53.0 s (57.7 s). Check with `tools/classic-lap.cjs`.

Until the ready-made lines have arrived (or if they are missing) the elastic line is used.

## Stored lines (`public/dynlines.json`)

`tools/precompute.cjs` writes every line the game can ask for, keyed `circuit:team:level:wet`, each with
a signature of what it depends on (track sampling, level numbers, car stats, builder version). The game
fetches the file once at start-up (it is not part of the bundle; until it arrives the cars use the classic
line) and uses a stored line only when its signature matches. Otherwise it builds the line in the
background in the browser and keeps it in `localStorage`. **Re-run the precompute after changing a level,
a car's stats, a circuit or the builder** (and bump the builder version in the planner's `sig` when
`build()` would give a different line).

## Checking a change

Measure before and after; do not judge by the lap model alone, drive it with the bots.

```sh
node tools/smoke.cjs                           # boots the game headless, runs both line modes
node tools/test-dynline.cjs --level 3          # planner checks on real track geometry
node tools/bench.cjs --level 3 --bot late0.2   # one-button bot laps: time, sliding, time off the road
node tools/rollout.cjs                         # every circuit, car, level and weather, plus races (5 to 10 minutes)
node tools/mp-test.cjs                         # a two-player online race without a network
npm test                                       # the Playwright tests, including one for the planner
```

The reference results for the final lines: 448 solo runs with no well-timed run leaving the tarmac, 32
races with no retirements or stuck cars.

## Known limits

- Tested with scripted bots and by stepping the game in a browser, not by long hand-driven sessions.
- With the path ignoring moving cars and the AI at similar pace, overtaking in Steering: Auto relies on
  being faster; the car follows otherwise.
- The expert lines use the whole road. Lifting 0.2 s late costs up to about 1 s off the road a lap on
  Cautious Expert and more on Perfect Expert; Novice and Intermediate forgive it.
- Online was tested with two players (simulated, and two tabs over a real connection), not more.
- `public/dynlines.json` is about 750 kB.
