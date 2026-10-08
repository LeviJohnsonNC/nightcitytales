# City block recovery — 8 October 2026

PR #316 shipped the inhabited After Rain block, but its visual jobs timed out
and the local source atlas and two regression tests were omitted. This recovery
preserves that work and repairs the evidence job; it does not add another visual
experiment.

## Recovered work

- `docs/city-block/service-atlas.png` is the original transparent source for
  `bun tools/art/city-block-assets.ts`. Its four WebP outputs match the shipped
  assets byte for byte.
- `cityBlock.test.ts` checks wall fittings against saved openings and roof
  equipment against saved bounds across 41 seeds. It also exercises full and
  retained-wall painters for clipping and balanced canvas state.
- `docs/city-block/unmerged-ground-finish.patch` preserves an unreviewed road
  experiment. It is **not applied** to the renderer.
- `docs/evidence/city-block/` contains the screenshots recovered from the
  interrupted review: seed 8 play, destroyed cover, lights off, reveal and
  targeting; seed 0 route; seed 7 overview. These are manual captures, not
  successful output from the repaired CI job.

## Automated review repair

The capture spec uses DOM readiness and the board loading indicator instead of
`networkidle`, which streaming media can prevent. Controls use exact accessible
roles. Save/load asserts restored damage and the restoration message. Failures
have a 90-second test budget with no retries, per-test output directories and
diagnostics even when the first screenshot is never reached. The artifact upload
includes the hidden `.results` directory.

## Validation and limits

The recovered full-suite log records 319 files / 4,089 tests passing, with a
successful production build and typecheck. This continuation reran both restored
tests, typecheck, changed-file lint, formatting and Playwright test discovery.
The source importer reproduces all four shipped assets exactly.

Local end-to-end execution is blocked by the current session's prohibition on
opening a localhost listener (`listen EPERM`). The follow-up PR's before/after
Chromium jobs must therefore establish whether the repaired spec passes on the
runner. Existing screenshots show a rendered scene; they do not substitute for
that automated check or establish reference-image parity. No campaign writes,
schema changes or combat-rule changes are involved.
