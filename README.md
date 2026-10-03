# Night City Tales

A solo Cyberpunk RED game for the web. You make a character by the book, then
live with them in Night City: pay rent, keep an armored jacket that is two
firefights from useless, take work from a fixer who may stop calling, and find
out what the city does back.

An AI narrates and reads intent. It does not decide anything. Dice, checks,
damage, money, time, positions, pressure and every phase transition belong to
deterministic TypeScript in `src/engine/`, and the model is never handed the
vocabulary to overrule them. `PRODUCT.md` explains why that line sits exactly
where it does.

## The two halves

**Character creation** implements the published creation methods — Streetrat,
Edgerunner and Complete Package — as a validated wizard told as a meet with a
fixer: you pick which of three fixers to see, and they ask every question after
that — Role, how you want to build (the method), Lifepath, STATs, Skills,
starting gear or cyberware, Gear & Armor, Lifestyle, Identity — before reading
the file back. The last screen shows the three people already waiting for you in
the city and walks you straight into the campaign; the fixer you picked is your
fixer there. Drafts autosave, so a refresh costs nothing. Editing a saved
character opens a new draft rather than mutating the original.

**The campaign** is a loop of four explicit phases:

```
LIFE → HOOK → JOB → AFTERMATH → LIFE
```

- **Life** is the foundation rather than the corridor between missions. A
  turn-based city layer where a concrete situation arrives and the player spends
  limited time, money, attention, goodwill and risk on it. Shopping, ripperdoc
  visits, downtime and travel all happen here.
- **Hook** is an offer. `accept_hook` is the only door into a job, and only the
  player presses it.
- **Job** runs a mission as a beat graph, with combat as a mode inside it rather
  than a phase of its own. Combat fills the screen with an angled battlefield on
  RED's 2 m battlemat grid — every square a Move Action reaches is lit, with the
  route into the one under the cursor — plus targeting previews and a persistent
  command bar; the journal
  and freeform intent stay within reach. Saved actions play in sequence with
  skippable movement and shot feedback; routine exchanges use engine-written
  reports without waiting for generated narration.
- **Aftermath** is the receipt: what the job paid, what it cost, who noticed,
  and what is still bleeding.

Life and Job run from separate system prompts, and the Life response schema
cannot express a job transition. The narrator is not asked to stay in its lane;
it is not given the words to leave it.

## The city is a system, not scenery

`src/data/atlas/night-city.json` is the published atlas — 24 districts, 156
locations, 9 landmarks, 31 streets — and is never edited. Everything that makes
those places playable sits beside it as house rules, each flagged
`houseRule: true`, and each with an engine module that reads it:

| Module            | What it answers                                              |
| ----------------- | ------------------------------------------------------------ |
| `geography.ts`    | What the publisher printed                                   |
| `places.ts`       | Tags, district profiles, who responds when it goes loud      |
| `placeBeats.ts`   | What a location can put in front of you                      |
| `placeActions.ts` | What there is to do there on a quiet afternoon               |
| `placeSignals.ts` | What a pin on the map is allowed to say                      |
| `placeState.ts`   | What a place has become, in this campaign                    |
| `placeIntel.ts`   | What knowing it buys you — information, never a die modifier |
| `haunts.ts`       | Where the recurring cast are, and when                       |

Two rules hold this together. Most of it is **derived, not stored**: beats,
haunts and signals are pure functions of campaign, day and part of day, so
nothing is written to make a city feel alive. And what _is_ stored is **sparse**:
a place a campaign has never touched has no row, and the engine reads its
authored starting condition instead.

## Stack

React 19 and TypeScript on TanStack Start, Tailwind v4 with shadcn/ui, Zustand
for wizard state, Supabase (via Lovable Cloud) for auth and persistence, Vitest
for tests. Phaser 4 supplies the optional Night Shift courtyard art layer; React/SVG
retains tactical controls and the pure engine retains all combat authority. The
courtyard includes animated units and independently destructible props, with
saved older layouts preserved. See
[the visual proof notes](docs/combat-visual-proof.md) for scope and how to test it.
Bun is the package manager — `bun.lock` is what CI installs from.

## Layout

```
src/engine/      pure TypeScript rules engine — no React, no Supabase, no features
src/data/rules/  published RED values as JSON
src/data/atlas/  the printed atlas, plus the house rules built on it
src/features/    chargen, roster, play, life, gm, campaign, scenes, atlas, cast,
                 downtime, items, landing, dev
src/lib/backend/ the only place the Supabase client is touched
src/routes/      file-based routes; routeTree.gen.ts is generated
supabase/        migrations
tools/atlas/     regenerates the derived atlas data
```

The one architectural rule worth stating here: **nothing in `src/engine/` may
import React, a feature module, or the backend.** It takes plain objects and
returns plain objects, and it is the only place dice are rolled or character math
is done. `src/__tests__/boundaries.test.ts` enforces it, along with the other two rules
about what may import what.

## Running it

```sh
bun install
bun run dev
```

The checks CI runs:

```sh
bun run lint
bun run typecheck
bun run test
```

Migrations live in `supabase/migrations/` and are forward-only. A new one has to
be applied before the features that depend on it will load.

## The documents

- **`PRODUCT.md`** — the compass. What the game is for, where the line between
  engine and model sits, and what to do when a design request is ambiguous. Its
  "Before you build" section is the checklist any new abstraction has to answer
  first.
- **`AGENTS.md`** — the contributor and agent guide. Architecture boundaries,
  the database contract, the AI contract, and an honest list of known gaps.
- **`ROADMAP.md`** — what is shipped, what is next, and the standing debts.
- **`README.md`** — this file.

## Build with Lovable

This project is connected to [Lovable](https://lovable.dev) and can be developed
in the [Lovable editor](https://lovable.dev/projects/2cad9dff-eecd-46d8-8b1f-749f46c6f3c6).
Changes made there commit straight to this repository, and pushes to `main` sync
back. Avoid rewriting published history on the connected branch.

The authored North Heywood proof can now be staged as a persistent text scene from
`/combat`, entered through the adventure screen, and revisited with its saved
combat aftermath. At that saved scene, direct commands such as “shoot the rifleman”
or “open fire” enter combat and retain the opening request through initiative.
This is an explicit test fixture and a narrow command vocabulary; general scene
generation and prose-to-combat interpretation are not enabled. See [the scene proof notes](docs/north-heywood-proof.md).

The `/combat` harness also offers composed intersection and service-alley proofs,
with semantic zones, reusable clusters, and permanent building geometry. They
use saved battlefield v2 and require migration `20261003010000`. See
[composition scope and playtest steps](docs/scene-composition.md). The [composition quality pass](docs/composition-quality.md) adds denser room furnishing, stepped exterior masses and thinner shared wall geometry.

The [spatial organization checkpoint](docs/spatial-organization.md) introduces compact office programs, distinct intersection corners and structure-only scene review.

[Office checkpoint 1A](docs/office-topologies.md) adds spine, loop and open-core plans, protected arrival landings and shared interior thresholds.

[Intersection checkpoint 1B](docs/intersection-networks.md) coordinates street proportions, frontage and a protected pedestrian network.
