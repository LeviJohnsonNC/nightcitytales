# Night City Tales — resume here

Updated: 2026-10-08. Entrance-court / repair-corner revision in progress.

## Goal and baseline

Levi authorized the next revision after PR326. PR326 verified merged at
base d3d9cb178b4427d7fd63bd20cf96e28fedbcfd76.
Remote LeviJohnsonNC/nightcitytales; planned branch codex/entrance-court.
Local city-block-recovery branch codex/city-block-review has reconstructed history:
NEVER git push. Publish selected files through the GitHub connector.
Sources read-only. Preserve unrelated cityBlock.ts formatting, cityBlock.test.ts,
recovery docs. No production deployment or merge; Levi handles merge.

## Current implementation — publishing draft, not visually accepted

Recipe12 for new intersection seed8 only. The foreground roof is the housing
entrance annex (building_1), NOT the repair workshop. Cut its8m depth to4m;
retain its existing doorway and shift the attachment offset to fit the shorter wall.
The freed4x4m area becomes an entrance court with a protected2m approach and planter.
Replace the two repair-side striped stalls with a parts crate and generator,
retaining a planter and giving the equipment reserved handling/access positions.
Two shop-side stalls stay. Shared placement checks fit all new props.
V11 compact streets/parking remain. Existing saved scenes do not regenerate.
Actual pre-change v11 seed8 fixture saved before edits; v11 transform unit tests
now exercise that historical step independently. Current v12 tests cover the new
architecture/program, exact saves, deterministic/idempotent generation and access
before/after destruction. Compact viewport capture now includes seed8 as well as7.

Changed: engine/intersectionPrograms, sceneClusters, sceneComposer, sceneEnvironment;
engine tests entranceCourt, compactIntersection, pavementMarkets, repairLofts,
shopLamp, activityGroups, compositionVariation; fixtures/intersection-v11.json;
play commercialUpper and groundFinish tests;
composedEnvironment lane-paint version guard; e2e/city-block.spec.ts; this handoff.

## Validation and next action

Focused9 tests passed. Typecheck and targeted lint passed. Full local suite:
4111 passed/4 failed across326 files. Failures were historical cluster expectations
and an oil test assuming only one fixed-size generator stain. Updated expectations
for repair_power and checked generator stains separately from varied car stains.
Affected tests now pass (activityGroups, groundFinish, compositionVariation).
Publish draft PR from the merged base; GitHub CI and paired captures are next.
No visual improvement claim until the new screenshots are reviewed.

## Prior review — do not repeat

PR326 reviewed head71c5804; runtime7902127. CI37851605031 and captures37851604994
passed (4110 tests). All22 screenshots from ZIPs(6) verified and inspected in
../review-326-compact. Accepted narrower seed8 proportions; repeated stalls and
foreground roof remained weaknesses. Prior compact capture only coveredseed7.
Artifact URL host fails local DNS; user-provided ZIPs in Downloads work.
