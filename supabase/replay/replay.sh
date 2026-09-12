#!/usr/bin/env bash
#
# Replay every migration against an empty database, in the order the directory
# sorts, and report what breaks.
#
# WHAT THIS ANSWERS. `AGENTS.md` has carried this warning for months:
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
# USAGE
#   supabase/replay/replay.sh                 # starts its own Postgres if it can
#   PGURL=postgres://... supabase/replay/replay.sh
#
# It exits non-zero if any migration fails. See README.md in this directory for
# what it currently reports and why that is not yet wired into CI as blocking.

set -uo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
MIGRATIONS="$HERE/../migrations"
SHIM="$HERE/00_supabase_shim.sql"

if [ -z "${PGURL:-}" ]; then
  echo "Set PGURL to a Postgres connection string for an empty, disposable database." >&2
  echo "  e.g. PGURL=postgres://postgres@localhost:5432/replay $0" >&2
  exit 2
fi

run() { psql "$PGURL" -v ON_ERROR_STOP=1 -q -f "$1" 2>&1; }

echo "Shim: $(basename "$SHIM")"
if ! out=$(run "$SHIM"); then
  echo "  the shim itself failed — that is a bug in the harness, not in a migration" >&2
  echo "$out" >&2
  exit 1
fi

failed=0
applied=0
for file in $(ls "$MIGRATIONS"/*.sql | sort); do
  name="$(basename "$file")"
  if out=$(run "$file"); then
    applied=$((applied + 1))
  else
    failed=$((failed + 1))
    echo "FAIL $name"
    echo "$out" | grep -m1 "ERROR:" | sed 's/.*ERROR:/     ERROR:/'
  fi
done

echo
echo "$applied applied, $failed failed."
[ "$failed" -eq 0 ] || exit 1
