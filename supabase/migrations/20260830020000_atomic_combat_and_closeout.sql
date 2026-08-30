-- Keep live combat and job closeout from exposing half-applied state.
-- These are deliberately purpose-built transaction boundaries: the pure engine
-- still decides every value, while SECURITY INVOKER and RLS keep ownership at
-- the same database boundary used by ordinary table writes.

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
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;

  SELECT e.campaign_id INTO v_campaign
  FROM public.encounters e
  JOIN public.campaigns c ON c.id = e.campaign_id
  WHERE e.id = v_encounter AND c.user_id = v_user
  FOR UPDATE OF e;
  IF v_campaign IS NULL THEN RAISE EXCEPTION 'encounter not found'; END IF;

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
    status = payload->>'status'
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

CREATE OR REPLACE FUNCTION public.settle_job(payload jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_campaign uuid := (payload->>'campaign_id')::uuid;
  v_job_event uuid := (payload->>'job_event_id')::uuid;
  v_mission text := payload->>'mission_id';
  v_phase text;
  v_current_mission text;
  v_start_seq bigint;
  v_existing record;
  v_event uuid;
  v_entry jsonb;
  v_paid integer := (payload->'payment'->>'paid')::integer;
  v_agreed integer := (payload->'payment'->>'agreed')::integer;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;

  SELECT phase, current_mission_id INTO v_phase, v_current_mission
  FROM public.campaigns
  WHERE id = v_campaign AND user_id = v_user
  FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'campaign not found'; END IF;

  SELECT seq INTO v_start_seq
  FROM public.campaign_events
  WHERE id = v_job_event AND campaign_id = v_campaign AND type = 'mission_started';
  IF v_start_seq IS NULL OR v_current_mission IS DISTINCT FROM v_mission
    OR v_job_event IS DISTINCT FROM (
      SELECT id FROM public.campaign_events
      WHERE campaign_id = v_campaign AND type = 'mission_started'
      ORDER BY seq DESC LIMIT 1
    )
  THEN RAISE EXCEPTION 'job boundary does not match the active mission'; END IF;

  SELECT id, data INTO v_existing
  FROM public.campaign_events
  WHERE campaign_id = v_campaign AND type = 'job_settled' AND seq > v_start_seq
  ORDER BY seq ASC LIMIT 1;
  IF FOUND THEN
    RETURN jsonb_build_object(
      'event_id', v_existing.id,
      'receipt', v_existing.data,
      'already_settled', true
    );
  END IF;

  IF v_phase <> 'job' THEN RAISE EXCEPTION 'campaign is not in the job phase'; END IF;
  IF v_paid < 0 OR v_agreed < 0 OR v_paid > v_agreed THEN
    RAISE EXCEPTION 'invalid payment';
  END IF;

  FOR v_entry IN SELECT value FROM jsonb_array_elements(COALESCE(payload->'npcs', '[]'::jsonb))
  LOOP
    IF (v_entry->>'disposition')::integer NOT BETWEEN -3 AND 3 THEN
      RAISE EXCEPTION 'invalid NPC disposition';
    END IF;
    IF NULLIF(v_entry->>'id', '') IS NOT NULL THEN
      UPDATE public.campaign_npcs SET
        name = v_entry->>'name', disposition = (v_entry->>'disposition')::integer
      WHERE id = (v_entry->>'id')::uuid AND campaign_id = v_campaign;
      IF NOT FOUND THEN RAISE EXCEPTION 'NPC not found'; END IF;
    ELSE
      UPDATE public.campaign_npcs SET
        name = v_entry->>'name',
        disposition = (v_entry->>'disposition')::integer,
        data = COALESCE(v_entry->'data', data)
      WHERE id = (
        SELECT id FROM public.campaign_npcs
        WHERE campaign_id = v_campaign AND npc_id = v_entry->>'npc_key'
        ORDER BY id LIMIT 1
      );
      IF NOT FOUND THEN
        INSERT INTO public.campaign_npcs (campaign_id, npc_id, name, disposition, data)
        VALUES (
          v_campaign, v_entry->>'npc_key', v_entry->>'name',
          (v_entry->>'disposition')::integer, COALESCE(v_entry->'data', '{}'::jsonb)
        );
      END IF;
    END IF;
  END LOOP;

  FOR v_entry IN SELECT value FROM jsonb_array_elements(COALESCE(payload->'situations', '[]'::jsonb))
  LOOP
    INSERT INTO public.campaign_situations
      (campaign_id, situation_key, category, title, summary, npc_key, severity, due_day, data)
    VALUES (
      v_campaign, v_entry->>'situation_key', v_entry->>'category', v_entry->>'title',
      v_entry->>'summary', v_entry->>'npc_key', (v_entry->>'severity')::integer,
      (v_entry->>'due_day')::integer, COALESCE(v_entry->'data', '{}'::jsonb)
    )
    ON CONFLICT (campaign_id, situation_key) DO UPDATE SET
      category = EXCLUDED.category, title = EXCLUDED.title, summary = EXCLUDED.summary,
      npc_key = EXCLUDED.npc_key, severity = EXCLUDED.severity, due_day = EXCLUDED.due_day,
      data = EXCLUDED.data, status = 'live';
  END LOOP;

  FOR v_entry IN SELECT value FROM jsonb_array_elements(COALESCE(payload->'clocks', '[]'::jsonb))
  LOOP
    IF (v_entry->>'filled')::integer < 0
      OR (v_entry->>'filled')::integer > (v_entry->>'segments')::integer
    THEN RAISE EXCEPTION 'invalid clock'; END IF;
    INSERT INTO public.campaign_clocks
      (campaign_id, clock_key, label, filled, segments, hidden, data)
    VALUES (
      v_campaign, v_entry->>'clock_key', v_entry->>'label',
      (v_entry->>'filled')::integer, (v_entry->>'segments')::integer,
      (v_entry->>'hidden')::boolean, COALESCE(v_entry->'data', '{}'::jsonb)
    )
    ON CONFLICT (campaign_id, clock_key) DO UPDATE SET
      label = EXCLUDED.label, filled = EXCLUDED.filled, segments = EXCLUDED.segments,
      hidden = EXCLUDED.hidden, data = EXCLUDED.data;
  END LOOP;

  FOR v_entry IN SELECT value FROM jsonb_array_elements(COALESCE(payload->'factions', '[]'::jsonb))
  LOOP
    IF (v_entry->>'standing')::integer NOT BETWEEN -10 AND 10 THEN
      RAISE EXCEPTION 'invalid faction standing';
    END IF;
    INSERT INTO public.campaign_factions (campaign_id, faction_id, name, standing)
    VALUES (
      v_campaign, v_entry->>'faction_id', v_entry->>'name',
      (v_entry->>'standing')::integer
    )
    ON CONFLICT (campaign_id, faction_id) DO UPDATE SET
      name = EXCLUDED.name, standing = EXCLUDED.standing;
  END LOOP;

  INSERT INTO public.campaign_flags (campaign_id, flag, value)
  VALUES (v_campaign, 'campaign_tally', COALESCE(payload->'tally', '{}'::jsonb))
  ON CONFLICT (campaign_id, flag) DO UPDATE SET value = EXCLUDED.value;

  UPDATE public.campaign_vitals
  SET eurobucks = eurobucks + v_paid
  WHERE campaign_id = v_campaign;
  IF NOT FOUND THEN RAISE EXCEPTION 'campaign vitals not found'; END IF;

  INSERT INTO public.campaign_events (campaign_id, type, summary, beat_id, data)
  VALUES (
    v_campaign, 'mission_completed', payload->'completion'->>'summary',
    payload->'completion'->>'beat_id',
    COALESCE(payload->'completion'->'data', '{}'::jsonb)
  );

  INSERT INTO public.campaign_events (campaign_id, type, summary, roll, data)
  VALUES (
    v_campaign, 'job_settled', payload->>'summary', payload->'roll',
    COALESCE(payload->'receipt', '{}'::jsonb)
  ) RETURNING id INTO v_event;

  UPDATE public.campaigns SET phase = 'aftermath' WHERE id = v_campaign;
  RETURN jsonb_build_object(
    'event_id', v_event, 'receipt', COALESCE(payload->'receipt', '{}'::jsonb),
    'already_settled', false
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.close_aftermath(payload jsonb)
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_campaign uuid := (payload->>'campaign_id')::uuid;
  v_phase text;
  v_name text;
  v_luck integer := (payload->>'luck_current')::integer;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  IF v_luck < 0 THEN RAISE EXCEPTION 'invalid Luck pool'; END IF;

  SELECT c.phase, ch.name INTO v_phase, v_name
  FROM public.campaigns c
  JOIN public.characters ch ON ch.id = c.character_id
  WHERE c.id = v_campaign AND c.user_id = v_user
  FOR UPDATE OF c;
  IF NOT FOUND THEN RAISE EXCEPTION 'campaign not found'; END IF;
  IF v_phase = 'life' THEN RETURN; END IF;
  IF v_phase <> 'aftermath' THEN RAISE EXCEPTION 'campaign is not in aftermath'; END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.campaign_events
    WHERE campaign_id = v_campaign
      AND type = 'job_settled'
      AND seq > COALESCE((
        SELECT max(seq) FROM public.campaign_events
        WHERE campaign_id = v_campaign AND type = 'mission_started'
      ), 0)
  ) THEN RAISE EXCEPTION 'job has not been settled'; END IF;

  UPDATE public.campaigns SET
    current_mission_id = NULL, ip_awarded = NULL, status = 'active', phase = 'life'
  WHERE id = v_campaign;
  UPDATE public.campaign_vitals SET luck_current = v_luck WHERE campaign_id = v_campaign;
  IF NOT FOUND THEN RAISE EXCEPTION 'campaign vitals not found'; END IF;
  INSERT INTO public.campaign_flags (campaign_id, flag, value)
  VALUES (v_campaign, 'current_job_payout', '0'::jsonb)
  ON CONFLICT (campaign_id, flag) DO UPDATE SET value = EXCLUDED.value;
  INSERT INTO public.campaign_events (campaign_id, type, summary, data)
  VALUES (
    v_campaign, 'phase_changed', v_name || ' goes back to the street.',
    jsonb_build_object('phase', 'life')
  );
END;
$$;

REVOKE ALL ON FUNCTION public.save_encounter_state(jsonb) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.settle_job(jsonb) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.close_aftermath(jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.save_encounter_state(jsonb) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.settle_job(jsonb) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.close_aftermath(jsonb) TO authenticated, service_role;
