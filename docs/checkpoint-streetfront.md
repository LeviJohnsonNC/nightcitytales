# Checkpoint: commercial streetfront identity

**Scope.** The commercial elevations the camera sees at normal play zoom, on intersection scenes with materials.
The target is seed 0's long plain side and the corresponding faces in seeds 7 and 8. The shopfront, its
atmosphere (#294) and every other building are unchanged.

**Unchanged:**

- every wall, opening, entrance and footprint;
- circulation, cover, damage and saved layouts;
- the camera and the tactical presentation;
- the seed 8 awning's brightness, the global brightness and the bloom.

**Deferred:** wet ground, car variants and the kiosk, to a separate asset pass.

**Not exercised:** a real `/play` fight and save/load. The checklist in `checkpoint-ground-pass.md` §6 still
applies.

## 1. What was plain, by seed

| Seed | Long plain face at play zoom                                                                                                                                                                                                                     | Why                                                                                                                                                       |
| ---- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 0    | The shop's east side, 20 m: six identical storeroom windows in one concrete wall, nothing to say it is a shop.                                                                                                                                   | The awning is on the south face, which the camera never sees, so the scene has no storefront at all. The night market was invisible except for its stall. |
| 7    | The shop's 8 m east return, beside its shopfront. Two storeroom windows.                                                                                                                                                                         | It took the generic window art.                                                                                                                           |
| 8    | The neighbours' east faces, 20 m in line with the shopfront: dark render, small barred high windows, one louvre. At play zoom it read as a blank wall carrying on from the shop. (The shop's own other face is behind its neighbour, so unseen.) | The architecture pilot kept neighbours deliberately restrained.                                                                                           |

## 2. The shop's other faces (`courtyard/streetfront.ts`, `shopReturns`)

`shopReturns` applies to each camera-facing face of a building with a shop canopy that:

- is not the canopy's own face;
- meets the shopfront at a corner;
- has no door and at least two visible bays.

It finds seed 0's side and seed 7's return, and nothing on seed 8.

**Composition.** Built from the saved bays only, each at its saved size and place (0.65–2.35 m, 2.2 m wide).

- **Two materials.**
  - The ground storey stays concrete.
  - A precast string course (2.72–2.84 m) has a lit top and a drip shadow.
  - Above it is a rendered fascia band (`painted-render`) to the coping.
- **The shop turns the corner.** The bays nearest the corner are display windows: two on a face of five or more
  bays, one otherwise. Each has:
  - the shop's lit interior (the storefront's own `window-interior` art, cropped to the bay);
  - a painted stall riser and kick plate;
  - an aluminium frame and mullion;
  - a deep shaded reveal and the head's shadow on the glass.

  They read as the same shop as the shopfront.

- **Signage.** The shop's name, 深夜市場, sits on the fascia over the display as a flush light-box. It reuses the
  shopfront's own mask. The neon tubes are thickened slightly, so they still read at play zoom.
- **Back of house.** The other bays keep the storeroom window art and its variants.
  - On a long face, the bay furthest from the shop has its roller grille down. It uses the existing `shutter`
    material, in guides, with a coil box under the course.
- **One purposeful fitting.** A kitchen extract stands on the pier between the display and the storeroom: a
  louvred box, and a galvanised duct up the wall and over the coping, with brackets and a cowl. The shop's
  interior is a noodle bar. It never stands within 0.6 m of a downpipe.
- **Cutaway pieces.** Each piece carries the same composition, clipped to its height, so revealing the street
  does not change the wall. The sign, at 2.93–3.65 m, leaves with the upper wall, as the shopfront's does.

## 3. The neighbours' frontage (`neighbourFronts`)

The neighbours are another business, shut for the night. Their barred windows and louvre are untouched.

- **Wall.** Every exposed neighbour face gains a pressed-metal course over the window heads (2.86–2.94 m), and
  profiled `painted-metal` cladding above it to the coping: a shopfront's fascia zone.
- **Signage.** One painted fascia board per block, on the face that continues the shopfront's own street line (else
  the longest), at the end nearest the shop. It reads 電器修理 ("electrical repairs"), cream on green. It is clear
  of the downpipe.
- **The practical light.** Two gooseneck lamps light the board. Their light falls on the board and the cladding
  just under it, and reaches no pavement. It is the only light on the neighbours, so the shop stays the warm focal
  point and the rest of the block stays dark.

**The lettering** is a mask rasterised from a real font by the existing `tools/art/kanji-sign.mjs`:

```
node tools/art/kanji-sign.mjs --text 電器修理 --stroke 0 --out public/images/signs/denki-shuri.webp
```

The tool now takes `--text`, `--out` and `--stroke`. Its default output, the shopfront's mask, is unchanged. It is
not generated art, and no CJK font is needed at runtime.

**Sign masks are prefiltered** (halved twice, smoothed) before they are drawn at 15–40 px a glyph. Drawn straight
from the 256 px cells, the strokes broke into stray pixels.

