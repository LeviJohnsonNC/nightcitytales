-- One authored move and its receipt either both land or both roll back.
CREATE FUNCTION public.commit_opera_action(payload jsonb)
RETURNS void
LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
DECLARE
  v_campaign_id uuid := (payload->>'campaign_id')::uuid;
  v_request_id uuid := (payload->>'request_id')::uuid;
  v_from text := payload->>'from_beat';
  v_to text := payload->>'to_beat';
  v_day integer := (payload->>'day')::integer;
  v_minute integer := (payload->>'minute')::integer;
  v_campaign public.campaigns%ROWTYPE;
  v_progress public.mission_progress%ROWTYPE;
  v_started uuid;
BEGIN
  SELECT * INTO v_campaign FROM public.campaigns WHERE id = v_campaign_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Campaign not found'; END IF;

  IF v_request_id IS NULL OR v_from IS NULL OR v_to IS NULL OR NOT (
    (v_from = 'hook' AND v_to IN ('opera_clerk', 'opera_broadcast', 'opera_campus'))
    OR (v_from = 'opera_clerk' AND v_to = 'opera_guest_list')
    OR (v_from = 'opera_broadcast' AND v_to = 'opera_public_listing')
    OR (v_from = 'opera_campus' AND v_to = 'opera_press_access')
  ) OR coalesce(length(payload->>'input'), 0) NOT BETWEEN 1 AND 300
    OR coalesce(length(payload->>'summary'), 0) NOT BETWEEN 1 AND 300
  THEN RAISE EXCEPTION 'Invalid Opera action'; END IF;

  IF EXISTS (
    SELECT 1 FROM public.campaign_events WHERE campaign_id = v_campaign_id
      AND type = 'beat_advanced' AND data->>'opera_request_id' = v_request_id::text
      AND data->>'from_beat' = v_from AND beat_id = v_to
  ) THEN RETURN; END IF;

  SELECT id INTO v_started FROM public.campaign_events
    WHERE campaign_id = v_campaign_id AND type = 'mission_started' ORDER BY seq DESC LIMIT 1;
  IF v_campaign.phase <> 'job' OR v_campaign.status <> 'active'
    OR v_campaign.current_mission_id IS DISTINCT FROM 'night-at-the-opera'
    OR v_started IS DISTINCT FROM (payload->>'mission_started_id')::uuid
  THEN RAISE EXCEPTION 'This job is no longer active'; END IF;

  SELECT * INTO v_progress FROM public.mission_progress
    WHERE campaign_id = v_campaign_id AND mission_id = 'night-at-the-opera' FOR UPDATE;
  IF NOT FOUND OR v_progress.status <> 'active' OR v_progress.current_beat_id IS DISTINCT FROM v_from
    OR v_campaign.day IS DISTINCT FROM (payload->>'expected_day')::integer
    OR v_campaign.minute IS DISTINCT FROM (payload->>'expected_minute')::integer
    OR v_campaign.location_key IS DISTINCT FROM payload->>'expected_location'
  THEN RAISE EXCEPTION 'The scene changed. Choose an action from the current scene.'; END IF;

  IF jsonb_typeof(payload->'completed_beats') IS DISTINCT FROM 'array'
    OR jsonb_typeof(payload->'branch_choices') IS DISTINCT FROM 'object'
    OR payload->'branch_choices'->>v_from IS DISTINCT FROM v_to
    OR jsonb_typeof(payload->'objectives') IS DISTINCT FROM 'array'
    OR v_day IS NULL OR v_minute IS NULL OR v_minute NOT BETWEEN 0 AND 1439
    OR (v_day, v_minute) <= (v_campaign.day, v_campaign.minute)
  THEN RAISE EXCEPTION 'Invalid Opera result'; END IF;

  UPDATE public.mission_progress SET current_beat_id = v_to,
    completed_beats = payload->'completed_beats',
    branch_choices = payload->'branch_choices',
    objectives = payload->'objectives'
  WHERE id = v_progress.id;

  UPDATE public.campaigns SET day = v_day, minute = v_minute WHERE id = v_campaign_id;

  INSERT INTO public.campaign_events (campaign_id, type, beat_id, summary, data) VALUES
    (v_campaign_id, 'player_input', v_from, payload->>'input',
      jsonb_build_object('requestId', v_request_id)),
    (v_campaign_id, 'beat_advanced', v_to, payload->>'summary',
      jsonb_build_object('mission_id','night-at-the-opera','from_beat',v_from,'to_beat',v_to,
        'beat_type','dev','choice',payload->>'choice','opera_request_id',v_request_id));
END;
$$;

REVOKE EXECUTE ON FUNCTION public.commit_opera_action(jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.commit_opera_action(jsonb) TO authenticated;
