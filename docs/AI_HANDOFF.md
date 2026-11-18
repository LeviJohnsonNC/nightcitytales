# Agent calls in Life — 2026-11-18

Branch `codex/agent-call-strip`, based on merged main `d923cff`. [Draft PR #390](https://github.com/LeviJohnsonNC/nightcitytales/pull/390) holds the feature.

- Life shows the player and caller across a cyan line above the passage, with the location still at the top. A connected call switches the composer to Reply and Hang up.
- Newly narrated calls carry validated participant information in the existing Life narration event. Incoming calls use the broker or current situation. Reply continues on the connected line. Hang up writes one event without a model turn, and the reply path rereads the ledger before continuing a connection.
- The Life skill-check path remains available during dialogue. Texts and in-person speech use the ordinary Life composer.
- The production build, targeted tests and desktop and 390 px Chromium walkthrough passed. [Captures and reproduction](agent-call/README.md). The call strip requires no migration. Owner review is next.

The [prior handoff](https://github.com/LeviJohnsonNC/nightcitytales/blob/d923cff/docs/AI_HANDOFF.md) covers the merged Life roll work and its rollout migration.
