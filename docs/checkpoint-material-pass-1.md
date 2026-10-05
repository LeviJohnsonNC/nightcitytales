# First material pass — intersection corner

A focused integration of six supplied surface textures into the existing shared
renderer, to prove the asset pipeline. It is **not** the reference-image
transformation, and it has not been visually accepted: the captures below are
evidence for review, and automated tests do not close that gate.

No saved geometry, entrance, footprint, activity group, collision, targeting or
damage rule changes. Recipe versions and frozen snapshots are untouched; the
change is confined to how surfaces are painted.

## Scope

| Surface                                       | Material          | Where                                                                                         |
| --------------------------------------------- | ----------------- | --------------------------------------------------------------------------------------------- |
| `road`, `intersection`, `crosswalk` zones     | `asphalt`         | every intersection-recipe scene (a crosswalk is laid across the carriageway)                  |
| `sidewalk` zones                              | `sidewalk`        | same; the drawn metre grid is dropped, the kerb line stays                                    |
| Shop-style masses: walls, incl. cutaway walls | `facade-concrete` | commercial corner and its continuation, plus the low annex                                    |
| Shop-style roofs                              | `roof-membrane`   |                                                                                               |
| Shop-style rooftop units                      | `painted-metal`   | 2 m units, so one tile per unit face                                                          |
| Shop doors                                    | `shutter`         | the planes the old code already marked as roller shutters with drawn slat lines; nothing else |

Everything else — parking, loading court, driveways, gardens, workshop,
warehouse and residential masses, interior and every other recipe — is painted
exactly as before. Across six other environments (alley 5, office 4, residential
4, garage 33, nightclub 7, warehouse 5) a before/after screenshot comparison found
**0 differing pixels**. Intersection seeds 1, 2, 3, 4, 12 and 13 were rendered and
inspected for breakage.

On seed 7 the corner is `building_0` (with `_middle` and `_rear` continuing it
off-map) and the annex `building_1`. Materials are keyed on `style === "shop"`
inside the intersection recipe rather than on an id, so other seeds' shopfronts
get the same treatment; this is the smallest rule that is not a special case.

## The asset pipeline

`tools/art/materials.mjs` reads `src/assets/creator/<name>.png` (kept, untouched)
and writes `public/images/materials/<name>.webp`:

| Source            | Findings                                                                                                                                                     | Processing                                                                 | Output |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------- | ------ |
| `asphalt.png`     | 1254², RGB, no alpha. Tiles; no baked lighting (brightness spread across an 8×8 blur: 4/255).                                                                | resize 512                                                                 | 116 KB |
| `facade-concrete` | Tiles. Grain is ~4% of brightness at the size it is drawn — invisible unmodified (see `gain` below).                                                         | resize 512                                                                 | 84 KB  |
| `painted-metal`   | Tiles. Same low-contrast note. Scratches are fine at 2 m per tile.                                                                                           | resize 512                                                                 | 65 KB  |
| `roof-membrane`   | Tiles; no baked lighting.                                                                                                                                    | resize 512                                                                 | 103 KB |
| `shutter`         | Eighteen slats at a 69.67 px pitch fill 1254 px exactly, so it tiles vertically; slat pitch is 0.2 m at 3.6 m per tile.                                      | resize 512                                                                 | 56 KB  |
| `sidewalk`        | Slab joints at 3, 311, 624, 938, 1251 px: the 1254 px canvas is **six pixels longer than four slabs**, so a tile boundary would carry a doubled joint strip. | crop to `[3, 3, 1248]` — four slabs, starting on a joint — then resize 512 | 95 KB  |

None needed regeneration. The script reports each tile's wrap-around seam ratio
(1.0 means the seam is no worse than any other pixel boundary), mean albedo and
baked-lighting spread, and **fails** if a texture tiles badly or carries lighting.
The sidewalk's ratio reads 1.59 because a joint centred on the tile edge looks like
a step to that metric; it was judged on a 2×2 tiling by eye (joints run through
unbroken) and has its own documented limit. The grain textures needed no seam
repair, so none was applied — blending an already-tiling texture only blurs it.

Six derivatives total ~520 KB, loaded only by intersection scenes. The 3 MB
originals are no longer bundled: `chargen/art.ts` globs everything in
`src/assets/creator/`, which had begun emitting all six PNGs (~20 MB) into every
build; they are excluded there.

## Mapping, scale and ordering

`courtyard/surfaceMaterials.ts` lays a tile through the same affine projection
the scene is drawn with, so a tile is a physical size:

- ground and roofs: anchored to world metre (0, 0), one tile = 4 m (sidewalk, so
  its 1 m slab joints fall on every metre line and on every zone edge);
- walls: the tile's foot on the ground line, vertical scale from `pixelsPerMetre`,
  anchored along the wall to world metres, so a full building and its cutaway
  pieces show the same wall;
- shutter: 3.6 m tile at the 0.2 m slat pitch the drawn lines already had;
- no texture is stretched across a surface; a long wall repeats the tile.

The old flat fill is the fallback and also the colour each material is _graded_
to, so night grading stays where the palette put it: finished mean colour equals
the old fill's. `gain` (facade 2.4, metal 3, roof 1.6, asphalt 1.4, sidewalk 1.2)
scales a tile's deviation from its own mean after it is reduced to draw size, and
is applied to pixels at load, never to the asset. Material strength is 0.75–0.9.
Contrast lands near 10–15% brightness variation: enough to read as a surface,
not enough to compete with actors, cover or routes.

