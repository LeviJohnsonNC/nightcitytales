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

Phase 1 implementation now includes three spatial layouts per recipe, reserved
and validated exterior entrances, a character-free `/scene-review`, silhouette
occlusion and permanent-wall targeting feedback. Six rendered examples and the
acceptance matrix are in the linked notes. Legacy snapshots retain their saved
geometry. The SQL prerequisite was confirmed applied by Levi on October 3.

Automated and local browser checks pass. Final rollout acceptance is a deployed
campaign playthrough: enter, move/damage cover, reload, finish, and verify the
saved aftermath. Next content work is facade/prop art and recipe tuning, then
interior proofs and structured adventure facts. Arbitrary prose-to-battlefield
generation remains outside this milestone.

## Interior composition — Phase 2

Office and nightclub each have three authored spatial layouts, saved room
connections, public/service openings, protected furniture working space and
cutaway wall presentation. They reuse Phase 1 cluster placement, cover, movement,
visibility and persistence. The review page includes a room/access plan.
See [interior composition](docs/interior-composition.md) for evidence and limits.

Residential streets, warehouses and garages now each add three layouts through
the same foundation. See [environment extension](docs/environment-extension.md)
for captures, constraints and rollout checks. Next: deployed playtesting, art and
recipe tuning, then structured adventure integration.
Final painterly art, interactive doors and tactical height remain separate work.

## Adventure composition — Phase 3

Normal Job encounter starts now translate public structured scene facts into the
shared recipes. Named people, object/entrance bindings, crowd level and placement
relationships persist with the scene. Saved snapshots win over later model output.
The engine owns geometry and validation; impossible requirements fail explicitly.
See [adventure composition](docs/adventure-composition.md) for contracts and checks.

Deploy the guarded staging/entry migration before this client, then accept through
a normal campaign encounter. Peaceful Life scene staging, richer object actions,
artwork and tactical height remain separate work.

## Composition quality — dense default pass

The scene-review feedback exposed a gap between working placement infrastructure
and convincing places. The shared recipes now add stepped exterior wings and
setbacks, narrower alleys, mixed room furnishings, continuous bar runs and
protected circulation. New interiors use connected half-metre wall solids with
shared artwork/shot geometry; legacy full-width walls still load unchanged.
See [composition quality review](docs/composition-quality.md) for screenshots,
checks and remaining visual limitations. This is a blockout/composition upgrade;
facade variety, final artwork, lighting and deployed playtest acceptance remain.

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
   per preset against both budgets. (The shareable character card shipped as the
   Rap Sheet — see "Also shipped: the Screamsheet and the Rap Sheet".)

---

## In progress: shopping as discovery

The plan is `docs/shopping-discovery.md`: four passes from honest shelves to strange
gear the engine can keep its word about, then a store UI overhaul.

- **Pass 1, honest shelves (shipped).** The stock die was rolled every time Buy was
  pressed and never written down, so "not in stock tonight" meant "press again". Stock is
  now derived per stock week (`engine/shopStock.ts`): staples, each shop's own line, the
  week's unusual roll and a back room the place's goodwill opens, with "new since your
  last visit", "What's unusual?" and a restock countdown.
- **Pass 2, strange gear (shipped).** Finds (`engine/gadgets.ts`): ten base objects, each
  with a capability the engine enforces (quiet, remote, quick) and at most one limit (one
  use, temperamental, conspicuous), turned up per shop per week on their own seeded die
  and sold one of a kind. A find's id is its identity, so no migration. The printed gear
  bonuses (Agent, Medscanner, Techscanner) finally ride on the roll. The narrator is told
  each carried find's contract. Not run: `bun run eval` (the capability packet line is a
  context-renderer change and wants a paid eval before it is trusted).
- **Pass 3, the city stocks the shops (shipped).** Raids, shutdowns, power cuts and
  lockdowns (`place_changed`) and settled jobs send finds to that district's shops and to
  the fences for two weeks (`engine/shopSupply.ts`), each find saying where it came from. A
  find off a job that crossed an organisation is hot: cheaper, and buying it gets you seen
  by them. Selling at half the printed price; a find you sell sits on that shelf for two
  weeks and can be bought back.
- **Pass 4, merchants who know you (shipped).** Ask the sellers who know you to keep an eye
  out for something quiet, remote or quick: a matching find is set aside and passed on by
  word of mouth. One hold citywide with a 20% deposit for a week. Try a gun on the range at
  Toggle's, the Quartermaster, Hachiman Arms and the Armory. The Sell tab says where each
  thing came from and what it has been through.
