# Night City Tales — resume here

Updated: 2026-10-08 UTC. This is a verified starting point, not a transcript.
Verify live GitHub/checkout state on each resume; this file can become stale.

## Goal and scope

Finish recovering and reviewing the inhabited After Rain intersection before
starting the next visual upgrade. Levi wants substantial progress toward the
reference image, while preserving saved geometry, tactical readability and rules.
Current task: establish durable checkpoints so a chat interruption does not
require reconstructing the whole project again.

## Verified remote state

- Repository: https://github.com/LeviJohnsonNC/nightcitytales
- Integration branch: `main`; Levi reviews and merges PRs.
- PR #316, “Build an inhabited After Rain city block,” is merged.
  https://github.com/LeviJohnsonNC/nightcitytales/pull/316
- Its implementation head was `38d3c344cde3a9bd740cf4f20da99f6533b0d2d6`.
  This is NOT a verified current main or merge commit SHA.
- No open PRs were returned immediately before creating this documentation branch.
- Workflow branch: `codex/resumable-development`, created from main.
  Changes here are only this file and the resume section in AGENTS.md.
- No implementation validation or visual review was performed in this workflow task.

## Local recovery work to preserve

Observed under the ChatGPT project workspace:
`/Users/levijohnson/.codex/.chatgpt-projects/g-p-6abfcd9980e48191b4818f5d112e25d3`

These directories may not exist on a different host. Do not assume they are
remote branches or that a new chat inherits them.

### city-block-recovery/

- Local branch: `codex/city-block-review`.
- Local HEAD: `341692f`, “Reconstruct verified merged city block snapshot for review.”
  This is a reconstructed local snapshot, not proof of an upstream merge SHA.
- Modified: `.github/workflows/city-block-review.yml`,
  `e2e/city-block.spec.ts`, `src/features/play/courtyard/cityBlock.ts`.
- Untracked: `docs/checkpoint-city-block-recovery.md`, `docs/city-block/`,
  `docs/evidence/city-block/`, `src/features/play/__tests__/cityBlock.test.ts`.
- These changes were NOT committed or published by this documentation task.
  Compare them with current main and any later recovery branch before applying.
- Read the local `docs/checkpoint-city-block-recovery.md` for the recovery manifest.
  It describes a source atlas, regression checks, recovered screenshots and
  repaired browser capture behavior.
- It also identifies `docs/city-block/unmerged-ground-finish.patch` as an
  unreviewed experiment preserved separately. Do not apply it automatically.

### recovered-nightcitytales/

- Local branch: `codex/night-market-after-rain`.
- Numerous untracked screenshots and art-source directories remain.
- Preserve these originals. They are not permission to bulk-add assets or
  recreate the recovery work without first comparing the two checkouts.

## Validation: evidence versus claims

- The local recovery checkpoint reports an earlier 319-file / 4,089-test pass,
  a build/typecheck pass, and later focused validation/import reproduction.
  These are historical reports, not checks rerun in this documentation task.
- It reports that PR #316 visual jobs timed out and that localhost execution
  previously failed with `listen EPERM`. Recheck current job/capability state.
- Recovered screenshots are manual evidence, not proof that the repaired
  automated browser checks pass or that reference-image quality is achieved.
- Shell GitHub access failed DNS resolution in this task; the GitHub connector
  successfully read state and wrote this documentation branch.

## Next action — a bounded recovery milestone

1. Read this file and the applicable contributor rules. Check current main,
   open/recent PRs and the dirty recovery checkout; identify the actual baseline.
2. Compare only the recovery manifest's changed files/assets against that baseline.
   Preserve unrelated files. Publish the missing recovery work on a feature
   branch/draft PR, explicitly marking any unverified checks.
3. Run the affected checks and repaired before/after browser jobs. Record the
   revision, commands, results and evidence links here before further work.
   If blocked, preserve the branch and exact diagnostic; avoid repeated retries.
4. Deliver the recovery PR with a clear remaining-gates list. Plan the next
   major visual improvement in a fresh chat after this recovery is resolved.

## Fresh-chat prompt

> Continue Night City Tales in LeviJohnsonNC/nightcitytales. Read AGENTS.md's
> resume section and docs/AI_HANDOFF.md, verify GitHub and local working state,
> then perform the next recorded action. Preserve uncommitted recovery work.
> Checkpoint before lengthy validation and keep this chat to one milestone.
