--
-- The schema as the DEPLOYED database actually has it, as of migration
-- 20260912141314.
--
-- WHY THIS EXISTS. supabase/migrations/ cannot be replayed onto an empty
-- database. It holds five pairs where the same DDL was written by hand and then
-- applied again through the Lovable console, which wrote its own timestamped
-- copy into the directory — only one of each pair ever ran. The directory is a
-- truthful record of what was WRITTEN; it is not a runnable sequence. See
-- README.md in this directory.
--
-- So the replay starts here instead: this file is the state those migrations
-- actually produced, and anything added after 20260912141314 replays on top
-- of it. That makes the next migration testable, which is the point — the
-- history behind this line is not going to become replayable, and pretending
-- otherwise is what left the encounter_combatants drift undetected for weeks.
--
-- HOW IT WAS BUILT, and why you can believe it. Every migration was applied in
-- order with the five superseded files skipped:
--
--   20260823002741  campaigns, mission_progress      superseded by 20260823033846
--   20260823024230  encounters, encounter_combatants superseded by 20260823033846
--   20260830211754  campaign_cyberware               duplicate of 20260830160000
--   20260904132122  campaign_places                  duplicate of 20260904030000
--   20260912141314  campaign_truths                  duplicate of 20260912140000
--
-- The first two are the ones that mattered, because the pair disagrees:
-- 20260823024230 creates encounter_combatants WITH a campaign_id and
-- 20260823033846 creates it without. The deployed database has the version
-- WITHOUT — which is exactly why save_encounter_state failed on every call
-- until 20260901120000. The outage is the evidence for which file won.
--
-- The result was then checked column by column against
-- src/integrations/supabase/types.ts, which is generated from the deployed
-- database: 24 tables, every column, no differences.
--
-- NOT A MIGRATION. This file lives in supabase/replay/ and not in
-- supabase/migrations/ on purpose — the deployed database is already in this
-- state, and nothing should ever apply it there. It is input to replay.sh.
--
-- Regenerate with: supabase/replay/rebuild-baseline.sh
--

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: public; Type: SCHEMA; Schema: -; Owner: -
--

-- (CREATE SCHEMA public omitted: it always exists)


--
-- Name: SCHEMA public; Type: COMMENT; Schema: -; Owner: -
--



--
-- Name: close_aftermath(jsonb); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.close_aftermath(payload jsonb) RETURNS void
    LANGUAGE plpgsql
    SET search_path TO 'public'
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


--
-- Name: install_cyberware(jsonb); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.install_cyberware(payload jsonb) RETURNS jsonb
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
DECLARE
  v_user uuid := auth.uid();
  v_campaign uuid := (payload->>'campaign_id')::uuid;
  v_request uuid := (payload->>'request_id')::uuid;
  v_ripperdoc uuid := (payload->>'ripperdoc_id')::uuid;
  v_phase text;
  v_day integer;
  v_minute integer;
  v_eurobucks integer;
  v_humanity integer;
  v_entry jsonb;
  v_existing jsonb;
  v_hook text := nullif(payload->>'hook_situation_key', '');
  v_hook_title text;
  v_count integer := 0;
  v_loss integer := 0;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;

  SELECT data INTO v_existing
  FROM public.campaign_events
  WHERE id = v_request AND campaign_id = v_campaign AND type = 'cyberware_installed';
  IF FOUND THEN RETURN v_existing; END IF;

  SELECT phase, day, minute INTO v_phase, v_day, v_minute
  FROM public.campaigns
  WHERE id = v_campaign AND user_id = v_user
  FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'campaign not found'; END IF;

  -- A concurrent retry can pass the fast path before the first transaction
  -- commits. Check again after taking the campaign lock so it receives the
  -- original receipt rather than failing expected-state validation.
  SELECT data INTO v_existing
  FROM public.campaign_events
  WHERE id = v_request AND campaign_id = v_campaign AND type = 'cyberware_installed';
  IF FOUND THEN RETURN v_existing; END IF;

  IF v_phase NOT IN ('life','hook') THEN
    RAISE EXCEPTION 'cyberware installation is only available between jobs';
  END IF;

  SELECT eurobucks, humanity_current INTO v_eurobucks, v_humanity
  FROM public.campaign_vitals
  WHERE campaign_id = v_campaign
  FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'campaign vitals not found'; END IF;

  IF v_day <> (payload->'expected'->>'day')::integer
    OR v_minute <> (payload->'expected'->>'minute')::integer
    OR v_eurobucks <> (payload->'expected'->>'eurobucks')::integer
    OR v_humanity <> (payload->'expected'->>'humanity')::integer
  THEN RAISE EXCEPTION 'campaign state changed; plan the installation again'; END IF;

  PERFORM 1 FROM public.campaign_npcs
  WHERE id = v_ripperdoc AND campaign_id = v_campaign
    AND data->>'role' = 'ripperdoc'
  FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'ripperdoc not found'; END IF;

  IF (payload->'receipt'->>'cost')::integer < 0
    OR (payload->'receipt'->>'cost')::integer > v_eurobucks
    OR (payload->'receipt'->>'humanity_after')::integer > v_humanity
    OR (payload->'receipt'->>'day_after')::integer < v_day
    OR (payload->'receipt'->>'minute_after')::integer NOT BETWEEN 0 AND 1439
    OR (
      (payload->'receipt'->>'day_after')::integer * 1440
      + (payload->'receipt'->>'minute_after')::integer
    ) <= (v_day * 1440 + v_minute)
  THEN RAISE EXCEPTION 'invalid installation receipt'; END IF;

  IF v_phase = 'hook' THEN
    IF v_hook IS NULL THEN RAISE EXCEPTION 'installing now requires passing on the active job'; END IF;
    SELECT title INTO v_hook_title
    FROM public.campaign_situations
    WHERE campaign_id = v_campaign AND situation_key = v_hook
      AND category = 'hook' AND status = 'live'
    FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'active hook not found'; END IF;
    UPDATE public.campaign_situations SET status = 'expired'
    WHERE campaign_id = v_campaign AND situation_key = v_hook;

    INSERT INTO public.campaign_flags(campaign_id, flag, value)
    VALUES (
      v_campaign, 'declined_gigs',
      jsonb_build_array(jsonb_build_object('title', v_hook_title, 'day', v_day))
    )
    ON CONFLICT (campaign_id, flag) DO UPDATE SET
      value = COALESCE(public.campaign_flags.value, '[]'::jsonb) || EXCLUDED.value;

    INSERT INTO public.campaign_events(campaign_id, type, summary, data)
    VALUES (
      v_campaign, 'hook_declined', 'Passed on ' || v_hook_title || ' to go under the knife.',
      jsonb_build_object('situationKey', v_hook, 'reason', 'cyberware_installation')
    );
  ELSIF v_hook IS NOT NULL THEN
    RAISE EXCEPTION 'no hook is active';
  END IF;

  FOR v_entry IN
    SELECT value FROM jsonb_array_elements(COALESCE(payload->'implants', '[]'::jsonb))
  LOOP
    IF (v_entry->>'humanity_loss')::integer < 0 THEN
      RAISE EXCEPTION 'invalid Humanity Loss';
    END IF;
    IF v_entry->>'item_id' IS DISTINCT FROM payload->'receipt'->>'item_id' THEN
      RAISE EXCEPTION 'implant does not match receipt';
    END IF;
    IF nullif(v_entry->>'foundational_for', '') IS NOT NULL THEN
      PERFORM 1 FROM public.campaign_cyberware
      WHERE id = (v_entry->>'foundational_for')::uuid AND campaign_id = v_campaign
      FOR SHARE;
      IF NOT FOUND THEN RAISE EXCEPTION 'foundation not found'; END IF;
    END IF;
    INSERT INTO public.campaign_cyberware (
      id, campaign_id, item_id, install_location, humanity_loss_rolled,
      foundational_for, installed_day, installed_by_npc_id, request_id
    ) VALUES (
      (v_entry->>'id')::uuid, v_campaign, v_entry->>'item_id',
      nullif(v_entry->>'install_location', ''), (v_entry->>'humanity_loss')::integer,
      nullif(v_entry->>'foundational_for', '')::uuid,
      (payload->'receipt'->>'day_after')::integer, v_ripperdoc, v_request
    );
    v_count := v_count + 1;
    v_loss := v_loss + (v_entry->>'humanity_loss')::integer;
  END LOOP;

  IF v_count < 1 OR v_count <> (payload->'receipt'->>'quantity')::integer THEN
    RAISE EXCEPTION 'implant count does not match receipt';
  END IF;
  IF (payload->'receipt'->>'humanity_after')::integer <> v_humanity - v_loss THEN
    RAISE EXCEPTION 'Humanity total does not match implants';
  END IF;

  UPDATE public.campaign_vitals SET
    eurobucks = v_eurobucks - (payload->'receipt'->>'cost')::integer,
    humanity_current = (payload->'receipt'->>'humanity_after')::integer
  WHERE campaign_id = v_campaign;

  UPDATE public.campaigns SET
    day = (payload->'receipt'->>'day_after')::integer,
    minute = (payload->'receipt'->>'minute_after')::integer,
    phase = CASE WHEN v_phase = 'hook' THEN 'life' ELSE v_phase END
  WHERE id = v_campaign;

  UPDATE public.campaign_npcs
  SET data = jsonb_set(COALESCE(data, '{}'::jsonb), '{lastSeenDay}',
    to_jsonb((payload->'receipt'->>'day_after')::integer), true)
  WHERE id = v_ripperdoc AND campaign_id = v_campaign;

  INSERT INTO public.campaign_events (id, campaign_id, type, summary, roll, data)
  VALUES (
    v_request, v_campaign, 'cyberware_installed', payload->>'summary',
    COALESCE(payload->'roll', '{}'::jsonb), COALESCE(payload->'receipt', '{}'::jsonb)
  );

  RETURN payload->'receipt';
