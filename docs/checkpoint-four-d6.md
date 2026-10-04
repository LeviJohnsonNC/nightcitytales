# Checkpoint 4D.6 — scale, registration and spatial ordering

Implemented and browser-reviewed on 2026-10-04. Ready for Levi's final visual and
campaign acceptance; automated tests do not close that gate.

## Why the previous fixes were insufficient

4D.5 corrected projection and rotation, but three independent rendering assumptions
still made correct saved footprints look intersecting or incorrectly sized:

- Actor and furniture heights used different pixel scales. Correct floor width
  alone could not make desks, racks, cars and people agree physically.
- A whole building or cutaway used one painter depth. Its centre could sort on the
  wrong side of a nearby car even when their saved footprints were disjoint.
- Atlas damage states were individually cropped and stretched. Different visible
  silhouettes then changed apparent size and ground contact during damage.

Changing walls or adding clutter would not resolve these shared causes.

## Changes

- Shared physical height calibration: 1.8 m person, 0.76 m desk and 1.45 m sedan;
  taller procedural canvases preserve rack tops without changing footprints.
- Full atlas cells with explicit per-state ground registration preserve scale
  through damage. Opaque artwork bounds, rather than canvas padding, drive fading.
- Footprint-based spatial ordering for structures, props and actors. Cutaway floors
  and short wall segments paint separately. Ordering updates when actors move or
  cover changes; destroyed ground remains below standing objects.
- Cutaways retain taller facade segments wherever sampled activity remains visible,
  including saved door markers. Activity sampling includes prop footprint corners.
  Taller retained pieces fade around actors; low boundary walls remain opaque.
- Overview framing fits projected ground and roof extents. Review controls and
  canvas height also adapt to narrow screens without forcing desktop overflow.

No engine rules, recipe versions, saved walls, entrances, activity placement,
collision, targeting facts, HP or frozen snapshot schemas change.

## Live visual audit

All 42 curated examples were inspected in the shared shipping renderer at
`/scene-review`. The pairs below compare functional arrangements; rotation and
loose clutter are not counted as variation. Six review examples do not imply six
unique functional layouts, especially for residential streets.

| Environment        | Curated seed pairs inspected | Meaningful distinctions and visual finding                                                                                                                            |
| ------------------ | ---------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Intersection       | 1/4, 2/12, 3/13              | Balanced, shallow and deep corner forms; shop/housing versus service-court programs. Overview now includes roofs and the complete street network.                     |
| Service alley      | 1/4, 2/11, 3/5               | Middle, south and north receiving pockets; delivery versus maintenance groups on opposed frontages. Working approaches remain legible.                                |
| Office             | 1/4, 2/8, 3/0                | Central spine, circulation loop and open core; parallel/opposed work pods and meeting groups. Desk/person height now agrees; entrances and aisles stay readable.      |
| Nightclub          | 1/7, 2/8, 3/0                | Central floor, long room and lounge/main-room plans; joined benches versus opposed tables. Public routes and staff work areas remain distinct.                        |
| Residential street | 1/0, 2/19, 3/4               | Setback, offset driveways and cross-axis frontage; nearby versus staggered arrivals. Footprint-corner reveal and segmented wall ordering correct car/facade overlaps. |
| Warehouse          | 1/4, 2/5, 3/7                | Receiving hall, side office and cross-aisle stockrooms; packing and rack approach groups. Rack height and loading access read coherently.                             |
| Garage             | 1/0, 2/33, 3/14              | Shared hall, two halls and street bays; paired versus staggered service work groups. Cars, mechanics, tools and bay routes share a believable scale.                  |

This pass found no reason to rearrange the accepted core layouts. The remaining
visible gap is predominantly facade/detail artwork, surface treatment and lighting.
That is an engineering assessment from these fixtures, not Levi's final reference
match approval or a guarantee about every generated seed. Segmented cutaways are
still a tactical visibility convention, and the atlas assets remain placeholders.

## Browser and preservation checks

- Repeated environment switching stayed stable throughout the 42-example review.
- Actors/access positions were inspected across all seven environments. In alley
  seed 5, selecting the lookout reported the freight-crate obstruction; finding a
  firing position and a keyboard ground selection produced movement/shot previews.
  Residential and intersection previews named sedan sections as blockers. Reveal
  on/off preserved the targeting blocker while changing visual obstruction.
- Review Save/Load restored all seven environments after switching environments or
  changing the seed: Intersection seed 4 damaged; the other six seed 4 destroyed.
  Positions, damage and frozen scene geometry remained in the restored review.
- Intact and damaged/destroyed props were inspected in live scenes. Procedural
  wrecks and atlas wrecks remain grounded rather than shrinking their canvases.
- At 390 × 844, review controls wrapped and the outdoor overview fit the available
  canvas. The temporary viewport override was reset after inspection.
- This is a static review harness: actual campaign move/fire transactions and real
  campaign save/load were not executed. Those remain in Levi's manual test below.

## Automated verification

3,817 tests across 289 files pass, along with typecheck, lint and production build.
New coverage checks physical scale, all procedural primitive bounds across both
rotations and three damage states, roof/ground framing, and ordering without cycles
for all 42 curated scenes with normal/access actors and full/revealed structures.
Existing composition, collision, targeting, destruction and snapshot tests remain.

## Browser evidence

These are unedited captures of the running shared renderer, not offline drawings.
Outdoor captures use Overview; interiors use Play area. The actors example uses
access positions. Screenshots are evidence for this review, not final visual signoff.

| Scene              | Capture                                                    |
| ------------------ | ---------------------------------------------------------- |
| Intersection 4     | [Overview](evidence/four-d6/intersection-4.jpg)            |
| Service alley 11   | [Overview](evidence/four-d6/alley-11.jpg)                  |
| Office 4           | [Furnished](evidence/four-d6/office-4.jpg)                 |
| Nightclub 7        | [Furnished](evidence/four-d6/nightclub-7.jpg)              |
| Residential 4      | [Overview](evidence/four-d6/residential-4.jpg)             |
| Warehouse 5        | [Furnished](evidence/four-d6/warehouse-5.jpg)              |
| Garage 33          | [Furnished](evidence/four-d6/garage-33.jpg)                |
| Garage with actors | [Access and targeting](evidence/four-d6/garage-actors.jpg) |

## Final manual return checklist

1. One full scene screenshot per environment with seed and framing controls visible;
   the evidence seeds above are a reproducible starting set.
2. A close-up of any clipping or wrong scale, including a nearby character and the
   same view with reveal off/on if a facade is involved.
3. One intact → damaged → destroyed comparison around a car, rack or service group.
4. In a real campaign, move through a doorway and around cover, then take a shot;
   report any disagreement between visible geometry and movement/targeting.
5. Save that campaign, reload it, and confirm positions, cover damage and layout
   remain unchanged. Send a before/after pair only if something differs.

Publication is based on remote main through PR #276. The recovered local history
is not published as remote ancestry; this checkpoint is a new commit on the current
remote base, preserving intervening merged work.
