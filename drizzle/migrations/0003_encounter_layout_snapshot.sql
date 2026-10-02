-- Freeze a scene-backed encounter's geometry and material HP at entry.
-- Legacy rows remain NULL and retain their authored-arena compatibility path.
ALTER TABLE public.encounters ADD COLUMN layout jsonb;
ALTER TABLE public.encounters ADD CONSTRAINT encounters_layout_shape CHECK (
  layout IS NULL OR COALESCE(
    jsonb_typeof(layout) = 'object'
    AND layout->'version' = '1'::jsonb
    AND jsonb_typeof(layout->'arena') = 'object'
    AND jsonb_typeof(layout->'arena'->'cover') = 'array'
    AND jsonb_typeof(layout->'arena'->'hostileSlots') = 'array'
    AND octet_length(layout::text) <= 65536,
    false)
);

-- The resolved layout is immutable after entry. Only cover damage and actor
-- positions change; templates cannot move a parked car during an active fight.
CREATE FUNCTION public.keep_encounter_layout() RETURNS trigger
LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.layout IS DISTINCT FROM OLD.layout THEN
    RAISE EXCEPTION 'encounter layout is immutable';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER encounters_keep_layout BEFORE UPDATE OF layout ON public.encounters
FOR EACH ROW EXECUTE FUNCTION public.keep_encounter_layout();

CREATE OR REPLACE FUNCTION public.start_encounter(payload jsonb)
RETURNS uuid LANGUAGE plpgsql SET search_path TO 'public' AS $$
DECLARE
  v_user uuid := auth.uid();
  v_campaign uuid := (payload->>'campaign_id')::uuid;
  v_encounter uuid;
  v_entry jsonb;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  PERFORM 1 FROM public.campaigns WHERE id = v_campaign AND user_id = v_user FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'campaign not found'; END IF;
  IF EXISTS (SELECT 1 FROM public.encounters WHERE campaign_id = v_campaign AND status = 'active') THEN
    RAISE EXCEPTION 'campaign already has an active encounter';
  END IF;

  INSERT INTO public.encounters (campaign_id, name, beat_id, active_index, order_ids, arena, layout)
  VALUES (
    v_campaign,
    payload->>'name',
    payload->>'beat_id',
    coalesce((payload->>'active_index')::int, 0),
    coalesce(payload->'order_ids', '[]'::jsonb),
    payload->>'arena',
    NULLIF(payload->'layout', 'null'::jsonb)
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
    IF jsonb_typeof(payload->'version') <> 'number' THEN
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
END;
$$;
REVOKE ALL ON FUNCTION public.save_encounter_state(jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.save_encounter_state(jsonb) TO authenticated, service_role;

-- A distinct capability endpoint prevents old databases from silently ignoring
-- a new client's layout field and creating a fight on fallback geometry.
CREATE FUNCTION public.start_snapshot_encounter(payload jsonb) RETURNS uuid
LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
BEGIN
  IF payload->'layout' IS NULL OR payload->'layout' = 'null'::jsonb THEN
    RAISE EXCEPTION 'battlefield snapshot is required';
  END IF;
  RETURN public.start_encounter(payload);
END;
$$;
REVOKE ALL ON FUNCTION public.start_snapshot_encounter(jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.start_snapshot_encounter(jsonb) TO authenticated, service_role;