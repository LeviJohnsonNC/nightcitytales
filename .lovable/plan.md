# Split starting gear into its own step

Streetrat and Edgerunner characters currently see their issued package and the shopping market stacked on one page. This separates them: a new **Starting Gear** step comes first and holds the issued package (with its choices and specific-weapon picks), and **Gear & Armor** becomes purchase-only for everyone.

## New build sequence

```text
00 Method
01 Role
02 Lifepath
03 STATs
04 Skills
05 Starting Gear     <- new, Streetrat / Edgerunner only
06 Gear & Armor      <- purchasing only
07 Cyberware
08 Outfit & Lifestyle
09 Identity
10 Final Sheet
```

For Complete Package characters the Starting Gear step is hidden from the rail entirely and skipped by Back/Next, so their sequence stays ten steps long and nothing about their flow changes.

## Starting Gear step content

Moved verbatim from the current Gear page, so nothing is re-worded or re-derived:

- Weapons & Armor list with "pick exactly one" choice groups and the "?" info modals
- Specific-weapon pickers (e.g. Heavy Melee Weapon -> Spiked Bat)
- Gear list
- Outfit list plus the outfit note
- The role's "Good to know" flags
- A short header line stating the package is fixed by the role and the free spend carries into the next step

The step is complete only when every package choice and every specific-weapon pick is made — the same two rules that block the Gear step today.

## Gear & Armor step after the change

- Package block removed; the page opens straight into the Night Market intro, budget/cart rail, and the five lists
- The market intro copy now shows for all methods, since every method is here to spend money
- Budgets, cart, overspend checks, alphabetical sorting, sticky rail, and cart paging are untouched
- Remaining rule: no budget overspent

## Technical notes

- `src/features/chargen/steps.ts`: add `package` to `ChargenStep` and to `CHARGEN_STEPS` before `gear`; re-index the tail. Add a visibility predicate (`stepsFor(method)`) that drops `package` when the method is `complete_package` or not yet chosen, and derive step numbering from that filtered list so the displayed indices stay contiguous.
- `store.ts`: `next`/`back` walk the filtered list rather than `STEP_IDS`. `normalizeStep` gains no new legacy mapping, but a hydrated draft sitting on `package` with a Complete Package method resolves forward to `gear`.
- `StepRail.tsx` / `ChargenWizard.tsx`: render the filtered step list; the "Step NN / NN" counter uses the filtered length.
- `validation.ts`: split the current `gear` case — package-choice and variant checks move to a new `package` case, budget overspend stays on `gear`. `package` returns clean immediately for Complete Package. `review` aggregates over the filtered list so a hidden step can never block saving.
- `GearPanel.tsx`: extract `FixedPackage`, `PackageEntries`, `PackageItemInfo`, and `VariantPicker` into a new `StartingGearPanel.tsx` (shared helpers like `Row` move to a small local module to avoid a circular import). `GearPanel` loses its package branch.
- `StepPanels.tsx`: add the `package` case.
- No engine changes: `getGearPackage`, `unresolvedChoices`, `unresolvedVariants`, and the loadout budgets are reused as-is, and no rules values move or get restated.
- Draft persistence is unaffected — `packageChoices` and `packageVariants` already live on `state.loadout`, so in-flight drafts keep their picks and simply see them on the new page.
