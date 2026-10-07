# Checkpoint: the shop corner's material pilot

**Status: not visually accepted. The reflections are off by default and not built** (`REFLECTION_MODE_DEFAULT =
"skip"`). `/scene-review?reflect=on` shows them for review. This line of tuning has stopped (§7).

**Scope.** How the ground at the finished shop corner responds to the corner's own lights: the shopfront's lit
windows and neon, the blade sign and the streetlight. Night, intersection scenes with materials, and only where
`storefrontFor` finds a storefront.

- **Seed 8** is where the effect is most exposed, then seed 7.
- **Seed 0** has no storefront corner and is the unchanged control.

**Unchanged:**

- walls, entrances, cover, activity groups, saved layouts and the default camera;
- movement, targeting and damage;
- the lights, their pools, the accepted lamp shadows (`groundShadows.ts`) and the wall light;
- every other environment.

There are no new assets and no new light sources.

This document has two parts. §1–§2 cover PR 302: the regression check's limit, and what PR 302 built and got
wrong. §3–§7 cover the revision. Every statement is marked as one of:

- **verified:** a check or test that passes;
- **judged:** a visual judgement from captures;
- **hypothesis:** not established.

## 1. The regression check's rounding limit (PR 302; verified)

`comparePixels` (`groundShadows.ts`) enforces the documented 3/255.

- **The rule.** A channel the board keeps at the standing value counts as rounding only when the fresh render is
  at most `ROUNDING_MAX` (3/255) below it. A larger drop fails the check.
- **The test.** `groundShadows.test.ts` has a case with a drop of 4 that fails.
- **The results.** `shadow-state-check` passes (`revision/shadow-state-check.txt`), with at most 3 accepted
  channels per state. The shadows were not retuned.

## 2. PR 302: what it built and what was wrong with it

PR 302 reflected each fixture's picture, flipped about its ground line and stretched by sampling it at 22 flip
depths. Its earlier checkpoint claimed some things that do not hold.

- **"Only what is brighter than a floor reflects, so lit walls give nothing."** Not true as built.
  - The source was the sprite's whole night picture: its art under the ambient, plus its light sprite.
  - The 22 stretched copies were summed first, and the floor (0.5) was taken off after, divided by 22.
  - Where many copies of a dim wall overlap, they survive. `tools/scenes/reflection-source-check.mjs` computes
    PR 302's rule for a wall of 62–72/255: at 22 copies it kept **66 of 255** per channel.
  - The ghost columns that PR 302 fixed by raising the floor were this effect.
- **"No component of it reads as a wash"; "a few crisp points".** Judged wrong in review.
  - At play zoom on seed 8, the glints read as glitter: isolated white specks across the lamp's pool on the road.
- **Layer bounds.** Every group used the shared corner box (1131×802 ground pixels on seed 7), so each state
  uploaded four textures of that size.
- **Cost.** It was measured against a visual toggle that still built everything, so "reflections off" was never
  zero cost.

## 3. What the revision changed (`courtyard/groundReflection.ts`)

**3a. Sources are extracted before anything is stretched or summed** (verified).

- **What a source paints.** Only what the fixture emits, from the existing drawing passes:
  - the shopfront's glow pass;
  - its light pass, clipped to its lit bays (`storefrontWindows`, and each composed return's display bays);
  - the blade sign's passes;
  - the lamp's lens.
- **What it never paints.** The art under the ambient, wall washes, sill surrounds and parapet highlights.
- **The floor.** `emissive()` premultiplies, applies the floor (`REFLECTION.floor`, 0.3) and the source's gain, once
  per source, in the source's own frame.
- **Flip and stretch.** These sample that extracted picture per destination pixel, in floats (`flipOf`). Nothing
  dim exists to be summed, and the sample count is a parameter (`stretch.samples`, `stretchDepths`).
- **The pixel check** (`tools/scenes/reflection-source-check.mjs`, PASS, `revision/reflection-source-check.txt`).
  - **Setup:** a dim opaque wall beside a bright window and a pink sign, plus a second dim-wall source overlapping
    the first.
  - **Result:** under the walls, the whole picture and the streak are exactly 0 at 2, 8, 24, 96 and 400 samples,
    alone and summed.
  - The window and sign stay visible. The window's streak mean holds within 0.2% across sample counts.
- **Unit tests** (`groundReflection.test.ts`) hold the floor, premultiplication, gain and the stretch's depths.

**3b. Where anything reflects is a wet mask, not the albedo** (verified as built; the look is judged in §5).

- **The mask** (`REFLECTION.wet`) is deterministic world-space value noise at three scales (2.1, 0.7 and
  0.22 m), with a gutter bias within 0.7 m of a kerb, thresholded into connected, irregular patches.
  - About 19% of the corner is wet on seed 8.
  - It is evaluated on a 10 cm grid and interpolated before the threshold.
- **Wet ground** (`response`) shows the picture whole, rippled by the film's own noise rather than the albedo's
  slope. Under it lies a subdued streak.
- **Highlights.** Only the proudest 0.1–0.7% of each surface's grains (aggregate-sized, proud in every direction,
  none near a joint) give sharp highlights, and only where wet.
