# Agent calls in Life — 2026-11-18

[PR #390](https://github.com/LeviJohnsonNC/nightcitytales/pull/390) merged the Agent call strip into `main` at `e7e21db`.

- Life shows the player and caller across a cyan line above the passage, with the location still at the top. A connected call switches the composer to Reply and Hang up.
- Newly narrated calls carry validated participant information in the existing Life narration event. Incoming calls use the broker or current situation. Reply continues on the connected line. Hang up writes one event without a model turn, and the reply path rereads the ledger before continuing a connection.
- The Life skill-check path remains available during dialogue. Texts and in-person speech use the ordinary Life composer.
- The production build, targeted tests and desktop and 390 px Chromium walkthrough passed. [Captures and reproduction](agent-call/README.md). The call strip requires no migration.

## Lovable sync

This docs-only sync merge brings in `lovable-sync` at `b505b02` while retaining the `main` game tree at `e7e21db`. The outstanding [adventure migration verification](adventure-migration-verification.md) records Lovable's deployed schema check. Dependency files match both branch tips, and the preview auth code matches after formatting.

After merging, check that the Lovable editor shows the new GitHub commit and that a Life voice call displays the Agent strip.

The [prior handoff](https://github.com/LeviJohnsonNC/nightcitytales/blob/d923cff/docs/AI_HANDOFF.md) covers the merged Life roll work and its rollout migration.
