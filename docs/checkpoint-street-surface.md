# Street surface finish

2026-10-07. Based on merged PR #308 / main `95c90722`. Levi accepted the
residential facade (#307) and roof (#308) passes and asked for the most necessary
next improvement toward the atmospheric reference.

## Why the ground next

The street occupies much of every play view but read as a uniformly dark sheet.
The reference has legible paving, patched asphalt and connected fractures. This
pass improves that large shared material field before another small prop/detail
pass. It does not claim parity with the reference or alter framing to imply it.

## Change

- Loaded asphalt and paving retain more midtone detail. The existing material
  tiles, metre scale, light sources, ambient grade and lamp strength are retained.
- Sparse utility repairs follow saved carriageways, with irregular cut corners,
  tar seams and branching fractures. Their translucent fills retain tile grain.
- A few paving slabs have fractures and chipped corners; off-tone/replaced slabs
  have slightly clearer separation. Existing gutter silt and road-paint wear stay.
- Road repairs are clipped to the union of road/intersection/crosswalk zones and
  painted **before** crossings and lane paint. Tactical overlays remain above all
  ground treatment. The work is cached in the existing ground canvas.
- Missing asphalt omits the new road finish and retains the original paint order;
  missing paving omits enhanced slab wear. Other recipes retain their old ground.

No assets, dependencies, engine, saved geometry, entrances, targeting, collision,
damage, camera or save schema change. Reflections remain `skip` / not built.

## Browser judgement

Actual connected Chrome, existing local Vite server, 682 × 660 browser viewport.
Matched seed-7 normal-play before/after uses the same page scroll, actors and
camera. A closer scenery comparison uses `cam=0,60,2.2`; small page-scroll
variation in that pair is visible in the controls and is not a camera change.

The useful play-scale gain is road/paving separation and a less empty asphalt
field. Repairs are subordinate to road paint and the shop. Individual cracks and
slab chips resolve mainly closer in; they are not the justification on their own.
The shop remains the strongest warm focal point. Lights-off retains the new
material separation without producing self-lit dirt or markings. Reveal leaves
the road surface continuous and the previous clipped residential finish intact.

Also checked seeds 0/8 at normal play, seed-8 destroyed cover, and seed-7 saved
review restoration (after changing seed and damage). Garage checked as a separate
recipe. No console errors observed. This is shared-renderer fixture validation,
not a live campaign fight or database save/load.

## Validation

Bun: 315 test files / 4064 tests passed; TypeScript, changed-file ESLint and
production build passed. The final test syntax adjustment also passed the focused
surface-material suite. Tests check repair containment, coverage below 12% of
road area, determinism, no arena mutation, road-paint ordering and missing-tile /
other-recipe exclusion. No per-frame work or new texture allocation was added.
No new frame-time benchmark was run.

Evidence: `docs/evidence/street-surface/README.md`. Visual acceptance is pending;
this change is submitted for review, not merged or deployed.

## Remaining priorities toward the reference

1. **Remaining commercial frontage composition.** Broad plain shop/service faces
   need built bays, piers, recesses and distinct material/signage families at the
   same quality as the finished corner. Judge an entire block at play scale;
   preserve its saved entrances and footprints. This is the next substantial pass.
2. **Building silhouette and street composition.** The reference has taller,
   varied masses and less roof-dominated framing. Surface work cannot close that
   gap. Review it as a deliberate composition proposal with frozen-layout
   compatibility, rather than silently changing saved building heights or camera.
3. **Localized street storytelling.** Bespoke threshold/gutter wear and a few
   well-placed service details can follow the architecture. Avoid uniform clutter.

Do not spend the next pass on stronger bloom, more tiny roof details, or bringing
back the rejected reflection treatment to compensate for plain architecture.
