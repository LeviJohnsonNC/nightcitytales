-- Play engine (Phase 0): the persistent campaign-state spine.
--
-- Architecture: the rules engine owns truth; the AI GM only narrates state and
-- proposes changes the engine validates. These tables ARE that truth store, so a
-- long campaign never drifts on the transcript. One active campaign per
-- character (single-player, permadeath), its live vitals and inventory, world /
-- NPC / faction memory, per-mission beat progress, and an append-only event
-- ledger (which also satisfies the roll-traceability requirement).
--
-- Conventions mirror the character tables exactly: per-table RLS scoped to the
-- owner via owns_campaign(), GRANTs to authenticated + service_role,
-- set_updated_at triggers, and a single SECURITY INVOKER transactional RPC
-- (start_campaign) modelled on save_character.

-- ===========================================================================
-- campaigns: the top-level playthrough, owned by a user, driven by one character.
-- ===========================================================================
CREATE TABLE public.campaigns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  character_id uuid NOT NULL REFERENCES public.characters(id) ON DELETE CASCADE,
  name text NOT NULL,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','won','lost','abandoned')),
  current_mission_id text,
  world_day int NOT NULL DEFAULT 1 CHECK (world_day >= 1),
  world_minute int NOT NULL DEFAULT 1080 CHECK (world_minute >= 0 AND world_minute <= 1439), -- minute-of-day; 1080 = 18:00
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX campaigns_user_id_idx ON public.campaigns(user_id);
CREATE INDEX campaigns_character_id_idx ON public.campaigns(character_id);
-- A character can protagonist only ONE active campaign at a time. Finished
-- campaigns (won/lost/abandoned) keep their history and free the character.
CREATE UNIQUE INDEX campaigns_one_active_per_character_idx
  ON public.campaigns(character_id) WHERE status = 'active';
GRANT SELECT, INSERT, UPDATE, DELETE ON public.campaigns TO authenticated;
GRANT ALL ON public.campaigns TO service_role;
ALTER TABLE public.campaigns ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own campaigns" ON public.campaigns FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Ownership helper for campaign-scoped child tables, mirroring owns_character.
CREATE OR REPLACE FUNCTION public.owns_campaign(_campaign_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.campaigns c
    WHERE c.id = _campaign_id AND c.user_id = auth.uid()
  );
