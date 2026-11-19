# A Night at the Opera opening — 2026-11-19

PR 394, branch `codex/opera-campaign-opening`, based on `88d3dbb`.
The pilot covers accepting the offer, finding the first lead, and confirming a
way into the party.

- The Evergreen illustration, case file, radio and composer carry over Life's
  scene hierarchy. First moves show the engine's time costs.
- The clerk, broadcast and campus approaches lead to the guest list, public
  ticket queue or press check-in. Clicked actions and equivalent typed
  commands share the Job submit path. Other free text goes to the Job GM.
- Mission branch history restores each learned fact on reload and supplies it
  to later GM turns. The case file keeps the lead and the confirmed way in.
- `20261119010000_opera_action.sql` commits progress, clock and history together.
  A retry uses the original request ID. Fresh local Postgres replay applied
  20 migrations above the baseline and passed the atomicity, stale choice,
  retry and ownership regression.
- The [roadmap](../ROADMAP.md#campaign-opening-pilot) ranks the signed-in
  Opera review, a single generated Job, then the broader Job and Aftermath pass.

All 4,799 tests, typecheck, lint, and the production build passed. Chromium
used a mocked session, backend, and GM response to verify six walkthroughs,
matching elapsed time for clicks and typed commands, reload, later GM facts,
and failures before and after commit. The route confirmation fits at 1280 × 690
and has no horizontal overflow at 390 px.

The schema migration and signed-in staging playthrough are the release gate.
This cloud workspace used npm registry tarball URLs for the temporary frozen
install because Lovable's package hosts returned HTTP 403.

[Previous handoff](https://github.com/LeviJohnsonNC/nightcitytales/blob/88d3dbb/docs/AI_HANDOFF.md)
covers the inventory migration and staging follow-up.
