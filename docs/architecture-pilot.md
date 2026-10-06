# Architectural art pilot: one rooftop unit, one window, one shutter

Status: **imported and placed; awaiting review.** The results, the one correction made to a returned image
and the critique are in [`checkpoint-architecture-art-pilot.md`](checkpoint-architecture-art-pilot.md). The goal is architectural art that sits
beside the painted cars and food cart (see the reference frame) without moving anything the scene
has saved. This pilot is three images. It stops for visual review before any wider rollout.

Not verified by this work, before or after: a real campaign fight in `/play`, and save/load.

## 1. What the pilot replaces (seed-7 intersection, visible at play zoom)

| Asset         | Replaces                                                                                                                                     | Where at play zoom                                                                     | Destination shot                                                          |
| ------------- | -------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| **Roof unit** | every plain rooftop box: a 2 × 2 m grey slab with a crosshair, on every shop-style roof except the storefront's own (which has painted fans) | the adjoining block's three units, front and centre; the annex's one; the rear block's | [destination-roof-unit.jpg](architecture-pilot/destination-roof-unit.jpg) |
| **Window**    | the generic shop bay: a flat teal rectangle, 2.2 × 1.7 m on the 3 m annex (`building_1`)                                                     | the annex across the street: two bays on its east face, one on its north               | [destination-frontage.jpg](architecture-pilot/destination-frontage.jpg)   |
| **Shutter**   | the generic shop door at a saved entrance: 1.6 × 2.2 m, flat slats and a coloured header strip                                               | the annex's entrance, between its two east bays                                        | same                                                                      |

**The window and the shutter share one frontage.** They sit in separate bays of the same face, and
each is the existing opening, so no new opening is invented. The adjoining block's own high barred
windows are left as they are.

**Gating.** The window and the shutter go on the annex only: the generic shop whose saved entrance
carries an entry surround (`isAnnex`, `building_1` on every intersection seed). The roof unit goes on
every plain rooftop box. Each one is the pilot's single representative. Wider use waits for review.

## 2. How each is drawn, and why

What the renderer does today, and what each asset becomes:

- **Rooftop box.** Today it is a prism with a crosshair, painted inside its building's sprite by
  `paintBuilding`. It is 2 × 2 m and 8 scene px tall (0.53 m at 15 px/m), at
  x = r.x + 0.5 + 3i, y = r.y + min(3, h − 2.5). Inside the building's sprite, it already sorts,
  fades and leaves with its roof when the building is cut away.
  **It becomes an isolated isometric sprite**, drawn into the same sprite at the same footprint, in
  place of the prism. Registration follows the street props: the 2 m diamond spans the frame's
  width, with its front corner on the bottom edge.
  - The frame is 256 × 200 frame px (the runtime file is twice that).
  - One orientation only: rooftop boxes are never rotated, and the camera is fixed.
  - The roof's contact shade (`paintRoofShade`) is the renderer's.
  - If the file is missing, the prism stays.
- **Bay and door.** Today they are flat code fills on the facade plane, through `paintBuilding`'s
  generic face. The cutaway pieces of an occluding building (the annex is one) are plain walls
  without them.
  **They become straight-on elevations**, mapped onto the wall plane by the projection's own affine
  transform.
  - Code keeps: the opening's size and place, the 12 cm recess (near jamb, head shadow), the
    projecting sill, the housing's top and depth, and the contact shadow.
  - The art supplies: glass, frame, gaskets and the dim room behind; or slats, rails and the
    housing's front.
  - The same routine paints them on each cutaway piece of the wall, clipped to that piece's
    height, so revealing the street never removes or floats an opening.
  - Missing art leaves today's fills.

**Never:**

- a whole facade flattened into one image;
- a resize to fit an image's opaque bounds;
- a mirrored view;
- a change to footprints, entrances, routes, cover, line of sight, sorting or the cutaway's
  geometry.

## 3. The three images

General rules:

- **Light:** all three are lit neutrally and diffusely. The renderer owns the night, local light,
  contact shadows and the cutaway.
- **File locations:** save each file to `src/assets/creator/`. The importer writes
  `public/images/architecture/`.
- **Guides:** never attach `-annotated.png`; it is for checking by eye.

### 3.1 `arch-roof-unit.png`: the rooftop unit

| Item          | Value                                                                                                                                                                   |
| ------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Canvas        | **1536 × 1024**, flat `#FF00FF` key around the object                                                                                                                   |
| Physical size | 2 × 2 m footprint, **0.53 m tall** (knee-high), the renderer's existing envelope                                                                                        |
| Projection    | true isometric, orthographic, the cars' view: the top and two sides; left side faces north (−y), right side faces east (+x)                                             |
| Registration  | fitted by the importer to the guide's block: width from the silhouette, the front corner on the roof; then drawn at the box's saved footprint                           |
| Orientations  | one                                                                                                                                                                     |
| Runtime       | `public/images/architecture/roof-unit.webp`, 512 × 400                                                                                                                  |
| Guides        | attach [`roof-unit-layout.png`](architecture-pilot/guides/roof-unit-layout.png) · review [`roof-unit-annotated.png`](architecture-pilot/guides/roof-unit-annotated.png) |
| Protected     | nothing outside the grey block; nothing taller than it; no roof, ground, shadow, glow or lamp                                                                           |

