# Occupied repair corner — painted asset handoff

Status: creator PNGs integrated in PR330 as optimized WebP textures.
Run `node tools/art/repair-frontage.mjs` from the repository root to rebuild
the four runtime assets. The narrow parts variant is a deliberate left crop.
Code-built depth, signs, sill, mullions, lamp emission and cutaway clipping
remain in place; procedural interiors are the missing-art fallback.

## Asset contracts

| Output            | Guide                    | Physical region | Runtime treatment                                                                                    |
| ----------------- | ------------------------ | --------------- | ---------------------------------------------------------------------------------------------------- |
| repair-bench.png  | guides/repair-bench.svg  | 3.30 × 1.76 m   | Straight-on opaque interior elevation; mapped to east bay s=.35–3.65, z=.72–2.48.                    |
| repair-parts.png  | guides/repair-parts.svg  | 1.75 × 1.76 m   | Straight-on opaque parts cabinet elevation; east bay s=3.90–5.65, same height.                       |
| balcony-metal.png | guides/balcony-metal.svg | 2 × 2 m         | Seamless neutral painted sheet metal, reused by code on canopy/slab surfaces with physical UV scale. |

The narrow north openings are 1.45 m wide. Do not squeeze the wide bench into
those windows. Use deliberate crops of the parts asset, or a separate north
composition if the crop loses its focal object. All images are albedo only.
The balcony remains assembled geometry: replacing it with an opaque whole-wall
painting would destroy its depth, window occlusion and Reveal behavior.

## Shared art direction

Grounded digitally painted realism, fine visible brushwork, matte finish,
late-1980s/1990s electronics repair shop in a lived-in cyberpunk city. Maintained
but heavily used. Broad readable forms first; texture supports them. Restrained
olive, warm grey, faded teal, dark steel and dull copper. Neutral diffuse light,
local crevice shade only. No neon colour cast, bloom, fog, people, logos, readable
text, external cast shadows or cinematic perspective. Do not paint the glass,
window frame, outer building, sign or canopy into the interior images.

## Repair bench prompt

Attach guides/repair-bench.svg rendered as PNG. Paint a production game texture
over its measured straight-on elevation, preserving the rectangular canvas and
large object placements. A shallow, densely worked electronics repair recess:
worn pegboard on the back wall; one chunky CRT oscilloscope on the left; an open
receiver with exposed copper windings and circuit board at centre; articulated
bench magnifier toward the right; coiled test leads, small trays and restrained
paper job tags. Dark mismatched steel drawers below a worn timber worktop. Leave
negative space among hanging tools; no evenly repeated tool row. Preserve the
worktop at 61 percent of image height. No perspective convergence: this elevation
will be projected onto an isometric wall by code. Full-bleed opaque image, 1536 ×
819 px. Follow the shared art direction. Guide colours and labels are not artwork.

## Parts cabinet prompt

Attach guides/repair-parts.svg rendered as PNG. Paint a full-bleed straight-on
repair-shop parts cabinet elevation at 1024 × 1030 px. Two shallow rows of mixed
small bins above a worktop; a dismantled speaker and one cardboard parts carton
on the bench; mismatched metal drawers below. Sparse blank paper labels, dusty
edges, soft handling wear, dull copper and oxidised screws. Keep the measured
worktop height and object masses. Different densities across shelves, no tidy
identical retail product grid. Full-bleed opaque image; follow shared art direction.

## Balcony metal prompt

Create a seamless 1024 × 1024 surface tile representing exactly 2 × 2 metres of
faded blue-grey/teal painted galvanised steel. Fine hand-painted material texture,
subtle broad wear and restrained tiny rust specks, maintained urban architecture.
Flat orthographic surface with even neutral illumination. No panel borders,
seams, bolts, ribs, lettering, gradients, directional shadows, objects or holes.
The renderer adds ribs and construction edges at their measured world positions.
Avoid prominent stains that advertise tiling. Seamless on all four sides.

## Integration and acceptance

Import to public/images/architecture at the registered aspect ratios and prefilter
for actual play-scale rendering. Add decoded keys to architecturePack and map the
bench/parts within existing recesses; keep the current drawing as missing-asset
fallback. Use material mapping on balcony planes rather than stretching a facade
image across different faces. No lighting or collision changes.

Compare seed8 play, neutral, lights-off, Reveal, destroyed/restored and compact
against the existing PR330 baseline. Require a visible material-quality gain at
normal zoom; verify light remains behind balcony surfaces and no image survives a
removed wall. Check control seeds0/7 and historic v12 selection. A technically
valid image that reads as flat vector artwork is not an art-quality pass.
