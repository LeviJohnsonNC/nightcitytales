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
- `goodwill` moves and no threshold reads it. (`gang_pressure` has one now, at
  8; this line used to name both.) Auditing it turned up more than a dial:
  `raided`, `locked_down`, `power_out` and `rebuilt` are set and read by
  nothing either, so half the flag vocabulary is decoration. Giving `goodwill`
  a threshold is still the missing half of the favour loop, and still only half
  a fix — a flag needs something that reads it. Standing debt 14.
- The Life prompt gained the response profile, the look of the place, the
  ordinary business and who is here. Worth measuring before anything else is
  added to it.

Authoring beats for more districts is the content mountain, and it is much
cheaper to find out the model is wrong before climbing it.

---

## Also shipped: the Role you chose

Ten Role Abilities were transcribed and modelled in the engine, and almost none
of them reached the player. The narrator was told about a Role exactly once, as
a ceiling — "Role Ability: Operator at Rank 4 — nothing above that Rank" — so a
Fixer, a Nomad and a Lawman standing in the same alley were offered the same
three things to do. This pass made the Role something to reach for.

Shipped:

- **A Solo's Precision Attack now hits things.** `combatAwarenessEffects`
  computed the bonus and nothing added it to the To-Hit roll, so the most
  obviously attractive option on the Combat Awareness panel bought nothing.
  Found beside it: combatant rows carry no Role effects, so a fight read back
  from the database came back with the whole ability switched off — Initiative
  survived only because it is rolled once and stored as a number. Effects are
  recomputed on load rather than persisted, which is also what lets a division
  made between fights reach the next one, and the "first this Round" marks now
  survive a save so Spot Weakness and Damage Deflection stay once a Round.
- **The Role reaches the narrator as an invitation.** A new
  `WHAT THIS ROLE REACHES FOR` block in both the Job and Life contexts, from
  `engine/roleAffordance.ts` and its house-rule data, and a prompt rule that at
  least one offered option be a move only this character would think of. It
  grants nothing: the capability ceiling still refuses anything above the Rank.
- **The ground offers Role work.** `placeActions` takes a Role id and offers up
  to two cards nobody else sees — the Lawman's terminal, the Fixer's fence, the
  Nomad's lift, the Medtech's clinic — found by the same tags, at named venues,
  on their own budget so the district's ordinary business is never displaced.
- **A Medtech recovers differently.** The printed drugs do the work: Antibiotic
  as a course through a rest (+2 HP a day for a week, and it runs out), and
  Speedheal as BODY + WILL at once. Beside them a small house-rule self-care
  bonus, capped well below BODY, so the empty-bag days still differ.
- **The Fixer can argue and can source.** Operator Reach takes the stock die off
  the table inside the Fixer's own price categories — the printed "always
  source", which `priceCategoryContext` had been parsing for nobody — and the
  shop takes an opposed Trading check for the price, once per visit, worth the
  Fixer's printed ±10%/±20% band and a smaller house-rule band for everybody
  else.

Both of those closed in the passes below.

---

## Also shipped: the Tech can build things

Fabrication Expertise, which is the half of Maker that makes a Tech a Tech. The
numbers were all already here and none of them had a consumer:
`priceCategoryContext` had been parsing the Maker DV-and-time table out of the
Tech's own rules text since it was written, for nobody, and the price ladder
that says what materials cost went in with the Fixer's Reach.

Shipped:

- `engine/fabrication.ts` joins them: materials one price category below the
  item, the printed DV and time, and TECH + the item's repair Skill + the
  Fabrication Expertise Rank + 1d10. A 500eb weapon out of 100eb of parts and a
  week at the bench, which is the whole fantasy and is printed.
- The time is the cost. A build spends its printed duration off the campaign
  clock whether or not it works, so a fortnight at the bench is a fortnight of
  rent — and a failure costs that fortnight and not the parts, exactly as the
  rules say.
- Parts already bought stay bought. `role_state.maker.materials` remembers which
  builds have their materials, so the retry the rules promise costs only time.
  No schema: it lives in the blob the Role panel already writes.
