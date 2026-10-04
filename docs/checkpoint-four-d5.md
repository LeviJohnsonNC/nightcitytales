# Checkpoint 4D.5 — finish the shared presentation foundation

Based on merged 4D.4 (#270), with the subsequent #271 changes incorporated.
Levi's October 4 review confirmed stable environment switching. Review-save testing
was still pending when this pass began. His thirteen screenshots establish the
baseline; they do not establish acceptance of this new code.

## Findings resolved

- **Disconnected conference modules were a projection bug.** The furniture kit
  used a 32px rise against the battlefield's 30-degree projection. Every
  procedural prop now shares the correct projection; 90-degree instances are
  painted with a real coordinate rotation instead of reflecting a finished image.
  Conference tables, counters, racks and workbenches retain their saved footprints
  and now register consistently. No table/room/entrance relocation is required.
- **Cutaways retain architecture.** Opaque low perimeter walls, a subdued section
  pattern and closed entrance markers replace undifferentiated slabs. Markers
  come from saved entrances on all four edges. Full buildings remain available;
  their ground-floor window/display/vent bays, base courses and piers make the
  frontage readable. Raised industrial vents are distinct from real entrances.
  Doors use metre-scaled heights. All of this is surface presentation on existing
  solids, never new walkable rooms or collision.
- **Parking belongs to the curb.** Exterior parking clusters without an existing
  saved parking zone gain painted bay outlines derived from their actual cover
  sections. Residential's saved bay treatment remains authoritative.
- **Damage keeps scale and identity.** Procedural wrecks previously had their
  whole texture compressed, shrinking the ground footprint along with the object.
  They now keep the same registration and draw low vehicle shells, broken furniture,
  planter remains or collapsed equipment. Larger surface damage and broken glass
  improve damaged-state readability. Sedan windshields strengthen the joined car
  silhouette. Sections still have independent HP, hit targets and destruction.
- **Mac build compatibility.** Newly merged #271 had `OddsChip.tsx` beside
  `oddsChip.ts`. Extensionless imports resolve incorrectly on a case-insensitive
  filesystem. Rename the pure helper to `oddsPresentation.ts` and update its
  imports; no odds or check behavior changes.

## Preservation

This pass changes no recipes, scene versions, saved layouts, obstacles, routes,
actor positions, activity groups, combat rules or persistence protocols. The
accepted reference seeds and frozen older snapshots keep their geometry. Shared
rendering fixes also apply when those older scenes are loaded. Destroyed cover
remains walkable and is still painted below actors. Cut buildings remain permanent
movement/shot blockers, and facade doors remain closed.

No shader, lighting system, model call, database migration or new asset dependency
is introduced. The reference's remaining art work includes facade variety, specific
business identities, detailed silhouettes, material treatment and lighting.

## Verification

- **3,639 tests across 279 files pass**, including the current upstream suite.
- Typecheck and production build pass. Code lint has zero errors and the existing
  12 Fast Refresh warnings. Changed TypeScript files pass full ESLint.
- New tests compare canonical texture contact points to the independent battlefield
  projection across three scene sizes and both orientations. They verify exact
  conference seams, independent sedan destruction, stable registration and reload.
- Existing suites retain seed sweeps, access/circulation, legacy fixtures, damage,
  targeting and exact snapshot preservation checks.
- Actual procedural drawing functions were captured offline and inspected for
  conference runs and cars in both orientations and all three conditions.
- Offline composition drawings were inspected for all seven seed-4 environments.
  These use production ground/building/prop painters and saved geometry, but omit
  actors, interactive overlays, small dressing and threshold-frame sprites. They
  are component/composition evidence, **not Phaser browser screenshots**.
- Browser access to the deployed baseline and GitHub write access were verified
  before editing. Local Vite still fails to bind `127.0.0.1:8080` with `EPERM`.
  Consequently this revision has no live browser acceptance, pointer-targeting
  proof or campaign transaction proof. Tests do not replace that gate.

## Visual assessment and next review

The approved walls, arrivals and core activity groups remain a sensible foundation.
The drawing inspection supports retaining them while completing the facade/detail
asset pass. It does not justify declaring reference-image parity or guaranteeing
zero regressions. Low cutaways are an intentional tactical representation, not a
literal open-roof depiction of walkable interiors.

After deployment, use the same framing as the previous review:

1. Intersection seed 4, reveal on and off: parking, real entrances, facade identity
   and activity visibility. Check the cut footprint still reads as inaccessible.
2. Office seed 4 and Warehouse seed 5: connected table/counter sections and properly
   oriented shelves; no new gaps, reversed fronts or overlap with working aisles.
3. Residential seed 4, damaged and destroyed: recognizable differences at normal
   zoom, both car orientations, and footprint-sized low remains.
4. Alley seed 11, reveal on: saved entrance markers and visible service courts.
5. Brief pass/fail for all-seven switching and Save review → change seed → Load
   review (including damaged state). Report any changed room/prop/actor positions.
6. In a real encounter, move, select a target, destroy one cover section, reload
   and verify the same positions and damage. The read-only harness cannot prove
   this persistence transaction.

Screenshots are useful for items 1–4; the remaining checks only need a screenshot
if something fails. Levi retains final visual acceptance.
