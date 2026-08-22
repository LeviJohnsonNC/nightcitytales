# Bring the neon die everywhere dice are rolled

## Where the good animation exists today

The animated neon die (`DiceRoll.tsx` — tumble, flicker, settle pop, roll/settle sounds) is used in exactly two places:

- `LifepathTableCard.tsx` (general Lifepath rows, and every nested enemy row)
- `RoleLifepathTableCard.tsx` (Role-specific Lifepath rows)

## Where it is missing

Confirmed by searching every roll site in the wizard:

1. **STATs step — Streetrat** (`StatsPanel.tsx`): a plain "Roll 1d10" button with a fake 620ms `setTimeout` and a "Rolled N" sentence.
2. **STATs step — Edgerunner, per-STAT** (`StatsPanel.tsx`): ten plain "Roll 1d10 / Re-roll" buttons with a 420ms timeout, value shown as "…" while pending.
3. **STATs step — Edgerunner, "Roll all ten"** (`StatsPanel.tsx`): one button that rolls all ten at once behind a 620ms timeout.
4. **Lifepath "Roll how many"** (`CountRoll` in `LifepathPanel.tsx`): the 1d10−7 count roll for Friends / Tragic Loves / Life Goals / Enemies — plain button, no die.
5. **Lifepath "Roll everything remaining"** (`rollAllRemaining` in `LifepathPanel.tsx`): a bulk action, not a single die — intentionally left as a button.

No other panel rolls dice: Skills, Gear, Cyberware, Lifestyle, Outfit, Identity, Review and the Roster contain no randomness.

## What I will change

### STATs — Streetrat

Replace the button with the neon `DiceRoll` (sides 10, `value = state.statRolls.row`) plus a small "Re-roll" affordance in text. The engine still decides the number: `rollStreetratStats` runs first, its `row` is passed as the die's target `face`, and the store patch + roll-log append happen in `commit()` when the die lands. The existing `setTimeout` and local `rolling` state get deleted — the animation supplies the delay. Keep the "row N taken as written" sentence and the highlighted template table, drop the redundant "Rolled N" (the die shows it, matching the Lifepath convention already agreed).

### STATs — Edgerunner, per STAT

Each of the ten STAT cards gets its own `DiceRoll` in place of its button, `value = state.statRolls.rows[stat]` (the row, which is what the die reads). The STAT value stays on the card as it does now, and "row N" text becomes redundant next to the die face, so it is removed. Commit on land, same as above.

### STATs — Edgerunner, roll all ten

Stays a `Button` (ten dice can't animate as one die), but it will drive the ten card dice: it triggers each card's animation with a short stagger so they land in sequence, then commits. Implemented by giving each STAT card an imperative `rollNow()` handle the parent can call, or — simpler and my preference — by having the parent set a "burst" token that each card watches to start its own roll. I'll pick whichever reads cleaner while keeping engine calls unchanged.

### Lifepath — "Roll how many"

Replace the button with a `DiceRoll` (sides 10) showing the raw d10 face; the existing "N then minus 7 gives X" note stays and updates on land.

## Guarantees

- No engine changes. `rollStreetratStats`, `rollEdgerunnerStat`, `rollLifepathCount` keep their signatures and remain the only source of numbers; the die animates toward a result it is given, exactly as the Lifepath cards already do.
- No change to what gets stored: same `patch({ stats, statRolls })` payloads, same `appendRoll` labels, same roll-log entries, same validation and step-completion rules.
- Reduced-motion and the dice-sound toggle are already handled inside `DiceRoll`/`diceSound`, so both paths keep working automatically.
- Disabled/busy behaviour preserved: a die refuses re-entry while spinning, and the "Roll all ten" button is disabled during a burst.

## Files touched

- `src/features/chargen/StatsPanel.tsx` — Streetrat and Edgerunner branches only; the Complete Package point-buy branch is untouched.
- `src/features/chargen/LifepathPanel.tsx` — the `CountRoll` component only.

Nothing else changes: no engine files, no data files, no layout beyond the control swap in those two panels.

## Verification

Run the engine test suite (unchanged, must stay green), then drive the wizard in a browser: roll Streetrat, roll Edgerunner singly and all-at-once, and roll a Lifepath count — checking that the die face matches the stored row, the roll log records one entry per roll, and the step still validates.
