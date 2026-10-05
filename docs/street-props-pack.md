# Street props — art pack for the seed-7 corner

Status: **imported.** All twelve images are in game; see
[`checkpoint-street-props.md`](checkpoint-street-props.md) for the evidence. The next visual step
after the storefront corner ([`checkpoint-storefront-finish.md`](checkpoint-storefront-finish.md))
is replacing the placeholder props beside it:

1. the sedan beside the shop;
2. the planter;
3. the steel cabinet.

These replace art only. Nothing here moves, resizes or re-materials a cover piece, and
nothing changes line of sight, damage, collision or saved scenes.

The numbers live in one place, `src/features/play/courtyard/streetPropPack.ts`.
`bun run tools/scenes/street-prop-guides.ts --port 5180` draws every guide and the
placement proof from it. `streetPropPack.test.ts` holds the numbers to the
renderer's own projection.

## 1. What the renderer does with a prop (inspected, not assumed)

| Fact               | Value                                                                                                                                                                                                               | Source                                       |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------- |
| Unit of art        | one **256 × 320 frame per saved 2 m × 2 m cover piece**                                                                                                                                                             | `PROP_CANVAS`, `interiorPropArt.ts`          |
| Projection         | true isometric. The 2 m footprint is the diamond spanning the full frame width, its front corner on the bottom edge. One metre across the ground is 64 px horizontally; one metre of height is 73.9 px straight up. | `interiorPropPoint`, `PROP_PIXELS_PER_METRE` |
| Registration       | the board places the frame by the footprint's front corner and width (`propPlacement`): origin bottom-centre, displayed width = the cover piece's projected width                                                   | `createCourtyard.ts` `paintCover`            |
| States             | `intact`, `damaged` (HP below max), `wrecked` (destroyed). Wrecked art is walkable remains, drawn at depth −500 under every unit, so it must be low.                                                                | `propCondition`, `propPlacement`             |
| Rotation           | 0 or 90. **Never mirrored**: a reflected texture breaks footprint registration (4D.5). Each rotation needs its own art unless the object is symmetric.                                                              | `AGENTS.md` 4D.5                             |
| Lighting           | the night ambient tints the prop sprite, and the light it stands in raises that tint (`lightAt`). Ground contact shadow is drawn by the renderer. **Art must carry no cast shadow, light spill or glow.**           | `nightLighting.ts`                           |
| Fading / occlusion | a prop fades to 40% while it hides a unit, judged from its opaque ink bounds, so stray pixels far from the object would widen its fade box                                                                          | `propInkBounds`, `sceneryOccludes`           |

The **sedan is two attackable sections**: engine (car x 0–2 m) and cabin (2–4 m). They
are separate cover pieces with independent HP, sorted separately, and they join at the
plane x = 2 at identical sill (0.28 m), bonnet (0.80 m) and roof (1.45 m) heights.

At rotation 90 (this car), the car runs along world +y with its front toward −y. The
engine section is nearer the camera and the board draws it in front. At rotation 0,
the car runs along +x and the cabin is nearer.

## 2. The benchmark props (intersection seed 7)

| Prop    | Saved cover piece(s)                                                           | Art binding                         | Rotation |
| ------- | ------------------------------------------------------------------------------ | ----------------------------------- | -------- |
| Sedan   | `curb_west_car_engine` (18, 6) and `curb_west_car_cabin` (18, 8), 2 × 2 m each | `sedan-engine`, `sedan-cabin`       | 90       |
| Planter | `housing_entry_south_box` (8, 8), concrete                                     | `planter` (shared by every planter) | 0        |
| Cabinet | `housing_entry_mailboxes_cabinet` (8, 2), steel                                | `mailboxes`                         | 0        |

**The cabinet.** The steel cabinet beside the corner, next to the housing lamp, is the
`mailboxes` binding. It is the only cabinet in this framing, so it is specified as a
steel street cabinet carrying a bank of small doors.

**The planter.** The planters behind the shop (`north-west-front_infill_*`) are hidden
by the building except in the cutaway. They use the same art.

`context-placement.jpg` is the **registration proof**: the shipping renderer, neutral
light, with each guide's volume drawn over it through the scene's own projection and
camera. The sedan's body, glasshouse and join, and the cabinet's box, land on the
placeholder art they replace. `context-renderer-only.jpg` is the same frame without
the overlay.

## 3. The pack

All images go on a **flat `#FF00FF` key**. The importer removes the key, so the object
needs no transparency of its own.

Square canvases are used because the image tool offers 1:1, 3:2 and 2:3. The sedan is
painted **whole**, one image per rotation and state. The importer cuts it into its two
sections, so the halves always match at the join (§4).

