# Price Category: keep it, but move it out of the way

## Short answer

It is not just a proxy for cost. Price Category is a real rules handle used during play, and our own rules data depends on it:

- Fixer's Operator ability ("Reach") is defined entirely in price categories — a Rank 1-2 Fixer can always source Cheap and Everyday items, Rank 3-4 up to Expensive, and so on.
- Tech's Maker ability sets the DV and build time by price category (Cheap/Everyday DV9 1 hour, Costly DV13, Premium DV17, Expensive DV21, ...), and Fabrication buys materials one category below the item.
- The DV table in our rules data also keys off the same ladder.

So a player who knows an item is "Expensive" knows whether their Fixer can get one and what it takes a Tech to build one. That is information the eurodollar price alone does not give.

But on the buying screen it is noise: you already see the exact cost, and the category sits in the stat strip competing with DMG/SP/ROF, which are decision-relevant while shopping.

## Proposed change

1. Remove the `PRICE` chip from the gear row stat strip in the market list (it duplicates the eb figure shown on the right).
2. Keep the price category in the item info modal, where it already appears in the subtitle line and the stat list — that is the reference surface.
3. In the modal, add one short line of context under the stats so the label means something, e.g. "Expensive — a Rank 3 Fixer can source this on demand; a Tech builds it at DV21." Wording follows the house voice from `src/lib/prose-style.ts`; values come only from `roles.json`, never invented.

Nothing else moves: no engine, pricing, or budget logic changes.

## Technical notes

- `src/features/chargen/GearPanel.tsx` line ~459: drop the `<Stat label="PRICE" ... />` for gear rows.
- `src/features/chargen/ItemInfo.tsx`: keep `push("Price", item.priceCategory)` and the subtitle; add the explanatory line derived from the Fixer Reach / Tech Maker text already in `src/data/rules/roles.json`.
- If any category's Fixer/Tech mapping is not stated in the rules JSON, that category shows the label alone rather than a guessed explanation.

## Alternative

If you would rather have it fully gone, I can strip it from the modal too and leave the data in the catalog for later use.
