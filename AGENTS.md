<!-- LOVABLE:BEGIN -->

> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.

<!-- LOVABLE:END -->

# Night City Tales contributor guide

## Resuming work and keeping sessions bounded

Read `docs/AI_HANDOFF.md` first when starting or resuming implementation.
It is the current-work index; PRODUCT.md remains the product authority,
ROADMAP.md the priority/debt authority, and this guide the architecture authority.

- Verify the checkout path, remote, branch, HEAD, working-tree changes and relevant
  PR state before editing. A local reconstructed commit is not proof of the remote
  baseline. Inspect existing local work before replacing or rebuilding it.
- Start with the handoff's next action and linked evidence. Read additional
  architecture sections and source files as required by the task; do not replay
  every historical checkpoint or dump entire files/logs to reconstruct a session.
- Work toward one reviewable milestone per chat. Large goals can span several
  chats. If a milestone grows, checkpoint a coherent partial result before
  continuing; do not silently expand into another visual experiment.
- Update the handoff after a meaningful edit batch, before long validation or
  browser work, when a blocker changes the plan, and before ending the session.
  During sustained work aim for a checkpoint about every 15–20 minutes.
  This is an assistant workflow, not a background timer or guaranteed autosave.
- Keep the handoff under approximately 120 lines. Record timestamp, goal,
  repo/branch/base, changed paths, what is committed/pushed/local-only, validation
  evidence and limits, blockers, and the next concrete action. Link detailed
  evidence instead of copying it. Name the implementation revision checked;
  do not pretend a document can contain its own final commit hash.
- Preserve work on the task branch with ordinary commits and, when authorized,
  push checkpoints or open/update a draft PR before lengthy review. Unverified
  work must be labelled explicitly. Never push incomplete work to main, rewrite
  published history, or include unrelated files or secrets. If persistence is
  blocked, state exactly which work remains local and where.
- Store verbose test output in files; report the exit code, counts and relevant
  failures. Fetch small source ranges and targeted diffs. Do not rerun successful
  checks unless changed code or a required gate makes their evidence stale.
- After a failure, retry only with a changed hypothesis or environment. If the
  same blocker survives two attempts, record diagnostics and the smallest next
  step; switch to independent authorized work or hand off instead of looping.
- Separate implemented, tested, visually inspected, pushed and merged states.
  A screenshot is not a passed browser test; a historical suite pass does not
  validate a new tree. Recheck permissions/capabilities in a new session rather
  than assuming an old environment failure still applies.
- End with the result/PR, remaining gate, and a short fresh-chat prompt.
  Do not promise that project memory alone will recover local files or permissions.
  User review/merge remains the established workflow.

## Product

Night City Tales is a solo Cyberpunk RED game with two connected experiences:

- A rules-driven character creator supporting Streetrat, Edgerunner, and
  Complete Package creation methods.
- A persistent campaign that cycles through Life, Hook, Job, and Aftermath, in
  which an AI GM narrates and parses intent while deterministic TypeScript code
  owns dice, checks, combat math, positions, money, time, pressure, and every
  phase transition.

`PRODUCT.md` is the product compass: what the game is for, where the line
between the engine and the model sits and why, and how to resolve an ambiguous
design request. Read it before making gameplay, UX, AI, or content decisions —
in particular "Before you build", which is the checklist any new abstraction,
table, service, state machine, prompt or framework has to answer first.
This file stays authoritative on architecture; `PRODUCT.md` is authoritative on
intent.

`ROADMAP.md` says what to build next and why, and carries the single list of
standing debts — ordered and tagged by severity. Update it when a milestone
lands, when the ordering changes, or when a debt is paid.

The top-level `README.md` is the orientation document: what the product is, how
the loop and the city layer fit together, the stack, and where things live. It is
kept current — if a change makes it wrong, fix it in the same change.

## Architecture boundaries

### Rules engine

`src/engine/` is pure TypeScript. It must not import React, feature modules,
Supabase, or backend adapters. It takes plain objects and returns plain objects.

- All dice rolls and character/game arithmetic belong in the engine.
- `ledger.ts` owns the payload contract for the events something reads back.
  `campaign_events.data` is jsonb, so a writer and a reader agreeing on field
  names is a coincidence until something enforces it — and when it lapses,
  settlement does not throw, it prices a job at zero. Build a payload with
  `attackEventData` / `deathSaveEventData` and read one with the matching
  `read*` function; do not spell the field names at a call site. No schema
  library: the engine imports no third-party package at all, and these are
  plain narrowing functions.
- UI code must call engine functions instead of duplicating rules or arithmetic.
- Rules values must come from `src/data/rules/`, not from literals in components,
  backend code, or AI prompts.
- Keep engine behavior deterministic in tests by accepting injectable randomness
  where appropriate.
- `src/__tests__/boundaries.test.ts` enforces the import boundaries — engine
  purity (including `import()` and `require`, not just `from`), the
  backend-adapter rule below, and the server-only rule that keeps
  `LOVABLE_API_KEY` and the service-role client out of the browser bundle.

Using something is two decisions, and they live apart. `legality.ts` says
whether a character MAY use an item — do they have one, do they have enough —
and `consumables.ts` says what is left afterwards. The second half did not
exist until a Life turn was found printing "Used 5× Glow Paint" over five
untouched cans. Its data is `src/data/rules/consumables.json`, flagged
`houseRule: true`, because the book prices a Food Stick and an Electric Guitar
the same way and never says that eating one leaves you with none: a table does
not need telling. Anything not on that list is equipment — used, not spent —
and ammunition is consumable as a class. Both turn loops go through
`features/campaign/itemUse.ts` rather than each deciding for itself.

An arena is furnished from a library rather than from scratch.
`battlefieldProps.ts` holds thirty-one named objects — a sedan, a bus, a bar
counter — and `placeProp` stamps one at a point as ordinary `CoverPiece`s, so
the arena keeps its own ids and this never becomes a second source of truth
about where anything stands. A prop is a LIST of 2m sections because pg. 182
makes that the attackable unit: a car is an engine block you can hide behind
and a door you cannot. Its data is `src/data/rules/battlefield-props.json`,
flagged `houseRule: true` — the HP table is the printed one, but which
material a bus is made of is a judgement, and each entry carries the row it
was read against. Three entries are scenery at 0 HP: a fence stops a person
and no bullet, which the engine already models and nothing had used.

Scene-backed encounters may carry an immutable `layout` snapshot. Read their
geometry through `battlefieldFor(live)`, never by resolving `live.arena` alone.
`battlefieldSnapshot.ts` validates saved bounds, grid positions, object IDs and
frozen material HP; unknown versions or invalid positions fail explicitly rather
than moving actors or substituting open ground. Legacy encounters without a
snapshot keep the authored-arena path. The authored North Heywood proof is
available only through the existing `/combat` harness; see
`docs/north-heywood-proof.md` for its limits and deployment prerequisite.
New scene entries use `start_scene_encounter` and carry an immutable origin.
Their save payloads require lifecycle protocol 1 and a terminal result when the
fight ends. Queue NPC/attack events into `saveLiveEncounter` for these fights;
never append another `encounter_ended` after the transaction has committed it.
Legacy encounters without `origin` retain their previous protocol. `features/scenes` stages persistent authored instances before combat and reads
those snapshots for entry. `campaign_scenes` owns their stable identity and result;
the scene completion trigger runs in the receipt transaction. One fight per scene
is supported for now. `sceneAttackIntent.ts` recognizes a narrow full-command
vocabulary at saved scenes. The entry RPC persists its request in the immutable
origin; attack previews recover it only while the first Action remains unspent.
Do not bypass initiative or resolve a shot inside the entry parser.
This is not yet a whole-command transaction or automatic
scene generation from prose.

Composed fixtures use `sceneComposer.ts` and battlefield snapshot v2. Semantic
zones, clusters, static structures and art bindings are frozen inside the arena;
render them from `arena.environment`, never infer them from a fixture key. Use
`shotObstacles` for visibility that includes permanent structures; `coverBlocking`
returns only attackable cover. Static structures have no HP. The outer persistent
scene manifest/lifecycle remain v1. Legacy layouts continue to load unchanged.
Recipe v2 adds saved exterior entrances and three spatial variants per recipe.
`/scene-review` uses the shipping renderer and engine readers with static fixtures;
it must not become a separate combat loop. Recipe v3 adds office/nightclub/warehouse/garage
rooms and saved opening/access constraints. `interiorRecipes.ts` authors spaces;
`industrialRecipes.ts` supplies warehouse/garage plans; `residentialRecipe.ts`
adds residential frontage and driveways. `sceneClusters.ts` is the placement
machinery shared with outdoor recipes.
`interiorPropArt.ts` supplies a reusable provisional furniture kit, not a location
renderer. Interior walls remain permanent; openings are always open. There are no
walkable upper floors or interactive doors. See `docs/scene-composition.md` for
the opt-in harness and acceptance evidence. `adventureScene.ts` binds coordinate-free
`SceneFacts` to these recipes for normal Job encounter starts. Authored beat facts
win over model suggestions; persisted scene facts win over both. Keep the normal
route through `beginAdventureEncounter` and the guarded adventure RPCs: generic
fixture staging permits travel and must not be used for a delayed GM response.
See `docs/adventure-composition.md` for the deployment prerequisite and limits.

A check shows its chance before the die, and the chance is made of what the die
is rolled with. `features/play/rollCheck.ts` assembles Luck, the wound tax and
what the Role brings once (`checkSetup`) for BOTH `rollPendingCheck` and
`previewPendingCheck`, and the preview reads STAT and Skill from the same actor
the roll uses. `checkOdds` and `opposedOdds` (`engine/checkOdds.ts`) count the
d10 and its critical die exactly, ties as `OPPOSED_CHECK_TIE_GOES_TO` says, and
`checkPreview.test.ts` rolls for real and holds the preview to `result.modifier`.
Do not compute a chance beside the roll: the card's outlook text once did, and
subtracted a wound penalty that is already negative.

A run ends, and a job ends, on things read back from the ledger. A death is
`features/campaign/obituary.ts` (pure; the receipts come through
`readAttackEventData` / `readDeathSaveEventData`) laid out by
`play/ObituaryCard.tsx`; it says what happened and nothing about what comes
next, which PRODUCT.md leaves open. A job's ending is `engine/closingFrame.ts`:
the PEAK (a Death Save survived, then a hit that left almost nothing, then a
natural 10 or 1, then the hardest call set, then the biggest hit) and one open
THREAD (a survivor, a clock pushed past half, a broker who came away colder).
`settleAftermath` computes it from the whole job ledger and stores it in the
`job_settled` receipt as `frame` — `settle_job` stores the receipt whole, so
there is no migration — and `readClosingFrameEventData` (in `ledger.ts`) reads
it back for the wrap-up card and for `features/campaign/previously.ts`, which
decides when Life opens on it ("Previously": the newest job only, until the
player acts or puts it away). A quiet job has no frame; a hidden clock is never
named; nothing in it counts down or asks the player to come back.

