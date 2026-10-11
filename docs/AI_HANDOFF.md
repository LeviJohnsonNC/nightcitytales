## Active solid street / object pass — 2026-10-11

Checkout: /Users/levijohnson/.codex/worktrees/street-neon-clipping/nightcitytales.
Branch codex/solid-street-objects; base origin/main e77fa705 (PR353 merged).
Normal fetched Git history. Original dirty checkout remains untouched. Levi merges.
User approved clipping fixes, calmer crate art, and purposeful object clusters.

Local implementation: optional elevation ordering for overlapping footprints;
measured canopy/prop/actor volumes; expanded repair-fitting bounds retain shade.
Versioned cargo-states-v2.webp generated from the original atlas, same 2172x724
three-cell registration and alpha, lossless WebP. Original retained.
Recipe15 seed8 adds canonical pallet, workbench and collection bin with reserved
handling spaces. Frozen v14 fixture protects saved scenes; other seeds unchanged.

Implementation d9cedf98 plus the next ordinary refinement commit. PR356 draft:
https://github.com/LeviJohnsonNC/nightcitytales/pull/356
Refinement: painted workbench at(20,20) with measured atlas registration; bin in
utility court(24,4); market pallet at(4,10), visible around the return/in reveal.
Intact/damaged/wreck art and original crate atlas are retained/versioned.

Validation: typecheck/build pass, lint zero errors/15 existing warnings. Full suite
4,263pass/1 asset-inventory assertion; extended it for the new atlas and all9 asset
tests pass. Earlier full tree d9cedf98 had4,263pass; final remote suite pending.
Local Chromium3seed pass at d9cedf98, final refined seed8 pass. Actually inspected
final play/reveal/destruction/compact: bench and bin visible, no detached rings,
crate calmer, routes readable. Other seeds unchanged geometrically.
Next: push refinement, await remote CI and both Chromium jobs, inspect final
remote captures, then mark PR356 ready. Levi reviews/merges.
Do not claim all clipping eliminated or visual acceptance before pixel inspection.

## Active architecture depth pass — 2026-10-11 UTC

PR350 merged. Working in isolated ../city-block-depth, branch codex/architecture-depth.
Read [checkpoint-architecture-depth.md](checkpoint-architecture-depth.md).
Levi approved the architecture/shadow revision. Local implementation and review in
progress; no publication or visual acceptance yet. Never git push; Levi merges.

## Active visual pass — 2026-10-11 UTC

PR347 merged; isolated checkout `../city-block-ground-light`, branch
`codex/painted-ground-light`, base main `eda4f4cf35b2963109ca322a6afdecc6a97acc01`.
Read [checkpoint-painted-ground-light.md](checkpoint-painted-ground-light.md).
Levi authorized ground + lighting together. Preserve recovery dirty work; never git push
reconstructed history; GitHub tree/commit/ref publication only. Levi merges.

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

Updated 2026-10-10. Plan of record: docs/shopping-discovery.md. Passes 1–4 merged
(#343–#346). Store UI part 1, the Counter (features/life/shop/, inline in LifeScreen,
/shop-review fixtures): typecheck, lint, unit suite (337 files), build and the
public-route browser test for /shop-review (desktop + phone, axe) pass; screenshots
taken from /shop-review only — the signed-in Life screen was not browser-checked.
Next: Levi generates the 22 item pictures (docs/art-style.md, Object wrapper);
convert with tools/art/webp.mjs public/images/items and list them in ITEM_ART_READY.

## Parallel painted architecture pass

PR #347 (`codex/painted-architecture`) implements the approved painted facade kit.
See [painted-architecture-handoff.md](painted-architecture-handoff.md) for its isolated
checkout, asset registration, validation and remaining visual-review gates.
