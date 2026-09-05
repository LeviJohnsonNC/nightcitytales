# Roadmap

What is built, what is next, and why — in the order the product needs it.

`PRODUCT.md` says what the game is and how to decide. `AGENTS.md` says how the
code is organised and which gaps are open. This file says what to build next.
When they disagree, `PRODUCT.md` wins on intent and `AGENTS.md` wins on the
current state of the code.

---

## Now: the Tomorrow Test — shipped

The central claim in `PRODUCT.md` is that tomorrow remembers what happened
today. The loop — Life → Hook → Job → Aftermath → changed Life — existed as
separate working systems that did not reliably hand state to each other. The
closeout work connected them.

Shipped:

- Combat costs reach canonical campaign rows: HP, wound state, Death Save
  failures, armor SP, and loaded ammunition, rather than living only on the
  encounter.
- Job settlement is one locked, idempotent transaction (`settle_job`). A partial
  write can no longer lose a payout or leave tallies, pressure, or phase
  half-applied.
- Settlement re-reads fresh canonical state before planning closeout instead of
  trusting a mid-turn bundle.
- Aftermath closes atomically (`close_aftermath`).
- Wounds and armor are no longer duplicated as `aftermath_*` situations. Life
  derives them from vitals and inventory, so there is one source of truth.
- Attack ledger entries carry enough trace to reconstruct HP loss, armor
  ablation, ammunition spent, and Critical Injuries, and Aftermath shows that as
  a receipt.

The acceptance test is the loop itself: finish a job wounded, underpaid and
noticed, and tomorrow opens on a situation caused by those exact events.

Still open from this work, tracked in `AGENTS.md` under Known implementation
gaps: the bounded `JOB_LEDGER_LIMIT` settlement window, legacy encounters with
no armor inventory IDs, pressure pricing that is not causally deduplicated, and
the missing `(campaign_id, npc_id)` uniqueness constraint. None of them block
the loop; all of them are cheaper to fix now than after more systems lean on
settlement.

---

## Also shipped: the ripperdoc

Chrome was the one thing the shop deliberately would not sell. It now has its
own scene in Life: the full cyberware catalog, your ripperdoc's waiting list,
surgery, and recovery.

Shipped:

- Foundations, Option Slots, paired implants, mutually exclusive systems and
  affordability are decided in `engine/cyberwareInstall.ts`. The scene asks the
  engine what is legal; it never asks the model.
- Humanity Loss is rolled after creation the way RED says, including the
  round-up `1d6/2` form, and the loss moves current EMP — so chrome shows up in
  Social checks, in combat, and in what the GM is told about you.
- Installation commits atomically through `install_cyberware`: payment,
  Humanity, the implants and their foundations, elapsed time, ripperdoc state,
  and the ledger receipt. Idempotent on the caller's request id.
- **Chrome competes with the job.** Going under the knife during a live hook
  passes on that job, in the same transaction that installs the implant. Time
  on the table is time you did not spend working.
- Play reads live chrome from `campaign_cyberware` rather than mutating the
  saved character, and a new campaign snapshots its starting cyberware into it.
- Armor's REF penalty now reaches play through the same helper, so heavy plate
  finally costs something.

Pacing — 0/1/3 recovery days by install level, four surgery hours per physical
implant, appointment delay by disposition — is a house rule, and `catalog.json`
labels it as one beside the values it takes from the Core Rulebook. Tune it
there rather than in code.

Disposition buys an earlier appointment, never a better price. That is
deliberate: a person's opinion of you changes access, not the printed cost.

---

## Also shipped: the location layer

The atlas was finished — 24 districts, 156 locations, 180 illustrated entries —
and none of it could change what happened to a character. Location reached the
model as prose, so where you were changed how a night was described and never
what the night was. Eight steps closed that.

1. **Gameplay metadata** on every location: 42 tags, district profiles, and a
   response tier read off each district's own printed security provider
   (`places.gameplay.json`, `engine/places.ts`).
