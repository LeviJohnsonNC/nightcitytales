# Put the dice back in the player's hands

## What's actually wrong

Right now the GM narrates the whole turn *first*, and only afterwards does the engine quietly roll any check the GM proposed. That produces exactly what you saw: pages of prose, a "you focus on their lips" moment, and then the next scene — no die, no DV, no success or failure. Three concrete defects:

1. **The roll is invisible.** `usePlay.ts` resolves the proposed skill check and writes it to the ledger, but the narration has already been generated, so the prose can never reflect the result. The log line it does write (`skill_check`) renders as a tiny grey monospace row that's easy to miss.
2. **The player never rolls.** There's no prompt, no button, no die. The animated neon d10 (`DiceRoll.tsx`) used all through character creation never appears in play.
3. **The GM narrates outcomes it wasn't given.** "You catch the pieces coming together" reads like a success that no die produced. That breaks the fiction/rules contract.

## The fix: a real table moment, two phases per turn

A turn that needs a check splits in two, the way a real game does.

```text
Player intent  ->  GM proposes: Skill, STAT, DV (fiction only, no outcome)
                        |
                   CHECK CARD appears: "Lip Reading (INT) vs DV 15"
                        |
                   Player clicks ROLL  ->  neon d10 tumbles
                        |
                   Engine resolves (1d10 + STAT + Skill vs DV, crit up/down)
                        |
                   Result card: 7 + 6 + 4 = 17 vs DV 15 — SUCCESS by 2
                        |
                   GM narrates the outcome it was handed, win or lose
```

### 1. Stop narrating past an unresolved check

When the GM's response contains a `skill_check` proposal, the turn stops after the setup narration. Nothing is auto-rolled. The proposal is stored on the campaign ledger as a new pending `check_prompt` event.

### 2. The check card

A styled card in the narrative log showing what the rules say is at stake — skill name, governing STAT, the character's Skill Level and STAT value, the DV and its published band name (Everyday 13 / Difficult 15 / Professional 17…, read from `dv-table.json`), and the target number needed on the die. One button: **Roll 1d10**.

### 3. The die

Reuse the existing neon `DiceRoll` component from character creation, same tumble/flicker/settle and the dice-sound toggle. The engine rolls first (`skillCheckForCharacter`), the animation lands on that number — identical to how the Lifepath cards already work. A natural 10 or natural 1 pops a second die for the exploding/imploding step.

### 4. The result readout

Under the die, the full traceable line the engine already produces: `1d10 (7) + INT 6 + Lip Reading 4 = 17 vs DV 15 — Success by 2`, with crit called out loudly when it happens. This is the `RollResult` that's already being persisted; it just gets a real display instead of a grey monospace row.

### 5. The GM narrates the result

Rolling posts a follow-up GM turn whose prompt contains the resolved outcome and forbids re-deciding it. The GM's own instructions get tightened: never describe an outcome for a check the engine hasn't resolved, and never soften a failure.

### 6. DVs come from the book

Proposals are validated against the published DV table; the GM is given the seven named bands and their values in its context, and anything off-table snaps to the nearest published band rather than being invented. All numbers stay sourced from `/src/data/rules/`.

### 7. Roll history

A small "Rolls" panel in the sidebar listing this session's checks (skill, total, DV, outcome) so the session has a visible dice record.

## What does not change

- The engine remains the only place dice are rolled; the AI never produces a number.
- No rules values are invented — DVs, crit behaviour and the check formula all come from `dv-table.json`.
- Existing campaigns keep working; a campaign with no pending check behaves exactly as it does today.
- Combat/attack proposals are untouched by this pass (they route through the same check card later, once combat lands).

## Technical notes

- `gmResponse.ts` — proposals stay as-is on the wire; add DV-band validation in `normalizeGmResponse`.
- `usePlay.ts` — split `narrate()` into `narrateSetup` (stops at a proposal) and `resolveCheck(prompt)` (rolls via `resolveProposedAction`, logs with `logSkillCheck`, then calls the GM again with the result). Expose `pendingCheck` and `roll()`.
- New event type `check_prompt` on the campaign ledger, holding skill/DV/intent; considered resolved once a `skill_check` event references it.
- New `src/features/play/CheckCard.tsx` — the card, the `DiceRoll` die, and the result readout.
- `PlayScreen.tsx` — render the check card in the log, disable the input while a check is pending, add the sidebar roll history.
- `gmSystemPrompt.ts` — bump `GM_PROMPT_VERSION`; add the "never narrate an unresolved check, never soften a resolved one" rules and the DV band list.
- Engine files unchanged.

## Verification

Run the engine tests, then play a real scene end to end: state an intent that needs a check, confirm the card names a book DV, roll it, confirm the die face equals the engine's d10, confirm a natural 1 and natural 10 each add the single extra die and never chain, and confirm the GM's follow-up narration matches the outcome on a failure as well as a success.
