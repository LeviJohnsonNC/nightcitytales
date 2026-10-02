-- A lifecycle-enabled snapshot commits its entry and ending receipts with state.
-- Existing snapshots keep their previous protocol until their fight ends.
ALTER TABLE public.encounters ADD COLUMN origin jsonb;
ALTER TABLE public.encounters ADD COLUMN entry_command_id uuid;
ALTER TABLE public.encounters ADD COLUMN entry_payload_hash text;
ALTER TABLE public.encounters ADD COLUMN last_command jsonb;
CREATE UNIQUE INDEX encounters_entry_command ON public.encounters(campaign_id, entry_command_id)
WHERE entry_command_id IS NOT NULL;

CREATE FUNCTION public.keep_encounter_origin() RETURNS trigger
LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF OLD.origin IS NOT NULL AND (NEW.origin IS DISTINCT FROM OLD.origin
    OR NEW.entry_command_id IS DISTINCT FROM OLD.entry_command_id
    OR NEW.entry_payload_hash IS DISTINCT FROM OLD.entry_payload_hash) THEN
    RAISE EXCEPTION 'encounter origin is immutable';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER encounters_keep_origin BEFORE UPDATE ON public.encounters
FOR EACH ROW EXECUTE FUNCTION public.keep_encounter_origin();

CREATE FUNCTION public.start_scene_encounter(payload jsonb) RETURNS uuid
LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
DECLARE
  v_campaign public.campaigns%ROWTYPE;
  v_existing public.encounters%ROWTYPE;
  v_id uuid;
  v_command uuid := (payload->>'command_id')::uuid;
BEGIN
  IF payload->'layout' IS NULL OR payload->'layout' = 'null'::jsonb THEN
    RAISE EXCEPTION 'battlefield snapshot is required';
  END IF;
  IF payload->'lifecycle_version' IS DISTINCT FROM '1'::jsonb OR v_command IS NULL THEN
    RAISE EXCEPTION 'invalid scene entry protocol';
  END IF;
  SELECT * INTO v_campaign FROM public.campaigns
  WHERE id = (payload->>'campaign_id')::uuid AND user_id = auth.uid() FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'campaign not found'; END IF;
  SELECT * INTO v_existing FROM public.encounters
  WHERE campaign_id = v_campaign.id AND entry_command_id = v_command;
  IF FOUND THEN
    IF v_existing.entry_payload_hash <> md5(payload::text) THEN
      RAISE EXCEPTION 'scene entry command was reused';
    END IF;
    RETURN v_existing.id;
  END IF;
  IF v_campaign.status <> 'active' THEN RAISE EXCEPTION 'campaign is not active'; END IF;
  IF payload->'expected_origin' IS DISTINCT FROM jsonb_build_object(
    'phase', v_campaign.phase, 'location', v_campaign.location_key,
    'missionId', v_campaign.current_mission_id) THEN
    RAISE EXCEPTION 'scene origin changed';
  END IF;
  v_id := public.start_encounter(payload);
  UPDATE public.encounters SET origin = jsonb_build_object(
      'version', 1, 'phase', v_campaign.phase, 'location', v_campaign.location_key,
      'missionId', v_campaign.current_mission_id, 'beatId', payload->>'beat_id',
      'source', payload->'scene_source'),
    entry_command_id = v_command, entry_payload_hash = md5(payload::text)
  WHERE id = v_id;
  INSERT INTO public.campaign_events(campaign_id, beat_id, type, summary, data)
  VALUES(v_campaign.id, payload->>'beat_id', 'encounter_started',
    COALESCE(payload->>'name','Combat') || ' — initiative established.',
    jsonb_build_object('encounterId', v_id, 'commandId', v_command));
  RETURN v_id;
END;
$$;

