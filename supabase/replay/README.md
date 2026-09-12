# Migration replay

Can the migrations in `supabase/migrations/` build a working database from
nothing? `AGENTS.md` has said "do not assume a clean database reset works" since
the encounter-save outage, and nothing could check it because CI has no
database.

`replay.sh` checks it. `00_supabase_shim.sql` is the small Supabase surface the
migrations stand on — the roles they grant to, `auth.uid()`, `auth.users`, and
the `storage` objects the portrait policies reference — derived from what the
migrations actually use rather than from a general-purpose emulator.

```sh
PGURL=postgres://postgres@localhost:5432/replay supabase/replay/replay.sh
```

## What it reports today

**The replay does not pass.** Nine migrations fail. Five are the real finding;
four are knock-on effects of those five.

### Duplicate object creation

| Migration        | Error                                                               |
| ---------------- | ------------------------------------------------------------------- |
| `20260823033846` | `relation "campaigns" already exists`                               |
| `20260823033944` | `column "created_at" of relation "mission_progress" already exists` |
| `20260830211754` | `relation "campaign_cyberware" already exists`                      |
| `20260904132122` | `relation "campaign_places" already exists`                         |
| `20260912141314` | `relation "campaign_truths" already exists`                         |

### Knock-on

| Migration        | Error                              | Because                                                               |
| ---------------- | ---------------------------------- | --------------------------------------------------------------------- |
| `20260825233000` | `column "standing" does not exist` | `campaign_factions` was never created — it is inside `20260823033846` |
| `20260826010427` | `column "standing" does not exist` | same                                                                  |
| `20260826190000` | `column "kind" does not exist`     | inventory columns from a skipped file                                 |
| `20260826193435` | `column "kind" does not exist`     | same                                                                  |

## Why this is not a pile of mistakes

It is the shape of the Lovable workflow, and `APPLIED.md` already records it for
the recent cases:

> `20260912141314_…` — the copy that was actually applied. Identical DDL to the
> entry above.

A migration gets written by hand and committed; the same DDL is then applied
through the Lovable console, which writes its own timestamped copy into the
directory. Both files exist. **Only one of them ever ran.** So the deployed
database is correct and the _directory_ is not replayable, which is a different
problem from the one it looks like.

The three recent pairs are annotated in `APPLIED.md`. The early pair is not, and
it is the one with history:

- `20260823024230` creates `encounters` and `encounter_combatants` **with** a
  `campaign_id`.
- `20260823033846` creates both again **without** it, plus eight other tables.

The deployed database has the second version — which is exactly why
`save_encounter_state` filtering on `campaign_id` failed on every call until
`20260901120000`. The outage is the evidence for which file won.

## What is undecided

Making the replay pass means reconciling the directory with what actually ran,
and every route touches published history, which `AGENTS.md` warns against:

1. **Mark superseded files and have the replay skip them.** Smallest change and
   no rewrite: extend `APPLIED.md`'s existing "the copy that was actually
   applied" annotation to the early pair, and teach `replay.sh` to read it. The
   directory stays a truthful record of what was written; the replay follows
   what was run.
2. **Make the duplicate creations idempotent** (`CREATE TABLE IF NOT EXISTS`).
   Inert against the deployed database, since those migrations have already
   run — but it edits files that Lovable has published.
3. **Squash to a baseline.** Snapshot the current deployed schema as
   `0000_baseline.sql` and replay only migrations after it. Standard answer,
   biggest change, and it discards the written history as a runnable thing.

Option 1 is the recommendation and is not yet done, because which files were
superseded is a claim about the deployed database that wants confirming rather
than inferring.

Until one of those lands, this is a script you run by hand, not a CI gate.
Wiring a known-red check into CI would only teach people to ignore it.