Materials are laid first; edges, windows, bays, doors, lintels, piers, kerb
lines, lane paint, crosswalk stripes, floor-use marks, entrance mats, tactical
overlays and the existing speckle then paint over them unchanged. Sprite
placement, `sortRect`, depth, ground registration and the fading logic are not
touched.

A tile that fails to load leaves its surface flat and never fails the scene.
A material scene is painted at 2× (limited so no texture exceeds 4096 px) because
a pattern tile cannot show its grain at 1×; large masses are drawn at 2× and
displayed at scene size. Tiles are mip-reduced to the drawn density first, since
canvas pattern fills do not mip-map and the slab joints and slats would shimmer.

## Browser verification

Chromium (Playwright build 1194, software GL), `/scene-review`, the shared renderer.
Captures are unedited screenshots of the canvas, driven by the page's own controls
with `tools/scenes/material-evidence.mjs`; they are JPEG-encoded at the capture
step (quality 92). Before = `main` at 7832f4b, after = this branch.

| View                                         | Before                                                          | After                                                         |
| -------------------------------------------- | --------------------------------------------------------------- | ------------------------------------------------------------- |
| Overview, reveal on                          | [before](evidence/materials-1/before/overview-reveal.jpg)       | [after](evidence/materials-1/after/overview-reveal.jpg)       |
| Overview, solid buildings                    | [before](evidence/materials-1/before/overview-solid.jpg)        | [after](evidence/materials-1/after/overview-solid.jpg)        |
| Corner, actors + overlay, reveal on          | [before](evidence/materials-1/before/corner-actors-reveal.jpg)  | [after](evidence/materials-1/after/corner-actors-reveal.jpg)  |
| Corner, actors + overlay, reveal off         | [before](evidence/materials-1/before/corner-actors-solid.jpg)   | [after](evidence/materials-1/after/corner-actors-solid.jpg)   |
| Annex shutter, overlay on                    | [before](evidence/materials-1/before/annex-shutter-solid.jpg)   | [after](evidence/materials-1/after/annex-shutter-solid.jpg)   |
| Diagram view (draws no art; must not change) | [before](evidence/materials-1/before/annex-shutter-diagram.jpg) | [after](evidence/materials-1/after/annex-shutter-diagram.jpg) |
| Corner, cover damaged                        | [before](evidence/materials-1/before/corner-damaged.jpg)        | [after](evidence/materials-1/after/corner-damaged.jpg)        |
| Corner, cover destroyed                      | [before](evidence/materials-1/before/corner-destroyed.jpg)      | [after](evidence/materials-1/after/corner-destroyed.jpg)      |

Observed: footprints, doors, entrances, markings and wrecks sit exactly where
they did; sidewalk slab joints now land on zone edges; actors, target rings and
route squares stay readable over the surfaces. Shown at actual-size and at 390 px
width the scene loads without script errors. A 404 for
`neon-storm-front.mp3` appears in the console on `main` too and is unrelated.

## What this does not establish

- The reference image was not in the repository or the task, so nothing here was
  compared with it; the work follows the surface problems named in 4D.2–4D.6.
- Real campaign movement, firing and save/load were not exercised; this is the
  static review harness, as in 4D.6. Materials are presentation, so none of that
  should move, but it has not been checked.
- Only Chromium was used. `CanvasPattern.setTransform` and `multiply` blending are
  widely supported but Safari and Firefox were not looked at.
- `gain`, strengths and 2× supersampling were tuned by eye in one renderer.
  Memory rises for these scenes (ground ~4× pixels).
- The shutter texture has no frame, housing or guide rails, so it reads as a
  slatted panel, not a door. The annex's "apartment entrance" is a shop-style
  door and gets the shutter the old drawing already gave it.
- The cutaway floor is still a flat fill, and workshop, warehouse and residential
  masses, parking, loading courts and alleys are unchanged.
- No bloom, wet reflections or lighting; light pools are the existing glows.

## Next assets

Needing an **exact silhouette and ground-anchor guide** before generation, because
they are drawn into the saved geometry's projection and sort by their ground point
(guide: the iso footprint and wall plane at `pixelsPerMetre`, cut from the
recipe's own rects):

1. Shopfront bay module (glass, sill, stall riser): 2.2 m bays at 0.65–2.35 m on
   the facade plane, both facing walls.
2. Roller-shutter door with housing, jambs and guide rails: 1.6 m × 2.2 m opening
   at the saved entrance positions.
3. Retail fascia and awning (saved attachments: span, projection, height).
4. Rooftop units: 2 × 2 m footprints with 0.5 m heights, vents, a water tank.
5. Parapet / cornice and the corner pier where two walls meet.
6. Standing street props that sort by ground point: lamp post, sign, bollards,
   stools, planters, mail boxes, bins.
7. Kerb face and gutter strip along saved zone edges.

Tileable or decal art that does **not** need a silhouette guide (world-scale, top
down or flat on a plane): brick and stucco facade variants; corrugated metal
siding (workshop, warehouse); residential roofing; interior floors; painted-metal
and concrete variants with more visible grain; crosswalk and lane-paint wear;
manhole and drain covers; asphalt patches and cracks; litter and stain decals.
