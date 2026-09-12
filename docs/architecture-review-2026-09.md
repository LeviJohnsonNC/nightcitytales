# Architecture, test and documentation review — September 2026

Reviewed at `e9e294c`. Scope: the whole repository — architecture boundaries,
the AI trust boundary, the persistence layer, the migration history, the test
suite, and the four governing documents (`PRODUCT.md`, `AGENTS.md`,
`ROADMAP.md`, `README.md`).

Verification run for this review:

| Check               | Result                                                                                                                                                                                                         |
| ------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `bun run test`      | **2070 passed, 127 files, 14.9s**                                                                                                                                                                              |
| `bun run lint`      | **1 error, 12 warnings** (the known `prefer-const`)                                                                                                                                                            |
| `bun run typecheck` | Not conclusive here — several dependencies (`ai`, `@ai-sdk/*`, `@lovable.dev/*`, `eventsource-parser`) return 403 from the Lovable npm proxy in this sandbox. Every reported error traces to a missing module. |

---

## Summary

This is an unusually well-built repository. The engine/model boundary is not a
slogan — it is enforced by a purity test, by closed vocabularies, by DV
snapping, by withheld dossiers, and by prompts that lack the words to misbehave.
The SQL is better than most production Supabase work: RLS on all 24 tables,
`SECURITY INVOKER` with `auth.uid()` checks and `FOR UPDATE` locks on every
transactional RPC, `search_path` pinned on every `SECURITY DEFINER` helper. The
documentation is the best part of the project and is honest about its own gaps.

The problems are concentrated in three places, and they are not where the care
went:

1. **The AI endpoints are unauthenticated.** Three of four paid-AI paths skip
   the auth middleware that the fourth uses, and one of them accepts a
   client-supplied system prompt. `AGENTS.md` forbids exactly this, by name.
2. **The persistence boundary is untyped** while everything either side of it is
   `strict`. Event payloads are cast to `Json` on write and reconstructed with
   loose `typeof` checks on read. This is the same silent-failure class that
   already cost one outage.
3. **Test coverage is inverted relative to risk.** The pure engine, which cannot
   silently corrupt anything, has 68 test files for 77 modules. Character
   creation — "act one", per `PRODUCT.md` — has 3 for 58, and its save gate has
   none.

Nothing here argues with the product. Every item below is either a defect, a
stated rule the code does not keep, or a doc that has drifted from the code.

---

## 1. Security and cost — the AI endpoints

### 1.1 Three of four paid-AI paths have no server-side authentication

`AGENTS.md`, "Authentication and authorization":

> Any new server function or HTTP route that can consume paid AI resources or
> access user data must perform server-side authentication. A browser route
> guard, an attached bearer token, or CSRF protection is not by itself
> authorization.

The rule is kept once:

| Path                                    | Auth                                    |
| --------------------------------------- | --------------------------------------- |
| `src/features/life/lifeTurn.server.ts`  | `.middleware([requireSupabaseAuth])` ✅ |
| `src/features/gm/gmTurn.server.ts`      | none ❌                                 |
| `src/features/gm/ipJudgement.server.ts` | none ❌                                 |
| `src/lib/background.functions.ts`       | none ❌                                 |
| `src/routes/api/generate-portrait.ts`   | none ❌                                 |

`src/start.ts` installs `createCsrfMiddleware` with
`filter: (ctx) => ctx.handlerType === "serverFn"`, so the three server functions
get CSRF and the HTTP route gets nothing at all. CSRF stops a cross-site browser
request; it stops nothing from `curl`.

**`generateBackgroundFn` is the worst of the four.** Its validator is:

```ts
const PromptInput = z.object({ system: z.string().min(1), user: z.string().min(1) });
```

Both halves come from the client. That is an open, unauthenticated,
general-purpose LLM proxy running on `LOVABLE_API_KEY`. `gmTurnFn` and
`ipJudgementFn` at least pin their system prompt server-side, but still accept an
arbitrary `userPrompt` and return generated text to anyone who asks.
`/api/generate-portrait` bills image generation on `gpt-image-1-mini` per call.

The fix is four lines and already written — `requireSupabaseAuth` exists and
works. The HTTP route needs the equivalent inline, since middleware of type
`"function"` does not apply to a file route handler.

