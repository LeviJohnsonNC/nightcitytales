# Environment consistency review — 2026-10-11

All seven initial material passes are approved. This pass audits the shared
presentation at normal play zoom, reveal, destruction and compact width.
Baseline: db1373f4; local Chromium 9 tests passed (3.9m), using intersection8,
alley4, warehouse4, garage4, office4/8, nightclub4/8 and residential4.
Baseline captures: `/tmp/nct-consistency-before-captures`.

## Ranked findings

1. **Compact labels collide with camera controls.** Long exterior names run under
   buttons at 700px. Fixed by a shared flex header: label truncates when necessary,
   controls keep their width, and phone layouts stack controls over the caption.
   Automated bounds checks now cover all seven and explicit 390px phone captures.
2. **Residential drives are painted as planting at the pavement edge.** Saved
   frontage strips overlay driveways. The same order erases the concrete reflection
   response. Three seeded regression cases reproduced it. Fixed by painting drives
   after planting in both albedo and material mask, before saved entry paths.
   No saved geometry or movement changes.
3. **Waiting-seat variants omit cast shadows.** Office lounge seats have contact
   shading but were absent from the per-light caster table. Added narrow body
   footprints for both facing variants, with low wreck heights; rotation and damage
   covered by tests. Light-off behavior remains the shared pipeline's behavior.
4. **Art variety remains uneven.** Detailed exterior assets sit beside simpler
   procedural furniture. Bar/reception wrecks are particularly generic. Residential
   doors and large wall/roof runs repeat. These need a focused art pass, not more
   unrelated small details; deferred from this corrective milestone.

No detached actor rings or new gross intersections were observed in the sampled
play captures. That is a sampled visual review, not proof for every seed/camera.
Nightclub colored pools, office warm/cool zoning and industrial work areas retain
their approved appearance. Exterior reflections remain selective near sources.

## Remaining acceptance

Final after screenshots and validation are pending. User will test later; do not
merge automatically. A real campaign enter/move/damage/reload/finish remains a
separate deployed-flow check; review fixtures do not verify persistence end to end.
