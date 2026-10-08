# Night City Tales — resume here

Updated: 2026-10-08. Active vendor-corner follow-up after merged #322.

## Current result

- PR #322 (merged, verified through GitHub): https://github.com/LeviJohnsonNC/nightcitytales/pull/322
- Remote branch: codex/night-market-corner, base main 0f1f739e (merged #321).
- Tested head: d5134c924bb14f5fba35e12b252389f6924571d8.
- Full CI run 37824362745 PASSED (lint, format, types, tests, migration replay).
- Visual run 37824363018 PASSED 3/3 seeds on BOTH revisions.
  After job 113473231175: 4.4m. Before job 113473231569: 3.6m.
- Before archive: https://github.com/LeviJohnsonNC/nightcitytales/actions/runs/37824363018/artifacts/11571445097
- After archive: https://github.com/LeviJohnsonNC/nightcitytales/actions/runs/37824363018/artifacts/11569854981
- All six seed8 states captured, including damage, restoration and reveal.
- User-provided ZIPs match both artifact SHA-256 digests; all 22 PNGs inspected.
- No new blocking visual regression identified. Lighting improvement is modest;
  display detail is largely hidden behind the awning at play zoom.
- Accept as an incremental lighting/harness change, NOT the larger visual goal.
- Existing translucent cart and floating Reveal markers remain in both revisions.
- Detailed findings recorded in PR #322. Levi already merged the reviewed head; no production publish performed here.

## Implementation

- shopFinish.ts/storefront.ts: recessed stock, shelves, short fabric valances and
  inset broth menu, inside existing glazing/cutaway clips before glass/shadows.
- nightLighting.ts: shop lamp radius 5→4.2m, intensity .9→.75. Existing window and
  entrance emission retained. No recipe, saved geometry, cover or actor-fade edits.
- Initial freestanding vendor-sign idea discarded: saved seeds 0–19 omit that sign
  because its anchor overlaps reserved space. Those edits/tests were reverted.
- e2e/city-block.spec.ts: seed8 budget 120s for six captures plus save/load/damage;
  other seeds 90s; suite cap 300s; retries zero. Named steps and capture timings.
- First run 37823155997: baseline passed; head timed out at 90s after ready in 41.8s.
  Baseline also took ~88s. Follow-up changed budget, not renderer performance.
  Passing slower runner screenshots took ~4–8 seconds each.
- Local targeted lighting/fixture tests 14 passed; typecheck and lint passed.
  Follow-up spec lint/format and three-test desktop discovery passed.

## Verified baseline

Lovable project 2cad9dff-eecd-46d8-8b1f-749f46c6f3c6 latest_commit_sha matched
0f1f739ecc91c376267e36804806637f349d1d23. Its preview shows new drain/manhole
work missing from the earlier public-site review. Preview seed8 baseline screenshot
is docs/evidence/night-market-corner/seed8-baseline.png (NOT branch evidence).
Browser viewport override has been reset.

## Local preservation

Checkout city-block-recovery has reconstructed history; NEVER push its history.
Publish selected files via GitHub connector only. App/harness work is published
on the task branch; local snapshots b2f6106 and 9c2f987 preserve work and baseline.
Preserve unrelated cityBlock.ts formatting, untracked cityBlock.test.ts,
docs/city-block/, docs/evidence/city-block/ and old recovery checkpoint.
sources/ is read-only. Local server listen failed EPERM; do not retry unchanged.
This final handoff update is local so it does not restart passed PR checks.

## Active follow-up

- Base: #322 merge 08ff5c7c4cf7fc7ac1b0bf154b40e6aa8def52c4.
- Remote branch created: codex/vendor-corner-silhouette.
- Local batch: cartOcclusion.ts and sceneryOcclusion.ts implement alpha-aware,
  soft actor-sized cutouts instead of whole-cart fading; source mask cached once,
  cutout texture refreshed only when actor-window positions change. Solid overlap
  still reveals actors. Actual seed8 artwork check showed alpha-only was insufficient.
- propTextures.ts caches a 64x64 mask with existing bounds readback.
- vendorStock.ts gives only saved vendor cargo a muted finish, fitted cloth and bowl
  mark. Footprint/material/HP unchanged; damaged holes remain exposed; wreck unchanged.
- storefront.ts adds boxed canopy ends, diagonal braces and tension ribs within
  existing awning footprint/hem. Matching side light planes use the same geometry.
- createCourtyard.ts integrates texture lifecycle and local cutouts.
- vendorCorner.test.ts: hollow vs solid masks, foreground/hidden actors, mirroring,
  narrow posts, padding and immutable semantic stock selection across seeds 0/7/8.
- 22 targeted tests passed; targeted lint and source typecheck passed.
- Published implementation at 93c700c7; not yet visually inspected. Open draft PR and inspect
  one exact-head visual CI run. No claim of a large visible gain until images.
- Preserve unrelated local work above. Do not push reconstructed local history.