### 1.2 `.env` is tracked

`git ls-files` shows `.env`, holding six keys. All six are Supabase project id /
URL / **publishable** key, which is what `AGENTS.md` correctly notes is not a
service-role credential. The exposure today is nil.

The problem is the precedent: the file is tracked, `.gitignore` does not list it,
and the moment somebody adds `LOVABLE_API_KEY` or a service-role key to the file
they already have in front of them, it is committed and synced to Lovable. Untrack
it, ignore it, and add a `.env.example` with the key names only.

### 1.3 `/combat` writes real campaign data for every authenticated user

`src/routes/_authenticated/combat.tsx` is documented as a developer tool,
deliberately ungated so it works on the deployed preview — and it is honestly
built (it seeds through `beginEncounter` and hands off to `/play/:id`, so it
exercises shipping code, which is right).

But "deployed preview" and "production" are the same bundle. Any signed-in player
can navigate to `/combat` and seed an arbitrary arena, force size and wound state
into their live campaign. For a solo game, self-cheating is a small harm; leaving
a live campaign in a state the loop never produces is a larger one. An env flag
that is on in preview and off in production costs one line and keeps the harness.

---

## 2. Correctness — the untyped persistence boundary

The TypeScript configuration is genuinely strict: `strict`,
`noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`,
`noImplicitReturns`, `noFallthroughCasesInSwitch`. Then every write to the
ledger escapes it:

- **177** `as unknown as X` casts in non-test source, of which **116** are
  `as unknown as Json` — every `campaign_events.data` payload.
- Reads reconstruct those payloads by hand. `src/engine/settlement.ts`:

  ```ts
  function bag(event: SettlementEvent): Record<string, unknown> { ... }
  // ...
  typeof data["hp_before"] === "number" && typeof data["hp_after"] === "number"
    ? [{ before: data["hp_before"], after: data["hp_after"] }]
    : []
  ```

This is careful code, and that is the problem. If `combatLog.ts` renames
`hp_before`, `readMechanicalCost` does not throw — it returns **zero rows**, and
the job settles with no HP cost on the receipt. Settlement is the module
`PRODUCT.md` describes as "where the game tells the truth about what happened",
replaying events the engine wrote. A writer/reader drift there produces a
confidently wrong receipt, silently.

This is precisely the failure mode `AGENTS.md` already documents with real
scar tissue:

> Every encounter save raised `column "campaign_id" does not exist`, so no
> fight persisted movement, damage, hostile turns or its own ending, and nothing
> failed loudly.

Zod is already a dependency and is already used, well, for the _model_ boundary.
It is not used for the _persistence_ boundary, which carries just as much
mechanical authority and is written and read by two different modules.

**The fix:** one `src/features/campaign/eventSchemas.ts` with a Zod schema per
event type; `appendCampaignEvent` parses on write, `settlement.ts` and
`combatLog.ts` parse on read. Drift becomes a type error at build time and a
test failure in CI, instead of a zero.

Related, smaller: `readMechanicalCost` identifies the player by
`bag(event)["target"] === input.playerName` — a name-string match. Two combatants
with the same name, or a renamed character, mis-prices the job.

---

## 3. CI — lint cannot fail the build

`.github/workflows/ci.yml`:

```yaml
- name: Lint
  run: bun run lint
  continue-on-error: true
```

`AGENTS.md` already diagnoses the consequence correctly:

> CI runs lint with `continue-on-error`, which is why this has survived: a lint
> error will not turn a build red, so nothing catches a new one for you.

The stated reason is that Lovable pushes arrive formatting-dirty and the
Autoformat workflow cleans them. That reason only justifies ignoring
**formatting** failures — and `eslint-config-prettier` plus
`eslint-plugin-prettier` are already wired, so Prettier violations surface as
eslint errors and are indistinguishable from real ones.

Fix the one standing `prefer-const` error, then split the job: run
`eslint --rule '{"prettier/prettier":"off"}'` as a blocking step and keep the
formatting check non-blocking. Right now the repository has a linter that cannot
say no.

---

## 4. Test suite

2070 tests in 127 files, running in 15 seconds. The quality of the individual
tests is high — several carry a comment explaining the bug they exist to prevent,
which is the right way to write a regression test. Three structural observations.

