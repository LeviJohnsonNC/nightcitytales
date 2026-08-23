-- Play engine (Phase 2b): encounter + combatant state for the combat turn loop.
--
-- The pure engine (src/engine/encounter.ts) owns the sequencing and dice; these
-- tables persist an in-progress fight so it survives a reload and feeds the
-- combat HUD. Conventions mirror the campaign tables: per-table RLS via
-- owns_campaign(), set_updated_at triggers, and a transactional SECURITY INVOKER
-- start_encounter() RPC. Combatant ids are client-generated UUIDs (also the
-- engine's combatant ids), so encounters.order_ids references them directly.

-- ===========================================================================
-- encounters: one fight within a campaign.
-- ===========================================================================
CREATE TABLE public.encounters (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid NOT NULL REFERENCES public.campaigns(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'active'
    CHECK (status IN ('active','friendlies_won','friendlies_lost','resolved')),
  round int NOT NULL DEFAULT 1 CHECK (round >= 1),
  active_index int NOT NULL DEFAULT 0 CHECK (active_index >= 0),
  order_ids jsonb NOT NULL DEFAULT '[]'::jsonb, -- combatant ids in initiative order
  beat_id text,
  name text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX encounters_campaign_id_idx ON public.encounters(campaign_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.encounters TO authenticated;
GRANT ALL ON public.encounters TO service_role;
ALTER TABLE public.encounters ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own encounters" ON public.encounters FOR ALL TO authenticated
  USING (public.owns_campaign(campaign_id)) WITH CHECK (public.owns_campaign(campaign_id));

-- ===========================================================================
-- encounter_combatants: every participant's live combat state.
-- ===========================================================================
CREATE TABLE public.encounter_combatants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  encounter_id uuid NOT NULL REFERENCES public.encounters(id) ON DELETE CASCADE,
  campaign_id uuid NOT NULL REFERENCES public.campaigns(id) ON DELETE CASCADE,
  character_id uuid REFERENCES public.characters(id) ON DELETE SET NULL, -- set for the player's PC
  is_player boolean NOT NULL DEFAULT false,
  name text NOT NULL,
  side text NOT NULL DEFAULT 'hostile' CHECK (side IN ('friendly','hostile','neutral')),
  ref int NOT NULL,
  body int NOT NULL,
  hp_max int NOT NULL,
  hp_current int NOT NULL,
  seriously_wounded_threshold int NOT NULL,
  wound_state text NOT NULL DEFAULT 'none'
    CHECK (wound_state IN ('none','light','serious','mortal')),
  death_save_penalty int NOT NULL DEFAULT 0,
  sp_head int NOT NULL DEFAULT 0,
  sp_body int NOT NULL DEFAULT 0,
  initiative int, -- REF + 1d10 total; null until rolled
  defeated boolean NOT NULL DEFAULT false,
  data jsonb NOT NULL DEFAULT '{}'::jsonb, -- weapon profile, skill values, notes
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX encounter_combatants_encounter_id_idx ON public.encounter_combatants(encounter_id);
CREATE INDEX encounter_combatants_campaign_id_idx ON public.encounter_combatants(campaign_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.encounter_combatants TO authenticated;
GRANT ALL ON public.encounter_combatants TO service_role;
ALTER TABLE public.encounter_combatants ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own encounter_combatants" ON public.encounter_combatants FOR ALL TO authenticated
  USING (public.owns_campaign(campaign_id)) WITH CHECK (public.owns_campaign(campaign_id));

CREATE TRIGGER encounters_set_updated_at BEFORE UPDATE ON public.encounters
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER encounter_combatants_set_updated_at BEFORE UPDATE ON public.encounter_combatants
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ===========================================================================
-- start_encounter: persist a fight the engine has already rolled initiative for.
-- Combatants (with their engine-assigned UUID ids and initiative) come in the
-- payload; this writes the encounter, all combatants, and a ledger event in one
-- transaction. Payload:
--   { campaign_id, name?, beat_id?, active_index?, order_ids: [uuid,...],
--     combatants: [{ id, character_id?, is_player, name, side, ref, body,
--                    hp_max, hp_current, seriously_wounded_threshold,
--                    wound_state?, death_save_penalty?, sp_head?, sp_body?,
--                    initiative?, defeated?, data? }, ...] }
-- Returns the new encounter id.
-- ===========================================================================
CREATE OR REPLACE FUNCTION public.start_encounter(payload jsonb)
RETURNS uuid
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_campaign uuid := (payload->>'campaign_id')::uuid;
  v_encounter uuid;
  v_entry jsonb;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;
  IF v_campaign IS NULL THEN
    RAISE EXCEPTION 'campaign_id is required';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.campaigns WHERE id = v_campaign AND user_id = v_user
  ) THEN
    RAISE EXCEPTION 'campaign not found';
  END IF;

  INSERT INTO public.encounters (campaign_id, name, beat_id, active_index, order_ids)
  VALUES (
    v_campaign,
    NULLIF(trim(payload->>'name'), ''),
    NULLIF(payload->>'beat_id', ''),
    COALESCE((payload->>'active_index')::int, 0),
    COALESCE(payload->'order_ids', '[]'::jsonb)
  )
  RETURNING id INTO v_encounter;

  FOR v_entry IN SELECT * FROM jsonb_array_elements(coalesce(payload->'combatants', '[]'::jsonb))
  LOOP
    INSERT INTO public.encounter_combatants (
      id, encounter_id, campaign_id, character_id, is_player, name, side,
      ref, body, hp_max, hp_current, seriously_wounded_threshold,
      wound_state, death_save_penalty, sp_head, sp_body, initiative, defeated, data
    )
    VALUES (
      COALESCE((v_entry->>'id')::uuid, gen_random_uuid()),
      v_encounter,
      v_campaign,
      NULLIF(v_entry->>'character_id', '')::uuid,
      COALESCE((v_entry->>'is_player')::boolean, false),
      v_entry->>'name',
      COALESCE(NULLIF(v_entry->>'side', ''), 'hostile'),
      (v_entry->>'ref')::int,
      (v_entry->>'body')::int,
      (v_entry->>'hp_max')::int,
      (v_entry->>'hp_current')::int,
      (v_entry->>'seriously_wounded_threshold')::int,
      COALESCE(NULLIF(v_entry->>'wound_state', ''), 'none'),
      COALESCE((v_entry->>'death_save_penalty')::int, 0),
      COALESCE((v_entry->>'sp_head')::int, 0),
      COALESCE((v_entry->>'sp_body')::int, 0),
      (v_entry->>'initiative')::int,
      COALESCE((v_entry->>'defeated')::boolean, false),
      COALESCE(v_entry->'data', '{}'::jsonb)
    );
  END LOOP;

  INSERT INTO public.campaign_events (campaign_id, type, beat_id, summary, data)
  VALUES (
    v_campaign,
    'encounter_started',
    NULLIF(payload->>'beat_id', ''),
    'A fight breaks out.',
    jsonb_build_object('encounter_id', v_encounter)
  );

  RETURN v_encounter;
END;
$$;

REVOKE ALL ON FUNCTION public.start_encounter(jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.start_encounter(jsonb) TO authenticated;
