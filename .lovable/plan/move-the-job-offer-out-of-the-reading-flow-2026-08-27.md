# Move the job offer out of the reading flow

The "Work on the table" box currently sits between the log and the current narration/options, so it interrupts the text the player is reading and pushes the input far down the page. We can fix this without changing any game logic.

## What we will change

### 1. Send the offer to the bottom
In `LifeScreen.tsx`, move `<HookCard />` so it renders after the current narration and action options, directly above the `<BottomDock>` input bar. The reading order becomes:

```text
Log history
Current narration
Suggested options (if asked)
Job offer on the table (if any)
Input dock
```

This keeps the log readable and puts the persistent offer where the player's thumb already is.

### 2. Make it collapsible
Add local state inside `HookCard` so the player can minimize the full terms sheet to a compact bar. Changes:

- Header row always shows: label, mission title, broker, payout, and a toggle button.
- Expanded (default on a fresh offer): full pitch, ask, learned facts, negotiation buttons, accept/decline row.
- Minimized: only the header bar, freeing vertical space while the player reads the log or negotiates via the input.
- The minimized state is session-only; a newly loaded or freshly generated offer starts expanded so it is not missed.

### 3. Close on accept or decline
Accept and decline already remove `bundle.hook` by changing phase or expiring the situation. We will add a short local closing transition so the card visually collapses while the mutation is in flight, rather than snapping out. No persistence or new data model is needed.

## Files touched

- `src/features/life/LifeScreen.tsx` — reorder the render so `HookCard` sits above `BottomDock`.
- `src/features/life/LifeScreen.tsx` (same file, `HookCard` component) — add minimized/closing state and a compact header bar.

## Not in scope

No changes to `useLife.ts`, `hookOffer.ts`, the engine, or the mission/phase transitions. The accept/decline mutations and negotiation logic stay exactly as they are.

## Verification

Playwright check at desktop and mobile widths: the offer renders below narration and options, the toggle collapses and expands it, and accepting/declining removes the card from the page.