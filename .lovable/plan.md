# Stop impossible actions at the table

Right now nothing checks whether an action is *possible*. The GM model never sees your gear, ammo, cyberware, Role Ability rank, position or how much of your Turn is left (`gmContext.ts` sends only vitals, STATs, skills, NPCs and recent events), and the play loop only checks the *shape* of a proposed action before turning it into a roll. So the GM can happily offer you a shot from a weapon you don't carry, with ammo you never bought, at a target two range bands away, twice in one Turn.

The fix is two layers, in this order:

1. **Prevention** — tell the GM exactly what you can and cannot do this Turn, so it stops proposing the impossible.
2. **Enforcement** — a deterministic gate that refuses any illegal proposal even when the model ignores the brief, and hands the refusal back as in-fiction narration ("the Militech clicks dry") instead of a silent drop or an error box.

Nothing is decided by the model. Every legality answer comes from the rules data in `/src/data/rules/` and the engine.

## Layer 1 — the capability snapshot (engine, pure)

New `src/engine/capability.ts` builds one object describing what the character can do at this instant:

- **Weapons** — each carried weapon with its Skill, printed ROF, magazine, damage dice, range bands, rounds currently loaded, whether it is broken/unusable, and whether its ammo type is in inventory.
- **Items** — every possessed item with quantity remaining; consumables that hit 0 leave the list.
- **Cyberware** — installed only, with any prerequisites the catalog records.
- **Role Ability** — which ability and what Rank, so features above your Rank are off the table.
- **Body state** — HP, wound state, MOVE, whether you are Mortally Wounded or unconscious.
- **Position** — distance to each combatant in the live encounter, and what is perceivable/known.
- **Turn economy** — Action spent yes/no, shots taken this Turn against the weapon's ROF, movement used against your MOVE allowance.
- **Recent failures** — checks failed this beat with the same skill and the same approach, for the "no retry without a change in circumstances" rule.

## Layer 2 — the legality validator (engine, pure)

New `src/engine/legality.ts`: `judgeAction(snapshot, action)` returns either `{ ok: true }` or `{ ok: false, code, reason }` where `reason` is written for a player, not a debugger. Codes cover your list and are structured so more can be added without touching callers:

| Family | Refusals |
| --- | --- |
| Possession | item not carried, item already consumed/destroyed, cyberware not installed, prerequisite unmet, resource (eb, Luck, ammo, charges) not available |
| Weapon | no ammunition loaded, weapon broken, more attacks than ROF allows, Aimed Shot on an incompatible attack, target outside the printed range table |
| Reach & position | melee target out of reach, move beyond MOVE, target not perceivable or not located |
| Turn economy | Action already spent, movement already spent |
| Role | Role Ability not possessed, feature above your Rank |
| Netrun | no interface/access to the target Architecture |
| Physical | action the character physically cannot perform in their current state |
| Repetition | retrying a failed check with unchanged circumstances |

The table is a starting point, exactly as you framed it — each entry is one small pure function over the snapshot, so new refusals are additive.

## Layer 3 — prevention in the GM prompt

- `gmContext.ts` gains a `== WHAT YOU CAN DO RIGHT NOW ==` block rendered from the snapshot: carried weapons with rounds loaded and their reach in metres, usable items with counts, installed cyberware, Role Ability and Rank, MOVE remaining, Action remaining, distance to each visible combatant, and a short `== ALREADY TRIED ==` list of failed approaches this beat.
- `gmSystemPrompt.ts` → v1.8.0: the GM may only propose actions that this block permits; if the player asks for something the block forbids, it narrates the *attempt failing for that reason* in fiction and proposes nothing.

## Layer 4 — enforcement in the play loop

In `usePlay.ts`, every proposed action passes `judgeAction` before a `check_prompt` / `attack_prompt` is ever posted. Illegal proposals are dropped, recorded on the ledger as a `blocked_action` event with their code, and a follow-up engine turn tells the GM: *"The engine refused this: <reason>. Narrate the attempt failing for exactly that reason and offer what they can still do."* You get a scene beat, never a dead button.

Free-text intents get the same treatment: the GM proposes, the gate judges, the refusal comes back as fiction.

## Layer 5 — the UI stops offering it

- `CombatCard.tsx` — weapons already show a "gap" line; extend it to dry magazines, broken weapons, spent ROF and out-of-range targets, with those options disabled rather than rollable.
- `CheckCard.tsx` — a retry of an unchanged failed check is disabled with the reason shown.
- Suggestion chips in `PlayScreen.tsx` — any suggestion the gate would refuse is filtered out before render.

## Technical notes

**New persisted state (the parts that genuinely do not exist yet):**

- `campaign_inventory` becomes authoritative during play (today combat reads the frozen chargen sheet via `weaponChoices()` and ignores the campaign copy). Migration adds `ammo_loaded` and `condition` columns; `commitAttack` decrements rounds and consumables and marks ablation/breakage.
- Turn economy and battlefield position live in the existing `encounter_combatants.data` JSON — `actionUsed`, `shotsThisTurn`, `metresMoved`, and the already-present `distance` — so no schema change is needed for those, and `beginTurn` resets them.
- Retry memory and blocked-action history are derived from the campaign event ledger; nothing new is stored.

**Tests:** `src/engine/__tests__/legality.test.ts` covers one case per refusal code, plus the play-loop tests asserting an illegal proposal never reaches a prompt event.

## Rules data I need from you before building parts of this

Per the project rule, I will not invent values. These are not in `/src/data/rules/`:

- **Movement**: metres per Move Action from a MOVE score. Needed for "move farther than MOVE allows" and melee reach.
- **Melee reach**: the printed reach for melee weapons/unarmed.
- **Aimed Shot compatibility**: which attack types may not be Aimed.
- **Weapon condition / breakage**: whether a printed rule governs a weapon becoming unusable, or whether this stays purely narrative.
- **Netrunning**: no netrun rules data exists at all, so that refusal will be limited to "you have no Interface Plugs / Cyberdeck installed" until the Net rules land in the data files.

If you would rather not add rules files right now, I will ship every refusal that the existing data supports (possession, ammo, ROF, range, resources, cyberware, Role Ability Rank, Action economy, retry) and leave the rest stubbed and clearly marked, rather than guessing numbers.
