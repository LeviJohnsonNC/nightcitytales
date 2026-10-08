# Night City Tales — resume here

Updated: 2026-10-08. Stepped repair-row composition implemented; visual gate open.

## Current milestone

- Base: merged #324 f9d571c70ee5df3c3144fb09f068db972d95d795 (verified).
- Remote branch: codex/stepped-repair-row.
- Goal: change a large roof-dominated corner into a stepped, occupied street wall.
- Recipe v9 partitions building_3's existing 22x10m parcel into its original 2.5m
  repair frontage (4m deep), then two rear blocks at 7.2m and 10.2m.
- Rear blocks use existing shop/commercial-upper facade, materials, room windows,
  lighting and automatic/manual cutaway rendering. No new renderer or assets.
- North and transposed west frontages supported. No overlap or new occupied ground.
- Entrances, sidewalks, props, customer space and the service court stay in place.
- Upper floors remain inaccessible scenery like the existing commercial row.
- Only newly composed refined intersections get v9. Reference seeds1/2/3 stay v5;
  saved v8 layouts load exactly as recorded, without regeneration.

## Changed files and validation

- src/engine/intersectionPrograms.ts: addRepairLofts, called once after orientation.
- src/engine/sceneComposer.ts: v9 recipe and composition hook.
- src/engine/sceneEnvironment.ts: admit recipe9 while retaining old versions.
- New repairLofts.test.ts and actual pre-change fixtures/intersection-v8.json.
- shopLamp.test.ts normalizes the new partition back to its old parcel for the
  historical geometry checksum; separate new tests verify the partition itself.
- commercialUpper.test.ts expects current recipe9; old-height loading check retained.
- 30 focused tests passed across six files, including 40-seed partition/orientation,
  historical layout checksums, pedestrian connectivity, v8 preservation and roundtrip.
- Targeted lint and final typecheck passed. No visual acceptance yet.
- Initial test caught north->west transpose; helper now handles actual west frontage.

## Visual acceptance gate

Draft PR next. Use one exact-head full CI plus before/after visual run, unchanged
harness and budgets. Inspect seed8 normal play first: rear rooms should visibly
replace a broad roof field while low repair frontage and the street remain clear.
Check seed0 rotated frontage, seed7 foreground occlusion, lights-off/neutral,
destroyed/restored, Reveal and compact. Reject if new tall blocks mask the action,
float over cutaways, produce blank upper walls, or simply replace one broad field
with another. Composition gain is a hypothesis until those images are inspected.
No claim of reference parity or additional ground-level market activity.

## Previous review

#324 all22 PNGs reviewed from hash-verified user ZIPs. Modest sign/frame gain,
no new blocking regression. Merged by Levi. Broad road/roof fields still dominate.
PR body has the verdict and ZIP links. Evidence docs/evidence/repair-frontage-324/.
#323 cart opacity and vendor finish accepted; evidence docs/evidence/vendor-corner-323/.
Floating actor markers occur in before/after runs; unresolved, not attributed to
these visual changes. Do not silently mix a marker repair into this milestone.

## Access and preservation

Local checkout city-block-recovery has reconstructed history; NEVER push it.
Publish selected files via GitHub connector only. Preserve unrelated cityBlock.ts
formatting, untracked cityBlock.test.ts, docs/city-block/, docs/evidence/city-block/
and recovery checkpoint. Sources remain reference material.
Local server previously failed listen EPERM. Artifact downloads were blocked;
user ZIPs in ~/Downloads resolved access. Validate hashes before extracting.
PR324 ZIPs have (3), extracted ../review-324/{before,after}; old captures cannot
validate the new recipe. Keep final CI pointers local to avoid restarting checks.

## Next action

Publish selected files and open draft PR. Record exact head, then check its CI.
After captures finish, put artifact links directly in the PR body and ask Levi
for the ZIPs if direct access remains unavailable. No merge or production publish.
Fresh-chat prompt: Read docs/AI_HANDOFF.md, verify the stepped repair-row PR,
and finish exact-head visual review before expanding the composition milestone.
