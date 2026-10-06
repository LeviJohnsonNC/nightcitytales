# Checkpoint: the intersection's ground

**Scope.** The street surfaces and how objects meet them, on intersection scenes with materials. Seed 7 is the
benchmark; seeds 0 and 8 check the variation.

**Unchanged:**

- object placement, walls, entrances and routes;
- movement, cover, targeting and damage;
- saved geometry and state;
- every tactical overlay (grid, routes, rings, markers and lines are drawn above the ground and never weathered);
- every other environment. There are no new lights, colour grading or reflections.

**Not verified:** a real `/play` fight and save/load. Section 6 is the checklist for that, for Levi to run.

## 1. Audit (before)

The `before` half of each `compare-*.jpg` is the state below. The most conspicuous unfinished ground, in
order of screen area:

1. **Unclaimed ground was a flat dark fill.** The strip between the residential block and its walk, and every
   other bit of ground no zone claims, was `#293034` with no material. It was the largest flat area on the
   board.
2. **The entrance pads were flat tinted squares.** Each was a flat 1.6 m square in front of a door. The
   residential entry was a translucent teal rectangle with a pale outline, and read as a UI highlight.
3. **The loading court and its apron were flat fills.** They had yellow paint and no surface.
4. **Pale outlines ran round every pavement zone,** including where two pavements meet flush. The kerbs had
   already been drawn properly by the architectural pilot, so these were left over from the flat fallback.
5. **The paint was uniformly clean.** Crossings and lane dashes were factory-new.
6. **The paving was one repeating 4 m tile** with nothing to break it.
7. **Contact with the ground.**
   - The kit and the painted street props each baked one flat parallelogram the size of the 2 m footprint
     under the prop, at 23%.
   - Wrecks got the same parallelogram, so a wreck kept the intact object's full shadow.
   - The atlas props (cart, dumpster, generator, cargo, pallet) had no contact at all and floated.
8. **No dirt at the feet of the homes, sheds and annex.** Only the shop's block had it.

**Gameplay indicators** (left untouched): the movement squares and their edge, routes and destinations,
rings, brackets, markers, line of sight and "IN THE WAY", and the board outline. **Physical surfaces**
(finished here): everything painted into the ground canvas.

## 2. Surfaces (`composedEnvironment.ts`, existing materials only)

| Surface                     | Before                       | After                                                                |
| --------------------------- | ---------------------------- | -------------------------------------------------------------------- |
| Unclaimed ground            | flat dark fill               | `facade-concrete`, toned dark, in 2 m slabs: old hard standing       |
| Entrance pads               | flat tinted 1.6 m square     | one paler `facade-concrete` threshold slab with a dark joint         |
| Residential entry (`entry`) | teal rectangle, pale outline | `sidewalk` paving with a granite edging line                         |
| Loading court and apron     | flat fills                   | `asphalt`, with the yellow marks kept on top                         |
| Pavement outlines           | pale line round every zone   | none on laid paving (the kerbs bound the road); kept on the fallback |

Every material is laid at world scale through the scene's own projection. An entrance is still found by its
threshold, the sill line at the wall and the change of material.

## 3. Wear (`courtyard/groundFinish.ts`)

Every mark comes from the scene's own structures, gullies, props and entrances, by `hash` of a world position.
It is stable across reloads and camera movement, and nothing is spread evenly.

- **Slabs.** About 7% of 1 m slabs are a shade darker, about 4% lighter, and about 2% are newer repairs (paler,
  with a cut edge). The slabs follow the sidewalk tile's own joints, which fall on whole metres.
- **Gutters.** Silt and damp lie in the channel either side of each saved gully, thinning away from it.
- **Paint.** Crossings are worn along the wheel tracks: two per lane, along the direction of travel, plus a few
  chips. About two lane dashes in five are scuffed. The pattern always stays legible.
- **Oil.** About 70% of engine sections have a drip under the sump, each a different size, plus one beside the
  generator.
- **Wall feet.** A tight contact line and a short fall of dirt run along every open face of a home, shed or
  annex, heavier in internal corners. The shop's block keeps its own (`paintFrontageGround`).
- **Thresholds.** Feet darken a door's step. Trolleys scuff a loading door's.

## 4. Contact (`courtyard/contactShade.ts`)

The baked footprint parallelogram is gone on the intersection; other environments keep it. Each prop has a
contact sprite made from its own picture:

- **How it is made.** In each column of the texture inside its registered 2 m footprint, the lowest opaque
  pixel is where the object stands, if it is near the footprint's front edge. A short soft fall of shade (about
  0.4 m) runs from there onto the ground.
- **Overhangs cast nothing.** A canopy or awning high above the ground is not a contact. This is contact
  shading, not a cast shadow; there is no sun and no dynamic-shadow system.
- **A wreck's contact is the wreck's own.** It is made from the wrecked texture, at about half the strength:
  low, short and faint. It never keeps the intact object's shadow, and it changes the moment a piece is
  destroyed, with the prop's own texture.
- **Registration.** It uses the same registration, origin, flip and size as the prop. Its canvas runs a few
  rows below the texture so the shade can fall past the footprint's front corner.
- **Depth.** It is drawn at ground depth: above the ground and its light, below the cutaway floors, the grid
  and everything standing. It is never sorted, faded or tinted with the prop, so a prop that fades for a
  person behind it leaves its contact on the ground. Inside a revealed building the cutaway floor covers the
  ground, so no hidden prop can leave an unexplained patch.
