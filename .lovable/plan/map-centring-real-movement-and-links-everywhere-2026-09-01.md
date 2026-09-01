# Map centring, real movement, and links everywhere

Three fixes: the map should open on your pin, the pin should actually follow the character when they move, and every block of narration should link places and people.

## 1. The map opens centred on you

The centring pass runs one frame after the dialog opens, before the map image has loaded and before the scroll area has its final size, so the offsets are computed against the wrong dimensions and get clamped near the top-left.

- Compute the centre from the exact position: a venue's own map point when the character is standing in one, otherwise the district centroid.
- Re-run the centring when the map image finishes loading and when the scroll area is first measured, not on a single guessed frame.
- Keep the view anchored while zooming: zooming in or out holds the point that was in the middle of the screen instead of jumping.
- Add a small "Centre on me" control next to the zoom buttons for when the player has panned away.
- Verify with a scripted browser run: open the map and screenshot it to confirm the pulsing marker sits in the middle.

## 2. Moving actually moves you

Right now the only thing that changes your location is the "Travel here" button in the map dossier. When the GM narrates a trip, the engine just advances the clock — the campaign's location is never written, so the pin and the header stay where they were, and the next turn's context still says Little Europe.

- The engine gains a destination resolver: a name, key or map code from the atlas resolves to a canonical position; anything else resolves to nothing. Pure, data-driven, unit-tested.
- The Life turn's `travel` action is resolved through it. On a match, the move is committed the same way the map button commits it: location and known places written, the house-rule travel time charged on the clock, and a `travelled` entry appended to the ledger. On no match, it is refused as "not a place on the Night City map" and written back as a refusal, exactly like any other impossible action.
- `travelled` joins the Life log's visible event types, so "Travelled to Estero Bay (45 min)" reads in the feed.
- After the turn, the campaign is refetched so the header line, the map pin and the known-place markers all update together.
- The context block gains an explicit, canonical destination list, and the prompt requires `destination` to be exactly one of those names — the model proposes a move, the engine decides whether it happened. Note that Estero Bay is a bay on the map, not a district; the nearest canonical destinations are what the model will be allowed to name.

## 3. Links in every text block

The feed uses the linking text renderer, but the newest turn's block underneath renders raw text, so its place and NPC names are dead. Same for the resolution text.

- Route the current-turn narration block on the Life screen through the same linking renderer as the feed.
- Audit the Job screen and the hook/offer cards for any remaining raw narration and give them the same treatment, so linking is a property of narration rather than of one component.

## Technical notes

- `src/engine/geography.ts`: add `resolveDestination(input)` plus tests; no new data invented — every name comes from `src/data/atlas/night-city.json`.
- `src/features/life/useLife.ts`: the `travel` branch of `applyResponse` calls the existing `travelTo` in `src/features/atlas/travel.ts` instead of only advancing the clock.
- `src/features/life/lifeContext.ts` and `lifeSystemPrompt.ts`: destination whitelist and the wording that makes it binding.
- `src/features/atlas/MapModal.tsx`: layout-effect centring with image-load and resize retries, zoom anchoring, recentre button.
- `src/features/life/LifeScreen.tsx`: `NpcText` in the narration section; `LIFE_EVENT_TYPES` gains `travelled`.
- Verification: vitest, typecheck, production build, plus a Playwright pass that opens the map and travels once.
