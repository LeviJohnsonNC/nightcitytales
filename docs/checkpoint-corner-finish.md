# Checkpoint: a consistent, finished intersection corner

**Scope:** the follow-up to the architectural art pilot
([`checkpoint-architecture-art-pilot.md`](checkpoint-architecture-art-pilot.md)), on intersection scenes only:

1. the storefront's rooftop units take the painted unit, lit by its own light pass;
2. the annex's wall, roof edge, sills and shutter housing are finished to sit with the painted openings,
   and the shutter's ripple is found and removed;
3. the painted window goes on the commercial faces that were still flat teal placeholders, varied so a row
   does not repeat.

**Reused, not commissioned:**

- the three pilot images (`roof-unit`, `annex-window`, `annex-shutter`);
- the material library (`facade-concrete`, `roof-membrane`);
- the frontage pilot's coping (`paintParapet`).

There is no new Picasso commission.

**Unchanged:**

- geometry, entrances, circulation, activity groups;
- cover, targeting, damage and saved scenes;
- sorting, fading and the cutaway's geometry;
- every missing-art fallback;
- every environment except intersections (pixel-identical to `main`).

**Not verified:** a real `/play` fight, and save/load.

## 1. The storefront's rooftop units

- **The albedo** draws the painted unit at each box's saved footprint (`rooftopUnits`, one list for every pass)
  with the existing roof shade, in place of `paintRooftopUnit`. The old procedural unit is no longer drawn
  anywhere a material scene has the art; without the art it is, as before.
- **The light.** The storefront's light pass multiplies light by the building's own albedo and clips it to its
  pixels, so a painted unit keeps its detail under light by construction. What had to change was where the light
  is.
  - The streetlight's pool was laid on the roof plane only, so on a unit standing 0.53 m above the roof it would
    have landed 8 px off.
  - `paintRoofUnitLight` lays the roof's pool less every unit's silhouette, then the pool at lid height inside
    the silhouettes. The silhouettes are the painted art itself, drawn as a mask from the same registration; no
    new mask was painted.
  - The silhouettes are applied as one mask: masking unit by unit with `destination-in` would leave light only
    where all three overlap, which a probe caught.
- **Attachment.** The light is the building's existing companion sprite, so it follows pan, zoom, fading and
  the cutaway as the building does. There is no second unit, no second shade, and no lit rectangle round a
  unit.
- **In seed 7 the streetlight's 3 m pool reaches the parapet, not the units.** So at the shipped radius the
  units' light is correctly nothing. A probe with the pool widened to 12 m showed the masking working: each
  unit lit with its fan and louvres intact, the roof's light cut away beneath it, no rectangle. The probe was
  never committed.
- The painted units stay lighter than the roof, as accepted; nothing is darkened to match the old boxes.

## 2. The annex's surfaces, and the shutter's ripple

**The ripple was the downsampling, not the art and not Phaser.**

- **The source.** It is clean. Its slats repeat every 41 px (about 0.11 m, finer than the 0.2 m the guide
  drew; real shutters are that fine). Each joint is a band of 1–3 px high-contrast lines.
- **The texture.** A building is drawn at about 30 texture px per metre, so a slat is 3 texture px. One
  `drawImage` at a 12× reduction samples a few source pixels per output pixel. The joint lines beat against
  the texture grid, and that beat is baked into the building's texture.
- **The test.** `tools/scenes/architecture-zoom-series.mjs` captures the same world rectangle at five camera
  zooms. The pattern is identical at all five, scaled with the camera, so it is in the texture, not in the
  renderer's sampling.
- **The fix.** `sourceFor` halves the art repeatedly, each halving averaging every source pixel, until it is
  within 1–2× of the size it is drawn at. Each size is cached per image, and the final draw uses high-quality
  smoothing. The same path serves the window, whose blind showed the same cross-hatch, and the roof unit.
- **Evidence.** `docs/evidence/corner-finish/zoom/before-*` and `after-*`.

**The annex's finish** (`paintShopWall`, and the parapet), on the full wall and clipped onto every cutaway piece
of it like the openings:

- **Roof edge.** A precast concrete coping round the roof, the shop's (`paintParapet`, `facade-concrete` at the
  same metres as the walls), in place of a thin rim line.
- **Wall.** A rendered plinth 0.3 m high, 2 cm proud, on the solid stretches between openings. It has a lit
  top, a contact line and splash grime above it.
- **Piers and grime.** A shallow pier at each end of each face replaces the old dark 3 px pier strokes and
  corner lines. Under the coping there is a soft wash of roof grime.
- **Sills.** The sill is now 8 cm proud and 6 cm thick, with a lit top and arris, a drip shadow, and two faint
  streaks from its ends. It reads at play zoom.
- **Reveals.** The window's reveal is drawn as the wall turned in: its floor lit, its jambs and head in shade.
  A faint sky sheen on the frame's head keeps the frame readable without an outline. The interiors stay
  dark.
- **The shutter housing's top and end.** These are the housing front's own painted steel, laid on those planes
  (the top lit, the end in shade), instead of flat fills. A lit front arris and a contact line meet the wall.

## 3. The painted window, extended

`shopFace` decides, per mass, what the art reaches:

