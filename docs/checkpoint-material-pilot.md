# Checkpoint: the shop corner's material pilot

**Scope.** How the ground at the finished shop corner responds to the corner's own lights: the shopfront's lit
windows and neon, the blade sign and the streetlight. Night, intersection scenes with materials, and only where
`storefrontFor` finds a storefront. Seed 7 is the pilot; seeds 0 and 8 check variation.

**Unchanged:**

- walls, entrances, cover, activity groups, saved layouts and the default camera;
- movement, targeting and damage;
- the lights themselves, their pools, the lamp shadows (`groundShadows.ts`) and the wall light;
- every other environment.

There are no new assets and no new light sources.

**Not verified:** a real `/play` fight and save/load (no Supabase session here). The board this was judged on is
`/scene-review`'s, which is the shipping renderer. The manual checklist in `checkpoint-shadow-state.md` §5 still
applies, now with the reflections on.

## 1. The regression check's rounding limit

`comparePixels` (`groundShadows.ts`) now enforces what `checkpoint-shadow-state.md` stated.

- **The rule.** A channel the board keeps at the standing value counts as rounding only when the fresh render is
  at most `ROUNDING_MAX` (3/255) below it. A larger drop is unexplained and fails the check.
- **The test.** `groundShadows.test.ts` adds a case with a drop of 4 that fails, beside an accepted drop of 3
  that is still counted.
- **The numbers are unchanged:** at most 3 channels per state, never more than 3/255. Nothing in the shadow
  appearance was retuned. Output: `docs/evidence/material-pilot/shadow-state-check.txt`.

## 2. The visual target

`compare/reference-vs-baseline.jpg` sets the reference beside seed 7 at play zoom, scaled ×1.25 so the actors
match (about 70 px). `compare/reference-vs-pilot.jpg` does the same for the result.

**Surface response** (what this pilot is about):

1. **The reference's ground is wet,** and the game's is matte. Every light is doubled below itself as a broken
   vertical streak in its own colour: tail lights red, neon cyan and violet, windows amber.
2. **Inside a light, the surface sparkles.** Rough asphalt and paving catch the light on their aggregate in crisp
   points, while the dark between the lights stays dark.
3. **The three surfaces respond differently.** Asphalt glitters, slabs take a patchy sheen with dark joints, and
   painted lines read clean and bright.

**Architecture and framing** (not changed here, and most of the gap):

- **Many more sources.** The reference has shopfronts on three sides, signals, headlights, tail lights and neon
  at street level. Seed 7's corner has one lamp, a sign, two windows and a blade.
- **Where the reflections can land.** The reference's lights stand over open road and wide pavement. In front of
  seed 7's shopfront is about a metre of recess, then the next block's footprint. So the windows' mirror images
  can only land in the recess, and the lamp's lands behind the stall's crate (§3).
- **Palette.** The reference is warm and saturated against a cool ambient. The game is cool with warm pools.
- **Framing.** The reference looks into its corner. The game's camera looks at the shop's roof from behind.

## 3. What was built (`courtyard/groundReflection.ts`)

Two earlier treatments were tried and omitted:

- **Puddles** (`checkpoint-atmosphere.md` §4) were placed where water collects. They were nowhere near where
  the lights' reflections land, and a 5 px reflection read as a dotted line.
- **A sheen** (`checkpoint-ground-light.md` §4) was a blurred lobe of each light's colour at its mirror point,
  multiplied by the ground's albedo. It had no shape and no surface, and read as haze.

This pilot treats a reflection as a picture seen in a rough surface, not as a light. What is different:

1. **The source is the fixture's own picture.**
   - The shopfront, the blade sign and the lamp's lens are reflected from their sprites as the street sees them at
     night: the art under the ambient, plus the light sprite.
   - Each is flipped about the ground line under it (`mirrorMatrix`), so a window reflects as a window with its
     mullions and the sign as pink letters.
   - Only what is brighter than a floor reflects, so lit walls give nothing. The lamp gives only its lens, never
     the cone of light under it.
2. **A rough surface stretches the picture instead of blurring it.** It is drawn at a range of flip depths, from
   near the fixture's foot to past its mirror point (`REFLECTION.stretch`). The result is a streak in the source's
   shape, the way a tilted facet reflects a source from nearer or further than the mirror point.
3. **The surface decides the response, per pixel, from its own texture.**
   - Every pixel is classed asphalt, paving, hard standing, marking, joint or threshold (`paintSurfaceClasses`
     from the saved zones; markings and joints from the albedo).
   - Most of each surface is rough: it shows the streak at about a tenth of its strength, except on grains that
     stand proud of their neighbours. Those are the texture's own top 2%, chosen per surface, and they shine at
     several times the strength. So a rough reflection is a few crisp points in a dim streak, not a wash.
   - Markings and thresholds are smooth: they show the mirror image itself, rippled by the texture's slope.
     Joints and building footprints show nothing.
   - A world-space noise makes some patches smoother (`REFLECTION.patch`).
