# Checkpoint: finishing the props, and the shop's block as an architectural pilot

**Scope:** two stages on the seed-7 corner.

1. Finish the street-prop integration:
   - the r0 sedan seam;
   - mixed damage states;
   - lower-wreck guides.
2. Detail the corner shop, its adjoining block and the street in front of it as built things.

**Unchanged:**

- saved geometry, walls, entrances, activity groups and routes;
- cover, targeting and damage;
- every environment except intersections.

## Stage 1: the props

### The r0 seam, located

Compared stage by stage: the source image, the imported frames, the reconstruction and the browser.

| Stage                                 | Finding                                                                                                                                                                                                                                              |
| ------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Source `street-sedan-r0-intact.png`   | Clean: the windscreen is one continuous wedge.                                                                                                                                                                                                       |
| Imported frames, laid over each other | A faint line of whatever is behind the car runs along the cut, down the windscreen. The two halves took complementary soft masks (engine × (1 − m), cabin × m). Drawn one over the other, these never add up to solid: at m = ½ only 75% is covered. |
| Imported frames, registration         | Each frame was cut at rounded pixel bounds. The board places the cabin 147.8 frame pixels below the engine, a fraction, so the halves were up to half a source pixel out of register.                                                                |
| Browser, `main`                       | The line shows as a pale streak through the windscreen (`compare-r0-sedans-seed-0.jpg`).                                                                                                                                                             |
| Earlier proof sheet                   | Overstated the seam: it placed the cabin at a rounded 148 px, not the board's 147.8.                                                                                                                                                                 |

**Fixed at its cause** (`tools/art/street-props.ts`):

- **Sub-pixel sampling.** Each section's art is sampled with separable Lanczos-3, on premultiplied colour.
- **One soft edge, not two.** The nearer section keeps its half with a soft edge. The farther gives up only what
  lies wholly inside that half, so it stays solid under the soft edge.
- **A seam check.** The importer lays the two intact halves over each other exactly as the board does, and fails
  if anything inside the car is left see-through. The old mask fails it (r90 388 px, r0 175 px); the fix passes
  (0 and 0).
- **Exact proof sheets.** `imported-frames.jpg` and `mixed-sections.jpg` are now built by the importer at the
  board's exact fractional offsets.

### Mixed damage states

The fixed cut exposed four ownership faults, each now corrected in `sedanCut` / padding:

- **Windscreen fragment (r0).** At r0 the cabin's windscreen reaches 18 px past its 2 m frame. A cabin drawn
  inside its frame alone left that piece on the engine, so a wrecked engine kept an intact windscreen fragment.
  Fix: the sedan's art is padded 32 px each side and on top (`SEDAN_ART_PAD`). The board reads the frame's place
  in the art from the texture's registration (`propArtRegistration`). The footprint, sort depth and targeting are
  unchanged.
- **Aerial (r0).** The aerial stands on the rear wing, above both outlines, so the intact engine kept it over a
  wrecked cabin. Fix: it now belongs to the cabin.
- **Strip at the frame edge.** The 2 px band that keeps the farther section solid also ran along its frame edge,
  which left a sliver there. Fix: it no longer runs along frame edges.
- **Windscreen standing on the engine (r90).** At r90 the engine's 2 m box overlaps the windscreen's foot on
  screen, so an intact windscreen stood on the engine over a wrecked cabin. Fix: the glass is cut out of the
  engine's shape (`nearerHole`).

[`mixed-sections.jpg`](street-props-pack/mixed-sections.jpg) shows all eight combinations clean. Registration
in the browser matches `main`: the only differences are a sub-pixel band along the cars' outlines, from the
new resampler.

### Lower wrecks

The importer now measures each wreck against its volume (`wreckVolume`): the body up to its limit, plus a
12 cm debris layer over its own ground. It writes a redraw guide and a check sheet for each one.

| Wreck   | Above its volume | Verdict                     |
| ------- | ---------------- | --------------------------- |
| Sedans  | 0.0%             | pass, not redrawn           |
| Planter | 27.5%            | edit prompt and guide ready |
| Cabinet | 32.5%            | edit prompt and guide ready |