2. **The ground produces situations.** `derivePlaceBeats` sits beside
   `deriveNeeds` and feeds the same funnel, so a night market is scored against
   the rent and usually loses. No new die: a beat is simply true on some days,
   deterministically, because the world tick, the wire and the street are
   already three rolls a night.
3. **The map is a board**, not an encyclopedia. Go somewhere sits beside Act and
   Options?; pins carry signals from a closed list, three in the city and one
   per district, each tracing to a row.
4. **Places have business.** Contextual actions from tags, every one naming a
   venue, capped at five and never the menu — the freeform line is still where
   the strange thing happens.
5. **The cast keep places.** Haunts with presence by part of day, one face per
   arrival, derived rather than stored.
6. **Places change.** `campaign_places` holds dials and flags; observations
   priced against the place can close a market, and the beat that ran it stops
   firing.
7. **Jobs land on ground you know.** Generated work names a building, the wire
   prefers districts you have walked, settlement writes back to the place, and
   familiarity pays in information rather than dice.
8. **The location page** shows Right Now, People You Know Here, Open Business
   and Your History — every panel from rows that already exist, none of it
   generated.

Two rulings are worth keeping in mind before extending any of it. **Location
changes access, never printed price**, and **familiarity pays in information,
never in dice** — both are in `PRODUCT.md` under "The city", and both exist
because the alternative would have invented a rule Cyberpunk RED does not print.

Not yet done, and the honest next step: **nobody has played it.** The acceptance
test written for this work was seven in-game days inside one district, counting
situations, counting quiet evenings, and seeing whether the beats read as a
neighbourhood or as a rotation. Everything above is verified by test and by
browser, and none of it is verified by play.

Three things should wait for that week rather than be argued in advance:

- `PLACE_OBSERVATION_EFFECTS` and the thresholds in `place-state.json` are
  pacing guesses. Four loud nights closing a market may be far too fast.
- `goodwill` and `gang_pressure` move and no threshold reads them, so two dials
  currently accumulate in silence. Giving `goodwill` a threshold is the missing
  half of the favour loop.
- The Life prompt gained the response profile, the look of the place, the
  ordinary business and who is here. Worth measuring before anything else is
  added to it.

Authoring beats for more districts is the content mountain, and it is much
cheaper to find out the model is wrong before climbing it.

---

## Next: make Life feel like the actual game

Life is where the player spends most of their time and is currently the weakest
expression of the product's identity. It still reads closer to a conversation
with statistics attached than to living another life.

The work, with what the location layer already covered marked:

- Lead with one concrete situation, not a narrative transcript.
- Show time, location, immediate need, the person involved, and the pressure.
- ~~Add contextual actions~~ — done for the ground the character is standing on
  (Here you can…), still open for the character's own verbs: Pay, Repair, Rest,
  Call. Freeform input stays prominent for everything unconventional.
- Show mechanical deltas visually after resolution.
- ~~Make a quiet evening playable~~ — a quiet evening now has somewhere to go
  and something to do when it gets there. Whether it is playable is what the
  week in one district will say.
- Strengthen recurring-person presentation: portraits, relationship signals.
  The cast now have places to be; they still have no faces on screen.
- Let the player inspect campaign state without burying the active situation.

Success: the player opens the game, understands their immediate problem in
seconds, decides, sees the cost, and moves on.

This is the fastest visible improvement available, it has honest incremental
milestones, and it now has something real to render — the Tomorrow Test made
Life's inputs trustworthy.

An open product decision sits inside this work: whether `DowntimePanel` belongs
in Aftermath at all. Healing, repairing and paying bills in a utility panel
before reaching Life resolves exactly the situations Life exists to present.
Decide it deliberately rather than by default.

---

## In progress: combat as an interactive tactical mode

`PRODUCT.md` makes the battlefield the fight and narration its support. Keep
RED's Move, Action, weapon ROF, range tables and persistent costs while making
those decisions visible and directly playable.

