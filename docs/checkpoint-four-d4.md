# Checkpoint 4D.4 — screenshot-driven corrections

Levi's October 4 screenshots supersede the optimistic 4D.3 readiness assessment.
The remaining gap was not exclusively skins and lighting. This pass addresses the
observed defects and relationships; it does not claim final visual acceptance.
Based on merged PR #269 (`da2dabf`).

## Findings and changes

| Finding                                          | Correction                                                                                                                                                                                                | Preservation / limit                                                                                                                                                                                                                                                 |
| ------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Ghosted roofs obscure exterior activity          | The existing reveal control switches occluding buildings to opaque low cut masses, with a dark solid footprint and outlined rim. No translucent upper roofs/walls remain in that mode.                    | Full architecture and opaque structure-only views remain available. The footprint is still inaccessible and shot-blocking. Actor-driven fading remains for other obstructions.                                                                                       |
| Split residential vehicles                       | Replace independently cropped, incompatible atlas halves with joined procedural engine/cabin sections. Generate genuine 0/90-degree views against the shipping projection rather than flipping each half. | These are coherent placeholder cars, deliberately simpler than the old painted assets. Engine/cabin IDs, HP, targeting, damage and destruction remain independent. Applies to every scene using sedan bindings, including saved layouts.                             |
| Office furniture islands and small meeting group | Centre complete work pods within the main room; use a six-seat conference run with end storage in the larger meeting suites.                                                                              | Keep four/eight workstations, their protected aisles, walls and entrances. Preserve semantic meeting bindings for adventure facts.                                                                                                                                   |
| Warehouse support room lacks purpose             | Add an input-stock → packing bench → finished-parcel shelf group with shared handling positions at the other end of long support rooms.                                                                   | Rack capacity and freight routes stay intact. Small support rooms keep their existing repair group.                                                                                                                                                                  |
| Garage tools and cars feel disconnected          | Outline the complete saved service-bay group, including its car, tool bench and parts cabinet. Correctly joined vehicle art reinforces its orientation.                                                   | Preserve mechanic space and vehicle manoeuvring ground; no extra cars or route clutter.                                                                                                                                                                              |
| Nightclub DJ appears partitioned off             | Remove overhead doorway framing from wide internal connections (6m or wider), exposing the full-width stage/dance opening already in the saved geometry.                                                  | No wall demolition or new movement/shot rule: inspection showed the apparent partition was a frame across an existing opening. Narrow doors and outside loading/entry frames remain.                                                                                 |
| Alley alternatives feel too similar              | The non-reference south-pocket family gains an opposed east service court, with a handling apron and relocated complete service group.                                                                    | This creates a cross-yard organization alongside the middle-pocket and wide-passage organizations. Preserve reference seeds 1–3. Old south-pocket reference plus new courts yields seven normalized arrangements in the existing seed sweep, not seven new families. |
| Intersection activity/cover is too dispersed     | Pull selected parked cars closer to the crossing; bring the west shop's vendor group toward the corner where the entrance geometry allows it.                                                             | Shallow frontage and the east-shop recess retain their compatible vendor positions. All crossings, entrances and through-routes remain reserved. This is a targeted spacing correction, not a promise of the reference's density.                                    |

## Version and save behavior

New non-reference interior, intersection and alley compositions use recipe v6 and
matching template/anchor revisions. Seeds 1–3 preserve their accepted v5 geometry.
Residential geometry is unchanged and remains v5; its shared rendering changes.
The battlefield snapshot envelope remains v2 and the scene lifecycle remains v1.
The reader accepts v6 provenance using the same closed choice vocabulary and keeps
v1–v5 compatibility. Loading never regenerates a saved layout.

Seven real v5 seed-4 snapshots, generated before the recipe edits, are checked in
as preservation fixtures. Existing older fixtures and accepted-reference checks
remain in the suite. Old snapshots intentionally keep their original furniture
placement and alley walls while receiving shared rendering corrections.

## Verification and confidence

- Full suite: **3,556 tests passed across 271 files**.
- Typecheck, code lint and production build passed. Lint retains 12 pre-existing
  Fast Refresh warnings, with no errors.
- Existing sweeps cover seeds 0–63 plus integer extremes, deterministic generation,
  actor/entrance/activity access, cover damage/destruction and exact save reload.
- Added regressions for v5 preservation, warehouse packing access, office capacity
  and meeting size, usable opposed courts, and open stage/dance presentation.
- Broader testing caught and resolved an obstructed vendor placement in shallow
  frontages and a missing conference-to-adventure-fact mapping. The warehouse
  comparison now measures rack shelves separately from the new dispatch shelf.
- Offline vector captures of the actual vehicle texture drawing code were visually
  inspected in both orientations and intact/damaged/wrecked states. These are
  component drawing checks, **not browser screenshots or full-scene acceptance**.
- Local Vite still fails to bind `127.0.0.1:8080` with `EPERM`. The changes have not
  been exercised in the deployed browser. No campaign write or live combat/save
  transaction was performed in this pass. Do not equate the test result with a
  guarantee of no regressions or with reference-image readiness.

## What to send back after deployment

Generate the requested seed afresh. Do not Load review first: that intentionally
restores an old frozen layout. Keep the place, seed, recipe version and controls
visible; use the same Play area framing and zoom as the previous batch.

| Screenshot                                       | Settings / question                                                                                                                                                           |
| ------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| All seven environments, seed 4                   | Furnished, intact, characters off, reveal on for exteriors. This directly compares with the previous batch. Residential should remain v5; other seed-4 scenes should show v6. |
| Alley seeds 11 and 5                             | Same settings. Does the opposed-court layout look meaningfully different from both the middle pocket and wide passage?                                                        |
| Alley seed 11, reveal off                        | Compare with its reveal-on image. Are building boundaries understandable, with no ghost roofs across the activity?                                                            |
| Residential seed 4, damaged and destroyed        | Two images at unchanged zoom. Are both vehicle directions coherent and the damage states clear?                                                                               |
| Nightclub seed 4, characters on, target selected | Show the DJ/dance connection and target readout together. Is the opening visually continuous?                                                                                 |
| Office or warehouse seed 4, structure only       | Choose whichever still looks awkward. Show the room/access plan if a route seems wrong.                                                                                       |

Also report pass/fail (screenshots only if something fails): repeated environment
switching; reveal on/off without losing selection; save → change seed → load;
reload → load; persistent campaign movement/attack/destruction/re-entry; and a real
390px viewport for the camera controls and target readout. Explicitly confirm an
old save keeps its layout. Visual acceptance remains Levi's decision after this pass.
