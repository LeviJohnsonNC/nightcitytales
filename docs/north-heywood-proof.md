# North Heywood authored combat proof

This is Phase 2a of the approved scene-combat plan. It exercises a specific scene
through the existing combat engine and diagram board. Automatic conversion of
adventure prose is not enabled.

## Trying it

1. Apply the pending migrations through `20261002060000_encounter_layout_snapshot.sql`
   to the test environment. The new entry RPC fails explicitly if absent.
2. Use an existing, expendable campaign with its opening completed. Open `/combat`
   and choose **Ulysses Street intersection**. The fixture has its own opposition;
   ordinary force selection is hidden for it.
3. Read the authored scene and start the encounter. The harness moves the campaign
   to North Heywood and preserves its current phase and mission runtime. It can
   end a previous active test fight, wound the character and spend real ammunition.
4. The player starts at the crosswalk. The Thorton is across the road, the rifleman
   beside the fender, the lookout farther along the curb, and two neutral workers
   near the broth cart. “Heavy rifle” is concretely an Assault Rifle for this proof.
   The workers borrow the existing street-thug physiology with no weapon/attack;
   this is representative test content, not a new published civilian stat block.
5. Move, shoot, reload and end turns through the existing controls. Initiative
   resolves normally: starting the fixture grants no free opening shot. Reload the
   page during the fight to check geometry, damage and actor positions.
6. When the encounter ends, the originating phase resumes. Life displays the
   factual ending and includes it in subsequent narration context. A dead character
   reaches the terminal screen. The completed encounter retains the geometry,
   actors and positions; its `encounter_ended` event includes a scene result with
   stable entity keys, wounds, exit reasons and object condition.

## What is durable

`encounters.layout` contains the resolved geometry and cover maximum HP. It is
immutable after creation. Every consumer uses `battlefieldFor(live)`, including
movement, range/cover previews, rendering, backup placement and feedback. Legacy
rows continue to use their arena key. Snapshot rows fail on an unsupported version
or invalid position instead of being snapped elsewhere or becoming open ground.

The entry RPC locks the campaign before checking for an active encounter. It does
not delete or repair historical duplicates. Snapshot writes require protocol 1
and an expected encounter version; an older client cannot write against a map
it does not understand. The existing atomic HP/armor/ammo save remains in use.

## Work still required for the full Phase 2 gate

- Persistent noncombat scene instances, origin/revision validation and revisit.
- One idempotent transaction per entry/action/closure, including ledger receipts,
  Luck and reload inventory costs. The existing operation sequence still spans
  multiple writes; interrupted opening/closure is not yet fully recoverable.
- Preserve and execute the initiating freeform attack intent exactly once. The
  harness starts the tactical encounter and waits for normal player action.
- An authenticated browser round trip on a migrated test database, including
  retries, simultaneous tabs and scene closure. Unit/render and PostgreSQL tests
  are not a substitute for that check.
- General scene creation from adventure context, interiors and scenic art remain
  later phases. Life's freeform combat improvisation is unavailable in this proof;
  it needs its own intent route rather than invoking the Job narrator.

Do not treat a merged code change as a deployed migration or enable automatic
Life combat on the strength of this harness alone.

## Verification for this slice

The unit/render suite, typecheck, code lint, production build and clean local
PostgreSQL replay pass. Authenticated browser play and a live narrator evaluation
remain unverified; no narrator API key was available in this environment.
