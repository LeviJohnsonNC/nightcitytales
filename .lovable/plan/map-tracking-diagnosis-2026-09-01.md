# Map and location tracking — diagnosis

Follow-up to `walk-west-sent-you-east-diagnosis-and-fix-2026-09-01.md`. That plan
landed the compass in the engine; this one looks at what the compass is standing on.

Reproduced deterministically against `src/data/atlas/night-city.json` at 3cbcabd.
Figures rendered from `public/images/map/night-city.jpg`.

## Verdict

Position tracking works. The pin is right, it persists in one place, and the ledger
agrees with it. What fails is everything built on top of **one point per district**.

District coordinates in the atlas JSON are, to three decimal places, the arithmetic
mean of that district's venue pins — the delta between stored centroid and computed
mean is `0.00` for all 24. Night City's districts are interlocking, irregular shapes;
a mean is not where they are. **43 of 156 canonical venues sit closer to some other
district's point than to their own.** A compass built on those points is wrong by
construction about a quarter of the time.

Three handling bugs then turn a wrong answer into a silent one: an unrecognised
landmark is dropped and replaced by a direction guess, a refused move is never shown
to anyone, and the prose for a trip is written before the engine picks the destination.

## The three turns, traced

**"walk directly west… until I can't walk any more"** — from Little Europe the west
wedge contains exactly one district, Downtown, at reach 4.31. Committed: Downtown,
25 min, no heading. Downtown bears **SW** by the engine's own `directionBetween`.
The real western limit is the San Morro Bay shore, ~9% of the map further on, and the
engine has no way to express it.

**"go to the San Morro bridge"** — `resolveDestination("San Morro Bridge")` returns
`undefined`; the bridge is printed on the map image and exists nowhere in the data.
The name was silently dropped, the model's `direction: "northeast"` took over, and
`nextInDirection(downtown, NE)` returned **Little Europe** — a district nobody named,
while the prose described arriving at the bridge.

**"go east as far as I can… I can take a cab"** — 13 candidates; North Heywood wins on
projection (38.92) over Exec Zone (38.55) by 0.4%. The destination is defensible. The
prose is not: it describes east leading to the Hot Zone (on the island, 28% of the map
short) and ends with the cab still at the curb. "Cab" changed nothing — travel time is
a four-value constant table.

## Findings

| # | Finding | Severity | Where |
|---|---------|----------|-------|
| F1 | One point per district cannot answer a direction question | Critical | `night-city.json`, `geography.ts:315–420` |
| F2 | An unrecognised destination is dropped, not refused | Critical | `geography.ts:434–470` |
| F3 | Narration is written before the engine decides where you go | Critical | `useLife.ts:466–600` |
| F4 | Refused moves are invisible to both player and model | Critical | `useLife.ts:505`, `LifeScreen.tsx`, `lifeModel.ts` |
| F5 | The map's named geography (bridges, bays, canal, streets) doesn't exist in the data | Major | `night-city.json` |
| F6 | Two contradictory definitions of "in a direction" | Major | `geography.ts:295–310` vs `380–400` |
| F7 | No adjacency, no water, no bridges — every district is one hop from every other | Major | `geography.ts` |
| F8 | Transport mode is ignored (walk and cab cost the same) | Major | `geography.ts`, atlas `travel` block |
| F9 | Named venues outside the current district are unreachable by name | Major | `geography.ts:200–215` |
| F10 | First move of a campaign has no origin (`?? null`, not `?? DEFAULT_START`) | Minor | `travel.ts:36` |
| F11 | The ➜ travel line and the prose render out of order | Minor | `LifeScreen.tsx` |

### F1 — one point per district

`districtsInDirection` projects centroids onto a compass vector and keeps anything
inside a 45° wedge. With interleaved districts and mean-derived points, that ordering
does not correspond to the city. It is also why "west" from Little Europe has exactly
one candidate: the western half of the island collapses into two points 4% apart.

