# Generate the one-line self-description with AI

## What you get

Next to the "One-line self-description" field on the Identity step, a small
button: **Write one for me**. Press it and the AI returns a single punchy line
in your character's own register, written in the house voice. The field stays
fully editable, and pressing it again gives a different take.

The button is disabled until the character actually has enough identity to
describe. While disabled, a short line under it says what is still missing.

## When it unlocks

All of these must be set:

- Name
- Handle
- Pronouns (this is where gender comes from: she/her reads female, he/him male,
  they/them and anything else non-binary or unspecified, and the model is told
  to respect that without making it the point of the line)
- Role chosen
- Portrait chosen

## What the model gets

Name, handle, pronouns and the gender read from them, Role and Role Ability,
plus the Lifepath facts already available (personality, clothing style,
hairstyle, affectation, value most, life goal) when the player has rolled them.
Nothing is invented: no stats, no gear, no mechanics.

The instruction asks for one sentence, roughly 8 to 20 words, present tense,
how they read at a glance to a stranger on the street. No quotes around it, no
trailing period drama, no name repetition unless it earns its place.

## Failure and waiting

The button shows a working state while it runs. If the gateway fails (no
credits, rate limited, error), the real message appears next to the field with
a retry. No silent canned fallback.

## Technical notes

- New `buildSelfDescriptionPrompt()` in a small module beside
  `lifepathBackground.ts`, wrapping the task with `withHouseStyle()` from
  `src/lib/prose-style.ts`. The voice is never restated inline.
- Reuses the existing server function `generateBackgroundFn`
  (`src/lib/background.functions.ts`), which already takes a `{ system, user }`
  pair and streams from Lovable AI, so `LOVABLE_API_KEY` stays server-side. No
  new server surface, no schema change.
- `IdentityPanel.tsx` gains the button, the readiness check, and local
  loading/error state; the result is written through the existing
  `patch({ selfDescription })`.
- Pronoun-to-gender mapping is a tiny pure helper with unit tests; it falls back
  to "unspecified" for custom pronouns rather than guessing.
- Verified end to end against the running app: a real generation, read the
  output, and confirm two runs differ.
