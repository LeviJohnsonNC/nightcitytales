# Painted architecture kit

Approved direction: substantial dark market joinery, weathered repair render, occupied apertures,
matte street materials. Generated from Levi's approved intersection paint-over on 2026-10-10.

Each 1774 × 887 atlas has two 887 × 887 panels. The full-resolution WebPs are quality-96
masters; the unmodified generated PNGs remain beside them locally. Rebuild runtime assets:

```sh
bun tools/art/painted-architecture.ts
```

The importer extracts panel halves and the market interior, then exports 768px runtime WebPs.
Window edges in the returned painting differed from the prompt: actual measured coordinates
are recorded in `PAINTED_APERTURE`. Nine-region mapping registers those edges to the existing
saved openings while stretching only surrounding construction. Ground floors omit the middle
region and retain separate interiors, recesses and light passes. Levi's repair interior assets
remain in use. Upper occupied rooms are subdued by the existing dynamic lighting pass.

No text, doors, collision, cover or world geometry is inferred from an image. Missing images
retain the earlier procedural drawing. Cutaway and full walls use the same painter and clip.

The concrete panel represents 1.6 × 1.6 metres (the generation's suggested four metres made
blocks too large). The teal canvas repeats over the existing 1.6 metre fabric basis.
