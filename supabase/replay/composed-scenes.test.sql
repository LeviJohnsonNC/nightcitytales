-- Run after replay.sh against its disposable database. All fixtures roll back.
BEGIN;
INSERT INTO auth.users (id) VALUES ('00000000-0000-0000-0000-000000000001');
INSERT INTO public.characters (id, user_id, name, role, creation_method)
VALUES ('00000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000001', 'Combat test', 'solo', 'streetrat');
INSERT INTO public.campaigns (id, user_id, character_id, name)
VALUES ('00000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000002', 'Combat test');
INSERT INTO public.campaign_vitals (campaign_id, hp_current, hp_max, seriously_wounded_threshold, humanity_current, humanity_max)
VALUES ('00000000-0000-0000-0000-000000000003', 5, 40, 20, 40, 40);

SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claim.sub = '00000000-0000-0000-0000-000000000001';
DO $$
DECLARE
  enc uuid;
  start_payload jsonb := '{
    "campaign_id":"00000000-0000-0000-0000-000000000003", "arena":"scene:fixture",
    "order_ids":["00000000-0000-0000-0000-000000000005"],
    "layout":{"version":2,"arena":{"key":"scene:fixture","label":"Intersection","extent":{"width":24,"height":24},"playerStart":{"x":9,"y":19},"hostileSlots":[],"cover":[],"environment":{"version":1,"recipe":"intersection","recipeVersion":1,"seed":1,"structures":[],"zones":[],"props":[],"clusters":[],"dressing":[]}}},
    "combatants":[{"id":"00000000-0000-0000-0000-000000000005","is_player":true,"name":"Player","side":"friendly","ref":6,"body":6,"hp_max":40,"hp_current":5,"seriously_wounded_threshold":20,"wound_state":"serious","death_save_penalty":0,"sp_head":7,"sp_body":7,"defeated":false,"initiative":15,"data":{"position":{"x":9,"y":19}}}]
  }';
  staged jsonb;
  revisited jsonb;
  stage_payload jsonb;
  save_payload jsonb;
  origin jsonb;
