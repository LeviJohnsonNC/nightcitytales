# Stepped commercial frontage

Based on merged #309, remote main `cfb13859661e2e3e038076039dc3cf0706eeb642`.
The local branch retains the identical reviewed #309 tree and its local history.

## What changed and why

The reference has substantial street walls; our commercial row was three broad,
low roof slabs. New intersection recipe v8 raises the corner shop to 7.2 metres,
its narrow attached neighbour to 10.2 m and the rear row to 7.8 m. Those existing
pieces now make a stepped two/three-storey block. All ground footprints, routes,
entrances, attachments, cover and actor positions stay as before. Upper floors
are inaccessible scenery, like the existing residential upper floors.

`commercialUpper.ts` supplies upper elevations from saved dimensions: rendered
walls in warm/cool families, stone piers, floor courses and windows with reveals,
substantial sills and existing curtain/blind artwork. Upper rooms stay unlit so
the trading floor remains the lighting anchor. It uses the same cached building
canvas and shared full/cutaway painter, clipped to each surviving wall. There is
no new image, dependency, per-frame pass or change to reflection defaults.

The environment reader accepts recipe v8 without changing snapshot format v2.
It continues to read every older recipe. Seeds 1–3 retain their exact v5 geometry;
v6/v7 saved scenes retain their stored heights. Existing pinned geometry hashes
still pass after accounting explicitly for the three intentional height changes.
New tests pin those heights, check v7 snapshot round trips, window containment,
low-building exclusion, canvas balance, clipped painting and non-mutation.

## Browser judgement

Actual connected Chrome, existing Vite server, 682 × 660 viewport. Play camera
unchanged. Seed 0's before/after pair changes only the composer back to the #309
version for the baseline, then restores v8. The taller-storey painter does no
work on the baseline's low shop buildings. Both captures use normal play with
actors, night and lights, without reflections. Page scroll differs by a few pixels.

Seeds 0 and 8 show the main gain: a substantial, stepped street wall with room
windows instead of one-storey roof slabs. The shop remains the warm focal point.
Seed 7 is the less flattering orientation: the taller shop in the foreground
fades more because it overlaps actors. That protects targeting but limits how
much facade is visible during play. Reveal removes upper storeys with the roofs;
retained ground walls and the street remain visible. Lights-off keeps the upper
material/window rhythm; no glow is baked into the new facade.

An actual v7 seed-0 review snapshot was saved using the baseline composer, then
loaded after restoring v8. The UI reports “Recipe v7” and “Frozen saved scene
(not regenerated)” and retains the low row. This is fixture save/load, not a live
campaign database transaction. The rifleman remains a clear 20 m / DV20 target in
seed 0, and 21 m / DV20 in seed 7; the lookout remains blocked.

## Limits and next decisions

This is a meaningful silhouette change, not reference-level acceptance. Roof
footprints are still broad; industrial buildings remain low by design. Materials
and repeated windows are still more orderly than the reference. The next larger
composition decision is how to reveal foreground buildings without turning an
entire tall facade translucent. Do not solve that by obscuring actors or changing
line-of-fire rules. More localized ground-floor frontage variation can follow,
but stronger glow or additional tiny roof marks are low priority.

## Validation

Bun full suite: 316 files / 4,067 tests pass. TypeScript, changed-file lint and
production build pass. No new production browser error after adding v8 to the
reader; initial hot-reload errors during the incomplete version change resolved.
No live campaign action or database migration was exercised; no new performance
benchmark. Evidence is in `docs/evidence/urban-frontage/` (actual browser captures,
JPEG derivatives of untouched PNGs, with no compositing or recolouring).

Ready for visual review. Not merged or deployed.