$$;
REVOKE ALL ON FUNCTION public.owns_campaign(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.owns_campaign(uuid) TO authenticated, service_role;

-- ===========================================================================
-- campaign_vitals: live, mutable HP / Humanity / economy (1:1 with campaign).
-- Snapshotted from the character at start so the as-created sheet stays canonical
-- and a later character edit never rewrites an in-flight campaign.
-- ===========================================================================
CREATE TABLE public.campaign_vitals (
  campaign_id uuid PRIMARY KEY REFERENCES public.campaigns(id) ON DELETE CASCADE,
  hp_current int NOT NULL,
  hp_max int NOT NULL,
  seriously_wounded_threshold int NOT NULL,
  humanity_current int NOT NULL,
  humanity_max int NOT NULL,
  wound_state text NOT NULL DEFAULT 'none' CHECK (wound_state IN ('none','light','serious','mortal')),
  mortal_save_failures int NOT NULL DEFAULT 0,
  eurobucks int NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.campaign_vitals TO authenticated;
GRANT ALL ON public.campaign_vitals TO service_role;
ALTER TABLE public.campaign_vitals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own campaign_vitals" ON public.campaign_vitals FOR ALL TO authenticated
  USING (public.owns_campaign(campaign_id)) WITH CHECK (public.owns_campaign(campaign_id));

-- ===========================================================================
-- campaign_inventory: live gear / ammo / armor, copied from the character at start.
-- ===========================================================================
CREATE TABLE public.campaign_inventory (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid NOT NULL REFERENCES public.campaigns(id) ON DELETE CASCADE,
  item_id text NOT NULL,
  quantity int NOT NULL DEFAULT 1,
  equipped boolean NOT NULL DEFAULT false,
  slot text, -- 'body','head','shield', or null
  current_sp int, -- live armor ablation (Stopping Power)
  ammo_loaded int, -- rounds currently loaded, for weapons
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX campaign_inventory_campaign_id_idx ON public.campaign_inventory(campaign_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.campaign_inventory TO authenticated;
GRANT ALL ON public.campaign_inventory TO service_role;
ALTER TABLE public.campaign_inventory ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own campaign_inventory" ON public.campaign_inventory FOR ALL TO authenticated
  USING (public.owns_campaign(campaign_id)) WITH CHECK (public.owns_campaign(campaign_id));

-- ===========================================================================
-- campaign_npcs: NPC memory. This is what kills "reset button" amnesia — every
-- named NPC the player meets is remembered here with disposition and status.
-- ===========================================================================
CREATE TABLE public.campaign_npcs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid NOT NULL REFERENCES public.campaigns(id) ON DELETE CASCADE,
  npc_key text NOT NULL, -- stable key, e.g. 'trace-santiago'
  name text NOT NULL,
  disposition int NOT NULL DEFAULT 0 CHECK (disposition BETWEEN -3 AND 3), -- engine scale: -3 hostile .. +3 devoted
  status text NOT NULL DEFAULT 'alive' CHECK (status IN ('alive','dead','fled','unknown')),
  location text,
  knowledge jsonb NOT NULL DEFAULT '[]'::jsonb, -- facts / flags this NPC knows
  first_met_beat_id text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (campaign_id, npc_key)
);
CREATE INDEX campaign_npcs_campaign_id_idx ON public.campaign_npcs(campaign_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.campaign_npcs TO authenticated;
GRANT ALL ON public.campaign_npcs TO service_role;
ALTER TABLE public.campaign_npcs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own campaign_npcs" ON public.campaign_npcs FOR ALL TO authenticated
  USING (public.owns_campaign(campaign_id)) WITH CHECK (public.owns_campaign(campaign_id));

-- ===========================================================================
-- campaign_factions: faction reputation. Factions react to what the player does.
-- ===========================================================================
CREATE TABLE public.campaign_factions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid NOT NULL REFERENCES public.campaigns(id) ON DELETE CASCADE,
  faction_id text NOT NULL, -- e.g. 'tyger-claws', 'ncpd', 'nomads'
  reputation int NOT NULL DEFAULT 0, -- engine-defined scale; negative = hostile
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (campaign_id, faction_id)
);
CREATE INDEX campaign_factions_campaign_id_idx ON public.campaign_factions(campaign_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.campaign_factions TO authenticated;
GRANT ALL ON public.campaign_factions TO service_role;
ALTER TABLE public.campaign_factions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own campaign_factions" ON public.campaign_factions FOR ALL TO authenticated
  USING (public.owns_campaign(campaign_id)) WITH CHECK (public.owns_campaign(campaign_id));

-- ===========================================================================
-- campaign_flags: arbitrary world / quest state as key -> jsonb value. The
-- compounding-consequences store ("rescued Nat", "burned the Fixer").
-- ===========================================================================
CREATE TABLE public.campaign_flags (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid NOT NULL REFERENCES public.campaigns(id) ON DELETE CASCADE,
  key text NOT NULL,
  value jsonb NOT NULL DEFAULT 'true'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (campaign_id, key)
);
CREATE INDEX campaign_flags_campaign_id_idx ON public.campaign_flags(campaign_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.campaign_flags TO authenticated;
GRANT ALL ON public.campaign_flags TO service_role;
ALTER TABLE public.campaign_flags ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own campaign_flags" ON public.campaign_flags FOR ALL TO authenticated
  USING (public.owns_campaign(campaign_id)) WITH CHECK (public.owns_campaign(campaign_id));

-- ===========================================================================
-- mission_progress: per-mission beat-graph position and branch history.
-- ===========================================================================
CREATE TABLE public.mission_progress (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid NOT NULL REFERENCES public.campaigns(id) ON DELETE CASCADE,
  mission_id text NOT NULL, -- content key, e.g. 'night-at-the-opera'
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','completed','failed','abandoned')),
  current_beat_id text,
  completed_beats jsonb NOT NULL DEFAULT '[]'::jsonb, -- array of beat ids
  branch_choices jsonb NOT NULL DEFAULT '{}'::jsonb, -- beat_id -> chosen edge
  objectives jsonb NOT NULL DEFAULT '[]'::jsonb, -- [{ id, text, status }]
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (campaign_id, mission_id)
);
CREATE INDEX mission_progress_campaign_id_idx ON public.mission_progress(campaign_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.mission_progress TO authenticated;
GRANT ALL ON public.mission_progress TO service_role;
ALTER TABLE public.mission_progress ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own mission_progress" ON public.mission_progress FOR ALL TO authenticated
  USING (public.owns_campaign(campaign_id)) WITH CHECK (public.owns_campaign(campaign_id));

-- ===========================================================================
-- campaign_events: append-only ledger of everything that happened, including the
-- full roll trace for every die the engine resolved. Immutable by policy:
-- authenticated may read and append, never update or delete.
-- ===========================================================================
CREATE TABLE public.campaign_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  seq bigint GENERATED BY DEFAULT AS IDENTITY, -- monotonic total order
  campaign_id uuid NOT NULL REFERENCES public.campaigns(id) ON DELETE CASCADE,
  type text NOT NULL, -- 'campaign_started','skill_check','narration','beat_advanced',...
  beat_id text,
  summary text,
  roll jsonb, -- the engine RollResult trace, when this event resolved dice
  data jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX campaign_events_campaign_id_seq_idx ON public.campaign_events(campaign_id, seq);
GRANT SELECT, INSERT ON public.campaign_events TO authenticated; -- ledger: no update/delete
GRANT ALL ON public.campaign_events TO service_role;
ALTER TABLE public.campaign_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "read own campaign_events" ON public.campaign_events FOR SELECT TO authenticated
  USING (public.owns_campaign(campaign_id));
CREATE POLICY "append own campaign_events" ON public.campaign_events FOR INSERT TO authenticated
  WITH CHECK (public.owns_campaign(campaign_id));

-- ===========================================================================
-- updated_at triggers (reusing the existing public.set_updated_at()).
-- campaign_events is a ledger and has no updated_at.
-- ===========================================================================
CREATE TRIGGER campaigns_set_updated_at BEFORE UPDATE ON public.campaigns
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER campaign_vitals_set_updated_at BEFORE UPDATE ON public.campaign_vitals
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER campaign_inventory_set_updated_at BEFORE UPDATE ON public.campaign_inventory
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER campaign_npcs_set_updated_at BEFORE UPDATE ON public.campaign_npcs
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER campaign_factions_set_updated_at BEFORE UPDATE ON public.campaign_factions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER campaign_flags_set_updated_at BEFORE UPDATE ON public.campaign_flags
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER mission_progress_set_updated_at BEFORE UPDATE ON public.mission_progress
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ===========================================================================
-- start_campaign: begin a playthrough from a saved character, transactionally.
-- Mirrors save_character: SECURITY INVOKER so the caller's RLS applies to every
-- write. Vitals are initialised SERVER-SIDE from the canonical character rows,
-- never trusted from the client. Payload: { character_id, name, mission_id? }.
-- Returns the new campaign id.
-- ===========================================================================
CREATE OR REPLACE FUNCTION public.start_campaign(payload jsonb)
RETURNS uuid
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_char uuid := (payload->>'character_id')::uuid;
  v_mission text := NULLIF(payload->>'mission_id', '');
  v_name text := COALESCE(NULLIF(trim(payload->>'name'), ''), 'Untitled Run');
  v_complete boolean;
  v_campaign uuid;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;
  IF v_char IS NULL THEN
    RAISE EXCEPTION 'character_id is required';
  END IF;

  -- Ownership + completeness. RLS already scopes this SELECT to the caller.
  SELECT is_complete INTO v_complete
  FROM public.characters
  WHERE id = v_char AND user_id = v_user;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'character not found';
  END IF;
  IF NOT v_complete THEN
    RAISE EXCEPTION 'character is not complete';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.campaigns
    WHERE character_id = v_char AND status = 'active'
  ) THEN
    RAISE EXCEPTION 'character already has an active campaign';
  END IF;

  INSERT INTO public.campaigns (user_id, character_id, name, current_mission_id)
  VALUES (v_user, v_char, v_name, v_mission)
  RETURNING id INTO v_campaign;

  -- Live vitals, snapshotted from the engine-computed character stats.
  INSERT INTO public.campaign_vitals (
    campaign_id, hp_current, hp_max, seriously_wounded_threshold,
    humanity_current, humanity_max, eurobucks
  )
  SELECT
    v_campaign,
    COALESCE(s.hp_max, 0),
    COALESCE(s.hp_max, 0),
    COALESCE(s.seriously_wounded_threshold, 0),
    COALESCE(s.humanity_current, s.humanity_max, 0),
    COALESCE(s.humanity_max, 0),
    COALESCE(f.eurobucks, 0)
  FROM public.character_stats s
  LEFT JOIN public.character_finance f ON f.character_id = s.character_id
  WHERE s.character_id = v_char;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'character has no stats to start a campaign from';
  END IF;

  -- Live inventory, copied from the character's gear. Only armour keeps a slot.
  INSERT INTO public.campaign_inventory (
    campaign_id, item_id, quantity, equipped, slot, current_sp
  )
  SELECT
    v_campaign, g.item_id, g.quantity, g.equipped,
    CASE WHEN g.slot IN ('body','head','shield') THEN g.slot ELSE NULL END,
    g.current_sp
  FROM public.character_gear g
  WHERE g.character_id = v_char;

  -- Optional starting mission.
  IF v_mission IS NOT NULL THEN
    INSERT INTO public.mission_progress (campaign_id, mission_id)
    VALUES (v_campaign, v_mission);
  END IF;

  -- Open the ledger.
  INSERT INTO public.campaign_events (campaign_id, type, summary, data)
  VALUES (
    v_campaign,
    'campaign_started',
    'Campaign started in Night City.',
    jsonb_build_object('character_id', v_char, 'mission_id', v_mission)
  );

  RETURN v_campaign;
END;
$$;

REVOKE ALL ON FUNCTION public.start_campaign(jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.start_campaign(jsonb) TO authenticated;
