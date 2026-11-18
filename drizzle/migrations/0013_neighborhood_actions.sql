CREATE FUNCTION public.commit_neighborhood_action(payload jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
DECLARE
  c public.campaigns%rowtype;
  v public.campaign_vitals%rowtype;
  req uuid := (payload->>'request_id')::uuid;
  act text := payload->>'action';
  prior jsonb;
  state jsonb;
  expected jsonb := payload->'expected';
  stage text;
  venue text;
  role_id text;
  eligible boolean := true;
  minutes integer := (payload->>'minutes')::integer;
  price integer := (payload->>'cost')::integer;
  healing integer := (payload->>'heal')::integer;
  wound text := payload->>'wound';
  end_min integer;
  end_day integer;
  patch jsonb;
  receipt jsonb;
BEGIN
  SELECT * INTO c FROM public.campaigns WHERE id = (payload->>'campaign_id')::uuid
    AND user_id = auth.uid() FOR UPDATE;
  IF NOT FOUND OR req IS NULL THEN RAISE EXCEPTION 'Campaign or request missing.'; END IF;
  SELECT data INTO prior FROM public.campaign_events WHERE id = req AND campaign_id = c.id AND type = 'neighborhood_action';
  IF FOUND THEN
    IF prior->>'action' IS DISTINCT FROM act THEN RAISE EXCEPTION 'Request already used.'; END IF;
    RETURN prior;
  END IF;
  IF c.phase <> 'life' OR c.status <> 'active' OR EXISTS
    (SELECT 1 FROM public.encounters WHERE campaign_id = c.id AND status = 'active')
  THEN RAISE EXCEPTION 'Come back between jobs and encounters.'; END IF;

  SELECT * INTO STRICT v FROM public.campaign_vitals WHERE campaign_id = c.id FOR UPDATE;
  SELECT value INTO state FROM public.campaign_flags WHERE campaign_id = c.id AND flag = 'old_japantown_neighborhood' FOR UPDATE;
  state := coalesce(state,'{}'::jsonb);
  IF expected IS DISTINCT FROM jsonb_build_object('day',c.day,'minute',c.minute,
    'location',c.location_key,'hp',v.hp_current,'cash',v.eurobucks,'state',state)
  THEN RAISE EXCEPTION 'The neighborhood changed. Check the latest scene.'; END IF;

  SELECT role INTO role_id FROM public.characters WHERE id = c.character_id;
  CASE
    WHEN act IN ('ticket','fixer','medtech','nomad') THEN
      stage := 'counterLead'; venue := 'h8'; eligible := act = 'ticket' OR act = role_id;
    WHEN act IN ('kit','bowls','split') THEN
      stage := 'counterResult'; venue := 'h8';
      eligible := state ? 'counterLead' AND (act <> 'split' OR state->>'counterLead' IN ('fixer','medtech','nomad'));
    WHEN act IN ('listen','rockerboy','tech','media','netrunner','lawman','exec','solo') THEN
      stage := 'lanternLead'; venue := 'h7'; eligible := act = 'listen' OR act = role_id;
    WHEN act IN ('benefit','door') THEN
      stage := 'lanternResult'; venue := 'h7'; eligible := state ? 'lanternLead';
    WHEN act = 'keys' THEN stage := 'keys'; venue := 'h5';
    WHEN act = 'staff' THEN stage := 'staff'; venue := 'h1'; eligible := state ? 'keys';
    WHEN act IN ('buy','collect','unload') THEN
      stage := 'equipment'; venue := 'h4';
      eligible := state ? 'staff' AND (act <> 'collect' OR state->>'counterResult' IN ('kit','split'));
    WHEN act IN ('residents','kimen') THEN
      stage := 'lease'; venue := 'h5'; eligible := state ? 'equipment';
    WHEN act = 'care' THEN
      stage := 'careDay'; venue := 'h5';
      eligible := state ? 'lease' AND v.hp_current > 0 AND v.hp_current < v.hp_max
        AND (state->>'careDay')::integer IS DISTINCT FROM c.day;
    ELSE RAISE EXCEPTION 'Unknown neighborhood action.';
  END CASE;
  IF eligible IS NOT TRUE OR split_part(lower(trim(c.location_key)),'@',1) IS DISTINCT FROM venue
    OR (act <> 'care' AND state ? stage) THEN RAISE EXCEPTION 'That opportunity has changed.'; END IF;
  -- Verify the shape of the engine's quote. Only the two purchases can spend,
  -- only the open clinic can restore HP, and no receipt can mint either cash or time.
  IF price IS NULL OR price NOT BETWEEN 0 AND v.eurobucks OR
    (price > 0) IS DISTINCT FROM (act IN ('buy','residents')) OR
    healing IS NULL OR healing < 0 OR (healing > 0) IS DISTINCT FROM (act='care') OR
    (healing > 0 AND (healing > v.hp_max-v.hp_current OR wound IS NULL OR wound NOT IN ('none','light','serious')))
  THEN RAISE EXCEPTION 'Incorrect price or care.'; END IF;
  IF minutes IS NULL OR minutes NOT BETWEEN 1 AND 720 THEN RAISE EXCEPTION 'Incorrect time quote.'; END IF;
  end_day := c.day + (c.minute + minutes) / 1440;
  end_min := (c.minute + minutes) % 1440;
  patch := CASE WHEN act = 'care' THEN jsonb_build_object(stage,end_day) ELSE jsonb_build_object(stage,act) END;
  IF payload->'patch' IS DISTINCT FROM patch OR payload->'clock' IS DISTINCT FROM jsonb_build_object('day',end_day,'minute',end_min)
     OR nullif(trim(payload->>'summary'),'') IS NULL THEN RAISE EXCEPTION 'Incomplete neighborhood receipt.'; END IF;
  UPDATE public.campaigns SET day=end_day, minute=end_min WHERE id=c.id;
  UPDATE public.campaign_vitals SET eurobucks=eurobucks-price, hp_current=hp_current+healing,
    wound_state=CASE WHEN healing>0 THEN wound ELSE wound_state END WHERE campaign_id=c.id;
  INSERT INTO public.campaign_flags(campaign_id,flag,value) VALUES(c.id,'old_japantown_neighborhood',state || patch)
    ON CONFLICT(campaign_id,flag) DO UPDATE SET value=excluded.value;
  receipt := jsonb_build_object('action',act,'place',venue,'day',end_day,'minutes',minutes,'cost',price,'healed',healing);
  INSERT INTO public.campaign_events(id,campaign_id,type,summary,data) VALUES(req,c.id,'neighborhood_action',payload->>'summary',receipt);
  RETURN receipt;
END;
$$;
REVOKE ALL ON FUNCTION public.commit_neighborhood_action(payload jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.commit_neighborhood_action(jsonb) TO authenticated, service_role;