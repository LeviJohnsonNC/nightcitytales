# Night City Tales — resume here

Updated: 2026-10-08. PR325 pavement-market revision implemented locally; validation running.

## Goal and state

PR325 https://github.com/LeviJohnsonNC/nightcitytales/pull/325 remains draft.
Remote branch codex/stepped-repair-row; latest published head 4cc278e43a0d2605ad2910c891d167c54eabfaf3.
Base merged324 f9d571c70ee5df3c3144fb09f068db972d95d795.
Prior CI fix and both capture jobs are green. Reviewed all22 prior captures from
hash-verified ZIPs in ../review-325. No new blocking regression, but composition
acceptance FAILED: added loft heights mostly fall outside the right edge.
Full previous review and artifact links are in PR body.

## Current revision

Recipe10 adds three covered counters in review seeds8/0/7, using existing
shop-display art and real destructible25HP steel cover. Shop row plus repair
forecourt use shared placeSceneClusters legality/access checks. Up to two counters
per zone; illegal candidates are skipped. Existing doors, actors, buildings,
through-walks and crossings remain. Small lamp-base exclusions keep posts clear.
Counter browsing lanes persist in saves. Recipe5 reference seeds stay unchanged;
older snapshots load stored geometry rather than regenerating.
Seed8 shop counter at8,4 is beside the entrance; another at8,0; repair counter24,22.
Seed0 counters4,8 /2,8 /24,24. Seed7 counters22,12 /22,10 /24,24.
V9 stepped repair buildings are retained in this revision.

Changed: intersectionPrograms.ts, sceneClusters.ts, sceneComposer.ts,
sceneEnvironment.ts; new pavementMarkets.test.ts; updated repairLofts,
shopLamp historical normalization and commercialUpper expected revision.
Tests preserve prior-layout assertions after removing only added market entries.

## Validation and next action

Local commands became unusually slow. Avoid launching duplicate runners.
Focused tests and typecheck underway; logs /tmp/pr325-direct-tests.log,
/tmp/pr325-market-tests.log, /tmp/pr325-market-types.log.
Need inspect results, targeted lint, then publish selected files atomically via
GitHub connector onto the existing PR. Capture new visuals; old ZIPs cannot
validate the counters. Do not mark ready or merge before inspection.

## Workspace rules

Local city-block-recovery history is reconstructed: NEVER git push it.
Publish selected files with connector only; normal local commits are checkpoints.
Preserve unrelated cityBlock.ts formatting, cityBlock.test.ts and recovery docs.
Sources are read-only. Levi handles merge. No production publish.
Existing detached actor rings recur in before/after captures; outside this change.
Fresh-chat prompt: Read this file, finish validation/publish of PR325 market rows,
then inspect exact-runtime captures before another composition experiment.
