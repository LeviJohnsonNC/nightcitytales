# Roadmap

What is built, what is next, and why — in the order the product needs it.

`PRODUCT.md` says what the game is and how to decide. `AGENTS.md` says how the
code is organised and which gaps are open. This file says what to build next.
When they disagree, `PRODUCT.md` wins on intent and `AGENTS.md` wins on the
current state of the code.

---

## Combat composition — Phase 1 proof

The opt-in `/combat` fixtures now include a composed commercial intersection and
service alley. Shared semantic parcels, curb-oriented vehicles, vendor/service/
loading clusters, static buildings, frozen v2 snapshots and geometry-driven
rendering replace independent prop scatter for these proofs. Existing encounters
retain their original geometry. See [the implementation and playtest notes](docs/scene-composition.md).

Recovery follow-up: saved crossings are validated on reload, cluster metadata
matches the chosen contents, and the Mac filename-resolution build failure is fixed.
Tests, typecheck and production build pass; deployed playtesting remains open.

Next: playtest density/visibility, improve the procedural facade art, introduce
more parcel/anchor variations, then prove office/club interiors before connecting
structured adventure facts. Arbitrary prose-to-battlefield generation is still
not enabled. Deployment requires `20261003010000_composed_battlefield_snapshots.sql`.

## Now: character creation as act one

Creation was faithful, reasonably stylish, and a form: step one asked how much
paperwork you wanted, twenty Lifepath tables sat in compact rows behind a "roll
all remaining" button, the character had no face or name until step nine, and
it ended on "Save to roster". The player it is for has played Cyberpunk 2077 and
never opened the book, and the step that lost them was Skills.

The plan, in phases:

1. **The meet and the launch — shipped.** Three fixers, one chair: the one you
   pick asks every question in their own voice and becomes your campaign's
   fixer. Method follows Role and no longer wipes the character. The rail is
   topped by the file the fixer is keeping on you. The last screen reads the
   file back, shows the three people already waiting in the city, and "Enter
   Night City" saves, starts the campaign and goes straight into the cold open.
2. **Skills that mean something — shipped.** The step asks "how do you work?":
   three ways to be each Role (`skill-presets.json`, a house rule only in which
   three are offered) that `engine/skillPresets.ts` turns into an ordinary,
   exactly-spent allocation the printed validators accept under Edgerunner and
   Complete Package alike. What that makes the character good at is shown as
   tasks with their real odds — `engine/checkOdds.ts`, exact over the crit
   rules, against a DV named on the printed ladder — and every Level by hand
   lives in a fine-tune drawer, where each row shows its odds too. A Streetrat
   sees their fixed package as things they can already do.
3. **The Lifepath as an interview — shipped.** Five chapters asked one at a
   time — where you come from, who you are, who is still out there, what you
   want, about the work — each opened by the fixer in their own voice, each
   with its own roll. In "who is still out there" the enemy, friend and lost
   love become faces: `castCandidates` offers the people whose bio fits what
   was rolled, always including the dice's own choice, and the pick rides the
   cast plan into the campaign. A pick only stands while it still fits the
   Lifepath; change what was rolled and it gives way to the dice.
4. **A portrait that develops — shipped.** The file gets a picture as soon as
   there is something to picture: a grainy surveillance still once the Role,
   pronouns and look are known (pronouns are now asked with who you are), a
   better one under the lights once the STATs say how they are built, and a
   file photo once the kit is chosen. Each is one generation from the cap of six;
   the other three retry a failed stage or redraw a picture whose Role, sex, age
   or look changed. It sharpens along one curve and is fully clear on reaching the
   Identity step, which has no portrait of its own. `faceFact` pins age, face
   shape, eyes and one mark from the draft's seed so every stage describes the
   same person. Still open: the stages are fresh generations, so pose and
   composition can drift between them.
