# The intro: "Lights Out"

About 24 seconds over the live game, before the home screen (and, later, before the campaign's cold open). Five beats,
each switching on one more of the race's start bulbs; then lights out, the world floods into colour and the title lands
on the home screen. Code: `src/intro/`. Art direction: the "Lights Out" art bible, Ligne Claire edition (the story
layer is a clean-line comic: cream panels, ink outlines, hard ink shadows, one red; the world before lights out is an
uncoloured comic page).

## How it was chosen

Three directions were weighed before the art bible set the board:

1. **Five in a row.** Gus counts a streak at Turn 1 ("One." "Two." "Don't think. Three.") and each count lights a
   start bulb; at five he says "There." and the lights go out into the world of circuits. Hook: the campaign's own
   drill is a countdown everybody knows.
2. **Draw the line.** One stroke of the racing line draws Turn 1, then the circuits, then the logo. Beautiful, but
   cold: no Gus, no stakes.
3. **Four hundredths.** Gus's lost title, then a rookie at Turn 1. All heart, little momentum.

The art director's board keeps the best of 1 and 3: the five lights are the structure (anything counted to five uses
the gantry), the wound opens it (MARLOW +0.040), and the release is lights out into the game itself. It is the right
call because the payoff is the real game: what floods into colour is what the player is about to drive.

## The board as built

The clock runs on the game's music tempo, 112 bpm (a beat is 0.536 s), so lights out is the first beat of the home
screen's music, which then simply carries on. Times are from the first tap.

