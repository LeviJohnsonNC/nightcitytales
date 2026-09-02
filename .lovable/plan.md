# Model switch: Gemini 3.8 Flash

## Current state

The game uses `google/gemini-3.7-flash` as the default AI model for the GM, Life phase, Lifepath background/self-description, and IP judgement. Portraits use `openai/gpt-image-1-mini`.

`GM_MODEL` already overrides the chat default in `gmTurn.server.ts`, `lifeTurn.server.ts`, and `ipJudgement.server.ts`, but the default string is repeated in each file. Background generation hardcodes its model. The portrait route hardcodes its image model with no env override.

## Why I can't switch to 3.8 today

The Lovable AI Gateway model catalog does not list `google/gemini-3.8-flash`. Using an unlisted ID causes an immediate HTTP 400 `invalid_model` error, which would break every AI-driven feature in the game (GM turns, background generation, portraits, etc.).

## What I will do instead

Centralize the default model IDs in one shared constant file and wire env overrides through every AI call. This keeps the game working today on `google/gemini-3.7-flash` and makes switching to 3.8 a one-line change the moment Lovable adds it to the gateway.

1. **Create `src/lib/ai-models.ts`** with:
   - `DEFAULT_CHAT_MODEL = "google/gemini-3.7-flash"`
   - `DEFAULT_IMAGE_MODEL = "openai/gpt-image-1-mini"`
   - `GM_MODEL` env override helper for chat
   - `PORTRAIT_MODEL` env override helper for images

2. **Replace repeated hardcoded defaults** in:
   - `src/features/gm/gmTurn.server.ts`
   - `src/features/life/lifeTurn.server.ts`
   - `src/features/gm/ipJudgement.server.ts`
   - `src/lib/background.functions.ts`

3. **Add portrait env override** in `src/routes/api/generate-portrait.ts` so image model can also be swapped later.

4. **Leave behavior unchanged**: the active model stays `google/gemini-3.7-flash`.

## Verification

- `bunx vitest run` (engine/feature tests)
- `bunx tsgo --noEmit` (typecheck)
- `bun run build` (production build)
- No functional changes expected; all existing AI features continue to work.
