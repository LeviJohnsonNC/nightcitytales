# Checkpoint 4D.2 — variation across the remaining environments

Implemented; visual acceptance remains open. This transfers the independent seeded
choices from 4D.1 to Alley, Residential, Warehouse, Garage and Nightclub. It uses
the same cluster placement, saved geometry, renderer and combat machinery.

## What changes

| Environment | Independent program choice                                                                                                                       | What remains protected                                                                                                                       |
| ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------- |
| Alley       | West deliveries/east maintenance, or east deliveries/west maintenance, beside the existing receiving pocket                                      | Two whole delivery groups, two maintenance groups, five entrances and the four-metre through passage                                         |
| Residential | Near-aligned driveways, or an east driveway four metres farther along the street with its buildings, door rhythm, car and courier moved together | Nine entrances spaced at least four metres within each frontage, two domestic groups, four cars, curb bays, sidewalks and centre travel lane |
| Warehouse   | Crosswise or lengthwise rack pairs and picking aisles; the side-office plan relocates one pair away from the office door                         | Rack capacity, loading access, receiving stock and the freight spine                                                                         |
| Garage      | Paired or staggered complete service bays, with approaches authored for each arrangement                                                         | Two cars, their tools/parts, engine/side working space and connected vehicle routes                                                          |
| Nightclub   | Joined benches or opposed conversation groups independent of floorplan                                                                           | Seating capacity, at least two complete lounge groups, admissions, DJ setup, bar and staff arrangements, public circulation                  |

Each environment exposes six family/program combinations. Geometry-based tests
find six distinct functional compositions for Alley, Warehouse, Garage and
Nightclub. Residential has **four** after removing whole-scene transpose: its
third family is an orientation of the first, not an additional floorplan.
These are bounded authored combinations, not arbitrary procedural architecture.
Interior wall/door floorplans retain their three accepted organizations.

Seeds 1–3 preserve the accepted geometry exactly. New generation uses recipe v5
with saved choice provenance; old snapshots load their resolved geometry unchanged.
The five new environments require their alternatives to fit; no retry silently
replaces a failed alternative or removes a required group. The existing typed
Office fallback remains unchanged. No SQL migration, new artwork, lighting system,
renderer branch or walkable elevation is introduced.

## Review pairs

Use `/scene-review`; each environment now includes these pairs in the Variation
selector. The first seed is the accepted reference, the second its alternative in
the same family. Custom seeds and shareable view URLs remain available.

| Environment | Family 1 | Family 2 | Family 3 |
| ----------- | -------- | -------- | -------- |
| Alley       | 1 / 4    | 2 / 11   | 3 / 5    |
| Residential | 1 / 0    | 2 / 19   | 3 / 4    |
| Warehouse   | 1 / 4    | 2 / 5    | 3 / 7    |
| Garage      | 1 / 0    | 2 / 33   | 3 / 14   |
| Nightclub   | 1 / 7    | 2 / 8    | 3 / 0    |

1. Compare each pair with characters hidden. Identify the changed activity
   arrangement without relying on its seed or caption.
2. Use Structure view to check entrances, main routes and working-floor
   reservations. Warehouse/Garage/Nightclub retain the same room skeleton;
   the visible differences there belong primarily in furniture and floor use.
3. Restore furniture. Check rack aisles, complete vehicle bays, household entry
   rhythm and the relationship between lounge seating and circulation. A room
   must not become emptier just to accommodate an alternative.
4. Enable characters and Access positions; inspect targeting and occlusion.
   Compare intact, damaged and destroyed states. Save, change seed, load, and
   confirm the exact scene and damage return. Reopen a custom-seed URL.

## Verification

- Fifteen real pre-change scenes (all five environments, seeds 1–3) are checked in
  as frozen fixtures. They load unchanged; regenerated reference scenes preserve
  structures, zones, actors, cover, entrances, attachments and working access.
- Dedicated coverage uses seeds 0–63, 2147483647 and 4294967295 per environment.
  It checks determinism, exact manifest round trips, actor/entrance/work access and
  every reserved route tile in intact, damaged and destroyed states; attachment
  alignment, non-overlap, required groups and rejection of incompatible provenance.
- Diversity signatures use actual semantic space and functional furniture,
  excluding provenance, labels, height, decorative scatter and whole-scene rotation.
- Curated pairs preserve rack, car and lounge-seat capacity. Saved-review tests
  exercise all curated alternatives, including access poses and destroyed cover.
- Exact comparison against 64 pre-change Intersection/Office scenes is unchanged.
- Full suite: 3,548 tests across 269 files pass. Typecheck and production build
  pass. Lint reports zero errors and the 12 existing React-refresh warnings.
- Browser security policy rejected access to the local preview and reported that
  permission was declined. No new browser screenshots or visual signoff are claimed.
  Automated saved-review checks do not establish live pointer targeting or visual quality.

During implementation, checks caught compressed residential doorway spacing,
an obstructed warehouse office approach, a bay overlapping a loading-door approach,
and nightclub alternatives losing a second lounge group. The arrangements were
corrected; required working groups were not weakened to make generation succeed.

## Critique against the reference image

The user's target is a close isometric street view with a readable open combat
area, dense but purposeful building edges, varied facades, believable material
scale and local light sources. This assessment uses that reference and existing
4A–4D.1 captures; it is not a claim to have visually inspected the new 4D.2 output.

**Progress:** entrances now belong to buildings; furniture forms usable activities;
working routes have deliberate space; saved layouts remain mechanically reliable.
4D.2 makes those relationships vary while keeping their capacity and access. This
is a stronger foundation for replacing the provisional visual kit.

**Remaining composition risk:** existing views still show broad, plain roof/facade
masses, sparse stretches between activity groups, and interiors that can read as
small floorplans against a large dark background. Large foreground buildings can
hide the very activity being composed. More combinations do not fix those issues.
The residential family count also demonstrates that seed count can overstate
architectural diversity.

**Art work can solve:** coherent perspective/scale across furniture, vehicles and
facades; business-specific skins; richer windows, shutters, signs, doors and roof
trim; convincing wear, paving and non-blocking surface detail. Some of these are
modular facade/attachment assets with depth, not flat texture replacements.

**Lighting can solve:** local pools around windows, signs and lamps; contact
shadows; emissive contrast and wet-surface highlights. Lighting should reinforce
an already legible place, not disguise missing composition. Whether baked lighting
in assets is sufficient or dynamic lights are necessary needs a focused visual proof.

**Not yet justified:** "only skins and lighting remain." 4D.3 should inspect all
seven environments at the intended play framing and settle the remaining spatial
issues before making that claim. Its visual gate should require:

- Recognizable use, clear arrival and purposeful occupied edges without final art.
- Human-scale proportions and usable negative space; no unexplained empty rooms
  and no circulation filled merely to raise apparent density.
- Activity readable from the shipping camera, including foreground occlusion and
  narrow-screen targeting; framing should feature the place rather than the void.
- Alternatives that look intentionally different and preserve the accepted quality.
- An explicit list of residual differences that can be resolved through assets,
  surface treatment and lighting without moving walls, entrances or core groups.

If a layout fails that gate, correct its composition before buying or generating
its final art. 4D.3 remains the next checkpoint; it is not silently marked complete here.