END;
$$;


--
-- Name: owns_campaign(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.owns_campaign(_campaign_id uuid) RETURNS boolean
    LANGUAGE sql STABLE
    SET search_path TO 'public'
    AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.campaigns c WHERE c.id = _campaign_id AND c.user_id = auth.uid()
  );
$$;


--
-- Name: owns_character(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.owns_character(_character_id uuid) RETURNS boolean
    LANGUAGE sql STABLE
    SET search_path TO 'public'
    AS $$
  SELECT EXISTS (SELECT 1 FROM public.characters c WHERE c.id = _character_id AND c.user_id = auth.uid());
$$;


--
-- Name: owns_encounter(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.owns_encounter(_encounter_id uuid) RETURNS boolean
    LANGUAGE sql STABLE
    SET search_path TO 'public'
    AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.encounters e
    JOIN public.campaigns c ON c.id = e.campaign_id
    WHERE e.id = _encounter_id AND c.user_id = auth.uid()
  );
$$;


--
-- Name: save_character(jsonb); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.save_character(payload jsonb) RETURNS uuid
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
DECLARE
  v_user uuid := auth.uid();
  v_char uuid;
  v_entry jsonb;
  v_ids jsonb := '{}'::jsonb;
  v_new uuid;
  v_draft text;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;

  INSERT INTO public.characters (user_id, name, handle, role, creation_method, portrait_id, portrait_path, is_complete)
  VALUES (
    v_user,
    payload->'character'->>'name',
    payload->'character'->>'handle',
    payload->'character'->>'role',
    payload->'character'->>'creation_method',
    payload->'character'->>'portrait_id',
    payload->'character'->>'portrait_path',
    true
  )
  RETURNING id INTO v_char;

  INSERT INTO public.character_stats
  SELECT * FROM jsonb_populate_record(
    NULL::public.character_stats,
    coalesce(payload->'stats', '{}'::jsonb) || jsonb_build_object('character_id', v_char)
  );

  INSERT INTO public.character_lifepath
  SELECT * FROM jsonb_populate_record(
    NULL::public.character_lifepath,
    coalesce(payload->'lifepath', '{}'::jsonb) || jsonb_build_object('character_id', v_char)
  );

  INSERT INTO public.character_finance
  SELECT * FROM jsonb_populate_record(
    NULL::public.character_finance,
    jsonb_build_object('eurobucks', 0, 'improvement_points', 0)
      || coalesce(payload->'finance', '{}'::jsonb)
      || jsonb_build_object(
           'character_id', v_char,
           'eurobucks', coalesce(payload->'finance'->'eurobucks', to_jsonb(0)),
           'improvement_points', coalesce(payload->'finance'->'improvement_points', to_jsonb(0))
         )
  );

  IF payload->'role_ability' IS NOT NULL AND jsonb_typeof(payload->'role_ability') = 'object' THEN
    INSERT INTO public.character_role_ability
    SELECT * FROM jsonb_populate_record(
      NULL::public.character_role_ability,
      (payload->'role_ability') || jsonb_build_object('character_id', v_char)
    );
  END IF;

  FOR v_entry IN SELECT * FROM jsonb_array_elements(coalesce(payload->'skills', '[]'::jsonb)) LOOP
    INSERT INTO public.character_skills
    SELECT * FROM jsonb_populate_record(
      NULL::public.character_skills,
      v_entry || jsonb_build_object('character_id', v_char, 'id', gen_random_uuid())
    );
  END LOOP;

  FOR v_entry IN SELECT * FROM jsonb_array_elements(coalesce(payload->'gear', '[]'::jsonb)) LOOP
    INSERT INTO public.character_gear
    SELECT * FROM jsonb_populate_record(
      NULL::public.character_gear,
      (v_entry - 'key') || jsonb_build_object('character_id', v_char, 'id', gen_random_uuid())
    )
    RETURNING id INTO v_new;
    IF v_entry ? 'key' THEN
      v_ids := v_ids || jsonb_build_object(v_entry->>'key', v_new);
    END IF;
  END LOOP;

  FOR v_entry IN SELECT * FROM jsonb_array_elements(coalesce(payload->'cyberware', '[]'::jsonb)) LOOP
    INSERT INTO public.character_cyberware
    SELECT * FROM jsonb_populate_record(
      NULL::public.character_cyberware,
      (v_entry - 'key' - 'foundation_key') || jsonb_build_object('character_id', v_char, 'id', gen_random_uuid())
    )
    RETURNING id INTO v_new;
    IF v_entry ? 'key' THEN
      v_ids := v_ids || jsonb_build_object(v_entry->>'key', v_new);
    END IF;
  END LOOP;

  UPDATE public.character_cyberware c
  SET foundational_for = (v_ids->>(e->>'foundation_key'))::uuid
  FROM jsonb_array_elements(coalesce(payload->'cyberware', '[]'::jsonb)) e
  WHERE e->>'foundation_key' IS NOT NULL
    AND c.id = (v_ids->>(e->>'key'))::uuid;

  v_draft := payload->>'draft_id';
  IF v_draft IS NOT NULL THEN
    DELETE FROM public.chargen_drafts WHERE id = v_draft::uuid AND user_id = v_user;
  END IF;

  RETURN v_char;
END;
$$;


--
-- Name: save_encounter_state(jsonb); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.save_encounter_state(payload jsonb) RETURNS void
    LANGUAGE plpgsql
    SET search_path TO 'public'
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


--
-- Name: set_updated_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.set_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;


--
-- Name: settle_job(jsonb); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.settle_job(payload jsonb) RETURNS jsonb
    LANGUAGE plpgsql
    SET search_path TO 'public'
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


--
-- Name: spend_ip_on_skill(uuid, text, integer, integer, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.spend_ip_on_skill(p_character_id uuid, p_skill_id text, p_new_level integer, p_cost integer, p_specialization text DEFAULT NULL::text) RETURNS integer
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
DECLARE
  v_user uuid := auth.uid();
  v_balance int;
  v_current int;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  IF NOT public.owns_character(p_character_id) THEN
    RAISE EXCEPTION 'character not found';
  END IF;
  IF p_cost < 0 THEN RAISE EXCEPTION 'cost cannot be negative'; END IF;

  -- Lock the balance row so two concurrent buys cannot both see the same points.
  SELECT improvement_points INTO v_balance
  FROM public.character_finance
  WHERE character_id = p_character_id
  FOR UPDATE;

  IF v_balance IS NULL THEN RAISE EXCEPTION 'character has no improvement points'; END IF;
  IF v_balance < p_cost THEN
    RAISE EXCEPTION 'not enough improvement points: have %, need %', v_balance, p_cost;
  END IF;

  -- Repeatable Skills (Language, Science, ...) have one row per specialization,
  -- so the line is identified by both. IS NOT DISTINCT FROM matches NULL to NULL.
  SELECT level INTO v_current
  FROM public.character_skills
  WHERE character_id = p_character_id
    AND skill_id = p_skill_id
    AND specialization IS NOT DISTINCT FROM p_specialization;

  -- Exactly one Level at a time, off the level actually on the sheet. This is
  -- what stops a replayed or stale request from buying a Level twice.
  IF coalesce(v_current, 0) + 1 <> p_new_level THEN
    RAISE EXCEPTION 'skill % is at level %, cannot move to level %',
      p_skill_id, coalesce(v_current, 0), p_new_level;
  END IF;

  IF v_current IS NULL THEN
    INSERT INTO public.character_skills (character_id, skill_id, level, specialization)
    VALUES (p_character_id, p_skill_id, p_new_level, p_specialization);
  ELSE
    UPDATE public.character_skills
    SET level = p_new_level
    WHERE character_id = p_character_id
      AND skill_id = p_skill_id
      AND specialization IS NOT DISTINCT FROM p_specialization;
  END IF;

  UPDATE public.character_finance
  SET improvement_points = improvement_points - p_cost
  WHERE character_id = p_character_id
  RETURNING improvement_points INTO v_balance;

  RETURN v_balance;
END;
$$;


--
-- Name: start_campaign(jsonb); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.start_campaign(payload jsonb) RETURNS uuid
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
DECLARE
  v_user uuid := auth.uid();
  v_char public.characters%ROWTYPE;
  v_stats public.character_stats%ROWTYPE;
  v_eb integer := 0;
  v_campaign uuid;
  v_mission text := payload->>'mission_id';
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;

  SELECT * INTO v_char FROM public.characters
   WHERE id = (payload->>'character_id')::uuid AND user_id = v_user;
  IF NOT FOUND THEN RAISE EXCEPTION 'character not found'; END IF;

  SELECT id INTO v_campaign FROM public.campaigns
   WHERE character_id = v_char.id AND status = 'active';
  IF FOUND THEN RETURN v_campaign; END IF;

  SELECT * INTO v_stats FROM public.character_stats WHERE character_id = v_char.id;
  IF NOT FOUND THEN RAISE EXCEPTION 'character has no stats'; END IF;

  SELECT coalesce(eurobucks, 0) INTO v_eb FROM public.character_finance WHERE character_id = v_char.id;

  INSERT INTO public.campaigns (user_id, character_id, name, current_mission_id)
  VALUES (
    v_user,
    v_char.id,
    coalesce(nullif(trim(payload->>'name'), ''), coalesce(nullif(trim(v_char.handle), ''), v_char.name) || ' in Night City'),
    v_mission
  ) RETURNING id INTO v_campaign;

  INSERT INTO public.campaign_vitals (
    campaign_id, hp_current, hp_max, seriously_wounded_threshold,
    humanity_current, humanity_max, wound_state, mortal_save_failures, eurobucks
  ) VALUES (
    v_campaign,
    coalesce(v_stats.hp_max, 0),
    coalesce(v_stats.hp_max, 0),
    coalesce(v_stats.seriously_wounded_threshold, 0),
    coalesce(v_stats.humanity_current, coalesce(v_stats.humanity_max, 0)),
    coalesce(v_stats.humanity_max, 0),
    'none', 0, coalesce(v_eb, 0)
  );

  INSERT INTO public.campaign_inventory
    (campaign_id, kind, item_id, quantity, equipped, slot, current_sp, notes)
  SELECT
    v_campaign,
    CASE
      WHEN g.slot IN ('body','head','shield') THEN 'armor'
      WHEN g.slot IN ('weapon','ammunition','gear','fashion') THEN g.slot
      ELSE 'gear'
    END,
    g.item_id, g.quantity, g.equipped, g.slot, g.current_sp, g.notes
  FROM public.character_gear g
  WHERE g.character_id = v_char.id AND g.slot IS DISTINCT FROM 'cyberware';

  INSERT INTO public.campaign_cyberware (
    campaign_id, item_id, install_location, humanity_loss_rolled,
    installed_day, source_character_cyberware_id
  )
  SELECT
    v_campaign, c.item_id, c.install_location, coalesce(c.humanity_loss_rolled, 0),
    1, c.id
  FROM public.character_cyberware c
  WHERE c.character_id = v_char.id;

  UPDATE public.campaign_cyberware live
  SET foundational_for = parent_live.id
  FROM public.character_cyberware source,
       public.campaign_cyberware parent_live
  WHERE live.campaign_id = v_campaign
    AND live.source_character_cyberware_id = source.id
    AND source.foundational_for IS NOT NULL
    AND parent_live.campaign_id = v_campaign
    AND parent_live.source_character_cyberware_id = source.foundational_for;

  INSERT INTO public.campaign_events (campaign_id, type, summary, data)
  VALUES (
    v_campaign,
    'campaign_started',
    coalesce(nullif(trim(v_char.handle), ''), v_char.name) || ' hits the streets of Night City.',
    jsonb_build_object('character_id', v_char.id, 'mission_id', v_mission)
  );

  RETURN v_campaign;
END;
$$;


--
-- Name: start_encounter(jsonb); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.start_encounter(payload jsonb) RETURNS uuid
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
DECLARE
  v_user uuid := auth.uid();
  v_campaign uuid := (payload->>'campaign_id')::uuid;
  v_encounter uuid;
  v_entry jsonb;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.campaigns WHERE id = v_campaign AND user_id = v_user) THEN
    RAISE EXCEPTION 'campaign not found'; END IF;

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


--
-- Name: update_updated_at_column(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_updated_at_column() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: campaign_clocks; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.campaign_clocks (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    campaign_id uuid NOT NULL,
    clock_key text NOT NULL,
    label text NOT NULL,
    filled integer DEFAULT 0 NOT NULL,
    segments integer DEFAULT 6 NOT NULL,
    hidden boolean DEFAULT false NOT NULL,
    data jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: campaign_cyberware; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.campaign_cyberware (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    campaign_id uuid NOT NULL,
    item_id text NOT NULL,
    install_location text,
    humanity_loss_rolled integer DEFAULT 0 NOT NULL,
    foundational_for uuid,
    installed_day integer NOT NULL,
    installed_by_npc_id uuid,
    source_character_cyberware_id uuid,
    request_id uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT campaign_cyberware_humanity_loss_rolled_check CHECK ((humanity_loss_rolled >= 0)),
    CONSTRAINT campaign_cyberware_installed_day_check CHECK ((installed_day >= 1))
);


--
-- Name: campaign_events_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.campaign_events_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: campaign_events; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.campaign_events (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    campaign_id uuid NOT NULL,
    seq bigint DEFAULT nextval('public.campaign_events_seq'::regclass) NOT NULL,
    type text NOT NULL,
    summary text,
    beat_id text,
    roll jsonb,
    data jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: campaign_factions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.campaign_factions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    campaign_id uuid NOT NULL,
    faction_id text NOT NULL,
    name text NOT NULL,
    standing integer DEFAULT 0 NOT NULL,
    notes text,
    CONSTRAINT campaign_factions_standing_range CHECK (((standing >= '-10'::integer) AND (standing <= 10)))
);


--
-- Name: campaign_flags; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.campaign_flags (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    campaign_id uuid NOT NULL,
    flag text NOT NULL,
    value jsonb DEFAULT 'true'::jsonb NOT NULL
);


--
-- Name: campaign_inventory; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.campaign_inventory (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    campaign_id uuid NOT NULL,
    kind text DEFAULT 'gear'::text NOT NULL,
    item_id text NOT NULL,
    quantity integer DEFAULT 1 NOT NULL,
    equipped boolean DEFAULT false NOT NULL,
    slot text,
    current_sp integer,
    notes text,
    ammo_loaded integer,
    condition text DEFAULT 'ok'::text NOT NULL,
    CONSTRAINT campaign_inventory_kind_range CHECK ((kind = ANY (ARRAY['weapon'::text, 'armor'::text, 'ammunition'::text, 'cyberware'::text, 'fashion'::text, 'gear'::text])))
);


--
-- Name: campaign_npcs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.campaign_npcs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    campaign_id uuid NOT NULL,
    npc_id text,
    name text NOT NULL,
    status text DEFAULT 'alive'::text NOT NULL,
    disposition integer DEFAULT 0 NOT NULL,
    location text,
    notes text,
    data jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT campaign_npcs_disposition_check CHECK (((disposition >= '-3'::integer) AND (disposition <= 3))),
    CONSTRAINT campaign_npcs_status_check CHECK ((status = ANY (ARRAY['alive'::text, 'dead'::text, 'fled'::text, 'unknown'::text])))
);


--
-- Name: campaign_places; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.campaign_places (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    campaign_id uuid NOT NULL,
    place_key text NOT NULL,
    dials jsonb DEFAULT '{}'::jsonb NOT NULL,
    flags text[] DEFAULT ARRAY[]::text[] NOT NULL,
    visits integer DEFAULT 0 NOT NULL,
    first_visit_day integer,
    last_visit_day integer,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: campaign_situations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.campaign_situations (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    campaign_id uuid NOT NULL,
    situation_key text NOT NULL,
    category text DEFAULT 'need'::text NOT NULL,
    title text NOT NULL,
    summary text,
    npc_key text,
    status text DEFAULT 'live'::text NOT NULL,
    severity integer DEFAULT 1 NOT NULL,
    due_day integer,
    last_shown_day integer,
    data jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT campaign_situations_category_check CHECK ((category = ANY (ARRAY['need'::text, 'people'::text, 'opportunity'::text, 'pressure'::text, 'hook'::text]))),
    CONSTRAINT campaign_situations_status_check CHECK ((status = ANY (ARRAY['live'::text, 'resolved'::text, 'expired'::text, 'escalated'::text])))
);


--
-- Name: campaign_truths; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.campaign_truths (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    campaign_id uuid NOT NULL,
    truth_key text NOT NULL,
    discovered_day integer,
    via_skill text,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: campaign_vitals; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.campaign_vitals (
    campaign_id uuid NOT NULL,
    hp_current integer NOT NULL,
    hp_max integer NOT NULL,
    seriously_wounded_threshold integer NOT NULL,
    humanity_current integer NOT NULL,
    humanity_max integer NOT NULL,
    wound_state text DEFAULT 'none'::text NOT NULL,
    mortal_save_failures integer DEFAULT 0 NOT NULL,
    eurobucks integer DEFAULT 0 NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    luck_current integer,
    CONSTRAINT campaign_vitals_wound_state_check CHECK ((wound_state = ANY (ARRAY['none'::text, 'light'::text, 'serious'::text, 'mortal'::text])))
);


--
-- Name: COLUMN campaign_vitals.luck_current; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.campaign_vitals.luck_current IS 'Luck Points remaining this session. NULL = never recorded, read as a full pool (the character''s LUCK STAT).';


--
-- Name: campaigns; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.campaigns (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    character_id uuid NOT NULL,
    name text NOT NULL,
    status text DEFAULT 'active'::text NOT NULL,
    current_mission_id text,
    day integer DEFAULT 1 NOT NULL,
    minute integer DEFAULT 1080 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    ip_awarded integer,
    bills_paid_through_day integer DEFAULT 0 NOT NULL,
    role_state jsonb DEFAULT '{}'::jsonb NOT NULL,
    phase text DEFAULT 'life'::text NOT NULL,
    location_key text,
    known_places jsonb DEFAULT '[]'::jsonb NOT NULL,
    CONSTRAINT campaigns_phase_check CHECK ((phase = ANY (ARRAY['life'::text, 'hook'::text, 'job'::text, 'aftermath'::text]))),
    CONSTRAINT campaigns_status_check CHECK ((status = ANY (ARRAY['active'::text, 'won'::text, 'lost'::text, 'abandoned'::text])))
);


--
-- Name: COLUMN campaigns.bills_paid_through_day; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.campaigns.bills_paid_through_day IS 'Day through which rent and Lifestyle are settled. 0 = nothing paid yet; the free first month is applied on read.';


--
-- Name: COLUMN campaigns.role_state; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.campaigns.role_state IS 'Live Role Ability state, keyed by ability id. Empty until the Role Ability is used.';


--
-- Name: COLUMN campaigns.location_key; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.campaigns.location_key IS 'Night City Atlas location code key (e.g. "b1") or district key (e.g. "kabuki").';


--
-- Name: COLUMN campaigns.known_places; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.campaigns.known_places IS 'Array of atlas keys the character has visited or learned about.';


--
-- Name: character_cyberware; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.character_cyberware (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    character_id uuid NOT NULL,
    item_id text NOT NULL,
    install_location text,
    humanity_loss_rolled integer,
    foundational_for uuid
);


--
-- Name: character_finance; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.character_finance (
    character_id uuid NOT NULL,
    eurobucks integer DEFAULT 0 NOT NULL,
    lifestyle text,
    housing text,
    rent integer,
    improvement_points integer DEFAULT 0 NOT NULL,
    home_place_key text,
    home_district_key text
);


--
-- Name: COLUMN character_finance.home_place_key; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.character_finance.home_place_key IS 'Night City Atlas location key for the character''s starting home (e.g. "x3"). Null for characters saved before the address was asked for.';


--
-- Name: COLUMN character_finance.home_district_key; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.character_finance.home_district_key IS 'Night City Atlas district key for the character''s starting home (e.g. "rancho_coronado").';


--
-- Name: character_gear; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.character_gear (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    character_id uuid NOT NULL,
    item_id text NOT NULL,
    quantity integer DEFAULT 1 NOT NULL,
    equipped boolean DEFAULT false NOT NULL,
    slot text,
    current_sp integer,
    notes text
);


--
-- Name: character_lifepath; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.character_lifepath (
    character_id uuid NOT NULL,
    general jsonb DEFAULT '{}'::jsonb NOT NULL,
    role_specific jsonb DEFAULT '{}'::jsonb NOT NULL
);


--
-- Name: character_role_ability; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.character_role_ability (
    character_id uuid NOT NULL,
    ability_id text NOT NULL,
    rank integer DEFAULT 4 NOT NULL,
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL
);


--
-- Name: character_skills; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.character_skills (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    character_id uuid NOT NULL,
    skill_id text NOT NULL,
    level integer NOT NULL,
    specialization text
);


--
-- Name: character_stats; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.character_stats (
    character_id uuid NOT NULL,
    "int" integer,
    ref integer,
    dex integer,
    tech integer,
    cool integer,
    will integer,
    luck integer,
    move integer,
    body integer,
    emp integer,
    emp_max integer,
    hp_max integer,
    hp_current integer,
    seriously_wounded_threshold integer,
    death_save integer,
    humanity_max integer,
    humanity_current integer
);


--
-- Name: characters; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.characters (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    name text NOT NULL,
    handle text,
    role text NOT NULL,
    creation_method text NOT NULL,
    portrait_id text,
    is_complete boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    portrait_path text,
    CONSTRAINT characters_creation_method_check CHECK ((creation_method = ANY (ARRAY['streetrat'::text, 'edgerunner'::text, 'complete_package'::text])))
);


--
-- Name: chargen_drafts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.chargen_drafts (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    state jsonb NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: encounter_combatants; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.encounter_combatants (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    encounter_id uuid NOT NULL,
    character_id uuid,
    is_player boolean DEFAULT false NOT NULL,
    name text NOT NULL,
    side text DEFAULT 'hostile'::text NOT NULL,
    ref integer NOT NULL,
    body integer NOT NULL,
    hp_max integer NOT NULL,
    hp_current integer NOT NULL,
    seriously_wounded_threshold integer NOT NULL,
    wound_state text DEFAULT 'none'::text NOT NULL,
    death_save_penalty integer DEFAULT 0 NOT NULL,
    sp_head integer DEFAULT 0 NOT NULL,
    sp_body integer DEFAULT 0 NOT NULL,
    initiative integer,
    defeated boolean DEFAULT false NOT NULL,
    data jsonb DEFAULT '{}'::jsonb NOT NULL,
    CONSTRAINT encounter_combatants_side_check CHECK ((side = ANY (ARRAY['friendly'::text, 'hostile'::text, 'neutral'::text]))),
    CONSTRAINT encounter_combatants_wound_state_check CHECK ((wound_state = ANY (ARRAY['none'::text, 'light'::text, 'serious'::text, 'mortal'::text])))
);


--
-- Name: encounters; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.encounters (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    campaign_id uuid NOT NULL,
    name text,
    beat_id text,
    status text DEFAULT 'active'::text NOT NULL,
    round integer DEFAULT 1 NOT NULL,
    active_index integer DEFAULT 0 NOT NULL,
    order_ids jsonb DEFAULT '[]'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    arena text,
    cover jsonb DEFAULT '{}'::jsonb NOT NULL,
    version integer DEFAULT 0 NOT NULL,
    CONSTRAINT encounters_status_check CHECK ((status = ANY (ARRAY['active'::text, 'friendlies_won'::text, 'friendlies_lost'::text, 'resolved'::text])))
);


--
-- Name: COLUMN encounters.arena; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.encounters.arena IS 'Key from the engine''s closed ARENAS list (src/engine/battlefield.ts). Null reads as open ground.';


--
-- Name: COLUMN encounters.cover; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.encounters.cover IS 'Damage taken by each piece of arena cover, keyed by the authored id in src/engine/battlefield.ts. Geometry is NOT stored here.';


--
-- Name: COLUMN encounters.version; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.encounters.version IS 'Optimistic-concurrency token. Rises by one per successful save_encounter_state. A caller may send the version it read; a mismatch refuses the write.';


--
-- Name: mission_progress; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.mission_progress (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    campaign_id uuid NOT NULL,
    mission_id text NOT NULL,
    status text DEFAULT 'active'::text NOT NULL,
    current_beat_id text,
    completed_beats jsonb DEFAULT '[]'::jsonb NOT NULL,
    branch_choices jsonb DEFAULT '{}'::jsonb NOT NULL,
    objectives jsonb DEFAULT '[]'::jsonb NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT mission_progress_status_check CHECK ((status = ANY (ARRAY['active'::text, 'completed'::text, 'failed'::text, 'abandoned'::text])))
);


--
-- Name: campaign_clocks campaign_clocks_campaign_id_clock_key_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.campaign_clocks
    ADD CONSTRAINT campaign_clocks_campaign_id_clock_key_key UNIQUE (campaign_id, clock_key);


--
-- Name: campaign_clocks campaign_clocks_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.campaign_clocks
    ADD CONSTRAINT campaign_clocks_pkey PRIMARY KEY (id);


--
-- Name: campaign_cyberware campaign_cyberware_campaign_id_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.campaign_cyberware
    ADD CONSTRAINT campaign_cyberware_campaign_id_id_key UNIQUE (campaign_id, id);


--
-- Name: campaign_cyberware campaign_cyberware_campaign_id_source_character_cyberware_i_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.campaign_cyberware
    ADD CONSTRAINT campaign_cyberware_campaign_id_source_character_cyberware_i_key UNIQUE (campaign_id, source_character_cyberware_id);


--
-- Name: campaign_cyberware campaign_cyberware_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.campaign_cyberware
    ADD CONSTRAINT campaign_cyberware_pkey PRIMARY KEY (id);


--
-- Name: campaign_events campaign_events_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.campaign_events
    ADD CONSTRAINT campaign_events_pkey PRIMARY KEY (id);


--
-- Name: campaign_factions campaign_factions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.campaign_factions
    ADD CONSTRAINT campaign_factions_pkey PRIMARY KEY (id);


--
-- Name: campaign_flags campaign_flags_campaign_id_flag_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.campaign_flags
    ADD CONSTRAINT campaign_flags_campaign_id_flag_key UNIQUE (campaign_id, flag);


--
-- Name: campaign_flags campaign_flags_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.campaign_flags
    ADD CONSTRAINT campaign_flags_pkey PRIMARY KEY (id);


--
-- Name: campaign_inventory campaign_inventory_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.campaign_inventory
    ADD CONSTRAINT campaign_inventory_pkey PRIMARY KEY (id);


--
-- Name: campaign_npcs campaign_npcs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.campaign_npcs
    ADD CONSTRAINT campaign_npcs_pkey PRIMARY KEY (id);


--
-- Name: campaign_places campaign_places_campaign_id_place_key_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.campaign_places
    ADD CONSTRAINT campaign_places_campaign_id_place_key_key UNIQUE (campaign_id, place_key);


--
-- Name: campaign_places campaign_places_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.campaign_places
    ADD CONSTRAINT campaign_places_pkey PRIMARY KEY (id);


--
-- Name: campaign_situations campaign_situations_campaign_id_situation_key_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.campaign_situations
    ADD CONSTRAINT campaign_situations_campaign_id_situation_key_key UNIQUE (campaign_id, situation_key);


--
-- Name: campaign_situations campaign_situations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.campaign_situations
    ADD CONSTRAINT campaign_situations_pkey PRIMARY KEY (id);


--
-- Name: campaign_truths campaign_truths_campaign_id_truth_key_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.campaign_truths
    ADD CONSTRAINT campaign_truths_campaign_id_truth_key_key UNIQUE (campaign_id, truth_key);


--
-- Name: campaign_truths campaign_truths_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.campaign_truths
    ADD CONSTRAINT campaign_truths_pkey PRIMARY KEY (id);


--
-- Name: campaign_vitals campaign_vitals_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.campaign_vitals
    ADD CONSTRAINT campaign_vitals_pkey PRIMARY KEY (campaign_id);


--
-- Name: campaigns campaigns_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.campaigns
    ADD CONSTRAINT campaigns_pkey PRIMARY KEY (id);


--
-- Name: character_cyberware character_cyberware_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.character_cyberware
    ADD CONSTRAINT character_cyberware_pkey PRIMARY KEY (id);


--
-- Name: character_finance character_finance_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.character_finance
    ADD CONSTRAINT character_finance_pkey PRIMARY KEY (character_id);


--
-- Name: character_gear character_gear_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.character_gear
    ADD CONSTRAINT character_gear_pkey PRIMARY KEY (id);


--
-- Name: character_lifepath character_lifepath_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.character_lifepath
    ADD CONSTRAINT character_lifepath_pkey PRIMARY KEY (character_id);


--
-- Name: character_role_ability character_role_ability_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.character_role_ability
    ADD CONSTRAINT character_role_ability_pkey PRIMARY KEY (character_id);


--
-- Name: character_skills character_skills_character_id_skill_id_specialization_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.character_skills
    ADD CONSTRAINT character_skills_character_id_skill_id_specialization_key UNIQUE (character_id, skill_id, specialization);


--
-- Name: character_skills character_skills_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.character_skills
    ADD CONSTRAINT character_skills_pkey PRIMARY KEY (id);


--
-- Name: character_stats character_stats_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.character_stats
    ADD CONSTRAINT character_stats_pkey PRIMARY KEY (character_id);


--
-- Name: characters characters_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.characters
    ADD CONSTRAINT characters_pkey PRIMARY KEY (id);


--
-- Name: chargen_drafts chargen_drafts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.chargen_drafts
    ADD CONSTRAINT chargen_drafts_pkey PRIMARY KEY (id);


--
-- Name: encounter_combatants encounter_combatants_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.encounter_combatants
    ADD CONSTRAINT encounter_combatants_pkey PRIMARY KEY (id);


--
-- Name: encounters encounters_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.encounters
    ADD CONSTRAINT encounters_pkey PRIMARY KEY (id);


--
-- Name: mission_progress mission_progress_campaign_id_mission_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.mission_progress
    ADD CONSTRAINT mission_progress_campaign_id_mission_id_key UNIQUE (campaign_id, mission_id);


--
-- Name: mission_progress mission_progress_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.mission_progress
    ADD CONSTRAINT mission_progress_pkey PRIMARY KEY (id);


--
-- Name: campaign_cyberware_campaign_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX campaign_cyberware_campaign_idx ON public.campaign_cyberware USING btree (campaign_id);


--
-- Name: campaign_cyberware_foundation_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX campaign_cyberware_foundation_idx ON public.campaign_cyberware USING btree (foundational_for);


--
-- Name: campaign_events_campaign_seq_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX campaign_events_campaign_seq_idx ON public.campaign_events USING btree (campaign_id, seq);


--
-- Name: campaign_factions_campaign_id_faction_id_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX campaign_factions_campaign_id_faction_id_key ON public.campaign_factions USING btree (campaign_id, faction_id);


--
-- Name: campaign_factions_campaign_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX campaign_factions_campaign_idx ON public.campaign_factions USING btree (campaign_id);


--
-- Name: campaign_inventory_campaign_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX campaign_inventory_campaign_idx ON public.campaign_inventory USING btree (campaign_id);


--
-- Name: campaign_npcs_campaign_created_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX campaign_npcs_campaign_created_idx ON public.campaign_npcs USING btree (campaign_id, created_at);


--
-- Name: campaign_npcs_campaign_id_id_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX campaign_npcs_campaign_id_id_key ON public.campaign_npcs USING btree (campaign_id, id);


--
-- Name: campaign_npcs_campaign_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX campaign_npcs_campaign_idx ON public.campaign_npcs USING btree (campaign_id);


--
-- Name: campaign_places_campaign_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX campaign_places_campaign_idx ON public.campaign_places USING btree (campaign_id);


--
-- Name: campaign_truths_campaign_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX campaign_truths_campaign_idx ON public.campaign_truths USING btree (campaign_id);


--
-- Name: campaigns_one_active_per_character; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX campaigns_one_active_per_character ON public.campaigns USING btree (character_id) WHERE (status = 'active'::text);


--
-- Name: campaigns_user_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX campaigns_user_idx ON public.campaigns USING btree (user_id);


--
-- Name: character_cyberware_character_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX character_cyberware_character_id_idx ON public.character_cyberware USING btree (character_id);


--
-- Name: character_gear_character_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX character_gear_character_id_idx ON public.character_gear USING btree (character_id);


--
-- Name: character_skills_character_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX character_skills_character_id_idx ON public.character_skills USING btree (character_id);


--
-- Name: characters_user_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX characters_user_id_idx ON public.characters USING btree (user_id);


--
-- Name: chargen_drafts_user_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX chargen_drafts_user_id_idx ON public.chargen_drafts USING btree (user_id);


--
-- Name: encounter_combatants_encounter_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX encounter_combatants_encounter_idx ON public.encounter_combatants USING btree (encounter_id);


--
-- Name: encounters_campaign_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX encounters_campaign_idx ON public.encounters USING btree (campaign_id);


--
-- Name: campaign_clocks campaign_clocks_set_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER campaign_clocks_set_updated_at BEFORE UPDATE ON public.campaign_clocks FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: campaign_places campaign_places_set_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER campaign_places_set_updated_at BEFORE UPDATE ON public.campaign_places FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: campaign_situations campaign_situations_set_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER campaign_situations_set_updated_at BEFORE UPDATE ON public.campaign_situations FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: campaign_vitals campaign_vitals_set_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER campaign_vitals_set_updated_at BEFORE UPDATE ON public.campaign_vitals FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: campaigns campaigns_set_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER campaigns_set_updated_at BEFORE UPDATE ON public.campaigns FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: characters characters_set_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER characters_set_updated_at BEFORE UPDATE ON public.characters FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: chargen_drafts chargen_drafts_set_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER chargen_drafts_set_updated_at BEFORE UPDATE ON public.chargen_drafts FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: encounters encounters_set_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER encounters_set_updated_at BEFORE UPDATE ON public.encounters FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: mission_progress mission_progress_set_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER mission_progress_set_updated_at BEFORE UPDATE ON public.mission_progress FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: campaign_npcs update_campaign_npcs_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_campaign_npcs_updated_at BEFORE UPDATE ON public.campaign_npcs FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: campaign_clocks campaign_clocks_campaign_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.campaign_clocks
    ADD CONSTRAINT campaign_clocks_campaign_id_fkey FOREIGN KEY (campaign_id) REFERENCES public.campaigns(id) ON DELETE CASCADE;


--
-- Name: campaign_cyberware campaign_cyberware_campaign_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.campaign_cyberware
    ADD CONSTRAINT campaign_cyberware_campaign_id_fkey FOREIGN KEY (campaign_id) REFERENCES public.campaigns(id) ON DELETE CASCADE;


--
-- Name: campaign_cyberware campaign_cyberware_campaign_id_foundational_for_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.campaign_cyberware
    ADD CONSTRAINT campaign_cyberware_campaign_id_foundational_for_fkey FOREIGN KEY (campaign_id, foundational_for) REFERENCES public.campaign_cyberware(campaign_id, id) DEFERRABLE INITIALLY DEFERRED;


--
-- Name: campaign_cyberware campaign_cyberware_installed_by_same_campaign_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.campaign_cyberware
    ADD CONSTRAINT campaign_cyberware_installed_by_same_campaign_fkey FOREIGN KEY (campaign_id, installed_by_npc_id) REFERENCES public.campaign_npcs(campaign_id, id) DEFERRABLE INITIALLY DEFERRED;


--
-- Name: campaign_events campaign_events_campaign_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.campaign_events
    ADD CONSTRAINT campaign_events_campaign_id_fkey FOREIGN KEY (campaign_id) REFERENCES public.campaigns(id) ON DELETE CASCADE;


--
-- Name: campaign_factions campaign_factions_campaign_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.campaign_factions
    ADD CONSTRAINT campaign_factions_campaign_id_fkey FOREIGN KEY (campaign_id) REFERENCES public.campaigns(id) ON DELETE CASCADE;


--
-- Name: campaign_flags campaign_flags_campaign_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.campaign_flags
    ADD CONSTRAINT campaign_flags_campaign_id_fkey FOREIGN KEY (campaign_id) REFERENCES public.campaigns(id) ON DELETE CASCADE;


--
-- Name: campaign_inventory campaign_inventory_campaign_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.campaign_inventory
    ADD CONSTRAINT campaign_inventory_campaign_id_fkey FOREIGN KEY (campaign_id) REFERENCES public.campaigns(id) ON DELETE CASCADE;


--
-- Name: campaign_npcs campaign_npcs_campaign_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.campaign_npcs
    ADD CONSTRAINT campaign_npcs_campaign_id_fkey FOREIGN KEY (campaign_id) REFERENCES public.campaigns(id) ON DELETE CASCADE;


--
-- Name: campaign_places campaign_places_campaign_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.campaign_places
    ADD CONSTRAINT campaign_places_campaign_id_fkey FOREIGN KEY (campaign_id) REFERENCES public.campaigns(id) ON DELETE CASCADE;


--
-- Name: campaign_situations campaign_situations_campaign_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.campaign_situations
    ADD CONSTRAINT campaign_situations_campaign_id_fkey FOREIGN KEY (campaign_id) REFERENCES public.campaigns(id) ON DELETE CASCADE;


--
-- Name: campaign_truths campaign_truths_campaign_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.campaign_truths
    ADD CONSTRAINT campaign_truths_campaign_id_fkey FOREIGN KEY (campaign_id) REFERENCES public.campaigns(id) ON DELETE CASCADE;


--
-- Name: campaign_vitals campaign_vitals_campaign_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.campaign_vitals
    ADD CONSTRAINT campaign_vitals_campaign_id_fkey FOREIGN KEY (campaign_id) REFERENCES public.campaigns(id) ON DELETE CASCADE;


--
-- Name: campaigns campaigns_character_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.campaigns
    ADD CONSTRAINT campaigns_character_id_fkey FOREIGN KEY (character_id) REFERENCES public.characters(id) ON DELETE CASCADE;


--
-- Name: character_cyberware character_cyberware_character_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.character_cyberware
    ADD CONSTRAINT character_cyberware_character_id_fkey FOREIGN KEY (character_id) REFERENCES public.characters(id) ON DELETE CASCADE;


--
-- Name: character_cyberware character_cyberware_foundational_for_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.character_cyberware
    ADD CONSTRAINT character_cyberware_foundational_for_fkey FOREIGN KEY (foundational_for) REFERENCES public.character_cyberware(id) ON DELETE SET NULL;


--
-- Name: character_finance character_finance_character_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.character_finance
    ADD CONSTRAINT character_finance_character_id_fkey FOREIGN KEY (character_id) REFERENCES public.characters(id) ON DELETE CASCADE;


--
-- Name: character_gear character_gear_character_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.character_gear
    ADD CONSTRAINT character_gear_character_id_fkey FOREIGN KEY (character_id) REFERENCES public.characters(id) ON DELETE CASCADE;


--
-- Name: character_lifepath character_lifepath_character_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.character_lifepath
    ADD CONSTRAINT character_lifepath_character_id_fkey FOREIGN KEY (character_id) REFERENCES public.characters(id) ON DELETE CASCADE;


--
-- Name: character_role_ability character_role_ability_character_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.character_role_ability
    ADD CONSTRAINT character_role_ability_character_id_fkey FOREIGN KEY (character_id) REFERENCES public.characters(id) ON DELETE CASCADE;


--
-- Name: character_skills character_skills_character_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.character_skills
    ADD CONSTRAINT character_skills_character_id_fkey FOREIGN KEY (character_id) REFERENCES public.characters(id) ON DELETE CASCADE;


--
-- Name: character_stats character_stats_character_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.character_stats
    ADD CONSTRAINT character_stats_character_id_fkey FOREIGN KEY (character_id) REFERENCES public.characters(id) ON DELETE CASCADE;


--
-- Name: characters characters_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.characters
    ADD CONSTRAINT characters_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: chargen_drafts chargen_drafts_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.chargen_drafts
    ADD CONSTRAINT chargen_drafts_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: encounter_combatants encounter_combatants_character_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.encounter_combatants
    ADD CONSTRAINT encounter_combatants_character_id_fkey FOREIGN KEY (character_id) REFERENCES public.characters(id) ON DELETE SET NULL;


--
-- Name: encounter_combatants encounter_combatants_encounter_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.encounter_combatants
    ADD CONSTRAINT encounter_combatants_encounter_id_fkey FOREIGN KEY (encounter_id) REFERENCES public.encounters(id) ON DELETE CASCADE;


--
-- Name: encounters encounters_campaign_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.encounters
    ADD CONSTRAINT encounters_campaign_id_fkey FOREIGN KEY (campaign_id) REFERENCES public.campaigns(id) ON DELETE CASCADE;


--
-- Name: mission_progress mission_progress_campaign_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.mission_progress
    ADD CONSTRAINT mission_progress_campaign_id_fkey FOREIGN KEY (campaign_id) REFERENCES public.campaigns(id) ON DELETE CASCADE;


--
-- Name: campaign_events append own campaign_events; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "append own campaign_events" ON public.campaign_events FOR INSERT TO authenticated WITH CHECK (public.owns_campaign(campaign_id));


--
-- Name: campaign_clocks; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.campaign_clocks ENABLE ROW LEVEL SECURITY;

--
-- Name: campaign_cyberware; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.campaign_cyberware ENABLE ROW LEVEL SECURITY;

--
-- Name: campaign_events; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.campaign_events ENABLE ROW LEVEL SECURITY;

--
-- Name: campaign_factions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.campaign_factions ENABLE ROW LEVEL SECURITY;

--
-- Name: campaign_flags; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.campaign_flags ENABLE ROW LEVEL SECURITY;

--
-- Name: campaign_inventory; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.campaign_inventory ENABLE ROW LEVEL SECURITY;

--
-- Name: campaign_npcs; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.campaign_npcs ENABLE ROW LEVEL SECURITY;

--
-- Name: campaign_places; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.campaign_places ENABLE ROW LEVEL SECURITY;

--
-- Name: campaign_situations; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.campaign_situations ENABLE ROW LEVEL SECURITY;

--
-- Name: campaign_truths; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.campaign_truths ENABLE ROW LEVEL SECURITY;

--
-- Name: campaign_vitals; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.campaign_vitals ENABLE ROW LEVEL SECURITY;

--
-- Name: campaigns; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.campaigns ENABLE ROW LEVEL SECURITY;

--
-- Name: character_cyberware; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.character_cyberware ENABLE ROW LEVEL SECURITY;

--
-- Name: character_finance; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.character_finance ENABLE ROW LEVEL SECURITY;

--
-- Name: character_gear; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.character_gear ENABLE ROW LEVEL SECURITY;

--
-- Name: character_lifepath; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.character_lifepath ENABLE ROW LEVEL SECURITY;

--
-- Name: character_role_ability; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.character_role_ability ENABLE ROW LEVEL SECURITY;

--
-- Name: character_skills; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.character_skills ENABLE ROW LEVEL SECURITY;

--
-- Name: character_stats; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.character_stats ENABLE ROW LEVEL SECURITY;

--
-- Name: characters; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.characters ENABLE ROW LEVEL SECURITY;

--
-- Name: chargen_drafts; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.chargen_drafts ENABLE ROW LEVEL SECURITY;

--
-- Name: encounter_combatants; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.encounter_combatants ENABLE ROW LEVEL SECURITY;

--
-- Name: encounters; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.encounters ENABLE ROW LEVEL SECURITY;

--
-- Name: campaign_cyberware insert own campaign_cyberware; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "insert own campaign_cyberware" ON public.campaign_cyberware FOR INSERT TO authenticated WITH CHECK (public.owns_campaign(campaign_id));


--
-- Name: mission_progress; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.mission_progress ENABLE ROW LEVEL SECURITY;

--
-- Name: campaign_clocks own campaign_clocks; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "own campaign_clocks" ON public.campaign_clocks TO authenticated USING (public.owns_campaign(campaign_id)) WITH CHECK (public.owns_campaign(campaign_id));


--
-- Name: campaign_factions own campaign_factions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "own campaign_factions" ON public.campaign_factions TO authenticated USING (public.owns_campaign(campaign_id)) WITH CHECK (public.owns_campaign(campaign_id));


--
-- Name: campaign_flags own campaign_flags; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "own campaign_flags" ON public.campaign_flags TO authenticated USING (public.owns_campaign(campaign_id)) WITH CHECK (public.owns_campaign(campaign_id));


--
-- Name: campaign_inventory own campaign_inventory; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "own campaign_inventory" ON public.campaign_inventory TO authenticated USING (public.owns_campaign(campaign_id)) WITH CHECK (public.owns_campaign(campaign_id));


--
-- Name: campaign_npcs own campaign_npcs; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "own campaign_npcs" ON public.campaign_npcs TO authenticated USING (public.owns_campaign(campaign_id)) WITH CHECK (public.owns_campaign(campaign_id));


--
-- Name: campaign_places own campaign_places; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "own campaign_places" ON public.campaign_places TO authenticated USING (public.owns_campaign(campaign_id)) WITH CHECK (public.owns_campaign(campaign_id));


--
-- Name: campaign_situations own campaign_situations; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "own campaign_situations" ON public.campaign_situations TO authenticated USING (public.owns_campaign(campaign_id)) WITH CHECK (public.owns_campaign(campaign_id));


--
-- Name: campaign_truths own campaign_truths; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "own campaign_truths" ON public.campaign_truths TO authenticated USING (public.owns_campaign(campaign_id)) WITH CHECK (public.owns_campaign(campaign_id));


--
-- Name: campaign_vitals own campaign_vitals; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "own campaign_vitals" ON public.campaign_vitals TO authenticated USING (public.owns_campaign(campaign_id)) WITH CHECK (public.owns_campaign(campaign_id));


--
-- Name: campaigns own campaigns; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "own campaigns" ON public.campaigns TO authenticated USING ((auth.uid() = user_id)) WITH CHECK ((auth.uid() = user_id));


--
-- Name: character_cyberware own character_cyberware; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "own character_cyberware" ON public.character_cyberware TO authenticated USING (public.owns_character(character_id)) WITH CHECK (public.owns_character(character_id));


--
-- Name: character_finance own character_finance; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "own character_finance" ON public.character_finance TO authenticated USING (public.owns_character(character_id)) WITH CHECK (public.owns_character(character_id));


--
-- Name: character_gear own character_gear; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "own character_gear" ON public.character_gear TO authenticated USING (public.owns_character(character_id)) WITH CHECK (public.owns_character(character_id));


--
-- Name: character_lifepath own character_lifepath; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "own character_lifepath" ON public.character_lifepath TO authenticated USING (public.owns_character(character_id)) WITH CHECK (public.owns_character(character_id));


--
-- Name: character_role_ability own character_role_ability; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "own character_role_ability" ON public.character_role_ability TO authenticated USING (public.owns_character(character_id)) WITH CHECK (public.owns_character(character_id));


--
-- Name: character_skills own character_skills; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "own character_skills" ON public.character_skills TO authenticated USING (public.owns_character(character_id)) WITH CHECK (public.owns_character(character_id));


--
-- Name: character_stats own character_stats; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "own character_stats" ON public.character_stats TO authenticated USING (public.owns_character(character_id)) WITH CHECK (public.owns_character(character_id));


--
-- Name: characters own characters; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "own characters" ON public.characters TO authenticated USING ((auth.uid() = user_id)) WITH CHECK ((auth.uid() = user_id));


--
-- Name: chargen_drafts own chargen_drafts; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "own chargen_drafts" ON public.chargen_drafts TO authenticated USING ((auth.uid() = user_id)) WITH CHECK ((auth.uid() = user_id));


--
-- Name: encounter_combatants own encounter_combatants; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "own encounter_combatants" ON public.encounter_combatants TO authenticated USING (public.owns_encounter(encounter_id)) WITH CHECK (public.owns_encounter(encounter_id));


--
-- Name: encounters own encounters; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "own encounters" ON public.encounters TO authenticated USING (public.owns_campaign(campaign_id)) WITH CHECK (public.owns_campaign(campaign_id));


--
-- Name: mission_progress own mission_progress; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "own mission_progress" ON public.mission_progress TO authenticated USING (public.owns_campaign(campaign_id)) WITH CHECK (public.owns_campaign(campaign_id));


--
-- Name: campaign_cyberware read own campaign_cyberware; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "read own campaign_cyberware" ON public.campaign_cyberware FOR SELECT TO authenticated USING (public.owns_campaign(campaign_id));


--
-- Name: campaign_events read own campaign_events; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "read own campaign_events" ON public.campaign_events FOR SELECT TO authenticated USING (public.owns_campaign(campaign_id));


--
-- Name: campaign_cyberware update own campaign_cyberware; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "update own campaign_cyberware" ON public.campaign_cyberware FOR UPDATE TO authenticated USING (public.owns_campaign(campaign_id)) WITH CHECK (public.owns_campaign(campaign_id));


--
-- Name: SCHEMA public; Type: ACL; Schema: -; Owner: -
--

GRANT USAGE ON SCHEMA public TO anon;
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT USAGE ON SCHEMA public TO service_role;


--
-- Name: FUNCTION close_aftermath(payload jsonb); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.close_aftermath(payload jsonb) FROM PUBLIC;
GRANT ALL ON FUNCTION public.close_aftermath(payload jsonb) TO authenticated;
GRANT ALL ON FUNCTION public.close_aftermath(payload jsonb) TO service_role;


--
-- Name: FUNCTION install_cyberware(payload jsonb); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.install_cyberware(payload jsonb) TO authenticated;


--
-- Name: FUNCTION owns_character(_character_id uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.owns_character(_character_id uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.owns_character(_character_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.owns_character(_character_id uuid) TO service_role;


--
-- Name: FUNCTION save_character(payload jsonb); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.save_character(payload jsonb) FROM PUBLIC;
GRANT ALL ON FUNCTION public.save_character(payload jsonb) TO authenticated;


--
-- Name: FUNCTION save_encounter_state(payload jsonb); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.save_encounter_state(payload jsonb) FROM PUBLIC;
GRANT ALL ON FUNCTION public.save_encounter_state(payload jsonb) TO authenticated;
GRANT ALL ON FUNCTION public.save_encounter_state(payload jsonb) TO service_role;


--
-- Name: FUNCTION set_updated_at(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.set_updated_at() FROM PUBLIC;


--
-- Name: FUNCTION settle_job(payload jsonb); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.settle_job(payload jsonb) FROM PUBLIC;
GRANT ALL ON FUNCTION public.settle_job(payload jsonb) TO authenticated;
GRANT ALL ON FUNCTION public.settle_job(payload jsonb) TO service_role;


--
-- Name: FUNCTION spend_ip_on_skill(p_character_id uuid, p_skill_id text, p_new_level integer, p_cost integer, p_specialization text); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.spend_ip_on_skill(p_character_id uuid, p_skill_id text, p_new_level integer, p_cost integer, p_specialization text) TO authenticated;


--
-- Name: TABLE campaign_clocks; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.campaign_clocks TO authenticated;
GRANT ALL ON TABLE public.campaign_clocks TO service_role;


--
-- Name: TABLE campaign_cyberware; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,UPDATE ON TABLE public.campaign_cyberware TO authenticated;
GRANT ALL ON TABLE public.campaign_cyberware TO service_role;


--
-- Name: SEQUENCE campaign_events_seq; Type: ACL; Schema: public; Owner: -
--

GRANT USAGE ON SEQUENCE public.campaign_events_seq TO authenticated;
GRANT ALL ON SEQUENCE public.campaign_events_seq TO service_role;


--
-- Name: TABLE campaign_events; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT ON TABLE public.campaign_events TO authenticated;
GRANT ALL ON TABLE public.campaign_events TO service_role;


--
-- Name: TABLE campaign_factions; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.campaign_factions TO authenticated;
GRANT ALL ON TABLE public.campaign_factions TO service_role;


--
-- Name: TABLE campaign_flags; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.campaign_flags TO authenticated;
GRANT ALL ON TABLE public.campaign_flags TO service_role;


--
-- Name: TABLE campaign_inventory; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.campaign_inventory TO authenticated;
GRANT ALL ON TABLE public.campaign_inventory TO service_role;


--
-- Name: TABLE campaign_npcs; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.campaign_npcs TO authenticated;
GRANT ALL ON TABLE public.campaign_npcs TO service_role;


--
-- Name: TABLE campaign_places; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.campaign_places TO authenticated;
GRANT ALL ON TABLE public.campaign_places TO service_role;


--
-- Name: TABLE campaign_situations; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.campaign_situations TO authenticated;
GRANT ALL ON TABLE public.campaign_situations TO service_role;


--
-- Name: TABLE campaign_truths; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.campaign_truths TO authenticated;
GRANT ALL ON TABLE public.campaign_truths TO service_role;


--
-- Name: TABLE campaign_vitals; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.campaign_vitals TO authenticated;
GRANT ALL ON TABLE public.campaign_vitals TO service_role;


--
-- Name: TABLE campaigns; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.campaigns TO authenticated;
GRANT ALL ON TABLE public.campaigns TO service_role;


--
-- Name: TABLE character_cyberware; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.character_cyberware TO authenticated;
GRANT ALL ON TABLE public.character_cyberware TO service_role;


--
-- Name: TABLE character_finance; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.character_finance TO authenticated;
GRANT ALL ON TABLE public.character_finance TO service_role;


--
-- Name: TABLE character_gear; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.character_gear TO authenticated;
GRANT ALL ON TABLE public.character_gear TO service_role;


--
-- Name: TABLE character_lifepath; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.character_lifepath TO authenticated;
GRANT ALL ON TABLE public.character_lifepath TO service_role;


--
-- Name: TABLE character_role_ability; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.character_role_ability TO authenticated;
GRANT ALL ON TABLE public.character_role_ability TO service_role;


--
-- Name: TABLE character_skills; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.character_skills TO authenticated;
GRANT ALL ON TABLE public.character_skills TO service_role;


--
-- Name: TABLE character_stats; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.character_stats TO authenticated;
GRANT ALL ON TABLE public.character_stats TO service_role;


--
-- Name: TABLE characters; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.characters TO authenticated;
GRANT ALL ON TABLE public.characters TO service_role;


--
-- Name: TABLE chargen_drafts; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.chargen_drafts TO authenticated;
GRANT ALL ON TABLE public.chargen_drafts TO service_role;


--
-- Name: TABLE encounter_combatants; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.encounter_combatants TO authenticated;
GRANT ALL ON TABLE public.encounter_combatants TO service_role;


--
-- Name: TABLE encounters; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.encounters TO authenticated;
GRANT ALL ON TABLE public.encounters TO service_role;


--
-- Name: TABLE mission_progress; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.mission_progress TO authenticated;
GRANT ALL ON TABLE public.mission_progress TO service_role;


--
-- PostgreSQL database dump complete
--


