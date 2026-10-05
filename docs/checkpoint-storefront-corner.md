# Storefront corner — first implementation

Seed 7's corner shop, built on the art pack ([`checkpoint-storefront-pack.md`](checkpoint-storefront-pack.md)) and
the material pass ([`checkpoint-material-pass-1.md`](checkpoint-material-pass-1.md)). **Not visually accepted, and not
claimed to match the reference.** The captures below are evidence for review; passing tests prove registration and
state handling, not that it looks right.

Saved walls, entrances, footprints, circulation, cover, targeting, damage and save compatibility are untouched. Six
other environments render with **0 differing pixels** against `main` (alley 5, office 4, residential 4, garage 33,
nightclub 7, warehouse 5). Intersection seeds 1, 2, 3, 4, 12 and 13 render without breakage.

## What was built

Everything is in the shared renderer, in `courtyard/storefront.ts`, applied to the one shop that has a camera-facing
awning (`storefrontFor`). Positions are read from the saved structure, entrance, awning attachment and lamp.

| Element         | How                                                                                                                                                                                                                     |
| --------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Window recesses | per bay: stall riser, opening with the **returned interior (A)** set 12 cm behind the glass, a visible near jamb and a lit sill ledge, a 7 cm frame and mullion, inner shadow under the head, a faint glass tint. Code. |
| Shutter door    | the shutter material, the **returned wear overlay (D)** over it, a shaded head and foot, two side rails 4 cm proud, a 15 cm housing box.                                                                                |
| Fascia and sign | a concrete fascia band and parapet coping; the **kanji sign 深夜市場** as a light-box with rim, bolts and a tinted glyph mask, all code.                                                                                |
| Awning          | the **returned fabric (C)** on the saved slope (2.7 m at the wall to 2.45 m, 1.5 m out), a folded hem, two arms; **its own sprite**, sorted by its footprint.                                                           |
| Rooftop units   | a rimmed lid, a fan with blades and grille drawn as a world-space circle, louvres, a rust streak, vent stacks on alternate units, roof contact shadow. Code, on the shop's existing units.                              |
| Streetlight     | the saved v7 lamp now has a base plate, pole, arm and lantern. Lit: a halo at the lens.                                                                                                                                 |
| Contact shadow  | along the wall's foot (0.7 m), under the awning on the pavement, on the wall under the canopy, beneath the housing, and on the roof around each unit.                                                                   |
| Light           | see below.                                                                                                                                                                                                              |

### Light, in the order asked

1. Contact shadow and shading on recesses and attachments (always on; they are shade, not light).
2. Warm emissive: window glass (stronger low, at the counter), the sign's tubes (a coloured halo and a lighter core), the awning's hem.
3. Restrained light on the facade and pavement: a warm fan in front of each window, fading over 3 m, and a soft wash on the wall nearest the lamp.
4. The streetlight's pool: a 4.6 m circle on the ground, drawn through the scene's own transform so it is the right ellipse, anchored to the saved lamp.

All of it is painted where it falls, from world positions, so it cannot drift while panning or zooming. Ground light is clipped
around every building footprint (even-odd), so none reaches a cutaway floor; the wall wash is clipped to the wall. No bloom, no
wet reflections, no lighting engine. `/scene-review` has a **Lights** checkbox (`lights=0`) to judge the art unlit.

## Reveal states

With reveal on (the default) seed 7's storefront face is **kept at 2.4 m along its whole length** (only the far wall is
lowered), so the door, shutter, housing and windows show in the default view. The fascia, sign, parapet and roof are above
that and show only with the building whole (reveal off). Each cutaway piece paints only the part of the face it carries, up
to its height (`clip`), so revealing the street does not change the wall. The awning shows in the cutaway while the wall it
hangs from is kept (`revealOk`), and fades to 40% for actors under it, as any scenery does.

## The returned images

`bun run tools/art/storefront-assets.ts` checks each against its guide, then writes the runtime file; it fails and writes nothing
if one is wrong.

| Image             | Source                  | Checks                                                                                                         | Runtime                    |
| ----------------- | ----------------------- | -------------------------------------------------------------------------------------------------------------- | -------------------------- |
| A window interior | 1536×1024               | 3:2; frame ring dark (26); nothing blown out (0.00%): no baked light                                           | 768×512, 65 KB             |
| C awning fabric   | 1254×1254 (asked 1024²) | 1:1; stripes teal-cream-teal-cream; boundaries 1 px off the quarter lines; left/right seam 1.35× a stripe edge | 512×512, 103 KB            |
| D shutter wear    | 1024×1536               | 2:3; 67.5% pure key; rails 0.23% and foot 0.00% hold art; housing art (1.9%) cleared                           | 512×768 with alpha, 203 KB |

