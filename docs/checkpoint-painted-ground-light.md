# Painted ground and lighting — 2026-10-11 UTC

Levi authorized one substantial coordinated pass toward the approved reference.
Active checkout ../city-block-ground-light, branch codex/painted-ground-light.
PR347 verified merged. Base origin/main eda4f4c (includes shopping PR348).
NEVER git push reconstructed history. Publish GitHub tree/commit/ref with expected head.
Do not merge. Recovery checkout dirty work preserved.

## Implemented, currently unverified visually

- Neutral generated 4m asphalt / slab atlas, source versioned WebP and importer.
- World wetness uses exposed carriageway union edges, not crosswalk/zone seams.
- Stronger wet/dry substrate distinction; same field feeds emitter reflections.
- Darker cool ambient, stronger warm market and lamp spill, cooler repair frontage.
- Reflection pictures less smeared; sparse wet-grain glints, no broad sheen haze.
- Softer procedural fractures under the painted ground.

## Review

First local seed8 pixels opened. Current material cache needs explicit fresh reload.
First focused tests: 44 pass, 1 reflection highlight bound failed; reduced highlight
strength to preserve existing bound (rerun pending). Original ground variant looked
blue/cloudy; neutralized grade before final review. No visual acceptance yet.
Next: fresh pixel review, relevant tests/type/lint/build, publish draft, paired CI.
Reference: ../generated_images/exec-8fe0a16b-631d-449b-b648-48a78e5c7071.png.

## Implementation review update

45 focused tests pass; typecheck, changed-file lint and build passed before the
final incident-highlight connection. Final checks pending. Incident highlights now
use existing incidentLight with all prop shadows and complete destruction state;
reflection sheen remains zero. No gameplay geometry or actor/overlay code changed.
Restart Vite after edits in this worktree: observed stale transformed modules despite
file changes. Explicit restart and fresh reload confirmed current palette in served JS.

## Published checkpoint

Draft PR350: https://github.com/LeviJohnsonNC/nightcitytales/pull/350
Remote head d089eff14b6865c5d4ff61b4d830002f84346db7.
Remote tree 54095da81bd19ec1400048b1baa5c3b9b1f70693; local code 3c53ae3.
45 focused tests pass, final typecheck passes, changed-file lint zero errors.
Production build passed before final type-only optional-property adjustment.
Actual final local seed8 play pixels inspected. CI and paired artifact review pending.
Avoid new coding unless final evidence reveals a concrete regression.

Final published code head: 7ecfb428977f5d902e94dac81fe8f65a8228bf04.
Tree c4c309e1ace5b42216c04230af0b2ee227852d29 exactly matches local 3c53ae3.
Source atlas upload needed segmented reads: shell output capped at 1 MiB silently
omitted bytes. Reuploaded complete atlas and verified its git blob and full tree hash.
CI38102480415; visual38102480425 pending. Local actual seed8 play/reveal and seed0
play/lights-off inspected. Reflection construction ~586ms and render180ms on local
seed0; cached, not per-frame. No ring/cutaway problems observed.

## Artifact-driven correction

Both jobs in visual38102480425 and standard CI38102480415 passed. ZIP checksums:
before525aed4e85ca94a5b2273c87bbdd8c52b16aec17ee0b23f655170b44d37a937a;
after9ae561905073fcf0062d080fe47d35ff8f4eddfce8fe15f90747fc909d6301f0.
Actual matched seed8 capture showed overly cloudy asphalt. Corrected with stronger
painted material response, finer/sharper wet edges and reduced blue substrate tint.
New full seed8 local pixels inspected: surface now reads as rough worn asphalt;
light pools and rings remain readable. Typecheck/lint and23 relevant tests passed.
Publishing this correction; final exact-head CI and artifact review required again.
