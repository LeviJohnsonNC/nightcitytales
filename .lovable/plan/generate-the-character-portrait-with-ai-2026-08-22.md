# Generate the character portrait with AI

## What you get

The Identity step's portrait area loses the filter chips and becomes a portrait
studio:

- One big 3:4 frame showing the current portrait (or a styled empty plate).
- A **Generate portrait** button under it, plus **Regenerate** once one exists.
- A small strip of the takes generated so far (up to 4). Clicking one makes it
  the portrait again, instantly and for free: nothing is re-generated, and a
  fifth take pushes out the oldest.
- The image renders progressively while it draws (blurred preview sharpening
  into the final frame), so it never feels like a dead spinner.

The button unlocks only when everything non-optional is done: Name, Handle,
Pronouns, Role, and every earlier required step of the wizard already passing
its own validation (STATs, Skills, Lifepath, gear, lifestyle). While locked, one
short line says what is still missing. Self-description stays optional, and its
"Write one for me" button no longer demands a portrait first.

## What the portrait looks like

One house prompt, built from the character, not free text from the player:
Role and Role Ability, pronouns and the gender read from them, and the Lifepath
glance facts already rolled (personality, clothing style, hairstyle,
affectation, cultural origin). Rendered as a consistent house look: waist-up
character portrait, 3:4, moody Night City street lighting, practical neon
sources, grainy photographic realism, no text, no logos, no weapons pointed at
camera. Every character in the roster ends up looking like it came from the
same art department.

No stats, no gear, no rules invented, nothing beyond the facts given.

## Cost control

- `openai/gpt-image-1-mini` at `quality: "low"`, `size: 1024x1024` — the
  cheapest image route on the gateway, and low quality at 1024 is plenty for a
  portrait card.
- Streaming with `partial_images: 1`: one preview frame, not a filmstrip.
- Takes are cached in the draft, so browsing between them costs nothing.
- A soft cap: 6 generations per character draft. Past that the button explains
  the cap and the player picks from the takes they have. Prevents an accidental
  slot-machine bill.
- Gateway failures (no credits, rate limit) surface the real message with a
  retry, no silent fallback.

## Technical notes

- New server route `src/routes/api/generate-portrait.ts` (a server route, not a
  `createServerFn`, because the streaming SSE `Response` cannot be returned from
  typed RPC). It takes the character facts, builds the image prompt server-side,
  and pipes the gateway SSE straight through. Also honors `stream: false` for
  the zero-event replay.
- New `src/features/chargen/portraitPrompt.ts`: pure prompt builder from
  `ChargenState` plus the readiness check, unit tested. Prose voice still comes
  from `withHouseStyle()` where any words are generated; the image prompt has
  its own single style constant living in that one file.
- Persistence: the final PNG is uploaded to a new private `portraits` storage
  bucket under `${user_id}/${draft_id}/${take_id}.png`, owner-scoped RLS, and
  the draft stores signed-URL-resolvable paths, not base64 (base64 in the draft
  row would bloat every autosave).
- Store gains `portraitTakes: string[]` and `portraitUrl: string | null`
  alongside the existing `portrait` id; `characters.portrait_url` is added as a
  nullable column so the sheet, roster card and JSON export can show it.
  `portrait_id` keeps working for any manifest portrait.
- `PortraitGallery.tsx` filters and presentation chips are removed. The manifest
  portraits list is currently empty, so the picker collapses to the generated
  takes; manifest portraits still render if any are ever added.
- Verified end to end against the running app: a real generation, the image on
  screen, a second take differing, reload keeping both.