5. **Music and backdrops — shipped.** The creator plays every `music-…` track
   in a shuffled order, each crossfading into the next; the per-step cues it
   started with were dropped because steps last thirty seconds or ten minutes
   and the music could not fit either. It starts on arrival from the roster,
   waits for a touch where the browser insists, is remembered on or off, and
   the track playing at "Enter Night City" carries on into the game. It is played
   through NCAmp, a from-scratch Winamp 2 homage: windowshade
   strip, main window, a real ten-band EQ, playlist, and three skins — Street
   (the default, drawn in the page's own panels and type), Classic and Neon. Its
   strip also carries the one dice-sound switch. It sits in the creator's top
   bar and, in the game, under the campaign header (in the status bar on a
   phone), with the playlist stepping aside for a fight's own track. Each fixer's
   venue sits behind their questions, and the meet, the reveal and each
   Lifepath chapter have backdrops. Every file is named in `docs/soundtrack.md`
   or `docs/art-style.md`, and a slot with no file keeps the plain look.
6. **Polish — partly shipped.** Rolled STATs now count: the first roll stands
   and each character carries one reroll (`chargen-house-rules.json`, a house
   rule; the creator used to allow unlimited rerolls, which made the dice
   decorative). Once the STATs are in, the step names your edge and your weak
   spot in a line each. The Identity step asks the fixer for five handles (a
   `handle_suggestions` job on the closed list). Still open: one-click
   loadouts for Complete Package, which need a legality-checked shopping list
   per preset against both budgets, and a shareable character card, which
   needs an image-rendering dependency the project does not carry yet.

---

## Also shipped: the Tomorrow Test

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

## Next: the climb — progression you can see

D&D asks "how powerful have I become?" RED asks "how far have I climbed?" A
veteran Solo is still a person a shotgun can end, and the Skill numbers move
surprisingly little across a campaign. What changes is everything around them:
the chrome, the gun, the home, who returns your calls, who has heard of you. The
game holds most of that and shows almost none of it as a climb. The player
should always know three things: what they could work on, where they stand, and
that something just went up.

### Where it stands, graded

Graded on what a player experiences, not on what the engine models somewhere.

| Track                         | Grade | Why                                                                                                                                                                                                                                                                                                                |
| ----------------------------- | ----- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Skills                        | 5     | The spend is rule-checked and atomic. But IP arrives only when a job closes, Life earns none, and work is on the wire one night in six. The price was half the printed one, and a raise leaves no trace in the campaign: `spend_ip_on_skill` writes the sheet and no event, so there is no receipt and no history. |
| Role Ability                  | 2     | Rank 4 forever. `character_role_ability.rank` exists and `roleOpening.ts` already computes what each Rank gives; only the purchase is missing.                                                                                                                                                                     |
| Gear and chrome               | 6     | Shop, ripperdoc, bench and Excellent-quality items are all real. Nothing shows the kit you have now against the kit you started with.                                                                                                                                                                              |
| Wealth, access, connections   | 4     | Home and Lifestyle are fixed at creation: the home is on `character_finance` and nothing in play writes it. Pay is a random band (`generator.ts`) unrelated to track record or danger.                                                                                                                             |
| Reputation and story position | 2     | The p.193 ladder is shown once, at creation, as 0. Faction standing moves, and nothing reads it but prose — the "dial nobody meets" `PRODUCT.md` names. The chronicle is the one thing that remembers you.                                                                                                         |

### Rulings, settled with the product owner

- **Skill Levels cost 20 × the new Level, as printed.** `ip-costs.json` said 10.
  A character who bought Levels at the old price keeps them; banked IP is
  simply worth half what it was.
- **A "session" is everything since the last award.** The Aftermath judgement
  covers the whole stretch since the previous `ip_awarded`, Life included, so
  Explorer, Socializer and Roleplayer play in Life counts. A Life stretch that
  crosses an in-world week with no award is judged at the week's turn on the
  playstyle columns, so a long life between jobs is not worth zero.
- **This reverses the earlier "no ambition track" ruling** in
  `docs/progression-and-first-play-plan.md`, deliberately and narrowly: the
  player sees what each currency can buy next and its distance, and pins up to
  three. Nothing in it is generated, offered or dangled. It is a price list
  the player aims, not a quest board.
- **Better work is more dangerous work.** A higher tier of offer chooses the pay
  band and the opposition together. Pay that climbs while danger stays flat is
  "Eurobucks that only ever go up".

### What keeps it RED

- IP never buys a STAT or a Hit Point. The vertical track stays flat because
  that is what keeps a shotgun an event.
- No track turns into a die bonus the narrator can grant. Reputation's dice are
  the printed ones (recognition, Facedown), rolled by the engine.
- Losses are shown alongside gains. Humanity spent, enemies made and debts carried
  are part of how far you have come. A climb that only goes up is a score.
- Money is shown as what it bought and what it costs per month, never as a
  balance that grew.

### The plan, in order

**1. Raises leave a trace — shipped.**

- `ip-costs.json` charges the printed 20 I.P. a Level, held by a test
  (Handgun 4 → 5 is 100).
- `spend_ip_on_skill` appends a `skill_raised` event to the character's active
  campaign in the same transaction (migration `20261002010000`, pending in
  `APPLIED.md`). It finds the campaign itself rather than taking it as an
  argument, so the signature and the generated types are unchanged, and a
  raise from the roster is recorded too. The writer is SQL, so
  `skillRaised.test.ts` holds the keys it spells to `SKILL_RAISED_KEYS` and
  `readSkillRaisedEventData` in `engine/ledger.ts`.
- The spend card shows `Handgun 6 → 7` as a receipt, from a diff of the sheet
  (`skillReceipts`) on the same timing as a Life turn's receipts. It also now
  refreshes the campaign bundle it sits in. Before, it kept offering the Level
  just bought, and the database refused the second click.
- Any Skill can be learned from Level 0 (`untrainedSkillRaises`), except the
  five that need a name before they exist — Language, Science, Martial Arts, Play
  Instrument and Local Expert. Local Expert keeps its own earned door; the other
  four wait for a name picker on the spend card.
- `ip_awarded`'s payload moves into `ledger.ts` with step 2, the first thing to
  read it back.

**2. IP that arrives — shipped.**

- Every award, job or life, judges everything since the previous one
  (`features/campaign/ipAward.ts`). It used to read the last sixty ledger rows,
  and its roll count was quietly capped at ten. The window is bounded by
  `PACKET_BUDGET.ipJudgementLog` and cut at its old end, and the judge is told
  when it was cut.
- Seven in-world days of life with no award is a session (`ip-awards.json`
  `_houseRules`, flagged). The life since the last award is judged on the
  playstyle columns, from a card under the Life log, and the pickers open on
  what the player declared last time. A month without one is still one award,
  not four.
- `award_improvement_points` (migration `20261002020000`) writes the event, the
  job's `ip_awarded` mark and the character's total in one transaction. The
  caller sends the `seq` of the last award it judged from, so the same stretch
  cannot be paid twice from two tabs. Until the migration is applied, the
  client falls back to the old three writes (`legacyIpAward`), as `APPLIED.md`
  requires.
- `ip_awarded` has a contract in `ledger.ts` that reads both its new shape
  (`kind`, `day`) and every award written before it.

**3. Role Rank — shipped.**

- `spend_ip_on_role_rank` (migration `20261002030000`) buys one Rank at 60 I.P.
  times the new Rank (`ip-costs.json`, so Rank 4 → 5 is 300), up to 10. It
  writes `role_rank_raised` to the active campaign in the same transaction, and
  `roleRankRaised.test.ts` holds the SQL to the ledger contract and the ceiling.
- The spend card leads with the Role Ability. Its preview is
  `roleRankPreview`: a diff of `roleOpening` at this Rank and the next, so it
  shows what play will actually deliver — "5 points, divided before the
  shooting", a sheriff's department instead of beat cops, seven machines in
  the Motorpool instead of four. A Rank that changes nothing visible says
  where the next change is.
- Maker and Medicine specialty pools are already derived from the Rank, so a
  raised Rank arrives as new points to place on the Role Ability panel.
- The Netrunner's Interface is not for sale until Netrunning is built.
  Multiclassing waits.

**4. Within reach — shipped.**

- `engine/goals.ts` prices four kinds of goal against the character as they
  stand: a Skill Level and a Rank in I.P., a piece of chrome in eurobucks (with
  its Humanity cost, and the reason when a full foundation or a missing one is
  in the way rather than the price), and a faction's next band in standing.
  Standing is never "ready": it is earned, not bought. A goal carries its own
  target, so "done" means what the player meant when they pinned it.
- The Within reach sheet heads the Life dock: the next rung of everything, one
  step out, cheapest first, with the spend card under the I.P. section. A week
  of life now earns I.P., and before this there was nowhere in Life to spend it.
- Up to three pins, written whole as a `goals_pinned` ledger event (newest
  wins, so no column). The Growth chip follows the first pin and falls back to
  the cheapest raise. A pin coming within reach or arriving is a receipt under
  the Life log ("Within reach: Combat Awareness Rank 5", "Done: Handgun 7").
- People are not on it, by design.
- With this, `award_improvement_points` and `spend_ip_on_role_rank` moved to
  Applied and their "not migrated yet" fallbacks were deleted.

**5. Then and now — shipped.**

- The Record sheet opens on day one beside today
  (`features/campaign/thenAndNow.ts`, pure). It is derived from what already
  exists rather than from a new snapshot:
  - Day one is the saved character, which play never writes: its gear, its
    chrome, its Humanity. Each person starts at their cast role's starting
    disposition, and every faction starts with no opinion.
  - What changed is the live rows, plus the ledger's `skill_raised`,
    `role_rank_raised` and `ip_awarded` events, read once when the sheet opens
    (`listCampaignEventsOfTypes`).
- Five groups, each only when something moved: what you can do (Rank and
  Skills, first Level to last, and I.P. earned), chrome and the Humanity it
  cost, the weapons and armor you carry (ammunition is left out), who you know
  in words rather than numbers ("Kiro: close → cold", a death), and who knows
  your name.
- Losses sit beside gains, and money is left out: a balance that grew is a
  score.
- Aftermath does not get a copy: the settlement report already is "since the
  last job", and two would drift.
- Raises bought before `skill_raised` existed (October 2026) left no event, so
  an older campaign's "what you can do" starts from then.

**6a. Reputation and the work it brings — shipped.**

- Reputation (`engine/reputation.ts`) is the printed ladder (p.193), and the
  engine awards it from what each settled job left behind, read off the
  `job_settled` receipt (`readJobSettledEventData`). A deed starts at 1 and
  climbs a step each for being seen or named (two at most), being loud, a body
  count, and a fee worth talking about, capped at 6
  (`reputation-deeds.json`, house rule). A clean job earns nothing: that is the
  trade between heat and fame. Reputation is the best deed so far; it is
  derived on every Life load and never stored. Levels 7 and up are headlines,
  and nothing writes the news yet.
- Job tiers (`job-tiers.json`, house rule): street, steady and serious work,
  each a pair of fees and force sizes, so better pay is a harder fight. The
  tier is the highest that both Reputation and jobs finished reach, one lower
  while the fixer is cold. `pickJobSeed` enforces it by choosing among 64 seeds
  rather than editing a job, so a stored id still names the same job; a sweep
  test holds every tier to being filled 195 times in 200.
- Faction standing finally decides something: an employer whose faction is
  hostile to you does not hire you.
- The Record and Within reach sheets show Reputation with its printed "who
  knows" line, the work on offer, and what the next tier needs. Rising in
  either is a receipt ("Reputation 3", "Fixers offer you steady work now").

**6b. Being recognised — shipped.** Reputation's two printed dice uses, both
the engine's:

- The recognition roll (`recognitionRoll`): once a turn, before the packet is
  built, the engine rolls whether somebody meeting the character for the first
  time has heard of them (1d10 under their Reputation, p.193). The narrator gets
  a "Reputation" line saying who knows and how it came out, with no number in
  it, and the die is kept beside the narration in the ledger. At Reputation 0
  nothing is rolled or sent, so a new character's packet is unchanged.
- Facedown (`facedown`): COOL + Reputation + 1d10 against the same, resolved by
  the ordinary opposed-check rules, and the loser backs down — no lingering
  penalty, as the book has it. Either narrator proposes one
  (`"kind":"facedown"`, with the other side's COOL and Reputation, clamped to a
  person); it becomes an ordinary check card whose "Skill" is the character's
  own Reputation, read from the ledger and never from the model. Luck and
  wounds ride on it; no Role bonus does.
- One shared `REPUTATION_RULE` in `narratorRules.ts`, in both prompts (GM
  2.16.0, Life 2.24.0), and two detectors that trace to it:
  `standoff-is-a-facedown` and `unheard-stays-unheard`.
- Eval: `eval:compare` over five runs a side, GM 2.15.0 / Life 2.23.0 against
  2.16.0 / 2.24.0 on `google/gemini-3.7-flash` via OpenRouter (the "after" side
  also carries step 7's Home line in the Life packet). No change in either
  direction cleared Fisher's exact test: 14 cells moved within chance, 271 did
  not move, and runs clean went from 1386/1401 to 1508/1521. The two new
  scenarios were clean in 119 of 120 runs. The one failure was the detector's
  own: "He hasn't heard of you" tripped `unheard-stays-unheard`, which now
  ignores a match with a negation just before it.

**7. Moving house — shipped.** A trade-off, not a reward, which is why it
belongs.

- Home and Lifestyle are the campaign's: `housing_id`, `lifestyle_id` and
  `home_place_key` on `campaigns` (migration `20261002040000`), all nullable.
  NULL means "where creation put them", so an existing campaign reads exactly as
  it did and nothing is backfilled (`campaignHome`).
- `engine/home.ts` prices a move from the printed rents and Lifestyles and the
  house-rule `moving-house.json`:
  - a deposit of one month's new rent;
  - eight hours on the clock;
  - nobody moves out owing;
  - new rates from the next bill.

  Which buildings rent which kind of home is read off the atlas tags, each row
  with its reason. A cube hotel is a hotel made of freight; the Exec's conapt
  is offered only to the Role it is granted to. Changing what you eat is free
  and instant.

- `move_house` commits the deposit, the new home, the clock, the character's
  position and the `moved_house` receipt in one transaction. It is idempotent
  on the request id and refuses a plan priced against a campaign that has since
  changed.
- The Home sheet on the Life dock shows where you live and what you eat. Each
  offer shows its deposit, its monthly bill against today's, and how long the
  move takes, or the engine's reason it is refused.
- Rent, the Money chip and the opening read the campaign's rates.
- The Life narrator gets one "Home" line with names only.
- Then and now shows "Where you live", from the first move's start to the last
  move's end.
- Only the home moves. Local Expert's "Your Home" and the cast's haunts still
  read the district the character grew up in.
- Not done: living on the street (its nightly Endurance check is not modelled),
  buying rather than renting, and the Beaverville houses an Exec is handed at
  Rank 7 and 10.

**8. Feeling it — shipped.** A critique after step 7 re-scored the tracks:

| Track                         | Before | After 1–7 |
| ----------------------------- | ------ | --------- |
| Skills                        | 5      | 8         |
| Role Ability                  | 2      | 6         |
| Gear and chrome               | 6      | 7         |
| Wealth, access, connections   | 4      | 6         |
| Reputation and story position | 2      | 5         |

It found three ways the climb was built and still not felt:

- **The biggest rises were silent.** Reputation and the tier of work move when a
  job settles, in Aftermath. The Life screen opens with the new standing as its
  baseline, so the turn receipt for them never fired.
  - Aftermath now says "What it did for your name": the deed, Reputation before
    and after, and a new tier.
  - It is read off the ledger, the settled job against the ones before it
    (`climbFromLastJob`, `features/campaign/climbNews.ts`).
  - The return to Life writes the same news once per job as a `milestone`
    event.
- **Nothing pointed at Within reach.** A new character had 0 I.P. and a Growth
  chip reading "0 IP".
  - A day-one card now says what there is to climb and opens the sheet. On a
    phone it sits in the column, because the rail is behind the status bar.
  - It goes for good once something is pinned or it is dismissed.
  - The chip reads progress against a price ("3/100 IP"), pinned or not, never a
    bare balance beside the Money chip.
- **Proud moments faded after seven seconds.** Skill raises, Rank raises, I.P.
  awards and milestones are now lines in the Life log, named from their payloads
  (`climbLogLine`) rather than the SQL's spelling of an id.

Still owed:

- Seeing the whole loop in a browser: nothing from steps 4–8 has been watched
  rendering.
- A pacing check: a simulated run of jobs that states when the first raise, the
  first tier and the first Rank arrive.

as held objects (too close to a second
dial for disposition until play shows the need), **multiclassing**, and
**buying a vehicle** (the specs are ours, not the book's, and nothing can
damage one yet).

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
- **Follow-through** — started. The narrator was stopping halfway: "walk to the
  bar and sit down at the counter" reached the door, because the arrival was
  narrated from an empty input, and "find a bar" was refused because no bar is
  called "a bar". Shipped: travel to a KIND of place (`nearestWithTag`, `seek`),
  the nearest of each everyday kind in the packet so directions name real
  places, an arrival that carries the player's words and can finish them, a
  refused trip that stays put and offers the nearest real places, and the
  player's own lines in Life's recent history. The eval gained four checks for
  the narrator doing too little, beside the eleven for too much.
  Then momentum: a shared FOLLOW THROUGH rule in both prompts (and Job dice
  results carry the player's words too), turns that end on something live,
  the scene holding its situation while the player is in it
  (`selectSituation`'s `inScene`, broken only by `interruptsScene`), the cast
  able to come over on an engine roll (`comesOver`), and the street oracle
  moved to a d10 so a quiet evening has a little more in it. The eval gained
  two more checks and four more scenarios, and runs on OpenRouter or Google AI
  Studio keys, since the Lovable key cannot leave Lovable.
  Then quick dice: a check the narrator marks low-stakes and the engine
  agrees is small (`engine/autoRoll.ts` — Everyday or easier, uncontested, no
  fight, the only new check that turn) rolls itself in the same turn, shown in
  the log as "auto" with the full trace behind it; asking a neighbour the way
  gets no dice at all. Life and Jobs now roll through one function
  (`play/rollCheck.ts`), which also gave Life rolls the Role bonuses the Job
  copy had and the Life copy had quietly dropped.
  Then everyday ground: six house-rule venues (a bar and a noodle counter in
  Old Japantown, one each in Heywood Industrial, Downtown, New Westbrook and
  South Night City) for districts the atlas gave nowhere to drink or eat, and
  a character's REGULAR (`regularOf`: the place of a kind they know best) —
  "find a bar" goes there, the staff greet them as one, and their friend
  drinks there too. The six still need pictures.
  Then pull: the status chip names the most pressing thread instead of
  counting them ("Rent — due tomorrow · +2 more"), a turn that crosses midnight
  writes a Day card into the log with what is late, due and close, a player back
  after hours away is met with the threads they left open, and a trip nobody
  said how to make goes whichever way is quicker.
  Then people with stories: each of the six carries an arc (`engine/arcs.ts`,
  twelve in a house-rule library) that plays out in world-tick moves, shows as
  a tell when you run into them, forks its ending on your involvement, and
  reveals what was really going on only to a player who got involved. The arc
  timings are pacing guesses.
  The evals have now run live (14 scenarios, three repeats each). The first
  run's worst findings were the harness's, not the narrator's: it asked for
  strict structured output, which play does not, and every proposed check came
  back as a string and was dropped; and the number detector flagged "ten
  eddies" against a packet that said "10eb". With both fixed, what is left is
  the narrator occasionally inventing a duration ("twenty minutes"), about one
  run in three on a few scenarios.
  The first tuning pass read the transcripts (`TRANSCRIPT=` on the eval) rather
  than the pass counts, which were already near the ceiling, and found three
  things no check had counted. A turn narrating an engine result showed the
  player only its `resolution`, which the model wrote as a one-line log ("You
  walked two minutes to The Paper Lantern"), while the actual scene it wrote in
  `description` was discarded; the prompt now says `resolution` IS the turn. A
  visit is counted on arrival, so every turn of a first visit was told to
  establish the room again; `stillHere` (Life) and `sceneSet` (Job) now say the
  scene is already set. And twenty of twenty-eight turns opened on a list of
  smells; a shared rule and the `opens-on-something` check hold that. One brake
  was cut: a refused trip was told to "say in a sentence where they are
  standing", which produced a dead line every time.
  The second pass added the turns the eval had never seen: a Job roll that
  succeeds, one that fails, a Life roll that fails, and a night with work on
  the wire. Their result lines are built by the same functions play calls
  (`gm/checkResult.ts`, `life/checkResult.ts`), and two checks hold them:
  `result-stands` and `offers-the-wire`. The remaining brakes were read against
  those transcripts and none was doing visible harm, so they stay. The one
  habit left across every scenario was an invented duration ("three hours
  ago", "every forty seconds"); a line naming the words to use instead took it
  from about one turn in three to none in twenty. Eval, 18 scenarios x 3:
  376/378.
  Model comparison, the same 18 scenarios twice each: `gemini-3.7-flash` (the
  default) 356/357, $0.0055 a turn, 5.6s; `gemini-3.8-flash` 376/378, $0.010,
  12.1s, and reads the same; `openai/gpt-5.6-sol` 378/378, $0.0083, 11.5s, and
  reads better — shorter, harder, closer to the house voice. Every Sol call
  failed until all three output specs said "JSON": OpenAI refuses JSON mode
  otherwise, so no OpenAI model could have run either loop through the
  gateway. Still to do: decide whether Sol's prose is worth twice the wait,
  per loop (GM_MODEL and LIFE_MODEL are separate), and confirm the Lovable
  gateway serves it.

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

## In progress: adventure scenes becoming battlefields

The approved direction keeps the deterministic combat engine and introduces a
persisted scene shared by narration and combat. The first playable slice will
be the North Heywood street encounter, entered from Life or a Job and returned
with the same people, objects and consequences.

Phase 1 foundation:

- Shared `combatOps.ts` loading/actions now require no mission. Job-specific
  mission failure remains in `playOps.ts`; routine death saves report engine
  results without a model call.
- Enemy goals, threat roles and spent morale checks survive reload.
- Death saves persist the round resolved, cannot repeat in that round, and
  leave a surviving mortal player able to act. An owed roll is rendered from
  state even if the ledger prompt write was interrupted.
- Neutral civilians stay down without attacking or being counted as allies.
  Fleeing through scene exits is later work.
- Negative HP is preserved by the save transaction for mortal players and NPCs.
  Migration `20261002050000_save_mortally_wounded_combatants.sql` was applied
  October 2, 2026, and verified on disposable PostgreSQL 16 with ownership, stale-write
  and rollback regressions in CI.

The Phase 2 scene/origin/result boundaries are recorded in
`docs/scene-combat-contract.md`.

Phase 2a authored proof:

- Validated, immutable layout snapshots now carry resolved geometry and cover HP.
  Board, movement, targeting, backup and playback use the same snapshot; reload
  preserves custom object damage and actor positions.
- `/combat` offers the Ulysses Street intersection: Thorton cruiser, broth cart,
  rifleman, lookout and two neutral workers. Its profiles and positions are
  authored, not inferred from arbitrary prose. It requires an existing campaign,
  moves its location to North Heywood and preserves its Life/Hook/Job phase.
- Active combat takes over the campaign screen without changing phase. On ending,
  the original phase's screen resumes; dead characters reach the terminal screen.
  Life shows and passes the factual ending to its narrator rather than displaying
  the earlier scene as if nobody fired. Scene results retain stable actor keys,
  HP/wounds, final positions, explicit deaths/withdrawals and object condition.
- Entry through the RPC serializes on the campaign and rejects another active
  encounter. Snapshot saves require a supported protocol and an expected version.
  A distinct entry RPC prevents an unmigrated database from ignoring the layout.
  Migration `20261002060000_encounter_layout_snapshot.sql` was applied October 2, 2026.

Phase 2b receipt/recovery slice:

- New snapshot fights require the separate `start_scene_encounter` capability.
  Entry captures phase/location/mission/beat and the authored actor manifest,
  checks the expected origin, and commits initiative with its ledger boundary.
  Replaying the identical command returns the same fight, even after completion.
- State saves commit queued NPC/attack rolls and terminal scene results together.
  Retrying the identical latest save is a no-op; conflicting or older writes are
  rejected. Completed scenes cannot be reopened by the save RPC.
- A reload on an NPC's turn offers **Continue combat**, resolving the current
  actor rather than skipping them. Re-seeding the North Heywood fixture while a
  fight is active resumes it instead of ending it.
- This is not whole-command atomicity: Luck, reload inventory, Backup, death
  narration/Job failure, and some player action logs still have separate writes.
  General persistent noncombat scene instances and mission-runtime revisions
  remain outstanding. Origin metadata is not that scene lifecycle.
- Migration `20261002070000_scene_combat_receipts.sql` was applied October 2, 2026.

Phase 2c persistent authored scenes:

- `/combat` can stage North Heywood without combat. A scene instance freezes the
  layout, actor identities and profiles before initiative. Staging commits the
  relocation and narration with the scene and preserves wounds/ammunition.
- The adventure screen offers **Enter combat** for a ready scene. Entry checks
  scene revision, location, phase/mission, geometry, participants and spawn cells.
  Repeated entry for that scene revision returns the same encounter.
- Completion commits the scene's result and aftermath with the encounter receipt.
  Revisit uses that saved result; a newer template cannot respawn the gangers.
  Completed aftermath can be revisited across phases. Unfinished scenes retain
  their originating phase/mission checks.
- This first lifecycle supports one fight per instance. Later re-engagement of
  survivors, world-tick changes and NPC/item links require current-state projection.
- Migration `20261002080000_persistent_combat_scenes.sql` was applied October 2, 2026.

Phase 2d typed opening requests:

- Life and Job inputs recognize a narrow set of direct attack commands at an
  already staged scene: “shoot the rifleman”, “open fire”, and “pull out my pistol
  and start blasting”. Unrecognized text still follows the existing narrator path.
- Entry saves the original request and optional hostile target/pistol selection
  with initiative and the player-input ledger row. Duplicate entry keeps the first
  request. NPCs who beat the player still act first.
- The first player turn restores a named shot from the immutable entry, using
  current positions and weapon legality. Untargeted fire asks for a board target.
  Cancellation, a spent first Action or a later round stops the opening request
  from resurfacing. Normal ROF still allows a separately requested second shot.
- Migration `20261002090000_scene_attack_intent.sql` was applied October 2, 2026.
- Player testing confirmed `open fire` enters the saved scene in Life. Follow-up
  fixes accept `shoot at`, keep pointer events during dice from permanently
  locking the board, and reassert the encounter outcome constraint through
  `20261002100000_repair_encounter_status_constraint.sql` (applied October 2, 2026).
  The regression suite now tests the historical narrow constraint as well as
  the canonical replay baseline. Levi's subsequent browser test confirmed typed
  targeted entry, one-round ammunition consumption, movement, both enemies
  withdrawing, and return to Life with HP and a factual aftermath.
- Presentation follow-up: saved withdrawal/death/unknown-removal states have
  distinct markers, initiative labels and a persistent departure list. New
  withdrawals retain morale/objective cause in combatant JSON. Neutral diagram
  figures no longer hold guns. Life prioritizes current narration/aftermath and
  collapses earlier history; scene controls live beside the narrative.
- Scenic follow-up: the saved v1 intersection now uses the existing Phaser renderer
  with a world-aligned dry street/crosswalk, independent sedan engine/cabin and
  broth-cart damage sprites, and unarmed crouched workers. Geometry/version checks
  keep unfamiliar layouts in diagram mode. The original courtyard remains supported.
  Local WebGL checks covered movement/zoom, mobile sizing, damage, withdrawal,
  diagram toggling, missing assets and context-loss recovery. No migration.
- Opening clarity follow-up: scene combat shows a first-turn initiative recap
  from saved attack receipts, including HP/armor changes after refresh. Main shot
  feedback is concise, with roll details expandable. Walking uses route-length
  pacing (0.85–1.8 seconds) and slower, synchronized walk frames/footsteps.
- Remaining visual work: player/ganger sprites remain representative mercenaries,
  rather than appearance/weapon-specific art; unknown NPC portraits remain neutral
  placeholders. More environment recipes and deployed-player validation remain.

This remains an authored proof, **not the full Phase 2 exit gate**. Remaining:
mission-runtime revision tracking, all action/resource costs in atomic commands,
broader freeform intent interpretation, and authenticated browser verification.
Scene generation from adventure context is not enabled. The text scene must still
be staged explicitly; the input bridge is a command vocabulary, not an AI parser.
See `docs/north-heywood-proof.md`.

Compatibility: existing rows without enemy metadata retain their prior defaults.
An active mortal turn saved before the death-save round marker existed cannot
prove its obligation was already resolved; it requires a save once on upgrade.
Newly resolved saves retain the marker across reload. Scene-backed encounters
will require a versioned protocol rather than the legacy permissive writer.

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

| #   | Severity     | Debt                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| --- | ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Correctness  | `campaign_npcs` has no uniqueness constraint on `(campaign_id, npc_id)`. Settlement serialises survivor promotion behind the campaign lock, so the common path is safe, but a concurrent write elsewhere can still duplicate a recurring NPC — and a duplicated person is a person whose disposition splits in two.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| 2   | Correctness  | Ordinary play turns still span multiple writes. Only encounter saves, `settle_job` and `close_aftermath` are transactional, so a turn that fails midway leaves the immutable ledger holding half of it. Error handling has to assume partial turns.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| 3   | Correctness  | Settlement reads a bounded ledger window (`JOB_LEDGER_LIMIT`, 2000 events) rather than the exact `mission_started` → `mission_completed` range. An exceptionally long job silently prices only its last 2000 events.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| 4   | Operational  | The migration history cannot replay onto an empty database: `supabase/replay/` reports 37 applied, 9 failed. Not carelessness — a hand-written migration and the Lovable console's own copy of the same DDL, only one of which ever ran. Three ways to reconcile it are in `supabase/replay/README.md`; the choice is open, which is why the replay is a script rather than a CI gate.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| 5   | Operational  | `src/integrations/supabase/types.ts` has been hand-synchronised rather than regenerated three times over: for `install_cyberware`, `campaign_cyberware` and `encounters.version`, and again for `campaign_places`. `encounterSchema.test.ts` and `placeSchema.test.ts` guard two of those against drift, which is a guard rather than a fix. Regenerate from the applied schema.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| 6   | Operational  | The `portraits` storage bucket is never created by a migration. Its policies are — policies alone do not create a bucket.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| 7   | Operational  | `campaign_places` (migration `20260904030000`) must be applied to any database predating it. No backfill is needed, but the first Life turn throws without the table.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| 8   | Operational  | The append-only ledger is auditable, not tamper-proof: an authenticated user can insert arbitrary event types into a campaign they own. Fine as a record, not a boundary — do not build anti-cheat on it.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| 17  | ~~Resolved~~ | `tools/atlas/tag_places.py` reproduces `places.gameplay.json` exactly again: it carries the hand-added `corp_housing` tag and the `l4` fix in its PATCH table, reads `places.houserule.json` and tags every house-rule place from its own `HOUSE_RULE_TAGS`, and runs every assertion before it writes, so a failed run leaves the file as it was. A new house-rule place needs its tags added there.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| 9   | Incomplete   | Lifepath narrative, pronouns and self-description are assembled at creation and have nowhere to persist. The save payload carries them; the schema has no column.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| 10  | ~~Resolved~~ | Mission objectives close (`completes`/`fails` on a beat exit, `validateMission` rejecting an objective nothing can close), and a finished job now writes the campaign status rather than leaving it to close-out. It writes `active`: a campaign is a life, not a job. What remains is not a debt but a question — `won` is in `CAMPAIGN_STATUSES` and nothing in the game has ever written it, so nobody has decided what it would mean for a life in Night City to be over and to have gone well.                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| 11  | Incomplete   | Non-combat structured world-state deltas the GM proposes are only partially wired into persistence.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| 12  | Incomplete   | Encounters created before the atomic-closeout migration do not record which inventory rows supplied head and body armor, so their remaining SP cannot be written back. Legacy rows only.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| 13  | Incomplete   | Immediate in-job pressure reports and engine-derived settlement pricing are not causally deduplicated. Engine-derived settlement is the authoritative pass; the two are counted on different events, so this is a known overlap rather than a double charge.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| 14  | Unsettled    | The `goodwill` dial moves and no threshold reads it — and it is not alone. `raided`, `locked_down`, `power_out` and `rebuilt` are set by the engine and read by nothing, so four of the eight place flags are decoration. A dial or flag that changes nothing the player meets is the failure `PRODUCT.md` names. Giving `goodwill` a threshold is only half a fix: a flag needs a consumer, and what goodwill BUYS is a design decision.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| 16  | Unsettled    | `bun run eval` now measures the mechanically checkable half of a prompt change: eleven detectors over five scenarios, each tracing to a line in `PRODUCT.md` or to a rule a prompt states. It calls a real model, so it is not a CI gate; the detectors themselves are pure and are tested in CI. What it cannot see is prose QUALITY — whether a turn is any good, as against merely legal — and that still has no measure but reading it.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| 15  | Unsettled    | The location layer's pacing numbers — `PLACE_OBSERVATION_EFFECTS`, the beat periods, the `place-state.json` thresholds — have never been playtested. Tune them from a week in one district rather than from argument.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| 18  | Unsettled    | Sex and age reach only the narrator. They are recorded at creation (`engine/identity.ts`, house rule) and the narrators are told to let a stranger's first assumption differ by them, but nothing deterministic reads them: no DV, price, disposition start or place action moves. Whether any should (a starting disposition by age band and Role, say) needs a week of play first.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| 19  | Incomplete   | The eval measures single turns and three pairs, on one model and one character. Real played turns can now be replayed (`bun run eval:replay`, the three prose rules and a prose-length measure, grouped by prompt version and model), but only those: the ledger does not keep the packet a turn was written from, so the number, options and dice checks cannot run on it. Prose quality has a judged layer (`bun run eval:judge`, order-swapped, never a gate) that is only as good as its calibration: a person must label a blind sample (`eval:judge label`) before its verdicts mean anything. Multi-turn scenes are scripted sessions (`evals/sessions.ts`, five and four turns); a first run found no drift, and a named person holding one name across turns is checked narrowly (`keeps-its-people`, a heuristic not yet seen to fire live). Not yet measured: the Opening and background prompts, and reliability across models. |

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
