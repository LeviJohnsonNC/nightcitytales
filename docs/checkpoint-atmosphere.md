# Checkpoint: the atmosphere pilot

**Scope.** How the intersection's existing lights fall on the surfaces round them, plus one restrained secondary
source. Night, intersection scenes with materials only. Seed 7 is the benchmark; seeds 0 and 8 check variation.

**Unchanged:**

- walls, entrances, circulation and props;
- movement, cover, targeting and damage;
- saved geometry and state;
- the tactical presentation from #291–292;
- the default camera;
- every other environment.

There is no new artwork, no darkening of the scene and no stronger bloom.

**Not verified:** a real `/play` fight and save/load. The checklist in `checkpoint-ground-pass.md` §6 still
applies unchanged.

## 1. Fair comparison with the reference

`docs/evidence/atmosphere/reference.jpg` is the original reference. `compare/reference-vs-game.jpg` sets it beside
the game at a comparison camera, `cam=-10,115,2.2&player=21,4.5`:

- characters are about the reference's size (about 60 px);
- the shop's corner is in the same place in the frame.

The normal play camera is a separate acceptance view (`play-*.jpg`) and has not changed.

### Framing, not a shortcoming of the scene

- **The roof dominates the game's frame.** The fixed camera looks at the shop's corner from behind and above.
  The reference looks into its corner, so its frame is mostly street and facades.
- **The reference is framed tighter** and its corner fills the view. At play zoom the game shows a lot of
  carriageway.
- **The reference has more buildings round its corner.** The street is enclosed on three sides, so lit facades
  surround the action. This is the recipe's layout, not the lighting's.

### Real differences, largest first

1. **Light placement and falloff.**
   - In the reference, light comes from many practical sources at street level: every shopfront, signs,
     traffic signals, headlights and tail lights. Each lights the wall it is on and the ground in front of it.
   - Before this pilot, the game's pools lay on the pavement and the walls beside them stayed dark. Only the
     storefront's face caught light, and that as a screen-space radial. The lights read as painted on the
     ground rather than as fixtures in a space.
   - **This pilot fixes the attachment; the number of sources stays far below the reference's.**
2. **Brightness relationships.** The reference's road is the darkest surface, then pavement, then walls at
   street level, which are lit; roofs are dark. The game had the same order, but its lit walls were missing.
   Its walls read darker than the pavement in front of them, even under a lamp.
3. **Warm/cool balance.** The reference sets warm windows and lamps against cyan and magenta neon over a cool
   ambient, roughly half and half. The game is cool ambient with warm pools and one cyan sign. Warm is a small
   fraction of the frame and confined to the shop.
4. **Material response.** The reference's road is wet: coloured reflections and a sheen that doubles every
   light. The game's ground is dry and matte. See §4 for why that is not closed here.
5. **Architectural detail.** The reference's facades carry signage, awnings, AC units, pipes and balconies at
   street level. The game's shop is close to that; its neighbours and homes are plainer. Unchanged here.

## 2. Improving the existing lights (`courtyard/wallLight.ts`)

**Audit.** Before this pilot:

- **Ground:** `paintGroundLights` drew the shop's spills, the entrance downlight, the streetlight pool and the
  dressing lamps and signs, clipped out of every building footprint. This was correct.
- **Storefront face:** its own light pass covered the lit bays and the downlight, plus a screen-space radial
  wash from the lamp.
- **Every other wall, the awning and every window surround:** no light at all.

**Change.** Each light that already pools on the ground is now also a point at its fixture's height (the lamp
head at 5.45 m, dressing lamps at 4.4 m, signs at 2.6 m). It reaches the camera-facing walls in front of it
with the pool's own falloff:

- **Wall planes.** A face is lit only from in front of it and within reach, and only when no building stands
  between the light and the wall on the ground. The light is drawn in the face's own (along, height) plane.
  - It goes into the surface's light pass, so it is multiplied by the wall's albedo and keeps its material.
  - It replaces the storefront's screen-space wash.
  - Cutaway pieces carry the same wash, clipped to their own stretch and height. Revealing the street never
    changes the light on a wall.
- **Roofs are never lit by a wall light,** so no light falls on an unrelated roof. The one roof surface that
  catches light is still the storefront's (the lamp over its units, as before). The awning's top catches the
  lamp's pool at its own height.
