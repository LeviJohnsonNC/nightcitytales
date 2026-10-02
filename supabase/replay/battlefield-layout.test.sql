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
BEGIN
  enc := public.start_snapshot_encounter(start_payload);
  IF (SELECT layout FROM public.encounters WHERE id = enc) IS DISTINCT FROM start_payload->'layout' THEN
    RAISE EXCEPTION 'layout did not persist at entry';
  END IF;
  BEGIN
    PERFORM public.start_snapshot_encounter(start_payload);
    RAISE EXCEPTION 'accepted a second active encounter';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM <> 'campaign already has an active encounter' THEN RAISE; END IF;
  END;
  BEGIN
    UPDATE public.encounters SET layout = NULL WHERE id = enc;
    RAISE EXCEPTION 'layout was mutable';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM <> 'encounter layout is immutable' THEN RAISE; END IF;
  END;
  save_payload := jsonb_build_object('encounter_id', enc, 'version', 0, 'round', 1,
    'active_index', 0, 'status', 'active', 'order_ids', start_payload->'order_ids',
    'combatants', start_payload->'combatants',
    'player', '{"hp_current":5,"wound_state":"serious","mortal_save_failures":0}'::jsonb);
  BEGIN
    PERFORM public.save_encounter_state(save_payload);
    RAISE EXCEPTION 'accepted a legacy writer on a snapshot fight';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM <> 'battlefield snapshot requires a current client and encounter version' THEN RAISE; END IF;
  END;
  save_payload := save_payload || '{"layout_version":1}'::jsonb;
  BEGIN
    PERFORM public.save_encounter_state(save_payload - 'version');
    RAISE EXCEPTION 'accepted an unversioned snapshot write';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM <> 'battlefield snapshot requires a current client and encounter version' THEN RAISE; END IF;
  END;
  PERFORM public.save_encounter_state(save_payload);
  IF NOT EXISTS (SELECT 1 FROM public.encounters WHERE id = enc AND version = 1 AND layout = start_payload->'layout') THEN
    RAISE EXCEPTION 'snapshot write failed';
  END IF;
END;
$$;
ROLLBACK;