- **Dry ground** gives back 2% of the streak, with no highlights and no glints.
- **Shop lights** show in the wet patches they fall on (`field`), from the shadowed incident light: a sheen
  bounded by the patch, plus the same few highlights.
- **The albedo** still decides what a pixel is (asphalt, paving, marking, joint) and which grains are proud. It
  never decides where it is wet.

**3c. Modes and bounds** (verified).

- **`ReflectionMode`:**
  - `on`, `pictures` (fixtures only) and `glints` (lights only);
  - `hidden`: built, not shown — the visual toggle;
  - `skip`: not built — the cost baseline, and now the default.
- **`/scene-review` takes `reflect=`**. `reflect=0` still means hidden. Switching to or from `skip` remounts the
  board.
- **Bounds.** Each layer has its own box: a group's flipped pictures plus blur, or the shop lights' reach for the
  glints. On seed 8 the boxes are 185×373, 83×304, 74×246 and 521×300, against 1131×802 for every layer before.

## 4. Spatial and gameplay truth

- **Damage (verified).** `REFLECT=on tools/scenes/shadow-state-check.mjs` switches seed 7's board live through
  mixed, destroyed, intact and destroyed with the revised reflections on. Every frame matches a board loaded
  directly: 0 channels differ (`revision/shadow-state-check-reflect-on.txt`). With the default (`skip`) it also
  passes.
- **Lights off (verified by pixels).** With the lights off, the revised pilot changes no pixel on seeds 8, 7
  or 0.
- **Seed 0 (verified by pixels).** Nothing is built. The close-up is identical. The play, reveal and
  mixed-damage views differ by about as many pixels darker as brighter, which is the idle animation.
- **Unchanged and untouched by design (by construction; judged in captures).**
  - Walls, entrances, cover, activity groups, camera and saved layouts are unchanged. The layers are world-space
    sprites at ground depth (-999.4), so they stay attached through pan and zoom.
  - Actors, markers and overlays stand over them.
  - The shopfront's layer leaves with its wall in the reveal.
- **Not verified:** a real `/play` fight and save/load. There is no Supabase session here.

## 5. Acceptance comparison (`docs/evidence/material-pilot/revision/`)

**The captures.**

- **Sources:** baseline (`reflect=hidden`) and revised from this build; PR 302 from `2-pilot/`. Both sets use the
  same framing, viewport and capture script.
- **Views:**
  - play zoom, play-zoom 2× crops and close-ups;
  - reveal, lights-off and mixed damage;
  - the pictures-only and glints-only diagnostics.
- **Sheets:** `revision/compare/` (`seed8-*`, `seed7-*`, `seed0-*`; `*-parts` are the diagnostics). Taken by
  `tools/scenes/material-pilot-evidence.mjs`, unedited.

**Pixels changed, revised against baseline** (verified; brighter / darker by more than 24 in sum, of 1800×1300;
the "darker" counts in views with characters are idle animation):

| Seed | Play        | Close-up   | Lights off | Reveal      | Mixed damage |
| ---- | ----------- | ---------- | ---------- | ----------- | ------------ |
| 8    | 8635 / 758  | 47948 / 5  | 0 / 0      | 8461 / 730  | 8271 / 336   |
| 7    | 10108 / 567 | 54113 / 34 | 0 / 0      | 10310 / 821 | 10706 / 897  |
| 0    | 1045 / 1032 | 0 / 0      | 0 / 0      | 67 / 83     | 364 / 368    |

**Judged, at normal play zoom.**

- **Seed 8.**
  - PR 302's glitter is gone: no isolated white specks.
  - The glints-only view shows what the mask does: the lamp's pool picks out the wet patches as soft, pale,
    broken-edged bodies on the paving.
  - They do not read as water. A wet street darkens where it does not reflect and shows source shapes where it
    does; these read as pale stains, close to the "greasy smears" the brief warned about.
  - The pictures-only view shows the pink sign as a small, isolated pink mark in the gutter. That is correct in
    place and colour, but it is too small to say "reflection".