- **Windows.** A lit shop bay now lights its recess, its sill (a lit strip) and the wall immediately round it.
  The light fades within half a metre and sits in the same light pass.
- **Tuning.** A wall's darker render made a physically consistent wash too faint at play zoom. `WALL.reach`
  (1.3×) and `WALL.gain` (1.6×) are stated in the file.

**Attachment.** Every wash is painted into a surface's own light companion, which the renderer already keeps at
its parent's visibility, alpha and depth every frame. So the wash cannot come loose on pan, zoom, fade or
reveal.

## 3. The secondary source: a few occupied homes

`litHomeWindows` (`buildingFaces.ts`) lights a few of the residential block's windows at night:

- **Which windows.** Only upper-storey windows with somebody behind them: a lamp, curtains or a blind. They
  must face open ground, not a neighbour's wall. A lamp is lit first, then the rest in an order taken from the
  window's own seed.
- **How many.** About one in six windows per block, at least one and at most three (`LIT_HOMES`). The same
  windows are lit every night.
- **What a lit window shows** (`paintLitHomes`, `INTERSECTION_NIGHT.home`):
  - the room behind the glass, lit warm through its curtains or blind;
  - a faint glow on the glass;
  - the sill strip;
  - the wall round the opening.
- **What stays dark.** Upper windows send no light onto the pavement, and the rest of the block stays dark.
- **Why the selection changed.** The first version lit only windows already painted with a lamp, about one in
  ten. That left seed 7, the benchmark, with none at all.

**Result on seed 7:** three of the block's 24 windows are lit, and the block otherwise stays dark
(`3-secondary/overview.jpg`).

## 4. The damp experiment: omitted

It was built (`wet=1`) and judged at play zoom in two iterations, then removed. The captures stay in
`4-damp-rejected/`.

**What it did:**

- **Patches.** Deterministic wet patches in the gutter at each saved gully, at the awning's drip line, and in
  the channel along the shop's kerb.
- **Albedo.** Each patch darkened the ground under it.
- **Reflections.** Each light's mirror image, rippled into rows and shown only through the patches. An
  orthographic camera sees a light at height z mirrored z metres straight down-screen from its foot. The
  reflections were masked out of building footprints, with no sprite mirrored.

**Why it is not kept:**

1. **The physics puts the reflections where the patches are not.**
   - The shop lamp's head is 5.45 m up, so its reflection lands 5.45 m down-screen, on the pavement beyond the
     food cart. That is nowhere near the gutter or the drip line.
   - The shop windows' reflections fall inside the shop's own footprint, behind its sprite.
   - At real strength the experiment changed about 1,200 pixels of the play frame, practically invisible
     (`4-damp-rejected/play-solid.jpg`).
   - `diagnostic-unmasked.jpg` shows where the reflections really land, with the mask removed and the strength
     doubled.
2. **At play zoom a reflection is about 5 px wide.** Strong enough to read, it looks like a dotted line, not
   water.
3. **Darkening without a visible reflection reads as staining.** Gully silt already covers that
   (`diagnostic-exaggerated.jpg`, strength tripled).
4. **Placing puddles where reflections land** would reverse-engineer the scene to fake the effect.

**What would work** is a broad, rough sheen across the whole carriageway, picking up colour from every pool. That
is a global wet treatment, which this brief excludes; it is also only convincing with the reference's density of
light sources. **Recommendation:** do not ship damp until there are more street-level sources to reflect. Then
try it as a roughness sheen, not as puddles.

## 5. Evidence (`docs/evidence/atmosphere/`)

**Stages.** Each folder holds the same shots, from `tools/scenes/atmosphere-evidence.mjs`:

- `1-baseline/`: `main`;
- `2-lights/`: §2 only;
- `3-secondary/`: this branch;
- `4-damp-rejected/`: the experiment in §4.

`compare/*.jpg` sets stages 1, 2 and 3 side by side at the same camera.

**Shots:**

