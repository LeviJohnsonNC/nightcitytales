# Cart: merge duplicate items, add quantity steppers

## What changes

Today buying the same item three times makes three identical cart lines, each with its own Remove button. Instead the cart shows one line per item with a quantity stepper:

```text
+---------------------------------------------------------------+
| Light Tattoo                              [-] 3 [+]  300eb  x  |
| gear money · fashion                                           |
+---------------------------------------------------------------+
```

- Identical purchases collapse into a single line showing the combined quantity and the combined price.
- `-` drops the quantity by one (at 1 it becomes a remove); `x` still clears the whole line.
- `+` adds one more, and is disabled when the next unit would cost more than the money left in that line's budget (and, for cyberware, when it would break an Option Slot rule). Hovering a disabled `+` explains why, using the same reason text the market already produces.
- Budget bars, "carried into play", and the cart's line count reflect merged lines, so the header reads "Cart · 4 lines" for 8 items across 4 stacks.

## What does NOT merge

Some lines are not interchangeable, so they stay separate rows:

- **Armor** — each piece is worn on a specific location and tracks its own ablation, and the rules already allow only one per location.
- **Cyberware** — each install occupies specific Option Slots in a specific foundation, and removing a foundation removes what is slotted into it. Quantity steppers are hidden on these rows; they keep a plain Remove.
- Anything differing in variant, budget, or item id stays its own stack (e.g. a "Combat Knife" Very Heavy Melee Weapon does not merge with a "Spiked Bat" one).

Weapons, gear, ammunition and fashion merge.

## Technical notes

Engine (`src/engine/loadout.ts`), pure and tested:

- `stackKey(line)` — `kind|itemId|budget|variant` for stackable kinds; unique per `lineId` for armor and cyberware.
- `cartStacks(loadout): CartStack[]` — merged view, preserving first-appearance order, each stack carrying `key`, `lines`, representative fields, `qty`, `cost`, and `stackable`.
- `canChangeQty(method, loadout, key, delta)` and `changeQty(method, loadout, key, delta)` — increment reuses the existing `canPurchase` path (so budget, fashion-only and slot rules are enforced in one place); decrement removes one line (or reduces `qty` when a single line carries qty > 1) and never needs a check. Setting quantity to 0 removes the stack.
- No change to how lines are stored, so drafts, saves, the character sheet, humanity math, and package logic all keep working unchanged.

UI (`src/features/chargen/market.tsx`):

- `Cart` maps over `cartStacks(...)` instead of raw lines; pagination (10 per page, two columns) now counts stacks.
- `CartLine` gains a stepper cluster: `-`, mono tabular quantity, `+`, then price and remove. Non-stackable rows render the current layout.
- `useLoadoutActions` gains `changeQty(key, delta)` wired to the store patch, mirroring `remove`.

Tests (`src/engine/__tests__/loadout.test.ts`): merging identical buys, not merging different variants/budgets, armor and cyberware staying separate, `+` blocked at the budget ceiling, `-` at qty 1 removing the stack.

## Verification

- Buy the same gear item five times: one line, qty 5, price 5x, budget bar unchanged versus today.
- Push `+` until the budget is exhausted and confirm it disables at exactly the right point rather than overspending.
- Buy two armor pieces on different locations and two cyberware installs: still separate rows, no steppers.
- Reload a saved draft with pre-existing duplicate lines and confirm they merge on display.
