# Night City Tales — resume here

Updated: 2026-10-08. Active milestone: night-market corner, after merged #321.

## Baseline and evidence

- Main/PR #321 merge: `0f1f739ecc91c376267e36804806637f349d1d23`.
- Lovable get_project verified that exact latest_commit_sha for project
  `2cad9dff-eecd-46d8-8b1f-749f46c6f3c6`.
- Verified preview: https://id-preview--2cad9dff-eecd-46d8-8b1f-749f46c6f3c6.lovable.app
- Preview seed 8 inspected with actors/night/reflections. New drain/manhole details
  are present; the public published site used in the earlier report was stale.
- Prior public-site screenshots are not evidence of the new corner implementation.
- #321 CI run 37818092825 passed 3/3 seeds on both revisions. Its archive download
  was policy-blocked; do not retry the same blocked route or bypass the restriction.

## Work in progress

- Remote branch: `codex/night-market-corner`, based on main above.
- Local checkout: `city-block-recovery`, reconstructed history. NEVER push its
  history. Publish only selected files through the GitHub connector.
- First edit batch published at `301952cf` on the remote task branch: shopFinish.ts, storefront.ts and nightLighting.ts.
- Shop windows gain recessed stock, shelf planes, fabric valances and an inset
  broth menu before glass and recess shadows, inside existing opening/cutaway clips.
- Investigation corrected the initial sign assumption: seeds 0–19 have NO vendor
  dressing sign; the composer omits it because the anchor overlaps reserved space.
  Abandoned freestanding-sign edits and their tests were reverted before publication.
- No recipe, saved geometry, cover, actor fade or per-frame changes.
  Existing window emission lights the display; no unrelated cyan fixtures retinted.
- Shop lamp radius 5→4.2m and intensity .9→.75 reduce the broad facade/pavement
  wash together. This is provisional tuning until matched screenshots are inspected.
- Typecheck, targeted ESLint and 14 lighting/fixture tests passed locally.
- Implementation is NOT visually accepted. Run typecheck, targeted tests and CI;
  inspect matched seed8 actors-on images before calling the corner complete.

## Preserved work and limits

- Preserve unrelated cityBlock.ts formatting, untracked cityBlock.test.ts,
  docs/city-block/, docs/evidence/city-block/ and old recovery checkpoint.
- sources/ is read-only. No publishing or merge has been performed.
- Local server previously failed listen EPERM. Do not retry unchanged.
- Levi reviews/merges PRs. Keep new PR draft until exact-head visual evidence.

## Next action

Open/inspect the draft PR on codex/night-market-corner. CI will capture exact before/after scene images using
#321's repaired harness. Resolve visual evidence access without bypassing policy.