| Time  | Beat              | What happens                                                                                                                                                                                      | Sound                                     |
| ----- | ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------- |
| 0.00  | Light 1 The wound | A blank page. The caption FINAL ROUND · LAP 71 types on, then the timing tower: 1 VANCE, 2 MARLOW, and +0.040 in red. At 3.21 s, a hard cut to +0.040 as the close-up, in its own panel.          | the beep, then nothing                    |
| 4.29  | Light 2 Dawn      | The real renderer, graded as an inked page. The helicopter comes down from high over Lone Star onto the one car on track and follows it into Turn 1. Caption: LONE STAR CIRCUIT · TURN 1.         | beep; dawn air; the one engine, nearer    |
| 8.57  | Light 3 The line  | Cut to the whole corner, empty. The racing line draws itself at a racing car's pace: paper on the approach, red from the lift point, green from the apex, each inked. "Lift." where it turns red. | beep; air                                 |
| 12.86 | Light 4 Gus       | Cut to Gus's panel on the page. His balloon: "Turn 1." (13.93), then "Again." in red (15.00). His mouth opens on each line, one blink at 16.34.                                                   | beep; a radio click before each line      |
| 17.14 | Light 5 You       | Your helmet, car 27, in a panel over the ten cars on the grid (the home screen's own camera, still graded).                                                                                       | beep; engines idle, revs climb from 18.54 |
| 20.29 | the hush          | Everything holds.                                                                                                                                                                                 | 0.6 s of silence                          |
| 20.89 | Lights out        | All five bulbs go dark; the grade drops to colour in 120 ms; the cars launch.                                                                                                                     | a low thump, ten engines; the music       |
| 21.13 | the title         | The dark bulbs make way; RACING LINE flies in from the left (the way its own streaks point), lands at 21.43.                                                                                      | a whoosh                                  |
| 23.04 | settle            | The home screen's buttons and shading arrive.                                                                                                                                                     | the music plays on                        |
| 23.57 | hand over         | The intro is gone; the home screen is exactly what was on screen.                                                                                                                                 |                                           |

### Where the board was refined, and why

- **The close-up on +0.040** (light 1). The bible says numbers are the close-ups; holding on a row of the tower read
  as a table. The number gets its own panel for the last second of the beat, like a face.
- **Light 2 follows the car down.** Framed on the whole corner the one car is a speck. The helicopter comes down onto
  it and follows it into the hairpin, and light 3 cuts to the whole, empty corner for the line. Every light is a panel
  cut, so the cut costs nothing.
- **A place caption** on light 2 (LONE STAR CIRCUIT · TURN 1): a comic's narration box, so "Turn 1." in Gus's balloon
  lands on a corner the player has just seen named.
- **The page is paper, not ink.** On an ink page the panels' ink outlines and hard shadows disappear; on paper the
  story layer reads as a comic page, the same page the inked world is printed on.
- **Lights out comes a beat early** (beat 39, not 40): real lights go out when they choose, and the break in the
  rhythm is what makes it violent. It is still on the music grid, so the game's music starts on its first beat.
- **The title arrives from the left**, not the right: its own speed streaks point that way.
- **No music before lights out.** The bulbs' beeps, a little dawn air, one engine and Gus's radio are the whole score
  until the game's own music starts at lights out, and the home screen simply keeps it.

## The handover

The intro never moves the camera after light 4: light 5 and lights out are the home screen's own camera on the held
grid, and the title is the home screen's own logo element, animated to its place. When the intro ends, nothing
changes on screen: the last frame and the home screen's first are pixel-identical apart from the waving flag and
sub-pixel edge noise while the game camera settles (checked with a pair of screenshots at 390x844 and 844x390).

## Playing it

- **Once per browser**, on the first visit to the published game (the key `hcgp_introSeen` in localStorage). Not on
  localhost, with `?debug`, under test automation or from an invite link, so the tests and tools see the home screen
  as before.
- **`index.html?intro`** replays it (`intro.html` redirects there). `&at=SECONDS` freezes a frame, `&mute` plays it
  without its sounds.
- **Taps.** The first tap starts it with sound (iOS only lets sound start from a tap); muted, it starts by itself.
  After the first second a tap skips to lights out, and one after lights out goes straight to the home screen. If the
  phone held the sound back, the next tap only wakes it. Space, Enter and Escape do the same. A Skip label shows while
  a skip is possible.
- **The campaign** calls `playIntro({ onDone })` from `src/intro/index.ts`. Called from a tap, the sound is already
  running and it starts at once.
- **Reduced motion**: the title appears where it lands, without the flight or the streaks.

## The code

- `world.ts` is the only file that touches the game: Turn 1 measured from the circuit the game built, the
  helicopter (`camera.flyTo`, `camera.frame`, `camera.track`), the grade (`setGrade`, the kit's `INKED_PAGE` on the
  game canvas), the cars (`showCorner`, `showGrid`, `placeCar`, `carsLaunch`), the line drawn over the frame, and the
  audio output and music. Porting the intro to Matthew's Three.js main means rewriting this file.
- `board.ts` is the film: the timeline and a function from the clock to the frame (world, overlays) and its sound
  cues. `intro.css` styles it; panels, balloons, captions, bulbs and portraits are the art kit's (`src/art/`).
- `sound.ts` is the intro's own synth: the start beep (the race has none, and Matthew's main has none either, so the
  port carries this file along), the dawn air, the engines, the radio click and the whoosh.
- `index.ts` is `playIntro()`: the clock (the audio clock while sound runs, so the beeps and lights out land on their
  frame), cue scheduling, taps, and the handover. `boot.ts` decides at load (with the script in index.html's head,
  so the home screen never flashes first) and loads the rest only when it plays.
- The game has three small hooks, all inactive unless the intro plays: `GS.INTRO.hold` keeps `step()` still,
  `GS.INTRO.camera` runs first in `updateCamera()`, and `GS.INTRO.after` draws after `render()`.

## iOS Safari

The grade is a CSS filter on the game canvas (`grayscale(1) brightness(1.6) contrast(2.6) sepia(.1)`); Safari on iOS
applies CSS filters to a canvas, composited on the GPU, and the canvas still redraws every frame under it. If a phone
struggles, the filter is the first thing to measure. Sound needs a tap and goes through the game's own audio context,
which already plays with the ringer switch off.

## Rough edges

- The race itself still has no start beep; the intro's beep lives in `sound.ts` if the race wants it.
- The intro's sounds were mixed by numbers (levels and timing checked, not by ear on a phone).
