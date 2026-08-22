# NightCityTales

Set up a new project with the following stack and structure. Do not build any game

UI yet — this prompt is scaffolding and data layer only.

STACK

- React + TypeScript + Vite

- Tailwind + shadcn/ui

- Lovable Cloud (the built-in backend) for auth and persistence — do NOT connect an

  external Supabase project

- Zustand for chargen wizard state

- Vitest for unit tests

DIRECTORY STRUCTURE

/src/data/rules/ — static JSON rules data (I will commit these; do not create them)

/src/engine/ — pure TypeScript rules engine, zero React, zero backend imports

/src/engine/**tests**/ — Vitest tests for the engine

/src/features/chargen/ — the character creation wizard

/src/features/roster/ — saved character list

/src/lib/backend/ — a thin adapter over the Lovable Cloud client: queries, types.

                        Nothing outside this folder imports the generated Cloud client

                        directly. See BACKEND ADAPTER below.

HARD ARCHITECTURAL RULE

Nothing in /src/engine/ may import React, the backend client, or anything from

/src/features/.

The engine takes plain objects in and returns plain objects out. It is the only place

dice are rolled and character math is done. UI components never do arithmetic on

character values — they call engine functions and render the result.

AUTH

Email/password plus magic link via Lovable Cloud auth. Protected routes: /create, /roster,

/character/:id. Public: /, /login.

BACKEND ADAPTER

Lovable Cloud is Supabase-based, so it will generate a client somewhere conventional.

Leave that generated file where it lands, but wrap it: every read and write in the app

goes through a function exported from /src/lib/backend/. No React component and no

feature module imports the generated client directly.

This costs one small file now. It matters because moving from Lovable Cloud to a

standalone Supabase project later is not a one-click migration — if that day comes,

an adapter means changing one folder instead of every component that touches data.

SCHEMA

Create these tables with RLS enabled, all policies scoped to the authenticated user:

characters

id uuid pk default gen_random_uuid()

user_id uuid not null references auth.users(id) on delete cascade

name text not null

handle text

role text not null

creation_method text not null check (creation_method in ('streetrat','edgerunner','complete_package'))

portrait_id text

is_complete boolean not null default false

created_at timestamptz not null default now()

updated_at timestamptz not null default now()

character_stats

character_id uuid pk references characters(id) on delete cascade

int int, ref int, dex int, tech int, cool int,

will int, luck int, move int, body int, emp int

emp_max int -- EMP before Humanity loss

hp_max int, hp_current int

seriously_wounded_threshold int

death_save int

humanity_max int, humanity_current int

character_skills

id uuid pk

character_id uuid references characters(id) on delete cascade

skill_id text not null -- key into skills.json

level int not null

specialization text -- for Language, Science, Play Instrument, Local Expert etc.

unique (character_id, skill_id, specialization)

character_role_ability

character_id uuid pk references characters(id) on delete cascade

ability_id text not null

rank int not null default 4

metadata jsonb not null default '{}' -- Nomad vehicle pool, Exec resources, etc.

character_gear

id uuid pk

character_id uuid references characters(id) on delete cascade

item_id text not null -- key into catalog.json

quantity int not null default 1

equipped boolean not null default false

slot text -- 'body','head','shield', null

current_sp int -- armor ablation tracking

notes text

character_cyberware

id uuid pk

character_id uuid references characters(id) on delete cascade

item_id text not null

install_location text -- 'right_cybereye','left_cyberarm','internal', etc.

humanity_loss_rolled int

foundational_for uuid references character_cyberware(id) -- option slotted into a foundation

character_lifepath

character_id uuid pk references characters(id) on delete cascade

general jsonb not null default '{}'

role_specific jsonb not null default '{}'

-- each entry: { "tableId": {"value": "...", "method": "rolled"|"chosen", "roll": 7|null} }

character_finance

character_id uuid pk references characters(id) on delete cascade

eurobucks int not null default 0

lifestyle text

housing text

rent int

chargen_drafts

id uuid pk

user_id uuid references auth.users(id) on delete cascade

state jsonb not null -- full wizard state, so a refresh doesn't lose progress

updated_at timestamptz not null default now()

Generate TypeScript types from this schema into /src/lib/backend/types.ts and

re-export them from there.

Deliver: working auth, empty protected routes, migrations, generated types. No game UI.

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/2cad9dff-eecd-46d8-8b1f-749f46c6f3c6).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
