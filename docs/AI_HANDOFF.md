# A Night at the Opera opening — 2026-11-19

Branch `codex/opera-campaign-opening`, based on `88d3dbb` (PR 393).
The milestone runs from accepting the offer to finding a lead and seeing its next action.

- `acceptHook` opens Opera at The Hook. The opening uses Life’s visual treatment,
  compact radio, and an original Evergreen front desk illustration.
- The clerk, broadcast, and campus approaches are authored mission exits. The
  saved branch choice reconstructs the lead after reload and later in the job.
  Free text and the follow-up use the existing Job turn flow.
- `OperaOpening.tsx` keeps the current scene and actions together. The case
  file holds the objective, lead, and disclosures for history, terms, and status.
- Production dependency checks use the frozen Bun lock. For this cloud
  workspace, install from a temporary copy with npm registry tarball URLs
  because the original Lovable package hosts returned HTTP 403.

The production build, typecheck, and lint passed. Chromium exercised the real
Life acceptance button, all three Job choices, keyboard selection, reload,
free text, and the promoter follow-up with a mocked DB and narrator. The
opening fits at 1280 × 690. The mobile result fits at 390 px without horizontal
overflow. The fixtures do not call production Supabase or spend AI credits.

Review the PR and play the opening on a signed-in staging campaign.

[Previous handoff](https://github.com/LeviJohnsonNC/nightcitytales/blob/88d3dbb/docs/AI_HANDOFF.md)
covers the inventory migration and staging follow-up.
