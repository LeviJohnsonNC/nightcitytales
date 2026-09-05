-- ===========================================================================
-- The status no fight could ever end on.
--
-- `save_encounter_state` validates the payload against
-- ('active','friendlies_won','friendlies_lost','resolved') and then writes it
-- straight into `encounters.status`. That column's CHECK allows
-- ('active','resolved','fled','abandoned'). The two lists overlap on exactly
-- two values, and neither of the two the engine actually produces at the end
-- of a fight is one of them.
--
-- So every fight worked until somebody won it. The last save of the encounter
-- — the one carrying friendlies_won or friendlies_lost — was refused by the
-- constraint, and the raw Postgres error surfaced in the player's Resolve
-- Action panel:
--
--   new row for relation "encounters" violates check constraint
--   "encounters_status_check"
--
-- WHERE THE TWO LISTS CAME FROM. `encounters` is created TWICE in this history
-- — 20260823024230 with the friendlies_* list, and 20260823033846 with the
-- resolved/fled/abandoned one. The later definition is the one that exists.
-- This is the same duplicate-object drift that 20260901120000 fixed for
-- `encounter_combatants`, and that AGENTS.md warns about, landing a second
-- time in the same pair of migrations.
--
-- WHICH LIST WINS. The engine's, because it is the one with meaning in it:
-- engine/encounter.ts types EncounterStatus as active | friendlies_won |
-- friendlies_lost, and outcome() is what decides between the last two. Keeping
-- the narrow constraint would mean mapping a real outcome down to "resolved" on
-- the way out and losing who won. `resolved` stays because the /combat harness
-- writes it when it tears a seeded fight down.
--
-- `fled` and `abandoned` are dropped. Nothing in the codebase has ever written
-- either, and the UPDATE below is a no-op on a database where nothing has —
-- but it is there so that adding the constraint cannot fail on a hand-edited
-- row somewhere.
-- ===========================================================================

UPDATE public.encounters
  SET status = 'resolved'
  WHERE status IN ('fled', 'abandoned');

ALTER TABLE public.encounters
  DROP CONSTRAINT IF EXISTS encounters_status_check;

ALTER TABLE public.encounters
  ADD CONSTRAINT encounters_status_check
  CHECK (status IN ('active', 'friendlies_won', 'friendlies_lost', 'resolved'));
