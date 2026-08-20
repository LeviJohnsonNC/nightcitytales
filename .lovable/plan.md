# Real AI background generation on the Lifepath step

## Critique of the proposed plan

Agreed, and keeping as-is:
- Swap only the body of `generateBackground`; keep its signature `(input: BackgroundInput) => Promise<string>`.
- Reuse `buildBackgroundPrompt(input)` for the system/user text; leave `buildBackgroundInput` and `buildBackgroundPrompt` untouched.
- Delete the fake delay and the local prose stitching.
- Key stays server-side, never in the browser.
- Throw on failure so `BackgroundPanel`'s existing error state renders. No other files, no dice, no layout changes.

Three things I'd change:

1. **Not a Supabase Edge Function.** This project is TanStack Start on Lovable Cloud; app-internal server logic belongs in a `createServerFn` (typed RPC, same origin, no CORS, no separate deploy, no hand-written fetch/JSON contract). Edge functions here are the wrong boundary and add a CORS problem that doesn't otherwise exist.
2. **No `ANTHROPIC_API_KEY` needed.** Lovable AI is already wired into this project with a server-side key; using it means no secret to set, no separate billing, and the same server-side guarantee. Claude models are not in the Lovable AI catalog — the closest fast equivalents are `google/gemini-3.7-flash` (default) or `openai/gpt-5.4-mini`. If you specifically want Claude, we keep your own key path instead; that is the only reason to add a secret.
3. **Streaming vs buffered.** A 120–180 word background finishes fast, so a buffered call is fine; I'll set an explicit abort timeout so a hung upstream surfaces as an error instead of hanging the button.

Everything else in your plan stands.

## What gets built

1. `src/lib/ai-gateway.server.ts` — small server-only provider helper pointing the AI SDK at the Lovable AI gateway with the server-side key.
2. `src/lib/background.functions.ts` — a `createServerFn({ method: "POST" })` named `generateBackgroundFn`:
   - input validated with Zod: `{ system: string, user: string }`
   - calls the model with those as system prompt and user message
   - ~30s abort timeout; on gateway 402/429/other failures throws an error carrying the gateway's message
   - returns `{ text: string }`
   - unauthenticated on purpose (it only echoes prose the user already typed); it is not a public HTTP route
3. `src/features/chargen/lifepathBackground.ts` — body of `generateBackground` only:
   ```ts
   const { system, user } = buildBackgroundPrompt(input);
   const { text } = await generateBackgroundFn({ data: { system, user } });
   return text.trim();
   ```
   plus removal of the stub helpers and `delay`. Nothing else in the file changes.

## Notes

- Model: `google/gemini-3.7-flash` unless you pick otherwise.
- The prompt already forbids inventing rules/mechanics, matching the project rule that all rules values come from `/src/data/rules/`.
- Verification: run the wizard through Lifepath in the preview and confirm real generated prose appears in the editable textarea, plus a forced-failure check that the panel's error state shows.

## One decision for you

Lovable AI (no key, `google/gemini-3.7-flash`) — or Anthropic Claude Haiku with your own `ANTHROPIC_API_KEY` secret? The plan above assumes Lovable AI; say the word and I'll switch the model call to Anthropic, keeping everything else identical.

## First: two type errors to clear

Left over from the background-field work; both are one-liners:
- `src/lib/backend/characters.ts` — `SaveCharacterPayload.lifepath` needs `narrative?: string | null` (there is no `narrative` column on the lifepath table today, so the value is accepted by the payload type and ignored on write; if you want the background to persist and reload, say so and I'll add the column plus a migration).
- `src/features/roster/characterState.ts` — `stateFromCharacter` must return `background: ""` so the object satisfies `ChargenState`.