- **The guides** are drawn on the canvas Picasso returns (1254 px), at the intact object's place, so a
  corrected wreck lands where the intact object stood.
- **The prompts** are edits: the existing art is broken down further, never squashed.
- **The gate.** Until the redraws arrive, the planter and cabinet are waived on a named list. After that, a tall
  wreck fails the import.
- **Details:** [`street-props-pack.md` §7](street-props-pack.md#7-lower-wrecks).

## Stage 2: the shop's block

`courtyard/frontage.ts`, driven once per storefront by `frontagePilot`. The plan it works from is drawn over
the renderer by `tools/scenes/corner-plan.ts`.

**The block** is the shop (`building_0`) and the two commercial masses flush against it (`_middle`, `_rear`).
At play zoom the shop shows its first 8 m of face; the adjoining block stands in front of the rest.

**The shop**, still the warm, lit focal point:

- a rendered plinth on its solid wall;
- a pre-cast cill under each bay, with its drip shadow;
- a meter box with conduit on the wall between door and first bay;
- a downpipe on the pier between its two bays, with scupper, hopper, brackets and shoe;
- a concrete coping round its roof, jointed, with the inner face the camera sees on its far sides;
- a roof outlet a metre back from the scupper.

**Its neighbours, restrained:**

- dark painted render;
- high barred windows of reeded glass, with no light behind them;
- one louvre, sooted above;
- a taller plinth;
- their own downpipes;
- a narrow pressed-metal cap;
- a ballasted roof without membrane seams.

No door is painted where no entrance is saved, and no sign or light.

**The street:**

- **Kerbs.** Every pavement edge that meets carriageway is a run of 1 m kerb stones, each its own tone, in the
  scene's concrete. Its face shows only where the road lies toward the camera.
- **Drainage.** A jointed concrete channel runs on the road side to the saved gullies. Each gully is set in the
  channel, turned along the kerb, with a kerb inlet and the damp it gathers.
- **Crossings.** Dropped kerbs with tactile paving where crossings meet the pavement.
- **Wear, where use puts it:**
  - grime at wall feet and in internal corners;
  - a damp fan at each pipe's shoe;
  - a threshold polished by feet at the shop door;
  - grease under the vendor's cart.

No noise layer was added.

**Reused materials:**

- `facade-concrete` for the coping and kerbs;
- `painted-metal` for the neighbours' cap;
- the membrane graded darker for their roof.

**New art, only what code cannot give:** two tiles, `roof-ballast` and `painted-render`, to make the neighbours
a different building. The guides are exported and the prompts written; nothing is commissioned
([`architecture-pack.md`](architecture-pack.md)).

## Evidence (unedited browser captures, `docs/evidence/architecture-pilot/`)

Before is `main` at the merge of the street props; after is this branch. Every pair uses the same URL and camera.
Each `compare-*.jpg` sets them side by side.

| View                                                | Compare                                                                                                                                                                                                                               |
| --------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Play zoom, night, reveal off / on (with characters) | [off](evidence/architecture-pilot/compare-play-night.jpg) · [on](evidence/architecture-pilot/compare-play-night-reveal.jpg) · [characters, off](evidence/architecture-pilot/compare-play-night-actors.jpg)                            |
| Play zoom, neutral light, reveal off / on           | [off](evidence/architecture-pilot/compare-play-neutral.jpg) · [on](evidence/architecture-pilot/compare-play-neutral-reveal.jpg)                                                                                                       |
| Play zoom, lights off                               | [compare](evidence/architecture-pilot/compare-play-lights-off.jpg)                                                                                                                                                                    |
| The shop up close, night / neutral                  | [night](evidence/architecture-pilot/compare-shop-close-night.jpg) · [neutral](evidence/architecture-pilot/compare-shop-close-neutral.jpg)                                                                                             |
| The adjoining block, neutral / night                | [neutral](evidence/architecture-pilot/compare-block-neutral.jpg) · [night](evidence/architecture-pilot/compare-block-night.jpg)                                                                                                       |
| Kerbs, channel and crossing up close                | [compare](evidence/architecture-pilot/compare-crossing-neutral.jpg)                                                                                                                                                                   |
| Other seeds: 1, 4, 8 (night), 8 (neutral)           | [1](evidence/architecture-pilot/compare-seed-1.jpg) · [4](evidence/architecture-pilot/compare-seed-4.jpg) · [8](evidence/architecture-pilot/compare-seed-8.jpg) · [8 neutral](evidence/architecture-pilot/compare-seed-8-neutral.jpg) |
| The r0 sedans (seed 0)                              | [compare](evidence/architecture-pilot/compare-r0-sedans-seed-0.jpg)                                                                                                                                                                   |
| What the two tiles would cover                      | [context-targets.jpg](architecture-pack/context-targets.jpg)                                                                                                                                                                          |

## Screenshot observations (what the captures show, not tested behaviour)

- **Play zoom, reveal off.**
  - The roofs, which fill half the frame, now read as built: each has a coping and, on its far sides, the
    parapet's inner face.
  - The shop stays the warm, lit focal point. Its signs, window and forecourt light are unchanged.
  - The kerbs define the pavement edges, and the tactile pads mark the crossings without pulling focus at night.
- **Reveal on.** The shop opens as before, and its cut pieces keep their face detail. The neighbours keep their
  copings.
- **Up close.**
  - The downpipe runs from its hopper at the parapet, over the fascia, to a shoe and a damp fan on the pavement.
  - The cill sits under the bay. The meter box is in the awning's shade and reads only up close.
- **The adjoining block** has its own character on its faces: dark render, barred high windows, a louvre and its
  own pipe, with the warmth left to the shop.
- **Other seeds.** The same rules find each storefront's block (seeds 1 and 8) and leave residential and
  workshop masses alone (seed 4). Kerbs run through every intersection.
- **The r0 sedans** on `main` show the pale streak through the windscreen; this branch's do not.

## Interaction tests (driven in the browser, results as observed)

`/scene-review` at the corner framing, run against this branch:

- **Reveal toggle, Lights and Night checkboxes:** each changed the frame, and Lights and Night switched with no
  remount.
- **Camera:** zoom in, zoom out, pan by drag and reset each changed the frame.
- **Target selection:** the 6th Street rifleman reads "NO LINE OF SIGHT", the same as `main`.
- **Diagram view** toggles without error.
- **Files:** all 18 street-prop files loaded with status 200.
- **No page errors** in any of the 32 evidence captures or the interaction run.
  - Two earlier captures reported a page error named "Event" while Vite was hot-reloading a file I had just
    edited. Neither reproduced on reload.
- **Pixel regression against `main`** with no characters: alley 5, office 4, residential 4, garage 33,
  nightclub 7 and warehouse 5 are pixel-identical.
- **Unit tests:**
  - `frontage.test.ts`: the block, the open spans, one pipe per roof clear of every opening across seeds 0–40,
    no neighbour door, kerbs only on pavement edges that meet carriageway, dropped kerbs at every crossing.
  - `streetPropArt.test.ts`: padded art sizes and registration, the glass and aerial ownership, the wreck volume.

**Not tested:** a real campaign fight in `/play` (it needs a Supabase session), and save/load. Both remain
unverified until exercised.

## Honest critique

- **Still code-drawn.** The pilot is drawn in code. At play zoom it is more architectural, but its pieces (pipe,
  meter box, louvre) are clean vector shapes beside painted props.
- **The neighbours are dark and quiet.** In seed 8 the neighbour's long face reads close to blank. The render tile
  is what would give it surface.
- **The tactile pads are L-shaped** where two crossings meet a corner, which is how such a corner is paved. They are
  the brightest new thing at neutral light.
- **The kerb and channel are flat paint.** The pavement is still drawn at ground level, so a kerb face is a band
  below its edge, not a real step. It reads at play zoom, but not as depth when the camera pans.
- **The wrecks** for the planter and cabinet still stand too tall until their edits arrive.