| Mass                                                                                                                               | Window            | Shutter | Wall finish                    |
| ---------------------------------------------------------------------------------------------------------------------------------- | ----------------- | ------- | ------------------------------ |
| the storefront's own face                                                                                                          | its lit interior  | —       | its own (`storefront.ts`)      |
| the storefront's other face                                                                                                        | painted (dark)    | —       | its frontage plinth, unchanged |
| the storefront's neighbours                                                                                                        | barred, unchanged | —       | unchanged                      |
| the annex                                                                                                                          | painted           | painted | finished                       |
| a shop with no storefront block: seed 0's corner block (shop, middle, rear), whose finished face looks south, away from the camera | painted           | —       | finished                       |
| residential, workshop, warehouse                                                                                                   | unchanged         | —       | unchanged                      |

- **Fit.** The art is used only where the bay is the 2.2 × 1.7 m opening it was drawn for (`annexArtFits`).
  Anything else keeps its drawing. Nothing is stretched.
- **Variation.** `WINDOW_VARIANTS` has four looks, built once per image from its own pane structure:
  - as painted;
  - the two panes swapped (each pane is a whole composition, so nothing is mirrored);
  - each of those with the painted blind's own lowest slats let down over the other pane (0.22 or 0.34 of the
    pane, within the painted blind).
- **Choosing a variant.** It is a hash of the mass, face and bay (`variantOf`), so it never changes between
  loads. A test holds that every row of four or more uses more than one.
- **Night.** The new windows are not lit. The storefront's other face has no light pass, and nothing was added
  to one.

## 4. Evidence (`docs/evidence/corner-finish/`)

`before/` is `main` (the merged pilot), `after/` is this branch: same URL, fixed cameras
(`tools/scenes/architecture-evidence.mjs`), and `compare-*.jpg` side by side.

- **Seed 7 at play zoom:**
  - `play-night` (roof on); `play-night-reveal` (reveal and characters); `play-night-actors`;
  - `play-neutral`; `play-lights-off`.
- **The annex at play zoom:** `annex-play-night`, `annex-play-neutral`, `annex-play-reveal` (a character behind
  it, reveal on).
- **Close-ups and reveal:**
  - `annex-close-neutral`, `annex-close-night` (the shutter);
  - `annex-reveal-behind`, `annex-reveal-door`.
- **The storefront's units:** `sf-roof-night`, `sf-roof-neutral`, `sf-roof-lights-off`, and the neighbours'
  `roofs-night`.
- **The storefront's other face:** `shop-east-night`, `shop-east-neutral`.
- **Other seeds:** `seed-0`, `seed-0-neutral`, `seed-0-lights-off`, `seed-8`, `seed-8-neutral`.
- **`zoom/`:** the shutter at five camera zooms, before and after the prefilter.
- **`interaction/`:** the interaction run's frames.
- **`gameplay.jpg`:** the representative frame for the presentation review.

## 5. Screenshot observations (what the captures show, not tested behaviour)

- **One language on the roofs.** At normal play zoom every rooftop unit on the corner is now the same painted
  object; the storefront's three no longer read as a different kind of thing from its neighbours'.
- **The annex's openings sit in a wall.** The wall now has a coping, a plinth and readable sills, so the
  windows and shutter are set into it rather than pasted on. Its interiors stay dark, and it stays quieter than
  the warm shop.
- **The storefront's east face.** Two flat teal panels became recessed back-office windows with blinds. They
  differ from each other, and are dark at night.
- **The shutter** reads as even slats at every zoom. Its housing's top and end are the same steel as its front.
- **With reveal on,** the annex's cut wall carries its plinth, windows and shutter, clipped at the wall's
  height. Nothing floats when the wall goes.
- **Seed 0's corner block.** Its finished face looks south, away from the camera, so no storefront is found
  and its three commercial masses carry the varied windows, the coping and the plinth on the faces the camera
  sees. Seed 8's block keeps its barred neighbours.

## 6. Interaction tests (`tools/scenes/architecture-interaction.mjs`, `tools/scenes/architecture-zoom-series.mjs`)

- **Live run:** load with a character at the annex's door; reveal on and off; zoom in ×3; pan; Night off and
  on; Lights off and on; zoom out; reset; overview. Every step had 0 page errors and no unexpected failed
  request.
- **Fallback:** with every `/images/architecture/` request refused, 0 page errors, and the drawn boxes, bays
  and door return.
- **Pixel regression:** alley, office, nightclub, residential, warehouse and garage at seeds 4 and 7 are
  identical to `main`.
- **Repository checks:**
  - `bun run lint`: no errors; the 12 warnings were already there.
  - `bun run typecheck`, `bun run test` (3947), `bun run build`, `bun run test:browser` (28).
- **Not tested:** a real `/play` fight, and save/load.

## 7. Does the corner feel consistent at play zoom?

**Largely, yes.**

- The roofs speak one language.
- The commercial openings that were flat placeholders are now one family of recessed, dark, varied windows.
  The storefront remains the one lit, warm face.
- The annex no longer looks like art pasted on a flat box.

**What still stands out:**

- **The residential block's openings.** Flat dark panes and teal ground-floor bays, out of scope by design:
  residential openings should not take a shop's interior. It is now the least finished surface in the frame.
  It needs its own treatment, and probably one residential window image.
- **The industrial sheds' clerestories and fascias.** Still the old drawing, also by design.
- **Wall materials.** The annex's and the storefront's walls share one concrete. It is consistent, but plain
  next to the painted props; a weathered render variant would be the next material, not more openings.
- **The tactical overlay and the cutaway's visual weight.** Labels, bars and the reveal's dark walls dominate
  the frame with characters present (`gameplay.jpg`). That is left for the presentation review, as agreed.
