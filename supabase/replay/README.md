# Migration replay

Can the migrations build a working database from nothing? `AGENTS.md` said "do
not assume a clean database reset works" from the day the encounter-save outage
was diagnosed, and nothing could check it, because CI had no database.

It checks now, on every pull request.

```sh
PGURL=postgres://postgres@localhost:5432/replay supabase/replay/replay.sh
```

| File                   | What it is                                                                                                                                                                                                             |
| ---------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `00_supabase_shim.sql` | The Supabase surface the migrations stand on — the roles they grant to, `auth.uid()`, `auth.users`, `storage.objects` and `storage.foldername`. Derived from what the migrations actually use, not a general emulator. |
| `baseline.sql`         | The schema as the deployed database has it, through `20260912141314`.                                                                                                                                                  |
| `replay.sh`            | Shim, baseline, then every migration added after the baseline. The CI gate.                                                                                                                                            |
| `rebuild-baseline.sh`  | How `baseline.sql` was made, so it is checkable and can be moved forward.                                                                                                                                              |

## Why it starts from a baseline

Because the migration directory is not a runnable sequence, and was never going
to become one.

It holds **five pairs** where the same DDL was written by hand and then applied
again through the Lovable console, which wrote its own timestamped copy into the
directory. Only one of each pair ever ran. `APPLIED.md` already recorded this for
the two most recent pairs — _"the copy that was actually applied. Identical DDL
to the entry above."_ — and the older three were never annotated.

| Written, then superseded | Superseded by    | Objects                              |
| ------------------------ | ---------------- | ------------------------------------ |
| `20260823002741`         | `20260823033846` | `campaigns`, `mission_progress`      |
| `20260823024230`         | `20260823033846` | `encounters`, `encounter_combatants` |
| `20260830211754`         | `20260830160000` | `campaign_cyberware`                 |
| `20260904132122`         | `20260904030000` | `campaign_places`                    |
| `20260912141314`         | `20260912140000` | `campaign_truths`                    |

Four of the five pairs carry identical DDL, so which one ran changes nothing.
**The second pair is the one that mattered**, because the two disagree:
`20260823024230` creates `encounter_combatants` **with** a `campaign_id` and
`20260823033846` creates it **without**.

The deployed database has the version without — which is exactly why
`save_encounter_state` failed on every call from `20260830020000` until
`20260901120000`, persisting no movement, no damage, no hostile turns and no
ending, and failing silently the whole time. The outage is the evidence for
which file won, and the baseline is built accordingly.

## Why you can believe the baseline

It is not a hand-written guess. `rebuild-baseline.sh` applies every migration in
order with those five skipped, and the result was checked column by column
against `src/integrations/supabase/types.ts` — which is generated from the
deployed database, and so is the only independent evidence available:

```
24 tables declared, 24 produced, 0 column differences
```

Including `encounter_combatants` arriving with no `campaign_id`, which is the
one column the outage already told us about.

## What this does and does not prove

**Does:** that a fresh database can be built, that every migration added from
here on applies cleanly onto the real schema, and that a function or constraint
naming a column that does not exist fails loudly instead of at 3am. That is the
bug class this exists for.

**Does not:** that the RLS policies are _correct_. They apply; whether they say
the right thing is a different question and wants a different test.

## Moving the baseline forward

When a batch of migrations has been applied to the deployed database:

1. `PGURL=... supabase/replay/rebuild-baseline.sh` — it refuses to dump if the
   superseded list has gone stale.
2. Dump the schema as the script prints, keep `baseline.sql`'s header.
3. Check it against `types.ts` again.
4. Move `BASELINE_THROUGH` in `replay.sh` to the newest stem now inside it.

`baseline.sql` deliberately lives here rather than in `supabase/migrations/`.
The deployed database is already in this state; nothing should ever apply it
there.
