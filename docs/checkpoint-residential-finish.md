# Residential block and annex finish

Continues accepted PR #306. The local preparation commit `0ea0194e` is preserved.
Levi's four uploaded PNGs match main `0e5d5bf8` byte-for-byte.

The block now has 22 cm window recesses, 18 cm projecting sills with substantial
front faces, head planes, projecting floor bands and a low masonry base. Three
painted interiors follow existing deterministic occupancy choices. Wide ground
bays keep their procedural privacy cloth. The annex shares plaster and masonry
while retaining its existing windows, shutter and saved entrance.

Full and cutaway walls share `paintHomeFace`, original face coordinates and exact
segment clipping. Window light clips around the mullion and painted curtains or
blind; retained-wall lighting clips to the same segment. The existing maximum of
three lit home windows is unchanged. Reflections remain off/not built.

No engine, layout, recipe, collision, targeting, damage or save-format changes.
Original source images remain out of the character-creator glob. Rebuild runtime
art with `bun tools/art/residential-finish.ts`.

## Review and remaining weaknesses

Connected Chrome, existing Vite on port 8080, 2036 × 1048 viewport. Seeds 7, 0 and 8
were inspected at normal play framing, lights off and reveal. Seed 7 has matched
before/after play, close night and neutral views. The finished shop stays brighter
and richer; residential floor divisions and sill depth survive normal play zoom.
Interior fabric is a quieter secondary detail and resolves best closer in.
The masonry base reads mainly as weight/contact at play scale, not individual
bricks. The roof remains a large plain field; this pass does not claim parity
with the atmospheric reference or finish the rest of the street.

Seed 7 mixed damage was saved, the fixture changed to Garage, and Load review
restored the frozen seed-7 scene with nine destroyed cover sections. The rifleman
remained a clear shot at 21 m / DV20; the lookout remained blocked by a sedan
engine block. This verifies the local review snapshot, not a live campaign DB
round trip or a submitted combat action. No console errors were observed.

Validation: full Vitest suite 314 files / 4059 tests before the final regression;
new full/cutaway interior regression then passed with its file's 19 tests.
Bun production build, TypeScript and changed-file ESLint passed. The suite also
covers existing saved-scene/geometry contracts. Actual-browser evidence is in
`docs/evidence/residential-finish/`.
