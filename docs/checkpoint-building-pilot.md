# Checkpoint: presentation fixes and the homes-and-sheds pilot

**Scope.**

- Two presentation questions left by [the tactical presentation](checkpoint-presentation.md).
- A completion pilot for the intersection's residential block and industrial sheds, made with code and the
  materials already in the pack.
- No new artwork, no new lighting and no street clutter.

**Unchanged:**

- movement, targeting, cover, line of sight and damage;
- hit areas;
- walls, entrances, routes and activity groups;
- saved geometry and state;
- sorting, fading and cutaway attachment;
- every non-intersection environment.

**Not verified:** a real `/play` fight and save/load, which need a Supabase session. Everything here was driven
in `/scene-review`, which runs the same board and renderer.

## 1. The dashes across the cutaway

**What drew them.**

- They were the board's own outline: a dashed polygon round the 32 m board, drawn over the scenic art
  (`CombatBoard`, scenic scenes only).
- It is an overlay, so it was printed over everything. Where the board's edge crossed the large shop it ran across
  the hatched footprint and on over the roof, and read as a lane marking inside a building.
- It was drawn in scene units, so its dashes also grew with the zoom.
- It is not road paint showing through, and not rain. Last time this was put down to rain; that was wrong: the
  rain's streaks are near-vertical and these ran along the board's edge.

**Its purpose** is to show where the fight's ground ends, which is worth keeping on open ground.

**The fix.** `boardOutline` (`overlayModel.ts`) samples the four sides every 10 cm and leaves out every stretch:

