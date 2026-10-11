# Service alley visual transfer

One environment pass, followed by Levi's in-app review. Warehouse remains deferred.

## What changed

- Materials, painted props and architectural art, night lighting, contact shade,
  per-light prop shadows and source-image reflections now also serve exterior alleys.
- Recipe v7 turns the low opposite frontage wing toward the lane. Taller blocks
  remain behind it, with the existing setbacks. Seeds 1–3 remain reference layouts;
  saved v6 scenes retain their stored geometry. No snapshot is regenerated.
- Saved entrance surrounds identify one warm workroom and cool receiving doors.
  Open-room art is a visual recess, not a new playable room or doorway. Full and
  retained wall sections use the same painter. Only emitted room/fixture pixels
  feed doorway reflections.
- An existing painted cabinet serves the receiving court. Its ordinary cover
  sections and damage states still belong to the engine. Delivery and waste/power
  groups and their access lanes remain intact.
- Utility lamps and loading indicators replace the intersection's signal masts
  and advertising kiosks. Lamp emission and the wall/shadow light agree on height.
- Handling strips use concrete; a deterministic drain field makes them drier than
  the lane except at collection points. Substrate darkening and reflection share
  that wetness field. No new image assets or external services were needed.

## Review

Use `/scene-review?place=alley&seed=4&actors=1&reveal=0` first, then seeds 11 and 5
(the rotated family). Inspect full view, reveal, intact/destroyed cover and compact
viewport. Check warm doorway depth, clear passage, prop contacts, reflection
placement and actors around freight. Night/lights/reflections controls are exposed
for alley diagnostics as they are for the intersection.

`e2e/service-alley.spec.ts` runs these states through the shipping renderer, checks
canvas/overlay alignment and saved-review restore, and keeps screenshots. Its
matching before/after workflow runs the identical harness on both PR revisions.
The pre-pass alley has no lighting controls; those captures are skipped on baseline.

Validation and exact revision are recorded in `AI_HANDOFF.md`. Automated passes do
not establish visual acceptance. The buildings still use a limited industrial kit;
this pass establishes a coherent service lane for in-app review.
