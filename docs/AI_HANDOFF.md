# Night City Tales — resume here

Updated: 2026-10-08. Compact seed-8 prototype published as draft PR326.
https://github.com/LeviJohnsonNC/nightcitytales/pull/326
Runtime revision: 7902127a03fa365a62efca794148e35f0978c196.

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
lane paint follows the new travel reservation; sedanPaint test sample; this handoff.
Preserve unrelated cityBlock.ts formatting, cityBlock.test.ts and recovery docs.
Sources are read-only. No production publish or merge.

## Validation and next action

Typecheck, targeted ESLint and diff whitespace checks passed. Full local run:
4111 passed, one failed (325 files, 58.55s). The remaining test sampled car-paint
variation using the old three layouts: the shifted seed8 positions now hash to
the same palette offset as0/7. Expanded that sample to40 current seeds; all9
sedanPaint tests pass. No runtime paint change or weakened per-street assertion.
Historical geometry checksum uses the raw v10 fixture to retain JSON key order;
its separate snapshot-read equality test proves unchanged saved geometry.
Compact tests4/4 pass: dimensions, clear parking/crossings, access intact and
all-destroyed, unchanged HP, exact save roundtrip and deterministic output.
Published runtime at7902127; this follow-up changes only tests and handoff.
CI/captures pending. Initial runs: CI37851476796, captures37851476756.
Next: inspect latest CI and matched seed8 screenshots plus controls0/7.
Keep PR draft until screenshots are reviewed; no visual acceptance yet.

## Prior visual evidence and access

PR325 all22 PNGs reviewed at3501f5d, CI/captures passed. Qualified improvement;
wide road/roof fields still dominated. Evidence: ../review-325-market.
Do not repeat that review. New prototype requires new paired captures.
Artifact download connector returns URLs whose host local DNS cannot resolve;
user-provided ZIPs in Downloads work. Ask for new ZIPs only when needed.
