# Checkpoint: the architectural art pilot (roof unit, window, shutter)

**Scope:** the three images commissioned in [`architecture-pilot.md`](architecture-pilot.md), imported and
placed on the seed-7 intersection, stopping for review before any wider rollout:

| Image                    | Goes on                                                                                        |
| ------------------------ | ---------------------------------------------------------------------------------------------- |
| `arch-roof-unit.png`     | every plain rooftop box on an intersection (not the storefront's own procedural units)         |
| `arch-annex-window.png`  | the annex's bays: the generic shop whose saved entrance carries an entry surround              |
| `arch-annex-shutter.png` | the annex's door at that saved entrance, in place of the drawn door and the surround's drawing |

**Unchanged:**

- footprints, walls, entrances, routes and the saved attachments;
- cover, line of sight and damage;
- sorting, fading and the cutaway's geometry;
- the storefront and its block's walls;
- every environment except intersections (pixel-identical to `main`).

**Not verified:** a real `/play` fight, and save/load. Both need a Supabase session.

## 1. Validation (`tools/art/architecture-pilot.ts`)

`bun run tools/art/architecture-pilot.ts [--check]` judges each image by `architecturePack.ts`, the numbers
the guides were drawn from, and writes `public/images/architecture/`. A failed check writes nothing.

| Image     | Check                                                   | Result                                                            |
| --------- | ------------------------------------------------------- | ----------------------------------------------------------------- |
| Roof unit | canvas                                                  | 1536 × 1024, as asked                                             |
|           | pure key (≥ 40%), pink fringe after keying              | 62.9%, 0.000%                                                     |
|           | fit (width and front corner), then height (± 15%)       | scale 1.002 of the guide; 0.563 m against 0.533 m (+5.5%)         |
|           | nothing outside its 256 × 200 frame                     | passes                                                            |
| Window    | canvas                                                  | 1536 × 1024, as asked                                             |
|           | frame and mullion on the guide's bands (± 2%, 31 px)    | **failed as returned:** both sides 95 px out (see below)          |
|           | the same, after registration                            | 0 px on every band                                                |
|           | the frame's bars agree in light (≤ 6/255)               | 4.3/255                                                           |
| Shutter   | canvas                                                  | 1024 × 1536, as asked                                             |
|           | the guide's magenta kept / its grey painted             | 100.0% / 99.21%                                                   |
|           | edges against the guide (± 1.5%: 15 px across, 23 down) | housing −1.3 / −4.3, rails +0.7 / +0.3, opening ±5.2, ground −0.7 |
|           | curtain halves, housing ends agree in light (≤ 6/255)   | 0.7, 2.1                                                          |

**The window was off its guide and was corrected, not passed.** Picasso painted the frame across the
whole canvas, including the two strips the guide marked "cut". The frame's bronze stood 95 px outside the
guide's bands on each side; the mullion, top and bottom were within 8 px. The check is not loosened.
Instead the importer **registers the window by its bands**:

- each frame bar is mapped onto the guide's bar;
- each pane's glass is mapped onto the guide's pane at one uniform scale (1.002), keeping the gaskets at
  the bars;
- the room behind the glass is **cropped, never squeezed**: 49 px off each side of each pane, which the
  frame would hide in a real recess anyway.

The result is held to the same bands again and lands on them exactly. The proof is
[`architecture-pilot/guides/window-registered.jpg`](architecture-pilot/guides/window-registered.jpg).
What it costs on screen: about a seventh of each pane's width of room. The blind's cord and a filing
cabinet's edge are gone. Nothing is distorted.

**Three probes were corrected, each said here so none of them reads as a quiet pass:**

- **The shutter's key.** The handoff doc asked for ≥ 40% pure key on every keyed image. The shutter's own
  guide is only 12.2% magenta, so no correct image could have passed. It is now held to its guide:
  everything the guide leaves magenta must stay key (≥ 97%), and everything grey must be painted
  (≥ 99%). That is stricter than any share would be.
- **The window's light.** "Quadrant means within 6/255" read the blind and the room, which are content,
  not light. The probe now reads the one uniform material: the core of each frame bar, the middle 60%
  of its thickness, clear of the bevel lines.
- **Two measurement bugs, fixed in the measuring.** The shutter's opening edge first tripped on the
  rails' own outline, and now needs a sustained run of slat ridges. The roof unit's frame was first
  placed against a 320-tall street-prop frame, not its own 200.

The runtime files reproduce byte for byte from the sources.

## 2. Integration (`courtyard/architectureArt.ts`)

The same rules as every other painted asset: art supplies the surface, code supplies place, depth and shadow.

- **The roof unit** is drawn into its building's own sprite by an affine map that puts the frame's 2 m
  footprint exactly on the saved one (`roofUnitTransform`). The frame's vertical is the scene's metre; a
  test holds both.
  - The roof shade under it is the renderer's (`paintRoofShade`).
  - It sorts, fades, tints and leaves with its roof because it is part of the roof's sprite.
  - It goes on every plain box, the merged plan. The storefront keeps its procedural, light-aware units.
- **The window** is mapped straight-on onto the wall plane, 12 cm back in its recess, clipped to the
  opening.
  - Code draws the reveal, the head's shadow on the glass, the precast sill and its drip shadow.
  - It is painted only where the bay is the 2.2 × 1.7 m opening it was drawn for.
- **The shutter**: the curtain and rails are drawn in the wall plane. The housing's front (the art's top
  rows) stands 0.22 m proud, with its top, its near end and its shadow drawn by code.
  - The annex's saved entrance carries an **entry surround** (`housing-portal`, 2 × 2.5 m, 0.2 m proud): the
    same volume as the shutter's rails and housing.
  - A roller shutter's rails and housing are its surround. So where the shutter is painted, the surround
    over that door is drawn as the shutter, and its cream hood and posts give way.
  - The attachment itself is unchanged, and residential portals are untouched.
