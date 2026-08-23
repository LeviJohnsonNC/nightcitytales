-- ---------------------------------------------------------------------------
-- Campaigns (play engine)
-- ---------------------------------------------------------------------------
CREATE TABLE public.campaigns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  character_id uuid NOT NULL REFERENCES public.characters(id) ON DELETE CASCADE,
  name text NOT NULL,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','won','lost','abandoned')),
  current_mission_id text,
  day integer NOT NULL DEFAULT 1,
  minute integer NOT NULL DEFAULT 1080,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX campaigns_one_active_per_character
  ON public.campaigns (character_id) WHERE status = 'active';
CREATE INDEX campaigns_user_idx ON public.campaigns (user_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.campaigns TO authenticated;
GRANT ALL ON public.campaigns TO service_role;
ALTER TABLE public.campaigns ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own campaigns" ON public.campaigns FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER campaigns_set_updated_at BEFORE UPDATE ON public.campaigns
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Ownership helper used by every child table's policies.
CREATE OR REPLACE FUNCTION public.owns_campaign(_campaign_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.campaigns c WHERE c.id = _campaign_id AND c.user_id = auth.uid()
  );
$$;

-- ---------------------------------------------------------------------------
-- Vitals
-- ---------------------------------------------------------------------------
CREATE TABLE public.campaign_vitals (
  campaign_id uuid PRIMARY KEY REFERENCES public.campaigns(id) ON DELETE CASCADE,
  hp_current integer NOT NULL,
  hp_max integer NOT NULL,
  seriously_wounded_threshold integer NOT NULL,
  humanity_current integer NOT NULL,
  humanity_max integer NOT NULL,
  wound_state text NOT NULL DEFAULT 'none' CHECK (wound_state IN ('none','light','serious','mortal')),
  mortal_save_failures integer NOT NULL DEFAULT 0,
  eurobucks integer NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.campaign_vitals TO authenticated;
GRANT ALL ON public.campaign_vitals TO service_role;
ALTER TABLE public.campaign_vitals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own campaign_vitals" ON public.campaign_vitals FOR ALL TO authenticated
  USING (public.owns_campaign(campaign_id)) WITH CHECK (public.owns_campaign(campaign_id));
CREATE TRIGGER campaign_vitals_set_updated_at BEFORE UPDATE ON public.campaign_vitals
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Inventory
-- ---------------------------------------------------------------------------
CREATE TABLE public.campaign_inventory (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid NOT NULL REFERENCES public.campaigns(id) ON DELETE CASCADE,
  kind text NOT NULL DEFAULT 'gear' CHECK (kind IN ('gear','cyberware')),
  item_id text NOT NULL,
  quantity integer NOT NULL DEFAULT 1,
  equipped boolean NOT NULL DEFAULT false,
  slot text,
  current_sp integer,
  notes text
);
CREATE INDEX campaign_inventory_campaign_idx ON public.campaign_inventory (campaign_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.campaign_inventory TO authenticated;
GRANT ALL ON public.campaign_inventory TO service_role;
ALTER TABLE public.campaign_inventory ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own campaign_inventory" ON public.campaign_inventory FOR ALL TO authenticated
  USING (public.owns_campaign(campaign_id)) WITH CHECK (public.owns_campaign(campaign_id));

-- ---------------------------------------------------------------------------
-- NPCs / factions / flags
-- ---------------------------------------------------------------------------
CREATE TABLE public.campaign_npcs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid NOT NULL REFERENCES public.campaigns(id) ON DELETE CASCADE,
  npc_id text,
  name text NOT NULL,
  status text NOT NULL DEFAULT 'alive' CHECK (status IN ('alive','dead','fled','unknown')),
  disposition integer NOT NULL DEFAULT 0 CHECK (disposition BETWEEN -3 AND 3),
  location text,
  notes text,
  data jsonb NOT NULL DEFAULT '{}'::jsonb
);
CREATE INDEX campaign_npcs_campaign_idx ON public.campaign_npcs (campaign_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.campaign_npcs TO authenticated;
GRANT ALL ON public.campaign_npcs TO service_role;
ALTER TABLE public.campaign_npcs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own campaign_npcs" ON public.campaign_npcs FOR ALL TO authenticated
  USING (public.owns_campaign(campaign_id)) WITH CHECK (public.owns_campaign(campaign_id));

CREATE TABLE public.campaign_factions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid NOT NULL REFERENCES public.campaigns(id) ON DELETE CASCADE,
  faction_id text NOT NULL,
  name text NOT NULL,
  standing integer NOT NULL DEFAULT 0,
  notes text
);
CREATE INDEX campaign_factions_campaign_idx ON public.campaign_factions (campaign_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.campaign_factions TO authenticated;
GRANT ALL ON public.campaign_factions TO service_role;
ALTER TABLE public.campaign_factions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own campaign_factions" ON public.campaign_factions FOR ALL TO authenticated
  USING (public.owns_campaign(campaign_id)) WITH CHECK (public.owns_campaign(campaign_id));

CREATE TABLE public.campaign_flags (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid NOT NULL REFERENCES public.campaigns(id) ON DELETE CASCADE,
  flag text NOT NULL,
  value jsonb NOT NULL DEFAULT 'true'::jsonb,
  UNIQUE (campaign_id, flag)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.campaign_flags TO authenticated;
GRANT ALL ON public.campaign_flags TO service_role;
ALTER TABLE public.campaign_flags ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own campaign_flags" ON public.campaign_flags FOR ALL TO authenticated
  USING (public.owns_campaign(campaign_id)) WITH CHECK (public.owns_campaign(campaign_id));

-- ---------------------------------------------------------------------------
-- Event ledger
-- ---------------------------------------------------------------------------
CREATE SEQUENCE public.campaign_events_seq;
CREATE TABLE public.campaign_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid NOT NULL REFERENCES public.campaigns(id) ON DELETE CASCADE,
  seq bigint NOT NULL DEFAULT nextval('public.campaign_events_seq'),
  type text NOT NULL,
  summary text,
  beat_id text,
  roll jsonb,
  data jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX campaign_events_campaign_seq_idx ON public.campaign_events (campaign_id, seq);
GRANT SELECT, INSERT ON public.campaign_events TO authenticated;
GRANT USAGE ON SEQUENCE public.campaign_events_seq TO authenticated;
GRANT ALL ON public.campaign_events TO service_role;
GRANT ALL ON SEQUENCE public.campaign_events_seq TO service_role;
ALTER TABLE public.campaign_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "read own campaign_events" ON public.campaign_events FOR SELECT TO authenticated
  USING (public.owns_campaign(campaign_id));
CREATE POLICY "append own campaign_events" ON public.campaign_events FOR INSERT TO authenticated
  WITH CHECK (public.owns_campaign(campaign_id));

-- ---------------------------------------------------------------------------
-- Mission progress
-- ---------------------------------------------------------------------------
CREATE TABLE public.mission_progress (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid NOT NULL REFERENCES public.campaigns(id) ON DELETE CASCADE,
  mission_id text NOT NULL,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','completed','failed','abandoned')),
  current_beat_id text,
  completed_beats jsonb NOT NULL DEFAULT '[]'::jsonb,
  branch_choices jsonb NOT NULL DEFAULT '{}'::jsonb,
  objectives jsonb NOT NULL DEFAULT '[]'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (campaign_id, mission_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.mission_progress TO authenticated;
GRANT ALL ON public.mission_progress TO service_role;
ALTER TABLE public.mission_progress ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own mission_progress" ON public.mission_progress FOR ALL TO authenticated
  USING (public.owns_campaign(campaign_id)) WITH CHECK (public.owns_campaign(campaign_id));
CREATE TRIGGER mission_progress_set_updated_at BEFORE UPDATE ON public.mission_progress
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Encounters
-- ---------------------------------------------------------------------------
CREATE TABLE public.encounters (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid NOT NULL REFERENCES public.campaigns(id) ON DELETE CASCADE,
  name text,
  beat_id text,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','resolved','fled','abandoned')),
  round integer NOT NULL DEFAULT 1,
  active_index integer NOT NULL DEFAULT 0,
  order_ids jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX encounters_campaign_idx ON public.encounters (campaign_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.encounters TO authenticated;
GRANT ALL ON public.encounters TO service_role;
ALTER TABLE public.encounters ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own encounters" ON public.encounters FOR ALL TO authenticated
  USING (public.owns_campaign(campaign_id)) WITH CHECK (public.owns_campaign(campaign_id));
CREATE TRIGGER encounters_set_updated_at BEFORE UPDATE ON public.encounters
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE OR REPLACE FUNCTION public.owns_encounter(_encounter_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.encounters e
    JOIN public.campaigns c ON c.id = e.campaign_id
    WHERE e.id = _encounter_id AND c.user_id = auth.uid()
  );
$$;

CREATE TABLE public.encounter_combatants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  encounter_id uuid NOT NULL REFERENCES public.encounters(id) ON DELETE CASCADE,
  character_id uuid REFERENCES public.characters(id) ON DELETE SET NULL,
  is_player boolean NOT NULL DEFAULT false,
  name text NOT NULL,
  side text NOT NULL DEFAULT 'hostile' CHECK (side IN ('friendly','hostile','neutral')),
  ref integer NOT NULL,
  body integer NOT NULL,
  hp_max integer NOT NULL,
  hp_current integer NOT NULL,
  seriously_wounded_threshold integer NOT NULL,
  wound_state text NOT NULL DEFAULT 'none' CHECK (wound_state IN ('none','light','serious','mortal')),
  death_save_penalty integer NOT NULL DEFAULT 0,
  sp_head integer NOT NULL DEFAULT 0,
  sp_body integer NOT NULL DEFAULT 0,
  initiative integer,
  defeated boolean NOT NULL DEFAULT false,
  data jsonb NOT NULL DEFAULT '{}'::jsonb
);
CREATE INDEX encounter_combatants_encounter_idx ON public.encounter_combatants (encounter_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.encounter_combatants TO authenticated;
GRANT ALL ON public.encounter_combatants TO service_role;
ALTER TABLE public.encounter_combatants ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own encounter_combatants" ON public.encounter_combatants FOR ALL TO authenticated
  USING (public.owns_encounter(encounter_id)) WITH CHECK (public.owns_encounter(encounter_id));

-- ---------------------------------------------------------------------------
-- start_campaign(payload jsonb) -> campaign id
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.start_campaign(payload jsonb)
RETURNS uuid LANGUAGE plpgsql SET search_path TO 'public' AS $$
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
  )
  RETURNING id INTO v_campaign;

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
    'none',
    0,
    coalesce(v_eb, 0)
  );

  INSERT INTO public.campaign_inventory (campaign_id, kind, item_id, quantity, equipped, slot, current_sp, notes)
  SELECT v_campaign, 'gear', g.item_id, g.quantity, g.equipped, g.slot, g.current_sp, g.notes
    FROM public.character_gear g WHERE g.character_id = v_char.id;

  INSERT INTO public.campaign_inventory (campaign_id, kind, item_id, quantity, equipped, slot, notes)
  SELECT v_campaign, 'cyberware', c.item_id, 1, true, c.install_location, NULL
    FROM public.character_cyberware c WHERE c.character_id = v_char.id;

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

-- ---------------------------------------------------------------------------
-- start_encounter(payload jsonb) -> encounter id
-- ---------------------------------------------------------------------------
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

  INSERT INTO public.encounters (campaign_id, name, beat_id, active_index, order_ids)
  VALUES (
    v_campaign,
    payload->>'name',
    payload->>'beat_id',
    coalesce((payload->>'active_index')::int, 0),
    coalesce(payload->'order_ids', '[]'::jsonb)
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