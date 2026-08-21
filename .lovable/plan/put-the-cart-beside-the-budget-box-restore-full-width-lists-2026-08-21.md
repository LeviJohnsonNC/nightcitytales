# Put the cart beside the budget box, restore full-width lists

## What went wrong

My last change wrapped the whole shopping area in a two-column grid, so the tabs (Weapons / Armor / Ammunition / Gear / Fashion & Fashionware) and every item list got squeezed into a narrower left column. That is not what you asked for.

## What you actually want

Only the top strip is two columns:

```text
+-----------------------------+   +-----------------------------+
| FREE SPEND ON TOP...  400eb |   | CART · 2 LINES              |
| [====------------]          |   | Light Melee Weapon   50eb   |
| 100eb of 500eb spent        |   | Baseball Bat         50eb   |
+-----------------------------+   | CARRIED INTO PLAY: 400EB    |
                                  +-----------------------------+
------------------------------------------------------------------
| Weapons | Armor | Ammunition | Gear | Fashion & Fashionware |   |
------------------------------------------------------------------
| full-width item list, exactly as wide as it was before         |
```

- The cart sits to the right of the budget box, in the space that is currently empty.
- Tabs and all item lists go back to full page width.
- The budget + cart strip stays sticky at the top while you scroll the lists, so both remaining eb and your cart stay in view.
- The cart itself gets a max height with internal scroll so a long cart cannot push the lists off the screen.
- Nothing about sorting, buying, or pricing changes.

## Technical notes

- `src/features/chargen/GearPanel.tsx` only. Remove the `lg:grid-cols-[1fr_20rem]` wrapper added around the tabs and the `<aside>` rail.
- New structure: one sticky container holding a `grid lg:grid-cols-2` with `<BudgetBars>` in the left cell and `<Cart>` in the right cell; below it, `FashionWarning`, `PurchaseError`, and the `<Tabs>` block at full width.
- `BudgetBars` currently renders its own `sm:grid-cols-2` for the two budgets; inside a half-width cell it should stack, so the inner grid becomes single-column when it lives in the split strip (pass a className or stack it there).
- Cart list gets `max-h-64 overflow-y-auto` on the lines so the sticky strip stays a reasonable height.
- On narrow screens the two cells stack: budget first, cart second, then the tabs.
