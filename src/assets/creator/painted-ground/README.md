# Painted ground

Generated neutral two-panel atlas for the approved intersection paint-over.
Each square covers 4 × 4 metres: asphalt, then 4 × 4 one-metre paving slabs.
Master: ground-atlas.webp. Run `bun tools/art/painted-ground.ts` to regenerate
512px runtime panels. Import logs measured RGB means used by surfaceMaterials.ts.

No neon, reflections or directional cast shadows are baked into this artwork.
Runtime world wetness, source-image reflection, lamp shadows and lighting remain
separate. Assets use the existing intersection-only material loader and mip preparation.
Original PNG retained outside the repository in ../generated_images.
