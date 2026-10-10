# Night City Tales — painted streetscape

Updated2026-10-09. Levi approved the broad streetscape pass after mergingPR330.
Repo LeviJohnsonNC/nightcitytales; new remote branch codex/painted-streetscape.
Base main5993a2fbf842e4c9257c052f969a40ab4b898786 (includes merge330 and formatting).
Local history reconstructed: NEVER git push. Use GitHub tree/commit/update_ref
with expected-head lease; preserve newer main files outside the selected changes.
Levi merges. Publish for testing; do not merge. Preserve unrelated dirty
courtyard/cityBlock.ts, untracked cityBlock.test.ts and recovery directories.

## Current milestone

User: “Go big, don't hold back, and then we can test it out when changes land.”
Goal: whole-frame material/colour cohesion, strong occupied market/repair focus,
grounded buildings and quieter internal texture. Existing creator assets only.
surfaceCharacter.ts adds world/metre anchored broad colour fields and facade
splash/runoff beneath openings. surfaceMaterials.ts applies these inside existing
face clips, reducing asphalt/paving microcontrast. Same field coordinates in Reveal.
commercialUpper/composedEnvironment palettes give ochre and sage identities.
groundFinish.ts adds broad worn walking aprons and foundation falloff clipped to
sidewalk zones. nightLighting.ts reduces blue cast and light amplification, with
warmer paving grade. No scene recipes, tactical geometry, cover or actor changes.

## Validation / next

Typecheck and changed-file lint passed. Full suite4125pass/1fail: new recorder test
compared gradient function identities; normalized recorder output, focused rerun
passed; production build passed. Test verifies affine/resolution mapping, deterministic finite
draw commands and balanced canvas state. Existing329testfiles passed.
Next publish selected files/newPR; CI and actual screenshot inspection still needed.
Do not call visual improvement accepted until pixels are inspected.

## Reliable evidence workflow

PR330 final code7fa4f0e; merge32f8570. Prior CI37972650907 and paired visual37972651008
passed. Ring fix: SVG translateZ(0). Capture fix: viewport-relative clip plus PNG
size assertion. Preserve all media interception fixes, overlay diagnostics, states,
seed8timeout180s, suite420s, no retries. Passing CI is not visual acceptance.
Reference baseline evidence locally docs/evidence/pr330-composition/after-seed8-play.png.
Last Vite listen failed EPERM. Chrome GitHub artifact link downloads worked; helper
and shell downloads failed. Verify downloaded ZIP SHA256 against artifact API.
Download via Chrome link named Download city-block-after (opens in a new tab),
usually nth(1); extract /tmp then view_image real PNGs. No filename-only reviews.

## Parallel stream — shopping as discovery (Claude, branch claude/shady-goods-store-art-i8grnn)

Updated 2026-10-10. Plan of record: docs/shopping-discovery.md. Passes 1–3 merged (#343,
#344, #345). Pass 4 (engine/merchantTies.ts: interests, holds, range trial, item record)
implemented: typecheck, lint, unit suite (336 files) and build pass; not browser-inspected;
`bun run eval` never run for the finds' packet line (paid). Next: Levi's store UI overhaul —
the sheet is deliberately plain; every rule lives in engine/ and features/campaign/shopping.ts.