| Guide       | File Picasso saves             | Canvas      | Ground scale | Volume                                                   |
| ----------- | ------------------------------ | ----------- | ------------ | -------------------------------------------------------- |
| `sedan-r90` | `street-sedan-r90-{state}.png` | 1536 × 1536 | 234 px/m     | car 3.74 × 1.6 m, roof 1.45 m, in two 2 m sections       |
| `sedan-r0`  | `street-sedan-r0-{state}.png`  | 1536 × 1536 | 234 px/m     | the same car along the other axis                        |
| `planter`   | `street-planter-{state}.png`   | 1024 × 1024 | 237 px/m     | 1.76 m square concrete box, rim 0.64 m, foliage ≤ 1.25 m |
| `cabinet`   | `street-cabinet-{state}.png`   | 1024 × 1024 | 218 px/m     | 1.76 × 0.9 × 1.52 m steel, doors toward −y (the street)  |

`{state}` is `intact`, `damaged` or `wrecked`. Runtime frames are 512 × 640 (sedans 640 × 704, padded; §4), twice
the old 256 × 320, because the corner is now read at up to 6× zoom.

**Attach, for each image:**

- the guide `docs/street-props-pack/guides/<id>-layout.png`;
- the reference frame you have been matching;
- for the sedan's damaged and wrecked states, the accepted intact image of the same
  rotation, so the car stays the same car.

Never attach `-annotated.png` (its text gets copied) or `-cut.png` (it is for the
importer).

**Protected:**

- Nothing outside the grey volumes in the layout: the key stays pure.
- No ground, kerb, shadow or puddle under the object; the renderer draws contact shade.
- No lit lamps, headlights, screens or glow.
- No text or logos.

## 4. How a returned image becomes game art

`bun run tools/art/street-props.ts` (add `--check` to validate without writing) does it, from
`src/assets/creator/street-<id>-<state>.png` to `public/images/street-props/<art>-<state>[-90].webp`.

1. **Key out** the magenta (spill subtraction, as the shutter wear) and validate: at least 45% pure key,
   magenta fringe at most 0.15% after spill subtraction.
2. **Fit, not assume.** Picasso returns 1254 × 1254 whatever canvas is asked for, so the image is fitted to
   its guide: one uniform scale from the silhouette's width against the guide volume's projected width,
   aligned on its left extreme and lowest point. The height that falls out is checked against the guide's
   (±25%). Damaged and wrecked reuse the intact fit, so the object never jumps between states; their
   silhouette must not drift more than 3% from the intact one, wrecked excepted.
3. **Cut the sedan** by `sedanCut`.
   - **The halves.** The engine half is the bonnet and front body up to the join. The cabin half is the rear
     body, **the whole glasshouse** (windscreen included) and the aerial on the rear wing. So no mix of
     states leaves a roof stub, a standing windscreen or a stray aerial.
   - **Overlap at r90.** At rotation 90 the engine's 2 m box overlaps the windscreen's foot on screen, so the
     glass is cut out of the engine's shape (`nearerHole`).
   - **Soft edge.** The nearer section keeps its half with a soft edge. The farther gives up only what lies
     wholly inside that half, so it stays solid under the nearer one's soft edge. Complementary soft masks
     never add up to solid when one is drawn over the other: they left a faint line of whatever was behind
     the car along the cut, which was the r0 seam visible even with both halves intact.
4. **Resample each section's art** (`sectionArtOnGuide`) at sub-pixel precision.
   - **Why sub-pixel.** The board places the two sections 147.8 frame pixels apart at rotation 0, a
     fraction. Cropping at rounded pixel bounds put the halves up to half a source pixel out of register.
   - **The sampler.** Separable Lanczos-3, on premultiplied colour.
   - **Padding.** A sedan's art is padded past its 2 m frame (`SEDAN_ART_PAD`: 32 px each side and on top),
     so each half fits whole: at r0 the cabin's windscreen reaches 18 px left of its frame. Files are
     640 × 704 for sedans and 512 × 640 for the rest.
   - **Registration.** The board reads the frame's place in the art from the texture's registration
     (`propArtRegistration`), so the footprint, sorting and damage are unchanged.
   - **The seam check.** The importer lays the two intact halves over each other exactly as the board does.
     It fails if anything inside the car is left see-through. The old mask fails it (175 and 388 px); the
     cut passes (0).
5. **In game**, `streetPropArt.ts` loads the files and replaces `prop-<kind>-<condition>[-90]` with them, with
   the procedural kit's own contact shadow drawn underneath. A missing file leaves the procedural texture.
   The sedan has its own files for each rotation; the planter's one file serves both; the cabinet has art at
   rotation 0 only, so a rotated cabinet keeps the procedural kit.

