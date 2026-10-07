# Street frontage finish

Built on the reviewed #311 tree (`98409227`); presentation changes only.

## What changed

The corner shop gains stone jambs and lintels around its existing display bays,
recessed enamel stall-riser panels, dark entrance returns and substantial door
heads. Both street-facing elevations use the same joinery painter, underneath
their existing glazing/shutter artwork and inside the existing cutaway clips.
The neighbouring repair business gains a contrasting blue-green paneled dado
below its high barred windows. Existing openings and access positions are retained.

The lit display continues farther around the shop corner: three existing bays
in seed 0 and both exposed bays in seed 7. Window artwork, wall lighting and ground
spill all consume the same display list; the farther service bays remain closed.
Tall saved shop buildings carry a taller version of the existing neon blade sign.
Low legacy buildings retain its original dimensions. Its projection stays within
one metre of the wall. Sprite bounds and optional reflection registration use the
same dimensions. In automatic cutaway, the fixture follows its supporting wall
section; manual reveal hides it when the fascia is removed.

The street has wider, higher-contrast granite kerb tops, existing dropped crossings
and drainage preserved, and flat framed threshold inserts at saved shop entrances.
Those inserts add no step, collision or walkable floor. Existing small streetlamp
pools are slightly broader and less intense at the centre. Shop lamp, ambient,
light colours, tactical overlay and reflection defaults remain unchanged.

Everything is baked into the existing canvas/lighting pipeline. There is no new
asset, dependency, scene recipe, save schema or gameplay rule. The enlarged sign
uses a slightly larger existing texture; no hardware benchmark is claimed.

## Review

Connected Chrome, normal play camera, 682 × 704 viewport. The matched seed-7 pair
was made by temporarily loading the prior renderer, capturing it, restoring all
new sources and reloading. No camera or viewport adjustment between the pair.
A stale browser inspection stalled during work; review recovered in a fresh tab
in the existing Chrome. Temporary renderer diagnostics were removed.

- [Seed 7 before](evidence/street-frontage/seed7-play-before.jpg)
- [Seed 7 after](evidence/street-frontage/seed7-play-after.jpg)
- [Seed 7 lights off](evidence/street-frontage/seed7-lights-off.jpg)
- [Seed 7 manual reveal](evidence/street-frontage/seed7-reveal.jpg)
- [Seed 0 after](evidence/street-frontage/seed0-play-after.jpg)
- [Seed 8 after](evidence/street-frontage/seed8-play-after.jpg)

Seed 8 shows the taller sign and warm shop frontage most clearly. Seed 7 remains
a difficult orientation: nearby roof masses and the combat panel leave little
street facade in view. The new joinery is a finish improvement, not proof that the
intersection now matches the reference. Broad roof coverage and the proportion
of the screen devoted to the street are still substantial composition gaps.
Do not mistake a closer camera crop for acceptance at normal play scale.

Lights-off removes emission and keeps material boundaries. Manual reveal clips
the frontage and removes unsupported signs. Rifleman readouts remain seed 7:
21 m / DV20; seed 8: 18 m / DV20; seed 0: 20 m / DV20. No campaign transactions
were performed.

## Validation

Bun suite: 317 files / 4,073 tests pass. Typecheck and production build pass.
Repository lint: no errors, 13 existing warnings. New regression checks cover
thresholds outside saved structures at actual shop entrances, tall/legacy sign
size and unchanged input geometry. Existing frontage tests now pin the intentional
display-bay expansion; existing cutaway, lighting and deterministic engine tests pass.
