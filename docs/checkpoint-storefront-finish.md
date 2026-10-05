# Checkpoint: finishing the seed-7 corner

**Scope:** one focused rendering pass on the corner built in
[`checkpoint-storefront-night.md`](checkpoint-storefront-night.md), and the next art handoff,
[`street-props-pack.md`](street-props-pack.md).

- **Unchanged:** geometry, cover, targeting, damage, saved scenes and other environments.
- **Not added:** new generated art. No reference quality is claimed.

## What changed

### 1. The lamp: an arm, not a move

`lampArm` (`storefront.ts`) chooses the saved streetlight's arm from saved geometry
alone. **The saved base never moves**, and no recipe or snapshot changes.

- **Candidates.** It tries arm directions every 15° and lengths of 1.2–3 m, the
  range of real cobra-head mast arms.
- **Kept only if:** the head hangs over open ground, clear of every building footprint
  and every cover piece; the arm's midpoint is outside every building; and the lantern
  is at least 0.5 m clear of every cover piece's silhouette seen from this camera.
- **Preference:** the arm nearest straight-out from the facade, then the length
  nearest the usual 1.5 m.

**Results:**

- **Seed 7:** the arm turns 60° toward the street and reaches 2.7 m. The lantern now
  hangs over the kerb left of the car, not on its bonnet.
- **Every layout:** all 68 shop lamps in seeds 0–80 find a clear arm, which a test
  holds. The 22 east-facing lamps keep a straight-out arm at 1.2 m.
- **Light stays with the source:** the head is the single source for the fixture, its
  halo and cone, the pavement pool and the wall/awning wash.

A recipe change was therefore not needed. Cars and activity groups are untouched.

### 2. Contrast, selectively

Measured on the identical framing with no characters (`scenery-solid`), the frame is
not darker:

| Region  | Mean (before → after) |
| ------- | --------------------- |
| Frame   | 45.5 → 46.8           |
| Asphalt | 23.2 → 21.7           |
| Paving  | 38.8 → 40.6           |
| Roofs   | 54.6 → 58.3           |

- **Material grade.** A multiply layer over the ground, visible only at night
  (`paintNightGrade`), takes asphalt a little deeper and cooler and paving a little
  warmer. The ambient is a touch lighter and less blue, (0.55, 0.60, 0.74) from
  (0.50, 0.56, 0.74), so the net change is separation, not darkness.
- **Contact and recesses.** Deeper and tighter: the wall-foot strip, the window reveal
  and its inner sill shadow, the head shadow, the shutter under its housing and at its
  foot, and the awning's shadow on the wall.
- **Edges only where a light can reach them.** The parapet's top lip and the corner
  pier nearest the lamp catch it, fading with distance. There are no building outlines
  anywhere.
- **Windows.** Room light is lowered and the glass glow halved, so the window artwork
  reads warm rather than washed out.
- **Soft boundaries.** The lamp's cone is a faint blurred haze, and window spill fans
  are feathered. Neither leaves a geometric edge.

### 3. A blade sign

`bladeSign` / `paintBladeSign` draw a 0.44 × 1.2 m lightbox standing 0.18–0.62 m off the
fascia, 2.95–4.15 m up, on two steel brackets and a brace, 0.5 m past the awning's far
end. Its neon border and the four glyphs of 深夜市場, drawn from the existing kanji mask
cell by cell, run down it.

- **At play zoom** its pink vertical silhouette reads; the lettering only up close.
- **Its own sprite**, sorted by its footprint, so it draws over the awning and under a
  person standing in front.
- **On the building's activity layer,** so the cutaway takes it away with the fascia.
  It never floats.
- **`fadeWith` its building,** so it is never more solid than the wall it hangs from.

### 4. Cutaway: compared, not adopted

[current](evidence/storefront-finish/cutaway/current.jpg) ·
[quiet poché alternative](evidence/storefront-finish/cutaway/quiet-poche.jpg) ·
[side by side](evidence/storefront-finish/cutaway/compare.jpg).

The alternative is a mid-grey cut slab with a fine diagonal hatch and a lighter wall
line. It was captured from a temporary patch, then reverted.

- **Better:** it is quieter than the dark slab, and it still reads as a solid,
  inaccessible footprint, with no furniture, no road showing through and nothing over
  actors.
- **Worse:** at play zoom its value sits close to the paving, so it starts to read as a
  walkable plaza.
- **Recommendation:** keep the current treatment until a pass can add a raised cut-wall
  rim to the alternative.

