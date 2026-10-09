# Night City Tales — resume here

Updated: 2026-10-09. Occupied-frontage follow-up to open PR328.
https://github.com/LeviJohnsonNC/nightcitytales/pull/328
Publication parent eca4f7ccab0428ca5f87f431474bdee5542b282f.
PR328 verified still open/unmerged; extend it rather than create a dependent PR.

## Authorization and workflow

Levi approved the complete repair frontage plan after reviewing the v13 captures:
workshop, occupied upper floors, visible passage, equipment integration and lights.
Remote LeviJohnsonNC/nightcitytales; branch codex/occupied-corner.
Local city-block-recovery has reconstructed history: NEVER git push.
Publish selected files via GitHub connector. Levi handles merges/deployment.
Preserve unrelated cityBlock.ts formatting, cityBlock.test.ts and recovery docs.

## Implementation

V13 geometry from PR328 is unchanged. Occupied uses are selected from existing
retail-header and repair-studios-portal attachments on tall shop buildings.
New occupiedFrontage renderer adds DENKI fascia on both faces, shallow workbench
and tool displays, a partly raised shutter above the saved door, wall lighting,
first-floor balcony/cloth/plants and a lit studio portal with overhead conduits.
Workshop lighting reaches the existing equipment and passage. Reflect only the
emitters, not wall washes. Generic services paint before the new frontage so an
AC unit cannot obscure its sign. Same painters retain clipping in Reveal views.
Existing artwork is reused for the studio doorway; no new generated assets.
Control seeds and older v12 saves retain their treatments. Geometry/cover/rules
are untouched. Future bespoke workshop art could add richness to the drawn tools.

## Verified and remaining

Full local suite: 4120 tests/328 files passed; includes two untracked tests not
published. Typecheck and changed-file ESLint passed; focused34 tests passed.
Live Chrome review completed: normal, neutral, Reveal, compact normal, destroyed
and restored. No new blocking issue observed. Local screenshots are checkpointed
under docs/evidence/occupied-frontage; different viewport from CI, not paired proof.
Playwright local launcher unavailable (bundled browser missing; installed Chrome
exited at launch). Browser extension preview worked at localhost5174.
Vite did not refresh cached transforms reliably: restart server after edits.
Detached/doubled actor rings were NOT reproduced. DOM contained one ellipse per
actor, with correct world-anchor transforms. No speculative marker code change;
this issue remains unresolved and must be watched in fresh CI captures.
Publish this follow-up, record new head/runs, then review exact-head CI artifacts.
Do not describe old green CI as covering the new head; no merge yet.

## Prior evidence

Original PR328 after ZIP inspected for design only: new massing improved enclosure
but dark ground floor lost repair identity. PR327 captures used as older baseline.
PR327 head01b6a526773fe2b45ae536b7b652d5bf90c7ec1e accepted incremental improvement;
CI37853513719 and captures37853513684 passed. All24 PNGs reviewed previously.
Artifact URL host fails local DNS; user-provided ZIPs in Downloads work.
