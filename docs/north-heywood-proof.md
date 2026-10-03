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
in-progress fight. Typed entry is limited to explicitly staged scenes. Persistent scenes are
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

## Typed opening request (Phase 2d)

Deploy `20261002090000_scene_attack_intent.sql` before the client change. The
previous persistent-scene migration has been confirmed applied. Typed requests
use a distinct RPC entry point so an older deployment rejects them before writing
a fight instead of silently dropping the request.

1. Stage a fresh North Heywood scene from `/combat` and return to its adventure.
2. Type **shoot the rifleman with my pistol**. The saved actors and map enter
   combat; initiative may let the opposition act first. The rifleman shot is
   queued for the player's roll with carried pistols only. Its range/cover/DV
   come from current combat state. A missing or empty pistol cannot be fired.
3. Refresh before the first Action. The request survives, including if the
   opening NPC sequence needs **Continue combat** to finish. A Death Save, when
   owed, still takes priority over an attack.
4. Alternatively, on a fresh scene type **pull out my pistol and start blasting**.
   The battlefield asks for a hostile target instead of guessing which ganger.
5. Cancel, shoot, reload, or end the first turn. Refresh: the opening request must
   not return. Cancel a blocked shot to move or choose a different weapon. Opening
   NPC movement is reflected in the shot's current range and cover. The normal
   engine remains authoritative for legal actions.
6. Finish combat and verify the existing saved aftermath and phase return.

This is deliberately a small full-command grammar: `shoot <name>`, `shoot at <name>`, `attack <name>`,
`fire at <name>`, `open fire`, and `start blasting`, optionally preceded by `I` or
`draw/pull out my pistol and`, or with `with my pistol` on a targeted shot. Named
targets must uniquely match a saved hostile's name, name suffix or ID. Unknown,
ambiguous and neutral targets are refused before initiative. Questions, threats,
negations and conditional targets do not auto-enter. Unrecognized phrasing takes
the existing narrator path; this is not general language understanding.

Entry atomically records player input and the immutable intent with the existing
scene/encounter transaction. The first accepted entry wins when tabs race. The
prompt is derived from that origin and consumed by persisted first-turn Action
state, turn progression, or the existing cancellation ledger. No extra shot is
resolved before initiative, and there is no separate post-entry prompt write to
lose on a failed response. Authenticated browser verification remains outstanding.

## October 2 player playtest fixes

A fresh Life adventure entered the correct saved intersection through `open fire`.
The player then reproduced a rejected `shoot at the rifleman with my pistol`, a
board stuck on “Resolving / Waiting on the dice” with End turn still working, and
an `encounters_status_check` error on a later terminal save.

- `shoot at` now resolves the same saved target as `shoot`.
- Pointer events during an open dice card no longer store `resolving-action` as
  persistent board intent. After the card closes, movement and target selection
  resume from the previous selection. This is independent of the weapon's legal
  ROF; a Very Heavy Pistol's ROF 1 still limits it to one shot per turn.
- Apply `20261002100000_repair_encounter_status_constraint.sql` to reassert the
  same outcome vocabulary the save RPC already validates. The repair preserves
  active fights and combatants. It normalizes only legacy fled/abandoned statuses
  to resolved. The deployment's exact constraint definition was not inspected;
  a local regression recreates the historical narrow constraint, reproduces the
  rejection, then verifies the repair and repeat application.

After deploying the fixes, reload the existing fight to clear the old local
interaction state and read the last committed state. A failed transaction must
not be treated as a recorded shot or completed fight. Resume from that state;
verify ammo changes, movement after firing, and the return to Life on completion.
The previous screenshots showed an unchanged 8/8 magazine, so they do not prove
that the reported first shot committed. The revised flow still needs player
retesting in the deployed browser.

Those interaction fixes left displaced scene controls, old narration and
diagram-only battlefield art for presentation work. The next section records
the follow-up and remaining graphics work.

## Scene and withdrawal presentation

Levi's follow-up confirmed that targeted typed entry, ammo 8/8 → 7/8, movement,
withdrawal outcomes and return to Life with 12/45 HP work. The generic out marker
made both withdrawals look like deaths, and older narration dominated the return.

The presentation now reads the same explicit disposition as the ending receipt:
withdrawn actors have an arrow and “Withdrew”, confirmed deaths retain a cross,
and legacy removals without a reason say “Out of fight”. Last-position markers
are not a claim about where a withdrawn actor currently is. A departure list
remains visible after playback/refresh; newly saved withdrawals also show whether
morale broke or their objective was met. Old saves retain their known reason
without inventing a cause. Illustrated withdrawn bodies disappear rather than
remaining as corpse-like sprites. Neutral diagram actors no longer hold pistols.

