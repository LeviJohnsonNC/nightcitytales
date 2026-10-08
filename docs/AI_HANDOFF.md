# Night City Tales — resume here

Updated: 2026-10-08. Repair frontage implemented; exact-head visual review pending.

## Active milestone

- Open, non-draft PR #323: https://github.com/LeviJohnsonNC/nightcitytales/pull/323
- Remote branch codex/vendor-corner-silhouette.
- Base #322 merge: 08ff5c7c4cf7fc7ac1b0bf154b40e6aa8def52c4.
- Head: abe0d9c62e58bb8f0d0f8e2b61560e7e4b25eb95.
- Full CI run 37827536149 PASSED.
- Visual run 37827536195: after job 113484135125 PASSED all 3 seeds in 3.5m;
  before job 113484135518 PASSED all 3 seeds in 4.7m.
- Before artifact 11572651519 (SHA256 e137d0083f8753782f7a30c84c00d1e7cd148d53ec3fa847734a41b0d72e4747).
- After artifact 11571444074 (SHA256 2f0c655b13b41871751b4dce91e433f81cabd51de1e71ca36f3c27f395fe0cf1).
- All six seed8 captures completed; ready ~34.5s; capture durations ~2.7–4.3s.
- 22 targeted tests, lint and final typecheck passed locally. Local commit 014c7a9.
- User ZIP hashes match CI artifacts; all 22 PNGs inspected. Accepted vendor change.
- #323 merged, verified: 71fc4ebee94f068cbef6f94d9baa38a18860e769.

## What changed

- cartOcclusion.ts/sceneryOcclusion.ts: actual opaque overlap triggers small soft
  actor-sized cutouts, not whole-cart alpha .4. Empty gaps, narrow posts, foreground
  actors and invisible actors do not trigger cutouts; mirrored art maps correctly.
- Actual seed8 artwork sampling showed a worker really overlaps the canopy, so an
  alpha check alone would not solve the ghost cart. The local window is necessary.
- propTextures.ts caches 64x64 alpha masks with its existing bounds readback.
- createCourtyard.ts keeps an independent cutout texture per cart. Refresh only
  when actor windows change; no readbacks in frame loop. Damage uses original source.
- vendorStock.ts: only saved vendor_stall cargo gets a muted finish, fitted cloth
  and bowl mark. Steel footprint/material/HP/registration unchanged. Damaged holes
  stay exposed; wrecked art unchanged. Existing fabric asset reused.
- storefront.ts: boxed canopy ends, diagonal braces and tension ribs within its
  current footprint/hem; light uses the same side planes.
- vendorCorner.test.ts covers gaps, solids, mirrored cutouts, hidden/front actors,
  narrow posts, padding and immutable semantic vendor selection in seeds 0/7/8.
- No saved recipes, pathfinding, shot geometry or combat rules changed.

## Previous review

#322 merged. All 22 exact-head PNGs reviewed; no new blocking regression, but only
modest lighting improvement. Window detail hidden behind awning; large visual goal
NOT achieved. Existing floating Reveal markers still need separate diagnosis.
Current goal: visibly solid cart, coherent stock and constructed canopy at play zoom.
#322 archives matched CI hashes. Original files in /Users/levijohnson/Downloads/
city-block-before.zip and city-block-after.zip. They are OLD evidence for #323.
Extracted old images in ../review-322/{before,after}; seed8 copies in
docs/evidence/night-market-corner/seed8-{before,after}-ci.png.

## Access and preservation

Local checkout city-block-recovery has reconstructed history. NEVER push it.
Publish selected files via GitHub connector only. Source branch is already published.
Preserve unrelated cityBlock.ts formatting, untracked cityBlock.test.ts,
docs/city-block/, docs/evidence/city-block/ and recovery checkpoint. sources/ read-only.
Local server listen failed EPERM; shell downloads fail DNS. Do not retry unchanged
or bypass restrictions. User-provided ZIPs were available in ~/Downloads and could
be read locally after exact SHA256 validation, resolving the prior review blocker.
Current handoff update is local to avoid restarting passed PR checks.

## Visual review and next action

All 11 before/after pairs inspected: seed8 play/lights-off/neutral/destroyed/restored/
reveal, seed7 play/reveal/compact, seed0 play/reveal. Cart stays solid around visible
worker; stock cloth aligns on lid. Awning improvement subtler. No blocking vendor
regression found; destruction/restoration look intact. Intermediate damaged state
is not separately captured. Stock silhouette remains bulky; larger visual goal open.
Floating markers appear in some after captures (seed0 Reveal, seed8 destroyed/Reveal).
This was previously recorded; static run differences do not establish its cause.
PR body contains detailed verdict. No code changed or CI rerun during this review.
Exact seed8 play evidence: docs/evidence/vendor-corner-323/seed8-{before,after}.png.
All extracted images: ../review-323/{before,after}; source Downloads ZIPs have (1).

## Active repair-frontage milestone

- Base: #323 merge 71fc4ebee94f068cbef6f94d9baa38a18860e769.
- Remote branch: codex/repair-frontage-identity.
- repairFront.ts: warm ribbed aprons, framed window bays/door jambs and a broad
  DENKI / ELECTRIC REPAIR enamel sign fitted to existing solid workshop walls.
- Saved sheds are only 2.5–3m high: signs sit below glazing, not over windows.
- frontageIdentity.ts integrates within existing exposed-face and cutaway clips.
- Cached albedo only; no new light sources, assets, per-frame work or saved geometry.
- repairFront.test.ts verifies opening/door clearance and bounds across seeds0/7/8/19,
  short legacy walls, non-workshop exclusion and no saved scene mutation.
- 25 focused tests, targeted lint and final typecheck passed. No visual acceptance yet.
- Publish only these three source/test files and this handoff. Keep PR draft until
  exact-head full CI and before/after screenshots are reviewed.
- Previous 323 evidence does NOT validate this change. No reference-quality claim.
- Next: check new PR CI once, inspect matched seed8/7/0 captures and cutaways. Confirm
  lettering reads, panel repetition is restrained, and walls/windows remain intact.
  Fresh-chat prompt: Read docs/AI_HANDOFF.md, verify the repair-frontage PR and its
  exact-head CI, then finish visual review before expanding street-detail work.
