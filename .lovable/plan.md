# Night City map, canonical geography, and player location

The atlas you uploaded is 15 pages: a two-page map spread (a 13,200 x 5,109 px image once the halves are stitched) plus ~24 districts and ~150 numbered locations, each with a district letter code (A1, D4, U5 …), city manager, security provider and gangs present. All of that becomes real game data.

## What you'll see in the app

- A small map pin icon in the sticky header of both the Life screen and the Job screen, next to the character sheet button.
- Clicking it opens a dismissable full-screen map modal: the Night City map, pan/zoom, a pulsing neon marker on where the character is right now, and dimmer markers for places they know (home, their fixer's bar, their ripperdoc, the current job site).
- Tapping any district on the map opens a dossier panel: the district's blurb, city manager, security provider, gangs present, and the list of canonical locations inside it.
- A "you are here" line in the Life/Job header: venue name → district → area (Island / Northside / Mainland / Southside).
- Place names inside GM and Life narration become clickable, exactly like NPC names already are, and open the same place dossier. A location the player has visited gets marked known on the map.

## How location will work in play

Today the game has no location at all: `campaigns` has no location column, and jobs use invented 2077-style district names (Watson, Pacifica) that are not in this RED atlas.

- The character starts at their home: housing chosen at creation maps to a canonical district; a "Home" place is created there.
- Every Life turn and every job beat happens somewhere. The engine owns the current place; the AI may propose a move, but only to a place that exists in the atlas data and is reachable.
- Travel costs time on the existing game clock, priced by area-to-area distance (same district, adjacent district, cross-city, off the Island). Combat zones and gang presence get flagged before the player commits.
- Job offers are anchored to real districts and real venues drawn from the atlas, so a job in the Hot Zone reads like the Hot Zone.
- Moves are appended to the ledger as `travelled` events, so the map history and the chronicle stay auditable.

## Technical plan

**Data (`src/data/atlas/night-city.json`)**
Parsed from the PDF into engine-owned rules data: areas → districts (code, name, blurb, city manager, security, gangs, `map: {x, y}` percentage centroid) → locations (code, name, blurb, tags such as bar/clinic/corp/fixer, optional `map` point). Same status as `src/data/rules/*`: nothing invents place facts in code or prompts.

**Map asset**
Extract pages 4 and 5 at full resolution, stitch the halves into one image, publish through `lovable-assets` and reference the pointer JSON. Marker coordinates are percentages of that stitched image, hand-placed by reading the map and verified visually.

**Engine (`src/engine/geography.ts`)**
Pure lookups and rules: `getDistrict`, `getPlace`, `placesIn`, `areaOf`, `isCombatZone`, `travelMinutes(from, to)` (table-driven, in the data file, marked as a house rule the way ripperdoc pacing is), `resolvePlaceMention(text)` for hyperlinking, and `canTravel`. Unit-tested, no React, no backend.

**Persistence (one forward migration)**
- `campaigns.location_key text` (nullable, backfilled to a home district for existing campaigns) plus `campaigns.known_places jsonb` for discovered places.
- Travel written through the existing turn path and appended to `campaign_events` as type `travelled`.
- Regenerate `src/integrations/supabase/types.ts` after applying.

**Feature layer**
- `src/features/atlas/`: `MapModal.tsx` (pan/zoom via CSS transform, no new dependency), `MapMarker`, `PlaceDossier.tsx`, `PlaceName.tsx` / `PlaceText.tsx` — modelled directly on the existing `NpcName` / `NpcText` / `npcDirectory` pattern so the two dossier systems look and behave identically.
- Header button added to `LifeScreen.tsx` and `PlayScreen.tsx`.

**AI contract (unchanged authority)**
The Life and GM context blocks gain a `== WHERE YOU ARE ==` section: current venue, district, area, security provider, gangs present, and the short list of reachable places with their keys. The model may propose `travel` with a place key only; `src/engine/legality.ts` refuses an unknown or unreachable key, exactly as it refuses impossible actions today. The model never sets location itself.

**Reconciling existing content**
`src/data/missions/job-content.json` districts are replaced with atlas districts and colour lines rewritten from atlas blurbs in the house voice, so generated jobs stop naming 2077 districts. Existing NPC bios that name places get their mentions linked, not rewritten.

## Order of work

1. Parse the PDF into `night-city.json`; stitch and publish the map image.
2. `src/engine/geography.ts` plus tests.
3. Migration for `location_key` / `known_places`; regenerate types.
4. Map modal, markers, place dossiers, header icon.
5. Wire location into Life and Job context, travel proposals, legality gate and ledger.
6. Swap job-generation districts to atlas districts; hyperlink place mentions in narration.
