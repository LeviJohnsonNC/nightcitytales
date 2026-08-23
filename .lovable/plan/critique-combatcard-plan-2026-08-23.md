# Phase 2 review: attack actions in the play loop

## What still stands — and is already built

Everything the phase-2 prompt asks for landed with the combat work in the last turn. Verified in the code:

- `narrate()` in `src/features/play/usePlay.ts` now has an `attack` branch (alongside `skill_check`, `advance_beat`, and a new `start_encounter`). It resolves the GM's target key against the live encounter, skips targets that are missing, defeated, or the player, and posts an `attack_prompt` ledger event instead of rolling anything.
- One action pending at a time: a shared `promptPosted` flag means a turn posts either a check prompt or an attack prompt, never both, and `start_encounter` is ignored while a fight is already live.
- `CombatCard` renders off `pendingAttack` and the player rolls; the engine decides hit, damage, armor, and criticals.
- The outcome is fed back with the same convention as checks: `(ENGINE: combat is RESOLVED for this exchange. ...)` with an explicit instruction not to change a hit, a miss, a damage number, or who is standing.
- Encounter state is read through the existing `getActiveEncounter` / `getEncounter` helpers in `src/lib/backend/encounters.ts`, via `src/features/campaign/encounterState.ts`.

No work is needed to satisfy the prompt as written.

## What I'd change instead — the gaps phase 2 didn't cover

Three real holes remain in the fight loop. Suggested scope for the next pass:

1. **Only one card on screen, always.** The per-turn guard prevents posting two prompts in one turn, but a check prompt left unresolved from an earlier turn can coexist with a later attack prompt, and the screen would render both cards. Pick the newest unresolved prompt in the ledger and render only that one.

2. **Player death saves.** The engine already rolls them (`rollDeathSave`, `deathSavePenalty`), but nothing in the play loop surfaces one when the character drops to 0 HP or takes a mortal critical. Add a death-save card that mirrors CheckCard, rolls through the engine, and reports the result to the GM with the same ENGINE convention.

3. **Ending the fight cleanly.** The engine sets encounter `status` when a side is down, but the loop never announces it. When status leaves `active`, post a single "fight over" ENGINE line so the GM narrates the aftermath and returns to the scene, and stop offering attacks.

4. **Non-attack actions in combat.** Right now a live encounter only ever offers an attack. Let the player type a free action mid-fight (take cover, run, talk) and let the GM answer with a normal check or narration without breaking the encounter.

## Technical notes

- Prompt selection: add a single `pendingPromptFrom(events)` helper that scans the ledger backwards once and returns `{kind: 'check' | 'attack', ...}`, replacing the two independent `pendingCheckFrom` / `pendingAttackFrom` calls in `usePlay.ts`.
- Death saves: engine functions exist in `src/engine/encounter.ts`; the new work is a `DeathSaveCard` plus a `death_save_prompt` ledger event and a `commitDeathSave` mutation.
- Fight end: check `bundle.encounter.state.status` after `commitAttack` persists, and gate `pendingAttack` on `status === 'active'` (already partly done in `narrate`).
- Combat prompt version stays at v1.2.0 unless item 4 lands, which needs a line telling the GM free actions are allowed mid-encounter.
