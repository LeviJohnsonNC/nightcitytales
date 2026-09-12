#!/usr/bin/env bash
#
# Build the database from scratch and prove the result is what the application
# expects: the shim, then the baseline, then every migration added after it.
#
# WHAT THIS ANSWERS. `AGENTS.md` carried this warning for months:
#
#   "campaign/encounter objects are created more than once in the current
#    migration history, and the generated types match the later schema rather
#    than all earlier migrations. Do not assume a clean database reset works
#    until this has been reconciled."
#
# Nothing could check it, because CI has no database. This is the check. It is
# the same bug class that took encounter saves down — a function filtering on
# `encounter_combatants.campaign_id` that the surviving CREATE TABLE never made,
# silent because the type checker does not read inside a SQL string.
#
# WHY A BASELINE. The migration directory cannot replay: it holds five pairs
# where the same DDL was written by hand and then applied again through the
# Lovable console, which wrote its own copy into the directory. Only one of each
# ever ran, so the directory is a truthful record of what was WRITTEN and not a
# runnable sequence. `baseline.sql` is the state those migrations actually
# produced — verified column by column against the generated types — and
# everything added after it replays on top. The history behind that line is not
# going to become replayable; the migrations in front of it are what still need
# testing, and now they get it.
#
# USAGE
#   PGURL=postgres://postgres@localhost:5432/replay supabase/replay/replay.sh
#
# Exits non-zero if anything fails to apply.

set -uo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
MIGRATIONS="$HERE/../migrations"

# Everything at or before this stem is inside baseline.sql. Move it forward when
# a batch of migrations has been applied to the deployed database and the
# baseline is rebuilt — see rebuild-baseline.sh.
BASELINE_THROUGH="20260912141314"

if [ -z "${PGURL:-}" ]; then
  echo "Set PGURL to a Postgres connection string for an empty, disposable database." >&2
  echo "  e.g. PGURL=postgres://postgres@localhost:5432/replay $0" >&2
  exit 2
fi

run() { psql "$PGURL" -v ON_ERROR_STOP=1 -q -f "$1" 2>&1; }

for stage in 00_supabase_shim.sql baseline.sql; do
  if ! out=$(run "$HERE/$stage"); then
    echo "FAIL $stage — this is a bug in the harness or a stale baseline" >&2
    echo "$out" | grep -m3 "ERROR:" >&2
    exit 1
  fi
  echo "ok   $stage"
done

failed=0
applied=0
for file in $(ls "$MIGRATIONS"/*.sql | sort); do
  name="$(basename "$file")"
  stem="$(echo "$name" | cut -c1-14)"
  # String comparison is safe here: the stems are fixed-width timestamps.
  [[ "$stem" > "$BASELINE_THROUGH" ]] || continue

  if out=$(run "$file"); then
    applied=$((applied + 1))
    echo "ok   $name"
  else
    failed=$((failed + 1))
    echo "FAIL $name"
    echo "$out" | grep -m1 "ERROR:" | sed 's/.*ERROR:/     ERROR:/'
  fi
done

echo
if [ "$applied" -eq 0 ] && [ "$failed" -eq 0 ]; then
  echo "Baseline applied; no migrations after $BASELINE_THROUGH."
else
  echo "Baseline applied; $applied migrations after it, $failed failed."
fi
[ "$failed" -eq 0 ] || exit 1
