# Storefront corner — art pack and plan

Status: **paused for artwork.** The guides and prompts are ready; nothing is
implemented in the renderer yet. Builds on the merged material pass
([#279](https://github.com/LeviJohnsonNC/nightcitytales/pull/279),
[`checkpoint-material-pass-1.md`](checkpoint-material-pass-1.md)). Nothing here
touches saved geometry, entrances, footprints, circulation, cover, targeting,
damage or save compatibility, and no reference-level quality is claimed.

The numbers live in one place, `src/features/play/courtyard/storefrontPack.ts`.
`bun run tools/scenes/storefront-guides.ts` draws every guide from it, and the
renderer will place the finished images from it.

## 1. The benchmark, from the saved scene

Intersection seed 7, recipe v6:

| Thing            | Saved fact                                                                                                                                        |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| Storefront       | `building_0` "Corner shop and vendor frontage": rect (24, 4) 20 × 8 m, 4 m high, shop style                                                       |
| Face             | the north face (world y = 4), running along +x; the lower-left face on screen, the one the camera sees                                            |
| Entrance         | `entrance_0` at (25, 3): 1.0 m from the building's west corner, so the door is s 0.2–1.8 m                                                        |
| Awning           | attachment `shop-canopy`: north edge, offset 0, **span 4 m, projection 1.5 m, wall height 2.7 m** (outer edge 2.45 m)                             |
| Windows          | the renderer's existing bays, 2.2 m wide, every 3 m from 0.5 m; the one the door sits in is skipped, so bays start at s 3.5, 6.5, 9.5, 12.5, 15.5 |
| Forecourt / cart | `shop-customers` (24, 2, 4 × 2) and the broth cart at (26, 0): the storefront's own pavement                                                      |

The straight-on elevation is `docs/storefront-pack/storefront-elevation.png`.
The real renderer with each asset's footprint drawn through the scene's own
projection and camera is `docs/storefront-pack/context-placement.jpg` (the same
frame without the overlay: `context-renderer-only.jpg`).

**There is no streetlight near this storefront.** Seed 7 saves exactly two
`lamp` fixtures, at (9.7, 4.5) beside the housing annex across the road (≈14 m
from the door) and (22.4, 26.4) at the utility building (≈23 m). Neither lights
this corner. See §8: this needs a decision.

## 2. What the scene's scale allows

At normal play zoom a 2.2 m window is about 70–80 screen pixels wide and the
whole storefront about 400. The reference's rain-slick kerb, kanji sign and
dozens of props read at a far higher density. This pass can add convincing
structure (depth, trim, light) to one corner; it cannot, at this zoom, reproduce
the reference's fine detail. That is a limit of the camera, not of the art.

## 3. Procedural or generated

Prefer geometry and light for anything with edges. Generate only what is
surface appearance that code cannot express cheaply.

| Detail                                                       | How               | Why                                                                                                      |
| ------------------------------------------------------------ | ----------------- | -------------------------------------------------------------------------------------------------------- |
| Window frames, mullion, sill, recess reveal and inner shadow | **code**          | straight edges at known sizes; the reveal is a few polygons and a gradient                               |
| Stall riser, fascia band, parapet cap, corner pier           | **code**          | flat painted bands; the concrete material already supplies the grain                                     |
| Shutter housing box, side rails, bottom bar                  | **code**          | geometry                                                                                                 |
| Awning geometry, brackets, ribs, valance hem, drop shadow    | **code**          | geometry on saved dimensions                                                                             |
| Rooftop units: grilles, fan rings, louvres, conduits, rust   | **code**          | simple shapes; a generated unit cannot be re-lit or re-registered to saved 2 m footprints. **No asset.** |
| Contact shadows, recess shading, emissive glass, light pools | **code**          | they must follow world positions and the light, so they cannot be painted in                             |
| Window interior seen through the glass                       | **generated (A)** | needs depth and clutter                                                                                  |
| One sign                                                     | **generated (B)** | pictogram art                                                                                            |
| Awning fabric                                                | **generated (C)** | weave, fade, stains; the stripes themselves are exact                                                    |
| Shutter wear                                                 | **generated (D)** | grime, rust, tag; the slats already come from the shutter material                                       |

Not requested: the facade, roof and pavement (done), the cart, the cars, signage
text, kanji, wet reflections, any building or scene.

## 4. How the art is mapped

All four are flat and straight-on and are projected by the renderer: a surface
of known metres placed through the same affine projection the scene uses.
`surfaceMaterials.ts` already does this for tiles (`wallBasis`, `patternMatrix`).
No pre-isometric sprite is needed.

- A, B, D: a wall rectangle on the face, `s` along the wall and `z` up, anchored
  to world metres.
- C: the sloped quad from the wall line (z 2.7) to the outer edge (1.5 m out,
  z 2.45), `u` along the span, `v` down the slope (1.52 m long); repeated along
  the span.

## 5. The pack

Canvas sizes are exactly 3:2, 2:3 or 1:1 because those are what the image tool
produces. Pixels per metre is equal on both axes. Zones hatched red in a guide are
covered by game geometry. Runtime derivatives will be about a quarter of the
canvas (the largest surface is ~80 screen pixels, drawn at up to 2× supersampling).

| #   | File                             | Canvas      | Covers                                                    | px/m | Maps to                         | Key colour              | Runtime    |
| --- | -------------------------------- | ----------- | --------------------------------------------------------- | ---- | ------------------------------- | ----------------------- | ---------- |
| A   | `storefront-window-interior.png` | 1536 × 1024 | 2.2 × 1.467 m (the saved bay width, riser to window head) | 698  | wall, behind the glass          | none                    | ~384 × 256 |
| B   | `storefront-sign-panel.png`      | 1536 × 1024 | 1.35 × 0.9 m on the fascia over the door                  | 1138 | wall                            | none                    | ~384 × 256 |
| C   | `storefront-awning-fabric.png`   | 1024 × 1024 | 1.6 × 1.6 m, repeats along the span, joined left to right | 640  | the 4 × 1.5 m canopy            | none                    | 256 × 256  |
| D   | `storefront-shutter-wear.png`    | 1024 × 1536 | 1.6 × 2.4 m: the door and its housing                     | 640  | wall, over the shutter material | `#ff00ff` → transparent | ~256 × 384 |

**To generate each, attach:** the reference frame, the asset's
`guides/<id>-layout.png`, and optionally `context-placement.jpg`. The
`-annotated.png` version is for checking the result by eye: do not attach it,
the text will be copied. Prompts are in
[`art-style.md`](art-style.md#storefront-facade-assets-combat-scenes), the repo's
home for them.

Guide files (`docs/storefront-pack/guides/`): `<id>-layout.png` (zones only, exact
canvas) and `<id>-annotated.png` (the same canvas with a 0.1 m grid, dimensions,
zone labels and attachment points). Attachment points: A the room's vanishing
point and floor line; B four mounting bolts; C the wall bracket line and the end
of the slope; D the door head (where slats start) and the pavement line.

Protected: A the 7 cm frame and the 5 cm mullion; B the 4 cm rim; C the hem below
the 1.52 m slope; D the 0.2 m housing, the 8 cm rails and the bottom bar. **No door
or doorway is drawn anywhere**: the one entrance is the saved one.

Presentation changes this pack makes, each clear of saved geometry: the glazing
becomes 1.467 m tall (riser 0.883 m instead of 0.65 m) so it is exactly 3:2; the
legacy pier line that, from the renderer's code, crosses the door (at 0.8 m) moves to the building corner;
a fascia band (z 2.75–3.65) and parapet cap are added. The saved awning, door and
entrance are unchanged.

## 6. Reveal states: the rule to implement

A finding that changes the plan. With "reveal activity" on (the default), this
shop is a **cutaway** (seen in seed 7's default view; it depends on what activity lies behind): the engine lowers the facade to 0.65 m wherever
the building would hide activity behind it, and keeps 2.4 m where nothing is
hidden, including at saved door markers. `context-renderer-only.jpg` shows it.
So a storefront painted only on the full-building sprite would vanish in the
state players actually see.

Therefore the face is painted per wall segment, anchored to world metres (as the
concrete already is), by one routine used for both the full building and the
cutaway pieces, clipped to each piece's height:

- full building (reveal off, or nothing hidden): the whole face;
- cutaway piece 2.4 m (door, clear segments): riser, glazing, door, housing;
- cutaway piece 0.65 m: riser only;
- the fascia, sign (z ≥ 2.75), parapet and rooftop units belong to the full
  building and fade with it, as the awning and units already do;
- the **awning is its own sprite**, sorted by its footprint (x 24–28, y 2.5–4)
  and faded by actors like any scenery, and shown only while the wall segments
  under its span are at 2.4 m, so it never floats over a lowered wall;
- rooftop units move with the roof.

## 7. After the artwork returns

Validate against the spec (exact size, key purity in D, nothing but plain material
in protected zones, left/right seam of C, no baked glow, palette and value range)
and correct or reject mismatched perspective, scale, transparency or registration
before integrating. Derivatives will be made by a tool like `materials.mjs`.

Lighting, in this order, all anchored to world positions and clipped to the
surface that receives it: (1) contact shadows and recess/attachment shading,
(2) warm emissive glass, sign tubes and shop light, (3) restrained light on the
facade and adjacent pavement, (4) a streetlight pool tied to a fixture. No
full-scene bloom, no wet reflections, no general lighting engine. Decorative
detail never implies cover.

## 8. Decisions needed from you

1. **The streetlight.** Nothing existing is near. Options: (a) add a saved `lamp`
   to the shop frontage in recipe revision 7, for newly composed scenes only
   (frozen saves and seeds 1–3 keep their geometry); (b) a presentation-only
   fixture drawn at the storefront's corner and not saved. I recommend (a): the
   lamp is then a world object, which is what keeps the light attached to it. It
   needs your agreement because it edits the recipe.
2. **The sign.** Pictogram only, because generated lettering is unreliable and
   the house rule bars readable text in art. If you want the reference's kanji
   sign, it must be drawn in code with a CJK font.
3. **Scope.** I will extend the same code to every shop-style bay on every
   intersection seed (it is one routine), but only this corner gets the sign,
   awning art and shutter wear.

## Files

- `src/features/play/courtyard/storefrontPack.ts` and `__tests__/storefrontPack.test.ts`
- `tools/scenes/storefront-guides.ts`
- `docs/storefront-pack/` (guides, elevation, context captures)
- prompts in `docs/art-style.md`
