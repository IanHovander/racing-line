# Racing Line — design notes

(Formerly "Heli-Cam GP"; renamed in v13. Saved settings keep the old `hcgp_` storage prefix so nobody loses their options or best laps.)

Playable build: https://matthewtorgerson.github.io/racing-line/ (GitHub Pages, built from this repo by GitHub Actions). Up to v16.1 the game was one self-contained HTML file; it is now a TypeScript app (see CLAUDE.md).

## What's in the game

- **View**: helicopter chase cam (rotates with the car, looks ahead with speed, and follows the car's height) or fixed isometric; 2.5D projection with extruded cars, trees, grandstands, garages and buildings.
- **Controls**: two independent settings, in the menu and as in-race buttons (keys M and N).
  - **Pedals** (`opts.pedals`): Throttle only (lift and the car auto-brakes to the safe speed), Brake only (the car accelerates by itself; only the brake keys brake), Throttle + Brake, and Auto (v14.7, `opts.pedals=3`: the car works both pedals itself to the safe speed for the steering mode, like the AI; on touch the GAS and BRAKE buttons are hidden). All 16 pedal/steering combinations are tested.
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

  | Team             | Logo                              | Drivers (nationality)                       | Car character                                         | top  | acc   | brk  | grip  | tyre wear | damage taken |
  | ---------------- | --------------------------------- | ------------------------------------------- | ----------------------------------------------------- | ---- | ----- | ---- | ----- | --------- | ------------ |
  | Scuderia Rosso   | red shield, yellow lightning bolt | M. Vance (Canada), L. Moreau (France)       | Power: fastest on the straights, hard on its tyres    | 1.05 | 1.02  | 1.0  | 0.984 | 1.12      | 1.0          |
  | Argent GP        | silver hexagon, teal chevrons     | J. Keller (Germany), T. Okafor (Nigeria)    | All-rounder: no weak spot, toughest chassis           | 1.01 | 1.01  | 1.05 | 1.006 | 1.0       | 0.85         |
  | Papaya Racing    | orange disc, blue swoosh          | E. Lindqvist (Sweden), K. Sato (Japan)      | Downforce: best in the corners, slow on the straights | 0.98 | 1.0   | 1.0  | 1.026 | 1.05      | 1.1          |
  | Verde Motorsport | green leaf, lime V                | R. Duarte (Brazil), S. Visser (Netherlands) | Late brakers: best stopping power, kindest to tyres   | 1.01 | 1.0   | 1.36 | 1.0   | 0.75      | 1.0          |
  | Azure F1         | blue diamond, pink star           | P. Novak (Czechia), D. Ferreira (Portugal)  | Traction: rockets out of slow corners                 | 0.99 | 1.055 | 1.0  | 0.997 | 1.0       | 1.15         |
  - Multipliers in `TEAM_STATS`; each team has its own speed profile `PROF[team]`. Balanced from measured lap-time sensitivities: all five cars lap within ~0.15 s.
  - Original inline-SVG logos (`LOGOS`) and driver flags (`FLAGS`).

- **Driver traits** (v14.8, `DRIVER_STATS[team][driver]`, helper `DRV(c)`). Each driver has six traits from 0 to 1 (0.5 = average) that change how the AI races that car. They don't change how the car drives under your control, except tyre care, which always applies.

  | Driver       | Pace | Aggression | Defending | Consistency | Wet | Tyre care | Summary                              |
  | ------------ | ---- | ---------- | --------- | ----------- | --- | --------- | ------------------------------------ |
  | M. Vance     | .80  | .75        | .60       | .55         | .60 | .40       | Fast and fearless, hard on tyres     |
  | L. Moreau    | .65  | .50        | .70       | .75         | .50 | .60       | Steady team player                   |
  | J. Keller    | .80  | .45        | .65       | .90         | .70 | .70       | Metronome — rarely makes a mistake   |
  | T. Okafor    | .70  | .70        | .55       | .60         | .80 | .50       | Bold overtaker, great in the rain    |
  | E. Lindqvist | .75  | .35        | .50       | .80         | .90 | .65       | Clean and calm, rain master          |
  | K. Sato      | .70  | .60        | .80       | .70         | .55 | .75       | Tough to pass, kind to tyres         |
  | R. Duarte    | .75  | .85        | .70       | .50         | .85 | .45       | All-out attacker, thrives in the wet |
  | S. Visser    | .70  | .65        | .90       | .65         | .60 | .55       | The wall — defends everything        |
  | P. Novak     | .60  | .40        | .45       | .85         | .50 | .85       | Tyre whisperer, long-run specialist  |
  | D. Ferreira  | .65  | .80        | .55       | .45         | .65 | .50       | Wild card — brilliant or in the wall |

  Effects:
  - Pace: ±1.2% AI speed.
  - Wet: ±3% in rain.
  - Consistency: a speed wobble of up to ±2% × (1 − consistency), re-rolled every 1.5–3.5 s. There's also an occasional late-braking moment (+3.5 m/s for 0.45 s) at a rate that grows with (1 − consistency)².
  - Aggression: looks for passes earlier (look-ahead 20 + 12×aggr m), takes gaps up to 0.25 m tighter, and follows up to 1.5 m closer before backing off.
  - Defending: scales the difficulty's defend chance by 0.4 + 1.2×defend and the cover speed by 0.7 + 0.6×defend.
  - Tyre care: wear × (1.2 − 0.4×tyre).
  - In the menu, the team panel shows both drivers with flag, summary and six bars.
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
  - Contents: LAP n/N with the race time (monospace), then last and best lap, tyre/damage bars when on, then the standings (position, team logo, first three letters of the surname, monospace gap). Your car's row is yellow and your teammate's light blue. There's no separate position display or flags.
  - In-race buttons: only Swap car and pause.
  - Pedals, steering, camera, racing line, sound effects and music are set in the main menu or in the pause menu (v14.1; both stay in sync via `SEG_SYNC`). The M/N/V/L keys are gone.
  - Narrower panel (v14.5, ~116 px on a phone): the race time sits under LAP n/N, Last and Best are on two short monospace lines, and the columns are tighter.
- **Buildings in the way sink** (v14.1, reworked v14.6): a tall building sinks if its whole footprint is nearer the camera than any piece of road on screen it covers. The road's centre line and both barriers count, sampled every 4 m around the whole lap wherever it's in view, so you can always see all the road in shot. Buildings beyond the road stay full height. It sinks smoothly to ~7% of its height (`b.sink`, about 0.2 s), replacing the old 16% fade; the chase cam no longer shrinks all buildings, and window rows are batched into one fill per building.
- Night performance (v14.1): the light pools use two pre-rendered sprites (`POOLS`) instead of a new radial gradient per pool per frame, and the dark layer renders at half resolution.
  - The speed panel shows speed, gear and gradient, plus a surface warning line (GRAVEL!, SLICK PAINT, OFF TRACK, SLIDING) only when one applies. The driver's name was removed in v14.7; it's in the timing panel.
- **Monaco tunnel** (v14.5): an open cut-away (`TUN_STYLE=2`, `drawTunnelFloor`, `queuePortals`). There's no roof; the road inside is darkened, the inner walls are 4.2 m tall and dark, warm strip lights run along both walls with glows, and each end has a concrete portal (pillars and a plain lintel at 4.5–5.8 m, no sign) that's depth-sorted with the cars.
  - Chosen by the user over a hotel roof that turned see-through and a glass roof with ribs. Both replaced the old translucent grey slab and have since been removed.
- **Weather (Dry / Rain)**: lower grip on every surface, wet speed profiles, ~10% slower laps, rain visuals and hiss.
- **Slipstream**: tow from a car 5–45 m ahead within ~2.4 m sideways; up to +7.5% top speed; subtle streaks, HUD bar and wind hiss.
- **Race rules**: Tyre wear, Damage & knockouts, Yellow flags (Off / 3 / 10 / 30 s) with +5 s for passing under yellow.
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
  - The speed panel has a red brake bar on the left and a green throttle bar on the right, filled by the current pedal values (`c.thr`, `c.brk`).
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
  - Effect: +5.5% top speed and +6% pull while open. The AI and the throttle/auto-pedal assists may go above the usual speed cap on the straight.
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
- **Settings regrouped** into sections (main menu): Race (Opponents, Laps, Weather) · Driving (Pedals, Steering, Gearbox) · Rules (Tyre wear, Damage, Slipstream, DRS, Track limits, Yellow flags) · Display & sound (Camera, Racing line, Turn numbers, Sound, Music). Pause menu uses the same grouping.
- **Turn numbers toggle** (`opts.turns`, default shown): hides the on-track corner boards.
- **Menu music:** audio is started on page load where the browser allows; otherwise a small "Tap anywhere to start the music" hint shows and the first touch/click/key anywhere starts it (browsers block sound before the first interaction).
- **Standings colours:** your row white with black text; teammate light grey (#c4c9d1).
- **Race-control banner** moved low: just above the speed strip (desktop bottom 128 px; touch above the strip between the swap and DRS pads; landscape just above the strip).
- **Swap:** big round SWAP pad on touch (left, above the gear/steer pads in portrait; bottom centre-right in landscape), top Swap button enlarged on desktop and hidden on touch.
- **Crowds:** stands now draw rows of seats facing the track with people seated in rows (muted colours), replacing random coloured confetti on the roof.
- **Lock-ups:** only when you control the brake (Brake-only or Throttle+Brake pedals). Braking hard while still turning (brake demand + cornering load > 1.32 × grip) locks the fronts: braking falls to 78% of grip and steering to 42% (runs wide), white tyre smoke from the fronts, skid marks, a tyre squeal, a "LOCK-UP" tag above the speed strip, and a small flat-spot tyre-wear cost.
- **Defaults:** Pedals = Throttle only (you hold the throttle, the car brakes itself), Steering = Auto, Gearbox = Automatic, DRS = Automatic. Applied once to existing players too (`defv4`); later choices are kept.
- **M. Vance is Canadian** (was Irish); new `CA` flag (red-white-red with a drawn maple leaf), used in the menu, standings and pit-lane flag row.
- **Papaya Racing logo** is now the two-tone chevron P (orange bowl, blue leg, dark counter; option g of https://claude.ai/artifact/4WGiKPFuqfU33EwQ7UMF7b). Other teams unchanged.
- Option pages for pending choices: team logos https://claude.ai/artifact/2voBPsJDVV3VAkeSQxRNm9 ; car markers + defend notifications https://claude.ai/artifact/5T4gSnxxS7UPRTN4oLxcR3

## GitHub Pages + WebRTC multiplayer (v15.7)

- **Hosted at https://matthewtorgerson.github.io/racing-line/** from repo `matthewtorgerson/racing-line` (branch `main`, root): `index.html`, `vendor/peerjs.min.js` (PeerJS 1.5.5, MIT), README. The old `matthewtorgerson.github.io` repo's custom-domain claim (www.matthewtorgerson.com) was removed so project pages stop redirecting to the Squarespace site.
- **Multiplayer outside claude.ai** uses PeerJS (`makeP2PApi`), modelled on the RoboRally website mode: same interface as claude.ai's room service (`join → onPeers / presence / leave`). The first browser to open a code registers `racingline-mt-<code>` on PeerJS's free cloud server and becomes the hub; guests connect to it with a reliable JSON data channel. Presence is merged per player and the hub rebroadcasts the full list on change (66 ms tick) or every 2 s; guests heartbeat every 2 s; silent guests drop after 8 s, a silent hub after 10 s. On claude.ai the room capability is still used. Invite link = the page URL + `#code`.
- **One team per player** (v15.8): the lobby has a team picker (`lbTeams`); teams held by others are greyed with their name. Lobby order = host first, then join time (`presence.jt`); if two players hold the same team, the later one is moved to a free team with a toast (`resolveTeam`). Each human drives car 1 of their team, the teammate is AI. Max 5 racers; extra players get a "race is full" note and are left out of the grid. Pasting a room link into an open tab joins it (`hashchange`).
- STUN only (Google, Cloudflare). A `TURN` constant is ready for a relay login (e.g. the user's own Metered account) for players on mobile data or strict networks; RoboRally's relay login was deliberately not reused.
- Tested: two pages with a simulated PeerJS (lobby, race start, car sync, guest drop); on the live site hosting registers with PeerJS's server and shows the lobby/QR. A second tab in the same cloud test browser couldn't connect (that sandbox likely blocks peer connections), so a real two-device test is still needed. Join errors now say whether the code wasn't found, the host couldn't be reached, or the matchmaking server is down.

## Multiplayer lobby + netcode (v15.9)

- Host goes straight into a lobby; Join opens the code box. Everything is chosen inside the lobby, in order: players (name), team, circuit (poster grid), race settings, then each player's own controls.
- Up to two humans per team (teammates by join order, driver 1 then 2); a third player is moved to a team with a free seat. Empty seats are AI.
- Host sets the circuit and race settings (Opponents, Laps, Weather, Tyre wear, Damage, Slipstream, DRS on/off, Track limits, Yellow flags); guests see them read-only. Pedals, Steering, Gearbox and DRS Button/Automatic are per player.
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
- **Your launch:** press the throttle after the lights go out. In pedal modes without a GAS pad (Brake only, Auto), any tap or key launches the car. The text under the lights says which ("Hit the GAS / Tap when the lights go out").
- **Reaction time sets the launch**, shown as a coaching message:
  - under 0.2 s: "Perfect start", +15% drive for 2 s
  - under 0.35 s: "Good start", +7% for 2 s
  - over 0.6 s: "Slow start"
- **Jump start:** holding the throttle as the lights go out costs +5 s (a warning in practice) and an orange race-control banner.
- **Fallbacks:** if you don't react within 3 s the car goes anyway. After 8 s every car counts as launched (late join, swapped car).
- **AI reaction:** 0.12–0.55 s, quicker for drivers with high consistency, so the field spreads off the line.

## v17.3 — tooling
- Circuit-map height exaggeration halved: relief ≈ 7% of the layout size, 1.25–3.5× true height (was 2.5–7×).

- **oxfmt** formats the whole project (`.oxfmtrc.json`: 110 columns, single quotes, trailing commas). **oxlint** lints it (`.oxlintrc.json`: correctness errors, suspicious warnings, zero warnings allowed). CI runs both before typecheck/build/tests.
- Lint clean-up: removed dead code left from the single-file days (the grandstand styles, stadium bowl and `placeStands`, unused locals).
- **Geist Mono** (Vercel, SIL OFL 1.1) is the font for every monospaced readout (HUD timing, standings, lap card, live line, room codes). It's self-hosted in `public/fonts/` with its licence, via the `--mono` CSS variable, and was picked over Martian Mono and Reddit Mono (https://claude.ai/artifact/6E13K89Tqfcytor9NAnZqp).

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
- The racing line comes from elastic-band curvature minimisation. Speed profiles come from `profileFor(stats)` (grip, braking and acceleration passes, rain, slope, team).
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

- Pit stops using the new entry/exit lanes (tyres, repairs; wet vs slick tyres), DRS zones, changing weather.
- Make the corner stands read better from above: roofs, or a stepped seating texture.
- Car liveries with team logos.
- Online: chat/reactions, spectating, flag picker for humans.
- Crowd audio only with a real recorded sample.
- Performance: if phones struggle on Sakura Ring or Neon Strip, cut petal count, batch neon strokes, or cache the crossover quads.