**Attach, in this order:**

1. `docs/architecture-pilot/guides/roof-unit-layout.png`
2. `src/assets/creator/street-sedan-r90-intact.png` (the painted finish to match)
3. the reference frame (mood only)

```text
Single game prop for an isometric tactical game, painted digitally with fine visible brush texture, in the grounded, lived-in late-1980s and 1990s neon-noir cyberpunk look of a matte painting, with the same painterly realism and material finish as the attached sedan. TRUE ISOMETRIC, orthographic, with no perspective: vertical edges stay exactly vertical and every horizontal edge runs at exactly 30 degrees, as in the attached layout. The attached layout is a measured guide, exactly 1536 x 1024 px: the grey block is the space the object fills, and its outline must match the block's outline and size exactly. Do NOT reproduce the guide's flat grey, pink, outlines or any text. Paint ONLY the object; everything else is one flat, solid #FF00FF magenta with no gradient, texture or noise, and no roof, ground, cast shadow or reflection under or around it. Light it softly and evenly from above, like an overcast day, with gentle form shading only; no glow, bloom, lights, light spill or night colour. Hard, clean silhouette edges with no halo into the magenta, and nothing magenta or pink on the object. No text, logos, stickers, people or watermarks. DO NOT let previous images influence this one. Subject: a low commercial rooftop air-handling unit, 2 m square and only knee-high, standing on a flat roof. A housing of folded galvanised sheet metal in faded grey-green paint, with crisp panel seams and small flush fasteners along them, and a raised lip around the top. A large circular fan recessed into the top under a round wire safety guard, its dark blades visible below the guard. Fine horizontal louvre grilles along the whole left face. On the right face, a removable service access panel with a recessed handle and a small blank data plate, and a short insulated pipe stub and conduit leaving it near the bottom. A low steel base rail along the foot. Restrained wear: dulled paint, light grime streaks below the seams, a little rust at the corners and fastener heads, two small dents. No oversized bolts, no exaggerated grime, no outlines.
```

### 3.2 `arch-annex-window.png`: the window

| Item          | Value                                                                                                                                                       |
| ------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Canvas        | **1536 × 1024**, no key: the opening fills the full height                                                                                                  |
| Used region   | the centred **2.2 : 1.7** rectangle (1325 × 1024 px); the strips either side are cut away                                                                   |
| Physical size | 2.2 m wide × 1.7 m tall opening; frame 7 cm, centre mullion 5 cm, glass set back 12 cm (the recess is code)                                                 |
| Projection    | straight-on elevation, orthographic                                                                                                                         |
| Registration  | the used region maps exactly onto the saved opening, on the wall plane at the recess depth                                                                  |
| Orientations  | one: the same elevation serves the north and the east face (each is mapped onto its own plane; nothing is mirrored)                                         |
| Runtime       | `public/images/architecture/annex-window.webp`, 1024 × 791 (the used region)                                                                                |
| Guides        | attach [`window-layout.png`](architecture-pilot/guides/window-layout.png) · review [`window-annotated.png`](architecture-pilot/guides/window-annotated.png) |
| Protected     | the frame stays inside the opening; no sill, ledge, recess, lintel or wall detail (code draws them); nothing lit                                            |

**Attach, in this order:**

1. `docs/architecture-pilot/guides/window-layout.png`
2. `src/assets/creator/storefront-window-interior.png` (the approved interior: same building, same hand)
3. the reference frame (mood only)

```text
Straight-on flat elevation of one shop window for an isometric tactical game, painted digitally with fine visible brush texture, in the grounded, lived-in late-1980s and 1990s neon-noir cyberpunk look of a matte painting, in exactly the painting style of the attached shop interior. Seen exactly face-on: orthographic, no perspective, no vanishing points, every frame edge perfectly horizontal or vertical. The attached layout is a measured guide, exactly 1536 x 1024 px. The central light-grey panel is the window opening, 2.2 m wide by 1.7 m tall, filling the full height of the image. Paint a dark-bronze anodised aluminium frame exactly where the guide's darker border and centre bar are (frame 7 cm, centre mullion 5 cm), with thin black rubber gaskets where the glass meets the frame, and two panes of slightly dusty, faintly tinted glass. Behind the glass, set well back, a dim, closed back office and storeroom of the same building as the attached interior: half-lowered metal venetian blinds in the left pane, filing cabinets, stacked cardboard boxes and a desk barely made out in the gloom, everything muted and unlit, with no lamps on. Restrained reflections: one soft, faint diagonal sheen across the glass, a little grime in the lower corners of each pane, a few dried drip marks. The dark strips left and right of the opening are cut away by the game: continue the frame and wall plainly there and put nothing important in them. Light softly and evenly, like an overcast day. Do NOT reproduce the guide's flat greys or text. No glow, bloom, light spill, night colour, people, text, signage, stickers or posters, and no sill, ledge, lintel, recess or wall surface outside the frame: the game draws those.
```

