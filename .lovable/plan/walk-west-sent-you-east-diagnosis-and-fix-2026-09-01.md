# "Walk west" sent you east — diagnosis and fix

## What actually happened

You were in Little Europe, on the western side of the Island. You asked to walk west
as far as you could. The game moved you to Upper Marina, which on the atlas sits at
53% across the map against Little Europe's 36% — that is roughly 17% of the city's
width to the **east**, up by the Coronado Bay Bridge. Exactly where your first
screenshot shows the pin.

The coordinates are not the bug. Both districts are pinned where the atlas prints
them, and the pin moved to the right place for the destination that was chosen. The
bug is that nothing in the system knows which way west is.

Here is the chain:

1. The turn context hands the model a flat, unordered list of place names under
   "Places you may travel to". No coordinates, no compass, no distances, no
   neighbours.
2. You said "west". The model has no spatial data, so it guessed a plausible
   waterfront-sounding name — Upper Marina — and wrote confident narration
   ("heading west through Little Europe... down toward the salt air") to match its
   own guess.
3. The engine's job at that point is only to check the name exists on the map.
   Upper Marina exists, so the move was committed, priced at 25 minutes, and
   written to the ledger.

So the model picked the destination and the engine rubber-stamped it. That is the
opposite of the rule this project runs on: the model proposes, the engine decides.
Direction is geometry, and geometry belongs in the engine.

## The fix

### 1. The engine learns the compass

Add directional geometry to `src/engine/geography.ts`, computed from the map
coordinates already in the atlas — nothing invented:

- `bearingBetween(from, to)` and `directionBetween(from, to)` returning N / NE / E /
  SE / S / SW / W / NW, plus a rough kilometre distance from the map scale.
- `neighboursOf(position)` — the nearest districts, each tagged with its compass
  direction and travel time.
- `furthestInDirection(from, "west")` — the reachable district furthest along that
  heading, ignoring anything that would move you backwards. This is what "as far
  west as I can" means, and it is a pure function with tests.

### 2. Directional intent is resolved by the engine, not the model

The Life turn's travel handling gains a direction path:

- The model may propose `{"kind":"travel","direction":"west","extent":"far"}` as well
  as a named destination. When it names a direction, the engine picks the district —
  the model never does.
- When the model names a destination *and* the player's words said a direction, the
  engine verifies the bearing. A proposal that points the wrong way is refused the
  same way an impossible action is refused today, with the reason stated
  ("Upper Marina is east of here"), and the model re-narrates against the corrected
  fact rather than its own invention.
- If the player is already at the western edge of the Island, "as far west as I can"
  correctly resolves to the coast — a short move or no move — instead of a random
  district.

### 3. The model gets a map, not a word list

Replace the flat destination list in the `WHERE YOU ARE` block with a spatial one:

- Which area and district you are in, and which way the water is.
- Neighbouring districts written as `Downtown — west, 25 min` / `Upper Marina — east,
  25 min`, so narration that mentions a direction is at least consistent with the
  geometry.
- The prompt is tightened: never assert a compass direction the context did not give,
  and route any directional request through the `direction` action instead of
  guessing a name.

### 4. Narration matches the committed move

The travel result already knows origin, destination, direction and duration. That
gets passed into the follow-up narration prompt as fixed fact, so a trip east can
never be described as heading west.

## Technical notes

- `src/engine/geography.ts`: `bearingBetween`, `directionBetween`, `neighboursOf`,
  `furthestInDirection`, `resolveTravelIntent`; tests in
  `src/engine/__tests__/geography.test.ts` covering Little Europe → west landing on a
  western district, and the wrong-way refusal.
- `src/features/life/lifeResponse.ts`: `travel` action accepts an optional
  `direction` and `extent`, normalized like every other field.
- `src/features/life/useLife.ts`: the `travel` branch calls the engine resolver
  before `travelTo`; refusals reuse the existing `refuse(..., "impossible")` path.
- `src/features/life/lifeContext.ts` / `lifeSystemPrompt.ts`: neighbour-with-bearing
  block, direction action documented, prompt version bumped.
- `src/features/gm/gmContext.ts` gets the same `WHERE YOU ARE` block so Job turns
  behave identically.
- Verification: vitest, typecheck, production build, and a live turn asking to walk
  west from Little Europe to confirm the pin moves west and the prose agrees.

## One thing I am not doing

I am not hand-editing district coordinates. They match the printed atlas, and the
screenshots confirm the pin renders where the data says. Changing them would hide
the real defect rather than fix it.