- inside a building's footprint;
- or behind one as the camera sees it (`buildingHidesGround`, the reveal's own occlusion test).

A building cut away for the reveal hides only its own footprint; fences and interior walls hide nothing. The
line is now one screen pixel at every zoom.

**Evidence** (`docs/evidence/presentation-2/desktop/`): `compare-idle-reveal.jpg`, `compare-idle-roof-on.jpg`
and `compare-target-blocked.jpg`, each with the same camera on `main` (left) and this branch (right).

- The footprint is clean, opaque and hatched.
- The roof is clean.
- The outline still runs on the open pavement.
- The footprint's colour is unchanged.

## 2. The board on a phone

Driven at 390 × 844 with touch alone (`tools/scenes/narrow-touch.mjs`; no hover, no keyboard):

- tap a target;
- tap another;
- dismiss;
- tap the ground to preview a move;
- zoom in, zoom out and reset.

Each step is measured and recorded in `narrow/{before,after}/results.json`, with the captures beside them.

| Step                  | `main`                                        | This branch                                                       |
| --------------------- | --------------------------------------------- | ----------------------------------------------------------------- |
| Tap the rifleman      | card over the place caption                   | card over the place caption: the only place clear of every person |
| Switch to the lookout | **card across the lookout's body**            | card under the lookout's feet, clear of him and his name          |
| Dismiss               | **no way to, without the dock's Move button** | a round × on the card (touch only), one level back, like Escape   |
| Preview a move        | **card over the rifleman**                    | card under the destination, over the bottom hint line             |
| Zoom, zoom, reset     | card follows; no errors                       | card follows; no errors                                           |
| Tap just beside card  | reaches the board                             | reaches the board                                                 |

- **Placement.** The card is placed by `placeCallout` (`calloutPlacement.ts`), in this order:
  - above the person or square;
  - else under their feet;
  - else beside them.

  It may never cover the camera buttons. It covers a person, a name label, "IN THE WAY" or the place caption
  only when every place would, and then the fewest.

- **Before,** "no room above" hung it a fixed 56 px under the head anchor, which is across the body on a phone.
  "Room" was a fixed 56 px band that missed the caption.
- **Width.** On a phone the card is at most 220 px wide, so a long reason wraps cleanly and the card fits beside
  people more often. Nothing was clipped in any step (`textClipped: false`).
- **Dismissal.** The × is shown only where there is no hover (`(hover: none), (pointer: coarse)`). A desktop has
  Escape and right-click and looks as before.
- **The card's anchor** is 6 px higher than before. It had sat 1 px inside its own target's name label, which made
  every place "above" count as covering someone.
- **Outside its bounds** the card takes no input (`2b-beside-card: board`).
- **Desktop.** The desktop captures (`desktop/compare-*.jpg`) are stable.
  - "NO SHOT" wraps to two lines (its 300 px cap).
  - "MOVE HERE" steps off the player instead of covering him.

**Remaining.** The phone's board is small. When the target stands at the top, the card's only person-free place
is over the place caption, and a move preview near the bottom covers the hint line. Both repeat what the panel
under the board says.

## 3. The audit (seeds 7, 0 and 8)

`tools/scenes/building-audit.mjs`, at the play framing and the overview, at night and neutral:

- **Materials were applied to shops only.** `paintBuilding` laid materials on `shop` masses alone. The
  residential block and every workshop and warehouse were flat fills; so were their cutaway pieces and roofs.
- **The residential block** (9-10 m):
  - Broad flat walls.
  - Upper windows were flat navy rectangles with one mullion line: no frame, reveal or sill, and an identical
    grid. The "lit" ones were flat tan.
  - Its ground-floor bays had shop-like cream lintels.
- **The sheds** (2.5-3 m):
  - The ground-floor "lights" were horizontal slats and read as vents.
  - The clerestory was a thin dark slot.
  - Clerestory and lights overlapped where both fell (hidden by the flat fill).
  - The loading door's saved service surround was drawn as cream posts and a cream slab.
  - No fascia and no plinth.
- **Uses.** The same window code served homes and offices; nothing told a flat from a shop or a shed.

## 4. The pilot (`courtyard/buildingFaces.ts`)

One representative of each use, on every intersection that has materials:

- **Residential.** `painted-render` on the walls, toned to their old colour.
  - A rendered plinth, faint floor lines and a coping.
  - Each window is the same 1.4 × 1.2 m opening at the same place. It has:
    - a 12 cm reveal with its near jamb and the head's shade;
    - a painted timber frame and mullion;
    - a projecting stone sill with its drip shadow;
    - restrained glass.
  - Behind it somebody lives: a blind let down a varying way, curtains in one of five muted cloths, nets, a lamp
    between curtains, or nothing. It is chosen from the window alone, so the street is the same every time.
  - A ground-floor bay is the same 2.2 m opening with a transom and is never dark at the street.
  - Nothing is the shop's stocked interior.
- **Industrial.** `painted-metal` cladding in sheets a little over a metre wide, on a concrete plinth, under a
  dark fascia with its drip.
  - Every light and clerestory is steel-framed wired glass in divided lights (6 × 2 and 4 × 1) with a
    pressed-metal sill.
  - One pane in a few is sheeted over or hinged open.
  - A clerestory pane that ran into a light or a loading door is dropped; nothing else moves.
  - The loading door is a roller shutter (the `shutter` material) in steel guides. The saved service surround over
    it is drawn as those guides, with worn impact paint at their feet, and as the shutter's coil box. Its saved
    span, height and projection are unchanged.
- **Gated like the materials.** Intersection scenes only. A missing tile is the old drawing (tested).

**Picasso.** No images are needed for this pilot. Code and the existing materials supplied frame, reveal, sill,
glazing, cladding and the door convincingly at play zoom. A painted residential window would add only the room
behind the glass, which a blind or curtain hides at that size anyway. Revisit only if close-up play becomes
common.

## 5. Evidence (`docs/evidence/building-pilot/`)

`after/` is this branch. `compare-*.jpg` set each shot beside `main` at the same camera; the full-size `main`
captures were not kept, as they are inside the comparisons.

- **Seed 7 at play zoom:** `seed7-play`, `seed7-play-neutral`.
- **Roof-on and reveal with characters:** `seed7-play` (roof on) and `seed7-play-reveal`, at night and neutral.
- **Seeds 0 and 8:** `seed0-*`, `seed8-*`, at the play framing and the overview.
- **Close-ups:** `residential-close`, `residential-window`, `industrial-close`, `industrial-door` and
  `loading-close`, neutral and night.

## 6. Screenshot observations (not tested behaviour)

At play zoom, before close-ups:

- **The residential block reads as homes.** Light frames, sills, and blinds or curtains in each window, where it
  was a grid of navy slots.
- **The sheds read as industrial.** Pale, divided glazing under a dark fascia, where the slatted bays read as
  vents. The loading door reads as a door in its frame.
- **The shop stays the focal point.** It keeps the only warm, lit frontage. The homes are quieter than it; the
  sheds cooler.
- **At night** the render is darker and cooler than the old flat beige. The block is less warm than before, but
  it sits with the shop's neighbours rather than glowing. No window is lit: there is no new light in this pass.
- **Close up:**
  - The jambs and sills give real depth.
  - The blinds vary in drop, the curtains in cloth and width.
  - The wired glass is pale and opaque.
  - The coil box sits under the roof with its guides.
- **The reveal's cutaway pieces** of the residential block take its render.

## 7. Checks

- `bun run lint` (no errors; the 12 warnings were already there), `bun run typecheck`, `bun run test`
  (3975), `bun run build`, `bun run test:browser` (28, including the WCAG scan of `/scene-review`).
- New tests:
  - `buildingFaces.test.ts`: uses, unchanged positions and sizes, varied occupancy, no furnishings on a shed, no
    double glazing.
  - `calloutPlacement.test.ts`: above, below, beside, measured controls, people.
  - `boardOutline` in `actorMarkers.test.ts`: open ground, footprint, behind, cut away, fence.
  - `surfaceMaterials.test.ts` now expects homes and sheds to take materials, and every one of them to be its old
    drawing without tiles.
- **Interaction runs:**
  - `architecture-interaction.mjs`: 0 page errors live and in the missing-art fallback.
  - `narrow-touch.mjs` and `building-audit.mjs`: 0 page errors.
- **Not tested:** a real `/play` fight and save/load.

**Remaining limits.**

- **Residential roofs** keep their old warm colour, now with the membrane's grain. A parapet like the shop's is a
  next step if wanted.
- **The lamp-lit windows** are a warm room behind curtains in the albedo, as the old "lit" windows were. Giving
  them night light would be new lighting, which this pass does not add.
- **The shed lights** are 2.2 m wide, as saved. On the 2.5 m shed they reach almost to the fascia, which is what
  that building is.