| Shot               | Camera and state                                                     |
| ------------------ | -------------------------------------------------------------------- |
| `compare-solid`    | Comparison framing, roof on                                          |
| `compare-reveal`   | Comparison framing, revealed                                         |
| `play-solid`       | Normal play zoom with characters                                     |
| `play-reveal`      | Normal play zoom, revealed                                           |
| `play-lights-off`  | Normal play zoom, lights off                                         |
| `overview`         | The overview, without actors (the actors board keeps its own camera) |
| `close-storefront` | The shop close up, to check bright areas keep their material         |
| `seed0-play`       | Seed 0 at play zoom                                                  |
| `seed8-play`       | Seed 8 at play zoom                                                  |

## 6. Visual findings (screenshots, not tested behaviour)

- **The shop stays the focal point.**
  - Its corner is still the warmest and brightest place in every frame.
  - The homes' windows are smaller, dimmer and higher, and light no pavement.
  - Most of the block, the sheds and the far pavements stay unlit.
- **The walls now hold the light.**
  - The annex's front catches its own lamp.
  - The shop's fascia end and corner pier catch the streetlight.
  - The shop's sill and window surround are lit (`compare/close-storefront.jpg`).
  - The pools no longer sit on the ground beside a dark wall.
- **Bright areas keep their detail.** The lit fascia, awning, sill and paving show their texture. The light is
  multiplied by the albedo, never laid over it.
- **Nothing leaks.** No wall is lit from behind or through another building. No roof except the storefront's is
  lit, and no light falls inside a footprint.
- **Actors and routes read in the unlit areas.** The markers, rings and movement edge are unchanged and drawn
  above the scene (`compare/play-solid.jpg`). Actors in the dark middle of the road read as before.
- **Lights off** removes every wash with the pools (`compare/play-lights-off.jpg`). **Reveal** removes the
  revealed block's wall washes with its walls, and its cutaway pieces carry their own (`compare/play-reveal.jpg`).
- **Seeds 0 and 8** get three lit windows each, like seed 7, and wall washes wherever a lamp stands in front of
  a wall.
- **The stage 2 change at play zoom is modest.** It is clearest close up. The largest remaining gap to the
  reference is still the number of sources, not how each one falls.

## 7. Interaction results (browser, not screenshots)

- **`architecture-interaction.mjs`** (scratch output). Live and missing-art fallback both gave 0 page errors and
  0 unexpected failed requests, through:
  - load and reveal on/off;
  - zoom in, pan and zoom out;
  - night off/on and lights off/on;
  - reset and overview.

  In the zoomed and panned frames the wall washes stay registered to their walls.

- **`atmosphere-evidence.mjs`.** 0 page errors on every shot at every stage.
- **Rendering performance.** Same machine, SwiftShader software GL, so only relative numbers mean anything.
  Each run is 600 animation frames on `play-solid` while the camera zooms in twice and out three times.

  | Stage                               | Median frame | p95      | Frames sampled |
  | ----------------------------------- | ------------ | -------- | -------------- |
  | 1 baseline (4 runs)                 | 166.6 ms     | 216.7 ms | 88–90          |
  | 2 lights                            | 166.6 ms     | 216.6 ms | 88             |
  | 3 secondary, first version (5 runs) | 166.7–183.3  | 216–233  | 84–86          |
  | 3 secondary, final (5 runs)         | 150.0 ms     | 200–217  | 88–92          |
  - **The regression.** The first version of stage 3 consistently gave about 4% fewer frames. A lit home gave
    its whole block a full-size additive light sprite.
  - **The fix.** Every light sprite is now cropped to its own lit pixels instead of its surface's whole frame
    (the `glowBox` crop in `createComposedEnvironment`). That puts the final stage slightly ahead of baseline.
  - **Output unchanged.** The frame differs from the uncropped one only where two runs of identical code also
    differ: the animated actors.

## 8. Automated checks

- `bun run lint`: no errors; the 12 warnings were already there.
- `typecheck`.
- `test`: 3990 passed.
- `build`.
- `test:browser`: 28 passed, including the WCAG scan of `/scene-review`.
- **New tests** (`src/features/play/__tests__/atmosphere.test.ts`):
  - a wall is lit only from in front and within reach, and is stopped by a building but not by a fence;
  - the light weakens with distance;
  - every light comes from a saved fixture;
  - the lit homes are deterministic and at most three per block;
  - only occupied upper windows are lit, seed 7 has at least one, and nothing that is not a home is lit.
