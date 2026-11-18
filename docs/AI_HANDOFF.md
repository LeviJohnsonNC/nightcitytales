# Chat inventory transfers — 2026-11-18

Branch `codex/chat-inventory-transfers`, based on `5604877`. The goal is for
typed Life and Job actions to change the same campaign inventory the character
sheet reads.

- Both narrators propose typed item transfers. The resolver selects from saved
  scene stock or live kit at the current location. Successful checks can
  establish salvage. A drop or stash keeps the item's condition and location.
- A transactional RPC changes stock and kit and saves one receipt per transfer.
  The client reuses the request ID for retries and continuation turns.
- Life shows item counts in its receipt bar. Jobs show the ledger receipts in
  the narrative log. Focused Life, Job parser and combat tests pass. Fresh
  Postgres replay passes with the inventory regression. Apply
  `20261118030000_chat_inventory.sql` to the target database before releasing
  the client.

Next check a fresh campaign in Lovable after the schema and draft PR are
reviewed. Try picking up an established object, moving, dropping it and
retrieving it.

[Previous handoff](https://github.com/LeviJohnsonNC/nightcitytales/blob/5604877/docs/AI_HANDOFF.md)
covers the Agent call strip and Lovable sync.
