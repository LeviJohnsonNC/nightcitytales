#!/usr/bin/env bash
#
# Rebuild baseline.sql from the migration history.
#
# A baseline nobody can regenerate is a blob you have to trust. This is how the
# one in this directory was made, so it can be checked, and so it can be moved
# forward when the next batch of migrations has been applied to the deployed
# database.
#
# It replays every migration in order with the five SUPERSEDED files skipped —
# the pairs where the same DDL was written by hand and applied again through the
# Lovable console, only one of each ever running. See baseline.sql's header for
# which, and for why the encounter pair is the one that mattered.
#
# USAGE
#   PGURL=postgres://postgres@localhost:5432/rebuild supabase/replay/rebuild-baseline.sh
#
# Then check the result against src/integrations/supabase/types.ts before
# committing it — that file is generated from the deployed database, so it is
# the only independent evidence that the baseline matches reality.

set -uo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
MIGRATIONS="$HERE/../migrations"

# Written, then superseded. Each was recreated by a later migration that is the
# one the deployed database actually ran.
SUPERSEDED=(
  20260823002741 # campaigns, mission_progress      -> 20260823033846
  20260823024230 # encounters, encounter_combatants -> 20260823033846
  20260830211754 # campaign_cyberware               -> 20260830160000
  20260904132122 # campaign_places                  -> 20260904030000
  20260912141314 # campaign_truths                  -> 20260912140000
)

if [ -z "${PGURL:-}" ]; then
  echo "Set PGURL to a Postgres connection string for an empty, disposable database." >&2
  exit 2
fi

run() { psql "$PGURL" -v ON_ERROR_STOP=1 -q -f "$1" 2>&1; }

if ! out=$(run "$HERE/00_supabase_shim.sql"); then
  echo "the shim failed — that is a bug in the harness" >&2
  echo "$out" >&2
  exit 1
fi

failed=0
for file in $(ls "$MIGRATIONS"/*.sql | sort); do
  stem="$(basename "$file" | cut -c1-14)"
  skip=0
  for s in "${SUPERSEDED[@]}"; do [ "$stem" = "$s" ] && skip=1; done
  [ "$skip" -eq 1 ] && continue

  if ! out=$(run "$file"); then
    failed=$((failed + 1))
    echo "FAIL $stem"
    echo "$out" | grep -m1 "ERROR:" | sed 's/.*ERROR:/     ERROR:/'
  fi
done

if [ "$failed" -ne 0 ]; then
  echo "$failed migrations failed — the superseded list is out of date. Not dumping." >&2
  exit 1
fi

echo "All migrations applied. Dump the schema with:"
echo "  pg_dump \"\$PGURL\" --schema-only --schema=public --no-owner"
echo "then strip the \\restrict lines and keep baseline.sql's header."