### 3.3 `arch-annex-shutter.png`: the shutter

| Item          | Value                                                                                                                                                                                   |
| ------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Canvas        | **1024 × 1536**, flat `#FF00FF` key outside the assembly                                                                                                                                |
| Used region   | the centred **1.84 : 2.5** rectangle (1024 × 1391 px)                                                                                                                                   |
| Physical size | opening 1.6 × 2.2 m; guide rails 8 cm either side; housing front 1.84 × 0.3 m above the head (0.12 m past each side); slats every 20 cm (the existing shutter's pitch); bottom bar 6 cm |
| Projection    | straight-on elevation, orthographic                                                                                                                                                     |
| Registration  | the used region maps onto the wall plane from 0.12 m before the opening to 0.12 m after it, ground to 2.5 m; the curtain's foot on the ground line                                      |
| Orientations  | one: mapped onto whichever face the saved entrance is on                                                                                                                                |
| Runtime       | `public/images/architecture/annex-shutter.webp`, 696 × 946 (the used region, keyed)                                                                                                     |
| Guides        | attach [`shutter-layout.png`](architecture-pilot/guides/shutter-layout.png) · review [`shutter-annotated.png`](architecture-pilot/guides/shutter-annotated.png)                         |
| Protected     | the opening's edges and the ground line; nothing outside the grey (the wall shows through); no door frame, surround, wall or pavement                                                   |

**Attach, in this order:**

1. `docs/architecture-pilot/guides/shutter-layout.png`
2. `src/assets/creator/shutter.png` (the approved slat material)
3. `src/assets/creator/storefront-shutter-wear.png` (the approved wear, for where it goes)
4. the reference frame (mood only)

```text
Straight-on flat elevation of a closed steel roller shutter for an isometric tactical game, painted digitally with fine visible brush texture, in the grounded, lived-in late-1980s and 1990s neon-noir cyberpunk look of a matte painting, matching the attached shutter slat material and following the attached wear pattern for where wear goes. Seen exactly face-on: orthographic, no perspective, every slat perfectly horizontal. The attached layout is a measured guide, exactly 1024 x 1536 px: paint ONLY inside its grey shapes and keep everything else one flat, solid #FF00FF magenta with no gradient or noise. Across the top: the front of the shutter's roller housing, 1.84 m wide by 0.3 m tall, a plain folded sheet-steel box face with a small drip edge along its bottom and two end caps. Down each side: a narrow steel guide rail, 8 cm wide, in which the curtain runs. Filling the opening between the rails, 1.6 m wide by 2.2 m tall: the curtain itself, horizontal interlocking galvanised steel slats every 20 cm in faded grey paint, and a heavier bottom bar with a central padlock hasp and a lifting handle, resting exactly on the guide's ground line. Wear concentrated where parts move or meet: bright scuffed metal along the slat ends where they ride in the rails, rust weeping from the rail fixings and along the bottom bar, the lowest 40 cm grimy and rust-blistered from splash, faint scrape marks down the rails. Light softly and evenly, like an overcast day. Do NOT reproduce the guide's flat greys, outlines or text. No shadows cast onto any wall, no light spill or glow, no graffiti, stickers or text, and no wall, door frame, surround, step or pavement: magenta everywhere outside the grey.
```

## 4. When the images return

Validate each image before integrating it. A geometric rule is never relaxed to let a returned image
pass: an exception is explained, with what it costs on screen.

1. **Projection and proportions.**
   - The roof unit is fitted to its block by silhouette width, and the height that falls out is
     checked (±15%).
   - The window's frame and mullion lie on the guide's bands (±2%).
   - The shutter's opening edges and ground line lie on the guide's (±1.5%).
2. **Key and light.**
   - At least 40% pure key on the roof unit. The shutter is held to its own guide (which is only 12%
     magenta): what the guide leaves magenta stays key, and what it paints grey is painted.
   - No magenta fringe after spill subtraction.
   - No baked gradient across a straight-on image: its uniform material agrees within 6/255 (the
     window's frame bars, the shutter's curtain halves and housing ends; a blind or rust asked for at
     the foot is content, not light).
3. **Play zoom.** The unit must read as equipment rather than a decorated cube. The frontage must
   gain depth without competing with the warm shop.
4. **Browser:**
   - roof on and reveal on, with characters;
   - neutral light, and night with lights off;
   - close-ups, and two more seeds (seed 0's annex has its door on the north face; seeds 1 and 8 put
     it at another position with bays only).
   - Pan, zoom, reveal, the lighting toggles and actors overlapping must all behave.
5. **Then a PR** with before/after evidence, stopping for review before any wider rollout.

Regenerate the guides and destination shots with
`bun run tools/art/architecture-pilot-guides.ts --port 5180`.
