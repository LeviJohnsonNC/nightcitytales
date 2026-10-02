CREATE OR REPLACE FUNCTION public.start_persisted_scene_encounter(payload jsonb) RETURNS uuid
LANGUAGE plpgsql SECURITY INVOKER SET search_path=public AS $$
DECLARE
  c public.campaigns%ROWTYPE;
  s public.campaign_scenes%ROWTYPE;
  v_id uuid;
  v_actor jsonb;
  v_intent jsonb := payload->'initiating_intent';
BEGIN
  SELECT * INTO c FROM public.campaigns WHERE id=(payload->>'campaign_id')::uuid AND user_id=auth.uid() FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'campaign not found'; END IF;
  SELECT * INTO s FROM public.campaign_scenes WHERE id=(payload->'scene_ref'->>'id')::uuid AND campaign_id=c.id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'scene not found'; END IF;
  -- Once engaged, this revision identifies one encounter. A repeated UI request
  -- returns it; it cannot reroll initiative or replace its participants.
  IF s.encounter_id IS NOT NULL AND (payload->'scene_ref'->>'revision')::integer=0 THEN
    RETURN s.encounter_id;
  END IF;
  IF s.status <> 'ready' OR payload->'scene_ref'->'revision' IS DISTINCT FROM to_jsonb(s.revision) THEN
    RAISE EXCEPTION 'scene changed';
  END IF;
  IF c.status <> 'active' OR c.location_key IS DISTINCT FROM s.location_key
    OR s.origin IS DISTINCT FROM jsonb_build_object('phase',c.phase,'missionId',c.current_mission_id) THEN
    RAISE EXCEPTION 'scene origin changed';
  END IF;
  IF payload->'layout' IS DISTINCT FROM s.manifest->'scene'->'layout' THEN
    RAISE EXCEPTION 'encounter does not match saved scene';
  END IF;
  IF jsonb_array_length(payload->'combatants') <> jsonb_array_length(s.manifest->'scene'->'actors')+1 THEN
    RAISE EXCEPTION 'scene actors do not match';
  END IF;
  FOR v_actor IN SELECT value FROM jsonb_array_elements(s.manifest->'scene'->'actors') LOOP
    IF (SELECT count(*) FROM jsonb_array_elements(payload->'combatants') x
      WHERE x->'data'->>'key'=v_actor->>'id' AND x->>'name'=v_actor->>'name'
        AND x->>'side'=v_actor->>'side' AND x->'data'->'position'=v_actor->'position'
        AND x->'is_player'='false'::jsonb) <> 1 THEN
      RAISE EXCEPTION 'scene actors do not match';
    END IF;
  END LOOP;
  IF (SELECT count(*) FROM jsonb_array_elements(payload->'combatants') x
    WHERE x->'is_player'='true'::jsonb AND x->'data'->'position'=s.manifest->'scene'->'layout'->'arena'->'playerStart') <> 1 THEN
    RAISE EXCEPTION 'scene player does not match';
  END IF;
  IF v_intent IS NOT NULL THEN
    IF NOT COALESCE(jsonb_typeof(v_intent)='object' AND v_intent->'version'='1'::jsonb
      AND jsonb_typeof(v_intent->'input')='string' AND length(trim(v_intent->>'input')) BETWEEN 1 AND 500
      AND (v_intent->'targetKey'='null'::jsonb OR EXISTS(
        SELECT 1 FROM jsonb_array_elements(s.manifest->'scene'->'actors') a
        WHERE a->>'id'=v_intent->>'targetKey' AND a->>'side'='hostile'))
      AND v_intent->'weapon' IN ('null'::jsonb,'"pistol"'::jsonb),false) THEN
      RAISE EXCEPTION 'invalid scene attack intent';
    END IF;
    v_intent := jsonb_build_object('version',1,'input',v_intent->>'input',
      'targetKey',v_intent->'targetKey','weapon',v_intent->'weapon');
    INSERT INTO public.campaign_events(campaign_id,type,summary,data)
    VALUES(c.id,'player_input',v_intent->>'input',jsonb_build_object('sceneId',s.id));
  END IF;
  v_id := public.start_scene_encounter(payload || jsonb_build_object('scene_source',
    jsonb_build_object('sceneId',s.id,'sceneRevision',s.revision,'manifest',s.manifest,
      'initiatingIntent',v_intent)));
  UPDATE public.campaign_scenes SET status='combat',revision=revision+1,encounter_id=v_id WHERE id=s.id;
  RETURN v_id;
END;
$$;

-- A distinct entry point makes a new client fail before mutation on an older
-- deployment, rather than letting the older RPC silently discard its intent.
CREATE FUNCTION public.start_scene_attack_encounter(payload jsonb) RETURNS uuid
LANGUAGE plpgsql SECURITY INVOKER SET search_path=public AS $$
BEGIN
  IF NOT (payload ? 'initiating_intent') OR payload->'initiating_intent'='null'::jsonb THEN
    RAISE EXCEPTION 'scene attack intent required';
  END IF;
  RETURN public.start_persisted_scene_encounter(payload);
END;
$$;
REVOKE ALL ON FUNCTION public.start_scene_attack_encounter(jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.start_scene_attack_encounter(jsonb) TO authenticated, service_role;