# Architecture pack: the shop's neighbours

Status: **specified, nothing commissioned.** This is the smallest pack the architectural
pilot ([`checkpoint-architecture-pilot.md`](checkpoint-architecture-pilot.md)) still needs.

## Why only two images

The pilot is drawn in code, or with materials the game already has. Each element was
checked against the existing set before asking for anything new.

| Element                                   | How it is made                                                   | New art? |
| ----------------------------------------- | ---------------------------------------------------------------- | -------- |
| Shop parapet coping                       | `facade-concrete`, laid on the coping's top, jointed in code     | no       |
| Neighbour metal cap                       | `painted-metal`                                                  | no       |
| Kerb stones (top and face)                | `facade-concrete`, one tone per stone                            | no       |
| Channel, tactile paving, gullies          | code                                                             | no       |
| Plinth, sill, meter box, downpipe, louvre | code, in the face's own projection                               | no       |
| Grime, splash, door wear, grease          | code, placed where use puts it                                   | no       |
| **Neighbour roofs**                       | `roof-membrane` graded darker, no seams: **reads as the shop's** | **yes**  |
| **Neighbour walls**                       | `facade-concrete` graded darker: **reads as the shop's**         | **yes**  |

The neighbours' identity is the one thing code cannot give them. At play zoom they
are mostly roof (see `architecture-pack/context-targets.jpg`), and today that roof is
the shop's own membrane, only darker. A ballast roof and a painted render make them a
different building, not the same building in shadow.

## The pack

| File Picasso saves   | Canvas      | One tile covers | Grain                                   | Goes on                    |
| -------------------- | ----------- | --------------- | --------------------------------------- | -------------------------- |
| `roof-ballast.png`   | 1024 × 1024 | 2 × 2 m         | ballast stones 20–40 mm                 | the neighbours' roofs      |
| `painted-render.png` | 1024 × 1024 | 4 × 4 m         | trowel marks 0.2–0.5 m, hairline cracks | the neighbours' open walls |

**Attach, with each prompt:** `docs/architecture-pack/guides/<key>-scale.png`. It shows
how much of the world one tile covers, with the grain drawn to scale in its top-left
metre. Optionally also attach `context-targets.jpg` so Picasso sees where the tile goes.
The prompts are in [`art-style.md`](art-style.md#surface-tiles-combat-scenes).

Picasso returns 1254 × 1254 whatever is asked. The pipeline resizes, so that is fine.

## How a returned tile becomes game art

The first material pass already provides this pipeline: `tools/art/materials.mjs`.

1. Save as `src/assets/creator/<key>.png`.
2. Add the key to `tools/art/materials.mjs`'s list and run `node tools/art/materials.mjs --check`.
   - The tile must wrap (seam ratio near 1).
   - It must carry no baked lighting.
   - Note its mean albedo.
3. Add the key to `MATERIAL_KEYS` and `SURFACE_MATERIALS` in `surfaceMaterials.ts`,
   with `metres` from the table above and `mean` from step 2.
4. In `paintBuilding`, the neighbour role lays `roof-ballast` on its roof and
   `painted-render` on its walls, in place of the graded membrane and concrete. The
   roof keeps no seams, and the walls keep their windows, louvre, plinth and pipe on top.
5. Recapture `docs/evidence/architecture-pilot/` and check the neighbours at play zoom,
   reveal on and off. They must stay quieter than the shop.

## Regenerating the guides

`bun run tools/art/architecture-pack.ts --port 5180` writes the scale cards and the
context frame from the pilot's own geometry (`frontagePilot`).
