# Street props, round two: the bindings the variants still draw procedurally

Status: **imported** (`docs/checkpoint-prop-round-two.md`). All nine images pass the importer. The exception is
`street-kiosk-r0-wrecked`, 1.1% above its volume against a 1% limit; it imports under `TALL_WRECKS_PENDING`
while its redraw is out (§7). The merchandise stand and the rotated cabinet now draw this art.

The contract is round one's ([`../street-props-pack.md`](../street-props-pack.md)), unchanged: one 256 × 320
frame per saved 2 m section, true isometric, never mirrored, three states, no baked light or shadow. The
numbers live in `src/features/play/courtyard/streetPropPack.ts` (`KIOSK`, `CABINET`, `STREET_PROP_PACK_2`).

```
bun run tools/scenes/street-prop-guides.ts --round 2 --port 5180
```

draws every guide below from them, and a placement proof on the variant that shows each prop.

## 1. Audit: every visible art binding, seeds 7, 0 and 8

Read off the saved layouts (`composeScene("intersection", seed)`), then checked in the renderer.

| Binding (`art`)                                         | Seed 7  | Seed 0  | Seed 8  | Drawn by                          | Orientations                            | States          | Verdict                                             |
| ------------------------------------------------------- | ------- | ------- | ------- | --------------------------------- | --------------------------------------- | --------------- | --------------------------------------------------- |
| `sedan-engine`, `sedan-cabin` (4 cars)                  | r90     | r0      | r90     | Picasso art (round one)           | own art for r0 and r90                  | all three       | finished; now in three paints (§3)                  |
| `planter` (4)                                           | r0, r90 | r0, r90 | r0, r90 | Picasso art                       | one symmetric image serves both         | all three       | finished                                            |
| `mailboxes` (the cabinet)                               | r0      | **r90** | r0      | Picasso art at r0; **kit at r90** | **r0 only**                             | all three at r0 | **uncovered binding at r90** (§2)                   |
| `shop-display` (the striped stand)                      | r0      | **r90** | r0      | **procedural kit**                | kit only                                | kit only        | **provisional on every seed**                       |
| `food-cart`, `cargo`, `dumpster`, `generator`, `pallet` | yes     | yes     | yes     | painted atlas                     | one view; **r90 is the atlas mirrored** | all three       | finished art; the mirroring is a standing debt (§4) |

**Nothing else is drawn.** No cover piece on the three seeds lacks a binding. The dressing (lamps, signs,
drains, bollards, litter) is drawn by the architecture and street code, not as props.

## 2. The pale cabinet in seed 0 is the same prop, uncovered

The pale, flat-shaded box by the housing entrance in seed 0 is **not a different prop type**:

- It is the same binding as seed 7's painted steel cabinet: `housing_entry_mailboxes_cabinet`, art `mailboxes`,
  cluster `residential_entry`.
- Seed 0 saves it at **rotation 90**. Round one painted the cabinet at rotation 0 only (`streetPropArt.ts`
  `COVERAGE.mailboxes = [0]`), and art is never mirrored. So the rotated one falls back to the procedural kit:
  a 1.03 m box with light, flat door slabs.

**The fix is the same cabinet, painted turned.** Its doors face local −y, which is world +x at rotation 90,
toward the lower right of the image. Once that image is in, `COVERAGE.mailboxes` becomes `[0, 90]`, with its
own file at r90 like the sedan.

`current-cabinet-r90-seed0.png` is what seed 0 shows now. `cabinet-r90-placement-seed0.jpg` is the guide's
volume over it.

## 3. Vehicle repetition: paint, not new cars

No new car is needed. `courtyard/sedanPaint.ts` masks the existing sedan art's beige body paint and recolours
inside the mask; `tools/art/sedan-paint.ts` bakes the files. See `docs/checkpoint-prop-consistency.md` for
the method and evidence. Picasso is not needed for this.

## 4. What round two asks for, and what it does not

**Asked:**

1. **The merchandise stand (`shop-display`) at r0 and r90, three states each.** Six images. It is the only
   prop drawn procedurally on every variant, and the furthest below the cart's material quality.
2. **The cabinet at r90, three states.** Three images.

**Not asked, and why:**

- **The atlas props' mirrored r90.** The cart, crates, dumpster, generator and pallet are finished paintings.
  At r90 the board shows them reflected (`createCourtyard.ts`, `setFlipX`), which predates the
  never-mirror rule (4D.5). That rule was made for procedural furniture and the sedan, where a reflection
  breaks the footprint's registration. The atlas carries its own ground contacts per cell, so a reflection
  stays registered, but its painted light and any lettering are reversed. Painting an r90 of each would be
  five objects × three states. It is recorded as a debt, not part of this round: the reflection is not
  visibly wrong at play zoom on these five.
- **New car bodies.** Paint covers the repetition at a fraction of the cost (§3).

## 5. The images (9)

**Canvas and contract.**

- **Canvas:** 1024 × 1024, flat `#FF00FF` key, one object. The importer fits whatever size returns (Picasso
  returns 1254 × 1254).
- **Volumes:** from `streetPropPack.ts`, drawn in each guide. The object must fill its grey blocks and stay
  inside them.
- **Kiosk volume** (`KIOSK`, the procedural stand's own numbers, so the board's fading and sorting are
  unchanged):
  - 1.76 × 1.8 m;
  - a low front tier to 0.34 m (goods to 0.51 m) and a higher back tier to 0.65 m (goods to 0.83 m);
  - two rear posts to 1.27 m;
  - a flat sunshade at 1.245–1.31 m over the whole footprint;
  - **open side toward local −y:** the lower left of the image at r0, the lower right at r90.
