# Agent calls in Life

A connected voice call shows the player and the person on the line above the current passage. The location header stays in view. The composer switches to **What do you say?**, **Reply**, and **Hang up**. The caller’s cast art and the player’s saved portrait fill the tiles when available. The tiles can also show initials.

| Outgoing at 1366 × 768                      | Incoming at 390 × 844                    |
| ------------------------------------------- | ---------------------------------------- |
| [Desktop capture](agent-outgoing-1366.webp) | [Phone capture](agent-incoming-390.webp) |

New Life passages record the phone participant and direction after checking them against the campaign and its active situation or broker offer. A reply carries that connection into the next turn. Hang up writes a ledger event and restores the regular composer. It keeps the draft and takes no in-world time. The narrator can also end the call during the story. Moving to another scene retires the connection.

The Chromium fixture checks an outgoing call from Evergreen, an incoming call at phone width, replies, a campaign refetch, keyboard hang-up with the draft intact, and ordinary text messages. The in-memory Life turn tests cover caller validation, a reply reaching the narrator with its participant, and a hang-up arriving while another reply is in flight. The screenshot dialogue is seeded. Live signed-in narration and physical phones remain outside this walkthrough.

To reproduce, build the checkout with `bun run build`, then run `node tools/life/capture.mjs /tmp/agent-call-review --call`. Set `CHROMIUM_PATH` when using a local Chromium executable.
