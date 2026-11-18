# Life skill checks — 2026-11-18

Branch `codex/life-roll-polish` in `LeviJohnsonNC/nightcitytales`, based on the merged Life screen at `ecd01e4`. [Draft PR #389](https://github.com/LeviJohnsonNC/nightcitytales/pull/389) holds the implementation and captures.

- Life now shows one modifier and target before the roll, compact Luck odds, and expandable details. The die, total and stamp land together. The scene outcome follows the same roll when the composer returns.
- Life reads the linked ledger result after refetch. A failed save is checked against the ledger before offering recovery. If the roll is saved, the player can continue from that verdict without replaying the settlement.
- Apply `20261118020000_life_check_record.sql` before serving the new client. It records a player-rolled check and charges Luck atomically. Jobs and Combat use their existing presentation and settlement paths.
- The 1,127 targeted tests and local PostgreSQL replay passed. The [browser walkthrough and matched captures](life-roll/README.md) cover the ready, landed and narrated check on desktop and the completed result at 390 px. The fixture uses local campaign reads and scripted narration. GitHub checks track the final revision. Owner review and the migration at rollout are next.

The [prior handoff](https://github.com/LeviJohnsonNC/nightcitytales/blob/ecd01e4/docs/AI_HANDOFF.md) covers the merged Life screen work and earlier milestones.
