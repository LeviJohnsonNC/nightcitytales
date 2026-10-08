# Night City Tales — resume here

Updated: 2026-10-08. Verify live PR state before continuing.

## Active milestone

PR #320 merged; repair visual-review startup before more visual changes.
Draft PR #321: https://github.com/LeviJohnsonNC/nightcitytales/pull/321
Remote branch: `codex/repair-visual-review`, from main `09e435da`.
Implementation revision: `8c374817` (verify latest PR head/checks).

## Current experiment

- Keep shipping scene settings, including reflections ON.
- Retain API/network trace without repeated screenshots or DOM snapshots.
- Print browser errors, failed resources, crashes and renderer timings to CI logs.
- Stop after the first failed seed; retain 90-second test/five-minute suite limits.
- Diagnostic run `37816665863` failed both revisions at readiness. Logs show
  64 repeated canvas readback warnings during atlas setup, no scene-ready mark.
- Second experiment: `--disable-accelerated-2d-canvas` on the software-GPU runner
  removes GPU roundtrips for staging canvases; WebGL/game settings stay unchanged.
- Run `37817414013` reached scene-ready (~44 seconds) and captured lighting,
  destruction and restored save. Failed only after actors-off rebuilt the renderer.
- Final change: exercise the combat board's Reveal button in place, assert pressed,
  retain the same camera and avoid a second full atlas/environment build.
- Await latest head's paired captures. Deduplicated warnings.
- Local spec lint/format and desktop discovery (three tests) passed.
- Local browser retry failed on server listen EPERM; do not retry unchanged.
- Prior run `37814306896` failed hidden canvas on both base/head. Artifact host
  was blocked by Chrome. New logs avoid requiring that archive for diagnosis.

## Preserved work

Local `city-block-recovery` history is reconstructed; publish through the GitHub
connector branch, never push its history. Unrelated cityBlock formatting, atlas,
regression test, old screenshots and ground experiment remain untouched.
`sources/` is read-only. Standard CI on #320 passed, but no new image was accepted.
Ground-detail implementation is merged; larger corner/lighting goal remains.

## Next action

Read the bounded diagnostic CI result for #321; fix the concrete failure, then
require successful seed 8/7/0 captures and review evidence before claiming success.
Levi reviews and merges PRs.
