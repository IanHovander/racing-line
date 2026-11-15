# Racing Line — design notes

(Formerly "Heli-Cam GP"; renamed in v13. Saved settings keep the old `hcgp_` storage prefix so nobody loses their options or best laps.)

Playable build: https://matthewtorgerson.github.io/racing-line/ (GitHub Pages, built from this repo by GitHub Actions). Up to v16.1 the game was one self-contained HTML file; it is now a TypeScript app (see CLAUDE.md).

## What's in the game

- **View**: helicopter chase cam (rotates with the car, looks ahead with speed, and follows the car's height) or fixed isometric; 2.5D projection with extruded cars, trees, grandstands, garages and buildings.
- **Controls**: you work the throttle only, plus a Steering setting in the menu.
  - **Throttle**: hold the gas (Up / W / Space, or the GAS pad on touch); lift and the car brakes itself to the safe speed for the next corner. There is no brake input. (Until Nov 2026 a Pedals setting also offered Brake only, Throttle + Brake and Auto.)
  - **Steering** (`opts.steer`):
    - 0 Auto: follows the racing line and steers around traffic (passes on its own).
    - 1 Lanes: tap left/right to pick left side / racing line / right side (`pursuitLane()`, `laneProfile()`); HUD LEFT / LINE / RIGHT and a yellow dashed target line.
    - 2 Manual: hold left/right.
    - 3 Overtake: drives the racing line and sits behind the car ahead. The nearest car within 70 m ahead and roughly in your path (`passTarget()`) gets a white ring; the HUD shows ◀ PASS / FOLLOW / PASS ▶ with pulsing side buttons. Tap a side (`passPick()`) to commit: the car moves 3.2 m beside the target until 7.5 m clear, then rejoins the line. Tap the same side to cancel; a pass also ends after 14 s, if the target pulls 90 m ahead or is knocked out. If the chosen side has no room it waits on that side of the gearbox. Stalled/wrecked cars are steered around automatically.
  - With Auto, Lanes or Overtake steering, a contact assist (`aheadCap()`) eases off and brakes rather than rear-end a car directly ahead.
- **Team play** (single player): you run both cars of your team; Tab/C or the Swap button switches control.
  - **Swap transition** (v13, single player only): time slows to 4% while the camera pans over to the other car (smoothstep pan with a slight zoom-out), then ramps back to full speed over the last 20%. Pan length scales with distance (0.7–1.6 s real time; ~0.2 s of race time passes). Disabled online (`mpOn()`), so multiplayer never slows down.
- **AI defending** (v13, `defend()`): when a car behind (10–28 m back, not slower) pulls out to one side, an AI car may make one move to cover that side, then holds its line once the attacker is within 9 m.
  - By difficulty (Easy / Normal / Hard): chance per attack 15% / 50% / 85%; lateral move speed 1.1 / 1.9 / 2.9 m/s; reacts when the attacker has moved 1.5 / 1.0 / 0.6 m sideways; looks back 16 / 22 / 28 m.
  - Fair-play limits: only on a straight (no braking zone or real curvature in the next ~90 m), never under braking, not in the first 10 s of a race, not under yellow, never into a car alongside (`sideRoom()`), one move per attack, then a 2.5 s cooldown.
  - The defender's speed is capped to what its off-line position allows (`laneSafe()`).
  - When it's you being defended against, a toast says e.g. "K. Sato defends the left".
  - Measured with an Overtake-mode bot over four circuits: committed passes succeed ~77% on Easy, ~65% on Normal and ~60% on Hard. With the straight-only rule, contacts in auto-steered races are back at the no-defence baseline.
- **Teams**:

  | Team             | Logo                              | Drivers (nationality)                       | Car character                                         | top  | acc   | brk  | grip  | damage taken |
  | ---------------- | --------------------------------- | ------------------------------------------- | ----------------------------------------------------- | ---- | ----- | ---- | ----- | ------------ |
  | Scuderia Rosso   | red shield, yellow lightning bolt | M. Vance (Canada), L. Moreau (France)       | Power: fastest on the straights, edgy in the corners  | 1.05 | 1.02  | 1.0  | 0.984 | 1.0          |
  | Argent GP        | silver hexagon, teal chevrons     | J. Keller (Germany), T. Okafor (Nigeria)    | All-rounder: no weak spot, toughest chassis           | 1.01 | 1.01  | 1.05 | 1.006 | 0.85         |
  | Papaya Racing    | orange disc, blue swoosh          | E. Lindqvist (Sweden), K. Sato (Japan)      | Downforce: best in the corners, slow on the straights | 0.98 | 1.0   | 1.0  | 1.026 | 1.1          |
  | Verde Motorsport | green leaf, lime V                | R. Duarte (Brazil), S. Visser (Netherlands) | Late brakers: best stopping power on the grid         | 1.01 | 1.0   | 1.36 | 1.0   | 1.0          |
  | Azure F1         | blue diamond, pink star           | P. Novak (Czechia), D. Ferreira (Portugal)  | Traction: rockets out of slow corners                 | 0.99 | 1.055 | 1.0  | 0.997 | 1.15         |
  - Multipliers in `TEAM_STATS`; each team has its own speed profile `PROF[team]`. Balanced from measured lap-time sensitivities: all five cars lap within ~0.15 s.
  - Original inline-SVG logos (`LOGOS`) and driver flags (`FLAGS`).

- **Driver traits** (v14.8, `DRIVER_STATS[team][driver]`, helper `DRV(c)`). Each driver has five traits from 0 to 1 (0.5 = average) that change how the AI races that car. They don't change how the car drives under your control.

  | Driver       | Pace | Aggression | Defending | Consistency | Wet | Summary                              |
  | ------------ | ---- | ---------- | --------- | ----------- | --- | ------------------------------------ |
  | M. Vance     | .80  | .75        | .60       | .55         | .60 | Fast and fearless, a little ragged   |
  | L. Moreau    | .65  | .50        | .70       | .75         | .50 | Steady team player                   |
  | J. Keller    | .80  | .45        | .65       | .90         | .70 | Metronome — rarely makes a mistake   |
  | T. Okafor    | .70  | .70        | .55       | .60         | .80 | Bold overtaker, great in the rain    |
  | E. Lindqvist | .75  | .35        | .50       | .80         | .90 | Clean and calm, rain master          |
  | K. Sato      | .70  | .60        | .80       | .70         | .55 | Tough to pass, never rattled         |
  | R. Duarte    | .75  | .85        | .70       | .50         | .85 | All-out attacker, thrives in the wet |
  | S. Visser    | .70  | .65        | .90       | .65         | .60 | The wall — defends everything        |
  | P. Novak     | .60  | .40        | .45       | .85         | .50 | Smooth and steady, lap after lap     |
  | D. Ferreira  | .65  | .80        | .55       | .45         | .65 | Wild card — brilliant or in the wall |

  Effects:
  - Pace: ±1.2% AI speed.
  - Wet: ±3% in rain.
  - Consistency: a speed wobble of up to ±2% × (1 − consistency), re-rolled every 1.5–3.5 s. There's also an occasional late-braking moment (+3.5 m/s for 0.45 s) at a rate that grows with (1 − consistency)².
  - Aggression: looks for passes earlier (look-ahead 20 + 12×aggr m), takes gaps up to 0.25 m tighter, and follows up to 1.5 m closer before backing off.
  - Defending: scales the difficulty's defend chance by 0.4 + 1.2×defend and the cover speed by 0.7 + 0.6×defend.
  - In the menu, the team panel shows five car bars and both drivers with flag and summary.
  - Test: 300 s races on four circuits with Auto pedals and steering had 0–2 contacts; the low-consistency drivers occasionally ran wide.

- **Pit straight dressing** (every circuit):
  - Pit building of ten garages (two per team, team colours) opposite the main grandstand (`buildPits()`), a pit lane strip, and a row of 10 waving driver-nationality flags.
  - **Pit entry and exit** (v13, reworked v13.1): on permanent circuits the pit-side wall of the main straight is pulled in to HW+2.6 m, so it's a real pit wall right beside the track, easing back out ~60 m beyond the pits. The pit lane runs directly behind it, with:
    - a darker fast lane and a lighter working lane in front of the garages, divided by a solid white line;
    - each team's box painted in its colour in front of its garage;
    - white speed-limit lines across both ends.
    - 52 m entry and exit lanes (`PIT_RL`) peel off the track edge and cut through the pit wall.
    - Still cosmetic: cars don't stop yet.
  - **Host-nation flag** (v13, `host`): a big flag on a 24 m pole by the line (Mexico, Japan, Belgium, United States).
- **Grandstands** (v13, `placeStands()`): two-tier, crowd-filled stands on the outside of the biggest corners (up to 7 corners, ~33–48 stand blocks per circuit), on top of the main-straight grandstand. On street circuits they're placed before the city, which keeps clear of them.
- **Painted run-off** (`paint` per circuit): narrow three-band strips at small corners; at big corners wide fields up to 20 m outside and 9 m at the inside apex, easing in and out (`PWR`/`PWL`, `SWR`/`SWL`). Slick surface 5 (grip 19, ×0.55 in rain). No gravel where a wide field takes over.
- **Circuits** (8; picked in the menu, best lap saved per circuit id):
  - **Autódromo Azteca** (v13, replaces Riverside Park), 3.01 km, inspired by Mexico City (Hermanos Rodríguez): a ~600 m main straight, the T1–T3 chicane, fast esses, then through a **stadium section** ringed by a crowd-filled grandstand bowl (`stadium:[cpFrom,cpTo]`; walls pulled in to HW+5 there) and round the long final curve. Green/white/red paint, crowd in Mexican colours (`crowdCols`). Nearly flat. Mariachi theme.
  - **Lone Star Circuit**, 3.40 km, inspired by COTA: uphill T1 hairpin, esses, huge back straight, stadium wiggles, triple-apex right. Red/white/blue paint. Spaghetti-western theme.
  - **Autódromo Paulista**, 3.21 km, inspired by Interlagos: Senna S, Curva do Sol, twisty infield, flat-out climb. Green/white paint. Samba theme.
  - **Monte Porto**, 2.24 km, inspired by Monaco: street circuit with armco, Casino climb, hairpin, tunnel, harbour. Baroque-electro theme.
  - **Desert Lights**, 2.45 km, inspired by Bahrain: floodlit night race, 103 light pools (≥97% of the track lit). Red/white paint. Arabic-electronic theme.
  - **Sakura Ring** (v13), 3.28 km, inspired by Suzuka: a **figure of eight with a crossover bridge**. The esses, Dunlop, Degner, under the bridge to the hairpin, 200R, Spoon, then the back straight over the bridge (10.8 m above the lower road) to 130R, a chicane and the final curve. Cherry-blossom trees (62% pink), drifting petals and a Ferris wheel by the main straight. Japanese theme.
  - **Ardennes Forest** (v13), 3.46 km, inspired by Spa-Francorchamps: La Source hairpin, the plunge to Eau Rouge and the climb up Raidillon (max ~16%), Kemmel, Les Combes, Pouhon, Stavelot, Blanchimont and the Bus Stop. Dense pine forest (2,600 trees, ~80% placed within 90 m of the track; narrower 18 m runoff so the trees come close). Belgian new-beat theme.
  - **Marina Night** (v14, replaces Neon Strip), 3.13 km, 14 corners, inspired by Singapore (Marina Bay).
    - A floodlit night street race on a lighter blue night (`dark`), between concrete walls topped with **catch fences** (`fence`: translucent mesh 3.2 m high, posts every 6 m, a top rail).
    - The lap: tight 90° corners, the Raffles-style straight, a chicane and a bridge hairpin, the Esplanade straight, then the run along the bay and a final hairpin onto the start straight.
    - Scenery: glass towers with lit windows (`towers`), a bay with yachts, a lit giant observation wheel (`wheelXY`, rim and gondolas glow) and three-tower hotel with a sky deck across the water (`mbs`).
    - Music: electronic `marina` theme (124 BPM, C minor pentatonic: gongs, gamelan-style bells, an erhu-like sliding lead from section 3).
    - Host flag SG. The Vegas theme code is still in the file but unused.
- **Corners** (v14): numbered automatically from the start line (`CORNERS`, `CMAP`, `NEXTC`).
  - A corner is a bend tighter than ~170 m radius (curvature smoothed over ±5 samples, at least 12 m long). A change of direction starts a new corner; same-direction bends within ~50 m merge (double apex).
  - Counts: Azteca 16, Lone Star 17, Paulista 11, Monte Porto 13, Desert Lights 14, Sakura Ring 12, Ardennes 14, Marina Night 14 (also shown in the menu).
  - Each corner gets a numbered board on the outside of its apex (visible above zoom 2.5).
  - Toasts use them ("K. Sato defends the left into T4", "… is OUT at T6!"), as does the yellow-flag banner ("YELLOW FLAG at T6").
- **Sectors** (v14): three timing sectors split near ⅓ and ⅔ of the lap, on the straightest stretch within ±7% (`SECI`, `SECB`), marked by a dashed line across the track.
  - Times per car (`secDone`): purple = fastest anyone has done this race (`SB`, reset per race), green = your best or within 0.15 s of it, yellow = slower.
  - Shown on the track only: a board where each sector ends (S1 at the S1/S2 line, S2 at the S2/S3 line, S3 at the finish) is labelled with that sector and coloured by your latest time in it. No numbers on the boards (v14.2); grey until you've set a time.
- **Walls and sponsor boards** (v14, `drawWalls`): barriers are drawn as solid walls rather than lines: footing shadow, outer face, track-side face and a top 0.7 m wide (0.35 m and 1.1 m high on street circuits, with a red stripe).
  - Sponsor hoardings (2.4 m tall) stand on the track-side face of the walls. They run in long continuous stretches of the same brand: 8 boards of 12 m (~96 m), with about 3 of every 4 stretches carrying ads, on both sides of the track.
  - The brands are invented (`ADS`: VOLTRA, APEXA, NOVEX, ZEPHYRA, KITEWAY, ORBANI, TORQEL, LUMORA).
  - They're queued while the walls are built (`ADQ`) and drawn with the depth-sorted objects (type 7) using the board's middle point. That way buildings behind a board can't cover it, and cars, poles and buildings in front of it still do (v14.4). Only faces turned towards the camera get boards, with the text fitted along the wall.
- **HUD** (v14 cleanup): one panel top left.
  - Contents: LAP n/N with the race time (monospace), then last and best lap, the damage bar when on, then the standings (position, team logo, first three letters of the surname, monospace gap). Your car's row is yellow and your teammate's light blue. There's no separate position display or flags.
  - In-race buttons: only Swap car and pause.
  - Steering, camera, racing line, sound effects and music are set in the main menu or in the pause menu (v14.1; both stay in sync via `SEG_SYNC`). The M/N/V/L keys are gone.
  - Narrower panel (v14.5, ~116 px on a phone): the race time sits under LAP n/N, Last and Best are on two short monospace lines, and the columns are tighter.
- **Buildings in the way sink** (v14.1, reworked v14.6): a tall building sinks if its whole footprint is nearer the camera than any piece of road on screen it covers. The road's centre line and both barriers count, sampled every 4 m around the whole lap wherever it's in view, so you can always see all the road in shot. Buildings beyond the road stay full height. It sinks smoothly to ~7% of its height (`b.sink`, about 0.2 s), replacing the old 16% fade; the chase cam no longer shrinks all buildings, and window rows are batched into one fill per building.
- Night performance (v14.1): the light pools use two pre-rendered sprites (`POOLS`) instead of a new radial gradient per pool per frame, and the dark layer renders at half resolution.
  - The speed panel shows speed, gear and gradient, plus a surface warning line (GRAVEL!, SLICK PAINT, OFF TRACK, SLIDING) only when one applies. The driver's name was removed in v14.7; it's in the timing panel.
- **Monaco tunnel** (v14.5): an open cut-away (`TUN_STYLE=2`, `drawTunnelFloor`, `queuePortals`). There's no roof; the road inside is darkened, the inner walls are 4.2 m tall and dark, warm strip lights run along both walls with glows, and each end has a concrete portal (pillars and a plain lintel at 4.5–5.8 m, no sign) that's depth-sorted with the cars.
  - Chosen by the user over a hotel roof that turned see-through and a glass roof with ribs. Both replaced the old translucent grey slab and have since been removed.
- **Weather (Dry / Rain)**: lower grip on every surface, wet speed profiles, ~10% slower laps, rain visuals and hiss.
- **Slipstream**: tow from a car 5–45 m ahead within ~2.4 m sideways; up to +7.5% top speed; subtle streaks, HUD bar and wind hiss.
- **Race rules**: Damage & knockouts, Yellow flags (Off / 3 / 10 / 30 s) with +5 s for passing under yellow.
- **Online multiplayer** via the `room` capability: QR-code lobby, host picks circuit and laps, each human drives one car, AI fills the grid, ~15 Hz presence. No swap slow-motion online.
- **Music** (procedural WebAudio, one theme per circuit, `TRACK_THEME`):
  - Azteca `mariachi` (v13): 150 BPM ranchera in 3/4 (G major, G–D7–G–C–D7–G). Guitarrón bass on beat 1, vihuela strums on 2 and 3, violins an octave up with vibrato, and a trumpet pair in thirds from the second section; original tune.
  - Lone Star `western`, Paulista `samba`, Monte Porto `baroque`, Desert Lights `arabic` (unchanged).
  - Sakura Ring `japan` (v13): 118 BPM. Koto plucks in the in-sen scale on D, taiko and shime-daiko, a shakuhachi-style breathy flute in sections 2 and 4, and a soft electronic kick and hats from section 3.
  - Ardennes Forest `newbeat` (v13): 112 BPM Belgian new beat / EBM. Heavy four-on-the-floor kick, slapback clap, a resonant acid bass line whose filter opens over time, dark stabs and a pad in A minor.
  - Neon Strip `vegas` (v13): 126 BPM electro-house (F minor). Four-on-the-floor kick, offbeat open hats, a pumping offbeat bass, detuned supersaw stabs, a plucked arp, a breakdown with a noise riser and a lead in the last section.
  - Loudness (70 s offline renders): RMS 0.029–0.048, peaks ≤0.53, in line with the older themes.
  - Crowd audio is still removed (`CROWD_ENABLED=false`).

## v15 changes (track limits, racing, finish)

- **Why holding the throttle paid**: a flat-out bot was slower over a lap everywhere, but gained 0.3–1.3 s through some corners, worst in the esses (Bahrain T12, Suzuka T3–T5, Spa). A trace of Bahrain T12 showed it at 60 m/s against the line's 35–45 m/s. It straightened the S-bends by using the full road plus ~3 m of paint beyond the white line, sliding the whole way.
- **Track limits rule** (menu Race rules: Off / Penalty every 3rd / Every 2nd; default every 3rd, `opts.limits`).
  - An offence is all four wheels past the white line (|lat| > HW + 1.3 m), counted once per excursion, for every car and not on street circuits.
  - Warnings come as toasts ("Track limits at T12 — warning 1/2"); every Nth offence adds +5 s to `c.pen`, applied to the finishing order.
  - A penalised car's gap shows in red in the standings.
  - Over 240 s: the flat-out bot picks up 13–25 offences and 20–40 s of penalties per race on permanent circuits, ideal driving 0, the AI 0–4.
- **Off-track physics**:
  - Grass drag is now 1.6 + 0.08v + 0.0018v², asphalt runoff grip 22 (was 26) with drag 1.0 + 0.05v + 0.0012v², and understeer scrub 11 m/s² (was 7).
  - "Dirty tyres": `c.dirt` builds on grass, gravel or runoff and costs up to 20% grip, fading over ~3 s back on track.
- **Racing line and profile**:
  - The line may now use the road out to HW − 1.0 m (was HW − 1.5).
  - Profile grip 97.5% (was 93%) and profile braking 40 (was 36), so the line driver and AI work closer to the car's real limit.
  - Ideal laps are ~0.6–1.0 s faster.
- **Random grid** every single-player race (`order` shuffled; online keeps the host's grid). AI skill is no longer tied to grid slot (base ± 0.7% random), and the driver pace trait is now worth ±2.5%.
- **AI racecraft**:
  - Brakes if it can't get alongside before reaching the car ahead (time-to-contact against the time to move clear).
  - Cars side by side hold their line where the steering aims, so they don't converge as the racing line swings across.
  - Side-by-side spacing is 3.3 m.
  - Result over 12 AI races of 240 s: ~4× more position changes than v14.8 (1,418 vs 361 by the same rough counter). Contacts ~3× (80 vs 26, about 7 per race), down from 188 before the two racecraft fixes.
- **Camera**: isometric is the default, and every existing player is switched to it once (`camv2`). The labels are now "Isometric" / "Chase", and the menu subtitle reads "Formula racing from above".
- **HUD**:
  - Driver codes in the standings are monospace.
  - The speed panel has a red brake bar on the left and a green throttle bar on the right, filled by the current pedal values (`c.thr`, `c.brk`; the brake is the car's own auto-braking).
- **Finish**:
  - Fireworks: rockets and bursts with pops on a top layer (`#fwc`) from the moment your car finishes, for ~14 s, above the results card.
  - Flag marshal: an orange-suited figure on the pit wall at the line waves a chequered flag once the leader starts the last lap.

## Gearbox (v15.1)

- Setting **Gearbox: Automatic / Manual** (`opts.gears`) in the main menu and the pause menu.
- 8 gears, with top speeds (`GEARTOP`) of 20, 31, 42, 53, 64, 75, 86 and 97 m/s.
  - Automatic, the AI, and AI-driven teammates use `autoGear(v)`: the lowest gear not past 97% of its top speed. The gear shown and the engine pitch now follow it.
- Manual applies only to the car you control (`isManual(c)`). Engine pull is multiplied by `gearEff(g,v)`:
  - Full from 60% revs up to the limiter, and down to 20% when lugging.
  - Zero on the limiter.
  - 1st gear always pulls fully (clutch slip).
  - Off the throttle, lower gears add engine braking (up to 2.2 m/s²).
- Downshifts that would over-rev are refused ("Too fast for gear n").
- Controls:
  - Keyboard: up with E, X or right Shift; down with Q, Z or right Ctrl.
  - Touch: ▲ pad above the right thumb, ▼ pad above the left.
  - A short click sound plays on each shift.
- The speed panel shows the selected gear and 10 shift lights (4 green, 3 red, 3 blue) from 50% to 95% revs. They flash blue at 97% (time to shift up).
- Swapping cars puts the new car in the right gear.
- Test (racing-line bot, laps):

  | Gear changes                          | Lone Star | Monaco | Bahrain |
  | ------------------------------------- | --------- | ------ | ------- |
  | Automatic                             | 59.8      | 44.3   | 47.1    |
  | Manual, shifting at the blue lights   | 59.9      | 44.3   | 47.1    |
  | Manual, shifting up early at 60% revs | 60.7      | 45.1   | 48.1    |
  | Stuck in 3rd                          | 79.8      | 54.2   | 57.7    |

## v15.2 (performance and results)

- **Start-line stutter.** CPU profile at the Lone Star grid: ~25% of each frame went to drawing the waving flags. Each flag was an SVG image drawn in 10 slices every frame, and drawing an SVG is slow, especially on phones.
  - Each flag is now rasterised once to a small canvas, and the wave is pre-rendered into 12 animation frames per flag and size (`flagFrames`, `FLAGANIM`, capped at 60 sets). Each flag is now one `drawImage` per frame.
  - Crowd dots are worked out once per stand (`b.dots`) and drawn as one path per colour, with no clipping and none when zoomed far out.
  - Result in headless desktop Chrome: ~11 → ~5–9 ms per frame at the start line. What's left there is mostly filling the stand and garage faces.
- **Results screen.** Fireworks are drawn behind the results card (canvas z-index 9, under the overlay), and the overlay backdrop is lighter (22%).
  - A new "+/−" column shows places gained (green ▲n) or lost (red ▼n) against each car's grid slot (`c.grid`); hovering shows the starting position.
  - The title adds your best car's change, e.g. "Best finish P5 (▲2 from P7)".

## v15.3 (DRS, Hard AI, flags)

- **DRS** (`opts.drs`: Off / Button / Automatic; in Race rules and the pause menu; default Button).
  - Zones: the 2–3 longest straights (curvature < 1/500 over ±8 samples, at least 280 m). Each zone starts 30 m into its straight and ends 50 m before the braking point, with a detection point 120 m before the straight starts.
  - Zone lengths: Azteca 798/520 m, Lone Star 622/250, Paulista 396/384/200, Monte Porto 218, Desert Lights 470/236, Sakura 572/408/206, Ardennes 470/246, Marina 374/220.
  - Rule: crossing the detection point less than 1.0 s behind the car ahead (gap ÷ your speed) enables DRS for that zone. It's not allowed on the first lap, under yellow or in the rain. Braking or leaving the zone closes it.
  - Effect: +5.5% top speed and +6% pull while open. The AI and the throttle assist may go above the usual speed cap on the straight.
  - Button mode is for your car (F or Enter; a DRS pad on touch above GAS, glowing green when ready). Automatic opens it for you when you're on the throttle. The AI always uses Automatic.
  - Display: a "DRS enabled" toast, and a DRS pill in the speed panel (outline, green flashing when ready, solid blue when open). The rear wing opens visibly (a raised blue flap). Each zone start has a blue "DRS" board and the detection point a blue dashed line.
  - Test: speeds up to ~325 km/h with DRS open, and contacts about the same as with DRS off.
- **Hard AI tightened**: AI pace base is now Easy 0.90 / Normal 0.955 / Hard 1.0 of the racing-line profile (was 0.88 / 0.94 / 0.985). Driver pace adds ±2.5%, capped at 1.012 so they stay within the grip. On Hard the best AI laps now match or beat a perfect racing-line bot: Lone Star 59.7 vs 60.8, Sakura 57.4 vs 58.3, Desert Lights about level.
- **Flag stutter fix**: v15.2's flag animation cache was keyed by exact pixel size, and the camera zoom changes with speed, so the frames were being rebuilt while driving. Frames are now built at fixed sizes (1/3-octave steps) and scaled, and pre-built for the race's zoom range while the start lights run (`prewarmFlags`). No flag frames are built during the race, and the real frame rate down the main straight holds 60 fps in testing.

## v15.4 — menu wizard, circuit cards, music, HUD

- **Menu is a 4-step wizard:** Mode → Team → Circuit → Settings (step pills at top, Back/Next bar; Circuit step skipped for host/join). Mode cards: Single player / Host multiplayer / Join multiplayer; the final button reads START / HOST / JOIN RACE. Mode remembered (`hcgp_mode`). `WZ`, `wzGo`, `wzSteps`.
- **Circuit cards:** each circuit has a hand-drawn 40×40 SVG icon (`CIRCUIT_ICON`: country colours + motif — Aztec pyramid, Lone Star + longhorn, Brazil globe, Monaco yacht, Bahrain palm, rising sun + sakura, Belgian pines, Singapore crescent + Marina Bay Sands) and a thumbnail layout (`trackLayout` re-runs the spline/smoothing coarsely). Selected circuit shows a large map (`drawTrackMap`): sectors coloured, DRS zones dashed, start line + direction arrow, corner numbers.
- **Logo:** "Wind tunnel", monochrome (chosen by the user after three rounds of options; fonts were rejected in favour of drawn lettering). Heavy chamfered glyphs slanted 20°, square caps clipped to one cap band so every letter is exactly the same height; RACING white, LINE grey (#8a93a3); the front of the word fades in from airflow streaks. Generated by the separate picker page (https://claude.ai/artifact/MTaaT1r7Zk37VyJnmnHD63: 8 speed effects × 10 colour schemes) and pasted in as static SVG.
- Mode step starts with nothing selected; tapping a mode advances to Team.
- **Music:** every circuit theme now has the Ardennes-style drive layer (`drive()`: four-on-the-floor kick from bar 1, backbeat clap, offbeat hats, 16th acid bass in the theme's key) and faster tempos (128–136 BPM; samba 114, mariachi 168 in 3/4). Kick/clap de-duplicated per timestamp.
- **Speed panel = "slim strip"** (chosen from 6 mock-ups, https://claude.ai/artifact/Qbvs7RZsiAT7KXJkAZ1StX): fixed 316×63 (262 wide on short screens). Row of 20 rev lights (green/red/blue, flash blue at the shift point in Manual; shown in Automatic too), monospace speed, thin throttle (green) and brake (red) bars, boxed gear, DRS pill (grey / flashing green available / solid blue open; slot kept when DRS is off) and 4 slipstream chevrons lit by tow strength. Surface warnings (OFF TRACK, SLIDING…) are a small red tag above the strip. The gradient readout was dropped.
- **Position panel** unchanged in layout (113 px; narrower/alternative layouts were mocked up at https://claude.ai/artifact/TP3B7mJwqsVn1UCft9VJ77 and declined). New: rows are persistent elements and **slide** to their new places when the order changes (FLIP, 0.45 s), and your two cars briefly show ▲n / ▼n in the gap column (2.6 s). The screen-edge glow idea was rejected.
- **Race-control banners** (`rcBanner(type,title,sub)`, `#rcb`) replace the plain toasts for your car's track-limits warnings and penalties. Warning: white block with a black/white diagonal track-limits flag icon, "TRACK LIMITS · T12", "Warning n of m (— next one is +5 s)". Penalty: orange block with a stopwatch icon, "+5 SEC", "TIME PENALTY" + reason (track limits offence n, or overtaking under yellow). Top centre on desktop for 3.8 s; on narrow screens above the touch pads with the text stacked.
- **Slipstream toggle** (`opts.tow`, Race rules + pause, default On; host's setting applies online): off = no tow for any car, no streaks/wind, chevrons hidden (slot kept).
- **Circuit map DRS zones** (option B of https://claude.ai/artifact/Aqw8s8sP89D67KzJZmY2tf): a solid green line drawn just outside the track (34 m offset, away from the layout centre) along each zone, no label; sector colours stay on the track itself.
- **HUD font**: drawn monospace fonts generated with fontTools from stroke skeletons (`mono-fonts/genfonts.py`, ~4 KB WOFF each, embedded as data URIs because Google Fonts doesn't load in the artifact frame). 18 drawn + 2 classic options at https://claude.ai/artifact/AZp8AAK6hhdhScLCGgyyXF. Decision: keep the current system monospace (ui-monospace / SF Mono / Menlo / Consolas); the generator stays available if a custom font is wanted later.
- **Circuit cards** (superseded by posters; option C of https://claude.ai/artifact/WW9f1uKSwS69sFWfuRDsXK): icons removed; each card is the name, a short host-colour bar (`CIRCUIT_COLS`; Lone Star is red/white/blue) and the mini-map. Legend under the big map lists only Sector 1–3 and "DRS Zone".
- **Circuit-step map** (chosen from the angled-map prototype https://claude.ai/artifact/1EHdSG4Ps3oXbLPC3Jzp7H): canvas (`renderTrackMap`, `MAPYAW`, drag to turn), 28° view, true height, translucent walls from ground to track, ground shadow, sector colours, DRS Zone lines beside the track, start line, corner numbers. Below it an elevation profile (`elevProfile`): lap height by sector colour, "Elevation · n m", DRS zones as green bars along the bottom. (Note: global `canvas{position:fixed}` rule is overridden for `#trkMap canvas`.)
- **Circuit posters = the circuit cards** (v15.5): each card is a flat 2D 1960s-style poster (`POSTERS`, ~73 KB of SVG, generated by `posters/gen.py`: host-colour scene, side-view cigar car, bold italic title band with length/corners and track map, paper border and grain) plus the circuit name; 3 per row on phones. The flag bars/mini-maps are retired. A 3D-car/perspective variant and a layered tilt variant were tried and declined (https://claude.ai/artifact/X1yGs7anKW2qcfrghxvgXn shows the last 3D version).
- **Monochrome UI**: menu, pause, results, lobby and prompts use white/grey accents instead of red; meaningful colours (brake/throttle, DRS, sectors, your yellow row) unchanged.
- **Race rules** rows spaced with divider lines.

## v15.6 — menu polish, settings, lock-ups

- **Circuit step:** posters only (no name label, no button frame; selected poster lifts with a white outline, others dimmed). Below: circuit name + place (`CIRCUIT_PLACE`), description, then stats line (km · corners · DRS zones · elevation · night/street · your best), then the angled map + profile. Poster track maps are bigger (scale .92, dark under-stroke).
- **No layout shift:** team buttons fixed 84 px with 2-line clamp; team tagline and driver taglines have fixed min-heights; settings notes have min-heights. Driver-traits explainer removed.
- **Settings regrouped** into sections (main menu): Race (Opponents, Laps, Weather) · Driving (Steering, Gearbox) · Rules (Damage, Slipstream, DRS, Track limits, Yellow flags) · Display & sound (Camera, Racing line, Turn numbers, Sound, Music). Pause menu uses the same grouping.
- **Turn numbers toggle** (`opts.turns`, default shown): hides the on-track corner boards.
- **Menu music:** audio is started on page load where the browser allows; otherwise a small "Tap anywhere to start the music" hint shows and the first touch/click/key anywhere starts it (browsers block sound before the first interaction).
- **Standings colours:** your row white with black text; teammate light grey (#c4c9d1).
- **Race-control banner** moved low: just above the speed strip (desktop bottom 128 px; touch above the strip between the swap and DRS pads; landscape just above the strip).
- **Swap:** big round SWAP pad on touch (left, above the gear/steer pads in portrait; bottom centre-right in landscape), top Swap button enlarged on desktop and hidden on touch.
- **Crowds:** stands now draw rows of seats facing the track with people seated in rows (muted colours), replacing random coloured confetti on the roof.
- **Defaults:** Steering = Auto, Gearbox = Automatic, DRS = Automatic. Applied once to existing players too (`defv4`); later choices are kept.
- **M. Vance is Canadian** (was Irish); new `CA` flag (red-white-red with a drawn maple leaf), used in the menu, standings and pit-lane flag row.
- **Papaya Racing logo** is now the two-tone chevron P (orange bowl, blue leg, dark counter; option g of https://claude.ai/artifact/4WGiKPFuqfU33EwQ7UMF7b). Other teams unchanged.
- Option pages for pending choices: team logos https://claude.ai/artifact/2voBPsJDVV3VAkeSQxRNm9 ; car markers + defend notifications https://claude.ai/artifact/5T4gSnxxS7UPRTN4oLxcR3

## GitHub Pages + WebRTC multiplayer (v15.7)

- **Hosted at https://matthewtorgerson.github.io/racing-line/** from repo `matthewtorgerson/racing-line` (branch `main`, root): `index.html`, `vendor/peerjs.min.js` (PeerJS 1.5.5, MIT), README. The old `matthewtorgerson.github.io` repo's custom-domain claim (www.matthewtorgerson.com) was removed so project pages stop redirecting to the Squarespace site.
- **Multiplayer outside claude.ai** uses PeerJS (`makeP2PApi`), modelled on the RoboRally website mode: same interface as claude.ai's room service (`join → onPeers / presence / leave`). The first browser to open a code (since v17.16: the host, and only the host) registers `racingline-mt-<code>` on PeerJS's free cloud server and becomes the hub; guests connect to it with a reliable JSON data channel. Presence is merged per player and the hub rebroadcasts the full list on change (66 ms tick) or every 2 s; guests heartbeat every 2 s; silent guests drop after 8 s, a silent hub after 10 s. On claude.ai the room capability is still used. Invite link = the page URL + `#code`.
- **One team per player** (v15.8): the lobby has a team picker (`lbTeams`); teams held by others are greyed with their name. Lobby order = host first, then join time (`presence.jt`); if two players hold the same team, the later one is moved to a free team with a toast (`resolveTeam`). Each human drives car 1 of their team, the teammate is AI. Max 5 racers; extra players get a "race is full" note and are left out of the grid. Pasting a room link into an open tab joins it (`hashchange`).
- STUN only (Google, Cloudflare) until v17.18, which adds PeerJS's own relay (see below). A `TURN` constant is ready for a relay login (e.g. the user's own Metered account) for players on mobile data or strict networks; RoboRally's relay login was deliberately not reused.
- Tested: two pages with a simulated PeerJS (lobby, race start, car sync, guest drop); on the live site hosting registers with PeerJS's server and shows the lobby/QR. A second tab in the same cloud test browser couldn't connect (that sandbox likely blocks peer connections), so a real two-device test is still needed. Join errors now say whether the code wasn't found, the host couldn't be reached, or the matchmaking server is down.

## Multiplayer lobby + netcode (v15.9)

- Host goes straight into a lobby; Join opens the code box. Everything is chosen inside the lobby, in order: players (name), team, circuit (poster grid), race settings, then each player's own controls.
- Up to two humans per team (teammates by join order, driver 1 then 2); a third player is moved to a team with a free seat. Empty seats are AI.
- Host sets the circuit and race settings (Opponents, Laps, Weather, Damage, Slipstream, DRS on/off, Track limits, Yellow flags); guests see them read-only. Steering, Gearbox and DRS Button/Automatic are per player.
- Smoother remote cars: 20 Hz updates with sender timestamps, arc prediction from turn rate, out-of-order packets dropped, blend instead of jumps.
- Contacts with a remote car only push the local car, more softly, and cause no damage — the remote position is a little old, so it shouldn't act like a wall.
- Shared race clock: the host sends its clock; guests slew theirs to match, so countdown, lap and finish times agree on every screen.

## v16 — practice, lap card, coaching, lobby steps

- **Practice mode** (menu mode card): only your car (team driver 1), unlimited laps, track-limits warnings without penalties. Online: host's "Session: Practice (players only)" race setting removes the AI.
- **Lap card** (`lapCard`, `#lapc`): after each lap, "LAP n/N · k LAPS TO GO / FINAL LAP", the lap time in purple (fastest of anyone), green (your best or within 0.3 s) or yellow (slower), and time gaps to the cars directly ahead and behind.
- **Coaching** (`coach`, `#fb`): "Ran wide at T6", "Slow through T4 (−18 km/h)" (apex speed under 86% of the line's), "Best yet at T7 — +4 km/h" (new personal best apex speed near the limit); passes "Nice move on Sato into T5" / "Sato gets past at T5" with ±3.5 m hysteresis and a 6 s per-car cooldown; one message per 2.5 s; none in the first 8 s.
- **Time gaps** everywhere come from timing points every 10 m of race distance (`tpRec`, `gapT`) instead of distance ÷ leader speed, so they no longer jump around.
- **Results screen** refreshes every 0.5 s while others are still running (gap or "+n laps · running").
- **Online**: name tags in team colour over other players' cars and a marked row in the standings; lobby is now three steps (Team → Circuit → Settings, host's Start on the last step); room codes are 5 characters without the gp- prefix (old links still work); remote cars only snap when 60 m off (else glide), prediction age up to 1 s.
- **Track limits** forgiven within 3 s of a car-to-car contact (toast "Forced off after contact").
- **Racing-line colours**: red only where real braking is needed (beyond drag/uphill), blips under 8 m removed; within 450 m ahead of your car the colours follow your actual speed (`liveZone`).
- **Auto steering rejoin** (`rejoin`): after a pass it keeps its lateral position and blends back so it meets the line at the next turn-in.
- **Car model**: cylinder tyres with tread, sidewall, rim and hub; smoother nose, separate sidepods and engine cover, wing endplates.
- **Touch**: throttle-only mode gets a wide GAS pill (up to 190×94 px); pads block iOS long-press loupe and double-tap zoom.
- **Circuit map** heights exaggerated 2.5–7× (relief ≈ 14% of the layout size).
- **Grandstand styles** in preview (`STAND_STYLE`, `?stands=1..5`): stepped terraces, terraces + roof, flag-colour seats, packed crowd with flags, grass bank. Options page: https://claude.ai/artifact/PEgwPvMHVRewaWZvT8dD7U

## v16.1

- **Grandstands removed** (corner stands, main-straight grandstand, Azteca stadium bowl and its pulled-in walls). Style code stays in the file (`STAND_STYLE`) but nothing uses it.
- **Gravel traps tidied**: same-side traps less than 16 m apart are joined; short ones grow to ~50 m (mostly towards the exit) where there's room, otherwise they're dropped; each trap gets a smooth inner edge (max-filtered, never inside the paint) and a smooth outer edge tapering at both ends (max ~16 m wide). Counts went from 8–20 slivers per circuit to 1–3 clean traps on the permanent circuits (Suzuka/Spa keep their big ones).
- **Race awards** on the results screen (`statTick`, `awardsHtml`): fastest lap, top speed, most overtakes (pair-wise with ±3.5 m hysteresis), places gained, time in the lead, cleanest race (off-track time + strikes + contacts), slipstream time, DRS runs, most contacts. Your car's awards are white.
- **Racing-line colours fixed**: no red when you're over the speed cap on a straight (DRS/tow) or slightly over the line's speed; in testing, red under a car not braking fell from ~45% of samples to ~2.5% and red on straights from ~5% to 0.

## v17.1 — main screen (option A)

- **Main screen** (`src/ui/home.ts`, `#home`): the attract race runs behind the logo, with a dark gradient at top and bottom. Two big pill buttons sit in the thumb zone: **Single player** (white) and **Multiplayer** (outline). Under them is a live line, "LIVE · circuit · lap n". Top corners hold round sound (mutes/unmutes music and effects together) and settings buttons. Chosen from https://claude.ai/artifact/XHFhBAh2rJgL2oujg7cALA (option A).
- **Setup panel**: each button opens the wizard as a panel, a bottom sheet on phones (≤640 px wide) and a centred card on wider screens. Close it with ✕, Escape or a tap outside.
  - Single player: Session (Race / Practice) → Team → Circuit → Settings.
  - Multiplayer: one step with "Host a room" (opens the lobby) or "Join with a code" (code box inline).
  - The gear opens the same panel with only the Driving and Display & sound settings and a Done button.
- The "Tap anywhere to start the music" hint is gone; music still starts on the first tap, click or key.

## v17.2 — timing-based starts (`src/sim/start.ts`)

- Cars stay on the grid after lights out until their driver reacts.
- **Your launch:** press the throttle after the lights go out ("Hit the GAS when the lights go out" under the lights).
- **Reaction time sets the launch**, shown as a coaching message:
  - under 0.2 s: "Perfect start", +15% drive for 2 s
  - under 0.35 s: "Good start", +7% for 2 s
  - over 0.6 s: "Slow start"
- **Jump start:** holding the throttle as the lights go out costs +5 s (a warning in practice) and an orange race-control banner.
- **Fallbacks:** if you don't react within 3 s the car goes anyway. After 8 s every car counts as launched (late join, swapped car).
- **AI reaction:** 0.12–0.55 s, quicker for drivers with high consistency, so the field spreads off the line.

## v17.3 — tooling

- Labels use title case (buttons, setting names, headings, awards, "Lap 1" on the main screen); sentences and messages stay in sentence case.
- Main-screen demo race: the followed car sits at 48% of the screen height (was 64%), clear of the big buttons.

- Circuit-map height exaggeration halved: relief ≈ 7% of the layout size, 1.25–3.5× true height (was 2.5–7×).

- **oxfmt** formats the whole project (`.oxfmtrc.json`: 110 columns, single quotes, trailing commas). **oxlint** lints it (`.oxlintrc.json`: correctness errors, suspicious warnings, zero warnings allowed). CI runs both before typecheck/build/tests.
- Lint clean-up: removed dead code left from the single-file days (the grandstand styles, stadium bowl and `placeStands`, unused locals).
- **Geist Mono** (Vercel, SIL OFL 1.1) is the font for every monospaced readout (HUD timing, standings, lap card, live line, room codes). It's self-hosted in `public/fonts/` with its licence, via the `--mono` CSS variable, and was picked over Martian Mono and Reddit Mono (https://claude.ai/artifact/6E13K89Tqfcytor9NAnZqp).

## v17.4 — team and circuit steps without scrolling (option A of both)

- **Team step:**
  - Teams are a compact list: one row per team with logo, name and driver codes with flags.
  - Under the list, a summary card for the selected team: tagline, the six car bars in two columns, and one line per driver (flag, name, trait summary). The per-driver trait bars are gone from this step.
- **Circuit step:** map first. The angled map fills the space left (still draggable to turn), with a small S1/S2/S3/DRS legend.
  - ‹ › buttons beside the circuit name change circuit, under the host-colour bar and place.
  - Below are the elevation profile and four tiles: Length, Corners, DRS Zones, and Climb (or Your Best once you have one).
  - Dots show the circuit's position in the list and jump to a circuit.
  - The posters are no longer used in this step (the lobby still has them).
- **Panel:** a fixed-height flex column (88vh sheet on phones). The team and circuit steps never scroll; the session and settings steps do.
  - Phones held sideways (≤520 px tall) get a full-screen panel: the steps sit in the header row, with two columns (team list | summary, map | circuit details).
  - Checked with no overflow at 390×844, 375×667, 844×390, 667×375 and desktop.

## v17.5 — multiplayer lobby works like the single-player wizard

- The lobby is the same bottom-sheet panel as the single-player wizard, with four steps: **Room → Team → Circuit → Settings**, the same stepper and Back/Next bar.
  - Room: QR code, room code, invite link, your name, players. Side by side in landscape so it doesn't scroll.
  - Team: the same compact team list and summary card. Rows show player names ("You" for yours, "AI" for empty seats).
  - Circuit: the same map-first picker element, moved between the wizard and the lobby. Guests see it read-only and follow the host's circuit.
  - Settings: race rules (host) and the player's own controls; Start appears for the host on this step.
- Team card: team name on its own line, tagline below it, a gap between the stat bars and the drivers.
- Circuit picker: circuit name and ‹ › arrows sit above the map (in landscape, above the map column).
- The menu shows the **last raced circuit** behind it (stored as `lastTrack`; Ardennes Forest / Spa the first time) and plays its music. Browsing circuits changes the demo race but not the music (`GS.musId`); the selected circuit's theme takes over at race start (`raceTrackStarted()` in `track/active.ts`).
- Track limits default to **Off** (a stored choice is kept).

## v17.6 — one notification style

- Every in-race message uses the coaching pill (dark, rounded, coloured dot, optional second line) in one place: top centre on desktop, above the GAS pad on touch screens (centred right of the Swap button), top centre in the menus. `notify(text, col, {sub, ttl, key, strong})` in `ui/notify.ts`; `showToast` and `rcBanner` are thin wrappers. Up to 3 stack, newest nearest the anchor; a note with the same `key` replaces the older one (`rc`, `lap`, `coach`).
- Dot colours (`NCOL`): purple best/fastest, green good, yellow slow, red off track / out, orange lost place, white race-control warning, orange (with outline) penalty, grey info.
- Lap complete is now one line: laps done and the gap to the leader ("Lap 2 of 5 · 3.4 s behind Vance", or "Leading by 1.8 s"); the dot colour still grades the lap. The big lap card, the old centre toast and the race-control banner are gone.
- Timing panel: no Last / Best lines. Time penalties are a yellow "+5" / "+10" badge floating just right of the panel on that driver's row. Your teammate's row is outlined instead of filled grey.
- Race-control notes: a black-and-white track-limits flag icon for track-limits warnings, a warning-triangle icon (and orange outline) for time penalties.
- Touch layout (`layoutPads()` in `ui/controls.ts`, run by `updatePads` and on resize): the speed panel sits left of the GAS pad, bottom-aligned (compact: no pedal bars, when narrower than 250 px; above the steering pads when those take the left side); Swap sits centred above GAS (above the gear-up / DRS pads if present). The big GAS pad is `min(40vw, 190px)` wide.
- Timing panel: no race clock (only "Get ready…" before the start).
- Timing panel gaps are relative to your car: −x.x for cars ahead, +x.x behind, ±nL when lapped; your own row has no gap.
- Fonts: **Geist** (sans, SIL OFL, `public/fonts/Geist-Variable.woff2`, CSS `--sans`) for all text, Geist Mono (`--mono`) for numbers; canvas labels use Geist too.
- Circuit picker: a row of host-nation flag buttons at the top jumps straight to a circuit (replaces the dots). In landscape the map takes the full height on the left; flags, name and details are on the right. Monaco and Bahrain flags added.
- Panels: no step headings (the tabs say it); the title carries a breadcrumb once the session type is known ("Single Player › Practice", "Multiplayer › Race · Room CODE"). Circuit place line is one line ("· Night · Street", ellipsis if still too long).
- Circuit picker no longer swaps the race behind the menu: `syncCircuit` builds the shown circuit only long enough to read its map and numbers (`withPreview` saves and restores `GS`; the map keeps its own copy of the geometry for dragging), and the selected circuit is built at race start (`buildSelectedTrack()`, and in `startMpRace` for multiplayer).
- Build: `dist/index.html` loads `main.js` / `main.css` with a `?v=<content hash>` so a fresh page never runs a stale cached bundle (GitHub Pages caches for ~10 min).
- Coach: a personal-best sector shows "Best sector 2 · 22.56" with the gain on your previous best (purple dot when it is also the fastest of anyone).

## v17.7 — renderer cleanup, one music theme

- **Canvas-only renderer**: the experimental live Three.js renderer, car sprite atlas, Settings switch and renderer benchmark were removed. Cars are drawn directly by the Canvas renderer.
- **Audio off while hidden**: on `visibilitychange` (and `pagehide`) the audio context is suspended and the silent keep-alive element paused; both resume when the page is visible again.
- **Music**: one theme for the whole game, the Ardennes Forest new beat. The other circuit themes, the drive layer and their instruments are removed.

## v17.8 — one alert at a time

- Notifications show **one at a time** by priority (`PRI` in `ui/notify.ts`): penalty 100 > track-limits / jump-start warning 90 > Go! 85 > car out 80 > DRS 60 > circuit record 55 > lap 50 > sector 40 > coach 30 > info 20. A note of equal or higher priority (or the same `key`) replaces the one showing; a lower one waits up to 3 s for it to finish, else is dropped.
- "Nice move on X" only once the pass sticks: X still behind 3 s later (`PASS_HOLD`); repassed means no message.
- Timing panel order refreshes once a second too (`HUD.order`), at once when cars join or leave and every frame outside the race.
- Timing panel gaps refresh once a second per car (immediately when a car changes side of you).
- Penalty badge sits flush against the timing panel's right edge, like a tab.
- Touch layout C (throttle only, no steering/brake/gear/DRS pads): everything on the right thumb. GAS bottom right (`min(52vw, 210px)` × 94), Swap to its left at the same height, the compact speed panel above them (at least 210 px, centred on the screen; in landscape on the bottom edge, centred unless that would reach Swap, so it doesn't cover the car), notifications above that (`--notesB`). Other control sets keep the previous layout.
- HUD panels are square (timing panel and rows, speed panel, gear box, rev bars, minimap, notifications, pause button, penalty badge); touch pads stay round.
- Settings step: no help text under Start Race, so the button sits at the bottom like the other steps.

## v17.9 — more detailed car

- The car (`render/car.ts`) is built from more slabs with smoother outlines: floor, undercut sidepods with dark inlets, a nose that steps down in three levels, monocoque with an open cockpit, engine cover with airbox, intake and shark fin, mirrors, suspension arms, a halo around a helmet with a visor, a two-element front wing (main plane + flaps + endplates) and a rear wing with beam wing, main plane and a flap that lifts and turns blue with DRS. Tyres have 20 sides.
- The far wing is drawn before the hull and the near wing after it, by the car's heading relative to the camera.
- Cars are culled at their own height (they used to be tested at ground level 0, so cars low on screen on hilly circuits could vanish early).
- Cost: render() with all 10 cars on screen went from about 5.8 to 6.2 ms in headless desktop Chrome.

## v17.10 — sponsor boards as real panels

- Lettering is painted in the board's own plane (an affine transform along the board's bottom edge, vertical kept upright, clipped to the face), so it shears and foreshortens with the board instead of floating as rotated text. No lettering on boards seen nearly edge-on (under 22% of their true length).
- Boards have thickness (a light top edge), are shaded darker the more they turn from the camera, and have a back: seen from behind they show a dark panel above the wall with posts and braces, instead of disappearing.

## v17.11 — pause bottom left, minimap without a panel

- Pause button in the bottom left corner (44 px). With steering or gear-down pads (and the speed panel above them) in that corner it sits above them (`layoutPads`).
- Minimap has no dark panel behind it; the track line is white with a faded black edge (6 px at 45%) for contrast. It moves up to the top right corner, since only the desktop Swap button is left in `#btns`.

## v17.12 — multiplayer grid

- Online races start from a random grid with the human players at the back: the AI cars shuffled at the front, the players shuffled behind them (`hostStart` in `net/netcode.ts`). The host picks the grid and sends it, so every player sees the same one.

## v17.13 — dynamic racing line (`src/sim/dynline.ts`, `src/sim/lines.ts`)

Full write-up: [dynamic-racing-line.md](dynamic-racing-line.md). Tools: [tools/README.md](../tools/README.md).

- **Why:** in one-button driving the car chased one fixed line; arriving too fast or off it meant a skid back towards it. Now a planner re-plans from the car's real position, heading and speed and steers along that plan. Controls are unchanged (hold or lift the gas).
- **Line Difficulty** (Settings · Driving, pause menu, lobby; `L` cycles in a race; `opts.dynlv`, default 3): Novice / Intermediate / Cautious Expert / Perfect Expert, or Classic (the old fixed line). Each level is the fastest line within its reserves:
  - Novice: 86% of the grip, 62% of the brakes, 2.2 m from the road edge; lifting holds your speed.
  - Intermediate: 93%, 78%, 1.5 m.
  - Cautious Expert: 97%, 90%, 1.0 m.
  - Perfect Expert: 99.5%, 98.5%, 0.3 m, and it plans skids into its braking.
- **The reserve is the player's:** with the gas held the car uses its real grip, so lifting later than the line says is faster until the road runs out. When too fast the driver turns in at the tyre limit and skids the speed off.
- **Racing Line** setting (`opts.line`: 0 Hidden, 2 Difficult Turns, 1 Shown; `H` cycles): shown by default (v17.14; races used to start hidden); practice and races each remember their own choice (`lineP` / `lineR`). Difficult Turns draws only each circuit's three to five heaviest braking points (lose 100 km/h or more, or drop to 55% of the speed or less), from about two seconds before the braking point.
- **The drawn line** (`src/render/line.ts`): the level's own line, the same every lap (v17.17; until then the plan being steered was drawn solid from the car and the level's line dashed beyond it). Green gas / yellow hold / red brake / orange brake with a skid, a white bar where each braking starts.
- **Opponents drive the lines too:** Easy = Novice, Medium = Intermediate (was "Normal"), Hard = Cautious Expert, each for its own car, at about 96.5% / 97.5% / 97.5% of the line's own speeds (`DYN_AIB`), with the existing traffic and defending logic. Lone Star solo AI laps: 57.0 / 54.0 / 52.8 s (were 66.5 / 62.7 / 60.0 s on the fixed line).
- **Other cars:** the player's planned path ignores moving cars (a pass-planning version was removed: unpredictable); the contact assist brakes behind them; stopped cars are steered round.
- **Lines are ready-made:** `public/dynlines.json` holds all 320 (8 circuits × 5 cars × 4 levels × dry/wet), built by `npm run lines`, fetched at start-up outside the bundle. A missing or out-of-date line is built in the browser in the background and cached in `localStorage`.
- **Online:** every player's car is planned locally at their own Line Difficulty (a personal control in the lobby); the host drives the AI on the room's Opponents line. The network protocol is unchanged.
- **Line builder:** periodic B-spline of lateral offsets (848 control points), lap model with the game's physics and curvature measured on the drawn path, searched by smooth multi-point bumps coarse to fine, then a wide-entry step per corner. Lone Star, Rosso, bot lifting on time: Novice 56.1 s, Intermediate 53.7 s, Cautious Expert 52.4 s, Perfect Expert 51.4 s (fixed line: 61.1 s).

## v17.14 — Classic from the experts, AI timing

- **Classic is a fixed line taken from the experts** (`adoptClassic`, `src/sim/lines.ts`): the average of the five cars' Cautious Expert lines for the circuit and weather, scaled in to the classic 1.1 m edge margin, replacing the elastic-band line once the ready-made lines have arrived. Still one fixed line for everyone, followed by pure pursuit; Lanes and Overtake steering use it too. Its speed profile uses the line's own curvature taken 10% sharper (`CLASSIC.care`). Lone Star in Classic: 54.8 s (was 61.1 s), with under a second of sliding a lap.
- **AI timing** (`AI_TIMING`, `src/sim/ai.ts`): on a dynamic line each braking zone is met early or late by a normally distributed error, spread 0.20 s Easy / 0.12 s Medium / 0.08 s Hard (a quarter less for the most consistent drivers), around an aim 0.10 / 0.08 / 0.08 s early. This replaces the wandering pace and the random late-braking moment (both still used on the classic line).
- **AI in traffic** (`AI_LANE`): a car away from its line takes corners up to 12% slower, in proportion to its distance from the line (full at 3 m) and how hard the line corners over the next 1.5 s.
- **Pace** (`DYN_AIB`): 97.3% / 98.3% / 98.3% of the line's speeds, which with the early aim keeps AI lap times where they were (Lone Star solo 57.1 / 54.1 / 52.9 s).
- **Racing Line is shown by default** in races as well as in practice (races used to start with it hidden). Practice and races still remember their own choice.
- **Result:** AI time off the tarmac in test races fell from 0.7–2.3% of race time to 0.1–0.5%, and contacts fell with it (`node tools/ai-offs.cjs`).

## v17.15 — remote cars where they really are

Players saw each other's cars about 15–18 m behind where they really were (more than three car lengths at racing speed), so side-by-side racing didn't line up between screens. Two causes, both fixed in `net/netcode.ts`:

- **Latency was assumed, not measured.** The extrapolation added a fixed 50 ms for the network. Every presence now carries the sender's clock (`ts`) and an echo of each peer's last `ts` with how long it was held; the peer that gets its own `ts` back computes the round trip in its own clock (`MP.rtt`, minimum seen drifting up slowly). Half of it is the one-way delay used to extrapolate remote cars (`oneWay()`) and to follow the host's race clock.
- **The smoothing lagged.** On each new state the correction was measured against where the car was drawn on the previous frame, so every packet pulled the car back by a frame of travel. Now the correction is the gap between the previous state's prediction and the new one at the same moment (`predict()`), fading at 6/s, while the prediction moves the car at full speed in between.

Measured with two games side by side in one page (fake PeerJS, 2 players, 20 s of racing at 40–90 m/s), error of each player's view of the other car along its heading:

| One-way latency                  | Before                          | After                            |
| -------------------------------- | ------------------------------- | -------------------------------- |
| 30 ± 10 ms                       | —                               | +0.2 m median, 95% within 2 m    |
| 120 ± 30 ms                      | −17.5 m median, 5–8% within 2 m | 0.0 m median, 89–95% within 2 m  |
| 150 ± 60 ms, 2% stalls of 300 ms | —                               | −0.1 m median, 84–89% within 2 m |

What remains is what any extrapolation has: when a driver brakes or turns in, the other screen finds out one latency later (≈ v × latency of error until the next state, a car length or two at 150 ms). Contacts with remote cars still only move the local car.

## v17.16 — joining a room, and the lobby's settings

Joining showed nothing until the lobby appeared (3.3 s from an invite link), and a mistyped code "joined" an empty room with no host. `net/multiplayer.ts` (`enterRoom`, `makeP2PApi`) and the new `net/joining.ts`:

- **Waiting screen** (`#mpWait`): up at once when a room is opened or joined, with a loading bar and the step in progress ("Reaching the matchmaking server…", "Connecting to the host…", "Opening your room…"), a Cancel button, and after 4 s a line saying it can take up to ten seconds. Each step moves the bar on and it creeps in between, so it never stands still.
- **An invite link shows the screen with the first paint**, before the game's code has loaded: a two-line script in `index.html` sets the class `joining` on `<html>` when the address has a room code, and the stylesheet shows `#mpWait` ("Joining Race · Loading the game…") in place of the main screen. `net/joining.ts` takes over when it runs.
- **Your name is remembered** in `localStorage` (`hcgp_nick`, as before) and now also in a year-long cookie of the same name (`cookie` in `core/dom.ts`); whichever survives restores the other at start-up. Clearing the box keeps the old name until a new one is typed. The name is read from the box on every kind of edit (`commitName`: input, change, key up, end of composition, blur, leaving the page) and again whenever the player's state is sent to the room, because autofill and some phone keyboards fill a box without an `input` event and the name was then shown but not saved. `store.set` no longer gives up when storage is full: it drops the cached racing lines (`hcgp_dynl_*`, which can be rebuilt) and saves again.
- **Clear buttons:** the name box and both room-code boxes have an × in a circle at their right end (`.clr` / `.clrX`), 46 px wide, always shown; the text never runs under it. One tap empties the box and keeps the keyboard up. The button keeps the focus in the box by cancelling `mousedown`, not `pointerdown`: in Safari a cancelled `pointerdown` drops the click that follows a tap, so the first version of the button did nothing on an iPhone, and what was typed after tapping it never reached the box (found with Playwright's WebKit and iPhone emulation; Chromium does not show it).
- **A guest's Room page** starts with their name and the players; the invite code and QR, which they have just used, come below (`#lobby.guest`). The host's still starts with the code and QR.
- **Failures are explained**, with Try Again and Back (Back returns to the join box with the code still in it): no race with that code, the host can't be reached, the matchmaking server can't be reached.
- **Faster:**
  - Outside claude.ai the game no longer waits 1.6 s for claude.ai's room service before loading PeerJS.
  - A guest connects straight to the host. It used to ask for the room's own id first, a wasted round trip to the matchmaking server, and the reason a wrong code opened an empty room.
  - The connection to the matchmaking server is opened ahead of time when the Multiplayer panel or the join box is opened (`mpWarm`), and dropped after 90 s if unused.
  - Measured on one machine (two tabs): invite link to lobby 3.3 s → 1.2 s, with the waiting screen up from 0.45 s; join by code 1.6 s → 1.2 s, or 0.4 s with the connection already open; online play ready after page load 2.0 s → 0.5 s.
- **A new room's code that is already taken** is replaced by another (up to three tries) instead of failing.
- **More than one tab:**
  - The invite link opened in a second tab of the host's browser joins as a second player.
  - A host that reloads its page takes its room back (the tab remembers the code in `sessionStorage`).
  - A host that closed its tab and opens the link again reopens the room as host (the browser remembers the last room it hosted for 12 hours, `hcgp_mphost`); if another tab still hosts it, the link joins that one.
  - A host tab in the background keeps its room going. Browsers slow a hidden tab's timers to once a second and later once a minute, and the hub sent the player list on a timer; it now also sends it when a guest connects and when a guest's update or heartbeat arrives late for the timer, and a guest answers the hub's list with a heartbeat when its own timer is late.
  - Not changed: a hidden tab does not draw or simulate (the browser stops its frames), so in a race only the tab in front drives.
- **Lobby settings:** the Settings step now has everything the pause menu has. "Display & Sound" (`LB_VIEW` in `net/lobby.ts`): Camera, Racing Line, Turn Numbers, Sound Effects, Music, each player's own and saved as in the menu. The Racing Line row shows the practice or race choice to match the host's Session (`linePractice()` reads the room's session while in the lobby).

## v17.17 — the drawn line is the level's fixed line

- **What is drawn** on Novice, Intermediate, Cautious Expert and Perfect Expert (`src/render/line.ts`): the best line for that Line Difficulty, fixed on the road for the whole lap, solid, coloured by the line's own speeds (green gas, yellow hold, red brake, orange brake with a skid) with a white bar where each braking zone starts. It does not move with the car.
- **What drives the car** is unchanged: the planner. On the line and at its speeds the car follows the painted line. Off it, or too fast for it, the planner works out the best way on from where the car really is and steers that; this path is no longer drawn, and neither is the pulsing red that warned when no path stayed on the road.
- **Why:** a line that redrew itself under the car told the player where the car was going rather than where it should be. The fixed line is the reference to drive to; the planner quietly handles the recovery. Measured in practice at Lone Star: knocked 3.5 m off the line at 310 km/h, the car is back within 0.25 m of it about 2 s later while the painted line stays put.
- Difficult Turns still shows only the heaviest braking points, now of the fixed line. Classic is unchanged.

## v17.18 — joining a room: retries, a relay, hosts that stay findable; name read again

Reported from two phones: opening the connection "is very inconsistent and often doesn't complete", and the name typed in the lobby wasn't there at the next join. This was written on an older base and carried over onto v17.16's join flow, whose waiting screen (`#mpWait`), fixed host and guest roles and host reload it shares. Everything here is in `net/multiplayer.ts` unless noted; `tests/multiplayer.spec.ts` covers it with a stand-in for PeerJS that lives inside the page (no internet needed).

- **Relay (TURN).** `makeP2PApi` gave PeerJS its own `config` (two STUN servers), which _replaces_ PeerJS's defaults, and the defaults are where its free TURN relay is (`eu-0`/`us-0.turn.peerjs.com`). So there was no relay at all: two devices that can't reach each other directly (mobile data, guest Wi-Fi, a router that keeps its devices apart) could never connect. `iceServers()` now merges our STUN servers with whatever the loaded PeerJS ships with (`window.peerjs.util.defaultConfig`), without duplicates, plus the `TURN` constant if filled in. Not verified: the sandbox it was written in blocks STUN/TURN traffic. A relay login of your own in `TURN` is still the dependable option.
- **Retries** (`P2P.tries` = 3), each step and attempt shown on the waiting screen ("Still connecting to the host… (try 2 of 3)"):
  - Matchmaking server: 10 s per attempt (`openMs`), again on network/server/socket errors and timeouts, pausing 0.5 s then 1 s.
  - Connection to the host: 8 s per attempt (`connMs`). If the host hasn't answered the request after 3.5 s (`answerMs`, no remote description on the connection) the attempt is dropped and repeated straight away.
  - "No such room": asked twice, 3.5 s apart (`findMs`), before saying so ("Looking for the room…").
  - These numbers come from measuring the PeerJS cloud server: it answers "no such peer" in ~0.2 s, but only once per room every ~3 s (requests in between get no reply, from any sender), and it does not hold a request for a host that registers a moment later.
- **Hosts stay findable.** A phone drops the socket to the matchmaking server when its screen locks or another app is in front, often without telling the page; the room then can't be found. So:
  - `keepRegistered`: reconnect when the socket drops (pauses of 0.25 s doubling to 8 s), and at once on `visibilitychange`/`online`. A host whose page was hidden for more than 4 s (`staleMs`) registers afresh on coming back, whatever the socket claims. Open connections are not affected.
  - Screen wake lock (`holdScreen`) while in a room, taken again whenever the page becomes visible.
  - A reloaded host page takes its room back with the key it was opened with: `sessionStorage` `hcgp_hosting` = `{ code, token, t }` (this replaces v17.16's `rl_host`), and the same PeerJS `token` lets it have its id back even if the server still holds the old registration. Cleared on leaving the room. The browser-wide memory of the last hosted room (`hcgp_mphost`, v17.16) is unchanged.
  - The hub keeps its own copy of its id (PeerJS clears `peer.id` while it's off the server, which made the host lose its "(you)" row).
  - After a freeze (tick gap > 3 s on the hub, heartbeat gap > 5 s on a guest) the silence timers start again instead of dropping everyone at once.
- **Failures say more** (`joinError`): no such room / the host isn't answering (screen off?) / found the room but no route between the devices / matchmaking server unreachable. The failure screen has its own title ("Couldn't Join AB3K9", "Lost Connection to AB3K9"). Cancel and Back also clear the room code from the address.
- **A guest dropped while in the lobby rejoins by itself** ("Reconnecting to Race …"); if the room has gone it says so, and Back goes to the main screen. In a race it's still "Lost connection" and back to the menu.
- **The lobby opens with the players already in it:** a guest waits up to 1.5 s for the hub's first list before the lobby is shown.
- **Name.** It was read from storage once, at page load, so a tab or home-screen app that had been open since before the name was last typed kept showing (and sending) the old one. Now `loadNick()` runs every time a room is entered and the lobby opens, and a `storage` event and `visibilitychange` keep an open tab in step. Runs of spaces are collapsed. Names arriving from other players get the same filter (`cleanNick`) before they reach on-screen messages (`netcode.ts`). What can't be fixed from the page: a private tab, an in-app browser, or a home-screen icon each keep their own storage, so a name typed in one isn't known in another.
- **Tests:** eight in `tests/multiplayer.spec.ts`: a guest retries until the connection opens; a guest never opens a room of its own; a failed join says why and Try Again gets in; Cancel stops a waiting join and a second tap starts no other; a dropped guest rejoins; a reloaded host comes back as host; the name is saved as typed and read again; the relay is in the server list.

## Model

- Tracks: control points → Catmull-Rom → smoothed and resampled every 2 m (`buildTrack()`). Long straights need intermediate control points: without them the spline overshoots at the next tight corner and makes a near-cusp (a 4–7 m radius). That happened on the first Mexico and Vegas drafts.
- Per-track options: `hw`, `smooth`, `street`, `water`, `tunnel`, `night`, `palms`, `runoffAsphalt`, `elev`, `paint`. New in v13:
  - `bridge`: the circuit crosses itself; see Crossover bridge below.
  - `sakura`, `forest`: cherry-blossom trees with petals; pine forest.
  - `trees`, `treeGap`: tree count and clearance.
  - `wall`: maximum runoff width.
  - `stadium:[cp,cp]`: grandstand bowl round that section.
  - `wheel:[sample,offset]`: Ferris wheel.
  - `neon`, `dark`: neon city and night-darkness colour.
  - `sphere:[x,y,r]`: LED sphere.
  - `fountain:[[x,y],[x,y]]`: line of fountain jets.
  - `host`: country code of the big flag.
  - `crowdCols`: crowd colours.
  - `stands`: maximum number of corner stands.
- **Control point → sample** (`cpIdx`, v13): nearest sample, penalised by the angle between the sample's heading and the control point's direction of travel. This gives the right pass at a crossover, where two control points share the same position; plain nearest-point would put the upper and lower elevation keys on the same sample.
- **Crossover bridge** (`BRIDGE`, v13):
  - Found as the closest pair of samples at least 150 samples apart. The higher one is the upper pass, and the deck covers the samples whose distance to the lower road is under 2·HW + 14 m.
  - Walls: the deck has walls at HW+1.6 m, and the road beneath has walls at HW+3 m, both easing back out.
  - Pillars stand either side of the lower road.
  - Car collisions are skipped when the cars' heights differ by more than 3 m.
  - Rendering:
    - The deck shadow is drawn on the ground pass.
    - After all other objects comes the bridge pass: pillars, deck sides, deck, asphalt, walls. Then the cars on the bridge are drawn again on top.
    - The deck turns 42% opaque while your car is underneath.
  - Track and runoff bands are drawn as per-segment quads with nonzero fill on a crossing track: even-odd edge loops would cut a hole at the crossing. Non-crossing tracks keep the faster even-odd loops.
- **Per-side walls** (v13.1): `BARR` (+normal side) and `BARL` (−normal side) replace the single symmetric `BAR` for walls, runoff fill, mowing stripes, slope shading, paint room, gravel width, wall physics and the bridge deck.
  - On the inside of a corner the wall is capped at 0.7 × the corner radius: the max inward curvature over ±12 samples, min-filtered ±10 and smoothed ±6. A wall further out than the radius folds the barrier line back on itself (the "bow ties", worst in the COTA esses).
  - Folds per circuit went from 0–128 to 0 on all eight.
  - `BAR` is still the symmetric maximum used for scenery placement. `clear()` now checks the wall on the side the point is on.
  - `band()`/`edge()` take `SIDES={R,L}`.
  - Side effect: running wide on the inside now meets a wall sooner. COTA flat-out vs ideal went from ~−0.6 s to +3.9 s.
- **Elevation**: `HT[i]`, `SL[i]`; gravity along the slope; slope shading; gradient readout. Cars are placed at the right height when the grid is set up (`locate()` in `setupRace`). This fixed cars floating or sinking before lights out on raised grids such as Interlagos and COTA (hot-fixed live first).
- The classic racing line comes from elastic-band curvature minimisation (the dynamic lines of v17.13 are searched for lap time instead). Speed profiles come from `profileFor(stats)` (grip, braking and acceleration passes, rain, slope, team).
- Surfaces (grip; extra drag):
  - 0 asphalt: 34.
  - 1 kerb: 31.
  - 2 grass: 18; drag 1.2 + 0.06v + 0.0012v².
  - 3 gravel: 10; drag 4 + 0.2v.
  - 4 asphalt runoff: 26.
  - 5 paint: 19.
- Collision: two circles per car, side-contact separation. Wall contact by impact angle. Ghosting for stuck cars.
- **Night layer**: offscreen dark fill (per-track colour), light pools punched out, warm additive tint. Emissive items are drawn after it in `drawNeon()`: building neon (`NEONQ`, filled in `drawBox0`), wall neon, the sphere and the fountains. Lit crowd boxes are now culled off-screen.
- **Lap and frame numbers** (v13):
  - AI best laps, 240 s AI race: Azteca ~55–59 s, Sakura ~62–67 s, Ardennes ~58–61 s, Neon Strip ~55–60 s. In those races: 0–5 contacts, no index jumps at the crossover, no ghosts.
  - Flat-out penalty (gas-held throttle-only bot vs ideal): Azteca +4 to +6 s, Sakura +5 to +8 s, Ardennes +1.3 to +2.3 s, Neon Strip +4 s.
  - Phone-sized frame times (headless desktop Chrome): 5–20 ms. Sakura and Neon Strip are the heaviest, at ~20 ms.

## Change log

- Catch-up strength (Nov 2026): Slipstream is a slider from Off (0) and Normal (1) up to 5× in steps of 0.25 (`opts.tow`; a stored 1 from the old On stays Normal), and a new **DRS Strength** slider goes from Normal (1) to 5× (`opts.drsPow`, stored as `hcgp_drsPow`; turning DRS off is still the DRS rule). Both multiply the effect in `physics()` (slipstream: +7.5% top speed and +0.9 m/s² pull at full tow; DRS: +5.5% top speed and +6% pull) and the matching AI and assist speed allowances. `c.tow` itself stays 0..1 (how much tow the car has), so the HUD chevrons, the wind sound and the Slipstream King award are unchanged. Online, the host sets both for everyone in the lobby.
- Throttle only (Nov 2026): the Pedals setting is gone (main menu, pause menu, online lobby and the in-race button), and with it Brake only, Throttle + Brake and Auto pedals, the BRAKE pad, the brake keys (Down / S) and the "tap to launch" start. Lock-ups went too: they only happened when you worked the brake yourself.
- Tyre wear removed (Nov 2026): no Tyre Wear rule (single player or online), no tyre bar in the HUD, no Tyre Life bar on the team cards and no tyre-care driver trait. Grip now changes only with damage, dirt and weather.
- v2–v12: see earlier entries: runoff/AI fixes, gravel, audio, slipstream, COTA/Interlagos, Monaco, tyres/damage/yellows, multiplayer, rain, Bahrain night, western theme, contact reduction, team stats/logos/flags, Lane steering, elevation, painted run-off, pits and flags, Pedals/Steering split, big painted fields, Overtake steering.
- v12.1 (hotfix): grid cars are drawn at the right height before lights out on elevated grids.
- v13: renamed **Racing Line**.
  - Circuits: Autódromo Azteca (Mexico City, stadium section) replaces Riverside Park. New: Sakura Ring (Suzuka, crossover bridge, cherry blossoms, Ferris wheel), Ardennes Forest (Spa, pine forest, Eau Rouge) and Neon Strip (Las Vegas, neon night street race, LED sphere, fountains).
  - Music: mariachi, Japanese, Belgian new beat and electro-house themes.
  - AI defending scaled by difficulty.
  - Single-player swap slow-motion camera pan.
  - Pit entry/exit lanes, corner grandstands on every circuit, and big host-nation flags.
- v14.8: per-driver traits (pace, aggression, defending, consistency, wet, tyre care) shown in the menu and shaping the AI; Auto pedals; speed panel without the driver name.
- v14.5: Monaco tunnel as an open cut-away with lit walls and portals; timing panel narrowed further.
- v14.1: buildings sink out of the camera's way; settings in the pause menu; narrower timing panel; long continuous sponsor runs drawn on top; faster night rendering.
- v14: Marina Night (Singapore) replaces Neon Strip; sector timing and numbered corners on the track; solid walls with sponsor hoardings and catch fences; HUD cleanup (single panel, settings only in the menu).
- v13.1: no more bow-tie walls (per-side walls capped by the corner radius); pit wall beside the track with a functional-looking pit lane (fast and working lanes, team boxes, speed-limit lines, entry and exit cut through the pit wall).

## Ideas next

- Pit stops using the new entry/exit lanes (repairs; wet vs slick tyres), DRS zones, changing weather.
- Make the corner stands read better from above: roofs, or a stepped seating texture.
- Car liveries with team logos.
- Online: chat/reactions, spectating, flag picker for humans.
- Crowd audio only with a real recorded sample.
- Performance: if phones struggle on Sakura Ring or Neon Strip, cut petal count, batch neon strokes, or cache the crossover quads.

## v17.18 — Isometric camera only, no lift bars

- The chase camera is gone: the camera always looks along the fixed isometric bearing `ISO_A` (−45°, tilt 0.5,
  height scale 0.8). Removed with it: the Camera setting (Settings, pause menu, lobby view options), the hidden
  Cam button and `toggleCam`. A stored `hcgp_cam` is now ignored.
- The racing line no longer draws the white bar where each braking zone starts; the red section shows it.