### 4.1 Coverage is inverted relative to risk

| Area                        | Test files | Source files |
| --------------------------- | ---------- | ------------ |
| `src/engine/`               | 68         | 77           |
| `src/features/campaign/`    | 17         | 18           |
| `src/features/play/`        | 22         | 43           |
| `src/features/life/`        | 7          | 14           |
| `src/features/gm/`          | 5          | 7            |
| `src/features/atlas/`       | 2          | 8            |
| **`src/features/chargen/`** | **3**      | **58**       |
| `src/features/downtime/`    | 1          | 4            |
| **`src/lib/backend/`**      | **1**      | **14**       |
| **`src/features/roster/`**  | **0**      | **10**       |
| `src/routes/`               | 0          | 11           |
| `src/components/`           | 0          | 47           |

The engine is the safest layer in the codebase — pure, deterministic, plain
objects in and out — and it has near-total coverage. Character creation is where
`PRODUCT.md` says the campaign's cast, debts, enemy and old flame come from, it
is 58 modules, and it has three test files, two of which
(`artFiles`, `portraitPrompt`) are about art.

Most pointed: `AGENTS.md` names a load-bearing invariant —

> Step validation and the final save gate must share the validators in
> `src/features/chargen/validation.ts`; do not create a separate, weaker save
> path.

`validation.ts` (202 lines) and `finalGate.ts` have **zero tests**. The
invariant currently holds — `finalChecklist` does delegate to `validateStep` —
but nothing stops the next change from adding the weaker path the rule forbids.
A ~30-line test that asserts every step in `stepsFor(method)` appears in
`finalChecklist`, and that a state failing any step fails the gate, would close
it permanently.

### 4.2 The source-scanning guards are proxies, not tests

Five tests read their subject as text and regex it:

- `engine/__tests__/architecture.test.ts` — engine purity
- `campaign/__tests__/encounterSchema.test.ts` — SQL vs generated types
- `campaign/__tests__/placeSchema.test.ts` — same for `campaign_places`
- `play/__tests__/campaignStatus.test.ts` — status literals vs the CHECK
- `lib/backend/__tests__/schema.test.ts`

Given no database in CI, these are a smart response to a real constraint, and
`campaignStatus.test.ts` even guards its own vocabulary. But each catches only
the literal spelling it greps for:

- `updateCampaign(id, { status: someVariable })` passes the status guard.
- `await import("react")` or `require()` passes the purity guard, which only
  matches `from "…"`.
- The purity guard also checks one direction only. Nothing asserts the other
  stated boundaries: that `src/lib/backend/` is the only place the Supabase
  client is touched (it currently is — verified by hand), or that feature
  modules do not reach into each other's internals.

Widen the purity test into one `boundaries.test.ts` covering `import(`,
`require`, and the backend and feature-layer rules. It is the cheapest test in
the repository and it guards the claim the README leads with.

### 4.3 Almost no UI is tested

One `.test.tsx` file in the whole repository
(`play/__tests__/combatBoardRender.test.tsx`). `PRODUCT.md` devotes a full
section to interface and asserts things that are testable — "the suggested
actions have quietly become the only actions" is listed as a smell, and the
five-action cap, the two-slot approach reserve and the card ordering are all
deterministic functions. Those belong in tests near the model layer
(`lifeOptions.ts`, `placeActions.ts`) rather than needing a DOM.

---

## 5. Architecture

What holds, and holds well: engine purity; the backend adapter as the sole
Supabase caller; rules values in `src/data/rules/` rather than literals; closed
vocabularies at the model boundary; DV snapping (`snapToPublishedDv`) on both the
Life and Job paths; disposition clamped to the column's own CHECK; enemy stats
dropped rather than clamped so the model cannot choose where in a range a fight
sits. `normalizeGmResponse` is a genuinely excellent defensive parser — the alias
table and the field-shape inference are the right answer to model drift, and the
`onWarn` default means nothing is dropped silently.

Five things to change.

### 5.1 `usePlay.ts` (2566 lines) and `useLife.ts` (1982 lines)

