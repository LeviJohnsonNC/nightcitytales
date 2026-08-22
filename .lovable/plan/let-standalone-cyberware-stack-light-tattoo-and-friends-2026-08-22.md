# Let standalone cyberware stack (Light Tattoo and friends)

## Why it isn't stacking today

Light Tattoo is cyberware, and the current rule excludes *all* cyberware from stacking. That was the right call for two of the three kinds of cyberware, but too broad:

- **Foundations** (Neural Link, Cybereye, Cyberarm, Cyberaudio Suite, Cyberleg) each provide their own Option Slots and each install is addressed individually — removing one removes what's slotted into it. Must stay separate.
- **Slotted options** (Kerenzikov, Interface Plugs, Chemical Analyzer, ...) each attach to a specific foundation line by id. Must stay separate.
- **Standalone installs** — everything not foundational and with no prerequisite: all five fashionware pieces (Light Tattoo, Chemskin, EMP Threading, Shift Tacts, Biomonitor) plus Memory Chip. These carry no foundation link and are interchangeable, so there is no reason they can't stack.

Armor stays unstacked as before: each piece is worn on a location and ablates individually.

## The change

Stacking becomes: stackable unless it's armor, a foundation, or a piece that requires another install. So buying three Light Tattoos gives one line, `− 3 +`, 300eb.

The engine's per-unit math already multiplies by line quantity in both places that matter — Option Slot usage per category and Humanity loss per install — so a stacked quantity of 3 costs the same slots and the same Humanity as three separate lines. The `+` button keeps running through the same purchase check, so the per-category Option Slot cap and the fashion-money restriction still block the last one that would break a rule.

## Technical notes

- `src/engine/loadout.ts`: `isStackableLine` gains the cyberware case — `kind !== "armor"` and, for cyberware, `!item.foundational && !item.requires`. Nothing else in the stack/quantity code changes.
- New tests in `src/engine/__tests__/loadout.test.ts`: two Light Tattoos merge to qty 2; Humanity loss and category slot usage for a stacked standalone install match the unstacked equivalent; Neural Link and a Kerenzikov slotted into it still render as separate rows.

## Verification

- Buy Light Tattoo three times in the Night Market: one row, quantity 3, price 300eb, fashion budget unchanged versus today.
- Buy two Cybereyes and slot options into them: still separate rows with no stepper, and removing one still takes its options with it.
- Stack a Humanity-costing standalone install and confirm the Humanity meter matches what separate lines produced.
