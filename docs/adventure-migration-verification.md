# Adventure scene context — deployed verification

Checked on 2026-11-18 against implementation revision `37fa0f7d`.

Requested migration: `supabase/migrations/20261003160000_adventure_scene_context.sql`.

## Result

The migration is already applied. No schema changes or duplicate migration were
submitted: its `CREATE FUNCTION` statements would conflict with the existing
functions. Direct catalog reads confirmed both deployed definitions match the
source migration, including byte-for-byte equality of each function body.

| Check | `stage_adventure_scene` | `start_adventure_scene_encounter` |
| --- | --- | --- |
| Exists with argument `payload jsonb` | Pass | Pass |
| Return type | `jsonb` | `uuid` |
| Exact function body matches migration | Pass | Pass |
| Language is PL/pgSQL | Pass | Pass |
| Security invoker | Pass | Pass |
| Search path is exactly `public` | Pass | Pass |
| PUBLIC and anon execution denied | Pass | Pass |
| authenticated and service_role execution allowed | Pass | Pass |

The matched bodies retain campaign ownership checks, campaign and mission locks,
active Job/beat validation, staging location/template validation, and delegation
to the existing authored-scene and persisted-encounter functions.

## Validation and limits

- Focused Vitest run: exit 0, 28 tests passed across four files:
  `adventureScene.test.ts`, `adventureEncounter.test.ts`, `sceneOps.test.ts`,
  and `adventureSceneProof.test.ts`.
- Preview build log at 18:10:26 UTC reported `build OK` before documentation edits.
- This verifies deployed catalog definitions and grants, not an authenticated
  live campaign flow. No player records were modified.
- Fresh database replay was not rerun because no schema change was necessary.
- Checkout was clean on branch `main`; the Lovable remote was inspected locally.
  External GitHub PR status was not queried; it is not evidence for this deployed
  schema check.