These are the two largest modules in the project and they are not hooks. Each is
a turn-orchestration service — load a bundle, build a model context, call the
model, normalize, validate, resolve in the engine, sequence five to ten writes,
narrate the fixed result — with a `useXxx` hook appended at the end. `usePlay.ts`
alone exports or defines 35 top-level functions.

The consequences are already visible. The three tests that touch `usePlay` need
four `vi.mock` factories to reach it. The one-directional dependency on React
means none of the turn logic can be tested without the module graph that pulls in
the query client. And `AGENTS.md`'s own layering advice — "feature modules
focused on orchestration and presentation" — is not separable here, because
orchestration and presentation are in the same file as persistence sequencing.

This is not a rewrite. The extraction that pays for itself immediately is the
pure part: `commitCheck`, `resolveCheck`, `commitAttack`, `commitBoardMove`,
`endPlayerTurn`, `settleMission` are already module-level async functions taking
a `PlayBundle`. Moving them to `playTurn.ts` / `lifeTurn.ts` — no React import —
and leaving `usePlay.ts` as the hook that binds them to TanStack Query costs
nothing behaviourally and makes them directly testable.

Per `PRODUCT.md`'s "Before you build": the player experience this improves is
the one where a turn-sequencing bug ships because the turn could not be tested.

### 5.2 `src/engine/index.ts` re-exports 73 modules with `export *`

Every consumer writes `from "@/engine"` and receives the union of everything.
The practical costs: the engine has no stated public API, so an internal helper
becoming load-bearing elsewhere is invisible; a rename anywhere can collide
silently; and the barrel defeats per-module tree-shaking for the client bundle.

A quick scan found ~50 symbols exported from engine modules that are referenced
only inside their own file — `LIFESTYLE_OPTIONS`, `HOUSING_OPTIONS`,
`travelTrip`'s neighbours, `ARMOR_ITEMS`, `SHELF_TIERS`, and so on. They are not
dead code; they are internals that did not need to be public. Dropping `export`
from those and letting the barrel re-export a deliberate surface would make the
engine's contract legible.

`actorFromSheet` in `skillCheck.ts` is genuinely unreferenced outside its own
docstring, and is worth a second look for a different reason — see 5.4.

### 5.3 `placeDossiers.ts` ships ~200 KB of prose in the play bundle

1953 lines of hand-written dossier text in a `.ts` file. The file header
justifies the location well (presentation copy, never imported by the engine,
falls back to the atlas blurb) and that reasoning is sound.

The issue is the import chain, not the location: `PlaceName.tsx` statically
imports `PlaceDossier.tsx`, which statically imports `placeDossiers.ts`. Every
place name rendered inline in Life and Play pulls the whole corpus into the
initial bundle. Every other body of content in the project lives in
`src/data/*.json`. Move it there and load it on dossier open, or at minimum make
the `PlaceDossier` import lazy — the dossier is a modal that most turns never
open.

### 5.4 Play invents an NPC row; Life does not

On a `npc_disposition` delta naming a key the campaign has never filed:

- `usePlay.ts:837` creates the row —
  `await saveCampaignNpc(campaignId, delta.npcKey, { name: delta.npcKey })`.
- `useLife.ts:1029` looks it up and, finding nothing, does nothing.

The play-side comment explains the intent (keep the shift, correct the name
later), but the effect is that the Job narrator can mint a person into
`campaign_npcs` with a machine key as their display name. That sits badly against
`PRODUCT.md`'s "Prefer the existing cast over inventing another intimidating
ganger named Vex" and against the anti-goal "Infinite procedural NPCs" — and it
lands in the one table `AGENTS.md` flags as having **no uniqueness constraint on
`(campaign_id, npc_id)`**. Pick one behaviour and use it on both paths; the Life
behaviour is the one that matches the product.

Related and small: the `delta` is clamped to ±3 in `lifeResponse.ts` and left
unclamped in `gmResponse.ts`. Both end up correct because `clampDisposition`
saturates to the column's range, so this is a consistency nit rather than a bug —
but the asymmetry is the kind that stops being harmless when someone widens the
scale.

### 5.5 Migration history still cannot be replayed clean

