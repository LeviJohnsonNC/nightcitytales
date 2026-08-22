# Fix "Your Story": really call the AI, and make it longer

## What's going wrong

The story you see is not coming from the AI at all. It is coming from a local
placeholder writer.

- `src/features/chargen/lifepathBackground.ts` still exports the original stub
  version of `generateBackground()`. It waits 900ms to look like a model call,
  then stitches your Lifepath answers into two fixed sentence templates. That is
  why it reads the same every time, is always the same length, and ignores the
  house voice.
- The real server call already exists and is correct:
  `generateBackgroundFn` in `src/lib/background.functions.ts` calls Lovable AI
  (Gemini 3.7 Flash) with the house style prompt. Nothing in the app ever calls it.
- Even once wired up, the prompt itself asks for "2 short paragraphs, about 120
  to 180 words". That is shorter than you want.

## What I'll change

1. **Actually call the model.** Replace the stub body of `generateBackground()`
   so it builds the prompt with `buildBackgroundPrompt(input)` and calls
   `generateBackgroundFn` through the server function, returning the model text.
   Signature stays the same, so `BackgroundPanel` needs no rewrite.

2. **Ask for a real piece of writing.** Update the prompt in
   `buildBackgroundPrompt`:
   - at least 3 paragraphs, roughly 300 to 450 words
   - paragraph shape: origins and family, the turn that made you who you are,
     the people who matter (friends, enemies, tragic love), and where you stand
     now as your Role with your life goal
   - weave in every supplied fact, invent no mechanics
   - the house voice from `src/lib/prose-style.ts` stays the sole source of tone
     (still via `withHouseStyle`), so nothing about the voice is restated inline
   - add a light variation nudge so regenerating gives a genuinely different take

3. **Honest failure and honest waiting.** If the gateway fails (no credits, rate
   limit, error), the panel shows the real message and a retry instead of quietly
   falling back to canned text. The button shows a "weaving" state while it runs.

4. **Verify for real.** I'll run the generation end to end against the live app
   and read the actual output, confirming it is 3+ paragraphs, in your voice, and
   that two runs differ.

## Technical notes

- Client calls the server function via `useServerFn(generateBackgroundFn)` inside
  `lifepathBackground.ts`'s replacement (or the panel passes it in), keeping
  `LOVABLE_API_KEY` server-side.
- `background.functions.ts` already streams and awaits `result.text`; I'll keep
  that (long generations need the streaming path) and raise nothing else.
- No engine, schema, or rules-data changes.