4. **The lights' own glints.** Each shop light's incident light (`incidentLight`, the same shadowed light the
   ground is lit with) shows on the grains it reaches. The pool on the road then reads as asphalt catching the lamp,
   not as a brighter pool, and outside the pools the street stays dark.
5. **It is added, not multiplied by the albedo.** A reflection is the source's colour off the surface's top. It
   eases toward white by its brightest channel (`knee`), so a warm window stays warm.

**Failures found while tuning, and fixed:**

- **Dust.** One-pixel glints were invisible at play zoom, so grains are now aggregate-sized (a few centimetres).
- **Dotted rows.** The kerb's long edge passed as grains and read as a dotted line. A grain must now stand proud in
  every direction, and nothing within a few centimetres of a joint glints, since slabs' chipped rims lined up into
  rows.
- **A grid of points.** The recess's regular tiles glinted as a grid. The recess under the awning is now a
  polished threshold, which takes a sheen and almost no grains.
- **A smudge and a pale line.** The lamp's halo, seen whole in a smooth patch, made a soft round smudge, and its
  lit grey pole reflected as a pale line. The lamp now reflects its lens only.
- **A ghost column.** A wall lit by the lamp reflected as a column. The brightness floor was raised so only
  emitters reflect.

**Picasso.** No new asset was needed. The existing materials' own grain is what the glints are made of.

## 4. Spatial and gameplay truth

- **Nothing moves.** Walls, entrances, cover, activity groups, camera defaults and saved layouts are unchanged; the
  pilot reads them and adds sprites at ground depth (-999.4), under everything that stands.
- **Attached.** Each layer is a world-space sprite over the ground, so it stays attached through pan and zoom.
  Shown in the close-ups (3×) and play shots (default zoom) of the same scene.
- **Boundaries.** Building footprints and joints give nothing back, and markings respond as markings.
- **Occlusion.**
  - A prop nearer the camera than a fixture hides that fixture's reflection with its body flipped below its foot,
    standing or as its wreck.
  - Seed 7's crate hides the lamp's mirror point. That is correct, and it is why the lamp's reflection there is
    only a few glints above the crate.
  - Glints follow the lamp shadows, because they are made of the shadowed light.
- **It goes with its light.** With the lights off, the pilot changes no pixel on any seed (`*-lights-off-*`).
- **It goes with its fixture.** Each fixture's reflection is its own sprite, shown and faded with that fixture's
  sprite. In the reveal, the shopfront's reflection leaves with its wall, and the lamp's glints stay.
- **Damage.** The live board switched through mixed, destroyed, intact and destroyed matches boards loaded
  directly into each state: 0 channels differ (`shadow-state-check.txt`, last section, now with the pilot on).
- **Actors and overlays.** Actor markers, movement squares and shot lines are the SVG over the board and are
  untouched. The pilot draws under every sprite, so actors stand over it. Shown in the `play`, `reveal` and
  `mixed-damage` captures (screenshot observation, not a test).
- **`reflect=0`** in `/scene-review` (the "Reflections" checkbox) shows the ground without the pilot. Every
  baseline capture uses it.

## 5. Evidence (`docs/evidence/material-pilot/`)

- **`2-pilot/`** holds every view taken twice from the same build, `-baseline` (`reflect=0`) and `-pilot`. Views:
  `play` (normal zoom, characters), `close` (the shop lamp at 3×), `lights-off`, `reveal` and `mixed-damage`, on
  seeds 7, 0 and 8. Taken by `tools/scenes/material-pilot-evidence.mjs`, unedited.
- **`compare/`** holds side-by-sides: the play views cropped where the pilot changed the frame, a 2× crop, the
  close-ups, the full play frames and both reference comparisons.

**Pixels changed, final run.** Each cell is brighter / darker by more than 24 in sum, of an 1800×1300 frame. The
"darker" counts in views with characters are their idle animation frames: seed 0 changes the same number each way.

| Seed | Play        | Close-up   | Lights off | Reveal     | Mixed damage |
| ---- | ----------- | ---------- | ---------- | ---------- | ------------ |
| 7    | 6137 / 843  | 35256 / 19 | 0 / 0      | 4196 / 761 | 7768 / 1015  |
| 0    | 101 / 103   | 0 / 0      | 0 / 0      | 98 / 92    | 940 / 906    |
| 8    | 22001 / 599 | 122596 / 4 | 0 / 0      | 5254 / 739 | 22304 / 505  |

### Screenshot observations (not tested behaviour)