- **Seed 7.**
  - One pale patch on the road under the lamp (glints).
  - One isolated white blob past the stall (pictures): the lamp's lens at its mirror point, correctly placed and
    occluded, which reads as an artefact.
  - The recess holds a faint warm reflection.
- **Close-ups.** The patches read better at 3×, but they still read as sheen on stains rather than wet ground.
- **Which component does what.**
  - Glitter came from PR 302's glints and is fixed.
  - Haze now comes from the glints' sheen.
  - The pictures are correct but too sparse at this corner to carry the effect.

## 6. Cost (`revision/perf.json`, `tools/scenes/reflection-perf.mjs`)

**How it was measured.** Identical scenes (each seed's lamp close-up), three modes, three runs each, in Chromium
on software GL. Only relative numbers mean anything. Medians:

| Seed | Mode   | Scene ready | Construction | First render | First damage changes: render / longest frame | Repeated changes: render / longest frame |
| ---- | ------ | ----------- | ------------ | ------------ | -------------------------------------------- | ---------------------------------------- |
| 8    | skip   | 8705 ms     | —            | —            | — / 467, — / 433                             | — / 167, — / 183                         |
| 8    | hidden | 8853 ms     | 164 ms       | —            | — / 467, — / 450                             | — / 150, — / 183                         |
| 8    | on     | 8851 ms     | 165 ms       | 160 ms       | 76 / 533, 19 / 467                           | none / 183, none / 200                   |
| 7    | skip   | 9397 ms     | —            | —            | — / 517, — / 400                             | — / 150, — / 150                         |
| 7    | hidden | 9876 ms     | 442 ms       | —            | — / 550, — / 400                             | — / 167, — / 167                         |
| 7    | on     | 9977 ms     | 413 ms       | 498 ms       | 69 / 600, 65 / 550                           | none / 183, none / 183                   |
| 0    | any    | 10.3–10.8 s | —            | —            | about 500 / 400 in every mode                | about 150–183                            |

**Retained memory, seed 7 (seed 8 in brackets).**

| Kept                  | Size             |
| --------------------- | ---------------- |
| Surface arrays        | 13.8 MB (3.7 MB) |
| Per-source pictures   | 8.8 MB (1.7 MB)  |
| Cached layer canvases | 8.8 MB (2.6 MB)  |

The cached layers cover the states measured; one texture is uploaded per cached layer.

**Reading it.**

- **Built and hidden.** Construction costs 0.16–0.44 s at load. Seed 7 is the dearest because the glints' box
  covers the lamp and window spills (1050×533).
  - Before the 10 cm noise grid it was 0.8 s, and the noise was 568 ms of it.
- **Shown.** The first render adds 0.16–0.5 s at load.
- **A first damage change** renders 19–76 ms of reflections. Its longest frame is 50–100 ms above `skip`'s,
  which includes the texture upload.
- **A repeated change** renders nothing, and its frames match `skip`'s.
- **Bounds.** Measuring per-layer bounds is what justified them: the layer canvases on seed 8 total 2.6 MB across
  every cached state.
- **Default `skip`:** `/play` builds and pays nothing.
- **Hypothesis: real hardware.** Not measured. `node tools/scenes/reflection-perf.mjs <port> out.json --chrome`
  runs the same damage benchmark in installed Chrome. The idle and zoom benchmark (`scene-perf.mjs`) says nothing
  about damage updates.

## 7. Decision, limitations and remaining hypotheses

- **Decision:** the revision still reads as haze (pale stains) at normal play zoom, so the reflections stay
  opt-in and are not built by default. The approach is not extended to more lights, and tuning has stopped here.
- **Fixed for good, kept in the code:**
  - extraction before stretching, with its pixel check;
  - the modes, including the true no-cost `skip`;
  - per-layer bounds;
  - the benchmark.
- **Remaining hypotheses**, none of them tested:
  - Wet ground is darker than dry where it does not reflect. Without that contrast, a wet patch can only be
    brighter, and so reads as a stain. Darkening alone was rejected before as staining
    (`checkpoint-atmosphere.md` §4); darkening together with reflections has not been tried.
  - The corner has too few street-level sources for pictures to carry the effect. Seed 8 has one sign and one
    lens; the reference has dozens.
  - Results on real hardware and in a real `/play` fight.

## 8. Checks

- **Static checks:** `bun run lint` (no errors; 12 pre-existing warnings), `bun run typecheck` and `bun run test` (4052) pass.
- **Scene checks:**
  - `tools/scenes/reflection-source-check.mjs`: PASS.
  - `tools/scenes/shadow-state-check.mjs`: PASS, both default and with `REFLECT=on`.
- **Build and browser:** `bun run build` succeeds and `bun run test:browser` passes (28).