Worst offenders: Santo Domingo's venues span 32.5% of the map's width; New Westbrook
15.4×20.1; Watson Development 13.9×17.7. Upper Marina has 8 of 13 venues misfiled.
Reclamation Zone and Heywood Docks have one venue each, so the district *is* that
venue. Exec Zone has none — its coordinate `(74.5, 36.5)` is hand-typed.

### F2 — unrecognised destination dropped

In `resolveTravelIntent`, when a direction is present and `named` is `undefined`,
there is no branch: it falls straight through to the direction picker. Two lines to
fix, independent of everything else.

### F3 — narration precedes the decision

The model returns prose and `proposedActions` in one call; `applyResponse` writes the
narration event first, then resolves travel. There is no follow-up narration pass, so
the prose can never reflect the outcome. Skill checks already have this pattern via
`narrateFixedResult` + `resolved`. Step 4 of the previous plan called for exactly this
and was never implemented.

### F4 — silent refusals

`refuse()` writes an `action_refused` event. That type is in neither
`LIFE_EVENT_TYPES` (so it never renders) nor the `recentLifeLines` whitelist (so the
model never sees it next turn). A refused trip is indistinguishable from a successful
one, and the model re-proposes the same illegal move.

## Where a fix has to land

**Immediate, independent of the data question.** F2 and F10 are contained corrections.
F4 is two whitelist additions plus a render case. F3 reuses `narrateFixedResult` with
the committed `{from, to, direction, minutes}` as fixed fact. Those four alone would
have made the session read correctly even with today's coordinates — the engine would
have refused the bridge, said so, and narrated what it actually did.

**Districts as shapes.** Direction, extent, adjacency, "can I walk further west" and
district-of-a-point all need area, not a point. `night-city.jpg` at 3600×5573 yields a
clean land/water mask by colour threshold (verified: from Little Europe's latitude,
land runs west to x≈26.4%, then San Morro Bay), and the atlas's numbered POI icons
anchor the trace. A per-district polygon or coarse raster mask, committed as data under
the existing "the atlas is the authority" discipline, replaces the centroid and
unblocks F1, F6, F7 and the coastline answer together.

**Landmarks and streets as first-class places.** F5 and F9 are a data-model question.
Bridges, bays and named arterials are already printed on the image; adding them as
non-venue map features would let a player say "the San Morro Bridge" and be taken
there.

> **Correction (later the same day).** Two claims above were wrong, and are
> corrected here rather than edited away.
>
> This section originally added "and let the engine refuse 'Camden Court' instead
> of inventing it", and F5 said the model "cheerfully narrates Camden Court and
> Cube-A-Rama, which are also not in the data". Both **are** canonical Little
> Europe venues in `night-city.json`. The model was using real places; nothing
> was invented. What was genuinely missing from the data was the city's named
> geography — the bridges, the bays, the canal, Morro Rock — and the street
> layer, which is still missing.
>
> A third claim, made in the pull request that acted on this document rather
> than here, said Playland by the Sea (W5) was "pinned about 3.5% of the map's
> width out to sea" and looked like a coordinate error. It is not adrift: its
> marker is exactly where the atlas draws it, on a spit of land reaching north
> into San Morro Bay. What is true is that Pacifica Playground's printed
> boundary does not take that spit in, so the atlas's location list and the
> atlas's own boundary disagree about it. The location list decides, and the
> coordinate stands.

## What could not be checked

Network egress blocks `rtalsoriangames.com` and the fan map sites, so the Night City
Atlas PDF could not be opened to confirm printed district boundaries against the
coordinates. Everything above is derived from the map image in the repo, the atlas
JSON and the code — sufficient for every finding here, since the failures are internal
contradictions rather than disagreements with the source. Dropping the PDF or the
boundary-marked map variant into the repo would let the polygon work be traced against
the publisher's own lines.

> **Resolved.** The PDF was supplied. It turned out to carry the boundaries
> directly: the atlas prints them as red dotted lines over its own map, at a
> resolution more than three times the copy in the repo. They are now traced by
> `tools/atlas/trace_districts.py` rather than approximated, which settled F1 and
> F6 and made the coastline answerable. The one thing the PDF does not settle is
> the street layer — several hundred named roads, printed but not transcribed,
> and still absent from the data.
