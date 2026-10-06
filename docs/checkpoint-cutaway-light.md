# Checkpoint: the shop's display light in the cutaway

**Scope.** A correction to #295's composed shop side (`courtyard/streetfront.ts`, `paintReturnLight`). Nothing
else changes: the reveal geometry, the pieces' heights, the albedo and every other light are as they were.

## The fault

**The light was drawn whole for every piece.** `paintReturnLight` drew each display window's light and glow whole
for any cutaway piece that overlapped the window. It never clipped to the piece's stretch (`s0`–`s1`) or height
(`zMax`).

- **The light pass was hidden by the mask.** The renderer masks it to the piece's own albedo, so the fault never
  showed there.
- **The glow pass was not.** It is added after that mask (`lightCanvas`), so the whole window's glow appeared:
  - above a piece the reveal had cut below the sill: a bright strip floating where no wall is (`compare/reveal-lights.jpg`, before);
  - in both pieces a 2.2 m window spans, drawn twice.
- **The surround was missing from the pieces.** The window surround (the lit sill and the wall round the opening)
  was drawn on the full wall only, so a retained piece lost it.

## The correction

- **Both passes are clipped to the piece:** its stretch along the face and its retained height.
- **No window light below the sill.** A piece retained below the sill draws no window light at all: the window
  above it is gone.
- **The surround is drawn by `paintReturnLight` itself,** inside the same clip. A retained piece keeps the part of
  the sill and surround that survives on it, and the full wall is unchanged.
- **The neon's light is clipped too,** although its sign (2.93–3.65 m) is always above a piece's height (at most
  2.4 m), so it never reached one.
- **The shopfront's own face was already right.** It clips its light to the piece in `paintStorefrontFace`.

## Evidence

**Rendering regression check** (`src/features/play/__tests__/streetfrontCutaway.test.ts`). A recording canvas
keeps the clip stack and every paint. Each clip is mapped back onto the wall's (along, height) plane. The test uses
seed 0's first display bay, which spans two 2 m pieces:

| Case                                   | Expected                                                                      |
| -------------------------------------- | ----------------------------------------------------------------------------- |
| Retained piece (2.4 m), light and glow | Something is lit, and every paint is under a clip that lies inside the piece. |
| Piece cut to 0.65 m, below the sill    | Nothing is drawn, in either pass.                                             |
| The two adjacent pieces                | Both are clipped, and their clips do not overlap, so nothing is drawn twice.  |
| The full wall (no clip)                | Drawn as before, unclipped.                                                   |

Against the code before this correction, 5 of its 8 tests fail. With it, all pass.

**Close-ups** (`docs/evidence/cutaway-light/`). Seed 0's display bays at 3.5x, actors on, before and after, from
`tools/scenes/cutaway-light-evidence.mjs`:

- **Reveal, lights on:** the floating strip over the cut-down piece is gone, and the retained pieces keep their lit
  windows and surround.
- **Reveal and solid, lights off:** before and after are pixel-identical.
- **Solid, lights on:** before and after differ only where the animated actors stand, in the same place two runs
  of the same code differ.

**Not exercised:** a real `/play` fight and save/load.
