# Night Market: full-width cart with two columns

## What changes

Today the sticky header splits into two halves: budget bars on the left, the cart on the right, five cart lines per page. The new layout stacks them:

```text
+--------------------------------------------------------------+
| FREE SPEND ON TOP OF YOUR PACKAGE                       0eb   |
| [=========================================]                   |
| 500eb of 500eb spent. Unspent is KEPT                          |
+--------------------------------------------------------------+
| CART · 8 LINES                                                 |
| Light Tattoo      100eb  Remove | Chemskin      100eb  Remove  |
| Light Tattoo      100eb  Remove | EMP Threading  10eb  Remove  |
| Light Tattoo      100eb  Remove | ...                          |
| ...                             | ...                          |
+--------------------------------------------------------------+
| Previous            PAGE 1 OF 1               Next             |
| CARRIED INTO PLAY: 0EB                                         |
+--------------------------------------------------------------+
```

- Budget bar(s) go full width across the top of the sticky header. When both Gear Money and Fashion Money budgets exist, they sit side by side in that row so they still read as one band.
- The cart spans the full width underneath, with items laid out in two columns.
- Page size goes from 5 to 10 lines (5 rows × 2 columns), so most builds fit on a single page and the pager disappears.

## Layout details

- Cart items become a two-column grid on desktop (`lg`), collapsing to one column on narrow screens. Fill order is column-major so reading goes top-to-bottom on the left, then the right column — matching how the list reads today.
- Column separation uses a vertical hairline between the two columns plus the existing horizontal hairlines between rows, so the grid reads as a table rather than floating rows.
- Short pages (e.g. 3 items) keep left-column-first fill and leave the right column empty rather than balancing awkwardly.
- Each row keeps its current content exactly: name (+ variant, ×qty, location), the "gear money · cyberware" sub-label, price, and Remove. Long names keep truncating; the price/Remove cluster stays right-aligned and never wraps.
- Pager row and the "Carried into play" footer stay full width at the bottom, unchanged in styling. Pager stays hidden when there is only one page.
- Sticky behaviour is preserved: the whole band (budgets + cart + tabs + search) stays pinned and fully opaque so lists scroll underneath.
- Height guard: with 10 lines the band gets tall on small viewports, so the cart body gets a max height with internal scrolling on shorter screens, keeping the tab bar and search reachable.

## Technical notes

- `src/features/chargen/market.tsx`: `CART_PAGE_SIZE` 5 → 10; `Cart` renders a `grid lg:grid-cols-2` body with column-major ordering and divider borders instead of a single `ul.divide-y`. Row markup is extracted into a small internal `CartLine` component so both columns share it.
- `src/features/chargen/GearPanel.tsx`: replace the `lg:grid-cols-2` wrapper around `BudgetBars` + `Cart` with a stacked column — `BudgetBars` full width (its internal grid handles 1 vs 2 budgets), then `Cart` full width below.
- `BudgetBars` already accepts `className`, so the full-width variant is a prop change, not a rewrite.
- No engine, pricing, or purchase-logic changes; this is presentation only. Existing tests stay green.

## Verification

- Check the Night Market with 1, 3, 8 and 12 cart lines: column fill, pager visibility, and that removing the last item on page 2 falls back to page 1 correctly.
- Check both a Streetrat/Edgerunner package build (single free-spend budget) and a Complete Package build (gear + fashion budgets) so the budget row looks right in both.
- Check narrow/tablet widths for the single-column collapse.
