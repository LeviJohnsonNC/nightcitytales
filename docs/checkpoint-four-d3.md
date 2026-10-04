# Checkpoint 4D.3 — seven-environment audit

Status: implementation ready for deployed review; **not user visual acceptance**.
Baseline: merged 4D.2, PR #268 (`6892b0a`). Browser and GitHub write access
were verified before implementation; the working branch was created from that
merge. The recovered local checkout had an identical source tree.

## Visual findings

All 42 curated furnished examples below were inspected in the shipping renderer
on 2026-10-04. Intersection was inspected on the public 4D.1 deployment (its
composition is unchanged in 4D.2); the other six used the Lovable preview with
recipe-v5 transferred choices. These are observations of **4D.2**, not screenshots
of the new code. No fresh reference image was present in this task; the reference
intent and prior critique in 4D.2 informed this assessment.

| Environment  | Inspected seeds, reference/alternative pairs | Assessment and remaining weakness                                                                                                                                                                                                                                      |
| ------------ | -------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Intersection | 1/4, 2/12, 3/13                              | Corner uses, vendor frontage and service programs exchange coherently; protected crossings and continuous walks remain legible. Foreground building mass conceals useful frontage. Plain roofs/facades dominate the image.                                             |
| Alley        | 1/4, 2/11, 3/5                               | Delivery and maintenance groups change working side/approach, not merely clutter. Through-route remains clear. Foreground structures hide near-side work and make some changes hard to perceive.                                                                       |
| Residential  | 1/0, 2/19, 3/4                               | Repeated unit doors, private walks, curb bays and driveway spacing read as housing. Four genuine compositions, not six after excluding whole-map rotation. Subtle driveway differences are partly concealed by foreground buildings.                                   |
| Office       | 1/4, 2/8, 3/0                                | Spine, loop and open-core circulation survive parallel/opposed work-pod choices. Four/eight workstations retain usable approaches. Empty support floor is sometimes visually austere; do not fill reserved access with decorative desks.                               |
| Warehouse    | 1/4, 2/5, 3/7                                | Three room structures with rack groups changing aisle direction provide six functional combinations. Rack capacity and freight paths persist. Some alternatives look modest at overview scale; packing/support space needs material and prop identity, not a new maze. |
| Garage       | 1/0, 2/33, 3/14                              | Complete paired/staggered service bays change approach lengths and vehicle arrangement; tool/parts support stays attached to work. Loading route remains intelligible. Floor markings and recognizable equipment art are the major remaining readability need.         |
| Nightclub    | 1/7, 2/8, 3/0                                | Admission, dance/DJ, bar/service and lounge remain distinct. Joined benches versus opposed seats change social grouping within three structural plans. Large dark surfaces need finish, light and facade/detail work.                                                  |

The audit did not identify a reason to relocate accepted walls, entrances or core
activity groups. It did identify a presentation problem that artwork alone would
not solve: tall foreground buildings hide authored activity. Six choices within
one place should not be sold as six wholly different floor plans. Interiors have
three structural plans with paired functional furniture choices; residential has
four compositions. Rotation and scattered decoration are excluded from that claim.

## Changes

- Shared scenic rendering now offers **Reveal activity behind buildings**, enabled
  by default for composed exteriors. It fades only structures whose projected
  volume hides saved entrances, cover-group centres or reserved walking ground.
  Full architecture remains available with the eye control. Structure-only review
  remains opaque. Existing actor occlusion handling continues separately.
- Occlusion derives from the saved footprint and visual height using the fixed
  isometric camera direction, not the whole sprite bounding box. It is presentation
  state: no walls, entrances, props, floor reservations, HP or collision geometry
  change. Legacy arenas and interiors do not receive this treatment.
- Review URLs carry `reveal=0/1`, shared between scenery and tactical views.
- Renderer destruction explicitly releases its WebGL context after Phaser finishes
  cleanup. Repeated environment switches occasionally produced blank scenery in
  the baseline browser audit; unreleased contexts are a plausible contributor,
  **not a proven diagnosis**. Scenery review now provides a Retry scenery action
  without regenerating the saved scene. Tactical mode retains its diagram fallback.

There is no new recipe, snapshot version, engine rule, persistence schema, combat
branch, prompt or facade asset. Accepted seeds and frozen older saves retain their
geometry exactly.

## Preservation evidence

Browser checks used real target controls and damaged/destroyed cover states across
all seven places. Alternatives checked were intersection 4, alley 4, residential
0, office 0, warehouse 5, garage 33 and nightclub 8. Each was saved, changed to seed
1 and loaded again; selected frozen seeds and sorted target labels/positions were
restored. Office also survived a full page reload before Load review. Permanent
interior walls still reported blocked sight lines, including the office supervisor
and nightclub security target. These are inspect-only review fixtures: no campaign
attack, movement submission or database transaction was performed.

The existing variation suites exercise seeds 0–63 and integer extremes, route
preservation under damage, functional capacity and exact legacy fixtures. New
regressions check projected occlusion direction/height/corner cases and all curated
examples, including unchanged movement/shot obstacles and JSON round-trip results.

- Full suite: **3,551 tests passed, 270 files** (4D.2: 3,548).
- Typecheck and production build passed. Code lint passed with 12 existing
  Fast Refresh warnings and no errors; changed source files were formatted.
- Automated results establish regression coverage, not visual acceptance.

## Remaining deployed/manual gate

Local Vite could not bind a port (`EPERM`); terminal network access was unavailable.
The browser could inspect the existing remote preview, but not this branch's new
rendering. Its viewport override also left the actual page at 1286px, so a fresh
390px pass is pending. Do not describe the new opacity or cleanup as visually
verified until the branch is deployed.

1. Open `/scene-review` on the deployed branch. Compare each curated pair above
   furnished, structure-only, intact, damaged and destroyed. Check foreground
   entrance/work visibility with the eye control on and off; adjust opacity if
   buildings become confusing ghosts or still conceal important work.
2. Switch repeatedly between all seven places and between scenery/tactical views.
   Confirm art loads reliably and Retry scenery recovers an actual failure.
3. At desktop and a real 390px viewport, inspect actor/cover selection, camera
   controls, entrance readability and target readouts. Faded buildings must still
   block movement/shots; mesh fences remain movement-only obstacles.
4. In a persistent campaign, move, attack and destroy cover; leave/re-enter and
   reload. Verify frozen layout, actor positions, HP and destroyed-cover state.
   The review save slot is not evidence of campaign transaction correctness.
5. Levi performs final visual acceptance. The current evidence supports an artwork,
   facade/detail and lighting pass after the visibility fix is accepted; it does
   not close 4D or promise reference parity before that review.