### 5. The next art handoff

[`street-props-pack.md`](street-props-pack.md) contains:

- the renderer facts, inspected rather than assumed;
- the seed-7 bindings;
- square guides for the sedan (both rotations), planter and cabinet, with their cut plan;
- the registration proof over the shipping renderer;
- the importer steps;
- the commissioning order: the r90 intact sedan first, validated in game.

The prompts are in [`art-style.md`](art-style.md#street-props-combat-scenes).

## Evidence (unedited browser captures, `docs/evidence/storefront-finish/`)

Before is `main` at the merge of the night pass; after is this branch. Every pair uses
the same URL, camera and character position.

| View                                                     | Before / after                                                                                                                     |
| -------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| Corner, no characters, reveal off                        | [compare](evidence/storefront-finish/compare-scenery-solid.jpg)                                                                    |
| Corner, no characters, reveal on                         | [compare](evidence/storefront-finish/compare-scenery-reveal.jpg)                                                                   |
| Corner with characters, reveal on                        | [compare](evidence/storefront-finish/compare-corner-reveal.jpg)                                                                    |
| Close-up, reveal off / on                                | [off](evidence/storefront-finish/compare-closeup-solid.jpg) · [on](evidence/storefront-finish/compare-closeup-reveal.jpg)          |
| Blade sign, actor in front, reveal off / on (after only) | [off](evidence/storefront-finish/after/blade-actor-solid.jpg) · [on](evidence/storefront-finish/after/blade-actor-reveal.jpg)      |
| Lights off, neutral, no overlays, damaged (after only)   | `after/corner-*-lights-off.jpg`, `after/corner-*-neutral.jpg`, `after/corner-*-no-overlays.jpg`, `after/corner-reveal-damaged.jpg` |
| Other seeds (1, 4, 8, 0), reveal off                     | [after](evidence/storefront-finish/after/other-seeds-solid.jpg)                                                                    |

## Screenshot observations (what the captures show, not tested behaviour)

- **The lantern** now hangs over open kerb, clear of the car, and reads as a streetlight.
  Its pool lands on the corner of the pavement and the road.
- **Materials:** asphalt and paving separate, and roofs read lighter than the road.
  Window rooms are visible rather than glaring.
- **The blade sign** reads as a pink vertical sign at play zoom. With the review
  fixture's workers behind the shop, the whole building and its blade fade to 40%
  together. With reveal on, the blade is gone with the fascia and the valance sign
  carries the name.
- **Other seeds:** seeds 1 and 8 (8 is an east-facing shop) show their blade signs and
  clear lamps. Seed 0 (no storefront) is unchanged in kind.

## Interaction tests (driven in the browser, results as observed)

`/scene-review` at the corner framing, run against this branch:

- **Reveal toggle:** both directions changed the frame.
- **Lights and Night checkboxes:** both switched live, without a remount.
- **Camera:** zoom in, zoom out, pan by drag and reset all changed the frame.
- **Target selection:** selecting the 6th Street rifleman shows an assessment reading
  "NO LINE OF SIGHT", the same reading as `main`.
- **Diagram view** toggled without error.
- **No page errors.**

Pixel regression against `main`:

- **Alley 5, office 4, residential 4, garage 33, nightclub 7 and warehouse 5:**
  pixel-identical with no actors.
- **Unit tests:**
  - `storefront.test.ts`: the arm never moves the base, every lamp in seeds 0–80 finds a
    clear arm, seed 7's lantern is outside the car's silhouette, the pool stays under the
    head, the blade's placement and passes, and the grade.
  - `streetPropPack.test.ts`: the bindings, the projection identity with the board, the
    seamless join and the cut ownership.

**Not tested:** a real campaign fight in `/play` (it needs a Supabase session), and
save/load.

## Honest critique

- **The lamp is fixed in kind, not in craft.** The fixture is still a small code-drawn
  silhouette. Against the reference's lamps it is thin, and its pool is a soft disc
  rather than light shaped by kerbs and wet tarmac.
- **The contrast changes are deliberately modest.** The corner still reads mid-tone
  overall. The reference's deep blacks and wet speculars are out of scope (no wet
  reflections or bloom).
- **The blade sign's lettering is decorative at play zoom.** Its strength is its
  silhouette and colour. The brackets are thin and only read up close.
- **The props are now the weakest thing on screen.** The tan box sedan, the blocky
  planter and the flat cabinet are why the street pack is next.
