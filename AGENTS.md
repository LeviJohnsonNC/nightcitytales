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

The people are a system too. `cast.ts` holds who the standing six are and what
each is carrying, releasing a dossier one rung at a time; `socialRead.ts` says
which Skill can reach which rung and what having asked costs, so the nine
printed Social Skills are nine Skills rather than one. Its data is
`src/data/cast/social-reads.json`, flagged `houseRule: true`, and the axis it
adds — suspicion — is spent on information and never on dice, the same ruling
the city layer runs on.

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
`tools/atlas/tag_places.py`.

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
- `src/features/life/` owns the Life phase: its screen, its own system prompt and
  response schema, the situation funnel, and the shop, ripperdoc and record
  sheets. Life's schema deliberately cannot express a job transition. Split the
  same way as play: `lifeOps.ts` is the turn, `useLife.ts` binds it to React.
- `src/features/gm/` owns the AI GM prompt, context, response schema, and model
  call for Jobs. Life and Job run from separate prompts on purpose.
- `src/features/atlas/` owns the map modal, place dossiers, travel, and the
  components that render a place name as something you can open.
- `src/features/cast/` owns NPC directories and the bios the player has earned.
- `src/features/downtime/` owns the downtime panel and its operations.
- `src/features/items/` owns the item directory and inline item rendering.
- `src/features/landing/` owns the public landing page's presentation only.
- `src/features/campaign/` maps pure engine campaign state to persisted rows and
  append-only ledger events.
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
- `install_cyberware(payload)`: commits one ripperdoc installation — payment,
  Humanity, the implants and their foundations, elapsed time, ripperdoc state,
  the ledger receipt, and passing on an active hook. Idempotent on the caller's
  request id, which is also the receipt event's id.

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
- `/api/generate-portrait` (server HTTP route)

Routes under `src/routes/_authenticated/` require a Supabase user session:

- `/create`
- `/roster`
- `/character/:id`
- `/play/:id`
- `/combat` — the battlefield harness, a developer tool. Deliberately unlinked
  from navigation. Because it writes to real campaign data, it is gated by
  `src/features/dev/harnessEnabled.ts`: on in `bun run dev`, on in a preview
  that sets `VITE_COMBAT_HARNESS=1`, off in production. It is not gated on
  `import.meta.env.DEV` alone, because the preview is exactly where it is
  wanted and DEV is false there.

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

- Lifepath background and self-description generation through
  `src/lib/background.functions.ts`.
- GM turns through `src/features/gm/gmTurn.server.ts`.
- Streaming portraits through `src/routes/api/generate-portrait.ts`.

The shared Lovable AI gateway provider is `src/lib/ai-gateway.server.ts`. The
server requires `LOVABLE_API_KEY`; the GM model may be overridden with
`GM_MODEL`.

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

The creation sequence is Method, Role, Lifepath, STATs, Skills, Starting Gear or
Cyberware, Gear & Armor, Lifestyle, Identity, and Final Sheet. Step visibility
depends on the creation method; use the helpers in `src/features/chargen/steps.ts`
instead of hardcoding the sequence.

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
- **Run `supabase/replay/replay.sh` before adding schema work.** It applies every
  migration to an empty Postgres and currently reports 37 applied, 9 failed. Its
  README explains why and what the options are.
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
```

Before handing off a code change, run lint,
typecheck, tests, and a production build in proportion to the change. Do not use
formatting commands indiscriminately in a dirty worktree.

The test suite is strongest around the pure engine. Changes to authentication,
database functions/RLS, migration replay, draft synchronization, AI endpoints,
or full user flows may require targeted integration or browser verification in
addition to unit tests.

## Repository hygiene

- Preserve unrelated working-tree changes and untracked assets; they belong to
  the user unless explicitly stated otherwise.
- Do not bulk-delete or reformat image and archive directories as cleanup.
- Never commit secrets or print environment-variable values in logs. Public
  Supabase keys are not service-role credentials, but environment files should
  still be handled cautiously.
- Keep commits on the Lovable-connected branch working and follow the history
  warning at the top of this file.