- **The Counter (store UI, part 1, shipped).** The shop opens inline in Life's main column
  over the place's own painting: this week's finds as cards, the shop's line, the back room,
  the shelves, selling across the counter, and an item opened in place with what it does
  set apart from what it is. Part 2 is the item art (`docs/art-style.md`, "the Counter's
  item pictures").
- **Then:** the ripperdoc in the same shell, if the Counter holds up in play.
- **Was next:** Levi's store UI overhaul. Still open from the plan: the Watch, Pass, Reveal and
  Shield capabilities (each needs an engine lever first), repair and restoration terms, and
  a narrator eval of the finds' packet line.

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
gaps: legacy encounters with
no armor inventory IDs, pressure pricing that is not causally deduplicated, and
the missing `(campaign_id, npc_id)` uniqueness constraint. None of them block
the loop; all of them are cheaper to fix now than after more systems lean on
settlement.

---

## Also shipped: the ending, the odds, and the way out

Four small things that each close a gap a player meets.

- **Odds on every check.** One chip before the die — a word, a percentage, a
  gauge, and what one more point of Luck would add. It is made of the same
  modifiers the roll uses (`rollCheck.ts` `checkSetup`), held to the dice by a
  test. It also fixed a bug: the card's outlook text added a wound penalty back
  instead of taking it off, and never saw a Role bonus. Still open: the same
  chance on the battlefield (range rings tinted by hit chance), which needs an
  `attackBase` shared by the preview and the roll first.
- **The obituary.** A death used to be a bordered box. It is now the hit and the
  Death Save as receipts, the last thing the player had the character do, who is
  left, and what the run amounted to. It decides nothing about what follows a
  death; that is still below under "Explicitly not scheduled", and a successor
  ("the next runner inherits the city") is the natural follow-up once that is
  decided — it needs a migration and a ruling on permadeath.
- **The closing frame and "Previously".** Every settled job stores its peak and
  its one open thread in the receipt; Aftermath opens on it and the next Life
  screen opens on it until the player acts. Quiet jobs have none.
- **Link previews.** The root route still said "Lovable App". Shared links now
  carry a title, a description and a picture (`lib/siteMeta.ts`).

Held back on purpose: a music duck for the obituary — `useCombatFeedback` holds and releases the
soundtrack, and a second holder has to be ordered against it first.

---

## Also shipped: the Screamsheet and the Rap Sheet

- **The Screamsheet.** Night City now says what it saw. The book's own word for
  where the news is written (Reputation 8, p.193), and the missing piece
  `reputation-deeds.json` named: "nothing in the game writes the news yet". It is
  derived from the ledger, never stored, and stays inside four rules (says only
  what the engine recorded; names the character only when the engine says they
  were named; shows no dial; is empty when nothing happened). It pays part of
  standing debt 14: `raided`, `shut`, `locked_down`, `under_audit`,
  `gang_extortion`, `welcome` and `unwelcome` now have a consumer when they are
  SET. `power_out` and `rebuilt` are still only authored starting conditions that
  nothing sets in play, so there is no event for the sheet to print, and they
  remain decoration. Fame is printed from Reputation 3 and quotes the printed
  ladder.
- **The Rap Sheet.** The shareable character card this file said needed an
  image-rendering dependency. It did not: the card is hand-drawn on a canvas, no
  package added. Two shapes, themed by Role, with the stats, the six people, and
  for a campaign its record; a FLATLINED variant for the obituary.

Two things left open on purpose, for the owner:

- **Should the Sheet be able to EARN Reputation 7+?** The ladder says levels 7 to
  10 are news ("a news story or two has been written about your exploits"), and
  `reputation-deeds.json` caps jobs at Level 6 because nothing wrote the news.
  Something now does, so a story the Sheet runs could be what lifts a name past 6.
  That is a rule change, and so not made here.
- **Dials stay hidden, but flags are now told.** `PRODUCT.md` leaves open whether
  a place's hidden dials read as depth or as nothing happening. The Sheet reports
  the flag a place gained (something that happened) and never how close anything
  is to happening, but it does mean the player is now told a place has changed. If
  that is more legibility than wanted, removing the dock tile removes it.

Held back: an NPC referring to the Sheet in narration (it touches the model's
packet and needs `bun run eval`), the Rap Sheet at the end of creation from the
unsaved draft (Save to roster already lands on the page that has the button), and
the combat hit-chance rings, the music duck, and the successor from before.

---

## Also shipped: favours — goodwill you can spend

The goodwill dial moved and set `welcome` at the top of it, and that was the
whole of it. `welcome` fed one findable fact and a headline; nothing could be
bought with it. A place that has taken to you will now, once a day, go out on a
limb (`engine/favours.ts`, `src/data/atlas/favours.json`, house rule).

- **Two favours, both from things the engine already moves.** _Get patched up_
  (clinic, church, home, flophouse): a day of rest's healing, in two hours, by
  `planRest`. _Lie low_ (housing, hotel, flophouse, church, nomad camp): two
  reports of working clean through `applyPressure`, so the NCPD heat clock eases
  by the same arithmetic as anything else that eases it, scaled to how closely
  the district is policed (and not offered in one nobody polices, or when nobody
  is looking). Neither touches a die, a DV, a price or an outcome.
- **It costs what it is worth.** Goodwill is spent in dial segments (2 and 3),
  and a favour is only asked when it would leave one, so spending goodwill never
  turns a place against you. It does not regrow; a `favour` observation does.
  One a day from any one place (read back from the `favour_called` ledger event
  through `favourCalledOn`, so a reload cannot reset it), and only where the
  character is standing.
- **It is shown in words.** The dial stays hidden. The Life dock grows a
  Favours tile only where a place is welcoming and has something its ground can
  offer; the sheet says what each would do, what it takes out of the day, and
  why not today when it cannot.
- **Written so a failure is fair.** Benefit, then goodwill, then time, then the
  receipt: a failure partway costs a place a little less than it should have,
  never the player something for nothing.

Not done, and why: an _introduction_ (a dossier rung for somebody who drinks
here) and a _ride_ (free travel) are the obvious next favours, and each needs a
write this slice did not want to invent (a rung on `campaign_npcs`, a priced mode
of zero). A place asking something of YOU back, and a "Regular at" line on the
Rap Sheet, are the other halves of the idea. None of it has been played: the
costs and the once-a-day rule are guesses, in a data file, to tune from a week
in one district.

---

## Also shipped: real-browser tests

Everything before this ran in Node, so what a browser does with a page was only
ever found by looking. `bun run test:browser` (Playwright, Chromium, `e2e/`) now
looks for the four pages that need no account, at desktop and phone width: the
page loads, throws nothing, requests nothing that is missing, does not scroll
sideways, and passes an axe scan against WCAG 2 A and AA. Its first run found
one real defect: the landing page's "One night in Night City" timeline was an
`<ol>` whose children were `<div>` wrappers (the scroll-reveal), so the list had
children it may not have and its nine items had no list. `Reveal` can now be the
`<li>` itself (`as="li"`), and both the axe scan and a test that the timeline is a
list of nine fail on the old markup.

Not done, and why: the signed-in game (creator, Life, a job, combat) is where most
of the product is and where the layout bugs have been found, and it needs a
Supabase session the tests do not have — the next step is a fixture session or a
`/preview`-style route that renders a Life screen from a canned bundle. The suite
is not a CI gate: `.github/workflows/browser.yml` is manual (Actions tab) until it
has been watched go green on a runner, because a check nobody has seen pass teaches
people to ignore checks. Pixel snapshots are deliberately absent; they are the
flakiest thing a browser test can do.

---

## Also shipped: the career soak

The owed pacing check, and a gate. `src/features/dev/careerSim.ts` plays whole
careers without a table: the game's money and its climb, through the engine's
own functions (`rollPayment`, `pickJobSeed`, `reputationFrom`, `jobTierFor`,
`billsDue`, the I.P. prices), under stated playstyles and job cadences. Two uses:

- **A gate.** `careerSim.test.ts` plays a few hundred short careers in CI and
  fails if any breaks a rule the rest of the game leans on: money that is not a
  number, Reputation that goes down, work that gets worse, I.P. below zero, a
  payment above the fee. Proved to bite (a sign flip in the marked-money fraction
  trips it at once). It asserts no balance, because the playstyles are
  assumptions.
- **A report.** `bun run tools/pacing/soak.ts` (about two minutes at 100 careers a
  row; `--careers`, `--horizon`, `--start`) prints the table below.

What it plays: rent and Lifestyle, jobs at the crew's tier, the printed
Reputation deeds, I.P. awards (job tiers 20–50, life tiers 10–30 every seventh
day), and spending on the Role Rank or on Skills. What it does NOT: combat, so
nothing about how often anybody dies; ammunition, armor repair, doctors or
chrome, so every surplus below is an upper bound; how often work turns up,
which is the cadence column and a week at a table. The playstyles (ghost, pro,
brawler) are three guesses at how loud a crew is.

What it found, 100 careers a row, 180 days, 500eb to start, every Role evenly:

| Crew    | Jobs every | Steady work         | Serious work | First Rank | Rank at day 180 | Behind on rent |
| ------- | ---------- | ------------------- | ------------ | ---------- | --------------- | -------------- |
| ghost   | 7 days     | d84 (37% got there) | never        | d63        | 6               | never          |
| pro     | 7 days     | d21                 | d91 (57%)    | d63        | 6               | never          |
| brawler | 7 days     | d21                 | d42          | d63        | 6               | never          |
| pro     | 14 days    | d42                 | d126 (26%)   | d84        | 5               | never          |

- **Money is not a constraint, anywhere.** No career in any of the nine
  cadence-and-style rows was ever behind on rent, and at day 180 the median
  character holds 5,000–73,000eb. One job a month at steady pay covers a month's
  bills (1,100eb for every Role but the Exec, who pays 100). Even street work
  leaves about 570eb a job for kit and chrome at a job a week and 310 a
  fortnight. The simulator charges no kit, so these are ceilings — but they are
  the number the real costs have to beat. If a night's ammunition, armor and
  doctor do not cost roughly that, "eurobucks that only go up" (`PRODUCT.md`) is
  live. The next thing to build is a combat-cost model, so this stops being an
  upper bound.
- **A crew that works clean never leaves street work.** A clean job earns no
  Reputation (`reputation-deeds.json`), and the better tiers need Reputation 3
  and 5. That is the stated trade between heat and fame, and a test now pins it
  so it stays a decision; but it means the quietest play has no climb in work at
  all. Whether that is wanted is the owner's.
- **The climb has a flat second half.** A loud crew reaches the Reputation cap
  (6) and serious work by about day 40, and from there nothing new arrives in
  work or name; Reputation 7+ is unreachable (the open question above). What is
  left to climb is the Role Rank (a Rank every 10–20 awards at 300–600 I.P.) and
  Skills.
- **The first Role Rank takes about nine weeks of weekly jobs** (day 63 at a job
  every 7 days, 84 at 14), and a Skill Level about three jobs (day 21). Saving
  for the Rank means no Skill raises at all in that time; buying Skills means no
  Rank (4 at day 180). Both are choices a player makes, and now they have a price
  in days.
- **No invariant was broken** over the nine rows and the gate's careers.

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
  derived on every Life load and never stored. Levels 7 and up are headlines;
  the Screamsheet prints them, but no deed earns them yet.
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
  first tier and the first Rank arrive. The price half is now
  `bun run tools/pacing/climb.ts`, which reads the data files and the engine's
  own price functions and prints the awards each rung takes at 20, 30, 40 and 50
  I.P. an award. At a 30 I.P. award: a Skill Level 4 → 5 is 4 awards, the first
  Rank (4 → 5, 300 I.P.) is 10, Rank 10 from Rank 4 is 90, and a `doubleCost`
  Skill costs twice its Levels. What it cannot say is how many awards an hour of
  play earns, which is the GM's judged tier (`ipJudgement`) and a week at a
  table: until somebody plays one, "the first Rank takes ten awards" is a price,
  not a verdict on whether that is too slow.

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
| 3   | ~~Resolved~~ | Settlement read a bounded window (`JOB_LEDGER_LIMIT`, 2000 events) of the ledger. A job long enough to push its own `mission_started` out of it did not price wrongly, as this entry used to say — it **threw** ("no mission_started boundary") and could never be closed. `listCurrentJobEvents` now reads the exact range from the newest `mission_started` to the end, a page at a time, and stops when the API runs dry rather than on a short page (the API may cap a page below the size asked for; Supabase's default is 1000 rows). `currentJobEvents.test.ts` holds it to a 4,500-event job and a 300-row page cap.                                                                                                                                                                                                                                                                                                                |
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
| 14  | Unsettled    | The `goodwill` dial moved and nothing could spend it; its thresholds set `welcome`/`unwelcome`, which fed one findable fact and a headline. Favours (`engine/favours.ts`) now spend it, so `welcome` has a use at the till of the place itself. It was not alone. `raided`, `locked_down`, `power_out` and `rebuilt` were set by the engine and read by nothing, so four of the eight place flags were decoration. The Screamsheet now reads every flag the engine SETS in play (`raided`, `shut`, `locked_down`, `under_audit`, `gang_extortion`, `welcome`, `unwelcome`); `power_out` and `rebuilt` are authored starting conditions that nothing sets, so they are still decoration. A dial or flag that changes nothing the player meets is the failure `PRODUCT.md` names. Giving `goodwill` a threshold is only half a fix: a flag needs a consumer, and what goodwill BUYS is a design decision.                                     |
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
- What happens after a character death. (How a run ends is now told — see the
  obituary above — but what follows it is still undecided.)
- General inventory consumption beyond ammunition.

### Spatial composition follow-through

[Checkpoint 1](docs/spatial-organization.md) adds compact office programs, distinct intersection corner structures and closer shared framing. Next: complete activity groups, structural attachments, then transfer and seed variation across the remaining archetypes. This checkpoint does not claim reference-quality environments.

[Office checkpoint 1A](docs/office-topologies.md) implements three distinct circulation topologies and clearer primary entrances. Checkpoint 1B subsequently connected intersection parcels and pedestrian routes; the final structural review is recorded below.

[Intersection checkpoint 1B](docs/intersection-networks.md) implements a compact street profile, continuous frontage sidewalks and four protected crossings. The structural review passed on 2026-10-03. Broader combinations of corner programs remain in the later variation checkpoint.

[Checkpoint 1 closure](docs/checkpoint-one.md) makes the four corner forms more distinct, opens the workshop court toward the street, strengthens shared thresholds and reshapes the office core. Structure and furnished preservation checks are recorded for all six fixtures. **Checkpoint 1 is complete: Levi approved the visual review on 2026-10-03.** The final Office 1–3 lineup includes spine, loop and square open-core plans.

[Checkpoint 2A](docs/checkpoint-two.md) starts complete activity groups: office work pods and meeting support, shopfront vendor stock/customer space, and workshop delivery/maintenance groups. Shared placement protects their working space, including saved outdoor reservations. [Checkpoint 2B](docs/checkpoint-two-b.md) adds opposed paired/four-desk pods, reception/waiting and equipment-support groups, joined conference tables with perimeter storage, and purposeful exterior entry/customer/handling floor reservations. [Checkpoint 2C](docs/checkpoint-two-c.md) adds continuous counter/backbar groups, protected customer/staff aisles, lounge benches/conversation groups and service stock. **Checkpoint 2 is complete: Levi approved the visual review on 2026-10-03**, including the focused Intersection frontage correction. Structural attachments and broader recipe combinations remain subsequent checkpoints.

[Checkpoint 3A](docs/checkpoint-three-a.md) adds saved facade-relative canopies, residential/service surrounds and commercial headers, painted with their parent structures. No ground geometry or furnishings change. Next: 3B physical service-court boundaries and loading opening; 3C full furnished/tactical acceptance. Checkpoint 3 remains open.

**Checkpoint 3A is accepted:** Levi approved attachments and visual preservation on 2026-10-03. [Checkpoint 3B](docs/checkpoint-three-b.md) defines the service court with a movement-blocking, shot-permeable mesh edge and saved loading-mouth reservation; two edge planters are removed. Ready for review. Checkpoint 3C combined tactical/small-screen acceptance remains.

**Checkpoint 3B is accepted (2026-10-04).** [Checkpoint 3C](docs/checkpoint-three-c.md) completes engineering preservation verification: 3,518 tests pass, destruction/access regression coverage, browser snapshot restoration, desktop occlusion and 390px targeting checks. No composition or runtime changes were needed. Checkpoint 3 is ready for final user acceptance; final artwork remains future work.

**Checkpoint 3 is complete:** Levi accepted the final architectural identity, circulation, actor/targeting and damage preservation review on 2026-10-03 (Regina time).

[Checkpoint 4A](docs/checkpoint-four-a.md) transfers functional service groups and facade thresholds to the alley, and adds domestic entry groups, protected walks and attached-home/apartment forms to residential streets. 4A accepted: alley and residential both passed user review, including repeated unit entrances and explicit curb bays. [Checkpoint 4B](docs/checkpoint-four-b.md) now supplies paired rack aisles, reserved freight/vehicle routes and complete garage service bays with tools and parts; accepted by Levi on 2026-10-04. [Checkpoint 4C](docs/checkpoint-four-c.md) adds nightclub admissions, complete DJ groups, direct public circulation and a preparation station for the larger back room; accepted by Levi on 2026-10-04. [Checkpoint 4D.1](docs/checkpoint-four-d1.md) introduces independent seeded Intersection frontage/service choices and Office work-pod choices, recipe-v5 provenance, reproducible seed review, and legacy-save preservation. Awaiting visual review. [Checkpoint 4D.2](docs/checkpoint-four-d2.md) now transfers independent choices to the remaining five environments, preserves accepted seeds and legacy snapshots, and provides curated comparison pairs. Automated verification is complete; browser access was denied, so visual acceptance remains open. Six functional compositions per transferred environment except Residential (four excluding rotation). Next: 4D.3 audits diversity, preservation and reference-image readiness across all seven; resolve composition/framing gaps before claiming only artwork and lighting remain. No new rendering or combat branch.

[Checkpoint 4D.3](docs/checkpoint-four-d3.md) audits all 42 curated examples across
seven environments and records their actual functional diversity, circulation,
targeting and review-save preservation. Foreground building occlusion is addressed
with a shared activity-reveal control; renderer teardown and scenery retry improve
review recovery. No accepted geometry or saved snapshot changes. **Deployed visual
verification of these rendering changes, real 390px checks and Levi's manual
campaign/visual acceptance remain open.** The audit supports moving to artwork,
facade/detail assets and lighting after that gate, not closing 4D on tests alone.

[Checkpoint 4D.4](docs/checkpoint-four-d4.md) responds to Levi's screenshots after
4D.3: opaque building cutaways, joined directional vehicle sections, balanced
work pods and larger conference groups, warehouse packing/dispatch, complete
service-bay markings, open wide interior thresholds, opposed alley courts and
selective intersection spacing. New recipes use v6 while accepted seeds and old
snapshots keep their geometry. **3,556 tests pass; deployed visual/campaign review
remains open.** The screenshot evidence supersedes 4D.3's optimistic artwork-only
assessment; reference readiness is not yet claimed.

[Checkpoint 4D.5](docs/checkpoint-four-d5.md) resolves shared furniture projection
and rotation, retains entrance/wall identity in exterior cutaways, articulates
existing frontage, marks saved parking groups, and preserves footprint scale in
recognizable damage states. No recipes or saved geometry change. **3,639 tests,
typecheck, lint and build pass.** Levi confirmed stable switching on 4D.4; this
revision still requires deployed visual and campaign acceptance. Offline drawing
inspection across all seven environments supports retaining the approved spatial
foundation for the facade/detail asset pass; it is not browser acceptance.

[Checkpoint 4D.6](docs/checkpoint-four-d6.md) corrects physical height calibration,
atlas damage registration, footprint-based depth ordering and segmented facade
cutaways. Overview fits roofs and ground; narrow review controls remain usable.
All 42 curated compositions received live browser inspection, with actor/targeting
checks and review save/load across all seven environments. **3,817 tests, typecheck,
lint and build pass.** Accepted geometry and recipes are preserved. The audit
supports moving to artwork/detail/lighting; Levi's final visual approval and real
campaign movement, firing and save/load acceptance remain open.

[First material pass](docs/checkpoint-material-pass-1.md) puts the six supplied surface
textures into the shared renderer for the Intersection recipe only: asphalt and
sidewalk across the street, and concrete walls, roof membrane, rooftop metal and door
shutters on shop-style masses. Physical scale is stated per tile and projected with the
scene's own transform; geometry, collision, targeting and damage are untouched, and six
other environments render pixel-identically. Before/after browser captures are in
`docs/evidence/materials-1/`. **Awaiting Levi's visual review**; no reference image was
available to compare against, and real campaign movement, firing and save/load are still
unchecked. Next: facade and prop art that needs silhouette and ground-anchor guides
(shopfront bay, shutter door with housing, awning, rooftop units, standing props).

[Storefront corner](docs/checkpoint-storefront-corner.md) is built for intersection seed 7, from the
three returned images (window interior, awning fabric, shutter wear), a code-drawn kanji sign, and recipe
revision 7's saved lamp: window recesses, a shutter door with housing and rails, fascia, awning as its own
sprite, rooftop units, contact shadows, and the four lighting steps (with a lights-off view). **Awaiting Levi's
visual review**; no reference-level quality is claimed, and real campaign movement, firing and save/load are
unchecked. Spec and guides: [`checkpoint-storefront-pack.md`](docs/checkpoint-storefront-pack.md).

[The corner at night](docs/checkpoint-storefront-night.md): the intersection now has a night. A cool ambient
tints the scene's sprites, and local light is drawn as additive sprites attached to their surfaces, with
lights-off and neutral views. The seed-7 corner gets a rebuilt streetlight, lit windows and an entrance light,
a valance sign that survives the cutaway, and stronger contact shading. Captures use a reproducible gameplay
framing (`cam=`, `player=`) and sit beside the reference. **Awaiting Levi's review.** Open items: the lamp still
sits over the parked car (a recipe position change), and the cutaway floors still dominate with reveal on (a
separate treatment is proposed, not built).

[Finishing the corner](docs/checkpoint-storefront-finish.md) is done.

- The streetlight's arm is now chosen from saved geometry, so the lantern hangs clear of the parked car.
  All 68 lamps in seeds 0–80 clear, and the base never moves.
- Contrast is refined selectively: deeper contacts and recesses, a material grade that separates asphalt
  from paving, lamp-lit edges, readable windows, and a feathered cone and spill.
- A blade sign stands off the fascia. It fades and leaves with its wall.

A quieter cutaway was compared and **not adopted**. **Awaiting Levi's review.**

[The street props](docs/checkpoint-street-props.md) are in: all twelve images (sedan in both rotations,
planter, cabinet, each intact, damaged and wrecked) are imported and replace the placeholder kit on
intersection scenes. Geometry, cover, targeting and damage are unchanged, and other environments are
pixel-identical. Open items: the wrecked images stand taller than the brief asked (they draw under units, as
walkable remains), and the r0 sedan shows a hard edge where an intact cabin meets a wrecked engine. **Awaiting
Levi's review.**

[The architectural pilot](docs/checkpoint-architecture-pilot.md) finishes the prop integration and the shop's
block.

- **The r0 sedan seam is fixed at its cause.** Complementary soft cut masks left a faint line, and rounded crops a
  half-pixel misregistration. The importer now samples at sub-pixel precision, pads the sedan's art so each half
  fits whole, and fails on any see-through seam.
- **The shop's block reads as built.** Parapets and copings, a downpipe on a pier with its scupper and shoe, a meter
  box, a cill and a plinth. Its neighbours get a restrained identity: dark render, barred high windows, a louvre and a
  metal cap.
- **The street.** Segmented kerbs with faces, a drainage channel, gullies, dropped kerbs with tactile paving, and wear
  where use puts it.
- **Unchanged:** geometry, routes and every other environment.

[The lower wrecks and the neighbours' tiles](docs/checkpoint-wrecks-and-tiles.md) are in.

- **The wrecks.** The planter and cabinet v2 wrecks pass the height gate. A redraw that sits off
  its footprint is placed on it by translation, and flat spill is reported, not failed. The gate is
  live, so a wreck that stands too tall fails the import.
- **The tiles.** `roof-ballast` and `painted-render` give the shop's neighbours their own roof and
  walls.

**Awaiting Levi's review.**

[The architectural art pilot](docs/checkpoint-architecture-art-pilot.md) is in: a painted rooftop unit on
every plain roof box, and a painted window and roller shutter on the annex, on intersection scenes.

- **Corrected, not passed.** The window came back with its frame across the cut strips. The importer
  registers it by its frame bands and crops the room behind the glass, and holds the result to the guide
  again.
- **The shutter is the annex door's surround.** The saved surround is drawn as the shutter; the attachment is
  unchanged.
- **Unchanged:** geometry, cover, sorting, the cutaway and every other environment (pixel-identical).
- **Still placeholder:** the walls around the new openings, the storefront's own procedural rooftop units, and
  the units' value against a dark roof.

**Awaiting Levi's review** before any wider rollout.

[The finished corner](docs/checkpoint-corner-finish.md) is in, with existing assets only.

- **One language on the roofs.** The storefront's units are the painted unit too. The streetlight's pool is laid
  on each at its own lid, masked by the art.
- **The annex's surfaces.** A concrete coping, a plinth, piers, readable sills and reveals, and the shutter
  housing's top and end in its own painted steel.
- **The shutter's ripple** was downsampling baked into the building's texture, not the art. All painted art is
  now prefiltered before it is drawn small.
- **Windows extended.** The painted window replaces the flat teal bays on commercial faces outside the
  storefront's face and its barred neighbours, varied per bay without mirroring.
- **Next, by what stands out at play zoom:** the residential block's openings (they need their own treatment,
  probably one residential window image), a weathered render for the shop walls, then the presentation review
  (labels, bars, the cutaway's weight).

**Awaiting Levi's review.**

[A clear, restrained tactical presentation](docs/checkpoint-presentation.md) is in, as a shared change to the
one combat board.

- **The cause of the oversized labels.** The board's SVG is in scene units, so names, bars and lines grew with
  the camera (and shrank to unreadable on a phone). Markers are now drawn in screen pixels with a role
  hierarchy: target, pointed, you, threats, allies, bystanders.
- **The movement overlay is quiet at rest.** It is an edge of reach, with squares and a route only while
  planning.
- **The cutaway reads as a building mass,** not an empty room.
- **Unchanged:** rules, hit areas and geometry. A real `/play` fight and save/load are not verified.

**Awaiting Levi's review.**

[Presentation fixes and a completion pilot for the homes and sheds](docs/checkpoint-building-pilot.md) are in.

- **The dashes across the cutaway** were the board's own outline, an overlay printed over buildings. It is now
  left out wherever it would cross a building or run behind one.
- **On a phone,** the information card no longer covers the person it is about or the camera buttons. It has a
  dismiss button for touch.
- **The residential block and the industrial sheds** now use the existing render and painted-metal materials.
  - Homes have framed windows with sills and somebody behind them.
  - Sheds have steel-framed wired glass, a fascia and a proper loading door.

  No new artwork; every opening is where it was.

- **Unchanged:** rules, hit areas, geometry and saved state. A real `/play` fight and save/load are not verified.

**Awaiting Levi's review.**

[The intersection's ground](docs/checkpoint-ground-pass.md) is finished, from existing materials only.

- **Surfaces.**
  - Unclaimed ground is concrete hard standing.
  - Entrance pads are threshold slabs, and the entry is paving.
  - The loading court is asphalt.
- **Wear goes where use puts it:** slabs, gully silt, worn crossings, oil drips, wall feet and thresholds.
- **Props are grounded by contact shade made from their own picture.** A wreck's is its own. The flat footprint
  rectangle is gone on the intersection.
- **Unchanged:** rules, geometry and overlays.
- **Not verified:** a real `/play` fight and save/load. The checkpoint carries the manual checklist for it.

**Awaiting Levi's review and the manual check.**

[The atmosphere pilot](docs/checkpoint-atmosphere.md): the existing lights now fall on the walls round them.

- **Light on walls.** Each lamp and sign lights the camera-facing walls in front of it, with no leaks through
  buildings and nothing on unrelated roofs.
- **Lit windows** light their sill and the wall round them.
- **The secondary source.** A few occupied homes, three windows per block, are lit; most of the block stays dark.
  The shop stays the focal point.
- **The damp experiment was built and omitted.** With this camera, reflections land away from any plausible
  puddle, and are too thin to read at play zoom. The checkpoint gives the evidence and what would work instead.
- **Rendering is slightly faster than baseline,** because each light sprite is now cropped to its lit pixels.
- **Unchanged:** rules, geometry, overlays and the camera.
- **Not verified:** a real `/play` fight and save/load.

**Awaiting Levi's review.**

[Commercial streetfront identity](docs/checkpoint-streetfront.md): the commercial faces seen at play zoom now read
as a street of businesses.

- **Seed 0.** The shopfront faces away from the camera there, so its long side now shows the night market: two
  lit display windows at the corner under its neon name, a concrete storey under a rendered band, one shuttered bay
  and a kitchen extract.
- **Seed 7.** The same composition turns the shop's corner.
- **Seed 8.** The neighbours' frontage gains a clad fascia zone and one painted, gooseneck-lit sign board.
- **Unchanged:** geometry, openings, rules, camera, overlays and the awning. No new artwork: the sign lettering is
  a font mask from the existing tool.
- **Not verified:** a real `/play` fight and save/load.

**Awaiting Levi's review.**

[Prop consistency](docs/checkpoint-prop-consistency.md):

- **Repetition.** The street sedan now comes in beige, burgundy and charcoal, recoloured from its own art
  through a paint mask. Each car is chosen from the saved layout.
- **The audit.** Every visible art binding on seeds 7, 0 and 8 is accounted for. The pale cabinet in seed 0 is
  the painted cabinet's binding at rotation 90, which has no art.
- **Round two** ([import](docs/checkpoint-prop-round-two.md)). The striped merchandise stand (r0 and r90) and the
  rotated cabinet are painted art now, three states each, through the same importer and checks as round one.
  The r0 stand's redrawn wreck passes its volume, so no waiver remains.
- **Debt.** The atlas props (cart, crates, dumpster, generator, pallet) are mirrored at rotation 90.
- **Not verified:** a real `/play` fight and save/load.

**Accepted through #298.**

[Ground light](docs/checkpoint-ground-light.md) (Levi accepted the architectural and prop work through #298):

- **Prop checks closed.** The r0 stand's redrawn wreck passes its unchanged volume limit, so no waiver remains.
  People behind and beside the stand, in both rotations, were selected and targeted in scene review, and a
  route crosses a destroyed stand's footprint.
- **Lamp shadows.** Each prop near a light shades that light, from its fixture height. A destroyed prop casts
  only its wreck's shadow, and fading never touches one.
- **Damp sheen.** Tried as a separate experiment and omitted: at play zoom it read as haze.
- **No measurable frame or load cost.**
- **Not verified:** a real `/play` fight and save/load.

**Awaiting Levi's review.**

[Shadow state](docs/checkpoint-shadow-state.md) (#299 accepted; the sheen stays omitted):

- **Overlapping shadows after destruction, fixed.** Props whose shadows touch form a region, rendered from its
  complete state when it changes and cached by state. #299's per-prop restores left the overlap dark when both
  were destroyed.
- **Checked against fresh renders** (`tools/scenes/shadow-state-check.mjs`): two overlapping casters and a second
  light, every state in both orders and loaded directly, seeds 7, 0 and 8, and the live board against direct
  loads. No unexplained pixel differs.
- **Performance,** apart from the benchmark's waits (`tools/scenes/scene-perf.mjs`, runnable on a Mac with
  `--chrome`): frame times unchanged, scene ready slightly sooner.
- **Not verified:** a real `/play` fight and save/load. The steps for Levi are in the checkpoint, §5.

**Accepted (#300).**

[Material pilot](docs/checkpoint-material-pilot.md) (the shop corner's ground response):

- **PR 302 (merged): the approach is possible.** The check's 3/255 rounding limit is enforced. Reflections are
  pictures of their fixtures, cut by props, and they go with their lights.
- **Revision: not visually accepted, so off by default** (`skip`: not built, no cost in `/play`).
  - Sources are extracted to their emitters before any stretch. This fixes PR 302's summed-dim-wall bug, and a
    browser pixel check holds it.
  - A deterministic wet mask replaced the glitter with patches.
  - At play zoom the lit wet patches read as pale stains and the pictures as isolated marks, so tuning stopped
    there.
- **Measured (software GL).**
  - Construction: 0.16–0.44 s.
  - A first damage change: 19–76 ms of rendering. A repeated one: none.
  - `reflection-perf.mjs --chrome` measures real hardware.
- **Untested hypotheses:** wet ground darkened where it does not reflect, and more street-level sources.
- **Not verified:** a real `/play` fight and save/load.

**Stopped; reflections opt-in.**

### Finished shop material pass (after 304)

A coherent plaster/green-tile shop, burgundy fascia, built lintel, quieter commercial roof fields
and larger, correctly filtered signage replace another effects-only iteration. Existing geometry,
lighting settings and reflection default stay unchanged. Real-browser comparisons and gameplay
fixture checks: `docs/checkpoint-finished-corner.md`. The whole intersection is **not** declared at
reference quality; the next art target is a second complete, contrasting frontage, judged alongside
the shop at normal play scale.

### Residential block and annex finish (2026-10-07)

Implemented the prepared residential pass with Levi's returned artwork: deeper
sills/heads, floor bands, low masonry, deterministic room infill and shared clipped
full/revealed facade rendering. Annex keeps existing openings/art. Connected
Chrome review covers seeds 7/0/8, lights off, reveal, targeting and frozen review
restore. See `docs/checkpoint-residential-finish.md` and its actual-browser evidence.
Shop remains primary. Accepted and merged by Levi as PR #307; the broad roof
surface debt is addressed by the following roof pass.

### Residential roof construction (2026-10-07)

Follow-up to accepted PR #307: recessed membrane, substantial coping, quiet lap
seams/repairs, internal drains and equipment curbs inside the original home/annex
roof envelope. Reuses existing materials. Normal-play, lights-off and reveal
review completed in connected Chrome; accepted and merged by Levi as PR #308. See
`docs/checkpoint-residential-roofs.md`. Coping and roof rhythm now read at play
scale; drain/repair detail remains secondary and the broad roof fields stay quiet.

### Street material field (2026-10-07)

Levi accepted and merged residential facade #307 and roof #308. The next pass
addresses the large uniform ground field: clearer asphalt/paving tones, sparse
road repairs and fractures, and chipped paving, below road paint and tactical
marks. Normal-play comparison, lights-off, reveal, alternate layouts, destroyed
cover and frozen review restore checked in connected Chrome. See
`docs/checkpoint-street-surface.md`; accepted and merged by Levi as PR #309.

The next highest-impact art work is the remaining commercial frontage
composition: substantial bays/recesses, distinct materials and coherent signage.
Taller, more varied silhouettes and less roof-dominated composition remain a
separate design gap that surface detail cannot solve; propose those deliberately
with frozen-layout compatibility. Further tiny roof details and stronger glow
are lower priority. Reflections stay off by default.

### Stepped commercial frontage (2026-10-07)

Recipe v8 raises the newly generated commercial row to two/three storeys, with
warm plaster and cooler render, room windows, projecting sills, masonry piers and
floor courses. Existing saved geometry is read unchanged. This closes part of the
low-strip-mall silhouette gap; it does not claim reference parity. Seed 7 exposes
the tradeoff: taller foreground masses fade more to keep actors readable. Seeds
0/8 show the stronger facade composition at normal play scale. See
`docs/checkpoint-urban-frontage.md`; visual acceptance pending.

### Selective foreground visibility (2026-10-07)

Finished intersection buildings remain opaque when their actual geometry clears
the action. Obstructing roofs open; clear facade sections retain full height and
obstructing sections become low solid walls. Valid route previews participate,
and cancelling restores the building. Existing manual reveal and all tactical
rules remain unchanged. See `docs/checkpoint-selective-foreground.md` for browser
evidence, tests and limits. Next: the planned street/frontage finish pass; reference
quality is still pending visual acceptance.

### Street frontage finish (2026-10-07)

The intersection shop now has stronger window/entrance joinery, paneled bases,
a longer lit corner display and a vertical sign sized for its saved height.
Repair frontage, kerb edges and shop thresholds have distinct material treatment;
existing streetlamp pools are broader with softer centres. See
`docs/checkpoint-street-frontage.md` for matched evidence and validation. This is
a finish improvement, not reference parity. Normal-play roof coverage and the
amount of screen given to the street remain the next composition questions.

### Battlefield-first combat layout (2026-10-07)

The combat screen gives the street the full width by default, with an optional
readout and a compact header, initiative strip and action dock. The matched
682 × 704 review gains 79% battlefield height. Pending rolls and opening requests
remain exposed. See `docs/checkpoint-battlefield-first.md` for evidence and checks.
Reference parity still needs stronger street-facing silhouettes and lighting.

### Intersection action composition (2026-10-07)

The first stage of the reference-quality street milestone fits the starting view
to the participants with a pavement apron, holds during play, and offers explicit
recovery when participants go offscreen. Seed 8 reads about 50% larger at the
matched desktop size. Scenery-only review shares the Action area framing.
See `docs/checkpoint-intersection-composition.md`. Next: wet ground and lighting,
then measured assets for distinctive street fixtures/frontages; existing shop
and prop art is reusable. This is not reference-parity acceptance.
