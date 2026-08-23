# Make the dice show up — and let a job actually end

Three things, in priority order: fix the missing rolls, then a proper end-of-job, then a proper death.

## 1. Why you played seven turns without a die (highest priority)

Two failures compound:

- The GM has to name a skill by its exact internal id (`conceal_reveal_object`, `handgun`, `human_perception`), but nothing in the prompt tells it what those ids are. It guesses.
- When the guess doesn't match, the play loop silently throws the whole check away. No card, no die, no error — the turn just reads like a novel.

Fixes:

- **Give the GM the list.** Include the character's actual skills — id, display name, STAT, level — in the scene context every turn, and state that a check must use one of those ids.
- **Never drop a check.** Match a proposed skill by id, then by name, then by a normalised/fuzzy match ("Perception" -> `perception`, "Handgun" -> `handgun`). Only if nothing matches at all does the check get dropped, and then it gets written to the ledger as a diagnostic so this failure is visible instead of invisible.
- **Insist on rolls.** Tighten the GM prompt: any action with a real chance of failure and a consequence gets a check — sneaking, lying, spotting, shooting, driving, hacking, intimidating, patching a wound. Only trivial, unopposed actions are narrated straight. Every suggested action button must carry the skill it would use.
- **Let the player call for a roll.** A small "roll for it" control on the input bar: pick a skill, the GM sets the DV from the fiction, the card appears. The player never has to hope the GM offers dice.
- **A visible pulse.** Show the number of rolls this session in the sidebar so a dry stretch is obvious at a glance.

## 2. Ending a job properly

Right now reaching a Resolution beat quietly flips a status flag and nothing else happens.

- Objectives tick to done or failed as the beats complete, and the GM can mark one resolved through a state delta.
- On reaching a Resolution: the engine computes the payout from the mission's printed reward (per-head eurobucks plus anything upfront) and the IP award, writes both to the campaign, and closes the mission.
- A wrap-up screen: what was achieved, what was missed, the money, the IP, the butcher's bill (wounds taken, rolls made), and a button back to the roster.
- The results are written back to the saved character — eurobucks, IP, HP and wound state — so the character carries the job with them.

## 3. Death and losing

- When the player character dies (a failed Death Save, or dropping with no save left), the campaign closes as `failed` and the mission is marked failed.
- The GM gets one final instruction to write the death, and then the input is closed — no more turns on a dead character.
- A "you died in Night City" end card with the same wrap-up numbers and a route back to the roster. The character is marked dead on the roster rather than deleted.

## Technical notes

- Skill resolution moves into one helper (`resolveSkillId`) used by both `narrate()` in `src/features/play/usePlay.ts` and `describePendingCheck` in `checkPrompt.ts`; the id list comes from `src/data/rules/skills.json` via the engine, never invented.
- `renderGmUserPrompt` in `src/features/gm/gmContext.ts` gains a `SKILLS` block listing the ids the model may use; the GM prompt bumps to v1.4.0 for the "roll it" mandate.
- Player-initiated checks post the same `check_prompt` ledger event, so `CheckCard` needs no change.
- Payout and IP come from `Mission.reward` in `src/engine/mission.ts`; a new pure `missionPayout()` in the engine does the arithmetic, and a `mission_completed` / `campaign_ended` ledger event records it.
- Death detection hangs off the existing `closeOutFight` path in `usePlay.ts`, which already knows when the encounter ends and who is standing.