- A Workshop sheet in Life, which renders nothing at all for a character without
  Maker.
- The Role panel stopped lying: Fabrication Expertise no longer reads
  "(not modelled)".

Deliberately not built: **Invention Expertise**, because it needs the GM to
approve a new item and set its rules and Price Category — the narrator authoring
mechanical values, which is the one thing `PRODUCT.md` does not allow. It is not
a gap to be closed later; it is the boundary working.

**Upgrade Expertise** is a real gap and is the next Tech pass. It modifies an
item that already exists, and per-item modifications have nowhere to live: an
armor row carries `current_sp` but takes its maximum from the catalog, so
"+1 SP" needs a per-row modification concept that armor derivation, chargen
display and combat would all have to read.

---

## Also shipped: the Nomad has wheels, and a Media story lands

The last two Roles whose ability existed and did nothing.

**Nomad.** Moto rode on Drive and the vehicle Tech Skills, applied to a machine
that did not exist anywhere in the game — a modifier looking for a subject.

- `engine/vehicles.ts` parses the printed Family Motorpool and its Rank tiers
  out of the Nomad's own rules text, the discipline `priceCategory.ts` and
  `haggle.ts` already use. Only the SPECS are ours, and `vehicles.json` says so.
- One vehicle out at a time; call the Family and they swap it the next morning,
  as printed. The swap lands on READ rather than on a tick somebody has to
  remember to run.
- Travel is the advantage. A vehicle is waiting where you left it, so it answers
  for any trip the player did not say was a walk, and an air vehicle pays nothing
  to cross a bridge — which falls out of the route the engine already walks.
  `travelTrip` takes a rule as well as a mode name, so the atlas never has to
  carry an entry for every machine in the motorpool.
- The vehicle is in the capability block, so the narrator can offer a getaway and
  cannot offer one to a character on foot.

Deliberately not built: **vehicle combat, SDP and SP.** Nothing in this build can
damage a vehicle, so a durability number would be a field nobody reads and the
printed 500eb/one-week Family repair would be a rule nothing can trigger — the
exact dead code this run of work exists to remove. It arrives with vehicle
combat, not before.

**Media.** Credibility was the most complete Role Ability in the engine and the
least consequential in the game: the roll worked, the panel printed "the
neighbourhood believes it", and nothing anywhere changed.

- A believed story now moves two dials in opposite directions. Segments come OFF
  that faction's clock — the printed Impact column says "local bad guys arrested
  or ousted", so what they were building against you loses that much momentum —
  and their standing falls, because they work out who wrote it.
- **Evidence is no longer a number the player types.** It is what the character
  has actually found out since their last story on those people, counted from
  the truth system. That also answers the printed "you can't publish another
  story on the exact same topic without new information": no new truths, no
  story. A Media's loop is now go and find something out, then publish it.
- The numbers are a house rule in `story-impact.json`; the bands they hang on are
  the printed Credibility ranks.

Still open for the Media: passive rumor pickup, which needs somewhere for a
rumor to point.

---

## Also shipped: a Role picker that sells the game it is selling

Four passes made the Roles real and the character creator never heard about it.
It sold every Role with 2,345 characters of printed rank table behind a button
marked "Show how it works", beside a third-person encyclopedia entry. Nobody has
ever chosen a class because of a rank table.

Shipped:

- **The same alley, ten answers.** One street corner, rendered identically for
  every Role, and underneath it what THIS one sees in it. Switch Roles and the
  alley does not move; the answer does. That comparison is the decision, and a
  list of ten descriptions can never make it. `role-affordances.json` now carries
  the player's second-person half beside the narrator's third-person half — two
  audiences, one file, because the moment they live apart they start disagreeing
  about what a Role is for.
- **What you get on the first night, computed.** `engine/roleOpening.ts` asks the
  engine rather than a copy file: 100eb of Premium parts and a week at the bench
  becomes a 500eb Very Heavy Melee Weapon; a Fixer sources anything up to
  Expensive without a roll; a Nomad has a Compact Groundcar outside. Every figure
  moves when the Rank moves, which is the test that stops it being a sentence
  somebody typed.