## 4. Lighting

- **Seed 0's lit display.** It is the shop's light, round the corner where the shopfront cannot be seen:
  - its rooms are lit like the shopfront's, a little less;
  - its glass glows faintly;
  - its sill and surround are lit;
  - its spill falls on the pavement (`returnLights`: 0.75 of the shopfront's, shorter reach);
  - the neon name's light falls softly on the render round the sign.
- **Seed 7.** The single display bay sits beside the shopfront's own lit windows and is subordinate to them.
- **Seed 8.** Only the neighbour's sign light.
- **Unchanged:** global brightness, bloom and the awning.

## 5. Picasso brief

None was needed. Every surface uses an existing material: concrete, render, painted metal and shutter. The
interior is the storefront's art. The lettering is a font mask from the existing tool. No provisional drawing
stands in for a missing asset.

## 6. Evidence (`docs/evidence/streetfront/`)

`before/` is `main` and `after/` is this branch, at the same cameras, from `tools/scenes/streetfront-evidence.mjs`.
`compare/*.jpg` sets them side by side.

- **Normal play zoom with characters, seeds 7, 0 and 8:** `seedN-play`, `seedN-reveal`, `seedN-lights-off`.
- **Close-ups:**
  - `close-seed0-side`: the shop's side;
  - `close-seed7-corner`: the shop turning its corner;
  - `close-seed8-neighbour`: the neighbour's board.
- **The reference comparison camera, kept apart from gameplay:** `reference-camera-seed7`.

## 7. What is visibly better at play zoom (screenshots, not tested behaviour)

- **Seed 0** (`compare/seed0-play.jpg`) is the largest change.
  - The block at the left now reads as the night market. Its name glows over two lit display windows at the corner
    by the stall, and the display throws warm light onto the pavement.
  - The rest of the side is quieter but composed: a concrete storey under a course and a rendered band, one
    shuttered bay, and the extract duct.
  - Before, it was six identical dark windows.
- **Seed 8** (`compare/seed8-play.jpg`). The frontage beyond the shop reads as a second, closed business:
  - a metal-clad fascia zone over its barred windows;
  - a lit green board with its name.

  Before, it was a dark wall. The shop and its awning are unchanged and stay the focal point.

- **Seed 7** (`compare/seed7-play.jpg`) is a small change at play zoom.
  - The shop's corner return, at the bottom edge of the play frame, now continues the shopfront: a lit display
    bay and the name.
  - The block's neighbour faces are out of the play frame.
- **Lights off** (`seedN-lights-off`). The architecture still reads: the course, the band, the cladding, the
  boards and the unlit display. Nothing depends on the lights to be legible as a building.
- **Overlays.** Actors, markers and the movement overlay are unchanged.

## 8. Interaction and checks

- **Browser interaction** (`architecture-interaction.mjs`, scratch output; it now takes `SEED`). Seeds 7, 0 and 8
  each gave 0 page errors and 0 unexpected failed requests, live and in the missing-art fallback, through:
  - reveal on/off;
  - zoom in, pan and zoom out;
  - night and lights off/on;
  - reset and overview.

  After zooming and panning on seed 0, the sign and display stay registered to their wall.

- **`streetfront-evidence.mjs`.** 0 page errors on every shot, before and after.
- **Performance.** Same machine, SwiftShader, so only relative numbers mean anything. Four runs per side, 600
  frames on the play shot while zooming:

  | Seed | Frames sampled, before (average) | After (average) | Median, before → after |
  | ---- | -------------------------------- | --------------- | ---------------------- |
  | 7    | 89–91 (90)                       | 88–91 (89)      | 150–167 both           |
  | 0    | 87–91 (89.5)                     | 87–91 (89.8)    | 150–167 both           |

  No measurable change: the medians move between the same two vsync intervals on both sides.

- **Repository checks.** All pass:
  - `bun run lint` (no errors; the 12 warnings were already there);
  - `typecheck`;
  - `test` (4000);
  - `build`;
  - `test:browser` (28).
- **New tests** (`streetfront.test.ts`):
  - which faces are composed, on each seed;
  - only saved bays are used, with no doors, and the duct stands on a pier;
  - the sign and course fit under the roof and above the bay heads;
  - one neighbour board per block, clear of its pipe and above the window heads;
  - seed 8's board is on the shop's street line, at the end nearest it;
  - determinism.

## 9. Limitations

- **The display reuses the shopfront's single interior picture.** On seed 7 it appears in the shopfront's bays and
  again in its return. A second interior would vary it; it is the first asset to ask for if the repetition shows.
- **Lettering is legible as kanji only when zoomed in.** At play zoom it reads as a lit sign with characters.
- **Other commercial faces are unchanged:** seed 0's other shop masses, the annex and the retail workshop.
- **Not exercised:** real `/play` combat and save/load. This is presentation only, but nothing here was run in an
  authenticated campaign.
