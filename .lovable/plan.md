# P0 Build Report — Edgerunner Forge scaffolding

Status: scaffolding + data layer complete. No game UI. Tests and typecheck pass.

## Stack as actually built

- React 19 + TypeScript, **Vite 8 via TanStack Start v1** (not a bare Vite SPA)
- Routing: **TanStack Router file-based routes** in `src/routes/` (not React Router)
- Tailwind v4 (`src/styles.css`, no `tailwind.config.js`) + full shadcn/ui set in `src/components/ui/`
- Lovable Cloud (built-in backend) for auth + Postgres. No external backend project connected.
- Zustand 5 for the chargen wizard store
- Vitest 4 with a standalone `vitest.config.ts` (node environment, `vite-tsconfig-paths` only)

## Directory layout

- `src/data/rules/` — empty except `.gitkeep`; reserved for your committed JSON
- `src/engine/` — `types.ts`, `dice.ts`, `derived.ts`, `index.ts` (pure TS)
- `src/engine/__tests__/` — `dice.test.ts`, `derived.test.ts`, `architecture.test.ts`
- `src/features/chargen/` — `store.ts` (Zustand), `ChargenWizard.tsx` (placeholder shell)
- `src/features/roster/` — `RosterList.tsx` (placeholder shell)
- `src/lib/backend/` — `client.ts`, `types.ts`, `auth.ts`, `characters.ts`, `drafts.ts`, `index.ts`
- `src/routes/` — `index.tsx`, `login.tsx`, `_authenticated/{route,create,roster,character.$id}.tsx`

## Engine

Pure functions only. Dice: `rollDie/rollDice/roll/d6/d10`, `statSkillCheck` (RED exploding 10 / imploding 1, single crit step), `seededRng` (mulberry32) for deterministic tests. Derived math: `hitPointsMax` = 10 + 5·ceil((BODY+WILL)/2), `seriouslyWoundedThreshold`, `deathSave` = BODY, `humanityMax` = EMP·10, `empFromHumanity`, `deriveStats`. All randomness is injected via an `RNG` parameter.

The hard architectural rule is enforced by a test, not just convention: `architecture.test.ts` scans every non-test file under `src/engine/` and fails if any import matches `react`, `@/integrations`, `@/lib/backend`, `@/features`, or `supabase`.

## Backend adapter

`src/lib/backend/client.ts` is the only file importing the generated Cloud client; everything else imports from `@/lib/backend`. `characters.ts` exposes CRUD plus a `FullCharacter` aggregate read (character + stats, skills, role ability, gear, cyberware, lifepath, finance). `drafts.ts` handles get-latest / upsert / delete of wizard drafts. `auth.ts` wraps password sign-in/sign-up, magic link, password reset, sign-out, `getCurrentUser`, `onAuthChange`.

## Schema and RLS

Two migrations. Tables: `characters`, `character_stats`, `character_skills`, `character_role_ability`, `character_gear`, `character_cyberware`, `character_lifepath`, `character_finance`, `chargen_drafts`. All have RLS enabled with a single FOR ALL policy scoped `TO authenticated`. `characters` and `chargen_drafts` match on `auth.uid() = user_id`; child tables use a `public.owns_character(uuid)` helper. `updated_at` triggers on `characters` and `chargen_drafts`. Grants go to `authenticated` and `service_role` only — no anonymous access anywhere.

## Auth and routes

Public: `/` and `/login`. Protected: `/create`, `/roster`, `/character/$id` under the `_authenticated` pathless layout, which is `ssr: false` and redirects to `/login` when there is no user. Login page supports email/password sign-in, sign-up, and magic link.

## Deviations from the P0 prompt

1. **TanStack Start instead of plain Vite + React Router.** The Lovable template is fixed to TanStack Start; React Router cannot be installed. Consequence: routes are files under `src/routes/`, there is no `App.tsx` route table, and the dynamic route is `character.$id.tsx` giving `/character/$id` (`$id`, not `:id`) in typed `Link`/`navigate` calls. Everything is SSR-capable; the protected subtree opts out of SSR because the session lives in `localStorage`.
2. **Types are re-exported, not emitted, into `src/lib/backend/types.ts`.** Cloud regenerates `src/integrations/supabase/types.ts` on every migration and overwrites it; writing generated output directly into `src/lib/backend/types.ts` would be clobbered or go stale. That file imports `Database` from the generated file and re-exports named row/insert/update aliases plus `FullCharacter`. The "only one folder touches the generated client" rule still holds — `src/lib/backend` is the sole importer.
3. **Separate `vitest.config.ts`.** The app's Vite config uses the Lovable TanStack preset with SSR/nitro plugins that break a node-environment unit test run, so engine tests run against a minimal standalone config. `@vitejs/plugin-react` was added as a devDependency for future component tests.
4. **Added an `owns_character()` SQL helper.** Not in the prompt, but child tables have no `user_id` column; without it every child policy would inline a correlated subquery. The second migration downgraded it from SECURITY DEFINER to SECURITY INVOKER and revoked anonymous/PUBLIC execute after a security lint flagged the definer version.
5. **`character_stats` persists derived values** (`hp_max`, `death_save`, `humanity_max`, `seriously_wounded_threshold`) as columns rather than recomputing on read. UI still never does the arithmetic, but the engine must be the sole writer so the columns cannot drift.
6. **Password reset points at `/reset-password`, which does not exist yet.** `sendPasswordReset` is in the adapter but its redirect target is an unbuilt route — build it or drop the function.
7. **Email confirmation is on** (Cloud default, no auto-confirm). Password sign-up returns `needsEmailConfirmation` and the user must click the emailed link before a session exists.
8. **No Google sign-in.** The prompt specified email/password + magic link only, so the usual Google default was intentionally skipped.