# Role Select: image-first card grid with details below

Rework Step 01 (Role Select) so the ten roles read as a gallery of clickable cards, and the expanded role detail appears underneath the grid instead of in a right-hand column.

## Card grid

- Each card becomes landscape (wider than tall): art fills the card, with only the role name over it — no tagline, no "plays like" snippet, no ability chip.
- Name sits on a dark gradient scrim at the bottom of the art so it stays legible.
- Grid goes 2 columns on small screens, 3 on medium, 4 or 5 on large, spanning the full panel width (the current two-column split layout is removed).
- Selection states stay: accent border for the previewed card, primary border plus a "Selected" tag for the committed role.

## Details below

- The spotlight (art banner, tagline, Plays like, lore with Read more, Role Ability with Show how it works, and the Choose button) moves to a full-width block directly under the grid, and no longer sticks to the viewport.
- Clicking a card scrolls the details block into view smoothly and moves focus there, so the jump is obvious on both desktop and mobile.
- The spotlight keeps its wider layout: art banner across the top, text and ability details below in a two-column arrangement on large screens.

## Technical notes

- All changes are in `src/features/chargen/RolePanel.tsx` — `RoleTile` becomes an art-only landscape tile, `RoleSpotlight` gets a full-width layout, and `RolePanel` switches from the `lg:grid-cols-[1fr_26rem]` split to a stacked grid plus a `ref`-based `scrollIntoView` on preview change.
- No rules data, engine, or store changes; role content still comes from `roles.json` and `copy.ts`.