The image tool returned the awning at 1254² rather than 1024²: the proportion is what the guide fixes, so it passes, and the
resize is part of the tool. Chroma-keying D needed a second pass: a first un-mixing left a hot red fringe; the shipped version
removes the magenta excess instead and chokes the edge. A thin warm rim on the rust remains and is visible only at the
largest zoom. **Asset B (the sign panel) was returned but is unused**: the sign is code. It stays in `src/assets/creator/`
and, like the others, is excluded from the bundle.

## Evidence

Chromium (software GL), `/scene-review`, the shared renderer, unedited screenshots from `tools/scenes/storefront-evidence.mjs`
(JPEG at capture). Before = `main` at 382cbb9, which already has the materials and the v7 lamp; after = this branch.
"Close-up" is five zoom steps; "corner" is two.

| View                                   | Before                                                                                     | After                                                           |
| -------------------------------------- | ------------------------------------------------------------------------------------------ | --------------------------------------------------------------- |
| Close-up, actors + overlay, reveal on  | [before](evidence/storefront/before/closeup-actors-reveal.jpg)                             | [after](evidence/storefront/after/closeup-actors-reveal.jpg)    |
| Close-up, actors + overlay, reveal off | [before](evidence/storefront/before/closeup-actors-solid.jpg)                              | [after](evidence/storefront/after/closeup-actors-solid.jpg)     |
| Actor under the awning, reveal on      | [before](evidence/storefront/before/closeup-access-reveal.jpg)                             | [after](evidence/storefront/after/closeup-access-reveal.jpg)    |
| Actor under the awning, reveal off     | [before](evidence/storefront/before/closeup-access-solid.jpg)                              | [after](evidence/storefront/after/closeup-access-solid.jpg)     |
| Corner, actors + overlay, reveal on    | [before](evidence/storefront/before/corner-actors-reveal.jpg)                              | [after](evidence/storefront/after/corner-actors-reveal.jpg)     |
| Corner, reveal off                     | [before](evidence/storefront/before/corner-actors-solid.jpg)                               | [after](evidence/storefront/after/corner-actors-solid.jpg)      |
| No characters, reveal on               | [before](evidence/storefront/before/scenic-reveal.jpg)                                     | [after](evidence/storefront/after/scenic-reveal.jpg)            |
| No characters, reveal off              | [before](evidence/storefront/before/scenic-solid.jpg)                                      | [after](evidence/storefront/after/scenic-solid.jpg)             |
| **Lights off**, reveal on              | [before](evidence/storefront/before/scenic-reveal-lights-off.jpg) (no toggle: same as lit) | [after](evidence/storefront/after/scenic-reveal-lights-off.jpg) |
| **Lights off**, reveal off             | [before](evidence/storefront/before/scenic-solid-lights-off.jpg) (no toggle: same as lit)  | [after](evidence/storefront/after/scenic-solid-lights-off.jpg)  |
| Cover damaged                          | [before](evidence/storefront/before/corner-damaged.jpg)                                    | [after](evidence/storefront/after/corner-damaged.jpg)           |
| Cover destroyed                        | [before](evidence/storefront/before/corner-destroyed.jpg)                                  | [after](evidence/storefront/after/corner-destroyed.jpg)         |

## What this does not establish

- **No reference-level quality is claimed.** The reference's wet pavement, signage density and prop density are not here, and
  were not asked for. This is one shop front, at the camera's scale.
- **The kanji reads as glowing kanji-shaped marks.** A glyph cell is about 15 screen pixels at normal zoom; the characters are
  legible only zoomed in, and only with the building whole.
- It applies to **the one storefront structure** of an intersection, and only where its awning faces a wall the camera sees.
  The annex and the attached shop row keep the material-pass look, and quarter-turn layouts (seed 0, for example) get no
  storefront, because their awning faces away.
- Light was tuned by eye in one renderer. The lights toggle exists only in `/scene-review`; the shipping board always lights.
- Real campaign movement, firing and save/load were not run. Panning and zooming were exercised in the browser by the
  captures and the light stayed attached, but that is a look, not a test of the engine.
- Chromium only; Safari and Firefox were not looked at. Material scenes are painted at 2×, so memory is higher for them.
- When the shop is whole and an actor stands behind or under it, the whole building fades to 40%: the existing rule, which
  includes the new sign and canopy.
