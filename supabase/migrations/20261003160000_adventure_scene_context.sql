-- Automatic adventure composition may stage only at the still-current Job beat.
-- The authored fixture staging RPC intentionally permits travel; this entry point does not.
CREATE FUNCTION public.stage_adventure_scene(payload jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY INVOKER SET search_path=public AS $$
DECLARE c public.campaigns%ROWTYPE; p public.mission_progress%ROWTYPE;
BEGIN
  SELECT * INTO c FROM public.campaigns WHERE id=(payload->>'campaign_id')::uuid AND user_id=auth.uid() FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'campaign not found'; END IF;
  SELECT * INTO p FROM public.mission_progress WHERE campaign_id=c.id AND mission_id=c.current_mission_id FOR UPDATE;
  IF NOT FOUND OR c.status <> 'active' OR c.phase <> 'job' OR p.status <> 'active'
    OR p.current_beat_id IS NULL OR payload->'expected' IS DISTINCT FROM jsonb_build_object(
      'missionId',c.current_mission_id,'beatId',p.current_beat_id,'location',c.location_key)
    OR payload->'manifest'->'scene'->>'locationKey' IS DISTINCT FROM c.location_key
    OR payload->'manifest'->'scene'->>'template' IS DISTINCT FROM 'adventure-composition' THEN
    RAISE EXCEPTION 'adventure scene origin changed; reload the campaign';
  END IF;
  RETURN public.stage_authored_scene(payload);
END;
$$;

CREATE FUNCTION public.start_adventure_scene_encounter(payload jsonb) RETURNS uuid
LANGUAGE plpgsql SECURITY INVOKER SET search_path=public AS $$
DECLARE c public.campaigns%ROWTYPE; p public.mission_progress%ROWTYPE;
BEGIN
  SELECT * INTO c FROM public.campaigns WHERE id=(payload->>'campaign_id')::uuid AND user_id=auth.uid() FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'campaign not found'; END IF;
  SELECT * INTO p FROM public.mission_progress WHERE campaign_id=c.id AND mission_id=c.current_mission_id FOR UPDATE;
  IF NOT FOUND OR c.status <> 'active' OR c.phase <> 'job' OR p.status <> 'active'
    OR p.current_beat_id IS NULL OR payload->>'adventure_beat' IS DISTINCT FROM p.current_beat_id
    OR payload->>'beat_id' IS DISTINCT FROM p.current_beat_id THEN
    RAISE EXCEPTION 'adventure beat changed; reload the campaign';
  END IF;
  RETURN public.start_persisted_scene_encounter(payload);
END;
$$;
REVOKE ALL ON FUNCTION public.stage_adventure_scene(jsonb),public.start_adventure_scene_encounter(jsonb) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.stage_adventure_scene(jsonb),public.start_adventure_scene_encounter(jsonb) TO authenticated,service_role;