`imported-frames.jpg` is the proof sheet of every runtime frame; `mixed-sections.jpg` composes the sedan's
sections in mixed states exactly as the board offsets them.

## 5. Order: validate one orientation in-game first

In the event, all twelve arrived together and were validated together; the order below stays the advice
for the next pack.

1. **Commission `street-sedan-r90-intact.png` only.** Import it and check it in
   `/scene-review` at the corner framing
   (`place=intersection&seed=7&actors=1&cam=-10,115,2.2`):
   - reveal on and off;
   - an actor beside and behind it (fading);
   - `damage=damaged` and `damage=destroyed`: those states still use the procedural kit
     until their images exist, which shows the section join against the fallback.

   Check its outline against the guide volume. Check its colour under the night
   ambient and in the lamp pool.

2. **Only if that holds, commission the rest:**
   - r90 damaged and wrecked;
   - r0 in all three states;
   - the planter and the cabinet in all three states.

   If it does not hold, change the prompt or the guide, not the import.

## 6. Prompts

They are in [`art-style.md`](art-style.md#street-props-combat-scenes), with a wrapper
and one subject per image.

## 7. Lower wrecks

The importer checks every wrecked image against its volume (`wreckVolume`):

- the body, splayed 8 cm, up to its state's limit: sedan 0.55 m, planter 0.35 m, cabinet 0.5 m;
- plus a debris layer 12 cm thick over its own 2 m ground.

Wrecked remains are walkable and drawn under every person, so anything taller reads as cover
that is not there, and is drawn under a person standing behind it. A single image can only be
judged by its silhouette: the remains must sit inside the screen shape of that volume.

**The gate is height.** A wreck fails when more than 1% of it stands above its volume. Flat
debris lying up to 0.5 m past the prop's own ground (`WRECK_APRON`) is allowed and reported as
"spill": it is drawn under every person and clipped at its frame, so it hides nothing.

**Placement.** A redraw may sit a little off where the intact object stood. The importer moves a
wreck that fails where it stands onto its footprint by translation alone, never scaling it, by at
most 0.5 m, and reports the move. A wreck that already passes is left where it is.

**Versions.** A redraw is saved beside the image it replaces as `<name>-v2.png`, then `-v3` and so
on. The importer takes the newest, and the older files stay in the folder as history.

| Wreck     | Before the edit | After (v2)        | Placed       | Spill past its ground    |
| --------- | --------------- | ----------------- | ------------ | ------------------------ |
| sedan r90 | 0.0%            | n/a (not redrawn) | as drawn     | 0.0%                     |
| sedan r0  | 0.0%            | n/a (not redrawn) | as drawn     | 0.0%                     |
| planter   | 27.5%           | **0.0%**          | moved 0.03 m | 2.7%                     |
| cabinet   | 32.5%           | **0.0%**          | moved 0.39 m | 11.3% (doors flung flat) |

All four pass, and `TALL_WRECKS_PENDING` is empty: a wreck that stands too tall now fails the
import.

**The redraws were edits** of the earlier images, so the object and its materials stayed the same.
The guides are written by the importer to `wreck-guides/<id>-wreck-layout.png`, on the returned
images' own 1254 × 1254 canvas, at the place the intact object stands:

- the dark block is the most the remains may occupy, and its top face is the ceiling;
- the pale slab is the ground, where only flat debris may lie.

`<id>-wreck-check.png` shows the current wreck in place, too tall in red and spill in amber (never
attach). The prompts are in [`art-style.md`](art-style.md#lower-wrecks-edits).

**Characters and the remains** (browser, `docs/evidence/wrecks-and-tiles/`):

- A character standing on rubble or a shell is drawn over it and reads as standing in the remains.
- In front of a wreck, nothing changes.
- Behind the old planter's and cabinet's heaps, a character was drawn over rubble that should
  have hidden their feet. The v2 remains are low enough that a character behind them reads as
  standing beyond flat rubble.

## Files

- `src/features/play/courtyard/streetPropPack.ts`, `__tests__/streetPropPack.test.ts`
- `tools/scenes/street-prop-guides.ts`
- `tools/art/street-props.ts` (importer), `src/features/play/courtyard/streetPropArt.ts` (renderer),
  `__tests__/streetPropArt.test.ts`
- `public/images/street-props/` (runtime frames)
- `docs/street-props-pack/imported-frames.jpg`, `mixed-sections.jpg`
- `docs/street-props-pack/wreck-guides/` (wreck layouts to attach, check sheets)
- `docs/street-props-pack/guides/`:
  - `<id>-layout.png` (attach)
  - `<id>-annotated.png` (check by eye)
  - `sedan-r*-cut.png` (importer)
- `docs/street-props-pack/context-placement.jpg`, `context-renderer-only.jpg`