- **The printed rules are still there**, one click away at the bottom. They are
  simply no longer the door. The book's tagline and lore moved below the fold,
  for the player already sold and wanting to sink in.
- **The Netrunner says so.** Marked plainly as coming in its own update rather
  than sold as an equal and disappointing somebody forty minutes in.

Still open: a "compare all ten at once" screen, which is the same data on one
page and is the thing that would actually settle a hard choice.

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
   outcomes; skip and reduced motion remain supported. The finished HUD adds saved
   player/cast portraits, catalog weapon art and live ammo, a compact target
   readout, and a persistent dock with “Try something…” alongside common actions.
   Desktop and phone layouts keep the battlefield and controls available. See
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

## Also shipped: making Local Expert mean something

Local Expert is the one Skill in RED that is worth nothing in the wrong place —
you choose a neighbourhood whenever you raise it, and the atlas's districts are
already that scale. Every starting character has it, and until now it was
decoration: the Role packages grant `Local Expert (Your Home)` and nothing ever
resolved the phrase, while every check path reduced a Skill line to
`{ skillId, level }`, so a character who knew Little China rolled at full Level
in Pacifica and the narrator was shown a number the engine would not add.

The stages, in dependency order:

- ~~Stage 0: make the specialization load-bearing~~ — `src/engine/localExpert.ts`
  resolves a stored specialization (a district key, a printed code, a name, or
  the `Your Home` placeholder read through the character's home district) to a
  district, and `skillLevelFor` is now the single lookup every check goes
  through. A place-scoped Skill is read for the district the character is
  standing in and is worth 0 where they are not a local; the roll log, the check
  card and the model's own Skill list all name the neighbourhood the Level is
  for. Language and every unspecialized Skill are untouched.
- ~~Stage 1: chargen picks a real neighbourhood~~ — the free-text box is a
  district picker (grouped by part of the city, with a ★ on whatever the
  character's childhood points at, a highlight and never a filter), `Your Home`
  is offered as a deliberate deferral because the printed creation order puts
  Skills before housing and must not be reordered, and Complete Package now
  seeds Local Expert on that placeholder — the rules minimum used to demand a
  Basic Skill the wizard never created, so the one Skill everybody has was the
  one the player had to invent. `skillEntryName` resolves a place-scoped
  specialization to the district's printed name, given once in
  `sheetSkillLines`, so the chargen sheet, the roster and the in-play drawer all
  read "Local Expert (The Glen)". The home picker's spotlight says what the
  address does to the Skill, which is the moment the choice stops being flavour.
  Validation refuses a line naming somewhere the map does not have, which is
  what a draft saved before the picker can hold.
  No separate final-gate check: `validateLifestyle` already requires a district
  and a building, so a character cannot be saved with the placeholder
  unresolved, and a second mechanism would only be a second thing to keep true.
- ~~Stage 2: pay in information, through the ladder that already exists~~ —
  `placeIntel` now has two routes up one ladder. Visits are earned a building at
  a time, as before; Local Expert opens the same rungs for every address in its
  district, so a local walks into a building on their own street they have never
  entered and still knows what it is, who claims it, and who answers when it
  goes loud. Both ladders and their numbers live in `place-intel.json`, flagged
  `houseRule: true`, so the thresholds are tunable without touching code
  (currently: Local Expert 2 opens `what`, 4 opens `who` and `law`, 6 opens
  `neighbourhood`).

  Two rungs are deliberately not interchangeable, and the asymmetry is the
  design. `state` can only ever be visited for — it reports what has changed
  here since you started coming, a log of your own weeks rather than knowledge
  of an area. `neighbourhood` can only ever be Local Expert's, and is the one
  rung measured across the district instead of at one address: what noise
  actually costs on these streets (the heat multiplier the pressure engine
  applies, which nobody else ever sees stated) and which doors the locals use —
  the unlicensed surgery, the fence, the empty building that is not empty, the
  crowd to disappear into — each answered with the venue's real name through
  `placesWithTag`. Nothing authored per district; 22 of the 24 have something to
  say, and the two that do not have one address between them.

  Both narrator prompts now separate what the character has seen for themselves
  from what they know because they live there, which is the only kind of
  knowledge that can be true on a first visit. A job offered on the wire in the
  character's own neighbourhood arrives carrying it, before they accept
  anything. Still no die bonus anywhere: the argument in `placeIntel.ts` holds,
  and a test asserts it across every line in every district.

- ~~Stage 3: pay in options~~ — six verbs in `place-actions.json` are flagged
  `local`: the fence, the unlicensed surgery, the bunk nobody writes your name
  down for, the empty building worth walking into, whose street this is, and
  which door is worth watching. Across the district those are offered as a
  shortcut only to somebody who knows the area — a local (through `placeIntel`'s
  own `neighbourhood` rung, so no second threshold to keep in step) or somebody
  who has already been to that venue. It changes the board in 19 of the 24
  districts.

  Two things the gate deliberately does NOT do. It never touches the place the
  character is standing in: being a stranger costs you knowing WHERE the quiet
  doors are, never the ability to act once you are at one, and gating `here`
  turned every building whose only business is a quiet one into a dead pin. And
  it never removes anything from the world — the map still travels anywhere, a
  job can still send you, the narrator can still put you in front of it.

  The quiet doors are ordered ahead of the ordinary business in the district
  sweep. Without that the cap of five silently undid the whole thing: a local's
  fence sat behind "fill your bottles" and never made the list, so knowing the
  neighbourhood swapped one ordinary verb for another and bought nothing.

  `hauntPeople` now takes the character's home district. It was handed
  `DEFAULT_START` — a constant, not an address — so every campaign's cast kept
  their bars in Little Europe however far away the character had moved in,
  against `hauntsFor`'s own reasoning that "a cast you can only meet by crossing
  the city is a cast you never meet."

  Dropped on inspection: revealing extra map pins inside your own district.
  `placeSignals` is explicit that every signal traces to a row and that nothing
  may be computed from how interesting a place is, on a budget of three across
  the whole city. Lighting pins because of who is looking is exactly what that
  rule forbids, and the rule is right. Also still open: reading a route around a
  `locked_down` flag, which is a routing feature rather than an options one.

- ~~Stage 4: earning a new neighbourhood~~ — the Downtime spend screen offers
  Local Expert for a district the campaign says the character has actually
  walked: `campaign_places` has to show 8 visits across at least 2 of its
  addresses, and the row says which, because an offer that appears without
  explanation reads as a bug rather than as something earned. Two numbers rather
  than one, and the second is the point: eight evenings in the same bar is
  knowing a bar, not the neighbourhood the bar is on. The home district always
  qualifies — they live there.

  A house rule, flagged in `place-intel.json` beside the ladders: RED prints no
  such requirement, it says choose a location. It applies only to taking a NEW
  district; raising a line the character already holds is the printed rule and
  is untouched. No schema change was needed — `spend_ip_on_skill` already
  inserts a line that does not exist yet, and `skillLineKey` already keys by
  specialization, so a second neighbourhood is simply a second line.

  Carried with it: `describeSkillRaise` now names a line through
  `skillEntryName`, so the spend screen reads "Local Expert (Little China)"
  rather than leaking the stored district key at the player, and resolves "Your
  Home" the same way the sheet does.

Success: the player picks where they live, the city reads differently there than
three districts over, and the neighbourhoods they come to know are the ones they
actually walked — without a single invented modifier.

---

## In progress: the model stops knowing everything

The weakness the whole skill list exposes: the model knows the answer, so it
lets the character know it too. A check that searches a place asks the narrator
what is here, inventing is cheaper than refusing, and a good roll produces a
hidden safe that did not exist a moment before — a discovery that could have
been anything was not a discovery.

`cast.ts` already refuses to work that way for people: a dossier is released one
rung at a time and the model is never shown a rung the player has not earned,
because "a model that can see a secret will telegraph it". The plan is to point
that same argument at everything else, as four reusable subsystems rather than
seventeen bespoke ones.

- ~~Slice 1: the spine, and Perception~~ — `truth.ts` derives hidden truths from
  tags the whole city already carries and flags the campaign has already set, so
  71 of 172 locations have something to find with nothing authored per place.
  Difficulties are published DVs resolved by name. `campaign_truths` records who
  found what, per campaign, because a truth is a fact about the world and a
  discovery is a fact about one campaign. A search now asks the engine which
  already-true fact the roll reached, and the narrator is handed that one line
  and only that. Undiscovered truths are never sent to the model at all.
  Finding nothing is a designed outcome, not a failure.
- ~~Slice 2: the `gmBrief` leak~~ — a beat's brief reaches the model every turn
  of the beat, so on beat one of Night at the Opera the narrator was told the
  whole solution ("the Edgerunner is a pawn in a scheme by The Master") and
  asked to spend four beats of investigation not letting on. Every brief that
  carried its own twist is split: the situation the model narrates stays, and
  the answer moves to `Beat.truths`, which is not sent until the character finds
  it. Both authored beats and all five generated archetypes. A truth may carry
  `revealedAt`, for the one that lands on arrival rather than on a roll.
- ~~Slice 3: the social six~~ — `readsThePerson` asked the rules data for a
  Skill's CATEGORY, so all nine printed Social Skills revealed the same dossier
  rung at the same margin and Wardrobe & Style told you what somebody was
  hiding. Each Skill now has a SHAPE (`socialRead.ts`): what using it on a
  person can reach at all, and what having tried costs. Conversation gets what
  they want and never the secret; Human Perception reads the fear without
  asking a question; Interrogation and Bribery reach the secret and are
  remembered for it; Trading, Streetwise, Personal Grooming and Wardrobe &
  Style read nobody. Suspicion is the one new axis: it rises when you ask,
  landed or not, cools on its own, and closes a person to being ASKED while
  never closing them to being WATCHED — so burning your way through the
  pushy Skills has a way back. It is spent on information, never on dice.
  The shapes are shown on the check card before the die, because a choice the
  player cannot see is not a choice. No migration: it rides in
  `campaign_npcs.data` beside the rungs they have already given up.
- ~~Slice 4: Deduction~~ — `Truth.needs` was declared empty in slice 1 on the
  argument that retrofitting it would cost a migration; this is the slice that
  fills it in. A conclusion is not a thing in a drawer: it is what the pieces
  add up to, so it is UNREACHABLE rather than merely hard until the
  prerequisites are found, and a brilliant roll is no substitute for the
  legwork. Deduction is also the one Skill whose pool is not the room — it
  works off the whole job, wherever the character is standing when it clicks.
  Night at the Opera now has a two-step chain (the costume and the head make
  Huntver into Ruthven; that plus the theatre being theatre makes the job a
  set-up), and the generated archetypes' conclusions each stand on something.
  A conclusion that also carries `revealedAt` still lands when the story
  reaches the scene built to expose it: prerequisites gate working it out
  early, never the plot. The narrator is told THAT there is something to work
  out and the engine's DV — the one place this system volunteers that something
  hidden exists, and a fair one, because the prerequisites were earned.
  Two leaks closed on the way: a beat's check `note` reaches the model with the
  brief, and the Opera's printed notes still said what searching would find;
  and `isSearchSkill` only knew the city templates, all of which are
  Perception, so every non-Perception beat truth slice 2 wrote was unrollable.
- ~~Slice 5: affordances for the new Skills~~ — the truth system gave the city
  things to find and nothing on the screen ever offered to look for them: a
  player had to think to type "I search the room", and one who never thought of
  it never found anything anywhere. `place-actions.json` now declares
  APPROACHES beside its business verbs — Look closer (Perception), Read the
  room (Human Perception), Think it through (Deduction) — carrying a Skill and
  no DV, because the difficulty belongs to the thing being found. They offer a
  way IN and never a finding, which is safe precisely because slice 1 made "you
  searched and the place is what it appears to be" a real answer: the offer
  tells the player nothing. The one exception is the conclusion, offered only
  once its prerequisites are found — a pay-off rather than a hint.
  Not on the business budget in the end: taking slots off the five squeezed an
  entire district out of the list at a place with three verbs of its own, which
  the existing suite caught. They get their own reserve of two, and the card
  strip orders what is in front of you, then a local's quiet doors, then the
  ways of looking, then the ordinary verbs of buildings down the road.

Also done alongside the last slice:

- **A job reads the person you are working.** `applyInsight` lived inside
  `useLife.ts`, so leaning on a fixer over breakfast read them and the same
  check mid-job read nobody and cost nobody anything. Shared now, and a job's
  people block carries the public half Life's always had — who they are, the
  rungs the player earned, whether they have closed up.
- **Deduction in Life.** `fromNeeds` place truths: a conclusion is what two
  facts found here add up to, and it exists at a location only if its
  prerequisites do, so it can never turn up where its evidence could not.

Two seams found by auditing the five slices afterwards, and fixed:

- **A social read only ever happened on an OPPOSED check.** The model picks
  freely between `skill_check` and `opposed_check`, and nothing told it which
  to use on a person — so "Persuasion, DV 13, on the bartender" read nobody and
  cost nobody anything, and Human Perception, whose whole point is that
  watching somebody needs no contest, was reachable only through a contest. A
  DV check can now name who it is aimed at, both loops apply the read either
  way, and both prompts ask for the name.
- **A picked card sent prose, not a check.** The approach cards printed a Skill
  and a number and then sent plain text, which the model could answer with a
  paragraph about looking around — rolling nothing. `cardInput` asks for the
  check the card promised; the model's own tagged cards were losing their Skill
  the same way and are fixed with it.

Success: a player can be told "you find nothing here" and believe it, because
the alternative was never available to the narrator.

Still open, and the honest limit of all five slices: **nobody has played it.**
Every invariant here is verified by test and none of it by a week in one
district. The numbers most likely to be wrong are the pacing ones — the
suspicion cooling rate, the insight margin, how often a conclusion is actually
reachable — and they are all in data for that reason.

---

## Standing debts

**This is the list.** `AGENTS.md` used to carry its own copy under "Known
implementation gaps"; two lists of the same thing in two documents is the
duplication this project refuses everywhere else, so `AGENTS.md` now points
here and keeps only the guidance a contributor needs while editing the code
next to one.

Severity is what happens if it is ignored, not how hard it is to fix:

- **Correctness** — it can make the game quietly wrong, or lose data.
- **Operational** — it bites when the database or the deployment changes.
- **Incomplete** — a feature that reaches only part way, visibly.
- **Unsettled** — it needs a decision or a week of play, not a patch.

| #   | Severity     | Debt                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| --- | ------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Correctness  | `campaign_npcs` has no uniqueness constraint on `(campaign_id, npc_id)`. Settlement serialises survivor promotion behind the campaign lock, so the common path is safe, but a concurrent write elsewhere can still duplicate a recurring NPC — and a duplicated person is a person whose disposition splits in two.                                                                                                                                                                                 |
| 2   | Correctness  | Ordinary play turns still span multiple writes. Only encounter saves, `settle_job` and `close_aftermath` are transactional, so a turn that fails midway leaves the immutable ledger holding half of it. Error handling has to assume partial turns.                                                                                                                                                                                                                                                 |
| 3   | Correctness  | Settlement reads a bounded ledger window (`JOB_LEDGER_LIMIT`, 2000 events) rather than the exact `mission_started` → `mission_completed` range. An exceptionally long job silently prices only its last 2000 events.                                                                                                                                                                                                                                                                                |
| 4   | Operational  | The migration history cannot replay onto an empty database: `supabase/replay/` reports 37 applied, 9 failed. Not carelessness — a hand-written migration and the Lovable console's own copy of the same DDL, only one of which ever ran. Three ways to reconcile it are in `supabase/replay/README.md`; the choice is open, which is why the replay is a script rather than a CI gate.                                                                                                              |
| 5   | Operational  | `src/integrations/supabase/types.ts` has been hand-synchronised rather than regenerated three times over: for `install_cyberware`, `campaign_cyberware` and `encounters.version`, and again for `campaign_places`. `encounterSchema.test.ts` and `placeSchema.test.ts` guard two of those against drift, which is a guard rather than a fix. Regenerate from the applied schema.                                                                                                                    |
| 6   | Operational  | The `portraits` storage bucket is never created by a migration. Its policies are — policies alone do not create a bucket.                                                                                                                                                                                                                                                                                                                                                                           |
| 7   | Operational  | `campaign_places` (migration `20260904030000`) must be applied to any database predating it. No backfill is needed, but the first Life turn throws without the table.                                                                                                                                                                                                                                                                                                                               |
| 8   | Operational  | The append-only ledger is auditable, not tamper-proof: an authenticated user can insert arbitrary event types into a campaign they own. Fine as a record, not a boundary — do not build anti-cheat on it.                                                                                                                                                                                                                                                                                           |
| 9   | Incomplete   | Lifepath narrative, pronouns and self-description are assembled at creation and have nowhere to persist. The save payload carries them; the schema has no column.                                                                                                                                                                                                                                                                                                                                   |
| 10  | ~~Resolved~~ | Mission objectives close (`completes`/`fails` on a beat exit, `validateMission` rejecting an objective nothing can close), and a finished job now writes the campaign status rather than leaving it to close-out. It writes `active`: a campaign is a life, not a job. What remains is not a debt but a question — `won` is in `CAMPAIGN_STATUSES` and nothing in the game has ever written it, so nobody has decided what it would mean for a life in Night City to be over and to have gone well. |
| 11  | Incomplete   | Non-combat structured world-state deltas the GM proposes are only partially wired into persistence.                                                                                                                                                                                                                                                                                                                                                                                                 |
| 12  | Incomplete   | Encounters created before the atomic-closeout migration do not record which inventory rows supplied head and body armor, so their remaining SP cannot be written back. Legacy rows only.                                                                                                                                                                                                                                                                                                            |
| 13  | Incomplete   | Immediate in-job pressure reports and engine-derived settlement pricing are not causally deduplicated. Engine-derived settlement is the authoritative pass; the two are counted on different events, so this is a known overlap rather than a double charge.                                                                                                                                                                                                                                        |
| 14  | Unsettled    | The `goodwill` dial moves and no threshold reads it — and it is not alone. `raided`, `locked_down`, `power_out` and `rebuilt` are set by the engine and read by nothing, so four of the eight place flags are decoration. A dial or flag that changes nothing the player meets is the failure `PRODUCT.md` names. Giving `goodwill` a threshold is only half a fix: a flag needs a consumer, and what goodwill BUYS is a design decision.                                                           |
| 16  | Unsettled    | Nothing measures a prompt change. There is no eval harness and no test that calls a model: every prompt test asserts a substring of a string the repo built itself. The prompts have been revised about nineteen times with no way to tell if a revision helped. Turns now record their provenance (`turnProvenanceData`), so a bad one can be attributed to a prompt and a model; what "better" MEANS is the open half. `PRODUCT.md`'s "How to tell it is going wrong" is where to start.          |
| 15  | Unsettled    | The location layer's pacing numbers — `PLACE_OBSERVATION_EFFECTS`, the beat periods, the `place-state.json` thresholds — have never been playtested. Tune them from a week in one district rather than from argument.                                                                                                                                                                                                                                                                               |

Resolved, and kept here because the reasoning is worth more than the entry:

- ~~`bun run lint` fails on a pre-existing `prefer-const` error.~~ Lint is clean
  and CI blocks on it: `lint:code` is blocking, `format:check` advisory, and
  generated files are out of eslint's scope, because a finding nobody is allowed
  to act on is what forced the whole check to be non-blocking in the first place.
- ~~Three of four paid-AI endpoints had no server-side authentication, and one
  took its system prompt from the client.~~ All four authenticate;
  `paidAiAuth.test.ts` finds every module that reads `LOVABLE_API_KEY` and fails
  if one has no check.
- ~~The ledger's payloads were agreed on by coincidence between writer and
  reader.~~ `engine/ledger.ts` owns each one; a rename is a type error on one
  side and a round-trip failure on the other.

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
