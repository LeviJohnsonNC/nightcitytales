# Critique: CombatCard plan

## What I agree with

- **Mirroring CheckCard is the right shape.** The engine-rolls-first / die-animates-toward-it contract in `src/features/play/CheckCard.tsx` already works, and combat should not invent a second interaction idiom.
- **Engine owns the math.** `resolveAttack`, `rollDamage`, `applyDamage`, `woundActionPenalty` in `src/engine/combat.ts` are complete, cited, and tested. The card rendering only what they return is correct and matches the architecture test that keeps the engine free of React/backend.
- **Persisting with `logAttack`.** `src/features/campaign/combatLog.ts` already builds the ledger row with the full roll trace, and it is unit-tested. Reusing it is right.
- **Showing through-armor, HP after, ablation, and Critical Injury.** Those are exactly the fields `applyDamage` returns, so the display is a pure projection.

## What I disagree with / what's missing

The plan describes a component in isolation, but nothing in the play loop can produce the inputs it needs. Verified by search: `src/features/play/*` and `src/features/gm/*` contain **zero** references to encounters, attacks, or weapons; `startEncounter`, `resolveAttack`, and `logAttack` are referenced only by the engine, the backend adapter, and their tests. So as written the card would be unreachable UI.

Concrete gaps, in the order they block:

1. **No attack prompt in the ledger.** `pendingCheckFrom` (`src/features/play/checkPrompt.ts`) only recognises `check_prompt` events resolved by `skill_check`. There is no `attack_prompt` event type, no `pendingAttackFrom`, and `usePlay.ts` never posts or reads one. The GM schema has `{ kind: "attack", targetId, intent }` in `GmProposedActionSchema`, but `usePlay` never handles that branch.
2. **No target, and no combatant state.** `attack` carries only a `targetId`. There is no live encounter in the play screen: no target HP, SP, wound state, or defeat flag to feed `applyDamage`, and no place to write the resulting HP back. `src/engine/encounter.ts` and `src/lib/backend/encounters.ts` exist and are unused; combat needs an encounter to be started and loaded first.
3. **No DV source for a ranged attack.** `SINGLE_SHOT_DV` in `src/engine/combatTables.ts` is keyed by `WeaponRangeType` × distance, but the weapon entries in `src/data/rules/catalog.json` have no range-type field and no range table, and nothing in the play loop tracks distance. Melee is opposed, which is a different resolution path the plan doesn't mention. Per the project rule I will not invent a weapon-to-range-type mapping or a default distance — this needs either a decision from you or a data field added deliberately.
4. **Damage dice are a string.** Catalog `damage` is `"2d6"`, not a number; something must parse it into the `dice` argument `rollDamage` expects. That parser belongs in the engine, not the card.
5. **Armor SP is not derived anywhere.** `applyDamage` needs SP at the hit location. Character armor lives as purchased items with `sp` and `locations`; there is no helper producing `spHead` / `spBody` for a saved character, and no ablation write-back path.
6. **The GM must not narrate the outcome first.** The same two-phase discipline added for skill checks (`gmSystemPrompt.ts` v1.1.0) has to be extended to attacks, plus a follow-up narration turn fed the resolved attack result.
7. **"Add a unit test for the wiring" is too thin.** The valuable tests are pure: pending-attack derivation from the ledger, damage-string parsing, SP derivation, and the outcome projection — not a render smoke test.

## What I'd build instead

Same card, but as the last step of a small vertical slice:

1. Engine additions: parse `"3d6"` into dice count; derive `spHead`/`spBody` from a character's armor; map weapons to a `WeaponRangeType` **only** from a rules field you approve.
2. Play-loop state: start/load an encounter for the campaign, expose combatants and the active one from `usePlay`.
3. Ledger: `attack_prompt` event + `pendingAttackFrom`, mirroring `checkPrompt.ts`, resolved by the existing `attack` event type.
4. GM prompt: propose an attack and stop; narrate only after the engine resolves.
5. `CombatCard` exactly as you described, rendering engine output only.
6. Persistence: `logAttack`, plus combatant HP/SP/wound-state write-back.

## Open decisions

- Range/distance: does the GM state a distance in the attack proposal, does the card offer close/medium/long buttons, or do we treat all fights as one abstract band?
- Scope now: full encounter loop with initiative and enemy turns, or a single-attack card against a GM-described target with no turn order yet?
