# Dynamic racing line

A replacement for the fixed racing line in one-button driving (Pedals: Throttle Only, Steering: Auto).
The car no longer chases one fixed line and skids when it misses it. A planner works out the fastest
line for the car, re-plans from wherever the car really is, and steers along that plan. The player
still only holds or lifts the gas.

This document explains what was built, how the line builder works, what it found, and how to check a
change. The command-line tools are described in [tools/README.md](../tools/README.md).

## What the player gets

- **Four lines to follow** ("Line Difficulty" in Settings, the pause menu and the online lobby; `L` cycles
  them in a race), plus the original fixed line as "Classic". The default is Cautious Expert.

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
  through the corner) or Shown. It starts shown in practice and hidden in races; each remembers its own
  choice. The car follows the line whether or not it is drawn.

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
| `src/render/line.ts`   | Drawing the live line on the canvas.                                                                                 |
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
  and by pure pursuit otherwise. Their pace on the line is `DYN_AIB` in `src/sim/lines.ts` (about 96.5% /
  97.5% / 97.5% of the line's speeds for Easy / Medium / Hard), a little short of a well-timed player.

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
- The three.js renderer (beta) shows the line of your level for the whole lap, not the live plan.
- `public/dynlines.json` is about 750 kB.
