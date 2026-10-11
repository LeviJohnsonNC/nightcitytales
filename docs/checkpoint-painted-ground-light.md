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