1. **Turn foundation implemented:** board and execution share engine movement
   routes and attack previews. Intact cover blocks walking; destroyed cover
   opens routes. Shooting preserves an unused Move and any remaining ROF;
   checks and reloads spend the same Action budget. Hostiles run when choices
   are exhausted or the player ends the turn. Fixed-result narration cannot
   propose another action or change state. Regression tests cover the shipping
   handlers, including stale attack previews.
2. **Angled battlefield implemented:** a dedicated full-height combat screen,
   orthographic arena, upright units, raised cover, route confirmation and target
   previews. Move, Shoot, Reload, Improvise and End Turn remain in the command
   bar. Camera zoom/pan, keyboard selection, compact phone readouts and landscape
   controls support different screen sizes. The journal and freeform entry open
   on demand; required rolls take over the tactical readout.
3. **Immediate playback implemented:** saved movement, attacks, cover damage,
   reloads and enemy turns play in sequence with factual result lines, visible
   impacts and a skip control. Routine exchanges append an engine-written report
   instead of calling the model. Input remains locked through playback and query
   refresh; reduced-motion playback is brief and does not animate movement.
4. **Courtyard visual, character and prop passes implemented:** one Night Shift courtyard with a lazy-loaded
   Phaser 4 art layer, layered environment/cover/unit textures, saved-action
   playback and the existing accessible tactical controls. Select it in `/combat`.
   Four-direction walking, target-facing aim, firing recoil, HP-loss reactions and
   confirmed-death poses now follow saved engine outcomes. Representative character
   art remains. The richer layout adds a two-section delivery truck, generator,
   dumpster, concrete and timber cover with intact/damaged/wrecked art. Existing
   saved courtyard layouts stay unchanged. Combat feedback now includes original
   synthesized weapon/material sounds, persistent audio controls, impact particles,
   shared camera recoil and an explicit enemy-action readout. All consume saved
   outcomes; skip and reduced motion remain supported. The full HUD redesign
   follows this feedback review. See
   `docs/combat-visual-proof.md`.
5. **After visual review: improvisation:** freeform intent previews a concrete, engine-validated cost
   and consequence alongside the common actions.
6. **Tactical and mobile refinement:** encounter readability, meaningful terrain,
   pacing and touch verification.

Milestone 1 retains the existing one-Move policy and MOVE-to-metres allowance;
it does not introduce XCOM action points, split movement or cover bonuses. The
angled board is a presentation of the existing geometry. Freeform check
responses still use the GM; routine combat no longer waits for generated prose.
Playback is ephemeral and never writes state or replays historical turns on load.

Success: the player wins by repositioning into the right range band, managing
ammunition, and choosing the right target — not by describing an impressive
attack to the model.

---

## Standing debts

Not features, but they get more expensive with time. Full detail in `AGENTS.md`.

- `campaign_places` (migration `20260904030000`) has to be applied to any
  database that predates it. Until it exists, the first Life turn throws: no
  backfill is needed, but the table is not optional.
- `src/integrations/supabase/types.ts` was hand-synchronised again for
  `campaign_places` rather than regenerated.
- The `portraits` storage bucket is never created by a migration.
- Lifepath narrative, pronouns and self-description have nowhere to persist.
- Mission objectives, rewards and final campaign status are not fully updated by
  the play loop.
- Ordinary play turns still span multiple writes; only encounter saves,
  settlement and Aftermath closeout are transactional.
- `bun run lint` fails on a pre-existing `prefer-const` error.
- Migration history creates some campaign and encounter objects more than once,
  so a clean database reset is not proven.

---

## Explicitly not scheduled

Deferred on purpose, so that deferring them stays a decision:

- The full RED Critical Injury subsystem. Settlement records that a critical
  occurred; the mechanics deserve their own feature.
- Cyberpsychosis as something that happens to you. The threshold is read from
  the rules file and Life raises a `humanity_low` situation, but crossing it
  carries no mechanical consequence of its own yet.
- Netrunning as a first-class mode.
- What happens after a character death.
- General inventory consumption beyond ammunition.
