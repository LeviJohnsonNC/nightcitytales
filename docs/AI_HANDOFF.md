# Life play screen — 2026-11-18

Branch `codex/life-screen-overhaul`, based on merged main `4e2f5b1`.
The [draft PR](https://github.com/LeviJohnsonNC/nightcitytales/pull/388) contains the Life rebuild. Owner visual review is next.

- The play column leads with location art, present people, narration, receipts and the active decision. The desk rail and phone status sheet carry Character, Contacts, Journal, Screamsheet and tools.
- Character drafts survive direct and narrated shopping. The current campaign owns its draft. Life-only check and suggestion layouts use the existing engine controls. Travel retires the previous location’s passage and suggestions.
- The [review and matched screenshots](life-screen/README.md) document the market, apartment, mobile suggestions and check. The capture runner lives in `tools/life/`.
- Seeded Chromium exercised the normal turn, failure, required roll, keyboard composition, modal focus, both counter entries, authored neighborhood travel and an accepted catalog mission. Local reads and writes replace the hosted account. Physical phone keyboards and live playback remain unverified.
- Revision `4ea4ed5` passed 4,781 local unit tests across 376 files. Follow-up changes address map/radio focus, the phone radio width and stale narration after travel. PR checks track the final revision. No migration is required for this UI change.

## Earlier milestones

PR #387 merged the Stackside Clinic and Old Japantown work. The [prior handoff](https://github.com/LeviJohnsonNC/nightcitytales/blob/4e2f5b1/docs/AI_HANDOFF.md) retains its rollout instructions and the earlier shopping, painted architecture and cast-art checkpoints.