The Screamsheet is what the city prints about what the character did, and it is
DERIVED, never stored, the way Reputation is. `engine/screamsheet.ts` turns
`place_changed` rows (a flag a place GAINED) and `job_settled` receipts (what a job
left behind, and a Reputation Level earned from Level 3) into headlines, picking
a wording from `src/data/atlas/screamsheet.json` (`houseRule: true`) by a hash of
the row so it reads the same every time. Four rules hold it, and tests hold the
rules: it says nothing the engine did not record (atmosphere may colour a fact,
never add one — no digit, quotation or money in any template); the character is
named only when the engine says somebody said the name (`named`) or from
Reputation 5 (the first rung of the printed ladder that says "your name"), and a `clean` job prints nothing; no dial is ever shown, only a flag
that was set; an empty sheet says so. Every flag the engine can set must have a
headline or an explained reason it has none. Reading it back needed two ledger
changes and no migration: `place_changed` rows carry the in-world `day`
(`placeChangedEventData`) and the `job_settled` receipt carries `day`, `missionId`
and `placeKey` (`readJobSettledMeta`); a row written before them reads as undated,
or falls back to the job's `mission_started`. It surfaces as the Life dock tile
(`life/ScreamsheetSheet.tsx`, with a per-browser unread count in
`status/sheetSeen.ts`), as a receipt when a turn sets a headline off
(`status/receipts.ts`), and as Aftermath's cutting (`previously.ts`
`clippingsFor`, guarded like the closing frame so it is never the previous job's).
It reaches the model NOT AT ALL: no packet line, no prompt. Letting an NPC say
"saw the Sheet?" is the obvious next step and needs `bun run eval`.

The Rap Sheet is `features/rapsheet/`: `rapSheetModel.ts` is the card's content
(pure; every field read off the saved sheet, the Lifepath, the cast, and when
there is a campaign its record), `rapSheetCanvas.ts` draws it by hand on a canvas
(no image-rendering dependency — every string is fitted to its box with the font
actually in use, so nothing can leave the card), `rapSheetAssets.ts` loads the
pictures, and `RapSheetButton.tsx` is the dialog. Two rules matter. The canvas must
never be tainted: the portrait arrives as BYTES (`downloadPortrait`, through the
backend adapter) and the cast's faces are same-origin. And a card is made to be
posted, so the sheet carries no id of the character or the account: the portrait's
storage path (which holds the account id) stays on the `RapSheetSource` and goes
only to the one place that fetches the picture, and a test refuses an id anywhere
in the sheet. The file number is a hash dressed as a case number and means nothing.

What a shared link looks like is `lib/siteMeta.ts`: one `pageMeta` builds the
Open Graph and Twitter tags, with an absolute image URL because a crawler cannot
resolve a relative one. `SITE_URL` is the published origin; a route that wants
its own title uses `pageMeta` too.

The people are a system too. `cast.ts` holds who the standing six are and what
each is carrying, releasing a dossier one rung at a time; `socialRead.ts` says
which Skill can reach which rung and what having asked costs, so the nine
printed Social Skills are nine Skills rather than one. Its data is
`src/data/cast/social-reads.json`, flagged `houseRule: true`, and the axis it
adds — suspicion — is spent on information and never on dice, the same ruling
the city layer runs on. Which of the six can BE the enemy or the lost love
a character's Lifepath rolled is `src/data/cast/lifepath-fit.json`
(`houseRule: true`): each bio fixes who somebody is, so a rolled Corporate exec
is drawn from the enemies whose bio is corporate, and a lover the Lifepath says
is dead or gone is never quoted as a living old flame's history. A new name in
a pool may need a row there; `anyCharacter.test.ts` sweeps every Lifepath roll
and every district through the cast. `arcs.ts` gives each of the six a story of their own,
from `src/data/cast/arcs.json` (`houseRule: true`): three stages of world-tick
moves whose ending forks on whether the player got involved. Its state lives on
the person's row (`campaign_npcs.data.arc`), a beat takes the world tick's one
move for its day, and a stage's `reveal` is never sent to the model — it
reaches the player only through involvement, beside their dossier facts.

Goodwill can be spent. `engine/favours.ts` (data `src/data/atlas/favours.json`,
`houseRule: true`) lets a place that has set `welcome` do one favour a day for
whoever is standing in it: a day of rest's healing in two hours, or two segments
off the NCPD heat clock. Three rules hold it. It buys time, access and a hand and
NEVER a die, a DV, a price or an outcome. It moves only what the engine already
moves, through the function that already moves it (`planRest`,
`applyObservations`). And it never turns a place against you: a favour is asked
only when it would leave a segment of goodwill. `favourOffers`
(`features/campaign/favours.ts`) is the one question — what is on offer where the
character stands — asked by `life/FavoursSheet.tsx` (a dock tile that renders
nothing unless a place has taken to you) and again, on fresh rows, by
`callInFavour`, which writes benefit, then goodwill, then time, then the
`favour_called` receipt, in that order so a failure is fair to the player. The
once-a-day rule is read back from that receipt (`favourCalledOn`, in
`ledger.ts`), never kept on the page. The dial stays hidden: the sheet speaks in
words. A new favour is a row in the data file and, if it needs a new kind of
effect, a case in both `favoursAt` and `callInFavour`.

Shops are places. `engine/vendors.ts` keeps four archetypes (street, gun shop,
armorer, fixer) that decide what is sold and how; `src/data/atlas/place-shops.json`
(`houseRule: true`) says which atlas places sell, as which archetype, under what name
and in what voice. A seller at a place has the id `archetype@place`, which is what the
ledger and a regular's flag store, so being known at one gun shop does not carry to
another. The sheet offers only the sellers where the character stands (`shopsAt`), plus
the fixer, who is a phone call and works anywhere; away from a shop it lists the nearest
(`nearestShops`, priced by `travelMinutes`) and travels the way the map does. `purchase`
refuses a place seller the character is not standing at, because a stale page should not
be able to shop from the street. A visit at a place costs `visitMinutes`; the trip was
paid when they travelled.

What is on a shelf is DERIVED, never stored and never rolled at the till:
`engine/shopStock.ts` reads it from the campaign seed, the seller and the stock week,
minus that week's `purchase` events (which carry the `day`, through
`purchaseEventData`). Staples are always there; a shop's `signature` is always in, a few
a week; everything else unusual is the printed stock die, seeded once per item per
week; its `backRoom` is left off the shelf entirely until the place has the `welcome`
flag. `shopShelf` (`features/campaign/shopping.ts`) is the one question the sheet and
`purchase` both ask, so they cannot disagree, and `shop_seen` events give "new since
your last visit". Never roll stock with an unseeded die: pressing Buy again must not
change the answer. The plan this is the first pass of is `docs/shopping-discovery.md`.

Strange gear is `engine/gadgets.ts` (data `src/data/rules/gadgets.json`, `houseRule: true`):
a find is one base object, one capability and at most one limit, and its identity IS its
item id (`gadget.<base>.<capability>.<limit>.<variant>`), so name, price, contract and quirk
are derived from the id and nothing is stored or migrated. `getGear` reads a find as a gear
line, so naming, pricing and describing carried gear needs no special case; `readGadget`
refuses any id the data does not allow, and an unreadable id is never handed powers. A
capability is a rule, not prose: `quiet` removes `loud`, `remote` removes `seen`, `quick`
halves a Life turn's time, `conspicuous` adds `seen`, a temperamental find rolls a d6.
`gadgetTurn` (`features/campaign/itemUse.ts`) applies them in both loops BEFORE observations
are priced, and the narrator is told each carried find's contract, capped by
`PACKET_BUDGET.gadgets`. A new capability must name an engine lever it moves; one that
would grant a die, a DV or an outcome does not belong. The gear list's printed bonuses (a
Medscanner's +2 First Aid) are `engine/kitBonuses.ts` over `kit-bonuses.json`, and ride in
`checkSetup`, so the odds chip and the roll carry them alike.

The city stocks the shops (`engine/shopSupply.ts`, data `src/data/atlas/shop-supply.json`,
`houseRule: true`). A place that gained a salvage flag (`place_changed`) and a job that
settled at a place (`job_settled`, whose receipt's `standing` lines say who it crossed,
read by `readJobSettledFactions`) each send things onto the street for a window: the shops
in that district, and every fence (a shop with `finds`) anywhere, lean their finds die and
lend the finds where they came from, as a sixth id segment (`s-<place>-<flag>`,
`h-<place>-<faction>`) that `readProvenance` checks against the atlas and the factions
every read. A find off a job that crossed somebody is HOT: a step down the ladder, and
buying it records `seen` against them. Selling is `sell` (`features/campaign/shopping.ts`)
at `sellPrice`: half the printed price, less markup, for kinds the seller deals in plus
any find at a fence; ammunition and chrome are not bought back. A sold find stays on that
shelf for `RESALE_WEEKS` (`resoldAt`, read off `sold` and `purchase` rows in ledger order).