`AGENTS.md` and `ROADMAP.md` both carry this, and it stays the oldest standing
debt: campaign and encounter objects are created more than once,
`encounter_combatants` is defined twice with different columns, and the generated
types match the latest schema rather than the replayed one. Three of the ten
standing debts are downstream of it (`campaign_places` must be applied by hand,
`types.ts` hand-synchronised twice, `portraits` bucket never created).

Everything else in the SQL is strong enough that this is worth closing properly:
a `supabase db reset` in CI against the migration folder, asserting the resulting
schema matches `types.ts`. That single check retires `encounterSchema.test.ts`
and `placeSchema.test.ts` — both of which exist only as text-scanning proxies for
the database CI does not have.

---

## 6. Documentation

The four documents are the strongest asset here. `PRODUCT.md` is a genuinely
unusual artifact: a compass that says _no_ to specific attractive changes, names
its own failure modes ("How to tell it is going wrong"), and records open
questions so they get decided rather than defaulted into. `AGENTS.md` keeps an
honest gap list that names an outage it caused. `ROADMAP.md` marks shipped work
with strikethrough rather than deleting it, so the reasoning survives.

Four drifts and one structural suggestion.

### 6.1 `AGENTS.md`: the dial count is stale

> The `goodwill` dial in `place-state.json` moves but no threshold reads it …
> The other three dials each resolve to a flag.

There are **six** dials (`police_attention`, `gang_pressure`, `goodwill`,
`reclaimer_control`, `corporate_attention`, `civic_scrutiny`) and **five**
thresholds. So it is "the other five", not "the other three" — and the core
claim is still true and still worth acting on: `goodwill` is the only dial
nothing reads.

### 6.2 `ROADMAP.md`: `gang_pressure` is no longer dangling

> `goodwill` and `gang_pressure` move and no threshold reads them, so two dials
> currently accumulate in silence.

`place-state.json` now carries a `gang_pressure` threshold at 8. One dial
accumulates in silence, not two.

### 6.3 The `goodwill` dial itself