Life places its current narration/aftermath first, followed by scene controls and
a collapsed Earlier adventure history. Prior events are still readable. The
resolved scene does not repeat its summary in a second control card. Job scene
controls also move inside the narrative column.

No migration is needed for these changes; the cause is an optional addition to
existing combatant JSON. This does not change initiative, AI morale/goal decisions,
ROF, damage, or the model's context. The scenic follow-up below adds a street-specific recipe rather than reusing
the courtyard's baked ground or crate mappings.

## North Heywood scenic pass

The saved `scene:north-heywood-intersection:v1` layout now defaults to scenic view.
No migration, restaging or new encounter is required for an existing active v1 fight.
Resolved fights remain resolved; stage a fresh scene/adventure to replay combat.

- The existing Phaser layer renders a dry, worn street and crosswalk using the
  exact same projection as movement, targeting and cover. Surface markings and
  light pools are decorative; no new barriers, weather rules or obstacles exist.
- The olive-drab cruiser is two adjacent sprite sections, with separate intact,
  damaged and wrecked states following the engine/cabin HP pools. The broth cart
  has its own three states. Wreckage retains its original footprint and sorts
  below moving actors. Rendered objects read positions from the saved snapshot.
- Both workers use unarmed crouched poses, matching their existing stays-down
  behavior. A prone pose requires an explicit saved death. Withdrawn characters
  leave the illustrated scene and retain the labelled departure marker.
- Existing player/ganger movement, facing, shots and hit effects are reused at
  a street-appropriate scale; SVG hit regions and muzzle offsets follow it.
- Scenic selection checks the supported version, dimensions, object IDs and
  footprints. A different layout uses the diagram, rather than drawing a street
  or object appearance unsupported by that snapshot. The three legacy courtyard
  keys retain their original art and scale.
- Diagram view remains available. Missing assets or WebGL context loss restores
  it, and Scenic view retries. Reduced motion retains the existing playback policy.

Local Chromium/WebGL validation used the real CombatBoard and renderer with an
isolated in-memory fixture, not a logged-in campaign: desktop 1440×1000 and phone
390×844, keyboard move/zoom, toggle/reload of textures, independent engine damage,
withdrawal marker/body removal, courtyard regression, missing-asset fallback and
context-loss retry. No browser exceptions or horizontal phone-page overflow were
observed. Phone overview labels are small; camera zoom and pan remain available.
Unit tests cover layout rejection and per-section damage/footprint agreement.
Authenticated deployment playtesting still needs to confirm the complete round trip.

Assets: `public/images/combat/north-heywood/street-props.webp` (1254×1254) and
`workers.webp` (1536×1024), generated for this game and losslessly encoded without
resizing, about 1.9 MiB total. Runtime extraction releases the source GPU textures.
Full prompts and the orientation correction are in `north-heywood-art-prompts.json`.
The workers use inspected crop metadata to remove stray alpha specks and light
halos while keeping the bag and pose scale. Ground is a deterministic canvas
surface, not a generated background with accidentally baked-in cover.

Limits: this is the authored North Heywood recipe, not scenery generation from
arbitrary prose. Player and hostile sprites still depict representative armed
mercenaries; their clothes and weapon silhouettes do not yet follow loadouts.
There are no new civilian movement decisions, drivable cars, explosions or invented
retreat paths. The street is an approximation of the saved local scene, not an
assertion about the canonical geography of Ulysses Street.


## Opening clarity and movement pacing

Player feedback found that arriving wounded did not explain whether opponents
had acted first. `beginEncounter` resolves opening NPC turns before returning;
its ephemeral playback can be published before the combat screen subscribes.
The first player turn now shows an initiative recap derived from the saved
order and matching scene-entry attack receipts. Hits/misses and recorded HP/SP
transitions survive refresh, and the recap leaves the main view on later rounds.
It never subtracts HP from maximum to invent an opening wound. Without matching
receipts it reports only initiative order. Legacy starts, which write their start
row after the opening, are excluded from this reconstruction. This adds a durable
explanation; it does not replay missed entry animations or change initiative.

Attack feedback on the main board uses the saved result rather than the full roll
formula. Roll details expand on demand, and the full journal remains unchanged.
The expandable controls receive pointer events above the map; other hint text
stays click-through. Walking takes 0.85–1.8 seconds based on saved path length,
with a 150ms walk-frame cadence and matching footsteps. Skip and reduced-motion
behavior remain unchanged. No SQL migration or narrator changes.

Validation includes first-turn receipt isolation/refresh, absence of invented
pre-existing damage, later-round dismissal, queue timing, compact feedback and
footstep timing. Local Chromium verified desktop/mobile rendering, collapsed and
clickable roll details, first-turn recap after reload, and continued movement
animation at 800ms. These are isolated fixtures, not a replay of Levi's saved fight.
