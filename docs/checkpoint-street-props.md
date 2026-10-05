# Checkpoint: the street props

**Scope:** the twelve images of the [street-prop pack](street-props-pack.md), imported and drawn in place
of the placeholder sedan, planter and steel cabinet on intersection scenes.

- **Unchanged:** geometry, cover, targeting, damage, saved scenes and every other environment.
- **The board does the work:** registration, sorting, fading and damage are its own.

## What changed

- **`tools/art/street-props.ts`** validates and imports `src/assets/creator/street-*.png`:
  - It keys out the magenta and fits each image to its guide, since the images came back at 1254 px rather
    than the 1536 or 1024 asked for.
  - It cuts the sedan at its section join and writes one 512 × 640 frame per saved section to
    `public/images/street-props/`.
  - Results:

    | Prop      | Height after the width fit |
    | --------- | -------------------------- |
    | Sedan r90 | 89% of the guide           |
    | Sedan r0  | 95% of the guide           |
    | Planter   | 100% of the guide          |
    | Cabinet   | 108% of the guide          |

    Magenta fringe is 0% everywhere.
- **`courtyard/streetPropArt.ts`** swaps each file in under the procedural texture's own key, with the
  procedural contact shadow underneath.
  - The sedan has its own art per rotation and is never mirrored.
  - The planter's one file serves both rotations.
  - The cabinet has art for rotation 0 only.
  - A file that is missing or fails to load leaves the procedural kit.
  - It applies to intersection scenes only, gated like the surface materials.
- **`sedanCut`** now gives the cabin section the whole glasshouse, windscreen included.
  - Splitting the car exactly at the join left roof stubs and notched roofs whenever the two sections were
    in different states.
  - The nearer section keeps its half clipped to its own frame, and the farther keeps everything else, so
    the two always add up to the whole car.
  - See [`mixed-sections.jpg`](street-props-pack/mixed-sections.jpg).

## Evidence (unedited browser captures, `docs/evidence/street-props/`)

Before is `main`; after is this branch. Each pair uses the same URL and camera.

| View                                          | Before / after                                                                                                                                                                                    |
| --------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Street, night                                 | [compare](evidence/street-props/compare-street-night.jpg)                                                                                                                                         |
| Street, with characters, reveal on            | [compare](evidence/street-props/compare-street-night-actors.jpg)                                                                                                                                  |
| Street, damaged / destroyed                   | [damaged](evidence/street-props/compare-street-damaged.jpg) · [destroyed](evidence/street-props/compare-street-destroyed.jpg)                                                                     |
| Sedan close-up, intact / damaged / destroyed  | [intact](evidence/street-props/compare-sedan-close.jpg) · [damaged](evidence/street-props/compare-sedan-close-damaged.jpg) · [destroyed](evidence/street-props/compare-sedan-close-destroyed.jpg) |
| Sedan with a character behind it              | [compare](evidence/street-props/compare-sedan-actor-behind.jpg)                                                                                                                                   |
| Kerb (planter, cabinet), intact / destroyed   | [intact](evidence/street-props/compare-kerb-close.jpg) · [destroyed](evidence/street-props/compare-kerb-close-destroyed.jpg)                                                                      |
| Neutral, lights off, overview (after/ only)   | `after/street-neutral.jpg`, `after/street-lights-off.jpg`, `after/sedan-close-neutral.jpg`, `after/kerb-close-neutral.jpg`, `after/overview.jpg`                                                  |
| A character on and beside wrecks (after only) | [sedan](evidence/street-props/after/wreck-actor-behind.jpg) · [kerb](evidence/street-props/after/wreck-kerb-actor.jpg)                                                                            |

## Screenshot observations (what the captures show, not tested behaviour)

- **Placement:**
  - Both sedans sit in their parking bays.
  - The planter and the cabinet stand on their footprints.
  - Nothing floats or sinks.
- **Night:**
  - The night ambient tints the new art like everything else.
  - The sedan beside the shop is lit by the lamp pool, and the far one is darker.
- **Damage:**
  - Damaged reads as the same object shot up: crazed glass and bullet holes on the sedan, chipped concrete
    on the planter, doors blown open on the cabinet.
  - Wrecked reads as a burnt shell or a heap of rubble.
- **With a character behind the sedan,** the section that hides them fades, as before.
- **The shop's lamp still hangs clear of the car.**

## Interaction tests (driven in the browser, results as observed)

`/scene-review` at the corner framing, against this branch:

- **Reveal toggle, Lights and Night checkboxes, zoom in and out, pan and reset:** each changed the frame,
  and no remount was needed.
- **Target selection:** the 6th Street rifleman shows "NO LINE OF SIGHT", the same as `main`.
- **Diagram view** toggles without error.
- **Files:** all 18 street-prop files loaded with status 200.
- **No page errors.**
- **Fallback:** with every sedan file forced to 404, the procedural car is drawn and there are no page
  errors.

Pixel regression against `main` with no characters:

- **Alley 5, office 4, residential 4, garage 33, nightclub 7 and warehouse 5:** pixel-identical.
- **Unit tests:**
  - `streetPropArt.test.ts`: file-to-texture coverage, no mirrored or rotated cabinet; every shipped file
    is a 512 × 640 WebP with alpha.
  - The cut: the engine keeps the bonnet but no roof or windscreen, and the nearer half stays inside its
    frame.
  - `streetPropPack.test.ts`: still passes.

**Not tested:** a real campaign fight in `/play` (it needs a Supabase session), and save/load.

## Honest critique

- **The wrecks are taller than the brief.**
  - The prompts asked for remains no higher than the bonnet, or a third of the box.
  - The returned wrecks are a full burnt shell for the sedan and waist-high rubble for the planter and
    cabinet.
  - Wrecked props draw under units because they are walkable remains, so a character standing on one
    stands on top of the rubble (see the kerb capture), which reads acceptably.
  - A character just behind a burnt sedan shell would also draw over it.
  - The importer does not enforce the height limit on wrecked images. If this reads wrong in play, the fix
    is lower wreck images, not a renderer change.
- **The r0 sedan, mixed states.**
  - When an intact cabin meets a wrecked engine, a hard vertical edge shows where the cabin's frame ends,
    through the windscreen's foot. No cut can do better, because the frame cannot hold that part of the
    windscreen.
  - The r90 car, the one at the corner, has no such edge.
- **The cabinet is 8% taller than its guide.** It is within tolerance and reads naturally beside the door.
- **Scale and style:**
  - The art is painted at a higher detail than the code-drawn buildings around it, so the props now lead
    the eye.
  - That is the right direction, but it raises the bar for the next pass on the facades.