- **Earlier misses, both fixed.** On the first pass it rendered nothing: a canvas texture must be refreshed to
  reach the GPU. On the second it was too faint and short to see at play zoom.

## 5. Evidence (`docs/evidence/ground-pass/`)

`after/` is this branch. `compare-*.jpg` set each shot beside `main` at the same camera, `main` on the left.

- **Seed 7, roof on, actors off:** `seed7-roof-actors-off`.
- **Seed 7, reveal on, actors present:** `seed7-reveal-actors`.
- **Movement planning and targeting:** `seed7-plan`, `seed7-target`.
- **Neutral lighting:** `seed7-neutral`, `seed0-neutral`, `seed8-neutral`.
- **Seeds 0 and 8:** `seed0`, `seed8`.
- **Ground contact with intact and destroyed props:** `contact-mixed`, `contact-mixed-neutral`.
  - `/scene-review` gains `damage=mixed`, which destroys every other cover piece. One sedan section is wrecked
    beside an intact one, and an intact cabinet sits beside a wrecked planter.
  - `zoom-contact-*.jpg` are the same frames at 2x, for the contact detail only. Judge at play zoom first.
- **Close-ups of the corner and the loading court:** `corner-neutral`, `court-neutral`.

## 6. Manual gameplay check, for Levi (not run)

Not run: this session has no authenticated campaign. Do not substitute `/scene-review` captures for it.

**Setup.**

1. Sign in. Use an expendable character and campaign whose opening is done.
2. Open `/combat`.
3. Choose **North Heywood · commercial intersection · variation 1**. This is the composed corner; the harness
   offers variations 1–3, not seed 7.
4. Choose any opposition, **Unhurt**, then start. It hands off to `/play/:id`.

**Checks.**

| #   | Do                                                                          | Expect                                                                                                                                          |
| --- | --------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Move around the shop corner: the pavement, under the awning, past the cart. | The route goes round the cart, the planters and the walls. Nothing new blocks it. Squares on the new paving and thresholds behave as before.    |
| 2   | Aim at a hostile across open road.                                          | A clear shot: the solid line and a "SHOOT" card with a DV.                                                                                      |
| 3   | Aim at a hostile behind a parked sedan.                                     | "NO SHOT", "IN THE WAY" at the sedan section, and a "Find firing position" offer.                                                               |
| 4   | Shoot one sedan section until it is destroyed.                              | Only that section becomes a wreck. The other section stays intact and keeps blocking. The wreck's contact shade is small and faint.             |
| 5   | Move through the destroyed section's squares.                               | The move is allowed and costs as normal ground. Nothing is left that blocks the path.                                                           |
| 6   | Save: leave `/play/:id` and reload it.                                      | Positions, HP, the destroyed section, the intact section and the turn are as you left them. No extra shadow or stale object where the wreck is. |
| 7   | Shoot across the destroyed section afterwards.                              | It no longer blocks. The other section still does.                                                                                              |

**Return:** a screenshot after each of steps 3, 4, 5 and 6, and the browser console's errors, if any. Give the
step number of anything unexpected.

## 7. Screenshot observations (not tested behaviour)

At play zoom first:

- **The street reads as used, not busier.**
  - The flat dark strip by the residential block is now concrete hard standing.
  - The teal pad at the residential entry is now paving.
  - The loading court has a surface.
  - The crossings are worn where cars run.
- **Overlays.** The movement overlay and targeting read exactly as before (`compare-seed7-plan`,
  `compare-seed7-target`).
- **Contact.** Props sit on the ground: wheels, cabinet and planter bases, the dumpster's castors and the
  generator's skid. The cart no longer floats. A wreck has a faint, low contact, not the old full rectangle.
- **At night** the hard standing is lighter than the old dark fill. The night as a whole is unchanged.
- **Close up:**
  - The repairs and off-tone slabs are visible but sparse.
  - The oil drips differ in size, and some cars have none.
  - The gutter silt sits at the gullies only.

## 8. Checks

- **Repository checks.** All pass:
  - `bun run lint` (no errors; the 12 warnings were already there);
  - `typecheck`;
  - `test` (3981);
  - `build`;
  - `test:browser` (28, including the WCAG scan of `/scene-review`).
- **New tests** (`groundFinish.test.ts`):
  - wear is deterministic and sparse;
  - oil only under engines and the generator, each drip its own size;
  - contact lies under a standing object and falls past the texture's bottom;
  - an overhang casts nothing;
  - a wreck's contact is fainter;
  - the registration matches the kit's.
- **Interaction runs.**
  - `architecture-interaction.mjs`: 0 page errors live and in the missing-art fallback.
  - `ground-evidence.mjs`: 0 page errors.

## 9. The three remaining differences from the reference, ranked

1. **Lighting (largest).** The reference is lit by many practical sources: lit shopfronts and windows on every
   building, neon signs, traffic signals and wet reflections pooling colour on the road. Here the night is one
   cool ambient with two lamps and one lit shopfront. Most of the reference's depth and mood comes from this.
2. **Artwork: street furniture and variety.** The reference fills the corner with traffic lights, barriers,
   cones, a vending machine, bins, sandwich boards, a van and a taxi, all different. Here one sedan model and
   one rooftop unit repeat, and the striped kiosk is less finished than the food cart.
3. **Presentation: framing and road proportion.** The reference is framed tighter, with characters larger and
   the corner filling the view. Its roads carry double yellow lines and stop lines. Here the play framing shows
   a lot of empty, plainly marked carriageway, so the eye lands on asphalt rather than on the corner.
