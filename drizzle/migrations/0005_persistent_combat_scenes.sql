CREATE TABLE public.campaign_scenes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid NOT NULL REFERENCES public.campaigns(id) ON DELETE CASCADE,
  location_key text NOT NULL,
  anchor text NOT NULL,
  manifest jsonb NOT NULL,
  origin jsonb NOT NULL,
  revision integer NOT NULL DEFAULT 0 CHECK (revision >= 0),
  status text NOT NULL DEFAULT 'ready' CHECK (status IN ('ready','combat','resolved')),
  encounter_id uuid UNIQUE REFERENCES public.encounters(id),
  result jsonb,
  summary text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(campaign_id,location_key,anchor),
  CHECK (COALESCE(manifest->'version' = '1'::jsonb AND jsonb_typeof(manifest->'scene')='object',false)),
  CHECK (octet_length(manifest::text) <= 131072)
);
ALTER TABLE public.campaign_scenes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owners read scenes" ON public.campaign_scenes FOR SELECT TO authenticated
USING (EXISTS(SELECT 1 FROM public.campaigns c WHERE c.id=campaign_id AND c.user_id=auth.uid()));
CREATE POLICY "Owners create scenes" ON public.campaign_scenes FOR INSERT TO authenticated
WITH CHECK (EXISTS(SELECT 1 FROM public.campaigns c WHERE c.id=campaign_id AND c.user_id=auth.uid()));
CREATE POLICY "Owners update scenes" ON public.campaign_scenes FOR UPDATE TO authenticated
USING (EXISTS(SELECT 1 FROM public.campaigns c WHERE c.id=campaign_id AND c.user_id=auth.uid()))
WITH CHECK (EXISTS(SELECT 1 FROM public.campaigns c WHERE c.id=campaign_id AND c.user_id=auth.uid()));
GRANT SELECT, INSERT, UPDATE ON public.campaign_scenes TO authenticated, service_role;

CREATE FUNCTION public.keep_scene_identity() RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$
BEGIN
  IF (NEW.manifest, NEW.origin, NEW.campaign_id, NEW.location_key, NEW.anchor)
    IS DISTINCT FROM (OLD.manifest, OLD.origin, OLD.campaign_id, OLD.location_key, OLD.anchor) THEN
    RAISE EXCEPTION 'scene identity is immutable';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER keep_scene_identity BEFORE UPDATE ON public.campaign_scenes
FOR EACH ROW EXECUTE FUNCTION public.keep_scene_identity();

