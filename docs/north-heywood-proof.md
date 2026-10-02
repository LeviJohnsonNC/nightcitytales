# North Heywood authored combat proof

This covers the authored scene milestones, Phases 2a–2c, of the approved plan. It exercises a specific scene
through the existing combat engine and diagram board. Automatic conversion of
adventure prose is not enabled.

## Trying it

1. Apply migrations through `20261002080000_persistent_combat_scenes.sql` to the test
   environment. Use an expendable campaign with its opening completed.
2. In `/combat`, choose **Ulysses Street intersection**, then **Stage scene without
   combat**. This relocates the campaign to North Heywood and saves the text scene,
   people and map together. It preserves the campaign phase, wounds and ammunition.
   Finish any existing fight first; persistent fights cannot be cleared without
   their ending receipt.
3. Back on the adventure screen, inspect the scene, refresh, then press **Enter
   combat**. Initiative resolves normally; entering grants no free opening shot.
4. Play through the normal board. The assault-rifle ganger, lookout, two neutral
   workers, Thorton and broth cart come from the saved scene, not a newly resolved
   template. If interrupted on an NPC turn, press **Continue combat** after reload.
5. Finish the fight. The original phase resumes. Life shows the factual ending;
   **Scene aftermath** exposes the saved summary. Death reaches the terminal screen.
6. Leave and stage the same scene again. It retains its ID, completed encounter,
   actor outcomes and damaged objects. It cannot respawn opponents or start a
   second fight. This first lifecycle deliberately has one encounter per instance.

The workers borrow the existing street-thug physiology with no weapon/attack;
this remains representative test content, not a published civilian stat block.

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

- Re-engagement of survivors and noncombat changes to a scene after its first fight.
- One idempotent transaction per entry/action/closure, including ledger receipts,
  Luck and reload inventory costs. The existing operation sequence still spans
  multiple writes; individual save receipts do not make the whole command atomic.
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

## Entry and save receipts

New snapshots require the receipt migration. Entry freezes the origin and actor
manifest and writes `encounter_started` in the same transaction as initiative.
An identical command ID/payload returns its original encounter; reusing the ID
with different content is rejected. The database compares phase, location and
mission to the expected origin before entry. It does not yet check mission-runtime
revisions. Persistent-scene entry additionally checks its saved scene revision.

NPC dice traces and player attacks can be queued into the encounter save. A
terminal save requires the factual scene result and commits its `encounter_ended`
event, stable completion ID and final version together. `closeOutFight` only
returns that description for new fights; it does not append a second ending.
The latest exact save retry returns without another state change or event. An
older retry or a different payload at the same revision is rejected.

Legacy fights keep their prior protocol. There is no automatic migration of an
in-progress fight and no automatic prose-to-combat entry. Persistent scenes are
created only by explicit staging; older standalone encounters are not retrofitted. Live browser and narrator checks remain outstanding.

## Saved scene lifecycle

`campaign_scenes` keeps the immutable starting manifest separately from the final
result. Revision 0 is ready, 1 is in combat, and 2 is resolved. The completion
projection runs inside the encounter receipt transaction; a deferred constraint
rejects directly ending a persistent fight without its result. Staging an existing
location/anchor reads the saved instance, even after a template edit. Entry checks
actor keys, sides, names and positions against that instance. The engine still owns
profiles and all rolls. Cross-phase revisits expose completed aftermath, while a
ready scene cannot silently move into another mission.

This does not yet feed a full structured scene projection into every narrator
turn. It uses the staged narration and existing factual ending context. General
freeform scene changes, world ticks, survivor re-engagement and NPC/item links are
future work; ordinary prose must not be treated as a mechanical scene update.
