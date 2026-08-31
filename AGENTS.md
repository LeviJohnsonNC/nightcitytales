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
design request. Read it before making gameplay, UX, AI, or content decisions.
This file stays authoritative on architecture; `PRODUCT.md` is authoritative on
intent.

`ROADMAP.md` says what to build next and why, and records what the current
Known implementation gaps below are blocking. Update it when a milestone lands
or the ordering changes.

The top-level `README.md` describes the original scaffold and is not a reliable
description of the current product or route set.

## Architecture boundaries

### Rules engine

`src/engine/` is pure TypeScript. It must not import React, feature modules,
Supabase, or backend adapters. It takes plain objects and returns plain objects.

- All dice rolls and character/game arithmetic belong in the engine.
- UI code must call engine functions instead of duplicating rules or arithmetic.
- Rules values must come from `src/data/rules/`, not from literals in components,
  backend code, or AI prompts.
- Keep engine behavior deterministic in tests by accepting injectable randomness
  where appropriate.
- `src/engine/__tests__/architecture.test.ts` enforces the import boundary.

### Feature layer

- `src/features/chargen/` owns the character-creation wizard, Zustand state,
  validation orchestration, draft syncing, character-sheet presentation, and
  save-payload assembly.
- `src/features/roster/` owns saved-character lists, sheets, duplication, and
  edit-as-new-draft behavior.
- `src/features/play/` owns campaign loading and the player-facing turn loop.
- `src/features/gm/` owns the AI GM prompt, context, response schema, and model
  call.
- `src/features/campaign/` maps pure engine campaign state to persisted rows and
  append-only ledger events.

Prefer keeping rule decisions in the engine, persistence details in the backend
adapter, and feature modules focused on orchestration and presentation.

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

The protected layout currently performs a client-side session check with SSR
disabled. Database authorization must still rely on RLS rather than the route
guard alone.

## Authentication and authorization

The implemented sign-in methods are email/password and Google OAuth. Do not
assume the README's magic-link flow exists. A password-reset adapter exists, but
there is currently no reset-password route.

All application tables use row-level security. Parent records are scoped by
`auth.uid() = user_id`; child records are scoped through ownership helpers such
as `owns_character`, `owns_campaign`, and `owns_encounter`.

Any new server function or HTTP route that can consume paid AI resources or
access user data must perform server-side authentication. A browser route guard,
an attached bearer token, or CSRF protection is not by itself authorization.

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

## Known implementation gaps

Keep these in mind when changing adjacent code:

- The character save payload includes Lifepath narrative, but the current
  character Lifepath table has no narrative column. Pronouns and self-description
  are also not part of the saved-character schema.
- Portrait storage policies exist in migrations, but the repository does not
  create the `portraits` bucket.
- Mission objectives, rewards, and final campaign status are not fully updated
  by the current play loop.
- Non-combat structured world-state deltas proposed by the GM are still only
  partially wired into persistence.
- Combat is connected to campaign state and job closeout, but is still resolved
  through narration plus the read-only HUD; there is no interactive tactical
  movement or targeting layer over the continuous-metre engine.
- Settlement reads a bounded job ledger window (`JOB_LEDGER_LIMIT`, 2000 events)
  rather than querying the exact `mission_started` → `mission_completed` range.
  An exceptionally long job could exceed it.
- Encounters created before the atomic-closeout migration do not record which
  inventory rows supplied head and body armor, so their remaining SP cannot be
  written back to inventory.
- Immediate in-job pressure reports and engine-derived settlement pricing are
  not causally deduplicated. Engine-derived settlement is the authoritative
  pricing pass.
- `campaign_npcs` has no uniqueness constraint on `(campaign_id, npc_id)`.
  Settlement serializes survivor promotion behind the campaign lock, but
  concurrent writes elsewhere can still duplicate a recurring NPC.
- The append-only ledger is auditable, not tamper-proof: authenticated users can
  insert arbitrary event types into campaigns they own. Do not treat it as an
  anti-cheat boundary.
- Ordinary play turns still span multiple writes; only encounter saves, job
  settlement, and Aftermath closeout are transactional, so error handling must
  still account for partial turns in the immutable ledger.
- `src/integrations/supabase/types.ts` was hand-synchronized for
  `install_cyberware`, `campaign_cyberware` and `encounters.version` rather than
  regenerated. Regenerate it from the applied schema.
- Ripperdoc pacing — 0/1/3 recovery days by install level, four surgery hours
  per physical implant, appointment delay by disposition — is a house rule, and
  `catalog.json` labels it as one beside the RED-sourced values. Tune it there,
  not in code.
- `bun run lint` still fails on a pre-existing `prefer-const` error in
  `src/integrations/supabase/previewAuthStorage.ts`, plus existing Fast Refresh
  warnings.

Resolved by the Tomorrow Test closeout work (see
`supabase/migrations/20260830020000_atomic_combat_and_closeout.sql`):

- Combat costs — HP, wound state, Death Save failures, armor ablation, and
  ammunition — now reach canonical campaign rows instead of living only on the
  encounter.
- Job settlement is a single locked, idempotent transaction, so a partial write
  can no longer lose a payout or leave tallies, pressure, or phase half-applied.
- Settlement re-reads fresh canonical state before planning closeout instead of
  trusting a mid-turn bundle snapshot.
- Wounds and armor are no longer duplicated as `aftermath_*` situations; Life
  derives them from vitals and inventory.
- Attack ledger entries carry enough trace to reconstruct HP loss, armor
  ablation, ammunition use, and critical injuries, and Aftermath shows that
  receipt.

Do not silently paper over these gaps by moving mechanical authority into the
LLM or UI.

## Package manager and verification

Both npm and Bun lockfiles exist. GitHub CI uses Bun with a frozen lockfile;
prefer Bun for CI parity unless the project standard is deliberately changed.

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

The npm equivalents also exist. Before handing off a code change, run lint,
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
