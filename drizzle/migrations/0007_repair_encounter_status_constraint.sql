-- Live playtesting hit encounters_status_check on a terminal combat save,
-- despite the earlier repair being recorded as applied. The historical narrow
-- constraint reproduces that failure. Reassert the engine/RPC contract forward-only.
-- No active encounter, combatant, roll, or completion receipt is rewritten.
DO $$
BEGIN
  -- Legacy-row normalization can queue the newer deferred completion trigger.
  -- Run it immediately so ALTER TABLE is legal in the same migration transaction.
  SET CONSTRAINTS require_scene_completion IMMEDIATE;
  UPDATE public.encounters SET status='resolved' WHERE status IN ('fled','abandoned');
  ALTER TABLE public.encounters DROP CONSTRAINT IF EXISTS encounters_status_check;
  ALTER TABLE public.encounters ADD CONSTRAINT encounters_status_check
    CHECK (status IN ('active','friendlies_won','friendlies_lost','resolved'));
  SET CONSTRAINTS require_scene_completion DEFERRED;
END;
$$;