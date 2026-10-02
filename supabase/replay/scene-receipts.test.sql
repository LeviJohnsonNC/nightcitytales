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
    "layout":{"version":1,"arena":{"key":"scene:fixture","label":"Intersection","extent":{"width":24,"height":24},"playerStart":{"x":9,"y":19},"hostileSlots":[],"cover":[]}},
    "combatants":[{"id":"00000000-0000-0000-0000-000000000005","is_player":true,"name":"Player","side":"friendly","ref":6,"body":6,"hp_max":40,"hp_current":5,"seriously_wounded_threshold":20,"wound_state":"serious","death_save_penalty":0,"sp_head":7,"sp_body":7,"defeated":false,"initiative":15,"data":{"position":{"x":9,"y":19}}}]
  }';
  save_payload jsonb;
  origin jsonb;
BEGIN
  SELECT jsonb_build_object('phase',phase,'location',location_key,'missionId',current_mission_id)
  INTO origin FROM public.campaigns WHERE id = (start_payload->>'campaign_id')::uuid;
  start_payload := start_payload || jsonb_build_object('lifecycle_version',1,
    'command_id','00000000-0000-0000-0000-000000000006','expected_origin',origin);
  BEGIN
    PERFORM public.start_scene_encounter(start_payload || '{"expected_origin":{}}'::jsonb);
    RAISE EXCEPTION 'accepted stale origin';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM <> 'scene origin changed' THEN RAISE; END IF;
  END;
  enc := public.start_scene_encounter(start_payload);
  IF public.start_scene_encounter(start_payload) <> enc THEN RAISE EXCEPTION 'entry retry duplicated fight'; END IF;
  IF (SELECT count(*) FROM public.campaign_events WHERE type='encounter_started') <> 1 THEN
    RAISE EXCEPTION 'entry receipt not atomic or duplicated';
  END IF;
  BEGIN
    PERFORM public.start_scene_encounter(start_payload || '{"name":"different"}'::jsonb);
    RAISE EXCEPTION 'accepted reused command';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM <> 'scene entry command was reused' THEN RAISE; END IF;
  END;
  BEGIN
    UPDATE public.encounters SET origin='{}' WHERE id=enc;
    RAISE EXCEPTION 'mutable origin';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM <> 'encounter origin is immutable' THEN RAISE; END IF;
  END;
  save_payload := jsonb_build_object('encounter_id',enc,'version',0,'layout_version',1,
    'lifecycle_version',1,'round',1,'active_index',0,'status','active',
    'order_ids',start_payload->'order_ids','combatants',start_payload->'combatants',
    'events','[{"type":"attack","summary":"A committed shot","data":{}}]'::jsonb,
    'player','{"hp_current":5,"wound_state":"serious","mortal_save_failures":0}'::jsonb);
  BEGIN
    PERFORM public.save_encounter_state(save_payload - 'lifecycle_version');
    RAISE EXCEPTION 'accepted old scene writer';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM <> 'scene encounter requires lifecycle protocol 1' THEN RAISE; END IF;
  END;
  BEGIN
    PERFORM public.save_encounter_state(save_payload || '{"version":null}'::jsonb);
    RAISE EXCEPTION 'accepted null version';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM <> 'invalid encounter version' THEN RAISE; END IF;
  END;
  PERFORM public.save_encounter_state(save_payload);
  PERFORM public.save_encounter_state(save_payload);
  IF (SELECT version FROM public.encounters WHERE id=enc) <> 1 OR
    (SELECT count(*) FROM public.campaign_events WHERE type='attack') <> 1 THEN
    RAISE EXCEPTION 'latest-save replay duplicated state or ledger';
  END IF;
  BEGIN
    PERFORM public.save_encounter_state(save_payload || '{"round":2}'::jsonb);
    RAISE EXCEPTION 'accepted stale conflicting save';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM <> 'encounter changed' THEN RAISE; END IF;
  END;
  save_payload := save_payload || '{"version":1,"status":"friendlies_won"}'::jsonb;
  BEGIN
    PERFORM public.save_encounter_state(save_payload);
    RAISE EXCEPTION 'ended without receipt';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM <> 'scene completion receipt required' THEN RAISE; END IF;
  END;
  save_payload := save_payload || jsonb_build_object('completion',jsonb_build_object(
    'summary','The fight is over.', 'data',jsonb_build_object('encounterId',enc,
      'status','friendlies_won','sceneResult',jsonb_build_object('version',1,'battlefield','Intersection'))));
  -- A failing ledger write must roll back the terminal status and vitals too.
  BEGIN
    PERFORM public.save_encounter_state(save_payload || '{"events":[{"type":"bogus"}],"player":{"hp_current":1,"wound_state":"serious","mortal_save_failures":0}}'::jsonb);
    RAISE EXCEPTION 'accepted invalid ledger event';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM <> 'unsupported combat event' THEN RAISE; END IF;
  END;
  IF NOT EXISTS(SELECT 1 FROM public.encounters WHERE id=enc AND version=1 AND status='active')
    OR (SELECT hp_current FROM public.campaign_vitals WHERE campaign_id=(start_payload->>'campaign_id')::uuid) <> 5 THEN
    RAISE EXCEPTION 'terminal failure did not roll back state';
  END IF;
  save_payload := jsonb_set(save_payload, '{combatants,0,defeated}', 'true'::jsonb);
  save_payload := jsonb_set(save_payload, '{combatants,0,data,exitReason}', '"dead"'::jsonb);
  PERFORM public.save_encounter_state(save_payload);
  PERFORM public.save_encounter_state(save_payload);
  IF (SELECT count(*) FROM public.campaign_events WHERE type='encounter_ended') <> 1
    OR NOT EXISTS(SELECT 1 FROM public.campaign_events WHERE type='encounter_ended'
      AND data->>'completionId'=enc::text AND data->'finalVersion'='2'::jsonb
      AND data->'origin'->>'phase'=origin->>'phase') THEN
    RAISE EXCEPTION 'terminal receipt missing or duplicated';
  END IF;
  IF NOT EXISTS(SELECT 1 FROM public.campaigns WHERE id=(start_payload->>'campaign_id')::uuid
    AND status='lost' AND phase=origin->>'phase') THEN
    RAISE EXCEPTION 'player death did not commit without changing phase';
  END IF;
  BEGIN
    PERFORM public.save_encounter_state(save_payload || '{"version":2,"status":"active"}'::jsonb);
    RAISE EXCEPTION 'reopened completed scene';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM <> 'encounter already completed' THEN RAISE; END IF;
  END;
  -- Entry retries still identify the completed fight, rather than creating a new one.
  IF public.start_scene_encounter(start_payload) <> enc THEN RAISE EXCEPTION 'lost entry receipt'; END IF;
  PERFORM set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000099',true);
  BEGIN
    PERFORM public.start_scene_encounter(start_payload);
    RAISE EXCEPTION 'read another owners receipt';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM <> 'campaign not found' THEN RAISE; END IF;
  END;
END;
$$;
ROLLBACK;
