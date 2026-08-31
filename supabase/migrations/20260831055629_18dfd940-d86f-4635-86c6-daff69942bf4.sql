ALTER TABLE public.encounters
  ADD COLUMN IF NOT EXISTS version integer NOT NULL DEFAULT 0;

COMMENT ON COLUMN public.encounters.version IS
  'Optimistic-concurrency token. Rises by one per successful save_encounter_state. A caller may send the version it read; a mismatch refuses the write.';

CREATE OR REPLACE FUNCTION public.save_encounter_state(payload jsonb)
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_encounter uuid := (payload->>'encounter_id')::uuid;
  v_campaign uuid;
  v_entry jsonb;
  v_player jsonb := payload->'player';
  v_changed integer;
  v_cover jsonb;
  v_version integer;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;

  SELECT e.campaign_id, e.cover, e.version INTO v_campaign, v_cover, v_version
  FROM public.encounters e
  JOIN public.campaigns c ON c.id = e.campaign_id
  WHERE e.id = v_encounter AND c.user_id = v_user
  FOR UPDATE OF e;
  IF v_campaign IS NULL THEN RAISE EXCEPTION 'encounter not found'; END IF;

  IF payload ? 'version' THEN
    IF jsonb_typeof(payload->'version') <> 'number' THEN
      RAISE EXCEPTION 'invalid encounter version';
    END IF;
    IF (payload->>'version')::integer <> v_version THEN
      RAISE EXCEPTION 'encounter changed';
    END IF;
  END IF;

  IF payload ? 'cover' THEN
    IF jsonb_typeof(payload->'cover') <> 'object' THEN
      RAISE EXCEPTION 'invalid cover state';
    END IF;
    IF EXISTS (
      SELECT 1 FROM jsonb_each(payload->'cover') AS kv(key, value)
      WHERE jsonb_typeof(kv.value) <> 'number' OR (kv.value)::numeric < 0
    ) THEN RAISE EXCEPTION 'invalid cover state'; END IF;

    SELECT COALESCE(jsonb_object_agg(m.key, to_jsonb(m.value)), '{}'::jsonb)
    INTO v_cover
    FROM (
      SELECT pair.key, MAX(pair.value::numeric) AS value
      FROM (
        SELECT key, value FROM jsonb_each_text(v_cover)
        UNION ALL
        SELECT key, value FROM jsonb_each_text(payload->'cover')
      ) AS pair
      GROUP BY pair.key
    ) AS m;
  END IF;

  IF (payload->>'round')::integer < 1
    OR (payload->>'active_index')::integer < 0
    OR payload->>'status' NOT IN ('active','friendlies_won','friendlies_lost','resolved')
    OR v_player->>'wound_state' NOT IN ('none','light','serious','mortal')
    OR (v_player->>'hp_current')::integer < 0
    OR (v_player->>'mortal_save_failures')::integer < 0
  THEN RAISE EXCEPTION 'invalid encounter state'; END IF;

  UPDATE public.encounters SET
    round = (payload->>'round')::integer,
    active_index = (payload->>'active_index')::integer,
    order_ids = COALESCE(payload->'order_ids', '[]'::jsonb),
    status = payload->>'status',
    cover = v_cover,
    version = v_version + 1
  WHERE id = v_encounter;

  FOR v_entry IN SELECT value FROM jsonb_array_elements(COALESCE(payload->'combatants', '[]'::jsonb))
  LOOP
    IF v_entry->>'wound_state' NOT IN ('none','light','serious','mortal')
      OR (v_entry->>'hp_current')::integer < 0
      OR (v_entry->>'death_save_penalty')::integer < 0
      OR (v_entry->>'sp_head')::integer < 0
      OR (v_entry->>'sp_body')::integer < 0
    THEN RAISE EXCEPTION 'invalid combatant state'; END IF;

    UPDATE public.encounter_combatants SET
      hp_current = (v_entry->>'hp_current')::integer,
      wound_state = v_entry->>'wound_state',
      death_save_penalty = (v_entry->>'death_save_penalty')::integer,
      sp_head = (v_entry->>'sp_head')::integer,
      sp_body = (v_entry->>'sp_body')::integer,
      defeated = (v_entry->>'defeated')::boolean,
      initiative = (v_entry->>'initiative')::integer,
      data = COALESCE(v_entry->'data', '{}'::jsonb)
    WHERE id = (v_entry->>'id')::uuid
      AND encounter_id = v_encounter
      AND campaign_id = v_campaign;
    GET DIAGNOSTICS v_changed = ROW_COUNT;
    IF v_changed <> 1 THEN RAISE EXCEPTION 'combatant not found'; END IF;
  END LOOP;

  UPDATE public.campaign_vitals SET
    hp_current = (v_player->>'hp_current')::integer,
    wound_state = v_player->>'wound_state',
    mortal_save_failures = (v_player->>'mortal_save_failures')::integer
  WHERE campaign_id = v_campaign;
  GET DIAGNOSTICS v_changed = ROW_COUNT;
  IF v_changed <> 1 THEN RAISE EXCEPTION 'campaign vitals not found'; END IF;

  IF NULLIF(v_player->>'head_inventory_id', '') IS NOT NULL THEN
    IF (v_player->>'head_sp')::integer < 0 THEN RAISE EXCEPTION 'invalid head SP'; END IF;
    UPDATE public.campaign_inventory SET current_sp = (v_player->>'head_sp')::integer
    WHERE id = (v_player->>'head_inventory_id')::uuid AND campaign_id = v_campaign;
    GET DIAGNOSTICS v_changed = ROW_COUNT;
    IF v_changed <> 1 THEN RAISE EXCEPTION 'head armor not found'; END IF;
  END IF;

  IF NULLIF(v_player->>'body_inventory_id', '') IS NOT NULL THEN
    IF (v_player->>'body_sp')::integer < 0 THEN RAISE EXCEPTION 'invalid body SP'; END IF;
    UPDATE public.campaign_inventory SET current_sp = (v_player->>'body_sp')::integer
    WHERE id = (v_player->>'body_inventory_id')::uuid AND campaign_id = v_campaign;
    GET DIAGNOSTICS v_changed = ROW_COUNT;
    IF v_changed <> 1 THEN RAISE EXCEPTION 'body armor not found'; END IF;
  END IF;

  IF payload->'ammo' IS NOT NULL AND payload->'ammo' <> 'null'::jsonb THEN
    IF (payload->'ammo'->>'loaded')::integer < 0 THEN RAISE EXCEPTION 'invalid ammunition'; END IF;
    UPDATE public.campaign_inventory SET ammo_loaded = (payload->'ammo'->>'loaded')::integer
    WHERE id = (payload->'ammo'->>'inventory_id')::uuid AND campaign_id = v_campaign;
    GET DIAGNOSTICS v_changed = ROW_COUNT;
    IF v_changed <> 1 THEN RAISE EXCEPTION 'weapon not found'; END IF;
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.save_encounter_state(jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.save_encounter_state(jsonb) TO authenticated, service_role;