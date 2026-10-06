# Checkpoint: prop consistency across the intersection variants

**Scope.** The props on intersection seeds 7, 0 and 8: an audit of every art binding, three paints for the
existing sedan, and the Picasso pack for what still needs painting.

**Unchanged:**

- layout, footprints, heights, cover, damage, movement, targeting and saves;
- the camera and the architecture.

**Deferred:** wet surfaces, more facade decoration and new lighting systems.

**The cutaway light correction shipped separately** (`checkpoint-cutaway-light.md`).

## 1. Audit

The full table is in [`street-props-pack/round-2.md`](street-props-pack/round-2.md) §1. In short:

| Binding                                               | Status                                                                                  |
| ----------------------------------------------------- | --------------------------------------------------------------------------------------- |
| Sedan (both sections, both rotations, three states)   | Finished art. **Now three paints** (§2).                                                |
| Planter                                               | Finished art. One symmetric image serves both rotations.                                |
| Cabinet (`mailboxes`)                                 | Finished at r0. **At r90, seed 0's pale cabinet, it falls back to the procedural kit.** |
| Merchandise stand (`shop-display`, the striped kiosk) | **Procedural on every seed.**                                                           |
| Cart, crates, dumpster, generator, pallet             | Finished atlas art. At r90 the board mirrors it (a standing debt, not this round).      |

**The pale cabinet in seed 0 is not a different prop.** It is the same `mailboxes` binding as seed 7's painted
cabinet, saved at rotation 90. Round one painted only rotation 0, and art is never mirrored, so the rotated
one fell back to the kit. It needs the same cabinet painted turned, not a new type.

## 2. Vehicle repetition: body paint from the existing art (`courtyard/sedanPaint.ts`)

No Picasso round was needed: a mask holds up on every intact and damaged frame.

- **The mask is chromatic.** A pixel is body paint when two things hold:
  - its CIE L\*a\*b\* hue is the beige's (82° ± 8, fading out by 16);
  - its chroma for its lightness is what the beige's is at that lightness. That ratio rises from 0.31 in light
    to about 0.45 in shade, so shaded door panels count as paint.

  Glass, tyres, bumpers, rubber, lamps, bullet holes and rust have a different hue or chroma and stay out. A
  5 × 5 median and a slight blur clean the edge.

- **The recolour keeps every pixel's own luminance,** in linear light, against the paint's. Shading, scratches,
  grime and rust streaks stay where they were, and the alpha is untouched.
- **The palette:**
  - the art's own beige;
  - burgundy (112, 30, 40);
  - a dark gunmetal charcoal (92, 96, 102). The first charcoal tried (62, 64, 68) had the asphalt's own
    luminance and vanished into it at night.
- **Wrecks keep their art.** They are burned to bare metal, so there is no paint left on them, and it is the
  same wreck whatever the colour was.
- **Baked offline** by `tools/art/sedan-paint.ts`: 16 files, intact and damaged for both sections in both
  rotations, two paints each.
  - It fails a frame whose mask covers outside 25–85% (the actual range is 48–72%), or whose alpha changed.
  - A test holds the baked files to the code.
- **Chosen from the saved layout** (`sedanPaints`):
  - the cars (clusters) are sorted, and the palette is walked from an offset hashed from their ids and where
    they are parked;
  - both sections of a car share one paint in either rotation and any mix of damage;
  - every street has more than one colour, and seeds 7, 0 and 8 are not all painted alike;
  - the same layout is always painted the same.
- **A missing file falls back** to the art's own beige.

## 3. The stand and the cabinet: the Picasso pack, round two

Nothing is approximated: the stand and the rotated cabinet keep the procedural kit until their images
return. The pack is in [`street-props-pack/round-2.md`](street-props-pack/round-2.md), with prompts in
[`art-style.md`](art-style.md#street-props-round-two).

- **The images:**
  - the stand at r0 and r90, three states each;
  - the cabinet at r90, three states.
- **The guides** are measured from the renderer's own projection (`streetPropPack.ts`, `KIOSK`, `CABINET`,
  `STREET_PROP_PACK_2`) and drawn by `tools/scenes/street-prop-guides.ts --round 2`.
  - Canvas 1024 × 1024 on a flat `#FF00FF` key.
  - The volume, heights and open side are marked.
  - The stand's heights are the procedural stand's own, and a test holds them.
