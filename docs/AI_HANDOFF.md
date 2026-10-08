# Night City Tales — resume here

Updated: 2026-10-08. Compact seed-8 intersection prototype in progress.

## Goal and baseline

Levi authorized the next revision after merging PR325. Reduce the broad road field
and bring existing frontages closer in seed8, preserving access and vehicle room.
No new artwork or expansion to other seeds until the visual result is reviewed.
Base: merged PR325 dde30911a32290d851f2d79e70d54df3d46d2c91.
Remote: LeviJohnsonNC/nightcitytales. Publish branch: codex/compact-junction-prototype.
Local checkpoint branch: codex/city-block-review.
Local history is reconstructed: NEVER git push. Publish selected files via connector.

## Implementation — compact seed-8 prototype, not yet visually accepted

Recipe11 applies only to newly composed intersection seed8. Main street6m,
cross street4m, junction24m² instead of48m². Frontages translate by2m per axis;
buildings, cover dimensions, HP and structural heights remain unchanged.
All four parked cars consolidate on the east curb, leaving a4m travel lane.
Existing2m sidewalks and crossing routes remain clear. Saves load authoritative
stored geometry; an actual pre-change v10 seed8 scene is committed as a fixture.
Seeds0/7 and other current seeds remainv10; reference1–3 remainv5.

Changed: engine/intersectionPrograms, sceneComposer, sceneEnvironment;
engine tests compactIntersection, compositionVariation, repairLofts, shopLamp;
fixtures/intersection-v10.json; play test commercialUpper; composedEnvironment
lane paint follows the new travel reservation; this handoff.
Preserve unrelated cityBlock.ts formatting, cityBlock.test.ts and recovery docs.
Sources are read-only. No production publish or merge.

## Validation and next action

Focused suite23/24 initially passed. The sole failure was a historical checksum
using the snapshot reader, which reorders object keys. Hashing the recorded
fixture directly preserves the original checksum; shopLamp now4/4 passed.
The separate fixture-load test verifies semantic equality through the reader.
Compact tests4/4 passed: dimensions, clear parking/crossings, access intact and
all-destroyed, unchanged cover HP, exact save roundtrip and deterministic output.
Typecheck and targeted ESLint passed. Full local suite running at checkpoint.
Publishing these selected files as a draft PR from the merged base. Next: inspect
CI and matched seed8 screenshots plus control seeds0/7. No visual claim yet.

## Prior visual evidence and access

PR325 all22 PNGs reviewed at3501f5d, CI/captures passed. Qualified improvement;
wide road/roof fields still dominated. Evidence: ../review-325-market.
Do not repeat that review. New prototype requires new paired captures.
Artifact download connector returns URLs whose host local DNS cannot resolve;
user-provided ZIPs in Downloads work. Ask for new ZIPs only when needed.