REVOKE ALL ON FUNCTION public.start_scene_encounter(jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.start_scene_encounter(jsonb) TO authenticated, service_role;

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
  v_origin jsonb;
  v_last jsonb;
  v_status text;
  v_event jsonb;
  v_hash text := md5(payload::text);
  v_result jsonb := payload->'completion';
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;

  SELECT e.campaign_id, e.cover, e.version INTO v_campaign, v_cover, v_version
  FROM public.encounters e
  JOIN public.campaigns c ON c.id = e.campaign_id
  WHERE e.id = v_encounter AND c.user_id = v_user
  FOR UPDATE OF e;
  IF v_campaign IS NULL THEN RAISE EXCEPTION 'encounter not found'; END IF;

  SELECT origin, last_command, status INTO v_origin, v_last, v_status
  FROM public.encounters WHERE id = v_encounter;
  IF v_origin IS NOT NULL THEN
    IF payload->'lifecycle_version' IS DISTINCT FROM '1'::jsonb THEN
      RAISE EXCEPTION 'scene encounter requires lifecycle protocol 1';
    END IF;
    -- An exact retry of the latest committed save is a receipt, not another turn.
    IF v_last->'expectedVersion' = payload->'version' THEN
      IF v_last->>'hash' = v_hash THEN RETURN; END IF;
      RAISE EXCEPTION 'encounter changed';
    END IF;
    IF v_status <> 'active' THEN RAISE EXCEPTION 'encounter already completed'; END IF;
    IF payload->>'status' <> 'active' AND NOT COALESCE(
      jsonb_typeof(v_result) = 'object' AND jsonb_typeof(v_result->'summary') = 'string'
      AND v_result->'data'->'sceneResult'->'version' = '1'::jsonb
      AND v_result->'data'->>'encounterId' = v_encounter::text
      AND v_result->'data'->>'status' = payload->>'status', false) THEN
      RAISE EXCEPTION 'scene completion receipt required';
    END IF;
  END IF;

  -- Snapshot encounters are not writable by an old client that re-derived
  -- geometry from the arena key. Both protocol and revision are mandatory.
  IF EXISTS (SELECT 1 FROM public.encounters WHERE id = v_encounter AND layout IS NOT NULL) THEN
    IF payload->'layout_version' IS DISTINCT FROM '1'::jsonb OR NOT (payload ? 'version') THEN
      RAISE EXCEPTION 'battlefield snapshot requires a current client and encounter version';
    END IF;
  END IF;

  -- Optimistic concurrency. Checked under the row lock taken above, so two
  -- concurrent writers are serialised here and the second one sees the first
  -- one's version rather than the one they both read.
  --
  -- Absent means unchecked: a client still running the previous bundle keeps
  -- working. Present and stale is refused, and the caller re-reads.
  IF payload ? 'version' THEN
    IF jsonb_typeof(payload->'version') IS DISTINCT FROM 'number' THEN
      RAISE EXCEPTION 'invalid encounter version';
    END IF;
    IF (payload->>'version')::integer <> v_version THEN
      RAISE EXCEPTION 'encounter changed';
    END IF;
  END IF;

  -- Cover damage is an object of non-negative numbers. WHICH ids are real, and
  -- what a piece's maximum is, the database cannot know: that lives in the
  -- engine's authored arenas and is checked there on read (engine/cover.ts,
  -- coverDamageFrom). Same boundary install_cyberware draws — the transaction
  -- owns shape, ownership and range; TypeScript owns identity and the rules.
  IF payload ? 'cover' THEN
    IF jsonb_typeof(payload->'cover') <> 'object' THEN
      RAISE EXCEPTION 'invalid cover state';
    END IF;
    IF EXISTS (
      SELECT 1 FROM jsonb_each(payload->'cover') AS kv(key, value)
      WHERE jsonb_typeof(kv.value) <> 'number' OR (kv.value)::numeric < 0
    ) THEN RAISE EXCEPTION 'invalid cover state'; END IF;

    -- Element-wise maximum. Cover damage only accumulates, so merging this way
    -- is idempotent and cannot be clobbered by a writer working from a stale
    -- read: the worst a lost update can do is fail to add damage, never remove
    -- it. v_cover is NOT NULL by the column default.
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
    OR ((v_player->>'hp_current')::integer < 0 AND v_player->>'wound_state' <> 'mortal')
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
      OR ((v_entry->>'hp_current')::integer < 0 AND v_entry->>'wound_state' <> 'mortal')
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
      AND encounter_id = v_encounter;
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
  IF v_origin IS NOT NULL THEN
    -- Effects from the NPC resolver are committed after its state, in the same
    -- transaction. No dice trace from a refused stale turn reaches the ledger.
    FOR v_event IN SELECT value FROM jsonb_array_elements(COALESCE(payload->'events', '[]'::jsonb)) LOOP
      IF v_event->>'type' NOT IN ('attack','death_save','morale','cover_damaged') THEN
        RAISE EXCEPTION 'unsupported combat event';
      END IF;
      INSERT INTO public.campaign_events(campaign_id, beat_id, type, summary, data, roll)
      VALUES(v_campaign, (SELECT beat_id FROM public.encounters WHERE id = v_encounter),
        v_event->>'type', v_event->>'summary', COALESCE(v_event->'data','{}'::jsonb), v_event->'roll');
    END LOOP;
    -- Death cannot return an interrupted Life fight to a living input screen.
    IF EXISTS(SELECT 1 FROM public.encounter_combatants WHERE encounter_id=v_encounter
      AND is_player AND defeated AND data->>'exitReason'='dead') THEN
      UPDATE public.campaigns SET status='lost' WHERE id=v_campaign;
    END IF;
    IF payload->>'status' <> 'active' THEN
      INSERT INTO public.campaign_events(campaign_id, beat_id, type, summary, data)
      VALUES(v_campaign, (SELECT beat_id FROM public.encounters WHERE id = v_encounter),
        'encounter_ended', v_result->>'summary', (v_result->'data') || jsonb_build_object(
          'origin', v_origin, 'completionId', v_encounter, 'finalVersion', v_version + 1));
    END IF;
    UPDATE public.encounters SET last_command = jsonb_build_object(
      'expectedVersion', (payload->>'version')::integer, 'hash', v_hash)
    WHERE id = v_encounter;
  END IF;

END;
$$;
REVOKE ALL ON FUNCTION public.save_encounter_state(jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.save_encounter_state(jsonb) TO authenticated, service_role;