- **Placement proofs.** Each guide's volume is drawn over the shipping renderer on the variant that shows it:
  seed 0 for the cabinet and the stand at r90, seed 7 for the stand at r0.
- **References:**
  - the food cart, the material quality to match;
  - crops of what each binding shows now.
- **Requested lighting:** neutral, overcast, and nothing baked in: no ground, shadow, glow, lit lamps or
  readable text. A rotation is always painted turned, never mirrored.
- **The import steps** for when the images return are in round-2 §6.

## 4. Evidence (`docs/evidence/prop-consistency/`)

`before/` is `main` and `after/` is this branch, from `tools/scenes/prop-evidence.mjs`. `compare/` sets them
side by side.

- **Play scale, seeds 7, 0 and 8 with characters:**
  - `seedN-play`;
  - `seedN-lights-off`;
  - `seedN-reveal`;
  - `seedN-mixed-damage` (every other cover piece destroyed).
- **Close-ups** of a painted car on each seed (`close-seed7-car-west`, `close-seed7-car-thorton`,
  `close-seed0-car-thorton`, `close-seed8-car-thorton`), each:
  - intact;
  - `-mixed` (one section wrecked beside an intact one);
  - `-damaged`;
  - `-neutral` (no night).

## 5. Browser-tested behaviour

- **Interaction runs.** `architecture-interaction.mjs` on seeds 7, 0 and 8 (scratch output) gave 0 page errors
  and 0 unexpected failed requests, live and in the missing-art fallback. The run covers reveal, zoom, pan,
  night, lights, reset and overview.
- **`prop-evidence.mjs`.** 0 page errors on all 28 shots, before and after.
- **Reload.** Seed 0 and seed 8 loaded twice each at a close-up of a painted car: the two frames are
  byte-identical (same SHA-1), so the paint survives a reload exactly.

## 6. Screenshot observations (not tested behaviour)

- **The street reads as several cars.**
  - Seeds 7 and 0 show two charcoal cars, one burgundy and one beige.
  - Seed 8 shows two burgundy, one charcoal and one beige.
  - Before, every car was the same beige.
- **The paint is paint.** Glass, tyres, bumpers, lamps, bullet holes and rust streaks are untouched. Shading
  and wear show through the new colour (`compare/close-*-damaged.jpg`).
- **Mixed damage reads as one car.** An intact painted section beside a wrecked one: the wreck is burned bare,
  the other keeps its paint (`compare/close-*-mixed.jpg`).
- **Actor overlap.** A car still fades for a person behind or beside it, exactly as before
  (`close-seed8-car-thorton-damaged`).
- **Lights off.** The paints keep their value relationships.
- **The stand and the rotated cabinet are visibly unchanged and still procedural.** They wait for round two.

## 7. Checks

- `bun run lint`: no errors; the 12 warnings were already there.
- `typecheck`.
- `test`: 4020.
- `build`.
- `test:browser`.
- **New tests:**
  - `sedanPaint.test.ts`:
    - the mask takes the paint and leaves glass, tyres, trim, lamps and rust;
    - a repaint keeps the alpha and every pixel outside the mask;
    - the baked files match the code;
    - one paint per car, more than one per street, not all seeds alike, and order-independent.
  - `streetPropArt.test.ts`: the paint files are loaded under their own keys, and no wreck has a paint.
  - `streetPropPack.test.ts`: round two is bound to props the variants save, the stand's heights are the
    procedural stand's, and the guides fit their canvas.

## 8. Limitations

- **The stand and the rotated cabinet** stay procedural until round two is painted and imported.
- **The atlas props are mirrored at r90.** The cart, crates, dumpster, generator and pallet are recorded as a
  debt, not addressed.
- **Two of the three variants share a palette assignment.** That is a one-in-three chance with three paints,
  and it is deterministic.
- **Not exercised:** a real `/play` fight and save/load.