- **Seed 8 reads as a different surface at normal zoom, not a brighter one.**
  - The lamp's pool on the road is aggregate catching the light.
  - The pink blade sign lands as a pink highlight on the kerb, with a short broken streak.
  - The sign's mounting lights make a faint pale streak down the paving.
  - The dark road outside the pool is unchanged.
- **Seed 7 is subtler.**
  - The road under the lamp carries the same glints.
  - The recess holds a warm, broken reflection of the windows in a polished doorstep.
  - The lamp's own streak lands behind the crate. At normal zoom the change is clear in a side-by-side and easy
    to miss on its own.
- **Seed 0 has no storefront corner** and is unchanged.
- **Haze or smears?** No component of it reads as a wash.
  - Every bright pixel sits on a grain, on a marking or threshold, or inside a fixture's own picture.
  - The faint pale streak on seed 8 is the one element nearest a smear. It is a real source, and short.
- **Against the reference, the gap is mostly not surface.** The reference is a wet street under dozens of
  sources; this is a mostly dry street under the corner's handful. The sparkle and the sign's colour now read; the
  reference's long, coloured, everywhere-reflections need its sources.

## 6. Performance

Software GL here (SwiftShader); only relative numbers mean anything. `perf/perf.json` (pilot) and
`perf/perf-baseline.json` (`reflect=0`) come from the evidence script with `PERF=1`; `perf/frames.json` from
`scene-perf.mjs`.

| Seed | Read the surface (at load) | First render (at load) | First damage update: render | Longest frame, pilot / baseline (ms) | Repeated state |
| ---- | -------------------------- | ---------------------- | --------------------------- | ------------------------------------ | -------------- |
| 7    | 341 ms                     | 399 ms                 | 136 ms, 131 ms              | 883 / 583, 800 / 483                 | not rendered   |
| 8    | 122 ms                     | 149 ms                 | 58 ms, 15 ms                | 683 / 583, 633 / 517                 | not rendered   |
| 0    | none (no storefront)       | none                   | none                        | 583 / 633, 483 / 483                 | not rendered   |

**Reading it.**

- **Load.** Reading the surface happens once (also with `reflect=0`, which only hides the result). On seed 7
  scene-ready moved from about 9.8 s to 10.0 s.
- **First damage update.** The first time a layer reaches a new state, it is rendered: about 0.13 s on seed 7, and
  under 0.06 s on seed 8.
  - The extra frame time beyond that is mostly uploading the changed layers' textures, which software GL does
    slowly.
  - It is once per state: a state seen before is not rendered again, and its texture is uploaded once.
- **Frames.** Idle and zooming sit on the same vsync steps as before (`checkpoint-shadow-state.md` §6).
  - Seeds 7 and 8, two runs each: idle p50 100, p99 117–133 ms; zooming p50 100–117, p90 117–133, p99 183 ms.
  - Zooming p99 is one step above the earlier 167 ms. That may be the four additive sprites under SwiftShader;
    run `scene-perf.mjs --chrome` on real hardware before reading anything into it.
- **What it took to get here.**
  - The first version re-rendered every layer on any damage: about 450 ms and a 1.2 s frame.
  - Each fixture's flipped picture is now drawn once. Each layer is keyed only to the props that can cut it.
  - The surface's grain quantiles come from a histogram instead of a sort.

## 7. Checks

- `bun run lint` (no errors; the 12 warnings are pre-existing), `bun run typecheck`, `bun run test` (4047),
  `bun run build`, `bun run test:browser` (28 passed).
- `tools/scenes/shadow-state-check.mjs`: PASS, with the 3/255 limit enforced.
- New unit tests: `groundReflection.test.ts` covers the flip, the stretch, which props occlude, a flipped body
  standing and wrecked, and each surface's response. `sceneReviewQuery.test.ts` covers `reflect=0`.

## 8. Limitations and recommendation

- **Local to the storefront corner.** Seed 0 has none, so it gets nothing.
- **Few sources.** Seed 7's lamp reflection is mostly hidden by the crate, which is correct. More reflection there
  needs more street-level sources, or a different layout, not a stronger effect.
- **Simplified occlusion.**
  - Buildings in front of a fixture do not occlude it in the mirror; nothing at the corner is placed so that it
    matters.
  - Actors do not occlude reflections; they move, and the board would need to re-render per step.
- **A software-GL hitch** of a few hundred ms on the first damage of a prop near the corner. Real hardware is
  unmeasured.
- **The pilot is on by default at the corner,** with `reflect=0` for comparison. Seed 8 meets the brief's bar at
  normal zoom; seed 7 meets it close up and only just at normal zoom.
- **Recommendation.** Judge seed 7's and seed 8's `play` sheets yourself before extending it past the corner. If
  extended, the next sources to reflect are the scene's existing lamps and signs (`dressingLights`), with the same
  code.
