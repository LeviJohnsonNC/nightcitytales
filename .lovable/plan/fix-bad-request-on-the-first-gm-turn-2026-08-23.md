# Fix: "Bad Request" on the first GM turn

## What's actually wrong

The GM turn asks for a model the AI gateway doesn't offer. The gateway rejected it instantly (2 ms, HTTP 400, `invalid_model: anthropic/claude-sonnet-4`), and the play screen surfaced that as "Bad Request".

Everything else in the play loop is fine — the auto-open scene fired correctly, which is why you see "The GM is thinking..." and then the error. The rest of the app's AI (backgrounds, self-descriptions, portraits) uses allowed models and works.

## The fix

1. Point the GM at `google/gemini-3.7-flash`, the same model the background/self-description generators already use successfully. Drop the "tuned for Claude" note and the Anthropic-only comment in `src/features/gm/gmTurn.server.ts`.
2. Guard against a silent repeat: if `GM_MODEL` is set to something the gateway rejects, catch the gateway error in the server function and surface a clear message ("The GM model is unavailable") instead of a bare "Bad Request".
3. Show gateway failures usefully on the play screen: keep the player's last input in the box and offer a "Retry" button rather than a dead-end red line.

## Technical notes

- `src/features/gm/gmTurn.server.ts`: `DEFAULT_GM_MODEL = "google/gemini-3.7-flash"`; wrap `generateObject` in a try/catch that maps 400/401/402/403 to specific messages and rethrows 429/5xx as retryable.
- `src/features/gm/gmResponse.ts`: Gemini's structured-output mode is stricter than Claude's about `discriminatedUnion` and `nullish()`. If the first live call returns a schema error, flatten `suggestedActions.skill` to `z.string().default("")` and keep the unions as-is unless they also fail — I'll verify with a real call after the model swap rather than pre-emptively rewriting the contract.
- Verify by starting a fresh adventure and confirming the opening narration plus suggested-action buttons render, then re-check the gateway log for a 200.
