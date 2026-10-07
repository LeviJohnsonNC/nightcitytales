# Residential roof finish

Starts from merged PR #307, main `b1d4b5e`. Branch: `codex/residential-roof-finish`.

The home and attached annex now use `residentialRoof.ts` inside their existing
roof silhouette. The deck sits visually 24 cm below the saved top, behind a
30 cm coping. Existing units remain at their original positions and heights;
small curbs connect them to the lowered deck. Their contact shadows follow the
deck and are clipped to the original roof outline.

Existing membrane and concrete assets supply the surfaces. World-metre lap
seams, staggered cross-joints, two restrained repairs on large roofs and internal
drains describe construction and maintenance. Drains select clear corners, with
equipment clearance checked across seeds 0–40. No external pipe is invented.
No new artwork or asset loader is needed; absent tiles use flat material fills.
Without the material pack, the original renderer remains in use.

Only residential and recognised annex roofs take this finish. The shop and other
buildings retain their accepted treatment. This is roof-only painting in the
existing building sprite, so reveal/fading removes it with that roof. Saved
footprints, heights, entrances, equipment positions, collision, targeting,
damage, recipe and save formats are unchanged. Reflections remain off.

## Actual-browser review

Connected Chrome and the already-running local server on port 8080. Normal play,
lights-off and reveal were inspected for seeds 7, 0 and 8. Seed 7 also has a
neutral roof inspection and before/after captures from merged main. The browser
window resized during the review: the final matched pairs were recaptured at
682 × 660. Ordinary screenshots were used; no synthetic scene renders.

The coping depth and subdued membrane rhythm make the roof read as constructed
at play scale. Cooler charcoal removes the previous brown slab appearance.
Drain grilles, repairs and curb flashing mainly resolve in closer inspection;
they are secondary detail, not the justification for the pass. Roof fields stay
broad and relatively empty, and the shop remains the stronger lit focal point.
Seeds 0/8 put much of the home outside normal play framing or behind actor fading;
seed 7 is the useful direct roof comparison. This is a restrained architectural
improvement, not a claim of full atmospheric-reference parity.

Validation: Bun full suite 315 files / 4062 tests, TypeScript, changed-file ESLint
and production build passed. The final shadow-boundary clip also received the
roof and architecture-art regression checks. Tests cover drain clearance,
original-envelope clipping, missing tiles, balanced canvas state and no mutation
of structures. No console errors were observed. No live campaign DB or submitted
combat action was exercised in this roof-only pass.

Evidence: `docs/evidence/residential-roofs/README.md`. Human visual acceptance is
pending; no merge or deployment is part of this change.
