# Checkpoint: street props, round two imported

**Scope.** Picasso's nine round-two images
([`street-props-pack/round-2.md`](street-props-pack/round-2.md)) go into the board:

- the striped merchandise stand (`shop-display`) at r0 and r90;
- the cabinet (`mailboxes`) at r90, seed 0's pale cabinet.

They join the sedan, planter and r0 cabinet at round one's quality.

**Unchanged:** footprints, heights, openings, section boundaries, cover, damage, sorting, fading, saves, the
camera and the architecture. The art is placed by the prop's 2 m frame, exactly as the procedural kit was.

## 1. Import (`tools/art/street-props.ts --round 2`)

The importer now iterates `STREET_PROP_PACK_2` when given `--round 2`, so round one's files are not rewritten.
`expected()` and `wreckVolume()` take the stand's numbers from `KIOSK` (body, height, `wreckedMax` 0.45 m). The
cabinet at r90 takes `CABINET`'s.

Output files, one 512 × 640 frame each:

- `shop-display-<state>[-90].webp`;
- `mailboxes-<state>-90.webp`.

Every check is round one's, unchanged:

- key and fringe;
- fit within ±25%;
- intact and damaged drift within 3%;
- each wreck registered by translation of at most 0.5 m, and inside its volume.

| Guide       | Height after the width fit | Intact/damaged drift | Wreck: moved, above volume, flat spill |
| ----------- | -------------------------- | -------------------- | -------------------------------------- |
| cabinet-r90 | 110%                       | 0.0%, 0.1%           | 0.37 m, 0.0%, 9.0%                     |
| kiosk-r0    | 100%                       | 0.0%, 0.1%           | 0.29 m, **1.1%**, 12.1%                |
| kiosk-r90   | 107%                       | 0.0%, 0.2%           | 0.50 m, 0.0%, 12.7%                    |

Every key passes, with fringe 0.000%. `round-2/imported-frames.jpg` is the proof sheet.

**One waiver.** The r0 stand's wreck has 1.1% of its pixels above its volume, against a 1% limit. The excess is
the sunshade's far, upper-left edge, lifted off the heap (`wreck-guides/kiosk-r0-wreck-check.png`). The check is
not loosened. The id is on `TALL_WRECKS_PENDING`, so the wreck imports with the excess reported. The edit prompt
for `street-kiosk-r0-wrecked-v2.png` is in `art-style.md`. At play zoom the excess is a few pixels of canvas
edge at knee height.

## 2. Renderer (`courtyard/streetPropArt.ts`)

- **Coverage.** `COVERAGE.mailboxes = [0, 90]` and `COVERAGE["shop-display"] = [0, 90]`.
- **Rotations.** Every kind but the planter has its own file per rotation (`own90`); nothing is mirrored.
- **Same keys.** The files replace the procedural textures under their own keys (`prop-shop-display-<state>`,
  `prop-mailboxes-<state>-90`). The board's registration, sorting, fading, damage and contact shade apply to
  them unchanged.
- **Fallback.** A file that is missing or fails to load keeps the procedural kit.

## 3. Evidence (`docs/evidence/prop-round-two/`)

`before/` is `main` (procedural stand and rotated cabinet) and `after/` is this branch. Both are from
`tools/scenes/prop-evidence.mjs`, at the same cameras, with the same image files present. `compare/` sets them
side by side.

- **Play scale with characters, seeds 7, 0 and 8:**
  - `seedN-play`;
  - `seedN-lights-off`;
  - `seedN-reveal`;
  - `seedN-mixed-damage`.
- **Close-ups at 4x:**
  - `close-seed7-kiosk-*`: the stand at r0;
  - `close-seed0-kiosk-*`: the stand at r90;
  - `close-seed0-cabinet-*`: the cabinet at r90;
  - `close-seed7-cabinet-*`: the r0 cabinet, for comparison.

  Each in these states: `intact`, `damaged`, `destroyed`, `mixed`, `neutral` (no night), `lights-off` and
  `reveal`.

OBSERVATIONS

## 6. Limitations

- **The r0 stand's wreck** imports under a waiver until its redraw passes.
- **The atlas props are mirrored at r90.** The cart, crates, dumpster, generator and pallet remain a recorded
  debt.
- **Not exercised:** a real `/play` fight and save/load. This is presentation only, but nothing here was run in
  an authenticated campaign.