Both documents correctly call this the failure `PRODUCT.md` warns about — "A dial
that changes nothing the player meets is decoration". It has now survived two
document revisions in that state. `ROADMAP.md` names the missing half ("Giving
`goodwill` a threshold is the missing half of the favour loop"), which makes it a
small, well-specified piece of work rather than an open question. Do it or delete
the dial.

### 6.4 `package.json` still says `"name": "tanstack_start_ts"`

Scaffold residue in a project this deliberate about naming.

### 6.5 The gap list needs severities

`AGENTS.md`'s "Known implementation gaps" is 16 bullets long and mixes
"unauthenticated paid AI endpoint" territory with "Ripperdoc pacing is a house
rule, tune it in data". `ROADMAP.md`'s "Standing debts" repeats eight of them in
a different order. A reader cannot tell what is urgent.

Suggestion: make `ROADMAP.md` "Standing debts" the single ordered list with a
severity column, and have `AGENTS.md` link to it rather than restate it. The rule
the repository already applies to state — one source of truth, derived not
duplicated — applies to its own documents.

---

## 7. Prioritized change list

Ordered by expected harm per unit of work. Items 1–3 are small and should not
wait.

### P0 — do first

| #   | Change                                                                                                                       | Why                                                                                                | Size      |
| --- | ---------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- | --------- |
| 1   | Add `requireSupabaseAuth` to `gmTurnFn`, `ipJudgementFn`, `generateBackgroundFn`                                             | Three unauthenticated paid-AI endpoints; violates a rule `AGENTS.md` states explicitly             | ~4 lines  |
| 2   | Authenticate `/api/generate-portrait` inline (function middleware does not reach a file route) and add a per-user rate limit | Unauthenticated, un-CSRF'd, billed image generation                                                | ~20 lines |
| 3   | Stop `generateBackgroundFn` accepting a client-supplied `system` prompt — move it server-side beside the other prompts       | Open general-purpose LLM proxy on the owner's key; also the only prompt not under `prose-style.ts` | ~15 lines |
| 4   | `git rm --cached .env`, add to `.gitignore`, add `.env.example`                                                              | Only publishable keys today; the tracked file is the trap                                          | ~5 min    |

### P1 — next

| #   | Change                                                                                              | Why                                                                                                                | Size       |
| --- | --------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ | ---------- |
| 5   | Zod schemas for `campaign_events.data`, shared by `combatLog.ts` (write) and `settlement.ts` (read) | 116 untyped `Json` casts; writer/reader drift silently zeroes a job's receipt — the outage class already seen once | 1–2 days   |
| 6   | Make lint blocking: fix the `prefer-const`, split formatting into a separate non-blocking step      | The linter currently cannot fail a build, by configuration                                                         | ~1 hour    |
| 7   | Gate `/combat` on an env flag that is on in preview, off in production                              | Any player can seed arbitrary encounters into a live campaign                                                      | ~10 lines  |
| 8   | Tests for `validation.ts` and `finalGate.ts`                                                        | The one invariant `AGENTS.md` calls load-bearing in chargen has no guard                                           | ~100 lines |
| 9   | `supabase db reset` replay in CI, asserting the schema matches `types.ts`                           | Closes the oldest standing debt and retires two text-scanning proxy tests                                          | 1 day      |

### P2 — worth scheduling

| #   | Change                                                                                                                                  | Why                                                                                    | Size      |
| --- | --------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- | --------- |
| 10  | Extract turn orchestration from `usePlay.ts` / `useLife.ts` into React-free `playTurn.ts` / `lifeTurn.ts`                               | 4548 lines across two files; turn logic is untestable without four mock factories      | 2–3 days  |
| 11  | Widen `architecture.test.ts` into `boundaries.test.ts`: cover `import()`/`require`, the backend-adapter rule, and cross-feature imports | The guard covers one direction and one import syntax                                   | ~1 hour   |
| 12  | Give `goodwill` a threshold, or delete the dial                                                                                         | Named by both docs as the failure `PRODUCT.md` warns about; has survived two revisions | ~1 hour   |
| 13  | Make Play's `npc_disposition` handling match Life's — do not mint an NPC from a model-invented key                                      | Model authoring people, into the table with no uniqueness constraint                   | ~10 lines |
| 14  | Move `placeDossiers.ts` to `src/data/` and load lazily (or lazy-import `PlaceDossier`)                                                  | ~200 KB of prose in the initial play bundle via `PlaceName`                            | ~2 hours  |
| 15  | Raise `lib/backend` and `roster` off zero tests; add model-layer tests for the Life/Place option caps and ordering                      | Two layers with no coverage; the action-cap rules are pure and already regressed once  | 1–2 days  |

### P3 — hygiene

| #   | Change                                                                                                      | Why                                                                               |
| --- | ----------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| 16  | Fix the dial counts in `AGENTS.md` and `ROADMAP.md`                                                         | Both stale; `gang_pressure` now has a threshold                                   |
| 17  | Consolidate the gap lists — one ordered, severity-tagged list in `ROADMAP.md`, linked from `AGENTS.md`      | 16 bullets, two documents, no severities; the repo's own one-source-of-truth rule |
| 18  | Rename `package.json` from `tanstack_start_ts`                                                              | Scaffold residue                                                                  |
| 19  | Narrow the engine's public surface: drop `export` from file-local helpers, make `index.ts` a deliberate API | ~50 symbols public with no external consumer; `export *` from 73 modules          |
| 20  | Clamp the GM-path `npc_disposition` delta the way the Life path does                                        | Harmless today, asymmetric, stops being harmless if the scale widens              |

---

## 8. On the roadmap itself

`ROADMAP.md` ends the two most recent milestones with the same honest sentence —
**"nobody has played it."** That is the right diagnosis and it should be the next
item, above everything in P2 above.

Both the location layer and the five withheld-knowledge slices are verified by
test and unverified by play, and the numbers most likely to be wrong are all
pacing numbers: `PLACE_OBSERVATION_EFFECTS`, the `place-state.json` thresholds,
the suspicion cooling rate, the insight margin, how often a conclusion is
reachable. The roadmap already names the experiment — seven in-game days inside
one district, counting situations and counting quiet evenings.

The reason to run it before the P2 items, and certainly before authoring beats
for more districts, is that it is the only work on the list that can tell you a
system is wrong rather than merely untidy. Everything in P2 makes the code better
at whatever it is currently doing. The week of play is what says whether that is
the right thing.

The P0 and P1 items are a different matter — they should be done first because
they are small, and because three of them are a rule the repository wrote down
for itself and then did not keep.
