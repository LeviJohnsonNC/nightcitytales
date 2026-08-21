# Gear info modals + package specifics

Three gaps on the Gear step:

1. General gear (Agent, Duct Tape, Medtech Bag…) has no info icon — and in fact isn't shoppable at all in the Night Market, even though the rules file already carries 48 gear rows with cost, price category, and description.
2. Items listed inside the fixed Role package (weapons, armor, ammo, gear, outfit) render as bare text, so no "?" icon.
3. Picking a generic package entry like "Heavy Melee Weapon" doesn't make you choose the specific weapon (Lead Pipe / Sword / Spiked Bat), the way the Night Market list does.

## What changes

### 1. Gear becomes a real catalog section
`src/data/rules/catalog.json` already has a `gear` array; the engine just never exposed it. Add it to the typed catalog as a new item kind, add a **Gear** tab to the Night Market with search, cost, price category, buy button, and the same "?" info modal used everywhere else. No new numbers are authored — cost and description come straight from the file.

### 2. Info icons inside the fixed package
Package entries are plain display strings ("Heavy Pistol", "Basic H Pistol Ammunition x100", "Light Armorjack Body Armor (SP11)", "Agent"). Add a pure engine resolver that maps a package label to its catalog row (kind + id, plus armor location or ammo quantity where the label says so), using an explicit name-alias table — matching only, no invented stats.

Every resolved entry then renders with the existing `ItemInfo` modal, both for fixed lines and for each option inside a "Pick exactly one" block. A label that resolves to nothing renders exactly as it does today, with no icon, rather than guessing at a match.

### 3. Specific weapon required for generic package entries
When a chosen (or fixed) package entry resolves to a catalog weapon that has variants — Light/Medium/Heavy/Very Heavy Melee, Bows & Crossbows — show a second row of variant buttons ("Lead Pipe / Sword / Spiked Bat"), mirroring the Night Market styling.

- New `packageVariants` map on the loadout, keyed the same way as `packageChoices`.
- The Gear step's validation gains one more unmet-rule line ("Pick the specific weapon for Heavy Melee Weapon"), shown with the same red-dot list already used elsewhere — nothing blocks with a red box.
- Character sheet shows the specific weapon with the generic class in parentheses, same as bought weapons.
- Save writes the variant on the package gear row's notes; the roster rehydrator reads it back so editing a saved character keeps the pick.

## Not breaking anything

- Existing loadout lines, budgets, humanity and cyberware logic are untouched.
- `packageVariants` defaults to empty, so previously saved characters and in-flight drafts load unchanged; the only new requirement applies to entries that genuinely have variants in the rules data.
- All resolution and validation logic lands in `/src/engine/` (pure), with Vitest coverage: every package label across all 10 Roles either resolves to a catalog row or is listed as intentionally unresolved, plus variant-required detection and validation.

## Technical notes

- `src/engine/catalog.ts`: export `GEAR`, `getGear`, extend `ItemKind` with `"gear"`.
- New `src/engine/packageCatalog.ts`: `resolvePackageItem(label)` → `{ kind, id, location?, qty? } | null`, alias table, `variantOptionsFor(label)`.
- `src/engine/loadout.ts`: add `packageVariants: Record<string, string>` to `Loadout` and `EMPTY_LOADOUT`.
- `src/engine/gearPackages.ts`: `unresolvedVariants(roleId, choices, variants)`.
- `src/features/chargen/GearPanel.tsx`: Gear tab, `ItemInfo` in `PackageEntries`, variant buttons.
- `src/features/chargen/{validation,saveCharacter}.ts`, `src/features/roster/characterState.ts`, `src/engine/characterSheet.ts`: carry the variant through validation, save, reload, sheet.
- Optional: add house-voice flavor entries for gear ids in `itemFlavor.ts`; items without flavor fall back to their description, which is already supported.
