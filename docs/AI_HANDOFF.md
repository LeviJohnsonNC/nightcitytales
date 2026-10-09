# Night City Tales — resume here

Updated: 2026-10-09. Occupied-corner revision in progress; not visually accepted.

## Authorization and baseline

Levi requested a larger composition change after PR327 merged.
Verified main base c7055e5468a65085a80ce3b5795f32d084eb146e.
Remote LeviJohnsonNC/nightcitytales; planned branch codex/occupied-corner.
Local city-block-recovery branch codex/city-block-review has reconstructed history:
NEVER git push. Publish selected files through the GitHub connector.
Preserve unrelated cityBlock.ts formatting, cityBlock.test.ts and recovery docs.
No production deployment or merge; Levi handles merge.

## Current implementation

Recipe13 for new intersection seed8 only. Replace the broad low repair shed with
a 6x6m two-storey shop, 6x6m taller rear studios and low bays across a 4m passage.
Bring the shop frontage 2m closer to both streets. Passage lies at x28..32,
y22..34; its playable area connects through a protected mouth to the cross street.
Relocate the shop entrance and add a passage-facing studios entrance/portal.
Keep the v12 court, props, cover and actors. Reuse commercial upper-storey art.
Actual pre-change v12 scene is recorded in fixtures/intersection-v12.json.
Historical court/loft tests retain their original programs; new tests cover
save compatibility, topology, overlap, routes, determinism and idempotence.
Add a seed8 compact normal-play canvas capture after existing compact Reveal.
Control seeds0/7 remain recipe10; existing saves do not regenerate.

## Validation and next action

Implementation complete. Full suite: 4118 tests across327 files; six failures
were resolved (historical snapshot normalization, new attachment count, passage
in pedestrian network, housing-portal-specific annex art). All34 affected tests
now pass. Remaining4112 passed in the full run. Typecheck and changed-file lint
passed; final changed-file checks before publication. Local total includes two
untracked cityBlock tests excluded from this PR. Publish draft from verified base.
Record exact head/runs locally after publication.
Then review fresh paired captures before claiming a visual improvement.
Include normal, neutral lights, Reveal, damaged/restored and compact normal play.
Artifact URL host fails local DNS; user-provided ZIPs in Downloads work.
Verify ZIP hashes against exact-head Actions artifacts before inspecting images.

## Completed prior review — do not repeat

PR327 head01b6a526773fe2b45ae536b7b652d5bf90c7ec1e accepted incremental improvement.
CI37853513719 passed: 4113 tests/325 files, lint, format, types and migrations.
Captures37853513684 passed; all24 PNGs inspected at ../review-327-court.
Court opens foreground; repair equipment breaks repeated stalls but is bulky.
No new blocking lighting/reveal/damage/restoration issue; controls0/7 unchanged.
Detached actor rings recur in before/after. Broad roofs and sparse activity remain.
Previous compact captures were Reveal mode and partly cropped the court.
PR327 verified merged; this larger revision follows it.
