# Investigation report: spend_ip_on_skill migration and types

## 1. Migration — NOT applied

The file `supabase/migrations/20260823235600_spend_ip_on_skill.sql` exists in the repo, but the function does not exist in the live database. Query result:

```text
select proname, pg_get_function_identity_arguments(oid)
from pg_proc where proname = 'spend_ip_on_skill';
-> 0 rows
```

No function, therefore no GRANT either. Every "Raise" click in the Spend I.P. card currently fails at runtime with a missing-function error.

## 2. Generated types — the hand edit is gone, not stale

`src/integrations/supabase/types.ts` currently contains **no** `spend_ip_on_skill` entry. Its `Functions` union is `owns_campaign | owns_character | owns_encounter | save_character | start_campaign | start_encounter` — which matches the live schema exactly. So the hand edit was overwritten by a later regeneration from the live (function-less) schema; it is not a lingering hand-edit that needs cleaning up.

Consequence, confirmed by typecheck (`tsgo`):

```text
src/lib/backend/characters.ts(204,51): TS2345 '"spend_ip_on_skill"' is not assignable to ...
src/lib/backend/characters.ts(212,10): TS2352 Conversion of 'string | boolean' to 'number' ...
```

Two pre-existing typecheck errors on main. Tests are unaffected: **336 passed / 41 files** (the engine tests are pure and don't touch the RPC).

## 3. How migrations normally work here

Migrations are applied through the platform's migration tool, with your approval, at the time they are authored. A `.sql` file that arrives via a GitHub commit sync is **just a file** — nothing scans `supabase/migrations/` and runs it. That is exactly what happened here: the file landed, the function never did.

`types.ts` is regenerated automatically, but only *after* a migration is applied through the tool — it is generated from the live schema, so regenerating before applying just reproduces the current (missing) signature. Hand-editing it is always temporary; the next regeneration wipes it.

Practical rule: migrations authored in-chat need no manual step from you beyond approving the migration card. Migrations that arrive as files from an outside commit do need one — tell me and I'll submit them.

## What I propose to do

1. Submit `20260823235600_spend_ip_on_skill.sql` as a migration, byte-for-byte as written — same `FOR UPDATE` row lock, same server-side balance/cost recheck, same "exactly one level above current" guard, same GRANT to `authenticated`. No rewrites.
2. After it applies, `types.ts` regenerates and should gain:
   `spend_ip_on_skill: { Args: { p_character_id: string; p_skill_id: string; p_new_level: number; p_cost: number; p_specialization?: string }; Returns: number }`
   I'll report the exact regenerated signature and diff it against what the hand edit claimed.
3. Verify `src/lib/backend/characters.ts` — `spendIpOnSkill()` sends `p_character_id`, `p_skill_id`, `p_new_level`, `p_cost`, `p_specialization`, which match the SQL parameter names; expected to need no change, and both typecheck errors should clear on their own.
4. Re-run tests and typecheck and report.

No application code changes are planned unless step 3 turns up a mismatch.
