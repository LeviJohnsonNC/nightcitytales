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

`{state}` is `intact`, `damaged` or `wrecked`. Runtime frames will be 512 × 640, twice
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
3. **Cut the sedan** by `sedanCut`. The engine half is the bonnet and front body up to the join; the cabin half
   is the rear body **and the whole glasshouse**, windscreen included, so no mix of states leaves a roof stub.
   The nearer section keeps its half, clipped to its own frame; the farther keeps everything else, so the
   halves always add up to the whole car.
4. **Crop each section's frame** (`sectionFrameOnGuide`) and scale to 512 × 640 (lanczos3).
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

## Files

- `src/features/play/courtyard/streetPropPack.ts`, `__tests__/streetPropPack.test.ts`
- `tools/scenes/street-prop-guides.ts`
- `tools/art/street-props.ts` (importer), `src/features/play/courtyard/streetPropArt.ts` (renderer),
  `__tests__/streetPropArt.test.ts`
- `public/images/street-props/` (runtime frames)
- `docs/street-props-pack/imported-frames.jpg`, `mixed-sections.jpg`
- `docs/street-props-pack/guides/`:
  - `<id>-layout.png` (attach)
  - `<id>-annotated.png` (check by eye)
  - `sedan-r*-cut.png` (importer)
- `docs/street-props-pack/context-placement.jpg`, `context-renderer-only.jpg`
