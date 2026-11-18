# Agent calls in Life — 2026-11-18

Branch `codex/agent-call-strip`, based on merged main `d923cff`.

- Life shows the player and caller across a cyan line above the passage, with the location still at the top. A connected call switches the composer to Reply and Hang up.
- Newly narrated calls carry validated participant information in the existing Life narration event. Incoming calls use the broker or current situation. Reply continues on the connected line. Hang up writes one event without a model turn, and a late reply cannot reopen a line closed during the request.
- The Life skill-check path remains available during dialogue. Texts and in-person speech use the ordinary Life composer.
- The 524 targeted tests and the seeded desktop and 390 px Chromium walkthrough passed. The draft PR and final captures are in progress. There is no migration for the call strip.

The [prior handoff](https://github.com/LeviJohnsonNC/nightcitytales/blob/d923cff/docs/AI_HANDOFF.md) covers the merged Life roll work and its rollout migration.