The map is stocked to match. `places.houserule.json` carries fifteen clinics and ten shops
the atlas does not print (a third set, after the Exec Zone's and the bars), tagged in
`tools/atlas/tag_places.py`'s `HOUSE_RULE_TAGS` and each with a dossier in
`placeDossiers.ts` and a picture (an entry still waiting for one is named in `placeDossiers.test.ts`; today the list is empty).
`placeCoverage.test.ts` holds the shape, not the places: every district has a seller and
ripperdoc ground, every area has a gun counter, each of our places stands inside its own
district, and a district whose only ripperdoc ground is a hospital must name it as one that
takes a walk-in. Coordinates were found by searching `districtAtPoint` near a thematic
anchor, never typed by eye. The next pass is personality: stock, prices, owners and quirks.

Chrome is put in at a place too. Your ripperdoc is still the one cast member, but they
work out of their haunts (`hauntsFor`, via `ripperdocPractice` in `lifeModel.ts`, so the
clinic the sheet names is the one the map pin shows), and `atPractice` holds the install
to a character standing in one: the sheet lets you browse and quotes from anywhere, then
sends you there (`practicePlaces`, priced by `travelMinutes`) and `prepareRipperdocInstall`
refuses when asked from elsewhere. An empty practice never locks anybody out. Other
clinics run by strangers would need a migration, because `install_cyberware` requires the
campaign's own ripperdoc row, and are not built.

The city is a system in the engine, not a setting in the prose. `geography.ts`
is the atlas as the publisher printed it and invents nothing; beside it,
`places.ts` (tags, district profiles, arenas), `placeBeats.ts` (what a location
can put in front of you), `placeActions.ts` (what there is to do there,
and the ways of LOOKING at it — an approach carries a Skill and no DV, because
what is there to find is the engine's to say),
`placeSignals.ts` (what a map pin may say), `placeState.ts` (what a place has
become), `placeIntel.ts` (what knowing it buys you, whether by
visiting or by being a local), `truth.ts` (what is true here and not apparent
from standing in it — for a location, and for the concealed half of a mission
beat, which is held in `Beat.truths` rather than in the beat's `gmBrief`
because the brief reaches the model and the player's character has not found it
yet; a truth may also `need` other truths, which is what Deduction runs on, and
what makes a conclusion unreachable rather than merely hard until the pieces
are in hand) and `haunts.ts` (where the
cast are) are the house rules made of it. Their data lives beside the
atlas in `places.gameplay.json`, `place-beats.json`, `place-actions.json`,
`place-state.json`, `place-intel.json` and `place-truths.json`, each flagged
`houseRule: true`. `night-city.json` itself is
never edited, and `places.gameplay.json` is regenerated by
`tools/atlas/tag_places.py` — including the tags of the house-rule places,
which live in its `HOUSE_RULE_TAGS` table. Add a house-rule place's tags there,
not in the JSON, or the next run will drop them. Re-running it should leave
`git diff` empty.

### Feature layer

- `src/features/chargen/` owns the character-creation wizard, Zustand state,
  validation orchestration, draft syncing, character-sheet presentation, and
  save-payload assembly.
- `src/features/roster/` owns saved-character lists, sheets, duplication, and
  edit-as-new-draft behavior.
- `src/features/play/` owns campaign loading and the player-facing turn loop.
  `playOps.ts` is what a turn DOES — load, ask the model, validate, resolve in
  the engine, sequence the writes — and `usePlay.ts` is the thin half that binds
  it to TanStack Query.
- `src/features/play/combatOps.ts` owns shared combat loading, board actions,
  turn handover and death-save persistence. It accepts `CombatBundle`, which
  requires no mission or narrator. `playOps.ts` handles the Job-specific
  consequence of death; active encounters can overlay Life/Hook without changing their phase.
- `src/features/life/` owns the Life phase: its screen, its own system prompt and
  response schema, the situation funnel, and the shop, ripperdoc and record
  sheets. Life's schema deliberately cannot express a job transition. Split the
  same way as play: `lifeOps.ts` is the turn, `useLife.ts` binds it to React.
- `src/features/gm/` owns the AI GM prompt, context, response schema, and model
  call for Jobs. Life and Job run from separate prompts on purpose.
- `src/features/narration/` owns the prompt text those two prompts SHARE.
  Separate prompts is the design; five sections of the same rule written twice,
  no two copies saying the same thing, was the accident. Life told the narrator
  to state "a distance in metres... a price" among its concrete specifics while
  the house style says a number is never the narrator's, and Life carried the
  observation vocabulary with none of its definitions. `narratorRules.ts` holds
  a rule that is genuinely the same in both modes, once. A rule that differs
  stays in that mode's own prompt — the goal is that a shared rule cannot be
  edited in one place and not the other, never that the two prompts converge.
  It also holds the ENFORCEMENT of the rules it states, where one exists:
  `snapDv` puts a proposed difficulty back on the printed ladder, and both
  normalizers call it. Life snapped and the Job loop did not, so a Job turn
  could run at DV 12 or 19 — a difficulty nobody published, set by the
  narrator. A prompt that states a rule and a normalizer that does not enforce
  it are the same drift in a different place.
  Most rules cannot be enforced that way: nothing can stop a model writing "a
  bowl of noodles, 5eb", because prose is never handed to the engine.
  `narratorChecks.ts` holds the DETECTORS for those — pure functions over a
  finished turn that quote where it broke a rule. Every check traces to a line
  in `PRODUCT.md`'s "How to tell it is going wrong" or to a rule a prompt
  states in so many words; one that traces to neither is a taste argument and
  does not belong there. `evals/` runs them against a live model and
  `narratorChecks.test.ts` runs them against hand-written prose in CI.
  `packetBudget.ts` holds how much of each thing REACHES the model — every cap
  on the user packet, in one place. Nothing counted before it: no tokenizer, no
  `maxTokens`, and bounds that were ad-hoc `slice()` calls split between the
  two renderers and their callers, with the lists that grow in play (kit,
  people present, what a place has taught them, open objectives) not bounded at
  all. A new list the renderers iterate goes through `withinBudget` with a
  named cap here, not a bare slice. `packetBudget.test.ts` renders a
  deliberately extreme packet and asserts a ceiling with about four percent of
  slack; when it fails, either trim the addition or raise the number here on
  purpose, and never nudge it.
  The Life rail is a HUD, not a form (`life/hud/`): `CharacterCard` (portrait,
  bars that change colour as they empty, Luck as pips), `ResourceStrip` (money,
  growth and commitments as three chips whose detail opens in a popover) and an
  action dock of `DockTile`s that trigger the Within reach, Record, Home, Shop,
  Ripperdoc and Bench sheets. Within reach is `engine/goals.ts` on screen: the
  next rung of every Skill, the Rank, installable chrome and each faction's next
  band, priced by the engine, with up to three pins stored as a `goals_pinned`
  ledger event. The Growth chip follows the first pin. It is a price list, not
  a quest board — nothing on it is generated or offered, and people are kept
  off it on purpose. People are `PeopleStrip`: five faces with a disposition ring, the rest
  and the faction standings behind "All". `hudModel.ts` holds the bands, pips and
  who is worth a tile; they are a look, not a rule. Vitals flash and the
  balance counts when they change (`useChange.ts`), and stay still under reduced motion.
- `src/features/opening/` owns the cold open: the first screen of a campaign,
  written once by the model, whose four doors are the engine's. `descent/` is
  the ten seconds while it is written — the neon map's lights narrowed by the
  player's own facts, a fall into their window, a hold there for as long as the
  model needs, then a cut to the prose — and it has a score, synthesised in Web
  Audio (`descentSoundPlan` is what and when, `descentAudio` how; silent with the
  music off). The prose then arrives on the same window (`LandingBackdrop`,
  tinted for the hour), typed at reading pace, with doors that come on like
  signs. All of it is presentation only: no paid call, no rule, no write. The
  descent is a pure function of the time since "Enter Night City" was pressed
  (`descentClock`), so the screens that render it in turn never restart it, and
  the counter's numbers are theatre, which `cityLights.ts` says.
  The rain is canvas, not CSS: `rainModel.ts` is the storm as seeded numbers
  (depth layers, wind, lightning timed a beat before the score's thunder, drops
  and their trails) and `rain.ts` draws it, including beads on the glass that
  refract the bokeh canvas. `LandingBackdrop` runs the same storm under the prose.
- `src/features/music/` owns the soundtrack: the director (one shuffled playlist,
  a module that outlives any screen), `soundtrack.ts`/`trackTitles.ts` (three
  playlists told apart by file name — `music-…` is NIGHT SHIFT, the instrumental
  score and the default; `radio-…` is RADIO FREE NIGHT CITY, the songs with
  vocals; `quiet-…` is NO QUIET HOURS, an album with a running order (`order`) it
  is listed and, with shuffle off, played in — and every uploaded file needs a
  title and an entry in
  `docs/soundtrack.md`; the selection is a persisted pref, `setPlaylist`), and
  NCAmp, the player that views it. It is shared by the
  creator and the game and must stay free of anything only one of them knows.
  The game starts it ONCE, in `useGameMusic` on the `/play/:id` route, so moving
  between Life, a job and the cold open never restarts it; the player is mounted
  under `CampaignHeader` on a desktop and in `MobileStatusBar` on a phone, one of
  the two at a time (`useMinWidth`). Something that scores its own moment — a
  fight's track — calls `holdMusic`/`releaseMusic` rather than playing over it.
- `src/features/atlas/` owns the map modal, place dossiers, travel, and the
  components that render a place name as something you can open.
- `src/features/cast/` owns NPC directories and the bios the player has earned.
- `src/features/downtime/` owns the downtime panel and its operations.
- `src/features/items/` owns the item directory and inline item rendering.
- `src/features/landing/` owns the public landing page's presentation only.
  Its hero is weather over a painting: `HeroRain` draws the opening's storm
  (`opening/descent/rain.ts`, with its own intensity and lightning handed in)
  and `landingStorm.ts` decides, seeded, when the sky lights up and the runner's
  face with it. `HeroParallax` leans the art toward the pointer. Both draw
  nothing under reduced motion.
  `HeroDemoCard` is a scene from the game over the art: the Life screen's real
  `CharacterCard` with the Game Master typing beneath it, driven by `heroDemo.ts`,
  a pure looping script of invented lines and numbers. It is decoration, with no
  account, write or model call behind it. It is hidden for now
  (`SHOW_HERO_DEMO` in `routes/index.tsx`) while its look is reworked.
- `src/features/campaign/` maps pure engine campaign state to persisted rows and
  append-only ledger events.
- `src/features/dev/careerSim.ts` plays whole careers through the engine's own
  functions (payment, Reputation, work tiers, bills, I.P. prices) under stated
  playstyles, and is both a CI gate (`careerSim.test.ts` fails if a rule the game
  leans on breaks over a few hundred careers) and, through
  `bun run tools/pacing/soak.ts`, the pacing report. Its playstyles and cadences
  are assumptions it states out loud; it plays no combat and charges no kit, so
  its surpluses are upper bounds. It restates no rule — keep it that way, or it
  verifies a game that is not the one shipped.
- `src/features/dev/` holds developer tooling, currently the `/combat`
  battlefield harness. It contains no game logic: it seeds a fixture through the
  same calls the play loop makes and hands off to `/play/:id`, so what it
  exercises is the shipping code rather than a parallel one. Keep it that way —
  a harness with its own turn loop verifies a driver production never runs.

Prefer keeping rule decisions in the engine, persistence details in the backend
adapter, and feature modules focused on orchestration and presentation.

**`*Ops.ts` is what the game does; `use*.ts` is how React reaches it.**
`downtimeOps.ts` set the pattern and `playOps.ts` and `lifeOps.ts` follow it: an
operation belongs to the game rather than to the screen that calls it, and turn
logic living behind a hook can only be exercised through React — which is how
the two largest modules in the project came to have three tests between them.
An ops module must not import React or TanStack Query, and
`src/__tests__/boundaries.test.ts` holds them to it.

### Backend boundary

`src/lib/backend/` is the application's Supabase adapter. Application and feature
code must use its exported functions instead of importing the generated Supabase
client directly.

`src/integrations/supabase/` contains generated or infrastructure-owned clients,
auth middleware, and database types. Do not manually edit generated files unless
the generation workflow explicitly requires it. Regenerate database types after
schema changes.

The important transactional database boundaries are:

- `save_character(payload)`: saves a complete character and its child records,
  then clears its draft.
- `start_campaign(payload)`: snapshots a saved character into live campaign
  state.
- `start_encounter(payload)`: persists an engine-created encounter and its
  combatants.
- `save_encounter_state(payload)`: persists encounter combatants together with
  the player's HP, wound state, Death Save failures, equipped armor SP, and
  loaded ammunition in one transaction. Carries an optimistic-concurrency
  token: a caller sends the `version` it read and the transaction refuses a
  stale write with `encounter changed`. Omitting `version` writes unchecked, so
  a client running an older bundle keeps working. Callers must carry the
  returned version forward — `saveLiveEncounter` returns the encounter at its
  new version, and a sequence that saves more than once would otherwise refuse
  its own second write.
- `settle_job(payload)`: idempotently commits job closeout — payment, NPC
  promotion and disposition, faction standing, clocks, persistent situations,
  tallies, the `job_settled` receipt, and the transition to Aftermath.
- `close_aftermath(payload)`: clears the mission, refills Luck, appends the
  phase event, and moves the campaign back to Life together.
- `award_improvement_points(payload)`: commits one I.P. award — the
  `ip_awarded` event, a job's `ip_awarded` mark, and the character's total.
  An award covers everything since the previous one, job or life, so the
  caller sends the `seq` of the last award it judged from and the transaction
  refuses when that is no longer the newest.
- `install_cyberware(payload)`: commits one ripperdoc installation — payment,
  Humanity, the implants and their foundations, elapsed time, ripperdoc state,
  the ledger receipt, and passing on an active hook. Idempotent on the caller's
  request id, which is also the receipt event's id.
- `move_house(payload)`: commits one move or change of Lifestyle — the
  deposit, the campaign's `housing_id`/`lifestyle_id`/`home_place_key`, the
  clock, where the character stands, and the `moved_house` receipt. Refuses a
  plan priced against a campaign that has changed since (`campaign changed`).
  Idempotent on the caller's request id, which is also the receipt event's id.

These closeout functions apply a plan computed in TypeScript. They validate
ownership, phase, job identity, expected values, and ranges, but they must not
recompute game rules; RED mechanics stay in `src/engine/`.

`campaign_places` holds what has happened to a location in one campaign: dials,
flags, and visit counts. It is SPARSE on purpose — a campaign that has never
touched a place has no row, and the engine reads that place's authored starting
condition instead — so 156 locations never become 156 rows per campaign saying
nothing. Its migration is `20260904030000_campaign_places.sql`, applied to the deployed
project; a fresh database needs it before Life will load.

`campaign_events` is an append-only session ledger. Authenticated application
code may read and append events, but should not update or delete them.

## Frontend and routing

This is a TanStack Start application with file-based routes in `src/routes/`.
Follow `src/routes/README.md` and do not introduce Next.js, Remix, or `src/pages/`
conventions. `src/routeTree.gen.ts` is generated and must not be edited by hand.

Public routes:

- `/`
- `/login`
- `/style`
- `/scene-review` — static composition/targeting review; no auth data or campaign writes
- `/api/generate-portrait` (server HTTP route)

Routes under `src/routes/_authenticated/` require a Supabase user session:

- `/create`
- `/roster`
- `/character/:id`
- `/play/:id`
- `/combat` — the battlefield harness, a developer tool that writes to real
  campaign data. Deliberately unlinked from navigation; reaching it still
  requires a signed-in Supabase session, same as every other route under this
  layout.

The protected layout currently performs a client-side session check with SSR
disabled. Database authorization must still rely on RLS rather than the route
guard alone.

## Authentication and authorization

The implemented sign-in methods are email/password and Google OAuth. There is no
magic-link flow, despite the original scaffold prompt having called for one. A
password-reset adapter exists, but there is currently no reset-password route.

All application tables use row-level security. Parent records are scoped by
`auth.uid() = user_id`; child records are scoped through ownership helpers such
as `owns_character`, `owns_campaign`, and `owns_encounter`.

Any new server function or HTTP route that can consume paid AI resources or
access user data must perform server-side authentication. A browser route guard,
an attached bearer token, or CSRF protection is not by itself authorization.

There are two ways to do it, and which one you need depends on the shape of the
endpoint:

- A **server function** takes `.middleware([requireSupabaseAuth])`
  (`src/integrations/supabase/auth-middleware.ts`). The browser's token is
  attached for you by the global `attachSupabaseAuth`.
- An **HTTP route** under `src/routes/api/` gets a bare `Request` and never runs
  function middleware — nor the CSRF middleware in `src/start.ts`, which filters
  on `handlerType === "serverFn"`. It calls `requireUserId(request)`
  (`src/integrations/supabase/requestAuth.server.ts`) itself, and its client has
  to send the bearer token by hand (`getAccessToken()` from `src/lib/backend`).

`src/lib/__tests__/paidAiAuth.test.ts` enforces this: it finds every module that
reads `LOVABLE_API_KEY` and fails if one of them has no auth, so a fifth AI path
is covered the moment it reads the key. An endpoint that spends money should
also meter the caller — see `src/lib/rate-limit.server.ts`, and read its header
for what an in-memory limit does and does not promise.

A prompt is part of the contract, not part of the payload: the model's SYSTEM
prompt is chosen server-side from a closed list of jobs
(`src/lib/background.jobs.ts` names them, `background.prompts.ts` holds them).
An endpoint that accepts a caller-supplied system prompt is a general-purpose
model wearing the feature's name, and it also routes around
`src/lib/prose-style.ts`.

Never expose `LOVABLE_API_KEY` or a Supabase service-role key to browser code.
The service-role client bypasses RLS and is for trusted server-only operations.

## AI contract

AI functionality currently lives in three paths:

- Lifepath background, self-description and handle-suggestion generation
  through `src/lib/background.functions.ts`, each a named job on the closed
  list in `background.jobs.ts`.
- GM turns through `src/features/gm/gmTurn.server.ts`.
- Streaming portraits through `src/routes/api/generate-portrait.ts`.

The shared Lovable AI gateway provider is `src/lib/ai-gateway.server.ts`. The
server requires `LOVABLE_API_KEY`. The Job model is overridden with `GM_MODEL`
and the Life model with `LIFE_MODEL`, which falls back to `GM_MODEL` — Life read
`GM_MODEL` before it had an override of its own, so an existing setting keeps
steering both loops until somebody deliberately splits them.

Every narration turn records its own provenance in the ledger: which narrator,
at which prompt version, asked which model, and which model the gateway says
replied. Build it with `turnProvenanceData` and read it with
`readTurnProvenance` (`src/engine/ledger.ts`); the server functions supply it,
and `playOps.ts`/`lifeOps.ts` write it beside `walkOns`. The prompt versions
were dead exports before this — bumped about nineteen times between the two
prompts and read by nothing — which made "did that revision make the GM worse"
an unanswerable question rather than a hard one. A silently swapped model is the
same trap, so the served model is recorded next to the requested one.

The AI GM is a narrator and intent parser, never the mechanical authority:

- It may narrate, suggest actions, and propose structured checks or actions.
- It must not roll dice, decide check outcomes, calculate damage, change HP, or
  advance canonical state without deterministic validation.
- Normalize and validate model output before using it.
- Resolve all mechanical outcomes through `src/engine/` and persist the complete
  roll trace to the campaign ledger.
- Keep the GM context bounded to the active beat, relevant character state,
  objectives, NPCs, and recent events.

Generated player-facing prose should use the house voice from
`src/lib/prose-style.ts` rather than duplicating style instructions.

## Major domain concepts

- `ChargenState`: the autosaved in-progress character, including choices and
  audited rolls.
- `CharacterBuild`: the plain engine input assembled from wizard state.
- `AssembledCharacter`: the engine-derived, display-ready character sheet.
- `Loadout`: package choices, purchases, armor, cyberware foundations/options,
  and creation budgets.
- `FullCharacter`: a saved character with its stats, skills, ability, gear,
  cyberware, Lifepath, and finances.
- `Campaign` and `CampaignVitals`: a playthrough and its mutable live state.
- `Mission`, `Beat`, and `MissionRuntime`: the static mission graph and current
  deterministic position within it.
- `CampaignEvent`: one immutable narrative or mechanical ledger entry.
- `EncounterState`: deterministic combat order and combatant state.
- `PlaceState`: what a location has become in this campaign — dials, flags,
  visits. Absent means "at its authored starting condition", never "blank".
- `PlaceBeat`: an authored thing a location can put in front of the character,
  anchored to a venue or to a tag.
- `PlaceSignal`: what a pin on the map is allowed to say. Closed list, hard
  budget, every one tracing to a row.
- `CampaignCyberware`: the chrome the character is carrying _now_, in
  `campaign_cyberware`. Installation writes here; the saved character is
  historical and is never mutated by play. `start_campaign` snapshots the
  saved character's cyberware into it.

The current starter mission is `A Night at the Opera`, defined in
`src/engine/missions/nightAtTheOpera.ts` as a beat graph.

## Character creation and persistence

The creation sequence is the Meet, Role, Method, Lifepath, STATs, Skills,
Starting Gear or Cyberware, Gear & Armor, Lifestyle, Identity, and the File. Step
visibility depends on the creation method; use the helpers in
`src/features/chargen/steps.ts` instead of hardcoding the sequence. Method
follows Role on purpose, and changing it clears only what it makes — STATs,
Skills and gear — never the Role, the Lifepath, the name or the fixer.

Creation is told as an interview. The Meet deals three fixers from the draft's
cast plan (`fixerCandidates`), the player picks one, and that fixer asks each
step's question from `src/data/cast/fixer-interview.json` — written per fixer, in
their own voice, and held by a test to a line for every step and Role. The draft
carries the plan as `castPlan` (seed and picks); the save writes it into the
general Lifepath under `castPlan`, and `ensureCast` seeds the campaign's six from
it, so the fixer who interviewed the character and the people the File shows
are exactly the people the campaign meets. `meetToCampaign.test.ts` holds those
two paths together; keep it passing when either one changes. The Lifepath step
also lets the player choose their enemy, friend and lost love from
`castCandidates` — only people whose bio fits what was rolled — and
`generateCast` honours a pick only while it still fits, so editing the Lifepath
after choosing can never leave a contradiction on the file.

The file's portrait develops in three stages (`portraitStages.ts`, driven by
`useDevelopingPortrait`), each one generation from a capped budget of six: three
are the stages, the rest retry a failed stage once and develop the picture
again when who it is of changes (`portraitBasis`: Role, sex, age, how they look
and the seed — never gear). It never runs while the draft is loading and never
retries a failed stage more than once by itself. There is no portrait studio
and the Identity page draws nothing: the file's picture is the only one, and
`portraitStage` 3 on a saved character means "the picture on the file is final".
It is one clarity curve (`portraitClarity`) from the first picture to arriving at
the Identity step, where it is fully clear; a new picture dissolves in over the
last (`CharacterFile`), and `polaroidCrop.ts` holds how the near-square print
window crops a 2:3 portrait — anchored high, because the prompt composes the
head at the top.

Who a character is on sight — sex (male or female) and age — is asked with the
Lifepath's "Who you are" chapter and kept in `engine/identity.ts`, with its
limits and age bands in `data/rules/identity.json` (`houseRule: true`). Pronouns
follow from the sex chosen, so the draft still carries them. The save writes
`{ sex, age }` into the general Lifepath under `IDENTITY_KEY`, beside the cast
plan, so no migration is needed; `identityFrom` reads it back and the narrators
get one "Reads as" line (`appearsAsProp`), which is a band ("man, elderly") and
never the number: a stranger sees a face, not a birth certificate, and
`statesNoExactAge` holds the narrator to it. It moves no die: the shared
`APPEARANCE_RULE` colours a stranger's first assumption and says in so many
words that it never changes a DV, a price or an outcome.

The Complete Package point-buy cannot be overspent, even for a moment:
`adjustCompletePackageStat` (`engine/statGeneration.ts`) refuses any move below
the minimum, above the maximum, or past the budget, and the step has no typed
numbers at all. Every STAT opens at the floor so the pool is simply what is
left, and `normalizeCompletePackageStats` brings a draft saved under the old
free-typing controls inside the rules. The STAT cards and the four derived
numbers open house-voice briefings (`statFlavor.ts`, `derivedFlavor.ts`) whose
figures are read from `deriveStats` and `creation-rules.json`; the "edge" and
"weak spot" strip names every STAT in the top band or the bottom two
(`statHighlights`), and only once the points are spent, so ten sixes get neither.

Rolled STATs count: the first roll stands and each character carries the
rerolls `src/data/rules/chargen-house-rules.json` allows (`statRollCost`),
counted on the draft as `statRerollsUsed` and kept across a method change.

The Skills step leads with presets and odds rather than points. A preset
(`src/data/rules/skill-presets.json`, `houseRule: true`) names focus and support
Skills from the Role's printed twenty, and `presetEntries` builds an allocation
that spends the budget exactly and passes `validateSkillEntries` for both
methods — `skillPresets.test.ts` holds every preset of every Role to that. The
odds a player sees are `checkPercent` over their real STAT and Level against a
DV named in `src/features/chargen/skillTasks.ts`, never a number typed there.

Zustand owns the active wizard state. Supabase stores the newest draft as JSON,
with a two-second autosave debounce. Editing a saved character creates a new
draft and does not mutate the original character in place.

Step validation and the final save gate must share the validators in
`src/features/chargen/validation.ts`; do not create a separate, weaker save path.

## Campaign data flow

A normal player turn follows this path:

1. Load the campaign, character, mission runtime, and ordered event ledger.
2. Build a compact GM context from the current beat and relevant live state.
3. Ask the model for narration and structured proposed actions.
4. Normalize the response and validate proposed skills and published DVs.
5. Append narration and, when needed, a pending-check event.
6. Let the player roll; resolve it in the pure engine.
7. Append the full result trace and ask the GM to narrate that fixed result.

Mission movement must go through the engine's beat-graph helpers. Do not let the
model invent or directly persist arbitrary transitions.

## Database migrations

Migrations are forward-only. Do not rewrite migrations that may already be
published through Lovable. Add a corrective migration when a deployed schema
needs to change.

Before shipping schema work:

- Verify the complete migration sequence against a fresh local database, not
  only against the existing remote project.
- Check for duplicate object creation and drift between migrations and generated
  Supabase types.
- Regenerate `src/integrations/supabase/types.ts` from the resulting schema.
- Verify RLS and grants for every new table, function, and storage bucket.
- Create storage buckets in migrations or explicitly document the external
  provisioning step; policies alone do not create a bucket.

The existing repository needs special care here: campaign/encounter objects are
created more than once in the current migration history, and the generated types
match the later schema rather than all earlier migrations. Do not assume a clean
database reset works until this has been reconciled with the deployed migration
history.

`supabase/replay/` now measures exactly that rather than leaving it a warning.
`replay.sh` applies every migration to an empty Postgres over a small shim of
the Supabase surface they use, and today reports 37 applied and 9 failed. Five
are duplicate object creation; four are knock-on. Its README explains why the
duplicates exist — a hand-written migration and the Lovable console's own copy
of the same DDL, of which only one ever ran — and sets out the three ways to
reconcile it. Run it before adding schema work. It is deliberately not a CI gate
yet: the reconciliation is undecided, and a known-red check teaches people to
ignore checks.

This has already cost one silent outage. `encounter_combatants` is created twice
— with a `campaign_id` in `20260823024230` and without one in `20260823033846` —
and `save_encounter_state` filtered on that column from `20260830020000` until
`20260901120000`. Every encounter save raised `column "campaign_id" does not
exist`, so no fight persisted movement, damage, hostile turns or its own ending,
and nothing failed loudly: the engine is pure, the type checker never reads
inside a SQL string, and CI has no database.
`src/features/campaign/__tests__/encounterSchema.test.ts` now compares the
newest definition of that function against the generated row types. Extend it
when a transaction starts writing a new table rather than trusting the next one
to be luckier.

## Known implementation gaps

**The list lives in `ROADMAP.md` under "Standing debts"**, ordered and tagged by
severity. It used to be duplicated here in a different order with no severities,
which meant a reader could not tell what was urgent and a fix had two places to
be recorded — the second source of truth this project refuses everywhere else.

What stays here is the part that is guidance rather than a debt: the things a
contributor needs to know while editing the code next to one.

- **`campaign_npcs` has no `(campaign_id, npc_id)` uniqueness constraint.** Look
  a person up by key before writing them, and never create one from a key the
  model supplied — `playOps.ts` and `lifeOps.ts` both ignore an unknown key
  rather than filing a row for it.
- **The ledger is auditable, not tamper-proof.** An authenticated user can
  insert arbitrary event types into a campaign they own. It is a record, not a
  boundary; do not build anti-cheat on it.
- **Ordinary play turns are not transactional.** Only encounter saves,
  `settle_job` and `close_aftermath` are. Sequence writes so a failure partway
  leaves something a later turn can read, and expect partial turns in the ledger.
- **Regenerate `src/integrations/supabase/types.ts` after schema work.** It has
  been hand-synchronised three times; `encounterSchema.test.ts` and
  `placeSchema.test.ts` guard two of those cases, which is a guard rather than a
  fix.
- **A migration is tested by `supabase/replay/`, and CI runs it.** `replay.sh`
  builds the schema from nothing — a small Supabase shim, then
  `baseline.sql` (the state the applied migrations actually produced), then
  every migration added after it. Run it before pushing schema work; a function
  or constraint naming a column that does not exist fails there rather than in
  production, which is the bug class that took encounter saves down. The
  baseline exists because the directory holds five pairs where the same DDL was
  written by hand and applied again through the Lovable console, only one of
  each ever running — read its README before touching the migration history.
- **A Role Ability has two halves and they live apart.** What it DOES is
  `engine/roleAbility.ts`, read from `roles.json`; what the Role reaches FOR is
  `engine/roleAffordance.ts`, read from the house-rule `role-affordances.json`.
  The second grants nothing and must not start: it reaches the narrator as a
  block of moves to think with, while the capability snapshot still refuses
  anything above the Rank. Role-gated place actions (`roleActions` in
  `place-actions.json`) are the same bargain — a real venue, an ordinary Skill,
  their own small budget beside the five.
- **Combat Role effects are recomputed, never persisted.** Combatant rows carry
  none, so `combatRoleEffects` is re-applied to the player on every load. Add a
  new one to `CombatantRoleEffects` AND to that helper, or it will work for one
  turn and then quietly stop. The "first this Round" marks (`lastHitRound`,
  `lastDamagedRound`) do persist, in the row's `data`.
- **A Tech's bench spends the clock, not just money.** `engine/fabrication.ts`
  is pure arithmetic over the Maker table; `features/campaign/fabricating.ts`
  writes, and it advances the campaign clock by the build's printed duration
  even on a failure. Anything that adds a new buildable kind adds it to
  `FABRICABLE_KINDS` and to `catalog.json`'s `_rules.repairSkills`. Invention
  Expertise is not missing by accident — it would need the narrator to set an
  item's rules and Price Category, which is the boundary this project exists to
  hold.
- **A travel mode can be a rule, not just a name.** `travelTrip` takes either
  one of the atlas's named modes or a `TravelModeRule` handed in whole, which is
  how a Nomad's own vehicle gets priced without `night-city.json` carrying an
  entry for every machine in the Family Motorpool. A character with none must be
  priced exactly as before — that is the property `vehicleTravel.test.ts` holds.
- **A published story is pressure the player aims.** `features/campaign/
publishing.ts` moves a faction's clock DOWN and their standing with it, and it
  is deliberately not routed through `applyObservations` — observations are
  things the city noticed about you and only ever cost you. A Media's evidence
  is counted from discovered truths, never from a number a player typed, because
  a consequence cannot hang off a dial the player can max.
- **The Role picker promises what the engine can keep.** `engine/roleOpening.ts`
  computes what a Role hands a character on day one by CALLING the same
  functions play runs on — the bench's real prices, the Fixer's real Reach, the
  Nomad's real motorpool. Adding a Role Ability means adding it there too, or
  the creator goes on selling the version that existed when somebody typed it.
  `role-affordances.json` now serves two audiences: `reach`/`options` are the
  narrator's, in the third person, and `player`/`answers` are the player's, in
  the second. They must not converge — a test holds them apart.
- **Home lives on the campaign, and only the home moves.** `campaignHome`
  (`features/campaign/home.ts`) reads the campaign's own columns once the
  character has moved and creation's plan until then, and `lifestyleRates`
  prices rent from it, so a campaign that never moved reads exactly as before.
  `character_finance.home_district_key` stays the district the character grew
  up in: Local Expert's "Your Home" and where the cast spend their evenings
  read it, because what you know about a neighbourhood and who you know there
  do not come with you in the van. `engine/home.ts` prices a move from the
  printed rents and the house-rule `moving-house.json` (deposit, hours, and
  which tagged buildings rent which kind of home).
- **Reputation is derived, never stored.** `engine/reputation.ts` reads it off
  every `job_settled` receipt on each Life load, and the work on offer
  (`job-tiers.json`) is enforced by which job seed `pickJobSeed` draws, never by
  editing a job. A new way to earn Reputation is a new row in
  `reputation-deeds.json` read from something the engine already recorded, not
  a number the narrator supplies.
  A rise is told, not diffed: Reputation and the tier move at settlement, where
  no Life turn sees them change, so `features/campaign/climbNews.ts` reads the
  latest `job_settled` against the ones before it (`climbFromLastJob`). Aftermath
  shows it, and `returnToLife` writes it once per job as a `milestone` event.
  Its two dice are the engine's too: the recognition roll is made once a turn
  before the packet and kept beside the narration, and a Facedown travels as an
  ordinary check card whose id is `facedown` (`FACEDOWN_CHECK_ID`) — which is
  not a Skill. Anything that reads `check_prompt` or `skill_check` events by
  Skill id must tolerate it, as `describePendingCheck` and `rollPendingCheck`
  do.
- **Ripperdoc pacing is a house rule** — 0/1/3 recovery days by install level,
  four surgery hours per physical implant, appointment delay by disposition.
  `catalog.json` labels it as one beside the RED-sourced values. Tune it there,
  not in code.
- **The location layer's pacing numbers are guesses.** `PLACE_OBSERVATION_EFFECTS`,
  the beat periods and the `place-state.json` thresholds have not been
  playtested. They live in data so they can be tuned from play.

Do not silently paper over any of it by moving mechanical authority into the LLM
or the UI.

## Package manager and verification

Bun is the package manager and `bun.lock` is the only lockfile; CI installs from
it frozen. Use Bun rather than npm so the lockfile stays in sync.

Common commands:

```sh
bun run dev
bun run build
bun run lint
bun run typecheck
bun run test
bun run test:watch
bun run format
bun run eval    # the narrator eval; costs money, never runs in CI
```

Before handing off a code change, run lint,
typecheck, tests, and a production build in proportion to the change. Do not use
formatting commands indiscriminately in a dirty worktree.

`bun run test:browser` runs the pages anybody can open (`/`, `/login`, `/style`,
`/scene-review`) in a real Chromium: no script error, nothing requested that is
missing, no sideways scroll at desktop and phone width, and an axe scan against
WCAG 2 A and AA (`e2e/`, `playwright.config.ts`). It needs `bunx playwright
install chromium` once, is not part of `bun run test`, and runs in CI only by
hand (`.github/workflows/browser.yml`) until it has been watched go green on the
runner. A known accessibility finding goes in `KNOWN_A11Y` in the spec as a debt,
never as a way to silence a new one. The signed-in game is not covered: it needs
a Supabase session.

The test suite is strongest around the pure engine. Changes to authentication,
database functions/RLS, migration replay, draft synchronization, AI endpoints,
or full user flows may require targeted integration or browser verification in
addition to unit tests.

A change that adds anything to the model's user packet should expect
`packetBudget.test.ts` to fail. The ceiling sits close to what the fixtures
render today, deliberately: they are deterministic, so any movement at all is a
real change to what gets sent on every turn.

**A prompt change is verified by `bun run eval`, not by `bun run test`.** The
eval calls a real model, so it needs a key and it costs money.
`LOVABLE_API_KEY` cannot be exported from Lovable Cloud, so outside Lovable it
runs on `OPENROUTER_API_KEY` or `GEMINI_API_KEY` against the same model;
`evals/README.md` explains what it checks and how to read a report.
It is deliberately not a CI gate — same reasoning as `supabase/replay/`, plus
it would spend money on every push — and it is kept out structurally rather
than by a runtime guard: `vitest.config.ts` includes `src/**` only, and the
eval lives in `evals/` and ends in `.eval.ts`. Run it after touching a system
prompt, a context renderer or a response normalizer. A single run is not a
verdict: pass `--repeat 3` and read the counts, because the finding worth
having is usually the check that trips one time in three.

Every run leaves `evals/results/<time>.json`, and `bun run eval:compare` sets
two side by side. It calls a change only when Fisher's exact test says chance is
an unlikely explanation, which needs five runs a side (the default): two runs of
the same prompt once disagreed 3/3 against 0/3, so "it moved" is not evidence.
A scene that must differ in one input, such as who is standing there, is a pair
in `evals/scenarios.ts` (`pairedChecks.ts`), not a single-turn check.

`bun run eval:replay` scores the turns players have actually had, for nothing:
it reads `campaign_events`, groups narration by the prompt version and model
stamped on it (`readTurnProvenance`), and runs the checks that need only the
prose. The ledger does not keep the packet a turn was written from, so that is
all it can run, and it says so. It reads other people's narration with either a
service-role key or one user's token; the key stays on the developer's machine.

A scene that only goes wrong over several turns is a session in `evals/sessions.ts`:
scripted player inputs, each reply fed into the next packet through play's own
`recentLifeLines`/`recentEventLines`, scored by the single-turn checks on every
turn plus `narration/sessionChecks.ts` for what needs more than one.

`bun run eval:judge` is the quality half the checks cannot measure: a model from
a different family than the narrator reads two narrations of one scene (pure
logic in `narration/judge.ts`, the call in `evals/judgeCall.ts`), each pair in
both orders so position bias shows as _inconsistent_ rather than as a win. It is
never a gate and never trusted uncalibrated: `label` writes a blind sample for a
person and `calibrate` scores the judge against them, and every report says
whether that has been done. Its reports live in `evals/results/judged/` so
`eval:compare` does not mistake one for a run.

## Repository hygiene

- Preserve unrelated working-tree changes and untracked assets; they belong to
  the user unless explicitly stated otherwise.
- Do not bulk-delete or reformat image and archive directories as cleanup.
- New artwork follows `docs/art-style.md`: the vignette wrapper for small
  gameplay illustrations, the backdrop wrapper for large images behind text,
  and the in-app portrait look for characters. When asking the user to
  generate an image, hand them a complete prompt built from the right wrapper,
  and add it to that file.
- New music follows `docs/soundtrack.md`: the Suno settings, and every track's
  prompt under the file name it is uploaded as.
- Never commit secrets or print environment-variable values in logs. Public
  Supabase keys are not service-role credentials, but environment files should
  still be handled cautiously.
- Keep commits on the Lovable-connected branch working and follow the history
  warning at the top of this file.

### Composition refinement (4D.4)

New non-reference interior/intersection/alley compositions use recipe v6. Seeds
1–3 keep the accepted v5 geometry; residential geometry stays v5. Frozen v1–v5
snapshots remain authoritative. Shared rendering uses opaque exterior cutaways,
open wide interior thresholds, and joined directional sedan sections; these never
change saved collision or damage semantics. New conference/packing groups retain
meeting/workbench fact bindings. See `docs/checkpoint-four-d4.md` for the deployed
visual acceptance gate and remaining limitations.

### Shared presentation registration (4D.5)

Procedural furniture and sedan sections use `interiorPropPoint` and real 0/90
rotations against the battlefield's projection. Never horizontally reflect these
textures or compress their whole canvas to depict destruction: both break saved
footprint registration. Wrecks are painted low inside the normal canvas. Exterior
cutaways and facade bays are presentation of existing solids; saved entrances own
all door markers. See `docs/checkpoint-four-d5.md` for verification limits.

### Shared presentation calibration (4D.6)

Use `sceneArtMetrics` for physical actor/prop height. Atlas states retain their
full cell and explicit `atlasPropRegistration` ground contact; do not independently
crop/stretch damage states. Composed scenes order actors, props and segmented
cutaway walls from saved footprints via `sceneryOrder`. Keep ground art below that
ordering and use opaque ink bounds for actor fading. Overview must fit projected
roof as well as ground extents. These are presentation rules, never a reason to
rewrite frozen collision, entrances or activity groups. See
`docs/checkpoint-four-d6.md` for live evidence and the remaining manual gate.

### Surface materials (first material pass)

Intersection-recipe scenes lay real tiling materials under the existing painting:
asphalt, sidewalk, and — on shop-style masses only — facade concrete, roof
membrane, rooftop painted metal and shutters on doors that were already drawn as
shutters. `surfaceMaterials.ts` projects a tile through the scene's own affine
transform, so one tile is a stated number of metres; add a surface by giving it a
key there, never by sizing a texture to a building. A material is laid first and
every edge, marking, trim and overlay paints over it; with no material a surface
paints exactly as before. The sources stay in `src/assets/creator/` and
`tools/art/materials.mjs` makes the 512px derivatives in `public/images/materials/`
— it fails on a bad seam or baked lighting, and the creator glob in
`chargen/art.ts` excludes the originals from the bundle. See
`docs/checkpoint-material-pass-1.md` for the scope, limits and next-asset
inventory.

### Intersection revision 7 and the storefront pack

Revision **v7** introduced one saved `lamp`
(cluster `shop_lamp`) beside the corner shop, placed by `addShopLamp` from the
final geometry so light has a world position to come from. Seeds 1–3 stay v5 and
snapshots already saved stay v6; `shopLamp.test.ts` holds that nothing else in a
scene moved. The storefront's art is specified in `courtyard/storefrontPack.ts`
(one set of numbers for the guides, the renderer and the validation of returned
images); the kanji sign is a mask rasterised by `tools/art/kanji-sign.mjs` and
drawn in code, never generated. See `docs/checkpoint-storefront-pack.md`.

### The storefront (courtyard/storefront.ts)

The corner shop's detail is painted by one routine over the saved structure, entrance, awning and lamp:
`paintStorefrontFace` is used for the whole building AND, clipped to each piece's height, for every cutaway
wall piece on that face, so revealing the street never changes the wall; the awning is its own sprite
(`activityLayer: "awning"`, shown in the cutaway only while the wall it hangs from is kept). Returned art is
validated and made by `tools/art/storefront-assets.ts`, judged by the numbers in `storefrontPack.ts`. See
`docs/checkpoint-storefront-corner.md` for the limits.

### Intersection night (courtyard/nightLighting.ts)

The intersection is lit as night; every other scene is unchanged (`nightFor`). Night is never a dark layer
over the frame: the ambient is a Phaser tint on the scene's own sprites (ground, buildings, props, people),
so grid, shot lines and labels keep their colour. Every storefront painter takes a `Pass`: `albedo` (the art),
`light` (light that falls on a surface; the renderer multiplies it by that surface's albedo, clips it to the
surface's pixels and applies `gain`) and `glow` (light a surface gives, added as is). `createComposedEnvironment`
turns the two light passes into an additive companion sprite stored as `getData("light")`, and the renderer
copies its parent's visibility, alpha and depth (+0.5) every frame. Never paint light into the albedo, and never
give a companion its own visibility or sort: that is how a light comes loose from its surface. People and props
take `tintFor(ambient, lightAt(...))` from the same `GroundLight` list the ground sprite is painted from, so a
person in a pool is lit by that pool; `lightAt` is zero inside a building footprint. Windows that face a
neighbouring building (`litBays` excludes them) stay dark. `/scene-review` takes `night=0` (neutral inspection
of the materials), `lights=0` (same night, local lights off), `cam=x,y,zoom` and `player=x,y` for repeatable
captures; `tools/scenes/storefront-night.mjs` takes them. See `docs/checkpoint-storefront-night.md`.

The streetlight's base is saved and never moves; which way its arm reaches is `lampArm`, judged from saved
geometry (the head over open ground, the lantern clear of every cover piece's screen silhouette), so a lantern
is never drawn on a parked car's bonnet. Every fixture that hangs on a building (the blade sign) is its own
sprite on that building's activity layer, sorted by its own footprint, and carries `fadeWith`: it can never be
more solid than the wall it hangs from, and it leaves with that wall in the cutaway. The night's material grade
(`paintNightGrade`) is a multiply layer over the ground that is visible only at night. Replacement prop art is
specified in `courtyard/streetPropPack.ts`, never mirrored, and cut at the sedan's section join by `sedanCut`;
see `docs/street-props-pack.md`. `tools/art/street-props.ts` validates and imports Picasso's images into
`public/images/street-props/` (one frame per saved section, at twice the board's frame), and `courtyard/streetPropArt.ts` swaps
them in under the procedural texture's own key, on intersection scenes only (gated like the materials), keeping
the procedural kit wherever a file is missing. Registration, sorting, fading and damage are the board's, unchanged.
A sedan's art is padded past its 2 m frame (`SEDAN_ART_PAD`), and the texture carries where the frame sits
(`propArtRegistration`, read by `paintCover`): never resize a frame to fit art. The importer refuses a seam between
the halves and a wreck taller than its `wreckVolume` (flat spill within `WRECK_APRON` is reported, not failed); a redraw is
saved as `<name>-v2.png` beside the original and the importer takes the newest; see `docs/street-props-pack.md` §4 and §7.

### The architectural pilot (courtyard/frontage.ts)

The storefront's block (`frontageBlock`: the shop and the `shop` masses flush against it) and the street are
detailed as built things, on intersection scenes with materials only. The rules:

- **The shop and its neighbours.** The shop keeps the warm, lit focal face. Its neighbours get a restrained identity:
  dark render, a metal-capped parapet, high barred windows and a louvre. No door is ever painted where no entrance is
  saved.
- **Roofs and drainage.** Every block roof is a parapet with a coping. Each roof drains by one downpipe on a solid pier
  of an open face (`downpipes`, clear of every opening).
- **Kerbs.** Every pavement edge meeting a carriageway is a run of kerb stones (`kerbRuns`). Its face shows only where
  the road lies toward the camera, and it drops flush with tactile paving at crossings.
- **Materials.** A neighbour lays `roof-ballast` on its roof and `painted-render` on its walls, cutaway pieces included;
  the shop never does.
- **Wear.** Grime and wear go where use puts it: wall feet, pipe shoes, the shop door, the vendor's stall. Never as an
  all-over noise layer.
- **Presentation only.** Nothing here adds collision, moves a wall, entrance or route, or changes sorting.
- **The handover.** `frontagePilot` (`composedEnvironment.ts`) is the one place the walls, roofs and ground learn the
  block. `tools/scenes/corner-plan.ts` draws the saved plan over a capture. See
  `docs/checkpoint-architecture-pilot.md` and `docs/architecture-pack.md`.

### The architectural art pilot (courtyard/architectureArt.ts)

Three painted assets, imported by `tools/art/architecture-pilot.ts` against the numbers in
`courtyard/architecturePack.ts`, on intersection scenes only:

- **The rooftop unit** replaces every rooftop box, the storefront's included. On the storefront the
  streetlight's pool is laid by `paintRoofUnitLight`: on the roof less the units, and on each unit at its lid,
  masked by the painted art itself.
- **The window** goes on every `shop` face but the storefront's own (its lit interior) and its neighbours'
  (barred), where the bay is the 2.2 × 1.7 m it was painted for (`shopFace`, `annexArtFits`). Residential and
  industrial openings never take it. A row is varied by `windowVariant` (panes swapped, the painted blind let
  down further), chosen by `variantOf` from the bay alone; nothing is mirrored.
- **The roller shutter** goes on the annex only (`isAnnex`: the shop whose saved entrance has an entry
  surround). Shops outside the storefront's block get the finished wall (`paintShopWall`: plinth, piers,
  grime) and the shop's coping.

The rules:

- **A sprite is placed by registration.** The unit is drawn into its roof's sprite by `roofUnitTransform`,
  which maps the frame's 2 m footprint onto the saved one.
- **An elevation is mapped onto its wall plane.** The window and the shutter are mapped by the projection;
  code owns the recess, the sill, the housing's depth and every shadow.
- **The shutter is drawn as the surround.** Where the shutter is painted, the saved entry surround over that
  door is drawn as the shutter; the attachment is not changed.
- **Cutaway pieces carry their face's openings,** clipped to the piece (`paintFacadeArt` with `clip`).
- **A missing file is the old drawing,** never a failure.
- **Painted art is prefiltered before it is drawn small** (`sourceFor`: repeated halvings, cached). One
  `drawImage` at 8-13x reduction bakes aliasing into the building's texture (the shutter's ripple was this).
  Draw art through `drawOnto` or `sourceFor`, never with a bare `drawImage` from the full file.
- **Returned art that is off its guide is corrected in the importer, by registration, never by loosening a
  check.** Say so in its report. The window was registered by its frame bands and its room cropped, not
  squeezed.

See `docs/checkpoint-architecture-art-pilot.md` and `docs/checkpoint-corner-finish.md`.

### The tactical overlay (play/actorMarkers.ts, play/overlayModel.ts)

The combat board's SVG is in scene units (its `viewBox` follows the camera), so anything drawn in it scales
with the zoom. The rules:

- **Words, bars and markers are drawn in screen pixels.** `ActorMarker` uses `scale(ui)`, where `ui` is one
  screen pixel measured from the board's real size. Lines use `vector-effect: non-scaling-stroke`. Never put a
  label in scene units: it was 36 px at play zoom and 5 px on a phone.
- **A marker says as much as the person's part calls for.**
  - `markerFor` decides it: the locked target and anyone hovered, focused or aimed at get the name and HP.
  - You get a caret, threats a diamond, allies a disc. Bystanders get nothing at rest.
  - Faction is carried by shape as well as colour.
- **`layoutMarkers`** keeps markers on screen, off the controls, off each other and off fixed labels such as
  "IN THE WAY".
- **The movement overlay follows the interaction** (`overlayMode`): an edge at rest, squares and a route while
  planning, firing squares while aiming, only the edge while a target is the point. The edge is
  `squaresOutline` of the engine's move field, never a drawn shape.
- **The cutaway footprint** is a cut solid (`paintCutawayFloor`), never a dark floor that reads as a room.

- **The board's outline** (`boardOutline`) is left out wherever it would cross a building or run behind one. A
  building cut away for the reveal hides only its own footprint. An overlay line is never printed across a
  building.
- **The information card** (`calloutPlacement.ts`) is placed in this order:
  - above the person or square;
  - else under the feet;
  - else beside them.

  It never covers the camera buttons. It covers a person, a name or the caption only when every place would.
  On touch it carries a dismiss button (one level back, like Escape).

See `docs/checkpoint-presentation.md` and `docs/checkpoint-building-pilot.md`.

### Homes and sheds (courtyard/buildingFaces.ts)

On intersection scenes with materials, the `residential` block and the `workshop`/`warehouse` sheds are finished
in code with the existing pack. The rules:

- **Materials.** Homes take `painted-render`, sheds `painted-metal`; their cutaway pieces take the same.
- **Openings.** Every opening is the one the generic face drew, at the same place and size (`faceOpenings`).
  - A shed's clerestory pane is dropped only where it ran into a ground-floor light or a loading door. Those
    always overlapped.
- **Homes.**
  - A window has a reveal, a frame, a stone sill and somebody behind it: a blind, curtains, nets, a lamp or
    nothing.
  - Who is behind it is chosen from the window alone.
  - Never the shop's stocked interior. A ground-floor bay is never dark.
- **Sheds.**
  - Glazing is steel-framed wired glass in divided lights.
  - The walls are sheets with a plinth and a fascia.
  - A loading door is a roller shutter in steel guides. The saved `service-surround` is drawn as those guides
    and the coil box, with no new geometry.
- **Presentation only.** Nothing here adds collision, moves a wall, entrance or route, or changes sorting.
  Without a material tile it is the old drawing.

### The ground (courtyard/groundFinish.ts, courtyard/contactShade.ts)

On intersection scenes with materials, the street's surfaces are finished and objects are grounded. The rules:

- **Surfaces are the existing materials at world scale.**
  - Unclaimed ground is concrete hard standing.
  - Entrance pads are threshold slabs.
  - The `entry` floor is paving and a loading court is asphalt.
  - Laid paving draws no zone outlines: the kerbs bound the road.
- **Wear goes where use puts it, by `hash` of a world position.** Slabs, gully silt, wheel-track paint wear, oil
  under engines, wall feet and threshold scuffs. Never an even layer. Never on a tactical overlay.
- **Contact shade is made from each prop's own picture** (`contactAlpha`), per condition.
  - A wreck's is the wreck's, and nothing high above the ground casts one.
  - It is its own sprite at ground depth (`CONTACT_DEPTH`), registered as the prop, never sorted, faded or
    tinted with it.
  - On the intersection the kit bakes no footprint shadow (`createPropTextures(..., false)`). Other
    environments keep theirs.
- **A canvas texture must be refreshed** (`addCanvas(...).refresh()`) or it never reaches the GPU.
- **Presentation only.** Nothing here moves a prop, a wall, an entrance or a route.

See `docs/checkpoint-ground-pass.md`, including the manual `/play` checklist.

## Collaborator names

Levi uses these names across sessions:

- **Brutus**: the cheaper coding LLM/agent. Handles implementation, asset guides,
  image processing, integration, tests, browser verification and pull requests.
- **Picasso** (also spelled **Picaso**): the image-generation LLM. Creates textures
  and game-art assets from supplied prompts, geometric guides and style references.

These are workflow nicknames, not fixed model versions or repository features.
Levi passes guides/prompts from Brutus to Picasso and returns generated assets to
Brutus for integration; higher-cost model time is reserved mainly for planning,
visual critique and difficult technical decisions.

### Light on surfaces (courtyard/wallLight.ts)

At night on the intersection, every light that pools on the ground also reaches the walls in front of it. The rules:

- **A light is a point at its fixture's height** (`pointLights`). The point comes from the same saved fixtures as
  the ground's pools. Never add a light without a visible source.
- **A wall is lit only from in front,** within reach, and only when no building stands between the light and the
  wall (`lightOnFace`). Roofs are never lit this way.
- **Washes go into a surface's light pass,** so they are multiplied by its albedo. Cutaway pieces take the same
  wash, clipped to their own stretch and height (`paintWallLights` with `clip`).
- **A lit window lights its sill and the wall round it** (`paintWindowSurround`).
- **The secondary source is a few occupied homes** (`litHomeWindows`, `LIT_HOMES`): at most three upper windows per
  block, chosen from the window alone. They light no pavement. The shop stays the focal point.
- **A light sprite is cropped to its own lit pixels,** not its surface's frame. A full-size additive sprite per lit
  block cost about 4% of frames under software GL.
- **Puddles were tried and omitted** (`docs/checkpoint-atmosphere.md` §4). Placed where water collects, they were
  nowhere near where the lights' reflections land, and a 5 px reflection read as a dotted line. The shop corner's
  reflection pilot is `groundReflection.ts` (below), off by default.

### Commercial streetfront (courtyard/streetfront.ts)

On intersection scenes with materials, the shop's other elevations and its neighbours' frontage are composed from
saved geometry. The rules:

- **The shop's other faces** (`shopReturns`).
  - A camera-facing face of the canopy's building, other than the canopy's own, that meets the shopfront at a
    corner, with no door and at least two visible bays.
  - It is drawn as a concrete ground storey, a string course and a rendered fascia band.
  - The bays nearest the corner are display windows with the shopfront's interior, under the shop's name.
  - The rest stay storeroom windows; on a long face, the one furthest from the shop has its grille down.
  - One kitchen extract stands on a pier, clear of every bay and downpipe.
  - It paints in two layers: `wall` first, `fittings` after the storeroom art. `paintFacadeArt`'s `skip` leaves out
    the composed bays.
- **The neighbours** (`neighbourFronts`).
  - The barred windows and louvre stay.
  - Every exposed face gains a course and metal cladding above the window heads.
  - One painted board per block, on the shopfront's street line, at the end nearest the shop, lit by two goosenecks
    whose light stays on the board.
- **Lettering is a font mask** from `tools/art/kanji-sign.mjs` (`--text`, `--out`, `--stroke`), never generated.
  A mask is prefiltered (halved twice) before it is drawn small.
- **Every opening is a saved bay at its saved size.** Nothing here adds a door, collision, route or entrance.
- **Cutaway pieces carry the composition,** clipped to their height. See `docs/checkpoint-streetfront.md`.
- **A piece's light and glow are clipped to that piece** (`paintReturnLight`'s `clip`). The renderer masks only the
  light pass to the albedo; the glow is added after it, so an unclipped glow lights glass the reveal removed. See
  `docs/checkpoint-cutaway-light.md`.

### Sedan paint and round two's props (courtyard/sedanPaint.ts, streetPropArt.ts)

- **The street sedan comes in three paints** made from its own art: beige (the art), burgundy and a gunmetal
  charcoal.
  - `bodyPaintMask` takes the beige by hue, and by chroma for its lightness.
  - `repaint` recolours inside it at each pixel's own luminance.
  - `tools/art/sedan-paint.ts` bakes `<file>-<paint>.webp`.
- **Wrecks keep their art.** They are burned bare.
- **The texture key is `paintedTexture(key, paint)`** (`key~paint`), and a missing file falls back to the art.
- **The paint is chosen by `sedanPaints`** from the saved layout (cluster ids plus `parkedAt`), never at
  random. Both sections of a car share it.
- **Never tint a whole sprite** to make a variant.
- **The merchandise stand (`shop-display`) and the cabinet at r90 are round two** (`STREET_PROP_PACK_2`,
  `KIOSK`; `docs/street-props-pack/round-2.md`). `tools/art/street-props.ts --round 2` imports them, and every
  kind but the planter has its own file per rotation (`own90`). No wreck is waived: the r0 stand's `-v2` redraw
  passes its volume. See `docs/checkpoint-prop-round-two.md`.

### Lamp shadows (courtyard/lampShadow.ts)

At night on the intersection with materials, each prop near a light takes that light's share off the ground behind
it. The rules:

- **A light is a point at its fixture's height** (the same heights `wallLight.ts` uses). A window is its bay at
  mid-height, from the point nearest the prop. A prop is its saved piece inset to its body, at a stated
  presentation height (`CASTER_HEIGHT`). Its wreck is a lower box. Add a prop kind there, or it casts nothing.
- **A shadow belongs to its light.** It removes that light only, never the ambient or another light, and never
  replaces the contact shade (`contactShade.ts`). Lights off, it is gone.
- **A destroyed prop casts its wreck's shadow, from the complete state** (`groundShadows.ts`).
  - Props whose shadows touch form a region (`shadowRegions`).
  - When a region's props change, its patch is rendered: the light pass in that state, less the light pass with
    all of them standing. Patches are cached by state.
  - Never compute a prop's light alone, as if the others stood: overlapping wrecks were left dark that way.
  - The pass's gain saturates, so never add halves.
  - Visibility follows `coverDestroyed` and the lights switch only, never a prop's fading.
- **Every light is painted on its own canvas,** over its own reach plus `BLUR_MARGIN`, starting on the `ALIGN`
  grid. A crop then paints exactly what the whole ground paints; Chrome's gradient dither is fixed to the pixel
  grid. `tools/scenes/shadow-state-check.mjs` holds the board to a fresh render of every state.
- **Shadow work is confined to small canvases.** A full ground-sized canvas per light or prop cost about 6.5 s of
  load under software GL.
- **A damp sheen was tried and omitted** (`docs/checkpoint-ground-light.md` §4). It was a blurred lobe of each
  light's colour at its mirror point, multiplied by the ground. It had no shape and no surface, and read as haze.
  The pilot that followed, at the shop corner only, is below and off by default.

See `docs/checkpoint-ground-light.md`.

### Ground reflections (courtyard/groundReflection.ts)

A pilot at the finished shop corner, **not visually accepted and off by default**: `REFLECTION_MODE_DEFAULT` is
`skip`, so nothing is built and `/play` pays nothing. `/scene-review?reflect=` takes `on`, `pictures`, `glints`,
`hidden` (built, not shown) and `skip`. See `docs/checkpoint-material-pilot.md` before touching it. The rules it
keeps:

- **A source is what a fixture emits, extracted once, before anything is stretched or summed.**
  - Paint only emitters: glow passes, a light pass clipped to the lit bays, the lamp's lens.
  - Never paint art under the ambient or a wash on a wall.
  - `emissive()` floors each source's own picture.
  - Never apply a floor after summing copies. Dim copies add up; that was PR 302's ghost-column bug.
  - `tools/scenes/reflection-source-check.mjs` holds a dim wall to zero at any stretch sample count.
- **Where it is wet is a deterministic mask** (`REFLECTION.wet`: world noise, wetter in the gutter), never the
  albedo's brightness.
  - Dry ground gives back almost nothing.
  - Highlights are a surface's proudest few grains, and only where wet.
- **Each layer has its own bounds and its own sprite.**
  - A fixture's layer shows and fades with that fixture's sprite.
  - The glints follow only the lights switch.
  - Layers are cached by the state of the props that touch them, and never rendered per frame.
- **The verdict so far.** At play zoom, wet patches lit by a shop light read as pale stains, and the pictures as
  isolated marks. Untested next steps: darkening wet ground where it does not reflect, and more street-level
  sources.
- **Measure before changing it.**
  - `tools/scenes/reflection-perf.mjs` measures construction, first render, first and repeated damage changes and
    retained memory, per mode (`--chrome` for real hardware).
  - `tools/scenes/material-pilot-evidence.mjs` takes the matched captures.
  - `REFLECT=on tools/scenes/shadow-state-check.mjs` checks damage switches with it shown.
- **Presentation only.** Nothing here moves a light, a prop, a wall, an entrance or a route.

### Finished shop material field (courtyard/shopFinish.ts)

The shopfront and its composed returns share a neutral plaster/ceramic field, with burgundy fascia
and a projecting lintel. `STOREFRONT_ART_FILES.wall` loads its 384 × 512 derivative; the original
`storefront-wall-finish.png` is excluded from the creator bundle. Regenerate with
`bun tools/art/shop-finish.ts`. Draw the field in **albedo only, before openings**, through the existing
cutaway clip, at `SHOP_FINISH`'s world dimensions. Missing art keeps the drawn risers. Cornice depth
is decorative and stays within the face clip apron. No saved dimensions or collisions are changed.
Storefront face/blade art and return-face crops must use `sourceFor` at their drawing size; direct
full-resolution mask reduction broke the sign into dots. See `docs/checkpoint-finished-corner.md`.

### Residential roofs

`courtyard/residentialRoof.ts` paints residential and recognised annex roofs inside
their original projected envelope, using existing membrane/concrete materials.
The deck is visually recessed; equipment remains at its original height on curbs.
Keep contact shadows on that deck and clipped to the roof. This finish belongs to
the building sprite and disappears with its roof on reveal; never add it to retained
wall pieces. Internal drains avoid existing equipment. No recipe or saved geometry
changes are involved. See `docs/checkpoint-residential-roofs.md`.

### Stepped commercial row (recipe v8)

New non-reference intersections now use v8: the corner shop is 7.2 m, its narrow
attached neighbour 10.2 m, and the rear shop row 7.8 m. No ground plan changes.
Seeds 1–3 stay v5; saved v6/v7 scenes retain their stored heights. Never regenerate
a snapshot to obtain the taller row. `commercialUpper.ts` draws upper rooms,
piers and courses from any saved tall shop envelope with existing residential
window artwork; full and revealed elevations share its clipped painter. Upper
windows add no emission or light sources. No new walkable floors are implied.
See `docs/checkpoint-urban-frontage.md` for browser evidence and limits.
