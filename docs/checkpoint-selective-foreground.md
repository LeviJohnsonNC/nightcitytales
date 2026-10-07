# Selective foreground visibility

Based on merged #310 and main `c893c7f7da27052a4fbf65aafbf4693612bb4d57`.

## Change

Finished intersection buildings no longer fade because their rectangular image
bounds happen to overlap a character. Saved building geometry determines whether
the camera ray to a visible character or valid route crosses the building. The
existing activity-occluder set supplies the buildings with cutaway variants.
Unobstructed buildings stay completely opaque.

When a building obstructs the current action, its roof is removed. Camera-facing
wall sections keep their full height where clear and become opaque 0.65 m wall
stubs where they cross the action; rear edges remain low. Sections reuse the
existing cutaway geometry and cache crops from the finished facade and lighting
canvases. Awnings follow their supporting span. The blade sign is removed with the
full building. Cancelling a route restores the complete building when no actor
requires a cutaway. Hidden/withdrawn actors do not hold cutaways open.

Only visibility changes during movement; no canvas is repainted. Hidden sections
skip the old overlap/fade loop. Visibility and scenery sorting invalidate when
the protected positions or reveal mode change. Additional cached section textures
increase construction cost and memory; hardware performance has not been
benchmarked in this pass.

Manual reveal retains its existing broader activity cutaway. Diagram view,
other environments, targeting, movement, saves, scene recipes and collision
geometry retain their existing rules. Reflections remain off by default.

## Browser evidence

Checked in the existing connected Chrome, 682 × 660 viewport, normal play camera.
Seeds 0, 7 and 8 retain opaque foreground buildings and readable actors. Seed 7's
rifleman remains a clear 21 m / DV20 target; seed 0 remains 20 m / DV20.
Lights-off has no baked emission; manual reveal still removes roofs/upper walls.
Seed 0 Save review → Load review reports frozen geometry (not regenerated) and
restored positions/damage. This is a fixture round trip, not a campaign write.

Seed 7 with access positions enabled supplies the route check: a reachable
5.5-square / 11 m preview behind the shop opens its roof while retaining clear
facade sections. Escape restores the complete building. The no-shot readout stays
blocked by the cruiser's cabin/doors. The preview tooltip obscures part of that
capture, so it is evidence of behavior rather than a beauty shot.

- [Before: PR310 seed 7](evidence/urban-frontage/seed7-play-after.jpg)
- [Seed 7 normal play](evidence/selective-foreground/seed7-play.jpg)
- [Seed 7 route preview](evidence/selective-foreground/seed7-route.jpg)
- [Lights off](evidence/selective-foreground/seed7-lights-off.jpg)
- [Manual reveal](evidence/selective-foreground/seed7-reveal.jpg)
- [Seed 0](evidence/selective-foreground/seed0-play.jpg)
- [Seed 8](evidence/selective-foreground/seed8-play.jpg)

## Validation and limits

Bun suite: 317 files / 4,071 tests pass. Typecheck and production build pass.
Repository lint passes with 13 existing warnings. Geometry tests cover false
bounding-box overlaps, silhouette margins, retained/removed sections, the middle
of a long route and unchanged save/movement/shot data.

This restores architectural weight lost to whole-building fading. It does not
claim reference parity: section transitions are discrete, the cutaway exposes a
schematic closed footprint, and the street still needs the planned frontage and
surface finish. No deployed campaign transaction was exercised.
