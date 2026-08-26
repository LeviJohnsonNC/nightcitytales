# Fix Life option responses appearing to do nothing

## Diagnosis

The option button is wired correctly: selecting it calls `life.act(...)`, records the chosen action, runs the Life turn, and refreshes campaign data.

The visible regression is ordering. `LifeScreen` renders the newest narration in a separate block **above** `LifeLog`, while `LifeLog` deliberately filters that same narration out to avoid duplicate text. On a phone, the log scrolls to its bottom after the turn, leaving the selected action visible at the bottom and the new response off-screen above it. That makes a successful option selection look unresponsive.

## Changes

- Keep the existing duplicate-narration protection.
- Reorder the Life screen so the current narration appears after the historical log and therefore immediately after the selected option in the reading flow.
- Preserve the existing narration styling, option behavior, AI turn handling, rules, and gameplay.
- Add or update a focused regression check for the ordering, then verify the interaction at the current mobile viewport: request options, select one, and confirm the resulting narration is visible beneath the selected action without scrolling upward.

## Technical scope

- `src/features/life/LifeScreen.tsx`
- A focused Life screen test only if needed for durable coverage
- No engine, prompt, backend, schema, or gameplay changes