- **Cabinet volume** (`CABINET`, round one's painted cabinet): 1.76 × 0.9 × 1.52 m. **Doors toward local
  −y**, the lower right of the image at r90.
- **Wrecks:** walkable remains. The kiosk stays under 0.45 m (`KIOSK.wreckedMax`) and the cabinet under 0.5 m,
  with flat debris at most 0.5 m past the footprint (`WRECK_APRON`).
- **Never** mirror an existing image to make the other rotation, and never paint ground, shadow, glow, lit
  lamps or readable text.

| File Picasso saves               | Attach                                                                                |
| -------------------------------- | ------------------------------------------------------------------------------------- |
| `street-kiosk-r0-intact.png`     | `guides/kiosk-r0-layout.png`, `reference-food-cart.png`, `current-kiosk-r0-seed7.png` |
| `street-kiosk-r0-damaged.png`    | the same, plus the accepted `street-kiosk-r0-intact.png`                              |
| `street-kiosk-r0-wrecked.png`    | the same, plus the accepted `street-kiosk-r0-intact.png`                              |
| `street-kiosk-r90-intact.png`    | `guides/kiosk-r90-layout.png`, `reference-food-cart.png`, the accepted r0 intact      |
| `street-kiosk-r90-damaged.png`   | the same, plus the accepted `street-kiosk-r90-intact.png`                             |
| `street-kiosk-r90-wrecked.png`   | the same, plus the accepted `street-kiosk-r90-intact.png`                             |
| `street-cabinet-r90-intact.png`  | `guides/cabinet-r90-layout.png`, the accepted `street-cabinet-intact.png` (round one) |
| `street-cabinet-r90-damaged.png` | the same, plus round one's `street-cabinet-damaged.png`                               |
| `street-cabinet-r90-wrecked.png` | the same, plus round one's `street-cabinet-wrecked-v2.png`                            |

Never attach `-annotated.png` (its text gets copied) or the `-placement-` proofs. The prompts are in
[`../art-style.md`](../art-style.md#street-props-round-two).

**Order.** Commission `street-kiosk-r0-intact.png` alone. Import it and check it in `/scene-review` seed 7 at
play zoom and close up, reveal on and off, with an actor behind it. Then do the rest. The r90 kiosk is the same
stand turned, so it is commissioned from the accepted r0. The cabinet r90 is round one's cabinet turned, so it
attaches round one's.

## 6. Import, when the images return (for Brutus)

1. **Sources.** Save the files under `src/assets/creator/` with the names above.
2. **The importer** (`tools/art/street-props.ts`):
   - iterate `STREET_PROP_PACK_2` beside `STREET_PROP_PACK`;
   - give `expected()` and `wreckVolume()` a `kiosk` case from `KIOSK` (`body`, `height`, `wreckedMax`);
   - give `cabinet-r90` the cabinet's;
   - write `shop-display-<state>[-90].webp` and `mailboxes-<state>-90.webp`.

   Its checks stay as they are: key and fringe, fit within ±25%, states within 3%, and wrecks inside their
   volume.

3. **The renderer** (`streetPropArt.ts`):
   - `COVERAGE.mailboxes = [0, 90]` and `COVERAGE["shop-display"] = [0, 90]`;
   - both with their own r90 file (the rule `own90` now covers them too, not only the sedan).
4. **Evidence.**
   - Seed 0 (cabinet r90, kiosk r90) and seed 7 (kiosk r0) at play zoom and close up.
   - `damage=mixed`, lights off, reveal on and off, and an actor behind each.
   - The placement proof again over the art.

## 7. Import results

`bun run tools/art/street-props.ts --round 2` (frames and proof sheet: `round-2/imported-frames.jpg`; wreck
checks: `wreck-guides/<id>-wreck-check.png`):

| Guide       | Fit for the 1024 guide | Height after the width fit | Intact/damaged drift | Wreck: moved, above volume, flat spill |
| ----------- | ---------------------- | -------------------------- | -------------------- | -------------------------------------- |
| cabinet-r90 | 1380 px                | 110%                       | 0.0%, 0.1%           | 0.37 m, 0.0%, 9.0%                     |
| kiosk-r0    | 1326 px                | 100%                       | 0.0%, 0.1%           | 0.29 m, **1.1%**, 12.1%                |
| kiosk-r90   | 1263 px                | 107%                       | 0.0%, 0.2%           | 0.50 m, 0.0%, 12.7%                    |

Every key passes, with fringe 0.000%.

**The r0 stand's wreck redraw.** The excess is the sunshade's far, upper-left edge, lifted off the heap. The
check is not loosened. `kiosk-r0` is on `TALL_WRECKS_PENDING`, so the wreck imports with its excess reported.
The edit prompt is in [`../art-style.md`](../art-style.md#street-props-round-two). Save the result as
`street-kiosk-r0-wrecked-v2.png`: the importer takes the newest version. Once it passes, take `kiosk-r0` off
the list.

## Files

- `guides/<id>-layout.png` (attach)
- `guides/<id>-annotated.png` (check by eye)
- `<id>-placement-seed<N>.jpg`: the guide's volume over the shipping renderer, neutral light
- `<id>-renderer-seed<N>.jpg`: the same frame without the overlay
- `reference-food-cart.png`: the material quality to match
- `current-<id>-seed<N>.png`: what each binding shows now