- **The cutaway.** Each cutaway piece of the annex's north and east faces paints the same openings,
  clipped to its slice of the face and its height (`paintFacadeArt` with `clip`). Revealing the street
  keeps every window and the shutter on its wall. A piece kept at 2.4 m trims the top 0.1 m of the
  housing, as it trims the wall.
- **Gating.** The art is used only on scenes that take materials (intersections). The window and
  shutter go only on the annex (`isAnnex`: a shop whose saved entrance has an entry surround). That is
  `building_1` on every intersection seed 0–40, which a test holds.
  - On seed 0 the window art had first reached the storefront block's rear mass. On one seed it reached a
    corner shop without its finished storefront. Both went beyond the pilot, and the gate now excludes
    them.
- **Fallback.** Each file loads like the storefront's art. A failed load is ignored, and that surface
  keeps its drawing; the interaction run shows it.

## 3. Evidence (unedited browser captures, `docs/evidence/architecture-art-pilot/`)

`before/` is `main`, `after/` is this branch, each pair at the same URL and fixed camera
(`tools/scenes/architecture-evidence.mjs`); `compare-*.jpg` set them side by side.

- **Seed 7 at play zoom:**
  - `play-night` (roof on); `play-night-reveal` (reveal on, characters); `play-night-actors`;
  - `play-neutral` (neutral light); `play-lights-off` (night, local lights off).
- **The annex:**
  - `annex-neutral`, `annex-night`;
  - close-ups `annex-close-neutral`, `annex-close-night`;
  - reveal with a character behind it (`annex-reveal-behind`) and at its door (`annex-reveal-door`);
  - a character in front (`annex-actor-front`).
- **The neighbour block's three units:** `roofs-neutral`, `roofs-night`.
- **Other seeds:** `seed-0`, `seed-0-neutral` (the annex's door on its north face); `seed-1`,
  `seed-8-neutral` (the annex elsewhere, its door on a face the camera does not see).
- **`interaction/`:** each step of the interaction run, and the fallback.

## 4. Screenshot observations (what the captures show, not tested behaviour)

- **The roof units read as equipment at play zoom.** They show a fan under a guard, louvres, a service
  panel and a base rail, with the same finish as the cars. Each sits exactly on the old box's footprint,
  with its shade on the roof.
- **The annex's bays read as glazed openings set into the wall.** Each has a blind, a frame, a dim back
  room and a sill. They replace flat teal panels. At night they stay dark, as nothing behind them is lit.
- **The annex's door reads as a closed roller shutter.** It has its box and rails where a cream portal
  and flat slats were. It is darker and quieter than the storefront, which stays the corner's warm focus.
- **With reveal on,** the cut pieces carry the windows and the shutter. Characters behind, beside and in
  front of the annex sort and fade as on `main`.
- **On seeds 0, 1 and 8,** the units appear on every plain roof. The annex takes the window and the
  shutter where its faces are visible.

## 5. Interaction tests (`tools/scenes/architecture-interaction.mjs`)

Run against the branch: load with a character at the annex's door; reveal on, off; zoom in ×3; pan; Night
off, on; Lights off, on; zoom out ×3; reset; overview. Then the same scene with every
`/images/architecture/` request refused.

- **Live:** every step renders with 0 page errors. The only failed request is the Lovable-hosted combat
  score, which a local dev server does not have. It is unrelated, and the script names it as expected.
- **Fallback:** 0 page errors, and the drawn boxes, bays and door come back.
- **Pixel regression:** alley, office, nightclub, residential, warehouse and garage, at seeds 4 and 7,
  are identical to `main`.
- **Repository checks:**
  - `bun run lint`: no errors; the 12 warnings were already there.
  - `bun run typecheck`, `bun run test` (3939 passed), `bun run build`, `bun run test:browser` (28
    passed).
- **Not tested:** a real `/play` fight and save/load.

## 6. Critique against the reference, and what still looks like placeholder art

**Better:** the three replaced elements now belong to the same painted world as the cars and the food
cart. They have material, wear, and parts that say what they are, and none carries a cast shadow or
baked light.

**Still placeholder, most visible first:**

1. **The walls around the new art.** The annex's render, piers, roof edge and parapet are still flat
   procedural fills. They read flatter than the window and shutter now set into them, and this is the
   largest remaining gap to the reference. The next commission should be the wall surface and its
   edges, not more openings.
2. **Two kinds of rooftop unit in one view.** The storefront keeps its procedural units, which are
   darker and more graphic, beside the painted ones on its neighbours. The rollout should give the
   storefront the same art. Its units take the streetlight's light pass, so that needs a light
   companion, not just a swap.
3. **The painted units are lighter than the roofs around them,** most of all on the dark ballast at night.
   They draw the eye about as much as the parked cars. That may be right for equipment, but it is a value
   call to review. The importer changes no colour by rule, so a change would be a re-grade asked of
   Picasso, or a deliberate per-asset grade written down.
4. **The window at play zoom.** It is about 70 px wide, so the bronze frame thins to 2 px and the blind
   reads as a pale band. It reads as a window, but the frame and sill are lost. A coarser frame, or a
   slightly lighter sill, would carry further.
5. **The shutter's slats** alias into a fine ripple at close zoom: 20 slats downsampled. The housing's
   top and end are flat code fills beside a painted front.
6. **The window was cropped to fit.** About a seventh of each pane's room is gone. A redraw that respects
   the cut strips would keep the whole composition.

**Stopped here for review.** Nothing is rolled out beyond the annex and the plain rooftop boxes.
