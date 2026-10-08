# Night City Tales — resume here

Updated: 2026-10-08. Verify live branch/PR state before continuing.

## Active milestone

PR #320: https://github.com/LeviJohnsonNC/nightcitytales/pull/320
Branch: `codex/occupied-street`, created from remote main.
Goal: materially improve the intersection's ground and occupied sidewalk edges.
Status: implementation pushed as a DRAFT; visual acceptance pending.

## Implementation

- `src/features/play/courtyard/streetLife.ts`: deterministic flush curb channels,
  drain slots, iron access covers, service paving and discarded paper/packaging.
- `groundFinish.ts` invokes this only with enhanced paving in the cached albedo.
- No new obstacles, collision/route changes, emitted lights or saved state.
- `streetLife.test.ts` checks placement and preserved geometry across six seeds.
- Includes recovered browser-spec repair and hidden-artifact upload; 90-second
  tests, no retries, five-minute global capture budget, ten-minute job ceiling.
- Broader occupied-corner and lighting ambition is not yet visually accepted.

## Validation

- 10 focused tests passed (streetLife and groundFinish).
- Typecheck, changed-source lint and production build passed.
- Local browser server remains blocked by `EPERM`.
- Offline shipping-renderer preview was built, but browser security policy
  rejected `file:` URLs. Do not bypass that restriction.
- Use PR #320's paired Chromium CI captures for visual inspection. Do not
  claim the new implementation matches the reference without inspecting them.

## Preserved work

Local checkout: project workspace's `city-block-recovery`, branch
`codex/city-block-review`. Its history is reconstructed, not remote main.
Use the GitHub connector branch for publication; do not push reconstructed history.
Unrelated recovered atlas, cityBlock regression test, old screenshots and
unapplied ground experiment remain local. Preserve them.
Older `recovered-nightcitytales` retains original art and screenshots.

## Prior milestone

PR #316 merged; PR #317 continuity and PR #319 manual review notes merged.
Manual live review checked seeds 0/7/8, lighting, damage, reveal and targeting.
See `docs/city-block-visual-review-2026-10-08.md`.
Those captures predate #320 and DO NOT validate the new street pass.

## Next action

1. Inspect #320 CI status and its paired captures, especially seed 8 at play zoom.
2. Judge whether the difference is substantial and coherent; revise if too subtle.
3. Check lights-off, reveal and destroyed states; record exact run/commit evidence.
4. Keep draft if captures fail or are unavailable. Do not repeat blocked local
   server/file-URL attempts. Levi reviews and merges the completed PR.
