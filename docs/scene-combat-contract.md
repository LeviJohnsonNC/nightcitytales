# Scene combat: foundation and next contract

The shared operations are implemented in `features/play/combatOps.ts`. They accept
campaign state, character, kit, events, encounter and an optional beat reference.
They neither load a mission nor ask a narrator to resolve combat. `playOps.ts`
adds the Job-specific consequence of a fatal death save. The saved engine state
owns death-save obligations; event history supplies the account of what happened.

## Persistence contract for the next milestone

These are the agreed boundaries for Phase 2, not fields accepted by the current
legacy encounter RPC. Define executable schemas when the first scene persistence
and routing consumers land together; do not send these fields to today's RPC.

| Record       | Required information                                                                                                                                                                       | Authority                                                            |
| ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------- |
| Scene        | Stable ID, campaign/location, schema version, revision, layout seed, template version, environment, bounds                                                                                 | Engine-validated current state                                       |
| Scene entity | Stable ID; optional existing campaign NPC/item link; actor/prop kind; position and orientation; supported mechanical profile; visibility and persistent condition                          | Existing campaign record when linked; approved scene state otherwise |
| Origin       | Life/Hook/Job; scene ID/revision; initiating intent; Job mission/beat/runtime revision when applicable                                                                                     | Captured before combat entry                                         |
| Encounter    | Scene revision and resolved layout snapshot; scene entity to combatant/cover mapping; engine state and per-actor obligations; protocol version                                             | Combat engine                                                        |
| Result       | Unique completion ID; origin; final encounter revision; each actor's HP, wounds and explicit exit reason; cover/object changes; ammo/armor/resource changes; final positions and exit used | Committed engine outcomes                                            |

A win flag is insufficient: withdrawal, death, surrender, capture and escape
are different facts. Preserve unknown legacy exit reasons as unknown. Never
infer that a character died from negative HP or that a departing enemy was killed.

Entry, action and exit accept unique command IDs and expected revisions. The
transaction checks ownership and the active encounter, commits state changes
and their ledger receipt together, and returns the existing receipt on retry.
An action cannot charge ammunition twice. Closing cannot apply consequences
twice or advance the campaign phase merely because a fight ended.

The scene layout snapshot is persisted rather than rebuilt from a possibly
changed template on reload. The engine validates bounds, occupancy, reachable
spawns, cover and exits. The narrator sees only the visible projection; hidden
entities and undiscovered exits never enter its public packet.

## North Heywood acceptance fixture

An authored intersection contains the player at the crosswalk, the parked
Thorton and its occupants, the rifle-carrying ganger, the food cart and neutral
workers. Stable entity IDs join the prose scene to the combatants and props.
The initial attack intent is carried into combat without granting a free shot
outside the chosen initiative rule. The fixture must work from both Life and a
Job, survive refresh during entry/play/exit, then return to its original phase
with exact injuries, ammunition, casualties, withdrawals and object damage.

## Current limitations and deployment

The foundation still uses the existing multi-write encounter/ledger flow.
Cross-tab encounter version checks exist, but the whole action is not atomic.
Life/Hook do not yet route into combat; no generated scene layout is enabled.
The signed-HP migration is pending deployment (see `supabase/migrations/APPLIED.md`).
Old mortal turns without a saved death-save round cannot prove they already
rolled; they require one save when first loaded after upgrading. New saves
preserve the obligation marker. Neutrals currently stay down; fleeing and
scene exits belong to the next supported behavior, not improvised pathfinding.
