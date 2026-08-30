-- Live cyberware is its own campaign state. Existing campaigns are intentionally
-- not backfilled: they are disposable during development, and only campaigns
-- started after this migration participate in the ripperdoc flow.

CREATE TABLE public.campaign_cyberware (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid NOT NULL REFERENCES public.campaigns(id) ON DELETE CASCADE,
  item_id text NOT NULL,
  install_location text,
  humanity_loss_rolled integer NOT NULL DEFAULT 0 CHECK (humanity_loss_rolled >= 0),
  foundational_for uuid,
  installed_day integer NOT NULL CHECK (installed_day >= 1),
  installed_by_npc_id uuid,
  source_character_cyberware_id uuid,
  request_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (campaign_id, id),
  UNIQUE (campaign_id, source_character_cyberware_id),
  FOREIGN KEY (campaign_id, foundational_for)
    REFERENCES public.campaign_cyberware(campaign_id, id)
    DEFERRABLE INITIALLY DEFERRED
);

CREATE INDEX campaign_cyberware_campaign_idx ON public.campaign_cyberware(campaign_id);
CREATE INDEX campaign_cyberware_foundation_idx ON public.campaign_cyberware(foundational_for);

-- A composite key keeps an implant from naming another campaign's ripperdoc.
CREATE UNIQUE INDEX campaign_npcs_campaign_id_id_key
  ON public.campaign_npcs(campaign_id, id);

ALTER TABLE public.campaign_cyberware
  ADD CONSTRAINT campaign_cyberware_installed_by_same_campaign_fkey
  FOREIGN KEY (campaign_id, installed_by_npc_id)
  REFERENCES public.campaign_npcs(campaign_id, id)
  DEFERRABLE INITIALLY DEFERRED;

GRANT SELECT, INSERT, UPDATE ON public.campaign_cyberware TO authenticated;
GRANT ALL ON public.campaign_cyberware TO service_role;
ALTER TABLE public.campaign_cyberware ENABLE ROW LEVEL SECURITY;

CREATE POLICY "read own campaign_cyberware"
  ON public.campaign_cyberware FOR SELECT TO authenticated
  USING (public.owns_campaign(campaign_id));

CREATE POLICY "insert own campaign_cyberware"
  ON public.campaign_cyberware FOR INSERT TO authenticated
  WITH CHECK (public.owns_campaign(campaign_id));

CREATE POLICY "update own campaign_cyberware"
  ON public.campaign_cyberware FOR UPDATE TO authenticated
  USING (public.owns_campaign(campaign_id))
  WITH CHECK (public.owns_campaign(campaign_id));

-- Fresh campaigns snapshot the saved cyberware graph into the live table.
CREATE OR REPLACE FUNCTION public.start_campaign(payload jsonb)
RETURNS uuid LANGUAGE plpgsql SECURITY INVOKER SET search_path TO 'public' AS $$
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

-- One durable boundary for money, Humanity, time, the hook choice, chrome, and
-- the immutable receipt. The TypeScript engine supplies the plan; the database
-- validates ownership, identity, expected state, ranges, and relationships.
CREATE OR REPLACE FUNCTION public.install_cyberware(payload jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
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

GRANT EXECUTE ON FUNCTION public.install_cyberware(jsonb) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.install_cyberware(jsonb) FROM anon;
