-- ===========================================================================
-- Where a fight is happening.
--
-- Range IS the Difficulty Value in Cyberpunk RED: the printed table turns
-- metres into a DV, so whoever writes the metres sets the difficulty. That was
-- the GM model, one field at a time, in the moment, invisibly.
--
-- Combatants now carry an (x, y) in metres inside encounter_combatants.data
-- (no schema change needed there), and the arena is the ground they stand on:
-- it decides where everyone starts, and it bounds where anyone can move to.
-- It belongs to the encounter rather than to any one combatant.
--
-- Nullable on purpose. A fight already in progress when this lands has no
-- arena, reads as open ground, and keeps going.
-- ===========================================================================
ALTER TABLE public.encounters
  ADD COLUMN IF NOT EXISTS arena text;

COMMENT ON COLUMN public.encounters.arena IS
  'Key from the engine''s closed ARENAS list (src/engine/battlefield.ts). Null reads as open ground.';

-- ===========================================================================
-- start_encounter carries the arena through.
--
-- Extracted verbatim from its current definition (20260823033846) and patched
-- in exactly one place: the encounters INSERT gains the arena column and its
-- value. Everything else — the auth check, the ownership check, the combatant
-- loop — is byte-identical to what is already deployed.
-- ===========================================================================
CREATE OR REPLACE FUNCTION public.start_encounter(payload jsonb)
RETURNS uuid LANGUAGE plpgsql SET search_path TO 'public' AS $$
DECLARE
  v_user uuid := auth.uid();
  v_campaign uuid := (payload->>'campaign_id')::uuid;
  v_encounter uuid;
  v_entry jsonb;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.campaigns WHERE id = v_campaign AND user_id = v_user) THEN
    RAISE EXCEPTION 'campaign not found';
  END IF;

  INSERT INTO public.encounters (campaign_id, name, beat_id, active_index, order_ids, arena)
  VALUES (
    v_campaign,
    payload->>'name',
    payload->>'beat_id',
    coalesce((payload->>'active_index')::int, 0),
    coalesce(payload->'order_ids', '[]'::jsonb),
    payload->>'arena'
  )
  RETURNING id INTO v_encounter;

  FOR v_entry IN SELECT * FROM jsonb_array_elements(coalesce(payload->'combatants', '[]'::jsonb)) LOOP
    INSERT INTO public.encounter_combatants
    SELECT * FROM jsonb_populate_record(
      NULL::public.encounter_combatants,
      v_entry || jsonb_build_object('encounter_id', v_encounter)
    );
  END LOOP;

  RETURN v_encounter;
END;
$$;