BEGIN
  stage_payload := jsonb_build_object('campaign_id',start_payload->>'campaign_id','manifest',
    jsonb_build_object('version',1,'scene',jsonb_build_object('template','test','templateVersion',1,
      'locationKey','north_heywood','anchor','crosswalk','narration','A quiet crosswalk.',
      'layout',start_payload->'layout','actors','[]'::jsonb)));
  staged := public.stage_authored_scene(stage_payload);
  IF staged->>'status' <> 'ready' OR EXISTS(SELECT 1 FROM public.encounters) THEN
    RAISE EXCEPTION 'staging started combat';
  END IF;
  revisited := public.stage_authored_scene(stage_payload);
  IF revisited->>'id' <> staged->>'id' OR (SELECT count(*) FROM public.campaign_events) <> 1 THEN
    RAISE EXCEPTION 'staging duplicated scene or narration';
  END IF;
  -- A newer authored template must not silently replace this instance.
  revisited := public.stage_authored_scene(jsonb_set(stage_payload,'{manifest,scene,narration}','"New template"'));
  IF revisited->'manifest' IS DISTINCT FROM staged->'manifest' THEN RAISE EXCEPTION 'template replaced saved scene'; END IF;
  UPDATE public.campaigns SET location_key='elsewhere' WHERE id=(start_payload->>'campaign_id')::uuid;
  IF public.read_campaign_scene(jsonb_build_object('campaign_id',start_payload->>'campaign_id')) IS NOT NULL THEN
    RAISE EXCEPTION 'scene followed player to another location';
  END IF;
  PERFORM public.stage_authored_scene(stage_payload);
  SELECT jsonb_build_object('phase',phase,'location',location_key,'missionId',current_mission_id)
    INTO origin FROM public.campaigns WHERE id=(start_payload->>'campaign_id')::uuid;
  start_payload := start_payload || jsonb_build_object('lifecycle_version',1,
    'command_id','00000000-0000-0000-0000-000000000006','expected_origin',origin,
    'scene_ref',jsonb_build_object('id',staged->>'id','revision',0));
  BEGIN
    PERFORM public.start_persisted_scene_encounter(jsonb_set(start_payload,'{scene_ref,revision}','5'));
    RAISE EXCEPTION 'accepted stale scene revision';
  EXCEPTION WHEN raise_exception THEN IF SQLERRM <> 'scene changed' THEN RAISE; END IF; END;
  BEGIN
    PERFORM public.start_persisted_scene_encounter(jsonb_set(start_payload,'{layout,arena,label}','"Wrong map"'));
    RAISE EXCEPTION 'accepted different geometry';
  EXCEPTION WHEN raise_exception THEN IF SQLERRM <> 'encounter does not match saved scene' THEN RAISE; END IF; END;
  BEGIN
    PERFORM public.start_persisted_scene_encounter(jsonb_set(start_payload,'{combatants,0,data,position,x}','11'));
    RAISE EXCEPTION 'accepted different player position';
  EXCEPTION WHEN raise_exception THEN IF SQLERRM <> 'scene player does not match' THEN RAISE; END IF; END;
  -- Unknown targets and invalid weapon requests fail before any entry/input writes.
  start_payload := start_payload || jsonb_build_object('initiating_intent',
    jsonb_build_object('version',1,'input','pull out my pistol and start blasting',
      'targetKey',NULL,'weapon','pistol'));
  BEGIN
    PERFORM public.start_scene_attack_encounter(jsonb_set(start_payload,'{initiating_intent,targetKey}','"invented"'));
    RAISE EXCEPTION 'accepted invented target';
  EXCEPTION WHEN raise_exception THEN IF SQLERRM <> 'invalid scene attack intent' THEN RAISE; END IF; END;
  BEGIN
    PERFORM public.start_scene_attack_encounter(jsonb_set(start_payload,'{initiating_intent,weapon}','"nuke"'));
    RAISE EXCEPTION 'accepted unsupported weapon';
  EXCEPTION WHEN raise_exception THEN IF SQLERRM <> 'invalid scene attack intent' THEN RAISE; END IF; END;
  IF EXISTS(SELECT 1 FROM public.campaign_events WHERE type='player_input') OR EXISTS(SELECT 1 FROM public.encounters) THEN
    RAISE EXCEPTION 'rejected request left partial state';
  END IF;
  enc := public.start_scene_attack_encounter(start_payload);
  IF public.start_scene_attack_encounter(start_payload) <> enc OR
    (SELECT count(*) FROM public.encounters) <> 1 THEN RAISE EXCEPTION 'scene entry duplicated encounter'; END IF;
  IF public.start_scene_attack_encounter(jsonb_set(start_payload,'{initiating_intent,input}','"open fire"')) <> enc THEN
    RAISE EXCEPTION 'second request rerolled entry';
  END IF;
  IF (SELECT count(*) FROM public.campaign_events WHERE type='player_input') <> 1 OR
    (SELECT e.origin->'source'->'initiatingIntent' FROM public.encounters e WHERE e.id=enc)
      IS DISTINCT FROM start_payload->'initiating_intent' THEN
    RAISE EXCEPTION 'entry lost or duplicated initiating intent';
  END IF;
  IF NOT EXISTS(SELECT 1 FROM public.campaign_scenes WHERE id=(staged->>'id')::uuid
    AND status='combat' AND revision=1 AND encounter_id=enc) THEN RAISE EXCEPTION 'scene did not engage'; END IF;
  BEGIN
    UPDATE public.encounters SET status='resolved' WHERE id=enc;
    SET CONSTRAINTS ALL IMMEDIATE;
    RAISE EXCEPTION 'abandoned scene without result';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM <> 'persistent scene requires a combat completion receipt' THEN RAISE; END IF;
  END;
  save_payload := jsonb_build_object('encounter_id',enc,'version',0,'layout_version',2,
    'lifecycle_version',1,'round',1,'active_index',0,'status','friendlies_won',
    'order_ids',start_payload->'order_ids','combatants',start_payload->'combatants',
    'player','{"hp_current":5,"wound_state":"serious","mortal_save_failures":0}'::jsonb,
    'completion',jsonb_build_object('summary','The cruiser door is destroyed.',
      'data',jsonb_build_object('encounterId',enc,'status','friendlies_won',
        'sceneResult',jsonb_build_object('version',1,'battlefield','Intersection','objects',
          '[{"id":"door","hp":0,"destroyed":true}]'::jsonb))));
  BEGIN
    PERFORM public.save_encounter_state(jsonb_set(save_payload,'{layout_version}','1'));
    RAISE EXCEPTION 'old client wrote composed geometry';
  EXCEPTION WHEN raise_exception THEN IF SQLERRM <> 'battlefield snapshot requires a current client and encounter version' THEN RAISE; END IF; END;
  PERFORM public.save_encounter_state(save_payload);
  SET CONSTRAINTS ALL IMMEDIATE;
  PERFORM public.save_encounter_state(save_payload);
  revisited := public.read_campaign_scene(jsonb_build_object('campaign_id',start_payload->>'campaign_id'));
  IF revisited->>'status' <> 'resolved' OR revisited->'revision' <> '2'::jsonb
    OR revisited->'result'->'objects'->0->'destroyed' <> 'true'::jsonb THEN
    RAISE EXCEPTION 'scene result did not commit exactly once';
  END IF;
  UPDATE public.campaigns SET location_key='elsewhere' WHERE id=(start_payload->>'campaign_id')::uuid;
  revisited := public.stage_authored_scene(stage_payload);
  IF revisited->>'status' <> 'resolved' OR revisited->>'encounter_id' <> enc::text
    OR revisited->>'summary' <> 'The cruiser door is destroyed.' THEN RAISE EXCEPTION 'revisit respawned scene'; END IF;
  IF public.start_scene_attack_encounter(start_payload) <> enc THEN RAISE EXCEPTION 'entry retry respawned scene'; END IF;
  UPDATE public.campaigns SET phase='hook' WHERE id=(start_payload->>'campaign_id')::uuid;
  revisited := public.stage_authored_scene(stage_payload);
  IF revisited->>'status' <> 'resolved' OR public.read_campaign_scene(jsonb_build_object('campaign_id',start_payload->>'campaign_id')) IS NULL THEN
    RAISE EXCEPTION 'aftermath disappeared across campaign phases';
  END IF;
  PERFORM set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000099',true);
  IF public.read_campaign_scene(jsonb_build_object('campaign_id',start_payload->>'campaign_id')) IS NOT NULL THEN
    RAISE EXCEPTION 'scene exposed to another owner';
  END IF;
END;
$$;
ROLLBACK;
