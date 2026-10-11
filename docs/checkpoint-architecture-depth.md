# Architecture depth — 2026-10-11 UTC

Authorized one cohesive architectural revision after PR350 merged.
Base main fbebe4962df04f871532c6c392edf1c6953764a7, branch codex/architecture-depth,
isolated ../city-block-depth. Never git push reconstructed history; publish through
GitHub trees/commits/ref lease. Levi merges. Recovery dirty work untouched.

Current local implementation: projecting stone window frames, layered cornices and
pilasters over registered upper artwork; raised repair canopy exposes workshop;
connected market return canopy has its own depth-sorted/fading/cutaway sprite.
Raised canopy shadow casters project both slab faces; lights below pass underneath.
No saved layout/entrances/cover/actor/overlay changes or new assets.

Actual first local seed8 pixels inspected. Initial trim too bright/uniform; lowered
values and mapped existing concrete material. Latest return canopy render and
validation pending; not visually accepted yet. Reference ../generated_images/exec-8fe0a16b-631d-449b-b648-48a78e5c7071.png.

Local dev5176, polling watcher. New source tests check raised-source geometry and
41-seed canopy bounds/saved-layout preservation. Next: inspect current full render,
refine major volumes if needed, tests/type/lint/build, publish draft and paired CI.

## Local review and validation

Local seed8 full/reveal and seed0 pixels opened. Corrected bright flat trim with
lower values and existing concrete material. Seed8 has no exposed free corner:
the connected canopy now follows its immediately adjoining middle trading floor,
using the same height/projection. Other layouts can turn a genuinely exposed corner.
No new light source/sign added on extensions; same lamp position lights the cloth.
Window/cornice treatment also anchors low supporting shops. Reveal requires actual
remaining wall supports at canopy height. Broad canopy reach includes its ends.
67 focused tests across8files pass. Final type/lint/build running. No detached rings
observed. Clearer construction, but not reference parity; no new stepped roof recipe.
Next publish draft, then inspect exact-head CI before/after pixels for all3seeds.