CREATE FUNCTION public.stage_authored_scene(payload jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY INVOKER SET search_path=public AS $$
DECLARE
  c public.campaigns%ROWTYPE;
  s public.campaign_scenes%ROWTYPE;
  m jsonb := payload->'manifest';
  v_new boolean := false;
BEGIN
  SELECT * INTO c FROM public.campaigns WHERE id=(payload->>'campaign_id')::uuid AND user_id=auth.uid() FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'campaign not found'; END IF;
  IF c.status <> 'active' THEN RAISE EXCEPTION 'campaign is not active'; END IF;
  IF EXISTS(SELECT 1 FROM public.encounters WHERE campaign_id=c.id AND status='active') THEN
    RAISE EXCEPTION 'finish the active encounter before staging a scene';
  END IF;
  IF NOT COALESCE(m->'version'='1'::jsonb AND jsonb_typeof(m->'scene'->'actors')='array'
    AND jsonb_typeof(m->'scene'->'layout')='object'
    AND length(m->'scene'->>'locationKey') > 0 AND length(m->'scene'->>'anchor') > 0,false) THEN
    RAISE EXCEPTION 'invalid authored scene';
  END IF;
  SELECT * INTO s FROM public.campaign_scenes WHERE campaign_id=c.id
    AND location_key=m->'scene'->>'locationKey' AND anchor=m->'scene'->>'anchor' FOR UPDATE;
  IF NOT FOUND THEN
    INSERT INTO public.campaign_scenes(campaign_id,location_key,anchor,manifest,origin)
    VALUES(c.id,m->'scene'->>'locationKey',m->'scene'->>'anchor',m,
      jsonb_build_object('phase',c.phase,'missionId',c.current_mission_id)) RETURNING * INTO s;
    v_new := true;
  END IF;
  IF s.status <> 'resolved' AND s.origin IS DISTINCT FROM jsonb_build_object('phase',c.phase,'missionId',c.current_mission_id) THEN
    RAISE EXCEPTION 'scene belongs to another campaign phase or mission';
  END IF;
  IF s.status='combat' THEN RAISE EXCEPTION 'scene combat has not completed'; END IF;
  UPDATE public.campaigns SET location_key=s.location_key WHERE id=c.id;
  IF v_new OR c.location_key IS DISTINCT FROM s.location_key THEN
    INSERT INTO public.campaign_events(campaign_id,type,summary,data)
    VALUES(c.id,CASE WHEN c.phase IN ('job','aftermath') THEN 'gm_narration' ELSE 'life_narration' END,
      COALESCE(s.summary,s.manifest->'scene'->>'narration'),
      jsonb_build_object('sceneId',s.id,'sceneRevision',s.revision,'at',s.location_key,
        'day',c.day,'title',s.manifest->'scene'->'layout'->'arena'->>'label','actions','[]'::jsonb));
  END IF;
  RETURN to_jsonb(s);
END;
$$;

CREATE FUNCTION public.read_campaign_scene(payload jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY INVOKER SET search_path=public AS $$
DECLARE s public.campaign_scenes%ROWTYPE;
BEGIN
  SELECT s0.* INTO s FROM public.campaign_scenes s0 JOIN public.campaigns c ON c.id=s0.campaign_id
  WHERE c.id=(payload->>'campaign_id')::uuid AND c.user_id=auth.uid()
    AND (NOT (payload ? 'scene_id') OR s0.id=(payload->>'scene_id')::uuid)
    AND s0.location_key=c.location_key
    AND (s0.status='resolved' OR s0.origin=jsonb_build_object('phase',c.phase,'missionId',c.current_mission_id))
  ORDER BY s0.created_at DESC LIMIT 1;
  IF NOT FOUND THEN RETURN NULL; END IF;
  RETURN to_jsonb(s);
END;
$$;

CREATE FUNCTION public.start_persisted_scene_encounter(payload jsonb) RETURNS uuid
LANGUAGE plpgsql SECURITY INVOKER SET search_path=public AS $$
DECLARE
  c public.campaigns%ROWTYPE;
  s public.campaign_scenes%ROWTYPE;
  v_id uuid;
  v_actor jsonb;
BEGIN
  SELECT * INTO c FROM public.campaigns WHERE id=(payload->>'campaign_id')::uuid AND user_id=auth.uid() FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'campaign not found'; END IF;
  SELECT * INTO s FROM public.campaign_scenes WHERE id=(payload->'scene_ref'->>'id')::uuid AND campaign_id=c.id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'scene not found'; END IF;
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
  v_id := public.start_scene_encounter(payload || jsonb_build_object('scene_source',
    jsonb_build_object('sceneId',s.id,'sceneRevision',s.revision,'manifest',s.manifest)));
  UPDATE public.campaign_scenes SET status='combat',revision=revision+1,encounter_id=v_id WHERE id=s.id;
  RETURN v_id;
END;
$$;

CREATE FUNCTION public.apply_scene_completion() RETURNS trigger
LANGUAGE plpgsql SECURITY INVOKER SET search_path=public AS $$
BEGIN
  UPDATE public.campaign_scenes SET status='resolved',revision=revision+1,
    result=NEW.data->'sceneResult', summary=NEW.summary
  WHERE campaign_id=NEW.campaign_id AND encounter_id=(NEW.data->>'encounterId')::uuid AND status='combat'
    AND EXISTS(SELECT 1 FROM public.encounters e WHERE e.id=encounter_id AND e.status <> 'active'
      AND NEW.data->>'completionId'=e.id::text AND NEW.data->'finalVersion'=to_jsonb(e.version));
  RETURN NEW;
END;
$$;
CREATE TRIGGER scene_completion AFTER INSERT ON public.campaign_events
FOR EACH ROW WHEN (NEW.type='encounter_ended') EXECUTE FUNCTION public.apply_scene_completion();

CREATE FUNCTION public.require_scene_completion() RETURNS trigger
LANGUAGE plpgsql SET search_path=public AS $$
BEGIN
  IF EXISTS(SELECT 1 FROM public.campaign_scenes WHERE encounter_id=NEW.id AND status='combat') THEN
    RAISE EXCEPTION 'persistent scene requires a combat completion receipt';
  END IF;
  RETURN NEW;
END;
$$;
CREATE CONSTRAINT TRIGGER require_scene_completion AFTER UPDATE ON public.encounters
DEFERRABLE INITIALLY DEFERRED FOR EACH ROW WHEN (NEW.status <> 'active')
EXECUTE FUNCTION public.require_scene_completion();

REVOKE ALL ON FUNCTION public.stage_authored_scene(jsonb),public.read_campaign_scene(jsonb),public.start_persisted_scene_encounter(jsonb) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.stage_authored_scene(jsonb),public.read_campaign_scene(jsonb),public.start_persisted_scene_encounter(jsonb) TO authenticated,service_role;