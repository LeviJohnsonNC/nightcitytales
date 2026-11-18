CREATE OR REPLACE FUNCTION public.record_life_check(payload jsonb)
RETURNS boolean
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_campaign uuid := (payload->>'campaign_id')::uuid;
  v_prompt uuid := (payload->'data'->>'prompt_event_id')::uuid;
  v_expected integer := (payload->>'expected_luck')::integer;
  v_character uuid;
  v_max integer;
  v_spend integer := coalesce((payload->'data'->>'luck_spent')::integer, 0);
  v_pool integer;
  v_before integer;
BEGIN
  SELECT character_id INTO v_character FROM public.campaigns
    WHERE id = v_campaign AND user_id = auth.uid()
    AND phase IN ('life', 'hook') AND status = 'active'
  FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'active Life campaign not found'; END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.campaign_events
    WHERE campaign_id = v_campaign AND id = v_prompt AND type = 'check_prompt'
  ) THEN RAISE EXCEPTION 'check prompt not found'; END IF;

  IF EXISTS (
    SELECT 1 FROM public.campaign_events
    WHERE campaign_id = v_campaign AND type = 'skill_check'
      AND data->>'prompt_event_id' = v_prompt::text
  ) THEN RETURN false; END IF;

  IF v_spend < 0 THEN
    RAISE EXCEPTION 'invalid Luck spend';
  END IF;

  IF v_spend > 0 THEN
    SELECT greatest(0, luck) INTO v_max FROM public.character_stats WHERE character_id = v_character;
    v_max := coalesce(v_max, 0);
    SELECT luck_current INTO v_pool FROM public.campaign_vitals
    WHERE campaign_id = v_campaign FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'campaign vitals not found'; END IF;
    v_before := least(v_max, greatest(0, coalesce(v_pool, v_max)));
    IF v_pool IS DISTINCT FROM v_expected OR v_spend > v_before THEN
      RAISE EXCEPTION 'the Luck pool changed before the roll was saved';
    END IF;
    UPDATE public.campaign_vitals SET luck_current = v_before - v_spend
    WHERE campaign_id = v_campaign;
  END IF;

  INSERT INTO public.campaign_events (campaign_id, type, summary, roll, data)
  VALUES (v_campaign, 'skill_check', payload->>'summary', payload->'roll', payload->'data');

  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION public.record_life_check(jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.record_life_check(jsonb) TO authenticated;